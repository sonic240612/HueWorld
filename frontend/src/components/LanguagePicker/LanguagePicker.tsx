import { setLanguage } from '../../i18n';

const LANGUAGES = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
];

interface LanguagePickerProps {
  onDone: () => void;
}

export default function LanguagePicker({ onDone }: LanguagePickerProps) {
  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.title}>HueWorld</div>
        <div style={styles.subtitle}>Choose your language / 언어를 선택하세요 / 言語を選択してください</div>
        <div style={styles.buttons}>
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => { setLanguage(lang.code); onDone(); }}
              style={styles.btn}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    backdropFilter: 'blur(8px)',
  },
  card: {
    background: 'rgba(20, 20, 30, 0.95)',
    borderRadius: 24,
    padding: '48px 40px',
    maxWidth: 360,
    width: '90%',
    textAlign: 'center' as const,
    border: '1px solid rgba(255,255,255,0.1)',
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 700,
    marginBottom: 12,
    letterSpacing: '0.05em',
  },
  subtitle: {
    color: '#888',
    fontSize: 13,
    marginBottom: 32,
    lineHeight: 1.5,
  },
  buttons: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  },
  btn: {
    background: 'rgba(255,255,255,0.06)',
    color: '#E0E0E0',
    border: '1px solid rgba(255,255,255,0.12)',
    padding: '14px 0',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
};
