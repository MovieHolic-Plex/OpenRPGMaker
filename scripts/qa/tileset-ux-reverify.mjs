import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const shotDir = resolve("verify-shots/tileset-ux-reverify");
mkdirSync(shotDir, { recursive: true });
const notes = [];

const browser = await chromium.launch({ headless: false, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(20000);

try {
  await page.goto("http://127.0.0.1:9841/?freshProject=1", { waitUntil: "domcontentloaded" });
  await page.getByTestId("authoring-task-data").click();
  await page.getByTestId("db-tab-group-world").waitFor({ state: "attached" });
  await page.getByTestId("db-tab-group-world").click();
  await page.waitForTimeout(250);
  await page.getByTestId("db-tab-tilesets").click({ force: true });
  await page.getByTestId("tileset-passage-blocked").waitFor();

  const labelCount = await page.getByTestId("tileset-field-ai-label").count();
  const compassOpen = await page.getByTestId("tileset-passage-compass-details").evaluate((el) => el.open);
  console.log("label on passage", labelCount, "compass open", compassOpen);
  if (labelCount > 0) notes.push("FAIL label still on passage");
  else notes.push("OK no label on passage");
  if (!compassOpen) notes.push("FAIL compass not open by default");
  else notes.push("OK compass open by default");

  await page.getByTestId("tileset-knowledge-passage-up").click();
  const stillOpen = await page.getByTestId("tileset-passage-compass-details").evaluate((el) => el.open);
  console.log("compass after up", stillOpen);
  if (!stillOpen) notes.push("FAIL compass closed after click");
  else notes.push("OK compass stays open after direction click");
  await page.getByTestId("tileset-knowledge-passage-left").click();
  await page.screenshot({ path: resolve(shotDir, "01-compass-stays-open.png") });

  await page.getByTestId("tileset-passage-blocked").click();
  await page.locator('[data-testid="tileset-db-cell-240"]').click();
  const grass = await page.locator('[data-testid="tileset-db-cell-240"]').getAttribute("class");
  if (!grass?.includes("mark-x")) notes.push("FAIL grass paint");
  else notes.push("OK grass blocked");

  await page.getByTestId("tileset-settings-open").click();
  await page.getByTestId("tileset-settings-modal").waitFor();
  const hasBrush = await page.getByTestId("tileset-settings-paint-blocked").isVisible();
  console.log("fullsheet brushes", hasBrush);
  if (!hasBrush) notes.push("FAIL fullsheet missing brushes");
  else notes.push("OK fullsheet has brushes");
  await page.getByTestId("tileset-settings-paint-blocked").click();
  await page.getByTestId("tileset-passage-cell-241").click();
  const cell241 = await page.getByTestId("tileset-passage-cell-241").textContent();
  console.log("cell 241", cell241);
  await page.screenshot({ path: resolve(shotDir, "02-fullsheet-brush.png") });
  await page.getByTestId("tileset-settings-close").click();
  await page.getByTestId("tileset-settings-modal").waitFor({ state: "detached" });

  await page.getByTestId("db-tab-tileset-autotile").click({ force: true });
  await page.getByTestId("tileset-autotile-editor").waitFor();
  const extra6 = await page.getByTestId("tileset-autotile-layout-cells-6").isVisible();
  const water = await page.getByTestId("tileset-autotile-layout-animated-water").isVisible();
  console.log("extra 6/water", extra6, water);
  if (!extra6 || !water) notes.push("FAIL extra formats hidden");
  else notes.push("OK 6칸 and water visible");

  const layout = await page.evaluate(() => {
    const list = document.querySelector('[data-testid="tileset-autotile-list"]');
    const composer = document.querySelector('[data-testid^="tileset-autotile-composer-"]');
    const sidebar = document.querySelector(".tileset-autotile-sidebar, .tileset-db-edit-sidebar");
    if (!list || !composer || !sidebar) return null;
    const lr = list.getBoundingClientRect();
    const cr = composer.getBoundingClientRect();
    return {
      listY: Math.round(lr.y),
      composerY: Math.round(cr.y),
      composerBottom: Math.round(cr.bottom),
      sidebarH: sidebar.clientHeight,
      sidebarScroll: sidebar.scrollHeight,
      composerVisible: cr.top < window.innerHeight && cr.bottom > 0 && cr.height > 40,
    };
  });
  console.log("autotile layout", layout);
  if (!layout || layout.composerY >= layout.listY) notes.push("FAIL composer not above list");
  else notes.push("OK composer above list");
  if (layout && layout.composerVisible) notes.push("OK composer visible without hunting");
  else notes.push("FAIL composer not in view");
  await page.screenshot({ path: resolve(shotDir, "03-autotile-composer-first.png") });

  await page.getByTestId("tileset-autotile-passage-blocked").click();
  const hint = await page.getByTestId("tileset-autotile-hint").innerText();
  console.log("block hint", hint);
  await page.screenshot({ path: resolve(shotDir, "04-autotile-block.png") });
} catch (err) {
  notes.push("CRASH " + err);
  await page.screenshot({ path: resolve(shotDir, "99-crash.png") }).catch(() => {});
} finally {
  console.log("\n==== REVERIFY ====");
  for (const n of notes) console.log(n);
  await browser.close();
}
