import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import {
  C001_SCREENSHOT,
  C003_SCREENSHOT,
  COMMAND_LABELS,
  COMMAND_SCREENSHOTS,
  doesMenuFillPlayStage,
  isMenuInsidePlayStage,
  openTestPlayWindow,
  saveSnapshot,
  screenshotMenu,
  seedDefaultProject,
  selectCommand,
  startActualPlay,
} from "./rm2k3PlayerStatusMenuHelpers";

test("Korean command panels work from the X-key actual play menu", async ({ page }) => {
  await startActualPlay(page);

  await page.keyboard.press("X");
  const menu = page.getByTestId("main-menu");
  await expect(menu).toBeVisible();
  await expect(menu).toHaveClass(/rm2k3-status-menu/);
  await expect(page.getByTestId("status-menu-gold")).toHaveText("돈 0G");
  await expect(page.getByTestId("status-menu-time")).toBeVisible();
  await expect(page.getByTestId("status-menu-slots")).toHaveCount(0);
  for (const [commandId, label] of COMMAND_LABELS) {
    await expect(page.getByTestId(`status-menu-command-${commandId}`)).toHaveText(label);
  }
  await expect(page.getByTestId("status-menu-command-save")).toBeVisible();
  await expect(page.getByTestId("status-menu-command-to-title")).toBeVisible();
  for (let index = 0; index < 4; index += 1) {
    const row = page.getByTestId(`status-menu-party-row-${index}`);
    await expect(row).toBeVisible();
    const face = page.getByTestId(`status-menu-face-${index}`);
    await expect(face).toBeVisible();
    await expect(face).not.toHaveClass(/missing/);
    await expect(face).not.toHaveText("Face");
    await expect(row).toContainText(/HP \d+\/\d+/);
    await expect(row).toContainText(/MP \d+\/\d+/);
  }
  expect(await partyRowsKeepFacesClearOfText(page)).toBe(true);
  expect(await statusMenuUsesWindowFillInsteadOfSystemSheet(page)).toBe(true);
  expect(await statusMenuUsesRuntimeWindowChrome(page)).toBe(true);
  expect(await statusMenuCommandRailUsesLeftColumn(page)).toBe(true);
  expect(await isMenuInsidePlayStage(page)).toBe(true);
  expect(await doesMenuFillPlayStage(page)).toBe(true);

  await selectCommand(page, "items", "아이템");
  await expect(page.getByTestId("status-menu-command-rail")).toHaveCount(0);
  await expect(page.getByTestId("status-menu-fullscreen-items")).toContainText("회복약");
  await expect(page.getByTestId("status-menu-fullscreen-items")).toContainText("2개");
  await screenshotMenu(page, COMMAND_SCREENSHOTS.items);
  await page.keyboard.press("X");
  await expect(page.getByTestId("status-menu-command-rail")).toBeVisible();

  await selectCommand(page, "skills", "스킬");
  await expect(page.getByTestId("status-menu-fullscreen-skills")).toContainText("주인공");
  await expect(page.getByTestId("status-menu-classic-actor-select-skills")).toBeVisible();
  await page.getByTestId("status-menu-skill-actor-actor_hero").click();
  await expect(page.getByTestId("status-menu-fullscreen-skills")).toContainText("공격");
  expect(await detailRowsStayInsidePanel(page)).toBe(true);
  await screenshotMenu(page, COMMAND_SCREENSHOTS.skills);

  await selectCommand(page, "equipment", "장비");
  await expect(page.getByTestId("status-menu-classic-actor-select-equipment")).toBeVisible();
  await page.getByTestId("status-menu-equipment-actor-actor_hero").click();
  await expect(page.getByTestId("status-menu-fullscreen-equipment")).toContainText("청동 검");
  await expect(page.getByTestId("status-menu-fullscreen-equipment")).toContainText(/ATK|DEF|INT|AGI/);
  await screenshotMenu(page, COMMAND_SCREENSHOTS.equipment);

  await selectCommand(page, "status", "상태");
  await expect(page.getByTestId("status-menu-fullscreen-status")).toContainText("HP");
  await screenshotMenu(page, COMMAND_SCREENSHOTS.status);

  await selectCommand(page, "row", "열");
  await expect(page.getByTestId("status-menu-fullscreen-row")).toContainText("전열");
  await expect(page.getByTestId("status-menu-fullscreen-row")).toContainText("전투");
  await screenshotMenu(page, COMMAND_SCREENSHOTS.row);

  await selectCommand(page, "formation", "진형");
  await expect(page.getByTestId("status-menu-fullscreen-formation")).toContainText("1.");
  await expect(page.getByTestId("status-menu-fullscreen-formation").getByTestId("status-menu-entry-icon").first()).toBeVisible();
  await expect(page.getByTestId("status-menu-formation-move-up")).toHaveCount(0);
  await expect(page.getByTestId("status-menu-formation-move-down")).toHaveCount(0);
  await screenshotMenu(page, COMMAND_SCREENSHOTS.formation);

  await selectCommand(page, "save", "저장");
  await expect(page.getByTestId("status-menu-fullscreen-save")).toContainText("1번 슬롯");
  await screenshotMenu(page, COMMAND_SCREENSHOTS.save);

  await selectCommand(page, "wait", "대기");
  await expect(page.getByTestId("status-menu-detail")).toContainText("대기 방식을 OFF로 전환했습니다");
  await expect(page.getByTestId("status-menu-command-wait")).toContainText("대기 OFF");
  await screenshotMenu(page, COMMAND_SCREENSHOTS.wait);

  await menu.screenshot({ path: C001_SCREENSHOT });
});

