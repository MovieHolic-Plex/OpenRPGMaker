// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import assert from "node:assert/strict";
import { playBattle } from "@/player/playSceneBattle";
import { createDialogueUI } from "@/player/dialogue";
import { destroyBattleSceneOnHost } from "@/player/battleDom";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { ACTOR, TROOP, battleCase, choice, m2, mark } from "./battleEventRepairFlow.fixture";
import { playOpenChest } from "@/player/playSceneChest";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { playInn } from "@/player/playSceneCommerce";
import { updatePlayerPreferences } from "@/player/playerPreferences";
import { DEFAULT_ACTOR_ID, DEFAULT_STATE_ID } from "@/project/defaults/constants";
import { isolateTimers } from "./mergedTeardown";

describe("playSceneBattleCancellation", () => {
  isolateTimers();
  const previousProject = store.getCurrent();
  const hosts: HTMLElement[] = [];
  const aborters: AbortController[] = [];
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    for (const controller of aborters.splice(0)) controller.abort();
    for (const host of hosts.splice(0)) { destroyBattleSceneOnHost(host); host.remove(); }
    vi.clearAllTimers(); vi.useRealTimers(); store.replaceProject(previousProject);
  });
  function setup(flow: "gauge" | "strict" = "strict") {
    const { project } = battleCase({ flow, commands: [choice({ options: [
      { text: "First", branch: [mark("first"), m2("m2-107-force-escape")] },
      { text: "Second", branch: [mark("second"), m2("m2-107-force-escape")] },
    ] })] });
    project.system.startActorIds = [ACTOR]; project.session.partyActorIds = [ACTOR];
    store.replaceProject(project);
    const host = document.createElement("div"); document.body.append(host); hosts.push(host);
    const dialogue = createDialogueUI(host);
    const session = startSession(project);
    const battleAbortController = new AbortController(); aborters.push(battleAbortController);
    const scene = { session, tileY: 0, map: { height: 20 }, battleAbortController,
      // An authored gameOver/killPlayer in the troop hands off to the host's game-over screen.
      showGameOverScreen: vi.fn(),
      game: { registry: { get: (key: string) => key === "dialogueHost" ? host : key === "dialogue" ? dialogue : undefined } },
    };
    const step = { kind: "battleProcessing", troopId: TROOP, canEscape: false, canLose: true, battleFlow: flow } as const;
    return { project, host, scene, session, battleAbortController, step };
  }
  function key(value: string) {
    (document.activeElement ?? document).dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }));
  }
  async function openChoice(host: HTMLElement) {
    await vi.advanceTimersByTimeAsync(30_000);
    const defend = host.querySelector<HTMLElement>("[data-testid='actor-command-defend']");
    assert.ok(defend); defend.focus(); key("Enter");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(host.querySelector("[data-testid='runtime-choices']")).not.toBeNull();
  }
  describe("playBattle cancellation boundary", () => {
    it("abort during entry settles without mounting or writing a result", async () => {
      const { scene, step, host, session, battleAbortController } = setup();
      const before = structuredClone(session.variables);
      const pending = playBattle(scene, step, 0);
      battleAbortController.abort();
      await vi.advanceTimersByTimeAsync(30_000);
      expect(host.querySelector("[data-testid='battle-scene']")).toBeNull();
      expect(await pending).toBeNull();
      expect(session.variables).toEqual(before);
      expect(host.querySelector("[data-testid='battle-transition-overlay']")).toBeNull();
    });

    it.each(["gauge", "strict"] as const)("%s uses real keyboard input and writes back only the chosen branch", async flow => {
      const { scene, step, host, session } = setup(flow);
      const pending = playBattle(scene, step, 0);
      await openChoice(host);
      expect(session.variables.second).toBeUndefined();
      key("ArrowDown"); key("z");
      await vi.advanceTimersByTimeAsync(30_000);
      // 전투 이벤트의 「전투 중단」(m2-107-force-escape)이 끝낸 전투는 「후퇴」 결과 상자 없이 바로 필드로 돌아간다(574cd06132, endedByEvent).
      expect(host.querySelector("[data-testid='battle-result-panel']")).toBeNull();
      expect(await pending).toBe("escape");
      expect(session.variables.second).toBe(1);
      expect(session.variables.first).toBeUndefined();
      expect(session.variables.after).toBeUndefined();
    });

    it("replacing the session while choices are open abandons the old write-back and listener", async () => {
      const { project, scene, step, host, session, battleAbortController } = setup();
      const pending = playBattle(scene, step, 0);
      await openChoice(host);
      const replacement = startSession(project); replacement.variables.second = 71;
      scene.session = replacement; battleAbortController.abort();
      await vi.advanceTimersByTimeAsync(30_000);
      expect(await pending).toBeNull();
      key("ArrowDown"); key("Enter");
      expect(replacement.variables.second).toBe(71);
      expect(session.variables.second).toBeUndefined();
      expect(host.querySelector("[data-testid='runtime-choices']")).toBeNull();
    });

    it("host teardown after accepting a result cancels before reward/state write-back", async () => {
      const { scene, step, host, session } = setup();
      const pending = playBattle(scene, step, 0);
      await openChoice(host);
      key("ArrowDown"); key("Enter");
      // 전투 이벤트가 끝낸 전투는 결과 상자가 없다(574cd06132) — 결과는 마이크로태스크로 바로 호스트에 넘어간다.
      // 그 넘김을 한 번 흘려보낸 뒤(= 결과 수락) 호스트를 걷어도 보상·상태 기록 전에 취소돼야 한다.
      expect(host.querySelector("[data-testid='battle-result-panel']")).toBeNull();
      await Promise.resolve();
      destroyBattleSceneOnHost(host);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(await pending).toBeNull();
      expect(session.variables.second).toBeUndefined();
      expect(host.querySelector("[data-testid='battle-transition-overlay']")).toBeNull();
    });
  });
});

