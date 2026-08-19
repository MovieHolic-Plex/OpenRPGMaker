/* 적대적 UX 평가용 임시 진단 스펙 — 스크린샷 증거 수집 전용. CI 제외(_접두사). */
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
}

async function dismissCoachmark(page: Page) {
  const skip = page.getByText("건너뛰기", { exact: true }).first();
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(300);
  }
}

async function dblclickTile(page: Page, tx: number, ty: number) {
  const pt = await page.evaluate(([x, y]) => (window as any).__rpgzzuEditWorldToClient(x, y), [tx * TILE + 8, ty * TILE + 8]);
  await page.mouse.click(pt.x, pt.y, { clickCount: 2, delay: 60 });
  await page.waitForTimeout(1200);
}

async function dumpModal(page: Page, tag: string) {
  const info = await page.evaluate(() => {
    const modal = document.querySelector<HTMLElement>("[data-testid='event-editor-modal']");
    if (!modal) return null;
    const r = modal.getBoundingClientRect();
    const btns = Array.from(modal.querySelectorAll<HTMLElement>("button")).slice(0, 60).map((b) => {
      const br = b.getBoundingClientRect();
      return { t: (b.innerText || b.getAttribute("aria-label") || b.title || "").trim().slice(0, 20), w: Math.round(br.width), h: Math.round(br.height), vis: br.width > 0 };
    }).filter((b) => b.vis);
    const scrollers = Array.from(modal.querySelectorAll<HTMLElement>("*")).filter((el) => el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 40).slice(0, 8)
      .map((el) => ({ cls: el.className.toString().slice(0, 60), sh: el.scrollHeight, ch: el.clientHeight }));
    return {
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      viewport: { w: innerWidth, h: innerHeight },
      overflowsViewport: r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.x < -1 || r.y < -1,
      smallButtons: btns.filter((b) => b.h > 0 && b.h < 24),
      buttonCount: btns.length,
      scrollers,
    };
  });
  console.log(`MODAL[${tag}] ` + JSON.stringify(info));
  return info;
}

test("A. beginner: open detective event + command flows", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page, "beginner");
  await dismissCoachmark(page);
  await dblclickTile(page, 17, 16);
  await page.screenshot({ path: `${SHOT_DIR}/A01-beginner-modal-open.png` });
  const m = await dumpModal(page, "A-open");
  expect(m).not.toBeNull();

  // 페이지 탭 구조 덤프
  const tabs = await page.evaluate(() => {
    const modal = document.querySelector<HTMLElement>("[data-testid='event-editor-modal']")!;
    return Array.from(modal.querySelectorAll<HTMLElement>("[role='tab'], .ee-page-tab, [class*='page-tab']")).map((t) => ({
      text: t.innerText?.trim().slice(0, 30), cls: t.className.toString().slice(0, 50), sel: t.getAttribute("aria-selected"),
    }));
  });
  console.log("TABS " + JSON.stringify(tabs));

  // 빈 커맨드 줄 더블클릭 → 커맨드 피커
  const emptyLine = page.getByTestId("event-command-empty-line").first();
  if (await emptyLine.isVisible().catch(() => false)) {
    await emptyLine.dblclick();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOT_DIR}/A02-command-picker.png` });
    const picker = await page.evaluate(() => {
      const p = document.querySelector<HTMLElement>("[data-testid='event-command-picker']");
      if (!p) return null;
      const items = Array.from(p.querySelectorAll<HTMLElement>("button, [role='option'], li")).slice(0, 80).map((i) => i.innerText?.trim().slice(0, 26)).filter(Boolean);
      return { count: items.length, items: items.slice(0, 40) };
    });
    console.log("PICKER " + JSON.stringify(picker));

    // 메시지 계열 커맨드 선택 시도
    const msgBtn = page.locator("[data-testid='event-command-picker'] button, [data-testid='event-command-picker'] [role='option']").filter({ hasText: /메시지|대사|텍스트/ }).first();
    if (await msgBtn.isVisible().catch(() => false)) {
      await msgBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${SHOT_DIR}/A03-message-command-options.png` });
    } else {
      await page.screenshot({ path: `${SHOT_DIR}/A03-no-message-btn.png` });
    }
  } else {
    console.log("EMPTYLINE not visible");
    await page.screenshot({ path: `${SHOT_DIR}/A02-no-empty-line.png` });
  }

  // 편집(더티) 상태에서 ESC → 경고 여부
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOT_DIR}/A04-after-escape.png` });
  const afterEsc = await page.evaluate(() => ({
    modalStill: !!document.querySelector("[data-testid='event-editor-modal']"),
    dialogs: Array.from(document.querySelectorAll<HTMLElement>("[role='dialog'], [role='alertdialog']")).map((d) => d.innerText?.trim().slice(0, 80)),
  }));
  console.log("AFTER_ESC " + JSON.stringify(afterEsc));

  // 모달이 닫혔다면 다시 열어 드래프트 보존 확인
  if (!afterEsc.modalStill) {
    await dblclickTile(page, 17, 16);
    await page.screenshot({ path: `${SHOT_DIR}/A05-reopen-after-escape.png` });
  } else {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOT_DIR}/A05-escape-x2.png` });
  }
});

