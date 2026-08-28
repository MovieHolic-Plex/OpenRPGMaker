type DragState = {
  readonly pointerId: number;
  readonly startPointerX: number;
  readonly startPointerY: number;
  readonly startX: number;
  readonly startY: number;
  readonly startTranslateX: number;
  readonly startTranslateY: number;
};

export function attachWindowDrag(handle: HTMLElement, windowEl: HTMLElement): void {
  let translateX = 0;
  let translateY = 0;
  let drag: DragState | null = null;

  handle.addEventListener("pointerdown", (event) => {
    if (windowEl.classList.contains("is-fullscreen")) return;
    const target = event.target;
    // summary 도 제외한다: 여기서 setPointerCapture + preventDefault 를 하면 크롬이 뒤따르는
    // mousedown/click 을 삼켜 헤더 안 `<details>` 팝오버(검토 알림 종)가 열리지 않는다.
    if (target instanceof HTMLElement && target.closest("button, input, select, textarea, a, summary")) return;
    const rect = windowEl.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startX: rect.left,
      startY: rect.top,
      startTranslateX: translateX,
      startTranslateY: translateY,
    };
    windowEl.classList.add("dragging");
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  handle.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const rect = windowEl.getBoundingClientRect();
    const nextX = clamp(drag.startX + event.clientX - drag.startPointerX, 0, window.innerWidth - Math.min(rect.width, 160));
    const nextY = clamp(drag.startY + event.clientY - drag.startPointerY, 0, window.innerHeight - handle.offsetHeight);
    translateX = drag.startTranslateX + nextX - drag.startX;
    translateY = drag.startTranslateY + nextY - drag.startY;
    windowEl.style.transform = `translate(${Math.round(translateX)}px, ${Math.round(translateY)}px)`;
  });

  const stopDrag = (event: PointerEvent): void => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    windowEl.classList.remove("dragging");
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  };

  handle.addEventListener("pointerup", stopDrag);
  handle.addEventListener("pointercancel", stopDrag);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
