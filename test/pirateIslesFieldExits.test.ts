// 해적 군도 구성기 — 해안 들판(field) 종류, 다른 맵으로 나가는 길(exits), 섬의 부두·가장자리.
// 왜(2026-11-11 map-vqa 깔기 village-to-field): «마을 + 그 동쪽 들판, 마을 동쪽 길로 나가면 들판» 요청이 섬 마을(나가는 길 없음)과 항구(들판 종류 없음)로 지어졌다.
// 같은 판을 엔진 통행으로 다시 재니 섬의 부두와 수상 가옥 두 채는 섬에서 걸어 닿지 않았고(길 끝과 부두 사이 모래 한 줄이 얕은 물이 됐다), 모래 곶이 맵 위 가장자리에 닿아 있었다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { canMove, isPassable } from "@/project/collision";
import { PIRATE_DEFAULT_SIZE, PIRATE_MAP_KINDS, pirateKindFromText, type PirateMapKind } from "@/project/pirateIslesComposer";
import { isRoadGround } from "@/ai/v2/place/surface";
import type { GameMap, Project } from "@/project/types";

const SLOW = 120_000;
type Cell = { x: number; y: number };
type Data = { spawn: Cell; areas: { tag: string; x: number; y: number; w: number; h: number; access?: Cell }[]; exits?: ({ side: string } & Cell)[]; exitsMissing?: string[] };

function compose(kind: PirateMapKind, seed: number, extra: Record<string, unknown> = {}, size?: [number, number]): { project: Project; map: GameMap; data: Data; summary: string } {
  const ctx = { project: createBlankProject() };
  const [w, h] = size ?? [PIRATE_DEFAULT_SIZE[kind].w, PIRATE_DEFAULT_SIZE[kind].h];
  const mapId = (runTool(ctx, "create_map", { name: kind, width: w, height: h, tilesetId: "pirate_isles" }).data as { mapId: string }).mapId;
  const made = runTool(ctx, "compose_pirate_isles_map", { mapId, kind, seed, ...extra });
  expect(made.ok, made.summary).toBe(true);
  return { project: ctx.project, map: ctx.project.maps[mapId]!, data: made.data as Data, summary: made.summary };
}
/** 시작 칸에서 걸어 닿는 칸(엔진 통행). */
function reach(project: Project, map: GameMap, from: Cell): Set<string> {
  const seen = new Set([`${from.x},${from.y}`]), queue = [from];
  for (let cell = queue.pop(); cell; cell = queue.pop()) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const x = cell.x + dx, y = cell.y + dy;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height || seen.has(`${x},${y}`) || !canMove(project, map, cell.x, cell.y, x, y)) continue;
    seen.add(`${x},${y}`); queue.push({ x, y });
  }
  return seen;
}
const edgeCells = (map: GameMap): Cell[] => { const out: Cell[] = []; for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1) out.push({ x, y }); return out; };

