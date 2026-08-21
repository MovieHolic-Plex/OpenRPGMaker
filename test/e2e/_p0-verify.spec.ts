/* P0 수정 검증 — 스크린샷 + 상태 덤프. CI 제외(_접두사). */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createModernNocturneProject } from "@/project/defaults/modernNocturneGame";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const SHOT_DIR = "verify-shots/event-editor-hostile/after";
mkdirSync(SHOT_DIR, { recursive: true });
const TILE = 16;

async function openApp(page: Page, mode = "standard", w = 1440, h = 1000) {
  await page.addInitScript((m) => localStorage.setItem("oprn:editor-ui-mode", m), mode);
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
  await page.mouse.click(pt.x, pt.y, { clickCount: 2, delay: 60 });
  await page.waitForTimeout(1200);
}

const modal = (page: Page) => page.getByTestId("event-editor-modal");

test("V1. xy input shows two digits + clamps out-of-range", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page);
  await dblclickTile(page, 7, 15);
  const y = modal(page).locator("[data-testid='event-position-y']");
  const box = await y.boundingBox();
  console.log("Y_BOX " + JSON.stringify(box));
  const row = modal(page).locator(".event-editor-id-row").first();
  await row.screenshot({ path: `${SHOT_DIR}/V1-xy-row.png` });
  // 클램프: X=999 입력
  const x = modal(page).locator("[data-testid='event-position-x']");
  await x.fill("999");
  await x.press("Enter");
  await x.blur().catch(() => {});
  await page.waitForTimeout(600);
  const xv = await x.inputValue();
  const stored = await page.evaluate(() => {
    const s = (window as any).__rpgzzuEditorStore;
    const p = s.getCurrent();
    const entry = Object.entries(p.maps).find(([, m]: any) => m.events?.some((e: any) => e.id)) as any;
    const ev = Object.values(p.maps).flatMap((m: any) => m.events).find((e: any) => e.y === 15 || e.x === 999 || e.x === 29);
    return { x: ev?.x, y: ev?.y };
  });
  console.log("CLAMP " + JSON.stringify({ inputValue: xv, stored }));
  await row.screenshot({ path: `${SHOT_DIR}/V1-xy-clamped.png` });
  expect(Number(xv)).toBeLessThan(999);
});

test("V2. dirty escape shows guard dialog; discard restores", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page);
  await dblclickTile(page, 17, 16);
  await modal(page).locator("[data-testid='event-page-name-input']").fill("가드테스트");
  // blur 없이 바로 ESC (유령 저장 재현 조건)
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOT_DIR}/V2-esc-guard-dialog.png` });
  const dlg = await page.evaluate(() => {
    const d = Array.from(document.querySelectorAll<HTMLElement>("[role='dialog'], [role='alertdialog']"))
      .map((x) => x.innerText?.trim().slice(0, 120)).filter((t) => t && t.includes("변경"));
    return d;
  });
  console.log("GUARD_DLG " + JSON.stringify(dlg));
  // "버리고 닫기" 클릭
  const discard = page.getByRole("button", { name: /버리고 닫기/ }).first();
  await discard.click();
  await page.waitForTimeout(700);
  const st = await page.evaluate(() => {
    const s = (window as any).__rpgzzuEditorStore;
    const ev = Object.values(s.getCurrent().maps).flatMap((m: any) => m.events).find((e: any) => e.x === 17 && e.y === 16);
    return { name: ev?.pages?.[0]?.name, draft: ev?.draft?.kind ?? null, modal: !!document.querySelector("[data-testid='event-editor-modal']") };
  });
  console.log("AFTER_DISCARD " + JSON.stringify(st));
  expect(st.name).toBe("형사 지안");
  expect(st.modal).toBe(false);
});

test("V3. continue-editing keeps modal + ESC still works after", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page);
  await dblclickTile(page, 17, 16);
  await modal(page).locator("[data-testid='event-page-name-input']").fill("계속편집테스트");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /계속 편집/ }).first().click();
  await page.waitForTimeout(500);
  const still = await modal(page).isVisible();
  console.log("STILL_OPEN " + still);
  await page.screenshot({ path: `${SHOT_DIR}/V3-continue-editing.png` });
  // ESC 재시도 → 다시 다이얼로그가 떠야 함(재등록 확인)
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  const dlg2 = await page.getByRole("button", { name: /버리고 닫기/ }).first().isVisible().catch(() => false);
  console.log("SECOND_ESC_DIALOG " + dlg2);
  expect(still).toBe(true);
  expect(dlg2).toBe(true);
});

test("V4. new event opens pristine; untouched close is silent", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page, "beginner");
  await page.getByTestId("tool-event").click();
  await page.waitForTimeout(400);
  await dblclickTile(page, 14, 12);
  const status = await modal(page).locator("[data-testid='event-editor-draft-status']").innerText();
  console.log("NEW_STATUS " + JSON.stringify(status));
  await page.screenshot({ path: `${SHOT_DIR}/V4-new-event-pristine.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  const st = await page.evaluate(() => ({
    modal: !!document.querySelector("[data-testid='event-editor-modal']"),
    dialog: !!document.querySelector(".app-modal-overlay"),
    evCount: Object.values(((window as any).__rpgzzuEditorStore).getCurrent().maps).reduce((n: number, m: any) => n + m.events.length, 0),
  }));
  console.log("NEW_CLOSE " + JSON.stringify(st));
  expect(st.modal).toBe(false);
  expect(st.dialog).toBe(false);
});

test("V5. switching to another event while dirty asks first", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page);
  await dblclickTile(page, 17, 16);
  await modal(page).locator("[data-testid='event-page-name-input']").fill("전환가드");
  // 모달 밖 다른 이벤트(7,15) 더블클릭 시도 — 백드롭이 막지만 basicLeftRail 등 열려있길 기대 못하므로
  // openEventEditorModal 직접 호출 대신: 백드롭 클릭도 requestClose 가드를 타는지 확인
  const bd = await page.evaluate(() => {
    const b = document.querySelector<HTMLElement>("[data-testid='event-editor-modal']")!.getBoundingClientRect();
    return { x: 8, y: b.height - 8 };
  });
  await page.mouse.click(bd.x, bd.y);
  await page.waitForTimeout(600);
  const dlg = await page.getByRole("button", { name: /버리고 닫기/ }).first().isVisible().catch(() => false);
  console.log("BACKDROP_GUARD " + dlg);
  await page.screenshot({ path: `${SHOT_DIR}/V5-backdrop-guard.png` });
  expect(dlg).toBe(true);
});
