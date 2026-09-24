// editor/tools/mysteryCaseTool.ts
// 추리/살인사건/탐정 게임을 사건 명세 하나로 저작하는 고수준 툴(author_mystery_case)과
// 같은 일관성 검사를 읽기로 노출하는 check_mystery_case.
//
// 왜 따로 두나(2026-09-23 헤드리스 실측): 저수준 툴을 모델이 조립하면
// 증거가 실행 안 되는 곳에 쓰이고, 지목 NPC 에 증거 조건이 없어 시작 3초 만에 진엔딩에 닿고,
// 선택지 라벨이 「(진범)」으로 답을 누설하고, 범인을 단서로 특정할 수 없는 사건이 나왔다.
// 여기서는 쓰기 전에 사건 논리(특정 가능성·도달 가능성·누설·순서)를 검사하고,
// 통과한 명세만 기존 툴(place_examine_hotspots·place_npc·define_ending)로 컴파일한다.
//
// 증거 대면·지목은 아직 presentItem 명령 없이 choices + 아이템 소지 조건 분기로 컴파일한다.
// 갈아 끼울 지점은 compileEvidencePresentation / compileAccusationChoice 두 함수뿐이다.

import { presentItemBranchLists } from "@/project/eventCommands/presentItemBranches";
import { canMove, isPassable } from "@/project/collision";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { computeReachableCells, isAdjacentOrOn } from "@/project/lint/reachability";
import { collectCommands, reachableMapIdsFromStart } from "@/project/mapInspection";
import type { Command, EventPage, EventPageCondition, GameEvent, GameMap, Project } from "@/project/types";
import type { SceneStep, SceneTestInput } from "@/testing/sceneTestRunner";
import { withJosa } from "@/util/josa";
import { ENDING_TOOLS } from "./endingTools";
import { EVENT_TOOLS, passableLanding } from "./eventTools";
import { INVESTIGATION_TOOLS } from "./investigationTools";
import { inMapBounds } from "./mapHelpers";
import { CUTSCENE_BEAT_SCHEMA, GRAPHIC_SPEC_SCHEMA } from "./schemaShapes";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

// ── 명세 ────────────────────────────────────────────────────────────────────

export interface CaseAt {
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
}

export interface SuspectSpec {
  readonly id: string;
  readonly name: string;
  readonly at: CaseAt;
  /** 기존 이벤트(마을 주민)를 용의자로 재사용. 같은 맵에 있어야 한다. */
  readonly eventId?: string;
  readonly graphic?: Record<string, unknown>;
  readonly greeting: readonly string[];
  readonly alibi: readonly string[];
  readonly motive: readonly string[];
  readonly testimony: readonly string[];
  readonly lie?: { readonly claim: string; readonly contradictedBy: string; readonly truth: readonly string[] };
  /** 사건 당일 활동. 재사용 주민의 시간표를 이 한 줄로 바꾼다. 생략하면 시간표를 비운다. */
  readonly activity?: string;
}

export interface ClueSpec {
  readonly id: string;
  readonly name: string;
  readonly at?: CaseAt;
  readonly description: string;
  readonly lines: readonly string[];
  readonly implicates: readonly string[];
  readonly excludes: readonly string[];
  readonly obtainedBy: "examine" | "testimony";
  readonly givenBy?: string;
  readonly reactions: Readonly<Record<string, readonly string[]>>;
}

export interface AccuserSpec {
  readonly name: string;
  readonly at: CaseAt;
  readonly eventId?: string;
  readonly graphic?: Record<string, unknown>;
  readonly intro: readonly string[];
  readonly hint: readonly string[];
  readonly ready: readonly string[];
  readonly prompt: string;
}

export interface CaseEndingSpec {
  readonly id: string;
  readonly name: string;
  readonly lines: readonly string[];
  readonly epilogue?: readonly unknown[];
}

export interface MysteryCase {
  readonly caseId: string;
  readonly title: string;
  readonly victim: string;
  readonly culprit: string;
  readonly suspects: readonly SuspectSpec[];
  readonly clues: readonly ClueSpec[];
  readonly accuser: AccuserSpec;
  readonly endings: { readonly solved: CaseEndingSpec; readonly wrong: CaseEndingSpec };
  readonly requiredClues: readonly string[];
}

export interface MysteryProblem {
  readonly code:
    | "mystery-reference"
    | "mystery-culprit-unimplicated"
    | "mystery-culprit-excluded"
    | "mystery-unexcluded-suspect"
    | "mystery-unreachable"
    | "mystery-leak"
    | "mystery-order";
  readonly message: string;
}

export const MYSTERY_ITEM_PREFIX = "item_mystery_";
const ID_PATTERN = /^[A-Za-z0-9_]+$/;

export function mysteryClueItemId(caseId: string, clueId: string): string {
  return `${MYSTERY_ITEM_PREFIX}${caseId}_${clueId}`;
}

function eventPrefix(caseId: string): string {
  return `ev_mystery_${caseId}_`;
}

function suspectEventId(spec: MysteryCase, suspect: SuspectSpec): string {
  return suspect.eventId ?? `${eventPrefix(spec.caseId)}suspect_${suspect.id}`;
}

function accuserEventId(spec: MysteryCase): string {
  return spec.accuser.eventId ?? `${eventPrefix(spec.caseId)}accuser`;
}

function clueEventId(spec: MysteryCase, clue: ClueSpec): string {
  return `${eventPrefix(spec.caseId)}clue_${clue.id}`;
}

// ── 파싱 (모양 오류는 즉시 ToolError) ───────────────────────────────────────

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ToolError(`${label}(문자열)가 필요합니다.`, { code: "invalid-args" });
  }
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function lines(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value.filter((line): line is string => typeof line === "string" && line.trim().length > 0).map((line) => line.trim());
}

function idList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()) : [];
}

function caseId(value: unknown, label: string): string {
  const id = text(value, label);
  if (!ID_PATTERN.test(id)) {
    throw new ToolError(`${label} '${id}'는 영문·숫자·_ 만 쓸 수 있습니다(이벤트·아이템 id 에 들어갑니다).`, { code: "invalid-args" });
  }
  return id;
}

function parseAt(value: unknown, label: string): CaseAt {
  if (!isRecord(value)) throw new ToolError(`${label}는 {mapId,x,y} 객체여야 합니다.`, { code: "invalid-args" });
  if (typeof value.x !== "number" || typeof value.y !== "number") {
    throw new ToolError(`${label}.x/y 숫자가 필요합니다.`, { code: "invalid-args" });
  }
  return { mapId: text(value.mapId, `${label}.mapId`), x: Math.trunc(value.x), y: Math.trunc(value.y) };
}

function parseGraphic(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? { ...value } : undefined;
}

function parseSuspect(value: unknown, index: number): SuspectSpec {
  const label = `suspects[${index}]`;
  if (!isRecord(value)) throw new ToolError(`${label}는 객체여야 합니다.`, { code: "invalid-args" });
  const lie = isRecord(value.lie)
    ? {
        claim: text(value.lie.claim, `${label}.lie.claim`),
        contradictedBy: text(value.lie.contradictedBy, `${label}.lie.contradictedBy`),
        truth: lines(value.lie.truth),
      }
    : undefined;
  return {
    id: caseId(value.id, `${label}.id`),
    name: text(value.name, `${label}.name`),
    at: parseAt(value.at, `${label}.at`),
    ...(optionalText(value.eventId) ? { eventId: optionalText(value.eventId) } : {}),
    ...(parseGraphic(value.graphic) ? { graphic: parseGraphic(value.graphic) } : {}),
    greeting: lines(value.greeting),
    alibi: lines(value.alibi),
    motive: lines(value.motive),
    testimony: lines(value.testimony),
    ...(lie ? { lie } : {}),
    ...(optionalText(value.activity) ? { activity: optionalText(value.activity) } : {}),
  };
}

function parseClue(value: unknown, index: number): ClueSpec {
  const label = `clues[${index}]`;
  if (!isRecord(value)) throw new ToolError(`${label}는 객체여야 합니다.`, { code: "invalid-args" });
  const obtainedBy = value.obtainedBy === "testimony" ? "testimony" : "examine";
  if (value.obtainedBy !== undefined && value.obtainedBy !== "testimony" && value.obtainedBy !== "examine") {
    throw new ToolError(`${label}.obtainedBy 는 'examine' 또는 'testimony' 여야 합니다.`, { code: "invalid-args" });
  }
  const reactions: Record<string, string[]> = {};
  if (isRecord(value.reactions)) {
    for (const [suspectId, entry] of Object.entries(value.reactions)) reactions[suspectId] = lines(entry);
  }
  return {
    id: caseId(value.id, `${label}.id`),
    name: text(value.name, `${label}.name`),
    ...(value.at !== undefined ? { at: parseAt(value.at, `${label}.at`) } : {}),
    description: text(value.description, `${label}.description`),
    lines: lines(value.lines),
    implicates: idList(value.implicates),
    excludes: idList(value.excludes),
    obtainedBy,
    ...(optionalText(value.givenBy) ? { givenBy: optionalText(value.givenBy) } : {}),
    reactions,
  };
}

function parseEnding(value: unknown, fallbackId: string, fallbackName: string): CaseEndingSpec {
  const record = isRecord(value) ? value : {};
  const epilogue = Array.isArray(record.epilogue) ? record.epilogue : undefined;
  return {
    id: optionalText(record.id) ?? fallbackId,
    name: optionalText(record.name) ?? fallbackName,
    lines: lines(record.lines),
    ...(epilogue ? { epilogue } : {}),
  };
}

