import { editorState } from "@/editor/editorState";
import { describeChipsetTile } from "@/project/defaults/chipsetMapping";
import { store } from "@/project/store";
import { el } from "@/util/dom";

type DragState = {
  readonly dragId: number | "mouse";
  readonly pointerStartX: number;
  readonly pointerStartY: number;
  readonly panelStartX: number;
  readonly panelStartY: number;
};

const PANEL_MARGIN = 8;
const PANEL_POSITION_KEY = "rpg-zzu.aiAssistant.position";

export function renderAiAssistantPanel(): HTMLElement {
  let dragState: DragState | null = null;
  const status = el("span", { class: "ai-assistant-status", text: "대기" });
  const promptInput = el("textarea", {
    class: "ai-assistant-input",
    text: "",
    attrs: {
      placeholder: "AI 요청 초안",
    },
  }) as HTMLTextAreaElement;
  const header = el("div", {
    class: "ai-assistant-header",
    attrs: { draggable: "true", title: "드래그로 이동" },
    dataset: { testid: "ai-assistant-drag-handle" },
    children: [
      el("div", {
        children: [
          el("h2", { text: "AI 어시스턴트" }),
          el("p", { text: "타일 세트와 맵 제작 보조" }),
        ],
      }),
      status,
    ],
  });
  const panel = el("aside", {
    class: "ai-assistant-panel",
    attrs: { "aria-label": "AI 어시스턴트" },
    dataset: { testid: "ai-assistant-panel" },
    children: [
      header,
      el("div", {
        class: "ai-assistant-body",
        children: [
          el("button", {
            class: "ai-assistant-action",
            text: "선택 타일 설명 읽기",
            attrs: { type: "button" },
            on: {
              click: () => {
                writeAssistantDraft(promptInput, status, selectedTileDraft(), "타일");
              },
            },
          }),
          el("button", {
            class: "ai-assistant-action",
            text: "현재 맵 개선안 보기",
            attrs: { type: "button" },
            on: {
              click: () => {
                writeAssistantDraft(promptInput, status, currentMapDraft(), "맵");
              },
            },
          }),
          promptInput,
        ],
      }),
    ],
  });
  requestAnimationFrame(() => restorePanelPosition(panel));

  const beginDrag = (clientX: number, clientY: number, dragId: number | "mouse"): void => {
    const rect = panel.getBoundingClientRect();
    dragState = {
      dragId,
      pointerStartX: clientX,
      pointerStartY: clientY,
      panelStartX: rect.left,
      panelStartY: rect.top,
    };
    panel.classList.add("is-dragging");
  };
  const moveDrag = (clientX: number, clientY: number): void => {
    if (!dragState) return;
    const rect = panel.getBoundingClientRect();
    const nextX = dragState.panelStartX + clientX - dragState.pointerStartX;
    const nextY = dragState.panelStartY + clientY - dragState.pointerStartY;
    const position = clampedPanelPosition(
      { x: nextX, y: nextY },
      { width: rect.width, height: rect.height }
    );
    panel.style.left = `${position.x}px`;
    panel.style.top = `${position.y}px`;
    panel.style.right = "auto";
  };
  const finishDrag = (): void => {
    savePanelPosition(panel);
    dragState = null;
    panel.classList.remove("is-dragging");
  };
  const onMouseMove = (event: MouseEvent): void => {
    if (dragState?.dragId !== "mouse") return;
    moveDrag(event.clientX, event.clientY);
  };
  const onMouseUp = (): void => {
    if (dragState?.dragId !== "mouse") return;
    finishDrag();
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };

  header.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || dragState) return;
    beginDrag(event.clientX, event.clientY, event.pointerId);
    header.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  header.addEventListener("pointermove", (event) => {
    if (dragState?.dragId !== event.pointerId) return;
    moveDrag(event.clientX, event.clientY);
  });

  const finishPointerDrag = (event: PointerEvent): void => {
    if (dragState?.dragId !== event.pointerId) return;
    finishDrag();
    if (header.hasPointerCapture(event.pointerId)) {
      header.releasePointerCapture(event.pointerId);
    }
  };
  header.addEventListener("pointerup", finishPointerDrag);
  header.addEventListener("pointercancel", finishPointerDrag);

  header.addEventListener("mousedown", (event) => {
    if (event.button !== 0 || dragState) return;
    beginDrag(event.clientX, event.clientY, "mouse");
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    event.preventDefault();
  });

  header.addEventListener("dragstart", (event) => {
    beginDrag(event.clientX, event.clientY, "mouse");
    event.dataTransfer?.setData("text/plain", "");
  });

  header.addEventListener("drag", (event) => {
    if (dragState?.dragId !== "mouse") return;
    if (event.clientX === 0 && event.clientY === 0) return;
    moveDrag(event.clientX, event.clientY);
  });

  header.addEventListener("dragend", (event) => {
    if (dragState?.dragId !== "mouse") return;
    if (event.clientX !== 0 || event.clientY !== 0) {
      moveDrag(event.clientX, event.clientY);
    }
    finishDrag();
  });

  return panel;
}

