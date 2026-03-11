import { useState, useMemo, useEffect } from 'react';
import type { CalendarRecord, RecordTag } from '../types';

// Defines a Calendar Cell
export interface DateCell {
  date: Date | null; // null means padding before start or after end
  label: string; // "1", "2"... "31"
  isToday: boolean;
}

export const useCalendarData = (userId?: string | null) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const RECORDS_KEY = userId ? `calendar_records_${userId}` : 'calendar_records';
  const TAGS_KEY = userId ? `calendar_tags_${userId}` : 'calendar_tags';

  const [records, setRecords] = useState<CalendarRecord[]>([]);
  const [tags, setTags] = useState<RecordTag[]>([]);

  useEffect(() => {
    const savedRecords = localStorage.getItem(RECORDS_KEY);
    const savedTags = localStorage.getItem(TAGS_KEY);
    setRecords(savedRecords ? JSON.parse(savedRecords) : []);
    setTags(savedTags ? JSON.parse(savedTags) : [
      { id: 'tag_work', name: '工作' },
      { id: 'tag_life', name: '生活' },
      { id: 'tag_health', name: '运动' }
    ]);
  }, [userId, RECORDS_KEY, TAGS_KEY]);

  useEffect(() => {
    if (records.length > 0 || localStorage.getItem(RECORDS_KEY)) {
      localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    }
  }, [records, RECORDS_KEY]);

  useEffect(() => {
    if (tags.length > 0 || localStorage.getItem(TAGS_KEY)) {
      localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
    }
  }, [tags, TAGS_KEY]);

  const nextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const addRecord = (record: CalendarRecord) => {
    setRecords(prev => [...prev, record]);
  };

  const updateRecord = (record: CalendarRecord) => {
    setRecords(prev => prev.map(r => r.id === record.id ? record : r));
  };

  const deleteRecord = (id: string, type: 'daily' | 'special') => {
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  const addTag = (tag: RecordTag) => {
    setTags(prev => [...prev, tag]);
  };

  const deleteTag = (tagId: string) => {
    setTags(prev => prev.filter(t => t.id !== tagId));
    // Also remove tag from records
    setRecords(prev => prev.map(r => {
      if (r.type === 'special' && r.tagIds.includes(tagId)) {
        return { ...r, tagIds: r.tagIds.filter(id => id !== tagId) };
      }
      return r;
    }));
  };

  const weeks = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    const generatedWeeks: DateCell[][] = [];
    let currentWeek: DateCell[] = [];
    
    const firstDayOfWeek = firstDayOfMonth.getDay();
    
    // Padding
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push({ date: null, label: '', isToday: false });
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      if (currentWeek.length === 7) {
        generatedWeeks.push(currentWeek);
        currentWeek = [];
      }
      
      const cellDate = new Date(year, month, day);
      const isToday = cellDate.getTime() === today.getTime();

      currentWeek.push({
        date: cellDate,
        label: String(day),
        isToday
      });
    }
    
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: null, label: '', isToday: false });
      }
      generatedWeeks.push(currentWeek);
    }
    
    return generatedWeeks;
  }, [currentMonth]);

  return { 
    currentMonth, 
    weeks, 
    setCurrentMonth,
    nextMonth, 
    prevMonth,
    records,
    tags,
    addRecord,
    updateRecord,
    deleteRecord,
    addTag,
    deleteTag
  };
};
