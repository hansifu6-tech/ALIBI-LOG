import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Pencil, Trash2, ChevronDown, ChevronRight, ChevronUp, CheckSquare, Square, Theater, Utensils, Palmtree, FileText, Settings2 } from 'lucide-react';
import type { CalendarRecord, EventRecord, TheaterMetadata, FoodMetadata, TravelMetadata } from '../types';

interface TableViewProps {
  records: CalendarRecord[];
  isTheaterMode: boolean;
  isFoodMode: boolean;
  isTravelMode: boolean;
  onEditRecord: (record: CalendarRecord, dateStr: string) => void;
  onDeleteRecord: (id: string, type: 'daily' | 'special', content?: string) => void;
}

const PAGE_SIZE = 20;

interface SectionConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
  bgHeader: string;
  bgRow: string;
  borderColor: string;
  textColor: string;
  accent: string;          // for mobile card accents
  accentBorder: string;   // mobile card left border
}

const SECTIONS: SectionConfig[] = [
  {
    key: 'normal', label: '普通记录', icon: <FileText size={16} />,
    bgHeader: 'bg-gray-100 dark:bg-gray-800', bgRow: 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
    borderColor: 'border-gray-200 dark:border-gray-700', textColor: 'text-gray-700 dark:text-gray-300',
    accent: 'bg-gray-50 dark:bg-gray-800/60', accentBorder: 'border-l-gray-400',
  },
  {
    key: 'theater', label: '观演记录', icon: <Theater size={16} />,
    bgHeader: 'bg-purple-50 dark:bg-purple-900/30', bgRow: 'hover:bg-purple-50/50 dark:hover:bg-purple-900/10',
    borderColor: 'border-purple-200 dark:border-purple-800', textColor: 'text-purple-700 dark:text-purple-400',
    accent: 'bg-purple-50 dark:bg-purple-900/20', accentBorder: 'border-l-purple-400',
  },
  {
    key: 'food', label: '美食记录', icon: <Utensils size={16} />,
    bgHeader: 'bg-orange-50 dark:bg-orange-900/30', bgRow: 'hover:bg-orange-50/50 dark:hover:bg-orange-900/10',
    borderColor: 'border-orange-200 dark:border-orange-800', textColor: 'text-orange-700 dark:text-orange-400',
    accent: 'bg-orange-50 dark:bg-orange-900/20', accentBorder: 'border-l-orange-400',
  },
  {
    key: 'travel', label: '旅行记录', icon: <Palmtree size={16} />,
    bgHeader: 'bg-emerald-50 dark:bg-emerald-900/30', bgRow: 'hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10',
    borderColor: 'border-emerald-200 dark:border-emerald-800', textColor: 'text-emerald-700 dark:text-emerald-400',
    accent: 'bg-emerald-50 dark:bg-emerald-900/20', accentBorder: 'border-l-emerald-400',
  },
];

function getParentTag(r: CalendarRecord): string {
  if (r.type === 'daily') return 'habit';
  const ev = r as EventRecord;
  if (ev.parent_tag === '演出模式') return 'theater';
  if (ev.parent_tag === '美食模式') return 'food';
  if (ev.parent_tag === '旅行模式') return 'travel';
  return 'normal';
}

const renderStars = (score: number, color: string) => (
  <span className="whitespace-nowrap inline-flex items-center gap-px">
    {Array.from({ length: 5 }, (_, i) => (
      <span key={i} style={{ color: i < Math.round(score) ? color : '#d1d5db', fontSize: '11px' }}>★</span>
    ))}
    <span className="ml-0.5 text-[10px] font-bold" style={{ color }}>{score}</span>
  </span>
);

/* ──────── Field Renderers for Mobile Cards ──────── */
interface FieldDef { label: string; value: string | React.ReactNode }

function getNormalFields(r: EventRecord): FieldDef[] {
  const loc = (r.extra_data as any)?.location;
  return [
    { label: '日期', value: r.dateStr },
    { label: '标签', value: r.tag_names?.filter(n => !['普通模式'].includes(n)).join(', ') || '-' },
    ...(loc?.name ? [{ label: '地点', value: loc.name }] : []),
    ...((r as any).reflection ? [{ label: '感想', value: (r as any).reflection }] : []),
    ...(r.imageUrls?.length > 0 ? [{ label: '图片', value: `${r.imageUrls.length}张` }] : []),
  ];
}

