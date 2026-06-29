import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoPosition, Pixel } from '../../types';
import { DEFAULT_ZOOM, AGGREGATION_ZOOM_THRESHOLD } from '../../constants';
import { snapToGrid, cellsToPoints } from '../../utils/aggregation';

const PIXEL_ICON = 'led-pixel';

interface HueMapProps {
  center: GeoPosition | null;
  pixels: Pixel[];
  myPixelIds: Set<string>;
  devMode?: boolean;
  onMapMove?: (bounds: { sw_lat: number; sw_lng: number; ne_lat: number; ne_lng: number }) => void;
  onDevPlacePixel?: (lat: number, lng: number) => void;
}

function updateMapData(map: maplibregl.Map, zoom: number, pixels: Pixel[], myPixelIds: Set<string>) {
  const source = map.getSource('pixels') as maplibregl.GeoJSONSource;
  if (!source) return;

  const cells = snapToGrid(pixels, zoom);
  const features = cellsToPoints(cells, myPixelIds);
  source.setData(features);
}

function createPixelIcon(map: maplibregl.Map) {
  if (map.hasImage(PIXEL_ICON)) return;
  const size = 6;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 1;
  ctx.fillRect(0, 0, size, size);
  map.addImage(PIXEL_ICON, ctx.getImageData(0, 0, size, size), { sdf: true });
}

export default function HueMap({ center, pixels, myPixelIds, devMode, onMapMove, onDevPlacePixel }: HueMapProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pixelsRef = useRef(pixels);
  const mineRef = useRef(myPixelIds);
  const cbRef = useRef(onMapMove);
  const devPlaceRef = useRef(onDevPlacePixel);

  pixelsRef.current = pixels;
  mineRef.current = myPixelIds;
  cbRef.current = onMapMove;
  devPlaceRef.current = devMode ? onDevPlacePixel : undefined;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: center ? [center.lng, center.lat] : [0, 20],
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    map.on('error', (e) => console.error('Map error:', e.error?.message || e));
    map.on('styleimagerror', (e) => console.warn('Style image load error:', e.id));

    map.on('load', () => {
      createPixelIcon(map);

      map.addSource('pixels', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'led-grid-glow',
        type: 'circle',
        source: 'pixels',
        maxzoom: AGGREGATION_ZOOM_THRESHOLD,
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['exponential', 0.5], ['zoom'],
            0, 16,
            1, 14,
            2, 12,
            3, 10,
            4, 8,
            5, 6,
          ],
          'circle-blur': ['interpolate', ['linear'], ['zoom'],
            0, 1.2,
            5, 0.4,
          ],
          'circle-opacity': ['*',
            ['get', 'opacity'],
            ['interpolate', ['linear'], ['zoom'], 0, 0.45, 5, 0.25],
          ],
        },
      });

      map.addLayer({
        id: 'led-grid-core',
        type: 'symbol',
        source: 'pixels',
        maxzoom: AGGREGATION_ZOOM_THRESHOLD,
        layout: {
          'icon-image': PIXEL_ICON,
          'icon-size': 1.25,
          'icon-allow-overlap': true,
        },
        paint: {
          'icon-color': ['get', 'color'],
          'icon-opacity': ['*', ['get', 'opacity'], 0.95],
        },
      });

      map.addLayer({
        id: 'led-pixels',
        type: 'symbol',
        source: 'pixels',
        minzoom: AGGREGATION_ZOOM_THRESHOLD,
        layout: {
          'icon-image': PIXEL_ICON,
          'icon-size': 1.5,
          'icon-allow-overlap': true,
        },
        paint: {
          'icon-color': ['get', 'color'],
          'icon-opacity': ['*',
            ['get', 'opacity'],
            ['case', ['==', ['get', 'isMine'], 1], 1.0, 0.85],
          ],
        },
      });

      const z = map.getZoom();
      setCurrentZoom(z);
      updateMapData(map, z, pixelsRef.current, mineRef.current);
    });

    map.on('click', (e) => {
      const dev = devPlaceRef.current;
      if (dev) dev(e.lngLat.lat, e.lngLat.lng);
    });

    map.on('zoomend', () => {
      const z = map.getZoom();
      setCurrentZoom(z);
      updateMapData(map, z, pixelsRef.current, mineRef.current);
    });

    map.on('moveend', () => {
      const cb = cbRef.current;
      if (!cb) return;
      const b = map.getBounds();
      cb({
        sw_lat: b.getSouth(),
        sw_lng: b.getWest(),
        ne_lat: b.getNorth(),
        ne_lng: b.getEast(),
      });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('pixels')) return;
    const zoom = map.getZoom();
    updateMapData(map, zoom, pixels, myPixelIds);
  }, [pixels, myPixelIds]);

  useEffect(() => {
    if (!center || !mapRef.current) return;
    mapRef.current.flyTo({ center: [center.lng, center.lat], zoom: 12, duration: 2000 });
  }, [center]);

  const gridMode = currentZoom < AGGREGATION_ZOOM_THRESHOLD;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: devMode ? 'crosshair' : undefined }} />
      <div style={{
        position: 'absolute', bottom: 12, right: 56,
        background: 'rgba(0,0,0,0.7)', color: '#aaa',
        padding: '4px 10px', borderRadius: 4,
        fontFamily: 'monospace', fontSize: 12, zIndex: 10,
        pointerEvents: 'none',
      }}>
        {t('map.zoom', { zoom: currentZoom.toFixed(1) })}{gridMode ? ` · ${t('map.grid')}` : ` · ${t('map.points')}`}
      </div>
    </div>
  );
}
