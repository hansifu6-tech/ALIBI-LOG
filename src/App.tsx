import { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar as CalendarView } from './components/Calendar';
import { TimelineView } from './components/TimelineView';
import { RecordModal } from './components/RecordModal';
import { AuthView } from './components/AuthView';
import { useSupabaseData } from './hooks/useSupabaseData';
import { supabase } from './supabase';
import { LogOut, User as UserIcon, LayoutGrid, List, Table2, X, Moon, Sun, ArrowUp, Settings, Plus, Filter, Utensils, Theater, CalendarCheck, CheckCircle2, ChevronDown, FileOutput, Palmtree } from 'lucide-react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { InvitePage } from './components/InvitePage';
import { TheaterSummary } from './components/TheaterSummary';
import { FoodSummary } from './components/FoodSummary';
import { FunctionHub } from './components/FunctionHub';
import { GlobalFilter } from './components/GlobalFilter';
import { TravelSummary } from './components/TravelSummary';
import { TableView } from './components/TableView';
import type { CalendarRecord, EventRecord } from './types';

// ── Inline component (avoids external file import issue on Vercel) ────
function ImageLightbox({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center transition-opacity duration-500 cursor-zoom-out"
      onClick={onClose}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all z-[110] active:scale-90"
      >
        <X size={28} />
      </button>
      <div className="relative max-w-[95vw] max-h-[90vh] flex items-center justify-center transition-all duration-500 pointer-events-none">
        <img
          src={imageUrl}
          alt="Preview"
          className="max-w-full max-h-full object-contain shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-lg pointer-events-auto transition-transform hover:scale-[1.01]"
        />
      </div>
    </div>
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // ── Supabase Auth state ─────────────────────────────────────────────
  const [userId, setUserId]       = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // 1. Get current session immediately (avoids flicker on refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
      setUserEmail(session?.user?.email ?? null);
      setAuthLoading(false);
    });

    // 2. Subscribe to auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setUserEmail(session?.user?.email ?? null);
      // Don't re-set authLoading here — it's already false after the getSession call
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Data hook (unchanged — uses userId string) ──────────────────────
  const {
    records, tags, allAvailableTags,
    addRecord, updateRecord, deleteRecord, addTag, deleteTag, renameTag, ensureTheaterTags,
  } = useSupabaseData(userId);

  // ── UI state ────────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen]         = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedDate, setSelectedDate]       = useState<Date | null>(null);
  const [editingRecord, setEditingRecord]     = useState<{ record: CalendarRecord; dateStr: string } | null>(null);
  const [viewMode, setViewMode]               = useState<'calendar' | 'timeline' | 'table'>('calendar');
  const [selectedFunctionIds, setSelectedFunctionIds] = useState<string[]>([]);
  const [selectedSubTagIds, setSelectedSubTagIds] = useState<string[]>([]);
  const [previewImage, setPreviewImage]       = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop]     = useState(false);
  const [isFunctionHubOpen, setIsFunctionHubOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen]           = useState(false);
  const [isOutputMenuOpen, setIsOutputMenuOpen]   = useState(false);
  const outputMenuRef = useRef<HTMLDivElement>(null);

  // Close output menu on click outside
  useEffect(() => {
    if (!isOutputMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (outputMenuRef.current && !outputMenuRef.current.contains(e.target as Node)) {
        setIsOutputMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOutputMenuOpen]);
  
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || (document.body?.scrollTop || 0);
      setShowScrollTop(scrollPos > 200);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('alibi_theme');
    if (savedTheme) {
      return savedTheme as 'light' | 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('alibi_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // -- Rainbow Border Toggle --
  const [showRainbowBorder, setShowRainbowBorder] = useState<boolean>(() => {
    const saved = localStorage.getItem('alibi_show_rainbow_border');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('alibi_show_rainbow_border', showRainbowBorder.toString());
  }, [showRainbowBorder]);

  // -- Theater Mode Global Toggle --
  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(() => {
    return localStorage.getItem('alibi_theater_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('alibi_theater_mode', isTheaterMode.toString());
  }, [isTheaterMode]);

  // -- Habit Mode Global Toggle --
  const [isHabitMode, setIsHabitMode] = useState<boolean>(() => {
    return localStorage.getItem('alibi_habit_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('alibi_habit_mode', isHabitMode.toString());
  }, [isHabitMode]);

  // -- Food Mode Global Toggle --
  const [isFoodMode, setIsFoodMode] = useState<boolean>(() => {
    return localStorage.getItem('alibi_food_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('alibi_food_mode', isFoodMode.toString());
  }, [isFoodMode]);

  // -- Travel Mode Global Toggle --
  const [isTravelMode, setIsTravelMode] = useState<boolean>(() => {
    return localStorage.getItem('alibi_travel_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('alibi_travel_mode', isTravelMode.toString());
  }, [isTravelMode]);

  // -- Automated Tag Completion for Theater Mode --
  useEffect(() => {
    if (isTheaterMode && userId) {
      ensureTheaterTags();
    }
  }, [isTheaterMode, userId, ensureTheaterTags]);

  // -- Filter Cleanup on Mode Toggle --
  useEffect(() => {
    if (!isTheaterMode) {
      const theaterParent = allAvailableTags.find(t => t.tag_type === 'function' && t.name === '演出模式');
      if (theaterParent) {
        setSelectedFunctionIds(prev => prev.filter(id => id !== theaterParent.id));
      }
      const theaterSubTags = allAvailableTags.filter(t => t.tag_type === 'theatre').map(t => t.id);
      setSelectedSubTagIds(prev => prev.filter(id => !theaterSubTags.includes(id)));
    }
  }, [isTheaterMode, allAvailableTags]);

  useEffect(() => {
    if (isFoodMode) {
      // Auto-add food parent + sub-tags to filter when mode is enabled (if filters are active)
      const foodParent = allAvailableTags.find(t => t.tag_type === 'function' && t.name === '美食模式');
      if (foodParent && (selectedFunctionIds.length > 0 || selectedSubTagIds.length > 0)) {
        setSelectedFunctionIds(prev => prev.includes(foodParent.id) ? prev : [...prev, foodParent.id]);
        const foodSubTags = allAvailableTags.filter(t => t.tag_type === 'food').map(t => t.id);
        setSelectedSubTagIds(prev => [...new Set([...prev, ...foodSubTags])]);
      }
    } else {
      const foodParent = allAvailableTags.find(t => t.tag_type === 'function' && t.name === '美食模式');
      if (foodParent) {
        setSelectedFunctionIds(prev => prev.filter(id => id !== foodParent.id));
      }
      const foodSubTags = allAvailableTags.filter(t => t.tag_type === 'food').map(t => t.id);
      setSelectedSubTagIds(prev => prev.filter(id => !foodSubTags.includes(id)));
    }
  }, [isFoodMode, allAvailableTags]);

  // -- Travel Mode Filter Cleanup --
  useEffect(() => {
    if (!isTravelMode) {
      const travelParent = allAvailableTags.find(t => t.tag_type === 'function' && t.name === '旅行模式');
      if (travelParent) {
        setSelectedFunctionIds(prev => prev.filter(id => id !== travelParent.id));
      }
      const travelSubTags = allAvailableTags.filter(t => t.tag_type === 'travel').map(t => t.id);
      setSelectedSubTagIds(prev => prev.filter(id => !travelSubTags.includes(id)));
    }
  }, [isTravelMode, allAvailableTags]);

  // Phase 159: Removed the Initialize Filter State useEffect that defaulted to "Select All".

  // -- Master Record Filtering Logic (Phase 164: Feature Toggle Safety Gates) --
  const filteredRecords = useMemo(() => {
    // 1. Module Level Gatekeeping (Safety Gates)
    // If a feature is disabled in Lab, hide ALL its records immediately.
    const gatedRecords = records.filter(record => {
      if (record.type === 'daily' && !isHabitMode) return false;
      if (record.type === 'special') {
        const ev = record as EventRecord;
        if (ev.parent_tag === '演出模式' && !isTheaterMode) return false;
        if (ev.parent_tag === '美食模式' && !isFoodMode) return false;
        if (ev.parent_tag === '旅行模式' && !isTravelMode) return false;
      }
      return true;
    });
    
    const selectedFull = [...selectedFunctionIds, ...selectedSubTagIds];
    
    // 2. Empty-Status All-Visible (Phase 159): If no filters are selected, show ALL (remaining) records
    if (selectedFull.length === 0) return gatedRecords;

    // 3. Prepare selection buckets
    const activeParents = new Set(
      selectedFunctionIds
        .map(id => allAvailableTags.find(t => t.id === id)?.name || "")
        .filter(Boolean)
    );

    // Phase 210: Separate general (global) tags from mode-specific sub-tags
    const selectedGeneralTagNames = new Set<string>();
    const subsByCategory = new Map<string, Set<string>>();
    selectedSubTagIds.forEach(id => {
      const tag = allAvailableTags.find(t => t.id === id);
      if (!tag) return;

      if (tag.tag_type === 'general') {
        selectedGeneralTagNames.add(tag.name.toLowerCase().trim());
        return;
      }

      let category = '普通模式';
      if (tag.tag_type === 'theatre') category = '演出模式';
      if (tag.tag_type === 'food') category = '美食模式';
      if (tag.tag_type === 'travel') category = '旅行模式';
      
      if (!subsByCategory.has(category)) subsByCategory.set(category, new Set());
      subsByCategory.get(category)!.add(tag.name.toLowerCase().trim());
    });

    const hasGeneralFilter = selectedGeneralTagNames.size > 0;
    const hasModeFilter = activeParents.size > 0 || subsByCategory.size > 0;

    // Pre-build Set of record IDs linked to travel records (O(n) instead of O(n²))
    const travelLinkedIds = new Set<string>();
    if (activeParents.has('旅行模式')) {
      gatedRecords.forEach(r => {
        if (r.type !== 'special') return;
        const ev = r as EventRecord;
        if (ev.parent_tag !== '旅行模式') return;
        const linked = (ev.extra_data as any)?.linkedRecordIds as string[] | undefined;
        linked?.forEach(id => travelLinkedIds.add(id));
      });
    }

    const result = gatedRecords.filter(record => {
      // Habits are currently exempt from tag filtering but passed the safety gate above
      if (record.type === 'daily') return true;

      const event = record as EventRecord;
      const pTag = event.parent_tag || "";
      const recordNames = (event.tag_names || []).map(n => String(n).toLowerCase().trim());

      // Phase 210: If ONLY general tags are selected (no mode parents/sub-tags),
      // show records across ALL modes that have the global tag.
      if (hasGeneralFilter && !hasModeFilter) {
        return recordNames.some(n => selectedGeneralTagNames.has(n));
      }

      // If both general and mode filters are active, record must match general tag
      if (hasGeneralFilter) {
        if (!recordNames.some(n => selectedGeneralTagNames.has(n))) return false;
      }

      // Rule: If any parent mode is selected, ignore records that don't belong to an active mode
      // EXCEPT: when travel mode is selected, also include records linked to a travel record
      if (activeParents.size > 0 && !activeParents.has(pTag)) {
        if (activeParents.has('旅行模式') && travelLinkedIds.has(event.id)) {
          // This record is linked to a travel record — keep it
        } else {
          return false;
        }
      }

      // Rule: If a category has sub-tags selected, the record must match at least one (Strict Match)
      const categorySubs = subsByCategory.get(pTag);
      if (categorySubs && categorySubs.size > 0) {
        return recordNames.some(n => categorySubs.has(n));
      }

      return true;
    });

    return result;
  }, [records, selectedFunctionIds, selectedSubTagIds, allAvailableTags, isTheaterMode, isHabitMode, isFoodMode, isTravelMode]);

  const handleOpenModal = (date: Date | null, recordToEdit?: { record: CalendarRecord; dateStr: string }) => {
    setSelectedDate(date);
    setEditingRecord(recordToEdit || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDate(null);
    setEditingRecord(null);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // ── Public routes (no auth required) ─────────────────────────────────
  if (location.pathname === '/invite') {
    return <InvitePage />;
  }

  // ── Loading spinner ──────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Auth gate ────────────────────────────────────────────────────────
  if (!userId) {
    return <AuthView />;
  }

  return (
      <Routes>
        <Route path="/theater-summary" element={<TheaterSummary records={records.filter(r => r.type === 'special') as EventRecord[]} tags={tags} />} />
        <Route path="/food-summary" element={<FoodSummary records={records.filter(r => r.type === 'special') as EventRecord[]} tags={tags} />} />
        <Route path="/travel-summary" element={<TravelSummary records={records.filter(r => r.type === 'special') as EventRecord[]} tags={tags} isTheaterMode={isTheaterMode} isFoodMode={isFoodMode} allRecords={records} />} />
        <Route path="/" element={
          <div className="min-h-screen bg-[var(--bg-color)] text-[var(--text-color)] transition-colors duration-300 relative overflow-x-clip">
            {/* Top Header — view switcher */}
            <div className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-[60] flex items-center justify-center shrink-0 gap-0.5 p-1 bg-[var(--nav-bg)]/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-800/20 shadow-[0_8px_32px_rgba(0,0,0,0.05)] w-auto max-w-[92vw] sm:max-w-[90vw] transition-colors duration-300 flex-nowrap overflow-hidden">
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 shrink-0 whitespace-nowrap ${
                  viewMode === 'calendar'
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <LayoutGrid size={14} className="sm:w-[18px] sm:h-[18px]" />
                <span>日历</span>
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 shrink-0 whitespace-nowrap ${
                  viewMode === 'timeline'
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <List size={14} className="sm:w-[18px] sm:h-[18px]" />
                <span>时间轴</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 shrink-0 whitespace-nowrap ${
                  viewMode === 'table'
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Table2 size={14} className="sm:w-[18px] sm:h-[18px]" />
                <span>表格</span>
              </button>
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5"></div>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0"
              >
                {theme === 'dark' ? <Moon size={18} className="sm:w-[18px] sm:h-[18px]" /> : <Sun size={18} className="sm:w-[18px] sm:h-[18px]" />}
                </button>
            </div>

            {/* Desktop — Right Cluster */}
            <div className="hidden md:flex fixed top-4 sm:top-6 right-4 sm:right-6 z-[70] items-center gap-2 sm:gap-3">
              {/* Output Menu (consolidated summary/poster buttons) */}
              {(isTheaterMode || isFoodMode || isTravelMode || (viewMode === 'calendar' && isHabitMode)) && (
                <div ref={outputMenuRef} className="relative">
                  <button
                    onClick={() => setIsOutputMenuOpen(!isOutputMenuOpen)}
                    className={`h-9 flex items-center gap-1.5 px-3 rounded-xl border shadow-sm transition-all active:scale-95 ${
                      isOutputMenuOpen
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-white dark:bg-gray-900 backdrop-blur-md text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:border-blue-300'
                    }`}
                  >
                    <FileOutput size={15} />
                    <span className="text-sm font-bold">查看总结</span>
                    <ChevronDown size={12} className={`transition-transform ${isOutputMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOutputMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-44 rounded-2xl z-[100] p-1 flex flex-col gap-1" onMouseDown={(e) => e.stopPropagation()}>
                      {viewMode === 'calendar' && isHabitMode && (
                        <button
                          onClick={() => { setViewMode('calendar'); setIsShareModalOpen(true); setIsOutputMenuOpen(false); }}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-xl transition-all active:scale-[0.98] w-full text-left shadow-md"
                        >
                          <CheckCircle2 size={14} />
                          打卡海报
                        </button>
                      )}
                      {isTheaterMode && (
                        <button
                          onClick={() => { setIsOutputMenuOpen(false); navigate('/theater-summary'); }}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 rounded-xl transition-all active:scale-[0.98] shadow-md w-full text-left"
                        >
                          <Theater size={14} />
                          观演总结
                        </button>
                      )}
                      {isFoodMode && (
                        <button
                          onClick={() => { setIsOutputMenuOpen(false); navigate('/food-summary'); }}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl transition-all active:scale-[0.98] shadow-md w-full text-left"
                        >
                          <Utensils size={14} />
                          美食总结
                        </button>
                      )}
                      {isTravelMode && (
                        <button
                          onClick={() => { setIsOutputMenuOpen(false); navigate('/travel-summary'); }}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-xl transition-all active:scale-[0.98] shadow-md w-full text-left"
                        >
                          <Palmtree size={14} />
                          旅行总结
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="h-9 flex items-center gap-2 px-3 bg-white dark:bg-gray-900 backdrop-blur-md rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <UserIcon size={14} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-500 truncate max-w-[120px]">{userEmail}</span>
              </div>

              {/* Quick Mode Toggles */}
              <div className="h-9 flex items-center bg-white dark:bg-gray-900 backdrop-blur-md rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                <button
                  onClick={() => setIsHabitMode(!isHabitMode)}
                  className={`p-2 transition-all active:scale-95 ${isHabitMode ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                  title={isHabitMode ? '关闭打卡模式' : '开启打卡模式'}
                >
                  <CalendarCheck size={16} />
                </button>
                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
                <button
                  onClick={() => setIsTheaterMode(!isTheaterMode)}
                  className={`p-2 transition-all active:scale-95 ${isTheaterMode ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                  title={isTheaterMode ? '关闭演出模式' : '开启演出模式'}
                >
                  <Theater size={16} />
                </button>
                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
                <button
                  onClick={() => setIsFoodMode(!isFoodMode)}
                  className={`p-2 transition-all active:scale-95 ${isFoodMode ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                  title={isFoodMode ? '关闭美食模式' : '开启美食模式'}
                >
                  <Utensils size={16} />
                </button>
                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
                <button
                  onClick={() => setIsTravelMode(!isTravelMode)}
                  className={`p-2 transition-all active:scale-95 ${isTravelMode ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                  title={isTravelMode ? '关闭旅行模式' : '开启旅行模式'}
                >
                  <Palmtree size={16} />
                </button>
              </div>

              {/* Function Hub Toggle */}
              <button
                onClick={() => setIsFunctionHubOpen(true)}
                className="h-9 w-9 flex items-center justify-center bg-white dark:bg-gray-900 text-gray-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl border border-gray-200 dark:border-gray-800 transition-all active:scale-95"
                title="功能中心"
              >
                <Settings size={18} />
              </button>

              <button
                onClick={handleSignOut}
                className="h-9 flex items-center gap-2 px-3 bg-white dark:bg-gray-900 backdrop-blur-md hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-600 dark:text-gray-300 hover:text-red-500 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm transition-all active:scale-95 group"
              >
                <LogOut size={14} className="sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform" />
                <span className="text-sm font-bold">退出</span>
              </button>
            </div>

            {/* Mobile — Right/Bottom FAB cluster */}
            <div className="md:hidden fixed bottom-6 right-4 z-50 flex flex-col items-end gap-3">
              {showScrollTop && (
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="w-12 h-12 flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-600 shadow-xl shadow-blue-500/30 text-white rounded-full mb-2 active:scale-95 transition-all duration-300 ring-2 ring-white/20 z-[70]"
                >
                  <ArrowUp size={24} />
                </button>
              )}

              {/* Mobile Output Menu — Fan/Radial */}
              {(isTheaterMode || isFoodMode || isTravelMode || isHabitMode) && (
                <div ref={outputMenuRef} className="relative">
                  <button
                    onClick={() => setIsOutputMenuOpen(!isOutputMenuOpen)}
                    className={`w-12 h-12 flex items-center justify-center rounded-full shadow-xl transition-all duration-300 active:scale-95 ${
                      isOutputMenuOpen
                        ? 'bg-blue-600 text-white rotate-45'
                        : 'bg-white dark:bg-gray-900 text-gray-500 border border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <FileOutput size={20} />
                  </button>
                  {(() => {
                    // Build list of enabled items
                    const fanItems: { key: string; icon: React.ReactNode; label: string; gradient: string; onClick?: () => void; to?: string }[] = [];
                    if (isHabitMode) fanItems.push({ key: 'habit', icon: <CheckCircle2 size={13} />, label: '打卡海报', gradient: 'from-blue-500 to-indigo-500', onClick: () => { setViewMode('calendar'); setIsShareModalOpen(true); setIsOutputMenuOpen(false); } });
                    if (isTheaterMode) fanItems.push({ key: 'theater', icon: <Theater size={13} />, label: '观演总结', gradient: 'from-purple-500 to-violet-500', to: '/theater-summary' });
                    if (isFoodMode) fanItems.push({ key: 'food', icon: <Utensils size={13} />, label: '美食总结', gradient: 'from-amber-500 to-orange-500', to: '/food-summary' });
                    if (isTravelMode) fanItems.push({ key: 'travel', icon: <Palmtree size={13} />, label: '旅行总结', gradient: 'from-emerald-500 to-teal-500', to: '/travel-summary' });

                    const count = fanItems.length;
                    if (count === 0) return null;

                    // Fan arc: from 125° (upper-left) to 225° (lower-left)
                    const radius = 90;
                    const startAngle = 125;
                    const endAngle = 225;
                    const angleStep = count > 1 ? (endAngle - startAngle) / (count - 1) : 0;

                    return fanItems.map((item, i) => {
                      const angleDeg = count > 1 ? startAngle + i * angleStep : 180;
                      const angleRad = (angleDeg * Math.PI) / 180;
                      const x = Math.cos(angleRad) * radius;
                      const y = -Math.sin(angleRad) * radius;

                      const posStyle: React.CSSProperties = {
                        position: 'absolute',
                        left: `calc(50% + ${x}px)`,
                        top: `calc(50% + ${y}px)`,
                        transform: 'translate(-75%, -50%)',
                        opacity: isOutputMenuOpen ? 1 : 0,
                        scale: isOutputMenuOpen ? '1' : '0.3',
                        transition: `all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 50}ms`,
                        pointerEvents: isOutputMenuOpen ? 'auto' as const : 'none' as const,
                      };

                      const cls = `flex items-center gap-1.5 px-3.5 py-2 rounded-full shadow-lg bg-gradient-to-r ${item.gradient} text-white text-xs font-bold whitespace-nowrap active:scale-90 transition-transform z-50`;

                      if (item.to) {
                        return (
                          <Link key={item.key} to={item.to} onClick={() => setIsOutputMenuOpen(false)} className={cls} style={posStyle}>
                            {item.icon}
                            {item.label}
                          </Link>
                        );
                      }
                      return (
                        <button key={item.key} onClick={item.onClick} className={cls} style={posStyle}>
                          {item.icon}
                          {item.label}
                        </button>
                      );
                    });
                  })()}
                </div>
              )}

              {/* Mobile Function Hub Toggle */}
              <button
                onClick={() => setIsFunctionHubOpen(true)}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-white dark:bg-gray-900 text-gray-400 border border-gray-200 dark:border-gray-800 shadow-xl transition-all active:scale-95"
              >
                <Settings size={20} />
              </button>

              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-900 backdrop-blur-md text-gray-600 dark:text-gray-300 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 transition-all active:scale-95"
              >
                <LogOut size={16} />
                <span className="text-xs font-bold">退出</span>
              </button>
            </div>

            {/* Main Content Area */}
            <div className="pt-20 sm:pt-24">
              <GlobalFilter 
                tags={allAvailableTags}
                selectedFunctionIds={selectedFunctionIds}
                setSelectedFunctionIds={setSelectedFunctionIds}
                selectedSubTagIds={selectedSubTagIds}
                setSelectedSubTagIds={setSelectedSubTagIds}
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                isTheaterMode={isTheaterMode}
                isHabitMode={isHabitMode}
                isFoodMode={isFoodMode}
                isTravelMode={isTravelMode}
              />
              {viewMode === 'calendar' ? (
                <CalendarView
                  onOpenModal={handleOpenModal}
                  records={filteredRecords}
                  tags={tags}
                  onUpdateRecord={updateRecord}
                  hideAllSpecialEvents={false}
                  isShareModalOpen={isShareModalOpen}
                  onCloseShareModal={() => setIsShareModalOpen(false)}
                  showRainbowBorder={showRainbowBorder}
                  isHabitMode={isHabitMode}
                />
              ) : viewMode === 'timeline' ? (
                <TimelineView
                  records={filteredRecords.filter((r: CalendarRecord) => r.type === 'special') as EventRecord[]}
                  onEditRecord={(record, dateStr) => handleOpenModal(null, { record, dateStr })}
                  onPreviewImage={setPreviewImage}
                  hideAllSpecialEvents={false}
                  isTheaterMode={isTheaterMode}
                />
              ) : (
                <TableView
                  records={filteredRecords}
                  isTheaterMode={isTheaterMode}
                  isFoodMode={isFoodMode}
                  isTravelMode={isTravelMode}
                  onEditRecord={(record, dateStr) => handleOpenModal(null, { record, dateStr })}
                  onDeleteRecord={deleteRecord}
                />
              )}
            </div>

            {/* Bottom-Right Global Action Cluster (Phase 140) */}
            {/* Bottom-Right Global FAB Cluster (Phase 143) */}
            {/* Left-Top Global Action Cluster (Responsive Stacking) */}
            <div className="fixed top-4 left-4 sm:top-6 sm:left-6 z-[100] flex flex-col md:flex-row items-center gap-3">
              {/* Plus (+) Button */}
              <button
                onClick={() => handleOpenModal(new Date())}
                className="w-[44px] h-[44px] flex items-center justify-center bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-full shadow-lg shadow-blue-500/20 hover:scale-110 transition-all active:scale-95 group ring-2 ring-white/10"
                title="新增记录"
              >
                <Plus size={22} className="group-hover:rotate-90 transition-transform duration-500" />
              </button>

              {/* Filter Button */}
              <button
                onClick={() => setIsFilterOpen(true)}
                className={`w-[44px] h-[44px] flex items-center justify-center rounded-full border-2 transition-all hover:scale-110 active:scale-95 shadow-lg backdrop-blur-xl relative ${
                  (selectedFunctionIds.length + selectedSubTagIds.length) < allAvailableTags.length
                    ? 'bg-blue-600 border-blue-500 text-white shadow-blue-500/30' 
                    : 'bg-white/90 dark:bg-gray-900/90 text-gray-500 border-gray-100 dark:border-gray-800'
                }`}
                title="筛选记录"
              >
                <Filter size={18} strokeWidth={2.5} />
              </button>
            </div>

            <RecordModal
              isOpen={isModalOpen}
              onClose={handleCloseModal}
              selectedDate={selectedDate}
              onAddRecord={addRecord}
              onUpdateRecord={updateRecord}
              onDeleteRecord={deleteRecord}
              editingRecord={editingRecord}
              tags={tags}
              allAvailableTags={allAvailableTags}
              onAddTag={addTag}
              onDeleteTag={deleteTag}
              onRenameTag={renameTag}
              ensureTheaterTags={ensureTheaterTags}
              isTheaterMode={isTheaterMode}
              isHabitMode={isHabitMode}
              isFoodMode={isFoodMode}
              isTravelMode={isTravelMode}
              records={records}
              onPreviewImage={setPreviewImage}
              showRainbowBorder={showRainbowBorder}
              setShowRainbowBorder={setShowRainbowBorder}
            />

            {isFunctionHubOpen && (
              <FunctionHub 
                isHabitMode={isHabitMode}
                setIsHabitMode={setIsHabitMode}
                isTheaterMode={isTheaterMode}
                setIsTheaterMode={setIsTheaterMode}
                isFoodMode={isFoodMode}
                setIsFoodMode={setIsFoodMode}
                isTravelMode={isTravelMode}
                setIsTravelMode={setIsTravelMode}
                onClose={() => setIsFunctionHubOpen(false)}
              />
            )}

            {previewImage && (
              <ImageLightbox imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
            )}

            {/* Global Footer Disclaimer */}
            <div className="mt-12 pb-6 text-center px-4">
              <p className="text-[12px] text-[#bbb] dark:text-[#555] leading-relaxed">
                本站为非营利性技术实验项目。地图数据由高德提供。用户评价数据存储于受保护的私有数据库。
              </p>
            </div>
          </div>
        } />
      </Routes>
  );
}

export default App;
