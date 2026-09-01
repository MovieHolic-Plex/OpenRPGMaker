// village 오퍼레이터 불변식 — 특히 **다양성이 코드로 보장되는가**.
// 기존 houseVariety 감지기로 타일에서 집을 되읽어 검증한다(선언이 아니라 결과를 본다).
import { describe, expect, it } from "vitest";
import {
  buildVillageWrites,
  COMBINED_TOWN_VILLAGE_PALETTE,
  villagePaletteFromSlots,
} from "@/editor/regionTask/villageWrites";
import { detectHouses, houseVarietyReport } from "@/editor/tools/houseVariety";
import { resolveMaterialSlots } from "@/editor/operators/materialSlots";
import { ensureBuildPaletteTileGroups } from "@/editor/panels/buildPaletteCore";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, RegionRect } from "@/project/types";

const REGION: RegionRect = { x: 1, y: 1, width: 32, height: 24 } as RegionRect;

function grassMap(width = 34, height = 26): GameMap {
  return {
    id: "m1",
    name: "테스트",
    width,
    height,
    tileSize: 16,
    tilesetId: "ts",
    lowerTiles: Array.from({ length: width * height }, () => 240),
    upperTiles: Array.from({ length: width * height }, () => -1),
    events: [],
  } as unknown as GameMap;
}

/** writes 를 적용한 사본 — 감지기는 GameMap 을 받는다. */
function applied(map: GameMap, writes: readonly { layer: "lower" | "upper"; x: number; y: number; tile: number }[]): GameMap {
  const next = { ...map, lowerTiles: [...map.lowerTiles], upperTiles: [...map.upperTiles] } as GameMap;
  for (const w of writes) {
    const i = w.y * map.width + w.x;
    if (w.layer === "upper") next.upperTiles[i] = w.tile;
    else next.lowerTiles[i] = w.tile;
  }
  return next;
}

