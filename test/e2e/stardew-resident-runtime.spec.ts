import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { startNewGameFromTitle, tapKey } from "./runtimeInput";
import { seedProjectForEditor } from "./projectSeed";

const MAP_ID = "map_farming_demo";
const EVIDENCE_DIR = "output/evidence/stardew/runtime";

function projectWithStationaryMiner(): ReturnType<typeof createFarmingDemoProject> {
  const project = createFarmingDemoProject();
  const miner = project.maps[MAP_ID]?.events.find((event) => event.id === "ev_npc_miner");
  for (const page of miner?.pages ?? []) page.movement = { type: "fixed", speed: 3, frequency: 3 };
  return project;
}

async function waitForHooks(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const hooked = window as unknown as { __oprnDebug?: { teleport?: unknown; giveItem?: unknown } };
      return typeof hooked.__oprnDebug?.teleport === "function" && typeof hooked.__oprnDebug?.giveItem === "function";
    },
    undefined,
    { timeout: 30_000 },
  );
}

async function friendship(page: Page): Promise<number> {
  return page.evaluate(() => {
    const state = (window as unknown as { __oprnDebug: { readState: () => { friendship: Record<string, number> } } })
      .__oprnDebug.readState();
    return state.friendship.char_miner ?? 0;
  });
}

test("광부에게 좋아하는 선물을 주면 전용 반응과 호감도 상승이 적용된다", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectForEditor(page, projectWithStationaryMiner());
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 30_000 });
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 30_000 });
  await waitForHooks(page);

  await page.evaluate(([mapId]) => {
    const hooked = window as unknown as {
      __oprnDebug: {
        teleport: (targetMapId: string, x: number, y: number) => void;
        giveItem: (itemId: string, amount: number) => void;
      };
      __oprnInput: { face: (direction: string) => void };
    };
    hooked.__oprnDebug.giveItem("item_iron_ore", 1);
    hooked.__oprnDebug.teleport(mapId, 2, 8);
    hooked.__oprnInput.face("down");
  }, [MAP_ID] as const);
  await page.waitForTimeout(300);
  expect(await friendship(page)).toBe(0);

  await tapKey(page, "Space", 260);
  const choices = page.locator(".choice-btn");
  await expect(choices).toHaveCount(3);
  await choices.nth(1).click();
  await expect(page.getByTestId("gift-scene")).toBeVisible();
  await page.getByTestId("gift-item-item_iron_ore").click();

  await expect(page.getByTestId("dialogue-box")).toContainText("결이 좋은 광석이군. 정말 고마워!");
  await expect.poll(() => friendship(page)).toBe(80);
  await page.screenshot({ path: `${EVIDENCE_DIR}/resident-loved-gift.png` });
});
