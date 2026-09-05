// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { renderEnemyRecordForm } from "@/editor/panels/databaseEnemyRecordView";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EnemyActionPattern, EnemyRecord } from "@/project/types";

let fixtureId = 0;
let record: EnemyRecord;
let form: HTMLElement;
let skills: string[];

function action(skillId: string, priority: number): EnemyActionPattern {
  return { skillId, priority, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } };
}
function live(): EnemyRecord {
  const enemy = store.getCurrent().database.enemies.find((entry) => entry.id === record.id);
  if (!enemy) throw new Error("Missing fixture enemy");
  return enemy;
}
function control(id: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing control ${id}`);
  return node;
}
function picker(): HTMLSelectElement {
  const node = control("db-picker-enemy-action-skill");
  if (!(node instanceof HTMLSelectElement)) throw new Error("Expected skill select");
  return node;
}
function row(index: number): HTMLElement { return control(`db-enemy-action-row-${index}`); }
function changeSkill(value: string): void {
  const select = picker();
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}
// Deliberately retain obsolete props: the store is the authority on every render and edit.
function render(): void {
  form.replaceChildren();
  renderEnemyRecordForm(form, record, render);
}
function selected(index: number): void {
  expect(form.querySelectorAll(".db-enemy-attack-table tr.active")).toHaveLength(1);
  expect(row(index).classList.contains("active")).toBe(true);
  expect(picker().value).toBe(live().actions[index]?.skillId);
}

beforeEach(() => {
  vi.useFakeTimers();
  const project = createBlankProject();
  const enemy = project.database.enemies[0];
  if (!enemy) throw new Error("Missing default enemy");
  skills = project.database.skills.slice(0, 3).map((entry) => entry.id);
  expect(skills).toHaveLength(3);
  fixtureId += 1;
  record = { ...enemy, id: `selection-trust-${fixtureId}`, actions: [action(skills[0], 10), action(skills[1], 90)] };
  project.database.enemies = [record];
  store.replace(project);
  form = document.createElement("section");
  document.body.append(form);
  render();
});
afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("enemy action selection through the real record form and store", () => {
  it("changes original row 1, not row 0, when the first sorted row is clicked", () => {
    const before = structuredClone(live().actions);
    expect(Array.from(form.querySelectorAll("[data-action-index]")).map((node) => node.getAttribute("data-action-index"))).toEqual(["1", "0"]);
    const target = row(1);
    target.click();
    expect(row(1)).toBe(target); // Selection must not destroy the double-click target.
    changeSkill(skills[2]);
    expect(live().actions[1]).toEqual({ ...before[1], skillId: skills[2] });
    expect(live().actions[0]).toEqual(before[0]);
    selected(1);
  });

  it("keeps the skill picker focused after changing the selected action and rerendering", async () => {
    row(1).click();
    const before = structuredClone(live().actions);
    const select = picker();
    select.focus();
    expect(document.activeElement).toBe(select);
    const changed = new Promise<void>((resolve) => {
      select.addEventListener("change", () => queueMicrotask(resolve), { once: true });
    });
    changeSkill(skills[2]);
    await changed;
    vi.advanceTimersToNextFrame();
    expect(picker()).not.toBe(select);
    expect(select.isConnected).toBe(false);
    expect(live().actions).toEqual([before[0], { ...before[1], skillId: skills[2] }]);
    selected(1);
    expect(document.activeElement).toBe(picker());
  }, 30_000);

  it("restores a second same-record replacement after the first successful frame", () => {
    picker().focus();
    changeSkill(skills[2]);
    vi.advanceTimersToNextFrame();
    const firstRestored = picker();
    expect(document.activeElement).toBe(firstRestored);
    // The editor's store subscription can replace the form after the direct render.
    render();
    expect(firstRestored.isConnected).toBe(false);
    expect(document.activeElement).toBe(document.body);
    vi.advanceTimersToNextFrame();
    expect(document.activeElement).toBe(picker());
    for (let frame = 0; frame < 8; frame += 1) vi.advanceTimersToNextFrame();
    expect(document.activeElement).toBe(picker());
  });

  it.each(["keyboard", "pointer", "focus"])("yields to %s navigation and then dialog focus after restoration", (navigation) => {
    picker().focus();
    changeSkill(skills[2]);
    vi.advanceTimersToNextFrame();
    expect(document.activeElement).toBe(picker());
    const add = control("db-enemy-action-add");
    if (navigation === "keyboard") picker().dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    if (navigation === "pointer") add.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    // happy-dom does not perform native Tab/pointer default focus movement.
    add.focus();
    vi.advanceTimersToNextFrame();
    expect(document.activeElement).toBe(add);
    row(1).dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const rating = control("db-enemy-action-rating");
    rating.focus();
    for (let frame = 0; frame < 8; frame += 1) {
      vi.advanceTimersToNextFrame();
      expect(document.activeElement).toBe(rating);
    }
    control("db-enemy-action-cancel").click();
  });

  it("yields to a dialog opened directly after the first successful restoration", () => {
    picker().focus();
    changeSkill(skills[2]);
    vi.advanceTimersToNextFrame();
    expect(document.activeElement).toBe(picker());
    row(1).dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const rating = control("db-enemy-action-rating");
    rating.focus();
    for (let frame = 0; frame < 9; frame += 1) {
      vi.advanceTimersToNextFrame();
      expect(document.activeElement).toBe(rating);
    }
    control("db-enemy-action-cancel").click();
  });

  it.each(["keyboard", "pointer", "focus"])("does not resume after %s navigation leaves focus on BODY", (navigation) => {
    picker().focus();
    changeSkill(skills[2]);
    vi.advanceTimersToNextFrame();
    expect(document.activeElement).toBe(picker());
    if (navigation === "keyboard") picker().dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    if (navigation === "pointer") form.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    if (navigation === "focus") control("db-enemy-action-add").focus();
    render();
    expect(document.activeElement).toBe(document.body);
    for (let frame = 0; frame < 9; frame += 1) {
      vi.advanceTimersToNextFrame();
      expect(document.activeElement).toBe(document.body);
    }
  });

  it("yields to navigation before the first restoration frame", () => {
    picker().focus();
    changeSkill(skills[2]);
    const add = control("db-enemy-action-add");
    add.focus();
    for (let frame = 0; frame < 9; frame += 1) {
      vi.advanceTimersToNextFrame();
      expect(document.activeElement).toBe(add);
    }
  });

  it.each([0, 1])("does not transfer restoration to another record after %s frames", (frames) => {
    const other = { ...record, id: `${record.id}-other` };
    store.update((project) => { project.database.enemies.push(other); });
    picker().focus();
    changeSkill(skills[2]);
    if (frames) {
      vi.advanceTimersToNextFrame();
      expect(document.activeElement).toBe(picker());
    }
    record = other;
    render();
    expect(document.activeElement).toBe(document.body);
    for (let frame = 0; frame < 9; frame += 1) {
      vi.advanceTimersToNextFrame();
      expect(document.activeElement).toBe(document.body);
    }
  });

  it("retargets the skill picker when a row receives keyboard focus", () => {
    row(1).focus();
    selected(1);
    changeSkill(skills[2]);
    expect(live().actions.map((entry) => entry.skillId)).toEqual([skills[0], skills[2]]);
  });

  it.each(["Enter", " "])("selects and opens the live row on %s without a preceding click", (key) => {
    const next = action(skills[2], 73);
    updateDatabaseRecord("enemies", record.id, { actions: [live().actions[0], next] });
    row(1).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    const rating = control("db-enemy-action-rating");
    expect(rating instanceof HTMLInputElement && rating.value).toBe("73");
    control("db-enemy-action-cancel").click();
    selected(1);
  });

  it("selects the context-menu target and opens current rather than captured action data", () => {
    updateDatabaseRecord("enemies", record.id, { actions: [live().actions[0], action(skills[2], 71)] });
    row(1).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    control("db-enemy-action-context-edit").click();
    const rating = control("db-enemy-action-rating");
    expect(rating instanceof HTMLInputElement && rating.value).toBe("71");
    control("db-enemy-action-cancel").click();
    selected(1);
  });

  it("opens live data on double click while preserving the clicked row node", () => {
    const target = row(1);
    target.click();
    updateDatabaseRecord("enemies", record.id, { actions: [live().actions[0], action(skills[2], 69)] });
    target.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const rating = control("db-enemy-action-rating");
    expect(rating instanceof HTMLInputElement && rating.value).toBe("69");
    control("db-enemy-action-cancel").click();
    expect(row(1)).toBe(target);
  });

  it("merges only the skill into the selected live action when props are obsolete", () => {
    row(1).click();
    const current = { ...action(skills[1], 67), condition: { kind: "turn", start: 3, interval: 4 } as const, switchOnAfterAction: { enabled: true, switchId: "switch_1" } };
    updateDatabaseRecord("enemies", record.id, { name: "Live name", actions: [action(skills[2], 12), current] });
    changeSkill(skills[0]);
    expect(live().actions).toEqual([action(skills[2], 12), { ...current, skillId: skills[0] }]);
    expect(live().name).toBe("Live name");
    selected(1);
  });

  it("preserves original-index selection when changed priorities reorder the display", () => {
    row(1).click();
    updateDatabaseRecord("enemies", record.id, { actions: [action(skills[0], 99), action(skills[1], 1)] });
    render();
    expect(Array.from(form.querySelectorAll("[data-action-index]")).map((node) => node.getAttribute("data-action-index"))).toEqual(["0", "1"]);
    selected(1);
  });

  it.each(["add", "duplicate"])("selects the new original-index row after %s with obsolete render props", (operation) => {
    row(1).click();
    const before = structuredClone(live().actions);
    control(`db-enemy-action-${operation}`).click();
    expect(live().actions).toHaveLength(3);
    expect(live().actions.slice(0, 2)).toEqual(before);
    if (operation === "duplicate") expect(live().actions[2]).toEqual(before[1]);
    selected(2);
    changeSkill(skills[2]);
    expect(live().actions[2]?.skillId).toBe(skills[2]);
    expect(live().actions.slice(0, 2)).toEqual(before);
  });

  it("selects the preceding original row after deletion and keeps empty controls disabled", () => {
    row(1).click();
    const first = structuredClone(live().actions[0]);
    control("db-enemy-action-delete").click();
    expect(live().actions).toEqual([first]);
    selected(0);
    control("db-enemy-action-delete").click();
    expect(live().actions).toEqual([]);
    expect(form.querySelectorAll("[data-action-index]")).toHaveLength(0);
    expect(picker().disabled).toBe(true);
    expect(picker().value).toBe("");
    for (const id of ["duplicate", "delete"]) expect(control(`db-enemy-action-${id}`).hasAttribute("disabled")).toBe(true);
    expect(control("db-enemy-action-add").hasAttribute("disabled")).toBe(false);
    control("db-enemy-action-add").click();
    selected(0);
    expect(picker().disabled).toBe(false);
  });

  it("does not recreate removed actions from a still-mounted obsolete picker", () => {
    row(1).click();
    updateDatabaseRecord("enemies", record.id, { actions: [] });
    changeSkill(skills[2]);
    expect(live().actions).toEqual([]);
  });
});
