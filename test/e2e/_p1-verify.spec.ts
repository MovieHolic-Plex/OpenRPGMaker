/* P1 수정 검증 — 뷰 토글/용어/보조도구/연결 버튼. CI 제외(_접두사). */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createModernNocturneProject } from "@/project/defaults/modernNocturneGame";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const SHOT_DIR = "verify-shots/event-editor-hostile/after";
mkdirSync(SHOT_DIR, { recursive: true });
const TILE = 16;

async function openApp(page: Page, mode = "standard", w = 1440, h = 1000) {
  await page.addInitScript((m) => localStorage.setItem("rpg-zzu:editor-ui-mode", m), mode);
  await page.setViewportSize({ width: w, height: h });
  await seedProjectFromSupabaseCanonical(page, createModernNocturneProject(), "/?e2eVitals=1");
  await page.waitForFunction(() => typeof (window as any).__rpgzzuEditWorldToClient === "function", undefined, { timeout: 20_000 });
  await page.waitForTimeout(600);
  const skip = page.getByText("건너뛰기", { exact: true }).first();
  if (await skip.isVisible().catch(() => false)) { await skip.click(); await page.waitForTimeout(300); }
}

async function dblclickTile(page: Page, tx: number, ty: number) {
  await page.waitForFunction(() => typeof (window as any).__rpgzzuEditWorldToClient === "function", undefined, { timeout: 15_000 });
  const pt = await page.evaluate(([x, y]) => (window as any).__rpgzzuEditWorldToClient(x, y), [tx * TILE + 8, ty * TILE + 8]);
  await page.getByTestId("tool-event").click().catch(() => {});
  await page.waitForTimeout(300);
  await page.mouse.click(pt.x, pt.y, { clickCount: 2, delay: 60 });
  await page.waitForTimeout(1200);
}

const modal = (page: Page) => page.getByTestId("event-editor-modal");

test("W1. standard: list default, korean toggles, no graph", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page);
  await dblclickTile(page, 17, 16);
  await page.screenshot({ path: `${SHOT_DIR}/W1-standard-modal.png` });
  const st = await page.evaluate(() => {
    const m = document.querySelector<HTMLElement>("[data-testid='event-editor-modal']")!;
    const list = m.querySelector<HTMLElement>(".cmd-list");
    const board = m.querySelector<HTMLElement>(".event-storyboard");
    return {
      graphToggle: !!m.querySelector("[data-testid='event-view-toggle-graph']"),
      listLabel: m.querySelector("[data-testid='event-view-toggle-list']")?.textContent,
      sbLabel: m.querySelector("[data-testid='event-view-toggle-storyboard']")?.textContent,
      listHidden: list?.hidden, boardHidden: board?.hidden,
      pageAddDup: !!m.querySelector("[data-testid='event-page-add']"),
      tabAdd: !!m.querySelector("[data-testid='event-page-tab-add']"),
      movementChip: m.querySelector("[data-testid='event-movement-summary-chips']")?.textContent,
      triggerSel: (m.querySelector("[data-testid='event-page-trigger-select']") as HTMLSelectElement)?.selectedOptions?.[0]?.textContent,
      prioritySel: (m.querySelector("[data-testid='event-page-priority-select']") as HTMLSelectElement)?.selectedOptions?.[0]?.textContent,
    };
  });
  console.log("W1 " + JSON.stringify(st));
  expect(st.graphToggle).toBe(false);
  expect(st.listLabel).toBe("목록");
  expect(st.listHidden).toBe(false);
  expect(st.pageAddDup).toBe(false);
});

test("W2. storyboard add card opens picker in place", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page);
  await dblclickTile(page, 17, 16);
  await modal(page).getByTestId("event-view-toggle-storyboard").click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOT_DIR}/W2a-storyboard.png` });
  await modal(page).getByTestId("event-storyboard-add").click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOT_DIR}/W2b-add-opens-picker.png` });
  const st = await page.evaluate(() => ({
    picker: !!document.querySelector("[data-testid='event-command-picker']"),
    boardStillVisible: !(document.querySelector<HTMLElement>(".event-storyboard")?.hidden ?? true),
    setSwitchCardTitle: Array.from(document.querySelectorAll<HTMLElement>(".event-storyboard-card-title")).map((c) => c.textContent),
  }));
  console.log("W2 " + JSON.stringify(st));
  expect(st.picker).toBe(true);
  expect(st.boardStillVisible).toBe(true);
});

test("W3. beginner: switch-name tab condition + storyboard card labels", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page, "beginner");
  await dblclickTile(page, 7, 15); // 네온 망령: SW 조건 페이지 + setSwitch 명령
  await page.screenshot({ path: `${SHOT_DIR}/W3-beginner-alley-ghost.png` });
  const st = await page.evaluate(() => ({
    tabConds: Array.from(document.querySelectorAll<HTMLElement>(".event-page-tab-cond")).map((t) => t.textContent),
    connect: !!document.querySelector("[data-testid='event-character-id-connect']"),
    cardTitles: Array.from(document.querySelectorAll<HTMLElement>(".event-storyboard-card-title")).map((c) => c.textContent),
  }));
  console.log("W3 " + JSON.stringify(st));
});

test("W4. aux drawer holds follower presets + field monster", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page);
  await dblclickTile(page, 17, 16);
  const dock = modal(page).getByText("도구 · AI, 미리보기, 플로우", { exact: false }).first();
  await dock.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOT_DIR}/W4-aux-drawer.png` });
  const st = await page.evaluate(() => {
    const aux = document.querySelector("[data-testid='event-editor-aux-tools']");
    const contents = document.querySelector("[data-testid='event-classic-contents']");
    return {
      followerInAux: !!aux?.querySelector("[data-testid='follower-preset-bar']"),
      monsterInAux: !!aux?.querySelector("[data-testid='event-command-toolbar-field-monster']"),
      followerInContents: !!contents?.querySelector("[data-testid='follower-preset-bar']"),
    };
  });
  console.log("W4 " + JSON.stringify(st));
  expect(st.followerInAux).toBe(true);
  expect(st.monsterInAux).toBe(true);
  expect(st.followerInContents).toBe(false);
});
