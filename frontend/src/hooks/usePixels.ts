import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { subscribePixels } from '../services/supabase';
import type { Pixel } from '../types';
import type { ViewportBounds } from '../types';

const POLL_INTERVAL_MS = 5000;

export function usePixels(bbox: ViewportBounds | null) {
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [loading, setLoading] = useState(false);
  const latestTsRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchInitial = useCallback(async () => {
    if (!bbox) return;
    setLoading(true);
    try {
      const data = await api.getPixelsInBbox(bbox);
      setPixels(data.pixels);
      if (data.pixels.length > 0) {
        latestTsRef.current = data.pixels.reduce((a, b) =>
          a.created_at > b.created_at ? a : b
        ).created_at;
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [bbox]);

  const fetchIncremental = useCallback(async () => {
    if (!bbox) return;
    try {
      const data = await api.getPixelsInBbox(bbox, 5000, latestTsRef.current);
      if (data.pixels.length > 0) {
        setPixels(prev => {
          const existing = new Set(prev.map(p => p.id));
          const newPixels = data.pixels.filter(p => !existing.has(p.id));
          if (newPixels.length === 0) return prev;
          return [...newPixels, ...prev].slice(0, 5000);
        });
        latestTsRef.current = data.pixels.reduce((a, b) =>
          a.created_at > b.created_at ? a : b
        ).created_at;
      }
    } catch {
      // silent
    }
  }, [bbox]);

  // Full fetch when bbox changes
  useEffect(() => {
    fetchInitial();
    latestTsRef.current = null;
  }, [fetchInitial]);

  // Polling for incremental updates
  useEffect(() => {
    if (!bbox) return;
    pollRef.current = setInterval(fetchIncremental, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [bbox, fetchIncremental]);

  // Supabase Realtime subscription (supplemental)
  useEffect(() => {
    const unsubscribe = subscribePixels((newPixel: Pixel) => {
      setPixels(prev => {
        if (prev.some(p => p.id === newPixel.id)) return prev;
        return [newPixel, ...prev].slice(0, 5000);
      });
    });
    return unsubscribe;
  }, []);

  return { pixels, loading, refetch: fetchInitial };
}
