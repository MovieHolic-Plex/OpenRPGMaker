import { EDITOR_BRUSH_SIZES, type EditorState } from "@/editor/editorState";
import { setTileBrushSize, selectTileTool } from "@/editor/panels/tileToolbarActions";
import { el } from "@/util/dom";

/** Shared compact, always-visible brush controls for every sidebar density. */
export function makeTileBrushControls(state: EditorState, rerender: () => void): HTMLElement {
  const stamp = state.activePaletteStamp;
  const shape = { pen: "칠하기", rect: "사각형", round: "타원" }[state.paintShape];
  const action = state.tool === "paint"
    ? stamp ? `도장 ${stamp.width}×${stamp.height}` : shape
    : { erase: "지우기", fill: "채우기", select: "선택", eyedropper: "집기", pan: "화면 밀기", collision: "통행 표시", event: "이벤트" }[state.tool];
  const layer = { lower: "바닥", upper: "덧그림", event: "이벤트" }[state.layer];
  const row = el("div", { class: "sidebar-brush-controls", dataset: { testid: "tile-brush-controls" } });
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
    class: "sidebar-brush-state", text: `${action} · ${layer}`,
    dataset: { testid: "tile-brush-state", shape: state.paintShape, layer: state.layer, stampWidth: String(stamp?.width ?? 0), stampHeight: String(stamp?.height ?? 0) },
  }));
  if (stamp) row.append(el("button", {
    class: "btn", text: "도장 해제", attrs: { type: "button" }, dataset: { testid: "palette-stamp-clear" },
    on: { click: () => { selectTileTool("pen"); rerender(); } },
  }));
  return row;
}
