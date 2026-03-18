import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Utensils, MapPin, Star, Calendar, TrendingUp, CheckSquare, Square, Filter, Trophy, DollarSign, Store, Map as MapIcon, Download, X, Share2 } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import type { EventRecord, RecordTag, FoodMetadata } from '../types';
import { FoodMap } from './FoodMap';

interface FoodSummaryProps {
  records: EventRecord[];
  tags: RecordTag[];
}

export const FoodSummary: React.FC<FoodSummaryProps> = ({ records, tags }) => {
  const navigate = useNavigate();
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [posterImage, setPosterImage] = useState<string | null>(null);
  const [isPosterLoading, setIsPosterLoading] = useState(false);

  // Food tags
  const foodTags = useMemo(() => tags.filter(t => t.tag_type === 'food'), [tags]);
  const foodTagNames = useMemo(() => new Set(foodTags.map(t => t.name)), [foodTags]);
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);

  // Auto-select all food tags on load
  React.useEffect(() => {
    if (foodTags.length > 0 && selectedTagNames.length === 0) {
      setSelectedTagNames(foodTags.map(t => t.name));
    }
  }, [foodTags]);

  // Available years
  const years = useMemo(() => {
    const s = new Set<string>();
    records.forEach(r => { const y = r.dateStr?.split('-')[0]; if (y) s.add(y); });
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (r.parent_tag !== '美食模式') return false;

      // Tag filter
      const rTags = r.tag_names?.filter(n => n !== '美食模式') || [];
      const hasSelectedTag = rTags.some(name => selectedTagNames.includes(name));
      const hasNoFoodSubTag = !rTags.some(name => foodTagNames.has(name));
      const allSelected = selectedTagNames.length === foodTags.length;
      if (!hasSelectedTag && !(hasNoFoodSubTag && allSelected)) return false;

      // Time filter
      const [y, m] = r.dateStr?.split('-') || [];
      const mStr = parseInt(m, 10).toString();
      if (selectedYears.length > 0 && !selectedYears.includes(y)) return false;
      if (selectedMonths.length > 0 && !selectedMonths.includes(mStr)) return false;

      return true;
    });
  }, [records, selectedTagNames, selectedYears, selectedMonths, foodTags, foodTagNames]);

  // ── Stats ──
  const stats = useMemo(() => {
    const uniqueRestaurants = new Set<string>();
    let totalSpend = 0;
    const citySet = new Set<string>();
    const categoryCount: Record<string, number> = {};
    const categoryRatings: Record<string, { name: string; rating: number }[]> = {};

    // Init categories
    foodTags.forEach(t => {
      categoryCount[t.name] = 0;
      categoryRatings[t.name] = [];
    });

    filteredRecords.forEach(r => {
      const extra = r.extra_data as FoodMetadata | undefined;
      const restaurant = extra?.restaurant || r.title || '';

      if (restaurant) uniqueRestaurants.add(restaurant);
      if (extra?.price) totalSpend += extra.price;

      // Extract city from extra_data.city field, fallback to address regex
      if (extra?.city) {
        if (Array.isArray(extra.city)) {
          // [province, city] format
          citySet.add(extra.city[1]);
        } else {
          citySet.add(extra.city);
        }
      } else if (extra?.address) {
        // Fallback: try to extract from address string (for old records)
        const cityMatch = extra.address.match(/^(.+?[市区县])/);
        if (cityMatch) citySet.add(cityMatch[1]);
      }

      // Category count & ratings
      const rTags = r.tag_names?.filter(n => n !== '美食模式') || [];
      rTags.forEach(tagName => {
        if (categoryCount[tagName] !== undefined) {
          categoryCount[tagName]++;
          if (extra?.rating) {
            categoryRatings[tagName] = categoryRatings[tagName] || [];
            categoryRatings[tagName].push({ name: restaurant, rating: extra.rating });
          }
        }
      });
    });

    // Sort ratings per category
    Object.keys(categoryRatings).forEach(key => {
      categoryRatings[key].sort((a, b) => b.rating - a.rating);
    });

    return {
      uniqueCount: uniqueRestaurants.size,
      totalSpend,
      cityCount: citySet.size,
      cities: Array.from(citySet),
      categoryCount,
      categoryRatings,
    };
  }, [filteredRecords, foodTags]);

  // Pie chart
  const pieOption = useMemo(() => {
    const data = Object.entries(stats.categoryCount)
      .filter(([_, count]) => count > 0)
      .map(([name, value]) => ({ name, value }));

    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: '5%', left: 'center', textStyle: { color: 'inherit' } },
      series: [{
        name: '类别占比',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
        labelLine: { show: false },
        data,
        color: [
          '#f59e0b', '#3b82f6', '#ef4444', '#10b981',
          '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
          '#6366f1', '#14b8a6', '#e11d48', '#84cc16',
          '#a855f7', '#0ea5e9', '#f43f5e', '#22c55e',
          '#d946ef', '#0891b2', '#fb7185', '#65a30d',
          '#7c3aed', '#2dd4bf', '#be123c', '#facc15',
        ],
      }],
    };
  }, [stats.categoryCount]);

  // ── Poster Time Label ──
  const posterTimeLabel = useMemo(() => {
    // If specific filters are set, build label from filters
    if (selectedYears.length > 0 || selectedMonths.length > 0) {
      const yrs = selectedYears.length > 0 ? selectedYears.sort() : [];
      const mos = selectedMonths.length > 0 ? selectedMonths.map(Number).sort((a, b) => a - b) : [];
      if (yrs.length === 1 && mos.length === 0) return `${yrs[0]}年`;
      if (yrs.length === 1 && mos.length === 1) return `${yrs[0]}.${mos[0]}`;
      if (yrs.length === 1 && mos.length > 1) return `${yrs[0]}.${mos[0]} - ${yrs[0]}.${mos[mos.length - 1]}`;
      if (yrs.length > 1 && mos.length === 0) return `${yrs[0]} - ${yrs[yrs.length - 1]}`;
      return `${yrs[0]}.${mos.length > 0 ? mos[0] : 1} - ${yrs[yrs.length - 1]}.${mos.length > 0 ? mos[mos.length - 1] : 12}`;
    }
    // No filter — derive from actual data
    if (filteredRecords.length === 0) return '暂无记录';
    const dates = filteredRecords.map(r => r.dateStr).filter(Boolean).sort();
    const first = dates[0];
    const last = dates[dates.length - 1];
    const [fy, fm] = first.split('-').map(Number);
    const [ly, lm] = last.split('-').map(Number);
    if (fy === ly && fm === lm) return `${fy}.${fm}`;
    if (fy === ly) return `${fy}.${fm} - ${fy}.${lm}`;
    return `${fy}.${fm} - ${ly}.${lm}`;
  }, [selectedYears, selectedMonths, filteredRecords]);

  // ── Top 5 Restaurants ──
  const top5Restaurants = useMemo(() => {
    const rMap: Record<string, { name: string; rating: number; count: number }> = {};
    filteredRecords.forEach(r => {
      const extra = r.extra_data as FoodMetadata | undefined;
      const name = extra?.restaurant || r.title || '';
      if (!name || !extra?.rating) return;
      const existing = rMap[name];
      if (!existing || extra.rating > existing.rating) {
        rMap[name] = { name, rating: extra.rating, count: (existing?.count || 0) + 1 };
      } else {
        rMap[name] = { ...existing, count: existing.count + 1 };
      }
    });
    return Object.values(rMap).sort((a, b) => b.rating - a.rating).slice(0, 5);
  }, [filteredRecords]);

  // ── Top 5 Dishes ──
  const top5Dishes = useMemo(() => {
    const dishes: { dish: string; rating: number; restaurant: string }[] = [];
    filteredRecords.forEach(r => {
      const extra = r.extra_data as FoodMetadata | undefined;
      const restaurant = extra?.restaurant || r.title || '';
      if (!extra?.dishes) return;
      extra.dishes.forEach(d => {
        if (d.name && d.rating && d.rating > 0) {
          dishes.push({ dish: d.name, rating: d.rating, restaurant });
        }
      });
    });
    return dishes.sort((a, b) => b.rating - a.rating).slice(0, 5);
  }, [filteredRecords]);

  // ── Poster Export ──
  const handleExportPoster = async () => {
    setIsPosterLoading(true);
    try {
      if (!(window as any).html2canvas) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      await new Promise(r => setTimeout(r, 600));
      const el = document.getElementById('food-poster-template');
      if (!el) { setIsPosterLoading(false); return; }

      const cloneContainer = document.createElement('div');
      cloneContainer.style.cssText = 'position:fixed;left:-9999px;top:0;width:750px;';
      const clone = el.cloneNode(true) as HTMLElement;
      clone.style.cssText = 'margin:0;position:static;width:750px;max-width:none;';
      cloneContainer.appendChild(clone);
      document.body.appendChild(cloneContainer);

      const h2c = (window as any).html2canvas;
      const canvas = await h2c(clone, {
        useCORS: true, scale: 2, backgroundColor: '#1a1a2e',
        windowWidth: 750, x: 0, y: 0
      });
      document.body.removeChild(cloneContainer);
      setPosterImage(canvas.toDataURL('image/png'));
    } catch (err) {
      alert('海报生成失败，请重试');
    } finally {
      setIsPosterLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-color)] text-[var(--text-color)] transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2.5 bg-white hover:bg-gray-50 rounded-xl transition-all border border-gray-100 shadow-sm text-slate-900"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-[var(--text-color)]">
                <Utensils className="text-amber-500" />
                美食总结
              </h1>
              <p className="text-xs text-slate-400 font-medium tracking-widest uppercase">Food Analytics</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-base font-bold transition-all shadow-sm hover:shadow-md ${showFilterPanel ? 'bg-amber-500 text-white' : 'bg-white text-amber-600'}`}
            >
              <Filter size={20} />
              筛选记录
            </button>
            <button
              onClick={handleExportPoster}
              disabled={isPosterLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {isPosterLoading ? <div className="w-[18px] h-[18px] border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Share2 size={18} />}
              <span className="text-sm font-bold">{isPosterLoading ? '生成中...' : '导出海报'}</span>
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilterPanel && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-8 animate-in fade-in zoom-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Year */}
              <div className="space-y-4">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                  <Calendar size={14} className="text-amber-500" /> 年份
                </h4>
                <div className="flex flex-wrap gap-2">
                  {years.map(y => (
                    <button key={y} onClick={() => setSelectedYears(prev => prev.includes(y) ? prev.filter(v => v !== y) : [...prev, y])}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedYears.includes(y) ? 'bg-amber-500 text-white border-transparent' : 'bg-gray-50 text-gray-500 border-gray-100'}`}
                    >{y}</button>
                  ))}
                </div>
              </div>

              {/* Month */}
              <div className="space-y-4">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                  <Calendar size={14} className="text-amber-500" /> 月份
                </h4>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 12 }, (_, i) => (i + 1).toString()).map(m => (
                    <button key={m} onClick={() => setSelectedMonths(prev => prev.includes(m) ? prev.filter(v => v !== m) : [...prev, m])}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedMonths.includes(m) ? 'bg-amber-500 text-white border-transparent' : 'bg-gray-50 text-gray-500 border-gray-100'}`}
                    >{m}月</button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-4">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp size={14} className="text-amber-500" /> 标签
                </h4>
                <div className="flex flex-wrap gap-2">
                  {foodTags.map(tag => (
                    <button key={tag.id} onClick={() => setSelectedTagNames(prev => prev.includes(tag.name) ? prev.filter(n => n !== tag.name) : [...prev, tag.name])}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all ${selectedTagNames.includes(tag.name) ? 'bg-amber-500 text-white border-transparent' : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-amber-200'}`}
                    >
                      {selectedTagNames.includes(tag.name) ? <CheckSquare size={12} /> : <Square size={12} />}
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-amber-500">
                <Store size={20} />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">探店数</span>
            </div>
            <p className="text-3xl font-black text-slate-800 dark:text-gray-100">{stats.uniqueCount}</p>
            <p className="text-[10px] text-gray-400 mt-1">家不同的店</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center text-orange-500">
                <DollarSign size={20} />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">总花费</span>
            </div>
            <p className="text-3xl font-black text-slate-800 dark:text-gray-100">￥{stats.totalSpend.toLocaleString()}</p>
            <p className="text-[10px] text-gray-400 mt-1">累计消费</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/20 rounded-xl flex items-center justify-center text-rose-500">
                <MapPin size={20} />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">城市</span>
            </div>
            <p className="text-3xl font-black text-slate-800 dark:text-gray-100">{stats.cityCount}</p>
            <p className="text-[10px] text-gray-400 mt-1">座城市</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-violet-50 dark:bg-violet-900/20 rounded-xl flex items-center justify-center text-violet-500">
                <Utensils size={20} />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">记录</span>
            </div>
            <p className="text-3xl font-black text-slate-800 dark:text-gray-100">{filteredRecords.length}</p>
            <p className="text-[10px] text-gray-400 mt-1">条美食记录</p>
          </div>
        </div>

        {/* Category Pie + Map Placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className="text-base font-black text-slate-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-amber-500" />
              标签占比
            </h3>
            {Object.values(stats.categoryCount).some(v => v > 0) ? (
              <ReactECharts option={pieOption} style={{ height: 300 }} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-300 text-sm font-medium">暂无数据</div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className="text-base font-black text-slate-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              <MapIcon size={16} className="text-amber-500" />
              美食地图
            </h3>
            <div className="h-[300px]">
              <FoodMap records={filteredRecords} />
            </div>
          </div>
        </div>

        {/* Rating Leaderboard */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-[var(--text-color)] flex items-center gap-2">
            <Trophy size={20} className="text-amber-500" />
            评分榜 · 各类 TOP 3
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {foodTags.map(tag => {
              const topItems = (stats.categoryRatings[tag.name] || []).slice(0, 3);
              return (
                <div key={tag.id} className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-6 rounded-full bg-amber-400" />
                    <h4 className="text-sm font-black text-slate-700 dark:text-gray-200 uppercase tracking-wide">{tag.name}</h4>
                    <span className="text-[10px] text-gray-400 font-bold ml-auto">{stats.categoryCount[tag.name] || 0} 条</span>
                  </div>
                  {topItems.length > 0 ? (
                    <div className="space-y-3">
                      {topItems.map((item, i) => {
                        const medalColors = ['text-amber-500', 'text-gray-400', 'text-orange-400'];
                        const bgColors = ['bg-amber-50 dark:bg-amber-900/10', 'bg-gray-50 dark:bg-gray-800/50', 'bg-orange-50 dark:bg-orange-900/10'];
                        return (
                          <div key={`${tag.id}-${i}`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${bgColors[i] || 'bg-gray-50'}`}>
                            <span className={`text-lg font-black ${medalColors[i] || 'text-gray-400'}`}>
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                            </span>
                            <span className="flex-1 text-sm font-bold text-slate-700 dark:text-gray-200 truncate">{item.name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <Star size={12} className="text-amber-400" fill="currentColor" />
                              <span className="text-sm font-black text-amber-600">{item.rating.toFixed(1)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-300 italic text-center py-6">暂无评分记录</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Global Footer Disclaimer */}
        <div className="mt-8 pb-6 text-center">
          <p className="text-[12px] text-[#bbb] dark:text-[#555] leading-relaxed">
            本站为非营利性技术实验项目。地图数据由高德提供。用户评价数据存储于受保护的私有数据库。
          </p>
        </div>
      </div>

      {/* ═══ Poster Preview Modal ═══ */}
      {posterImage && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center p-4 sm:p-10 animate-in fade-in duration-300">
          <button onClick={() => setPosterImage(null)} className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all">
            <X size={28} />
          </button>
          <div className="bg-white p-2 rounded-2xl shadow-2xl max-w-full max-h-[80vh] overflow-y-auto mb-6">
            <img src={posterImage} alt="Food Summary Poster" className="w-full h-auto block rounded-xl shadow-lg" />
          </div>
          <div className="text-white text-center space-y-3">
            <p className="text-2xl font-black flex items-center justify-center gap-3">
              <Download size={24} className="text-amber-400" /> 海报已生成
            </p>
            <p className="text-base text-gray-300 font-bold">长按上方图片保存到相册</p>
          </div>
        </div>
      )}

      {/* ═══ Hidden Poster Template ═══ */}
      <div
        id="food-poster-template"
        style={{
          position: 'fixed', left: '-9999px', top: 0,
          width: '750px',
          fontFamily: '"PingFang SC", "Noto Serif SC", sans-serif',
          color: '#ffffff',
          backgroundColor: '#1a1a2e',
          padding: '0',
        }}
      >
        <div style={{
          padding: '60px 48px',
          background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
          display: 'flex', flexDirection: 'column', gap: '28px',
        }}>

          {/* Title area on dark bg */}
          <div style={{ textAlign: 'center', padding: '20px 0 10px 0' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.5em', color: 'rgba(255,255,255,0.45)', marginBottom: '16px', textTransform: 'uppercase' }}>ALIBI LOG · FOOD ARCHIVE</div>
            <div style={{ fontSize: '52px', fontWeight: 900, color: '#ffffff', letterSpacing: '0.25em', margin: '0 0 14px 0', textShadow: '0 2px 20px rgba(245,158,11,0.3)' }}>美 食 菜 单</div>
            <div style={{ width: '80px', height: '3px', background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)', margin: '0 auto 16px auto', borderRadius: '2px' }} />
            <div style={{ fontSize: '20px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
              {posterTimeLabel}
            </div>
          </div>

          {/* Stats Card */}
          <div style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '20px', padding: '36px 40px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '24px' }}>
              <span style={{ fontSize: '22px', fontWeight: 800, color: '#1a1a2e' }}>📊 数据总览</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.15em', fontStyle: 'italic' }}>DATA OVERVIEW</span>
            </div>
            {[
              ['🏪 探店数', `${stats.uniqueCount} 家`],
              ['💰 总花费', `¥${stats.totalSpend.toLocaleString()}`],
              ['🏙️ 城市足迹', `${stats.cityCount} 城`],
              ['📝 记录数量', `${filteredRecords.length} 条`],
            ].map(([label, value], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '14px', fontSize: '22px' }}>
                <span style={{ fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>{label}</span>
                <div style={{ flex: 1, borderTop: '3px dotted #94a3b8', margin: '0 14px', minWidth: '30px', position: 'relative', top: '12px' }} />
                <span style={{ fontWeight: 800, color: '#f59e0b', whiteSpace: 'nowrap', fontSize: '24px' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Tag Distribution Card */}
          {Object.entries(stats.categoryCount).filter(([_, c]) => c > 0).length > 0 && (
            <div style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '20px', padding: '36px 40px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '24px' }}>
                <span style={{ fontSize: '22px', fontWeight: 800, color: '#1a1a2e' }}>🏷️ 标签占比</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.15em', fontStyle: 'italic' }}>TAG DISTRIBUTION</span>
              </div>
              {Object.entries(stats.categoryCount)
                .filter(([_, count]) => count > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([name, count], i) => {
                  const total = Object.values(stats.categoryCount).reduce((s, c) => s + c, 0);
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '14px', fontSize: '22px' }}>
                      <span style={{ fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>{name}</span>
                      <div style={{ flex: 1, borderTop: '3px dotted #94a3b8', margin: '0 14px', minWidth: '30px', position: 'relative', top: '12px' }} />
                      <span style={{ fontWeight: 800, color: '#f59e0b', whiteSpace: 'nowrap', fontSize: '22px' }}>{count}次 ({pct}%)</span>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Top 5 Restaurants Card */}
          {top5Restaurants.length > 0 && (
            <div style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '20px', padding: '36px 40px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '24px' }}>
                <span style={{ fontSize: '22px', fontWeight: 800, color: '#1a1a2e' }}>🏆 最佳餐厅 TOP 5</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.15em', fontStyle: 'italic' }}>TOP 5 RESTAURANTS</span>
              </div>
              {top5Restaurants.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '14px', fontSize: '22px' }}>
                  <span style={{ fontWeight: 800, color: i === 0 ? '#d4a017' : i === 1 ? '#a0a0a0' : i === 2 ? '#cd7f32' : '#334155', marginRight: '12px', fontSize: '22px' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                  </span>
                  <span style={{ fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>{r.name}</span>
                  <div style={{ flex: 1, borderTop: '3px dotted #94a3b8', margin: '0 14px', minWidth: '30px', position: 'relative', top: '12px' }} />
                  <span style={{ fontWeight: 800, color: '#f59e0b', whiteSpace: 'nowrap', fontSize: '22px' }}>
                    {'★'.repeat(Math.round(r.rating))} {r.rating.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Top 5 Dishes Card */}
          {top5Dishes.length > 0 && (
            <div style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '20px', padding: '36px 40px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '24px' }}>
                <span style={{ fontSize: '22px', fontWeight: 800, color: '#1a1a2e' }}>🍜 最佳菜品 TOP 5</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.15em', fontStyle: 'italic' }}>TOP 5 DISHES</span>
              </div>
              {top5Dishes.map((d, i) => (
                <div key={i} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '22px' }}>
                    <span style={{ fontWeight: 800, color: i === 0 ? '#d4a017' : i === 1 ? '#a0a0a0' : i === 2 ? '#cd7f32' : '#334155', marginRight: '12px', fontSize: '22px' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                    </span>
                    <span style={{ fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>{d.dish}</span>
                    <div style={{ flex: 1, borderTop: '3px dotted #94a3b8', margin: '0 14px', minWidth: '30px', position: 'relative', top: '12px' }} />
                    <span style={{ fontWeight: 800, color: '#f59e0b', whiteSpace: 'nowrap', fontSize: '22px' }}>
                      {'★'.repeat(d.rating)} {d.rating}
                    </span>
                  </div>
                  <div style={{ fontSize: '16px', color: '#94a3b8', marginLeft: '38px', marginTop: '4px', fontStyle: 'italic' }}>— {d.restaurant}</div>
                </div>
              ))}
            </div>
          )}

          {/* Bottom branding on dark */}
          <div style={{ textAlign: 'center', padding: '16px 0 8px 0' }}>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', letterSpacing: '0.35em', marginBottom: '10px', textShadow: '0 2px 10px rgba(245,158,11,0.2)' }}>ALIBI LOG</div>
            <div style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em' }}>你的生活本就值得记录</div>
          </div>

        </div>
      </div>
    </div>
  );
};
