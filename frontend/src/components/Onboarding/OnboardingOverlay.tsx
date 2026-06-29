import { useState } from 'react';

interface OnboardingOverlayProps {
  onComplete: () => void;
}

export default function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  const [visible, setVisible] = useState(true);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: 'HueWorld',
      subtitle: '지금, 당신이 있는 그곳의 색깔은 무엇인가요?',
      description: '전 세계 사람들의 감정이 LED로 빛나는 실시간 글로벌 감정 지도',
    },
    {
      title: '위치를 알려주세요',
      subtitle: '당신의 위치를 기반으로 지도에 감정을 기록합니다',
      description: '정확한 위치는 저장되지 않으며, 약간의 오차를 더해 익명성을 보호합니다',
    },
    {
      title: '기분을 선택하세요',
      subtitle: '슬라이더로 지금 기분을 색깔로 표현해보세요',
      description: '초록(좋음) → 노랑(보통) → 빨강(안좋음)',
    },
  ];

  const current = steps[step];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(s => s + 1);
    } else {
      setVisible(false);
      onComplete();
    }
  };

  if (!visible) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.stepIndicator}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.dot,
                backgroundColor: i === step ? '#fff' : 'rgba(255,255,255,0.3)',
              }}
            />
          ))}
        </div>
        <div style={styles.title}>{current.title}</div>
        <div style={styles.subtitle}>{current.subtitle}</div>
        <div style={styles.description}>{current.description}</div>
        <button type="button" onClick={handleNext} style={styles.button}>
          {step < steps.length - 1 ? '다음' : '시작하기'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  card: {
    background: 'rgba(20, 20, 30, 0.95)',
    borderRadius: 24,
    padding: '40px 36px',
    maxWidth: 400,
    width: '90%',
    textAlign: 'center' as const,
    border: '1px solid rgba(255,255,255,0.1)',
  },
  stepIndicator: {
    display: 'flex',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    transition: 'all 0.3s ease',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 12,
  },
  subtitle: {
    color: '#B0B0B0',
    fontSize: 16,
    marginBottom: 8,
  },
  description: {
    color: '#888',
    fontSize: 14,
    lineHeight: 1.5,
    marginBottom: 32,
  },
  button: {
    background: 'linear-gradient(135deg, #00FF00, #FFFF00, #FF0000)',
    color: '#000',
    border: 'none',
    padding: '12px 40px',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
  },
};
