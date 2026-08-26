// 진단 전용 — 하단 푸터가 화면에서 잘려 보이는 이유를 기하로 확인한다.
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";
import { openTestPlayWindow } from "./oprnPlayerStatusMenuHelpers";

const DIR = ".omo/evidence/runtime-warm-skin";

function project(): Project {
  const p = createBlankProject();
  p.session.inventory = { item_potion: 3, item_hi_potion: 1, equip_iron_sword: 1 };
  p.session = { ...p.session, partyActorIds: p.database.actors.slice(0, 4).map((a) => a.id) };
  return p;
}

test("probe: footer geometry vs clipping ancestors", async ({ page }) => {
  mkdirSync(DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectFromSupabaseCanonical(page, project(), "/?e2eVitals=1");
  await openTestPlayWindow(page);
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-stage")).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape");
  if ((await page.getByTestId("main-menu").count()) === 0) await page.keyboard.press("x");
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(400);

  const report = await page.evaluate(() => {
    const R = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), w: Math.round(r.width) };
    };
    const menu = document.querySelector("[data-testid='main-menu']")!;
    // 푸터로 보이는 것들: 소지금 / 설명 / 시간
    const cands = Array.from(menu.querySelectorAll<HTMLElement>("*")).filter((n) => {
      const t = (n.textContent ?? "").trim();
      return /^돈\s|0:00|회복합니다/.test(t) && Array.from(n.childNodes).some((c) => c.nodeType === 3 && (c.textContent ?? "").trim());
    });
    const out: Record<string, unknown>[] = [];
    for (const n of cands) {
      const chain: Record<string, unknown>[] = [];
      let a: HTMLElement | null = n.parentElement;
      while (a && chain.length < 8) {
        const cs = getComputedStyle(a);
        chain.push({
          tag: a.tagName.toLowerCase(), testid: a.dataset.testid, cls: a.className.toString().slice(0, 44),
          overflowY: cs.overflowY, overflowX: cs.overflowX, height: cs.height, maxHeight: cs.maxHeight,
          rect: R(a), clips: cs.overflowY !== "visible" || cs.overflowX !== "visible",
        });
        if (a === menu) break;
        a = a.parentElement;
      }
      const cs = getComputedStyle(n);
      out.push({
        text: (n.textContent ?? "").trim().slice(0, 30), testid: n.dataset.testid, cls: n.className.toString().slice(0, 44),
        rect: R(n), font: cs.fontSize, lineHeight: cs.lineHeight,
        scrollH: n.scrollHeight, clientH: n.clientHeight, offsetH: n.offsetHeight,
        ancestors: chain,
      });
    }
    return { menu: R(menu), stage: R(document.querySelector("[data-testid='play-stage']")!), viewport: { w: innerWidth, h: innerHeight }, footers: out };
  });

  writeFileSync(`${DIR}/probe-footer.json`, JSON.stringify(report, null, 2));
  console.log("MENU", JSON.stringify(report.menu), "STAGE", JSON.stringify(report.stage));
  for (const f of report.footers as Record<string, unknown>[]) {
    console.log(`FOOTER ${JSON.stringify(f.text)} rect=${JSON.stringify(f.rect)} font=${f.font} lh=${f.lineHeight} scrollH=${f.scrollH} clientH=${f.clientH}`);
    for (const a of f.ancestors as Record<string, unknown>[]) {
      if (a.clips) console.log(`   CLIPPER ${a.tag}.${a.cls} testid=${a.testid} overflowY=${a.overflowY} h=${a.height} maxH=${a.maxHeight} rect=${JSON.stringify(a.rect)}`);
    }
  }
});
