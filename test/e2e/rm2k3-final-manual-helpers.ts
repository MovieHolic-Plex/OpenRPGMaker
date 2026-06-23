import { expect, type Page, type TestInfo } from "@playwright/test";

export type RuntimeState = {
  readonly mapId: string;
  readonly switches: Record<string, boolean>;
  readonly variables: Record<string, number>;
  readonly events: Record<string, { readonly pageId?: string }>;
  readonly battleResult?: "victory" | "defeat" | "escape";
};

type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

type EditorViewportCapture = {
  readonly page: Page;
  readonly testInfo: TestInfo;
  readonly name: string;
  readonly overlapPairs: readonly (readonly [string, string])[];
};

const DATABASE_TABS = [
  "db-tab-actors",
  "db-tab-classes",
  "db-tab-skills",
  "db-tab-items",
  "db-tab-equipment",
  "db-tab-enemies",
  "db-tab-troops",
  "db-tab-states",
  "db-tab-animations",
  "db-tab-tilesets",
  "db-tab-common-events",
  "db-tab-system",
  "db-tab-terms",
  "db-tab-switches",
  "db-tab-variables",
] as const;

export const EDITOR_OVERLAP_PAIRS = [
  ["layer-selector", "tool-grid"],
  ["tool-grid", "tile-palette"],
  ["tile-palette", "map-tree"],
  ["right-tab-database", "right-tab-resources"],
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "boolean");
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "number");
}

function isEventRecord(value: unknown): value is Record<string, { readonly pageId?: string }> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => {
    if (!isRecord(entry)) return false;
    return entry.pageId === undefined || typeof entry.pageId === "string";
  });
}

function isRuntimeState(value: unknown): value is RuntimeState {
  if (!isRecord(value)) return false;
  if (typeof value.mapId !== "string") return false;
  if (!isBooleanRecord(value.switches)) return false;
  if (!isNumberRecord(value.variables)) return false;
  if (!isEventRecord(value.events)) return false;
  if (value.battleResult === undefined) return true;
  return value.battleResult === "victory" || value.battleResult === "defeat" || value.battleResult === "escape";
}

export async function importSampleProject(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("toolbar-import").click();
  const fileChooser = await chooser;
  await fileChooser.setFiles("test/fixtures/projects/rm2k3-sample-v3.json");
  await expect(page.getByTestId("toast")).toContainText("가져오기 완료");
  await expect(page.getByTestId("edit-canvas")).toBeVisible();
}

export async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  const parsed: unknown = JSON.parse(text);
  if (!isRuntimeState(parsed)) throw new Error("invalid runtime state");
  return parsed;
}

export async function dismissDialogue(page: Page, expected: string): Promise<void> {
  const box = page.getByTestId("dialogue-box");
  await expect(box).toContainText(expected);
  await box.click();
  await expect(box).toBeHidden();
}

export async function openMenu(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("main-menu")).toBeVisible();
}

export async function closeMenu(page: Page): Promise<void> {
  await page.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByTestId("main-menu")).toBeHidden();
}

export async function expectCanvasHasPixels(page: Page, testId: string): Promise<void> {
  const canvas = page.getByTestId(testId).locator("canvas").first();
  const screenshot = await canvas.screenshot();
  const dataUrl = `data:image/png;base64,${screenshot.toString("base64")}`;
  const hasPixels = await page.evaluate(async (url) => {
    const image = new Image();
    const loaded = new Promise<boolean>((resolve) => {
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
    });
    image.src = url;
    if (!(await loaded)) return false;
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context || canvas.width === 0 || canvas.height === 0) return false;
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let visiblePixels = 0;
    let colorChanges = 0;
    const firstRed = data[0] ?? 0;
    const firstGreen = data[1] ?? 0;
    const firstBlue = data[2] ?? 0;
    const step = Math.max(4, Math.floor(data.length / 4096) * 4);
    for (let index = 0; index < data.length; index += step) {
      if ((data[index + 3] ?? 0) > 0) visiblePixels += 1;
      if ((data[index] ?? 0) !== firstRed || (data[index + 1] ?? 0) !== firstGreen || (data[index + 2] ?? 0) !== firstBlue) {
        colorChanges += 1;
      }
    }
    return visiblePixels > 20 && colorChanges > 5;
  }, dataUrl);
  expect(hasPixels, `${testId} canvas should contain nonblank pixels`).toBe(true);
}

