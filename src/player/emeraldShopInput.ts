import { directionForKey, isCancelKey, isConfirmKey, keyboardEventKey } from '@/player/keyBindings';

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
    // 에메랄드 상점도 전역 키 처리기 밖이다. 한글 IME 의 Process 키를 물리 키로 되돌린다.
    // 복원되지 않은 글자 조합은 상점을 움직이지 않는다.
    const key = keyboardEventKey(event);
    if (key === 'Process' || key === 'Unidentified') return;
    if (event.isComposing && key === event.key) return;
    const direction = directionForKey(key);
    const confirm = isConfirmKey(key), cancel = isCancelKey(key);
    const scroll = key === 'PageUp' || key === 'PageDown' || key === 'Home' || key === 'End';
    if (!direction && !confirm && !cancel && !scroll && key !== 'Tab') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat && (confirm || cancel)) return;
    if (direction) actions.onDirection(direction);
    else if (confirm) actions.onConfirm();
    else if (cancel) actions.onCancel();
    else if (scroll) actions.onScroll(key);
    // Tab stays in the current phase. There are no hidden footer actions to find.
  }, { capture: true, signal: controller.signal });
  return () => controller.abort();
}
