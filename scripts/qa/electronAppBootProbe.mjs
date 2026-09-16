// 실제 앱 부팅 증거: 폴더를 연 채로 Electron 을 띄워 편집기가 그 폴더 위에서 뜨는지 본다.
//
// 왜 필요한가: 브리지 프로브(electronBridgeProbe.mjs)는 테스트 페이지에서 브리지만 두드린다.
// "사용자가 앱을 켜면 편집기가 로컬 폴더 정본 위에서 돈다" 는 그 프로브로는 증명되지 않는다 —
// 렌더러가 열린 세션에 다시 붙는 경로(attachElectronFolderAtBoot)는 여기서만 지나간다.
//
// 실행: xvfb-run -a node scripts/qa/electronAppBootProbe.mjs
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "@playwright/test";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = "test/fixtures/life-full.reloaded.project.json";
const SHOTS = join(REPO, "verify-shots/electron-app-boot");
const DB_REQUIRED_PANEL = process.env.OPRN_DB_REQUIRED_SELECTOR ?? ".db-required-panel";

const projectDir = mkdtempSync(join(tmpdir(), "oprn-app-boot-"));
execFileSync("node", ["scripts/oprn-store.mjs", "init", projectDir], { cwd: REPO });
execFileSync("node", ["scripts/oprn-store.mjs", "import-json", projectDir, "--json", FIXTURE], { cwd: REPO });
const revisionBefore = Number(JSON.parse(execFileSync("node", ["scripts/oprn-store.mjs", "info", projectDir], { cwd: REPO, encoding: "utf8" })).revision);
process.stdout.write(`STEP folder=${projectDir} revisionBefore=${revisionBefore}\n`);

const app = await electron.launch({
  args: [join(REPO, "dist-electron/main.cjs"), "--disable-gpu", "--disable-dev-shm-usage"],
  // 패키징된 앱을 같은 증거로 검사할 수 있게 실행 파일을 바꿔 끼울 수 있다(OPRN_ELECTRON_EXECUTABLE).
  // 그때는 main.cjs 경로 대신 패키지 안의 main 이 쓰이므로 인자를 비운다.
  ...(process.env.OPRN_ELECTRON_EXECUTABLE
    ? { executablePath: process.env.OPRN_ELECTRON_EXECUTABLE, args: ["--disable-gpu", "--disable-dev-shm-usage"] }
    : {}),
  cwd: REPO,
  env: {
    ...process.env,
    OPRN_OPEN_PROJECT_DIR: projectDir,
    // 패키지 실행 파일을 검사할 때는 렌더러 경로를 주지 않는다 — asar 안의 자기 dist 를 써야
    // 패키징된 산출물을 검사하는 것이 된다.
    ...(process.env.OPRN_ELECTRON_EXECUTABLE ? {} : { OPRN_RENDERER_DIR: join(REPO, "dist") }),
  },
  timeout: 60_000,
});
process.stdout.write("STEP launched\n");

const page = await app.firstWindow({ timeout: 30_000 });
const pageErrors = [];
const consoleLog = [];
page.on("pageerror", (error) => pageErrors.push(String(error.message)));
page.on("console", (message) => consoleLog.push(`${message.type()}: ${message.text()}`.slice(0, 300)));

const booted = await page
  .waitForSelector("#app .topbar", { timeout: 60_000 })
  .then(() => true)
  .catch(() => false);
process.stdout.write(`STEP editorShell=${booted} url=${page.url()}\n`);

// 편집기 본문(맵 캔버스·레일)은 비동기로 붙는다. 고정 대기 대신 실제로 나타날 때까지 기다린다.
const bodyMounted = await page
  .waitForFunction(() => {
    const main = document.querySelector("#app .main");
    if (!main) return false;
    return main.children.length > 0 || main.querySelector("canvas") !== null;
  }, { timeout: 45_000 })
  .then(() => true)
  .catch(() => false);
process.stdout.write(`STEP editorBody=${bodyMounted}\n`);

