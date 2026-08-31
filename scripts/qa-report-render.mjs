// HTML 보고서를 실제 브라우저로 렌더해 이미지가 깨졌는지, 빈 화면이 아닌지 확인한다.
// 사용: node scripts/qa-report-render.mjs reports/item-catalog-report.html
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const target = resolve(process.cwd(), process.argv[2] ?? "reports/item-catalog-report.html");
// 출력 경로는 SHOT_OUT 으로 갈아 끼운다. verify-shots/report-render/ 는 이미 다른 작업의
// 추적된 증거가 사는 자리라 기본값으로 쓰면 남의 PNG 를 덮는다(실측으로 한 번 덮었다).
const OUT = resolve(process.cwd(), process.env.SHOT_OUT ?? "verify-shots/item-catalog-report-render");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const failures = [];
page.on("requestfailed", (request) => failures.push(request.url().slice(0, 120)));
try {
  await page.goto(`file://${target}`, { waitUntil: "load" });
  await page.waitForFunction(() => {
    const images = [...document.images];
    return images.length > 0 && images.every((img) => img.complete);
  }, { timeout: 60_000 });

  const audit = await page.evaluate(() => {
    const images = [...document.images];
    return {
      imageCount: images.length,
      broken: images.filter((img) => img.naturalWidth === 0).length,
      missingNotes: document.querySelectorAll("p.missing").length,
      docHeight: document.documentElement.scrollHeight,
      headings: [...document.querySelectorAll("h1,h2")].map((node) => node.textContent?.trim()),
      tableRows: document.querySelectorAll("tbody tr").length,
    };
  });
  console.log("[audit]", JSON.stringify(audit, null, 1));
  console.log("[requestfailed]", failures.length === 0 ? "none" : failures);

  await page.screenshot({ path: resolve(OUT, "report-top.png") });
  await page.screenshot({ path: resolve(OUT, "report-full.png"), fullPage: true });
  console.log(`[shot] ${resolve(OUT, "report-top.png")}`);
  console.log(`[shot] ${resolve(OUT, "report-full.png")}`);

  const bad = audit.broken > 0 || audit.missingNotes > 0 || audit.imageCount === 0 || audit.docHeight < 2000;
  console.log(bad ? "VERDICT=BAD" : "VERDICT=OK");
  if (bad) process.exitCode = 1;
} finally {
  await browser.close();
}
