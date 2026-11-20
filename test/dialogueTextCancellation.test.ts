/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDialogueUI } from "@/player/dialogue";
import { armDialogueConfirmRelease } from "@/player/confirmMashGuard";

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
  window.dispatchEvent(new Event("blur"));
  document.body.replaceChildren();
});

function confirm(key = "Enter", { repeat = false, at = 0, release = false } = {}): void {
  const event = new KeyboardEvent(release ? "keyup" : "keydown", { key, repeat, bubbles: true, cancelable: true });
  Object.defineProperty(event, "timeStamp", { value: at });
  document.dispatchEvent(event);
}

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

  it("ignores composing advance input", async () => {
    const { dialogue, request } = fixture();
    let finished = false;
    const shown = dialogue.showText(request).then(() => { finished = true; });
    await vi.runAllTimersAsync();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true }));
    confirm("Enter", { release: true });
    await Promise.resolve();
    expect(finished).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await shown;
    expect(finished).toBe(true);
  });

  it("repeats at 160ms across consecutive text commands in one event", async () => {
    const { dialogue, request } = fixture();
    const first = dialogue.showText(request);
    await vi.runAllTimersAsync();
    confirm("Enter", { at: 1000 });
    await first;

    let finished = false;
    const second = dialogue.showText({ ...request, body: "Still the same event" }).then(() => { finished = true; });
    await vi.runAllTimersAsync();
    confirm("Enter", { repeat: true, at: 1159 });
    await Promise.resolve();
    expect(finished).toBe(false);
    confirm("Enter", { repeat: true, at: 1160 });
    await second;
    expect(finished).toBe(true);
  });

  it.each(["Enter", " ", "z", "e"])("requires release and a fresh %j press after a dialogue boundary", async (key) => {
    const { dialogue, request, host } = fixture();
    const before = dialogue.showText(request);
    await vi.runAllTimersAsync();
    confirm(key, { at: 1000 });
    await before;

    armDialogueConfirmRelease();
    const after = dialogue.showText({ ...request, body: "First line after the boundary" });
    await vi.runAllTimersAsync();
    confirm(key, { repeat: true, at: 2000 });
    confirm(key, { at: 2200 });
    const otherKey = key === "Enter" ? "z" : "Enter";
    confirm(otherKey, { at: 2300 });
    confirm(otherKey, { release: true, at: 2350 });
    expect(host.querySelector(".dialogue-box.page-ready .body")?.textContent).toBe("First line after the boundary");

    confirm(key, { release: true, at: 2400 });
    confirm(key, { repeat: true, at: 2600 });
    expect(host.querySelector(".dialogue-box.page-ready .body")?.textContent).toBe("First line after the boundary");
    confirm(key, { at: 2800 });
    await after;
  });

  it.each(["keyup", "blur", "same event"])("requires a fresh choice press after %s", async (handoff) => {
    const { dialogue, request, host } = fixture();
    const before = dialogue.showText(request);
    await vi.runAllTimersAsync();
    confirm();
    await before;
    if (handoff !== "same event") {
      armDialogueConfirmRelease();
      if (handoff === "blur") window.dispatchEvent(new Event("blur"));
      else confirm("Enter", { release: true });
    }

    const choice = dialogue.showChoices({
      options: [{ text: "First" }, { text: "Second" }], playerTileY: 0, mapHeight: 20,
    });
    confirm("Enter", { repeat: true, at: 1000 });
    expect(host.querySelector(".choice-btn.selected")?.textContent).toBe("First");
    if (handoff === "same event") confirm("Enter", { release: true });
    confirm("Enter", { at: 1200 });
    await expect(choice).resolves.toBe(0);
  });
});
