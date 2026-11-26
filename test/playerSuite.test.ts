// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { createBattleRuntime, type BattleSnapshot } from "@/battle/runtime";
import { deserialize, serialize } from "@/project/io";
import { mountBattleScene } from "@/player/battleDom";
import { introDirectorState } from "@/player/battleDirectorDom";
import { store } from "@/project/store";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { battleField } from "@/player/battleFieldDom";
import { createBlankProject } from "@/project/defaults";
import { prepareWebExport } from "@/project/webExport";
import { BattlePlaybackClock } from "@/player/battlePlaybackClock";
import { clearBattleTimerScope, openBattleTimerScope } from "@/player/battleTimerScope";
import { createDialogueUI, dialogueSpeedDelayMs, isDialogueAdvanceKey, nameplateSpeaker, resolveDialogueSpeakerName, resolveDialogueText } from "@/player/dialogue";
import { dialoguePresentationProfile } from "@/player/dialoguePresentation";
import { isolateTimers } from "./mergedTeardown";
import { openLicenseDialog, PLAYER_CREDITS, withStoreCredits } from "@/player/titleLicenseNotice";
import type { Project } from "@/project/types";
import { installTouchListTap } from "@/player/touchListTap";
import "./battleOverhaulContracts.cases";

describe("playerSuite", () => {
  isolateTimers();
  describe("battleDomKeyboard", () => {
    isolateTimers();
    function pressKey(key: string): void {
      window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    }
    function setup(troopId = "troop_slime", tweak?: (project: ReturnType<typeof deserialize>) => void) {
      const project = deserialize(JSON.stringify(battleFixture));
      tweak?.(project);
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
    /**
     * 플레이어가 Shift 로 고른 배속은 다음 전투에 이어진다(battleDom 의 모듈 상태 chosenBattleSpeed, 75d78ab5f1).
     * 같은 파일의 앞 테스트가 Shift 를 눌러 두면 뒤 테스트가 1× 가 아닌 배속으로 시작하므로, 테스트마다 1× 로 되돌린다.
     */
    function resetChosenBattleSpeed(): void {
      vi.useFakeTimers();
      const { controller } = setup();
      const status = controller.root.querySelector("[data-testid='battle-playback-status']");
      for (let step = 0; step < 3 && !/Shift 1×$/.test(status?.textContent ?? ""); step += 1) {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", bubbles: true }));
        window.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift", bubbles: true }));
      }
      expect(status?.textContent).toMatch(/Shift 1×$/);
      controller.destroy();
      vi.useRealTimers();
      document.body.innerHTML = "";
    }
    describe("battle dom keyboard and status rows", () => {
      beforeEach(() => {
        document.body.innerHTML = "";
        resetChosenBattleSpeed();
      });

      it("shows keyboard AUTO/speed status and removes the host cover on teardown", () => {
        vi.useFakeTimers();
        const { host, controller } = setup();
        try {
          const status = controller.root.querySelector('[data-testid="battle-playback-status"]');
          expect(status?.textContent).toBe("F 자동 꺼짐 · Shift 1×");
          pressKey("Shift");
          window.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift", bubbles: true }));
          expect(status?.textContent).toBe("F 자동 꺼짐 · Shift 1.8×");
          pressKey("f");
          expect(status?.textContent).toContain("F 자동 켜짐");
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", repeat: true, bubbles: true }));
          expect(status?.textContent).toContain("F 자동 켜짐");
          expect(host.querySelector('.battle-stage')).toBeTruthy();
        } finally {
          controller.destroy();
          expect(host.querySelector('.battle-stage')).toBeNull();
          vi.useRealTimers();
        }
      });

      it("intro director state announces the troop in the message window", () => {
        const { runtime, controller } = setup();
        const state = introDirectorState(runtime.snapshot());
        expect(state.step).toBe("intro");
        expect(state.lines.join(" ")).toContain("나타났다!");
        controller.destroy();
      });

      it("announces trainer teams without calling their monsters wild", () => {
        const { runtime, controller } = setup();
        try {
          const project = store.getCurrent();
          const snapshot = runtime.snapshot();
          const troop = project.database.troops.find((entry) => entry.id === snapshot.troopId)!;
          store.replace({
            ...project,
            database: { ...project.database, troops: project.database.troops.map((entry) => entry.id === troop.id ? { ...entry, trainerBattle: true } : entry) },
          });
          const intro = introDirectorState(snapshot);
          expect(intro.lines.join(" ")).toContain(troop.name);
          expect(intro.lines.join(" ")).toContain("승부를 걸어왔다!");
          expect(intro.lines.join(" ")).not.toContain("야생의");
        } finally { controller.destroy(); }
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

      it("follows the cursor with the scroll port when the target list overflows", () => {
        vi.useFakeTimers();
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;
        const project = deserialize(JSON.stringify(battleFixture));
        const troop = project.database.troops.find((entry) => entry.id === "troop_slime");
        troop!.enemyIds = Array(6).fill("enemy_slime");
        troop!.members = Array.from({ length: 6 }, (_, index) => ({ enemyId: "enemy_slime", x: 40 + index * 24, y: 90 + index * 12, hidden: false }));
        store.replace(project);
        const host = document.createElement("div");
        document.body.append(host);
        const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 });
        const controller = mountBattleScene({ host, runtime, onResult: () => undefined, introHold: false });
        untilActorCommand(runtime);
        vi.advanceTimersByTime(250);
        controller.root.querySelector<HTMLElement>("[data-testid='actor-command-attack']")?.click();
        expect(runtime.snapshot().phase).toBe("targetSelect");
        scrollIntoView.mockClear();
        pressKey("ArrowDown");
        const followed = scrollIntoView.mock.instances.at(-1) as HTMLElement | undefined;
        expect(scrollIntoView).toHaveBeenCalled();
        expect(followed?.dataset.testid).toMatch(/^battle-target-/);
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

      it("reads the physical key while an IME reports Process", () => {
        vi.useFakeTimers();
        const { runtime, controller } = setup();
        untilActorCommand(runtime);
        vi.advanceTimersByTime(250);

        const status = controller.root.querySelector("[data-testid='battle-playback-status']");
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Process", code: "ShiftLeft", bubbles: true }));
        window.dispatchEvent(new KeyboardEvent("keyup", { key: "Process", code: "ShiftLeft", bubbles: true }));
        expect(status?.textContent).toContain("Shift 1.8×");

        const commands = [...controller.root.querySelectorAll<HTMLButtonElement>(
          "button.battle-command:not([data-preview-only='true'])",
        )];
        expect(commands[0]?.dataset.battleCommandCursor).toBe("true");
        commands[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "가", isComposing: true, bubbles: true }));
        expect(commands[0]?.dataset.battleCommandCursor).toBe("true");

        const field = document.createElement("input");
        controller.root.append(field);
        const stolen = vi.fn();
        commands[1]?.addEventListener("click", stolen);
        field.dispatchEvent(new KeyboardEvent("keydown", { key: "Process", code: "KeyZ", bubbles: true }));
        expect(stolen).not.toHaveBeenCalled();
        field.remove();

        commands[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Process", code: "ArrowDown", bubbles: true }));
        expect(commands[1]?.dataset.battleCommandCursor).toBe("true");
        const confirmed = vi.fn();
        commands[1]?.addEventListener("click", confirmed, { once: true });
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Process", code: "KeyZ", bubbles: true }));
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

      it("reopens a submenu on its first usable row after it was closed from the back row", () => {
        // fs2 스웜 N01: 「뒤로」로 닫으면 다시 열 때 커서가 「뒤로」에 서서, 확인키 두 번이 닫히지 않는 목록처럼 보였다.
        vi.useFakeTimers();
        const { runtime, controller } = setup();
        untilActorCommand(runtime);
        vi.advanceTimersByTime(250);
        const cursor = () => controller.root.querySelector<HTMLElement>("[data-battle-command-cursor='true']")?.dataset.testid;

        controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-item']")?.click();
        const firstRow = cursor();
        expect(firstRow).toMatch(/^actor-item-/);
        const back = controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-back']")!;
        back.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        expect(cursor()).toBe("actor-command-back");
        pressKey("z");
        expect(controller.root.querySelector("[data-testid='actor-command-back']")).toBeNull();

        controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-item']")?.click();
        expect(controller.root.querySelector("[data-testid='actor-command-back']")).toBeTruthy();
        expect(cursor()).toBe(firstRow);
        controller.destroy();
      });

      it("keeps the cursor on the back row after ArrowUp from the first row while the panel re-syncs", () => {
        // battle-skill-nav: 목록 맨 위에서 ↑ 로 「뒤로」에 서도, 매 틱 같은 패널을 다시 표시하는 markMenuCursor 가
        // 「뒤로」를 복원하지 않아 커서가 첫 행으로 튕겼다 — ↑ 가 먹지 않거나, 한 번 더 누르면 맨 아래로 감겼다.
        vi.useFakeTimers();
        const { runtime, controller } = setup();
        untilActorCommand(runtime);
        vi.advanceTimersByTime(250);
        const cursor = () => controller.root.querySelector<HTMLElement>("[data-battle-command-cursor='true']")?.dataset.testid;

        controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-item']")?.click();
        expect(cursor()).toMatch(/^actor-item-/);
        pressKey("ArrowUp");
        expect(cursor()).toBe("actor-command-back");
        vi.advanceTimersByTime(1_000);
        expect(cursor()).toBe("actor-command-back");
        controller.destroy();
      });

      it("does not reopen an ally target menu on the cancel row after cancelling from it", () => {
        // ultrabrain #4216 후속: 「뒤로」 역할(data-command-icon=back)은 목록 뒤로와 대상 취소 모두 복원하지 않는다.
        vi.useFakeTimers();
        const { runtime, controller } = setup("troop_slime", (project) => {
          project.database.items = project.database.items.map((item) => ({ ...item, scope: "ally" as never, type: "medicine" as never, occasion: "always" as never,
            hpRecovery: { flat: 10, percentMax: 0 }, effects: [] as never }));
        });
        untilActorCommand(runtime);
        vi.advanceTimersByTime(250);
        const cursor = () => controller.root.querySelector<HTMLElement>("[data-battle-command-cursor='true']")?.dataset.testid;
        controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-item']")?.click();
        const itemRow = cursor()!;
        controller.root.querySelector<HTMLButtonElement>(`[data-testid='${itemRow}']`)?.click();
        expect(runtime.snapshot().phase).toBe("targetSelect");
        expect(runtime.snapshot().targetSelection?.side).toBe("actor");
        const cancel = controller.root.querySelector<HTMLButtonElement>("[data-testid='battle-target-cancel']")!;
        cancel.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        expect(cursor()).toBe("battle-target-cancel");
        cancel.click();
        expect(runtime.snapshot().phase).toBe("actorCommand");

        if (!controller.root.querySelector(`[data-testid='${itemRow}']`)) controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-item']")?.click();
        controller.root.querySelector<HTMLButtonElement>(`[data-testid='${itemRow}']`)?.click();
        expect(runtime.snapshot().phase).toBe("targetSelect");
        expect(cursor()).not.toBe("battle-target-cancel");
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

      it("reads battle menu keys from the physical code while an IME is active", () => {
        vi.useFakeTimers();
        const { runtime, controller } = setup();
        untilActorCommand(runtime);
        vi.advanceTimersByTime(250);

        const commands = [...controller.root.querySelectorAll<HTMLButtonElement>(
          "button.battle-command:not([data-preview-only='true'])",
        )];
        expect(commands[0]?.dataset.battleCommandCursor).toBe("true");
        const ime = (code: string, init: KeyboardEventInit = {}, type: "keydown" | "keyup" = "keydown") => {
          window.dispatchEvent(new KeyboardEvent(type, { key: "Process", code, bubbles: true, cancelable: true, ...init }));
        };

        window.dispatchEvent(new KeyboardEvent("keydown", { key: "가", isComposing: true, bubbles: true, cancelable: true }));
        expect(commands[0]?.dataset.battleCommandCursor).toBe("true");

        ime("ArrowDown");
        expect(commands[1]?.dataset.battleCommandCursor).toBe("true");
        expect(commands[0]?.dataset.battleCommandCursor).toBeUndefined();

        const status = controller.root.querySelector("[data-testid='battle-playback-status']");

        const rootCursorId = controller.root.querySelector<HTMLElement>("[data-battle-command-cursor='true']")?.dataset.testid;
        expect(rootCursorId).toBe(commands[1]?.dataset.testid);
        controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-item']")?.click();
        expect(controller.root.querySelector("[data-testid='actor-command-back']")).toBeTruthy();
        ime("KeyX");
        // 목록을 닫으면 커서는 열기 전에 서 있던 루트 행으로 돌아온다(bcd30259ce 「submenu back cursor」).
        expect(controller.root.querySelector<HTMLElement>("[data-battle-command-cursor='true']")?.dataset.testid).toBe(rootCursorId);
        ime("ArrowUp");
        expect(controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-attack']")?.dataset.battleCommandCursor).toBe("true");

        const confirmed = vi.fn();
        controller.root.querySelector<HTMLButtonElement>("[data-testid='actor-command-attack']")?.addEventListener("click", confirmed, { once: true });
        ime("KeyZ");
        expect(confirmed).toHaveBeenCalledTimes(1);

        // 자동 전투를 켜면 명령 카드가 스스로 행동을 고르므로(toggleAutoBattle → checkAutoBattleStep) F·Shift 확인은 메뉴 키 단계 뒤에 한다.
        // Shift 를 먼저 눌러 1.8× 로 올려 두면 AUTO 가 배속을 건드리지 않는다.
        ime("ShiftLeft");
        ime("ShiftLeft", {}, "keyup");
        expect(status?.textContent).toContain("Shift 1.8×");
        ime("KeyF");
        expect(status?.textContent).toContain("F 자동 켜짐");
        expect(status?.textContent).toContain("Shift 1.8×");
        controller.destroy();
      });

    });
    // ── 실플레이 적대 리뷰 후속: gen1+RM 스킨의 죽은 공격 버튼 / 스크롤 큐 ──
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
        // `disabled` 가 아니라 `aria-disabled` — 커서가 서서 사유를 읽히게 한다(적대 리뷰 #3).
        expect(attack?.disabled).toBe(false);
        expect(attack?.getAttribute("aria-disabled")).toBe("true");
        expect(attack?.dataset.previewOnly).toBe("true");
        expect(attack?.getAttribute("aria-label")).toContain("통상 공격을 쓸 수 없습니다");
        // 루트 명령의 긴 사유(> ROOT_INLINE_REASON_MAX)는 버튼 안 줄이 아니라 커서가 설 때 질문 줄에 보인다(09c3fd1fba).
        expect(attack?.dataset.battleCommandInertReason).toContain("통상 공격을 쓸 수 없습니다");
        expect(attack?.querySelector(".battle-command-reason")).toBeNull();
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
  });
  describe("monsterBackSprite", () => {
    isolateTimers();
    // 옛 AI 씨앗 그림 id 는 deprecated/ 로 옮긴 뒤에도 저장본 호환 별칭으로 남아 Scarloxy 뒷모습을 가리킨다.
    const BACK = "generated-enemy-reference-seed-back";
    const BACK_PATH = "assets/scarloxy/scarloxy-monster-mossling.png";
    function projectWithBack() {
      const project = createBlankProject();
      project.system.battleUiStyle = "pokemon";
      project.database.monsterSpecies![0]!.graphic.backResourceId = BACK;
      return project;
    }
    describe("authored monster rear battle sprite", () => {
      it("survives save/load and ships the referenced image", () => {
        const loaded = deserialize(serialize(projectWithBack()));
        expect(loaded.database.monsterSpecies![0]!.graphic.backResourceId).toBe(BACK);
        const exported = prepareWebExport(loaded);
        expect(exported.assets.some(asset => asset.zipPath === BACK_PATH)).toBe(true);
        expect(deserialize(exported.projectJson).database.monsterSpecies![0]!.graphic.backResourceId).toBe(BACK);
      });

      it("rejects a missing rear resource rather than accepting a broken saved reference", () => {
        const project = projectWithBack();
        project.database.monsterSpecies![0]!.graphic.backResourceId = "missing-rear-sprite";
        expect(() => deserialize(serialize(project))).toThrow(/backResourceId/);
      });

      it.each([true, false])("renders the rear image when configured (%s), otherwise keeps the front fallback", (hasBack) => {
        const project = projectWithBack();
        const species = project.database.monsterSpecies![0]!;
        if (!hasBack) delete species.graphic.backResourceId;
        store.replace(project);
        const runtime = createBattleRuntime({ project, troopId: project.database.troops[0]!.id, canEscape: true, canLose: true, rng: () => 0.5 });
        const snapshot = runtime.snapshot();
        const withMonster: BattleSnapshot = { ...snapshot, actors: snapshot.actors.map((actor, i) => i === 0 ? { ...actor, speciesId: species.id } : actor) };
        const image = battleField(withMonster).querySelector<HTMLImageElement>(".battle-monster-image");
        expect(image).not.toBeNull();
        expect(image!.classList.contains("battle-monster-authored-back")).toBe(hasBack);
        if (hasBack) expect(image!.getAttribute("src")).toBe(`/${BACK_PATH}`);
        else expect(image!.getAttribute("src")).not.toBe(`/${BACK_PATH}`);
      });
    });
  });
  describe("battlePlaybackClock", () => {
    isolateTimers();
    describe("battle presentation clock", () => {
      beforeEach(() => { vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }); openBattleTimerScope(); });
      afterEach(() => { clearBattleTimerScope(); vi.useRealTimers(); });

      it("holds a remaining interval across repeated pause/resume and delivers once", () => {
        const clock = new BattlePlaybackClock(), cue = vi.fn();
        clock.schedule(cue, 100);
        vi.advanceTimersByTime(40);
        clock.pause(); clock.pause();
        vi.advanceTimersByTime(500);
        expect(cue).not.toHaveBeenCalled();
        clock.resume(); clock.resume();
        vi.advanceTimersByTime(59);
        expect(cue).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(cue).toHaveBeenCalledTimes(1);
        clock.dispose();
      });

      it("queues cues created during a hold and preserves their order", () => {
        const clock = new BattlePlaybackClock(), calls: string[] = [];
        clock.pause();
        clock.schedule(() => calls.push("contact"), 0);
        clock.schedule(() => calls.push("recovery"), 30);
        vi.advanceTimersByTime(300);
        expect(calls).toEqual([]);
        clock.resume(); vi.advanceTimersByTime(30);
        expect(calls).toEqual(["contact", "recovery"]);
        clock.dispose();
      });

      it("dispatches the contact cue within one frame before freezing later cues", () => {
        const clock = new BattlePlaybackClock(), calls: string[] = [];
        clock.schedule(() => calls.push("impact sound"), 100);
        clock.schedule(() => calls.push("tail"), 180);
        vi.advanceTimersByTime(90); clock.pause(16);
        expect(calls).toEqual(["impact sound"]);
        vi.advanceTimersByTime(500);
        expect(calls).toEqual(["impact sound"]);
        clock.resume(); vi.advanceTimersByTime(90);
        expect(calls).toEqual(["impact sound", "tail"]);
        clock.dispose();
      });

      it("never resumes disposed playback or fires its pending removal/sound callbacks", () => {
        const clock = new BattlePlaybackClock(), cue = vi.fn();
        clock.schedule(cue, 40); clock.pause(); clock.dispose(); clock.resume();
        clock.schedule(cue, 0); vi.advanceTimersByTime(1_000);
        expect(cue).not.toHaveBeenCalled();
      });

      it("scene teardown also cancels playback that is not paused", () => {
        const clock = new BattlePlaybackClock(), cue = vi.fn();
        clock.schedule(cue, 20); clearBattleTimerScope(); vi.advanceTimersByTime(100);
        expect(cue).not.toHaveBeenCalled();
        clock.dispose();
      });
    });
  });
  describe("dialogue", () => {
    isolateTimers();
    describe("dialogue keyboard controls", () => {
      it("accepts normalized keyboard-only advance keys", () => {
        expect(isDialogueAdvanceKey("Enter")).toBe(true);
        expect(isDialogueAdvanceKey("ENTER")).toBe(true);
        expect(isDialogueAdvanceKey(" ")).toBe(true);
        expect(isDialogueAdvanceKey("Space")).toBe(true);
        expect(isDialogueAdvanceKey("E")).toBe(true);
        expect(isDialogueAdvanceKey("z")).toBe(true);
        expect(isDialogueAdvanceKey("Z")).toBe(true);
        expect(isDialogueAdvanceKey("ArrowDown")).toBe(false);
        // 취소 키는 대사를 진행시키지 않는다 — Esc 만 "진행"으로 새던 결함의 회귀 방지.
        expect(isDialogueAdvanceKey("Escape")).toBe(false);
        expect(isDialogueAdvanceKey("x")).toBe(false);
        expect(isDialogueAdvanceKey("X")).toBe(false);
      });
    });
    describe("dialogue text codes", () => {
      it("resolves variables, actor names, colors, and escaped backslashes at display time", () => {
        const project = createBlankProject();
        project.database.actors = [{ ...project.database.actors[0]!, id: "hero", name: "Hero" }];
        expect(project.variables[0]?.id).toBe("var_0001");
        const context = {
          session: {
            variables: { var_0001: 42 },
            actorNames: { hero: "Renamed" },
          },
          project,
        };

        expect(resolveDialogueText("Gold \\v[1] / \\n[1] / \\c[2]red / \\\\", context)).toBe("Gold 42 / Renamed / red / \\");
      });

      it("keeps raw-index variable fallback for custom or legacy sessions", () => {
        const project = createBlankProject();
        const context = {
          session: {
            variables: { "1": 7 },
            actorNames: {},
          },
          project,
        };

        expect(resolveDialogueText("\\v[1]", context)).toBe("7");
      });

      it("reads named variable ids in \\V[...] (the id a script writes)", () => {
        const project = createBlankProject();
        const context = { session: { variables: { var_price: 108 }, actorNames: {} }, project };
        expect(resolveDialogueText("A potion is \\V[var_price] G. \\V[var_unset]", context)).toBe("A potion is 108 G. 0");
        expect(resolveDialogueText("\\V[not an id]", context)).toBe("\\V[not an id]");
      });

      it("falls back to database actor names and zero for missing variables", () => {
        const project = createBlankProject();
        project.database.actors = [{ ...project.database.actors[0]!, id: "hero", name: "Hero" }];
        const context = {
          session: { variables: {}, actorNames: {} },
          project,
        };

        expect(resolveDialogueText("\\n[1]:\\v[99]", context)).toBe("Hero:0");
      });
    });
    describe("dialogue speaker nameplate", () => {
      beforeEach(() => {
        document.body.innerHTML = "";
      });

      afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = "";
      });

      it("renders speaker outside the body as a nameplate pill", async () => {
        vi.useFakeTimers();
        const host = document.createElement("div");
        document.body.append(host);
        const dialogue = createDialogueUI(host);
        const shown = dialogue.showText({
          speaker: "March",
          body: "Hello",
          playerTileY: 0,
          mapHeight: 20,
          textContext: {
            session: { variables: {}, actorNames: {}, gold: 0 },
            project: createBlankProject(),
          },
        });

        const box = host.querySelector(".dialogue-box");
        const speaker = host.querySelector('[data-testid="dialogue-speaker"]');
        const body = host.querySelector(".dialogue-box .body");
        expect(box?.classList.contains("has-speaker")).toBe(true);
        expect(speaker?.classList.contains("speaker-nameplate")).toBe(true);
        expect(speaker?.textContent).toBe("March");
        expect(body?.contains(speaker as Node)).toBe(false);

        await vi.advanceTimersByTimeAsync(200);
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await shown;
        vi.useRealTimers();
      });
    });
    describe("narration speaker", () => {
      it("「내레이션」 같은 서술 표기는 이름표를 달지 않는다", () => {
        expect(nameplateSpeaker("내레이션")).toBeUndefined();
        expect(nameplateSpeaker(" 나레이션 ")).toBeUndefined();
        expect(nameplateSpeaker("Narrator")).toBeUndefined();
        expect(nameplateSpeaker("")).toBeUndefined();
        expect(nameplateSpeaker("모로 박사")).toBe("모로 박사");
        expect(nameplateSpeaker("내레이션 담당 할머니")).toBe("내레이션 담당 할머니");
      });

      it("resolves actor, variable, and string codes in the name box", () => {
        const project = createBlankProject();
        const actorId = project.database.actors[0]!.id;
        const context = {
          session: {
            variables: { var_0001: 3 },
            actorNames: { [actorId]: "민수" },
            stringVariables: { hero: "하늘" },
          },
          project,
        };
        expect(nameplateSpeaker("\\n[1]", context)).toBe("민수");
        expect(nameplateSpeaker("\\t[hero]", context)).toBe("하늘");
        expect(nameplateSpeaker("용사의 \\v[1]", context)).toBe("용사의 3");
        expect(nameplateSpeaker("마을 촌장", context)).toBe("마을 촌장");
        expect(nameplateSpeaker("내레이션", context)).toBeUndefined();
        // 기본 DB 배우가 99명을 넘는다(retro 로스터) — 없는 번호는 목록 끝 다음으로 잡는다.
        const missing = `\\n[${project.database.actors.length + 1}]`;
        expect(nameplateSpeaker(missing, context)).toBe(missing);
        expect(resolveDialogueSpeakerName("\\n[1]", context)).toBe("민수");
      });

      it("shows the renamed actor in the name box when the speaker is a name code", async () => {
        vi.useFakeTimers();
        const project = createBlankProject();
        const actorId = project.database.actors[0]!.id;
        const host = document.createElement("div");
        document.body.append(host);
        const dialogue = createDialogueUI(host);
        const shown = dialogue.showText({
          speaker: "\\n[1]",
          body: "오늘도 모험이야.",
          playerTileY: 0,
          mapHeight: 20,
          textContext: {
            session: { variables: {}, actorNames: { [actorId]: "민수" } },
            project,
          },
        });
        expect(host.querySelector("[data-testid='dialogue-speaker']")?.textContent).toBe("민수");
        await vi.advanceTimersByTimeAsync(200);
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await shown;
        vi.useRealTimers();
      });
    });
    describe("dialogue control playback", () => {
      beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = "";
      });

      afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = "";
      });

      it("maps speed values to bounded character delays", () => {
        expect(dialogueSpeedDelayMs(1)).toBe(8);
        expect(dialogueSpeedDelayMs(3)).toBe(24);
        expect(dialogueSpeedDelayMs(20)).toBe(160);
        expect(dialogueSpeedDelayMs(99)).toBe(160);
      });

      it("executes one-second delay and input pause before continuing", async () => {
        const host = document.createElement("div");
        document.body.append(host);
        const dialogue = createDialogueUI(host);
        const shown = dialogue.showText(textRequest(String.raw`A\|B\!C`));

        await vi.advanceTimersByTimeAsync(24);
        expect(dialogueBody(host)).toBe("A");
        await vi.advanceTimersByTimeAsync(24);
        await vi.advanceTimersByTimeAsync(999);
        expect(dialogueBody(host)).toBe("A");
        await vi.advanceTimersByTimeAsync(1);
        expect(dialogueBody(host)).toBe("AB");
        await vi.advanceTimersByTimeAsync(24);
        expect(dialogueBody(host)).toBe("AB");

        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await vi.advanceTimersByTimeAsync(0);
        expect(dialogueBody(host)).toBe("ABC");
        await vi.advanceTimersByTimeAsync(24);
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await shown;
      });

      it("타이핑은 이미 떠 있는 글자의 노드를 교체하지 않는다", async () => {
        // 배선까지 확인하는 단정이다. dialogueTextRenderer 자체는 자기 테스트가 지키지만,
        // dialogue.ts 가 다시 전량 재생성으로 돌아가면 글자별 CSS 연출이 매 틱 되감기고
        // 그 회귀는 화면으로도 computed style 로도 보이지 않는다.
        const host = document.createElement("div");
        document.body.append(host);
        const dialogue = createDialogueUI(host);
        const shown = dialogue.showText(textRequest("가나다"));

        await vi.advanceTimersByTimeAsync(24);
        const first = host.querySelector<HTMLElement>(".dialogue-box .body .dialogue-char");
        expect(first?.textContent).toBe("가");

        await vi.advanceTimersByTimeAsync(24);
        const grown = [...host.querySelectorAll<HTMLElement>(".dialogue-box .body .dialogue-char")];
        expect(grown).toHaveLength(2);
        expect(grown[0]).toBe(first);
        expect(dialogueBody(host)).toBe("가나");

        await vi.advanceTimersByTimeAsync(48);
        expect(dialogueBody(host)).toBe("가나다");
        expect(host.querySelectorAll(".dialogue-box .body .dialogue-char")[0]).toBe(first);

        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await shown;
      });

      it("shows the live session gold window", async () => {
        const host = document.createElement("div");
        document.body.append(host);
        const dialogue = createDialogueUI(host);
        const shown = dialogue.showText(textRequest(String.raw`A\$B`, 731));

        await vi.advanceTimersByTimeAsync(48);
        expect(dialogueBody(host)).toBe("AB");
        expect(host.querySelector<HTMLElement>('[data-testid="dialogue-gold-window"]')?.textContent).toContain("731 G");

        await vi.advanceTimersByTimeAsync(24);
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await shown;
      });

      it("applies custom speed, instant mode, and normal-speed restoration", async () => {
        const host = document.createElement("div");
        document.body.append(host);
        const dialogue = createDialogueUI(host);
        const shown = dialogue.showText(textRequest(String.raw`\s[20]A\>BC\<DE`));

        await vi.advanceTimersByTimeAsync(24);
        expect(dialogueBody(host)).toBe("A");
        await vi.advanceTimersByTimeAsync(159);
        expect(dialogueBody(host)).toBe("A");
        await vi.advanceTimersByTimeAsync(1);
        await vi.advanceTimersByTimeAsync(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(dialogueBody(host)).toBe("ABCD");
        // 153492679c: 흘림은 예정표(typeDue)를 따른다. D 는 예정 시각 184ms 에 나왔으므로(0ms 빠르게 구간 포함)
        // E 는 그보다 \s[20] 한 칸(160ms) 뒤인 344ms 에 나온다 — 0ms 타이머가 쓴 시간을 더하지 않는다.
        await vi.advanceTimersByTimeAsync(157);
        expect(dialogueBody(host)).toBe("ABCD");
        await vi.advanceTimersByTimeAsync(1);
        expect(dialogueBody(host)).toBe("ABCDE");

        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await shown;
      });

      it("closes automatically after an auto-close control", async () => {
        const host = document.createElement("div");
        document.body.append(host);
        const dialogue = createDialogueUI(host);
        let resolved = false;
        const shown = dialogue.showText(textRequest(String.raw`자동\^`)).then(() => {
          resolved = true;
        });

        await vi.advanceTimersByTimeAsync(100);
        await vi.advanceTimersByTimeAsync(0);
        expect(resolved).toBe(true);
        // 창은 퇴장 연출을 재생한 뒤에 빠진다 — 진행은 이미 끝났고 DOM 만 남아 있다.
        expect(host.querySelector(".dialogue-box")).not.toBeNull();
        await vi.advanceTimersByTimeAsync(dialoguePresentationProfile("neutral").exitMs);
        expect(host.querySelector(".dialogue-box")).toBeNull();
        await shown;
      });
    });
    function textRequest(body: string, gold = 0) {
      return {
        body,
        playerTileY: 0,
        mapHeight: 20,
        textContext: {
          session: { variables: {}, actorNames: {}, gold },
          project: createBlankProject(),
        },
      };
    }
    function dialogueBody(host: HTMLElement): string {
      return host.querySelector<HTMLElement>(".dialogue-box .body")?.textContent ?? "";
    }
    describe("dialogue presentation lifecycle", () => {
      /** 예약을 손으로 발화시키는 schedule — fake timer 없이 결정적으로 검사한다. */
      function manualSchedule() {
        const queue: { readonly callback: () => void; readonly delayMs: number; cancelled: boolean }[] = [];
        const schedule = (callback: () => void, delayMs: number): (() => void) => {
          const entry = { callback, delayMs, cancelled: false };
          queue.push(entry);
          return () => {
            entry.cancelled = true;
          };
        };
        const flush = (): void => {
          for (const entry of [...queue]) {
            if (!entry.cancelled) entry.callback();
          }
          queue.length = 0;
        };
        return { schedule, queue, flush };
      }

      const box = (host: HTMLElement): HTMLElement | null =>
        host.querySelector<HTMLElement>(".dialogue-box");

      it("세션 첫 창만 진입 연출을 재생하고 이어지는 대사는 재생하지 않는다", async () => {
        const host = document.createElement("div");
        document.body.append(host);
        const { schedule, flush } = manualSchedule();
        const dialogue = createDialogueUI(host, schedule);

        const first = dialogue.showText(textRequest("첫 줄"));
        expect(box(host)?.dataset.dialoguePhase).toBe("enter");
        expect(box(host)?.dataset.dialogueEmotion).toBe("neutral");

        // 진입이 끝나면 정착 상태로 넘어간다.
        flush();
        expect(box(host)?.dataset.dialoguePhase).toBe("shown");

        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await first;

        // cleanup 이 퇴장을 예약했지만 아직 상자는 살아 있다.
        expect(box(host)?.dataset.dialoguePhase).toBe("exit");

        // 같은 세션의 다음 대사 — 예약이 취소되고 진입 연출은 다시 재생되지 않는다.
        const second = dialogue.showText(textRequest("둘째 줄"));
        expect(box(host)?.dataset.dialoguePhase).toBe("shown");
        expect(dialogueBody(host)).not.toContain("첫 줄");

        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await second;
        dialogue.hide();
      });

      it("close() 는 퇴장을 재생한 뒤 비우고, hide() 는 즉시 컷이다", async () => {
        const host = document.createElement("div");
        document.body.append(host);
        const { schedule, flush } = manualSchedule();
        const dialogue = createDialogueUI(host, schedule);

        const shown = dialogue.showText(textRequest("본문"));
        flush();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await shown;

        dialogue.close();
        expect(box(host)?.dataset.dialoguePhase).toBe("exit");
        flush();
        expect(box(host)).toBeNull();

        // hide() 는 연출을 기다리지 않는다 — 맵 전환처럼 창이 남으면 안 되는 자리용이다.
        const again = expect(dialogue.showText(textRequest("다시"))).rejects.toMatchObject({ name: "AbortError" });
        expect(box(host)).not.toBeNull();
        dialogue.hide();
        expect(box(host)).toBeNull();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await again;
      });

      it("연출 상태는 상자에 있어 resetOverlay 의 className 통짜 대입에 지워지지 않는다", async () => {
        const host = document.createElement("div");
        document.body.append(host);
        const { schedule, flush } = manualSchedule();
        const dialogue = createDialogueUI(host, schedule);

        const shown = dialogue.showText({ ...textRequest("분노"), emotion: "angry" });
        const current = box(host);
        expect(current?.dataset.dialogueEmotion).toBe("angry");
        expect(current?.dataset.dialogueShake).toBe("1");
        expect(current?.style.getPropertyValue("--dialogue-enter-ms")).toBe(
          `${dialoguePresentationProfile("angry").enterMs}ms`
        );
        // 오버레이는 className 이 통짜로 덮이는 자리다 — 연출 상태가 여기 있으면 안 된다.
        const overlay = host.querySelector<HTMLElement>(".dialogue-overlay");
        expect(overlay?.dataset.dialogueEmotion).toBeUndefined();

        flush();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await shown;
        dialogue.hide();
      });

      it("스크림은 오버레이의 형제로 살고 창과 함께 켜지고 꺼진다", async () => {
        const host = document.createElement("div");
        document.body.append(host);
        const { schedule, flush } = manualSchedule();
        const dialogue = createDialogueUI(host, schedule);
        const scrim = host.querySelector<HTMLElement>(".dialogue-scrim");

        // 오버레이 안에 있으면 화면을 덮을 수 없다 — position-top/bottom 에서 높이가 27% 뿐이다.
        expect(scrim?.parentElement).toBe(host);
        expect(scrim?.nextElementSibling?.className).toBe("dialogue-overlay");
        expect(scrim?.dataset.dialogueScrim).toBeUndefined();

        const shown = dialogue.showText({ ...textRequest("놀람"), emotion: "surprised" });
        expect(scrim?.dataset.dialogueScrim).toBe("on");
        expect(scrim?.dataset.dialogueFlash).toBe("1");
        expect(scrim?.className).toContain("position-");
        expect(scrim?.style.getPropertyValue("--dialogue-scrim-opacity")).toBe(
          String(dialoguePresentationProfile("surprised").scrimOpacity)
        );

        flush();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await shown;
        // 퇴장이 시작되면 스크림도 같이 걷힌다.
        expect(scrim?.dataset.dialogueScrim).toBeUndefined();

        // 다음 대사는 놀람이 아니므로 플래시가 남아 있으면 안 된다.
        const again = dialogue.showText(textRequest("보통"));
        expect(scrim?.dataset.dialogueScrim).toBe("on");
        expect(scrim?.dataset.dialogueFlash).toBeUndefined();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await again;
        dialogue.hide();
        expect(scrim?.dataset.dialogueScrim).toBeUndefined();
        expect(scrim?.className).toBe("dialogue-scrim");
      });

      it("reducedMotion 은 움직임을 끄지만 창은 그대로 뜬다", async () => {
        const host = document.createElement("div");
        document.body.append(host);
        const { schedule, flush } = manualSchedule();
        const dialogue = createDialogueUI(host, schedule);

        const shown = dialogue.showText({ ...textRequest("조용히"), emotion: "angry", reducedMotion: true });
        const current = box(host);
        expect(current?.dataset.dialogueMotion).toBe("off");
        expect(current?.dataset.dialogueShake).toBeUndefined();
        expect(current?.dataset.dialogueCharReveal).toBeUndefined();
        // 창 자체는 여전히 나타나야 한다 — opacity 0 으로 남으면 대사가 안 보인다.
        expect(current?.dataset.dialoguePhase).toBe("enter");
        flush();
        expect(current?.dataset.dialoguePhase).toBe("shown");

        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await shown;
        dialogue.hide();
      });
    });
    describe("dialogue bust face overlay", () => {
      beforeEach(() => {
        document.body.innerHTML = "";
      });

      afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = "";
      });

      it("renders large bust above the message window for -bust resources", async () => {
        vi.useFakeTimers();
        const host = document.createElement("div");
        document.body.append(host);
        const dialogue = createDialogueUI(host);
        const shown = dialogue.showText({
          speaker: "Actor1",
          body: "흉상 대사 테스트",
          playerTileY: 0,
          mapHeight: 20,
          face: {
            resourceId: "generated-face-actor1-bust",
            position: "left",
            flipHorizontally: false,
          },
          textContext: {
            session: { variables: {}, actorNames: {}, gold: 0 },
            project: createBlankProject(),
          },
        });

        const overlay = host.querySelector(".dialogue-overlay");
        const face = host.querySelector('[data-testid="dialogue-face"]');
        expect(overlay?.classList.contains("has-bust-face")).toBe(true);
        expect(face?.classList.contains("dialogue-face-bust")).toBe(true);
        expect(face?.getAttribute("data-position") ?? face?.classList.contains("dialogue-face-side-left")).toBeTruthy();
        expect(face?.getAttribute("data-face-mode")).toBe("bust");
        expect(host.querySelector(".dialogue-content")?.classList.contains("has-bust")).toBe(true);

        await vi.advanceTimersByTimeAsync(200);
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await shown;
      });
    });
      it("places whole-image portrait on the right when position is right", async () => {
        vi.useFakeTimers();
        const host = document.createElement("div");
        document.body.append(host);
        const dialogue = createDialogueUI(host);
        const shown = dialogue.showText({
          speaker: "Actor1",
          body: "오른쪽 흉상",
          playerTileY: 0,
          mapHeight: 20,
          face: {
            resourceId: "generated-face-actor1-bust",
            position: "right",
            flipHorizontally: false,
          },
          textContext: {
            session: { variables: {}, actorNames: {}, gold: 0 },
            project: createBlankProject(),
          },
        });
        const box = host.querySelector(".dialogue-box");
        const face = host.querySelector('[data-testid="dialogue-face"]');
        expect(box?.classList.contains("bust-right")).toBe(true);
        expect(face?.getAttribute("data-position")).toBe("right");
        expect(face?.classList.contains("dialogue-face-side-right")).toBe(true);
        await vi.advanceTimersByTimeAsync(200);
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await shown;
      });
      it("uses full portrait mode for -full resources", async () => {
        vi.useFakeTimers();
        const host = document.createElement("div");
        document.body.append(host);
        const dialogue = createDialogueUI(host);
        const shown = dialogue.showText({
          speaker: "Actor1",
          body: "전신",
          playerTileY: 0,
          mapHeight: 20,
          face: {
            resourceId: "generated-face-actor1-full",
            position: "left",
            flipHorizontally: false,
          },
          textContext: {
            session: { variables: {}, actorNames: {}, gold: 0 },
            project: createBlankProject(),
          },
        });
        const face = host.querySelector('[data-testid="dialogue-face"]');
        expect(face?.getAttribute("data-face-mode")).toBe("full");
        expect(face?.classList.contains("dialogue-face-full")).toBe(true);
        await vi.advanceTimersByTimeAsync(200);
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await shown;
      });
  });
});