test("status menu layout keeps actor faces and detail rows readable at compact viewport", async ({ page }) => {
  await startActualPlay(page);
  await page.setViewportSize({ width: 800, height: 760 });

  await page.keyboard.press("X");
  await expect(page.getByTestId("main-menu")).toBeVisible();
  expect(await partyRowsKeepFacesClearOfText(page)).toBe(true);
  expect(await statusMenuUsesWindowFillInsteadOfSystemSheet(page)).toBe(true);
  expect(await statusMenuUsesRuntimeWindowChrome(page)).toBe(true);
  expect(await statusMenuCommandRailUsesLeftColumn(page)).toBe(true);

  await selectCommand(page, "skills", "스킬");
  expect(await detailRowsStayInsidePanel(page)).toBe(true);

  await mkdir("evidence/browser-screenshots", { recursive: true });
  await page.getByTestId("main-menu").screenshot({
    path: "evidence/browser-screenshots/rm2k3-status-menu-compact-layout.png",
  });
});

test("status menu commands open RPG 2003 style full-screen function scenes", async ({ page }) => {
  await startActualPlay(page);

  await page.keyboard.press("X");
  await expect(page.getByTestId("main-menu")).toBeVisible();

  await openFunctionScene(page, "items");
  await expect(page.getByTestId("status-menu-command-rail")).toHaveCount(0);
  await expect(page.getByTestId("status-menu-fullscreen-items")).toBeVisible();
  await expect(page.getByTestId("status-menu-fullscreen-items").getByTestId("status-menu-entry-icon").first()).toBeVisible();
  await expect(page.getByTestId("status-menu-fullscreen-items").getByTestId("status-menu-entry-effect").first()).toBeVisible();
  await expect(page.getByTestId("status-menu-fullscreen-items").getByTestId("status-menu-entry-performance").first()).toBeVisible();
  await page.keyboard.press("X");
  await expect(page.getByTestId("status-menu-command-rail")).toBeVisible();

  await openFunctionScene(page, "skills");
  await page.getByTestId("status-menu-skill-actor-actor_hero").click();
  await expect(page.getByTestId("status-menu-fullscreen-skills").getByTestId("status-menu-entry-effect").first()).toBeVisible();
  await expect(page.getByTestId("status-menu-fullscreen-skills").getByTestId("status-menu-entry-performance").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("status-menu-command-rail")).toBeVisible();

  await openFunctionScene(page, "equipment");
  await page.getByTestId("status-menu-equipment-actor-actor_hero").click();
  await expect(page.getByTestId("status-menu-fullscreen-equipment").getByTestId("status-menu-entry-icon").first()).toBeVisible();
  await expect(page.getByTestId("status-menu-fullscreen-equipment").getByTestId("status-menu-entry-performance").first()).toContainText(/\+/);
  await expect(page.getByTestId("status-menu-fullscreen-equipment")).toContainText(/ATK|DEF|INT|AGI/);
  await page.keyboard.press("X");

  await openFunctionScene(page, "status");
  await expect(page.getByTestId("status-menu-fullscreen-status")).toContainText("HP");
  await expect(page.getByTestId("status-menu-fullscreen-status")).toContainText("MP");
  await page.keyboard.press("X");

  await openFunctionScene(page, "row");
  await expect(page.getByTestId("status-menu-fullscreen-row")).toContainText(/전열|후열/);
  await expect(page.getByTestId("status-menu-fullscreen-row")).toContainText("전투");
  await page.keyboard.press("X");

  await openFunctionScene(page, "save");
  await expect(page.getByTestId("status-menu-fullscreen-save")).toBeVisible();
  await expect(page.getByTestId("save-slot-1")).toBeVisible();
  await page.keyboard.press("X");

  await openFunctionScene(page, "load");
  await expect(page.getByTestId("status-menu-fullscreen-load")).toBeVisible();
  await expect(page.getByTestId("load-slot-1")).toBeVisible();
});

