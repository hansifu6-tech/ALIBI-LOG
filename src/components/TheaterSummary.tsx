import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Theater, MapPin, Ticket, Star, LayoutGrid, Calendar, TrendingUp, CheckSquare, Square, Filter, Share2, Download, X, Loader2, Users } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';
import type { EventRecord, RecordTag, TheaterMetadata } from '../types';
import { renderTheaterTicket } from '../utils/theaterTicketRenderer';
import { renderHorizontalTicket } from '../utils/horizontalTicketRenderer';
import { provinceData } from '../utils/cityData';

const ensureFullName = (name: string): string => {
  if (!name) return "";
  let clean = name.trim();
  
  // Official names in GeoJSON
  const autonomousRegions: Record<string, string> = {
    "内蒙古": "内蒙古自治区", "广西": "广西壮族自治区", "西藏": "西藏自治区", 
    "宁夏": "宁夏回族自治区", "新疆": "新疆维吾尔自治区"
  };
  const specialRegions: Record<string, string> = {
    "香港": "香港特别行政区", "澳门": "澳门特别行政区"
  };
  const municipalities = ["北京", "上海", "天津", "重庆"];

  if (autonomousRegions[clean]) return autonomousRegions[clean];
  if (specialRegions[clean]) return specialRegions[clean];
  if (municipalities.includes(clean)) return clean + "市";
  
  // Check if ends with standard suffixes
  if (clean.endsWith('省') || clean.endsWith('市') || clean.endsWith('自治区') || clean.endsWith('特别行政区')) {
    return clean;
  }

  // Final fallback (most common case is "广东" -> "广东省")
  return clean + "省";
};

interface TheaterSummaryProps {
  records: EventRecord[];
  tags: RecordTag[];
}