describe("buildVillageWrites", () => {
  it("같은 시드는 같은 마을, 다른 시드는 다른 마을", () => {
    const map = grassMap();
    const a = buildVillageWrites(map, REGION, { houses: 5 }, 42);
    const b = buildVillageWrites(map, REGION, { houses: 5 }, 42);
    const c = buildVillageWrites(map, REGION, { houses: 5 }, 43);
    expect(a.writes).toEqual(b.writes);
    expect(JSON.stringify(c.writes)).not.toEqual(JSON.stringify(a.writes));
  });

  it("넘어온 맵을 변형하지 않는다 (순수 함수)", () => {
    const map = grassMap();
    const before = JSON.stringify({ lower: map.lowerTiles, upper: map.upperTiles });
    buildVillageWrites(map, REGION, { houses: 6 }, 7);
    expect(JSON.stringify({ lower: map.lowerTiles, upper: map.upperTiles })).toBe(before);
  });

  it("모든 쓰기가 영역 안이다", () => {
    const map = grassMap();
    const { writes } = buildVillageWrites(map, REGION, { houses: 8 }, 11);
    expect(writes.length).toBeGreaterThan(0);
    for (const w of writes) {
      expect(w.x).toBeGreaterThanOrEqual(REGION.x);
      expect(w.x).toBeLessThan(REGION.x + REGION.width);
      expect(w.y).toBeGreaterThanOrEqual(REGION.y);
      expect(w.y).toBeLessThan(REGION.y + REGION.height);
    }
  });

  it("요청한 만큼 짓고, 그 이상 짓지 않는다", () => {
    const map = grassMap();
    expect(buildVillageWrites(map, REGION, { houses: 3 }, 5).houses).toBe(3);
    const many = buildVillageWrites(map, REGION, { houses: 12 }, 5);
    expect(many.houses).toBeLessThanOrEqual(12);
    expect(many.houses).toBeGreaterThanOrEqual(4);
  });

  it("다양성이 보장된다 — 집이 여러 채면 모양도 여러 종 (비복원 추출)", () => {
    const map = grassMap();
    const result = buildVillageWrites(map, REGION, { houses: 6 }, 2026);
    expect(result.houses).toBeGreaterThanOrEqual(4);
    // 선언값
    expect(result.distinctTemplates).toBe(result.houses);
    // 결과값 — 타일에서 되읽은 실제 모양 수
    const report = houseVarietyReport(detectHouses(applied(map, result.writes)));
    expect(report.houses).toBeGreaterThanOrEqual(4);
    expect(report.distinctShapes).toBeGreaterThan(1);
  });

  it("uniform 을 켜면 한 모양으로 줄지어 짓는다", () => {
    const map = grassMap();
    const result = buildVillageWrites(map, REGION, { houses: 5, uniform: true }, 2026);
    expect(result.houses).toBeGreaterThanOrEqual(3);
    expect(result.distinctTemplates).toBe(1);
  });

  it("모든 문 앞이 길로 이어진다 (막힌 집 금지)", () => {
    const map = grassMap();
    const result = buildVillageWrites(map, REGION, { houses: 6 }, 91);
    const next = applied(map, result.writes);
    const houses = detectHouses(next);
    expect(houses.length).toBeGreaterThanOrEqual(4);
    const path = COMBINED_TOWN_VILLAGE_PALETTE.path;
    let checked = 0;
    for (const house of houses) {
      if (!house.doorAt) continue;
      checked += 1;
      const { x, y } = house.doorAt;
      // 문 위아래 어느 쪽이든 바로 앞 칸이 길이어야 한다.
      const above = next.lowerTiles[(y - 1) * next.width + x];
      const below = next.lowerTiles[(y + 1) * next.width + x];
      expect(above === path || below === path, `문(${x},${y}) 앞이 길이 아니다`).toBe(true);
    }
    expect(checked).toBeGreaterThanOrEqual(3);
  });

  it("집끼리 겹치지 않는다", () => {
    const map = grassMap();
    const result = buildVillageWrites(map, REGION, { houses: 9 }, 33);
    const houses = detectHouses(applied(map, result.writes));
    for (let i = 0; i < houses.length; i += 1) {
      for (let j = i + 1; j < houses.length; j += 1) {
        const a = houses[i]!.bbox;
        const b = houses[j]!.bbox;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `집 ${i}·${j} 가 겹친다`).toBe(false);
      }
    }
  });

  it("지면이 아닌 칸(물·기존 건물)에는 짓지 않는다", () => {
    const map = grassMap();
    const blocked = new Set<number>();
    for (let y = 4; y <= 12; y += 1) {
      for (let x = 4; x <= 16; x += 1) {
        map.lowerTiles[y * map.width + x] = 120; // WATER
        blocked.add(y * map.width + x);
      }
    }
    const { writes } = buildVillageWrites(map, REGION, { houses: 8 }, 3);
    for (const w of writes) expect(blocked.has(w.y * map.width + w.x)).toBe(false);
  });

  it("영역이 좁으면 짓지 않고 이유를 말한다", () => {
    const map = grassMap();
    const result = buildVillageWrites(map, { x: 1, y: 1, width: 5, height: 5 } as RegionRect, {}, 1);
    expect(result.houses).toBe(0);
    expect(result.writes).toEqual([]);
    expect(result.note).toContain("좁");
  });

  it("배치 3종이 서로 다른 결과를 낸다", () => {
    const map = grassMap();
    const spine = buildVillageWrites(map, REGION, { layout: "spine", houses: 5 }, 8);
    const plaza = buildVillageWrites(map, REGION, { layout: "plaza", houses: 5 }, 8);
    const scatter = buildVillageWrites(map, REGION, { layout: "scatter", houses: 5 }, 8);
    expect(JSON.stringify(plaza.writes)).not.toEqual(JSON.stringify(spine.writes));
    expect(JSON.stringify(scatter.writes)).not.toEqual(JSON.stringify(spine.writes));
    // 광장 배치는 광장 타일을 실제로 깐다.
    expect(plaza.writes.some((w) => w.tile === COMBINED_TOWN_VILLAGE_PALETTE.plaza)).toBe(true);
  });
});

describe("마을 팔레트 유도", () => {
  it("combined_town 슬롯에서 길·지면·울타리가 나온다", () => {
    const project = createBlankProject();
    const tileset = project.tilesets[project.maps[project.startMapId]!.tilesetId]!;
    ensureBuildPaletteTileGroups(tileset);
    const palette = villagePaletteFromSlots(resolveMaterialSlots(tileset));
    expect(palette.ground).toBe(240);
    expect(palette.path).toBe(421); // 오토타일 본체
    expect(palette.fence).not.toBeNull();
  });

  it("슬롯이 비면 기본 팔레트로 떨어진다", () => {
    const palette = villagePaletteFromSlots({});
    expect(palette.ground).toBe(COMBINED_TOWN_VILLAGE_PALETTE.ground);
    expect(palette.path).toBe(COMBINED_TOWN_VILLAGE_PALETTE.path);
  });

  it("낯선 길 타일을 주면 그것으로 도로를 깐다", () => {
    const map = grassMap();
    const palette = { ...COMBINED_TOWN_VILLAGE_PALETTE, path: 777 };
    const { writes } = buildVillageWrites(map, REGION, { houses: 4 }, 6, palette);
    expect(writes.some((w) => w.tile === 777)).toBe(true);
    expect(writes.some((w) => w.tile === COMBINED_TOWN_VILLAGE_PALETTE.path)).toBe(false);
  });
});
