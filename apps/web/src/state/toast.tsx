import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

type ToastKind = 'success' | 'warning' | 'error' | 'info';

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastContextValue {
  push: (t: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push: ToastContextValue['push'] = (t) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next: ToastItem = { id, ...t };
    setItems((prev) => [next, ...prev].slice(0, 4));
    window.setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, 2800);
  };

  const value = useMemo(() => ({ push }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`rounded-xl border p-4 shadow-xl backdrop-blur-sm animate-in slide-in-from-bottom-2 duration-300 ${t.kind === 'success'
                ? 'border-emerald-500/30 bg-emerald-950/90 text-emerald-100'
                : t.kind === 'warning'
                  ? 'border-amber-500/30 bg-amber-950/90 text-amber-100'
                  : t.kind === 'error'
                    ? 'border-red-500/30 bg-red-950/90 text-red-100'
                    : 'border-white/10 bg-zinc-900/95 text-zinc-100'
              }`}
          >
            <p className="text-sm font-semibold">{t.title}</p>
            {t.message ? <p className="mt-1 text-sm text-zinc-400">{t.message}</p> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
