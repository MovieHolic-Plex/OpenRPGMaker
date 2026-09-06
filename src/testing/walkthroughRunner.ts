// testing/walkthroughRunner.ts
// 브라우저/Phaser 없이 세션 + 인터프리터 + 전투 시뮬만으로 시나리오를 완주 검증하는 러너.
// Phase 4-2 핵심: CI에서 "잿불의 유산" 3퀘스트 + 엔딩 자동 완주. 고의 파손 시 실패 스텝 리포트.
//
// 동작: 시나리오 스텝을 순서대로 처리한다.
//  - interact  : 현재 맵의 이벤트 활성 페이지(resolveEventPage)를 인터프리터로 실행.
//  - choose    : 직전 interact가 choices에서 멈췄을 때 선택지 index로 재개.
//  - moveTo    : 같은 맵이면 reachability로 경로 존재를 검증하고 좌표 이동. 다른 맵이면 직접 이동(경고).
//  - battle    : 직전에 처리된 전투 결과를 검증(interact 안에서 battleProcessing은 자동 시뮬).
//  - expect *  : 세션 상태(스위치/아이템/변수/맵/골드/엔딩) 단언.
// 쓰기 툴이 아니라 "플레이어" 관점이므로 store를 건드리지 않는다(순수).

import { BattleEventInputRequiredError, createBattleRuntime } from "@/battle/runtime";
import type { BattleRuntimeOptions } from "@/battle/types";
import { checkReachability } from "@/project/lint/reachability";
import { eventAtPoint } from "@/project/eventFootprintQuery";
import { resolveEventPage } from "@/project/io";
import { getSwitch, getVariable, startSession, type PlaySession } from "@/project/session";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { createInterpreter, type StepResult } from "@/player/interpreter";
import type { Project } from "@/project/types";

// ── 시나리오 스텝 ────────────────────────────────────────────────
export type WalkthroughStep =
  | { do: "moveTo"; mapId: string; x: number; y: number }
  // 이벤트를 id로 지정하거나(eventId), 좌표로 지정한다(x,y — 현재 맵의 해당 칸 이벤트).
  | { do: "interact"; eventId: string; x?: number; y?: number }
  | { do: "interact"; eventId?: undefined; x: number; y: number }
  | { do: "choose"; index: number }
  | { do: "battle"; expect: "victory" | "defeat" }
  | { expect: "switch"; switchId: string; value?: boolean }
  | { expect: "item"; itemId: string; present?: boolean; count?: number }
  | { expect: "variable"; variableId: string; op?: "="|">="|"<="|">"|"<"; value: number }
  | { expect: "mapId"; mapId: string }
  | { expect: "gold"; op?: "="|">="|"<="|">"|"<"; value: number }
  | { expect: "ended" };

export interface WalkthroughOptions {
  seed?: number;
  onLog?: (line: string) => void;
}

export interface WalkthroughResult {
  ok: boolean;
  stepsRun: number;
  totalSteps: number;
  failedStepIndex?: number;
  failedStep?: WalkthroughStep;
  failureReason?: string;
  reachedEnding: boolean;
  log: string[];
  session: PlaySession;
}

type WalkthroughScenarioValidation =
  | Readonly<{ ok: true; steps: readonly WalkthroughStep[] }>
  | Readonly<{ ok: false; index: number; reason: string; totalSteps: number }>;

const COMPARISON_OPS = new Set(["=", ">=", "<=", ">", "<"]);

/** Strict boundary parser shared by headless and editor callers before any step executes. */
export function validateWalkthroughScenario(input: unknown): WalkthroughScenarioValidation {
  if (!Array.isArray(input)) return invalidScenario(0, "scenario must be an array", 0);
  if (input.length === 0) return invalidScenario(0, "scenario must contain at least one step", 0);
  for (let index = 0; index < input.length; index += 1) {
    const step = input[index];
    const reason = validateWalkthroughStep(step);
    if (reason) return invalidScenario(index, reason, input.length);
  }
  return { ok: true, steps: input as readonly WalkthroughStep[] };
}

function invalidScenario(index: number, reason: string, totalSteps: number): WalkthroughScenarioValidation {
  return { ok: false, index, reason: `scenario[${index}]: ${reason}`, totalSteps };
}

