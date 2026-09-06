import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { armEventCommandObservation, eventCommandQaOp } from "../../scripts/lib/runtimeQaEventCommands.mjs";
import { buildHarnessFixture, loadUnitFixture, prepareUnitFixture } from "../../scripts/prepare-event-command-remediation.mts";
import { deserialize } from "../../src/project/io";
import type { RuntimeQaEventCommandOp } from "../../scripts/lib/runtimeQa.d.mts";

declare global {
  interface Window {
    __h0Resources: () => { observers: number; listeners: number; timers: number };
  }
}
import { normalizeScenario } from "../../scripts/lib/runtimeQa.mjs";

describe("event-command remediation harness", () => {
  it("accepts observe-before-trigger operations at the existing scenario seam", () => {
    const op = {
      kind: "eventCommand" as const,
      trigger: { kind: "key" as const, key: "z" },
      observe: [{ source: "state" as const, path: ["switches", "h0"], equals: true }],
      timeoutMs: 1000,
    };
    expect(normalizeScenario({
      id: "h0", beats: [{ id: "exact-marker", ops: [op] }],
    }).beats[0]?.ops).toEqual([op]);
  });
});

const operation = (overrides: Partial<RuntimeQaEventCommandOp> = {}): RuntimeQaEventCommandOp => ({
  kind: "eventCommand", trigger: { kind: "key", key: "z" }, timeoutMs: 1000,
  observe: [{ source: "state", path: ["events", "host", "value"], equals: 7 }],
  ...overrides,
});

