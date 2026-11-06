import { beforeEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { landRectCells, paintLandCells } from "@/editor/terrainLandBrush";
import { cutPieceFor } from "@/project/relief/cutPieces";
import { reliefRenderOptions } from "@/project/relief/screen";
import rampArt from "@/project/relief/rampArt.json";
import { layerTileAt } from "@/project/mapLayers";
import type { ReliefArtPatch } from "@/project/relief/render";

const current = () => { const p = store.getCurrent(); return p.maps[p.startMapId]!; };

describe("물가·경사로", () => {
  beforeEach(() => { store.replaceProject(createBlankProject()); });

  it("물 칸 둘레 낮은 땅은 돌 둑이 아니라 모래 물가가 된다", () => {
    const map = current();
    const lakeTile = layerTileAt(map, 1, 0);
    paintLandCells(map.id, landRectCells(map, { x: 5, y: 5 }, { x: 9, y: 8 }), "water", true);
    const after = current();
    const ring = [4 * map.width + 6, 9 * map.width + 6, 6 * map.width + 4, 6 * map.width + 10];
    expect(ring.every((i) => layerTileAt(after, 1, i) !== lakeTile)).toBe(true);
    const water = layerTileAt(after, 1, 6 * map.width + 6);
    expect(ring.every((i) => layerTileAt(after, 1, i) !== water)).toBe(true);
  });

  it("양식 없는 맵의 경사로도 조각 그림을 고르고, 폭 4~8 은 2·3 조각을 이어 붙인다", () => {
    const pieces = (rampArt as Record<string, { pieces?: Record<string, ReliefArtPatch> }>)["grass-steps"]!.pieces!;
    for (const w of [4, 5, 6, 8]) expect(cutPieceFor(pieces, "ramp", "n", w, 1, 2)?.w).toBe(w * 16);
    const w = 20, h = 15, levels = new Array<number>(w * h).fill(0), ramps = new Array<number>(w * h).fill(0);
    for (let y = 3; y < 9; y++) for (let x = 5; x < 15; x++) levels[y * w + x] = 2;
    for (let x = 8; x < 12; x++) for (let y = 9; y < 11; y++) ramps[y * w + x] = 1;
    const options = reliefRenderOptions({ width: w, height: h, levels, ramps });
    expect(options.rampArt).toBeDefined();
  });
});
