import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import {
  createModernNocturneProject,
  MODERN_MAP,
  MODERN_SWITCH,
} from "@/project/defaults/modernNocturneGame";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const OUT = "output/evidence/modern-exteriors-rpg/browser";

type RuntimeState = {
  mapId: string;
  player: { x: number; y: number };
  switches: Record<string, boolean>;
};

type Direction = "down" | "left" | "right" | "up";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
});

test("plays the live Modern Exteriors investigation through its ending", async ({ page }) => {
  test.setTimeout(180_000);
  await mkdir(OUT, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const consoleLines: string[] = [];
  await seedProjectFromSupabaseCanonical(page, createModernNocturneProject(), "/?e2eVitals=1");

  await expect(page.getByText("해오름구 · 자정", { exact: true }).first()).toBeVisible();
  const editorCanvas = page.getByTestId("edit-canvas").locator("canvas").first();
  await expect(editorCanvas).toBeVisible();
  await page.waitForFunction(() => typeof (window as unknown as { __rpgzzuEditCamera?: unknown }).__rpgzzuEditCamera === "function", undefined, { timeout: 20_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/01-editor-city.png`, fullPage: true });

  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await expect(page.getByTestId("title-logo")).toBeVisible();
  await expect(page.getByTestId("title-logo")).toHaveAttribute("data-title-logo-resource", "modern-nocturne-logo");
  await expect(page.getByTestId("title-screen").locator(".rm-title-screen-title")).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/02-title.png`, fullPage: true });
  await page.keyboard.press("Enter");
  await page.evaluate(() => document.documentElement.dataset.cleanEvidence = "true");
  await waitForRuntime(page, consoleLines);
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe(MODERN_MAP.city);
  await page.waitForTimeout(1200);
  await page.getByTestId("play-stage").screenshot({ path: `${OUT}/03-city-start.png` });

  await page.getByTestId("event-ev_neon_detective").click({ force: true });
  await expect(page.getByTestId("dialogue-box")).toBeVisible();
  await page.getByTestId("play-stage").screenshot({ path: `${OUT}/04-investigation-dialogue.png` });
  await clearDialogueUntilChoice(page);
  await expect(page.getByTestId("runtime-choices")).toBeVisible();
  await page.getByTestId("runtime-choice-0").click();
  await clearDialogue(page);
  await expectSwitch(page, MODERN_SWITCH.caseStarted);
  await teleport(page, MODERN_MAP.city, 10, 9, "up");

  await interactEvent(page, "ev_neon_witness");
  await clearDialogue(page);
  await expectSwitch(page, MODERN_SWITCH.clueWitness);
  await teleport(page, MODERN_MAP.city, 3, 14, "down");

  await interactEvent(page, "ev_neon_alley_clue");
  await clearDialogue(page);
  await expectSwitch(page, MODERN_SWITCH.clueDumpster);
  await teleport(page, MODERN_MAP.city, 27, 21, "up");

  await interactEvent(page, "ev_neon_memorial");
  await clearDialogue(page);
  await expectSwitch(page, MODERN_SWITCH.clueMemorial);
  await page.getByTestId("play-stage").screenshot({ path: `${OUT}/05-clues-complete.png` });
  await teleport(page, MODERN_MAP.city, 7, 14, "down");

  await interactEvent(page, "ev_neon_alley_ghost");
  await clearDialogueUntilBattle(page);
  await winBattle(page, "troop_neon_wraith");
  await clearDialogue(page);
  await expectSwitch(page, MODERN_SWITCH.alleyWon);
  await page.getByTestId("play-stage").screenshot({ path: `${OUT}/06-alley-cleared.png` });
  await teleport(page, MODERN_MAP.city, 26, 10, "up");
  await expect(page.getByTestId("event-ev_neon_rooftop_door")).toHaveAttribute("data-page-id", "roof_open");

  await interactEvent(page, "ev_neon_rooftop_door");
  await advanceDialogueUntilMap(page, MODERN_MAP.rooftop);
  await expect.poll(async () => (await runtimeState(page)).mapId, { timeout: 10_000 }).toBe(MODERN_MAP.rooftop);
  await page.waitForTimeout(900);
  await page.getByTestId("play-stage").screenshot({ path: `${OUT}/07-rooftop.png` });
  await teleport(page, MODERN_MAP.rooftop, 11, 9, "up");

  await interactEvent(page, "ev_neon_custodian");
  await clearDialogueUntilBattle(page);
  await winBattle(page, "troop_archive_custodian");
  await clearDialogueUntilChoice(page, 20);
  await expectSwitch(page, MODERN_SWITCH.rooftopWon);
  await expect(page.getByTestId("runtime-choices")).toBeVisible();
  await expect(page.getByTestId("runtime-choice-0")).toContainText("피해자에게 먼저 전달한다");
  await page.getByTestId("runtime-choice-0").click();
  await clearDialogueUntilEnding(page);
  await expectSwitch(page, MODERN_SWITCH.endingMercy);
  await expect(page.getByTestId("ending-screen")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("ending-screen")).toContainText("새벽의 증언");
  await page.getByTestId("play-stage").screenshot({ path: `${OUT}/08-ending.png` });
});

async function waitForRuntime(page: Page, consoleLines: readonly string[]): Promise<void> {
  await expect.poll(async () => {
    const stateVisible = await page.getByTestId("runtime-state-json").isVisible().catch(() => false);
    if (stateVisible) return "ready";
    const bootLog = await page.evaluate(() => {
      const reader = Reflect.get(window, "__rpgzzuPlayBootLog") as undefined | (() => unknown);
      return reader?.();
    });
    const errorVisible = await page.getByText("플레이를 시작하지 못했습니다", { exact: true }).isVisible().catch(() => false);
    if (errorVisible) throw new Error(`boot failed: ${JSON.stringify(bootLog)}\n${consoleLines.join("\n")}`);
    return "waiting";
  }, { timeout: 30_000 }).toBe("ready");
}

async function runtimeState(page: Page): Promise<RuntimeState> {
  return JSON.parse((await page.getByTestId("runtime-state-json").textContent()) ?? "{}") as RuntimeState;
}

async function expectSwitch(page: Page, switchId: string): Promise<void> {
  await expect.poll(async () => (await runtimeState(page)).switches[switchId], { timeout: 10_000 }).toBe(true);
}

async function teleport(page: Page, mapId: string, x: number, y: number, facing: Direction): Promise<void> {
  await page.evaluate(([targetMapId, targetX, targetY]) => {
    const debug = (window as unknown as {
      __rpgzzuDebug?: { teleport: (id: string, px: number, py: number) => void };
    }).__rpgzzuDebug;
    if (!debug) throw new Error("runtime debug hook unavailable");
    debug.teleport(targetMapId, targetX, targetY);
  }, [mapId, x, y] as const);
  await expect.poll(async () => {
    const state = await runtimeState(page);
    return [state.mapId, state.player.x, state.player.y];
  }, { timeout: 10_000 }).toEqual([mapId, x, y]);
  await face(page, facing);
}

async function face(page: Page, direction: Direction): Promise<void> {
  await page.evaluate((nextDirection) => {
    const input = (window as unknown as { __rpgzzuInput?: { face: (value: string) => void } }).__rpgzzuInput;
    if (!input) throw new Error("runtime input hook unavailable");
    input.face(nextDirection);
  }, direction);
  await page.waitForTimeout(40);
}

async function interactEvent(page: Page, eventId: string): Promise<void> {
  const marker = page.getByTestId(`event-${eventId}`);
  await expect(marker).toBeAttached({ timeout: 10_000 });
  await marker.evaluate((element) => (element as HTMLElement).click());
  await expect.poll(async () => {
    const state = await runtimeState(page);
    const dialogue = await page.getByTestId("dialogue-box").isVisible().catch(() => false);
    const battle = await page.getByTestId("battle-scene").isVisible().catch(() => false);
    const choices = await page.getByTestId("runtime-choices").isVisible().catch(() => false);
    return state.running || dialogue || battle || choices;
  }, { timeout: 10_000 }).toBe(true);
}

async function clearDialogueUntilChoice(page: Page, max = 24): Promise<void> {
  for (let index = 0; index < max; index += 1) {
    if (await page.getByTestId("runtime-choices").isVisible().catch(() => false)) return;
    if (await page.getByTestId("battle-scene").isVisible().catch(() => false)) return;
    const dialogue = page.getByTestId("dialogue-box");
    if (await dialogue.isVisible().catch(() => false)) await dialogue.click({ force: true });
    await page.waitForTimeout(180);
  }
}

async function clearDialogueUntilBattle(page: Page): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    if (await page.getByTestId("battle-scene").isVisible().catch(() => false)) return;
    const dialogue = page.getByTestId("dialogue-box");
    if (await dialogue.isVisible().catch(() => false)) await dialogue.click({ force: true });
    await page.waitForTimeout(180);
  }
  await expect(page.getByTestId("battle-scene")).toBeVisible();
}

