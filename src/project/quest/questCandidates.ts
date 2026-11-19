// project/quest/questCandidates.ts
// 이벤트에서 「퀘스트처럼 생긴」 흐름을 찾아 등록 후보를 만든다(순수 — 프로젝트만 읽는다).
//
// 왜 필요한가 (2026-11-07 실측): 저장된 게임 17개 중 project.quests 를 채운 것은 하나(Fallen Star, 7개)뿐이었다.
// 플레이어 퀘스트 로그(src/player/questLog.ts)는 project.quests 만 읽으므로, 부탁·심부름 흐름을 이벤트로만 지은 게임은
// 로그가 비어 있다. 문제는 로그가 아니라 「저자가 어느 이벤트가 퀘스트인지 선언하지 않는 것」이다.
// 이 모듈은 이벤트 모양에서 후보를 찾고, 편집기·조수가 「N개가 퀘스트처럼 보입니다 — 등록할까요?」를 묻게 한다.
//
// 모양(세 조각이 모두 있어야 후보다):
//   1. 부탁(giver) — 누군가가 부탁하는 대사(「…해 줘」「부탁」「찾아 와」)를 가진 이벤트.
//   2. 수행(step)  — 다른 이벤트가 진행 값을 쓴다: 스위치 켬, 변수 올림, 아이템 얻음.
//   3. 보고(turn-in) — 어떤 이벤트가 그 값을 페이지 조건이나 조건 분기로 읽고 반응한다(대사·보상·스위치·엔딩).
//   부탁 이벤트가 보고 이벤트 자신이거나, 부탁 대사가 보고/수행 이벤트의 이름을 부를 때만 셋을 한 흐름으로 묶는다.
// 게임별 상수는 없다. 측정·정답표는 test/fixtures/quest-candidates/ 와 test/questCandidates.test.ts.

import type { Command, Condition, GameEvent, GameMap, Project } from "@/project/types";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { isQuestGraphDef, questFlagIds, type AnyQuestDef, type QuestGraphDef, type QuestGraphNode } from "./questDef";

export interface QuestCandidateEventRef {
  readonly mapId: string;
  readonly eventId: string;
  readonly name: string;
}

export type QuestCandidateFlag =
  | { readonly kind: "switch"; readonly id: string }
  | { readonly kind: "variable"; readonly id: string; readonly atLeast: number }
  | { readonly kind: "item"; readonly id: string };

export interface QuestCandidate {
  /** 결정적 id — 같은 프로젝트면 늘 같다. 등록 퀘스트 id 의 바탕. */
  readonly id: string;
  readonly title: string;
  /** 부탁 대사 한 줄(요약). */
  readonly request: string;
  readonly giver: QuestCandidateEventRef;
  readonly turnIn: QuestCandidateEventRef;
  readonly steps: readonly QuestCandidateEventRef[];
  readonly flags: readonly QuestCandidateFlag[];
  /** 0~1. 근거 신호의 합. */
  readonly confidence: number;
  readonly reasons: readonly string[];
  /** 이미 이 흐름의 진행 값을 읽는 등록 퀘스트가 있으면 그 id. */
  readonly registeredAs: string | null;
  /** 퀘스트 그래프 조건(switch/variable)으로 표현할 수 있는가 — 아이템만으로 끝나는 흐름은 못 한다. */
  readonly registrable: boolean;
  /** define_quest 에 그대로 넘길 수 있는 그래프. registrable 이 false 면 null. */
  readonly draft: QuestGraphDef | null;
}

/** 편집기·조수가 「제안」으로 보이는 최소 신뢰도. 조정 묶음(절반)에서만 정했다 — openwiki/quest-register.md. */
export const QUEST_CANDIDATE_MIN_CONFIDENCE = 0.6;

// 부탁 말투. 「…해 봐」「…하자」는 힌트·독백이라 넣지 않는다.
// 문장 끝의 부탁 어미만 센다 — 「부탁할 사람이」처럼 문장 한가운데의 낱말은 부탁이 아니다.
const REQUEST_ENDING = /(줘|주렴|줄래|주세요|주겠니|주시겠어요|주실래요|주지 않겠니|부탁해|부탁해요|부탁할게|부탁합니다|부탁드려요|가져와|가져와요|구해 와|찾아 와|모아 와|받아 와|받아 오겠니|오겠니|맡길게)\s*$/u;

