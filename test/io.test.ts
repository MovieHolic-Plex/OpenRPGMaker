import { describe, expect, it } from "vitest";
import { createBlankProject, DEFAULT_ANIMATION_ID, DEFAULT_ITEM_ID, DEFAULT_SKILL_ID, DEFAULT_STATE_ID } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { Command } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("defaultDatabaseStarterRecords", () => {
  isolateTimers();
  describe("default database starter records", () => {
    it("ships stable RTP-backed starter skills, items, states, and animations", () => {
      // Given: a freshly created project includes the default database seed pack.
      const database = createBlankProject().database;

      // When: starter record ids are collected for editor database surfaces.
      const skillIds = database.skills.map((skill) => skill.id);
      const itemIds = database.items.map((item) => item.id);
      const stateIds = database.states.map((state) => state.id);

      // Then: stable starter records and real EasyRPG animation resources are present.
      expect(skillIds).toEqual(
        expect.arrayContaining([
          DEFAULT_SKILL_ID,
          "skill_sword_slash",
          "skill_arcane_bolt",
          "skill_heal",
          "skill_poison_sting",
          "skill_sleep_mist",
          "skill_focus",
          "skill_weaken",
        ])
      );
      expect(itemIds).toEqual(
        expect.arrayContaining([DEFAULT_ITEM_ID, "item_ether", "item_antidote", "item_wake_herb", "item_poison_dart", "item_old_key"])
      );
      expect(stateIds).toEqual(expect.arrayContaining([
        DEFAULT_STATE_ID,
        "state_sleep",
        "state_attack_up",
        "state_defense_down",
        "state_attack_down",
        "state_agility_up",
        "state_agility_down",
        "state_paralysis",
        "state_deep_poison",
        "state_regen",
        "state_silence",
      ]));
      expect(database.battleAnimations).toEqual(
        expect.arrayContaining([
          // 타격·검격·화살은 EasyRPG 시트(2026-10-03 deprecated/) 대신 같은 역할의 번들 효과 시트를 쓴다.
          expect.objectContaining({ id: DEFAULT_ANIMATION_ID, resourceId: "generated-battle-anim-tackle-impact" }),
          expect.objectContaining({ id: "anim_sword", resourceId: "generated-battle-anim-slash-steel" }),
          expect.objectContaining({ id: "anim_arrow", resourceId: "generated-battle-anim-projectile-shot" }),
          expect.objectContaining({ id: "anim_px_slash", resourceId: "pixel-fx-slash" }),
          // 마법·회복·독은 근접 타격 아트(blow/arrow) 대신 절차 생성 이펙트 시트를 쓴다.
          expect.objectContaining({ id: "anim_magic", resourceId: "generated-battle-anim-arcane-nova" }),
          expect.objectContaining({ id: "anim_heal", resourceId: "generated-battle-anim-heal-bloom" }),
          expect.objectContaining({ id: "anim_poison", resourceId: "generated-battle-anim-poison-mist" }),
        ])
      );
      expect(database.items.find((item) => item.id === "item_poison_dart")).toMatchObject({
        type: "special",
        skillId: "skill_poison_sting",
        occasion: "battle",
      });
      expect(database.items.find((item) => item.id === DEFAULT_ITEM_ID)).toMatchObject({
        type: "medicine",
        hpRecovery: { flat: 50, percentMax: 0 },
      });
      expect(database.items.find((item) => item.id === "item_hi_potion")).toMatchObject({
        type: "medicine",
        hpRecovery: { flat: 150, percentMax: 0 },
        skillId: "skill_item_hi_potion",
      });
      expect(database.items.find((item) => item.id === "item_elixir")).toMatchObject({
        type: "medicine",
        hpRecovery: { flat: 0, percentMax: 100 },
        mpRecovery: { flat: 0, percentMax: 100 },
      });
      expect(database.items.find((item) => item.id === "item_sword_manual")).toMatchObject({
        type: "book",
        learnedSkillId: "skill_sword_slash",
        consumable: true,
      });
      expect(stateIds).toEqual(expect.arrayContaining([DEFAULT_STATE_ID, "state_sleep", "state_attack_up", "state_defense_up", "state_defense_down"]));
      expect(skillIds).toEqual(
        expect.arrayContaining([
          "skill_item_hi_potion",
          "skill_item_elixir",
          "skill_throwing_knife",
          "skill_item_poison_vial",
          "skill_item_antidote",
          "skill_item_guard",
          "skill_item_holy_water",
          "skill_item_thunder_stone",
          "skill_item_frost_vial",
          "skill_item_quake_stone",
          "skill_item_gale_fan",
          "skill_item_shadow_dust",
        ])
      );
    });

    it("backs item-use animations with known EasyRPG RTP sounds", () => {
      // Given: item records use existing battle animation ids for use feedback.
      const project = createBlankProject();

      // When: the default project is round-tripped through resource validation.
      const restored = deserialize(serialize(project));

      // Then: item-use animations reference bundled EasyRPG sound effects.
      expect(restored.database.items.find((item) => item.id === DEFAULT_ITEM_ID)?.animationId).toBe("anim_heal");
      expect(restored.database.items.find((item) => item.id === "item_ether")?.animationId).toBe("anim_gen_psychic_wave");
      expect(restored.database.items.find((item) => item.id === "item_poison_dart")?.animationId).toBe("anim_poison");
      expect(restored.database.battleAnimations.find((animation) => animation.id === "anim_heal")?.timings).toEqual(
        expect.arrayContaining([expect.objectContaining({ soundResourceId: "easyrpg-sound-recovery5" })])
      );
      expect(restored.database.battleAnimations.find((animation) => animation.id === "anim_gen_psychic_wave")?.timings).toEqual(
        expect.arrayContaining([expect.objectContaining({ soundResourceId: "easyrpg-sound-confusion" })])
      );
      expect(restored.database.battleAnimations.find((animation) => animation.id === "anim_poison")?.timings).toEqual(
        expect.arrayContaining([expect.objectContaining({ soundResourceId: "easyrpg-sound-poison" })])
      );
    });
  });
});

