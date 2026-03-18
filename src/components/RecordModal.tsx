import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, Check, Trash2, RotateCcw, Camera, Star, MapPin, LocateFixed, GripVertical, Pencil } from 'lucide-react';
import { presetColors } from '../utils/colors';
import { provinceData } from '../utils/cityData';
import type { CalendarColor } from '../utils/colors';
import type { CalendarRecord, RecordTag, DailyRecord, EventRecord, TheaterMetadata, FoodMetadata, TravelMetadata, TravelAttraction } from '../types';
import { uploadImages } from '../hooks/useSupabaseData';
import { modulesConfig } from '../config/modulesConfig';

// ── AMap Security Config (Hard Injection) ────────────────────────
if (typeof window !== 'undefined') {
  (window as any)._AMapSecurityConfig = {
    securityJsCode: '9ec70dc2db7d42cc92feb1a2b825e22f',
  };
}

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  onAddRecord: (record: CalendarRecord) => void;
  onUpdateRecord: (record: CalendarRecord) => void;
  onDeleteRecord: (id: string, type: 'daily' | 'special', content?: string) => void;
  editingRecord: { record: CalendarRecord, dateStr: string } | null;
  tags: RecordTag[];
  allAvailableTags: RecordTag[];   // Cloud tag suggestions from Supabase
  onAddTag: (tag: RecordTag) => Promise<RecordTag | null>;
  onDeleteTag: (tagId: string) => void;
  onRenameTag: (tagId: string, newName: string) => Promise<void>;
  ensureTheaterTags: () => Promise<void>;
  isTheaterMode: boolean;
  records: CalendarRecord[];
  onPreviewImage: (url: string) => void;
  showRainbowBorder: boolean;
  setShowRainbowBorder: (show: boolean) => void;
  isHabitMode: boolean;
  isFoodMode: boolean;
  isTravelMode: boolean;
}

const WEEKDAYS = [
  { label: '日', value: 0 },
  { label: '一', value: 1 },
  { label: '二', value: 2 },
  { label: '三', value: 3 },
  { label: '四', value: 4 },
  { label: '五', value: 5 },
  { label: '六', value: 6 },
];

