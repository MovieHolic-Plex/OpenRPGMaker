// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { getDatabaseActiveTab, renderDatabasePanel, setDatabaseActiveTab, switchDatabaseActiveTab } from "@/editor/panels/database";
import { getSelectedMonsterSpeciesId, setSelectedMonsterSpeciesId } from "@/editor/panels/databaseMonsterSpeciesView";
import { resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { searchQueryForCollection, setListScrollTopForCollection, setSearchQueryForCollection, setSelectedRecordId, setViewModeForCollection } from "@/editor/panels/databaseRecordViewSession";
import { createBlankProject } from "@/project/defaults";
import { normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { store } from "@/project/store";

let host: HTMLElement;
const selectedId = "species-selected";
const referrerId = "species-referrer";
const otherId = "species-other";
const enemyId = "enemy-target";

function control<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = host.querySelector<T>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing control ${id}`);
  return node;
}
function rowIds(): string[] {
  return Array.from(host.querySelectorAll<HTMLElement>(".db-ws-list .db-list-row"), (row) => row.dataset.recordId ?? "");
}
// Subscribe before the action. Completion comes from the actual DOM mutation,
// not elapsed debounce time, polling, or a mocked render/navigation function.
async function changedUntil(condition: () => boolean, trigger: () => void): Promise<void> {
  let observer: MutationObserver;
  let timeout: ReturnType<typeof setTimeout>;
  const changed = new Promise<void>((resolve, reject) => {
    observer = new MutationObserver(() => { if (condition()) resolve(); });
    observer.observe(host, { childList: true, subtree: true, attributes: true, characterData: true });
    timeout = setTimeout(() => reject(new Error("Expected DOM state was not reached")), 2000);
    trigger();
    if (condition()) resolve();
  });
  try { await changed; } finally { observer!.disconnect(); clearTimeout(timeout!); }
}
async function search(value: string, expectedIds: string[]): Promise<HTMLInputElement> {
  const input = control<HTMLInputElement>("db-monster-species-search");
  await changedUntil(() => JSON.stringify(rowIds()) === JSON.stringify(expectedIds), () => {
    input.focus(); input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return input;
}
// Revealing an already-mounted row need not mutate the DOM. Subscribe to the
// actual native reveal call, rather than waiting for an incidental row rebuild.
async function revealedByScroll(targetId: string, trigger: () => void, onReveal?: (row: HTMLElement) => void): Promise<void> {
  let timeout: ReturnType<typeof setTimeout>;
  const nativeScroll = HTMLElement.prototype.scrollIntoView;
  const revealed = new Promise<void>((resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(`Target was not revealed: ${targetId}`)), 2000);
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(function (this: HTMLElement, options) {
      nativeScroll.call(this, options);
      if (this.dataset.testid !== targetId) return;
      try { onReveal?.(this); resolve(); } catch (error) { reject(error); }
    });
    trigger();
  });
  try { await revealed; } finally { clearTimeout(timeout!); }
}
function expectSelectedSpecies(id: string): void {
  expect(getSelectedMonsterSpeciesId()).toBe(id);
  expect(control(`db-monster-species-row-${id}`).getAttribute("aria-pressed")).toBe("true");
  expect(control("db-monster-species-hero").querySelector(".db-ws-hero-sub")?.textContent).toBe(id);
  expect(control<HTMLInputElement>("db-monster-species-search").value).toBe("");
}

beforeEach(async () => {
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
  const project = createBlankProject();
  const original = project.database.enemies[0]!;
  project.database.enemies = [{ ...original, id: enemyId, name: "Target enemy", speciesId: selectedId }];
  project.database.monsterSpecies = [
    normalizeMonsterSpeciesRecord({ id: selectedId, name: "Selected", skillsByLevel: [
      { level: 1, skillId: project.database.skills[0]!.id }, { level: 10, skillId: project.database.skills[1]!.id },
    ] }),
    normalizeMonsterSpeciesRecord({ id: otherId, name: "Other" }),
    normalizeMonsterSpeciesRecord({ id: referrerId, name: "Referrer", evolutions: [{ toSpeciesId: selectedId, requires: { level: 20 } }] }),
  ];
  store.replace(project);
  resetMapEditHistory(); resetDatabaseRecordViewSession();
  setViewModeForCollection("enemies", "list");
  setSelectedMonsterSpeciesId(selectedId);
  setDatabaseActiveTab("monsterSpecies");
  host = document.createElement("div"); host.className = "database-modal-body";
  document.body.append(host); renderDatabasePanel(host);
  // Reset the module-local query through its real input, without relying on a new API.
  const input = control<HTMLInputElement>("db-monster-species-search");
  if (input.value) await search("", [selectedId, otherId, referrerId]);
});
afterEach(() => {
  vi.restoreAllMocks(); host.remove(); resetDatabaseRecordViewSession(); resetMapEditHistory();
});

describe("species search editing context", () => {
  it("retains the mounted search, caret, inspector, scroll and local preview while filtering", async () => {
    const inspector = control("db-detail-form");
    const body = inspector.querySelector<HTMLElement>(".db-ws-detail-body")!;
    const name = control<HTMLInputElement>("db-monster-species-name");
    name.value = "uncommitted DOM draft";
    body.scrollTop = 120;
    const level = control<HTMLInputElement>("db-monster-species-preview-level");
    level.value = "37"; level.dispatchEvent(new Event("input", { bubbles: true }));
    const preview = control("db-monster-species-stats-preview").textContent;
    const before = JSON.stringify(store.getCurrent());
    const input = await search("Other", [otherId]);
    expect(control("db-monster-species-search")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(control("db-detail-form")).toBe(inspector);
    expect(name.value).toBe("uncommitted DOM draft");
    expect(body.scrollTop).toBe(120);
    expect(control<HTMLInputElement>("db-monster-species-preview-level").value).toBe("37");
    expect(control("db-monster-species-stats-preview").textContent).toBe(preview);
    expect(input.selectionStart).toBe("Other".length);
    expect(getSelectedMonsterSpeciesId()).toBe(selectedId);
    expect(JSON.stringify(store.getCurrent())).toBe(before);
  });

  it.each(["Other", "no-match"])("exposes hidden selection and recovers from %s without replacing the inspector", async (query) => {
    await search(query, query === "Other" ? [otherId] : []);
    const inspector = control("db-detail-form");
    const before = JSON.stringify(store.getCurrent());
    const notice = control("db-monster-species-selection-notice");
    expect(notice.hidden).toBe(false);
    expect(notice.dataset.recordId).toBe(selectedId);
    expect(control("db-ws-count").textContent).toBe(query === "Other" ? "1/3개" : "0/3개");
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    control(query === "Other" ? "db-monster-species-reveal-selection" : "db-monster-species-empty-clear").click();
    expectSelectedSpecies(selectedId);
    expect(control("db-detail-form")).toBe(inspector);
    expect(control("db-monster-species-selection-notice").hidden).toBe(true);
    expect(control("db-ws-count").textContent).toBe("3개");
    expect(scroll.mock.contexts).toContain(control(`db-monster-species-row-${selectedId}`));
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    expect(getMapEditHistoryState().canUndo).toBe(false);
  });

  it("keeps skill row draft identity after normalization reorders the saved skills", async () => {
    const first = control<HTMLInputElement>("db-monster-species-skill-level-0");
    first.value = "20"; first.dispatchEvent(new Event("input", { bubbles: true }));
    await search("no-match", []);
    const skill = control<HTMLSelectElement>("db-monster-species-skill-0");
    skill.value = store.getCurrent().database.skills[2]!.id;
    skill.dispatchEvent(new Event("change", { bubbles: true }));
    expect(store.getCurrent().database.monsterSpecies?.[0]?.skillsByLevel).toEqual([
      { level: 10, skillId: store.getCurrent().database.skills[1]!.id },
      { level: 20, skillId: store.getCurrent().database.skills[2]!.id },
    ]);
  });

  it.each(["add", "duplicate"])("%s reveals the new selected row under a stale search and keeps atomic undo", async (action) => {
    await search("no-match", []);
    const before = structuredClone(store.getCurrent().database.monsterSpecies);
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    control(`db-monster-species-${action}`).click();
    const created = store.getCurrent().database.monsterSpecies!.at(-1)!;
    expectSelectedSpecies(created.id);
    expect(scroll.mock.contexts).toContain(control(`db-monster-species-row-${created.id}`));
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().database.monsterSpecies).toEqual(before);
    expect(getMapEditHistoryState().canUndo).toBe(false);
  });
});

describe("related record reveal through the real database panel", () => {
  it("enemy-to-species clears a cached target search and does not write project data", async () => {
    await search("Other", [otherId]);
    switchDatabaseActiveTab("enemies", host);
    const before = JSON.stringify(store.getCurrent());
    const update = vi.spyOn(store, "update");
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    control("db-enemy-open-species").click();
    expect(getDatabaseActiveTab()).toBe("monsterSpecies");
    expectSelectedSpecies(selectedId);
    expect(scroll.mock.contexts).toContain(control(`db-monster-species-row-${selectedId}`));
    expect(update).not.toHaveBeenCalled();
    expect(JSON.stringify(store.getCurrent())).toBe(before);
  });

  it.each(["list", "gallery"] as const)("species-to-enemy reveals an off-window %s target despite stale search and scroll", async (mode) => {
    store.update((project) => {
      const target = project.database.enemies[0]!;
      project.database.enemies = [...Array.from({ length: 100 }, (_, index) => ({ ...target, id: `filler-${index}`, speciesId: undefined })), target];
    });
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) { return this.classList.contains("db-list") ? 96 : 0; });
    setViewModeForCollection("enemies", mode);
    setSearchQueryForCollection("enemies", "stale-no-match");
    setListScrollTopForCollection("enemies", 9000);
    setSelectedRecordId("enemies", "filler-0");
    const before = JSON.stringify(store.getCurrent());
    const update = vi.spyOn(store, "update");
    const targetId = `db-record-${mode === "list" ? "row" : "card"}-${enemyId}`;
    await revealedByScroll(targetId, () => {
      control(`db-monster-species-open-enemy-${enemyId}`).click();
    });
    expect(getDatabaseActiveTab()).toBe("enemies");
    expect(searchQueryForCollection("enemies")).toBe("");
    expect(control(targetId).getAttribute("aria-pressed")).toBe("true");
    expect(control<HTMLInputElement>("db-field-name").value).toBe("Target enemy");
    expect(update).not.toHaveBeenCalled();
    expect(JSON.stringify(store.getCurrent())).toBe(before);
  });

  it.each(["list", "gallery"] as const)("keeps the %s destination visible after native reveal triggers a scroll render", async (mode) => {
    store.update((project) => {
      const target = project.database.enemies[0]!;
      project.database.enemies = [...Array.from({ length: 100 }, (_, index) => ({ ...target, id: `filler-${index}`, speciesId: undefined })), target];
    });
    setViewModeForCollection("enemies", mode);
    setSearchQueryForCollection("enemies", "stale-no-match");
    const viewportHeight = 440;
    // happy-dom has no layout: supply border-box measurements and the inner
    // grid's CSS gap/padding, keeping real window/spacer/reveal/scroll code.
    const rowHeight = mode === "list" ? 40 : 103.7;
    const gap = mode === "list" ? 2 : 8;
    const padding = mode === "list" ? 0 : 10;
    const columns = mode === "list" ? 1 : 3;
    const nativeRect = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("db-list-row") || this.classList.contains("db-gallery-card")) {
        return new DOMRect(0, 0, 194 / columns, rowHeight);
      }
      return nativeRect.call(this);
    });
    const nativeStyle = globalThis.getComputedStyle;
    vi.spyOn(globalThis, "getComputedStyle").mockImplementation((node) => {
      if (node.classList.contains("db-virtual-rows")) {
        (node as HTMLElement).style.rowGap = `${gap}px`;
        (node as HTMLElement).style.padding = `${padding}px 0`;
      }
      return nativeStyle(node);
    });
    const targetId = `db-record-${mode === "list" ? "row" : "card"}-${enemyId}`;
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("db-list") ? viewportHeight : 0;
    });
    const bottomInList = (row: HTMLElement, list: HTMLElement): number => {
      const rows = Array.from(list.querySelector(".db-virtual-rows")!.children);
      const spacer = list.querySelector<HTMLElement>(".db-virtual-spacer-top")!;
      return Number.parseFloat(spacer.style.height) + padding + Math.floor(rows.indexOf(row) / columns) * (rowHeight + gap) + rowHeight;
    };
    const before = JSON.stringify(store.getCurrent());
    const update = vi.spyOn(store, "update");
    await revealedByScroll(targetId, () => {
      control(`db-monster-species-open-enemy-${enemyId}`).click();
    }, (row) => {
      const list = row.closest<HTMLElement>(".db-list")!;
      list.scrollTop = Math.max(0, bottomInList(row, list) - viewportHeight);
      list.dispatchEvent(new Event("scroll"));
    });
    const target = control(targetId);
    const list = target.closest<HTMLElement>(".db-list")!;
    const bottom = bottomInList(target, list) - list.scrollTop;
    expect(bottom).toBeLessThanOrEqual(viewportHeight + 0.001);
    expect(bottom - rowHeight).toBeGreaterThanOrEqual(0);
    expect(list.querySelector(".db-virtual-rows")!.children.length).toBeLessThan(101);
    expect(target.getAttribute("aria-pressed")).toBe("true");
    expect(control<HTMLInputElement>("db-field-name").value).toBe("Target enemy");
    expect(searchQueryForCollection("enemies")).toBe("");
    expect(update).not.toHaveBeenCalled();
    expect(JSON.stringify(store.getCurrent())).toBe(before);
  });

  it("evolution referrer renders and reveals immediately without an external refresh or write", async () => {
    await search("Selected", [selectedId]);
    const before = JSON.stringify(store.getCurrent());
    const update = vi.spyOn(store, "update");
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    control(`db-monster-species-open-referrer-${referrerId}`).click();
    expectSelectedSpecies(referrerId);
    expect(control<HTMLInputElement>("db-monster-species-name").value).toBe("Referrer");
    expect(scroll.mock.contexts).toContain(control(`db-monster-species-row-${referrerId}`));
    expect(update).not.toHaveBeenCalled();
    expect(JSON.stringify(store.getCurrent())).toBe(before);
  });

  it("creation from an unlinked enemy reveals its new species despite a stale target query", async () => {
    await search("Other", [otherId]);
    store.update((project) => { project.database.enemies[0]!.speciesId = undefined; });
    resetMapEditHistory();
    switchDatabaseActiveTab("enemies", host);
    const before = structuredClone(store.getCurrent().database);
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    control("db-enemy-create-species").click();
    const created = store.getCurrent().database.monsterSpecies!.at(-1)!;
    expectSelectedSpecies(created.id);
    expect(scroll.mock.contexts).toContain(control(`db-monster-species-row-${created.id}`));
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().database).toEqual(before);
    expect(getMapEditHistoryState().canUndo).toBe(false);
  });
});
