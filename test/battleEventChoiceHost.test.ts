/** @vitest-environment happy-dom */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountBattleScene, destroyBattleSceneOnHost } from "@/player/battleDom";
import { createDialogueUI } from "@/player/dialogue";
import type { BattleEventChoiceSnapshot } from "@/battle/types";
import { createBattleTransition } from "@/player/battleTransition";
import { store } from "@/project/store";
import { battleCase, choice, mark, variables } from "./battleEventRepairFlow.fixture";

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
