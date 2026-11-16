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
import type { Project, TilesetDef } from "@/project/types";

beforeAll(() => setSheerArt(placeholderSheerArt()));
afterAll(() => setSheerArt(null));

const SEEDS = [1, 2, 3] as const;
const DEVICE_IDS = new Set(Object.keys(SHEER_DEVICES));

let lastTileset: TilesetDef | undefined;
function build(kindId: string, seed: number) {
  const kind = SHEER_KINDS.find((k) => k.id === kindId)!;
  const [W, H] = kind.size.medium;
  const ctx = { project: createBlankProject() as Project, lookKey: `sheer-test-${kindId}` };
  const made = runTool(ctx, "create_map", { name: `${kindId} ${seed}`, width: W, height: H, tilesetId: "beodeul_city" });
  expect(made.ok, made.summary).toBe(true);
  const mapId = (made.data as { mapId: string }).mapId;
  const res = runTool(ctx, "build_sheer_terrain", { mapId, kind: kindId, seed });
  expect(res.ok, res.summary).toBe(true);
  lastTileset = ctx.project.tilesets.beodeul_city;
  return { kind, W, H, plan: planSheerTerrain(kind, W, H, seed), report: res.data as SheerBuildReport, map: ctx.project.maps[mapId]! };
}

describe("sheer terrain generator", () => {
  it("the kinds table names only devices from the closed list", () => {
    expect(SHEER_KINDS.map((k) => k.id).sort()).toEqual(["sky-plateau", "spirit-forest", "summit", "waterfall-terraces"]);
    for (const k of SHEER_KINDS) for (const d of [...k.step1, ...k.step2, ...k.gap, k.ledge]) expect(DEVICE_IDS.has(d), `${k.id}: ${d}`).toBe(true);
  });

  for (const k of SHEER_KINDS.filter((kind) => kind.layout !== "glade")) {
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

  it.each(SEEDS)("spirit-forest seed %i: a one-level glade ringed by forest, an elder tree and big broadleaf trees, a dirt path, flowers and mushrooms, every goal reachable", (seed) => {
    const { W, H, report, map } = build("spirit-forest", seed);
    expect(report.levels).toBe(1);
    expect(report.reach.missing, JSON.stringify(report.reach)).toEqual([]);
    expect(report.landmark).toMatchObject({ kit: "bd-sp-tree-elder", placed: true });
    expect(report.deadEnd?.chest).toBe(true);
    // the forest wall rings the clearing: every map edge is mostly forest canopy
    expect(report.forestCells).toBeGreaterThan(W * H * 0.25);
    const kitCells = (ids: readonly string[], layer: "upperTiles" | "lowerOverlayTiles") => {
      const own = new Set<number>();
      for (const k of lastTileset!.structureKits ?? []) if (ids.includes(k.id)) for (const r of k.rows) for (const t of (r[layer] ?? []) as number[]) if (t >= 0) own.add(t);
      return (map[layer] ?? []).filter((t) => own.has(t)).length;
    };
    // big trees: the elder (landmark) plus big broadleaf trees — at least one broadleaf, two where the clearing has room (target scene 4 has the elder and one)
    expect(report.bigTrees, "big broadleaf trees").toBeGreaterThanOrEqual(1);
    expect(1 + report.bigTrees, "elder + broadleaf").toBeGreaterThanOrEqual(2);
    expect(kitCells(["bd-sp-mushroom-tall", "bd-sp-mushroom-small"], "upperTiles")).toBeGreaterThan(0);
    expect(kitCells(["bd-sp-flower-violet", "bd-sp-flower-star", "bd-sp-flower-gold"], "lowerOverlayTiles")).toBeGreaterThan(0);
    expect(map.background).toBeUndefined();
  });

  it("spirit-forest: seeds differ (forest wall and elder spot), and only a sheer build grafts the spirit pack", () => {
    const a = build("spirit-forest", 1), b = build("spirit-forest", 2);
    expect(a.plan.landmark).not.toEqual(b.plan.landmark);
    expect(Array.from(a.plan.forest)).not.toEqual(Array.from(b.plan.forest));
    const fresh = createBlankProject() as Project;
    expect(fresh.tilesets.beodeul_city!.structureKits!.some((k) => k.id.startsWith("bd-sp-"))).toBe(false);
    expect(lastTileset!.structureKits!.filter((k) => k.id.startsWith("bd-sp-")).length).toBe(12);
  });

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

  it("shapes read as wide tiers: south edges step by 0 or a whole face, walk tops are at least three cells deep, no forest on the last row", () => {
    for (const k of SHEER_KINDS) for (const seed of SEEDS) {
      const [W, H] = k.size.medium, plan = planSheerTerrain(k, W, H, seed), lv = plan.levels;
      // south edge of each level run: where the cell south of (x,y) is lower. Between two neighbouring columns of the same level,
      // the edge row moves by 0 or by at least FACE (3) — a 1–2 cell jog was drawn as slanted strata (2026-11-16 lead review)
      const edge = (x: number, L: number) => { const out: number[] = []; for (let y = 0; y < H - 1; y++) if (lv[y * W + x] === L && lv[(y + 1) * W + x]! < L) out.push(y); return out; };
      let jogs = 0;
      for (let x = 0; x + 1 < W; x++) for (let L = 1; L <= 5; L++) {
        const a = edge(x, L), b = edge(x + 1, L);
        if (a.length !== 1 || b.length !== 1) continue;
        const d = Math.abs(a[0]! - b[0]!); if (d > 0 && d < 3) jogs++;
      }
      // (a few stay where the dead-end ledge meets its bank row and where a stream cuts a tier; before the review a map had 16–35)
      expect(jogs, `${k.id} s${seed}`).toBeLessThanOrEqual(3);
      // every walk-top column above a face is at least three cells deep (no slivers)
      for (let x = 0; x < W; x++) for (let y = 1; y < H - 1; y++) {
        const c = y * W + x, L = lv[c]!; if (!L || lv[c + W]! >= L) continue;
        let d = 0; while (y - d >= 0 && lv[(y - d) * W + x] === L) d++;
        if (y - d >= 0 && lv[(y - d) * W + x]! > L) expect(d, `${k.id} s${seed} (${x},${y}) top depth`).toBeGreaterThanOrEqual(3);
      }
      for (let x = 0; x < W; x++) expect(plan.forest[(H - 1) * W + x], `${k.id} s${seed} forest on last row`).toBe(0);
    }
  });

  it("void-kind tiers are lobed: the lowest tier has two or more south bulges at least 4 cells wide, a tier's north outline curves, the summit top is small", () => {
    for (const k of SHEER_KINDS.filter((kind) => kind.void)) for (const seed of SEEDS) {
      const [W, H] = k.size.medium, lv = planSheerTerrain(k, W, H, seed).levels;
      const southRow = (x: number, L: number) => { let y = H - 1; while (y >= 0 && lv[y * W + x]! < L) y--; return y; };
      const northRow = (x: number, L: number) => { let y = 0; while (y < H && lv[y * W + x]! < L) y++; return y < H ? y : -1; };
      // a bulge = a run of 4+ columns on one south row with both neighbouring columns at least two rows further north (a tuck or the void)
      let bulges = 0;
      for (let x = 0; x < W; x++) {
        const r = southRow(x, 1); if (r < 0) continue;
        let e = x; while (e + 1 < W && southRow(e + 1, 1) === r) e++;
        const l = x > 0 ? southRow(x - 1, 1) : -1, rr = e + 1 < W ? southRow(e + 1, 1) : -1;
        if (e - x + 1 >= 4 && l < r - 1 && rr < r - 1) bulges++;
        x = e;
      }
      expect(bulges, `${k.id} s${seed} south bulges`).toBeGreaterThanOrEqual(2);
      // the north outline of level 2 bends over at least 4 columns somewhere (no rounded box joined at right angles only)
      let curve = false;
      for (let x = 0; x + 4 < W && !curve; x++) {
        const n = [0, 1, 2, 3, 4].map((j) => northRow(x + j, 2));
        if (n.every((v) => v >= 0) && n.every((v, j) => j === 0 || Math.abs(v - n[j - 1]!) <= 2) && n[0] !== n[4]) curve = true;
      }
      expect(curve, `${k.id} s${seed} north curve`).toBe(true);
      if (k.id === "summit") {
        const top = Math.max(...Array.from(lv)), xs = Array.from({ length: W }, (_, x) => x).filter((x) => northRow(x, top) >= 0);
        expect(Math.max(...xs) - Math.min(...xs) + 1, `${k.id} s${seed} top width`).toBeLessThanOrEqual(10);
      }
    }
  });

  it("the same kind, size and seed give the same plan", () => {
    const k = SHEER_KINDS[0]!, [W, H] = k.size.medium;
    const a = planSheerTerrain(k, W, H, 7), b = planSheerTerrain(k, W, H, 7);
    expect(Array.from(a.levels)).toEqual(Array.from(b.levels));
    expect(Array.from(a.ramps)).toEqual(Array.from(b.ramps));
  });
});
