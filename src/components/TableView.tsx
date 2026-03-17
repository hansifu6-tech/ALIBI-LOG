import React, { useState, useMemo, useCallback } from 'react';
import { Pencil, Trash2, ChevronDown, ChevronRight, ChevronUp, CheckSquare, Square, Theater, Utensils, Palmtree, FileText } from 'lucide-react';
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
  const loc = (r.extra_data as any)?.location_data;
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

/* ──────── Desktop Table Column Renderers ──────── */
const columnHeaders: Record<string, string[]> = {
  normal: ['标题', '日期', '标签', '地点', '感想', '图片'],
  food: ['标题', '日期', '餐厅', '城市', '评分', '人均', '菜品', '评价', '图片'],
  theater: ['标题', '日期', '城市', '剧场', '类型', '评分', '票价', '座位', '演员', '感想', '图片'],
  travel: ['标题', '开始日期', '结束日期', '天数', '目的地', '总支出', '景点', '感想', '图片'],
};

function renderNormalCols(r: EventRecord) {
  const loc = (r.extra_data as any)?.location_data;
  return (
    <>
      <td className="px-3 py-2.5 text-sm font-bold text-slate-800 dark:text-gray-100 truncate max-w-[200px]">{r.title}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{r.dateStr}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[100px]">{r.tag_names?.filter(n => n !== '普通模式').join(', ') || '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">{loc?.name || '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{(r as any).reflection || '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{r.imageUrls?.length > 0 ? `${r.imageUrls.length}张` : '-'}</td>
    </>
  );
}

function renderFoodCols(r: EventRecord) {
  const fd = r.extra_data as FoodMetadata | undefined;
  return (
    <>
      <td className="px-3 py-2.5 text-sm font-bold text-slate-800 dark:text-gray-100 truncate max-w-[200px]">{r.title}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{r.dateStr}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">{fd?.restaurant || '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[80px]">{Array.isArray(fd?.city) ? fd!.city.join(' ') : fd?.city || '-'}</td>
      <td className="px-3 py-2.5 text-xs">{fd?.rating ? renderStars(fd.rating, '#f59e0b') : '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{fd?.price ? `¥${fd.price}` : '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{fd?.dishes?.map(d => d.name).join(', ') || '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">{fd?.comment || '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{r.imageUrls?.length > 0 ? `${r.imageUrls.length}张` : '-'}</td>
    </>
  );
}

function renderTheaterCols(r: EventRecord) {
  const td = r.extra_data as TheaterMetadata | undefined;
  return (
    <>
      <td className="px-3 py-2.5 text-sm font-bold text-slate-800 dark:text-gray-100 truncate max-w-[200px]">{r.title}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{r.dateStr}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[80px]">{Array.isArray(td?.city) ? td!.city.join(' ') : td?.city || '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[100px]">{td?.theater || '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{td?.type || '-'}</td>
      <td className="px-3 py-2.5 text-xs">{td?.score ? renderStars(td.score, '#8b5cf6') : '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{td?.price ? `¥${td.price}` : '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[80px]">{td?.seat || '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">{td?.actors || '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{td?.thought || '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{r.imageUrls?.length > 0 ? `${r.imageUrls.length}张` : '-'}</td>
    </>
  );
}

function renderTravelCols(r: EventRecord) {
  const tv = r.extra_data as TravelMetadata | undefined;
  const days = tv?.startDate && tv?.endDate ? Math.ceil((new Date(tv.endDate).getTime() - new Date(tv.startDate).getTime()) / 86400000) + 1 : '-';
  return (
    <>
      <td className="px-3 py-2.5 text-sm font-bold text-slate-800 dark:text-gray-100 truncate max-w-[200px]">{r.title}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{tv?.startDate || '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{tv?.endDate || '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{days}天</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">{tv?.destinations?.join(', ') || '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{tv?.totalSpend ? `¥${tv.totalSpend.toLocaleString()}` : '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{tv?.attractions?.map(a => a.name).join(', ') || '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{tv?.thought || '-'}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{r.imageUrls?.length > 0 ? `${r.imageUrls.length}张` : '-'}</td>
    </>
  );
}

const colRenderers: Record<string, (r: EventRecord) => React.ReactNode> = {
  normal: renderNormalCols, food: renderFoodCols, theater: renderTheaterCols, travel: renderTravelCols,
};

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

/* ──────── Sort Value Extractors ──────── */
function getSortValue(r: EventRecord, sectionKey: string, colHeader: string): string | number {
  const fd = r.extra_data as FoodMetadata | undefined;
  const td = r.extra_data as TheaterMetadata | undefined;
  const tv = r.extra_data as TravelMetadata | undefined;
  const loc = (r.extra_data as any)?.location_data;

  switch (colHeader) {
    case '标题': return r.title || '';
    case '日期': return r.dateStr || '';
    case '标签': return r.tag_names?.filter(n => !['普通模式'].includes(n)).join(', ') || '';
    case '地点': return loc?.name || '';
    case '感想':
      if (sectionKey === 'normal') return (r as any).reflection || '';
      if (sectionKey === 'theater') return td?.thought || '';
      if (sectionKey === 'travel') return tv?.thought || '';
      return '';
    case '图片': return r.imageUrls?.length || 0;
    case '餐厅': return fd?.restaurant || '';
    case '城市':
      if (sectionKey === 'food') return Array.isArray(fd?.city) ? fd!.city.join(' ') : fd?.city || '';
      if (sectionKey === 'theater') return Array.isArray(td?.city) ? td!.city.join(' ') : td?.city || '';
      return '';
    case '评分':
      if (sectionKey === 'food') return fd?.rating || 0;
      if (sectionKey === 'theater') return td?.score || 0;
      return 0;
    case '人均': return fd?.price || 0;
    case '菜品': return fd?.dishes?.map(d => d.name).join(', ') || '';
    case '评价': return fd?.comment || '';
    case '剧场': return td?.theater || '';
    case '类型': return td?.type || '';
    case '票价': return td?.price || 0;
    case '座位': return td?.seat || '';
    case '演员': return td?.actors || '';
    case '开始日期': return tv?.startDate || '';
    case '结束日期': return tv?.endDate || '';
    case '天数': {
      if (!tv?.startDate || !tv?.endDate) return 0;
      return Math.ceil((new Date(tv.endDate).getTime() - new Date(tv.startDate).getTime()) / 86400000) + 1;
    }
    case '目的地': return tv?.destinations?.join(', ') || '';
    case '总支出': return tv?.totalSpend || 0;
    case '景点': return tv?.attractions?.map(a => a.name).join(', ') || '';
    default: return '';
  }
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
        const headers = columnHeaders[section.key];
        const renderRow = colRenderers[section.key];
        const getFields = fieldGetters[section.key];

        return (
          <div key={section.key} className={`rounded-xl border ${section.borderColor} overflow-hidden shadow-sm bg-white dark:bg-gray-900`}>
            {/* Section Header */}
            <button onClick={() => toggleCollapse(section.key)}
              className={`w-full flex items-center justify-between px-4 py-3 ${section.bgHeader} transition-colors`}>
              <div className={`flex items-center gap-2 font-black text-sm uppercase tracking-widest ${section.textColor}`}>
                {section.icon} {section.label}
                <span className="text-xs font-bold opacity-60 normal-case">({items.length})</span>
              </div>
              {isCollapsed ? <ChevronRight size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
            </button>

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
                            {headers.map(h => (
                              <th key={h} className="px-3 py-2 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                <button
                                  onClick={() => handleSort(section.key, h)}
                                  className="inline-flex items-center gap-0.5 hover:text-gray-600 dark:hover:text-gray-300 transition-colors group"
                                >
                                  {h}
                                  {sortState?.col === h ? (
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
                              {renderRow(r)}
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
