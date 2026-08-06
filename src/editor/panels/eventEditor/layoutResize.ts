const KEYBOARD_RESIZE_STEP = 24;
const KEYBOARD_RESIZE_STEP_LARGE = 80;

let eventEditorSettingsColumnWidth: number | null = null;

export function applyStoredSettingsColumnWidth(workbench: HTMLElement): void {
  if (eventEditorSettingsColumnWidth !== null) {
    workbench.style.setProperty("--event-editor-settings-track", `${eventEditorSettingsColumnWidth}px`);
  }
}

export function attachColumnResize(handle: HTMLElement, workbench: HTMLElement): void {
  let activePointerId: number | null = null;

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    activePointerId = event.pointerId;
    handle.setPointerCapture(event.pointerId);
    handle.classList.add("dragging");
    event.preventDefault();
  });

  handle.addEventListener("pointermove", (event) => {
    if (activePointerId !== event.pointerId) return;
    const rect = workbench.getBoundingClientRect();
    setSettingsColumnWidth(workbench, event.clientX - rect.left, rect.width);
    event.preventDefault();
  });

  const stopResize = (event: PointerEvent): void => {
    if (activePointerId !== event.pointerId) return;
    activePointerId = null;
    handle.classList.remove("dragging");
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  };

  handle.addEventListener("pointerup", stopResize);
  handle.addEventListener("pointercancel", stopResize);
  handle.addEventListener("keydown", (event) => {
    const rect = workbench.getBoundingClientRect();
    const currentWidth = eventEditorSettingsColumnWidth ?? settingsColumnWidth(workbench);
    const step = event.shiftKey ? KEYBOARD_RESIZE_STEP_LARGE : KEYBOARD_RESIZE_STEP;
    if (event.key === "ArrowLeft") {
      setSettingsColumnWidth(workbench, currentWidth - step, rect.width);
      event.preventDefault();
    } else if (event.key === "ArrowRight") {
      setSettingsColumnWidth(workbench, currentWidth + step, rect.width);
      event.preventDefault();
    } else if (event.key === "Home") {
      setSettingsColumnWidth(workbench, 0, rect.width);
      event.preventDefault();
    } else if (event.key === "End") {
      setSettingsColumnWidth(workbench, rect.width, rect.width);
      event.preventDefault();
    }
  });
}

function clampColumnWidth(value: number, workbenchWidth: number): number {
  const minSettingsWidth = workbenchWidth < 900 ? 220 : 288;
  const minCommandsWidth = workbenchWidth < 900 ? 260 : 380;
  const minInspectorWidth = 280;
  // 4컬럼 붕괴 방지: 인스펙터가 숨는 1180px 이하는 3컬럼 기준으로, 그 이상은 4컬럼 기준으로 max 계산
  const reserveRight = workbenchWidth < 1180 ? minCommandsWidth : minCommandsWidth + minInspectorWidth;
  const maxSettingsWidth = Math.max(minSettingsWidth, workbenchWidth - reserveRight);
  return Math.round(Math.min(Math.max(value, minSettingsWidth), maxSettingsWidth));
}

function settingsColumnWidth(workbench: HTMLElement): number {
  const settingsColumn = workbench.querySelector<HTMLElement>(".event-editor-settings-column");
  return settingsColumn?.getBoundingClientRect().width ?? workbench.getBoundingClientRect().width / 2;
}

function setSettingsColumnWidth(workbench: HTMLElement, width: number, workbenchWidth: number): void {
  const nextWidth = clampColumnWidth(width, workbenchWidth);
  eventEditorSettingsColumnWidth = nextWidth;
  workbench.style.setProperty("--event-editor-settings-track", `${nextWidth}px`);
}
