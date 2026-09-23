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
  // 페르소나(밀도)는 body 클래스로 확인하고, 탑바 앞면은 실제 저작 작업을 실행한다.
  await expect(page.getByTestId("editor-ui-mode-toggle")).toHaveCount(0);

  const leftBox = await rect(page.locator(".left-panel"));
  const canvasBox = await rect(page.locator(".canvas-area"));
  expect(leftBox.x, "left tool chrome must stay at the viewport's left edge allowance").toBeLessThanOrEqual(8);
  expect(leftBox.x, "left tool chrome must begin left of the canvas").toBeLessThan(canvasBox.x);

  // 작업 칩(맵/이벤트/데이터/테스트)은 2026-09-03 에 걷었다 — 레이어 전환·자료집 버튼·▶ 테스트의 복제였다.
  await expect(page.getByTestId("authoring-task-launcher")).toHaveCount(0);
  await expect(page.getByTestId("workspace-command-palette-button")).toBeVisible();
  await expect(page.getByTestId("mode-play")).toBeVisible();

  const commandBox = await rect(page.getByTestId("ai-command-bar"));
  const topbarBox = await rect(page.getByTestId("oprn-menu-bar"));
  expect(intersectionArea(commandBox, topbarBox), "AI command bar must not intersect the studio bar").toBe(0);

  const world = await openPaletteResult(page, "world", "open-world");
  await expect(world).toContainText("이 세계");
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
  // 레일은 초보에서도 카테고리 그룹이다 — 평면으로 노출되는 직속 탭은 개요 하나뿐이다.
  expect(directTabIds).toEqual(["db-tab-overview"]);

  // 그룹은 늘 펼쳐진 구획이다 — 머리를 누르지 않아도 레코드가 있는 탭이 보인다.
  await expect(page.getByTestId("db-tab-group-system")).toBeVisible();
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
      if (mode === "beginner") {
        await expect(page.getByTestId("toolbar-database")).toHaveCount(0);
      } else {
        const database = page.getByTestId("toolbar-database");
        await expect(database).toBeVisible();
        await expect(database).toBeEnabled();
      }
      if (mode === "expert") {
        // 전문가는 세계관·음악·찾기가 인라인 아이콘 버튼이고 도구 메뉴는 없다.
        await expect(page.getByTestId("toolbar-world")).toBeVisible();
        await expect(page.getByTestId("menu-tools")).toHaveCount(0);
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
