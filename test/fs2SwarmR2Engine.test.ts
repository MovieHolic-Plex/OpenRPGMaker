// fs2 스웜 R2 ultrabrain 판정(엔진): 적 피해 대상 추첨 · 전투 부활약 · 레벨 EXP 바닥.
import { describe, expect, it } from "vitest";
import { drawDamageTargetIndex } from "@/battle/enemyTargetDraw";
import { createBattleRuntime } from "@/battle/runtime";
import { floorActorExperience, normalizeActorRecord, totalExpForLevel } from "@/project/actorModel";
import { createBlankProject } from "@/project/defaults";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { itemAllowsBattle } from "@/project/itemUsage";
import { changeParty, startSession } from "@/project/session";
import { changeActorLevel } from "@/project/sessionActorCommands";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import type { ItemRecord } from "@/project/types";
import { mulberry32 } from "@/util/rng";

function counting(seed: number) {
  const inner = mulberry32(seed);
  const rng = () => { rng.calls += 1; return inner(); };
  rng.calls = 0;
  return rng;
}

describe("enemy damage target draw", () => {
  const tank = { score: 30, expected: 20, hp: 200 };
  const mage = { score: 32, expected: 22, hp: 150 };

  it("spreads hits instead of always picking the top score", () => {
    const rng = counting(7);
    const hits = [0, 0];
    for (let i = 0; i < 2000; i += 1) hits[drawDamageTargetIndex([tank, mage], rng)]! += 1;
    expect(hits[0]).toBeGreaterThan(600);
    expect(hits[1]).toBeGreaterThan(hits[0]!);
  });

  it("gives every candidate with expected damage at least a 15% share", () => {
    const weak = { score: 1, expected: 1, hp: 300 };
    const rng = counting(3);
    let weakHits = 0;
    for (let i = 0; i < 4000; i += 1) if (drawDamageTargetIndex([weak, mage], rng) === 0) weakHits += 1;
    expect(weakHits / 4000).toBeGreaterThan(0.12);
    expect(weakHits / 4000).toBeLessThan(0.18);
  });

  it("takes a lethal target deterministically and skips the rng for a single or lethal pick", () => {
    const rng = counting(1);
    const dying = { score: 1010, expected: 20, hp: 5 };
    expect(drawDamageTargetIndex([tank, dying, mage], rng)).toBe(1);
    expect(drawDamageTargetIndex([mage], rng)).toBe(0);
    expect(rng.calls).toBe(0);
  });
});

describe("revive items in battle", () => {
  const phoenix = { id: "phoenix", name: "피닉스", type: "medicine", occasion: "always", onlyEffectiveOnDeadActors: true,
    hpRecovery: { flat: 0, percentMax: 50 }, mpRecovery: { flat: 0, percentMax: 0 }, scope: "ally" } as unknown as ItemRecord;

  it("allows a battle/always revive item", () => {
    expect(itemAllowsBattle(phoenix)).toBe(true);
    expect(itemAllowsBattle({ ...phoenix, occasion: "menu" } as ItemRecord)).toBe(false);
  });

  it("offers only downed allies as targets", () => {
    const project = createBlankProject();
    for (const enemy of project.database.enemies) enemy.stats.agility = 1;
    const base = project.database.actors[0]!;
    project.database.actors.push({ ...base, id: "actor_second", name: "둘째" });
    project.database.items.push(normalizeItemRecord({ ...phoenix, consumable: true } as never));
    const session = startSession(project);
    changeParty(session, "actor_second", "add", project);
    session.actorVitals.actor_second = { ...session.actorVitals.actor_second!, hp: 0 };
    session.inventory.phoenix = 2;
    const runtime = createBattleRuntime({ project, troopId: project.database.troops[0]!.id, sessionState: session, canEscape: true, canLose: true, rng: () => 0.5,
      party: { levels: session.actorLevels, experience: session.actorExperience, vitals: session.actorVitals, partyActorIds: session.partyActorIds } });
    try {
      for (let i = 0; i < 200 && runtime.snapshot().phase !== "actorCommand"; i++) runtime.tick(100);
      expect(runtime.snapshot().phase).toBe("actorCommand");
      runtime.beginActorCommand({ kind: "item", itemId: "phoenix" });
      const downed = runtime.snapshot().actors.find((actor) => actor.recordId === "actor_second")!;
      const selection = runtime.snapshot().targetSelection;
      if (selection) {
        expect(selection.targetIds).toEqual([downed.id]);
        runtime.selectTarget(downed.id);
      }
      expect(runtime.snapshot().actors.find((actor) => actor.recordId === "actor_second")!.hp).toBeGreaterThan(0);
    } finally { runtime.cancel(); }
  });
});

describe("EXP follows the level floor", () => {
  function floorOf(project: ReturnType<typeof createBlankProject>, actorId: string, level: number) {
    return totalExpForLevel(normalizeActorRecord(project.database.actors.find((a) => a.id === actorId)!).expCurve, level);
  }

  it("starts, levels and joins at the level floor", () => {
    const project = createBlankProject();
    const actorId = project.startState?.partyActorIds?.[0] ?? project.database.actors[0]!.id;
    project.database.actors = project.database.actors.map((a) => (a.id === actorId ? { ...a, initialLevel: 14 } : a));
    const session = startSession(project);
    expect(session.actorExperience[actorId]).toBe(floorOf(project, actorId, 14));
    changeActorLevel(session, { kind: "changeLevel", actorId, op: "=", amount: 20 } as never, project);
    expect(session.actorExperience[actorId]).toBe(floorOf(project, actorId, 20));
    const second = { ...project.database.actors[0]!, id: "actor_join", initialLevel: 9 };
    project.database.actors.push(second);
    changeParty(session, "actor_join", "add", project);
    expect(session.actorExperience.actor_join).toBe(floorOf(project, "actor_join", 9));
  });

  it("raises an old save's zero EXP to the floor on load but never lowers it", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const actorId = session.partyActorIds[0]!;
    session.actorLevels[actorId] = 12;
    session.actorExperience[actorId] = 0;
    const loaded = applySaveSnapshot(project, createSaveSnapshot(project, session));
    expect(loaded.actorExperience[actorId]).toBe(floorOf(project, actorId, 12));
    const rich = { actorLevels: { [actorId]: 12 }, actorExperience: { [actorId]: 999_999 } };
    floorActorExperience(project, rich, actorId);
    expect(rich.actorExperience[actorId]).toBe(999_999);
  });
});
