import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderWorldPanel } from "@/editor/panels/worldPanel";
import { createWorldPanelState, setPersistedCodexView } from "@/editor/panels/worldManager";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

let cleanup: () => void;
beforeEach(() => {
  cleanup = installFakeDom();
  setPersistedCodexView("overview", null);
  const project = createBlankProject();
  project.world = {
    entities: [
      { id: "w_person", type: "character", name: "기록관", summary: "", origin: "user" },
      { id: "w_event", type: "event", name: "일식", summary: "", origin: "user" },
      { id: "w_place", type: "place", name: "항구", summary: "", origin: "user" },
      { id: "w_faction", type: "faction", name: "의회", summary: "", origin: "user" },
    ],
    relations: [{ a: "w_person", b: "w_faction", kind: "memberOf" }],
  };
  store.replace(project);
});
afterEach(() => cleanup());

function control(panel: FakeElement, id: string): FakeElement {
  const node = findByTestId(panel, id);
  if (!node) throw new Error(`Missing control: ${id}`);
  return node;
}

describe("world document navigation", () => {
  it("clears an unrelated reading selection when the category changes", () => {
    const panel = renderWithFakeDom(() => renderWorldPanel());
    control(panel, "world-card-w_person").click();
    control(panel, "world-tab-event").click();
    expect(control(panel, "world-wiki-view").dataset.entityId).toBeUndefined();
    expect(findByTestId(panel, "world-card-w_event")).toBeTruthy();
  });

  it("clears reading details when search excludes the selected document", () => {
    const panel = renderWithFakeDom(() => renderWorldPanel());
    control(panel, "world-card-w_person").click();
    const search = control(panel, "world-search");
    search.value = "not-found";
    search.dispatchEvent(new Event("input"));
    expect(control(panel, "world-wiki-view").dataset.entityId).toBeUndefined();
    expect(control(panel, "world-search")).toBe(search);
  });

  it("preserves an out-of-filter draft and explicitly marks its context", () => {
    const state = createWorldPanelState();
    const panel = renderWithFakeDom(() => renderWorldPanel({ state }));
    control(panel, "world-card-w_person").click();
    control(panel, "world-edit-toggle").click();
    const input = control(panel, "world-edit-name");
    input.value = "작성 중인 인물";
    input.dispatchEvent(new Event("input"));
    control(panel, "world-tab-event").click();
    expect(state.editDraft?.name).toBe("작성 중인 인물");
    expect(control(panel, "world-draft-outside-filter").dataset.entityId).toBe("w_person");
  });

  it("browses places separately from factions", () => {
    const panel = renderWithFakeDom(() => renderWorldPanel());
    control(panel, "world-tab-place").click();
    expect(findByTestId(panel, "world-card-w_place")).toBeTruthy();
    expect(findByTestId(panel, "world-card-w_faction")).toBeNull();
  });

  it("opens a related document in its category", () => {
    const state = createWorldPanelState();
    const panel = renderWithFakeDom(() => renderWorldPanel({ state }));
    control(panel, "world-tab-character").click();
    control(panel, "world-card-w_person").click();
    control(panel, "world-relation-chip").click();
    expect(state.tab).toBe("faction");
    expect(control(panel, "world-wiki-view").dataset.entityId).toBe("w_faction");
    expect(findByTestId(panel, "world-card-w_faction")).toBeTruthy();
  });
});
