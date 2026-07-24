import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { deserialize } from "@/project/io";
import { performBattleAttack, performBattleSkill } from "./battleReferenceProject";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
});

const SLIME_MAX_HP = 220;

type RuntimeBattleResult = "victory" | "defeat" | "escape";

type RuntimeState = {
  readonly mapId: string;
  readonly battleResult?: RuntimeBattleResult;
};

type BattleProject = ReturnType<typeof deserialize>;

async function seedProject(page: Page, mutate?: (project: BattleProject) => void): Promise<void> {
  const fixture = await readFile(new URL("../fixtures/projects/battle-v3.json", import.meta.url), "utf8");
  const project = deserialize(fixture);
  mutate?.(project);
  await seedProjectFromSupabaseCanonical(page, project);
}

async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  const parsed: unknown = JSON.parse(text);
  if (!isRuntimeState(parsed)) throw new Error("invalid runtime state");
  return parsed;
}

async function startPlayFromEditor(page: Page): Promise<void> {
  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();
}

function isRuntimeState(value: unknown): value is RuntimeState {
  if (typeof value !== "object" || value === null) return false;
  if (!("mapId" in value) || typeof value.mapId !== "string") return false;
  if (!("battleResult" in value)) return true;
  return value.battleResult === "victory" || value.battleResult === "defeat" || value.battleResult === "escape";
}

test("side-view battleProcessing plays through victory and restores the map", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page);
  await startPlayFromEditor(page);
  await expect(page.locator('[data-testid="event-battle-start"]')).toBeVisible({ timeout: 5_000 });
  await page.click('[data-testid="event-battle-start"]');

  await expect(page.getByTestId("battle-scene")).toBeVisible();
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-system-resource", "tex_tiles_default");
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-director-step", "command", { timeout: 25_000 });
  await expect(page.getByTestId("battle-backdrop")).toHaveAttribute("data-backdrop-resource-id", "tex_tiles_default");
  await expect(page.getByTestId("battle-message-window")).toBeVisible();
  await expect(page.getByTestId("battle-party")).toBeVisible();
  await expect(page.getByTestId("battle-actor-actor_hero")).toHaveAttribute("data-battle-charset-resource-id", "hero");
  await expect(page.getByTestId("actor-command-attack")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("actor-command-skill")).toBeVisible();
  await expect(page.getByTestId("enemy-1")).toHaveAttribute("data-monster-resource-id", "generated-enemy-slime-01");
  await expect(page.getByTestId("battle-enemy-hp-enemy-1")).toContainText(String(SLIME_MAX_HP), { timeout: 5_000 });
  await page.screenshot({ path: testInfo.outputPath("battle-surface.png"), fullPage: true });
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-bgm-active", "true");
  await page.getByTestId("actor-command-defend").click();
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-director-step", "acting");
  await expect(page.getByTestId("actor-command-attack")).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: testInfo.outputPath("battle-after-defend.png"), fullPage: true });
  for (let turn = 0; turn < 2; turn += 1) {
    await performBattleAttack(page);
    await expect(page.getByTestId("battle-result-panel")).toHaveCount(0);
    await expect(page.getByTestId("actor-command-attack")).toBeVisible({ timeout: 20_000 });
  }
  await performBattleSkill(page);
  const battleAnimation = page.getByTestId("battle-scene").getByTestId("battle-animation");
  await expect(battleAnimation).toBeVisible();
  const animationState = await battleAnimation.evaluate((node) => ({
    animationId: node.getAttribute("data-animation-id"),
    currentFrame: node.getAttribute("data-current-frame"),
    frameCount: node.getAttribute("data-animation-frame-count"),
    renderedFrameCount: node.getAttribute("data-rendered-frame-count"),
    resourceId: node.getAttribute("data-animation-resource-id"),
    screenShake: node.getAttribute("data-animation-screen-shake"),
    soundResourceIds: node.getAttribute("data-animation-sound-resource-ids"),
    visibleRenderedCells: node.querySelectorAll(
      ".battle-animation-frame:not([hidden]) .battle-animation-cell[data-rendered='true']"
    ).length,
  }));
  expect(animationState).toMatchObject({
    animationId: "anim_magic",
    frameCount: "2",
    renderedFrameCount: "2",
    resourceId: "easyrpg-battle-blow",
    screenShake: "true",
  });
  expect(animationState.currentFrame).toMatch(/^[01]$/);
  expect(animationState.soundResourceIds).toMatch(/easyrpg-sound-magic1/);
  expect(animationState.visibleRenderedCells).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath("battle-magic-animation.png"), fullPage: true });
  for (let turn = 0; turn < 6 && (await page.getByTestId("battle-result-panel").count()) === 0; turn += 1) {
    await performBattleAttack(page);
  }
  await expect(page.getByTestId("battle-result-panel")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("battle-result-panel")).toHaveAttribute("data-battle-result", "victory");
  await expect.poll(async () => (await runtimeState(page)).battleResult).toBe("victory");
  await expect(page.getByTestId("battle-scene")).toBeHidden();
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("battle-victory.png"), fullPage: true });
});