// These assertions run in Chromium, not a polling or fake MutationObserver DOM.
describe("native event subscriptions", () => {
  let browser: Browser;
  let page: Page;
  beforeAll(async () => { browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] }); });
  afterAll(async () => { await browser?.close(); });
  beforeEach(async () => {
    page = await browser.newPage();
    await page.setContent('<pre data-testid="runtime-state-json">{"events":{"host":{"value":0},"other":{"value":0}}}</pre><video id="host"></video><video id="other"></video>');
    // Time is the behavior under test in timeout cases, so advance this explicit clock only there.
    await page.clock.install();
    await page.evaluate(() => {
      const observers = new Set<MutationObserver>();
      const listeners = new Map<EventTarget, Set<EventListenerOrEventListenerObject>>();
      const timers = new Set<number>();
      const NativeObserver = window.MutationObserver;
      window.MutationObserver = class extends NativeObserver {
        override observe(target: Node, options: MutationObserverInit) { observers.add(this); super.observe(target, options); }
        override disconnect() { observers.delete(this); super.disconnect(); }
      };
      const add = EventTarget.prototype.addEventListener;
      const remove = EventTarget.prototype.removeEventListener;
      EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (listener && ["ended", "pagehide", "abort"].includes(type)) {
          const entries = listeners.get(this) ?? new Set<EventListenerOrEventListenerObject>();
          entries.add(listener); listeners.set(this, entries);
        }
        add.call(this, type, listener, options);
      };
      EventTarget.prototype.removeEventListener = function(type, listener, options) {
        if (listener && ["ended", "pagehide", "abort"].includes(type)) listeners.get(this)?.delete(listener);
        remove.call(this, type, listener, options);
      };
      window.setTimeout = new Proxy(window.setTimeout, { apply(target, self, args) {
        const id = Reflect.apply(target, self, args); timers.add(Number(id)); return id;
      } });
      window.clearTimeout = new Proxy(window.clearTimeout, { apply(target, self, args) {
        timers.delete(Number(args[0])); return Reflect.apply(target, self, args);
      } });
      window.__h0Resources = () => ({ observers: observers.size, timers: timers.size,
        listeners: [...listeners.values()].reduce((count, entries) => count + entries.size, 0) });
      document.addEventListener("keydown", event => {
        if (event.key !== "z") return;
        const mirror = document.querySelector('[data-testid="runtime-state-json"]');
        if (!mirror) throw new Error("Missing test mirror");
        mirror.textContent = JSON.stringify({ events: { host: { value: 7 }, other: { value: 0 } } });
      });
    });
  });
  afterEach(async () => {
    try {
      expect(await page.evaluate(() => window.__h0Resources())).toEqual({ observers: 0, listeners: 0, timers: 0 });
    } finally { await page.close(); }
  });

  it("observes the exact target before real key input, retains untouched target and disposes", async () => {
    const result = await eventCommandQaOp(page, operation({ observe: [
      { source: "state", path: ["events", "host", "value"], equals: 7 },
      { source: "state", path: ["events", "other", "value"], equals: 0 },
      { source: "dom", selector: "#host", read: "property", name: "paused", equals: true },
    ] }));
    expect(result.before).toEqual([{ value: 0 }, { value: 0 }, { value: true }]);
    expect(result.after).toEqual([{ value: 7 }, { value: 0 }, { value: true }]);
    expect(result.status).toBe("success");
    expect(await page.evaluate(() => window.__eventCommandQa === undefined)).toBe(true);
  });

  it.each(["wrong-target", "wrong-result"])("rejects %s and disconnects on the bounded timeout", async (kind) => {
    const op = operation({ observe: [{ source: "state", path: ["events", kind === "wrong-target" ? "other" : "host", "value"], equals: kind === "wrong-target" ? 7 : 8 }] });
    await page.evaluate(armEventCommandObservation, op);
    await page.evaluate(() => window.__eventCommandQa?.start());
    await page.keyboard.press("z");
    await page.clock.runFor(1000);
    const result = await page.evaluate(() => window.__eventCommandQa?.result);
    expect(result?.status).toBe("timeout");
    expect(result?.after).toEqual([{ value: kind === "wrong-target" ? 0 : 7 }]);
  });

  it("requires the exact media event target, including newly mounted media", async () => {
    const op = operation({ event: { type: "ended", selector: "#new-media" }, observe: [
      { source: "dom", selector: "#new-media", read: "attribute", name: "data-result", equals: "done" },
    ] });
    await page.evaluate(armEventCommandObservation, op);
    await page.evaluate(() => {
      window.__eventCommandQa?.start();
      const video = document.createElement("video"); video.id = "new-media"; video.dataset.result = "done";
      document.body.append(video);
      document.querySelector("#other")?.dispatchEvent(new Event("ended"));
      window.__eventCommandQa?.check();
    });
    expect(await page.evaluate(() => window.__eventCommandQa?.trace.status)).toBe("armed");
    await page.evaluate(() => document.querySelector("#new-media")?.dispatchEvent(new Event("ended")));
    const result = await page.evaluate(() => window.__eventCommandQa?.result);
    expect(result?.status).toBe("success");
    expect(result?.event).toEqual({ type: "ended", selector: "#new-media" });
  });

  it.each(["abort", "pagehide"])("cleans every subscription on %s", async (kind) => {
    await page.evaluate(armEventCommandObservation, operation({ event: { type: "ended", selector: "#host" } }));
    expect(await page.evaluate(() => window.__h0Resources())).toEqual({ observers: 1, listeners: 3, timers: 1 });
    await page.evaluate(kind => {
      if (kind === "abort") window.__eventCommandQa?.abort();
      else window.dispatchEvent(new Event("pagehide"));
    }, kind);
    expect((await page.evaluate(() => window.__eventCommandQa?.result))?.status).toBe("aborted");
  });

  it("cleans on failed input instead of leaving the observation armed", async () => {
    await expect(eventCommandQaOp(page, operation({ trigger: { kind: "action" } }))).rejects.toThrow();
    expect(await page.evaluate(() => window.__eventCommandQa === undefined)).toBe(true);
  });

  it("does not accept an equal pre-existing export without its subscribed acknowledgement", async () => {
    const op = operation({ trigger: { kind: "none" }, mutation: '[data-testid="runtime-state-json"]', observe: [
      { source: "state", path: ["events", "host", "value"], equals: 0 },
    ] });
    await page.evaluate(armEventCommandObservation, op);
    await page.evaluate(() => { window.__eventCommandQa?.start(); window.__eventCommandQa?.check(); });
    expect(await page.evaluate(() => window.__eventCommandQa?.trace.status)).toBe("armed");
    await page.evaluate(() => {
      const mirror = document.querySelector('[data-testid="runtime-state-json"]');
      if (mirror) mirror.textContent = mirror.textContent;
    });
    expect((await page.evaluate(() => window.__eventCommandQa?.result))?.status).toBe("success");
  });
});

describe("lazy temporary fixture preparation", () => {
  it("loads H0 without importing nonexistent later units and writes a reloadable fixture only on request", async () => {
    const directory = await mkdtemp(join(tmpdir(), "h0-fixture-test-"));
    try {
      const fixture = await loadUnitFixture("H0");
      expect(fixture.startPos).toEqual({ x: 2, y: 3 });
      expect(fixture.maps[fixture.startMapId]?.events[0]?.id).toBe("host");
      const path = await prepareUnitFixture("H0", directory);
      const reloaded = deserialize(await readFile(path, "utf8"));
      expect(reloaded.maps[reloaded.startMapId]?.events).toEqual(buildHarnessFixture().maps.map_intro?.events);
      await expect(prepareUnitFixture("H0", directory)).rejects.toMatchObject({ code: "EEXIST" });
      await expect(loadUnitFixture("../U02")).rejects.toThrow();
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
