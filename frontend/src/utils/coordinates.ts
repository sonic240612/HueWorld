import type { ViewportBounds } from '../types';

export function applyJitter(lat: number, lng: number, maxMeters = 100): { lat: number; lng: number } {
  const offsetDeg = maxMeters / 111_320;
  return {
    lat: lat + (Math.random() - 0.5) * 2 * offsetDeg,
    lng: lng + (Math.random() - 0.5) * 2 * offsetDeg,
  };
}

export function gridSnap(lat: number, lng: number, zoom: number): { lat: number; lng: number } {
  const gridSize = 360 / Math.pow(2, zoom);
  return {
    lat: Math.round(lat / gridSize) * gridSize,
    lng: Math.round(lng / gridSize) * gridSize,
  };
}

export function toBoundsQuery(
  sw_lat: number, sw_lng: number, ne_lat: number, ne_lng: number,
): ViewportBounds {
  return { sw_lat, sw_lng, ne_lat, ne_lng };
}
