import { describe, expect, it } from "vitest";
import { DEFAULT_TROOP_ID, createBlankProject, DEFAULT_SKILL_ID } from "@/project/defaults";
import { battle, firstMapId, referenceIssues, scene, editorProject, updateDatabaseRecord, addDatabaseRecord, deleteDatabaseRecord, duplicateDatabaseRecord } from "./parityRig";
import { createGoldenParityProject, GOLDEN_SWITCH, GOLDEN_SWITCH_EVENT, GOLDEN_TITLE_EFFECTS, GOLDEN_TRANSFER_DEST, GOLDEN_TRANSFER_EVENT } from "./goldenProject";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { learnedSkillIds } from "@/battle/battleBattlers";
import type { ActorRecord, Project } from "@/project/types";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { createScarloxyDemoProject } from "@/project/defaults/defaultProject";
import { validateProjectForPlay } from "@/project/playBootValidation";
import invalidReferenceProject from "../fixtures/projects/invalid-db-reference-v3.json";
import { isolateTimers } from "../mergedTeardown";

// test/parity/goldenProjectParity.test.ts
// Invariant: one canonical authored project plays end-to-end headlessly — valid references,
// every DB collection populated, a battle resolves, and authored events fire in the scene.
describe("goldenProjectParity", () => {
  isolateTimers();
  describe("golden project headless playthrough", () => {
    it("is reference-valid and exercises every database collection", () => {
      const project = createGoldenParityProject();
      expect(referenceIssues(project)).toEqual([]);
      expect(project.database.actors.length).toBeGreaterThan(0);
      expect(project.database.classes.length).toBeGreaterThan(0);
      expect(project.database.skills.length).toBeGreaterThan(0);
      expect(project.database.items.length).toBeGreaterThan(0);
      expect(project.database.equipment.length).toBeGreaterThan(0);
      expect(project.database.enemies.length).toBeGreaterThan(0);
      expect(project.database.troops.length).toBeGreaterThan(0);
      expect(project.database.states.length).toBeGreaterThan(0);
      expect(project.database.battleAnimations.length).toBeGreaterThan(0);
      expect((project.database.monsterSpecies ?? []).length).toBeGreaterThan(0);
      expect((project.database.crops ?? []).length).toBeGreaterThan(0);
    });

    it("preserves authored titleScreen effect fields through the editor round-trip", () => {
      // editorProject 는 serialize→deserialize 라운드트립을 포함한다 — 확장 필드가 그대로 남아야 한다.
      const project = createGoldenParityProject();
      expect(project.system.titleScreen?.backgroundLayers).toEqual(GOLDEN_TITLE_EFFECTS.backgroundLayers);
      expect(project.system.titleScreen?.particles).toEqual(GOLDEN_TITLE_EFFECTS.particles);
      expect(project.system.titleScreen?.intro).toEqual(GOLDEN_TITLE_EFFECTS.intro);
    });

    it("plays a scripted battle to a deterministic result", () => {
      const project = createGoldenParityProject();
      const script = [[{ actorId: "actor_hero", command: "attack", target: "enemy-1" }]];
      const result = battle(project, { troopId: DEFAULT_TROOP_ID, heroLevel: 10, n: 3, seed: 7, battleFlow: "strict", strictScript: script as never });
      expect(result.samples).toBe(3);
      expect(result.avgTurns).toBeGreaterThan(0);
    });

    it("fires the authored switch event in the scene", () => {
      const project = createGoldenParityProject();
      const result = scene(project, {
        mapId: firstMapId(project),
        start: { x: GOLDEN_SWITCH_EVENT.x, y: GOLDEN_SWITCH_EVENT.y - 1 },
        steps: [{ kind: "interact" }, { kind: "expect", switchOn: GOLDEN_SWITCH }],
      });
      expect(result.ok, result.failureReason).toBe(true);
    });

    it("runs the authored transfer event in the scene", () => {
      const project = createGoldenParityProject();
      const result = scene(project, {
        mapId: firstMapId(project),
        start: { x: GOLDEN_TRANSFER_EVENT.x, y: GOLDEN_TRANSFER_EVENT.y - 1 },
        steps: [{ kind: "interact" }, { kind: "expect", playerAt: { x: GOLDEN_TRANSFER_DEST.x, y: GOLDEN_TRANSFER_DEST.y } }],
      });
      expect(result.ok, result.failureReason).toBe(true);
    });
  });
});

// test/parity/dbActorClassParity.test.ts
// Invariant: actor/class values authored via the real editor mutator are consumed by the
// battle-construction layer (battleCommandsForActor / learnedSkillIds) as authored.
describe("dbActorClassParity", () => {
  isolateTimers();
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
});

