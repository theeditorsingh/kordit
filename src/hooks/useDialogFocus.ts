'use client';
import { useEffect, type RefObject } from 'react';

const dialogs: HTMLElement[] = [];

/** Only the topmost dialog owns focus, including nested confirmations. */
export function useDialogFocus(ref: RefObject<HTMLDivElement | null>, enabled = true) {
  useEffect(() => {
    const dialog = ref.current;
    if (!enabled || !dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogs.push(dialog);
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]'
    )).filter(el => el.getClientRects().length > 0 && !el.closest('[inert]'));
    dialog.focus({ preventScroll: true });
    function onKey(event: KeyboardEvent) {
      if (dialogs.at(-1) !== dialog || event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (!first) { event.preventDefault(); dialog!.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
        event.preventDefault(); first.focus();
      }
    }
    function onFocus(event: FocusEvent) {
      if (dialogs.at(-1) === dialog && !dialog!.contains(event.target as Node)) dialog!.focus({ preventScroll: true });
    }
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus);
    return () => {
      dialogs.splice(dialogs.indexOf(dialog), 1);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [ref, enabled]);
}
