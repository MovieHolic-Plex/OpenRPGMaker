import { editorState } from "@/editor/editorState";
import type { EditorBrushSize, PaintShape, Tool } from "@/editor/editorState";

export type TileToolId = "select" | "pen" | "rect" | "round" | "fill" | "erase";

export type MapModeToolId = Extract<Tool, "eyedropper" | "pan" | "collision" | "event">;

const TOOL_PATCHES: Record<TileToolId, { readonly tool: Tool; readonly paintShape: PaintShape }> = {
  erase: { tool: "erase", paintShape: "pen" },
  fill: { tool: "fill", paintShape: "pen" },
  pen: { tool: "paint", paintShape: "pen" },
  rect: { tool: "paint", paintShape: "rect" },
  round: { tool: "paint", paintShape: "round" },
  select: { tool: "select", paintShape: "pen" },
};

export function selectTileTool(tool: TileToolId): void {
  const current = editorState.get();
  const next = TOOL_PATCHES[tool];
  editorState.set({
    activePaletteStamp: null,
    layer: current.layer === "event" ? "lower" : current.layer,
    paintShape: next.paintShape,
    selection: tool === "select" ? current.selection : null,
    tool: next.tool,
  });
}

export function selectMapModeTool(tool: MapModeToolId): void {
  const current = editorState.get();
  editorState.set({
    activePaletteStamp: null,
    layer: tool === "event" ? "event" : current.layer === "event" ? "lower" : current.layer,
    paintShape: "pen",
    selection: null,
    tool,
  });
}

export function selectEyedropperTool(): void {
  selectMapModeTool("eyedropper");
}

export function setTileBrushSize(size: EditorBrushSize): void {
  editorState.set({ brushSize: size });
}

export function isTileToolbarItemActive(tool: TileToolId, activeTool: Tool, activeShape: PaintShape): boolean {
  const next = TOOL_PATCHES[tool];
  return activeTool === next.tool && activeShape === next.paintShape;
}
