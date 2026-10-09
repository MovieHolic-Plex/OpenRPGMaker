// 앱끼리 팀 참여 증거: 앱 두 개를 띄워 한쪽이 호스트하고 다른 쪽이 시작 화면 「팀에 참여」로 들어온다.
//
// 확인하는 것
// 1. 호스트 앱: 파일 → 팀 협업 시작이 LAN 호스트를 띄우고 안내 주소를 준다.
// 2. 참여 앱: 시작 화면에서 주소를 넣으면 호스트 편집기가 앱 창으로 뜬다(브라우저가 아니다).
// 3. 참여 창의 저장이 호스트 컴퓨터의 project.sqlite 로 가고, 호스트 앱이 그 변경을 본다.
// 4. 틀린 주소는 창을 닫고 시작 화면에 이유를 보여 준다. 참여한 주소가 최근 목록에 남는다.
//
// 실행: xvfb-run -a node scripts/qa/electronTeamJoinProbe.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "@playwright/test";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = "test/fixtures/life-full.reloaded.project.json";
const SHOTS = join(REPO, "verify-shots/electron-team-join");
mkdirSync(SHOTS, { recursive: true });
const steps = [];
const step = (name, ok, detail = "") => { steps.push({ name, ok, detail }); process.stdout.write("STEP " + (ok ? "PASS" : "FAIL") + " " + name + (detail ? " :: " + detail : "") + "\n"); };

const scratch = mkdtempSync(join(tmpdir(), "oprn-team-join-"));
const projectDir = join(scratch, "host-project");
execFileSync("node", ["scripts/oprn-store.mjs", "init", projectDir], { cwd: REPO });
execFileSync("node", ["scripts/oprn-store.mjs", "import-json", projectDir, "--json", FIXTURE], { cwd: REPO });
const info = () => JSON.parse(execFileSync("node", ["scripts/oprn-store.mjs", "info", projectDir], { cwd: REPO, encoding: "utf8" }));
const before = info();

const launch = (name, extraEnv) => electron.launch({
  // 앱 루트(package.json main)로 띄운다 — npm run electron:start·패키지 앱과 같은 app.getAppPath().
  // main.cjs 를 직접 주면 getAppPath 가 dist-electron/ 이 되어 브리지 파일 경로가 틀어진다.
  args: [REPO, "--disable-gpu", "--disable-dev-shm-usage", "--user-data-dir=" + join(scratch, name + "-userdata")],
  cwd: REPO,
  env: { ...process.env, XDG_CONFIG_HOME: join(scratch, name + "-config"), OPRN_RENDERER_DIR: join(REPO, "dist"), ...extraEnv },
  timeout: 60_000,
});

