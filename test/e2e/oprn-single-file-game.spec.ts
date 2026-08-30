import { expect, test, type Page } from "@playwright/test";
import { mkdtemp, mkdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const EVIDENCE_DIR = "verify-shots/oprn-single-file-game";

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(EVIDENCE_DIR, name) });
}

async function seedEditorSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
    window.localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
}

async function countMapNodes(page: Page): Promise<number> {
  await page.getByTestId("map-tree").waitFor({ state: "visible", timeout: 30_000 });
  return page.locator("[data-testid^='map-tree-node-']").count();
}

test("a game travels between editor and player as one .oprn file", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const handoffDir = await mkdtemp(path.join(tmpdir(), "oprn-handoff-"));
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedEditorSession(page);

  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  const authoredMapCount = await countMapNodes(page);
  expect(authoredMapCount).toBeGreaterThan(1);
  await shot(page, "01-editor-authored-game.png");

  const downloadPromise = page.waitForEvent("download", { timeout: 120_000 });
  await page.getByTestId("menu-project").click();
  await page.getByTestId("menu-project-export").click();
  const download = await downloadPromise;
  const fileName = download.suggestedFilename();
  const savedPath = path.join(handoffDir, fileName);
  await download.saveAs(savedPath);
  await shot(page, "02-editor-exported.png");

  expect(fileName.endsWith(".oprn")).toBe(true);
  const savedBytes = await readFile(savedPath);
  expect((await stat(savedPath)).isFile()).toBe(true);
  expect(savedBytes.subarray(0, 2).toString("latin1")).toBe("PK");
  const exportedTitleStem = fileName.slice(0, -".oprn".length);

  await page.goto("/player.html?open=1", { waitUntil: "domcontentloaded" });
  const picker = page.getByTestId("oprn-game-file-picker");
  await expect(picker).toBeVisible({ timeout: 30_000 });
  await shot(page, "03-player-awaiting-game-file.png");

  await page.getByTestId("oprn-game-file-picker-input").setInputFiles(savedPath);
  await expect(page.getByTestId("title-screen")).toBeVisible({ timeout: 60_000 });
  await expect(picker).toHaveCount(0);
  await shot(page, "04-player-running-imported-game.png");

  const playedTitle = await page.title();
  expect(playedTitle.length).toBeGreaterThan(0);
  expect(playedTitle.replace(/\s+/g, "-")).toBe(exportedTitleStem);

  await seedEditorSession(page);
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  expect(await countMapNodes(page)).toBeLessThan(authoredMapCount);

  const chooserPromise = page.waitForEvent("filechooser", { timeout: 30_000 });
  await page.getByTestId("menu-project").click();
  await page.getByTestId("menu-project-import").click();
  (await chooserPromise).setFiles(savedPath);
  await expect
    .poll(() => countMapNodes(page), { timeout: 60_000 })
    .toBe(authoredMapCount);
  await shot(page, "05-editor-reimported.png");

  await rm(handoffDir, { recursive: true, force: true });
});
