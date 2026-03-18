import { useState, memo, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, Download, Utensils, Sticker, Theater, Palmtree } from 'lucide-react';
import { useCalendarData } from '../hooks/useCalendarData';
import { ShareModal } from './ShareModal';
import html2canvas from 'html2canvas';
import { getPosterSafeColor } from '../utils/colors';
import type { CalendarRecord, RecordTag, EventRecord, DailyRecord, TravelMetadata } from '../types';

interface CalendarProps {
  onOpenModal: (date: Date | null, recordToEdit?: {record: CalendarRecord, dateStr: string}) => void;
  records: CalendarRecord[];
  tags: RecordTag[];
  onUpdateRecord: (record: CalendarRecord) => void;
  hideAllSpecialEvents: boolean;
  isShareModalOpen?: boolean;
  onCloseShareModal?: () => void;
  showRainbowBorder: boolean;
  isHabitMode: boolean;
}

// --- Sub-components (Memoized) ---

interface HabitSquareProps {
  record: DailyRecord;
  dateStr: string;
  onUpdate: (record: CalendarRecord) => void;
}

const HabitSquare = memo(({ record, dateStr, onUpdate }: HabitSquareProps) => {
  const isCompleted = (record.completedDates || []).includes(dateStr);
  const firstChar = record.content?.charAt(0) || '?';

  return (
    <div
      title={record.content}
      onClick={(e) => {
        e.stopPropagation();
        onUpdate({
          ...record,
          completedDates: isCompleted
            ? (record.completedDates || []).filter(d => d !== dateStr)
            : [...(record.completedDates || []), dateStr]
        });
      }}
      className={`w-5 h-5 md:aspect-square md:w-full md:h-auto rounded-sm md:rounded-md transition-all duration-200 shrink-0 flex items-center justify-center text-[11px] md:text-sm font-bold select-none active:scale-90 hover:scale-110
        ${isCompleted
          ? 'border-[1.5px] border-transparent'
          : 'bg-[var(--habit-unchecked-bg)] border-[1.5px] border-dashed border-gray-300 text-[var(--habit-unchecked-text)] dark:hover:bg-gray-200'}
      `}
      style={isCompleted ? { 
        backgroundColor: record.color?.bg, 
        color: record.color?.text,
        boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.1)' 
      } : {}}
    >
      {firstChar}
    </div>
  );
});

const MobileHabitSquare = memo(({ record, dateStr, onUpdate }: HabitSquareProps) => {
  const isCompleted = (record.completedDates || []).includes(dateStr);
  const firstChar = record.content?.charAt(0) || '?';

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onUpdate({
          ...record,
          completedDates: isCompleted
            ? (record.completedDates || []).filter(d => d !== dateStr)
            : [...(record.completedDates || []), dateStr]
        });
      }}
      className={`w-[38px] h-[38px] rounded-lg flex items-center justify-center text-xs font-bold transition-all
        ${isCompleted
          ? 'border border-transparent'
          : 'bg-[var(--habit-unchecked-bg)] text-[var(--habit-unchecked-text)] border border-dashed border-gray-200 dark:hover:bg-gray-200'}`}
      style={isCompleted ? { 
        backgroundColor: record.color?.bg, 
        color: record.color?.text,
        boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.05)'
      } : {}}
    >
      {firstChar}
    </div>
  );
});

interface TravelCoverageInfo {
  recordId: string;
  color: string;
  isStart: boolean;
  isEnd: boolean;
  isRowStart: boolean;
  isRowEnd: boolean;
}

interface DayCellProps {
  date: Date;
  dateStr: string;
  isToday: boolean;
  dailyRecords: DailyRecord[];
  dayEvents: EventRecord[];
  showRainbowBorder: boolean;
  isHabitMode: boolean;
  travelColor?: string;
  travelIsFirst?: boolean;
  travelIsLast?: boolean;
  onOpenModal: (date: Date | null, recordToEdit?: { record: CalendarRecord, dateStr: string }) => void;
  onUpdateRecord: (record: CalendarRecord) => void;
  getRecordTagsString: (record: EventRecord) => string;
  getCategoryIcon: (parentTag: string, customColor?: string) => React.ReactNode;
}

