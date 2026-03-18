import type { CalendarRecord, TheaterMetadata, EventRecord } from '../types';

interface RenderStats {
  total: number;
  spend: number;
  categoryCount: Record<string, number>;
  loyalty: {
    actors: { name: string; score: number }[];
    hasMoreActors?: boolean;
    theater: { name: string; count: number };
  };
  provinceCount: number;
  provinces: string[];
}

interface RenderOptions {
  records: CalendarRecord[];
  stats: RenderStats;
  dateRangeStr: string;
}

export const renderTheaterTicket = async (options: RenderOptions): Promise<string> => {
  const { records, stats, dateRangeStr } = options;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // 1. Layout Calculations
  const width = 375;
  
  // Dynamic Height Calculation
  const topShows = [...records]
    .filter(r => (r.extra_data as TheaterMetadata)?.score)
    .sort((a, b) => ((b.extra_data as TheaterMetadata).score || 0) - ((a.extra_data as TheaterMetadata).score || 0))
    .slice(0, 5);

  let currentY = 0;
  const headerHeight = 180; // Final calibration: more room for top margin
  const statsHeight = 220;
  const topShowsItemHeight = 60;
  const topShowsHeight = topShows.length > 0 ? 60 + topShows.length * topShowsItemHeight : 100;
  const footerHeight = 140;
  
  // Dynamic DPR for High-DPI (Retina) displays
  const dpr = window.devicePixelRatio || 1;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  const height = headerHeight + statsHeight + topShowsHeight + footerHeight + 40; // Total height
  
  // Guard for iOS/Safari height limits (Max 4096px)
  if (height * dpr > 4096) {
    canvas.height = 4096;
    canvas.width = (4096 / height) * width;
    ctx.scale(4096 / height, 4096 / height);
  } else {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
  }

  // Global Baseline Calibration
  ctx.textBaseline = 'middle';
  const baselineOffset = isIOS ? -1 : 0; // iOS Baseline Adjustment

  // 2. Background & Base Shape
  // Background gradient for page
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  // Ticket Container with Shadow (Emulated)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#ffffff';
  
  const ticketX = 16;
  const ticketWidth = width - 32;
  const ticketHeight = height - 40;
  const cornerRadius = 16;

  // Draw Rounded Rect
  ctx.beginPath();
  ctx.moveTo(ticketX + cornerRadius, 20);
  ctx.lineTo(ticketX + ticketWidth - cornerRadius, 20);
  ctx.quadraticCurveTo(ticketX + ticketWidth, 20, ticketX + ticketWidth, 20 + cornerRadius);
  ctx.lineTo(ticketX + ticketWidth, 20 + ticketHeight - cornerRadius);
  ctx.quadraticCurveTo(ticketX + ticketWidth, 20 + ticketHeight, ticketX + ticketWidth - cornerRadius, 20 + ticketHeight);
  ctx.lineTo(ticketX + cornerRadius, 20 + ticketHeight);
  ctx.quadraticCurveTo(ticketX, 20 + ticketHeight, ticketX, 20 + ticketHeight - cornerRadius);
  ctx.lineTo(ticketX, 20 + cornerRadius);
  ctx.quadraticCurveTo(ticketX, 20, ticketX + cornerRadius, 20);
  ctx.closePath();
  ctx.fill();
  
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // 3. Branding
  currentY = 95; // Final calibration: even more breathing room at the top
  ctx.fillStyle = '#9333ea';
  ctx.font = '900 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ALIBI LOG', width / 2, currentY + baselineOffset);
  
  currentY += 28;
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'italic 800 14px sans-serif';
  ctx.fillText('SHOW ARCHIVE', width / 2, currentY + baselineOffset);

  currentY += 22;
  ctx.fillStyle = '#64748b';
  ctx.font = '700 12px sans-serif';
  ctx.fillText(dateRangeStr, width / 2, currentY + baselineOffset);

  // Separator Line
  currentY += 25;
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ticketX + 20, currentY);
  ctx.lineTo(ticketX + ticketWidth - 20, currentY);
  ctx.stroke();

  // 4. Stats: Footprint
  currentY += 35;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1a1a1a';
  ctx.font = '900 16px sans-serif';
  ctx.fillText('足迹统计', ticketX + 24, currentY + baselineOffset);
  
  ctx.textAlign = 'right';
  ctx.fillStyle = '#9333ea';
  ctx.font = '900 18px sans-serif';
  ctx.fillText(`${stats.provinceCount} 个省份`, ticketX + ticketWidth - 24, currentY + baselineOffset);

  currentY += 20;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '600 11px sans-serif';
  
  // Logic Fix: Only show provinces, capped at 5
  const displayProvinces = stats.provinces.slice(0, 5);
  let provincesStr = displayProvinces.length > 0 ? displayProvinces.join(' · ') : '尚未点亮任何城市';
  if (stats.provinces.length > 5) provincesStr += ' ...';
  
  // Wrap text manually if too long
  const maxTextWidth = ticketWidth - 48;
  let line = '';
  const lines = [];
  for (let n = 0; n < provincesStr.length; n++) {
    const char = provincesStr[n];
    if (ctx.measureText(line + char).width < maxTextWidth) {
      line += char;
    } else {
      lines.push(line);
      line = char;
    }
  }
  lines.push(line);
  lines.slice(0, 1).forEach(l => { // Only 1 line for cities to keep it clean
    ctx.fillText(l, ticketX + 24, currentY + baselineOffset);
    currentY += 16;
  });

  // 5. Core Stats: Total Sessions & Loyalty
  currentY += 15;
  // Box 1: Sessions
  const boxWidth = (ticketWidth - 56) / 2;
  const boxHeight = 75; // Increased slightly for better centering
  ctx.fillStyle = '#fdf4ff';
  ctx.beginPath();
  ctx.roundRect(ticketX + 24, currentY, boxWidth, boxHeight, 12);
  ctx.fill();

  ctx.fillStyle = '#9333ea';
  ctx.font = '900 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(stats.total.toString(), ticketX + 24 + boxWidth / 2, currentY + 38 + baselineOffset);
  
  ctx.font = '800 9px sans-serif'; // Final calibration: more delicate heading
  ctx.fillText('WATCHED SESSIONS', ticketX + 24 + boxWidth / 2, currentY + 60 + baselineOffset);

  // Box 2: Favorite Performers
  ctx.fillStyle = '#eff6ff';
  ctx.beginPath();
  ctx.roundRect(ticketX + 32 + boxWidth, currentY, boxWidth, boxHeight, 12);
  ctx.fill();

  ctx.fillStyle = '#3b82f6';
  ctx.font = '900 13px sans-serif'; 
  
  const performerTitleX = ticketX + 32 + boxWidth + boxWidth / 2;
  
  if (stats.loyalty.actors.length > 0) {
    let performerStr = stats.loyalty.actors.map(a => a.name).join(' | ');
    if (stats.loyalty.hasMoreActors) performerStr += ' ...';
    
    // Robust Width Protection & Truncation
    const maxWidth = boxWidth - 20;
    
    // Adaptive Sizing
    if (ctx.measureText(performerStr).width > maxWidth) {
      ctx.font = '900 11px sans-serif';
    }
    if (ctx.measureText(performerStr).width > maxWidth) {
      ctx.font = '900 9px sans-serif';
    }
    
    // Truncation Fallback if still too long at 9px
    if (ctx.measureText(performerStr).width > maxWidth) {
      while (ctx.measureText(performerStr + '...').width > maxWidth && performerStr.length > 0) {
        performerStr = performerStr.slice(0, -1);
      }
      performerStr += '...';
    }

    ctx.fillText(performerStr, performerTitleX, currentY + 38 + baselineOffset);
  } else {
    ctx.fillText('暂无数据', performerTitleX, currentY + 38 + baselineOffset);
  }
  
  ctx.font = '800 9px sans-serif';
  ctx.fillText(`FAVORITE PERFORMERS`, performerTitleX, currentY + 60 + baselineOffset);

  // 6. Top Shows
  ctx.textAlign = 'left';
  currentY += 100;
  ctx.fillStyle = '#1a1a1a';
  ctx.font = '900 16px sans-serif';
  ctx.fillText('最爱演出 · TOP 5', ticketX + 24, currentY + baselineOffset);

  currentY += 15;
  if (topShows.length > 0) {
    topShows.forEach((r, i) => {
      currentY += 15;
      const extra = r.extra_data as TheaterMetadata;
      
      // Purple Circle
      ctx.fillStyle = '#9333ea';
      ctx.beginPath();
      ctx.arc(ticketX + 34, currentY + 18, 12, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((i + 1).toString(), ticketX + 34, currentY + 22 + baselineOffset);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#1a1a1a';
      ctx.font = '700 13px sans-serif';
      const title = (r as EventRecord).title || '无标题演出';
      ctx.fillText(title, ticketX + 54, currentY + 15 + baselineOffset);
      
      ctx.fillStyle = '#64748b';
      ctx.font = '600 10px sans-serif';
      // Undefined guard: Check if fields exist
      const cityText = extra.city ? (Array.isArray(extra.city) ? (extra.city[1] || extra.city[0]) : extra.city) : '';
      const theaterText = extra.theater || '';
      const locationInfo = [cityText, theaterText].filter(Boolean).join(' · ');
      ctx.fillText(locationInfo, ticketX + 54, currentY + 30 + baselineOffset);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#9333ea';
      ctx.font = '900 14px sans-serif';
      // Score Visualization: X.X ⭐
      const scoreNum = extra.score?.toFixed(1) || '0.0';
      ctx.fillText(`${scoreNum} ⭐`, ticketX + ticketWidth - 24, currentY + 22 + baselineOffset);

      currentY += 35;
    });
  } else {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 700 13px sans-serif';
    ctx.fillText('暂无高分记录', width / 2, currentY + 40 + baselineOffset);
    currentY += 60;
  }

  // 7. Stub Separator (Dashed Line)
  currentY += 40;
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(ticketX, currentY);
  ctx.lineTo(ticketX + ticketWidth, currentY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Mock perforations (semi-circles)
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(ticketX, currentY, 8, -Math.PI/2, Math.PI / 2);
  ctx.fill();
  
  ctx.beginPath();
  ctx.arc(ticketX + ticketWidth, currentY, 8, Math.PI/2, -Math.PI / 2);
  ctx.fill();

  // 8. Footer (Stub)
  currentY += 40;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748b';
  ctx.font = '900 12px sans-serif';
  ctx.fillText('ADMIT ONE | TOTAL SPENT', width / 2, currentY + baselineOffset);

  currentY += 30;
  ctx.fillStyle = '#1a1a1a';
  ctx.font = '900 28px sans-serif';
  ctx.fillText(`￥${stats.spend.toLocaleString()}`, width / 2, currentY + baselineOffset);

  currentY += 35;
  ctx.fillStyle = '#ef4444';
  ctx.font = '800 12px sans-serif';
  ctx.fillText('** 不含车马费 **', width / 2, currentY + baselineOffset);

  currentY += 45; // Final calibration: pushed even closer to bottom edge
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 10px sans-serif';
  ctx.fillText('你的生活本就值得记录', width / 2, currentY + baselineOffset);

  return canvas.toDataURL('image/png', 1.0);
};
