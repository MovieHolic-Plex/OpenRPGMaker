import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderTroopBattleEventPanel } from "@/editor/panels/databaseTroopBattleEventPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom, findByTestId, type FakeElement } from "./fakeDom";
let cleanup: () => void;
let oldWindow: typeof window;
beforeEach(() => {
  cleanup = installFakeDom(); oldWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", { configurable: true, value: { setTimeout: () => 0, clearTimeout } });
  const project = createBlankProject();
  project.database.troops[0]!.battleEventPages = [];
  store.replace(project);
});
afterEach(() => {
  cleanup();
  if (oldWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else Object.defineProperty(globalThis, "window", { configurable: true, value: oldWindow });
});
const troop = () => store.getCurrent().database.troops[0]!;
function render() {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = () => { host.replaceChildren(renderTroopBattleEventPanel(troop(), rerender) as unknown as FakeElement); };
  rerender(); return host;
}
function change(host: FakeElement, id: string, value: string) {
  const control = findByTestId(host, id)!;
  expect(control, id).toBeTruthy();
  control.value = value; control.dispatchEvent(new Event("change"));
}
describe("troop event editor", () => {
  it("adds unique page IDs after deleting a middle page and preserves explicit runOnce=false", () => {
    const host = render();
    const add = () => findByTestId(host, "db-troop-event-add-page")!.click();
    add(); add(); add();
    const kept = [troop().battleEventPages[0]!.id, troop().battleEventPages[2]!.id];
    findByTestId(host, "db-troop-event-page-tab-2")!.click();
    findByTestId(host, "db-troop-event-delete-page")!.click();
    add();
    const ids = troop().battleEventPages.map((p) => p.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids.slice(0, 2)).toEqual(kept);
    const once = findByTestId(host, "db-field-troop-event-run-once")!;
    once.checked = false; once.dispatchEvent(new Event("change"));
    expect(troop().battleEventPages[2]!.runOnce).toBe(false);
    expect(findByTestId(host, "db-field-troop-event-run-once")!.checked).toBe(false);
  });
  it("edits switch polarity and variable operators without dropping additional conditions", () => {
    store.update((project) => {
      project.switches = [{ id: "actual_switch", name: "Gate" }];
      project.variables = [{ id: "actual_variable", name: "Score" }];
      project.database.troops[0]!.battleEventPages = [{ id: "condition-test", conditions: [{ kind: "switch", switchId: "actual_switch", value: true }, { kind: "onRound", round: 2 }], span: "turn", commands: [] }];
    });
    const host = render();
    change(host, "db-field-troop-event-condition-switch-value", "false");
    expect(troop().battleEventPages[0]!.conditions[0]).toEqual({ kind: "switch", switchId: "actual_switch", value: false });
    change(host, "db-field-troop-event-condition-kind", "variable");
    change(host, "db-field-troop-event-condition-variable-op", "<=");
    expect(troop().battleEventPages[0]!.conditions).toEqual([{ kind: "variable", variableId: "actual_variable", op: "<=", value: 0 }, { kind: "onRound", round: 2 }]);
  });
  it("keeps both displayed HP limits consistent with the saved range", () => {
    const host = render();
    findByTestId(host, "db-troop-event-add-page")!.click();
    change(host, "db-field-troop-event-condition-kind", "enemyHp");
    const setNumber = (suffix: string, value: string) => {
      const input = findByTestId(host, `db-field-troop-event-condition-enemy-hp-${suffix}`)!;
      input.value = value; input.dispatchEvent(new Event("input"));
    };
    setNumber("max", "30");
    setNumber("min", "60");
    expect(findByTestId(host, "db-field-troop-event-condition-enemy-hp-max")!.value).toBe("60");
    setNumber("max", "20");
    expect(findByTestId(host, "db-field-troop-event-condition-enemy-hp-min")!.value).toBe("20");
    expect(troop().battleEventPages[0]!.conditions[0]).toMatchObject({ minPercent: 20, maxPercent: 20 });
    setNumber("min", "100");
    expect(findByTestId(host, "db-field-troop-event-condition-enemy-hp-max-inc")!.disabled).toBe(true);
    setNumber("max", "90");
    const minIncrement = findByTestId(host, "db-field-troop-event-condition-enemy-hp-min-inc")!;
    expect(minIncrement.disabled).toBe(false);
    minIncrement.click();
    expect(troop().battleEventPages[0]!.conditions[0]).toMatchObject({ minPercent: 91, maxPercent: 91 });
  });

});
