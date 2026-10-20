import { chromium } from "playwright";
const PORT = process.env.DEV_SERVER_PORT ?? "9823";
const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
await page.goto(`http://127.0.0.1:${PORT}/?freshProject=1`, { timeout: 180000, waitUntil: "commit" });
await page.waitForFunction(() => !!window.__oprnEditorStore, null, { timeout: 180000 });
await page.waitForTimeout(6000);
await page.evaluate(() => window.__oprnEditorStore.update((d) => { d.system.dialogueStyle = "dual-fullbody-veil"; }, { scope: "system", label: "qa" }));
await page.evaluate(async () => { (await import("/src/editor/panels/databaseModal.ts")).openDatabaseModal("system"); });
await page.getByTestId("database-modal").waitFor();
await page.getByTestId("db-system-nav-display").click();
const sys = () => page.evaluate(() => { const s = window.__oprnEditorStore.getCurrent().system; return JSON.stringify({ res: s.playResolution, zoom: s.cameraZoom, dlg: s.dialogueStyle }); });
const vals = () => page.evaluate(() => JSON.stringify({
  view: document.querySelector('[data-testid="db-field-system-view-preset"]')?.value,
  preset: document.querySelector('[data-testid="db-field-system-resolution-preset"]')?.value,
  w: document.querySelector('input[data-testid="db-field-system-resolution-width"]')?.value,
  h: document.querySelector('input[data-testid="db-field-system-resolution-height"]')?.value,
  z: document.querySelector('input[data-testid="db-field-system-camera-zoom"]')?.value,
}));
console.log("veil start", await sys(), await vals());
for (const p of ["480x270", "640x360", "320x240"]) {
  await page.getByTestId("db-field-system-resolution-preset").selectOption(p);
  await page.waitForTimeout(300);
  console.log("pick", p, await sys(), await vals());
}
await page.getByTestId("db-field-system-view-preset").selectOption("default");
await page.waitForTimeout(300);
console.log("view default", await sys(), await vals());
await page.screenshot({ path: "/tmp/dbsys-veil.png" });
await browser.close();
