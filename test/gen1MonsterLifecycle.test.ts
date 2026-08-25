import { describe, expect, it } from "vitest";
import { battlerSnapshot, monsterPartyBattlers } from "@/battle/battleBattlers";
import {
  battleSkillUseFailure,
  consumeBattleSkillResource,
} from "@/battle/battleSkillUse";
import { totalExpForLevel } from "@/project/actorModel";
import { normalizeSkillRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import {
  applyGen1FieldPoisonStep,
  applyMonsterExperienceAndEvolution,
  evolveMonster,
  giveMonster,
  normalizeMonsterInstanceBattleState,
  rejectPendingMonsterSkill,
  replacePendingMonsterSkill,
} from "@/project/monsterCollection";
import { startSession, type MonsterInstance } from "@/project/session";
import { recoverAll } from "@/project/sessionActorCommands";
import type { MonsterSpeciesRecord, Project, SkillRecord } from "@/project/types";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { resolveMonsterBattleParty } from "@/player/playSceneBattle";
import {
  applySaveSnapshot,
  createSaveSnapshot,
  readSaveSlot,
  saveSlotKey,
} from "@/player/saveSlots";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

const MOVE_IDS = ["move_1", "move_2", "move_3", "move_4", "move_5"] as const;

function move(id: string, maxPp?: number, mpCost = 0): SkillRecord {
  return normalizeSkillRecord({
    id,
    name: id,
    scope: "enemy",
    power: 10,
    description: "",
    type: "normal",
    mpCost: { flat: mpCost, percentMax: 0 },
    successRate: 100,
    variance: 0,
    hitRate: 100,
    effect: { kind: "damage", statistic: "attack", affects: "hp" },
    maxPp,
  });
}

function lifecycleProject(): Project {
  const project = createBlankProject();
  project.database.skills = [
    ...project.database.skills,
    move(MOVE_IDS[0], 10),
    move(MOVE_IDS[1], 20),
    move(MOVE_IDS[2], 30),
    move(MOVE_IDS[3], 40),
    move(MOVE_IDS[4], 50),
    move("legacy_move", undefined, 3),
  ];
  const species: MonsterSpeciesRecord = {
    id: "species_lifecycle",
    name: "Lifecycle",
    graphic: { graphicHue: 0, transparent: false, flying: false },
    baseStats: { maxHp: 30, maxMp: 0, attack: 10, defense: 10, mind: 10, agility: 10 },
    expCurve: { base: 30, extra: 20, acceleration: 30 },
    captureRate: 0.5,
    skillsByLevel: MOVE_IDS.map((skillId, index) => ({ level: index + 1, skillId })),
  };
  project.database.monsterSpecies = [species];
  const poison = project.database.states.find((state) => state.id === "state_poison");
  if (poison) poison.gen1MajorStatus = "poison";
  project.system.monsterCollection = true;
  return project;
}

function instanceAtLevel(project: Project, level: number): { instance: MonsterInstance; session: ReturnType<typeof startSession> } {
  const session = startSession(project, 7);
  const given = giveMonster(project, session, { speciesId: "species_lifecycle", level });
  if (!given.ok) throw new Error("fixture monster was not created");
  return { instance: given.instance, session };
}

describe("Gen1 monster lifecycle", () => {
  it("keeps persistent status turns and PP when building and snapshotting a party battler", () => {
    // Break: monsterPartyBattlers used to hard-reset stateIds/stateTurns and omitted skillPp.
    const project = lifecycleProject();
    const { instance } = instanceAtLevel(project, 4);
    const persisted: MonsterInstance = {
      ...instance,
      stateIds: ["state_poison"],
      stateTurns: { state_poison: 2 },
      skillPp: { move_1: 3, move_2: 18, move_3: 29, move_4: 40 },
    };

    const battler = monsterPartyBattlers(project, [persisted])[0]!;
    const snapshot = battlerSnapshot(battler);

    expect(battler.stateIds).toEqual(["state_poison"]);
    expect(battler.stateTurns).toEqual({ state_poison: 2 });
    expect(battler.skillPp).toEqual({ move_1: 3, move_2: 18, move_3: 29, move_4: 40 });
    expect(snapshot.stateTurns).toEqual({ state_poison: 2 });
    expect(snapshot.skillPp).toEqual({ move_1: 3, move_2: 18, move_3: 29, move_4: 40 });
  });

  it("writes monster HP status turns and PP to its instance without polluting actorStateIds", () => {
    // Break: battle reward write-back used actor.recordId for every battler, including monster instance ids.
    const project = lifecycleProject();
    const { instance, session } = instanceAtLevel(project, 4);
    session.actorStateIds[instance.instanceId] = ["state_attack_up"];

    applyBattleRewardsToSession(session, {
      result: "escape",
      rewards: { exp: 0, gold: 0, items: [] },
      monsterPartyMode: true,
      actors: [{
        id: `mon:${instance.instanceId}`,
        recordId: instance.instanceId,
        monsterInstanceId: instance.instanceId,
        speciesId: instance.speciesId,
        name: "Lifecycle",
        hp: 7,
        maxHp: 30,
        mp: 0,
        maxMp: 0,
        gauge: 0,
        defeated: false,
        defending: false,
        pose: "idle",
        stateIds: ["state_poison"],
        stateTurns: { state_poison: 3 },
        skillIds: [...MOVE_IDS.slice(0, 4)],
        skillPp: { move_1: 0, move_2: 4, move_3: 5, move_4: 6 },
      }],
    }, project);

    expect(session.monsterInstances[instance.instanceId]).toMatchObject({
      currentHp: 7,
      stateIds: ["state_poison"],
      stateTurns: { state_poison: 3 },
      skillPp: { move_1: 0, move_2: 4, move_3: 5, move_4: 6 },
    });
    expect(session.actorStateIds[instance.instanceId]).toBeUndefined();
  });

  it("roundtrips status PP and pending moves through a parsed save into the next battle", () => {
    // Break: save validation did not understand the new monster maps and legacy load did not hydrate moves/PP.
    const project = lifecycleProject();
    const { instance, session } = instanceAtLevel(project, 4);
    session.monsterInstances[instance.instanceId] = {
      ...instance,
      stateIds: ["state_poison"],
      stateTurns: { state_poison: 1 },
      skillPp: { move_1: 0, move_2: 2, move_3: 3, move_4: 4 },
      pendingSkillIds: ["move_5"],
    };
    const storage = new MemoryStorage();
    storage.setItem(saveSlotKey(1), JSON.stringify(createSaveSnapshot(project, session)));

    const read = readSaveSlot(storage, 1);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") return;
    const restored = applySaveSnapshot(project, read.snapshot);
    const restoredInstance = restored.monsterInstances[instance.instanceId]!;
    const nextBattle = monsterPartyBattlers(project, [restoredInstance])[0]!;

    expect(restoredInstance.pendingSkillIds).toEqual(["move_5"]);
    expect(nextBattle.stateIds).toEqual(["state_poison"]);
    expect(nextBattle.stateTurns).toEqual({ state_poison: 1 });
    expect(nextBattle.skillPp).toEqual({ move_1: 0, move_2: 2, move_3: 3, move_4: 4 });
  });

  it("roundtrips legacy actor Gen1 PP through save parsing", () => {
    const project = lifecycleProject();
    const session = startSession(project, 19);
    const actorId = session.partyActorIds[0]!;
    session.actorSkillPp = { [actorId]: { move_1: 3 } };
    const storage = new MemoryStorage();
    storage.setItem(saveSlotKey(1), JSON.stringify(createSaveSnapshot(project, session)));

    const read = readSaveSlot(storage, 1);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") return;
    expect(applySaveSnapshot(project, read.snapshot).actorSkillPp).toEqual({ [actorId]: { move_1: 3 } });
  });

  it("hydrates a legacy instance with the latest four level moves and their authored PP", () => {
    // Break: legacy fallback returned every species move and never persisted initialized PP.
    const project = lifecycleProject();
    const { instance, session } = instanceAtLevel(project, 5);
    const legacy: MonsterInstance = { ...instance, skillIds: undefined, skillPp: undefined };
    session.monsterInstances[instance.instanceId] = legacy;

    const directBattle = monsterPartyBattlers(project, [legacy])[0]!;
    expect(directBattle.skillIds).toEqual(["move_2", "move_3", "move_4", "move_5"]);
    expect(directBattle.skillPp).toEqual({ move_2: 20, move_3: 30, move_4: 40, move_5: 50 });

    const storage = new MemoryStorage();
    storage.setItem(saveSlotKey(1), JSON.stringify(createSaveSnapshot(project, session)));
    const read = readSaveSlot(storage, 1);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") return;
    const restored = applySaveSnapshot(project, read.snapshot);
    const hydrated = restored.monsterInstances[instance.instanceId]!;

    expect(hydrated.skillIds).toEqual(["move_2", "move_3", "move_4", "move_5"]);
    expect(hydrated.skillPp).toEqual({ move_2: 20, move_3: 30, move_4: 40, move_5: 50 });
  });

  it("migrates an overfull legacy stored learnset to the latest four moves", () => {
    // Break: pre-limit saves can contain every learned move even though skillIds is present.
    const project = lifecycleProject();
    const { instance, session } = instanceAtLevel(project, 5);
    session.monsterInstances[instance.instanceId] = {
      ...instance,
      skillIds: [...MOVE_IDS],
      skillPp: { move_1: 1, move_2: 2, move_3: 3, move_4: 4, move_5: 5 },
    };

    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));

    expect(restored.monsterInstances[instance.instanceId]!.skillIds).toEqual(["move_2", "move_3", "move_4", "move_5"]);
    expect(restored.monsterInstances[instance.instanceId]!.skillPp).toEqual({ move_2: 2, move_3: 3, move_4: 4, move_5: 5 });
  });

  it("preserves an explicitly empty active learnset across repeated hydration", () => {
    // Break: normalization collapsed [] to undefined, so the next hydration silently restored species moves.
    const project = lifecycleProject();
    const { instance } = instanceAtLevel(project, 4);
    const empty = normalizeMonsterInstanceBattleState(project, {
      ...instance,
      skillIds: [],
      skillPp: undefined,
    });

    expect(empty.skillIds).toEqual([]);
    expect(normalizeMonsterInstanceBattleState(project, empty).skillIds).toEqual([]);
    expect(monsterPartyBattlers(project, [empty])[0]!.skillIds).toEqual([]);
  });

  it("gives a high-level monster only its latest four moves", () => {
    // Break: newly caught/given high-level monsters previously received the complete level-up learnset.
    const project = lifecycleProject();
    const { instance } = instanceAtLevel(project, 5);

    expect(instance.skillIds).toEqual(["move_2", "move_3", "move_4", "move_5"]);
    expect(instance.skillPp).toEqual({ move_2: 20, move_3: 30, move_4: 40, move_5: 50 });
    expect(instance.pendingSkillIds).toBeUndefined();
  });

  it("queues a fifth learned move and supports pure replace or reject without reviving forgotten PP", () => {
    // Break: level/evolution learning unioned every move into skillIds, bypassing the four-move limit.
    const project = lifecycleProject();
    const species = project.database.monsterSpecies![0]!;
    const { instance, session } = instanceAtLevel(project, 4);
    session.monsterInstances[instance.instanceId] = {
      ...instance,
      exp: totalExpForLevel(species.expCurve!, 5) - 1,
      skillPp: { move_1: 1, move_2: 2, move_3: 3, move_4: 4 },
    };

    applyMonsterExperienceAndEvolution(project, session, 1, [instance.instanceId]);
    const learned = session.monsterInstances[instance.instanceId]!;
    expect(learned.skillIds).toEqual(["move_1", "move_2", "move_3", "move_4"]);
    expect(learned.pendingSkillIds).toEqual(["move_5"]);

    const replaced = replacePendingMonsterSkill(project, learned, "move_5", "move_2");
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) return;
    expect(replaced.instance.skillIds).toEqual(["move_1", "move_5", "move_3", "move_4"]);
    expect(replaced.instance.pendingSkillIds).toBeUndefined();
    expect(replaced.instance.skillPp).toEqual({ move_1: 1, move_5: 50, move_3: 3, move_4: 4 });

    const rejected = rejectPendingMonsterSkill(learned, "move_5");
    expect(rejected.ok).toBe(true);
    if (rejected.ok) {
      expect(rejected.instance.skillIds).toEqual(["move_1", "move_2", "move_3", "move_4"]);
      expect(rejected.instance.pendingSkillIds).toBeUndefined();
      expect(rejected.instance.skillPp).toEqual({ move_1: 1, move_2: 2, move_3: 3, move_4: 4 });
      session.monsterInstances[instance.instanceId] = rejected.instance;
      const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
      expect(restored.monsterInstances[instance.instanceId]!.pendingSkillIds).toBeUndefined();
      expect(restored.monsterInstances[instance.instanceId]!.skillIds).not.toContain("move_5");
    }
  });

  it("queues an evolution move when the active set is already full", () => {
    // Break: evolution used the same unbounded union as level-up learning.
    const project = lifecycleProject();
    const source = project.database.monsterSpecies![0]!;
    source.evolutions = [{ toSpeciesId: "species_lifecycle_evolved", requires: { level: 4 } }];
    project.database.monsterSpecies!.push({
      ...source,
      id: "species_lifecycle_evolved",
      name: "Lifecycle Evolved",
      evolutions: undefined,
      skillsByLevel: [
        ...(source.skillsByLevel ?? []).filter((entry) => entry.skillId !== "move_5"),
        { level: 4, skillId: "move_5" },
      ],
    });
    const { instance, session } = instanceAtLevel(project, 4);

    const result = evolveMonster(project, session, { instanceId: instance.instanceId });
    const evolved = session.monsterInstances[instance.instanceId]!;

    expect(result.ok).toBe(true);
    expect(evolved.speciesId).toBe("species_lifecycle_evolved");
    expect(evolved.skillIds).toEqual(["move_1", "move_2", "move_3", "move_4"]);
    expect(evolved.pendingSkillIds).toEqual(["move_5"]);
  });

  it("uses per-move PP for authored monster moves and preserves the legacy MP path", () => {
    // Break: skill legality and consumption only knew MP, so Gen1 PP could neither block nor decrement.
    const project = lifecycleProject();
    const ppUser = {
      monsterInstanceId: "monster_1",
      mp: 0,
      maxMp: 0,
      skillIds: ["move_1"],
      skillPp: { move_1: 1 },
    };

    expect(battleSkillUseFailure(project, ppUser, "move_1")).toBeUndefined();
    expect(consumeBattleSkillResource(project, ppUser, "move_1")).toEqual({ kind: "pp", remaining: 0 });
    expect(battleSkillUseFailure(project, ppUser, "move_1")).toBe("noPp");

    const legacyUser = {
      monsterInstanceId: "monster_1",
      mp: 3,
      maxMp: 3,
      skillIds: ["legacy_move"],
      skillPp: {},
    };
    expect(battleSkillUseFailure(project, legacyUser, "legacy_move")).toBeUndefined();
    expect(consumeBattleSkillResource(project, legacyUser, "legacy_move")).toEqual({ kind: "mp", remaining: 0 });
  });

  it("derives one monster battle mode from either compatibility selector and the actual party", () => {
    // Break: playSceneBattle built one party from battleParty and another from monsterBattleParty.
    const project = lifecycleProject();
    const { instance, session } = instanceAtLevel(project, 1);
    project.system.battleParty = "monsters";
    delete project.system.monsterBattleParty;

    expect(resolveMonsterBattleParty(project, session)).toEqual({
      requested: true,
      monsterPartyMode: true,
      partyMonsters: [session.monsterInstances[instance.instanceId]],
    });

    delete project.system.battleParty;
    project.system.monsterBattleParty = true;
    expect(resolveMonsterBattleParty(project, session).monsterPartyMode).toBe(true);

    session.monsterParty = [];
    expect(resolveMonsterBattleParty(project, session)).toMatchObject({ requested: true, monsterPartyMode: false, partyMonsters: [] });
  });

  it("recoverAll restores party monster HP PP and clears persistent status", () => {
    // Break: Pokemon-center recoverAll only touched actor HP/MP.
    const project = lifecycleProject();
    const { instance, session } = instanceAtLevel(project, 4);
    session.monsterInstances[instance.instanceId] = {
      ...instance,
      currentHp: 1,
      stateIds: ["state_poison"],
      stateTurns: { state_poison: 7 },
      skillPp: { move_1: 0, move_2: 1, move_3: 2, move_4: 3 },
    };

    recoverAll(session, undefined, project);

    expect(session.monsterInstances[instance.instanceId]).toMatchObject({
      stateIds: [],
      stateTurns: {},
      skillPp: { move_1: 10, move_2: 20, move_3: 30, move_4: 40 },
    });
    expect(session.monsterInstances[instance.instanceId]!.currentHp).toBeGreaterThan(1);
  });

  it("applies persistent Gen1 field poison only every fourth completed monster-party step and never faints", () => {
    // Break: field movement had no persistent poison cadence or save-carried modulo counter.
    const project = lifecycleProject();
    project.system.battleParty = "monsters";
    const { instance, session } = instanceAtLevel(project, 1);
    session.monsterInstances[instance.instanceId] = {
      ...instance,
      currentHp: 3,
      stateIds: ["state_poison"],
    };

    for (let step = 0; step < 3; step += 1) applyGen1FieldPoisonStep(project, session);
    expect(session.monsterInstances[instance.instanceId]!.currentHp).toBe(3);
    expect(session.monsterFieldPoisonSteps).toBe(3);

    const storage = new MemoryStorage();
    storage.setItem(saveSlotKey(1), JSON.stringify(createSaveSnapshot(project, session)));
    const read = readSaveSlot(storage, 1);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") return;
    const restored = applySaveSnapshot(project, read.snapshot);
    expect(restored.monsterFieldPoisonSteps).toBe(3);
    expect(applyGen1FieldPoisonStep(project, restored)).toEqual({ ticked: true, damagedInstanceIds: [instance.instanceId] });
    expect(restored.monsterInstances[instance.instanceId]!.currentHp).toBe(2);
    expect(restored.monsterFieldPoisonSteps).toBe(0);

    for (let step = 0; step < 8; step += 1) applyGen1FieldPoisonStep(project, restored);
    expect(restored.monsterInstances[instance.instanceId]!.currentHp).toBe(1);

    delete project.system.battleParty;
    applyGen1FieldPoisonStep(project, restored);
    expect(restored.monsterFieldPoisonSteps).toBe(0);
    expect(restored.monsterInstances[instance.instanceId]!.currentHp).toBe(1);
  });

  it("rejects a malformed field-poison step counter in a parsed save", () => {
    const project = lifecycleProject();
    const { session } = instanceAtLevel(project, 1);
    const malformed = structuredClone(createSaveSnapshot(project, session)) as ReturnType<typeof createSaveSnapshot>
      & { session: { monsterFieldPoisonSteps: number } };
    malformed.session.monsterFieldPoisonSteps = -1;
    const storage = new MemoryStorage();
    storage.setItem(saveSlotKey(1), JSON.stringify(malformed));

    expect(readSaveSlot(storage, 1).kind).toBe("corrupt");
  });

  it("rejects malformed negative monster PP and state turns in parsed saves", () => {
    // Break: new nested monster fields previously bypassed save-slot validation.
    const project = lifecycleProject();
    const { instance, session } = instanceAtLevel(project, 1);
    const snapshot = createSaveSnapshot(project, session);
    const malformed = structuredClone(snapshot) as typeof snapshot & {
      session: { monsterInstances: Record<string, Record<string, unknown>> };
    };
    malformed.session.monsterInstances[instance.instanceId]!.skillPp = { move_1: -1 };
    malformed.session.monsterInstances[instance.instanceId]!.stateTurns = { state_poison: -2 };
    const storage = new MemoryStorage();
    storage.setItem(saveSlotKey(1), JSON.stringify(malformed));

    expect(readSaveSlot(storage, 1).kind).toBe("corrupt");
  });
});
