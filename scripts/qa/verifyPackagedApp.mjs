// 패키징된 앱(release/linux-unpacked/oprn)이 실제로 뜨는지 확인하고 스크린샷을 남긴다.
// 개발 실행(playwright 가 dist-electron/main.cjs 를 직접 띄우는 스모크)과 다른 경로다 —
// asar 안에서 렌더러를 찾고, preload 를 읽고, app:// 프로토콜을 등록하는지가 여기서만 드러난다.
import { _electron as electron } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const EXECUTABLE = resolve(REPO_ROOT, "release/linux-unpacked/oprn");
const OUT_DIR = resolve(REPO_ROOT, "verify-shots/electron-package");
mkdirSync(OUT_DIR, { recursive: true });

const projectDir = mkdtempSync(join(tmpdir(), "oprn-packaged-"));
// 빈 폴더는 프로젝트가 아니다 — 스토어를 초기화해야 앱이 연다(스모크와 같은 절차).
execFileSync("node", ["scripts/oprn-store.mjs", "init", projectDir], { cwd: REPO_ROOT });
const app = await electron.launch({
  executablePath: EXECUTABLE,
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  env: { ...process.env, OPRN_PACKAGED_PROBE_PROJECT: projectDir },
});

const page = await app.firstWindow();
// 부팅 첫 줄부터 보려면 페이지가 만들어지자마자 붙어야 한다 — 늦게 붙이면 채택 로그를 놓친다.
const consoleLines = [];
page.on("console", (message) => consoleLines.push(`${message.type()}: ${message.text()}`));
page.on("pageerror", (error) => consoleLines.push(`pageerror: ${error.message}`));
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(3000);

const probe = await page.evaluate(() => ({
  url: window.location.href,
  title: document.title,
  hasRecentList: Boolean(document.querySelector("#recent-list")),
  hasBridge: Boolean(window.oprn),
  bodyText: (document.body?.innerText ?? "").slice(0, 400),
}));

await page.screenshot({ path: join(OUT_DIR, "01-packaged-start-screen.png"), fullPage: false });

// 시작 화면에서 실제 폴더를 열어 편집기까지 간다 — 번들이 asar 안에 있고, 로컬 정본을 여는
// 경로(IPC + SQLite)가 패키징된 앱에서도 사는지의 증거다. 폴더는 템플릿으로 새로 만든다.
const opened = await page.evaluate(async (dir) => {
  const bridge = window.oprn;
  return await bridge.start.openRecent({ projectDir: dir });
}, projectDir);

await page.evaluate(() => {
  window.location.href = "/index.html";
});
// 캔버스를 기다린다 — 폴백 패널(db-required-panel)이 먼저 잠깐 뜰 수 있으므로 그것만 보고
// 끝내면 편집기 도달 여부를 못 본다. 못 뜨면 타임아웃을 삼키고 상태를 그대로 보고한다.
let canvasAppeared = true;
try {
  await page.waitForSelector('[data-testid="edit-canvas"]', { timeout: 60_000, state: "visible" });
} catch {
  canvasAppeared = false;
}
await page.waitForTimeout(1500);
const editor = await page.evaluate(() => ({
  url: window.location.href,
  canvas: Boolean(document.querySelector('[data-testid="edit-canvas"]')),
  dbPanel: Boolean(document.querySelector('[data-testid="db-required-panel"]')),
  bodyText: (document.body?.innerText ?? "").slice(0, 300),
}));
await page.screenshot({ path: join(OUT_DIR, "02-packaged-editor.png"), fullPage: false });

// 새 폴더는 첫 flush(자동저장 디바운스)가 문서를 심는다 — 캔버스가 떴어도 디스크 기록이
// 아직일 수 있으므로 일정 시간 폴링해 영속화를 증명한다.
const bridgeStatus = await page.evaluate(async () => {
  try {
    const status = await window.oprn.project.status();
    const deadline = Date.now() + 30_000;
    let loaded = null;
    while (Date.now() < deadline) {
      loaded = await window.oprn.project.load({ projectDir: status.projectDir });
      if (loaded?.serialized) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return { status, loadOk: Boolean(loaded?.serialized), sha256: loaded?.sha256?.slice(0, 12) };
  } catch (error) {
    return { threw: String(error) };
  }
});

console.log(JSON.stringify({ probe, opened, bridgeStatus, canvasAppeared, editor, consoleLines: consoleLines.slice(0, 25) }, null, 2));
await app.close();
process.exit(0);
