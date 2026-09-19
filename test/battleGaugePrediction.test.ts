import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { chargingDirectorState } from "@/player/battleDirectorDom";
import { deserialize } from "@/project/io";
import fixture from "./fixtures/projects/battle-v3.json";

describe("gauge director prediction follows the runtime scheduler", () => {
  it("announces a faster enemy even when both gauges are zero", () => {
    const project = deserialize(JSON.stringify(fixture));
    const hero = project.database.actors.find((actor) => actor.id === "actor_hero")!;
    hero.parameterCurves.agility = Array(99).fill(1);
    hero.initialEquipment = {};
    const enemy = project.database.enemies.find((entry) => entry.id === "enemy_slime")!;
    enemy.stats.agility = 999;
    enemy.stats.attack = 1;
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", battleFlow: "gauge", canEscape: true, canLose: true, rng: () => 0.5 });
    const before = runtime.snapshot();
    expect(before.nextReadyBattlerId).toBe("enemy-1");
    expect(chargingDirectorState(before).lines[1]).toContain(enemy.name);
    runtime.tick(10_000);
    expect(runtime.snapshot().actionLog[0]?.side).toBe("enemy");
    runtime.cancel();
  });

  it("does not invent a next actor when an old snapshot has no prediction", () => {
    const project = deserialize(JSON.stringify(fixture));
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", battleFlow: "gauge", canEscape: true, canLose: true });
    expect(chargingDirectorState({ ...runtime.snapshot(), nextReadyBattlerId: undefined }).lines[1]).toBe("전황이 전개되고 있습니다.");
    runtime.cancel();
  });
});
