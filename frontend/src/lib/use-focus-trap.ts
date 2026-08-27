import { useEffect, type RefObject } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// A real bug, found live in the Iter panel (role="dialog", aria-modal=
// "true"): tabbing forward from its last focusable element left the modal
// entirely and landed on the page behind it — `aria-modal` describes the
// intended behaviour, it doesn't enforce it; a keydown listener that wraps
// Tab/Shift+Tab at the dialog's own first/last focusable element is what
// actually traps it. Shared rather than reimplemented per dialog: every
// role="dialog" sheet in the app (this one, CellHistorySheet,
// MarkHistorySheet, SupersedeDialog, PublishDialog, QrSheet) has the exact
// same shape.
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = Array.from(container!.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [ref, active]);
}
