import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import type { CalendarRecord, DailyRecord, EventRecord, RecordTag } from '../types';

// ─────────────────────────────────────────────
// Error helper
// ─────────────────────────────────────────────
function reportError(context: string, error: unknown) {
  const msg = (error as { message?: string })?.message ?? String(error);
  console.error(`[Supabase] ${context}:`, error);
  alert(`❌ 操作失败 (${context})\n\n${msg}`);
}

// ─────────────────────────────────────────────
// Real Supabase schema:
//   id (uuid auto) | user_id | type | content | image_url | color | mood
//
// Field conventions:
//   Daily habit definition:  type='daily',   content=habitName, color=JSON, mood=NULL
//   Daily check-in row:      type='daily',   content=habitName, color=JSON, mood='2026-03-11'
//   Special record:          type='special', content=title,     color=JSON, mood='2026-03-11'(dateStr), image_url=url
// ─────────────────────────────────────────────

// Safely serialize color to store in a TEXT or JSONB column
function encodeColor(color: unknown): string {
  if (typeof color === 'string') return color;
  try { return JSON.stringify(color); } catch { return '{}'; }
}

// Guard: reject any base64 data URIs — only Storage URLs allowed
function safeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('data:')) {
    console.warn('[Supabase] Blocked base64 image_url — use Storage URL only');
    return null;
  }
  return url;
}

// Safely parse color from DB row
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeColor(raw: any): { bg: string; text: string } {
  if (!raw) return { bg: '#3b82f6', text: '#ffffff' };
  if (typeof raw === 'object' && raw.bg) return raw as { bg: string; text: string };
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return { bg: '#3b82f6', text: '#ffffff' }; }
  }
  return { bg: '#3b82f6', text: '#ffffff' };
}

// ─────────────────────────────────────────────
// Enrich EventRecord with tag_names and parent_tag (Phase 153/158)
// ─────────────────────────────────────────────
function enrichEventRecord(row: any, localTags: RecordTag[]): EventRecord {
  const storedTags: any[] = Array.isArray(row.tags) ? row.tags : [];
  
  const tagNames = storedTags
    .map(tag => {
      if (typeof tag === 'string') {
         const found = localTags.find(t => t.id === tag || t.name === tag);
         return found ? found.name : tag;
      }
      if (tag && typeof tag === 'object' && tag.name) {
        return tag.name;
      }
      return null;
    })
    .filter((name): name is string => !!name);

  let parentTag: string | undefined;
  if (tagNames.includes('演出模式')) parentTag = '演出模式';
  else if (tagNames.includes('普通模式')) parentTag = '普通模式';
  else if (tagNames.includes('美食模式')) parentTag = '美食模式';
  else if (tagNames.includes('旅行模式')) parentTag = '旅行模式';

  const tagIds = storedTags
    .map(tag => {
      if (typeof tag === 'string') {
        const byId = localTags.find(t => t.id === tag);
        if (byId) return byId.id;
        const byName = localTags.find(t => t.name === tag);
        if (byName) return byName.id;
        return null;
      }
      if (tag && typeof tag === 'object' && tag.name) {
        const found = localTags.find(t => t.name === tag.name);
        return found ? found.id : null;
      }
      return null;
    })
    .filter((id): id is string => !!id);

  return {
    id: String(row.id),
    type: 'special',
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    title: row.content ?? '',
    dateStr: row.mood ?? '',
    tagIds,
    tag_names: tagNames,
    parent_tag: parentTag,
    color: decodeColor(row.color),
    imageUrls: row.image_url ? [row.image_url] : [],
    reflection: row.extra_data?.thought || row.reflection || undefined,
    extra_data: row.extra_data || null,
  };
}

