const KEYBOARD_RESIZE_STEP = 24;
const KEYBOARD_RESIZE_STEP_LARGE = 80;
const DEFAULT_SETTINGS_COLUMN_WIDTH = 312;

let eventEditorSettingsColumnWidth: number | null = null;

export function applyStoredSettingsColumnWidth(workbench: HTMLElement): void {
  if (eventEditorSettingsColumnWidth !== null) {
    workbench.style.setProperty("--event-editor-settings-track", `${eventEditorSettingsColumnWidth}px`);
  }
}

export function attachColumnResize(handle: HTMLElement, workbench: HTMLElement): void {
  let activePointerId: number | null = null;

  const updateAccessibility = (): void => {
    const rect = workbench.getBoundingClientRect();
    const width = eventEditorSettingsColumnWidth ?? settingsColumnWidth(workbench);
    const { min, max } = columnWidthBounds(rect.width, workbench);
    handle.setAttribute("aria-valuemin", String(min));
    handle.setAttribute("aria-valuemax", String(max));
    handle.setAttribute("aria-valuenow", String(Math.round(width)));
    handle.setAttribute("aria-valuetext", `설정 패널 ${Math.round(width)}픽셀`);
  };

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    activePointerId = event.pointerId;
    handle.setPointerCapture(event.pointerId);
    handle.classList.add("dragging");
    document.body.classList.add("event-editor-column-resizing");
    updateAccessibility();
    event.preventDefault();
  });

  handle.addEventListener("pointermove", (event) => {
    if (activePointerId !== event.pointerId) return;
    const rect = workbench.getBoundingClientRect();
    setSettingsColumnWidth(handle, workbench, event.clientX - rect.left, rect.width);
    event.preventDefault();
  });

  const stopResize = (event: PointerEvent): void => {
    if (activePointerId !== event.pointerId) return;
    activePointerId = null;
    handle.classList.remove("dragging");
    document.body.classList.remove("event-editor-column-resizing");
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  };

  handle.addEventListener("pointerup", stopResize);
  handle.addEventListener("pointercancel", stopResize);
  handle.addEventListener("lostpointercapture", stopResize);
  handle.addEventListener("focus", updateAccessibility);
  handle.addEventListener("dblclick", (event) => {
    eventEditorSettingsColumnWidth = null;
    workbench.style.removeProperty("--event-editor-settings-track");
    updateAccessibility();
    event.preventDefault();
  });
  handle.addEventListener("keydown", (event) => {
    const rect = workbench.getBoundingClientRect();
    const currentWidth = eventEditorSettingsColumnWidth ?? settingsColumnWidth(workbench);
    const step = event.shiftKey ? KEYBOARD_RESIZE_STEP_LARGE : KEYBOARD_RESIZE_STEP;
    if (event.key === "ArrowLeft") {
      setSettingsColumnWidth(handle, workbench, currentWidth - step, rect.width);
      event.preventDefault();
    } else if (event.key === "ArrowRight") {
      setSettingsColumnWidth(handle, workbench, currentWidth + step, rect.width);
      event.preventDefault();
    } else if (event.key === "Home") {
      setSettingsColumnWidth(handle, workbench, 0, rect.width);
      event.preventDefault();
    } else if (event.key === "End") {
      setSettingsColumnWidth(handle, workbench, rect.width, rect.width);
      event.preventDefault();
    }
  });

  queueMicrotask(updateAccessibility);
}

function columnWidthBounds(workbenchWidth: number, workbench: HTMLElement): { readonly min: number; readonly max: number } {
  const min = workbenchWidth < 900 ? 220 : 288;
  const minCommandsWidth = workbenchWidth < 900 ? 260 : 380;
  const minInspectorWidth = 280;
  const inspectorWidth =
    workbench.classList.contains("has-command-inspector") && workbenchWidth >= 1180
      ? minInspectorWidth
      : 0;
  const reserveRight = minCommandsWidth + inspectorWidth;
  const max = Math.max(min, workbenchWidth - reserveRight);
  return { min, max };
}

function clampColumnWidth(value: number, workbenchWidth: number, workbench: HTMLElement): number {
  const { min, max } = columnWidthBounds(workbenchWidth, workbench);
  return Math.round(Math.min(Math.max(value, min), max));
}

function settingsColumnWidth(workbench: HTMLElement): number {
  const settingsColumn = workbench.querySelector<HTMLElement>(".event-editor-settings-column");
  return settingsColumn?.getBoundingClientRect().width || DEFAULT_SETTINGS_COLUMN_WIDTH;
}

function setSettingsColumnWidth(
  handle: HTMLElement,
  workbench: HTMLElement,
  width: number,
  workbenchWidth: number,
): void {
  const nextWidth = clampColumnWidth(width, workbenchWidth, workbench);
  eventEditorSettingsColumnWidth = nextWidth;
  workbench.style.setProperty("--event-editor-settings-track", `${nextWidth}px`);
  handle.setAttribute("aria-valuenow", String(nextWidth));
  handle.setAttribute("aria-valuetext", `설정 패널 ${nextWidth}픽셀`);
}
