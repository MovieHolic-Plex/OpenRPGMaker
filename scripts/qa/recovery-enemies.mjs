// Verify the combined monster studio and authoring fixes with the production database modal.
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const out = `${root}/verify-shots/recovery-enemies`;
await mkdir(out, { recursive: true });
const server = await createServer({ root, configFile: `${root}/vite.config.ts`, cacheDir: `${root}/node_modules/.vite-recovery-enemies`, server: { host: "127.0.0.1", port: 9905, strictPort: true, watch: null }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("http://127.0.0.1:9905/**", async route => {
    if (new URL(route.request().url()).pathname === "/__recovery-enemies") {
      await route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="/src/styles/index.css"></head><body></body></html>' });
    } else await route.fulfill({ response: await route.fetch({ maxRetries: 3 }) });
  });
  await page.goto("http://127.0.0.1:9905/__recovery-enemies");
  await page.evaluate(async () => {
    const [{ store, setDevProjectFactory }, { createBlankProject }, database] = await Promise.all([
      import("/src/project/store.ts"), import("/src/project/defaults.ts"), import("/src/editor/panels/databaseModal.ts"),
    ]);
    setDevProjectFactory(() => createBlankProject());
    await store.load();
    database.openDatabaseModal("enemies");
  });
  const checks = [];
  for (const size of [{ width: 1680, height: 1050 }, { width: 1280, height: 800 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(size);
    for (const [section, field] of [["basic", "db-field-enemy-max-hp"], ["appearance", "db-enemy-graphic-set"], ["combat", "db-field-enemy-move-interval-ms"], ["rewards", "db-field-enemy-drop-rate"]]) {
      await page.getByTestId(`db-enemy-section-${section}-tab`).click();
      const control = page.getByTestId(field);
      await control.scrollIntoViewIfNeeded();
      const reachable = await control.evaluate(node => {
        const r = node.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return r.width > 20 && r.height > 15 && (hit === node || node.contains(hit));
      });
      if (!reachable) throw new Error(`${size.width} ${field} is clipped`);
      checks.push({ width: size.width, field, reachable });
    }
    await page.getByTestId("db-enemy-section-basic-tab").click();
    await page.getByTestId("db-field-enemy-max-hp").fill("321");
    if (!(await page.getByTestId("db-enemy-stage-stats").innerText()).includes("321")) throw new Error("studio preview lost live updates");
    await page.locator(".db-enemy-studio").evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: `${out}/studio-${size.width}.png` });
  }
  await writeFile(`${out}/result.json`, JSON.stringify({ checks, errors, remotePersistence: false }, null, 2));
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`Merged enemy studio QA passed: ${out}`);
} finally { await browser.close(); await server.close(); }
