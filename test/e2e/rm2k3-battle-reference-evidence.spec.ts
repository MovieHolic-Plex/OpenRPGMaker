import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { seedReferenceBattleProject, startReferenceBattle } from "./battleReferenceProject";

const evidenceRoot = "output/evidence/battle-scene-reference-20260630/final";
const taskEvidenceManifest = ".omo/evidence/task-8-battle-asset-equivalence-screenshots.json";
const viewports = [
  { name: "desktop-1360", width: 1360, height: 768 },
  { name: "wide-1920", width: 1920, height: 1080 },
] as const;

for (const viewport of viewports) {
  test(`capture reference battle evidence at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mkdir(`${evidenceRoot}/${viewport.name}`, { recursive: true });
    await seedReferenceBattleProject(page);
    await startReferenceBattle(page);

    const screenshots: string[] = [];
    await capture(page, viewport.name, "01-command-full", screenshots);
    await captureLocator(page, viewport.name, "02-command-hud", ".battle-command-panel", screenshots);
    await captureLocator(page, viewport.name, "03-command-field", ".battle-field", screenshots);
    const commandMetrics = await battleMetrics(page);
    await writeJson(`${evidenceRoot}/${viewport.name}/10-command-metrics.json`, commandMetrics);

    await page.getByTestId("actor-command-attack").click();
    await expect(page.getByTestId("battle-target-analysis")).toBeVisible();
    await capture(page, viewport.name, "04-target-full", screenshots);
    await captureLocator(page, viewport.name, "05-target-analysis", "[data-testid='battle-target-analysis']", screenshots);
    await captureLocator(page, viewport.name, "06-target-command-hud", ".battle-command-panel", screenshots);
    const targetMetrics = await battleMetrics(page);
    await writeJson(`${evidenceRoot}/${viewport.name}/11-target-metrics.json`, targetMetrics);

    await page.locator(".battle-enemy[data-battle-targetable='true']").first().click();
    await expect(page.getByTestId("battle-result-panel")).toBeVisible();
    await capture(page, viewport.name, "07-result-full", screenshots);
    await captureLocator(page, viewport.name, "08-result-modal", "[data-testid='battle-result-panel']", screenshots);
    await captureLocator(page, viewport.name, "09-result-progress", "[data-testid='battle-result-progress']", screenshots);
    const resultMetrics = await battleMetrics(page);
    await writeJson(`${evidenceRoot}/${viewport.name}/12-result-metrics.json`, resultMetrics);
    await writeJson(`${evidenceRoot}/${viewport.name}/10-metrics.json`, {
      command: commandMetrics,
      target: targetMetrics,
      result: resultMetrics,
    });
    await writeFile(`${evidenceRoot}/${viewport.name}/screenshots.json`, `${JSON.stringify(screenshots, null, 2)}\n`, "utf8");
  });
}

test("write combined battle evidence manifest", async () => {
  await mkdir(".omo/evidence", { recursive: true });
  const viewportsManifest = await Promise.all(viewports.map(async (viewport) => {
    const root = `${evidenceRoot}/${viewport.name}`;
    const screenshots = JSON.parse(await readFile(`${root}/screenshots.json`, "utf8")) as readonly string[];
    const metrics = JSON.parse(await readFile(`${root}/10-metrics.json`, "utf8")) as unknown;
    return {
      name: viewport.name,
      width: viewport.width,
      height: viewport.height,
      screenshots,
      metrics,
    };
  }));
  const manifest = {
    generatedAt: new Date().toISOString(),
    source: "test/e2e/rm2k3-battle-reference-evidence.spec.ts",
    screenshotCount: viewportsManifest.reduce((count, viewport) => count + viewport.screenshots.length, 0),
    viewports: viewportsManifest,
  };
  await writeJson(taskEvidenceManifest, manifest);
  expect(manifest.screenshotCount).toBeGreaterThanOrEqual(18);
});

async function capture(page: Page, viewport: string, name: string, screenshots: string[]): Promise<void> {
  const path = `${evidenceRoot}/${viewport}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  screenshots.push(path);
}

async function captureLocator(page: Page, viewport: string, name: string, selector: string, screenshots: string[]): Promise<void> {
  const path = `${evidenceRoot}/${viewport}/${name}.png`;
  const locator = page.locator(selector).first();
  await expect(locator).toBeVisible();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await locator.screenshot({ path });
      screenshots.push(path);
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(100);
    }
  }
  screenshots.push(path);
}

async function battleMetrics(page: Page): Promise<unknown> {
  return page.getByTestId("battle-scene").evaluate((scene) => ({
    battlePhase: (scene as HTMLElement).dataset.battlePhase,
    battleStep: (scene as HTMLElement).dataset.battleDirectorStep,
    hasTurnRibbon: Boolean(scene.querySelector("[data-testid='battle-turn-ribbon']")),
    hasIntent: Boolean(scene.querySelector("[data-testid='battle-enemy-intent']")),
    hasWeakness: Boolean(scene.querySelector("[data-testid='battle-weakness-chips']")),
    hasTargetAnalysis: Boolean(scene.querySelector("[data-testid='battle-target-analysis']")),
    hasResultProgress: Boolean(scene.querySelector("[data-testid='battle-result-progress']")),
    actorResources: [...scene.querySelectorAll<HTMLElement>("[data-battle-charset-resource-id]")]
      .map((node) => node.dataset.battleCharsetResourceId),
    enemyResources: [...scene.querySelectorAll<HTMLElement>("[data-monster-resource-id]")]
      .map((node) => node.dataset.monsterResourceId),
    commandIconUrls: [...scene.querySelectorAll<HTMLElement>(".battle-command-icon")]
      .map((node) => getComputedStyle(node).backgroundImage),
    resultIconUrls: [...scene.querySelectorAll<HTMLElement>(".battle-result-reward-icon")]
      .map((node) => getComputedStyle(node).backgroundImage),
    text: scene.textContent?.replace(/\s+/g, " ").trim(),
  }));
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
