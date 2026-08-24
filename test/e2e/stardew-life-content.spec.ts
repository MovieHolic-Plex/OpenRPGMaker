import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { openDatabase, switchDatabaseTab, type DatabaseTabSpec } from "./oprn-database-helpers";

const PROJECT_ID = "rpg-zzu-stardew-demo";
const EVIDENCE_DIR = "output/evidence/stardew/database";
const CROPS_TAB: DatabaseTabSpec = { label: "농사·작물", slug: "crops", testId: "db-tab-crops" };
const CHARACTERS_TAB: DatabaseTabSpec = { label: "주민 관계", slug: "characters", testId: "db-tab-characters" };
const SPECIES_TAB: DatabaseTabSpec = { label: "몬스터 종족", slug: "monster-species", testId: "db-tab-monster-species" };

async function expectRemoteStardewProject(page: Page): Promise<void> {
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => {
    const text = await page.getByTestId("project-export-json").textContent();
    if (!text) return undefined;
    return (JSON.parse(text) as { project?: { meta?: { title?: string } } }).project?.meta?.title;
  }, { timeout: 30_000 }).toBe("별빛 농장 마을");
}

async function expectPanelInsideModal(page: Page, testId: string): Promise<void> {
  const metrics = await page.getByTestId(testId).evaluate((panel) => {
    const modal = panel.closest("[data-testid='database-modal']");
    if (!(modal instanceof HTMLElement) || !(panel instanceof HTMLElement)) throw new Error("database panel is detached");
    const panelBox = panel.getBoundingClientRect();
    const modalBox = modal.getBoundingClientRect();
    return {
      left: panelBox.left,
      right: panelBox.right,
      modalLeft: modalBox.left,
      modalRight: modalBox.right,
      horizontalOverflow: panel.scrollWidth - panel.clientWidth,
    };
  });
  expect(metrics.left).toBeGreaterThanOrEqual(metrics.modalLeft - 1);
  expect(metrics.right).toBeLessThanOrEqual(metrics.modalRight + 1);
  expect(metrics.horizontalOverflow).toBeLessThanOrEqual(1);
}

test("원격 Stardew 생활 DB가 완성 상태이며 1024/1440 화면에서 읽히고 이동 버튼이 동작한다", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/?project=${PROJECT_ID}`, { waitUntil: "domcontentloaded" });
  await expectRemoteStardewProject(page);
  await openDatabase(page);

  for (const viewport of [{ width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const size = `${viewport.width}x${viewport.height}`;

    await switchDatabaseTab(page, CROPS_TAB);
    const cropRecords = page.getByTestId("db-crop-readiness-records");
    await expect(cropRecords).toHaveAttribute("data-state", "ready");
    await expect(cropRecords).toHaveAttribute("data-total", "8");
    await expect(cropRecords).toHaveAttribute("data-invalid", "0");
    await expect(page.getByTestId("db-crop-readiness-time")).toHaveAttribute("data-state", "ready");
    await expect(page.getByTestId("db-crop-readiness-fields")).toHaveAttribute("data-state", "ready");
    await expect(page.getByTestId("db-crop-readiness-tools")).toHaveAttribute("data-state", "ready");
    await expectPanelInsideModal(page, "db-crop-readiness");
    await page.getByTestId("database-modal").screenshot({ path: `${EVIDENCE_DIR}/${size}-crops.png` });

    await switchDatabaseTab(page, CHARACTERS_TAB);
    await expect(page.getByTestId("db-character-readiness-gifts")).toHaveAttribute("data-state", "ready");
    await expect(page.getByTestId("db-character-readiness-calendar")).toHaveAttribute("data-state", "ready");
    await expect(page.getByTestId("db-character-readiness-profiles")).toHaveAttribute("data-profiles", "5");
    await expect(page.getByTestId("db-character-readiness-profiles")).toHaveAttribute("data-linked", "5");
    await expect(page.getByTestId("db-character-readiness-issues")).toHaveAttribute("data-orphans", "0");
    await expect(page.getByTestId("db-character-readiness-issues")).toHaveAttribute("data-unused", "0");
    await expectPanelInsideModal(page, "db-character-readiness");
    await page.getByTestId("database-modal").screenshot({ path: `${EVIDENCE_DIR}/${size}-characters.png` });

    await switchDatabaseTab(page, SPECIES_TAB);
    await expect(page.getByTestId("db-monster-pipeline-links")).toHaveAttribute("data-state", "ready");
    await expect(page.getByTestId("db-monster-pipeline-spawns")).toHaveAttribute("data-state", "ready");
    await expect(page.getByTestId("db-monster-pipeline-drops")).toHaveAttribute("data-state", "ready");
    const pipelineCounts = await page.getByTestId("db-monster-pipeline-spawns").evaluate((node) => ({
      maps: Number((node as HTMLElement).dataset.maps),
      spawns: Number((node as HTMLElement).dataset.spawns),
    }));
    expect(pipelineCounts.maps).toBeGreaterThanOrEqual(1);
    expect(pipelineCounts.spawns).toBeGreaterThanOrEqual(2);
    await expectPanelInsideModal(page, "db-monster-pipeline");
    await page.getByTestId("database-modal").screenshot({ path: `${EVIDENCE_DIR}/${size}-monsters.png` });
  }

  await switchDatabaseTab(page, CROPS_TAB);
  await page.getByTestId("db-crop-readiness-tools-action").click();
  await expect(page.getByTestId("db-tab-items")).toHaveClass(/active/);

  await switchDatabaseTab(page, CHARACTERS_TAB);
  await page.getByTestId("db-character-readiness-gifts-action").click();
  await expect(page.getByTestId("db-tab-system")).toHaveClass(/active/);

  await switchDatabaseTab(page, SPECIES_TAB);
  await page.getByTestId("db-monster-pipeline-links-action").click();
  await expect(page.getByTestId("db-tab-enemies")).toHaveClass(/active/);
});
