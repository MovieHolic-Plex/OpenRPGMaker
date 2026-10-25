import { describe, expect, it } from "vitest";
import { HARNESS_MONSTER_RESOURCE_IDS } from "@/assets/harnessMonsterArt";
import { MONSTER_CATALOG } from "@/assets/monsterCatalog";
import { listMonsterResources } from "@/assets/monsterResourceCatalog";
import { createBlankProject } from "@/project/defaults";

// 몬스터 수집 하네스가 사람이 고른 종 그림(harness-monster-*)은 자기 번들(harnessMonsterBundle.json)이 정본이고
// 이름은 id 에서 만든다 — 카탈로그(원본 시각 검수 메타)의 대상이 아니다.
const HARNESS_IDS: ReadonlySet<string> = new Set(HARNESS_MONSTER_RESOURCE_IDS);
// 고르는 목록에서 뺀 옛 적 그림(RETIRED_MONSTER_IDS)은 등록되지 않지만 카탈로그 메타는 남아 있다.
const RETIRED_WITH_CATALOG_ENTRY = ["easyrpg-monster-hornet", "generated-troop-preview-slime"];

function bundledCatalogResources(): ReturnType<typeof listMonsterResources> {
  return listMonsterResources(createBlankProject()).filter(
    (resource) => resource.origin === "bundled" && !HARNESS_IDS.has(resource.resourceId),
  );
}

describe("visually reviewed monster catalog coverage", () => {
  it("covers every independently registered bundled monster exactly once", () => {
    const bundled = bundledCatalogResources();

    const registeredIds = bundled.map((resource) => resource.resourceId).sort();

    expect(new Set(registeredIds).size).toBe(registeredIds.length);
    const catalogIds = Object.keys(MONSTER_CATALOG).filter((id) => !RETIRED_WITH_CATALOG_ENTRY.includes(id));
    expect(catalogIds.sort()).toEqual(registeredIds);
  });

  it("exposes reviewed catalog metadata rather than filename fallbacks", () => {
    const bundled = bundledCatalogResources();

    for (const resource of bundled) {
      expect(resource, resource.resourceId).toMatchObject({
        reviewStatus: "reviewed",
        sources: { name: "catalog", tags: "catalog", description: "catalog" },
      });
    }
  });
});
