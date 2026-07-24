import { expect, test } from "@playwright/test";
import { seedReferenceBattleProject } from "./battleReferenceProject";
import { startNewGameFromTitle } from "./runtimeInput";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
});

test("battle entry plays an encounter transition and escape cancels targeting without opening the field menu", async ({ page }) => {
  test.setTimeout(90_000);
  await seedReferenceBattleProject(page);
  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();

  await page.click('[data-testid="event-battle-start"]');
  await expect(page.getByTestId("battle-transition-overlay")).toBeVisible();
  await expect(page.getByTestId("battle-scene")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-director-step", "intro");
  await expect(page.getByTestId("battle-message-window")).toBeVisible();
  await expect(page.getByTestId("battle-transition-overlay")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByTestId("actor-command-attack")).toBeVisible({ timeout: 20_000 });

  await page.getByTestId("actor-command-attack").click();
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-phase", "targetSelect");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-phase", "actorCommand");
  await expect(page.getByTestId("main-menu")).toHaveCount(0);

  await page.getByTestId("actor-command-attack").click();
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-phase", "targetSelect");
  await page.keyboard.press("x");
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-phase", "actorCommand");
  await expect(page.getByTestId("main-menu")).toHaveCount(0);
});
