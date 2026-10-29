// 모든 편집 모드의 앱 헤더 레이어 전환. 이름은 uiCopy 단일 원천을 쓴다.

import { editorState, type EditorState, type Layer } from "@/editor/editorState";
import { selectMapModeTool } from "@/editor/panels/tileToolbarActions";
import { uiLabel, type UiCopyKey } from "@/editor/uiCopy";
import { dismissLocationDrawModeForLayer } from "@/editor/locationDrawMode";
import { applyRovingTabindex } from "./sidebarFocus";
import { el } from "@/util/dom";

/** 「지형」은 레이어가 아니라 편집 도구다 — 레이어 고르기 묶음 밖의 단추로 둔다. */
export type LayerSwitcherKey = Layer | "relief";

type LayerRow = {
  readonly id: Layer;
  readonly copyKey: UiCopyKey;
  readonly testId: string;
  readonly hint: string;
  /** 보이는 표기 · aria-keyshortcuts. F5(새로고침)·F6(창 영역 이동)은 브라우저 키라 쓰지 않는다. */
  readonly hotkey: string;
  readonly keys: string;
};

const LAYER_ROWS: readonly LayerRow[] = [
  { id: "lower", copyKey: "layerLower", testId: "layer-lower", hint: "잔디·길 등 지면", hotkey: "Shift+1", keys: "Shift+1" },
  { id: "upper", copyKey: "layerUpper", testId: "layer-upper", hint: "나무·가구 등 바닥 위에 얹는 것", hotkey: "Shift+2", keys: "Shift+2" },
  { id: "event", copyKey: "layerEvent", testId: "layer-event", hint: "NPC·문·보물상자 등 상호작용", hotkey: "Shift+3 · F7", keys: "Shift+3 F7" },
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

/** 전환 줄에서 켜져 보일 칸. 지형 도구를 쥐고 있으면 레이어가 아니라 「지형」이 켜진다. */
export function layerSwitcherKey(state: Pick<EditorState, "layer" | "tool">): LayerSwitcherKey {
  return state.tool === "relief" ? "relief" : state.layer;
}

/**
 * 「지형 붓」 단추와 레이어 고르기(radiogroup) 둘을 돌려준다.
 * 예전에는 붓 모드와 레이어 셋을 한 세그먼트에 섞어, 바닥 레이어인지 지형 붓인지 한 컨트롤이 두 개념을 말했다.
 * 레이어 단추의 접근 이름은 보이는 글자 + 「레이어」(숨김 글자)라 음성 제어로 보이는 말을 그대로 부를 수 있다.
 */
export function makeLeftLayerSwitcher(state: Pick<EditorState, "layer" | "tool">): readonly [HTMLButtonElement, HTMLElement] {
  const reliefLabel = uiLabel("layerRelief");
  const relief = el("button", {
    class: "left-layer-btn header-relief-brush",
    attrs: { type: "button", title: `${reliefLabel} 붓 — 언덕·절벽 지형 편집`, "aria-pressed": "false" },
    dataset: { testid: "layer-relief", sidebarLayer: "relief" },
    children: [
      el("span", { class: "left-layer-btn-label", text: reliefLabel }),
      el("span", { class: "visually-hidden", text: " 붓" }),
    ],
    on: { click: () => {
      selectSwitcherKey(editorState.get().tool === "relief" ? editorState.get().layer : "relief");
      window.dispatchEvent(new Event("oprn:ai-sidebar-tools"));
    } },
  }) as HTMLButtonElement;
  const row = el("div", {
    class: "left-layer-switcher",
    attrs: { role: "radiogroup", "aria-label": "레이어" },
    dataset: { testid: "left-layer-switcher", roving: "true" },
  });
  for (const layer of LAYER_ROWS) {
    const label = uiLabel(layer.copyKey);
    row.append(
      el("button", {
        class: "left-layer-btn",
        attrs: {
          type: "button",
          role: "radio",
          "aria-checked": "false",
          "aria-keyshortcuts": layer.keys,
          title: `${label} 레이어 (${layer.hotkey}) — ${layer.hint}`,
        },
        dataset: { testid: layer.testId, sidebarLayer: layer.id },
        // 글리프는 달지 않는다 — 세 단추가 전부 같은 layers 아이콘이라 구분력 없이 폭만 먹었다.
        children: [
          el("span", { class: "left-layer-btn-label", text: label }),
          el("span", { class: "visually-hidden", text: " 레이어" }),
        ],
        on: { click: () => {
          selectSidebarLayer(layer.id);
          window.dispatchEvent(new Event("oprn:ai-sidebar-tools"));
        } },
      }),
    );
  }
  applyRovingTabindex(row);
  paintLayerSwitcher(relief, row, state);
  return [relief, row];
}

/** 켜진 레이어(radio)와 지형 붓(토글)을 상태에 맞춘다. 레이어 묶음에 초점이 있으면 tabindex 는 건드리지 않는다. */
export function paintLayerSwitcher(relief: HTMLElement, row: HTMLElement, state: Pick<EditorState, "layer" | "tool">): void {
  const reliefOn = state.tool === "relief";
  relief.classList.toggle("is-active", reliefOn);
  relief.setAttribute("aria-pressed", String(reliefOn));
  const keepFocus = row.contains(document.activeElement);
  for (const button of row.querySelectorAll<HTMLButtonElement>("button")) {
    const active = button.dataset.sidebarLayer === state.layer;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-checked", String(active));
    if (!keepFocus) button.tabIndex = active ? 0 : -1;
  }
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