export function parseMysteryCase(args: RecordValue): MysteryCase {
  const id = caseId(args.caseId, "caseId");
  const victimRecord = isRecord(args.victim) ? args.victim : undefined;
  const victim = victimRecord ? text(victimRecord.name, "victim.name") : text(args.victim, "victim");
  const suspects = Array.isArray(args.suspects) ? args.suspects.map(parseSuspect) : [];
  const clues = Array.isArray(args.clues) ? args.clues.map(parseClue) : [];
  if (!isRecord(args.accuser)) throw new ToolError("accuser {name, at} 가 필요합니다.", { code: "invalid-args" });
  const accuserRecord = args.accuser;
  const suspectNames = suspects.map((suspect) => suspect.name).join(", ");
  const accuser: AccuserSpec = {
    name: text(accuserRecord.name, "accuser.name"),
    at: parseAt(accuserRecord.at, "accuser.at"),
    ...(optionalText(accuserRecord.eventId) ? { eventId: optionalText(accuserRecord.eventId) } : {}),
    ...(parseGraphic(accuserRecord.graphic) ? { graphic: parseGraphic(accuserRecord.graphic) } : {}),
    intro: lines(accuserRecord.intro).length > 0 ? lines(accuserRecord.intro) : [`${withJosa(victim, "이/가")} 죽은 사건을 맡아 주게.`],
    hint: lines(accuserRecord.hint).length > 0
      ? lines(accuserRecord.hint)
      : ["아직 누구를 지목할 만한 증거가 부족하네.", `현장을 조사하고 ${suspectNames}에게 이야기를 들어 보게.`],
    ready: lines(accuserRecord.ready).length > 0 ? lines(accuserRecord.ready) : ["증거가 모였군. 이제 누구를 지목하겠나?"],
    prompt: optionalText(accuserRecord.prompt) ?? `${withJosa(victim, "을/를")} 죽인 사람은 누구인가?`,
  };
  const endingsRecord = isRecord(args.endings) ? args.endings : {};
  const culprit = text(args.culprit, "culprit");
  const requiredExplicit = Array.isArray(args.requiredClues);
  const partial = { caseId: id, culprit, suspects, clues };
  return {
    caseId: id,
    title: optionalText(args.title) ?? `${victim} 사건`,
    victim,
    culprit,
    suspects,
    clues,
    accuser,
    endings: {
      solved: parseEnding(endingsRecord.solved, `ending_mystery_${id}_solved`, "사건 해결"),
      wrong: parseEnding(endingsRecord.wrong, `ending_mystery_${id}_wrong`, "미궁"),
    },
    requiredClues: requiredExplicit ? idList(args.requiredClues) : defaultRequiredClues(partial),
  };
}

/** 기본 필수 단서 = 범인을 가리키거나, 비범인을 배제하거나, 누군가의 거짓말을 반박하는 단서 전부. */
function defaultRequiredClues(spec: Pick<MysteryCase, "culprit" | "suspects" | "clues">): string[] {
  const liars = new Set(spec.suspects.flatMap((suspect) => (suspect.lie ? [suspect.lie.contradictedBy] : [])));
  return spec.clues
    .filter((clue) =>
      clue.implicates.includes(spec.culprit)
      || clue.excludes.some((id) => id !== spec.culprit)
      || liars.has(clue.id))
    .map((clue) => clue.id);
}

// ── 일관성 검사 ─────────────────────────────────────────────────────────────

export function checkMysteryCase(project: Project, spec: MysteryCase): MysteryProblem[] {
  const problems: MysteryProblem[] = [];
  const references = checkReferences(spec, problems);
  if (references) {
    checkIdentifiable(spec, problems);
    checkReachable(project, spec, problems);
  }
  checkLeaks(spec, problems);
  checkOrder(project, spec, problems);
  return problems;
}

function checkReferences(spec: MysteryCase, problems: MysteryProblem[]): boolean {
  const before = problems.length;
  const push = (message: string) => problems.push({ code: "mystery-reference", message });
  const suspectIds = new Set<string>();
  for (const suspect of spec.suspects) {
    if (suspectIds.has(suspect.id)) push(`용의자 id '${suspect.id}' 가 중복됩니다.`);
    suspectIds.add(suspect.id);
  }
  const clueIds = new Set<string>();
  for (const clue of spec.clues) {
    if (clueIds.has(clue.id)) push(`단서 id '${clue.id}' 가 중복됩니다.`);
    clueIds.add(clue.id);
  }
  if (spec.suspects.length < 2) push(`용의자가 ${spec.suspects.length}명입니다. 추리가 되려면 최소 2명이 필요합니다.`);
  if (!suspectIds.has(spec.culprit)) push(`culprit '${spec.culprit}' 가 suspects 의 id 가 아닙니다.`);
  for (const clue of spec.clues) {
    for (const id of [...clue.implicates, ...clue.excludes]) {
      if (!suspectIds.has(id)) push(`단서 '${clue.name}' 의 implicates/excludes 에 없는 용의자 '${id}' 가 있습니다.`);
    }
    if (clue.obtainedBy === "examine" && !clue.at) push(`조사 단서 '${clue.name}' 에 at {mapId,x,y} 가 없습니다.`);
    if (clue.obtainedBy === "testimony") {
      const giver = testimonyGiver(spec, clue);
      if (!giver) {
        push(`증언 단서 '${clue.name}' 를 줄 용의자가 없습니다: givenBy '${clue.givenBy ?? "(생략)"}' 가 suspects 의 id 가 아닙니다.`);
      }
    }
  }
  for (const suspect of spec.suspects) {
    if (suspect.lie && !clueIds.has(suspect.lie.contradictedBy)) {
      push(`용의자 '${suspect.name}' 의 lie.contradictedBy '${suspect.lie.contradictedBy}' 가 clues 의 id 가 아닙니다.`);
    }
    if (suspect.alibi.length === 0) push(`용의자 '${suspect.name}' 의 alibi 대사가 비어 있습니다.`);
  }
  for (const id of spec.requiredClues) {
    if (!clueIds.has(id)) push(`requiredClues 의 '${id}' 가 clues 의 id 가 아닙니다.`);
  }
  if (spec.endings.solved.id === spec.endings.wrong.id) push(`solved/wrong 엔딩 id 가 같습니다: ${spec.endings.solved.id}`);
  return problems.length === before;
}

function testimonyGiver(spec: MysteryCase, clue: ClueSpec): SuspectSpec | undefined {
  if (clue.givenBy) return spec.suspects.find((suspect) => suspect.id === clue.givenBy);
  const at = clue.at;
  if (!at) return undefined;
  return spec.suspects.find((suspect) => suspect.at.mapId === at.mapId && suspect.at.x === at.x && suspect.at.y === at.y);
}

function checkIdentifiable(spec: MysteryCase, problems: MysteryProblem[]): void {
  const required = new Set(spec.requiredClues);
  const requiredClues = spec.clues.filter((clue) => required.has(clue.id));
  const culprit = spec.suspects.find((suspect) => suspect.id === spec.culprit)!;
  if (required.size === 0) {
    problems.push({ code: "mystery-order", message: "필수 단서가 0개입니다. 증거 없이 바로 지목할 수 있게 됩니다 — requiredClues 를 비우지 마세요." });
  }
  const implicating = requiredClues.filter((clue) => clue.implicates.includes(culprit.id)).length
    + (culprit.lie && required.has(culprit.lie.contradictedBy) ? 1 : 0);
  if (implicating === 0) {
    problems.push({
      code: "mystery-culprit-unimplicated",
      message: `범인 '${culprit.name}'(${culprit.id})를 가리키는 필수 단서가 없습니다. implicates 에 '${culprit.id}' 를 담은 단서나, 범인의 거짓말(lie.contradictedBy)을 반박하는 단서를 필수 단서에 넣으세요.`,
    });
  }
  for (const clue of spec.clues) {
    if (clue.excludes.includes(culprit.id)) {
      problems.push({
        code: "mystery-culprit-excluded",
        message: `단서 '${clue.name}' 가 범인 '${culprit.name}' 를 배제(excludes)합니다. 범인이 결백하다는 증거와 범인 지목이 모순됩니다.`,
      });
    }
  }
  for (const suspect of spec.suspects) {
    if (suspect.id === culprit.id) continue;
    const excludedBy = requiredClues.filter((clue) => clue.excludes.includes(suspect.id)).map((clue) => clue.name);
    const lieExposed = suspect.lie !== undefined && required.has(suspect.lie.contradictedBy);
    if (excludedBy.length > 0 || lieExposed) continue;
    const implicatedBy = spec.clues.filter((clue) => clue.implicates.includes(suspect.id)).map((clue) => clue.name);
    const lieNote = suspect.lie
      ? ` 거짓말 반박 단서 '${suspect.lie.contradictedBy}' 는 필수 단서에 없습니다.`
      : "";
    problems.push({
      code: "mystery-unexcluded-suspect",
      message: `용의자 '${suspect.name}'(${suspect.id})를 배제할 근거가 없습니다 — 필수 단서 중 excludes 에 '${suspect.id}' 를 담은 단서도, 이 용의자의 거짓말을 반박하는 단서도 없습니다.${lieNote}`
        + (implicatedBy.length > 0 ? ` 오히려 ${implicatedBy.join(", ")} 가 이 용의자를 가리킵니다.` : "")
        + ` 플레이어는 '${culprit.name}' 와 '${suspect.name}' 중 누가 범인인지 단서로 가릴 수 없습니다. 이 용의자가 범행할 수 없었음을 보이는 단서(알리바이를 뒷받침하는 물증·증언)를 추가하세요.`,
    });
  }
}

interface Placement {
  readonly label: string;
  readonly at: CaseAt;
  readonly kind: "character" | "interaction";
  readonly reuseEventId?: string;
}

function placements(spec: MysteryCase): Placement[] {
  return [
    ...spec.suspects.map((suspect) => ({
      label: `용의자 '${suspect.name}'`, at: suspect.at, kind: "character" as const,
      ...(suspect.eventId ? { reuseEventId: suspect.eventId } : {}),
    })),
    {
      label: `지목 NPC '${spec.accuser.name}'`, at: spec.accuser.at, kind: "character" as const,
      ...(spec.accuser.eventId ? { reuseEventId: spec.accuser.eventId } : {}),
    },
    ...spec.clues
      .filter((clue) => clue.obtainedBy === "examine" && clue.at)
      .map((clue) => ({ label: `조사 단서 '${clue.name}'`, at: clue.at!, kind: "interaction" as const })),
  ];
}

