type ModalDragState = {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly windowEl: HTMLElement;
};

let modalDragState: ModalDragState | null = null;

export function startModalDrag(windowEl: HTMLElement, event: MouseEvent): void {
  if (event.button !== 0 || windowEl.classList.contains("maximized")) return;
  const target = event.target;
  if (target instanceof HTMLButtonElement) return;
  event.preventDefault();
  const rect = windowEl.getBoundingClientRect();
  windowEl.classList.add("floating");
  windowEl.style.left = `${rect.left}px`;
  windowEl.style.top = `${rect.top}px`;
  windowEl.style.width = `${rect.width}px`;
  windowEl.style.height = `${rect.height}px`;
  modalDragState = {
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    windowEl,
  };
  document.body.classList.add("database-modal-dragging");
  window.addEventListener("mousemove", handleModalDragMove);
  window.addEventListener("mouseup", stopModalDrag);
}

export function stopModalDrag(): void {
  modalDragState = null;
  document.body.classList.remove("database-modal-dragging");
  // window 가 없는 환경(테스트 node)에서도 close() 경로가 안전하게 지나가도록 가드.
  if (typeof window === "undefined") return;
  window.removeEventListener("mousemove", handleModalDragMove);
  window.removeEventListener("mouseup", stopModalDrag);
}

function handleModalDragMove(event: MouseEvent): void {
  if (!modalDragState) return;
  const rect = modalDragState.windowEl.getBoundingClientRect();
  const maxLeft = Math.max(window.innerWidth - rect.width - 4, 4);
  const maxTop = Math.max(window.innerHeight - rect.height - 4, 4);
  modalDragState.windowEl.style.left = `${clamp(event.clientX - modalDragState.offsetX, 4, maxLeft)}px`;
  modalDragState.windowEl.style.top = `${clamp(event.clientY - modalDragState.offsetY, 4, maxTop)}px`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
