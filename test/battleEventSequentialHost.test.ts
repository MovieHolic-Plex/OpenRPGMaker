/** @vitest-environment happy-dom */
import assert from "node:assert/strict";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBattleSequencer } from "@/player/battleSequencer";
import { destroyBattleSceneOnHost, mountBattleScene } from "@/player/battleDom";
import { store } from "@/project/store";
import { battleCase, choice, mark, variables } from "./battleEventRepairFlow.fixture";
import { acknowledge, eventPause } from "./battleEventSequential.fixture";

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
