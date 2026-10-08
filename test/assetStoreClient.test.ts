import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetStoreClient, isPrivateHost, sameOriginUrl, StoreError } from "../electron/main/assetStoreClient";

describe("asset store client address rules", () => {
  it("allows plain http only for private hosts", () => {
    for (const host of ["localhost", "127.0.0.1", "[::1]", "10.0.0.5", "192.168.1.2", "172.20.0.1", "100.73.251.77", "mdc-server"]) expect(isPrivateHost(host), host).toBe(true);
    for (const host of ["10.evil.com", "192.168.1.2.evil.com", "100.73.251.77.nip.io", "store.openrpgmaker.com", "100.128.0.1", "172.32.0.1", "8.8.8.8"]) expect(isPrivateHost(host), host).toBe(false);
  });

  it("opens only same-origin login pages", () => {
    expect(sameOriginUrl("https://store.openrpgmaker.com/device?code=AB", "https://store.openrpgmaker.com")).toBe("https://store.openrpgmaker.com/device?code=AB");
    expect(sameOriginUrl("file:///etc/passwd", "https://store.openrpgmaker.com")).toBeNull();
    expect(sameOriginUrl("https://evil.example/device", "https://store.openrpgmaker.com")).toBeNull();
    expect(sameOriginUrl("not a url", "https://store.openrpgmaker.com")).toBeNull();
  });
});

describe("asset store client concept feed", () => {
  const SHA_FULL = "a".repeat(64);
  const SHA_CARD = "b".repeat(64);
  const card = (slug: string, extra: Record<string, unknown> = {}) => ({
    slug,
    title: "몸이 뒤바뀐 악역영애",
    hook: "처형 3일 전, 눈을 떠 보니 그 아이의 몸이었다.",
    description: "왕립 아카데미 무도회에서 시작하는 이야기.",
    tags: ["웹소설", "연애"],
    presetId: "story-cutscene",
    protagonist: "평민 소녀",
    stage: "왕립 아카데미",
    firstScene: "무도회장 거울 앞",
    brief: { experience: "처형을 피한다", activity: "대화·조사", progression: "3일 카운트다운", detail: "거울·무도회", scope: "첫날 밤까지" },
    thumb: { full: SHA_FULL, card: SHA_CARD },
    source: "official",
    madeCount: 3,
    aiGenerated: true,
    ...extra,
  });
  const roots: string[] = [];
  const requests: { url: string; method: string }[] = [];

  function client(respond: (url: string, init: RequestInit) => Response): AssetStoreClient {
    const root = mkdtempSync(join(tmpdir(), "oprn-store-client-"));
    roots.push(root);
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
      requests.push({ url: String(url), method: init.method ?? "GET" });
      return respond(String(url), init);
    }));
    return new AssetStoreClient(root, { load: () => null, save: () => undefined, persistent: () => false }, "https://store.example.com");
  }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  afterEach(() => {
    vi.unstubAllGlobals();
    requests.length = 0;
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("normalizes a page of concepts and forwards the filters", async () => {
    const store = client(() => json({ items: [card("body-swap-villainess", { title: "  몸이 뒤바뀐 악역영애  ", aiGenerated: false })], nextCursor: "1000:24" }));
    const page = await store.concepts({ tag: "웹소설", cursor: "1000:0", q: "" });
    expect(page.nextCursor).toBe("1000:24");
    expect(page.items).toHaveLength(1);
    expect(page.items[0]!.title).toBe("몸이 뒤바뀐 악역영애");
    expect(page.items[0]!.aiGenerated).toBe(true);
    expect(page.items[0]!.madeCount).toBe(3);
    const url = new URL(requests[0]!.url);
    expect(url.pathname).toBe("/api/v1/concepts");
    expect(url.searchParams.get("tag")).toBe("웹소설");
    expect(url.searchParams.get("cursor")).toBe("1000:0");
    expect(url.searchParams.has("q")).toBe(false);
  });

  it("rejects malformed concepts from the server (unknown preset, non-sha thumbnail)", async () => {
    const badPreset = client(() => json({ concept: card("bad-preset", { presetId: "rts" }), similar: [] }));
    await expect(badPreset.concept({ slug: "bad-preset" })).rejects.toBeInstanceOf(StoreError);
    const badThumb = client(() => json({ items: [card("bad-thumb", { thumb: { full: "https://evil.example/x.png", card: SHA_CARD } })], nextCursor: null }));
    await expect(badThumb.concepts({})).rejects.toBeInstanceOf(StoreError);
    const ok = client(() => json({ concept: card("good-one"), similar: [card("good-two")] }));
    const detail = await ok.concept({ slug: "good-one" });
    expect(detail.similar.map((item) => item.slug)).toEqual(["good-two"]);
  });

  it("reports made as a boolean and never throws", async () => {
    const ok = client(() => new Response(null, { status: 204 }));
    await expect(ok.conceptMade({ slug: "good-one" })).resolves.toBe(true);
    expect(requests.at(-1)).toEqual({ url: "https://store.example.com/api/v1/concepts/good-one/made", method: "POST" });
    const missing = client(() => json({ error: "not_found", message: "컨셉을 찾을 수 없습니다." }, 404));
    await expect(missing.conceptMade({ slug: "gone-one" })).resolves.toBe(false);
    const offline = client(() => { throw new TypeError("fetch failed"); });
    await expect(offline.conceptMade({ slug: "good-one" })).resolves.toBe(false);
  });
});
