#!/usr/bin/env node
// 개념 꾸러미 스튜디오 실사 캡처 — 타일셋 그림판 + 장소 무대 + 그림 소유.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const BASE = process.env.QA_BASE_URL ?? "http://127.0.0.1:9867";
const OUT = process.env.SHOT_OUT ?? join(ROOT, "docs/proposals/assets/concept-studio");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
});
const context = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
await context.addInitScript(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.localStorage.setItem("oprn:editor-ui-mode", "expert");
});
const page = await context.newPage();

async function dismissWelcome() {
  for (const testid of ["welcome-skip", "welcome-blank", "editor-welcome-skip", "director-briefing-skip"]) {
    const node = page.getByTestId(testid);
    if (await node.isVisible().catch(() => false)) {
      await node.click();
      await page.waitForTimeout(400);
    }
  }
  const byText = page.getByRole("button", { name: /빈 맵으로 시작|건너뛰기|닫기/ });
  if (await byText.first().isVisible().catch(() => false)) {
    await byText.first().click();
    await page.waitForTimeout(400);
  }
}

async function openDatabase() {
  const modal = page.getByTestId("database-modal");
  if (await modal.isVisible().catch(() => false)) return;
  const toolbar = page.getByTestId("toolbar-database");
  if (await toolbar.isVisible().catch(() => false)) {
    await toolbar.click();
  } else {
    await page.getByTestId("menu-tools").click();
    await page.getByTestId("menu-tools-database").click();
  }
  await modal.waitFor({ state: "visible", timeout: 30_000 });
}

async function openScratchTab() {
  const group = page.getByTestId("db-tab-group-scratch");
  if (await group.isVisible().catch(() => false)) await group.click();
  await page.getByTestId("db-tab-scratch-concepts").click();
  await page.waitForSelector("[data-testid='scratch-concept-workspace']", { timeout: 20_000 });
}

try {
  await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForSelector('[data-testid="edit-canvas"]', { state: "visible", timeout: 60_000 });
  await page.waitForTimeout(2500);
  await dismissWelcome();
  await openDatabase();
  await openScratchTab();
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, "01-town-empty.png"), fullPage: false });

  const interior = page.getByTestId("scratch-concept-tileset-easyrpg_chipset_interior");
  await interior.click();
  await page.waitForSelector("[data-testid='scratch-concept-sheet']", { timeout: 10_000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, "02-interior-studio.png"), fullPage: false });

  await page.getByTestId("scratch-concept-thing-bed_h").click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, "03-thing-inspector.png"), fullPage: false });

  await page.getByTestId("scratch-concept-sheet-tile-222").click();
  await page.getByTestId("scratch-concept-sheet-tile-223").click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, "04-sheet-selected.png"), fullPage: false });

  await page.getByTestId("scratch-concept-thing-from-sheet").click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, "05-stamp-from-sheet.png"), fullPage: false });

  await page.getByTestId("scratch-concept-thing-bed_h").click();
  await page.getByTestId("scratch-concept-claim-art").click();
  await page.waitForSelector("[data-testid='structure-kit-editor']", { timeout: 10_000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, "06-claim-art.png"), fullPage: false });
  await page.getByTestId("structure-kit-editor-close").click();
  await page.waitForSelector("[data-testid='structure-kit-editor']", { state: "hidden", timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(400);

  await page.getByTestId("scratch-concept-tileset-easyrpg_chipset_combined_town").click();
  await page.waitForTimeout(400);
  const add = page.getByTestId("scratch-concept-empty-add");
  if (await add.isVisible().catch(() => false)) await add.click();
  await page.waitForTimeout(400);
  const addThing = page.locator("[data-testid^='scratch-concept-thing-add-']").first();
  if (await addThing.isVisible().catch(() => false)) await addThing.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, "07-town-house-picker.png"), fullPage: false });

  const workspace = page.getByTestId("scratch-concept-workspace");
  await workspace.screenshot({ path: join(OUT, "08-town-picker-closeup.png") });

  console.log(`shots -> ${OUT}`);
} finally {
  await browser.close();
}
