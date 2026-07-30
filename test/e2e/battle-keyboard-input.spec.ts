import { expect, test } from "@playwright/test";
import { seedReferenceBattleProject, startReferenceBattle, waitForActorCommand } from "./battleReferenceProject";

test("battle keyboard controls work in the real test-play window", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1360, height: 768 });
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
  await seedReferenceBattleProject(page);
  await startReferenceBattle(page);
  await waitForActorCommand(page);

  const scene = page.getByTestId("battle-scene");
  const cursor = () => scene.locator(".battle-command[data-battle-command-cursor='true']");
  await expect(scene).toHaveAttribute("data-battle-sequence-busy", "false");
  await expect(cursor()).toHaveAttribute("data-testid", "actor-command-attack");

  await page.keyboard.press("ArrowDown");
  await expect(cursor()).toHaveAttribute("data-testid", "actor-command-skill");
  await expect(page.getByTestId("actor-command-skill")).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(cursor()).toHaveAttribute("data-testid", "actor-command-item");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("actor-command-back")).toBeVisible();

  await page.keyboard.press("x");
  await expect(cursor()).toHaveAttribute("data-testid", "actor-command-attack");

  await page.keyboard.press("Enter");
  await expect(scene).toHaveAttribute("data-battle-phase", "targetSelect");
  await page.keyboard.press("x");
  await expect(scene).toHaveAttribute("data-battle-phase", "actorCommand");

  await page.keyboard.press("z");
  await expect(scene).toHaveAttribute("data-battle-phase", "targetSelect");
  await page.keyboard.press("z");
  await expect(scene).toHaveAttribute("data-battle-director-step", /acting|impact|result/, { timeout: 10_000 });
});
