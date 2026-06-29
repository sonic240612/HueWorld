import { useTranslation } from 'react-i18next';
import { setLanguage } from '../../i18n';

const LANGUAGES = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'EN' },
  { code: 'ja', label: '日本語' },
];

export default function LanguageSelector() {
  const { i18n } = useTranslation();

  return (
    <div style={styles.container}>
      {LANGUAGES.map(lang => (
        <button
          key={lang.code}
          onClick={() => setLanguage(lang.code)}
          style={{
            ...styles.btn,
            color: i18n.language === lang.code ? '#fff' : '#666',
            fontWeight: i18n.language === lang.code ? 600 : 400,
          }}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    zIndex: 10,
    display: 'flex',
    gap: 4,
    background: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    padding: '4px 6px',
    backdropFilter: 'blur(4px)',
  },
  btn: {
    background: 'none',
    border: 'none',
    fontSize: 11,
    fontFamily: 'monospace',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 4,
    transition: 'all 0.15s ease',
  },
};
