import { editorState, type Layer } from "@/editor/editorState";
import { getEditorChrome } from "@/editor/editorUiMode";
import { toggleLayoutBboxes } from "@/editor/layoutBboxOverlay";
import {
  getMapEditLockStatus,
  isMapEditLockTakeoverImmediate,
  lockOwnerPhrase,
  mapEditLockLastActivityText,
  takeoverMapLock,
  type MapEditLockStatus,
} from "@/editor/mapEditLocks";
import { getAiConnectionStatus, renderAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { renderDbConnectionStatus } from "@/editor/panels/dbConnectionSettings";
import { showConfirm } from "@/editor/ui/modal";
import { tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { store } from "@/project/store";
import { el } from "@/util/dom";

export function currentMapHasLayoutRegions(): boolean {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId ?? project.startMapId;
  return (project.maps[mapId]?.layoutPlan?.regions.length ?? 0) > 0;
}

export function renderEditorStatusbar(container: HTMLElement, onRefresh: () => void = () => undefined): void {
  container.replaceChildren();
  const project = store.getCurrent();
  const state = editorState.get();
  const chrome = getEditorChrome();
  const mapId = state.currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  const lockStatus = getMapEditLockStatus();
  const cells: HTMLElement[] = [
    el("span", {
      class: "editor-statusbar-cell strong",
      text: layerStatusLabel(state.layer),
      dataset: { testid: "statusbar-layer" },
    }),
    el("span", {
      class: "editor-statusbar-cell strong statusbar-map",
      text: `맵: ${map?.name ?? mapId}`,
      dataset: { testid: "statusbar-map" },
    }),
  ];
  if (chrome.statusbarDensity === "full") {
    const extra = el("details", {
      class: "editor-statusbar-overflow",
      dataset: { testid: "statusbar-overflow" },
      children: [
        el("summary", { class: "editor-statusbar-cell sb-secondary", text: "자세히" }),
        el("span", { class: "editor-statusbar-cell sb-secondary", text: `타일: ${tileDisplayLabelForIndex(state.selectedTile)}` }),
        el("span", { class: "editor-statusbar-cell", text: toolStatusLabel(state.tool) }),
        el("span", { class: "editor-statusbar-cell sb-secondary", text: `줌: ${state.zoom}x` }),
        el("span", {
          class: "editor-statusbar-cell sb-detail",
          children: [el("span", { dataset: { testid: "cursor-position" }, text: "outside" })],
        }),
        el("span", {
          class: "editor-statusbar-cell sb-detail",
          children: ["하위: ", el("span", { dataset: { testid: "cursor-lower" }, text: "-" })],
        }),
        el("span", {
          class: "editor-statusbar-cell sb-detail",
          children: ["상위: ", el("span", { dataset: { testid: "cursor-upper" }, text: "-" })],
        }),
      ],
    });
    cells.push(extra);
  }
  if (state.tool === "event" && state.layer === "event") {
    cells.push(
      el("button", {
        class: "editor-statusbar-cell editor-statusbar-hint",
        text: "타일 칠하려면: 바닥/장식으로 전환",
        attrs: { type: "button", title: "브러시로 전환해 타일을 칠합니다" },
        dataset: { testid: "paint-hint-switch" },
        on: { click: () => editorState.set({ tool: "paint", layer: "lower" }) },
      }),
    );
  }
  if (shouldShowMapEditLockStatus(lockStatus, mapId)) {
    cells.push(renderMapEditLockStatus(lockStatus, mapId, onRefresh));
  }
  cells.push(renderDbConnectionStatus(store.getDbPersistenceStatus(), onRefresh));
  if (currentMapHasLayoutRegions()) {
    cells.push(
      el("button", {
        class: "editor-statusbar-cell" + (state.showLayoutBboxes ? " active" : ""),
        text: state.showLayoutBboxes ? "설계도 숨기기" : "설계도 보기",
        attrs: { type: "button", title: "맵 설계도 영역 표시" },
        dataset: { testid: "toggle-layout-bboxes" },
        on: { click: () => toggleLayoutBboxes() },
      }),
    );
  }
  const aiStatus = getAiConnectionStatus();
  if (aiStatus.kind === "disconnected" || aiStatus.kind === "offline") {
    cells.push(renderAiConnectionStatus(onRefresh));
  }
  container.append(...cells);
}

function shouldShowMapEditLockStatus(status: MapEditLockStatus, mapId: string): boolean {
  if (status.kind === "idle" || status.mapId !== mapId) return false;
  return status.kind === "checking" || status.kind === "locked" || status.kind === "unavailable";
}

function renderMapEditLockStatus(status: MapEditLockStatus, mapId: string, onRefresh: () => void): HTMLElement {
  const className = status.kind !== "idle" && status.mapId === mapId ? status.kind : "idle";
  const cell = el("span", {
    class: `editor-statusbar-cell map-edit-lock-status ${className}`,
    text: mapEditLockStatusText(status, mapId),
    attrs: { title: mapEditLockStatusTitle(status, mapId) },
    dataset: { testid: "map-edit-lock-status" },
  });
  if (status.kind === "locked" && status.mapId === mapId) {
    cell.append(
      el("button", {
        class: "map-lock-takeover-button",
        text: "편집 권한 가져오기",
        attrs: { type: "button", title: "맵 편집 권한 가져오기" },
        dataset: { testid: "map-lock-takeover" },
        on: {
          click: (event) => {
            event.stopPropagation();
            void requestMapLockTakeover(status, onRefresh);
          },
        },
      }),
    );
  }
  return cell;
}

export async function requestMapLockTakeover(
  status: Extract<MapEditLockStatus, { readonly kind: "locked" }>,
  onRefresh: () => void,
): Promise<void> {
  const immediate = isMapEditLockTakeoverImmediate(status);
  if (!immediate) {
    const confirmed = await showConfirm({
      title: "편집 권한 가져오기",
      message: `${lockOwnerPhrase(status.ownerLabel)}이고 최근까지 활동했습니다. 편집 권한을 가져올까요? (상대 세션은 읽기 전용이 됩니다)`,
      confirmLabel: "가져오기",
    });
    if (!confirmed) return;
  }
  void takeoverMapLock(status.mapId, status.mapName).then(() => onRefresh());
}

function mapEditLockStatusText(status: MapEditLockStatus, mapId: string): string {
  if (status.kind === "idle" || status.mapId !== mapId) return "맵 편집: 확인 전";
  switch (status.kind) {
    case "checking":
      return "맵 편집: 확인 중";
    case "held":
      return "맵 편집: 확보";
    case "locked":
      return "맵 편집: 읽기 전용";
    case "unavailable":
      return `맵 편집: ${status.message}`;
  }
}

function mapEditLockStatusTitle(status: MapEditLockStatus, mapId: string): string {
  if (status.kind === "idle" || status.mapId !== mapId) return "맵 잠금 상태를 아직 확인하지 않았습니다.";
  switch (status.kind) {
    case "checking":
      return `${status.mapName} 편집 권한을 확인하는 중입니다.`;
    case "held":
      return `${status.mapName} 편집 권한을 이 브라우저가 잡고 있습니다.`;
    case "locked":
      return `${status.mapName} 맵은 지금 ${lockOwnerPhrase(status.ownerLabel)}입니다. ${mapEditLockLastActivityText(status)}.`;
    case "unavailable":
      return `${status.mapName} 잠금 확인 실패: ${status.message}. 편집은 허용하지만 수동 저장 충돌 검사는 유지됩니다.`;
  }
}

function layerStatusLabel(layer: Layer): string {
  const plain = getEditorChrome().layerTermStyle === "plain";
  switch (layer) {
    case "lower":
      return plain ? "바닥 레이어" : "하위 레이어";
    case "upper":
      return plain ? "장식 레이어" : "상위 레이어";
    case "event":
      return "이벤트 레이어";
  }
}

function toolStatusLabel(tool: string): string {
  switch (tool) {
    case "paint":
      return "펜";
    case "fill":
      return "채우기";
    case "pan":
      return "이동";
    case "event":
      return "이벤트";
    case "erase":
      return "지우개";
    case "select":
      return "선택";
    case "eyedropper":
      return "스포이드";
    case "collision":
      return "통행";
    default:
      return tool;
  }
}
