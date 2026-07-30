import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { simulateBattle } from "@/battle/simulate";
import { DB_TOOLS } from "@/editor/tools/dbTools";
import { createBlankProject } from "@/project/defaults";
import { normalizeSkillRecord } from "@/project/databaseRecordModel";
import { captureSuccessRate, deterministicMonsterIvs, giveMonster } from "@/project/monsterCollection";
import { startSession } from "@/project/session";
import { createInterpreter } from "@/player/interpreter";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey } from "@/player/saveSlots";
import type { Command, Project } from "@/project/types";

class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function monsterProject(): Project {
  const project = createBlankProject();
  project.system.monsterCollection = true;
  project.session.inventory.item_capture_orb = 3;
  return project;
}

function captureRuntime(project: Project, rng: () => number = () => 0): ReturnType<typeof createBattleRuntime> {
  return createBattleRuntime({
    project,
    troopId: "troop_slime",
    canEscape: false,
    canLose: true,
    battleFlow: "strict",
    sessionState: { switches: {}, variables: {}, inventory: { item_capture_orb: 3 } },
    captureLocation: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
    rng,
  });
}

describe("monster collection core", () => {
  it("ships demo starter species and wild slime species fixture", () => {
    const ids = new Set((createBlankProject().database.monsterSpecies ?? []).map((species) => species.id));
    expect(ids.has("species_leafling")).toBe(true);
    expect(ids.has("species_sparkit")).toBe(true);
    expect(ids.has("species_aqualing")).toBe(true);
    expect(ids.has("species_wild_slime")).toBe(true);
  });

  it("calculates capture formula boundaries and item multiplier", () => {
    expect(captureSuccessRate(0.5, 100, 100, 1)).toBeCloseTo(0.15);
    expect(captureSuccessRate(0.5, 1, 100, 1)).toBeCloseTo(0.4965);
    expect(captureSuccessRate(0.5, 100, 100, 3)).toBeCloseTo(0.45);
    expect(captureSuccessRate(1, 1, 100, 10)).toBe(1);
  });

  it("creates deterministic IVs and routes party overflow to box", () => {
    const project = monsterProject();
    const first = startSession(project, 77);
    const second = startSession(project, 77);
    const firstResult = giveMonster(project, first, { speciesId: "species_wild_slime", level: 5 });
    const secondResult = giveMonster(project, second, { speciesId: "species_wild_slime", level: 5 });
    expect(firstResult.ok && firstResult.instance.ivs).toEqual(secondResult.ok && secondResult.instance.ivs);
    expect(deterministicMonsterIvs("fixed")).toEqual(deterministicMonsterIvs("fixed"));

    for (let index = 0; index < 6; index += 1) {
      giveMonster(project, first, { speciesId: "species_wild_slime", level: 2 });
    }
    expect(first.monsterParty).toHaveLength(6);
    expect(first.monsterBox).toHaveLength(1);
  });

  it("roundtrips saves and accepts legacy saves without monster fields", () => {
    const project = monsterProject();
    const session = startSession(project, 12);
    giveMonster(project, session, { speciesId: "species_wild_slime", level: 3, nickname: "방울" });
    const snapshot = createSaveSnapshot(project, session);
    const restored = applySaveSnapshot(project, snapshot);
    expect(restored.monsterParty).toEqual(session.monsterParty);
    expect(restored.monsterInstances[session.monsterParty[0] ?? ""]?.nickname).toBe("방울");

    const legacy = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown> & { session: Record<string, unknown> };
    delete legacy.session.monsterInstances;
    delete legacy.session.monsterParty;
    delete legacy.session.monsterBox;
    const storage = new MemoryStorage();
    storage.setItem(saveSlotKey(1), JSON.stringify(legacy));
    const read = readSaveSlot(storage, 1);
    expect(read.kind).toBe("present");
    if (read.kind === "present") {
      const legacySession = applySaveSnapshot(project, read.snapshot);
      expect(legacySession.monsterInstances).toEqual({});
      expect(legacySession.monsterParty).toEqual([]);
      expect(legacySession.monsterBox).toEqual([]);
    }
  });

  it("blocks uncapturable troops and excludes captured enemies from EXP", () => {
    const project = monsterProject();
    const blocked = captureRuntime({ ...project, database: { ...project.database, troops: project.database.troops.map((troop) => troop.id === "troop_slime" ? { ...troop, uncapturable: true } : troop) } });
    blocked.performActorCommand({ kind: "capture", captureItemId: "item_capture_orb", targetEnemyId: "enemy-1" });
    expect(blocked.snapshot().lastCaptureResult?.blockedReason).toBe("uncapturable");
    expect(blocked.snapshot().timeline.some((entry) => entry.kind === "capture" && entry.success === false)).toBe(true);

    const runtime = captureRuntime(project, (() => {
      const values = [0, 0.1, 0.2, 0.3, 0.4];
      return () => values.shift() ?? 0;
    })());
    runtime.performActorCommand({ kind: "capture", captureItemId: "item_capture_orb", targetEnemyId: "enemy-1" });
    const snapshot = runtime.snapshot();
    expect(snapshot.result).toBe("victory");
    expect(snapshot.capturedMonsters).toHaveLength(1);
    expect(snapshot.timeline.some((entry) => entry.kind === "capture" && entry.success === true && entry.targetId === "enemy-1")).toBe(true);
    expect(snapshot.rewards.exp).toBe(0);
  });

  it("simulateBattle strict script captures a weakened slime and fails at full HP", () => {
    const successProject = monsterProject();
    const hero = successProject.database.actors[0];
    if (!hero) throw new Error("missing hero");
    hero.parameterCurves.attack = Array.from({ length: 99 }, () => 1);
    successProject.database.skills.push(normalizeSkillRecord({
      id: "skill_leave_one",
      name: "빈사 만들기",
      power: 120,
      mpCost: { flat: 0, percentMax: 0 },
      successRate: 100,
      hitRate: 100,
      variance: 0,
      effect: { kind: "damage", statistic: "attack", affects: "hp" },
    }));
    hero.learnedSkills = [{ level: 1, skillId: "skill_leave_one" }];
    const enemy = successProject.database.enemies.find((record) => record.id === "enemy_slime");
    if (!enemy) throw new Error("missing slime");
    enemy.stats = { ...enemy.stats, maxHp: 130, defense: 1, attack: 1 };
    const orb = successProject.database.items.find((item) => item.id === "item_capture_orb");
    if (orb) orb.captureProfile = { multiplier: 10 };
    const success = simulateBattle({
      project: successProject,
      troopId: "troop_slime",
      heroLevel: 1,
      battleFlow: "strict",
      inventory: { item_capture_orb: 1 },
      n: 1,
      seed: 1,
      strictScript: [
        [{ actorId: hero.id, command: "skill", skillId: "skill_leave_one", target: "enemy-1" }],
        [{ actorId: hero.id, command: "capture", captureItemId: "item_capture_orb", target: "enemy-1" }],
      ],
      maxSteps: 20,
    });
    expect(success.capturedCount).toBe(1);
    expect(success.capturedMonsters[0]?.speciesId).toBe("species_wild_slime");

    const failureProject = monsterProject();
    const failureSpecies = failureProject.database.monsterSpecies?.find((species) => species.id === "species_wild_slime");
    if (failureSpecies) failureSpecies.captureRate = 0;
    const failure = simulateBattle({
      project: failureProject,
      troopId: "troop_slime",
      heroLevel: 1,
      battleFlow: "strict",
      inventory: { item_capture_orb: 1 },
      n: 1,
      seed: 1,
      strictScript: [[{ actorId: failureProject.database.actors[0]?.id ?? "actor_hero", command: "capture", captureItemId: "item_capture_orb", target: "enemy-1" }]],
      maxSteps: 5,
    });
    expect(failure.capturedCount).toBe(0);
  });

  it("give_starter_monsters creates a three-choice event that gives one monster", () => {
    const project = monsterProject();
    const tool = DB_TOOLS.find((entry) => entry.name === "give_starter_monsters");
    if (!tool) throw new Error("missing give_starter_monsters");
    tool.run(project, { speciesIds: ["species_leafling", "species_sparkit", "species_aqualing"] });
    const event = project.maps[project.startMapId]?.events.find((entry) => entry.id === "ev_starter_monsters");
    const page = event?.pages?.[0];
    expect(page?.commands[0]?.kind).toBe("choices");
    const session = startSession(project, 5);
    const interpreter = createInterpreter(page?.commands as Command[], session, project, { currentEventId: event?.id });
    const choices = interpreter.start();
    expect(choices.kind).toBe("choices");
    const result = interpreter.resume(1);
    if (result.kind === "text") interpreter.resume(undefined);
    expect(session.monsterParty).toHaveLength(1);
    expect(session.monsterInstances[session.monsterParty[0] ?? ""]?.speciesId).toBe("species_sparkit");
  });
});
