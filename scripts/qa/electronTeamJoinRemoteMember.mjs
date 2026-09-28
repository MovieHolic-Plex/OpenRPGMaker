// 두 컴퓨터 팀 참여 — 참여 쪽. 다른 컴퓨터의 팀 호스트에 시작 화면 「팀에 참여」로 들어가
// 참여 창에서 저장한다. 앱 번들(dist·dist-electron·package.json)과 electron·playwright 만 있으면 된다.
//
// 실행: xvfb-run -a node electronTeamJoinRemoteMember.mjs --app <앱 루트> --url http://<호스트>:9840 [--shots <폴더>]
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { hostname, networkInterfaces, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron } from "@playwright/test";

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const APP = resolve(arg("--app", process.cwd()));
const JOIN_URL = arg("--url");
const SHOTS = resolve(arg("--shots", join(APP, "shots")));
if (!JOIN_URL) throw new Error("--url 이 필요합니다");
mkdirSync(SHOTS, { recursive: true });
const steps = [];
const step = (name, ok, detail = "") => { steps.push({ name, ok, detail }); process.stdout.write("STEP " + (ok ? "PASS" : "FAIL") + " " + name + (detail ? " :: " + detail : "") + "\n"); };
const ips = Object.values(networkInterfaces()).flat().filter((a) => a && a.family === "IPv4" && !a.internal).map((a) => a.address);
process.stdout.write("MEMBER_MACHINE host=" + hostname() + " ips=" + JSON.stringify(ips) + "\n");

const scratch = mkdtempSync(join(tmpdir(), "oprn-team-remote-member-"));
const app = await electron.launch({
  args: [APP, "--disable-gpu", "--disable-dev-shm-usage", "--user-data-dir=" + join(scratch, "userdata")],
  cwd: APP,
  env: { ...process.env, XDG_CONFIG_HOME: join(scratch, "config"), OPRN_RENDERER_DIR: join(APP, "dist") },
  timeout: 60_000,
});
try {
  const start = await app.firstWindow({ timeout: 30_000 });
  await start.waitForSelector("[data-testid=start-join-team]", { timeout: 30_000 });
  await start.click("[data-testid=start-join-team]");
  await start.fill("[data-testid=start-join-input]", JOIN_URL);
  await start.screenshot({ path: join(SHOTS, "member-join-form.png") });
  const opened = app.waitForEvent("window", { timeout: 60_000 });
  await start.click("[data-testid=start-join-submit]");
  const team = await opened;
  const t0 = Date.now();
  const booted = await team.waitForFunction(() => {
    const main = document.querySelector("#app .main");
    const bar = document.querySelector("aside[aria-label='팀 연결 상태']");
    return Boolean(main && main.querySelector("canvas") && bar && bar.textContent && bar.textContent.includes("·"));
  }, null, { timeout: 300_000 }).then(() => true, () => false);
  const bar = await team.evaluate(() => document.querySelector("aside[aria-label='팀 연결 상태']")?.textContent ?? "").catch(() => "");
  step("remote host editor opens in a member app window", booted, team.url() + " bar=" + JSON.stringify(bar) + " loadMs=" + (Date.now() - t0));
  const side = await team.evaluate(async () => {
    const bridge = globalThis.oprn;
    const project = await bridge.project.status();
    const loaded = await bridge.project.loadFolded({ projectDir: project.projectDir });
    const doc = JSON.parse(loaded.folded ?? loaded.serialized);
    globalThis.__probeMeta = doc.meta;
    return { closeIsHostDriven: bridge.closeIsHostDriven, companionOrigin: bridge.companionOrigin, ipcOnly: typeof bridge.start?.joinTeam === "function",
      projectDir: project.projectDir, sha: loaded.sha256, revision: loaded.revision, title: doc.meta?.title };
  });
  step("member window uses the host's HTTP bridge", side.closeIsHostDriven === false && side.companionOrigin === null && side.ipcOnly === false,
    JSON.stringify({ revision: side.revision, title: side.title }));
  await team.waitForTimeout(2000);
  await team.screenshot({ path: join(SHOTS, "member-team-window.png") });
  const newTitle = "원격 참여 저장 " + hostname() + " " + Date.now();
  const saved = await team.evaluate(async ({ newTitle, projectDir, sha }) => {
    const result = await globalThis.oprn.project.saveMapPatch({ projectDir, baseSha: sha, patch: { set: { meta: { ...globalThis.__probeMeta, title: newTitle } } } });
    return { kind: result?.kind ?? null, revision: result?.revision ?? null };
  }, { newTitle, projectDir: side.projectDir, sha: side.sha });
  step("member save accepted by the remote host", saved.kind === "saved", JSON.stringify({ ...saved, newTitle }));
  const reread = await team.evaluate(async ({ projectDir }) => {
    const loaded = await globalThis.oprn.project.loadFolded({ projectDir });
    return { revision: loaded.revision, title: JSON.parse(loaded.folded ?? loaded.serialized).meta?.title };
  }, { projectDir: side.projectDir });
  step("member re-reads the saved title from the host", reread.title === newTitle, JSON.stringify(reread));
  await start.click("[data-testid=start-join-team]").catch(() => {});
  const recent = await start.waitForSelector("[data-testid=start-recent-team-0]", { timeout: 10_000 }).then((h) => h.textContent(), () => "");
  step("remote host listed under 최근 참여한 팀", recent.includes(new URL(JOIN_URL).host), recent);
  await start.screenshot({ path: join(SHOTS, "member-recent-teams.png") });
} catch (error) {
  step("member probe crashed", false, String(error?.stack ?? error).slice(0, 500));
} finally {
  await Promise.race([app.evaluate(({ app: a }) => a.exit(0)).catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
  try { if (app.process()?.exitCode === null) app.process()?.kill("SIGKILL"); } catch {}
  writeFileSync(join(SHOTS, "member-steps.json"), JSON.stringify(steps, null, 2));
  rmSync(scratch, { force: true, recursive: true, maxRetries: 5, retryDelay: 500 });
}
process.stdout.write("MEMBER_VERDICT=" + (steps.length > 0 && steps.every((s) => s.ok) ? "PASS" : "FAIL") + "\n");
