// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SE_CATALOG } from "@/assets/seCatalog";
import { playAudioBodyForTest } from "@/editor/panels/eventEditor/commandBodyAdvanced";
import { getAudioEngine } from "@/player/audio";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import assert from "node:assert/strict";
import { playBattle } from "@/player/playSceneBattle";
import { createDialogueUI } from "@/player/dialogue";
import { destroyBattleSceneOnHost } from "@/player/battleDom";
import { startSession } from "@/project/session";
import { ACTOR, TROOP, battleCase, choice, m2, mark } from "./battleEventRepairFlow.fixture";
import { playOpenChest } from "@/player/playSceneChest";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { deserialize, serialize } from "@/project/io";
import { playInn } from "@/player/playSceneCommerce";
import { updatePlayerPreferences } from "@/player/playerPreferences";
import { DEFAULT_ACTOR_ID, DEFAULT_STATE_ID } from "@/project/defaults/constants";
import { isolateTimers } from "./mergedTeardown";

describe("playAudioCommandBody", () => {
  isolateTimers();
  describe("playAudio command body", () => {
    let host: HTMLElement;
    let replaced: Command | null;

    beforeEach(() => {
      store.replace(createBlankProject());
      replaced = null;
      host = document.createElement("div");
      document.body.append(host);
    });

    afterEach(() => {
      host.remove();
      vi.restoreAllMocks();
    });

    it("lists playable BGM/SE and previews selected audio", () => {
      const body = playAudioBodyForTest(
        {
          path: [0],
          actions: {
            addCommand: () => undefined,
            insertCommand: () => undefined,
            replaceCommand: (_path, command) => {
              replaced = command;
            },
            deleteCommand: () => undefined,
            moveCommand: () => undefined,
          },
        },
        { kind: "playAudio", resourceId: "", loop: true }
      );
      host.append(body);

      expect(body.dataset.testid).toBe("play-audio-command-body");
      const select = body.querySelector('[data-testid="play-audio-resource-select"]') as HTMLSelectElement;
      expect(select.options.length).toBeGreaterThan(5);
      // first real option after (선택 없음) should be CC0 field loop for BGM
      const ids = Array.from(select.options).map((option) => option.value);
      expect(ids).toContain("cc0-music-field-loop");

      select.value = "cc0-music-field-loop";
      select.dispatchEvent(new Event("change"));
      expect(replaced).toMatchObject({
        kind: "playAudio",
        resourceId: "cc0-music-field-loop",
        loop: true,
      });

      const engine = getAudioEngine();
      const play = vi.spyOn(engine, "play").mockImplementation(() => undefined);
      (body.querySelector('[data-testid="play-audio-preview"]') as HTMLButtonElement).click();
      expect(body.querySelector('[data-testid="play-audio-status"]')?.textContent).toContain("재생 중");
      expect(play).toHaveBeenCalledWith(
        "bgm",
        "cc0-music-field-loop",
        "/assets/cc0/audio/field-loop.wav",
        true
      );

      // switch to SE catalog
      (body.querySelector('[data-testid="play-audio-channel-se"]') as HTMLButtonElement).click();
      expect((body.querySelector('[data-testid="play-audio-search"]') as HTMLInputElement).placeholder).toContain("행동");
      expect(body.querySelector('[data-testid="play-audio-resource-picker"]')?.textContent).toContain("효과음 목록");
      const seSelect = body.querySelector('[data-testid="play-audio-resource-select"]') as HTMLSelectElement;
      const seIds = Array.from(seSelect.options).map((option) => option.value);
      expect(seIds.filter((id) => id.startsWith("cc0-se-"))).toHaveLength(SE_CATALOG.length);
      expect(seIds[1]).toBe(SE_CATALOG[0]?.id);
      expect(seIds).toContain("easyrpg-sound-decision1");
      expect(seIds).toContain("cc0-sound-ui-confirm");

      // Scene-language tags from the shared SE library must work in the inline event form.
      const seSearch = body.querySelector('[data-testid="play-audio-search"]') as HTMLInputElement;
      seSearch.value = "구매";
      seSearch.dispatchEvent(new Event("input"));
      expect(Array.from(seSelect.options).map((option) => option.value)).toContain("cc0-se-orp-inventory-coin");

      seSelect.value = "cc0-se-orp-inventory-coin";
      seSelect.dispatchEvent(new Event("change"));
      expect(replaced).toMatchObject({
        kind: "playAudio",
        resourceId: "cc0-se-orp-inventory-coin",
        loop: false,
      });

      (body.querySelector('[data-testid="play-audio-preview"]') as HTMLButtonElement).click();
      expect(play).toHaveBeenLastCalledWith(
        "se",
        "cc0-se-orp-inventory-coin",
        "/assets/se/oga-rpg-pack/inventory/coin.wav",
        false
      );
    });

    it("does not stop audio when a form that never previewed is removed", async () => {
      const body = mountedAudioBody(host);
      const stop = vi.spyOn(getAudioEngine(), "stopAll");
      host.remove();
      await flushMutations();
      expect(body.isConnected).toBe(false);
      expect(stop).not.toHaveBeenCalled();
    });

    it("stops a preview when the form leaves the document", async () => {
      const body = mountedAudioBody(host);
      const engine = getAudioEngine();
      const stop = vi.spyOn(engine, "stopAll");
      vi.spyOn(engine, "play").mockImplementation(() => undefined);
      (body.querySelector('[data-testid="play-audio-preview"]') as HTMLButtonElement).click();
      // The preview button fades whatever was already playing, then starts this form's track.
      expect(stop).toHaveBeenCalledTimes(1);
      expect(stop).toHaveBeenCalledWith(true);

      host.remove();
      await flushMutations();
      expect(stop).toHaveBeenCalledTimes(2);
      expect(stop).toHaveBeenLastCalledWith(false);
    });

    it("shows authored loudness and keeps volume, fade, and BGS when the clip changes", () => {
      const body = playAudioBodyForTest(
        {
          path: [0],
          actions: {
            addCommand: () => undefined,
            insertCommand: () => undefined,
            replaceCommand: (_path, command) => {
              replaced = command;
            },
            deleteCommand: () => undefined,
            moveCommand: () => undefined,
          },
        },
        { kind: "playAudio", resourceId: "cc0-music-field-loop", loop: true, channel: "bgs", volume: 0.6, fadeInMs: 1500 }
      );
      host.append(body);

      const volume = body.querySelector('[data-testid="play-audio-volume"]') as HTMLInputElement;
      const fade = body.querySelector('[data-testid="play-audio-fade"]') as HTMLInputElement;
      expect(volume.value).toBe("60");
      expect(fade.value).toBe("1.5");
      expect(body.querySelector('[data-testid="play-audio-channel-note"]')?.textContent).toContain("환경음");

      const select = body.querySelector('[data-testid="play-audio-resource-select"]') as HTMLSelectElement;
      select.value = "cc0-bgm-town";
      select.dispatchEvent(new Event("change"));
      expect(replaced).toMatchObject({
        kind: "playAudio",
        resourceId: "cc0-bgm-town",
        loop: true,
        channel: "bgs",
        volume: 0.6,
        fadeInMs: 1500,
      });

      volume.value = "40";
      volume.dispatchEvent(new Event("change"));
      expect(replaced).toMatchObject({ volume: 40, channel: "bgs", fadeInMs: 1500 });

      fade.value = "0";
      fade.dispatchEvent(new Event("change"));
      expect(replaced).toMatchObject({ volume: 40, fadeInMs: 0, channel: "bgs" });
    });
  });
  function mountedAudioBody(parent: HTMLElement): HTMLElement {
    const body = playAudioBodyForTest(
      {
        path: [0],
        actions: {
          addCommand: () => undefined,
          insertCommand: () => undefined,
          replaceCommand: () => undefined,
          deleteCommand: () => undefined,
          moveCommand: () => undefined,
        },
      },
      { kind: "playAudio", resourceId: "cc0-music-field-loop", loop: true }
    );
    parent.append(body);
    return body;
  }
  function flushMutations(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
});

describe("playScene", () => {
  isolateTimers();
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
});
