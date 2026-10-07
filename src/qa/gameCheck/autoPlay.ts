// 자동 플레이 — 엔딩에서 거꾸로 사슬을 만들고(엔딩 ← 그 페이지를 여는 스위치 ← 그 스위치를 켜는 이벤트 ← …),
// 실제 헤드리스 런타임(`testing/sceneTestRunner.runSceneTest`, run_scene_test 도구와 같은 엔진)으로 걸어서 실행한다.
//
// 걷기는 런타임의 충돌 판정으로 BFS 하고, 전투는 러너가 결정적으로 푼다(seed 1, 첫 적을 계속 공격),
// 선택지는 목표 명령이 든 보기를 고른다. 처음 실패한 목표를 맵·이벤트·명령 자리와 함께 보고한다.
//
// 러너는 매번 새 세션으로 처음부터 돈다 — 목표 하나를 붙일 때마다 누적 단계 전체를 다시 돌린다(작은 게임이면 수 초).

import { canMove } from "@/project/collision";
import { resolveEventPage } from "@/project/io";
import { evalCondition, type PlaySession } from "@/project/session";
import type { Condition, GameEvent, Project } from "@/project/types";
import { runSceneTest, type SceneStep, type SceneTestResult } from "@/testing/sceneTestRunner";
import { numberInputAnswer } from "@/testing/numberInputAnswer";
import { initiallyOn } from "./progression";
import { runtimeMap } from "@/project/runtimeMap";
import { eligibleEncounterEntries } from "@/player/encounters";
import { slideRuleAt } from "@/project/slideTiles";
import { getSessionCheckpoint, setSessionCheckpoint } from "@/player/checkpoints";
import { monsterCurrentHp, monsterMaxHp, rejectPendingMonsterSkill, replacePendingMonsterSkill } from "@/project/monsterCollection";
import { allPages, childLists, conditionLeaves, visitPageCommands, type CommandVisit, type PageRef, type RawCommand } from "./walk";
import type { AutoPlayReport, AutoPlayRun, AutoPlayStepTrace, CommandWhere } from "./types";

type Requirement =
  | { readonly kind: "switch"; readonly id: string }
  | { readonly kind: "selfSwitch"; readonly mapId: string; readonly eventId: string; readonly key: string }
  /** op/value 가 있으면 «그 값에 이르기» — 호감도 ≥ 6 처럼 한 번에 안 되는 문턱이다. */
  | { readonly kind: "variable"; readonly id: string; readonly op?: string; readonly value?: number }
  | { readonly kind: "item"; readonly id: string }
  | { readonly kind: "actor"; readonly id: string }
  /** 이 맵에 들어가기 — 들어가는 문이 전부 조건부일 때만 생긴다(기억을 차례로 여는 회상 스토리의 문). */
  | { readonly kind: "map"; readonly id: string };

interface Goal {
  readonly label: string;
  readonly visit: CommandVisit;
  /** 이 목표가 끝났는지 세션으로 확인한다. 없으면 «실패 없이 이벤트가 돌았다» 로 본다. */
  readonly done?: (session: PlaySession, result: SceneTestResult) => boolean;
  readonly verify?: (session: PlaySession, result: SceneTestResult) => string | null;
  /** 검증이 실패해도 기록만 하고 다음 목표로 간다 — 뒤에서 무엇이 터지는지까지 보여 준다. */
  readonly soft?: boolean;
  /**
   * 한 번으로 done 이 안 되면 되풀이한다(하루 한 번 만나 호감 +2, 자고 다음 날 또). resets 는 세터 페이지를 다시 여는
   * 목표들(「오늘 만남 끝」 스위치를 끄는 침대) — 차례로 돌린 뒤 세터를 다시 부른다.
   */
  readonly repeat?: { readonly resets: readonly Goal[]; readonly max: number };
  /** 같은 맵에서 같은 조건을 채우는 다른 세터 — 고른 세터 칸까지 걸어갈 길이 없으면 차례로 시도한다(워프 판 여럿이 같은 스위치를 켠다). */
  readonly alternatives?: readonly CommandVisit[];
}

function requirementLabel(project: Project, req: Requirement): string {
  switch (req.kind) {
    case "switch": return `스위치 ${project.switches.find((s) => s.id === req.id)?.name || req.id}`;
    case "selfSwitch": return `셀프 스위치 ${req.eventId}.${req.key}`;
    case "variable": return `변수 ${project.variables.find((v) => v.id === req.id)?.name || req.id}${req.op && req.value !== undefined ? ` ${req.op} ${req.value}` : ""}`;
    case "item": return `아이템 ${req.id}`;
    case "actor": return `배우 ${req.id} 합류`;
    case "map": return `맵 ${project.maps[req.id]?.name ?? req.id} 진입`;
  }
}

function leafRequirements(condition: unknown, page: PageRef): Requirement[] {
  const out: Requirement[] = [];
  const top = condition as { kind?: string; conditions?: unknown[] } | null;
  // any 는 첫 잎만 요구한다 — 하나면 충분하다. not 은 요구로 바꾸지 않는다.
  const leaves = top?.kind === "any" ? conditionLeaves(top.conditions?.[0]) : top?.kind === "not" ? [] : conditionLeaves(condition);
  for (const leaf of leaves) {
    if (leaf.kind === "switch" && leaf.value === true && typeof leaf.switchId === "string") out.push({ kind: "switch", id: leaf.switchId });
    if (leaf.kind === "selfSwitch" && leaf.value === true && page.map && page.event) out.push({ kind: "selfSwitch", mapId: page.map.id, eventId: page.event.id, key: String(leaf.key) });
    if (leaf.kind === "variable" && typeof leaf.variableId === "string") {
      out.push(typeof leaf.op === "string" && typeof leaf.value === "number"
        ? { kind: "variable", id: leaf.variableId, op: leaf.op, value: leaf.value }
        : { kind: "variable", id: leaf.variableId });
    }
    if (leaf.kind === "item" && leaf.present === true && typeof leaf.itemId === "string") out.push({ kind: "item", id: leaf.itemId });
    if (leaf.kind === "actor" && leaf.present === true && typeof leaf.actorId === "string") out.push({ kind: "actor", id: leaf.actorId });
  }
  return out;
}

/** 문(transfer)으로 들어가는 방문 목록 — 맵 id → 그 맵으로 옮기는 명령들. */
const entryCache = new WeakMap<Project, Map<string, CommandVisit[]>>();
function entriesInto(project: Project, mapId: string): readonly CommandVisit[] {
  let byMap = entryCache.get(project);
  if (!byMap) {
    byMap = new Map();
    for (const page of allPages(project)) {
      if (!page.map || !page.event) continue;
      visitPageCommands(page, (visit) => {
        const c = visit.command;
        if (c.kind === "transfer" && typeof c.mapId === "string" && c.mapId !== page.map!.id) {
          const list = byMap!.get(c.mapId) ?? [];
          list.push(visit);
          byMap!.set(c.mapId, list);
        }
      });
    }
    entryCache.set(project, byMap);
  }
  return byMap.get(mapId) ?? [];
}

const gatedCache = new WeakMap<Project, Map<string, boolean>>();

/**
 * 맵이 「잠겨」 있는가 — 시작 맵이 아니고, 조건 없이 열리는 문(그 문이 있는 맵도 안 잠김)이 하나도 없다.
 * 잠긴 맵의 목표는 그 맵으로 들어가는 문을 먼저 여는 사슬이 필요하다. 없던 때는 두 번째 기억부터
 * 「가는 문이 (현재 스위치 상태로는) 없습니다」로 오판했다(2026-09-24 회상 스토리 도그푸딩).
 */
function mapGated(project: Project, mapId: string, visiting = new Set<string>()): boolean {
  if (mapId === project.startMapId) return false;
  // 맨 바깥 질문의 답만 기억한다 — 순환 중간의 「잠김」은 방문 경로에 따라 달라진다.
  if (visiting.size === 0) {
    let byMap = gatedCache.get(project);
    if (!byMap) gatedCache.set(project, byMap = new Map());
    const known = byMap.get(mapId);
    if (known !== undefined) return known;
    const answer = mapGatedWalk(project, mapId, visiting);
    byMap.set(mapId, answer);
    return answer;
  }
  return mapGatedWalk(project, mapId, visiting);
}

function mapGatedWalk(project: Project, mapId: string, visiting: Set<string>): boolean {
  if (visiting.has(mapId)) return true;
  visiting.add(mapId);
  try {
    return !entriesInto(project, mapId).some((entry) =>
      baseRequirementsOf(project, entry).length === 0 && !mapGated(project, entry.page.map!.id, visiting));
  } finally {
    visiting.delete(mapId);
  }
}

// 방문의 선행 조건은 프로젝트가 같으면 변하지 않는다 — 계획기가 정렬 비교마다 다시 구해 72맵 캠페인에서 수십 초가 걸렸다.
const requirementCache = new WeakMap<Project, WeakMap<CommandVisit, readonly Requirement[]>>();

function requirementsOf(project: Project, visit: CommandVisit): Requirement[] {
  let byVisit = requirementCache.get(project);
  if (!byVisit) requirementCache.set(project, byVisit = new WeakMap());
  const cached = byVisit.get(visit);
  if (cached) return [...cached];
  const reqs = computeRequirementsOf(project, visit);
  byVisit.set(visit, reqs);
  return [...reqs];
}

function computeRequirementsOf(project: Project, visit: CommandVisit): Requirement[] {
  const reqs = baseRequirementsOf(project, visit);
  const mapId = visit.page.map?.id;
  // 문은 페이지 조건 뒤에 연다 — 날이 지나야 열리는 축제 광장에 먼저 들어가면(하루 넘기기 5번) 호감을 쌓을 날이 남지 않는다.
  if (mapId && mapGated(project, mapId)) reqs.push({ kind: "map", id: mapId });
  return reqs;
}

/** fork else 는 조건이 거짓일 때 실행된다. 「스위치가 꺼져 있으면 진엔딩」의 else(쓸쓸한 엔딩)는 그 스위치를 켜야 닿는다. */
function elseBranchRequirements(condition: unknown, _page: PageRef): Requirement[] {
  const top = condition as { kind?: string; value?: unknown; switchId?: string; conditions?: unknown[] } | null;
  if (!top || typeof top !== "object") return [];
  if (top.kind === "all" && Array.isArray(top.conditions)) return top.conditions.flatMap((child) => elseBranchRequirements(child, _page));
  if (top.kind === "switch" && top.value === false && typeof top.switchId === "string") return [{ kind: "switch", id: top.switchId }];
  return [];
}

/** 이 페이지가 숫자 입력(inputNumber)으로 직접 채우는 변수 — 러너·플레이어는 numberInputAnswer 로 정답을 넣는다. */
function pageInputtedVariables(page: PageRef): Set<string> {
  const out = new Set<string>();
  const scan = (list: readonly RawCommand[]): void => {
    for (const command of list) {
      if (command.kind === "inputNumber" && typeof command.variableId === "string") out.add(command.variableId);
      for (const child of childLists(command)) scan(child.list);
    }
  };
  scan(page.commands);
  return out;
}

