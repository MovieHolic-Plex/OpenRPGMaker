// 버들항 정착지의 급과 바닥(editor/tools/beodeulSettlementRank.ts · beodeulCommons.ts): 바닥은 정착지의 급을 따른다.
// 광장도 성벽도 청하지 않은 풀밭 마을은 돌 포장이 없고(길·마당이 한 몸으로 이어진 흙), 문 앞은 모두 흙이며, 집·문 도달은 그대로다.
// 포구는 잔교가 설 물가를 곧게 편 돌 둑을 낸다(beodeulQuay.ts — 뭍을 넓히는 쪽으로만 메운다).
// 읍(성벽 · 청한 광장)은 중심부가 돌바닥이고(beodeulTownCore.ts) 풀은 화단으로만 남으며, 광장은 길 포석 테를 두른 네모다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { planCommons, straightEarthRuns } from "@/editor/tools/beodeulCommons";
import { readSettlementAreas, settlementGround, settlementRank, standableYard } from "@/editor/tools/beodeulSettlementRank";
import { planTownCore, squareApproaches, squareBox, squareRing, SQUARE_FLOORS } from "@/editor/tools/beodeulTownCore";
import { townWallLayout } from "@/editor/tools/beodeulTownWall";
import { planQuay } from "@/editor/tools/beodeulQuay";
import { emptyWindows, planLandPlots } from "@/editor/tools/beodeulLandUse";
import type { ToolContext } from "@/editor/tools/types";
import type { GameMap, Project } from "@/project/types";

const TS = "beodeul_city";

function town(args: Record<string, unknown>): { project: Project; map: GameMap; data: Record<string, unknown> } {
  const project = createBlankProject() as Project;
  const ctx = { project, currentMapId: project.startMapId } as ToolContext;
  const res = runTool(ctx, "author_beodeul_town", { theme: "river", seed: 7, ...args });
  expect(res.ok, res.summary).toBe(true);
  const data = res.data as Record<string, unknown>;
  return { project: ctx.project, map: ctx.project.maps[data.mapId as string]!, data };
}
const tagCount = (project: Project, map: GameMap, tag: string): number => {
  const meta = project.tilesets[TS]!.tileMeta ?? [];
  let n = 0;
  for (const t of map.lowerTiles) if (((meta[t]?.tags ?? []) as readonly string[]).includes(tag)) n += 1;
  return n;
};

describe("정착지의 급 — 사실에서만 정한다", () => {
  const base = { walls: false, plaza: false, scatter: false, houseLimit: Infinity, waterfront: false, grass: true };
  it("성벽이나 청한 광장이 있으면 읍, 흩어진 농가·집 셋 이하는 작은 마을, 그 밖은 마을", () => {
    expect(settlementRank({ ...base, walls: true })).toBe("town");
    expect(settlementRank({ ...base, plaza: true })).toBe("town");
    expect(settlementRank({ ...base, scatter: true })).toBe("hamlet");
    expect(settlementRank({ ...base, houseLimit: 3 })).toBe("hamlet");
    expect(settlementRank({ ...base, houseLimit: 4 })).toBe("village");
    expect(settlementRank(base)).toBe("village");
  });
  it("풀밭 마을만 바닥이 급을 따른다 — 사막·설원·늪은 제 바닥 표본 그대로", () => {
    expect(settlementGround(base)).toMatchObject({ rank: "village", earthRoads: true, commons: true, pavedCore: false });
    expect(settlementGround({ ...base, plaza: true })).toMatchObject({ rank: "town", earthRoads: false, commons: false, pavedCore: true });
    expect(settlementGround({ ...base, grass: false })).toMatchObject({ earthRoads: false, commons: false, pavedCore: false, quay: false });
    expect(settlementGround({ ...base, waterfront: true }).quay).toBe(true);
  });
});

