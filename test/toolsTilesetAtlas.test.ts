import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import { normalizeTerrainRecords } from "@/project/databaseUtilityRecordModel";
import { deserialize, serialize } from "@/project/io";
import { vehicleCanEnter } from "@/project/vehicles";
import { createHouseInteriorMap, type HouseExteriorHint, houseProgramForOwner } from "@/editor/houseInteriors";
import { floorMaskFromPlan, type InteriorRoomPlan, type RoomSpec } from "@/editor/interiorRoomPipeline";
import type { GameMap } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("terrainRaftPassageSave", () => {
  isolateTimers();
  function pinTerrainTag(project: ReturnType<typeof createBlankProject>, tag: number): void {
    const map = project.maps[project.startMapId]!;
    const tileset = project.tilesets[map.tilesetId]!;
    map.lowerTiles[0] = 0;
    while (tileset.terrain.length <= 0) tileset.terrain.push(0);
    tileset.terrain[0] = tag;
    const meta = [...(tileset.tileMeta ?? [])];
    while (meta.length <= 0) meta.push({ label: "", description: "" });
    meta[0] = { ...(meta[0] ?? { label: "", description: "" }), terrainTag: tag };
    tileset.tileMeta = meta;
  }
  describe("terrain raft passage save", () => {
    it("keeps an explicit raft ban when a boat-only lake is reloaded", () => {
      const project = createBlankProject();
      project.database.terrains.push({
        id: "terrain_boat_lake",
        name: "보트 호수",
        damage: 0,
        encounterRatePercent: 100,
        characterDisplay: "normal",
        vehiclePassage: { boat: true, ship: false, airshipLand: false, raft: false },
      });
      pinTerrainTag(project, project.database.terrains.length);

      const loaded = deserialize(serialize(project));
      const passage = loaded.database.terrains.find((record) => record.id === "terrain_boat_lake")?.vehiclePassage;
      expect(passage?.raft).toBe(false);
      const loadedMap = loaded.maps[loaded.startMapId]!;
      expect(vehicleCanEnter(loaded, loadedMap, "raft", 0, 0)).toBe(false);
      expect(vehicleCanEnter(loaded, loadedMap, "boat", 0, 0)).toBe(true);
    });

    it("keeps raft:false when the assistant upserts a boat-only lake", () => {
      const context: ToolContext = { project: createEmptyToolProject("뗏목 금지") };
      const result = runTool(context, "upsert_database_utility", {
        collection: "terrains",
        record: {
          id: "terrain_boat_lake",
          name: "보트 호수",
          damage: 0,
          encounterRatePercent: 100,
          characterDisplay: "normal",
          vehiclePassage: { boat: true, ship: false, airshipLand: false, raft: false },
        },
      });
      expect(result.ok, result.summary).toBe(true);
      const passage = context.project.database.terrains?.find((record) => record.id === "terrain_boat_lake")?.vehiclePassage;
      expect(passage?.raft).toBe(false);
      expect(passage?.chocobo).toBeUndefined();
      expect(passage?.cart).toBeUndefined();
    });

    it("still omits raft when the author did not set it", () => {
      const [record] = normalizeTerrainRecords([{
        id: "lake",
        name: "호수",
        vehiclePassage: { boat: true, ship: false, airshipLand: false },
      }]);
      expect(record?.vehiclePassage).not.toHaveProperty("raft");
      expect(record?.vehiclePassage.chocobo).toBeUndefined();
      expect(record?.vehiclePassage.cart).toBeUndefined();
    });
  });
});

