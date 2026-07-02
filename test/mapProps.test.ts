import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderMapProps } from "@/editor/panels/mapProps";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

describe("map properties panel", () => {
  let restoreDom: () => void;

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId });
  });

  afterEach(() => {
    restoreDom();
  });

  it("applies the typed map name when the user presses apply", () => {
    const container = new FakeElement("div");
    const mapId = store.getCurrent().startMapId;

    renderMapProps(container as unknown as HTMLElement);
    const nameInput = findByTestId(container, "map-name-input");
    const applyButton = findByTestId(container, "map-resize-apply");
    if (!nameInput || !applyButton) throw new Error("Expected map properties controls");

    nameInput.value = "01 집 외관 정면";
    applyButton.dispatchEvent(new Event("click"));

    expect(store.getCurrent().maps[mapId]?.name).toBe("01 집 외관 정면");
  });
});
