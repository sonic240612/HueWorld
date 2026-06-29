import { averageColors } from './color';
import { getPixelOpacity } from './decay';
import type { Pixel } from '../types';
import { AGGREGATION_ZOOM_THRESHOLD } from '../constants';

export interface GridCell {
  lat: number;
  lng: number;
  color: string;
  count: number;
  pixelIds: string[];
  maxCreatedAt: string;
}

type GeojsonFeatureCollection = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    id?: string;
    geometry: {
      type: 'Point';
      coordinates: [number, number];
    };
    properties: Record<string, any>;
  }[];
};

const SNAP_RES = 1 / 9;

export function snapToGrid(pixels: Pixel[], zoom: number): GridCell[] {
  const snap = zoom < AGGREGATION_ZOOM_THRESHOLD;
  const map = new Map<string, { ids: string[]; colors: string[]; lat: number; lng: number; maxTs: string }>();

  for (const p of pixels) {
    const cellLat = snap ? Math.round(p.lat / SNAP_RES) * SNAP_RES : p.lat;
    const cellLng = snap ? Math.round(p.lng / SNAP_RES) * SNAP_RES : p.lng;
    const key = snap ? `${cellLat},${cellLng}` : p.id;

    let existing = map.get(key);
    if (!existing) {
      existing = { ids: [], colors: [], lat: cellLat, lng: cellLng, maxTs: p.created_at };
      map.set(key, existing);
    }
    existing.ids.push(p.id);
    existing.colors.push(p.color);
    if (p.created_at > existing.maxTs) existing.maxTs = p.created_at;
  }

  return Array.from(map.entries()).map(([, value]) => ({
    lat: value.lat,
    lng: value.lng,
    color: averageColors(value.colors),
    count: value.colors.length,
    pixelIds: value.ids,
    maxCreatedAt: value.maxTs,
  }));
}

export function cellsToPoints(cells: GridCell[], myPixelIds?: Set<string>): GeojsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: cells.map(cell => ({
      type: 'Feature',
      id: cell.count === 1 ? cell.pixelIds[0] : undefined,
      geometry: { type: 'Point', coordinates: [cell.lng, cell.lat] },
      properties: {
        color: cell.color,
        count: cell.count,
        opacity: getPixelOpacity(cell.maxCreatedAt),
        isMine: myPixelIds && cell.pixelIds.some(id => myPixelIds.has(id)) ? 1 : 0,
      },
    })),
  };
}
