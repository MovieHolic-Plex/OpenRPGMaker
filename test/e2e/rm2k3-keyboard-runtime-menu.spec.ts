import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const EVIDENCE_DIR = ".omo/ulw-loop/npc-keyboard-natural";
const TITLE_SCREENSHOT = ".omo/ulw-loop/npc-keyboard-natural/title-keyboard.png";
const MENU_SCREENSHOT = ".omo/ulw-loop/npc-keyboard-natural/menu-keyboard.png";
const TITLE_LOG = ".omo/ulw-loop/npc-keyboard-natural/title-keyboard-action-log.json";
const MENU_LOG = ".omo/ulw-loop/npc-keyboard-natural/menu-keyboard-action-log.json";

type TitleSelectionState = {
  readonly selectedIndex: number;
};

type StatusMenuState = {
  readonly selectedCommand: string;
  readonly mode: "function" | "main";
};

type KeyboardLogEntry = {
  readonly key: string;
  readonly state: TitleSelectionState | StatusMenuState | { readonly scene: "play" | "closed" };
};

test("test play title and status menus are keyboard-only", async ({ page }, testInfo) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectFromSupabaseCanonical(page, createBlankProject(), "/?e2eVitals=1");
  await openTestPlayWindow(page);

  const titlePlacement = await titlePlacementState(page);
  expect(titlePlacement.titleLeft).toBe("50%");
  expect(titlePlacement.menuTop).toBe("49.1667%");

  const titleLog: KeyboardLogEntry[] = [
    { key: "initial", state: await titleSelectionState(page) },
  ];
  await page.keyboard.press("ArrowDown");
  titleLog.push({ key: "ArrowDown", state: await titleSelectionState(page) });
  await expect.poll(async () => (await titleSelectionState(page)).selectedIndex).toBe(1);

  await page.keyboard.press("ArrowUp");
  titleLog.push({ key: "ArrowUp", state: await titleSelectionState(page) });
  await expect.poll(async () => (await titleSelectionState(page)).selectedIndex).toBe(0);
  await page.screenshot({ path: TITLE_SCREENSHOT, fullPage: true });

  await page.keyboard.press("Enter");
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15000 });
  titleLog.push({ key: "Enter", state: { scene: "play" } });
  await writeFile(TITLE_LOG, `${JSON.stringify(titleLog, null, 2)}\n`, "utf8");
  await testInfo.attach("title-keyboard-action-log.json", {
    body: `${JSON.stringify(titleLog, null, 2)}\n`,
    contentType: "application/json",
  });

  const menuLog: KeyboardLogEntry[] = [];
  await page.keyboard.press("x");
  await expect(page.getByTestId("main-menu")).toBeVisible();
  menuLog.push({ key: "x", state: await statusMenuState(page) });

  await page.keyboard.press("ArrowDown");
  await expect.poll(async () => (await statusMenuState(page)).selectedCommand).toBe("skills");
  menuLog.push({ key: "ArrowDown", state: await statusMenuState(page) });

  await page.keyboard.press("ArrowDown");
  await expect.poll(async () => (await statusMenuState(page)).selectedCommand).toBe("equipment");
  menuLog.push({ key: "ArrowDown", state: await statusMenuState(page) });

  await page.keyboard.press("ArrowUp");
  await expect.poll(async () => (await statusMenuState(page)).selectedCommand).toBe("skills");
  menuLog.push({ key: "ArrowUp", state: await statusMenuState(page) });

  await page.keyboard.press("Enter");
  await expect.poll(async () => (await statusMenuState(page))).toEqual({
    selectedCommand: "skills",
    mode: "function",
  });
  menuLog.push({ key: "Enter", state: await statusMenuState(page) });
  await page.screenshot({ path: MENU_SCREENSHOT, fullPage: true });

  await page.keyboard.press("Escape");
  await expect.poll(async () => (await statusMenuState(page))).toEqual({
    selectedCommand: "skills",
    mode: "main",
  });
  menuLog.push({ key: "Escape", state: await statusMenuState(page) });

  await page.keyboard.press("x");
  await expect(page.getByTestId("main-menu")).toHaveCount(0);
  menuLog.push({ key: "x", state: { scene: "closed" } });
  await writeFile(MENU_LOG, `${JSON.stringify(menuLog, null, 2)}\n`, "utf8");
  await testInfo.attach("menu-keyboard-action-log.json", {
    body: `${JSON.stringify(menuLog, null, 2)}\n`,
    contentType: "application/json",
  });
});

async function openTestPlayWindow(page: Page): Promise<void> {
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15000 });
  await page.getByTestId("mode-play").click();
  const modal = page.getByTestId("test-play-window");
  await page.waitForTimeout(250);
  if (!(await modal.isVisible())) {
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("rpgzzu:test-play-window"));
    });
  }
  await expect(modal).toBeVisible({ timeout: 10000 });
  await expect(modal.getByTestId("title-screen")).toBeVisible({ timeout: 10000 });
}

async function titleSelectionState(page: Page): Promise<TitleSelectionState> {
  return readDebugJson<TitleSelectionState>(page, "title-selection-json");
}

async function statusMenuState(page: Page): Promise<StatusMenuState> {
  return readDebugJson<StatusMenuState>(page, "status-menu-debug-json");
}

async function titlePlacementState(page: Page): Promise<{
  readonly titleLeft: string;
  readonly menuTop: string;
}> {
  return page.evaluate(() => {
    const title = document.querySelector(".rm-title-screen-title");
    const menu = document.querySelector(".rm-title-menu");
    if (!(title instanceof HTMLElement) || !(menu instanceof HTMLElement)) {
      throw new Error("missing title screen placement nodes");
    }
    return { titleLeft: title.style.left, menuTop: menu.style.top };
  });
}

async function readDebugJson<T>(page: Page, testId: string): Promise<T> {
  const text = await page.getByTestId(testId).textContent();
  if (!text) throw new Error(`missing ${testId}`);
  return JSON.parse(text) as T;
}
