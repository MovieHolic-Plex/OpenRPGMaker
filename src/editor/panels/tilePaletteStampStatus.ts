import { comboBrushBadge, isComboBrush } from "@/editor/comboBrush";
import { EDITOR_BRUSH_SIZES, editorState, type EditorState } from "@/editor/editorState";
import type { ReliefBrushMode } from "@/project/relief/edit";
import { reliefInverseMode } from "@/editor/reliefBrushMode";
import { RELIEF_MAX_LEVEL } from "@/project/relief/types";
import { setTileBrushSize, selectTileTool } from "@/editor/panels/tileToolbarActions";
import { el } from "@/util/dom";
import { getEditorChrome } from "@/editor/editorUiMode";
import { layerUiLabel } from "@/editor/uiCopy";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";

/**
 * 붓 한 줄 표기 — 합성 Combo Brush 와 반복 붓(브러시 크기)을 여기서 가른다.
 *  · 합성(2칸 이상)  → comboBrushBadge 가 유일한 문구의 집이다(칸 수·레이어까지 말한다).
 *  · 1칸 도장    → 배열 정보가 없으므로 그저 "도장 1×1". «N×N» 만 보고 합성이라고 오해하면 안 된다.
 *  · 도장이 없으면 브러시 크기 선택(1×1·3×3·4×4)은 같은 타일을 되풀이하는 것이다.
 */
export function tileBrushActionLabel(stamp: PaletteStamp | null): string | null {
  if (!stamp) return null;
  if (isComboBrush(stamp)) {
    const badge = comboBrushBadge(stamp);
    return stamp.label ? `${stamp.label} · ${badge}` : badge;
  }
  return `도장 ${stamp.width}×${stamp.height}`;
}

/** Both modes expose brush size only where it applies; beginner keeps its button group, focus modes a select. */
export function makeTileBrushControls(state: EditorState, rerender: () => void): HTMLElement {
  const stamp = state.activePaletteStamp;
  const shape = { pen: "칠하기", rect: "사각형", round: "타원" }[state.paintShape];
  const action = state.tool === "paint"
    ? tileBrushActionLabel(stamp) ?? shape
    : { erase: "지우기", fill: "채우기", select: "선택", eyedropper: "집기", pan: "화면 밀기", collision: "통행 표시", event: "이벤트", relief: "높이" }[state.tool];
  const composite = isComboBrush(stamp);
  const layer = layerUiLabel(state.layer);
  const row = el("div", { class: "sidebar-brush-controls", dataset: { testid: "tile-brush-controls" } });
  // 크기는 같은 타일을 되풀이하는 붓(칠하기 · 자유선)과 지우기에서만 뜻이 있다 — 다른 도구에선 숨긴다.
  const applicable = state.layer !== "event" && (state.tool === "erase" || state.tool === "relief" || (state.tool === "paint" && state.paintShape === "pen" && !stamp));
  if (!getEditorChrome().paletteRail) {
    if (applicable) {
      const select = el("select", {
        attrs: { "aria-label": "브러시 크기" }, dataset: { testid: "brush-size-select" },
        on: { change: (event) => {
          if (!(event.currentTarget instanceof HTMLSelectElement)) return;
          const value = event.currentTarget.value;
          const size = EDITOR_BRUSH_SIZES.find(size => String(size) === value);
          if (size !== undefined) { setTileBrushSize(size); rerender(); }
        } },
      });
      for (const size of EDITOR_BRUSH_SIZES) select.append(el("option", { value: String(size), text: `${size} × ${size}` }));
      select.value = String(state.brushSize);
      row.append(el("label", { class: "sidebar-brush-sizes", children: [el("span", { text: "크기" }), select] }));
    }
    row.append(el("span", { class: "sidebar-brush-state" + (composite ? " is-combo-brush" : ""), text: action,
      dataset: { testid: "tile-brush-state", tool: state.tool, shape: state.paintShape, layer: state.layer,
        brushKind: composite ? "combo" : stamp ? "stamp" : "repeat",
        stampWidth: String(stamp?.width ?? 0), stampHeight: String(stamp?.height ?? 0), stampCells: String(stamp?.cells.length ?? 0) } }));
    if (stamp) row.append(el("button", { class: "btn", text: composite ? "조합 붓 해제" : "도장 해제", dataset: { testid: "palette-stamp-clear" },
      on: { click: () => { selectTileTool("pen"); rerender(); } } }));
    if (state.tool === "relief") row.append(makeReliefBrushControls(state, rerender));
    return row;
  }
  const brushState = el("span", {
    class: "sidebar-brush-state" + (composite ? " is-combo-brush" : ""),
    // 합성 붓은 배지가 이미 레이어를 말한다 — "바닥+상위 · 바닥"처럼 중복하지 않는다.
    // 이벤트 레이어는 도구 이름이 곧 레이어라 "이벤트 · 이벤트"로 겹쳐 읽히지 않게 한 번만 쓴다.
    text: composite || state.layer === "event" ? action : `${action} · ${layer}`,
    dataset: { testid: "tile-brush-state", shape: state.paintShape, layer: state.layer,
      brushKind: composite ? "combo" : stamp ? "stamp" : "repeat",
      stampWidth: String(stamp?.width ?? 0), stampHeight: String(stamp?.height ?? 0), stampCells: String(stamp?.cells.length ?? 0) },
  });
  row.append(brushState);
  if (applicable) {
    const sizes = el("div", {
      class: "sidebar-brush-sizes", attrs: { role: "group", "aria-label": "브러시 크기" },
      dataset: { roving: "true" },
    });
    sizes.append(el("span", { class: "tile-brush-label", text: "크기" }));
    for (const size of EDITOR_BRUSH_SIZES) {
      sizes.append(el("button", {
        class: "btn tile-brush-chip" + (state.brushSize === size ? " active" : ""), text: String(size),
        attrs: { type: "button", "aria-label": `브러시 ${size} x ${size}`, "aria-pressed": String(state.brushSize === size) },
        dataset: { testid: `brush-size-${size}` },
        on: { click: () => { setTileBrushSize(size); rerender(); } },
      }));
    }
    row.append(sizes);
  }
  if (stamp) row.append(el("button", {
    class: "btn", text: composite ? "조합 붓 해제" : "도장 해제", attrs: { type: "button" }, dataset: { testid: "palette-stamp-clear" },
    on: { click: () => { selectTileTool("pen"); rerender(); } },
  }));
  if (state.tool === "relief") row.append(makeReliefBrushControls(state, rerender));
  return row;
}

