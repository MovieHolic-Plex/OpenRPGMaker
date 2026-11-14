// 버들항 정착지의 급과 바닥(editor/tools/beodeulSettlementRank.ts · beodeulCommons.ts): 바닥은 정착지의 급을 따른다.
// 광장도 성벽도 청하지 않은 풀밭 마을은 돌 포장이 없고(길·마당이 한 몸으로 이어진 흙), 문 앞은 모두 흙이며, 집·문 도달은 그대로다.
// 읍(성벽 · 청한 광장)은 중심부가 돌바닥이고(beodeulTownCore.ts) 풀은 화단으로만 남으며, 광장은 길 포석 테를 두른 네모다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { planCommons, straightEarthRuns } from "@/editor/tools/beodeulCommons";
import { readSettlementAreas, settlementGround, settlementRank } from "@/editor/tools/beodeulSettlementRank";
import { planTownCore, squareApproaches, squareBox, squareRing, SQUARE_FLOORS } from "@/editor/tools/beodeulTownCore";
import { townWallLayout } from "@/editor/tools/beodeulTownWall";
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
