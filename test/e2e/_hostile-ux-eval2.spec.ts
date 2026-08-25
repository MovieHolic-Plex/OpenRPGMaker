/* 적대적 UX 평가 2차 — 스크린샷 증거 수집 전용. CI 제외(_접두사). */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createModernNocturneProject } from "@/project/defaults/modernNocturneGame";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const SHOT_DIR = "verify-shots/event-editor-hostile";
mkdirSync(SHOT_DIR, { recursive: true });
const TILE = 16;

async function openApp(page: Page, mode: string, w = 1440, h = 1000) {
  await page.addInitScript((m) => localStorage.setItem("oprn:editor-ui-mode", m), mode);
  await page.setViewportSize({ width: w, height: h });
  await seedProjectFromSupabaseCanonical(page, createModernNocturneProject(), "/?e2eVitals=1");
  await page.waitForFunction(() => typeof (window as any).__oprnEditWorldToClient === "function", undefined, { timeout: 20_000 });
  await page.waitForTimeout(600);
  const skip = page.getByText("건너뛰기", { exact: true }).first();
  if (await skip.isVisible().catch(() => false)) { await skip.click(); await page.waitForTimeout(300); }
}

async function dblclickTile(page: Page, tx: number, ty: number) {
  const pt = await page.evaluate(([x, y]) => (window as any).__oprnEditWorldToClient(x, y), [tx * TILE + 8, ty * TILE + 8]);
  await page.mouse.click(pt.x, pt.y, { clickCount: 2, delay: 60 });
  await page.waitForTimeout(1200);
}

const modal = (page: Page) => page.getByTestId("event-editor-modal");

test("F. dirty-state escape guard + data loss", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page, "standard");
  await dblclickTile(page, 17, 16);
  // 이름 수정 → 더티 상태
  const name = modal(page).locator("[data-testid='event-page-name-input']");
  await name.fill("형사 지안 (수정본)");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOT_DIR}/F01-name-edited.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOT_DIR}/F02-escape-while-dirty.png` });
  const st = await page.evaluate(() => ({
    modalStill: !!document.querySelector("[data-testid='event-editor-modal']"),
    dialogs: Array.from(document.querySelectorAll<HTMLElement>("[role='dialog'], [role='alertdialog'], [class*='confirm']")).map((d) => d.innerText?.trim().slice(0, 120)),
  }));
  console.log("DIRTY_ESC " + JSON.stringify(st));
  // 다시 열어 이름이 남았는지 (데이터 유실 확인)
  if (!st.modalStill) {
    await dblclickTile(page, 17, 16);
    const nameVal = await modal(page).locator("[data-testid='event-page-name-input']").inputValue().catch(() => "N/A");
    console.log("REOPEN_NAME " + JSON.stringify(nameVal));
    await page.screenshot({ path: `${SHOT_DIR}/F03-reopen-name-check.png` });
  }
});

test("G. list view + command picker + context menu", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page, "standard");
  await dblclickTile(page, 17, 16);
  await modal(page).getByTestId("event-view-toggle-list").click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOT_DIR}/G01-list-view.png` });

  const empty = page.getByTestId("event-command-empty-line").first();
  console.log("EMPTY_VISIBLE " + (await empty.isVisible().catch(() => false)));
  if (await empty.isVisible().catch(() => false)) {
    await empty.dblclick();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOT_DIR}/G02-command-picker.png` });
    const picker = await page.evaluate(() => {
      const p = document.querySelector<HTMLElement>("[data-testid='event-command-picker']");
      if (!p) return null;
      const r = p.getBoundingClientRect();
      const items = Array.from(p.querySelectorAll<HTMLElement>("button, [role='option'], li")).map((i) => i.innerText?.trim().replace(/\n/g, "|").slice(0, 30)).filter(Boolean);
      return { rect: `${Math.round(r.width)}x${Math.round(r.height)}`, count: items.length, first20: items.slice(0, 20) };
    });
    console.log("PICKER " + JSON.stringify(picker));
    // 검색 입력이 있으면 '전투' 검색
    const search = page.locator("[data-testid='event-command-picker'] input[type='text'], [data-testid='event-command-picker'] input[type='search']").first();
    if (await search.isVisible().catch(() => false)) {
      await search.fill("전투");
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOT_DIR}/G03-picker-search.png` });
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  // 리스트 커맨드 줄 우클릭
  const lines = modal(page).locator("[class*='command-line'], [class*='cmdline'], [data-testid*='command-row'], li");
  const cnt = await lines.count();
  console.log("LINE_COUNT " + cnt);
  if (cnt > 0) {
    await lines.first().click({ button: "right" });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOT_DIR}/G04-list-context-menu.png` });
    const menu = await page.evaluate(() => {
      const m = document.querySelector<HTMLElement>("[data-testid='event-command-context-menu']");
      return m ? m.innerText.replace(/\n/g, " | ").slice(0, 200) : null;
    });
    console.log("CTXMENU " + JSON.stringify(menu));
  }
});

test("H. storyboard card edit + add command + graph view", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page, "standard");
  await dblclickTile(page, 17, 16);
  // 카드 1(대사) 클릭 → 편집 UI
  const card = modal(page).locator("[class*='storyboard'] [class*='card'], [class*='scene-card']").filter({ hasText: "대사" }).first();
  if (await card.isVisible().catch(() => false)) {
    await card.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOT_DIR}/H01-card-click-edit.png` });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  } else {
    console.log("CARD not found");
  }
  // + 명령 버튼
  const addBtn = modal(page).getByText("+ 명령", { exact: false }).first();
  if (await addBtn.isVisible().catch(() => false)) {
    await addBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOT_DIR}/H02-add-command.png` });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  // Graph 뷰
  const stillOpen = await modal(page).isVisible().catch(() => false);
  if (!stillOpen) await dblclickTile(page, 17, 16);
  await modal(page).getByTestId("event-view-toggle-graph").click().catch(async () => {
    await modal(page).getByText("Graph", { exact: true }).click();
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOT_DIR}/H03-graph-view.png` });
});

