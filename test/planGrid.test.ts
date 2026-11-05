import { describe, expect, it } from "vitest";
import reads from "./fixtures/planGridReads.json";
import { applyPlanFix, checkPlan, compilePlan, parsePlanCode, rasterShape } from "@/ai/planGrid";
import { createBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import { bboxDungeonCatalog, layBboxDungeon } from "@/editor/dungeonKit/bboxFloor";
import { bboxVillageCatalog, checkBboxVillage } from "@/editor/tools/bboxVillage";
import { planToDungeon } from "@/editor/tools/planGridDungeon";
import { planToVillage } from "@/editor/tools/planGridVillage";
import { planToInterior } from "@/editor/tools/planGridInterior";
import type { WidenSubject } from "@/ai/vagueWidenCatalog";
import { BUILD_FROM_PLAN_TOOL, setPlanGrid } from "@/editor/tools/planGridBuild";
import { createBlankProject } from "@/project/defaults/blankProject";

type Fx = { subject: WidenSubject; cols: number; rows: number; read: Record<string, unknown> };
const fx = reads as Record<string, Fx>;
const grid = (key: string) => { const f = fx[key]!; return compilePlan(parsePlanCode(f.read, f.subject, f.cols, f.rows)!); };

describe("planGrid", () => {
  it("rasterises rect, ellipse, polygon and ring shapes on cell centres", () => {
    const sum = (m: Uint8Array) => m.reduce((a, v) => a + v, 0);
    expect(sum(rasterShape({ rect: [1, 1, 3, 2] }, 6, 6))).toBe(6);
    expect(sum(rasterShape({ ring: [{ rect: [0, 0, 5, 5] }, { rect: [1, 1, 3, 3] }] }, 6, 6))).toBe(16);
    expect(sum(rasterShape({ poly: [[0, 0], [4, 0], [0, 4]] }, 6, 6))).toBeGreaterThan(6);
    expect(rasterShape({ ellipse: [3, 3, 2, 2] }, 7, 7)[3 * 7 + 3]).toBe(1);
  });

  it("drops shapeless zones, clamps objects, and applies a zone fix by id", () => {
    const code = parsePlanCode({ zones: [{ id: "A", kind: "room", shape: { rect: [1, 1, 4, 4] } }, { id: "B", kind: "room" }], objects: [{ name: "x", x: 99, y: 1 }], entrance: { x: 2, y: 9 } }, "dungeon", 10, 10)!;
    expect(code.zones.map((z) => z.id)).toEqual(["A"]);
    expect(code.objects).toHaveLength(0);
    const fixed = applyPlanFix(code, { replace: [{ id: "A", kind: "room", shape: { rect: [2, 2, 5, 5] } }], add: [{ id: "A", kind: "hall", shape: { rect: [0, 8, 3, 2] } }] });
    expect(fixed.changed).toBe(2);
    expect(fixed.code.zones.map((z) => z.id)).toEqual(["A", "B"]);
    expect(fixed.code.zones[0]!.shape).toEqual({ rect: [2, 2, 5, 5] });
  });

  it("reaches every walkable zone from the entrance on the real vision reads", () => {
    for (const key of Object.keys(fx)) expect(checkPlan(grid(key)), key).toMatchObject({ issues: [], connectivity: 1 });
  });

  it("turns the ring-dungeon and temple plans into floors the exact dungeon layer accepts, rooms where the plan drew them", () => {
    const ts = createBeodeulCityTileset();
    for (const [key, theme] of [["p2", "catacomb"], ["p6", "temple"]] as const) {
      const g = grid(key);
      const res = planToDungeon(g, theme, bboxDungeonCatalog(ts));
      const laid = layBboxDungeon(ts, res.layout);
      expect(laid.errors, key).toEqual([]);
      const entrance = g.code.zones.find((z) => /입구/u.test(z.name))!;
      const room = res.layout.rooms!.find((r) => r.purpose === "entrance")!;
      const box = room.rects!.reduce((b, r) => ({ x0: Math.min(b.x0, r.x), y0: Math.min(b.y0, r.y) }), { x0: 999, y0: 999 });
      const planBox = rasterShape(entrance.shape, g.cols, g.rows).findIndex((v) => v === 1);
      expect(Math.abs(box.x0 - res.dx - (planBox % g.cols)), key).toBeLessThanOrEqual(3);
    }
  });

  it("turns the plateau village plan into terrain and a layout the village checker accepts", () => {
    const ts = createBeodeulCityTileset(), cat = bboxVillageCatalog(ts);
    const res = planToVillage(grid("p1"), cat);
    const rep = res.repair((L, T) => checkBboxVillage(cat, L, T));
    expect(rep.errors).toEqual([]);
    expect(rep.layout.buildings!.length).toBeGreaterThanOrEqual(3);
    expect(res.terrain.water.filter((w) => w === 3).length).toBeGreaterThan(0);
  });

  it("build_from_plan builds the plan the run request carried and refuses loudly without one", () => {
    const f = fx.p2!;
    const project = createBlankProject();
    setPlanGrid(null);
    expect(() => BUILD_FROM_PLAN_TOOL.run(project, {})).toThrow(/읽은 도면이 없다/u);
    setPlanGrid(parsePlanCode(f.read, f.subject, f.cols, f.rows));
    const r = BUILD_FROM_PLAN_TOOL.run(project, { name: "도안 던전" }) as { data: { mapId: string; kind: string } };
    setPlanGrid(null);
    expect(r.data.kind).toBe("dungeon");
    expect(project.maps[r.data.mapId]?.name).toBe("도안 던전");
  });

  it("turns the house plan into separated rooms with doors between drawn neighbours", () => {
    const res = planToInterior(grid("p8"), [{ id: "fireplace", ko: "벽난로", kind: "wall", w: 2, h: 1 }, { id: "bed blue", ko: "침대 파랑", kind: "wall", w: 1, h: 2 }]);
    const rooms = res.args.rooms;
    expect(rooms.length).toBeGreaterThanOrEqual(4);
    for (const a of rooms) for (const b of rooms) if (a !== b) expect(a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0, `${a.id}/${b.id}`).toBe(true);
    expect(res.args.connect.length).toBeGreaterThanOrEqual(rooms.length - 1);
    expect(res.args.objects.map((o) => o.id)).toEqual(expect.arrayContaining(["fireplace", "bed blue"]));
  });
});
