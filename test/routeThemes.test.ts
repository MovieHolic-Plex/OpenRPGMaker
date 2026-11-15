// 길목(통행 지역) — author_wild_route{theme} 와 조수 v2 route 빌더의 계약(2026-11-15 시범: 산길·등산로 · 정령·요정 숲).
// 지나가는 곳이다: 가장자리 둘이 걸어서 이어지고, 걷는 칸은 모두 들어오는 칸에서 닿고, 주인공 볼거리가 서고, 갈래 안의 가짓수는 게임 열쇠와 씨앗이 고른다.
import { beforeEach, describe, expect, it } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { pickRouteVariant, ROUTE_THEMES, ROUTE_VARIANTS, routeFeatureWords } from "@/editor/tools/routeThemes";
import { createBlankProject } from "@/project/defaults";
import { canMove, isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { builderFor } from "@/ai/v2/place/builders";
import { ROUTE_CARD, routeArgs } from "@/ai/v2/place/builders/route";
import type { PlaceSpec } from "@/ai/v2/shared/types";
import skins from "@/assets/beodeulRouteSkins.json";

type Cell = { x: number; y: number };

function reach(project: Project, map: GameMap, from: Cell): { seen: Set<number>; lost: number } {
  const W = map.width, H = map.height, seen = new Set<number>([from.y * W + from.x]), q = [from.y * W + from.x];
  for (let h = 0; h < q.length; h += 1) {
    const c = q[h]!, x = c % W, y = (c - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy, n = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(n) || !canMove(project, map, x, y, nx, ny)) continue;
      seen.add(n); q.push(n);
    }
  }
  let lost = 0;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (!seen.has(y * W + x) && isPassable(project, map, x, y)) lost += 1;
  return { seen, lost };
}

function buildRoute(theme: string, seed: number, extra: Record<string, unknown> = {}, lookKey = "route-test"): { ctx: ToolContext; map: GameMap; data: Record<string, unknown>; warnings: string[] } {
  const ctx: ToolContext = { project: createBlankProject(), assistantRun: true, lookKey };
  const sideways = Array.isArray(extra.sides) && (extra.sides as string[]).every((s) => s === "east" || s === "west");
  expect(runTool(ctx, "create_map", { id: "map_route", name: "길목", width: sideways ? 40 : 32, height: sideways ? 32 : 42, tilesetId: "beodeul_city" }, { dryRun: false }).ok).toBe(true);
  const result = runTool(ctx, "author_wild_route", { mapId: "map_route", theme, seed, ...extra }, { dryRun: false });
  expect(result.ok, result.summary).toBe(true);
  return { ctx, map: ctx.project.maps.map_route!, data: (result.data ?? {}) as Record<string, unknown>, warnings: (result.warnings ?? []).map(String) };
}

beforeEach(() => { resetMapEditHistory(); });

