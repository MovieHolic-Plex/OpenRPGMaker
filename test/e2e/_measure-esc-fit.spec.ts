// 진단 전용 스펙 — ESC 메뉴 레이아웃 실측(잘림/넘침을 숫자로 잡는다).
import { test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { seedProjectForEditor } from "./projectSeed";
import { startNewGameFromTitle } from "./runtimeInput";
import { openTestPlayWindow } from "./oprnPlayerStatusMenuHelpers";

const DIR = ".omo/evidence/runtime-menu-visual";

function project(): Project {
  const p = createBlankProject();
  p.session.inventory = { item_potion: 3, item_ether: 1, item_antidote: 2, item_hi_potion: 1 };
  p.session = { ...p.session, partyActorIds: p.database.actors.slice(0, 4).map((a) => a.id) };
  // 얼굴 한 칸 = 파일 한 장 — 칸 번호가 아니라 낱장 얼굴 파일을 저작한다.
  const second = p.database.actors[1];
  if (second) second.faceResourceId = "easyrpg-faceset-actor2-02";
  return p;
}

test("measure: esc menu fit", async ({ page }) => {
  mkdirSync(DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectForEditor(page, project(), "/?e2eVitals=1");
  await openTestPlayWindow(page);
  await startNewGameFromTitle(page);
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape");
  if ((await page.getByTestId("main-menu").count()) === 0) await page.keyboard.press("x");
  await page.waitForTimeout(500);
  await page.getByTestId("status-menu-command-items").click();
  await page.waitForTimeout(400);

  const report = await page.evaluate(() => {
    const stage = document.querySelector("[data-testid='play-stage']") as HTMLElement | null;
    const menu = document.querySelector("[data-testid='main-menu']") as HTMLElement | null;
    if (!menu) throw new Error("no menu");
    // 논리 픽셀로 환산하기 위한 스케일.
    const scale = stage ? stage.getBoundingClientRect().width / (Number.parseFloat(stage.style.width) || 320) : 1;
    const L = (v: number) => Math.round((v / scale) * 100) / 100;

    const clipped: unknown[] = [];
    for (const n of Array.from(menu.querySelectorAll<HTMLElement>("*"))) {
      const r = n.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const overflowX = n.scrollWidth - n.clientWidth;
      const overflowY = n.scrollHeight - n.clientHeight;
      if (overflowX > 1 || overflowY > 1) {
        clipped.push({
          testid: n.dataset.testid ?? null,
          cls: n.className.toString().slice(0, 64),
          text: (n.textContent ?? "").trim().slice(0, 28),
          clientW: L(n.clientWidth), scrollW: L(n.scrollWidth),
          clientH: L(n.clientHeight), scrollH: L(n.scrollHeight),
          overflowX: L(overflowX), overflowY: L(overflowY),
        });
      }
    }
    const box = (sel: string) => {
      const n = menu.querySelector(sel) as HTMLElement | null;
      if (!n) return null;
      const r = n.getBoundingClientRect();
      const cs = getComputedStyle(n);
      return { w: L(r.width), h: L(r.height), fontSize: cs.fontSize, top: L(r.top), bottom: L(r.bottom) };
    };
    const rows = Array.from(menu.querySelectorAll<HTMLElement>(".status-menu-detail-row")).map((n) => ({
      testid: n.dataset.testid ?? null,
      text: (n.textContent ?? "").trim().slice(0, 24),
      top: L(n.getBoundingClientRect().top),
      bottom: L(n.getBoundingClientRect().bottom),
      h: L(n.getBoundingClientRect().height),
    }));
    const list = menu.querySelector(".status-menu-detail-list") as HTMLElement | null;
    return {
      scale: Math.round(scale * 100) / 100,
      stageLogical: stage ? { w: L(stage.getBoundingClientRect().width), h: L(stage.getBoundingClientRect().height) } : null,
      partyPanel: box(".status-menu-party"),
      partyRow0: box(".status-menu-party-row"),
      actorName0: box(".status-menu-actor-name"),
      vitals0: box(".status-menu-actor-vitals"),
      face0: box(".status-menu-face"),
      detail: box(".status-menu-detail"),
      detailList: list ? { ...box(".status-menu-detail-list")!, clientH: L(list.clientHeight), scrollH: L(list.scrollHeight) } : null,
      dock: box(".status-menu-primary-dock"),
      detailRowCount: rows.length,
      detailRows: rows,
      clipped,
    };
  });

  writeFileSync(`${DIR}/measure-esc-fit.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
});