/** 이 명령보다 먼저 실행되는 명령들 — 같은 목록의 앞 형제와 바깥 목록들의 앞 형제(분기 진입 전에 돈다). */
function commandsRunBefore(visit: CommandVisit): RawCommand[] {
  const out: RawCommand[] = [];
  let list: readonly RawCommand[] = visit.page.commands;
  for (let depth = 0; depth < visit.indexPath.length; depth++) {
    const index = visit.indexPath[depth]!;
    out.push(...list.slice(0, index));
    const segment = visit.segments[depth];
    if (!segment) break;
    const owner = list[index];
    const child = owner ? childLists(owner).find((entry) => entry.segment.kind === segment.kind
      && JSON.stringify({ ...entry.segment, command: undefined }) === JSON.stringify({ ...segment, command: undefined })) : undefined;
    list = child?.list ?? [];
  }
  return out;
}

function baseRequirementsOf(project: Project, visit: CommandVisit): Requirement[] {
  const reqs: Requirement[] = [];
  // 엔딩 조건(호감)을 페이지 조건(요일)보다 먼저 채운다. 만남 잠금을 푸는 명령이
  // 요일을 올리는 이른 페이지에만 있으면, 요일을 되풀이할 수 없다.
  if (visit.command.kind === "triggerEnding") {
    const namedId = typeof visit.command.endingId === "string" ? visit.command.endingId : undefined;
    const ending = namedId
      ? (project.endings ?? []).find((entry) => entry.id === namedId)
      : [...(project.endings ?? [])].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
    // 이름 있는 triggerEnding 도 엔딩 conditions 를 선행으로 본다. 런타임이 조건 미달이면
    // 엔딩을 열지 않으므로, 호감 ≥ 6 없이 고백 선택지만 누르면 도달로 세면 안 된다.
    // 같은 실행 경로에서 triggerEnding 바로 앞에 켜는 스위치는 선행 조건이 아니다(2026-10-06 몬스터 원정:
    // 챔피언 승리 분기가 mx_ending 을 켜고 곧바로 엔딩을 부르는데, 「mx_ending 을 채울 이벤트 없음」으로 계획이 끊겼다).
    const setBefore = new Set(commandsRunBefore(visit)
      .filter((command) => command.kind === "setSwitch" && command.value === true && typeof command.switchId === "string")
      .map((command) => command.switchId as string));
    for (const condition of ending?.conditions ?? []) {
      reqs.push(...leafRequirements(condition, visit.page).filter((req) => !(req.kind === "switch" && setBefore.has(req.id))));
    }
  }
  for (const condition of visit.page.conditions) reqs.push(...leafRequirements(condition, visit.page));
  for (const segment of visit.segments) {
    if (segment.kind !== "fork") continue;
    if (segment.branch === "then") {
      const leaves = leafRequirements(segment.command.condition, visit.page);
      // inputNumber 로 같은 페이지에서 채우는 변수는 선행 조건이 아니다 — 실행 중에 입력이 채운다
      // (2026-09-24 추격 호러 r7: 금고 inputNumber→fork(var == 7419) 를 「세터 없는 선행」으로 오판해
      //  암호 이벤트와 열쇠 사슬이 전부 unresolved 로 뜨고 엔딩까지 못 갔다).
      const inputted = leaves.some((req) => req.kind === "variable") ? pageInputtedVariables(visit.page) : undefined;
      reqs.push(...(inputted ? leaves.filter((req) => !(req.kind === "variable" && inputted.has(req.id))) : leaves));
    }
    // 2026-09-24 갤러리 r2: 장미를 건넨 else 의 triggerEnding 을, 스위치가 꺼진 채로 같은 이벤트를 돌려 놓쳤다.
    if (segment.branch === "else") reqs.push(...elseBranchRequirements(segment.command.condition, visit.page));
  }
  return reqs;
}

function satisfiedAtStart(project: Project, req: Requirement): boolean {
  if (req.kind === "switch") return initiallyOn(project, req.id);
  if (req.kind === "actor") return (project.session?.partyActorIds ?? []).includes(req.id);
  if (req.kind === "item") return (project.session?.inventory?.[req.id] ?? 0) > 0;
  if (req.kind === "map") return !mapGated(project, req.id);
  if (req.kind === "variable" && req.op && req.value !== undefined) return compare(project.session?.variables?.[req.id] ?? 0, req.op, req.value);
  return false;
}

function compare(actual: number, op: string, value: number): boolean {
  switch (op) {
    case ">=": return actual >= value;
    case ">": return actual > value;
    case "<=": return actual <= value;
    case "<": return actual < value;
    case "==": return actual === value;
    case "!=": return actual !== value;
    default: return false;
  }
}

/** 문턱 쪽으로 움직이는 세터인가 — 호감 ≥ 6 을 바라는데 「무심한 답 -1」 을 고르지 않게. */
function movesToward(req: Extract<Requirement, { kind: "variable" }>, command: RawCommand): boolean {
  if (!req.op || req.value === undefined) return true;
  const amount = typeof command.value === "number" ? command.value : undefined;
  if (amount === undefined) return true;
  const op = command.op;
  if (op === "=") return compare(amount, req.op, req.value);
  const up = (op === "+=" && amount > 0) || (op === "-=" && amount < 0);
  const down = (op === "-=" && amount > 0) || (op === "+=" && amount < 0);
  if (req.op === ">=" || req.op === ">") return up;
  if (req.op === "<=" || req.op === "<") return down;
  return up || down;
}

function setterMatches(project: Project, req: Requirement, visit: CommandVisit): boolean {
  const c = visit.command;
  switch (req.kind) {
    case "switch": return c.kind === "setSwitch" && c.switchId === req.id && (c.value === true || c.value === "toggle" || (typeof c.value === "object" && c.value !== null));
    case "selfSwitch": return c.kind === "setSelfSwitch" && c.key === req.key && c.value === true && visit.page.event?.id === req.eventId && visit.page.map?.id === req.mapId;
    case "variable": {
      if (c.kind === "setVariable" && c.variableId === req.id && movesToward(req, c)) return true;
      // 다른 페이지가 그 변수를 요구하면 inputNumber 페이지도 세터다 — numberInputAnswer 가 고른
      // 정답이 실제로 문턱을 통과할 때만 후보로 인정한다(추격 호러 r7 금고 암호).
      if (req.op === undefined || req.value === undefined || c.kind !== "inputNumber" || c.variableId !== req.id) return false;
      return compare(numberInputAnswer(project, req.id), req.op, req.value);
    }
    case "item": return c.kind === "changeItem" && c.itemId === req.id && c.op !== "-=";
    case "actor": return c.kind === "changeParty" && c.actorId === req.id && c.action === "add";
    case "map": return c.kind === "transfer" && c.mapId === req.id && visit.page.map?.id !== req.id;
  }
}

function reqKey(req: Requirement): string {
  if (req.kind === "variable" && req.op) return `variable:${req.id}${req.op}${req.value}`;
  return req.kind === "selfSwitch" ? `self:${req.mapId}:${req.eventId}:${req.key}` : `${req.kind}:${req.id}`;
}

export interface CriticalPlan {
  readonly goals: readonly Goal[];
  readonly unresolved: readonly { readonly req: string; readonly for: CommandWhere }[];
}

/**
 * 세터 페이지가 「꺼져 있어야」 열리는 스위치(오늘 만남 끝=false)를 다시 끄는 목표들. 하루를 넘기는 침대처럼
 * 선행 조건 없는 세터만 쓴다 — 되풀이 한 바퀴가 또 긴 사슬이 되면 자동 플레이가 무엇을 재는지 흐려진다.
 */
function pageResetGoals(project: Project, setter: CommandVisit, visits: readonly CommandVisit[]): Goal[] {
  const resets: Goal[] = [];
  // 「오늘 이미 만났나」 는 페이지 조건(switch=false)으로도, 대사 앞 fork 로도 쓴다 — fork 의 else 에 세터가 있으면
  // 그 스위치가 꺼져 있어야 닿는다(2026-09-24 연애 4회차: 공략 인물 셋 모두 fork{sw_met}·else 에 호감 +2).
  const locks: RawCommand[] = [...(setter.page.conditions as readonly RawCommand[])];
  // 뒤 페이지가 「오늘 만남 스위치 ON」이면 앞의 호감 +2 페이지를 덮는다. 그 스위치를 끄지 않으면
  // 되풀이가 한 번(+2)에서 멈춘다(2026-09-24 골목 라디오: 나래호감=2).
  const turnsOn = new Set<string>();
  const collectOn = (commands: readonly RawCommand[] | undefined): void => {
    for (const command of commands ?? []) {
      if (command.kind === "setSwitch" && command.value === true && typeof command.switchId === "string") turnsOn.add(command.switchId);
      for (const child of childLists(command)) collectOn(child.list);
    }
  };
  collectOn(setter.page.commands as readonly RawCommand[]);
  const laterPages = setter.page.event?.pages?.slice(setter.page.pageIndex + 1) ?? [];
  for (const later of laterPages) {
    for (const condition of later.conditions ?? []) {
      if (condition.kind === "switch" && condition.value === true && turnsOn.has(condition.switchId)) {
        locks.push({ kind: "switch", switchId: condition.switchId, value: false });
      }
    }
  }
  for (const segment of setter.segments) {
    if (segment.kind !== "fork") continue;
    const condition = segment.command.condition as RawCommand | undefined;
    if (condition?.kind !== "switch" || typeof condition.switchId !== "string") continue;
    if (segment.branch === "else" && condition.value === true) locks.push({ ...condition, value: false });
    if (segment.branch === "then" && condition.value === false) locks.push(condition);
  }
  for (const condition of locks) {
    if (condition.kind !== "switch" || condition.value !== false || typeof condition.switchId !== "string") continue;
    const id = condition.switchId;
    if (resets.some((goal) => goal.label.includes(id))) continue;
    const reset = visits.find((visit) => visit.command.kind === "setSwitch" && visit.command.switchId === id && visit.command.value === false
      && visit.page.event !== setter.page.event && requirementsOf(project, visit).every((req) => satisfiedAtStart(project, req)));
    if (reset) resets.push({ label: `스위치 ${project.switches.find((s) => s.id === id)?.name || id}(${id}) 끄기`, visit: reset, done: (session) => session.switches[id] !== true });
  }
  return resets;
}

/** 목표 명령 하나에 이르는 선행 목표 목록(선행 먼저). */
/** 선행 사슬 깊이 상한 — 요구 하나·문 하나가 한 단씩. 체육관 8곳 + 리그 4단 몬스터 캠페인이 ~30 단이다. */
const MAX_PLAN_DEPTH = 48;

