/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { X, Check, Trash2, Eye, EyeOff, RotateCcw, Camera } from 'lucide-react';
import { presetColors } from '../utils/colors';
import type { CalendarColor } from '../utils/colors';
import type { CalendarRecord, RecordTag, DailyRecord, SpecialRecord } from '../types';
import { uploadImages } from '../hooks/useSupabaseData';

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  onAddRecord: (record: CalendarRecord) => void;
  onUpdateRecord: (record: CalendarRecord) => void;
  onDeleteRecord: (id: string, type: 'daily' | 'special', content?: string) => void;
  editingRecord: { record: CalendarRecord, dateStr: string } | null;
  tags: RecordTag[];
  allAvailableTags: RecordTag[];   // Cloud tag suggestions from Supabase
  onAddTag: (tag: RecordTag) => Promise<RecordTag | null>;
  onDeleteTag: (tagId: string) => void;
  records: CalendarRecord[];
  // Filtering props
  filterTagIds: string[];
  setFilterTagIds: React.Dispatch<React.SetStateAction<string[]>>;
  hideAllSpecialEvents: boolean;
  setHideAllSpecialEvents: React.Dispatch<React.SetStateAction<boolean>>;
  onPreviewImage: (url: string) => void;
  showRainbowBorder: boolean;
  setShowRainbowBorder: (show: boolean) => void;
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
  allAvailableTags,
  onAddTag,
  onDeleteTag,
  records,
  filterTagIds,
  setFilterTagIds,
  hideAllSpecialEvents,
  setHideAllSpecialEvents,
  onPreviewImage,
  showRainbowBorder,
  setShowRainbowBorder
}: RecordModalProps) {
  const [activeTab, setActiveTab] = useState<'daily' | 'special'>('daily');

  // Default color fallback
  const defaultColors = presetColors && presetColors.length > 0 ? presetColors : [{ bg: '#3b82f6', text: '#ffffff' }];
  const defaultColor = defaultColors[0];

  // Daily Record State
  const [dailyContent, setDailyContent] = useState('');
  const [selectedColor, setSelectedColor] = useState<CalendarColor>(defaultColor);
  const [repeatDays, setRepeatDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [habitStartDate, setHabitStartDate] = useState('');
  const [habitEndDate, setHabitEndDate] = useState('');

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
  // existingImageUrls = already-uploaded cloud URLs (when editing a record)
  // newImageFiles     = File objects the user just picked (not yet uploaded)
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Local preview URLs for new files (revoked on unmount)
  const newImagePreviews = newImageFiles.map(f => URL.createObjectURL(f));

  // Inline Editing State for Existing Habits
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editHabitName, setEditHabitName] = useState('');
  const [editHabitDays, setEditHabitDays] = useState<number[]>([]);
  const [editHabitColor, setEditHabitColor] = useState<CalendarColor>(defaultColor);
  const [editHabitStartDate, setEditHabitStartDate] = useState('');
  const [editHabitEndDate, setEditHabitEndDate] = useState('');

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
          setHabitStartDate(rec.startDate || '');
          setHabitEndDate(rec.endDate || '');
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
          setExistingImageUrls(spec.imageUrls || []);
          setNewImageFiles([]);
        }
      } else {
        setDailyContent('');
        setSelectedColor(defaultColor);
        setRepeatDays([0, 1, 2, 3, 4, 5, 6]);
        setHabitStartDate('');
        setHabitEndDate('');

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
        setExistingImageUrls([]);
        setNewImageFiles([]);
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
      startDate: habitStartDate || undefined,
      endDate: habitEndDate || undefined,
    });
    setDailyContent('');
    setHabitStartDate('');
    setHabitEndDate('');
    onClose();
  };

  const handleSaveSpecial = async () => {
    if (!specialTitle.trim()) return;
    if (!isValidDate(selYear, selMonth, selDay)) {
      setDateError('请输入正确的日期');
      return;
    }
    setDateError('');
    setIsUploading(true);

    try {
      // Upload any new files to Supabase Storage
      const uploadedUrls = newImageFiles.length > 0
        ? await uploadImages(newImageFiles)
        : [];

      const allImageUrls = [...existingImageUrls, ...uploadedUrls];
      const dateStr = `${selYear}-${String(selMonth).padStart(2, '0')}-${String(selDay).padStart(2, '0')}`;

      if (editingRecord && editingRecord.record.type === 'special') {
        await onUpdateRecord({
          ...editingRecord.record,
          title: specialTitle.trim(),
          dateStr,
          tagIds: selectedTagIds,
          color: specialColor,
          imageUrls: allImageUrls,
        } as SpecialRecord);
      } else {
        await onAddRecord({
          id: `special_${Date.now()}`,
          type: 'special',
          createdAt: Date.now(),
          title: specialTitle.trim(),
          dateStr,
          tagIds: selectedTagIds,
          color: specialColor,
          imageUrls: allImageUrls,
        } as SpecialRecord);
      }
      onClose();
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddNewTag = async () => {
    if (newTagName.trim()) {
      const tempTag = { id: `tag_${Date.now()}`, name: newTagName.trim() };
      // addTag now returns the real record from Supabase (with UUID)
      const realTag = await onAddTag(tempTag);
      
      const tagToSelect = realTag || tempTag;
      setSelectedTagIds(prev => [...prev, tagToSelect.id]);
      
      setIsAddingTag(false);
      setNewTagName('');
    }
  };

  const handleUpdateHabitInline = (habit: DailyRecord, updates: Partial<DailyRecord>) => {
    onUpdateRecord({ ...habit, ...updates });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-opacity duration-200" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transition-all duration-200 flex flex-col max-h-[90vh]"
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
        <div className="flex-1 overflow-y-auto flex flex-col scrollbar-v px-6 py-6 space-y-8">
          {activeTab === 'daily' ? (
            <div className="flex flex-col space-y-8">
              {/* Part 1: New Habit form (Refined) */}
              <div className="space-y-6">
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
                        className={`flex-1 py-1.5 rounded-lg border-[1.5px] font-bold text-xs transition-all ${repeatDays.includes(day.value) ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400'
                          }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">📅 有效周期 (可选)</label>
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-1">
                      <span className="text-[10px] text-gray-400 font-bold uppercase pl-1">开始日期</span>
                      <input
                        type="date"
                        value={habitStartDate}
                        onChange={(e) => setHabitStartDate(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <span className="text-[10px] text-gray-400 font-bold uppercase pl-1">结束日期</span>
                      <input
                        type="date"
                        value={habitEndDate}
                        onChange={(e) => setHabitEndDate(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
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

              {/* Part 2: Manage list (Advanced Inline Editing) */}
              <div className="flex flex-col min-h-0">
                <div className="sticky top-[-24px] z-20 bg-white dark:bg-gray-800 py-4 mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest text-[10px] md:text-sm">现有习惯管理</h3>
                  
                  {/* Rainbow Toggle Switch */}
                  <div className="flex items-center gap-2 pr-1">
                    <span className="text-[10px] md:text-xs text-gray-400 font-medium">开启打卡视觉奖励</span>
                    <button
                      onClick={() => setShowRainbowBorder(!showRainbowBorder)}
                      className={`relative w-8 h-4.5 rounded-full transition-colors duration-200 outline-none ${showRainbowBorder ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full transition-transform duration-200 ${showRainbowBorder ? 'translate-x-3.5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  {safeRecords.filter(r => r.type === 'daily').map(record => {
                    const habit = record as DailyRecord;
                    const isEditing = editingHabitId === habit.id;

                    if (isEditing) {
                      return (
                        <div key={habit.id} className="flex flex-col gap-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border-2 border-blue-400/50 shadow-md">
                          <input
                            type="text"
                            value={editHabitName}
                            onChange={(e) => setEditHabitName(e.target.value)}
                            className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="习惯名称..."
                            autoFocus
                          />

                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">周期重复</label>
                            <div className="flex gap-1.5 overflow-x-auto pb-1">
                              {WEEKDAYS.map((day) => {
                                const active = editHabitDays.includes(day.value);
                                return (
                                  <button
                                    key={day.value}
                                    onClick={() => setEditHabitDays(prev =>
                                      active ? prev.filter(d => d !== day.value) : [...prev, day.value].sort()
                                    )}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all shrink-0 ${active ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-400 border border-gray-100 dark:border-gray-700'
                                      }`}
                                  >
                                    {day.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="space-y-2">
                             <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">有效周期</label>
                             <div className="flex gap-2">
                               <input
                                 type="date"
                                 value={editHabitStartDate}
                                 onChange={(e) => setEditHabitStartDate(e.target.value)}
                                 className="flex-1 p-2 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg text-[11px] outline-none"
                               />
                               <input
                                 type="date"
                                 value={editHabitEndDate}
                                 onChange={(e) => setEditHabitEndDate(e.target.value)}
                                 className="flex-1 p-2 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg text-[11px] outline-none"
                               />
                             </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">更换主题色</label>
                            <div className="flex flex-wrap gap-1.5 w-full bg-white/50 dark:bg-black/20 p-2 rounded-xl">
                              {defaultColors.map((color, i) => (
                                <button
                                  key={i}
                                  onClick={() => setEditHabitColor(color)}
                                  style={{ backgroundColor: color.bg }}
                                  className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 ${editHabitColor.bg === color.bg ? 'border-blue-500 scale-110 shadow-sm' : 'border-transparent hover:scale-105'}`}
                                />
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 mt-1">
                            <button
                              onClick={() => setEditingHabitId(null)}
                              className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 bg-gray-100 dark:bg-gray-800 rounded-lg"
                            >
                              取消
                            </button>
                            <button
                              onClick={() => {
                                if (editHabitName.trim()) {
                                  handleUpdateHabitInline(habit, {
                                    content: editHabitName.trim(),
                                    repeatDays: editHabitDays.length > 0 ? editHabitDays : [0, 1, 2, 3, 4, 5, 6],
                                    color: editHabitColor,
                                    startDate: editHabitStartDate || undefined,
                                    endDate: editHabitEndDate || undefined
                                  });
                                  setEditingHabitId(null);
                                }
                              }}
                              className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg shadow-lg shadow-blue-500/20"
                            >
                              保存
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={habit.id} className="flex flex-col gap-3 p-4 bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm group hover:border-blue-200 transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: habit.color?.bg }} />
                            <span
                              className="text-sm font-semibold text-gray-800 dark:text-gray-100 w-full overflow-hidden truncate cursor-pointer hover:text-blue-600"
                              onClick={() => {
                                setEditingHabitId(habit.id);
                                setEditHabitName(habit.content);
                                setEditHabitDays(habit.repeatDays || []);
                                setEditHabitColor(habit.color || defaultColor);
                                setEditHabitStartDate(habit.startDate || '');
                                setEditHabitEndDate(habit.endDate || '');
                              }}
                            >
                              {habit.content}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingHabitId(habit.id);
                                setEditHabitName(habit.content);
                                setEditHabitDays(habit.repeatDays || []);
                                setEditHabitColor(habit.color || defaultColor);
                                setEditHabitStartDate(habit.startDate || '');
                                setEditHabitEndDate(habit.endDate || '');
                              }}
                              className="p-2 text-gray-400 hover:text-blue-500 rounded-lg transition-all"
                              title="编辑"
                            >
                              <RotateCcw size={16} className="rotate-180" />
                            </button>
                            <button
                              onClick={() => onDeleteRecord(habit.id, 'daily', habit.content)}
                              className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-all"
                              title="删除"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-start gap-1 pl-6">
                          {WEEKDAYS.map((day) => {
                            const isSelected = habit.repeatDays?.includes(day.value);
                            return (
                              <div
                                key={day.value}
                                className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold transition-all ${isSelected ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-gray-50 dark:bg-gray-800 text-gray-300'
                                  }`}
                              >
                                {day.label}
                              </div>
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
            <div className="space-y-8">
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
                      <div key={tag.id} className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs transition-all shadow-sm ${selectedTagIds.includes(tag.id) ? 'bg-gray-800 text-white border-gray-800 dark:bg-gray-200 dark:text-gray-900' : 'bg-white text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-200'
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

                  {/* Cloud tag suggestion bubbles — tags saved in Supabase */}
                  {allAvailableTags.filter(t => !safeTags.some(s => s.id === t.id)).length > 0 && (
                    <div className="pt-1">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1.5">历史标签快选</p>
                      <div className="flex flex-wrap gap-1.5">
                        {allAvailableTags
                          .filter(t => !safeTags.some(s => s.id === t.id))
                          .map(tag => (
                            <button
                              key={tag.id}
                              onClick={() => {
                                // add to local tags list then select it
                                onAddTag(tag);
                                setSelectedTagIds(prev =>
                                  prev.includes(tag.id) ? prev : [...prev, tag.id]
                                );
                              }}
                              className="px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 text-[11px] font-medium hover:bg-purple-100 transition-all"
                            >
                              {tag.name}
                            </button>
                          ))
                        }
                      </div>
                    </div>
                  )}
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
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length > 0) {
                              setNewImageFiles(prev => [...prev, ...files]);
                            }
                          }}
                        />
                        {isUploading ? (
                          <div className="w-4 h-4 border-2 border-purple-600/30 border-t-purple-600 rounded-full animate-spin" />
                        ) : (
                          <Camera size={18} className="text-gray-400" />
                        )}
                        <span className="text-xs font-bold text-gray-500">
                          {isUploading ? '上传中...' : ((existingImageUrls.length + newImageFiles.length) > 0 ? `已添加 ${existingImageUrls.length + newImageFiles.length} 张图片` : '添加图片')}
                        </span>
                      </label>
                    </div>

                    {/* Preview Gallery — existing cloud URLs */}
                    {(existingImageUrls.length > 0 || newImageFiles.length > 0) && (
                      <div className="flex flex-wrap gap-2.5 mt-1 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-800">
                        {existingImageUrls.map((img, idx) => (
                          <div key={`existing-${idx}`} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm cursor-zoom-in active:scale-95 transition-transform" onClick={() => onPreviewImage(img)}>
                            <img src={img} className="w-full h-full object-cover" alt="preview" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExistingImageUrls(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="absolute top-1 right-1 p-1 md:p-0.5 bg-red-600 text-white rounded-md md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-lg"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        {/* New (pending upload) files shown as local previews */}
                        {newImagePreviews.map((preview, idx) => (
                          <div key={`new-${idx}`} className="relative group w-16 h-16 rounded-lg overflow-hidden border-2 border-purple-300 dark:border-purple-600 shadow-sm cursor-zoom-in active:scale-95 transition-transform" onClick={() => onPreviewImage(preview)}>
                            <img src={preview} className="w-full h-full object-cover" alt="new preview" />
                            <div className="absolute bottom-0 left-0 right-0 h-3 bg-purple-500/60 flex items-center justify-center">
                              <span className="text-[8px] text-white font-bold">待传</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewImageFiles(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="absolute top-1 right-1 p-1 md:p-0.5 bg-red-600 text-white rounded-md md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-lg"
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
                  disabled={!specialTitle.trim() || isUploading}
                  className="w-full py-4 bg-purple-600 disabled:bg-gray-400 text-white rounded-xl font-bold shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2"
                >
                  {isUploading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {isUploading ? '上传图片中...' : (editingRecord && editingRecord.record.type === 'special' ? '保存修改' : '保存特殊事件')}
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
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${filterTagIds.includes(tag.id)
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
