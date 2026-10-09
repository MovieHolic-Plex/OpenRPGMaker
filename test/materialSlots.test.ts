// 재료 슬롯 계약 — 오퍼레이터가 칩셋에 닿는 유일한 통로.
// 핵심 불변식: 슬롯은 저장이 아니라 승인 어휘에서 유도되고, 사용자 오버라이드가 최우선이며,
// combined_town 에서는 기존 하드코딩과 **같은 타일**을 낸다(회귀 0의 근거).
import { describe, expect, it } from "vitest";
import {
  MATERIAL_SLOT_IDS,
  materialSlotCoverage,
  resolveMaterialSlots,
} from "@/editor/operators/materialSlots";
import {
  buildForestWrites,
  COMBINED_TOWN_FOREST_PALETTE,
  forestPaletteFromSlots,
} from "@/editor/regionTask/forestWrites";
import { ensureBuildPaletteTileGroups } from "@/editor/panels/buildPaletteCore";
import { createBlankProject } from "@/project/defaults";
import type { TilesetDef } from "@/project/types";

const REGION = { x: 1, y: 1, width: 18, height: 14 };

function combinedTownTileset(): TilesetDef {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  const tileset = project.tilesets[map.tilesetId]!;
  ensureBuildPaletteTileGroups(tileset);
  return tileset;
}

function grassMap(width = 24, height = 20) {
  return {
    width,
    height,
    lowerTiles: Array.from({ length: width * height }, () => 240),
    upperTiles: Array.from({ length: width * height }, () => -1),
  };
}

describe("슬롯 해석", () => {
  it("번들 칩셋은 설정 없이 채워진다 — 사람이 할 일이 0", () => {
    const slots = resolveMaterialSlots(combinedTownTileset());
    const coverage = materialSlotCoverage(slots);
    expect(coverage.total).toBe(MATERIAL_SLOT_IDS.length);
    expect(coverage.filled).toBeGreaterThanOrEqual(6);
    // forest 가 실제로 쓰는 재료는 반드시 있어야 한다.
    for (const id of ["ground", "path", "tree"] as const) {
      expect(slots[id], `${id} 슬롯이 비었다`).toBeDefined();
      expect(slots[id]!.source).toBe("bundled");
      expect(slots[id]!.tiles.length).toBeGreaterThan(0);
    }
  });

  it("나무 슬롯은 수관·밑동 쌍으로 읽힌다", () => {
    const slots = resolveMaterialSlots(combinedTownTileset());
    const tree = slots.tree!;
    expect(tree.pair).toBeDefined();
    expect(tree.pair!.top).not.toBe(tree.pair!.bottom);
    // combined_town 침엽수 = 260(수관)/290(밑동)
    expect([260, 262]).toContain(tree.pair!.top);
    expect([290, 292]).toContain(tree.pair!.bottom);
  });

  it("사용자 오버라이드가 번들보다 우선한다", () => {
    const tileset = combinedTownTileset();
    tileset.materialSlots = { ground: { tiles: [999, 998] } };
    const slots = resolveMaterialSlots(tileset);
    expect(slots.ground!.tiles).toEqual([999, 998]);
    expect(slots.ground!.source).toBe("user");
    // 오버라이드하지 않은 슬롯은 그대로 번들에서 온다.
    expect(slots.tree!.source).toBe("bundled");
  });

  it("승인되지 않은 그룹은 재료가 되지 않는다 (zero-trust 유지)", () => {
    const tileset = combinedTownTileset();
    for (const group of tileset.tileGroups ?? []) {
      delete (group as { origin?: string }).origin;
      delete (group as { source?: string }).source;
    }
    expect(materialSlotCoverage(resolveMaterialSlots(tileset)).filled).toBe(0);
  });

  it("타일셋이 없으면 빈 슬롯", () => {
    expect(resolveMaterialSlots(undefined)).toEqual({});
  });
});