export async function expectPlayCanvasLogicalSurface(page: Page, testInfo: TestInfo): Promise<void> {
  const canvas = page.getByTestId("play-canvas").locator("canvas").first();
  const surface = await canvas.evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) {
      throw new Error("play-canvas child is not a canvas");
    }
    const box = element.getBoundingClientRect();
    return {
      width: element.width,
      height: element.height,
      displayWidth: box.width,
      displayHeight: box.height,
    };
  });
  await testInfo.attach("play-canvas-surface.json", {
    body: `${JSON.stringify(surface, null, 2)}\n`,
    contentType: "application/json",
  });
  expect(surface.width).toBe(320);
  expect(surface.height).toBe(240);
  expect(surface.displayWidth).toBeGreaterThanOrEqual(surface.width);
  expect(surface.displayHeight).toBeGreaterThanOrEqual(surface.height);
  expect(Number.isInteger(surface.displayWidth / surface.width)).toBe(true);
  expect(Number.isInteger(surface.displayHeight / surface.height)).toBe(true);
}

async function boxFor(page: Page, testId: string): Promise<Box> {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`missing visible box for ${testId}`);
  return box;
}

function overlapArea(first: Box, second: Box): number {
  const left = Math.max(first.x, second.x);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const top = Math.max(first.y, second.y);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

async function expectControlsDoNotOverlap(page: Page, pairs: readonly (readonly [string, string])[]): Promise<void> {
  for (const [first, second] of pairs) {
    const firstBox = await boxFor(page, first);
    const secondBox = await boxFor(page, second);
    expect(overlapArea(firstBox, secondBox), `${first} overlaps ${second}`).toBeLessThanOrEqual(1);
  }
}

export async function captureEditorViewport(capture: EditorViewportCapture): Promise<void> {
  await expect(capture.page.getByTestId("edit-canvas")).toBeVisible();
  await expectCanvasHasPixels(capture.page, "edit-canvas");
  await expectControlsDoNotOverlap(capture.page, capture.overlapPairs);
  await capture.page.screenshot({ path: capture.testInfo.outputPath(`${capture.name}.png`), fullPage: true });
}

export async function openEveryDatabaseTab(page: Page): Promise<void> {
  await page.getByTestId("right-tab-database").click();
  for (const id of DATABASE_TABS) {
    await page.getByTestId(id).click();
    await expect(page.getByTestId("db-detail-form"), `${id} should render a detail form`).toBeVisible();
  }
}

export async function importResource(page: Page): Promise<void> {
  await page.getByTestId("right-tab-resources").click();
  await page.getByTestId("resource-kind-select").selectOption("chipset");
  await page.getByTestId("resource-file-input").setInputFiles("test/fixtures/resources/chipset-valid-480x256.png");
  await expect(page.getByTestId("resource-profile-chipset").last()).toContainText("480x256");
  await expect(page.getByTestId("resource-tile-0").last()).toBeVisible();
}

export async function visitInterior(page: Page): Promise<void> {
  await page.getByTestId("event-interior-door").click();
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe("map_interior");
  await page.getByTestId("event-interior-host").click();
  await dismissDialogue(page, "This small interior proves map transfers.");
  await page.getByTestId("event-interior-exit").click();
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe("map_town");
}

export async function enterDungeon(page: Page): Promise<void> {
  await page.getByTestId("event-dungeon-door").click();
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe("map_dungeon");
}

export async function winBattle(page: Page, screenshotPath?: string): Promise<void> {
  await page.getByTestId("event-battle-start").click();
  await expect(page.getByTestId("battle-scene")).toBeVisible();
  await expect(page.getByTestId("actor-command-skill")).toBeVisible();
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
  await page.getByTestId("actor-command-skill").click();
  await expect.poll(async () => (await runtimeState(page)).battleResult).toBe("victory");
  await expect(page.getByTestId("battle-scene")).toBeHidden();
}
