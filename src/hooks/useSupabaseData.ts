import { useState, useMemo, useCallback, useEffect } from 'react';
import { supabase } from '../supabase';
import type { CalendarRecord, DailyRecord, RecordTag } from '../types';

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
// Aggregate raw daily rows into DailyRecord shapes
// Row with mood=null  → habit definition (provides id, content, color)
// Row with mood=date  → a completed check-in (date goes into completedDates)
// ─────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aggregateDailyRows(rows: any[]): DailyRecord[] {
  // Group by content (habit name)
  const map = new Map<string, { id: string; color: { bg: string; text: string }; createdAt: number; dates: string[] }>();

  for (const row of rows) {
    const content = row.content ?? '';
    const color = decodeColor(row.color);
    const createdAt = row.created_at ? new Date(row.created_at).getTime() : Date.now();
    const moodIsDate = typeof row.mood === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.mood);

    if (!map.has(content)) {
      map.set(content, { id: String(row.id), color, createdAt, dates: [] });
    }
    const entry = map.get(content)!;
    // Prefer the definition row (mood null) id as the canonical id
    if (!moodIsDate) entry.id = String(row.id);
    // Collect check-in dates
    if (moodIsDate) entry.dates.push(row.mood);
  }

  return Array.from(map.entries()).map(([content, { id, color, createdAt, dates }]) => ({
    id,
    createdAt,
    type: 'daily',
    content,
    color,
    completedDates: dates,
    repeatDays: [0, 1, 2, 3, 4, 5, 6],
  }));
}

