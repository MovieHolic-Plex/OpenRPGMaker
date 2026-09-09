import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const { Pool } = createRequire(new URL("../community-site/package.json", import.meta.url))("pg");
const { chromium } = createRequire(import.meta.url)("playwright");

test("same-origin listings isolate real save/load DOM and copy only player-selected files", { timeout: 120_000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "oprn-save-isolation-"));
  let postgres, pool, server, browser;
  try {
    const pgBin = process.env.COMMUNITY_TEST_PG_BIN ?? "/usr/lib/postgresql/16/bin";
    execFileSync(path.join(pgBin, "initdb"), ["-D", path.join(directory, "db"), "-A", "trust", "-U", "save_test", "--no-locale", "--encoding=UTF8"], { stdio: "pipe" });
    postgres = spawn(path.join(pgBin, "postgres"), ["-D", path.join(directory, "db"), "-k", directory, "-c", "listen_addresses=", "-c", "fsync=off"], { stdio: ["ignore", "ignore", "pipe"] });
    await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(() => finish(new Error("Postgres readiness timeout")), 20_000);
      const data = chunk => { output += chunk; if (output.includes("database system is ready to accept connections")) finish(); };
      const exit = () => finish(new Error(output));
      function finish(error) {
        clearTimeout(timer); postgres.stderr.off("data", data); postgres.off("exit", exit); postgres.off("error", finish);
        if (error) reject(error); else resolve();
      }
      postgres.stderr.on("data", data); postgres.once("exit", exit); postgres.once("error", finish);
    });
    pool = new Pool({ host: directory, user: "save_test", database: "postgres", max: 2 });
    await pool.query("create role anon; create role authenticated");
    for (const file of ["0001_openrpg_community.sql", "0002_lock_down_writes.sql", "0003_board.sql", "0004_community_upgrade.sql", "0005_report_privacy.sql", "0006_immutable_game_releases.sql"]) {
      await pool.query(await readFile(path.join(root, "community-site/db", file), "utf8"));
    }
    const apiPath = path.join(directory, "api.mjs");
    await build({ stdin: { resolveDir: root, contents: `
      export { createBlankProject } from './src/project/defaults';
      export { serialize } from './src/project/io';
      export { sha256HexText } from './src/util/sha256';
      export { createGameRelease, createRuntimeManifest, jsonBytes } from './src/project/gameRelease';
      export { createReleaseUploadHandler } from './community-site/lib/releaseUpload';
      export { createReleaseLoader } from './community-site/lib/releaseStore';
      export { createReleasePlayHandler } from './community-site/lib/releaseRoutes';
      export { operatorRuntimeWithCollector } from './community-site/lib/releaseArchive';
    ` }, outfile: apiPath, bundle: true, platform: "node", format: "esm", target: "node24" });
    const api = await import(pathToFileURL(apiPath).href);
    const client = await build({ entryPoints: [path.join(root, "test/fixtures/communitySaveIsolationEntry.ts")], bundle: true,
      write: false, platform: "browser", format: "esm", target: "es2022",
      alias: { "@/project/store": path.join(root, "src/player/exportProjectStoreShim.ts"), "@": path.join(root, "src") } });
    const runtimeEntries = [
      { name: "web/player.html", bytes: Buffer.from('<!doctype html><html><head></head><body><div id="app"></div><script type="module" src="./player.js"></script></body></html>') },
      { name: "web/player.js", bytes: client.outputFiles[0].contents },
      // The save-only fixture has no media loaders. Its retained collector reflects that runtime.
      { name: "web/dependency-collector.js", bytes: Buffer.from('var OPRN_RELEASE_COLLECTOR={collectReleaseDependencies:()=>[]};') },
    ];
    const trusted = await api.operatorRuntimeWithCollector(await api.createRuntimeManifest(runtimeEntries, []), runtimeEntries[2].bytes);
    const runtimes = new Map([[trusted.runtimeTarget, trusted]]);
    const loadRuntime = async target => { const value = runtimes.get(target); if (!value) throw new Error("Unknown runtime"); return value; };
    const publish = api.createReleaseUploadHandler({ pool, loadRuntime });
    const play = api.createReleasePlayHandler({ loadRelease: api.createReleaseLoader(pool), loadListing: async slug =>
      (await pool.query("select release_id from openrpg_games where slug=$1 and status='visible'", [slug])).rows[0] ?? null });
    server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const request = new Request(url, { method: req.method, headers: req.headers,
          ...(req.method === "POST" ? { body: Readable.toWeb(req), duplex: "half" } : {}) });
        const segments = url.pathname.split("/").filter(Boolean);
        const response = url.pathname === "/api/games" ? await publish(request)
          : await play(request, { slug: segments[1], path: segments.slice(2) });
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (error) { console.error(error); res.writeHead(500); res.end(); }
    });
    const listening = once(server, "listening"); server.listen(0, "127.0.0.1"); await listening;
    const origin = `http://127.0.0.1:${server.address().port}`;
    const publication = { gameId: "copied-public-identity", saveCompatibilityId: "original-lineage", acceptedSaveCompatibilityIds: [], versionLabel: "1", runtimeTarget: trusted.runtimeTarget };
    const makeRelease = async identity => {
      const project = api.createBlankProject(); project.meta.publication = identity;
      return api.createGameRelease({ publication: identity, entries: [...runtimeEntries.map(entry => ({ ...entry, name: entry.name.slice(4) })),
        { name: "project.json", bytes: Buffer.from(api.serialize(project)) }] });
    };
    const upload = async release => fetch(`${origin}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      title: "Save isolation fixture", license: "CC0", packageBase64: Buffer.from(await release.blob.arrayBuffer()).toString("base64"),
    }) });
    const release = await makeRelease(publication);
    const aResponse = await upload(release), bResponse = await upload(release);
    assert.equal(aResponse.status, 201); assert.equal(bResponse.status, 201);
    const a = await aResponse.json(), b = await bResponse.json(); assert.notEqual(a.slug, b.slug);
    const successor = await makeRelease({ ...publication, saveCompatibilityId: "successor", acceptedSaveCompatibilityIds: [publication.saveCompatibilityId] });
    const cResponse = await upload(successor); assert.equal(cResponse.status, 201); const c = await cResponse.json();

    // Honest retained old manifest, same trusted bytes, no capability: reject before inserting either row.
    const { runtimeTarget: _target, capabilities: _capabilities, collectDependencies: _collect, ...body } = trusted;
    const oldBody = { ...body, collectorVersion: 1 };
    const old = { ...oldBody, runtimeTarget: await api.sha256HexText(JSON.stringify(oldBody)) }; runtimes.set(old.runtimeTarget, old);
    assert.equal((await upload(await makeRelease({ ...publication, runtimeTarget: old.runtimeTarget }))).status, 422);
    assert.equal((await pool.query("select count(*)::int as n from openrpg_games")).rows[0].n, 3);
    assert.equal((await pool.query("select count(*)::int as n from openrpg_game_releases")).rows[0].n, 3);

    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({ acceptDownloads: true });
    await context.addInitScript(() => localStorage.setItem("rpg-zzu:save-slot:1", "legacy-victim-bytes"));
    const aPage = await context.newPage(), bPage = await context.newPage(), cPage = await context.newPage();
    const errors = []; for (const page of [aPage, bPage, cPage]) page.on("pageerror", error => errors.push(error.message));
    const visit = async (page, listing) => { await page.goto(`${origin}/play/${listing.slug}`); await page.getByTestId("save-slot-1").waitFor({ state: "visible" }); };
    await visit(aPage, a);
    const aKeys = await aPage.evaluate(() => window.saveIsolationQa.save(41));
    const victimBytes = await aPage.evaluate(keys => [localStorage.getItem(keys.manual), localStorage.getItem(keys.auto)], aKeys);
    assert.ok(victimBytes.every(Boolean));
    const downloadPromise = aPage.waitForEvent("download");
    await aPage.getByTestId("save-slot-export-1").focus(); await aPage.keyboard.press("Enter");
    const download = await downloadPromise; const saveFile = path.join(directory, "selected-save.json"); await download.saveAs(saveFile);
    assert.equal(JSON.parse(await readFile(saveFile, "utf8")).session.gold, 41);
    const autoDownloadPromise = aPage.waitForEvent("download");
    await aPage.getByTestId("save-slot-export-auto").focus(); await aPage.keyboard.press("Enter");
    const autoFile = path.join(directory, "selected-auto.json"); await (await autoDownloadPromise).saveAs(autoFile);
    assert.equal(JSON.parse(await readFile(autoFile, "utf8")).savedBy, "auto");
    await visit(bPage, b);
    const bKeys = await bPage.evaluate(() => window.saveIsolationQa.keys()); assert.notDeepEqual(bKeys, aKeys);
    assert.equal(await bPage.getByTestId("save-slot-auto").count(), 0);
    assert.equal(await bPage.locator('[data-testid^="save-slot-import-"]').count(), 0);
    assert.equal(await bPage.locator('[data-testid^="save-slot-export-"]').count(), 0);
    assert.equal(await bPage.evaluate(key => localStorage.getItem(key), bKeys.manual), null);
    await bPage.evaluate(() => window.saveIsolationQa.save(999));
    assert.deepEqual(await aPage.evaluate(keys => [localStorage.getItem(keys.manual), localStorage.getItem(keys.auto)], aKeys), victimBytes);
    await visit(cPage, c);
    assert.equal(await cPage.locator('[data-testid^="save-slot-import-"]').count(), 0);
    assert.equal(await cPage.getByTestId("save-slot-auto").count(), 0);
    const selectCopy = async (page, file) => {
      const chooserPromise = page.waitForEvent("filechooser");
      await page.getByTestId("save-slot-select-file").focus(); await page.keyboard.press("Enter");
      const chooser = await chooserPromise;
      await page.evaluate(() => { window.copyLoaded = new Promise(resolve => document.body.addEventListener("save-loaded", resolve, { once: true })); });
      await chooser.setFiles(file);
      await page.evaluate(() => window.copyLoaded);
    };
    await selectCopy(cPage, saveFile);
    assert.equal(await cPage.locator("body").getAttribute("data-loaded-gold"), "41");
    assert.deepEqual(await aPage.evaluate(keys => [localStorage.getItem(keys.manual), localStorage.getItem(keys.auto)], aKeys), victimBytes);
    const copied = await cPage.evaluate(() => JSON.parse(localStorage.getItem(window.saveIsolationQa.keys().manual)));
    assert.equal(copied.identity.isolationScope, c.slug); assert.equal(copied.identity.saveCompatibilityId, "successor");
    await selectCopy(bPage, autoFile);
    assert.equal(await bPage.locator("body").getAttribute("data-loaded-gold"), "41");
    assert.equal(await bPage.evaluate(key => JSON.parse(localStorage.getItem(key)).session.gold, bKeys.manual), 999);
    assert.deepEqual(await aPage.evaluate(keys => [localStorage.getItem(keys.manual), localStorage.getItem(keys.auto)], aKeys), victimBytes);
    assert.equal(await aPage.evaluate(() => localStorage.getItem("rpg-zzu:save-slot:1")), "legacy-victim-bytes");
    assert.equal(await aPage.evaluate(() => localStorage.getItem("oprn:storage-migrated")), null);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ listings: [a.slug, b.slug, c.slug], manualAndAutoIsolated: true, victimGold: 41, otherGold: 999,
      predecessorControlsExposed: 0, originalsUnchanged: true, selectedFileCopyGold: copied.session.gold, oldRuntimeUploadStatus: 422 }));
  } finally {
    if (browser) await browser.close();
    if (server) { const closed = once(server, "close"); server.close(); server.closeAllConnections(); await closed; }
    if (pool) await pool.end();
    if (postgres && postgres.exitCode === null) { const exited = once(postgres, "exit"); postgres.kill("SIGTERM"); await exited; }
    await rm(directory, { recursive: true, force: true });
  }
});
