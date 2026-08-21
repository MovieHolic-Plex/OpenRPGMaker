import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { installLayoutBboxOverlay } from "@/editor/layoutBboxOverlay";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

describe("layout bbox overlay", () => {
  let restore: () => void;
  let unsub: (() => void) | null = null;

  beforeEach(() => {
    restore = installFakeDom();
    Object.defineProperty(globalThis, "getComputedStyle", {
      configurable: true,
      value: () => ({ position: "relative" }),
    });
    store.replace(createBlankProject());
    const host = document.createElement("div");
    host.className = "phaser-container";
    document.body.append(host);
    editorState.set({
      currentMapId: store.getCurrent().startMapId,
      showLayoutBboxes: true,
    });
  });

  afterEach(() => {
    unsub?.();
    unsub = null;
    restore();
  });

  it("does not paint a layoutPlan empty chip on the canvas", () => {
    unsub = installLayoutBboxOverlay();
    const overlay = document.querySelector(".layout-bbox-overlay");
    expect(overlay?.textContent ?? "").not.toContain("layoutPlan");
    expect(overlay?.childElementCount ?? 0).toBe(0);
  });

  it("draws region boxes when a layout plan exists", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    if (!map) throw new Error("blank project missing start map");
    store.replace({
      ...project,
      maps: {
        ...project.maps,
        [mapId]: {
          ...map,
          layoutPlan: {
            version: 1,
            kind: "test-plan",
            regions: [{ id: "house-1", role: "house", label: "파란 집", x: 2, y: 3, w: 4, h: 3 }],
          },
        },
      },
    });
    unsub = installLayoutBboxOverlay();
    const overlay = document.querySelector(".layout-bbox-overlay");
    expect(overlay?.textContent).toContain("파란 집");
    expect(overlay?.textContent ?? "").not.toContain("layoutPlan");
  });
});
