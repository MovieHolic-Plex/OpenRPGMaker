import assert from "node:assert/strict";
import { resolve } from "node:path";
import type { Page } from "playwright";
import { placeCompilerFixture } from "../../test/support/spatialPlaceCompilerFixture";
import { spaceDesign } from "../../test/support/spatialSpaceCompilerFixture";
import { libraryPlaceCardId } from "../../src/editor/panels/spatialPlaceQuery";
import { librarySpaceCardId } from "../../src/editor/panels/spatialSpaceDraft";

async function readState(page: Page) {
  return page.evaluate(async (id) => {
    const { store }: typeof import("../../src/project/store") = await import("/src/" + "project/store.ts");
    const { spatialSession }: typeof import("../../src/editor/panels/spatialAuthoringSession") =
      await import("/src/" + "editor/panels/spatialAuthoringSession.ts");
    const { visibleAuthoringProject }: typeof import("../../src/editor/panels/spatialAuthoringAccess") =
      await import("/src/" + "editor/panels/spatialAuthoringAccess.ts");
    const { getDatabaseActiveTab }: typeof import("../../src/editor/panels/database") =
      await import("/src/" + "editor/panels/database.ts");
    const live = store.getCurrent().spatialAuthoring?.library.spaces[id];
    const draft = visibleAuthoringProject().spatialAuthoring?.library.spaces[id];
    return {
      databaseTab: getDatabaseActiveTab(), session: spatialSession(),
      liveWidth: live?.width, draftWidth: draft?.width,
      liveSlot: live?.objectSlots.find(slot => slot.id === "hearth")?.placement,
      draftSlot: draft?.objectSlots.find(slot => slot.id === "hearth")?.placement,
      applyDisabled: document.querySelector<HTMLButtonElement>("[data-testid='spatial-apply']")?.disabled,
    };
  }, spaceDesign);
}

export type SurfaceReceipt = {
  readonly step: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly state: Awaited<ReturnType<typeof readState>>;
  readonly inspectorReadiness?: { readonly widthVisible: boolean; readonly toggleVisible: boolean };
};

