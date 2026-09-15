/** ⋯ 오버플로 메뉴는 300/320px 좌패널에서 잘려 있다 — 툴바를 가로 스크롤한 뒤에야 눌린다.
 *  그 두 장면(스크롤 전/후 + 열린 메뉴)을 증거로 남긴다. */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const BASE = process.env.OPRN_URL ?? "http://127.0.0.1:9977";
const OUT = join(process.cwd(), "output", "evidence", "left-sidebar-review", "shots");

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  for (const mode of ["standard", "expert"] as const) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript((m) => {
      localStorage.setItem("oprn:editor-ui-mode", m as string);
      localStorage.setItem("oprn:coachmarks-basic-v1", "1");
      localStorage.setItem("oprn:standard-welcome-seen", "1");
      localStorage.setItem("oprn:ai-panel-collapsed", "1");
    }, mode);
    await page.goto(`${BASE}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-testid="edit-canvas"]').waitFor({ state: "visible", timeout: 60_000 });

    const bar = page.locator('[data-testid="oprn-tile-toolbar"]');
    await bar.screenshot({ path: join(OUT, `${mode}-toolbar-scroll-0.png`) });
    // 툴바를 끝까지 가로 스크롤 — 이 조작 없이는 ⋯ 가 화면에 없다.
    await bar.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await bar.screenshot({ path: join(OUT, `${mode}-toolbar-scroll-end.png`) });
    await page.getByTestId("oprn-tool-overflow").click();
    await page.getByTestId("toolbar-overflow-dropdown").waitFor({ timeout: 5_000 });
    await page.locator(".left-panel").screenshot({ path: join(OUT, `${mode}-overflow-open.png`) });
    console.log("ok", mode);
    await page.close();
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