async function clearDialogueUntilEnding(page: Page): Promise<void> {
  for (let index = 0; index < 16; index += 1) {
    if (await page.getByTestId("ending-screen").isVisible().catch(() => false)) return;
    const dialogue = page.getByTestId("dialogue-box");
    if (await dialogue.isVisible().catch(() => false)) await dialogue.click({ force: true });
    await page.waitForTimeout(180);
  }
}

async function clearDialogue(page: Page, max = 16): Promise<void> {
  let sawDialogue = false;
  for (let index = 0; index < max; index += 1) {
    const dialogue = page.getByTestId("dialogue-box");
    if (await dialogue.isVisible().catch(() => false)) {
      sawDialogue = true;
      await dialogue.click({ force: true });
      await page.waitForTimeout(180);
      continue;
    }
    const running = (await runtimeState(page)).running;
    if (sawDialogue && !running) return;
    await page.waitForTimeout(80);
  }
}

async function advanceDialogueUntilMap(page: Page, mapId: string, max = 24): Promise<void> {
  for (let index = 0; index < max; index += 1) {
    if ((await runtimeState(page)).mapId === mapId) return;
    const dialogue = page.getByTestId("dialogue-box");
    if (await dialogue.isVisible().catch(() => false)) await dialogue.click({ force: true });
    await page.waitForTimeout(180);
  }
}