function selectedTileDraft(): string {
  const selected = editorState.get().selectedTile;
  const tile = describeChipsetTile(selected);
  return JSON.stringify(
    {
      model: "gemini-3.5-flash",
      response_format: { type: "json_object" },
      task: "tileset_tile_metadata",
      tile,
    },
    null,
    2
  );
}

function currentMapDraft(): string {
  const project = store.getCurrent();
  const state = editorState.get();
  const mapId = state.currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  const sampleTiles = Array.from({ length: Math.min(12, tileset?.count ?? 0) }, (_, index) =>
    describeChipsetTile(index)
  );
  return JSON.stringify(
    {
      model: "gemini-3.5-flash",
      response_format: { type: "json_object" },
      task: "map_improvement_draft",
      map: map
        ? {
            id: map.id,
            name: map.name,
            width: map.width,
            height: map.height,
            tilesetId: map.tilesetId,
          }
        : null,
      selectedTile: describeChipsetTile(state.selectedTile),
      sampleTiles,
    },
    null,
    2
  );
}

function writeAssistantDraft(input: HTMLTextAreaElement, status: HTMLElement, draft: string, label: string): void {
  input.value = draft;
  status.textContent = label;
}

function restorePanelPosition(panel: HTMLElement): void {
  const position = readStoredPanelPosition();
  if (!position) return;
  const rect = panel.getBoundingClientRect();
  const clamped = clampedPanelPosition(position, { width: rect.width, height: rect.height });
  panel.style.left = `${clamped.x}px`;
  panel.style.top = `${clamped.y}px`;
  panel.style.right = "auto";
}

function savePanelPosition(panel: HTMLElement): void {
  if (typeof window === "undefined") return;
  const rect = panel.getBoundingClientRect();
  const position = clampedPanelPosition({ x: rect.left, y: rect.top }, { width: rect.width, height: rect.height });
  window.localStorage.setItem(PANEL_POSITION_KEY, `${position.x},${position.y}`);
}

function readStoredPanelPosition(): { readonly x: number; readonly y: number } | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PANEL_POSITION_KEY);
  if (!raw) return null;
  const [xText, yText] = raw.split(",");
  const x = Number(xText);
  const y = Number(yText);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function clampedPanelPosition(
  position: { readonly x: number; readonly y: number },
  size: { readonly width: number; readonly height: number }
): { readonly x: number; readonly y: number } {
  const maxX = Math.max(PANEL_MARGIN, window.innerWidth - size.width - PANEL_MARGIN);
  const maxY = Math.max(PANEL_MARGIN, window.innerHeight - size.height - PANEL_MARGIN);
  return {
    x: Math.min(Math.max(PANEL_MARGIN, position.x), maxX),
    y: Math.min(Math.max(PANEL_MARGIN, position.y), maxY),
  };
}