export function planCriticalPath(project: Project, target: CommandVisit, targetGoal: Goal): CriticalPlan {
  const map = project.maps;
  const visits: CommandVisit[] = [];
  for (const page of allPages(project)) {
    // 공통 이벤트 안의 세터는 어떻게 부르는지 모르므로 사슬에 쓰지 않는다.
    if (!page.map || !page.event) continue;
    visitPageCommands(page, (visit) => visits.push(visit));
  }
  const goals: Goal[] = [];
  const unresolved: { req: string; for: CommandWhere }[] = [];
  const planned = new Set<string>();
  const inProgress = new Set<string>();
  // 잠긴 문도 선행 조건이다(2026-09-24 갤러리 호러: 화실 문의 transfer 페이지가 「화실 개방」 스위치를 기다리고,
  // 그 스위치는 붉은 열쇠 → 조각상 → 레버 → 초상화 퍼즐 사슬 끝에 켜진다). 목표가 시작 조건만으로 못 가는 맵에
  // 있으면, 그 맵으로 들어가는 문 명령 하나를 먼저 목표 사슬에 넣는다 — 그 문의 페이지 조건이 곧 선행 조건이다.
  const doorVisits = visits.filter((visit) => visit.command.kind === "transfer" && typeof visit.command.mapId === "string"
    && visit.command.mapId !== visit.page.map!.id);
  const freeDoor = (visit: CommandVisit): boolean => requirementsOf(project, visit).every((req) => satisfiedAtStart(project, req));
  const openMaps = new Set<string>([project.startMapId]);
  for (let grew = true; grew;) {
    grew = false;
    for (const door of doorVisits) {
      const to = door.command.mapId as string;
      if (!openMaps.has(to) && openMaps.has(door.page.map!.id) && freeDoor(door)) { openMaps.add(to); grew = true; }
    }
  }
  const mapsInProgress = new Set<string>();
  // 문 후보·세터 후보 하나가 실패하면 그 시도가 남긴 흔적(planned 표식·unresolved 기록)도goals 와 함께
  // 되돌린다 — 안 그러면 다음 후보는 «이미 계획됨» 으로 건너뛰고 세터 목표 없이 계획이 끝나,
  // 런타임에서 문이 (현재 스위치 상태로는) 열리지 않는다(2026-09-24 감성 스토리 r3: 계획 5단·유령 preamble 24건).
  type PlanSnapshot = { readonly goals: number; readonly unresolved: number; readonly planned: ReadonlySet<string> };
  const snapshotPlan = (): PlanSnapshot => ({ goals: goals.length, unresolved: unresolved.length, planned: new Set(planned) });
  const restorePlan = (snapshot: PlanSnapshot): void => {
    goals.length = snapshot.goals;
    unresolved.length = snapshot.unresolved;
    planned.clear();
    for (const key of snapshot.planned) planned.add(key);
  };
  const planMapEntry = (mapId: string, depth: number): boolean => {
    if (openMaps.has(mapId) || planned.has(`map:${mapId}`)) return true;
    if (mapsInProgress.has(mapId)) return false;
    mapsInProgress.add(mapId);
    const doors = doorVisits.filter((door) => door.command.mapId === mapId)
      .sort((a, b) => requirementsOf(project, a).length - requirementsOf(project, b).length);
    let ok = false;
    for (const door of doors) {
      const snapshot = snapshotPlan();
      // 문 자체는 routeTo 가 지난다 — 여기서는 문의 선행 조건만 사슬에 넣는다.
      if (planVisit(door, depth + 1)) { ok = true; break; }
      restorePlan(snapshot);
    }
    mapsInProgress.delete(mapId);
    if (ok) planned.add(`map:${mapId}`);
    return ok;
  };
  // 실패한 방문은 같거나 적은 남은 깊이·계획에서 다시 풀지 않는다 — 배지 8개·리그 4단 사슬(깊이 ~30)을
  // 기억 없이 되짚으면 지수로 불어 끝나지 않았다(2026-10-06 몬스터 원정: 깊이 12 에서 리그 사슬이 잘렸다).
  const failed = new Map<string, { readonly budget: number; readonly planned: number }>();
  const visitKey = (visit: CommandVisit): string => `${visit.where.mapId}|${visit.where.eventId}|${visit.where.pageIndex}|${visit.where.path}`;
  const planVisit = (visit: CommandVisit, depth: number): boolean => {
    if (depth > MAX_PLAN_DEPTH) return false;
    const key = visitKey(visit);
    const memo = failed.get(key);
    if (memo && MAX_PLAN_DEPTH - depth <= memo.budget && planned.size <= memo.planned) return false;
    const ok = planVisitOnce(visit, depth);
    if (!ok) failed.set(key, { budget: MAX_PLAN_DEPTH - depth, planned: planned.size });
    return ok;
  };
  const planVisitOnce = (visit: CommandVisit, depth: number): boolean => {
    for (const req of requirementsOf(project, visit)) {
      const key = reqKey(req);
      if (planned.has(key) || satisfiedAtStart(project, req)) continue;
      if (inProgress.has(key)) return false;
      inProgress.add(key);
      // 가장 얕은 세터를 고른다 — 선행 조건이 적은 후보부터.
      const stepToward = (visit: CommandVisit): number => {
        // presentItem 안의 +3 은 자동 플레이가 아이템을 내지 못하면 0에 머문다. 대화 +2 를 먼저 고른다.
        if (visit.segments.some((segment) => segment.command.kind === "presentItem")) return -1;
        const command = visit.command;
        if (command.kind !== "setVariable" || typeof command.value !== "number") return 0;
        if (command.op === "+=") return command.value;
        if (command.op === "-=") return -command.value;
        return 0;
      };
      const preferLargerStep = req.kind === "variable" && (req.op === ">=" || req.op === ">");
      const candidates = visits.filter((candidate) => setterMatches(project, req, candidate) && map[candidate.page.map!.id])
        .sort((a, b) => requirementsOf(project, a).length - requirementsOf(project, b).length
          || (preferLargerStep ? stepToward(b) - stepToward(a) : 0)
          || a.segments.length - b.segments.length);
      let ok = false;
      for (const candidate of candidates) {
        const snapshot = snapshotPlan();
        if (planVisit(candidate, depth + 1)) {
          const threshold = req.kind === "variable" && req.op && req.value !== undefined ? req : undefined;
          goals.push({
            label: req.kind === "map" ? requirementLabel(project, req) : threshold ? `${requirementLabel(project, req)} 만들기` : `${requirementLabel(project, req)} 켜기`, visit: candidate,
            done: (session) => req.kind === "switch" ? session.switches[req.id] === true
              : req.kind === "selfSwitch" ? session.selfSwitches?.[req.eventId]?.[req.key] === true
              : req.kind === "actor" ? session.partyActorIds.includes(req.id)
              : req.kind === "item" ? (session.inventory[req.id] ?? 0) > 0
              : req.kind === "map" ? session.currentMapId === req.id
              : threshold ? compare(session.variables[req.id] ?? 0, threshold.op!, threshold.value!) : false,
            ...(threshold ? { repeat: { resets: pageResetGoals(project, candidate, visits), max: 20 } } : {}),
            alternatives: candidates.filter((other) => other !== candidate && other.page.map?.id === candidate.page.map?.id
              && requirementsOf(project, other).length <= requirementsOf(project, candidate).length),
          });
          ok = true;
          break;
        }
        restorePlan(snapshot);
      }
      inProgress.delete(key);
      if (!ok) { unresolved.push({ req: requirementLabel(project, req), for: visit.where }); return false; }
      planned.add(key);
    }
    // 문은 페이지 조건 다음에 연다 — 닷새가 지나야 열리는 축제 광장에 먼저 들어가면 호감을 쌓을 날이 남지 않는다.
    const onMap = visit.page.map?.id;
    if (onMap && !planMapEntry(onMap, depth)) {
      unresolved.push({ req: `${project.maps[onMap]?.name ?? onMap} 로 들어가는 문`, for: visit.where });
      return false;
    }
    return true;
  };
  planVisit(target, 0);
  goals.push(targetGoal);
  return { goals, unresolved };
}

/** 페이지를 처음부터 목표 명령까지 실행할 때 고를 선택지 번호(길 밖 선택지는 0번). */
function choiceSequence(visit: CommandVisit): number[] {
  const seq: number[] = [];
  const zeroes = (list: readonly RawCommand[]): void => {
    for (const command of list) {
      if (command.kind === "choices") {
        seq.push(0);
        const first = childLists(command).find((child) => child.segment.kind === "option" && child.segment.index === 0);
        if (first) zeroes(first.list);
      }
    }
  };
  let list: readonly RawCommand[] = visit.page.commands;
  visit.indexPath.forEach((index, level) => {
    zeroes(list.slice(0, index));
    const command = list[index];
    const segment = visit.segments[level];
    if (!command || !segment) return;
    if (segment.kind === "option" && command.kind === "choices") seq.push(segment.index);
    list = childLists(command).find((entry) => entry.key === childKey(segment))?.list ?? [];
  });
  return seq;
}

function childKey(segment: CommandVisit["segments"][number]): string {
  switch (segment.kind) {
    case "option": return `options[${segment.index}].branch`;
    case "fork": return segment.branch;
    case "battle": return `${segment.result}Branch`;
    case "branch": return segment.key;
  }
}

interface Driver {
  readonly project: Project;
  steps: SceneStep[];
  runs: number;
  last: SceneTestResult;
  readonly deadline: number;
  /** 저장해 두었다가 불러오는 지점 — 있으면 steps 는 처음이 아니라 여기서부터 다시 돈다. */
  base?: PlaySession;
  /** base 이전에 이미 확정한 단계 수(보고용). */
  committed: number;
  /** 수련 중에는 조우 직전마다 회복한다(회복 센터를 오가는 걸음을 줄인 것). */
  recover?: boolean;
  /** 수련하다 쓰러진 맵 — 상성이 나쁜 풀숲(유령 탑의 풀·에스퍼 리더)은 다시 고르지 않는다. */
  /** 수련하다 쓰러진 풀숲 → 그때 리더 레벨. 리더가 그보다 3 넘게 자라면 다시 쓴다(8번길이 영영 막혀 7번길에서 Lv52 가 멈췄다). */
  readonly badGrounds: Map<string, number>;
}

/** runAutoPlay({ recoverBeforeRandomEncounters }) 로 도는 프로젝트 — 인카운터 직전마다 파티를 회복한다. */
const MAX_COMPANION_JOINS = 3;

const RECOVERING_PROJECTS = new WeakSet<Project>();

/** 러너는 같은 단계를 몇 번이고 다시 돈다 — 런타임 경고(console.warn)가 매번 쏟아지지 않게 모아 둔다. */
function quietScene(project: Project, steps: SceneStep[], base?: PlaySession, recover?: boolean): SceneTestResult {
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    const start = base ? { mapId: base.currentMapId, start: { x: base.x, y: base.y } } : { mapId: project.startMapId, start: project.startPos };
    return runSceneTest(project, { ...start, steps }, undefined,
      { recoverBeforeRandomEncounters: recover ?? RECOVERING_PROJECTS.has(project), ...(base ? { initialSession: base } : {}),
        // 몬스터 게임의 자동 플레이어는 동료를 잡고 상성에 맞춰 교체한다(실제 플레이어처럼).
        ...(project.system?.monsterCollection === true ? { monsterTactics: true } : {}) });
  } finally {
    console.warn = warn;
  }
}

function run(driver: Driver, steps: SceneStep[]): SceneTestResult {
  driver.runs += 1;
  return quietScene(driver.project, steps, driver.base, driver.recover);
}

/**
 * 기술 칸이 꽉 찬 몬스터가 새로 배운 기술(pendingSkillIds)을 메뉴에서 정리하듯 — 가장 약한 공격 기술보다 세면 바꾸고,
 * 아니면 버린다. 안 하면 Lv99 가 몸통박치기·처음 풀 기술만 들고 Lv50 보스에게 졌다(2026-10-06 몬스터 원정).
 * 바꿀 것이 없으면 null.
 */