// 타일셋 아틀라스 저작 파사드(src/editor/tools/tilesetAtlasTools.ts) 계약.
// 2026-08-27 커버리지 감사: 타일셋 자체 생성/속성/오토타일 그룹/애니메이션 스트립/그래프트는
// 에디터 UI 만 쓸 수 있었다. 각 툴이 어느 Project 필드를 쓰는지와 거부 메시지가
// "모델이 다음 호출에 쓸 수 있는 값"을 담는지를 여기서 못박는다.
describe("toolsTilesetAtlas", () => {
  isolateTimers();
  const ATLAS_ID = "ts_atlas_test";
  function context(): ToolContext {
    return { project: createEmptyToolProject("타일셋 아틀라스") };
  }
  // 8열 × 4행 = 32칸 커스텀 아틀라스. 모든 툴의 타일 id 범위는 0~31 이다.
  function withAtlas(): ToolContext {
    const ctx = context();
    const created = runTool(ctx, "create_tileset", {
      id: ATLAS_ID,
      name: "시험 아틀라스",
      image: { type: "bundled", id: "tex_beodeul_city" },
      kind: "custom",
      tileSize: 16,
      tilesPerRow: 8,
      count: 32,
    }, { dryRun: false });
    expect(created.ok, JSON.stringify(created.issues)).toBe(true);
    return ctx;
  }
  describe("create_tileset — project.tilesets 슬롯 생성", () => {
    it("새 타일셋을 슬롯 배열까지 채워 만들고 set_tile_metadata 로 바로 쓸 수 있다", () => {
      const ctx = withAtlas();
      const tileset = ctx.project.tilesets[ATLAS_ID];
      expect(tileset).toBeDefined();
      expect(tileset.name).toBe("시험 아틀라스");
      expect(tileset.image).toEqual({ type: "bundled", id: "tex_beodeul_city" });
      expect(tileset.kind).toBe("custom");
      expect(tileset.tileSize).toBe(16);
      expect(tileset.tilesPerRow).toBe(8);
      expect(tileset.count).toBe(32);
      expect(tileset.passability).toHaveLength(32);
      expect(tileset.passability[31]).toEqual({ up: true, down: true, left: true, right: true });
      expect(tileset.priority).toHaveLength(32);
      expect(new Set(tileset.priority)).toEqual(new Set(["lower"]));
      expect(tileset.terrain).toHaveLength(32);
      expect(tileset.terrain.every((tag) => tag === 0)).toBe(true);

      const meta = runTool(ctx, "set_tile_metadata", {
        tilesetId: ATLAS_ID,
        entries: [{ tile: 31, label: "시험 타일" }],
      }, { dryRun: false });
      expect(meta.ok, JSON.stringify(meta.issues)).toBe(true);
      expect(ctx.project.tilesets[ATLAS_ID].tileMeta?.[31]?.label).toBe("시험 타일");
    });

    it("이미 있는 id 는 기존 id 를 알려주며 거부한다", () => {
      const ctx = withAtlas();
      const rejected = runTool(ctx, "create_tileset", {
        id: ATLAS_ID,
        name: "중복",
        image: { type: "bundled", id: "tex_beodeul_city" },
      }, { dryRun: false });
      expect(rejected.ok).toBe(false);
      expect(rejected.issues?.[0]?.message).toContain(ATLAS_ID);
    });

    it("알 수 없는 bundled 이미지는 쓸 수 있는 이미지 id 를 나열하며 거부한다", () => {
      const ctx = context();
      const rejected = runTool(ctx, "create_tileset", {
        name: "없는 그림",
        image: { type: "bundled", id: "tex_does_not_exist" },
      }, { dryRun: false });
      expect(rejected.ok).toBe(false);
      const message = rejected.issues?.[0]?.message ?? "";
      expect(message).toContain("tex_does_not_exist");
      expect(message).toContain("tex_beodeul_city");
    });
  });
  describe("set_tileset_properties — 이름/그림/기하/투명색 패치", () => {
    it("이름·kind·tilesPerRow·투명색을 패치하고 명시적으로 투명색을 지운다", () => {
      const ctx = withAtlas();
      const patched = runTool(ctx, "set_tileset_properties", {
        tilesetId: ATLAS_ID,
        name: "고친 아틀라스",
        kind: "rpg2k",
        tilesPerRow: 16,
        transparentColor: "#FF00FF",
      }, { dryRun: false });
      expect(patched.ok, JSON.stringify(patched.issues)).toBe(true);
      const tileset = ctx.project.tilesets[ATLAS_ID];
      expect(tileset.name).toBe("고친 아틀라스");
      expect(tileset.kind).toBe("rpg2k");
      expect(tileset.tilesPerRow).toBe(16);
      expect(tileset.transparentColor).toBe("#ff00ff");

      const cleared = runTool(ctx, "set_tileset_properties", {
        tilesetId: ATLAS_ID,
        clearTransparentColor: true,
      }, { dryRun: false });
      expect(cleared.ok, JSON.stringify(cleared.issues)).toBe(true);
      expect("transparentColor" in ctx.project.tilesets[ATLAS_ID]).toBe(false);
    });

    it("count 를 늘리면 슬롯 배열이 함께 늘어난다", () => {
      const ctx = withAtlas();
      const grown = runTool(ctx, "set_tileset_properties", { tilesetId: ATLAS_ID, count: 48 }, { dryRun: false });
      expect(grown.ok, JSON.stringify(grown.issues)).toBe(true);
      const tileset = ctx.project.tilesets[ATLAS_ID];
      expect(tileset.count).toBe(48);
      expect(tileset.passability).toHaveLength(48);
      expect(tileset.priority).toHaveLength(48);
      expect(tileset.terrain).toHaveLength(48);
    });

    it("저작된 타일 메타가 잘릴 count 축소는 충돌 타일을 이름 짓고 거부한다", () => {
      const ctx = withAtlas();
      const meta = runTool(ctx, "set_tile_metadata", {
        tilesetId: ATLAS_ID,
        entries: [{ tile: 30, label: "지킬 타일" }],
      }, { dryRun: false });
      expect(meta.ok, JSON.stringify(meta.issues)).toBe(true);

      const rejected = runTool(ctx, "set_tileset_properties", { tilesetId: ATLAS_ID, count: 16 }, { dryRun: false });
      expect(rejected.ok).toBe(false);
      expect(rejected.issues?.[0]?.message).toContain("30");
      expect(ctx.project.tilesets[ATLAS_ID].count).toBe(32);
    });

    it("빈 슬롯만 잘리는 축소는 경고와 함께 통과한다", () => {
      const ctx = withAtlas();
      const shrunk = runTool(ctx, "set_tileset_properties", { tilesetId: ATLAS_ID, count: 16 }, { dryRun: false });
      expect(shrunk.ok, JSON.stringify(shrunk.issues)).toBe(true);
      expect(ctx.project.tilesets[ATLAS_ID].count).toBe(16);
      expect(ctx.project.tilesets[ATLAS_ID].passability).toHaveLength(16);
      // 쓰기 툴의 비차단 경고는 러너가 diff.warnings 로 실어 보낸다(toolRunner.ts).
      expect(shrunk.diff?.warnings.some((warning) => warning.includes("16"))).toBe(true);
    });

    it("없는 타일셋은 쓸 수 있는 타일셋 id 를 나열하며 거부한다", () => {
      const ctx = withAtlas();
      const rejected = runTool(ctx, "set_tileset_properties", { tilesetId: "ts_nope", name: "x" }, { dryRun: false });
      expect(rejected.ok).toBe(false);
      const message = rejected.issues?.[0]?.message ?? "";
      expect(message).toContain("ts_nope");
      expect(message).toContain(ATLAS_ID);
    });
  });
  describe("upsert_autotile_group / delete_autotile_group — tilesets[*].autotileGroups", () => {
    it("오토타일 그룹의 모든 필드를 쓰고 같은 id 로 갱신한다", () => {
      const ctx = withAtlas();
      const created = runTool(ctx, "upsert_autotile_group", {
        tilesetId: ATLAS_ID,
        group: {
          id: "auto_path",
          name: "흙길",
          neighborhood: 8,
          memberTileIds: [8, 9, 10],
          connectTileIds: [8, 9, 10, 11],
          triggerTileIds: [8],
          variantMap: { "0": 8, "15": 9, "255": 10 },
        },
      }, { dryRun: false });
      expect(created.ok, JSON.stringify(created.issues)).toBe(true);
      const group = ctx.project.tilesets[ATLAS_ID].autotileGroups?.[0];
      expect(group).toEqual({
        id: "auto_path",
        name: "흙길",
        neighborhood: 8,
        memberTileIds: [8, 9, 10],
        connectTileIds: [8, 9, 10, 11],
        triggerTileIds: [8],
        variantMap: { "0": 8, "15": 9, "255": 10 },
      });

      const updated = runTool(ctx, "upsert_autotile_group", {
        tilesetId: ATLAS_ID,
        group: { id: "auto_path", name: "흙길 v2", neighborhood: 4, memberTileIds: [8], variantMap: { "0": 8 } },
      }, { dryRun: false });
      expect(updated.ok, JSON.stringify(updated.issues)).toBe(true);
      const groups = ctx.project.tilesets[ATLAS_ID].autotileGroups ?? [];
      expect(groups).toHaveLength(1);
      expect(groups[0].name).toBe("흙길 v2");
      expect(groups[0].neighborhood).toBe(4);
      expect(groups[0].connectTileIds).toBeUndefined();
    });

    it("범위 밖 memberTileIds 는 유효 범위를 알려주며 거부한다", () => {
      const ctx = withAtlas();
      const rejected = runTool(ctx, "upsert_autotile_group", {
        tilesetId: ATLAS_ID,
        group: { name: "밖", memberTileIds: [99], variantMap: {} },
      }, { dryRun: false });
      expect(rejected.ok).toBe(false);
      const message = rejected.issues?.[0]?.message ?? "";
      expect(message).toContain("99");
      expect(message).toContain("0~31");
    });

    it("variantMap 값도 범위 검증하고 유효 범위를 알려준다", () => {
      const ctx = withAtlas();
      const rejected = runTool(ctx, "upsert_autotile_group", {
        tilesetId: ATLAS_ID,
        group: { name: "밖", memberTileIds: [1], variantMap: { "0": 77 } },
      }, { dryRun: false });
      expect(rejected.ok).toBe(false);
      expect(rejected.issues?.[0]?.message ?? "").toContain("0~31");
    });

    it("그룹을 삭제하고, 없는 그룹은 남은 그룹 id 를 나열하며 거부한다", () => {
      const ctx = withAtlas();
      const created = runTool(ctx, "upsert_autotile_group", {
        tilesetId: ATLAS_ID,
        group: { id: "auto_sand", name: "모래", memberTileIds: [2], variantMap: { "0": 2 } },
      }, { dryRun: false });
      expect(created.ok, JSON.stringify(created.issues)).toBe(true);

      const rejected = runTool(ctx, "delete_autotile_group", { tilesetId: ATLAS_ID, groupId: "auto_none" }, { dryRun: false });
      expect(rejected.ok).toBe(false);
      const message = rejected.issues?.[0]?.message ?? "";
      expect(message).toContain("auto_none");
      expect(message).toContain("auto_sand");

      const deleted = runTool(ctx, "delete_autotile_group", { tilesetId: ATLAS_ID, groupId: "auto_sand" }, { dryRun: false });
      expect(deleted.ok, JSON.stringify(deleted.issues)).toBe(true);
      expect(ctx.project.tilesets[ATLAS_ID].autotileGroups ?? []).toHaveLength(0);
    });
  });
  describe("set_animation_strips — tilesets[*].animationStrips", () => {
    it("스트립 목록을 그대로 쓰고 기본 replace 로 갈아친다", () => {
      const ctx = withAtlas();
      const first = runTool(ctx, "set_animation_strips", {
        tilesetId: ATLAS_ID,
        strips: [{ baseTile: 0, frames: 3, fps: 4 }, { baseTile: 8, frames: 2, fps: 2 }],
      }, { dryRun: false });
      expect(first.ok, JSON.stringify(first.issues)).toBe(true);
      expect(ctx.project.tilesets[ATLAS_ID].animationStrips).toEqual([
        { baseTile: 0, frames: 3, fps: 4 },
        { baseTile: 8, frames: 2, fps: 2 },
      ]);

      const replaced = runTool(ctx, "set_animation_strips", {
        tilesetId: ATLAS_ID,
        strips: [{ baseTile: 16, frames: 4, fps: 6 }],
      }, { dryRun: false });
      expect(replaced.ok, JSON.stringify(replaced.issues)).toBe(true);
      expect(ctx.project.tilesets[ATLAS_ID].animationStrips).toEqual([{ baseTile: 16, frames: 4, fps: 6 }]);

      const cleared = runTool(ctx, "set_animation_strips", { tilesetId: ATLAS_ID, strips: [] }, { dryRun: false });
      expect(cleared.ok, JSON.stringify(cleared.issues)).toBe(true);
      expect(ctx.project.tilesets[ATLAS_ID].animationStrips).toBeUndefined();
    });

    it("append 는 기존 스트립을 baseTile 기준으로 합친다", () => {
      const ctx = withAtlas();
      runTool(ctx, "set_animation_strips", { tilesetId: ATLAS_ID, strips: [{ baseTile: 0, frames: 3, fps: 4 }] }, { dryRun: false });
      const appended = runTool(ctx, "set_animation_strips", {
        tilesetId: ATLAS_ID,
        mode: "append",
        strips: [{ baseTile: 0, frames: 2, fps: 8 }, { baseTile: 24, frames: 2, fps: 3 }],
      }, { dryRun: false });
      expect(appended.ok, JSON.stringify(appended.issues)).toBe(true);
      expect(ctx.project.tilesets[ATLAS_ID].animationStrips).toEqual([
        { baseTile: 0, frames: 2, fps: 8 },
        { baseTile: 24, frames: 2, fps: 3 },
      ]);
    });

    it("행을 넘는 프레임은 그 행에서 쓸 수 있는 범위를 알려주며 거부한다", () => {
      const ctx = withAtlas();
      const rejected = runTool(ctx, "set_animation_strips", {
        tilesetId: ATLAS_ID,
        strips: [{ baseTile: 7, frames: 3, fps: 4 }],
      }, { dryRun: false });
      expect(rejected.ok).toBe(false);
      const message = rejected.issues?.[0]?.message ?? "";
      expect(message).toContain("7");
      expect(message).toContain("0~31");
      expect(ctx.project.tilesets[ATLAS_ID].animationStrips).toBeUndefined();
    });

    it("범위 밖 baseTile 은 유효 범위를 알려주며 거부한다", () => {
      const ctx = withAtlas();
      const rejected = runTool(ctx, "set_animation_strips", {
        tilesetId: ATLAS_ID,
        strips: [{ baseTile: 40, frames: 2, fps: 4 }],
      }, { dryRun: false });
      expect(rejected.ok).toBe(false);
      expect(rejected.issues?.[0]?.message ?? "").toContain("0~31");
    });
  });
  describe("set_tile_grafts — tilesets[*].tileGrafts", () => {
    it("이식을 등록하고 targetTile 로 제거한다", () => {
      const ctx = withAtlas();
      const added = runTool(ctx, "set_tile_grafts", {
        tilesetId: ATLAS_ID,
        grafts: [
          { targetTile: 4, sourceChipset: "tex_beodeul_city", sourceTile: 100 },
          { targetTile: 5, sourceChipset: "tex_beodeul_city", sourceTile: 101 },
        ],
      }, { dryRun: false });
      expect(added.ok, JSON.stringify(added.issues)).toBe(true);
      expect(ctx.project.tilesets[ATLAS_ID].tileGrafts).toEqual([
        { targetTile: 4, sourceChipset: "tex_beodeul_city", sourceTile: 100 },
        { targetTile: 5, sourceChipset: "tex_beodeul_city", sourceTile: 101 },
      ]);

      const removed = runTool(ctx, "set_tile_grafts", { tilesetId: ATLAS_ID, remove: [4] }, { dryRun: false });
      expect(removed.ok, JSON.stringify(removed.issues)).toBe(true);
      expect(ctx.project.tilesets[ATLAS_ID].tileGrafts).toEqual([
        { targetTile: 5, sourceChipset: "tex_beodeul_city", sourceTile: 101 },
      ]);
    });

    it("알 수 없는 sourceChipset 은 쓸 수 있는 소스를 나열하며 거부한다", () => {
      const ctx = withAtlas();
      const rejected = runTool(ctx, "set_tile_grafts", {
        tilesetId: ATLAS_ID,
        grafts: [{ targetTile: 1, sourceChipset: "chipset_없음", sourceTile: 3 }],
      }, { dryRun: false });
      expect(rejected.ok).toBe(false);
      const message = rejected.issues?.[0]?.message ?? "";
      expect(message).toContain("chipset_없음");
      expect(message).toContain("tex_beodeul_city");
      expect(ctx.project.tilesets[ATLAS_ID].tileGrafts).toBeUndefined();
    });

    it("범위 밖 targetTile 은 유효 범위를 알려주며 거부한다", () => {
      const ctx = withAtlas();
      const rejected = runTool(ctx, "set_tile_grafts", {
        tilesetId: ATLAS_ID,
        grafts: [{ targetTile: 64, sourceChipset: "tex_beodeul_city", sourceTile: 3 }],
      }, { dryRun: false });
      expect(rejected.ok).toBe(false);
      expect(rejected.issues?.[0]?.message ?? "").toContain("0~31");
    });
  });
});

