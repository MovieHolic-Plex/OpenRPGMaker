// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderEnemyRecordForm } from "@/editor/panels/databaseEnemyRecordView";
import { openDialog } from "@/editor/panels/databaseEnemyRecordSupport";
import { modalStackDepthForTest, registerModal, resetModalStackForTest } from "@/editor/ui/modalStack";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EnemyRecord } from "@/project/types";

let form: HTMLElement;
let record: EnemyRecord;
let renderCount: number;
const databaseClose = vi.fn();

function control<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.querySelector<T>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing control ${id}`);
  return node;
}
function render(): void {
  const current = store.getCurrent().database.enemies.find((enemy) => enemy.id === record.id);
  if (!current) throw new Error("Missing enemy");
  form.replaceChildren();
  renderEnemyRecordForm(form, current, render);
  renderCount += 1;
}
function key(target: HTMLElement, value: string, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key: value, shiftKey, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}
function openAction(): HTMLElement {
  const row = control("db-enemy-action-row-1");
  row.focus();
  key(row, "Enter");
  return row;
}
function openGraphic(): HTMLElement {
  control("db-enemy-section-appearance-tab").click();
  const opener = control("db-enemy-graphic-set");
  opener.focus();
  opener.click();
  return opener;
}
// Await the exact focus transition; timeout is only a failure bound, never a delay.
function focused(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      document.removeEventListener("focusin", onFocus);
      reject(new Error(`No focus transition to ${id}`));
    }, 2_000);
    const onFocus = (event: FocusEvent): void => {
      if (!(event.target instanceof HTMLElement) || event.target.dataset.testid !== id) return;
      clearTimeout(timeout);
      document.removeEventListener("focusin", onFocus);
      resolve();
    };
    document.addEventListener("focusin", onFocus);
  });
}

beforeEach(() => {
  resetModalStackForTest();
  databaseClose.mockClear();
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
  const project = createBlankProject();
  const enemy = project.database.enemies[0];
  if (!enemy) throw new Error("Missing default enemy");
  record = { ...enemy, id: "dialog-focus-enemy", actions: [10, 90].map((priority) => ({
    skillId: "", priority, condition: { kind: "always" },
    switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false },
  })) };
  project.database.enemies = [record];
  store.replace(project);
  form = document.createElement("section");
  document.body.append(form);
  registerModal(form, databaseClose);
  renderCount = 0;
  render();
});
afterEach(() => {
  document.body.replaceChildren();
  resetModalStackForTest();
});

describe("monster dialog keyboard and live opener lifecycle", () => {
  it.each(["action", "graphic"] as const)("wraps both Tab boundaries in the %s dialog without replacing interior native Tab", (kind) => {
    if (kind === "action") openAction(); else openGraphic();
    const prefix = kind === "action" ? "db-enemy-action" : "db-enemy-graphic-dialog";
    const first = control(kind === "action" ? "db-enemy-action-condition-type" : `${prefix}-search`);
    const last = control(`${prefix}-cancel`);
    first.focus();
    expect(key(first, "Tab", true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
    expect(key(last, "Tab").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    expect(key(first, "Tab").defaultPrevented).toBe(false);
    expect(databaseClose).not.toHaveBeenCalled();
  });

  it("uses the live enabled tab stops and the dialog itself when none remain", () => {
    const hidden = document.createElement("input");
    hidden.hidden = true;
    const disabled = document.createElement("input");
    disabled.disabled = true;
    const skipped = document.createElement("button");
    skipped.tabIndex = -1;
    const first = document.createElement("button");
    openDialog("focus-filter", "Focus", [hidden, disabled, skipped, first], [{ label: "Done", testid: "focus-done" }]);
    expect(document.activeElement).toBe(first);
    const last = control<HTMLButtonElement>("focus-done");
    first.disabled = true;
    last.focus();
    expect(key(last, "Tab", true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
    last.disabled = true;
    const dialog = control("focus-filter").querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) throw new Error("Missing dialog");
    dialog.focus();
    expect(key(dialog, "Tab").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(dialog);
  });

  it("yields focus and keyboard ownership to the nested switch picker, then Escape closes only the top", async () => {
    const opener = openAction();
    control<HTMLInputElement>("db-enemy-action-switch-on-enabled").click();
    const picker = control("db-enemy-action-switch-on-picker");
    picker.focus();
    const searchFocused = focused("event-record-picker-search");
    picker.click();
    await searchFocused;
    const search = control("event-record-picker-search");
    expect(modalStackDepthForTest()).toBe(3);
    expect(key(search, "Tab").defaultPrevented).toBe(false);
    // Even a programmatic key on the covered dialog must not run its trap.
    expect(key(control("db-enemy-action-cancel"), "Tab").defaultPrevented).toBe(false);
    const nestedLast = control("event-record-picker-ok");
    nestedLast.focus();
    expect(key(nestedLast, "Tab").defaultPrevented).toBe(true);
    expect(control("event-record-picker").contains(document.activeElement)).toBe(true);
    key(search, "Escape");
    expect(modalStackDepthForTest()).toBe(2);
    expect(document.activeElement).toBe(picker);
    key(picker, "Escape");
    expect(modalStackDepthForTest()).toBe(1);
    expect(document.activeElement).toBe(opener);
    expect(databaseClose).not.toHaveBeenCalled();
  });

  it.each(["action", "graphic"] as const)("returns to the live %s opener after OK actually rerenders the record", (kind) => {
    const opener = kind === "action" ? openAction() : openGraphic();
    const id = kind === "action" ? "db-enemy-action-row-1" : "db-enemy-graphic-set";
    const prefix = kind === "action" ? "db-enemy-action" : "db-enemy-graphic-dialog";
    if (kind === "action") control<HTMLInputElement>("db-enemy-action-rating").value = "1";
    control(`${prefix}-ok`).click();
    expect(renderCount).toBe(2);
    expect(opener.isConnected).toBe(false);
    expect(document.activeElement).toBe(control(id));
    if (kind === "action") {
      expect(Array.from(form.querySelectorAll<HTMLElement>("[data-action-index]")).map((row) => row.dataset.actionIndex)).toEqual(["0", "1"]);
      expect(store.getCurrent().database.enemies[0]?.actions[1]?.priority).toBe(1);
    }
  });

  it.each(["cancel", "Escape"])("restores a replaced action opener on %s without committing the draft", (exit) => {
    const opener = openAction();
    control<HTMLInputElement>("db-enemy-action-rating").value = "37";
    render();
    if (exit === "cancel") control("db-enemy-action-cancel").click();
    else key(control("db-enemy-action-rating"), "Escape");
    expect(opener.isConnected).toBe(false);
    expect(document.activeElement).toBe(control("db-enemy-action-row-1"));
    expect(store.getCurrent().database.enemies[0]?.actions[1]?.priority).toBe(90);
    expect(databaseClose).not.toHaveBeenCalled();
  });

  it.each(["cancel", "Escape"])("restores the graphic opener on %s", (exit) => {
    openGraphic();
    render();
    if (exit === "cancel") control("db-enemy-graphic-dialog-cancel").click();
    else key(control("db-enemy-graphic-dialog-search"), "Escape");
    expect(document.activeElement).toBe(control("db-enemy-graphic-set"));
    expect(databaseClose).not.toHaveBeenCalled();
  });

  it("falls back to Add action when the opener row has been removed", () => {
    openAction();
    store.getCurrent().database.enemies[0].actions = [];
    render();
    control("db-enemy-action-cancel").click();
    expect(document.activeElement).toBe(control("db-enemy-action-add"));
  });

  it("repairs a subsequent store-driven render without retaining the detached opener", async () => {
    openAction();
    control("db-enemy-action-ok").click();
    const restored = focused("db-enemy-action-row-1");
    render();
    await restored;
    expect(document.activeElement).toBe(control("db-enemy-action-row-1"));
  });

  it("returns from context-menu editing to its original-index row, not the detached menu item", () => {
    const row = control("db-enemy-action-row-1");
    row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    const edit = control("db-enemy-action-context-edit");
    edit.focus();
    edit.click();
    control("db-enemy-action-ok").click();
    expect(edit.isConnected).toBe(false);
    expect(row.isConnected).toBe(false);
    expect(document.activeElement).toBe(control("db-enemy-action-row-1"));
  });

  it.each(["keyboard", "pointer", "focus"])("does not steal focus after intentional %s navigation, even when a later render leaves BODY", async (navigation) => {
    openAction();
    control("db-enemy-action-ok").click();
    if (navigation === "keyboard") key(control("db-enemy-action-row-1"), "Tab");
    if (navigation === "pointer") form.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    if (navigation === "focus") control("db-enemy-action-add").focus();
    const rendered = new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => { observer.disconnect(); resolve(); });
      observer.observe(form, { childList: true });
    });
    render();
    await rendered;
    expect(document.activeElement).toBe(document.body);
  });

  it("does not transfer return focus to another enemy with the same control ids", () => {
    openAction();
    const other = { ...record, id: "another-enemy" };
    store.getCurrent().database.enemies.push(other);
    record = other;
    render();
    control("db-enemy-action-cancel").click();
    expect(document.activeElement).toBe(document.body);
  });
});
