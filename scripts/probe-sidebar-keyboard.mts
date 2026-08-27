/** 실측: 사이드바 도구 버튼을 키보드로 활성화할 수 있는가 + 활성화 후 포커스는 어디로 가는가.
 *  A1(포커스 body 낙하) / A2(Space 기본동작 취소) 두 주장을 브라우저에서 직접 확인한다. */
import { chromium } from "@playwright/test";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9977";

async function main(): Promise<void> {
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

  const tool = () => page.evaluate(() => document.body.dataset.editorTool ?? "?");
  const active = () => page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return "null";
    return `${el.tagName}${el.dataset?.testid ? `[${el.dataset.testid}]` : ""}`;
  });

  // --- Space 로 버튼 활성화 ---
  await page.getByTestId("tool-fill").focus();
  const beforeSpace = { tool: await tool(), focus: await active() };
  await page.keyboard.press("Space");
  const afterSpace = { tool: await tool(), focus: await active() };

  // --- Enter 로 버튼 활성화 + 활성화 후 포커스 ---
  await page.getByTestId("tool-erase").focus();
  const beforeEnter = { tool: await tool(), focus: await active() };
  await page.keyboard.press("Enter");
  const afterEnter = { tool: await tool(), focus: await active() };

  // --- role=toolbar 화살표 이동 ---
  await page.getByTestId("tool-select").focus();
  const beforeArrow = await active();
  await page.keyboard.press("ArrowRight");
  const afterArrow = await active();

  console.log(JSON.stringify({ beforeSpace, afterSpace, beforeEnter, afterEnter, beforeArrow, afterArrow }, null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
