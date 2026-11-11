// openingShots.mts 의 브라우저 쪽 — dev 서버의 실제 모듈로 검수용 표본 그림을 그려 PNG 로 쓴다.
//   node openingShots.browser.mjs <origin> <project.json> <shots.json> <outPrefix>
import fs from "node:fs";
import { chromium } from "playwright";

const [origin, projectFile, shotsFile, prefix] = process.argv.slice(2);
const project = JSON.parse(fs.readFileSync(projectFile, "utf8")), shots = JSON.parse(fs.readFileSync(shotsFile, "utf8"));
const browser = await chromium.launch({ args: ["--disable-features=NetworkChangeNotifier", "--disable-background-networking"] });
try {
  const page = await browser.newPage();
  await page.route("**/opening-shots-probe.html", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>opening shots</title>" }));
  await page.goto(new URL("/opening-shots-probe.html", origin).href);
  await page.evaluate((p) => { globalThis.__project = p; }, project);
  for (const [i, shot] of shots.entries()) {
    const url = await page.evaluate(async ({ shotId, atMs }) => {
      const preview = await import("/src/editor/openingAnimaticPreview.ts");
      return preview.renderOpeningAnimaticPreview(globalThis.__project, { shotId, atMs, bare: true });
    }, shot);
    const file = `${prefix}-${i + 1}-${shot.shotId}.png`;
    fs.writeFileSync(file, Buffer.from(url.slice(url.indexOf(",") + 1), "base64"));
    console.log(`${file} ${shot.where} @ ${shot.atMs.join(",")}ms`);
  }
} finally { await browser.close(); }
