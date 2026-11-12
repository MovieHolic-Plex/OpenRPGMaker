// 놓기 규칙(place/placementRules.ts)의 출입구 그림 — 칩셋이 적어 둔 입구가 먼저고, 이름표 낱말은 굽기가 무엇인지 적지 않은 타일에만 쓴다.
// 낱말로만 읽던 때(2026-11-12 칩셋별 표): 「가문비」(문) 곁의 맨땅 던전 출입구가 «문 그림 있음» 으로 넘어갔고,
// 걸어 지나는 「가미나리몬(가운데 통과)」(통) 밑의 출구가 «물건 그림 위 출입구» 로 짚였다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { dressBareCaveGates } from "@/ai/v2/place/caveGates";
import { isEntranceArt } from "@/ai/v2/place/entrances";
import { placementProblems } from "@/ai/v2/place/placementRules";
import type { BuildRun } from "@/ai/v2/shared/types";

type Ctx = { project: Project };
type Meta = { label?: string; role?: string } | undefined;
type Kit = { id?: string; rows: { tiles?: number[]; upperTiles?: number[] }[]; parts?: { kind?: string; dx: number; dy: number; w?: number; h?: number }[] };
const runOf = (ctx: Ctx): BuildRun => ({ ctx, calls: [], call: (tool: string, args: Record<string, unknown>) => runTool(ctx, tool, args) }) as unknown as BuildRun;
const gate = (id: string, x: number, y: number, mapId: string): GameEvent => ({
  id, name: "", x, y, trigger: { kind: "playerTouch" }, commands: [],
  pages: [{ id: `${id}_p0`, name: "", conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "transfer", mapId, x: 2, y: 2, direction: "down" }] }],
}) as unknown as GameEvent;

/** 걷는 바닥만 깐 바깥 맵 map_o(30×24)와 던전 맵 map_c, 그냥 맵 map_n. paint 로 map_o 에 그림을 놓는다. */
function stage(tilesetId: string, paint: (lower: number[], upper: number[], w: number, tileOf: (label: RegExp, role?: string) => number) => void): Ctx {
  const ctx: Ctx = { project: createBlankProject() };
  const tileset = ctx.project.tilesets[tilesetId]!;
  const meta = tileset.tileMeta as unknown as Meta[];
  for (const id of ["map_o", "map_c", "map_n"]) expect(runTool(ctx, "create_map", { id, name: id, width: 30, height: 24, tilesetId }).ok).toBe(true);
  const floor = tileset.passability.findIndex((p, t) => !!p && p.up && p.down && p.left && p.right && (meta[t]?.role === "terrain" || meta[t]?.role === "road" || meta[t]?.role === undefined) && !!meta[t]?.label && !/문|굴|길|다리|통|돌|풀/u.test(meta[t]!.label!));
  expect(floor).toBeGreaterThanOrEqual(0);
  const tileOf = (label: RegExp, role?: string): number => {
    const t = meta.findIndex((m) => !!m?.label && label.test(m.label) && (role === undefined || m.role === role));
    expect(t, String(label)).toBeGreaterThanOrEqual(0);
    return t;
  };
  const maps = { ...ctx.project.maps };
  for (const id of ["map_o", "map_c", "map_n"]) {
    const map = structuredClone(maps[id]!) as GameMap;
    const lower = map.lowerTiles as number[], upper = map.upperTiles as number[];
    for (let i = 0; i < map.width * map.height; i++) { lower[i] = floor; upper[i] = -1; }
    if (id === "map_o") paint(lower, upper, map.width, tileOf);
    if (id === "map_c") (map as unknown as { mapRole: string }).mapRole = "dungeon";
    maps[id] = map;
  }
  ctx.project = { ...ctx.project, maps, startMapId: "map_o", startPos: { x: 2, y: 20 } } as Project;
  return ctx;
}
const withEvents = (ctx: Ctx, ...events: GameEvent[]): GameMap => {
  const map = { ...ctx.project.maps.map_o!, events } as GameMap;
  ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, map_o: map } } as Project;
  return map;
};
const kinds = (ctx: Ctx, map: GameMap): string[] => placementProblems(ctx.project, map).map((p) => `${p.kind}:${p.eventId}`).sort();

