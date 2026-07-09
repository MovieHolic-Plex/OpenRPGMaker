/** @vitest-environment happy-dom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import { mountBattleScene } from "@/player/battleDom";
import { syncBattleAnimationLayer } from "@/player/battleAnimationDom";
import { store } from "@/project/store";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { prepareReferenceBattleProject } from "./e2e/battleReferenceProject";

function battleRuntime() {
  return createBattleRuntime({
    project: deserialize(JSON.stringify(battleFixture)),
    troopId: "troop_slime",
    canEscape: true,
    canLose: true,
    rng: () => 0.5,
  });
}

function untilActorCommand(runtime: ReturnType<typeof createBattleRuntime>, maxTicks = 40): void {
  for (let i = 0; i < maxTicks; i += 1) {
    runtime.tick(1_000);
    if (runtime.snapshot().phase === "actorCommand" || runtime.snapshot().result) return;
  }
}

describe("battle dom incremental rendering", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    store.replace(deserialize(JSON.stringify(battleFixture)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the field node across charging ticks", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.append(host);
    const runtime = battleRuntime();
    const controller = mountBattleScene({
      host,
      runtime,
      onResult: () => undefined,
      introHold: false,
    });
    const field = controller.root.querySelector("[data-testid='battle-field']");
    expect(field).toBeTruthy();

    vi.advanceTimersByTime(450);
    expect(controller.root.querySelector("[data-testid='battle-field']")).toBe(field);
    controller.destroy();
  });

  it("retains animation playback across sync calls when animation key is unchanged", () => {
    const runtime = battleRuntime();
    untilActorCommand(runtime);
    runtime.performActorCommand({ kind: "skill", skillId: "skill_fire", targetEnemyId: "enemy-1" });
    const snapshot = runtime.snapshot();

    const scene = document.createElement("section");
    scene.className = "battle-scene";
    const layer = document.createElement("div");
    layer.className = "battle-animation-layer";
    scene.append(layer);

    const first = syncBattleAnimationLayer(layer, snapshot, scene);
    const firstNode = first?.element;
    expect(firstNode).toBeTruthy();

    const second = syncBattleAnimationLayer(layer, snapshot, scene);
    expect(second?.element).toBe(firstNode);
    expect(layer.querySelectorAll("[data-testid='battle-animation']")).toHaveLength(1);
  });

  it("updates enemy hp in the field after confirming a target", () => {
    vi.useFakeTimers();
    const project = deserialize(JSON.stringify(battleFixture));
    prepareReferenceBattleProject(project);
    store.replace(project);
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      rng: () => 0.42,
    });
    const host = document.createElement("div");
    document.body.append(host);
    const controller = mountBattleScene({
      host,
      runtime,
      onResult: () => undefined,
      introHold: false,
    });
    for (let index = 0; index < 80; index += 1) {
      vi.advanceTimersByTime(200);
      if (runtime.snapshot().phase === "actorCommand") break;
    }
    const readHp = () => controller.root.querySelector("[data-testid='battle-enemy-hp-enemy-1']")?.textContent;
    expect(readHp()).toBe("220/220");
    controller.root.querySelector<HTMLElement>("[data-testid='actor-command-attack']")?.click();
    controller.root.querySelector<HTMLElement>("[data-testid='battle-target-enemy-1']")?.click();
    vi.advanceTimersByTime(50);
    expect(readHp()).not.toBe("220/220");
    controller.destroy();
  });

  it("exposes enemy hp feedback selectors on the field", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.append(host);
    const runtime = battleRuntime();
    const controller = mountBattleScene({
      host,
      runtime,
      onResult: () => undefined,
      introHold: false,
    });
    expect(controller.root.querySelector("[data-testid='battle-enemy-hud-enemy-1']")).toBeTruthy();
    expect(controller.root.querySelector("[data-testid='battle-enemy-list-hp-enemy-1']")?.textContent).toMatch(/HP/);
    controller.destroy();
  });
});