function requestSentence(text: string): string | null {
  for (const sentence of text.split(/(?<=[.!?…~])\s+|\n/u)) {
    const bare = sentence.replace(/[.!?…~」』"')\]]+$/u, "").trim();
    if (REQUEST_ENDING.test(bare)) return sentence.trim();
  }
  return null;
}

interface Ctx {
  readonly map: GameMap;
  readonly event: GameEvent;
  readonly pageIndex: number;
  readonly scope: readonly Condition[];
}

interface Write { readonly flag: string; readonly kind: "switch" | "variable" | "item"; readonly ctx: Ctx }
interface Read { readonly flag: string; readonly kind: "switch" | "variable" | "item"; readonly atLeast: number; readonly ctx: Ctx; readonly reacts: boolean; readonly rewards: boolean }

const key = (mapId: string, eventId: string) => `${mapId}\u0000${eventId}`;

function leafConditions(condition: Condition): Condition[] {
  if (condition.kind === "all") return condition.conditions.flatMap(leafConditions);
  return [condition];
}

function readOf(condition: Condition): { flag: string; kind: Read["kind"]; atLeast: number } | null {
  if (condition.kind === "switch" && condition.value === true) return { flag: condition.switchId, kind: "switch", atLeast: 1 };
  if (condition.kind === "item" && condition.present) return { flag: condition.itemId, kind: "item", atLeast: 1 };
  if (condition.kind === "variable" && typeof condition.value === "number") {
    if (condition.op === ">=" || condition.op === "==") return condition.value > 0 ? { flag: condition.variableId, kind: "variable", atLeast: condition.value } : null;
    if (condition.op === ">") return condition.value >= 0 ? { flag: condition.variableId, kind: "variable", atLeast: condition.value + 1 } : null;
  }
  return null;
}

function writeOf(command: Command): { flag: string; kind: Write["kind"] } | null {
  if (command.kind === "setSwitch" && command.value === true) return { flag: command.switchId, kind: "switch" };
  // 「= n」은 이야기 단계 기계(stage)다 — 진행 값으로 세는 것은 쌓이는 「+= n」뿐이다.
  if (command.kind === "setVariable" && command.op === "+=" && typeof command.value === "number" && command.value > 0) {
    return { flag: command.variableId, kind: "variable" };
  }
  if (command.kind === "changeItem" && command.op === "+=" && (typeof command.amount !== "number" || command.amount > 0)) return { flag: command.itemId, kind: "item" };
  return null;
}

const REACTION_KINDS = new Set(["text", "setSwitch", "setVariable", "changeItem", "changeGold", "triggerEnding", "learnSkill", "changeParty", "battleProcessing", "choices"]);

function rewards(commands: readonly Command[]): boolean {
  return commands.some((command) =>
    (command.kind === "changeItem" && command.op === "+=")
    || (command.kind === "changeGold" && command.op === "+=")
    || command.kind === "triggerEnding" || command.kind === "learnSkill" || command.kind === "changeParty"
    || eventCommandBranches(command).some((branch) => rewards(branch.commands)));
}

function textOf(command: Command): string {
  if (command.kind === "text") return command.body ?? "";
  if (command.kind === "choices") return command.prompt ?? "";
  return "";
}

function hasSprite(event: GameEvent): boolean {
  return (event.pages ?? []).some((page) => Boolean(page.graphic?.sprite) && !page.graphic?.transparent);
}

function displayName(event: GameEvent, speakers: ReadonlySet<string>): string[] {
  const names = new Set<string>();
  if (event.name && event.name.trim().length >= 2) names.add(event.name.trim());
  for (const speaker of speakers) if (speaker.trim().length >= 2) names.add(speaker.trim());
  return [...names];
}

function collect(project: Project) {
  const writes: Write[] = [];
  const reads: Read[] = [];
  const requests = new Map<string, { ref: QuestCandidateEventRef; lines: string[]; sprite: boolean; speakers: Set<string> }>();
  const names = new Map<string, string[]>();
  const refs = new Map<string, QuestCandidateEventRef>();
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      const ref: QuestCandidateEventRef = { mapId: map.id, eventId: event.id, name: event.name ?? "" };
      const k = key(map.id, event.id);
      refs.set(k, ref);
      const speakers = new Set<string>();
      const lines: string[] = [];
      const walk = (commands: readonly Command[], ctx: Ctx) => {
        const talkable = ctx.event.pages?.[ctx.pageIndex]?.trigger.kind === "action";
        for (const command of commands) {
          if (command.kind === "text" && command.speaker) speakers.add(command.speaker);
          const sentence = talkable ? requestSentence(textOf(command)) : null;
          if (sentence) lines.push(command.kind === "text" && command.speaker ? `${command.speaker}: ${sentence}` : sentence);
          const write = writeOf(command);
          if (write) writes.push({ ...write, ctx });
          if (command.kind === "fork") {
            walk(command.then, { ...ctx, scope: [...ctx.scope, ...leafConditions(command.condition)] });
            if (command.else) walk(command.else, ctx);
            continue;
          }
          for (const branch of eventCommandBranches(command)) walk(branch.commands, ctx);
        }
      };
      const pages = event.pages ?? [];
      pages.forEach((page, pageIndex) => {
        walk(page.commands, { map, event, pageIndex, scope: page.conditions ?? [] });
      });
      const scan = (commands: readonly Command[], scope: readonly Condition[], pageIndex: number) => {
        const own = scope.map(readOf).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
        // 보고에는 「아직」 쪽이 있어야 한다: 앞 페이지가 그 조건 없이 먼저 답한다.
        const hasBefore = pages.slice(0, pageIndex).some((page) => !(page.conditions ?? []).some((condition) => own.some((entry) => readOf(condition)?.flag === entry.flag)));
        if (own.length > 0 && hasBefore) {
          const reacts = commands.some((command) => REACTION_KINDS.has(command.kind));
          for (const entry of own) reads.push({ ...entry, ctx: { map, event, pageIndex, scope }, reacts, rewards: rewards(commands) });
        }
        for (const command of commands) {
          if (command.kind === "fork") {
            const inner = leafConditions(command.condition).map(readOf).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
            const siblingReads = commands.filter((other) => other !== command && other.kind === "fork" && leafConditions(other.condition).some((condition) => inner.some((entry) => readOf(condition)?.flag === entry.flag || (condition.kind === "variable" && condition.variableId === entry.flag))));
            const hasBefore = (command.else?.length ?? 0) > 0 || siblingReads.length > 0;
            for (const entry of hasBefore ? inner : []) {
              reads.push({ ...entry, ctx: { map, event, pageIndex, scope }, reacts: command.then.some((c) => REACTION_KINDS.has(c.kind)), rewards: rewards(command.then) });
            }
            scan(command.then, [], pageIndex);
            if (command.else) scan(command.else, [], pageIndex);
            continue;
          }
          for (const branch of eventCommandBranches(command)) scan(branch.commands, [], pageIndex);
        }
      };
      pages.forEach((page, pageIndex) => scan(page.commands, page.conditions ?? [], pageIndex));
      // 부탁하는 쪽은 화면에 보이는 인물이다 — 쪽지·표지판·투명 이벤트의 「…해 줘」는 부탁자가 아니다.
      if (lines.length > 0 && hasSprite(event)) requests.set(k, { ref, lines, sprite: true, speakers });
      names.set(k, displayName(event, speakers));
    }
  }
  return { writes, reads, requests, names, refs };
}