describe("door-bare reads the entrance the chipset declares, not a door word inside a prop's label", () => {
  it("a dungeon entrance on open ground under a spruce has no entrance picture", () => {
    const ctx = stage("snow_north", (_lower, upper, w, tileOf) => { upper[9 * w + 10] = tileOf(/^큰 가문비/u, "prop"); });
    const map = withEvents(ctx, gate("ev_tree", 10, 10, "map_c"), gate("ev_open", 20, 10, "map_c"));
    expect(kinds(ctx, map)).toEqual(["door-bare:ev_open", "door-bare:ev_tree"]);
  });

  it("the cell under a cave-mouth kit's declared entrance is not bare; under that kit's rock wall it is", () => {
    const ctx = stage("snow_north", (lower, upper, w) => {
      const kit = (createBlankProject().tilesets.snow_north as unknown as { structureKits: Kit[] }).structureKits.find((k) => k.id === "sn-ice-cave")!;
      kit.rows.forEach((row, y) => {
        (row.tiles ?? []).forEach((t, x) => { if (t >= 0) lower[(y + 5) * w + x + 8] = t; });
        (row.upperTiles ?? []).forEach((t, x) => { if (t >= 0) upper[(y + 5) * w + x + 8] = t; });
      });
    });
    // 키트 6×5 를 (8,5) 에 — 입구 부품은 (2,4) 폭 2 → 맵 (10,9)·(11,9). 그 밑 줄이 (·,10).
    expect(isEntranceArt(ctx.project, ctx.project.maps.map_o!, 10, 9)).toBe(true);
    const map = withEvents(ctx, gate("ev_mouth", 10, 10, "map_c"), gate("ev_rock", 8, 10, "map_c"));
    expect(kinds(ctx, map)).toEqual(["door-bare:ev_rock"]);
  });

  it("Beodeul: a bare dungeon entrance gets the adit stamped above it and is then dressed", () => {
    const ctx: Ctx = { project: createBlankProject() };
    for (const [id, w, h] of [["map_f", 30, 24], ["map_c", 20, 15]] as const) expect(runTool(ctx, "create_map", { id, name: id, width: w, height: h, tilesetId: "beodeul_city" }).ok).toBe(true);
    (ctx.project.maps.map_c as unknown as { mapRole: string }).mapRole = "dungeon";
    ctx.project.maps.map_f!.events = [gate("ev_cave", 14, 14, "map_c")];
    ctx.project = { ...ctx.project, startMapId: "map_f", startPos: { x: 3, y: 20 } } as Project;
    expect(placementProblems(ctx.project, ctx.project.maps.map_f!).map((p) => p.kind)).toEqual(["door-bare"]);
    expect(dressBareCaveGates(runOf(ctx), "map_f", [])).toHaveLength(1);
    const map = ctx.project.maps.map_f!, ev = map.events.find((e) => e.id === "ev_cave")!;
    expect(isEntranceArt(ctx.project, map, ev.x, ev.y - 1)).toBe(true);
    expect(placementProblems(ctx.project, map).filter((p) => p.kind === "door-bare")).toEqual([]);
  }, 60_000);
});

describe("transfer-prop: a tile the bake calls a building is not a loose prop", () => {
  it("an exit under a walk-through gate (「가미나리몬(가운데 통과)」) is not «on an object»; one on a boulder still is", () => {
    const jp = stage("jp_city", (_lower, upper, w, tileOf) => { upper[10 * w + 10] = tileOf(/^가미나리몬\(가운데 통과\) \(1,1\)/u, "building"); });
    expect(kinds(jp, withEvents(jp, gate("ev_gate", 10, 10, "map_n")))).toEqual([]);
    const snow = stage("snow_north", (_lower, upper, w, tileOf) => { upper[10 * w + 10] = tileOf(/^눈 덮인 큰 바위 \(1,1\)/u, "prop"); });
    expect(kinds(snow, withEvents(snow, gate("ev_rock", 10, 10, "map_n")))).toEqual(["transfer-prop:ev_rock"]);
  });
});
