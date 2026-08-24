import { describe, expect, it } from "vitest";
import type { BattleBattlerSnapshot } from "@/battle/types";
import { createBlankProject } from "@/project/defaults";
import {
  normalizeItemRecord,
  normalizeSkillRecord,
  normalizeStateRecord,
  normalizeTroopRecord,
} from "@/project/databaseRecordModel";
import { applyGenrePreset } from "@/project/genrePresets";
import { deserialize, serialize } from "@/project/io";
import { giveMonster } from "@/project/monsterCollection";
import { startSession, type MonsterInstance } from "@/project/session";
import { SCHEMA_VERSION } from "@/project/types";
import {
  applySaveSnapshot,
  createSaveSnapshot,
  readSaveSlot,
  saveToSlot,
} from "@/player/saveSlots";

class MemoryStorage implements Storage {
  private readonly entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }
}

describe("Gen1 authored project contracts", () => {
  it("normalizes PP, critical class, major status, trainer battle, and ball class", () => {
    const skill = normalizeSkillRecord({
      id: "skill_razor_leaf",
      name: "Razor Leaf",
      maxPp: 25,
      gen1CriticalRate: "high",
    });
    const state = normalizeStateRecord({
      id: "state_paralysis",
      name: "Paralysis",
      gen1MajorStatus: "paralysis",
    });
    const troop = normalizeTroopRecord({
      id: "troop_rival",
      name: "Rival",
      enemyIds: [],
      trainerBattle: true,
    });
    const item = normalizeItemRecord({
      id: "item_great_ball",
      name: "Great Ball",
      captureProfile: { multiplier: 1.5, ballClass: "great" },
    });

    expect(skill.maxPp).toBe(25);
    expect(skill.gen1CriticalRate).toBe("high");
    expect(state.gen1MajorStatus).toBe("paralysis");
    expect(troop.trainerBattle).toBe(true);
    expect(item.captureProfile).toEqual({ multiplier: 1.5, ballClass: "great" });
  });

  it("keeps legacy values compatible and omits invalid optional Gen1 metadata", () => {
    const legacySkill = normalizeSkillRecord({ id: "skill_old", name: "Old Move" });
    const invalidSkill = normalizeSkillRecord({
      id: "skill_invalid",
      name: "Invalid Move",
      maxPp: 0,
      gen1CriticalRate: "always",
    } as unknown as Parameters<typeof normalizeSkillRecord>[0]);
    const legacyItem = normalizeItemRecord({
      id: "item_old_ball",
      name: "Old Ball",
      captureProfile: { multiplier: 2 },
    });

    expect(legacySkill.maxPp).toBeUndefined();
    expect(legacySkill.gen1CriticalRate).toBeUndefined();
    expect(invalidSkill.maxPp).toBeUndefined();
    expect(invalidSkill.gen1CriticalRate).toBeUndefined();
    expect(legacyItem.captureProfile).toEqual({ multiplier: 2 });
  });

  it("roundtrips explicit Gen1 metadata without a schema-version bump", () => {
    const project = createBlankProject();
    const raw = JSON.parse(serialize(project));
    raw.database.skills[0].maxPp = 15;
    raw.database.skills[0].gen1CriticalRate = "high";
    raw.database.states[0].gen1MajorStatus = "poison";
    raw.database.troops[0].trainerBattle = true;
    raw.database.items[0].captureProfile = { multiplier: 2, ballClass: "ultra" };

    const restored = deserialize(JSON.stringify(raw));

    expect(SCHEMA_VERSION).toBe(3);
    expect(restored.database.skills[0]?.maxPp).toBe(15);
    expect(restored.database.skills[0]?.gen1CriticalRate).toBe("high");
    expect(restored.database.states[0]?.gen1MajorStatus).toBe("poison");
    expect(restored.database.troops[0]?.trainerBattle).toBe(true);
    expect(restored.database.items[0]?.captureProfile).toEqual({ multiplier: 2, ballClass: "ultra" });
    expect(deserialize(serialize(restored))).toEqual(restored);
  });

  it("makes the monster-collect preset select the canonical monster strict battle path", () => {
    const project = createBlankProject();

    applyGenrePreset(project, "monster-collect");

    expect(project.system.battleParty).toBe("monsters");
    expect(project.system.battleFlow).toBe("strict");
    expect(project.system.battleModel).toBe("gen1");
  });
});

describe("Gen1 monster persistence contracts", () => {
  it("roundtrips statuses, PP, and pending fifth moves through the save-slot loader", () => {
    const project = createBlankProject();
    const attack = project.database.skills.find((record) => record.id === "skill_attack");
    if (!attack) throw new Error("missing skill_attack");
    attack.maxPp = 35;
    const session = startSession(project, 17);
    const result = giveMonster(project, session, { speciesId: "species_wild_slime", level: 5 });
    if (!result.ok) throw new Error(`giveMonster failed: ${result.reason}`);
    const instanceId = result.instance.instanceId;
    session.monsterInstances[instanceId] = {
      ...result.instance,
      stateIds: ["state_poison"],
      stateTurns: { state_poison: 3 },
      skillPp: { skill_attack: 21 },
      pendingSkillIds: ["skill_fifth", "skill_sixth"],
    };
    const storage = new MemoryStorage();

    saveToSlot(storage, 1, createSaveSnapshot(project, session));
    const loaded = readSaveSlot(storage, 1);

    expect(loaded.kind).toBe("present");
    if (loaded.kind !== "present") return;
    const restored = applySaveSnapshot(project, loaded.snapshot);
    expect(restored.monsterInstances[instanceId]?.stateIds).toEqual(["state_poison"]);
    expect(restored.monsterInstances[instanceId]?.stateTurns).toEqual({ state_poison: 3 });
    expect(restored.monsterInstances[instanceId]?.skillPp).toEqual({ skill_attack: 21 });
    expect(restored.monsterInstances[instanceId]?.pendingSkillIds).toEqual(["skill_fifth", "skill_sixth"]);
  });

  it("accepts legacy monster instances with all new persistent fields omitted", () => {
    const project = createBlankProject();
    const session = startSession(project, 19);
    const result = giveMonster(project, session, { speciesId: "species_wild_slime", level: 4 });
    if (!result.ok) throw new Error(`giveMonster failed: ${result.reason}`);
    const storage = new MemoryStorage();

    saveToSlot(storage, 1, createSaveSnapshot(project, session));
    const loaded = readSaveSlot(storage, 1);

    expect(loaded.kind).toBe("present");
    if (loaded.kind !== "present") return;
    const restored = applySaveSnapshot(project, loaded.snapshot);
    const legacy = restored.monsterInstances[result.instance.instanceId];
    expect(legacy?.stateIds).toBeUndefined();
    expect(legacy?.stateTurns).toBeUndefined();
    expect(legacy?.skillPp).toBeUndefined();
    expect(legacy?.pendingSkillIds).toBeUndefined();
  });

  it("exposes per-skill PP on the immutable battle snapshot contract", () => {
    const snapshotContract: Pick<BattleBattlerSnapshot, "skillPp"> = {
      skillPp: { skill_attack: 7 },
    };
    const instanceContract: Pick<MonsterInstance, "pendingSkillIds"> = {
      pendingSkillIds: ["skill_fifth"],
    };

    expect(snapshotContract.skillPp).toEqual({ skill_attack: 7 });
    expect(instanceContract.pendingSkillIds).toEqual(["skill_fifth"]);
  });
});
