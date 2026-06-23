import { expect, test } from "@playwright/test";
import {
  EDITOR_OVERLAP_PAIRS,
  captureEditorViewport,
  closeMenu,
  dismissDialogue,
  enterDungeon,
  expectCanvasHasPixels,
  expectPlayCanvasLogicalSurface,
  importResource,
  importSampleProject,
  openEveryDatabaseTab,
  openMenu,
  runtimeState,
  visitInterior,
  winBattle,
} from "./rm2k3-final-manual-helpers";

test.setTimeout(90_000);

test("final manual QA covers RM2K3 editor surfaces and sample game end to end", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await importSampleProject(page);
  await captureEditorViewport({ page, testInfo, name: "desktop-editor", overlapPairs: EDITOR_OVERLAP_PAIRS });

  await openEveryDatabaseTab(page);
  await importResource(page);
  await page.screenshot({ path: testInfo.outputPath("desktop-database-resources.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await captureEditorViewport({ page, testInfo, name: "compact-editor", overlapPairs: [] });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("title-screen.png"), fullPage: true });
  await page.getByTestId("title-new-game").click();
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe("map_town");
  await expectCanvasHasPixels(page, "play-canvas");
  await expectPlayCanvasLogicalSurface(page, testInfo);

  await page.getByTestId("event-town-npc").click();
  await page.getByRole("button", { name: /Yes/ }).click();
  await dismissDialogue(page, "Find the switch east of town.");
  await page.getByTestId("event-switch-puzzle").click();
  await dismissDialogue(page, "A gate opens in the hills.");
  await expect.poll(async () => (await runtimeState(page)).switches.sw_gate_open).toBe(true);
  await expect.poll(async () => (await runtimeState(page)).switches.sw_blessed).toBe(true);
  await expect(page.getByTestId("picture-layer")).toContainText("pic_gate:sample_picture_gate");
  await page.screenshot({ path: testInfo.outputPath("town-puzzle-complete.png"), fullPage: true });

  await visitInterior(page);
  await page.getByTestId("event-save-point").click();
  await dismissDialogue(page, "Save here before entering the dungeon.");
  await openMenu(page);
  await page.getByTestId("save-slot-1").click();
  await expect(page.getByTestId("main-menu")).toContainText("1번 저장 칸에 저장했습니다");
  await closeMenu(page);

  await enterDungeon(page);
  await winBattle(page, testInfo.outputPath("battle-scene.png"));
  await expect.poll(async () => (await runtimeState(page)).switches.sw_battle_won).toBe(true);
  await openMenu(page);
  await page.getByTestId("load-slot-1").click();
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe("map_town");
  await expect.poll(async () => (await runtimeState(page)).switches.sw_battle_won).toBeFalsy();

  await enterDungeon(page);
  await winBattle(page);
  await page.getByTestId("event-battle-start").click();
  await dismissDialogue(page, "The slime is gone. Use the portal.");
  await page.getByTestId("event-ending-portal").click();
  await expect(page.getByTestId("ending-screen")).toBeVisible();
  await expect(page.getByTestId("ending-screen")).toContainText("T14 sample complete.");
  await page.screenshot({ path: testInfo.outputPath("ending-screen.png"), fullPage: true });
});