describe("흙 몸(planCommons) — 길 뼈대 둘레에 모양으로 자란다", () => {
  // 평지 30×24, 가운데 가로 길 한 줄(y 12, x 0~29)과 문 앞 하나
  const W = 30, H = 24;
  const cells = Array.from({ length: W }, (_, x) => 12 * W + x);
  const road = new Set(cells);
  const plan = (extra: Partial<Parameters<typeof planCommons>[0]> = {}) => planCommons({
    W, H, seed: 5, g: { x: 15, y: 14 }, free: (c) => !road.has(c), road: (c) => road.has(c), prop: () => false, level: () => 0,
    doors: [{ x: 8, y: 9 }], houses: 4, ...extra,
  });
  it("같은 입력이면 같은 흙이고, 길 칸은 흙으로 바꿀 칸에 들지 않는다", () => {
    const a = plan(), b = plan();
    expect(a.earth).toEqual(b.earth);
    expect(a.earth.some((c) => road.has(c))).toBe(false);
    expect(a.earth.length).toBeGreaterThan(60);
    expect(a.yard).toBeGreaterThan(20);
  });
  it("길 줄을 주면 곧은 구간이 굽이친다 — 흙이 떠난 길 칸을 돌려주되 흙 몸은 끊기지 않는다", () => {
    const p = plan({ paths: [{ cells, width: 1 }], freeRoad: () => true });
    expect(p.bare.length).toBeGreaterThan(0);
    const earth = new Set([...p.earth, ...cells.filter((c) => !p.bare.includes(c))]);
    // 길의 두 끝(맵 가장자리)은 흙으로 남고 서로 이어져 있다
    expect(earth.has(cells[0]!) && earth.has(cells[W - 1]!)).toBe(true);
    const seen = new Set([cells[0]!]); const q = [cells[0]!];
    for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W;
      for (const n of [c - 1, c + 1, c - W, c + W]) if (n >= 0 && n < W * H && Math.abs((n % W) - x) <= 1 && earth.has(n) && !seen.has(n)) { seen.add(n); q.push(n); } }
    expect(seen.has(cells[W - 1]!)).toBe(true);
    // 자로 그은 한 칸 줄이 아니다
    expect(straightEarthRuns(W, H, (c) => earth.has(c)).cells).toBeLessThan(straightEarthRuns(W, H, (c) => road.has(c)).cells);
  });
  it("맵 가장자리 두 줄에는 흙을 새로 내지 않는다 — 가장자리에 닿는 것은 뼈대 길뿐이다(출구 없는 길 끝·넓어진 출구가 생기지 않는다)", () => {
    const rim = (c: number) => { const x = c % W, y = (c - x) / W; return x <= 1 || y <= 1 || x >= W - 2 || y >= H - 2; };
    for (const p of [plan(), plan({ paths: [{ cells, width: 1 }], freeRoad: () => true })]) {
      expect(p.earth.length).toBeGreaterThan(60);
      expect(p.earth.filter(rim)).toEqual([]);
      // 길의 두 끝은 흙으로 남는다
      expect(p.bare.includes(cells[0]!) || p.bare.includes(cells[W - 1]!)).toBe(false);
    }
  });
});

describe("사람이 서도 되는 흙 마당(standableYard)", () => {
  // 13×7: 흙 5×5(x 1~5, y 1~5)와 떨어진 포석 4×5(x 8~11, y 1~5) — 둘 다 길로 센다
  const W = 13, H = 7;
  const lowerTiles = new Array<number>(W * H).fill(0);
  for (let y = 1; y <= 5; y += 1) { for (let x = 1; x <= 5; x += 1) lowerTiles[y * W + x] = 1; for (let x = 8; x <= 11; x += 1) lowerTiles[y * W + x] = 2; }
  const map = { width: W, height: H, lowerTiles } as unknown as GameMap;
  const tileset = { tileMeta: [{ tags: ["grass"] }, { tags: ["sand"] }, { tags: ["road"] }] } as unknown as Project["tilesets"][string];
  const roads = new Set<number>(); lowerTiles.forEach((t, c) => { if (t) roads.add(c); });
  it("둘레 여덟 칸이 모두 길인 흙 칸만 — 흙의 가장자리 줄과 포석 거리는 들지 않는다", () => {
    const yard = [...standableYard(map, tileset, roads)].sort((a, b) => a - b);
    expect(yard).toEqual([2, 3, 4].flatMap((y) => [2, 3, 4].map((x) => y * W + x)));
  });
  it("길로 세지 않는 흙(사막의 모래 바닥)은 마당이 아니다", () => {
    expect(standableYard(map, tileset, new Set([...roads].filter((c) => c !== 3 * W + 3))).size).toBe(0);
    expect(standableYard(map, tileset, new Set()).size).toBe(0);
  });
});

