// todo 13 manual QA probe — overview tab shell.
// Opens editor at 1280x800, opens DB modal, clicks '개요', asserts stat chips + charts placeholder,
// screenshots .superpowers/sdd/qa-shots/overview-tab-1280.png.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.QA_BASE_URL ?? "http://127.0.0.1:9185";
const SHOT_DIR = ".superpowers/sdd/qa-shots";

const STAT_COLLECTIONS = [
  "actors",
  "classes",
  "skills",
  "items",
  "equipment",
  "enemies",
  "troops",
  "states",
  "battleAnimations",
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(String(err)));

// expert 모드에서만 클래식 툴바(toolbar-database 포함)가 렌더된다.
await page.addInitScript(() => {
  try {
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  } catch {}
});

try {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("database-modal").waitFor({ state: "visible", timeout: 15000 });

  // Sidebar top pinned overview entry — click it.
  const overviewTab = page.getByTestId("db-tab-overview");
  await overviewTab.waitFor({ state: "visible", timeout: 10000 });
  const overviewText = (await overviewTab.textContent())?.trim() ?? "";
  await overviewTab.click();
  await page.waitForTimeout(500);

  // Stat chips with counts.
  const chips = {};
  for (const collection of STAT_COLLECTIONS) {
    const chip = page.getByTestId(`db-overview-stat-${collection}`);
    await chip.waitFor({ state: "visible", timeout: 10000 });
    chips[collection] = (await chip.textContent())?.trim() ?? "";
  }
  const charts = await page.getByTestId("db-overview-charts").count();

  // Sidebar button active state.
  const activeClass = await overviewTab.getAttribute("class");

  mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: `${SHOT_DIR}/overview-tab-1280.png` });

  console.log("QA_RESULT overviewLabel=%s active=%s chartsPlaceholder=%d chips=%j",
    overviewText, activeClass, charts, chips);
  console.log("CONSOLE_ERRORS=%j", consoleErrors.filter((e) => !e.includes("127.0.0.1:17831")));
  await browser.close();

  const chipCounts = Object.values(chips);
  const ok = overviewText === "개요"
    && (activeClass ?? "").includes("active")
    && charts === 1
    && chipCounts.length === 9
    && chipCounts.every((c) => /\d+$/u.test(c));
  console.log(ok ? "QA_PASS" : "QA_FAIL");
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error("QA_PROBE_ERROR", err);
  await browser.close();
  process.exit(1);
}
