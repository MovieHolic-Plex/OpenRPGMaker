// test/eventRunLog.test.ts
// 테스트 플레이 이벤트 실행 기록(ED5 #1): 인터프리터 추적·한 단계 멈춤·손 편집 표시·조수 읽기 도구·설치 경계.

import { afterEach, describe, expect, it, vi } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { EventRunLog, activeEventRunLog, installEventRunLog, type EventRunCommandEntry } from "@/player/eventRunLog";
import { installPlaySceneTestHooks } from "@/player/playSceneTestHooks";
import { getTool } from "@/editor/tools/toolRegistry";
import { createBlankProject } from "@/project/defaults";
import type { Command } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";

function session(): PlaySessionLike {
  return { currentMapId: "map_a", x: 0, y: 0, switches: {}, variables: {}, selfSwitches: {}, inventory: {}, gold: 0, flags: {}, timers: {} } as unknown as PlaySessionLike;
}

const commands: Command[] = [
  { kind: "setSwitch", switchId: "sw_door", value: true },
  { kind: "setVariable", variableId: "v_gold", op: "+=", value: 5 },
  {
    kind: "fork",
    condition: { kind: "switch", switchId: "sw_door", value: true },
    then: [{ kind: "setVariable", variableId: "v_gold", op: "+=", value: 1 }],
    else: [{ kind: "setVariable", variableId: "v_gold", op: "=", value: 0 }],
  } as Command,
];

function drain(interpreter: ReturnType<typeof createInterpreter>): void {
  let result = interpreter.start();
  for (let guard = 0; result.kind !== "done" && guard < 100; guard += 1) result = interpreter.resume(undefined);
}

let uninstall: (() => void) | undefined;
afterEach(() => {
  uninstall?.();
  uninstall = undefined;
});

describe("event run log", () => {
  it("records each executed command with switch/variable effects and the fork branch taken", () => {
    const log = new EventRunLog(() => 0);
    const s = session();
    const trace = log.trace("foreground", s, "ev_gate");
    drain(createInterpreter(commands, s, undefined, { trace, currentEventId: "ev_gate" }));
    trace.end("completed");

    const entries = log.query().entries;
    expect(entries.map((entry) => entry.type)).toEqual(["runStart", "command", "command", "command", "command", "runEnd"]);
    const executed = entries.filter((entry): entry is EventRunCommandEntry => entry.type === "command");
    expect(executed.map((entry) => entry.kind)).toEqual(["setSwitch", "setVariable", "fork", "setVariable"]);
    expect(executed[0]?.effect).toEqual({ switchId: "sw_door", before: false, after: true });
    expect(executed[1]?.effect).toEqual({ variableId: "v_gold", before: 0, after: 5 });
    expect(executed[2]?.branch).toBe("then");
    expect(executed[3]).toMatchObject({ depth: 1, effect: { variableId: "v_gold", before: 5, after: 6 } });
    expect(log.query({ kind: "fork" }).entries).toHaveLength(1);
  });

  it("single-step pauses a foreground event before each command and runs the released command exactly once", () => {
    const log = new EventRunLog(() => 0);
    const s = session();
    log.setStepping(true);
    const interpreter = createInterpreter(commands, s, undefined, { trace: log.trace("foreground", s, "ev_gate") });

    expect(interpreter.start()).toEqual({ kind: "debugStep" });
    expect(log.stepState().paused).toMatchObject({ kind: "setSwitch", pc: 0 });
    expect(s.switches.sw_door).toBeUndefined();

    log.next();
    expect(interpreter.resume(undefined)).toEqual({ kind: "debugStep" });
    expect(s.switches.sw_door).toBe(true);
    expect(log.stepState().paused).toMatchObject({ kind: "setVariable", pc: 1 });
    expect(s.variables.v_gold ?? 0).toBe(0);

    log.setStepping(false);
    let result = interpreter.resume(undefined);
    for (let guard = 0; result.kind !== "done" && guard < 10; guard += 1) result = interpreter.resume(undefined);
    expect(result.kind).toBe("done");
    expect(s.variables.v_gold).toBe(6);
  });

  it("never pauses parallel events, even in single-step mode", () => {
    const log = new EventRunLog(() => 0);
    const s = session();
    log.setStepping(true);
    const result = createInterpreter(commands, s, undefined, { trace: log.trace("parallel", s, "ev_clock") }).start();
    expect(result.kind).toBe("done");
    expect(s.variables.v_gold).toBe(6);
    expect(log.query({ source: "parallel", type: "command" }).entries).toHaveLength(4);
  });

  it("an interpreter without a trace never yields debugStep", () => {
    const s = session();
    expect(createInterpreter(commands, s).start().kind).toBe("done");
  });

  it("keeps only the newest entries past capacity and reports how many were dropped", () => {
    const log = new EventRunLog(() => 0, 3);
    const s = session();
    const trace = log.trace("foreground", s);
    drain(createInterpreter(commands, s, undefined, { trace }));
    const result = log.query();
    expect(result.entries).toHaveLength(3);
    expect(result.dropped).toBe(2);
    expect(result.entries.at(-1)?.seq).toBe(result.lastSeq);
  });
});

