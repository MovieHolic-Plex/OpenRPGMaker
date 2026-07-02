import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { seedReferenceBattleProject, startReferenceBattle } from "./battleReferenceProject";

const evidenceDir = "output/evidence/battle-ui-simplify";

test("battle command, target, and result surfaces stay simple", async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 768 });
  await mkdir(evidenceDir, { recursive: true });
  await seedReferenceBattleProject(page);
  await startReferenceBattle(page);

  await page.screenshot({ path: `${evidenceDir}/01-command.png`, fullPage: true });
  await expect(page.getByTestId("battle-turn-ribbon")).toHaveCount(0);
  await expect(page.getByTestId("battle-enemy-intent")).toHaveCount(0);
  await expect(page.getByTestId("battle-weakness-chips")).toHaveCount(0);
  await expect(page.getByTestId("battle-active-actor-card")).toHaveCount(0);
  await expect(page.getByTestId("battle-command-grid")).toBeVisible();
  await expect(page.getByTestId("battle-resource-preview")).toHaveCount(0);
  await expect(page.getByTestId("battle-command-help")).toHaveCount(0);
  await expect(page.getByTestId("actor-command-recover")).toHaveCount(0);
  const commandLabels = await page.locator("[data-testid='battle-scene']").evaluate((scene) => (
    [...scene.querySelectorAll("[data-testid^='actor-command-']")].map((node) => node.textContent)
  ));

  await page.getByTestId("actor-command-attack").click();
  await expect(page.getByTestId("battle-target-analysis")).toHaveCount(0);
  await expect(page.getByTestId("battle-target-brackets")).toBeVisible();
  await expect(page.getByTestId("battle-expected-result")).toHaveCount(0);
  await expect(page.getByTestId("battle-key-prompts")).toContainText("Z");
  const targetPrompt = await page.getByTestId("battle-target-prompt").textContent();
  await page.screenshot({ path: `${evidenceDir}/02-target.png`, fullPage: true });

  await page.locator(".battle-enemy[data-battle-targetable='true']").first().click();
  await expect(page.getByTestId("battle-result-panel")).toBeVisible();
  await expect(page.getByTestId("battle-result-cards")).toBeVisible();
  await expect(page.getByTestId("battle-result-progress")).toHaveCount(0);
  await expect(page.getByTestId("battle-result-next-objective")).toHaveCount(0);
  await page.screenshot({ path: `${evidenceDir}/03-result.png`, fullPage: true });

  const result = await page.getByTestId("battle-result-panel").textContent();
  const labels = { commands: commandLabels, targetPrompt, result };
  await writeFile(`${evidenceDir}/simple-ui-labels.json`, `${JSON.stringify(labels, null, 2)}\n`, "utf8");
});