function registeredFlagOwners(quests: readonly AnyQuestDef[] | undefined): Map<string, string> {
  const owners = new Map<string, string>();
  for (const quest of quests ?? []) {
    if (isQuestGraphDef(quest)) {
      const visit = (value: unknown): void => {
        if (Array.isArray(value)) { value.forEach(visit); return; }
        if (!value || typeof value !== "object") return;
        const record = value as Record<string, unknown>;
        if (typeof record.switchId === "string") owners.set(record.switchId, quest.id);
        if (typeof record.variableId === "string") owners.set(record.variableId, quest.id);
        if (Array.isArray(record.all)) visit(record.all);
      };
      for (const node of quest.nodes) visit(node.completesWhen);
    } else {
      const ids = questFlagIds(quest.key, quest.steps.length);
      for (const id of [ids.started, ids.done, ids.progress, ...ids.stepSwitches]) owners.set(id, quest.key);
    }
  }
  return owners;
}

function slug(text: string): string {
  const ascii = text.replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
  return ascii.length > 0 ? ascii.slice(0, 40) : "event";
}

function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

function trimLine(line: string): string {
  const flat = line.replace(/\s+/g, " ").trim();
  return flat.length > 90 ? `${flat.slice(0, 89)}…` : flat;
}

function stepLabel(step: QuestCandidateEventRef, project: Project): string {
  const mapName = project.maps[step.mapId]?.name || step.mapId;
  return step.name ? `${mapName}의 ${step.name}` : `${mapName}의 이벤트 ${step.eventId}`;
}

