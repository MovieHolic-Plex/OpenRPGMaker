// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import {
  bindSpatialAuthoringControllerFactory,
  hasAuthoringPreview,
} from "@/editor/panels/spatialAuthoringAccess";
import {
  resetSpatialAuthoringSessions,
  spatialProjectKey,
} from "@/editor/panels/spatialAuthoringSession";
import { spatialBuildProposal } from "@/editor/panels/spatialBuildActions";
import { resetSpatialObjectsTabChrome } from "@/editor/panels/spatialObjectChromeState";
import { libraryObjectCardId } from "@/editor/panels/spatialObjectDraft";
import { resetSpatialPlacesTabChrome } from "@/editor/panels/spatialPlaceChromeState";
import { librarySpaceCardId } from "@/editor/panels/spatialSpaceDraft";
import { resetSpatialSpacesTabChrome } from "@/editor/panels/spatialSpacesTab";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { store } from "@/project/store";
import { manualBuildFixture } from "./support/spatialManualBuildFixture";
import { spaceDesign } from "./support/spatialSpaceCompilerFixture";

const previous = store.getCurrent();
const previousEditor = editorState.get();
let host: HTMLDivElement;
let target: ReturnType<typeof manualBuildFixture>["target"];

function paint(): void {
  renderDatabasePanel(host);
}

function control<T extends Element>(testid: string): T {
  const node = host.querySelector<T>(`[data-testid=${JSON.stringify(testid)}]`);
  if (!node) throw new Error(`missing ${testid}`);
  return node;
}

function fill(testid: string, value: string): void {
  const input = control<HTMLInputElement>(testid);
  input.value = value;
  input.dispatchEvent(new Event("change"));
}

function click(testid: string): void {
  const picker = host.querySelector<HTMLSelectElement>("[data-testid='composition-design']");
  if (testid.startsWith("spatial-card-") && picker) {
    picker.value = testid.slice("spatial-card-".length); picker.dispatchEvent(new Event("change")); return;
  }
  control<HTMLButtonElement>(testid).click();
}

function selectObject(): void {
  setDatabaseActiveTab("spatialObjects");
  paint();
  click(`spatial-card-${libraryObjectCardId("hearth-design")}`);
}

function selectSpace(): void {
  setDatabaseActiveTab("spatialSpaces");
  paint();
  click(`spatial-card-${librarySpaceCardId(spaceDesign)}`);
}

function fillTarget(): void {
  fill("spatial-build-map", target.mapId);
  fill("spatial-build-rect-x", String(target.rect.x));
  fill("spatial-build-rect-y", String(target.rect.y));
  fill("spatial-build-rect-width", String(target.rect.width));
  fill("spatial-build-rect-height", String(target.rect.height));
  fill("spatial-build-entry-x", String(target.entry.x));
  fill("spatial-build-entry-y", String(target.entry.y));
}

beforeEach(() => {
  bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
  resetSpatialAuthoringSessions();
  resetSpatialPlacesTabChrome();
  resetSpatialSpacesTabChrome();
  resetSpatialObjectsTabChrome();
  resetMapEditHistory();
  target = manualBuildFixture().target;
  editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null, activePaletteStamp: null });
  host = document.createElement("div");
  host.className = "database-modal-body";
  document.body.append(host);
});

afterEach(() => {
  host.remove();
  bindSpatialAuthoringControllerFactory(null);
  resetSpatialAuthoringSessions();
  resetSpatialPlacesTabChrome();
  resetSpatialSpacesTabChrome();
  resetSpatialObjectsTabChrome();
  store.replace(previous, { preserveEventDrafts: false });
  editorState.set(previousEditor);
  setDatabaseActiveTab("overview");
});

describe("source build input lifecycle", () => {
  it("requires fresh object target consent after store.replaceProject with a coincident map id", () => {
    // Given
    selectObject();
    fillTarget();
    fill("spatial-build-seed", "19");
    click("spatial-build");
    expect(hasAuthoringPreview()).toBe(true);
    const other = structuredClone(store.getCurrent());
    const otherMap = other.maps[target.mapId];
    if (!otherMap) throw new Error("missing coincident map");
    otherMap.name = "Project B coincident map";
    const keyA = spatialProjectKey();
    store.replaceProject(other);
    expect(spatialProjectKey()).not.toBe(keyA);
    paint();
    selectObject();
    expect(spatialBuildProposal()).toBeNull();
    const beforeB = structuredClone(store.getCurrent());
    // When
    click("spatial-build");
    const previewIssued = hasAuthoringPreview();
    click("spatial-apply");
    // Then
    expect(previewIssued).toBe(false);
    expect(spatialBuildProposal()).toBeNull();
    expect(store.getCurrent()).toEqual(beforeB);
  });

  it.each(["", "1.5", "9007199254740992"] as const)("rejects empty or non-integer seed %j without issuing a proposal", (value) => {
    // Given
    selectSpace();
    fill("spatial-build-seed", value);
    const live = structuredClone(store.getCurrent());
    // When
    click("spatial-build");
    // Then
    expect(hasAuthoringPreview()).toBe(false);
    expect(spatialBuildProposal()).toBeNull();
    expect(store.getCurrent()).toEqual(live);
    expect(control<HTMLInputElement>("spatial-build-seed").value).toBe(value);
  });

  it("keeps an explicit zero seed as zero", () => {
    // Given
    selectSpace();
    fill("spatial-build-seed", "0");
    // When
    click("spatial-build");
    // Then
    expect(spatialBuildProposal()?.input.seed).toBe(0);
    expect(hasAuthoringPreview()).toBe(true);
  });

  it("rejects a negative object entry without pinning, then builds after correction", () => {
    // Given
    selectObject();
    fillTarget();
    fill("spatial-build-seed", "19");
    fill("spatial-build-entry-x", "-1");
    click("spatial-build");
    expect(hasAuthoringPreview()).toBe(false);
    expect(spatialBuildProposal()).toBeNull();
    expect(control<HTMLElement>("spatial-preview-error").textContent).not.toBe("");
    expect(control<HTMLInputElement>("spatial-build-entry-x").value).toBe("-1");
    const live = structuredClone(store.getCurrent());
    // When
    fill("spatial-build-entry-x", String(target.entry.x));
    click("spatial-build");
    // Then
    expect(store.getCurrent()).toEqual(live);
    expect(hasAuthoringPreview()).toBe(true);
    expect(spatialBuildProposal()?.input.destination).toMatchObject({
      kind: "map",
      currentMapId: target.mapId,
      entry: target.entry,
    });
    expect(control<HTMLElement>("spatial-preview-error").textContent).toBe("");
  });
});
