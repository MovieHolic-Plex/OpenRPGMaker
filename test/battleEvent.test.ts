// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import assert from "node:assert/strict";
import { mountBattleScene, destroyBattleSceneOnHost } from "@/player/battleDom";
import { createDialogueUI } from "@/player/dialogue";
import { store } from "@/project/store";
import { battleCase, mark, variables, choice } from "./battleEventRepairFlow.fixture";
import { type EventPause, acknowledge, eventPause } from "./battleEventSequential.fixture";
import { createBattleSequencer } from "@/player/battleSequencer";
import type { BattleEventChoiceSnapshot } from "@/battle/types";
import { createBattleTransition } from "@/player/battleTransition";
import { isolateTimers } from "./mergedTeardown";

describe("battleEventTextHost", () => {
  isolateTimers();
  const previous = store.getCurrent();
  const hosts: HTMLElement[] = [];
  const keys = new Set<EventListenerOrEventListenerObject>();
  beforeEach(() => {
    vi.useFakeTimers();
    const add = document.addEventListener.bind(document);
    vi.spyOn(document, "addEventListener").mockImplementation((type, listener, options) => {
      if (type === "keydown") keys.add(listener);
      add(type, listener, options);
    });
  });
  afterEach(() => {
    for (const host of hosts.splice(0)) { destroyBattleSceneOnHost(host); host.remove(); }
    for (const listener of keys) document.removeEventListener("keydown", listener);
    keys.clear();
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
    store.replaceProject(previous);
  });
  for (const flow of ["gauge", "strict"] as const) describe(`battle real dialogue host / ${flow}`, () => {
    it("renders nondefault face/settings and acknowledges every real page before the tail", async () => {
      const { runtime, project } = battleCase({ flow, commands: [
        { kind: "changeFace", resourceId: "face-test", position: "right", flipHorizontally: true },
        { kind: "displayTextSettings", format: "transparent", position: "top",
          preventObscuringPlayer: false, allowEventMovementDuringWait: true },
        { kind: "setVariable", variableId: "1", op: "=", value: 37 },
        { kind: "text", speaker: "Guard", body: "Token \\v[1]\nTwo\nThree\nFour\nLast page", emotion: "angry" },
        mark("afterText"),
      ] });
      store.replaceProject(project);
      const host = document.createElement("div");
      document.body.append(host);
      hosts.push(host);
      const dialogue = createDialogueUI(host);
      let shown = 0;
      const options = {
        host, runtime, introHold: false, onResult: () => undefined,
        showEventText: (request: Extract<EventPause, { kind: "text" }>, signal: AbortSignal) => {
          shown += 1;
          const textRequest = {
            ...request, signal, playerTileY: 0, mapHeight: 20,
            textContext: { project, session: { variables: variables(runtime), actorNames: {} } },
          };
          return dialogue.showText(textRequest);
        },
      };
      const recurringClock = vi.spyOn(window, "setInterval");
      const controller = mountBattleScene(options);
      // Freeze only the real ATB interval registered by this host. The finite
      // action/typewriter timer graph below still uses its production callbacks.
      for (const timer of recurringClock.mock.results) {
        if (timer.type === "return") window.clearInterval(timer.value);
      }
      const defend = controller.root.querySelector<HTMLElement>("[data-testid='actor-command-defend']");
      assert.ok(defend);
      defend.focus();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      // Execute the finite action/typewriter timer graph, never sleep for it.
      await vi.runAllTimersAsync();
      expect(shown, "the battle host must call the existing DialogueUI text surface").toBe(1);
      expect(controller.root.querySelector<HTMLElement>("[data-testid='battle-message-window']")?.style.visibility,
        "transparent event text must not overlap the battle director's previous text").toBe("hidden");
      expect(variables(runtime).afterText ?? 0).toBe(0);
      expect(host.querySelector(".dialogue-box .body")?.textContent).toContain("37");
      expect(host.querySelector(".dialogue-content")?.classList.contains("face-right")).toBe(true);
      expect(host.querySelector(".dialogue-overlay")?.className).toContain("top");
      expect(host.querySelector(".dialogue-box")?.className).toContain("transparent");
      expect(host.querySelector(".dialogue-box .body")?.textContent).not.toContain("Last page");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await vi.runAllTimersAsync();
      expect(host.querySelector(".dialogue-box .body")?.textContent).toContain("Last page");
      expect(variables(runtime).afterText ?? 0).toBe(0);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await vi.runAllTimersAsync();
      expect(variables(runtime).afterText).toBe(1);
      expect(shown).toBe(1);
    });
  });
});

