import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MAIN_BUNDLE = join(REPO_ROOT, "dist-electron/main.cjs");
const RENDERER_DIST = join(REPO_ROOT, "dist");
const SMOKE_PAGE = join(REPO_ROOT, "test/fixtures/electronBridgeProbe.html");
const FIXTURE_PROJECT = "test/fixtures/life-full.reloaded.project.json";

type BridgeProbe = {
  readonly projectId: string;
  readonly sha256Before: string;
  readonly revisionBefore: number;
  readonly savedKind: string;
  readonly revisionAfter: number;
  readonly commits: number;
  readonly syncCommits: number;
  readonly assetUrlProjectId: string;
};

let projectDir: string;

test.beforeAll(() => {
  projectDir = mkdtempSync(join(tmpdir(), "oprn-electron-"));
  execFileSync("node", ["scripts/oprn-store.mjs", "init", projectDir], { cwd: REPO_ROOT });
  execFileSync("node", ["scripts/oprn-store.mjs", "import-json", projectDir, "--json", FIXTURE_PROJECT], { cwd: REPO_ROOT });
});

test.afterAll(() => {
  rmSync(projectDir, { force: true, recursive: true });
});

async function launch(smokePage: string | null = SMOKE_PAGE): Promise<{ app: ElectronApplication; page: Page }> {
  const env: Record<string, string> = { ...(process.env as Record<string, string>), OPRN_RENDERER_DIR: RENDERER_DIST };
  if (smokePage) env.OPRN_SMOKE_PAGE = smokePage;
  else delete env.OPRN_SMOKE_PAGE;
  const app = await electron.launch({
    args: [MAIN_BUNDLE, "--disable-gpu", "--disable-dev-shm-usage"],
    cwd: REPO_ROOT,
    env,
  });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  return { app, page };
}

/** 헤드리스 xvfb 에서 Electron 38 의 정상 종료가 실패한다(FATAL: Failed to shutdown) — 유예 뒤 강제한다. 프로세스 핸들은 close **전에** 잡아야 한다: close 뒤에는 Playwright 의 연결이 끊겨 app.process() 가 던진다(2026-09-16 실측). */
async function shutdown(app: ElectronApplication): Promise<void> {
  const process_ = app.process();
  await Promise.race([
    app.evaluate(({ app: electronApp }) => { electronApp.exit(0); }).catch(() => {}),
    new Promise((resolvePromise) => setTimeout(resolvePromise, 3_000)),
  ]);
  await Promise.race([
    app.close().catch(() => {}),
    new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000)),
  ]);
  if (process_.exitCode === null) process_.kill("SIGKILL");
}

async function probeThroughBridge(page: Page, projectDir: string): Promise<BridgeProbe> {
  return await page.evaluate(async (dir: string): Promise<BridgeProbe> => {
    const bridge = (window as unknown as { oprn: Record<string, any> }).oprn;
    const opened = await bridge.project.open({ projectDir: dir });
    const loaded = await bridge.project.load();
    const saved = await bridge.project.save({
      projectDir: dir,
      serialized: loaded.serialized,
      expectedSha: loaded.sha256,
    });
    const after = await bridge.project.load();
    const commits = await bridge.commits.list({ projectDir: dir, limit: 5 });
    const syncCommits = bridge.commits.listSync({ projectDir: dir, limit: 5 });
    return {
      projectId: String(opened.projectId),
      sha256Before: String(loaded.sha256),
      revisionBefore: Number(loaded.revision),
      savedKind: String(saved.kind),
      revisionAfter: Number(after.revision),
      commits: Array.isArray(commits) ? commits.length : -1,
      syncCommits: Array.isArray(syncCommits) ? syncCommits.length : -1,
      assetUrlProjectId: String(opened.projectId),
    };
  }, projectDir);
}

test("bridge opens a real folder, saves through the store, and reloads after restart", async () => {
  const first = await launch();
  const before = await probeThroughBridge(first.page, projectDir);
  await shutdown(first.app);

  expect(before.projectId).toMatch(/^[0-9a-f-]{36}$/);
  expect(before.savedKind).toBe("saved");
  expect(before.revisionAfter).toBeGreaterThan(before.revisionBefore);
  expect(before.syncCommits).toBe(before.commits);

  const second = await launch();
  const after = await second.page.evaluate(async (dir: string) => {
    const bridge = (window as unknown as { oprn: Record<string, any> }).oprn;
    await bridge.project.open({ projectDir: dir });
    const loaded = await bridge.project.load();
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const stored = await bridge.assets.put({ projectDir: dir, mime: "image/png", extension: "png", bytes, kind: "sprite" });
    const listed = await bridge.assets.list({ projectDir: dir });
    const readBack = await bridge.assets.read({ projectDir: dir, sha256: stored.ref.sha256 });
    const backup = await bridge.project.backup({ projectDir: dir });
    return {
      sha256: String(loaded.sha256),
      revision: Number(loaded.revision),
      assetSha: String(stored.ref.sha256),
      assetCount: Array.isArray(listed) ? listed.length : -1,
      readBytes: Array.from(new Uint8Array(readBack)),
      backupPath: String(backup),
      dataVersion: Number(await bridge.project.dataVersion({ projectDir: dir })),
    };
  }, projectDir);
  await shutdown(second.app);

  expect(after.revision).toBe(before.revisionAfter);
  expect(after.sha256).toBe(before.sha256Before);
  expect(after.assetCount).toBe(1);
  expect(after.readBytes).toEqual([137, 80, 78, 71]);
  expect(after.backupPath).toContain("backups");
  expect(after.dataVersion).toBeGreaterThan(0);
});

test("시작 화면이 연 폴더로 편집기가 부팅한다 (P4.3 시작 화면 → 편집기 인계)", async () => {
  if (!existsSync(join(RENDERER_DIST, "index.html"))) {
    throw new Error(`렌더러 번들이 없습니다: ${RENDERER_DIST} — \`npm run build:fast\` 를 먼저 돌리세요.`);
  }

  const { app, page } = await launch(null);
  const cspViolations: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Content Security Policy")) cspViolations.push(message.text());
  });

  expect(page.url()).toContain("start-screen.html");
  // 인라인 스크립트가 차단되면 스크립트가 아예 안 돌아 최근 목록이 빈 문자열로 남는다(2026-09-16 실측).
  await expect(page.locator("#recent-list")).not.toBeEmpty();
  expect(cspViolations).toEqual([]);

  const opened = await page.evaluate(async (dir: string) => {
    const bridge = (window as unknown as { oprn: Record<string, any> }).oprn;
    return await bridge.start.openRecent({ projectDir: dir });
  }, projectDir);
  expect(opened).toMatchObject({ projectDir, projectId: expect.stringMatching(/^[0-9a-f-]{36}$/) });

  await page.evaluate(() => { window.location.href = "/index.html"; });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("db-required-panel")).toHaveCount(0);
  expect(page.url()).toContain("app://oprn/index.html");

  await shutdown(app);
});