describe("해적 군도 — 해안 들판", () => {
  it("field 는 종류 목록의 끝에 있다(앞 종류의 씨앗 소금이 바뀌지 않는다)", () => {
    expect(PIRATE_MAP_KINDS.slice(0, 8)).toEqual(["harbor", "beach", "fort", "wreck", "ship", "tavern", "hut", "cave"]);
    expect(PIRATE_MAP_KINDS.at(-1)).toBe("field");
    expect(pirateKindFromText("마을 동쪽 들판")).toBe("field");
    expect(pirateKindFromText("해적 항구 마을")).toBe("harbor");
  });
  it("들길이 서쪽 끝에서 동쪽 끝까지 이어지고, 오두막 문 앞에 닿으며, 맵의 대부분을 걷는다", () => {
    for (const seed of [1, 2, 7]) {
      const { project, map, data } = compose("field", seed);
      const seen = reach(project, map, data.spawn);
      const roadOn = (x: number) => Array.from({ length: map.height }, (_, y) => y).filter((y) => isRoadGround(project, map, x, y) && seen.has(`${x},${y}`));
      expect(roadOn(0).length, `seed ${seed} west`).toBeGreaterThanOrEqual(2);
      expect(roadOn(map.width - 1).length, `seed ${seed} east`).toBeGreaterThanOrEqual(2);
      const doors = data.areas.filter((a) => a.access);
      expect(doors.length).toBe(1);
      expect(seen.has(`${doors[0]!.access!.x},${doors[0]!.access!.y}`)).toBe(true);
      let walk = 0;
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (isPassable(project, map, x, y)) walk++;
      expect(walk / (map.width * map.height)).toBeGreaterThan(0.6);
      // 못 닿는 걷는 칸이 없다.
      expect(seen.size).toBe(walk);
    }
  }, SLOW);
  it("남쪽으로 나가는 들판은 바다 없이 남쪽 가장자리까지 길이 난다", () => {
    const { project, map, data } = compose("field", 5, { exits: ["south", "north"] });
    const seen = reach(project, map, data.spawn);
    expect(data.exits!.map((e) => e.side).sort()).toEqual(["north", "south"]);
    for (const exit of data.exits!) {
      expect(exit.side === "south" ? exit.y : exit.y).toBe(exit.side === "south" ? map.height - 1 : 0);
      expect(isRoadGround(project, map, exit.x, exit.y)).toBe(true);
      expect(seen.has(`${exit.x},${exit.y}`)).toBe(true);
    }
    expect(data.exitsMissing).toEqual([]);
  }, SLOW);
});

describe("해적 군도 — 나가는 길", () => {
  it("항구: 큰길은 이미 동서 가장자리에 닿아 있고, 북쪽은 골목을 내며, 남쪽(바다)은 못 낸다고 적는다", () => {
    const { project, map, data, summary } = compose("harbor", 2, { exits: ["east", "west", "north", "south"] });
    const seen = reach(project, map, data.spawn);
    expect(data.exits!.map((e) => e.side).sort()).toEqual(["east", "north", "west"]);
    for (const exit of data.exits!) {
      expect(isRoadGround(project, map, exit.x, exit.y), exit.side).toBe(true);
      expect(seen.has(`${exit.x},${exit.y}`), exit.side).toBe(true);
    }
    expect(data.exits!.find((e) => e.side === "north")!.y).toBe(0);
    expect(data.exitsMissing).toEqual(["south"]);
    expect(summary).toContain("길을 못 낸 변 south");
    // 건물 문 앞은 그대로 닿는다.
    for (const area of data.areas.filter((a) => a.access && a.tag !== "lighthouse")) expect(seen.has(`${area.access!.x},${area.access!.y}`), area.tag).toBe(true);
  }, SLOW);
  it("exits 를 주지 않으면 결과에 exits 칸이 없다(예전 호출과 같은 모양)", () => {
    const { data } = compose("harbor", 2);
    expect(data.exits).toBeUndefined();
  }, SLOW);
  it("섬(beach)은 가장자리로 나가는 길이 없다 — 주문한 변을 모두 «못 냈다» 로 돌려준다", () => {
    const { data } = compose("beach", 3, { exits: ["east", "north"] });
    expect(data.exits).toEqual([]);
    expect(data.exitsMissing!.sort()).toEqual(["east", "north"]);
  }, SLOW);
});

describe("해적 군도 — 섬의 부두와 가장자리", () => {
  it("섬 마을의 부두와 수상 가옥은 섬에서 걸어 닿고, 섬은 맵 가장자리에 닿지 않는다(48×36 씨앗 8429 — 끊겨 있던 판)", () => {
    const { project, map, data } = compose("beach", 8429, {}, [48, 36]);
    const seen = reach(project, map, data.spawn);
    const pier = data.areas.find((a) => a.tag === "pier")!;
    expect(seen.has(`${pier.x},${pier.y + pier.h - 1}`)).toBe(true);
    const stilts = data.areas.filter((a) => a.tag === "stilt-hut");
    expect(stilts.length).toBe(2);
    for (const hut of stilts) expect(seen.has(`${hut.access!.x},${hut.access!.y}`)).toBe(true);
    expect(edgeCells(map).filter((c) => isPassable(project, map, c.x, c.y))).toEqual([]);
  }, SLOW);
});