describe("battleEventSequentialHost", () => {
  isolateTimers();
  const previous = store.getCurrent();
  const hosts: HTMLElement[] = [];
  afterEach(() => {
    for (const host of hosts.splice(0)) {
      destroyBattleSceneOnHost(host);
      host.remove();
    }
    vi.restoreAllMocks();
    store.replaceProject(previous);
  });
  for (const flow of ["gauge", "strict"] as const) describe(`event host / ${flow}`, () => {
    it.each([false, true])("uses a raw 500 ms wait after prior beats with reduced motion=%s", reduced => {
      vi.spyOn(window, "matchMedia").mockImplementation(query => ({
        matches: reduced, media: query, onchange: null,
        addListener: () => undefined, removeListener: () => undefined,
        addEventListener: () => undefined, removeEventListener: () => undefined,
        dispatchEvent: () => true,
      }));
      const { runtime } = battleCase({ flow, commandKind: "attack", commands: [
        { kind: "wait", ms: 500 }, mark("afterWait"), choice(),
      ] });
      const before = runtime.snapshot();
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      expect(variables(runtime).afterWait ?? 0, "runtime must suspend before the host clock starts").toBe(0);
      let now = 0;
      let nextId = 0;
      const queue = new Map<number, { callback: () => void; at: number; ms: number }>();
      let damagePresented = false;
      let busy = false;
      const sequencer = createBattleSequencer(runtime, {
        onDirectorState: () => undefined, onSyncView: () => undefined,
        onDamageFeedback: feedback => { if (feedback) damagePresented = true; },
        onResultStage: () => undefined, onSequenceBusy: value => { busy = value; },
      }, (callback, ms) => {
        const id = ++nextId;
        queue.set(id, { callback, ms, at: now + ms });
        return id;
      }, id => { queue.delete(id); });
      sequencer.speedMultiplier = 5;
      try {
        sequencer.runAfterActorCommand({ kind: "attack", targetEnemyId: "enemy-1" }, before, runtime.snapshot());
        // Execute scheduled presentation events, not wall-clock sleeps or retries.
        for (let events = 0; events < 32; events += 1) {
          const next = [...queue].sort((a, b) => a[1].at - b[1].at)[0];
          assert.ok(next, "presentation must schedule the authored wait");
          if (next[1].ms === 500) break;
          queue.delete(next[0]);
          now = next[1].at;
          next[1].callback();
        }
        const wait = [...queue].find(([, task]) => task.ms === 500);
        assert.ok(wait, "speed/reduced-motion must not shorten authored 500 ms");
        expect(damagePresented).toBe(true);
        expect(busy).toBe(true);
        now += 499;
        expect(now).toBeLessThan(wait[1].at);
        expect(variables(runtime).afterWait ?? 0).toBe(0);
        now += 1;
        expect(now).toBe(wait[1].at);
        queue.delete(wait[0]);
        wait[1].callback();
        expect(variables(runtime).afterWait).toBe(1);
        expect(runtime.snapshot().eventChoice).toBeDefined();
      } finally {
        sequencer.cancel();
        runtime.cancel();
        expect(queue.size).toBe(0);
      }
    });

    it.each(["destroy", "replace"] as const)("%s cancels pending input and rejects its late response", mode => {
      const { runtime, project } = battleCase({ flow, commands: [{ kind: "inputWait" }, mark("late")] });
      runtime.performActorCommand({ kind: "defend" });
      expect(variables(runtime).late ?? 0).toBe(0);
      const request = eventPause(runtime);
      store.replaceProject(project);
      const host = document.createElement("div");
      document.body.append(host);
      hosts.push(host);
      const controller = mountBattleScene({ host, runtime, introHold: false, onResult: () => undefined });
      if (mode === "destroy") controller.destroy();
      else {
        const replacement = battleCase({ flow, commands: [] });
        mountBattleScene({ host, runtime: replacement.runtime, introHold: false, onResult: () => undefined });
      }
      expect(acknowledge(runtime, request.id, { kind: "inputWait", keyCode: 5 })).toBe(false);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      expect(variables(runtime).late ?? 0).toBe(0);
      expect(runtime.snapshot().result).toBeUndefined();
    });
  });
});

