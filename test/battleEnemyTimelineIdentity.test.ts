import { describe, expect, it } from "vitest";
import { createBattleRuntime, headlessBattleSnapshot } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import type { Project } from "@/project/types";
import strictFixture from "./fixtures/projects/battle-strict-v3.json";

function strictProject(): Project {
  return deserialize(JSON.stringify(strictFixture));
}

function twinTroopProject(): Project {
  const project = strictProject();
  const troop = project.database.troops.find((record) => record.id === "troop_strict_training");
  if (!troop) throw new Error("missing troop_strict_training");
  troop.battleFlow = "gauge";
  troop.enemyIds = ["enemy_training_slime", "enemy_training_slime"];
  troop.members = [
    { enemyId: "enemy_training_slime", x: 160, y: 112 },
    { enemyId: "enemy_training_slime", x: 260, y: 112 },
  ];
  const enemy = project.database.enemies.find((record) => record.id === "enemy_training_slime");
  if (enemy) enemy.stats = { ...enemy.stats, maxHp: 999, attack: 1, agility: 20 };
  for (const actorId of ["actor_warrior", "actor_mage"]) {
    const actor = project.database.actors.find((record) => record.id === actorId);
    if (actor) actor.parameterCurves.maxHp = Array.from({ length: 99 }, () => 9999);
  }
  return project;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("enemy timeline carries the acting instance", () => {
  it("gives two same-species enemies distinct userId values on their own attack entries", () => {
    const project = twinTroopProject();
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_strict_training",
      canEscape: false,
      canLose: true,
      rng: mulberry32(4242),
      party: { levels: { actor_warrior: 20, actor_mage: 20 }, experience: {}, partyActorIds: ["actor_warrior", "actor_mage"] },
      sessionState: { switches: {}, variables: {}, inventory: {} },
      captureLocation: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
    });

    for (let guard = 0; guard < 4000; guard += 1) {
      const snapshot = headlessBattleSnapshot(runtime);
      if (snapshot.result || snapshot.phase === "resolved") break;
      if ((snapshot.phase === "actorCommand" || snapshot.phase === "targetSelect") && snapshot.activeActorId) {
        const living = snapshot.enemies.filter((enemy) => !enemy.defeated && enemy.hp > 0);
        if (!living.length) break;
        runtime.performActorCommand({ kind: "defend" });
      } else runtime.tick(1000);
    }

    const snapshot = headlessBattleSnapshot(runtime);
    const enemyIds = snapshot.enemies.map((enemy) => enemy.id);
    expect(enemyIds).toHaveLength(2);
    // 같은 종족이므로 recordId 는 하나뿐이다 — 이 값만으로는 연출이 둘을 구분할 수 없다.
    const recordIds = new Set(snapshot.enemies.map((enemy) => enemy.recordId));
    // 같은 종족 둘은 recordId 가 하나뿐이므로, 이 값만으로는 연출이 둘을 구분할 수 없다.
    expect(recordIds.size).toBe(1);

    const enemyActions = snapshot.timeline.filter((entry) => entry.side === "enemy" && entry.userId !== undefined);
    expect(enemyActions.length).toBeGreaterThan(0);
    const actors = new Set(enemyActions.map((entry) => entry.userId));
    expect([...actors].every((id) => enemyIds.includes(id!))).toBe(true);
    expect(actors.size).toBe(2);
  });
});
