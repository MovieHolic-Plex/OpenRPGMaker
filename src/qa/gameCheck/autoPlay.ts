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
  | { readonly kind: "variable"; readonly id: string }
  | { readonly kind: "item"; readonly id: string }
  | { readonly kind: "actor"; readonly id: string };

interface Goal {
  readonly label: string;
  readonly visit: CommandVisit;
  /** 이 목표가 끝났는지 세션으로 확인한다. 없으면 «실패 없이 이벤트가 돌았다» 로 본다. */
  readonly done?: (session: PlaySession, result: SceneTestResult) => boolean;
  readonly verify?: (session: PlaySession, result: SceneTestResult) => string | null;
  /** 검증이 실패해도 기록만 하고 다음 목표로 간다 — 뒤에서 무엇이 터지는지까지 보여 준다. */
  readonly soft?: boolean;
}

function requirementLabel(project: Project, req: Requirement): string {
  switch (req.kind) {
    case "switch": return `스위치 ${project.switches.find((s) => s.id === req.id)?.name || req.id}`;
    case "selfSwitch": return `셀프 스위치 ${req.eventId}.${req.key}`;
    case "variable": return `변수 ${req.id}`;
    case "item": return `아이템 ${req.id}`;
    case "actor": return `배우 ${req.id} 합류`;
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
    if (leaf.kind === "variable" && typeof leaf.variableId === "string") out.push({ kind: "variable", id: leaf.variableId });
    if (leaf.kind === "item" && leaf.present === true && typeof leaf.itemId === "string") out.push({ kind: "item", id: leaf.itemId });
    if (leaf.kind === "actor" && leaf.present === true && typeof leaf.actorId === "string") out.push({ kind: "actor", id: leaf.actorId });
  }
  return out;
}

function requirementsOf(project: Project, visit: CommandVisit): Requirement[] {
  const reqs: Requirement[] = [];
  for (const condition of visit.page.conditions) reqs.push(...leafRequirements(condition, visit.page));
  for (const segment of visit.segments) {
    if (segment.kind === "fork" && segment.branch === "then") reqs.push(...leafRequirements(segment.command.condition, visit.page));
  }
  if (visit.command.kind === "triggerEnding" && !visit.command.endingId) {
    const ending = [...(project.endings ?? [])].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
    for (const condition of ending?.conditions ?? []) reqs.push(...leafRequirements(condition, visit.page));
  }
  return reqs;
}

function satisfiedAtStart(project: Project, req: Requirement): boolean {
  if (req.kind === "switch") return initiallyOn(project, req.id);
  if (req.kind === "actor") return (project.session?.partyActorIds ?? []).includes(req.id);
  if (req.kind === "item") return (project.session?.inventory?.[req.id] ?? 0) > 0;
  return false;
}

function setterMatches(req: Requirement, visit: CommandVisit): boolean {
  const c = visit.command;
  switch (req.kind) {
    case "switch": return c.kind === "setSwitch" && c.switchId === req.id && (c.value === true || c.value === "toggle" || (typeof c.value === "object" && c.value !== null));
    case "selfSwitch": return c.kind === "setSelfSwitch" && c.key === req.key && c.value === true && visit.page.event?.id === req.eventId && visit.page.map?.id === req.mapId;
    case "variable": return c.kind === "setVariable" && c.variableId === req.id;
    case "item": return c.kind === "changeItem" && c.itemId === req.id && c.op !== "-=";
    case "actor": return c.kind === "changeParty" && c.actorId === req.id && c.action === "add";
  }
}

function reqKey(req: Requirement): string {
  return req.kind === "selfSwitch" ? `self:${req.mapId}:${req.eventId}:${req.key}` : `${req.kind}:${req.id}`;
}

