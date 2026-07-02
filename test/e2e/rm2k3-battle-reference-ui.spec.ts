import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { seedReferenceBattleProject, startReferenceBattle } from "./battleReferenceProject";

const evidenceDir = "output/evidence/battle-scene-reference-20260630/red";

test("battle command, target, and result surfaces expose the reference UI structure", async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 768 });
  await mkdir(evidenceDir, { recursive: true });
  await seedReferenceBattleProject(page);
  await startReferenceBattle(page);

  await page.screenshot({ path: `${evidenceDir}/01-before-command.png`, fullPage: true });
  await expect(page.getByTestId("battle-turn-ribbon")).toBeVisible();
  await expect(page.getByTestId("battle-enemy-intent")).toBeVisible();
  await expect(page.getByTestId("battle-weakness-chips")).toBeVisible();
  await expect(page.getByTestId("battle-active-actor-card")).toBeVisible();
  await expect(page.getByTestId("battle-command-grid")).toBeVisible();
  await expect(page.getByTestId("battle-resource-preview")).toBeVisible();
  // command-help 는 이제 현재 적의 실제 속성 약점(또는 통상 공격 안내)을 표시한다.
  await expect(page.getByTestId("battle-command-help")).toBeVisible();

  await page.getByTestId("actor-command-attack").click();
  await expect(page.getByTestId("battle-target-analysis")).toBeVisible();
  await expect(page.getByTestId("battle-target-brackets")).toBeVisible();
  await expect(page.getByTestId("battle-expected-result")).toBeVisible();
  await expect(page.getByTestId("battle-key-prompts")).toContainText("Z");
  await page.screenshot({ path: `${evidenceDir}/02-before-target.png`, fullPage: true });

  await page.locator(".battle-enemy[data-battle-targetable='true']").first().click();
  await expect(page.getByTestId("battle-result-panel")).toBeVisible();
  await expect(page.getByTestId("battle-result-cards")).toBeVisible();
  await expect(page.getByTestId("battle-result-progress")).toBeVisible();
  await expect(page.getByTestId("battle-result-next-objective")).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/03-before-result.png`, fullPage: true });

  const labels = await page.locator("[data-testid='battle-scene']").evaluate((scene) => ({
    turn: scene.querySelector("[data-testid='battle-turn-ribbon']")?.textContent,
    intent: scene.querySelector("[data-testid='battle-enemy-intent']")?.textContent,
    target: scene.querySelector("[data-testid='battle-target-analysis']")?.textContent,
    result: scene.querySelector("[data-testid='battle-result-panel']")?.textContent,
  }));
  await writeFile(`${evidenceDir}/reference-ui-labels.json`, `${JSON.stringify(labels, null, 2)}\n`, "utf8");
});