function validateWalkthroughStep(value: unknown): string | null {
  if (!isRecord(value)) return "step must be an object";
  if (typeof value.do === "string") {
    switch (value.do) {
      case "moveTo":
        return exactStep(value, ["do", "mapId", "x", "y"])
          ?? requireString(value, "mapId")
          ?? requireInteger(value, "x")
          ?? requireInteger(value, "y");
      case "interact": {
        const shapeError = exactStep(value, ["do", "eventId", "x", "y"]);
        if (shapeError) return shapeError;
        const hasEventId = typeof value.eventId === "string" && value.eventId.trim().length > 0;
        const hasX = Number.isInteger(value.x);
        const hasY = Number.isInteger(value.y);
        if (hasX !== hasY) return "interact coordinates require both x and y integers";
        return hasEventId || (hasX && hasY) ? null : "interact requires eventId or x/y";
      }
      case "choose":
        return exactStep(value, ["do", "index"])
          ?? requireNonNegativeInteger(value, "index");
      case "battle":
        return exactStep(value, ["do", "expect"])
          ?? (value.expect === "victory" || value.expect === "defeat"
            ? null
            : "battle expect must be victory or defeat");
      default:
        return `unknown do variant: ${value.do}`;
    }
  }
  if (hasOwn(value, "do")) return "do must be a string";
  if (typeof value.expect !== "string") return "step requires a do or expect discriminator";
  switch (value.expect) {
    case "switch":
      return exactStep(value, ["expect", "switchId", "value"])
        ?? requireString(value, "switchId")
        ?? (value.value === undefined || typeof value.value === "boolean" ? null : "switch value must be boolean");
    case "item":
      return exactStep(value, ["expect", "itemId", "present", "count"])
        ?? requireString(value, "itemId")
        ?? (value.present === undefined || typeof value.present === "boolean" ? null : "item present must be boolean")
        ?? (value.count === undefined ? null : requireNonNegativeInteger(value, "count"));
    case "variable":
      return exactStep(value, ["expect", "variableId", "op", "value"])
        ?? requireString(value, "variableId")
        ?? validateOptionalOp(value.op)
        ?? requireFiniteNumber(value, "value");
    case "mapId":
      return exactStep(value, ["expect", "mapId"])
        ?? requireString(value, "mapId");
    case "gold":
      return exactStep(value, ["expect", "op", "value"])
        ?? validateOptionalOp(value.op)
        ?? requireFiniteNumber(value, "value");
    case "ended":
      return exactStep(value, ["expect"]);
    default:
      return `unknown expect variant: ${value.expect}`;
  }
}

function exactStep(value: Readonly<Record<string, unknown>>, allowed: readonly string[]): string | null {
  const allowedKeys = new Set(allowed);
  const extras = Object.keys(value).filter((key) => !allowedKeys.has(key));
  return extras.length > 0 ? `unexpected field(s): ${extras.join(", ")}` : null;
}

function requireString(value: Readonly<Record<string, unknown>>, key: string): string | null {
  return typeof value[key] === "string" && value[key].trim().length > 0 ? null : `${key} must be a non-empty string`;
}

function requireInteger(value: Readonly<Record<string, unknown>>, key: string): string | null {
  return Number.isInteger(value[key]) ? null : `${key} must be an integer`;
}

function requireNonNegativeInteger(value: Readonly<Record<string, unknown>>, key: string): string | null {
  return Number.isInteger(value[key]) && Number(value[key]) >= 0 ? null : `${key} must be a non-negative integer`;
}

function requireFiniteNumber(value: Readonly<Record<string, unknown>>, key: string): string | null {
  return typeof value[key] === "number" && Number.isFinite(value[key]) ? null : `${key} must be a finite number`;
}

