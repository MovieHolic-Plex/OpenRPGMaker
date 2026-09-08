import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createServer as createPortProbe } from "node:net";
import { resolve } from "node:path";
import { firefox } from "@playwright/test";
import { createServer } from "vite";

process.env.DEV_SERVER_NO_TLS = "1";
process.env.E2E_FREEZE_DEV_SERVER = "1";
const port = await new Promise((resolvePort) => {
  const probe = createPortProbe();
  probe.listen(0, "127.0.0.1", () => {
    const port = probe.address().port;
    probe.close(() => resolvePort(port));
  });
});
const server = await createServer({
  configFile: resolve("vite.config.ts"),
  configLoader: "runner",
  server: { host: "127.0.0.1", port, strictPort: true, hmr: false, watch: null },
});
let browser;
let page;
const browserErrors = [];
try {
  await server.listen();
  browser = await firefox.launch({ headless: false });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (error) => browserErrors.push(String(error)));
  page.on("requestfailed", (request) => browserErrors.push(`${request.url()} ${request.failure()?.errorText}`));
  await page.addInitScript(() => {
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
    window.__appearanceBoot = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { observer.disconnect(); reject(new Error("Editor did not boot")); }, 180000);
      const observer = new MutationObserver(() => {
        if (document.querySelector("[data-testid='oprn-menu-bar']")) {
          clearTimeout(timer);
          observer.disconnect();
          resolve(true);
        }
      });
      observer.observe(document, { childList: true, subtree: true });
    });
  });
  await page.goto(`http://127.0.0.1:${port}/?blankProject=1&aiBridge=0`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.__appearanceBoot);
  await page.evaluate(async () => {
    const { createBlankProject } = await import("/src/project/defaults.ts");
    const { addEvent } = await import("/src/editor/eventActions.ts");
    const { openEventEditorModal } = await import("/src/editor/panels/eventEditor/modal.ts");
    const project = createBlankProject();
    project.database.characterAppearances = [{
      id: "guide", name: "Bundled guide", description: "",
      charset: { resourceId: "easyrpg-charset-actor1", characterIndex: 5 },
    }];
    window.__oprnEditorStore.replaceProject(project);
    const eventId = addEvent(project.startMapId, 4, 4);
    openEventEditorModal(project.startMapId, eventId);
    window.__appearancePreviewReady = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { observer.disconnect(); reject(new Error("Bundled preview did not load")); }, 30000);
      const observer = new MutationObserver(() => {
        const preview = document.querySelector("[data-testid='event-page-graphic-control'] [data-testid='event-page-graphic-preview']");
        if (preview?.dataset.slot === "5" && preview.dataset.unsupported !== "true"
          && preview.style.backgroundImage && preview.style.backgroundImage !== "none") {
          clearTimeout(timer);
          observer.disconnect();
          resolve(true);
        }
      });
      observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    });
  });
  await page.locator("[data-custom-select-for='event-page-appearance-select']").click();
  await page.getByRole("option", { name: "Bundled guide", exact: true }).click();
  await page.evaluate(() => window.__appearancePreviewReady);
  const proof = await page.getByTestId("event-page-graphic-control").getByTestId("event-page-graphic-preview").evaluate((preview) => ({
    spriteId: preview.dataset.spriteId,
    slot: preview.dataset.slot,
    frame: preview.dataset.pattern,
    supported: preview.dataset.unsupported !== "true",
    hasImage: preview.style.backgroundImage !== "none",
  }));
  assert.deepEqual(proof, { spriteId: "easyrpg-charset-actor1", slot: "5", frame: "76", supported: true, hasImage: true });
  await page.screenshot({ path: "output/evidence/appearance-sets/bundled-event-preview.png" });
  await page.getByTestId("event-editor-save").click();
  await page.getByTestId("layer-event").click();
  await page.screenshot({ path: "output/evidence/appearance-sets/bundled-map-preview.png" });
  await writeFile("output/evidence/appearance-sets/bundled-preview-proof.json", JSON.stringify(proof, null, 2));
  console.log("BUNDLED_APPEARANCE_PREVIEW_PASS", JSON.stringify(proof));
} catch (error) {
  console.error(JSON.stringify({ browserErrors, body: await page?.locator("body").innerText() }, null, 2));
  await page?.screenshot({ path: "output/evidence/appearance-sets/bundled-preview-failure.png" });
  throw error;
} finally {
  await browser?.close();
  await server.close();
  console.log(`cleanup: closed preview browser/server ${port}; reused existing worktree Vite cache`);
}
