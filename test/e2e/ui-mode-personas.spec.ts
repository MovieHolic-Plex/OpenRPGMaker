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
  }, { layoutKeys: LAYOUT_KEYS, modeKey: UI_MODE_KEY, persona: mode });
  await page.goto(`/?freshProject=1&persona=${mode}-${width}x${height}`);
  await dismissLogin(page);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
  await dismissCoachMarks(page);

  // 예전에는 여기서 접힘 복귀 알약을 눌러 컴포저를 되살렸다. 띠는 유휴에도 컴포저를
  // 상주시키므로(스펙 §2) 되살릴 것이 없다 — 바로 보이는지만 확인한다.
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
  // `editor-layout` 의 `chat-dock-glass` 를 재던 자리. 배치 클래스 3종은 스펙 §1 에서
  // 삭제됐다(띠는 캔버스 안 부유 호스트 하나에만 산다). 대신 조수가 그 호스트에
  // 있다는 것을 직접 잰다 — 클래스는 배치의 그림자였고, 이쪽이 배치 자체다.
  await expect(page.getByTestId("chat-float-host").getByTestId("ai-panel")).toBeVisible();
  await expect(page.locator("body")).toHaveClass(new RegExp(`editor-ui-${mode}`));
  // 페르소나(밀도)는 body 클래스로 확인하고, 탑바 앞면은 실제 저작 작업을 실행한다.
  await expect(page.getByTestId("editor-ui-mode-toggle")).toHaveCount(0);

  const leftBox = await rect(page.locator(".left-panel"));
  const canvasBox = await rect(page.locator(".canvas-area"));
  expect(leftBox.x, "left tool chrome must stay at the viewport's left edge allowance").toBeLessThanOrEqual(8);
  expect(leftBox.x, "left tool chrome must begin left of the canvas").toBeLessThan(canvasBox.x);

  for (const task of ["map", "event", "data", "test"]) {
    await expect(page.getByTestId(`authoring-task-${task}`)).toBeVisible();
  }
  await expect(page.getByTestId("workspace-command-palette-button")).toBeVisible();

  const commandBox = await rect(page.getByTestId("ai-command-bar"));
  const launcherBox = await rect(page.getByTestId("authoring-task-launcher"));
  expect(intersectionArea(commandBox, launcherBox), "AI command bar must not intersect the authoring task launcher").toBe(0);

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

// 원래 이 자리는 "float versus side visual pair" 였다 — ☰ 메뉴로 배치를 바꿔 두 장을 찍고,
// 사이드 도크가 좌패널보다 왼쪽에 오는지 재는 테스트. 배치가 하나가 되면서 비교할 짝이
// 사라졌으므로, 같은 뷰포트에서 **유휴 ↔ 자람** 두 장을 찍고 자람이 좌패널·작업 런처를
// 침범하지 않는지 잰다. 자랄 때가 겹침이 생기는 유일한 순간이라 여기가 재는 값이 있다.
test("idle versus risen visual pair at 1280x800", async ({ page }) => {
  test.setTimeout(60_000);
  await bootPersona(page, "expert", 1280, 800);
  await assertCommonPersonaContract(page, "expert");
  const panel = page.getByTestId("ai-panel");
  await expect(panel).not.toHaveClass(/is-risen/);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "persona-expert-1280x800-idle.png"), fullPage: true });

  await page.getByTestId("ai-input").fill("항구 마을을 하나 만들어 줘");
  await expect(panel).toHaveClass(/is-risen/);
  const risen = await rect(panel);
  const leftPanel = await rect(page.locator(".left-panel"));
  expect(risen.x, "risen strip must stay right of the left panel").toBeGreaterThanOrEqual(
    leftPanel.x + leftPanel.width - 1,
  );
  expect(
    intersectionArea(risen, await rect(page.getByTestId("authoring-task-launcher"))),
    "risen strip must not intersect the authoring task launcher",
  ).toBe(0);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "persona-expert-1280x800-risen.png"), fullPage: true });
});

test.afterAll(() => {
  writeFileSync(
    path.join(EVIDENCE_DIR, "visual-note.md"),
    [
      "# Persona matrix visual QA",
      "",
      "Automated visual-QA skill/scripts were not present in this worktree.",
      "The six persona screenshots and the 1280x800 idle/risen pair were inspected through",
      "machine geometry contracts in this spec: viewport containment, leftmost tool chrome,",
      "assistant-strip host placement, and zero-area intersection against the task launcher",
      "in both the idle and risen states.",
      "Screenshots are evidence only and do not replace those assertions.",
      "",
    ].join("\n"),
    "utf8",
  );
});