/** 첫 조건 없는 페이지(없으면 첫 페이지)가 플레이어를 막는가 — 런타임 runtimeEventView 의 기본값(priority same·overlapForbidden)과 같다. */
function eventBlocksPlayer(event: GameEvent): boolean {
  const page = event.pages?.find((entry) => !entry.conditions || Object.keys(entry.conditions).length === 0) ?? event.pages?.[0];
  if (!page) return true;
  return (page.priority ?? "same") === "same" && (page.overlapForbidden ?? true);
}

/** seeds 에서 걸어서 닿는 칸. blocked 칸(인물·막는 이벤트)은 지나갈 수 없다. */
function walkableCells(project: Project, map: GameMap, seeds: readonly { x: number; y: number }[], blocked: ReadonlySet<string>): Set<string> {
  const seen = new Set<string>();
  const queue: Array<[number, number]> = [];
  for (const seed of seeds) {
    const key = `${seed.x},${seed.y}`;
    if (!seen.has(key)) { seen.add(key); queue.push([seed.x, seed.y]); }
  }
  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key) || blocked.has(key) || !canMove(project, map, x, y, nx, ny)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

/** 플레이어가 이 맵에 들어서는 칸: 시작 맵이면 시작 위치, 아니면 도달 가능한 맵에서 이 맵으로 오는 문의 도착 칸. 모르면 빈 배열. */
function entryCells(project: Project, map: GameMap, reachableMaps: ReadonlySet<string>): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  if (map.id === project.startMapId) out.push({ x: project.startPos.x, y: project.startPos.y });
  for (const source of Object.values(project.maps)) {
    if (!reachableMaps.has(source.id)) continue;
    for (const command of collectCommands(source.events)) {
      if (command.kind === "transfer" && command.mapId === map.id) out.push({ x: command.x, y: command.y });
    }
  }
  return out;
}

function checkReachable(project: Project, spec: MysteryCase, problems: MysteryProblem[]): void {
  const push = (message: string) => problems.push({ code: "mystery-unreachable", message });
  const prefix = eventPrefix(spec.caseId);
  const seen = new Map<string, string>();
  const all = placements(spec);
  const reachableMaps = reachableMapIdsFromStart(project);
  const reused = new Set(all.flatMap((placement) => placement.reuseEventId ?? []));
  // 인물(용의자·지목 NPC)과 사건 밖의 막는 이벤트는 플레이어가 지나갈 수 없다 — 한 칸 통로에 서면 그 너머 방이 통째로 막힌다
  // (manor-mystery 실측: 지목 테이블이 서재 문간, 집사가 주방 복도에 서서 독약병·조카에게 못 갔는데 검사를 통과했다).
  const blockersOn = (map: GameMap, without?: Placement): Map<string, string> => new Map([
    ...map.events
      .filter((event) => !event.id.startsWith(prefix) && !reused.has(event.id) && eventBlocksPlayer(event))
      .map((event) => [`${event.x},${event.y}`, `이벤트 '${event.name ?? event.id}'`] as const),
    ...all
      .filter((other) => other.kind === "character" && other !== without && other.at.mapId === map.id)
      .map((other) => [`${other.at.x},${other.at.y}`, other.label] as const),
  ]);
  const reachableByMap = new Map<string, Set<string> | null>();
  const reachableOn = (map: GameMap): Set<string> | null => {
    if (reachableByMap.has(map.id)) return reachableByMap.get(map.id)!;
    const seeds = reachableMaps.has(map.id) ? entryCells(project, map, reachableMaps) : [];
    const cells = seeds.length > 0 ? walkableCells(project, map, seeds, new Set(blockersOn(map).keys())) : null;
    reachableByMap.set(map.id, cells);
    return cells;
  };
  /** 막힌 배치를 여는 인물: 그 인물 하나를 치우면 닿는다. */
  const culpritBlocker = (map: GameMap, at: CaseAt): Placement | undefined => {
    const seeds = entryCells(project, map, reachableMaps);
    return all.find((other) => {
      if (other.kind !== "character" || other.at.mapId !== map.id) return false;
      if (other.at.x === at.x && other.at.y === at.y) return false;
      const cells = walkableCells(project, map, seeds, new Set(blockersOn(map, other).keys()));
      return isAdjacentOrOn(cells, at.x, at.y);
    });
  };
  /** 인물을 (x,y) 에 세웠을 때 다른 배치 중 하나라도 걸어서 못 닿게 되면 참 — 후보 칸 고를 때 통로를 피한다. */
  const chokepointTest = (map: GameMap, self: Placement) => (x: number, y: number): boolean => {
    const seeds = entryCells(project, map, reachableMaps);
    if (seeds.length === 0) return false;
    const blocked = new Set(blockersOn(map, self).keys());
    blocked.add(`${x},${y}`);
    const cells = walkableCells(project, map, seeds, blocked);
    return all.some((other) => other !== self && other.at.mapId === map.id && !isAdjacentOrOn(cells, other.at.x, other.at.y));
  };
  const reportedMaps = new Set<string>();
  // 이 배치 말고 그 맵에 서 있을 것들: 사건 밖 이벤트 + 다른 사건 배치.
  const othersAt = (map: GameMap, self: Placement): Set<string> => new Set([
    ...map.events.filter((event) => !event.id.startsWith(prefix) && event.id !== self.reuseEventId).map((event) => `${event.x},${event.y}`),
    ...all.filter((other) => other !== self && other.at.mapId === map.id).map((other) => `${other.at.x},${other.at.y}`),
  ]);
  for (const placement of all) {
    const { at, label } = placement;
    const map = project.maps[at.mapId];
    if (!map) {
      push(`${label}: 맵 '${at.mapId}' 가 없습니다.`);
      continue;
    }
    if (!inMapBounds(map, at.x, at.y)) {
      push(`${label}: (${at.x}, ${at.y}) 가 맵 '${map.id}'(${map.width}×${map.height}) 밖입니다.`);
      continue;
    }
    // 시작 맵에서 문·연결로 못 가는 맵은 플레이어가 영영 못 본다(run7 실측: 시작이 빈 기본 맵에 남아 마을로 갈 길이 없었다).
    // 동봉 검증 시나리오는 set 으로 순간이동하므로 이 결함을 가리지 못한다 — 여기서 막는다.
    // 배치 라벨을 붙이면 모델이 그 인물 좌표만 옮기며 헛돈다(run8: 3회) — 맵 단위 문구와 바로 쓸 시작 좌표를 준다.
    if (!reachableMaps.has(map.id) && !reportedMaps.has(map.id)) {
      reportedMaps.add(map.id);
      const onMap = all.filter((other) => other.at.mapId === map.id);
      const anchor = onMap.find((other) => other.kind === "character" && other.label.startsWith("지목 NPC")) ?? onMap[0];
      const occupied = new Set([...map.events.map((event) => `${event.x},${event.y}`), ...onMap.map((other) => `${other.at.x},${other.at.y}`)]);
      const start = nearestFreeCell(project, map, anchor.at, occupied);
      push(`사건 맵 '${map.id}' 은 시작 맵 '${project.startMapId}' 에서 이동(transfer)·연결로 갈 수 없습니다(사건 배치 ${onMap.length}곳). 명세 좌표를 옮겨도 풀리지 않습니다 — 먼저 ${start ? `set_start_position({mapId:"${map.id}", x:${start.x}, y:${start.y}})` : "set_start_position"} 으로 시작 위치를 이 맵에 두거나, 시작 맵에서 이 맵으로 가는 문을 이으세요.`);
    }
    const key = `${map.id}:${at.x},${at.y}`;
    const other = seen.get(key);
    if (other) push(`${label}: ${other} 와 같은 칸 (${at.x}, ${at.y}) 입니다.`);
    seen.set(key, label);
    if (placement.reuseEventId) {
      const reused = map.events.find((event) => event.id === placement.reuseEventId);
      if (!reused) push(`${label}: 재사용할 이벤트 '${placement.reuseEventId}' 가 맵 '${map.id}' 에 없습니다.`);
    }
    const blocker = map.events.find((event) =>
      event.x === at.x && event.y === at.y && !event.id.startsWith(prefix) && event.id !== placement.reuseEventId);
    if (blocker) push(`${label}: (${at.x}, ${at.y}) 에 다른 이벤트 '${blocker.name ?? blocker.id}' 가 이미 있습니다.`);
    const reachable = reachableOn(map);
    const hint = () => {
      const near = nearestUsableCell(project, map, at, placement.kind, reachable, placement.kind === "character" ? chokepointTest(map, placement) : undefined);
      return near ? ` 가까운 후보: (${near.x}, ${near.y}).` : "";
    };
    // 플레이어가 이 칸에 스폰된다 — 인물이 서면 겹쳐 나오고, 조사 지점은 밟고 선 채 시작한다(run5 실측).
    if (isStartCell(project, map, at.x, at.y)) {
      push(`${label}: (${at.x}, ${at.y}) 는 플레이어 시작 위치라 ${placement.kind === "character" ? "인물이 설" : "조사 지점을 둘"} 수 없습니다.${hint()}`);
      continue;
    }
    if (placement.kind === "character" && !isPassable(project, map, at.x, at.y)) {
      push(`${label}: (${at.x}, ${at.y}) 는 통행 불가 칸이라 인물이 설 수 없습니다.${hint()}`);
      continue;
    }
    if (placement.kind === "interaction" && !passableLanding(project, map, at.x, at.y)) {
      push(`${label}: (${at.x}, ${at.y}) 의 상하좌우가 모두 막혀 조사할 수 없습니다.${hint()}`);
      continue;
    }
    // 통행 가능한 옆 칸이 있어도 거기 다른 이벤트(문·주민)가 서 있으면 설 수 없다(run6 실측: 벽 위 단서의 유일한 옆 칸이 집 문).
    if (placement.kind === "interaction" && !interactionStandCell(project, map, at.x, at.y, othersAt(map, placement))) {
      push(`${label}: (${at.x}, ${at.y}) 를 조사할 옆 칸이 모두 다른 이벤트로 막혀 있습니다.${hint()}`);
      continue;
    }
    if (reachable && !isAdjacentOrOn(reachable, at.x, at.y)) {
      const blocker = culpritBlocker(map, at);
      if (blocker) {
        const near = nearestUsableCell(project, map, blocker.at, blocker.kind, reachable, chokepointTest(map, blocker));
        push(`${blocker.label}: (${blocker.at.x}, ${blocker.at.y}) 에 서면 통로를 막아 ${label} (${at.x}, ${at.y}) 에 걸어서 닿을 수 없습니다. 인물은 문간·한 칸 복도가 아닌 방 안에 세우세요.${near ? ` 가까운 후보: (${near.x}, ${near.y}).` : ""}`);
      } else {
        const from = map.id === project.startMapId ? `시작 위치 (${project.startPos.x}, ${project.startPos.y})` : "이 맵의 입구";
        push(`${label}: ${from} 에서 걸어서 닿을 수 없습니다 (${at.x}, ${at.y}) — 벽·물 또는 다른 인물·이벤트가 길을 막습니다.${hint()}`);
      }
    }
  }
}

