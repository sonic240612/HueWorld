import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import type { CountryStat } from '../../types';

export default function CountryRanking() {
  const [countries, setCountries] = useState<CountryStat[]>([]);

  const fetchRanking = useCallback(async () => {
    try {
      const data = await api.getCountryRankings();
      setCountries(data.countries.slice(0, 10));
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchRanking();
    const interval = setInterval(fetchRanking, 30000);
    return () => clearInterval(interval);
  }, [fetchRanking]);

  return (
    <div style={styles.container}>
      <div style={styles.title}>Country Ranking</div>
      {countries.length === 0 && (
        <div style={styles.empty}>No data yet</div>
      )}
      {countries.map((c, i) => {
        const rank = i + 1;
        const barWidth = Math.min(100, c.pixel_count > 0 ? 60 : 0);
        return (
          <div key={c.country} style={styles.row}>
            <span style={styles.rank}>{rank}</span>
            <div style={styles.barTrack}>
              <div style={{
                ...styles.barFill,
                width: `${Math.max(4, barWidth)}%`,
                backgroundColor: c.avg_color,
                boxShadow: `0 0 6px ${c.avg_color}88`,
              }} />
            </div>
            <span style={styles.countryName}>{c.country}</span>
            <span style={styles.count}>{c.pixel_count}</span>
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
    marginBottom: 4,
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
  rank: {
    color: '#666',
    fontSize: 10,
    fontFamily: 'monospace',
    width: 16,
    textAlign: 'right' as const,
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
    transition: 'width 0.6s ease, background-color 0.6s ease',
  },
  countryName: {
    color: '#CCC',
    fontSize: 11,
    width: 80,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  count: {
    color: '#888',
    fontSize: 10,
    fontFamily: 'monospace',
    width: 24,
    textAlign: 'right' as const,
  },
};
