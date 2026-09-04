import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project } from "@/project/types";
import { runTool } from "@/editor/tools/toolRunner";
import { houseBBox, materialForYardDecor, yardAreaForHouse, YARD_DECOR_KINDS } from "@/editor/tools/houseLotDecor";
import { resolveMaterialByLabel } from "@/project/tileVocabulary";
import { getTool } from "@/editor/tools/toolRegistry";
import { buildHouseLots } from "@/editor/tools/houseLotDomain";

describe("houseLotDecor pure helpers", () => {
  it("maps yard tags to material labels", () => {
    expect(materialForYardDecor("mailbox")).toBe("우편함");
    expect(materialForYardDecor("firewood")).toBe("장작 더미");
    expect(materialForYardDecor("bench_h")).toBe("벤치");
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

describe("author_house lots — yard decor stays near each house (not one plaza dump)", () => {
  it("is registered as the canonical facade", () => {
    expect(getTool("author_house")?.mode).toBe("write");
  });

  it("builds houses and scatters yard decor near each house (not one plaza dump)", () => {
    const project = createBlankProject();
    const ctx = { project };
    const mapId = "map_lot_test";
    const created = runTool(ctx, "create_map", { id: mapId, name: "lot test", width: 40, height: 30 });
    expect(created.ok, created.summary).toBe(true);
    {
      const map = requireProjectMap(ctx.project, mapId);
      map.lowerTiles.fill(240);
      map.upperTiles.fill(-1);
    }
    const mapCountBeforeBuild = Object.keys(ctx.project.maps).length;

    const result = runTool(
      ctx,
      "author_house",
      {
        kind: "lots",
        mapId,
        seed: 99,
        houses: [
          {
            kitId: "blue-stone",
            wings: [{ x: 4, y: 3, w: 8, h: 6 }],
            ownerName: "A",
            interior: "exterior-only",
            door: true,
            yard: ["mailbox", "firewood"],
          },
          {
            kitId: "bright-plaster",
            wings: [{ x: 20, y: 12, w: 7, h: 6 }],
            ownerName: "B",
            interior: "exterior-only",
            door: true,
            yard: ["bench_h", "pot"],
          },
        ],
      },
    );

    expect(result.ok, result.summary + JSON.stringify(result.issues ?? [])).toBe(true);
    const data = result.data as { houses: readonly { kitId: string }[] };
    expect(data.houses).toHaveLength(2);
    expect(Object.keys(ctx.project.maps)).toHaveLength(mapCountBeforeBuild);
    expect(Object.keys(ctx.project.maps).some((id) => id.startsWith("map_house_interior_"))).toBe(false);
    // runTool 은 맵 객체를 교체하므로 재조회
    const map = requireProjectMap(ctx.project, mapId);
    expect(data.houses.length).toBe(2);

    const yardTiles: { x: number; y: number; u: number }[] = [];
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const u = map.upperTiles[y * map.width + x] ?? -1;
        if ([349, 350, 351, 327, 328].includes(u)) yardTiles.push({ x, y, u });
      }
    }
    expect(yardTiles.length, JSON.stringify({ yardTiles })).toBeGreaterThan(0);

    // 두 집 마당이 서로 다른 y 대역에 걸쳐야 함 (한 광장 뭉침 방지)
    const ys = yardTiles.map((c) => c.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(3);
  });
});

describe("yard decor materials are buildable", () => {
  // 라이부 QA 사고: yard 태그 sign → "팻말" 이 small-props 가방 그룹에만 속해
  // 가방 거절로 반려되면서 상점·여관 2쵄 시공이 통째로 실패했다.
  it("resolves every yard tag to a concrete material", () => {
    const tileset = Object.values(createBlankProject().tilesets)[0];
    if (tileset === undefined) throw new Error("Missing fixture tileset");
    const broken = YARD_DECOR_KINDS
      .map((kind) => ({ kind, material: materialForYardDecor(kind), result: resolveMaterialByLabel(tileset, materialForYardDecor(kind)) }))
      .filter((entry) => entry.result.status === "missing")
      .map((entry) => `${entry.kind}("${entry.material}")`);
    expect(broken, `가방·미등록으로 시공 불가한 yard 태그: ${broken.join(", ")}`).toEqual([]);
  });

  it("builds a lot whose yard uses the sign tag", () => {
    const project = createBlankProject();
    const ctx = { project };
    const mapId = "map_yard_sign";
    expect(runTool(ctx, "create_map", { id: mapId, name: "yard sign", width: 32, height: 24 }).ok).toBe(true);
    {
      const map = requireProjectMap(ctx.project, mapId);
      map.lowerTiles.fill(240);
      map.upperTiles.fill(-1);
    }

    const result = runTool(ctx, "author_house", {
      kind: "lots",
      mapId,
      seed: 7,
      houses: [{
        kitId: "amber-wood",
        wings: [{ x: 6, y: 4, w: 8, h: 6 }],
        ownerName: "상점",
        interior: "exterior-only",
        door: true,
        yard: ["sign", "wood_box", "fruit_box"],
      }],
    });

    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
    const data = result.data as { houses: readonly { kitId: string }[] };
    expect(data.houses.length).toBeGreaterThan(0);
  });
});

describe("house lot yard outcomes", () => {
  it("preserves a typed material failure with requested and placed counts", () => {
    // Given
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = requireProjectMap(project, mapId);
    const tileset = project.tilesets[map.tilesetId];
    if (tileset === undefined) throw new Error("Missing fixture tileset");
    tileset.tileMeta = [];
    tileset.tileGroups = [];

    // When
    const result = buildHouseLots(project, {
      mapId,
      seed: 3,
      houses: [{
        kitId: "blue-stone",
        wings: [{ x: 3, y: 3, w: 8, h: 6 }],
        door: true,
        interior: false,
        yard: [{ kind: "mailbox", count: 2 }],
      }],
    });

    // Then
    expect(result.data.lots[0]?.decor[0]).toMatchObject({
      status: "failed",
      kind: "mailbox",
      requested: 2,
      placed: 0,
      issue: { code: "material-not-found" },
    });
  });
});

function requireProjectMap(project: Project, mapId: string): GameMap {
  const map = project.maps[mapId];
  if (map) return map;
  throw new Error(`Missing test map: ${mapId}`);
}