const RELIEF_MODES: readonly (readonly [ReliefBrushMode, string, string])[] = [
  ["raise", "올리기", "누른 칸보다 한 단 높게 — 드래그해도 한 단까지만 쌓인다"],
  ["lower", "내리기", "누른 칸보다 한 단 낮게"],
  ["flatten", "평탄", "누른 칸 높이로 고른다"],
  ["set", "단 지정", "고른 단으로 맞춘다"],
  ["mountain", "산", "고른 단 높이 봉우리를 경사로 쌓는다 — 끌면 능선"],
  ["canyon", "골짜기", "붓 폭만큼 0단까지 판다 — 끌면 골"],
  ["smooth", "다듬기", "주변 평균으로 부드럽게"],
  ["rough", "거칠게", "절벽 가장자리를 들쭉날쭉 깎는다"],
];

const RELIEF_MODE_LABEL = Object.fromEntries(RELIEF_MODES.map(([mode, label]) => [mode, label])) as Record<ReliefBrushMode, string>;

/** 오른쪽 버튼이 하는 일 — TilePaintEngine.reliefInverseMode 와 같은 표를 글로 옮긴다. */
function reliefRightButtonLabel(mode: ReliefBrushMode): string {
  const inverse = reliefInverseMode(mode);
  return inverse === "set" ? "0단으로 지우기" : RELIEF_MODE_LABEL[inverse];
}

/** 「높이」 붓 방식 · 단 — map.relief(절벽 높이)를 칠한다. 크기 칩은 위 공통 줄을 쓴다. */
function makeReliefBrushControls(state: EditorState, rerender: () => void): HTMLElement {
  const group = el("div", {
    class: "sidebar-brush-sizes relief-brush-controls", attrs: { role: "group", "aria-label": "높이 붓 방식" },
    dataset: { testid: "relief-brush-controls", roving: "true" },
  });
  group.append(el("span", { class: "tile-brush-label", text: "방식" }));
  for (const [mode, label, title] of RELIEF_MODES) {
    group.append(el("button", {
      class: "btn tile-brush-chip" + (state.reliefMode === mode ? " active" : ""), text: label,
      attrs: { type: "button", title: `${title} · 오른쪽 버튼: ${reliefRightButtonLabel(mode)}`, "aria-pressed": String(state.reliefMode === mode) },
      dataset: { testid: `relief-mode-${mode}` },
      on: { click: () => { editorState.set({ reliefMode: mode }); rerender(); } },
    }));
  }
  if (state.reliefMode === "set" || state.reliefMode === "mountain") {
    const select = el("select", {
      attrs: { "aria-label": state.reliefMode === "mountain" ? "봉우리 단" : "맞출 단" }, dataset: { testid: "relief-level-select" },
      on: { change: (event) => {
        if (!(event.currentTarget instanceof HTMLSelectElement)) return;
        editorState.set({ reliefLevel: Number(event.currentTarget.value) || 0 });
        rerender();
      } },
    });
    for (let level = 0; level <= RELIEF_MAX_LEVEL; level++) select.append(el("option", { value: String(level), text: `${level}단` }));
    select.value = String(state.reliefLevel);
    group.append(select);
  }
  group.append(el("span", {
    class: "relief-brush-hint",
    text: `왼쪽: ${RELIEF_MODE_LABEL[state.reliefMode]} · 오른쪽: ${reliefRightButtonLabel(state.reliefMode)}`,
    dataset: { testid: "relief-brush-hint" },
  }));
  return group;
}