test("I. zoomed element shots: xy inputs, footer, dock, page menu", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page, "standard");
  await dblclickTile(page, 7, 15); // Y=15 잘림 의심 이벤트
  const xy = modal(page).locator("[data-testid='event-position-x']");
  const xyVal = await xy.inputValue().catch(() => "N/A");
  const yVal = await modal(page).locator("[data-testid='event-position-y']").inputValue().catch(() => "N/A");
  console.log("XY_VALUES " + JSON.stringify({ x: xyVal, y: yVal }));
  const xyBox = modal(page).locator("[data-testid='event-position-x']").locator("xpath=ancestor::*[3]");
  await xyBox.screenshot({ path: `${SHOT_DIR}/I01-xy-inputs-zoom.png` }).catch(() => page.screenshot({ path: `${SHOT_DIR}/I01-xy-fallback.png` }));

  // 명령 툴바의 보조 도구 팝오버를 연다.
  const tools = modal(page).getByTestId("event-editor-aux-tools");
  if (await tools.isVisible().catch(() => false)) {
    await tools.locator(":scope > summary").click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOT_DIR}/I02-toolbar-tools-open.png` });
  } else { console.log("TOOLS menu not found"); }

  // 더보기 메뉴
  const more = modal(page).getByText("더보기", { exact: false }).first();
  if (await more.isVisible().catch(() => false)) {
    await more.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOT_DIR}/I03-more-menu.png` });
    await page.keyboard.press("Escape");
  }
  // 페이지 드롭다운(우상단)
  const pageBtn = modal(page).getByText("페이지", { exact: false }).last();
  if (await pageBtn.isVisible().catch(() => false)) {
    await pageBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOT_DIR}/I04-page-menu.png` });
  }
});

test("J. right clipped panel + choice pills anatomy", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page, "standard");
  await dblclickTile(page, 17, 16);
  // 오른쪽 끝 잘린 패널의 정체 확인
  const clip = await page.evaluate(() => {
    const modal = document.querySelector<HTMLElement>("[data-testid='event-editor-modal']")!;
    const mr = modal.getBoundingClientRect();
    const cands = Array.from(modal.querySelectorAll<HTMLElement>("*")).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 20 && r.height > 100 && r.right > mr.right - 4 && r.left > mr.right - 120;
    }).slice(0, 5).map((el) => ({ cls: el.className.toString().slice(0, 70), text: el.innerText?.trim().slice(0, 60) }));
    return cands;
  });
  console.log("RIGHT_CLIP " + JSON.stringify(clip, null, 1));
  // 선택지 가지 pill 정보
  const pills = await page.evaluate(() => {
    const modal = document.querySelector<HTMLElement>("[data-testid='event-editor-modal']")!;
    return Array.from(modal.querySelectorAll<HTMLElement>("*")).filter((el) => /사라지지 않아|준비가 안/.test(el.innerText ?? "") && el.children.length <= 2 && el.innerText.length < 30)
      .slice(0, 6).map((el) => ({ cls: el.className.toString().slice(0, 60), text: el.innerText.trim().slice(0, 30), clickable: !!el.closest("button, a, [role='button']") }));
  });
  console.log("PILLS " + JSON.stringify(pills, null, 1));
  // pill 클릭해보기
  const pill = modal(page).getByText("기록은 사라지지 않아", { exact: false }).first();
  if (await pill.isVisible().catch(() => false)) {
    await pill.click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SHOT_DIR}/J01-pill-clicked.png` });
  }
  expect(true).toBe(true);
});
