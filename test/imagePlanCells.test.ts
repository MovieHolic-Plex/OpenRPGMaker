import { describe, expect, it } from "vitest";
import { applyCellFixes, cellGridSize, dungeonPlanFromCells, forestDesignFromCells, parseCellMap, villageArgsFromCells } from "@/ai/imagePlanCells";

const ring = [
  "________________________",
  "____......____......____",
  "____......====......____",
  "____..A...____......____",
  "_____=__________=_______",
  "_____=___......_=_______",
  "_____=___..BB.._=_______",
  "_____=___......_=_______",
  "_____=__________=_______",
  "____......____......____",
  "____......====......____",
  "____......____......____",
];

describe("imagePlanCells", () => {
  it("sizes the grid at 48 cells on the long side and keeps the aspect", () => {
    expect(cellGridSize(1536, 1024)).toEqual({ cols: 48, rows: 32 });
    expect(cellGridSize(1024, 1536)).toEqual({ cols: 32, rows: 48 });
  });

  it("pads short rows, rejects an almost empty map, and keeps landmarks inside the grid", () => {
    const map = parseCellMap({ cells: ["...", ...ring.slice(1)], landmarks: [{ id: "a", kind: "Altar", x: 99, y: 2, w: 9, h: 1 }] }, "dungeon", 24, 12);
    expect(map?.cells[0]).toBe("...".padEnd(24, "_"));
    expect(map?.landmarks[0]).toMatchObject({ id: "A", kind: "altar", x: 23, w: 1 });
    expect(parseCellMap({ cells: Array(12).fill("_".repeat(24)) }, "dungeon", 24, 12)).toBeNull();
  });

  it("turns a ring of rooms into rooms scaled uniformly with the ring links, island room unlinked", () => {
    const map = parseCellMap({ cells: ring, landmarks: [{ id: "A", kind: "altar", x: 6, y: 3, w: 1, h: 1 }] }, "dungeon", 24, 12)!;
    const plan = dungeonPlanFromCells(map);
    expect(plan.rooms).toHaveLength(5);
    expect(plan.rooms.map((r) => [r.kind, r.x, r.y, r.w, r.h])).toEqual([
      ["entrance", 28, 22, 12, 6], ["boss", 8, 2, 12, 6], ["hall", 28, 2, 12, 6], ["hall", 18, 12, 12, 6], ["hall", 8, 22, 12, 6],
    ]);
    expect(dungeonPlanFromCells(map, 1).rooms[0]).toMatchObject({ x: 14, w: 6, h: 5 });
    expect(plan.links).toHaveLength(4);
  });

  it("splices a fix region and adds a missed landmark once", () => {
    const map = parseCellMap({ cells: ring }, "dungeon", 24, 12)!;
    const { map: fixed, fixed: n } = applyCellFixes(map, { fixes: [{ x: 0, y: 0, rows: ["~~", "~~"] }, { x: 30, y: 0, rows: ["~"] }], landmarks: [{ id: "C", kind: "well", x: 1, y: 1 }] });
    expect(n).toBe(1);
    expect(fixed.cells[1]!.slice(0, 2)).toBe("~~");
    expect(fixed.landmarks.map((l) => l.id)).toEqual(["C"]);
  });

  it("sizes a village map from the plan aspect and carries tiers and water as terrainMap", () => {
    const rows = Array.from({ length: 24 }, (_, y) => (y < 8 ? "2" : y < 16 ? "1" : "0").repeat(30) + "~~" + "0".repeat(16));
    rows[20] = "0".repeat(10) + "hhh" + "0".repeat(35);
    const map = parseCellMap({ cells: rows, landmarks: [{ id: "A", kind: "giant_tree", x: 20, y: 3, w: 4, h: 4 }] }, "village", 48, 24)!;
    const args = villageArgsFromCells(map);
    expect([args.width, args.height]).toEqual([56, 32]);
    expect((args.terrainMap as string[])[0]).toBe("2".repeat(30) + "~~" + "0".repeat(16));
    expect((args.terrainMap as string[])[20]).toBe("0".repeat(48));
    expect((args.layout as { landmark: unknown }).landmark).toEqual({ x: 25, y: 6 });
  });

  it("pads short outdoor rows with the row's own ground, not sea", () => {
    const rows = Array.from({ length: 32 }, (_, y) => (y < 20 ? "0".repeat(46) : ""));
    const map = parseCellMap({ cells: rows.slice(0, 20) }, "village", 48, 32)!;
    expect(map.cells[0]).toBe("0".repeat(48));
    expect(map.cells[31]).toBe("0".repeat(48));
    expect((villageArgsFromCells(map).terrainMap as string[]).join("")).not.toContain("_");
  });

  it("does not smear landmark letters when padding short outdoor rows", () => {
    const map = parseCellMap({ cells: Array.from({ length: 20 }, () => "00AAA" + "0".repeat(10)) }, "village", 48, 32)!;
    expect(map.cells[0]!.slice(5)).toBe("0".repeat(43));
    expect(map.cells[25]).not.toContain("A");
    const raised = parseCellMap({ cells: ["2222==2222h", ...Array.from({ length: 19 }, () => "2".repeat(13))] }, "village", 48, 32)!;
    expect(raised.cells[0]!.slice(11)).toBe("2".repeat(37));
    expect(raised.cells[31]).toBe("2".repeat(48));
  });

  it("keeps explicit landmark ids even when an id-less one comes first", () => {
    const map = parseCellMap({ cells: Array.from({ length: 12 }, () => "...." + "_".repeat(20)), landmarks: [{ id: "A", kind: "altar", x: 1, y: 1 }, { kind: "well", x: 2, y: 2 }, { id: "B", kind: "statue", x: 3, y: 3 }] }, "dungeon", 24, 12)!;
    expect(map.landmarks.map((l) => `${l.id}:${l.kind}`).sort()).toEqual(["A:altar", "B:statue", "C:well"]);
  });

  it("reads a fork joined to the main path and its side", () => {
    for (const [side, toward] of [[14, "right"], [6, "left"]] as const) {
      const rows: string[] = [];
      for (let y = 0; y < 20; y += 1) {
        const r = "t".repeat(24).split(""); r[10] = "="; r[11] = "=";
        if (y >= 4 && y <= 8) { r[side] = "="; r[side + 1] = "="; }
        if (y === 9) for (let x = Math.min(side, 10); x <= Math.max(side + 1, 11); x += 1) r[x] = "=";
        rows.push(r.join(""));
      }
      expect(forestDesignFromCells(parseCellMap({ cells: rows }, "forest", 24, 20)!).branches).toEqual([{ at: 0.58, toward, end: "clearing" }]);
    }
  });

  it("takes the entrance room from an entrance landmark before the bottom edge", () => {
    const rows = Array.from({ length: 16 }, (_, y) => (y >= 2 && y <= 5 ? ".........." + "_".repeat(4) + ".........." : y >= 12 && y <= 14 ? "____" + "......" + "_".repeat(14) : "_".repeat(24)));
    const map = parseCellMap({ cells: rows, landmarks: [{ id: "A", kind: "statue", label: "입구 석상", x: 15, y: 3 }] }, "dungeon", 24, 16)!;
    const plan = dungeonPlanFromCells(map);
    expect(plan.rooms[0]!.kind).toBe("entrance");
    expect(plan.rooms[0]!.x).toBeGreaterThan(20);
  });

  it("gives a fix-pass landmark without an id the next free letter", () => {
    const map = parseCellMap({ cells: Array.from({ length: 12 }, () => "...." + "_".repeat(20)), landmarks: [{ id: "A", kind: "altar", x: 1, y: 1 }] }, "dungeon", 24, 12)!;
    const fixed = applyCellFixes(map, { fixes: [], landmarks: [{ kind: "statue", x: 2, y: 2 }] }).map;
    expect(fixed.landmarks.map((l) => l.id)).toEqual(["A", "B"]);
  });
});
