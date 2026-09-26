// 모든 편집 모드의 앱 헤더 레이어 전환. 이름은 uiCopy 단일 원천을 쓴다.

import { editorState, type EditorState, type Layer } from "@/editor/editorState";
import { selectMapModeTool } from "@/editor/panels/tileToolbarActions";
import { requestEditorCameraFocus } from "@/editor/editorCameraFocus";
import { store } from "@/project/store";
import { uiLabel, type UiCopyKey } from "@/editor/uiCopy";
import { dismissLocationDrawModeForLayer } from "@/editor/locationDrawMode";
import { applyRovingTabindex } from "./sidebarFocus";
import { el } from "@/util/dom";

/** 레이어 셋 + 맨 왼쪽 「높이」(높이 붓). 높이는 레이어가 아니라 도구지만 같은 줄에서 고른다(2026-09-26). */
export type LayerSwitcherKey = Layer | "relief";

type LayerRow = {
  readonly id: LayerSwitcherKey;
  readonly copyKey: UiCopyKey;
  readonly testId: string;
  readonly hint: string;
  readonly hotkey: string;
};

const LAYER_ROWS: readonly LayerRow[] = [
  { id: "relief", copyKey: "layerRelief", testId: "layer-relief", hint: "언덕·절벽 높이 칠하기", hotkey: "" },
  { id: "lower", copyKey: "layerLower", testId: "layer-lower", hint: "잔디·길 등 지면", hotkey: "F5" },
  { id: "upper", copyKey: "layerUpper", testId: "layer-upper", hint: "나무·가구 등 바닥 위에 얹는 것", hotkey: "F6" },
  { id: "event", copyKey: "layerEvent", testId: "layer-event", hint: "NPC·문·보물상자 등 상호작용", hotkey: "F7" },
] as const;

export function selectSidebarLayer(layer: Layer): void {
  dismissLocationDrawModeForLayer(layer);
  if (layer === "event") {
    editorState.set({ layer: "event", tool: "event" });
    return;
  }
  const current = editorState.get().tool;
  const tool = current === "event" || current === "relief" ? "paint" : current;
  editorState.set({ layer, tool });
}

/**
 * 레이어 버튼 클릭의 「바로 보이게」(2026-09-21). 전환만으로는 캔버스에 그 차이가
 * 안 읽힌다 — lower→upper 는 상위 타일만 물들이고, lower→event 는 배지가 실루엣이 되고,
 * upper→event/lower 는 채도가 돌아온다. 여기에 **해당 레이어의 실물 위치**를 반짝 강조해
 * 눈이 바로 따라간다. 사용자가 직접 누른 이동이므로 onlyIfOffscreen 를 쓰지 않는다.
 */
export function revealLayer(layer: Layer): void {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId ?? project.startMapId;
  const map = mapId ? project.maps[mapId] : undefined;
  if (!mapId || !map) return;
  const hasLower = map.lowerTiles.some((tile) => tile >= 0);
  const hasUpper = map.upperTiles.some((tile) => tile >= 0);
  const hasEvents = map.events.length > 0;
  const hasAny = layer === "lower" ? hasLower : layer === "upper" ? hasUpper : hasEvents;
  if (!hasAny) return;
  const bounds = { x: 0, y: 0, width: map.width, height: map.height };
  const tileX = map.width / 2;
  const tileY = map.height / 2;
  window.setTimeout(() => {
    if ((editorState.get().currentMapId ?? project.startMapId) !== mapId) return;
    // 같은 맵 안의 화면 맞춤은 씬 구독이 처리한다. bounds 중심으로 부드럽게 데려간다.
    requestEditorCameraFocus({ mapId, tileX, tileY, bounds });
  }, 0);
}

/** 전환 줄에서 켜져 보일 칸. 높이 붓을 쥐고 있으면 레이어가 아니라 「높이」가 켜진다. */
export function layerSwitcherKey(state: Pick<EditorState, "layer" | "tool">): LayerSwitcherKey {
  return state.tool === "relief" ? "relief" : state.layer;
}

function selectSwitcherKey(key: LayerSwitcherKey): void {
  if (key === "relief") {
    selectMapModeTool("relief");
    editorState.set({ layer: "lower" });
    return;
  }
  selectSidebarLayer(key);
  revealLayer(key);
}

export function makeLeftLayerSwitcher(activeKey: LayerSwitcherKey): HTMLElement {
  const row = el("div", {
    class: "left-layer-switcher",
    attrs: { role: "group", "aria-label": "레이어" },
    dataset: { testid: "left-layer-switcher", roving: "true" },
  });
  for (const layer of LAYER_ROWS) {
    const label = uiLabel(layer.copyKey);
    const active = activeKey === layer.id;
    row.append(
      el("button", {
        class: "left-layer-btn" + (active ? " is-active" : ""),
        attrs: {
          type: "button",
          title: layer.hotkey ? `${label} (${layer.hotkey}) — ${layer.hint}` : `${label} — ${layer.hint}`,
          "aria-label": layer.id === "relief" ? `${label} 붓` : `${label} 레이어`,
          ...(active ? { "aria-current": "true" } : {}),
        },
        dataset: { testid: layer.testId, sidebarLayer: layer.id },
        // 글리프는 달지 않는다 — 세 단추가 전부 같은 layers 아이콘이라 구분력 없이 폭만 먹었다.
        // 세그먼트 컨트롤은 라벨만으로 읽힌다.
        children: [
          el("span", { class: "left-layer-btn-label", text: label }),
        ],
        on: { click: () => {
          selectSwitcherKey(layer.id);
          window.dispatchEvent(new Event("oprn:ai-sidebar-tools"));
        } },
      }),
    );
  }
  applyRovingTabindex(row);
  return row;
}