export const TheaterSummary: React.FC<TheaterSummaryProps> = ({ records, tags }) => {
  const navigate = useNavigate();
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  // Phase 208: Dynamically derive theater tags from DB
  const theaterTags = useMemo(() => tags.filter(t => t.tag_type === 'theatre'), [tags]);
  const theaterTagNames = useMemo(() => new Set(theaterTags.map(t => t.name)), [theaterTags]);
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);

  // Auto-select all theater tags when they load/change
  useEffect(() => {
    setSelectedTagNames(Array.from(theaterTagNames));
  }, [theaterTagNames]);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [chinaGeo, setChinaGeo] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingH, setIsExportingH] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [posterImage, setPosterImage] = useState<string | null>(null);
  const summaryAreaRef = useRef<HTMLDivElement>(null);
  const echartsRef = useRef<any>(null);
  const pieChartRef = useRef<any>(null);

  // selectedYears [] = all years (no filter applied)

  // Load China Map Data
  useEffect(() => {
    fetch('/maps/china.json')
      .then(res => res.json())
      .then(data => {
        console.log('🗺️ Map JSON Loaded. Example feature name:', data.features[0]?.properties?.name);
        setChinaGeo(data);
        echarts.registerMap('china', data);
        console.log('✅ echarts.registerMap("china") executed.');
      })
      .catch(err => console.error('❌ Failed to load map:', err));
  }, []);

  const years = useMemo(() => {
    const yearsSet = new Set<string>();
    records.forEach(r => {
      const year = r.dateStr?.split('-')[0];
      if (year) yearsSet.add(year);
    });
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // Category filter: include records that either have a selected theatre tag,
      // OR have parent_tag '演出模式' but no theatre sub-tags (only when ALL tags are selected).
      const rTags = r.tagIds?.map(id => tags.find(t => t.id === id)?.name).filter(Boolean) as string[];
      const hasSelectedTag = rTags.some(name => selectedTagNames.includes(name));
      const isTheaterWithNoSubTag = r.parent_tag === '演出模式' && !rTags.some(name => theaterTagNames.has(name));
      const allTagsSelected = selectedTagNames.length === theaterTags.length;
      if (!hasSelectedTag && !(isTheaterWithNoSubTag && allTagsSelected)) return false;

      // Time filter
      const [y, m] = r.dateStr?.split('-') || [];
      const mStr = parseInt(m, 10).toString();
      
      if (selectedYears.length > 0 && !selectedYears.includes(y)) return false;
      if (selectedMonths.length > 0 && !selectedMonths.includes(mStr)) return false;
      
      return true;
    });
  }, [records, tags, selectedYears, selectedMonths, selectedTagNames]);

  // Aggregated Data
  const stats = useMemo(() => {
    let spend = 0;
    // Phase 208: Dynamic category count from actual theater tags
    const categoryCount: Record<string, number> = {};
    theaterTags.forEach(t => { categoryCount[t.name] = 0; });
    
    filteredRecords.forEach(r => {
      const extra = r.extra_data as TheaterMetadata | undefined;
      if (extra?.price) spend += Number(extra.price);
      
      // Category count
      r.tagIds?.forEach(id => {
        const tag = tags.find(t => t.id === id);
        if (tag && theaterTagNames.has(tag.name)) {
          categoryCount[tag.name] = (categoryCount[tag.name] || 0) + 1;
        }
      });
    });

    // --- New Weighted Loyalty Stats Logic ---
    const categoryScores: Record<string, { total: number; count: number }> = {};
    filteredRecords.forEach(r => {
      const extra = r.extra_data as TheaterMetadata | undefined;
      const score = extra?.score || 0;
      if (score > 0) {
        r.tagIds?.forEach(id => {
          const tag = tags.find(t => t.id === id);
          if (tag && theaterTagNames.has(tag.name)) {
            if (!categoryScores[tag.name]) categoryScores[tag.name] = { total: 0, count: 0 };
            categoryScores[tag.name].total += score;
            categoryScores[tag.name].count += 1;
          }
        });
      }
    });

    const categoryAverages: Record<string, number> = {};
    Object.entries(categoryScores).forEach(([cat, data]) => {
      categoryAverages[cat] = data.total / data.count;
    });

    const actorWeights: Record<string, number> = {};
    const theaterCounts: Record<string, number> = {};
    
    filteredRecords.forEach(r => {
      const extra = r.extra_data as TheaterMetadata | undefined;
      let recordScore = extra?.score || 0;
      
      // Fallback to category average if no score
      if (recordScore === 0) {
        const catTag = tags.find(t => r.tagIds?.includes(t.id) && theaterTagNames.has(t.name));
        if (catTag) recordScore = categoryAverages[catTag.name] || 0;
      }

      if (extra?.actors) {
        extra.actors.split(/[,，、；;.。\s\t\/|｜]+/).map(a => a.trim()).filter(Boolean).forEach(actor => {
          actorWeights[actor] = (actorWeights[actor] || 0) + recordScore;
        });
      }
      if (extra?.theater) {
        const t = extra.theater.trim();
        if (t && !['未知','undefined','null'].some(k => t.includes(k))) {
          theaterCounts[t] = (theaterCounts[t] || 0) + 1;
        }
      }
    });

    // Get Top 3 Actors by Weighted Score and total count for overflow check
    const allActorsOrdered = Object.entries(actorWeights)
      .sort((a, b) => b[1] - a[1]);
    
    const topActors = allActorsOrdered
      .slice(0, 3)
      .map(([name, score]) => ({ name, score }));

    const hasMoreActors = allActorsOrdered.length > 3;

    let spiritualHome = { name: '-', count: 0 };
    Object.entries(theaterCounts).forEach(([name, count]) => {
      if (count > spiritualHome.count) spiritualHome = { name, count };
    });

    // Additional stats for mirror component
    const uniqueProvinces = new Set<string>();
    let totalDays = 0;
    let firstDate: Date | null = null;
    let lastDate: Date | null = null;

    filteredRecords.forEach(r => {
      const extra = r.extra_data as TheaterMetadata | undefined;
      if (extra?.city) {
        let provinceValue = '';
        if (Array.isArray(extra.city)) {
          provinceValue = extra.city[0];
        } else {
          const inputCity = extra.city as string;
          const foundProv = provinceData.find(p => p.cities.includes(inputCity) || p.name === inputCity);
          provinceValue = foundProv ? foundProv.name : inputCity;
        }
        if (provinceValue) {
          uniqueProvinces.add(ensureFullName(provinceValue));
        }
      }

      if (r.dateStr) {
        const recordDate = new Date(r.dateStr);
        if (!firstDate || recordDate < firstDate) firstDate = recordDate;
        if (!lastDate || recordDate > lastDate) lastDate = recordDate;
      }
    });

    if (firstDate && lastDate) {
      totalDays = Math.ceil(Math.abs((lastDate as Date).getTime() - (firstDate as Date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    const avgPrice = filteredRecords.length > 0 ? spend / filteredRecords.length : 0;

    return {
      total: filteredRecords.length,
      spend,
      categoryCount,
      loyalty: {
        actors: topActors, // Top 3 Weighted Actors
        hasMoreActors, 
        theater: spiritualHome
      },
      // Stats for mirror
      totalShows: filteredRecords.length,
      provinceCount: uniqueProvinces.size,
      totalDays: totalDays,
      activeHabitCount: filteredRecords.length, // Simplified, could be more complex
      avgPrice: avgPrice.toFixed(2),
      totalSpent: spend,
      favoriteActors: topActors,
      favoriteTheater: spiritualHome.name,
      maxTheaterCount: spiritualHome.count,
    };
  }, [filteredRecords, tags, theaterTags, theaterTagNames]);

  const topShows = useMemo(() => {
    const scored = [...filteredRecords]
      .filter(r => (r.extra_data as TheaterMetadata)?.score)
      .sort((a, b) => {
        const scoreA = (a.extra_data as TheaterMetadata).score || 0;
        const scoreB = (b.extra_data as TheaterMetadata).score || 0;
        return scoreB - scoreA;
      });
      
    if (scored.length <= 5) return scored;
    
    const fifthScore = (scored[4].extra_data as TheaterMetadata).score || 0;
    return scored.filter(r => ((r.extra_data as TheaterMetadata).score || 0) >= fifthScore);
  }, [filteredRecords]);

  // ECharts Map Option
  const mapOption = useMemo(() => {
    const provinceStats: Record<string, number> = {};
    const geoNames = chinaGeo?.features?.map((f: any) => f.properties.name) || [];

    // Map logic: Inclusive - any record with city counts towards footprint
    filteredRecords.forEach(r => {
      const extra = r.extra_data as TheaterMetadata | undefined;
      let provinceValue = '';

      if (extra?.city) {
        if (Array.isArray(extra.city)) {
          // New format: [Province, City]
          provinceValue = extra.city[0];
        } else {
          // Compatibility logic for old format: "CityName"
          const inputCity = extra.city as string;
          const foundProv = provinceData.find(p => p.cities.includes(inputCity) || p.name === inputCity);
          provinceValue = foundProv ? foundProv.name : inputCity;
        }
      }
      
      if (provinceValue) {
        const standardName = ensureFullName(provinceValue);
        if (geoNames.includes(standardName)) {
          provinceStats[standardName] = (provinceStats[standardName] || 0) + 1;
        } else {
          // Dynamic fuzzy check if strict fail
          const matched = geoNames.find((gn: string) => 
            gn.includes(provinceValue) || provinceValue.includes(gn.replace(/(省|市|自治区|特别行政区)/g, ''))
          );
          if (matched) provinceStats[matched] = (provinceStats[matched] || 0) + 1;
        }
      }
    });

    const data = Object.entries(provinceStats).map(([name, value]) => ({ name, value }));
    const max = Math.max(...data.map(d => d.value), 10); // Standardize scale

    return {
      tooltip: { 
        trigger: 'item', 
        formatter: (params: any) => {
          const val = params.value || 0;
          return `${params.name}: ${val} 场`;
        }
      },
      visualMap: {
        min: 0,
        max: max,
        left: 'right',
        top: 'bottom',
        text: ['高', '低'],
        calculable: true,
        inRange: { color: ['#f3e8ff', '#9333ea', '#6b21a8'] },
        show: false
      },
      series: [
        {
          name: '演出足迹',
          type: 'map',
          map: 'china',
          roam: false,
          label: { show: false },
          emphasis: {
            label: { show: true, color: '#9333ea' },
            itemStyle: { areaColor: '#f3e8ff' }
          },
          data: data,
          itemStyle: {
            borderColor: 'rgba(147, 51, 234, 0.2)',
            areaColor: 'rgba(209, 213, 219, 0.3)'
          }
        }
      ],
      layoutCenter: ['50%', '53%'],
      layoutSize: '83%'
    };
  }, [filteredRecords, chinaGeo]);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    
    try {
      // 1. Prepare Stats for Renderer
      const uniqueProvinces = new Set<string>();
      filteredRecords.forEach(r => {
        const extra = r.extra_data as TheaterMetadata | undefined;
        if (extra?.city) {
          let provinceValue = '';
          if (Array.isArray(extra.city) && extra.city[0]) {
            provinceValue = extra.city[0];
          } else if (typeof extra.city === 'string') {
            const inputCity = extra.city;
            const foundProv = provinceData.find(p => p.cities.includes(inputCity) || p.name === inputCity);
            provinceValue = foundProv ? foundProv.name : inputCity;
          }
          if (provinceValue) uniqueProvinces.add(provinceValue);
        }
      });

      const provinces = Array.from(uniqueProvinces);
      
      const renderStats = {
        total: stats.total,
        spend: stats.spend,
        categoryCount: stats.categoryCount,
        loyalty: stats.loyalty,
        provinceCount: provinces.length,
        provinces: provinces
      };

      // 2. Generate Date Range String from user selection (not from filtered records)
      let dateRangeStr = '';
      if (selectedYears.length === 1) {
        const year = selectedYears[0];
        const sortedMonths = [...selectedMonths].map(m => parseInt(m, 10)).sort((a, b) => a - b);
        if (sortedMonths.length === 1) {
          dateRangeStr = `${year}.${sortedMonths[0]}`;
        } else if (sortedMonths.length > 1) {
          dateRangeStr = `${year}.${sortedMonths[0]} - ${year}.${sortedMonths[sortedMonths.length - 1]}`;
        } else {
          dateRangeStr = `${year} 年度总结`;
        }
      } else if (selectedYears.length > 1) {
        const sorted = [...selectedYears].sort();
        dateRangeStr = `${sorted[0]} - ${sorted[sorted.length - 1]}`;
      } else {
        dateRangeStr = '全时段总结';
      }

      // 3. Render Canvas
      const dataUrl = await renderTheaterTicket({
        records: filteredRecords,
        stats: renderStats,
        dateRangeStr
      });

      setPosterImage(dataUrl);
      console.log('🎟️ Canvas Ticket Generation successful!');

    } catch (err: any) {
      console.error('❌ Canvas Export Error:', err);
      alert('海报生成失败: ' + (err?.message || '画布引擎异常'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleHorizontalExport = async () => {
    if (isExportingH) return;
    setIsExportingH(true);
    
    try {
      const uniqueProvinces = new Set<string>();
      filteredRecords.forEach(r => {
        const extra = r.extra_data as TheaterMetadata | undefined;
        if (extra?.city) {
          let provinceValue = '';
          if (Array.isArray(extra.city) && extra.city[0]) {
            provinceValue = extra.city[0];
          } else if (typeof extra.city === 'string') {
            const inputCity = extra.city;
            const foundProv = provinceData.find(p => p.cities.includes(inputCity) || p.name === inputCity);
            provinceValue = foundProv ? foundProv.name : inputCity;
          }
          if (provinceValue) uniqueProvinces.add(provinceValue);
        }
      });

      const provinces = Array.from(uniqueProvinces);
      const renderStats = {
        total: stats.total,
        spend: stats.spend,
        categoryCount: stats.categoryCount,
        loyalty: stats.loyalty,
        provinceCount: provinces.length,
        provinces: provinces
      };

      let dateRangeStr = '';
      if (selectedYears.length === 1) {
        const year = selectedYears[0];
        const sortedMonths = [...selectedMonths].map(m => parseInt(m, 10)).sort((a, b) => a - b);
        if (sortedMonths.length === 1) {
          dateRangeStr = `${year}.${sortedMonths[0]}`;
        } else if (sortedMonths.length > 1) {
          dateRangeStr = `${year}.${sortedMonths[0]} - ${year}.${sortedMonths[sortedMonths.length - 1]}`;
        } else {
          dateRangeStr = `${year} 年度总结`;
        }
      } else if (selectedYears.length > 1) {
        const sorted = [...selectedYears].sort();
        dateRangeStr = `${sorted[0]} - ${sorted[sorted.length - 1]}`;
      } else {
        dateRangeStr = '全时段总结';
      }

      const dataUrl = await renderHorizontalTicket({
        records: filteredRecords,
        stats: renderStats,
        dateRangeStr,
        theaterTags
      });

      setPosterImage(dataUrl);
      console.log('🎟️ Horizontal Ticket Generation successful!');

    } catch (err: any) {
      console.error('❌ Horizontal Export Error:', err);
      alert('横版海报生成失败: ' + (err?.message || '画布引擎异常'));
    } finally {
      setIsExportingH(false);
    }
  };

  const pieOption = useMemo(() => {
    const data = Object.entries(stats.categoryCount)
      .filter(([_, count]) => count > 0)
      .map(([name, value]) => ({ name, value }));

    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: '5%', left: 'center', textStyle: { color: 'inherit' } },
      series: [
        {
          name: '类别占比',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
          labelLine: { show: false },
          data: data,
          color: [
            '#9333ea', '#3b82f6', '#10b981', '#f59e0b', 
            '#ef4444', '#ec4899', '#06b6d4', '#f97316',
            '#6366f1', '#14b8a6', '#e11d48', '#84cc16',
            '#a855f7', '#0ea5e9', '#f43f5e', '#22c55e',
            '#d946ef', '#0891b2', '#fb7185', '#65a30d',
            '#7c3aed', '#2dd4bf', '#be123c', '#facc15',
          ]
        }
      ]
    };
  }, [stats]);

  return (
    <div className="min-h-screen bg-[var(--bg-color)] text-[var(--text-color)] p-4 sm:p-10 transition-colors duration-300 pb-20">
      <div className="max-w-6xl mx-auto space-y-8" ref={summaryAreaRef} data-summary-area="true">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="p-2.5 bg-white hover:bg-gray-50 rounded-xl transition-all border border-gray-100 shadow-sm text-slate-900 export-hide"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-[var(--text-color)]">
                <Theater className="text-purple-600" />
                观演总结
              </h1>
              <p className="text-xs text-slate-400 font-medium tracking-widest uppercase">Theater Analytics</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-base font-bold transition-all export-hide shadow-sm hover:shadow-md ${showFilterPanel ? 'bg-purple-600 text-white' : 'bg-white text-purple-600'}`}
            >
              <Filter size={20} />
              筛选记录
            </button>
            
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isExporting || isExportingH}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl shadow-lg shadow-purple-500/20 transition-all active:scale-95 disabled:opacity-50 export-hide"
              >
                {(isExporting || isExportingH) ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
                <span className="text-sm font-bold">导出海报</span>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl border border-gray-100 shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <button
                    onClick={() => { setShowExportMenu(false); handleExport(); }}
                    className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-purple-50 hover:text-purple-600 transition-colors flex items-center gap-2"
                  >
                    <Share2 size={14} />
                    竖版海报
                  </button>
                  <button
                    onClick={() => { setShowExportMenu(false); handleHorizontalExport(); }}
                    className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-600 transition-colors flex items-center gap-2 border-t border-gray-50"
                  >
                    <Ticket size={14} />
                    横版海报
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showFilterPanel && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-8 animate-in fade-in zoom-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Year Filter */}
              <div className="space-y-4">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                  <Calendar size={14} className="text-purple-500" /> 年份
                </h4>
                <div className="flex flex-wrap gap-2">
                  {years.map(y => (
                    <button
                      key={y}
                      onClick={() => setSelectedYears(prev => 
                        prev.includes(y) ? prev.filter(item => item !== y) : [...prev, y]
                      )}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-2 ${
                        selectedYears.includes(y) 
                          ? 'border-purple-600 bg-purple-50 text-purple-600 shadow-sm' 
                          : 'border-gray-100 text-gray-400 hover:border-gray-200 opacity-60'
                      }`}
                    >
                      {y}年
                    </button>
                  ))}
                  {years.length > 0 && (
                    <button
                      onClick={() => setSelectedYears([])}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedYears.length === 0 ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-400 opacity-60'}`}
                    >
                      全选
                    </button>
                  )}
                </div>
              </div>

              {/* Month Filter */}
              <div className="space-y-4">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp size={14} className="text-blue-500" /> 月份
                </h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedMonths([])}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedMonths.length === 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400 opacity-60'}`}
                  >
                    全部月份
                  </button>
                  {Array.from({ length: 12 }, (_, i) => (i + 1).toString()).map(m => (
                    <button
                      key={m}
                      onClick={() => setSelectedMonths(prev => 
                        prev.includes(m) ? prev.filter(item => item !== m) : [...prev, m]
                      )}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border-2 ${
                        selectedMonths.includes(m) 
                          ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-sm' 
                          : 'border-gray-100 text-gray-400 hover:border-gray-200 opacity-60'
                      }`}
                    >
                      {m}月
                    </button>
                  ))}
                </div>
              </div>

              {/* Tag Categories filter */}
              <div className="space-y-4">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                  <LayoutGrid size={14} className="text-emerald-500" /> 标签筛选
                </h4>
                <div className="flex flex-wrap gap-2">
                  {theaterTags.map(t => t.name).map(tagName => (
                    <button
                      key={tagName}
                      onClick={() => setSelectedTagNames(prev => 
                        prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
                      )}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-2 ${
                        selectedTagNames.includes(tagName)
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-600 shadow-sm'
                          : 'border-gray-100 text-gray-400 opacity-60'
                      }`}
                    >
                      {selectedTagNames.includes(tagName) ? <CheckSquare size={14} /> : <Square size={14} />}
                      {tagName}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <LayoutGrid size={18} className="text-purple-600" />
              </div>
              <span className="text-sm font-black text-slate-500 uppercase tracking-tighter">观看场次</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black tracking-tighter text-slate-900">{stats.total}</span>
              <span className="text-xs font-bold text-gray-400 uppercase">场</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MapPin size={18} className="text-blue-600" />
              </div>
              <span className="text-sm font-black text-slate-500 uppercase tracking-tighter">足迹省份</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black tracking-tighter text-slate-900">
                {mapOption.series[0].data.length}
              </span>
              <span className="text-xs font-bold text-gray-400 uppercase">个</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp size={18} className="text-green-600" />
              </div>
              <span className="text-sm font-black text-slate-500 uppercase tracking-tighter">平均消费</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black tracking-tighter text-slate-900">
                {stats.total > 0 ? (stats.spend / stats.total).toFixed(0) : 0}
              </span>
              <span className="text-xs font-bold text-gray-400 uppercase">￥/场</span>
            </div>
          </div>

          <div className="bg-purple-600 p-5 rounded-xl shadow-xl shadow-purple-500/20 text-white col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 rounded-lg">
                <Ticket size={18} className="text-white" />
              </div>
              <span className="text-sm font-black text-purple-100 uppercase tracking-tighter">总支出</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-black">￥</span>
              <span className="text-3xl font-black tracking-tighter">{stats.spend.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Charts Middle Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map Chart */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm min-h-[420px] relative overflow-hidden flex flex-col transition-all">
            <div className="absolute top-4 left-4 z-10 px-2 py-1">
              <h3 className="text-xl font-black flex items-center gap-2 text-slate-800">
                <MapPin size={22} className="text-purple-600" />
                各省足迹分布
              </h3>
            </div>
            <div className="w-full h-full min-h-[420px]">
              {chinaGeo ? (
                <ReactECharts 
                  ref={echartsRef}
                  option={mapOption} 
                  style={{ height: '100%', width: '100%' }}
                  echarts={echarts}
                  notMerge={true}
                  theme="light"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 animate-pulse">
                  地图加载中...
                </div>
              )}
            </div>
          </div>

          {/* Loyalty Section */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm min-h-[420px] relative overflow-hidden flex flex-col transition-all">
            <div className="absolute top-4 left-4 z-10 px-2 py-1">
              <h3 className="text-xl font-black flex items-center gap-2 text-slate-800">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="red" stroke="red" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                演出忠诚度
              </h3>
            </div>

            <div className="flex-1 flex flex-col justify-center space-y-6 px-6 pt-12 pb-6">
              <div className="bg-purple-50 p-5 rounded-2xl border border-purple-100">
                <div className="text-sm font-black text-purple-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Users size={16} className="text-purple-600" /> 最爱演员
                </div>
                <div className="flex flex-wrap items-center gap-y-1">
                  {stats.loyalty.actors.length > 0 ? (
                    <>
                      <span className="text-base font-black text-slate-800 break-all leading-tight">
                        {stats.loyalty.actors.map((actor: { name: string; score: number }) => actor.name).join(' | ')}
                        {stats.loyalty.hasMoreActors && ' ...'}
                      </span>
                    </>
                  ) : (
                    <div className="text-slate-400 font-bold italic text-sm py-1">暂无演员信息</div>
                  )}
                </div>
              </div>

              <div className="bg-purple-50 p-5 rounded-2xl border border-purple-100">
                <div className="text-sm font-black text-purple-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Theater size={16} className="text-purple-600" /> 精神老家
                </div>
                <div className="flex items-baseline justify-between overflow-hidden">
                  <span className="text-xl font-black text-slate-800 truncate pr-2" title={stats.loyalty.theater.name}>{stats.loyalty.theater.name}</span>
                  <span className="text-sm font-bold text-slate-500 shrink-0"><span className="text-slate-900 text-lg mr-1 font-black">{stats.loyalty.theater.count}</span>次</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pie Chart */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm min-h-[420px] relative overflow-hidden transition-all">
            <div className="absolute top-4 left-4 z-10 px-2 py-1">
              <h3 className="text-xl font-black flex items-center gap-2 text-slate-800">
                <Calendar size={22} className="text-blue-500" />
                观看类别构成
              </h3>
            </div>
            <div className="w-full h-full min-h-[420px] pt-12 flex items-center">
              <ReactECharts 
                ref={pieChartRef}
                option={pieOption} 
                style={{ height: '100%', width: '100%' }}
                echarts={echarts}
                notMerge={true}
                theme="light"
              />
            </div>
          </div>
        </div>

        {/* Bottom Section: Top 5 */}
        <div className="bg-white text-slate-900 border border-slate-100 rounded-xl p-8 sm:p-10 shadow-sm relative overflow-hidden transition-all">
          {/* Accent decoration */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-purple-500/20 blur-[100px] rounded-full" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-blue-500/10 blur-[100px] rounded-full" />
          
          <div className="relative">
            <h3 className="text-2xl font-black italic tracking-tighter mb-8 flex items-center gap-3">
              <Star className="text-yellow-400 fill-yellow-400" size={28} />
              最爱演出 · TOP 5
            </h3>

            <div className="space-y-6">
              {topShows.length > 0 ? topShows.map((r, i) => {
                const extra = r.extra_data as TheaterMetadata;
                return (
                  <div key={r.id} className="flex items-center gap-4 group">
                    <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-sm font-black text-white shadow-lg shadow-purple-500/20 transition-all group-hover:scale-110">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-800 group-hover:text-purple-600 transition-colors truncate">
                        {r.title}
                      </h4>
                      <div className="flex items-center gap-3 text-[13px] text-slate-400 font-bold uppercase tracking-wider mt-1.5 line-height-relaxed">
                        <span>{Array.isArray(extra.city) ? extra.city.join(' · ') : extra.city}</span>
                        <span>{extra.theater}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="flex gap-0.5 text-yellow-500">
                        {Array.from({ length: 5 }).map((_, si) => (
                          <Star key={si} size={20} fill={si < (extra.score || 0) ? 'currentColor' : 'none'} className={si >= (extra.score || 0) ? 'text-slate-100' : ''} />
                        ))}
                      </div>
                      <span className="text-base font-black italic mt-1 text-purple-600 pr-0.5">{extra.score} <span className="text-[10px] font-bold">/ 5.0</span></span>
                    </div>
                  </div>
                );
              }) : (
                <div className="py-10 text-center text-slate-400 font-bold italic">
                  暂无高分记录，去记录一场难忘的演出吧 ✨
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Poster Export Preview Modal */}
      {posterImage && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center p-4 sm:p-10 animate-in fade-in duration-300">
          <button 
            onClick={() => setPosterImage(null)}
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all active:scale-90"
          >
            <X size={28} />
          </button>
          
          <div className="bg-white p-2 rounded-2xl shadow-2xl max-w-full max-h-[80vh] overflow-y-auto mb-6 scrollbar-hide">
            <img 
              src={posterImage} 
              alt="Theater Summary Poster" 
              className="w-full h-auto block rounded-xl"
            />
          </div>
          
          <div className="text-white text-center space-y-3">
            <p className="text-2xl font-black flex items-center justify-center gap-3">
              <Download size={24} className="text-purple-400" />
              票根海报已生成
            </p>
            <p className="text-base text-gray-300 font-bold">长按上方图片保存到相册，分享你的演出生活</p>
          </div>
        </div>
      )}

      {/* Global Footer Disclaimer */}
      <div className="mt-8 pb-6 text-center px-4">
        <p className="text-[12px] text-[#bbb] dark:text-[#555] leading-relaxed">
          本站为非营利性技术实验项目。地图数据由高德提供。用户评价数据存储于受保护的私有数据库。
        </p>
      </div>

    </div>
  );
};