/** 기준 칸 둘레(반경 4)에서 통행 가능하고 비어 있는 가장 가까운 칸. */
function nearestFreeCell(project: Project, map: GameMap, at: CaseAt, occupied: ReadonlySet<string>): { x: number; y: number } | null {
  for (let radius = 1; radius <= 4; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = at.x + dx;
        const y = at.y + dy;
        if (inMapBounds(map, x, y) && isPassable(project, map, x, y) && !occupied.has(`${x},${y}`)) return { x, y };
      }
    }
  }
  return null;
}

/** 조사 지점에 실제로 설 칸: 상하좌우 또는 발밑 중 통행 가능하고 다른 이벤트가 없는 칸. */
function interactionStandCell(project: Project, map: GameMap, x: number, y: number, occupied: ReadonlySet<string>): { x: number; y: number } | null {
  for (const cell of [{ x, y: y + 1 }, { x, y: y - 1 }, { x: x + 1, y }, { x: x - 1, y }, { x, y }]) {
    if (inMapBounds(map, cell.x, cell.y) && isPassable(project, map, cell.x, cell.y) && !occupied.has(`${cell.x},${cell.y}`)) return cell;
  }
  return null;
}

function isStartCell(project: Project, map: GameMap, x: number, y: number): boolean {
  return map.id === project.startMapId && project.startPos.x === x && project.startPos.y === y;
}

/** 거부 메시지에 붙일 가까운 대체 칸(반경 4). 다른 이벤트가 없고 시작 칸이 아니며, 시작 맵이면 시작 위치에서 닿는 칸. */
function nearestUsableCell(
  project: Project,
  map: GameMap,
  at: CaseAt,
  kind: Placement["kind"],
  reachable: ReadonlySet<string> | null,
  blocksOthers?: (x: number, y: number) => boolean,
): { x: number; y: number } | null {
  const occupied = new Set(map.events.map((event) => `${event.x},${event.y}`));
  for (let radius = 1; radius <= 4; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = at.x + dx;
        const y = at.y + dy;
        if (!inMapBounds(map, x, y) || occupied.has(`${x},${y}`) || isStartCell(project, map, x, y)) continue;
        const usable = kind === "character" ? isPassable(project, map, x, y) : interactionStandCell(project, map, x, y, occupied) !== null;
        if (!usable) continue;
        if (reachable && !isAdjacentOrOn(reachable, x, y)) continue;
        if (blocksOthers?.(x, y)) continue;
        return { x, y };
      }
    }
  }
  return null;
}

// 답을 누설하는 표현. 라벨·단서 이름·지목 NPC 대사에만 적용한다(용의자끼리의 증언은 사건 내용이다).
const LEAK_PATTERNS: readonly RegExp[] = [
  /진범/,
  /범인\s*(은|는|이다|입니다|이야|이군|이었|임)/,
  /[(（[]\s*(정답|범인|진범|답)\s*[)）\]]/,
  /정답/,
  /culprit|murderer|killer|the answer/i,
];
// 이름·라벨에는 「범인」 이라는 낱말 자체가 누설이다(「범인의 찻잔」). 대사에는 「범인을 찾아」 가 자연스러워 위 목록만 쓴다.
const LABEL_LEAK = /범인|진범|정답|culprit|murderer|killer/i;
const ASSERTION = "(?:이|가|은|는|이야|야)?\\s*(?:범인|진범|죽였|살해|독을\\s*(?:넣|탔))";

function nameTokens(name: string): string[] {
  return [name, ...name.split(/\s+/)].filter((token) => token.length >= 2);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function checkLeaks(spec: MysteryCase, problems: MysteryProblem[]): void {
  const culprit = spec.suspects.find((suspect) => suspect.id === spec.culprit);
  const assertions = culprit
    ? nameTokens(culprit.name).map((token) => new RegExp(`${escapeRegExp(token)}${ASSERTION}`))
    : [];
  const surfaces: Array<[string, string, boolean]> = [
    ...spec.suspects.map((suspect) => [`용의자 이름 '${suspect.name}'`, suspect.name, true] as [string, string, boolean]),
    ...spec.clues.map((clue) => [`단서 이름 '${clue.name}'`, clue.name, true] as [string, string, boolean]),
    [`지목 NPC 이름`, spec.accuser.name, true],
    [`지목 선택 문구`, spec.accuser.prompt, false],
    ...[...spec.accuser.intro, ...spec.accuser.hint, ...spec.accuser.ready]
      .map((line) => [`지목 NPC 대사 「${line}」`, line, false] as [string, string, boolean]),
  ];
  for (const [label, value, isLabel] of surfaces) {
    const generic = [...LEAK_PATTERNS, ...(isLabel ? [LABEL_LEAK] : [])].find((pattern) => pattern.test(value));
    const assertion = assertions.find((pattern) => pattern.test(value));
    if (!generic && !assertion) continue;
    problems.push({
      code: "mystery-leak",
      message: `${label} 가 답을 누설합니다(${generic ? `「${value.match(generic)?.[0]}」` : "범인 이름 + 단정"}). 라벨·선택지·지목 NPC 대사에는 이름만 쓰고 정답을 표시하지 마세요.`,
    });
  }
}

function checkOrder(project: Project, spec: MysteryCase, problems: MysteryProblem[]): void {
  // 사건 밖 이벤트가 같은 엔딩을 부르면 증거 게이트를 우회한다(이전 시도의 무조건 진엔딩 NPC 등).
  const endingIds = new Set([spec.endings.solved.id, spec.endings.wrong.id]);
  const owned = new Set([
    ...spec.suspects.flatMap((suspect) => (suspect.eventId ? [suspect.eventId] : [])),
    ...(spec.accuser.eventId ? [spec.accuser.eventId] : []),
  ]);
  const prefix = eventPrefix(spec.caseId);
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      if (event.id.startsWith(prefix) || owned.has(event.id)) continue;
      const hit = eventCommands(event).find((command) =>
        command.kind === "triggerEnding" && command.endingId !== undefined && endingIds.has(command.endingId));
      // 사건 엔딩은 조건 없이 endingId 로만 부르므로, endingId 없는 triggerEnding 은 조건 검사에서 사건 엔딩을 고를 수 있다.
      const bare = eventCommands(event).some((command) => command.kind === "triggerEnding" && command.endingId === undefined);
      if (bare) {
        problems.push({
          code: "mystery-order",
          message: `사건 밖 이벤트 '${event.name ?? event.id}'(${map.id}) 의 endingId 없는 triggerEnding 이 조건 없는 사건 엔딩을 고를 수 있습니다. 그 명령에 endingId 를 지정하세요.`,
        });
      }
      if (hit) {
        problems.push({
          code: "mystery-order",
          message: `사건 밖 이벤트 '${event.name ?? event.id}'(${map.id}) 가 엔딩 '${(hit as { endingId?: string }).endingId}' 를 증거 없이 부릅니다. 그 이벤트를 지우거나 다른 엔딩 id 를 쓰세요.`,
        });
      }
    }
  }
}

function eventCommands(event: GameEvent): Command[] {
  const out: Command[] = [];
  const walk = (list: readonly Command[] | undefined) => {
    for (const command of list ?? []) {
      out.push(command);
      if (command.kind === "choices") {
        for (const option of command.options) walk(option.branch);
        walk(command.cancelBranch);
      } else if (command.kind === "fork") {
        walk(command.then);
        walk(command.else);
      } else if (command.kind === "loop") {
        walk(command.body);
      } else if (command.kind === "presentItem") {
        for (const branch of presentItemBranchLists(command)) walk(branch);
      }
    }
  };
  walk(event.commands);
  for (const page of event.pages ?? []) walk(page.commands);
  return out;
}

// ── 컴파일: 증거 대면·지목 (presentItem 도입 시 여기만 갈아 끼운다) ─────────

export interface EvidenceReaction {
  readonly itemId: string;
  readonly clueName: string;
  readonly lines: readonly string[];
}

/**
 * 「증거를 들이민다」 분기. 사건 증거 전부를 후보로 presentItem 목록을 띄워 플레이어가 고르게 한다 —
 * 가진 증거 중 무엇을 낼지가 추리의 손맛이다. 이 용의자와 상관없는 증거를 내면 otherwiseBranch,
 * 닫거나 아직 가진 증거가 없으면 cancelBranch. 증거는 소모하지 않는다(다른 용의자에게도 내민다).
 */
export function compileEvidencePresentation(input: {
  readonly speaker: string;
  readonly reactions: readonly EvidenceReaction[];
  readonly candidateItemIds: readonly string[];
}): Command[] {
  return [{
    kind: "presentItem",
    prompt: "어떤 증거를 내밀까?",
    itemIds: [...input.candidateItemIds],
    options: input.reactions.map((reaction) => ({
      itemId: reaction.itemId,
      branch: [
        { kind: "text", body: `${withJosa(reaction.clueName, "을/를")} 내밀었다.` },
        ...say(input.speaker, reaction.lines),
      ],
    })),
    otherwiseBranch: say(input.speaker, ["…그게 저와 무슨 상관이죠?"]),
    cancelBranch: [{ kind: "text", body: "보여 줄 만한 증거가 아직 없다." }],
    consume: false,
  }];
}

