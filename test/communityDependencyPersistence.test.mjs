import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { buildReleaseCollector } from "../scripts/lib/releaseCollectorBuild.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const { Pool } = createRequire(new URL("../community-site/package.json", import.meta.url))("pg");

test("frozen dependency closure rejects coherent omissions before PostgreSQL persistence", { timeout: 120_000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "oprn-dependency-persistence-"));
  const previousArchive = process.env.COMMUNITY_RUNTIME_ARCHIVE_ROOT;
  const previousCwd = process.cwd();
  let postgres, pool;
  try {
    const apiPath = path.join(directory, "ingress.mjs");
    const result = await build({ stdin: { resolveDir: root, contents: `
      export { createGameRelease, createRuntimeManifest, jsonBytes } from './src/project/gameRelease';
      export { createReleaseUploadHandler } from './community-site/lib/releaseUpload';
      export { validateReleaseArchive, loadOperatorRuntime } from './community-site/lib/releaseArchive';
    ` }, outfile: apiPath, bundle: true, platform: "node", format: "esm", target: "node24", metafile: true });
    assert.ok(Object.keys(result.metafile.inputs).every(name => !/src\/(assets\/|project\/(io\/|webExportAssets|releaseDependencyCollector))/.test(name)),
      "Ingress must not import current resource data, collectors or editor normalization");
    const api = await import(pathToFileURL(apiPath).href);
    const projectPath = path.join(directory, "project-fixture.mjs");
    await build({ stdin: { resolveDir: root, contents: `export { createBlankProject } from './src/project/defaults';` },
      outfile: projectPath, bundle: true, platform: "node", format: "esm", define: { "import.meta.env": "{}" } });
    const project = (await import(pathToFileURL(projectPath).href)).createBlankProject();
    project.system.defaultBgmResourceId = "cc0-bgm-field";
    project.system.titleResourceId = "oprn-title-field";
    const collector = await buildReleaseCollector(root);
    const { runInNewContext } = await import("node:vm");
    const dependencies = runInNewContext(`${Buffer.from(collector).toString()}\nOPRN_RELEASE_COLLECTOR.collectReleaseDependencies(projectJson)`,
      { projectJson: JSON.stringify(project), TextEncoder, TextDecoder, atob }, { timeout: 5000 });
    const missingPaths = ["assets/generated/title/oprn-title-field.png", "assets/cc0/audio/bgm/field-of-dreams.mp3"];
    const publicEntries = await Promise.all(dependencies.filter(dep => !dep.dataUrl).map(async dep => ({ name: dep.path,
      // The adversarial PNG/music use actual payloads; unrelated media is inert fixture content.
      bytes: missingPaths.includes(dep.path) ? await readFile(path.join(root, "public", dep.path)) : Buffer.from(`retained:${dep.path}`) })));
    const web = [{ name: "player.html", bytes: Buffer.from("<!doctype html><script src='./player.js'></script>") },
      { name: "player.js", bytes: Buffer.from("/* retained fixture runtime */") }, { name: "dependency-collector.js", bytes: collector }];
    const runtime = await api.createRuntimeManifest([...web.map(entry => ({ ...entry, name: `web/${entry.name}` })),
      ...publicEntries.map(entry => ({ ...entry, name: `public/${entry.name}` }))], []);
    project.meta.publication = { gameId: "retained-dependencies", versionLabel: "1", runtimeTarget: runtime.runtimeTarget,
      saveCompatibilityId: "retained-save", acceptedSaveCompatibilityIds: [] };
    const makeRelease = async (omit, changedProject = project) => {
      const projectBytes = Buffer.from(` \n${JSON.stringify(changedProject)}\n`);
      const release = await api.createGameRelease({ publication: changedProject.meta.publication,
        entries: [...web, ...publicEntries.filter(entry => entry.name !== omit), { name: "project.json", bytes: projectBytes }] });
      return { bytes: Buffer.from(await release.blob.arrayBuffer()), projectBytes };
    };
    process.env.COMMUNITY_RUNTIME_ARCHIVE_ROOT = path.join(directory, "archive");
    const retain = async (manifest, bytes) => {
      const target = path.join(process.env.COMMUNITY_RUNTIME_ARCHIVE_ROOT, manifest.runtimeTarget);
      await mkdir(path.join(target, "web"), { recursive: true });
      await writeFile(path.join(target, "runtime.json"), api.jsonBytes(manifest));
      await writeFile(path.join(target, "web/dependency-collector.js"), bytes);
    };
    await retain(runtime, collector);
    // A second supported operator runtime has a different frozen catalog, not just a different label.
    const newerCollector = Buffer.from(Buffer.from(collector).toString().replaceAll("field-of-dreams.mp3", "new-field.mp3"));
    assert.notDeepEqual(newerCollector, Buffer.from(collector));
    const newerWeb = web.map(entry => entry.name === "dependency-collector.js" ? { ...entry, bytes: newerCollector }
      : entry.name === "player.js" ? { ...entry, bytes: Buffer.from("/* newer runtime */") } : entry);
    const newerPublic = publicEntries.map(entry => ({ ...entry, name: entry.name.replace("field-of-dreams.mp3", "new-field.mp3") }));
    const newer = await api.createRuntimeManifest([...newerWeb.map(entry => ({ ...entry, name: `web/${entry.name}` })),
      ...newerPublic.map(entry => ({ ...entry, name: `public/${entry.name}` }))], []);
    await retain(newer, newerCollector);
    await writeFile(path.join(process.env.COMMUNITY_RUNTIME_ARCHIVE_ROOT, "default.json"), api.jsonBytes({ runtimeTarget: newer.runtimeTarget }));
    // Upload execution has no source tree or public directory; both collectors are independent artifacts.
    await rm(projectPath);
    process.chdir(directory);
    const pgBin = process.env.COMMUNITY_TEST_PG_BIN ?? "/usr/lib/postgresql/16/bin";
    execFileSync(path.join(pgBin, "initdb"), ["-D", path.join(directory, "db"), "-A", "trust", "-U", "dependency_test", "--no-locale", "--encoding=UTF8"], { stdio: "pipe" });
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
    pool = new Pool({ host: directory, user: "dependency_test", database: "postgres", max: 2 });
    await pool.query("create role anon; create role authenticated");
    for (const file of ["0001_openrpg_community.sql", "0002_lock_down_writes.sql", "0003_board.sql", "0004_community_upgrade.sql", "0005_report_privacy.sql", "0006_immutable_game_releases.sql"]) {
      await pool.query(await readFile(path.join(root, "community-site/db", file), "utf8"));
    }
    const publish = api.createReleaseUploadHandler({ pool });
    const upload = release => publish(new Request("http://127.0.0.1/api/games", { method: "POST", body: JSON.stringify({
      title: "Frozen dependency test", license: "CC0", packageBase64: release.bytes.toString("base64"),
    }) }));
    for (const missing of missingPaths) {
      assert.equal(runtime.requiredAssets.includes(missing), false);
      assert.equal((await upload(await makeRelease(missing))).status, 422);
    }
    for (const ref of ["unknown-authored-track", "https://external.invalid/music.mp3", "//external.invalid/music.mp3"]) {
      const changed = structuredClone(project); changed.system.defaultBgmResourceId = ref;
      assert.equal((await upload(await makeRelease(undefined, changed))).status, 422);
    }
    assert.equal((await pool.query("select count(*)::int as n from openrpg_games")).rows[0].n, 0);
    assert.equal((await pool.query("select count(*)::int as n from openrpg_game_releases")).rows[0].n, 0);
    const complete = await makeRelease();
    const validated = await api.validateReleaseArchive(complete.bytes);
    assert.deepEqual(Buffer.from(validated.entries.get("project.json")), complete.projectBytes);
    const newerRuntime = await api.loadOperatorRuntime(newer.runtimeTarget);
    assert.ok(newerRuntime.collectDependencies(JSON.stringify(project)).some(dep => dep.path.endsWith("new-field.mp3")));
    const newerProject = structuredClone(project); newerProject.meta.publication.runtimeTarget = newer.runtimeTarget;
    const newerRelease = await api.createGameRelease({ publication: newerProject.meta.publication,
      entries: [...newerWeb, ...newerPublic, { name: "project.json", bytes: api.jsonBytes(newerProject) }] });
    await api.validateReleaseArchive(Buffer.from(await newerRelease.blob.arrayBuffer()));
    const response = await upload(complete); assert.equal(response.status, 201, await response.clone().text());
    assert.equal((await pool.query("select count(*)::int as n from openrpg_games")).rows[0].n, 1);
    assert.deepEqual((await pool.query("select zip_bytes from openrpg_game_releases")).rows[0].zip_bytes, complete.bytes);
    console.log(JSON.stringify({ omissionsRejectedBeforeRows: missingPaths, unresolvedExternalRejected: true,
      selectedOlderCollector: runtime.runtimeTarget, differentCurrentCollector: newer.runtimeTarget, currentSourcesUnavailable: true, exactBytesPersisted: true }));
  } finally {
    process.chdir(previousCwd);
    if (previousArchive === undefined) delete process.env.COMMUNITY_RUNTIME_ARCHIVE_ROOT;
    else process.env.COMMUNITY_RUNTIME_ARCHIVE_ROOT = previousArchive;
    if (pool) await pool.end();
    if (postgres && postgres.exitCode === null) { const exited = once(postgres, "exit"); postgres.kill("SIGTERM"); await exited; }
    await rm(directory, { recursive: true, force: true });
  }
});
