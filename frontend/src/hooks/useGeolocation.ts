import { useState, useEffect } from 'react';
import type { GeoPosition } from '../types';
import { DEFAULT_CENTER } from '../constants';
import i18n from '../i18n';

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
        error: i18n.t('geolocation.notSupported'),
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
          error: i18n.t('geolocation.denied'),
        });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, []);

  return state;
}
