// project/quest/questTable.ts
// 자료집 개요 「퀘스트 표」의 행 모델(순수 — 프로젝트만 읽는다).
//
// 등록된 퀘스트(project.quests)와 아직 등록하지 않은 제안(questCandidates.pendingQuestCandidates)을 한 목록으로 만든다.
// 행마다 「어디서 시작하나(부탁한 이벤트)」「어디서 끝나나(보고 이벤트)」「보상」「상태」를 붙이고,
// 시작·보고 칸을 눌렀을 때 데려갈 맵·이벤트를 미리 풀어 둔다. 데려갈 수 없으면 그 이유를 행에 남긴다 — 화면이 조용히 막지 않게.
//
// 등록 퀘스트의 자리 찾기:
//   - 단계 퀘스트(QuestDef): giver 가 이벤트 참조면 그 이벤트, 새로 만든 NPC 면 컴파일러가 쓰는 id(ev_<key>_giver).
//     보고는 같은 giver 이벤트다(questCompiler 가 보상·완료 페이지를 giver 에 짓는다). 보상은 def.rewards.
//   - 그래프 퀘스트(QuestGraphDef): 첫 노드의 진행 값을 켜는 이벤트가 시작, 마지막 노드의 값을 켜는 이벤트가 보고다.
//     보상은 보고 이벤트에서 그 값을 켜는 명령과 같은 명령 목록에 있는 돈·아이템 지급이다.
import type { Command, GameEvent, Project } from "@/project/types";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { pendingQuestCandidates, type QuestCandidate } from "./questCandidates";
import { isQuestGraphDef, type AnyQuestDef, type QuestGraphConditionExpression, type QuestDef, type QuestGraphDef } from "./questDef";

export type QuestTableStatus = "registered" | "suggested" | "unreachable";
export type QuestTableFilter = "all" | "registered" | "suggested";

export interface QuestTablePlace {
  readonly mapId: string | null;
  readonly eventId: string | null;
  readonly mapName: string;
  readonly eventName: string;
}

export interface QuestTableReward {
  readonly gold: number;
  readonly items: readonly { readonly itemId: string; readonly name: string; readonly count: number }[];
}

/** 칸을 눌렀을 때 데려갈 곳. ok:false 면 이유를 칸에 보이고 누를 수 없게 한다. */
export type QuestJumpTarget =
  | { readonly ok: true; readonly mapId: string; readonly eventId: string; readonly x: number; readonly y: number }
  | { readonly ok: false; readonly reason: string };

export interface QuestTableRow {
  readonly id: string;
  readonly title: string;
  readonly status: QuestTableStatus;
  readonly confidence: number | null;
  readonly request: string | null;
  readonly giver: QuestTablePlace | null;
  readonly turnIn: QuestTablePlace | null;
  readonly giverJump: QuestJumpTarget;
  readonly turnInJump: QuestJumpTarget;
  readonly reward: QuestTableReward | null;
  readonly problem: string | null;
  readonly registrable: boolean;
  readonly candidate: QuestCandidate | null;
}

interface FlagRef { readonly kind: "switch" | "variable"; readonly id: string }

const STATUS_ORDER: Record<QuestTableStatus, number> = { unreachable: 0, registered: 1, suggested: 2 };

function firstFlag(expression: QuestGraphConditionExpression): FlagRef | null {
  const leaves: unknown[] = Array.isArray(expression) ? [...expression]
    : "all" in (expression as object) ? [...(expression as { all: readonly unknown[] }).all] : [expression];
  for (const leaf of leaves) {
    const rec = leaf as { kind?: string; switchId?: unknown; variableId?: unknown };
    if (rec.kind === "switch" && typeof rec.switchId === "string") return { kind: "switch", id: rec.switchId };
    if (rec.kind === "variable" && typeof rec.variableId === "string") return { kind: "variable", id: rec.variableId };
  }
  return null;
}

function writes(command: Command, flag: FlagRef): boolean {
  if (flag.kind === "switch") return command.kind === "setSwitch" && command.switchId === flag.id && command.value === true;
  return command.kind === "setVariable" && command.variableId === flag.id
    && (command.op === "+=" || command.op === "=") && typeof command.value === "number" && command.value > 0;
}

function forEachWritingList(commands: readonly Command[], flag: FlagRef, visit: (list: readonly Command[]) => void): void {
  if (commands.some((command) => writes(command, flag))) visit(commands);
  for (const command of commands) for (const branch of eventCommandBranches(command)) forEachWritingList(branch.commands, flag, visit);
}

function eventWrites(event: GameEvent, flag: FlagRef): boolean {
  let hit = false;
  for (const page of event.pages ?? []) forEachWritingList(page.commands, flag, () => { hit = true; });
  return hit;
}

function commonEventWriter(project: Project, flag: FlagRef): string | null {
  for (const common of project.commonEvents ?? []) {
    let hit = false;
    forEachWritingList(common.commands, flag, () => { hit = true; });
    if (hit) return common.name || common.id;
  }
  return null;
}