test("B. beginner: new event on empty tile", async ({ page }) => {
  test.setTimeout(180_000);
  await openApp(page, "beginner");
  await dismissCoachmark(page);
  await dblclickTile(page, 14, 12); // 빈 도로 타일
  await page.screenshot({ path: `${SHOT_DIR}/B01-new-event-dblclick-empty.png` });
  await dumpModal(page, "B-new");
  const state = await page.evaluate(() => ({
    modal: !!document.querySelector("[data-testid='event-editor-modal']"),
    toasts: Array.from(document.querySelectorAll<HTMLElement>("[class*='toast']")).map((t) => t.innerText?.trim().slice(0, 60)),
  }));
  console.log("NEWEV " + JSON.stringify(state));
});

test("C. expert: modal + context menu + footer", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page, "expert");
  await dismissCoachmark(page);
  await dblclickTile(page, 17, 16);
  await page.screenshot({ path: `${SHOT_DIR}/C01-expert-modal.png` });
  await dumpModal(page, "C-expert");

  // 커맨드 줄 우클릭 → 컨텍스트 메뉴
  const line = page.locator("[data-testid='event-editor-modal'] [class*='command']").filter({ hasText: /.+/ }).first();
  if (await line.isVisible().catch(() => false)) {
    await line.click({ button: "right" });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOT_DIR}/C02-context-menu.png` });
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // 4커맨드짜리 골목 유령 이벤트
  await dblclickTile(page, 7, 15);
  await page.screenshot({ path: `${SHOT_DIR}/C03-expert-alley-ghost.png` });
});

test("D. small viewport 1280x720: overflow check", async ({ page }) => {
  test.setTimeout(180_000);
  await openApp(page, "standard", 1280, 720);
  await dismissCoachmark(page);
  await dblclickTile(page, 17, 16);
  await page.screenshot({ path: `${SHOT_DIR}/D01-1280x720-modal.png` });
  await dumpModal(page, "D-1280");
});

test("E. keyboard traversal inside modal", async ({ page }) => {
  test.setTimeout(180_000);
  await openApp(page, "standard");
  await dismissCoachmark(page);
  await dblclickTile(page, 17, 16);
  const seq: string[] = [];
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(120);
    const f = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return "null";
      const inModal = !!el.closest("[data-testid='event-editor-modal']");
      return `${el.tagName.toLowerCase()}${el.dataset.testid ? `[${el.dataset.testid}]` : ""}:${(el.innerText || (el as HTMLInputElement).placeholder || "").trim().slice(0, 14)}${inModal ? "" : " (모달밖!)"}`;
    });
    seq.push(f);
  }
  console.log("TABSEQ " + JSON.stringify(seq, null, 1));
  await page.screenshot({ path: `${SHOT_DIR}/E01-focus-after-18tabs.png` });
});
