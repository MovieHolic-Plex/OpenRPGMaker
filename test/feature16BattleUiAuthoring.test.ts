import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { troopAuthoringPreview } from "@/battle/battleAuthoringPreview";
import { troopIntentPanel } from "@/editor/panels/databaseTroopIntentPanel";
import type { EnemyActionCondition } from "@/project/types";
import { store } from "@/project/store";
import { deserialize, serialize } from "@/project/io";
import { installFakeDom, findByTestId, type FakeElement } from "./fakeDom";
import fixture from "./fixtures/projects/battle-v3.json";

function setup() {
  const project = deserialize(JSON.stringify(fixture));
  project.switches.push({ id: "sw_keep", name: "행동 후 스위치" });
  const troop = project.database.troops.find(t => t.id === "troop_slime")!;
  const enemy = project.database.enemies.find(e => e.id === "enemy_slime")!;
  const skill = project.database.skills[0]!;
  skill.mpCost = { flat: 5, percentMax: 0 };
  enemy.stats.maxMp = 10;
  enemy.actions = [{ skillId: skill.id, priority: 42, condition: { kind: "turn", start: 2, interval: 2 }, switchOnAfterAction: { enabled: true, switchId: "sw_keep" }, switchOffAfterAction: { enabled: false } }];
  project.database.elements = [{ id: "authored", name: "불", kind: "physical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 50, B: 200, C: 100, D: 0, E: -100 } }];
  enemy.elementRates = { authored: "A" };
  return { project, troop, enemy };
}
const input = { memberIndex: 0, actorId: "actor_hero", turn: 1, mpPercent: 100, row: "front" as const };
describe("feature16 troop authoring what-if", () => {
  it("uses authored turns, MP rules and actual multipliers without mutating project", () => {
    const { project, troop } = setup();
    const before = JSON.stringify(project);
    expect(troopAuthoringPreview(project, troop, input)!.actions[0]!.reason).toBe("턴 조건 불일치");
    expect(troopAuthoringPreview(project, troop, { ...input, turn: 2, mpPercent: 0 })!.actions[0]!.reason).toContain("MP 부족");
    expect(troopAuthoringPreview(project, troop, { ...input, turn: 2 })!.actions[0]!.reason).toBeUndefined();
    expect(troopAuthoringPreview(project, troop, input)!.elements[0]!.multiplier).toBe(0.5); // A can be authored resistance.
    expect(JSON.stringify(project)).toBe(before);
  });
});
let cleanup: () => void;
let oldWindow: typeof window;
beforeEach(() => {
  cleanup = installFakeDom(); oldWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", { configurable: true, value: { setTimeout: () => 0, clearTimeout } });
});
afterEach(() => {
  cleanup();
  if (oldWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else Object.defineProperty(globalThis, "window", { configurable: true, value: oldWindow });
});
it("edits existing enemy records through visible controls and preserves unrelated action fields on save/load", () => {
  const { project, troop, enemy } = setup();
  store.replace(project);
  const panel = troopIntentPanel(troop, 0) as unknown as FakeElement;
  const select = (id: string, value: string) => {
    const control = findByTestId(panel, id)!;
    expect(control).toBeTruthy(); control.value = value; control.dispatchEvent(new Event("change", { bubbles: true }));
  };
  for (const [id, value] of [["feature16-intent-start-0", "3"], ["feature16-intent-interval-0", "4"]]) {
    const control = findByTestId(panel, id!)!;
    control.value = value!; control.dispatchEvent(new Event("input"));
  }
  expect(store.getCurrent().database.enemies.find(e => e.id === enemy.id)!.actions[0]!.condition).toEqual({ kind: "turn", start: 3, interval: 4 });
  select("feature16-intent-condition-0", "always");
  select("feature16-intent-element-authored", "B");
  const restored = deserialize(serialize(store.getCurrent()));
  const changed = restored.database.enemies.find(e => e.id === enemy.id)!;
  expect(changed.actions[0]!.condition).toEqual({ kind: "always" });
  expect(changed.actions[0]!.switchOnAfterAction).toEqual({ enabled: true, switchId: "sw_keep" });
  expect(changed.elementRates.authored).toBe("B");
  expect(findByTestId(panel, "feature16-intent-prediction-0")).toBeTruthy();
});


describe("integrated combat condition preview", () => {
  const cases: { condition: EnemyActionCondition; matches: boolean }[] = [
    { condition: { kind: "always" }, matches: true },
    { condition: { kind: "turn", start: 2, interval: 3 }, matches: true },
    { condition: { kind: "turn", start: 3, interval: 3 }, matches: false },
    { condition: { kind: "hp", minPercent: 25, maxPercent: 25 }, matches: true },
    { condition: { kind: "hp", minPercent: 26, maxPercent: 100 }, matches: false },
    { condition: { kind: "mp", minPercent: 60, maxPercent: 60 }, matches: true },
    { condition: { kind: "mp", minPercent: 0, maxPercent: 59 }, matches: false },
    { condition: { kind: "status", stateId: "state_poison", present: false }, matches: true },
    { condition: { kind: "status", stateId: "state_poison", present: true }, matches: false },
    { condition: { kind: "allies", min: 1, max: 1 }, matches: true },
    { condition: { kind: "allies", min: 2, max: 3 }, matches: false },
    { condition: { kind: "switch", switchId: "preview-on", value: true }, matches: true },
    { condition: { kind: "switch", switchId: "preview-on", value: false }, matches: false },
    { condition: { kind: "switch", switchId: "preview-off", value: false }, matches: true },
    { condition: { kind: "switch", switchId: "legacy-preview", value: true }, matches: true },
  ];
  it.each(cases)("evaluates $condition with initial context: $matches", ({ condition, matches }) => {
    const { project, troop, enemy } = setup();
    enemy.stats.maxHp = enemy.stats.maxMp = 100;
    enemy.actions = [{ ...enemy.actions[0]!, skillId: "", condition }];
    troop.members = [
      { enemyId: enemy.id, x: 40, y: 40 },
      { enemyId: enemy.id, x: 60, y: 40 },
      { enemyId: enemy.id, x: 80, y: 40, hidden: true },
    ];
    project.switches.push({ id: "preview-on", name: "초기 ON" }, { id: "preview-off", name: "초기 OFF" });
    project.session.switches = { ...project.session.switches, "preview-on": true };
    project.flags["preview-off"] = true; // Declared switch initial value takes precedence over legacy flags.
    project.flags["legacy-preview"] = true;
    const before = JSON.stringify(project);
    const preview = troopAuthoringPreview(project, troop, { ...input, turn: 5, hpPercent: 25, mpPercent: 60 })!;
    expect(preview.actions[0]!.reason === undefined).toBe(matches);
    expect(preview).toMatchObject({ hp: 25, mp: 60, livingAllies: 1 });
    expect(JSON.stringify(project)).toBe(before);
  });
});

it.each<EnemyActionCondition>([
  { kind: "hp", minPercent: 10, maxPercent: 40 },
  { kind: "mp", minPercent: 20, maxPercent: 70 },
  { kind: "status", stateId: "state_poison", present: false },
  { kind: "allies", min: 1, max: 2 },
  { kind: "switch", switchId: "preview-switch", value: false },
])("shows and preserves authored $kind conditions through unrelated edits and save/load", condition => {
  const { project, troop, enemy } = setup();
  project.switches.push({ id: "preview-switch", name: "미리보기 스위치" });
  if (condition.kind === "status") condition = { ...condition, stateId: project.database.states[0]!.id };
  enemy.actions[0]!.condition = condition;
  store.replace(project);
  const panel = troopIntentPanel(troop, 0) as unknown as FakeElement;
  expect(findByTestId(panel, "feature16-intent-condition-0")!.value).toBe(condition.kind);
  expect(findByTestId(panel, "feature16-intent-context-note")!.textContent).toContain("관측한 결과가 아닙니다");
  const priority = findByTestId(panel, "feature16-intent-priority-0")!;
  priority.value = "53"; priority.dispatchEvent(new Event("input"));
  const restored = deserialize(serialize(store.getCurrent()));
  expect(restored.database.enemies.find(e => e.id === enemy.id)!.actions[0]).toMatchObject({ condition, priority: 53 });
});

it("edits HP assumptions and retains legacy turn capture selectors after switching condition kind", () => {
  const { project, troop, enemy } = setup();
  enemy.stats.maxHp = 100;
  enemy.actions[0] = { ...enemy.actions[0]!, skillId: "", condition: { kind: "hp", minPercent: 0, maxPercent: 50 } };
  store.replace(project);
  const panel = troopIntentPanel(troop, 0) as unknown as FakeElement;
  expect(findByTestId(panel, "feature16-intent-prediction-0")!.textContent).toContain("조건 불일치");
  const hp = findByTestId(panel, "feature16-intent-hp")!;
  hp.value = "25"; hp.dispatchEvent(new Event("input"));
  expect(findByTestId(panel, "feature16-intent-prediction-0")!.textContent).toContain("조건 통과");
  const kind = findByTestId(panel, "feature16-intent-condition-0")!;
  kind.value = "turn"; kind.dispatchEvent(new Event("change", { bubbles: true }));
  expect(findByTestId(panel, "feature16-intent-start-0")).toBeTruthy();
  expect(findByTestId(panel, "feature16-intent-interval-0")).toBeTruthy();
  expect(findByTestId(panel, "feature16-intent-condition-0")!.value).toBe("turn");
});
