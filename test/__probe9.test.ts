import { describe, expect, it } from "vitest";
import { findByTestId, installFakeDom } from "./fakeDom";

describe("probe9 bodyPanel content", () => {
  it("inspect bodyPanel after render", async () => {
    const cleanup = installFakeDom();
    const { renderWorldCanonTab } = await import("@/editor/panels/databaseWorldCanonView");
    const { createBlankProject } = await import("@/project/defaults");
    const { store } = await import("@/project/store");
    store.replace(createBlankProject());
    const host = document.createElement("div");
    renderWorldCanonTab(host, () => {});
    const panel = findByTestId(host as never, "db-ws-section-panel-body");
    const tabBody = panel?.children[0] as unknown as { children?: unknown[] } | undefined;
    console.log("TABBODY_CHILDREN", tabBody?.children?.length);
    for (const c of tabBody?.children ?? []) {
      console.log("TABBODY_CHILD", (c as unknown as { className?: string }).className, (c as unknown as { textContent?: string }).textContent?.slice(0, 30));
    }
    cleanup();
    expect(true).toBe(true);
  });
});
