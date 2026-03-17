import React, { useEffect, useRef, useMemo } from 'react';
import type { EventRecord, FoodMetadata } from '../types';

interface FoodMapProps {
  records: EventRecord[];
}

// AMap Security Config
if (typeof window !== 'undefined') {
  (window as any)._AMapSecurityConfig = {
    securityJsCode: '9ec70dc2db7d42cc92feb1a2b825e22f',
  };
}

const AMAP_KEY = 'cd4b3bc21146d9163337e1e174b8cc8a';

// Custom marker HTML with orange pin styling
const createMarkerContent = (_name: string, rating?: number) => {
  const label = rating ? `⭐ ${rating.toFixed(1)}` : '🍽️';
  
  const div = document.createElement('div');
  div.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
  `;
  div.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #f59e0b, #ea580c);
      color: white;
      padding: 5px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 900;
      font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
      white-space: nowrap;
      border: 2px solid white;
      box-shadow: 0 2px 8px rgba(245,158,11,0.3);
      letter-spacing: -0.3px;
    ">
      ${label}
    </div>
    <div style="
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 8px solid #ea580c;
      margin-top: -1px;
    "></div>
  `;
  return div;
};

export const FoodMap: React.FC<FoodMapProps> = ({ records }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  // Extract food records with location data
  const foodPoints = useMemo(() => {
    const points = records
      .filter(r => r.parent_tag === '美食模式')
      .map(r => {
        const extra = r.extra_data as FoodMetadata | undefined;
        if (!extra) return null;
        // Debug: log each food record's raw coordinate data
        console.log('[FoodMap] Record:', extra.restaurant || r.title, '| lat:', extra.lat, '(type:', typeof extra.lat, ') | lng:', extra.lng, '(type:', typeof extra.lng, ') | address:', extra.address);
        return {
          name: extra.restaurant || r.title || '未知店铺',
          address: extra.address || '',
          rating: extra.rating,
          price: extra.price,
          lat: extra.lat,
          lng: extra.lng,
        };
      })
      .filter(Boolean) as { name: string; address: string; rating?: number; price?: number; lat?: number; lng?: number }[];
    return points;
  }, [records]);

  // Points with valid numeric coordinates
  const geoPoints = useMemo(() => {
    const pts = foodPoints.filter(p => typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng));
    console.log('[FoodMap] geoPoints (will show on map):', pts.map(p => `${p.name}: [${p.lat}, ${p.lng}]`));
    return pts;
  }, [foodPoints]);

  // Build InfoWindow content HTML
  const buildInfoContent = (point: typeof foodPoints[0]) => {
    const stars = point.rating
      ? Array.from({ length: 5 }, (_, i) =>
          `<span style="color:${i < Math.round(point.rating!) ? '#f59e0b' : '#e5e7eb'}; font-size:16px; line-height:1;">★</span>`
        ).join('')
      : '';

    return `
      <div style="
        padding: 16px 20px;
        min-width: 220px;
        max-width: 280px;
        font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;
        line-height: 1.6;
        color: #334155;
      ">
        <div style="font-size:16px; font-weight:800; color:#1e293b; margin-bottom:10px; letter-spacing:-0.3px;">
          ${point.name}
        </div>
        ${point.address ? `
          <div style="font-size:12px; color:#94a3b8; margin-bottom:8px; display:flex; align-items:flex-start; gap:5px;">
            <span style="flex-shrink:0;">📍</span>
            <span>${point.address}</span>
          </div>
        ` : ''}
        ${point.rating ? `
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
            ${stars}
            <span style="font-size:16px; font-weight:900; color:#f59e0b; margin-left:2px;">${point.rating.toFixed(1)}</span>
          </div>
        ` : ''}
        ${point.price ? `
          <div style="font-size:14px; color:#ea580c; font-weight:700;">
            💰 价格 ￥${point.price}
          </div>
        ` : ''}
      </div>
    `;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const loadAndInit = () => {
      const AMap = (window as any).AMap;
      if (!AMap) return;

      AMap.plugin(['AMap.MarkerCluster', 'AMap.InfoWindow'], () => {
        // Create map
        const map = new AMap.Map(containerRef.current, {
          zoom: 4,
          center: [104.0, 35.0],
          mapStyle: 'amap://styles/whitesmoke',
          resizeEnable: true,
        });
        mapRef.current = map;

        // Create shared InfoWindow
        const infoWindow = new AMap.InfoWindow({
          isCustom: false,
          offset: new AMap.Pixel(0, -36),
          autoMove: true,
        });

        console.log('[FoodMap] Total food points:', foodPoints.length);
        console.log('[FoodMap] Points with coordinates (shown on map):', geoPoints.length);

        if (geoPoints.length === 0) return;

        const markers: any[] = [];

        // Only show records with real POI-selected coordinates
        geoPoints.forEach((point) => {
          const marker = new AMap.Marker({
            position: new AMap.LngLat(point.lng!, point.lat!),
            content: createMarkerContent(point.name, point.rating),
            anchor: 'bottom-center',
          });
          marker.on('mouseover', () => {
            infoWindow.setContent(buildInfoContent(point));
            infoWindow.open(map, marker.getPosition());
          });
          marker.on('click', () => {
            infoWindow.setContent(buildInfoContent(point));
            infoWindow.open(map, marker.getPosition());
          });
          map.add(marker);
          markers.push(marker);
        });

        map.setFitView(null, false, [60, 60, 60, 60]);
      });
    };

    // Load AMap script if not loaded
    const scriptId = 'amap-js-sdk';
    if (document.getElementById(scriptId)) {
      if ((window as any).AMap) {
        loadAndInit();
      } else {
        const interval = setInterval(() => {
          if ((window as any).AMap) {
            clearInterval(interval);
            loadAndInit();
          }
        }, 100);
        setTimeout(() => clearInterval(interval), 5000);
      }
    } else {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}`;
      script.async = true;
      script.onload = loadAndInit;
      document.head.appendChild(script);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [geoPoints, foodPoints]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: 300, borderRadius: 12, overflow: 'hidden' }}
    />
  );
};
