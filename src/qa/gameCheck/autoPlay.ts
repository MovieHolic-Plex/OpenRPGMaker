// 자동 플레이 — 엔딩에서 거꾸로 사슬을 만들고(엔딩 ← 그 페이지를 여는 스위치 ← 그 스위치를 켜는 이벤트 ← …),
// 실제 헤드리스 런타임(`testing/sceneTestRunner.runSceneTest`, run_scene_test 도구와 같은 엔진)으로 걸어서 실행한다.
//
// 걷기는 런타임의 충돌 판정으로 BFS 하고, 전투는 러너가 결정적으로 푼다(seed 1, 첫 적을 계속 공격),
// 선택지는 목표 명령이 든 보기를 고른다. 처음 실패한 목표를 맵·이벤트·명령 자리와 함께 보고한다.
//
// 러너는 매번 새 세션으로 처음부터 돈다 — 목표 하나를 붙일 때마다 누적 단계 전체를 다시 돌린다(작은 게임이면 수 초).

import { canMove } from "@/project/collision";
import { resolveEventPage } from "@/project/io";
import type { PlaySession } from "@/project/session";
import type { GameEvent, Project } from "@/project/types";
import { runSceneTest, type SceneStep, type SceneTestResult } from "@/testing/sceneTestRunner";
import { initiallyOn } from "./progression";
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

/**
 * 맵이 「잠겨」 있는가 — 시작 맵이 아니고, 조건 없이 열리는 문(그 문이 있는 맵도 안 잠김)이 하나도 없다.
 * 잠긴 맵의 목표는 그 맵으로 들어가는 문을 먼저 여는 사슬이 필요하다. 없던 때는 두 번째 기억부터
 * 「가는 문이 (현재 스위치 상태로는) 없습니다」로 오판했다(2026-09-24 회상 스토리 도그푸딩).
 */
function mapGated(project: Project, mapId: string, visiting = new Set<string>()): boolean {
  if (mapId === project.startMapId) return false;
  if (visiting.has(mapId)) return true;
  visiting.add(mapId);
  try {
    return !entriesInto(project, mapId).some((entry) =>
      baseRequirementsOf(project, entry).length === 0 && !mapGated(project, entry.page.map!.id, visiting));
  } finally {
    visiting.delete(mapId);
  }
}

