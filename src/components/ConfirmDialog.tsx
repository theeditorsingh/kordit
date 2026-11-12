'use client';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { useDialogFocus } from '@/hooks/useDialogFocus';

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive (default true) */
  danger?: boolean;
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface Pending extends ConfirmOptions {
  message: string;
  resolve: (ok: boolean) => void;
}

/** In-app replacement for window.confirm(): `if (await confirm('Delete this card?')) …` */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, !!pending);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const confirm = useCallback<ConfirmFn>((message, options) => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    return new Promise<boolean>((resolve) => setPending({ message, ...options, resolve }));
  }, []);

  const close = useCallback((ok: boolean) => {
    setPending((current) => {
      current?.resolve(ok);
      return null;
    });
    previousFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!pending) return;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        close(false);
      }
    }
    // Capture phase so Escape closes this dialog before any modal underneath reacts
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [pending, close]);

  const danger = pending?.danger ?? true;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="modal-overlay"
          style={{ zIndex: 9500, alignItems: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) close(false); }}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 16,
              boxShadow: 'var(--shadow-lg)',
              padding: 20,
              width: 'min(380px, calc(100vw - 32px))',
              margin: 'auto',
            }}
          >
            <h2 id="confirm-dialog-title" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              {pending.title ?? 'Are you sure?'}
            </h2>
            <p id="confirm-dialog-message" style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)', marginBottom: 20 }}>
              {pending.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => close(false)}>
                {pending.cancelLabel ?? 'Cancel'}
              </button>
              <button
                ref={confirmBtnRef}
                className={danger ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={() => close(true)}
              >
                {pending.confirmLabel ?? (danger ? 'Delete' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}
