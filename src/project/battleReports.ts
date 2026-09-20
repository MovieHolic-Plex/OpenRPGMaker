import type { BattleResult, BattleSnapshot, BattleTimelineEntrySnapshot } from "@/battle/types";
import type { Project } from "@/project/types";

export const BATTLE_REPORT_LIMIT = 20;
export const BATTLE_REPORT_LINE_LIMIT = 120;
export interface BattleReportLine { sequence: number; text: string }
export interface BattleReport {
  troopId: string;
  troopName: string;
  result: BattleResult;
  turns: number;
  exp: number;
  gold: number;
  items: string[];
  omittedLines: number;
  lines: BattleReportLine[];
}
const resultLabels: Record<BattleResult, string> = { victory: "승리", defeat: "패배", escape: "도주" };
export function battleReportResultLabel(result: BattleResult): string { return resultLabels[result]; }
const kindLabels: Partial<Record<BattleTimelineEntrySnapshot["kind"], string>> = {
  action: "행동", damage: "피해", healing: "회복", miss: "빗나감", capture: "포획",
  switch: "교대", stateUpkeep: "상태 지속", stateRecovery: "상태 회복", stateAdded: "상태 부여",
  stateRemoved: "상태 해제", incapacitated: "행동 불가", stalemate: "교착", wait: "대기",
};
const commandLabels: Record<string, string> = { attack: "공격", enemyAttack: "공격", skill: "스킬", enemySkill: "스킬", item: "아이템", defend: "방어", escape: "도주", capture: "포획", switch: "교대" };

/** Record only emitted runtime facts; never synthesize turns or hits from HP deltas. */
export function createBattleReport(project: Project, snapshot: BattleSnapshot, result: BattleResult): BattleReport {
  const names = new Map([...snapshot.actors, ...snapshot.reserveActors, ...snapshot.enemies].flatMap(b => [[b.id, b.name], [b.recordId, b.name]] as [string, string][]));
  const name = (id?: string) => id ? names.get(id) ?? id : "";
  const lines = snapshot.timeline.slice(-BATTLE_REPORT_LINE_LIMIT).map(entry => {
    const state = project.database.states.find(s => s.id === entry.stateId)?.name ?? entry.stateId;
    return { sequence: entry.sequence, text: [
      kindLabels[entry.kind] ?? entry.kind, name(entry.userId ?? entry.userRecordId),
      entry.targetId ? `→ ${name(entry.targetId)}` : "",
      entry.skillName ?? (entry.commandKind ? commandLabels[entry.commandKind] ?? entry.commandKind : ""),
      entry.amount !== undefined ? `${entry.resource?.toUpperCase() ?? ""} ${entry.amount}`.trim() : "",
      entry.hit === false ? "실패" : "", entry.critical ? "치명타" : "", state,
      entry.success !== undefined ? (entry.success ? "성공" : "실패") : "",
    ].filter(Boolean).join(" · ").slice(0, 500) };
  });
  return {
    troopId: snapshot.troopId, troopName: project.database.troops.find(t => t.id === snapshot.troopId)?.name ?? snapshot.troopId,
    result, turns: Math.max(snapshot.turn, snapshot.strictRound),
    exp: result === "victory" ? snapshot.rewards.exp : 0,
    gold: result === "victory" ? snapshot.rewards.gold : 0,
    items: result === "victory" ? snapshot.rewards.items.map(id => project.database.items.find(i => i.id === id)?.name ?? id).slice(0, 100) : [],
    omittedLines: Math.max(0, snapshot.timeline.length - lines.length), lines,
  };
}
export function appendBattleReport(session: { battleReports?: BattleReport[] }, project: Project, snapshot: BattleSnapshot, result: BattleResult): void {
  session.battleReports = normalizeBattleReports([...(session.battleReports ?? []), createBattleReport(project, snapshot, result)]);
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const count = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0;
/** Older saves have no history. Invalid optional history cannot prevent loading a valid game. */
export function normalizeBattleReports(value: unknown): BattleReport[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-BATTLE_REPORT_LIMIT).flatMap<BattleReport>(raw => {
    if (!record(raw) || typeof raw.troopId !== "string" || typeof raw.troopName !== "string"
      || (raw.result !== "victory" && raw.result !== "defeat" && raw.result !== "escape") || !Array.isArray(raw.lines)) return [];
    const lines = raw.lines.slice(-BATTLE_REPORT_LINE_LIMIT).flatMap(line =>
      record(line) && typeof line.text === "string" && typeof line.sequence === "number" && Number.isFinite(line.sequence)
        ? [{ sequence: count(line.sequence), text: line.text.slice(0, 500) }] : []);
    return [{ troopId: raw.troopId.slice(0, 200), troopName: raw.troopName.slice(0, 200), result: raw.result,
      turns: count(raw.turns), exp: count(raw.exp), gold: count(raw.gold),
      items: Array.isArray(raw.items) ? raw.items.filter((s): s is string => typeof s === "string").slice(0, 100).map(s => s.slice(0, 200)) : [],
      omittedLines: count(raw.omittedLines) + Math.max(0, raw.lines.length - BATTLE_REPORT_LINE_LIMIT), lines }];
  });
}
