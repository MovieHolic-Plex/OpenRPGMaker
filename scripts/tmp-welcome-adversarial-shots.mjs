// Temp hostile-review capture for the first-run director briefing overlay.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "verify-shots/welcome-adversarial";
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "390x844", width: 390, height: 844 },
];

const browser = await chromium.launch();
const report = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
  page.on("requestfailed", (r) => failedRequests.push(r.url()));
  page.on("response", (r) => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`); });
  await page.addInitScript(() => {
    try { localStorage.removeItem("oprn:editor-welcome-dismissed"); } catch {}
  });
  await page.goto("http://localhost:9999/?forceWelcome=1", { waitUntil: "domcontentloaded" });
  let mounted = true;
  try {
    await page.waitForSelector("[data-testid='editor-welcome']", { timeout: 45000 });
  } catch {
    mounted = false;
  }
  if (mounted) await page.waitForTimeout(1500); // let thumbs decode
  await page.screenshot({ path: `${OUT}/${vp.name}.png` });

  const metrics = mounted
    ? await page.evaluate(() => {
        const q = (s) => document.querySelector(s);
        const rect = (s) => { const e = q(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
        const stage = q(".editor-welcome-stage");
        const cards = [...document.querySelectorAll(".editor-welcome-template-card")];
        const insp = [...document.querySelectorAll(".editor-welcome-card-inspiration")];
        const starters = [...document.querySelectorAll(".editor-welcome-template-starter")];
        const clipped = [...document.querySelectorAll(".editor-welcome-template-label, .editor-welcome-template-blurb, .editor-welcome-card-inspiration, .editor-welcome-template-starter")]
          .filter((e) => e.scrollWidth > e.clientWidth + 1)
          .map((e) => ({ cls: e.className, text: e.textContent.trim().slice(0, 24), scrollW: e.scrollWidth, clientW: e.clientWidth }));
        const thumbs = [...document.querySelectorAll(".editor-welcome-template-thumb")].map((e) => getComputedStyle(e).backgroundImage.match(/url\("?([^")]+)/)?.[1] ?? null);
        const st = stage ? getComputedStyle(stage) : null;
        return {
          stage: rect(".editor-welcome-stage"),
          stageOverflowsViewport: stage ? (stage.getBoundingClientRect().bottom > innerHeight + 1 || stage.getBoundingClientRect().top < -1) : null,
          stageBg: st?.backgroundColor,
          stageHeightVsViewport: stage ? +(stage.getBoundingClientRect().height / innerHeight).toFixed(2) : null,
          title: rect(".editor-welcome-title"),
          titleFont: q(".editor-welcome-title") ? getComputedStyle(q(".editor-welcome-title")).fontSize : null,
          input: rect(".editor-welcome-prompt-input"),
          submit: rect(".editor-welcome-prompt-submit"),
          cardCount: cards.length,
          cardBoxes: cards.map((c) => { const r = c.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; }),
          inspirationCount: insp.length,
          inspirationBoxes: insp.map((c) => { const r = c.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), t: c.textContent.trim() }; }),
          starterBoxes: starters.map((c) => { const r = c.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; }),
          skip: rect(".editor-welcome-skip"),
          clipped,
          thumbs,
          focused: document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName,
          bodyScrollable: document.documentElement.scrollHeight > innerHeight,
        };
      })
    : null;

  report.push({ viewport: vp.name, mounted, metrics, consoleErrors: consoleErrors.slice(0, 6), failedRequests: [...new Set(failedRequests)].slice(0, 12) });
  await ctx.close();
}

// thumb asset reachability
const ctx = await browser.newContext();
const page = await ctx.newPage();
const thumbUrls = [...new Set(report.flatMap((r) => r.metrics?.thumbs ?? []).filter(Boolean))];
const assets = [];
for (const u of thumbUrls) {
  const res = await page.request.get(u);
  assets.push({ url: u.replace("http://localhost:9999", ""), status: res.status(), bytes: (await res.body()).length });
}
await ctx.close();
await browser.close();
console.log(JSON.stringify({ report, assets }, null, 1));