describe("시골 마을의 바닥 — 돌 포장 없이 흙", () => {
  it("광장을 청하지 않은 강가 마을: 포석·판석 칸이 없고, 문 앞은 모두 흙이며, 흙 마당이 선다", () => {
    const { project, map, data } = town({});
    expect(data.rank).toBe("village");
    expect(tagCount(project, map, "road")).toBe(0);
    // 판석 꼬리표 칸은 집 킷이 제 문턱에 구워 둔 몇 칸뿐이다(시공기가 깐 광장·어귀 판석은 없다)
    expect(tagCount(project, map, "plaza")).toBeLessThan(8);
    const areas = readSettlementAreas(map, project.tilesets[TS]);
    expect(areas.earth.length).toBeGreaterThan(map.width * map.height * 0.12);
    expect(areas.yard.length).toBeGreaterThan(30);
    expect(areas.earthEdge.length).toBeGreaterThan(40);
    expect(areas.street.length).toBe(0);
    expect(areas.court.length).toBeLessThan(8);
    const earth = new Set(areas.earth);
    const doors = data.doors as { x: number; y: number; reached: boolean }[];
    expect(doors.length).toBeGreaterThan(3);
    for (const d of doors) expect(earth.has(d.y * map.width + d.x), `문 앞 (${d.x},${d.y})`).toBe(true);
    // 문 도달은 기준선과 같다(이 씨앗은 모두 닿는다)
    expect(doors.filter((d) => !d.reached).length).toBe(0);
  }, 240_000);

  it("광장을 청한 마을은 읍이다 — 흙 몸을 깔지 않고 포석 길과 판석 광장이 선다", () => {
    const { project, map, data } = town({ form: "plaza" });
    expect(data.rank).toBe("town");
    expect(tagCount(project, map, "road")).toBeGreaterThan(40);
    expect(tagCount(project, map, "plaza")).toBeGreaterThan(20);
  }, 240_000);

  it("사막 마을은 그대로다(제 바닥 표본) — 급은 적히지만 흙 몸을 깔지 않는다", () => {
    const { project, map } = town({ theme: "desert", seed: 17 });
    expect(readSettlementAreas(map, project.tilesets[TS]).earth.length).toBe(0);
  }, 240_000);
});

describe("조수가 고른 밭 자리 — 흙 몸이 차지하지 않는다", () => {
  it("흩어진 농가에 밭 자리를 주면 그 자리에 밭이 선다(2026-11-15 명세 은행 lay-main-farm: 흙 몸이 먼저 앉아 밭 1 → 0)", () => {
    const { data } = town({ seed: 44061, form: "scatter", water: "none", houseCount: 3, terrainSeed: 88097,
      layout: { gather: { x: 25, y: 24, plaza: false }, landmark: { x: 10, y: 5 }, anchor: { x: 26, y: 16 }, work: { x: 39, y: 17 },
        houses: [{ x: 8, y: 17, kind: "small" }, { x: 10, y: 30, kind: "medium" }, { x: 39, y: 30, kind: "large" }],
        fields: [{ x: 18, y: 18 }, { x: 20, y: 32 }], pastures: [{ x: 37, y: 24 }], props: [{ x: 25, y: 28 }], exits: ["south"] } });
    expect(data.rank).toBe("hamlet");
    expect(data.fields as number).toBeGreaterThanOrEqual(1);
    expect((data.doors as { reached: boolean }[]).filter((d) => !d.reached).length).toBe(0);
  }, 240_000);
});

