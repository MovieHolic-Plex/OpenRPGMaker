import { expect, test } from "@playwright/test";
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
  expect(await isMenuInsidePlayStage(page)).toBe(true);
  expect(await doesMenuFillPlayStage(page)).toBe(true);

  await selectCommand(page, "items", "아이템");
  await expect(page.getByTestId("status-menu-command-rail")).toBeVisible();
  await expect(page.getByTestId("status-menu-party")).toBeVisible();
  await expect(page.getByTestId("status-menu-detail")).toContainText("회복약");
  await expect(page.getByTestId("status-menu-detail")).toContainText("2개");
  await screenshotMenu(page, COMMAND_SCREENSHOTS.items);
  await page.keyboard.press("X");
  await expect(page.getByTestId("status-menu-command-rail")).toBeVisible();

  await selectCommand(page, "skills", "스킬");
  await expect(page.getByTestId("status-menu-command-rail")).toBeVisible();
  await expect(page.getByTestId("status-menu-detail")).toContainText("주인공");
  await expect(page.getByTestId("status-menu-detail")).toContainText("공격");
  await screenshotMenu(page, COMMAND_SCREENSHOTS.skills);

  await selectCommand(page, "equipment", "장비");
  await expect(page.getByTestId("status-menu-detail")).toContainText("청동 검");
  await screenshotMenu(page, COMMAND_SCREENSHOTS.equipment);

  await selectCommand(page, "status", "상태");
  await expect(page.getByTestId("status-menu-detail")).toContainText("HP");
  await screenshotMenu(page, COMMAND_SCREENSHOTS.status);

  await selectCommand(page, "row", "열");
  await expect(page.getByTestId("status-menu-detail")).toContainText("전열");
  await screenshotMenu(page, COMMAND_SCREENSHOTS.row);

  await selectCommand(page, "formation", "진형");
  await expect(page.getByTestId("status-menu-detail")).toContainText("1.");
  for (const actorId of ["actor_hero", "actor_guardian", "actor_mage", "actor_scout"]) {
    const formationFace = page.getByTestId(`status-menu-formation-face-${actorId}`);
    await expect(formationFace).toBeVisible();
    await expect(formationFace).not.toHaveClass(/missing/);
  }
  await screenshotMenu(page, COMMAND_SCREENSHOTS.formation);

  await selectCommand(page, "save", "저장");
  await expect(page.getByTestId("status-menu-detail")).toContainText("1번 저장");
  await screenshotMenu(page, COMMAND_SCREENSHOTS.save);

  await selectCommand(page, "wait", "대기");
  await expect(page.getByTestId("status-menu-detail")).toContainText("대기 방식을 OFF로 전환했습니다");
  await expect(page.getByTestId("status-menu-command-wait")).toContainText("대기 OFF");
  await screenshotMenu(page, COMMAND_SCREENSHOTS.wait);

  await menu.screenshot({ path: C001_SCREENSHOT });
});

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
