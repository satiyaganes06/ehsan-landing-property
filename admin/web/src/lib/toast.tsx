import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface Toast { id: number; kind: 'success' | 'error' | 'info'; message: string }
interface ToastApi { push: (kind: Toast['kind'], message: string) => void }

const ToastCtx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="toast">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-item${t.kind === 'error' ? ' toast-item--error' : t.kind === 'success' ? ' toast-item--success' : ''}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
