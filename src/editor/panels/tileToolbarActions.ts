import { comboBrushStampFromCatalog, type ComboBrushCatalogEntry } from "@/editor/comboBrushCatalog";
import { editorState } from "@/editor/editorState";
import type { EditorBrushSize, PaintShape, Tool } from "@/editor/editorState";
import { dismissLocationDrawModeForTool, isLocationDrawMode } from "@/editor/locationDrawMode";
import { defaultPaintLayerForTile } from "@/editor/tileLayerClassification";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";
import type { TilesetDef } from "@/project/types";

export type TileToolId = "select" | "pen" | "rect" | "round" | "fill" | "erase";

export type MapModeToolId = Extract<Tool, "eyedropper" | "pan" | "collision" | "event" | "relief">;

const TOOL_PATCHES: Record<TileToolId, { readonly tool: Tool; readonly paintShape: PaintShape }> = {
  erase: { tool: "erase", paintShape: "pen" },
  fill: { tool: "fill", paintShape: "pen" },
  pen: { tool: "paint", paintShape: "pen" },
  rect: { tool: "paint", paintShape: "rect" },
  round: { tool: "paint", paintShape: "round" },
  select: { tool: "select", paintShape: "pen" },
};

export function selectTileTool(tool: TileToolId): void {
  dismissLocationDrawModeForTool(TOOL_PATCHES[tool].tool);
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
  dismissLocationDrawModeForTool(tool);
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

/**
 * 붓을 잡는다. **해제하거나 다른 붓을 고를 때까지 살아 있다** — 반복 배치의 전제다.
 * (페인트는 activePaletteStamp 를 지우지 않는다. 타일 단일 선택·도구 전환·스포이트만 지운다.)
 */
export function selectPaletteStamp(stamp: PaletteStamp): void {
  dismissLocationDrawModeForTool("paint");
  editorState.set({ activePaletteStamp: stamp, tool: "paint", paintShape: "pen", selection: null });
}

/**
 * 큰레이션 조합 → 활성 Combo Brush. 같은 조합을 다시 누르면 해제한다(구조 킷 선반과 같은 규약).
 *
 * 레이어는 목록에 적힌 값을 그대로 믿지 않고 **이 타일셋의 실제 판정**(defaultPaintLayerForTile)으로
 * 다시 쓴다. 목록은 기본 칩셋 기준이고(curatedComboBrushesForTileset 가 거르지만), 사용자가
 * DB 타일셋 편집기에서 레이어를 바꿔 둔 경우 그 의사가 이긴다.
 */
export function selectCuratedComboBrush(entry: ComboBrushCatalogEntry, tileset: TilesetDef): void {
  const current = editorState.get().activePaletteStamp;
  if (current?.origin === "curated" && current.label === entry.name) {
    editorState.set({ activePaletteStamp: null });
    return;
  }
  const base = comboBrushStampFromCatalog(entry);
  selectPaletteStamp({
    ...base,
    cells: base.cells.map((cell) => ({ ...cell, layer: defaultPaintLayerForTile(tileset, cell.tile) })),
  });
}

export function setTileBrushSize(size: EditorBrushSize): void {
  editorState.set({ brushSize: size });
}

export function isTileToolbarItemActive(tool: TileToolId, activeTool: Tool, activeShape: PaintShape): boolean {
  if (isLocationDrawMode()) return false;
  const next = TOOL_PATCHES[tool];
  return activeTool === next.tool && activeShape === next.paintShape;
}