describe("읍의 광장 — 테를 두른 네모", () => {
  const W = 30, H = 20;
  const road = new Set(Array.from({ length: W }, (_, x) => 10 * W + x));
  it("바깥 한 줄이 테, 안이 광장 돌 · 변 가운데에서 길까지 곧은 들목 · 안 돌 목록에 강자갈이 없다", () => {
    const cells: number[] = []; for (let y = 4; y <= 8; y += 1) for (let x = 5; x <= 11; x += 1) cells.push(y * W + x);
    const box = squareBox(W, cells)!;
    expect(box).toEqual({ x0: 5, y0: 4, x1: 11, y1: 8 });
    const { ring, inner } = squareRing(W, H, cells);
    expect(ring.length).toBe(20);
    expect(inner.length).toBe(15);
    const approach = squareApproaches(W, H, box, (c) => !road.has(c), (c) => road.has(c));
    expect(approach.map((c) => `${c % W},${Math.floor(c / W)}`).sort()).toEqual(["7,9", "8,9", "9,9"]);
    expect(SQUARE_FLOORS.length).toBeGreaterThanOrEqual(2);
    expect(SQUARE_FLOORS.some((f) => /cobble|자갈/.test(`${f.id}${f.label}${f.kit ?? ""}`))).toBe(false);
  });

  it("광장을 청한 마을: 네 모서리는 길 포석 테, 안은 모두 광장 돌, 우물 하나, 문은 모두 닿는다", () => {
    const { project, map, data } = town({ form: "plaza" });
    const meta = project.tilesets[TS]!.tileMeta ?? [];
    const tags = (c: number) => (meta[map.lowerTiles[c]!]?.tags ?? []) as readonly string[];
    const sq = data.square as { x0: number; y0: number; x1: number; y1: number; floor: string };
    expect(SQUARE_FLOORS.map((f) => f.id)).toContain(sq.floor);
    expect(sq.x1 - sq.x0).toBeGreaterThanOrEqual(6);
    expect(sq.y1 - sq.y0).toBeGreaterThanOrEqual(6);
    for (const [x, y] of [[sq.x0, sq.y0], [sq.x1, sq.y0], [sq.x0, sq.y1], [sq.x1, sq.y1]] as const) expect(tags(y * map.width + x), `테 모서리 (${x},${y})`).toContain("road");
    for (let y = sq.y0 + 1; y < sq.y1; y += 1) for (let x = sq.x0 + 1; x < sq.x1; x += 1) expect(tags(y * map.width + x), `광장 안 (${x},${y})`).toContain("plaza");
    expect((data.doors as { reached: boolean }[]).filter((d) => !d.reached).length).toBe(0);
    expect((map.structurePlacements ?? []).filter((p) => /well/.test(p.kitId)).length).toBe(1);
  }, 240_000);
});
describe("읍의 포장 중심부(planTownCore)", () => {
  const W = 30, H = 20;
  const road = new Set(Array.from({ length: W }, (_, x) => 10 * W + x));
  const building = new Set<number>(); for (let y = 3; y < 7; y += 1) for (let x = 4; x < 10; x += 1) building.add(y * W + x);
  const plan = planTownCore({ W, H, seed: 5, inside: (c) => { const x = c % W, y = Math.floor(c / W); return x > 0 && y > 0 && x < W - 1 && y < H - 1; },
    open: (c) => !road.has(c) && !building.has(c), road: (c) => road.has(c), building: (c) => building.has(c), doors: [{ x: 6, y: 7 }] });
  it("안뜰은 중심부의 빈 칸을 덮고, 화단은 둘레 한 칸이 모두 안뜰인 네모이며 풀 몫은 다섯에 하나를 넘지 않는다", () => {
    const court = new Set(plan.court);
    expect(plan.court.some((c) => road.has(c) || building.has(c))).toBe(false);
    expect(plan.beds.length).toBeGreaterThan(2);
    let green = 0;
    for (const b of plan.beds) {
      green += b.w * b.h;
      for (let j = -1; j <= b.h; j += 1) for (let i = -1; i <= b.w; i += 1) {
        const c = (b.y + j) * W + b.x + i, inBed = i >= 0 && j >= 0 && i < b.w && j < b.h;
        expect(court.has(c), `화단 (${b.x},${b.y}) 의 (${i},${j})`).toBe(!inBed);
      }
    }
    expect(green / (plan.court.length + green)).toBeLessThan(0.2);
    // 문 앞 길목(문 앞 칸에서 길까지)에는 화단·화분이 없다
    for (let dy = 0; dy <= 2; dy += 1) expect(court.has((7 + dy) * W + 6)).toBe(true);
    expect(plan.planters.some((p) => p.x >= 5 && p.x <= 7 && p.y >= 7 && p.y <= 10)).toBe(false);
  });

  it("성벽 읍: 성벽 안 풀 몫이 넷에 하나 아래, 밭이 없고, 안뜰 판석이 길보다 넓다 · 문은 모두 닿는다", () => {
    const { project, map, data } = town({ walls: true, form: "plaza", seed: 17 });
    expect(data.rank).toBe("town");
    expect(data.fields).toBe(0);
    const meta = project.tilesets[TS]!.tileMeta ?? [];
    const tags = (c: number) => (meta[map.lowerTiles[c]!]?.tags ?? []) as readonly string[];
    const L = townWallLayout(map.width, map.height, 17);
    let inside = 0, green = 0;
    for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) if (!L.inBand(x, y)) { inside += 1; if (tags(y * map.width + x).includes("grass")) green += 1; }
    expect(green / inside).toBeLessThan(0.25);
    const areas = readSettlementAreas(map, project.tilesets[TS]);
    expect(areas.court.length).toBeGreaterThan(800);
    expect(areas.street.length).toBeGreaterThan(200);
    expect(areas.court.length).toBeGreaterThan(areas.street.length);
    expect(areas.earth.length).toBe(0);
    expect((data.doors as { reached: boolean }[]).filter((d) => !d.reached).length).toBe(0);
    expect((map.structurePlacements ?? []).filter((p) => /well/.test(p.kitId)).length).toBe(1);
  }, 240_000);
});

