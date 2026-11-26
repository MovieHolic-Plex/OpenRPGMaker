import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { attackFamilyOfStyle, battleEntrySeCue, stateAddedSeCue } from "@/player/battleSeSlots";
import { authoredBattleCue } from "@/player/battleJuice";
import { fillBattleSeCues, SHIP_BATTLE_SE } from "@/ai/v2/story/shipBattleSe";
import { applyLookDefaults } from "@/ai/v2/story/shipDefaults";
import { lintBattleSeSlots } from "@/ai/v2/judge/audioVarietyLint";
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { SE_CUE_IDS } from "@/project/seCues";
import type { GameEvent, Project, StateRecord } from "@/project/types";

// 전투 소리 자리 연결(2026-11-26 전투 소리 다양성 분석 제안 3·4): 전투가 읽지 않던 자리를 사건에 잇고, 출하 기본값이 CC0 소리로 채우고, 빈 자리를 경고한다.
describe("battle sound slots", { timeout: 120_000 }, () => {
  const state = (patch: Partial<StateRecord>): StateRecord => ({ id: "state_custom", name: "상태", ...patch } as StateRecord);
  const withBattle = (): Project => {
    const project = createBlankProject();
    const start = project.maps[project.startMapId]!;
    start.events = [{ id: "ev_foe", name: "적", x: 1, y: 1, pages: [{ id: "p1", conditions: [], trigger: { kind: "action" }, commands: [{ kind: "battleProcessing", troopId: project.database.troops[0]!.id, canEscape: false, canLose: false }] }] } as unknown as GameEvent];
    return project;
  };

  describe("which state sounds like what is decided by what the state does, not its name", () => {
    it("maps the default states", () => {
      const find = (id: string) => createBlankProject().database.states.find((s) => s.id === id);
      expect(stateAddedSeCue(find("state_poison"))).toBe("poison");
      expect(stateAddedSeCue(find("state_sleep"))).toBe("sleep");
      expect(stateAddedSeCue(find("state_paralysis"))).toBe("paralyze");
      expect(stateAddedSeCue(find("state_attack_up"))).toBe("buff");
      expect(stateAddedSeCue(find("state_defense_down"))).toBe("debuff");
    });

    it("a renamed state still sounds like what it does", () => {
      expect(stateAddedSeCue(state({ name: "달콤한 낮잠", runtimeEffects: { restrictsAction: true }, recoverWhenHitChance: 80 }))).toBe("sleep");
      expect(stateAddedSeCue(state({ name: "얼어붙음", runtimeEffects: { restrictsAction: true }, recoverWhenHitChance: 0 }))).toBe("paralyze");
      expect(stateAddedSeCue(state({ runtimeEffects: { reflect: true } }))).toBe("reflect");
      expect(stateAddedSeCue(state({ runtimeEffects: { attackMultiplier: 1.5 } }))).toBe("buff");
      expect(stateAddedSeCue(state({ runtimeEffects: { defenseMultiplier: 0.5 } }))).toBe("debuff");
      expect(stateAddedSeCue(state({ runtimeEffects: { hpDamagePercentPerTurn: 5 } }))).toBe("poison");
      expect(stateAddedSeCue(state({}))).toBeUndefined();
    });

    it("maps timeline entries: a state added, a revive, a drain and a stat stage", () => {
      const states = createBlankProject().database.states;
      expect(battleEntrySeCue({ kind: "stateAdded", stateId: "state_poison" }, states)).toBe("poison");
      expect(battleEntrySeCue({ kind: "revive" }, states)).toBe("revive");
      expect(battleEntrySeCue({ kind: "healing", aside: "drain" }, states)).toBe("absorb");
      expect(battleEntrySeCue({ kind: "special", statStage: { stat: "attack", before: 0, after: 1 } } as never, states)).toBe("buff");
      expect(battleEntrySeCue({ kind: "damage" }, states)).toBeUndefined();
    });
  });

  it("maps a weapon or body motion family to an attack sound family", () => {
    expect(attackFamilyOfStyle("heavy")).toBe("blunt");
    expect(attackFamilyOfStyle("lancer")).toBe("pierce");
    expect(attackFamilyOfStyle("beast")).toBe("claw");
    expect(attackFamilyOfStyle("balanced")).toBeUndefined();
    expect(attackFamilyOfStyle(undefined)).toBeUndefined();
  });

  describe("the swing sound reads the family slot and falls back to the plain attack slot", () => {
    const withCues = (seCues: Record<string, string>): Pick<Project, "system"> => ({ system: { seCues } }) as Pick<Project, "system">;
    it("uses attack-blunt when authored, attack when only that is", () => {
      expect(authoredBattleCue("attack-swing", withCues({ attack: "snd_slash", "attack-blunt": "snd_thud" }), undefined, "blunt")).toEqual({ resourceId: "snd_thud" });
      expect(authoredBattleCue("attack-swing", withCues({ attack: "snd_slash" }), undefined, "blunt")).toEqual({ resourceId: "snd_slash" });
      expect(authoredBattleCue("attack-swing", withCues({ attack: "snd_slash", "attack-blunt": "snd_thud" }), undefined)).toEqual({ resourceId: "snd_slash" });
      expect(authoredBattleCue("attack-swing", withCues({}), undefined, "claw")).toBeUndefined();
    });
  });

  describe("ship defaults fill the battle sound slots with bundled CC0 sounds", () => {
    it("every default sound exists in the sound catalog and is a known slot", () => {
      const ids = new Set(listAudioResources("sound", createBlankProject()).map((r) => r.id));
      for (const [cue, id] of Object.entries(SHIP_BATTLE_SE)) {
        expect(SE_CUE_IDS, cue).toContain(cue);
        expect(ids.has(id), id).toBe(true);
        expect(id.startsWith("cc0-se-")).toBe(true);
      }
    });

    it("fills a game that has battles, once, and leaves an authored slot and a monster game alone", () => {
      const project = withBattle();
      expect(fillBattleSeCues(project)).toHaveLength(1);
      expect(project.system.seCues).toMatchObject({ damage: SHIP_BATTLE_SE.damage, "attack-blunt": SHIP_BATTLE_SE["attack-blunt"] });
      const before = structuredClone(project.system.seCues);
      expect(fillBattleSeCues(project)).toEqual([]);
      expect(project.system.seCues).toEqual(before);

      const authored = withBattle();
      authored.system.seCues = { damage: "snd_mine" };
      expect(fillBattleSeCues(authored)).toEqual([]);
      expect(authored.system.seCues).toEqual({ damage: "snd_mine" });

      const monsters = withBattle();
      monsters.system.monsterCollection = true;
      expect(fillBattleSeCues(monsters)).toEqual([]);
      expect(monsters.system.seCues).toBeUndefined();
    });

    it("leaves a game with no battles silent", () => {
      const project = createBlankProject();
      expect(fillBattleSeCues(project)).toEqual([]);
      expect(project.system.seCues).toBeUndefined();
    });

    it("the finishing look defaults run it", () => {
      const project = withBattle();
      expect(applyLookDefaults(project, "").some((line) => line.startsWith("전투 효과음 자리"))).toBe(true);
      expect(project.system.seCues?.damage).toBe(SHIP_BATTLE_SE.damage);
    });
  });

  describe("lint warns while the core battle slots are empty", () => {
    it("warns for a game with battles, and not once a slot is filled, not for no battles, not for monsters", () => {
      const project = withBattle();
      expect(lintBattleSeSlots(project).map((i) => i.code)).toEqual(["audio-battle-se-empty"]);
      project.system.seCues = { heal: "snd_heal" };
      expect(lintBattleSeSlots(project)).toEqual([]);
      expect(lintBattleSeSlots(createBlankProject())).toEqual([]);
      const monsters = withBattle();
      monsters.system.monsterCollection = true;
      expect(lintBattleSeSlots(monsters)).toEqual([]);
    });
  });
});
