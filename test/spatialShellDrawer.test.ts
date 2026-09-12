// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { getDatabaseActiveTab, renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { listSpatialGalleryCards, spatialCardDomSelector, spatialPresentationId } from "@/editor/panels/spatialCatalog";
import {
  resetSpatialAuthoringSessions,
  spatialSession,
  type SpatialAuthoringSession,
} from "@/editor/panels/spatialAuthoringSession";
import { resetScratchConceptTabSession } from "@/editor/panels/scratchConceptTab";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

let host: HTMLDivElement;
const previousProject = store.getCurrent();
const previousEditor = editorState.get();

beforeEach(() => {
  const project = createBlankProject();
  for (const tileset of Object.values(project.tilesets)) delete tileset.scratchConceptBundles;
  store.replace(project);
  editorState.set({ currentMapId: project.startMapId });
  resetScratchConceptTabSession();
  resetSpatialAuthoringSessions();
  setDatabaseActiveTab("scratchConcepts");
  host = document.createElement("div");
  host.className = "database-modal-body";
  document.body.append(host);
});

afterEach(() => {
  host.remove();
  resetScratchConceptTabSession();
  resetSpatialAuthoringSessions();
  store.replace(previousProject);
  editorState.set(previousEditor);
  setDatabaseActiveTab("overview");
});

