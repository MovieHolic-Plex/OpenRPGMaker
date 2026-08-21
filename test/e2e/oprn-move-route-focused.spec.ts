import { expect, test, type Page } from "@playwright/test";

test.setTimeout(60_000);

type ExportedMove = {
  readonly kind: string;
  readonly switchId?: string;
  readonly spriteId?: string;
  readonly resourceId?: string;
};

type ProjectExport = {
  readonly project: {
    readonly startMapId: string;
    readonly maps: Record<string, { readonly events: readonly { readonly pages?: readonly { readonly movement?: { readonly route?: { readonly moves: readonly ExportedMove[] } } }[] }[] }>;
  };
};

async function openEventEditor(page: Page): Promise<void> {
  await page.goto("/?freshProject=1");
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 15_000 });
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (box === null) throw new Error("missing editor canvas");
  await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
  const editor = page.getByTestId("event-editor-modal");
  if ((await editor.count()) === 0) await page.getByTestId("event-editor-open").click();
  await expect(editor).toBeVisible();
}

async function exportedMoves(page: Page): Promise<readonly ExportedMove[]> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (text === null) throw new Error("missing project export");
  const state: ProjectExport = JSON.parse(text);
  const map = state.project.maps[state.project.startMapId];
  const event = map?.events.find((item) => item.pages?.some((pageItem) => pageItem.movement?.route));
  const routePage = event?.pages?.find((pageItem) => pageItem.movement?.route);
  return routePage?.movement?.route?.moves ?? [];
}

test("custom page movement route dialog adds every Korean command button and persists the route", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1900, height: 1000 });
  await openEventEditor(page);

  await page.getByTestId("event-page-movement-type").selectOption("custom");
  await page.getByTestId("event-page-custom-route").click();
  const dialog = page.getByTestId("event-page-move-route-dialog");
  await expect(dialog).toBeVisible();
  await page.getByTestId("event-page-move-route-switch-id").fill("sw_route_seen");
  await page.getByTestId("event-page-move-route-graphic-id").fill("tex_easyrpg_charset_people1");
  await page.getByTestId("event-page-move-route-sound-id").fill("se_route_chime");

  const buttons = dialog.locator(".event-page-move-route-command");
  await expect(buttons).toHaveCount(42);
  const buttonCount = await buttons.count();
  for (let index = 0; index < buttonCount; index += 1) {
    await buttons.nth(index).click();
  }

  const rows = dialog.locator(".event-page-move-route-list-row");
  await expect(rows).toHaveCount(43);
  await expect(dialog.getByTestId("event-page-move-route-command-list")).toContainText("sw_route_seen");
  await expect(dialog.getByTestId("event-page-move-route-command-list")).toContainText("tex_easyrpg_charset_people1");
  await expect(dialog.getByTestId("event-page-move-route-command-list")).toContainText("se_route_chime");
  await page.screenshot({ path: testInfo.outputPath("move-route-all-buttons.png"), fullPage: true });

  await dialog.getByTestId("event-page-move-route-ok").click();
  await expect(dialog).toBeHidden();
  await page.getByTestId("event-editor-apply").click();

  const moves = await exportedMoves(page);
  expect(moves).toHaveLength(42);
  expect([...new Set(moves.map((move) => move.kind))]).toEqual(expect.arrayContaining([
    "move",
    "turn",
    "jump",
    "land",
    "moveDiagonal",
    "turnRelative",
    "setDirectionFix",
    "setThrough",
    "setAnimation",
    "moveRandom",
    "turnRandom",
    "changeOpacity",
    "moveTowardPlayer",
    "turnTowardPlayer",
    "moveAwayFromPlayer",
    "turnAwayFromPlayer",
    "setSwitch",
    "stepForward",
    "wait",
    "changeSpeed",
    "changeFrequency",
    "changeGraphic",
    "playSe",
  ]));
  expect(moves.some((move) => move.kind === "setSwitch" && move.switchId === "sw_route_seen")).toBe(true);
  expect(moves.some((move) => move.kind === "changeGraphic" && move.spriteId === "tex_easyrpg_charset_people1")).toBe(true);
  expect(moves.some((move) => move.kind === "playSe" && move.resourceId === "se_route_chime")).toBe(true);
});
