import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addDatabaseRecord, deleteDatabaseRecord } from "@/editor/databaseActions";
import { renderRecordTab, resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { DATABASE_FOOTER_ACTION_TEST_IDS } from "@/editor/panels/databaseWorkbench";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, FakeNode, findByTestId, installFakeDom } from "./fakeDom";

type FakeBrowserGlobals = {
  readonly window: typeof globalThis.window | undefined;
  readonly requestAnimationFrame: typeof globalThis.requestAnimationFrame | undefined;
};

let restoreDom: (() => void) | undefined;
let previousBrowserGlobals: FakeBrowserGlobals;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousBrowserGlobals = {
    requestAnimationFrame: globalThis.requestAnimationFrame,
    window: globalThis.window,
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      clearTimeout,
      setTimeout: (handler: TimerHandler): number => {
        if (typeof handler === "function") handler();
        return 0;
      },
    },
  });
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    },
  });
  store.replace(createBlankProject());
  resetDatabaseRecordViewSession();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  restoreBrowserGlobal("window", previousBrowserGlobals.window);
  restoreBrowserGlobal("requestAnimationFrame", previousBrowserGlobals.requestAnimationFrame);
});

describe("Database RM2K3 workbench context", () => {
  it("keeps the footer actions stable", () => {
    expect(DATABASE_FOOTER_ACTION_TEST_IDS).toEqual({
      apply: "database-footer-apply",
      cancel: "database-footer-cancel",
      ok: "database-footer-ok",
    });
  });

  it("Given a stale deleted selection When a modal session restarts Then it selects the first live record", () => {
    const firstSkill = store.getCurrent().database.skills[0];
    const secondSkillId = addDatabaseRecord("skills");
    expect(firstSkill).toBeDefined();

    const selectedRow = findByTestId(renderRecordHost("skills"), `db-record-row-${secondSkillId}`);
    selectedRow?.click();

    expect(findByTestId(renderRecordHost("skills"), `db-record-row-${secondSkillId}`)?.attrs["aria-pressed"]).toBe("true");

    const deleteResult = deleteDatabaseRecord("skills", secondSkillId);
    expect(deleteResult.ok).toBe(true);
    resetDatabaseRecordViewSession();

    const reopened = renderRecordHost("skills");
    expect(findByTestId(reopened, `db-record-row-${secondSkillId}`)).toBeNull();
    expect(findByTestId(reopened, `db-record-row-${firstSkill.id}`)?.attrs["aria-pressed"]).toBe("true");
  });

  it("Given a search on one record tab When another tab renders Then the new tab has an isolated blank search", () => {
    const actorSearch = searchInput(renderRecordHost("actors"));
    actorSearch.value = "Hero";
    actorSearch.dispatchEvent(new Event("input"));

    expect(searchInput(renderRecordHost("actors")).value).toBe("Hero");
    expect(searchInput(renderRecordHost("skills")).value).toBe("");
  });

  it("Given class visual filler rows When automation queries records Then fillers are decorative non-records", () => {
    const host = renderRecordHost("classes");
    const recordRows = allElements(host).filter((node) => node.dataset.testid?.startsWith("db-record-row-"));
    const fillerRows = allElements(host).filter((node) => node.className.split(/\s+/u).includes("db-list-row-visual-filler"));

    expect(recordRows).toHaveLength(store.getCurrent().database.classes.length);
    expect(fillerRows.length).toBeGreaterThan(0);
    for (const row of fillerRows) {
      expect(row.dataset.testid).toBeUndefined();
      expect(row.dataset.recordId).toBeUndefined();
      expect(row.disabled || row.attrs.disabled === "true").toBe(true);
      expect(row.attrs["aria-hidden"]).toBe("true");
    }
  });
});

function renderRecordHost(collection: Parameters<typeof renderRecordTab>[1]): FakeElement {
  const host = document.createElement("div");
  renderRecordTab(host, collection, () => undefined);
  if (host instanceof FakeElement) return host;
  throw new Error("Expected fake database host");
}

function searchInput(host: FakeElement): FakeElement {
  const input = host.querySelector("input");
  if (input) return input;
  throw new Error("Expected database search input");
}

function allElements(root: FakeNode): FakeElement[] {
  const matches: FakeElement[] = [];
  for (const child of root.childNodes) {
    if (child instanceof FakeElement) matches.push(child, ...allElements(child));
  }
  return matches;
}

function restoreBrowserGlobal(name: keyof FakeBrowserGlobals, value: FakeBrowserGlobals[typeof name]): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, name);
    return;
  }
  Object.defineProperty(globalThis, name, { configurable: true, value });
}
