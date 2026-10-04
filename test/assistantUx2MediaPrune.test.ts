import "fake-indexeddb/auto";
import { IDBFactory, IDBIndex, IDBObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityVisual } from "@/ai/activityVisual";

const visual: ActivityVisual = { kind: "record", title: "Fixture", caption: "fixture", phase: "read", target: "record:fixture" };
let archive: typeof import("@/ai/activityMediaArchive");
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal("indexedDB", new IDBFactory());
  archive = await import("@/ai/activityMediaArchive");
});
afterEach(async () => { await archive.flushActivityMedia(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function seedV1(rows: unknown[]) {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("oprn-ai-activity-media", 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore("media", { keyPath: "id" });
      rows.forEach(row => store.put(row));
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { request.result.close(); resolve(); };
  });
}

describe("activity media metadata pruning", () => {
  it("upgrades v1 once, retains its Blob, then prunes by keys with the same TTL and newest byte budget", async () => {
    const now = Date.now(), blob = new Blob(["historical pixels"], { type: "image/png" });
    // Large accounted sizes exercise the real budget without allocating large payload fixtures.
    await seedV1([
      { id: "a", at: now, visual, blob, bytes: 30_000_000 },
      { id: "b", at: now, visual, blob, bytes: 30_000_000 },
      { id: "c", at: now - 1, visual, blob, bytes: 30_000_000 },
      { id: "expired", at: now - 8 * 86400_000, visual, blob, bytes: 10 },
    ]);
    await archive.readActivityMedia("absent"); // Finish the only full-payload migration.
    const nativeCursor = IDBObjectStore.prototype.openCursor;
    vi.spyOn(IDBObjectStore.prototype, "openCursor").mockImplementation(function (...args) {
      if (this.name === "media") throw new Error("prune fetched visual bodies");
      return nativeCursor.apply(this, args);
    });
    vi.spyOn(IDBObjectStore.prototype, "getAll").mockImplementation(() => { throw new Error("prune fetched Blobs"); });
    const keys = vi.spyOn(IDBIndex.prototype, "openKeyCursor");
    archive.retainActivityVisuals("new", [visual]);
    await archive.flushActivityMedia();
    expect(keys).toHaveBeenCalled();
    expect(await archive.readActivityMedia("c")).toBeUndefined();
    expect(await archive.readActivityMedia("expired")).toBeUndefined();
    expect(await (await archive.readActivityMedia("a"))!.blob!.text()).toBe("historical pixels");
    expect(await archive.readActivityMedia("b")).toBeDefined();
  });

  it("bounds continuous-burst cleanup scheduling at five seconds while keeping a 600ms quiet delay", async () => {
    let now = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const timer = vi.spyOn(globalThis, "setTimeout");
    archive.retainActivityVisuals("first", [visual]);
    expect(timer.mock.calls.at(-1)![1]).toBe(600);
    now += 4900;
    archive.retainActivityVisuals("late", [visual]);
    expect(timer.mock.calls.at(-1)![1]).toBe(100);
    now += 101;
    archive.retainActivityVisuals("deadline", [visual]);
    expect(timer.mock.calls.at(-1)![1]).toBe(0);
    await archive.flushActivityMedia();
    now += 1;
    archive.retainActivityVisuals("next-burst", [visual]);
    expect(timer.mock.calls.at(-1)![1]).toBe(600);
  });
});