function getFoodFields(r: EventRecord): FieldDef[] {
  const fd = r.extra_data as FoodMetadata | undefined;
  return [
    { label: '日期', value: r.dateStr },
    ...(fd?.restaurant ? [{ label: '餐厅', value: fd.restaurant }] : []),
    ...(fd?.city ? [{ label: '城市', value: Array.isArray(fd.city) ? fd.city.join(' ') : fd.city }] : []),
    ...(fd?.rating ? [{ label: '评分', value: renderStars(fd.rating, '#f59e0b') }] : []),
    ...(fd?.price ? [{ label: '人均', value: `¥${fd.price}` }] : []),
    ...(fd?.dishes?.length ? [{ label: '菜品', value: fd.dishes.map(d => d.name).join(', ') }] : []),
    ...(fd?.comment ? [{ label: '评价', value: fd.comment }] : []),
    ...(r.imageUrls?.length > 0 ? [{ label: '图片', value: `${r.imageUrls.length}张` }] : []),
  ];
}

function getTheaterFields(r: EventRecord): FieldDef[] {
  const td = r.extra_data as TheaterMetadata | undefined;
  return [
    { label: '日期', value: r.dateStr },
    ...(td?.city ? [{ label: '城市', value: Array.isArray(td.city) ? td.city.join(' ') : td.city }] : []),
    ...(td?.theater ? [{ label: '剧场', value: td.theater }] : []),
    ...(td?.type ? [{ label: '类型', value: td.type }] : []),
    ...(td?.score ? [{ label: '评分', value: renderStars(td.score, '#8b5cf6') }] : []),
    ...(td?.price ? [{ label: '票价', value: `¥${td.price}` }] : []),
    ...(td?.seat ? [{ label: '座位', value: td.seat }] : []),
    ...(td?.actors ? [{ label: '演员', value: td.actors }] : []),
    ...(td?.thought ? [{ label: '感想', value: td.thought }] : []),
    ...(r.imageUrls?.length > 0 ? [{ label: '图片', value: `${r.imageUrls.length}张` }] : []),
  ];
}

function getTravelFields(r: EventRecord): FieldDef[] {
  const tv = r.extra_data as TravelMetadata | undefined;
  const days = tv?.startDate && tv?.endDate ? Math.ceil((new Date(tv.endDate).getTime() - new Date(tv.startDate).getTime()) / 86400000) + 1 : null;
  return [
    ...(tv?.startDate ? [{ label: '日期', value: `${tv.startDate} ~ ${tv.endDate || ''}` }] : []),
    ...(days ? [{ label: '天数', value: `${days}天` }] : []),
    ...(tv?.destinations?.length ? [{ label: '目的地', value: tv.destinations.join(', ') }] : []),
    ...(tv?.totalSpend ? [{ label: '总支出', value: `¥${tv.totalSpend.toLocaleString()}` }] : []),
    ...(tv?.attractions?.length ? [{ label: '景点', value: tv.attractions.map(a => a.name).join(', ') }] : []),
    ...(tv?.thought ? [{ label: '感想', value: tv.thought }] : []),
    ...(r.imageUrls?.length > 0 ? [{ label: '图片', value: `${r.imageUrls.length}张` }] : []),
  ];
}

const fieldGetters: Record<string, (r: EventRecord) => FieldDef[]> = {
  normal: getNormalFields, food: getFoodFields, theater: getTheaterFields, travel: getTravelFields,
};

/* ──────── Parent tags to exclude from sub-tag display ──────── */
const PARENT_TAGS = new Set(['普通模式', '演出模式', '美食模式', '旅行模式']);

/* ──────── Data-Driven Column Definitions ──────── */
interface ColumnDef {
  key: string;
  label: string;
  defaultOn: boolean;
  render: (r: EventRecord) => React.ReactNode;
  sortValue: (r: EventRecord) => string | number;
  titleStyle?: boolean; // if true, render with bold title styling
}

const TD = 'px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400';
const TD_TITLE = 'px-3 py-2.5 text-sm font-bold text-slate-800 dark:text-gray-100 truncate max-w-[200px]';

