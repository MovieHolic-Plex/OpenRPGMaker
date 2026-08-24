import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const EVIDENCE_DIR = "evidence/browser-screenshots/play-audio-editor";

test.setTimeout(90_000);

test("editor BGM/SE list + preview has screenshot evidence", async ({ page }, testInfo) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });

  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  // Expert mode is pinned by the addInitScript above — toolbar-sound-test is expert chrome.
  await expect(page.getByTestId("toolbar-sound-test")).toBeVisible({ timeout: 20_000 });

  await page.getByTestId("toolbar-sound-test").click();
  const audioDialog = page.getByTestId("audio-test-dialog");
  await expect(audioDialog).toBeVisible();
  await page.getByTestId("audio-test-option-1").click();
  await page.getByTestId("audio-test-play").click();
  await expect(page.getByTestId("audio-test-status")).toContainText("재생 중");
  const audioShot = join(EVIDENCE_DIR, "01-audio-test-dialog-playable-bgm.png");
  await page.screenshot({ path: audioShot, fullPage: true });
  await testInfo.attach("audio-test-dialog", { path: audioShot, contentType: "image/png" });

  await page.getByTestId("audio-test-tab-sound").click();
  await page.getByTestId("audio-test-option-1").click();
  await page.getByTestId("audio-test-play").click();
  await expect(page.getByTestId("audio-test-status")).toContainText("재생 중");
  const seShot = join(EVIDENCE_DIR, "02-audio-test-dialog-se.png");
  await page.screenshot({ path: seShot, fullPage: true });
  await testInfo.attach("audio-test-se", { path: seShot, contentType: "image/png" });
  await page.getByTestId("audio-test-close").click();

  await page.getByTestId("layer-event").click();
  const visibleEventTool = page.locator('[data-testid="tool-event"]:visible').first();
  if ((await visibleEventTool.count()) > 0) await visibleEventTool.click();
  await page.locator(".event-list-row").first().click();
  await page.getByTestId("event-editor-open").click();
  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible({ timeout: 20_000 });

  // The event editor opens in Storyboard view by default, which hides the command list.
  await editor.getByTestId("event-view-toggle-list").click();
  // Open the command palette from the empty command line and choose the explicit BGM intent.
  await editor.getByTestId("event-command-empty-line").dblclick();
  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  await picker.getByTestId("event-command-picker-search").fill("BGM 재생");
  await picker.getByRole("button", { name: "BGM 재생...", exact: true }).click();

  const form = page.getByTestId("play-audio-command-body");
  await expect(form).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("play-audio-channel-bgm")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("play-audio-resource-select").selectOption("cc0-music-field-loop");
  await page.getByTestId("play-audio-preview").click();
  await expect(page.getByTestId("play-audio-status")).toContainText("재생 중");
  const formShot = join(EVIDENCE_DIR, "03-event-play-audio-form-preview.png");
  await page.screenshot({ path: formShot, fullPage: true });
  await testInfo.attach("play-audio-form", { path: formShot, contentType: "image/png" });

  await page.getByTestId("play-audio-channel-se").click();
  await expect(page.getByTestId("play-audio-resource-picker")).toContainText("효과음 라이브러리");
  await page.getByTestId("play-audio-search").fill("구매");
  await expect(page.getByTestId("play-audio-result-count")).toContainText(/전체 \d+개 중 \d+개/);
  await page.getByTestId("play-audio-resource-select").selectOption("cc0-se-orp-inventory-coin");
  await page.getByTestId("play-audio-preview").click();
  await expect(page.getByTestId("play-audio-status")).toContainText("재생 중");
  await expect(page.getByTestId("play-audio-meta")).toContainText("/assets/se/oga-rpg-pack/inventory/coin.wav");
  const formSeShot = join(EVIDENCE_DIR, "04-event-play-audio-form-se.png");
  await page.screenshot({ path: formSeShot, fullPage: true });
  await testInfo.attach("play-audio-form-se", { path: formSeShot, contentType: "image/png" });
});
