import { useState, useEffect } from 'react';
import type { GeoPosition } from '../types';
import { DEFAULT_CENTER } from '../constants';

interface GeolocationState {
  position: GeoPosition | null;
  loading: boolean;
  error: string | null;
}

export function useGeolocation(): GeolocationState {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({
        position: DEFAULT_CENTER,
        loading: false,
        error: 'Geolocation not supported',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          loading: false,
          error: null,
        });
      },
      () => {
        setState({
          position: DEFAULT_CENTER,
          loading: false,
          error: '위치 권한이 거부되었습니다. 기본 위치(서울)에서 시작합니다.',
        });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, []);

  return state;
}
