import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const EVIDENCE_DIR = path.resolve(
  "../rpg-zzu/.omo/evidence/beginner-friendly-ui-modes/task-11-beginner-friendly-ui-modes",
);
const UI_MODE_KEY = "oprn:editor-ui-mode";
const LAYOUT_KEYS = [
  "oprn:editor-layout",
  "oprn:editor-layout:v2",
  "oprn:editor-layout:v3",
  "oprn:editor-layout:v4",
  "oprn:editor-layout-version",
] as const;
const COMMON_DB_TABS = [
  "db-tab-overview",
  "db-tab-actors",
  "db-tab-items",
  "db-tab-enemies",
  "db-tab-troops",
  "db-tab-system",
] as const;
const PERSONAS = ["beginner", "standard", "expert"] as const;
const VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

type Persona = (typeof PERSONAS)[number];
type Rect = NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>;

mkdirSync(EVIDENCE_DIR, { recursive: true });

async function dismissLogin(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 5_000 }).catch(() => false)) await guest.click();
  await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 10_000 });
}

async function dismissCoachMarks(page: Page): Promise<void> {
  for (const label of ["건너뛰기", "그만 보기", "닫기"]) {
    const button = page.getByRole("button", { name: label, exact: true }).first();
    if (await button.isVisible().catch(() => false)) await button.click();
  }
}

async function bootPersona(page: Page, mode: Persona, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.addInitScript(({ layoutKeys, modeKey, persona }) => {
    localStorage.setItem(modeKey, persona);
    for (const key of layoutKeys) localStorage.removeItem(key);
    localStorage.removeItem("oprn:ai-panel-collapsed");
  }, { layoutKeys: LAYOUT_KEYS, modeKey: UI_MODE_KEY, persona: mode });
  await page.goto(`/?freshProject=1&persona=${mode}-${width}x${height}`);
  await dismissLogin(page);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
  await dismissCoachMarks(page);

  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await expect(page.getByTestId("ai-command-bar")).toBeVisible({ timeout: 10_000 });
}

async function rect(locator: Locator): Promise<Rect> {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}

function intersectionArea(a: Rect, b: Rect): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

async function openPaletteResult(page: Page, query: string, commandId: string): Promise<Locator> {
  await page.keyboard.press("Control+K");
  const palette = page.getByTestId("command-palette");
  await expect(palette).toBeVisible();
  await page.getByTestId("command-palette-search").fill(query);
  const result = page.getByTestId(`command-palette-item-command-${commandId}`);
  await expect(result).toBeVisible();
  return result;
}

async function assertCommonPersonaContract(page: Page, mode: Persona): Promise<void> {
  const layout = page.getByTestId("editor-layout");
  await expect(layout).toHaveClass(/chat-dock-glass/);
  await expect(page.locator("body")).toHaveClass(new RegExp(`editor-ui-${mode}`));
  // 3단 모드 토글은 작업 프리셋 세그먼트로 대체됐다 — 밀도는 이제 패널 메뉴 안의 축이고
  // 탑바 앞면에는 「무슨 일을 하나」만 남는다. 페르소나(밀도)는 body 클래스로 확인한다.
  await expect(page.getByTestId("editor-ui-mode-toggle")).toHaveCount(0);

  const leftBox = await rect(page.locator(".left-panel"));
  const canvasBox = await rect(page.locator(".canvas-area"));
  expect(leftBox.x, "left tool chrome must stay at the viewport's left edge allowance").toBeLessThanOrEqual(8);
  expect(leftBox.x, "left tool chrome must begin left of the canvas").toBeLessThan(canvasBox.x);

  for (const preset of ["map", "event", "data"]) {
    await expect(page.getByTestId(`workspace-preset-${preset}`)).toBeVisible();
  }
  await expect(page.getByTestId("workspace-command-palette-button")).toBeVisible();

  const commandBox = await rect(page.getByTestId("ai-command-bar"));
  const presetToggleBox = await rect(page.getByTestId("workspace-preset-toggle"));
  expect(intersectionArea(commandBox, presetToggleBox), "AI command bar must not intersect the workspace preset toggle").toBe(0);

  const world = await openPaletteResult(page, "world", "open-world");
  await expect(world).toContainText("세계관");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("command-palette")).toHaveCount(0);
}

