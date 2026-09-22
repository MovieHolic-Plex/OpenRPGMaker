import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const input = process.argv[2];
if (!input) throw Error("Usage: capture-diverse-village-references.mjs canonical-reloaded-project.json");
const p = JSON.parse(fs.readFileSync(input));
const b = await chromium.launch({ headless: true });
try {
  const page = await b.newPage({ viewport: { width: 1440, height: 1e3 } }), errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/__diverse-docs", (r) => r.fulfill({ contentType: "text/html", body: '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/src/styles/database/tileset-references.css"><style>body{margin:0;font:14px system-ui;background:#f1f5f9;color:#17241c}header{padding:16px 24px;background:white;border-bottom:1px solid #ccc}.database-modal-body{height:910px}.tileset-reference-layout{height:100%}button,select{font:inherit}pre{white-space:pre-wrap;word-break:break-all}</style></head><body><header>타일 → 참고문서 · 숲마을 · 거리별 잔디 — SQLite 재로드 자료</header><div class="database-modal-backdrop"><div class="database-modal-window"><div class="database-modal-body" id="host"></div></div></div></body></html>' }));
  await page.goto((process.env.BASE ?? "http://127.0.0.1:9816") + "/__diverse-docs");
  await page.evaluate(async (p2) => {
    const mod = await import("/src/editor/panels/tilesetReferencePanel.ts");
    const source = await (await fetch("/src/editor/panels/tilesetReferencePanel.ts")).text();
    const url = source.match(/import \{ store \} from "([^"]+)"/)[1];
    const { store } = await import(url);
    store.getCurrent = () => p2;
    store.getProjectIdentity = () => ({ projectId: "44d88b94-58eb-4dee-a11a-88737da7001b" });
    const draw = () => document.getElementById("host").replaceChildren(mod.renderTilesetReferences(p2.tilesets.forest_harmony, draw));
    draw();
  }, p);
  await page.getByLabel("참고문서 용도", { exact: true }).selectOption("diverse-villages-purpose-v6");
  await page.getByRole("button", { name: "층바위 절벽마을 · 지형과 배치", exact: true }).click();
  await page.locator(".tileset-reference-markdown img").first().evaluate((im) => im.decode());
  await page.screenshot({ path: "verify-shots/village-diversity/reference-panel.png" });
  await page.getByRole("button", { name: "좌표 검증 · 정상/오류 15종", exact: true }).click();
  await page.locator(".tileset-reference-markdown img").first().scrollIntoViewIfNeeded();
  await page.locator(".tileset-reference-markdown img").first().evaluate((im) => im.decode());
  await page.screenshot({ path: "verify-shots/village-diversity/reference-errors.png" });
  const result = { source: "SQLite reopened project", realComponent: "renderTilesetReferences", readOnlyHarness: true, category: await page.getByLabel("참고문서 용도", { exact: true }).inputValue(), images: await page.locator(".tileset-reference-markdown img").count(), missing: await page.locator(".tileset-reference-missing").count(), errors };
  assert.equal(result.missing, 0);
  assert.deepEqual(errors, []);
  fs.writeFileSync("verify-shots/village-diversity/browser.json", JSON.stringify(result, null, 2));
  console.log(result);
} finally {
  await b.close();
}
