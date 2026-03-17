import type { CalendarRecord, RecordTag, TheaterMetadata, EventRecord } from '../types';

interface HorizontalRenderStats {
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

interface HorizontalRenderOptions {
  records: CalendarRecord[];
  stats: HorizontalRenderStats;
  dateRangeStr: string;
  theaterTags: RecordTag[];
}

// ── Helpers ─────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (ctx.measureText(t + '…').width > max && t.length > 0) t = t.slice(0, -1);
  return t + '…';
}

export const renderHorizontalTicket = async (options: HorizontalRenderOptions): Promise<string> => {
  const { records, stats, dateRangeStr, theaterTags } = options;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // ─── Canvas Setup ─────────────────────────────
  const W = 1200, H = 520;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.textBaseline = 'middle';

  // ─── Layout ───────────────────────────────────
  const STUB_W = 280;
  const MAIN_W = W - STUB_W;
  const PAD = 36;
  const PERF_R = 14;

  // ─── Colors ───────────────────────────────────
  const C = {
    bg1: '#0f0326', bg2: '#1a0a3a', bg3: '#2d1b69',
    accent: '#a78bfa', accentBright: '#c4b5fd', textMain: '#f5f3ff',
    textSub: '#c4b5fd', textDim: 'rgba(196, 181, 253, 0.5)',
    gold: '#fbbf24', stubBg: '#fefbf3', stubText: '#78716c', stubAccent: '#b45309',
  };

  // ═══════════════════════════════════════════════
  // 1. MAIN SECTION — Rich gradient background
  // ═══════════════════════════════════════════════
  const grad = ctx.createLinearGradient(0, 0, MAIN_W * 0.6, H);
  grad.addColorStop(0, C.bg1);
  grad.addColorStop(0.4, C.bg2);
  grad.addColorStop(1, C.bg3);
  ctx.fillStyle = grad;
  roundRect(ctx, 0, 0, MAIN_W + 10, H, 20); // +10 to overlap into perforation
  ctx.fill();

  // Background art: soft gradient orbs
  const orb1 = ctx.createRadialGradient(160, H - 80, 0, 160, H - 80, 220);
  orb1.addColorStop(0, 'rgba(139, 92, 246, 0.12)');
  orb1.addColorStop(1, 'rgba(139, 92, 246, 0)');
  ctx.fillStyle = orb1; ctx.fillRect(0, 0, MAIN_W, H);

  const orb2 = ctx.createRadialGradient(MAIN_W - 100, 60, 0, MAIN_W - 100, 60, 180);
  orb2.addColorStop(0, 'rgba(251, 191, 36, 0.06)');
  orb2.addColorStop(1, 'rgba(251, 191, 36, 0)');
  ctx.fillStyle = orb2; ctx.fillRect(0, 0, MAIN_W, H);

  // ── Row 1: Branding ──
  let y = PAD;
  ctx.fillStyle = C.accentBright;
  ctx.font = '900 16px "Inter", "SF Pro Display", "PingFang SC", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ALIBI LOG', PAD, y);

  ctx.fillStyle = C.textDim;
  ctx.font = '600 11px "Inter", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('SHOW ARCHIVE', MAIN_W - PAD, y);

  // ── Row 2: Title ──
  y += 46;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 44px "Inter", "SF Pro Display", "PingFang SC", sans-serif';
  ctx.fillText('观演总结', PAD, y);

  // Date range — positioned right of the title
  ctx.fillStyle = C.accent;
  ctx.font = '700 15px "Inter", sans-serif';
  // Measure title width with the correct font
  ctx.font = '900 44px "Inter", sans-serif';
  const titleW = ctx.measureText('观演总结').width;
  ctx.font = '700 15px "Inter", sans-serif';
  ctx.fillText(dateRangeStr, PAD + titleW + 18, y);

  // ── Separator ──
  y += 28;
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(MAIN_W - PAD, y); ctx.stroke();

  // ═══════════════════════════════════════════════
  // 2. STAT ROW (only unique stats: province + loyalty)
  // ═══════════════════════════════════════════════
  y += 22;
  const infoBoxW = (MAIN_W - PAD * 2 - 20) / 2;
  const infoH = 72;

  // Box: Province + Spiritual Home
  ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
  roundRect(ctx, PAD, y, infoBoxW, infoH, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
  ctx.lineWidth = 1;
  roundRect(ctx, PAD, y, infoBoxW, infoH, 12);
  ctx.stroke();

  ctx.fillStyle = C.accent;
  ctx.font = '800 11px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`🗺 足迹 ${stats.provinceCount} 省`, PAD + 16, y + 22);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 17px "Inter", sans-serif';
  const homeLabel = stats.loyalty.theater.name !== '-'
    ? `🏠 ${stats.loyalty.theater.name}  ×${stats.loyalty.theater.count}`
    : '🏠 尚未解锁精神老家';
  ctx.fillText(truncate(ctx, homeLabel, infoBoxW - 36), PAD + 16, y + 50);

  // Box: Favorite Actors
  const actorX = PAD + infoBoxW + 20;
  ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
  roundRect(ctx, actorX, y, infoBoxW, infoH, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
  roundRect(ctx, actorX, y, infoBoxW, infoH, 12);
  ctx.stroke();

  ctx.fillStyle = C.accent;
  ctx.font = '800 11px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('❤ 最爱演员', actorX + 16, y + 22);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 15px "Inter", sans-serif';
  let actorStr = stats.loyalty.actors.length > 0
    ? stats.loyalty.actors.map(a => a.name).join('  ·  ')
    : '暂无数据';
  if (stats.loyalty.hasMoreActors) actorStr += ' ...';
  ctx.fillText(truncate(ctx, actorStr, infoBoxW - 36), actorX + 16, y + 50);

  // ═══════════════════════════════════════════════
  // 3. TOP SHOWS (最爱演出 · TOP 3)
  // ═══════════════════════════════════════════════
  y += infoH + 40;
  ctx.fillStyle = C.gold;
  ctx.font = '900 17px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('⭐ 最爱演出 · TOP 3', PAD, y);

  y += 20;
  const topShows = [...records]
    .filter(r => (r.extra_data as TheaterMetadata)?.score)
    .sort((a, b) => ((b.extra_data as TheaterMetadata).score || 0) - ((a.extra_data as TheaterMetadata).score || 0))
    .slice(0, 3);

  if (topShows.length > 0) {
    topShows.forEach((r, i) => {
      const extra = r.extra_data as TheaterMetadata;
      const title = (r as EventRecord).title || '无标题';
      const rankY = y + i * 46;

      // Rank badge
      const badgeColors = ['#fbbf24', '#a78bfa', '#fb923c'];
      ctx.fillStyle = badgeColors[i] || C.accent;
      ctx.beginPath(); ctx.arc(PAD + 14, rankY + 14, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = i === 0 ? '#1a0533' : '#ffffff';
      ctx.font = '900 13px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((i + 1).toString(), PAD + 14, rankY + 14);

      // Title
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 15px "Inter", sans-serif';
      ctx.fillText(truncate(ctx, title, MAIN_W - PAD * 2 - 160), PAD + 38, rankY + 10);

      // Location subtitle
      ctx.fillStyle = C.textDim;
      ctx.font = '600 11px "Inter", sans-serif';
      const cityText = extra.city ? (Array.isArray(extra.city) ? (extra.city[1] || extra.city[0]) : extra.city) : '';
      const theaterText = extra.theater || '';
      ctx.fillText(truncate(ctx, [cityText, theaterText].filter(Boolean).join(' · '), MAIN_W - PAD * 2 - 160), PAD + 38, rankY + 28);

      // Score badge (right-aligned)
      ctx.textAlign = 'right';
      ctx.fillStyle = C.gold;
      ctx.font = '900 18px "Inter", sans-serif';
      ctx.fillText(`${(extra.score || 0).toFixed(1)}`, MAIN_W - PAD, rankY + 14);
    });
  } else {
    ctx.fillStyle = C.textDim;
    ctx.font = 'italic 700 13px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('暂无评分记录', MAIN_W / 2, y + 30);
  }

  // ═══════════════════════════════════════════════
  // 4. TAG PILLS (bottom of main section)
  // ═══════════════════════════════════════════════
  const tagRowY = H - 54;

  ctx.fillStyle = C.textDim;
  ctx.font = '700 10px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CATEGORIES', PAD, tagRowY - 24);

  let tagX = PAD;
  const tagH = 24, tagGap = 8, tagPadX = 12;

  theaterTags.forEach(tag => {
    ctx.font = '700 11px "Inter", sans-serif';
    const tw = ctx.measureText(tag.name).width + tagPadX * 2;

    if (tagX + tw > MAIN_W - PAD) { tagX = PAD; /* would need second row, skip */ return; }

    // Pill bg
    ctx.fillStyle = 'rgba(167, 139, 250, 0.15)';
    roundRect(ctx, tagX, tagRowY - tagH / 2, tw, tagH, tagH / 2);
    ctx.fill();

    // Pill border
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.3)';
    ctx.lineWidth = 0.8;
    roundRect(ctx, tagX, tagRowY - tagH / 2, tw, tagH, tagH / 2);
    ctx.stroke();

    // Text
    ctx.fillStyle = C.accentBright;
    ctx.textAlign = 'center';
    ctx.fillText(tag.name, tagX + tw / 2, tagRowY);

    tagX += tw + tagGap;
  });

  // Bottom branding
  ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.font = '600 10px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('你的生活本就值得记录', PAD, H - 16);

  // ═══════════════════════════════════════════════
  // 5. PERFORATION LINE
  // ═══════════════════════════════════════════════
  const perfX = MAIN_W;

  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(perfX, PERF_R + 4); ctx.lineTo(perfX, H - PERF_R - 4); ctx.stroke();
  ctx.setLineDash([]);

  // Notch cutouts
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath(); ctx.arc(perfX, 0, PERF_R, 0, Math.PI); ctx.fill();
  ctx.beginPath(); ctx.arc(perfX, H, PERF_R, Math.PI, 0); ctx.fill();

  // ═══════════════════════════════════════════════
  // 6. RIGHT STUB — Warm cream
  // ═══════════════════════════════════════════════
  ctx.fillStyle = C.stubBg;
  roundRect(ctx, MAIN_W, 0, STUB_W, H, 20);
  ctx.fill();
  ctx.fillStyle = C.stubBg;
  ctx.fillRect(MAIN_W, 0, 20, H); // overlap fix

  // Rotated watermark
  ctx.save();
  ctx.translate(MAIN_W + STUB_W - 16, H - 16);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = 'rgba(214, 211, 209, 0.35)';
  ctx.font = '900 12px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ADMIT ONE · ADMIT ONE · ADMIT ONE · ADMIT ONE', 0, 0);
  ctx.restore();

  const cx = MAIN_W + STUB_W / 2;
  let sy = 48;

  // Stub Header
  ctx.fillStyle = C.stubText;
  ctx.font = '800 10px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THEATER PASS', cx, sy);

  // Large number
  sy += 60;
  ctx.fillStyle = C.bg3;
  ctx.font = '900 80px "Inter", sans-serif';
  ctx.fillText(stats.total.toString(), cx, sy);

  sy += 42;
  ctx.fillStyle = C.stubText;
  ctx.font = '800 11px "Inter", sans-serif';
  ctx.fillText('SHOWS WATCHED', cx, sy);

  // Separator
  sy += 28;
  ctx.strokeStyle = '#e7e5e4';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(MAIN_W + 30, sy); ctx.lineTo(MAIN_W + STUB_W - 30, sy); ctx.stroke();

  // Spend
  sy += 28;
  ctx.fillStyle = C.stubAccent;
  ctx.font = '900 10px "Inter", sans-serif';
  ctx.fillText('TOTAL SPENT', cx, sy);

  sy += 30;
  ctx.fillStyle = '#1c1917';
  ctx.font = '900 32px "Inter", sans-serif';
  ctx.fillText(`￥${stats.spend.toLocaleString()}`, cx, sy);

  // Province count
  sy += 36;
  ctx.fillStyle = C.stubText;
  ctx.font = '700 10px "Inter", sans-serif';
  ctx.fillText(`${stats.provinceCount} PROVINCES`, cx, sy);

  // Barcode
  const barcodeY = H - 65;
  let bx = MAIN_W + 36;
  const barcodeEnd = MAIN_W + STUB_W - 36;
  ctx.fillStyle = 'rgba(120, 113, 108, 0.12)';
  const bars = [30, 22, 35, 18, 28, 35, 20, 32, 24, 35, 18, 30, 25, 35, 20, 28, 35, 22, 30, 18, 35, 24, 30, 20, 35];
  bars.forEach((bh, i) => {
    const w = i % 3 === 0 ? 4 : 2;
    if (bx + w < barcodeEnd) {
      ctx.fillRect(bx, barcodeY + (35 - bh) / 2, w, bh);
      bx += w + (i % 2 === 0 ? 3 : 4);
    }
  });

  ctx.fillStyle = 'rgba(120, 113, 108, 0.3)';
  ctx.font = '600 8px "Courier New", monospace';
  ctx.fillText(`NO. ${String(stats.total).padStart(6, '0')}`, cx, H - 20);

  return canvas.toDataURL('image/png', 1.0);
};
