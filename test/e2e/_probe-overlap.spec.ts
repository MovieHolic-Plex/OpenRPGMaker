import { expect, test } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";
import { openTestPlayWindow } from "./oprnPlayerStatusMenuHelpers";
test("probe: what overlaps the footer", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const p = createBlankProject();
  p.session = { ...p.session, partyActorIds: p.database.actors.slice(0,4).map(a=>a.id) };
  await seedProjectFromSupabaseCanonical(page, p as never, "/?e2eVitals=1");
  await openTestPlayWindow(page);
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-stage")).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.keyboard.press("Escape");
  if ((await page.getByTestId("main-menu").count()) === 0) await page.keyboard.press("x");
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 8000 });
  const r = await page.evaluate(() => {
    const f = Array.from(document.querySelectorAll<HTMLElement>(".status-menu-footer"))[0];
    const fr = f.getBoundingClientRect();
    // 푸터 중앙에서 실제로 가장 위에 있는 요소가 무엇인가
    const mid = document.elementFromPoint(fr.left + fr.width/2, fr.top + fr.height/2);
    const hits: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "absolute") continue;
      const r2 = el.getBoundingClientRect();
      if (r2.width===0||r2.height===0) continue;
      const overlaps = !(r2.right<fr.left||r2.left>fr.right||r2.bottom<fr.top||r2.top>fr.bottom);
      if (overlaps && el !== f && !f.contains(el) && !el.contains(f)) {
        hits.push(`${el.tagName.toLowerCase()}.${el.className.toString().slice(0,40)} testid=${el.dataset.testid} pos=${cs.position} z=${cs.zIndex} rect=${JSON.stringify({t:Math.round(r2.top),b:Math.round(r2.bottom)})}`);
      }
    }
    return { footer: {t:Math.round(fr.top),b:Math.round(fr.bottom)}, topmost: mid ? `${mid.tagName.toLowerCase()}.${(mid as HTMLElement).className.toString().slice(0,40)}` : null, overlappers: hits.slice(0,8) };
  });
  console.log("FOOTER", JSON.stringify(r.footer));
  console.log("TOPMOST_AT_FOOTER_CENTER", r.topmost);
  r.overlappers.forEach(h=>console.log("OVERLAP", h));
});