describe("villageInteriorStairs", () => {
  isolateTimers();
  const STAIRS_UP = 444;
  const STAIRS_DOWN = 474;
  const FLOOR_TILES = new Set([72, 73, 12, 13, 42, 43, 102, 103, 139]);
  type Floor = { readonly map: GameMap; readonly level: number };
  function houses(): Floor[] {
    const context: ToolContext = { project: createEmptyToolProject("probe") };
    runTool(context, "create_map", { id: "m", name: "m", width: 20, height: 20 });
    const exteriors: HouseExteriorHint[] = [
      { stories: 2, templateId: "rect-2f", program: "dwelling" },
      { stories: 2, templateId: "rect-2f", program: "inn" },
      { stories: 2, templateId: "rect-2f", program: "shop" },
      { stories: 2, templateId: "rect-2f", program: "study" },
      { stories: 2, templateId: "rect-2f", program: "manor", footprintArea: 80 },
      { stories: 3, templateId: "rect-3f", program: "dwelling" },
      { stories: 1, templateId: "rect", program: "workshop" },
      { stories: 1, templateId: "rect", program: "shop" },
    ];
    const floors: Floor[] = [];
    for (const [i, exterior] of exteriors.entries()) for (const seed of [11, 12, 13]) {
      const id = `map_h${i}_${seed}`;
      const result = createHouseInteriorMap({ project: context.project, id, name: id, returnMapId: "m", returnX: 1, returnY: 1, exitEventId: `ev_${id}`, seed, exterior });
      for (const floor of result.floors) floors.push({ map: floor.map, level: floor.floor });
    }
    return floors;
  }
  const plan = (map: GameMap) => map.roomHarnessPlan!.plan as InteriorRoomPlan;
  const cells = (map: GameMap, layer: "lowerTiles" | "upperTiles", tile: number) =>
    map[layer].flatMap((value, index) => (value === tile ? [{ x: index % map.width, y: Math.floor(index / map.width) }] : []));
  describe("house interiors — stairs, ladders and windows", () => {
    const floors = houses();

    it("backs every up-staircase onto a wall and leaves its east side open as the landing", () => {
      let stairs = 0;
      for (const { map } of floors) {
        const floor = floorMaskFromPlan(plan(map));
        for (const { x, y } of cells(map, "upperTiles", STAIRS_UP)) {
          stairs += 1;
          expect(floor[(y - 1) * map.width + x], `${map.id} (${x},${y}) north must be wall`).toBe(false);
          expect(floor[y * map.width + x + 1], `${map.id} (${x},${y}) east must be floor`).toBe(true);
          expect(map.upperTiles[y * map.width + x + 1], `${map.id} (${x},${y}) east landing`).toBe(-1);
        }
      }
      expect(stairs).toBeGreaterThan(10);
    });

    it("keeps the shell closed: no floor punched into a wall, and upper floors have no exterior doorway", () => {
      for (const { map, level } of floors) {
        const room = plan(map);
        const floor = floorMaskFromPlan(room);
        const outside = map.lowerTiles.flatMap((tile, index) => (FLOOR_TILES.has(tile) && !floor[index] ? [index] : []));
        const doorway = room.door.y + 1 < map.height ? [(room.door.y + 1) * map.width + room.door.x] : [];
        expect(outside, `${map.id} (floor ${level})`).toEqual(level === 1 ? doorway : []);
      }
    });

    it("puts a descending staircase on every upper floor", () => {
      for (const { map, level } of floors) {
        if (level > 1) expect(cells(map, "upperTiles", STAIRS_DOWN).length, map.id).toBe(1);
      }
    });

    // Removed it "hangs no ladder alone on a wall": author_village was removed from the tool registry on purpose.
  });
});

