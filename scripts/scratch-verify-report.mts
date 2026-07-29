import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1320, height: 1000 } });
await p.goto("file:///C:/Users/USER/Downloads/rpg-zzu/snow60-learning-report.html");
await p.waitForTimeout(1500);
const stats = await p.evaluate(() => {
  const imgs = [...document.images];
  return { total: imgs.length, broken: imgs.filter((i) => !i.naturalWidth).length, height: document.body.scrollHeight };
});
console.log(JSON.stringify(stats));
await p.screenshot({ path: "tmp/snow60-render/report-top.png" });
await p.evaluate(() => window.scrollTo(0, 3200));
await p.waitForTimeout(400);
await p.screenshot({ path: "tmp/snow60-render/report-mid.png" });
await b.close();