async function winBattle(page: Page, troopId: string): Promise<void> {
  const battle = page.getByTestId("battle-scene");
  await expect(battle.getByTestId("battle-backdrop")).toHaveCSS("background-image", /modern-nocturne-battle-(?:city|rooftop)\.png/);
  await expect(battle).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("battle-scene").screenshot({ path: `${OUT}/${troopId}-battle.png` });
  await page.evaluate(() => {
    const setVitals = (window as unknown as {
      __rpgzzuSetActorVitals?: (actorId: string, hp: number, mp: number) => void;
    }).__rpgzzuSetActorVitals;
    if (!setVitals) throw new Error("battle vitals hook unavailable");
    setVitals("actor-1", 9999, 999);
  });
  for (let turn = 0; turn < 16 && await battle.isVisible().catch(() => false); turn += 1) {
    await expect(battle).toHaveAttribute("data-battle-phase", "actorCommand", { timeout: 45_000 });
    await page.getByTestId("actor-command-attack").evaluate((button) => (button as HTMLButtonElement).click());
    await expect(battle).toHaveAttribute("data-battle-phase", "targetSelect", { timeout: 10_000 });
    const fieldTarget = battle.locator(".battle-enemy[data-battle-targetable='true']").first();
    if (await fieldTarget.count()) await fieldTarget.evaluate((button) => (button as HTMLButtonElement).click());
    else await battle.locator("[data-testid^='battle-target-']:not([data-testid='battle-target-cancel'])").first().evaluate((button) => (button as HTMLButtonElement).click());
    await expect(battle).toHaveAttribute("data-battle-sequence-busy", "false", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(150);
    const result = page.getByTestId("battle-result-panel");
    if (await result.isVisible().catch(() => false)) {
      await expect(result).toContainText("승리");
      await result.click({ force: true }).catch(() => undefined);
      await page.keyboard.press("Enter");
      await expect(battle).toBeHidden({ timeout: 15_000 });
      return;
    }
  }
  await expect(battle).toBeHidden({ timeout: 15_000 });
}