describe("villageInteriorVariation", () => {
  isolateTimers();
  const plan = (map: GameMap) => map.roomHarnessPlan!.plan as InteriorRoomPlan;
  /** Furniture tile multiset of a room, wall face rows included. */
  function furniture(map: GameMap, room: RoomSpec): string {
    const tiles: number[] = [];
    for (let y = room.y - 2; y < room.y + room.h; y += 1) for (let x = room.x; x < room.x + room.w; x += 1) {
      const tile = map.upperTiles[y * map.width + x]!;
      if (tile >= 0) tiles.push(tile);
    }
    return tiles.sort((a, b) => a - b).join(",");
  }
  describe("house interiors — role and seed variation", () => {
    it("reads the owner's trade into an interior program", () => {
      expect(houseProgramForOwner("늙은 어부 바란")).toBe("workshop");
      expect(houseProgramForOwner("수습 선원")).toBe("workshop");
      expect(houseProgramForOwner("등대지기 에릭")).toBe("study");
      expect(houseProgramForOwner("약초꾼 은선")).toBe("study");
      expect(houseProgramForOwner("여관 주인 헬가")).toBe("inn");
      expect(houseProgramForOwner("잡화상 바란")).toBe("shop");
      expect(houseProgramForOwner("카이")).toBeUndefined();
    });

    // Removed it "builds the village": author_village was removed from the tool registry on purpose.

    it("gives a house's second bedroom its own furniture instead of a copy of the first", () => {
      const context: ToolContext = { project: createEmptyToolProject("probe") };
      runTool(context, "create_map", { id: "m", name: "m", width: 20, height: 20 });
      let pairs = 0;
      const exteriors: HouseExteriorHint[] = [
        { stories: 2, templateId: "rect-2f", program: "dwelling" },
        { stories: 2, templateId: "rect-2f", program: "inn" },
        { stories: 1, templateId: "rect", program: "inn" },
      ];
      for (const [i, exterior] of exteriors.entries()) for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const id = `map_b${i}_${seed}`;
        const result = createHouseInteriorMap({ project: context.project, id, name: id, returnMapId: "m", returnX: 1, returnY: 1, exitEventId: `ev_${id}`, seed, exterior });
        for (const { map } of result.floors) {
          const bedrooms = (plan(map).rooms ?? []).filter((room) => room.theme === "bedroom");
          for (let a = 0; a < bedrooms.length; a += 1) for (let b = a + 1; b < bedrooms.length; b += 1) {
            if (bedrooms[a]!.w !== bedrooms[b]!.w || bedrooms[a]!.h !== bedrooms[b]!.h) continue;
            pairs += 1;
            expect(furniture(map, bedrooms[a]!), `${map.id} ${bedrooms[a]!.id}/${bedrooms[b]!.id}`).not.toBe(furniture(map, bedrooms[b]!));
          }
        }
      }
      expect(pairs).toBeGreaterThan(10);
    });

    it("does not stamp one floor plan for every ordinary home: the seed mirrors the layout", () => {
      const context: ToolContext = { project: createEmptyToolProject("probe") };
      runTool(context, "create_map", { id: "m", name: "m", width: 20, height: 20 });
      const layouts = new Set<string>();
      for (let seed = 1; seed <= 16; seed += 1) {
        const id = `map_d${seed}`;
        const result = createHouseInteriorMap({ project: context.project, id, name: id, returnMapId: "m", returnX: 1, returnY: 1, exitEventId: `ev_${id}`, seed, exterior: { stories: 1, templateId: "rect" } });
        layouts.add(JSON.stringify((plan(result.map).rooms ?? []).map((room) => [room.x, room.y, room.w, room.h])));
      }
      expect(layouts.size).toBeGreaterThan(1);
    });
  });
});