test("function scenes follow the RPG 2003 reference menu flow", async ({ page }) => {
  await startActualPlay(page);
  await page.keyboard.press("X");

  await openFunctionScene(page, "items");
  await expect(page.getByTestId("status-menu-classic-items")).toBeVisible();
  await expect(page.getByTestId("status-menu-classic-description")).toBeVisible();
  await expect(page.getByTestId("status-menu-classic-item-grid")).toBeVisible();
  await expect(page.getByTestId("status-menu-entry-icon").first()).toBeVisible();
  expect(await hasAtLeastTwoColumns(page, "status-menu-classic-item-grid")).toBe(true);
  await page.keyboard.press("X");

  await openFunctionScene(page, "skills");
  await expect(page.getByTestId("status-menu-classic-actor-select-skills")).toBeVisible();
  await page.getByTestId("status-menu-skill-actor-actor_hero").click();
  await expect(page.getByTestId("status-menu-classic-skill-detail")).toBeVisible();
  await expect(page.getByTestId("status-menu-classic-actor-strip")).toContainText("HP");
  await expect(page.getByTestId("status-menu-classic-skill-list")).toBeVisible();
  await page.keyboard.press("X");

  await openFunctionScene(page, "equipment");
  await expect(page.getByTestId("status-menu-classic-actor-select-equipment")).toBeVisible();
  await page.getByTestId("status-menu-equipment-actor-actor_hero").click();
  await expect(page.getByTestId("status-menu-classic-equipment-detail")).toBeVisible();
  await expect(page.getByTestId("status-menu-classic-equipment-stats")).toContainText(/ATK|공격/);
  await expect(page.getByTestId("status-menu-classic-equipment-slots")).toContainText(/Weapon|무기/);
  await expect(page.getByTestId("status-menu-classic-equipment-list")).toBeVisible();
  await page.keyboard.press("X");

  await openFunctionScene(page, "save");
  await expect(page.getByTestId("status-menu-classic-save")).toBeVisible();
  await expect(page.getByTestId("status-menu-classic-save-prompt")).toContainText("Save");
  await expect(page.getByTestId("status-menu-classic-save-slot-1")).toBeVisible();
  await expect(page.getByTestId("status-menu-classic-save-party-faces").first()).toBeVisible();
  await page.keyboard.press("X");

  await openFunctionScene(page, "status");
  await expect(page.getByTestId("status-menu-classic-status")).toBeVisible();
  await expect(page.getByTestId("status-menu-classic-status-left")).toContainText("Name");
  await expect(page.getByTestId("status-menu-classic-status-vitals")).toContainText("HP");
  await expect(page.getByTestId("status-menu-classic-status-equipment")).toContainText(/Weapon|무기/);
  await page.keyboard.press("X");

  await openFunctionScene(page, "row");
  await expect(page.getByTestId("status-menu-classic-row")).toBeVisible();
  await expect(page.getByTestId("status-menu-classic-row")).toContainText(/전열|후열/);
  await page.keyboard.press("X");

  await openFunctionScene(page, "formation");
  await expect(page.getByTestId("status-menu-classic-formation")).toBeVisible();
  await expect(page.getByTestId("status-menu-classic-formation")).toContainText(/순서|Order|Formation/);
  await expect(page.getByTestId("status-menu-formation-move-up")).toHaveCount(0);
  await expect(page.getByTestId("status-menu-formation-move-down")).toHaveCount(0);
});

