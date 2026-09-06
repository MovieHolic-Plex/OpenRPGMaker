import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { prepareReleaseTestWorkspace } from "../community-site/scripts/lib/releaseTestWorkspace.mjs";

const require = createRequire(new URL("../community-site/package.json", import.meta.url));
const { Pool } = require("pg");
const { chromium } = createRequire(new URL("../package.json", import.meta.url))("playwright");
const root = new URL("../", import.meta.url);
const pgBin = process.env.COMMUNITY_TEST_PG_BIN ?? "/usr/lib/postgresql/16/bin";
let directory;
let evidenceDirectory;
let isolatedSite;
let createGameRelease, createRuntimeManifest, jsonBytes, writeStoredZip;
let createReleaseUploadHandler, readBoundedJson, createReleaseLoader, insertReleaseListing;
let createReleasePlayHandler, createReleaseDownloadHandler, validateReleaseArchive;
let postgres;
let pool;
let fixture;
let publish;
let first;
let nextVersion;
const originalArchiveRoot = process.env.COMMUNITY_RUNTIME_ARCHIVE_ROOT;

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "oprn-release-"));
  evidenceDirectory = await mkdtemp(path.join(tmpdir(), "oprn-release-evidence-"));
  console.log(`Community release evidence: ${evidenceDirectory}`);
  execFileSync(path.join(pgBin, "initdb"), ["-D", path.join(directory, "db"), "-A", "trust", "-U", "release_test", "--no-locale", "--encoding=UTF8"], { stdio: "pipe" });
  postgres = spawn(path.join(pgBin, "postgres"), ["-D", path.join(directory, "db"), "-k", directory, "-c", "listen_addresses=", "-c", "fsync=off"], { stdio: ["ignore", "ignore", "pipe"] });
  await new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => finish(new Error("PostgreSQL readiness timeout")), 20_000);
    const onData = chunk => { output += chunk; if (output.includes("database system is ready to accept connections")) finish(); };
    const onExit = () => finish(new Error(`PostgreSQL exited before readiness: ${output}`));
    const onError = error => finish(error);
    function finish(error) {
      clearTimeout(timeout);
      postgres.stderr.off("data", onData);
      postgres.off("exit", onExit);
      postgres.off("error", onError);
      if (error) reject(error); else resolve();
    }
    postgres.stderr.on("data", onData);
    postgres.once("exit", onExit);
    postgres.once("error", onError);
  });
  pool = new Pool({ host: directory, user: "release_test", database: "postgres", max: 3 });
  await pool.query("create role anon; create role authenticated");
  for (const file of ["0001_openrpg_community.sql", "0002_lock_down_writes.sql", "0003_board.sql", "0004_community_upgrade.sql", "0005_report_privacy.sql", "0006_immutable_game_releases.sql"]) {
    await pool.query(await readFile(new URL(`community-site/db/${file}`, root), "utf8"));
  }
  const workspace = await prepareReleaseTestWorkspace({ directory, evidenceDirectory,
    databaseUrl: `postgresql://release_test@localhost/postgres?host=${encodeURIComponent(directory)}` });
  isolatedSite = workspace.site;
  ({ createGameRelease, createRuntimeManifest, jsonBytes, writeStoredZip,
    createReleaseUploadHandler, readBoundedJson, createReleaseLoader, insertReleaseListing,
    createReleasePlayHandler, createReleaseDownloadHandler, validateReleaseArchive } = workspace.api);
  const runtime = [
    { name: "web/player.html", bytes: Buffer.from('<!doctype html><script type="module" src="./player.js"></script>') },
    { name: "web/player.js", bytes: Buffer.from('document.body.dataset.release = "retained-v1";') },
    { name: "public/assets/tile.png", bytes: Buffer.from([137, 80, 78, 71]) },
  ];
  const trusted = await createRuntimeManifest(runtime, ["assets/tile.png"]);
  const publication = { gameId: "same-anonymous-identity", versionLabel: "1.0", runtimeTarget: trusted.runtimeTarget,
    saveCompatibilityId: "save-v1", acceptedSaveCompatibilityIds: [] };
  const entries = [...runtime.map(entry => ({ ...entry, name: entry.name.replace(/^(web|public)\//, "") })),
    { name: "project.json", bytes: jsonBytes({ version: 4, meta: { publication }, maps: [], database: {} }) }];
  const release = await createGameRelease({ publication, entries });
  const bytes = Buffer.from(await release.blob.arrayBuffer());
  fixture = { trusted, publication, entries, release, bytes };
  process.env.COMMUNITY_RUNTIME_ARCHIVE_ROOT = path.join(directory, "archive");
  await mkdir(path.join(process.env.COMMUNITY_RUNTIME_ARCHIVE_ROOT, trusted.runtimeTarget), { recursive: true });
  await writeFile(path.join(process.env.COMMUNITY_RUNTIME_ARCHIVE_ROOT, trusted.runtimeTarget, "runtime.json"), jsonBytes(trusted));
  publish = createReleaseUploadHandler({ pool });
}, { timeout: 360_000 });

after(async () => {
  if (originalArchiveRoot === undefined) delete process.env.COMMUNITY_RUNTIME_ARCHIVE_ROOT;
  else process.env.COMMUNITY_RUNTIME_ARCHIVE_ROOT = originalArchiveRoot;
  if (pool) await pool.end();
  if (postgres && postgres.exitCode === null) {
    const exited = once(postgres, "exit");
    postgres.kill("SIGTERM");
    await exited;
  }
  if (directory) await rm(directory, { recursive: true, force: true });
}, { timeout: 10_000 });

function upload(bytes = fixture.bytes, extra = {}) {
  return publish(new Request("https://community.test/api/games", { method: "POST", body: JSON.stringify({
    title: "Release fixture", license: "CC0", packageBase64: bytes.toString("base64"), ...extra,
  }) }));
}
function routes(loader = createReleaseLoader(pool)) {
  return {
    play: createReleasePlayHandler({ loadRelease: loader, loadListing: async slug =>
      (await pool.query("select release_id from openrpg_games where slug=$1 and status='visible'", [slug])).rows[0] ?? null }),
    download: createReleaseDownloadHandler({ loadRelease: loader }),
  };
}
const request = new Request("https://community.test/play/fixture");

test("publishes exact ZIP and manifest transactionally; gameId never updates an existing listing", async () => {
  const response = await upload();
  assert.equal(response.status, 201, await response.clone().text());
  first = await response.json();
  assert.equal(first.releaseId, fixture.release.manifest.releaseId);
  const second = await upload(fixture.bytes, { gameId: fixture.publication.gameId, slug: first.slug });
  assert.equal(second.status, 201);
  assert.notEqual((await second.json()).slug, first.slug);
  const publication = { ...fixture.publication, versionLabel: "2.0" };
  const version = await createGameRelease({ publication, entries: fixture.entries.map(entry => entry.name === "project.json"
    ? { ...entry, bytes: jsonBytes({ version: 4, meta: { publication }, maps: [], database: {} }) } : entry) });
  const third = await upload(Buffer.from(await version.blob.arrayBuffer()), { gameId: fixture.publication.gameId, slug: first.slug });
  assert.equal(third.status, 201);
  nextVersion = await third.json();
  assert.notEqual(nextVersion.slug, first.slug);
  assert.notEqual(nextVersion.releaseId, first.releaseId);
  const { rows } = await pool.query("select g.package_base64,r.zip_bytes,r.manifest from openrpg_games g join openrpg_game_releases r on r.listing_id=g.id where g.slug=$1", [first.slug]);
  assert.equal(rows[0].package_base64, null);
  assert.deepEqual(rows[0].zip_bytes, fixture.bytes);
  assert.deepEqual(rows[0].manifest, fixture.release.manifest);
  assert.equal((await pool.query("select count(*)::int as n from openrpg_game_releases")).rows[0].n, 3);
});

test("legacy source uploads, forged runtime bytes, untrusted runtime and malformed requests are rejected without writes", async () => {
  const source = Buffer.from(await writeStoredZip([{ name: "project.json", bytes: jsonBytes({ version: 3 }) }]).arrayBuffer());
  assert.equal((await upload(source)).status, 422);
  const forged = await createGameRelease({ publication: fixture.publication,
    entries: fixture.entries.map(entry => entry.name === "player.js" ? { ...entry, bytes: Buffer.from("evil") } : entry) });
  assert.equal((await upload(Buffer.from(await forged.blob.arrayBuffer()))).status, 422);
  const unavailable = createReleaseUploadHandler({ pool, loadRuntime: async () => { throw new Error("private/path"); } });
  const rejected = await unavailable(new Request("https://community.test/api/games", { method: "POST", body: JSON.stringify({ title: "x", license: "CC0", packageBase64: fixture.bytes.toString("base64") }) }));
  assert.equal(rejected.status, 422);
  assert.equal((await rejected.text()).includes("private/path"), false);
  assert.equal((await upload(fixture.bytes, { packageBase64: "!!!!" })).status, 400);
  assert.equal((await publish(new Request("https://community.test/api/games", { method: "POST", body: "null" }))).status, 400);
  assert.equal((await pool.query("select count(*)::int as n from openrpg_game_releases")).rows[0].n, 3);
});

test("body limits inspect actual chunks rather than trusting Content-Length", async () => {
  await assert.rejects(readBoundedJson(new Request("https://community.test", { method: "POST", body: "123456", headers: { "content-length": "1" } }), 5));
  await assert.rejects(readBoundedJson(new Request("https://community.test", { method: "POST", body: "{}", headers: { "content-length": "999" } }), 5));
  assert.deepEqual(await readBoundedJson(new Request("https://community.test", { method: "POST", body: "{}" }), 5), {});
  let cancelled = false;
  const chunks = new ReadableStream({
    pull(controller) { controller.enqueue(Uint8Array.of(32)); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(readBoundedJson(new Request("https://community.test", { method: "POST", body: chunks, duplex: "half" }), 5));
  assert.equal(cancelled, true);
});

test("play and download return exact retained bytes, qualified redirects, MIME and restrictive CSP", async () => {
  const { play, download } = routes();
  const redirect = await play(request, { slug: first.slug });
  assert.equal(redirect.status, 307);
  assert.equal(redirect.headers.get("location"), `/play/${first.slug}/releases/${first.releaseId}/player.html`);
  const rootRedirect = await play(request, { slug: first.slug, path: ["releases", first.releaseId] });
  assert.equal(rootRedirect.status, 307);
  for (const entry of fixture.entries) {
    const response = await play(request, { slug: first.slug, path: ["releases", first.releaseId, ...entry.name.split("/")] });
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(entry.bytes));
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("cache-control"), /immutable/);
    assert.match(response.headers.get("content-security-policy"), new RegExp(`/releases/${first.releaseId}/`));
  }
  const zip = await download(request, { slug: first.slug, releaseId: first.releaseId });
  assert.equal(zip.headers.get("content-type"), "application/zip");
  assert.deepEqual(Buffer.from(await zip.arrayBuffer()), fixture.bytes);
});

test("wrong listing, missing assets and traversal never fall through to shared deployment files", async () => {
  const { play, download } = routes();
  assert.equal((await play(request, { slug: "wrong-listing", path: ["releases", first.releaseId, "player.js"] })).status, 404);
  assert.equal((await download(request, { slug: "wrong-listing", releaseId: first.releaseId })).status, 404);
  assert.equal((await play(request, { slug: nextVersion.slug, path: ["releases", first.releaseId, "player.js"] })).status, 404);
  assert.equal((await download(request, { slug: nextVersion.slug, releaseId: first.releaseId })).status, 404);
  assert.equal((await play(request, { slug: first.slug, path: ["player.js"] })).status, 404);
  assert.equal((await play(request, { slug: first.slug, path: ["releases", first.releaseId, "assets", "absent.png"] })).status, 404);
  for (const segment of ["..", "%2e%2e", "a/b", "a\\b", "\0"]) {
    assert.equal((await play(request, { slug: first.slug, path: ["releases", first.releaseId, segment] })).status, 400);
  }
});

test("SQL protects bytes, manifests and association but permits metadata, counters and moderation", async () => {
  const listing = (await pool.query("select id from openrpg_games where slug=$1", [first.slug])).rows[0].id;
  for (const sql of [
    "update openrpg_game_releases set zip_bytes=zip_bytes where listing_id=$1",
    "update openrpg_game_releases set manifest=manifest where listing_id=$1",
    "delete from openrpg_game_releases where listing_id=$1",
    "update openrpg_games set release_id=null,package_base64='eA==' where id=$1",
    "update openrpg_games set slug='hijacked' where id=$1",
  ]) await assert.rejects(pool.query(sql, [listing]), { code: "23514" });
  await assert.rejects(pool.query("truncate openrpg_game_releases cascade"), { code: "23514" });
  const { play } = routes();
  assert.equal((await play(request, { slug: first.slug, path: ["releases", first.releaseId, "player.js"] })).status, 200);
  await pool.query("update openrpg_games set downloads=downloads+1,likes=likes+1,title='Changed metadata',status='hidden' where id=$1", [listing]);
  assert.equal((await play(request, { slug: first.slug, path: ["releases", first.releaseId, "player.js"] })).status, 404);
  await pool.query("update openrpg_games set status='visible' where id=$1", [listing]);
  const client = await pool.connect();
  try {
    await client.query("set role anon");
    await assert.rejects(client.query("select zip_bytes from openrpg_game_releases"), { code: "42501" });
  } finally { await client.query("reset role"); client.release(); }
});

test("failed transactions cannot leave orphan listings or mismatched release associations", async () => {
  const release = await validateReleaseArchive(fixture.bytes);
  await assert.rejects(insertReleaseListing(pool, { slug: first.slug, title: "duplicate", author: "test", description: "", tags: [], license: "CC0", coverDataUrl: null }, release), { code: "23505" });
  await assert.rejects(pool.query("insert into openrpg_games (slug,title,release_id) values ('orphan','orphan',$1)", [first.releaseId]), { code: "23503" });
  assert.equal((await pool.query("select count(*)::int as n from openrpg_games")).rows[0].n, 3);
});

test("legacy GET stays read-only and unavailable instead of using the current runtime", async () => {
  await pool.query("insert into openrpg_games (slug,title,package_base64) values ('legacy','Legacy','c291cmNl')");
  const before = (await pool.query("select * from openrpg_games where slug='legacy'")).rows[0];
  const { play } = routes();
  const response = await play(new Request("https://community.test/play/legacy?lang=ko"), { slug: "legacy" });
  assert.equal(response.status, 503);
  assert.match(response.headers.get("content-type"), /text\/plain/);
  assert.equal((await play(request, { slug: "legacy", path: ["project.json"] })).status, 404);
  assert.deepEqual((await pool.query("select * from openrpg_games where slug='legacy'")).rows[0], before);
});

test("release cache is bounded to two archives and still rechecks listing visibility", async () => {
  let archiveReads = 0;
  const loader = createReleaseLoader({ query: (sql, args) => {
    if (sql.startsWith("select zip_bytes")) archiveReads++;
    return pool.query(sql, args);
  } });
  const listings = (await pool.query("select slug,release_id from openrpg_games where release_id is not null order by slug")).rows;
  const load = index => loader(listings[index].slug, listings[index].release_id);
  assert.ok(await load(0));
  assert.ok(await load(0));
  assert.equal(archiveReads, 1);
  assert.ok(await load(1));
  assert.ok(await load(2));
  assert.equal(archiveReads, 3);
  assert.ok(await load(0));
  assert.equal(archiveReads, 4);
});

test("upload concurrency is bounded while trust validation is in flight", { timeout: 10_000 }, async () => {
  const gate = Promise.withResolvers();
  const entered = Promise.withResolvers();
  let count = 0;
  const handler = createReleaseUploadHandler({ pool, loadRuntime: async () => {
    if (++count === 2) entered.resolve();
    await gate.promise;
    return fixture.trusted;
  } });
  const makeRequest = () => new Request("https://community.test/api/games", { method: "POST", body: JSON.stringify({
    title: "Concurrent fixture", license: "CC0", packageBase64: fixture.bytes.toString("base64"),
  }) });
  const pending = [handler(makeRequest()), handler(makeRequest())];
  try {
    await entered.promise;
    assert.equal((await handler(makeRequest())).status, 503);
  } finally { gate.resolve(); }
  assert.deepEqual((await Promise.all(pending)).map(response => response.status), [201, 201]);
});

test("production UploadForm publishes a release and real Next routes play/download it unchanged", { timeout: 60_000 }, async () => {
  const server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", "0"], {
    cwd: isolatedSite,
    env: { ...process.env, COMMUNITY_DATABASE_URL: `postgresql://release_test@localhost/postgres?host=${encodeURIComponent(directory)}` },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    const origin = await new Promise((resolve, reject) => {
      let output = "";
      const timeout = setTimeout(() => finish(new Error(`Next readiness timeout: ${output}`)), 20_000);
      const onData = chunk => {
        output += chunk;
        const address = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
        if (address && output.includes("Ready in")) finish(undefined, address[0]);
      };
      const onExit = () => finish(new Error(`Next exited before readiness: ${output}`));
      const onError = error => finish(error);
      function finish(error, value) {
        clearTimeout(timeout);
        server.stdout.off("data", onData);
        server.stderr.off("data", onData);
        server.off("exit", onExit);
        server.off("error", onError);
        if (error) reject(error); else resolve(value);
      }
      server.stdout.on("data", onData);
      server.stderr.on("data", onData);
      server.once("exit", onExit);
      server.once("error", onError);
    });
    browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const browserErrors = [];
    page.on("console", message => { if (message.type() === "error") browserErrors.push(message.text()); });
    await page.goto(`${origin}/en/upload`);
    await page.locator(".type-toggle button").nth(1).click();
    assert.equal((await page.locator("#file").getAttribute("accept")).split(",").includes(".zip"), true);
    await page.locator("#name").fill("Browser release fixture");
    await page.locator("#license").selectOption("CC0");
    await page.locator("#file").setInputFiles({ name: "release.zip", mimeType: "application/zip", buffer: fixture.bytes });
    const posted = page.waitForResponse(response => response.url() === `${origin}/api/games` && response.request().method() === "POST");
    await page.locator("button[type=submit]").click();
    const response = await posted;
    assert.equal(response.status(), 201, await response.text());
    const uploaded = await response.json();
    await page.locator(".form-status.ok a").waitFor({ state: "visible" });
    assert.equal(await page.locator(".form-status.ok a").getAttribute("href"), `/en/games/${uploaded.slug}`);
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await page.screenshot({ path: path.join(evidenceDirectory, `upload-${width}.png`), fullPage: true });
    }
    await page.goto(`${origin}/en/games/${uploaded.slug}`);
    assert.equal(await page.locator(".hero-actions a.btn").nth(1).getAttribute("href"), `/api/games/${uploaded.slug}/releases/${uploaded.releaseId}/download`);
    const playback = await page.goto(`${origin}/play/${uploaded.slug}/`);
    assert.equal(playback.status(), 200);
    assert.equal(page.url(), `${origin}/play/${uploaded.slug}/releases/${uploaded.releaseId}/player.html`);
    assert.equal(await page.locator("body").getAttribute("data-release"), "retained-v1", JSON.stringify({ browserErrors, headers: playback.headers() }));
    const zip = await fetch(`${origin}/api/games/${uploaded.slug}/download`, { signal: AbortSignal.timeout(10_000) });
    assert.equal(zip.status, 200);
    assert.deepEqual(Buffer.from(await zip.arrayBuffer()), fixture.bytes);
    const legacy = await fetch(`${origin}/api/games/legacy/download`, { signal: AbortSignal.timeout(10_000) });
    assert.equal(legacy.status, 200);
    assert.equal(legacy.headers.get("content-type"), "application/vnd.openrpg.project+zip");
    assert.deepEqual(Buffer.from(await legacy.arrayBuffer()), Buffer.from("source"));
    const foreign = await fetch(`${origin}/play/${nextVersion.slug}/releases/${first.releaseId}/player.js`, { signal: AbortSignal.timeout(10_000) });
    assert.equal(foreign.status, 404);
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null) {
      const exited = once(server, "exit");
      server.kill("SIGTERM");
      await exited;
    }
  }
});

test("cold playback still uses exact stored bytes after deployment and operator archive changes", async () => {
  await writeFile(path.join(directory, "current-player.js"), "different-current-deployment");
  await rm(path.join(process.env.COMMUNITY_RUNTIME_ARCHIVE_ROOT, fixture.trusted.runtimeTarget), { recursive: true });
  const { play, download } = routes();
  const response = await play(request, { slug: first.slug, path: ["releases", first.releaseId, "player.js"] });
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), fixture.entries.find(entry => entry.name === "player.js").bytes);
  assert.deepEqual(Buffer.from(await (await download(request, { slug: first.slug, releaseId: first.releaseId })).arrayBuffer()), fixture.bytes);
});
