/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import { mountBattleScene } from "@/player/battleDom";
import { introDirectorState } from "@/player/battleDirectorDom";
import { store } from "@/project/store";
import battleFixture from "./fixtures/projects/battle-v3.json";
import "./battleOverhaulContracts.cases";

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

  it("party status rows expose name, vitals, HP/MP bars, and an accessible ATB label", () => {
    const { controller } = setup();
    const row = controller.root.querySelector(".battle-actor-status");
    expect(row?.querySelector(".battle-actor-name")).toBeTruthy();
    expect(row?.querySelector(".battle-actor-vitals")).toBeTruthy();
    expect(row?.querySelector(":scope > .battle-stat-bar-hp")).toBeTruthy();
    expect(row?.querySelector(":scope > .battle-stat-bar-mp")).toBeTruthy();
    expect(row?.querySelector(".battle-atb-label")?.getAttribute("aria-label")).toBe("ATB");
    expect(controller.root.querySelector(".battle-title")?.textContent).toBe("슬라임 무리");
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

  it("keeps arrow selection, visual cursor, DOM focus, and Enter confirmation on one command", () => {
    vi.useFakeTimers();
    const { runtime, controller } = setup();
    untilActorCommand(runtime);
    vi.advanceTimersByTime(250);

    const commands = [...controller.root.querySelectorAll<HTMLButtonElement>(
      "button.battle-command:not([data-preview-only='true'])",
    )];
    expect(commands.length).toBeGreaterThan(1);
    expect(commands[0]?.dataset.battleCommandCursor).toBe("true");
    expect(document.activeElement).toBe(commands[0]);

    commands[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(commands[1]?.dataset.battleCommandCursor).toBe("true");
    expect(commands[2]?.dataset.battleCommandCursor).toBeUndefined();
    expect(document.activeElement).toBe(commands[1]);

    const confirmed = vi.fn();
    commands[1]?.addEventListener("click", confirmed, { once: true });
    pressKey("Enter");
    expect(confirmed).toHaveBeenCalledTimes(1);
    controller.destroy();
  });

  it("handles a focused command Enter once when rendering replaces its event target", () => {
    vi.useFakeTimers();
    const { runtime, controller } = setup();
    untilActorCommand(runtime);
    vi.advanceTimersByTime(250);

    const item = controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-item']");
    expect(item?.dataset.previewOnly).not.toBe("true");
    item?.focus();
    item?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(runtime.snapshot().phase).toBe("actorCommand");
    expect(controller.root.querySelector("[data-testid='actor-command-back']")).toBeTruthy();
    expect(controller.root.querySelector<HTMLElement>("[data-battle-command-cursor='true']")?.dataset.testid)
      .toMatch(/^actor-item-/);
    controller.destroy();
  });

  it("restores the root command cursor when X closes a submenu", () => {
    vi.useFakeTimers();
    const { runtime, controller } = setup();
    untilActorCommand(runtime);
    vi.advanceTimersByTime(250);

    const item = controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-item']");
    expect(item?.dataset.previewOnly).not.toBe("true");
    item?.click();
    expect(controller.root.querySelector("[data-testid='actor-command-back']")).toBeTruthy();
    expect(controller.root.querySelector<HTMLElement>("[data-battle-command-cursor='true']")?.dataset.testid)
      .toMatch(/^actor-item-/);

    pressKey("x");
    const attack = controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-attack']");
    expect(attack?.dataset.battleCommandCursor).toBe("true");
    expect(document.activeElement).toBe(attack);
    controller.destroy();
  });

  it("uses the field ring, name, and HP as the target signal without duplicate prompt or list", () => {
    vi.useFakeTimers();
    const { runtime, controller } = setup();
    untilActorCommand(runtime);
    vi.advanceTimersByTime(250);

    controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-attack']")?.click();
    expect(runtime.snapshot().phase).toBe("targetSelect");
    expect(controller.root.querySelector("[data-testid='battle-target-prompt']")).toBeNull();
    expect(controller.root.querySelector(".battle-target-menu")).toBeNull();

    const selected = controller.root.querySelector<HTMLButtonElement>(".battle-enemy.battle-target-selected");
    expect(selected?.querySelector("[data-testid='battle-target-brackets']")).toBeTruthy();
    expect(selected?.querySelector(".battle-enemy-name")?.textContent).toBeTruthy();
    expect(selected?.querySelector(".battle-enemy-hud")).toBeTruthy();
    expect(document.activeElement).toBe(selected);
    const message = controller.root.querySelector("[data-testid='battle-message-window']")?.textContent ?? "";
    expect(message).not.toContain(selected?.querySelector(".battle-enemy-name")?.textContent ?? "__missing__");
    expect(message).not.toContain("겨냥");
    controller.destroy();
  });

});