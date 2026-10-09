import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import type { GameConcept } from "../../src/concepts/format";
import { createApp, type App } from "../src/app";
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

function rawConcept(index: number, thumb: { full: string; card: string }) {
  return {
    slug: `test-concept-${String(index).padStart(2, "0")}`,
    title: `시험 컨셉 ${index}`,
    hook: "처형 3일 전, 눈을 떠 보니 그 아이의 몸이었다.",
    description: "왕립 아카데미 무도회에서 시작하는 이야기.",
    tags: index % 3 === 0 ? ["패러디", "코미디"] : ["웹소설"],
    presetId: index % 2 === 0 ? "story-cutscene" : "adventure-jrpg",
    protagonist: "평민 소녀",
    stage: index % 5 === 0 ? "조선 한양" : "왕립 아카데미",
    firstScene: "무도회장 거울 앞",
    brief: { experience: "처형을 피한다", activity: "대화·조사", progression: "3일 카운트다운", detail: "거울·무도회", scope: "첫날 밤까지" },
    thumb,
    ...(index === 1 ? { locales: { en: { title: "Test concept one with a deliberately long English title over forty", hook: "Hook", description: "Description" } } } : {}),
    source: "official",
    aiGenerated: true,
  };
}

type Page = { items: GameConcept[]; nextCursor: string | null };

