import { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCalendarData } from '../hooks/useCalendarData';
import { ShareModal } from './ShareModal';
import html2canvas from 'html2canvas';
import { getSafeColor } from '../utils/colors';
import type { CalendarRecord, RecordTag, SpecialRecord, DailyRecord } from '../types';

interface CalendarProps {
  onOpenModal: (date: Date | null, recordToEdit?: {record: CalendarRecord, dateStr: string}) => void;
  records: CalendarRecord[];
  tags: RecordTag[];
  onUpdateRecord: (record: CalendarRecord) => void;
  filterTagIds: string[];
  hideAllSpecialEvents: boolean;
  isShareModalOpen?: boolean;
  onCloseShareModal?: () => void;
}

export function Calendar({ 
  onOpenModal, 
  records, 
  tags, 
  onUpdateRecord,
  filterTagIds,
  hideAllSpecialEvents,
  isShareModalOpen = false,
  onCloseShareModal = () => {}
}: CalendarProps) {
  const { currentMonth, weeks, setCurrentMonth, prevMonth, nextMonth } = useCalendarData();

  const [isPosterLoading, setIsPosterLoading] = useState(false);
  const [posterData, setPosterData] = useState<any>(null);


  const handleStartShareGeneration = (settings: { startDate: string, endDate: string, selectedHabitIds: string[], selectedTagIds: string[] }) => {
    setIsPosterLoading(true);
    
    const [sY, sM, sD] = settings.startDate.split('-').map(Number);
    const [eY, eM, eD] = settings.endDate.split('-').map(Number);
    
    // SAFE PARSING: Force midday 12:00:00 local time
    const start = new Date(sY, sM - 1, sD, 12, 0, 0);
    const end = new Date(eY, eM - 1, eD, 12, 0, 0);
    
    const monthsData = [];
    let currYear = sY;
    let currMonth = sM;

    // WHILE LOOP MONTH GENERATION: More robust than totalMonths math
    while (currYear < eY || (currYear === eY && currMonth <= eM)) {
      const year = currYear;
      const month = currMonth;
      
      
      // Calculate firstDay using local midday to ensure correct weekday index
      const firstDay = new Date(year, month - 1, 1, 12, 0, 0).getDay();
      
      
      const daysInMonth = new Date(year, month, 0).getDate();
      
      const days = Array.from({ length: daysInMonth }, (_, j) => {
        const day = j + 1;
        // MANUALLY FORMAT: Avoid Date object formatting for the source string
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // STRING COMPARISON: Immune to timezone offsets
        const isWithinRange = dateStr >= settings.startDate && dateStr <= settings.endDate;

        const daySpecialEvents = isWithinRange ? (records.filter(r => 
          r.type === 'special' && 
          r.dateStr === dateStr && 
          r.tagIds.some(tid => settings.selectedTagIds.includes(tid))
        ) as SpecialRecord[]).map(e => ({
          ...e,
          safeColor: {
            bg: getSafeColor(e.color?.bg || ''),
            text: getSafeColor(e.color?.text || '')
          }
        })) : [];

        return {
          day,
          dateStr,
          isWithinRange,
          specialEvents: daySpecialEvents
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

    // Hardened: Pre-convert all colors to HEX to avoid html2canvas oklch issues
    const selectedHabitsExtended = (records.filter(r => settings.selectedHabitIds.includes(r.id)) as DailyRecord[])
      .map(h => ({
        ...h,
        safeColor: {
          bg: getSafeColor(h.color?.bg || ''),
          text: getSafeColor(h.color?.text || '')
        }
      }));

    const refinedData = {
      range: `${sY}.${String(sM).padStart(2, '0')} - ${eY}.${String(eM).padStart(2, '0')}`,
      selectedHabits: selectedHabitsExtended,
      startDate: start.getTime(),
      endDate: end.getTime(),
      months: monthsData
    };

    setPosterData(refinedData);
    
    // Hardened Step 2: Ensure library and rendering are ready
    const generate = async () => {
      // 1. Dynamic Library Check
      if (!(window as any).html2canvas) {
        console.log('html2canvas not found in window, loading from CDN...');
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

      try {
        const h2c = (window as any).html2canvas || html2canvas;
        const canvas = await h2c(element, {
          useCORS: true,
          scale: 2, // High resolution
          backgroundColor: '#ffffff',
          logging: true, // Enable logging as requested
          allowTaint: true // Increase compatibility
        });

        const image = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        const filename = `My_Habit_Calendar_${refinedData.range.replace(/\s/g, '').replace(/\./g, '_')}.png`;
        link.href = image;
        link.download = filename;
        link.click();
        
        setIsPosterLoading(false);
        onCloseShareModal();
      } catch (error) {
        console.error('Poster generation failed:', error);
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


  const getRecordTagsString = (record: SpecialRecord) => {
    if (!record || !record.tagIds || record.tagIds.length === 0) return '未命名';
    const tagArray = tags || [];
    return tagArray
      .filter(t => record.tagIds?.includes(t.id))
      .map(t => t.name)
      .join(', ') || '未命名';
  };

  return (
    <div className="relative w-full h-screen flex flex-col bg-gray-50 dark:bg-gray-950 font-sans overflow-hidden">
      
      {/* Floating Add Button */}
      <button 
        onClick={() => onOpenModal(new Date())}
        className="absolute top-6 left-6 z-40 bg-gradient-to-tr from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 text-white p-4 rounded-2xl shadow-xl hover:shadow-2xl shadow-blue-500/30 hover:-translate-y-1 transition-all group border border-white/10"
      >
        <Plus size={28} className="group-hover:rotate-90 transition-transform duration-500" />
      </button>

      <div className="shrink-0 flex items-center justify-center gap-3 sm:gap-6 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 px-4 sm:px-6 py-4 shadow-sm z-30 min-h-[72px]">
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
            className="appearance-none bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 px-1 py-0.5 rounded text-lg sm:text-2xl font-bold tracking-wider text-gray-800 dark:text-gray-100 text-center cursor-pointer outline-none transition-all"
          >
            {Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i).map(year => (
              <option key={year} value={year} className="dark:bg-gray-900">{year}年</option>
            ))}
          </select>
          <select
            value={currentMonth.getMonth()}
            onChange={(e) => setCurrentMonth(new Date(currentMonth.getFullYear(), parseInt(e.target.value), 1))}
            className="appearance-none bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 px-1 py-0.5 rounded text-lg sm:text-2xl font-bold tracking-wider text-gray-800 dark:text-gray-100 text-center cursor-pointer outline-none transition-all"
          >
            {Array.from({ length: 12 }, (_, i) => i).map(month => (
              <option key={month} value={month} className="dark:bg-gray-900">{month + 1}月</option>
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

      {/* Grid Scroll Area — px-1 mobile, px-6 desktop. md: limited to one screen */}
      <div className="flex-1 flex flex-col overflow-y-auto w-full md:max-w-5xl mx-auto items-center px-1 sm:px-6 overflow-x-hidden md:h-[calc(100vh-120px)] md:overflow-hidden">
        
        {/* Weekdays Header */}
        <div className="shrink-0 w-full py-3 z-30">
          <div className="grid grid-cols-7 gap-0.5 md:gap-2 w-full">
            {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map(d => (
              <div key={d} className="text-center text-xs font-bold text-gray-400 tracking-widest">
                {d}
              </div>
            ))}
          </div>
        </div>

        {/* Grid Area — rows sync height via CSS grid auto-rows */}
        <div className="flex-1 w-full pb-8 flex flex-col gap-0.5 md:gap-2">
          {(weeks || []).map((week, wIdx) => (
            <div key={wIdx} className="grid grid-cols-7 gap-0.5 md:gap-2 justify-items-stretch content-start" style={{ gridAutoRows: '1fr' }}>
              {(week || []).map((cell, cIdx) => {
                if (!cell || !cell.date) {
                  return <div key={cIdx} className="bg-transparent rounded-xl" />;
                }
                
                const dateStr = `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, '0')}-${String(cell.date.getDate()).padStart(2, '0')}`;
                const dayOfWeek = cell.date.getDay();
                
                const allRecords = records || [];
                
                // Habit filtering logic
                const dailyRecords = allRecords.filter(r => {
                  if (!r || r.type !== 'daily') return false;
                  return !r.repeatDays || r.repeatDays.includes(dayOfWeek);
                }).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)) as DailyRecord[];

                // FIXED: Enhanced Special Event Filtering Logic
                const dayEvents = (allRecords.filter(r => r && r.type === 'special' && r.dateStr === dateStr) as SpecialRecord[])
                  .filter(event => {
                    // Level 1: Hide all
                    if (hideAllSpecialEvents) return false;
                    
                    // Level 2: Tag filtering
                    if (filterTagIds && filterTagIds.length > 0) {
                      return (event.tagIds || []).some(tagId => filterTagIds.includes(tagId));
                    }
                    
                    // Level 3: Show all
                    return true;
                  });
                return (
                <div
                    key={cIdx}
                    onClick={() => onOpenModal(cell.date)}
                    className={`group relative rounded-xl border flex flex-col transition-all duration-200 ease-out cursor-pointer
                      min-h-[96px] md:min-h-0 md:aspect-square
                      ${cell.isToday 
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-sm' 
                        : 'bg-white dark:bg-gray-900 border-gray-200/60 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50'}
                      hover:scale-105 hover:z-20 hover:shadow-lg active:scale-95 hover:ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-gray-950`}
                  >
                    {/* Date number — Normal flow layout for both mobile and desktop */}
                    <div className="flex justify-between items-start w-full px-1 pt-1 mb-1 shrink-0 z-10">
                      <span className={`text-[11px] md:text-sm font-bold md:font-medium leading-none md:bg-white/60 md:dark:bg-black/40 md:rounded-full md:px-1.5 md:py-0.5
                        ${cell.isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100'}`}>
                        {cell.label}
                      </span>
                    </div>

                    {/* Habits Area — Compact flow layout */}
                    <div className="habit-container flex flex-wrap gap-0.5 content-start p-0.5 md:p-1 w-full shrink-0">
                      {(dailyRecords || []).map(record => {
                        const isCompleted = (record.completedDates || []).includes(dateStr);
                        const firstChar = record.content?.charAt(0) || '?';
                        return (
                          <div
                            key={`habit-${record.id}`}
                            title={record.content}
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateRecord({
                                ...record,
                                completedDates: isCompleted 
                                  ? (record.completedDates || []).filter(d => d !== dateStr) 
                                  : [...(record.completedDates || []), dateStr]
                              });
                            }}
                            className={`w-5 h-5 md:w-7 md:h-7 rounded-sm md:rounded-md transition-all duration-200 shrink-0 flex items-center justify-center text-[11px] md:text-sm font-bold select-none active:scale-90 hover:scale-110
                              ${isCompleted 
                                ? 'shadow-sm border-2 border-solid border-black/10 dark:border-white/10' 
                                : 'bg-gray-100 dark:bg-gray-800 border-[1.5px] border-dashed border-gray-300 dark:border-gray-700 text-gray-400'}
                            `}
                            style={isCompleted ? { backgroundColor: record.color?.bg, color: record.color?.text } : {}}
                          >
                            {firstChar}
                          </div>
                        );
                      })}
                    </div>

                    {/* Universal Separator — Visible whenever both sections exist */}
                    {dailyRecords.length > 0 && dayEvents.length > 0 && (
                      <div className="w-full border-t border-gray-100 dark:border-gray-800/80 my-1 mx-0" />
                    )}

                    {/* Events Area */}
                    <div className="event-container flex flex-col gap-0.5 p-0.5 md:p-1">
                      {(dayEvents || []).map(record => {
                        const displayTitle = record.title || getRecordTagsString(record);
                        return (
                          <div
                            key={`special-${record.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenModal(cell.date, { record, dateStr });
                            }}
                            className="text-[9px] md:text-xs px-1.5 py-0.5 md:py-1 rounded shadow-sm text-left truncate font-medium w-full hover:brightness-95 transition-all"
                            style={{ backgroundColor: record.color?.bg, color: record.color?.text }}
                          >
                            {displayTitle}
                          </div>
                         );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <ShareModal 
        isOpen={isShareModalOpen}
        onClose={onCloseShareModal}
        records={records}
        tags={tags}
        onStartGenerate={handleStartShareGeneration}
      />

      {/* Poster Template (Hidden) - Phase 19 Magazine Overhaul (Stable V14) */}
      {posterData && (
        <div 
          id="poster-template" 
          className="fixed left-[-9999px] top-0" 
          style={{ 
            backgroundColor: '#FDFCF9', 
            padding: '100px 80px', 
            // DYNAMIC WIDTH: 500px for 1-3 months, 1200px for 4+ months
            width: posterData.months.length <= 3 ? '500px' : '1200px', 
            fontFamily: '"Inter", "Segoe UI", "PingFang SC", sans-serif',
            color: '#0f172a'
          }}
        >
          {/* Decorative Top Line */}
          <div style={{ width: '40px', height: '4px', backgroundColor: '#0f172a', borderRadius: '4px', margin: '0 auto 40px auto' }} />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '80px' }}>
            <div style={{ 
              fontSize: '11px', 
              fontWeight: '900', 
              textTransform: 'uppercase', 
              letterSpacing: '0.4em', 
              color: '#94a3b8', 
              marginBottom: '16px' 
            }}>PERSONAL ARCHIVE</div>
            
            {/* ALIBI LOG BRANDING */}
            <h1 style={{ 
              fontSize: '48px', 
              fontWeight: '900', 
              margin: 0, 
              color: '#0f172a', 
              letterSpacing: '0.2em',
              textTransform: 'uppercase'
            }}>
              ALIBI LOG
            </h1>
            
            <div style={{ marginTop: '20px', fontSize: '16px', fontWeight: '600', color: '#64748b', letterSpacing: '0.05em' }}>
              {posterData.range}
            </div>
          </div>

          <div style={{ 
            display: 'grid', 
            gap: '80px', 
            // DYNAMIC LAYOUT: Single column for 1-3 months, 2 columns for 4+
            gridTemplateColumns: posterData.months.length <= 3 ? '1fr' : 'repeat(2, 1fr)',
            width: '100%',
            justifyContent: 'center'
          }}>
            {posterData.months.map((m: any, idx: number) => (
              <div key={idx} style={{ 
                backgroundColor: '#ffffff',
                borderRadius: '32px',
                padding: '48px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.02)',
                display: 'flex',
                flexDirection: 'column',
                margin: posterData.months.length <= 2 ? '0 auto' : '0',
                width: '100%'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                  <h3 style={{ 
                    fontSize: '20px', 
                    fontWeight: '900', 
                    color: '#0f172a', 
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
                      color: '#475569', // Darker slate
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
                          color: d.isWithinRange ? '#0f172a' : '#e2e8f0',
                        }}>{d.day}</span>
                      </div>

                      {/* Middle Area: Mandatory Buffer Gap */}
                      <div style={{ height: '12px' }} />
                      
                      {/* Bottom Area: Habid Dots stuck to bottom */}
                      <div style={{ 
                        flex: 1, 
                        display: 'flex', 
                        alignItems: 'flex-end', // Stick to bottom
                        justifyContent: 'center',
                        gap: '3px',
                        paddingBottom: '2px' // Spacer from cell edge
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
                              boxShadow: `0 1px 2px ${h.safeColor.bg}30`
                            }} />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Timeline Styles Special Events */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {m.days.filter((d: any) => d.specialEvents.length > 0).map((d: any) => (
                    <div key={d.dateStr} style={{ display: 'flex', gap: '20px' }}>
                      <div style={{ 
                        fontSize: '14px', 
                        fontWeight: '900', 
                        color: '#64748b', 
                        width: '24px', 
                        textAlign: 'right',
                        paddingTop: '2px'
                      }}>
                        {String(d.day).padStart(2, '0')}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                        {d.specialEvents.map((e: any) => (
                          <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', borderBottom: '1px dashed #f1f5f9', paddingBottom: '12px' }}>
                            <div style={{ 
                              width: '8px', 
                              height: '8px', 
                              borderRadius: '50%', 
                              border: `2px solid ${e.safeColor.bg}`, 
                              marginTop: '6px',
                              flexShrink: 0
                            }} />
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', lineHeight: '1.4' }}>
                              {e.title || (e.tagIds.map((tid: string) => tags.find(t => t.id === tid)?.name).filter(Boolean).join(', '))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Habit Legend - Added for V23 Clarity */}
          {posterData.selectedHabits.length > 0 && (
            <div style={{ marginTop: '80px', width: '100%', borderTop: '1px solid #f1f5f9', paddingTop: '40px' }}>
              <div style={{ 
                fontSize: '10px', 
                fontWeight: '900', 
                color: '#94a3b8', 
                letterSpacing: '0.3em', 
                marginBottom: '24px',
                textAlign: 'center'
              }}>HABIT LEGEND</div>
              
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                justifyContent: 'center', 
                gap: '24px 40px',
                maxWidth: '900px',
                margin: '0 auto'
              }}>
                {posterData.selectedHabits.map((h: any) => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ 
                      width: '10px', 
                      height: '10px', 
                      borderRadius: '50%', 
                      backgroundColor: h.safeColor.bg,
                      boxShadow: `0 1px 3px ${h.safeColor.bg}40`
                    }} />
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#475569', letterSpacing: '0.02em' }}>
                      {h.content}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Branding */}
          <div style={{ marginTop: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
            <div style={{ width: '80px', height: '1px', backgroundColor: '#e2e8f0' }} />
            <span style={{ 
              fontSize: '11px', 
              fontWeight: '700', 
              color: '#cbd5e1', 
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              opacity: 0.8
            }}>ANTIGRAVITY · ALIBI CALENDAR SYSTEM</span>
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
