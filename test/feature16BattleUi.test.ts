import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { troopAuthoringPreview } from "@/battle/battleAuthoringPreview";
import { troopIntentPanel } from "@/editor/panels/databaseTroopIntentPanel";
import type { EnemyActionCondition } from "@/project/types";
import { store } from "@/project/store";
import { deserialize, serialize } from "@/project/io";
import { installFakeDom, findByTestId, type FakeElement } from "./fakeDom";
import fixture from "./fixtures/projects/battle-v3.json";
import { actorBattlers, battlerSnapshot, refreshActorBattlerDerivedStats } from "@/battle/battleBattlers";
import { formationDamage } from "@/battle/battleFormation";
import { applySkillLike } from "@/battle/battleDamage";
import { predictSkillDamage } from "@/battle/battlePredict";
import { createBattleRuntime } from "@/battle/runtime";
import { startSession } from "@/project/session";
import { formationDetail } from "@/player/playerFormationDetail";
import { appendBattleReport, BATTLE_REPORT_LIMIT, BATTLE_REPORT_LINE_LIMIT, normalizeBattleReports } from "@/project/battleReports";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey } from "@/player/saveSlots";
import { battleReportDetail } from "@/player/playerBattleReportDetail";
import { isolateTimers } from "./mergedTeardown";

describe("feature16BattleUiAuthoring", () => {
  isolateTimers();
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
});

describe("feature16BattleUiFormation", () => {
  isolateTimers();
  const setup = () => deserialize(JSON.stringify(fixture));
  describe("feature16 physical formation", () => {
    it("reduces outgoing/incoming physical damage with legacy fronts and magic unchanged", () => {
      expect(formationDamage(100, "back", "front", "attack", "damage")).toBe(75);
      expect(formationDamage(100, "front", "back", "attack", "damage")).toBe(75);
      expect(formationDamage(100, "back", "back", "attack", "damage")).toBe(56);
      expect(formationDamage(100, undefined, undefined, "attack", "damage")).toBe(100);
      expect(formationDamage(100, "back", "back", "mind", "damage")).toBe(100);
      expect(formationDamage(100, "back", "back", "attack", "healing")).toBe(100);
      expect(formationDamage(-10, "back", "back", "attack", "damage")).toBe(-10);
      expect(formationDamage(0, "back", "back", "attack", "damage")).toBe(0);
      expect(formationDamage(1, "back", "back", "attack", "damage")).toBe(1);
    });
    it("retains raw stats and row through equipment refresh and snapshot", () => {
      const project = setup();
      const front = actorBattlers(project)[0]!;
      const back = actorBattlers(project, { rows: { [front.recordId]: "back" } })[0]!;
      expect(back.attackPower).toBe(front.attackPower);
      expect(back.defense).toBe(front.defense);
      refreshActorBattlerDerivedStats(project, back, {});
      expect(back.row).toBe("back");
      expect(battlerSnapshot(back).row).toBe("back");
      expect(back.defense).toBe(front.defense);
    });
    // Parent combat integration: runtime forwards party.rows; shared damage and prediction apply formationDamage once.
    it("wires saved rows into runtime, damage and prediction without affecting mind skills", () => {
      const project = setup();
      const session = startSession(project);
      const id = session.partyActorIds[0]!;
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: false, canLose: true,
        party: { levels: session.actorLevels, experience: {}, rows: { [id]: "back" } } });
      expect(runtime.snapshot().actors.find(a => a.recordId === id)?.row).toBe("back");
      const front = actorBattlers(project)[0]!;
      const back = actorBattlers(project, { rows: { [id]: "back" } })[0]!;
      for (const statistic of ["attack", "mind"] as const) {
        const spec = { power: 100, statistic, effect: "damage" as const, hitRate: 100, variance: 0, criticalRate: 0, rng: () => 0.5 };
        const target = structuredClone(front);
        const base = applySkillLike(structuredClone(front), target, spec).amount;
        const actual = applySkillLike(structuredClone(back), structuredClone(front), spec).amount;
        expect(actual).toBe(statistic === "attack" ? Math.max(1, Math.floor(base * 0.75)) : base);
        const incoming = applySkillLike(structuredClone(front), structuredClone(back), spec).amount;
        expect(incoming).toBe(statistic === "attack" ? Math.max(1, Math.floor(base * 0.75)) : base);
        const prediction = predictSkillDamage(project, battlerSnapshot(back), spec, battlerSnapshot(front));
        expect(prediction.amount).toBe(actual);
      }
    });
    it("offers active/reserve ordering and row actions via real detail callbacks", () => {
      const project = setup();
      project.system.activeSlots = 1;
      project.database.actors.push({ ...structuredClone(project.database.actors[0]!), id: "feature16_reserve", name: "대기 동료" });
      const session = startSession(project);
      session.partyActorIds = [session.partyActorIds[0]!, "feature16_reserve"];
      let picked = "";
      let toggled = "";
      let move: unknown;
      const options = { project, session, slots: [], waitModeEnabled: true, selectedCommand: "formation" as const,
        onSelectFormationActor: (id: string) => { picked = id; }, onToggleRow: (id: string) => { toggled = id; },
        onMoveFormationActor: (id: string, index: number) => { move = [id, index]; } };
      const list = formationDetail(options);
      expect(list.entries[0]!.value).toContain("참전");
      list.entries[0]!.onActivate!();
      expect(picked).toBe(session.partyActorIds[0]);
      const selected = formationDetail({ ...options, formationActorId: picked });
      selected.entries.find(e => e.testId === "status-menu-formation-toggle-row")!.onActivate!();
      expect(toggled).toBe(picked);
      expect(selected.entries[1]!.value).toContain("대기");
      selected.entries[1]!.onActivate!();
      expect(move).toEqual([picked, 1]);
    });
  });
});

