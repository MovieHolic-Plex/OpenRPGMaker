import { describe, expect, it } from "vitest";

import {
  VILLAGE_ARCHETYPES,
  matchVillageArchetype,
  presetOverrides,
  villageArchetypeById,
} from "@/editor/tools/village/authoringData";
import { presetRecordFromArchetype } from "@/editor/panels/databaseVillageModel";

/**
 * 원형은 `builder.ts` 의 `inferIntentFromTheme` 안에 정규식 6갈래로만 있었다 — 테마 문장에
 * 낱말이 들어가야만 닿을 수 있었고, 화면에는 이름조차 없었으며 `presetId` 로 지목할 수도
 * 없었다. 이 파일은 그 정규식 표를 카탈로그로 옮긴 판정을 비교한다.
 * 2026-09-21 의도적 변경: 물가 테마는 시장을 암시하지 않으며, 명시한 시장이 물가보다 우선한다.
 *
 * 테마 → 실제 시공값까지의 사슬은 `villageBuilder.test.ts` 의 「강가 어촌 장터 → sand」가 본다.
 */

/** 옮기기 전 정규식 표. 손으로 다시 적어 두는 것이 이 테스트의 요점이다. */
const LEGACY_TABLE: readonly { readonly id: string; readonly pattern: RegExp }[] = [
  { id: "castle-stone", pattern: /성곽|석조|돌길|성문|castle|citadel/ },
  { id: "harbor-coast", pattern: /어촌|항구|바다|호수|강가|해안|coast|harbor|lake|river|beach|sand/ },
  { id: "market-fair", pattern: /장터|시장|market|fair|축제/ },
  { id: "farm-rural", pattern: /농|밭|촌락|farm|rural|목장|목축/ },
  { id: "mine-mountain", pattern: /광산|산골|mine|mountain|채석/ },
  { id: "garden-bloom", pattern: /정원|꽃|garden/ },
];

function legacyMatch(theme: string): string | undefined {
  if (!theme) return undefined;
  const lowered = theme.toLowerCase();
  return LEGACY_TABLE.find((entry) => entry.pattern.test(lowered))?.id;
}

const THEMES: readonly string[] = [
  "", "   ", "성곽 도시", "석조 성문 마을", "CASTLE TOWN", "citadel",
  "강가 어촌", "호수 마을", "해안 beach village", "River Bend",
  "장터", "시장 골목", "축제 마을", "Market Fair",
  "농촌", "밭 마을", "촌락", "목장", "FARM village", "rural hamlet",
  "광산 마을", "산골", "채석장", "Mountain Mine",
  "정원 마을", "꽃 마을", "Garden Quarter",
  "눈 덮인 고원", "아무 낱말도 없는 테마", "sand dune",
];

describe("마을 원형 카탈로그", () => {
  it("id 와 이름이 겹치지 않는다", () => {
    const ids = VILLAGE_ARCHETYPES.map((archetype) => archetype.id);
    const names = VILLAGE_ARCHETYPES.map((archetype) => archetype.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
    expect(ids).toHaveLength(6);
  });

  it("낱말은 전부 소문자다 — 판정이 소문자로 정규화한 문장을 본다", () => {
    for (const archetype of VILLAGE_ARCHETYPES) {
      expect(archetype.keywords.length, archetype.id).toBeGreaterThan(0);
      for (const keyword of archetype.keywords) {
        expect(keyword, `${archetype.id} / ${keyword}`).toBe(keyword.toLowerCase());
        expect(keyword.trim(), `${archetype.id} / ${keyword}`).toBe(keyword);
      }
    }
  });

  it("villageArchetypeById 는 카탈로그와 같은 객체를 준다", () => {
    for (const archetype of VILLAGE_ARCHETYPES) {
      expect(villageArchetypeById(archetype.id)).toBe(archetype);
    }
    expect(villageArchetypeById("없는-원형")).toBeUndefined();
  });
});

describe("마을 원형 판정 — 일반 테마는 기존 표 유지, 명시적 시장은 물가보다 우선", () => {
  it.each(THEMES)("“%s”", (theme) => {
    expect(matchVillageArchetype(theme)?.id).toBe(legacyMatch(theme.trim().toLowerCase()));
  });

  // 물가 기본 시장을 제거해도 명시적으로 요청한 장터는 유지한다.
  it("장터 낱말이 어촌 낱말보다 먼저 이긴다", () => {
    expect(matchVillageArchetype("항구 장터")?.id).toBe("market-fair");
    expect(matchVillageArchetype("장터 항구")?.id).toBe("market-fair");
  });

  it("빈 테마와 공백은 아무 원형도 고르지 않는다", () => {
    expect(matchVillageArchetype("")).toBeUndefined();
    expect(matchVillageArchetype("    ")).toBeUndefined();
  });

  it("영문 낱말은 대문자로 와도 잡힌다", () => {
    expect(matchVillageArchetype("A Quiet HARBOR")?.id).toBe("harbor-coast");
    expect(matchVillageArchetype("Stone CITADEL")?.id).toBe("castle-stone");
  });
});

describe("마을 원형 → 배치 프리셋", () => {
  it("원형 값은 전부 프리셋 검증을 통과한다", () => {
    // 화면이 원형을 프리셋 레코드로 구우므로, 열거형을 어긴 값이 있으면 조용히 사라진다.
    for (const archetype of VILLAGE_ARCHETYPES) {
      const record = presetRecordFromArchetype(archetype, archetype.id);
      expect(presetOverrides(record), archetype.id).toEqual({ ...archetype.values });
    }
  });

  it("레코드는 id·이름·메모를 갖고, 원형이 안 정하는 값은 비운다", () => {
    const archetype = villageArchetypeById("mine-mountain")!;
    const record = presetRecordFromArchetype(archetype, "vp_mine");
    expect(record.id).toBe("vp_mine");
    expect(record.name).toBe(archetype.name);
    expect(record.note).toBe(archetype.note);
    // 규모·길 폭·바닥은 씨앗값이 파생한다 — 원형이 손대면 "분위기만 정한다" 가 깨진다.
    expect(record.houseCount).toBeUndefined();
    expect(record.npcCount).toBeUndefined();
    expect(record.roadWidth).toBeUndefined();
    expect(record.roadNaturalness).toBeUndefined();
    expect(record.settlementLayout).toBeUndefined();
    expect(record.groundTheme).toBeUndefined();
    expect(record.templateIds).toBeUndefined();
  });

  it("광산 원형은 재료를 청석으로 못박는다", () => {
    expect(presetRecordFromArchetype(villageArchetypeById("mine-mountain")!, "x").kitMix).toBe("blue-stone");
  });
});
