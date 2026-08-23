/* 적대적 UX 평가 4차 — ai-proposal 백드롭 차단 여부. CI 제외(_접두사). */
import { expect, test, type Page } from "@playwright/test";
import { createModernNocturneProject } from "@/project/defaults/modernNocturneGame";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
const TILE = 16;

test("P. proposal backdrop after OK: does it block input?", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "standard"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seedProjectFromSupabaseCanonical(page, createModernNocturneProject(), "/?e2eVitals=1");
  await page.waitForFunction(() => typeof (window as any).__oprnEditWorldToClient === "function", undefined, { timeout: 20_000 });
  await page.waitForTimeout(600);
  const skip = page.getByText("건너뛰기", { exact: true }).first();
  if (await skip.isVisible().catch(() => false)) { await skip.click(); await page.waitForTimeout(300); }
  const pt = await page.evaluate(([x, y]) => (window as any).__oprnEditWorldToClient(x, y), [17 * TILE + 8, 16 * TILE + 8]);
  await page.mouse.click(pt.x, pt.y, { clickCount: 2, delay: 60 });
  await page.waitForTimeout(1200);
  await page.getByTestId("event-editor-modal").locator("[data-testid='event-page-name-input']").fill("백드롭테스트");
  await page.getByTestId("event-editor-ok").click();
  await page.waitForTimeout(900);
  const info = await page.evaluate(() => {
    const bd = document.querySelector<HTMLElement>(".ai-proposal-modal-backdrop");
    const md = document.querySelector<HTMLElement>(".ai-proposal-modal");
    const rect = (el: HTMLElement | null) => { if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), display: cs.display, vis: cs.visibility, pe: cs.pointerEvents, z: cs.zIndex, op: cs.opacity }; };
    const center = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return { backdrop: rect(bd), modal: rect(md), centerHit: center ? `${center.tagName}.${(center as HTMLElement).className?.toString().slice(0, 40)}` : null };
  });
  console.log("BACKDROP " + JSON.stringify(info, null, 1));
  // 도구 버튼 클릭이 실제로 통하는지
  await page.getByTestId("tool-paint").click({ timeout: 3000 }).catch((e) => console.log("PAINT_CLICK_FAIL " + e.message.split("\n")[0]));
  const active = await page.evaluate(() => document.querySelector("[data-testid='tool-paint']")?.classList.contains("is-active"));
  console.log("PAINT_ACTIVE " + active);
  await page.screenshot({ path: "verify-shots/event-editor-hostile/P01-after-ok-proposal.png" });
  expect(true).toBe(true);
});
