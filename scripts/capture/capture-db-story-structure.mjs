// 자료집 개요 「이야기 구조」 절 화면 증거. 사용: DEV_SERVER_PORT=… node scripts/capture/capture-db-story-structure.mjs [project.json]
import fs from "node:fs";
import { chromium } from "playwright";

const port = process.env.DEV_SERVER_PORT ?? "9914";
const projectPath = process.argv[2];
const out = "verify-shots/editor-story-structure";
fs.mkdirSync(out, { recursive: true });
const projectJson = projectPath ? fs.readFileSync(projectPath, "utf8") : null;

const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const report = [];

async function shoot({ name, lang = "ko", scheme = "light", withProject = true }) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: scheme });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/?blankProject=1&lang=${lang}`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForFunction(() => Boolean(window.__oprnEditorStore), null, { timeout: 120000 });
  await page.waitForSelector('[data-testid="toolbar-database"]', { timeout: 120000 });
  if (withProject && projectJson) {
    await page.evaluate((json) => {
      const store = window.__oprnEditorStore;
      const current = store.getCurrent();
      const next = { ...current, ...JSON.parse(json) };
      store.replaceProject(next);
    }, projectJson);
  }
  await page.click('[data-testid="toolbar-database"]');
  try {
    await page.waitForSelector('[data-testid="db-tab-overview"]', { timeout: 60000 });
    await page.click('[data-testid="db-tab-overview"]');
    await page.waitForSelector('[data-testid="db-overview-story"]', { timeout: 60000 });
  } catch (error) {
    await page.screenshot({ path: `${out}/${name}-FAILED.png` });
    console.log("errors", errors);
    throw error;
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${name}-before-click.png` });
  await page.click('[data-testid="db-overview-story"]');
  await page.waitForTimeout(900);
  const section = page.locator('[data-testid="db-overview-story-structure"]');
  const info = await section.evaluate((node) => ({
    quests: node.querySelectorAll('[data-testid="db-overview-story-quest"]').length,
    endings: node.querySelectorAll('[data-testid="db-overview-story-ending"]').length,
    missingChips: node.querySelectorAll(".db-overview-story-switch.is-missing").length,
    top: Math.round(node.getBoundingClientRect().top),
    header: node.querySelector("header")?.textContent,
  }));
  await page.screenshot({ path: `${out}/${name}-viewport.png` });
  // 모달 본문이 스크롤 상자라 요소 캡처가 잘린다 — 절 끝(엔딩)을 화면에 올려 한 장 더 찍는다.
  await section.locator("h4").last().evaluate((node) => node.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}-endings.png` });
  report.push({ name, lang, scheme, ...info, errors: errors.slice(0, 5) });
  await page.close();
}

if (projectJson) {
  await shoot({ name: "demo-light" });
  await shoot({ name: "demo-os-dark", scheme: "dark" });
  await shoot({ name: "demo-en", lang: "en" });
}
await shoot({ name: "empty", withProject: false });
fs.writeFileSync(`${out}/summary.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