describe("길목 갈래 표", () => {
  it.each(ROUTE_THEMES)("%s: 가짓수 스물, 주인공 볼거리가 서로 다르다", (theme) => {
    const all = ROUTE_VARIANTS[theme];
    expect(all.length).toBe(20);
    expect(new Set(all.map((v) => v.id)).size).toBe(20);
    expect(new Set(all.map((v) => v.hero.id)).size).toBe(20);
    expect(new Set(all.map((v) => v.layout)).size).toBeGreaterThanOrEqual(5);
  });

  it("고르기: 열쇠·씨앗으로 갈리고, 쓴 것은 피하고, 닫힌 낱말로 좁힌다 — 이름은 받지 않는다", () => {
    const picks = new Set(Array.from({ length: 40 }, (_, seed) => pickRouteVariant("mountain", "game-a", seed).id));
    expect(picks.size).toBeGreaterThanOrEqual(12);
    const used = new Set<string>();
    for (let i = 0; i < 20; i += 1) used.add(pickRouteVariant("spirit", "game-b", 7, undefined, used).id);
    expect(used.size).toBe(20);   // 같은 열쇠·같은 씨앗이어도 그 게임이 쓴 것은 다시 고르지 않는다
    for (let seed = 0; seed < 10; seed += 1) expect(pickRouteVariant("mountain", "game-c", seed, "bridge").tags).toContain("bridge");
    expect(pickRouteVariant.length).toBeLessThanOrEqual(5);
  });

  it("구운 표: 길·수관 칸은 이웃 비트 16 × 위상 16, 다리는 세 줄 두 칸", () => {
    const t = skins as unknown as { base: number; end: number; spirit: { ground: number[][]; path: number[][]; canopy: number[][] }; bridge: Record<string, number[][]> };
    expect(t.spirit.ground.length).toBe(2);
    for (const table of [t.spirit.path, t.spirit.canopy]) { expect(table.length).toBe(16); for (const row of table) expect(row.length).toBe(16); }
    for (const name of ["rope", "vine"]) { expect(t.bridge[name]!.length).toBe(3); for (const row of t.bridge[name]!) expect(row.length).toBe(2); }
    const cells = [...t.spirit.ground.flat(), ...t.spirit.path.flat(), ...t.spirit.canopy.flat(), ...Object.values(t.bridge).flat(2)];
    expect(cells.every((n) => n >= t.base && n < t.end)).toBe(true);
  });
});

describe("author_wild_route theme", () => {
  it.each([["mountain", 3], ["mountain", 11], ["mountain", 27], ["spirit", 3], ["spirit", 11], ["spirit", 27]] as const)("%s seed %i: 가장자리가 이어지고 걷는 칸이 모두 닿고 볼거리가 선다", (theme, seed) => {
    const { ctx, map, data } = buildRoute(theme, seed);
    const entry = data.entry as Cell, exit = data.exit as Cell;
    expect(entry.y).toBe(map.height - 1);
    expect(exit.y).toBe(0);
    const r = reach(ctx.project, map, entry);
    expect(r.seen.has(exit.y * map.width + exit.x), `${data.variant} 출구`).toBe(true);
    expect(r.lost, `${data.variant} 닿지 않는 걷는 칸`).toBe(0);
    expect(data.heroAt, `${data.variant} 볼거리`).toBeTruthy();
    expect(map.mapRole).toBe("field");
    expect((map.locations ?? []).some((l) => (l.tags ?? []).includes("route-variant") && l.note === data.variant)).toBe(true);
    for (const spot of data.enemySpots as Cell[]) expect(r.seen.has(spot.y * map.width + spot.x)).toBe(true);
    // 산길에는 높이 단과 돌계단이, 정령 숲에는 제 바닥 칸이 깔린다
    const t = skins as unknown as { base: number; end: number };
    if (theme === "spirit") expect(map.lowerTiles.filter((n) => n >= t.base && n < t.end).length).toBeGreaterThan(map.width * map.height * 0.5);
  }, 60_000);

  it("동서로 지나는 길목도 이어진다", () => {
    const { ctx, map, data } = buildRoute("mountain", 5, { sides: ["west", "east"] });
    const entry = data.entry as Cell, exit = data.exit as Cell;
    expect(entry.x).toBe(0);
    expect(exit.x).toBe(map.width - 1);
    const r = reach(ctx.project, map, entry);
    expect(r.seen.has(exit.y * map.width + exit.x)).toBe(true);
    expect(r.lost).toBe(0);
  }, 60_000);

  it("feature 는 그 갈래의 닫힌 낱말만 — 다리를 청하면 다리가 놓이고, 모르는 낱말은 거절한다", () => {
    const { data } = buildRoute("mountain", 9, { feature: "bridge" });
    expect(["rope-bridge", "leaf-bridge"]).toContain(data.hero);
    const ctx: ToolContext = { project: createBlankProject(), assistantRun: true, lookKey: "k" };
    runTool(ctx, "create_map", { id: "map_route", name: "길목", width: 32, height: 42, tilesetId: "beodeul_city" }, { dryRun: false });
    expect(runTool(ctx, "author_wild_route", { mapId: "map_route", theme: "mountain", feature: "구름다리" }, { dryRun: false }).ok).toBe(false);
    expect(runTool(ctx, "author_wild_route", { mapId: "map_route", theme: "swamp" }, { dryRun: false }).ok).toBe(false);
  }, 60_000);

  it("theme 없는 옛 호출은 그대로다(exits 필수)", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    runTool(ctx, "create_map", { id: "map_route", name: "1번 도로", width: 24, height: 36, tilesetId: "beodeul_city" }, { dryRun: false });
    expect(runTool(ctx, "author_wild_route", { mapId: "map_route" }, { dryRun: false }).ok).toBe(false);
    expect(runTool(ctx, "author_wild_route", { mapId: "map_route", exits: [{ x: 12, y: 35 }, { x: 12, y: 0 }], seed: 1 }, { dryRun: false }).ok).toBe(true);
  }, 60_000);
});

