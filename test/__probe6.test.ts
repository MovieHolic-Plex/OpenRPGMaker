import { describe, expect, it } from "vitest";
import { findByTestId, installFakeDom } from "./fakeDom";

describe("probe6 law card hunt", () => {
  it("walk all testids", async () => {
    const cleanup = installFakeDom();
    const { renderWorldCanonTab } = await import("@/editor/panels/databaseWorldCanonView");
    const { createBlankProject } = await import("@/project/defaults");
    const { store } = await import("@/project/store");
    store.replace(createBlankProject());
    const host = document.createElement("div");
    renderWorldCanonTab(host, () => {});
    const found: string[] = [];
    const walk = (node: unknown): void => {
      const el = node as { dataset?: { testid?: string }; childNodes?: unknown[] };
      const tid = el.dataset?.testid;
      if (tid && tid.includes("law")) found.push(tid);
      for (const child of el.childNodes ?? []) walk(child);
    };
    walk(host);
    console.log("LAW_TESTIDS", JSON.stringify(found));
    cleanup();
    expect(true).toBe(true);
  });
});
