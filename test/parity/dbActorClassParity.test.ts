// test/parity/dbActorClassParity.test.ts
// Invariant: actor/class values authored via the real editor mutator are consumed by the
// battle-construction layer (battleCommandsForActor / learnedSkillIds) as authored.
import { describe, expect, it } from "vitest";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { learnedSkillIds } from "@/battle/battleBattlers";
import { createBlankProject } from "@/project/defaults";
import type { ActorRecord, Project } from "@/project/types";
import { editorProject, updateDatabaseRecord } from "./parityRig";

const HERO = "actor_hero";
const HERO_CLASS = "class_hero";
const EXTRA_SKILL = "skill_poison_sting";

function heroOf(project: Project): ActorRecord {
  const actor = project.database.actors.find((record) => record.id === HERO);
  if (!actor) throw new Error(`missing ${HERO}`);
  return actor;
}

function skillsOf(project: Project, level: number): string[] {
  return learnedSkillIds(project, heroOf(project), level, undefined, undefined, false);
}

describe("database behavioral parity - actors & classes", () => {
  it("classes: authored battleCommands are consumed in authored order", () => {
    const project = editorProject(() =>
      updateDatabaseRecord("classes", HERO_CLASS, {
        battleCommands: [
          { id: "cmd_item", name: "아이템", kind: "item" },
          { id: "cmd_defend", name: "방어", kind: "defend" },
        ],
      })
    );
    expect(battleCommandsForActor(project, HERO).map((command) => command.kind)).toEqual(["item", "defend"]);
  });

  it("classes: a class with no usable battle command falls back to the default command set", () => {
    const project = editorProject(() => updateDatabaseRecord("classes", HERO_CLASS, { battleCommands: [] }));
    expect(battleCommandsForActor(project, HERO).map((command) => command.kind)).toEqual(["attack", "skill", "item", "defend", "escape"]);
  });

  it("actors: an authored learnedSkill becomes available to the battle battler", () => {
    const baseline = editorProject(() => {});
    expect(skillsOf(baseline, 1)).not.toContain(EXTRA_SKILL);

    const project = editorProject(() =>
      updateDatabaseRecord("actors", HERO, { learnedSkills: [{ level: 1, skillId: "skill_attack" }, { level: 1, skillId: EXTRA_SKILL }] })
    );
    expect(skillsOf(project, 1)).toContain(EXTRA_SKILL);
  });

  it("classes: an authored class learnedSkill flows to the actor's battle skills", () => {
    const baseline = editorProject(() => {});
    expect(skillsOf(baseline, 1)).not.toContain(EXTRA_SKILL);

    const project = editorProject(() => {
      const klass = createBlankProject().database.classes.find((record) => record.id === HERO_CLASS);
      const existing = klass?.learnedSkills ?? [];
      updateDatabaseRecord("classes", HERO_CLASS, { learnedSkills: [...existing, { level: 1, skillId: EXTRA_SKILL }] });
    });
    expect(skillsOf(project, 1)).toContain(EXTRA_SKILL);
  });

  it("actors: the authored learn level gates when a skill becomes available", () => {
    const project = editorProject(() => updateDatabaseRecord("actors", HERO, { learnedSkills: [{ level: 5, skillId: EXTRA_SKILL }] }));
    expect(skillsOf(project, 1)).not.toContain(EXTRA_SKILL);
    expect(skillsOf(project, 5)).toContain(EXTRA_SKILL);
  });
});
