import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:9999";
const outDir = process.argv[3] ?? "verify-shots/spatial-activate";

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const shot = (name) => page.screenshot({ path: `${outDir}/${name}.png`, animations: "disabled" });
const log = (line) => console.log(`[evidence] ${line}`);

await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-welcome-dismissed", "1");
  localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
});

let ok = false;
for (let attempt = 1; attempt <= 5 && !ok; attempt++) {
  await page.goto(`${base}/?blankProject=1&aiBridge=0`, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    ok = await page.getByTestId("toolbar-database").isVisible().catch(() => false);
    if (ok) break;
    await page.waitForTimeout(1500);
  }
  log(`boot attempt ${attempt}: ${ok ? "ok" : "fail"}`);
}
if (!ok) throw new Error("editor never booted");

// vite dev는 HMR 무효화 후 앱이 쓰는 store 를 ?t=<ts> URL 로 다시 싣는다 — 같은 인스턴스를
// 잡기 위해 앱이 실제 로드한 리소스 URL 을 찾아 import 한다 (clean 경로는 두 번째 복제 모듈이 된다).
const appStore = `(() => {
  const url = performance.getEntriesByType("resource")
    .map((e) => e.name).find((n) => n.includes("/src/project/store.ts"));
  if (!url) throw new Error("app store module not loaded");
  return import(url);
})()`;

// ── 1. Real tool calls inside the running editor, on the real store project ──
const legacy = await page.evaluate(async (appStoreSrc) => {
  const { store } = await eval(appStoreSrc);
  const { runTool } = await import("/src/editor/tools/toolRunner.ts");
  const { allTools } = await import("/src/editor/tools/toolRegistry.ts");
  const { buildToolCapabilityIndex, buildTaskRecipes } = await import("/src/ai/toolCapabilityIndex.ts");
  const project = store.getCurrent();
  const ctx = { project };
  const spatialNames = allTools().map(t => t.name).filter(n => n.includes("spatial") || n === "get_geography_vocabulary");
  return {
    spatialAuthoringPresent: project.spatialAuthoring !== undefined,
    spatialToolNames: spatialNames,
    list: runTool(ctx, "list_spatial_designs", {}),
    get: runTool(ctx, "get_spatial_design", { kind: "space", id: "nonexistent" }),
    upsert: runTool(ctx, "upsert_spatial_design", { kind: "space", expectedRevision: 0,
      space: { id: "x", name: "X", revision: 1, tags: [], provenance: { origin: "ai" }, environment: "interior",
        tilesetId: "easyrpg_chipset_interior", shape: "rect", width: 5, height: 4, floor: "wood", wall: "cream", ports: [], objectSlots: [] } }),
    preview: runTool(ctx, "preview_spatial_build", { kind: "space", id: "x", occurrenceId: "y", seed: 1 }),
    vocabulary: runTool(ctx, "get_geography_vocabulary", {}),
    capabilityIndexWorldLine: buildToolCapabilityIndex().split("\n").find(l => l.includes("월드")) ?? null,
    spatialRecipe: buildTaskRecipes().split("\n").find(l => l.includes("spatial-world")) ?? null,
  };
}, appStore);
log(`legacy list → active=${legacy.list.data?.active} · get code=${legacy.get.issues?.[0]?.code} · upsert code=${legacy.upsert.issues?.[0]?.code} · preview code=${legacy.preview.issues?.[0]?.code}`);
log(`vocabulary → ok=${legacy.vocabulary.ok} worldTilesets=${JSON.stringify(legacy.vocabulary.data?.terrain?.worldTilesetIds)}`);

// ── 2. UI: activation button on the regions stage ──
await page.getByTestId("toolbar-database").click();
await page.getByTestId("database-modal").waitFor({ state: "visible" });
const world = page.getByTestId("db-tab-group-world");
if (await world.getAttribute("aria-expanded") === "false") await world.click();
await page.getByTestId("db-tab-spatial-regions").click();
await page.getByTestId("spatial-activate").waitFor({ state: "visible", timeout: 30000 });
await shot("01-regions-activate-button");
await page.getByTestId("spatial-activate").click();
await page.waitForFunction(
  () => [...document.querySelectorAll("[data-testid='spatial-preview-error']")]
    .some(el => !el.hasAttribute("hidden") && (el.textContent ?? "").includes("활성화 실패")),
  { timeout: 30000 },
);
legacy.activateErrorText = await page.getByTestId("spatial-preview-error").first().textContent();
await shot("02-activate-rejected-visible");
log(`activation click → ${legacy.activateErrorText}`);

// ── 3. Contrast: canonical project → button hidden, tools live ──
const canonical = await page.evaluate(async (appStoreSrc) => {
  const { store } = await eval(appStoreSrc);
  const { runTool } = await import("/src/editor/tools/toolRunner.ts");
  const { geographyRecipeFixture } = await import("/test/support/spatialGeographyRecipes.ts");
  const fixture = geographyRecipeFixture("lake-country");
  store.replace(fixture, { preserveEventDrafts: false });
  const project = store.getCurrent();
  return {
    spatialAuthoringPresent: project.spatialAuthoring !== undefined,
    regions: Object.keys(project.spatialAuthoring?.library?.regions ?? {}),
    list: runTool({ project }, "list_spatial_designs", { kind: "region" }),
  };
}, appStore);
log(`canonical list → active=${canonical.list.data?.active} designs=${canonical.list.data?.designs?.length}`);

// re-render stage chrome and check the button is gone
await page.getByTestId("db-tab-spatial-worlds").click();
await page.getByTestId("db-tab-spatial-regions").click();
await page.waitForTimeout(1000);
canonical.activateButtonCount = await page.getByTestId("spatial-activate").count();
canonical.activateButtonEnabled = await page.getByTestId("spatial-activate").isEnabled().catch(() => false);
await shot("03-canonical-no-activate");
log(`canonical → activate buttons in DOM: ${canonical.activateButtonCount}, enabled: ${canonical.activateButtonEnabled}`);

await writeFile(`${outDir}/evidence.json`, JSON.stringify({ legacy, canonical }, null, 2));
await browser.close();
log("done");
