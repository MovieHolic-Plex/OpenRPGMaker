import { editorMapTileSize } from "@/editor/mapGeometry";

export interface ChipPlacementRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ChipPlacementCamera {
  readonly worldView: { readonly x: number; readonly y: number };
  readonly zoom: number;
}

export interface ChipPlacementBox {
  readonly width: number;
  readonly height: number;
}

export type ChipPlacementMode = "above" | "below" | "inside" | "corner";

export interface ChipPlacement {
  readonly left: number;
  readonly top: number;
  readonly mode: ChipPlacementMode;
  readonly anchored: boolean;
}

export const CHIP_CORNER_INSET: number = 12;
export const CHIP_REGION_GAP: number = 8;

function clampToViewport(value: number, viewportSize: number, chipSize: number): number {
  const maximum = Math.floor(viewportSize - chipSize);
  if (maximum <= 0) return 0;
  return Math.min(Math.max(Math.round(value), 0), maximum);
}

export function placeAiActivityChip(input: {
  readonly region: ChipPlacementRegion | null;
  readonly camera: ChipPlacementCamera;
  readonly viewport: ChipPlacementBox;
  readonly chip: ChipPlacementBox;
}): ChipPlacement {
  if (input.region === null) {
    return {
      left: CHIP_CORNER_INSET,
      top: CHIP_CORNER_INSET,
      mode: "corner",
      anchored: false,
    };
  }

  const { camera, chip, region, viewport } = input;
  const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1;
  const regionLeft = Math.round((region.x * editorMapTileSize() - camera.worldView.x) * zoom);
  const regionTop = Math.round((region.y * editorMapTileSize() - camera.worldView.y) * zoom);
  const regionWidth = Math.max(1, Math.round(region.width * editorMapTileSize() * zoom));
  const regionHeight = Math.max(1, Math.round(region.height * editorMapTileSize() * zoom));
  const left = regionLeft + (regionWidth - chip.width) / 2;

  let mode: ChipPlacementMode = "above";
  let top = regionTop - CHIP_REGION_GAP - chip.height;
  if (top < 0) {
    const belowTop = regionTop + regionHeight + CHIP_REGION_GAP;
    if (belowTop + chip.height <= viewport.height) {
      mode = "below";
      top = belowTop;
    } else {
      mode = "inside";
      top = regionTop + CHIP_REGION_GAP;
    }
  }

  return {
    left: clampToViewport(left, viewport.width, chip.width),
    top: clampToViewport(top, viewport.height, chip.height),
    mode,
    anchored: true,
  };
}
