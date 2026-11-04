/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { backgroundPreloadTurn, holdBackgroundPreload, preloadUrls } from "@/player/scenePreload";

const body = (text: string) => new Response(new Blob([text]).stream(), { status: 200 });

describe("background preload yields to a running opening", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("low-priority files wait while an opening holds the gate, then resume on release", async () => {
    const fetched: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { fetched.push(url); return body("x"); }));
    const release = holdBackgroundPreload();
    let finished = false;
    const done = preloadUrls(["/a.png", "/b.png"], { priority: "low", concurrency: 1 }).finally(() => { finished = true; });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(finished).toBe(false);
    expect(fetched).toEqual([]);
    release();
    await expect(done).resolves.toMatchObject({ doneFiles: 2, totalFiles: 2 });
    expect(fetched).toEqual(["/a.png", "/b.png"]);
  });

  it("high-priority (screen-requested) files are never held", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => body("y")));
    const release = holdBackgroundPreload();
    try {
      await expect(preloadUrls(["/c.png"], { priority: "high" })).resolves.toMatchObject({ doneFiles: 1 });
    } finally { release(); }
  });

  it("a release called twice does not free another holder", async () => {
    const first = holdBackgroundPreload(), second = holdBackgroundPreload();
    first(); first();
    let passed = false;
    void backgroundPreloadTurn().then(() => { passed = true; });
    await Promise.resolve();
    expect(passed).toBe(false);
    second();
    await Promise.resolve();
    expect(passed).toBe(true);
  });
});
