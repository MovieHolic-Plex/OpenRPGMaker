// @vitest-environment happy-dom
import { setImmediate } from "node:timers/promises";
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import { PropertySymbol, Node as HappyDomNode } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { openDatabaseModal, requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { getSelectedMonsterSpeciesId, setSelectedMonsterSpeciesId } from "@/editor/panels/databaseMonsterSpeciesView";
import { setViewModeForCollection } from "@/editor/panels/databaseRecordViewSession";
import { createBlankProject } from "@/project/defaults";
import { normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { store } from "@/project/store";

const targetId = "species-100";
const rowHeight = 36;
const rowPitch = 37;
const viewportHeight = 562;
let speciesReveals: string[];

function control<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.querySelector<T>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing control: ${id}`);
  return node;
}
function list(): HTMLElement {
  return control("db-monster-species-list-pane").querySelector<HTMLElement>(".db-ws-list")!;
}
function click(id: string): void {
  const button = control(id);
  button.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  button.focus();
  button.click();
}
function input(id: string, value: string): void {
  const field = control<HTMLInputElement>(id);
  field.focus();
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}
function expectVisibleSelection(id: string): void {
  const row = control(`db-monster-species-row-${id}`);
  const rows = list();
  const top = Array.from(rows.children).indexOf(row) * rowPitch - rows.scrollTop;
  expect(getSelectedMonsterSpeciesId()).toBe(id);
  expect(row.getAttribute("aria-pressed")).toBe("true");
  expect(control("db-monster-species-hero").querySelector(".db-ws-hero-sub")?.textContent).toBe(id);
  expect(control<HTMLInputElement>("db-monster-species-search").value).toBe("");
  expect(top, "selected row must remain inside the refreshed viewport").toBeGreaterThanOrEqual(0);
  expect(top + rowHeight, "selected row must remain inside the refreshed viewport").toBeLessThanOrEqual(viewportHeight);
}

// Subscribe before triggering. Count actual workspace identities, not incidental
// mutations: the second workspace is the real modal/store deferred refresh.
// No mocked modal, subscriptions, rAF, timers, renderer, or fixed time advances.
async function afterSpeciesRenders(count: number, trigger: () => void | Promise<void>): Promise<void> {
  const modal = control("database-modal");
  if (!(modal instanceof HappyDomNode)) throw new Error("Expected a happy-dom modal node");
  const initial = document.querySelector('[data-testid="db-monster-species-workspace"]');
  const seen = new Set<HTMLElement>();
  const deliveryCallbacks: unknown[] = [];
  let observer: MutationObserver;
  let timeout: ReturnType<typeof setTimeout>;
  const changed = new Promise<void>((resolve) => {
    observer = new MutationObserver((records) => {
      // A delivery can contain multiple replacements. The added nodes retain
      // their identities even after removal; querying only live DOM loses them.
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && node !== initial && node.dataset.testid === "db-monster-species-workspace") seen.add(node);
        }
      }
      const current = document.querySelector<HTMLElement>('[data-testid="db-monster-species-workspace"]');
      if (seen.size >= count && current && seen.has(current)) resolve();
    });
    observer.observe(modal, { childList: true, subtree: true });
    // happy-dom 20.10.6 keeps its delivery closure only in a WeakRef, so GC can
    // silence a still-connected observer between immediate and deferred renders.
    // Retain that closure for this subscription only; do not replace delivery,
    // fabricate mutations, or change the real modal/store/timer schedule.
    deliveryCallbacks.push(...modal[PropertySymbol.mutationListeners]
      .map((listener) => listener.callback.deref()));
  });
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(`Expected ${count} species renders; observed ${seen.size}`)), 5000);
  });
  try {
    // Start synchronously after subscription, but keep both completion paths
    // under the deadline: observed renders do not imply the trigger succeeded.
    await Promise.race([Promise.all([changed, trigger()]), deadline]);
  } finally {
    observer!.disconnect();
    deliveryCallbacks.length = 0;
    clearTimeout(timeout!);
  }
}

beforeEach(() => {
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
  const project = createBlankProject();
  project.system.monsterCollection = true;
  project.database.enemies = [{ ...project.database.enemies[0]!, id: "enemy-target", speciesId: targetId }];
  project.database.monsterSpecies = Array.from({ length: 101 }, (_, index) => normalizeMonsterSpeciesRecord({
    id: `species-${index}`, name: `Species ${index}`,
  }));
  store.replace(project);
  resetMapEditHistory();
  setSelectedMonsterSpeciesId(targetId, { reveal: true });
  setViewModeForCollection("enemies", "list");
  speciesReveals = [];
  // happy-dom has no layout. Emulate only the native nearest-scroll geometry,
  // deriving the destination from the real list's children. Deliberately do not
  // emit scroll synchronously: browsers deliver that event after scrollIntoView.
  vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(function (this: HTMLElement) {
    if (!this.dataset.testid?.startsWith("db-monster-species-row-")) return;
    const rows = this.closest<HTMLElement>(".db-ws-list")!;
    const top = Array.from(rows.children).indexOf(this) * rowPitch;
    rows.scrollTop = Math.max(0, Math.min(top, Math.max(rows.scrollTop, top + rowHeight - viewportHeight)));
    speciesReveals.push(this.dataset.recordId!);
  });
});
afterEach(() => {
  requestDatabaseModalClose("battleTest");
  resetMapEditHistory();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function openSpeciesWithStaleSearch(): void {
  openDatabaseModal("monsterSpecies");
  input("db-monster-species-search", "no-match");
  expect(list().querySelectorAll(".db-list-row")).toHaveLength(0);
}
function editedEnemy(): void {
  openSpeciesWithStaleSearch();
  click("db-tab-enemies");
  const name = control("db-field-name");
  input("db-field-name", "Edited before navigation");
  expect(store.getCurrent().database.enemies[0]!.name).toBe("Edited before navigation");
  expect(control("db-field-name")).toBe(name);
  expect(document.activeElement).toBe(name);
}

describe("species scroll through real deferred database modal refresh", () => {
  it("counts batched workspace additions even when only the final workspace remains attached", async () => {
    openDatabaseModal("monsterSpecies");
    const batches: HTMLElement[][] = [];
    const observer = new MutationObserver((records) => {
      batches.push(records.flatMap((record) => Array.from(record.addedNodes).filter(
        (node): node is HTMLElement => node instanceof HTMLElement && node.dataset.testid === "db-monster-species-workspace",
      )));
    });
    observer.observe(control("database-modal"), { childList: true, subtree: true });
    try {
      await afterSpeciesRenders(2, () => {
        // Both real row actions render synchronously, before observer delivery.
        // No store refresh is fabricated to make the helper's counter pass.
        click("db-monster-species-row-species-1");
        click("db-monster-species-row-species-2");
      });
      const additions = batches.flat();
      expect(batches).toHaveLength(1);
      expect(additions).toHaveLength(2);
      expect(additions[0]!.isConnected).toBe(false);
      expect(additions[1]).toBe(control("db-monster-species-workspace"));
      expect(getSelectedMonsterSpeciesId()).toBe("species-2");
      expect(control("db-monster-species-row-species-2").getAttribute("aria-pressed")).toBe("true");
    } finally { observer.disconnect(); }
  });

  it("rejects when an async trigger fails after its target renders were observed", async () => {
    openDatabaseModal("monsterSpecies");
    const failure = new Error("Trigger failed after rendering");
    let rejectTrigger!: (reason: Error) => void;
    const triggerCompletion = new Promise<void>((_resolve, reject) => { rejectTrigger = reject; });
    let completion!: Promise<void>;
    // The outer subscription signals actual render delivery independently of
    // the inner trigger's completion, so rejection requires no timing delay.
    await afterSpeciesRenders(2, () => {
      completion = afterSpeciesRenders(2, () => {
        click("db-monster-species-row-species-1");
        click("db-monster-species-row-species-2");
        return triggerCompletion;
      });
      expect(getSelectedMonsterSpeciesId()).toBe("species-2");
    });
    const rejected = expect(completion).rejects.toBe(failure);
    rejectTrigger(failure);
    await rejected;
  });

  it("observes real workspace replacements across garbage collection between tasks", async () => {
    // Obtain an explicit collector without requiring runner/global config changes.
    let collectGarbage: () => void;
    setFlagsFromString("--expose-gc");
    try { collectGarbage = runInNewContext("gc"); }
    finally { setFlagsFromString("--no-expose-gc"); }
    openDatabaseModal("monsterSpecies");
    const before = JSON.stringify(store.getCurrent());
    const update = vi.spyOn(store, "update");
    await afterSpeciesRenders(2, async () => {
      click("db-monster-species-row-species-1");
      const first = control("db-monster-species-workspace");
      // WeakRef targets are kept alive for the current JS job. This is a job
      // boundary for GC, not a delay to wait for a render or interaction grace.
      await setImmediate();
      collectGarbage();
      click("db-monster-species-row-species-2");
      expect(control("db-monster-species-workspace")).not.toBe(first);
    });
    expect(getSelectedMonsterSpeciesId()).toBe("species-2");
    expect(update).not.toHaveBeenCalled();
    expect(JSON.stringify(store.getCurrent())).toBe(before);
  });

  it("retains an edited-enemy navigation reveal through pending refresh without navigation writes", async () => {
    editedEnemy();
    const before = JSON.stringify(store.getCurrent());
    const history = getMapEditHistoryState();
    const update = vi.spyOn(store, "update");
    let immediate: HTMLElement;
    let scrollTop: number;
    await afterSpeciesRenders(2, () => {
      click("db-enemy-open-species");
      expectVisibleSelection(targetId);
      immediate = list(); scrollTop = immediate.scrollTop;
    });
    expect(list()).not.toBe(immediate!);
    expectVisibleSelection(targetId);
    expect(list().scrollTop).toBe(scrollTop!);
    expect(update).not.toHaveBeenCalled();
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    expect(getMapEditHistoryState()).toEqual(history);
  });

  it.each(["add", "duplicate", "create-from-enemy"] as const)("%s retains the new reveal after pending refresh and undoes atomically", async (action) => {
    if (action === "create-from-enemy") {
      store.update((project) => { project.database.enemies[0]!.speciesId = undefined; });
    }
    openSpeciesWithStaleSearch();
    if (action === "create-from-enemy") click("db-tab-enemies");
    const before = structuredClone(store.getCurrent().database);
    resetMapEditHistory();
    const update = vi.spyOn(store, "update");
    let createdId: string;
    await afterSpeciesRenders(2, () => {
      click(action === "create-from-enemy" ? "db-enemy-create-species" : `db-monster-species-${action}`);
      createdId = store.getCurrent().database.monsterSpecies!.at(-1)!.id;
      expectVisibleSelection(createdId);
    });
    expectVisibleSelection(createdId!);
    expect(store.getCurrent().database.monsterSpecies).toHaveLength(102);
    expect(update).toHaveBeenCalledTimes(1);
    if (action === "create-from-enemy") expect(store.getCurrent().database.enemies[0]!.speciesId).toBe(createdId!);
    await afterSpeciesRenders(1, () => { expect(undoMapEdit()).toBe(true); });
    expect(store.getCurrent().database).toEqual(before);
    expect(getMapEditHistoryState().canUndo).toBe(false);
    expectVisibleSelection(before.monsterSpecies![0]!.id);
    const reveals = speciesReveals.length;
    await afterSpeciesRenders(1, () => { click(`db-monster-species-row-${before.monsterSpecies![0]!.id}`); });
    expectVisibleSelection(before.monsterSpecies![0]!.id);
    expect(speciesReveals).toHaveLength(reveals);
  });

  it("respects user scrolling before and after the queued refresh, including zero, until another explicit reveal", async () => {
    editedEnemy();
    await afterSpeciesRenders(2, () => {
      click("db-enemy-open-species");
      expectVisibleSelection(targetId);
      list().scrollTop = 1200;
      list().dispatchEvent(new Event("scroll"));
    });
    expect(list().scrollTop).toBe(1200);
    const reveals = speciesReveals.length;
    list().scrollTop = 0;
    list().dispatchEvent(new Event("scroll"));
    await afterSpeciesRenders(1, () => {
      store.update((project) => { project.database.monsterSpecies![0]!.name = "External rename"; }, { scope: "database", collection: "monsterSpecies" });
    });
    expect(list().scrollTop).toBe(0);
    expect(speciesReveals).toHaveLength(reveals);
    expect(control("db-monster-species-row-species-0").textContent).toContain("External rename");
    click("db-tab-enemies");
    const before = JSON.stringify(store.getCurrent());
    click("db-enemy-open-species");
    expectVisibleSelection(targetId);
    expect(speciesReveals).toHaveLength(reveals + 1);
    expect(JSON.stringify(store.getCurrent())).toBe(before);
  });

  it("keeps search recovery's reveal through a pending edit refresh", async () => {
    openDatabaseModal("monsterSpecies");
    input("db-monster-species-name", "Edited species");
    input("db-monster-species-search", "no-match");
    const before = JSON.stringify(store.getCurrent());
    await afterSpeciesRenders(1, () => {
      click("db-monster-species-reveal-selection");
      expectVisibleSelection(targetId);
      // Recovery deliberately returns focus to search. Leaving the body allows
      // the real modal's pending edit refresh to complete.
      control("database-modal-close").focus();
    });
    expectVisibleSelection(targetId);
    expect(JSON.stringify(store.getCurrent())).toBe(before);
  });

  it("does not carry a closed modal's scroll into a new modal host", () => {
    openDatabaseModal("monsterSpecies");
    list().scrollTop = 1200;
    list().dispatchEvent(new Event("scroll"));
    requestDatabaseModalClose("battleTest");
    openDatabaseModal("monsterSpecies");
    expect(list().scrollTop).toBe(0);
  });
});
