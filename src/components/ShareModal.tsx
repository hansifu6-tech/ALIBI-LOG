import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar as CalendarIcon, CheckSquare, Square, Share2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { CalendarRecord, RecordTag, DailyRecord } from '../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: CalendarRecord[];
  tags: RecordTag[];
  onStartGenerate?: (settings: { startDate: string, endDate: string, selectedHabitIds: string[], selectedTagIds: string[] }) => void;
}

export function ShareModal({ isOpen, onClose, records, tags, onStartGenerate }: ShareModalProps) {
  const [viewDate, setViewDate] = useState(new Date());
  const [startValue, setStartValue] = useState<Date | null>(null);
  const [endValue, setEndValue] = useState<Date | null>(null);
  const [selectedHabitIds, setSelectedHabitIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const habits = records.filter(r => r.type === 'daily') as DailyRecord[];

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
      
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartValue(firstDay);
      setEndValue(lastDay);
      
      setSelectedHabitIds(habits.map(h => h.id));
      setSelectedTagIds(tags.map(t => t.id));
      setIsGenerating(false);
    }
  }, [isOpen, records.length, tags.length]);

  const weeks = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const res = [];
    let week = Array(firstDay).fill(null);
    
    for (let d = 1; d <= daysInMonth; d++) {
      week.push(new Date(year, month, d));
      if (week.length === 7) {
        res.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      res.push(week);
    }
    return res;
  }, [viewDate]);

  if (!isOpen) return null;

  const handleDateClick = (date: Date) => {
    if (!startValue || (startValue && endValue)) {
      setStartValue(date);
      setEndValue(null);
    } else {
      if (date < startValue) {
        setStartValue(date);
        setEndValue(null);
      } else {
        const diff = date.getTime() - startValue.getTime();
        if (diff > 365 * 24 * 60 * 60 * 1000) {
          alert('日期跨度不能超过一年');
          return;
        }
        setEndValue(date);
      }
    }
  };

  const isSelected = (date: Date) => {
    if (!date) return false;
    if (startValue && date.getTime() === startValue.getTime()) return true;
    if (endValue && date.getTime() === endValue.getTime()) return true;
    if (startValue && endValue && date > startValue && date < endValue) return true;
    return false;
  };

  const isStart = (date: Date) => startValue && date && date.getTime() === startValue.getTime();
  const isEnd = (date: Date) => endValue && date && date.getTime() === endValue.getTime();

  const handleStartGenerate = () => {
    setIsGenerating(true);
    if (onStartGenerate) {
      const formatDate = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      onStartGenerate({
        startDate: startValue ? formatDate(startValue) : '',
        endDate: endValue ? formatDate(endValue) : '',
        selectedHabitIds,
        selectedTagIds
      });
    }

    setTimeout(() => {
      setIsGenerating(false); 
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <Share2 size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">配置分享日历</h3>
          </div>
          <button onClick={onClose} disabled={isGenerating} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Date Range Picker */}
          <section>
            <div className="flex items-center justify-between mb-4 text-gray-800 dark:text-gray-200">
              <div className="flex items-center gap-2">
                <CalendarIcon size={18} className="text-blue-500" />
                <h4 className="font-bold">选择日期范围 (跨度限1年)</h4>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                
                <div className="flex items-center gap-1">
                  <select
                    value={viewDate.getFullYear()}
                    onChange={(e) => setViewDate(new Date(parseInt(e.target.value), viewDate.getMonth(), 1))}
                    className="appearance-none bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 px-1 py-0.5 rounded text-sm font-bold text-center cursor-pointer outline-none focus:ring-1 ring-blue-500/30 transition-all"
                  >
                    {Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i).map(year => (
                      <option key={year} value={year} className="dark:bg-gray-900">{year}年</option>
                    ))}
                  </select>
                  <select
                    value={viewDate.getMonth()}
                    onChange={(e) => setViewDate(new Date(viewDate.getFullYear(), parseInt(e.target.value), 1))}
                    className="appearance-none bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 px-1 py-0.5 rounded text-sm font-bold text-center cursor-pointer outline-none focus:ring-1 ring-blue-500/30 transition-all"
                  >
                    {Array.from({ length: 12 }, (_, i) => i).map(month => (
                      <option key={month} value={month} className="dark:bg-gray-900">{month + 1}月</option>
                    ))}
                  </select>
                </div>

                <button 
                  onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                  <div key={d} className="text-center text-[10px] font-bold text-gray-400">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {weeks.map((week, wIdx) => (
                  <React.Fragment key={wIdx}>
                    {week.map((date: Date | null, dIdx: number) => {
                      if (!date) return <div key={dIdx} />;
                      const selected = isSelected(date);
                      const start = isStart(date);
                      const end = isEnd(date);
                      
                      return (
                        <button
                          key={dIdx}
                          onClick={() => handleDateClick(date)}
                          className={`
                            h-8 w-full flex items-center justify-center text-xs font-bold rounded-lg transition-all
                            ${selected 
                              ? 'bg-blue-500 text-white shadow-sm' 
                              : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'}
                            ${start ? 'rounded-r-none ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-gray-900' : ''}
                            ${end ? 'rounded-l-none ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-gray-900' : ''}
                            ${start && end ? 'rounded-lg' : ''}
                          `}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
            {startValue && (
              <div className="mt-3 flex justify-between text-[11px] font-bold text-gray-500 px-2">
                <span>开始: {startValue.toLocaleDateString()}</span>
                {endValue && <span>结束: {endValue.toLocaleDateString()}</span>}
              </div>
            )}
          </section>

          {/* Habit Selection */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                <CheckSquare size={18} className="text-emerald-500" />
                <h4 className="font-bold">选择习惯 (每日记录)</h4>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSelectedHabitIds(habits.map(h => h.id))} className="text-[10px] font-bold px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors">全选</button>
                <button onClick={() => setSelectedHabitIds([])} className="text-[10px] font-bold px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors">全不选</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {habits.map(habit => (
                <button
                  key={habit.id}
                  onClick={() => setSelectedHabitIds(prev => prev.includes(habit.id) ? prev.filter(id => id !== habit.id) : [...prev, habit.id])}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-left
                    ${selectedHabitIds.includes(habit.id) 
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' 
                      : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 opacity-60'}`}
                >
                  {selectedHabitIds.includes(habit.id) ? (
                    <CheckSquare size={16} className="text-emerald-500 shrink-0" />
                  ) : (
                    <Square size={16} className="text-gray-300 shrink-0" />
                  )}
                  <span className="text-xs font-bold truncate tracking-tight">{habit.content}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Tag Selection */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                <CheckSquare size={18} className="text-purple-500" />
                <h4 className="font-bold">选择标签 (特殊记录)</h4>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSelectedTagIds(tags.map(t => t.id))} className="text-[10px] font-bold px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors">全选</button>
                <button onClick={() => setSelectedTagIds([])} className="text-[10px] font-bold px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors">全不选</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTagIds(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all
                    ${selectedTagIds.includes(tag.id) 
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10' 
                      : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 opacity-60'}`}
                >
                  <span className="text-xs font-bold">#{tag.name}</span>
                </button>
              ))}
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex gap-4 bg-gray-50/30 dark:bg-gray-800/30">
          <button 
            onClick={onClose}
            disabled={isGenerating}
            className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-2xl transition-all disabled:opacity-50"
          >
            取消
          </button>
          <button 
            disabled={!startValue || !endValue || isGenerating}
            onClick={handleStartGenerate}
            className="flex-[2] py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>正在准备数据...</span>
              </>
            ) : (
              <span>开始生成</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
