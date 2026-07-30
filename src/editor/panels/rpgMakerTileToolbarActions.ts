import { editorState } from "@/editor/editorState";
import type { EditorBrushSize, PaintShape, Tool } from "@/editor/editorState";

export type RpgMakerTileTool = "select" | "pen" | "rect" | "round" | "fill" | "erase";

const TOOL_PATCHES: Record<RpgMakerTileTool, { readonly tool: Tool; readonly paintShape: PaintShape }> = {
  erase: { tool: "erase", paintShape: "pen" },
  fill: { tool: "fill", paintShape: "pen" },
  pen: { tool: "paint", paintShape: "pen" },
  rect: { tool: "paint", paintShape: "rect" },
  round: { tool: "paint", paintShape: "round" },
  select: { tool: "select", paintShape: "pen" },
};

export function selectRpgMakerTileTool(tool: RpgMakerTileTool): void {
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

export function selectRpgMakerEyedropperTool(): void {
  const current = editorState.get();
  editorState.set({
    activePaletteStamp: null,
    layer: current.layer === "event" ? "lower" : current.layer,
    paintShape: "pen",
    selection: null,
    tool: "eyedropper",
  });
}

export function setRpgMakerBrushSize(size: EditorBrushSize): void {
  editorState.set({ brushSize: size });
}

export function isRpgMakerToolbarItemActive(tool: RpgMakerTileTool, activeTool: Tool, activeShape: PaintShape): boolean {
  const next = TOOL_PATCHES[tool];
  return activeTool === next.tool && activeShape === next.paintShape;
}