test("generated dragon monster resource appears in a playable battle", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page, (project) => {
    const slime = project.database.enemies.find((enemy) => enemy.id === "enemy_slime");
    if (!slime) throw new Error("missing slime enemy fixture");
    slime.name = "Dragon Slime";
    slime.monsterResourceId = "generated-enemy-dragon-01";
  });
  await startPlayFromEditor(page);
  await expect(page.locator('[data-testid="event-battle-start"]')).toBeVisible({ timeout: 5_000 });
  await page.click('[data-testid="event-battle-start"]');

  await expect(page.getByTestId("battle-scene")).toBeVisible();
  await expect(page.getByTestId("actor-command-attack")).toBeVisible();
  await expect(page.getByTestId("enemy-1")).toHaveAttribute("data-monster-resource-id", "generated-enemy-dragon-01");
  await page.screenshot({ path: testInfo.outputPath("battle-dragon-monster.png"), fullPage: true });
});

test("battle event Enemy Encounter reveals a hidden dragon and changes battleback", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page, (project) => {
    const troop = project.database.troops.find((record) => record.id === "troop_slime");
    if (!troop) throw new Error("missing slime troop fixture");
    troop.enemyIds = ["enemy_slime", "enemy_dragon"];
    troop.members = [
      { enemyId: "enemy_slime", x: 120, y: 128, hidden: false },
      { enemyId: "enemy_dragon", x: 196, y: 96, hidden: true },
    ];
    troop.previewBackgroundResourceId = "easyrpg-backdrop-sky1";
    troop.battleEventPages = [
      {
        id: "m2_encounter_and_backdrop",
        name: "Enemy encounter and battleback",
        conditions: [{ kind: "actorCommand", actorId: "actor_hero", commandId: "defend" }],
        span: "battle",
        commands: [
          { kind: "m2Command", commandId: "m2-102-change-battleback", fields: { resourceId: "easyrpg-backdrop-dawn1" } },
          { kind: "m2Command", commandId: "m2-101-enemy-encounter", fields: { target: "enemy-2" } },
        ],
      },
    ];
  });
  await startPlayFromEditor(page);
  await expect(page.locator('[data-testid="event-battle-start"]')).toBeVisible({ timeout: 5_000 });
  await page.click('[data-testid="event-battle-start"]');

  await expect(page.getByTestId("battle-scene")).toBeVisible();
  await expect(page.getByTestId("battle-backdrop")).toHaveAttribute("data-backdrop-resource-id", "easyrpg-backdrop-sky1");
  await expect(page.getByTestId("enemy-1")).toHaveAttribute("data-monster-resource-id", "generated-enemy-slime-01");
  await expect(page.getByTestId("enemy-2")).toHaveCount(0);
  await page.screenshot({
    path: "C:/Users/hyeon/Downloads/rpg-zzu/.omo/evidence/battle-editor-db-commands/battle-before-enemy-encounter.png",
    fullPage: true,
  });

  await page.getByTestId("actor-command-defend").click();

  await expect(page.getByTestId("battle-backdrop")).toHaveAttribute("data-backdrop-resource-id", "easyrpg-backdrop-dawn1");
  await expect(page.getByTestId("enemy-2")).toHaveAttribute("data-monster-resource-id", "generated-enemy-dragon-01");
  await page.screenshot({
    path: "C:/Users/hyeon/Downloads/rpg-zzu/.omo/evidence/battle-editor-db-commands/battle-after-enemy-encounter.png",
    fullPage: true,
  });
});

test("missing troop import prevents battle start with a visible error", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("toolbar-import").click();
  const fileChooser = await chooser;
  await fileChooser.setFiles("test/fixtures/projects/battle-missing-troop-v3.json");
  await expect(page.getByText(/battleProcessing: troopId/)).toBeVisible();
  await expect(page.getByTestId("battle-scene")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("battle-missing-troop.png"), fullPage: true });
});
