/**
 * 에셋 스토어 실제 앱 e2e: 임시 스토어 서버(첫 진열 팩 4종) + 실제 Electron 편집기.
 *   둘러보기 → 상세 → 프로젝트에 넣기 → 저장 → 다시 켜서 그대로인지 → 기기 코드 로그인(브라우저에서 허락)
 *   → 편집기에서 참고문서 있는 타일셋 올리기 → 새 작가라 확인 대기 → 운영자 승인 → 목록에 보임.
 * 실행: npm run build:app && npm run build:electron && npm --prefix store-server run build
 *       xvfb-run -a npx playwright test -c playwright.electron.config.ts electronAssetStore
 * 화면 증거: verify-shots/asset-store/app-*.png. 위키: openwiki/asset-store.md.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron, chromium, expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { basicTilesetFor } from "../../src/assetStore/pack";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SHOTS = join(REPO, "verify-shots/asset-store");
const FIXTURE = "test/fixtures/life-full.reloaded.project.json";
const BEODEUL = "버들항 — 로마풍 항구 도시";

test.use({ actionTimeout: 30_000 });

let scratch: string;
let projectDir: string;
let server: ChildProcess;
let storeUrl: string;

async function freePort(): Promise<number> {
  return await new Promise((done) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => { const port = (probe.address() as { port: number }).port; probe.close(() => done(port)); });
  });
}

/** 직접 그린(처럼 보이는) 64×64 칩셋 한 장. 칸마다 색이 다르다. */
function chipsetDataUrl(): string {
  const png = new PNG({ width: 64, height: 64 });
  for (let y = 0; y < 64; y += 1) for (let x = 0; x < 64; x += 1) {
    const tile = Math.floor(y / 16) * 4 + Math.floor(x / 16);
    const i = (y * 64 + x) * 4;
    const edge = x % 16 === 0 || y % 16 === 0;
    png.data[i] = edge ? 40 : 60 + tile * 11;
    png.data[i + 1] = edge ? 60 : 140 - tile * 5;
    png.data[i + 2] = edge ? 30 : 70 + (tile % 4) * 20;
    png.data[i + 3] = 255;
  }
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
}

/** 픽스처 + 직접 올린 타일셋 하나(참고문서 포함) — 편집기에서 올리기 시험용. */
function projectJson(): string {
  const project = JSON.parse(readFileSync(join(REPO, FIXTURE), "utf8"));
  const image = chipsetDataUrl();
  project.assets.uploaded.my_forest_sheet = { id: "my_forest_sheet", name: "내 숲 칩셋", kind: "chipset", dataUrl: image, meta: { width: 64, height: 64, tileSize: 16 } };
  project.tilesets.my_forest = {
    ...basicTilesetFor("my_forest_sheet", "내 숲 칩셋", 64, 64, 16),
    id: "my_forest",
    referenceDocuments: [{
      id: "forest", name: "숲 깔기", description: "숲 가장자리와 길",
      documents: [{ id: "rules", name: "규칙", markdown: "# 숲 깔기\n가장자리 칸(0~3)은 풀 위에만 놓는다." }],
      images: [{ id: "ok", name: "정상", caption: "가장자리가 풀에 닿는다", dataUrl: image }],
    }],
  };
  return JSON.stringify(project);
}

async function launch(): Promise<{ app: ElectronApplication; page: Page; opened: () => Promise<string | null> }> {
  const app = await electron.launch({
    args: [join(REPO, "dist-electron/main.cjs"), "--disable-gpu", "--disable-dev-shm-usage"],
    cwd: REPO,
    env: {
      ...process.env,
      XDG_CONFIG_HOME: join(scratch, "config"),
      OPRN_RENDERER_DIR: join(REPO, "dist"),
      OPRN_OPEN_PROJECT_DIR: projectDir,
      OPRN_STORE_URL: storeUrl,
      OPRN_STORE_DATA_DIR: join(scratch, "store-cache"),
    },
    timeout: 90_000,
  });
  // 브라우저를 실제로 띄우지 않고 열려던 주소만 기록한다(테스트 브라우저가 대신 연다).
  await app.evaluate(({ shell }) => {
    const target = globalThis as unknown as { __opened: string | null };
    target.__opened = null;
    shell.openExternal = async (url: string) => { target.__opened = url; };
  });
  const page = await app.firstWindow({ timeout: 60_000 });
  await page.setViewportSize({ width: 1440, height: 900 }).catch(() => {});
  await page.waitForSelector("#app .topbar", { timeout: 90_000 });
  const opened = () => app.evaluate(() => (globalThis as unknown as { __opened: string | null }).__opened);
  return { app, page, opened };
}