describe("battleEventChoiceHost", () => {
  isolateTimers();
  const previousProject = store.getCurrent();
  const hosts: HTMLElement[] = [];
  function host() {
    const node = document.createElement("div"); document.body.append(node); hosts.push(node); return node;
  }
  function key(value: string, repeat = false) {
    (document.activeElement ?? document).dispatchEvent(new KeyboardEvent("keydown", { key: value, repeat, bubbles: true, cancelable: true }));
  }
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    for (const node of hosts.splice(0)) { destroyBattleSceneOnHost(node); node.remove(); }
    vi.clearAllTimers(); vi.useRealTimers(); store.replaceProject(previousProject);
  });
  for (const flow of ["gauge", "strict"] as const) describe(`battle choice host / ${flow}`, () => {
    it("plays the preceding action before opening real keyboard choices, then resumes the selected branch", async () => {
      const { project, runtime } = battleCase({ flow, route: "mixed", commands: [choice()] });
      store.replaceProject(project);
      const node = host();
      const dialogue = createDialogueUI(node);
      let shown = 0;
      const options = { host: node, runtime, introHold: false, onResult: () => undefined,
        showEventChoices: (request: BattleEventChoiceSnapshot, signal: AbortSignal) => {
          shown += 1;
          return dialogue.showChoices({ ...request, options: request.options.map(option => ({ ...option })), signal, playerTileY: 0, mapHeight: 20 });
        },
      };
      const controller = mountBattleScene(options);
      const defend = controller.root.querySelector<HTMLElement>("[data-testid='actor-command-defend']");
      assert.ok(defend); defend.focus(); key("Enter");
      expect(variables(runtime).first).toBe(0);
      expect(shown).toBe(0);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(shown).toBe(1);
      expect(node.querySelector("[data-testid='runtime-choices']")).not.toBeNull();
      const held = structuredClone(runtime.snapshot());
      key("f"); key("Shift"); key("Enter", true); key("Escape");
      expect(runtime.snapshot()).toEqual(held);
      key("ArrowDown");
      expect(document.activeElement?.getAttribute("data-testid")).toBe("runtime-choice-1");
      key("Enter");
      await vi.advanceTimersByTimeAsync(30_000);
      expect(variables(runtime)).toMatchObject({ first: 0, second: 1, after: 1, later: 1, tail_0: 1, tail_1: 1, tail_2: 1 });
      expect(shown).toBe(1);
      expect(controller.root.dataset.battleAuto).not.toBe("true");
    });

    it("a missing input host does not select a branch or resume AUTO", async () => {
      const { project, runtime } = battleCase({ flow, commands: [choice()] }); store.replaceProject(project);
      const node = host();
      const controller = mountBattleScene({ host: node, runtime, introHold: false, onResult: () => undefined });
      const defend = controller.root.querySelector<HTMLElement>("[data-testid='actor-command-defend']");
      assert.ok(defend); defend.focus(); key("Enter");
      await vi.advanceTimersByTimeAsync(30_000);
      expect(variables(runtime)).toMatchObject({ first: 0, second: 0, after: 0, later: 0 });
      expect(runtime.snapshot().phase).toBe("eventChoice");
    });

    it("host destruction aborts pending input and rejects a late answer", async () => {
      const { project, runtime } = battleCase({ flow, commands: [choice(), mark("late")] }); store.replaceProject(project);
      const node = host();
      let signal: AbortSignal | undefined;
      let answer: ((index: number) => void) | undefined;
      let destroyed = 0;
      const options = { host: node, runtime, introHold: false, onResult: () => undefined,
        onDestroy: () => { destroyed += 1; },
        showEventChoices: (_request: unknown, inputSignal: AbortSignal) => {
          signal = inputSignal; return new Promise<number>(resolve => { answer = resolve; });
        },
      };
      const controller = mountBattleScene(options);
      const defend = controller.root.querySelector<HTMLElement>("[data-testid='actor-command-defend']");
      assert.ok(defend); defend.focus(); key("Enter");
      await vi.advanceTimersByTimeAsync(30_000);
      expect(variables(runtime).first).toBe(0);
      assert.ok(signal && answer);
      destroyBattleSceneOnHost(node); controller.destroy();
      expect(signal.aborted).toBe(true);
      answer(1);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(destroyed).toBe(1);
      expect(variables(runtime)).toMatchObject({ first: 0, second: 0, after: 0 });
      expect(variables(runtime).late).toBeUndefined();
      expect(runtime.snapshot().result).toBeUndefined();
    });
  });
  describe("choice and transition cancellation", () => {
    it.each(["abort", "hide", "replace"] as const)("%s removes the choice listener and settles cancellation", async mode => {
      const node = host(); const dialogue = createDialogueUI(node); const controller = new AbortController();
      const request = { options: [{ text: "A" }, { text: "B" }], playerTileY: 0, mapHeight: 20, signal: controller.signal };
      const outcome = dialogue.showChoices(request).then(value => ({ value }), error => ({ error }));
      let replacement: Promise<number> | undefined;
      if (mode === "abort") controller.abort();
      else if (mode === "hide") dialogue.hide();
      else replacement = dialogue.showChoices({ ...request, signal: undefined });
      if (mode !== "replace") expect(node.querySelector("[data-testid='runtime-choices']")).toBeNull();
      // A key cannot resurrect/resolve the cancelled operation. For replacement,
      // it settles only the new listener, making a missing cancellation fail fast.
      key("ArrowDown"); key("Enter");
      if (replacement) expect(await replacement).toBe(1);
      expect(await outcome).toMatchObject({ error: { name: "AbortError" } });
    });

    it("destroying a transition settles the wait and prevents its next phase", async () => {
      const node = host(); const transition = createBattleTransition(node);
      const cover = transition.cover(); transition.destroy();
      await vi.runAllTimersAsync();
      expect(vi.getTimerCount()).toBe(0);
      expect(node.querySelector("[data-testid='battle-transition-overlay']")).toBeNull();
      // Bounded by Vitest's test timeout; no polling or sleep.
      await cover;
    });
  });
});
