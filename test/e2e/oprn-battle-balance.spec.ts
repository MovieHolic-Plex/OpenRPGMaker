import { expect, test } from "@playwright/test";
import {
  confirmBattleTarget,
  seedReferenceBattleProject,
  startReferenceBattle,
  waitForActorCommand,
} from "./battleReferenceProject";

const SLIME_MAX_HP = 220;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

test("reference slime battle survives the first player action", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedReferenceBattleProject(page);
  await startReferenceBattle(page);
  const hpLocator = page.getByTestId("battle-scene").getByTestId("battle-enemy-hp-enemy-1");
  await expect(hpLocator).toContainText(String(SLIME_MAX_HP));

  await waitForActorCommand(page);
  await page.getByTestId("actor-command-attack").click();
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-phase", "targetSelect");
  await confirmBattleTarget(page);
  await expect(page.getByTestId("battle-result-panel")).toHaveCount(0);
  await expect.poll(async () => {
    const hp = await hpLocator.textContent();
    const popups = await page.getByTestId("battle-scene").getByTestId("battle-damage-popup").count();
    return hp !== `${SLIME_MAX_HP}/${SLIME_MAX_HP}` || popups > 0;
  }, { timeout: 15_000 }).toBe(true);
});