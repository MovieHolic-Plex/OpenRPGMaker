import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

// Component browser QA: actual store/panels/styles, minimal test data, no remote writes.
const origin = process.env.WIKI_QA_ORIGIN ?? "http://127.0.0.1:9839";
const output = "output/evidence/wiki-work-history";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin || request.method() !== "GET") return route.abort();
    if (url.pathname === "/__wiki-history-qa.html") return route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body><main id="qa"></main></body></html>' });
    const response = await fetch(request.url());
    const headers = Object.fromEntries(response.headers);
    delete headers["content-encoding"];
    delete headers["content-length"];
    await route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
  });
  await page.goto(`${origin}/__wiki-history-qa.html`);
  await page.evaluate(async () => {
    const [{ store }, { createBlankProject }, { renderWorldPanel }, { renderMapHistoryPanel }, fixture] = await Promise.all([
      import("/src/project/store.ts"), import("/src/project/defaults.ts"),
      import("/src/editor/panels/worldPanel.ts"), import("/src/editor/panels/mapHistoryPanel.ts"),
      import("/test/fixtures/wikiActivity.ts"),
      import("/src/styles/index.css"), import("/src/styles/database/index.css"),
    ]);
    const project = createBlankProject();
    project.world = { entities: [fixture.wikiActivity(), fixture.manualWikiNote], relations: [] };
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(project);
    window.wikiQaBefore = JSON.stringify(store.getCurrent().world);
    window.wikiQaStore = store;
    const host = document.querySelector("#qa");
    const codex = document.createElement("section");
    codex.append(renderWorldPanel({ embedded: true, initialTab: "guideline" }));
    host.append(codex, renderMapHistoryPanel());
  });
  await page.addStyleTag({ content: "body{overflow:auto;padding:24px}#qa{display:grid;grid-template-columns:minmax(0,1fr) 460px;gap:24px;height:860px}#qa>section{min-width:0;height:100%}#qa .world-panel{height:100%}#qa>.map-history-panel{align-self:start}" });
  await page.getByTestId("map-history-tab-activity").click();
  const codex = page.getByTestId("world-panel");
  assert.match(await codex.innerText(), /표지판 디자인/);
  assert.doesNotMatch(await codex.innerText(), /적용된 작업/);
  await page.getByTestId("legacy-wiki-toggle-w_applied_0").click();
  const body = page.getByTestId("legacy-wiki-body-w_applied_0");
  assert.equal(await body.isVisible(), true);
  assert.match(await body.innerText(), /move_event/);
  await page.screenshot({ path: `${output}/codex-and-history.png`, fullPage: true });
  await page.getByTestId("legacy-wiki-toggle-w_applied_0").click();
  assert.equal(await body.isVisible(), false);
  assert.equal(await page.evaluate(() => JSON.stringify(window.wikiQaStore.getCurrent().world) === window.wikiQaBefore), true);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false);
  assert.deepEqual(errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({ ok: true, mode: "production-component-browser", remoteWrites: false, checks: ["manual note visible", "automatic record absent from codex", "original text opens and closes", "no data mutation", "no page errors", "no horizontal overflow"] }, null, 2));
  console.log(`${output}/report.json`);
} finally {
  await browser.close();
}
