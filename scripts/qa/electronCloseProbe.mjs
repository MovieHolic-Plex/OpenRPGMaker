import { mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "@playwright/test";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const projectDir = mkdtempSync(join(tmpdir(), "oprn-el-close-"));
execFileSync("node", ["scripts/oprn-store.mjs", "init", projectDir], { cwd: REPO });
execFileSync("node", ["scripts/oprn-store.mjs", "import-json", projectDir, "--json", "test/fixtures/life-full.reloaded.project.json"], { cwd: REPO });

const app = await electron.launch({
  args: [join(REPO, "dist-electron/main.cjs"), "--disable-gpu", "--disable-dev-shm-usage"],
  cwd: REPO,
  env: {
    ...process.env,
    OPRN_SMOKE_PAGE: join(REPO, "test/fixtures/electronBridgeProbe.html"),
    OPRN_RENDERER_DIR: join(REPO, "dist"),
  },
});
const page = await app.firstWindow();
await page.waitForLoadState("domcontentloaded");
await page.evaluate(async (dir) => {
  const bridge = globalThis.oprn;
  await bridge.project.open({ projectDir: dir });
  bridge.lifecycle.onFlushBeforeClose(() => { void bridge.lifecycle.flushDone(); });
}, projectDir);
process.stdout.write("STEP registered\n");

const closed = new Promise((resolve) => app.on("close", resolve));
const t0 = Date.now();
await app.evaluate(({ BrowserWindow }) => {
  for (const window of BrowserWindow.getAllWindows()) window.close();
}).catch(() => {});
const winner = await Promise.race([closed.then(() => "closed"), new Promise((resolve) => setTimeout(() => resolve("timeout"), 12000))]);
const ms = Date.now() - t0;
process.stdout.write(`STEP graceful-close ${winner} ms=${ms}\n`);
rmSync(projectDir, { force: true, recursive: true });
process.stdout.write("CLEANUP_DONE\n");
process.exit(winner === "closed" && ms < 9000 ? 0 : 1);