describe("OPRN store concept feed", () => {
  let pg: TempPostgres;
  let db: Db;
  let app: App;
  let base: string;
  let blobDir: string;
  let admin: Client;
  let thumb: { full: string; card: string };

  before(async () => {
    pg = await startPostgres();
    blobDir = mkdtempSync(join(tmpdir(), "oprn-store-blobs-"));
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    const config = loadConfig({
      STORE_PORT: String(port), STORE_PUBLIC_URL: base, STORE_DATABASE_URL: pg.url, STORE_BLOB_DIR: blobDir,
      STORE_ADMIN_EMAILS: "boss@openrpgmaker.com", STORE_DEV_LOGIN: "1",
    });
    db = createDb(pg.url);
    await migrate(db, join(ROOT, "migrations"));
    await migrate(db, join(ROOT, "migrations"));
    app = createApp(config, db, join(ROOT, "public"));
    await new Promise<void>((done) => app.server.listen(port, "127.0.0.1", () => done()));
    admin = new Client(base);
    await admin.devLogin("boss@openrpgmaker.com", "운영자");
    const full = png(320, 180, 1);
    const card = png(160, 90, 2);
    for (const bytes of [full, card]) {
      const response = await admin.fetch("/api/v1/blobs", { method: "POST", body: Buffer.from(bytes), headers: { "x-sha256": sha(bytes), "x-csrf-token": admin.csrf } });
      assert.equal(response.status, 200, await response.text());
    }
    thumb = { full: sha(full), card: sha(card) };
  });

  after(async () => {
    await app?.close();
    await db?.end();
    pg?.stop();
    rmSync(blobDir, { recursive: true, force: true });
  });

  it("serves concept thumbnails only once a visible concept uses them", async () => {
    assert.equal((await new Client(base).fetch(`/api/v1/blobs/${thumb.card}`)).status, 404, "unreferenced blobs are not served");
    for (let index = 0; index < 30; index += 1) {
      const response = await admin.api("/api/v1/admin/concepts", { concept: rawConcept(index, thumb), rank: index });
      assert.equal(response.status, 200, await response.text());
      assert.deepEqual(await response.json(), { slug: rawConcept(index, thumb).slug });
    }
    const guest = new Client(base);
    assert.equal((await guest.fetch(`/api/v1/blobs/${thumb.full}`)).status, 200);
    assert.equal((await guest.fetch(`/api/v1/blobs/${thumb.card}`)).status, 200);
  });

  it("pages 24 then 6 with a cursor and no overlap", async () => {
    const guest = new Client(base);
    const first = await (await guest.fetch("/api/v1/concepts")).json() as Page;
    assert.equal(first.items.length, 24);
    assert.ok(first.nextCursor);
    assert.equal(first.items[0]!.slug, "test-concept-00", "ordered by rank");
    assert.deepEqual(first.items[0]!.thumb, thumb);
    assert.equal(first.items[0]!.madeCount, 0);
    const second = await (await guest.fetch(`/api/v1/concepts?cursor=${encodeURIComponent(first.nextCursor!)}`)).json() as Page;
    assert.equal(second.items.length, 6);
    assert.equal(second.nextCursor, null);
    const slugs = new Set(first.items.map((item) => item.slug));
    for (const item of second.items) assert.ok(!slugs.has(item.slug), `${item.slug} appears on both pages`);
    // 번역은 본문 locales 에 실려 가고 원문 제목은 그대로다(번역 제목이 원문 한도 40자를 넘어도 카드가 깨지지 않게).
    const translated = first.items.find((item) => item.slug === "test-concept-01")!;
    assert.equal(translated.title, "시험 컨셉 1");
    assert.match(translated.locales?.en?.title ?? "", /^Test concept one/);
  });

  it("filters by tag, preset and body text", async () => {
    const guest = new Client(base);
    const parody = await (await guest.fetch(`/api/v1/concepts?tag=${encodeURIComponent("패러디")}`)).json() as Page;
    assert.equal(parody.items.length, 10);
    for (const item of parody.items) assert.ok(item.tags.includes("패러디"));
    const joseon = await (await guest.fetch(`/api/v1/concepts?q=${encodeURIComponent("조선")}`)).json() as Page;
    assert.deepEqual(joseon.items.map((item) => item.slug), ["00", "05", "10", "15", "20", "25"].map((n) => `test-concept-${n}`));
    const preset = await (await guest.fetch("/api/v1/concepts?preset=adventure-jrpg")).json() as Page;
    assert.equal(preset.items.length, 15);
    const wildcard = await (await guest.fetch(`/api/v1/concepts?q=${encodeURIComponent("%")}`)).json() as Page;
    assert.equal(wildcard.items.length, 0, "LIKE wildcards are escaped");
  });

  it("returns detail with up to six similar concepts, never itself, and 404 for unknown slugs", async () => {
    const guest = new Client(base);
    const detail = await (await guest.fetch("/api/v1/concepts/test-concept-03")).json() as { concept: GameConcept; similar: GameConcept[] };
    assert.equal(detail.concept.slug, "test-concept-03");
    assert.ok(detail.similar.length > 0 && detail.similar.length <= 6);
    assert.ok(detail.similar.every((item) => item.slug !== "test-concept-03"));
    assert.ok(detail.similar.every((item) => item.tags.includes("패러디")), "shared tags rank first");
    const missing = await guest.fetch("/api/v1/concepts/no-such-concept");
    assert.equal(missing.status, 404);
    assert.equal((await missing.json() as { error: string }).error, "not_found");
  });

  it("counts made once per client per day", async () => {
    const guest = new Client(base);
    assert.equal((await guest.api("/api/v1/concepts/test-concept-07/made", {})).status, 204);
    assert.equal((await guest.api("/api/v1/concepts/test-concept-07/made", {})).status, 204);
    const detail = await (await guest.fetch("/api/v1/concepts/test-concept-07")).json() as { concept: GameConcept };
    assert.equal(detail.concept.madeCount, 1);
    assert.equal((await guest.api("/api/v1/concepts/no-such-concept/made", {})).status, 404);
  });

  it("lets only admins publish, and only with uploaded thumbnails", async () => {
    const maker = new Client(base);
    await maker.devLogin("maker@example.com", "메이커");
    const forbidden = await maker.api("/api/v1/admin/concepts", { concept: rawConcept(40, thumb) });
    assert.equal(forbidden.status, 403, "only admins publish");
    assert.equal((await forbidden.json() as { error: string }).error, "forbidden");
    assert.equal((await new Client(base).api("/api/v1/admin/concepts", { concept: rawConcept(41, thumb) })).status, 401, "guests cannot publish");
    const missing = await admin.api("/api/v1/admin/concepts", { concept: rawConcept(42, { full: "a".repeat(64), card: thumb.card }) });
    assert.equal(missing.status, 400);
    assert.equal((await missing.json() as { error: string }).error, "missing_blob");
    const badThumb = await admin.api("/api/v1/admin/concepts", { concept: rawConcept(43, { full: "/assets/x.webp", card: thumb.card }) });
    assert.equal((await badThumb.json() as { error: string }).error, "bad_thumb");
    const badConcept = await admin.api("/api/v1/admin/concepts", { concept: { ...rawConcept(44, thumb), presetId: "rts" } });
    assert.equal(badConcept.status, 400);
    assert.equal((await badConcept.json() as { error: string }).error, "bad_concept");
    // 같은 slug 를 다시 게시하면 덮어쓴다(만든 수는 그대로).
    const again = await admin.api("/api/v1/admin/concepts", { concept: { ...rawConcept(7, thumb), title: "고쳐 쓴 제목" }, rank: 7 });
    assert.equal(again.status, 200);
    const detail = await (await admin.fetch("/api/v1/concepts/test-concept-07")).json() as { concept: GameConcept };
    assert.deepEqual([detail.concept.title, detail.concept.madeCount], ["고쳐 쓴 제목", 1]);
  });
});
