/**
 * ⋯ 메뉴가 스크롤·창 크기 변경 뒤에도 트리거에 붙어 있는지 확인한다.
 *
 * 왜 필요한가: 메뉴를 position:fixed 로 띄우면 화면에 고정된다. 트리거는 세로로 스크롤되는
 * .palette-work-pane 안에 있으므로, 스크롤하면 버튼만 떠나고 메뉴는 남아 엉뚱한 곳에 뜬다.
 * 창 크기가 바뀔 때도 같다. 리스너를 렌더마다 달면 무한히 쌓이므로 그것도 함께 센다.
 *
 * 사용: npx tsx scripts/probe-overflow-anchor-stability.mts [--port 9814] [--mode standard]
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PORT = process.argv.includes("--port") ? process.argv[process.argv.indexOf("--port") + 1]! : "9814";
const MODE = process.argv.includes("--mode") ? process.argv[process.argv.indexOf("--mode") + 1]! : "standard";
const OUT = ".omo/evidence/left-sidebar-repair";

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript((mode) => {
  localStorage.setItem("oprn:editor-ui-mode", mode as string);
  localStorage.setItem("rpg-zzu:editor-ui-mode", mode as string);
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
}, MODE);
await page.goto(`http://127.0.0.1:${PORT}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
await page.locator('[data-testid="edit-canvas"]').waitFor({ state: "visible", timeout: 90_000 });
await page.waitForTimeout(800);

/** 트리거 아래쪽 변과 메뉴 위쪽 변의 거리 — 붙어 있으면 작은 상수여야 한다. */
async function anchorGap(): Promise<string> {
  return page.evaluate(() => {
    const t = document.querySelector('[data-testid="oprn-tool-overflow"]') as HTMLElement | null;
    const m = document.querySelector('[data-testid="toolbar-overflow-dropdown"]') as HTMLElement | null;
    if (!t || !m) return "absent";
    const tr = t.getBoundingClientRect();
    const mr = m.getBoundingClientRect();
    const below = Math.round(mr.y - tr.bottom);
    const above = Math.round(tr.y - (mr.y + mr.height));
    const dx = Math.round(Math.abs(mr.x + mr.width - (tr.x + tr.width)));
    return `gapBelow=${below} gapAbove=${above} dxRight=${dx} placement=${m.dataset.placement ?? "?"}`;
  });
}

const steps: Record<string, string> = {};
await page.getByTestId("oprn-tool-overflow").click();
await page.waitForTimeout(320);
steps.afterOpen = await anchorGap();

await page.evaluate(() => {
  const pane = document.querySelector(".palette-work-pane") as HTMLElement | null;
  if (pane) pane.scrollTop = pane.scrollTop + 120;
  window.dispatchEvent(new Event("scroll"));
  document.dispatchEvent(new Event("scroll", { bubbles: true }));
});
await page.waitForTimeout(320);
steps.afterPaneScroll = await anchorGap();

await page.setViewportSize({ width: 1200, height: 820 });
await page.waitForTimeout(360);
steps.afterResize = await anchorGap();
steps.stillReachable = await page.evaluate(() => {
  const m = document.querySelector('[data-testid="toolbar-overflow-dropdown"]') as HTMLElement | null;
  if (!m) return "menu-gone";
  const r = m.getBoundingClientRect();
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) as HTMLElement | null;
  return hit && m.contains(hit) ? "reachable" : `blocked-by:${hit?.tagName}.${(hit?.className || "").split(" ")[0]}`;
});

/* 렌더마다 리스너가 쌓이지 않는지: 메뉴를 열어 둔 채 도구를 여러 번 바꿔 재렌더를 유발한다. */
steps.listenerGrowth = await page.evaluate(async () => {
  const w = window as unknown as { __anchorAdds?: number };
  w.__anchorAdds = 0;
  const original = window.addEventListener.bind(window);
  window.addEventListener = ((type: string, ...rest: unknown[]) => {
    if (type === "resize" || type === "scroll") w.__anchorAdds = (w.__anchorAdds ?? 0) + 1;
    return (original as unknown as (t: string, ...r: unknown[]) => void)(type, ...rest);
  }) as typeof window.addEventListener;
  for (let i = 0; i < 6; i += 1) {
    (document.querySelector('[data-testid="tool-paint"]') as HTMLElement | null)?.click();
    await new Promise((r) => setTimeout(r, 60));
    (document.querySelector('[data-testid="tool-select"]') as HTMLElement | null)?.click();
    await new Promise((r) => setTimeout(r, 60));
  }
  return `resize/scroll listeners added during 12 re-renders: ${w.__anchorAdds}`;
});

mkdirSync(OUT, { recursive: true });
const file = join(OUT, `after-${MODE}-anchor-stability.json`);
writeFileSync(file, JSON.stringify(steps, null, 2));
console.log(JSON.stringify(steps, null, 2));
await browser.close();
