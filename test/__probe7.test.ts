import { describe, expect, it } from "vitest";
import { findByTestId, installFakeDom } from "./fakeDom";

describe("probe7 laws card children", () => {
  it("inspect laws card grid", async () => {
    const cleanup = installFakeDom();
    const { renderWorldCanonTab } = await import("@/editor/panels/databaseWorldCanonView");
    const { createBlankProject } = await import("@/project/defaults");
    const { store } = await import("@/project/store");
    store.replace(createBlankProject());
    const host = document.createElement("div");
    renderWorldCanonTab(host, () => {});
    const card = findByTestId(host as never, "db-world-canon-laws");
    console.log("CARD_FOUND", card !== null);
    const grid = (card as unknown as { querySelector: (s: string) => unknown }).querySelector(".world-canon-law-grid");
    console.log("GRID_FOUND", grid !== null);
    const gridChildren = (grid as unknown as { children?: unknown[] })?.children ?? [];
    console.log("GRID_CHILDREN", gridChildren.length);
    for (const c of gridChildren) console.log("GRID_CHILD_CLASS", (c as unknown as { className?: string }).className);
    cleanup();
    expect(true).toBe(true);
  });
});
