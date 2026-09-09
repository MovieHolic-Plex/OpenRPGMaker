import { expect, test, type Page } from "@playwright/test";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import type { Project } from "../../src/project/types";
import { startPlayerQaServer } from "../../scripts/lib/runtimeQaRun.mjs";

/* Task 18: the life ledger and save/resume on the REAL player surface.
 *
 * Why this harness and not scripts/qa/runtime: that runner drives input through
 * input.ts injectActionEdge(), which pushes an edge into the PHASER key manager. The
 * status menu is DOM and listens for window keydown, so injected edges move the world
 * (tilling, harvesting) but never reach the menu — measured across seven attempts at
 * the collapsed rail. Playwright presses real keys, which the DOM receives, exactly as
 * test/runtime/status-menu-adversarial.spec.ts already proves. */

const OUT = "verify-shots/runtime-qa/life-full-menu";
const NAMESPACE = "runtime-life-full-menu";
let server: Awaited<ReturnType<typeof startPlayerQaServer>>;
let project: Project;

type QaWindow = Window & {
  __OPENRPG_BOOT__?: { projectUrl: string; saveNamespace: string; qaInstrumentation: boolean };
  __oprnDebug?: { readState: () => { currentMapId?: string; inventory?: Record<string, number> } };
};

test.beforeAll(async () => {
  server = await startPlayerQaServer();
  project = JSON.parse(readFileSync("test/fixtures/life-full.project.json", "utf8")) as Project;
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/SUMMARY.md`, "# Life ledger + save/resume on the real player surface\n");
});

test.afterAll(async () => { await server?.close(); });

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function boot(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.addInitScript((namespace) => {
    (window as QaWindow).__OPENRPG_BOOT__ = { projectUrl: "/__life-qa/project.json", saveNamespace: namespace, qaInstrumentation: true };
  }, NAMESPACE);
  await page.route("**/__life-qa/project.json", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
  await page.goto(`${server.url}/player.html?e2eVitals=1`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("title-screen")).toBeVisible({ timeout: 45_000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Boolean((window as QaWindow).__oprnDebug?.readState().currentMapId), null, { timeout: 120_000 });
  await expect(page.getByTestId("play-loading-overlay")).toHaveCount(0, { timeout: 120_000 });
  return errors;
}

// Real keys, mirroring status-menu-adversarial.spec.ts: x closes a detail, ArrowDown
// walks the rail, z confirms.
async function rail(page: Page, id: string) {
  for (let i = 0; i < 8 && await page.locator("[data-testid='main-menu'].status-menu-detail-focus").count(); i++) {
    await page.keyboard.press("x");
  }
  for (let i = 0; i < 8; i++) {
    if (await page.locator(`[data-testid='status-menu-command-${id}'].selected`).count()) break;
    await page.keyboard.press("ArrowDown");
  }
  await expect(page.getByTestId(`status-menu-command-${id}`)).toHaveClass(/selected/);
  await page.keyboard.press("z");
}

async function choose(page: Page, id: string) {
  for (let i = 0; i < 24; i++) {
    if (await page.locator(`[data-testid='${id}'].selected`).count()) break;
    await page.keyboard.press("ArrowDown");
  }
  await expect(page.getByTestId(id)).toHaveClass(/selected/);
  await page.keyboard.press("z");
}

test("생활 원장을 실제 메뉴로 열고 저장 슬롯까지 도달한다", async ({ page }) => {
  const errors = await boot(page);

  await page.keyboard.press("x");
  await expect(page.getByTestId("main-menu")).toBeVisible();
  await shot(page, "01-main-menu");

  // 기록 그룹 -> 생활 원장. 주입 엣지로는 7회 열리지 않았던 지점이다.
  await rail(page, "record-menu");
  await shot(page, "02-record-group-open");
  await expect(page.getByTestId("status-menu-group-command-life-ledger")).toBeVisible({ timeout: 20_000 });

  await choose(page, "status-menu-group-command-life-ledger");
  await expect(page.getByTestId("life-ledger-tab-shipping")).toBeVisible({ timeout: 20_000 });
  await shot(page, "03-life-ledger-shipping");

  // 시스템 그룹 -> 저장. 로드도 같은 그룹에 있다.
  await page.keyboard.press("x");
  await rail(page, "system-menu");
  await shot(page, "04-system-group-open");
  await expect(page.getByTestId("status-menu-group-command-save")).toBeVisible({ timeout: 20_000 });

  await choose(page, "status-menu-group-command-save");
  await expect(page.getByTestId("save-slot-1")).toBeVisible({ timeout: 20_000 });
  await shot(page, "05-save-slots");

  expect(errors, "player console/page errors").toEqual([]);
  await appendFile(`${OUT}/SUMMARY.md`, "\n- 생활 원장 + 저장 슬롯 도달: 실제 키 입력\n");
});
