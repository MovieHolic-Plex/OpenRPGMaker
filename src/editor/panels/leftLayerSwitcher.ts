// 모든 편집 모드의 앱 헤더 레이어 전환. 이름은 uiCopy 단일 원천을 쓴다.

import { editorState, type EditorState, type Layer } from "@/editor/editorState";
import { selectMapModeTool } from "@/editor/panels/tileToolbarActions";
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

/** 전환 줄에서 켜져 보일 칸. 높이 붓을 쥐고 있으면 레이어가 아니라 「높이」가 켜진다. */
export function layerSwitcherKey(state: Pick<EditorState, "layer" | "tool">): LayerSwitcherKey {
  return state.tool === "relief" ? "relief" : state.layer;
}

function selectSwitcherKey(key: LayerSwitcherKey): void {
  // 레이어 전환은 카메라를 건드리지 않는다(2026-09-27). 예전 revealLayer 는 누를 때마다 맵 전체
  // 맞춤으로 끌고 가 배율·위치가 튀었다 — 사용자가 보던 자리를 잃는 것이 전환 신호보다 비싸다.
  if (key === "relief") {
    selectMapModeTool("relief");
    editorState.set({ layer: "lower" });
    return;
  }
  selectSidebarLayer(key);
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
