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
    // 합성 keydown 은 브라우저와 달리 네이티브 버튼 활성화를 일으키지 않는다 — 계약
    // ("포커스된 네이티브 버튼의 Enter 는 브라우저 클릭 경로에 한 번 맡긴다")대로
    // keydown 경로는 무반응이어야 하고, 브라우저가 쏠 클릭은 여기서 모사한다
    // (같은 파일의 "leaves native button Enter to one browser click" 관례와 동일).
    item?.click();

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

  // 적대 리뷰 2차 계약: 적 대상 선택도 하단 패널에 대상 메뉴를 유지한다(빈 밴드 금지).
  // 필드의 선택 링(브래킷)과 메뉴의 selected 표시가 같은 대상을 가리켜야 한다.
  it("keeps the bottom target menu and the field ring in sync during target select", () => {
    vi.useFakeTimers();
    const { runtime, controller } = setup();
    untilActorCommand(runtime);
    vi.advanceTimersByTime(250);

    controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-attack']")?.click();
    expect(runtime.snapshot().phase).toBe("targetSelect");
    expect(controller.root.querySelector("[data-testid='battle-target-prompt']")).toBeTruthy();
    const menu = controller.root.querySelector(".battle-target-menu");
    expect(menu).toBeTruthy();

    const selected = controller.root.querySelector<HTMLButtonElement>(".battle-enemy.battle-target-selected");
    expect(selected?.querySelector("[data-testid='battle-target-brackets']")).toBeTruthy();
    expect(selected?.querySelector(".battle-enemy-name")?.textContent).toBeTruthy();
    expect(selected?.querySelector(".battle-enemy-hud")).toBeTruthy();
    expect(document.activeElement).toBe(selected);
    const menuSelected = menu?.querySelector<HTMLButtonElement>("button.battle-target-selected");
    expect(menuSelected?.dataset.battleTargetId).toBe(selected?.dataset.testid);
    controller.destroy();
  });

});
// ── 실플레이 적대 리뷰 후속: gen1+RM 스킨의 죽은 공격 버튼 / 스크롤 큐 ──
import { createScarloxyPokemonDemoProject } from "@/project/defaults";

describe("gen1+RM dead-attack guard UI and scroll cue", () => {
  it("gen1 + gauge: 사용 가능한 기술이 있으면 통상 공격 버튼이 inert+사유로 렌더된다", () => {
    vi.useFakeTimers();
    const project = createScarloxyPokemonDemoProject();
    store.replace(project);
    const host = document.createElement("div");
    document.body.append(host);
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_pkmn_grass_a",
      canEscape: true,
      canLose: true,
      battleFlow: "gauge",
      rng: () => 0.5,
    });
    const controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold: false });
    untilActorCommand(runtime);
    vi.advanceTimersByTime(250);

    const attack = controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-attack']");
    expect(attack).toBeTruthy();
    expect(attack?.disabled).toBe(true);
    expect(attack?.dataset.previewOnly).toBe("true");
    expect(attack?.getAttribute("aria-label")).toContain("통상 공격을 쓸 수 없습니다");
    // 그리고 런타임도 같은 규칙으로 막는다 — 버튼이 아니라 계약이 정본이다.
    runtime.beginActorCommand({ kind: "attack" });
    expect(runtime.snapshot().phase).toBe("actorCommand");
    controller.destroy();
    vi.useRealTimers();
  });

  it("커맨드 메뉴에 스크롤 큐 요소가 붙는다(happy-dom 에는 레이아웃이 없어 표시 판정은 브라우저 QA 가 담당)", () => {
    vi.useFakeTimers();
    const { runtime, controller } = setup();
    untilActorCommand(runtime);
    vi.advanceTimersByTime(250);
    const menu = controller.root.querySelector("[data-testid='battle-command-grid']");
    expect(menu).toBeTruthy();
    expect(menu?.querySelector("[data-testid='battle-command-scroll-cue']")).toBeTruthy();
    controller.destroy();
    vi.useRealTimers();
  });
});
