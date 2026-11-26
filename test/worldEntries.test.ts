import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openDatabaseModalLazy = vi.hoisted(() => vi.fn());

vi.mock("@/editor/panels/databaseModalLazy", () => ({ openDatabaseModalLazy }));

import { openWorldCodexPanel, openWorldPanel } from "@/editor/panels/worldEntries";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

describe("worldEntries", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    store.replace(createBlankProject());
    openDatabaseModalLazy.mockClear();
  });

  afterEach(() => cleanupDom?.());

  it("opens the canon tab for the world entry", () => {
    openWorldPanel();
    expect(openDatabaseModalLazy).toHaveBeenCalledWith("worldCanon");
  });

  it("opens the codex tab for the codex entry", () => {
    openWorldCodexPanel();
    expect(openDatabaseModalLazy).toHaveBeenCalledWith("worldCodex");
  });
});