describe("포구의 돌 둑(planQuay)", () => {
  // 물가: y 0~5 뭍, 6~ 바다. 열 8·9 는 물가가 한 줄 들어가 있고(y 5 가 바다) 열 14 는 한 줄 나와 있다(y 6 이 뭍)
  const W = 24, H = 12;
  const sea = (c: number) => { const x = c % W, y = Math.floor(c / W); return y >= 6 ? !(x === 14 && y === 6) : (y === 5 && (x === 8 || x === 9)); };
  it("들어간 물가는 메워 앞줄을 곧게 펴고, 바다로 나온 뭍 앞에서 끝난다 — 물을 새로 파지 않는다", () => {
    const plan = planQuay({ W, H, near: { x: 12, y: 3 }, sea, land: (c) => !sea(c), level: () => 0 })!;
    expect(plan.front).toEqual({ x0: 2, x1: 13, y: 5 });
    expect(plan.fill.map((c) => `${c % W},${Math.floor(c / W)}`).sort()).toEqual(["8,5", "9,5"]);
    // 메우는 칸은 모두 바다였고, 포장하는 칸은 모두 뭍이었다
    expect(plan.fill.every((c) => sea(c))).toBe(true);
    expect(plan.cells.every((c) => !sea(c))).toBe(true);
    // 앞줄 바로 아래는 모두 바다다(곧은 둑)
    for (let x = plan.front.x0; x <= plan.front.x1; x += 1) expect(sea((plan.front.y + 1) * W + x), `둑 앞 (${x})`).toBe(true);
    expect(plan.links.length).toBeGreaterThan(0);
  });
  it("바다가 없으면 둑도 없다", () => {
    expect(planQuay({ W, H, near: { x: 12, y: 3 }, sea: () => false, land: () => true, level: () => 0 })).toBeNull();
  });

  it("포구 마을: 물에 닿는 판석 둑이 서고, 잔교가 둑에서 뻗고, 문은 모두 닿는다", () => {
    const { project, map, data } = town({ theme: "coast", seed: 23, houseCount: 4 });
    const quay = data.quay as { x0: number; y0: number; x1: number; y1: number; cells: number };
    expect(quay.x1 - quay.x0 + 1).toBeGreaterThanOrEqual(7);
    expect(quay.cells).toBeGreaterThanOrEqual(14);
    const areas = readSettlementAreas(map, project.tilesets[TS]);
    expect(areas.quay.length).toBeGreaterThanOrEqual(5);
    // 잔교(널 부두)의 뭍 끝이 둑 네모 안이다
    const pier = /잔교\((\d+),(\d+)\)/.exec((data.coastWork as string[]).join(" "))!;
    expect(Number(pier[1])).toBeGreaterThanOrEqual(quay.x0);
    expect(Number(pier[1])).toBeLessThanOrEqual(quay.x1);
    expect(Number(pier[2])).toBeLessThanOrEqual(quay.y1);
    expect((data.doors as { reached: boolean }[]).filter((d) => !d.reached).length).toBe(0);
  }, 240_000);
});

