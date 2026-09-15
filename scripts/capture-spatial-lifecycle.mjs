import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:9999";
const outDir = process.argv[3] ?? "verify-shots/spatial-lifecycle";

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const shot = (name) => page.screenshot({ path: `${outDir}/${name}.png`, animations: "disabled" });
const log = (line) => console.log(`[lifecycle] ${line}`);

await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-welcome-dismissed", "1");
  localStorage.setItem("oprn:editor-ui-mode", "expert");
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

const evidence = {};

// ── 0. Legacy: activation path on a NON-geography tab (objects) ──
await page.getByTestId("toolbar-database").click();
await page.getByTestId("database-modal").waitFor({ state: "visible" });
const world = page.getByTestId("db-tab-group-world");
if (await world.getAttribute("aria-expanded") === "false") await world.click();
await page.getByTestId("db-tab-spatial-objects").click();
await page.getByTestId("spatial-activate").waitFor({ state: "visible", timeout: 30000 });
evidence.objectsTabActivateVisible = true;
await shot("01-objects-tab-activate");

// ── 1. Live runTool lifecycle calls on an injected canonical project ──
const tools = await page.evaluate(async () => {
  const { store } = await import("/src/project/store.ts");
  const { runTool } = await import("/src/editor/tools/toolRunner.ts");
  const { geographyRecipeFixture } = await import("/test/support/spatialGeographyRecipes.ts");
  const results = {};

  store.replace(geographyRecipeFixture("lake-country"), { preserveEventDrafts: false });
  const doc = () => store.getCurrent().spatialAuthoring;
  const rootId = "geography-contract-root";

  // runTool writes to the passed ctx draft — chain one ctx so ops compose like a real AI turn.
  const ctx = { project: store.getCurrent() };
  results.refreshRoot = runTool(ctx, "edit_spatial_occurrence", { operation: "refresh", occurrenceId: rootId });
  results.cloneRoot = runTool(ctx, "edit_spatial_occurrence", { operation: "clone", occurrenceId: rootId, newOccurrenceId: "lake-country-copy" });

  // Refresh may remap descendant identities — re-resolve from the draft doc.
  const doc2 = ctx.project.spatialAuthoring;
  const child = Object.values(doc2.occurrences).find(o => o.parentId === rootId);
  const route = doc2.connections.find(c => c.overviewRoute !== undefined);
  // A place-internal link (same parent, both endpoints under one place occurrence) is safely removable.
  const docLink = doc2.connections.find(c => {
    if (c.overviewRoute !== undefined) return false;
    const from = doc2.occurrences[c.from.occurrenceId];
    const to = doc2.occurrences[c.to.occurrenceId];
    return from && to && from.parentId === to.parentId && doc2.occurrences[from.parentId]?.kind === "place";
  });
  if (!docLink || !route || !child) throw new Error("fixture links missing");
  results.unlinkRoute = runTool(ctx, "edit_spatial_occurrence", { operation: "unlink", connectionId: route.id });
  results.unlinkDoc = runTool(ctx, "edit_spatial_occurrence", { operation: "unlink", connectionId: docLink.id });
  results.relinkDoc = runTool(ctx, "edit_spatial_occurrence", { operation: "link",
    connection: { id: docLink.id, from: docLink.from, to: docLink.to, bidirectional: docLink.bidirectional } });
  results.deleteReject = runTool(ctx, "edit_spatial_occurrence", { operation: "delete", occurrenceId: child.id });
  results.deleteRemove = runTool(ctx, "edit_spatial_occurrence", { operation: "delete", occurrenceId: child.id, externalConnections: "remove" });

  // World-level move (region child inside a world occurrence).
  store.replace(geographyRecipeFixture("lake-kingdom"), { preserveEventDrafts: false });
  const wdoc = doc();
  const wchild = Object.values(wdoc.occurrences).find(o => o.parentId === rootId);
  const mctx = { project: store.getCurrent() };
  results.moveWorldChild = runTool(mctx, "edit_spatial_occurrence", {
    operation: "move", occurrenceId: wchild.id, x: wchild.x + 4, y: wchild.y });
  results.movedX = mctx.project.spatialAuthoring.occurrences[wchild.id]?.x;

  // Legacy guard.
  const { createBlankProject } = await import("/src/project/defaults/defaultProject.ts");
  results.legacy = runTool({ project: createBlankProject() }, "edit_spatial_occurrence", { operation: "refresh", occurrenceId: "x" });

  const brief = (r) => ({ ok: r.ok, code: r.issues?.[0]?.code, summary: r.summary?.slice(0, 160) });
  results.summary = {
    refreshRoot: brief(results.refreshRoot),
    cloneRoot: brief(results.cloneRoot),
    deleteReject: brief(results.deleteReject),
    deleteRemove: brief(results.deleteRemove),
    unlinkRoute: brief(results.unlinkRoute),
    unlinkDoc: brief(results.unlinkDoc),
    relinkDoc: brief(results.relinkDoc),
    moveWorldChild: { ...brief(results.moveWorldChild), movedX: results.movedX },
    legacyCode: results.legacy.issues?.[0]?.code,
  };
  delete results.refreshRoot; delete results.cloneRoot; delete results.deleteReject;
  delete results.deleteRemove; delete results.unlinkRoute; delete results.unlinkDoc;
  delete results.relinkDoc; delete results.moveWorldChild; delete results.legacy;
  return results.summary;
});
evidence.tools = tools;
log(`tools → ${JSON.stringify(tools)}`);

