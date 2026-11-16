// 깎아지른 지형 구성기(sheerTerrainPlan.ts) + 시공(sheerTerrainBuild.ts, 도구 build_sheer_terrain) — 갈래 셋 × 씨앗 셋.
// 단 수 3~5 · 장치는 닫힌 목록에서만 · 들어오는 칸에서 출구 · 볼거리 앞 · 막다른 턱에 닿는다 · 볼거리와 상자는 가려진 칸(높은 단 앞면 뒤)에 두지 않는다 ·
// 빈 곳이 있는 갈래는 맵 배경 견본이 걸리고 빈 곳 1층은 비어 있다(배경이 비친다).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { planSheerTerrain, SHEER_DEVICES, SHEER_KINDS } from "@/editor/tools/sheerTerrainPlan";
import type { SheerBuildReport } from "@/editor/tools/sheerTerrainBuild";
import { createBlankProject } from "@/project/defaults";
import { layerTileAt } from "@/project/mapLayers";
import { placeholderSheerArt, setSheerArt } from "@/project/relief/sheerArt";
import type { Project } from "@/project/types";

beforeAll(() => setSheerArt(placeholderSheerArt()));
afterAll(() => setSheerArt(null));

const SEEDS = [1, 2, 3] as const;
const DEVICE_IDS = new Set(Object.keys(SHEER_DEVICES));

function build(kindId: string, seed: number) {
  const kind = SHEER_KINDS.find((k) => k.id === kindId)!;
  const [W, H] = kind.size.medium;
  const ctx = { project: createBlankProject() as Project, lookKey: `sheer-test-${kindId}` };
  const made = runTool(ctx, "create_map", { name: `${kindId} ${seed}`, width: W, height: H, tilesetId: "beodeul_city" });
  expect(made.ok, made.summary).toBe(true);
  const mapId = (made.data as { mapId: string }).mapId;
  const res = runTool(ctx, "build_sheer_terrain", { mapId, kind: kindId, seed });
  expect(res.ok, res.summary).toBe(true);
  return { kind, W, H, plan: planSheerTerrain(kind, W, H, seed), report: res.data as SheerBuildReport, map: ctx.project.maps[mapId]! };
}

describe("sheer terrain generator", () => {
  it("the kinds table names only devices from the closed list", () => {
    expect(SHEER_KINDS.map((k) => k.id).sort()).toEqual(["sky-plateau", "summit", "waterfall-terraces"]);
    for (const k of SHEER_KINDS) for (const d of [...k.step1, ...k.step2, ...k.gap, k.ledge]) expect(DEVICE_IDS.has(d), `${k.id}: ${d}`).toBe(true);
  });

  for (const k of SHEER_KINDS) {
    it.each(SEEDS)(`${k.id} seed %i: 3–5 levels, closed-list devices, every goal reachable, nothing on hidden ground`, (seed) => {
      const { W, plan, report, map } = build(k.id, seed);
      expect(report.levels).toBeGreaterThanOrEqual(3);
      expect(report.levels).toBeLessThanOrEqual(5);
      expect(plan.levelCount).toBe(report.levels);
      expect(report.faceCells).toBe(3);
      expect(map.relief?.style).toBe("sheer");
      // one device per level boundary at least (levels − 1), every one from the closed list
      expect(report.devices.length).toBeGreaterThanOrEqual(report.levels - 1);
      for (const d of report.devices) expect(DEVICE_IDS.has(d.kind), d.kind).toBe(true);
      // reachability from the entry cell (flood with the engine's own canMove)
      expect(report.reach.missing, JSON.stringify(report.reach)).toEqual([]);
      expect(report.reach.ok).toBe(true);
      expect(report.landmark?.placed).toBe(true);
      expect(report.deadEnd).toBeDefined();
      // landmark and chest are not behind a higher face (hidden ground)
      const lm = plan.landmark!;
      for (let j = 0; j < lm.h; j++) for (let i = 0; i < lm.w; i++) expect(plan.hidden[(lm.y + j) * W + lm.x + i], `landmark (${lm.x + i},${lm.y + j})`).toBe(0);
      expect(plan.hidden[plan.deadEnd!.y * W + plan.deadEnd!.x]).toBe(0);
      // the kind's water: streams fall
      if (k.water === "stream") expect(report.falls).toBeGreaterThan(0);
    });
  }

  it("void kinds hang the preset map background and leave the void's lower tiles empty so it shows through", () => {
    for (const k of SHEER_KINDS) {
      const { map, report, W, H } = build(k.id, 1);
      if (!k.void) { expect(map.background).toBeUndefined(); expect(report.background).toBeUndefined(); continue; }
      expect(report.background?.preset).toBe(k.backdrop!.preset);
      expect(map.background?.showInEmptyCells).toBe(true);
      let voidCells = 0;
      for (let c = 0; c < W * H; c++) if ((map.relief!.levels[c] ?? 0) === 0 && (map.relief!.ramps?.[c] ?? 0) !== 9) { voidCells++; expect(layerTileAt(map, 1, c), `cell ${c}`).toBe(-1); }
      expect(voidCells).toBeGreaterThan(0);
    }
  });

  it("the same kind, size and seed give the same plan", () => {
    const k = SHEER_KINDS[0]!, [W, H] = k.size.medium;
    const a = planSheerTerrain(k, W, H, 7), b = planSheerTerrain(k, W, H, 7);
    expect(Array.from(a.levels)).toEqual(Array.from(b.levels));
    expect(Array.from(a.ramps)).toEqual(Array.from(b.ramps));
  });
});
