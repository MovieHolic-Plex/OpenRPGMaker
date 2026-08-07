import { el } from "@/util/dom";

type ResizeState = {
  readonly pointerId: number;
  readonly startPointerX: number;
  readonly startPointerY: number;
  readonly startWidth: number;
  readonly startHeight: number;
};

export function renderModalResizeHandle(): HTMLElement {
  return el("div", {
    class: "event-editor-modal-resize-handle",
    attrs: {
      role: "separator",
      "aria-label": "이벤트 에디터 창 크기 조절",
      tabindex: "0",
      title: "창 크기 조절",
    },
    dataset: { testid: "event-editor-modal-resize-handle" },
  });
}

export function attachWindowResize(handle: HTMLElement, windowEl: HTMLElement): void {
  let resize: ResizeState | null = null;

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const rect = windowEl.getBoundingClientRect();
    resize = {
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
    };
    handle.setPointerCapture(event.pointerId);
    windowEl.classList.add("resizing");
    event.preventDefault();
  });

  handle.addEventListener("pointermove", (event) => {
    if (!resize || event.pointerId !== resize.pointerId) return;
    const rect = windowEl.getBoundingClientRect();
    const maxWidth = Math.max(360, window.innerWidth - rect.left - 4);
    const maxHeight = Math.max(320, window.innerHeight - rect.top - 4);
    const minWidth = Math.min(760, maxWidth);
    const minHeight = Math.min(520, maxHeight);
    const nextWidth = clamp(resize.startWidth + event.clientX - resize.startPointerX, minWidth, maxWidth);
    const nextHeight = clamp(resize.startHeight + event.clientY - resize.startPointerY, minHeight, maxHeight);
    windowEl.style.width = `${Math.round(nextWidth)}px`;
    windowEl.style.height = `${Math.round(nextHeight)}px`;
  });

  const stopResize = (event: PointerEvent): void => {
    if (!resize || event.pointerId !== resize.pointerId) return;
    resize = null;
    windowEl.classList.remove("resizing");
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  };

  handle.addEventListener("pointerup", stopResize);
  handle.addEventListener("pointercancel", stopResize);
  handle.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 40 : 16;
    let dw = 0, dh = 0;
    if (event.key === "ArrowLeft") dw = -step;
    else if (event.key === "ArrowRight") dw = step;
    else if (event.key === "ArrowUp") dh = -step;
    else if (event.key === "ArrowDown") dh = step;
    else if (event.key === "Home") { windowEl.style.width = ""; windowEl.style.height = ""; event.preventDefault(); return; }
    else return;
    const rect = windowEl.getBoundingClientRect();
    const maxW = Math.max(360, window.innerWidth - rect.left - 4);
    const maxH = Math.max(320, window.innerHeight - rect.top - 4);
    const minW = Math.min(760, maxW);
    const minH = Math.min(520, maxH);
    windowEl.style.width = `${Math.round(clamp(rect.width + dw, minW, maxW))}px`;
    windowEl.style.height = `${Math.round(clamp(rect.height + dh, minH, maxH))}px`;
    event.preventDefault();
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
