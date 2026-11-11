// player/eventRunLog.ts
// 테스트 플레이 전용 이벤트 실행 기록기(ED5 #1). 명령 하나가 실행될 때마다 구조화 항목 하나를 남기고,
// 앞쪽(대화·자동 실행) 이벤트를 한 명령씩 멈춰 세우는 「한 단계」 모드를 가진다.
//
// 설치 문은 하나다: installPlaySceneTestHooks(qaInstrumentation 이 켜진 씬만)가 installEventRunLog 를 부른다.
// 내보낸 게임은 그 문을 지나지 않으므로 activeEventRunLog() 가 언제나 undefined 이고, 인터프리터는
// trace 가 없으면 명령마다 undefined 검사 하나만 한다. 조수 도구는 window.__oprnEventRunLog 로 같은 기록을 읽는다.

import type { Command } from "@/project/types";
import type { InterpreterTrace, InterpreterTraceFrame } from "@/player/interpreter/types";

export const EVENT_RUN_LOG_CAPACITY = 2000;

/** 기록이 어느 실행 경로에서 왔는가. 병렬·공통 병렬은 한 단계 모드에서도 멈추지 않는다. */
export type EventRunSource = "foreground" | "parallel" | "commonParallel";

export type EventRunEffect =
  | { readonly switchId: string; readonly before: boolean; readonly after: boolean }
  | { readonly variableId: string; readonly before: number; readonly after: number };

type EntryBase = {
  readonly seq: number;
  /** 테스트 플레이 시작 뒤 ms(performance.now 기준). */
  readonly t: number;
};

export type EventRunCommandEntry = EntryBase & {
  readonly type: "command";
  readonly run: number;
  readonly source: EventRunSource;
  readonly mapId: string;
  readonly eventId?: string;
  readonly depth: number;
  readonly pc: number;
  readonly kind: Command["kind"];
  /** 명령의 얕은 인자(중첩 명령 목록은 개수만). 조수가 읽는 값이다. */
  readonly args: Readonly<Record<string, unknown>>;
  effect?: EventRunEffect;
  /** 조건 분기(fork)가 실제로 탄 쪽. */
  branch?: "then" | "else" | "none";
};

export type EventRunBoundaryEntry = EntryBase & {
  readonly type: "runStart" | "runEnd";
  readonly run: number;
  readonly source: EventRunSource;
  readonly mapId: string;
  readonly eventId?: string;
  readonly outcome?: "completed" | "cancelled" | "failed";
};

/** 이벤트가 아니라 테스트 플레이 디버그 훅(🛠 패널·QA 스크립트)이 직접 바꾼 값. */
export type EventRunHandEditEntry = EntryBase & {
  readonly type: "handEdit";
  readonly by: "debugHook";
  readonly mapId: string;
  readonly effect: EventRunEffect;
};

export type EventRunEntry = EventRunCommandEntry | EventRunBoundaryEntry | EventRunHandEditEntry;

export type EventRunStepState = {
  readonly stepping: boolean;
  /** 한 단계 모드에서 다음에 실행될 명령(아직 실행 전). */
  readonly paused?: { readonly run: number; readonly eventId?: string; readonly depth: number; readonly pc: number; readonly kind: Command["kind"]; readonly command: Command };
};

export type EventRunLogQuery = {
  readonly eventId?: string;
  readonly kind?: string;
  readonly type?: EventRunEntry["type"];
  readonly source?: EventRunSource;
  readonly sinceSeq?: number;
  readonly limit?: number;
};

const SHALLOW_ARG_LIMIT = 160;