describe("팔레트 유도", () => {
  it("combined_town 유도 팔레트가 하드코딩과 같은 수종·지면·덤불을 낸다", () => {
    const slots = resolveMaterialSlots(combinedTownTileset());
    const derived = forestPaletteFromSlots(slots);
    const base = COMBINED_TOWN_FOREST_PALETTE;
    // 수종 혼합이 핵심이다 — 침엽수 + 활엽수 2종이 그대로 나와야 "뻔한 숲" 으로 돌아가지 않는다.
    // 활엽수는 2×2 source_rect 라 좌측 열(262/292)로 읽혀야 한다(263 이 아래로 가면 나무가 깨진다).
    expect(derived.species).toEqual(base.species);
    expect(derived.dead).toEqual(base.dead);
    expect(derived.groundBase).toBe(base.groundBase);
    expect(derived.groundDark).toBe(base.groundDark);
    expect(derived.bush).toBe(base.bush);
  });

  it("길·꽃은 하네스가 선언한 본체를 따른다 — 그룹 밖 타일이 들어오지 않는다", () => {
    // 하드코딩(391·348)은 내 추측이었고, 그룹의 center 파트/대표 타일이 정본이다.
    // 값이 달라도 되지만 반드시 그 그룹 안에 있어야 한다.
    const slots = resolveMaterialSlots(combinedTownTileset());
    const derived = forestPaletteFromSlots(slots);
    expect(slots.path!.tiles).toContain(derived.path);
    expect(slots.flower!.tiles).toContain(derived.flower);
    // 본체는 오토타일 모서리(tileIds[0])가 아니어야 한다.
    expect(derived.path).toBe(slots.path!.body);
  });

  it("같은 시드는 팔레트가 같으면 같은 숲 — 유도 팔레트도 결정적이다", () => {
    const slots = resolveMaterialSlots(combinedTownTileset());
    const map = grassMap();
    const params = { density: 0.8, deadRatio: 0.15, underbrush: 0.6 };
    const a = buildForestWrites(map, REGION, params, 4242, forestPaletteFromSlots(slots));
    const b = buildForestWrites(map, REGION, params, 4242, forestPaletteFromSlots(slots));
    expect(a.writes).toEqual(b.writes);
    expect(a.trees).toBeGreaterThan(0);
  });

  it("슬롯이 비면 기본 팔레트로 떨어진다 — 재료가 없다고 기능이 죽지 않는다", () => {
    const palette = forestPaletteFromSlots({});
    expect(palette.groundBase).toBe(COMBINED_TOWN_FOREST_PALETTE.groundBase);
    expect(palette.species).toEqual(COMBINED_TOWN_FOREST_PALETTE.species);
  });

  it("낯선 칩셋의 타일로도 숲을 심는다 — 하드코딩에 묶이지 않는다", () => {
    const palette = forestPaletteFromSlots({
      ground: { id: "ground", label: "지면", tiles: [700, 701], layer: "lower", source: "user" },
      tree: {
        id: "tree", label: "나무", tiles: [800, 900],
        pair: { top: 800, bottom: 900 }, layer: "upper", source: "user",
      },
      path: { id: "path", label: "길", tiles: [750], layer: "lower", source: "user" },
    });
    expect(palette.groundBase).toBe(700);
    expect(palette.species).toEqual([[800, 900]]);
    expect(palette.path).toBe(750);

    // 그 팔레트로 실제 생성 — 낯선 타일만 쓰이는지 확인.
    const width = 24, height = 20;
    const map = {
      width, height,
      lowerTiles: Array.from({ length: width * height }, () => 700),
      upperTiles: Array.from({ length: width * height }, () => -1),
    };
    const built = buildForestWrites(map, REGION, { density: 0.9, underbrush: 0 }, 9, palette);
    expect(built.trees).toBeGreaterThan(0);
    const canopies = built.writes.filter((w) => w.layer === "upper").map((w) => w.tile);
    const trunks = built.writes.filter((w) => w.layer === "lower" && w.tile === 900);
    expect(new Set(canopies)).toEqual(new Set([800]));
    expect(trunks.length).toBe(built.trees);
    // combined_town 타일이 새어 들어오지 않는다.
    for (const write of built.writes) expect([260, 290, 261, 291, 240]).not.toContain(write.tile);
  });

  it("나무 재료가 없으면 지면만 칠하고 나무는 0", () => {
    const palette = forestPaletteFromSlots({
      ground: { id: "ground", label: "지면", tiles: [700], layer: "lower", source: "user" },
    });
    const noTrees = { ...palette, species: [], dead: null };
    const width = 20, height = 16;
    const map = {
      width, height,
      lowerTiles: Array.from({ length: width * height }, () => 700),
      upperTiles: Array.from({ length: width * height }, () => -1),
    };
    const built = buildForestWrites(map, REGION, { density: 0.9 }, 3, noTrees);
    expect(built.trees).toBe(0);
  });
});
