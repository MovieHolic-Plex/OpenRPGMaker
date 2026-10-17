// 자료집 「메뉴·시스템」 탭 시각 QA 캡처 — 일반(비연애)·연애 프로젝트, 원 해상도.
// 사용: DEV_SERVER_PORT=<포트> node scripts/capture-menu-system-tab.mjs [outDir] [--mode beginner|expert]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { gotoWithRetry } from "./lib/goto-retry.mjs";

const PORT = process.env.DEV_SERVER_PORT ?? "9976";
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.argv[2] ?? "verify-shots/menu-system-tab";
const MODE = process.argv.includes("--mode") ? process.argv[process.argv.indexOf("--mode") + 1] : "expert";
const VIEWPORT = process.env.VIEWPORT ? { width: Number(process.env.VIEWPORT.split("x")[0]), height: Number(process.env.VIEWPORT.split("x")[1]) } : { width: 1440, height: 900 };
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--disable-features=NetworkChangeNotifier"] });

async function open(romance) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.addInitScript(([mode, locale]) => { localStorage.setItem("oprn:editor-ui-mode", mode); if (locale) localStorage.setItem("oprn:locale", locale); }, [MODE, process.env.LOCALE ?? ""]);
  await gotoWithRetry(page, `${BASE}/?freshProject=1`);
  await page.waitForFunction(() => !!window.__oprnEditorStore, null, { timeout: 120000 });
  await page.waitForFunction(() => !document.querySelector("#boot-splash, .boot-splash:not([hidden])") || getComputedStyle(document.querySelector("#boot-splash, .boot-splash")).display === "none", null, { timeout: 120000 }).catch(() => {});
  await page.getByTestId("toolbar-database").waitFor({ state: "visible", timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(5000); // 신규 프로젝트 비동기 로드가 끝나기 전에 모달을 열면 프로젝트 전환으로 닫힌다.
  if (romance) {
    await page.evaluate(() => window.__oprnEditorStore.update((d) => { d.system.genreLock = { preset: "romance", mode: "warn", allowedFamilies: [] }; }, { scope: "system", label: "qa" }));
  }
  await page.evaluate(async () => {
    const mod = await import("/src/editor/panels/databaseModal.ts");
    mod.openDatabaseModal("menuSystem");
  });
  await page.getByTestId("database-modal").waitFor({ state: "visible" });
  await page.getByTestId("db-menu-system-intro").waitFor({ state: "visible" });
  return { context, page, modal: page.getByTestId("database-modal") };
}
const shot = async (modal, name) => modal.screenshot({ path: `${OUT}/${MODE}${process.env.VIEWPORT ? "-" + process.env.VIEWPORT : ""}${process.env.LOCALE ? "-" + process.env.LOCALE : ""}-${name}.png` });
const cards = async (page, name) => {
  for (const card of ["dialogue", "extras"]) {
    const node = page.getByTestId(`db-menu-system-${card}-card`);
    await node.scrollIntoViewIfNeeded();
    await node.screenshot({ path: `${OUT}/${MODE}${process.env.VIEWPORT ? "-" + process.env.VIEWPORT : ""}${process.env.LOCALE ? "-" + process.env.LOCALE : ""}-${name}-${card}-card.png` });
  }
};
const project = (page, expr) => page.evaluate(expr);

// 1) 비연애
{
  const { context, page, modal } = await open(false);
  await shot(modal, "a1-general-default");
  await page.getByTestId("db-menu-system-starter-custom").click();
  await shot(modal, "a2-general-custom-menu");
  await page.getByTestId("db-menu-system-backlog").evaluate((el) => el.click());
  await page.getByTestId("db-menu-system-gallery").evaluate((el) => el.click());
  await shot(modal, "a3-general-after-toggles");
  await cards(page, "a3-general");
  console.log("general menuUiStyle", await project(page, () => window.__oprnEditorStore.getCurrent().system.menuUiStyle));
  await context.close();
}
// 2) 연애
{
  const { context, page, modal } = await open(true);
  await shot(modal, "b1-romance-default");
  const input = page.getByTestId("db-menu-system-label-items");
  await input.fill("가방");
  await input.press("Enter");
  await page.getByTestId("db-menu-system-down-items").click();
  await shot(modal, "b2-romance-renamed-moved");
  await page.getByTestId("db-menu-system-backlog").evaluate((el) => el.click());
  await shot(modal, "b3-romance-backlog-off-warning");
  await cards(page, "b3-romance");
  await page.getByTestId("db-menu-system-fix-backlog-entry-off").click();
  await page.getByTestId("db-menu-system-label-items").fill("   ");
  await page.getByTestId("db-menu-system-label-items").press("Enter");
  await shot(modal, "b4-romance-rejected-label");
  await context.close();
}
await browser.close();
console.log("done ->", OUT);
