import { EDITOR_BRUSH_SIZES, type EditorState } from "@/editor/editorState";
import { setTileBrushSize, selectTileTool } from "@/editor/panels/tileToolbarActions";
import { el } from "@/util/dom";
import { getEditorChrome } from "@/editor/editorUiMode";

/** Beginner keeps its button group; focus modes expose only applicable brush size. */
export function makeTileBrushControls(state: EditorState, rerender: () => void): HTMLElement {
  const stamp = state.activePaletteStamp;
  const shape = { pen: "칠하기", rect: "사각형", round: "타원" }[state.paintShape];
  const action = state.tool === "paint"
    ? stamp ? `도장 ${stamp.width}×${stamp.height}` : shape
    : { erase: "지우기", fill: "채우기", select: "선택", eyedropper: "집기", pan: "화면 밀기", collision: "통행 표시", event: "이벤트" }[state.tool];
  const layer = { lower: "바닥", upper: "덧그림", event: "이벤트" }[state.layer];
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
    row.append(el("span", { class: "sidebar-brush-state", text: action,
      dataset: { testid: "tile-brush-state", tool: state.tool, shape: state.paintShape, layer: state.layer, stampWidth: String(stamp?.width ?? 0), stampHeight: String(stamp?.height ?? 0) } }));
    if (stamp) row.append(el("button", { class: "btn", text: "도장 해제", dataset: { testid: "palette-stamp-clear" },
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
    class: "sidebar-brush-state", text: `${action} · ${layer}`,
    dataset: { testid: "tile-brush-state", shape: state.paintShape, layer: state.layer, stampWidth: String(stamp?.width ?? 0), stampHeight: String(stamp?.height ?? 0) },
  }));
  if (stamp) row.append(el("button", {
    class: "btn", text: "도장 해제", attrs: { type: "button" }, dataset: { testid: "palette-stamp-clear" },
    on: { click: () => { selectTileTool("pen"); rerender(); } },
  }));
  return row;
}
