import React, { useState, useMemo, useRef, useCallback, useEffect, memo } from 'react';
import { MapPin, Ticket, Clock, Edit3, Users, Building2, Utensils, Sticker, Theater, UtensilsCrossed, Search, CalendarSearch, X, Palmtree, Landmark, TrainFront, Plane, Hotel } from 'lucide-react';
import type { EventRecord, TheaterMetadata, FoodMetadata, TravelMetadata } from '../types';

interface TimelineViewProps {
  records: EventRecord[];
  onEditRecord: (record: EventRecord, dateStr: string) => void;
  onPreviewImage: (url: string) => void;
  hideAllSpecialEvents: boolean;
  isTheaterMode: boolean;
}

// ── Highlight Component ─────────────────────────────────────────
function HighlightText({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword || !text) return <>{text}</>;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === keyword.toLowerCase() ? (
          <mark key={i} style={{ background: '#FDE047', color: '#1a1a1a', borderRadius: '3px', padding: '0 2px', fontWeight: 'inherit' }}>{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ── Collect all searchable text from a record ───────────────────
function getSearchableText(record: EventRecord): string {
  const parts: string[] = [record.title || ''];
  if (record.reflection) parts.push(record.reflection);
  if (record.tag_names) parts.push(...record.tag_names);
  if (record.dateStr) parts.push(record.dateStr);

  const extra = record.extra_data as Record<string, any> | undefined;
  if (extra) {
    for (const val of Object.values(extra)) {
      if (typeof val === 'string') parts.push(val);
      else if (typeof val === 'number') parts.push(String(val));
      else if (Array.isArray(val)) {
        val.forEach(v => {
          if (typeof v === 'string') parts.push(v);
          else if (v && typeof v === 'object' && v.name) parts.push(v.name);
        });
      }
    }
  }
  return parts.join(' ');
}

function TimelineViewInner({ 
  records, 
  onEditRecord, 
  onPreviewImage,
  hideAllSpecialEvents,
  isTheaterMode
}: TimelineViewProps) {
  // ── Search state ──────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchInput = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchKeyword(value.trim());
    }, 300);
  }, []);

  // ── Date navigator state ──────────────────────────────────────
  const [dateYear, setDateYear] = useState('');
  const [dateMonth, setDateMonth] = useState('');
  const [dateDay, setDateDay] = useState('');
  const [showDateNav, setShowDateNav] = useState(false);
  const dateGroupRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const toolbarRef = useRef<HTMLDivElement>(null);

  // ── Progressive loading ────────────────────────────────────────
  const INITIAL_LOAD = 30;
  const LOAD_MORE = 20;
  const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when filtered data changes
  useEffect(() => {
    setVisibleCount(INITIAL_LOAD);
  }, [searchKeyword, records]);

  // IntersectionObserver to auto-load more
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + LOAD_MORE);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });

  // Click outside to close panels
  useEffect(() => {
    if (!showDateNav && !showSearch) return;
    const handler = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setShowDateNav(false);
        setShowSearch(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDateNav, showSearch]);

  const handleDateJump = useCallback(() => {
    const y = dateYear.trim();
    const m = dateMonth.trim().padStart(2, '0');
    const d = dateDay.trim().padStart(2, '0');
    if (!y) return;
    const targetDate = `${y}-${m || '01'}-${d || '01'}`;
    // Find exact date
    const el = dateGroupRefs.current.get(targetDate);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setShowDateNav(false);
      return;
    }
    // Find closest date
    const allDates = Array.from(dateGroupRefs.current.keys()).sort();
    let closest = allDates[0];
    for (const dt of allDates) {
      if (dt <= targetDate) closest = dt;
      else break;
    }
    if (closest) {
      dateGroupRefs.current.get(closest)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setShowDateNav(false);
  }, [dateYear, dateMonth, dateDay]);

  // Group records by date string, sorted descending
  // Travel records are extracted and inserted by startDate as special entries
  const groupedRecords = useMemo(() => {
    if (hideAllSpecialEvents) return [];

    // 1. Separate travel records and collect all linked record IDs
    const travelRecords: EventRecord[] = [];
    const linkedIdSet = new Set<string>();
    const allRecords = [...records];

    for (const r of allRecords) {
      if (r.type === 'special' && r.parent_tag === '旅行模式') {
        const extra = r.extra_data as TravelMetadata | undefined;
        if (extra?.startDate && extra?.endDate) {
          travelRecords.push(r);
          if (extra.linkedRecordIds) {
            extra.linkedRecordIds.forEach(id => linkedIdSet.add(id));
          }
        }
      }
    }

    // 2. Normal records: exclude travel records themselves AND linked records
    const travelIdSet = new Set(travelRecords.map(r => r.id));
    const normalRecords = allRecords.filter(r => !travelIdSet.has(r.id) && !linkedIdSet.has(r.id));

    // 3. Group normal records by date
    const groups: { [key: string]: EventRecord[] } = {};
    normalRecords
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr))
      .forEach(record => {
        if (!groups[record.dateStr]) groups[record.dateStr] = [];
        groups[record.dateStr].push(record);
      });

    // 4. Build mixed timeline entries: normal date groups + travel entries
    type TimelineEntry = { type: 'date'; dateStr: string; items: EventRecord[] }
                       | { type: 'travel'; record: EventRecord; startDate: string; endDate: string; linkedRecords: EventRecord[] };

    const entries: TimelineEntry[] = [];

    // Add normal date groups
    for (const [dateStr, items] of Object.entries(groups)) {
      entries.push({ type: 'date', dateStr, items });
    }

    // Add travel entries (sorted by startDate)
    for (const tr of travelRecords) {
      const extra = tr.extra_data as TravelMetadata;
      const linkedRecs = (extra.linkedRecordIds || [])
        .map(id => allRecords.find(r => r.id === id))
        .filter(Boolean) as EventRecord[];
      entries.push({
        type: 'travel',
        record: tr,
        startDate: extra.startDate,
        endDate: extra.endDate,
        linkedRecords: linkedRecs,
      });
    }

    // 5. Sort all entries descending by date (travel uses startDate)
    entries.sort((a, b) => {
      const dateA = a.type === 'date' ? a.dateStr : a.startDate;
      const dateB = b.type === 'date' ? b.dateStr : b.startDate;
      return dateB.localeCompare(dateA);
    });

    return entries;
  }, [records, hideAllSpecialEvents]);

  // ── Filtered records by search keyword ────────────────────────
  const { filteredEntries, matchCount } = useMemo(() => {
    if (!searchKeyword) return { filteredEntries: groupedRecords, matchCount: 0 };
    const kw = searchKeyword.toLowerCase();
    let count = 0;
    const result: typeof groupedRecords = [];
    for (const entry of groupedRecords) {
      if (entry.type === 'date') {
        const matched = entry.items.filter(r => getSearchableText(r).toLowerCase().includes(kw));
        if (matched.length > 0) {
          result.push({ ...entry, items: matched });
          count += matched.length;
        }
      } else {
        // Travel entry: search in record itself + linked records
        const mainMatch = getSearchableText(entry.record).toLowerCase().includes(kw);
        const matchedLinked = entry.linkedRecords.filter(r => getSearchableText(r).toLowerCase().includes(kw));
        if (mainMatch || matchedLinked.length > 0) {
          result.push(mainMatch ? entry : { ...entry, linkedRecords: matchedLinked });
          count += (mainMatch ? 1 : 0) + matchedLinked.length;
        }
      }
    }
    return { filteredEntries: result, matchCount: count };
  }, [groupedRecords, searchKeyword]);

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const monthName = date.toLocaleDateString('en-US', { month: 'long' });
    const day = String(d).padStart(2, '0');
    const weekday = date.toLocaleDateString('zh-CN', { weekday: 'long' });
    return { day, monthName, weekday };
  };

  const getCategoryIcon = (parentTag: string, customColor?: string) => {
    switch (parentTag) {
      case '演出模式':
        return <Theater size={16} strokeWidth={2} className="shrink-0" style={{ color: customColor || '#a855f7' }} />;
      case '普通模式':
        return <Sticker size={16} strokeWidth={2} className="shrink-0" style={{ color: customColor || '#3b82f6' }} />;
      case '美食模式':
        return <Utensils size={16} strokeWidth={2} className="shrink-0" style={{ color: customColor || '#ffa500' }} />;
      case '旅行模式':
        return <Palmtree size={16} strokeWidth={2} className="shrink-0" style={{ color: customColor || '#10b981' }} />;
      default:
        return <Sticker size={16} strokeWidth={2} className="shrink-0" style={{ color: customColor || '#94a3b8' }} />;
    }
  };

  // Keyword for highlight
  const kw = searchKeyword;

  return (
    <div className="relative max-w-2xl mx-auto px-4 sm:px-6 py-8 transition-all duration-500">

      {/* ── Toolbar: Date Navigator + Search ── */}
      <div ref={toolbarRef} className="sticky top-[100px] z-30 mb-6 flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Date Navigator Toggle */}
          <button
            onClick={() => { setShowDateNav(!showDateNav); if (showSearch) setShowSearch(false); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border backdrop-blur-xl ${
              showDateNav
                ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-blue-300'
            }`}
          >
            <CalendarSearch size={16} />
            <span>时间定位</span>
          </button>

          {/* Search Toggle */}
          <button
            onClick={() => { setShowSearch(!showSearch); if (showDateNav) setShowDateNav(false); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border backdrop-blur-xl ${
              showSearch
                ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-blue-300'
            }`}
          >
            <Search size={16} />
            <span>搜索</span>
          </button>

          {/* Match count badge */}
          {searchKeyword && (
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium ml-1">
              共找到 <strong className="text-blue-500">{matchCount}</strong> 条相关记录
            </span>
          )}
        </div>

        {/* Date Navigator Panel */}
        {showDateNav && (
          <div className="flex items-center gap-2 p-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg">
            <input
              type="text"
              inputMode="numeric"
              value={dateYear}
              onChange={(e) => setDateYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="年"
              maxLength={4}
              className="w-20 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-center text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
            />
            <span className="text-gray-400 text-sm font-bold">-</span>
            <input
              type="text"
              inputMode="numeric"
              value={dateMonth}
              onChange={(e) => setDateMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
              placeholder="月"
              maxLength={2}
              className="w-14 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-center text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
            />
            <span className="text-gray-400 text-sm font-bold">-</span>
            <input
              type="text"
              inputMode="numeric"
              value={dateDay}
              onChange={(e) => setDateDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
              placeholder="日"
              maxLength={2}
              className="w-14 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-center text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
            />
            <button
              onClick={handleDateJump}
              disabled={!dateYear}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-sm font-bold rounded-lg transition-all active:scale-95 ml-1"
            >
              跳转
            </button>
          </div>
        )}

        {/* Search Panel */}
        {showSearch && (
          <div className="flex items-center gap-2 p-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg animate-in">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="搜索记录标题、标签、内容..."
              className="flex-1 px-2 py-2 bg-transparent text-sm text-gray-700 dark:text-gray-200 outline-none placeholder:text-gray-400"
              autoFocus
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); setSearchKeyword(''); }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 transition-all"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 transition-opacity duration-500">
          <Clock size={48} className="mb-4 opacity-20" />
          <p className="text-lg font-medium">尚无记录，开始记录你的生活吧 ✨</p>
        </div>
      ) : filteredEntries.length === 0 && searchKeyword ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 transition-opacity duration-500">
          <Search size={48} className="mb-4 opacity-20" />
          <p className="text-lg font-medium">未找到包含 "{searchKeyword}" 的记录</p>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredEntries.slice(0, visibleCount).map((entry, eIdx) => {
            // ── Travel Card ──
            if (entry.type === 'travel') {
              const record = entry.record;
              const extra = record.extra_data as TravelMetadata;
              const startFmt = formatDate(entry.startDate);
              const endFmt = formatDate(entry.endDate);
              const year = entry.startDate.split('-')[0];
              const prevEntry = eIdx > 0 ? filteredEntries[eIdx - 1] : null;
              const prevYear = prevEntry ? (prevEntry.type === 'date' ? prevEntry.dateStr : prevEntry.startDate).split('-')[0] : null;
              const isNewYear = year !== prevYear;

              // Group linked records by date for sub-timeline
              const linkedByDate = new Map<string, EventRecord[]>();
              for (const lr of entry.linkedRecords) {
                const ds = lr.dateStr;
                if (!linkedByDate.has(ds)) linkedByDate.set(ds, []);
                linkedByDate.get(ds)!.push(lr);
              }
              const linkedDateGroups = Array.from(linkedByDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));

              return (
                <div
                  key={`travel-${record.id}`}
                  className="relative group"
                  ref={(el) => { if (el) dateGroupRefs.current.set(entry.startDate, el); }}
                >
                  {/* Year Divider */}
                  {isNewYear && (
                    <div className="flex items-center gap-4 py-16">
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent" />
                      <span className="text-3xl font-black text-slate-300 dark:text-gray-600 tracking-[0.4em] uppercase italic">
                        {year}
                      </span>
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent" />
                    </div>
                  )}

                  {/* Travel Date Range Header */}
                  <div className="flex items-baseline gap-3 mb-4 pl-1 px-2 -ml-2">
                    <Palmtree size={18} className="text-emerald-500 shrink-0 relative top-0.5" />
                    <span className="text-2xl font-black tracking-tighter" style={{ color: 'var(--text-color)' }}>
                      {startFmt.day}
                    </span>
                    <span className="text-lg font-bold text-slate-400 dark:text-slate-300 italic tracking-tight uppercase">{startFmt.monthName}</span>
                    <span className="text-xl font-black text-slate-300 dark:text-slate-500">~</span>
                    <span className="text-2xl font-black tracking-tighter" style={{ color: 'var(--text-color)' }}>
                      {endFmt.day}
                    </span>
                    <span className="text-lg font-bold text-slate-400 dark:text-slate-300 italic tracking-tight uppercase">{endFmt.monthName}</span>
                  </div>

                  {/* Travel Card Container */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.03)] border border-emerald-200/50 dark:border-emerald-700/30 overflow-hidden transition-all hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)]">
                    <div className="p-4 sm:p-6">
                      <div className="flex gap-4">
                        {/* Accent Line */}
                        <div className="w-1.5 rounded-full shrink-0" style={{ backgroundColor: record.color?.bg || '#10b981' }} />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {getCategoryIcon(record.parent_tag || "", record.color?.text || record.color?.bg)}
                                <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100 leading-tight">
                                  <HighlightText text={record.title} keyword={kw} />
                                </h3>
                              </div>

                              {/* Travel metadata panel — only show if there's content */}
                              {((extra.destinations && extra.destinations.length > 0) || extra.totalSpend || (extra.attractions && extra.attractions.length > 0) || (extra.railways && extra.railways.length > 0) || (extra.flights && extra.flights.length > 0) || (extra.hotels && extra.hotels.length > 0)) && (
                              <div className="mt-3 flex flex-col gap-1.5 py-3 px-4 bg-emerald-50/40 dark:bg-emerald-900/10 rounded-lg border border-emerald-100/50 dark:border-emerald-800/30 overflow-hidden">
                                {/* Railway rows */}
                                {extra.railways && extra.railways.filter(r => r.trainNo).length > 0 && (
                                  <div className="flex items-start gap-4 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                                    <div className="w-3.5 flex justify-center shrink-0 mt-0.5"><TrainFront size={12} /></div>
                                    <span className="flex-1">{extra.railways.filter(r => r.trainNo).map(r => `${r.trainNo}${r.seat ? ' ' + r.seat : ''}`).join(' | ')}</span>
                                  </div>
                                )}
                                {/* Flight rows */}
                                {extra.flights && extra.flights.filter(f => f.flightNo || f.airline).length > 0 && (
                                  <div className="flex items-start gap-4 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                                    <div className="w-3.5 flex justify-center shrink-0 mt-0.5"><Plane size={12} /></div>
                                    <span className="flex-1">{extra.flights.filter(f => f.flightNo || f.airline).map(f => `${f.airline} ${f.flightNo}${f.departAirport && f.arriveAirport ? ' ' + f.departAirport + '→' + f.arriveAirport : ''}`).join(' | ')}</span>
                                  </div>
                                )}
                                {/* Hotel rows */}
                                {extra.hotels && extra.hotels.filter(h => h.name).length > 0 && (
                                  <div className="flex items-start gap-4 text-xs text-emerald-700/80 dark:text-emerald-300/80 min-w-0">
                                    <div className="w-3.5 flex justify-center shrink-0 mt-0.5"><Hotel size={12} /></div>
                                    <span className="flex-1 truncate">{extra.hotels.map(h => h.name).join(' | ')}</span>
                                  </div>
                                )}
                                {extra.destinations && extra.destinations.length > 0 && (
                                  <div className="flex items-start gap-4 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                                    <div className="w-3.5 flex justify-center shrink-0 mt-0.5"><MapPin size={12} /></div>
                                    <span className="flex-1">{extra.destinations.join('、')}</span>
                                  </div>
                                )}
                                {extra.totalSpend && (
                                  <div className="flex items-start gap-4 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                                    <div className="w-3.5 flex justify-center shrink-0 mt-0.5"><Ticket size={12} /></div>
                                    <span className="flex-1">￥{parseFloat(Number(extra.totalSpend).toFixed(2))}</span>
                                  </div>
                                )}
                                {extra.attractions && extra.attractions.length > 0 && (
                                  <div className="flex items-start gap-4 text-xs text-emerald-700/80 dark:text-emerald-300/80 min-w-0">
                                    <div className="w-3.5 flex justify-center shrink-0 mt-0.5"><Landmark size={11} /></div>
                                    <span className="flex-1 min-w-0" style={{wordBreak: 'break-word'}}>{extra.attractions.map((att, aIdx) => (<React.Fragment key={aIdx}>{aIdx > 0 && <span className="mx-1 opacity-60">|</span>}<HighlightText text={att.name} keyword={kw} /></React.Fragment>))}</span>
                                  </div>
                                )}
                              </div>
                              )}

                              {/* Tags */}
                              {(() => {
                                const names = (record.tag_names ?? []).filter(n => n !== record.parent_tag);
                                if (names.length === 0) return null;
                                return (
                                  <div className="flex flex-wrap gap-1.5 mt-3">
                                    {names.map((name: string) => (
                                      <span key={name} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                        <HighlightText text={name} keyword={kw} />
                                      </span>
                                    ))}
                                  </div>
                                );
                              })()}

                              {/* Reflection */}
                              {record.reflection && (
                                <div className="mt-4 text-sm text-slate-600 dark:text-gray-400 leading-relaxed whitespace-normal break-all font-medium w-full">
                                  <HighlightText text={record.reflection} keyword={kw} />
                                </div>
                              )}
                            </div>

                            {/* Edit Button */}
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <button 
                                onClick={() => onEditRecord(record, record.dateStr)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-slate-400 hover:text-blue-500 transition-all active:scale-90"
                                title="编辑记录"
                              >
                                <Edit3 size={18} />
                              </button>
                            </div>
                          </div>

                          {/* Images */}
                          {record.imageUrls && record.imageUrls.length > 0 && (
                            <div className={`mt-5 rounded-2xl overflow-hidden grid gap-1 ${
                              record.imageUrls.length === 1 ? 'grid-cols-1' : 
                              record.imageUrls.length === 2 ? 'grid-cols-2 aspect-[16/9]' :
                              'grid-cols-2 aspect-square'
                            }`}>
                              {record.imageUrls.slice(0, 4).map((url: string, i: number) => (
                                <div 
                                  key={i} 
                                  className={`relative cursor-zoom-in group/img overflow-hidden ${
                                    record.imageUrls.length === 3 && i === 0 ? 'row-span-2' : ''
                                  }`}
                                  onClick={() => onPreviewImage(url)}
                                >
                                  <img 
                                    src={url} 
                                    alt="gallery" 
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover transition-all duration-500 group-hover/img:scale-110 group-hover/img:brightness-110"
                                  />
                                  {record.imageUrls.length > 4 && i === 3 && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white font-bold text-lg">
                                      +{record.imageUrls.length - 4}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* ── Nested Sub-Timeline: Linked Records ── */}
                          {linkedDateGroups.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-emerald-100/50 dark:border-emerald-800/30">
                              <div className="text-xs text-emerald-600/70 dark:text-emerald-400/60 font-bold mb-3 flex items-center gap-1.5">
                                🗂️ 关联记录 ({entry.linkedRecords.length})
                              </div>
                              <div className="relative pl-4 border-l-2 border-emerald-200/50 dark:border-emerald-700/30 space-y-4">
                                {linkedDateGroups.map(([subDate, subItems]) => {
                                  const subFmt = formatDate(subDate);
                                  return (
                                    <div key={subDate}>
                                      {/* Sub-date header */}
                                      <div className="flex items-baseline gap-2 mb-2 -ml-[21px]">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60 dark:bg-emerald-500/40 shrink-0 ring-2 ring-white dark:ring-gray-800" />
                                        <span className="text-sm font-bold text-slate-700 dark:text-gray-300">{subFmt.day}</span>
                                        <span className="text-xs text-slate-400 italic">{subFmt.monthName}</span>
                                        <span className="text-[10px] text-slate-300 dark:text-slate-500">{subFmt.weekday}</span>
                                      </div>
                                      {/* Sub-record cards — full card style matching main timeline */}
                                      <div className="space-y-3">
                                        {subItems.map(lr => {
                                          const lrTheaterExtra = lr.extra_data as TheaterMetadata | undefined;
                                          const lrFoodExtra = lr.extra_data as FoodMetadata | undefined;
                                          const lrExtraAny = lr.extra_data as any;
                                          const lrIsTheaterTag = lr.parent_tag === '演出模式';
                                          const lrIsFoodTag = lr.parent_tag === '美食模式';
                                          
                                          const score = lrIsTheaterTag && isTheaterMode
                                            ? lrTheaterExtra?.score
                                            : lrIsFoodTag
                                              ? lrFoodExtra?.rating
                                              : null;

                                          return (
                                            <div
                                              key={lr.id}
                                              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700/50 overflow-hidden shadow-sm"
                                            >
                                              <div className="p-3 sm:p-4">
                                                <div className="flex gap-3">
                                                  <div className="w-1 rounded-full shrink-0" style={{ backgroundColor: lr.color?.bg || '#cbd5e1' }} />
                                                  <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start gap-3">
                                                      <div className="flex-1 min-w-0">
                                                        {/* Title */}
                                                        <div className="flex items-center gap-1.5">
                                                          {getCategoryIcon(lr.parent_tag || '', lr.color?.text || lr.color?.bg)}
                                                          <h4 className="text-sm font-bold text-slate-800 dark:text-gray-100 leading-tight">
                                                            <HighlightText text={lr.title} keyword={kw} />
                                                          </h4>
                                                        </div>

                                                        {/* Theater Metadata */}
                                                        {(() => {
                                                          if (!isTheaterMode || !lrIsTheaterTag) return null;
                                                          const ex = lrTheaterExtra;
                                                          if (!ex) return null;
                                                          const cityVal = Array.isArray(ex.city) ? ex.city.filter(Boolean).join(' · ') : (ex.city || '');
                                                          const hasInfo = !!(cityVal || ex.theater || ex.price || ex.club || ex.unit || ex.type || ex.seat || ex.actors);
                                                          if (!hasInfo) return null;
                                                          return (
                                                            <div className="mt-2 flex flex-col gap-1 py-2 px-3 bg-purple-50/40 dark:bg-purple-900/10 rounded-lg border border-purple-100/50 dark:border-purple-800/30">
                                                              {(cityVal || ex.theater) && (
                                                                <div className="flex items-start gap-3 text-xs text-purple-700/80 dark:text-purple-300/80">
                                                                  <div className="w-3 flex justify-center shrink-0 mt-0.5"><MapPin size={11} /></div>
                                                                  <span className="flex-1"><HighlightText text={[cityVal, ex.theater].filter(Boolean).join(' · ')} keyword={kw} /></span>
                                                                </div>
                                                              )}
                                                              {(ex.club || ex.unit || ex.type) && (
                                                                <div className="flex items-start gap-3 text-xs text-purple-600/90 dark:text-purple-400/90">
                                                                  <div className="w-3 flex justify-center shrink-0 mt-0.5"><Building2 size={11} /></div>
                                                                  <div className="flex-1 flex flex-wrap gap-2">
                                                                    {ex.club && <span><HighlightText text={ex.club} keyword={kw} /></span>}
                                                                    {ex.unit && <span><HighlightText text={ex.unit} keyword={kw} /></span>}
                                                                    {ex.type && <span className="px-1 py-0.5 bg-purple-100 dark:bg-purple-800/50 rounded text-[9px] uppercase font-bold"><HighlightText text={ex.type} keyword={kw} /></span>}
                                                                  </div>
                                                                </div>
                                                              )}
                                                              {ex.actors && (
                                                                <div className="flex items-start gap-3 text-xs text-purple-600/80 dark:text-purple-400/80">
                                                                  <div className="w-3 flex justify-center shrink-0 mt-0.5"><Users size={11} /></div>
                                                                  <span className="flex-1"><HighlightText text={ex.actors.split(/[,，、；;.。\s\t\/|｜]+/).filter(Boolean).join(' | ')} keyword={kw} /></span>
                                                                </div>
                                                              )}
                                                              {(ex.price || ex.seat) && (
                                                                <div className="flex items-start gap-3">
                                                                  <div className="w-3 flex justify-center shrink-0 mt-0.5"><Ticket size={11} className="text-purple-400" /></div>
                                                                  <div className="flex-1 flex flex-wrap gap-2">
                                                                    {ex.price && <span className="text-xs text-purple-700 dark:text-purple-300">¥{ex.price}</span>}
                                                                    {ex.seat && <span className="text-xs text-purple-500/80"><HighlightText text={ex.seat} keyword={kw} /></span>}
                                                                  </div>
                                                                </div>
                                                              )}
                                                            </div>
                                                          );
                                                        })()}

                                                        {/* Food Metadata */}
                                                        {(() => {
                                                          if (!lrIsFoodTag) return null;
                                                          const ex = lrFoodExtra;
                                                          if (!ex) return null;
                                                          const hasInfo = !!(ex.address || ex.price || (ex.dishes && ex.dishes.length > 0));
                                                          if (!hasInfo) return null;
                                                          return (
                                                            <div className="mt-2 flex flex-col gap-1 py-2 px-3 bg-amber-50/40 dark:bg-amber-900/10 rounded-lg border border-amber-100/50 dark:border-amber-800/30">
                                                              {ex.address && (
                                                                <div className="flex items-start gap-3 text-xs text-amber-700/80 dark:text-amber-300/80">
                                                                  <div className="w-3 flex justify-center shrink-0 mt-0.5"><MapPin size={11} /></div>
                                                                  <span className="flex-1"><HighlightText text={ex.address} keyword={kw} /></span>
                                                                </div>
                                                              )}
                                                              {ex.price && (
                                                                <div className="flex items-start gap-3 text-xs text-amber-700/80 dark:text-amber-300/80">
                                                                  <div className="w-3 flex justify-center shrink-0 mt-0.5"><Ticket size={11} /></div>
                                                                  <span className="flex-1">¥{ex.price}</span>
                                                                </div>
                                                              )}
                                                              {ex.dishes && ex.dishes.filter((d: any) => d.name).map((dish: any, dIdx: number) => (
                                                                <div key={dIdx} className="flex items-center gap-3 text-xs text-amber-700/80 dark:text-amber-300/80">
                                                                  <div className="w-3 flex justify-center shrink-0"><UtensilsCrossed size={10} /></div>
                                                                  <span className="flex-1 flex items-center gap-1">
                                                                    <span><HighlightText text={dish.name} keyword={kw} /></span>
                                                                    {dish.rating > 0 && (
                                                                      <span className="inline-flex gap-px ml-1">
                                                                        {Array.from({ length: 5 }, (_, i) => (
                                                                          <span key={i} style={{ fontSize: '9px', color: i < dish.rating ? '#f59e0b' : '#e5e7eb' }}>★</span>
                                                                        ))}
                                                                      </span>
                                                                    )}
                                                                  </span>
                                                                </div>
                                                              ))}
                                                            </div>
                                                          );
                                                        })()}

                                                        {/* Food Comment */}
                                                        {lrIsFoodTag && lrFoodExtra?.comment && (
                                                          <div className="mt-2 text-xs text-slate-600 dark:text-gray-400 leading-relaxed">
                                                            <HighlightText text={lrFoodExtra.comment} keyword={kw} />
                                                          </div>
                                                        )}

                                                        {/* Reflection */}
                                                        {lr.reflection && (
                                                          <div className="mt-2 text-xs text-slate-600 dark:text-gray-400 leading-relaxed whitespace-normal break-all">
                                                            <HighlightText text={lr.reflection} keyword={kw} />
                                                          </div>
                                                        )}

                                                        {/* Location */}
                                                        {lrExtraAny?.location?.name && (
                                                          <div className="mt-1.5 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                                                            <MapPin size={10} className="shrink-0" />
                                                            <span>{lrExtraAny.location.name}{lrExtraAny.location.address ? ` · ${lrExtraAny.location.address}` : ''}</span>
                                                          </div>
                                                        )}

                                                        {/* Tags */}
                                                        {(() => {
                                                          const subNames = (lr.tag_names ?? []).filter(n => n !== lr.parent_tag);
                                                          if (subNames.length === 0) return null;
                                                          return (
                                                            <div className="flex flex-wrap gap-1 mt-2">
                                                              {subNames.map(n => (
                                                                <span key={n} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded-full text-[9px] font-bold uppercase tracking-wider">
                                                                  <HighlightText text={n} keyword={kw} />
                                                                </span>
                                                              ))}
                                                            </div>
                                                          );
                                                        })()}
                                                      </div>

                                                      {/* Star Rating + Edit */}
                                                      <div className="flex flex-col items-end gap-2 shrink-0">
                                                        {score && (
                                                          <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center border shadow-sm ${
                                                            lrIsFoodTag
                                                              ? 'bg-amber-50 border-amber-100/50 text-amber-600 dark:bg-amber-900/20 dark:border-amber-800/50 dark:text-amber-400'
                                                              : 'bg-purple-50 border-purple-100/50 text-purple-600 dark:bg-purple-900/20 dark:border-purple-800/50 dark:text-purple-400'
                                                          }`}>
                                                            <span className="text-xs font-black italic tabular-nums leading-none">{score.toFixed(1)}</span>
                                                          </div>
                                                        )}
                                                        <button
                                                          onClick={(e) => { e.stopPropagation(); onEditRecord(lr, lr.dateStr); }}
                                                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-slate-400 hover:text-blue-500 transition-all active:scale-90"
                                                        >
                                                          <Edit3 size={14} />
                                                        </button>
                                                      </div>
                                                    </div>

                                                    {/* Full-width image grid */}
                                                    {lr.imageUrls && lr.imageUrls.length > 0 && (
                                                      <div className={`mt-3 rounded-xl overflow-hidden grid gap-1 ${
                                                        lr.imageUrls.length === 1 ? 'grid-cols-1' :
                                                        lr.imageUrls.length === 2 ? 'grid-cols-2 aspect-[16/9]' :
                                                        'grid-cols-2 aspect-square'
                                                      }`}>
                                                        {lr.imageUrls.slice(0, 4).map((url, i) => (
                                                          <div
                                                            key={i}
                                                            className={`relative cursor-zoom-in group/img overflow-hidden ${lr.imageUrls.length === 3 && i === 0 ? 'row-span-2' : ''}`}
                                                            onClick={(e) => { e.stopPropagation(); onPreviewImage(url); }}
                                                          >
                                                            <img
                                                              src={url}
                                                              alt="gallery"
                                                              loading="lazy"
                                                              decoding="async"
                                                              className="w-full h-full object-cover transition-all duration-500 group-hover/img:scale-110"
                                                            />
                                                            {lr.imageUrls.length > 4 && i === 3 && (
                                                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white font-bold text-sm">
                                                                +{lr.imageUrls.length - 4}
                                                              </div>
                                                            )}
                                                          </div>
                                                        ))}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // ── Normal Date Group ──
            const { dateStr, items } = entry;
            const { day, monthName, weekday } = formatDate(dateStr);
            const year = dateStr.split('-')[0];
            const prevEntry = eIdx > 0 ? filteredEntries[eIdx - 1] : null;
            const prevYear = prevEntry ? (prevEntry.type === 'date' ? prevEntry.dateStr : prevEntry.startDate).split('-')[0] : null;
            const isNewYear = year !== prevYear;

            return (
              <div
                key={dateStr}
                className="relative group"
                ref={(el) => { if (el) dateGroupRefs.current.set(dateStr, el); }}
              >
                {/* Year Divider */}
                {isNewYear && (
                  <div className="flex items-center gap-4 py-16">
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent" />
                    <span className="text-3xl font-black text-slate-300 dark:text-gray-600 tracking-[0.4em] uppercase italic">
                      {year}
                    </span>
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent" />
                  </div>
                )}

                {/* Date Header */}
                <div className="flex items-baseline gap-3 mb-4 pl-1 hover:bg-gray-100 dark:hover:bg-white transition-all rounded-xl px-2 -ml-2 cursor-default group/header">
                  <span className="text-3xl font-black text-slate-900 dark:text-white force-white-reverse-hover tracking-tighter">
                    {day}
                  </span>
                  <span className="text-xl font-bold text-slate-400 dark:text-slate-300 italic tracking-tight uppercase">{monthName}</span>
                  <span className="text-xs font-bold text-slate-300 dark:text-slate-400 uppercase letter-spacing-[0.1em]">{weekday}</span>
                </div>

                {/* Card Container */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.03)] border border-gray-100 dark:border-gray-700/50 overflow-hidden transition-all hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)]">
                  {items.map((record: EventRecord, index: number) => (
                    <div 
                      key={record.id} 
                      className={`p-4 sm:p-6 transition-colors ${
                        index > 0 ? 'border-t border-gray-50 dark:border-gray-700/50' : ''
                      }`}
                    >
                      <div className="flex gap-4">
                        {/* Accent Line */}
                        <div className="w-1 rounded-full shrink-0" style={{ backgroundColor: record.color?.bg || '#cbd5e1' }} />
                        
                        <div className="flex-1">
                          {/* Title & Tags */}
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                {getCategoryIcon(record.parent_tag || "", record.color?.text || record.color?.bg)}
                                <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100 leading-tight">
                                  <HighlightText text={record.title} keyword={kw} />
                                </h3>
                              </div>
                              
                              {/* --- Theater Metadata Details --- */}
                              {(() => {
                                const extra = record.extra_data as TheaterMetadata | undefined;
                                const tagNames = record.tag_names || [];
                                const isTheaterTag = record.parent_tag === '演出模式' || tagNames.some((n: string) => n === '演出模式');
                                
                                const hasVisibleExtraInfo = () => {
                                  if (!extra) return false;
                                  const cityValue = Array.isArray(extra.city) ? extra.city.filter(Boolean).join('') : (extra.city || '');
                                  return !!(
                                    cityValue || 
                                    (extra.theater && extra.theater.trim()) || 
                                    (extra.price && extra.price.toString().trim()) || 
                                    (extra.club && extra.club.trim()) ||
                                    (extra.unit && extra.unit.trim()) ||
                                    (extra.type && extra.type.trim()) ||
                                    (extra.seat && extra.seat.trim()) ||
                                    (extra.actors && extra.actors.trim())
                                  );
                                };

                                if (!isTheaterMode || !isTheaterTag || !hasVisibleExtraInfo()) return null;

                                return (
                                  <div className="mt-3 flex flex-col gap-1.5 py-3 px-4 bg-purple-50/40 dark:bg-purple-900/10 rounded-lg border border-purple-100/50 dark:border-purple-800/30">

                                    {/* Location: Province City Venue */}
                                    {(extra!.city || extra!.theater) && (
                                      <div className="flex items-start gap-4 text-xs text-purple-700/80 dark:text-purple-300/80">
                                        <div className="w-3.5 flex justify-center shrink-0 mt-0.5">
                                          <MapPin size={12} />
                                        </div>
                                        <span className="flex-1">
                                          <HighlightText text={[
                                            Array.isArray(extra!.city) ? extra!.city.filter(Boolean).join(' · ') : extra!.city, 
                                            extra!.theater
                                          ].filter(Boolean).join(' · ')} keyword={kw} />
                                        </span>
                                      </div>
                                    )}

                                  {/* Field A: Club / Unit / Type */}
                                  {(extra!.club || extra!.unit || extra!.type) && (
                                    <div className="flex items-start gap-4 text-xs text-purple-600/90 dark:text-purple-400/90 font-medium">
                                      <div className="w-3.5 flex justify-center shrink-0 mt-0.5">
                                        <Building2 size={12} />
                                      </div>
                                      <div className="flex-1 flex flex-wrap items-center gap-3">
                                        {extra!.club && <span><HighlightText text={extra!.club} keyword={kw} /></span>}
                                        {extra!.unit && <span><HighlightText text={extra!.unit} keyword={kw} /></span>}
                                        {extra!.type && (
                                          <div className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-800/50 rounded text-[10px] uppercase tracking-wider font-bold">
                                            <HighlightText text={extra!.type} keyword={kw} />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Field C: Actors */}
                                  {extra!.actors && (
                                    <div className="flex items-start gap-4 text-xs text-purple-600/80 dark:text-purple-400/80 font-medium leading-relaxed">
                                      <div className="w-3.5 flex justify-center shrink-0 mt-0.5">
                                        <Users size={12} />
                                      </div>
                                      <span className="flex-1"><HighlightText text={extra!.actors.split(/[,，、；;.。\s\t\/|｜]+/).filter(Boolean).join(' | ')} keyword={kw} /></span>
                                    </div>
                                  )}

                                  {/* Field D: Price and Seat */}
                                  {(extra!.price || extra!.seat) && (
                                    <div className="flex items-start gap-4">
                                      <div className="w-3.5 flex justify-center shrink-0 mt-0.5">
                                        <Ticket size={12} className="text-purple-400" />
                                      </div>
                                      <div className="flex-1 flex flex-wrap items-center gap-3">
                                        {extra!.price && (
                                          <div className="text-xs font-normal text-purple-700 dark:text-purple-300">
                                            ￥{extra!.price}
                                          </div>
                                        )}
                                        {extra!.seat && (
                                          <div className="text-xs font-normal text-purple-500/80">
                                            <HighlightText text={extra!.seat} keyword={kw} />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* --- Food Metadata Details --- */}
                            {(() => {
                              if (record.parent_tag !== '美食模式') return null;
                              const extra = record.extra_data as FoodMetadata | undefined;
                              if (!extra) return null;
                              
                              const hasInfo = !!(extra.address || extra.price || (extra.dishes && extra.dishes.length > 0));
                              if (!hasInfo) return null;

                              return (
                                <div className="mt-3 flex flex-col gap-1.5 py-3 px-4 bg-amber-50/40 dark:bg-amber-900/10 rounded-lg border border-amber-100/50 dark:border-amber-800/30">
                                  {extra.address && (
                                    <div className="flex items-start gap-4 text-xs text-amber-700/80 dark:text-amber-300/80">
                                      <div className="w-3.5 flex justify-center shrink-0 mt-0.5">
                                        <MapPin size={12} />
                                      </div>
                                      <span className="flex-1">
                                        <HighlightText text={extra.address} keyword={kw} />
                                      </span>
                                    </div>
                                  )}
                                  {extra.price && (
                                    <div className="flex items-start gap-4 text-xs text-amber-700/80 dark:text-amber-300/80">
                                      <div className="w-3.5 flex justify-center shrink-0 mt-0.5">
                                        <Ticket size={12} />
                                      </div>
                                      <span className="flex-1">
                                        ￥{extra.price}
                                      </span>
                                    </div>
                                  )}
                                  {extra.dishes && extra.dishes.filter(d => d.name).length > 0 && (
                                    <div className="flex flex-col gap-1 mt-1">
                                      {extra.dishes.filter(d => d.name).map((dish, dIdx) => (
                                        <div key={dIdx} className="flex items-center gap-4 text-xs text-amber-700/80 dark:text-amber-300/80">
                                          <div className="w-3.5 flex justify-center shrink-0">
                                            <UtensilsCrossed size={11} />
                                          </div>
                                          <span className="flex-1 flex items-center gap-1.5">
                                            <span><HighlightText text={dish.name} keyword={kw} /></span>
                                            {dish.rating && dish.rating > 0 && (
                                              <span className="inline-flex items-center gap-px ml-1">
                                                {Array.from({ length: 5 }, (_, i) => (
                                                  <span key={i} style={{ fontSize: '10px', color: i < dish.rating! ? '#f59e0b' : '#e5e7eb', lineHeight: 1 }}>★</span>
                                                ))}
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* --- Travel Metadata Details --- */}
                            {(() => {
                              if (record.parent_tag !== '旅行模式') return null;
                              const extra = record.extra_data as TravelMetadata | undefined;
                              if (!extra) return null;
                              
                              const hasInfo = !!((extra.destinations && extra.destinations.length > 0) || extra.totalSpend || (extra.attractions && extra.attractions.length > 0) || extra.endDate);
                              if (!hasInfo) return null;

                              return (
                                <div className="mt-3 flex flex-col gap-1.5 py-3 px-4 bg-emerald-50/40 dark:bg-emerald-900/10 rounded-lg border border-emerald-100/50 dark:border-emerald-800/30">
                                  {extra.endDate && (
                                    <div className="flex items-start gap-4 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                                      <div className="w-3.5 flex justify-center shrink-0 mt-0.5">
                                        <Clock size={12} />
                                      </div>
                                      <span className="flex-1">
                                        {extra.startDate || record.dateStr} ~ {extra.endDate}
                                      </span>
                                    </div>
                                  )}
                                  {extra.destinations && extra.destinations.length > 0 && (
                                    <div className="flex items-start gap-4 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                                      <div className="w-3.5 flex justify-center shrink-0 mt-0.5">
                                        <MapPin size={12} />
                                      </div>
                                      <span className="flex-1">
                                        {extra.destinations.join('、')}
                                      </span>
                                    </div>
                                  )}
                                  {extra.totalSpend && (
                                    <div className="flex items-start gap-4 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                                      <div className="w-3.5 flex justify-center shrink-0 mt-0.5">
                                        <Ticket size={12} />
                                      </div>
                                      <span className="flex-1">
                                        ￥{parseFloat(Number(extra.totalSpend).toFixed(2))}
                                      </span>
                                    </div>
                                  )}
                                  {extra.attractions && extra.attractions.length > 0 && (
                                    <div className="flex items-start gap-4 text-xs text-emerald-700/80 dark:text-emerald-300/80 min-w-0">
                                      <div className="w-3.5 flex justify-center shrink-0 mt-0.5"><Landmark size={11} /></div>
                                      <span className="flex-1 min-w-0" style={{wordBreak: 'break-word'}}>{extra.attractions.map((att, aIdx) => (<React.Fragment key={aIdx}>{aIdx > 0 && <span className="mx-1 opacity-60">|</span>}<HighlightText text={att.name} keyword={kw} /></React.Fragment>))}</span>
                                    </div>
                                  )}
                                  {/* Linked Records in saved order */}
                                  {extra.linkedRecordIds && extra.linkedRecordIds.length > 0 && (() => {
                                    const linkedRecs = extra.linkedRecordIds
                                      .map((id: string) => records.find(r => r.id === id))
                                      .filter(Boolean) as EventRecord[];
                                    if (linkedRecs.length === 0) return null;
                                    return (
                                      <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-emerald-100/50 dark:border-emerald-800/30">
                                        <div className="text-[10px] text-emerald-500/70 font-bold mb-0.5">🔗 关联记录</div>
                                        {linkedRecs.map((lr, lIdx) => {
                                          let icon = '📝';
                                          if (lr.parent_tag === '演出模式') icon = '🎭';
                                          if (lr.parent_tag === '美食模式') icon = '🍽️';
                                          return (
                                            <div key={lIdx} className="flex items-center gap-2 text-xs text-emerald-700/80 dark:text-emerald-300/80 pl-1">
                                              <span className="text-[10px] text-gray-400 font-mono w-4 text-center shrink-0">{lIdx + 1}</span>
                                              <span>{icon}</span>
                                              <span className="flex-1 truncate">
                                                <HighlightText text={lr.title} keyword={kw} />
                                              </span>
                                              <span className="text-[10px] text-emerald-500/50 shrink-0">{lr.dateStr}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            })()}

                            {/* Food Comment (between info badge and tags) */}
                            {(() => {
                              if (record.parent_tag !== '美食模式') return null;
                              const extra = record.extra_data as FoodMetadata | undefined;
                              if (!extra?.comment) return null;
                              return (
                                <div className="mt-3 text-sm text-slate-600 dark:text-gray-400 leading-relaxed whitespace-normal break-words overflow-hidden font-medium w-full">
                                  <HighlightText text={extra.comment} keyword={kw} />
                                </div>
                              );
                            })()}
                              {/* Reflection / Review Text */}
                              {record.reflection && (
                                <div className="mt-4 text-sm text-slate-600 dark:text-gray-400 leading-relaxed whitespace-normal break-all overflow-wrap-anywhere font-medium w-full">
                                  <HighlightText text={record.reflection} keyword={kw} />
                                </div>
                              )}

                              {/* Location Display — Normal mode only */}
                              {(() => {
                                const extra = record.extra_data as any;
                                if (!extra?.location?.name) return null;
                                return (
                                  <div className="mt-2 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                                    <MapPin size={11} className="shrink-0" />
                                    <span>{extra.location.name}{extra.location.address ? ` · ${extra.location.address}` : ''}</span>
                                  </div>
                                );
                              })()}

                              {/* Tags Area (Phase 163: Filter out redundant parent tags) */}
                              {(() => {
                                const names = (record.tag_names ?? []).filter(n => n !== record.parent_tag);
                                if (names.length === 0) return null;
                                return (
                                  <div className="flex flex-wrap gap-1.5 mt-3">
                                    {names.map((name: string) => (
                                      <span key={name} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                        <HighlightText text={name} keyword={kw} />
                                      </span>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                            
                            <div className="flex flex-col items-end gap-2 shrink-0">
                                {/* Star Rating Display (Theater & Food) */}
                                {(() => {
                                  const theaterExtra = record.extra_data as TheaterMetadata | undefined;
                                  const foodExtra = record.extra_data as FoodMetadata | undefined;
                                  
                                  const score = (record.parent_tag === '演出模式' && isTheaterMode) 
                                    ? theaterExtra?.score 
                                    : (record.parent_tag === '美食模式') 
                                      ? foodExtra?.rating 
                                      : null;

                                  if (!score) return null;
                                  const isFood = record.parent_tag === '美食模式';

                                  return (
                                    <div className="flex flex-col items-end">
                                      <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center border shadow-sm transition-all hover:scale-105 cursor-default ${
                                        isFood 
                                          ? 'bg-amber-50 border-amber-100/50 text-amber-600 dark:bg-amber-900/20 dark:border-amber-800/50 dark:text-amber-400' 
                                          : 'bg-purple-50 border-purple-100/50 text-purple-600 dark:bg-purple-900/20 dark:border-purple-800/50 dark:text-purple-400'
                                      }`}>
                                        <span className="text-base font-black italic tabular-nums leading-none tracking-tighter">
                                          {score.toFixed(1)}
                                        </span>
                                        <div className="flex gap-px mt-0.5">
                                          {[1, 2, 3, 4, 5].map(s => (
                                            <span 
                                              key={s} 
                                              style={{ fontSize: '10px', lineHeight: 1, color: s <= score ? (isFood ? '#f59e0b' : '#a855f7') : '#d1d5db' }}
                                            >★</span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                              
                              {/* Edit Button */}
                              <button 
                                onClick={() => onEditRecord(record, record.dateStr)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-slate-400 hover:text-blue-500 transition-all active:scale-90"
                                title="编辑记录"
                              >
                                <Edit3 size={18} />
                              </button>
                            </div>
                          </div>


                          {/* Image Grid (Ins Style) */}
                          {record.imageUrls && record.imageUrls.length > 0 && (
                            <div className={`mt-5 rounded-2xl overflow-hidden grid gap-1 ${
                              record.imageUrls.length === 1 ? 'grid-cols-1' : 
                              record.imageUrls.length === 2 ? 'grid-cols-2 aspect-[16/9]' :
                              'grid-cols-2 aspect-square'
                            }`}>
                              {record.imageUrls.slice(0, 4).map((url: string, i: number) => (
                                <div 
                                  key={i} 
                                  className={`relative cursor-zoom-in group/img overflow-hidden ${
                                    record.imageUrls.length === 3 && i === 0 ? 'row-span-2' : ''
                                  }`}
                                  onClick={() => onPreviewImage(url)}
                                >
                                  <img 
                                    src={url} 
                                    alt="gallery" 
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover transition-all duration-500 group-hover/img:scale-110 group-hover/img:brightness-110"
                                  />
                                  {record.imageUrls.length > 4 && i === 3 && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white font-bold text-lg">
                                      +{record.imageUrls.length - 4}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Progressive loading sentinel */}
      {filteredEntries.length > visibleCount && (
        <div ref={sentinelRef} className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
            <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin" />
            正在加载更多记录... ({visibleCount}/{filteredEntries.length})
          </div>
        </div>
      )}
      {filteredEntries.length > 0 && visibleCount >= filteredEntries.length && filteredEntries.length > INITIAL_LOAD && (
        <div className="text-center py-6 text-xs text-gray-300 dark:text-gray-600">已加载全部 {filteredEntries.length} 条记录</div>
      )}
    </div>
  );
}

export const TimelineView = memo(TimelineViewInner);
