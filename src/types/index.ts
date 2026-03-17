import type { CalendarColor } from '../utils/colors';

export interface TheaterMetadata {
  city?: string | string[];
  club?: string;
  theater?: string;
  type?: string; 
  price?: number;
  score?: number;
  unit?: string;
  seat?: string;
  actors?: string;
  thought?: string;
  // POI fields for venue
  poiId?: string;
  poiName?: string;
  lat?: number;
  lng?: number;
  address?: string;
}

export interface NormalLocationData {
  name?: string;
  address?: string;
  poiId?: string;
  lat?: number;
  lng?: number;
  city?: string | [string, string];
}

export interface FoodMetadata {
  restaurant: string;
  address?: string;
  city?: string | [string, string];
  rating?: number;
  price?: number;
  comment?: string;
  dishes?: { name: string; rating?: number }[];
  poiId?: string;
  poiType?: string;
  lat?: number;
  lng?: number;
}

export interface TravelAttraction {
  name: string;
  poiId?: string;
  lat?: number;
  lng?: number;
  address?: string;
}

export interface TravelExpenseItem {
  name: string;   // e.g. "高铁票"
  amount: number; // price
}

export interface TravelExpenses {
  transport?: TravelExpenseItem[];      // 交通
  accommodation?: TravelExpenseItem[];  // 住宿
  tickets?: TravelExpenseItem[];        // 门票
  food?: TravelExpenseItem[];           // 饮食
  souvenirs?: TravelExpenseItem[];      // 纪念品特产
  other?: TravelExpenseItem[];          // 其他
}

export interface TravelMetadata {
  startDate: string;
  endDate: string;
  destinations: string[];
  expenses?: TravelExpenses;  // structured breakdown (new)
  totalSpend?: number;        // kept for backward compat (old records)
  attractions?: TravelAttraction[];
  linkedRecordIds?: string[];
  thought?: string;
}

export interface BaseRecord {
  id: string;
  createdAt: number;
  reflection?: string;
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
  extra_data?: TheaterMetadata | any;
}

export interface EventRecord extends BaseRecord {
  type: 'special';
  title: string;
  dateStr: string; // YYYY-MM-DD format
  tagIds: string[];
  tag_names: string[]; // Normalized string array of tag names (Phase 153)
  parent_tag?: string;  // Synthesized parent mode name (Phase 153)
  color: CalendarColor;
  imageUrls: string[];
  extra_data?: TheaterMetadata | TravelMetadata | any;
}

export type CalendarRecord = DailyRecord | EventRecord;

export interface RecordTag {
  id: string;
  name: string;
  tag_type?: string;
}

export const FUNCTION_MAP: Record<string, string> = {
  '演出模式': 'theatre',
  '美食模式': 'food',
  '普通模式': 'default',
  '旅行模式': 'travel'
};