function writerEvent(project: Project, flag: FlagRef): { mapId: string; event: GameEvent } | null {
  for (const map of Object.values(project.maps)) {
    for (const event of map.events ?? []) if (eventWrites(event, flag)) return { mapId: map.id, event };
  }
  return null;
}

function itemName(project: Project, itemId: string): string {
  return project.database.items.find((item) => item.id === itemId)?.name
    || project.database.equipment.find((item) => item.id === itemId)?.name
    || itemId;
}

function rewardOf(project: Project, gold: number, items: readonly { itemId: string; count: number }[]): QuestTableReward | null {
  if (gold <= 0 && items.length === 0) return null;
  return { gold, items: items.map((item) => ({ itemId: item.itemId, name: itemName(project, item.itemId), count: item.count })) };
}

/** 한 명령 목록에 바로 놓인 돈·아이템 지급(분기 안은 보지 않는다 — 다른 갈래의 보상이다). */
interface ListReward { gold: number; items: { itemId: string; count: number }[] }

/** 같은 보상을 여러 페이지·분기(계산대 쪽 사본 등)에 갈래로 둔 것은 한 번만 받는다 — 합이 아니라 항목별 최댓값. */
function mergeAlternatives(project: Project, lists: readonly ListReward[]): QuestTableReward | null {
  let gold = 0;
  const counts = new Map<string, number>();
  for (const list of lists) {
    gold = Math.max(gold, list.gold);
    const own = new Map<string, number>();
    for (const item of list.items) own.set(item.itemId, (own.get(item.itemId) ?? 0) + item.count);
    for (const [itemId, count] of own) counts.set(itemId, Math.max(counts.get(itemId) ?? 0, count));
  }
  return rewardOf(project, gold, [...counts].map(([itemId, count]) => ({ itemId, count })));
}

function listRewards(commands: readonly Command[]): ListReward {
  let gold = 0;
  const items: { itemId: string; count: number }[] = [];
  for (const command of commands) {
    if (command.kind === "changeGold" && command.op === "+=" && typeof command.amount === "number" && command.amount > 0) gold += command.amount;
    if (command.kind === "changeItem" && command.op === "+=") {
      const count = typeof command.amount === "number" ? command.amount : 1;
      if (count > 0) items.push({ itemId: command.itemId, count });
    }
  }
  return { gold, items };
}

function rewardNearWrite(project: Project, event: GameEvent, flag: FlagRef): QuestTableReward | null {
  const lists: ListReward[] = [];
  for (const page of event.pages ?? []) forEachWritingList(page.commands, flag, (list) => { lists.push(listRewards(list)); });
  return mergeAlternatives(project, lists);
}

function rewardWhenReading(project: Project, event: GameEvent, flagIds: ReadonlySet<string>): QuestTableReward | null {
  const reads = (condition: unknown): boolean => {
    if (!condition || typeof condition !== "object") return false;
    const rec = condition as { kind?: string; switchId?: string; variableId?: string; itemId?: string; conditions?: unknown[] };
    if (rec.kind === "all") return (rec.conditions ?? []).some(reads);
    return [rec.switchId, rec.variableId, rec.itemId].some((id) => id !== undefined && flagIds.has(id));
  };
  const lists: ListReward[] = [];
  const add = (list: readonly Command[]) => { lists.push(listRewards(list)); };
  const walk = (commands: readonly Command[]) => {
    for (const command of commands) {
      if (command.kind === "fork" && reads(command.condition)) add(command.then);
      for (const branch of eventCommandBranches(command)) walk(branch.commands);
    }
  };
  for (const page of event.pages ?? []) {
    if ((page.conditions ?? []).some(reads)) add(page.commands);
    walk(page.commands);
  }
  return mergeAlternatives(project, lists);
}

function place(project: Project, mapId: string, eventId: string, fallbackName = eventId): QuestTablePlace {
  const map = project.maps[mapId];
  const event = map?.events.find((entry) => entry.id === eventId);
  return { mapId, eventId, mapName: map?.name || mapId, eventName: event?.name || fallbackName };
}

/**
 * 표 칸 하나를 눌렀을 때 데려갈 곳. 맵·이벤트가 지금 프로젝트에 있어야 ok 다.
 * missingReason 은 자리를 아예 못 찾은 칸(place=null)의 이유다.
 */
export function resolveQuestJumpTarget(project: Project, target: QuestTablePlace | null, missingReason = "이벤트 위치를 찾지 못했습니다"): QuestJumpTarget {
  if (!target || !target.mapId || !target.eventId) return { ok: false, reason: missingReason };
  const map = project.maps[target.mapId];
  if (!map) return { ok: false, reason: `맵 ${target.mapId} 이(가) 프로젝트에 없습니다` };
  const event = map.events.find((entry) => entry.id === target.eventId);
  if (!event) return { ok: false, reason: `맵 「${map.name || map.id}」에 이벤트 ${target.eventId} 이(가) 없습니다` };
  return { ok: true, mapId: map.id, eventId: event.id, x: event.x, y: event.y };
}