function buildDraft(project: Project, id: string, title: string, request: string, giver: QuestCandidateEventRef, turnIn: QuestCandidateEventRef, ordered: readonly { step: QuestCandidateEventRef; flag: QuestCandidateFlag }[]): QuestGraphDef | null {
  const usable = ordered.filter((entry) => entry.flag.kind !== "item");
  if (usable.length === 0) return null;
  const nodes: QuestGraphNode[] = usable.map((entry, index) => ({
    id: `step${index + 1}`,
    description: entry.flag.kind === "variable" && usable.filter((other) => other.flag.id === entry.flag.id).length === 1 && entry.flag.atLeast > 1
      ? `${entry.flag.atLeast}번 해낸다 (${stepLabel(entry.step, project)} 등)`
      : `${stepLabel(entry.step, project)} — 해결한다`,
    completesWhen: entry.flag.kind === "switch"
      ? { kind: "switch", switchId: entry.flag.id, value: true }
      : { kind: "variable", variableId: entry.flag.id, op: ">=", value: (entry.flag as { atLeast: number }).atLeast },
  }));
  const turnInName = turnIn.name || (giver.eventId === turnIn.eventId ? giver.name : "") || "의뢰인";
  nodes[nodes.length - 1] = { ...nodes[nodes.length - 1]!, description: `${nodes[nodes.length - 1]!.description} 그리고 ${turnInName}에게 알린다` };
  return {
    kind: "graph",
    id,
    title,
    summary: request,
    nodes,
    edges: nodes.slice(1).map((node, index) => ({ from: nodes[index]!.id, to: node.id })),
  };
}

type Group = { giver: string; turnIn: string; request: string; flags: Map<string, { flag: QuestCandidateFlag; steps: Set<string> }>; reasons: Set<string>; rewards: boolean };

// 부탁 하나는 퀘스트 하나다. 같은 부탁자(또는 같은 보고 자리)에서 여러 흐름이 나오면 자기 자신에게 보고받는 쪽, 수행 자리가 많은 쪽을 남긴다.
function keepStrongestPerEvent(groups: Group[], requests: ReadonlyMap<string, unknown>): Group[] {
  const score = (group: Group) => (group.giver === group.turnIn ? 100 : 0) + (group.rewards ? 10 : 0) + new Set([...group.flags.values()].flatMap((entry) => [...entry.steps])).size;
  const sorted = [...groups].sort((a, b) => score(b) - score(a));
  const usedGivers = new Set<string>();
  const usedTurnIns = new Set<string>();
  const kept: Group[] = [];
  for (const group of sorted) {
    if (usedGivers.has(group.giver) || usedTurnIns.has(group.turnIn) || !requests.has(group.giver)) continue;
    usedGivers.add(group.giver);
    usedTurnIns.add(group.turnIn);
    kept.push(group);
  }
  return kept;
}

