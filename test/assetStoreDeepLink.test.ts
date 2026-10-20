import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findStoreDeepLinkArg, parseStoreDeepLink } from "@/assetStore/deepLink";
import { applyPackToProject, basicTilesetFor, buildPack, encodePackBundle, packBlockedItems, type PackMeta } from "@/assetStore/pack";
import { bytesToBase64 } from "@/assetStore/sniff";
import { storeProjectId } from "@/assetStore/format";
import type { Project, UploadedAsset } from "@/project/types";
import { AssetStoreClient, bundleUnsupportedStatus } from "../electron/main/assetStoreClient";

const STORE = "https://store.openrpgmaker.com";
const link = (query: string, base = "oprn://store/install") => `${base}?${query}`;
const storeParam = `store=${encodeURIComponent(STORE)}`;

describe("store deep link parser", () => {
  it("accepts the store website link with and without a version", () => {
    expect(parseStoreDeepLink(link(`${storeParam}&slug=demo-crate-c7964203&version=2`), STORE)).toEqual({ ok: true, slug: "demo-crate-c7964203", version: 2 });
    expect(parseStoreDeepLink(link(`${storeParam}&slug=demo-crate-c7964203`), STORE)).toEqual({ ok: true, slug: "demo-crate-c7964203" });
    expect(parseStoreDeepLink(link(`${storeParam}&slug=demo-crate-c7964203&version=`), STORE)).toEqual({ ok: true, slug: "demo-crate-c7964203" });
  });

  it("accepts the host-less spellings of the same route", () => {
    for (const base of ["oprn:store/install", "oprn:///store/install", "oprn://store/install/", "OPRN://Store/Install"]) {
      expect(parseStoreDeepLink(link(`${storeParam}&slug=forest-pack`, base), STORE)).toEqual({ ok: true, slug: "forest-pack" });
    }
  });

  it("compares the store origin, not the full address", () => {
    expect(parseStoreDeepLink(link(`store=${encodeURIComponent(`${STORE}/items/x`)}&slug=forest-pack`), `${STORE}/`)).toEqual({ ok: true, slug: "forest-pack" });
  });

  it("refuses links that name another store, never installing from the host in the link", () => {
    const reason = "다른 스토어 주소의 링크라 열지 않았습니다.";
    for (const store of ["https://evil.example", "http://store.openrpgmaker.com", "https://store.openrpgmaker.com:8443", "https://store.openrpgmaker.com.evil.example", "file:///etc/passwd", "javascript:alert(1)", ""]) {
      expect(parseStoreDeepLink(link(`store=${encodeURIComponent(store)}&slug=forest-pack`), STORE)).toEqual({ ok: false, reason });
    }
    expect(parseStoreDeepLink(link("slug=forest-pack"), STORE)).toEqual({ ok: false, reason });
    expect(parseStoreDeepLink(link(`${storeParam}&slug=forest-pack`), "not a url")).toEqual({ ok: false, reason });
  });

  it("refuses bad slugs, versions, routes and schemes", () => {
    for (const slug of ["Forest-Pack", "a--b", "-forest", "forest-", "ab", "a".repeat(65), "forest_pack", "../x", "%2e%2e"]) {
      expect(parseStoreDeepLink(link(`${storeParam}&slug=${slug}`), STORE).ok).toBe(false);
    }
    for (const version of ["0", "-1", "1.5", "01", "1e3", "abc", "99999999999999999"]) {
      expect(parseStoreDeepLink(link(`${storeParam}&slug=forest-pack&version=${version}`), STORE).ok).toBe(false);
    }
    expect(parseStoreDeepLink(link(`${storeParam}&slug=forest-pack`, "oprn://store/uninstall"), STORE).ok).toBe(false);
    expect(parseStoreDeepLink(link(`${storeParam}&slug=forest-pack`, "oprn://project/open"), STORE).ok).toBe(false);
    expect(parseStoreDeepLink(link(`${storeParam}&slug=forest-pack`, "https://store/install"), STORE).ok).toBe(false);
    expect(parseStoreDeepLink(link(`${storeParam}&slug=forest-pack&slug=other-pack`), STORE).ok).toBe(false);
    expect(parseStoreDeepLink("oprn://user:pw@store/install?" + `${storeParam}&slug=forest-pack`, STORE).ok).toBe(false);
    expect(parseStoreDeepLink(`oprn://store/install?${storeParam}&slug=forest-pack&pad=${"x".repeat(3000)}`, STORE).ok).toBe(false);
    expect(parseStoreDeepLink("", STORE).ok).toBe(false);
  });

  it("finds the link among process arguments", () => {
    expect(findStoreDeepLinkArg(["/opt/OPRN/oprn", "--no-sandbox", "oprn://store/install?slug=x"])).toBe("oprn://store/install?slug=x");
    expect(findStoreDeepLinkArg(["/opt/OPRN/oprn", "."])).toBeNull();
  });
});

