// viz 페이지가 그려지는지 찍어 본다.  node shot-page.mjs <url> <out.png>
import { chromium } from "@playwright/test";
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ["--no-sandbox"] });
const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
await p.goto(url); await p.waitForTimeout(800);
const info = await p.evaluate(() => ({ imgs: document.images.length, broken: [...document.images].filter((i) => !i.naturalWidth).length, h: document.body.scrollHeight, sections: document.querySelectorAll("section").length }));
await p.screenshot({ path: out, fullPage: false });
console.log(JSON.stringify(info));
await b.close();
