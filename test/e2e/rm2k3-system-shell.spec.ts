import { expect, test, type Page } from "@playwright/test";
import systemShellProject from "../fixtures/projects/system-shell-v3.json" with { type: "json" };
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

type RuntimeState = {
  readonly mapId: string;
  readonly player: { readonly x: number; readonly y: number };
  readonly switches: Record<string, boolean>;
  readonly variables: Record<string, number>;
  readonly battleResult?: string;
};

type AudioState = {
  readonly bgm?: { readonly resourceId: string; readonly loop: boolean };
  readonly se?: { readonly resourceId: string; readonly loop: boolean };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRuntimeState(value: unknown): value is RuntimeState {
  if (!isRecord(value)) return false;
  if (typeof value.mapId !== "string") return false;
  if (!isRecord(value.player)) return false;
  if (typeof value.player.x !== "number" || typeof value.player.y !== "number") return false;
  return isRecord(value.switches) && isRecord(value.variables);
}

function isAudioTrack(value: unknown): value is { readonly resourceId: string; readonly loop: boolean } {
  return isRecord(value) && typeof value.resourceId === "string" && typeof value.loop === "boolean";
}

function isAudioState(value: unknown): value is AudioState {
  if (!isRecord(value)) return false;
  const bgmValid = value.bgm === undefined || isAudioTrack(value.bgm);
  const seValid = value.se === undefined || isAudioTrack(value.se);
  return bgmValid && seValid;
}

async function seedProject(page: Page): Promise<void> {
  await seedProjectFromSupabaseCanonical(page, systemShellProject);
}

async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  const parsed: unknown = JSON.parse(text);
  if (!isRuntimeState(parsed)) throw new Error("invalid runtime state");
  return parsed;
}

async function audioState(page: Page): Promise<AudioState> {
  const text = await page.getByTestId("audio-state-json").textContent();
  if (!text) throw new Error("missing audio state");
  const parsed: unknown = JSON.parse(text);
  if (!isAudioState(parsed)) throw new Error("invalid audio state");
  return parsed;
}

test("system shell supports title, menu, saves, audio, pictures, game over, and corrupt-slot isolation", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page);

  await page.getByTestId("mode-play").click();
  await expect(page.locator('[data-testid="title-screen"]')).toBeVisible();
  await expect(page.getByTestId("title-screen")).toHaveAttribute("data-title-resource", "title_shell");
  await expect(page.getByTestId("title-screen")).toHaveCSS("background-image", /data:image\/png/);
  await page.screenshot({ path: testInfo.outputPath("title-screen.png"), fullPage: true });
  await page.click('[data-testid="title-new-game"]');
  await expect(page.getByTestId("runtime-state-json")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="main-menu"]')).toBeVisible();
  await expect(page.getByTestId("main-menu")).toHaveAttribute("data-system-resource", "system_shell");
  await expect(page.getByTestId("main-menu")).toHaveCSS("border-image-source", /data:image\/png/);
  await page.click('[data-testid="save-slot-1"]');
  await expect(page.getByTestId("main-menu")).toContainText("1번 저장 칸에 저장했습니다");
  await page.screenshot({ path: testInfo.outputPath("main-menu.png"), fullPage: true });

  await page.getByTestId("event-mutate-save-state").click();
  await expect.poll(async () => (await runtimeState(page)).variables.var_score).toBe(41);
  await page.keyboard.press("Escape");
  await page.getByTestId("load-slot-1").click();
  await expect.poll(async () => (await runtimeState(page)).variables.var_score).toBe(0);

  await page.getByTestId("event-mutate-save-state").click();
  await expect.poll(async () => (await runtimeState(page)).switches.sw_saved).toBe(true);
  await expect.poll(async () => (await runtimeState(page)).variables.var_score).toBe(41);
  await page.keyboard.press("Escape");
  await page.getByTestId("save-slot-2").click();
  await expect(page.getByTestId("main-menu")).toContainText("2번 저장 칸에 저장했습니다");

  await page.keyboard.press("Escape");
  await page.getByTestId("event-audio-picture").click();
  await expect.poll(async () => (await audioState(page)).bgm?.resourceId).toBe("bgm_theme");
  await expect(page.locator('[data-testid="picture-layer"]')).toContainText("Gate Picture");

  await page.getByTestId("event-game-over").click();
  await expect(page.locator('[data-testid="game-over-screen"]')).toBeVisible();
  await expect(page.getByTestId("game-over-screen")).toHaveAttribute("data-system-resource", "system_shell");
  await expect(page.getByTestId("game-over-screen")).toHaveCSS("border-image-source", /data:image\/png/);
  await page.screenshot({ path: testInfo.outputPath("game-over.png"), fullPage: true });
  await page.getByTestId("return-title").click();
  await expect(page.locator('[data-testid="title-screen"]')).toBeVisible();

  await page.evaluate(() => {
    localStorage.setItem("rpg-zzu:save-slot:1", "{not-json");
  });
  await page.click('[data-testid="title-load-game"]');
  await expect(page.getByTestId("save-slot-corrupt-1")).toBeVisible();
  await page.click('[data-testid="save-slot-2"]');
  await expect.poll(async () => (await runtimeState(page)).variables.var_score).toBe(41);
  await expect.poll(async () => (await runtimeState(page)).switches.sw_saved).toBe(true);

  await page.getByTestId("event-battle-start").click();
  await expect(page.getByTestId("battle-scene")).toBeVisible();
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-system-resource", "battle_system_shell");
  await expect(page.getByTestId("battle-scene")).toHaveCSS("border-image-source", /data:image\/png/);
  await page.getByTestId("actor-command-skill").click();
  await expect.poll(async () => (await runtimeState(page)).battleResult).toBe("victory");

  await page.screenshot({ path: testInfo.outputPath("system-shell.png"), fullPage: true });
});
