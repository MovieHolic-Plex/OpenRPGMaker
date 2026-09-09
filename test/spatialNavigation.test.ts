// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { resetScratchConceptTabSession } from "@/editor/panels/scratchConceptTab";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

const tabs = ["tiles", "objects", "spaces", "places", "regions", "worlds"] as const;
let host: HTMLDivElement;
const previousProject = store.getCurrent();
const previousEditor = editorState.get();
beforeEach(() => {
  const project = createBlankProject();
  // Missing libraries exercise the read-only contract, not an already-seeded fallback.
  for (const tileset of Object.values(project.tilesets)) delete tileset.scratchConceptBundles;
  store.replace(project);
  editorState.set({ currentMapId: project.startMapId });
  resetScratchConceptTabSession();
  setDatabaseActiveTab("scratchConcepts");
  host = document.createElement("div");
  host.className = "database-modal-body";
  document.body.append(host);
});
afterEach(() => {
  host.remove();
  resetScratchConceptTabSession();
  store.replace(previousProject);
  editorState.set(previousEditor);
  setDatabaseActiveTab("overview");
});

describe("spatial navigation acceptance (task 12 owns GREEN)", () => {
  it("renders the six ordered spatial destinations when the legacy concept route opens", () => {
    // Given: real database host and current outdoor map from beforeEach.
    // When
    renderDatabasePanel(host);
    // Then: renderer output, not a registry-only assertion.
    expect(Array.from(host.querySelectorAll<HTMLElement>('.db-tabs [data-testid^="db-tab-spatial-"]'), node => node.dataset.testid))
      .toEqual(tabs.map(tab => `db-tab-spatial-${tab}`));
  });

  it("leaves the whole project unchanged when opening a legacy authoring route to browse", () => {
    // Given
    const before = structuredClone(store.getCurrent());
    // When
    renderDatabasePanel(host);
    // Then: opening the route must not seed the missing interior catalog.
    expect(store.getCurrent()).toEqual(before);
  });

  it.each(tabs)("keeps browsing %s read-only through the rendered navigation control", tab => {
    // Given
    renderDatabasePanel(host);
    const before = structuredClone(store.getCurrent());
    const control = host.querySelector<HTMLButtonElement>(`[data-testid="db-tab-spatial-${tab}"]`);
    expect(control, `Missing rendered spatial route: ${tab}`).not.toBeNull();
    if (!control) throw new Error(`Missing rendered spatial route: ${tab}`);
    // When
    control.click();
    // Then
    expect(control.classList.contains("active")).toBe(true);
    expect(store.getCurrent()).toEqual(before);
  });
});