/** Real Database actions; every required fixture and state change is asserted. */
export async function runSpatialSurface(page: Page, out: string, record: (receipt: SurfaceReceipt) => void): Promise<void> {
  const viewport = page.viewportSize();
  assert.ok(viewport);
  const name = `${viewport.width}x${viewport.height}`;
  const snapshot = async (step: string) => {
    const state = await readState(page);
    record({ step, viewport, state });
    return state;
  };
  const project = placeCompilerFixture(7);
  const village = Object.values(project.spatialAuthoring?.library.places ?? {}).find(place => place.kind === "settlement");
  assert.ok(village);
  const square = village.children.find(child => child.id === "square");
  assert.ok(square && square.source.kind === "space");
  const initialWidth = project.spatialAuthoring?.library.spaces[spaceDesign]?.width;
  assert.equal(initialWidth, 16);
  page.setDefaultTimeout(30000);
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.goto(`http://127.0.0.1:${process.env.QA_PORT ?? 19873}/?blankProject=1&aiBridge=0`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByTestId("toolbar-database").waitFor({ state: "visible", timeout: 120000 });
  await page.evaluate(async (fixture) => {
    const { store }: typeof import("../../src/project/store") = await import("/src/" + "project/store.ts");
    const { editorState }: typeof import("../../src/editor/editorState") = await import("/src/" + "editor/editorState.ts");
    if (store.isRemotePersistenceEnabled()) throw new Error("QA requires local persistence");
    store.replace(fixture, { preserveEventDrafts: false });
    editorState.set({ currentMapId: fixture.startMapId });
  }, project);
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("database-modal").waitFor({ state: "visible" });
  const world = page.getByTestId("db-tab-group-world");
  if (await world.getAttribute("aria-expanded") === "false") await world.click();
  await page.getByTestId("db-tab-spatial-objects").click();
  await page.getByTestId("spatial-shell-objects").waitFor({ state: "visible" });
  await snapshot("objects");
  await page.screenshot({ path: resolve(out, `${name}-objects.png`), animations: "disabled" });
  await page.getByTestId("db-tab-spatial-spaces").click();
  await page.getByTestId(`spatial-card-${librarySpaceCardId(spaceDesign)}`).click();
  const board = page.getByTestId("spatial-space-board");
  await board.waitFor({ state: "visible" });
  const box = await board.boundingBox();
  const chromeBox = await page.locator(".spatial-actions").boundingBox();
  assert.ok(box && chromeBox);
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1, `${name} space board clipped`);
  assert.ok(chromeBox.y + chromeBox.height <= viewport.height + 1, `${name} chrome clipped`);
  const origin = await snapshot("space-selected");
  assert.equal(origin.session.designId, librarySpaceCardId(spaceDesign));
  assert.deepEqual(origin.draftSlot, { mode: "fixed", x: 1, y: 4 });
  await page.getByTestId("spatial-slot-hearth").dispatchEvent("pointerdown", { bubbles: true });
  await board.dispatchEvent("pointermove", { bubbles: true, clientX: box.x + 73, clientY: box.y + 121 });
  const dragged = await snapshot("space-slot-drag");
  assert.deepEqual(dragged.draftSlot, { mode: "fixed", x: 3, y: 5 });
  assert.deepEqual(dragged.liveSlot, origin.liveSlot);
  await board.press("Escape");
  const cancelled = await snapshot("space-slot-escape");
  assert.deepEqual(cancelled.draftSlot, origin.draftSlot);
  assert.deepEqual(cancelled.liveSlot, origin.liveSlot);
  await page.screenshot({ path: resolve(out, `${name}-spaces.png`), animations: "disabled" });
  await page.getByTestId("db-tab-spatial-places").click();
  await page.getByTestId(`spatial-card-${libraryPlaceCardId(village.id)}`).click();
  const beforeDrill = await snapshot("place-selected");
  await page.getByTestId("spatial-place-child-square").dispatchEvent("pointerdown", { bubbles: true });
  await page.getByTestId("spatial-places-board").press("Enter");
  await board.waitFor({ state: "visible" });
  const drilled = await snapshot("place-to-space");
  assert.equal(drilled.databaseTab, "spatialSpaces");
  assert.equal(drilled.session.tab, "spaces");
  assert.equal(drilled.session.designId, librarySpaceCardId(square.source.id));
  assert.equal(drilled.session.breadcrumb.length, beforeDrill.session.breadcrumb.length + 1);
  assert.equal(await page.getByTestId("spatial-places-board").count(), 0);
  await page.getByTestId("spatial-back").click();
  await page.getByTestId("spatial-places-board").waitFor({ state: "visible" });
  const back = await snapshot("back-to-place");
  assert.equal(back.databaseTab, "spatialPlaces");
  assert.equal(back.session.tab, "places");
  assert.equal(back.session.designId, beforeDrill.session.designId);
  assert.deepEqual(back.session.camera, beforeDrill.session.camera);
  assert.deepEqual(back.session.breadcrumb, beforeDrill.session.breadcrumb);
  assert.equal(await board.count(), 0);
  await page.screenshot({ path: resolve(out, `${name}-places.png`), animations: "disabled" });
  await page.getByTestId("db-tab-spatial-spaces").click();
  await page.getByTestId(`spatial-card-${librarySpaceCardId(spaceDesign)}`).click();
  const width = page.getByTestId("spatial-space-width");
  const inspector = page.getByTestId("spatial-inspector-toggle");
  const entry = { widthVisible: await width.isVisible(), toggleVisible: await inspector.isVisible() };
  record({ step: "width-inspector-entry", viewport, state: await readState(page), inspectorReadiness: entry });
  if (!entry.widthVisible) {
    assert.ok(entry.toggleVisible, "Hidden width field requires a visible inspector toggle");
    await inspector.click();
  }
  const readiness = { widthVisible: await width.isVisible(), toggleVisible: await inspector.isVisible() };
  record({ step: "width-inspector-ready", viewport, state: await readState(page), inspectorReadiness: readiness });
  assert.ok(readiness.widthVisible, "Required width field must be visible before editing");
  await width.fill("14");
  await width.dispatchEvent("change");
  const edited = await snapshot("width-draft");
  assert.equal(edited.liveWidth, initialWidth);
  assert.equal(edited.draftWidth, 14);
  assert.equal(edited.applyDisabled, true);
  await page.getByTestId("spatial-preview").click();
  const preview = await snapshot("width-preview");
  assert.equal(preview.liveWidth, initialWidth);
  assert.equal(preview.draftWidth, 14);
  assert.equal(preview.applyDisabled, false);
  await page.getByTestId("spatial-apply").click();
  const applied = await snapshot("width-applied");
  assert.equal(applied.liveWidth, 14);
  assert.equal(applied.draftWidth, 14);
  assert.equal(applied.applyDisabled, true);
  await page.getByTestId("spatial-undo").click();
  const undone = await snapshot("width-undone");
  assert.equal(undone.liveWidth, initialWidth);
  assert.equal(undone.draftWidth, initialWidth);
  await page.getByTestId("spatial-redo").click();
  const redone = await snapshot("width-redone");
  assert.equal(redone.liveWidth, 14);
  assert.equal(redone.draftWidth, 14);
  await page.screenshot({ path: resolve(out, `${name}-spaces-selected.png`), animations: "disabled" });
  await page.close();
}