async function shutdown(app: ElectronApplication): Promise<void> {
  await Promise.race([app.evaluate(({ app: electronApp }) => { electronApp.exit(0); }).catch(() => {}), new Promise((done) => setTimeout(done, 3_000))]);
  await Promise.race([app.close().catch(() => {}), new Promise((done) => setTimeout(done, 5_000))]);
  try { if (app.process()?.exitCode === null) app.process()?.kill("SIGKILL"); } catch { /* 이미 끝났다 */ }
}

async function openStore(page: Page, tab: "browse" | "installed" | "project" | "upload" = "browse"): Promise<void> {
  if (!(await page.locator('[data-testid="store"]').isVisible().catch(() => false))) {
    // 사이드바는 마지막에 연 칸을 기억한다 — 이미 열려 있으면 다시 누르면 닫힌다.
    const opener = page.locator('[data-testid="left-store-open"]');
    const toggle = page.locator('[data-testid="sidebar-store"]');
    await toggle.waitFor({ timeout: 90_000 }).catch(async (error) => { await page.screenshot({ path: join(scratch, "debug-open.png") }); throw error; });
    if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await opener.click();
    await expect(page.locator('[data-testid="store"]')).toBeVisible();
  }
  await page.locator(`[data-testid="store-tab-${tab}"]`).click();
}

