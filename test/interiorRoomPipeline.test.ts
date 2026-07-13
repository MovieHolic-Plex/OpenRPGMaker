import { describe, expect, it } from "vitest";
import {
  HOUSE_WALL_BRUSH,
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

describe("interior room procedural pipeline (house-shell cream wall frame)", () => {
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

  it("wall brush constants: dark-wall 366 (legacy), house shell 105", () => {
    expect(WALL_BRUSH).toBe(366);
    expect(DARK_WALL_TILE.BODY).toBe(366);
    expect(HOUSE_WALL_BRUSH).toBe(105);
  });

  it("raises a two-row cream face (104/105/106 both rows, gold grammar) with 457 cap", () => {
    const plan = INTERIOR_ROOM_DEMO_PLANS[0]!;
    const { map } = runInteriorRoomPipeline(plan);
    const wing = plan.wings[0]!;
    const midX = wing.x + Math.floor(wing.w / 2);
    const at = (x: number, y: number) => map.lowerTiles[y * map.width + x];
    const face = [HOUSE_WALL_FACE.L, HOUSE_WALL_FACE.M, HOUSE_WALL_FACE.R];
    expect(face).toContain(at(midX, wing.y - 1));
    expect(face).toContain(at(midX, wing.y - 2));
    expect(at(wing.x, wing.y - 1)).toBe(HOUSE_WALL_FACE.L);
    expect(at(wing.x + wing.w - 1, wing.y - 2)).toBe(HOUSE_WALL_FACE.R);
    expect(at(midX, wing.y - 3)).toBe(HOUSE_WALL_FACE.CAP);
    // 벽면 행 옆 포스트가 void로 끊기면 안 된다 (서벽 구멍 회귀 방지)
    const members = houseShellWallMembers();
    expect(members.has(at(wing.x - 1, wing.y - 1)!)).toBe(true);
    expect(members.has(at(wing.x + wing.w, wing.y - 1)!)).toBe(true);
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

  it("bbox rooms: partitions(수평/수직) + inner-door flanks + per-room furniture", () => {
    const plan = INTERIOR_ROOM_DEMO_PLANS.find((p) => p.mapId === "map_interior_inn_rooms_v1")!;
    const { map, ok, warnings } = runInteriorRoomPipeline(plan);
    expect(ok).toBe(true);
    expect(warnings).toEqual([]);
    const at = (x: number, y: number) => map.lowerTiles[y * map.width + x];
    const rooms = Object.fromEntries(plan.rooms!.map((r) => [r.id, r]));
    const pantry = rooms.pantry!;
    const guest1 = rooms.guest1!;
    const kitchen = rooms.kitchen!;
    const hall = rooms.hall!;
    // 수평 파티션: 창고 남측 트림(397) + 주방 벽면 2줄(104/105/106)
    const face = [HOUSE_WALL_FACE.L, HOUSE_WALL_FACE.M, HOUSE_WALL_FACE.R];
    expect(at(3, pantry.y + pantry.h)).toBe(397);
    expect(face).toContain(at(3, kitchen.y - 1));
    expect(face).toContain(at(3, kitchen.y - 2));
    // 수평 파티션 내부 문: 3칸 바닥 + 트림 행 플랭크 398|396
    const innerDoor = plan.innerDoors![0]!;
    expect(at(innerDoor.x, innerDoor.y)).toBe(VR.FLOOR);
    expect(at(innerDoor.x, innerDoor.y + 1)).toBe(VR.FLOOR);
    expect(at(innerDoor.x, innerDoor.y + 2)).toBe(VR.FLOOR);
    expect(at(innerDoor.x - 1, innerDoor.y)).toBe(398);
    expect(at(innerDoor.x + 1, innerDoor.y)).toBe(396);
    // 수직 파티션(1열): 객실 사이 x14 — 양옆이 바닥인 428 기둥(렌더가 426|428 반반 합성)
    expect(at(14, guest1.y + 1)).toBe(428);
    expect(at(13, guest1.y + 1)).toBe(VR.FLOOR);
    expect(at(15, guest1.y + 1)).toBe(VR.FLOOR);
    // 수직 파티션 1칸 문: 주방↔홀 (8,12)
    const sideDoor = plan.innerDoors![3]!;
    expect(at(sideDoor.x, sideDoor.y)).toBe(VR.FLOOR);
    expect(at(sideDoor.x, sideDoor.y - 1)).toBe(428);
    expect(at(sideDoor.x, sideDoor.y + 1)).toBe(428);
    // 방별 가구: 주방에 화덕 하단(51 lower), 홀에 긴 탁자(325 upper), 객실1에 침대(355 upper)
    const inBox = (x: number, y: number, box: { x: number; y: number; w: number; h: number }) =>
      x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
    let stoveInKitchen = false;
    let tableInHall = false;
    let bedInGuest1 = false;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (map.lowerTiles[y * map.width + x] === VR.STOVE_BOT && inBox(x, y, kitchen)) stoveInKitchen = true;
        if (map.upperTiles[y * map.width + x] === VR.TABLE_L && inBox(x, y, hall)) tableInHall = true;
        // 침대 방향 변주(가로 355 | 세로 324) — 어느 쪽이든 침대가 있으면 통과.
        if ((map.upperTiles[y * map.width + x] === VR.BED_L || map.upperTiles[y * map.width + x] === VR.BED_V_HEAD) && inBox(x, y, guest1)) bedInGuest1 = true;
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
    // may fail if wall face too thin — then at least no vertical split of L under R same x
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

  it("wall shell matches gold grammar — cap joints, unbroken posts, void south corners, gold door", () => {
    const plan = INTERIOR_ROOM_DEMO_PLANS[0]!;
    const { map } = runInteriorRoomPipeline(plan);
    const wing = plan.wings[0]!;
    const at = (x: number, y: number) => map.lowerTiles[y * map.width + x];
    // 캡 끝 조인트(void로 끝남) = 233/258
    expect(at(wing.x - 1, wing.y - 3)).toBe(233);
    expect(at(wing.x + wing.w, wing.y - 3)).toBe(258);
    // 남쪽 대각 코너는 void(430) — 렌더 시 368 쿼터가 감싼다 (골드 (1,11) 관례)
    expect(at(wing.x - 1, wing.y + wing.h)).toBe(430);
    expect(at(wing.x + wing.w, wing.y + wing.h)).toBe(430);
    // 포스트 기둥이 바닥 마지막 행까지 끊기지 않는다 (중간에 코너/트림이 박히던 회귀 방지)
    for (let y = wing.y; y < wing.y + wing.h; y += 1) {
      expect(at(wing.x - 1, y)).toBe(428);
      expect(at(wing.x + wing.w, y)).toBe(426);
    }
    // 남벽 트림 + 골드 문 마감: 서 398 | 바닥 | 동 396, 아래 행 257·397·257
    const southY = wing.y + wing.h;
    for (let x = wing.x; x < wing.x + wing.w; x += 1) {
      if (x === plan.door.x) expect(at(x, southY)).toBe(VR.FLOOR);
      else if (x === plan.door.x - 1) expect(at(x, southY)).toBe(398);
      else if (x === plan.door.x + 1) expect(at(x, southY)).toBe(396);
      else expect(at(x, southY)).toBe(397);
    }
    expect(at(plan.door.x, southY + 1)).toBe(397);
    expect(at(plan.door.x - 1, southY + 1)).toBe(257);
    expect(at(plan.door.x + 1, southY + 1)).toBe(257);
  });
});