describe("빈 땅의 쓰임(planLandPlots) — 볼 것 없는 화면에 울타리 두른 밭", () => {
  // 40×30 맵, 왼쪽 위에 건물 하나(2~7, 2~5)뿐
  const W = 40, H = 30;
  const used = new Set<number>(); for (let y = 2; y < 6; y += 1) for (let x = 2; x < 8; x += 1) used.add(y * W + x);
  const inp = { W, H, seed: 3, used: (c: number) => used.has(c), free: (c: number) => !used.has(c) };
  it("건물이 걸리지 않는 창이 빈 창이고, 첫 밭 자리는 빈 창을 가장 많이 채운다", () => {
    const empty = emptyWindows(inp);
    expect(empty.length).toBe(16);
    expect(empty.some((e) => e.x === 0 && e.y === 0)).toBe(false); // 건물이 든 창
    const plots = planLandPlots(inp);
    expect(plots.length).toBeGreaterThan(0);
    expect(plots[0]!.windows).toBe(16);
    for (let i = 1; i < plots.length; i += 1) expect(plots[i]!.windows).toBeLessThanOrEqual(plots[i - 1]!.windows);
    // 밭(울타리 포함)을 깔면 빈 창이 없어진다
    const p = plots[0]!; const after = new Set(used);
    for (let j = -1; j <= p.h; j += 1) for (let i = -1; i <= p.w; i += 1) after.add((p.y + j) * W + p.x + i);
    expect(emptyWindows({ ...inp, used: (c) => after.has(c) }).length).toBe(0);
  });
  it("빈 창이 없거나 빈 땅이 없으면 자리도 없다", () => {
    expect(planLandPlots({ ...inp, used: () => true })).toEqual([]);
    expect(planLandPlots({ ...inp, free: () => false })).toEqual([]);
  });

  // 2026-11-15(감독, PR #4723): 숲이 서는 마을은 마을 몸 바깥 띠를 숲이 맡고 밭은 집 곁에만 선다 — 이 시험의 뜻은 «빈 화면에 밭 셋 이상» 이 아니라
  // «볼 것 없는 화면(20×15 창)이 남지 않는다» 다. 밭이든 숲 덩이든 창을 채우면 된다(data.emptyScreens — 건물·기물·밭·울타리·숲 덩이가 하나도 안 걸리는 창 수).
  // 이 판은 강가 자투리 땅에 걸친 창 하나가 남는다(숲 덩이가 설 폭이 없다) — 전에는 0, 밭 셋이 채웠다.
  it("넓은 시골 마을: 볼 것 없는 화면을 밭이나 숲 덩이가 채우고, 울타리 문은 모두 길에서 닿는다 · 읍에는 빈 화면의 밭이 서지 않는다", () => {
    const { data } = town({ seed: 8, width: 64, height: 56, houseCount: 4 });
    expect(data.rank).toBe("village");
    expect(data.emptyScreens as number).toBeLessThanOrEqual(1);
    expect((data.nature as { forestCells: number }).forestCells).toBeGreaterThan(200);
    const gates = data.fenceGates as { reached: boolean }[];
    expect(gates.length).toBeGreaterThanOrEqual((data.landPlots as number | undefined) ?? 0);
    expect(gates.filter((g) => !g.reached).length).toBe(0);
    expect((data.doors as { reached: boolean }[]).filter((d) => !d.reached).length).toBe(0);
    expect(town({ walls: true, form: "plaza", seed: 17 }).data.landPlots).toBeUndefined();
  }, 480_000);
});