test("captures full-screen status command screenshot evidence", async ({ page }) => {
  await mkdir("evidence/browser-screenshots/status-menu-fullscreen", { recursive: true });
  await startActualPlay(page);

  await page.keyboard.press("X");
  for (const commandId of ["items", "skills", "equipment", "status", "row", "formation", "save", "load"]) {
    await openFunctionScene(page, commandId);
    await expect(page.getByTestId(`status-menu-fullscreen-${commandId}`)).toBeVisible();
    await page.screenshot({
      path: `evidence/browser-screenshots/status-menu-fullscreen/${commandId}.png`,
    });
    await page.getByTestId("main-menu").screenshot({
      path: `evidence/browser-screenshots/status-menu-fullscreen/menu-only-${commandId}.png`,
    });
    if (commandId === "skills") {
      await page.getByTestId("status-menu-skill-actor-actor_hero").click();
      await expect(page.getByTestId("status-menu-classic-skill-detail")).toBeVisible();
      await page.screenshot({
        path: "evidence/browser-screenshots/status-menu-fullscreen/skills-detail.png",
      });
      await page.getByTestId("main-menu").screenshot({
        path: "evidence/browser-screenshots/status-menu-fullscreen/menu-only-skills-detail.png",
      });
    }
    if (commandId === "equipment") {
      await page.getByTestId("status-menu-equipment-actor-actor_hero").click();
      await expect(page.getByTestId("status-menu-classic-equipment-detail")).toBeVisible();
      await page.screenshot({
        path: "evidence/browser-screenshots/status-menu-fullscreen/equipment-detail.png",
      });
      await page.getByTestId("main-menu").screenshot({
        path: "evidence/browser-screenshots/status-menu-fullscreen/menu-only-equipment-detail.png",
      });
    }
    if (commandId === "formation") {
      await expect(page.getByTestId("status-menu-formation-move-up")).toHaveCount(0);
      await expect(page.getByTestId("status-menu-formation-move-down")).toHaveCount(0);
      await page.getByTestId("status-menu-formation-actor-actor_guardian").click();
      await expect(page.getByTestId("status-menu-formation-move-up")).toHaveCount(0);
      await expect(page.getByTestId("status-menu-formation-move-down")).toHaveCount(0);
      await page.getByTestId("main-menu").screenshot({
        path: "evidence/browser-screenshots/status-menu-fullscreen/menu-only-formation-selected.png",
      });
    }
    await page.keyboard.press("X");
    await expect(page.getByTestId("status-menu-command-rail")).toBeVisible();
  }
});

async function partyRowsKeepFacesClearOfText(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-testid^='status-menu-party-row-']"));
    const tolerance = 1;
    return rows.every((row) => {
      const face = row.querySelector<HTMLElement>(".status-menu-face");
      const info = row.querySelector<HTMLElement>(".status-menu-party-info");
      if (!face || !info) return false;
      const faceRect = face.getBoundingClientRect();
      const infoRect = info.getBoundingClientRect();
      return faceRect.right <= infoRect.left + tolerance;
    });
  });
}

async function detailRowsStayInsidePanel(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>("[data-testid='status-menu-detail']")
      ?? document.querySelector<HTMLElement>(".status-menu-fullscreen-scene");
    if (!panel) return false;
    const panelRect = panel.getBoundingClientRect();
    const tolerance = 1;
    const rows = Array.from(panel.querySelectorAll<HTMLElement>([
      ".status-menu-detail-row",
      ".status-menu-scene-row",
      ".status-menu-classic-item",
      ".status-menu-classic-skill-row",
      ".status-menu-classic-equipment-item",
      ".status-menu-classic-equipment-slot",
      ".status-menu-classic-save-slot",
      ".status-menu-classic-actor-row",
      ".status-menu-classic-formation-row",
    ].join(", ")));
    if (rows.length === 0) return false;
    return rows.every((row) => {
      const rowRect = row.getBoundingClientRect();
      return rowRect.left >= panelRect.left - tolerance && rowRect.right <= panelRect.right + tolerance;
    });
  });
}

async function statusMenuUsesWindowFillInsteadOfSystemSheet(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const menu = document.querySelector<HTMLElement>("[data-testid='main-menu']");
    if (!menu) return false;
    const backgroundImage = window.getComputedStyle(menu).backgroundImage;
    return !backgroundImage.includes("url(");
  });
}