function requirementsOf(project: Project, visit: CommandVisit): Requirement[] {
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

function baseRequirementsOf(project: Project, visit: CommandVisit): Requirement[] {
  const reqs: Requirement[] = [];
  // 엔딩 조건(호감)을 페이지 조건(요일)보다 먼저 채운다. 만남 잠금을 푸는 명령이
  // 요일을 올리는 이른 페이지에만 있으면, 요일을 먼저 끝까지 밀면 호감을 되풀이할 수 없다.
  if (visit.command.kind === "triggerEnding") {
    const namedId = typeof visit.command.endingId === "string" ? visit.command.endingId : undefined;
    const ending = namedId
      ? (project.endings ?? []).find((entry) => entry.id === namedId)
      : [...(project.endings ?? [])].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
    // 이름 있는 triggerEnding 도 엔딩 conditions 를 선행으로 본다. 런타임이 조건 미달이면
    // 엔딩을 열지 않으므로, 호감 ≥ 6 없이 고백 선택지만 누르면 도달로 세면 안 된다.
    for (const condition of ending?.conditions ?? []) reqs.push(...leafRequirements(condition, visit.page));
  }
  for (const condition of visit.page.conditions) reqs.push(...leafRequirements(condition, visit.page));
  for (const segment of visit.segments) {
    if (segment.kind !== "fork") continue;
    if (segment.branch === "then") reqs.push(...leafRequirements(segment.command.condition, visit.page));
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

function setterMatches(req: Requirement, visit: CommandVisit): boolean {
  const c = visit.command;
  switch (req.kind) {
    case "switch": return c.kind === "setSwitch" && c.switchId === req.id && (c.value === true || c.value === "toggle" || (typeof c.value === "object" && c.value !== null));
    case "selfSwitch": return c.kind === "setSelfSwitch" && c.key === req.key && c.value === true && visit.page.event?.id === req.eventId && visit.page.map?.id === req.mapId;
    case "variable": return c.kind === "setVariable" && c.variableId === req.id && movesToward(req, c);
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
  const planMapEntry = (mapId: string, depth: number): boolean => {
    if (openMaps.has(mapId) || planned.has(`map:${mapId}`)) return true;
    if (mapsInProgress.has(mapId)) return false;
    mapsInProgress.add(mapId);
    const doors = doorVisits.filter((door) => door.command.mapId === mapId)
      .sort((a, b) => requirementsOf(project, a).length - requirementsOf(project, b).length);
    let ok = false;
    for (const door of doors) {
      const snapshot = goals.length;
      // 문 자체는 routeTo 가 지난다 — 여기서는 문의 선행 조건만 사슬에 넣는다.
      if (planVisit(door, depth + 1)) { ok = true; break; }
      goals.length = snapshot;
    }
    mapsInProgress.delete(mapId);
    if (ok) planned.add(`map:${mapId}`);
    return ok;
  };
  const planVisit = (visit: CommandVisit, depth: number): boolean => {
    if (depth > 12) return false;
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
      const candidates = visits.filter((candidate) => setterMatches(req, candidate) && map[candidate.page.map!.id])
        .sort((a, b) => requirementsOf(project, a).length - requirementsOf(project, b).length
          || (preferLargerStep ? stepToward(b) - stepToward(a) : 0)
          || a.segments.length - b.segments.length);
      let ok = false;
      for (const candidate of candidates) {
        const snapshot = goals.length;
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
          });
          ok = true;
          break;
        }
        goals.length = snapshot;
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
}

/** runAutoPlay({ recoverBeforeRandomEncounters }) 로 도는 프로젝트 — 인카운터 직전마다 파티를 회복한다. */
const MAX_COMPANION_JOINS = 3;

const RECOVERING_PROJECTS = new WeakSet<Project>();

/** 러너는 같은 단계를 몇 번이고 다시 돈다 — 런타임 경고(console.warn)가 매번 쏟아지지 않게 모아 둔다. */
function quietScene(project: Project, steps: SceneStep[]): SceneTestResult {
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    return runSceneTest(project, { mapId: project.startMapId, start: project.startPos, steps }, undefined,
      { recoverBeforeRandomEncounters: RECOVERING_PROJECTS.has(project) });
  } finally {
    console.warn = warn;
  }
}

function run(driver: Driver, steps: SceneStep[]): SceneTestResult {
  driver.runs += 1;
  return quietScene(driver.project, steps);
}

function tryCommit(driver: Driver, extra: SceneStep[]): { ok: true } | { ok: false; reason: string; result: SceneTestResult } {
  const steps = [...driver.steps, ...extra];
  const result = run(driver, steps);
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
      if (visit.command.kind === "transfer" && typeof visit.command.mapId === "string" && visit.command.mapId !== mapId) {
        doors.push({ event, to: visit.command.mapId, visit });
      }
    });
  }
  return doors;
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
function pathMoves(project: Project, mapId: string, from: { x: number; y: number }, target: GameEvent, adjacent: boolean): SceneStep[] | null {
  const map = project.maps[mapId];
  if (!map) return null;
  // 문 앞 발판(`<문>_step`)처럼 목표를 callMapEvent 로 부르기만 하는 접촉 이벤트는 목표와 같은 칸으로 친다 —
  // 2층 집 문은 벽 줄에 붙어 발판으로만 닿는데, 발판을 「다른 이벤트」로 피하면 문이 영영 막힌 것으로 보였다.
  const relays = adjacent ? [] : (map.events ?? []).filter((event) => event.id !== target.id && relaysTo(event, target.id));
  const relayCells = new Set(relays.map((event) => `${event.x},${event.y}`));
  // 밟아도 아무 일 없는 이벤트(모든 페이지가 발밑·겹침 허용이고 접촉 발동이 아님 — 조사 지점·자동 컷신 자리)는 지나간다.
  // 전부 피하면 좁은 기억 방(11×9)에서 투명 조사 지점·컷신 자리에 둘러싸인 메멘토가 「길이 없다」로 오판됐다(2026-09-24).
  const harmless = (event: GameEvent) => (event.pages ?? []).length > 0 && (event.pages ?? []).every((page) =>
    page.priority === "below" && page.overlapForbidden === false
    && !["playerTouch", "touch", "eventTouch"].includes(page.trigger?.kind ?? ""));
  const occupied = new Set((map.events ?? []).filter((event) => event.id !== target.id && !harmless(event)).map((event) => `${event.x},${event.y}`).filter((cell) => !relayCells.has(cell)));
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
  const moves = pathMoves(driver.project, mapId, { x: session.x, y: session.y }, event, !touch);
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

function executeGoal(driver: Driver, goal: Goal, escaped = false): AutoPlayStepTrace {
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
  for (const hop of route) {
    const failure = fireEvent(driver, hop.event, hop.visit);
    if (failure) return trace(goal.label, false, `문 ${hop.event.name ?? hop.event.id} → ${hop.to}: ${failure}`, driver, hop.visit.where);
    if (driver.last.session.currentMapId !== hop.to) {
      return trace(goal.label, false, `문 ${hop.event.name ?? hop.event.id} 을 썼지만 ${hop.to} 로 이동하지 않았습니다(현재 ${driver.last.session.currentMapId}).`, driver, hop.visit.where);
    }
  }
  if (goal.done?.(driver.last.session, driver.last)) return trace(goal.label, true, "맵에 들어오며 충족됨", driver, visit.where);
  const failure = fireEvent(driver, event, visit);
  if (failure) return trace(goal.label, false, failure, driver, visit.where);
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
  const driver: Driver = { project, steps: [], runs: 1, last: first, deadline };
  const steps: AutoPlayStepTrace[] = preamble.map((detail) => ({ goal: "계획", ok: false, detail }));
  if (!first.ok) {
    const failure: AutoPlayStepTrace = { goal: "게임 시작(자동 실행 이벤트)", ok: false, detail: first.failureReason ?? "시작 실패", mapId: project.startMapId };
    return { label, ok: false, steps: [...steps, failure], failure, sceneSteps: 0, runs: 1, ms: Date.now() - started };
  }
  // 시작 직후 오프닝이 선택지를 붙잡고 있으면 먼저 넘긴다.
  resolveChoices(driver, []);
  let firstFailure: AutoPlayStepTrace | undefined;
  for (const goal of goals) {
    const step = executeGoal(driver, goal);
    steps.push(step);
    if (!step.ok && step.soft) { firstFailure ??= step; continue; }
    if (!step.ok) {
      return { label, ok: false, steps, failure: firstFailure ?? step, sceneSteps: driver.steps.length, runs: driver.runs, ms: Date.now() - started, partyAtEnd: driver.last.session.partyActorIds.map((id) => (typeof id === "string" ? id : null)) };
    }
  }
  const reached = driver.last.finalState.endingsReached[0];
  return { label, ok: !firstFailure, ...(firstFailure ? { failure: firstFailure } : {}), ...(reached ? { endingReached: reached } : {}), steps, sceneSteps: driver.steps.length, runs: driver.runs, ms: Date.now() - started, partyAtEnd: driver.last.session.partyActorIds.map((id) => (typeof id === "string" ? id : null)) };
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
