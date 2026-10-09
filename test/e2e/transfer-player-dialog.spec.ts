import { expect, test, type Locator, type Page } from "@playwright/test";

const EVIDENCE_DIR = "output/evidence/transfer-player-dialog";

type EventCommand = {
  readonly kind: string;
  readonly mapId?: string;
  readonly x?: number;
  readonly y?: number;
  readonly direction?: string;
  readonly fade?: string;
};

async function openEventEditor(page: Page): Promise<void> {
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await canvas.dblclick({ position: { x: Math.floor(box.width * 0.35), y: Math.floor(box.height * 0.72) } });
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
}

async function projectExport(page: Page): Promise<unknown> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text);
}

async function countEventMarkerPixels(canvas: Locator, x: number, y: number, size: number): Promise<number> {
  return canvas.evaluate((node, rect) => {
    if (!(node instanceof HTMLCanvasElement)) throw new Error("transfer preview is not a canvas");
    const context = node.getContext("2d");
    if (!context) throw new Error("missing canvas context");
    const pixels = context.getImageData(rect.x, rect.y, rect.size, rect.size).data;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] === 255 && pixels[index + 1] === 0 && pixels[index + 2] === 122) count += 1;
    }
    return count;
  }, { x, y, size });
}

test("transfer command opens an RPG Maker style Transfer Player picker", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.goto("/?freshProject=1");

  await openEventEditor(page);
  await page.getByTestId("event-command-empty-line").dblclick();
  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  await picker.getByTestId("event-command-picker-tab-1").click();
  await picker.getByTestId("command-picker-add-transfer").click();
  const commandDialog = page.getByTestId("event-command-edit-dialog");
  await expect(commandDialog).toBeVisible();
  await commandDialog.getByTestId("transfer-player-open").click();

  const dialog = page.getByTestId("event-transfer-player-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("transfer-player-map-tree")).toBeVisible();
  await expect(dialog.getByTestId("transfer-player-map-preview")).toBeVisible();
  await expect(dialog.getByTestId("transfer-player-direction-retain")).toBeChecked();
  await expect(dialog.getByTestId("transfer-player-fade-black")).toBeChecked();
  await dialog.screenshot({ path: `${EVIDENCE_DIR}/transfer-player-dialog.png` });

  await dialog.getByTestId("transfer-player-map-map_starter_house_interior").click();
  const preview = dialog.getByTestId("transfer-player-map-preview");
  const previewBox = await preview.boundingBox();
  if (!previewBox) throw new Error("missing transfer preview");
  await expect.poll(() => countEventMarkerPixels(preview, 64, 112, 16)).toBeGreaterThan(8);
  await dialog.screenshot({ path: `${EVIDENCE_DIR}/transfer-player-dialog-interior-events.png` });
  // Click tile (4,6) using CSS-space coords (preview may be scaled to fill the pane).
  const clickAt = await preview.evaluate((node) => {
    if (!(node instanceof HTMLCanvasElement)) throw new Error("transfer preview is not a canvas");
    const tileSize = 16;
    const tileX = 4;
    const tileY = 6;
    const rect = node.getBoundingClientRect();
    return {
      x: ((tileX + 0.5) * tileSize / Math.max(1, node.width)) * rect.width,
      y: ((tileY + 0.5) * tileSize / Math.max(1, node.height)) * rect.height,
    };
  });
  await preview.click({ position: clickAt });
  await dialog.getByTestId("transfer-player-direction-right").check();
  await dialog.getByTestId("transfer-player-fade-none").check();
  await dialog.getByTestId("transfer-player-ok").click();
  await expect(dialog).toHaveCount(0);
  await commandDialog.getByTestId("event-command-edit-ok").click();
  await expect(commandDialog).toHaveCount(0);
  await expect(picker).toHaveCount(0);
  const command = page.getByTestId("event-command-transfer").first();
  await expect(command).toBeVisible();
  await expect(command.getByTestId("transfer-command-summary")).toContainText("Right");
  await expect(command.getByTestId("transfer-command-summary")).toContainText("None");
  await page.screenshot({ path: `${EVIDENCE_DIR}/transfer-command-inline.png`, fullPage: true });

  await page.getByTestId("event-editor-apply").click();
  const exported = await projectExport(page);
  const text = JSON.stringify(exported);
  expect(text).toContain("map_starter_house_interior");
  expect(text).toContain("\"direction\":\"right\"");
  expect(text).toContain("\"fade\":\"none\"");
  const parsed = JSON.parse(text) as {
    project: { maps: Record<string, { events: { pages?: { commands: EventCommand[] }[] }[] }> };
  };
  const commands = Object.values(parsed.project.maps)
    .flatMap((map: { events: { pages?: { commands: EventCommand[] }[] }[] }) =>
      map.events.flatMap((event) => event.pages?.flatMap((pageEntry) => pageEntry.commands) ?? [])
    );
  expect(commands.some((entry: EventCommand) =>
    entry.kind === "transfer" &&
    entry.mapId === "map_starter_house_interior" &&
    entry.x === 4 &&
    entry.y === 6 &&
    entry.direction === "right" &&
    entry.fade === "none"
  )).toBe(true);
});
