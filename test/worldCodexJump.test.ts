import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderOverviewTab } from "@/editor/panels/databaseOverviewView";
import { renderWorldPanel } from "@/editor/panels/worldPanel";
import { readCodexEntryFromUrl } from "@/editor/panels/worldEntries";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

function renderOverview(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  renderOverviewTab(host as unknown as HTMLElement, () => undefined);
  return host;
}

describe("overview codex card (click-to-jump RED-first)", () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    cleanup = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => cleanup?.());

  it("shows a codex card that explains loose cards live outside the canon", () => {
    const card = findByTestId(renderOverview(), "db-overview-codex");
    expect(card?.textContent ?? "").toContain("설정집");
  });

  it("routes the codex card at the codex tab, not the canon tab", () => {
    const card = findByTestId(renderOverview(), "db-overview-codex");
    expect(card?.attrs.title ?? "").toContain("설정집");
  });
});

describe("codex url entry (RED-first)", () => {
  it("parses a tab+entity deep link from the query string", () => {
    expect(readCodexEntryFromUrl("?codexTab=character&codexEntity=w_char_1")).toEqual({ tab: "character", entityId: "w_char_1" });
  });

  it("returns null for a query without codex params", () => {
    expect(readCodexEntryFromUrl("?map=map_village")).toBeNull();
  });

  it("returns null when the tab or the entity is missing", () => {
    expect(readCodexEntryFromUrl("?codexTab=character")).toBeNull();
    expect(readCodexEntryFromUrl("?codexEntity=w_char_1")).toBeNull();
  });

  it("returns null for an unknown tab", () => {
    expect(readCodexEntryFromUrl("?codexTab=nope&codexEntity=w_char_1")).toBeNull();
  });
});

describe("codex deep link adopt", () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    cleanup = installFakeDom();
    const project = createBlankProject();
    project.world = {
      entities: [
        { id: "w_char_1", type: "character", name: "아린", summary: "주인공", origin: "user" },
      ],
      relations: [],
    };
    store.replace(project as Project);
  });

  afterEach(() => cleanup?.());

  it("selects the linked card on first render", () => {
    const guard = setSearch("?codexTab=character&codexEntity=w_char_1");
    try {
      const panel = renderWithFakeDom(() => renderWorldPanel({ embedded: true }));
      expect(findByTestId(panel, "world-tab-character")?.classList.contains("active")).toBe(true);
      expect(findByTestId(panel, "world-card-w_char_1")?.classList.contains("active")).toBe(true);
    } finally {
      guard.restore();
    }
  });

  it("ignores a deep link for an unknown entity", () => {
    const guard = setSearch("?codexTab=character&codexEntity=w_nope");
    try {
      const panel = renderWithFakeDom(() => renderWorldPanel({ embedded: true }));
      expect(findByTestId(panel, "world-card-w_nope")).toBeNull();
    } finally {
      guard.restore();
    }
  });
});

function setSearch(search: string): { restore: () => void } {
  const prev = (globalThis as Record<string, unknown>).window;
  const win = (typeof prev === "object" && prev !== null ? prev : {}) as Record<string, unknown>;
  win.location = { ...((win.location ?? {}) as Record<string, unknown>), search };
  (globalThis as Record<string, unknown>).window = win;
  return { restore: () => { (globalThis as Record<string, unknown>).window = prev; } };
}