// ─────────────────────────────────────────────
// Aggregate raw daily rows into DailyRecord shapes
// Row with mood=null  → habit definition (provides id, content, color)
// Row with mood=date  → a completed check-in (date goes into completedDates)
// ─────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aggregateDailyRows(rows: any[]): DailyRecord[] {
  // Group by content (habit name)
  const map = new Map<string, { 
    id: string; 
    color: { bg: string; text: string }; 
    createdAt: number; 
    dates: string[]; 
    repeatDays: number[];
    startDate?: string;
    endDate?: string;
    reflection?: string;
    extra_data?: any;
  }>();

  for (const row of rows) {
    const content = row.content ?? '';
    const color = decodeColor(row.color);
    const createdAt = row.created_at ? new Date(row.created_at).getTime() : Date.now();
    const moodIsDate = typeof row.mood === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.mood);
    const rowStartDate = row.start_date;
    const rowEndDate = row.end_date;
    
    // repeatDays stored in 'tags' column of the definition row (mood is null)
    let rowRepeatDays: number[] | null = null;
    if (row.tags) {
      try {
        rowRepeatDays = Array.isArray(row.tags) ? row.tags.map(Number) : JSON.parse(row.tags).map(Number);
      } catch { /* fallback */ }
    }

    if (!map.has(content)) {
      map.set(content, { 
        id: String(row.id), 
        color, 
        createdAt, 
        dates: [], 
        repeatDays: [0, 1, 2, 3, 4, 5, 6],
        startDate: rowStartDate,
        endDate: rowEndDate,
        reflection: row.extra_data?.thought || row.reflection || undefined,
        extra_data: row.extra_data || null
      });
    }
    
    const entry = map.get(content)!;
    
    // If it's the definition row, capture the canonical ID, repeatDays, and range
    if (!moodIsDate) {
      if (rowStartDate) entry.startDate = rowStartDate;
      if (rowEndDate) entry.endDate = rowEndDate;
      if (row.extra_data?.thought || row.reflection) {
        entry.reflection = row.extra_data?.thought || row.reflection;
      }
      if (row.extra_data) entry.extra_data = row.extra_data;
    }
    if (rowRepeatDays) entry.repeatDays = rowRepeatDays;
    
    // Collect check-in dates
    if (moodIsDate) entry.dates.push(row.mood);
  }

  return Array.from(map.entries()).map(([content, { id, color, createdAt, dates, repeatDays, startDate, endDate, reflection, extra_data }]) => ({
    id,
    createdAt,
    type: 'daily',
    content,
    color,
    completedDates: dates,
    repeatDays,
    startDate,
    endDate,
    reflection,
    extra_data,
  }));
}