describe("playerSuite12", () => {
  isolateTimers();
  describe("titleLicenseNotice", () => {
    isolateTimers();
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "Asset credits" }));
      vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(function () {
        this.open = true;
      });
      vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function () {
        this.open = false;
        this.dispatchEvent(new Event("close"));
      });
    });
    afterEach(() => {
      document.querySelectorAll("dialog").forEach((dialog) => dialog.close());
      document.body.replaceChildren();
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });
    describe("title credits keyboard ownership", () => {
      it.each(["Escape", "x", "X", "Enter", "z", "Z", " ", "e"])("closes with %s before document handlers", async (key) => {
        const onClose = vi.fn();
        openLicenseDialog(onClose);
        await vi.waitFor(() => expect(document.querySelector("dialog[open]")).not.toBeNull());
        const button = document.querySelector<HTMLButtonElement>(".rm-license-dialog-close")!;
        expect(document.activeElement).toBe(button);
        const behind = vi.fn();
        document.addEventListener("keydown", behind, true);
        try {
          const repeat = new KeyboardEvent("keydown", { key, repeat: true, bubbles: true, cancelable: true });
          button.dispatchEvent(repeat);
          expect(onClose).not.toHaveBeenCalled();
          const press = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
          button.dispatchEvent(press);
          expect(press.defaultPrevented).toBe(true);
          expect(behind).not.toHaveBeenCalled();
          expect(onClose).toHaveBeenCalledTimes(1);
          expect(document.querySelector("dialog")).toBeNull();
          document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
          expect(behind).toHaveBeenCalledTimes(1);
        } finally {
          document.removeEventListener("keydown", behind, true);
        }
      });

      it("scrolls the notice with arrows and page keys without closing", async () => {
        openLicenseDialog();
        await vi.waitFor(() => expect(document.querySelector("dialog[open]")).not.toBeNull());
        const body = document.querySelector<HTMLElement>(".rm-license-dialog-body")!;
        const button = document.querySelector<HTMLButtonElement>(".rm-license-dialog-close")!;
        expect(document.querySelector("#title-credits-hint")?.textContent).toBe("↑↓ 로 읽고, Esc 로 닫습니다");
        expect(body.getAttribute("aria-label")).toBe("저작자 표기");
        expect(body.tabIndex).toBe(0);
        const press = (key: string): KeyboardEvent => {
          const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
          button.dispatchEvent(event);
          return event;
        };
        const down = press("ArrowDown");
        expect(down.defaultPrevented).toBe(true);
        expect(body.scrollTop).toBe(32);
        expect(document.querySelector("dialog[open]")).not.toBeNull();
        const page = Math.max(96, Math.round((body.clientHeight || 256) * 0.85));
        press("PageDown");
        expect(body.scrollTop).toBe(32 + page);
        press("Home");
        expect(body.scrollTop).toBe(0);
        press("End");
        expect(body.scrollTop).toBe(body.scrollHeight);
        press("ArrowUp");
        expect(body.scrollTop).toBe(Math.max(0, body.scrollHeight - 32));
        const behind = vi.fn();
        document.addEventListener("keydown", behind, true);
        try {
          press("PageUp");
          expect(behind).not.toHaveBeenCalled();
        } finally {
          document.removeEventListener("keydown", behind, true);
        }
        expect(document.querySelector("dialog[open]")).not.toBeNull();
      });
    });
    describe("title credits include asset store items", () => {
      it("appends store credits after the base notice and leaves it alone without store items", async () => {
        expect(withStoreCredits("Base", "")).toBe("Base");
        const origin = { store: "https://store.example", itemSlug: "forest-pack", version: 2, title: "숲 마을 팩", author: "숲 작가", license: "CC-BY-4.0", aiGenerated: true, credits: "그림: 숲 작가", url: "https://store.example/items/forest-pack" };
        const project = { tilesets: {}, assets: { uploaded: { store_forest_pack__sheet: { id: "store_forest_pack__sheet", name: "숲", kind: "chipset", meta: {}, origin } } } } as unknown as Project;
        vi.spyOn(store, "getCurrent").mockReturnValue(project);
        openLicenseDialog();
        await vi.waitFor(() => expect(document.querySelector("dialog[open]")).not.toBeNull());
        const body = document.querySelector(".rm-license-dialog-body")!.textContent!;
        expect(body.startsWith("만든 도구")).toBe(true);
        expect(body).not.toContain("Asset credits");
        expect(body).toContain("OPRN 에셋 스토어");
        expect(body).toContain("「숲 마을 팩」 — 숲 작가 · CC-BY-4.0 · AI 생성 포함");
        expect(body).toContain("그림: 숲 작가");
      });
    });
    describe("title credits are written for players", () => {
      it("shows the short Korean credits first, without fetching the developer attribution document", async () => {
        openLicenseDialog();
        await vi.waitFor(() => expect(document.querySelector("dialog[open]")).not.toBeNull());
        expect(fetch).not.toHaveBeenCalled();
        const body = document.querySelector<HTMLElement>(".rm-license-dialog-body")!;
        const headings = [...body.querySelectorAll(".rm-license-dialog-heading")].map((node) => node.textContent);
        expect(headings).toEqual(["만든 도구", "음악과 효과음", "그림", "글꼴", "라이선스"]);
        expect(body.textContent).not.toContain("Asset credits");
        // 개발 기록·파일 경로는 플레이어가 읽는 글에 없다.
        expect(body.textContent).not.toMatch(/public\/|src\/|scripts\/|\.png|\.ts\b|`/);
      });

      it("keeps every credit a licence or a permission requires", () => {
        // CC BY 4.0: 저작자·라이선스·출처·변경 사실·보증 없음.
        for (const author of ["Garakuta", "Juan Manuel Nigretti", "Marina Navarro Travesset", "MrBeast", "Orochii Zouveleki", "R.C.O.",
          "Stephen Challener (Redshrike)", "Tom Lemmens", "VictorSena", "andwhyisit", "kou", "lumiscosity", "russidan (Alephman)"]) {
          expect(PLAYER_CREDITS).toContain(author);
        }
        expect(PLAYER_CREDITS).toContain("https://github.com/EasyRPG/RTP");
        expect(PLAYER_CREDITS).toContain("Scarloxy (Ismael Garcia)");
        expect(PLAYER_CREDITS).toContain("https://scarloxy.itch.io/mpwsp01");
        expect(PLAYER_CREDITS).toContain("https://creativecommons.org/licenses/by/4.0/");
        expect(PLAYER_CREDITS).toContain("고쳐 그렸습니다");
        expect(PLAYER_CREDITS).toContain("보증하거나 후원하지 않습니다");
        // REFMAP 표기 줄은 원문 그대로.
        expect(PLAYER_CREDITS).toContain("REFMAP (http://refmap.wixsite.com/fsm-material), modified");
        // 저작자가 크레딧 표기를 조건으로 허락한 윤문 규칙.
        expect(PLAYER_CREDITS).toContain("general-good-writing, 코드 연규(code-yeongyu)");
        // OPRN BGM 은 사람이 지은 곡처럼 적지 않는다.
        expect(PLAYER_CREDITS).toContain("OPRN BGM (AI 로 만든 음악, Google Lyria)");
      });

      it("opens the full attribution document only from its button, by mouse or by keyboard", async () => {
        openLicenseDialog();
        await vi.waitFor(() => expect(document.querySelector("dialog[open]")).not.toBeNull());
        const body = document.querySelector<HTMLElement>(".rm-license-dialog-body")!;
        const close = document.querySelector<HTMLButtonElement>(".rm-license-dialog-close")!;
        const full = document.querySelector<HTMLButtonElement>("[data-testid='title-credits-full']")!;
        expect(full.textContent).toBe("전체 출처 문서 (영문)");
        expect(document.activeElement).toBe(close);
        const press = (key: string): void => {
          (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
        };
        press("ArrowLeft");
        expect(document.activeElement).toBe(full);
        press("ArrowRight");
        expect(document.activeElement).toBe(close);
        press("ArrowLeft");
        press("Enter");
        await vi.waitFor(() => expect(body.textContent).toBe("Asset credits"));
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(document.querySelector("dialog[open]")).not.toBeNull();
        expect(document.querySelector("[data-testid='title-credits-full']")).toBeNull();
        expect(document.activeElement).toBe(close);
        press("Escape");
        expect(document.querySelector("dialog")).toBeNull();
      });

      it("closes with Escape even while the full-document button has focus", async () => {
        const onClose = vi.fn();
        openLicenseDialog(onClose);
        await vi.waitFor(() => expect(document.querySelector("dialog[open]")).not.toBeNull());
        const full = document.querySelector<HTMLButtonElement>("[data-testid='title-credits-full']")!;
        full.focus();
        full.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(fetch).not.toHaveBeenCalled();
      });
    });
  });
  describe("touchListTapBattleBack", () => {
    isolateTimers();
    // 2026-11-10 fs-combo-cancel: 390px 터치에서 전투 「뒤로」를 한 번 탭하면 커서만 옮겨 취소가 안 됐다(6/6).
    function battleMenu(): { root: HTMLElement; skill: HTMLButtonElement; back: HTMLButtonElement; clicks: string[] } {
      const root = document.createElement("div");
      const menu = document.createElement("div");
      menu.className = "battle-command-menu";
      const clicks: string[] = [];
      const row = (id: string, icon: string): HTMLButtonElement => {
        const button = document.createElement("button");
        button.className = "battle-command";
        button.dataset.testid = id;
        button.dataset.commandIcon = icon;
        button.addEventListener("click", () => clicks.push(id));
        menu.append(button);
        return button;
      };
      const skill = row("actor-skill-a", "fire");
      skill.setAttribute("aria-current", "true");
      row("actor-skill-b", "fire");
      const back = row("actor-command-back", "back");
      root.append(menu);
      document.body.append(root);
      return { root, skill, back, clicks };
    }
    function tap(target: Element): void {
      target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }));
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }
    let dispose: (() => void) | undefined;
    afterEach(() => {
      dispose?.();
      document.body.innerHTML = "";
    });
    describe("전투 메뉴 터치 — 뒤로는 한 번 탭", () => {
      it("커서가 없는 「뒤로」 줄을 한 번 탭하면 바로 실행된다", () => {
        const { root, back, clicks } = battleMenu();
        dispose = installTouchListTap(root);
        tap(back);
        expect(clicks).toEqual(["actor-command-back"]);
      });

      it("커서가 없는 기술 줄은 첫 탭에 실행하지 않는다", () => {
        const { root, clicks } = battleMenu();
        dispose = installTouchListTap(root);
        tap(root.querySelector("[data-testid='actor-skill-b']")!);
        expect(clicks).toEqual([]);
      });
    });
  });
});