describe("store bundle fallback for owner drafts", () => {
  it("treats 404 as an old server only for public items", () => {
    expect(bundleUnsupportedStatus(405, "pending")).toBe(true);
    expect(bundleUnsupportedStatus(501, "visible")).toBe(true);
    expect(bundleUnsupportedStatus(404, "visible")).toBe(true);
    expect(bundleUnsupportedStatus(404, undefined)).toBe(true);
    expect(bundleUnsupportedStatus(404, "pending")).toBe(false);
    expect(bundleUnsupportedStatus(404, "hidden")).toBe(false);
    expect(bundleUnsupportedStatus(200, "visible")).toBe(false);
  });
});

function png(width: number, height: number, salt = 0): Uint8Array {
  const bytes = new Uint8Array(33 + salt);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}
const dataUrl = (bytes: Uint8Array) => `data:image/png;base64,${bytesToBase64(bytes)}`;
const sha256 = async (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const readAsset = async (asset: UploadedAsset) => Uint8Array.from(Buffer.from(asset.dataUrl!.split(",")[1]!, "base64"));
const META: PackMeta = { title: "내 초안 팩", summary: "초안", description: "", tags: [], kind: "tileset", license: "CC-BY-4.0", aiGenerated: false, credits: "" };

function authorProject(): Project {
  const sheet = png(64, 32);
  return {
    tilesets: { forest: { ...basicTilesetFor("sheet", "숲 칩셋", 64, 32, 16), id: "forest" } },
    assets: { uploaded: { sheet: { id: "sheet", name: "숲 시트", kind: "chipset", dataUrl: dataUrl(sheet), meta: { width: 64, height: 32, tileSize: 16 } } } },
  } as unknown as Project;
}

async function draftServer(): Promise<{ bundle: Uint8Array; manifest: unknown; blobs: Map<string, Uint8Array> }> {
  const built = await buildPack(authorProject(), { tilesetIds: ["forest"], assetIds: [] }, META, { readAsset, sha256 });
  const blobs = new Map([...built.blobs].map(([sha, blob]) => [sha, blob.bytes]));
  return { bundle: encodePackBundle(built.manifest, (sha) => blobs.get(sha)!), manifest: built.manifest, blobs };
}

async function withFetch<T>(respond: (url: string, init: RequestInit) => Response, work: (requests: { url: string; auth: string | null }[]) => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  const requests: { url: string; auth: string | null }[] = [];
  globalThis.fetch = (async (url: string | URL, init: RequestInit = {}) => {
    requests.push({ url: String(url), auth: new Headers(init.headers).get("authorization") });
    return respond(String(url), init);
  }) as typeof fetch;
  try { return await work(requests); } finally { globalThis.fetch = original; }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const detail = (status: string) => ({ slug: "my-draft-pack", title: "내 초안 팩", kind: "tileset", grade: "single", license: "CC-BY-4.0", aiGenerated: false, author: "나", cover: null, latestVersion: 1, status });

describe("owner drafts (D2)", () => {
  it("installs the owner's pending item through /bundle with the login token and marks it a draft", async () => {
    const root = mkdtempSync(join(tmpdir(), "oprn-store-draft-"));
    const { bundle } = await draftServer();
    try {
      await withFetch((url, init) => {
        const authed = new Headers(init.headers).get("authorization") === "Bearer owner-token";
        if (url.endsWith("/bundle")) return authed ? new Response(bundle as BodyInit, { status: 200 }) : json({ message: "없음" }, 404);
        if (url.endsWith("/downloads")) return json({});
        return authed ? json(detail("pending")) : json({ message: "없음" }, 404);
      }, async (requests) => {
        const client = new AssetStoreClient(root, { load: () => "owner-token", save: () => undefined, persistent: () => false }, "https://store.example.com");
        const record = await client.install("my-draft-pack", () => undefined);
        expect(record.draft).toBe(true);
        expect(client.installed()[0]!.draft).toBe(true);
        expect(requests.find((request) => request.url.endsWith("/bundle"))!.auth).toBe("Bearer owner-token");
        const pkg = await client.packageFor("my-draft-pack");
        expect(pkg.version).toBe(1);
      });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("does not turn /bundle off for the whole run when only a pending item 404s, and drops the draft mark once public", async () => {
    const root = mkdtempSync(join(tmpdir(), "oprn-store-draft-"));
    const { bundle, manifest, blobs } = await draftServer();
    let status = "pending";
    try {
      await withFetch((url) => {
        if (url.endsWith("/bundle")) return status === "pending" ? json({ message: "없음" }, 404) : new Response(bundle as BodyInit, { status: 200 });
        if (url.endsWith("/manifest")) return json(manifest);
        if (url.includes("/api/v1/blobs/")) return new Response(blobs.get(url.split("/").pop()!)! as BodyInit, { status: 200 });
        if (url.endsWith("/downloads")) return json({});
        return json(detail(status));
      }, async (requests) => {
        const client = new AssetStoreClient(root, { load: () => "owner-token", save: () => undefined, persistent: () => false }, "https://store.example.com");
        const first = await client.install("my-draft-pack", () => undefined);
        expect(first.draft).toBe(true);
        status = "visible";
        expect(await client.refreshDrafts()).toBe(true);
        expect(client.installed()[0]!.draft).toBeUndefined();
        await client.install("my-draft-pack", () => undefined);
        expect(requests.filter((request) => request.url.endsWith("/bundle"))).toHaveLength(2);
        expect(requests.filter((request) => request.url.endsWith("/manifest"))).toHaveLength(1);
        expect(client.installed()[0]!.draft).toBeUndefined();
      });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("keeps store origin on an applied draft, so it cannot be re-uploaded or shared", async () => {
    const { manifest, blobs } = await draftServer();
    const target = { tilesets: {}, assets: { uploaded: {} } } as unknown as Project;
    applyPackToProject(target, manifest as Parameters<typeof applyPackToProject>[1], {
      slug: "my-draft-pack", version: 1, author: "나", storeUrl: "https://store.example.com", itemUrl: "https://store.example.com/items/my-draft-pack", blob: (sha) => blobs.get(sha)!,
    });
    const tilesetId = storeProjectId("my-draft-pack", "forest");
    const sheetId = storeProjectId("my-draft-pack", "sheet");
    expect(target.assets.uploaded[sheetId]!.origin).toMatchObject({ itemSlug: "my-draft-pack", store: "https://store.example.com" });
    expect(packBlockedItems(target, { tilesetIds: [tilesetId], assetIds: [] }).map((item) => item.id)).toEqual([sheetId]);
    expect(packBlockedItems(target, { tilesetIds: [], assetIds: [sheetId] }).map((item) => item.id)).toEqual([sheetId]);
  });
});
