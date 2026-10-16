import { describe, expect, it } from "vitest";
import { applyVariantLook, resolveVariantLook } from "@/editor/tools/mapVariantLook";
import { appendStructurePlacement, captureStructureTiles } from "@/project/structurePlacements";
import type { GameMap, Project } from "@/project/types";

describe("derive_map_variant 시대 겉모습(J03)", () => {
  it("era·name·id 낱말로 프리셋을 고르고, look 이 있으면 그것이 이긴다", () => {
    expect(resolveVariantLook({ era: "ruin" })).toBe("ruin");
    expect(resolveVariantLook({ name: "붕괴된 노르드 잔해 (붕괴의 세계)" })).toBe("ruin");
    expect(resolveVariantLook({ era: "past" })).toBe("past");
    expect(resolveVariantLook({ era: "고대" })).toBe("past");
    expect(resolveVariantLook({ era: "future", id: "map_x" })).toBe("future");
    expect(resolveVariantLook({ era: "황폐한 미래" })).toBe("ruin");
    expect(resolveVariantLook({ era: "평행세계 B", id: "map_alt" })).toBeNull();
    expect(resolveVariantLook({ era: "past", look: "none" })).toBeNull();
    expect(resolveVariantLook({ era: "past", look: "future" })).toBe("future");
    expect(resolveVariantLook({ look: "nope" })).toEqual({ error: expect.stringContaining("look 은") });
  });

  function townDraft(): { draft: Project; map: GameMap } {
    const width = 20;
    const height = 12;
    const cells = width * height;
    const map = {
      id: "m", name: "마을", width, height, tilesetId: "ts", tileSize: 16, events: [],
      lowerTiles: new Array(cells).fill(7), upperTiles: new Array(cells).fill(-1), structurePlacements: [],
    } as unknown as GameMap;
    // 건물 두 채(5×5) — 찍기 전 땅(7)을 before 로 기록하고 지붕 타일(900)을 덮는다.
    for (const x of [2, 12]) {
      const rect = { x, y: 3, w: 5, h: 5 };
      const before = captureStructureTiles(map, rect);
      for (let row = 0; row < 5; row += 1) for (let col = 0; col < 5; col += 1) map.upperTiles[(3 + row) * width + x + col] = 900;
      appendStructurePlacement(map, { kitId: `bd-house-${x}`, rect, before });
    }
    const draft = {
      maps: { m: map },
      tilesets: { ts: { id: "ts", structureKits: [{ id: "bd-pick-temple-ruins-rubble-temple", kind: "section", width: 1, height: 1, rows: [{ tiles: [-1], upperTiles: [555] }], learnedFrom: "db-authored" }] } },
    } as unknown as Project;
    return { draft, map };
  }

  it("ruin 은 조명·안개를 걸고 건물을 철거해 땅으로 되돌리며 폐허 조각을 놓는다", () => {
    const { draft, map } = townDraft();
    const warnings: string[] = [];
    const report = applyVariantLook(draft, map, "ruin", warnings, "variants[x]");
    expect(map.defaultLighting?.ambient).toBeGreaterThan(0);
    expect(map.climate).toMatchObject({ mode: "fixed", weather: "fog" });
    expect(report.demolishedBuildings).toBeGreaterThanOrEqual(1);
    const roofsLeft = map.upperTiles.filter((tile) => tile === 900).length;
    expect(roofsLeft).toBeLessThan(50);
    expect(map.upperTiles.filter((tile) => tile === 555).length).toBe(report.stampedPieces);
    expect(report.stampedPieces).toBeGreaterThan(0);
  });

  it("같은 변형 id 는 언제나 같은 철거·배치가 나온다", () => {
    const first = townDraft();
    const second = townDraft();
    applyVariantLook(first.draft, first.map, "past", [], "a");
    applyVariantLook(second.draft, second.map, "past", [], "a");
    expect(first.map.upperTiles).toEqual(second.map.upperTiles);
  });

  it("건물 배치 기록이 없으면 조명·안개만 걸고 경고한다", () => {
    const { draft, map } = townDraft();
    map.structurePlacements = [];
    const warnings: string[] = [];
    const report = applyVariantLook(draft, map, "future", warnings, "variants[y]");
    expect(report.demolishedBuildings).toBe(0);
    expect(map.defaultLighting).toBeDefined();
    expect(warnings.join(" ")).toContain("structurePlacements");
  });
});