const ALL_COLUMNS: Record<string, ColumnDef[]> = {
  normal: [
    { key: '标题', label: '标题', defaultOn: true, titleStyle: true,
      render: r => <td className={TD_TITLE}>{r.title}</td>,
      sortValue: r => r.title || '' },
    { key: '日期', label: '日期', defaultOn: true,
      render: r => <td className={TD}>{r.dateStr}</td>,
      sortValue: r => r.dateStr || '' },
    { key: '标签', label: '标签', defaultOn: true,
      render: r => <td className={`${TD} truncate max-w-[100px]`}>{r.tag_names?.filter(n => n !== '普通模式').join(', ') || '-'}</td>,
      sortValue: r => r.tag_names?.filter(n => n !== '普通模式').join(', ') || '' },
    { key: '地点', label: '地点', defaultOn: true,
      render: r => { const loc = (r.extra_data as any)?.location; return <td className={`${TD} truncate max-w-[150px]`}>{loc?.name || loc?.address || '-'}</td>; },
      sortValue: r => (r.extra_data as any)?.location?.name || (r.extra_data as any)?.location?.address || '' },
    { key: '感想', label: '感想', defaultOn: true,
      render: r => <td className={`${TD} truncate max-w-[150px]`}>{(r as any).reflection || '-'}</td>,
      sortValue: r => (r as any).reflection || '' },
    { key: '图片', label: '图片', defaultOn: true,
      render: r => <td className={TD}>{r.imageUrls?.length > 0 ? `${r.imageUrls.length}张` : '-'}</td>,
      sortValue: r => r.imageUrls?.length || 0 },
  ],
  food: [
    { key: '标题', label: '标题', defaultOn: true, titleStyle: true,
      render: r => <td className={TD_TITLE}>{r.title}</td>,
      sortValue: r => r.title || '' },
    { key: '日期', label: '日期', defaultOn: true,
      render: r => <td className={TD}>{r.dateStr}</td>,
      sortValue: r => r.dateStr || '' },
    { key: '标签', label: '标签', defaultOn: true,
      render: r => <td className={`${TD} truncate max-w-[100px]`}>{r.tag_names?.filter(n => !PARENT_TAGS.has(n)).join(', ') || '-'}</td>,
      sortValue: r => r.tag_names?.filter(n => !PARENT_TAGS.has(n)).join(', ') || '' },
    { key: '餐厅', label: '餐厅', defaultOn: true,
      render: r => { const fd = r.extra_data as FoodMetadata | undefined; return <td className={`${TD} truncate max-w-[120px]`}>{fd?.restaurant || '-'}</td>; },
      sortValue: r => (r.extra_data as FoodMetadata | undefined)?.restaurant || '' },
    { key: '城市', label: '城市', defaultOn: false,
      render: r => { const fd = r.extra_data as FoodMetadata | undefined; return <td className={`${TD} truncate max-w-[80px]`}>{Array.isArray(fd?.city) ? fd!.city.join(' ') : fd?.city || '-'}</td>; },
      sortValue: r => { const fd = r.extra_data as FoodMetadata | undefined; return Array.isArray(fd?.city) ? fd!.city.join(' ') : fd?.city || ''; } },
    { key: '评分', label: '评分', defaultOn: true,
      render: r => { const fd = r.extra_data as FoodMetadata | undefined; return <td className="px-3 py-2.5 text-xs">{fd?.rating ? renderStars(fd.rating, '#f59e0b') : '-'}</td>; },
      sortValue: r => (r.extra_data as FoodMetadata | undefined)?.rating || 0 },
    { key: '人均/总价', label: '人均/总价', defaultOn: true,
      render: r => { const fd = r.extra_data as FoodMetadata | undefined; return <td className={TD}>{fd?.price ? `¥${fd.price}` : '-'}</td>; },
      sortValue: r => (r.extra_data as FoodMetadata | undefined)?.price || 0 },
    { key: '菜品', label: '菜品', defaultOn: true,
      render: r => { const fd = r.extra_data as FoodMetadata | undefined; return <td className={`${TD} truncate max-w-[150px]`}>{fd?.dishes?.map(d => d.name).join(', ') || '-'}</td>; },
      sortValue: r => (r.extra_data as FoodMetadata | undefined)?.dishes?.map(d => d.name).join(', ') || '' },
    { key: '地址', label: '地址', defaultOn: false,
      render: r => { const fd = r.extra_data as FoodMetadata | undefined; return <td className={`${TD} truncate max-w-[150px]`}>{fd?.address || '-'}</td>; },
      sortValue: r => (r.extra_data as FoodMetadata | undefined)?.address || '' },
    { key: '感想', label: '感想', defaultOn: true,
      render: r => { const fd = r.extra_data as FoodMetadata | undefined; return <td className={`${TD} truncate max-w-[120px]`}>{fd?.comment || '-'}</td>; },
      sortValue: r => (r.extra_data as FoodMetadata | undefined)?.comment || '' },
    { key: '图片', label: '图片', defaultOn: true,
      render: r => <td className={TD}>{r.imageUrls?.length > 0 ? `${r.imageUrls.length}张` : '-'}</td>,
      sortValue: r => r.imageUrls?.length || 0 },
  ],
  theater: [
    { key: '标题', label: '标题', defaultOn: true, titleStyle: true,
      render: r => <td className={TD_TITLE}>{r.title}</td>,
      sortValue: r => r.title || '' },
    { key: '日期', label: '日期', defaultOn: true,
      render: r => <td className={TD}>{r.dateStr}</td>,
      sortValue: r => r.dateStr || '' },
    { key: '标签', label: '标签', defaultOn: true,
      render: r => <td className={`${TD} truncate max-w-[100px]`}>{r.tag_names?.filter(n => !PARENT_TAGS.has(n)).join(', ') || '-'}</td>,
      sortValue: r => r.tag_names?.filter(n => !PARENT_TAGS.has(n)).join(', ') || '' },
    { key: '城市', label: '城市', defaultOn: true,
      render: r => { const td = r.extra_data as TheaterMetadata | undefined; return <td className={`${TD} truncate max-w-[80px]`}>{Array.isArray(td?.city) ? td!.city.join(' ') : td?.city || '-'}</td>; },
      sortValue: r => { const td = r.extra_data as TheaterMetadata | undefined; return Array.isArray(td?.city) ? td!.city.join(' ') : td?.city || ''; } },
    { key: '剧场', label: '剧场', defaultOn: true,
      render: r => { const td = r.extra_data as TheaterMetadata | undefined; return <td className={`${TD} truncate max-w-[100px]`}>{td?.theater || '-'}</td>; },
      sortValue: r => (r.extra_data as TheaterMetadata | undefined)?.theater || '' },
    { key: '类型', label: '类型', defaultOn: true,
      render: r => { const td = r.extra_data as TheaterMetadata | undefined; return <td className={TD}>{td?.type || '-'}</td>; },
      sortValue: r => (r.extra_data as TheaterMetadata | undefined)?.type || '' },
    { key: '评分', label: '评分', defaultOn: true,
      render: r => { const td = r.extra_data as TheaterMetadata | undefined; return <td className="px-3 py-2.5 text-xs">{td?.score ? renderStars(td.score, '#8b5cf6') : '-'}</td>; },
      sortValue: r => (r.extra_data as TheaterMetadata | undefined)?.score || 0 },
    { key: '票价', label: '票价', defaultOn: true,
      render: r => { const td = r.extra_data as TheaterMetadata | undefined; return <td className={TD}>{td?.price ? `¥${td.price}` : '-'}</td>; },
      sortValue: r => (r.extra_data as TheaterMetadata | undefined)?.price || 0 },
    { key: '座位', label: '座位', defaultOn: true,
      render: r => { const td = r.extra_data as TheaterMetadata | undefined; return <td className={`${TD} truncate max-w-[80px]`}>{td?.seat || '-'}</td>; },
      sortValue: r => (r.extra_data as TheaterMetadata | undefined)?.seat || '' },
    { key: '演员', label: '演员', defaultOn: true,
      render: r => { const td = r.extra_data as TheaterMetadata | undefined; return <td className={`${TD} truncate max-w-[120px]`}>{td?.actors || '-'}</td>; },
      sortValue: r => (r.extra_data as TheaterMetadata | undefined)?.actors || '' },
    { key: '感想', label: '感想', defaultOn: true,
      render: r => { const td = r.extra_data as TheaterMetadata | undefined; return <td className={`${TD} truncate max-w-[150px]`}>{td?.thought || '-'}</td>; },
      sortValue: r => (r.extra_data as TheaterMetadata | undefined)?.thought || '' },
    { key: '图片', label: '图片', defaultOn: true,
      render: r => <td className={TD}>{r.imageUrls?.length > 0 ? `${r.imageUrls.length}张` : '-'}</td>,
      sortValue: r => r.imageUrls?.length || 0 },
  ],
  travel: [
    { key: '标题', label: '标题', defaultOn: true, titleStyle: true,
      render: r => <td className={TD_TITLE}>{r.title}</td>,
      sortValue: r => r.title || '' },
    { key: '开始日期', label: '开始日期', defaultOn: true,
      render: r => { const tv = r.extra_data as TravelMetadata | undefined; return <td className={TD}>{tv?.startDate || '-'}</td>; },
      sortValue: r => (r.extra_data as TravelMetadata | undefined)?.startDate || '' },
    { key: '结束日期', label: '结束日期', defaultOn: true,
      render: r => { const tv = r.extra_data as TravelMetadata | undefined; return <td className={TD}>{tv?.endDate || '-'}</td>; },
      sortValue: r => (r.extra_data as TravelMetadata | undefined)?.endDate || '' },
    { key: '天数', label: '天数', defaultOn: true,
      render: r => { const tv = r.extra_data as TravelMetadata | undefined; const d = tv?.startDate && tv?.endDate ? Math.ceil((new Date(tv.endDate).getTime() - new Date(tv.startDate).getTime()) / 86400000) + 1 : '-'; return <td className={TD}>{d}天</td>; },
      sortValue: r => { const tv = r.extra_data as TravelMetadata | undefined; if (!tv?.startDate || !tv?.endDate) return 0; return Math.ceil((new Date(tv.endDate).getTime() - new Date(tv.startDate).getTime()) / 86400000) + 1; } },
    { key: '标签', label: '标签', defaultOn: true,
      render: r => <td className={`${TD} truncate max-w-[100px]`}>{r.tag_names?.filter(n => !PARENT_TAGS.has(n)).join(', ') || '-'}</td>,
      sortValue: r => r.tag_names?.filter(n => !PARENT_TAGS.has(n)).join(', ') || '' },
    { key: '目的地', label: '目的地', defaultOn: true,
      render: r => { const tv = r.extra_data as TravelMetadata | undefined; return <td className={`${TD} truncate max-w-[120px]`}>{tv?.destinations?.join(', ') || '-'}</td>; },
      sortValue: r => (r.extra_data as TravelMetadata | undefined)?.destinations?.join(', ') || '' },
    { key: '总支出', label: '总支出', defaultOn: true,
      render: r => { const tv = r.extra_data as TravelMetadata | undefined; return <td className={TD}>{tv?.totalSpend ? `¥${parseFloat(Number(tv.totalSpend).toFixed(2)).toLocaleString()}` : '-'}</td>; },
      sortValue: r => (r.extra_data as TravelMetadata | undefined)?.totalSpend || 0 },
    { key: '景点', label: '景点', defaultOn: true,
      render: r => { const tv = r.extra_data as TravelMetadata | undefined; return <td className={`${TD} truncate max-w-[150px]`}>{tv?.attractions?.map(a => a.name).join(', ') || '-'}</td>; },
      sortValue: r => (r.extra_data as TravelMetadata | undefined)?.attractions?.map(a => a.name).join(', ') || '' },
    { key: '交通', label: '交通', defaultOn: false,
      render: r => { const tv = r.extra_data as TravelMetadata | undefined; const parts: string[] = []; (tv?.railways || []).forEach(rl => { if (rl.trainNo) parts.push(`${rl.trainNo}${rl.seat ? ' ' + rl.seat : ''}`); }); (tv?.flights || []).forEach(fl => { if (fl.flightNo || fl.airline) parts.push(`${fl.airline} ${fl.flightNo}`); }); return <td className={`${TD} truncate max-w-[150px]`}>{parts.length > 0 ? parts.join(', ') : '-'}</td>; },
      sortValue: r => { const tv = r.extra_data as TravelMetadata | undefined; return [...(tv?.railways || []).map(rl => rl.trainNo), ...(tv?.flights || []).map(fl => fl.flightNo)].join(', '); } },
    { key: '酒店', label: '酒店', defaultOn: false,
      render: r => { const tv = r.extra_data as TravelMetadata | undefined; return <td className={`${TD} truncate max-w-[150px]`}>{tv?.hotels?.map(h => h.name).join(', ') || '-'}</td>; },
      sortValue: r => (r.extra_data as TravelMetadata | undefined)?.hotels?.map(h => h.name).join(', ') || '' },
    { key: '感想', label: '感想', defaultOn: true,
      render: r => { const tv = r.extra_data as TravelMetadata | undefined; return <td className={`${TD} truncate max-w-[150px]`}>{tv?.thought || '-'}</td>; },
      sortValue: r => (r.extra_data as TravelMetadata | undefined)?.thought || '' },
    { key: '图片', label: '图片', defaultOn: true,
      render: r => <td className={TD}>{r.imageUrls?.length > 0 ? `${r.imageUrls.length}张` : '-'}</td>,
      sortValue: r => r.imageUrls?.length || 0 },
  ],
};

