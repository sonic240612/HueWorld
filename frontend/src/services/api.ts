import { API_BASE_URL } from '../constants';
import type { Pixel, GlobalStats, ViewportStats, RegionStats, CountryStat } from '../types';
import type { ViewportBounds } from '../types';

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch (err) {
    throw new Error(`Network: ${(err as Error).message}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const api = {
  submitPixel(lat: number, lng: number, color: string, sessionId: string) {
    return fetchJson<{ id: string; success: boolean }>('/pixels', {
      method: 'POST',
      body: JSON.stringify({ lat, lng, color, session_id: sessionId }),
    });
  },

  getPixelsInBbox(bbox: ViewportBounds, limit = 5000, since?: string | null) {
    const params = new URLSearchParams({
      sw_lat: String(bbox.sw_lat), sw_lng: String(bbox.sw_lng),
      ne_lat: String(bbox.ne_lat), ne_lng: String(bbox.ne_lng),
      limit: String(limit),
    });
    if (since) params.set('since', since);
    return fetchJson<{ pixels: Pixel[] }>(`/pixels?${params}`);
  },

  getGlobalStats() {
    return fetchJson<GlobalStats>('/stats/global');
  },

  getViewportStats(bbox: ViewportBounds) {
    const params = new URLSearchParams({
      sw_lat: String(bbox.sw_lat), sw_lng: String(bbox.sw_lng),
      ne_lat: String(bbox.ne_lat), ne_lng: String(bbox.ne_lng),
    });
    return fetchJson<ViewportStats>(`/stats/viewport?${params}`);
  },

  getCountryRankings() {
    return fetchJson<{ countries: CountryStat[] }>('/stats/countries');
  },

  getRegionStats(lat: number, lng: number, radiusKm: number) {
    const params = new URLSearchParams({
      lat: String(lat), lng: String(lng), radius_km: String(radiusKm),
    });
    return fetchJson<RegionStats>(`/stats/region?${params}`);
  },
};