describe("test-play install boundary and hand edits", () => {
  const previousWindow = globalThis.window;
  afterEach(() => {
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: previousWindow });
  });

  it("is installed only by the QA hook installer and marks debug-panel switch/variable edits", () => {
    const testWindow = { location: { search: "" } } as unknown as Window & { __oprnEventRunLog?: unknown; __oprnDebug?: { setSwitch(id: string, v: boolean): void; setVariable(id: string, v: number): void } };
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: testWindow });
    expect(activeEventRunLog()).toBeUndefined();
    expect(testWindow.__oprnEventRunLog).toBeUndefined();

    const s = { currentMapId: "map_a", x: 1, y: 1, switches: {} as Record<string, boolean>, variables: {} as Record<string, number>, inventory: {}, gold: 0, flags: {}, timers: {} };
    const shutdown: Array<() => void> = [];
    const scene = { events: { once: vi.fn((_name: string, fn: () => void) => shutdown.push(fn)) }, getMapId: () => s.currentMapId, tileX: 1, tileY: 1 };
    installPlaySceneTestHooks(scene as never, { injectActionEdge: vi.fn() } as never, () => s as never, vi.fn());
    expect(activeEventRunLog()).toBeDefined();
    expect(testWindow.__oprnEventRunLog).toBeDefined();

    testWindow.__oprnDebug!.setSwitch("sw_door", true);
    testWindow.__oprnDebug!.setVariable("v_gold", 7);
    expect(activeEventRunLog()!.query({ type: "handEdit" }).entries.map((entry) => entry.type === "handEdit" && entry.effect)).toEqual([
      { switchId: "sw_door", before: false, after: true },
      { variableId: "v_gold", before: 0, after: 7 },
    ]);

    for (const fn of shutdown) fn();
    expect(activeEventRunLog()).toBeUndefined();
    expect(testWindow.__oprnEventRunLog).toBeUndefined();
  });

  it("read_event_run_log returns available=false without a test play and the structured log with one", () => {
    const tool = getTool("read_event_run_log");
    expect(tool?.mode).toBe("read");
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: {} });
    const project = createBlankProject();
    expect(tool!.run(project, {})).toMatchObject({ data: { available: false } });

    const log = new EventRunLog(() => 0);
    uninstall = installEventRunLog(log);
    const s = session();
    const trace = log.trace("foreground", s, "ev_gate");
    drain(createInterpreter(commands, s, undefined, { trace }));
    const result = tool!.run(project, { eventId: "ev_gate", kind: "setSwitch" }) as { data: { available: boolean; entries: EventRunCommandEntry[] } };
    expect(result.data.available).toBe(true);
    expect(result.data.entries.map((entry) => entry.effect)).toEqual([{ switchId: "sw_door", before: false, after: true }]);
  });
});