// Build default visible columns per section
const DEFAULT_VISIBLE: Record<string, Set<string>> = {};
for (const [key, cols] of Object.entries(ALL_COLUMNS)) {
  DEFAULT_VISIBLE[key] = new Set(cols.filter(c => c.defaultOn).map(c => c.key));
}

/* ──────── Pagination Component ──────── */
function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-700">
      <span className="text-xs text-gray-400 dark:text-gray-500">第 {page}/{totalPages} 页</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}
          className="px-2.5 py-1 text-xs font-bold rounded-lg transition-all disabled:opacity-30 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
          上一页
        </button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          let pn: number;
          if (totalPages <= 7) pn = i + 1;
          else if (page <= 4) pn = i + 1;
          else if (page >= totalPages - 3) pn = totalPages - 6 + i;
          else pn = page - 3 + i;
          return (
            <button key={pn} onClick={() => onPageChange(pn)}
              className={`w-7 h-7 text-xs font-bold rounded-lg transition-all ${page === pn ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
              {pn}
            </button>
          );
        })}
        <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
          className="px-2.5 py-1 text-xs font-bold rounded-lg transition-all disabled:opacity-30 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
          下一页
        </button>
      </div>
    </div>
  );
}

/* ──────── Sort Value Extractors (via ColumnDef) ──────── */
function getSortValue(r: EventRecord, sectionKey: string, colKey: string): string | number {
  const cols = ALL_COLUMNS[sectionKey];
  const col = cols?.find(c => c.key === colKey);
  if (col) return col.sortValue(r);
  return '';
}

interface SortState { col: string; dir: 'asc' | 'desc' }

/* ──────── Main Component ──────── */
export const TableView: React.FC<TableViewProps> = React.memo(({
  records, isTheaterMode, isFoodMode, isTravelMode, onEditRecord, onDeleteRecord,
}) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pages, setPages] = useState<Record<string, number>>({ normal: 1, food: 1, theater: 1, travel: 1 });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [sortStates, setSortStates] = useState<Record<string, SortState>>({});
  const [visibleCols, setVisibleCols] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {};
    for (const [key, def] of Object.entries(DEFAULT_VISIBLE)) init[key] = new Set(def);
    return init;
  });
  const [colPickerOpen, setColPickerOpen] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close column picker on outside click
  useEffect(() => {
    if (!colPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setColPickerOpen(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colPickerOpen]);

  const toggleCol = useCallback((sectionKey: string, colKey: string) => {
    setVisibleCols(prev => {
      const s = new Set(prev[sectionKey]);
      s.has(colKey) ? s.delete(colKey) : s.add(colKey);
      return { ...prev, [sectionKey]: s };
    });
  }, []);

  const handleSort = useCallback((sectionKey: string, col: string) => {
    setSortStates(prev => {
      const cur = prev[sectionKey];
      if (cur?.col === col) {
        return { ...prev, [sectionKey]: { col, dir: cur.dir === 'asc' ? 'desc' : 'asc' } };
      }
      return { ...prev, [sectionKey]: { col, dir: 'asc' } };
    });
    setPages(prev => ({ ...prev, [sectionKey]: 1 }));
  }, []);

  const grouped = useMemo(() => {
    const g: Record<string, EventRecord[]> = { normal: [], food: [], theater: [], travel: [] };
    records.forEach(r => {
      if (r.type !== 'special') return;
      const ev = r as EventRecord;
      const pt = getParentTag(ev);
      if (g[pt]) g[pt].push(ev);
    });
    return g;
  }, [records]);

  const visibleSections = SECTIONS.filter(s => {
    if (s.key === 'theater' && !isTheaterMode) return false;
    if (s.key === 'food' && !isFoodMode) return false;
    if (s.key === 'travel' && !isTravelMode) return false;
    return true;
  });

  const toggleCollapse = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleSelectAll = (key: string) => {
    const ids = grouped[key].map(r => r.id);
    setSelected(prev => {
      const n = new Set(prev);
      const all = ids.every(id => n.has(id));
      ids.forEach(id => all ? n.delete(id) : n.add(id));
      return n;
    });
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selected.size} 条记录吗？此操作不可撤销。`)) return;
    setDeletingIds(new Set(selected));
    for (const id of selected) {
      const rec = records.find(r => r.id === id);
      if (rec) await onDeleteRecord(id, rec.type, rec.type === 'special' ? (rec as EventRecord).title : undefined);
    }
    setSelected(new Set());
    setDeletingIds(new Set());
  };

  return (
    <div className="max-w-[96vw] mx-auto pt-20 sm:pt-24 pb-32 px-2 sm:px-4 space-y-6">
      {/* Batch delete bar */}
      {selected.size > 0 && (
        <div className="sticky top-20 z-30 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center justify-between shadow-lg backdrop-blur-sm">
          <span className="text-sm font-bold text-red-700 dark:text-red-400">已选 {selected.size} 条记录</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-gray-800 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 transition-all">
              取消选择
            </button>
            <button onClick={handleBatchDelete}
              className="px-3 py-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg shadow-sm transition-all flex items-center gap-1">
              <Trash2 size={12} /> 批量删除
            </button>
          </div>
        </div>
      )}

      {visibleSections.map(section => {
        const rawItems = grouped[section.key] || [];
        const sortState = sortStates[section.key];
        const items = sortState ? [...rawItems].sort((a, b) => {
          const va = getSortValue(a, section.key, sortState.col);
          const vb = getSortValue(b, section.key, sortState.col);
          let cmp = 0;
          if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
          else cmp = String(va).localeCompare(String(vb), 'zh-CN');
          return sortState.dir === 'asc' ? cmp : -cmp;
        }) : rawItems;
        const isCollapsed = collapsed[section.key];
        const page = pages[section.key] || 1;
        const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
        const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
        const allSel = items.length > 0 && items.every(r => selected.has(r.id));
        const allCols = ALL_COLUMNS[section.key] || [];
        const visCols = visibleCols[section.key] || new Set<string>();
        const activeCols = allCols.filter(c => visCols.has(c.key));
        const getFields = fieldGetters[section.key];

        return (
          <div key={section.key} className={`rounded-xl border ${section.borderColor} shadow-sm bg-white dark:bg-gray-900`}>
            {/* Section Header */}
            <div className={`flex items-center justify-between px-4 py-3 rounded-t-xl ${section.bgHeader} transition-colors`}>
              <button onClick={() => toggleCollapse(section.key)} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 font-black text-sm uppercase tracking-widest ${section.textColor}`}>
                  {section.icon} {section.label}
                  <span className="text-xs font-bold opacity-60 normal-case">({items.length})</span>
                </div>
              </button>
              <div className="flex items-center gap-2">
                {/* Column Picker Toggle */}
                {!isCollapsed && items.length > 0 && (
                  <div className="relative" ref={colPickerOpen === section.key ? pickerRef : undefined}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setColPickerOpen(colPickerOpen === section.key ? null : section.key); }}
                      className={`p-1.5 rounded-lg transition-all ${colPickerOpen === section.key ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                      title="选择显示列"
                    >
                      <Settings2 size={15} />
                    </button>
                    {colPickerOpen === section.key && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50 max-h-[300px] overflow-y-auto">
                        <div className="px-3 py-1.5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">显示列</div>
                        {allCols.map(col => (
                          <button
                            key={col.key}
                            onClick={() => toggleCol(section.key, col.key)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            {visCols.has(col.key)
                              ? <CheckSquare size={14} className="text-blue-500 shrink-0" />
                              : <Square size={14} className="text-gray-300 dark:text-gray-600 shrink-0" />}
                            {col.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button onClick={() => toggleCollapse(section.key)}>
                  {isCollapsed ? <ChevronRight size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </button>
              </div>
            </div>

            {!isCollapsed && (
              <>
                {items.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500 italic">暂无记录</div>
                ) : (
                  <>
                    {/* ──── Desktop Table (hidden on mobile) ──── */}
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-700">
                            <th className="px-3 py-2 w-8">
                              <button onClick={() => toggleSelectAll(section.key)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                {allSel ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} />}
                              </button>
                            </th>
                            {activeCols.map(col => (
                              <th key={col.key} className="px-3 py-2 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                <button
                                  onClick={() => handleSort(section.key, col.key)}
                                  className="inline-flex items-center gap-0.5 hover:text-gray-600 dark:hover:text-gray-300 transition-colors group"
                                >
                                  {col.label}
                                  {sortState?.col === col.key ? (
                                    sortState.dir === 'asc'
                                      ? <ChevronUp size={12} className="text-blue-500" />
                                      : <ChevronDown size={12} className="text-blue-500" />
                                  ) : (
                                    <ChevronDown size={10} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                                  )}
                                </button>
                              </th>
                            ))}
                            <th className="px-3 py-2 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider w-12">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageItems.map(r => (
                            <tr key={r.id}
                              className={`border-b border-gray-50 dark:border-gray-800 transition-all ${section.bgRow} ${deletingIds.has(r.id) ? 'opacity-30 pointer-events-none' : ''} ${selected.has(r.id) ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''}`}>
                              <td className="px-3 py-2.5 w-8">
                                <button onClick={() => toggleSelect(r.id)} className="text-gray-400 hover:text-blue-500 transition-colors">
                                  {selected.has(r.id) ? <CheckSquare size={14} className="text-blue-500" /> : <Square size={14} />}
                                </button>
                              </td>
                              {activeCols.map(col => <React.Fragment key={col.key}>{col.render(r)}</React.Fragment>)}
                              <td className="px-3 py-2.5 w-12">
                                <button onClick={() => onEditRecord(r, r.dateStr)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all" title="编辑">
                                  <Pencil size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* ──── Mobile Card Layout (visible on mobile) ──── */}
                    <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-800">
                      {pageItems.map(r => {
                        const fields = getFields(r);
                        return (
                          <div key={r.id}
                            className={`p-3 border-l-4 ${section.accentBorder} transition-all ${deletingIds.has(r.id) ? 'opacity-30 pointer-events-none' : ''} ${selected.has(r.id) ? 'bg-blue-50/60 dark:bg-blue-900/15' : ''}`}>
                            {/* Title row */}
                            <div className="flex items-center gap-2 mb-2">
                              <button onClick={() => toggleSelect(r.id)} className="text-gray-400 hover:text-blue-500 transition-colors shrink-0">
                                {selected.has(r.id) ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} />}
                              </button>
                              <span className="text-sm font-black text-slate-800 dark:text-gray-100 truncate flex-1">{r.title}</span>
                              <button onClick={() => onEditRecord(r, r.dateStr)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all shrink-0" title="编辑">
                                <Pencil size={14} />
                              </button>
                            </div>
                            {/* Fields grid */}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 ml-6">
                              {fields.map((f, i) => (
                                <div key={i} className="flex items-start gap-1 min-w-0">
                                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 shrink-0 mt-0.5">{f.label}</span>
                                  <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{f.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <Pagination page={page} totalPages={totalPages}
                      onPageChange={(p) => setPages(prev => ({ ...prev, [section.key]: p }))} />
                  </>
                )}
              </>
            )}
          </div>
        );
      })}

      {visibleSections.length === 0 && (
        <div className="text-center py-20 text-gray-400 dark:text-gray-500">
          <div className="text-4xl mb-4">📋</div>
          <div className="text-lg font-bold">没有可用的记录板块</div>
          <div className="text-sm mt-1">请在设置中开启至少一个功能模式</div>
        </div>
      )}
    </div>
  );
});
