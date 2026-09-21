/* P1 후반+P2 시각 QA 스윕. CI 제외(_접두사). */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createModernNocturneProject } from "@/project/defaults/modernNocturneGame";
import { seedProjectForEditor } from "./projectSeed";

const SHOT_DIR = "verify-shots/event-editor-hostile/after";
mkdirSync(SHOT_DIR, { recursive: true });
const TILE = 16;

async function openApp(page: Page, mode = "standard", w = 1440, h = 1000) {
  await page.addInitScript((m) => localStorage.setItem("oprn:editor-ui-mode", m), mode);
  await page.setViewportSize({ width: w, height: h });
  await seedProjectForEditor(page, createModernNocturneProject(), "/?e2eVitals=1");
  await page.waitForFunction(() => typeof (window as any).__oprnEditWorldToClient === "function", undefined, { timeout: 20_000 });
  await page.waitForTimeout(600);
  const skip = page.getByText("건너뛰기", { exact: true }).first();
  if (await skip.isVisible().catch(() => false)) { await skip.click(); await page.waitForTimeout(300); }
}

async function dblclickTile(page: Page, tx: number, ty: number) {
  await page.waitForFunction(() => typeof (window as any).__oprnEditWorldToClient === "function", undefined, { timeout: 15_000 });
  const pt = await page.evaluate(([x, y]) => (window as any).__oprnEditWorldToClient(x, y), [tx * TILE + 8, ty * TILE + 8]);
  await page.getByTestId("tool-event").click().catch(() => {});
  await page.waitForTimeout(300);
  await page.mouse.click(pt.x, pt.y, { clickCount: 2, delay: 60 });
  await page.waitForTimeout(1400);
}

const modal = (page: Page) => page.getByTestId("event-editor-modal");

test("X1. full standard modal + list gap + small-button audit", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page);
  await dblclickTile(page, 17, 16);
  await page.screenshot({ path: `${SHOT_DIR}/X1-standard-list-default.png` });
  const audit = await page.evaluate(() => {
    const m = document.querySelector<HTMLElement>("[data-testid='event-editor-modal']")!;
    const list = m.querySelector<HTMLElement>(".cmd-list")!;
    const toolbar = m.querySelector<HTMLElement>(".event-editor-command-toolbar")!;
    const lr = list.getBoundingClientRect(); const tr = toolbar.getBoundingClientRect();
    const smalls = Array.from(m.querySelectorAll<HTMLElement>("button")).map((b) => {
      const r = b.getBoundingClientRect();
      return { t: (b.innerText || b.getAttribute("aria-label") || b.title || b.className).trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) };
    }).filter((b) => b.w > 0 && (b.h < 24 || b.w < 24));
    return { gapToolbarToList: Math.round(lr.top - tr.bottom), smalls };
  });
  console.log("X1 " + JSON.stringify(audit));
  expect(audit.gapToolbarToList).toBeLessThan(40);
});

test("X2. storyboard pills under cards + inspector form default", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page);
  await dblclickTile(page, 17, 16);
  await modal(page).getByTestId("event-view-toggle-storyboard").click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOT_DIR}/X2a-storyboard-pills.png` });
  const pills = await page.evaluate(() => {
    const scenes = Array.from(document.querySelectorAll<HTMLElement>(".event-storyboard-scene"));
    return scenes.map((s) => ({
      title: s.querySelector(".event-storyboard-card-title")?.textContent,
      branches: Array.from(s.querySelectorAll(".event-storyboard-branch")).map((b) => (b as HTMLElement).innerText.replace(/\n/g, " ")),
    }));
  });
  console.log("X2_PILLS " + JSON.stringify(pills));
  // 카드 클릭 → 인스펙터가 form 기본으로
  await modal(page).locator(".event-storyboard-card").first().click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOT_DIR}/X2b-inspector-form.png` });
  const insp = await page.evaluate(() => {
    const i = document.querySelector<HTMLElement>("[data-testid='event-editor-inspector']")!;
    return {
      hidden: i.hidden,
      kind: i.querySelector(".event-inspector-kind")?.textContent,
      hasForm: !!i.querySelector("[data-testid='event-inspector-body']"),
      toggle: i.querySelector("[data-testid='event-inspector-density-toggle']")?.textContent,
    };
  });
  console.log("X2_INSP " + JSON.stringify(insp));
  expect(insp.hasForm).toBe(true);
});

test("X3. footer: visible test button + more menu trimmed + ok toast", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page);
  await dblclickTile(page, 17, 16);
  const footer = await page.evaluate(() => {
    const f = document.querySelector<HTMLElement>(".event-editor-modal-footer")!;
    return {
      testVisible: !!f.querySelector("[data-testid='event-editor-test']") && !f.querySelector("details")?.contains(f.querySelector("[data-testid='event-editor-test']")),
      moreItems: Array.from(f.querySelectorAll(".event-editor-footer-more-menu button")).map((b) => b.textContent?.trim()),
    };
  });
  console.log("X3_FOOTER " + JSON.stringify(footer));
  await page.screenshot({ path: `${SHOT_DIR}/X3a-footer.png` });
  await modal(page).locator("[data-testid='event-page-name-input']").fill("토스트확인");
  await modal(page).getByTestId("event-editor-ok").click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOT_DIR}/X3b-after-ok-toast.png` });
  const toast = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>("[class*='toast']")).map((t) => t.innerText?.trim().slice(0, 60)).filter(Boolean));
  console.log("X3_TOAST " + JSON.stringify(toast));
  expect(footer.testVisible).toBe(true);
});

test("X4. small viewport 1024x640 storyboard no clip", async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page, "beginner", 1024, 640);
  await dblclickTile(page, 17, 16);
  await modal(page).getByTestId("event-view-toggle-storyboard").click().catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOT_DIR}/X4-1024-storyboard.png` });
  const clip = await page.evaluate(() => {
    const track = document.querySelector<HTMLElement>(".event-storyboard-track");
    if (!track) return null;
    const tr = track.getBoundingClientRect();
    const overflow = Array.from(track.querySelectorAll<HTMLElement>(".event-storyboard-branch")).some((b) => {
      const r = b.getBoundingClientRect();
      return r.bottom > tr.bottom + 60;
    });
    return { overflow, scrollable: track.scrollWidth > track.clientWidth };
  });
  console.log("X4 " + JSON.stringify(clip));
});
