import { useMemo } from 'react';
import { Clock, Edit3, Plus } from 'lucide-react';
import type { SpecialRecord, RecordTag, CalendarRecord } from '../types';

interface TimelineViewProps {
  records: SpecialRecord[];
  tags: RecordTag[];
  onEditRecord: (record: SpecialRecord, dateStr: string) => void;
  onPreviewImage: (url: string) => void;
  onOpenModal: (date: Date | null, recordToEdit?: {record: CalendarRecord, dateStr: string}) => void;
  filterTagIds: string[];
  hideAllSpecialEvents: boolean;
}

export function TimelineView({ 
  records, 
  tags, 
  onEditRecord, 
  onPreviewImage,
  onOpenModal,
  filterTagIds,
  hideAllSpecialEvents
}: TimelineViewProps) {
  // Group records by date string, sorted descending
  const groupedRecords = useMemo(() => {
    const groups: { [key: string]: SpecialRecord[] } = {};
    
    // Sort records by date string descending, applying filters
    const sortedRecords = [...records]
      .filter(record => {
        if (hideAllSpecialEvents) return false;
        if (filterTagIds && filterTagIds.length > 0) {
          return (record.tagIds || []).some(tagId => filterTagIds.includes(tagId));
        }
        return true;
      })
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
    
    sortedRecords.forEach(record => {
      if (!groups[record.dateStr]) {
        groups[record.dateStr] = [];
      }
      groups[record.dateStr].push(record);
    });
    
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [records]);

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    
    // Format Month name in English for magazine feel
    const monthName = date.toLocaleDateString('en-US', { month: 'long' });
    const day = String(d).padStart(2, '0');
    const weekday = date.toLocaleDateString('zh-CN', { weekday: 'long' });
    
    return { day, monthName, weekday };
  };

  const getTagName = (tagId: string) => {
    return tags.find(t => t.id === tagId)?.name || '未知标签';
  };

  return (
    <div className="relative max-w-2xl mx-auto px-4 sm:px-6 py-8 transition-all duration-500">
      {/* Floating Add Button */}
      <button 
        onClick={() => onOpenModal(new Date())}
        className="fixed top-6 left-6 z-40 bg-gradient-to-tr from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 text-white p-4 rounded-2xl shadow-xl hover:shadow-2xl shadow-blue-500/30 hover:-translate-y-1 transition-all group border border-white/10"
      >
        <Plus size={28} className="group-hover:rotate-90 transition-transform duration-500" />
      </button>

      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 transition-opacity duration-500">
          <Clock size={48} className="mb-4 opacity-20" />
          <p className="text-lg font-medium">尚无记录，开始记录你的生活吧 ✨</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedRecords.map(([dateStr, items]) => {
            const { day, monthName, weekday } = formatDate(dateStr);
            
            return (
              <div key={dateStr} className="relative group">
                {/* Date Header */}
                <div className="flex items-baseline gap-3 mb-4 pl-1">
                  <span className="text-3xl font-black text-slate-900 tracking-tighter">{day}</span>
                  <span className="text-xl font-bold text-slate-400 italic tracking-tight uppercase">{monthName}</span>
                  <span className="text-xs font-bold text-slate-300 uppercase letter-spacing-[0.1em]">{weekday}</span>
                </div>

                {/* Card Container */}
                <div className="bg-white dark:bg-gray-800 rounded-[32px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 dark:border-gray-700/50 overflow-hidden transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
                  {items.map((record, index) => (
                    <div 
                      key={record.id} 
                      className={`p-4 sm:p-6 transition-colors ${
                        index > 0 ? 'border-t border-gray-50 dark:border-gray-700/50' : ''
                      }`}
                    >
                      <div className="flex gap-4">
                        {/* Accent Line */}
                        <div className="w-1 rounded-full shrink-0" style={{ backgroundColor: record.color?.bg || '#cbd5e1' }} />
                        
                        <div className="flex-1 space-y-3">
                          {/* Title & Tags */}
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100 leading-tight">
                                {record.title}
                              </h3>
                              {(record.tagIds ?? []).length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {(record.tagIds ?? []).map(tagId => (
                                    <span key={tagId} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                      {getTagName(tagId)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            
                            {/* Edit Button */}
                            <button 
                              onClick={() => onEditRecord(record, record.dateStr)}
                              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-slate-400 hover:text-blue-500 transition-all active:scale-90"
                              title="编辑记录"
                            >
                              <Edit3 size={18} />
                            </button>
                          </div>

                          {/* Image Grid (Ins Style) */}
                          {record.imageUrls && record.imageUrls.length > 0 && (
                            <div className={`mt-4 rounded-2xl overflow-hidden grid gap-1 ${
                              record.imageUrls.length === 1 ? 'grid-cols-1' : 
                              record.imageUrls.length === 2 ? 'grid-cols-2 aspect-[16/9]' :
                              'grid-cols-2 aspect-square'
                            }`}>
                              {record.imageUrls.slice(0, 4).map((url, i) => (
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
    </div>
  );
}