function learnPendingMoves(project: Project, session: PlaySession): PlaySession | null {
  // 위력만 보면 노말 기술이 자속 기술을 밀어내 고스트 관장에게 0 피해만 넣었다(2026-10-06 7관) —
  // 자기 타입 기술은 1.5배로 치고, 마지막 자속 기술은 같은 타입 기술로만 바꾼다.
  const skillOf = (skillId: string) => project.database.skills.find((entry) => entry.id === skillId);
  let next: PlaySession | null = null;
  for (const [instanceId, original] of Object.entries(session.monsterInstances ?? {})) {
    let instance = original;
    const types = project.database.monsterSpecies?.find((species) => species.id === original.speciesId)?.types ?? [];
    const stab = (skillId: string) => types.includes(skillOf(skillId)?.elementId ?? "");
    const power = (skillId: string) => {
      const skill = skillOf(skillId);
      return skill && skill.effect.kind === "damage" ? (skill.power ?? 0) * (stab(skillId) ? 1.5 : 1) : -1;
    };
    for (const pending of instance.pendingSkillIds ?? []) {
      const known = instance.skillIds ?? [];
      const keepsLastStab = (skillId: string) => stab(skillId) && !stab(pending) && known.filter(stab).length <= 1;
      // 같은 속성 기술이 겹친 것부터 바꾼다 — 풀·에스퍼 스타터가 풀 기술 셋으로 채워져, 불꽃·비행·벌레를 낸 라이벌 챔피언에게
      // 반감 기술만 들고 Lv93 로 열 번 졌다(2026-10-07 사막 기획서). 플레이어도 기술 범위를 남긴다.
      const elementOf = (skillId: string) => skillOf(skillId)?.elementId ?? "";
      const lastOfElement = (skillId: string) => elementOf(skillId) !== elementOf(pending) && known.filter((other) => elementOf(other) === elementOf(skillId)).length <= 1;
      const candidates = [...known].filter((skillId) => power(skillId) >= 0 && !keepsLastStab(skillId));
      const duplicated = candidates.filter((skillId) => !lastOfElement(skillId));
      const weakest = (duplicated.length ? duplicated : candidates).sort((a, b) => power(a) - power(b))[0];
      const replaced = weakest && power(pending) > power(weakest) ? replacePendingMonsterSkill(project, instance, pending, weakest) : undefined;
      const settled = replaced?.ok ? replaced : rejectPendingMonsterSkill(instance, pending);
      if (settled.ok) instance = settled.instance;
    }
    if (instance === original) continue;
    next ??= structuredClone(session);
    next.monsterInstances[instanceId] = instance;
  }
  return next;
}

/**
 * 지금 세션을 저장했다가 불러온 것처럼 다음 시도의 출발점으로 삼는다. 72맵 몬스터 캠페인은 목표가 60개를 넘어
 * 매 시도를 처음부터 다시 돌리면(단계 수의 제곱) 시간 상한에 걸렸다. 맵 안 일시 상태(이벤트 위치)는
 * 실제 불러오기처럼 맵 기본값으로 돌아간다.
 */
function checkpoint(driver: Driver): void {
  const learned = driver.project.system?.monsterCollection === true ? learnPendingMoves(driver.project, driver.last.session) : null;
  if (driver.steps.length === 0 && driver.base && !learned) return;
  driver.base = learned ?? structuredClone(driver.last.session);
  // 복제하면 세션에 붙은 체크포인트(마지막 회복 센터)가 사라진다 — 함께 옮긴다.
  const saved = getSessionCheckpoint(driver.last.session);
  if (saved) setSessionCheckpoint(driver.base, saved);
  driver.committed += driver.steps.length;
  driver.steps = [];
  // 로그·종료 상태도 새 출발점 기준으로 맞춘다 — 「이번에 새로 생긴 줄」을 앞 구간 로그 길이로 자르면 어긋난다.
  const fresh = run(driver, []);
  if (fresh.ok) driver.last = fresh;
}

function tryCommit(driver: Driver, extra: SceneStep[]): { ok: true } | { ok: false; reason: string; result: SceneTestResult } {
  const steps = [...driver.steps, ...extra];
  const result = run(driver, steps);
  // 걷다가 야생에게 져 회복 지점에서 깨어나면(outcome recover) 남은 걸음이 엉뚱한 맵에서 막힌다 — 깨어난 데까지는
  // 실제로 일어난 일이므로 거기까지 확정하고 실패로 알린다. 호출자가 수련·재출발을 고른다.
  if (!result.ok && result.failedStepIndex !== undefined && result.failedStepIndex > driver.steps.length
    && result.log.slice(driver.last.log.length).some((line) => line.startsWith("defeat recovery"))) {
    const kept = steps.slice(0, result.failedStepIndex);
    const partial = run(driver, kept);
    if (partial.ok) {
      driver.steps = kept;
      driver.last = partial;
      return { ok: false, reason: `걷다가 쓰러져 ${partial.session.currentMapId} 에서 깨어났습니다(defeat recovery)`, result: partial };
    }
  }
  if (!result.ok) {
    let reason = result.failureReason ?? "알 수 없는 실패";
    // 게임 오버는 원인이 앞선 전투다 — 어떤 전투에서 졌는지 붙인다(몬스터 게임: 도로 조우가 너무 잦다, 파트너가 약하다).
    if (/게임 오버/u.test(reason)) {
      const battles = result.log.filter((line) => /^(battle|random encounter)/u.test(line));
      if (battles.length) reason += ` — 전투 ${battles.length}회, 마지막: ${battles.slice(-3).join(" / ")}`;
    }
    return { ok: false, reason, result };
  }
  driver.steps = steps;
  driver.last = result;
  return { ok: true };
}

const NO_PENDING = "대기 중 선택지가 없습니다";

/** 조사·접촉 뒤 대기 중인 선택지를 고른다. 선택지가 더 없으면 멈춘다. */
function resolveChoices(driver: Driver, sequence: readonly number[]): string | null {
  const pending = [...sequence];
  for (let guard = 0; guard < 12; guard += 1) {
    const index = pending.shift() ?? 0;
    const attempt = tryCommit(driver, [{ kind: "choose", index }]);
    if (attempt.ok) continue;
    if (attempt.reason.includes(NO_PENDING)) return null;
    if (/out of range/u.test(attempt.reason) && index !== 0) {
      const fallback = tryCommit(driver, [{ kind: "choose", index: 0 }]);
      if (fallback.ok) continue;
      return fallback.reason.includes(NO_PENDING) ? null : fallback.reason;
    }
    return attempt.reason;
  }
  return "선택지가 12번 넘게 이어졌습니다";
}

function activeCommands(event: GameEvent, session: PlaySession): readonly RawCommand[] | null {
  if (event.pages && event.pages.length > 0) {
    const page = resolveEventPage(event, session);
    return page ? (page.commands as unknown as RawCommand[]) : null;
  }
  return event.commands as unknown as RawCommand[];
}

function triggerOf(event: GameEvent, session: PlaySession): string {
  if (event.pages && event.pages.length > 0) return resolveEventPage(event, session)?.trigger.kind ?? "none";
  return event.trigger?.kind ?? "action";
}

interface Door { readonly event: GameEvent; readonly to: string; readonly visit: CommandVisit }

function doorsOn(project: Project, mapId: string, session: PlaySession): Door[] {
  const map = project.maps[mapId];
  if (!map) return [];
  const doors: Door[] = [];
  for (const event of map.events ?? []) {
    const commands = activeCommands(event, session);
    if (!commands) continue;
    const page = event.pages?.length ? resolveEventPage(event, session) : undefined;
    const pageIndex = page ? event.pages!.indexOf(page) : -1;
    const ref: PageRef = { map, event, page, pageIndex, trigger: page?.trigger ?? event.trigger, conditions: page?.conditions ?? [], commands };
    visitPageCommands(ref, (visit) => {
      // 전투에 져야 가는 이동(패배 갈래의 「회복 센터로」)은 문이 아니다 — 1번길 트레이너를 센터로 가는 문으로 세서
      // 회복하러 가지 못하고 지친 채 챔피언에게 도전했다(2026-10-06).
      if (visit.command.kind === "transfer" && typeof visit.command.mapId === "string" && visit.command.mapId !== mapId
        && !/defeatBranch|escapeBranch/u.test(visit.where.path ?? "") && forkPathOpen(visit, session)) {
        doors.push({ event, to: visit.command.mapId, visit });
      }
    });
  }
  return doors;
}

/**
 * 문 명령을 감싼 조건 분기가 지금 세션에서 그 갈래로 가는가 — 배지가 있어야 열리는 길(fork 배지 → transfer)을
 * 열린 문으로 세면 수련터를 잠긴 길 너머로 골랐다(2026-10-06 몬스터 원정 3번째 체육관).
 */
function forkPathOpen(visit: CommandVisit, session: PlaySession): boolean {
  for (const segment of visit.segments) {
    if (segment.kind !== "fork") continue;
    let holds: boolean;
    try {
      holds = evalCondition(session, segment.command.condition as Condition | undefined, visit.page.event?.id);
    } catch {
      continue;
    }
    if (holds !== (segment.branch === "then")) return false;
  }
  return true;
}

/** 인벤토리의 스위치 아이템이 자동/병렬 공통 이벤트로 다른 맵에 옮기면, 막힌 맵의 출구로 친다. */
function wakeItemId(project: Project, session: PlaySession, switchOn: boolean): string | null {
  for (const [itemId, count] of Object.entries(session.inventory)) {
    if ((count ?? 0) <= 0) continue;
    const item = project.database.items.find((entry) => entry.id === itemId);
    if (!item || item.type !== "switch" || !item.switchId || item.occasion === "battle") continue;
    if ((session.switches[item.switchId] === true) !== switchOn) continue;
    const common = project.commonEvents.find((event) =>
      (event.trigger === "auto" || event.trigger === "parallel")
      && event.conditionSwitchId === item.switchId
      && event.commands.some((command) => command.kind === "transfer"));
    if (common) return itemId;
  }
  return null;
}

function switchEscapeItemId(project: Project, session: PlaySession): string | null {
  return wakeItemId(project, session, false);
}

function stuckWakeItemId(project: Project, session: PlaySession): string | null {
  return wakeItemId(project, session, true);
}

function wakeSteps(project: Project, itemId: string): SceneStep[] {
  const switchId = project.database.items.find((item) => item.id === itemId)?.switchId;
  const steps: SceneStep[] = [{ kind: "useItem", itemId }];
  // 이동 뒤에 스위치를 끄는 명령이 러너에서 빠지면 다음 세계에서 다시 못 쓴다.
  if (switchId) steps.push({ kind: "set", switches: { [switchId]: false } });
  return steps;
}

