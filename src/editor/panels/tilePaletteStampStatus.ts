import { comboBrushBadge, isComboBrush } from "@/editor/comboBrush";
import { EDITOR_BRUSH_SIZES, type EditorState } from "@/editor/editorState";
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

/** Beginner keeps its button group; focus modes expose only applicable brush size. */
export function makeTileBrushControls(state: EditorState, rerender: () => void): HTMLElement {
  const stamp = state.activePaletteStamp;
  const shape = { pen: "칠하기", rect: "사각형", round: "타원" }[state.paintShape];
  const action = state.tool === "paint"
    ? tileBrushActionLabel(stamp) ?? shape
    : { erase: "지우기", fill: "채우기", select: "선택", eyedropper: "집기", pan: "화면 밀기", collision: "통행 표시", event: "이벤트" }[state.tool];
  const composite = isComboBrush(stamp);
  const layer = layerUiLabel(state.layer);
  const row = el("div", { class: "sidebar-brush-controls", dataset: { testid: "tile-brush-controls" } });
  if (!getEditorChrome().paletteRail) {
    const applicable = state.layer !== "event" && (state.tool === "erase" || (state.tool === "paint" && state.paintShape === "pen" && !stamp));
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
    return row;
  }
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
  row.append(sizes, el("span", {
    class: "sidebar-brush-state" + (composite ? " is-combo-brush" : ""),
    // 합성 붓은 배지가 이미 레이어를 말한다 — "바닥+상위 · 바닥"처럼 중복하지 않는다.
    text: composite ? action : `${action} · ${layer}`,
    dataset: { testid: "tile-brush-state", shape: state.paintShape, layer: state.layer,
      brushKind: composite ? "combo" : stamp ? "stamp" : "repeat",
      stampWidth: String(stamp?.width ?? 0), stampHeight: String(stamp?.height ?? 0), stampCells: String(stamp?.cells.length ?? 0) },
  }));
  if (stamp) row.append(el("button", {
    class: "btn", text: composite ? "조합 붓 해제" : "도장 해제", attrs: { type: "button" }, dataset: { testid: "palette-stamp-clear" },
    on: { click: () => { selectTileTool("pen"); rerender(); } },
  }));
  return row;
}
