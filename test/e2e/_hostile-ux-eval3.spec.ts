/* 적대적 UX 평가 3차 — 스크린샷 증거 수집 전용. CI 제외(_접두사). */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createModernNocturneProject } from "@/project/defaults/modernNocturneGame";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const SHOT_DIR = "verify-shots/event-editor-hostile";
mkdirSync(SHOT_DIR, { recursive: true });
const TILE = 16;

async function openApp(page: Page, mode: string, w = 1440, h = 1000) {
  await page.addInitScript((m) => localStorage.setItem("rpg-zzu:editor-ui-mode", m), mode);
  await page.setViewportSize({ width: w, height: h });
  await seedProjectFromSupabaseCanonical(page, createModernNocturneProject(), "/?e2eVitals=1");
  await page.waitForFunction(() => typeof (window as any).__rpgzzuEditWorldToClient === "function", undefined, { timeout: 20_000 });
  await page.waitForTimeout(600);
  const skip = page.getByText("건너뛰기", { exact: true }).first();
  if (await skip.isVisible().catch(() => false)) { await skip.click(); await page.waitForTimeout(300); }
}

async function dblclickTile(page: Page, tx: number, ty: number) {
  const pt = await page.evaluate(([x, y]) => (window as any).__rpgzzuEditWorldToClient(x, y), [tx * TILE + 8, ty * TILE + 8]);
  await page.mouse.click(pt.x, pt.y, { clickCount: 2, delay: 60 });
  await page.waitForTimeout(1200);
}

const modal = (page: Page) => page.getByTestId("event-editor-modal");

test("K. cancel button semantics after edit", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page, "standard");
  await dblclickTile(page, 17, 16);
  await modal(page).locator("[data-testid='event-page-name-input']").fill("취소테스트");
  await page.waitForTimeout(400);
  await modal(page).getByText("취소", { exact: true }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOT_DIR}/K01-cancel-clicked.png` });
  const st = await page.evaluate(() => ({
    modalStill: !!document.querySelector("[data-testid='event-editor-modal']"),
    dialogs: Array.from(document.querySelectorAll<HTMLElement>("[role='dialog'], [role='alertdialog']")).map((d) => d.innerText?.trim().slice(0, 150)),
  }));
  console.log("CANCEL_ST " + JSON.stringify(st));
  if (st.modalStill) {
    // 다이얼로그 버튼이 있으면 그대로 캡처 후 첫 버튼 누르지 않고 종료
  } else {
    await dblclickTile(page, 17, 16);
    const name = await modal(page).locator("[data-testid='event-page-name-input']").inputValue().catch(() => "N/A");
    console.log("CANCEL_REOPEN_NAME " + JSON.stringify(name));
    await page.screenshot({ path: `${SHOT_DIR}/K02-reopen-after-cancel.png` });
  }
});

test("L. ok/apply with edit → proposal dialog?", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page, "standard");
  await dblclickTile(page, 17, 16);
  await modal(page).locator("[data-testid='event-page-name-input']").fill("확인테스트");
  await page.waitForTimeout(400);
  await modal(page).getByTestId("event-editor-ok").click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOT_DIR}/L01-after-ok.png` });
  const st = await page.evaluate(() => ({
    modalStill: !!document.querySelector("[data-testid='event-editor-modal']"),
    dialogs: Array.from(document.querySelectorAll<HTMLElement>("[role='dialog'], [role='alertdialog'], [class*='proposal']")).map((d) => ({ cls: (d as HTMLElement).className?.toString().slice(0, 40), t: d.innerText?.trim().slice(0, 200) })),
  }));
  console.log("OK_ST " + JSON.stringify(st));
});

test("M. list context menu with resolved selector", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page, "standard");
  await dblclickTile(page, 17, 16);
  await modal(page).getByTestId("event-view-toggle-list").click();
  await page.waitForTimeout(700);
  const rows = await page.evaluate(() => {
    const m = document.querySelector<HTMLElement>("[data-testid='event-editor-modal']")!;
    const cands = Array.from(m.querySelectorAll<HTMLElement>("*")).filter((el) => /문장 표시: 윤서/.test(el.innerText ?? "") );
    const leaf = cands[cands.length - 1];
    const r = leaf?.getBoundingClientRect();
    return leaf ? { cls: leaf.className.toString().slice(0, 80), x: r.x + 40, y: r.y + r.height / 2 } : null;
  });
  console.log("ROW " + JSON.stringify(rows));
  if (rows) {
    await page.mouse.click(rows.x, rows.y, { button: "right" });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SHOT_DIR}/M01-list-context-menu.png` });
    const menu = await page.evaluate(() => {
      const m = document.querySelector<HTMLElement>("[data-testid='event-command-context-menu']");
      return m ? m.innerText.replace(/\n/g, " | ").slice(0, 300) : null;
    });
    console.log("CTXMENU2 " + JSON.stringify(menu));
    // 단순 좌클릭은 무엇을 하나
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.mouse.click(rows.x, rows.y);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SHOT_DIR}/M02-list-line-leftclick.png` });
    await page.mouse.dblclick(rows.x, rows.y);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${SHOT_DIR}/M03-list-line-dblclick.png` });
  }
});

test("N. page tab overflow + out-of-range xy validation", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page, "standard");
  await dblclickTile(page, 17, 16);
  // 페이지 + 6번
  for (let i = 0; i < 6; i++) {
    await modal(page).locator("[data-testid='event-page-tab-add'], .event-page-tab-add").first().click().catch(() => {});
    await page.waitForTimeout(250);
  }
  await page.screenshot({ path: `${SHOT_DIR}/N01-eight-page-tabs.png` });
  const tabInfo = await page.evaluate(() => {
    const strip = document.querySelector<HTMLElement>(".event-page-tabs");
    if (!strip) return null;
    return { sw: strip.scrollWidth, cw: strip.clientWidth, overflow: strip.scrollWidth > strip.clientWidth + 2 };
  });
  console.log("TABSTRIP " + JSON.stringify(tabInfo));
  // 좌표 범위 밖 입력
  const xin = modal(page).locator("[data-testid='event-position-x']");
  await xin.fill("999");
  await xin.press("Enter");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOT_DIR}/N02-x999.png` });
  const status = await page.evaluate(() => document.querySelector<HTMLElement>("[data-testid='event-editor-modal']")?.innerText.match(/검사[^\n]*/)?.[0] ?? null);
  console.log("VALIDATION " + JSON.stringify(status));
  const xval = await xin.inputValue();
  console.log("XVAL_AFTER " + JSON.stringify(xval));
});

test("O. tiny viewport 1024x640 + legend expand", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page, "standard", 1024, 640);
  await dblclickTile(page, 17, 16);
  await page.screenshot({ path: `${SHOT_DIR}/O01-1024x640-modal.png` });
  const legend = modal(page).getByText("색상 범례", { exact: false }).first();
  if (await legend.isVisible().catch(() => false)) {
    await legend.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOT_DIR}/O02-legend-open.png` });
  }
  expect(true).toBe(true);
});
