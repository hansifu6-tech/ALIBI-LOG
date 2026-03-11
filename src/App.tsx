import { useState, useEffect } from 'react';
import { Calendar as CalendarView } from './components/Calendar';
import { TimelineView } from './components/TimelineView';
import { RecordModal } from './components/RecordModal';
import { AuthView } from './components/AuthView';
import { useSupabaseData } from './hooks/useSupabaseData';
import { supabase } from './supabase';
import { LogOut, User as UserIcon, Share2, LayoutGrid, List, X } from 'lucide-react';
import type { CalendarRecord, SpecialRecord } from './types';

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
    addRecord, updateRecord, deleteRecord, addTag, deleteTag,
  } = useSupabaseData(userId);

  // ── UI state ────────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen]         = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedDate, setSelectedDate]       = useState<Date | null>(null);
  const [editingRecord, setEditingRecord]     = useState<{ record: CalendarRecord; dateStr: string } | null>(null);
  const [viewMode, setViewMode]               = useState<'calendar' | 'timeline'>('calendar');
  const [filterTagIds, setFilterTagIds]       = useState<string[]>([]);
  const [hideAllSpecialEvents, setHideAllSpecialEvents] = useState(false);
  const [previewImage, setPreviewImage]       = useState<string | null>(null);

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
    // State is cleaned up by the onAuthStateChange listener above
  };

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

  // ── Main app ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FDFCF9] dark:bg-gray-950 relative overflow-x-hidden">
      {/* Top Header — view switcher (centered, both breakpoints) */}
      <div className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-1 p-1 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-800 shadow-[0_8px_32px_rgba(0,0,0,0.05)] w-auto max-w-[90vw]">
        <button
          onClick={() => setViewMode('calendar')}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 shrink-0 ${
            viewMode === 'calendar'
              ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <LayoutGrid size={14} className="sm:w-4 sm:h-4" />
          <span>日历</span>
        </button>
        <button
          onClick={() => setViewMode('timeline')}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 shrink-0 ${
            viewMode === 'timeline'
              ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <List size={14} className="sm:w-4 sm:h-4" />
          <span>时间轴</span>
        </button>
      </div>

      {/* Desktop — Share + email + sign-out (top-right) */}
      <div className="hidden md:flex fixed top-4 sm:top-6 right-4 sm:right-6 z-50 items-center gap-2 sm:gap-3">
        {viewMode === 'calendar' && (
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 group"
          >
            <Share2 size={14} className="sm:w-4 sm:h-4 group-hover:rotate-12 transition-transform" />
            <span className="text-xs font-bold">生成海报</span>
          </button>
        )}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <UserIcon size={14} className="text-gray-400" />
          <span className="text-[10px] font-bold text-gray-500 truncate max-w-[120px]">{userEmail}</span>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-600 dark:text-gray-300 hover:text-red-500 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm transition-all active:scale-95 group"
        >
          <LogOut size={14} className="sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform" />
          <span className="text-xs font-bold">退出</span>
        </button>
      </div>

      {/* Mobile — FAB cluster at bottom-right */}
      <div className="md:hidden fixed bottom-6 right-4 z-50 flex flex-col items-end gap-2">
        {viewMode === 'calendar' && (
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-xl shadow-blue-500/30 transition-all active:scale-95"
          >
            <Share2 size={16} />
            <span className="text-xs font-bold">生成海报</span>
          </button>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md text-gray-600 dark:text-gray-300 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 transition-all active:scale-95"
        >
          <LogOut size={16} />
          <span className="text-xs font-bold">退出</span>
        </button>
      </div>

      <div className="pt-20">
        {viewMode === 'calendar' ? (
          <CalendarView
            onOpenModal={handleOpenModal}
            records={records}
            tags={tags}
            onUpdateRecord={updateRecord}
            filterTagIds={filterTagIds}
            hideAllSpecialEvents={hideAllSpecialEvents}
            isShareModalOpen={isShareModalOpen}
            onCloseShareModal={() => setIsShareModalOpen(false)}
          />
        ) : (
          <TimelineView
            records={records.filter((r) => r.type === 'special') as SpecialRecord[]}
            tags={tags}
            onEditRecord={(record, dateStr) => handleOpenModal(null, { record, dateStr })}
            onPreviewImage={setPreviewImage}
          />
        )}
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
        records={records}
        filterTagIds={filterTagIds}
        setFilterTagIds={setFilterTagIds}
        hideAllSpecialEvents={hideAllSpecialEvents}
        setHideAllSpecialEvents={setHideAllSpecialEvents}
        onPreviewImage={setPreviewImage}
      />

      {previewImage && (
        <ImageLightbox imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
      )}
    </div>
  );
}

export default App;
