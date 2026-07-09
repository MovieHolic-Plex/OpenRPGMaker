/* 데이터베이스 전 탭 전수 감사 드라이버 — 스크린샷 + 콘솔 에러 수집 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "evidence", "db-overhaul", "audit");
fs.mkdirSync(OUT, { recursive: true });

const TABS = [
  ["actors", "db-tab-actors"],
  ["classes", "db-tab-classes"],
  ["skills", "db-tab-skills"],
  ["items", "db-tab-items"],
  ["equipment", "db-tab-equipment"],
  ["enemies", "db-tab-enemies"],
  ["troops", "db-tab-troops"],
  ["elements", "db-tab-elements"],
  ["states", "db-tab-states"],
  ["animations", "db-tab-animations"],
  ["battler-animations", "db-tab-battler-animations"],
  ["battle-screen", "db-tab-battle-screen"],
  ["battle-commands", "db-tab-battle-commands"],
  ["terrain", "db-tab-terrain"],
  ["tilesets", "db-tab-tilesets"],
  ["common-events", "db-tab-common-events"],
  ["system", "db-tab-system"],
  ["terms", "db-tab-terms"],
  ["switches", "db-tab-switches"],
  ["variables", "db-tab-variables"],
];

(async () => {
  const browser = await chromium.launch({ args: ["--disable-gpu", "--use-gl=swiftshader", "--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const consoleLog = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") consoleLog.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => consoleLog.push(`[pageerror] ${err.message}`));

  await page.goto("http://127.0.0.1:5302/?freshProject=1", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.getByTestId("toolbar-database").click();
  await page.waitForSelector('[data-testid="database-modal"]', { timeout: 10000 });
  await page.waitForTimeout(500);

  for (const [slug, testId] of TABS) {
    const marker = `=== TAB ${slug} ===`;
    consoleLog.push(marker);
    try {
      await page.getByTestId(testId).click({ force: true });
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT, `tab-${slug}.png`) });
    } catch (e) {
      consoleLog.push(`[driver-error] ${slug}: ${e.message}`);
    }
  }

  fs.writeFileSync(path.join(OUT, "console.log"), consoleLog.join("\n"));
  console.log("done. console entries:", consoleLog.length);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
