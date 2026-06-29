export interface Pixel {
  id: string;
  lat: number;
  lng: number;
  color: string;
  session_id: string;
  created_at: string;
  isMine?: boolean;
}

export interface GeoPosition {
  lat: number;
  lng: number;
}

export interface ViewportBounds {
  sw_lat: number;
  sw_lng: number;
  ne_lat: number;
  ne_lng: number;
}

export interface GlobalStats {
  avg_color: string;
  pixel_count: number;
}

export interface ViewportStats {
  dominant_color: string;
  color_distribution: { color: string; count: number }[];
}

export interface CountryStat {
  country: string;
  avg_color: string;
  pixel_count: number;
}

export interface RegionStats {
  avg_color: string;
  pixel_count: number;
  color_distribution: { color: string; count: number }[];
}