function validateOptionalOp(value: unknown): string | null {
  return value === undefined || (typeof value === "string" && COMPARISON_OPS.has(value))
    ? null
    : "op must be one of =, >=, <=, >, <";
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Readonly<Record<string, unknown>>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

// 인터프리터 pump 결과.
type PumpStop =
  | { stop: "done" }
  | { stop: "choices" }
  | { stop: "ended"; success: boolean; reason?: string };

interface RunnerState {
  readonly project: Project;
  readonly session: PlaySession;
  readonly options: WalkthroughOptions;
  readonly log: string[];
  reachedEnding: boolean;
  lastBattle: "victory" | "defeat" | null;
  held: { interp: ReturnType<typeof createInterpreter> } | null;
}

// ── 전투 시뮬(단판, 시드 고정) ───────────────────────────────────
// 승리/패배와 보상을 얻어 세션에 반영한다. 전투는 항상 현재 레벨 기준 풀피로 시작한다.
function runOneBattle(
  state: RunnerState,
  troopId: string,
  canEscape: boolean,
  canLose: boolean,
  seed: number
): "victory" | "defeat" {
  const { project, session } = state;
  const partyActorIds = [...session.partyActorIds];
  const levels: Record<string, number> = {};
  const experience: Record<string, number> = {};
  for (const id of partyActorIds) {
    levels[id] = session.actorLevels[id] ?? 1;
    experience[id] = session.actorExperience[id] ?? 0;
  }
  const originalRandom = Math.random;
  let a = seed >>> 0;
  const rng = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const options: BattleRuntimeOptions = {
    project,
    troopId,
    canEscape,
    canLose,
    rng,
    party: { levels, experience, partyActorIds },
    sessionState: {
      switches: { ...session.switches },
      variables: { ...session.variables },
      inventory: { ...session.inventory },
    },
  };
  const potionItemId = Object.keys(session.inventory).find((id) => (session.inventory[id] ?? 0) > 0 && /potion/i.test(id));
  try {
    Math.random = rng;
    const rt = createBattleRuntime(options);
    const maxSteps = 8000;
    for (let step = 0; step < maxSteps; step += 1) {
      const snap = rt.snapshot();
      if (snap.eventChoice) throw new BattleEventInputRequiredError(snap.eventChoice);
      if (snap.result) break;
      if (snap.phase === "actorCommand") {
        const actor = snap.actors.find((entry) => entry.recordId === snap.activeActorId);
        const enemy = snap.enemies.find((entry) => !entry.defeated && entry.hp > 0);
        if (!enemy) {
          rt.tick(1000);
          continue;
        }
        const lowHp = actor !== undefined && actor.hp <= actor.maxHp * 0.3;
        const hasPotion = potionItemId !== undefined && (snap.eventState.inventory[potionItemId] ?? 0) > 0;
        if (lowHp && hasPotion && potionItemId) {
          rt.performActorCommand({ kind: "item", itemId: potionItemId, targetEnemyId: enemy.id });
        } else {
          rt.performActorCommand({ kind: "attack", targetEnemyId: enemy.id });
        }
      } else {
        rt.tick(1000);
      }
    }
    const final = rt.snapshot();
    if (final.eventChoice) throw new BattleEventInputRequiredError(final.eventChoice);
    // 보상을 세션에 반영(경험치→레벨업, 골드, 드롭). 승리 시에만 의미.
    applyBattleRewardsToSession(session, {
      result: final.result ?? "defeat",
      rewards: final.rewards,
      actors: final.actors,
      eventState: final.eventState,
      participatingActorIds: final.participatingActorIds,
    }, project);
    return final.result === "victory" ? "victory" : "defeat";
  } finally {
    Math.random = originalRandom;
  }
}

// ── 인터프리터 구동 ──────────────────────────────────────────────
// step을 받아, 외부 입력이 필요한 지점(choices) 또는 종료까지 자동 진행한다.
function pump(state: RunnerState, interp: ReturnType<typeof createInterpreter>, first: StepResult): PumpStop {
  const seedBase = state.options.seed ?? 12345;
  let step = first;
  let battleIndex = 0;
  // 무한루프 가드.
  for (let guard = 0; guard < 100000; guard += 1) {
    switch (step.kind) {
      case "done":
        return { stop: "done" };
      case "choices":
        return { stop: "choices" };
      case "transfer": {
        state.session.currentMapId = step.mapId;
        state.session.x = step.x;
        state.session.y = step.y;
        state.log.push(`  → 이동: ${step.mapId} (${step.x},${step.y})`);
        step = interp.resume(undefined); // transfer resume은 done을 돌려준다.
        break;
      }
      case "battleProcessing": {
        const outcome = runOneBattle(state, step.troopId, step.canEscape, step.canLose, seedBase + battleIndex * 7919);
        battleIndex += 1;
        state.lastBattle = outcome;
        // 실제 런타임과 같이 세션에 결과를 남기고 그 값으로 resume 한다
        // (playSceneInterpreter.ts:389-390). 이게 빠져 있어서 전투 뒤의
        // `fork { kind: "battleResult", result: "victory" }` 가 항상 거짓이 되고,
        // battleBlockerEvent 가 클리어 스위치를 켜지 못해 **완주가 거짓 실패**로 보고됐다
        // (2026-07-26 실측: "완주 실패 @스텝 22: 스위치 sw_ember_b1_slime"). 게임이 아니라 하네스 결함이었다.
        state.session.battleResult = outcome;
        state.log.push(`  ⚔ 전투 ${step.troopId}: ${outcome}`);
        if (outcome === "defeat" && !step.canLose) {
          return { stop: "ended", success: false, reason: `전투 패배(패배 불가): ${step.troopId}` };
        }
        step = interp.resume(outcome);
        break;
      }
      case "gameOver":
        return { stop: "ended", success: false, reason: "게임 오버" };
      case "returnToTitle":
        state.reachedEnding = true;
        return { stop: "ended", success: true };
      case "inputWait":
      case "inputNumber":
        step = interp.resume(0);
        break;
      case "enterHeroName":
        step = interp.resume("");
        break;
      default:
        // text/wait/timer/changeTile/moveEvent/픽처/오디오/화면효과/shop/inn 등: 자동 진행.
        step = interp.resume(undefined);
        break;
    }
  }
  return { stop: "ended", success: false, reason: "인터프리터 무한루프 가드 도달" };
}

function compare(actual: number, op: "="|">="|"<="|">"|"<" | undefined, value: number): boolean {
  switch (op ?? "=") {
    case "=": return actual === value;
    case ">=": return actual >= value;
    case "<=": return actual <= value;
    case ">": return actual > value;
    case "<": return actual < value;
  }
}

// ── 스텝 처리 ────────────────────────────────────────────────────
// 성공 시 null, 실패 시 사유 문자열.
function runStep(state: RunnerState, step: WalkthroughStep): string | null {
  if ("do" in step) {
    switch (step.do) {
      case "interact": {
        const map = state.project.maps[state.session.currentMapId];
        if (!map) return `현재 맵 없음: ${state.session.currentMapId}`;
        // eventId 우선, 없으면 좌표(x,y)의 이벤트를 찾는다.
        // 좌표로 찾을 때는 **몸 사각**으로 본다 — 3x3 NPC 의 가슴 좌표를 적은 워크스루가
        // "이벤트 없음" 으로 죽지 않도록. 1x1 이면 앵커 점 비교와 같다.
        const event = step.eventId
          ? map.events.find((e) => e.id === step.eventId)
          : eventAtPoint(map, step.x ?? Number.NaN, step.y ?? Number.NaN);
        if (!event) return `이벤트 없음: ${step.eventId ?? `(${step.x},${step.y})`} (맵 ${map.id})`;
        const page = event.pages?.length ? resolveEventPage(event, state.session) : undefined;
        const commands = page?.commands ?? event.commands;
        if (!commands || commands.length === 0) {
          state.log.push(`interact ${step.eventId}: 활성 페이지에 실행할 커맨드 없음(무시)`);
          state.held = null;
          return null;
        }
        state.log.push(`interact ${step.eventId} (page ${page?.id ?? "legacy"})`);
        const interp = createInterpreter([...commands], state.session, state.project, { currentEventId: event.id });
        const result = pump(state, interp, interp.start());
        state.held = result.stop === "choices" ? { interp } : null;
        if (result.stop === "ended" && !result.success) return result.reason ?? "이벤트 실행 실패";
        return null;
      }
      case "choose": {
        if (!state.held) return "choose를 처리할 대기 중 선택지가 없습니다(직전 interact가 choices에서 멈추지 않음).";
        state.log.push(`choose ${step.index}`);
        const interp = state.held.interp;
        const result = pump(state, interp, interp.resume(step.index));
        state.held = result.stop === "choices" ? { interp } : null;
        if (result.stop === "ended" && !result.success) return result.reason ?? "이벤트 실행 실패";
        return null;
      }
      case "moveTo": {
        if (step.mapId === state.session.currentMapId) {
          const reach = checkReachability(state.project, step.mapId, { x: state.session.x, y: state.session.y }, [{ x: step.x, y: step.y }]);
          if (!reach.reachable) return `moveTo (${step.x},${step.y}) 도달 불가 (from ${state.session.x},${state.session.y} on ${step.mapId})`;
        } else {
          state.log.push(`  ⚠ moveTo 다른 맵(${step.mapId}) — 직접 이동`);
          state.session.currentMapId = step.mapId;
        }
        state.session.x = step.x;
        state.session.y = step.y;
        return null;
      }
      case "battle": {
        if (state.lastBattle === null) return "battle 단언 이전에 전투가 발생하지 않았습니다.";
        if (state.lastBattle !== step.expect) return `전투 결과 불일치: 기대 ${step.expect}, 실제 ${state.lastBattle}`;
        return null;
      }
    }
  }
  // expect 단언.
  switch (step.expect) {
    case "switch": {
      const want = step.value ?? true;
      const got = getSwitch(state.session, step.switchId);
      return got === want ? null : `스위치 ${step.switchId}: 기대 ${want}, 실제 ${got}`;
    }
    case "item": {
      const count = state.session.inventory[step.itemId] ?? 0;
      if (step.count !== undefined) return count === step.count ? null : `아이템 ${step.itemId} 개수: 기대 ${step.count}, 실제 ${count}`;
      const present = step.present ?? true;
      return (count > 0) === present ? null : `아이템 ${step.itemId} 소지: 기대 ${present}, 실제 ${count > 0}`;
    }
    case "variable": {
      const got = getVariable(state.session, step.variableId);
      return compare(got, step.op, step.value) ? null : `변수 ${step.variableId}: 기대 ${step.op ?? "="}${step.value}, 실제 ${got}`;
    }
    case "mapId":
      return state.session.currentMapId === step.mapId ? null : `현재 맵: 기대 ${step.mapId}, 실제 ${state.session.currentMapId}`;
    case "gold":
      return compare(state.session.gold, step.op, step.value) ? null : `골드: 기대 ${step.op ?? "="}${step.value}, 실제 ${state.session.gold}`;
    case "ended":
      return state.reachedEnding ? null : "아직 엔딩에 도달하지 않았습니다.";
  }
}

// ── 진입점 ───────────────────────────────────────────────────────
export function runWalkthrough(
  project: Project,
  scenarioInput: unknown,
  options: WalkthroughOptions = {}
): WalkthroughResult {
  const session = startSession(project);
  const validation = validateWalkthroughScenario(scenarioInput);
  if (!validation.ok) {
    return {
      ok: false,
      stepsRun: 0,
      totalSteps: validation.totalSteps,
      failedStepIndex: validation.index,
      failureReason: validation.reason,
      reachedEnding: false,
      log: [],
      session,
    };
  }
  const scenario = validation.steps;
  const state: RunnerState = {
    project,
    session,
    options,
    log: [],
    reachedEnding: false,
    lastBattle: null,
    held: null,
  };

  for (let i = 0; i < scenario.length; i += 1) {
    const step = scenario[i];
    let reason: string | null;
    try {
      reason = runStep(state, step);
    } catch (cause) {
      reason = `예외: ${cause instanceof Error ? cause.message : String(cause)}`;
    }
    options.onLog?.(state.log[state.log.length - 1] ?? "");
    if (reason !== null) {
      return {
        ok: false,
        stepsRun: i,
        totalSteps: scenario.length,
        failedStepIndex: i,
        failedStep: step,
        failureReason: reason,
        reachedEnding: state.reachedEnding,
        log: state.log,
        session,
      };
    }
  }

  return {
    ok: true,
    stepsRun: scenario.length,
    totalSteps: scenario.length,
    reachedEnding: state.reachedEnding,
    log: state.log,
    session,
  };
}
