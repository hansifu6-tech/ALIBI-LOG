import { Sticker, CircleCheck, Theater, Utensils, Palmtree } from 'lucide-react';

export const modulesConfig = {
  general: {
    name: '普通模式',
    shortName: '普通',
    enName: 'Ordinary Record',
    icon: Sticker,
    color: '#64748b', // Slate 500
    parentTagName: '普通模式',
    tagType: 'default',
  },
  habit: {
    name: '打卡模式',
    shortName: '打卡',
    enName: 'Habit Tracking',
    icon: CircleCheck,
    color: '#3b82f6', // Blue 500
    toggleKey: 'alibi_habit_mode',
    stateKey: 'isHabitMode',
  },
  theatre: {
    name: '演出模式',
    shortName: '演出',
    enName: 'Show & Performance',
    icon: Theater,
    color: '#a855f7', // Purple 500
    toggleKey: 'alibi_theater_mode',
    stateKey: 'isTheaterMode',
    parentTagName: '演出模式',
    tagType: 'theatre',
  },
  food: {
    name: '美食模式',
    shortName: '美食',
    enName: 'Food Explorer',
    icon: Utensils,
    color: '#ffa500', // Orange 500
    toggleKey: 'alibi_food_mode',
    stateKey: 'isFoodMode',
    parentTagName: '美食模式',
    tagType: 'food',
  },
  travel: {
    name: '旅行模式',
    shortName: '旅行',
    enName: 'Travel Explorer',
    icon: Palmtree,
    color: '#10b981', // Emerald 500
    toggleKey: 'alibi_travel_mode',
    stateKey: 'isTravelMode',
    parentTagName: '旅行模式',
    tagType: 'travel',
  }
} as const;

