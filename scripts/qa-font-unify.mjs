// C1 증거 수집 — DB → 시스템 → 폰트에서 글꼴을 고르면 에디터와 런타임 텍스트가 함께 바뀌는지
// 실제 Chromium 에서 확인한다. 판정은 사람 눈이 아니라 getComputedStyle 값으로 한다.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.QA_BASE ?? "http://localhost:9808";
const OUT = resolve(process.env.QA_OUT ?? ".omo/evidence/font-unify-20260827");
mkdirSync(OUT, { recursive: true });

const log = [];
const record = (label, value) => {
  log.push(`${label}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
  console.log(`${label}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
};

const rootFontVars = (page) =>
  page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    return {
      ui: style.getPropertyValue("--font-ui").trim(),
      pixel: style.getPropertyValue("--font-pixel").trim(),
      mono: style.getPropertyValue("--font-mono").trim(),
      runtimePixel: style.getPropertyValue("--runtime-pixel-font").trim(),
      bodyResolved: body.fontFamily,
    };
  });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

await page.goto(`${BASE}/?blankProject=1`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("body", { state: "attached" });
await page.waitForTimeout(0);
await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue("--font-ui").trim().length > 0);

record("BEFORE root vars", await rootFontVars(page));
await page.screenshot({ path: resolve(OUT, "01-editor-default.png"), fullPage: false });

// 시스템 탭까지의 경로는 UI 변경에 취약하므로, 저장 경로 자체를 스토어로 검증하고
// 화면 반영은 CSS 변수로 판정한다. 먼저 폰트 섹션이 실제로 존재하는지 DOM 으로 확인한다.
const dbOpened = await page.evaluate(async () => {
  const module = await import("/src/editor/panels/databaseModal.ts");
  module.openDatabaseModal("system");
  return true;
});
record("database modal opened", dbOpened);
await page.waitForSelector('[data-testid="db-system-nav-font"]', { timeout: 15000 });
await page.click('[data-testid="db-system-nav-font"]');
await page.waitForSelector('[data-testid="db-field-system-font-ui"]:visible', { timeout: 15000 });

const options = await page.$$eval('[data-testid="db-field-system-font-ui"] option', (nodes) =>
  nodes.map((node) => ({ value: node.getAttribute("value"), label: node.textContent })),
);
record("ui font options", options);
await page.screenshot({ path: resolve(OUT, "02-font-section-default.png") });

await page.selectOption('[data-testid="db-field-system-font-ui"]', "galmuri11");
await page.selectOption('[data-testid="db-field-system-font-pixel"]', "galmuri9");
await page.waitForFunction(
  () => getComputedStyle(document.documentElement).getPropertyValue("--font-ui").includes("Galmuri11"),
  { timeout: 15000 },
);

const after = await rootFontVars(page);
record("AFTER root vars", after);
await page.screenshot({ path: resolve(OUT, "03-font-section-galmuri.png") });

const persisted = await page.evaluate(async () => {
  const { store } = await import("/src/project/store.ts");
  return store.getCurrent().system.fonts ?? null;
});
record("persisted system.fonts", persisted);

const normalizedRoundtrip = await page.evaluate(async () => {
  const { store } = await import("/src/project/store.ts");
  const { normalizeSystemRecords } = await import("/src/project/databaseRecordModel.ts");
  return normalizeSystemRecords(store.getCurrent().system).fonts ?? null;
});
record("normalize roundtrip fonts", normalizedRoundtrip);

// 런타임도 같은 토큰을 쓰는지: 픽셀 토큰 별칭이 새 선택으로 따라왔는지 본다.
const runtimeFollows = after.runtimePixel.includes("Galmuri9");
record("runtime pixel token followed selection", runtimeFollows);

const uiFollows = after.ui.includes("Galmuri11");
record("editor ui token followed selection", uiFollows);
const bodyFollows = after.bodyResolved.includes("Galmuri11");
record("body computed fontFamily followed selection", bodyFollows);

const resetButton = await page.$('[data-testid="db-system-font-reset"]');
if (resetButton) {
  await resetButton.click();
  await page.waitForFunction(
    () => !getComputedStyle(document.documentElement).getPropertyValue("--font-ui").includes("Galmuri11"),
    { timeout: 15000 },
  );
  record("AFTER reset root vars", await rootFontVars(page));
  await page.screenshot({ path: resolve(OUT, "04-after-reset.png") });
}

record("console errors", consoleErrors.slice(0, 10));
writeFileSync(resolve(OUT, "computed-vars.log"), `${log.join("\n")}\n`, "utf8");
await browser.close();

const pass = uiFollows && runtimeFollows && bodyFollows && persisted?.ui === "galmuri11";
console.log(`\nC1 VERDICT: ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