describe("조수 v2 route 빌더", () => {
  const specOf = (over: Partial<PlaceSpec>): PlaceSpec => ({ type: "route", name: "북쪽 길목", theme: "mountain", variety: "game-x|요청", ...over });

  it("명세 → 인자: 갈래·크기·변·닫힌 낱말만 읽고, 씨앗은 게임 열쇠에서 나온다", () => {
    const a = routeArgs(specOf({})), b = routeArgs(specOf({ name: "다른 이름" })), c = routeArgs(specOf({ variety: "game-y|요청" }));
    expect(a.theme).toBe("mountain");
    expect(a.sides).toEqual(["south", "north"]);
    expect(a.seed).not.toBe(c.seed);
    expect(b.seed).not.toBe(a.seed);
    expect(routeArgs(specOf({ exits: ["west"] })).sides).toEqual(["west", "east"]);
    expect(routeArgs(specOf({ features: ["bridge", "용"] })).feature).toBe("bridge");
    expect(routeArgs(specOf({ features: ["용"] })).warnings.join(" ")).toContain("ignored");
    // 갈래를 안 주면 게임 열쇠가 고른다 — 이름에 «정령» 이 있어도 낱말로 가르지 않는다
    const byKey = new Set(Array.from({ length: 12 }, (_, i) => routeArgs({ type: "route", name: "정령 숲 입구", variety: `game-${i}|r` }).theme));
    expect(byKey.size).toBe(2);
    for (const theme of ROUTE_THEMES) for (const word of routeFeatureWords(theme)) expect(ROUTE_CARD).toContain(word);
  });

  it.each(["mountain", "spirit"] as const)("%s: 지은 결과에 들어오는 칸·볼거리 앞 칸·적 자리가 실린다", (theme) => {
    const ctx: ToolContext = { project: createBlankProject(), assistantRun: true, lookKey: "game-x" };
    const run = createBuildRun(ctx);
    const spec = specOf({ theme, size: "medium" });
    const builder = builderFor(spec)!;
    expect(builder.id).toBe("route");
    const res = builder.build(run, spec);
    expect(res.ok, res.summary).toBe(true);
    const map = ctx.project.maps[res.mapIds[0]!]!;
    expect(map.name).toBe("북쪽 길목");
    const state = res.state as { entry: Cell; exit: Cell; heroFront?: Cell; enemySpots: Cell[]; variant: string };
    const r = reach(ctx.project, map, state.entry);
    expect(r.seen.has(state.exit.y * map.width + state.exit.x)).toBe(true);
    expect(r.lost).toBe(0);
    expect(state.enemySpots.length).toBeGreaterThanOrEqual(2);
    expect(res.entrance).toEqual({ mapId: map.id, x: state.entry.x, y: state.entry.y });
    // 같은 게임의 둘째 길목은 다른 가짓수다
    const res2 = builder.build(run, specOf({ theme, name: "둘째 길목" }));
    expect(res2.ok, res2.summary).toBe(true);
    expect((res2.state as { variant: string }).variant).not.toBe(state.variant);
  }, 90_000);
});
