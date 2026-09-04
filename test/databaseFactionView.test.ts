import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderFactionsTab } from "@/editor/panels/databaseFactionView";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let cleanupDom: (() => void) | undefined;
let previousWindow: typeof globalThis.window | undefined;

beforeEach(() => {
  cleanupDom = installFakeDom();
  previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { setTimeout: (callback: TimerHandler): number => { if (typeof callback === "function") callback(); return 0; }, clearTimeout },
  });
  store.replace(createBlankProject());
});

afterEach(() => {
  cleanupDom?.();
  cleanupDom = undefined;
  if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
});

function renderView(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => {
    host.replaceChildren();
    renderFactionsTab(host as unknown as HTMLElement, rerender);
  };
  rerender();
  return host;
}

describe("database faction authoring view", () => {
  it("uses the canonical workspace builders and renders accessible reserved-faction matrix cells", () => {
    const host = renderView();
    expect(host.querySelectorAll(".db-record-workspace")).toHaveLength(1);
    expect(host.querySelectorAll(".db-list-pane")).toHaveLength(1);
    expect(findByTestId(host, "db-faction-search")?.getAttribute("type")).toBe("search");

    const relation = findByTestId(host, "db-faction-relation-enemy");
    expect(relation?.textContent).toContain("-1 적");
    expect(relation?.textContent).toContain("이쪽이 먼저 공격");
    expect(relation?.textContent).toContain("상대가 먼저 공격");
    expect(findByTestId(host, "db-faction-pick-enemy--1")?.getAttribute("aria-pressed")).toBe("true");

    const cell = findByTestId(host, "db-faction-stance-player-enemy");
    expect(cell?.tagName).toBe("BUTTON");
    expect(cell?.textContent).toContain("-1");
    expect(cell?.textContent).toContain("적");
    expect(cell?.textContent).toContain("기본");
    expect(cell?.getAttribute("aria-label")).toContain("기본");
  });

  it("creates factions and disables deletion for reserved ids", () => {
    const host = renderView();
    expect(findByTestId(host, "db-faction-delete")?.getAttribute("disabled")).toBe("true");

    findByTestId(host, "db-faction-create")?.click();
    expect(store.getCurrent().factions?.defs).toEqual([{ id: "faction_1", name: "새 진영" }]);
    expect(findByTestId(host, "db-faction-delete")?.getAttribute("disabled")).toBeNull();
    expect(findByTestId(host, "db-faction-stance-faction_1-player")?.textContent).toContain("중립");
  });

  it("changes a relation from the per-faction list and marks only the non-default value", () => {
    const project = createBlankProject();
    project.factions = { defs: [{ id: "guard", name: "경비병" }], relations: [] };
    store.replace(project);
    const host = renderView();

    const pick = findByTestId(host, "db-faction-pick-guard-1");
    expect(pick?.getAttribute("aria-pressed")).toBe("false");
    expect(findByTestId(host, "db-faction-relation-label-guard")?.textContent).toContain("기본");
    pick?.click();

    expect(store.getCurrent().factions?.relations).toEqual([{ a: "player", b: "guard", stance: 1 }]);
    expect(findByTestId(host, "db-faction-pick-guard-1")?.getAttribute("aria-pressed")).toBe("true");
    expect(findByTestId(host, "db-faction-relation-label-guard")?.textContent).toContain("바꿈");

    findByTestId(host, "db-faction-pick-guard-0")?.click();
    expect(store.getCurrent().factions?.relations).toEqual([]);
    expect(findByTestId(host, "db-faction-relation-label-guard")?.textContent).toContain("기본");
  });

  it("cycles a matrix cell and marks only the non-default value as authored", () => {
    const project = createBlankProject();
    project.factions = { defs: [{ id: "guard", name: "경비병" }], relations: [] };
    store.replace(project);
    const host = renderView();

    const cell = findByTestId(host, "db-faction-stance-player-guard");
    expect(cell?.dataset.authored).toBe("false");
    cell?.click();

    expect(store.getCurrent().factions?.relations).toEqual([{ a: "player", b: "guard", stance: 1 }]);
    expect(findByTestId(host, "db-faction-stance-player-guard")?.dataset.authored).toBe("true");
  });
});
