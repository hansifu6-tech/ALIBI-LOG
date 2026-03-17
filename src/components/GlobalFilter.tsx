import { X, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import type { RecordTag } from '../types';

interface GlobalFilterProps {
  tags: RecordTag[];
  selectedFunctionIds: string[];
  setSelectedFunctionIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedSubTagIds: string[];
  setSelectedSubTagIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export function GlobalFilter({ 
  tags, 
  selectedFunctionIds, 
  setSelectedFunctionIds, 
  selectedSubTagIds, 
  setSelectedSubTagIds,
  isOpen,
  onClose,
  isTheaterMode,
  isHabitMode,
  isFoodMode,
  isTravelMode
}: GlobalFilterProps & { isOpen: boolean; onClose: () => void; isTheaterMode: boolean; isHabitMode: boolean; isFoodMode: boolean; isTravelMode: boolean }) {
  
  // Use isHabitMode to potentially hide/show habit sections if those tags ever exist
  if (isHabitMode) { /* Placeholder for future habit tags */ }
  
  const functionTags = tags.filter(t => t.tag_type === 'function');
  const subTags = tags.filter(t => t.tag_type && t.tag_type !== 'function');

  const toggleFunction = (id: string) => {
    const isSelected = selectedFunctionIds.includes(id);
    const tag = functionTags.find(t => t.id === id);
    if (!tag) return;

    if (isSelected) {
      // Deselect Parent
      setSelectedFunctionIds(selectedFunctionIds.filter(fId => fId !== id));
      // Linkage: (Phase 159) We no longer auto-deselect sub-tags when parent is deselected.
      // However, the UI will still disable and grey them out.
    } else {
      // Select Parent
      setSelectedFunctionIds([...selectedFunctionIds, id]);
      // Linkage: (Phase 159) We no longer auto-select all sub-tags when parent is selected.
    }
  };

  const toggleSubTag = (id: string, type: string) => {
    // Only allow if parent is active
    const parentTag = functionTags.find(t => 
      (t.name === '演出模式' && type === 'theatre') || 
      (t.name === '普通模式' && type === 'default') ||
      (t.name === '美食模式' && type === 'food') ||
      (t.name === '旅行模式' && type === 'travel')
    );
    if (!parentTag || !selectedFunctionIds.includes(parentTag.id)) return;
    
    if (selectedSubTagIds.includes(id)) {
      setSelectedSubTagIds(selectedSubTagIds.filter(tId => tId !== id));
    } else {
      setSelectedSubTagIds([...selectedSubTagIds, id]);
    }
  };

  const renderSection = (parentName: string, type: 'default' | 'theatre' | 'food' | 'travel') => {
    const parentTag = functionTags.find(t => t.name === parentName);
    if (!parentTag) return null;
    
    // Check if mode is globally enabled
    if (parentName === '演出模式' && !isTheaterMode) return null;
    if (parentName === '美食模式' && !isFoodMode) return null;
    if (parentName === '旅行模式' && !isTravelMode) return null;
    
    const isParentSelected = selectedFunctionIds.includes(parentTag.id);
    const relatedSubTags = subTags.filter(t => t.tag_type === type);

    let accentHex = '#6b7280';
    if (type === 'theatre') {
      accentHex = '#9333ea';
    }
    if (type === 'food') {
      accentHex = '#ffa500';
    }
    if (type === 'travel') {
      accentHex = '#10b981';
    }

    return (
      <div key={parentTag.id} className="section-container pb-6 mb-6 border-b border-gray-100 dark:border-gray-700/50 last:border-0 last:pb-0 last:mb-0 animate-in slide-in-from-bottom-2 duration-300">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: accentHex }} />
               <h4 className="text-xl font-black text-gray-800 dark:text-gray-100 tracking-tight leading-none">{parentName}</h4>
            </div>
            <button
              onClick={() => toggleFunction(parentTag.id)}
              className={`p-2 rounded-xl transition-all border-2 flex items-center justify-center ${
                isParentSelected
                  ? 'border-transparent text-white shadow-lg'
                  : 'bg-white dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 text-gray-200'
              }`}
              style={{ 
                backgroundColor: isParentSelected ? accentHex : undefined,
                boxShadow: isParentSelected ? `0 4px 12px ${accentHex}40` : undefined
              }}
            >
              <CheckCircle2 size={24} />
            </button>
          </div>
          
          <div className="flex gap-2 pl-4.5">
             <button 
               onClick={() => {
                 const ids = relatedSubTags.map(t => t.id);
                 setSelectedSubTagIds(prev => [...new Set([...prev, ...ids])]);
               }}
               className="px-2 py-0.5 bg-gray-50 dark:bg-gray-800/50 rounded-md text-[9px] font-bold text-gray-500/70 hover:text-blue-500 transition-colors uppercase tracking-tight border border-gray-100 dark:border-gray-700"
             >
               全选
             </button>
             <button 
               onClick={() => {
                 const ids = relatedSubTags.map(t => t.id);
                 setSelectedSubTagIds(prev => prev.filter(tid => !ids.includes(tid)));
               }}
               className="px-2 py-0.5 bg-gray-50 dark:bg-gray-800/50 rounded-md text-[9px] font-bold text-gray-500/70 hover:text-red-500 transition-colors uppercase tracking-tight border border-gray-100 dark:border-gray-700"
             >
               全不选
             </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1 pl-4">
          {relatedSubTags.length > 0 ? (
            relatedSubTags.map(tag => {
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleSubTag(tag.id, type)}
                  disabled={!isParentSelected}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-2 flex items-center gap-1.5 h-auto ${
                    selectedSubTagIds.includes(tag.id) && isParentSelected
                      ? 'text-white border-transparent shadow-md'
                      : isParentSelected
                        ? 'bg-white border-gray-50 text-gray-400 hover:border-gray-200'
                        : 'bg-gray-50 border-transparent text-gray-300 cursor-not-allowed opacity-50'
                  }`}
                  style={{ 
                    backgroundColor: (selectedSubTagIds.includes(tag.id) && isParentSelected) ? accentHex : undefined,
                    boxShadow: (selectedSubTagIds.includes(tag.id) && isParentSelected) ? `0 2px 6px ${accentHex}20` : undefined
                  }}
                >
                  {tag.name}
                </button>
              );
            })
          ) : (
             <p className="text-[10px] text-gray-300 font-medium italic">暂无细分标签</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Popover / Modal Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={onClose}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 dark:border-gray-800/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-gray-100">标签筛选</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">分模块查看记录</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-full text-gray-400 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
               {renderSection('普通模式', 'default')}
               {renderSection('演出模式', 'theatre')}
               {renderSection('美食模式', 'food')}
               {renderSection('旅行模式', 'travel')}

               {/* Phase 210: Global Tags Section */}
               {(() => {
                 const globalTags = tags.filter(t => t.tag_type === 'general');
                 if (globalTags.length === 0) return null;
                 return (
                   <div className="section-container pb-6 mb-6 border-b border-gray-100 dark:border-gray-700/50 last:border-0 last:pb-0 last:mb-0 animate-in slide-in-from-bottom-2 duration-300">
                     <div className="flex flex-col gap-3 mb-4">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                           <div className="w-1.5 h-6 rounded-full bg-blue-500" />
                           <h4 className="text-xl font-black text-gray-800 dark:text-gray-100 tracking-tight leading-none">{'\ud83c\udf10'} 全局标签</h4>
                         </div>
                       </div>
                       <div className="flex gap-2 pl-4.5">
                         <button 
                           onClick={() => {
                             const ids = globalTags.map(t => t.id);
                             setSelectedSubTagIds(prev => [...new Set([...prev, ...ids])]);
                           }}
                           className="px-2 py-0.5 bg-gray-50 dark:bg-gray-800/50 rounded-md text-[9px] font-bold text-gray-500/70 hover:text-blue-500 transition-colors uppercase tracking-tight border border-gray-100 dark:border-gray-700"
                         >
                           全选
                         </button>
                         <button 
                           onClick={() => {
                             const ids = globalTags.map(t => t.id);
                             setSelectedSubTagIds(prev => prev.filter(tid => !ids.includes(tid)));
                           }}
                           className="px-2 py-0.5 bg-gray-50 dark:bg-gray-800/50 rounded-md text-[9px] font-bold text-gray-500/70 hover:text-red-500 transition-colors uppercase tracking-tight border border-gray-100 dark:border-gray-700"
                         >
                           全不选
                         </button>
                       </div>
                     </div>
                     <div className="flex flex-wrap gap-2 pt-1 pl-4">
                       {globalTags.map(tag => (
                         <button
                           key={tag.id}
                           onClick={() => {
                             if (selectedSubTagIds.includes(tag.id)) {
                               setSelectedSubTagIds(selectedSubTagIds.filter(tId => tId !== tag.id));
                             } else {
                               setSelectedSubTagIds([...selectedSubTagIds, tag.id]);
                             }
                           }}
                           className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-2 flex items-center gap-1.5 h-auto ${
                             selectedSubTagIds.includes(tag.id)
                               ? 'text-white border-transparent shadow-md bg-blue-600'
                               : 'bg-white border-gray-50 text-gray-400 hover:border-gray-200'
                           }`}
                           style={{ 
                             boxShadow: selectedSubTagIds.includes(tag.id) ? '0 2px 6px rgba(37,99,235,0.2)' : undefined
                           }}
                         >
                           {tag.name}
                         </button>
                       ))}
                     </div>
                   </div>
                 );
               })()}

               {(!isTheaterMode || !isFoodMode || !isTravelMode) && (
                 <div className="mt-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100/50 dark:border-blue-900/30">
                    <p className="text-[10px] text-blue-500/70 font-bold text-center">
                      更多模式可在【功能实验室】中开启
                    </p>
                 </div>
               )}
            </div>

            {/* Footer Actions — Phase 160: Renamed Reset to Deselect All, Added Select All */}
            <div className="p-6 bg-gray-50/80 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 shrink-0 flex gap-3">
              <button
                onClick={() => {
                  setSelectedFunctionIds([]);
                  setSelectedSubTagIds([]);
                }}
                className="flex-1 py-4 text-sm font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors border-2 border-transparent hover:border-red-100 dark:hover:border-red-900/30 rounded-xl"
              >
                全不选
              </button>
              <button
                onClick={() => {
                  setSelectedFunctionIds(functionTags.map(t => t.id));
                  setSelectedSubTagIds(subTags.map(t => t.id));
                }}
                className="flex-1 py-4 text-sm font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors border-2 border-transparent hover:border-blue-100 dark:hover:border-blue-900/30 rounded-xl"
              >
                全选
              </button>
              <button
                onClick={onClose}
                className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black shadow-xl shadow-blue-500/20 active:scale-[0.98] text-base uppercase tracking-widest transition-all"
              >
                保存设置
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