describe("feature16BattleUiReports", () => {
  isolateTimers();
  function completedBattle() {
    const project = deserialize(JSON.stringify(fixture));
    project.database.enemies.forEach(enemy => { enemy.stats.maxHp = 1; enemy.stats.agility = 1; });
    const session = startSession(project, 12);
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: false, canLose: true, rng: () => 0.5 });
    for (let i = 0; i < 300 && !runtime.snapshot().result; i++) {
      runtime.tick(1000);
      const state = runtime.snapshot();
      if (state.phase === "actorCommand") {
        const enemy = state.enemies.find(e => !e.defeated);
        if (enemy) runtime.performActorCommand({ kind: "attack", targetEnemyId: enemy.id });
      }
    }
    const snapshot = runtime.snapshot();
    expect(snapshot.result).toBe("victory");
    expect(snapshot.timeline.some(line => line.kind === "damage")).toBe(true);
    appendBattleReport(session, project, snapshot, snapshot.result!);
    return { project, session, snapshot };
  }
  function slot(payload: unknown) {
    const storage = { getItem: (key: string) => key === saveSlotKey(1) ? JSON.stringify(payload) : null } as Storage;
    const read = readSaveSlot(storage, 1);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") throw new Error("save rejected");
    return read.snapshot;
  }
  describe("feature16 actual battle reports and save compatibility", () => {
    it("retains runtime facts after completion and makes every line keyboard navigable", () => {
      const { project, session, snapshot } = completedBattle();
      const report = session.battleReports![0]!;
      expect(report.lines.map(l => l.sequence)).toEqual(snapshot.timeline.map(l => l.sequence).slice(-BATTLE_REPORT_LINE_LIMIT));
      expect(report.lines.some(l => l.text.includes("피해"))).toBe(true);
      let selected: number | undefined;
      const options = { project, session, selectedCommand: "battle-reports" as const, slots: [], waitModeEnabled: true, onSelectBattleReport: (index: number | undefined) => { selected = index; } };
      battleReportDetail(options).entries[0]!.onActivate!();
      expect(selected).toBe(0);
      const detail = battleReportDetail({ ...options, battleReportIndex: selected });
      expect(detail.entries.filter(e => e.testId?.includes("-line-")).every(e => !!e.onActivate)).toBe(true);
      detail.entries[0]!.onActivate!();
      expect(selected).toBeUndefined();
    });
    it("round-trips rows, party order and reports through serialized slot parsing and restore", () => {
      const { project, session } = completedBattle();
      session.partyActorIds.reverse();
      session.actorRows[session.partyActorIds[0]!] = "back";
      const snapshot = slot(createSaveSnapshot(project, session));
      const restored = applySaveSnapshot(project, snapshot);
      expect(restored.battleReports).toEqual(session.battleReports);
      expect(restored.actorRows).toEqual(session.actorRows);
      expect(restored.partyActorIds).toEqual(session.partyActorIds);
      restored.battleReports![0]!.lines[0]!.text = "changed";
      expect(snapshot.session.battleReports![0]!.lines[0]!.text).not.toBe("changed");
    });
    it("loads older saves with front rows and empty history; discards malformed optional history", () => {
      const { project, session } = completedBattle();
      const old = JSON.parse(JSON.stringify(createSaveSnapshot(project, session)));
      delete old.session.actorRows;
      delete old.session.battleReports;
      const restored = applySaveSnapshot(project, slot(old));
      expect(restored.battleReports).toEqual([]);
      expect(Object.values(restored.actorRows).every(row => row === "front")).toBe(true);
      old.session.battleReports = [{ result: "invented", lines: "bad" }];
      expect(applySaveSnapshot(project, slot(old)).battleReports).toEqual([]);
    });
    it("bounds history and drops animations/unknown payloads rather than copying battle graphs", () => {
      const { project, session, snapshot } = completedBattle();
      for (let i = 0; i < BATTLE_REPORT_LIMIT + 5; i++) appendBattleReport(session, project, snapshot, "victory");
      expect(session.battleReports).toHaveLength(BATTLE_REPORT_LIMIT);
      const raw = { ...session.battleReports![0], lines: Array.from({ length: 200 }, (_, sequence) => ({ sequence, text: "x".repeat(600), animation: { huge: true } })) };
      const bounded = normalizeBattleReports([raw])[0]!;
      expect(bounded.lines).toHaveLength(BATTLE_REPORT_LINE_LIMIT);
      expect(bounded.omittedLines).toBe(80);
      expect(bounded.lines[0]).toEqual({ sequence: 80, text: "x".repeat(500) });
    });
    it.each(["defeat", "escape"] as const)("does not claim victory rewards on %s", result => {
      const { project, session, snapshot } = completedBattle();
      appendBattleReport(session, project, snapshot, result);
      expect(session.battleReports!.at(-1)).toMatchObject({ result, exp: 0, gold: 0, items: [] });
    });
  });
});