describe("feature16IntegrationRoundtrip", () => {
  isolateTimers();
  describe('selected features share the shipping project codec', () => {
    it('keeps climate, combat, action and AI authoring together across two reloads', () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      const skill = project.database.skills[0]!;
      const enemy = project.database.enemies[0]!;
      const item = project.database.items[0]!;
      map.climate = { mode: 'fixed', weather: 'snow', intensity: 0.6 };
      Object.assign(skill, {
        damageFormula: 'power + a.atk * 2 - b.def',
        criticalRate: 25, criticalMultiplier: 1.8, hitRate: 90,
        cooldownTurns: 2, hitSequence: [1, 0.5, 0.25],
        actionSkill: { kind: 'trap', damage: 12, range: 2, durationMs: 4000, cooldownMs: 600,
          fieldStatus: { kind: 'slow', durationMs: 1500 } },
      });
      enemy.rewards.drops = [{ itemId: item.id, quantity: 2, ratePercent: 100, condition: { kind: 'always' } }];
      enemy.actions[0]!.condition = { kind: 'hp', minPercent: 0, maxPercent: 50 };
      project.aiAuthoring = {
        templates: [{ id: 'roundtrip', name: '인물 대사', tags: ['대사'], body: '{{인물}}의 인사를 써 줘.' }],
        dialogueStyleRules: '호칭을 일관되게 사용한다.', maxDialogueChars: 180,
      };
      const restored = deserialize(serialize(deserialize(serialize(project))));
      expect(restored.maps[map.id]!.climate).toEqual(map.climate);
      const restoredSkill = restored.database.skills.find(record => record.id === skill.id)!;
      for (const field of ['damageFormula', 'criticalRate', 'criticalMultiplier', 'hitRate', 'cooldownTurns', 'hitSequence', 'actionSkill'] as const) {
        expect(restoredSkill[field], field).toEqual(skill[field]);
      }
      const restoredEnemy = restored.database.enemies.find(record => record.id === enemy.id)!;
      expect(restoredEnemy.rewards.drops).toEqual(enemy.rewards.drops);
      expect(restoredEnemy.actions[0]!.condition).toEqual(enemy.actions[0]!.condition);
      expect(restored.aiAuthoring).toEqual(project.aiAuthoring);
    });

    it('does not opt old projects into new battle or climate behavior', () => {
      const original = createBlankProject();
      const restored = deserialize(serialize(original));
      expect(restored.maps[restored.startMapId]!.climate).toBeUndefined();
      // 기본 로스터 스킬(src/assets/retroRosterSkills)은 이제 연타·공식·재사용 대기를 저작해 들고 온다 —
      // 이 검사의 뜻은 「코덱이 새 필드를 끼워 넣지 않는다」이므로 저작된 원본과 같고, 없던 스킬엔 계속 없어야 한다.
      const authored = new Map(original.database.skills.map((skill) => [skill.id, skill] as const));
      for (const skill of restored.database.skills) {
        const source = authored.get(skill.id);
        expect(skill.damageFormula).toEqual(source?.damageFormula);
        expect(skill.hitSequence).toEqual(source?.hitSequence);
        expect(skill.cooldownTurns).toEqual(source?.cooldownTurns);
      }
      expect(restored.database.skills.some((skill) => !authored.get(skill.id)?.hitSequence && skill.hitSequence === undefined)).toBe(true);
      for (const enemy of restored.database.enemies) expect(enemy.rewards.drops).toBeUndefined();
    });
  });
});