function shallowArgs(command: Command): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(command)) {
    if (key === "kind" || value === undefined) continue;
    if (Array.isArray(value)) {
      out[key] = value.length > 0 && typeof value[0] === "object" && value[0] !== null && "kind" in value[0]
        ? { commands: value.length }
        : value.length <= 8 && value.every((item) => typeof item !== "object") ? value : { items: value.length };
    } else if (typeof value === "string") {
      out[key] = value.length > SHALLOW_ARG_LIMIT ? `${value.slice(0, SHALLOW_ARG_LIMIT)}…` : value;
    } else if (typeof value === "object" && value !== null) {
      const json = JSON.stringify(value);
      out[key] = json.length > SHALLOW_ARG_LIMIT ? { object: Object.keys(value).slice(0, 8) } : value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

type SessionView = { readonly currentMapId: string; readonly switches: Record<string, boolean>; readonly variables: Record<string, number> };

export class EventRunLog {
  private readonly entries: EventRunEntry[] = [];
  private nextSeq = 1;
  private nextRun = 1;
  private readonly origin: number;
  private dropped = 0;
  private stepping = false;
  private paused: EventRunStepState["paused"];
  private release: (() => void) | undefined;

  constructor(private readonly now: () => number = () => performance.now(), private readonly capacity = EVENT_RUN_LOG_CAPACITY) {
    this.origin = now();
  }

  private time(): number {
    return Math.round(this.now() - this.origin);
  }

  private push(entry: EventRunEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.capacity) {
      this.entries.shift();
      this.dropped += 1;
    }
  }

  /** 인터프리터 하나(이벤트 실행 한 번)에 붙일 trace 를 만든다. 앞쪽 실행만 한 단계 모드로 멈춘다. */
  trace(source: EventRunSource, session: SessionView, eventId?: string): InterpreterTrace & { end(outcome: "completed" | "cancelled" | "failed"): void } {
    const run = this.nextRun++;
    const mapId = session.currentMapId;
    this.push({ type: "runStart", seq: this.nextSeq++, t: this.time(), run, source, mapId, ...(eventId ? { eventId } : {}) });
    let ended = false;
    return {
      enter: (command: Command, frame: InterpreterTraceFrame) => {
        const entry: EventRunCommandEntry = {
          type: "command", seq: this.nextSeq++, t: this.time(), run, source, mapId: session.currentMapId,
          ...(eventId ? { eventId } : {}), depth: frame.depth, pc: frame.pc, kind: command.kind, args: shallowArgs(command),
        };
        const switchBefore = command.kind === "setSwitch" ? session.switches[command.switchId] === true : undefined;
        const variableBefore = command.kind === "setVariable" ? session.variables[command.variableId] ?? 0 : undefined;
        this.push(entry);
        return (after: InterpreterTraceFrame) => {
          if (command.kind === "setSwitch" && switchBefore !== undefined) {
            entry.effect = { switchId: command.switchId, before: switchBefore, after: session.switches[command.switchId] === true };
          } else if (command.kind === "setVariable" && variableBefore !== undefined) {
            entry.effect = { variableId: command.variableId, before: variableBefore, after: session.variables[command.variableId] ?? 0 };
          } else if (command.kind === "fork") {
            entry.branch = after.depth > frame.depth && after.top === command.then ? "then"
              : after.depth > frame.depth && after.top === command.else ? "else" : "none";
          }
        };
      },
      shouldPause: source === "foreground" ? (command: Command, frame: InterpreterTraceFrame) => {
        if (!this.stepping || command.kind === "label") return false;
        this.paused = { run, ...(eventId ? { eventId } : {}), depth: frame.depth, pc: frame.pc, kind: command.kind, command };
        return true;
      } : undefined,
      end: (outcome) => {
        if (ended) return;
        ended = true;
        if (this.paused?.run === run) this.paused = undefined;
        this.push({ type: "runEnd", seq: this.nextSeq++, t: this.time(), run, source, mapId: session.currentMapId, ...(eventId ? { eventId } : {}), outcome });
      },
    };
  }

  markHandEdit(mapId: string, effect: EventRunEffect): void {
    this.push({ type: "handEdit", seq: this.nextSeq++, t: this.time(), by: "debugHook", mapId, effect });
  }

  stepState(): EventRunStepState {
    return { stepping: this.stepping, ...(this.paused ? { paused: this.paused } : {}) };
  }

  setStepping(on: boolean): void {
    this.stepping = on;
    if (!on) this.next();
  }

  /** 멈춘 명령 하나를 실행시킨다(다음 명령에서 다시 멈춘다). */
  next(): void {
    this.paused = undefined;
    const release = this.release;
    this.release = undefined;
    release?.();
  }

  /** runCommands 가 멈춘 동안 기다린다. next/한 단계 끄기/폐기 때 풀린다. */
  waitForNext(): Promise<void> {
    if (!this.paused) return Promise.resolve();
    return new Promise((resolve) => {
      const previous = this.release;
      this.release = () => { previous?.(); resolve(); };
    });
  }

  dispose(): void {
    this.stepping = false;
    this.next();
  }

  query(query: EventRunLogQuery = {}): { readonly entries: readonly EventRunEntry[]; readonly total: number; readonly dropped: number; readonly lastSeq: number } {
    const limit = Math.max(1, Math.min(query.limit ?? 200, this.capacity));
    const matched = this.entries.filter((entry) =>
      (query.sinceSeq === undefined || entry.seq > query.sinceSeq)
      && (query.type === undefined || entry.type === query.type)
      && (query.source === undefined || ("source" in entry && entry.source === query.source))
      && (query.eventId === undefined || ("eventId" in entry && entry.eventId === query.eventId))
      && (query.kind === undefined || (entry.type === "command" && entry.kind === query.kind)));
    return { entries: matched.slice(-limit), total: this.entries.length, dropped: this.dropped, lastSeq: this.nextSeq - 1 };
  }

  clear(): void {
    this.dropped += this.entries.length;
    this.entries.length = 0;
  }
}

/** window 로 노출하는 읽기 표면. 조수 도구(src/editor/tools/eventRunLogTools.ts)가 이 모양만 안다. */
export type EventRunLogWindowApi = {
  readonly query: EventRunLog["query"];
  readonly stepState: EventRunLog["stepState"];
};

type RunLogWindow = Window & { __oprnEventRunLog?: EventRunLogWindowApi };

let active: EventRunLog | undefined;

/** 지금 테스트 플레이 씬의 기록기. 내보낸 게임에서는 설치되지 않아 언제나 undefined. */
export function activeEventRunLog(): EventRunLog | undefined {
  return active;
}

/** qaInstrumentation 씬만 부른다(playSceneTestHooks). 반환값은 해제 함수. */
export function installEventRunLog(log: EventRunLog = new EventRunLog()): () => void {
  // 「다시 시작」·맵 재시작은 씬을 새로 만든다 — 켜 둔 한 단계 모드는 다음 씬으로 이어 간다.
  const keepStepping = active?.stepState().stepping === true;
  active?.dispose();
  if (keepStepping) log.setStepping(true);
  active = log;
  const w = typeof window === "undefined" ? undefined : window as RunLogWindow;
  if (w) w.__oprnEventRunLog = { query: (q) => log.query(q), stepState: () => log.stepState() };
  return () => {
    if (active !== log) return;
    log.dispose();
    active = undefined;
    if (w && w.__oprnEventRunLog) delete w.__oprnEventRunLog;
  };
}