describe("spatial inspector drawer", () => {
  it("exposes a user-controlled inspector toggle that does not start open", () => {
    // Given / When
    renderDatabasePanel(host);
    const toggle = host.querySelector<HTMLButtonElement>("[data-testid='spatial-inspector-toggle']");
    const inspector = host.querySelector("[data-testid='spatial-inspector']");

    // Then
    expect(toggle, "1024 inspector must be selectable").not.toBeNull();
    expect(inspector?.classList.contains("is-open")).toBe(false);
    toggle?.click();
    expect(host.querySelector("[data-testid='spatial-inspector']")?.classList.contains("is-open")).toBe(true);
  });

  it("selects a coherent default without a prior design id", () => {
    setDatabaseActiveTab("spatialPlaces");
    renderDatabasePanel(host);
    const selected = host.querySelector("[data-testid^='spatial-card-'].is-selected");
    const header = host.querySelector("[data-testid='spatial-name']")?.textContent ?? "";
    const inspector = host.querySelector(".spatial-inspector-name")?.textContent ?? "";
    expect(selected).not.toBeNull();
    expect(spatialSession().designId).toBe(selected?.getAttribute("data-card-id"));
    expect(header).toBe(inspector);
    expect(header).not.toBe("장소");
  });

  it("does not retarget chrome or inspector when a source filter hides the selection", () => {
    const first = Object.keys(store.getCurrent().tilesets)[0];
    if (!first) throw new Error("missing tileset");
    store.update((draft) => {
      const tileset = draft.tilesets[first];
      if (!tileset) throw new Error("missing tileset");
      tileset.structureKits = [{
        id: "my_chair",
        name: "Workshop Chair",
        kind: "section",
        width: 1,
        height: 1,
        rows: [{ tiles: [8] }],
        learnedFrom: "user-paint",
        ai: { snap: "floor", interiorRole: "bed" },
      }];
    });
    renderDatabasePanel(host);
    host.querySelector<HTMLButtonElement>("[data-testid='db-tab-spatial-objects']")?.click();
    const builtin = host.querySelector<HTMLButtonElement>("[data-testid='spatial-card-bed_v']");
    expect(builtin, "builtin bed_v card").not.toBeNull();
    builtin?.click();
    const beforeHeader = host.querySelector("[data-testid='spatial-name']")?.textContent ?? "";
    const beforeId = spatialSession().designId;
    host.querySelector<HTMLButtonElement>("[data-testid='spatial-source-own']")?.click();
    expect(spatialSession().designId).toBe(beforeId);
    expect(host.querySelector("[data-testid='spatial-name']")?.textContent).toBe(beforeHeader);
    expect(host.querySelector(".spatial-inspector-name")?.textContent).toBe(beforeHeader);
    expect(host.querySelector("[data-testid^='spatial-card-'].is-selected")?.getAttribute("data-testid")).not.toBe(
      `spatial-card-${first}::my_chair`,
    );
    expect(host.querySelector(".spatial-inspector-name")?.textContent).not.toBe("Workshop Chair");
  });

  it("clears legacy origin when the canonical Regions tab is clicked after villages", () => {
    setDatabaseActiveTab("villages");
    renderDatabasePanel(host);
    expect(spatialSession().legacyOrigin).toBe("villages");
    expect(spatialSession().tab).toBe("regions");
    expect(spatialSession().regionKindFilter).toBe("settlement");
    expect(host.querySelector("[data-testid=spatial-village-back]")).not.toBeNull();
    host.querySelector<HTMLButtonElement>("[data-testid='db-tab-spatial-regions']")?.click();
    expect(getDatabaseActiveTab()).toBe("spatialRegions");
    expect(spatialSession().tab).toBe("regions");
    expect(spatialSession().legacyOrigin).toBeNull();
    expect(spatialSession().regionKindFilter).toBeNull();
    expect(host.querySelector(".spatial-legacy-host")).toBeNull();
  });

  it("counts authored kits in the objects rail badge", () => {
    const first = Object.keys(store.getCurrent().tilesets)[0];
    if (!first) throw new Error("missing tileset");
    store.update((draft) => {
      const tileset = draft.tilesets[first];
      if (!tileset) throw new Error("missing tileset");
      tileset.structureKits = [
        { id: "my_chair", name: "Workshop Chair", kind: "section", width: 1, height: 1, rows: [{ tiles: [8] }], learnedFrom: "user-paint", ai: { snap: "floor", interiorRole: "bed" } },
        { id: "my_table", name: "Workshop Table", kind: "section", width: 1, height: 1, rows: [{ tiles: [3] }], learnedFrom: "user-paint", ai: { snap: "floor", interiorRole: "table" } },
      ];
    });
    setDatabaseActiveTab("spatialObjects");
    renderDatabasePanel(host);
    const badge = host.querySelector<HTMLElement>("[data-testid='db-tab-spatial-objects']")?.dataset.count ?? null;
    const session: SpatialAuthoringSession = { ...spatialSession(), tab: "objects", source: "all", mode: "design" };
    const gallery = listSpatialGalleryCards(session);
    expect(Number(badge)).toBe(gallery.length);
    expect(gallery.filter((card) => card.source === "own").length).toBeGreaterThanOrEqual(2);
  });

  it("selects an opaque colon-qualified card through a safe DOM selector", () => {
    const donorId = Object.keys(store.getCurrent().tilesets)[0];
    if (!donorId) throw new Error("missing donor");
    const donor = store.getCurrent().tilesets[donorId];
    if (!donor) throw new Error("missing donor");
    store.update((draft) => {
      draft.tilesets["atlas::west"] = {
        ...structuredClone(donor),
        id: "atlas::west",
        structureKits: [{
          id: "bed",
          name: "Colon-scope bed",
          kind: "section",
          width: 1,
          height: 1,
          rows: [{ tiles: [11] }],
          learnedFrom: "user-paint",
          ai: { snap: "floor", interiorRole: "bed" },
        }],
      };
    });
    setDatabaseActiveTab("spatialObjects");
    renderDatabasePanel(host);
    host.querySelector<HTMLButtonElement>("[data-testid='spatial-source-own']")?.click();
    const id = spatialPresentationId("tileset-kit", "atlas::west", "bed");
    const card = host.querySelector(spatialCardDomSelector(id));
    expect(card, "opaque card selector").not.toBeNull();
    expect(card?.textContent).toContain("Colon-scope bed");
    (card as HTMLButtonElement | null)?.click();
    expect(spatialSession().designId).toBe(id);
    expect(host.querySelector("[data-testid='spatial-name']")?.textContent).toBe("Colon-scope bed");
  });
});
