import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import type { Project } from "@/project/types";
import { loadBattleFixture } from "./fixtures/battleFixtureLoadable";

// 「졸병을 다 쓰러뜨리면 보스 2막」 — enemiesAlive{enemyId?,atMost} 전투 조건(2026-10-24).
function setup(): Project {
  const p = loadBattleFixture();
  const slime = p.database.enemies.find((e) => e.id === "enemy_slime")!;
  slime.stats.maxHp = 1;
  slime.stats.defense = 0;
  slime.stats.agility = 1;
  // 픽스처 용은 공격 1000 — 시험 동안 아군이 버티도록 무디게 한다.
  const dragon = p.database.enemies.find((e) => e.id === "enemy_dragon")!;
  dragon.stats.attack = 1;
  dragon.stats.maxHp = 9999;
  const troop = p.database.troops.find((t) => t.id === "troop_slime")!;
  troop.enemyIds = ["enemy_slime", "enemy_dragon"];
  troop.members = [
    { enemyId: "enemy_slime", x: 40, y: 80, hidden: false },
    { enemyId: "enemy_dragon", x: 120, y: 80, hidden: false },
  ];
  troop.battleEventPages = [
    { id: "slimes_gone", name: "졸병 전멸", span: "battle", conditions: [{ kind: "enemiesAlive", enemyId: "enemy_slime", atMost: 0 }], commands: [] },
    { id: "two_left", name: "둘 이하", span: "battle", conditions: [{ kind: "enemiesAlive", atMost: 1 }], commands: [] },
  ];
  return p;
}

const fired = (runtime: ReturnType<typeof createBattleRuntime>) =>
  new Set(runtime.snapshot().eventLogs.filter((log) => log.kind === "fired").map((log) => log.pageId));

describe("battle condition enemiesAlive", () => {
  it("does not fire while the counted enemies are still alive", () => {
    const runtime = createBattleRuntime({ project: setup(), troopId: "troop_slime", canEscape: false, canLose: true });
    runtime.tick(1_000);
    expect(fired(runtime).has("slimes_gone")).toBe(false);
    expect(fired(runtime).has("two_left")).toBe(false);
  });

  it("fires once the filtered record count drops to atMost, while another enemy is still standing", () => {
    const runtime = createBattleRuntime({ project: setup(), troopId: "troop_slime", canEscape: false, canLose: true });
    for (let step = 0; step < 200 && !fired(runtime).has("slimes_gone"); step += 1) {
      const snap = runtime.snapshot();
      if (snap.result) break;
      const slime = snap.enemies.find((e) => e.recordId === "enemy_slime" && e.hp > 0);
      if (snap.phase === "actorCommand" && slime) runtime.performActorCommand({ kind: "attack", targetEnemyId: slime.id });
      else runtime.tick(1_000);
    }
    expect(fired(runtime).has("slimes_gone")).toBe(true);
    expect(fired(runtime).has("two_left")).toBe(true);
    expect(runtime.snapshot().enemies.some((e) => e.recordId === "enemy_dragon" && e.hp > 0)).toBe(true);
  });
});
