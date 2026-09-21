import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import { startSession } from "@/project/session";
import { appendBattleReport, BATTLE_REPORT_LIMIT, BATTLE_REPORT_LINE_LIMIT, normalizeBattleReports } from "@/project/battleReports";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey } from "@/player/saveSlots";
import { battleReportDetail } from "@/player/playerBattleReportDetail";
import fixture from "./fixtures/projects/battle-v3.json";

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
