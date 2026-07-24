import { describe, expect, it } from "vitest";
import { cropReferenceMessage } from "@/editor/databaseReferences";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { normalizeCropRecord } from "@/project/farmModel";
import { store } from "@/project/store";

describe("Orphan-FK single authority (G003)", () => {
  function issuesWith(project: ReturnType<typeof createBlankProject>): string[] {
    store.replace(structuredClone(project));
    return collectProjectReferenceIssues(store.getCurrent());
  }

  it("C001: reports an orphan for every FK type when dangling", () => {
    const project = createBlankProject();

    project.database.actors[0].classId = "class_missing";
    project.database.skills[0].animationId = "anim_missing";
    project.database.skills[0].elementId = "element_missing";
    project.database.skills[0].stateEffects = [{ stateId: "state_missing", chance: 100, operation: "add" }];
    project.database.items[0].skillId = "skill_missing";
    project.database.equipment[0].skillId = "skill_missing";
    project.database.enemies[0].speciesId = "species_missing";
    project.database.troops[0].enemyIds = [...project.database.troops[0].enemyIds, "enemy_missing"];
    project.database.monsterSpecies = [
      { id: "species_probe", name: "프로브", graphic: {}, baseStats: {}, captureRate: 1, skillsByLevel: [{ level: 1, skillId: "skill_missing" }] } as any,
    ];
    project.database.crops = [
      normalizeCropRecord({ id: "crop_probe", name: "프로브작물", seedItemId: "item_missing", harvestItemId: "item_missing2", harvestCount: 1, stages: [{ days: 1 }], seasons: [] as any }),
    ];

    const issues = issuesWith(project).join("\n");

    expect(issues).toContain("classId does not exist");
    expect(issues).toContain("animationId does not exist");
    expect(issues).toContain("elementId does not exist");
    expect(issues).toContain("stateId does not exist");
    expect(issues).toContain("skillId does not exist");
    expect(issues).toContain("speciesId does not exist");
    expect(issues).toContain("enemy does not exist: enemy_missing");
    expect(issues).toContain("skill does not exist: skill_missing");
    expect(issues).toContain("seedItemId does not exist");
    expect(issues).toContain("harvestItemId does not exist");
  });

  it("C001: clean project reports zero reference issues", () => {
    expect(issuesWith(createBlankProject())).toHaveLength(0);
  });

  it("C002: crop delete-gate does not false-block; lint owns crop FK integrity", () => {
    const project = createBlankProject();
    project.database.crops = [
      normalizeCropRecord({ id: "crop_probe", name: "프로브작물", seedItemId: "item_missing", harvestItemId: "item_missing2", harvestCount: 1, stages: [{ days: 1 }], seasons: [] as any }),
    ];
    store.replace(structuredClone(project));

    // crop 참조는 런타임(FarmPlotState, PlaySession) 전용이라 정적 delete-gate는 차단하지 않는다.
    expect(cropReferenceMessage("crop_probe")).toBeNull();

    // orphan-FK 단일 권위자는 collectProjectReferenceIssues(validateCropRecords)이다.
    const issues = collectProjectReferenceIssues(store.getCurrent()).join("\n");
    expect(issues).toContain("seedItemId does not exist");
    expect(issues).toContain("harvestItemId does not exist");
  });
});
