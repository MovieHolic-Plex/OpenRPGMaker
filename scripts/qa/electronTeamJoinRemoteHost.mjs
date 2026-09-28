// 두 컴퓨터 팀 참여 — 호스트 쪽. 이 컴퓨터에서 앱을 띄워 팀 호스트를 열고, 다른 컴퓨터의 참여 앱이
// 저장할 때까지 기다린다. 참여 쪽은 scripts/qa/electronTeamJoinRemoteMember.mjs.
//
// 실행: xvfb-run -a node scripts/qa/electronTeamJoinRemoteHost.mjs [--wait-seconds 900]
// 출력: HOST_READY urls=<json>  … 참여자 저장을 보면 HOST_SAW title=… revision=…
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "@playwright/test";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = "test/fixtures/life-full.reloaded.project.json";
const SHOTS = join(REPO, "verify-shots/electron-team-join-remote");
const waitIndex = process.argv.indexOf("--wait-seconds");
const WAIT_MS = (waitIndex > 0 ? Number(process.argv[waitIndex + 1]) : 900) * 1000;
// 측정용: 참여자 저장을 기다리지 않고 WAIT_MS 동안 호스트만 켜 둔다.
const SERVE_ONLY = process.argv.includes("--serve-only");
// 이미 있는 프로젝트 폴더를 연다(두 번째 열기부터의 실제 상태 — 미디어가 파일로 분리돼 있다). 없으면 새로 만든다.
const dirIndex = process.argv.indexOf("--project-dir");
const KEEP_DIR = dirIndex > 0 ? resolve(process.argv[dirIndex + 1]) : null;
mkdirSync(SHOTS, { recursive: true });
const log = (line) => process.stdout.write(line + "\n");

const scratch = mkdtempSync(join(tmpdir(), "oprn-team-remote-host-"));
const projectDir = KEEP_DIR ?? join(scratch, "host-project");
if (!KEEP_DIR || !existsSync(join(projectDir, "project.sqlite"))) {
  execFileSync("node", ["scripts/oprn-store.mjs", "init", projectDir], { cwd: REPO });
  execFileSync("node", ["scripts/oprn-store.mjs", "import-json", projectDir, "--json", FIXTURE], { cwd: REPO });
}
const info = () => JSON.parse(execFileSync("node", ["scripts/oprn-store.mjs", "info", projectDir], { cwd: REPO, encoding: "utf8" }));
const before = info();
log("HOST_PROJECT revision=" + before.revision + " title=" + JSON.stringify(before.title));

const app = await electron.launch({
  args: [REPO, "--disable-gpu", "--disable-dev-shm-usage", "--user-data-dir=" + join(scratch, "userdata")],
  cwd: REPO,
  // OPRN_QA_RENDERER_DIR: 프로파일용 비압축 빌드(vite build --minify false --outDir …)를 참여 창에 준다.
  env: { ...process.env, XDG_CONFIG_HOME: join(scratch, "config"), OPRN_RENDERER_DIR: process.env.OPRN_QA_RENDERER_DIR ?? join(REPO, "dist"), OPRN_OPEN_PROJECT_DIR: projectDir },
  timeout: 60_000,
});
let verdict = "FAIL";
try {
  const page = await app.firstWindow({ timeout: 30_000 });
  await page.waitForSelector("#app .topbar", { timeout: 90_000 });
  const hosted = await app.evaluate(async ({ BrowserWindow, Menu, dialog }) => {
    const captured = [];
    dialog.showMessageBox = async (_w, options) => { captured.push(options); return { response: 0, checkboxChecked: false }; };
    BrowserWindow.getAllWindows()[0].focus();
    Menu.getApplicationMenu().items.find((i) => i.label === "파일").submenu.items.find((i) => i.label === "팀 협업 시작 / 관리").click();
    for (let i = 0; i < 100 && captured.length === 0; i++) await new Promise((r) => setTimeout(r, 100));
    return captured[0] ?? null;
  });
  writeFileSync(join(SHOTS, "host-dialog.json"), JSON.stringify(hosted, null, 2));
  const urls = String(hosted?.detail ?? "").match(/http:\/\/[\d.]+:\d+/g) ?? [];
  log("HOST_READY urls=" + JSON.stringify(urls));
  if (urls.length === 0) throw new Error("team host did not start: " + JSON.stringify(hosted));
  if (SERVE_ONLY) {
    // --profile-seconds N: 호스트 앱 메인 프로세스 CPU 를 N초 잰다(참여자 동작을 그 사이에 돌린다).
    const profIndex = process.argv.indexOf("--profile-at");
    if (profIndex > 0) {
      const [delay, seconds] = process.argv[profIndex + 1].split(",").map(Number);
      await new Promise((r) => setTimeout(r, delay * 1000));
      const inspector = await app.evaluate(async () => { const { Session } = process.getBuiltinModule("node:inspector"); globalThis.__probeSession = new Session(); globalThis.__probeSession.connect(); await new Promise((r) => globalThis.__probeSession.post("Profiler.enable", r)); await new Promise((r) => globalThis.__probeSession.post("Profiler.start", r)); return true; });
      log("HOST_PROFILE_START " + inspector);
      await new Promise((r) => setTimeout(r, seconds * 1000));
      const profile = await app.evaluate(async () => new Promise((r) => globalThis.__probeSession.post("Profiler.stop", (err, res) => r(JSON.stringify(res.profile)))));
      writeFileSync(join(SHOTS, "host-main.cpuprofile"), profile);
      log("HOST_PROFILE_DONE " + join(SHOTS, "host-main.cpuprofile"));
    }
    await new Promise((r) => setTimeout(r, WAIT_MS));
    verdict = "SERVED";
    throw new Error("serve-only finished");
  }

  // 참여자가 저장하면 정본 revision 이 오른다. 그 뒤 호스트 앱(IPC)이 같은 값을 읽는지 본다.
  const deadline = Date.now() + WAIT_MS;
  let after = before;
  while (Date.now() < deadline) {
    after = info();
    if (after.revision > before.revision && after.title !== before.title) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (after.revision === before.revision) throw new Error("no member save within " + WAIT_MS / 1000 + "s");
  const hostSees = await page.evaluate(async () => {
    const project = await globalThis.oprn.project.status();
    const loaded = await globalThis.oprn.project.loadFolded({ projectDir: project.projectDir });
    return { revision: loaded.revision, title: JSON.parse(loaded.folded ?? loaded.serialized).meta?.title };
  });
  log("HOST_SAW sqliteRevision=" + after.revision + " sqliteTitle=" + JSON.stringify(after.title) + " appReload=" + JSON.stringify(hostSees));
  await page.waitForTimeout(5000);
  await page.screenshot({ path: join(SHOTS, "host-editor.png") });
  verdict = hostSees.title === after.title && hostSees.revision === after.revision ? "PASS" : "FAIL";
} catch (error) {
  log("HOST_ERROR " + String(error?.stack ?? error).slice(0, 500));
} finally {
  await Promise.race([app.evaluate(({ app: a }) => a.exit(0)).catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
  try { if (app.process()?.exitCode === null) app.process()?.kill("SIGKILL"); } catch {}
  rmSync(scratch, { force: true, recursive: true, maxRetries: 5, retryDelay: 500 });
}
log("HOST_VERDICT=" + verdict);