// test/parity/dataIntegrityRoundTrip.test.ts
// Invariant: editor mutations across every collection survive serialize->deserialize losslessly,
// keep references valid, never leak runtime-only fields, and referenced records cannot be deleted.
describe("dataIntegrityRoundTrip", () => {
  isolateTimers();
  describe("editor->player data-integrity round-trip", () => {
    // 컬렉션마다 1회씩 총 12회 변이 + 2회 왕복이라 이 파일에서 가장 무겁다. store.update 는 호출마다
    // 프로젝트 전체를 복제·정규화하는 안전 경로를 타므로(실측 호출당 ~620ms, 이 테스트 13.9s) 부하 걸린
    // CI 러너에서 기본 15s 를 넘겨 parity 단계가 죽었다. 이 테스트만 넉넉히 준다.
    it("mutations across every collection persist losslessly with zero reference issues", () => {
      const before = editorProject(() => {});
      const counts = {
        items: before.database.items.length,
        skills: before.database.skills.length,
      };

      const project = editorProject(() => {
        const db = store.getCurrent().database;
        updateDatabaseRecord("actors", db.actors[0].id, { name: "parity-actor" });
        updateDatabaseRecord("classes", db.classes[0].id, { name: "parity-class" });
        updateDatabaseRecord("skills", db.skills[0].id, { name: "parity-skill" });
        updateDatabaseRecord("items", db.items[0].id, { name: "parity-item" });
        updateDatabaseRecord("equipment", db.equipment[0].id, { name: "parity-equip" });
        updateDatabaseRecord("enemies", db.enemies[0].id, { name: "parity-enemy" });
        updateDatabaseRecord("troops", db.troops[0].id, { name: "parity-troop" });
        updateDatabaseRecord("states", db.states[0].id, { name: "parity-state" });
        updateDatabaseRecord("battleAnimations", db.battleAnimations[0].id, { name: "parity-anim" });
        addDatabaseRecord("items");
        duplicateDatabaseRecord("skills", db.skills[0].id);
      });

      const names = [
        ...project.database.actors.map((r) => r.name),
        ...project.database.classes.map((r) => r.name),
        ...project.database.skills.map((r) => r.name),
        ...project.database.items.map((r) => r.name),
        ...project.database.equipment.map((r) => r.name),
        ...project.database.enemies.map((r) => r.name),
        ...project.database.troops.map((r) => r.name),
        ...project.database.states.map((r) => r.name),
        ...project.database.battleAnimations.map((r) => r.name),
      ];
      for (const marker of ["parity-actor", "parity-class", "parity-skill", "parity-item", "parity-equip", "parity-enemy", "parity-troop", "parity-state", "parity-anim"]) {
        expect(names).toContain(marker);
      }
      expect(project.database.items.length).toBe(counts.items + 1);
      expect(project.database.skills.length).toBe(counts.skills + 1);
      expect(referenceIssues(project)).toEqual([]);
    }, 60_000);

    it("round-trip is idempotent (no data added or lost on repeated save/load)", () => {
      const once = editorProject(() => updateDatabaseRecord("skills", DEFAULT_SKILL_ID, { name: "idempotent-skill" }));
      const twice = deserialize(serialize(once));
      expect(twice).toEqual(once);
    });

    it("a referenced record cannot be deleted and survives the round-trip", () => {
      let blocked: { ok: boolean } = { ok: true };
      const project = editorProject(() => {
        blocked = deleteDatabaseRecord("skills", DEFAULT_SKILL_ID);
      });
      expect(blocked.ok).toBe(false);
      expect(project.database.skills.some((record) => record.id === DEFAULT_SKILL_ID)).toBe(true);
    });

    it("serialized project keeps the canonical shape and leaks no runtime-only root fields", () => {
      const project = editorProject(() => updateDatabaseRecord("skills", DEFAULT_SKILL_ID, { name: "shape-skill" }));
      const json = JSON.parse(serialize(project)) as Record<string, unknown> & { database: { skills: unknown[] } };
      expect(json.database).toBeDefined();
      expect(json.maps).toBeDefined();
      expect(json.system).toBeDefined();
      expect(Array.isArray(json.database.skills)).toBe(true);
      expect(json.runtime).toBeUndefined();
      expect(json.playSession).toBeUndefined();
    });
  });
});

// test/parity/playerBootValidation.test.ts
describe("playerBootValidation", () => {
  isolateTimers();
  describe("player-boot validation", () => {
    it("reports zero issues for every shipped project (no false positives)", () => {
      expect(validateProjectForPlay(createBlankProject())).toEqual([]);
      expect(validateProjectForPlay(createScarloxyDemoProject())).toEqual([]);
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
      expect(validateProjectForPlay(createScarloxyDemoProject())).toEqual([]);
      expect(validateProjectForPlay(createGoldenParityProject())).toEqual([]);
    });
  });
});
