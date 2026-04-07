"use client";

import type { Toast as ToastType } from "@/hooks/useToast";

interface ToastContainerProps {
  readonly toasts: ToastType[];
  readonly onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs">
      {toasts.map((toast) => {
        const colorClasses = toast.type === 'success'
          ? 'bg-status-success/10 text-status-success border-status-success/30'
          : toast.type === 'error'
            ? 'bg-status-critical/10 text-status-critical border-status-critical/30'
            : 'bg-surface-2 text-text-primary border-border-default';

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-2 px-3 py-2 rounded border text-xs font-dashboard animate-in slide-in-from-right ${colorClasses}`}
          >
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-text-tertiary hover:text-text-primary shrink-0"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
