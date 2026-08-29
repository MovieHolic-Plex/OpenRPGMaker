// editor/panels/leftLayerSwitcher.ts
// 좌측 사이드바 레이어 전환 (standard / expert).
//
// 왜 사이드바인가 — 실측(2026-08-26 메뉴 감사, .omo/evidence/menu-ia/): 초보 레일에는
// 바닥/덧그림/이벤트 버튼이 있었지만 standard(기본 모드)와 expert 사이드바에는 아예 없었다.
// 그 두 모드에서 레이어를 바꾸는 길은 상단 「도구」 메뉴이거나 전문가 클래식 툴바뿐이었다.
// 레이어 전환은 맵을 그리는 동안 도구 선택 다음으로 잦은 조작이다 — 매번 상단 메뉴를 열게
// 만드는 것은 빈도와 거리(距離)가 뒤집힌 배치였다. 그래서 레이어는 사이드바가 소유하고,
// 상단 메뉴/툴바에서는 제거했다(중복 제거 계약: test/editorMenuSidebarIa.test.ts).
//
// 레이어 이름은 uiCopy 단일 원천을 쓴다 — 여기서 문자열을 새로 적으면 화면마다 달라진다.

import { editorState, type Layer } from "@/editor/editorState";
import { uiLabel, type UiCopyKey } from "@/editor/uiCopy";
import { el } from "@/util/dom";
import { makeSvgIcon } from "@/editor/panels/tileToolbarIcons";

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

/**
 * 레이어 전환의 도구 동반 규칙은 초보 레일(basicLeftRail.applyLayerSelection)과 같다:
 * 이벤트 레이어는 이벤트 도구를 함께 켜고, 타일 레이어로 돌아올 때 이벤트 도구는 칠하기로 되돌린다.
 * 두 표면이 다르게 동작하면 모드를 바꿀 때마다 손에 익은 규칙이 깨진다.
 */
export function selectSidebarLayer(layer: Layer): void {
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
    dataset: { testid: "left-layer-switcher" },
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
        children: [
          makeSvgIcon("layers"),
          el("span", { class: "left-layer-btn-label", text: label }),
        ],
        on: { click: () => selectSidebarLayer(layer.id) },
      }),
    );
  }
  return row;
}
