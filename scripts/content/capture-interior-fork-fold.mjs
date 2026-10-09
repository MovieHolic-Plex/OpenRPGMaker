import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const phase = process.argv[2] ?? "before";
const host = process.env.FOLD_HOST ?? "http://mdc-server:9888";
const out = "verify-shots/interior-fork-fold";
mkdirSync(out, { recursive: true });
const shots = [
  ["map_rug_trio_1_20260920", "potter"],
  ["map_places_five_1_20260921", "bakery"],
  ["map_places_five_3_20260921", "pharmacy"],
];
const browser = await chromium.launch({ executablePath: "/opt/google/chrome/chrome", args: ["--no-sandbox", "--no-proxy-server"] });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
  });
  for (const [mapId, name] of shots) {
    await page.goto(`${host}/?map=${mapId}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("edit-canvas").waitFor({ timeout: 120000 });
    await page.waitForTimeout(800);
    await page.getByTestId("edit-canvas").screenshot({ path: `${out}/${phase}-${name}.png` });
    console.log(phase, name);
  }
  await page.getByTestId("toolbar-database").click();
  const group = page.getByTestId("db-tab-group-world");
  if (await group.getAttribute("aria-expanded") === "false") await group.click();
  await page.getByTestId("db-tab-spatial-tiles").click();
  const search = page.getByTestId("tileset-db-search");
  await search.fill("도예가");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${phase}-search-potter.png` });
  await search.fill("빵집");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${phase}-search-bakery.png` });
  await search.fill("잔디 사선");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${phase}-search-grass.png` });
  await search.fill("실내 통합");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${phase}-search-unified.png` });
  console.log(phase, "database");
} finally {
  await browser.close();
}
