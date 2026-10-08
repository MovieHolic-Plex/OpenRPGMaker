// 방 목록 → 평면(src/editor/handInterior/rooms.ts)과 build_hand_interior_room 의 rooms 입력.
// 위키: openwiki/atlas-biome-interior.md 「방 목록 입력」.
import { describe, expect, it } from "vitest";
import { JP_INTERIOR_SPEC, WIZARDING_INTERIOR_SPEC } from "@/editor/handInterior/builder";
import { composeHandInteriorRooms } from "@/editor/handInterior/rooms";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

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
