import { describe, expect, it } from "vitest";
import { MONSTER_CATALOG } from "@/assets/monsterCatalog";
import { listMonsterResources } from "@/assets/monsterResourceCatalog";
import { createBlankProject } from "@/project/defaults";

describe("visually reviewed monster catalog coverage", () => {
  it("covers every independently registered bundled monster exactly once", () => {
    const project = createBlankProject();
    const bundled = listMonsterResources(project).filter((resource) => resource.origin === "bundled");

    const registeredIds = bundled.map((resource) => resource.resourceId).sort();

    expect(new Set(registeredIds).size).toBe(registeredIds.length);
    expect(Object.keys(MONSTER_CATALOG).sort()).toEqual(registeredIds);
  });

  it("exposes reviewed catalog metadata rather than filename fallbacks", () => {
    const project = createBlankProject();

    const bundled = listMonsterResources(project).filter((resource) => resource.origin === "bundled");

    for (const resource of bundled) {
      expect(resource, resource.resourceId).toMatchObject({
        reviewStatus: "reviewed",
        sources: { name: "catalog", tags: "catalog", description: "catalog" },
      });
    }
  });
});
