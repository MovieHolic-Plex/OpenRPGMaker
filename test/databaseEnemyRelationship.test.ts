// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderEnemyRecordForm } from "@/editor/panels/databaseEnemyRecordView";
import { getSelectedMonsterSpeciesId, setSelectedMonsterSpeciesId } from "@/editor/panels/databaseMonsterSpeciesView";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import * as modal from "@/editor/ui/modal";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { createBlankProject } from "@/project/defaults";
import { monsterSpeciesForEnemy, normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { store } from "@/project/store";
import type { EnemyRecord } from "@/project/types";

let form: HTMLElement;
const enemyId = "relationship-enemy";
const speciesId = "relationship-species";

function enemy(): EnemyRecord {
  const current = store.getCurrent().database.enemies.find((entry) => entry.id === enemyId);
  if (!current) throw new Error("Missing test enemy");
  return current;
}
function control<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.querySelector<T>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing control ${id}`);
  return node;
}
function render(): void {
  form.replaceChildren();
  renderEnemyRecordForm(form, enemy(), render);
}
function seed(link: "explicit" | "legacy" | "missing" | "absent"): void {
  store.update((project) => {
    const target = project.database.enemies[0];
    if (!target) throw new Error("Missing test enemy");
    target.speciesId = link === "explicit" ? speciesId : link === "missing" ? "missing-species" : undefined;
    project.database.monsterSpecies = [normalizeMonsterSpeciesRecord({
      id: link === "legacy" || link === "missing" ? enemyId : speciesId,
      name: "Linked species fixture",
      graphic: { monsterResourceId: target.monsterResourceId, graphicHue: 0, transparent: false, flying: false },
    })];
  });
  resetMapEditHistory();
}
// Observe the real modal settlement, not a timer or a mocked decision.
function pendingConfirmation(): Promise<boolean> {
  const result = vi.mocked(modal.showConfirm).mock.results.at(-1);
  if (!result || result.type !== "return") throw new Error("Replacement confirmation was not opened");
  return result.value;
}
beforeEach(() => {
  resetModalStackForTest();
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
  const project = createBlankProject();
  const original = project.database.enemies[0];
  if (!original) throw new Error("Missing default enemy");
  project.database.enemies = [{ ...original, id: enemyId, monsterResourceId: "shared-resource", graphicHue: 0, transparent: false, flying: false }];
  project.system.monsterCollection = true;
  store.replace(project);
  seed("explicit");
  setSelectedMonsterSpeciesId(undefined);
  form = document.createElement("section");
  document.body.append(form);
  vi.spyOn(modal, "showConfirm");
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
  resetModalStackForTest();
  resetMapEditHistory();
});

describe("enemy effective species relationship", () => {
  it.each(["explicit", "legacy", "missing", "absent"] as const)("renders %s without writing and opens only a resolved species", (link) => {
    seed(link);
    const before = JSON.stringify(store.getCurrent());
    const update = vi.spyOn(store, "update");
    render();
    const picker = control<HTMLSelectElement>("db-picker-enemy-species");
    expect(picker.value).toBe(enemy().speciesId ?? "");
    expect(picker.selectedOptions).toHaveLength(1);
    const resolved = monsterSpeciesForEnemy(store.getCurrent(), enemy());
    if (resolved) {
      expect(picker.selectedOptions[0]?.textContent).toContain(resolved.name);
      expect(control("db-enemy-hero").textContent).toContain(resolved.name);
      expect(document.querySelector('[data-testid="db-enemy-species-unset-warn"]')).toBeNull();
      control("db-enemy-open-species").click();
      expect(getSelectedMonsterSpeciesId()).toBe(resolved.id);
      expect(control("db-enemy-capture-preview")).toBeTruthy();
    } else {
      expect(document.querySelector('[data-testid="db-enemy-open-species"]')).toBeNull();
      expect(document.querySelector('[data-testid="db-enemy-capture-preview"]')).toBeNull();
      if (link === "missing") {
        expect(picker.selectedOptions[0]?.disabled).toBe(true);
        expect(picker.selectedOptions[0]?.textContent).toContain("missing-species");
        expect(control("db-enemy-species-missing-error")).toBeTruthy();
      } else expect(control("db-enemy-species-unset-warn")).toBeTruthy();
    }
    expect(update).not.toHaveBeenCalled();
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    expect(getMapEditHistoryState().canUndo).toBe(false);
  });
  it("clearing an explicit link reveals same-ID compatibility without storing it", () => {
    seed("legacy");
    store.update((project) => {
      project.database.monsterSpecies?.push(normalizeMonsterSpeciesRecord({ id: speciesId, name: "Explicit fixture" }));
      const target = project.database.enemies[0];
      if (target) target.speciesId = speciesId;
    });
    render();
    const picker = control<HTMLSelectElement>("db-picker-enemy-species");
    picker.value = "";
    picker.dispatchEvent(new Event("change"));
    expect(enemy().speciesId).toBeUndefined();
    control("db-enemy-open-species").click();
    expect(getSelectedMonsterSpeciesId()).toBe(enemyId);
    expect(control<HTMLSelectElement>("db-picker-enemy-species").selectedOptions[0]?.textContent).toContain("Linked species fixture");
  });
  it("open resolves the current link rather than a stale rendered ID", () => {
    render();
    store.update((project) => {
      project.database.monsterSpecies?.push(normalizeMonsterSpeciesRecord({ id: "new-link", name: "New fixture" }));
      const target = project.database.enemies[0];
      if (target) target.speciesId = "new-link";
    });
    control("db-enemy-open-species").click();
    expect(getSelectedMonsterSpeciesId()).toBe("new-link");
  });
});

describe("species replacement decision", () => {
  it.each(["explicit", "legacy"] as const)("cancel leaves the %s database byte-equivalent and adds no undo", async (link) => {
    seed(link);
    render();
    const before = JSON.stringify(store.getCurrent());
    const update = vi.spyOn(store, "update");
    const opener = control("db-enemy-create-species");
    opener.focus();
    opener.click();
    const pending = pendingConfirmation();
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    control("app-modal-cancel").click();
    await pending;
    expect(update).not.toHaveBeenCalled();
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    expect(getMapEditHistoryState().canUndo).toBe(false);
    expect(document.activeElement).toBe(opener);
  });
  it.each(["explicit", "legacy"] as const)("accept replaces %s once, keeps the old species, and undoes both atomically", async (link) => {
    seed(link);
    render();
    const before = structuredClone(store.getCurrent().database);
    const updates: string[] = [];
    const unsubscribe = store.subscribe((project) => { updates.push(JSON.stringify(project.database)); });
    try {
      control("db-enemy-create-species").click();
      const pending = pendingConfirmation();
      const accept = control("app-modal-confirm");
      accept.click();
      accept.click();
      await pending;
      expect(updates).toHaveLength(1);
      const after = store.getCurrent().database;
      expect(after.monsterSpecies).toHaveLength((before.monsterSpecies?.length ?? 0) + 1);
      expect(after.monsterSpecies?.slice(0, -1)).toEqual(before.monsterSpecies);
      const created = after.monsterSpecies?.at(-1);
      expect(created?.id).toBe(enemy().speciesId);
      expect(created?.baseStats).toEqual(enemy().stats);
      expect(created?.name).toBe(enemy().name);
      expect(created?.graphic).toMatchObject({ monsterResourceId: enemy().monsterResourceId, graphicHue: enemy().graphicHue, transparent: enemy().transparent, flying: enemy().flying });
      expect(after.enemies[0]).toEqual({ ...before.enemies[0], speciesId: created?.id });
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().database).toEqual(before);
      expect(getMapEditHistoryState().canUndo).toBe(false);
    } finally { unsubscribe(); }
  });
  it.each(["link", "delete-enemy", "delete-species", "project"] as const)("does not apply stale confirmation after %s changes", async (change) => {
    render();
    control("db-enemy-create-species").click();
    const pending = pendingConfirmation();
    if (change === "project") store.replaceProject(structuredClone(store.getCurrent()));
    else store.update((project) => {
      if (change === "delete-enemy") project.database.enemies = [];
      else if (change === "delete-species") project.database.monsterSpecies = [];
      else {
        const target = project.database.enemies[0];
        if (target) target.speciesId = undefined;
      }
    });
    const before = JSON.stringify(store.getCurrent());
    control("app-modal-confirm").click();
    await pending;
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    expect(getMapEditHistoryState().canUndo).toBe(false);
  });
  it("seeds latest edited values after confirmation without reverting unrelated changes", async () => {
    render();
    control("db-enemy-create-species").click();
    const pending = pendingConfirmation();
    store.update((project) => {
      const target = project.database.enemies[0];
      if (target) { target.name = "Latest fixture"; target.stats.attack = 77; target.graphicHue = 120; }
    });
    const before = structuredClone(store.getCurrent().database);
    control("app-modal-confirm").click();
    await pending;
    const created = store.getCurrent().database.monsterSpecies?.at(-1);
    expect(created?.name).toBe("Latest fixture");
    expect(created?.baseStats.attack).toBe(77);
    expect(created?.graphic.graphicHue).toBe(120);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().database).toEqual(before);
  });
});

describe.each(["explicit", "legacy"] as const)("one-time species appearance copy via %s", (link) => {
  it.each(["monsterResourceId", "graphicHue", "transparent", "flying"] as const)("exposes %s-only differences and changes only the four copy fields", (key) => {
    seed(link);
    store.update((project) => {
      const species = project.database.monsterSpecies?.[0];
      if (!species) throw new Error("Missing species");
      if (key === "monsterResourceId") species.graphic.monsterResourceId = "different-resource";
      else if (key === "graphicHue") species.graphic.graphicHue = 90;
      else species.graphic[key] = true;
    });
    const before = structuredClone(store.getCurrent().database);
    const graphic = before.monsterSpecies?.[0]?.graphic;
    if (!graphic) throw new Error("Missing species graphic");
    render();
    control("db-enemy-species-copy-graphic").click();
    expect(store.getCurrent().database).toEqual({ ...before, enemies: [{ ...before.enemies[0], monsterResourceId: graphic.monsterResourceId, graphicHue: graphic.graphicHue, transparent: graphic.transparent, flying: graphic.flying }] });
    expect(document.querySelector('[data-testid="db-enemy-species-copy-graphic"]')).toBeNull();
  });
});
