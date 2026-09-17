// test/parity/playerBootValidation.test.ts
import { describe, expect, it } from "vitest";
import { createBlankProject, DEFAULT_SKILL_ID } from "@/project/defaults";
import { createSampleAdventureProject } from "@/project/defaults/defaultProject";
import { deserialize, serialize } from "@/project/io";
import { validateProjectForPlay } from "@/project/playBootValidation";
import invalidReferenceProject from "../fixtures/projects/invalid-db-reference-v3.json";
import { createGoldenParityProject } from "./goldenProject";

describe("player-boot validation", () => {
  it("reports zero issues for every shipped project (no false positives)", () => {
    expect(validateProjectForPlay(createBlankProject())).toEqual([]);
    expect(validateProjectForPlay(createSampleAdventureProject())).toEqual([]);
  });

  it("flags an injected dangling skill animation reference", () => {
    const project = deserialize(serialize(createBlankProject()));
    const skill = project.database.skills.find((record) => record.id === DEFAULT_SKILL_ID);
    if (!skill) throw new Error(`missing skill ${DEFAULT_SKILL_ID}`);
    skill.animationId = "anim_does_not_exist";

    const issues = validateProjectForPlay(project);
    expect(issues.some((issue) => issue.includes("animationId does not exist"))).toBe(true);
  });

  it("the committed invalid-reference fixture never reaches play boot (rejected at the load boundary)", () => {
    expect(() => deserialize(JSON.stringify(invalidReferenceProject))).toThrow(/actor_invalid|classId/);
  });

  it("boot-validation gate: every shipped + golden project is reference-clean (CI gate)", () => {
    expect(validateProjectForPlay(createBlankProject())).toEqual([]);
    expect(validateProjectForPlay(createSampleAdventureProject())).toEqual([]);
    expect(validateProjectForPlay(createGoldenParityProject())).toEqual([]);
  });
});