export interface AccusationInput {
  readonly prompt: string;
  readonly suspects: readonly { readonly id: string; readonly name: string }[];
  readonly culpritId: string;
  readonly solvedEndingId: string;
  readonly wrongEndingId: string;
  readonly solvedLines: readonly string[];
  readonly wrongLines: readonly string[];
  readonly notYetLines: readonly string[];
  readonly speaker: string;
}

/** 지목 선택지. 라벨은 용의자 이름뿐이고, 정답 여부는 분기 안쪽 엔딩으로만 갈린다. */
export function compileAccusationChoice(input: AccusationInput): Extract<Command, { kind: "choices" }> {
  const notYet = say(input.speaker, input.notYetLines);
  return {
    kind: "choices",
    prompt: input.prompt,
    options: [
      ...input.suspects.map((suspect) => {
        const solved = suspect.id === input.culpritId;
        return {
          text: suspect.name,
          branch: [
            ...say(input.speaker, solved ? input.solvedLines : input.wrongLines),
            { kind: "triggerEnding", endingId: solved ? input.solvedEndingId : input.wrongEndingId } as Command,
          ],
        };
      }),
      { text: "아직 모르겠다", branch: notYet },
    ],
    cancelBehavior: "branch",
    cancelBranch: notYet,
  };
}

/** speaker 가 빈 문자열이면 이름표 없는 서술이다(물건인 지목 지점). */
function say(speaker: string, body: readonly string[]): Command[] {
  return body.map((line) => (speaker ? { kind: "text", speaker, body: line } : { kind: "text", body: line }));
}

// 지목 NPC 를 물건으로 지은 경우(manor-mystery 실측 두 번: 「추리 정리 테이블」「사건 정리 수첩」). 기본 주민 외형·얼굴로 그리면
// 수첩이 콧수염 사내 얼굴로 말하고, 한 번은 주인공과 같은 탐정 스프라이트로 서 있었다.
const OBJECT_ACCUSER = /수첩|노트|메모|테이블|탁자|책상|게시판|칠판|보드|일지|장부|서류|기록부|추리판|단서판|table|desk|board|notebook|journal/iu;

export function isObjectAccuser(accuser: Pick<AccuserSpec, "name" | "graphic" | "eventId">): boolean {
  return !accuser.graphic && !accuser.eventId && OBJECT_ACCUSER.test(accuser.name);
}

function evidenceReactions(spec: MysteryCase, suspect: SuspectSpec): EvidenceReaction[] {
  const reactions: EvidenceReaction[] = [];
  const add = (clue: ClueSpec, fallback: readonly string[]) => {
    if (reactions.some((entry) => entry.itemId === mysteryClueItemId(spec.caseId, clue.id))) return;
    const custom = clue.reactions[suspect.id];
    reactions.push({
      itemId: mysteryClueItemId(spec.caseId, clue.id),
      clueName: clue.name,
      lines: custom && custom.length > 0 ? custom : fallback,
    });
  };
  const lieClue = suspect.lie ? spec.clues.find((clue) => clue.id === suspect.lie!.contradictedBy) : undefined;
  if (lieClue && suspect.lie) {
    add(lieClue, ["…알겠습니다. 아까 한 말은 사실이 아니었습니다.", ...suspect.lie.truth]);
  }
  for (const clue of spec.clues) {
    if (clue.reactions[suspect.id]) add(clue, []);
    else if (clue.excludes.includes(suspect.id)) add(clue, [`${withJosa(clue.name, "을/를")} 보면 아시겠지요. 저는 그럴 수 없었습니다.`]);
    else if (clue.implicates.includes(suspect.id)) add(clue, ["그, 그건… 저와는 상관없는 물건입니다!"]);
  }
  return reactions;
}

function interrogationChoice(spec: MysteryCase, suspect: SuspectSpec): Command {
  const alibi = suspect.lie && !suspect.alibi.some((line) => line.includes(suspect.lie!.claim))
    ? [...suspect.alibi, suspect.lie.claim]
    : suspect.alibi;
  const testimonyClues = spec.clues.filter((clue) => clue.obtainedBy === "testimony" && testimonyGiver(spec, clue)?.id === suspect.id);
  const options: { text: string; branch: Command[] }[] = [
    { text: "알리바이를 묻는다", branch: say(suspect.name, alibi) },
    { text: "동기를 묻는다", branch: say(suspect.name, suspect.motive.length > 0 ? suspect.motive : ["그분께 원한 같은 건 없습니다."]) },
  ];
  if (suspect.testimony.length > 0 || testimonyClues.length > 0) {
    options.push({
      text: "증언을 듣는다",
      branch: [
        ...say(suspect.name, suspect.testimony),
        ...testimonyClues.flatMap((clue) => testimonyGrant(spec, suspect, clue)),
      ],
    });
  }
  const reactions = evidenceReactions(spec, suspect);
  if (reactions.length > 0) {
    options.push({ text: "증거를 들이민다", branch: compileEvidencePresentation({ speaker: suspect.name, reactions, candidateItemIds: spec.clues.map((clue) => mysteryClueItemId(spec.caseId, clue.id)) }) });
  }
  options.push({ text: "그만둔다", branch: [] });
  return { kind: "choices", prompt: `${suspect.name}에게 무엇을 묻겠습니까?`, options, cancelBehavior: "branch", cancelBranch: [] };
}

function testimonyGrant(spec: MysteryCase, suspect: SuspectSpec, clue: ClueSpec): Command[] {
  const itemId = mysteryClueItemId(spec.caseId, clue.id);
  return [{
    kind: "fork",
    condition: { kind: "item", itemId, present: true },
    then: [{ kind: "text", body: `(이미 수첩에 적어 둔 이야기다: ${clue.name})` }],
    else: [
      ...say(suspect.name, clue.lines.length > 0 ? clue.lines : [clue.description]),
      { kind: "changeItem", itemId, op: "+=", amount: 1 },
      { kind: "text", body: `${withJosa(clue.name, "을/를")} 수첩에 적었다.` },
    ],
  }];
}

// ── 컴파일: 산출물 쓰기 ─────────────────────────────────────────────────────

function toolByName(tools: readonly ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) throw new ToolError(`내부 툴 '${name}' 을 찾을 수 없습니다.`, { code: "tool-missing" });
  return tool;
}

function upsertEvidenceItems(draft: Project, spec: MysteryCase): string[] {
  const ids: string[] = [];
  for (const clue of spec.clues) {
    const id = mysteryClueItemId(spec.caseId, clue.id);
    const record = normalizeItemRecord({
      id,
      name: clue.name,
      description: `[증거] ${clue.description}`,
      type: "normalGoods",
      scope: "none",
      price: 0,
      consumable: false,
      occasion: "never",
    });
    const index = draft.database.items.findIndex((item) => item.id === id);
    if (index >= 0) draft.database.items[index] = record;
    else draft.database.items.push(record);
    ids.push(id);
  }
  return ids;
}

function defineEndings(draft: Project, spec: MysteryCase, warnings: string[]): void {
  const define = toolByName(ENDING_TOOLS, "define_ending");
  for (const ending of [spec.endings.solved, spec.endings.wrong]) {
    const result = define.run(draft, {
      id: ending.id,
      name: ending.name,
      conditions: [],
      priority: 0,
      ...(ending.epilogue ? { epilogue: ending.epilogue } : {}),
    });
    // 두 엔딩 모두 조건 없이 triggerEnding endingId 로만 부르므로 조건 그림자 경고는 해당 없다.
    warnings.push(...(result.warnings ?? []).filter((warning) => !warning.includes(ending.id)));
  }
}

function removePreviousCaseEvents(draft: Project, spec: MysteryCase): number {
  const prefix = eventPrefix(spec.caseId);
  let removed = 0;
  for (const map of Object.values(draft.maps)) {
    const kept = map.events.filter((event) => !event.id.startsWith(prefix));
    removed += map.events.length - kept.length;
    map.events = kept;
  }
  return removed;
}

function placeExamineClues(draft: Project, spec: MysteryCase, warnings: string[]): string[] {
  const place = toolByName(INVESTIGATION_TOOLS, "place_examine_hotspots");
  const eventIds: string[] = [];
  for (const clue of spec.clues) {
    if (clue.obtainedBy !== "examine" || !clue.at) continue;
    const result = place.run(draft, {
      mapId: clue.at.mapId,
      hotspots: [{
        at: { x: clue.at.x, y: clue.at.y },
        name: clue.name,
        lines: clue.lines.length > 0 ? clue.lines : [clue.description],
        itemId: mysteryClueItemId(spec.caseId, clue.id),
        once: true,
      }],
    });
    const data = result.data as { eventIds?: string[] } | undefined;
    const created = data?.eventIds?.[0];
    if (!created) {
      throw new ToolError(`조사 단서 '${clue.name}' 를 놓지 못했습니다: ${(result.warnings ?? []).join(" / ")}`, {
        code: "mystery-unreachable", mapId: clue.at.mapId, x: clue.at.x, y: clue.at.y,
      });
    }
    const map = draft.maps[clue.at.mapId];
    const event = map.events.find((entry) => entry.id === created)!;
    if (event.x !== clue.at.x || event.y !== clue.at.y) {
      warnings.push(`조사 단서 '${clue.name}' 위치 자동 조정: (${clue.at.x}, ${clue.at.y}) → (${event.x}, ${event.y})`);
    }
    // 사건 소유 id 로 바꿔 두면 재실행 때 통째로 갈아 끼울 수 있다.
    const id = clueEventId(spec, clue);
    event.id = id;
    event.name = clue.name;
    for (const page of event.pages ?? []) page.id = page.id.replace(created, id);
    eventIds.push(id);
  }
  return eventIds;
}

