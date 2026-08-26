// 임시 진단 스펙: ESC 메뉴가 열렸을 때 디버그 패널이 메뉴 푸터를 실제로 덮는지 실측한다.
// scrollHeight 비교로는 안 잡히는 "가림(occlusion)" 을 사각형 교집합으로 직접 잰다.
import { test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { startNewGameFromTitle } from "./runtimeInput";
import { openTestPlayWindow } from "./oprnPlayerStatusMenuHelpers";

const DIR = ".omo/evidence/runtime-warm-skin";

function project(): Project {
  const p = createBlankProject();
  p.session = { ...p.session, partyActorIds: p.database.actors.slice(0, 4).map((a) => a.id) };
  return p;
}

test("probe: debug panel occlusion over menu footer", async ({ page }) => {
  mkdirSync(DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectFromSupabaseCanonical(page, project(), "/?e2eVitals=1");
  await openTestPlayWindow(page);
  await startNewGameFromTitle(page);
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape");
  if ((await page.getByTestId("main-menu").count()) === 0) await page.keyboard.press("x");
  await page.waitForTimeout(500);

  const data = await page.evaluate(() => {
    const r = (e: Element) => {
      const b = e.getBoundingClientRect();
      return { y: Math.round(b.y), h: Math.round(b.height), top: Math.round(b.top), bottom: Math.round(b.bottom) };
    };
    const dbg = document.querySelector(".runtime-debug-panel");
    const menu = document.querySelector("[data-testid='main-menu']");
    const dbgRect = dbg ? r(dbg) : null;
    const dbgVisible = dbg ? getComputedStyle(dbg).display !== "none" : false;

    // 메뉴 안에서 글자를 직접 가진 노드들 중, 디버그 패널 사각형과 겹치는 것을 찾는다.
    const occluded: unknown[] = [];
    if (menu && dbgRect && dbgVisible) {
      for (const n of Array.from(menu.querySelectorAll<HTMLElement>("*"))) {
        const b = n.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        const ownText = Array.from(n.childNodes).some((c) => c.nodeType === 3 && (c.textContent ?? "").trim().length > 0);
        if (!ownText) continue;
        const overlap = Math.min(b.bottom, dbgRect.bottom) - Math.max(b.top, dbgRect.top);
        if (overlap > 1) {
          occluded.push({
            cls: n.className.toString().slice(0, 50),
            text: (n.textContent ?? "").trim().slice(0, 34),
            nodeTop: Math.round(b.top), nodeBottom: Math.round(b.bottom),
            overlapPx: Math.round(overlap),
          });
        }
      }
    }
    return { debugPanel: dbgRect, debugVisible: dbgVisible, menu: menu ? r(menu) : null, occluded };
  });

  writeFileSync(`${DIR}/probe-clip2.json`, JSON.stringify(data, null, 2), "utf8");
  console.log(`DEBUG_VISIBLE=${data.debugVisible} DEBUG_RECT=${JSON.stringify(data.debugPanel)}`);
  console.log(`MENU_RECT=${JSON.stringify(data.menu)}`);
  console.log(`OCCLUDED_COUNT=${(data.occluded as unknown[]).length}`);
  for (const o of data.occluded as any[]) console.log(`  OCCLUDED "${o.text}" overlap=${o.overlapPx}px`);
  await page.getByTestId("test-play-window").screenshot({ path: `${DIR}/probe-clip2-window.png` });
});
