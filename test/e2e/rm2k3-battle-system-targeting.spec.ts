import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { deserialize } from "@/project/io";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";
import { confirmBattleTarget } from "./battleReferenceProject";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
});

const evidenceDir = "output/evidence/rm2003-battle-system";

test("battle attack waits for explicit RM2003-style target selection before executing", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1360, height: 768 });
  await seedBattleProject(page);
  await startBattle(page);
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: `${evidenceDir}/001-command-ready.png`, fullPage: true });

  await page.getByTestId("actor-command-attack").click();
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-phase", "targetSelect");
  await expect(page.getByTestId("battle-target-enemy-1")).toBeVisible();
  await expect(page.getByTestId("battle-message-window")).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/002-target-select.png`, fullPage: true });

  const targetState = await battleTargetState(page);
  await writeFile(`${evidenceDir}/002-target-select.json`, `${JSON.stringify(targetState, null, 2)}\n`, "utf8");
  expect(targetState.targetableEnemyIds).toContain("enemy-1");
  expect(targetState.messageText).toContain("대상");

  await confirmBattleTarget(page, "enemy-1");
  await expect(page.getByTestId("battle-scene")).not.toHaveAttribute("data-battle-phase", "targetSelect");
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-director-step", /acting|impact|result/);
  await page.screenshot({ path: `${evidenceDir}/003-attack-executed.png`, fullPage: true });
});

async function seedBattleProject(page: Page): Promise<void> {
  const fixture = await readFile(new URL("../fixtures/projects/battle-v3.json", import.meta.url), "utf8");
  const project = deserialize(fixture);
  const troop = project.database.troops.find((record) => record.id === "troop_slime");
  if (!troop) throw new Error("missing troop_slime fixture");
  troop.previewBackgroundResourceId = "easyrpg-backdrop-sky1";
  const slime = project.database.enemies.find((record) => record.id === "enemy_slime");
  if (!slime) throw new Error("missing enemy_slime fixture");
  slime.stats.maxHp = 999;
  await seedProjectFromSupabaseCanonical(page, project);
}

async function startBattle(page: Page): Promise<void> {
  await page.getByTestId("mode-play").click();
  await page.waitForTimeout(250);
  if (!(await page.getByTestId("test-play-window").isVisible())) {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("rpgzzu:test-play-window")));
  }
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.locator('[data-testid="event-battle-start"]')).toBeVisible({ timeout: 5_000 });
  await page.click('[data-testid="event-battle-start"]');
  await expect(page.getByTestId("battle-scene")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("actor-command-attack")).toBeVisible({ timeout: 20_000 });
}

async function battleTargetState(page: Page): Promise<{
  readonly phase: string;
  readonly targetableEnemyIds: readonly string[];
  readonly messageText: string;
}> {
  return page.evaluate(() => {
    const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']");
    const targets = [...document.querySelectorAll<HTMLElement>("[data-battle-targetable='true']")];
    const message = document.querySelector<HTMLElement>("[data-testid='battle-message-window']");
    return {
      phase: scene?.dataset.battlePhase ?? "",
      targetableEnemyIds: targets.map((target) => target.dataset.testid ?? ""),
      messageText: message?.textContent ?? "",
    };
  });
}