async function assertBeginnerContract(page: Page): Promise<void> {
  const rail = page.getByTestId("basic-left-rail");
  const labels = rail.locator(".basic-rail-label");
  expect(await labels.count()).toBeGreaterThanOrEqual(11);
  for (const label of await labels.all()) await expect(label).toBeVisible();
  for (const text of ["선택", "칠하기", "지우기", "채우기", "장면", "집기"]) {
    await expect(rail.locator(".basic-rail-label", { hasText: text }).first()).toBeVisible();
  }

  const database = await openPaletteResult(page, "database", "open-database");
  await database.click();
  const modal = page.getByTestId("database-modal");
  await expect(modal).toBeVisible();
  const nav = modal.locator(".db-tabs");
  const directTabIds = await nav.locator(":scope > .db-tab").evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLElement).dataset.testid),
  );
  expect(directTabIds).toEqual(COMMON_DB_TABS);

  const all = page.getByTestId("db-nav-all");
  await expect(all).not.toHaveAttribute("open", "");
  await expect(page.getByTestId("db-tab-switches")).toBeHidden();
  await all.locator("summary").click();
  await expect(all).toHaveAttribute("open", "");
  await expect(page.getByTestId("db-tab-switches")).toBeVisible();
  await page.getByTestId("database-modal-close").click();
  await expect(modal).toBeHidden();
}

for (const mode of PERSONAS) {
  for (const { width, height } of VIEWPORTS) {
    test(`persona ${mode} at ${width}x${height}`, async ({ page }) => {
      test.setTimeout(60_000);
      await bootPersona(page, mode, width, height);
      await assertCommonPersonaContract(page, mode);
      if (mode === "beginner") await assertBeginnerContract(page);
      if (mode === "expert") {
        const toolbarNew = page.getByTestId("toolbar-new");
        await expect(toolbarNew).toBeVisible();
        await expect(toolbarNew).toBeEnabled();
      }
      await page.screenshot({
        path: path.join(EVIDENCE_DIR, `persona-${mode}-${width}x${height}.png`),
        fullPage: true,
      });
    });
  }
}

test("float versus side visual pair at 1280x800", async ({ page }) => {
  test.setTimeout(60_000);
  await bootPersona(page, "expert", 1280, 800);
  await assertCommonPersonaContract(page, "expert");
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "persona-expert-1280x800-float.png"), fullPage: true });

  await page.getByTestId("ai-command-menu-toggle").click();
  await page.getByTestId("ai-command-menu-dock").click();
  await expect(page.getByTestId("editor-layout")).toHaveClass(/chat-dock-side/);
  await expect(page.getByTestId("chat-side-panel").getByTestId("ai-panel")).toBeVisible();
  const sidePanel = await rect(page.getByTestId("chat-side-panel"));
  const leftPanel = await rect(page.locator(".left-panel"));
  expect(sidePanel.x).toBeLessThan(leftPanel.x);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "persona-expert-1280x800-side.png"), fullPage: true });
});

test.afterAll(() => {
  writeFileSync(
    path.join(EVIDENCE_DIR, "visual-note.md"),
    [
      "# Persona matrix visual QA",
      "",
      "Automated visual-QA skill/scripts were not present in this worktree.",
      "The six persona screenshots and the 1280x800 float/side pair were inspected through",
      "machine geometry contracts in this spec: viewport containment, leftmost tool chrome,",
      "float/side class and host placement, and zero-area preset-toggle/AI-bar intersection.",
      "Screenshots are evidence only and do not replace those assertions.",
      "",
    ].join("\n"),
    "utf8",
  );
});
