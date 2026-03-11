/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { X, Check, Trash2, Eye, EyeOff, RotateCcw, Camera } from 'lucide-react';
import { presetColors } from '../utils/colors';
import type { CalendarColor } from '../utils/colors';
import type { CalendarRecord, RecordTag, DailyRecord, SpecialRecord } from '../types';

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  onAddRecord: (record: CalendarRecord) => void;
  onUpdateRecord: (record: CalendarRecord) => void;
  onDeleteRecord: (id: string, type: 'daily' | 'special', content?: string) => void;
  editingRecord: {record: CalendarRecord, dateStr: string} | null;
  tags: RecordTag[];
  onAddTag: (tag: RecordTag) => void;
  onDeleteTag: (tagId: string) => void;
  records: CalendarRecord[];
  // Filtering props
  filterTagIds: string[];
  setFilterTagIds: React.Dispatch<React.SetStateAction<string[]>>;
  hideAllSpecialEvents: boolean;
  setHideAllSpecialEvents: React.Dispatch<React.SetStateAction<boolean>>;
}

const WEEKDAYS = [
  { label: '日', value: 0 },
  { label: '一', value: 1 },
  { label: '二', value: 2 },
  { label: '三', value: 3 },
  { label: '四', value: 4 },
  { label: '五', value: 5 },
  { label: '六', value: 6 },
];

