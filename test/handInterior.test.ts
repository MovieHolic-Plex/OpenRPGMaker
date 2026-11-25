import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import HAND_INTERIOR_SPEC from "@/assets/handInteriorSpec.json";
import { HAND_INTERIOR_SPEC as S, JP_INTERIOR_SPEC, WIZARDING_INTERIOR_SPEC } from "@/editor/handInterior/builder";
import { resolveRoom, roomParts, searchParts } from "@/editor/handInterior/parts";
import { LIST_HAND_INTERIOR_PARTS_TOOL } from "@/editor/tools/handInteriorTools";
import { composeHandInteriorRooms } from "@/editor/handInterior/rooms";
import type { Project } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

// 발깔개는 2칸이라 2칸 출구에만 깐다. 1칸 출구에 깔면 한 칸이 벽 앞에 붙어 깔개 위 두 칸 중 한 칸에서만
// 나갔다(fs2 스웜 I24, 2026-11-04 서리나루 여관).
describe("handInteriorDoormat", () => {
  isolateTimers();
  const MAT = (HAND_INTERIOR_SPEC as { objects: Record<string, { cells: number[][] }> }).objects.doormat!.cells.map((c) => c[2]);
  let lastWarnings: string[] = [];
  function build(plan: string[], exitWidth?: number, objects?: { id: string; x: number; y: number }[]) {
    const ctx = { project: createBlankProject() };
    const parts = runTool(ctx, "list_hand_interior_parts", {}).data as { floors?: ({ id: string } | string)[]; walls?: ({ id: string } | string)[] };
    const pick = (x: { id: string } | string | undefined) => (typeof x === "string" ? x : x?.id);
    const res = runTool(ctx, "build_hand_interior_room", {
      tileset: "atlas_biome_interior", mapId: "room", name: "방", plan, floor: pick(parts.floors?.[0]), wall: pick(parts.walls?.[0]), ...(exitWidth ? { exitWidth } : {}), ...(objects ? { objects } : {}),
    });
    expect(res.ok).toBe(true);
    lastWarnings = ((res.data as { warnings?: string[] }).warnings ?? []);
    const map = ctx.project.maps.room!;
    const mats: string[] = [];
    for (const [name, layer] of [["lower", map.lowerOverlayTiles], ["upper", map.upperTiles]] as const) {
      layer?.forEach((tile, i) => { if (MAT.includes(tile)) mats.push(`${name}:${i % map.width},${Math.floor(i / map.width)}`); });
    }
    return mats;
  }
  describe("build_hand_interior_room 발깔개", () => {
    it("1칸 출구에는 깔지 않는다", () => {
      expect(build(["########", "#......#", "#......#", "#......#", "###.####"])).toEqual([]);
    });

    it("2칸 출구에는 틈 바로 안쪽 두 칸에 맞춰 깐다", () => {
      const mats = build(["########", "#......#", "#......#", "#......#", "###..###"], 2);
      expect(mats.map((m) => m.split(":")[1])).toEqual(["3,3", "4,3"]);
    });

    it("조수가 출구 안쪽을 벗어난 발깔개를 깔면 경고한다", () => {
      build(["########", "#......#", "#......#", "#......#", "###.####"], undefined, [{ id: "doormat", x: 3, y: 3 }]);
      expect(lastWarnings.some((w) => w.includes("2칸 출구 전용"))).toBe(true);
      build(["########", "#......#", "#......#", "#......#", "###..###"], 2, [{ id: "doormat", x: 3, y: 3 }]);
      expect(lastWarnings.some((w) => w.includes("2칸 출구 전용"))).toBe(false);
    });
  });
});

