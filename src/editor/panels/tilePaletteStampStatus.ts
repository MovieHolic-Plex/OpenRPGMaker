import { comboBrushBadge, isComboBrush } from "@/editor/comboBrush";
import { EDITOR_BRUSH_SIZES, type EditorState } from "@/editor/editorState";
import { setTileBrushSize, selectTileTool } from "@/editor/panels/tileToolbarActions";
import { el } from "@/util/dom";
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

/** 붓 크기 선택은 쓸 수 있는 도구에서만 보인다. */
export function makeTileBrushControls(state: EditorState, rerender: () => void): HTMLElement {
  const stamp = state.activePaletteStamp;
  const shape = { pen: "칠하기", rect: "사각형", round: "타원" }[state.paintShape];
  const action = state.tool === "paint"
    ? tileBrushActionLabel(stamp) ?? shape
    : { erase: "지우기", fill: "채우기", select: "선택", eyedropper: "집기", pan: "화면 밀기", collision: "통행 표시", event: "이벤트", relief: "높이" }[state.tool];
  const composite = isComboBrush(stamp);
  const row = el("div", { class: "sidebar-brush-controls", dataset: { testid: "tile-brush-controls" } });
  // 크기는 같은 타일을 되풀이하는 붓(칠하기 · 자유선)과 지우기에서만 뜻이 있다 — 다른 도구에선 숨긴다.
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
  if (state.tool === "relief") {
    // 방식·크기·상한·윗면 풀·지형지물은 캔버스 아래 「높이」 막대에 있다(reliefToolbar.ts).
    row.append(el("span", { class: "relief-left-hint", text: "방식은 캔버스 아래 막대에서", dataset: { testid: "relief-left-hint" } }));
  }
  return row;
}
