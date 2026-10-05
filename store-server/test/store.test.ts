import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import type { StorePackManifest } from "../../src/assetStore/format";
import { basicTilesetFor, buildPack, type PackMeta } from "../../src/assetStore/pack";
import { bytesToBase64 } from "../../src/assetStore/sniff";
import type { Project, UploadedAsset } from "../../src/project/types";
import { createApp, type App } from "../src/app";
import { BlobStore } from "../src/blobStore";
import { sweepOrphanBlobs } from "../src/items";
import { loadConfig } from "../src/config";
import { createDb, migrate, type Db } from "../src/db";
import { Client, freePort, startPostgres, type TempPostgres } from "./harness";

const ROOT = resolve(process.env.STORE_SERVER_ROOT ?? process.cwd());
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function png(width: number, height: number, salt: number): Uint8Array {
  const bytes = new Uint8Array(40);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  view.setUint32(36, salt);
  return bytes;
}

function fixtureProject(salt: number): Project {
  const sheet = png(64, 32, salt);
  return {
    tilesets: {
      forest: {
        ...basicTilesetFor("sheet", "숲", 64, 32, 16),
        id: "forest",
        referenceDocuments: [{ id: "c", name: "숲 깔기", description: "", documents: [{ id: "d", name: "규칙", markdown: "# 숲 규칙" }], images: [] }],
      },
    },
    assets: { uploaded: { sheet: { id: "sheet", name: "숲 시트", kind: "chipset", dataUrl: `data:image/png;base64,${bytesToBase64(sheet)}`, meta: { width: 64, height: 32 } } } },
  } as unknown as Project;
}

const META = (title: string): PackMeta => ({ title, summary: "테스트 팩", description: "설명", tags: ["숲"], kind: "tileset", license: "CC-BY-4.0", aiGenerated: true, credits: "그림: 테스터" });

async function makePack(title: string, salt: number): Promise<{ manifest: StorePackManifest; blobs: Map<string, Uint8Array> }> {
  const built = await buildPack(fixtureProject(salt), { tilesetIds: ["forest"], assetIds: [] }, META(title), {
    readAsset: async (asset: UploadedAsset) => Uint8Array.from(Buffer.from(asset.dataUrl!.split(",")[1]!, "base64")),
    sha256: async (bytes) => sha(bytes),
  });
  return { manifest: built.manifest, blobs: new Map([...built.blobs].map(([key, blob]) => [key, blob.bytes])) };
}

async function uploadPack(client: Client, title: string, salt: number): Promise<{ slug: string; status: string; manifest: StorePackManifest }> {
  const pack = await makePack(title, salt);
  const check = await (await client.api("/api/v1/blobs/check", { sha256s: [...pack.blobs.keys()] })).json() as { missing: string[] };
  for (const key of check.missing) {
    const response = await client.fetch("/api/v1/blobs", { method: "POST", body: Buffer.from(pack.blobs.get(key)!), headers: { "x-sha256": key, "content-type": "application/octet-stream", ...(client.csrf ? { "x-csrf-token": client.csrf } : {}) } });
    assert.equal(response.status, 200, await response.text());
  }
  const response = await client.api("/api/v1/items", { manifest: pack.manifest });
  const body = await response.json() as { slug: string; status: string };
  assert.equal(response.status, 201, JSON.stringify(body));
  return { ...body, manifest: pack.manifest };
}

async function deviceLogin(app: Client, browser: Client): Promise<void> {
  const start = await (await app.api("/api/v1/device/code", { client: "OPRN 에디터 테스트" })).json() as { device_code: string; user_code: string; verification_uri_complete: string };
  const pending = await app.api("/api/v1/device/token", { device_code: start.device_code });
  assert.equal(pending.status, 428);
  const pageView = await browser.page(new URL(start.verification_uri_complete).pathname + new URL(start.verification_uri_complete).search);
  assert.match(pageView.html, new RegExp(start.user_code));
  const approve = await browser.form("/device", { csrf: browser.csrf, code: start.user_code, decision: "approve" });
  assert.equal(approve.status, 303);
  const granted = await app.api("/api/v1/device/token", { device_code: start.device_code });
  assert.equal(granted.status, 200);
  app.token = (await granted.json() as { access_token: string }).access_token;
  const again = await app.fetch("/api/v1/device/token", { method: "POST", json: { device_code: start.device_code } });
  assert.equal(again.status, 400, "device code is single use");
}

