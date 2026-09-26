import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SharedContentLibrary, SharedContentSnapshot } from "@/project/sharedContentSchema";

const cache = new Map<string, { scope: string; etag: string; value: SharedContentSnapshot }>();
vi.mock("@/project/sharedContentCache", () => ({
  readSharedContentCache: async (scope: string) => cache.get(scope) ?? null,
  writeSharedContentCache: async (scope: string, etag: string, value: SharedContentSnapshot) => { cache.set(scope, { scope, etag, value }); },
}));
vi.mock("@/project/defaults/spatial/reviewedPlaceCatalog", () => ({ installSharedReviewedPlaces: () => {} }));

const lib = (projectDefaults: boolean, source: string): SharedContentLibrary => ({
  version: 1, ...(projectDefaults ? { projectDefaults: true } : {}), roots: [], places: {}, tilesets: {}, assets: {}, maps: {}, sourceProjectId: source, previews: {},
} as SharedContentLibrary);

type Host = { revision: string; defaults: SharedContentLibrary; catalog: SharedContentLibrary };
let host: Host;
const calls: { scope: string; ifNoneMatch: string | null; status: number }[] = [];

function respond(url: string, init?: RequestInit): Response {
  const scope = new URL(url, "http://host").searchParams.get("scope") ?? "all";
  const etag = `"${scope}-${host.revision}"`;
  const ifNoneMatch = new Headers(init?.headers).get("if-none-match");
  const libraries = scope === "defaults" ? { defaults: host.defaults } : scope === "rest" ? { catalog: host.catalog } : { defaults: host.defaults, catalog: host.catalog };
  const status = ifNoneMatch === etag ? 304 : 200;
  calls.push({ scope, ifNoneMatch, status });
  if (status === 304) return new Response(null, { status: 304, headers: { etag } });
  return new Response(JSON.stringify({ revision: host.revision, libraries }), { status: 200, headers: { etag, "content-type": "application/json" } });
}

beforeEach(() => {
  vi.resetModules();
  cache.clear();
  calls.length = 0;
  host = { revision: "r1", defaults: lib(true, "d1"), catalog: lib(false, "c1") };
  vi.stubGlobal("window", {});
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => respond(url, init)));
});
afterEach(() => vi.unstubAllGlobals());

async function bootOnce() {
  // 페이지를 다시 여는 것과 같다 — 모듈 상태는 새로, 기기 캐시(위 mock)는 그대로.
  vi.resetModules();
  const mod = await import("@/project/sharedContent");
  await mod.loadSharedContent({ scope: "defaults" });
  await mod.loadSharedContent({ scope: "rest" });
  return mod.sharedContentSnapshot();
}

describe("shared content boot fetch", () => {
  it("fetches defaults then only the rest, and installs the whole catalog", async () => {
    const snapshot = await bootOnce();
    expect(calls.map(c => `${c.scope} ${c.status}`)).toEqual(["defaults 200", "rest 200"]);
    expect(Object.keys(snapshot.libraries).sort()).toEqual(["catalog", "defaults"]);
    expect(snapshot.revision).toBe("r1");
  });

  it("reuses the device copy on the next boot when the host answers 304", async () => {
    await bootOnce();
    calls.length = 0;
    const snapshot = await bootOnce();
    expect(calls.map(c => `${c.scope} ${c.status}`)).toEqual(["defaults 304", "rest 304"]);
    expect(calls.every(c => c.ifNoneMatch === `"${c.scope}-r1"`)).toBe(true);
    expect(Object.keys(snapshot.libraries).sort()).toEqual(["catalog", "defaults"]);
  });

  it("takes the new revision after the host republishes", async () => {
    await bootOnce();
    host = { revision: "r2", defaults: lib(true, "d2"), catalog: lib(false, "c2") };
    calls.length = 0;
    const snapshot = await bootOnce();
    expect(calls.map(c => `${c.scope} ${c.status}`)).toEqual(["defaults 200", "rest 200"]);
    expect(snapshot.revision).toBe("r2");
    expect(snapshot.libraries.catalog?.sourceProjectId).toBe("c2");
  });

  it("refetches the whole catalog when the rest belongs to a different revision than defaults", async () => {
    const mod = await import("@/project/sharedContent");
    await mod.loadSharedContent({ scope: "defaults" });
    host = { ...host, revision: "r2", catalog: lib(false, "c2") };
    await mod.loadSharedContent({ scope: "rest" });
    expect(calls.map(c => `${c.scope} ${c.status}`)).toEqual(["defaults 200", "rest 200", "all 200"]);
    expect(mod.sharedContentSnapshot().revision).toBe("r2");
  });
});
