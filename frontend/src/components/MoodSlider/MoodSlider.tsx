import { useState, useEffect } from 'react';
import { useMoodSlider } from '../../hooks/useMoodSlider';
interface MoodSliderProps {
  onMoodSubmit: (color: string) => void;
  coolDown: number;
  onColorChange?: (color: string) => void;
}

export default function MoodSlider({ onMoodSubmit, coolDown, onColorChange }: MoodSliderProps) {
  const { value, color, handleChange } = useMoodSlider(0.5);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => { onColorChange?.(color); }, [color, onColorChange]);
  const canSubmit = coolDown === 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 600);
    onMoodSubmit(color);
  };

  const progress = coolDown > 0 ? coolDown / 5 : 0;

  return (
    <div style={styles.container}>
      <div style={styles.label}>오늘의 기분은 어떤가요?</div>
      <div style={styles.sliderRow}>
        <span style={{ color: '#00FF00', ...styles.moodLabel }}>좋음</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={value}
          onChange={(e) => handleChange(Number(e.target.value))}
          style={{
            ...styles.slider,
            accentColor: color,
            background: `linear-gradient(to right, #00FF00, #FFFF00, #FF0000)`,
          }}
        />
        <span style={{ color: '#FF0000', ...styles.moodLabel }}>안좋음</span>
      </div>
      <div style={styles.previewRow}>
        <div
          style={{
            ...styles.colorPreview,
            backgroundColor: color,
            boxShadow: `0 0 ${submitted ? 40 : 20}px ${color}${submitted ? 'AA' : '66'}`,
            transform: submitted ? 'scale(1.3)' : 'scale(1)',
          }}
        />
        <span style={styles.hexLabel}>{color}</span>
      </div>
      <div style={styles.buttonRow}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            ...styles.submitButton,
            backgroundColor: canSubmit ? color : '#2A2A2A',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            transform: submitted ? 'scale(0.95)' : 'scale(1)',
          }}
        >
          {canSubmit ? (
            <span style={{ textShadow: '0 0 4px #000, 0 0 8px #000' }}>지금 기록하기</span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="3" width="10" height="10" rx="5" fill={color} opacity={1 - progress} />
              </svg>
              {coolDown}초 후 가능
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    bottom: 30,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(10, 10, 15, 0.85)',
    backdropFilter: 'blur(12px)',
    padding: '20px 32px',
    borderRadius: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    zIndex: 10,
    minWidth: 360,
    border: '1px solid rgba(255,255,255,0.08)',
  },
  label: {
    color: '#E0E0E0',
    fontSize: 16,
    fontWeight: 600,
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  slider: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    appearance: 'none',
    cursor: 'pointer',
    border: 'none',
    outline: 'none',
  },
  moodLabel: {
    fontSize: 12,
    fontWeight: 500,
    minWidth: 40,
    textAlign: 'center' as const,
  },
  previewRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    transition: 'all 0.3s ease',
  },
  hexLabel: {
    color: '#888',
    fontSize: 12,
    fontFamily: 'monospace',
    letterSpacing: '0.1em',
  },
  buttonRow: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  },
  submitButton: {
    color: '#fff',
    border: 'none',
    padding: '10px 28px',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    transition: 'all 0.2s ease',
    minWidth: 160,
  },
};
