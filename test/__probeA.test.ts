import { describe, expect, it } from "vitest";
import { findByTestId, installFakeDom } from "./fakeDom";

describe("probeA settings tab click", () => {
  it("click settings tab then find laws", async () => {
    const cleanup = installFakeDom();
    const { renderWorldCanonTab } = await import("@/editor/panels/databaseWorldCanonView");
    const { createBlankProject } = await import("@/project/defaults");
    const { store } = await import("@/project/store");
    store.replace(createBlankProject());
    const host = document.createElement("div");
    renderWorldCanonTab(host, () => {});
    console.log("LAW_BEFORE", findByTestId(host as never, "db-world-canon-law-gods") !== null);
    const tab = findByTestId(host as never, "db-ws-section-tab-settings");
    console.log("TAB_FOUND", tab !== null);
    (tab as unknown as { click: () => void })?.click();
    console.log("LAW_AFTER", findByTestId(host as never, "db-world-canon-law-gods") !== null);
    console.log("PANEL_SETTINGS", findByTestId(host as never, "db-ws-section-panel-settings") !== null);
    cleanup();
    expect(true).toBe(true);
  });
});