const hostApp = await launch("host", { OPRN_OPEN_PROJECT_DIR: projectDir });
const hostLog = [];
hostApp.process().stdout?.on("data", (d) => hostLog.push(String(d)));
hostApp.process().stderr?.on("data", (d) => hostLog.push(String(d)));
hostApp.process().on("exit", (code, signal) => hostLog.push("HOST EXIT code=" + code + " signal=" + signal));
const memberApp = await launch("member", {});
try {
  const hostPage = await hostApp.firstWindow({ timeout: 30_000 });
  const hostBooted = await hostPage.waitForSelector("#app .topbar", { timeout: 90_000 }).then(() => true, () => false);
  step("host app opens the project folder in the editor", hostBooted, hostPage.url());

  // 파일 → 팀 협업 시작. 안내 대화상자는 xvfb 에서 누를 사람이 없으므로 내용을 받아 적고 「확인」으로 닫는다.
  const hosted = await hostApp.evaluate(async ({ BrowserWindow, Menu, dialog }) => {
    const captured = [];
    dialog.showMessageBox = async (_window, options) => { captured.push(options); return { response: 0, checkboxChecked: false }; };
    BrowserWindow.getAllWindows()[0].focus();
    const file = Menu.getApplicationMenu().items.find((item) => item.label === "파일");
    file.submenu.items.find((item) => item.label === "팀 협업 시작 / 관리").click();
    for (let i = 0; i < 100 && captured.length === 0; i++) await new Promise((r) => setTimeout(r, 100));
    const menu = file.submenu.items.map((item) => item.label).filter(Boolean);
    return { captured: captured.map((o) => ({ type: o.type ?? "info", message: o.message, detail: o.detail, buttons: o.buttons })), menu };
  });
  const hostDialog = hosted.captured[0] ?? {};
  const urls = String(hostDialog.detail ?? "").match(/http:\/\/[\d.]+:\d+/g) ?? [];
  step("host starts the team host and lists join addresses", hostDialog.message === "팀 호스트가 실행 중입니다." && urls.length > 0, JSON.stringify(urls));
  step("file menu has 「팀에 참여…」", hosted.menu.includes("팀에 참여…"), hosted.menu.join(" | "));
  writeFileSync(join(SHOTS, "host-dialog.json"), JSON.stringify(hostDialog, null, 2));
  const joinUrl = urls[0];

  // 참여 앱: 시작 화면.
  const startPage = await memberApp.firstWindow({ timeout: 30_000 });
  await startPage.waitForSelector("[data-testid=start-join-team]", { timeout: 30_000 });
  await startPage.click("[data-testid=start-join-team]");
  await startPage.waitForSelector("[data-testid=start-join-input]");

  // 틀린 주소 먼저: 아무도 듣지 않는 포트.
  await startPage.fill("[data-testid=start-join-input]", joinUrl.replace(/:\d+$/, ":9") );
  await startPage.click("[data-testid=start-join-submit]");
  const errorText = await startPage.waitForFunction(() => {
    const box = document.querySelector("[data-testid=start-error]");
    return box && !box.hidden && box.textContent ? box.textContent : false;
  }, null, { timeout: 30_000 }).then((h) => h.jsonValue(), () => "");
  const windowsAfterFail = await memberApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
  step("wrong address shows a reason and leaves no stray window", Boolean(errorText) && windowsAfterFail === 1, String(errorText));
  await startPage.screenshot({ path: join(SHOTS, "member-join-error.png") });

  await startPage.fill("[data-testid=start-join-input]", joinUrl);
  await startPage.screenshot({ path: join(SHOTS, "member-join-form.png") });
  const teamWindowPromise = memberApp.waitForEvent("window", { timeout: 60_000 });
  await startPage.click("[data-testid=start-join-submit]");
  const teamPage = await teamWindowPromise;
  const teamConsole = [];
  const teamFailed = [];
  teamPage.on("console", (m) => teamConsole.push((m.type() + ": " + m.text()).slice(0, 240)));
  teamPage.on("pageerror", (e) => teamConsole.push("pageerror: " + String(e.message).slice(0, 240)));
  teamPage.on("requestfailed", (q) => teamFailed.push(q.method() + " " + q.url() + " " + (q.failure()?.errorText ?? "")));
  teamPage.on("framenavigated", (f) => { if (f === teamPage.mainFrame()) teamConsole.push("navigated: " + f.url()); });
  // 톱바는 로딩 화면에도 먼저 생긴다. 편집기 본문(맵 캔버스)과 팀 상태 막대가 뜰 때까지 기다린다.
  const loadStarted = Date.now();
  const teamBooted = await teamPage.waitForFunction(() => {
    const main = document.querySelector("#app .main");
    const bar = document.querySelector("aside[aria-label='팀 연결 상태']");
    return Boolean(main && main.querySelector("canvas") && bar && bar.textContent && bar.textContent.includes("·"));
  }, null, { timeout: 240_000 }).then(() => true, () => false);
  const teamBar = await teamPage.evaluate(() => document.querySelector("aside[aria-label='팀 연결 상태']")?.textContent ?? "").catch(() => "");
  step("member app shows the host editor (map canvas + team bar) in an app window", teamBooted,
    teamPage.url() + " bar=" + JSON.stringify(teamBar) + " loadMs=" + (Date.now() - loadStarted));
  // 편집기와 같은 경로로 읽는다: 접힌 행(loadFolded). 전체 글(project.load)은 편집기가 쓰지 않는다.
  // 부팅 뒤 두 창의 자동 저장(정규화·공용 참고문서 보강)이 끝나 revision 이 멈출 때까지 기다린다. 그 전에 읽으면
  // 아래 저장이 그 사이 끼어든 자동 저장 때문에 stale-base 가 된다(편집기는 그때 다시 읽어 재시도한다).
  await teamPage.evaluate(async () => {
    let last = -1, stableSince = Date.now();
    for (const deadline = Date.now() + 90_000; Date.now() < deadline;) {
      const { revision } = await globalThis.oprn.team.status();
      if (revision !== last) { last = revision; stableSince = Date.now(); }
      else if (Date.now() - stableSince >= 8_000) return;
      await new Promise((r) => setTimeout(r, 1000));
    }
  });
  const memberSide = await teamPage.evaluate(async () => {
    const bridge = globalThis.oprn;
    const status = await bridge.team.status();
    const project = await bridge.project.status();
    const loaded = await bridge.project.loadFolded({ projectDir: project.projectDir });
    const doc = JSON.parse(loaded.folded ?? loaded.serialized);
    globalThis.__probeMeta = doc.meta;
    return {
      url: location.href,
      closeIsHostDriven: bridge.closeIsHostDriven,
      companionOrigin: bridge.companionOrigin,
      hasIpcOnlyApi: typeof bridge.start?.joinTeam === "function" || typeof bridge.assetBrowser?.open === "function",
      member: status.member,
      projectDir: project.projectDir,
      sha: loaded.sha256,
      revision: loaded.revision,
      title: doc.meta?.title,
    };
  });
  step("member window talks to the host over HTTP, without the local IPC bridge",
    memberSide.closeIsHostDriven === false && memberSide.companionOrigin === null && memberSide.hasIpcOnlyApi === false,
    JSON.stringify({ url: memberSide.url, closeIsHostDriven: memberSide.closeIsHostDriven, member: memberSide.member?.label, role: memberSide.member?.role }));
  const windowTitles = await memberApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((w) => ({ title: w.getTitle(), url: w.webContents.getURL() })));
  step("the member window is an Electron window of the member app", windowTitles.some((w) => w.url.startsWith(joinUrl)), JSON.stringify(windowTitles));
  await teamPage.waitForTimeout(2000);
  await teamPage.screenshot({ path: join(SHOTS, "member-team-window.png") });

  // 참여 창에서 저장한다. 제목 하나만 바꾼 전체 저장(프로젝트 CAS 는 방금 읽은 sha 기준).
  const newTitle = "팀 참여 저장 " + Date.now();
  // 편집기 자동 저장과 같은 채널(saveMapPatch)로 meta 만 바꾼 변경분을 보낸다.
  const saved = await teamPage.evaluate(async ({ newTitle, projectDir, sha }) => {
    const meta = { ...globalThis.__probeMeta, title: newTitle };
    const result = await globalThis.oprn.project.saveMapPatch({ projectDir, baseSha: sha, patch: { set: { meta } } });
    return { kind: result?.kind ?? null, revision: result?.revision ?? null };
  }, { newTitle, projectDir: memberSide.projectDir, sha: memberSide.sha });
  const after = info();
  step("member save lands in the host's project.sqlite", after.revision > before.revision && after.title === newTitle,
    JSON.stringify({ result: saved, revisionBefore: before.revision, revisionAfter: after.revision, titleAfter: after.title }));

  // 호스트 앱은 IPC 로 같은 정본을 읽는다.
  const hostSees = await hostPage.evaluate(async () => {
    const project = await globalThis.oprn.project.status();
    const loaded = await globalThis.oprn.project.loadFolded({ projectDir: project.projectDir });
    return { revision: loaded?.revision, title: JSON.parse(loaded.folded ?? loaded.serialized).meta?.title };
  });
  step("host app reads the member's change", hostSees.title === newTitle, JSON.stringify(hostSees));
  await hostPage.waitForTimeout(4000);
  await hostPage.screenshot({ path: join(SHOTS, "host-editor.png") });

  // 최근 참여 목록.
  await startPage.click("[data-testid=start-join-team]").catch(() => {});
  const recent = await startPage.waitForSelector("[data-testid=start-recent-team-0]", { timeout: 10_000 }).then((h) => h.textContent(), () => "");
  step("joined host appears under 최근 참여한 팀", recent.includes(new URL(joinUrl).host), recent);
  await startPage.screenshot({ path: join(SHOTS, "member-recent-teams.png") });
} catch (error) {
  step("probe crashed", false, String(error?.stack ?? error).slice(0, 600));
} finally {
  const crash = hostLog.filter((l) => /OOM|HOST EXIT code=(?!0)/.test(l));
  if (crash.length) step("host app stayed alive", false, crash.join(" ").slice(0, 300));
  for (const app of [memberApp, hostApp]) {
    await Promise.race([app.evaluate(({ app: a }) => a.exit(0)).catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
    try { if (app.process()?.exitCode === null) app.process()?.kill("SIGKILL"); } catch {}
  }
  writeFileSync(join(SHOTS, "steps.json"), JSON.stringify(steps, null, 2));
  rmSync(scratch, { force: true, recursive: true, maxRetries: 5, retryDelay: 500 });
}
process.stdout.write("TEAM_JOIN_VERDICT=" + (steps.length > 0 && steps.every((s) => s.ok) ? "PASS" : "FAIL") + "\n");
