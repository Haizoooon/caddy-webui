"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tone } from "./primitives";

type ToastTone = Extract<Tone, "success" | "danger" | "info" | "warning">;

interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
}

interface ToastItem extends ToastInput {
  id: string;
  tone: ToastTone;
}

interface ToastContextValue {
  push: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<ToastTone, string> = {
  success: "border-l-success",
  danger: "border-l-danger",
  info: "border-l-info",
  warning: "border-l-warning",
};

const toneIcons: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-success-ink" aria-hidden />,
  danger: <AlertTriangle className="h-4 w-4 text-danger-ink" aria-hidden />,
  info: <Info className="h-4 w-4 text-info-ink" aria-hidden />,
  warning: <AlertTriangle className="h-4 w-4 text-warning-ink" aria-hidden />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((toast: ToastInput) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    setItems((current) => [
      ...current.slice(-4),
      { ...toast, id, tone: toast.tone ?? "info" },
    ]);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2"
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onClose={() => remove(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-[3px] border border-line border-l-4 bg-surface px-3 py-2.5",
        toneStyles[item.tone],
      )}
      role="status"
    >
      <span className="mt-0.5">{toneIcons[item.tone]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{item.title}</p>
        {item.description ? (
          <p className="mt-0.5 text-xs leading-relaxed break-words text-muted">
            {item.description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded-[2px] p-1 text-muted hover:bg-cloud hover:text-ink"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside a ToastProvider");
  }
  return context;
}
