// Verify percent controls in the actual lighting dialog without an authored project.
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const out = `${root}/verify-shots/recovery-lighting`;
await mkdir(out, { recursive: true });
const server = await createServer({ root, configFile: `${root}/vite.config.ts`, cacheDir: `${root}/node_modules/.vite-recovery-lighting`, server: { host: "127.0.0.1", port: 9905, strictPort: true, watch: null }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/__recovery-lighting", (route) => route.fulfill({ contentType: "text/html", body: '<!doctype html><html><head><link rel="stylesheet" href="/src/styles/index.css"></head><body></body></html>' }));
  await page.goto("http://127.0.0.1:9905/__recovery-lighting");
  await page.evaluate(async () => {
    const { openEventCommandEditDialog } = await import("/src/editor/panels/eventEditor/commandEditDialog.ts");
    openEventCommandEditDialog({ initial: { kind: "setLighting", ambient: 0.35 }, onApply: (command) => { window.__lightingApplied = command; } });
  });
  const input = page.getByTestId("set-lighting-ambient-input");
  const slider = page.getByTestId("set-lighting-ambient-slider");
  await input.fill("50");
  await input.dispatchEvent("change");
  if (await slider.inputValue() !== "50") throw new Error("number and slider disagree");
  const opacity = () => page.locator(".page3-preview-lighting-veil").evaluate(el => el.style.opacity);
  if (await opacity() !== "0.5") throw new Error("50 percent preview is incorrect");
  await slider.fill("75");
  await slider.dispatchEvent("change");
  if (await input.inputValue() !== "75" || await opacity() !== "0.75") throw new Error("slider preview is incorrect");
  await page.getByTestId("set-lighting-preset-dusk").click();
  if (await input.inputValue() !== "35" || await slider.inputValue() !== "35") throw new Error("preset synchronization is incorrect");
  await input.fill("50");
  await input.dispatchEvent("change");
  await page.screenshot({ path: `${out}/lighting-50-percent.png` });
  await page.getByRole("button", { name: "확인", exact: true }).click();
  const applied = await page.evaluate(() => window.__lightingApplied);
  if (applied?.ambient !== 0.5) throw new Error("50 percent did not save as 0.5");
  await writeFile(`${out}/result.json`, JSON.stringify({ applied, errors, checks: ["numeric 50", "slider 75", "dusk preset 35", "preview", "apply"] }, null, 2));
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`Lighting editor QA passed: ${out}`);
} finally { await browser.close(); await server.close(); }