export interface CriticalPlan {
  readonly goals: readonly Goal[];
  readonly unresolved: readonly { readonly req: string; readonly for: CommandWhere }[];
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
  const planVisit = (visit: CommandVisit, depth: number): boolean => {
    if (depth > 12) return false;
    for (const req of requirementsOf(project, visit)) {
      const key = reqKey(req);
      if (planned.has(key) || satisfiedAtStart(project, req)) continue;
      if (inProgress.has(key)) return false;
      inProgress.add(key);
      // 가장 얕은 세터를 고른다 — 선행 조건이 적은 후보부터.
      const candidates = visits.filter((candidate) => setterMatches(req, candidate) && map[candidate.page.map!.id])
        .sort((a, b) => requirementsOf(project, a).length - requirementsOf(project, b).length || a.segments.length - b.segments.length);
      let ok = false;
      for (const candidate of candidates) {
        const snapshot = goals.length;
        if (planVisit(candidate, depth + 1)) {
          goals.push({
            label: `${requirementLabel(project, req)} 켜기`, visit: candidate,
            done: (session) => req.kind === "switch" ? session.switches[req.id] === true
              : req.kind === "selfSwitch" ? session.selfSwitches?.[req.eventId]?.[req.key] === true
              : req.kind === "actor" ? session.partyActorIds.includes(req.id)
              : req.kind === "item" ? (session.inventory[req.id] ?? 0) > 0 : false,
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

/** 러너는 같은 단계를 몇 번이고 다시 돈다 — 런타임 경고(console.warn)가 매번 쏟아지지 않게 모아 둔다. */
function quietScene(project: Project, steps: SceneStep[]): SceneTestResult {
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    return runSceneTest(project, { mapId: project.startMapId, start: project.startPos, steps });
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
  if (!result.ok) return { ok: false, reason: result.failureReason ?? "알 수 없는 실패", result };
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
  const occupied = new Set((map.events ?? []).filter((event) => event.id !== target.id).map((event) => `${event.x},${event.y}`).filter((cell) => !relayCells.has(cell)));
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

function executeGoal(driver: Driver, goal: Goal): AutoPlayStepTrace {
  const { project } = driver;
  const visit = goal.visit;
  const targetMap = visit.page.map?.id;
  const event = visit.page.event;
  if (!targetMap || !event) return trace(goal.label, false, "공통 이벤트 안의 명령은 자동 플레이가 부를 수 없습니다.", driver, visit.where);
  if (goal.done?.(driver.last.session, driver.last)) return trace(goal.label, true, "이미 충족돼 건너뜀", driver, visit.where);
  if (Date.now() > driver.deadline) return trace(goal.label, false, "자동 플레이 시간 상한 초과", driver, visit.where);
  const route = routeTo(project, driver.last.session.currentMapId, targetMap, driver.last.session);
  if (!route) return trace(goal.label, false, `${driver.last.session.currentMapId} 에서 ${project.maps[targetMap]?.name ?? targetMap}(${targetMap}) 으로 가는 문이 (현재 스위치 상태로는) 없습니다.`, driver, visit.where);
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
  if (goal.done && !goal.done(driver.last.session, driver.last)) {
    return trace(goal.label, false, `이벤트는 돌았지만 목표가 충족되지 않았습니다 (페이지 ${visit.page.pageIndex + 1} 대신 다른 페이지가 실행됐거나 선택지·조건 분기가 목표 명령을 건너뜀).`, driver, visit.where);
  }
  return trace(goal.label, true, "완료", driver, visit.where);
}

function endingGoal(visit: CommandVisit): Goal {
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

export function runAutoPlay(project: Project, options: { readonly budgetMs?: number; readonly companionJoins?: readonly CommandVisit[] } = {}): AutoPlayReport {
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
  const runs: AutoPlayRun[] = [runPlan(project, "기본 경로", plan.goals, deadline, preamble)];
  const join = options.companionJoins?.[0];
  if (join && join.page.map && join.page.event) {
    const joinPlan = planCriticalPath(project, join, joinGoal(project, join));
    const goals = [...joinPlan.goals, ...plan.goals];
    runs.push(runPlan(project, "동료 합류 후", goals, deadline, [...joinPlan.unresolved.map((u) => `선행 조건 ${u.req} 을 채울 이벤트를 찾지 못했습니다`), ...preamble]));
  }
  return {
    targets: targets.map((visit) => ({ label: visit.command.kind === "triggerEnding" ? `triggerEnding ${String(visit.command.endingId ?? "(자동)")}` : `ending ${String(visit.command.title ?? "")}`, where: visit.where })),
    plan: plan.goals.map((goal) => `${goal.label} — ${goal.visit.where.mapName ?? goal.visit.where.mapId} / ${goal.visit.where.eventName ?? goal.visit.where.eventId}`),
    runs,
  };
}