const DesktopDayCell = memo(({ 
  date, 
  dateStr, 
  isToday, 
  dailyRecords, 
  dayEvents, 
  showRainbowBorder, 
  isHabitMode,
  onOpenModal, 
  onUpdateRecord,
  getRecordTagsString,
  getCategoryIcon
}: DayCellProps) => {
  const totalHabits = dailyRecords.length;
  const completedHabits = dailyRecords.filter(r => (r.completedDates || []).includes(dateStr)).length;
  const progress = (totalHabits > 0 && isHabitMode) ? Math.round((completedHabits / totalHabits) * 100) : 0;
  const isCompletedAll = isHabitMode && totalHabits > 0 && progress === 100;

  return (
    <div
      onClick={() => onOpenModal(date)}
      style={{ 
        '--rainbow-progress': `${progress}%`,
        backdropFilter: 'blur(8px)',
        boxShadow: isToday ? 'inset 0 0 0 var(--today-border-width) var(--today-border)' : (progress > 0 ? 'var(--cell-glow)' : 'none'),
        height: 'auto !important',
        minHeight: '0 !important',
        aspectRatio: '1/1',
        overflow: 'visible !important'
      } as React.CSSProperties}
      className={`group relative rounded-xl flex flex-col transition-all duration-200 ease-out cursor-pointer
        pb-3
        ${progress > 0 && showRainbowBorder
          ? 'rainbow-card border-transparent p-1' 
          : 'border border-[var(--cell-border)]'}
        ${isCompletedAll && showRainbowBorder ? 'rainbow-card-complete' : ''}
        ${progress === 0 || !isHabitMode ? 'bg-[var(--cell-bg)] hover:bg-white/10' : 'bg-[var(--cell-bg)]'}
        hover:scale-105 hover:z-20 hover:shadow-lg active:scale-95 hover:ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-gray-950`}
    >
      <div className="flex justify-between items-start w-full px-1 md:px-1.5 pt-1.5 md:pt-2 mb-0.5 md:mb-1 shrink-0 z-10">
        <span className={`text-[11px] md:text-lg font-bold md:font-bold leading-none`}
              style={isToday ? { color: 'var(--today-date-text)' } : { color: 'var(--cell-text)' }}>
          {date.getDate()}
        </span>
      </div>

      <div className="habit-container flex flex-wrap md:grid md:grid-cols-4 gap-0.5 md:gap-1 p-0.5 md:p-1 w-full shrink-0 content-start">
        {isHabitMode && dailyRecords.map(record => (
          <HabitSquare
            key={`habit-${record.id}`}
            record={record}
            dateStr={dateStr}
            onUpdate={onUpdateRecord}
          />
        ))}
      </div>

      {dailyRecords.length > 0 && dayEvents.length > 0 && (
        <div className="w-[85%] mx-auto border-t border-gray-100 dark:border-gray-800/80 my-2" />
      )}

      <div className="event-container flex flex-col gap-2 p-0.5 md:p-1">
        {dayEvents.map(record => (
          <div
            key={`special-${record.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenModal(date, { record, dateStr });
            }}
            className="text-[9px] md:text-xs px-1.5 py-1 rounded shadow-sm text-left font-medium w-full hover:brightness-95 transition-all break-words flex items-center gap-1.5"
            style={{ backgroundColor: record.color?.bg, color: record.color?.text }}
          >
            {getCategoryIcon(record.parent_tag || "", record.color?.text || record.color?.bg)}
            <span className="truncate">{record.title || getRecordTagsString(record)}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

const MobileDayCell = memo(({ 
  date, 
  dateStr, 
  isToday, 
  dailyRecords, 
  dayEvents, 
  showRainbowBorder, 
  isHabitMode,
  travelColor,
  travelIsFirst = true,
  travelIsLast = true,
  onOpenModal, 
  onUpdateRecord,
  getRecordTagsString,
  getCategoryIcon
}: DayCellProps) => {
  const totalHabits = dailyRecords.length;
  const completedHabits = dailyRecords.filter(r => (r.completedDates || []).includes(dateStr)).length;
  const progress = (totalHabits > 0 && isHabitMode) ? Math.round((completedHabits / totalHabits) * 100) : 0;
  const isCompletedAll = isHabitMode && totalHabits > 0 && progress === 100;
  const shortWeekday = date.toLocaleDateString('en-US', { weekday: 'short' });

  return (
    <div className="relative">
      {/* Travel left-side color indicator — extends into gap for continuity */}
      {travelColor && (
        <div
          className="absolute left-0 w-[4px] z-10 travel-dashed-frame"
          style={{
            backgroundColor: travelColor,
            top: travelIsFirst ? '4px' : '-10px',
            bottom: travelIsLast ? '4px' : '-10px',
            borderRadius: `${travelIsFirst ? '4px' : '0'} ${travelIsFirst ? '4px' : '0'} ${travelIsLast ? '4px' : '0'} ${travelIsLast ? '4px' : '0'}`,
          }}
        />
      )}
      <div 
        onClick={() => onOpenModal(date)}
        style={{ 
          '--rainbow-progress': `${progress}%`,
          backdropFilter: 'blur(8px)',
          boxShadow: isToday ? 'inset 0 0 0 var(--today-border-width) var(--today-border)' : (progress > 0 ? 'var(--cell-glow)' : 'none')
        } as React.CSSProperties}
        className={`relative flex w-full min-h-[112px] rounded-xl shadow-sm bg-[var(--cell-bg)] active:scale-[0.98] transition-all duration-200 
          ${progress > 0 && showRainbowBorder 
            ? 'rainbow-card border-transparent p-1' 
            : 'border border-[var(--cell-border)]'} 
          ${isCompletedAll && showRainbowBorder ? 'rainbow-card-complete' : ''}
        `}
      >
      <div className="w-16 shrink-0 flex flex-col items-center justify-center border-r bg-[var(--cell-bg)] border-[var(--cell-border)]">
        <span className={`text-2xl font-black leading-none tracking-tight`}
              style={isToday ? { color: 'var(--today-date-text)' } : { color: 'var(--cell-text)' }}>
          {date.getDate()}
        </span>
        <span className={`text-[10px] font-bold mt-1 uppercase tracking-widest`}
              style={isToday ? { color: 'var(--today-weekday-text)' } : { color: 'var(--weekday-text)' }}>
          {shortWeekday}
        </span>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-[var(--cell-bg)]">
        <div className={`px-2.5 py-1.5 flex-1 flex flex-wrap gap-1 items-center content-center bg-[var(--cell-bg)]
          ${(isHabitMode && dailyRecords.length > 0 && dayEvents.length > 0) ? 'border-b border-[var(--cell-border)]' : ''}`}>
          {isHabitMode && dailyRecords.map(record => (
            <MobileHabitSquare
              key={`mobile-habit-${record.id}`}
              record={record}
              dateStr={dateStr}
              onUpdate={onUpdateRecord}
            />
          ))}

        </div>

        {dayEvents.length > 0 && (
          <div className="px-2.5 py-1.5 flex flex-col gap-2 justify-center bg-[var(--cell-bg)]">
            {dayEvents.map(record => (
              <div
                key={`mobile-special-${record.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenModal(date, { record, dateStr });
                }}
                className="min-h-[38px] flex items-center px-3 py-2 rounded-lg shadow-sm font-bold text-left tracking-tight text-[10px] break-words gap-2"
                style={{ backgroundColor: record.color?.bg, color: record.color?.text }}
              >
                {getCategoryIcon(record.parent_tag || "", record.color?.text || record.color?.bg)}
                <span className="flex-1">{record.title || getRecordTagsString(record)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
});

function CalendarInner({ 
  onOpenModal, 
  records, 
  tags, 
  onUpdateRecord,
  hideAllSpecialEvents,
  isShareModalOpen = false,
  onCloseShareModal = () => {},
  showRainbowBorder,
  isHabitMode
}: CalendarProps) {
  const { currentMonth, weeks, setCurrentMonth, prevMonth, nextMonth } = useCalendarData();

  const [isPosterLoading, setIsPosterLoading] = useState(false);
  const [posterData, setPosterData] = useState<any>(null);
  const [posterImage, setPosterImage] = useState<string | null>(null);

  const handleStartShareGeneration = (settings: { 
    startDate: string, 
    endDate: string, 
    selectedHabitIds: string[], 
    selectedTagIds: string[],
    shareType: 'calendar' | 'achievement',
    posterTheme: 'light' | 'dark'
  }) => {
    setIsPosterLoading(true);
    
    const [sY, sM, sD] = settings.startDate.split('-').map(Number);
    const [eY, eM, eD] = settings.endDate.split('-').map(Number);
    
    // SAFE PARSING: Force midday 12:00:00 local time
    const start = new Date(sY, sM - 1, sD, 12, 0, 0);
    const end = new Date(eY, eM - 1, eD, 12, 0, 0);
    
    const monthsData = [];
    let currYear = sY;
    let currMonth = sM;
    let totalChecks = 0;
    let perfectRainbowDays = 0;
    let checkInRangeDates = new Set<string>();
    const habitStats = new Map<string, number>();
    const hourStats = new Map<number, number>();

    // WHILE LOOP MONTH GENERATION: More robust than totalMonths math
    while (currYear < eY || (currYear === eY && currMonth <= eM)) {
      const year = currYear;
      const month = currMonth;
      const firstDay = new Date(year, month - 1, 1, 12, 0, 0).getDay();
      const daysInMonth = new Date(year, month, 0).getDate();
      
      const days = Array.from({ length: daysInMonth }, (_, j) => {
        const day = j + 1;
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isWithinRange = dateStr >= settings.startDate && dateStr <= settings.endDate;

        const dayHabits = (isWithinRange && isHabitMode) ? records.filter(r => {
          if (r.type !== 'daily' || !settings.selectedHabitIds.includes(r.id)) return false;
          const dayOfWeek = new Date(year, month - 1, day, 12, 0, 0).getDay();
          const isScheduled = (!r.repeatDays || r.repeatDays.includes(dayOfWeek));
          const isDone = (r.completedDates || []).includes(dateStr);
          return isScheduled || isDone;
        }) : [];

        const doneCount = dayHabits.filter(h => {
          const isCompleted = (h as DailyRecord).completedDates?.includes(dateStr);
          if (isCompleted && isWithinRange) {
            checkInRangeDates.add(dateStr);
            const habitId = h.id;
            habitStats.set(habitId, (habitStats.get(habitId) || 0) + 1);
            
            // Use per-checkin timestamp for accurate energy period
            const daily = h as DailyRecord;
            if (daily.checkinTimestamps && daily.checkinTimestamps.length > 0) {
              // Find the timestamp for this specific date's check-in
              const dateIndex = daily.completedDates?.indexOf(dateStr);
              if (dateIndex !== undefined && dateIndex >= 0 && dateIndex < daily.checkinTimestamps.length) {
                const hour = new Date(daily.checkinTimestamps[dateIndex]).getHours();
                hourStats.set(hour, (hourStats.get(hour) || 0) + 1);
              }
            }
          }
          return isCompleted;
        }).length;

        if (isWithinRange) {
          totalChecks += doneCount;
          if (dayHabits.length > 0 && doneCount === dayHabits.length) {
            perfectRainbowDays += 1;
          }
        }

        return {
          day,
          dateStr,
          isWithinRange,
          specialEvents: [] // Habit-only focus (Phase 134)
        };
      });

      monthsData.push({
        year,
        month,
        days,
        firstDay
      });

      // Advance Month
      currMonth++;
      if (currMonth > 12) {
        currMonth = 1;
        currYear++;
      }
    }

    // 1. Longest Streak
    let longestStreak = 0;
    let currentStreak = 0;
    
    // Iterate from start to end date to find gaps
    let d = new Date(start);
    while (d <= end) {
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (checkInRangeDates.has(ds)) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
      d.setDate(d.getDate() + 1);
    }

    // 2. Habit King
    let habitKingId = '';
    let maxHabitCount = 0;
    habitStats.forEach((count, id) => {
      if (count > maxHabitCount) {
        maxHabitCount = count;
        habitKingId = id;
      }
    });
    const habitKingName = (records.find(r => r.id === habitKingId) as DailyRecord | undefined)?.content || '坚持之王';

    // 3. Energy Period
    let peakHour = 9;
    let maxHourCount = 0;
    hourStats.forEach((count, hour) => {
      if (count > maxHourCount) {
        maxHourCount = count;
        peakHour = hour;
      }
    });
    const energyLabel = peakHour < 6 ? '深夜静思' : peakHour < 11 ? '晨间达人' : peakHour < 14 ? '高效午间' : peakHour < 18 ? '午后暖阳' : '夜伴星光';

    // 4. Dopamine Score
    const dopamineScore = (totalChecks * 10) + (perfectRainbowDays * 50);

    // 5. Fun Title
    const totalDaysInRange = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const perfectRatio = perfectRainbowDays / totalDaysInRange;
    const funTitle = perfectRatio > 0.8 ? '极致自律派' : perfectRatio > 0.5 ? '时间管理者' : perfectRatio > 0.2 ? '习惯探险家' : '能量潜伏者';

    // Hardened: Pre-convert all colors to HEX to avoid html2canvas oklch issues
    const selectedHabitsExtended = (records.filter(r => settings.selectedHabitIds.includes(r.id)) as DailyRecord[])
      .map(h => ({
        ...h,
        safeColor: {
          bg: getPosterSafeColor(h.color?.bg || ''),
          text: getPosterSafeColor(h.color?.text || '')
        }
      }));

    const isDark = settings.posterTheme === 'dark';
    const theme = {
      bg: isDark ? '#1A1A1A' : '#FDFCF9',
      text: isDark ? '#ffffff' : '#0f172a',
      secondaryText: isDark ? '#a1a1aa' : '#94a3b8',
      cardBg: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
      cardBorder: isDark ? 'rgba(255, 255, 255, 0.1)' : '#f1f5f9',
      itemBorder: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc',
      accent: isDark ? '#60a5fa' : '#3b82f6',
      mutedText: isDark ? '#71717a' : '#64748b'
    };

    let rangeStr = '';
    if (sY === eY && sM === eM) {
      rangeStr = `${sY}.${sM}`;
    } else {
      rangeStr = `${sY}.${sM} - ${eY}.${eM}`;
    }

    const refinedData = {
      range: rangeStr,
      selectedHabitIds: settings.selectedHabitIds,
      selectedHabits: selectedHabitsExtended,
      startDate: start.getTime(),
      endDate: end.getTime(),
      months: monthsData,
      totalChecks,
      perfectRainbowDays,
      longestStreak,
      habitKingName,
      energyLabel,
      peakHour: `${String(peakHour).padStart(2, '0')}:00`,
      dopamineScore,
      funTitle,
      shareType: settings.shareType,
      theme,
      isDark
    };

    setPosterData(refinedData);
    
    // Hardened Step 2: Ensure library and rendering are ready
    const generate = async () => {
      // 1. Dynamic Library Check
      if (!(window as any).html2canvas) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      // 2. Rendering Delay (800ms to ensure 1200px wide poster is ready)
      await new Promise(r => setTimeout(r, 800));

      const element = document.getElementById('poster-template');
      if (!element) {
        setIsPosterLoading(false);
        return;
      }

      // 1. 采用“离屏克隆”渲染策略
      const cloneContainer = document.createElement('div');
      cloneContainer.style.position = 'fixed';
      cloneContainer.style.left = '-9999px';
      cloneContainer.style.top = '0';
      // 2. 强制锁定“虚拟宽度”
      cloneContainer.style.width = '750px';

      const clone = element.cloneNode(true) as HTMLElement;
      // 3. 移除自动居中逻辑
      clone.style.margin = '0';
      clone.style.position = 'static';
      clone.style.width = '750px';
      clone.style.maxWidth = 'none';
      clone.classList.remove('mx-auto', 'justify-center');

      cloneContainer.appendChild(clone);
      document.body.appendChild(cloneContainer);

      try {
        const h2c = (window as any).html2canvas || html2canvas;
        const canvas = await h2c(clone, {
          useCORS: true,
          scale: 2, // High resolution
          backgroundColor: refinedData.theme.bg,
          logging: true,
          allowTaint: true,
          // 4. 渲染配置参数调优：保证宽度严格一致并原点对齐
          windowWidth: 750,
          x: 0,
          y: 0
        });

        document.body.removeChild(cloneContainer);

        const image = canvas.toDataURL('image/png');
        setPosterImage(image);
        
        setIsPosterLoading(false);
        onCloseShareModal();
      } catch (error) {
        if (cloneContainer && cloneContainer.parentNode) {
          document.body.removeChild(cloneContainer);
        }
        alert('生成失败，请检查控制台错误日志。');
        setIsPosterLoading(false);
      }
    };

    generate();
  };

  if (!weeks || weeks.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }
  // ── Pre-built indexes: O(N) once instead of O(42×N) per month ──
  const recordIndexes = useMemo(() => {
    const allRecords = records || [];
    // Index special (non-travel) records by dateStr
    const specialByDate = new Map<string, EventRecord[]>();
    // Collect daily records separately (typically few)
    const dailyRecords: DailyRecord[] = [];
    // Collect travel records separately
    const travelRecords: EventRecord[] = [];

    for (const r of allRecords) {
      if (!r) continue;
      if (r.type === 'daily') {
        dailyRecords.push(r as DailyRecord);
      } else if (r.type === 'special') {
        const ev = r as EventRecord;
        if (ev.parent_tag === '旅行模式') {
          travelRecords.push(ev);
        } else {
          const ds = ev.dateStr;
          if (ds) {
            const arr = specialByDate.get(ds);
            if (arr) arr.push(ev);
            else specialByDate.set(ds, [ev]);
          }
        }
      }
    }
    // Sort daily records once
    dailyRecords.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    return { specialByDate, dailyRecords, travelRecords };
  }, [records]);

  // --- Travel coverage: compute which dates are covered by travel records ---
  const travelCoverageMap = useMemo(() => {
    const map = new Map<string, TravelCoverageInfo>();
    // Collect all visible dates in current month grid
    const gridDatesList: string[] = [];
    (weeks || []).flat().forEach(cell => {
      if (!cell || !cell.date) return;
      const ds = `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, '0')}-${String(cell.date.getDate()).padStart(2, '0')}`;
      gridDatesList.push(ds);
    });
    if (gridDatesList.length === 0) return map;

    const gridFirst = gridDatesList[0];
    const gridLast = gridDatesList[gridDatesList.length - 1];

    // Filter travel records that overlap with grid (already pre-separated)
    const travelEvents = recordIndexes.travelRecords.filter(ev => {
      const extra = ev.extra_data as TravelMetadata | undefined;
      if (!extra?.startDate || !extra?.endDate) return false;
      return extra.startDate <= gridLast && extra.endDate >= gridFirst;
    });

    for (const ev of travelEvents) {
      const extra = ev.extra_data as TravelMetadata;
      const color = ev.color?.bg || '#10b981';
      for (let i = 0; i < gridDatesList.length; i++) {
        const ds = gridDatesList[i];
        if (ds >= extra.startDate && ds <= extra.endDate) {
          const dayOfWeek = new Date(ds + 'T12:00:00').getDay();
          map.set(ds, {
            recordId: ev.id,
            color,
            isStart: ds === extra.startDate,
            isEnd: ds === extra.endDate,
            isRowStart: dayOfWeek === 0,
            isRowEnd: dayOfWeek === 6,
          });
        }
      }
    }
    return map;
  }, [recordIndexes, weeks]);

  const processedDays = useMemo(() => {
    const map = new Map<string, { daily: DailyRecord[], special: EventRecord[] }>();
    const { specialByDate, dailyRecords } = recordIndexes;

    (weeks || []).flat().forEach(cell => {
      if (!cell || !cell.date) return;
      const dateStr = `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, '0')}-${String(cell.date.getDate()).padStart(2, '0')}`;
      const dayOfWeek = cell.date.getDay();

      // O(D) where D = number of daily/habit records (typically <20)
      const daily = dailyRecords.filter(r => {
        const isWithinRange = (!r.startDate || dateStr >= r.startDate) && (!r.endDate || dateStr <= r.endDate);
        if (!isWithinRange) return false;
        return (!r.repeatDays || r.repeatDays.includes(dayOfWeek)) || (r.completedDates || []).includes(dateStr);
      });

      // O(1) hash lookup instead of O(N) filter
      const special = hideAllSpecialEvents ? [] : (specialByDate.get(dateStr) || []);

      map.set(dateStr, { daily, special });
    });
    return map;
  }, [recordIndexes, weeks, hideAllSpecialEvents]);

  const getCategoryIcon = (parentTag: string, customColor?: string) => {
    switch (parentTag) {
      case '演出模式':
        return <Theater size={14} strokeWidth={2} className="shrink-0 opacity-80" style={{ color: customColor }} />;
      case '普通模式':
        return <Sticker size={14} strokeWidth={2} className="shrink-0 opacity-80" style={{ color: customColor }} />;
      case '美食模式':
        return <Utensils size={14} strokeWidth={2} className="shrink-0 opacity-80" style={{ color: customColor || '#ffa500' }} />;
      case '旅行模式':
        return <Palmtree size={14} strokeWidth={2} className="shrink-0 opacity-80" style={{ color: customColor || '#10b981' }} />;
      default:
        return <Sticker size={14} strokeWidth={2} className="shrink-0 opacity-80" style={{ color: customColor }} />;
    }
  };

  const stableGetTagsString = useCallback((record: EventRecord) => {
    if (!record || !record.tag_names || record.tag_names.length === 0) return '未命名事件';
    // Phase 163: Filter out parent tag from string
    const filtered = record.tag_names.filter(n => n !== record.parent_tag);
    if (filtered.length === 0) return '记录';
    return filtered.join(', ');
  }, []);

  return (
    <div className="relative w-full min-h-screen flex flex-col bg-[var(--bg-color)] text-[var(--text-color)] font-sans transition-colors duration-300">
      

      <div className="fixed md:relative top-[56px] md:top-0 left-0 right-0 z-40 shrink-0 flex items-center justify-center gap-3 sm:gap-6 bg-[var(--bg-color)] md:bg-[var(--bg-color)]/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/20 px-4 sm:px-6 pt-1 pb-3 shadow-sm min-h-[60px] transition-colors duration-300">
        <button 
          onClick={prevMonth}
          className="p-1 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
        >
          <ChevronLeft size={20} className="sm:w-6 sm:h-6" />
        </button>
        
        <div className="flex items-center gap-0.5 sm:gap-1">
          <select
            value={currentMonth.getFullYear()}
            onChange={(e) => setCurrentMonth(new Date(parseInt(e.target.value), currentMonth.getMonth(), 1))}
            className="appearance-none bg-transparent hover:bg-gray-100 dark:hover:bg-white px-1 py-0.5 rounded text-lg sm:text-2xl font-bold tracking-wider text-gray-800 dark:text-white force-white-reverse-hover text-center cursor-pointer outline-none transition-all"
          >
            {Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i).map(year => (
              <option key={year} value={year} className="bg-white text-gray-800 dark:bg-gray-900 dark:text-white">{year}年</option>
            ))}
          </select>
          <select
            value={currentMonth.getMonth()}
            onChange={(e) => setCurrentMonth(new Date(currentMonth.getFullYear(), parseInt(e.target.value), 1))}
            className="appearance-none bg-transparent hover:bg-gray-100 dark:hover:bg-white px-1 py-0.5 rounded text-lg sm:text-2xl font-bold tracking-wider text-gray-800 dark:text-white force-white-reverse-hover text-center cursor-pointer outline-none transition-all"
          >
            {Array.from({ length: 12 }, (_, i) => i).map(month => (
              <option key={month} value={month} className="bg-white text-gray-800 dark:bg-gray-900 dark:text-white">{month + 1}月</option>
            ))}
          </select>
        </div>

        <button 
          onClick={nextMonth}
          className="p-1 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
        >
          <ChevronRight size={20} className="sm:w-6 sm:h-6" />
        </button>
      </div>

      {/* Grid Scroll Area */}
      <div className="flex flex-col w-full md:max-w-5xl mx-auto items-center px-1 sm:px-6">
        
        {/* Mobile Sticky Spacer */}
        <div className="h-[72px] md:hidden shrink-0" />

        {/* Weekdays Header */}
        <div className="hidden md:flex shrink-0 w-full py-3 z-30">
          <div className="grid grid-cols-7 gap-0.5 md:gap-2 w-full">
            {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map(d => (
              <div key={d} className="text-center text-xs md:text-base font-bold tracking-widest" style={{ color: 'var(--grid-weekday-text)' }}>
                {d}
              </div>
            ))}
          </div>
        </div>

        {/* Desktop Grid Area */}
        <div className="hidden md:flex w-full pb-10 flex-col gap-0.5 md:gap-2">
          {(weeks || []).map((week, wIdx) => {
            // Compute travel strips for this row
            type Strip = { colStart: number; colEnd: number; color: string; recordId: string; isStart: boolean; isEnd: boolean };
            const strips: Strip[] = [];
            let cur: Strip | null = null;

            (week || []).forEach((cell, colIdx) => {
              const ds = (cell && cell.date)
                ? `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, '0')}-${String(cell.date.getDate()).padStart(2, '0')}`
                : null;
              const cov = ds ? travelCoverageMap.get(ds) : undefined;
              if (cov) {
                if (!cur || cur.recordId !== cov.recordId) {
                  // Different record = always start a new strip
                  if (cur) strips.push(cur);
                  cur = { colStart: colIdx, colEnd: colIdx, color: cov.color, recordId: cov.recordId, isStart: cov.isStart, isEnd: cov.isEnd };
                } else {
                  cur.colEnd = colIdx;
                  if (cov.isEnd) cur.isEnd = true;
                }
              } else {
                if (cur) { strips.push(cur); cur = null; }
              }
            });
            if (cur) strips.push(cur);

            return (
              <div key={wIdx} className="relative grid grid-cols-7 gap-0.5 md:gap-2 justify-items-stretch items-stretch">
                {/* Travel dashed border outlines — wraps around covered cells */}
                {strips.map((strip, sIdx) => {
                  const leftPct = (strip.colStart / 7) * 100;
                  const widthPct = ((strip.colEnd - strip.colStart + 1) / 7) * 100;
                  const borderRadius = `${strip.isStart ? '14px' : '4px'} ${strip.isEnd ? '14px' : '4px'} ${strip.isEnd ? '14px' : '4px'} ${strip.isStart ? '14px' : '4px'}`;
                  return (
                    <div
                      key={`strip-${sIdx}`}
                      className="absolute pointer-events-none travel-dashed-frame"
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        top: '-1px',
                        bottom: '-1px',
                        border: `2px dashed ${strip.color}`,
                        borderRadius,
                        zIndex: 10,
                      }}
                    />
                  );
                })}
                {(week || []).map((cell, cIdx) => {
                  if (!cell || !cell.date) {
                    return <div key={cIdx} className="bg-transparent rounded-xl" />;
                  }
                  const dateStr = `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, '0')}-${String(cell.date.getDate()).padStart(2, '0')}`;
                  const dayData = processedDays.get(dateStr) || { daily: [], special: [] };
                  return (
                    <DesktopDayCell
                      key={cIdx}
                      date={cell.date}
                      dateStr={dateStr}
                      isToday={cell.isToday}
                      dailyRecords={dayData.daily}
                      dayEvents={dayData.special}
                      showRainbowBorder={showRainbowBorder}
                      isHabitMode={isHabitMode}
                      onOpenModal={onOpenModal}
                      onUpdateRecord={onUpdateRecord}
                      getRecordTagsString={stableGetTagsString}
                      getCategoryIcon={getCategoryIcon}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Mobile View 鈥?Vertical Flow Cards */}
        <div className="md:hidden flex flex-col w-full pb-20 gap-2 pt-2">
          {(() => {
            const mobileCells = (weeks || []).flat().filter(c => c && c.date);
            return mobileCells.map((cell, cIdx) => {
              if (!cell || !cell.date) return null;
              const dateStr = `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, '0')}-${String(cell.date.getDate()).padStart(2, '0')}`;
              const dayData = processedDays.get(dateStr) || { daily: [], special: [] };
              const travelCov = travelCoverageMap.get(dateStr);

              // Determine if prev/next cells share the same travel record
              let travelIsFirst = true;
              let travelIsLast = true;
              if (travelCov) {
                if (cIdx > 0) {
                  const prevCell = mobileCells[cIdx - 1];
                  if (prevCell?.date) {
                    const prevDs = `${prevCell.date.getFullYear()}-${String(prevCell.date.getMonth() + 1).padStart(2, '0')}-${String(prevCell.date.getDate()).padStart(2, '0')}`;
                    const prevCov = travelCoverageMap.get(prevDs);
                    if (prevCov && prevCov.recordId === travelCov.recordId) travelIsFirst = false;
                  }
                }
                if (cIdx < mobileCells.length - 1) {
                  const nextCell = mobileCells[cIdx + 1];
                  if (nextCell?.date) {
                    const nextDs = `${nextCell.date.getFullYear()}-${String(nextCell.date.getMonth() + 1).padStart(2, '0')}-${String(nextCell.date.getDate()).padStart(2, '0')}`;
                    const nextCov = travelCoverageMap.get(nextDs);
                    if (nextCov && nextCov.recordId === travelCov.recordId) travelIsLast = false;
                  }
                }
              }

              return (
                <MobileDayCell
                  key={`mobile-${cIdx}`}
                  date={cell.date}
                  dateStr={dateStr}
                  isToday={cell.isToday}
                  dailyRecords={dayData.daily}
                  dayEvents={dayData.special}
                  showRainbowBorder={showRainbowBorder}
                  isHabitMode={isHabitMode}
                  travelColor={travelCov?.color}
                  travelIsFirst={travelIsFirst}
                  travelIsLast={travelIsLast}
                  onOpenModal={onOpenModal}
                  onUpdateRecord={onUpdateRecord}
                  getRecordTagsString={stableGetTagsString}
                  getCategoryIcon={getCategoryIcon}
                />
              );
            });
          })()}
        </div>
      </div>
      <ShareModal 
        isOpen={isShareModalOpen}
        onClose={onCloseShareModal}
        records={records}
        tags={tags}
        onStartGenerate={handleStartShareGeneration}
      />

      {/* Poster Preview Modal */}
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
              alt="Habit Calendar Poster" 
              className="w-full h-auto block rounded-xl shadow-lg"
            />
          </div>
          
          <div className="text-white text-center space-y-3">
            <p className="text-2xl font-black flex items-center justify-center gap-3">
              <Download size={24} className="text-blue-400" />
              海报已生成
            </p>
            <p className="text-base text-gray-300 font-bold">长按上方图片保存到相册，分享你的自律生活</p>
          </div>
        </div>
      )}

      {/* Poster Template (Hidden) - Phase 19 Magazine Overhaul (Stable V14) */}
      {posterData && (
        <div 
          id="poster-template" 
          className="fixed left-[-9999px] top-0" 
          style={{ 
            backgroundColor: posterData.theme.bg, 
            padding: '100px 80px', 
            width: '750px', // Static width to prevent viewport scaling issues
            fontFamily: '"Inter", "Segoe UI", "PingFang SC", sans-serif',
            color: posterData.theme.text
          }}
        >
          {/* Decorative Top Line */}
          <div style={{ width: '40px', height: '4px', backgroundColor: posterData.theme.text, borderRadius: '4px', margin: '0 auto 40px auto' }} />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '80px' }}>
            <div style={{ 
              fontSize: '11px', 
              fontWeight: '900', 
              textTransform: 'uppercase', 
              letterSpacing: '0.4em', 
              color: posterData.theme.secondaryText, 
              marginBottom: '16px' 
            }}>PERSONAL ARCHIVE</div>
            
            {/* ALIBI LOG BRANDING */}
            <h1 style={{ 
              fontSize: '48px', 
              fontWeight: '900', 
              margin: 0, 
              color: posterData.theme.text, 
              letterSpacing: '0.2em',
              textTransform: 'uppercase'
            }}>
              ALIBI LOG
            </h1>
            
            <div style={{ marginTop: '20px', fontSize: '16px', fontWeight: '600', color: posterData.theme.mutedText, letterSpacing: '0.05em' }}>
              {posterData.range}
            </div>
          </div>

          <div style={{ 
            display: 'grid', 
            gap: '60px', 
            gridTemplateColumns: '1fr', // Force single column for 750px width stability
            width: '100%',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 1
          }}>
            {posterData.shareType === 'calendar' ? (
              posterData.months.map((m: any, idx: number) => (
                <div key={idx} style={{ 
                  backgroundColor: posterData.theme.cardBg,
                  borderRadius: '32px',
                  padding: '48px',
                  boxShadow: posterData.isDark ? 'none' : '0 10px 40px rgba(0, 0, 0, 0.02)',
                  border: `1px solid ${posterData.theme.cardBorder}`,
                  display: 'flex',
                  flexDirection: 'column',
                  margin: posterData.months.length <= 2 ? '0 auto' : '0',
                  width: '100%'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                    <h3 style={{ 
                      fontSize: '20px', 
                      fontWeight: '900', 
                      color: posterData.theme.text, 
                      letterSpacing: '0.1em',
                      margin: 0
                    }}>
                      {m.year}.{String(m.month).padStart(2, '0')}
                    </h3>
                    <div style={{ width: '24px', height: '2px', backgroundColor: '#f1f5f9' }} />
                  </div>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    marginBottom: '40px'
                  }}>
                    {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                      <div key={d} style={{ 
                        textAlign: 'center', 
                        fontSize: '14px', 
                        fontWeight: '800', 
                        color: posterData.theme.secondaryText, 
                        marginBottom: '20px'
                      }}>{d}</div>
                    ))}
                    {Array.from({ length: m.firstDay }).map((_, i) => (
                      <div key={`empty-${i}`} style={{ aspectRatio: '1/1' }} />
                    ))}
                    {m.days.map((d: any) => (
                      <div key={d.day} style={{ 
                        aspectRatio: '1/1', // SQUARE RATIO LOCK
                        padding: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between', // Physical separation logic
                        position: 'relative',
                        backgroundColor: d.isWithinRange ? 'transparent' : '#fcfcfc'
                      }}>
                        {/* Top Area: Fixed Date Header */}
                        <div style={{ height: '20px', display: 'flex', alignItems: 'flex-start' }}>
                          <span style={{ 
                            fontSize: '16px', 
                            fontWeight: '600', 
                            color: d.isWithinRange ? (posterData.isDark ? '#ffffff' : '#0f172a') : (posterData.isDark ? '#3f3f46' : '#e2e8f0'),
                          }}>{d.day}</span>
                        </div>
  
                        {/* Middle Area: Mandatory Buffer Gap */}
                        <div style={{ height: '12px' }} />
                        
                        {/* Bottom Area: Habid Dots stuck to bottom */}
                        <div style={{ 
                          flex: 1, 
                          display: 'flex', 
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                          paddingBottom: '2px'
                        }}>
                          {d.isWithinRange && posterData.selectedHabits.map((h: any) => {
                            const isDone = (h.completedDates || []).includes(d.dateStr);
                          if (!isDone) return null;
                            return (
                              <div key={h.id} style={{ 
                                width: '7px', 
                                height: '7px', 
                                borderRadius: '50%', 
                                backgroundColor: h.safeColor.bg,
                                boxShadow: `0 1px 2px ${h.safeColor.bg}30`,
                                margin: '0 1.5px' // Use margin instead of flex gap
                              }} />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
  
                  {/* Poster Layout Polish: Padding adjustment for habit-only focus (Phase 134) */}
                  <div style={{ height: '32px' }} />
                </div>
              ))
            ) : (
                // Achievement Mode Template
                <div style={{ 
                  backgroundColor: posterData.theme.bg,
                  width: '750px', // Fixed width for stability
                  padding: '60px 48px',
                  borderRadius: '32px',
                  boxShadow: posterData.isDark ? 'none' : '0 20px 60px rgba(0, 0, 0, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '32px',
                  position: 'relative',
                  overflow: 'hidden' // iOS containment
                }}>
                  {/* Title Card Section */}
                  <div style={{ 
                    backgroundColor: posterData.theme.cardBg,
                    borderRadius: '32px',
                    padding: '60px 48px',
                    border: `1px solid ${posterData.theme.cardBorder}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    zIndex: 1
                  }}>
                    {/* Background Rainbow Mist/Diffusion */}
                    <div style={{
                      position: 'absolute',
                      top: '-50%',
                      left: '-20%',
                      width: '140%',
                      height: '200%',
                      background: `radial-gradient(circle at center, rgba(59, 130, 246, ${posterData.isDark ? 0.15 : 0.08}) 0%, rgba(168, 85, 247, ${posterData.isDark ? 0.15 : 0.08}) 30%, rgba(236, 72, 153, ${posterData.isDark ? 0.1 : 0.05}) 60%, transparent 80%)`,
                      zIndex: 0,
                      filter: 'blur(60px)',
                      transform: 'rotate(-15deg)'
                    }} />
                    
                    <div style={{
                      position: 'absolute',
                      bottom: '-20%',
                      right: '-10%',
                      width: '100%',
                      height: '100%',
                      background: `radial-gradient(circle at center, rgba(168, 85, 247, ${posterData.isDark ? 0.12 : 0.06}) 0%, rgba(236, 72, 153, ${posterData.isDark ? 0.08 : 0.04}) 50%, transparent 70%)`,
                      zIndex: 0,
                      filter: 'blur(80px)',
                    }} />

                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{ fontSize: '32px', marginBottom: '16px', lineHeight: '1' }}>🌟</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: posterData.theme.accent, letterSpacing: '0.4em', marginBottom: '8px', lineHeight: '1.2' }}>ARCHIVE TITLE</div>
                      <h2 style={{ fontSize: '40px', fontWeight: '900', color: posterData.theme.text, margin: 0, letterSpacing: '-0.02em', lineHeight: '1.2' }}>
                        {posterData.funTitle}
                      </h2>
                    </div>
                  </div>

                  {/* Main Grid Stats */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(2, 1fr)', 
                    gap: '24px',
                    zIndex: 1
                  }}>
                    <div style={{ backgroundColor: posterData.theme.cardBg, borderRadius: '28px', padding: '34px 24px 38px', border: `1px solid ${posterData.theme.cardBorder}`, display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}>
                      <span style={{ fontSize: '24px', marginBottom: '12px', lineHeight: '1' }}>✅</span>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: posterData.theme.secondaryText, letterSpacing: '0.05em', marginBottom: '4px', lineHeight: '1.2', textAlign: 'center' }}>TOTAL CHECK-INS · 累计打卡次数</span>
                      <span style={{ fontSize: '38px', fontWeight: '900', color: posterData.theme.text, lineHeight: '1.2', transform: 'translateY(-2px)' }}>{posterData.totalChecks}</span>
                    </div>
                    <div style={{ backgroundColor: posterData.theme.cardBg, borderRadius: '28px', padding: '34px 24px 38px', border: `1px solid ${posterData.theme.cardBorder}`, display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}>
                      <span style={{ fontSize: '24px', marginBottom: '12px', lineHeight: '1' }}>🌈</span>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: posterData.theme.secondaryText, letterSpacing: '0.05em', marginBottom: '4px', lineHeight: '1.2', textAlign: 'center' }}>PERFECT DAYS · 完美打卡天数</span>
                      <span style={{ fontSize: '38px', fontWeight: '900', color: posterData.theme.text, lineHeight: '1.2', transform: 'translateY(-2px)' }}>{posterData.perfectRainbowDays}</span>
                    </div>
                    <div style={{ backgroundColor: posterData.theme.cardBg, borderRadius: '28px', padding: '34px 24px 38px', border: `1px solid ${posterData.theme.cardBorder}`, display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}>
                      <span style={{ fontSize: '24px', marginBottom: '12px', lineHeight: '1' }}>⚡</span>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: posterData.theme.secondaryText, letterSpacing: '0.05em', marginBottom: '4px', lineHeight: '1.2', textAlign: 'center' }}>LONGEST STREAK · 最长连续坚持</span>
                      <span style={{ fontSize: '38px', fontWeight: '900', color: posterData.theme.text, lineHeight: '1.2', transform: 'translateY(-2px)' }}>{posterData.longestStreak}</span>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: posterData.theme.mutedText, marginTop: '2px', lineHeight: '1.2', transform: 'translateY(-2px)' }}>days continuously</span>
                    </div>
                    <div style={{ backgroundColor: posterData.theme.cardBg, borderRadius: '28px', padding: '34px 24px 38px', border: `1px solid ${posterData.theme.cardBorder}`, display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}>
                      <span style={{ fontSize: '24px', marginBottom: '12px', lineHeight: '1' }}>🧠</span>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: posterData.theme.secondaryText, letterSpacing: '0.05em', marginBottom: '4px', lineHeight: '1.2', textAlign: 'center' }}>DOPAMINE SCORE · 多巴胺释放量</span>
                      <span style={{ fontSize: '38px', fontWeight: '900', color: posterData.theme.text, lineHeight: '1.2', transform: 'translateY(-2px)' }}>{posterData.dopamineScore}</span>
                    </div>
                  </div>

                  {/* Insight Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', zIndex: 1 }}>
                    <div style={{ backgroundColor: posterData.theme.cardBg, borderRadius: '28px', padding: '32px 36px', border: `1px solid ${posterData.theme.cardBorder}`, display: 'flex', alignItems: 'center', gap: '24px', boxSizing: 'border-box', minHeight: '120px' }}>
                      <div style={{ width: '64px', height: '64px', backgroundColor: posterData.isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0 }}>👑</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: posterData.theme.secondaryText, letterSpacing: '0.05em', marginBottom: '6px', lineHeight: '1.2' }}>HABIT KING · 习惯之王</div>
                        <div style={{ fontSize: '22px', fontWeight: '800', color: posterData.theme.text, lineHeight: '1.4', wordBreak: 'break-word' }}>最强坚持 · {posterData.habitKingName}</div>
                      </div>
                    </div>
                    <div style={{ backgroundColor: posterData.theme.cardBg, borderRadius: '28px', padding: '32px 36px', border: `1px solid ${posterData.theme.cardBorder}`, display: 'flex', alignItems: 'center', gap: '24px', boxSizing: 'border-box', minHeight: '120px' }}>
                      <div style={{ width: '64px', height: '64px', backgroundColor: posterData.isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0 }}>⏰</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: posterData.theme.secondaryText, letterSpacing: '0.05em', marginBottom: '6px', lineHeight: '1.2' }}>ENERGY PERIOD · 能量时段</div>
                        <div style={{ fontSize: '22px', fontWeight: '800', color: posterData.theme.text, lineHeight: '1.4' }}>{posterData.energyLabel} · {posterData.peakHour}</div>
                      </div>
                    </div>
                  </div>
                </div>
            )}
          </div>

          {/* Habit Legend - Added for V23 Clarity */}
          {posterData.shareType === 'calendar' && posterData.selectedHabits.length > 0 && (
            <div style={{ marginTop: '80px', width: '100%', borderTop: `1px solid ${posterData.theme.cardBorder}`, paddingTop: '40px' }}>
              <div style={{ 
                fontSize: '10px', 
                fontWeight: '900', 
                color: posterData.theme.secondaryText, 
                letterSpacing: '0.3em', 
                marginBottom: '24px',
                textAlign: 'center'
              }}>HABIT LEGEND</div>
              
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                justifyContent: 'center', 
                maxWidth: '900px',
                margin: '0 auto'
              }}>
                {posterData.selectedHabits.map((h: any) => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', marginRight: '40px', marginBottom: '24px' }}>
                    <div style={{ 
                      width: '10px', 
                      height: '10px', 
                      borderRadius: '50%', 
                      backgroundColor: h.safeColor.bg,
                      boxShadow: `0 1px 3px ${h.safeColor.bg}40`,
                      marginRight: '10px'
                    }} />
                    <span style={{ fontSize: '14px', fontWeight: '700', color: posterData.theme.secondaryText, letterSpacing: '0.02em' }}>
                      {h.content}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Achievement Summary Section - Removed in V24 as it is now a full mode */}

          {/* Footer Branding */}
          <div style={{ marginTop: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
            <div style={{ width: '80px', height: '1.5px', backgroundColor: posterData.theme.cardBorder }} />
            <span style={{ 
              fontSize: '13px', 
              fontWeight: '700', 
              color: posterData.isDark ? '#94a3b8' : '#71717a', 
              letterSpacing: '0.4em',
              opacity: 0.9,
              textAlign: 'center'
            }}>你的生活本就值得记录</span>
          </div>
        </div>
      )}

      {/* Loading Modal */}
      {isPosterLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md transition-opacity duration-300">
          <div className="bg-white dark:bg-gray-900 px-10 py-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 transition-all">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-lg font-bold text-gray-800 dark:text-gray-100">正在生成预览，请稍候...</p>
            <button 
              onClick={() => setIsPosterLoading(false)}
              className="mt-2 text-sm text-gray-500 hover:text-blue-500 transition-colors font-medium underline underline-offset-4"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const Calendar = memo(CalendarInner);
