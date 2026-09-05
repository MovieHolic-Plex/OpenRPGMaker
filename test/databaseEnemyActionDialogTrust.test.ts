// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openActionDialog } from "@/editor/panels/databaseEnemyActionDialog";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EnemyActionPattern } from "@/project/types";

const action = (): EnemyActionPattern => ({
  skillId: "", priority: 50, condition: { kind: "always" },
  switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false },
});
const rerender = vi.fn();

beforeEach(() => {
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
  store.replace(createBlankProject());
  rerender.mockClear();
});
afterEach(() => {
  document.querySelector<HTMLButtonElement>('[data-testid="db-enemy-action-cancel"]')?.click();
  document.body.replaceChildren();
});
function field<T extends HTMLElement>(suffix: string): T {
  const node = document.querySelector<T>(`[data-testid="db-enemy-action-${suffix}"]`);
  if (!node) throw new Error(`Missing action field: ${suffix}`);
  return node;
}
function enemy() {
  const record = store.getCurrent().database.enemies[0];
  if (!record) throw new Error("Missing enemy");
  return record;
}
function open(draft = action()): void {
  enemy().actions = [draft];
  openActionDialog(enemy(), 0, draft, rerender);
}
function change(suffix: string, value: string): void {
  const input = field<HTMLInputElement | HTMLSelectElement>(suffix);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("enemy action dialog input trust through the real store", () => {
  it("disables inactive turn fields and retains their raw draft across condition changes", () => {
    open();
    expect(field<HTMLInputElement>("turn-start").disabled).toBe(true);
    expect(field<HTMLInputElement>("turn-interval").disabled).toBe(true);
    change("condition-type", "turn");
    change("turn-start", "27");
    change("turn-interval", "");
    change("condition-type", "always");
    expect(field<HTMLInputElement>("turn-start").disabled).toBe(true);
    change("condition-type", "turn");
    expect(field<HTMLInputElement>("turn-start").value).toBe("27");
    expect(field<HTMLInputElement>("turn-interval").value).toBe("");
    expect(field<HTMLInputElement>("turn-interval").disabled).toBe(false);
    change("condition-type", "always");
    field<HTMLButtonElement>("ok").click();
    expect(enemy().actions[0]?.condition).toEqual({ kind: "always" });
    expect(rerender).toHaveBeenCalledOnce();
  });
  for (const [suffix, max] of [["rating", 100], ["turn-start", 999], ["turn-interval", 999]] as const) {
    it.each(["", "0", "-1", "1.5", String(max + 1), "1e309"])(`rejects ${suffix}=%s without changing or closing the record`, (value) => {
      open({ ...action(), condition: { kind: "turn", start: 7, interval: 3 } });
      const before = structuredClone(enemy());
      change(suffix, value);
      const input = field<HTMLInputElement>(suffix);
      const visible = input.value;
      field<HTMLButtonElement>("ok").click();
      expect(enemy()).toEqual(before);
      expect(rerender).not.toHaveBeenCalled();
      expect(field("dialog").isConnected).toBe(true);
      expect(document.activeElement).toBe(input);
      expect(input.value).toBe(visible);
      expect(input.getAttribute("aria-invalid")).toBe("true");
      const message = document.getElementById(input.getAttribute("aria-describedby") ?? "");
      expect(message?.hidden).toBe(false);
      expect(message?.textContent?.length).toBeGreaterThan(0);
      change(suffix, String(max));
      expect(input.getAttribute("aria-invalid")).not.toBe("true");
      field<HTMLButtonElement>("ok").click();
      expect(rerender).toHaveBeenCalledOnce();
    });
  }
  it.each([1, 100])("commits only the visible validated integers at priority %s", (priority) => {
    open();
    change("condition-type", "turn");
    change("rating", String(priority));
    change("turn-start", "999");
    change("turn-interval", "1");
    const visible = {
      priority: field<HTMLInputElement>("rating").valueAsNumber,
      condition: { kind: "turn", start: field<HTMLInputElement>("turn-start").valueAsNumber, interval: field<HTMLInputElement>("turn-interval").valueAsNumber },
    };
    field<HTMLButtonElement>("ok").click();
    expect(enemy().actions[0]).toMatchObject(visible);
    expect(rerender).toHaveBeenCalledOnce();
  });
  it("keeps radio and skill DOM focus and remembers the selected skill through basic mode", () => {
    open();
    const radio = field<HTMLInputElement>("mode-skill");
    radio.focus();
    radio.click();
    expect(document.activeElement).toBe(radio);
    const select = field<HTMLSelectElement>("dialog-skill");
    const skill = store.getCurrent().database.skills[1];
    if (!skill) throw new Error("Missing second skill");
    select.focus();
    change("dialog-skill", skill.id);
    expect(document.activeElement).toBe(select);
    const basic = field<HTMLInputElement>("mode-basic");
    basic.focus();
    basic.click();
    expect(document.activeElement).toBe(basic);
    expect(select.disabled).toBe(true);
    expect(select.value).toBe(skill.id);
    radio.focus();
    radio.click();
    expect(document.activeElement).toBe(radio);
    expect(select.disabled).toBe(false);
    expect(select.value).toBe(skill.id);
    field<HTMLButtonElement>("ok").click();
    expect(enemy().actions[0]?.skillId).toBe(skill.id);
  });
  it("cancels all draft changes without touching the record", () => {
    open();
    const before = structuredClone(enemy());
    change("rating", "86");
    change("condition-type", "turn");
    change("turn-start", "18");
    field<HTMLInputElement>("mode-skill").click();
    field<HTMLInputElement>("switch-on-enabled").click();
    field<HTMLButtonElement>("cancel").click();
    expect(enemy()).toEqual(before);
    expect(rerender).not.toHaveBeenCalled();
  });
  it("names switch controls, disables unused selectors, and preserves draft selection", () => {
    open();
    for (const direction of ["on", "off"]) {
      const checkbox = field<HTMLInputElement>(`switch-${direction}-enabled`);
      const select = field<HTMLSelectElement>(`switch-${direction}-id`);
      const picker = field<HTMLButtonElement>(`switch-${direction}-picker`);
      expect(checkbox.getAttribute("aria-label")).toBeTruthy();
      expect(select.getAttribute("aria-label")).toBeTruthy();
      expect(picker.getAttribute("aria-label")).toBeTruthy();
      expect(select.disabled).toBe(true);
      expect(picker.disabled).toBe(true);
      checkbox.click();
      expect(select.disabled).toBe(false);
      expect(picker.disabled).toBe(false);
      const choice = store.getCurrent().switches[1];
      if (!choice) throw new Error("Missing second switch");
      change(`switch-${direction}-id`, choice.id);
      checkbox.click();
      expect(select.disabled).toBe(true);
      checkbox.click();
      expect(select.value).toBe(choice.id);
    }
    field<HTMLButtonElement>("ok").click();
    expect(enemy().actions[0]?.switchOnAfterAction).toEqual({ enabled: true, switchId: store.getCurrent().switches[1]?.id });
  });
  it("disables switch controls when there are no switches", () => {
    store.getCurrent().switches = [];
    open();
    for (const direction of ["on", "off"]) {
      for (const suffix of ["enabled", "id", "picker"]) {
        expect(field<HTMLInputElement>(`switch-${direction}-${suffix}`).disabled).toBe(true);
      }
    }
  });
});
