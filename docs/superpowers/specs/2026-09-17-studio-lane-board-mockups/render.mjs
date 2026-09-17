// 목업 4장 재렌더. 저장소 루트에서:
//   node docs/superpowers/specs/2026-09-17-studio-lane-board-mockups/render.mjs
import { chromium } from "playwright";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const url = (v) => `file://${dir}/mock.html?v=${v}`;
const browser = await chromium.launch({
  args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"],
});
const jobs = [
  ["entry", 1440, 900, "mock-1440-entry"],
  ["work", 1440, 900, "mock-1440-lanes"],
  ["lane", 1440, 900, "mock-1440-lane-thread"],
  ["narrow", 1280, 800, "mock-1280-lanes"],
];
for (const [v, w, h, name] of jobs) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => console.log("pageerror", v, e.message));
  await page.goto(url(v), { waitUntil: "load" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/${name}.png` });
  console.log("shot", name);
  await page.close();
}
await browser.close();
