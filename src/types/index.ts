import type { CalendarColor } from '../utils/colors';

export interface BaseRecord {
  id: string;
  createdAt: number;
}

export interface DailyRecord extends BaseRecord {
  type: 'daily';
  content: string;
  color: CalendarColor;
  // completedDates tracks which specific dates this daily record was completed on
  // using YYYY-MM-DD string format
  completedDates: string[]; 
  repeatDays: number[]; // [0-6], 0 is Sunday
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

export interface SpecialRecord extends BaseRecord {
  type: 'special';
  title: string;
  dateStr: string; // YYYY-MM-DD format
  tagIds: string[];
  color: CalendarColor;
  imageUrls: string[];
}

export type CalendarRecord = DailyRecord | SpecialRecord;

export interface RecordTag {
  id: string;
  name: string;
}