interface Snapshot {
  readonly graphic?: EventPage["graphic"];
  readonly face?: Command;
  readonly schedule?: GameEvent["schedule"];
}

function snapshotReused(map: GameMap, eventId: string | undefined): Snapshot | null {
  if (!eventId) return null;
  const event = map.events.find((entry) => entry.id === eventId);
  if (!event) return null;
  const first = event.pages?.[0];
  return {
    ...(first ? { graphic: structuredClone(first.graphic) } : {}),
    ...(first?.commands.find((command) => command.kind === "changeFace") ? { face: structuredClone(first.commands.find((command) => command.kind === "changeFace")!) } : {}),
    ...(event.schedule ? { schedule: structuredClone(event.schedule) } : {}),
  };
}

function placeCharacter(
  draft: Project,
  input: {
    readonly id: string;
    readonly name: string;
    readonly at: CaseAt;
    readonly graphic?: Record<string, unknown>;
    readonly activity?: string;
    readonly reuse: boolean;
    readonly pages: readonly { readonly name: string; readonly conditions?: readonly EventPageCondition[]; readonly commands: readonly Command[] }[];
  },
  warnings: string[],
): void {
  const map = draft.maps[input.at.mapId];
  const snapshot = input.reuse ? snapshotReused(map, input.id) : null;
  const placeNpc = toolByName(EVENT_TOOLS, "place_npc");
  const result = placeNpc.run(draft, {
    mapId: map.id,
    x: input.at.x,
    y: input.at.y,
    name: input.name,
    id: input.id,
    movement: "fixed",
    ...(input.graphic ? { graphic: input.graphic } : {}),
    pages: input.pages.map((page) => ({
      name: page.name,
      ...(page.conditions ? { conditions: page.conditions } : {}),
      commands: page.commands,
    })),
  });
  // 재사용 주민은 아래에서 자리·외형을 되돌리므로 place_npc 의 위치 조정·기본 외형 경고는 사실이 아니다.
  const stale = snapshot ? ["병합 →", "근접 유사 NPC", "위치 자동 조정", "graphic 생략"] : ["병합 →", "근접 유사 NPC"];
  warnings.push(...(result.warnings ?? []).filter((warning) => !stale.some((marker) => warning.includes(marker))));
  const event = map.events.find((entry) => entry.id === input.id);
  if (!event) throw new ToolError(`'${input.name}' 이벤트를 만들지 못했습니다.`, { code: "mystery-place-failed", mapId: map.id });
  if (snapshot) {
    // 재사용 주민: 외형·얼굴은 원래 것, 자리는 사건 위치, 시간표는 사건 당일용으로.
    event.x = input.at.x;
    event.y = input.at.y;
    for (const page of event.pages ?? []) {
      if (snapshot.graphic) page.graphic = structuredClone(snapshot.graphic);
      if (snapshot.face) {
        const index = page.commands.findIndex((command) => command.kind === "changeFace");
        if (index >= 0) page.commands[index] = structuredClone(snapshot.face);
      }
    }
    const previous = (snapshot.schedule ?? []).map((entry) => entry.activity ?? `(${entry.at.x}, ${entry.at.y})`);
    if (input.activity) {
      event.schedule = [{ when: {}, at: { mapId: map.id, x: input.at.x, y: input.at.y }, activity: input.activity }];
    } else {
      delete event.schedule;
    }
    if (previous.length > 0) {
      warnings.push(`'${input.name}' 시간표 ${previous.length}개(${previous.join(", ")})를 사건 당일용으로 ${input.activity ? `「${input.activity}」 하나로 바꿨습니다` : "비웠습니다"}.`);
    }
  } else if (input.activity) {
    event.schedule = [{ when: {}, at: { mapId: map.id, x: input.at.x, y: input.at.y }, activity: input.activity }];
  }
  if (event.x !== input.at.x || event.y !== input.at.y) {
    warnings.push(`'${input.name}' 위치 자동 조정: (${input.at.x}, ${input.at.y}) → (${event.x}, ${event.y})`);
  }
}

function placeSuspects(draft: Project, spec: MysteryCase, warnings: string[]): string[] {
  return spec.suspects.map((suspect) => {
    const id = suspectEventId(spec, suspect);
    placeCharacter(draft, {
      id,
      name: suspect.name,
      at: suspect.at,
      ...(suspect.graphic ? { graphic: suspect.graphic } : {}),
      ...(suspect.activity ? { activity: suspect.activity } : {}),
      reuse: suspect.eventId !== undefined,
      pages: [{
        name: `${suspect.name} 탐문`,
        commands: [
          ...say(suspect.name, suspect.greeting.length > 0 ? suspect.greeting : ["무슨 일로 오셨습니까?"]),
          interrogationChoice(spec, suspect),
        ],
      }],
    }, warnings);
    return id;
  });
}

function placeAccuser(draft: Project, spec: MysteryCase, warnings: string[]): string {
  const { accuser } = spec;
  const id = accuserEventId(spec);
  const requiredConditions: EventPageCondition[] = spec.requiredClues.map((clueId) => ({
    kind: "item",
    itemId: mysteryClueItemId(spec.caseId, clueId),
    present: true,
  }));
  const object = isObjectAccuser(accuser);
  const voice = object ? "" : accuser.name;
  const warningsBefore = warnings.length;
  placeCharacter(draft, {
    id,
    name: accuser.name,
    at: accuser.at,
    ...(accuser.graphic ? { graphic: accuser.graphic } : {}),
    reuse: accuser.eventId !== undefined,
    pages: [
      // 1페이지: 필수 증거 미확보 — 힌트만. 엔딩 명령을 두지 않는다.
      { name: "증거 부족", commands: say(voice, [...accuser.intro, ...accuser.hint]) },
      // 2페이지(뒤 페이지 우선): 필수 증거를 모두 가졌을 때만 지목.
      {
        name: "범인 지목",
        conditions: requiredConditions,
        commands: [
          ...say(voice, accuser.ready),
          compileAccusationChoice({
            prompt: accuser.prompt,
            suspects: spec.suspects,
            culpritId: spec.culprit,
            solvedEndingId: spec.endings.solved.id,
            wrongEndingId: spec.endings.wrong.id,
            solvedLines: spec.endings.solved.lines,
            wrongLines: spec.endings.wrong.lines,
            notYetLines: [object ? "아직 확신이 서지 않는다." : "확신이 서면 다시 오게."],
            speaker: voice,
          }),
        ],
      },
    ],
  }, warnings);
  if (object) {
    const own = warnings.splice(warningsBefore);
    warnings.push(...own.filter((warning) => !warning.includes("graphic 생략")));
    // 물건: 보이지 않는 조사 지점처럼 두고(통행은 막아 가구처럼), 얼굴·이름표 없이 서술로 말한다.
    const event = draft.maps[accuser.at.mapId]?.events.find((entry) => entry.id === id);
    for (const page of event?.pages ?? []) {
      page.graphic = { transparent: true };
      page.commands = page.commands.filter((command) => command.kind !== "changeFace");
    }
    warnings.push(`지목 NPC '${accuser.name}' 는 물건이라 사람 외형 없이 보이지 않는 조사 지점(얼굴·이름표 없는 서술)으로 두었다 — 탁자·책상 같은 가구 타일 위(${accuser.at.x}, ${accuser.at.y})에 있어야 플레이어가 찾는다. 사람이 추리를 듣게 하려면 accuser.name 을 인물(경감·집사 등)로 하거나 graphic 을 주어라.`);
  }
  return id;
}

/** 컴파일 사후 검사: 엔딩을 부르는 사건 페이지는 모두 필수 증거 전부를 조건으로 가져야 한다. */
function assertEndingsGated(draft: Project, spec: MysteryCase, eventIds: readonly string[]): void {
  const required = new Set(spec.requiredClues.map((clueId) => mysteryClueItemId(spec.caseId, clueId)));
  const ids = new Set(eventIds);
  for (const map of Object.values(draft.maps)) {
    for (const event of map.events) {
      if (!ids.has(event.id)) continue;
      if (eventCommands({ ...event, pages: [] }).some((command) => command.kind === "triggerEnding")) {
        throw new ToolError(`'${event.name ?? event.id}' 의 조건 없는 본문에 엔딩이 있습니다.`, { code: "mystery-order" });
      }
      for (const page of event.pages ?? []) {
        if (!eventCommands({ ...event, commands: [], pages: [page] }).some((command) => command.kind === "triggerEnding")) continue;
        const held = new Set(page.conditions.flatMap((condition) =>
          condition.kind === "item" && condition.present ? [condition.itemId] : []));
        const missing = [...required].filter((itemId) => !held.has(itemId));
        if (missing.length > 0) {
          throw new ToolError(`'${event.name ?? event.id}' 페이지 '${page.name}' 가 증거 ${missing.join(", ")} 없이 엔딩에 닿습니다.`, { code: "mystery-order" });
        }
      }
    }
  }
}

// ── 동봉 검증 시나리오 ───────────────────────────────────────────────────────
// 실측(run5): 성공 요약만 보고 모델이 run_scene_test 입력을 손으로 짜다 7번 헛돌았다
// (좌표 형식, 증언은 탐문 선택지를 골라야 얻는다는 점, 지목 페이지 선택지 위치).
// 컴파일된 이벤트에서 직접 뽑은, 그대로 넣으면 끝까지 도는 입력을 돌려준다.

const TALK_WAIT: SceneStep = { kind: "wait", ticks: 400 };
// 이벤트 쪽을 보게 되는 인접 칸(아래·위·왼쪽·오른쪽 순).
const APPROACH: readonly { readonly dx: number; readonly dy: number; readonly facing: "up" | "down" | "left" | "right" }[] = [
  { dx: 0, dy: 1, facing: "up" }, { dx: 0, dy: -1, facing: "down" }, { dx: -1, dy: 0, facing: "right" }, { dx: 1, dy: 0, facing: "left" },
];