// 보관 상자 창: 제목으로 이름 붙인 대화상자, 수량 칸은 보이는 「수량」 라벨에 묶인다.
describe("playSceneChestA11y", () => {
  isolateTimers();
  function sceneFixture(): PlaySceneContext {
    store.replace(deserialize(serialize(createBlankProject())));
    const project = store.getCurrent();
    const host = document.createElement("div");
    document.body.append(host);
    return {
      session: startSession(project, 1),
      map: project.maps[project.startMapId],
      tileX: 0,
      tileY: 0,
      game: { registry: { get: (key: string) => (key === "dialogueHost" ? host : undefined) } },
      syncRuntimeState() {},
      refreshRuntimeSurfaces() {},
    } as unknown as PlaySceneContext;
  }
  afterEach(() => {
    document.body.replaceChildren();
  });
  describe("storage chest dialog accessibility", () => {
    it("names the open chest and associates the quantity field with 수량", async () => {
      const scene = sceneFixture();
      const pending = playOpenChest(scene, { template: "warehouse", chestId: "box", displayName: "공동 창고" });
      const dialog = document.querySelector<HTMLElement>("[data-testid='chest-scene']");
      expect(dialog?.getAttribute("role")).toBe("dialog");
      expect(dialog?.getAttribute("aria-modal")).toBe("true");
      const titleId = dialog?.getAttribute("aria-labelledby");
      expect(titleId).toBeTruthy();
      expect(document.getElementById(titleId!)?.textContent).toBe("공동 창고");

      const qty = document.querySelector<HTMLInputElement>("[data-testid='chest-qty']");
      expect(qty?.id).toBeTruthy();
      expect(document.querySelector("label.runtime-chest-qty-label")?.getAttribute("for")).toBe(qty?.id);
      expect(document.querySelector("[data-testid='chest-search']")?.getAttribute("aria-label")).toBe("검색");
      expect(document.querySelector("[data-testid='chest-status']")?.getAttribute("role")).toBe("status");
      expect(document.querySelector("[data-testid='chest-tab-all']")?.getAttribute("aria-pressed")).toBe("true");
      expect(document.querySelector("[data-testid='chest-tab-medicine']")?.getAttribute("aria-pressed")).toBe("false");
      expect(document.querySelector("[data-testid='chest-qty-1']")?.getAttribute("aria-label")).toBe("수량 1");
      expect(document.querySelector("[data-testid='chest-qty-10']")?.getAttribute("aria-label")).toBe("수량 10");
      expect(document.querySelector("[data-testid='chest-qty-all']")?.getAttribute("aria-label")).toBe("수량 전부");

      document.querySelector<HTMLButtonElement>("[data-testid='chest-close']")?.click();
      await pending;
      expect(document.querySelector("[data-testid='chest-scene']")).toBeNull();
    });

    it("names a locked chest with the same dialog contract", async () => {
      const scene = sceneFixture();
      const pending = playOpenChest(scene, { chestId: "sealed", displayName: "잠긴 궤", lockSwitchId: "sw_missing" });
      const dialog = document.querySelector<HTMLElement>("[data-testid='chest-locked']");
      expect(dialog?.getAttribute("role")).toBe("dialog");
      expect(dialog?.getAttribute("aria-modal")).toBe("true");
      const titleId = dialog?.getAttribute("aria-labelledby");
      expect(document.getElementById(titleId!)?.textContent).toBe("잠긴 궤");
      expect(document.querySelector("[data-testid='chest-status']")?.getAttribute("role")).toBe("status");

      document.querySelector<HTMLButtonElement>("[data-testid='chest-close']")?.click();
      await pending;
      expect(document.querySelector("[data-testid='chest-locked']")).toBeNull();
    });
  });
});