function routeTo(project: Project, from: string, to: string, session: PlaySession): Door[] | null {
  if (from === to) return [];
  const previous = new Map<string, Door>();
  const queue = [from];
  const seen = new Set([from]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const door of doorsOn(project, current, session)) {
      if (seen.has(door.to)) continue;
      seen.add(door.to);
      previous.set(door.to, door);
      if (door.to === to) {
        const path: Door[] = [];
        let cursor = to;
        while (cursor !== from) { const hop = previous.get(cursor)!; path.unshift(hop); cursor = hop.visit.page.map!.id; }
        return path;
      }
      queue.push(door.to);
    }
  }
  return null;
}

const DIRS = [
  { dir: "right", dx: 1, dy: 0 }, { dir: "left", dx: -1, dy: 0 }, { dir: "down", dx: 0, dy: 1 }, { dir: "up", dx: 0, dy: -1 },
] as const;

/** 모든 페이지가 접촉 발동이고 명령이 `callMapEvent(targetId)` 하나뿐인 이벤트(문 발판). */
function relaysTo(event: GameEvent, targetId: string): boolean {
  const pages = event.pages ?? [];
  return pages.length > 0 && pages.every((page) => {
    const commands = page.commands ?? [];
    return page.trigger?.kind === "playerTouch" && commands.length === 1
      && commands[0]!.kind === "callMapEvent" && (commands[0] as { eventId?: string }).eventId === targetId;
  });
}

/**
 * 한 칸씩 걷는 경로. 러너의 walk 는 밑에 깔린 다른 문(접촉 이벤트) 위를 지나가다 엉뚱한 맵으로 튄다 —
 * 여기서는 목표 말고 모든 이벤트 칸을 피해서 BFS 한다. 충돌은 런타임과 같은 canMove.
 */
function pathMoves(project: Project, session: PlaySession, mapId: string, from: { x: number; y: number }, target: GameEvent, adjacent: boolean): SceneStep[] | null {
  // 장치가 changeTile 로 연 길까지 본다(세션 오버라이드를 입힌 맵).
  const authored = project.maps[mapId];
  if (!authored) return null;
  const map = runtimeMap(authored, session);
  // 문 앞 발판(`<문>_step`)처럼 목표를 callMapEvent 로 부르기만 하는 접촉 이벤트는 목표와 같은 칸으로 친다 —
  // 2층 집 문은 벽 줄에 붙어 발판으로만 닿는데, 발판을 「다른 이벤트」로 피하면 문이 영영 막힌 것으로 보였다.
  const relays = adjacent ? [] : (map.events ?? []).filter((event) => event.id !== target.id && relaysTo(event, target.id));
  const relayCells = new Set(relays.map((event) => `${event.x},${event.y}`));
  // 밟아도 아무 일 없는 이벤트(모든 페이지가 발밑·겹침 허용이고 접촉 발동이 아님 — 조사 지점·자동 컷신 자리)는 지나간다.
  // 전부 피하면 좁은 기억 방(11×9)에서 투명 조사 지점·컷신 자리에 둘러싸인 메멘토가 「길이 없다」로 오판됐다(2026-09-24).
  // 지금 켜진 페이지가 없는 이벤트(한 번 돈 방문 기록 자동 이벤트)는 그림도 충돌도 없다 — 체육관 문 앞을 막는 것으로 보면
  // 관장에게 영영 못 갔다(2026-10-06 몬스터 원정 잿빛 온천). overlapForbidden 이 빠진 페이지는 겹침 허용과 같다.
  const harmless = (event: GameEvent) => triggerOf(event, session) === "none" || ((event.pages ?? []).length > 0 && (event.pages ?? []).every((page) =>
    page.priority === "below" && page.overlapForbidden !== true
    && !["playerTouch", "touch", "eventTouch"].includes(page.trigger?.kind ?? "")));
  // 같은 맵 안으로 옮기는 접촉 판(워프 미로)은 막힌 칸이 아니라 짝 판으로 건너가는 길이다 — 피하면 워프로만 닿는
  // 관장 방을 「길 없음」으로 봤다(2026-10-06 몬스터 원정 프리즘 체육관).
  const warps = new Map<string, { x: number; y: number }>();
  for (const event of map.events ?? []) {
    if (event.id === target.id) continue;
    const page = event.pages?.length ? resolveEventPage(event, session) : undefined;
    const trigger = page ? page.trigger?.kind : event.trigger?.kind;
    if (trigger !== "playerTouch" && trigger !== "touch") continue;
    const jump = (page?.commands ?? event.commands ?? []).find((command) => command.kind === "transfer");
    if (jump?.kind === "transfer" && jump.mapId === mapId) warps.set(`${event.x},${event.y}`, { x: jump.x, y: jump.y });
  }
  const occupied = new Set((map.events ?? []).filter((event) => event.id !== target.id && !harmless(event)).map((event) => `${event.x},${event.y}`)
    .filter((cell) => !relayCells.has(cell) && !warps.has(cell)));
  const isGoal = (x: number, y: number) => adjacent ? Math.abs(x - target.x) + Math.abs(y - target.y) === 1 : (x === target.x && y === target.y) || relayCells.has(`${x},${y}`);
  const key = (x: number, y: number) => `${x},${y}`;
  const previous = new Map<string, { from: string; dir: typeof DIRS[number]["dir"] }>();
  const queue = [from];
  const seen = new Set([key(from.x, from.y)]);
  let goal: { x: number; y: number } | null = isGoal(from.x, from.y) ? from : null;
  while (!goal && queue.length > 0) {
    const current = queue.shift()!;
    for (const d of DIRS) {
      const nx = current.x + d.dx;
      const ny = current.y + d.dy;
      const k = key(nx, ny);
      if (seen.has(k) || occupied.has(k)) continue;
      if (!(nx === target.x && ny === target.y && !adjacent) && !canMove(project, map, current.x, current.y, nx, ny)) continue;
      if (nx === target.x && ny === target.y && adjacent) continue;
      const warp = warps.get(k);
      if (warp) {
        const landing = key(warp.x, warp.y);
        // 워프로 접촉 목표 칸 위에 내려앉으면 목표가 발동하지 않는다(증기 함정이 입구 문 위로 돌려보낸다).
        if (!adjacent && warp.x === target.x && warp.y === target.y) continue;
        seen.add(k);
        if (seen.has(landing)) continue;
        seen.add(landing);
        previous.set(landing, { from: key(current.x, current.y), dir: d.dir });
        if (isGoal(warp.x, warp.y)) { goal = warp; break; }
        queue.push(warp);
        continue;
      }
      seen.add(k);
      previous.set(k, { from: key(current.x, current.y), dir: d.dir });
      if (isGoal(nx, ny)) { goal = { x: nx, y: ny }; break; }
      queue.push({ x: nx, y: ny });
    }
  }
  if (!goal) return null;
  const dirs: typeof DIRS[number]["dir"][] = [];
  for (let cursor = key(goal.x, goal.y); cursor !== key(from.x, from.y);) {
    const entry = previous.get(cursor)!;
    dirs.unshift(entry.dir);
    cursor = entry.from;
  }
  const steps: SceneStep[] = dirs.map((dir) => ({ kind: "move", dir }));
  if (adjacent) {
    const dx = target.x - goal.x;
    const dy = target.y - goal.y;
    steps.push({ kind: "face", dir: dx === 1 ? "right" : dx === -1 ? "left" : dy === 1 ? "down" : "up" });
  }
  return steps;
}

/** 이벤트를 발동시킨다 — 조사형은 옆에 서서 조사, 접촉형은 그 칸으로 걷기, 자동은 맵에 들어오면 이미 돌았다. */
function fireEvent(driver: Driver, event: GameEvent, visit: CommandVisit): string | null {
  const session = driver.last.session;
  const trigger = triggerOf(event, session);
  if (trigger === "auto" || trigger === "parallel") return null;
  if (trigger === "none") return `${event.name ?? event.id} 의 현재 활성 페이지가 없습니다(페이지 조건이 안 맞음).`;
  const touch = trigger === "touch" || trigger === "playerTouch" || trigger === "eventTouch";
  const mapId = session.currentMapId;
  // 이미 접촉 이벤트 칸 위에 서 있으면(패배 뒤 센터 출입문 위로 옮겨졌을 때) 한 칸 비켰다가 다시 밟는다 — 제자리는 발동하지 않는다.
  if (touch && session.x === event.x && session.y === event.y) {
    const map = runtimeMap(driver.project.maps[mapId]!, session);
    const opposite = { up: "down", down: "up", left: "right", right: "left" } as const;
    const aside = DIRS.find((d) => canMove(driver.project, map, session.x, session.y, session.x + d.dx, session.y + d.dy)
      && canMove(driver.project, map, session.x + d.dx, session.y + d.dy, session.x, session.y)
      && !(map.events ?? []).some((other) => other.x === session.x + d.dx && other.y === session.y + d.dy));
    if (aside) {
      const stepped = tryCommit(driver, [{ kind: "move", dir: aside.dir }, { kind: "move", dir: opposite[aside.dir] }]);
      if (!stepped.ok) return `${event.name ?? event.id} 칸에서 비켰다 다시 밟다 멈췄습니다: ${stepped.reason}`;
      return resolveChoices(driver, choiceSequence(visit));
    }
  }
  const moves = pathMoves(driver.project, session, mapId, { x: session.x, y: session.y }, event, !touch);
  if (!moves) return `${driver.project.maps[mapId]?.name ?? mapId} (${session.x},${session.y}) 에서 ${event.name ?? event.id} ${touch ? "칸" : "옆"} (${event.x},${event.y}) 까지 걸어갈 길이 없습니다(벽·물·다른 이벤트에 막힘).`;
  if (moves.length > 0) {
    const walked = tryCommit(driver, moves);
    if (!walked.ok) return `${event.name ?? event.id} ${touch ? "칸" : "옆"} (${event.x},${event.y}) 까지 걷다 멈췄습니다: ${walked.reason}`;
  }
  if (touch) return resolveChoices(driver, choiceSequence(visit));
  const talk = tryCommit(driver, [{ kind: "interact", eventId: event.id }]);
  if (!talk.ok) return `${event.name ?? event.id} 조사 실패: ${talk.reason}`;
  return resolveChoices(driver, choiceSequence(visit));
}

function trace(goal: string, ok: boolean, detail: string, driver: Driver, where?: CommandWhere): AutoPlayStepTrace {
  const s = driver.last.session;
  return { goal, ok, detail, ...(where ? { where } : {}), mapId: s.currentMapId, x: s.x, y: s.y };
}

function describeProgress(driver: Driver, goal: Goal): string {
  const c = goal.visit.command;
  return typeof c.variableId === "string" ? `${c.variableId}=${driver.last.session.variables[c.variableId] ?? 0}` : "";
}

/** 한 목표에서 수련 후 재도전하는 최대 횟수. */
const MAX_TRAINING_ROUNDS = 10;
/** 수련 한 번의 걸음 묶음 수(묶음당 40걸음). */
const MAX_TRAINING_CHUNKS = 100;
/** 수련 걸음 묶음 — 묶음마다 체력을 본다. 40걸음이면 얼음 동굴에서 한 묶음에 142→33 까지 깎여 센터 가는 길에 쓰러졌다. */
const TRAINING_CHUNK_STEPS = 16;

function leadLevel(session: PlaySession): number {
  return Math.max(0, ...(session.monsterParty ?? []).map((id) => session.monsterInstances?.[id]?.level ?? 0));
}

