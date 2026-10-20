// 자료집 → 게임 설정(시스템) → 화면 탐침. 사용: DEV_SERVER_PORT=<포트> node scripts/qa/db-system-probe.mjs
import { chromium } from "playwright";
const PORT = process.env.DEV_SERVER_PORT ?? "9823";
const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 200)); });
await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
await page.goto(`http://127.0.0.1:${PORT}/?freshProject=1`, { timeout: 180000, waitUntil: "commit" });
await page.waitForFunction(() => !!window.__oprnEditorStore, null, { timeout: 180000 });
await page.waitForTimeout(6000);
const sys = () => page.evaluate(() => { const s = window.__oprnEditorStore.getCurrent().system; return JSON.stringify({ res: s.playResolution, zoom: s.cameraZoom, scale: s.playSurfaceScale, dlg: s.dialogueStyle }); });
console.log("initial", await sys());
await page.evaluate(async () => { (await import("/src/editor/panels/databaseModal.ts")).openDatabaseModal("system"); });
await page.getByTestId("database-modal").waitFor();
await page.getByTestId("db-system-nav-display").click();
await page.waitForTimeout(500);
await page.screenshot({ path: "/tmp/dbsys-display-0.png" });
const vals = () => page.evaluate(() => ({
  view: document.querySelector('[data-testid="db-field-system-view-preset"]')?.value,
  preset: document.querySelector('[data-testid="db-field-system-resolution-preset"]')?.value,
  w: document.querySelector('[data-testid="db-field-system-resolution-width"] input, input[data-testid="db-field-system-resolution-width"]')?.value,
  z: document.querySelector('[data-testid="db-field-system-camera-zoom"] input, input[data-testid="db-field-system-camera-zoom"]')?.value,
}));
console.log("ui0", JSON.stringify(await vals()));
await page.getByTestId("db-field-system-resolution-preset").selectOption("640x480");
await page.waitForTimeout(400);
console.log("after preset 640x480", await sys(), JSON.stringify(await vals()));
await page.getByTestId("db-field-system-view-preset").selectOption("close");
await page.waitForTimeout(400);
console.log("after view close", await sys(), JSON.stringify(await vals()));
await page.getByTestId("db-field-system-resolution-preset").selectOption("320x240");
await page.waitForTimeout(400);
console.log("after preset 320x240", await sys(), JSON.stringify(await vals()));
await page.screenshot({ path: "/tmp/dbsys-display-1.png" });
await browser.close();
