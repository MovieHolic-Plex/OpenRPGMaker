import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { startActualPlay } from "./oprnPlayerStatusMenuHelpers";

const EVIDENCE_DIR = "output/evidence/status-menu-edge-dock";

test("ESC menu keeps gameplay visible around a horizontal edge dock", async ({ page }) => {
  // Break caught: legacy full-screen window chrome or a left command column consumes the play field.
  test.setTimeout(120_000);
  await startActualPlay(page);
  await page.keyboard.press("x");
  await expect(page.getByTestId("main-menu")).toBeVisible();

  const mainGeometry = await edgeDockGeometry(page);
  expect(mainGeometry.menuBackground).toBe("rgba(0, 0, 0, 0)");
  expect(mainGeometry.menuBorderImage).toBe("none");
  expect(mainGeometry.railIsHorizontal).toBe(true);
  expect(mainGeometry.railIsBottomAnchored).toBe(true);
  expect(mainGeometry.partyIsHorizontal).toBe(true);
  expect(mainGeometry.partyIsTopAnchored).toBe(true);
  expect(mainGeometry.detailIsDisclosed).toBe(false);

  await page.getByTestId("status-menu-command-party-menu").click();
  await expect(page.getByTestId("status-menu-detail")).toHaveAttribute(
    "data-status-menu-presentation",
    "context-tray",
  );
  const trayGeometry = await contextTrayGeometry(page);
  expect(trayGeometry.isHorizontal).toBe(true);
  expect(trayGeometry.sitsAboveDock).toBe(true);
  expect(trayGeometry.actionCount).toBe(4);

  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.getByTestId("play-stage").screenshot({
    path: `${EVIDENCE_DIR}/party-context-tray.png`,
  });

  await page.keyboard.press("Escape");
  await page.getByTestId("status-menu-command-system-menu").click();
  for (const commandId of ["save", "load", "wait", "to-title"]) {
    await expect(page.getByTestId(`status-menu-group-command-${commandId}`)).toBeVisible();
  }
  await expect(page.getByTestId("status-menu-group-command-to-title")).toHaveClass(/destructive/);
  await expect(page.getByTestId("status-menu-group-command-to-title")).toHaveAttribute(
    "aria-label",
    /미저장 진행 삭제/,
  );
  await page.getByTestId("status-menu-group-command-to-title").click();
  await expect(page.getByTestId("main-menu")).toBeVisible();
  await expect(page.getByTestId("status-menu-confirm-to-title")).toBeVisible();
  await expect(page.getByTestId("status-menu-detail")).toHaveAttribute(
    "data-status-menu-presentation",
    "confirmation-card",
  );
  expect(await page.getByTestId("status-menu-detail").evaluate((node) => {
    const menu = document.querySelector<HTMLElement>("[data-testid='main-menu']");
    if (!menu) return 1;
    return node.getBoundingClientRect().height / menu.getBoundingClientRect().height;
  })).toBeLessThan(0.34);
  await expect(page.getByTestId("title-screen")).toHaveCount(0);
  await page.getByTestId("play-stage").screenshot({
    path: `${EVIDENCE_DIR}/title-confirmation.png`,
  });

  await page.getByTestId("status-menu-confirm-to-title").click();
  await expect(page.getByTestId("title-screen")).toBeVisible();
});

async function edgeDockGeometry(page: Page): Promise<{
  readonly menuBackground: string;
  readonly menuBorderImage: string;
  readonly railIsHorizontal: boolean;
  readonly railIsBottomAnchored: boolean;
  readonly partyIsHorizontal: boolean;
  readonly partyIsTopAnchored: boolean;
  readonly detailIsDisclosed: boolean;
}> {
  return page.evaluate(() => {
    const menu = document.querySelector<HTMLElement>("[data-testid='main-menu']");
    const rail = document.querySelector<HTMLElement>("[data-testid='status-menu-command-rail']");
    const party = document.querySelector<HTMLElement>("[data-testid='status-menu-party']");
    const detail = document.querySelector<HTMLElement>("[data-testid='status-menu-detail']");
    if (!menu || !rail || !party || !detail) throw new Error("missing edge dock surface");
    const menuRect = menu.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    const partyRect = party.getBoundingClientRect();
    const menuStyle = getComputedStyle(menu);
    return {
      menuBackground: menuStyle.backgroundColor,
      menuBorderImage: menuStyle.borderImageSource,
      railIsHorizontal: railRect.width > railRect.height * 3,
      railIsBottomAnchored: railRect.top > menuRect.top + menuRect.height * 0.68,
      partyIsHorizontal: partyRect.width > partyRect.height * 3,
      partyIsTopAnchored: partyRect.bottom < menuRect.top + menuRect.height * 0.32,
      detailIsDisclosed: getComputedStyle(detail).visibility !== "hidden",
    };
  });
}

async function contextTrayGeometry(page: Page): Promise<{
  readonly actionCount: number;
  readonly isHorizontal: boolean;
  readonly sitsAboveDock: boolean;
}> {
  return page.evaluate(() => {
    const detail = document.querySelector<HTMLElement>("[data-testid='status-menu-detail']");
    const rail = document.querySelector<HTMLElement>("[data-testid='status-menu-command-rail']");
    if (!detail || !rail) throw new Error("missing tray or dock");
    const actions = Array.from(detail.querySelectorAll<HTMLElement>(".status-menu-detail-action"));
    const detailRect = detail.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    const rows = new Set(actions.map((action) => Math.round(action.getBoundingClientRect().top)));
    return {
      actionCount: actions.length,
      isHorizontal: rows.size === 1 && detailRect.width > detailRect.height * 2.5,
      sitsAboveDock: detailRect.bottom <= railRect.top + 1,
    };
  });
}
