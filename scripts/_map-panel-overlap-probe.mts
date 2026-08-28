/**
 * beginner 플라이아웃에서 '시작' 배지가 메타 텍스트를 덮는지 실측. 진단용 임시.
 * 사용: npx tsx scripts/_map-panel-overlap-probe.mts
 */
import { chromium } from "@playwright/test";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9977";

async function run(): Promise<void> {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "beginner");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:ai-panel-collapsed", "1");
  });
  await page.goto(`${BASE}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="edit-canvas"]').waitFor({ state: "visible", timeout: 90_000 });
  await page.keyboard.press("Escape").catch(() => {});
  await page.getByTestId("basic-rail-toggle-maps").click();
  await page.waitForTimeout(600);

  const result = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="map-tree-node-"]'));
    return rows.map((row) => {
      const meta = row.querySelector<HTMLElement>(".map-tree-meta");
      const badge = row.querySelector<HTMLElement>(".start-mark");
      const more = row.querySelector<HTMLElement>(".map-tree-more");
      const rects = [meta, badge, more].map((e) => {
        if (!e) return null;
        const b = e.getBoundingClientRect();
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.right) };
      });
      const mb = rects[0];
      const bb = rects[1];
      let overlapPx = 0;
      if (mb && bb) {
        const ox = Math.min(mb.right, bb.right) - Math.max(mb.x, bb.x);
        const oy = Math.min(mb.y + mb.h, bb.y + bb.h) - Math.max(mb.y, bb.y);
        if (ox > 0 && oy > 0) overlapPx = ox;
      }
      return {
        name: row.querySelector(".map-tree-name")?.textContent,
        metaText: meta?.textContent,
        meta: mb,
        badge: bb,
        more: rects[2],
        badgeOverlapsMetaPx: overlapPx,
        rowDisplay: getComputedStyle(row).display,
        rowGridCols: getComputedStyle(row).gridTemplateColumns,
        rowClass: row.className,
        metaOverflow: meta ? getComputedStyle(meta).overflow : null,
        metaWhiteSpace: meta ? getComputedStyle(meta).whiteSpace : null,
        copyMinWidth: row.querySelector(".map-tree-copy") ? getComputedStyle(row.querySelector(".map-tree-copy")!).minWidth : null,
        hostChain: (() => {
          const out: string[] = [];
          let p: HTMLElement | null = row.parentElement;
          while (p && out.length < 6) { out.push(p.className || p.tagName); p = p.parentElement; }
          return out;
        })(),
      };
    });
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

void run();
