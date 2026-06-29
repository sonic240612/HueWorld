import { useState, useCallback, createContext, useContext, type ReactNode } from 'react';

interface ToastMessage {
  id: number;
  text: string;
  type: 'info' | 'error' | 'success';
}

interface ToastCtx {
  show: (text: string, type?: ToastMessage['type']) => void;
}

const ToastContext = createContext<ToastCtx>({ show: () => {} });

export const useToast = () => useContext(ToastContext);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const show = useCallback((text: string, type: ToastMessage['type'] = 'info') => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div style={styles.container}>
        {toasts.map(t => (
          <div key={t.id} style={{
            ...styles.toast,
            borderColor: t.type === 'error' ? '#FF4444' : t.type === 'success' ? '#44FF44' : '#4488FF',
            color: t.type === 'error' ? '#FF6666' : t.type === 'success' ? '#66FF66' : '#88BBFF',
          }}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 70,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 2000,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  toast: {
    background: 'rgba(10, 10, 15, 0.9)',
    backdropFilter: 'blur(12px)',
    border: '1px solid',
    borderRadius: 10,
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    pointerEvents: 'auto',
  },
};