describe("io-forward-compat-command-kinds", () => {
  isolateTimers();
  function walkCommands(commands: readonly Command[] | undefined, visit: (cmd: Command) => void): void {
    if (!commands) return;
    for (const cmd of commands) {
      visit(cmd);
      if (cmd.kind === "choices") {
        for (const option of cmd.options) walkCommands(option.branch, visit);
        walkCommands(cmd.cancelBranch, visit);
      } else if (cmd.kind === "fork") {
        walkCommands(cmd.then, visit);
        walkCommands(cmd.else, visit);
      } else if (cmd.kind === "loop") {
        walkCommands(cmd.body, visit);
      } else if (cmd.kind === "shop") {
        walkCommands(cmd.transactionBranch, visit);
      } else if (cmd.kind === "promoteActor" || cmd.kind === "evolveMonster") {
        walkCommands(cmd.successBranch, visit);
        walkCommands(cmd.failureBranch, visit);
      }
    }
  }
  async function readOptionalText(path: string): Promise<string | null> {
    const moduleName = "node:fs";
    const fsModule = (await import(/* @vite-ignore */ moduleName)) as {
      readonly existsSync?: (p: string) => boolean;
      readonly readFileSync?: (p: string, enc: string) => string;
    };
    if (typeof fsModule.existsSync !== "function" || typeof fsModule.readFileSync !== "function") return null;
    if (!fsModule.existsSync(path)) return null;
    return fsModule.readFileSync(path, "utf8");
  }
  describe("forward-compatible command kind validation", () => {
    it("loads remote fable-village snapshot with setEventGraphicPattern", async () => {
      // Fixture lives under test/fixtures/projects/ (relocated from root tmp-fable-project.json
      // so the repo root stays clean for `ls` and agent first-scan).
      const raw = await readOptionalText("test/fixtures/projects/fable-village-snapshot.json");
      if (!raw) return;
      const loaded = deserialize(raw);
      expect(Object.keys(loaded.maps).length).toBeGreaterThan(0);
      let patternCount = 0;
      for (const map of Object.values(loaded.maps)) {
        for (const event of map.events) {
          for (const page of event.pages ?? []) {
            walkCommands(page.commands, (cmd) => {
              if (cmd.kind === "setEventGraphicPattern") patternCount += 1;
            });
          }
        }
      }
      expect(patternCount).toBeGreaterThan(0);
    });
  });
});