function locateEvent(draft: Project, eventId: string): { map: GameMap; event: GameEvent } {
  for (const map of Object.values(draft.maps)) {
    const event = map.events.find((entry) => entry.id === eventId);
    if (event) return { map, event };
  }
  throw new ToolError(`검증 시나리오: 이벤트 '${eventId}' 를 찾지 못했습니다.`, { code: "mystery-place-failed" });
}

/**
 * 이벤트 옆 칸으로 순간이동(set)해 마주 보고(face) 말을 건다. 시간표가 인물을 옮길 수 있어 걷기 대신 set 을 쓴다 —
 * 사건 인물의 시간표는 사건 자리에 고정되므로(placeCharacter) 컴파일 직후 좌표가 곧 실행 좌표다.
 * 방향은 set.facing 이 아니라 따로 face 스텝으로 준다 — 재실행(run6)에서 모델이 시나리오를 옮겨 적으며 set.facing 만 빠뜨려
 * 엉뚱한 칸을 조사했다. 옆 칸이 없으면 던지고, 호출부가 경고로 바꾼다(검사기가 먼저 거부해야 할 경우다).
 */
function talkSteps(draft: Project, eventId: string, reachable: (map: GameMap) => ReadonlySet<string> | null): SceneStep[] {
  const { map, event } = locateEvent(draft, eventId);
  const cells = reachable(map);
  const occupied = new Set(map.events.filter((entry) => entry.id !== event.id).map((entry) => `${entry.x},${entry.y}`));
  const free = (x: number, y: number) => inMapBounds(map, x, y) && isPassable(draft, map, x, y) && !occupied.has(`${x},${y}`);
  const usable = APPROACH.map(({ dx, dy, facing }) => ({ x: event.x + dx, y: event.y + dy, facing })).filter(({ x, y }) => free(x, y));
  const spot = usable.find(({ x, y }) => !cells || cells.has(`${x},${y}`)) ?? usable[0];
  if (!spot) throw new ToolError(`검증 시나리오: '${event.name ?? event.id}' 옆에 설 칸이 없습니다.`, { code: "mystery-unreachable", mapId: map.id, x: event.x, y: event.y });
  return [
    { kind: "set", mapId: map.id, x: spot.x, y: spot.y },
    { kind: "face", dir: spot.facing },
    { kind: "interact", eventId: event.id },
    TALK_WAIT,
  ];
}

function choiceIndex(event: GameEvent, pageName: string | null, pick: (option: { text: string; branch: readonly Command[] }) => boolean): number {
  const pages = (event.pages ?? []).filter((page) => pageName === null || page.name === pageName);
  for (const page of pages) {
    const choices = page.commands.find((command): command is Extract<Command, { kind: "choices" }> => command.kind === "choices");
    const index = choices?.options.findIndex(pick) ?? -1;
    if (index >= 0) return index;
  }
  throw new ToolError(`검증 시나리오: '${event.name ?? event.id}' 에서 고를 선택지를 찾지 못했습니다.`, { code: "mystery-place-failed" });
}

function buildVerificationScene(
  draft: Project,
  spec: MysteryCase,
  ids: { readonly clueEvents: readonly string[]; readonly suspectEvents: readonly string[]; readonly accuserEvent: string },
): SceneTestInput {
  const reachableByMap = new Map<string, Set<string>>();
  const reachable = (map: GameMap): ReadonlySet<string> | null => {
    if (map.id !== draft.startMapId) return null;
    if (!reachableByMap.has(map.id)) reachableByMap.set(map.id, computeReachableCells(draft, map, draft.startPos.x, draft.startPos.y));
    return reachableByMap.get(map.id)!;
  };
  const suspectEvent = new Map(spec.suspects.map((suspect, index) => [suspect.id, ids.suspectEvents[index]]));
  const steps: SceneStep[] = [];
  // 1) 조사 지점: 옆에 서서 조사.
  for (const eventId of ids.clueEvents) steps.push(...talkSteps(draft, eventId, reachable));
  // 2) 증언 단서: 준 용의자에게 말을 걸고 「증언을 듣는다」. 한 사람의 증언은 한 분기에서 모두 받는다.
  const testifiers = new Set(spec.clues.filter((clue) => clue.obtainedBy === "testimony").flatMap((clue) => testimonyGiver(spec, clue)?.id ?? []));
  for (const suspectId of testifiers) {
    const eventId = suspectEvent.get(suspectId)!;
    const { event } = locateEvent(draft, eventId);
    steps.push(...talkSteps(draft, eventId, reachable), { kind: "choose", index: choiceIndex(event, null, (option) => option.text === "증언을 듣는다") }, TALK_WAIT);
  }
  steps.push({ kind: "expect", inventoryCount: Object.fromEntries(spec.clues.map((clue) => [mysteryClueItemId(spec.caseId, clue.id), 1])) });
  // 3) 증거 대면 예시 한 번: 거짓말을 무너뜨리는 증거가 있으면 그것, 없으면 첫 반응 증거.
  const presented = spec.suspects
    .map((suspect) => ({ suspect, reactions: evidenceReactions(spec, suspect) }))
    .filter((entry) => entry.reactions.length > 0)
    .sort((a, b) => Number(Boolean(b.suspect.lie)) - Number(Boolean(a.suspect.lie)))[0];
  if (presented) {
    const eventId = suspectEvent.get(presented.suspect.id)!;
    const { event } = locateEvent(draft, eventId);
    steps.push(
      ...talkSteps(draft, eventId, reachable),
      { kind: "choose", index: choiceIndex(event, null, (option) => option.text === "증거를 들이민다") }, TALK_WAIT,
      { kind: "present", itemId: presented.reactions[0].itemId }, { kind: "wait", ticks: 1200 },
    );
  }
  // 4) 지목: 필수 증거를 모두 가졌으니 2페이지(범인 지목)가 뜬다. 정답(범인) 선택지를 고른다.
  const { event: accuser } = locateEvent(draft, ids.accuserEvent);
  const solvedIndex = choiceIndex(accuser, "범인 지목", (option) =>
    option.branch.some((command) => command.kind === "triggerEnding" && command.endingId === spec.endings.solved.id));
  steps.push(
    ...talkSteps(draft, ids.accuserEvent, reachable),
    { kind: "choose", index: solvedIndex }, { kind: "wait", ticks: 1500 },
    { kind: "expect", endingReached: spec.endings.solved.id },
  );
  return { mapId: draft.startMapId, start: { x: draft.startPos.x, y: draft.startPos.y }, steps };
}

/** 벽·가구(통행 불가 칸)가 이 비율보다 적으면 「무대 없음」 으로 본다. 지은 실내는 30~65%, 맨땅 판은 0~1% 였다. */
const BARREN_STAGE_BLOCKED_RATIO = 0.05;

/**
 * 사건 무대가 맨땅인가. manor-mystery 에서 두 판(헤드리스·브라우저)이 「저택 1층(서재·거실·주방)」 을
 * 빈 시작 맵 위 나무 바닥 사각형·흙길로 흉내 내고 인물을 세웠다 — 벽도 가구도 없고 실내에 비가 내렸다.
 * 게이트가 아니라 경고다: 저작은 그대로 두고 무대를 지을 도구를 짚는다.
 */
function barrenStageWarnings(draft: Project, spec: MysteryCase): string[] {
  const mapIds = new Set(placements(spec).map((placement) => placement.at.mapId));
  const out: string[] = [];
  for (const mapId of mapIds) {
    const map = draft.maps[mapId];
    if (!map) continue;
    let blocked = 0;
    for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) if (!isPassable(draft, map, x, y)) blocked += 1;
    const ratio = blocked / Math.max(1, map.width * map.height);
    if (ratio >= BARREN_STAGE_BLOCKED_RATIO) continue;
    out.push(`사건 무대 '${map.name ?? map.id}'(${map.id}) 에 벽·가구가 거의 없습니다(통행 불가 ${(ratio * 100).toFixed(1)}%) — 방·건물 없이 맨땅 위에 인물과 조사 지점만 서 있습니다. `
      + `저택·여관 같은 실내 장면이면 place_concept(plan, 새 mapId) 로 방을 나눈 실내를, 외장과 함께면 author_house(interior:"linked-interior") 로 짓고, `
      + `그 맵 좌표로 author_mystery_case 를 다시 불러 사건을 옮기세요(같은 caseId 면 이벤트를 갈아 끼웁니다). 바닥 타일 fill_region 으로 방을 흉내 내지 마세요.`);
  }
  return out;
}

