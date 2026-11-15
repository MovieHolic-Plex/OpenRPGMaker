// 길목(통행 지역) — author_wild_route{theme} 와 조수 v2 route 빌더의 계약(2026-11-15 시범: 산길·등산로 · 정령·요정 숲).
// 지나가는 곳이다: 가장자리 둘이 걸어서 이어지고, 걷는 칸은 모두 들어오는 칸에서 닿고, 주인공 볼거리가 서고, 갈래 안의 가짓수는 게임 열쇠와 씨앗이 고른다.
import { beforeEach, describe, expect, it } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { pickRouteVariant, ROUTE_FEATURES, ROUTE_LAYOUT_MAX, ROUTE_THEMES, ROUTE_VARIANTS, routeFeatureWords, routeVariantFor } from "@/editor/tools/routeThemes";
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
    expect(new Set(all.map((v) => v.layout)).size).toBeGreaterThanOrEqual(7);
    // 한 게임 안 스무 장에서 한 짜임이 다섯 장을 넘지 않는다 · 모든 가짓수가 곁가지를 갖는다 · 볼거리 낱말은 모든 갈래가 같이 쓰는 한 벌이다
    const perLayout = new Map<string, number>();
    for (const v of all) perLayout.set(v.layout, (perLayout.get(v.layout) ?? 0) + 1);
    expect(Math.max(...perLayout.values())).toBeLessThanOrEqual(5);
    expect(all.every((v) => v.side !== "none")).toBe(true);
    expect(all.every((v) => v.tags.every((t) => (ROUTE_FEATURES as readonly string[]).includes(t)))).toBe(true);
    // 직각으로만 꺾이지 않는 짜임(굽이)이 갈래마다 있다
    expect(all.some((v) => ["meander", "switchback", "winding"].includes(v.layout) && (v.hero.site === "beside" || v.hero.site === "line"))).toBe(true);
  });

  it("고르기: 열쇠·씨앗으로 갈리고, 쓴 것은 피하고, 닫힌 낱말로 좁힌다 — 이름은 받지 않는다", () => {
    const picks = new Set(Array.from({ length: 40 }, (_, seed) => pickRouteVariant("mountain", "game-a", seed).id));
    expect(picks.size).toBeGreaterThanOrEqual(12);
    const used = new Set<string>();
    for (let i = 0; i < 20; i += 1) used.add(pickRouteVariant("spirit", "game-b", 7, undefined, used).id);
    expect(used.size).toBe(20);   // 같은 열쇠·같은 씨앗이어도 그 게임이 쓴 것은 다시 고르지 않는다
    for (let seed = 0; seed < 10; seed += 1) expect(pickRouteVariant("mountain", "game-c", seed, "bridge").tags).toContain("bridge");
    expect(pickRouteVariant.length).toBeLessThanOrEqual(6);
  });

  it("구운 표: 다리는 세 줄 두 칸, 폭포는 바위턱 두 줄만 걷는 칸 — 정령 숲의 바탕(바닥·길·숲)은 버들항 그대로라 표에 없다", () => {
    const t = skins as unknown as { base: number; end: number; spirit: { falls: { lower: number[][]; solid: number[][]; veil: number[][] }; ground?: unknown; canopy?: unknown }; bridge: Record<string, number[][]> };
    expect(t.spirit.ground).toBeUndefined();
    expect(t.spirit.canopy).toBeUndefined();
    for (const part of [t.spirit.falls.lower, t.spirit.falls.solid, t.spirit.falls.veil]) { expect(part.length).toBe(7); for (const row of part) expect(row.length).toBe(7); }
    expect(t.spirit.falls.lower.map((row) => row.filter((n) => n >= 0).length)).toEqual([0, 0, 0, 7, 7, 0, 0]);
    expect(t.spirit.falls.veil[3]!.map((n) => n >= 0)).toEqual([false, false, true, true, true, false, false]);
    for (const name of ["rope", "vine"]) { expect(t.bridge[name]!.length).toBe(3); for (const row of t.bridge[name]!) expect(row.length).toBe(2); }
    const cells = [...t.spirit.falls.lower.flat().filter((n) => n >= 0), ...Object.values(t.bridge).flat(2)];
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
    if (data.sideAt) expect(r.seen.has((data.sideAt as Cell).y * map.width + (data.sideAt as Cell).x)).toBe(true);
    expect(map.mapRole).toBe("field");
    expect((map.locations ?? []).some((l) => (l.tags ?? []).includes("route-variant") && l.note === data.variant)).toBe(true);
    for (const spot of data.enemySpots as Cell[]) expect(r.seen.has(spot.y * map.width + spot.x)).toBe(true);
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
    const { data } = buildRoute("mountain", 9, { feature: "bridge", shape: "crossing" });
    expect(["rope-bridge", "leaf-bridge"]).toContain(data.hero);
    const ctx: ToolContext = { project: createBlankProject(), assistantRun: true, lookKey: "k" };
    runTool(ctx, "create_map", { id: "map_route", name: "길목", width: 32, height: 42, tilesetId: "beodeul_city" }, { dryRun: false });
    expect(runTool(ctx, "author_wild_route", { mapId: "map_route", theme: "mountain", feature: "구름다리" }, { dryRun: false }).ok).toBe(false);
    expect(runTool(ctx, "author_wild_route", { mapId: "map_route", theme: "swamp" }, { dryRun: false }).ok).toBe(false);
  }, 60_000);

  it("꼴은 자료가 정한다: 변 하나 = 막다른 길, 셋 = 세 갈래, 넷 = 네거리, 던전 = 던전 어귀 — 길이 닿은 변마다 가장자리 칸이 있고 모두 걸어서 닿는다", () => {
    for (const theme of ["mountain", "spirit"] as const) {
      for (const [sides, shape] of [[["south"], "dead-end"], [["north"], "dead-end"], [["west"], "dead-end"], [["south", "north", "east"], "tee"], [["west", "east", "north", "south"], "cross"]] as const) {
        const { ctx, map, data } = buildRoute(theme, 7, { sides: [...sides] });
        expect(data.shape, `${theme} ${sides.join("·")}`).toBe(shape);
        const exits = data.routeExits as { side: string; x: number; y: number }[];
        expect(exits.map((e) => e.side).sort()).toEqual([...sides].sort());
        const r = reach(ctx.project, map, data.entry as Cell);
        for (const e of exits) {
          expect(e.side === "north" ? e.y === 0 : e.side === "south" ? e.y === map.height - 1 : e.side === "west" ? e.x === 0 : e.x === map.width - 1).toBe(true);
          expect(r.seen.has(e.y * map.width + e.x), `${theme} ${shape} ${e.side}`).toBe(true);
        }
        expect(r.lost, `${theme} ${shape}`).toBe(0);
        expect(data.heroAt, `${theme} ${shape} 볼거리`).toBeTruthy();
      }
      // 던전 어귀: 변 하나면 길 끝에, 둘이면 곁길 끝에 입구 칸 — 그 남쪽 칸이 걸어서 닿는 길이다
      for (const sides of [["south"], ["south", "north"]] as const) {
        const { ctx, map, data } = buildRoute(theme, 5, { sides: [...sides], dungeon: "temple" });
        expect(data.shape).toBe("dungeon-mouth");
        const gate = data.dungeonGate as Cell;
        expect(gate, `${theme} ${sides.length} 던전 입구`).toBeTruthy();
        const r = reach(ctx.project, map, data.entry as Cell);
        expect(r.seen.has((gate.y + 1) * map.width + gate.x)).toBe(true);
        expect(r.lost).toBe(0);
      }
    }
  }, 240_000);

  it("둘 잇는 길은 그 게임이 덜 쓴 꼴부터 — 한 게임의 여덟 장에 꼴이 여섯 가지 넘게 나온다", () => {
    const ctx: ToolContext = { project: createBlankProject(), assistantRun: true, lookKey: "route-test" };
    const shapes = new Set<string>();
    for (let n = 0; n < 8; n += 1) {
      const id = `map_r${n}`;
      runTool(ctx, "create_map", { id, name: `길목 ${n}`, width: 36, height: 40, tilesetId: "beodeul_city" }, { dryRun: false });
      const result = runTool(ctx, "author_wild_route", { mapId: id, theme: "spirit", seed: n }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      const data = result.data as Record<string, unknown>, map = ctx.project.maps[id]!;
      shapes.add(String(data.shape));
      expect(reach(ctx.project, map, data.entry as Cell).lost, `${data.shape} ${data.variant}`).toBe(0);
    }
    expect(shapes.size).toBeGreaterThanOrEqual(6);
  }, 240_000);

  it("굽은 길은 톱니가 아니다: 한 칸짜리 계단이 없고 같은 계단이 네 번 넘게 이어지지 않는다 — 같은 기물은 한 장에 여섯 이하", () => {
    for (const theme of ["mountain", "spirit"] as const) for (const seed of [2, 8, 14, 21]) {
      const { data } = buildRoute(theme, seed);
      const steps = data.pathSteps as { single: number; repeat: number };
      expect(steps.single, `${theme} ${seed} ${data.variant}`).toBe(0);
      expect(steps.repeat, `${theme} ${seed} ${data.variant}`).toBeLessThanOrEqual(4);
      expect(data.kitMax as number, `${theme} ${seed} ${data.variant}`).toBeLessThanOrEqual(6);
    }
  }, 240_000);

  it("정령 숲은 숲 속 길이다: 넓은 곳 꼴이 아니면 걷는 칸 밖은 숲이다(막힌 칸이 맵의 사 할을 넘는다)", () => {
    for (const [shape, seed] of [["pass", 3], ["hidden-fork", 6], ["maze", 9]] as const) {
      const { ctx, map, data } = buildRoute("spirit", seed, { shape });
      let shut = 0;
      for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) if (!isPassable(ctx.project, map, x, y)) shut += 1;
      expect(shut / (map.width * map.height), `${shape} ${data.variant}`).toBeGreaterThan(0.4);
    }
  }, 240_000);

  it("산길의 단은 가로 띠만이 아니다: 한 게임의 열두 장에 단의 꼴이 네 가지 넘게 나온다(띠 · 기운 비탈 · 분지 · 중간에서 끝나는 턱)", () => {
    const ctx: ToolContext = { project: createBlankProject(), assistantRun: true, lookKey: "route-test" };
    const reliefs = new Set<string>();
    for (let n = 0; n < 12; n += 1) {
      const id = `map_r${n}`;
      runTool(ctx, "create_map", { id, name: `길목 ${n}`, width: 38, height: 40, tilesetId: "beodeul_city" }, { dryRun: false });
      const result = runTool(ctx, "author_wild_route", { mapId: id, theme: "mountain", seed: n }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      const data = result.data as Record<string, unknown>, map = ctx.project.maps[id]!;
      reliefs.add(String(data.relief));
      expect(reach(ctx.project, map, data.entry as Cell).lost, `${data.relief} ${data.variant}`).toBe(0);
    }
    expect([...reliefs].filter((r) => r !== "flat").length, [...reliefs].join(" ")).toBeGreaterThanOrEqual(4);
    // 막다른 길은 꼭대기 한 곳만 솟은 봉우리가 될 수 있다
    const peaks = [1, 2, 3, 4, 5, 6].map((seed) => buildRoute("mountain", seed, { sides: ["south"] }).data.relief);
    expect(peaks).toContain("peak");
  }, 300_000);

  it("한 게임에서 한 짜임이 다섯을 넘지 않게 고른다", () => {
    const full = new Map([["winding", ROUTE_LAYOUT_MAX]]);
    for (let seed = 0; seed < 12; seed += 1) {
      expect(routeVariantFor("spirit", "maze", 2, "k", seed, undefined, new Set(), full).layout).toBe("forks");
      expect(routeVariantFor("spirit", "pass", 2, "k", seed, undefined, new Set(), full).layout).not.toBe("winding");
      expect(routeVariantFor("spirit", "wide", 2, "k", seed, undefined, new Set(), full).layout).not.toBe("winding");
      expect(routeVariantFor("spirit", "dead-end", 1, "k", seed, undefined, new Set(), full).layout).not.toBe("winding");
    }
  });

  it("폭포는 물 장막 뒤 바위턱으로만 지나간다", () => {
    const ctx: ToolContext = { project: createBlankProject(), assistantRun: true, lookKey: "route-test" };
    let falls = 0;
    for (let n = 0; n < 6 && !falls; n += 1) {
      const id = `map_r${n}`;
      runTool(ctx, "create_map", { id, name: `길목 ${n}`, width: 32, height: 42, tilesetId: "beodeul_city" }, { dryRun: false });
      const result = runTool(ctx, "author_wild_route", { mapId: id, theme: "spirit", seed: 4, shape: "crossing" }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      const data = result.data as Record<string, unknown>, map = ctx.project.maps[id]!, entry = data.entry as Cell, exit = data.exit as Cell;
      if (data.variant !== "rainbow-falls") continue;
      falls += 1;
      const at = data.heroAt as { x: number; y: number }, W = map.width, wall = new Set<number>();
      for (const y of [at.y + 3, at.y + 4]) for (let i = 2; i <= 4; i += 1) wall.add(y * W + at.x + i);
      const q = [entry.y * W + entry.x], got = new Set(q);
      for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy, k = ny * W + nx;
          if (nx < 0 || ny < 0 || nx >= W || ny >= map.height || got.has(k) || wall.has(k) || !canMove(ctx.project, map, x, y, nx, ny)) continue; got.add(k); q.push(k); } }
      expect(reach(ctx.project, map, entry).seen.has(exit.y * W + exit.x)).toBe(true);
      expect(got.has(exit.y * W + exit.x), "폭포를 돌아가는 길").toBe(false);
    }
    expect(falls).toBe(1);
  }, 240_000);

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
    expect(routeArgs(specOf({ exits: ["west"] })).sides).toEqual(["west"]);   // 변 하나 = 막다른 길
    // 이웃 자료(make_game 이 채운다)가 있으면 그것이 변을 정한다 — 던전은 변이 아니다
    const linked = routeArgs(specOf({ routeLinks: [{ side: "south", kind: "village", paved: true }, { side: "east", kind: "route" }, { kind: "dungeon", dungeonType: "mine" }] }));
    expect(linked.sides).toEqual(["south", "east"]);
    expect(linked.dungeon).toBe("mine");
    expect(linked.villageSide).toBe("south");
    expect(routeArgs(specOf({ routeLinks: [{ side: "north", kind: "village" }, { kind: "dungeon", dungeonType: "cave" }] })).sides).toEqual(["north"]);
    expect(routeArgs(specOf({ features: ["bridge", "용"] })).feature).toBe("bridge");
    expect(routeArgs(specOf({ features: ["용"] })).warnings.join(" ")).toContain("ignored");
    // 갈래를 안 주면 게임 열쇠가 고른다 — 이름에 «정령» 이 있어도 낱말로 가르지 않는다
    const byKey = new Set(Array.from({ length: 12 }, (_, i) => routeArgs({ type: "route", name: "정령 숲 입구", variety: `game-${i}|r` }).theme));
    expect(byKey.size).toBe(2);
    for (const theme of ROUTE_THEMES) { expect(ROUTE_CARD).toContain(`${theme} (`); for (const word of routeFeatureWords(theme)) expect(ROUTE_CARD).toContain(word); }
    // 카드는 갈래마다 «id (풀이)» 한 토막만 자란다 — 갈래마다 낱말 목록을 싣지 않는다(열다섯 갈래에서도 +1,200자 안)
    expect(ROUTE_CARD.length).toBeLessThanOrEqual(600);
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
