// Render the real command picker/edit dialog without loading an authored project.
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const out = `${root}/verify-shots/emote-editor`;
await mkdir(out, { recursive: true });
const server = await createServer({ root, configFile: `${root}/vite.config.ts`, cacheDir: `${root}/node_modules/.vite-emote-editor`, server: { host: "127.0.0.1", port: 9847, strictPort: true, watch: null }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/__emote-editor", (route) => route.fulfill({ contentType: "text/html", body: '<!doctype html><html><head><link rel="stylesheet" href="/src/styles/index.css"></head><body></body></html>' }));
  await page.goto("http://127.0.0.1:9847/__emote-editor");
  const pickerHasEmote = await page.evaluate(async () => {
    const picker = await import("/src/editor/panels/eventEditor/commandPicker.ts");
    const { openEventCommandEditDialog } = await import("/src/editor/panels/eventEditor/commandEditDialog.ts");
    openEventCommandEditDialog({ initial: { kind: "showEmote", target: { eventId: "" }, emote: "heart" }, onApply: (command) => { window.__emoteApplied = command; } });
    return picker.EVENT_COMMAND_PICKER_NATIVE_KINDS.includes("showEmote");
  });
  if (!pickerHasEmote) throw new Error("emote missing from native picker");
  const swatches = page.locator('[data-testid="show-emote-swatch-grid"] [role="radio"]');
  if (await swatches.count() !== 12) throw new Error("missing emote swatches");
  await page.locator('[data-testid="show-emote-swatch-music"]').click();
  await page.locator('[data-testid="show-emote-duration-input"]').fill("900");
  await page.locator('[data-testid="show-emote-duration-input"]').dispatchEvent("change");
  await page.screenshot({ path: `${out}/dialog-1280.png` });
  const chosen = await page.locator('[data-testid="show-emote-swatch-music"]').getAttribute("aria-checked");
  if (chosen !== "true") throw new Error("radio selection lost after duration edit");
  await page.getByRole("button", { name: "확인", exact: true }).click();
  const applied = await page.evaluate(() => window.__emoteApplied);
  if (applied?.emote !== "music" || applied.durationMs !== 900) throw new Error("dialog did not apply staged command");
  await writeFile(`${out}/result.json`, JSON.stringify({ pickerHasEmote, count: 12, applied, errors }, null, 2));
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`Editor emote QA passed: ${out}`);
} finally { await browser.close(); await server.close(); }
