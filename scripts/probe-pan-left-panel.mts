/** 진단: standard 모드에서 화면 밀기(pan)/통행 표시(collision)/장면 놓기(event) 선택 시 좌패널 상태. */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9999";
const OUT = join(process.cwd(), "output", "evidence", "left-sidebar-review", "shots");

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE-ERR", m.text()); });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:ai-panel-collapsed", "1");
  });
  await page.goto(`${BASE}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="edit-canvas"]').waitFor({ state: "visible", timeout: 60_000 });

  const probe = async (tag: string): Promise<void> => {
    const info = await page.evaluate(() => {
      const panel = document.querySelector(".left-panel");
      if (!panel) return { exists: false };
      const rect = panel.getBoundingClientRect();
      const style = getComputedStyle(panel as HTMLElement);
      return {
        exists: true,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        display: style.display,
        visibility: style.visibility,
        childCount: panel.childElementCount,
        html: (panel as HTMLElement).innerHTML.slice(0, 300),
        tool: document.body.dataset.editorTool ?? "?",
      };
    });
    console.log(tag, JSON.stringify(info));
  };

  await probe("before");
  for (const testid of ["tool-pan", "tool-collision", "tool-event", "tool-paint"]) {
    const btn = page.getByTestId(testid).first();
    if (!(await btn.isVisible().catch(() => false))) { console.log(testid, "ABSENT"); continue; }
    await btn.click();
    await probe(`after-${testid}`);
    await page.screenshot({ path: join(OUT, `probe-standard-${testid}.png`) });
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
