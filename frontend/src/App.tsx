import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import HueMap from './components/Map/HueMap';
import MoodSlider from './components/MoodSlider/MoodSlider';
import OnboardingOverlay from './components/Onboarding/OnboardingOverlay';
import GlobalMood from './components/Dashboard/GlobalMood';
import CountryRanking from './components/Dashboard/CountryRanking';
import RegionalMood from './components/Dashboard/RegionalMood';
import LanguageSelector from './components/LanguageSelector/LanguageSelector';
import LanguagePicker from './components/LanguagePicker/LanguagePicker';
import { hasSavedLanguage } from './i18n';
import { ToastProvider, useToast } from './components/common/Toast';
import { useGeolocation } from './hooks/useGeolocation';
import { usePixels } from './hooks/usePixels';
import { api } from './services/api';
import { applyJitter } from './utils/coordinates';
import type { Pixel, ViewportBounds } from './types';

function getSessionId(): string {
  let sid = sessionStorage.getItem('hueworld_session');
  if (sid) return sid;
  sid = crypto.randomUUID?.() ?? `${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
  sessionStorage.setItem('hueworld_session', sid);
  return sid;
}

function AppContent() {
  const { t } = useTranslation();
  const toast = useToast();
  const [languagePicked, setLanguagePicked] = useState(hasSavedLanguage());
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [coolDown, setCoolDown] = useState(0);
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const [localPixels, setLocalPixels] = useState<Pixel[]>([]);
  const [devMode, setDevMode] = useState(false);
  const [currentColor, setCurrentColor] = useState('#ffff00');
  const coolDownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { position: userPosition, error: geoError } = useGeolocation();
  const { pixels: serverPixels } = usePixels(viewportBounds);

  const allPixels = useMemo(() => {
    const serverIds = new Set(serverPixels.map(p => p.id));
    const kept = localPixels.filter(p => !serverIds.has(p.id));
    return [...kept, ...serverPixels];
  }, [localPixels, serverPixels]);

  const myPixelIds = useMemo(() => {
    return new Set(localPixels.map(p => p.id));
  }, [localPixels]);

  const placePixel = useCallback((lat: number, lng: number, color: string) => {
    const sid = getSessionId();
    const jittered = applyJitter(lat, lng, 100);
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const localPixel: Pixel = {
      id: tempId,
      lat: jittered.lat,
      lng: jittered.lng,
      color,
      session_id: sid,
      created_at: new Date().toISOString(),
      isMine: true,
    };
    setLocalPixels(prev => [...prev.slice(-200), localPixel]);
    api.submitPixel(jittered.lat, jittered.lng, color, sid)
      .then((result) => {
        setLocalPixels(prev => prev.map(p => p.id === tempId ? { ...p, id: result.id } : p));
        toast.show(t('toast.success'), 'success');
      })
      .catch((err: Error) => {
        if (err.message.includes('502') || err.message.includes('Network')) {
          toast.show(t('toast.backendError'), 'error');
        } else if (err.message.includes('429')) {
          toast.show(t('toast.rateLimit'), 'info');
        } else {
          toast.show(t('toast.saveError', { message: err.message }), 'error');
        }
      });
  }, [toast]);

  const handleMoodSubmit = useCallback((color: string) => {
    if (!userPosition || coolDown > 0) return;
    setCoolDown(5);
    if (coolDownRef.current) clearInterval(coolDownRef.current);
    coolDownRef.current = setInterval(() => {
      setCoolDown(prev => {
        if (prev <= 1) {
          if (coolDownRef.current) clearInterval(coolDownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    placePixel(userPosition.lat, userPosition.lng, color);
  }, [userPosition, coolDown, placePixel]);

  const handleDevPlacePixel = useCallback((lat: number, lng: number) => {
    placePixel(lat, lng, currentColor);
  }, [currentColor, placePixel]);

  const handleMapMove = useCallback((bounds: ViewportBounds) => {
    setViewportBounds(bounds);
  }, []);

  useEffect(() => {
    return () => {
      if (coolDownRef.current) clearInterval(coolDownRef.current);
    };
  }, []);

  useEffect(() => {
    document.title = t('app.title');
  }, [t]);

  useEffect(() => {
    if (geoError) toast.show(geoError, 'error');
  }, [geoError, toast]);

  return (
    <div style={styles.app}>
      {!languagePicked && (
        <LanguagePicker onDone={() => setLanguagePicked(true)} />
      )}

      {languagePicked && !onboardingDone && (
        <OnboardingOverlay onComplete={() => setOnboardingDone(true)} />
      )}

      <HueMap
        center={userPosition}
        pixels={allPixels}
        myPixelIds={myPixelIds}
        devMode={devMode}
        onMapMove={handleMapMove}
        onDevPlacePixel={handleDevPlacePixel}
      />

      <div style={styles.header}>
        <span style={styles.logo}>HueWorld</span>
        <button
          onClick={() => setDevMode(v => !v)}
          style={{
            ...styles.devBtn,
            background: devMode ? '#ff4444' : 'transparent',
          }}
        >
          {t('header.dev')}
        </button>
      </div>

      <LanguageSelector />

      <div style={styles.dashboard}>
        <GlobalMood viewportPixels={allPixels} viewportBounds={viewportBounds} />
        <div style={styles.divider} />
        <RegionalMood viewportBounds={viewportBounds} />
        <div style={styles.divider} />
        <CountryRanking />
      </div>

      <MoodSlider onMoodSubmit={handleMoodSubmit} coolDown={coolDown} onColorChange={setCurrentColor} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    width: '100vw',
    height: '100vh',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#0A0A0F',
  },
  header: {
    position: 'absolute',
    top: 16,
    left: 24,
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: '0.05em',
  },
  dashboard: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 220,
    maxHeight: 'calc(100vh - 200px)',
    overflowY: 'auto' as const,
    scrollbarWidth: 'thin' as const,
    scrollbarColor: 'rgba(255,255,255,0.1) transparent',
    background: 'rgba(10, 10, 15, 0.8)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  divider: {
    height: 1,
    background: 'rgba(255,255,255,0.06)',
    margin: '0 12px',
  },
  devBtn: {
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 10,
    fontFamily: 'monospace',
    cursor: 'pointer',
    letterSpacing: '0.05em',
  },
};
