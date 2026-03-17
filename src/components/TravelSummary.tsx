import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Palmtree, MapPin, Ticket, Filter, Calendar, TrendingUp, Theater, Utensils, Globe, Map, Download, Image, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';
import 'echarts-wordcloud';
import type { EventRecord, RecordTag, TravelMetadata, CalendarRecord, FoodMetadata, TheaterMetadata, NormalLocationData } from '../types';
import { provinceData } from '../utils/cityData';

const ensureFullName = (name: string): string => {
  if (!name) return "";
  let clean = name.trim();
  const autonomousRegions: Record<string, string> = {
    "内蒙古": "内蒙古自治区", "广西": "广西壮族自治区", "西藏": "西藏自治区",
    "宁夏": "宁夏回族自治区", "新疆": "新疆维吾尔自治区"
  };
  const specialRegions: Record<string, string> = { "香港": "香港特别行政区", "澳门": "澳门特别行政区" };
  const municipalities = ["北京", "上海", "天津", "重庆"];
  if (autonomousRegions[clean]) return autonomousRegions[clean];
  if (specialRegions[clean]) return specialRegions[clean];
  if (municipalities.includes(clean)) return clean + "市";
  if (clean.endsWith('省') || clean.endsWith('市') || clean.endsWith('自治区') || clean.endsWith('特别行政区')) return clean;
  return clean + "省";
};

const EXPENSE_CATS = [
  { key: 'transport', label: '交通', emoji: '🚆', color: '#3b82f6' },
  { key: 'accommodation', label: '住宿', emoji: '🏨', color: '#8b5cf6' },
  { key: 'tickets', label: '门票', emoji: '🎫', color: '#10b981' },
  { key: 'food', label: '饮食', emoji: '🍜', color: '#f59e0b' },
  { key: 'souvenirs', label: '纪念品', emoji: '🧧', color: '#ef4444' },
  { key: 'other', label: '其他', emoji: '📦', color: '#6b7280' },
];

const CHINA_REGIONS: Record<string, string[]> = {
  '华东': ['上海','江苏','浙江','安徽','福建','江西','山东','台湾'],
  '华北': ['北京','天津','河北','山西','内蒙古'],
  '东北': ['辽宁','吉林','黑龙江'],
  '华中': ['河南','湖北','湖南'],
  '华南': ['广东','广西','海南','香港','澳门'],
  '西南': ['重庆','四川','贵州','云南','西藏'],
  '西北': ['陕西','甘肃','青海','宁夏','新疆'],
};

const WORLD_REGIONS: Record<string, string> = {
  '日本':'亚洲','韩国':'亚洲','泰国':'亚洲','越南':'亚洲','新加坡':'亚洲','马来西亚':'亚洲','印度尼西亚':'亚洲','菲律宾':'亚洲','印度':'亚洲','尼泊尔':'亚洲','斯里兰卡':'亚洲','柬埔寨':'亚洲','缅甸':'亚洲','老挝':'亚洲','蒙古':'亚洲',
  '法国':'欧洲','英国':'欧洲','德国':'欧洲','意大利':'欧洲','西班牙':'欧洲','瑞士':'欧洲','荷兰':'欧洲','比利时':'欧洲','奥地利':'欧洲','葡萄牙':'欧洲','希腊':'欧洲','瑞典':'欧洲','挪威':'欧洲','丹麦':'欧洲','芬兰':'欧洲','冰岛':'欧洲','捷克':'欧洲','匈牙利':'欧洲','波兰':'欧洲','土耳其':'欧洲','俄罗斯':'欧洲','克罗地亚':'欧洲',
  '美国':'北美洲','加拿大':'北美洲','墨西哥':'北美洲',
  '巴西':'南美洲','阿根廷':'南美洲','智利':'南美洲','秘鲁':'南美洲','哥伦比亚':'南美洲',
  '澳大利亚':'大洋洲','新西兰':'大洋洲',
  '埃及':'非洲','南非':'非洲','摩洛哥':'非洲','肯尼亚':'非洲','坦桑尼亚':'非洲',
  '阿联酋':'中东','以色列':'中东','约旦':'中东','沙特阿拉伯':'中东','卡塔尔':'中东',
};

// Travel Summary Props
interface TravelSummaryProps {
  records: EventRecord[];
  tags: RecordTag[];
  isTheaterMode: boolean;
  isFoodMode: boolean;
  allRecords: CalendarRecord[];
}

// AMap Security Config (same as FoodMap)
if (typeof window !== 'undefined') {
  (window as any)._AMapSecurityConfig = {
    securityJsCode: '9ec70dc2db7d42cc92feb1a2b825e22f',
  };
}
const AMAP_KEY = 'cd4b3bc21146d9163337e1e174b8cc8a';

interface TravelAMapProps {
  markers: { name: string; lat: number; lng: number; type: string; detail?: string }[];
  colorMap: Record<string, { bg: string; border: string; emoji: string }>;
}