function compileMysteryCase(draft: Project, spec: MysteryCase): ToolExecResult {
  const warnings: string[] = [];
  const removed = removePreviousCaseEvents(draft, spec);
  const itemIds = upsertEvidenceItems(draft, spec);
  defineEndings(draft, spec, warnings);
  const clueEvents = placeExamineClues(draft, spec, warnings);
  const suspectEvents = placeSuspects(draft, spec, warnings);
  const accuserEvent = placeAccuser(draft, spec, warnings);
  assertEndingsGated(draft, spec, [...clueEvents, ...suspectEvents, accuserEvent]);
  warnings.push(...barrenStageWarnings(draft, spec));
  const culprit = spec.suspects.find((suspect) => suspect.id === spec.culprit)!;
  // 시나리오는 검증 보조물이다 — 못 만들어도 저작은 성공시키고 사유를 경고로 남긴다(run6: 여기서 던져 저작 전체가 실패했다).
  let verificationScene: SceneTestInput | null = null;
  try {
    verificationScene = buildVerificationScene(draft, spec, { clueEvents, suspectEvents, accuserEvent });
  } catch (error) {
    if (!(error instanceof ToolError)) throw error;
    warnings.push(`${error.message} — data.verificationScene 없이 저작했습니다. run_scene_test 입력을 직접 짜라.`);
  }
  return {
    summary: `추리 사건 '${spec.title}' 저작 — 용의자 ${spec.suspects.length}명, 증거 ${itemIds.length}개(필수 ${spec.requiredClues.length}), 조사 지점 ${clueEvents.length}곳, 지목 NPC '${spec.accuser.name}', 엔딩 2개${removed > 0 ? ` (이전 사건 이벤트 ${removed}개 교체)` : ""}. ${verificationScene
      ? `data.verificationScene 을 고치지 말고 그대로 run_scene_test 에 넣어 증거 수집 → 증거 대면 → 지목을 플레이 검증하라(스텝 ${verificationScene.steps.length}개, 기대 엔딩 ${spec.endings.solved.id}). 저작 뒤 시간표·배치로 사건 인물을 옮겼다면 다시 author_mystery_case 로 시나리오를 새로 받아라.`
      : "run_scene_test 로 증거 수집 → 지목을 플레이 검증하라."}`,
    data: {
      caseId: spec.caseId,
      culprit: culprit.id,
      evidenceItemIds: itemIds,
      requiredEvidenceItemIds: spec.requiredClues.map((clueId) => mysteryClueItemId(spec.caseId, clueId)),
      clueEventIds: clueEvents,
      suspectEventIds: suspectEvents,
      accuserEventId: accuserEvent,
      endings: { solved: spec.endings.solved.id, wrong: spec.endings.wrong.id },
      ...(verificationScene ? { verificationScene } : {}),
    },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

// ── 툴 정의 ─────────────────────────────────────────────────────────────────

const AT_SCHEMA: JsonSchema = {
  type: "object",
  description: "{mapId,x,y}",
  properties: { mapId: { type: "string" }, x: { type: "integer" }, y: { type: "integer" } },
  required: ["mapId", "x", "y"],
};
const LINES_SCHEMA: JsonSchema = { type: "array", items: { type: "string" } };
const ENDING_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    lines: LINES_SCHEMA,
    epilogue: { type: "array", items: CUTSCENE_BEAT_SCHEMA },
  },
};

const CASE_PARAMETERS: JsonSchema = {
  type: "object",
  properties: {
    caseId: { type: "string", description: "영문·숫자·_. 같은 id 재호출은 갈아 끼운다" },
    title: { type: "string" },
    victim: {
      type: "object",
      description: "{name,description?}",
      properties: { name: { type: "string" }, description: { type: "string" } },
      required: ["name"],
    },
    culprit: { type: "string", description: "범인 용의자 id" },
    suspects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          at: AT_SCHEMA,
          eventId: { type: "string", description: "기존 주민 재사용" },
          graphic: GRAPHIC_SPEC_SCHEMA,
          greeting: LINES_SCHEMA,
          alibi: LINES_SCHEMA,
          motive: LINES_SCHEMA,
          testimony: LINES_SCHEMA,
          activity: { type: "string", description: "사건 당일 활동(생략 시 시간표 비움)" },
          lie: {
            type: "object",
            properties: { claim: { type: "string" }, contradictedBy: { type: "string" }, truth: LINES_SCHEMA },
            required: ["claim", "contradictedBy"],
          },
        },
        required: ["id", "name", "at", "alibi", "motive"],
      },
    },
    clues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          at: AT_SCHEMA,
          description: { type: "string" },
          obtainedBy: { type: "string", enum: ["examine", "testimony"] },
          givenBy: { type: "string", description: "증언 용의자 id" },
          implicates: { type: "array", items: { type: "string" } },
          excludes: { type: "array", items: { type: "string" } },
          lines: LINES_SCHEMA,
          reactions: { type: "object", description: "{용의자id:[대면 대사]}" },
        },
        required: ["id", "name", "description", "obtainedBy"],
      },
    },
    accuser: {
      type: "object",
      properties: {
        name: { type: "string" },
        at: AT_SCHEMA,
        eventId: { type: "string" },
        graphic: GRAPHIC_SPEC_SCHEMA,
        intro: LINES_SCHEMA,
        hint: LINES_SCHEMA,
        ready: LINES_SCHEMA,
        prompt: { type: "string" },
      },
      required: ["name", "at"],
    },
    endings: {
      type: "object",
      description: "{solved,wrong}",
      properties: { solved: ENDING_SCHEMA, wrong: ENDING_SCHEMA },
    },
    requiredClues: { type: "array", items: { type: "string" }, description: "생략 시 범인 특정에 필요한 단서 전부" },
  },
  required: ["caseId", "victim", "culprit", "suspects", "clues", "accuser"],
};

// 검사 툴은 얕은 스키마로 노출한다(깊은 스키마 두 벌은 카탈로그 예산을 두 배로 쓴다). 파서는 같다.
const CHECK_PARAMETERS: JsonSchema = {
  type: "object",
  description: "author_mystery_case 와 같은 인자",
  properties: {
    caseId: { type: "string" },
    title: { type: "string" },
    victim: { type: "object" },
    culprit: { type: "string" },
    suspects: { type: "array", items: { type: "object" } },
    clues: { type: "array", items: { type: "object" } },
    accuser: { type: "object" },
    endings: { type: "object" },
    requiredClues: { type: "array", items: { type: "string" } },
  },
  required: ["caseId", "victim", "culprit", "suspects", "clues", "accuser"],
};

const CASE_EXAMPLE: Record<string, unknown> = {
  caseId: "manor",
  victim: { name: "바론" },
  culprit: "butler",
  suspects: [
    { id: "butler", name: "집사 토마스", at: { mapId: "town", x: 5, y: 5 }, alibi: ["부엌에 있었습니다."], motive: ["퇴직금 문제로 다퉜습니다."], lie: { claim: "찻잔은 만지지 않았습니다.", contradictedBy: "teacup" } },
    { id: "elena", name: "약초상 엘레나", at: { mapId: "town", x: 9, y: 5 }, alibi: ["약방에 있었어요."], motive: ["임대료 때문에요."] },
  ],
  clues: [
    { id: "teacup", name: "독이 남은 찻잔", at: { mapId: "town", x: 6, y: 9 }, description: "집사의 은쟁반 위 찻잔에 가루가 남았다.", implicates: ["butler"], obtainedBy: "examine" },
    { id: "receipt", name: "약방 영수증", at: { mapId: "town", x: 10, y: 9 }, description: "사건 시각 엘레나가 약방에서 쓴 영수증.", excludes: ["elena"], obtainedBy: "examine" },
  ],
  accuser: { name: "경비대장", at: { mapId: "town", x: 7, y: 3 } },
  endings: { solved: { name: "사건 해결" }, wrong: { name: "미궁" } },
};

const CHECK_RULES =
  "검사: ①특정 가능성 — 필수 단서만으로 범인만 남아야 한다(범인은 implicates 또는 거짓말 반박 1개 이상, 비범인은 각자 excludes 또는 거짓말 반박으로 배제, 범인을 excludes 하면 모순) " +
  "②도달 가능성 — 좌표가 맵 안·인접 통행 가능·다른 이벤트와 겹치지 않고 시작 맵이면 시작 위치에서 걸어서 닿음, 증언 단서는 givenBy 용의자 탐문으로 획득 " +
  "③누설 — 용의자·단서 이름, 지목 NPC 대사·선택 문구에 「진범/범인은/(정답)/culprit」 류나 범인 이름+단정 금지 " +
  "④순서 — 필수 단서 0개 금지, 사건 밖 이벤트가 같은 엔딩을 부르면 거부.";

const authorMysteryCase: ToolDefinition = {
  name: "author_mystery_case",
  description:
    "추리/살인사건/탐정 게임은 author_mystery_case 로 만든다(place_examine_hotspots·place_npc·define_ending 을 따로 조립하지 말 것). " +
    "사건 무대(저택·여관 실내 등)가 아직 없으면 먼저 place_concept·author_house 로 방이 있는 맵을 짓고 그 좌표로 명세를 쓴다. " +
    "사건 명세 하나로 증거 아이템(스위치 없음)·한 번만 주는 조사 지점·용의자 탐문(알리바이/동기/증언/증거 대면)·" +
    "지목 NPC(증거 부족=힌트, 필수 증거 전부=이름 목록→solved/wrong 엔딩)를 컴파일한다. 기존 주민은 suspects[].eventId 로 재사용(시간표 정리). " +
    "쓰기 전 check_mystery_case 규칙으로 검사해 범인 특정 불가·누설·도달 불가·증거 없는 엔딩을 사유와 함께 거부한다. 저작 결과 data.verificationScene(끝까지 도는 run_scene_test 입력)을 그대로 run_scene_test 에 넣어 플레이 검증.",
  mode: "write",
  parameters: CASE_PARAMETERS,
  invalidArgsExample: CASE_EXAMPLE,
  run(draft, args): ToolExecResult {
    const spec = parseMysteryCase(args);
    const problems = checkMysteryCase(draft, spec);
    if (problems.length > 0) {
      throw new ToolError(
        `추리 사건 '${spec.title}' 검사 실패 ${problems.length}건 — ${problems.map((problem) => `[${problem.code}] ${problem.message}`).join(" / ")}`,
        { code: problems[0].code },
      );
    }
    return compileMysteryCase(draft, spec);
  },
};

const checkMysteryCaseTool: ToolDefinition = {
  name: "check_mystery_case",
  description:
    "author_mystery_case 와 같은 사건 명세를 쓰지 않고 검사만 한다(읽기). 결과 data={ok,problems:[{code,message}],requiredClues}. " +
    CHECK_RULES,
  mode: "read",
  parameters: CHECK_PARAMETERS,
  invalidArgsExample: CASE_EXAMPLE,
  run(project, args): ToolExecResult {
    const spec = parseMysteryCase(args);
    const problems = checkMysteryCase(project, spec);
    return {
      summary: problems.length === 0
        ? `추리 사건 '${spec.title}' 검사 통과 — 필수 단서 ${spec.requiredClues.length}개로 범인만 남습니다.`
        : `추리 사건 '${spec.title}' 검사 실패 ${problems.length}건: ${problems.map((problem) => problem.message).join(" / ")}`,
      data: { ok: problems.length === 0, problems, requiredClues: [...spec.requiredClues] },
    };
  },
};

export const MYSTERY_CASE_TOOLS: readonly ToolDefinition[] = [authorMysteryCase, checkMysteryCaseTool];
