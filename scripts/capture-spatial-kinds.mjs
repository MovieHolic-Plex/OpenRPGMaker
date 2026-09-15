import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

// Pass a minimal contract fixture JSON; this UI check never contacts project persistence.
const [base = "http://127.0.0.1:19842", fixturePath, outDir = "output/evidence/spatial-kinds"] = process.argv.slice(2);
assert.ok(fixturePath, "A canonical contract fixture JSON path is required");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route("**/*", (route) => new URL(route.request().url()).origin === new URL(base).origin
    ? route.continue() : route.abort());
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  console.log("Opening editor");
  await page.goto(`${base}/?blankProject=1&aiBridge=0`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("toolbar-database").waitFor({ timeout: 120000 }).catch(async (error) => {
    await page.screenshot({ path: `${outDir}/boot-failed.png` });
    console.log(await page.locator("body").innerText());
    throw error;
  });
  console.log("Editor ready");
  const expected = await page.evaluate(async (project) => {
    const { store } = await import("/src/project/store.ts");
    store.replace(project, { preserveEventDrafts: false });
    const library = store.getCurrent().spatialAuthoring.library;
    return { placeId: Object.values(library.places).find((place) => place.kind === "facility").id,
      objectId: Object.values(library.objects)[0].id, graphic: Object.values(library.objects)[0].graphic };
  }, fixture);
  await page.getByTestId("toolbar-database").click();
  const group = page.getByTestId("db-tab-group-world");
  if (await group.getAttribute("aria-expanded") === "false") await group.click();
  const { cards } = await page.evaluate(async () => {
    const { spatialPresentationId } = await import("/src/editor/panels/spatialPresentation.ts");
    const { store } = await import("/src/project/store.ts");
    const library = store.getCurrent().spatialAuthoring.library;
    return { cards: Object.fromEntries(["object", "space", "place"].map((kind) => {
      const record = Object.values(library[`${kind}s`]).find((entry) => kind !== "place" || entry.kind === "facility");
      return [kind, spatialPresentationId(`library-${kind}`, "library", record.id)];
    })) };
  });
  const guidance = {};
  for (const kind of ["object", "space", "place"]) {
    console.log(`Capturing ${kind}`);
    await page.getByTestId(`db-tab-spatial-${kind}s`).click();
    await page.getByTestId(`spatial-card-${cards[kind]}`).click();
    guidance[kind] = await page.getByTestId("spatial-kind-guidance").textContent();
    assert.ok(guidance[kind]);
    if (await page.getByTestId("spatial-inspector-toggle").isVisible()
      && await page.getByTestId("spatial-inspector-toggle").getAttribute("aria-expanded") === "false") {
      await page.getByTestId("spatial-inspector-toggle").click();
    }
    await page.screenshot({ path: `${outDir}/${kind}.png`, animations: "disabled" });
  }
  await page.getByTestId("spatial-place-exterior-object").selectOption(expected.objectId);
  const result = await page.evaluate(async (placeId) => {
    const { visibleAuthoringProject } = await import("/src/editor/panels/spatialAuthoringAccess.ts");
    const { store } = await import("/src/project/store.ts");
    return { draft: visibleAuthoringProject().spatialAuthoring.library.places[placeId].exterior,
      live: store.getCurrent().spatialAuthoring.library.places[placeId].exterior ?? null };
  }, expected.placeId);
  assert.deepEqual(result.draft, expected.graphic);
  assert.equal(result.live, null);
  await page.screenshot({ path: `${outDir}/place-exterior-selected.png`, animations: "disabled" });
  await page.getByText("외형 선택 안내 · 직접 지정", { exact: true }).click();
  await page.screenshot({ path: `${outDir}/place-exterior-guidance.png`, animations: "disabled" });
  await page.getByText("외형 선택 안내 · 직접 지정", { exact: true }).click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ path: `${outDir}/place-1024.png`, animations: "disabled" });
  await writeFile(`${outDir}/evidence.json`, JSON.stringify({ guidance, result, remoteWrites: "blocked" }, null, 2));
  console.log(JSON.stringify({ outDir, result }));
} finally {
  await browser.close();
}