/** 리더 몬스터가 지쳤는가 — 체력 90% 아래거나 반 넘게 쓴 기술이 있다. */
function wornOut(project: Project, session: PlaySession): boolean {
  const lead = session.monsterInstances?.[session.monsterParty?.[0] ?? ""];
  if (!lead) return false;
  if (monsterCurrentHp(project, lead) < monsterMaxHp(project, lead) * 0.9) return true;
  return (lead.skillIds ?? []).some((id) => {
    const max = project.database.skills.find((skill) => skill.id === id)?.maxPp;
    const left = lead.skillPp?.[id];
    return max !== undefined && left !== undefined && left < max / 2;
  });
}

// 진 상대와 그때 파티 — 「수련해도 안 오른다」만으로는 상성 문제인지 레벨 문제인지 알 수 없었다(2026-10-06).
function partySummary(project: Project, session: PlaySession): string {
  const names = new Map((project.database.monsterSpecies ?? []).map((species) => [species.id, species.name]));
  return (session.monsterParty ?? []).map((id) => session.monsterInstances?.[id]).filter(Boolean)
    .map((m, i) => `${names.get(m!.speciesId) ?? m!.speciesId} Lv${m!.level} HP${m!.currentHp ?? "?"}${i === 0 ? ` [${(m!.skillIds ?? []).map((id) => project.database.skills.find((skill) => skill.id === id)?.name ?? id).join("·")}]` : ""}`).join(", ");
}

function troopLevel(project: Project, troopId: string): number {
  const troop = project.database.troops.find((entry) => entry.id === troopId);
  const levels = (troop?.members ?? []).map((member) => project.database.enemies.find((enemy) => enemy.id === member.enemyId)?.level ?? 0);
  return Math.max(0, ...levels);
}

/** 지금 갈 수 있는 맵 중 야생이 리더보다 세 레벨 아래인 가장 센 풀숲(없으면 가장 약한 풀숲)과 그 안의 두 칸. */
function trainingGround(project: Project, session: PlaySession, avoid: ReadonlyMap<string, number>): { mapId: string; route: Door[]; cell: { x: number; y: number } } | null {
  const lead = leadLevel(session);
  let best: { mapId: string; route: Door[]; cell: { x: number; y: number }; level: number } | null = null;
  for (const [mapId, authored] of Object.entries(project.maps)) {
    if (!authored.encounterTable?.length || (avoid.has(mapId) && lead <= avoid.get(mapId)! + 3)) continue;
    const route = routeTo(project, session.currentMapId, mapId, session);
    if (!route) continue;
    const map = runtimeMap(authored, session);
    const tileset = project.tilesets[map.tilesetId];
    let cell: { x: number; y: number } | null = null;
    let level = 0;
    const occupied = new Set((map.events ?? []).map((event) => `${event.x},${event.y}`));
    for (let y = 1; y < map.height - 1 && !cell; y++) {
      for (let x = 1; x < map.width - 2 && !cell; x++) {
        if (occupied.has(`${x},${y}`) || occupied.has(`${x + 1},${y}`)) continue;
        if (!canMove(project, map, x, y, x + 1, y) || !canMove(project, map, x + 1, y, x, y)) continue;
        // 얼음 위에서는 좌우로 오가지 못하고 미끄러진다 — 서리종 동굴 얼음 칸에서 40묶음 동안 한 번도 조우하지 못했다.
        if (tileset && (slideRuleAt(tileset, map, x, y) || slideRuleAt(tileset, map, x + 1, y))) continue;
        const here = eligibleEncounterEntries(map, session, { x, y });
        if (here.length === 0 || eligibleEncounterEntries(map, session, { x: x + 1, y }).length === 0) continue;
        level = Math.max(...here.map((entry) => troopLevel(project, entry.troopId)));
        cell = { x, y };
      }
    }
    if (!cell) continue;
    // 리더보다 세 레벨 아래까지가 안전한 수련터다. 그런 곳이 없으면 가장 약한 곳.
    const safe = (candidate: number) => candidate <= lead - 3;
    const better = !best
      || (safe(level) && (!safe(best.level) || level > best.level || (level === best.level && route.length < best.route.length)))
      || (!safe(level) && !safe(best.level) && level < best.level);
    if (better) best = { mapId, route, cell, level };
  }
  return best;
}