const TravelAMapSection: React.FC<TravelAMapProps> = ({ markers, colorMap }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<any>(null);

  React.useEffect(() => {
    if (!containerRef.current || markers.length === 0) return;

    const loadAndInit = () => {
      const AMap = (window as any).AMap;
      if (!AMap) return;

      AMap.plugin(['AMap.InfoWindow'], () => {
        const map = new AMap.Map(containerRef.current, {
          zoom: 5, center: [104.0, 35.0],
          mapStyle: 'amap://styles/whitesmoke',
          resizeEnable: true,
        });
        mapRef.current = map;

        const infoWindow = new AMap.InfoWindow({
          isCustom: false, offset: new AMap.Pixel(0, -36), autoMove: true,
        });

        const aMarkers: any[] = [];

        markers.forEach(pt => {
          const style = colorMap[pt.type] || colorMap['地点'];
          const div = document.createElement('div');
          div.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));';
          div.innerHTML = `
            <div style="background:${style.bg};color:white;padding:5px 10px;border-radius:20px;font-size:12px;font-weight:900;white-space:nowrap;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.15);letter-spacing:-0.3px;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;">
              ${style.emoji} ${pt.name}
            </div>
            <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${style.border};margin-top:-1px;"></div>
          `;

          const marker = new AMap.Marker({
            position: new AMap.LngLat(pt.lng, pt.lat),
            content: div,
            anchor: 'bottom-center',
          });

          const infoContent = `
            <div style="padding:14px 18px;min-width:180px;max-width:260px;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;line-height:1.6;color:#334155;">
              <div style="font-size:15px;font-weight:800;color:#1e293b;margin-bottom:6px;letter-spacing:-0.3px;">${pt.name}</div>
              <div style="font-size:12px;color:#94a3b8;display:flex;align-items:center;gap:4px;margin-bottom:4px;"><span>${style.emoji}</span><span>${pt.type}</span></div>
              ${pt.detail ? `<div style="font-size:11px;color:#94a3b8;">📍 ${pt.detail}</div>` : ''}
            </div>
          `;

          marker.on('mouseover', () => { infoWindow.setContent(infoContent); infoWindow.open(map, marker.getPosition()); });
          marker.on('click', () => { infoWindow.setContent(infoContent); infoWindow.open(map, marker.getPosition()); });
          map.add(marker);
          aMarkers.push(marker);
        });

        map.setFitView(null, false, [60, 60, 60, 60]);
      });
    };

    const scriptId = 'amap-js-sdk';
    if (document.getElementById(scriptId)) {
      if ((window as any).AMap) { loadAndInit(); }
      else {
        const iv = setInterval(() => { if ((window as any).AMap) { clearInterval(iv); loadAndInit(); } }, 100);
        setTimeout(() => clearInterval(iv), 5000);
      }
    } else {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}`;
      script.async = true;
      script.onload = loadAndInit;
      document.head.appendChild(script);
    }

    return () => { if (mapRef.current) { mapRef.current.destroy(); mapRef.current = null; } };
  }, [markers, colorMap]);

  return <div ref={containerRef} style={{ width: '100%', height: 400, borderRadius: 12, overflow: 'hidden' }} />;
};

export const TravelSummary: React.FC<TravelSummaryProps> = ({ records, tags, isTheaterMode, isFoodMode, allRecords }) => {
  const navigate = useNavigate();
  const [summaryMode, setSummaryMode] = useState<'all' | 'single'>('all');
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [chinaGeo, setChinaGeo] = useState<any>(null);
  const [worldGeo, setWorldGeo] = useState<any>(null);
  const [mapScope, setMapScope] = useState<'china' | 'world'>('china');

  // Single trip filter state
  const [singleYear, setSingleYear] = useState('');
  const [singleMonth, setSingleMonth] = useState('');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  // ── Poster state ───────────────────────────────────────────────
  const [posterImage, setPosterImage] = useState<string | null>(null);
  const [posterLoading, setPosterLoading] = useState(false);
  const [posterMapChoice, setPosterMapChoice] = useState<'china' | 'world'>('china');
  const [showPosterDialog, setShowPosterDialog] = useState(false);

  // ECharts refs for getDataURL()
  const chinaMapRef = useRef<any>(null);
  const worldMapRef = useRef<any>(null);
  const expensePieRef = useRef<any>(null);
  const singlePieRef = useRef<any>(null);
  const wordCloudRef = useRef<any>(null);

  // Helper: get chart image from ref
  const getChartImage = useCallback((ref: React.RefObject<any>): string | null => {
    try {
      const instance = ref.current?.getEchartsInstance?.();
      if (!instance) return null;
      return instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    } catch { return null; }
  }, []);

  // ── Generate poster ──
  const handleGeneratePoster = async (
    mode: 'all' | 'single',
    statsData: any,
    tripData?: { title: string; startDate: string; endDate: string; days: number; destinations: string[]; totalSpend: number; attractionNames: string[]; theaterRecs: EventRecord[]; foodRecs: EventRecord[]; expenseSums?: Record<string, number> } | null
  ) => {
    setPosterLoading(true);
    // Freeze background to prevent distortion during rendering
    document.body.style.overflow = 'hidden';
    await new Promise(r => setTimeout(r, 600));

    // Helper: create temporary ECharts instance for maps (fixes world map not rendering)
    const renderMapToImage = (option: any, mapName: string): string | null => {
      try {
        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = 'width:600px;height:400px;position:fixed;left:-9999px;top:0;';
        document.body.appendChild(tempDiv);
        const chart = echarts.init(tempDiv);
        if (mapName === 'world' && worldGeo) echarts.registerMap('world', worldGeo);
        if (mapName === 'china' && chinaGeo) echarts.registerMap('china', chinaGeo);
        // Deep-clone option and apply map-specific zoom for poster export
        // China: 0.95x adjusted, World: 0.93x of current
        const zoomedOption = JSON.parse(JSON.stringify(option));
        const extraZoom = mapName === 'world' ? 1.205 : 1.083;
        if (zoomedOption.layoutSize) {
          const size = parseFloat(zoomedOption.layoutSize);
          zoomedOption.layoutSize = `${Math.round(size * extraZoom)}%`;
        }
        if (zoomedOption.series?.[0]) {
          zoomedOption.series[0].zoom = (zoomedOption.series[0].zoom || 1) * extraZoom;
        }
        chart.setOption(zoomedOption);
        const url = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
        chart.dispose();
        document.body.removeChild(tempDiv);
        return url;
      } catch { return null; }
    };

    // Collect chart images
    const chartImages: Record<string, string | null> = {};
    if (mode === 'all') {
      chartImages.map = posterMapChoice === 'china' ? renderMapToImage(chinaMapOption, 'china') : renderMapToImage(worldMapOption, 'world');
      // Render pie chart with visible labels for poster
      if (stats.totalSpend > 0) {
        try {
          const pieData = EXPENSE_CATS.map(c => ({ name: c.label, value: stats.expenseSums[c.key] || 0 })).filter(d => d.value > 0);
          const tempDiv = document.createElement('div');
          tempDiv.style.cssText = 'width:400px;height:300px;position:fixed;left:-9999px;top:0;';
          document.body.appendChild(tempDiv);
          const chart = echarts.init(tempDiv);
          chart.setOption({
            legend: { bottom: '0%', left: 'center', textStyle: { color: '#334155', fontSize: 11, fontWeight: 700 }, itemGap: 10, itemWidth: 10, itemHeight: 10 },
            series: [{
              name: '支出占比', type: 'pie', radius: ['32%', '55%'], center: ['50%', '40%'],
              avoidLabelOverlap: true,
              itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
              label: { show: true, formatter: '{b} {d}%', fontSize: 11, fontWeight: 700, color: '#475569' },
              labelLine: { show: true, length: 8, length2: 12 },
              data: pieData,
              color: EXPENSE_CATS.map(c => c.color),
            }]
          });
          chart.resize();
          chartImages.pie = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
          chart.dispose();
          document.body.removeChild(tempDiv);
        } catch { chartImages.pie = getChartImage(expensePieRef); }
      }
    } else {
      chartImages.pie = getChartImage(singlePieRef);
      chartImages.wordCloud = getChartImage(wordCloudRef);
    }

    const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const flightCode = 'ALIBI-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const mapLabel = posterMapChoice === 'china' ? '🇨🇳 中国足迹' : '🌍 全球足迹';

    // ── Boarding-pass style CSS ──
    const posterWidth = mode === 'all' ? 1200 : 750;
    const css = `
      * { margin:0; padding:0; box-sizing:border-box; }
      .poster { font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Noto Sans SC','Microsoft YaHei',sans-serif; width:${posterWidth}px; background:#FAFAF8; color:#1a1a1a; border-radius:16px; }
      /* ── Horizontal boarding pass (all mode) ── */
      .bp-header-full { background:linear-gradient(135deg,#065f46 0%,#10b981 100%); color:#fff; padding:18px 32px; display:flex; align-items:center; justify-content:space-between; }
      .bp-hf-title { font-size:24px; font-weight:900; letter-spacing:2px; }
      .bp-hf-sub { font-size:12px; opacity:0.6; margin-top:3px; letter-spacing:3px; text-transform:uppercase; }
      .bp-hf-right { text-align:right; }
      .bp-hf-code { font-size:14px; font-weight:700; letter-spacing:2px; opacity:0.8; }
      .bp-body { display:flex; min-height:420px; }
      .bp-main { flex:1; display:flex; flex-direction:column; }
      .bp-tear-v { width:32px; background:#FAFAF8; display:flex; flex-direction:column; align-items:center; justify-content:center; }
      .bp-tear-v .v-dots { flex:1; border-left:2px dashed #d1d5db; }
      .bp-tear-v .v-circle { width:18px; height:18px; border-radius:50%; background:#e5e7eb; flex-shrink:0; }
      .bp-stub { width:220px; background:#f9faf9; display:flex; flex-direction:column; padding:18px 20px; }
      .stub-field { display:flex; justify-content:space-between; align-items:baseline; padding:4px 0; }
      .stub-label { font-size:11px; font-weight:800; color:#6b7280; text-transform:uppercase; letter-spacing:1px; }
      .stub-val { font-size:15px; font-weight:800; color:#1e293b; }
      .stub-divider { border-bottom:1px dashed #d1d5db; margin:4px 0; }
      .bp-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; padding:14px 24px; }
      .bp-stat { background:#fff; border:1px solid #e5e7eb; border-radius:10px; padding:5px 8px 14px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center; }
      .bp-stat .label { font-size:11px; font-weight:800; color:#6b7280; text-transform:uppercase; letter-spacing:1px; margin-bottom:0; }
      .bp-stat .value { font-size:26px; font-weight:900; color:#065f46; line-height:1; margin-top:-2px; }
      .bp-stat .unit { font-size:11px; font-weight:700; color:#9ca3af; margin-top:2px; }
      .bp-stat.accent { background:#10b981; border-color:#10b981; }
      .bp-stat.accent .label { color:#d1fae5; }
      .bp-stat.accent .value { color:#fff; }
      .bp-stat.accent .unit { color:#a7f3d0; }
      .bp-content { flex:1; display:flex; gap:12px; padding:0 24px 14px; align-items:stretch; }
      .bp-map-box { width:55%; flex-shrink:0; background:#fff; border:1px solid #e5e7eb; border-radius:10px; padding:10px; display:flex; flex-direction:column; overflow:hidden; }
      .bp-map-label { font-size:13px; font-weight:900; color:#1e293b; margin-bottom:6px; flex-shrink:0; }
      .bp-map-box .map-img-wrap { flex:1; display:flex; align-items:center; justify-content:center; overflow:hidden; min-height:0; }
      .bp-map-box img { height:100%; width:auto; max-width:100%; object-fit:contain; border-radius:6px; display:block; }
      .bp-ranks { flex:1; display:flex; flex-direction:column; gap:8px; min-width:0; }
      .bp-ranks-bottom { display:flex; flex-direction:row; gap:8px; flex:1; }
      .ranking-card { background:#fff; border-radius:10px; border:1px solid #e5e7eb; padding:10px 12px; flex:1; display:flex; flex-direction:column; min-width:0; }
      .ranking-card .rc-title { font-size:12px; font-weight:900; letter-spacing:1px; margin-bottom:6px; white-space:nowrap; }
      .ranking-card .rc-item { font-size:12px; padding:5px 0; border-bottom:1px solid #f3f4f6; line-height:1.8; }
      .ranking-card .rc-item:last-child { border:none; }
      .ranking-card .rc-name { font-weight:700; color:#334155; }
      .purple-card { background:#faf5ff; border-color:#e9d5ff; }
      .purple-card .rc-title { color:#7c3aed; }
      .orange-card { background:#fffbeb; border-color:#fde68a; }
      .orange-card .rc-title { color:#ea580c; }
      .green-card { background:#f0fdf4; border-color:#bbf7d0; }
      .green-card .rc-title { color:#059669; }
      .stub-barcode { display:flex; justify-content:center; gap:1.5px; margin-top:auto; padding-top:8px; }
      .stub-barcode div { height:24px; background:#1e293b; border-radius:1px; }
      .stub-footer { font-size:9px; color:#9ca3af; text-align:center; margin-top:4px; letter-spacing:1px; }
      .bp-slogan { font-size:10px; color:#9ca3af; text-align:center; font-style:italic; letter-spacing:1px; padding:6px 0; }
      .pie-card { background:#fff; border-color:#e5e7eb; }
      .pie-card .rc-title { color:#065f46; }
      .pie-card img { display:block; }
      /* ── Vertical poster (single mode) ── */
      .footer { padding:20px 28px 24px; text-align:center; }
      .barcode { display:flex; justify-content:center; gap:2px; margin-bottom:8px; }
      .barcode div { height:28px; background:#1e293b; border-radius:1px; }
      .footer-text { font-size:9px; color:#9ca3af; letter-spacing:1px; }
      .trip-header { background:linear-gradient(135deg,#065f46,#059669); color:#fff; padding:24px 36px; }
      .trip-route { display:flex; align-items:center; gap:16px; margin-top:12px; }
      .trip-city { font-size:22px; font-weight:900; letter-spacing:1px; }
      .trip-arrow { font-size:20px; opacity:0.6; }
      .trip-meta { font-size:11px; opacity:0.7; margin-top:6px; }
      .tear-line { display:flex; align-items:center; padding:0 20px; }
      .tear-line .circle { width:20px; height:20px; border-radius:50%; background:#FAFAF8; flex-shrink:0; }
      .tear-line .dots { flex:1; border-bottom:2px dashed #d1d5db; margin:0 -10px; }
      .tear-line-green { background:#f0fdf4; }
      .stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; padding:20px 28px; }
      .stat-card { background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:12px 14px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center; }
      .stat-card .label { font-size:10px; font-weight:800; color:#6b7280; text-transform:uppercase; letter-spacing:1px; margin-bottom:2px; }
      .stat-card .value { font-size:28px; font-weight:900; color:#065f46; line-height:1.1; }
      .stat-card .unit { font-size:11px; font-weight:700; color:#9ca3af; margin-top:2px; }
      .stat-card.accent { background:#10b981; border-color:#10b981; }
      .stat-card.accent .label { color:#d1fae5; }
      .stat-card.accent .value { color:#fff; }
      .stat-card.accent .unit { color:#a7f3d0; }
      .section { padding:16px 28px; }
      .section-title { font-size:15px; font-weight:900; color:#1e293b; margin-bottom:12px; display:flex; align-items:center; gap:8px; }
      .chart-img { width:100%; border-radius:12px; border:1px solid #e5e7eb; }
      .attractions-grid { display:flex; flex-wrap:wrap; gap:8px; align-items:stretch; }
      .att-chip { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:6px 12px; font-size:11px; font-weight:700; color:#065f46; display:flex; align-items:center; line-height:1.2; }
      .expense-table { width:100%; border-collapse:collapse; font-size:12px; }
      .expense-table th { text-align:left; padding:6px 10px; font-weight:800; font-size:10px; color:#6b7280; text-transform:uppercase; letter-spacing:1px; border-bottom:2px solid #e5e7eb; }
      .expense-table td { padding:6px 10px; border-bottom:1px solid #f3f4f6; color:#334155; font-weight:600; }
      .expense-table .amt { text-align:right; font-weight:800; color:#065f46; }
    `;

    let html = `<style>${css}</style><div class="poster">`;

    if (mode === 'all' && statsData) {
      // ── ALL TRIPS — HORIZONTAL BOARDING PASS ──
      // Smart date range label
      let filterLabel = '';
      if (selectedYears.length === 1) {
        const year = selectedYears[0];
        const sortedMonths = [...selectedMonths].map(m => parseInt(m, 10)).sort((a, b) => a - b);
        if (sortedMonths.length === 1) {
          filterLabel = `${year}.${sortedMonths[0]}`;
        } else if (sortedMonths.length > 1) {
          filterLabel = `${year}.${sortedMonths[0]} - ${year}.${sortedMonths[sortedMonths.length - 1]}`;
        } else {
          filterLabel = `${year} 年度总结`;
        }
      } else if (selectedYears.length > 1) {
        const sorted = [...selectedYears].sort();
        filterLabel = `${sorted[0]} - ${sorted[sorted.length - 1]}`;
      } else {
        // No filter — derive actual date range from records
        let minDate = '';
        let maxDate = '';
        filteredRecords.forEach(r => {
          const extra = r.extra_data as any;
          if (extra?.startDate && (!minDate || extra.startDate < minDate)) minDate = extra.startDate;
          if (extra?.endDate && (!maxDate || extra.endDate > maxDate)) maxDate = extra.endDate;
        });
        if (minDate && maxDate) {
          const [y1, m1] = minDate.split('-');
          const [y2, m2] = maxDate.split('-');
          if (y1 === y2) {
            filterLabel = parseInt(m1) === parseInt(m2) ? `${y1}.${parseInt(m1)}` : `${y1}.${parseInt(m1)} - ${y1}.${parseInt(m2)}`;
          } else {
            filterLabel = `${y1} - ${y2}`;
          }
        } else {
          filterLabel = '全时段总结';
        }
      }

      // Build ranking section: favorite region on top, theater+food side by side below
      let rankTopHtml = '';
      if (statsData.favoriteRegion) {
        rankTopHtml = `<div class="ranking-card green-card" style="flex:none;"><div class="rc-title">📍 最爱地区</div><div class="rc-item"><span class="rc-name">${statsData.favoriteRegion.name}</span></div></div>`;
      }
      
      const hasTheaterRank = isTheaterMode && statsData.topTheaters.length > 0;
      const hasFoodRank = isFoodMode && statsData.topFoods.length > 0;
      
      const bottomCards: string[] = [];
      if (hasTheaterRank) {
        bottomCards.push(`<div class="ranking-card purple-card"><div class="rc-title">🎭 观演排行</div>${statsData.topTheaters.slice(0, 3).map((t: any, i: number) => `<div class="rc-item"><span class="rc-name">${i+1}. ${t.name}</span></div>`).join('')}</div>`);
      }
      if (hasFoodRank) {
        bottomCards.push(`<div class="ranking-card orange-card"><div class="rc-title">🍽️ 美食排行</div>${statsData.topFoods.slice(0, 3).map((t: any, i: number) => `<div class="rc-item"><span class="rc-name">${i+1}. ${t.name}</span></div>`).join('')}</div>`);
      }
      
      // If no theater/food rankings, show expense pie chart instead
      if (!hasTheaterRank && !hasFoodRank) {
        const hasPie = chartImages.pie && statsData.totalSpend > 0;
        if (hasPie) {
          bottomCards.push(`<div class="ranking-card pie-card"><div class="rc-title">💰 支出类目占比</div><img src="${chartImages.pie}" style="width:100%;border-radius:8px;flex:1;object-fit:contain;" /></div>`);
        }
      }

      const hasRanks = rankTopHtml || bottomCards.length > 0;
      const ranksHtml = hasRanks ? `<div class="bp-ranks">${rankTopHtml}${bottomCards.length > 0 ? `<div class="bp-ranks-bottom">${bottomCards.join('')}</div>` : ''}</div>` : '';

      // Stub (right side) - minimal
      const bars = Array.from({ length: 30 }, () => Math.random() > 0.4 ? 3 : 1);
      const stubHtml = `
        <div class="stub-field"><div class="stub-label">登机牌</div><div class="stub-val" style="font-size:10px;">BOARDING PASS</div></div>
        <div class="stub-divider"></div>
        <div class="stub-field"><div class="stub-label">航班</div><div class="stub-val">ALIBI-LOG</div></div>
        <div class="stub-divider"></div>
        <div class="stub-field"><div class="stub-label">旅行次数</div><div class="stub-val" style="font-size:16px;color:#065f46;">${statsData.tripCount}</div></div>
        <div class="stub-field"><div class="stub-label">总天数</div><div class="stub-val" style="font-size:16px;color:#065f46;">${statsData.totalDays}</div></div>
        <div class="stub-field"><div class="stub-label">目的地</div><div class="stub-val" style="font-size:16px;color:#065f46;">${statsData.destCount}</div></div>
        <div class="stub-field"><div class="stub-label">总支出</div><div class="stub-val" style="font-size:16px;color:#065f46;">¥${statsData.totalSpend.toLocaleString()}</div></div>
        <div style="flex:1;"></div>
        <div class="bp-slogan">你的生活本就值得记录</div>
        <div class="stub-barcode">${bars.map(w => `<div style="width:${w}px;"></div>`).join('')}</div>
        <div class="stub-footer">ALIBI-LOG · ${today}</div>`;

      // Map box
      const mapBox = chartImages.map ? `<div class="bp-map-box"><div class="bp-map-label">${mapLabel}</div><div class="map-img-wrap"><img src="${chartImages.map}" /></div></div>` : '';

      // Left body content
      const leftContent = `
        <div class="bp-stats">
          <div class="bp-stat"><div class="label">旅行次数</div><div class="value">${statsData.tripCount}</div><div class="unit">TRIPS</div></div>
          <div class="bp-stat"><div class="label">总天数</div><div class="value">${statsData.totalDays}</div><div class="unit">DAYS</div></div>
          <div class="bp-stat"><div class="label">目的地</div><div class="value">${statsData.destCount}</div><div class="unit">DEST.</div></div>
          <div class="bp-stat accent"><div class="label">总支出</div><div class="value">¥${statsData.totalSpend.toLocaleString()}</div><div class="unit">CNY</div></div>
        </div>
        <div class="bp-content">
          ${mapBox}
          ${ranksHtml}
        </div>`;

      html += `
        <div class="bp-header-full">
          <div class="bp-hf-left">
            <div class="bp-hf-title">🌿 旅行总结</div>
            <div class="bp-hf-sub">TRAVEL SUMMARY · ${filterLabel}</div>
          </div>
          <div class="bp-hf-right">
            <div class="bp-hf-code">NO. ALIBI-LOG</div>
          </div>
        </div>
        <div class="bp-body">
          <div class="bp-main">${leftContent}</div>
          <div class="bp-tear-v"><div class="v-circle"></div><div class="v-dots"></div><div class="v-circle"></div></div>
          <div class="bp-stub">${stubHtml}</div>
        </div>`;

    } else if (mode === 'single' && tripData) {
      // ── SINGLE TRIP POSTER ──
      const destStr = tripData.destinations.join(' · ') || '未知';
      const lastDest = tripData.destinations[tripData.destinations.length - 1] || tripData.destinations[0] || '—';

      html += `
        <div class="trip-header">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div style="font-size:11px;opacity:0.6;letter-spacing:3px;">BOARDING PASS · 旅行记录</div>
              <h1 style="font-size:24px;font-weight:900;margin-top:6px;">${tripData.title}</h1>
            </div>
            <div style="text-align:right;">
              <div style="font-size:12px;opacity:0.7;letter-spacing:2px;">NO. ${flightCode}</div>
              <div style="font-size:10px;opacity:0.5;margin-top:2px;">${today}</div>
            </div>
          </div>
          <div class="trip-route">
            <span class="trip-city">家</span>
            <span class="trip-arrow">✈ →</span>
            <span class="trip-city">${lastDest}</span>
          </div>
          <div class="trip-meta">${tripData.startDate} ~ ${tripData.endDate} · ${tripData.days}天 · ${destStr}</div>
        </div>
        <div class="tear-line tear-line-green"><div class="circle"></div><div class="dots"></div><div class="circle"></div></div>
        <div class="stats-row">
          <div class="stat-card"><div class="label">持续天数</div><div class="value">${tripData.days}</div><div class="unit">DAYS</div></div>
          <div class="stat-card"><div class="label">目的地</div><div class="value">${tripData.destinations.length}</div><div class="unit">DEST.</div></div>
          <div class="stat-card"><div class="label">景点</div><div class="value">${tripData.attractionNames.length}</div><div class="unit">SPOTS</div></div>
          <div class="stat-card accent"><div class="label">总支出</div><div class="value">¥${tripData.totalSpend.toLocaleString()}</div><div class="unit">CNY</div></div>
        </div>`;

      // Pie + rankings
      const cards: string[] = [];
      if (chartImages.pie) cards.push(`<div class="ranking-card"><div class="rc-title">💰 支出占比</div><img src="${chartImages.pie}" style="width:100%;border-radius:8px;" /></div>`);
      if (isTheaterMode && tripData.theaterRecs.length > 0) {
        const items = tripData.theaterRecs.sort((a,b) => ((b.extra_data as any)?.score||0) - ((a.extra_data as any)?.score||0));
        cards.push(`<div class="ranking-card purple-card"><div class="rc-title">🎭 观演排行</div>${items.map((r,i) => `<div class="rc-item"><span class="rc-name">${i+1}. ${r.title}</span><span class="rc-count">${(r.extra_data as any)?.score ? '⭐'+((r.extra_data as any).score) : ''}</span></div>`).join('')}</div>`);
      }
      if (isFoodMode && tripData.foodRecs.length > 0) {
        const items = tripData.foodRecs.sort((a,b) => ((b.extra_data as any)?.rating||0) - ((a.extra_data as any)?.rating||0));
        cards.push(`<div class="ranking-card orange-card"><div class="rc-title">🍽️ 美食排行</div>${items.map((r,i) => { const fe = r.extra_data as any; return `<div class="rc-item"><span class="rc-name">${i+1}. ${fe?.restaurant||r.title}</span><span class="rc-count">${fe?.rating ? '⭐'+(fe.rating) : ''}</span></div>`; }).join('')}</div>`);
      }
      if (cards.length > 0) {
        const colClass = cards.length === 1 ? 'grid-template-columns:1fr' : cards.length === 2 ? 'grid-template-columns:1fr 1fr' : 'grid-template-columns:1fr 1fr 1fr';
        html += `<div class="section"><div style="display:grid;${colClass};gap:12px;">${cards.join('')}</div></div>`;
      }
      // Expense table
      if (tripData.expenseSums) {
        const expenseRows = EXPENSE_CATS.filter(c => (tripData.expenseSums![c.key] || 0) > 0)
          .map(c => `<tr><td>${c.emoji} ${c.label}</td><td class="amt">¥${(tripData.expenseSums![c.key] || 0).toLocaleString()}</td></tr>`).join('');
        if (expenseRows) {
          html += `<div class="section"><div class="section-title">💰 支出明细</div><div class="ranking-card" style="padding:0;overflow:hidden;"><table class="expense-table"><thead><tr><th>类别</th><th style="text-align:right;">金额</th></tr></thead><tbody>${expenseRows}<tr style="background:#f0fdf4;"><td style="font-weight:800;">合计</td><td class="amt" style="font-weight:900;font-size:14px;">¥${tripData.totalSpend.toLocaleString()}</td></tr></tbody></table></div></div>`;
        }
      }

      // Attractions
      if (tripData.attractionNames.length > 0) {
        html += `<div class="section"><div class="section-title">📍 景点足迹</div><div class="attractions-grid">${tripData.attractionNames.map(n => `<span class="att-chip">${n}</span>`).join('')}</div></div>`;
      }

      // Word cloud
      if (chartImages.wordCloud) {
        html += `<div class="section"><div class="section-title">☁️ 旅行词云</div><img src="${chartImages.wordCloud}" class="chart-img" /></div>`;
      }
    }

    // Footer barcode (single trip only — all-trips has barcode in stub)
    if (mode === 'single') {
      const bars = Array.from({ length: 40 }, () => Math.random() > 0.4 ? 3 : 1);
      html += `
        <div class="tear-line" style="margin-top:8px;"><div class="circle"></div><div class="dots"></div><div class="circle"></div></div>
        <div class="footer">
          <div class="barcode">${bars.map(w => `<div style="width:${w}px;"></div>`).join('')}</div>
          <div class="footer-text">ALIBI-LOG · 旅行记录 · ${today}</div>
        </div>`;
    }
    html += '</div>';

    // Create off-screen iframe for fully isolated rendering (prevents main page distortion)
    const iframe = document.createElement('iframe');
    iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${posterWidth}px;height:${posterWidth}px;border:none;visibility:hidden;`;
    document.body.appendChild(iframe);

    await new Promise(r => setTimeout(r, 100));
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      document.body.style.overflow = '';
      setPosterLoading(false);
      return;
    }
    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html><html><head><style>*{margin:0;padding:0;box-sizing:border-box;}</style></head><body>${html}</body></html>`);
    iframeDoc.close();

    await new Promise(r => setTimeout(r, 400));

    try {
      const el = iframeDoc.querySelector('.poster') as HTMLElement;
      if (!el) throw new Error('poster element not found');
      const canvas = await html2canvas(el, {
        useCORS: true, scale: 2, backgroundColor: '#FAFAF8', logging: false,
      });
      setPosterImage(canvas.toDataURL('image/png'));
    } catch (err) {
      console.error('Poster generation failed:', err);
      alert('海报生成失败，请重试');
    } finally {
      document.body.removeChild(iframe);
      document.body.style.overflow = '';
      setPosterLoading(false);
    }
  };

  // Travel records only
  const travelRecords = useMemo(() => records.filter(r => r.parent_tag === '旅行模式'), [records]);

  // Years from travel records
  const years = useMemo(() => {
    const s = new Set<string>();
    travelRecords.forEach(r => { const y = r.dateStr?.split('-')[0]; if (y) s.add(y); });
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [travelRecords]);

  // Load maps — china deferred, world on-demand
  const worldLoadedRef = useRef(false);
  useEffect(() => {
    // Defer china map loading so initial render isn't blocked
    const loadChina = () => {
      fetch('/maps/china.json').then(r => r.json()).then(data => {
        setChinaGeo(data);
        echarts.registerMap('china', data);
      }).catch(e => console.error('Failed to load china map:', e));
    };
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(loadChina);
    } else {
      setTimeout(loadChina, 200);
    }
  }, []);

  // Load world map only when user switches to world scope or selects world for poster
  useEffect(() => {
    if ((mapScope === 'world' || posterMapChoice === 'world') && !worldGeo && !worldLoadedRef.current) {
      worldLoadedRef.current = true;
      fetch('/maps/world.json').then(r => r.json()).then(data => {
        setWorldGeo(data);
        echarts.registerMap('world', data);
      }).catch(e => console.error('Failed to load world map:', e));
    }
  }, [mapScope, posterMapChoice, worldGeo]);

  // Filtered records (all-trips mode)
  const filteredRecords = useMemo(() => {
    return travelRecords.filter(r => {
      const [y, m] = r.dateStr?.split('-') || [];
      const mStr = parseInt(m, 10).toString();
      if (selectedYears.length > 0 && !selectedYears.includes(y)) return false;
      if (selectedMonths.length > 0 && !selectedMonths.includes(mStr)) return false;
      return true;
    });
  }, [travelRecords, selectedYears, selectedMonths]);

  // Resolve linked records
  const getLinkedRecords = (record: EventRecord): EventRecord[] => {
    const extra = record.extra_data as TravelMetadata | undefined;
    const ids = extra?.linkedRecordIds || [];
    if (ids.length === 0) return [];
    return allRecords.filter(r => r.type === 'special' && ids.includes(r.id)) as EventRecord[];
  };

  // All-trips stats
  const stats = useMemo(() => {
    let totalDays = 0;
    const allDests = new Set<string>();
    let totalSpend = 0;
    const expenseSums: Record<string, number> = {};
    EXPENSE_CATS.forEach(c => { expenseSums[c.key] = 0; });
    let linkedTheaterCount = 0;
    let linkedFoodCount = 0;
    const regionCounts: Record<string, number> = {};
    const theaterRanking: Record<string, { count: number; totalScore: number }> = {};
    const foodRanking: Record<string, { count: number; totalScore: number }> = {};

    filteredRecords.forEach(r => {
      const extra = r.extra_data as TravelMetadata | undefined;
      if (!extra) return;

      // Days
      if (extra.startDate && extra.endDate) {
        const s = new Date(extra.startDate);
        const e = new Date(extra.endDate);
        totalDays += Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1;
      }

      // Destinations
      (extra.destinations || []).forEach(d => allDests.add(d));

      // Spend
      if (extra.totalSpend) totalSpend += Number(extra.totalSpend);

      // Expense breakdown
      if (extra.expenses) {
        Object.entries(extra.expenses).forEach(([key, items]) => {
          if (Array.isArray(items)) {
            items.forEach((item: any) => {
              expenseSums[key] = (expenseSums[key] || 0) + (Number(item.amount) || 0);
            });
          }
        });
      }

      // Regions — resolve city names to province first
      (extra.destinations || []).forEach(dest => {
        let foundRegion = '';
        // 1. Try to find province via provinceData (city→province lookup)
        const foundProv = provinceData.find(p => p.cities.includes(dest) || p.name === dest || dest.includes(p.name));
        const provinceName = foundProv ? foundProv.name : dest;
        // 2. Match province to region
        for (const [region, provinces] of Object.entries(CHINA_REGIONS)) {
          if (provinces.some(p => provinceName.includes(p) || p.includes(provinceName))) {
            foundRegion = region; break;
          }
        }
        if (!foundRegion) foundRegion = WORLD_REGIONS[dest] || '其他';
        regionCounts[foundRegion] = (regionCounts[foundRegion] || 0) + 1;
      });

      // Linked records
      const linked = getLinkedRecords(r);
      linked.forEach(lr => {
        if (lr.parent_tag === '演出模式') {
          linkedTheaterCount++;
          const tExtra = lr.extra_data as TheaterMetadata | undefined;
          const title = lr.title || '';
          const score = tExtra?.score || 0;
          if (title) {
            if (!theaterRanking[title]) theaterRanking[title] = { count: 0, totalScore: 0 };
            theaterRanking[title].count += 1;
            theaterRanking[title].totalScore += score;
          }
        }
        if (lr.parent_tag === '美食模式') {
          linkedFoodCount++;
          const foodExtra = lr.extra_data as FoodMetadata | undefined;
          const restaurant = foodExtra?.restaurant || lr.title || '';
          const rating = foodExtra?.rating || 0;
          if (restaurant) {
            if (!foodRanking[restaurant]) foodRanking[restaurant] = { count: 0, totalScore: 0 };
            foodRanking[restaurant].count += 1;
            foodRanking[restaurant].totalScore += rating;
          }
        }
      });
    });

    const favoriteRegion = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0];
    // Weighted ranking: count * avgScore
    const topTheaters = Object.entries(theaterRanking)
      .map(([name, d]) => ({ name, count: d.count, weight: d.count * (d.totalScore / (d.count || 1)) }))
      .sort((a, b) => b.weight - a.weight).slice(0, 3);
    const topFoods = Object.entries(foodRanking)
      .map(([name, d]) => ({ name, count: d.count, weight: d.count * (d.totalScore / (d.count || 1)) }))
      .sort((a, b) => b.weight - a.weight).slice(0, 3);

    return {
      tripCount: filteredRecords.length,
      totalDays,
      destCount: allDests.size,
      totalSpend,
      expenseSums,
      linkedTheaterCount,
      linkedFoodCount,
      favoriteRegion: favoriteRegion ? { name: favoriteRegion[0], count: favoriteRegion[1] } : null,
      topTheaters,
      topFoods,
      regionCounts,
    };
  }, [filteredRecords, allRecords]);
  // China map option
  const chinaMapOption = useMemo(() => {
    const provinceStats: Record<string, number> = {};
    const geoNames = chinaGeo?.features?.map((f: any) => f.properties.name) || [];

    filteredRecords.forEach(r => {
      const extra = r.extra_data as TravelMetadata | undefined;
      (extra?.destinations || []).forEach(dest => {
        // Try to match dest to a province
        const foundProv = provinceData.find(p => p.cities.includes(dest) || p.name === dest || dest.includes(p.name));
        const provName = foundProv ? ensureFullName(foundProv.name) : ensureFullName(dest);
        if (geoNames.includes(provName)) {
          provinceStats[provName] = (provinceStats[provName] || 0) + 1;
        } else {
          const matched = geoNames.find((gn: string) =>
            gn.includes(dest) || dest.includes(gn.replace(/(省|市|自治区|特别行政区)/g, ''))
          );
          if (matched) provinceStats[matched] = (provinceStats[matched] || 0) + 1;
        }
      });
    });

    const data = Object.entries(provinceStats).map(([name, value]) => ({ name, value }));
    const max = Math.max(...data.map(d => d.value), 5);

    return {
      tooltip: { trigger: 'item' as const, formatter: (p: any) => `${p.name}: ${p.value || 0} 次` },
      visualMap: { min: 0, max, show: false, inRange: { color: ['#d1fae5', '#10b981', '#065f46'] } },
      series: [{
        name: '旅行足迹', type: 'map' as const, map: 'china', roam: false,
        label: { show: false },
        emphasis: { label: { show: true, color: '#059669' }, itemStyle: { areaColor: '#d1fae5' } },
        data,
        itemStyle: { borderColor: 'rgba(16,185,129,0.2)', areaColor: 'rgba(209,213,219,0.3)' }
      }],
      layoutCenter: ['50%', '53%'], layoutSize: '83%'
    };
  }, [filteredRecords, chinaGeo]);

  // World map option
  const worldMapOption = useMemo(() => {
    const countryStats: Record<string, number> = {};

    filteredRecords.forEach(r => {
      const extra = r.extra_data as TravelMetadata | undefined;
      (extra?.destinations || []).forEach(dest => {
        // For world map, use destination name directly
        if (WORLD_REGIONS[dest]) {
          countryStats[dest] = (countryStats[dest] || 0) + 1;
        }
      });
    });

    // Also mark China
    const chinaTrips = filteredRecords.filter(r => {
      const extra = r.extra_data as TravelMetadata | undefined;
      return (extra?.destinations || []).some(d => !WORLD_REGIONS[d]);
    }).length;
    if (chinaTrips > 0) countryStats['中国'] = chinaTrips;

    const data = Object.entries(countryStats).map(([name, value]) => ({ name, value }));
    const max = Math.max(...data.map(d => d.value), 5);

    return {
      tooltip: { trigger: 'item' as const, formatter: (p: any) => `${p.name}: ${p.value || 0} 次` },
      visualMap: { min: 0, max, show: false, inRange: { color: ['#d1fae5', '#10b981', '#065f46'] } },
      series: [{
        name: '全球足迹', type: 'map' as const, map: 'world', roam: true,
        label: { show: false },
        emphasis: { label: { show: true, color: '#059669', fontSize: 10 }, itemStyle: { areaColor: '#d1fae5' } },
        data,
        itemStyle: { borderColor: 'rgba(16,185,129,0.15)', areaColor: 'rgba(209,213,219,0.25)' }
      }],
    };
  }, [filteredRecords, worldGeo]);

  // Expense pie
  const expensePieOption = useMemo(() => {
    const data = EXPENSE_CATS.map(c => ({ name: c.label, value: stats.expenseSums[c.key] || 0 })).filter(d => d.value > 0);
    return {
      tooltip: { trigger: 'item' as const },
      legend: { bottom: '0%', left: 'center', textStyle: { color: 'inherit', fontSize: 11 }, itemGap: 10, itemWidth: 10, itemHeight: 10 },
      series: [{
        name: '支出占比', type: 'pie' as const, radius: ['35%', '60%'], center: ['50%', '42%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' as const } },
        labelLine: { show: false },
        data,
        color: EXPENSE_CATS.map(c => c.color),
      }]
    };
  }, [stats]);
  // Single trip data
  const singleTripOptions = useMemo(() => {
    if (!singleYear && !singleMonth) return [];
    return travelRecords.filter(r => {
      const [y, m] = r.dateStr?.split('-') || [];
      if (singleYear && y !== singleYear) return false;
      if (singleMonth && parseInt(m, 10).toString() !== singleMonth) return false;
      return true;
    });
  }, [travelRecords, singleYear, singleMonth]);

  const selectedTrip = useMemo(() => {
    if (!selectedTripId) return null;
    return travelRecords.find(r => r.id === selectedTripId) || null;
  }, [selectedTripId, travelRecords]);

  return (
    <div className="min-h-screen bg-[var(--bg-color)] text-[var(--text-color)] transition-colors duration-300 p-4 sm:p-10 pb-20">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all border border-gray-100 dark:border-gray-700 shadow-sm text-slate-700 dark:text-white">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-[var(--text-color)]">
                <Palmtree className="text-emerald-500" /> 旅行总结
              </h1>
              <p className="text-xs text-slate-400 font-medium tracking-widest uppercase">Travel Analytics</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 w-2/3 sm:w-auto">
            {/* Mode Tabs */}
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 sm:p-1 shrink-0">
              <button onClick={() => setSummaryMode('all')} className={`h-7 sm:h-auto px-2.5 sm:px-4 sm:py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${summaryMode === 'all' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                全部
              </button>
              <button onClick={() => setSummaryMode('single')} className={`h-7 sm:h-auto px-2.5 sm:px-4 sm:py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${summaryMode === 'single' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                单次
              </button>
            </div>
            {summaryMode === 'all' && (
              <button onClick={() => setShowFilterPanel(!showFilterPanel)} className={`h-8 sm:h-auto flex-1 sm:flex-none flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all shadow-sm hover:shadow-md whitespace-nowrap ${showFilterPanel ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-gray-800 text-emerald-600'}`}>
                <Filter size={14} className="sm:w-[18px] sm:h-[18px] shrink-0" /> 筛选
              </button>
            )}
            {summaryMode === 'all' && filteredRecords.length > 0 && (
              <button onClick={() => setShowPosterDialog(true)} className="h-8 sm:h-auto flex-1 sm:flex-none flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all shadow-sm hover:shadow-md bg-white dark:bg-gray-800 text-emerald-600 hover:bg-emerald-50 whitespace-nowrap">
                <Image size={14} className="sm:w-[18px] sm:h-[18px] shrink-0" /> 生成海报
              </button>
            )}
          </div>
        </div>

        {/* ALL TRIPS MODE */}
        {summaryMode === 'all' && (
          <>
            {/* Filter Panel */}
            {showFilterPanel && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm space-y-8 animate-in fade-in zoom-in duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-sm font-black text-gray-800 dark:text-gray-200 uppercase tracking-widest flex items-center gap-2">
                      <Calendar size={14} className="text-emerald-500" /> 年份
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {years.map(y => (
                        <button key={y} onClick={() => setSelectedYears(prev => prev.includes(y) ? prev.filter(i => i !== y) : [...prev, y])}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-2 ${selectedYears.includes(y) ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 'border-gray-100 dark:border-gray-600 text-gray-400 opacity-60'}`}
                        >{y}年</button>
                      ))}
                      {years.length > 0 && (
                        <button onClick={() => setSelectedYears([])} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedYears.length === 0 ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 opacity-60'}`}>全选</button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-sm font-black text-gray-800 dark:text-gray-200 uppercase tracking-widest flex items-center gap-2">
                      <TrendingUp size={14} className="text-blue-500" /> 月份
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setSelectedMonths([])} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedMonths.length === 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 opacity-60'}`}>全部月份</button>
                      {Array.from({ length: 12 }, (_, i) => (i + 1).toString()).map(m => (
                        <button key={m} onClick={() => setSelectedMonths(prev => prev.includes(m) ? prev.filter(i => i !== m) : [...prev, m])}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border-2 ${selectedMonths.includes(m) ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'border-gray-100 dark:border-gray-600 text-gray-400 opacity-60'}`}
                        >{m}月</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg"><Palmtree size={18} className="text-emerald-600" /></div>
                  <span className="text-sm font-black text-slate-500 uppercase tracking-tighter">旅行次数</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">{stats.tripCount}</span>
                  <span className="text-xs font-bold text-gray-400 uppercase">次</span>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><Calendar size={18} className="text-blue-600" /></div>
                  <span className="text-sm font-black text-slate-500 uppercase tracking-tighter">总天数</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">{stats.totalDays}</span>
                  <span className="text-xs font-bold text-gray-400 uppercase">天</span>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg"><MapPin size={18} className="text-purple-600" /></div>
                  <span className="text-sm font-black text-slate-500 uppercase tracking-tighter">目的地</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">{stats.destCount}</span>
                  <span className="text-xs font-bold text-gray-400 uppercase">个</span>
                </div>
              </div>
              <div className="bg-emerald-600 p-5 rounded-xl shadow-xl shadow-emerald-500/20 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/20 rounded-lg"><Ticket size={18} className="text-white" /></div>
                  <span className="text-sm font-black text-emerald-100 uppercase tracking-tighter">总支出</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xs font-black">￥</span>
                  <span className="text-3xl font-black tracking-tighter">{stats.totalSpend.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Charts Section - adaptive layout */}
            {(() => {
              // Collect sidebar cards into array
              const sideCards: React.ReactNode[] = [];
              if (stats.totalSpend > 0) {
                sideCards.push(
                  <div key="expense" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                    <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 mb-2">
                      <Ticket size={18} className="text-emerald-600" /> 支出类目占比
                    </h3>
                    <ReactECharts ref={expensePieRef} option={expensePieOption} style={{ height: '220px' }} />
                  </div>
                );
              }
              if (stats.favoriteRegion) {
                sideCards.push(
                  <div key="region" className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
                    <div className="text-sm font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <MapPin size={16} className="text-emerald-600" /> 最爱地区
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-black text-slate-800 dark:text-white">{stats.favoriteRegion.name}</span>
                      <span className="text-sm font-bold text-slate-500"><span className="text-slate-900 dark:text-white text-lg mr-1 font-black">{stats.favoriteRegion.count}</span>次</span>
                    </div>
                  </div>
                );
              }
              if (isTheaterMode && stats.linkedTheaterCount > 0) {
                sideCards.push(
                  <div key="theater" className="bg-purple-50 dark:bg-purple-900/20 p-5 rounded-2xl border border-purple-100 dark:border-purple-800/30">
                    <div className="text-sm font-black text-purple-700 dark:text-purple-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Theater size={16} className="text-purple-600" /> 关联观演记录
                    </div>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-2xl font-black text-slate-800 dark:text-white">{stats.linkedTheaterCount}</span>
                      <span className="text-sm font-bold text-gray-400">条</span>
                    </div>
                    {stats.topTheaters.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-xs font-black text-purple-600 dark:text-purple-400">🎭 最爱演出</div>
                        {stats.topTheaters.map((item, i) => (
                          <div key={item.name} className="flex items-center text-sm">
                            <span className="font-bold text-slate-700 dark:text-gray-200 truncate">{i + 1}. {item.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              if (isFoodMode && stats.linkedFoodCount > 0) {
                sideCards.push(
                  <div key="food" className="bg-orange-50 dark:bg-orange-900/20 p-5 rounded-2xl border border-orange-100 dark:border-orange-800/30">
                    <div className="text-sm font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Utensils size={16} className="text-orange-600" /> 关联美食记录
                    </div>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-2xl font-black text-slate-800 dark:text-white">{stats.linkedFoodCount}</span>
                      <span className="text-sm font-bold text-gray-400">条</span>
                    </div>
                    {stats.topFoods.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-xs font-black text-orange-600 dark:text-orange-400">🍽️ 最爱美食</div>
                        {stats.topFoods.map((item, i) => (
                          <div key={item.name} className="flex items-center text-sm">
                            <span className="font-bold text-slate-700 dark:text-gray-200 truncate">{i + 1}. {item.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              const hasSide = sideCards.length > 0;
              return (
                <div className={`grid gap-6 ${hasSide ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
                  <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm min-h-[420px] relative overflow-hidden flex flex-col ${hasSide ? 'lg:col-span-2' : ''}`}>
                    <div className="flex items-center justify-between p-4">
                      <h3 className="text-xl font-black flex items-center gap-2 text-slate-800 dark:text-white">
                        <MapPin size={22} className="text-emerald-600" /> 旅行足迹
                      </h3>
                      <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                        <button onClick={() => setMapScope('china')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${mapScope === 'china' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500'}`}>
                          <Map size={12} /> 中国
                        </button>
                        <button onClick={() => setMapScope('world')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${mapScope === 'world' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500'}`}>
                          <Globe size={12} /> 世界
                        </button>
                      </div>
                    </div>
                    <div className="w-full flex-1 min-h-[360px]">
                      {mapScope === 'china' && chinaGeo ? (
                        <ReactECharts ref={chinaMapRef} option={chinaMapOption} style={{ height: '100%', width: '100%' }} echarts={echarts} notMerge={true} />
                      ) : mapScope === 'world' && worldGeo ? (
                        <ReactECharts ref={worldMapRef} option={worldMapOption} style={{ height: '100%', width: '100%' }} echarts={echarts} notMerge={true} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 animate-pulse">地图加载中...</div>
                      )}
                    </div>
                  </div>
                  {hasSide && <div className="space-y-6">{sideCards}</div>}
                </div>
              );
            })()}
          </>
        )}

        {/* SINGLE TRIP MODE */}
        {summaryMode === 'single' && (
          <div className="space-y-6">
            {/* Year/Month selector */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-gray-800 dark:text-gray-200 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={14} className="text-emerald-500" /> 年份
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {years.map(y => (
                      <button key={y} onClick={() => { setSingleYear(singleYear === y ? '' : y); setSelectedTripId(null); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-2 ${singleYear === y ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 'border-gray-100 dark:border-gray-600 text-gray-400 opacity-60'}`}
                      >{y}年</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-gray-800 dark:text-gray-200 uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp size={14} className="text-blue-500" /> 月份
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => { setSingleMonth(''); setSelectedTripId(null); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!singleMonth ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 opacity-60'}`}>全部月份</button>
                    {Array.from({ length: 12 }, (_, i) => (i + 1).toString()).map(m => (
                      <button key={m} onClick={() => { setSingleMonth(singleMonth === m ? '' : m); setSelectedTripId(null); }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border-2 ${singleMonth === m ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'border-gray-100 dark:border-gray-600 text-gray-400 opacity-60'}`}
                      >{m}月</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Trip selection */}
              {singleTripOptions.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-gray-800 dark:text-gray-200 uppercase tracking-widest flex items-center gap-2">
                    <Palmtree size={14} className="text-emerald-500" /> 选择旅行 ({singleTripOptions.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {singleTripOptions.map(r => {
                      const ex = r.extra_data as TravelMetadata | undefined;
                      return (
                        <button key={r.id} onClick={() => setSelectedTripId(selectedTripId === r.id ? null : r.id)}
                          className={`p-3 rounded-xl text-left transition-all border-2 ${selectedTripId === r.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-md' : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'}`}>
                          <div className="text-sm font-black text-slate-800 dark:text-white truncate">{r.title}</div>
                          <div className="text-[10px] text-gray-400 mt-1">{ex?.startDate} ~ {ex?.endDate}</div>
                          {(ex?.destinations || []).length > 0 && (
                            <div className="text-[10px] text-emerald-500 mt-0.5 truncate">📍 {(ex?.destinations || []).join('、')}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Selected trip details */}
            {selectedTrip && (() => {
              const extra = selectedTrip.extra_data as TravelMetadata | undefined;
              if (!extra) return null;
              const days = extra.startDate && extra.endDate ? Math.ceil((new Date(extra.endDate).getTime() - new Date(extra.startDate).getTime()) / 86400000) + 1 : 0;
              const linkedRecs = getLinkedRecords(selectedTrip);
              const theaterRecs = linkedRecs.filter(r => r.parent_tag === '演出模式');
              const foodRecs = linkedRecs.filter(r => r.parent_tag === '美食模式');

              let singleTotalSpend = extra.totalSpend || 0;
              const singleExpenseSums: Record<string, number> = {};
              EXPENSE_CATS.forEach(c => { singleExpenseSums[c.key] = 0; });
              if (extra.expenses) {
                Object.entries(extra.expenses).forEach(([key, items]) => {
                  if (Array.isArray(items)) {
                    items.forEach((item: any) => { singleExpenseSums[key] = (singleExpenseSums[key] || 0) + (Number(item.amount) || 0); });
                  }
                });
              }

              const singlePieData = EXPENSE_CATS.map(c => ({ name: c.label, value: singleExpenseSums[c.key] || 0 })).filter(d => d.value > 0);
              const singlePieOption = {
                tooltip: { trigger: 'item' as const },
                legend: { bottom: '0%', left: 'center', textStyle: { color: 'inherit', fontSize: 11 }, itemGap: 10, itemWidth: 10, itemHeight: 10 },
                series: [{
                  type: 'pie' as const, radius: ['35%', '60%'], center: ['50%', '42%'],
                  itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
                  label: { show: false }, emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold' as const } },
                  data: singlePieData, color: EXPENSE_CATS.map(c => c.color),
                }]
              };

              return (
                <div className="space-y-6">
                  {/* Trip info cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                      <div className="text-xs font-black text-gray-400 uppercase mb-1">旅行主题</div>
                      <div className="text-lg font-black text-slate-900 dark:text-white truncate">{selectedTrip.title}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                      <div className="text-xs font-black text-gray-400 uppercase mb-1">持续时间</div>
                      <div className="text-lg font-black text-slate-900 dark:text-white">{days} <span className="text-sm text-gray-400">天</span></div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{extra.startDate} ~ {extra.endDate}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                      <div className="text-xs font-black text-gray-400 uppercase mb-1">目的地</div>
                      <div className="text-sm font-bold text-slate-700 dark:text-gray-200">{(extra.destinations || []).join('、') || '-'}</div>
                    </div>
                    <div className="bg-emerald-600 p-4 rounded-xl shadow-lg text-white">
                      <div className="text-xs font-black text-emerald-100 uppercase mb-1">总支出</div>
                      <div className="text-lg font-black">￥{singleTotalSpend.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Expense pie + Rankings - adaptive */}
                  {(() => {
                    const cards: React.ReactNode[] = [];
                    if (isTheaterMode && theaterRecs.length > 0) {
                      cards.push(
                        <div key="theater" className="bg-purple-50 dark:bg-purple-900/20 p-5 rounded-2xl border border-purple-100 dark:border-purple-800/30">
                          <div className="text-sm font-black text-purple-700 dark:text-purple-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Theater size={16} className="text-purple-600" /> 观演排行榜
                          </div>
                          <div className="space-y-2">
                            {[...theaterRecs].sort((a, b) => ((b.extra_data as TheaterMetadata)?.score || 0) - ((a.extra_data as TheaterMetadata)?.score || 0)).map((r, i) => (
                              <div key={r.id} className="flex items-center justify-between text-sm">
                                <span className="font-bold text-slate-700 dark:text-gray-200 truncate pr-2">{i + 1}. {r.title}</span>
                                {(r.extra_data as TheaterMetadata)?.score && (() => { const s = (r.extra_data as TheaterMetadata).score!; return <span className="text-xs shrink-0 whitespace-nowrap">{Array.from({length:5},(_,i) => <span key={i} style={{color: i < Math.round(s) ? '#8b5cf6' : '#e5e7eb', fontSize: '13px', lineHeight: 1}}>★</span>)} <span className="font-bold text-purple-500">{s}</span></span>; })()}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    if (isFoodMode && foodRecs.length > 0) {
                      cards.push(
                        <div key="food" className="bg-orange-50 dark:bg-orange-900/20 p-5 rounded-2xl border border-orange-100 dark:border-orange-800/30">
                          <div className="text-sm font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Utensils size={16} className="text-orange-600" /> 美食排行榜
                          </div>
                          <div className="space-y-2">
                            {[...foodRecs].sort((a, b) => ((b.extra_data as FoodMetadata)?.rating || 0) - ((a.extra_data as FoodMetadata)?.rating || 0)).map((r, i) => {
                              const fe = r.extra_data as FoodMetadata | undefined;
                              return (
                                <div key={r.id} className="flex items-center justify-between text-sm">
                                  <span className="font-bold text-slate-700 dark:text-gray-200 truncate pr-2">{i + 1}. {fe?.restaurant || r.title}</span>
                                  {fe?.rating && (() => { const s = fe.rating!; return <span className="text-xs shrink-0 whitespace-nowrap">{Array.from({length:5},(_,i) => <span key={i} style={{color: i < Math.round(s) ? '#f59e0b' : '#e5e7eb', fontSize: '13px', lineHeight: 1}}>★</span>)} <span className="font-bold text-orange-500">{s}</span></span>; })()}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    if (extra.attractions && extra.attractions.length > 0) {
                      cards.push(
                        <div key="attractions" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
                          <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                            <Palmtree size={18} className="text-emerald-600" /> 景点列表 ({extra.attractions.length})
                          </h3>
                          <div className="space-y-2">
                            {extra.attractions.map((att, i) => (
                              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg">
                                <MapPin size={14} className="text-emerald-500 shrink-0" />
                                <div>
                                  <div className="text-sm font-bold text-slate-700 dark:text-gray-200">{att.name}</div>
                                  {att.address && <div className="text-[10px] text-gray-400">{att.address}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    if (singlePieData.length > 0) {
                      cards.push(
                        <div key="pie" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                          <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 mb-2">
                            <Ticket size={18} className="text-emerald-600" /> 支出占比
                          </h3>
                          <ReactECharts ref={singlePieRef} option={singlePieOption} style={{ height: '220px' }} />
                        </div>
                      );
                    }
                    if (cards.length === 0) return null;
                    const colClass = cards.length === 1 ? 'grid-cols-1' : cards.length === 2 ? 'grid-cols-1 lg:grid-cols-2' : cards.length === 3 ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
                    return <div className={`grid ${colClass} gap-6`}>{cards}</div>;
                  })()}

                  {/* AMap + Word Cloud - adaptive row */}
                  {(() => {
                    const rowItems: React.ReactNode[] = [];

                    // AMap section
                    (() => {
                      type MarkerPoint = { name: string; lat: number; lng: number; type: string; detail?: string };
                      const markerObj: Record<string, MarkerPoint> = {};
                      (extra.attractions || []).forEach(att => {
                        if (att.lat && att.lng && att.name) {
                          markerObj[att.name] = { name: att.name, lat: att.lat, lng: att.lng, type: '景点', detail: att.address || '' };
                        }
                      });
                      linkedRecs.forEach(lr => {
                        // Skip theater/food markers if respective mode is disabled
                        if (lr.parent_tag === '演出模式' && !isTheaterMode) return;
                        if (lr.parent_tag === '美食模式' && !isFoodMode) return;
                        const ed = lr.extra_data as any;
                        if (ed?.lat && ed?.lng) {
                          const n = ed.poiName || ed.restaurant || ed.theater || lr.title || '';
                          const t = lr.parent_tag === '美食模式' ? '美食' : lr.parent_tag === '演出模式' ? '剧场' : '地点';
                          if (n && !markerObj[n]) markerObj[n] = { name: n, lat: ed.lat, lng: ed.lng, type: t, detail: ed.address || '' };
                        }
                        const loc = ed?.location_data as NormalLocationData | undefined;
                        if (loc?.lat && loc?.lng && loc?.name && !markerObj[loc.name]) {
                          markerObj[loc.name] = { name: loc.name, lat: loc.lat, lng: loc.lng, type: '地点' };
                        }
                      });
                      const markers = Object.values(markerObj);
                      if (markers.length === 0) return;

                      const colorMap: Record<string, { bg: string; border: string; emoji: string }> = {
                        '景点': { bg: 'linear-gradient(135deg,#10b981,#059669)', border: '#059669', emoji: '📍' },
                        '美食': { bg: 'linear-gradient(135deg,#f59e0b,#ea580c)', border: '#ea580c', emoji: '🍜' },
                        '剧场': { bg: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', border: '#7c3aed', emoji: '🎭' },
                        '地点': { bg: 'linear-gradient(135deg,#3b82f6,#2563eb)', border: '#2563eb', emoji: '📌' },
                      };

                      rowItems.push(
                        <div key="amap" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                          <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 mb-3">
                            <MapPin size={18} className="text-emerald-600" /> 地点标注 ({markers.length})
                          </h3>
                          <div className="flex flex-wrap gap-3 mb-3">
                            {Object.entries(colorMap).map(([type, style]) => {
                              const c = markers.filter((m: MarkerPoint) => m.type === type).length;
                              if (c === 0) return null;
                              return <span key={type} className="flex items-center gap-1 text-xs font-bold text-gray-500">{style.emoji} {type} {c}</span>;
                            })}
                          </div>
                          <TravelAMapSection markers={markers} colorMap={colorMap} />
                        </div>
                      );
                    })();

                    // Word Cloud section
                    (() => {
                      const freq: Record<string, number> = {};
                      const addToken = (s: string) => {
                        const t = s.trim();
                        if (t && t.length >= 2) freq[t] = (freq[t] || 0) + 1;
                      };
                      if (selectedTrip.title) addToken(selectedTrip.title);
                      (extra.destinations || []).forEach(d => addToken(d));
                      (extra.attractions || []).forEach(a => { addToken(a.name); if (a.address) addToken(a.address); });
                      linkedRecs.forEach(lr => {
                        if (lr.title) addToken(lr.title);
                        const ed = lr.extra_data as any;
                        if (ed?.restaurant) addToken(ed.restaurant);
                        if (ed?.theater) addToken(ed.theater);
                        if (ed?.actors) ed.actors.split(/[,，、；;.。\s\t\/|｜]+/).forEach((a: string) => addToken(a));
                        (ed?.dishes || []).forEach((d: any) => { if (d?.name) addToken(d.name); });
                        (lr.tagIds || []).forEach((tid: string) => {
                          const tag = tags.find(t => t.id === tid);
                          const parentNames = new Set(['演出模式','美食模式','旅行模式','普通模式']);
                          if (tag?.name && !parentNames.has(tag.name)) addToken(tag.name);
                        });
                      });
                      const longTexts: string[] = [];
                      if (selectedTrip.reflection) longTexts.push(selectedTrip.reflection);
                      if (extra.thought) longTexts.push(extra.thought);
                      linkedRecs.forEach(lr => {
                        if (lr.reflection) longTexts.push(lr.reflection);
                        const ed = lr.extra_data as any;
                        if (ed?.comment) longTexts.push(ed.comment);
                        if (ed?.thought) longTexts.push(ed.thought);
                      });
                      const stopWords = new Set(['的','了','是','在','有','和','我','也','不','就','都','他','她','这','那','中','会','对','与','为','上','到','说','要','等','你','它','把','从','被','让','给','其','已','而','又','但','还','自','去','来','能','可','很','没','些','什么','怎么','如果','因为','一个','可以','没有','这个','那个','还是','然后','所以','比较','真的','觉得','非常','特别','一下','之后','之前','时候','喜欢','不错','挺好','好的']);
                      longTexts.forEach(text => {
                        text.split(/[。！？，、；：\n\r,.!?;:\s]+/).forEach(phrase => {
                          const p = phrase.trim();
                          if (p.length >= 2 && p.length <= 8 && !stopWords.has(p)) addToken(p);
                        });
                      });
                      const wordData = Object.entries(freq)
                        .filter(([w, c]) => c >= 1 && w.length >= 2)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 60)
                        .map(([word, count]) => ({ name: word, value: count }));
                      if (wordData.length < 3) return;

                      const wcOption = {
                        tooltip: { show: true },
                        series: [{
                          type: 'wordCloud' as any,
                          shape: 'circle',
                          sizeRange: [14, 48],
                          rotationRange: [-30, 30],
                          rotationStep: 15,
                          gridSize: 8,
                          drawOutOfBound: false,
                          textStyle: {
                            fontFamily: 'system-ui, sans-serif',
                            fontWeight: 'bold',
                            color: () => {
                              const colors = ['#10b981','#059669','#34d399','#6ee7b7','#065f46','#047857','#0d9488','#14b8a6','#2dd4bf','#f59e0b','#8b5cf6','#3b82f6'];
                              return colors[Math.floor(Math.random() * colors.length)];
                            }
                          },
                          data: wordData,
                        }]
                      };

                      rowItems.push(
                        <div key="wordcloud" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex flex-col">
                          <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 mb-2 flex-shrink-0">
                            ☁️ 旅行词云
                          </h3>
                          <div className="flex-1 flex items-center justify-center min-h-0">
                            <ReactECharts ref={wordCloudRef} option={wcOption} style={{ height: '300px', width: '100%' }} />
                          </div>
                        </div>
                      );
                    })();

                    if (rowItems.length === 0) return null;
                    const gridCols = rowItems.length === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2';
                    return <div className={`grid ${gridCols} gap-6`}>{rowItems}</div>;
                  })()}
                </div>
              );
            })()}

            {!selectedTripId && (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl flex items-center justify-center">
                  <Palmtree size={40} className="text-emerald-500" />
                </div>
                <p className="text-sm text-gray-400 font-medium">请选择年月和旅行记录查看详情</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pb-6 text-center">
          <p className="text-[12px] text-[#bbb] dark:text-[#555] leading-relaxed">
            本站为非营利性技术实验项目。用户数据存储于受保护的私有数据库。
          </p>
        </div>
      </div>

      {/* ── Map Choice Dialog for All-Trips Poster ── */}
      {showPosterDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPosterDialog(false)}>
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Image size={20} className="text-emerald-500" /> 生成旅行海报
              </h3>
              <button onClick={() => setShowPosterDialog(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-gray-500 font-medium">选择海报中的地图版本：</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setPosterMapChoice('china')}
                  className={`p-4 rounded-xl border-2 transition-all text-center ${posterMapChoice === 'china' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="text-2xl mb-1">🏮</div>
                  <div className="text-sm font-black text-slate-700">中国地图</div>
                </button>
                <button onClick={() => setPosterMapChoice('world')}
                  className={`p-4 rounded-xl border-2 transition-all text-center ${posterMapChoice === 'world' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="text-2xl mb-1" style={{ colorScheme: 'light' }}>🌍</div>
                  <div className="text-sm font-black text-slate-700">世界地图</div>
                </button>
              </div>
            </div>
            <button onClick={() => { setShowPosterDialog(false); handleGeneratePoster('all', stats); }}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
              <Download size={18} /> 开始生成
            </button>
          </div>
        </div>
      )}

      {/* ── Loading Overlay ── */}
      {posterLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-bold text-gray-600">正在生成登机牌海报...</p>
          </div>
        </div>
      )}

      {/* ── Poster Preview Modal ── */}
      {posterImage && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center p-4 sm:p-10 animate-in fade-in duration-300">
          <button 
            onClick={() => setPosterImage(null)}
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all active:scale-90"
          >
            <X size={28} />
          </button>
          
          <div className="bg-white p-2 rounded-2xl shadow-2xl max-w-full max-h-[80vh] overflow-y-auto mb-6 scrollbar-hide">
            <img 
              src={posterImage} 
              alt="旅行海报" 
              className="w-full h-auto block rounded-xl"
            />
          </div>
          
          <div className="text-white text-center space-y-3">
            <p className="text-2xl font-black flex items-center justify-center gap-3">
              <Download size={24} className="text-emerald-400" />
              旅行海报已生成
            </p>
            <p className="text-base text-gray-300 font-bold">长按上方图片保存到相册，分享你的旅行足迹</p>
          </div>
        </div>
      )}
    </div>
  );
};