/**
 * 프로젝트의 퀘스트 후보. 신뢰도 높은 순. 이미 등록된 흐름도 registeredAs 를 달아 돌려준다(측정용) —
 * 화면·조수 제안은 `pendingQuestCandidates` 를 쓴다.
 */
export function findQuestCandidates(project: Project): QuestCandidate[] {
  const { writes, reads, requests, names, refs } = collect(project);
  const writersByFlag = new Map<string, Write[]>();
  for (const write of writes) {
    const list = writersByFlag.get(`${write.kind}:${write.flag}`) ?? [];
    list.push(write);
    writersByFlag.set(`${write.kind}:${write.flag}`, list);
  }
  const owners = registeredFlagOwners(project.quests);
  const groups = new Map<string, { giver: string; turnIn: string; request: string; flags: Map<string, { flag: QuestCandidateFlag; steps: Set<string> }>; reasons: Set<string>; rewards: boolean }>();

  for (const read of reads) {
    // 보고는 플레이어가 찾아가 말을 거는 자리다 — 저절로 도는 자동 장면은 이야기 연출이다.
    if (!read.reacts || read.ctx.event.pages?.[read.ctx.pageIndex]?.trigger.kind !== "action") continue;
    const turnInKey = key(read.ctx.map.id, read.ctx.event.id);
    const stepWriters = (writersByFlag.get(`${read.kind}:${read.flag}`) ?? []).filter((write) => key(write.ctx.map.id, write.ctx.event.id) !== turnInKey);
    if (stepWriters.length === 0) continue;
    const stepKeys = new Set(stepWriters.map((write) => key(write.ctx.map.id, write.ctx.event.id)));
    let giverKey: string | null = null;
    let reason = "";
    if (requests.has(turnInKey)) { giverKey = turnInKey; reason = "부탁한 인물이 결과를 확인한다"; }
    else {
      const targets = [turnInKey, ...stepKeys];
      for (const [candidateKey, request] of requests) {
        if (stepKeys.has(candidateKey)) continue;
        const text = request.lines.join(" ");
        const hit = targets.find((target) => (names.get(target) ?? []).some((name) => text.includes(name)));
        if (hit) { giverKey = candidateKey; reason = `부탁 대사가 「${(names.get(hit) ?? [])[0]}」을(를) 가리킨다`; break; }
      }
    }
    if (!giverKey) continue;
    const groupKey = `${giverKey}\u0001${turnInKey}`;
    const group = groups.get(groupKey) ?? { giver: giverKey, turnIn: turnInKey, request: requests.get(giverKey)!.lines[0]!, flags: new Map(), reasons: new Set<string>(), rewards: false };
    group.reasons.add(reason);
    if (read.rewards) group.rewards = true;
    const flag: QuestCandidateFlag = read.kind === "variable" ? { kind: "variable", id: read.flag, atLeast: read.atLeast } : { kind: read.kind, id: read.flag };
    const flagKey = `${read.kind}:${read.flag}`;
    const entry = group.flags.get(flagKey);
    if (entry) {
      if (flag.kind === "variable" && entry.flag.kind === "variable" && flag.atLeast > entry.flag.atLeast) entry.flag = flag;
      for (const step of stepKeys) entry.steps.add(step);
    } else group.flags.set(flagKey, { flag, steps: new Set(stepKeys) });
    groups.set(groupKey, group);
  }

  const candidates: QuestCandidate[] = [];
  for (const group of keepStrongestPerEvent([...groups.values()], requests)) {
    const giver = refs.get(group.giver)!;
    const turnIn = refs.get(group.turnIn)!;
    const stepKeys = new Set([...group.flags.values()].flatMap((entry) => [...entry.steps]));
    const steps = [...stepKeys].map((stepKey) => refs.get(stepKey)!);
    const flags = [...group.flags.values()].map((entry) => entry.flag);
    const reasons = [...group.reasons];
    let confidence = 0.4;
    if (group.giver === group.turnIn) confidence += 0.2; else confidence += 0.15;
    if (group.rewards) { confidence += 0.15; reasons.push("확인한 뒤 보상·엔딩·합류를 준다"); }
    if (steps.some((step) => step.mapId !== giver.mapId)) { confidence += 0.1; reasons.push("수행 장소가 다른 맵이다"); }
    if (steps.length >= 2) { confidence += 0.1; reasons.push(`수행 이벤트 ${steps.length}곳`); }
    if (requests.get(group.giver)!.sprite) confidence += 0.05;
    confidence = Math.min(1, Math.round(confidence * 100) / 100);
    const registeredAs = flags.map((flag) => owners.get(flag.id)).find((owner): owner is string => owner !== undefined) ?? null;
    const giverName = giver.name || [...(requests.get(group.giver)!.speakers)][0] || "";
    const title = giverName ? `${giverName}의 부탁` : `${project.maps[giver.mapId]?.name || giver.mapId}의 부탁`;
    const id = `q_found_${slug(giver.eventId)}_${hash(group.giver + group.turnIn)}`;
    const ordered = [...group.flags.values()].map((entry) => ({ step: refs.get([...entry.steps][0]!)!, flag: entry.flag }));
    const request = trimLine(group.request);
    const draft = buildDraft(project, id, title, request, giver, turnIn, ordered);
    candidates.push({ id, title, request, giver, turnIn, steps, flags, confidence, reasons, registeredAs, registrable: draft !== null, draft });
  }
  return candidates.sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id));
}