/** 지금 자리에서 걸어 닿는 가장 가까운 풀숲 두 칸(좌우로 오갈 수 있고 둘 다 조우 칸)의 왼쪽 칸. */
function reachableGrass(project: Project, session: PlaySession): { x: number; y: number } | null {
  const authored = project.maps[session.currentMapId];
  if (!authored) return null;
  const map = runtimeMap(authored, session);
  const occupied = new Set((map.events ?? []).map((event) => `${event.x},${event.y}`));
  const grass = (x: number, y: number) => !occupied.has(`${x},${y}`) && eligibleEncounterEntries(map, session, { x, y }).length > 0;
  const seen = new Set([`${session.x},${session.y}`]);
  const queue = [{ x: session.x, y: session.y }];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]!;
    if (grass(p.x, p.y) && grass(p.x + 1, p.y) && canMove(project, map, p.x, p.y, p.x + 1, p.y) && canMove(project, map, p.x + 1, p.y, p.x, p.y)) return p;
    for (const d of DIRS) {
      const nx = p.x + d.dx, ny = p.y + d.dy, key = `${nx},${ny}`;
      if (seen.has(key) || occupied.has(key) || !canMove(project, map, p.x, p.y, nx, ny)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

/** 가장 가까운 회복 직원(조사하면 recoverAll 하는 이벤트)에게 가서 말을 건다. 못 가면 조용히 넘어간다. */
function healAtCenter(driver: Driver, nearMapId?: string): void {
  const session = driver.last.session;
  // 싸울 맵이 주어지면 그 맵에서 가장 가까운 센터 — 수련터 곁 센터에서 회복하고 야생 길을 거슬러 오면 챔피언 앞에서 다시 지쳐 있었다.
  const distance = (mapId: string, route: Door[]) => nearMapId ? (routeTo(driver.project, mapId, nearMapId, session)?.length ?? Infinity) * 100 + route.length : route.length;
  let best: { event: GameEvent; visit: CommandVisit; route: Door[]; score: number } | null = null;
  for (const map of Object.values(driver.project.maps)) {
    for (const event of map.events ?? []) {
      if (triggerOf(event, session) !== "action") continue;
      const commands = activeCommands(event, session);
      if (!commands?.some((command) => command.kind === "recoverAll")) continue;
      const route = routeTo(driver.project, session.currentMapId, map.id, session);
      if (!route) continue;
      const score = distance(map.id, route);
      if (best && score >= best.score) continue;
      const page = event.pages?.length ? resolveEventPage(event, session) : undefined;
      const ref: PageRef = { map, event, page, pageIndex: page ? event.pages!.indexOf(page) : -1, trigger: page?.trigger ?? event.trigger, conditions: page?.conditions ?? [], commands };
      let visit: CommandVisit | undefined;
      visitPageCommands(ref, (entry) => { if (!visit && entry.command.kind === "recoverAll") visit = entry; });
      if (visit) best = { event, visit, route, score };
    }
  }
  if (!best) return;
  for (const hop of best.route) {
    if (fireEvent(driver, hop.event, hop.visit) || driver.last.session.currentMapId !== hop.to) return;
  }
  if (!fireEvent(driver, best.event, best.visit)) checkpoint(driver);
}

/** 풀숲에서 오가며 리더 몬스터를 target 레벨까지 올린다. 실패하면 이유. */
function train(driver: Driver, target: number, knockedOut = 0, heals = 0): string | null {
  // 앞 묶음이 이미 목표에 닿은 뒤 회복·재시도로 다시 들어오면 할 일이 없다 — 예전엔 0묶음 뒤 「LvN 에서 오르지 않습니다」로 끝났다.
  if (leadLevel(driver.last.session) >= target) return null;
  const ground = trainingGround(driver.project, driver.last.session, driver.badGrounds);
  if (!ground) return `리더 Lv${leadLevel(driver.last.session)} 이 수련할 풀숲으로 가는 길이 없습니다.`;
  const startLevel = leadLevel(driver.last.session);
  checkpoint(driver);
  driver.recover = true;
  try {
    const logStart = driver.last.log.length;
    const knocked = () => driver.last.log.slice(logStart).some((line) => line.startsWith("defeat recovery"));
    const retry = (why: string) => {
      if (knockedOut >= 3) return `수련하러 가다 세 번 쓰러졌습니다: ${why}`;
      driver.recover = undefined;
      checkpoint(driver);
      return train(driver, target, knockedOut + 1, heals);
    };
    for (const hop of ground.route) {
      const failure = fireEvent(driver, hop.event, hop.visit);
      if ((failure || driver.last.session.currentMapId !== hop.to) && knocked()) return retry(failure ?? "센터에서 깨어남");
      if (failure) return `문 ${hop.event.name ?? hop.event.id}: ${failure}`;
      if (driver.last.session.currentMapId !== hop.to) return `문 ${hop.event.name ?? hop.event.id} 을 썼지만 ${hop.to} 로 이동하지 않았습니다.`;
    }
    const cell = reachableGrass(driver.project, driver.last.session) ?? ground.cell;
    const spot = { id: "__training__", x: cell.x, y: cell.y, pages: [] } as unknown as GameEvent;
    const moves = pathMoves(driver.project, driver.last.session, ground.mapId, { x: driver.last.session.x, y: driver.last.session.y }, spot, false);
    if (!moves) return `${driver.project.maps[ground.mapId]?.name ?? ground.mapId} 풀숲 (${cell.x},${cell.y}) 까지 걸어갈 길이 없습니다.`;
    const walked = tryCommit(driver, moves);
    if (!walked.ok) return walked.reason;
    for (let chunk = 0; chunk < MAX_TRAINING_CHUNKS && leadLevel(driver.last.session) < target; chunk++) {
      if (Date.now() > driver.deadline) return "자동 플레이 시간 상한 초과";
      const paced = tryCommit(driver, Array.from({ length: TRAINING_CHUNK_STEPS }, (_, i) => ({ kind: "move" as const, dir: i % 2 === 0 ? "right" as const : "left" as const })));
      if (!paced.ok) return paced.reason;
      // 걸음 묶음이 조우·전투로 길어지므로 묶음마다 저장한다.
      checkpoint(driver);
      // 수련 중 쓰러져 센터에서 깨어났으면 다시 풀숲으로 간다.
      if (driver.last.session.currentMapId !== ground.mapId) {
        driver.badGrounds.set(ground.mapId, startLevel);
        if (knockedOut >= 3) return `${driver.project.maps[ground.mapId]?.name ?? ground.mapId} 에서 수련하다 세 번 쓰러졌습니다.`;
        driver.recover = undefined;
        return train(driver, target, knockedOut + 1, heals);
      }
      // 체력이 60% 아래면 센터에 들렀다 온다 — 지친 리더는 한 방에 쓰러질 야생마다 도망만 쳐서 경험치를 못 얻었다
      // (2026-10-06: 8번길에서 40묶음 내내 Lv53 그대로, 1관 타입만 바꾼 판에서 8관 패배).
      const lead = driver.last.session.monsterInstances?.[driver.last.session.monsterParty?.[0] ?? ""];
      if (lead && heals < 12 && monsterCurrentHp(driver.project, lead) < monsterMaxHp(driver.project, lead) * 0.6) {
        driver.recover = undefined;
        checkpoint(driver);
        healAtCenter(driver, ground.mapId);
        return train(driver, target, knockedOut, heals + 1);
      }
    }
    if (leadLevel(driver.last.session) <= startLevel) return `${driver.project.maps[ground.mapId]?.name ?? ground.mapId} 에서 수련해도 Lv${startLevel} 에서 오르지 않습니다.`;
    // 수련을 마치면 가까운 회복 센터에 들른다 — 회복하고, 쓰러지면 깨어날 자리(checkpointSave)도 여기로 옮긴다.
    driver.recover = undefined;
    checkpoint(driver);
    healAtCenter(driver);
    // 목표 레벨에 못 미쳐도 오른 만큼으로 다시 도전한다(다음 패배가 또 수련을 부른다).
    return null;
  } finally {
    driver.recover = undefined;
    checkpoint(driver);
  }
}

function executeGoal(driver: Driver, goal: Goal, escaped = false, trained = 0, healed = false, walkRetries = 0): AutoPlayStepTrace {
  const { project } = driver;
  const visit = goal.visit;
  const targetMap = visit.page.map?.id;
  const event = visit.page.event;
  if (!targetMap || !event) return trace(goal.label, false, "공통 이벤트 안의 명령은 자동 플레이가 부를 수 없습니다.", driver, visit.where);
  if (goal.done?.(driver.last.session, driver.last)) return trace(goal.label, true, "이미 충족돼 건너뜀", driver, visit.where);
  if (Date.now() > driver.deadline) return trace(goal.label, false, "자동 플레이 시간 상한 초과", driver, visit.where);
  const route = routeTo(project, driver.last.session.currentMapId, targetMap, driver.last.session);
  if (!route) {
    // 출구 없는 꿈 맵은 스위치 아이템(볼 꼬집기)의 자동 공통 이벤트로만 방으로 돌아온다.
    // 한 목표에서 한 번만 쓴다. 다음 세계에서는 다시 쓸 수 있다.
    const itemId = escaped ? null : switchEscapeItemId(project, driver.last.session);
    if (itemId) {
      const used = tryCommit(driver, wakeSteps(project, itemId));
      if (!used.ok) return trace(goal.label, false, `스위치 아이템 ${itemId} 사용 실패: ${used.reason}`, driver, visit.where);
      return executeGoal(driver, goal, true);
    }
    const stuckId = escaped ? null : stuckWakeItemId(project, driver.last.session);
    if (stuckId) {
      const off = tryCommit(driver, [{ kind: "set", switches: { [project.database.items.find((item) => item.id === stuckId)!.switchId!]: false } }]);
      if (!off.ok) return trace(goal.label, false, `스위치 아이템 ${stuckId} 끄기 실패: ${off.reason}`, driver, visit.where);
      return executeGoal(driver, goal, false);
    }
    return trace(goal.label, false, `${driver.last.session.currentMapId} 에서 ${project.maps[targetMap]?.name ?? targetMap}(${targetMap}) 으로 가는 문이 (현재 스위치 상태로는) 없습니다.`, driver, visit.where);
  }
  const logStart = driver.last.log.length;
  for (const hop of route) {
    const failure = fireEvent(driver, hop.event, hop.visit);
    const moved = !failure && driver.last.session.currentMapId === hop.to;
    // 가는 길에 야생에게 져 회복 센터에서 깨어났으면(게임 오버 outcome recover) 수련하고 다시 간다.
    if (!moved && project.system?.monsterCollection === true && trained < MAX_TRAINING_ROUNDS
      && driver.last.log.slice(logStart).some((line) => line.startsWith("defeat recovery"))) {
      const problem = train(driver, leadLevel(driver.last.session) + 2);
      if (problem) return trace(goal.label, false, `가는 길에 쓰러진 뒤 수련 실패: ${problem}`, driver, hop.visit.where);
      return executeGoal(driver, goal, escaped, trained + 1);
    }
    // 수련 횟수를 다 쓴 뒤에도 길에서 쓰러졌으면 센터에서 깨어난 그대로(회복됨) 다시 걸어 본다 — 레벨이 아니라 도망 운이다.
    if (!moved && project.system?.monsterCollection === true && walkRetries < 3
      && driver.last.log.slice(logStart).some((line) => line.startsWith("defeat recovery"))) {
      checkpoint(driver);
      return executeGoal(driver, goal, escaped, trained, healed, walkRetries + 1);
    }
    if (failure) return trace(goal.label, false, `문 ${hop.event.name ?? hop.event.id} → ${hop.to}: ${failure}`, driver, hop.visit.where);
    if (!moved) {
      return trace(goal.label, false, `문 ${hop.event.name ?? hop.event.id} 을 썼지만 ${hop.to} 로 이동하지 않았습니다(현재 ${driver.last.session.currentMapId}).`, driver, hop.visit.where);
    }
  }
  if (goal.done?.(driver.last.session, driver.last)) return trace(goal.label, true, "맵에 들어오며 충족됨", driver, visit.where);
  // 관장·트레이너 앞에 닿았는데 지쳤으면 실제 플레이어처럼 그 맵에서 가장 가까운 센터에 들렀다 다시 온다 — 사천왕 넷을
  // 연달아 치르거나 수련터에서 야생 길을 거슬러 오느라 기술 횟수가 바닥난 채 챔피언에게 Lv97 로 졌다(2026-10-06).
  // 무작위 인카운터 전 회복(소모전 판정)과는 별개다. 한 목표에 한 번만(회복이 안 되는 게임에서 맴돌지 않게).
  if (!healed && project.system?.monsterCollection === true && wornOut(project, driver.last.session)
    && JSON.stringify(visit.page.commands ?? []).includes('"battleProcessing"')) {
    healAtCenter(driver, targetMap);
    checkpoint(driver);
    return executeGoal(driver, goal, escaped, trained, true);
  }
  const logBefore = driver.last.log.length;
  const failure = fireEvent(driver, event, visit);
  if (failure && /걸어갈 길이 없습니다/u.test(failure)) {
    for (const other of goal.alternatives ?? []) {
      const attempt = executeGoal(driver, { ...goal, visit: other, alternatives: undefined }, escaped, trained);
      if (attempt.ok) return attempt;
    }
  }
  // 몬스터 게임에서 관장·트레이너에게 지면 실제 플레이어처럼 풀숲에서 레벨을 올리고 다시 도전한다.
  const lost = failure ? /battle (\S+): defeat/u.exec(failure) : driver.last.log.slice(logBefore).map((line) => /^battle (\S+): defeat$/u.exec(line)).find(Boolean);
  // 걷다가 야생에게 져 회복 지점에서 깨어난 것도 같다(그 전투가 진 상대).
  const woke = driver.last.log.slice(logBefore).some((line) => line.startsWith("defeat recovery"));
  const wildLoss = woke ? driver.last.log.slice(logBefore).map((line) => /^random encounter (\S+): defeat$/u.exec(line)).find(Boolean) : undefined;
  const lostTo = lost ?? wildLoss;
  if (lostTo && project.system?.monsterCollection === true && trained < MAX_TRAINING_ROUNDS && (failure || !goal.done?.(driver.last.session, driver.last))) {
    const needed = troopLevel(project, lostTo[1]!);
    // 리더가 이미 상대보다 넉넉히 높으면 레벨이 아니라 지친 채 도전한 것이다(회복 없이 습지를 건너 7관에 Lv49 로 졌다) —
    // 센터에서 회복하고 다시 도전한다. 높은 레벨에서는 풀숲 수련으로 레벨이 거의 오르지 않아 「수련 실패」로 끝났다.
    if (trained === 0 && leadLevel(driver.last.session) >= needed + 3) {
      checkpoint(driver);
      healAtCenter(driver);
      checkpoint(driver);
      return executeGoal(driver, goal, escaped, trained + 1);
    }
    const problem = train(driver, Math.max(leadLevel(driver.last.session) + 2, needed + 3));
    const stalled = driver.last.log.slice(logBefore).find((line) => line.startsWith(`battle ${lostTo[1]}: stalled`));
    if (problem) return trace(goal.label, false, `${failure ?? "이벤트 전투 패배"} — 수련 실패: ${problem} (상대 ${lostTo[1]}, 파티 ${partySummary(project, driver.last.session)})${stalled ? ` · ${stalled}` : ""}`, driver, visit.where);
    return executeGoal(driver, goal, escaped, trained + 1);
  }
  if (failure) return trace(goal.label, false, failure, driver, visit.where);
  if (lostTo && project.system?.monsterCollection === true && !goal.done?.(driver.last.session, driver.last)) {
    return trace(goal.label, false, `이벤트 전투 패배 — 수련 ${trained}번 뒤에도 ${lostTo[1]} 을 넘지 못했습니다(파티 ${partySummary(project, driver.last.session)}).`, driver, visit.where);
  }
  const verdict = goal.verify?.(driver.last.session, driver.last);
  if (verdict) return { ...trace(goal.label, false, verdict, driver, visit.where), ...(goal.soft ? { soft: true } : {}) };
  for (let round = 1; goal.repeat && goal.done && !goal.done(driver.last.session, driver.last) && round < goal.repeat.max; round += 1) {
    for (const reset of goal.repeat.resets) {
      const step = executeGoal(driver, reset);
      if (!step.ok) return trace(goal.label, false, `${round}번째 뒤 되풀이 준비(${reset.label})에 실패했습니다: ${step.detail}`, driver, reset.visit.where);
    }
    const again = executeGoal(driver, { ...goal, repeat: undefined, done: undefined });
    if (!again.ok) {
      return trace(goal.label, false, `${round}번 되풀이한 뒤 더 할 수 없습니다(지금 ${describeProgress(driver, goal)}): ${again.detail}`, driver, goal.visit.where);
    }
  }
  if (goal.done && !goal.done(driver.last.session, driver.last)) {
    if (goal.repeat) return trace(goal.label, false, `되풀이해도 문턱에 닿지 않습니다(지금 ${describeProgress(driver, goal)}).`, driver, visit.where);
    // 이벤트 안 전투(대개 보스)에져 게임 오버가 났으면 「다른 페이지가 실행됐다」로 보면 오판이다 —
    // 승리 분기의 목표 명령이 실행되지 않은 원인을 전투 패배라고 못박는다(2026-09-24 JRPG 도그푸딩: 등대·잿불 광산 보스전).
    const lostBattle = driver.last.finalState.gameOver && driver.last.log.some((line) => /^battle .+: defeat$/u.test(line));
    if (lostBattle) {
      const battles = driver.last.log.filter((line) => /^(?:battle|random encounter|field spawn)/u.test(line));
      return trace(goal.label, false,
        `이벤트 전투에서 패배해 게임 오버 — 승리 분기의 목표 명령에 닿지 않았습니다${battles.length ? ` — 전투 ${battles.length}회, 마지막: ${battles.slice(-3).join(" / ")}` : ""}`,
        driver, visit.where);
    }
    return trace(goal.label, false, `이벤트는 돌았지만 목표가 충족되지 않았습니다 (페이지 ${visit.page.pageIndex + 1} 대신 다른 페이지가 실행됐거나 선택지·조건 분기가 목표 명령을 건너뜀).`, driver, visit.where);
  }
  return trace(goal.label, true, "완료", driver, visit.where);
}

export function endingGoal(visit: CommandVisit): Goal {
  const endingId = typeof visit.command.endingId === "string" ? visit.command.endingId : undefined;
  const title = typeof visit.command.title === "string" ? visit.command.title : undefined;
  return {
    label: `엔딩 ${endingId ?? title ?? "(자동 선택)"} 도달`, visit,
    done: (_session, result) => visit.command.kind === "triggerEnding"
      ? (endingId ? result.finalState.endingsReached.includes(endingId) : result.finalState.endingsReached.length > 0)
      : false,
    verify: (_session, result) => (visit.command.kind === "ending"
      ? (result.log.some((line) => line.includes(`event ${visit.page.event?.id} start`)) ? null : "엔딩 이벤트가 실행되지 않았습니다.")
      : null),
  };
}

function joinGoal(project: Project, visit: CommandVisit): Goal {
  const actorId = typeof visit.command.actorId === "string" ? visit.command.actorId : undefined;
  const actors = new Set(project.database.actors.map((actor) => actor.id));
  return {
    label: `동료 합류 (${actorId ?? JSON.stringify(visit.command)})`, visit, soft: true,
    verify: (session) => {
      const bad = session.partyActorIds.filter((id) => typeof id !== "string" || !actors.has(id));
      if (bad.length > 0) return `합류 뒤 파티에 없는 배우가 들어갔습니다: ${JSON.stringify(session.partyActorIds)} — 전투에서 「Missing actor」로 멈춥니다.`;
      if (!actorId || !actors.has(actorId)) return `합류 명령에 유효한 배우(actorId)가 없어 파티가 늘지 않았습니다 — 파티 ${JSON.stringify(session.partyActorIds)}, 명령 ${JSON.stringify(visit.command)}.`;
      if (!session.partyActorIds.includes(actorId)) return `합류 명령이 돌았지만 ${actorId} 가 파티에 없습니다(파티 ${JSON.stringify(session.partyActorIds)}).`;
      return null;
    },
  };
}

function starterGoal(visit: CommandVisit): Goal {
  return {
    label: `첫 파트너 받기 (${String(visit.command.speciesId ?? "?")})`, visit,
    verify: (session) => ((session.monsterParty ?? []).length > 0 ? null : `giveMonster 가 돌았지만 파티 몬스터가 없습니다 — ${JSON.stringify(visit.command)}`),
  };
}

function runPlan(project: Project, label: string, goals: readonly Goal[], deadline: number, preamble: readonly string[] = []): AutoPlayRun {
  const started = Date.now();
  const first = quietScene(project, []);
  const driver: Driver = { project, steps: [], runs: 1, last: first, deadline, committed: 0, badGrounds: new Map() };
  const steps: AutoPlayStepTrace[] = preamble.map((detail) => ({ goal: "계획", ok: false, detail }));
  if (!first.ok) {
    const failure: AutoPlayStepTrace = { goal: "게임 시작(자동 실행 이벤트)", ok: false, detail: first.failureReason ?? "시작 실패", mapId: project.startMapId };
    return { label, ok: false, steps: [...steps, failure], failure, sceneSteps: 0, runs: 1, ms: Date.now() - started };
  }
  // 시작 직후 오프닝이 선택지를 붙잡고 있으면 먼저 넘긴다.
  resolveChoices(driver, []);
  let firstFailure: AutoPlayStepTrace | undefined;
  const queue = [...goals];
  for (let index = 0; index < queue.length; index++) {
    const goal = queue[index]!;
    let step = executeGoal(driver, goal);
    // 장치 순서가 정해진 퍼즐(두 번째 바위를 밀어야 첫 바위에 닿는다)은 계획 순서가 거꾸로일 수 있다 —
    // 같은 맵의 다음 목표 하나를 먼저 하고 다시 시도한다(2026-10-06 몬스터 원정 용마루 체육관).
    if (!step.ok && !step.soft && /걸어갈 길이 없습니다/u.test(step.detail)) {
      for (let later = index + 1; later < Math.min(queue.length, index + 6); later++) {
        const other = queue[later]!;
        if (other.visit.page.map?.id !== goal.visit.page.map?.id) continue;
        const opened = executeGoal(driver, other);
        if (!opened.ok) continue;
        steps.push(opened);
        queue.splice(later, 1);
        step = executeGoal(driver, goal);
        break;
      }
    }
    steps.push(step);
    // 긴 몬스터 캠페인은 목표마다 저장 지점을 옮긴다(처음부터 다시 돌리면 시간 상한에 걸린다).
    if (step.ok && project.system?.monsterCollection === true) checkpoint(driver);
    if (!step.ok && step.soft) { firstFailure ??= step; continue; }
    if (!step.ok) {
      return { label, ok: false, steps, failure: firstFailure ?? step, sceneSteps: driver.committed + driver.steps.length, runs: driver.runs, ms: Date.now() - started, partyAtEnd: driver.last.session.partyActorIds.map((id) => (typeof id === "string" ? id : null)) };
    }
  }
  const reached = driver.last.finalState.endingsReached[0];
  return { label, ok: !firstFailure, ...(firstFailure ? { failure: firstFailure } : {}), ...(reached ? { endingReached: reached } : {}), steps, sceneSteps: driver.committed + driver.steps.length, runs: driver.runs, ms: Date.now() - started, partyAtEnd: driver.last.session.partyActorIds.map((id) => (typeof id === "string" ? id : null)) };
}

/** 엔딩별 자동 플레이 상한(첫 엔딩 포함). */
const MAX_ENDING_RUNS = 5;

function endingKey(visit: CommandVisit): string {
  return typeof visit.command.endingId === "string" ? visit.command.endingId
    : typeof visit.command.title === "string" ? visit.command.title : `${visit.where.mapId}/${visit.where.eventId}`;
}

export function runAutoPlay(
  project: Project,
  options: { readonly budgetMs?: number; readonly companionJoins?: readonly CommandVisit[]; readonly recoverBeforeRandomEncounters?: boolean } = {},
): AutoPlayReport {
  if (options.recoverBeforeRandomEncounters) RECOVERING_PROJECTS.add(project);
  else RECOVERING_PROJECTS.delete(project);
  const deadline = Date.now() + (options.budgetMs ?? 60_000);
  const targets: CommandVisit[] = [];
  for (const page of allPages(project)) {
    if (!page.map || !page.event) continue;
    visitPageCommands(page, (visit) => { if (visit.command.kind === "triggerEnding" || visit.command.kind === "ending") targets.push(visit); });
  }
  if (!project.maps[project.startMapId]) return { targets: [], plan: [], runs: [], skipped: "시작 맵이 없어 자동 플레이를 못 합니다." };
  if (targets.length === 0) return { targets: [], plan: [], runs: [], skipped: "엔딩을 부르는 맵 이벤트가 없어 목표가 없습니다." };
  // endingId 가 있는 triggerEnding 을 먼저 — 가장 분명한 목표다.
  targets.sort((a, b) => Number(Boolean(b.command.endingId)) - Number(Boolean(a.command.endingId)));
  const target = targets[0]!;
  const plan = planCriticalPath(project, target, endingGoal(target));
  const preamble = plan.unresolved.map((u) => `선행 조건 ${u.req} 을 채울 이벤트를 찾지 못했습니다 (${u.for.mapId ?? ""} ${u.for.eventId ?? ""})`);
  // 몬스터 수집: 실제 플레이어는 먼저 박사에게 파트너를 받는다 — 영웅 혼자 야생·관장과 싸우는 경로는 거짓 막힘을 낸다.
  let give: CommandVisit | undefined;
  if (project.system?.monsterCollection === true) {
    for (const page of allPages(project)) {
      if (give || !page.map || !page.event) continue;
      visitPageCommands(page, (visit) => { if (!give && visit.command.kind === "giveMonster") give = visit; });
    }
  }
  const starter = give ? planCriticalPath(project, give, starterGoal(give)) : undefined;
  const runs: AutoPlayRun[] = [starter
    ? runPlan(project, "기본 경로(파트너 받고)", [...starter.goals, ...plan.goals], deadline, [...starter.unresolved.map((u) => `선행 조건 ${u.req} 을 채울 이벤트를 찾지 못했습니다`), ...preamble])
    : runPlan(project, "기본 경로", plan.goals, deadline, preamble)];
  // 합류하는 동료를 모두(배우별 첫 합류, 최대 MAX_COMPANION_JOINS 명) 차례로 데려간다 — JRPG 는 3인 파티를 전제로
  // 층마다 적을 세운다. 첫 동료만 데려가면 3층 순찰대에 둘이서 쓰러지는 거짓 막힘이 났다(2026-09-24 도그푸딩).
  const joins: CommandVisit[] = [];
  const joinedActors = new Set<string>();
  for (const join of options.companionJoins ?? []) {
    if (!join.page.map || !join.page.event || joins.length >= MAX_COMPANION_JOINS) continue;
    const actorKey = typeof join.command.actorId === "string" ? join.command.actorId : JSON.stringify(join.command);
    if (joinedActors.has(actorKey)) continue;
    joinedActors.add(actorKey);
    joins.push(join);
  }
  if (joins.length > 0) {
    const joinPlans = joins.map((join) => planCriticalPath(project, join, joinGoal(project, join)));
    const goals = [...joinPlans.flatMap((joinPlan) => joinPlan.goals), ...plan.goals];
    const unresolved = joinPlans.flatMap((joinPlan) => joinPlan.unresolved.map((u) => `선행 조건 ${u.req} 을 채울 이벤트를 찾지 못했습니다`));
    runs.push(runPlan(project, "동료 합류 후", goals, deadline, [...unresolved, ...preamble]));
  }
  // 나머지 엔딩도 하나씩 걸어 본다 — 추리의 오답 엔딩처럼 「다른 결말」이 소프트락인지는 첫 엔딩만 봐서는 모른다.
  const seenEndings = new Set([endingKey(target)]);
  for (const other of targets.slice(1)) {
    const key = endingKey(other);
    if (seenEndings.has(key) || seenEndings.size >= MAX_ENDING_RUNS || Date.now() > deadline) continue;
    seenEndings.add(key);
    const otherPlan = planCriticalPath(project, other, endingGoal(other));
    runs.push(runPlan(project, `다른 엔딩 ${key}`, otherPlan.goals, deadline,
      otherPlan.unresolved.map((u) => `선행 조건 ${u.req} 을 채울 이벤트를 찾지 못했습니다 (${u.for.mapId ?? ""} ${u.for.eventId ?? ""})`)));
  }
  return {
    targets: targets.map((visit) => ({ label: visit.command.kind === "triggerEnding" ? `triggerEnding ${String(visit.command.endingId ?? "(자동)")}` : `ending ${String(visit.command.title ?? "")}`, where: visit.where })),
    plan: plan.goals.map((goal) => `${goal.label} — ${goal.visit.where.mapName ?? goal.visit.where.mapId} / ${goal.visit.where.eventName ?? goal.visit.where.eventId}`),
    runs,
  };
}
