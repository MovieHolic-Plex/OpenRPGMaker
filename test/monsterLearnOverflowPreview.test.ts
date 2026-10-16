// 레벨업 기술 배우기 — 칸이 모자라 보류로 가는 기술은 미리보기에서 overflowSkillIds 로 가려야 한다.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
import { describe, expect, it } from "vitest";
import { totalExpForLevel } from "@/project/actorModel";
import { normalizeSkillRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import {
  applyMonsterExperienceAndEvolution,
  giveMonster,
  previewMonsterExperience,
  splitLearnedMonsterSkills,
} from "@/project/monsterCollection";
import { startSession } from "@/project/session";
import type { MonsterSpeciesRecord, Project, SkillRecord } from "@/project/types";

const IDS = ["m1", "m2", "m3", "m4", "m5", "m6"] as const;

function move(id: string): SkillRecord {
  return normalizeSkillRecord({
    id, name: id, scope: "enemy", power: 10, description: "", type: "normal",
    mpCost: { flat: 0, percentMax: 0 }, successRate: 100, variance: 0, hitRate: 100,
    effect: { kind: "damage", statistic: "attack", affects: "hp" }, maxPp: 10,
  });
}

function fixture(skillLevels: readonly number[]): Project {
  const project = createBlankProject();
  project.database.skills = [...project.database.skills, ...IDS.map(move)];
  const species: MonsterSpeciesRecord = {
    id: "sp",
    name: "Sp",
    graphic: { graphicHue: 0, transparent: false, flying: false },
    baseStats: { maxHp: 30, maxMp: 0, attack: 10, defense: 10, mind: 10, agility: 10 },
    expCurve: { base: 30, extra: 20, acceleration: 30 },
    captureRate: 0.5,
    skillsByLevel: skillLevels.map((level, index) => ({ level, skillId: IDS[index]! })),
  };
  project.database.monsterSpecies = [species];
  project.system.monsterCollection = true;
  return project;
}

describe("splitLearnedMonsterSkills", () => {
  it("fills the free slots first and overflows the rest in learn order", () => {
    expect(splitLearnedMonsterSkills(["a", "b", "c"], ["x", "y"])).toEqual({ learned: ["x"], overflow: ["y"] });
    expect(splitLearnedMonsterSkills(["a"], ["x", "y"])).toEqual({ learned: ["x", "y"], overflow: [] });
    expect(splitLearnedMonsterSkills(["a", "b", "c", "d"], ["x"])).toEqual({ learned: [], overflow: ["x"] });
  });

  it("ignores moves that are already active and de-duplicates", () => {
    expect(splitLearnedMonsterSkills(["a", "b", "c", "d"], ["a", "x", "x"])).toEqual({ learned: [], overflow: ["x"] });
  });
});

describe("previewMonsterExperience overflowSkillIds", () => {
  it("marks the fifth move as overflow and leaves the field out when nothing overflows", () => {
    // Break: the result narration said 「배웠다!」 for a move that only went to pendingSkillIds.
    const project = fixture([1, 2, 3, 4, 5]);
    const species = project.database.monsterSpecies![0]!;
    const session = startSession(project, 7);
    const given = giveMonster(project, session, { speciesId: "sp", level: 4 });
    if (!given.ok) throw new Error("fixture monster was not created");
    const instance = { ...given.instance, exp: totalExpForLevel(species.expCurve!, 5) - 1 };

    const [preview] = previewMonsterExperience(project, [instance], 1, [instance.instanceId]);
    expect(preview!.learnedSkillIds).toEqual(["m5"]);
    expect(preview!.overflowSkillIds).toEqual(["m5"]);

    // 같은 입력으로 실제 적립하면 보류로 간다 — 미리보기와 일치해야 한다.
    session.monsterInstances[instance.instanceId] = instance;
    applyMonsterExperienceAndEvolution(project, session, 1, [instance.instanceId]);
    expect(session.monsterInstances[instance.instanceId]!.pendingSkillIds).toEqual(["m5"]);
  });

  it("has no overflow field while a slot is free", () => {
    const project = fixture([1, 2, 5]);
    const species = project.database.monsterSpecies![0]!;
    const session = startSession(project, 7);
    const given = giveMonster(project, session, { speciesId: "sp", level: 4 });
    if (!given.ok) throw new Error("fixture monster was not created");
    const instance = { ...given.instance, exp: totalExpForLevel(species.expCurve!, 5) - 1 };
    const [preview] = previewMonsterExperience(project, [instance], 1, [instance.instanceId]);
    expect(preview!.learnedSkillIds).toEqual(["m3"]);
    expect(preview!.overflowSkillIds).toBeUndefined();
  });
});