const report = await page.evaluate(async () => {
  const bridge = globalThis.oprn;
  // 파일 메뉴의 저장이 렌더러까지 도달하는지 세는 탐침. 실제 핸들러도 함께 돈다.
  const counters = globalThis;
  counters.__oprnSaveRequests = 0;
  bridge.lifecycle.onSaveRequest(() => { counters.__oprnSaveRequests += 1; });
  const status = await bridge.project.status();
  const loaded = await bridge.project.load();
  return {
    statusKind: String(status?.kind),
    statusProjectDir: String(status?.projectDir ?? ""),
    revision: loaded ? Number(loaded.revision) : -1,
    serializedLength: loaded ? String(loaded.serialized).length : 0,
    dbRequiredPanel: document.querySelector(".db-required-panel") !== null,
    topbarText: (document.querySelector("#app .topbar")?.textContent ?? "").slice(0, 120),
    mainChildren: document.querySelector("#app .main")?.children.length ?? -1,
    appChildClasses: [...(document.getElementById("app")?.children ?? [])].map((entry) => entry.className).slice(0, 12),
    canvasCount: document.querySelectorAll("canvas").length,
    mainHtmlHead: (document.querySelector("#app .main")?.innerHTML ?? "").slice(0, 200),
  };
}).catch((error) => ({ error: String(error) }));
process.stdout.write(`STEP report=${JSON.stringify(report)}\n`);

// 파일 → 저장 메뉴를 실제로 눌러 주 프로세스 → 브리지 → 렌더러 배선을 확인한다.
const menuSave = await app.evaluate(({ Menu }) => {
  const fileMenu = Menu.getApplicationMenu()?.items.find((item) => item.label === "파일");
  const save = fileMenu?.submenu?.items.find((item) => item.id === "file-save");
  if (!save) return { found: false };
  save.click();
  return { found: true };
}).catch((error) => ({ found: false, error: String(error) }));
await page.waitForTimeout(500);
const saveRequests = await page.evaluate(() => globalThis.__oprnSaveRequests ?? -1);
process.stdout.write(`STEP menuSave=${JSON.stringify(menuSave)} rendererSaveRequests=${saveRequests}\n`);

try {
  execFileSync("mkdir", ["-p", SHOTS]);
  await page.screenshot({ path: join(SHOTS, "editor-boot.png"), fullPage: false });
  process.stdout.write(`STEP screenshot=${join(SHOTS, "editor-boot.png")}\n`);
} catch (error) {
  process.stdout.write(`STEP screenshot FAILED ${String(error)}\n`);
}

// 닫기 절차를 그대로 태운다: close() 는 flush-before-close → ack → destroy 다.
// 종료 뒤 app.process() 를 만지면 playwright 내부 핸들이 이미 정리돼 던진다(실측) — 강제 종료만 남긴다.
await Promise.race([
  app.evaluate(({ app: electronApp }) => { electronApp.exit(0); }).catch(() => {}),
  new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000)),
]);
await Promise.race([
  app.close().catch(() => {}),
  new Promise((resolvePromise) => setTimeout(resolvePromise, 8_000)),
]);
try {
  if (app.process()?.exitCode === null) app.process()?.kill("SIGKILL");
} catch {
  /* 앱이 이미 끝났다 — playwright 핸들이 정리됐다 */
}

const info = JSON.parse(execFileSync("node", ["scripts/oprn-store.mjs", "info", projectDir], { cwd: REPO, encoding: "utf8" }));
process.stdout.write(`STEP revisionAfter=${info.revision} sha=${String(info.sha256).slice(0, 12)}\n`);
process.stdout.write(`STEP pageErrors=${JSON.stringify(pageErrors.slice(0, 6))}\n`);
process.stdout.write(`STEP console=${JSON.stringify(consoleLog.slice(0, 25))}\n`);
process.stdout.write(`STEP sqlite=${existsSync(join(projectDir, "project.sqlite"))}\n`);
process.stdout.write(`STEP sqliteBytes=${existsSync(join(projectDir, "project.sqlite")) ? readFileSync(join(projectDir, "project.sqlite")).length : 0}\n`);

const ok = booted
  && bodyMounted
  && menuSave.found === true
  && saveRequests === 1
  && report.statusKind === "ready"
  && report.statusProjectDir === projectDir
  && report.dbRequiredPanel === false
  && report.revision === revisionBefore;
process.stdout.write(`APP_BOOT_VERDICT=${ok ? "PASS" : "FAIL"}\n`);

rmSync(projectDir, { force: true, recursive: true });
