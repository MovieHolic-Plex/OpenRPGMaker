/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDialogueUI } from "@/player/dialogue";

const ownedKeys = new Set<EventListenerOrEventListenerObject>();
beforeEach(() => {
  vi.useFakeTimers();
  const add = document.addEventListener.bind(document);
  vi.spyOn(document, "addEventListener").mockImplementation((type, listener, options) => {
    if (type === "keydown") ownedKeys.add(listener);
    add(type, listener, options);
  });
});
afterEach(() => {
  // RED must not leak the broken production listener into the next scenario.
  for (const listener of ownedKeys) document.removeEventListener("keydown", listener);
  ownedKeys.clear();
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.replaceChildren();
});

function fixture() {
  const host = document.createElement("div");
  document.body.append(host);
  const dialogue = createDialogueUI(host);
  const controller = new AbortController();
  const request = { body: "Ready", playerTileY: 0, mapHeight: 20, signal: controller.signal };
  return { host, dialogue, controller, request };
}

describe("dialogue text cancellation", () => {
  it("abort during entry cancels the typewriter and presentation timers immediately", async () => {
    const { dialogue, controller, request, host } = fixture();
    const cancelled = expect(dialogue.showText(request)).rejects.toMatchObject({ name: "AbortError" });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    controller.abort();
    await cancelled;
    expect(host.querySelector(".dialogue-box")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["abort", "hide", "close", "replace"] as const)("%s settles text cancellation and detaches its listener", async mode => {
    const { host, dialogue, controller, request } = fixture();
    const results: string[] = [];
    const outcome = dialogue.showText(request).then(
      () => results.push("resolved"),
      (error: unknown) => {
        if (!(error instanceof DOMException)) throw error;
        results.push(error.name);
      },
    );
    // Flush the explicitly controlled typewriter, not an elapsed-time guess.
    await vi.runAllTimersAsync();
    if (mode === "abort") controller.abort();
    else if (mode === "hide") dialogue.hide();
    else if (mode === "close") dialogue.close();
    else {
      const replacement = dialogue.showChoices({
        options: [{ text: "First" }, { text: "Second" }], playerTileY: 0, mapHeight: 20,
      });
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      expect(await replacement).toBe(1);
    }
    await Promise.resolve();
    expect(results, "cancelled text must reject rather than hang or accept a later key").toEqual(["AbortError"]);
    await outcome;
    await vi.runAllTimersAsync();
    expect(host.querySelector(".dialogue-box")).toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(results).toEqual(["AbortError"]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([{ repeat: true }, { isComposing: true }])("ignores held/composing advance input %j", async flags => {
    const { dialogue, request } = fixture();
    let finished = false;
    const shown = dialogue.showText(request).then(() => { finished = true; });
    await vi.runAllTimersAsync();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ...flags }));
    await Promise.resolve();
    expect(finished, "repeat/composition cannot acknowledge text").toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await shown;
    expect(finished).toBe(true);
  });
});
