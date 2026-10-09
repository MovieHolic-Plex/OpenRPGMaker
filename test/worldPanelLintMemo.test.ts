import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWorldPanel } from "@/editor/panels/worldPanel";
import * as worldManager from "@/editor/panels/worldManager";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom, renderWithFakeDom } from "./fakeDom";

describe("world panel lint memo (perf RED-first)", () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    cleanup = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => cleanup?.());

  it("reuses the lint summary while the project object is unchanged", () => {
    const spy = vi.spyOn(worldManager, "summarizeWorldLint");
    try {
      const panel = renderWithFakeDom(() => renderWorldPanel({ embedded: true }));
      const firstCalls = spy.mock.calls.length;
      expect(firstCalls).toBeGreaterThan(0);
      const search = panel.querySelector(".world-search-input") as HTMLInputElement | null;
      expect(search).toBeTruthy();
      search!.value = "없는말";
      search!.dispatchEvent(new Event("input"));
      search!.value = "없는말2";
      search!.dispatchEvent(new Event("input"));
      expect(spy.mock.calls.length).toBe(firstCalls);
    } finally {
      spy.mockRestore();
    }
  });
});