// 여관 창: 제목으로 이름 붙인 대화상자, 질문·부족·휴식은 상태 영역,
// 상태 회복 미리보기(「독 → 정상」)는 CSS 가 아니라 글자로 있다.
describe("playSceneInnA11y", () => {
  isolateTimers();
  function sceneFixture(gold: number): { scene: PlaySceneContext; waits: Array<() => void> } {
    store.replace(deserialize(serialize(createBlankProject())));
    const project = store.getCurrent();
    const host = document.createElement("div");
    document.body.append(host);
    const session = startSession(project, 1);
    session.gold = gold;
    session.actorStateIds = { [DEFAULT_ACTOR_ID]: [DEFAULT_STATE_ID] };
    const waits: Array<() => void> = [];
    const scene = {
      session,
      map: project.maps[project.startMapId],
      tileX: 0,
      tileY: 0,
      game: { registry: { get: (key: string) => (key === "dialogueHost" ? host : undefined) } },
      syncRuntimeState() {},
      time: {
        delayedCall(ms: number, cb: () => void) {
          void ms;
          waits.push(cb);
          return { remove() {} };
        },
      },
    } as unknown as PlaySceneContext;
    return { scene, waits };
  }
  afterEach(() => {
    document.body.replaceChildren();
    updatePlayerPreferences({ reduceMenuMotion: false });
  });
  describe("inn dialog accessibility", () => {
    it("names the inn, announces the question, and puts the cure preview in the text", async () => {
      const { scene } = sceneFixture(0);
      const pending = playInn(scene, { kind: "inn", price: 40 });
      const dialog = document.querySelector<HTMLElement>("[data-testid='inn-scene']");
      expect(dialog?.getAttribute("role")).toBe("dialog");
      expect(dialog?.getAttribute("aria-modal")).toBe("true");
      expect(dialog?.getAttribute("aria-label")).toBe("여관");

      const status = document.querySelector<HTMLElement>("[data-testid='commerce-status']");
      expect(status?.getAttribute("role")).toBe("status");
      expect(status?.textContent).toContain("40");
      expect(status?.textContent).toContain("묵으시겠습니까");

      const state = document.querySelector(`[data-testid='inn-party-row-${DEFAULT_ACTOR_ID}'] .runtime-inn-party-state`);
      expect(state?.textContent).toBe("독 → 정상");
      expect(document.querySelector(".runtime-inn-track")?.getAttribute("aria-hidden")).toBe("true");

      document.querySelector<HTMLButtonElement>("[data-testid='inn-stay']")?.click();
      expect(status?.textContent).toBe("소지금이 부족합니다.");
      expect(dialog?.getAttribute("aria-label")).toBe("여관");

      document.querySelector<HTMLButtonElement>("[data-testid='inn-cancel']")?.click();
      await pending;
      expect(document.querySelector("[data-testid='inn-scene']")).toBeNull();
    });

    it("moves from stay to cancel with the down arrow in the stacked pixel window", async () => {
      // fs2 스웜 I23: 도트 창은 예/아니오를 위아래로 쌓는다. 2열 커서여서 ↓ 가 먹지 않았고, 돈이 모자라면 「예」에 갇혔다.
      const { scene } = sceneFixture(0);
      const pending = playInn(scene, { kind: "inn", price: 40 });
      expect(document.querySelector(".runtime-inn-pixel")).not.toBeNull();
      const overlay = document.querySelector<HTMLElement>("[data-testid='inn-scene']")!;
      const press = (key: string) => overlay.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      press("ArrowDown");
      expect(document.querySelector("[data-testid='inn-cancel']")?.getAttribute("aria-current")).toBe("true");
      press("Enter");
      await pending;
      expect(document.querySelector("[data-testid='inn-scene']")).toBeNull();
    });

    it("clears every party state on a stay, not only states whose removal text mentions rest", () => {
      // fs2 스웜 R2: 창은 「독 → 정상」을 보여 주는데 해제 문구에 「휴식」이 없는 상태는 남았다(RM2003 FullHeal 과 어긋남).
      const { scene } = sceneFixture(80);
      const project = store.getCurrent();
      project.database.states.push({ ...project.database.states[0]!, id: "state_curse", name: "저주", removalCondition: "전투 종료 시" });
      scene.session.actorStateIds = { [DEFAULT_ACTOR_ID]: [DEFAULT_STATE_ID, "state_curse"] };
      void playInn(scene, { kind: "inn", price: 10 });
      document.querySelector<HTMLButtonElement>("[data-testid='inn-stay']")?.click();
      expect(scene.session.actorStateIds?.[DEFAULT_ACTOR_ID] ?? []).toEqual([]);
    });

    it("names the rest blackout and skips the fade when menu motion is reduced", async () => {
      updatePlayerPreferences({ reduceMenuMotion: true });
      const { scene, waits } = sceneFixture(80);
      const pending = playInn(scene, { kind: "inn", price: 10, restDurationMs: 400, wakeDurationMs: 400 });
      document.querySelector<HTMLButtonElement>("[data-testid='inn-stay']")?.click();

      const fade = document.querySelector<HTMLElement>("[data-testid='inn-resting']");
      expect(fade?.getAttribute("role")).toBe("status");
      expect(fade?.getAttribute("aria-label")).toBe("휴식 중");
      expect(fade?.style.animation).toBe("none");
      expect(fade?.style.opacity).toBe("0.96");
      expect(document.querySelector("[data-testid='inn-scene']")?.getAttribute("aria-label")).toBe("여관");

      expect(waits).toHaveLength(1);
      waits.shift()?.();
      await Promise.resolve();
      const wake = document.querySelector<HTMLElement>("[data-testid='inn-wake']");
      expect(wake?.getAttribute("role")).toBe("status");
      expect(wake?.textContent).toContain("좋은 아침입니다");
      expect(document.querySelector("[data-testid='inn-scene']")?.getAttribute("aria-label")).toBe("여관");

      expect(waits).toHaveLength(1);
      waits.shift()?.();
      await pending;
      expect(document.querySelector("[data-testid='inn-scene']")).toBeNull();
    });

    it("uses the database gold, HP, and MP terms on the inn purse and gauges", async () => {
      const { scene } = sceneFixture(1250);
      store.getCurrent().meta.terms = { gold: "냥", hp: "체력", mp: "마력" };
      const actorId = scene.session.partyActorIds[0] ?? DEFAULT_ACTOR_ID;
      const vitals = scene.session.actorVitals[actorId];
      if (!vitals) throw new Error("missing party vitals");
      vitals.hp = Math.max(1, Math.floor(vitals.maxHp * 0.4));
      vitals.mp = Math.floor(vitals.maxMp * 0.25);

      const pending = playInn(scene, { kind: "inn", price: 30 });
      const dialog = document.querySelector<HTMLElement>("[data-testid='inn-scene']");
      expect(dialog?.textContent).toContain("30 냥");
      const purse = document.querySelector("[data-testid='inn-summary-gold']")?.textContent ?? "";
      expect(purse).toContain("냥");
      expect(purse).not.toContain("G");
      expect(document.querySelector("[data-testid='inn-party-hp-0']")?.textContent).toContain("체력");
      expect(document.querySelector("[data-testid='inn-party-mp-0']")?.textContent).toContain("마력");
      expect(document.querySelector("[data-testid='inn-summary-hp']")?.textContent).toContain("체력");
      expect(document.querySelector("[data-testid='inn-summary-mp']")?.textContent).toContain("마력");

      document.querySelector<HTMLButtonElement>("[data-testid='inn-cancel']")?.click();
      await pending;
    });
  });
});
