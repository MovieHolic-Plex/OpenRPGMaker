import { beforeEach, describe, expect, it } from "vitest";
import { paintTilesBulk } from "@/editor/tileActions";
import { autotilePaintTile } from "@/editor/panels/tilePaletteCatalog";
import { createBlankProject } from "@/project/defaults";
import { JOSEON_BARAM_ID } from "@/project/defaults/joseonBaram";
import { store } from "@/project/store";
import type { GameMap } from "@/project/types";

/**
 * 스마트 팔레트 「조선 흙길」은 꽉 찬 이웃 칸(mask 255)을 붓으로 쓴다.
 * 이웃 연결 토글이 수동이어도 오토타일 붓은 가장자리를 다시 맞춘다.
 * 시트는 16칸 blob(mask 0 = 외톨이, 가로 양끝·가운데가 서로 다른 칸).
 */
describe("joseon dirt autotile paint", () => {
  const mapId = "map_joseon_dirt";

  beforeEach(() => {
    const project = createBlankProject();
    const tileset = project.tilesets[JOSEON_BARAM_ID];
    expect(tileset?.autotileGroups?.some((group) => group.id === "jb_road16_autotile")).toBe(true);
    const width = 20;
    const height = 15;
    const map: GameMap = {
      id: mapId,
      name: "joseon dirt",
      width,
      height,
      tilesetId: JOSEON_BARAM_ID,
      tileSize: tileset!.tileSize,
      lowerTiles: Array.from({ length: width * height }, () => 0),
      upperTiles: Array.from({ length: width * height }, () => -1),
      events: [],
    };
    project.maps[mapId] = map;
    project.startMapId = mapId;
    store.replace(project);
  });

  it("reshapes a dirt path when the neighbor toggle is manual", () => {
    const tileset = store.getCurrent().tilesets[JOSEON_BARAM_ID]!;
    const road = tileset.autotileGroups!.find((group) => group.id === "jb_road16_autotile")!;
    const brush = autotilePaintTile(road);
    expect(brush).toBe(road.variantMap["255"]);
    // 맵 가장자리는 edgeConnects 라 바깥을 이웃으로 친다. 가운데 세 칸만 본다.
    paintTilesBulk(mapId, [
      { layer: "lower", x: 8, y: 7, tile: brush },
      { layer: "lower", x: 9, y: 7, tile: brush },
      { layer: "lower", x: 10, y: 7, tile: brush },
    ], { autoConnect: false });
    const map = store.getCurrent().maps[mapId]!;
    const at = (x: number, y: number) => map.lowerTiles[y * map.width + x]!;
    expect(at(8, 7)).toBe(road.variantMap["2"]);
    expect(at(9, 7)).toBe(road.variantMap["10"]);
    expect(at(10, 7)).toBe(road.variantMap["8"]);
    expect(new Set([at(8, 7), at(9, 7), at(10, 7)]).size).toBe(3);
    expect(at(8, 7)).not.toBe(brush);
    expect(at(9, 7)).not.toBe(at(8, 7));
  });

  it("turns one interior click into the isolated cap, not the full body", () => {
    const tileset = store.getCurrent().tilesets[JOSEON_BARAM_ID]!;
    const road = tileset.autotileGroups!.find((group) => group.id === "jb_road16_autotile")!;
    const brush = autotilePaintTile(road);
    paintTilesBulk(mapId, [{ layer: "lower", x: 8, y: 7, tile: brush }], { autoConnect: false });
    const map = store.getCurrent().maps[mapId]!;
    expect(map.lowerTiles[7 * map.width + 8]).toBe(road.variantMap["0"]);
  });
});