/** 아직 등록되지 않았고 신뢰도가 기준 이상인 후보 — 편집기 제안 목록과 조수 도구가 보인다. */
export function pendingQuestCandidates(project: Project): QuestCandidate[] {
  return findQuestCandidates(project).filter((candidate) => candidate.registeredAs === null && candidate.confidence >= QUEST_CANDIDATE_MIN_CONFIDENCE);
}

/**
 * 후보 하나를 초안 퀘스트로 등록한다(draft 를 바꾼다). 이벤트는 건드리지 않는다 — 진행 값은 이미 이벤트가 쓴다.
 * 등록된 퀘스트 그래프가 플레이어 퀘스트 로그에 바로 나타난다.
 */
export function registerQuestCandidate(project: Project, candidate: QuestCandidate): QuestGraphDef {
  if (!candidate.draft) throw new Error(`퀘스트 후보 ${candidate.id} 는 아이템으로만 끝나서 그래프 조건으로 옮길 수 없습니다. 보고 이벤트에 setSwitch 를 하나 넣고 다시 찾으세요.`);
  for (const node of candidate.draft.nodes) {
    const condition = node.completesWhen as { kind: string; switchId?: string; variableId?: string };
    if (condition.kind === "switch" && condition.switchId && !project.switches.some((entry) => entry.id === condition.switchId)) {
      project.switches.push({ id: condition.switchId, name: condition.switchId });
      project.session.switches[condition.switchId] ??= false;
    }
    if (condition.kind === "variable" && condition.variableId && !project.variables.some((entry) => entry.id === condition.variableId)) {
      project.variables.push({ id: condition.variableId, name: condition.variableId });
      project.session.variables[condition.variableId] ??= 0;
    }
  }
  project.quests = [...(project.quests ?? []).filter((quest) => (isQuestGraphDef(quest) ? quest.id : quest.key) !== candidate.draft!.id), candidate.draft];
  return candidate.draft;
}

/** 완료 관문 경고 문구 — 후보가 있는데 퀘스트가 0개일 때. */
export function unregisteredQuestWarning(project: Project): string | null {
  if ((project.quests ?? []).length > 0) return null;
  const pending = pendingQuestCandidates(project);
  if (pending.length === 0) return null;
  const list = pending.slice(0, 3).map((candidate) => `「${candidate.title}」(${candidate.giver.mapId}/${candidate.giver.eventId})`).join(", ");
  return `퀘스트처럼 보이는 흐름이 ${pending.length}개 있는데 project.quests 가 비어 있다 — 플레이어 퀘스트 로그가 빈다: ${list}. find_quest_candidates 로 초안을 받아 define_quest 로 등록하라(이벤트는 그대로 둔다).`;
}
