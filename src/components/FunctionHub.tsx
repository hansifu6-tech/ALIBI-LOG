import { useState } from 'react';
import { Settings, CheckCircle2, Theater, X, Utensils, Shield, Palmtree } from 'lucide-react';
import { TermsModal } from './TermsModal';

interface FunctionHubProps {
  isHabitMode: boolean;
  setIsHabitMode: (val: boolean) => void;
  isTheaterMode: boolean;
  setIsTheaterMode: (val: boolean) => void;
  isFoodMode: boolean;
  setIsFoodMode: (val: boolean) => void;
  isTravelMode: boolean;
  setIsTravelMode: (val: boolean) => void;
  onClose: () => void;
}

export function FunctionHub({ 
  isHabitMode, 
  setIsHabitMode, 
  isTheaterMode, 
  setIsTheaterMode,
  isFoodMode,
  setIsFoodMode,
  isTravelMode,
  setIsTravelMode,
  onClose 
}: FunctionHubProps) {
  const [showTerms, setShowTerms] = useState(false);

  return (
    <>
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-[32px] shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                <Settings size={20} className="text-slate-600 dark:text-slate-300" />
              </div>
              <h2 className="text-xl font-black text-slate-800 dark:text-gray-100 tracking-tight uppercase">功能实验室</h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Habit Mode */}
            <div 
              onClick={() => setIsHabitMode(!isHabitMode)}
              className={`group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all ${
                isHabitMode 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 ring-1 ring-blue-500/20' 
                  : 'bg-slate-50 dark:bg-slate-800/50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl transition-all ${
                  isHabitMode ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-white dark:bg-slate-700 text-slate-400'
                }`}>
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-800 dark:text-gray-200">打卡模式</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Habit Tracking</div>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full relative transition-colors ${isHabitMode ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isHabitMode ? 'left-5' : 'left-1'}`} />
              </div>
            </div>

            {/* Theater Mode */}
            <div 
              onClick={() => setIsTheaterMode(!isTheaterMode)}
              className={`group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all ${
                isTheaterMode 
                  ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30 ring-1 ring-purple-500/20' 
                  : 'bg-slate-50 dark:bg-slate-800/50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl transition-all ${
                  isTheaterMode ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' : 'bg-white dark:bg-slate-700 text-slate-400'
                }`}>
                  <Theater size={20} />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-800 dark:text-gray-200">演出模式</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Show & Performance</div>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full relative transition-colors ${isTheaterMode ? 'bg-purple-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isTheaterMode ? 'left-5' : 'left-1'}`} />
              </div>
            </div>

            {/* Food Mode */}
            <div 
              onClick={() => setIsFoodMode(!isFoodMode)}
              className={`group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all ${
                isFoodMode 
                  ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30' 
                  : 'bg-slate-50 dark:bg-slate-800/50 border border-transparent'
              }`}
              style={isFoodMode ? { borderColor: '#ffa500', boxShadow: '0 0 0 1px #ffa50033' } : {}}
            >
              <div className="flex items-center gap-4">
                <div 
                  className={`p-3 rounded-xl transition-all ${
                    isFoodMode ? 'text-white' : 'bg-white dark:bg-slate-700 text-slate-400'
                  }`}
                  style={isFoodMode ? { backgroundColor: '#ffa500', boxShadow: '0 4px 12px #ffa5004d' } : {}}
                >
                  <Utensils size={20} />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-800 dark:text-gray-200">美食模式</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Food Explorer</div>
                </div>
              </div>
              <div 
                className={`w-10 h-6 rounded-full relative transition-colors ${isFoodMode ? '' : 'bg-slate-200 dark:bg-slate-700'}`}
                style={isFoodMode ? { backgroundColor: '#ffa500' } : {}}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isFoodMode ? 'left-5' : 'left-1'}`} />
              </div>
            </div>

            {/* Travel Mode */}
            <div 
              onClick={() => setIsTravelMode(!isTravelMode)}
              className={`group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all ${
                isTravelMode 
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 ring-1 ring-emerald-500/20' 
                  : 'bg-slate-50 dark:bg-slate-800/50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl transition-all ${
                  isTravelMode ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-white dark:bg-slate-700 text-slate-400'
                }`}>
                  <Palmtree size={20} />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-800 dark:text-gray-200">旅行模式</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Travel Explorer</div>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full relative transition-colors ${isTravelMode ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isTravelMode ? 'left-5' : 'left-1'}`} />
              </div>
            </div>
          </div>

          {/* Legal Notice Link */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setShowTerms(true)}
              className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
            >
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-blue-500 transition-colors">
                <Shield size={16} />
              </div>
              <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">法律声明与隐私政策</span>
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em]">ALIBI LOG</p>
          </div>
        </div>
      </div>
    </div>

    <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
  </>
  );
}
