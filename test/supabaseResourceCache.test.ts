import { describe, expect, it } from "vitest";
import {
  SUPABASE_RESOURCE_CACHE_NAME,
  cacheSupabaseRootResources,
  supabaseResourceCacheRequestUrl,
} from "@/assets/supabaseResourceCache";
import { createBlankProject } from "@/project/defaults";

class FakeCache {
  readonly writes = new Map<string, Response>();

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    this.writes.set(String(request), response);
  }
}

class FakeCacheStorage {
  readonly cache = new FakeCache();
  readonly openedNames: string[] = [];

  async open(name: string): Promise<FakeCache> {
    this.openedNames.push(name);
    return this.cache;
  }
}

describe("supabaseResourceCache", () => {
  it("caches Supabase-root uploaded image payloads under stable local cache URLs", async () => {
    // Given: a project loaded from Supabase where image bytes live in current_json.assets.uploaded.
    const project = createBlankProject();
    project.assets.uploaded["generated-actor-hero-01-battle"] = {
      id: "generated-actor-hero-01-battle",
      name: "Hero 01 Battle",
      kind: "battleCharset",
      dataUrl: "data:image/png;base64,AAEC",
      meta: { width: 144, height: 384 },
    };
    const cacheStorage = new FakeCacheStorage();

    // When: the resource cache is refreshed.
    const report = await cacheSupabaseRootResources(project, { cacheStorage });

    // Then: the asset is written to the named local cache and can survive local public file deletion.
    const cacheUrl = supabaseResourceCacheRequestUrl("generated-actor-hero-01-battle");
    const response = cacheStorage.cache.writes.get(cacheUrl);
    expect(cacheStorage.openedNames).toEqual([SUPABASE_RESOURCE_CACHE_NAME]);
    expect(report.cached).toEqual([
      {
        resourceId: "generated-actor-hero-01-battle",
        cacheUrl,
        contentType: "image/png",
        byteLength: 3,
      },
    ]);
    expect(report.skipped).toEqual([]);
    if (response === undefined) throw new Error("expected cached response");
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0, 1, 2]));
  });

  it("reports skipped resources when Cache API is unavailable or dataUrl is malformed", async () => {
    // Given: a Supabase project with one malformed uploaded asset and no browser Cache API.
    const project = createBlankProject();
    project.assets.uploaded["bad-resource"] = {
      id: "bad-resource",
      name: "Bad Resource",
      kind: "picture",
      dataUrl: "https://example.invalid/bad.png",
      meta: {},
    };

    // When: the cache refresh runs outside a cache-capable browser.
    const report = await cacheSupabaseRootResources(project, { cacheStorage: undefined });

    // Then: it is explicit about why the local cache could not be prepared.
    expect(report.cached).toEqual([]);
    expect(report.skipped).toEqual([
      {
        resourceId: "bad-resource",
        reason: "cache-api-unavailable",
      },
    ]);
  });
});
