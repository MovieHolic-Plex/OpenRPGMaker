// 모든 편집 모드의 캔버스 상단 레이어 전환. 이름은 uiCopy 단일 원천을 쓴다.

import { editorState, type Layer } from "@/editor/editorState";
import { uiLabel, type UiCopyKey } from "@/editor/uiCopy";
import { dismissLocationDrawModeForLayer } from "@/editor/locationDrawMode";
import { applyRovingTabindex } from "./sidebarFocus";
import { el } from "@/util/dom";

type LayerRow = {
  readonly id: Layer;
  readonly copyKey: UiCopyKey;
  readonly testId: string;
  readonly hint: string;
  readonly hotkey: string;
};

const LAYER_ROWS: readonly LayerRow[] = [
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
  const tool = editorState.get().tool === "event" ? "paint" : editorState.get().tool;
  editorState.set({ layer, tool });
}

export function makeLeftLayerSwitcher(activeLayer: Layer): HTMLElement {
  const row = el("div", {
    class: "left-layer-switcher",
    attrs: { role: "group", "aria-label": "레이어" },
    dataset: { testid: "left-layer-switcher", roving: "true" },
  });
  for (const layer of LAYER_ROWS) {
    const label = uiLabel(layer.copyKey);
    const active = activeLayer === layer.id;
    row.append(
      el("button", {
        class: "left-layer-btn" + (active ? " is-active" : ""),
        attrs: {
          type: "button",
          title: `${label} (${layer.hotkey}) — ${layer.hint}`,
          "aria-label": `${label} 레이어`,
          ...(active ? { "aria-current": "true" } : {}),
        },
        dataset: { testid: layer.testId, sidebarLayer: layer.id },
        // 글리프는 달지 않는다 — 세 단추가 전부 같은 layers 아이콘이라 구분력 없이 폭만 먹었다.
        // 세그먼트 컨트롤은 라벨만으로 읽힌다.
        children: [
          el("span", { class: "left-layer-btn-label", text: label }),
        ],
        on: { click: () => {
          selectSidebarLayer(layer.id);
          window.dispatchEvent(new Event("oprn:ai-sidebar-tools"));
        } },
      }),
    );
  }
  applyRovingTabindex(row);
  return row;
}
