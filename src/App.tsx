import { useState, useEffect } from 'react';
import { Calendar as CalendarView } from './components/Calendar';
import { TimelineView } from './components/TimelineView';
import { RecordModal } from './components/RecordModal';
import { AuthView } from './components/AuthView';
import { useCalendarData } from './hooks/useCalendarData';
import { auth } from './firebase';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { LogOut, User as UserIcon, Share2, LayoutGrid, List } from 'lucide-react';
import type { CalendarRecord, RecordTag, SpecialRecord } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const { records, tags, addRecord, updateRecord, deleteRecord, addTag, deleteTag } = useCalendarData(user?.uid);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingRecord, setEditingRecord] = useState<{record: CalendarRecord, dateStr: string} | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline'>('calendar');

  // Filter States
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [hideAllSpecialEvents, setHideAllSpecialEvents] = useState(false);

  const handleOpenModal = (date: Date | null, recordToEdit?: {record: CalendarRecord, dateStr: string}) => {
    setSelectedDate(date);
    setEditingRecord(recordToEdit || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDate(null);
    setEditingRecord(null);
  };

  const handleAddRecord = (record: CalendarRecord) => {
    addRecord(record);
  };

  const handleUpdateRecord = (record: CalendarRecord) => {
    updateRecord(record);
  };

  const handleDeleteRecord = (id: string, type: 'daily' | 'special', _content?: string) => {
    deleteRecord(id, type);
  };

  const handleAddTag = (tag: RecordTag) => {
    addTag(tag);
  };

  const handleDeleteTag = (tagId: string) => {
    deleteTag(tagId);
  };

  const handleSignOut = () => {
    signOut(auth);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  return (
    <div className="min-h-screen bg-[#FDFCF9] dark:bg-gray-950 relative overflow-x-hidden">
      {/* Top Header Controls */}
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

      <div className="fixed top-4 sm:top-6 right-4 sm:right-6 z-50 flex items-center gap-2 sm:gap-3">
        {/* Share Button (Only in Calendar View) */}
        {viewMode === 'calendar' && (
          <button 
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 group"
          >
            <Share2 size={14} className="sm:w-4 sm:h-4 group-hover:rotate-12 transition-transform" />
            <span className="hidden xs:inline text-xs font-bold">生成海报</span>
            <span className="xs:hidden text-xs font-bold">分享</span>
          </button>
        )}

        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <UserIcon size={14} className="text-gray-400" />
          <span className="text-[10px] font-bold text-gray-500 truncate max-w-[120px]">{user.email}</span>
        </div>
        
        <button 
          onClick={handleSignOut}
          className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-600 dark:text-gray-300 hover:text-red-500 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm transition-all active:scale-95 group"
        >
          <LogOut size={14} className="sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform" />
          <span className="text-xs font-bold">退出</span>
        </button>
      </div>

      <div className="pt-20">
        {viewMode === 'calendar' ? (
          <CalendarView 
            onOpenModal={handleOpenModal} 
            records={records}
            tags={tags}
            onUpdateRecord={handleUpdateRecord}
            filterTagIds={filterTagIds}
            hideAllSpecialEvents={hideAllSpecialEvents}
            isShareModalOpen={isShareModalOpen}
            onCloseShareModal={() => setIsShareModalOpen(false)}
          />
        ) : (
          <TimelineView 
            records={records.filter(r => r.type === 'special') as SpecialRecord[]}
            tags={tags}
            onEditRecord={(record, dateStr) => handleOpenModal(null, { record, dateStr })}
          />
        )}
      </div>

      <RecordModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        selectedDate={selectedDate}
        onAddRecord={handleAddRecord}
        onUpdateRecord={handleUpdateRecord}
        onDeleteRecord={handleDeleteRecord}
        editingRecord={editingRecord}
        tags={tags}
        onAddTag={handleAddTag}
        onDeleteTag={handleDeleteTag}
        records={records}
        filterTagIds={filterTagIds}
        setFilterTagIds={setFilterTagIds}
        hideAllSpecialEvents={hideAllSpecialEvents}
        setHideAllSpecialEvents={setHideAllSpecialEvents}
      />
    </div>
  );
}

export default App;
