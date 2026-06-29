import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { classifyMood } from '../../utils/color';
import type { ViewportBounds } from '../../types';

const CATEGORIES = ['Good', 'Okay', 'Bad'] as const;
const BIN_COLORS: Record<string, string> = { Good: '#00FF00', Okay: '#FFFF00', Bad: '#FF0000' };

interface RegionalMoodProps {
  viewportBounds: ViewportBounds | null;
}

interface RegionData {
  avg_color: string;
  pixel_count: number;
  color_distribution: { color: string; count: number }[];
}

export default function RegionalMood({ viewportBounds }: RegionalMoodProps) {
  const [data, setData] = useState<RegionData | null>(null);

  const fetchRegion = useCallback(async () => {
    if (!viewportBounds) return;
    try {
      const { sw_lat, sw_lng, ne_lat, ne_lng } = viewportBounds;
      const centerLat = (sw_lat + ne_lat) / 2;
      const centerLng = (sw_lng + ne_lng) / 2;
      const dlat = (ne_lat - sw_lat) / 2;
      const dlng = (ne_lng - sw_lng) / 2;
      const radiusKm = Math.max(
        dlat * 111.32,
        dlng * 111.32 * Math.abs(Math.cos(centerLat * Math.PI / 180)) || 1,
      );
      const region = await api.getRegionStats(centerLat, centerLng, Math.ceil(radiusKm));
      setData(region);
    } catch {
      // silent
    }
  }, [viewportBounds]);

  useEffect(() => {
    fetchRegion();
  }, [fetchRegion]);

const bins = CATEGORIES.map(label => {
    let count = 0;
    if (data) {
      for (const d of data.color_distribution) {
        if (classifyMood(d.color).label === label) count += d.count;
      }
    }
    return { label, count, hex: BIN_COLORS[label] };
  });

  const total = data?.pixel_count ?? 0;

  if (!data || total === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.title}>Distribution</div>
        <div style={styles.empty}>No data in this area</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.title}>Distribution</div>
      {bins.map(b => {
        const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
        return (
          <div key={b.label} style={styles.row}>
            <div style={{ ...styles.dot, backgroundColor: b.hex }} />
            <span style={styles.label}>{b.label}</span>
            <div style={styles.barTrack}>
              <div style={{
                ...styles.barFill,
                width: `${pct}%`,
                backgroundColor: b.hex,
                boxShadow: `0 0 6px ${b.hex}88`,
              }} />
            </div>
            <span style={styles.pct}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  title: {
    color: '#B0B0B0',
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: '0.05em',
    marginBottom: 2,
  },
  empty: {
    color: '#555',
    fontSize: 11,
    fontStyle: 'italic',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  label: {
    color: '#CCC',
    fontSize: 11,
    width: 36,
  },
  barTrack: {
    flex: 1,
    height: 6,
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.6s ease, box-shadow 0.6s ease',
  },
  pct: {
    color: '#888',
    fontSize: 10,
    fontFamily: 'monospace',
    width: 28,
    textAlign: 'right' as const,
  },
};
