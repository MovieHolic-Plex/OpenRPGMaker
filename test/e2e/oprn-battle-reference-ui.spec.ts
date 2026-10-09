import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import {
  confirmBattleTarget,
  seedLayoutResultBattleProject,
  startReferenceBattle,
} from "./battleReferenceProject";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
});

const evidenceDir = "output/evidence/battle-ui-simplify";

test("battle command, target, and result surfaces stay simple", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1360, height: 768 });
  await mkdir(evidenceDir, { recursive: true });
  await seedLayoutResultBattleProject(page, { battleFlow: "strict", battleUiStyle: "retro2003" });
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
  await expect(page.locator(".battle-enemy[data-testid='enemy-1'][data-battle-targetable='true']")).toBeVisible();
  await expect(page.getByTestId("battle-expected-result")).toHaveCount(0);
  await expect(page.getByTestId("battle-target-prompt")).toHaveCount(0);
  const targetHint = await page.getByTestId("battle-message-window").textContent();
  await page.screenshot({ path: `${evidenceDir}/02-target.png`, fullPage: true });

  await confirmBattleTarget(page);
  for (const commandNumber of [2, 3, 4]) {
    await expect(page.getByTestId("battle-scene")).toContainText(`명령 ${commandNumber}/4`);
    await page.getByTestId("actor-command-defend").click();
  }
  await expect(page.getByTestId("battle-result-panel")).toBeVisible({ timeout: 20_000 });
  const result = await page.getByTestId("battle-result-panel").textContent();
  await expect(page.getByTestId("battle-result-cards")).toBeVisible();
  await expect(page.getByTestId("battle-result-progress")).toHaveCount(0);
  await expect(page.getByTestId("battle-result-next-objective")).toHaveCount(0);
  await page.screenshot({ path: `${evidenceDir}/03-result.png`, fullPage: true });
  const labels = { commands: commandLabels, targetHint, result };
  await writeFile(`${evidenceDir}/simple-ui-labels.json`, `${JSON.stringify(labels, null, 2)}\n`, "utf8");
});