// ── 2. UI: placed world children are cards; delete of a linked child arms the external-connection retry ──
const nestedRegionId = await page.evaluate(async () => {
  const { store } = await import("/src/project/store.ts");
  const { geographyRecipeFixture } = await import("/test/support/spatialGeographyRecipes.ts");
  store.replace(geographyRecipeFixture("lake-kingdom"), { preserveEventDrafts: false });
  const doc = store.getCurrent().spatialAuthoring;
  const nestedRegion = Object.values(doc.occurrences).find(o => o.kind === "region" && o.parentId !== null);
  return nestedRegion.id;
});
await page.getByTestId("db-tab-spatial-regions").click();
await page.getByTestId("spatial-mode-instances").click();
await page.getByTestId(`spatial-card-${nestedRegionId}`).click();
await page.waitForTimeout(800);
evidence.refreshEnabled = await page.getByTestId("spatial-refresh").isEnabled().catch(() => false);
evidence.deleteEnabled = await page.getByTestId("spatial-delete").isEnabled().catch(() => false);
evidence.detachEnabled = await page.getByTestId("spatial-detach").isEnabled().catch(() => false);
evidence.duplicateEnabled = await page.getByTestId("spatial-duplicate").isEnabled().catch(() => false);
await shot("02-nested-region-lifecycle-buttons");

// Delete a region child wired into world connections → external-connection retry affordance.
await page.getByTestId("spatial-delete").click();
await page.getByTestId("spatial-delete-confirm").waitFor({ state: "visible", timeout: 10000 });
await shot("03-delete-confirm-armed");
await page.getByTestId("spatial-delete-confirm").click();
await page.waitForTimeout(2500);
evidence.externalErrorText = await page.getByTestId("spatial-preview-error").first().textContent().catch(() => null);
evidence.retryConfirmVisible = await page.getByTestId("spatial-delete-confirm").isVisible().catch(() => false);
await shot("04-external-connection-retry");
// 「확인」 second press → remove policy retry.
if (evidence.retryConfirmVisible) {
  await page.getByTestId("spatial-delete-confirm").click();
  await page.waitForTimeout(2500);
  evidence.retryResultText = await page.getByTestId("spatial-save-state").first().textContent().catch(() => null);
  evidence.retryErrorText = await page.getByTestId("spatial-preview-error").first().textContent().catch(() => null);
  await shot("05-external-retry-applied");
}
log(`ui → ${JSON.stringify({ refresh: evidence.refreshEnabled, delete: evidence.deleteEnabled, detach: evidence.detachEnabled, duplicate: evidence.duplicateEnabled, externalErrorText: evidence.externalErrorText, retryConfirmVisible: evidence.retryConfirmVisible, retryResult: evidence.retryResultText })}`);

await writeFile(`${outDir}/evidence.json`, JSON.stringify(evidence, null, 2));
await browser.close();
log("done");
