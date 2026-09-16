import { mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "@playwright/test";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const projectDir = mkdtempSync(join(tmpdir(), "oprn-el-probe-"));
execFileSync("node", ["scripts/oprn-store.mjs", "init", projectDir], { cwd: REPO });
execFileSync("node", ["scripts/oprn-store.mjs", "import-json", projectDir, "--json", "test/fixtures/life-full.reloaded.project.json"], { cwd: REPO });
process.stdout.write(`probe dir=${projectDir}\n`);

const app = await electron.launch({
  args: [join(REPO, "dist-electron/main.cjs"), "--disable-gpu", "--disable-dev-shm-usage"],
  cwd: REPO,
  env: {
    ...process.env,
    OPRN_SMOKE_PAGE: join(REPO, "test/fixtures/electronBridgeProbe.html"),
    OPRN_RENDERER_DIR: join(REPO, "dist"),
  },
  timeout: 30_000,
});
process.stdout.write("STEP launched\n");

app.process().stderr?.on("data", (chunk) => process.stdout.write(`MAIN-STDERR: ${chunk}`));
app.process().stdout?.on("data", (chunk) => process.stdout.write(`MAIN: ${chunk}`));

const page = await app.firstWindow({ timeout: 20_000 });
process.stdout.write("STEP firstWindow\n");
page.on("console", (message) => process.stdout.write(`PAGE: ${message.type()} ${message.text()}\n`));
page.on("pageerror", (error) => process.stdout.write(`PAGE-ERROR: ${error.message}\n`));

try {
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });
  process.stdout.write("STEP domcontentloaded\n");
} catch (error) {
  process.stdout.write(`STEP domcontentloaded FAILED: ${String(error)}\n`);
}

const bridgeType = await Promise.race([
  page.evaluate(() => typeof globalThis.oprn),
  new Promise((resolve) => setTimeout(() => resolve("TIMEOUT"), 10_000)),
]);
process.stdout.write(`STEP bridge type = ${bridgeType}\n`);

const result = await Promise.race([
  page.evaluate(async (dir) => {
    const started = Date.now();
    const bridge = globalThis.oprn;
    const opened = await bridge.project.open({ projectDir: dir });
    const t1 = Date.now();
    const loaded = await bridge.project.load();
    const t2 = Date.now();
    return { opened: opened.projectId, msOpen: t1 - started, msLoad: t2 - t1, revision: loaded.revision };
  }, projectDir),
  new Promise((resolve) => setTimeout(() => resolve("EVAL_TIMEOUT"), 25_000)),
]);
process.stdout.write(`STEP eval = ${JSON.stringify(result)}\n`);

await Promise.race([
  app.evaluate(({ app: electronApp }) => { electronApp.exit(0); }).catch(() => {}),
  new Promise((resolvePromise) => setTimeout(resolvePromise, 3_000)),
]);
await Promise.race([
  app.close().catch(() => {}),
  new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000)),
]);
if (app.process().exitCode === null) app.process().kill("SIGKILL");
process.stdout.write("STEP closed\n");
rmSync(projectDir, { force: true, recursive: true });
process.stdout.write("CLEANUP_DONE\n");