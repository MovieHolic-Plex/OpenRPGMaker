// 목업 HTML → PNG. 목업을 고쳤으면 이걸 다시 돌려서 PNG 를 갱신한다.
//   node new-editor/render-mockup.mjs
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const html = fileURLToPath(new URL("./mockup/event-editor-mockup.html", import.meta.url));
const png = fileURLToPath(new URL("./mockup/event-editor-mockup.png", import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(`file://${html.replace(/\\/g, "/")}`);
await page.waitForTimeout(300);
await page.screenshot({ path: png });
await browser.close();
// eslint-disable-next-line no-console
console.log(`rendered -> ${png}`);
