type ModalDragState = {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly windowEl: HTMLElement;
};

let modalDragState: ModalDragState | null = null;

export function startModalDrag(windowEl: HTMLElement, event: MouseEvent): void {
  if (event.button !== 0 || windowEl.classList.contains("maximized")) return;
  const target = event.target;
  if (target instanceof Element && target.closest("button")) return;
  event.preventDefault();
  const rect = windowEl.getBoundingClientRect();
  windowEl.classList.add("floating");
  // `ai-bar.css`의 `.database-modal-backdrop .database-modal-window { position: relative }`
  // (0,2,0)가 `.floating { position: fixed }`(0,2,0)와 동점이라 import 순서로 이긴다 —
  // 뷰포트 기준 드래그 좌표가 grid 오프셋으로 들어가 창이 커서를 못 따라온다(2026-09-18 실측).
  // CSS 특이성 경쟁 대신 인라인 스타일로 이긴다(CSS 게이트 R2에 새 선택자를 추가하지 않는다).
  windowEl.style.position = "fixed";
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
