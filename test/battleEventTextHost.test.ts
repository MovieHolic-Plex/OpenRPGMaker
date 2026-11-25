/** @vitest-environment happy-dom */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountBattleScene, destroyBattleSceneOnHost } from "@/player/battleDom";
import { createDialogueUI } from "@/player/dialogue";
import { store } from "@/project/store";
import { battleCase, mark, variables } from "./battleEventRepairFlow.fixture";
import type { EventPause } from "./battleEventSequential.fixture";

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
