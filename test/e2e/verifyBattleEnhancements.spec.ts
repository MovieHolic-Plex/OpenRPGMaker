import { test, expect } from "@playwright/test";
import path from "path";

const ARTIFACT_DIR = "C:/Users/USER/.gemini/antigravity-cli/brain/fd8cdbaf-262f-4f68-9419-ed9ae9afe24d";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  });
});

test("Verify Battle Enhancements (Juice, Speed, Auto, and Quick Battle Modal)", async ({ page }) => {
  await page.goto("http://127.0.0.1:9173/");
  await page.waitForLoadState("networkidle");

  // 1. Open Database modal
  const dbBtn = page.getByTestId("editor-nav-database");
  if (await dbBtn.isVisible()) {
    await dbBtn.click();
  } else {
    // Try header button if present
    const navBtn = page.locator("button:has-text('데이터베이스'), button:has-text('DB')").first();
    if (await navBtn.isVisible()) await navBtn.click();
  }

  await page.waitForTimeout(500);

  // Click '적 그룹' (Troops) tab
  const troopsTab = page.getByTestId("db-tab-troops");
  if (await troopsTab.isVisible()) {
    await troopsTab.click();
    await page.waitForTimeout(500);
  }

  // Check Quick Battle Test button
  const quickTestBtn = page.getByTestId("quick-battle-test-btn");
  if (await quickTestBtn.isVisible()) {
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "editor_troop_tab.png") });
    await quickTestBtn.click();
    await page.waitForTimeout(1000);

    // Take screenshot of Quick Battle Modal
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "editor_quick_battle_modal.png") });

    // Click Speed Button to test toggle
    const speedBtn = page.getByTestId("battle-speed-btn");
    if (await speedBtn.isVisible()) {
      await speedBtn.click();
      await page.waitForTimeout(300);
    }

    // Click Auto Button to test Auto battle
    const autoBtn = page.getByTestId("battle-auto-btn");
    if (await autoBtn.isVisible()) {
      await autoBtn.click();
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, "battle_auto_play.png") });

    const closeBtn = page.getByTestId("quick-battle-close-btn");
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  }

  // 2. Play mode test
  const playModeBtn = page.getByTestId("mode-play");
  if (await playModeBtn.isVisible()) {
    await playModeBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "battle_enhanced_view.png") });
  }
});
