import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject, DEFAULT_TILESET_ID } from "@/project/defaults";

type FindSimilarTilesData = {
  readonly tileId: number;
  readonly tiles: readonly number[];
  readonly tilesetId: string;
};

function findSimilarTilesData(value: unknown): FindSimilarTilesData {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("find_similar_tiles data must be an object");
  const tileId = Reflect.get(value, "tileId");
  const tiles = Reflect.get(value, "tiles");
  const tilesetId = Reflect.get(value, "tilesetId");
  if (!Number.isInteger(tileId) || !Array.isArray(tiles) || !tiles.every(Number.isInteger) || typeof tilesetId !== "string") {
    throw new Error("find_similar_tiles data shape mismatch");
  }
  return { tileId, tiles, tilesetId };
}

function projectWithTileSemantics(): ReturnType<typeof createBlankProject> {
  const project = createBlankProject();
  const tileset = project.tilesets[DEFAULT_TILESET_ID];
  if (!tileset) throw new Error("default tileset missing");
  tileset.count = 40;
  tileset.tilesPerRow = 10;
  tileset.terrain = Array.from({ length: tileset.count }, () => 0);
  tileset.tileMeta = Array.from({ length: tileset.count }, () => ({ description: "", label: "", source: "unknown" }));
  tileset.tileMeta[22] = { description: "붉은 기와 지붕 기준", label: "붉은 지붕 중앙", role: "roof", source: "user", terrainTag: 7 };
  tileset.tileMeta[21] = { description: "붉은 기와 지붕 왼쪽", label: "붉은 지붕 왼쪽", role: "roof", source: "user", terrainTag: 7 };
  tileset.tileMeta[23] = { description: "붉은 기와 지붕 오른쪽", label: "붉은 지붕 오른쪽", role: "roof", source: "user", terrainTag: 7 };
  tileset.tileMeta[32] = { description: "붉은 기와 지붕 아래", label: "붉은 지붕 아래", role: "roof", source: "user", terrainTag: 7 };
  tileset.tileMeta[12] = { description: "물가 바닥", label: "물 바닥", role: "water", source: "user", terrainTag: 1 };
  tileset.tileMeta[24] = { description: "돌 벽", label: "벽", role: "wall", source: "user", terrainTag: 4 };
  tileset.tileMeta[37] = { description: "먼 지붕", label: "붉은 지붕 장식", role: "roof", source: "user", terrainTag: 7 };
  return project;
}

describe("find_similar_tiles", () => {
  it("ranks nearby role and terrain matches first", () => {
    const project = projectWithTileSemantics();

    const result = runTool({ project }, "find_similar_tiles", { limit: 4, tileId: 22, tilesetId: DEFAULT_TILESET_ID });

    expect(result.ok, result.summary).toBe(true);
    const data = findSimilarTilesData(result.data);
    expect(data).toMatchObject({ tileId: 22, tilesetId: DEFAULT_TILESET_ID });
    expect(data.tiles).toHaveLength(4);
    expect(data.tiles).not.toContain(22);
    expect(data.tiles.slice(0, 3)).toEqual([21, 23, 32]);
  });

  it("honors limit and excludes the source tile", () => {
    const project = projectWithTileSemantics();

    const result = runTool({ project }, "find_similar_tiles", { limit: 2, tileId: 22, tilesetId: DEFAULT_TILESET_ID });

    expect(result.ok, result.summary).toBe(true);
    const data = findSimilarTilesData(result.data);
    expect(data.tiles).toEqual([21, 23]);
  });
});
