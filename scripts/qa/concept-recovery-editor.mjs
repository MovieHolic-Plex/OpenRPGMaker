// Exercise production DB renderers without booting the editor or loading an authored project.
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const port = Number(process.env.DEV_SERVER_PORT ?? "9901");
const out = `${root}/verify-shots/concept-recovery-editor`;
await mkdir(out, { recursive: true });
const server = await createServer({ root, configFile: `${root}/vite.config.ts`, cacheDir: `${root}/node_modules/.vite-concept-recovery-editor`, server: { host: "127.0.0.1", port, strictPort: true, watch: null }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/__concept-recovery-editor", (route) => route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><link rel="stylesheet" href="/src/styles/index.css"></head><body>
    <div class="database-modal-backdrop"><section class="database-modal-window" style="width:calc(100vw - 32px);height:calc(100vh - 32px);max-width:none;max-height:none">
    <div class="database-modal-body" style="height:100%;display:flex"><main id="qa-host" class="db-body db-shared-workspace" style="width:100%;height:100%;min-width:0"></main></div>
    </section></div></body></html>` }));
  const mount = async () => {
    await page.goto(`http://127.0.0.1:${port}/__concept-recovery-editor`);
    await page.evaluate(async () => {
      const { store } = await import("/src/project/store.ts");
      const { createBlankProject } = await import("/src/project/defaults.ts");
      const { renderScratchConceptTab, resetScratchConceptTabSession } = await import("/src/editor/panels/scratchConceptTab.ts");
      const { seedDefaultInteriorCatalog } = await import("/src/editor/interiorRoomPipeline.ts");
      const { setSelectedTileset } = await import("/src/editor/panels/tilesetSettingsPanel.ts");
      store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
      const project = createBlankProject();
      seedDefaultInteriorCatalog(project.tilesets.easyrpg_chipset_interior);
      store.replace(project);
      resetScratchConceptTabSession();
      setSelectedTileset("easyrpg_chipset_interior");
      renderScratchConceptTab(document.getElementById("qa-host"), () => {});
    });
  };
  let bootAttempts = 0;
  for (;;) {
    bootAttempts += 1;
    try { await mount(); break; }
    catch (error) {
      // Chromium cancels imports during host VPN changes. Reload only this known transport failure.
      if (bootAttempts >= 3 || !/Failed to fetch dynamically imported module|ERR_NETWORK_CHANGED/.test(String(error))) throw error;
    }
  }
  const layout = page.getByTestId("scratch-concept-facility-layout");
  await layout.selectOption("double-row");
  await page.getByTestId("scratch-concept-place-zone-bedroom").selectOption("south");
  const membership = page.getByTestId("scratch-concept-facility-place-bedroom");
  await membership.click();
  await expect(membership).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("scratch-concept-place-bedroom")).toHaveCount(0);
  await membership.click();
  await expect(membership).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("scratch-concept-place-zone-bedroom")).toHaveValue("south");
  await page.getByTestId("scratch-concept-thing-bed_h").click();
  await expect(page.getByTestId("scratch-concept-thing-paint")).toHaveText("사본 만들어 칠하기");
  await expect(layout).toHaveValue("double-row");
  const layoutFit = await layout.evaluate((select) => {
    const style = getComputedStyle(select);
    const context = document.createElement("canvas").getContext("2d");
    context.font = style.font;
    const textWidth = context.measureText(select.selectedOptions[0].text).width;
    const available = select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return { textWidth, available };
  });
  if (layoutFit.available < layoutFit.textWidth) throw new Error(`Layout label clipped: ${JSON.stringify(layoutFit)}`);
  await page.screenshot({ path: `${out}/concepts-1440.png` });
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(layout).toBeVisible();
  await page.screenshot({ path: `${out}/concepts-1024.png` });
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.getByTestId("scratch-concept-thing-paint").click();
  await expect(page.getByTestId("structure-kit-editor")).toBeVisible();
  await page.getByTestId("structure-kit-editor-tab-ai").click();
  const repeatability = page.getByTestId("structure-kit-editor-ai-repeatability");
  await repeatability.selectOption("fixed");
  await page.getByTestId("structure-kit-editor-ai-growth").selectOption("vertical");
  await expect(repeatability).toBeDisabled();
  await expect(repeatability).toHaveValue("fixed");
  await page.screenshot({ path: `${out}/structure-growth-1440.png` });
  await page.getByTestId("structure-kit-editor-ai-growth").selectOption("");
  await expect(repeatability).toBeEnabled();
  await expect(repeatability).toHaveValue("fixed");
  const state = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const tileset = store.getCurrent().tilesets.easyrpg_chipset_interior;
    const inn = tileset.scratchConceptBundles.find((bundle) => bundle.id === "inn");
    return { layout: inn.facilities[0].layout, zone: inn.places.find((place) => place.id === "bedroom").zone,
      member: inn.facilities[0].placeIds.includes("bedroom"), objectId: inn.things.find((thing) => thing.id === "bed_h").objectId,
      seedPreserved: tileset.structureKits.find((kit) => kit.id === "bed_h").learnedFrom === "interior-catalog" };
  });
  if (state.layout !== "double-row" || state.zone !== "south" || !state.member || !state.objectId.startsWith("kit_") || !state.seedPreserved) throw new Error(JSON.stringify(state));
  await writeFile(`${out}/result.json`, JSON.stringify({ productionRenderer: true, remotePersistence: false, bootAttempts, layoutFit, state, errors }, null, 2));
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`Concept recovery editor QA passed: ${out}`);
} finally { await browser.close(); await server.close(); }
