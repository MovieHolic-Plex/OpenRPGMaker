// 기물 이름 관문 — 조수는 이름·태그만 보고 기물을 찾는다(~/claude-viz/object-findability.html, object-search 레인).
// 같은 이름의 다른 기물이나 영문 조각 이름은 찾기를 흐린다. 버들항 기물 카탈로그는 0 을 강제하고,
// 다른 번들 칩셋은 지금 수(기준선)보다 늘지 못하게 한다 — 줄이면 아래 수를 같이 낮춘다.
import { describe, expect, it } from "vitest";
import { BEODEUL_PLACEABLE_OBJECTS } from "@/assets/beodeulPlaceableObjects";
import { sharedObjects } from "@/editor/tools/sharedDesignCatalog";
import { createBlankProject } from "@/project/defaults/blankProject";

/** 칩셋별 상한: 같은 이름을 가진 킷 행 수, 영문 낱말(두 글자 이상)이 든 이름 수. 여기 없는 칩셋은 0. */
const BASELINE: Readonly<Record<string, { duplicateRows: number; englishNames: number }>> = {
  atlas_biome_interior: { duplicateRows: 4, englishNames: 0 },
  beodeul_city: { duplicateRows: 122, englishNames: 26 },
  beodeul_ground: { duplicateRows: 0, englishNames: 5 },
  beodeul_reviewed: { duplicateRows: 42, englishNames: 0 },
  beodeul_warm_trees: { duplicateRows: 0, englishNames: 7 },
  emerald_monster_climate: { duplicateRows: 0, englishNames: 48 },
  emerald_monster_coast: { duplicateRows: 0, englishNames: 85 },
  emerald_monster_dungeon: { duplicateRows: 0, englishNames: 13 },
  emerald_monster_gyms: { duplicateRows: 0, englishNames: 37 },
  emerald_monster_overworld: { duplicateRows: 0, englishNames: 93 },
  emerald_monster_rooms: { duplicateRows: 0, englishNames: 104 },
  emerald_monster_wild: { duplicateRows: 0, englishNames: 65 },
  joseon_baram: { duplicateRows: 19, englishNames: 388 },
  jp_city: { duplicateRows: 524, englishNames: 180 },
  modern_campus: { duplicateRows: 0, englishNames: 1 },
  modern_city: { duplicateRows: 302, englishNames: 11 },
  monster_climate: { duplicateRows: 0, englishNames: 48 },
  monster_coast: { duplicateRows: 0, englishNames: 85 },
  monster_dungeon: { duplicateRows: 0, englishNames: 13 },
  monster_gyms: { duplicateRows: 0, englishNames: 37 },
  monster_overworld: { duplicateRows: 0, englishNames: 93 },
  monster_rooms: { duplicateRows: 0, englishNames: 104 },
  monster_wild: { duplicateRows: 0, englishNames: 65 },
  pirate_isles: { duplicateRows: 0, englishNames: 166 },
  sf_station: { duplicateRows: 0, englishNames: 22 },
  wizarding_world: { duplicateRows: 0, englishNames: 172 },
};

const ENGLISH_WORD = /[A-Za-z]{2,}/u;

describe("object name gate", () => {
  it("keeps Beodeul object names unique", () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const object of BEODEUL_PLACEABLE_OBJECTS) {
      const other = seen.get(object.nameKo);
      if (other) duplicates.push(`${object.nameKo}: ${other}, ${object.id}`);
      seen.set(object.nameKo, object.id);
    }
    expect(duplicates).toEqual([]);
  });

  it("gives every Beodeul object a Korean tag", () => {
    const missing = BEODEUL_PLACEABLE_OBJECTS.filter(object => !object.tags.some(tag => /[가-힣]/u.test(tag))).map(object => object.id);
    expect(missing).toEqual([]);
  });

  it("does not add duplicate or English-fragment kit names to bundled chipsets", () => {
    const byTileset = new Map<string, string[]>();
    for (const row of sharedObjects(createBlankProject())) {
      if (!row.id.startsWith("kit:")) continue;
      byTileset.set(row.tilesetId, [...(byTileset.get(row.tilesetId) ?? []), row.name]);
    }
    const over: string[] = [];
    for (const [tilesetId, names] of byTileset) {
      const counts = new Map<string, number>();
      for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
      const duplicateRows = names.filter(name => counts.get(name)! > 1).length;
      const englishNames = names.filter(name => ENGLISH_WORD.test(name)).length;
      const limit = BASELINE[tilesetId] ?? { duplicateRows: 0, englishNames: 0 };
      if (duplicateRows > limit.duplicateRows) over.push(`${tilesetId}: 같은 이름 행 ${duplicateRows} > ${limit.duplicateRows} (${[...counts].filter(([, n]) => n > 1).slice(0, 5).map(([name]) => name).join(" / ")})`);
      if (englishNames > limit.englishNames) over.push(`${tilesetId}: 영문 이름 ${englishNames} > ${limit.englishNames} (${names.filter(name => ENGLISH_WORD.test(name)).slice(0, 5).join(" / ")})`);
    }
    expect(over).toEqual([]);
  });
});