export function RecordModal({
  isOpen,
  onClose,
  selectedDate,
  onAddRecord,
  onUpdateRecord,
  onDeleteRecord,
  editingRecord,
  tags,
  allAvailableTags,
  onAddTag,
  onDeleteTag,
  onRenameTag,
  ensureTheaterTags,
  records,
  onPreviewImage,
  showRainbowBorder,
  setShowRainbowBorder,
  isHabitMode,
  isFoodMode,
  isTravelMode,
  isTheaterMode
}: RecordModalProps) {
  // Map modes for dynamic lookup
  const modes = { isHabitMode, isTheaterMode, isFoodMode, isTravelMode };

  // Tag rename state
  const [renamingTagId, setRenamingTagId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [activeTab, setActiveTab] = useState<keyof typeof modulesConfig>('general');

  useEffect(() => {
    const config = modulesConfig[activeTab];
    if (activeTab === 'general') return;
    
    // Check if the current mode is still enabled
    const stateKey = (config as any).stateKey;
    const isModeEnabled = (modes as any)[stateKey];
    
    if (stateKey && !isModeEnabled) {
      setActiveTab('general');
    }
  }, [isHabitMode, isTheaterMode, isFoodMode, isTravelMode, activeTab]);

  // Default color fallback
  const defaultColors = presetColors && presetColors.length > 0 ? presetColors : [{ bg: '#3b82f6', text: '#ffffff' }];
  const defaultColor = defaultColors[0];

  // Daily Record State
  const [dailyContent, setDailyContent] = useState('');
  const [selectedColor, setSelectedColor] = useState<CalendarColor>(defaultColor);
  const [repeatDays, setRepeatDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [habitStartDate, setHabitStartDate] = useState('');
  const [habitEndDate, setHabitEndDate] = useState('');

  // Special Record State
  const [specialTitle, setSpecialTitle] = useState('');
  const [selYear, setSelYear] = useState(new Date().getFullYear());
  const [selMonth, setSelMonth] = useState(new Date().getMonth() + 1);
  const [selDay, setSelDay] = useState(new Date().getDate());
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [specialColor, setSpecialColor] = useState<CalendarColor>(defaultColor);
  const [dateError, setDateError] = useState('');

  // New Tag State
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  // Image Upload State
  // existingImageUrls = already-uploaded cloud URLs (when editing a record)
  // newImageFiles     = File objects the user just picked (not yet uploaded)
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Local preview URLs for new files (revoked on unmount)
  const newImagePreviews = newImageFiles.map(f => URL.createObjectURL(f));

  // Inline Editing State for Existing Habits
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editHabitName, setEditHabitName] = useState('');
  const [editHabitDays, setEditHabitDays] = useState<number[]>([]);
  const [editHabitColor, setEditHabitColor] = useState<CalendarColor>(defaultColor);
  
  // Track where mouse events start to prevent accidental modal closure during text selection
  const [mouseDownOverlay, setMouseDownOverlay] = useState(false);

  // Global Tags State (Phase 210)
  const [isAddingGlobalTag, setIsAddingGlobalTag] = useState(false);
  const [newGlobalTagName, setNewGlobalTagName] = useState('');

  // Theater Metadata State
  const [theaterProvince, setTheaterProvince] = useState('');
  const [theaterCity, setTheaterCity] = useState('');
  const [theaterClub, setTheaterClub] = useState('');
  const [theaterVenue, setTheaterVenue] = useState(''); // "剧场" or "剧院"
  const [theaterUnit, setTheaterUnit] = useState('');
  const [theaterType, setTheaterType] = useState('');
  const [theaterPrice, setTheaterPrice] = useState<string>('');
  const [theaterScore, setTheaterScore] = useState(0);
  const [theaterSeat, setTheaterSeat] = useState('');
  const [theaterActors, setTheaterActors] = useState('');
  // Theater POI State
  const [theaterPoiId, setTheaterPoiId] = useState('');
  const [theaterLat, setTheaterLat] = useState<number | undefined>();
  const [theaterLng, setTheaterLng] = useState<number | undefined>();
  const [theaterAddress, setTheaterAddress] = useState('');
  const [theaterSuggestions, setTheaterSuggestions] = useState<any[]>([]);
  const [showTheaterSuggestions, setShowTheaterSuggestions] = useState(false);
  const blockTheaterSuggestRef = useRef<boolean>(false);
  const theaterPoiInputRef = useRef<HTMLInputElement>(null);
  const theaterAcRef = useRef<any>(null);
  const [editHabitStartDate, setEditHabitStartDate] = useState('');
  const [editHabitEndDate, setEditHabitEndDate] = useState('');

  // Normal Mode Location State
  const [normalProvince, setNormalProvince] = useState('');
  const [normalCity, setNormalCity] = useState('全国');
  const [normalLocationName, setNormalLocationName] = useState('');
  const [normalLocationAddress, setNormalLocationAddress] = useState('');
  const [normalPoiId, setNormalPoiId] = useState('');
  const [normalLat, setNormalLat] = useState<number | undefined>();
  const [normalLng, setNormalLng] = useState<number | undefined>();
  const [normalSuggestions, setNormalSuggestions] = useState<any[]>([]);
  const [showNormalSuggestions, setShowNormalSuggestions] = useState(false);
  const blockNormalSuggestRef = useRef<boolean>(false);
  const normalPoiInputRef = useRef<HTMLInputElement>(null);
  const normalAcRef = useRef<any>(null);
  const normalCityRef = useRef<string>('全国');
  const [isNormalLocationLoading, setIsNormalLocationLoading] = useState(false);
  // Food Metadata State
  const [foodAddress, setFoodAddress] = useState('');
  const [foodRating, setFoodRating] = useState<number>(0);
  const [foodPrice, setFoodPrice] = useState<string>('');
  const [foodLat, setFoodLat] = useState<number | undefined>();
  const [foodLng, setFoodLng] = useState<number | undefined>();
  const [foodDishes, setFoodDishes] = useState<{ name: string; rating: number }[]>([{ name: '', rating: 0 }]);
  
  // AMap Ref-based binding
  const poiInputRef = useRef<HTMLInputElement>(null);
  const acRef = useRef<any>(null);
  const psRef = useRef<any>(null);

  // Geographic Precision States
  const [foodProvince, setFoodProvince] = useState<string>('');
  const [foodCity, setFoodCity] = useState<string>('全国');
  const [provinceList, setProvinceList] = useState<any[]>([]);
  const [cityList, setCityList] = useState<any[]>([]);
  const [isLocationLoading, setIsLocationLoading] = useState(false);

  // AMap Custom UI States
  const [foodSuggestions, setFoodSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blockSuggestRef = useRef<boolean>(false);
  const foodCityRef = useRef<string>(foodCity); // Always-fresh ref for AMap closures

  // Global Reflection State
  const [reflection, setReflection] = useState('');

  // Travel Mode State
  const [travelDestinations, setTravelDestinations] = useState<string[]>([]);
  const [travelDestProvince, setTravelDestProvince] = useState('');
  const [travelDestType, setTravelDestType] = useState<'domestic' | 'overseas'>('domestic');
  type ExpenseCategoryKey = 'transport' | 'accommodation' | 'tickets' | 'food' | 'souvenirs' | 'other';
  const EXPENSE_CATEGORIES: { key: ExpenseCategoryKey; label: string; emoji: string }[] = [
    { key: 'transport',      label: '交通',     emoji: '🚆' },
    { key: 'accommodation',  label: '住宿',     emoji: '🏨' },
    { key: 'tickets',        label: '门票',     emoji: '🎫' },
    { key: 'food',           label: '饮食',     emoji: '🍜' },
    { key: 'souvenirs',      label: '纪念品特产', emoji: '🧧' },
    { key: 'other',          label: '其他',     emoji: '📦' },
  ];
  type ExpenseItemDraft = { name: string; amount: string };
  type ExpensesDraft = Record<ExpenseCategoryKey, ExpenseItemDraft[]>;
  const defaultExpenses = (): ExpensesDraft => ({
    transport: [{ name: '', amount: '' }],
    accommodation: [{ name: '', amount: '' }],
    tickets: [{ name: '', amount: '' }],
    food: [{ name: '', amount: '' }],
    souvenirs: [{ name: '', amount: '' }],
    other: [{ name: '', amount: '' }],
  });
  const [travelExpenses, setTravelExpenses] = useState<ExpensesDraft>(defaultExpenses());
  const [travelExpenseExpanded, setTravelExpenseExpanded] = useState(false);
  const [travelSimpleTotal, setTravelSimpleTotal] = useState('');
  const [travelEndDate, setTravelEndDate] = useState('');
  const [travelAttractions, setTravelAttractions] = useState<TravelAttraction[]>([]);
  const [travelLinkedRecordIds, setTravelLinkedRecordIds] = useState<string[]>([]);
  const [travelAttractionInput, setTravelAttractionInput] = useState('');
  const [travelAttractionSuggestions, setTravelAttractionSuggestions] = useState<any[]>([]);
  const [showTravelAttractionSuggestions, setShowTravelAttractionSuggestions] = useState(false);
  const [travelAttractionCity, setTravelAttractionCity] = useState('');
  const [travelAttractionProvince, setTravelAttractionProvince] = useState('');
  const travelAttractionAcRef = useRef<any>(null);
  const blockTravelSuggestRef = useRef<boolean>(false);

  // Transport & Hotel states
  const [travelTransportExpanded, setTravelTransportExpanded] = useState(false);
  const [travelRailways, setTravelRailways] = useState<{trainNo: string; seat: string}[]>([{trainNo: '', seat: ''}]);
  const [travelFlights, setTravelFlights] = useState<{airline: string; flightNo: string; departAirport: string; arriveAirport: string}[]>([{airline: '', flightNo: '', departAirport: '', arriveAirport: ''}]);
  const [travelHotels, setTravelHotels] = useState<{name: string; lat?: number; lng?: number; address?: string; poiId?: string}[]>([]);
  const [travelHotelInput, setTravelHotelInput] = useState('');
  const [travelHotelSuggestions, setTravelHotelSuggestions] = useState<any[]>([]);
  const [showTravelHotelSuggestions, setShowTravelHotelSuggestions] = useState(false);
  const [travelHotelCity, setTravelHotelCity] = useState('');
  const [travelHotelProvince, setTravelHotelProvince] = useState('');
  const travelHotelAcRef = useRef<any>(null);
  const blockTravelHotelSuggestRef = useRef<boolean>(false);
  // Airport autocomplete state
  const [airportSuggestions, setAirportSuggestions] = useState<{idx: number; field: 'departAirport'|'arriveAirport'; pois: any[]}|null>(null);
  const travelAirportAcRef = useRef<any>(null);

  // Defensive arrays
  const safeTags = tags || [];
  const safeRecords = records || [];

  // Reset states when modal opens
  useEffect(() => {
    if (isOpen) {
      if (editingRecord) {
        const rec = editingRecord.record;
        if (rec.type === 'daily') {
          setActiveTab('habit');
          setDailyContent(rec.content || '');
          setSelectedColor(rec.color || defaultColor);
          setRepeatDays(rec.repeatDays || [0, 1, 2, 3, 4, 5, 6]);
          setHabitStartDate(rec.startDate || '');
          setHabitEndDate(rec.endDate || '');
          setReflection(rec.reflection || '');
        } else {
          const spec = rec as EventRecord;
          const tagNames = spec.tagIds.map(id => tags.find(t => t.id === id)?.name).filter(Boolean);
          // Also include parent_tag for reliable tab matching (parent_tag may not be in tagIds)
          if (spec.parent_tag && !tagNames.includes(spec.parent_tag)) {
            tagNames.push(spec.parent_tag);
          }
          
          // Match tab by parent tag name in config
          const matchedTab = (Object.entries(modulesConfig) as [keyof typeof modulesConfig, any][])
            .find(([_, conf]) => conf.parentTagName && tagNames.includes(conf.parentTagName));
          
          if (matchedTab) {
            setActiveTab(matchedTab[0]);
          } else {
            setActiveTab('general');
          }
          setSpecialTitle(spec.title || '');
          const dateParts = spec.dateStr?.split('-').map(Number) || [];
          if (dateParts.length === 3) {
            setSelYear(dateParts[0]);
            setSelMonth(dateParts[1]);
            setSelDay(dateParts[2]);
          }
          setSelectedTagIds(spec.tagIds || []);
          setSpecialColor(spec.color || defaultColor);
          setExistingImageUrls(spec.imageUrls || []);
          setNewImageFiles([]);
          setReflection(spec.reflection || '');

          // Travel field population
          if (spec.parent_tag === '旅行模式') {
            const tExtra = spec.extra_data as TravelMetadata | undefined;
            setTravelEndDate(tExtra?.endDate || '');
            setTravelDestinations(tExtra?.destinations || []);
            // Load structured expenses or fall back to empty draft
            const loadedExpenses = defaultExpenses();
            if (tExtra?.expenses) {
              (Object.keys(tExtra.expenses) as ExpenseCategoryKey[]).forEach(key => {
                const items = (tExtra.expenses as any)[key];
                if (items && items.length > 0) {
                  loadedExpenses[key] = items.map((item: any) => ({ name: item.name || '', amount: item.amount != null ? String(item.amount) : '' }));
                }
              });
            }
            setTravelExpenses(loadedExpenses);
            setTravelExpenseExpanded(!!(tExtra?.expenses && Object.keys(tExtra.expenses).length > 0));
            setTravelSimpleTotal(tExtra?.totalSpend ? String(tExtra.totalSpend) : '');
            setTravelAttractions(tExtra?.attractions || []);
            setTravelLinkedRecordIds(tExtra?.linkedRecordIds || []);
            // Load Transport & Hotel
            setTravelRailways(tExtra?.railways?.length ? tExtra.railways.map(r => ({ trainNo: r.trainNo || '', seat: r.seat || '' })) : [{trainNo: '', seat: ''}]);
            setTravelFlights(tExtra?.flights?.length ? tExtra.flights.map(f => ({ airline: f.airline || '', flightNo: f.flightNo || '', departAirport: f.departAirport || '', arriveAirport: f.arriveAirport || '' })) : [{airline: '', flightNo: '', departAirport: '', arriveAirport: ''}]);
            setTravelHotels(tExtra?.hotels || []);
            setTravelTransportExpanded(!!(tExtra?.railways?.length || tExtra?.flights?.length || tExtra?.hotels?.length));
          } else {
            setTravelEndDate('');
            setTravelDestinations([]);
            setTravelExpenses(defaultExpenses());
            setTravelExpenseExpanded(false);
            setTravelSimpleTotal('');
            setTravelAttractions([]);
            setTravelLinkedRecordIds([]);
          }
        }
      } else {
        setDailyContent('');
        setSelectedColor(defaultColor);
        setRepeatDays([0, 1, 2, 3, 4, 5, 6]);
        setHabitStartDate('');
        setHabitEndDate('');
        setReflection('');

        setSpecialTitle('');
        setDateError('');

        if (selectedDate) {
          setSelYear(selectedDate.getFullYear());
          setSelMonth(selectedDate.getMonth() + 1);
          setSelDay(selectedDate.getDate());
        }

        setSelectedTagIds([]);
        const initialSpecialColor = (defaultColors.length > 10) ? defaultColors[10] : defaultColor;
        setSpecialColor(initialSpecialColor);
        setExistingImageUrls([]);
        setNewImageFiles([]);
        
        // Reset Theater States
        setTheaterProvince('');
        setTheaterCity('');
        setTheaterClub('');
        setTheaterVenue('');
        setTheaterUnit('');
        setTheaterType('');
        setTheaterPrice('');
        setTheaterScore(0);
        setTheaterSeat('');
        setTheaterActors('');
        setTheaterPoiId('');
        setTheaterLat(undefined);
        setTheaterLng(undefined);
        setTheaterAddress('');

        // Reset Normal Location States
        setNormalProvince('');
        setNormalCity('全国');
        setNormalLocationName('');
        setNormalLocationAddress('');
        setNormalPoiId('');
        setNormalLat(undefined);
        setNormalLng(undefined);

        // Reset Food States
        setFoodAddress('');
        setFoodPrice('');
        setFoodRating(0);
        setFoodDishes([{ name: '', rating: 0 }]);
        setFoodProvince('');
        setFoodCity('全国');
        setFoodLat(undefined);
        setFoodLng(undefined);

        // Reset Travel States
        setTravelEndDate('');
        setTravelDestinations([]);
        setTravelDestProvince('');
        setTravelDestType('domestic');
        setTravelExpenses(defaultExpenses());
        setTravelExpenseExpanded(false);
        setTravelSimpleTotal('');
        setTravelAttractions([]);
        setTravelLinkedRecordIds([]);
        setTravelAttractionInput('');
        setTravelAttractionCity('');
        // Reset Transport & Hotel
        setTravelTransportExpanded(false);
        setTravelRailways([{trainNo: '', seat: ''}]);
        setTravelFlights([{airline: '', flightNo: '', departAirport: '', arriveAirport: ''}]);
        setTravelHotels([]);
        setTravelHotelInput('');
        setTravelHotelCity('');
        setTravelHotelProvince('');
        setTravelAttractionProvince('');

        setActiveTab('general');
      }

      const rec = editingRecord?.record;
      if (rec && rec.type === 'special' && rec.extra_data) {
        const extra = rec.extra_data as TheaterMetadata;
        // Basic match for province if city is set
        if (extra.city) {
          if (Array.isArray(extra.city)) {
            setTheaterProvince(extra.city[0] || '');
            setTheaterCity(extra.city[1] || '');
          } else {
            const prov = provinceData.find(p => p.cities.includes(extra.city as string));
            if (prov) setTheaterProvince(prov.name);
            setTheaterCity(extra.city || '');
          }
        }
        setTheaterClub(extra.club || '');
        setTheaterVenue(extra.theater || '');
        setTheaterUnit(extra.unit || '');
        setTheaterType(extra.type || '');
        setTheaterPrice(extra.price !== undefined ? String(extra.price) : '');
        setTheaterScore(extra.score || 0);
        setTheaterSeat(extra.seat || '');
        setTheaterActors(extra.actors || '');

        // Load Food Metadata if applicable
        const foodExtra = rec.extra_data as FoodMetadata;
        if (activeTab === 'food' || foodExtra.restaurant) {
          setFoodAddress(foodExtra.address || '');
          setFoodPrice(foodExtra.price !== undefined ? String(foodExtra.price) : '');
          setFoodRating(foodExtra.rating || 0);
          setFoodLat(foodExtra.lat);
          setFoodLng(foodExtra.lng);
          setFoodDishes(foodExtra.dishes?.length ? foodExtra.dishes.map(d => ({ name: d.name, rating: d.rating || 0 })) : [{ name: '', rating: 0 }]);
          // Load food city from saved data
          if (foodExtra.city) {
            if (Array.isArray(foodExtra.city)) {
              setFoodProvince(foodExtra.city[0] || '');
              setFoodCity(foodExtra.city[1] || '');
            } else {
              setFoodCity(foodExtra.city);
            }
          } else {
            setFoodProvince('');
            setFoodCity('全国');
          }
          // Load food comment into reflection
          if (foodExtra.comment) setReflection(foodExtra.comment);
        }

        // Backfill theater POI data
        if (extra.poiId) setTheaterPoiId(extra.poiId);
        if (extra.lat) setTheaterLat(extra.lat);
        if (extra.lng) setTheaterLng(extra.lng);
        if (extra.address) setTheaterAddress(extra.address);

        // Backfill normal mode location data
        const locData = (rec.extra_data as any)?.location;
        if (locData) {
          setNormalLocationName(locData.name || '');
          setNormalLocationAddress(locData.address || '');
          setNormalPoiId(locData.poiId || '');
          setNormalLat(locData.lat);
          setNormalLng(locData.lng);
          if (Array.isArray(locData.city)) {
            setNormalProvince(locData.city[0] || '');
            setNormalCity(locData.city[1] || '');
          } else if (locData.city) {
            setNormalCity(locData.city);
          }
        }
      }

      setIsAddingTag(false);
      setNewTagName('');

      // Double Insurance: Check theater tags when modal opens if in theater mode
      if (isTheaterMode && isOpen) {
        ensureTheaterTags();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingRecord]); // Also re-run when editingRecord changes

  // Keep foodCityRef synced
  useEffect(() => { foodCityRef.current = foodCity; }, [foodCity]);
  // Keep normalCityRef synced
  useEffect(() => { normalCityRef.current = normalCity; }, [normalCity]);

  // ── AMap Integration Logic ──────────────────────────────────────
  const initAutoComplete = useCallback(() => {
    // 节点 B: AMap 对象检测
    if (typeof window === 'undefined' || !(window as any).AMap) {
      console.warn('[AMap Debug] 节点 B 失败: window.AMap 对象不存在');
      return;
    }
    const AMap = (window as any).AMap;
    console.log('[AMap Debug] 节点 B 成功: AMap 对象就绪');

    // 节点 C: 多插件加载 (扩展支持精准地理功能)
    AMap.plugin(['AMap.AutoComplete', 'AMap.PlaceSearch', 'AMap.DistrictSearch', 'AMap.CitySearch'], () => {
      console.log('[AMap Debug] 节点 C 成功: 地理与搜索全量插件加载完成');
      
      // 1. Manual IP Positioning (Disabled auto-trigger on load as per request)
      // Maintaining current states, no reset here

      // 2. Load Province List
      const district = new AMap.DistrictSearch({ level: 'country', subdistrict: 1 });
      district.search('中国', (status: string, result: any) => {
        if (status === 'complete') {
          setProvinceList(result.districtList[0].districtList);
        }
      });

      const tryBind = () => {
        console.log('[AMap Debug] 执行 300ms 强制延时绑定...');
        setTimeout(() => {
          if (!poiInputRef.current) {
            console.warn('[AMap Debug] 检测到 Ref 绑定失败: poiInputRef.current 尚未挂载，重试中...');
            setTimeout(tryBind, 200);
            return;
          }

          try {
            console.log('[AMap Debug] 节点 D 启动: 正在通过 Ref 绑定插件');
            const auto = new AMap.AutoComplete({
              city: foodCityRef.current === '全国' ? '' : foodCityRef.current,
              citylimit: foodCityRef.current !== '全国' && !!foodCityRef.current
            });

            acRef.current = auto;
            (window as any).test_ac = auto;

            // Initialize PlaceSearch for detailed queries (Tags)
            const ps = new AMap.PlaceSearch({
              city: foodCityRef.current === '全国' ? '' : foodCityRef.current,
              extensions: 'all' // important for getting 'type'
            });
            psRef.current = ps;

            // Manual Selection Handler (to be used by Custom UI)
            (window as any).handlePoiSelect = async (poi: any) => {
              console.log('[Search Debug] 自定义 UI 选中 (ID):', poi.id);
              if (!poi || !poi.id) return;

              // 1. PHYSICAL FEEDBACK: Instant Response
              setShowSuggestions(false); // Close list instantly
              blockSuggestRef.current = true;
              
              // 仅填入名称和初版地址，不再拉取标签 (User Request: Logic Reduction)
              setSpecialTitle(poi.name || '');
              const initialAddress = poi.address || `${poi.district || ''}${poi.name || ''}`;
              setFoodAddress(initialAddress);
              // Auto-detect province/city from POI data when user hasn't manually selected a city
              if (foodCityRef.current === '全国') {
                const pname = poi.pname || '';
                const cname = poi.cityname || '';
                const district = poi.district || '';
                console.log('[POI City Debug] pname:', pname, 'cityname:', cname, 'district:', district);
                if (pname && cname) {
                  // PlaceSearch results have pname/cityname
                  setFoodProvince(pname);
                  setFoodCity(cname || pname);
                } else if (district) {
                  // Autocomplete tips only have district, e.g. "广东省深圳市南山区" or "北京市朝阳区"
                  const m = district.match(/^(.+?(?:省|自治区))?\s*(.+?(?:市|自治州|地区|盟))/);
                  if (m) {
                    setFoodProvince(m[1] || m[2]); // 直辖市没有省
                    setFoodCity(m[2]);
                  }
                }
              }
              // Capture coordinates if available (AMap.LngLat may use methods or properties)
              // poi.location can be: AMap.LngLat object, string "lng,lat", or empty string ""
              if (poi.location && poi.location !== '' && typeof poi.location !== 'string') {
                const lat = typeof poi.location.getLat === 'function' ? poi.location.getLat() : poi.location.lat;
                const lng = typeof poi.location.getLng === 'function' ? poi.location.getLng() : poi.location.lng;
                console.log('[POI Debug] Captured coords:', lat, lng, 'from', poi.location);
                if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
                  setFoodLat(lat);
                  setFoodLng(lng);
                } else {
                  console.warn('[POI Debug] Invalid coords, clearing');
                  setFoodLat(undefined);
                  setFoodLng(undefined);
                }
              } else if (typeof poi.location === 'string' && poi.location.includes(',')) {
                // Handle string format "lng,lat"
                const parts = poi.location.split(',').map(Number);
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                  console.log('[POI Debug] Parsed string coords:', parts[1], parts[0]);
                  setFoodLat(parts[1]);
                  setFoodLng(parts[0]);
                } else {
                  setFoodLat(undefined);
                  setFoodLng(undefined);
                }
              } else {
                console.log('[POI Debug] No valid location on POI, clearing coords');
                setFoodLat(undefined);
                setFoodLng(undefined);
              }

              // 2. Double Sync: Clear focus
              if (poiInputRef.current) poiInputRef.current.blur();
              
              // 3. Unblock after a short cooldown
              setTimeout(() => {
                blockSuggestRef.current = false;
              }, 800);
            };

            // map loaded status set removed as it's no longer used in UI
          } catch (err) {
            console.error('[AMap Debug] 节点 D 异常: 插件实例化或绑定失败', err);
          }
        }, 300);
      };

      tryBind();
    });
  }, [onAddTag]); // Removed foodCity from dependency to prevent re-init loops

  // 手动触发 IP 定位 (Manual Position Trigger)
  const handleManualLocation = useCallback(() => {
    if (typeof window === 'undefined' || !(window as any).AMap || isLocationLoading) return;
    
    const AMap = (window as any).AMap;
    const citySearch = new AMap.CitySearch();
    
    setIsLocationLoading(true);
    citySearch.getLocalCity((status: string, result: any) => {
      if (status === 'complete' && result.info === 'OK') {
        console.log('[AMap Debug] 手动定位成功:', result.province, result.city);
        setFoodProvince(result.province);
        setFoodCity(result.city);
      } else {
        console.error('[AMap Debug] 手动定位失败');
      }
      setIsLocationLoading(false);
    });
  }, [isLocationLoading]);

  // Effect to load cities when province changes
  useEffect(() => {
    if (foodProvince && (window as any).AMap) {
      const AMap = (window as any).AMap;
      const district = new AMap.DistrictSearch({ level: 'province', subdistrict: 1 });
      district.search(foodProvince, (status: string, result: any) => {
        if (status === 'complete' && result.districtList[0].districtList) {
          setCityList(result.districtList[0].districtList);
          // If the current city isn't in the new province, reset it
          const currentCityInList = result.districtList[0].districtList.find((c: any) => c.name === foodCity);
          if (!currentCityInList && foodCity !== '全国') {
            setFoodCity(result.districtList[0].districtList[0].name);
          }
        } else {
          setCityList([]);
        }
      });
    }
  }, [foodProvince]);

  // Ensure city change is synced with AMap instances
  useEffect(() => {
    if (acRef.current) {
      const cityParam = foodCity === '全国' ? '' : foodCity;
      acRef.current.setCity(cityParam);
      acRef.current.setCityLimit(foodCity !== '全国' && !!foodCity);
    }
    if (psRef.current) {
      psRef.current.setCity(foodCity === '全国' ? '' : foodCity);
    }
  }, [foodCity]);

  // Suggestions UI auto-close handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (poiInputRef.current && !poiInputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // No longer using isSuggesting state lock, using Ref-based valve inside event handlers

  const loadAMapScript = useCallback(() => {
    const scriptId = 'amap-js-sdk';
    if (document.getElementById(scriptId)) {
      if ((window as any).AMap) {
        initAutoComplete();
      } else {
        const checkReady = setInterval(() => {
          if ((window as any).AMap) {
            clearInterval(checkReady);
            initAutoComplete();
          }
        }, 100);
        setTimeout(() => clearInterval(checkReady), 5000);
      }
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://webapi.amap.com/maps?v=2.0&key=cd4b3bc21146d9163337e1e174b8cc8a`;
    script.async = true;
    script.onload = initAutoComplete;
    script.onerror = () => {
      console.warn('[AMap] SDK load failed, falling back to manual input.');
    };
    document.head.appendChild(script);
  }, [initAutoComplete]);

  // Dedicated Effect for Food Mode AMap Initialization
  useEffect(() => {
    if (isOpen && activeTab === 'food') {
      console.log('[AMap Debug] 节点 A: 已进入美食 Tab 模式，启动初始化链路');
      try {
        loadAMapScript();
      } catch (err) {
        console.error('[AMap Debug] 节点 A 异常: 启动脚本加载失败', err);
      }
    }
  }, [isOpen, activeTab, loadAMapScript]);

  // ── Standalone AMap SDK loader (no food-specific init) ──────────
  const ensureAMapLoaded = useCallback((): Promise<any> => {
    return new Promise((resolve) => {
      if ((window as any).AMap) { resolve((window as any).AMap); return; }
      const scriptId = 'amap-js-sdk';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://webapi.amap.com/maps?v=2.0&key=cd4b3bc21146d9163337e1e174b8cc8a`;
        script.async = true;
        document.head.appendChild(script);
      }
      const check = setInterval(() => {
        if ((window as any).AMap) { clearInterval(check); resolve((window as any).AMap); }
      }, 100);
      setTimeout(() => clearInterval(check), 8000);
    });
  }, []);

  // ── AMap Init for Normal Mode ──────────────────────────────────
  const initNormalAutoComplete = useCallback(() => {
    ensureAMapLoaded().then((AMap: any) => {
      if (!AMap) return;
      AMap.plugin(['AMap.AutoComplete', 'AMap.CitySearch'], () => {
        const tryBind = () => {
          if (!normalPoiInputRef.current) { setTimeout(tryBind, 300); return; }
          try {
            const auto = new AMap.AutoComplete({
              city: normalCityRef.current === '全国' ? '' : normalCityRef.current,
              citylimit: normalCityRef.current !== '全国' && !!normalCityRef.current
            });
            normalAcRef.current = auto;
            console.log('[AMap Normal] AutoComplete init success');
          } catch (err) { console.error('[AMap Normal] init failed', err); }
        };
        setTimeout(tryBind, 300);
      });
    });
  }, [ensureAMapLoaded]);

  // Normal mode: search handler
  const handleNormalPoiSearch = useCallback((keyword: string) => {
    setNormalLocationName(keyword);
    // Clear stale data when user types manually
    setNormalLocationAddress('');
    setNormalPoiId('');
    setNormalLat(undefined);
    setNormalLng(undefined);
    if (!keyword || blockNormalSuggestRef.current || !normalAcRef.current) {
      setNormalSuggestions([]);
      setShowNormalSuggestions(false);
      return;
    }
    normalAcRef.current.search(keyword, (status: string, result: any) => {
      if (status === 'complete' && result.tips) {
        const filtered = result.tips.filter((t: any) => t.id);
        setNormalSuggestions(filtered);
        setShowNormalSuggestions(filtered.length > 0);
      } else {
        setNormalSuggestions([]);
        setShowNormalSuggestions(false);
      }
    });
  }, []);

  // Normal mode: POI selection handler
  const handleNormalPoiSelect = useCallback((poi: any) => {
    console.log('[AMap Normal] POI selected:', poi.name, poi.address);
    blockNormalSuggestRef.current = true;
    setShowNormalSuggestions(false);
    setNormalSuggestions([]);
    setNormalLocationName(poi.name || '');
    setNormalLocationAddress(poi.address ? `${poi.district || ''}${poi.address}` : `${poi.district || ''}${poi.name || ''}`);
    setNormalPoiId(poi.id || '');
    // Extract coords
    if (poi.location && poi.location !== '' && typeof poi.location !== 'string') {
      const lat = typeof poi.location.getLat === 'function' ? poi.location.getLat() : poi.location.lat;
      const lng = typeof poi.location.getLng === 'function' ? poi.location.getLng() : poi.location.lng;
      if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        setNormalLat(lat); setNormalLng(lng);
      } else { setNormalLat(undefined); setNormalLng(undefined); }
    } else if (typeof poi.location === 'string' && poi.location.includes(',')) {
      const parts = poi.location.split(',').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        setNormalLat(parts[1]); setNormalLng(parts[0]);
      } else { setNormalLat(undefined); setNormalLng(undefined); }
    } else { setNormalLat(undefined); setNormalLng(undefined); }
    setTimeout(() => { blockNormalSuggestRef.current = false; }, 800);
  }, []);

  // Normal mode: manual IP location
  const handleNormalManualLocation = useCallback(() => {
    if (isNormalLocationLoading) return;
    setIsNormalLocationLoading(true);
    ensureAMapLoaded().then((AMap: any) => {
      if (!AMap) { setIsNormalLocationLoading(false); return; }
      AMap.plugin(['AMap.CitySearch'], () => {
        const citySearch = new AMap.CitySearch();
        citySearch.getLocalCity((status: string, result: any) => {
          console.log('[AMap Normal] CitySearch result:', status, result);
          if (status === 'complete' && result.info === 'OK') {
            // Match province name to provinceData format (strip 省/市/自治区 suffix)
            const rawProv = result.province || '';
            const shortProv = rawProv.replace(/(省|市|自治区|壮族自治区|回族自治区|维吾尔自治区|特别行政区)$/, '');
            const matched = provinceData.find(p => p.name === shortProv || p.name === rawProv);
            if (matched) {
              setNormalProvince(matched.name);
            } else {
              setNormalProvince(rawProv);
            }
            setNormalCity(result.city || '');
          }
          setIsNormalLocationLoading(false);
        });
      });
    });
  }, [isNormalLocationLoading, ensureAMapLoaded]);

  // Normal mode: city change -> update AMap instance
  useEffect(() => {
    if (normalAcRef.current) {
      const cityParam = normalCity === '全国' ? '' : normalCity;
      normalAcRef.current.setCity(cityParam);
      normalAcRef.current.setCityLimit(normalCity !== '全国' && !!normalCity);
    }
  }, [normalCity]);

  // Normal mode: click-outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const container = document.querySelector('[data-normal-poi-container]');
      if (container && !container.contains(target)) {
        setShowNormalSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── AMap Init for Theater Mode ──────────────────────────────────
  const initTheaterAutoComplete = useCallback(() => {
    ensureAMapLoaded().then((AMap: any) => {
      if (!AMap) return;
      AMap.plugin(['AMap.AutoComplete', 'AMap.CitySearch'], () => {
        const tryBind = () => {
          if (!theaterPoiInputRef.current) { setTimeout(tryBind, 300); return; }
          try {
            const auto = new AMap.AutoComplete({
              city: theaterCity || '',
              citylimit: !!theaterCity
            });
            theaterAcRef.current = auto;
            console.log('[AMap Theater] AutoComplete init success');
          } catch (err) { console.error('[AMap Theater] init failed', err); }
        };
        setTimeout(tryBind, 300);
      });
    });
  }, [theaterCity, ensureAMapLoaded]);

  // Theater mode: search handler
  const handleTheaterPoiSearch = useCallback((keyword: string) => {
    setTheaterVenue(keyword);
    // Clear stale POI data when user manually types
    setTheaterAddress('');
    setTheaterPoiId('');
    setTheaterLat(undefined);
    setTheaterLng(undefined);
    if (!keyword || blockTheaterSuggestRef.current || !theaterAcRef.current) {
      setTheaterSuggestions([]);
      setShowTheaterSuggestions(false);
      return;
    }
    theaterAcRef.current.search(keyword, (status: string, result: any) => {
      if (status === 'complete' && result.tips) {
        const filtered = result.tips.filter((t: any) => t.id);
        setTheaterSuggestions(filtered);
        setShowTheaterSuggestions(filtered.length > 0);
      } else {
        setTheaterSuggestions([]);
        setShowTheaterSuggestions(false);
      }
    });
  }, []);

  // Theater mode: POI selection handler
  const handleTheaterPoiSelect = useCallback((poi: any) => {
    console.log('[AMap Theater] POI selected:', poi.name, poi.address);
    blockTheaterSuggestRef.current = true;
    setShowTheaterSuggestions(false);
    setTheaterSuggestions([]);
    setTheaterVenue(poi.name || '');
    setTheaterAddress(poi.address ? `${poi.district || ''}${poi.address}` : `${poi.district || ''}${poi.name || ''}`);
    setTheaterPoiId(poi.id || '');
    if (poi.location && poi.location !== '' && typeof poi.location !== 'string') {
      const lat = typeof poi.location.getLat === 'function' ? poi.location.getLat() : poi.location.lat;
      const lng = typeof poi.location.getLng === 'function' ? poi.location.getLng() : poi.location.lng;
      if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        setTheaterLat(lat); setTheaterLng(lng);
      } else { setTheaterLat(undefined); setTheaterLng(undefined); }
    } else if (typeof poi.location === 'string' && poi.location.includes(',')) {
      const parts = poi.location.split(',').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        setTheaterLat(parts[1]); setTheaterLng(parts[0]);
      } else { setTheaterLat(undefined); setTheaterLng(undefined); }
    } else { setTheaterLat(undefined); setTheaterLng(undefined); }
    setTimeout(() => { blockTheaterSuggestRef.current = false; }, 800);
  }, []);

  // Theater mode: click-outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const container = document.querySelector('[data-theater-poi-container]');
      if (container && !container.contains(target)) {
        setShowTheaterSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Theater mode: manual IP location
  const handleTheaterManualLocation = useCallback(() => {
    if (isLocationLoading) return;
    setIsLocationLoading(true);
    ensureAMapLoaded().then((AMap: any) => {
      if (!AMap) { setIsLocationLoading(false); return; }
      AMap.plugin(['AMap.CitySearch'], () => {
        const citySearch = new AMap.CitySearch();
        citySearch.getLocalCity((status: string, result: any) => {
          console.log('[AMap Theater] CitySearch result:', status, result);
          if (status === 'complete' && result.info === 'OK') {
            const rawProv = result.province || '';
            const shortProv = rawProv.replace(/(省|市|自治区|壮族自治区|回族自治区|维吾尔自治区|特别行政区)$/, '');
            const matched = provinceData.find(p => p.name === shortProv || p.name === rawProv);
            if (matched) {
              setTheaterProvince(matched.name);
            } else {
              setTheaterProvince(rawProv);
            }
            setTheaterCity(result.city || '');
          }
          setIsLocationLoading(false);
        });
      });
    });
  }, [isLocationLoading, ensureAMapLoaded]);

  // AMap Init for Normal / Theater tabs
  useEffect(() => {
    if (isOpen && activeTab === 'general') {
      initNormalAutoComplete();
    }
    if (isOpen && activeTab === 'theatre') {
      initTheaterAutoComplete();
    }
  }, [isOpen, activeTab, initNormalAutoComplete, initTheaterAutoComplete]);




  const isValidDate = (year: number, month: number, day: number) => {
    const d = new Date(year, month - 1, day);
    return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

  const currentYears = Array.from({ length: 151 }, (_, i) => 2000 + i);
  const currentMonths = Array.from({ length: 12 }, (_, i) => i + 1);
  const currentDays = Array.from({ length: getDaysInMonth(selYear, selMonth) }, (_, i) => i + 1);

  // Auto-clamp day when year/month changes
  useEffect(() => {
    const maxDay = getDaysInMonth(selYear, selMonth);
    if (selDay > maxDay) setSelDay(maxDay);
  }, [selYear, selMonth]);

  const getTagName = (id: string) => safeTags.find(t => t.id === id)?.name || '';

  // Validate a YYYY-MM-DD string as a real date
  const isValidDateStr = (str: string): boolean => {
    if (!str) return true; // empty is OK (optional)
    const parts = str.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return false;
    return isValidDate(parts[0], parts[1], parts[2]);
  };

  const handleSaveDaily = useCallback(() => {
    if (!dailyContent.trim()) return;
    // Validate habit dates if provided
    if (habitStartDate && habitStartDate !== '--' && !isValidDateStr(habitStartDate)) {
      setDateError('习惯开始日期无效，请检查'); return;
    }
    if (habitEndDate && habitEndDate !== '--' && !isValidDateStr(habitEndDate)) {
      setDateError('习惯结束日期无效，请检查'); return;
    }
    if (habitStartDate && habitEndDate && habitStartDate !== '--' && habitEndDate !== '--'
        && isValidDateStr(habitStartDate) && isValidDateStr(habitEndDate)
        && habitStartDate > habitEndDate) {
      setDateError('习惯结束日期不能早于开始日期'); return;
    }
    setDateError('');
    onAddRecord({
      id: `daily_${Date.now()}`,
      type: 'daily',
      createdAt: Date.now(),
      content: dailyContent.trim(),
      color: selectedColor,
      completedDates: [],
      checkinTimestamps: [],
      repeatDays: repeatDays,
      startDate: habitStartDate || undefined,
      endDate: habitEndDate || undefined,
      reflection: reflection.trim() || undefined,
      extra_data: { thought: reflection.trim() || undefined },
    });
    setDailyContent('');
    setHabitStartDate('');
    setHabitEndDate('');
    onClose();
  }, [dailyContent, selectedColor, repeatDays, habitStartDate, habitEndDate, reflection, onAddRecord, onClose]);

  const handleSaveSpecial = useCallback(async () => {
    if (!specialTitle.trim()) return;
    if (!isValidDate(selYear, selMonth, selDay)) {
      setDateError('请输入正确的日期');
      return;
    }
    // Travel mode: validate end date and date range
    if (activeTab === 'travel' && travelEndDate) {
      const endParts = travelEndDate.split('-').map(Number);
      if (endParts.length === 3 && !isValidDate(endParts[0], endParts[1], endParts[2])) {
        setDateError('结束日期无效，请检查');
        return;
      }
      const startStr = `${selYear}-${String(selMonth).padStart(2, '0')}-${String(selDay).padStart(2, '0')}`;
      if (travelEndDate < startStr) {
        setDateError('结束日期不能早于出发日期');
        return;
      }
    }
    setDateError('');
    setIsUploading(true);

    try {
      const activeConfig = modulesConfig[activeTab] as any;
      const parentTagName = activeConfig.parentTagName || '普通模式';
      const parentTag = tags.find(t => t.name === parentTagName && t.tag_type === 'function');
      
      let finalTagIds = [...selectedTagIds];
      if (parentTag && !finalTagIds.includes(parentTag.id)) {
        const allParentNames = Object.values(modulesConfig)
          .map((c: any) => c.parentTagName)
          .filter(Boolean);
        
        const otherParentIds = tags
          .filter(t => t.name !== parentTagName && allParentNames.includes(t.name) && t.tag_type === 'function')
          .map(t => t.id);
        
        finalTagIds = finalTagIds.filter(id => !otherParentIds.includes(id));
        finalTagIds.push(parentTag.id);
      }

      const uploadedUrls = newImageFiles.length > 0
        ? await uploadImages(newImageFiles)
        : [];

      const allImageUrls = [...existingImageUrls, ...uploadedUrls];
      const dateStr = `${selYear}-${String(selMonth).padStart(2, '0')}-${String(selDay).padStart(2, '0')}`;
        
        let extra_data: any = {
          thought: reflection.trim() || undefined
        };

        // Normal mode: add location data
        if (activeTab === 'general' && normalLocationName) {
          extra_data.location = {
            name: normalLocationName || undefined,
            address: normalLocationAddress || undefined,
            poiId: normalPoiId || undefined,
            lat: normalLat,
            lng: normalLng,
            city: (normalProvince && normalCity && normalCity !== '全国') ? [normalProvince, normalCity] : (normalCity && normalCity !== '全国' ? normalCity : undefined),
          };
        }

        if (activeTab === 'theatre') {
          const theatreSubTagNames = selectedTagIds.map(getTagName);
          const isComedyLocal = theatreSubTagNames.includes("喜剧");

          if (isComedyLocal) {
            extra_data = {
              city: (theaterProvince && theaterCity) ? [theaterProvince, theaterCity] : (theaterCity || undefined),
              club: theaterClub || undefined,
              theater: theaterVenue || undefined,
              type: theaterType || undefined,
              price: theaterPrice ? Number(theaterPrice) : undefined,
              score: theaterScore > 0 ? theaterScore : undefined,
              actors: theaterActors || undefined,
              thought: reflection.trim() || undefined,
              poiId: theaterPoiId || undefined,
              poiName: theaterVenue || undefined,
              lat: theaterLat,
              lng: theaterLng,
              address: theaterAddress || undefined,
            };
          } else {
            extra_data = {
              city: (theaterProvince && theaterCity) ? [theaterProvince, theaterCity] : (theaterCity || undefined),
              theater: theaterVenue || undefined,
              unit: theaterUnit || undefined,
              price: theaterPrice ? Number(theaterPrice) : undefined,
              seat: theaterSeat || undefined,
              score: theaterScore > 0 ? theaterScore : undefined,
              actors: theaterActors || undefined,
              thought: reflection.trim() || undefined,
              poiId: theaterPoiId || undefined,
              poiName: theaterVenue || undefined,
              lat: theaterLat,
              lng: theaterLng,
              address: theaterAddress || undefined,
            };
          }
        }

        // Food mode: build extra_data before the shared write
        if (activeTab === 'food') {
          console.log('[Food Save Debug] activeTab:', activeTab, '| foodRating:', foodRating, '| foodAddress:', foodAddress, '| foodPrice:', foodPrice);
          extra_data = {
            restaurant: specialTitle.trim(),
            address: foodAddress || undefined,
            city: (foodProvince && foodCity && foodCity !== '全国') ? [foodProvince, foodCity] : (foodCity && foodCity !== '全国' ? foodCity : undefined),
            rating: foodRating > 0 ? foodRating : undefined,
            price: foodPrice ? Number(foodPrice) : undefined,
            comment: reflection.trim() || undefined,
            dishes: foodDishes.filter(d => d.name.trim()).length > 0 ? foodDishes.filter(d => d.name.trim()).map(d => ({ name: d.name.trim(), rating: d.rating > 0 ? d.rating : undefined })) : undefined,
            lat: foodLat,
            lng: foodLng,
          } as any;
          console.log('[Food Save Debug] extra_data built:', JSON.stringify(extra_data));
        } else {
          console.log('[Food Save Debug] NOT in food tab. activeTab:', activeTab);
        }

        // Travel mode: build extra_data
        if (activeTab === 'travel') {
          extra_data = {
            startDate: `${selYear}-${String(selMonth).padStart(2, '0')}-${String(selDay).padStart(2, '0')}`,
            endDate: travelEndDate || `${selYear}-${String(selMonth).padStart(2, '0')}-${String(selDay).padStart(2, '0')}`,
            destinations: travelDestinations.length > 0 ? travelDestinations : undefined,
            expenses: travelExpenseExpanded ? (() => {
              const result: any = {};
              (Object.keys(travelExpenses) as ExpenseCategoryKey[]).forEach(key => {
                const items = travelExpenses[key].filter(i => i.name.trim() || Number(i.amount) > 0);
                if (items.length > 0) result[key] = items.map(i => ({ name: i.name.trim(), amount: Number(i.amount) || 0 }));
              });
              return Object.keys(result).length > 0 ? result : undefined;
            })() : undefined,
            totalSpend: travelExpenseExpanded ? (() => {
              let total = 0;
              (Object.keys(travelExpenses) as ExpenseCategoryKey[]).forEach(key => {
                travelExpenses[key].forEach(i => { total += Number(i.amount) || 0; });
              });
              return total > 0 ? total : undefined;
            })() : (travelSimpleTotal ? Number(travelSimpleTotal) : undefined),
            attractions: travelAttractions.length > 0 ? travelAttractions : undefined,
            linkedRecordIds: travelLinkedRecordIds.length > 0 ? travelLinkedRecordIds : undefined,
            thought: reflection.trim() || undefined,
            railways: (() => { const valid = travelRailways.filter(r => r.trainNo.trim()); return valid.length > 0 ? valid.map(r => ({ trainNo: r.trainNo.trim(), seat: r.seat.trim() || undefined })) : undefined; })(),
            flights: (() => { const valid = travelFlights.filter(f => f.flightNo.trim() || f.airline.trim() || f.departAirport.trim() || f.arriveAirport.trim()); return valid.length > 0 ? valid.map(f => ({ airline: f.airline.trim(), flightNo: f.flightNo.trim(), departAirport: f.departAirport.trim(), arriveAirport: f.arriveAirport.trim() })) : undefined; })(),
            hotels: travelHotels.length > 0 ? travelHotels : undefined,
          };
        }

        if (editingRecord && editingRecord.record.type === 'special') {
          await onUpdateRecord({
            ...editingRecord.record,
            title: specialTitle.trim(),
            dateStr,
            tagIds: finalTagIds,
            color: specialColor,
            imageUrls: allImageUrls,
            reflection: reflection.trim() || undefined,
            extra_data,
          } as EventRecord);
        } else {
          await onAddRecord({
            id: `special_${Date.now()}`,
            type: 'special',
            createdAt: Date.now(),
            title: specialTitle.trim(),
            dateStr,
            tagIds: finalTagIds,
            color: specialColor,
            imageUrls: allImageUrls,
            reflection: reflection.trim() || undefined,
            extra_data,
          } as EventRecord);
        }

      onClose();
    } finally {
      setIsUploading(false);
    }
  }, [specialTitle, selYear, selMonth, selDay, activeTab, tags, selectedTagIds, newImageFiles, existingImageUrls, reflection, editingRecord, specialColor, theaterProvince, theaterCity, theaterClub, theaterVenue, theaterType, theaterPrice, theaterScore, theaterActors, theaterUnit, theaterSeat, theaterPoiId, theaterLat, theaterLng, theaterAddress, foodAddress, foodRating, foodPrice, foodLat, foodLng, foodCity, foodProvince, foodDishes, normalProvince, normalCity, normalLocationName, normalLocationAddress, normalPoiId, normalLat, normalLng, travelDestinations, travelExpenses, travelExpenseExpanded, travelSimpleTotal, travelEndDate, travelAttractions, travelLinkedRecordIds, travelRailways, travelFlights, travelHotels, onUpdateRecord, onAddRecord, onClose]);

  const handleAddNewTag = useCallback(async () => {
    if (newTagName.trim()) {
      const activeConfig = modulesConfig[activeTab] as any;
      const tag_type = activeConfig.tagType || 'default';
      
      const tempId = `temp_${Date.now()}`;
      const tagToCreate = { 
        id: tempId,
        name: newTagName.trim(),
        tag_type 
      };

      // Optimistic UI update: Immediate local selection
      setSelectedTagIds(prev => [...prev, tempId]);
      setIsAddingTag(false);
      setNewTagName('');

      const realTag = await onAddTag(tagToCreate);
      
      if (realTag) {
        // Swap tempId with real DB id
        setSelectedTagIds(prev => prev.map(id => id === tempId ? realTag.id : id));
      } else {
        // Rollback on failure
        setSelectedTagIds(prev => prev.filter(id => id !== tempId));
      }
    }
  }, [newTagName, activeTab, onAddTag]);

  // Phase 210: Global tag creation handler
  const handleAddGlobalTag = useCallback(async () => {
    if (newGlobalTagName.trim()) {
      const tempId = `temp_global_${Date.now()}`;
      const tagToCreate = { 
        id: tempId,
        name: newGlobalTagName.trim(),
        tag_type: 'general' as const
      };
      setSelectedTagIds(prev => [...prev, tempId]);
      setIsAddingGlobalTag(false);
      setNewGlobalTagName('');
      const realTag = await onAddTag(tagToCreate);
      if (realTag) {
        setSelectedTagIds(prev => prev.map(id => id === tempId ? realTag.id : id));
      } else {
        setSelectedTagIds(prev => prev.filter(id => id !== tempId));
      }
    }
  }, [newGlobalTagName, onAddTag]);

  const handleUpdateHabitInline = useCallback((habit: DailyRecord, updates: Partial<DailyRecord>) => {
    onUpdateRecord({ ...habit, ...updates });
  }, [onUpdateRecord]);

  // ── Helper: Theater Logic ───────────────────────────────────────────
  const activeTagNames = useMemo(() => selectedTagIds.map(id => safeTags.find(t => t.id === id)?.name || ''), [selectedTagIds, safeTags]);
  const isComedy = useMemo(() => activeTagNames.includes('喜剧'), [activeTagNames]);



  // ── High Precision (Decimal) Rating Component ──────────────────
  const DecimalRating = ({ value, onChange }: { value: number, onChange: (v: number) => void }) => {
    const [hoverValue, setHoverValue] = useState<number | null>(null);
    const containerRef = useMemo(() => ({ current: null as HTMLDivElement | null }), []);

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      let val = (x / width) * 5;
      // Snap to 5.0 when cursor is near the rightmost edge (last 4px)
      if (x >= width - 4) val = 5.0;
      val = Math.max(0, Math.min(5, Math.round(val * 10) / 10));
      setHoverValue(val);
    };

    const handleClick = () => {
      if (hoverValue !== null) onChange(hoverValue);
    };

    return (
      <div className="flex items-center gap-3">
        <div 
          ref={el => { containerRef.current = el; }}
          className="relative flex gap-1 cursor-ew-resize py-1 shrink-0 z-10"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverValue(null)}
          onClick={handleClick}
        >
          {[1, 2, 3, 4, 5].map(star => {
            const displayVal = hoverValue !== null ? hoverValue : value;
            const fillWidth = Math.max(0, Math.min(1, displayVal - (star - 1)));
            
            return (
              <div key={star} className="relative text-gray-200">
                <Star size={24} fill="none" strokeWidth={1.5} />
                <div 
                  className="absolute top-0 left-0 overflow-hidden text-[#ffa500] pointer-events-none"
                  style={{ width: `${fillWidth * 100}%` }}
                >
                  <Star size={24} fill="currentColor" strokeWidth={1.5} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5 min-w-[3rem] shrink-0">
          <span className="text-lg font-black text-slate-800 dark:text-gray-100">{value.toFixed(1)}</span>
          {value > 0 && (
            <button 
              onClick={(e) => { e.stopPropagation(); onChange(0); }}
              className="text-[10px] text-gray-400 hover:text-red-500 font-bold underline underline-offset-2"
            >
              清空
            </button>
          )}
        </div>
      </div>
    );
  };


  // Current active configuration
  const activeConfig = modulesConfig[activeTab] as any;
  const themeColor = activeConfig.color || '#3b82f6';

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-opacity duration-200" 
      style={{ '--module-theme-color': themeColor } as React.CSSProperties}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setMouseDownOverlay(true);
      }}
      onMouseUp={(e) => {
        if (e.target === e.currentTarget && mouseDownOverlay) {
          onClose();
        }
        setMouseDownOverlay(false);
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transition-all duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700/50 shrink-0">
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent text-center">
            {editingRecord ? (editingRecord.record.type === 'daily' ? '养成管理' : '编辑记录') : '添加记录'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-full transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* Dynamic Tabs */}
        {!editingRecord && (isHabitMode || isTheaterMode || isFoodMode || isTravelMode) && (
          <div className="flex border-b border-gray-100 dark:border-gray-700/50 shrink-0 overflow-x-auto scrollbar-hide">
            {(Object.entries(modulesConfig) as [keyof typeof modulesConfig, any][]).map(([key, config]) => {
              // Check if mode is enabled
              const stateKey = config.stateKey;
              const isEnabled = key === 'general' || (modes as any)[stateKey];
              if (!isEnabled) return null;

              const Icon = config.icon;
              const isActive = activeTab === key;

              return (
                <button
                  key={key}
                  className={`flex-1 py-3 sm:py-4 text-xs sm:text-sm font-semibold transition-all relative flex items-center justify-center gap-1 sm:gap-2 ${
                    isActive ? 'bg-opacity-10' : 'text-gray-400'
                  }`}
                  style={{ 
                    color: isActive ? config.color : undefined,
                    backgroundColor: isActive ? `${config.color}15` : undefined
                  }}
                  onClick={() => setActiveTab(key)}
                >
                  <Icon size={14} className="sm:w-4 sm:h-4" />
                  <span className="sm:hidden">{config.shortName}</span>
                  <span className="hidden sm:inline">{config.name}</span>
                  {isActive && (
                    <div 
                      className="absolute bottom-0 left-0 w-full h-0.5" 
                      style={{ backgroundColor: config.color, boxShadow: `0 0 8px ${config.color}cc` }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto flex flex-col scrollbar-v px-6 py-6 space-y-8">
          {activeTab === 'habit' ? (
            <div className="flex flex-col space-y-8">
              {/* Part 1: New Habit form (Refined) */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">🚀 新建习惯</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={dailyContent}
                      onChange={(e) => setDailyContent(e.target.value)}
                      className="flex-1 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400 text-sm text-slate-900 dark:text-slate-100"
                      placeholder="习惯名称，例如：阅读..."
                      maxLength={20}
                    />
                    <button
                      onClick={handleSaveDaily}
                      disabled={!dailyContent.trim() || repeatDays.length === 0}
                      className="px-6 bg-blue-600 disabled:bg-gray-400 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 text-sm"
                    >
                      创建
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">📅 周期选择</label>
                  <div className="flex justify-between gap-1">
                    {WEEKDAYS.map((day) => (
                      <button
                        key={day.value}
                        onClick={() => setRepeatDays(prev => prev.includes(day.value) ? prev.filter(d => d !== day.value) : [...prev, day.value].sort())}
                        className={`flex-1 py-1.5 rounded-lg border-[1.5px] font-bold text-xs transition-all ${repeatDays.includes(day.value) ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400'
                          }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700">📅 有效周期 (可选)</label>
                  <div className="flex items-center gap-1">
                    <input type="text" inputMode="numeric" maxLength={4} placeholder="年" value={habitStartDate ? habitStartDate.split('-')[0] || '' : ''}
                      onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); const p = (habitStartDate || '--').split('-'); p[0] = v; setHabitStartDate(p.join('-')); }}
                      className="flex-1 min-w-0 p-1.5 rounded-md border border-gray-200 bg-white text-slate-900 text-xs text-center outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400" />
                    <span className="text-gray-300 text-[10px] shrink-0">-</span>
                    <input type="text" inputMode="numeric" maxLength={2} placeholder="月" value={habitStartDate ? habitStartDate.split('-')[1] || '' : ''}
                      onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); const p = (habitStartDate || '--').split('-'); p[1] = v; setHabitStartDate(p.join('-')); }}
                      className="flex-1 min-w-0 p-1.5 rounded-md border border-gray-200 bg-white text-slate-900 text-xs text-center outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400" />
                    <span className="text-gray-300 text-[10px] shrink-0">-</span>
                    <input type="text" inputMode="numeric" maxLength={2} placeholder="日" value={habitStartDate ? habitStartDate.split('-')[2] || '' : ''}
                      onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); const p = (habitStartDate || '--').split('-'); p[2] = v; setHabitStartDate(p.join('-')); }}
                      className="flex-1 min-w-0 p-1.5 rounded-md border border-gray-200 bg-white text-slate-900 text-xs text-center outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400" />
                    {habitStartDate && habitStartDate !== '--' && (
                      <button type="button" onClick={() => setHabitStartDate('')} className="p-0.5 text-gray-400 shrink-0"><X size={12} /></button>
                    )}
                    <span className="text-gray-300 text-sm shrink-0">~</span>
                    <input type="text" inputMode="numeric" maxLength={4} placeholder="年" value={habitEndDate ? habitEndDate.split('-')[0] || '' : ''}
                      onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); const p = (habitEndDate || '--').split('-'); p[0] = v; setHabitEndDate(p.join('-')); }}
                      className="flex-1 min-w-0 p-1.5 rounded-md border border-gray-200 bg-white text-slate-900 text-xs text-center outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400" />
                    <span className="text-gray-300 text-[10px] shrink-0">-</span>
                    <input type="text" inputMode="numeric" maxLength={2} placeholder="月" value={habitEndDate ? habitEndDate.split('-')[1] || '' : ''}
                      onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); const p = (habitEndDate || '--').split('-'); p[1] = v; setHabitEndDate(p.join('-')); }}
                      className="flex-1 min-w-0 p-1.5 rounded-md border border-gray-200 bg-white text-slate-900 text-xs text-center outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400" />
                    <span className="text-gray-300 text-[10px] shrink-0">-</span>
                    <input type="text" inputMode="numeric" maxLength={2} placeholder="日" value={habitEndDate ? habitEndDate.split('-')[2] || '' : ''}
                      onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); const p = (habitEndDate || '--').split('-'); p[2] = v; setHabitEndDate(p.join('-')); }}
                      className="flex-1 min-w-0 p-1.5 rounded-md border border-gray-200 bg-white text-slate-900 text-xs text-center outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400" />
                    {habitEndDate && habitEndDate !== '--' && (
                      <button type="button" onClick={() => setHabitEndDate('')} className="p-0.5 text-gray-400 shrink-0"><X size={12} /></button>
                    )}
                  </div>
                  {dateError && <p className="text-red-500 text-xs mt-1">{dateError}</p>}
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">🎨 主题色库</label>
                  <div className="grid grid-cols-12 gap-1.5 px-1 pt-3 h-auto overflow-x-hidden">
                    {defaultColors.map((color, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedColor(color)}
                        style={{ backgroundColor: color.bg }}
                        className={`aspect-square rounded-full border-2 transition-all ${selectedColor.bg === color.bg ? 'border-blue-500 scale-125 shadow-md' : 'border-transparent hover:scale-110'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Part 2: Manage list (Advanced Inline Editing) */}
              <div className="flex flex-col min-h-0">
                <div className="sticky top-[-24px] z-20 bg-white dark:bg-gray-800 py-4 mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest text-[10px] md:text-sm">现有习惯管理</h3>
                  
                  {/* Rainbow Toggle Switch */}
                  <div className="flex items-center gap-2 pr-1">
                    <span className="text-[10px] md:text-xs text-gray-400 font-medium">开启打卡视觉奖励</span>
                    <button
                      onClick={() => setShowRainbowBorder(!showRainbowBorder)}
                      className={`relative w-8 h-4.5 rounded-full transition-colors duration-200 outline-none ${showRainbowBorder ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full transition-transform duration-200 ${showRainbowBorder ? 'translate-x-3.5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  {safeRecords.filter(r => r.type === 'daily').map(record => {
                    const habit = record as DailyRecord;
                    const isEditing = editingHabitId === habit.id;

                    if (isEditing) {
                      return (
                        <div key={habit.id} className="flex flex-col gap-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border-2 border-blue-400/50 shadow-md">
                          <input
                            type="text"
                            value={editHabitName}
                            onChange={(e) => setEditHabitName(e.target.value)}
                            className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
                            placeholder="习惯名称..."
                            autoFocus
                          />

                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">周期重复</label>
                            <div className="flex gap-1.5 overflow-x-auto pb-1">
                              {WEEKDAYS.map((day) => {
                                const active = editHabitDays.includes(day.value);
                                return (
                                  <button
                                    key={day.value}
                                    onClick={() => setEditHabitDays(prev =>
                                      active ? prev.filter(d => d !== day.value) : [...prev, day.value].sort()
                                    )}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all shrink-0 ${active ? 'bg-blue-600 text-white' : 'bg-[#F0F0F0] text-[var(--habit-unchecked-text)] border border-gray-100 dark:border-[rgba(255,255,255,0.2)] dark:hover:bg-gray-200'
                                      }`}
                                  >
                                    {day.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="space-y-2">
                             <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">有效周期</label>
                             <div className="flex items-center gap-1">
                               <input type="text" inputMode="numeric" maxLength={4} placeholder="年" value={editHabitStartDate ? editHabitStartDate.split('-')[0] || '' : ''}
                                 onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); const p = (editHabitStartDate || '--').split('-'); p[0] = v; setEditHabitStartDate(p.join('-')); }}
                                 className="flex-1 min-w-0 p-1.5 rounded-md border border-blue-200 bg-white text-slate-900 text-xs text-center outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400" />
                               <span className="text-gray-300 text-[10px] shrink-0">-</span>
                               <input type="text" inputMode="numeric" maxLength={2} placeholder="月" value={editHabitStartDate ? editHabitStartDate.split('-')[1] || '' : ''}
                                 onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); const p = (editHabitStartDate || '--').split('-'); p[1] = v; setEditHabitStartDate(p.join('-')); }}
                                 className="flex-1 min-w-0 p-1.5 rounded-md border border-blue-200 bg-white text-slate-900 text-xs text-center outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400" />
                               <span className="text-gray-300 text-[10px] shrink-0">-</span>
                               <input type="text" inputMode="numeric" maxLength={2} placeholder="日" value={editHabitStartDate ? editHabitStartDate.split('-')[2] || '' : ''}
                                 onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); const p = (editHabitStartDate || '--').split('-'); p[2] = v; setEditHabitStartDate(p.join('-')); }}
                                 className="flex-1 min-w-0 p-1.5 rounded-md border border-blue-200 bg-white text-slate-900 text-xs text-center outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400" />
                               {editHabitStartDate && editHabitStartDate !== '--' && (
                                 <button type="button" onClick={() => setEditHabitStartDate('')} className="p-0.5 text-gray-400 shrink-0"><X size={12} /></button>
                               )}
                               <span className="text-gray-300 text-sm shrink-0">~</span>
                               <input type="text" inputMode="numeric" maxLength={4} placeholder="年" value={editHabitEndDate ? editHabitEndDate.split('-')[0] || '' : ''}
                                 onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); const p = (editHabitEndDate || '--').split('-'); p[0] = v; setEditHabitEndDate(p.join('-')); }}
                                 className="flex-1 min-w-0 p-1.5 rounded-md border border-blue-200 bg-white text-slate-900 text-xs text-center outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400" />
                               <span className="text-gray-300 text-[10px] shrink-0">-</span>
                               <input type="text" inputMode="numeric" maxLength={2} placeholder="月" value={editHabitEndDate ? editHabitEndDate.split('-')[1] || '' : ''}
                                 onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); const p = (editHabitEndDate || '--').split('-'); p[1] = v; setEditHabitEndDate(p.join('-')); }}
                                 className="flex-1 min-w-0 p-1.5 rounded-md border border-blue-200 bg-white text-slate-900 text-xs text-center outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400" />
                               <span className="text-gray-300 text-[10px] shrink-0">-</span>
                               <input type="text" inputMode="numeric" maxLength={2} placeholder="日" value={editHabitEndDate ? editHabitEndDate.split('-')[2] || '' : ''}
                                 onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); const p = (editHabitEndDate || '--').split('-'); p[2] = v; setEditHabitEndDate(p.join('-')); }}
                                 className="flex-1 min-w-0 p-1.5 rounded-md border border-blue-200 bg-white text-slate-900 text-xs text-center outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400" />
                               {editHabitEndDate && editHabitEndDate !== '--' && (
                                 <button type="button" onClick={() => setEditHabitEndDate('')} className="p-0.5 text-gray-400 shrink-0"><X size={12} /></button>
                               )}
                             </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">更换主题色</label>
                            <div className="flex flex-wrap gap-1.5 w-full bg-white/50 dark:bg-black/20 p-2 rounded-xl">
                              {defaultColors.map((color, i) => (
                                <button
                                  key={i}
                                  onClick={() => setEditHabitColor(color)}
                                  style={{ backgroundColor: color.bg }}
                                  className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 ${editHabitColor.bg === color.bg ? 'border-blue-500 scale-110 shadow-sm' : 'border-transparent hover:scale-105'}`}
                                />
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 mt-1">
                            <button
                              onClick={() => setEditingHabitId(null)}
                              className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 bg-gray-100 dark:bg-gray-800 rounded-lg"
                            >
                              取消
                            </button>
                            <button
                              onClick={() => {
                                if (editHabitName.trim()) {
                                  handleUpdateHabitInline(habit, {
                                    content: editHabitName.trim(),
                                    repeatDays: editHabitDays.length > 0 ? editHabitDays : [0, 1, 2, 3, 4, 5, 6],
                                    color: editHabitColor,
                                    startDate: editHabitStartDate || undefined,
                                    endDate: editHabitEndDate || undefined
                                  });
                                  setEditingHabitId(null);
                                }
                              }}
                              className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg shadow-lg shadow-blue-500/20"
                            >
                              保存
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={habit.id} className="flex flex-col gap-3 p-4 bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm group hover:border-blue-200 transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: habit.color?.bg }} />
                            <span
                              className="text-sm font-semibold text-gray-800 dark:text-gray-100 w-full overflow-hidden truncate cursor-pointer hover:text-blue-600"
                              onClick={() => {
                                setEditingHabitId(habit.id);
                                setEditHabitName(habit.content);
                                setEditHabitDays(habit.repeatDays || []);
                                setEditHabitColor(habit.color || defaultColor);
                                setEditHabitStartDate(habit.startDate || '');
                                setEditHabitEndDate(habit.endDate || '');
                              }}
                            >
                              {habit.content}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingHabitId(habit.id);
                                setEditHabitName(habit.content);
                                setEditHabitDays(habit.repeatDays || []);
                                setEditHabitColor(habit.color || defaultColor);
                                setEditHabitStartDate(habit.startDate || '');
                                setEditHabitEndDate(habit.endDate || '');
                              }}
                              className="p-2 text-gray-400 hover:text-blue-500 rounded-lg transition-all"
                              title="编辑"
                            >
                              <RotateCcw size={16} className="rotate-180" />
                            </button>
                            <button
                              onClick={() => onDeleteRecord(habit.id, 'daily', habit.content)}
                              className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-all"
                              title="删除"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-start gap-1 pl-6">
                          {WEEKDAYS.map((day) => {
                            const isSelected = habit.repeatDays?.includes(day.value);
                            return (
                              <div
                                key={day.value}
                                className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold transition-all ${isSelected ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-[#F0F0F0] text-[var(--habit-unchecked-text)] dark:hover:bg-gray-200'
                                  }`}
                              >
                                {day.label}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {safeRecords.filter(r => r.type === 'daily').length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                      <p className="text-xs italic">暂无现有习惯 ✨</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Event Form */}
              <div className="space-y-5 border-b border-gray-100 dark:border-gray-700/50 pb-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    {activeTab === 'food' ? '🍱 餐厅' : activeTab === 'theatre' ? '🎭 演出内容' : activeTab === 'travel' ? '🌴 旅行主题' : '📝 事件名称'}
                  </label>
                  
                  {activeTab === 'food' && (
                    <div className="flex flex-col gap-3">
                      {/* Province/City Selectors */}
                      <div className="flex gap-2 text-xs">
                        <div className="flex-1 flex items-center gap-1.5 p-2 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30">
                          <span className="text-orange-400 font-medium whitespace-nowrap">省份</span>
                          <select 
                            value={foodProvince}
                            onChange={(e) => setFoodProvince(e.target.value)}
                            className="bg-transparent outline-none w-full text-slate-700 dark:text-slate-300 cursor-pointer"
                          >
                            <option value="">全部</option>
                            {provinceList.map(p => (
                              <option key={p.adcode} value={p.name}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1 flex items-center gap-1.5 p-2 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30">
                          <span className="text-orange-400 font-medium whitespace-nowrap">城市</span>
                          <select 
                            value={foodCity}
                            onChange={(e) => setFoodCity(e.target.value)}
                            className="bg-transparent outline-none w-full text-slate-700 dark:text-slate-300 cursor-pointer"
                          >
                            <option value="全国">全国</option>
                            {cityList.map(c => (
                              <option key={c.adcode} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={handleManualLocation}
                          title="精准定位当前城市"
                          className="flex items-center justify-center p-2 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors"
                        >
                          <LocateFixed size={16} className={isLocationLoading ? 'animate-spin' : ''} />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <input
                      ref={poiInputRef}
                      type="text"
                      value={specialTitle}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSpecialTitle(val);

                        // Clear coordinates when user types manually (not POI-selected)
                        setFoodLat(undefined);
                        setFoodLng(undefined);

                        // 手动触发 search & 自定义列表管理
                        if (activeTab === 'food' && acRef.current && !blockSuggestRef.current) {
                          if (val.length > 0) {
                            acRef.current.search(val, (status: string, result: any) => {
                              if (status === 'complete' && result.tips) {
                                setFoodSuggestions(result.tips.filter((t: any) => t.id)); // 过滤关键词，只留 POI
                                setShowSuggestions(true);
                              } else {
                                setFoodSuggestions([]);
                                setShowSuggestions(false);
                              }
                            });
                          } else {
                            setShowSuggestions(false);
                          }
                        }
                      }}
                      onFocus={() => {
                        if (activeTab === 'food' && specialTitle && !blockSuggestRef.current) {
                          acRef.current?.search(specialTitle, (status: string, result: any) => {
                            if (status === 'complete' && result.tips) {
                              setFoodSuggestions(result.tips.filter((t: any) => t.id));
                              setShowSuggestions(true);
                            }
                          });
                        }
                      }}
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm focus:ring-2 outline-none transition-all placeholder:text-gray-400 text-sm text-slate-900 dark:text-slate-100"
                      style={{ '--tw-ring-color': themeColor } as any}
                      placeholder={activeTab === 'food' ? "搜索店名或手动输入" : activeTab === 'theatre' ? "请输入演出名称" : activeTab === 'travel' ? "请输入旅行主题，如“春游江南”" : "请输入事件名称"}
                      maxLength={30}
                    />
                    
                    {/* 自定义联想结果列表 */}
                    {showSuggestions && foodSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-[9999] mt-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl max-h-64 overflow-y-auto overflow-x-hidden animate-in fade-in zoom-in-95 duration-200">
                        {foodSuggestions.map((item, idx) => (
                          <div 
                            key={`${item.id}-${idx}`}
                            onMouseDown={(e) => {
                              e.preventDefault(); // 极其重要：防止 input blur 抢先关掉列表
                              (window as any).handlePoiSelect(item);
                            }}
                            className="p-3.5 hover:bg-orange-50 dark:hover:bg-orange-950/30 cursor-pointer border-b last:border-0 border-gray-50 dark:border-gray-700 transition-colors group"
                          >
                            <div className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                              {item.name}
                            </div>
                            {item.address && (
                              <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 line-clamp-1 flex items-center gap-1">
                                <MapPin size={10} /> {item.address}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {activeTab === 'food' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className="space-y-2">
                       <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                         📍 地址
                       </label>
                       <input 
                         type="text"
                         value={foodAddress}
                         onChange={(e) => setFoodAddress(e.target.value)}
                         className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm outline-none focus:ring-1 focus:ring-orange-400"
                         placeholder="餐厅详细地址"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                         💰 人均/总价
                       </label>
                       <div className="relative">
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">￥</span>
                         <input 
                           type="number"
                           value={foodPrice}
                           onChange={(e) => setFoodPrice(e.target.value)}
                           className="w-full pl-8 pr-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm outline-none focus:ring-1 focus:ring-orange-400"
                           placeholder="0.00"
                         />
                       </div>
                    </div>
                    <div className="col-span-full space-y-2 pb-2">
                       <label className="text-sm font-bold text-gray-700 dark:text-gray-300">⭐ 综合评分</label>
                       <DecimalRating value={foodRating} onChange={setFoodRating} />
                    </div>

                    {/* Dishes Section */}
                    <div className="col-span-full space-y-3 pb-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                          🍜 菜品评价
                        </label>
                        <div className="flex items-center gap-1">
                          {foodDishes.some(d => d.name.trim() || d.rating > 0) && (
                            <button
                              type="button"
                              onClick={() => setFoodDishes([{ name: '', rating: 0 }])}
                              className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              清空
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setFoodDishes(prev => [...prev, { name: '', rating: 0 }])}
                            className="text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors px-2 py-1 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20"
                          >
                            + 添加菜品
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {foodDishes.map((dish, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-orange-50/50 dark:bg-orange-900/10 rounded-xl p-2.5 border border-orange-100/50 dark:border-orange-800/30">
                            <input
                              type="text"
                              value={dish.name}
                              onChange={(e) => {
                                const updated = [...foodDishes];
                                updated[idx] = { ...updated[idx], name: e.target.value };
                                setFoodDishes(updated);
                              }}
                              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm outline-none focus:ring-1 focus:ring-orange-400 text-gray-800 dark:text-gray-100"
                              placeholder="菜品名称"
                              maxLength={20}
                            />
                            {/* Mini star rating for dish - soft round style */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              {[1, 2, 3, 4, 5].map(star => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => {
                                    const updated = [...foodDishes];
                                    updated[idx] = { ...updated[idx], rating: dish.rating === star ? 0 : star };
                                    setFoodDishes(updated);
                                  }}
                                  className="transition-all hover:scale-125 active:scale-95"
                                  style={{
                                    fontSize: '20px',
                                    lineHeight: 1,
                                    color: star <= (dish.rating || 0) ? '#fbbf24' : '#d1d5db',
                                    textShadow: star <= (dish.rating || 0) ? '0 0 6px rgba(251,191,36,0.4)' : 'none',
                                    WebkitTextStroke: '0.3px',
                                    WebkitTextStrokeColor: star <= (dish.rating || 0) ? '#f59e0b' : '#e5e7eb',
                                    filter: star <= (dish.rating || 0) ? 'drop-shadow(0 1px 2px rgba(245,158,11,0.3))' : 'none',
                                  }}
                                >
                                  ★
                                </button>
                              ))}
                            </div>
                            {foodDishes.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setFoodDishes(prev => prev.filter((_, i) => i !== idx))}
                                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-sm"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {/* Normal Mode: Address/Location Field */}
                {activeTab === 'general' && (
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      📍 添加地点 <span className="text-xs font-normal text-gray-400">(可选)</span>
                    </label>
                    {/* Province / City selectors + auto-locate */}
                    <div className="flex gap-2 items-center">
                      <select
                        value={normalProvince}
                        onChange={(e) => {
                          setNormalProvince(e.target.value);
                          setNormalCity('全国');
                        }}
                        className="flex-1 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        <option value="">选择省份</option>
                        {provinceData.map(p => (
                          <option key={p.name} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                      <select
                        value={normalCity}
                        onChange={(e) => setNormalCity(e.target.value)}
                        disabled={!normalProvince}
                        className="flex-1 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
                      >
                        <option value="全国">选择城市</option>
                        {normalProvince && provinceData.find(p => p.name === normalProvince)?.cities.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleNormalManualLocation}
                        disabled={isNormalLocationLoading}
                        className="shrink-0 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all active:scale-95 disabled:opacity-50"
                        title="自动定位"
                      >
                        <LocateFixed size={16} className={isNormalLocationLoading ? 'animate-spin' : ''} />
                      </button>
                    </div>
                    {/* AMap search input */}
                    <div className="relative" data-normal-poi-container>
                      <div className="relative">
                        <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          ref={normalPoiInputRef}
                          type="text"
                          value={normalLocationName}
                          onChange={e => handleNormalPoiSearch(e.target.value)}
                          onFocus={() => { if (normalSuggestions.length > 0) setShowNormalSuggestions(true); }}
                          className="w-full pl-9 pr-3 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-blue-400"
                          placeholder="搜索地点名称..."
                        />
                      </div>
                      {showNormalSuggestions && normalSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                          {normalSuggestions.map((poi: any, idx: number) => (
                            <button
                              key={poi.id || idx}
                              type="button"
                              onClick={() => handleNormalPoiSelect(poi)}
                              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                            >
                              <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{poi.name}</div>
                              <div className="text-xs text-gray-400 mt-0.5">{poi.district}{poi.address}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {normalLocationAddress && (
                      <div className="text-xs text-gray-400 flex items-center gap-1 px-1">
                        <MapPin size={10} />
                        <span>{normalLocationAddress}</span>
                      </div>
                    )}
                  </div>
                )}

                {activeTab !== 'travel' && (
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">📅 选择日期</label>
                  <div className="grid grid-cols-3 gap-2">
                    <select value={selYear} onChange={e => setSelYear(Number(e.target.value))} className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 outline-none text-sm text-gray-800 dark:text-gray-100">
                      {currentYears.map(v => <option key={v} value={v}>{v}年</option>)}
                    </select>
                    <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))} className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 outline-none text-sm text-gray-800 dark:text-gray-100">
                      {currentMonths.map(v => <option key={v} value={v}>{v}月</option>)}
                    </select>
                    <select value={selDay} onChange={e => setSelDay(Number(e.target.value))} className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 outline-none text-sm text-gray-800 dark:text-gray-100">
                      {currentDays.map(v => <option key={v} value={v}>{v}日</option>)}
                    </select>
                  </div>
                  {dateError && <p className="text-red-500 text-xs mt-1">{dateError}</p>}
                </div>
                )}

                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">🏷️ 当前模式标签</label>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      // 1. Filter by Tab Type (Strict Partitioning)
                      const tabFilteredTags = safeTags.filter(tag => {
                        if (tag.tag_type === 'function') return false;
                        const activeTagType = (modulesConfig[activeTab] as any).tagType;
                        if (activeTagType === 'food') return tag.tag_type === 'food';
                        if (activeTab === 'theatre') return tag.tag_type === 'theatre';
                        if (activeTagType === 'travel') return tag.tag_type === 'travel';
                        return !tag.tag_type || tag.tag_type === 'default';
                      });

                      // 2. Deduplicate by Name (Case-insensitive)
                      const seenNames = new Set<string>();
                      const uniqueTags = tabFilteredTags.filter(tag => {
                        const nameKey = tag.name.toLowerCase().trim();
                        if (seenNames.has(nameKey)) return false;
                        seenNames.add(nameKey);
                        return true;
                      });

                      return uniqueTags.map((tag: RecordTag) => (
                        <div 
                          key={tag.id} 
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs transition-all shadow-sm ${
                            selectedTagIds.includes(tag.id) 
                              ? 'text-white border-transparent' 
                              : 'bg-white text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-200'
                          }`}
                          style={{ 
                            backgroundColor: selectedTagIds.includes(tag.id) ? themeColor : undefined,
                            boxShadow: selectedTagIds.includes(tag.id) ? `0 4px 12px ${themeColor}33` : undefined
                          }}
                        >
                          {renamingTagId === tag.id ? (
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <input
                                autoFocus
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && renameValue.trim()) {
                                    onRenameTag(tag.id, renameValue.trim());
                                    setRenamingTagId(null);
                                  }
                                  if (e.key === 'Escape') setRenamingTagId(null);
                                }}
                                className="px-1.5 py-0.5 rounded border border-purple-400 text-xs w-20 bg-white dark:bg-gray-900 outline-none text-gray-800 dark:text-gray-200"
                              />
                              <button onClick={() => { if (renameValue.trim()) { onRenameTag(tag.id, renameValue.trim()); } setRenamingTagId(null); }} className="p-0.5 text-green-500 hover:text-green-600"><Check size={12} /></button>
                              <button onClick={() => setRenamingTagId(null)} className="p-0.5 text-gray-400 hover:text-gray-600"><X size={12} /></button>
                            </div>
                          ) : (
                            <>
                              <button 
                                onClick={() => setSelectedTagIds(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id])} 
                                className="flex-1"
                              >
                                {tag.name}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setRenamingTagId(tag.id); setRenameValue(tag.name); }}
                                className="text-gray-400 hover:text-blue-500 ml-0.5 transition-colors p-0.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                title="重命名标签"
                              >
                                <Pencil size={10} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteTag(tag.id);
                                  setSelectedTagIds(prev => prev.filter(id => id !== tag.id));
                                }} 
                                className="text-gray-400 hover:text-red-500 ml-0.5 transition-colors p-0.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="从数据库中永久删除此标签"
                              >
                                <X size={12} strokeWidth={3} />
                              </button>
                            </>
                          )}
                        </div>
                      ));
                    })()}
                    {isAddingTag ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={newTagName}
                          onChange={e => setNewTagName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddNewTag()}
                          className={`px-3 py-1.5 rounded-full border text-xs w-24 bg-white dark:bg-gray-900 outline-none ${activeTab === 'theatre' ? 'border-purple-400' : 'border-gray-400'}`}
                          placeholder="标签名..."
                        />
                        <button
                          onClick={handleAddNewTag}
                          className={`p-1.5 text-white rounded-full transition-all active:scale-90 ${activeTab === 'theatre' ? 'bg-purple-600' : 'bg-gray-800'}`}
                        >
                          <Check size={14} />
                        </button>
                        <button onClick={() => setIsAddingTag(false)} className="p-1.5 bg-gray-200 text-gray-600 rounded-full"><X size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => setIsAddingTag(true)} className="px-3 py-1.5 rounded-full border border-dashed border-gray-400 text-gray-400 text-xs flex items-center gap-1 hover:bg-gray-50">+ 添加标签</button>
                    )}
                  </div>

                  {/* Cloud tag suggestion bubbles — tags saved in Supabase */}
                  {(() => {
                    const suggestionFiltered = allAvailableTags
                      .filter(t => {
                        if (t.tag_type === 'function') return false;
                        const activeTagType = (modulesConfig[activeTab] as any).tagType;
                        if (activeTagType === 'food') return t.tag_type === 'food';
                        if (activeTab === 'theatre') return t.tag_type === 'theatre';
                        if (activeTagType === 'travel') return t.tag_type === 'travel';
                        return !t.tag_type || t.tag_type === 'default';
                      })
                      // Deduplicate: Don't suggest tags that already exist in our local safeTags list (by name)
                      .filter((t: RecordTag) => !safeTags.some((s: RecordTag) => s.name.toLowerCase().trim() === t.name.toLowerCase().trim()));

                    if (suggestionFiltered.length === 0) return null;

                    return (
                      <div className="pt-1">
                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1.5">历史标签快选</p>
                        <div className="flex flex-wrap gap-1.5">
                          {suggestionFiltered.map((tag: RecordTag) => (
                            <button
                              key={tag.id}
                              onClick={() => {
                                onAddTag(tag);
                                setSelectedTagIds(prev => prev.includes(tag.id) ? prev : [...prev, tag.id]);
                              }}
                              className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all"
                              style={{ 
                                backgroundColor: `${themeColor}10`,
                                color: themeColor,
                                borderColor: `${themeColor}30`
                              }}
                            >
                              {tag.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* ── Phase 210: Global Tags Section ── */}
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">🌐 全局标签</label>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const globalTags = safeTags.filter(t => t.tag_type === 'general');
                      const seenNames = new Set<string>();
                      const uniqueGlobal = globalTags.filter(t => {
                        const k = t.name.toLowerCase().trim();
                        if (seenNames.has(k)) return false;
                        seenNames.add(k);
                        return true;
                      });
                      return uniqueGlobal.map((tag: RecordTag) => (
                        <div 
                          key={tag.id} 
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs transition-all shadow-sm ${
                            selectedTagIds.includes(tag.id) 
                              ? 'text-white border-transparent' 
                              : 'bg-white text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-200'
                          }`}
                          style={{ 
                            backgroundColor: selectedTagIds.includes(tag.id) ? '#2563eb' : undefined,
                            boxShadow: selectedTagIds.includes(tag.id) ? '0 4px 12px rgba(37,99,235,0.2)' : undefined
                          }}
                        >
                          {renamingTagId === tag.id ? (
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <input
                                autoFocus
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && renameValue.trim()) { onRenameTag(tag.id, renameValue.trim()); setRenamingTagId(null); }
                                  if (e.key === 'Escape') setRenamingTagId(null);
                                }}
                                className="px-1.5 py-0.5 rounded border border-blue-400 text-xs w-20 bg-white dark:bg-gray-900 outline-none text-gray-800 dark:text-gray-200"
                              />
                              <button onClick={() => { if (renameValue.trim()) { onRenameTag(tag.id, renameValue.trim()); } setRenamingTagId(null); }} className="p-0.5 text-green-500 hover:text-green-600"><Check size={12} /></button>
                              <button onClick={() => setRenamingTagId(null)} className="p-0.5 text-gray-400 hover:text-gray-600"><X size={12} /></button>
                            </div>
                          ) : (
                            <>
                              <button 
                                onClick={() => setSelectedTagIds(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id])} 
                                className="flex-1"
                              >
                                {tag.name}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setRenamingTagId(tag.id); setRenameValue(tag.name); }}
                                className="opacity-50 hover:opacity-100 hover:text-blue-400 transition-opacity ml-0.5"
                                title="重命名标签"
                              >
                                <Pencil size={10} />
                              </button>
                              <button 
                                onClick={() => { onDeleteTag(tag.id); setSelectedTagIds(prev => prev.filter(id => id !== tag.id)); }}
                                className="opacity-50 hover:opacity-100 hover:text-red-400 transition-opacity ml-0.5"
                              >
                                <X size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      ));
                    })()}
                    {isAddingGlobalTag ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={newGlobalTagName}
                          onChange={e => setNewGlobalTagName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddGlobalTag()}
                          className="px-3 py-1.5 rounded-full border border-blue-400 text-xs w-24 bg-white dark:bg-gray-900 outline-none"
                          placeholder="标签名..."
                        />
                        <button onClick={handleAddGlobalTag} className="p-1.5 bg-blue-600 text-white rounded-full transition-all active:scale-90"><Check size={14} /></button>
                        <button onClick={() => setIsAddingGlobalTag(false)} className="p-1.5 bg-gray-200 text-gray-600 rounded-full"><X size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => setIsAddingGlobalTag(true)} className="px-3 py-1.5 rounded-full border border-dashed border-blue-400 text-blue-400 text-xs flex items-center gap-1 hover:bg-blue-50">+ 添加全局标签</button>
                    )}
                  </div>
                  {/* Global tag suggestions from allAvailableTags */}
                  {(() => {
                    const globalSuggestions = allAvailableTags
                      .filter(t => t.tag_type === 'general')
                      .filter(t => !safeTags.some(s => s.name.toLowerCase().trim() === t.name.toLowerCase().trim()));
                    if (globalSuggestions.length === 0) return null;
                    return (
                      <div className="pt-1">
                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1.5">历史全局标签</p>
                        <div className="flex flex-wrap gap-1.5">
                          {globalSuggestions.map((tag: RecordTag) => (
                            <button
                              key={tag.id}
                              onClick={() => {
                                onAddTag(tag);
                                setSelectedTagIds(prev => prev.includes(tag.id) ? prev : [...prev, tag.id]);
                              }}
                              className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                            >
                              + {tag.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* --- TRAVEL MODE DYNAMIC FORM --- */}
                {activeTab === 'travel' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">

                    {/* 起止时间 — Start & End Date Dropdowns */}
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                        📅 起止时间
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 shrink-0 font-bold">从</span>
                        <select value={selYear} onChange={e => setSelYear(Number(e.target.value))} className="flex-1 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none">
                          {currentYears.map(v => <option key={v} value={v}>{v}年</option>)}
                        </select>
                        <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))} className="w-16 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none">
                          {currentMonths.map(v => <option key={v} value={v}>{v}月</option>)}
                        </select>
                        <select value={selDay} onChange={e => setSelDay(Number(e.target.value))} className="w-16 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none">
                          {currentDays.map(v => <option key={v} value={v}>{v}日</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 shrink-0 font-bold">到</span>
                        <select value={(() => { const p = travelEndDate.split('-').map(Number); return p[0] || selYear; })()} onChange={e => { const p = travelEndDate.split('-').map(Number); setTravelEndDate(`${e.target.value}-${String(p[1] || selMonth).padStart(2,'0')}-${String(p[2] || selDay).padStart(2,'0')}`); }} className="flex-1 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none">
                          {currentYears.map(v => <option key={v} value={v}>{v}年</option>)}
                        </select>
                        <select value={(() => { const p = travelEndDate.split('-').map(Number); return p[1] || selMonth; })()} onChange={e => { const p = travelEndDate.split('-').map(Number); setTravelEndDate(`${p[0] || selYear}-${String(e.target.value).padStart(2,'0')}-${String(p[2] || selDay).padStart(2,'0')}`); }} className="w-16 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none">
                          {currentMonths.map(v => <option key={v} value={v}>{v}月</option>)}
                        </select>
                        <select value={(() => { const p = travelEndDate.split('-').map(Number); return p[2] || selDay; })()} onChange={e => { const p = travelEndDate.split('-').map(Number); setTravelEndDate(`${p[0] || selYear}-${String(p[1] || selMonth).padStart(2,'0')}-${String(e.target.value).padStart(2,'0')}`); }} className="w-16 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none">
                          {Array.from({ length: getDaysInMonth((() => { const p = travelEndDate.split('-').map(Number); return p[0] || selYear; })(), (() => { const p = travelEndDate.split('-').map(Number); return p[1] || selMonth; })()) }, (_, i) => i + 1).map(v => <option key={v} value={v}>{v}日</option>)}
                        </select>
                      </div>
                      {dateError && <p className="text-red-500 text-xs mt-1">{dateError}</p>}
                    </div>

                    {/* Destinations Multi-Select */}
                    <div className="space-y-1">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                        📍 目的地
                      </label>
                      {/* Domestic / Overseas Toggle */}
                      <div className="flex gap-1 mb-1">
                        <button
                          type="button"
                          onClick={() => { setTravelDestType('domestic'); setTravelDestProvince(''); }}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${travelDestType === 'domestic' ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
                        >🇨🇳 境内</button>
                        <button
                          type="button"
                          onClick={() => { setTravelDestType('overseas'); setTravelDestProvince(''); }}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${travelDestType === 'overseas' ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
                        >🌍 境外</button>
                      </div>
                      {travelDestinations.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1">
                          {travelDestinations.map((dest, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold">
                              {dest}
                              <button
                                onClick={() => setTravelDestinations(prev => prev.filter((_, idx) => idx !== i))}
                                className="text-emerald-400 hover:text-red-500 transition-colors"
                              >×</button>
                            </span>
                          ))}
                        </div>
                      )}
                      {travelDestType === 'domestic' ? (
                        <div className="flex gap-2">
                          <select
                            value={travelDestProvince}
                            onChange={e => setTravelDestProvince(e.target.value)}
                            className="flex-1 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-emerald-400"
                          >
                            <option value="">选择省份</option>
                            {provinceData.map(p => (
                              <option key={p.name} value={p.name}>{p.name}</option>
                            ))}
                          </select>
                          <select
                            onChange={e => {
                              const val = e.target.value;
                              if (val && !travelDestinations.includes(val)) {
                                setTravelDestinations(prev => [...prev, val]);
                              }
                              e.target.value = '';
                            }}
                            disabled={!travelDestProvince}
                            className="flex-1 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-50"
                          >
                            <option value="">选择城市</option>
                            {travelDestProvince && provinceData.find(p => p.name === travelDestProvince)?.cities.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <select
                          onChange={e => {
                            const val = e.target.value;
                            if (val && !travelDestinations.includes(val)) {
                              setTravelDestinations(prev => [...prev, val]);
                            }
                            e.target.value = '';
                          }}
                          className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-emerald-400"
                        >
                          <option value="">选择国家/地区</option>
                           {[
                             // 东亚 & 东南亚
                             '日本','韩国','蒙古',
                             '泰国','新加坡','马来西亚','越南','印度尼西亚','菲律宾','柬埔寨','缅甸','老挝','文莱','东帝汶',
                             // 南亚 & 中亚
                             '印度','斯里兰卡','尼泊尔','不丹','孟加拉国','巴基斯坦','马尔代夫',
                             '哈萨克斯坦','吉尔吉斯斯坦','塔吉克斯坦','乌兹别克斯坦','土库曼斯坦',
                             // 西亚 & 中东
                             '阿联酋','沙特阿拉伯','卡塔尔','科威特','巴林','阿曼','也门',
                             '约旦','以色列','黎巴嫩','伊朗','伊拉克',
                             '格鲁吉亚','亚美尼亚','阿塞拜疆',
                             // 欧洲 - 西欧
                             '英国','爱尔兰','法国','德国','荷兰','比利时','卢森堡','瑞士','奥地利','列支敦士登',
                             '西班牙','葡萄牙','意大利','马耳他','摩纳哥','圣马力诺',
                             // 欧洲 - 北欧
                             '瑞典','挪威','丹麦','芬兰','冰岛','爱沙尼亚','拉脱维亚','立陶宛',
                             // 欧洲 - 中欧 & 东欧
                             '俄罗斯','乌克兰','白俄罗斯','摩尔多瓦',
                             '波兰','捷克','斯洛伐克','匈牙利','罗马尼亚','保加利亚',
                             '塞尔维亚','克罗地亚','斯洛文尼亚','波黑','黑山','北马其顿','阿尔巴尼亚',
                             '希腊','塞浦路斯','土耳其',
                             // 北美
                             '美国','加拿大','墨西哥',
                             // 中美洲 & 加勒比
                             '危地马拉','伯利兹','洪都拉斯','萨尔瓦多','尼加拉瓜','哥斯达黎加','巴拿马',
                             '古巴','牙买加','多米尼加','巴哈马','特立尼达和多巴哥','海地',
                             // 南美洲
                             '巴西','阿根廷','智利','乌拉圭','巴拉圭','玻利维亚','秘鲁','厄瓜多尔','哥伦比亚','委内瑞拉','圭亚那','苏里南',
                             // 非洲 - 北非
                             '埃及','摩洛哥','突尼斯','阿尔及利亚',
                             // 非洲 - 东非
                             '肯尼亚','坦桑尼亚','埃塞俄比亚','卢旺达','乌干达','赞比亚','津巴布韦','莫桑比克','马达加斯加','毛里求斯','塞舌尔',
                             // 非洲 - 南非 & 西非
                             '南非','纳米比亚','博茨瓦纳','加纳','尼日利亚','塞内加尔','科特迪瓦','喀麦隆',
                             // 大洋洲
                             '澳大利亚','新西兰','斐济','帕劳','瓦努阿图','萨摩亚','汤加',
                           ].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      )}
                    </div>



                     {/* Expense Breakdown Card */}
                     <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/40 overflow-hidden">
                       {/* Collapsible Header */}
                       <button
                         type="button"
                         onClick={() => setTravelExpenseExpanded(prev => !prev)}
                         className="w-full flex items-center justify-between px-3 py-2 bg-emerald-100/60 dark:bg-emerald-800/20 hover:bg-emerald-100/80 dark:hover:bg-emerald-800/30 transition-colors"
                       >
                         <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                           💰 旅行支出 <span className="font-normal text-emerald-500/60 dark:text-emerald-400/50">(可选)</span>
                         </span>
                         <div className="flex items-center gap-2">
                           {!travelExpenseExpanded && Number(travelSimpleTotal) > 0 && (
                             <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">¥{Number(travelSimpleTotal).toLocaleString()}</span>
                           )}
                           {travelExpenseExpanded && EXPENSE_CATEGORIES.reduce((s, c) => s + travelExpenses[c.key].reduce((a, i) => a + (Number(i.amount) || 0), 0), 0) > 0 && (
                             <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">合计 ¥{EXPENSE_CATEGORIES.reduce((s, c) => s + travelExpenses[c.key].reduce((a, i) => a + (Number(i.amount) || 0), 0), 0).toLocaleString()}</span>
                           )}
                           <span className="text-emerald-500 dark:text-emerald-400 text-[10px] font-bold">
                             {travelExpenseExpanded ? '▲' : '▼'}
                           </span>
                         </div>
                       </button>

                       {/* Collapsed: simple total input */}
                       {!travelExpenseExpanded && (
                         <div className="px-3 py-2 bg-emerald-50/40 dark:bg-emerald-900/10">
                           <div className="relative">
                             <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">¥</span>
                             <input
                               type="number"
                               inputMode="decimal"
                               value={travelSimpleTotal}
                               onChange={e => setTravelSimpleTotal(e.target.value)}
                               placeholder="总支出"
                               className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-emerald-200/80 dark:border-emerald-700/50 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-emerald-400 placeholder:text-gray-300"
                             />
                           </div>
                         </div>
                       )}

                        {travelExpenseExpanded && (
                          <div className="bg-emerald-50/30 dark:bg-emerald-900/10 divide-y divide-emerald-100/50 dark:divide-emerald-800/20">
                            {([
                              [EXPENSE_CATEGORIES[0], EXPENSE_CATEGORIES[1]],
                              [EXPENSE_CATEGORIES[2], EXPENSE_CATEGORIES[3]],
                              [EXPENSE_CATEGORIES[4], EXPENSE_CATEGORIES[5]],
                            ] as [typeof EXPENSE_CATEGORIES[0], typeof EXPENSE_CATEGORIES[0]][]).map(([catA, catB], pairIdx) => (
                              <div key={pairIdx} className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-emerald-100/50 dark:divide-emerald-800/20">
                                {[catA, catB].map(cat => {
                                  const catTotal = travelExpenses[cat.key].reduce((s, itm) => s + (Number(itm.amount) || 0), 0);
                                  return (
                                    <div key={cat.key} className="px-2 py-2 space-y-1">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{cat.emoji} {cat.label}</span>
                                        <div className="flex items-center gap-1.5">
                                          {catTotal > 0 && <span className="text-[11px] font-bold text-emerald-500 dark:text-emerald-400">{`¥${catTotal.toLocaleString()}`}</span>}
                                          <button type="button"
                                            onClick={() => setTravelExpenses(prev => ({ ...prev, [cat.key]: [...prev[cat.key], { name: '', amount: '' }] }))}
                                            className="text-[11px] font-bold text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors"
                                          >+</button>
                                        </div>
                                      </div>
                                      {travelExpenses[cat.key].map((expItem, idx) => (
                                        <div key={idx} className="flex items-center gap-1">
                                          <input
                                            type="text"
                                            value={expItem.name}
                                            onChange={e => setTravelExpenses(prev => { const u = [...prev[cat.key]]; u[idx] = { ...u[idx], name: e.target.value }; return { ...prev, [cat.key]: u }; })}
                                            placeholder="项目"
                                            maxLength={12}
                                            className="flex-1 min-w-0 px-1.5 py-1 rounded border border-emerald-200/70 dark:border-emerald-700/40 bg-white dark:bg-gray-900 text-[11px] text-gray-700 dark:text-gray-200 outline-none focus:ring-1 focus:ring-emerald-400 placeholder:text-gray-300"
                                          />
                                          <div className="relative shrink-0 w-16">
                                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">¥</span>
                                            <input
                                              type="number"
                                              inputMode="decimal"
                                              value={expItem.amount}
                                              onChange={e => setTravelExpenses(prev => { const u = [...prev[cat.key]]; u[idx] = { ...u[idx], amount: e.target.value }; return { ...prev, [cat.key]: u }; })}
                                              placeholder="0"
                                              className="w-full pl-4 pr-1 py-1 rounded border border-emerald-200/70 dark:border-emerald-700/40 bg-white dark:bg-gray-900 text-[11px] text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-emerald-400 placeholder:text-gray-300"
                                            />
                                          </div>
                                          {travelExpenses[cat.key].length > 1 && (
                                            <button type="button"
                                              onClick={() => setTravelExpenses(prev => ({ ...prev, [cat.key]: prev[cat.key].filter((_x, i2) => i2 !== idx) }))}
                                              className="shrink-0 text-gray-300 hover:text-red-400 transition-colors text-xs px-0.5"
                                            >x</button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                            {EXPENSE_CATEGORIES.reduce((s, c) => s + travelExpenses[c.key].reduce((a, itm) => a + (Number(itm.amount) || 0), 0), 0) > 0 && (
                              <div className="px-3 py-1.5 flex items-center justify-between">
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">全程总支出</span>
                                <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                                  {`¥${EXPENSE_CATEGORIES.reduce((s, c) => s + travelExpenses[c.key].reduce((a, itm) => a + (Number(itm.amount) || 0), 0), 0).toLocaleString()}`}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                     </div>

                     {/* ── Transport & Hotel Card ── */}
                     <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                       <button
                         type="button"
                         onClick={() => setTravelTransportExpanded(prev => !prev)}
                         className="w-full flex items-center justify-between px-3 py-2 bg-emerald-100/60 dark:bg-emerald-800/20 hover:bg-emerald-100/80 dark:hover:bg-emerald-800/30 transition-colors rounded-t-xl"
                       >
                         <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                           🧳 交通与住宿 <span className="font-normal text-emerald-500/60 dark:text-emerald-400/50">(可选)</span>
                         </span>
                         <span className="text-emerald-500 dark:text-emerald-400 text-[10px] font-bold">
                           {travelTransportExpanded ? '▲' : '▼'}
                         </span>
                       </button>

                       {travelTransportExpanded && (
                         <div className="bg-emerald-50/30 dark:bg-emerald-900/10 p-3 space-y-4">

                           {/* ── Railway Section ── */}
                           <div className="space-y-1.5">
                             <div className="flex items-center justify-between">
                               <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">🚄 铁路</span>
                               <button type="button" onClick={() => setTravelRailways(prev => [...prev, {trainNo: '', seat: ''}])} className="text-emerald-500 hover:text-emerald-700 text-xs font-bold">+ 添加</button>
                             </div>
                             {travelRailways.map((r, i) => (
                               <div key={i} className="flex gap-2 items-center">
                                 <input type="text" value={r.trainNo} onChange={e => { const arr = [...travelRailways]; arr[i] = {...arr[i], trainNo: e.target.value}; setTravelRailways(arr); }} placeholder="车次" className="flex-1 px-2 py-1.5 rounded-lg border border-emerald-200/80 dark:border-emerald-700/50 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-emerald-400 placeholder:text-gray-300" />
                                 <input type="text" value={r.seat} onChange={e => { const arr = [...travelRailways]; arr[i] = {...arr[i], seat: e.target.value}; setTravelRailways(arr); }} placeholder="坐席" className="flex-1 px-2 py-1.5 rounded-lg border border-emerald-200/80 dark:border-emerald-700/50 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-emerald-400 placeholder:text-gray-300" />
                                 {travelRailways.length > 1 && (
                                   <button type="button" onClick={() => setTravelRailways(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 text-xs shrink-0">×</button>
                                 )}
                               </div>
                             ))}
                           </div>

                           {/* ── Aviation Section ── */}
                           <div className="space-y-1.5">
                             <div className="flex items-center justify-between">
                               <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">✈️ 航空</span>
                               <button type="button" onClick={() => setTravelFlights(prev => [...prev, {airline: '', flightNo: '', departAirport: '', arriveAirport: ''}])} className="text-emerald-500 hover:text-emerald-700 text-xs font-bold">+ 添加</button>
                             </div>
                             {travelFlights.map((f, i) => (
                               <div key={i} className="space-y-1.5">
                                 <div className="flex gap-2 items-center">
                                   <input type="text" value={f.airline} onChange={e => { const arr = [...travelFlights]; arr[i] = {...arr[i], airline: e.target.value}; setTravelFlights(arr); }} placeholder="航司" className="w-20 px-2 py-1.5 rounded-lg border border-emerald-200/80 dark:border-emerald-700/50 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-emerald-400 placeholder:text-gray-300" />
                                   <input type="text" value={f.flightNo} onChange={e => { const arr = [...travelFlights]; arr[i] = {...arr[i], flightNo: e.target.value}; setTravelFlights(arr); }} placeholder="航班号" className="flex-1 px-2 py-1.5 rounded-lg border border-emerald-200/80 dark:border-emerald-700/50 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-emerald-400 placeholder:text-gray-300" />
                                   {travelFlights.length > 1 && (
                                     <button type="button" onClick={() => setTravelFlights(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 text-xs shrink-0">×</button>
                                   )}
                                 </div>
                                 <div className="flex gap-2 items-center">
                                   {/* Departure airport with AMap autocomplete */}
                                   <div className="flex-1 relative">
                                     <input type="text" value={f.departAirport} onChange={e => {
                                       const val = e.target.value;
                                       const arr = [...travelFlights]; arr[i] = {...arr[i], departAirport: val}; setTravelFlights(arr);
                                       if (val.trim().length >= 2) {
                                         if (!travelAirportAcRef.current) {
                                           (window as any).AMap?.plugin('AMap.PlaceSearch', () => { travelAirportAcRef.current = new (window as any).AMap.PlaceSearch({ pageSize: 5, type: '150104|150100' }); });
                                         }
                                         setTimeout(() => {
                                           travelAirportAcRef.current?.search(val, (status: string, result: any) => {
                                             if (status === 'complete' && result.poiList?.pois) setAirportSuggestions({idx: i, field: 'departAirport', pois: result.poiList.pois.slice(0, 5)});
                                           });
                                         }, 100);
                                       } else { setAirportSuggestions(null); }
                                     }} placeholder="出发机场" className="w-full px-2 py-1.5 rounded-lg border border-emerald-200/80 dark:border-emerald-700/50 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-emerald-400 placeholder:text-gray-300" />
                                     {airportSuggestions && airportSuggestions.idx === i && airportSuggestions.field === 'departAirport' && airportSuggestions.pois.length > 0 && (
                                       <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                                         {airportSuggestions.pois.map((poi: any, idx: number) => (
                                           <button key={idx} type="button" className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                                             onClick={() => { const arr = [...travelFlights]; arr[i] = {...arr[i], departAirport: poi.name || ''}; setTravelFlights(arr); setAirportSuggestions(null); }}>
                                             <div className="text-sm font-bold text-gray-700 dark:text-gray-200">{poi.name}</div>
                                             {poi.address && <div className="text-[10px] text-gray-400 truncate">{poi.address}</div>}
                                           </button>
                                         ))}
                                       </div>
                                     )}
                                   </div>
                                   <span className="text-gray-400 text-xs font-bold shrink-0">→</span>
                                   {/* Arrival airport with AMap autocomplete */}
                                   <div className="flex-1 relative">
                                     <input type="text" value={f.arriveAirport} onChange={e => {
                                       const val = e.target.value;
                                       const arr = [...travelFlights]; arr[i] = {...arr[i], arriveAirport: val}; setTravelFlights(arr);
                                       if (val.trim().length >= 2) {
                                         if (!travelAirportAcRef.current) {
                                           (window as any).AMap?.plugin('AMap.PlaceSearch', () => { travelAirportAcRef.current = new (window as any).AMap.PlaceSearch({ pageSize: 5, type: '150104|150100' }); });
                                         }
                                         setTimeout(() => {
                                           travelAirportAcRef.current?.search(val, (status: string, result: any) => {
                                             if (status === 'complete' && result.poiList?.pois) setAirportSuggestions({idx: i, field: 'arriveAirport', pois: result.poiList.pois.slice(0, 5)});
                                           });
                                         }, 100);
                                       } else { setAirportSuggestions(null); }
                                     }} placeholder="到达机场" className="w-full px-2 py-1.5 rounded-lg border border-emerald-200/80 dark:border-emerald-700/50 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-emerald-400 placeholder:text-gray-300" />
                                     {airportSuggestions && airportSuggestions.idx === i && airportSuggestions.field === 'arriveAirport' && airportSuggestions.pois.length > 0 && (
                                       <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                                         {airportSuggestions.pois.map((poi: any, idx: number) => (
                                           <button key={idx} type="button" className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                                             onClick={() => { const arr = [...travelFlights]; arr[i] = {...arr[i], arriveAirport: poi.name || ''}; setTravelFlights(arr); setAirportSuggestions(null); }}>
                                             <div className="text-sm font-bold text-gray-700 dark:text-gray-200">{poi.name}</div>
                                             {poi.address && <div className="text-[10px] text-gray-400 truncate">{poi.address}</div>}
                                           </button>
                                         ))}
                                       </div>
                                     )}
                                   </div>
                                 </div>
                               </div>
                             ))}
                           </div>

                           {/* ── Hotel Section ── */}
                           <div className="space-y-1.5">
                             <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">🏨 酒店</span>
                             {/* Hotel chips */}
                             {travelHotels.length > 0 && (
                               <div className="flex flex-wrap gap-1.5 mb-1">
                                 {travelHotels.map((h, i) => (
                                   <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold">
                                     {h.name}
                                     <button type="button" onClick={() => setTravelHotels(prev => prev.filter((_, idx) => idx !== i))} className="text-blue-400 hover:text-red-500 transition-colors">×</button>
                                   </span>
                                 ))}
                               </div>
                             )}
                             {/* City selector + auto-locate */}
                             <div className="flex gap-2 items-center">
                               <select value={travelHotelProvince} onChange={e => { setTravelHotelProvince(e.target.value); setTravelHotelCity(''); }} className="w-24 px-1.5 py-1.5 rounded-lg border border-emerald-200/80 dark:border-emerald-700/50 bg-white dark:bg-gray-900 text-xs text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-emerald-400">
                                 <option value="">省份</option>
                                 {provinceData.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                               </select>
                               <select value={travelHotelCity} onChange={e => setTravelHotelCity(e.target.value)} className="w-24 px-1.5 py-1.5 rounded-lg border border-emerald-200/80 dark:border-emerald-700/50 bg-white dark:bg-gray-900 text-xs text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-emerald-400">
                                 <option value="">城市</option>
                                 {(provinceData.find(p => p.name === travelHotelProvince)?.cities || []).map(c => <option key={c} value={c}>{c}</option>)}
                               </select>
                               <button type="button" onClick={() => {
                                 if (!(window as any).AMap) return;
                                 const AMap = (window as any).AMap;
                                 const cs = new AMap.CitySearch();
                                 cs.getLocalCity((status: string, result: any) => {
                                   if (status === 'complete' && result.info === 'OK') {
                                     setTravelHotelProvince(result.province);
                                     setTravelHotelCity(result.city);
                                   }
                                 });
                               }} className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors shrink-0" title="自动定位">
                                 <LocateFixed size={14} />
                               </button>
                             </div>
                             {/* Hotel search */}
                             <div className="relative">
                               <input
                                 type="text"
                                 value={travelHotelInput}
                                 onChange={e => {
                                   const val = e.target.value;
                                   setTravelHotelInput(val);
                                   blockTravelHotelSuggestRef.current = false;
                                   if (val.trim().length >= 2) {
                                     const cityParam = travelHotelCity || (travelDestinations.length > 0 ? travelDestinations[0] : '');
                                     if (!travelHotelAcRef.current || (travelHotelAcRef.current as any).__city !== cityParam) {
                                       (window as any).AMap?.plugin('AMap.PlaceSearch', () => {
                                         travelHotelAcRef.current = new (window as any).AMap.PlaceSearch({
                                           pageSize: 5, city: cityParam || '', citylimit: !!cityParam,
                                           type: '100000|100100', // Hotel types
                                         });
                                         (travelHotelAcRef.current as any).__city = cityParam;
                                       });
                                     }
                                     setTimeout(() => {
                                       if (travelHotelAcRef.current && !blockTravelHotelSuggestRef.current) {
                                         travelHotelAcRef.current.search(val, (status: string, result: any) => {
                                           if (status === 'complete' && result.poiList?.pois) {
                                             setTravelHotelSuggestions(result.poiList.pois.slice(0, 5));
                                             setShowTravelHotelSuggestions(true);
                                           }
                                         });
                                       }
                                     }, 100);
                                   } else {
                                     setTravelHotelSuggestions([]);
                                     setShowTravelHotelSuggestions(false);
                                   }
                                 }}
                                 placeholder={(() => {
                                   const c = travelHotelCity || (travelDestinations.length > 0 ? travelDestinations[0] : '');
                                   return c ? `在${c}搜索酒店…` : '搜索酒店…';
                                 })()}
                                 className="w-full px-3 py-1.5 rounded-lg border border-emerald-200/80 dark:border-emerald-700/50 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-emerald-400 placeholder:text-gray-300"
                               />
                               {showTravelHotelSuggestions && travelHotelSuggestions.length > 0 && (
                                 <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                   {travelHotelSuggestions.map((poi: any, idx: number) => {
                                     const lat = poi.location?.getLat ? poi.location.getLat() : poi.location?.lat;
                                     const lng = poi.location?.getLng ? poi.location.getLng() : poi.location?.lng;
                                     return (
                                       <button key={idx} type="button" className="w-full text-left px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                                         onClick={() => {
                                           setTravelHotels(prev => [...prev, { name: poi.name || '', lat, lng, address: poi.address || '', poiId: poi.id || '' }]);
                                           setTravelHotelInput('');
                                           setShowTravelHotelSuggestions(false);
                                           setTravelHotelSuggestions([]);
                                           blockTravelHotelSuggestRef.current = true;
                                         }}>
                                         <div className="text-sm font-bold text-gray-700 dark:text-gray-200">{poi.name}</div>
                                         {poi.address && <div className="text-[10px] text-gray-400 truncate">{poi.address}</div>}
                                       </button>
                                     );
                                   })}
                                 </div>
                               )}
                             </div>
                           </div>

                         </div>
                       )}
                     </div>

                    {/* Attractions — domestic only */}
                    {travelDestType === 'domestic' && (
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                        🏞️ 景点 <span className="text-xs font-normal text-gray-400">(高德搜索，可选)</span>
                      </label>
                      {travelAttractions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1">
                          {travelAttractions.map((att, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold">
                              {att.name}
                              <button
                                onClick={() => setTravelAttractions(prev => prev.filter((_, idx) => idx !== i))}
                                className="text-emerald-400 hover:text-red-500 transition-colors"
                              >×</button>
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Single row: province + city + locate + search input */}
                      <div className="flex gap-1.5 items-center relative">
                        <select
                          value={travelAttractionProvince}
                          onChange={e => {
                            setTravelAttractionProvince(e.target.value);
                            setTravelAttractionCity('');
                            travelAttractionAcRef.current = null;
                          }}
                          className="w-[72px] p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-[11px] text-gray-800 dark:text-gray-100 outline-none shrink-0"
                        >
                          <option value="">省份</option>
                          {provinceData.map(p => (
                            <option key={p.name} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                        <select
                          value={travelAttractionCity}
                          onChange={e => {
                            setTravelAttractionCity(e.target.value);
                            travelAttractionAcRef.current = null;
                          }}
                          disabled={!travelAttractionProvince}
                          className="w-[72px] p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-[11px] text-gray-800 dark:text-gray-100 outline-none disabled:opacity-40 shrink-0"
                        >
                          <option value="">城市</option>
                          {travelAttractionProvince && provinceData.find(p => p.name === travelAttractionProvince)?.cities.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const AMap = (window as any).AMap;
                            if (!AMap) return;
                            const citySearch = new AMap.CitySearch();
                            citySearch.getLocalCity((status: string, result: any) => {
                              if (status === 'complete' && result.info === 'OK') {
                                const prov = result.province || '';
                                const city = result.city || '';
                                const matchedProv = provinceData.find(p => prov.includes(p.name) || p.name.includes(prov));
                                if (matchedProv) {
                                  setTravelAttractionProvince(matchedProv.name);
                                  const matchedCity = matchedProv.cities.find((c: string) => city.includes(c) || c.includes(city));
                                  setTravelAttractionCity(matchedCity || '');
                                  travelAttractionAcRef.current = null;
                                }
                              }
                            });
                          }}
                          className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors shrink-0"
                          title="自动定位"
                        >
                          <LocateFixed size={14} />
                        </button>
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={travelAttractionInput}
                            onChange={e => {
                              const val = e.target.value;
                              setTravelAttractionInput(val);
                              blockTravelSuggestRef.current = false;
                              if (val.trim().length >= 2) {
                                const doSearch = () => {
                                  if (!(window as any).AMap) return;
                                  const cityParam = travelAttractionCity || (travelDestinations.length > 0 ? travelDestinations[0] : '');
                                  if (!travelAttractionAcRef.current || (travelAttractionAcRef.current as any).__city !== cityParam) {
                                    (window as any).AMap.plugin('AMap.PlaceSearch', () => {
                                      travelAttractionAcRef.current = new (window as any).AMap.PlaceSearch({
                                        pageSize: 5,
                                        city: cityParam || '',
                                        citylimit: !!cityParam,
                                      });
                                      (travelAttractionAcRef.current as any).__city = cityParam;
                                    });
                                  }
                                  setTimeout(() => {
                                    if (travelAttractionAcRef.current && !blockTravelSuggestRef.current) {
                                      travelAttractionAcRef.current.search(val, (status: string, result: any) => {
                                        if (status === 'complete' && result.poiList?.pois) {
                                          setTravelAttractionSuggestions(result.poiList.pois.slice(0, 5));
                                          setShowTravelAttractionSuggestions(true);
                                        }
                                      });
                                    }
                                  }, 100);
                                };
                                doSearch();
                              } else {
                                setTravelAttractionSuggestions([]);
                                setShowTravelAttractionSuggestions(false);
                              }
                            }}
                            placeholder={(() => {
                              const c = travelAttractionCity || (travelDestinations.length > 0 ? travelDestinations[0] : '');
                              return c ? `在${c}搜索…` : '搜索景点…';
                            })()}
                            className="w-full p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-[11px] outline-none focus:ring-1 focus:ring-emerald-400 text-gray-800 dark:text-gray-100"
                          />
                          {showTravelAttractionSuggestions && travelAttractionSuggestions.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
                              {travelAttractionSuggestions.map((poi: any, i: number) => (
                                <button
                                  key={i}
                                  className="w-full text-left px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-sm transition-colors border-b border-gray-50 dark:border-gray-700/30 last:border-0"
                                  onClick={() => {
                                    blockTravelSuggestRef.current = true;
                                    const newAttraction: TravelAttraction = {
                                      name: poi.name,
                                      poiId: poi.id,
                                      lat: poi.location?.lat,
                                      lng: poi.location?.lng,
                                      address: poi.address,
                                    };
                                    setTravelAttractions(prev => [...prev, newAttraction]);
                                    setTravelAttractionInput('');
                                    setShowTravelAttractionSuggestions(false);
                                    setTravelAttractionSuggestions([]);
                                  }}
                                >
                                  <div className="font-bold text-gray-800 dark:text-gray-100 text-xs">{poi.name}</div>
                                  <div className="text-[10px] text-gray-400 truncate">{poi.address}</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    )}

                    {/* Linked Records */}
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                        🔗 关联记录 <span className="text-xs font-normal text-gray-400">(可选，可排序)</span>
                      </label>
                      <p className="text-[10px] text-gray-400">选择旅行日期范围内的已有记录关联到本次旅行，勾选后可上下调整顺序</p>
                      {(() => {
                        const startStr = `${selYear}-${String(selMonth).padStart(2, '0')}-${String(selDay).padStart(2, '0')}`;
                        const endStr = travelEndDate || startStr;
                        const linkable = safeRecords.filter(r => {
                          if (r.type !== 'special') return false;
                          const ev = r as EventRecord;
                          if (ev.parent_tag === '旅行模式') return false;
                          if (ev.parent_tag === '演出模式' && !isTheaterMode) return false;
                          if (ev.parent_tag === '美食模式' && !isFoodMode) return false;
                          if (ev.dateStr < startStr || ev.dateStr > endStr) return false;
                          return true;
                        });
                        if (linkable.length === 0) {
                          return <p className="text-xs text-gray-300 italic">日期范围内暂无可关联的记录</p>;
                        }

                        // Get ordered linked records (preserve saved order)
                        const linkedRecords = travelLinkedRecordIds
                          .map(id => linkable.find(r => r.id === id))
                          .filter(Boolean) as EventRecord[];

                        // Unlinked records
                        const unlinked = linkable.filter(r => !travelLinkedRecordIds.includes(r.id));

                        const getModeIcon = (ev: EventRecord) => {
                          if (ev.parent_tag === '演出模式') return '🎭';
                          if (ev.parent_tag === '美食模式') return '🍽️';
                          return '📝';
                        };

                        return (
                          <div className="space-y-2">
                            {/* Already linked — drag to reorder */}
                            {linkedRecords.length > 0 && (
                              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 overflow-hidden">
                                <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">已关联 ({linkedRecords.length}) — 拖拽排序</div>
                                {linkedRecords.map((ev, idx) => (
                                  <div
                                    key={ev.id}
                                    draggable
                                    onDragStart={e => {
                                      e.dataTransfer.effectAllowed = 'move';
                                      e.dataTransfer.setData('text/plain', String(idx));
                                      (e.currentTarget as HTMLElement).style.opacity = '0.4';
                                    }}
                                    onDragEnd={e => {
                                      (e.currentTarget as HTMLElement).style.opacity = '1';
                                      // Remove all drag-over highlights
                                      document.querySelectorAll('[data-drag-over]').forEach(el => {
                                        (el as HTMLElement).style.borderTopColor = '';
                                        el.removeAttribute('data-drag-over');
                                      });
                                    }}
                                    onDragOver={e => {
                                      e.preventDefault();
                                      e.dataTransfer.dropEffect = 'move';
                                      // Highlight drop target
                                      (e.currentTarget as HTMLElement).style.borderTopColor = '#10b981';
                                      (e.currentTarget as HTMLElement).setAttribute('data-drag-over', '1');
                                    }}
                                    onDragLeave={e => {
                                      (e.currentTarget as HTMLElement).style.borderTopColor = '';
                                      (e.currentTarget as HTMLElement).removeAttribute('data-drag-over');
                                    }}
                                    onDrop={e => {
                                      e.preventDefault();
                                      (e.currentTarget as HTMLElement).style.borderTopColor = '';
                                      (e.currentTarget as HTMLElement).removeAttribute('data-drag-over');
                                      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                                      const toIdx = idx;
                                      if (fromIdx === toIdx) return;
                                      // Build new order
                                      const newIds = [...travelLinkedRecordIds];
                                      const [moved] = newIds.splice(fromIdx, 1);
                                      newIds.splice(toIdx, 0, moved);
                                      // Date constraint check: ensure no later-date before earlier-date
                                      const newRecords = newIds.map(id => linkable.find(r => r.id === id)).filter(Boolean) as EventRecord[];
                                      for (let i = 1; i < newRecords.length; i++) {
                                        if (newRecords[i].dateStr < newRecords[i - 1].dateStr) {
                                          alert('不允许将后一天的记录排到前一天的记录之前');
                                          return;
                                        }
                                      }
                                      setTravelLinkedRecordIds(newIds);
                                    }}
                                    className="flex items-center gap-1.5 px-2 py-1.5 border-t-2 border-t-transparent border-b border-b-emerald-100 dark:border-b-emerald-900/20 last:border-b-0 bg-emerald-50/50 dark:bg-emerald-900/10 cursor-grab active:cursor-grabbing select-none transition-colors"
                                  >
                                    <GripVertical size={14} className="text-emerald-400/60 shrink-0" />
                                    <span className="text-[10px] text-gray-400 font-mono w-4 text-center shrink-0">{idx + 1}</span>
                                    <span className="text-sm">{getModeIcon(ev)}</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{ev.title}</div>
                                      <div className="text-[10px] text-gray-400">{ev.dateStr}</div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setTravelLinkedRecordIds(prev => prev.filter(id => id !== ev.id))}
                                      className="text-red-300 hover:text-red-500 transition-colors shrink-0 p-1"
                                    ><X size={12} /></button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Unlinked — checkbox list to add */}
                            {unlinked.length > 0 && (
                              <div className="max-h-32 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700">
                                {unlinked.map(r => {
                                  const ev = r as EventRecord;
                                  return (
                                    <button
                                      key={ev.id}
                                      onClick={() => setTravelLinkedRecordIds(prev => [...prev, ev.id])}
                                      className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm border-b border-gray-100 dark:border-gray-700/30 last:border-0 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors"
                                    >
                                      <span className="text-base">{getModeIcon(ev)}</span>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-bold text-gray-800 dark:text-gray-100 truncate">{ev.title}</div>
                                        <div className="text-[10px] text-gray-400">{ev.dateStr}</div>
                                      </div>
                                      <div className="w-5 h-5 rounded-md border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center"></div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* --- THEATER MODE DYNAMIC FORM --- */}
                {activeTab === 'theatre' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">

                    {/* City Selector */}
                    <div className="flex gap-3 items-end">
                      <div className="flex-1 space-y-2">
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                          📍 省份
                        </label>
                        <select 
                          value={theaterProvince}
                          onChange={(e) => {
                            setTheaterProvince(e.target.value);
                            setTheaterCity('');
                          }}
                          className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-purple-400"
                        >
                          <option value="">选择省份</option>
                          {provinceData.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="flex-1 space-y-2">
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                          📍 城市
                        </label>
                        <select 
                          value={theaterCity}
                          onChange={(e) => setTheaterCity(e.target.value)}
                          disabled={!theaterProvince}
                          className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-purple-400 disabled:opacity-50"
                        >
                          <option value="">选择城市</option>
                          {theaterProvince && provinceData.find(p => p.name === theaterProvince)?.cities.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleTheaterManualLocation}
                        disabled={isLocationLoading}
                        className="shrink-0 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all active:scale-95 disabled:opacity-50 mb-0"
                        title="自动定位"
                      >
                        <LocateFixed size={16} className={isLocationLoading ? 'animate-spin' : ''} />
                      </button>
                    </div>

                    {/* Dynamic Part A: Comedy */}
                    {isComedy && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                              🏢 俱乐部
                            </label>
                            <input 
                              type="text"
                              value={theaterClub}
                              onChange={e => setTheaterClub(e.target.value)}
                              className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-purple-400"
                              placeholder="如：笑果..."
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                              🎤 演出场地
                            </label>
                            <div className="relative" data-theater-poi-container>
                              <input 
                                ref={theaterPoiInputRef}
                                type="text"
                                value={theaterVenue}
                                onChange={e => handleTheaterPoiSearch(e.target.value)}
                                onFocus={() => { if (theaterSuggestions.length > 0) setShowTheaterSuggestions(true); }}
                                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-purple-400"
                                placeholder="搜索演出场地..."
                              />
                              {showTheaterSuggestions && theaterSuggestions.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                                  {theaterSuggestions.map((poi: any, idx: number) => (
                                    <button
                                      key={poi.id || idx}
                                      type="button"
                                      onClick={() => handleTheaterPoiSelect(poi)}
                                      className="w-full text-left px-3 py-2.5 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                                    >
                                      <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{poi.name}</div>
                                      <div className="text-xs text-gray-400 mt-0.5">{poi.district}{poi.address}</div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            {theaterAddress && (
                              <div className="text-xs text-gray-400 flex items-center gap-1 px-1">
                                <MapPin size={10} />
                                <span>{theaterAddress}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-700 dark:text-gray-300">🎬 演出类型</label>
                          <div className="flex flex-wrap gap-2">
                            {["脱口秀", "Sketch", "新喜剧", "漫才", "其他"].map(t => (
                              <button
                                key={t}
                                onClick={() => setTheaterType(t)}
                                className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all ${theaterType === t ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-400 border-gray-200 dark:border-gray-700 hover:border-purple-300'}`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Dynamic Part B: Others (Show/Theater/Concert) */}
                    {(!isComedy) && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                              🎭 演出地点
                            </label>
                            <div className="relative" data-theater-poi-container>
                              <input 
                                ref={!isComedy ? theaterPoiInputRef : undefined}
                                type="text"
                                value={theaterVenue}
                                onChange={e => handleTheaterPoiSearch(e.target.value)}
                                onFocus={() => { if (theaterSuggestions.length > 0) setShowTheaterSuggestions(true); }}
                                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-purple-400"
                                placeholder="搜索演出地点..."
                              />
                              {showTheaterSuggestions && theaterSuggestions.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                                  {theaterSuggestions.map((poi: any, idx: number) => (
                                    <button
                                      key={poi.id || idx}
                                      type="button"
                                      onClick={() => handleTheaterPoiSelect(poi)}
                                      className="w-full text-left px-3 py-2.5 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                                    >
                                      <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{poi.name}</div>
                                      <div className="text-xs text-gray-400 mt-0.5">{poi.district}{poi.address}</div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            {theaterAddress && (
                              <div className="text-xs text-gray-400 flex items-center gap-1 px-1">
                                <MapPin size={10} />
                                <span>{theaterAddress}</span>
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                              👥 演出单位
                            </label>
                            <input 
                              type="text"
                              value={theaterUnit}
                              onChange={e => setTheaterUnit(e.target.value)}
                              className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-purple-400"
                              placeholder="如：剧团名称..."
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                            💺 座位
                          </label>
                          <input 
                            type="text"
                            value={theaterSeat}
                            onChange={e => setTheaterSeat(e.target.value)}
                            className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-purple-400"
                            placeholder="如：1排12座"
                          />
                        </div>
                      </>
                    )}

                    {/* Shared: Actors */}
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                        👥 参演卡司
                        <span className="text-[10px] font-normal text-gray-400 ml-1">多个演员请用空格分开</span>
                      </label>
                      <input 
                        type="text"
                        value={theaterActors}
                        onChange={e => setTheaterActors(e.target.value)}
                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-purple-400"
                        placeholder="例如：演员A 演员B 演员C"
                      />
                    </div>

                    {/* Shared: Price and Score */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                          🎫 票价
                        </label>
                        <input 
                          type="number"
                          value={theaterPrice}
                          onChange={e => setTheaterPrice(e.target.value)}
                          className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-purple-400"
                          placeholder="￥ 0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300">⭐ 打分评价</label>
                        <DecimalRating value={theaterScore} onChange={setTheaterScore} />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">🖼️ 附件图片 (可多选)</label>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed transition-all cursor-pointer border-gray-200 dark:border-gray-700 hover:border-purple-400`}>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          multiple
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length > 0) {
                              setNewImageFiles(prev => [...prev, ...files]);
                            }
                          }}
                        />
                        {isUploading ? (
                          <div className="w-4 h-4 border-2 border-purple-600/30 border-t-purple-600 rounded-full animate-spin" />
                        ) : (
                          <Camera size={18} className="text-gray-400" />
                        )}
                        <span className="text-xs font-bold text-gray-500">
                          {isUploading ? '上传中...' : ((existingImageUrls.length + newImageFiles.length) > 0 ? `已添加 ${existingImageUrls.length + newImageFiles.length} 张图片` : '添加图片')}
                        </span>
                      </label>
                    </div>

                    {/* Preview Gallery — existing cloud URLs */}
                    {(existingImageUrls.length > 0 || newImageFiles.length > 0) && (
                      <div className="flex flex-wrap gap-2.5 mt-1 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-800">
                        {existingImageUrls.map((img, idx) => (
                          <div key={`existing-${idx}`} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm cursor-zoom-in active:scale-95 transition-transform" onClick={() => onPreviewImage(img)}>
                            <img src={img} className="w-full h-full object-cover" alt="preview" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExistingImageUrls(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="absolute top-1 right-1 p-1 md:p-0.5 bg-red-600 text-white rounded-md md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-lg"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        {/* New (pending upload) files shown as local previews */}
                        {newImagePreviews.map((preview, idx) => (
                          <div key={`new-${idx}`} className="relative group w-16 h-16 rounded-lg overflow-hidden border-2 border-purple-300 dark:border-purple-600 shadow-sm cursor-zoom-in active:scale-95 transition-transform" onClick={() => onPreviewImage(preview)}>
                            <img src={preview} className="w-full h-full object-cover" alt="new preview" />
                            <div className="absolute bottom-0 left-0 right-0 h-3 bg-purple-500/60 flex items-center justify-center">
                              <span className="text-[8px] text-white font-bold">待传</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewImageFiles(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="absolute top-1 right-1 p-1 md:p-0.5 bg-red-600 text-white rounded-md md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-lg"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">📖 感想 (可选)</label>
                  <textarea
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    className="w-full min-h-[120px] p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-1 focus:ring-purple-400 outline-none transition-all placeholder:text-gray-400 text-sm text-slate-900 dark:text-slate-100 resize-none"
                    placeholder={activeTab === 'food' ? "例如：排了两小时终于吃上了…" : activeTab === 'theatre' ? "例如：今年看过最精彩的演出，舞台设计令人惊艳..." : activeTab === 'travel' ? "例如：在大自然中放松了身心…" : "例如：今天天气很好，玩得很开心…"}
                  />
                </div>

                <div className="space-y-1 mt-1">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">🎨 点缀颜色</label>
                  <div className="grid grid-cols-12 gap-1.5 px-1 pt-3 h-auto">
                    {defaultColors.map((color, i) => (
                      <button
                        key={i}
                        onClick={() => setSpecialColor(color)}
                        style={{ backgroundColor: color.bg }}
                        className={`aspect-square rounded-full border-2 transition-all ${specialColor.bg === color.bg ? 'border-purple-500 scale-125 shadow-md' : 'border-transparent hover:scale-110'}`}
                      >
                        {specialColor.bg === color.bg && <Check size={10} style={{ color: color.text }} className="mx-auto" />}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSaveSpecial}
                  disabled={!specialTitle.trim() || isUploading}
                  className="w-full py-4 bg-purple-600 disabled:bg-gray-400 text-white rounded-xl font-bold shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2"
                >
                  {isUploading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {isUploading ? '上传图片中...' : '保存记录'}
                </button>

                {editingRecord && editingRecord.record.type === 'special' && (
                  <div className="mt-3">
                    <button
                      onClick={() => {
                        onDeleteRecord(editingRecord.record.id, 'special');
                        setSpecialTitle('');
                        onClose();
                      }}
                      className="w-full py-3.5 bg-transparent border-2 border-red-50 text-red-500 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors"
                    >
                      删除此记录
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
