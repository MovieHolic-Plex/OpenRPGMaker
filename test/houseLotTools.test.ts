import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { houseBBox, propVocabIdForYardDecor, yardAreaForHouse } from "@/editor/tools/houseLotDecor";
import { getTool } from "@/editor/tools/toolRegistry";

describe("houseLotDecor pure helpers", () => {
  it("maps yard tags to vocab ids", () => {
    expect(propVocabIdForYardDecor("mailbox")).toBe("350");
    expect(propVocabIdForYardDecor("firewood")).toBe("349");
    expect(propVocabIdForYardDecor("bench_h")).toContain("bench-horizontal");
  });

  it("places yard south of door", () => {
    const wings = [{ x: 10, y: 5, w: 8, h: 6 }];
    const area = yardAreaForHouse({ width: 40, height: 40 }, wings, { x: 13, y: 10 }, { depth: 3, pad: 1 });
    expect(area.y).toBe(11);
    expect(area.h).toBe(3);
    expect(area.w).toBeGreaterThanOrEqual(6);
    expect(houseBBox(wings)).toEqual({ x: 10, y: 5, w: 8, h: 6 });
  });
});

describe("build_house_lots tool", () => {
  it("is registered", () => {
    expect(getTool("build_house_lots")?.mode).toBe("write");
  });

  it("builds houses and scatters yard decor near each house (not one plaza dump)", () => {
    const project = createBlankProject();
    const ctx = { project };
    const mapId = "map_lot_test";
    const created = runTool(ctx, "create_map", { id: mapId, name: "lot test", width: 40, height: 30 });
    expect(created.ok, created.summary).toBe(true);
    {
      const map = ctx.project.maps[mapId]!;
      map.lowerTiles.fill(240);
      map.upperTiles.fill(-1);
    }

    const result = runTool(
      ctx,
      "build_house_lots",
      {
        mapId,
        seed: 99,
        houses: [
          {
            kitId: "blue-stone",
            wings: [{ x: 4, y: 3, w: 8, h: 6 }],
            ownerName: "A",
            interior: false,
            yard: ["mailbox", "firewood"],
          },
          {
            kitId: "bright-plaster",
            wings: [{ x: 20, y: 12, w: 7, h: 6 }],
            ownerName: "B",
            interior: false,
            yard: ["bench_h", "pot"],
          },
        ],
      },
    );

    expect(result.ok, result.summary + JSON.stringify(result.issues ?? [])).toBe(true);
    expect(result.data?.houses).toBe(2);
    // runTool 은 맵 객체를 교체하므로 재조회
    const map = ctx.project.maps[mapId]!;
    const lots = result.data?.lots as {
      yardArea: { x: number; y: number; w: number; h: number };
      decor: { kind: string; summary: string }[];
    }[];
    expect(lots?.length).toBe(2);

    const yardTiles: { x: number; y: number; u: number }[] = [];
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const u = map.upperTiles[y * map.width + x]!;
        if ([349, 350, 351, 327, 328].includes(u)) yardTiles.push({ x, y, u });
      }
    }
    expect(yardTiles.length, JSON.stringify({ lots, yardTiles })).toBeGreaterThan(0);

    // 두 집 마당이 서로 다른 y 대역에 걸쳐야 함 (한 광장 뭉침 방지)
    const ys = yardTiles.map((c) => c.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(3);
  });
});