const revision = (): number => Number(JSON.parse(execFileSync("node", ["scripts/oprn-store.mjs", "info", projectDir], { cwd: REPO, encoding: "utf8" })).revision);
const shot = (page: Page, name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`) });

test.beforeAll(async () => {
  test.setTimeout(240_000);
  mkdirSync(SHOTS, { recursive: true });
  scratch = mkdtempSync(join(tmpdir(), "oprn-store-e2e-"));
  projectDir = join(scratch, "project");
  writeFileSync(join(scratch, "project.json"), projectJson());
  execFileSync("node", ["scripts/oprn-store.mjs", "init", projectDir], { cwd: REPO });
  execFileSync("node", ["scripts/oprn-store.mjs", "import-json", projectDir, "--json", join(scratch, "project.json")], { cwd: REPO });
  const port = await freePort();
  storeUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [join(REPO, "store-server/dist/local.mjs"), "--port", String(port), "--host", "127.0.0.1", "--public-url", storeUrl, "--seed", "--pg-port", String(await freePort())], { cwd: REPO, stdio: ["ignore", "pipe", "inherit"] });
  await new Promise<void>((done, fail) => {
    const timer = setTimeout(() => fail(new Error("스토어 서버가 준비되지 않았습니다")), 200_000);
    server.stdout!.on("data", (chunk: Buffer) => { if (chunk.toString().includes("READY ")) { clearTimeout(timer); done(); } });
    server.on("exit", (code) => fail(new Error(`스토어 서버 종료 ${code}`)));
  });
});

test.afterAll(async () => {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((done) => { server.once("exit", done); setTimeout(done, 15_000); });
  }
  if (scratch && !process.env.KEEP_STORE_E2E) rmSync(scratch, { recursive: true, force: true });
});

test("browse, add to project, save, reload, log in, upload from the editor, admin approves", async () => {
  test.setTimeout(420_000);
  const catalog = await (await fetch(`${storeUrl}/api/v1/items?page=1`)).json() as { items: { slug: string; title: string; grade: string }[] };
  // The seeded catalog grows when an official pack is added. Assert the
  // contract (the required pack exists) rather than freezing the fixture count.
  expect(catalog.items.length).toBeGreaterThanOrEqual(4);
  const seededItemCount = catalog.items.length;
  const beodeul = catalog.items.find((item) => item.title === BEODEUL)!;
  expect(beodeul.grade).toBe("pack");

  // 1) 둘러보기 → 상세 → 프로젝트에 넣기
  const first = await launch();
  let page = first.page;
  await openStore(page, "browse");
  await expect(page.locator('[data-testid^="store-card-"]')).toHaveCount(seededItemCount);
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('[data-testid^="store-card-"] img')].every((img) => img.complete && img.naturalWidth > 0));
  await shot(page, "app-browse");
  await page.locator(`[data-testid="store-card-${beodeul.slug}"]`).click();
  await expect(page.locator('[data-testid="store-detail-title"]')).toHaveText(BEODEUL);
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('[data-testid="store-detail"] img')].every((img) => img.complete && img.naturalWidth > 0));
  await shot(page, "app-detail");
  const revisionBefore = revision();
  await page.locator('[data-testid="store-add"]').click();
  await expect(page.locator('[data-testid="store-detail"]')).toContainText("이 프로젝트에 판본 1이 들어 있습니다", { timeout: 120_000 });
  await shot(page, "app-added");

  await openStore(page, "installed");
  await expect(page.locator(`[data-testid="store-installed-${beodeul.slug}"]`)).toBeVisible();
  await shot(page, "app-installed");
  await openStore(page, "project");
  await expect(page.locator('[data-testid="store-credits"]')).toContainText(`「${BEODEUL}」`);
  await shot(page, "app-project-credits");

  // 2) 파일 → 저장 → 폴더(project.sqlite)에서 직접 확인
  await page.keyboard.press("Escape");
  const saved = await first.app.evaluate(({ Menu }) => {
    const save = Menu.getApplicationMenu()?.items.find((item) => item.label === "파일")?.submenu?.items.find((item) => item.id === "file-save");
    save?.click();
    return Boolean(save);
  });
  expect(saved).toBe(true);
  await expect.poll(revision, { timeout: 60_000 }).toBeGreaterThan(revisionBefore);
  execFileSync("node", ["scripts/oprn-store.mjs", "export-json", projectDir, "--out", join(scratch, "after.json")], { cwd: REPO });
  const after = JSON.parse(readFileSync(join(scratch, "after.json"), "utf8"));
  const storeTilesets = Object.keys(after.tilesets).filter((id) => id.startsWith("store_"));
  expect(storeTilesets).toHaveLength(1);
  const storeTileset = after.tilesets[storeTilesets[0]!];
  expect(storeTileset.referenceDocuments.length).toBeGreaterThan(0);
  const sheet = after.assets.uploaded[storeTileset.image.id];
  expect(sheet.origin).toMatchObject({ itemSlug: beodeul.slug, version: 1, license: "OPRN-GAME", aiGenerated: true });
  await shutdown(first.app);

  // 3) 다시 켜기 → 프로젝트 탭이 그대로, 기기 코드 로그인
  const second = await launch();
  page = second.page;
  await openStore(page, "project");
  await expect(page.locator('[data-testid="store-credits"]')).toContainText(`「${BEODEUL}」`);
  await openStore(page, "upload");
  await page.locator('[data-testid="store-upload-login"]').click();
  await expect(page.locator('[data-testid="store-login-code"]')).toBeVisible();
  const userCode = (await page.locator('[data-testid="store-login-code"]').textContent())!.trim();
  await shot(page, "app-login-code");
  await expect.poll(second.opened).not.toBeNull();
  const verifyUrl = (await second.opened())!;

  const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
  try {
    const creator = await browser.newPage({ viewport: { width: 1180, height: 820 } });
    await creator.goto(verifyUrl);
    await creator.locator('[data-testid="dev-email"]').fill("maker@example.com");
    await creator.locator('[data-testid="dev-name"]').fill("숲 작가");
    await creator.locator('[data-testid="dev-submit"]').click();
    await expect(creator.locator('[data-testid="device-code"]')).toHaveText(userCode);
    await creator.screenshot({ path: join(SHOTS, "web-device.png") });
    await creator.locator('[data-testid="device-approve"]').click();
    await expect(creator.locator('[data-testid="device-approved"]')).toBeVisible();

    await expect(page.locator('[data-testid="store-user"]')).toHaveText("숲 작가", { timeout: 30_000 });

    // 4) 편집기에서 올리기: 스토어에서 받은 타일셋은 막히고, 내 타일셋은 참고문서가 있어 「조수 사용 가능」
    const fromStore = page.locator(`[data-testid="store-upload-candidate-${storeTilesets[0]}"] input`);
    await expect(fromStore).toBeDisabled();
    await expect(page.locator('[data-testid="store-upload-blocked"] summary')).toContainText("올릴 수 없는 것");
    await page.locator('[data-testid="store-upload-candidate-my_forest"] input').check();
    await expect(page.locator('[data-testid="store-upload-grade"]')).toContainText("조수 사용 가능");
    await page.locator('[data-testid="store-upload-title"]').fill("숲 가장자리 시험 팩");
    await page.locator('[data-testid="store-upload-summary"]').fill("e2e 가 편집기에서 올린 팩");
    await page.locator('[data-testid="store-upload-tags"]').fill("숲, 시험");
    await page.locator('[data-testid="store-upload-credits"]').fill("그림: 숲 작가");
    await page.locator('[data-testid="store-upload-ai-yes"]').check();
    await page.locator('[data-testid="store-upload-agree"]').check();
    await shot(page, "app-upload-form");
    await page.locator('[data-testid="store-upload-submit"]').click();
    await expect(page.locator('[data-testid="store-upload-result"]')).toContainText("운영자가 확인한 뒤 목록에 보입니다", { timeout: 60_000 });
    await shot(page, "app-upload-done");
    const pending = await (await fetch(`${storeUrl}/api/v1/items?page=1`)).json() as { items: unknown[] };
    expect(pending.items).toHaveLength(seededItemCount);

    // 5) 운영자 승인 → 공개 목록에 보인다
    const adminContext = await browser.newContext({ viewport: { width: 1180, height: 820 } });
    const admin = await adminContext.newPage();
    await admin.goto(`${storeUrl}/login?next=/admin`);
    await admin.locator('[data-testid="dev-email"]').fill("admin@openrpgmaker.com");
    await admin.locator('[data-testid="dev-submit"]').click();
    await expect(admin.locator('[data-testid="admin-pending"]')).toContainText("숲 가장자리 시험 팩");
    await admin.screenshot({ path: join(SHOTS, "web-admin-queue.png") });
    await admin.locator('[data-testid^="admin-visible-"]').first().click();
    await expect(admin.locator('[data-testid="admin-pending"]')).not.toContainText("숲 가장자리 시험 팩");
    const published = await (await fetch(`${storeUrl}/api/v1/items?page=1`)).json() as { items: { title: string; grade: string; slug: string }[] };
    const mine = published.items.find((item) => item.title === "숲 가장자리 시험 팩");
    expect(mine?.grade).toBe("pack");
    await admin.goto(`${storeUrl}/items/${mine!.slug}`);
    await admin.screenshot({ path: join(SHOTS, "web-uploaded-item.png"), fullPage: true });
  } finally {
    await browser.close();
  }

  await page.locator('[data-testid="store-tab-browse"]').click();
  await expect(page.locator('[data-testid^="store-card-"]')).toHaveCount(seededItemCount + 1, { timeout: 20_000 });
  await page.locator('[data-testid="store-search"]').fill("숲 가장자리");
  await page.locator('[data-testid="store-search"]').press("Enter");
  await expect(page.locator('[data-testid^="store-card-"]')).toHaveCount(1, { timeout: 20_000 });
  await shot(page, "app-browse-uploaded");
  await shutdown(second.app);
});
