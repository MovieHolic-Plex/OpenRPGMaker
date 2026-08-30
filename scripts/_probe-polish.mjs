import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "expert");
  localStorage.setItem("oprn:ai-panel-collapsed", "1");
});
await page.goto("http://127.0.0.1:9376/?freshProject=1&m1MapEditor=1", { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(15000);
const info = await page.evaluate(() => {
  const ids = [...document.querySelectorAll("[data-testid]")].map((el) => el.getAttribute("data-testid"));
  const canvases = [...document.querySelectorAll("canvas")].map((c) => {
    const r = c.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), parentTestid: c.closest("[data-testid]")?.getAttribute("data-testid") ?? null };
  });
  return { count: ids.length, canvasLike: ids.filter((i) => i && /canvas|map|select|tool/.test(i)).slice(0, 60), canvases };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: "/tmp/probe-polish.png" });
await browser.close();
