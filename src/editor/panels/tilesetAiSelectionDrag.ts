type AiDragState = {
  readonly mode: "add" | "replace";
  readonly startTile: number;
  moved: boolean;
};

type AiSelectionDragControllerOptions = {
  readonly addTile: (tile: number) => void;
  readonly markTileSelected: (tile: number) => void;
  readonly readTileFromPoint: (x: number, y: number) => number | null;
  readonly replaceSelection: (tile: number) => void;
  readonly syncSelectionLine: () => void;
  readonly resetQuestion: () => void;
};

export type AiSelectionDragController = {
  readonly consumeSuppressedClick: () => boolean;
  readonly extend: (tile: number) => void;
  readonly start: (tile: number, event: Event, rerender: () => void) => void;
  readonly stop: () => void;
};

export function createAiSelectionDragController(options: AiSelectionDragControllerOptions): AiSelectionDragController {
  let dragState: AiDragState | null = null;
  let activeRerender: (() => void) | null = null;
  let suppressNextClick = false;

  const extend = (tile: number): void => {
    if (!dragState) return;
    if (!dragState.moved) {
      if (dragState.mode === "replace") options.replaceSelection(dragState.startTile);
      else options.addTile(dragState.startTile);
      options.markTileSelected(dragState.startTile);
    }
    dragState.moved = true;
    options.addTile(tile);
    options.markTileSelected(tile);
    options.syncSelectionLine();
    options.resetQuestion();
  };

  const handleDocumentMove = (event: PointerEvent | MouseEvent): void => {
    const rerender = activeRerender;
    if (!rerender) return;
    const tile = options.readTileFromPoint(event.clientX, event.clientY);
    if (tile === null) return;
    extend(tile);
  };

  const stop = (): void => {
    const shouldRerender = dragState?.moved === true;
    const rerender = activeRerender;
    if (shouldRerender) suppressNextClick = true;
    dragState = null;
    activeRerender = null;
    window.removeEventListener("pointermove", handleDocumentMove);
    window.removeEventListener("mousemove", handleDocumentMove);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("mouseup", stop);
    if (shouldRerender && rerender) rerender();
  };

  return {
    consumeSuppressedClick: () => {
      if (!suppressNextClick) return false;
      suppressNextClick = false;
      return true;
    },
    extend,
    start: (tile, event, rerender) => {
      if (!(event instanceof PointerEvent || event instanceof MouseEvent) || event.button !== 0 || dragState) return;
      const mode = event.ctrlKey || event.metaKey ? "add" : "replace";
      dragState = { mode, startTile: tile, moved: false };
      activeRerender = rerender;
      options.resetQuestion();
      window.addEventListener("pointermove", handleDocumentMove);
      window.addEventListener("mousemove", handleDocumentMove);
      window.addEventListener("pointerup", stop);
      window.addEventListener("mouseup", stop);
    },
    stop,
  };
}
