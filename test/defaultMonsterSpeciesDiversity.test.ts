import { describe, expect, it } from "vitest";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createBlankProject } from "@/project/defaults";

// 기본 DB 종족 다양성 계약. 2026-08-28 다이어트 때 6종 전부가
// normal/포획 0.4/skill_attack 하나로 평탄화된 회귀를 막는다.
describe("default monster species diversity", () => {
  it("ships starter trio plus wild species with distinct types, capture rates, and skills", () => {
    const project = createBlankProject();
    const species = project.database.monsterSpecies ?? [];
    const byId = new Map(species.map((record) => [record.id, record]));

    // 스타터 3종 + 야생 5종 + 광산 해골이 전부 있어야 한다.
    for (const id of [
      "species_leafling",
      "species_sparkit",
      "species_aqualing",
      "species_wild_slime",
      "species_king_slime",
      "species_cave_bat",
      "species_stone_golem",
      "species_ember_drake",
      "species_forest_hornet",
      "species_mine_skeleton",
    ]) {
      expect(byId.has(id), `missing ${id}`).toBe(true);
    }

    // 타입이 한 가지로 뭉개지지 않는다 — 기본 차트(fire/water/grass)가 전부 등장한다.
    const types = new Set(species.flatMap((record) => record.types ?? []));
    expect([...types].sort()).toEqual(["fire", "grass", "water"]);

    // 포획률이 전원 동일하지 않다 — 잡기 쉬운 잡몹부터 보스급까지 구배가 있다.
    const rates = new Set(species.map((record) => record.captureRate));
    expect(rates.size).toBeGreaterThanOrEqual(5);
    expect(byId.get("species_wild_slime")!.captureRate).toBeGreaterThan(
      byId.get("species_king_slime")!.captureRate,
    );
    expect(byId.get("species_ember_drake")!.captureRate).toBeLessThanOrEqual(0.15);

    // L1 skill_attack 외에 종족 정체성 기술이 있다.
    const skillSets = new Set(
      species.flatMap((record) => (record.skillsByLevel ?? []).map((entry) => entry.skillId)),
    );
    expect(skillSets.has("skill_leaf")).toBe(true);
    expect(skillSets.has("skill_fire")).toBe(true);
    expect(skillSets.has("skill_water")).toBe(true);

    // 슬라임 진화 데모 체인이 살아 있다.
    expect(byId.get("species_wild_slime")!.evolutions?.[0]).toMatchObject({
      toSpeciesId: "species_king_slime",
      requires: { level: 7 },
    });

    // 참조 무결성: 종족 기술·아트가 전부 실재한다.
    const skillIds = new Set(project.database.skills.map((skill) => skill.id));
    for (const record of species) {
      for (const entry of record.skillsByLevel ?? []) {
        expect(skillIds.has(entry.skillId), `${record.id} missing skill ${entry.skillId}`).toBe(true);
      }
      expect(
        resolveAssetResourceUrl(record.graphic.monsterResourceId),
        `${record.id} missing art ${record.graphic.monsterResourceId}`,
      ).toBeTruthy();
    }
  });
});