export function RecordModal({ 
  isOpen, 
  onClose, 
  selectedDate, 
  onAddRecord, 
  onUpdateRecord, 
  onDeleteRecord, 
  editingRecord, 
  tags, 
  onAddTag, 
  onDeleteTag, 
  records,
  filterTagIds,
  setFilterTagIds,
  hideAllSpecialEvents,
  setHideAllSpecialEvents
}: RecordModalProps) {
  const [activeTab, setActiveTab] = useState<'daily' | 'special'>('daily');
  
  // Default color fallback
  const defaultColors = presetColors && presetColors.length > 0 ? presetColors : [{ bg: '#3b82f6', text: '#ffffff' }];
  const defaultColor = defaultColors[0];

  // Daily Record State
  const [dailyContent, setDailyContent] = useState('');
  const [selectedColor, setSelectedColor] = useState<CalendarColor>(defaultColor);
  const [repeatDays, setRepeatDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  // Special Record State
  const [specialTitle, setSpecialTitle] = useState('');
  const [selYear, setSelYear] = useState(new Date().getFullYear());
  const [selMonth, setSelMonth] = useState(new Date().getMonth() + 1);
  const [selDay, setSelDay] = useState(new Date().getDate());
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [specialColor, setSpecialColor] = useState<CalendarColor>(defaultColor);
  const [dateError, setDateError] = useState('');
  
  // New Tag State
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  // Image Upload State
  const [specialImages, setSpecialImages] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);

  // Image Compression Utility
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1000;

          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Defensive arrays
  const safeTags = tags || [];
  const safeRecords = records || [];

  // Reset states when modal opens
  useEffect(() => {
    if (isOpen) {
      if (editingRecord) {
        const rec = editingRecord.record;
        if (rec.type === 'daily') {
          setActiveTab('daily');
          setDailyContent(rec.content || '');
          setSelectedColor(rec.color || defaultColor);
          setRepeatDays(rec.repeatDays || [0, 1, 2, 3, 4, 5, 6]);
        } else {
          setActiveTab('special');
          const spec = rec as SpecialRecord;
          setSpecialTitle(spec.title || '');
          const dateParts = spec.dateStr?.split('-').map(Number) || [];
          if (dateParts.length === 3) {
            setSelYear(dateParts[0]);
            setSelMonth(dateParts[1]);
            setSelDay(dateParts[2]);
          }
           setSelectedTagIds(spec.tagIds || []);
          setSpecialColor(spec.color || defaultColor);
          setSpecialImages(spec.imageUrls || []);
        }
      } else {
        setDailyContent('');
        setSelectedColor(defaultColor);
        setRepeatDays([0, 1, 2, 3, 4, 5, 6]);
        
        setSpecialTitle('');
        setDateError('');
        
        if (selectedDate) {
          setSelYear(selectedDate.getFullYear());
          setSelMonth(selectedDate.getMonth() + 1);
          setSelDay(selectedDate.getDate());
        }
        
        setSelectedTagIds([]);
        const initialSpecialColor = (defaultColors.length > 10) ? defaultColors[10] : defaultColor;
        setSpecialColor(initialSpecialColor); 
        setSpecialImages([]);
      }
      setIsAddingTag(false);
      setNewTagName('');
    }
  }, [isOpen]); 

  if (!isOpen) return null;

  

  const isValidDate = (year: number, month: number, day: number) => {
    const d = new Date(year, month - 1, day);
    return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
  };

  const currentYears = Array.from({ length: 151 }, (_, i) => 2000 + i);
  const currentMonths = Array.from({ length: 12 }, (_, i) => i + 1);
  const currentDays = Array.from({ length: 31 }, (_, i) => i + 1);

  const handleSaveDaily = () => {
    if (!dailyContent.trim()) return;
    onAddRecord({
      id: `daily_${Date.now()}`,
      type: 'daily',
      createdAt: Date.now(),
      content: dailyContent.trim(),
      color: selectedColor,
      completedDates: [],
      repeatDays: repeatDays,
    });
    setDailyContent('');
    onClose(); 
  };

  const handleSaveSpecial = () => {
    if (!specialTitle.trim()) return;
    if (!isValidDate(selYear, selMonth, selDay)) {
      setDateError('请输入正确的日期');
      return;
    }
    setDateError('');

    const dateStr = `${selYear}-${String(selMonth).padStart(2, '0')}-${String(selDay).padStart(2, '0')}`;

    if (editingRecord && editingRecord.record.type === 'special') {
      onUpdateRecord({
        ...editingRecord.record,
        title: specialTitle.trim(),
        dateStr,
        tagIds: selectedTagIds,
        color: specialColor,
        imageUrls: specialImages,
      } as SpecialRecord);
    } else {
      onAddRecord({
        id: `special_${Date.now()}`,
        type: 'special',
        createdAt: Date.now(),
        title: specialTitle.trim(),
        dateStr,
        tagIds: selectedTagIds,
        color: specialColor,
        imageUrls: specialImages,
      } as SpecialRecord);
    }
    onClose();
  };

  const handleAddNewTag = () => {
    if (newTagName.trim()) {
      const newTag = { id: `tag_${Date.now()}`, name: newTagName.trim() };
      onAddTag(newTag);
      setSelectedTagIds(prev => [...prev, newTag.id]);
      setIsAddingTag(false);
      setNewTagName('');
    }
  };

  const handleUpdateHabitInline = (habit: DailyRecord, updates: Partial<DailyRecord>) => {
    onUpdateRecord({ ...habit, ...updates });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700/50 shrink-0">
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent text-center">
            {editingRecord ? (editingRecord.record.type === 'daily' ? '养成管理' : '编辑记录') : (activeTab === 'daily' ? '每日习惯' : '特殊记录')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-full transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>
        
        {/* Tabs */}
        {!editingRecord && (
          <div className="flex border-b border-gray-100 dark:border-gray-700/50 shrink-0">
            <button
              className={`flex-1 py-4 text-sm font-semibold transition-all relative ${activeTab === 'daily' ? 'text-blue-600 bg-blue-50/50 dark:bg-blue-900/10' : 'text-gray-500'}`}
              onClick={() => setActiveTab('daily')}
            >
              每日习惯
              {activeTab === 'daily' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.8)]" />}
            </button>
            <button
              className={`flex-1 py-4 text-sm font-semibold transition-all relative ${activeTab === 'special' ? 'text-purple-600 bg-purple-50/50 dark:bg-purple-900/10' : 'text-gray-500'}`}
              onClick={() => setActiveTab('special')}
            >
              特殊记录
              {activeTab === 'special' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-600 shadow-[0_0_8px_rgba(147,51,234,0.8)]" />}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'daily' ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Part 1: New Habit form (Refined) */}
              <div className="p-6 pb-4 space-y-5 shrink-0">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">🚀 新建习惯</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={dailyContent}
                      onChange={(e) => setDailyContent(e.target.value)}
                      className="flex-1 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400 text-sm"
                      placeholder="习惯名称，例如：阅读..."
                      maxLength={20}
                    />
                    <button 
                      onClick={handleSaveDaily} 
                      disabled={!dailyContent.trim() || repeatDays.length === 0} 
                      className="px-6 bg-blue-600 disabled:bg-gray-400 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 text-sm"
                    >
                      创建
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">📅 周期选择</label>
                  <div className="flex justify-between gap-1">
                    {WEEKDAYS.map((day) => (
                      <button
                        key={day.value}
                        onClick={() => setRepeatDays(prev => prev.includes(day.value) ? prev.filter(d => d !== day.value) : [...prev, day.value].sort())}
                        className={`flex-1 py-1.5 rounded-lg border-[1.5px] font-bold text-xs transition-all ${
                          repeatDays.includes(day.value) ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">🎨 主题色库</label>
                  <div className="grid grid-cols-12 gap-1.5 px-1 pt-3 h-auto overflow-x-hidden">
                    {defaultColors.map((color, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedColor(color)}
                        style={{ backgroundColor: color.bg }}
                        className={`aspect-square rounded-full border-2 transition-all ${selectedColor.bg === color.bg ? 'border-blue-500 scale-125 shadow-md' : 'border-transparent hover:scale-110'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="h-px bg-gray-100 dark:bg-gray-700/50 mx-6" />

              {/* Part 2: Manage list (Advanced Inline Editing) */}
              <div className="flex-1 overflow-hidden p-6 pt-4 flex flex-col min-h-0">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">现有习惯管理</h3>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-v" style={{ maxHeight: '200px' }}>
                  {safeRecords.filter(r => r.type === 'daily').map(record => {
                    const habit = record as DailyRecord;
                    return (
                      <div key={habit.id} className="flex flex-col gap-3 p-4 bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm group hover:border-blue-200 transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: habit.color?.bg }} />
                            <input 
                              type="text"
                              defaultValue={habit.content}
                              onBlur={(e) => {
                                if (e.target.value.trim() && e.target.value !== habit.content) {
                                  handleUpdateHabitInline(habit, { content: e.target.value.trim() });
                                }
                              }}
                              className="bg-transparent border-none outline-none text-sm font-semibold text-gray-800 dark:text-gray-100 w-full focus:text-blue-600 transition-colors overflow-hidden truncate"
                            />
                          </div>
                          <button 
                            onClick={() => onDeleteRecord(habit.id, 'daily', habit.content)} 
                            className="p-2 text-gray-300 hover:text-red-500 rounded-xl transition-all opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="flex items-center justify-start gap-2 pl-6">
                          {WEEKDAYS.map((day) => {
                            const isSelected = habit.repeatDays?.includes(day.value);
                            return (
                              <button
                                key={day.value}
                                onClick={() => {
                                  const cDays = habit.repeatDays || [0, 1, 2, 3, 4, 5, 6];
                                  const nDays = isSelected ? cDays.filter(d => d !== day.value) : [...cDays, day.value].sort();
                                  if (nDays.length > 0) handleUpdateHabitInline(habit, { repeatDays: nDays });
                                }}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                  isSelected ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {safeRecords.filter(r => r.type === 'daily').length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                      <p className="text-xs italic">暂无现有习惯 ✨</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6 overflow-y-auto flex-1 animate-in slide-in-from-right-2 duration-300">
              {/* Event Form */}
              <div className="space-y-5 border-b border-gray-100 dark:border-gray-700/50 pb-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">📝 事件名称</label>
                  <input 
                    type="text"
                    value={specialTitle}
                    onChange={(e) => setSpecialTitle(e.target.value)}
                    className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder:text-gray-400 text-sm"
                    placeholder="请输入事件名称"
                    maxLength={30}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">📅 选择日期</label>
                  <div className="grid grid-cols-3 gap-2">
                    <select value={selYear} onChange={e => setSelYear(Number(e.target.value))} className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 outline-none text-sm">
                      {currentYears.map(v => <option key={v} value={v}>{v}年</option>)}
                    </select>
                    <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))} className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 outline-none text-sm">
                      {currentMonths.map(v => <option key={v} value={v}>{v}月</option>)}
                    </select>
                    <select value={selDay} onChange={e => setSelDay(Number(e.target.value))} className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 outline-none text-sm">
                      {currentDays.map(v => <option key={v} value={v}>{v}日</option>)}
                    </select>
                  </div>
                  {dateError && <p className="text-red-500 text-xs mt-1">{dateError}</p>}
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">🏷️ 标签</label>
                  <div className="flex flex-wrap gap-2">
                    {safeTags.map(tag => (
                      <div key={tag.id} className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs transition-all shadow-sm ${
                        selectedTagIds.includes(tag.id) ? 'bg-gray-800 text-white border-gray-800 dark:bg-gray-200 dark:text-gray-900' : 'bg-white text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-200'
                      }`}>
                        <button onClick={() => setSelectedTagIds(prev => prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id])} className="flex-1">
                          {tag.name}
                        </button>
                        <button onClick={() => onDeleteTag(tag.id)} className="text-gray-400 hover:text-red-500 ml-1">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {isAddingTag ? (
                      <div className="flex items-center gap-1">
                        <input autoFocus value={newTagName} onChange={e => setNewTagName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddNewTag()} className="px-3 py-1.5 rounded-full border border-purple-400 text-xs w-24 bg-white dark:bg-gray-900 outline-none" placeholder="标签名..." />
                        <button onClick={handleAddNewTag} className="p-1.5 bg-purple-600 text-white rounded-full transition-all active:scale-90"><Check size={14} /></button>
                        <button onClick={() => setIsAddingTag(false)} className="p-1.5 bg-gray-200 text-gray-600 rounded-full"><X size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => setIsAddingTag(true)} className="px-3 py-1.5 rounded-full border border-dashed border-gray-400 text-gray-400 text-xs flex items-center gap-1 hover:bg-gray-50">+ 添加标签</button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">🖼️ 附件图片 (可多选)</label>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed transition-all cursor-pointer border-gray-200 dark:border-gray-700 hover:border-purple-400`}>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          multiple
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length > 0) {
                              setIsCompressing(true);
                              try {
                                const newImages = await Promise.all(
                                  files.map(file => compressImage(file))
                                );
                                setSpecialImages(prev => [...prev, ...newImages]);
                              } finally {
                                setIsCompressing(false);
                              }
                            }
                          }}
                        />
                        {isCompressing ? (
                          <div className="w-4 h-4 border-2 border-purple-600/30 border-t-purple-600 rounded-full animate-spin" />
                        ) : (
                          <Camera size={18} className="text-gray-400" />
                        )}
                        <span className="text-xs font-bold text-gray-500">
                          {isCompressing ? '处理中...' : (specialImages.length > 0 ? `已添加 ${specialImages.length} 张图片` : '添加图片')}
                        </span>
                      </label>
                    </div>

                    {/* Preview Gallery */}
                    {specialImages.length > 0 && (
                      <div className="flex flex-wrap gap-2.5 mt-1 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-800">
                        {specialImages.map((img, idx) => (
                          <div key={idx} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                            <img src={img} className="w-full h-full object-cover" alt="preview" />
                            <button 
                              onClick={() => setSpecialImages(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute top-1 right-1 p-0.5 bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">🎨 点缀颜色</label>
                  <div className="grid grid-cols-12 gap-1.5 px-1 pt-3 h-auto">
                    {defaultColors.map((color, i) => (
                      <button
                        key={i}
                        onClick={() => setSpecialColor(color)}
                        style={{ backgroundColor: color.bg }}
                        className={`aspect-square rounded-full border-2 transition-all ${specialColor.bg === color.bg ? 'border-purple-500 scale-125 shadow-md' : 'border-transparent hover:scale-110'}`}
                      >
                        {specialColor.bg === color.bg && <Check size={10} style={{ color: color.text }} className="mx-auto" />}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleSaveSpecial}
                  disabled={!specialTitle.trim()}
                  className="w-full py-4 bg-purple-600 disabled:bg-gray-400 text-white rounded-xl font-bold shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] text-sm"
                >
                  {editingRecord && editingRecord.record.type === 'special' ? '保存修改' : '保存特殊事件'}
                </button>

                {editingRecord && editingRecord.record.type === 'special' && (
                  <div className="mt-3">
                    <button 
                      onClick={() => { 
                        onDeleteRecord(editingRecord.record.id, 'special'); 
                        setSpecialTitle('');
                        onClose(); 
                      }}
                      className="w-full py-3.5 bg-transparent border-2 border-red-50 text-red-500 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors"
                    >
                      删除此记录
                    </button>
                  </div>
                )}
              </div>

              {/* Divider between individual action and global display settings */}
              <div className="h-px bg-gray-100 dark:bg-gray-700/50" />

              {/* Display Settings Section (Global View Control) */}
              <div id="display-settings" className="space-y-5 py-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    ⚙️ 显示设置
                  </label>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setFilterTagIds([])}
                      title="重置过滤"
                      className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-colors"
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button 
                      onClick={() => setHideAllSpecialEvents(prev => !prev)}
                      title={hideAllSpecialEvents ? "显示所有" : "隐藏所有"}
                      className={`p-2 rounded-lg transition-colors ${hideAllSpecialEvents ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}
                    >
                      {hideAllSpecialEvents ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">按标签过滤显示</p>
                  <div className="flex flex-wrap gap-2">
                    {safeTags.map(tag => (
                      <button
                        key={`filter-${tag.id}`}
                        onClick={() => {
                          setFilterTagIds(prev => 
                            prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                          filterTagIds.includes(tag.id)
                            ? 'bg-purple-600 border-purple-600 text-white shadow-md scale-105'
                            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-purple-300'
                        }`}
                      >
                        {tag.name}
                      </button>
                    ))}
                    {safeTags.length === 0 && <p className="text-xs italic text-gray-400">尚无标签可过滤</p>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
