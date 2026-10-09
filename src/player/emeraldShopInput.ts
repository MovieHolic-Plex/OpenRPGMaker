import { directionForKey, isCancelKey, isConfirmKey } from '@/player/keyBindings';

/** A single lifetime owns every shop phase: a held confirm never reaches the next phase. */
export function attachEmeraldShopInput(root: HTMLElement, actions: {
  readonly onDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly onScroll: (key: string) => void;
}): () => void {
  const controller = new AbortController();
  const view = root.ownerDocument.defaultView ?? window;
  view.addEventListener('keydown', event => {
    if (!root.isConnected) return;
    const direction = directionForKey(event.key);
    const confirm = isConfirmKey(event.key), cancel = isCancelKey(event.key);
    const scroll = ['PageUp', 'PageDown', 'Home', 'End'].includes(event.key);
    if (!direction && !confirm && !cancel && !scroll && event.key !== 'Tab') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.isComposing || (event.repeat && (confirm || cancel))) return;
    if (direction) actions.onDirection(direction);
    else if (confirm) actions.onConfirm();
    else if (cancel) actions.onCancel();
    else if (scroll) actions.onScroll(event.key);
    // Tab stays in the current phase. There are no hidden footer actions to find.
  }, { capture: true, signal: controller.signal });
  return () => controller.abort();
}
