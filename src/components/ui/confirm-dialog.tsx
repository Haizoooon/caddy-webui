"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Spinner } from "./primitives";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-md rounded-[3px] border border-line bg-surface"
      >
        <div className="flex items-start gap-3 px-5 pt-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] bg-danger/10 text-danger-ink">
            <AlertTriangle className="h-4.5 w-4.5" aria-hidden />
          </span>
          <div>
            <h2 id="confirm-dialog-title" className="text-base font-bold text-ink">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner /> : null}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
