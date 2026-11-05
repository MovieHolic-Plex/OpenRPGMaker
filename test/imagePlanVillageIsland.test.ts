// 2026-11-05 imageplan-follow p1: a village plan drawn as a round island plateau became a rectangular field — the terrain map had no
// glyph for the void around the island. "_" now reads as sea, so the island outline survives into the built map.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { AUTHOR_BEODEUL_TOWN_TOOL } from "@/editor/tools/authorBeodeulTown";
import { landmarkFootprints, parseCellMap, villageArgsFromCells } from "@/ai/imagePlanCells";
import { isPassable } from "@/project/collision";

function islandRows(): string[] {
  const rows: string[] = [];
  for (let y = 0; y < 32; y += 1) {
    let s = "";
    for (let x = 0; x < 48; x += 1) { const d = ((x - 24) / 21) ** 2 + ((y - 16) / 14) ** 2; s += d > 1 ? "_" : d < 0.15 ? "2" : d < 0.45 ? "1" : "0"; }
    rows.push(s);
  }
  return rows;
}

describe("image plan island village", () => {
  it("keeps the island outline: map corners are sea, the centre is walkable land", () => {
    const map = parseCellMap({ cells: islandRows(), landmarks: [{ id: "A", kind: "giant_tree", x: 22, y: 13, w: 4, h: 4 }] }, "village", 48, 32)!;
    const args = villageArgsFromCells(map);
    expect([args.width, args.height]).toEqual([56, 37]);
    const project = createBlankProject();
    const res = AUTHOR_BEODEUL_TOWN_TOOL.run(project, { ...args, mapId: project.startMapId!, theme: "river", seed: 5 });
    expect(String(res.summary)).toMatch(/섬 바깥 \d+칸은 바다/u);
    const m = project.maps[project.startMapId!]!;
    for (const [x, y] of [[1, 1], [m.width - 2, 1], [1, m.height - 2], [m.width - 2, m.height - 2]] as const) expect(isPassable(project, m, x, y, "down")).toBe(false);
    expect(landmarkFootprints(map, Number(args.width), Number(args.height))[0]).toMatchObject({ id: "A", x: 26, y: 15, w: 4, h: 5 });
  });
});
