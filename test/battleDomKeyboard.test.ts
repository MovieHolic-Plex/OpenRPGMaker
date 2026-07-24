/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import { mountBattleScene } from "@/player/battleDom";
import { introDirectorState } from "@/player/battleDirectorDom";
import { store } from "@/project/store";
import battleFixture from "./fixtures/projects/battle-v3.json";

function pressKey(key: string): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

function setup(troopId = "troop_slime") {
  const project = deserialize(JSON.stringify(battleFixture));
  store.replace(project);
  const host = document.createElement("div");
  document.body.append(host);
  const runtime = createBattleRuntime({
    project,
    troopId,
    canEscape: true,
    canLose: true,
    rng: () => 0.5,
  });
  const controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold: false });
  return { host, runtime, controller };
}

function untilActorCommand(runtime: ReturnType<typeof createBattleRuntime>): void {
  for (let index = 0; index < 200; index += 1) {
    runtime.tick(1_000);
    if (runtime.snapshot().phase === "actorCommand" || runtime.snapshot().result) return;
  }
}

describe("battle dom keyboard and status rows", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("intro director state announces the troop in the message window", () => {
    const { runtime, controller } = setup();
    const state = introDirectorState(runtime.snapshot());
    expect(state.step).toBe("intro");
    expect(state.lines.join(" ")).toContain("나타났다!");
    controller.destroy();
  });

  it("party status rows use head/bars structure with hp and mp bars and no atb letter label", () => {
    const { controller } = setup();
    const row = controller.root.querySelector(".battle-actor-status");
    expect(row?.querySelector(".battle-actor-status-head")).toBeTruthy();
    expect(row?.querySelector(".battle-actor-status-bars .battle-stat-bar-hp")).toBeTruthy();
    expect(row?.querySelector(".battle-actor-status-bars .battle-stat-bar-mp")).toBeTruthy();
    expect(row?.querySelector(".battle-atb-label")).toBeNull();
    expect(controller.root.querySelector(".battle-title")).toBeNull();
    controller.destroy();
  });

  it("escape cancels target selection back to the command phase", () => {
    vi.useFakeTimers();
    const { runtime, controller } = setup();
    untilActorCommand(runtime);
    vi.advanceTimersByTime(250);
    expect(runtime.snapshot().phase).toBe("actorCommand");
    controller.root.querySelector<HTMLElement>("[data-testid='actor-command-attack']")?.click();
    expect(runtime.snapshot().phase).toBe("targetSelect");
    pressKey("Escape");
    expect(runtime.snapshot().phase).toBe("actorCommand");
    controller.destroy();
  });

  it("arrow keys cycle the selected target", () => {
    vi.useFakeTimers();
    const project = deserialize(JSON.stringify(battleFixture));
    const troop = project.database.troops.find((entry) => entry.id === "troop_slime");
    troop!.enemyIds = ["enemy_slime", "enemy_slime"];
    troop!.members = [
      { enemyId: "enemy_slime", x: 80, y: 90, hidden: false },
      { enemyId: "enemy_slime", x: 120, y: 120, hidden: false },
    ];
    store.replace(project);
    const host = document.createElement("div");
    document.body.append(host);
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 });
    const controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold: false });
    untilActorCommand(runtime);
    vi.advanceTimersByTime(250);
    controller.root.querySelector<HTMLElement>("[data-testid='actor-command-attack']")?.click();
    const first = runtime.snapshot().targetSelection?.selectedEnemyId;
    pressKey("ArrowDown");
    const second = runtime.snapshot().targetSelection?.selectedEnemyId;
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
    pressKey("ArrowUp");
    expect(runtime.snapshot().targetSelection?.selectedEnemyId).toBe(first);
    controller.destroy();
  });
});