describe("OPRN asset store server", () => {
  let pg: TempPostgres;
  let db: Db;
  let app: App;
  let base: string;
  let blobDir: string;
  let fakeGoogle: Server;

  before(async () => {
    pg = await startPostgres();
    blobDir = mkdtempSync(join(tmpdir(), "oprn-store-blobs-"));
    fakeGoogle = createServer((req, res) => {
      if (req.url === "/token") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ access_token: "fake-access" })); return; }
      if (req.url === "/userinfo" && req.headers.authorization === "Bearer fake-access") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ email: "boss@openrpgmaker.com", email_verified: true, name: "운영자", sub: "google-sub-1" }));
        return;
      }
      res.writeHead(404); res.end();
    });
    await new Promise<void>((done) => fakeGoogle.listen(0, "127.0.0.1", () => done()));
    const googlePort = (fakeGoogle.address() as { port: number }).port;
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    const config = loadConfig({
      STORE_PORT: String(port), STORE_PUBLIC_URL: base, STORE_DATABASE_URL: pg.url, STORE_BLOB_DIR: blobDir,
      STORE_ADMIN_EMAILS: "boss@openrpgmaker.com", STORE_DEV_LOGIN: "1",
      STORE_GOOGLE_CLIENT_ID: "cid", STORE_GOOGLE_CLIENT_SECRET: "secret",
      STORE_GOOGLE_AUTH_URL: `http://127.0.0.1:${googlePort}/auth`, STORE_GOOGLE_TOKEN_URL: `http://127.0.0.1:${googlePort}/token`, STORE_GOOGLE_USERINFO_URL: `http://127.0.0.1:${googlePort}/userinfo`,
    });
    db = createDb(pg.url);
    await migrate(db, join(ROOT, "migrations"));
    await migrate(db, join(ROOT, "migrations"));
    app = createApp(config, db, join(ROOT, "public"));
    await new Promise<void>((done) => app.server.listen(port, "127.0.0.1", () => done()));
  });

  after(async () => {
    await app?.close();
    await db?.end();
    await new Promise<void>((done) => fakeGoogle?.close(() => done()));
    pg?.stop();
    rmSync(blobDir, { recursive: true, force: true });
  });

  it("serves health, pages and static files with security headers", async () => {
    const guest = new Client(base);
    assert.equal((await guest.fetch("/healthz")).status, 200);
    const home = await guest.fetch("/");
    assert.equal(home.status, 200);
    assert.match(home.headers.get("content-security-policy") ?? "", /script-src 'self'/);
    assert.equal(home.headers.get("x-content-type-options"), "nosniff");
    assert.equal((await guest.fetch("/static/app.css")).status, 200);
    assert.equal((await guest.fetch("/static/..%2Fsrc%2Fapp.ts")).status, 404);
    const upload = await guest.fetch("/upload");
    assert.equal(upload.status, 303);
    assert.match(upload.headers.get("location") ?? "", /^\/login\?next=/);
  });

  it("logs in with Google (verified email) and grants admin by configured email", async () => {
    const browser = new Client(base);
    const start = await browser.fetch("/auth/google?next=/me");
    assert.equal(start.status, 303);
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const callback = await browser.fetch(`/auth/google/callback?code=abc&state=${state}`);
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get("location"), "/me");
    const me = await (await browser.api("/api/v1/me")).json() as { user: { role: string; email: string } };
    assert.deepEqual([me.user.email, me.user.role], ["boss@openrpgmaker.com", "admin"]);
    const forged = await new Client(base).fetch(`/auth/google/callback?code=abc&state=${state}`);
    assert.equal(forged.status, 400, "state cookie must match");
  });

  it("rejects bad blobs and accepts real ones idempotently", async () => {
    const browser = new Client(base);
    await browser.devLogin("maker@example.com", "메이커");
    const bytes = png(16, 16, 1);
    const upload = (body: Uint8Array, hash: string, csrf = browser.csrf) => browser.fetch("/api/v1/blobs", { method: "POST", body: Buffer.from(body), headers: { "x-sha256": hash, "x-csrf-token": csrf } });
    assert.equal((await upload(bytes, sha(bytes), "")).status, 403, "session writes need CSRF");
    assert.equal((await upload(bytes, "0".repeat(64))).status, 400, "hash must match");
    const html = new TextEncoder().encode("<script>alert(1)</script>");
    assert.equal((await upload(html, sha(html))).status, 415, "only media signatures");
    assert.equal((await upload(bytes, sha(bytes))).status, 200);
    assert.equal((await upload(bytes, sha(bytes))).status, 200);
    assert.equal((await new Client(base).fetch(`/api/v1/blobs/${sha(bytes)}`)).status, 404, "unreferenced blobs are not served");
  });

  it("device code login gives the app a bearer token; new authors wait for review, trusted authors go live", async () => {
    const browser = new Client(base);
    await browser.devLogin("newbie@example.com", "새작가");
    const editor = new Client(base);
    await deviceLogin(editor, browser);
    const first = await uploadPack(editor, "숲 마을 팩", 10);
    assert.equal(first.status, "pending");
    const guest = new Client(base);
    assert.equal((await guest.fetch(`/api/v1/items/${first.slug}`)).status, 404, "pending is invisible to guests");
    assert.equal((await editor.fetch(`/api/v1/items/${first.slug}`)).status, 200, "author sees pending");
    const listed = await (await guest.api("/api/v1/items")).json() as { items: { slug: string }[] };
    assert.ok(!listed.items.some((item) => item.slug === first.slug));

    const admin = new Client(base);
    await admin.devLogin("boss@openrpgmaker.com", "운영자");
    const queue = await (await admin.api("/api/v1/admin/queue")).json() as { pending: { slug: string }[] };
    assert.ok(queue.pending.some((item) => item.slug === first.slug));
    assert.equal((await editor.api(`/api/v1/admin/items/${first.slug}/status`, { status: "visible" })).status, 403, "only admins moderate");
    const slugs = [first.slug];
    for (const salt of [11, 12]) slugs.push((await uploadPack(editor, `숲 팩 ${salt}`, salt)).slug);
    for (const slug of slugs) assert.equal((await admin.api(`/api/v1/admin/items/${slug}/status`, { status: "visible", note: "확인" })).status, 200);
    const fourth = await uploadPack(editor, "네 번째 팩", 13);
    assert.equal(fourth.status, "visible", "after 3 approved items, publishing is immediate");

    const detail = await (await guest.api(`/api/v1/items/${fourth.slug}`)).json() as { grade: string; counts: { referenceDocuments: number }; latestVersion: number; aiGenerated: boolean };
    assert.equal(detail.grade, "pack");
    assert.equal(detail.counts.referenceDocuments, 1);
    assert.equal(detail.aiGenerated, true);
    const manifest = await (await guest.api(`/api/v1/items/${fourth.slug}/versions/1/manifest`)).json() as StorePackManifest;
    assert.equal(manifest.schema, "oprn-store-pack/1");
    const blob = await guest.fetch(`/api/v1/blobs/${manifest.content.assets.sheet!.blob}`);
    assert.equal(blob.status, 200);
    assert.equal(blob.headers.get("content-type"), "image/png");
    assert.match(blob.headers.get("content-security-policy") ?? "", /sandbox/);

    const search = await (await guest.api("/api/v1/items?q=%EB%84%A4%20%EB%B2%88%EC%A7%B8&grade=pack")).json() as { items: { slug: string }[] };
    assert.deepEqual(search.items.map((item) => item.slug), [fourth.slug]);

    await guest.api(`/api/v1/items/${fourth.slug}/downloads`, {});
    await guest.api(`/api/v1/items/${fourth.slug}/downloads`, {});
    const counted = await (await guest.api(`/api/v1/items/${fourth.slug}`)).json() as { downloads: number };
    assert.equal(counted.downloads, 1, "downloads dedupe per client per day");

    const versioned = await editor.api(`/api/v1/items/${fourth.slug}/versions`, { manifest: (await makePack("네 번째 팩 v2", 13)).manifest });
    assert.equal(versioned.status, 201);
    assert.equal((await versioned.json() as { version: number }).version, 2);
    await assert.rejects(db.query("update store_versions set manifest = '{}'::jsonb"), /immutable/);
    const stranger = new Client(base);
    await stranger.devLogin("stranger@example.com", "남");
    assert.equal((await stranger.api(`/api/v1/items/${fourth.slug}/versions`, { manifest: (await makePack("탈취", 13)).manifest })).status, 404, "only the author adds versions");
  });

  it("rejects invalid manifests with readable reasons", async () => {
    const browser = new Client(base);
    await browser.devLogin("checker@example.com", "검사");
    const pack = await makePack("구멍 난 팩", 30);
    const missing = await browser.api("/api/v1/items", { manifest: pack.manifest });
    assert.equal(missing.status, 422);
    const body = await missing.json() as { details: string[] };
    assert.match(body.details.join(), /아직 올라오지 않은 파일/);
    const bad = structuredClone(pack.manifest) as unknown as Record<string, unknown>;
    bad.license = "All rights reserved";
    const invalid = await (await browser.api("/api/v1/items", { manifest: bad })).json() as { details: string[] };
    assert.match(invalid.details.join(), /라이선스/);
  });

  it("wraps a single web upload into a pack with a basic tileset", async () => {
    const browser = new Client(base);
    await browser.devLogin("boss@openrpgmaker.com", "운영자");
    const bytes = png(48, 32, 77);
    await browser.fetch("/api/v1/blobs", { method: "POST", body: Buffer.from(bytes), headers: { "x-sha256": sha(bytes), "x-csrf-token": browser.csrf } });
    const wrongSize = await browser.api("/api/v1/single", { blob: sha(bytes), title: "들판", kind: "tileset", tileSize: 32, license: "CC0", aiGenerated: false });
    assert.equal(wrongSize.status, 422);
    const missingAi = await browser.api("/api/v1/single", { blob: sha(bytes), title: "들판", kind: "tileset", tileSize: 16, license: "CC0" });
    assert.equal(missingAi.status, 400);
    const created = await browser.api("/api/v1/single", { blob: sha(bytes), title: "들판 칩셋", kind: "tileset", tileSize: 16, license: "CC0", aiGenerated: false, fileName: "field.png" });
    assert.equal(created.status, 201);
    const { slug, status } = await created.json() as { slug: string; status: string };
    assert.equal(status, "visible", "admins publish immediately");
    const manifest = await (await browser.api(`/api/v1/items/${slug}/versions/1/manifest`)).json() as StorePackManifest;
    const tileset = Object.values(manifest.content.tilesets)[0]!;
    assert.deepEqual([tileset.tileSize, tileset.tilesPerRow, tileset.count], [16, 3, 6]);
    const detail = await (await browser.api(`/api/v1/items/${slug}`)).json() as { grade: string };
    assert.equal(detail.grade, "single");
  });

  it("auto-hides after three distinct reporters, then admin removal stops serving bytes", async () => {
    const admin = new Client(base);
    await admin.devLogin("boss@openrpgmaker.com", "운영자");
    const item = await uploadPack(admin, "신고될 팩", 40);
    assert.equal(item.status, "visible");
    // 방금 만든 계정의 신고는 운영자 목록에만 들어가고 자동 숨김에는 세지 않는다.
    const fresh = new Client(base);
    await fresh.devLogin("fresh-reporter@example.com", "새 계정");
    assert.deepEqual(await (await fresh.api(`/api/v1/items/${item.slug}/reports`, { reason: "spam" })).json(), { hidden: false });
    const reporters = [new Client(base), new Client(base), new Client(base)];
    for (const [index, reporter] of reporters.entries()) await reporter.devLogin(`reporter${index}@example.com`, `신고${index}`);
    await db.query("update store_users set created_at = now() - interval '2 days' where email like 'reporter%@example.com'");
    const first = await reporters[0]!.api(`/api/v1/items/${item.slug}/reports`, { reason: "copyright", detail: "원작 주소" });
    assert.deepEqual(await first.json(), { hidden: false });
    await reporters[0]!.api(`/api/v1/items/${item.slug}/reports`, { reason: "copyright" });
    assert.deepEqual(await (await reporters[1]!.api(`/api/v1/items/${item.slug}/reports`, { reason: "spam" })).json(), { hidden: false }, "same reporter counts once");
    assert.deepEqual(await (await reporters[2]!.api(`/api/v1/items/${item.slug}/reports`, { reason: "broken" })).json(), { hidden: true });
    const guest = new Client(base);
    const list = await (await guest.api("/api/v1/items?q=%EC%8B%A0%EA%B3%A0")).json() as { items: unknown[] };
    assert.equal(list.items.length, 0, "hidden items leave the catalog");
    assert.equal((await guest.fetch(`/api/v1/items/${item.slug}/versions/1/manifest`)).status, 200, "people who installed can still re-download");
    assert.equal((await admin.form(`/items/${item.slug}/visibility`, { csrf: admin.csrf, hidden: "0" })).status, 409, "authors cannot undo a report hide");
    const formReport = await guest.form(`/items/${item.slug}/report`, { reason: "spam", token: "1.forged" });
    assert.equal(formReport.status, 403, "anonymous form reports need a signed token");
    const queue = await (await admin.api("/api/v1/admin/queue")).json() as { reported: { slug: string; reports: unknown[] }[] };
    assert.equal(queue.reported.find((entry) => entry.slug === item.slug)?.reports.length, 4);
    assert.equal((await admin.api(`/api/v1/admin/items/${item.slug}/status`, { status: "removed", note: "저작권 확인" })).status, 200);
    assert.equal((await guest.fetch(`/api/v1/items/${item.slug}/versions/1/manifest`)).status, 404);
    assert.equal((await guest.fetch(`/api/v1/blobs/${item.manifest.content.assets.sheet!.blob}`)).status, 404, "removed bytes stop being served");
    const audit = await db.query("select action from store_audit where item_id = (select id from store_items where slug = $1) order by id", [item.slug]);
    assert.deepEqual(audit.rows.map((row) => row.action), ["create", "auto_hide_reports", "admin_removed"]);
  });

  it("lets authors hide and unhide their own items but not report-hidden ones", async () => {
    const author = new Client(base);
    await author.devLogin("boss@openrpgmaker.com", "운영자");
    const item = await uploadPack(author, "작가가 숨길 팩", 50);
    assert.equal((await author.form(`/items/${item.slug}/visibility`, { csrf: author.csrf, hidden: "1" })).status, 303);
    assert.equal((await (await author.api(`/api/v1/items/${item.slug}`)).json() as { status: string }).status, "hidden");
    assert.equal((await author.form(`/items/${item.slug}/visibility`, { csrf: "wrong", hidden: "0" })).status, 403);
    assert.equal((await author.form(`/items/${item.slug}/visibility`, { csrf: author.csrf, hidden: "0" })).status, 303);
    assert.equal((await (await author.api(`/api/v1/items/${item.slug}`)).json() as { status: string }).status, "visible");
  });

  it("sends a new version from a not-yet-trusted author back to review", async () => {
    const author = new Client(base);
    await author.devLogin("second-version@example.com", "둘째 판본");
    const item = await uploadPack(author, "바꿔치기 시험 팩", 60);
    assert.equal(item.status, "pending");
    const admin = new Client(base);
    await admin.devLogin("boss@openrpgmaker.com", "운영자");
    assert.equal((await admin.api(`/api/v1/admin/items/${item.slug}/status`, { status: "visible" })).status, 200);
    const pack = await makePack("바꿔치기 시험 팩 v2", 61);
    const check = await (await author.api("/api/v1/blobs/check", { sha256s: [...pack.blobs.keys()] })).json() as { missing: string[] };
    for (const key of check.missing) await author.fetch("/api/v1/blobs", { method: "POST", body: Buffer.from(pack.blobs.get(key)!), headers: { "x-sha256": key, "x-csrf-token": author.csrf } });
    const versioned = await (await author.api(`/api/v1/items/${item.slug}/versions`, { manifest: pack.manifest })).json() as { status: string; version: number };
    assert.deepEqual(versioned, { slug: item.slug, version: 2, status: "pending" });
    assert.equal((await new Client(base).fetch(`/api/v1/items/${item.slug}`)).status, 404, "hidden from guests until re-approved");
  });

  it("only redirects to same-site paths after login", async () => {
    for (const next of ["//evil.example", "/\\evil.example", "/\tevil", "https://evil.example/"]) {
      const client = new Client(base);
      const response = await client.form("/auth/dev", { email: "redirect@example.com", name: "넘김", next });
      assert.equal(response.status, 303);
      assert.equal(response.headers.get("location"), "/", `rejects ${JSON.stringify(next)}`);
    }
    const ok = await new Client(base).form("/auth/dev", { email: "redirect@example.com", name: "넘김", next: "/me?tab=1" });
    assert.equal(ok.headers.get("location"), "/me?tab=1");
  });

  it("sweeps blobs that never made it into a version", async () => {
    const uploader = new Client(base);
    await uploader.devLogin("sweeper@example.com", "청소");
    const orphan = png(4, 4, 777);
    const kept = await uploadPack(uploader, "청소 시험 팩", 70);
    assert.equal((await uploader.fetch("/api/v1/blobs", { method: "POST", body: Buffer.from(orphan), headers: { "x-sha256": sha(orphan), "x-csrf-token": uploader.csrf } })).status, 200);
    await db.query("update store_blobs set created_at = now() - interval '2 days'");
    const store = new BlobStore(blobDir);
    const removed = await sweepOrphanBlobs(db, store);
    assert.ok(removed >= 1);
    assert.equal(store.has(sha(orphan)), false);
    for (const blob of kept.manifest.blobs) assert.equal(store.has(blob.sha256), true, "blobs in a version stay");
  });
});
