// 버들항 고른 조각(bd-pick-*) — 시트 꼬리 덧붙이기가 새 사본과 옛 사본 모두에 들어가는지, 앞 칸은 그대로인지.
import { describe, expect, it } from "vitest";
import {
  BEODEUL_CITY_BASE_COUNT, BEODEUL_CITY_TILE_COUNT, BEODEUL_PICK_KIT_PREFIX,
  createBeodeulCityTileset, ensureBeodeulCityReferences, ensureBeodeulCityTileset,
} from "@/project/defaults/beodeulCity";
import type { StructureKitDef, TilesetDef } from "@/project/types";

/** 고른 조각이 굽기 전의 사본(23,936칸, bd-pick-* 키트·용도 없음)을 흉내 낸다. */
function oldCopy(): TilesetDef {
  const ts = createBeodeulCityTileset();
  const base = BEODEUL_CITY_BASE_COUNT;
  ts.count = base;
  ts.passability = ts.passability.slice(0, base);
  ts.priority = ts.priority.slice(0, base);
  ts.terrain = ts.terrain.slice(0, base);
  ts.tileMeta = ts.tileMeta!.slice(0, base);
  ts.animationStrips = (ts.animationStrips ?? []).filter(strip => strip.baseTile < base);
  ts.structureKits = (ts.structureKits ?? []).filter(kit => !kit.id.startsWith(BEODEUL_PICK_KIT_PREFIX));
  ts.referenceDocuments = (ts.referenceDocuments ?? []).filter(cat => !cat.id.startsWith("beodeul-picks-"));
  return ts;
}

describe("버들항 고른 조각", () => {
  it("새 사본은 꼬리 칸·bd-pick 키트·beodeul-picks 용도를 갖고 태어난다", () => {
    const ts = createBeodeulCityTileset();
    expect(BEODEUL_CITY_TILE_COUNT).toBeGreaterThan(BEODEUL_CITY_BASE_COUNT);
    expect(ts.count % ts.tilesPerRow).toBe(0);
    const picks = (ts.structureKits ?? []).filter(kit => kit.id.startsWith(BEODEUL_PICK_KIT_PREFIX));
    expect(picks.length).toBeGreaterThan(100);
    for (const kit of picks) {
      expect(kit.rows).toHaveLength(kit.height);
      for (const row of kit.rows) {
        for (const t of [...row.tiles, ...(row.upperTiles ?? [])]) {
          if (t >= 0) { expect(t).toBeGreaterThanOrEqual(BEODEUL_CITY_BASE_COUNT); expect(t).toBeLessThan(ts.count); }
        }
      }
    }
    const cats = (ts.referenceDocuments ?? []).filter(cat => cat.id.startsWith("beodeul-picks-"));
    expect(cats.map(cat => cat.id).sort()).toEqual(
      ["beodeul-picks-climate-village", "beodeul-picks-dungeon", "beodeul-picks-field", "beodeul-picks-special", "beodeul-picks-village"]);
    for (const cat of cats) for (const image of cat.images) expect(image.dataUrl.startsWith("/assets/")).toBe(true);
  });

  it("옛 사본은 앞 칸을 그대로 두고 꼬리·키트·용도만 덧붙는다(저자 키트는 남는다)", () => {
    const ts = oldCopy();
    const authored = { ...structuredClone(ts.structureKits![0]!), id: "my-kit" } as StructureKitDef;
    ts.structureKits = [...ts.structureKits!, authored];
    ts.passability[5] = { up: true, down: true, left: true, right: true };       // 저자가 고친 앞 칸
    const before = structuredClone(ts.passability.slice(0, BEODEUL_CITY_BASE_COUNT));
    expect(ensureBeodeulCityTileset(ts)).toBe(true);
    expect(ensureBeodeulCityReferences(ts)).toBe(true);
    const fresh = createBeodeulCityTileset();
    expect(ts.count).toBe(fresh.count);
    expect(ts.passability.slice(0, BEODEUL_CITY_BASE_COUNT)).toEqual(before);
    expect(ts.passability.slice(BEODEUL_CITY_BASE_COUNT)).toEqual(fresh.passability.slice(BEODEUL_CITY_BASE_COUNT));
    expect(ts.tileMeta).toHaveLength(fresh.count);
    expect(ts.structureKits!.some(kit => kit.id === "my-kit")).toBe(true);
    expect(ts.structureKits!.filter(kit => kit.id.startsWith(BEODEUL_PICK_KIT_PREFIX)).length)
      .toBe(fresh.structureKits!.filter(kit => kit.id.startsWith(BEODEUL_PICK_KIT_PREFIX)).length);
    expect((ts.referenceDocuments ?? []).some(cat => cat.id === "beodeul-picks-dungeon")).toBe(true);
    // 두 번째 실행은 아무것도 바꾸지 않는다
    expect(ensureBeodeulCityTileset(ts)).toBe(false);
    expect(ensureBeodeulCityReferences(ts)).toBe(false);
  });
});
