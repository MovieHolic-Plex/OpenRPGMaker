// 2026-11-05 imageplan-follow r2 p7: a wide forest plan with a pond became a fixed 32x40 strip with no water — the forest builder
// had no size or water input. The plan read now carries the plan grid and its ponds; the builder keeps the plan's aspect and digs the ponds.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import "@/editor/tools/toolRunner";
import { FOREST_ROUTE_TOOLS } from "@/editor/tools/forestRouteTool";
import { forestDesignFromCells, parseCellMap } from "@/ai/imagePlanCells";

function wideForestWithPond(): string[] {
  const rows: string[] = [];
  for (let y = 0; y < 32; y += 1) {
    const r = "t".repeat(48).split("");
    const cx = 24 + Math.round(6 * Math.sin(y / 5));
    r[cx] = "="; r[cx + 1] = "=";
    if (y >= 10 && y <= 16) for (let x = 34; x <= 42; x += 1) r[x] = "~";
    rows.push(r.join(""));
  }
  return rows;
}

function build(design: Record<string, unknown>) {
  const project = createBlankProject();
  const res = FOREST_ROUTE_TOOLS[0]!.run(project as never, { fromMapId: project.startMapId!, side: "north", count: 1, designs: [design], seed: 7 } as never);
  const id = (res.data as { maps: { mapId: string }[] }).maps[0]!.mapId;
  const map = project.maps[id]!;
  const tileset = project.tilesets[map.tilesetId]!;
  const full = tileset.autotileGroups?.find((a) => a.id === "beodeul_canal_lake_47")?.variantMap?.["255"];
  return { map, wet: map.lowerTiles.filter((t) => t === full).length };
}

describe("forest route follows an image plan", () => {
  it("keeps the plan's aspect and digs its pond", () => {
    const design = forestDesignFromCells(parseCellMap({ cells: wideForestWithPond() }, "forest", 48, 32)!);
    expect(design.plan).toEqual({ cols: 48, rows: 32, ponds: [{ x: 34, y: 10, w: 9, h: 7 }] });
    const { map, wet } = build(design);
    expect(map.width).toBeGreaterThan(map.height);
    expect(wet).toBeGreaterThan(40);
  });

  it("keeps the path across a bridged river on every side", () => {
    const rows: string[] = [];
    for (let y = 0; y < 32; y += 1) {
      const r = "t".repeat(48).split("");
      r[23] = "="; r[24] = "=";
      if (y >= 14 && y <= 17) for (let x = 0; x < 48; x += 1) if (r[x] !== "=") r[x] = "~";
      rows.push(r.join(""));
    }
    const design = forestDesignFromCells(parseCellMap({ cells: rows }, "forest", 48, 32)!);
    for (const side of ["north", "south", "east", "west"]) {
      const project = createBlankProject();
      const res = FOREST_ROUTE_TOOLS[0]!.run(project as never, { fromMapId: project.startMapId!, side, count: 2, designs: [design, design], seed: 1, hiddenPerMap: 2 } as never);
      for (const m of (res.data as { maps: { mapId: string; hidden: { x: number; y: number }[] }[] }).maps) {
        const map = project.maps[m.mapId]!;
        const lake = project.tilesets[map.tilesetId]!.autotileGroups?.find((a) => a.id === "beodeul_canal_lake_47")?.variantMap?.["255"];
        for (const h of m.hidden) expect(map.lowerTiles[h.y * map.width + h.x]).not.toBe(lake);
      }
    }
  }, 120_000);

  it("leaves a design without a plan at the usual size and dry", () => {
    const { map, wet } = build({ bends: 3 });
    expect([map.width, map.height]).toEqual([32, 40]);
    expect(wet).toBe(0);
  });
});
