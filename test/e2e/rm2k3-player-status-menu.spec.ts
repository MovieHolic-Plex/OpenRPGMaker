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
  // 명령 패널 전 항목 + 스크린샷 캡처를 순회하는 롱 스펙 — swiftshader에서 30초 기본 한도를 넘는다.
  test.setTimeout(90_000);
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
  expect(await statusMenuCommandsFullyVisible(page)).toBe(true);
  await expect(page.getByTestId("status-menu-command-save")).toBeVisible();
  await expect(page.getByTestId("status-menu-command-to-title")).toBeVisible();
  await expectClassicStatusMenuGone(page);
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
  await expect(page.getByTestId("status-menu-command-rail")).toBeVisible();
  await expect(page.getByTestId("status-menu-detail")).toContainText("회복약");
  await expect(page.getByTestId("status-menu-detail")).toContainText("2개");
  await screenshotMenu(page, COMMAND_SCREENSHOTS.items);

  await selectCommand(page, "skills", "스킬");
  await expect(page.getByTestId("status-menu-detail")).toContainText("주인공");
  await page.getByTestId("status-menu-skill-actor-actor_hero").click();
  await expect(page.getByTestId("status-menu-detail-title")).toContainText("스킬: 주인공");
  await expect(page.getByTestId("status-menu-detail")).toContainText("공격");
  expect(await detailRowsStayInsidePanel(page)).toBe(true);
  await screenshotMenu(page, COMMAND_SCREENSHOTS.skills);

  await selectCommand(page, "equipment", "장비");
  await page.getByTestId("status-menu-equipment-actor-actor_hero").click();
  await expect(page.getByTestId("status-menu-detail")).toContainText("무기");
  await expect(page.getByTestId("status-menu-detail")).toContainText("청동 검");
  await page.getByTestId("status-menu-equipment-slot-weapon").click();
  await expect(page.getByTestId("status-menu-detail")).toContainText(/공격|방어|정신|민첩/);
  await screenshotMenu(page, COMMAND_SCREENSHOTS.equipment);

  await selectCommand(page, "status", "상태");
  await expect(page.getByTestId("status-menu-detail")).toContainText(/HP \d+\/\d+/);
  await expect(page.getByTestId("status-menu-detail")).toContainText(/MP \d+\/\d+/);
  await screenshotMenu(page, COMMAND_SCREENSHOTS.status);

  await selectCommand(page, "row", "열");
  await expect(page.getByTestId("status-menu-detail")).toContainText("전열");
  await screenshotMenu(page, COMMAND_SCREENSHOTS.row);

  await selectCommand(page, "formation", "진형");
  await expect(page.getByTestId("status-menu-detail")).toContainText("1.");
  await page.getByTestId("status-menu-formation-actor-actor_guardian").click();
  await expect(page.getByTestId("status-menu-detail")).toContainText("이동 중");
  await expect(page.getByTestId("status-menu-formation-move-up")).toHaveCount(0);
  await expect(page.getByTestId("status-menu-formation-move-down")).toHaveCount(0);
  await screenshotMenu(page, COMMAND_SCREENSHOTS.formation);

  await selectCommand(page, "save", "저장");
  await expect(page.getByTestId("save-slot-1")).toContainText("1번 저장");
  await expect(page.getByTestId("save-slot-1")).toContainText("비어 있음");
  await expect(page.getByTestId("save-slot-1")).toHaveClass(/selected/);
  await expect(page.getByTestId("status-menu-classic-save-party-faces")).toHaveCount(0);
  await screenshotMenu(page, COMMAND_SCREENSHOTS.save);

  await selectCommand(page, "load", "로드");
  await expect(page.getByTestId("load-slot-1")).toContainText("비어 있음");

  await selectCommand(page, "quests", "임무");
  await expect(page.getByTestId("status-menu-detail")).toContainText("등록된 임무가 없습니다");

  await selectCommand(page, "wait", "대기");
  await expect(page.getByTestId("status-menu-detail")).toContainText("대기 방식을 OFF로 전환했습니다");
  await expect(page.getByTestId("status-menu-command-wait")).toContainText("대기 OFF");
  await screenshotMenu(page, COMMAND_SCREENSHOTS.wait);

  await expectClassicStatusMenuGone(page);
  await menu.screenshot({ path: C001_SCREENSHOT });
});

test("status menu layout keeps actor faces and detail rows readable at compact viewport", async ({ page }) => {
  await startActualPlay(page);
  await page.setViewportSize({ width: 800, height: 760 });

  await page.keyboard.press("X");
  await expect(page.getByTestId("main-menu")).toBeVisible();
  expect(await statusMenuCommandsFullyVisible(page)).toBe(true);
  expect(await partyRowsKeepFacesClearOfText(page)).toBe(true);
  expect(await statusMenuUsesWindowFillInsteadOfSystemSheet(page)).toBe(true);
  expect(await statusMenuUsesRuntimeWindowChrome(page)).toBe(true);
  expect(await statusMenuCommandRailUsesLeftColumn(page)).toBe(true);

  await selectCommand(page, "status", "상태");
  expect(await detailRowsStayInsidePanel(page)).toBe(true);
  expect(await importantStatusMenuTextFits(page)).toEqual([]);

  await mkdir("evidence/browser-screenshots", { recursive: true });
  await page.getByTestId("main-menu").screenshot({
    path: "evidence/browser-screenshots/rm2k3-status-menu-compact-layout.png",
  });
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
    const panel = document.querySelector<HTMLElement>("[data-testid='status-menu-detail']");
    if (!panel) return false;
    const panelRect = panel.getBoundingClientRect();
    const tolerance = 1;
    const rows = Array.from(panel.querySelectorAll<HTMLElement>(".status-menu-detail-row"));
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

async function statusMenuCommandsFullyVisible(page: Page): Promise<boolean> {
  return page.evaluate((expectedCount) => {
    const rail = document.querySelector<HTMLElement>("[data-testid='status-menu-command-rail']");
    if (!rail) return false;
    const railRect = rail.getBoundingClientRect();
    const buttons = Array.from(rail.querySelectorAll<HTMLElement>("[data-testid^='status-menu-command-']"));
    if (buttons.length !== expectedCount) return false;
    const tolerance = 1;
    return buttons.every((button) => {
      const rect = button.getBoundingClientRect();
      return button.offsetParent !== null
        && rect.height > 0
        && rect.top >= railRect.top - tolerance
        && rect.bottom <= railRect.bottom + tolerance;
    });
  }, COMMAND_LABELS.length);
}

async function importantStatusMenuTextFits(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const menu = document.querySelector<HTMLElement>("[data-testid='main-menu']");
    if (!menu) return ["missing main menu"];
    return Array.from(menu.querySelectorAll<HTMLElement>([
      ".status-menu-command",
      ".status-menu-actor-name",
      ".status-menu-actor-subline",
      ".status-menu-actor-vitals",
      ".status-menu-detail-label",
      ".status-menu-detail-value",
      ".status-menu-detail-description",
    ].join(",")))
      .filter((node) => node.offsetParent !== null && node.textContent?.trim())
      .filter((node) => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1)
      .map((node) => node.textContent?.trim() ?? node.className);
  });
}

async function expectClassicStatusMenuGone(page: Page): Promise<void> {
  await expect(page.locator("[data-testid^='status-menu-classic-']")).toHaveCount(0);
  await expect(page.locator("[data-testid^='status-menu-fullscreen-']")).toHaveCount(0);
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
