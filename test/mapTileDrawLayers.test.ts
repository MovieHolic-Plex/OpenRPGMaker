import { describe, expect, it } from "vitest";
import { drawMapTileLayers, type TilesetCanvasImage } from "@/editor/mapTileDraw";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, TilesetDef } from "@/project/types";

// 지형 합성·받침이 없는 최소 커스텀 타일셋(4열 16px).
function plainTileset(): TilesetDef {
  const count = 16;
  const pass = { up: true, down: true, left: true, right: true };
  return {
    id: "plain", name: "plain", kind: "custom", image: { type: "uploaded", id: "plain_img" },
    tileSize: 16, tilesPerRow: 4, count,
    passability: Array.from({ length: count }, () => ({ ...pass })),
    priority: Array.from({ length: count }, () => "lower" as const),
    terrain: Array.from({ length: count }, () => 0),
  } as TilesetDef;
}

function recordingContext(calls: string[]): CanvasRenderingContext2D {
  return {
    // 9인자 drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh): sx, sy 로 타일 식별.
    drawImage: (...args: number[]) => calls.push(`img ${args[1]},${args[2]}`),
    fillRect: (x: number, y: number, w: number) => calls.push(`shade ${x},${y},${w}`),
    save: () => undefined, restore: () => undefined, fillStyle: "", imageSmoothingEnabled: false,
  } as unknown as CanvasRenderingContext2D;
}

describe("drawMapTileLayers 4층 + 그림자", () => {
  it("그리는 순서는 1층 → 2층 → 그림자 → 3층 → 4층", () => {
    const project = createBlankProject();
    const map: GameMap = { ...project.maps[project.startMapId]!, width: 1, height: 1, lowerTiles: [1], upperTiles: [3],
      lowerOverlayTiles: [2], upperOverlayTiles: [5], shadowBits: [0b0001], tilesetId: "plain" };
    const calls: string[] = [];
    drawMapTileLayers(recordingContext(calls), {} as TilesetCanvasImage, map, plainTileset(), 1);
    expect(calls).toEqual(["img 16,0", "img 32,0", "shade 0,0,8", "img 48,0", "img 16,16"]);
  });

  it("새 칸이 없는 옛 맵은 1층·3층만 그린다", () => {
    const project = createBlankProject();
    const map: GameMap = { ...project.maps[project.startMapId]!, width: 1, height: 1, lowerTiles: [1], upperTiles: [3], tilesetId: "plain" };
    delete map.lowerOverlayTiles;
    delete map.upperOverlayTiles;
    delete map.shadowBits;
    const calls: string[] = [];
    drawMapTileLayers(recordingContext(calls), {} as TilesetCanvasImage, map, plainTileset(), 1);
    expect(calls).toEqual(["img 16,0", "img 48,0"]);
  });

  it("그림자 조각은 배율이 곱해진 칸 크기의 ¼ 자리에 앉는다", () => {
    const project = createBlankProject();
    const map: GameMap = { ...project.maps[project.startMapId]!, width: 2, height: 1, lowerTiles: [-1, -1], upperTiles: [-1, -1],
      shadowBits: [0, 0b1010], tilesetId: "plain" };
    const calls: string[] = [];
    drawMapTileLayers(recordingContext(calls), {} as TilesetCanvasImage, map, plainTileset(), 2);
    expect(calls).toEqual(["shade 48,0,16", "shade 48,16,16"]);
  });
});