// 손 도트 실내 v5 부품 찾기(list_hand_interior_parts) — 사양의 설명·태그·놓는 곳·짝 소품, 여러 낱말 검색, 방 종류 묶음.
describe("handInteriorParts", () => {
  isolateTimers();
  const run = (args: Record<string, unknown>) => LIST_HAND_INTERIOR_PARTS_TOOL.run(createBlankProject() as never, args as never) as { summary: string; data: any };
  describe("handInteriorSpec 소품 메모", () => {
    it("643종(v5 381 + 고른 「함께 쓰기」 변형 5 + 고른 새 기물·interior-plus·퍼즐·낙성 실내·이야기 기물 8) 모두 desc·tags 가 있고, desc 는 60자 이하·서로 다르다", () => {
      const objs = Object.entries(S.objects);
      // 527 → 635: 이후 handInteriorSpec.json 에 기물이 더해졌다(interior-plus·퍼즐 #3081·낙성 실내 #3234·#3277 등). 635 → 643: 이야기 기물 8종(oneshot, 2026-11-12).
      expect(objs.length).toBe(643);
      for (const [id, o] of objs) {
        expect(o.desc, id).toBeTruthy();
        expect(o.desc!.length, id).toBeLessThanOrEqual(60);
        expect(o.tags?.length, id).toBeGreaterThan(0);
      }
      const descs = objs.map(([, o]) => `${o.desc} ${o.place}`);
      expect(new Set(descs).size).toBe(descs.length);
    });
    it("짝 소품은 있는 id(가구·탁상 물건·탁자 스타일·줄)만 가리킨다", () => {
      for (const [id, o] of Object.entries(S.objects)) for (const p of o.pair ?? [])
        expect(Boolean(S.objects[p] || p.startsWith("goods:") || S.tables[p.split(" ")[0]!] || S.lines[p]), `${id} → ${p}`).toBe(true);
    });
    it("방 표: 예제 30맵의 방마다 방 종류가 있고 그 종류가 kinds 에 있다", () => {
      const t = S.rooms!;
      // 26 → 30: 이후 예제 맵이 더해졌다(handInteriorSpec.json rooms.examples).
      expect(new Set(t.examples.map((e) => e[0])).size).toBe(30);
      for (const [, , room] of t.examples) expect(t.kinds[room], room).toBeTruthy();
    });
  });
  describe("list_hand_interior_parts", () => {
    it("여러 낱말은 모든 낱말이 맞는 것만 준다 — 「여관 벽」에 다트판·술통 선반", () => {
      const r = searchParts("여관 벽");
      expect(r.allMatch).toBeGreaterThan(0);
      expect(r.ids.length).toBe(r.allMatch);
      expect(r.ids).toEqual(expect.arrayContaining(["dart board", "keg rack"]));
      for (const id of r.ids) expect(r.hits.get(id)).toBe(2);
    });
    it("태그·설명으로도 찾는다(이름에 없는 낱말) — 「부엌」에 조리 화덕", () => {
      expect(searchParts("부엌").ids).toContain("kitchen range");
    });
    it("결과가 12종 이하면 행에 desc·tags·place·pair, 많으면 짧은 행", () => {
      // "bed" 는 기물이 늘어 13종이 되었다 — 12종 이하인 낱말(선장 9종)로 짧은 결과 경로를 본다.
      const few = run({ query: "선장" });
      expect(few.data.objects.length).toBeLessThanOrEqual(12);
      expect(few.data.objects[0]).toEqual(expect.objectContaining({ desc: expect.any(String), tags: expect.any(Array), place: expect.any(String) }));
      const many = run({ query: "부엌" });
      expect(many.data.objects.length).toBeGreaterThan(12);
      expect(many.data.objects[0].place).toBeUndefined();
      expect(many.data.objects[0].desc).toBeTruthy();
    });
    it("room: 건물 id·이름, 방 종류 이름을 알아듣고 종류별로 묶는다", () => {
      expect(resolveRoom("bakery")).toEqual({ mode: "building", key: "bakery" });
      expect(resolveRoom("빵집")).toEqual({ mode: "building", key: "bakery" });
      expect(resolveRoom("여관 객실")).toEqual({ mode: "room", key: "inn_room" });
      expect(resolveRoom("부엌")).toEqual({ mode: "room", key: "kitchen" });
      const bakery = roomParts("bakery")!;
      expect(bakery.exampleDocs).toEqual(["hand-interior-v5-map-bakery"]);
      expect(bakery.groups.wall!.map((p) => p.id)).toEqual(expect.arrayContaining(["bread oven", "bread shelf"]));
      expect(bakery.rooms!.map((r) => r.room)).toEqual(expect.arrayContaining(["bakery_oven", "bakery_shop"]));
      const inn = run({ room: "여관 객실" });
      expect(inn.data.groups.floor.map((p: { id: string }) => p.id)).toContain("nightstand");
      expect(() => run({ room: "화성 기지" })).toThrow(/모른다/);
    });
  });
});