async function statusMenuUsesRuntimeWindowChrome(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const firstCommand = document.querySelector<HTMLElement>("[data-testid='status-menu-command-items']");
    const selectedCommand = document.querySelector<HTMLElement>(".status-menu-command.selected");
    const detail = document.querySelector<HTMLElement>("[data-testid='status-menu-detail']");
    if (!firstCommand || !selectedCommand || !detail) return false;
    const firstStyle = window.getComputedStyle(firstCommand);
    const selectedStyle = window.getComputedStyle(selectedCommand);
    const detailStyle = window.getComputedStyle(detail);
    const isEditorButton = firstStyle.backgroundColor === "rgb(248, 245, 236)" || firstStyle.color === "rgb(35, 35, 35)";
    const hasWindowPanel = detailStyle.backgroundImage.includes("linear-gradient");
    const hasSelectedRuntimeFill = selectedStyle.backgroundImage.includes("linear-gradient")
      || selectedStyle.backgroundColor === "rgb(57, 125, 221)";
    return !isEditorButton && hasWindowPanel && hasSelectedRuntimeFill;
  });
}

async function statusMenuCommandRailUsesLeftColumn(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>("[data-testid='status-menu-command-rail']");
    const body = document.querySelector<HTMLElement>("[data-testid='status-menu-body']");
    if (!rail || !body) return false;
    const railRect = rail.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const tolerance = 1;
    return railRect.right <= bodyRect.left + tolerance && railRect.height > railRect.width;
  });
}

async function hasAtLeastTwoColumns(page: Page, testId: string): Promise<boolean> {
  return page.evaluate((id) => {
    const grid = document.querySelector<HTMLElement>(`[data-testid='${id}']`);
    if (!grid) return false;
    const children = Array.from(grid.children).filter((node): node is HTMLElement => node instanceof HTMLElement);
    if (children.length < 2) return false;
    return Math.abs(children[0].getBoundingClientRect().top - children[1].getBoundingClientRect().top) <= 2;
  }, testId);
}

async function openFunctionScene(page: Page, commandId: string): Promise<void> {
  if ((await page.getByTestId("status-menu-command-rail").count()) === 0) {
    await page.keyboard.press("X");
    await expect(page.getByTestId("status-menu-command-rail")).toBeVisible();
  }
  await page.getByTestId(`status-menu-command-${commandId}`).click();
}

test("does not open status menu on title screen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedDefaultProject(page);
  await openTestPlayWindow(page);
  await expect(page.getByTestId("title-screen")).toBeVisible();

  await page.keyboard.press("X");

  await expect(page.getByTestId("main-menu")).toHaveCount(0);
  await expect(page.getByTestId("title-screen")).toBeVisible();
});

test("saves and closes from the status menu", async ({ page }) => {
  await startActualPlay(page);

  await page.keyboard.press("X");
  await expect(page.getByTestId("main-menu")).toBeVisible();
  await page.getByTestId("status-menu-command-save").click();
  await expect(page.getByTestId("status-menu-detail-title")).toContainText("저장");
  await page.getByTestId("save-slot-1").click();
  await expect(page.getByTestId("status-menu-message")).toContainText("1번 저장 칸에 저장했습니다");
  const snapshot = await saveSnapshot(page, 1);
  expect(snapshot.session.actorRows.actor_hero).toBe("front");
  expect(snapshot.session.partyActorIds).toEqual(["actor_hero", "actor_guardian", "actor_mage", "actor_scout"]);
  expect(snapshot.session.actorEquipment.actor_hero?.weapon).toBe("equip_sword");
  await page.getByTestId("main-menu").screenshot({ path: C003_SCREENSHOT });

  await page.keyboard.press("X");
  await expect(page.getByTestId("status-menu-command-rail")).toBeVisible();
  await page.keyboard.press("X");
  await expect(page.getByTestId("main-menu")).toHaveCount(0);
  await expect(page.getByTestId("play-stage")).toBeVisible();

  await page.keyboard.press("X");
  await page.getByTestId("status-menu-command-to-title").click();
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await page.keyboard.press("X");
  await expect(page.getByTestId("main-menu")).toHaveCount(0);
});
