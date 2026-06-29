export const MOOD_COLORS = {
  GOOD: '#00FF00',
  OK: '#FFFF00',
  BAD: '#FF0000',
} as const;

export const COOLDOWN_SECONDS = 5;
export const PIXEL_TTL_HOURS = 24;
export const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };
export const DEFAULT_ZOOM = 2;
export const AGGREGATION_ZOOM_THRESHOLD = 6;
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
