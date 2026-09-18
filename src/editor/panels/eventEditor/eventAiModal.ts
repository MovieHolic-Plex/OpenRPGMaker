/** Details preserves the existing per-page open state; presentation is a modal. */
export function attachEventAiModal(root: HTMLDetailsElement): () => void {
  let returnFocus: HTMLElement | null = null;
  const disabled = new Map<HTMLElement, boolean>();
  const restore = (): void => {
    disabled.forEach((wasInert, node) => { node.inert = wasInert; });
    disabled.clear();
  };
  const sync = (): void => {
    if (!root.isConnected) return;
    if (root.open) {
      if (!returnFocus && document.activeElement instanceof HTMLElement && !root.contains(document.activeElement)) {
        returnFocus = document.activeElement;
      }
      const editor = root.closest('.event-editor-modal-window');
      editor?.querySelectorAll<HTMLElement>(
        '.event-editor-settings-column, .event-contents-fieldset, .event-editor-inspector-column, .event-editor-pagebar, .event-editor-modal-header, .event-editor-modal-footer',
      ).forEach(node => {
        if (node.contains(root) || disabled.has(node)) return;
        disabled.set(node, node.inert);
        node.inert = true;
      });
    } else {
      restore();
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
    }
  };
  const trap = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab' || !root.open) return;
    const controls = Array.from(root.querySelectorAll<HTMLElement>(
      'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
    )).filter(node => node.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  root.addEventListener('toggle', sync);
  root.addEventListener('keydown', trap);
  queueMicrotask(sync);
  return () => {
    restore();
    root.removeEventListener('toggle', sync);
    root.removeEventListener('keydown', trap);
  };
}
