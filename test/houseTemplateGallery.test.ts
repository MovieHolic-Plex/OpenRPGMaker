import { describe, expect, it } from "vitest";
import { createHouseTemplateGalleryProject, DEFAULT_TILESET_ID, TILE } from "@/project/defaults";
import { DIRT_ROAD_TILE } from "@/project/defaults/chipsetMapping";
import { SMALL_HOUSE_01_TERRAIN_TEMPLATE } from "@/project/defaults/smallHouse01TerrainTemplate";
import { isRoadTile } from "@/project/defaults/roadAutotile";

describe("house template gallery project", () => {
  it("keeps the original small_house_01 variant as root with five gallery children", () => {
    const project = createHouseTemplateGalleryProject();
    const maps = Object.values(project.maps);

    expect(maps).toHaveLength(6);
    expect(maps.some((map) => map.name === "small_house_01 변형 1")).toBe(true);
    expect(maps.some((map) => map.name === "small_house_01 변형 2")).toBe(true);
    expect(maps.some((map) => map.name === "small_house_01 변형 3")).toBe(true);
    expect(maps.some((map) => map.name === "small_house_01 변형 4")).toBe(true);
    expect(maps.some((map) => map.name === "small_house_01 변형 5")).toBe(true);
    expect(maps.some((map) => map.name === "small_house_01 도시 8채")).toBe(true);
    expect(project.maps[project.startMapId]?.name).toBe("small_house_01 변형 1");
    expect(project.mapTree.mapId).toBe(project.startMapId);
    expect(project.mapTree.children).toHaveLength(5);
    const childMapId = project.mapTree.children[0]?.mapId;
    expect(childMapId ? project.maps[childMapId]?.name : null).toBe("small_house_01 변형 2");
    const secondChildMapId = project.mapTree.children[1]?.mapId;
    expect(secondChildMapId ? project.maps[secondChildMapId]?.name : null).toBe("small_house_01 변형 3");
    const thirdChildMapId = project.mapTree.children[2]?.mapId;
    expect(thirdChildMapId ? project.maps[thirdChildMapId]?.name : null).toBe("small_house_01 변형 4");
    const fourthChildMapId = project.mapTree.children[3]?.mapId;
    expect(fourthChildMapId ? project.maps[fourthChildMapId]?.name : null).toBe("small_house_01 변형 5");
    const fifthChildMapId = project.mapTree.children[4]?.mapId;
    expect(fifthChildMapId ? project.maps[fifthChildMapId]?.name : null).toBe("small_house_01 도시 8채");
  });

  it("keeps the child variant free of prop objects and shapes its road with autotile", () => {
    const project = createHouseTemplateGalleryProject();
    const childMapId = project.mapTree.children[0]?.mapId;
    const map = childMapId ? project.maps[childMapId] : undefined;

    expect(map?.name).toBe("small_house_01 변형 2");
    if (!map) return;
    expect(map.upperTiles.every((tile) => tile !== TILE.FLOWERS && tile !== TILE.TREE && tile !== 260 && tile !== 288 && tile !== 289 && tile !== 290)).toBe(true);
    expect(Object.values(map.upperTileStacks ?? {}).flat().length).toBe(0);
    expect(map.lowerTiles).toContain(DIRT_ROAD_TILE.BODY);
    expect(map.lowerTiles).toContain(DIRT_ROAD_TILE.EDGE_SOUTH);
    expect(map.lowerTiles).toContain(DIRT_ROAD_TILE.CORNER_SOUTH_EAST);
    for (let index = 0; index < map.lowerTiles.length; index += 1) {
      if (!isRoadTile(map.lowerTiles[index] ?? TILE.EMPTY)) continue;
      expect(map.upperTiles[index]).toBe(TILE.EMPTY);
      expect(map.lowerTileStacks?.[index]).toBeUndefined();
      expect(map.upperTileStacks?.[index]).toBeUndefined();
    }
  });

  it("places the child variant door in the wall-bottom opening before the road starts", () => {
    const project = createHouseTemplateGalleryProject();
    const childMapId = project.mapTree.children[0]?.mapId;
    const map = childMapId ? project.maps[childMapId] : undefined;

    expect(map?.name).toBe("small_house_01 변형 2");
    if (!map) return;
    const doorTopIndex = 9 * map.width + 13;
    const doorBottomIndex = 10 * map.width + 13;
    const firstRoadIndex = 11 * map.width + 13;
    expect(map.lowerTiles[doorTopIndex]).toBe(116);
    expect(map.lowerTiles[doorBottomIndex]).toBe(146);
    expect(isRoadTile(map.lowerTiles[firstRoadIndex] ?? TILE.EMPTY)).toBe(true);
  });

  it("builds the child variant wall as exactly three rows with a dedicated wall-top row", () => {
    const project = createHouseTemplateGalleryProject();
    const childMapId = project.mapTree.children[0]?.mapId;
    const map = childMapId ? project.maps[childMapId] : undefined;

    expect(map?.name).toBe("small_house_01 변형 2");
    if (!map) return;
    const rowTiles = (y: number): number[] => Array.from({ length: 11 }, (_, offset) => map.lowerTiles[y * map.width + 7 + offset] ?? TILE.EMPTY);
    expect(rowTiles(8)).toEqual([15, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17]);
    expect(rowTiles(9)).toEqual([45, 46, 46, 46, 46, 46, 116, 46, 46, 46, 47]);
    expect(rowTiles(10)).toEqual([75, 76, 76, 76, 76, 76, 146, 76, 76, 76, 77]);
    expect(rowTiles(11).every((tile) => tile !== 45 && tile !== 46 && tile !== 47 && tile !== 75 && tile !== 76 && tile !== 77)).toBe(true);
  });

  it("places child variant windows on one regular wall-middle row", () => {
    const project = createHouseTemplateGalleryProject();
    const childMapId = project.mapTree.children[0]?.mapId;
    const map = childMapId ? project.maps[childMapId] : undefined;

    expect(map?.name).toBe("small_house_01 변형 2");
    if (!map) return;
    const windowPositions = map.upperTiles
      .map((tile, index) => ({ tile, x: index % map.width, y: Math.floor(index / map.width) }))
      .filter((placement) => placement.tile === 87);
    expect(windowPositions).toEqual([
      { tile: 87, x: 10, y: 9 },
      { tile: 87, x: 15, y: 9 },
    ]);
    expect(windowPositions[1]?.x - (windowPositions[0]?.x ?? 0)).toBeGreaterThanOrEqual(2);
  });

  it("builds the child variant roof with upper-only diagonals and wall below roof-front", () => {
    const project = createHouseTemplateGalleryProject();
    const childMapId = project.mapTree.children[0]?.mapId;
    const map = childMapId ? project.maps[childMapId] : undefined;

    expect(map?.name).toBe("small_house_01 변형 2");
    if (!map) return;
    const tileAt = (layer: "lower" | "upper", x: number, y: number): number => {
      const tiles = layer === "lower" ? map.lowerTiles : map.upperTiles;
      return tiles[y * map.width + x] ?? TILE.EMPTY;
    };
    expect([tileAt("upper", 7, 4), tileAt("upper", 7, 5), tileAt("upper", 7, 6), tileAt("upper", 7, 7)]).toEqual([354, 376, 376, 384]);
    expect([tileAt("upper", 17, 4), tileAt("upper", 17, 5), tileAt("upper", 17, 6), tileAt("upper", 17, 7)]).toEqual([355, 377, 377, 385]);
    expect([tileAt("lower", 7, 4), tileAt("lower", 7, 5), tileAt("lower", 7, 6), tileAt("lower", 7, 7), tileAt("lower", 7, 8)]).toEqual([TILE.GRASS, TILE.GRASS, TILE.GRASS, 405, 15]);
    expect([tileAt("lower", 17, 4), tileAt("lower", 17, 5), tileAt("lower", 17, 6), tileAt("lower", 17, 7), tileAt("lower", 17, 8)]).toEqual([TILE.GRASS, TILE.GRASS, TILE.GRASS, 405, 17]);
    expect(Array.from({ length: 11 }, (_, offset) => tileAt("upper", 7 + offset, 4))).toEqual([354, 375, 375, 375, 375, 375, 375, 375, 375, 377, 355]);
    expect(Array.from({ length: 11 }, (_, offset) => tileAt("lower", 7 + offset, 7))).toEqual([405, 405, 405, 405, 405, 405, 405, 405, 405, 405, 405]);
    expect(Array.from({ length: 11 }, (_, offset) => tileAt("upper", 7 + offset, 7))).toEqual([384, TILE.EMPTY, TILE.EMPTY, TILE.EMPTY, TILE.EMPTY, TILE.EMPTY, TILE.EMPTY, TILE.EMPTY, TILE.EMPTY, TILE.EMPTY, 385]);
    expect(Array.from({ length: 11 }, (_, offset) => tileAt("lower", 7 + offset, 8))).toEqual([15, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17]);
  });

  it("keeps fences from overlapping house, roof, road, door, or windows", () => {
    const project = createHouseTemplateGalleryProject();
    const childMapId = project.mapTree.children[0]?.mapId;
    const map = childMapId ? project.maps[childMapId] : undefined;

    expect(map?.name).toBe("small_house_01 변형 2");
    if (!map) return;
    const fenceTiles = new Set([378, 379, 380, 408, 438, 409, 410]);
    const blockedLowerTiles = new Set([374, 375, 377, 404, 405, 15, 16, 17, 45, 46, 47, 75, 76, 77, 116, 146, 390, 391, 392, 420, 421, 422, 450, 451, 452]);
    for (let index = 0; index < map.upperTiles.length; index += 1) {
      if (!fenceTiles.has(map.upperTiles[index] ?? TILE.EMPTY)) continue;
      expect(blockedLowerTiles.has(map.lowerTiles[index] ?? TILE.EMPTY)).toBe(false);
      expect(map.lowerTileStacks?.[index]).toBeUndefined();
      expect(map.upperTileStacks?.[index]).toBeUndefined();
    }
  });

  it("adds a wider third child variant generated from the table template rules", () => {
    const project = createHouseTemplateGalleryProject();
    const childMapId = project.mapTree.children[1]?.mapId;
    const map = childMapId ? project.maps[childMapId] : undefined;

    expect(map?.name).toBe("small_house_01 변형 3");
    if (!map) return;
    const tileAt = (layer: "lower" | "upper", x: number, y: number): number => {
      const tiles = layer === "lower" ? map.lowerTiles : map.upperTiles;
      return tiles[y * map.width + x] ?? TILE.EMPTY;
    };
    expect(Array.from({ length: 13 }, (_, offset) => tileAt("upper", 5 + offset, 4))).toEqual([354, 375, 375, 375, 375, 375, 375, 375, 375, 375, 375, 377, 355]);
    expect(Array.from({ length: 13 }, (_, offset) => tileAt("lower", 5 + offset, 7))).toEqual([405, 405, 405, 405, 405, 405, 405, 405, 405, 405, 405, 405, 405]);
    expect(Array.from({ length: 13 }, (_, offset) => tileAt("lower", 5 + offset, 8))).toEqual([15, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17]);
    expect(Array.from({ length: 13 }, (_, offset) => tileAt("lower", 5 + offset, 9))).toEqual([45, 46, 46, 46, 46, 46, 116, 46, 46, 46, 46, 46, 47]);
    expect(Array.from({ length: 13 }, (_, offset) => tileAt("lower", 5 + offset, 10))).toEqual([75, 76, 76, 76, 76, 76, 146, 76, 76, 76, 76, 76, 77]);
    expect(tileAt("upper", 8, 9)).toBe(87);
    expect(tileAt("upper", 14, 9)).toBe(87);
    expect(isRoadTile(tileAt("lower", 11, 11))).toBe(true);
    expect(isRoadTile(tileAt("lower", 12, 11))).toBe(true);
    expect(tileAt("upper", 11, 11)).toBe(TILE.EMPTY);
    expect(tileAt("upper", 12, 11)).toBe(TILE.EMPTY);
    expect(map.upperTiles).not.toContain(374);
    expect(Object.values(map.upperTileStacks ?? {}).flat().length).toBe(0);
  });

  it("adds a connected L-shaped fourth child variant", () => {
    const project = createHouseTemplateGalleryProject();
    const childMapId = project.mapTree.children[2]?.mapId;
    const map = childMapId ? project.maps[childMapId] : undefined;

    expect(map?.name).toBe("small_house_01 변형 4");
    if (!map) return;
    const tileAt = (layer: "lower" | "upper", x: number, y: number): number => {
      const tiles = layer === "lower" ? map.lowerTiles : map.upperTiles;
      return tiles[y * map.width + x] ?? TILE.EMPTY;
    };
    expect(Array.from({ length: 11 }, (_, offset) => tileAt("upper", 4 + offset, 3))).toEqual([354, 375, 375, 375, 375, 375, 375, 375, 375, 377, 355]);
    expect(Array.from({ length: 8 }, (_, offset) => tileAt("upper", 10 + offset, 6))).toEqual([354, 375, 375, 375, 375, 375, 377, 355]);
    expect(Array.from({ length: 5 }, (_, offset) => tileAt("upper", 10 + offset, 6))).not.toContain(TILE.EMPTY);
    expect(Array.from({ length: 5 }, (_, offset) => tileAt("lower", 10 + offset, 6))).toEqual([405, 405, 405, 405, 405]);
    expect(Array.from({ length: 8 }, (_, offset) => tileAt("lower", 10 + offset, 10))).toEqual([15, 16, 16, 16, 16, 16, 16, 17]);
    expect(Array.from({ length: 8 }, (_, offset) => tileAt("lower", 10 + offset, 11))).toEqual([45, 46, 46, 116, 46, 46, 46, 47]);
    expect(Array.from({ length: 8 }, (_, offset) => tileAt("lower", 10 + offset, 12))).toEqual([75, 76, 76, 146, 76, 76, 76, 77]);
    expect(tileAt("upper", 7, 8)).toBe(87);
    expect(tileAt("upper", 11, 11)).toBe(87);
    expect(tileAt("upper", 16, 11)).toBe(87);
    expect(isRoadTile(tileAt("lower", 13, 13))).toBe(true);
    expect(tileAt("upper", 13, 13)).toBe(TILE.EMPTY);
    expect(map.upperTiles).not.toContain(374);
  });

  it("adds a complex fifth child variant with connected stepped roofs", () => {
    const project = createHouseTemplateGalleryProject();
    const childMapId = project.mapTree.children[3]?.mapId;
    const map = childMapId ? project.maps[childMapId] : undefined;

    expect(map?.name).toBe("small_house_01 변형 5");
    if (!map) return;
    const tileAt = (layer: "lower" | "upper", x: number, y: number): number => {
      const tiles = layer === "lower" ? map.lowerTiles : map.upperTiles;
      return tiles[y * map.width + x] ?? TILE.EMPTY;
    };
    expect(Array.from({ length: 15 }, (_, offset) => tileAt("upper", 3 + offset, 2))).toEqual([354, 375, 375, 375, 375, 375, 375, 375, 375, 375, 375, 375, 375, 377, 355]);
    expect(Array.from({ length: 8 }, (_, offset) => tileAt("upper", 3 + offset, 5))).toEqual([354, 375, 375, 375, 375, 375, 377, 355]);
    expect(Array.from({ length: 8 }, (_, offset) => tileAt("upper", 10 + offset, 7))).toEqual([354, 375, 375, 375, 375, 375, 377, 355]);
    expect(Array.from({ length: 15 }, (_, offset) => tileAt("lower", 3 + offset, 5))).toEqual([405, 405, 405, 405, 405, 405, 405, 405, 405, 405, 405, 405, 405, 405, 405]);
    expect(Array.from({ length: 15 }, (_, offset) => tileAt("lower", 3 + offset, 6))).toEqual([15, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17]);
    expect(Array.from({ length: 8 }, (_, offset) => tileAt("lower", 3 + offset, 9))).toEqual([15, 16, 16, 16, 16, 16, 16, 17]);
    expect(Array.from({ length: 8 }, (_, offset) => tileAt("lower", 10 + offset, 11))).toEqual([15, 16, 16, 16, 16, 16, 16, 17]);
    expect(tileAt("upper", 5, 10)).toBe(87);
    expect(tileAt("upper", 11, 12)).toBe(87);
    expect(tileAt("upper", 16, 12)).toBe(87);
    expect(tileAt("lower", 13, 12)).toBe(116);
    expect(tileAt("lower", 13, 13)).toBe(146);
    expect(isRoadTile(tileAt("lower", 13, 14))).toBe(true);
    expect(tileAt("upper", 13, 14)).toBe(TILE.EMPTY);
    expect(map.upperTiles).not.toContain(374);
    expect(Object.values(map.upperTileStacks ?? {}).flat().length).toBe(0);
  });

  it("adds a 50x50 no-fence city map with eight varied small houses", () => {
    const project = createHouseTemplateGalleryProject();
    const childMapId = project.mapTree.children[4]?.mapId;
    const map = childMapId ? project.maps[childMapId] : undefined;

    expect(map?.name).toBe("small_house_01 도시 8채");
    if (!map) return;
    const fenceTiles = new Set([378, 379, 380, 408, 438, 409, 410]);
    const propTiles = new Set([TILE.FLOWERS, TILE.TREE, 260, 288, 289, 290, 292, 293]);
    const tileAt = (layer: "lower" | "upper", x: number, y: number): number => {
      const tiles = layer === "lower" ? map.lowerTiles : map.upperTiles;
      return tiles[y * map.width + x] ?? TILE.EMPTY;
    };

    expect(map.width).toBe(50);
    expect(map.height).toBe(50);
    expect(map.upperTiles.every((tile) => !fenceTiles.has(tile))).toBe(true);
    expect(map.upperTiles.every((tile) => !propTiles.has(tile))).toBe(true);
    expect(Object.values(map.lowerTileStacks ?? {}).flat().length).toBe(0);
    expect(map.upperTiles).not.toContain(374);
    expect(map.upperTiles.filter((tile) => tile === 87)).toHaveLength(16);
    expect(map.lowerTiles.filter((tile) => tile === 116)).toHaveLength(8);
    expect(map.lowerTiles.filter((tile) => tile === 146)).toHaveLength(8);
    expect(map.upperTiles.filter((tile) => tile === 354)).toHaveLength(12);
    expect(map.upperTiles.filter((tile) => tile === 355)).toHaveLength(12);
    expect(tileAt("lower", 8, 10)).not.toBe(146);
    expect(isRoadTile(tileAt("lower", 8, 10))).toBe(true);
    expect(tileAt("upper", 8, 10)).toBe(TILE.EMPTY);
    expect(Array.from({ length: 13 }, (_, offset) => tileAt("lower", 3 + offset, 10)).filter(isRoadTile)).toHaveLength(2);
    expect(Array.from({ length: 13 }, (_, offset) => tileAt("lower", 3 + offset, 7))).toEqual([15, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 17]);
    expect(Array.from({ length: 13 }, (_, offset) => tileAt("upper", 3 + offset, 3))).toEqual([354, 375, 375, 375, 375, 375, 375, 375, 375, 375, 375, 377, 355]);
    expect(Array.from({ length: 7 }, (_, offset) => tileAt("upper", 23 + offset, 6))).toEqual([354, 375, 375, 375, 375, 377, 355]);
    expect(Array.from({ length: 8 }, (_, offset) => tileAt("upper", 10 + offset, 20))).toEqual([354, 375, 375, 375, 375, 375, 377, 355]);
    expect(Array.from({ length: 14 }, (_, offset) => tileAt("upper", 6 + offset, 34))).toEqual([354, 375, 375, 375, 375, 375, 375, 375, 375, 375, 375, 375, 377, 355]);
    for (const hiddenWallPoint of [
      { x: 28, y: 8 },
      { x: 15, y: 22 },
      { x: 40, y: 24 },
      { x: 37, y: 38 },
      { x: 42, y: 27 },
    ]) {
      expect(tileAt("upper", hiddenWallPoint.x, hiddenWallPoint.y)).not.toBe(87);
    }
    for (let index = 0; index < map.upperTiles.length; index += 1) {
      if (map.upperTiles[index] !== 87) continue;
      expect(map.lowerTiles[index]).toBe(46);
    }
    const actualTreeOrigins = map.upperTiles
      .map((tile, index) => ({ index, tile }))
      .filter((entry) => entry.tile === 262)
      .map((entry) => ({ x: entry.index % map.width, y: Math.floor(entry.index / map.width) }));
    expect(actualTreeOrigins.length).toBeGreaterThan(0);
    expect(actualTreeOrigins.every((point) => point.x <= 2 || point.x >= 46 || point.y <= 7 || point.y >= 34)).toBe(true);
    expect(map.lowerTileStacks).toBeUndefined();
    expect(map.upperTileStacks).toBeUndefined();
    for (const treeOrigin of actualTreeOrigins) {
      const upperLeftIndex = treeOrigin.y * map.width + treeOrigin.x;
      const upperRightIndex = treeOrigin.y * map.width + treeOrigin.x + 1;
      const lowerLeftIndex = (treeOrigin.y + 1) * map.width + treeOrigin.x;
      const lowerRightIndex = (treeOrigin.y + 1) * map.width + treeOrigin.x + 1;
      expect(map.upperTiles[upperLeftIndex]).toBe(262);
      expect(map.upperTiles[upperRightIndex]).toBe(263);
      expect(map.lowerTiles[lowerLeftIndex]).toBe(292);
      expect(map.lowerTiles[lowerRightIndex]).toBe(293);
    }
    for (let index = 0; index < map.lowerTiles.length; index += 1) {
      if (!isRoadTile(map.lowerTiles[index] ?? TILE.EMPTY)) continue;
      expect(map.upperTiles[index]).toBe(TILE.EMPTY);
      expect(map.lowerTileStacks?.[index]).toBeUndefined();
      expect(map.upperTileStacks?.[index]).toBeUndefined();
    }
  });

  it("stores the small_house_01 table template on the default tileset", () => {
    const project = createHouseTemplateGalleryProject();
    const template = project.tilesets[DEFAULT_TILESET_ID]?.terrainTemplates?.[0];
    const grammar = template?.grammar ?? [];

    expect(template).toEqual(SMALL_HOUSE_01_TERRAIN_TEMPLATE);
    expect(template?.buildPlan?.house.roof).toEqual({ origin: { x: 7, y: 4 }, width: 11 });
    expect(template?.buildPlan?.house.wall).toEqual({ origin: { x: 7, y: 8 }, width: 11, rows: 3 });
    expect(grammar.some((rule) => rule.kind === "roof-row" && rule.role === "roof-top" && rule.left === 375 && rule.middle === 375 && rule.right === 377)).toBe(true);
    expect(grammar.some((rule) => rule.left === 374 || rule.middle === 374 || rule.right === 374 || rule.tiles?.includes(374))).toBe(false);
    expect(template?.rows.some((row) => row.lower.includes(374) || row.upper.includes(374) || row.stack.includes(374))).toBe(false);
    expect(grammar.some((rule) => rule.kind === "wall-row" && rule.role === "wall-top" && rule.left === 15 && rule.middle === 16 && rule.right === 17 && rule.mustTouch === "roof-lower-slope")).toBe(true);
    expect(grammar.some((rule) => rule.kind === "wall-row" && rule.role === "wall-middle" && rule.left === 45 && rule.meaning.includes("직접 닿으면"))).toBe(true);
    expect(template?.rows.some((row) => row.section === "ground" && row.lower.includes(240))).toBe(true);
    expect(template?.rows.some((row) => row.section === "roof" && row.upper.includes(354))).toBe(true);
    expect(template?.rows.some((row) => row.section === "roof" && row.upper.includes(384))).toBe(true);
    expect(template?.rows.some((row) => row.section === "roof" && row.upper.includes(385))).toBe(true);
    expect(template?.rows.some((row) => row.section === "roof" && row.lower.includes(405) && row.meaning.includes("하단부"))).toBe(true);
    expect(template?.rows.some((row) => row.section === "roof" && row.lower.includes(405) && row.meaning.includes("전부 405로 반복"))).toBe(true);
    expect(template?.rules.some((rule) => rule.includes("지붕 최하단부 lower는 전부 405"))).toBe(true);
    expect(template?.rules.some((rule) => rule.includes("384") && rule.includes("385"))).toBe(true);
    expect(template?.rows.some((row) => row.section === "roof" && row.upper.includes(376) && row.meaning.includes("upper 384"))).toBe(true);
    expect(template?.rows.some((row) => row.section === "roof" && row.upper.includes(377) && row.meaning.includes("upper 385"))).toBe(true);
    expect(template?.rows.some((row) => row.section === "roof" && row.upper.includes(376) && row.lower.length === 0 && row.meaning.includes("405 위 upper 384"))).toBe(true);
    expect(template?.rows.filter((row) => row.section === "roof").every((row) => !row.lower.includes(240))).toBe(true);
    expect(template?.rows.filter((row) => row.section === "wall").every((row) => !row.lower.includes(240))).toBe(true);
    expect(template?.rows.filter((row) => row.section === "fence").every((row) => !row.lower.includes(240))).toBe(true);
    expect(template?.rows.some((row) => row.section === "wall" && row.lower.includes(15))).toBe(true);
    expect(template?.rows.some((row) => row.section === "wall" && row.lower.includes(15) && row.meaning.includes("지붕과 직접 닿는 행"))).toBe(true);
    expect(template?.rows.some((row) => row.section === "wall" && row.lower.includes(45) && row.meaning.includes("정확히 3칸 높이"))).toBe(true);
    expect(template?.rows.some((row) => row.section === "wall" && row.lower.includes(75) && row.meaning.includes("정확히 세 번째 행"))).toBe(true);
    expect(template?.rows.some((row) => row.section === "opening" && row.upper.includes(87) && row.meaning.includes("최소 2칸"))).toBe(true);
    expect(template?.rows.some((row) => row.section === "opening" && row.upper.includes(87) && row.meaning.includes("좌우 균형"))).toBe(true);
    expect(template?.rows.some((row) => row.section === "opening" && row.lower.includes(116) && row.lower.includes(146) && row.meaning.includes("벽 하단부"))).toBe(true);
    expect(template?.rows.some((row) => row.section === "opening" && row.lower.includes(116) && row.meaning.includes("문 아래 첫 칸부터 길"))).toBe(true);
    expect(template?.rows.some((row) => row.section === "fence" && row.upper.includes(379))).toBe(true);
    expect(template?.rows.some((row) => row.section === "fence" && row.meaning.includes("울타리를 먼저 깔고"))).toBe(true);
    expect(template?.rows.some((row) => row.section === "fence" && row.meaning.includes("절대로 같은 좌표에 겹치지 않는다"))).toBe(true);
    expect(template?.rows.filter((row) => row.section === "road").every((row) => !row.lower.includes(327) && !row.lower.includes(328))).toBe(true);
    expect(template?.rows.some((row) => row.section === "road" && row.lower.includes(390) && row.meaning.includes("모서리"))).toBe(true);
    expect(template?.rows.some((row) => row.section === "road" && row.lower.includes(421) && row.meaning.includes("몸통"))).toBe(true);
    expect(template?.rows.every((row) => row.section !== "prop")).toBe(true);
    expect(template?.rows.every((row) => !row.lower.includes(260) && !row.lower.includes(288) && !row.lower.includes(289) && !row.lower.includes(290))).toBe(true);
    expect(template?.rows.every((row) => !row.upper.includes(260) && !row.upper.includes(288) && !row.upper.includes(289) && !row.upper.includes(290))).toBe(true);
    expect(template?.rules.some((rule) => rule.includes("footprint를 먼저 정하고"))).toBe(true);
    expect(template?.rules.some((rule) => rule.includes("지붕 길이를 먼저 정하고"))).toBe(true);
    expect(template?.rules.some((rule) => rule.includes("벽 footprint는 지붕 footprint와 같은 x폭"))).toBe(true);
    expect(template?.rules.some((rule) => rule.includes("354/355는 지붕 footprint의 양 끝"))).toBe(true);
    expect(template?.rules.some((rule) => rule.includes("지붕과 직접 닿는 벽면은 반드시 wall-top"))).toBe(true);
    expect(template?.rules.some((rule) => rule.includes("지붕 전면 하단부 405 아래에는 반드시 벽"))).toBe(true);
    expect(template?.rules.some((rule) => rule.includes("벽은 정확히 세로 3칸"))).toBe(true);
    expect(template?.rules.some((rule) => rule.includes("창문끼리는 최소 2칸 이상"))).toBe(true);
    expect(template?.rules.some((rule) => rule.includes("같은 wall-middle 행에 좌우 균형"))).toBe(true);
    expect(template?.rules.some((rule) => rule.includes("문은 벽 하단부에 설치한다"))).toBe(true);
    expect(template?.rules.some((rule) => rule.includes("문 아래 첫 칸부터 길"))).toBe(true);
    expect(template?.rules.some((rule) => rule.includes("260/288/289/290/292/293 계열은 템플릿 생성 대상이 아니다"))).toBe(true);
    expect(template?.rules.some((rule) => rule.includes("autotile 경로로 생성해야 한다"))).toBe(true);
    expect(template?.rules.some((rule) => rule.includes("생성 순서는 반드시 울타리 → 집 → 길"))).toBe(true);
    expect(template?.rules.some((rule) => rule.includes("울타리는 집/지붕/길/창문/문과 절대로 같은 좌표"))).toBe(true);
    expect(template?.rules.some((rule) => rule.includes("길 위에는 어떠한 오브젝트도 없어야 한다"))).toBe(true);
    expect(template?.rules.some((rule) => rule.includes("위쪽 대각 지붕은 상위 레이어에만 둔다"))).toBe(true);
  });
});