describe("자갈 재질은 어느 급에도 쓰지 않는다(오너 «강자갈 마당은 너무 어색하군» · «광장이 이렇게 깔끔해야 맞지»)", () => {
  type Surface = { road?: string; roadEdge?: string; plaza?: string; track?: string | null; en: string };
  const spec = JSON.parse(readFileSync("tiledata/beodeul-looks/spec.json", "utf8")) as { surfaces: Record<string, Surface> };
  it("굽는 명세: 어느 겉모습도 광장에 강자갈을, 거리에 맨흙·자갈을, 흙길(정착지의 흙 몸)에 자갈을 쓰지 않는다", () => {
    expect(Object.keys(spec.surfaces).length).toBeGreaterThanOrEqual(6);
    for (const [id, surface] of Object.entries(spec.surfaces)) {
      expect([undefined, null, "road-dirt"], id).toContain(surface.track);
      expect(surface.plaza, id).not.toBe("plaza-cobble");
      expect(["road-dirt", "road-gravel"], id).not.toContain(surface.road);
      // 읍의 광장 테는 길 재질로 깐다 — 길이 포장이어야 광장과 거리가 한 몸이다(턱 있는 포석)
      expect(surface.roadEdge, id).toBe("kerb");
      expect(surface.en, id).not.toMatch(/cobble|gravel|dirt road/);
    }
  });
  it("맨흙·마른 풀 겉모습의 포구 읍: 광장 테와 안이 모두 깔리고(테는 길 포석 · 안은 광장 돌), 둑은 광장 판석 그대로다", () => {
    const PLAZA_TILE = 1509; // «버들항 광장 판석» 몸통 — 겉모습이 이 칸의 그림을 그 게임의 광장 재질로 바꾼다
    for (const look of ["steppe", "frontier"]) {
      const project = createBlankProject() as Project;
      (project.tilesets[TS] as unknown as { look: unknown }).look = { textureKey: "tex_beodeul_looks", surface: look };
      const ctx = { project, currentMapId: project.startMapId } as ToolContext;
      const res = runTool(ctx, "author_beodeul_town", { theme: "coast", seed: 23, houseCount: 4, form: "plaza" });
      expect(res.ok, res.summary).toBe(true);
      const data = res.data as { mapId: string; rank: string; square: { x0: number; y0: number; x1: number; y1: number }; quay?: { x0: number; y0: number; x1: number; y1: number }; doors: { reached: boolean }[] };
      const map = ctx.project.maps[data.mapId]!;
      expect(data.rank, look).toBe("town");
      expect(data.doors.filter((d) => !d.reached).length, look).toBe(0);
      const meta = ctx.project.tilesets[TS]!.tileMeta ?? [];
      const tags = (x: number, y: number) => (meta[map.lowerTiles[y * map.width + x]!]?.tags ?? []) as readonly string[];
      const sq = data.square;
      for (const [x, y] of [[sq.x0, sq.y0], [sq.x1, sq.y0], [sq.x0, sq.y1], [sq.x1, sq.y1]] as const) expect(tags(x, y), `${look} 테 (${x},${y})`).toContain("road");
      for (let y = sq.y0 + 1; y < sq.y1; y += 1) for (let x = sq.x0 + 1; x < sq.x1; x += 1) expect(tags(x, y), `${look} 안 (${x},${y})`).toContain("plaza");
      if (data.quay) {
        let plazaTiles = 0;
        for (let y = data.quay.y0; y <= data.quay.y1; y += 1) for (let x = data.quay.x0; x <= data.quay.x1; x += 1) if (map.lowerTiles[y * map.width + x] === PLAZA_TILE) plazaTiles += 1;
        expect(plazaTiles, look).toBeGreaterThan(15);
      }
    }
  }, 480_000);
});
