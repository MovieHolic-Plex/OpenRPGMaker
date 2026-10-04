// CPU 프로파일: node prof.mjs <stage> [tilesetId]
// stage = switch | layer | filter | category | click
import { chromium } from "playwright";
import fs from "node:fs";
const stage = process.argv[2] ?? "switch";
const tilesetId = process.argv[3] ?? "easyrpg_chipset_combined_town_retro_world";
const base = process.env.QA_BASE_URL ?? "http://127.0.0.1:9838";
const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:ai-panel-collapsed", "1");
});
await page.goto(base + "/?freshProject=1", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
if (stage !== "switch") {
  await page.evaluate((id) => { window.__oprnEditorStore.update((d) => { d.maps[d.startMapId].tilesetId = id; }); }, tilesetId);
  await page.waitForTimeout(6000);
}
const cdp = await page.context().newCDPSession(page);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await cdp.send("Profiler.start");
if (stage === "switch") {
  await page.evaluate((id) => { window.__oprnEditorStore.update((d) => { d.maps[d.startMapId].tilesetId = id; }); }, tilesetId);
  await page.waitForTimeout(6000);
} else if (stage === "layer") {
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => document.querySelector("[data-testid='layer-upper']").click());
    await page.waitForTimeout(600);
    await page.evaluate(() => document.querySelector("[data-testid='layer-lower']").click());
    await page.waitForTimeout(600);
  }
} else if (stage === "filter") {
  for (let i = 0; i < 3; i++) {
    for (const q of ["나무", ""]) {
      await page.evaluate((query) => { const input = document.querySelector("[data-testid='tile-search-input']"); input.value = query; input.dispatchEvent(new Event("input", { bubbles: true })); }, q);
      await page.waitForTimeout(700);
    }
  }
} else if (stage === "category") {
  for (let i = 0; i < 3; i++) {
    for (const idx of [2, 0]) {
      await page.evaluate((k) => { const sel = document.querySelector("[data-testid='tile-category-select']"); sel.value = sel.options[k].value; sel.dispatchEvent(new Event("change", { bubbles: true })); }, idx);
      await page.waitForTimeout(700);
    }
  }
} else if (stage === "click") {
  for (let i = 0; i < 5; i++) {
    await page.evaluate((k) => { const l = [...document.querySelectorAll("[data-testid^='chipset-tile-']")]; l[40 + k].click(); }, i * 3);
    await page.waitForTimeout(500);
  }
}
const { profile } = await cdp.send("Profiler.stop");
const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
const dt = profile.timeDeltas;
for (let i = 0; i < profile.samples.length; i++) {
  const n = nodes.get(profile.samples[i]);
  const cf = n.callFrame;
  const key = `${cf.functionName || "(anon)"} ${cf.url.split("/").slice(-2).join("/")}:${cf.lineNumber}`;
  self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0));
}
// inclusive by top-level app function: aggregate by parent chain names
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const incl = new Map();
for (let i = 0; i < profile.samples.length; i++) {
  let id = profile.samples[i];
  const seen = new Set();
  while (id !== undefined) {
    const cf = nodes.get(id).callFrame;
    const key = `${cf.functionName || "(anon)"} ${cf.url.split("/").slice(-2).join("/")}:${cf.lineNumber}`;
    if (!seen.has(key)) { seen.add(key); incl.set(key, (incl.get(key) ?? 0) + (dt[i] ?? 0)); }
    id = parent.get(id);
  }
}
const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${(v / 1000).toFixed(1).padStart(8)}ms ${k}`);
console.log("== self ==\n" + top(self, 25).join("\n"));
console.log("== inclusive ==\n" + top(incl, 45).join("\n"));
await b.close();