// ─────────────────────────────────────────────
// Image upload — always uses safe random filename
// ─────────────────────────────────────────────
export async function uploadImages(files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const safePath = `${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    console.log('[Supabase] Uploading:', safePath);
    const { error } = await supabase.storage.from('images').upload(safePath, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) {
      console.error('[Supabase] Upload failed:', error);
      alert(`❌ 图片上传失败: ${error.message}`);
      continue;
    }
    const { data } = supabase.storage.from('images').getPublicUrl(safePath);
    console.log('[Supabase] Public URL:', data.publicUrl);
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

  const fetchRecords = useCallback(async () => {
    if (!userId) { setRecords([]); return; }
    setLoading(true);
    console.log('[Supabase] fetchRecords uid:', userId);
    try {
      const { data, error } = await supabase
        .from('records')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) { reportError('fetchRecords', error); return; }

      const raw = data ?? [];
      console.log('[Supabase] raw rows:', raw.length);

      // Split into daily and special rows
      const dailyRows = raw.filter((r: { type: string }) => r.type === 'daily');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const specialRows = raw.filter((r: any) => r.type === 'special');

      const dailyRecords = aggregateDailyRows(dailyRows);

      const specialRecords = specialRows.map((row: any) => {
        // Map stored tag names back to local tag IDs
        const storedTagNames: string[] = Array.isArray(row.tags) ? row.tags : [];
        const localTags: RecordTag[] = userId ? loadTags(userId) : DEFAULT_TAGS;
        const tagIds = storedTagNames
          .map(name => localTags.find(t => t.name === name)?.id)
          .filter((id): id is string => !!id);

        return {
          id: String(row.id),
          createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
          type: 'special' as const,
          title: row.content ?? '',
          dateStr: row.mood ?? '',
          tagIds,
          color: decodeColor(row.color),
          imageUrls: row.image_url ? [row.image_url] : [],
        };
      });

      setRecords([...dailyRecords, ...specialRecords]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // ─── fetchUserTags ────────────────────────────
  // Reads from Supabase `tags` table (user_id, name)
  // Merges with localStorage cache; updates both states
  const fetchUserTags = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('tags')
      .select('id, name')
      .eq('user_id', userId);

    if (error) {
      console.warn('[Supabase] fetchUserTags error:', error.message);
      // Fall back to localStorage
      const cached = loadTags(userId);
      setTags(cached);
      setAllAvailableTags(cached);
      return;
    }

    const cloudTags: RecordTag[] = (data ?? []).map((row: { id: string; name: string }) => ({
      id: String(row.id),
      name: row.name,
    }));

    // Merge: cloud tags are the source of truth; keep local defaults as fallback
    const merged = cloudTags.length > 0 ? cloudTags : DEFAULT_TAGS;
    setTags(merged);
    setAllAvailableTags(merged);
    saveTags(userId, merged);
  }, [userId]);

  useEffect(() => {
    fetchRecords();
    fetchUserTags();
  }, [fetchRecords, fetchUserTags]);

  // ─── addRecord ────────────────────────────────
  // For daily: inserts a habit definition row (mood=null)
  // For special: inserts one row
  const addRecord = async (record: CalendarRecord) => {
    if (!userId) return;

    let row: Record<string, unknown>;
    if (record.type === 'daily') {
      row = {
        user_id: userId,
        type: 'daily',
        content: record.content,
        color: encodeColor(record.color),
        image_url: null,
        mood: null, // null → habit definition row
      };
    } else {
      // Convert tagIds to tag name strings for storage
      const localTags: RecordTag[] = userId ? loadTags(userId) : DEFAULT_TAGS;
      const tagNames = (record.tagIds || []).map(id => localTags.find(t => t.id === id)?.name).filter((n): n is string => !!n);

      row = {
        user_id: userId,
        type: 'special',
        content: record.title,
        color: encodeColor(record.color),
        image_url: safeImageUrl(record.imageUrls?.[0]),
        mood: record.dateStr ?? null,
        tags: tagNames,
      };
    }

    console.log('[Supabase] insert:', row);

    // Smart-save: upsert new tags to Supabase tags table
    if (record.type === 'special' && userId) {
      const specRecord = record as import('../types').SpecialRecord;
      const localTags = loadTags(userId);
      const existingNames = new Set(allAvailableTags.map(t => t.name));
      const newTagNames = (specRecord.tagIds || [])
        .map(id => localTags.find(t => t.id === id)?.name)
        .filter((n): n is string => !!n && !existingNames.has(n));

      if (newTagNames.length > 0) {
        const insertTagRows = newTagNames.map(name => ({ user_id: userId, name }));
        const { data: newTagData, error: tagErr } = await supabase
          .from('tags')
          .upsert(insertTagRows, { onConflict: 'user_id,name' })
          .select();
        if (tagErr) {
          console.warn('[Supabase] tag upsert warn:', tagErr.message);
        } else if (newTagData) {
          const added: RecordTag[] = (newTagData as { id: string; name: string }[])
            .map(r => ({ id: String(r.id), name: r.name }));
          setAllAvailableTags(prev => {
            const merged = [...prev, ...added.filter(a => !prev.some(p => p.name === a.name))];
            saveTags(userId, merged);
            return merged;
          });
          setTags(prev => {
            const merged = [...prev, ...added.filter(a => !prev.some(p => p.name === a.name))];
            return merged;
          });
        }
      }
    }

    // ── Optimistic update: show immediately, sync in background ──
    const tempId = `optimistic_${Date.now()}`;
    let optimisticRecord: CalendarRecord;
    if (record.type === 'daily') {
      optimisticRecord = { ...record, id: tempId };
    } else {
      optimisticRecord = { ...record, id: tempId };
    }
    setRecords(prev => [...prev, optimisticRecord]);

    const { data: inserted, error } = await supabase.from('records').insert([row]).select().single();
    if (error) {
      // Rollback optimistic update
      setRecords(prev => prev.filter(r => r.id !== tempId));
      reportError('addRecord', error);
      return;
    }
    // Replace temp record with real DB id
    if (inserted) {
      setRecords(prev => prev.map(r =>
        r.id === tempId ? { ...r, id: String(inserted.id) } : r
      ));
    } else {
      await fetchRecords();
    }
  };

  // ─── updateRecord ─────────────────────────────
  // For special records: upsert by id
  // For daily records: diff completedDates → insert new check-ins, delete removed ones
  const updateRecord = async (record: CalendarRecord) => {
    if (!userId) return;

    if (record.type === 'special') {
      // Convert tagIds to tag name strings for storage
      const localTags: RecordTag[] = userId ? loadTags(userId) : DEFAULT_TAGS;
      const tagNames = (record.tagIds || []).map(id => localTags.find(t => t.id === id)?.name).filter((n): n is string => !!n);

      const row = {
        id: record.id,
        user_id: userId,
        type: 'special',
        content: record.title,
        color: encodeColor(record.color),
        image_url: safeImageUrl(record.imageUrls?.[0]),
        mood: record.dateStr ?? null,
        tags: tagNames,
      };

      // Optimistic update
      setRecords(prev => prev.map(r => r.id === record.id ? record : r));

      console.log('[Supabase] upsert special:', row);
      const { error } = await supabase.from('records').upsert([row]);
      if (error) {
        reportError('updateRecord', error);
        await fetchRecords(); // rollback by refetching
      }
      return;
    }

    // Daily: the Calendar calls updateRecord when toggling a date.
    // Compare current DB state to the new completedDates.
    const newDates = record.completedDates ?? [];

    // ── Optimistic update for daily check-in toggle ──
    setRecords(prev => prev.map(r =>
      r.type === 'daily' && r.content === record.content
        ? { ...r, completedDates: newDates } as CalendarRecord
        : r
    ));

    // Fetch existing check-in rows for this habit content
    const { data: existingRows, error: fetchErr } = await supabase
      .from('records')
      .select('id, mood')
      .eq('user_id', userId)
      .eq('type', 'daily')
      .eq('content', record.content)
      .not('mood', 'is', null);

    if (fetchErr) { reportError('updateRecord:fetch', fetchErr); await fetchRecords(); return; }

    const existingDates = (existingRows ?? []).map((r: { mood: string }) => r.mood);
    const existingById = new Map((existingRows ?? []).map((r: { id: string; mood: string }) => [r.mood, r.id]));

    // Dates to add (in newDates but not in existingDates)
    const toAdd = newDates.filter(d => !existingDates.includes(d));
    // Dates to remove (in existingDates but not in newDates)
    const toRemove = existingDates.filter((d: string) => !newDates.includes(d));

    // Insert new check-in rows
    if (toAdd.length > 0) {
      const insertRows = toAdd.map(date => ({
        user_id: userId,
        type: 'daily',
        content: record.content,
        color: encodeColor(record.color),
        image_url: null,
        mood: date,
      }));
      console.log('[Supabase] insert check-ins:', insertRows);
      const { error } = await supabase.from('records').insert(insertRows);
      if (error) { reportError('updateRecord:checkIn', error); return; }
    }

    // Delete removed check-in rows
    for (const date of toRemove) {
      const rowId = existingById.get(date);
      if (!rowId) continue;
      console.log('[Supabase] delete check-in:', date, rowId);
      const { error } = await supabase.from('records').delete().eq('id', rowId);
      if (error) { reportError('updateRecord:uncheck', error); return; }
    }

    // Update color on habit definition row if it changed
    const { error: colorErr } = await supabase
      .from('records')
      .update({ color: encodeColor(record.color) })
      .eq('user_id', userId)
      .eq('type', 'daily')
      .eq('content', record.content)
      .is('mood', null);
    if (colorErr) console.warn('[Supabase] color update warn:', colorErr);

    await fetchRecords();
  };

  // ─── deleteRecord ─────────────────────────────
  // Deletes the habit definition row AND all its check-in rows
  const deleteRecord = async (id: string, type: 'daily' | 'special') => {
    if (!userId) return;

    if (type === 'special') {
      const { error } = await supabase.from('records').delete().eq('id', id).eq('user_id', userId);
      if (error) { reportError('deleteRecord', error); return; }
    } else {
      // Find the habit's content name to delete all related check-in rows too
      const { data: defRow } = await supabase
        .from('records').select('content').eq('id', id).single();
      if (defRow?.content) {
        const { error } = await supabase
          .from('records')
          .delete()
          .eq('user_id', userId)
          .eq('type', 'daily')
          .eq('content', defRow.content);
        if (error) { reportError('deleteRecord:daily', error); return; }
      } else {
        await supabase.from('records').delete().eq('id', id);
      }
    }
    await fetchRecords();
  };

  // ─── Tag CRUD (Supabase + localStorage cache) ──
  const addTag = async (tag: RecordTag) => {
    if (!userId) return;
    // Optimistic local update
    setTags(prev => { const next = [...prev, tag]; saveTags(userId, next); return next; });
    setAllAvailableTags(prev => [...prev.filter(t => t.name !== tag.name), tag]);
    // Persist to Supabase
    const { data, error } = await supabase
      .from('tags')
      .upsert([{ user_id: userId, name: tag.name }], { onConflict: 'user_id,name' })
      .select()
      .single();
    if (error) {
      console.warn('[Supabase] addTag error:', error.message);
    } else if (data) {
      // Replace temp ID with real DB id
      const realTag = { id: String(data.id), name: data.name };
      setTags(prev => { const next = prev.map(t => t.name === tag.name ? realTag : t); saveTags(userId, next); return next; });
      setAllAvailableTags(prev => prev.map(t => t.name === tag.name ? realTag : t));
    }
  };

  const deleteTag = async (tagId: string) => {
    if (!userId) return;
    // Optimistic local update
    setTags(prev => { const next = prev.filter(t => t.id !== tagId); saveTags(userId, next); return next; });
    setAllAvailableTags(prev => prev.filter(t => t.id !== tagId));
    setRecords(prev => prev.map(r =>
      r.type === 'special' && r.tagIds.includes(tagId)
        ? { ...r, tagIds: r.tagIds.filter(id => id !== tagId) }
        : r
    ));
    // Delete from Supabase
    const { error } = await supabase.from('tags').delete().eq('id', tagId).eq('user_id', userId);
    if (error) console.warn('[Supabase] deleteTag error:', error.message);
  };

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
    addRecord, updateRecord, deleteRecord, addTag, deleteTag,
  };
};
