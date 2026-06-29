import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { hexToRgb, rgbToHex } from '../../utils/color';
import type { ViewportBounds, Pixel } from '../../types';

interface GlobalMoodProps {
  viewportPixels: Pixel[];
  viewportBounds: ViewportBounds | null;
}

function blendColors(c1: string, c2: string, t: number): string {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  return rgbToHex(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t,
  );
}

export default function GlobalMood({ viewportPixels, viewportBounds }: GlobalMoodProps) {
  const [globalAvg, setGlobalAvg] = useState('#888888');
  const [viewportDominant, setViewportDominant] = useState('#888888');

  const fetchGlobal = useCallback(async () => {
    try {
      const stats = await api.getGlobalStats();
      setGlobalAvg(stats.avg_color);
    } catch {
      // keep previous value
    }
  }, []);

  const fetchViewport = useCallback(async () => {
    if (!viewportBounds) return;
    try {
      const stats = await api.getViewportStats(viewportBounds);
      setViewportDominant(stats.dominant_color);
    } catch {
      // fallback: keep previous value
    }
  }, [viewportBounds, viewportPixels]);

  useEffect(() => {
    fetchGlobal();
    const interval = setInterval(fetchGlobal, 30000);
    return () => clearInterval(interval);
  }, [fetchGlobal]);

  useEffect(() => {
    fetchViewport();
  }, [fetchViewport]);

  const midColor = blendColors(globalAvg, viewportDominant, 0.5);

  return (
    <div style={styles.container}>
      <div
        title={`Global: ${globalAvg} | Viewport: ${viewportDominant}`}
        style={{
          ...styles.led,
          background: `radial-gradient(
            circle at 50% 50%,
            ${globalAvg} 0%,
            ${globalAvg} 35%,
            ${midColor} 60%,
            ${viewportDominant} 85%,
            transparent 100%
          )`,
          boxShadow: `0 0 30px ${viewportDominant}66`,
        }}
      />
      <div style={styles.spillWrapper}>
        <div
          style={{
            ...styles.spill,
            background: `radial-gradient(
              ellipse at 50% 0%,
              ${viewportDominant}44 0%,
              transparent 70%
            )`,
          }}
        />
      </div>
      <div style={styles.label}>Global Mood</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '16px 16px 0',
  },
  led: {
    width: 100,
    height: 100,
    borderRadius: '50%',
    transition: 'background 0.8s ease-in-out, box-shadow 0.8s ease-in-out',
  },
  spillWrapper: {
    position: 'relative',
    width: 100,
    height: 20,
    marginTop: -10,
    overflow: 'hidden',
  },
  spill: {
    width: '100%',
    height: '100%',
    transition: 'background 0.8s ease-in-out',
  },
  label: {
    color: '#B0B0B0',
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: '0.05em',
    marginTop: 4,
  },
};
