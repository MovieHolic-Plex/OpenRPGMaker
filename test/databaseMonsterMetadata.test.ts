// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { getMapEditHistoryMarker, redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { listMonsterResources, getMonsterResource } from "@/assets/monsterResourceCatalog";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

function control<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.querySelector<T>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing control ${id}`);
  return node;
}
function input(id: string, value: string): HTMLInputElement {
  const node = control<HTMLInputElement>(`db-monster-resource-${id}`);
  node.value = value;
  node.dispatchEvent(new Event("input", { bubbles: true }));
  return node;
}
function open(): void {
  const host = document.createElement("div");
  document.body.append(host);
  renderDatabasePanel(host);
  control("db-monster-resources-open").click();
}
function selectedId(): string { return control("db-monster-resource-id").textContent ?? ""; }
async function changed(condition: () => boolean, action: () => void): Promise<void> {
  const observers: MutationObserver[] = [];
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      const observer = new MutationObserver(() => { if (condition()) resolve(); });
      observers.push(observer);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
      timeout = setTimeout(() => reject(new Error("Expected DOM transition did not occur")), 3000);
      action();
      if (condition()) resolve();
    });
  } finally { observers.forEach(observer => observer.disconnect()); clearTimeout(timeout); }
}

beforeEach(() => {
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
  const project = createBlankProject();
  project.database.enemies = [];
  store.replace(project);
  resetMapEditHistory();
  resetDatabaseRecordViewSession();
  setDatabaseActiveTab("enemies");
});
afterEach(async () => {
  const close = document.querySelector<HTMLButtonElement>('[data-testid="db-monster-resource-close"]');
  if (close) {
    close.click();
    const confirm = document.querySelector<HTMLButtonElement>('[data-testid="app-modal-confirm"]');
    if (confirm) await changed(() => !document.querySelector('[data-testid="db-monster-resources"]'), () => confirm.click());
  }
  document.body.replaceChildren();
  resetMapEditHistory();
});

describe("monster metadata through the database", () => {
  it("opens editable resource controls when the enemy collection is empty", () => {
    // Given the real database renderer with zero gameplay enemies.
    const host = document.createElement("div");
    document.body.append(host); renderDatabasePanel(host);
    // When the author opens the resource catalog.
    const entry = host.querySelector<HTMLButtonElement>('[data-testid="db-monster-resources-open"]');
    expect(entry).not.toBeNull(); entry?.click();
    // Then the complete catalog and editable metadata exist independently of enemies.
    expect(document.querySelectorAll('[data-testid="db-monster-resource-row"]')).toHaveLength(listMonsterResources(store.getCurrent()).length);
    expect(control("db-monster-resource-name")).toBeInstanceOf(HTMLInputElement);
    expect(control("db-monster-resource-apply")).toBeInstanceOf(HTMLButtonElement);
  });

  it("commits all edited fields atomically when Apply is clicked", () => {
    // Given a staged draft and untouched project/history.
    open(); const id = selectedId(); const before = structuredClone(store.getCurrent());
    input("name", "  Edited artwork  "); input("tags", "goblin\ngreen\ngoblin"); input("description", "  Shield-bearing goblin.  ");
    expect(store.getCurrent()).toEqual(before);
    // When Apply is clicked.
    control("db-monster-resource-apply").click();
    // Then normalized metadata is a single undoable change, not an enemy record.
    expect(store.getCurrent().monsterMetadata?.[id]).toEqual({ name: "Edited artwork", tags: ["goblin", "green"], description: "Shield-bearing goblin." });
    expect(store.getCurrent().database.enemies).toEqual([]);
    expect(getMapEditHistoryMarker()).toBe(1);
  });

  it("refreshes clean controls when the metadata edit is undone and redone", () => {
    // Given one applied edit.
    open(); const id = selectedId(); const original = getMonsterResource(store.getCurrent(), id)?.name;
    input("name", "Undo artwork"); control("db-monster-resource-apply").click();
    // When the shared history is undone and redone.
    undoMapEdit();
    expect(control<HTMLInputElement>("db-monster-resource-name").value).toBe(original);
    redoMapEdit();
    // Then clean controls display the restored authored value.
    expect(control<HTMLInputElement>("db-monster-resource-name").value).toBe("Undo artwork");
  });

  it("restores inherited values when reset is clicked", () => {
    // Given an applied override.
    open(); const id = selectedId(); const original = getMonsterResource(store.getCurrent(), id)?.name;
    input("name", "Override"); control("db-monster-resource-apply").click();
    // When the user resets this resource.
    control("db-monster-resource-reset").click();
    // Then only this resource override is removed and the fallback is visible.
    expect(store.getCurrent().monsterMetadata?.[id]).toBeUndefined();
    expect(control<HTMLInputElement>("db-monster-resource-name").value).toBe(original);
  });

  it("preserves mounted dirty controls when search hides the selected artwork", () => {
    // Given an edited resource.
    open(); const id = selectedId(); const name = input("name", "Draft to retain");
    // When a no-results search is entered.
    input("search", "no-such-monster-49309309");
    // Then filtering does not navigate or lose the draft.
    expect(document.querySelectorAll('[data-testid="db-monster-resource-row"]')).toHaveLength(0);
    expect(selectedId()).toBe(id); expect(control("db-monster-resource-name")).toBe(name);
    expect(name.value).toBe("Draft to retain");
  });

  it("keeps draft and selection when dirty navigation is cancelled", async () => {
    // Given a dirty first resource and a second row.
    open(); const id = selectedId(); const name = input("name", "Retained draft");
    const other = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-testid="db-monster-resource-row"]')).find(row => row.dataset.resourceId !== id);
    if (!other) throw new Error("Expected multiple catalog resources");
    // When navigation is requested and cancelled.
    other.click();
    await changed(() => !document.querySelector('[data-testid="app-modal-cancel"]'), () => control("app-modal-cancel").click());
    // Then both selection and input node survive.
    expect(selectedId()).toBe(id); expect(control("db-monster-resource-name")).toBe(name);
    expect(name.value).toBe("Retained draft");
  });

  it("keeps dirty fields and merges unrelated metadata when the store refreshes", () => {
    // Given a local name edit.
    open(); const id = selectedId(); const name = input("name", "Local name");
    // When another editor changes description before this draft is applied.
    store.update(project => { project.monsterMetadata = { [id]: { description: "External description" } }; }, { scope: "assets", label: "External metadata edit" });
    control("db-monster-resource-apply").click();
    // Then the untouched external description survives the local name patch.
    expect(control("db-monster-resource-name")).toBe(name);
    expect(store.getCurrent().monsterMetadata?.[id]).toEqual({ name: "Local name", description: "External description" });
  });

  it("retains Escape ownership when a dirty close is cancelled repeatedly", async () => {
    // Given a dirty modal with its own modalStack layer.
    open(); const name = input("name", "Keep this draft");
    // When Escape-close is cancelled twice.
    for (const attempt of [1, 2]) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(control("app-modal-cancel"), `close prompt ${attempt}`).toBeInstanceOf(HTMLButtonElement);
      await changed(() => !document.querySelector('[data-testid="app-modal-cancel"]'), () => control("app-modal-cancel").click());
    }
    // Then the editor and original draft remain mounted.
    expect(control("db-monster-resource-name")).toBe(name); expect(name.value).toBe("Keep this draft");
  });

  it("moves list focus without changing selection when an arrow key is pressed", () => {
    // Given the real catalog's single roving tab stop.
    open(); const id = selectedId();
    const rows = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-testid="db-monster-resource-row"]'));
    const first = rows[0]; const second = rows[1];
    if (!first || !second) throw new Error("Expected multiple catalog resources");
    expect(rows.filter(row => row.tabIndex === 0)).toHaveLength(1); first.focus();
    // When ArrowDown moves focus within the catalog.
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    // Then focus moves but no draft/selection or history is changed.
    expect(document.activeElement).toBe(second); expect(selectedId()).toBe(id);
    expect(getMapEditHistoryMarker()).toBe(0);
  });

  it("blocks invalid metadata when Apply is clicked", () => {
    // Given a blank name draft.
    open(); const before = structuredClone(store.getCurrent()); input("name", "   ");
    // When Apply is clicked.
    control("db-monster-resource-apply").click();
    // Then no store/history write occurs and an accessible error is visible.
    expect(store.getCurrent()).toEqual(before); expect(getMapEditHistoryMarker()).toBe(0);
    expect(control("db-monster-resource-status").getAttribute("role")).toBe("alert");
  });

  it("revokes stale writes while retaining draft text when the project is replaced", () => {
    // Given a dirty form and captured callback target.
    open(); const name = input("name", "Old project draft"); const apply = control("db-monster-resource-apply");
    const replacement = createBlankProject();
    // When a real project replacement occurs and an old callback is dispatched.
    store.replaceProject(replacement); apply.dispatchEvent(new Event("click"));
    // Then new project metadata is unchanged and the old draft remains copyable.
    expect(store.getCurrent().monsterMetadata).toBeUndefined();
    expect(name.value).toBe("Old project draft"); expect(apply.hasAttribute("disabled")).toBe(true);
  });
});