// 방 목록 → 평면(src/editor/handInterior/rooms.ts)과 build_hand_interior_room 의 rooms 입력.
// 위키: openwiki/atlas-biome-interior.md 「방 목록 입력」.
describe("handInteriorRooms", () => {
  isolateTimers();
  const JP_HOUSE = {
    rooms: [
      { id: "washitsu", x0: 1, y0: 1, x1: 7, y1: 6, floor: "tatami", wall: "juraku" },
      { id: "toilet", x0: 9, y0: 1, x1: 11, y1: 6, floor: "cushion" },
      { id: "kitchen", x0: 13, y0: 1, x1: 21, y1: 6, floor: "cushion", wall: "kitchen-panel" },
      { id: "bath", x0: 1, y0: 8, x1: 4, y1: 13, floor: "bathtile", wall: "bathwall" },
      { id: "hall", x0: 6, y0: 8, x1: 11, y1: 14 },
      { id: "living", x0: 13, y0: 8, x1: 21, y1: 14 },
    ],
    connect: [{ a: "washitsu", b: "hall", door: "fusuma-open" }, { a: "toilet", b: "hall", door: "door-open-toilet" }, { a: "kitchen", b: "living", door: "none" },
      { a: "bath", b: "hall", door: "door-side-sliding" }, { a: "hall", b: "living" }],
    exit: { room: "hall" },
  };
  describe("방 목록 → 평면", () => {
    it("칸막이·문 틈·출구를 계산한다", () => {
      const c = composeHandInteriorRooms(JP_HOUSE.rooms, JP_HOUSE.connect, JP_HOUSE.exit, JP_INTERIOR_SPEC);
      expect(c.plan).toEqual([
        "#######################",
        "#.......#...#.........#",
        "#.......#...#.........#",
        "#.......#...#.........#",
        "#.......#...#.........#",
        "#.......#...#.........#",
        "#.......#...#.........#",
        "######.###.######.#####",
        "#....#......#.........#",
        "#...........#.........#",
        "#.....................#",
        "#.....................#",
        "#....#................#",
        "#....#......#.........#",
        "######......#.........#",
        "########.##############",
      ]);
      // 가로 칸막이 = 1칸 틈에 door, 세로 칸막이 = 3줄 틈의 셋째 줄에 sidedoor, none = 틈만
      expect(c.doors).toEqual([
        { id: "fusuma-open", x: 6, y: 7 }, { id: "door-open-toilet", x: 10, y: 7 },
        { id: "door-side-sliding", x: 5, y: 11 }, { id: "door-side-western", x: 12, y: 12 },
      ]);
      expect(c.zones.find((z) => z.floor === "tatami")).toEqual({ x0: 1, y0: 0, x1: 7, y1: 6, floor: "tatami", wall: "juraku" });
    });

    it("잘못 놓은 방은 이유와 함께 거부한다", () => {
      const S = WIZARDING_INTERIOR_SPEC;
      expect(() => composeHandInteriorRooms([{ id: "a", x0: 1, y0: 1, x1: 4, y1: 4 }, { id: "b", x0: 3, y0: 3, x1: 6, y1: 6 }], [], undefined, S)).toThrow(/겹친다/);
      expect(() => composeHandInteriorRooms([{ id: "a", x0: 1, y0: 1, x1: 4, y1: 4 }, { id: "b", x0: 7, y0: 1, x1: 9, y1: 4 }], [{ a: "a", b: "b" }], undefined, S)).toThrow(/1칸 칸막이가 아니다/);
      expect(() => composeHandInteriorRooms([{ id: "a", x0: 1, y0: 1, x1: 4, y1: 2 }], [], undefined, S)).toThrow(/3줄 이상/);
      expect(() => composeHandInteriorRooms([{ id: "a", x0: 1, y0: 1, x1: 4, y1: 4 }, { id: "b", x0: 6, y0: 1, x1: 8, y1: 8 }], [], { room: "a" }, S)).toThrow(/맨 아래/);
      // 마법 학교에는 문 기물이 없다 — 틈만 연다
      const c = composeHandInteriorRooms([{ id: "a", x0: 1, y0: 1, x1: 4, y1: 4 }, { id: "b", x0: 1, y0: 6, x1: 4, y1: 9 }], [{ a: "a", b: "b" }], undefined, S);
      expect(c.doors).toEqual([]);
      expect(c.plan[5]).toBe("##.###");
    });
  });
  describe("build_hand_interior_room rooms 입력", () => {
    const blank = (): { project: Project } => ({ project: createBlankProject() });

    it("일본 집을 rooms 로 지으면 칸막이 있는 방이 오류 없이 지어진다", () => {
      const ctx = blank();
      const r = runTool(ctx, "build_hand_interior_room", { tileset: "jp_city", name: "일본 집 1층", floor: "flooring", wall: "cloth", ...JP_HOUSE });
      expect(r.ok, r.summary).toBe(true);
      const data = r.data as { plan: string[]; openings: unknown[]; unreachedFloor: unknown[] };
      expect(data.plan).toHaveLength(16);
      expect(data.openings).toHaveLength(5);
      expect(data.unreachedFloor).toEqual([]);
    });

    it("plan 과 rooms 를 함께 주면 거부한다", () => {
      const r = runTool(blank(), "build_hand_interior_room", { tileset: "jp_city", floor: "flooring", wall: "cloth", plan: ["###", "#.#", "#.#", "#.#"], rooms: JP_HOUSE.rooms });
      expect(r.ok).toBe(false);
    });

    it("바닥 무늬만 다른 구역이 떠 있으면 경고하고, 예제 평면을 베끼면 경고한다", () => {
      const ctx = blank();
      const plan = ["############", "#..........#", "#..........#", "#..........#", "#..........#", "#..........#", "#..........#", "#####.######"];
      const r = runTool(ctx, "build_hand_interior_room", { tileset: "jp_city", plan, floor: "flooring", wall: "cloth", zones: [{ x0: 3, y0: 3, x1: 7, y1: 5, floor: "tatami" }] });
      expect(r.ok).toBe(true);
      expect(r.summary).toMatch(/떠 있다/);
    });

    it("tileset 을 빠뜨려도 바닥 id 로 칩셋을 찾는다", () => {
      const ctx = blank();
      const r = runTool(ctx, "build_hand_interior_room", { floor: "flooring", wall: "cloth", plan: ["#######", "#.....#", "#.....#", "#.....#", "###.###"] });
      expect(r.ok, r.summary).toBe(true);
      expect((r.data as { tilesetId: string }).tilesetId).toBe("jp_city");
    });
  });
});
