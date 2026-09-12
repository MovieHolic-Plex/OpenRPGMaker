import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:9999";
const outDir = process.argv[3] ?? "verify-shots/spatial-activate";

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const shot = (name) => page.screenshot({ path: `${outDir}/${name}.png`, animations: "disabled" });

await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-welcome-dismissed", "1");
  localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
});
await page.goto(`${base}/?blankProject=1&aiBridge=0`, { waitUntil: "domcontentloaded" });
await page.getByTestId("toolbar-database").waitFor({ state: "visible", timeout: 120000 });
await page.getByTestId("toolbar-database").click();
await page.getByTestId("database-modal").waitFor({ state: "visible" });
const world = page.getByTestId("db-tab-group-world");
if (await world.getAttribute("aria-expanded") === "false") await world.click();
await page.getByTestId("db-tab-spatial-regions").click();

// legacy project: activation button must be visible in the stage toolbar
await page.getByTestId("spatial-activate").waitFor({ state: "visible", timeout: 30000 });
await shot("01-regions-activate-button");
console.log("[capture] activate button visible");

// clicking routes to store.activateSpatialAuthoring() — without remote persistence
// it rejects and the error stays on the surface instead of silently no-oping
// (the same testid exists in stage toolbar and inspector — take the first)
await page.getByTestId("spatial-activate").click();
await page.waitForFunction(
  () => [...document.querySelectorAll("[data-testid='spatial-preview-error']")]
    .some(el => !el.hasAttribute("hidden") && el.textContent?.includes("활성화 실패")),
  { timeout: 30000 },
);
const errorText = await page.getByTestId("spatial-preview-error").first().textContent();
console.log(`[capture] surfaced error: ${errorText}`);
await shot("02-activate-rejected-visible");

await browser.close();
console.log(JSON.stringify({ outDir, errorText }));
