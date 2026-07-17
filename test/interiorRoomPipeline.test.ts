import { describe, expect, it } from "vitest";
import {
  HOUSE_WALL_FACE,
  INTERIOR_ROOM_DEMO_PLANS,
  PROP_SURFACE,
  VR,
  WALL_BRUSH,
  applyInteriorRoomLayer,
  createEmptyRoomMap,
  houseShellWallMembers,
  runInteriorRoomPipeline,
} from "@/editor/interiorRoomPipeline";
import { DARK_WALL_TILE } from "@/project/defaults/darkWallAutotile";
import {
  HOUSE_SHELL_FORBIDDEN_TILES,
  HOUSE_SHELL_TILE,
} from "@/project/defaults/interiorHouseWallTiles";

describe("interior room procedural pipeline (house whole-tile grammar / Option B)", () => {
  it("runs floor before walls; walls use house-shell members not empty", () => {
    const plan = INTERIOR_ROOM_DEMO_PLANS[0]!;
    let map = createEmptyRoomMap(plan);
    map = applyInteriorRoomLayer(map, plan, "floor").map;
    expect(map.lowerTiles).toContain(VR.FLOOR);
    const members = houseShellWallMembers();
    const wallBefore = map.lowerTiles.filter((t) => members.has(t)).length;
    expect(wallBefore).toBe(0);

    map = applyInteriorRoomLayer(map, plan, "walls").map;
    const wallAfter = map.lowerTiles.filter((t) => members.has(t)).length;
    expect(wallAfter).toBeGreaterThan(0);

    map = applyInteriorRoomLayer(map, plan, "entrance").map;
    const entrance = map.events?.find((e) => e.x === plan.door.x && e.y === plan.door.y);
    expect(entrance?.name).toBe("입구");
    const cmd = entrance?.pages?.[0]?.commands?.[0] as { kind?: string; body?: string };
    expect(cmd?.kind).toBe("text");
    expect(typeof cmd?.body).toBe("string");
  });

  it("366 is the only wall brush; 105 is a cream face tile, not a house brush", () => {
    expect(WALL_BRUSH).toBe(366);
    expect(DARK_WALL_TILE.BODY).toBe(366);
    // Option B: the 105-body store autotile is gone. 105 only means "cream lower middle".
    expect(HOUSE_SHELL_TILE.creamLowerM).toBe(105);
    expect(HOUSE_WALL_FACE.M).toBe(105);
  });

  it("exports no house-shell writer that shapes a store autotile", async () => {
    const pipeline = await import("@/editor/interiorRoomPipeline");
    expect(pipeline).not.toHaveProperty("paintHouseShellWalls");
    expect(pipeline).not.toHaveProperty("HOUSE_WALL_BRUSH");
    // 257 door post base has no name to write through anymore.
    expect(HOUSE_WALL_FACE).not.toHaveProperty("DOOR_POST_BASE");
    expect(Object.values(HOUSE_WALL_FACE)).not.toContain(257);
  });

  it("raises a two-row cream face (upper 74/75/76 + lower 104/105/106) with 457 cap", () => {
    const plan = INTERIOR_ROOM_DEMO_PLANS[0]!;
    const { map } = runInteriorRoomPipeline(plan);
    const wing = plan.wings[0]!;
    const midX = wing.x + Math.floor(wing.w / 2);
    const at = (x: number, y: number) => map.lowerTiles[y * map.width + x]!;
    const lowerFace = [HOUSE_WALL_FACE.L, HOUSE_WALL_FACE.M, HOUSE_WALL_FACE.R];
    const upperFace = [HOUSE_WALL_FACE.UL, HOUSE_WALL_FACE.UM, HOUSE_WALL_FACE.UR];
    // wing.y-1 = 아랫줄, wing.y-2 = 윗줄, wing.y-3 = 캡
    expect(lowerFace).toContain(at(midX, wing.y - 1));
    expect(upperFace).toContain(at(midX, wing.y - 2));
    expect(at(wing.x, wing.y - 1)).toBe(HOUSE_WALL_FACE.L);
    expect(at(wing.x, wing.y - 2)).toBe(HOUSE_WALL_FACE.UL);
    expect(at(wing.x + wing.w - 1, wing.y - 1)).toBe(HOUSE_WALL_FACE.R);
    expect(at(wing.x + wing.w - 1, wing.y - 2)).toBe(HOUSE_WALL_FACE.UR);
    expect(at(midX, wing.y - 3)).toBe(HOUSE_WALL_FACE.CAP);
    // 벽면 행 옆 포스트
    const members = houseShellWallMembers();
    expect(members.has(at(wing.x - 1, wing.y - 1))).toBe(true);
    expect(members.has(at(wing.x + wing.w, wing.y - 1))).toBe(true);
  });

  it("places bed as hard left-right pair on bedroom", () => {
    const plan = INTERIOR_ROOM_DEMO_PLANS.find((p) => p.theme === "bedroom")!;
    const { map, ok, warnings } = runInteriorRoomPipeline(plan);
    expect(ok).toBe(true);
    expect(warnings).toEqual([]);
    let found = false;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (map.upperTiles[y * map.width + x] !== VR.BED_L) continue;
        found = true;
        expect(map.upperTiles[y * map.width + x + 1]).toBe(VR.BED_R);
      }
    }
    expect(found).toBe(true);
  });

  it("never puts wall-mount on floor lower; broken glass not on pure void", () => {
    for (const plan of INTERIOR_ROOM_DEMO_PLANS) {
      const { map, ok } = runInteriorRoomPipeline(plan);
      expect(ok).toBe(true);
      const members = houseShellWallMembers();
      for (let i = 0; i < map.upperTiles.length; i += 1) {
        const u = map.upperTiles[i]!;
        const L = map.lowerTiles[i]!;
        if (u === VR.WINDOW || u === VR.PICTURE_L || u === VR.RELIGIOUS) {
          expect(members.has(L)).toBe(true);
        }
        if (u === VR.BROKEN_GLASS) {
          expect(L).toBe(VR.FLOOR);
          expect(PROP_SURFACE[VR.BROKEN_GLASS]).toBe("floorDebris");
        }
      }
    }
  });

  it("builds seven demo shapes — six themes + bbox room-structure demo", () => {
    expect(INTERIOR_ROOM_DEMO_PLANS).toHaveLength(7);
    const shapes = INTERIOR_ROOM_DEMO_PLANS.map((p) => p.wings.length);
    expect(shapes).toContain(1);
    expect(shapes).toContain(2);
    const themes = INTERIOR_ROOM_DEMO_PLANS.map((p) => p.theme);
    expect(themes).toEqual(expect.arrayContaining(["bedroom", "study", "dining", "kitchen", "storage", "tavern"]));
    expect(INTERIOR_ROOM_DEMO_PLANS.some((p) => (p.rooms?.length ?? 0) >= 2)).toBe(true);
  });

  it("two-room home: solo cream 77/107 under ceiling; south door flanks 398|396", () => {
    const plan = {
      mapId: "map_home_partition_reg",
      name: "파티션 회귀",
      width: 16,
      height: 12,
      wings: [] as const,
      rooms: [
        { id: "living", x: 2, y: 3, w: 7, h: 5, theme: "dining" as const },
        { id: "bedroom", x: 10, y: 3, w: 4, h: 5, theme: "bedroom" as const },
      ],
      innerDoors: [{ x: 9, y: 5 }],
      door: { x: 5, y: 7 },
      theme: "dining" as const,
      floorTile: 72,
      seed: 88,
    };
    const { map, ok } = runInteriorRoomPipeline(plan);
    expect(ok).toBe(true);
    const at = (x: number, y: number) => map.lowerTiles[y * map.width + x]!;
    // 천장 직하 1칸 크림 회벽(상 77 · 하 107)
    expect(at(9, 3)).toBe(HOUSE_WALL_FACE.SOLO_U);
    expect(at(9, 4)).toBe(HOUSE_WALL_FACE.SOLO_L);
    // 더 깊은 칸막이 포스트
    expect(at(9, 6)).toBe(HOUSE_SHELL_TILE.postWest);
    expect(at(9, 7)).toBe(HOUSE_SHELL_TILE.postWest);
    // 내부 문 개구
    expect(at(9, 5)).toBe(VR.FLOOR);
    expect(at(8, 3)).toBe(VR.FLOOR);
    expect(at(10, 3)).toBe(VR.FLOOR);
    // 양옆 북벽 면 윗줄
    expect(at(8, 1)).toBe(HOUSE_WALL_FACE.UR);
    expect(at(10, 1)).toBe(HOUSE_WALL_FACE.UL);
    // 남문 알코브
    expect(at(5, 8)).toBe(VR.FLOOR);
    expect(at(4, 8)).toBe(HOUSE_SHELL_TILE.southWestCorner);
    expect(at(6, 8)).toBe(HOUSE_SHELL_TILE.southEastCorner);
    expect(at(5, 9)).toBe(HOUSE_SHELL_TILE.southTrim);
  });

  it("bbox rooms: partitions + inner-door flanks + per-room furniture", () => {
    const plan = INTERIOR_ROOM_DEMO_PLANS.find((p) => p.mapId === "map_interior_inn_rooms_v1")!;
    const { map, ok, warnings } = runInteriorRoomPipeline(plan);
    expect(ok).toBe(true);
    expect(warnings).toEqual([]);
    const at = (x: number, y: number) => map.lowerTiles[y * map.width + x]!;
    const rooms = Object.fromEntries(plan.rooms!.map((r) => [r.id, r]));
    const guest1 = rooms.guest1!;
    const kitchen = rooms.kitchen!;
    const hall = rooms.hall!;
    const lowerFace = [HOUSE_WALL_FACE.L, HOUSE_WALL_FACE.M, HOUSE_WALL_FACE.R];
    const upperFace = [HOUSE_WALL_FACE.UL, HOUSE_WALL_FACE.UM, HOUSE_WALL_FACE.UR];
    // 주방 북벽 2줄 크림 (y9 lower, y8 upper) — 3칸 갭 구조
    expect(lowerFace).toContain(at(3, kitchen.y - 1));
    expect(upperFace).toContain(at(3, kitchen.y - 2));
    // 수평 파티션 내부 문: 3칸 바닥 + 플랭크 398|396
    const innerDoor = plan.innerDoors![0]!;
    expect(at(innerDoor.x, innerDoor.y)).toBe(VR.FLOOR);
    expect(at(innerDoor.x, innerDoor.y + 1)).toBe(VR.FLOOR);
    expect(at(innerDoor.x, innerDoor.y + 2)).toBe(VR.FLOOR);
    expect(at(innerDoor.x - 1, innerDoor.y)).toBe(HOUSE_SHELL_TILE.southWestCorner);
    expect(at(innerDoor.x + 1, innerDoor.y)).toBe(HOUSE_SHELL_TILE.southEastCorner);
    // 수직 파티션(1열): 객실 사이 x14 — 천장 직하 77/107
    expect(at(14, guest1.y)).toBe(HOUSE_WALL_FACE.SOLO_U);
    expect(at(14, guest1.y + 1)).toBe(HOUSE_WALL_FACE.SOLO_L);
    expect(at(13, guest1.y)).toBe(VR.FLOOR);
    expect(at(15, guest1.y)).toBe(VR.FLOOR);
    // 수직 파티션 1칸 문: 주방↔홀
    const sideDoor = plan.innerDoors![3]!;
    expect(at(sideDoor.x, sideDoor.y)).toBe(VR.FLOOR);
    expect(at(sideDoor.x, sideDoor.y - 2)).toBe(HOUSE_WALL_FACE.SOLO_U);
    expect(at(sideDoor.x, sideDoor.y - 1)).toBe(HOUSE_WALL_FACE.SOLO_L);
    expect(at(sideDoor.x, sideDoor.y + 1)).toBe(HOUSE_SHELL_TILE.postWest);
    // 방별 가구
    const inBox = (x: number, y: number, box: { x: number; y: number; w: number; h: number }) =>
      x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
    let stoveInKitchen = false;
    let tableInHall = false;
    let bedInGuest1 = false;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (map.lowerTiles[y * map.width + x] === VR.STOVE_BOT && inBox(x, y, kitchen)) stoveInKitchen = true;
        if (map.upperTiles[y * map.width + x] === VR.TABLE_L && inBox(x, y, hall)) tableInHall = true;
        if (
          (map.upperTiles[y * map.width + x] === VR.BED_L
            || map.upperTiles[y * map.width + x] === VR.BED_V_HEAD)
          && inBox(x, y, guest1)
        ) {
          bedInGuest1 = true;
        }
      }
    }
    expect(stoveInKitchen).toBe(true);
    expect(tableInHall).toBe(true);
    expect(bedInGuest1).toBe(true);
  });

  it("kitchen places stove pair — 21 upper on wall face directly above 51 lower on floor", () => {
    const plan = INTERIOR_ROOM_DEMO_PLANS.find((p) => p.theme === "kitchen")!;
    const { map, ok, warnings } = runInteriorRoomPipeline(plan);
    expect(ok).toBe(true);
    expect(warnings).toEqual([]);
    let found = false;
    const wall = houseShellWallMembers();
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (map.upperTiles[y * map.width + x] !== VR.STOVE_TOP) continue;
        found = true;
        expect(wall.has(map.lowerTiles[y * map.width + x]!)).toBe(true);
        expect(map.lowerTiles[(y + 1) * map.width + x]).toBe(VR.STOVE_BOT);
      }
    }
    expect(found).toBe(true);
  });

  it("tavern places long table as hard left-right pair 325|326 and passes critique", () => {
    const plan = INTERIOR_ROOM_DEMO_PLANS.find((p) => p.theme === "tavern")!;
    const { map, ok, warnings } = runInteriorRoomPipeline(plan);
    expect(ok).toBe(true);
    expect(warnings).toEqual([]);
    let found = false;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (map.upperTiles[y * map.width + x] !== VR.TABLE_L) continue;
        found = true;
        expect(map.upperTiles[y * map.width + x + 1]).toBe(VR.TABLE_R);
      }
    }
    expect(found).toBe(true);
  });

  it("storage fills corners with crates/barrels and passes critique", () => {
    const plan = INTERIOR_ROOM_DEMO_PLANS.find((p) => p.theme === "storage")!;
    const { map, ok, warnings } = runInteriorRoomPipeline(plan);
    expect(ok).toBe(true);
    expect(warnings).toEqual([]);
    const upper = new Set(map.upperTiles);
    expect(upper.has(VR.CRATE) || upper.has(VR.BARREL)).toBe(true);
  });

  it("does not place plants indoors", () => {
    for (const plan of INTERIOR_ROOM_DEMO_PLANS) {
      const { map } = runInteriorRoomPipeline(plan);
      expect(map.upperTiles).not.toContain(VR.PLANT);
    }
  });

  it("keeps dining hall floor — no EDGE_S eating floor cells", () => {
    const plan = INTERIOR_ROOM_DEMO_PLANS.find((p) => p.theme === "dining")!;
    const { map } = runInteriorRoomPipeline(plan);
    expect(map.lowerTiles[9 * map.width + 6]).toBe(VR.FLOOR);
    expect(map.lowerTiles[9 * map.width + 9]).toBe(VR.FLOOR);
  });

  it("places picture L|R as horizontal pair when present", () => {
    const plan = INTERIOR_ROOM_DEMO_PLANS.find((p) => p.theme === "study")!;
    const { map } = runInteriorRoomPipeline(plan);
    let pair = false;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width - 1; x += 1) {
        if (
          map.upperTiles[y * map.width + x] === VR.PICTURE_L
          && map.upperTiles[y * map.width + x + 1] === VR.PICTURE_R
        ) {
          pair = true;
        }
      }
    }
    if (!pair) {
      for (let y = 0; y < map.height - 1; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          expect(
            !(
              map.upperTiles[y * map.width + x] === VR.PICTURE_L
              && map.upperTiles[(y + 1) * map.width + x] === VR.PICTURE_R
            ),
          ).toBe(true);
        }
      }
    }
  });

  it("wall shell matches Option B — cap joints 458/456, door 398|floor|396, no forbidden tiles", () => {
    const plan = INTERIOR_ROOM_DEMO_PLANS[0]!;
    const { map } = runInteriorRoomPipeline(plan);
    const wing = plan.wings[0]!;
    const at = (x: number, y: number) => map.lowerTiles[y * map.width + x]!;
    // 캡 끝 조인트 = 458/456 (핑크 233/258 금지)
    expect(at(wing.x - 1, wing.y - 3)).toBe(HOUSE_SHELL_TILE.capJointNW);
    expect(at(wing.x + wing.w, wing.y - 3)).toBe(HOUSE_SHELL_TILE.capJointNE);
    // 남쪽 대각 코너는 void(430)
    expect(at(wing.x - 1, wing.y + wing.h)).toBe(430);
    // 남벽 문 행: 398 | floor | 396, 아래 397 only
    const southY = wing.y + wing.h;
    expect(at(plan.door.x, southY)).toBe(VR.FLOOR);
    expect(at(plan.door.x - 1, southY)).toBe(HOUSE_SHELL_TILE.southWestCorner);
    expect(at(plan.door.x + 1, southY)).toBe(HOUSE_SHELL_TILE.southEastCorner);
    expect(at(plan.door.x, southY + 1)).toBe(HOUSE_SHELL_TILE.southTrim);
    // 금지 타일 없음
    for (const t of map.lowerTiles) {
      expect(HOUSE_SHELL_FORBIDDEN_TILES.includes(t as 233 | 257 | 258)).toBe(false);
    }
  });

  it("walls summary reports house whole-tile grammar", () => {
    const plan = INTERIOR_ROOM_DEMO_PLANS[0]!;
    let map = createEmptyRoomMap(plan);
    map = applyInteriorRoomLayer(map, plan, "floor").map;
    const walls = applyInteriorRoomLayer(map, plan, "walls");
    expect(walls.summary).toContain("house whole-tile grammar");
    expect(walls.ok).toBe(true);
  });
});
