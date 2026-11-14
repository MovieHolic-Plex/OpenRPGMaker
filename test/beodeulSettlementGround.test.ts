// 버들항 정착지의 급과 바닥(editor/tools/beodeulSettlementRank.ts · beodeulCommons.ts): 바닥은 정착지의 급을 따른다.
// 광장도 성벽도 청하지 않은 풀밭 마을은 돌 포장이 없고(길·마당이 한 몸으로 이어진 흙), 문 앞은 모두 흙이며, 집·문 도달은 그대로다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { planCommons, straightEarthRuns } from "@/editor/tools/beodeulCommons";
import { readSettlementAreas, settlementGround, settlementRank } from "@/editor/tools/beodeulSettlementRank";
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