// ─────────────────────────────────────────────
// Image upload — always uses safe random filename
// ─────────────────────────────────────────────
export async function uploadImages(files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const safePath = `${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    const { error } = await supabase.storage.from('images').upload(safePath, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) {
      alert(`❌ 图片上传失败: ${error.message}`);
      continue;
    }
    const { data } = supabase.storage.from('images').getPublicUrl(safePath);
    urls.push(data.publicUrl);
  }
  return urls;
}

// ─────────────────────────────────────────────
// DateCell
// ─────────────────────────────────────────────
export interface DateCell {
  date: Date | null;
  label: string;
  isToday: boolean;
}

// ─────────────────────────────────────────────
// Tags — Supabase `tags` table (user_id, name)
// Also mirrored to localStorage as fast cache
// ─────────────────────────────────────────────
const DEFAULT_TAGS: RecordTag[] = [
  { id: 'tag_work', name: '工作' },
  { id: 'tag_life', name: '生活' },
  { id: 'tag_health', name: '运动' },
];

function loadTags(userId: string): RecordTag[] {
  try {
    const raw = localStorage.getItem(`alibi_tags_${userId}`);
    if (raw) return JSON.parse(raw) as RecordTag[];
  } catch { /* ignore */ }
  return DEFAULT_TAGS;
}
function saveTags(userId: string, tags: RecordTag[]) {
  localStorage.setItem(`alibi_tags_${userId}`, JSON.stringify(tags));
}

// ─────────────────────────────────────────────
// Main Hook
// ─────────────────────────────────────────────
export const useSupabaseData = (userId: string | null | undefined) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<CalendarRecord[]>([]);
  const [tags, setTags] = useState<RecordTag[]>(DEFAULT_TAGS);
  // allAvailableTags: union of Supabase cloud tags + local defaults
  const [allAvailableTags, setAllAvailableTags] = useState<RecordTag[]>(DEFAULT_TAGS);
  const [loading, setLoading] = useState(false);
  
  // Track debounced sync timers per habit content
  const pendingSyncs = useRef<Map<string, any>>(new Map());

  // Session init lock — reset when userId changes (logout/login)
  const isInitializedRef = useRef(false);

  const fetchRecords = useCallback(async () => {
    if (!userId) { setRecords([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('records')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) { reportError('fetchRecords', error); return; }
      
      const raw = data ?? [];
      const dailyRows = raw.filter((r: { type: string }) => r.type === 'daily');
      const specialRows = raw.filter((r: any) => r.type === 'special');

      const dailyRecords = aggregateDailyRows(dailyRows);
      
      const localTags = userId ? loadTags(userId) : DEFAULT_TAGS;
      const specialRecords = specialRows.map((row: any) => enrichEventRecord(row, localTags));

      setRecords([...dailyRecords, ...specialRecords]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // ─── fetchUserTags ────────────────────────────
  // Parent-tag init is inlined here to avoid the reactive loop:
  //   tags -> initializeParentTags -> useEffect -> fetchUserTags -> setTags -> tags
  // We check `cloudTags` (fresh DB data) instead of React state, breaking the cycle.
  const fetchUserTags = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('tags')
      .select('id, name, tag_type')
      .eq('user_id', userId);

    if (error) {
      console.warn('[Supabase] fetchUserTags error:', error.message);
      const cached = loadTags(userId);
      setTags(cached);
      setAllAvailableTags(cached);
      return;
    }

    const cloudTags: RecordTag[] = (data ?? []).map((row: any) => ({
      id: String(row.id),
      name: row.name,
      tag_type: row.tag_type,
    }));

    const merged = cloudTags.length > 0 ? cloudTags : DEFAULT_TAGS;
    setTags(merged);
    setAllAvailableTags(merged);
    saveTags(userId, merged);

    // ── One-time parent tag init per session ──────────────
    // isInitializedRef blocks re-entry even if fetchUserTags is called again later.
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const hasGeneral = cloudTags.some(t => t.name === '普通模式' && t.tag_type === 'function');
    const hasTheatre = cloudTags.some(t => t.name === '演出模式' && t.tag_type === 'function');
    const hasFood = cloudTags.some(t => t.name === '美食模式' && t.tag_type === 'function');
    const hasTravel = cloudTags.some(t => t.name === '旅行模式' && t.tag_type === 'function');

    if (hasGeneral && hasTheatre && hasFood && hasTravel) {
      console.log('[Supabase] 所有父标签完整，跳过注入。');
    } else {
      const toInsert = [
        ...(hasGeneral ? [] : [{ name: '普通模式', tag_type: 'function' }]),
        ...(hasTheatre ? [] : [{ name: '演出模式', tag_type: 'function' }]),
        ...(hasFood ? [] : [{ name: '美食模式', tag_type: 'function' }]),
        ...(hasTravel ? [] : [{ name: '旅行模式', tag_type: 'function' }]),
      ];
      console.log('[Supabase] 检测到缺失父标签，开始注入:', toInsert.map(t => t.name).join(', '));

      let anyInserted = false;
      for (const tag of toInsert) {
        const { error: insertErr } = await supabase
          .from('tags')
          .insert({ user_id: userId, name: tag.name, tag_type: tag.tag_type });
        if (insertErr) {
          console.error(`[Supabase] 注入 [${tag.name}] 失败:`, insertErr.message);
        } else {
          console.log(`[Supabase] 注入成功: [${tag.name}]`);
          anyInserted = true;
        }
      }

      // Re-fetch once after injection
      if (anyInserted) {
        const { data: refreshed } = await supabase
          .from('tags').select('id, name, tag_type').eq('user_id', userId);
        if (refreshed) {
          const fresh: RecordTag[] = refreshed.map((row: any) => ({
            id: String(row.id), name: row.name, tag_type: row.tag_type,
          }));
          setTags(fresh);
          setAllAvailableTags(fresh);
          saveTags(userId, fresh);
        }
      }
    }

    // ── Versioned travel sub-tag seeding (for existing users) ─────
    // Runs independently of main seeding. Existing users who already
    // passed the initial seed still get travel sub-tags.
    const travelSeedKey = `alibi_travel_tags_seeded_${userId}`;
    if (!localStorage.getItem(travelSeedKey)) {
      const { data: checkTags } = await supabase
        .from('tags').select('name, tag_type').eq('user_id', userId).eq('tag_type', 'travel');
      const existingTravel = checkTags ?? [];
      const travelDefaults = [
        { name: '自驾游', tag_type: 'travel' },
        { name: 'city walk', tag_type: 'travel' },
        { name: '出差', tag_type: 'travel' },
      ];
      const travelToSeed = travelDefaults.filter(d =>
        !existingTravel.some((e: any) => e.name === d.name)
      );
      if (travelToSeed.length > 0) {
        const rows = travelToSeed.map(d => ({ user_id: userId, name: d.name, tag_type: d.tag_type }));
        await supabase.from('tags').insert(rows);
        console.log(`[Supabase] Seeded ${travelToSeed.length} travel tags:`, travelToSeed.map(t => t.name).join(', '));
        const { data: finalTags } = await supabase
          .from('tags').select('id, name, tag_type').eq('user_id', userId);
        if (finalTags) {
          const final: RecordTag[] = finalTags.map((row: any) => ({
            id: String(row.id), name: row.name, tag_type: row.tag_type,
          }));
          setTags(final);
          setAllAvailableTags(final);
          saveTags(userId, final);
        }
      }
      localStorage.setItem(travelSeedKey, '1');
    }

    // ── One-time default sub-tag & global tag seeding ──────────────
    // Only seeds once per user (tracked by localStorage flag).
    // If user deletes these tags later, they won't be re-created.
    const seedKey = `alibi_defaults_seeded_${userId}`;
    if (localStorage.getItem(seedKey)) return;

    console.log('[Supabase] First login detected, seeding default tags...');

    // Get the latest tags after parent tag init
    const { data: latestTags } = await supabase
      .from('tags').select('name, tag_type').eq('user_id', userId);
    const existing = latestTags ?? [];

    const defaultsToSeed = [
      // Global tags
      { name: '家庭', tag_type: 'general' },
      { name: '约会', tag_type: 'general' },
      { name: '纪念日', tag_type: 'general' },
      // Theater sub-tags
      { name: '喜剧', tag_type: 'theatre' },
      { name: '音乐剧', tag_type: 'theatre' },
      { name: '舞剧', tag_type: 'theatre' },
      { name: '话剧', tag_type: 'theatre' },
      // Food sub-tags
      { name: '火锅', tag_type: 'food' },
      { name: '甜品', tag_type: 'food' },
      { name: '烧烤', tag_type: 'food' },
      // Travel sub-tags
      { name: '自驾游', tag_type: 'travel' },
      { name: 'city walk', tag_type: 'travel' },
      { name: '出差', tag_type: 'travel' },
    ];

    // Only insert tags that don't already exist (by name + tag_type)
    const toSeed = defaultsToSeed.filter(d =>
      !existing.some((e: any) => e.name === d.name && e.tag_type === d.tag_type)
    );

    if (toSeed.length > 0) {
      const rows = toSeed.map(d => ({ user_id: userId, name: d.name, tag_type: d.tag_type }));
      const { error: seedErr } = await supabase.from('tags').insert(rows);
      if (seedErr) {
        console.error('[Supabase] Default tag seeding failed:', seedErr.message);
      } else {
        console.log(`[Supabase] Seeded ${toSeed.length} default tags:`, toSeed.map(t => t.name).join(', '));
        // Re-fetch to pick up the new tags
        const { data: finalTags } = await supabase
          .from('tags').select('id, name, tag_type').eq('user_id', userId);
        if (finalTags) {
          const final: RecordTag[] = finalTags.map((row: any) => ({
            id: String(row.id), name: row.name, tag_type: row.tag_type,
          }));
          setTags(final);
          setAllAvailableTags(final);
          saveTags(userId, final);
        }
      }
    }

    // Mark as seeded — won't run again even if user deletes tags
    localStorage.setItem(seedKey, '1');
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchRecords();
      fetchUserTags();
    } else {
      setRecords([]);
      setTags(DEFAULT_TAGS);
      setAllAvailableTags(DEFAULT_TAGS);
      isInitializedRef.current = false; // Reset on logout
    }
  }, [userId, fetchRecords, fetchUserTags]);

  // ─── addRecord ────────────────────────────────
  // For daily: inserts a habit definition row (mood=null)
  // For special: inserts one row
  const addRecord = useCallback(async (record: CalendarRecord) => {
    if (!userId) return;

    let row: Record<string, unknown>;
    if (record.type === 'daily') {
      row = {
        user_id: userId,
        type: 'daily',
        content: record.content,
        color: encodeColor(record.color),
        image_url: null,
        mood: null,
        tags: record.repeatDays || [0, 1, 2, 3, 4, 5, 6],
        start_date: record.startDate || null,
        end_date: record.endDate || null,
        extra_data: record.extra_data || null,
      };
    } else {
      row = {
        user_id: userId,
        type: 'special',
        content: record.title,
        color: encodeColor(record.color),
        image_url: safeImageUrl(record.imageUrls?.[0]),
        mood: record.dateStr ?? null,
        tags: record.tagIds || [],
        extra_data: record.extra_data || null,
      };
    }

    if (record.type === 'special' && userId) {
      const specRecord = record as EventRecord;
      const localTags = loadTags(userId);
      const existingNames = new Set(allAvailableTags.map(t => t.name));
      const newTagNames = (specRecord.tagIds || [])
        .map(id => localTags.find(t => t.id === id)?.name)
        .filter((n): n is string => !!n && !existingNames.has(n));

      if (newTagNames.length > 0) {
        const insertTagRows = newTagNames.map(name => ({ user_id: userId, name }));
        const { data: newTagData, error: tagErr } = await supabase
          .from('tags')
          .insert(insertTagRows)
          .select();
        
        if (newTagData && !tagErr) {
          const added: RecordTag[] = (newTagData as { id: string; name: string; tag_type: string }[])
            .map(r => ({ id: String(r.id), name: r.name, tag_type: r.tag_type }));
          setAllAvailableTags(prev => {
            const merged = [...prev, ...added.filter(a => !prev.some(p => p.name === a.name))];
            saveTags(userId, merged);
            return merged;
          });
          setTags(prev => [...prev, ...added.filter(a => !prev.some(p => p.name === a.name))]);
        }
      }
    }

    const tempId = `optimistic_${Date.now()}`;
    setRecords(prev => [...prev, { ...record, id: tempId }]);

    const { data: inserted, error } = await supabase.from('records').insert([row]).select().single();
    if (error) {
      setRecords(prev => prev.filter(r => r.id !== tempId));
      reportError('addRecord', error);
      return;
    }
    if (inserted) {
      const dbTags = userId ? loadTags(userId) : DEFAULT_TAGS;
      const enriched = enrichEventRecord(inserted, dbTags);
      setRecords(prev => prev.map(r => r.id === tempId ? enriched : r));
    }
  }, [userId, allAvailableTags]);

  // ─── updateRecord ─────────────────────────────
  // For special records: upsert by id
  // For daily records: diff completedDates → insert new check-ins, delete removed ones
  const updateRecord = useCallback(async (record: CalendarRecord) => {
    if (!userId) return;

    if (record.type === 'special') {
      const row = {
        id: record.id,
        user_id: userId,
        type: 'special',
        content: record.title,
        color: encodeColor(record.color),
        image_url: safeImageUrl(record.imageUrls?.[0]),
        mood: record.dateStr ?? null,
        tags: record.tagIds || [],
        extra_data: record.extra_data || null,
      };

      setRecords(prev => prev.map(r => r.id === record.id ? record : r));

      const { data: updated, error } = await supabase.from('records').upsert([row]).select().single();
      if (error) {
        reportError('updateRecord', error);
      } else if (updated) {
        const dbTags = userId ? loadTags(userId) : DEFAULT_TAGS;
        const enriched = enrichEventRecord(updated, dbTags);
        setRecords(prev => prev.map(r => r.id === record.id ? enriched : r));
      }
      return;
    }

    const newDates = record.completedDates ?? [];
    const newRepeatDays = record.repeatDays ?? [0, 1, 2, 3, 4, 5, 6];

    setRecords(prev => prev.map(r =>
      r.type === 'daily' && (r.id === record.id || r.content === record.content)
        ? { ...record } as CalendarRecord
        : r
    ));

    const { data: existingDef } = await supabase
      .from('records')
      .select('content, id')
      .eq('id', record.id)
      .eq('type', 'daily')
      .is('mood', null)
      .single();

    if (existingDef) {
       const oldContent = existingDef.content;
       const newContent = record.content;

       await supabase
         .from('records')
          .update({ 
            content: newContent, 
            color: encodeColor(record.color),
            tags: newRepeatDays,
            start_date: record.startDate || null,
            end_date: record.endDate || null,
            extra_data: (record as any).extra_data || null
          })
         .eq('user_id', userId)
         .eq('type', 'daily')
         .eq('content', oldContent);
       
       if (oldContent !== newContent) {
         await supabase
           .from('records')
           .update({ content: newContent })
           .eq('user_id', userId)
           .eq('type', 'daily')
           .eq('content', oldContent);
       }
    }

    const habitId = record.content;
    const syncMap = pendingSyncs.current;

    if (syncMap.has(habitId)) {
      clearTimeout(syncMap.get(habitId));
    }

    const timer = setTimeout(async () => {
      syncMap.delete(habitId);
      
      const { data: existingRows, error: fetchErr } = await supabase
        .from('records')
        .select('id, mood')
        .eq('user_id', userId)
        .eq('type', 'daily')
        .eq('content', record.content)
        .not('mood', 'is', null);

      if (!fetchErr) {
        const existingDates = (existingRows ?? []).map((r: { mood: string }) => r.mood);
        const existingById = new Map((existingRows ?? []).map((r: { id: string; mood: string }) => [r.mood, r.id]));

        const toAdd = newDates.filter(d => !existingDates.includes(d));
        const toRemove = existingDates.filter((d: string) => !newDates.includes(d));

        if (toAdd.length > 0) {
          const insertRows = toAdd.map(date => ({
            user_id: userId,
            type: 'daily',
            content: record.content,
            color: encodeColor(record.color),
            tags: record.repeatDays || [0, 1, 2, 3, 4, 5, 6],
            start_date: record.startDate || null,
            end_date: record.endDate || null,
            extra_data: (record as any).extra_data || null,
            mood: date,
          }));
          await supabase.from('records').insert(insertRows);
        }

        for (const date of toRemove) {
          const rowId = existingById.get(date);
          if (rowId) await supabase.from('records').delete().eq('id', rowId);
        }
      }
    }, 1200);

    syncMap.set(habitId, timer);
  }, [userId]);

  // ─── deleteRecord ─────────────────────────────
  // Deletes the habit definition row AND all its check-in rows
  const deleteRecord = useCallback(async (id: string, type: 'daily' | 'special', content?: string) => {
    if (!userId) return;

    setRecords(prev => prev.filter(r => {
      if (type === 'special') return r.id !== id;
      return !(r.id === id || (r.type === 'daily' && r.content === content));
    }));

    if (type === 'special') {
      const { error } = await supabase.from('records').delete().eq('id', id).eq('user_id', userId);
      if (error) { reportError('deleteRecord', error); return; }
    } else {
      const targetContent = content;
      if (targetContent) {
        const { error } = await supabase
          .from('records')
          .delete()
          .eq('user_id', userId)
          .eq('type', 'daily')
          .eq('content', targetContent);
        if (error) { reportError('deleteRecord:daily', error); return; }
      } else {
        await supabase.from('records').delete().eq('id', id).eq('user_id', userId);
      }
    }
  }, [userId]);

  // ─── Tag CRUD (Supabase + localStorage cache) ──
  const addTag = useCallback(async (tag: RecordTag): Promise<RecordTag | null> => {
    if (!userId) return null;
    
    const tagNameNormalized = tag.name.trim();
    const tagTypeNormalized = tag.tag_type || 'default';

    const localMatch = allAvailableTags.find(t => 
      t.name.toLowerCase() === tagNameNormalized.toLowerCase() && 
      (t.tag_type || 'default') === tagTypeNormalized
    );
    if (localMatch) return localMatch;

    try {
      const { data: existingDB, error: fetchErr } = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', userId)
        .eq('name', tagNameNormalized)
        .eq('tag_type', tagTypeNormalized)
        .maybeSingle();

      if (existingDB && !fetchErr) {
        const foundTag: RecordTag = { id: String(existingDB.id), name: existingDB.name, tag_type: existingDB.tag_type };
        setAllAvailableTags(prev => [...prev.filter(t => t.id !== foundTag.id), foundTag]);
        setTags(prev => prev.some(t => t.id === foundTag.id) ? prev : [...prev, foundTag]);
        return foundTag;
      }

      const { data, error } = await supabase
        .from('tags')
        .insert([{ 
          user_id: userId, 
          name: tagNameNormalized, 
          tag_type: tagTypeNormalized 
        }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          const { data: fallbackDate } = await supabase
            .from('tags')
            .select('*')
            .eq('user_id', userId)
            .eq('name', tagNameNormalized)
            .limit(1)
            .single();
          if (fallbackDate) return { id: String(fallbackDate.id), name: fallbackDate.name, tag_type: fallbackDate.tag_type };
        }
        return null;
      } 
      
      if (data) {
        const realTag: RecordTag = { id: String(data.id), name: data.name, tag_type: data.tag_type };
        setTags(prev => { 
          const next = [...prev, realTag]; 
          saveTags(userId, next); 
          return next; 
        });
        setAllAvailableTags(prev => [...prev.filter(t => t.id !== realTag.id), realTag]);
        return realTag;
      }
    } catch (e) {}
    return null;
  }, [userId, allAvailableTags]);

  const deleteTag = useCallback(async (tagId: string) => {
    if (!userId) return;
    
    const targetTag = allAvailableTags.find(t => t.id === tagId);

    const { error: deleteErr } = await supabase.from('tags').delete().eq('id', tagId).eq('user_id', userId);
    if (deleteErr) return;

    if (targetTag) {
      try {
        const { data: recordsData, error: fetchErr } = await supabase
          .from('records')
          .select('id, tags')
          .eq('user_id', userId)
          .not('tags', 'is', null);

        if (!fetchErr && recordsData) {
          const updates = recordsData
            .map(row => {
              if (!row || !row.tags) return null;
              const currentTags: any[] = Array.isArray(row.tags) ? row.tags : [];
              const targetName = targetTag.name;
              const cleanedTags = currentTags.filter(t => {
                if (typeof t === 'string') return t !== tagId && t !== targetName;
                if (t && typeof t === 'object' && t.name) return t.name !== targetName;
                return true;
              });

              return cleanedTags.length !== currentTags.length ? { id: row.id, tags: cleanedTags } : null;
            })
            .filter((u): u is { id: any, tags: any[] } => !!u);

          if (updates.length > 0) {
            await Promise.all(updates.map(u => 
              supabase.from('records').update({ tags: u.tags }).eq('id', u.id)
            ));
          }
        }
      } catch (cascadeErr) {}
    }
    
    setTags(prev => { 
      const next = (prev || []).filter(t => t.id !== tagId); 
      saveTags(userId, next); 
      return next; 
    });
    setAllAvailableTags(prev => (prev || []).filter(t => t.id !== tagId));
    setRecords(prev => (prev || []).map(r => {
      if (!r || r.type !== 'special') return r;
      const event = r as EventRecord;
      if (!event.tagIds && !event.tag_names) return event;
      
      const cleanedTagIds = (event.tagIds || []).filter(id => id !== tagId);
      const cleanedTagNames = (event.tag_names || []).filter(name => name !== targetTag?.name);
      
      return (cleanedTagIds.length !== (event.tagIds || []).length || cleanedTagNames.length !== (event.tag_names || []).length)
        ? { ...event, tagIds: cleanedTagIds, tag_names: cleanedTagNames }
        : event;
    }));
  }, [userId, allAvailableTags]);

  // ─── renameTag ─────────────────────────────────
  // Renames a tag in the DB and updates all records that reference it
  const renameTag = useCallback(async (tagId: string, newName: string) => {
    if (!userId || !newName.trim()) return;
    const trimmed = newName.trim();
    const targetTag = allAvailableTags.find(t => t.id === tagId);
    if (!targetTag) return;
    const oldName = targetTag.name;
    if (oldName === trimmed) return;

    // 1. Update the tag name in the tags table
    const { error: tagErr } = await supabase
      .from('tags')
      .update({ name: trimmed })
      .eq('id', tagId)
      .eq('user_id', userId);
    if (tagErr) { reportError('renameTag', tagErr); return; }

    // 2. Update all records that reference this tag (by name in the tags array)
    try {
      const { data: recordsData, error: fetchErr } = await supabase
        .from('records')
        .select('id, tags')
        .eq('user_id', userId)
        .eq('type', 'special')
        .not('tags', 'is', null);

      if (!fetchErr && recordsData) {
        for (const row of recordsData) {
          if (!row.tags) continue;
          const currentTags: any[] = Array.isArray(row.tags) ? row.tags : [];
          let changed = false;
          const updatedTags = currentTags.map(t => {
            if (typeof t === 'string' && t === oldName) { changed = true; return trimmed; }
            if (t && typeof t === 'object' && t.name === oldName) { changed = true; return { ...t, name: trimmed }; }
            return t;
          });
          if (changed) {
            await supabase.from('records').update({ tags: updatedTags }).eq('id', row.id);
          }
        }
      }
    } catch (cascadeErr) {
      console.error('[Supabase] renameTag cascade error:', cascadeErr);
    }

    // 3. Update local state
    const renamedTag: RecordTag = { ...targetTag, name: trimmed };
    setTags(prev => {
      const next = prev.map(t => t.id === tagId ? renamedTag : t);
      saveTags(userId, next);
      return next;
    });
    setAllAvailableTags(prev => prev.map(t => t.id === tagId ? renamedTag : t));
    setRecords(prev => prev.map(r => {
      if (!r || r.type !== 'special') return r;
      const event = r as EventRecord;
      const newTagNames = (event.tag_names || []).map(n => n === oldName ? trimmed : n);
      if (newTagNames.join() === (event.tag_names || []).join()) return event;
      return { ...event, tag_names: newTagNames };
    }));
  }, [userId, allAvailableTags]);

  const ensureTheaterTags = useCallback(async () => {
    if (!userId) return;
    // Theater sub-tags are now seeded on first login via fetchUserTags.
    // This function just refreshes tags for callers that rely on it.
    await fetchUserTags();
  }, [userId, fetchUserTags]);

  // ─── Navigation ───────────────────────────────
  const nextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const prevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));

  // ─── Calendar grid ────────────────────────────
  const weeks = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const generatedWeeks: DateCell[][] = [];
    let currentWeek: DateCell[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);

    for (let i = 0; i < firstDay.getDay(); i++) currentWeek.push({ date: null, label: '', isToday: false });
    for (let day = 1; day <= lastDay.getDate(); day++) {
      if (currentWeek.length === 7) { generatedWeeks.push(currentWeek); currentWeek = []; }
      const cellDate = new Date(year, month, day);
      currentWeek.push({ date: cellDate, label: String(day), isToday: cellDate.getTime() === today.getTime() });
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push({ date: null, label: '', isToday: false });
      generatedWeeks.push(currentWeek);
    }
    return generatedWeeks;
  }, [currentMonth]);

  return {
    currentMonth, weeks, setCurrentMonth, nextMonth, prevMonth,
    records, tags, allAvailableTags, loading, fetchRecords,
    addRecord, updateRecord, deleteRecord, addTag, deleteTag, renameTag, ensureTheaterTags
  };
};
