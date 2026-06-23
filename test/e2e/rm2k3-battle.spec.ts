import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { deserialize } from "@/project/io";

type RuntimeBattleResult = "victory" | "defeat" | "escape";

type RuntimeState = {
  readonly mapId: string;
  readonly battleResult?: RuntimeBattleResult;
};

async function seedProject(page: Page): Promise<void> {
  const fixture = await readFile(new URL("../fixtures/projects/battle-v3.json", import.meta.url), "utf8");
  const project = deserialize(fixture);
  await page.goto("/");
  await page.evaluate(async (seed) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("rpg-zzu", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("projects", "readwrite");
        tx.objectStore("projects").put(seed, "current");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }, project);
  await page.reload();
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
}

async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  const parsed: unknown = JSON.parse(text);
  if (!isRuntimeState(parsed)) throw new Error("invalid runtime state");
  return parsed;
}

function isRuntimeState(value: unknown): value is RuntimeState {
  if (typeof value !== "object" || value === null) return false;
  if (!("mapId" in value) || typeof value.mapId !== "string") return false;
  if (!("battleResult" in value)) return true;
  return value.battleResult === "victory" || value.battleResult === "defeat" || value.battleResult === "escape";
}

test("side-view battleProcessing plays through victory and restores the map", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedProject(page);
  await page.click('[data-testid="mode-play"]');
  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await expect(page.locator('[data-testid="event-battle-start"]')).toBeVisible({ timeout: 2_000 });
  await page.click('[data-testid="event-battle-start"]');

  await expect(page.getByTestId("battle-scene")).toBeVisible();
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-system-resource", "tex_tiles_default");
  await expect(page.getByTestId("battle-backdrop")).toHaveAttribute("data-backdrop-resource-id", "tex_tiles_default");
  await expect(page.getByTestId("battle-party")).toBeVisible();
  await expect(page.getByTestId("battle-actor-actor_hero")).toHaveAttribute("data-battle-charset-resource-id", "hero");
  await expect(page.getByTestId("actor-command-attack")).toBeVisible();
  await expect(page.getByTestId("actor-command-skill")).toBeVisible();
  await expect(page.getByTestId("enemy-1")).toHaveAttribute("data-monster-resource-id", "slime");
  await page.screenshot({ path: testInfo.outputPath("battle-surface.png"), fullPage: true });
  await page.getByTestId("actor-command-skill").click();
  await expect(page.getByTestId("battle-animation")).toBeVisible();
  await expect.poll(async () => (await runtimeState(page)).battleResult).toBe("victory");
  await expect(page.getByTestId("battle-scene")).toBeHidden();
  await expect(page.getByTestId("play-canvas")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("battle-victory.png"), fullPage: true });
});

test("missing troop import prevents battle start with a visible error", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("toolbar-import").click();
  const fileChooser = await chooser;
  await fileChooser.setFiles("test/fixtures/projects/battle-missing-troop-v3.json");
  await expect(page.getByText(/가져오기 실패:/)).toContainText("battleProcessing: troopId");
  await expect(page.getByTestId("battle-scene")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("battle-missing-troop.png"), fullPage: true });
});
