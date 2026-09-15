/** ⋯ 오버플로 드롭다운이 열린 뒤 실제로 화면에 보이는지 측정한다.
 *  가설: 드롭다운이 overflow-x:auto 인 30px 툴바 스트립 안에 있어 열려도 잘린다. */
import { chromium } from "@playwright/test";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const BASE = process.env.OPRN_URL ?? "http://127.0.0.1:9977";
const OUT = join(process.cwd(), "output", "evidence", "left-sidebar-review", "shots");

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:ai-panel-collapsed", "1");
  });
  await page.goto(`${BASE}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="edit-canvas"]').waitFor({ state: "visible", timeout: 60_000 });

  const bar = page.locator('[data-testid="oprn-tile-toolbar"]');
  await bar.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await page.getByTestId("oprn-tool-overflow").click();
  await page.getByTestId("toolbar-overflow-dropdown").waitFor({ timeout: 5_000 });

  const info = await page.evaluate(() => {
    const drop = document.querySelector('[data-testid="toolbar-overflow-dropdown"]') as HTMLElement | null;
    const barEl = document.querySelector('[data-testid="oprn-tile-toolbar"]') as HTMLElement | null;
    if (!drop || !barEl) return { found: false };
    const d = drop.getBoundingClientRect();
    const b = barEl.getBoundingClientRect();
    const ds = getComputedStyle(drop);
    const bs = getComputedStyle(barEl);
    // 실제 화면 위에서 드롭다운 중심 지점을 히트테스트해 무엇이 잡히는지 본다.
    const cx = Math.round(d.left + d.width / 2);
    const cy = Math.round(d.top + d.height / 2);
    const hit = document.elementFromPoint(cx, cy);
    return {
      found: true,
      dropRect: { x: Math.round(d.x), y: Math.round(d.y), w: Math.round(d.width), h: Math.round(d.height) },
      barRect: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) },
      dropPosition: ds.position,
      dropZIndex: ds.zIndex,
      dropVisibility: ds.visibility,
      dropDisplay: ds.display,
      barOverflowX: bs.overflowX,
      barOverflowY: bs.overflowY,
      dropInsideBarBox: d.top >= b.top - 1 && d.bottom <= b.bottom + 1,
      dropIsDescendantOfBar: barEl.contains(drop),
      hitTestAtDropCenter: hit ? `${hit.tagName}.${hit.className}`.slice(0, 120) : null,
      hitIsInsideDropdown: hit ? drop.contains(hit) : false,
      itemCount: drop.querySelectorAll("button").length,
      itemLabels: [...drop.querySelectorAll("button")].map((n) => (n.textContent ?? "").trim()).slice(0, 20),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: join(OUT, "measure-overflow-open-fullpage.png") });
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