function stepQuestRow(project: Project, quest: QuestDef): QuestTableRow {
  const giver = "create" in quest.giver
    ? place(project, quest.giver.create.mapId, `ev_${quest.key}_giver`, quest.giver.create.name)
    : place(project, quest.giver.mapId, quest.giver.eventId);
  const giverJump = resolveQuestJumpTarget(project, giver);
  return {
    id: quest.key,
    title: quest.title,
    status: giverJump.ok ? "registered" : "unreachable",
    confidence: null,
    request: null,
    giver,
    turnIn: giver,
    giverJump,
    turnInJump: giverJump,
    reward: rewardOf(project, quest.rewards?.gold ?? 0, quest.rewards?.items ?? []),
    problem: giverJump.ok ? null : `부탁 이벤트가 없습니다: ${giverJump.reason}`,
    registrable: false,
    candidate: null,
  };
}

function graphPlace(project: Project, flag: FlagRef | null): { place: QuestTablePlace | null; reason: string; dead: boolean; event: GameEvent | null } {
  if (!flag) return { place: null, reason: "이야기 깃발로만 진행해 이벤트 위치가 없습니다", dead: false, event: null };
  const writer = writerEvent(project, flag);
  if (writer) return { place: place(project, writer.mapId, writer.event.id), reason: "", dead: false, event: writer.event };
  const common = commonEventWriter(project, flag);
  if (common) return { place: null, reason: `공용 이벤트 「${common}」에서 진행합니다 — 맵 위치가 없습니다`, dead: false, event: null };
  return { place: null, reason: `진행 값 ${flag.id} 을(를) 켜는 이벤트가 없습니다`, dead: true, event: null };
}

function graphQuestRow(project: Project, quest: QuestGraphDef): QuestTableRow {
  const first = quest.nodes[0] ? firstFlag(quest.nodes[0].completesWhen) : null;
  const lastNode = quest.nodes[quest.nodes.length - 1];
  const last = lastNode ? firstFlag(lastNode.completesWhen) : null;
  const start = graphPlace(project, first);
  const end = graphPlace(project, last);
  const giverJump = resolveQuestJumpTarget(project, start.place, start.reason);
  const turnInJump = resolveQuestJumpTarget(project, end.place, end.reason);
  const problems = [start.dead ? `시작: ${start.reason}` : null, end.dead ? `보고: ${end.reason}` : null].filter((text): text is string => text !== null);
  return {
    id: quest.id,
    title: quest.title,
    status: problems.length > 0 ? "unreachable" : "registered",
    confidence: null,
    request: null,
    giver: start.place,
    turnIn: end.place,
    giverJump,
    turnInJump,
    reward: end.event && last ? rewardNearWrite(project, end.event, last) : null,
    problem: problems.length > 0 ? problems.join(" · ") : null,
    registrable: false,
    candidate: null,
  };
}

function registeredRow(project: Project, quest: AnyQuestDef): QuestTableRow {
  return isQuestGraphDef(quest) ? graphQuestRow(project, quest) : stepQuestRow(project, quest);
}

function suggestedRow(project: Project, candidate: QuestCandidate): QuestTableRow {
  const giver = place(project, candidate.giver.mapId, candidate.giver.eventId);
  const turnIn = place(project, candidate.turnIn.mapId, candidate.turnIn.eventId);
  const turnInEvent = project.maps[candidate.turnIn.mapId]?.events.find((event) => event.id === candidate.turnIn.eventId);
  return {
    id: candidate.id,
    title: candidate.title,
    status: "suggested",
    confidence: candidate.confidence,
    request: candidate.request,
    giver,
    turnIn,
    giverJump: resolveQuestJumpTarget(project, giver),
    turnInJump: resolveQuestJumpTarget(project, turnIn),
    reward: turnInEvent ? rewardWhenReading(project, turnInEvent, new Set(candidate.flags.map((flag) => flag.id))) : null,
    problem: null,
    registrable: candidate.registrable,
    candidate,
  };
}

/** 표의 모든 행 — 상태(문제 있음 → 등록 → 제안) 다음 제목 순. */
export function buildQuestTableRows(project: Project): QuestTableRow[] {
  const rows = [
    ...(project.quests ?? []).map((quest) => registeredRow(project, quest)),
    ...pendingQuestCandidates(project).map((candidate) => suggestedRow(project, candidate)),
  ];
  return rows.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.title.localeCompare(b.title, "ko") || a.id.localeCompare(b.id));
}

export function filterQuestTableRows(rows: readonly QuestTableRow[], filter: QuestTableFilter): QuestTableRow[] {
  if (filter === "all") return [...rows];
  if (filter === "suggested") return rows.filter((row) => row.status === "suggested");
  return rows.filter((row) => row.status !== "suggested");
}

export function questTableCounts(rows: readonly QuestTableRow[]): Record<QuestTableStatus, number> {
  const counts: Record<QuestTableStatus, number> = { registered: 0, suggested: 0, unreachable: 0 };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}
