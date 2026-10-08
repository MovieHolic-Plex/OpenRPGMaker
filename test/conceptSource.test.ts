import { describe, expect, it, vi } from "vitest";
import type { OprnStoreBridge } from "@/assetStore/bridgeTypes";
import { CONCEPT_FALLBACK_THUMB, bundledConcepts, conceptFallbackOf, createConceptSource, similarFrom } from "@/concepts/source";
import type { GameConcept } from "@/concepts/format";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

function storeConcept(slug: string, tags: GameConcept["tags"] = ["웹소설"]): GameConcept {
  return {
    ...bundledConcepts()[0]!, slug, tags, thumb: { full: SHA_A, card: SHA_B },
  };
}

function fakeBridge(overrides: Partial<OprnStoreBridge>): OprnStoreBridge {
  return overrides as OprnStoreBridge;
}

describe("concept source", () => {
  it("ships a valid offline bundle", () => {
    expect(bundledConcepts().length).toBeGreaterThanOrEqual(7);
    for (const concept of bundledConcepts()) expect(concept.thumb.card.startsWith("/assets/concepts/")).toBe(true);
  });

  it("uses the bundle without a bridge and filters by tag", async () => {
    const source = createConceptSource({ bridge: null });
    const page = await source.page({ tag: "추리" }, null);
    expect(page.fallback).toBe("bundled");
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((concept) => concept.tags.includes("추리"))).toBe(true);
  });

  it("falls back to the bundle when the store is slow", async () => {
    vi.useFakeTimers();
    const source = createConceptSource({ bridge: fakeBridge({ concepts: () => new Promise(() => {}) }), timeoutMs: 3000 });
    const pending = source.page({}, null);
    await vi.advanceTimersByTimeAsync(3001);
    const page = await pending;
    vi.useRealTimers();
    expect(page.fallback).toBe("offline");
    expect(page.items.length).toBe(bundledConcepts().length);
  });

  it("returns store pages when the store answers", async () => {
    const items = [storeConcept("store-one-abcdef")];
    const source = createConceptSource({ bridge: fakeBridge({ concepts: async () => ({ items, nextCursor: "3:9" }) }) });
    const page = await source.page({}, null);
    expect(page).toEqual({ items, nextCursor: "3:9", fallback: null });
  });

  it("stops (does not mix in the bundle) when a later store page fails", async () => {
    const source = createConceptSource({ bridge: fakeBridge({ concepts: async () => { throw new Error("down"); } }) });
    expect(await source.page({}, "3:9")).toEqual({ items: [], nextCursor: null, fallback: "offline" });
  });

  it("does not blame the internet when the store answered but has no concepts", async () => {
    // 메인 중계가 넘기는 모양: Electron invoke 접두어 + {"message","status"} JSON.
    const notFound = new Error(`Error invoking remote method 'oprn:store-concepts': Error: {"message":"없는 주소입니다.","status":404,"details":[]}`);
    const unreachable = new Error(`Error invoking remote method 'oprn:store-concepts': Error: {"message":"fetch failed","status":0,"details":[]}`);
    expect(conceptFallbackOf(notFound)).toBe("bundled");
    expect(conceptFallbackOf(unreachable)).toBe("offline");
    expect(conceptFallbackOf(new Error("스토어 응답이 늦습니다."))).toBe("offline");
    const missing = createConceptSource({ bridge: fakeBridge({ concepts: async () => { throw notFound; } }) });
    expect((await missing.page({}, null)).fallback).toBe("bundled");
    const empty = createConceptSource({ bridge: fakeBridge({ concepts: async () => ({ items: [], nextCursor: null }) }) });
    const page = await empty.page({}, null);
    expect(page.fallback).toBe("bundled");
    expect(page.items.length).toBe(bundledConcepts().length);
  });

  it("downloads each store thumbnail once and falls back on failure", async () => {
    const blob = vi.fn(async () => new Uint8Array([1, 2, 3]));
    const source = createConceptSource({ bridge: fakeBridge({ blob }), toUrl: () => "blob:x" });
    const concept = storeConcept("store-two-abcdef");
    expect(await source.thumbUrl(concept, "full")).toBe("blob:x");
    expect(await source.thumbUrl(concept, "full")).toBe("blob:x");
    expect(blob).toHaveBeenCalledTimes(1);
    const failing = createConceptSource({ bridge: fakeBridge({ blob: async () => { throw new Error("no"); } }) });
    expect(await failing.thumbUrl(concept, "card")).toBe(CONCEPT_FALLBACK_THUMB[concept.presetId]);
  });

  it("keeps bundle thumbnails as paths", async () => {
    const concept = bundledConcepts()[0]!;
    expect(await createConceptSource({ bridge: null }).thumbUrl(concept, "card")).toBe(concept.thumb.card);
  });

  it("similar concepts exclude self and prefer shared tags", () => {
    const self = storeConcept("self-abcdef", ["추리", "호러"]);
    const pool = [self, storeConcept("both-abcdef", ["추리", "호러"]), storeConcept("one-abcdef", ["추리"]), storeConcept("none-abcdef", ["농장"])];
    const similar = similarFrom(pool, { ...self, presetId: "farm-life" });
    expect(similar.map((c) => c.slug)).toEqual(["both-abcdef", "one-abcdef"]);
  });
});
