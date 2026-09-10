/** @vitest-environment happy-dom */
// test/coordinateDestinationMove.test.ts — OPRN-OUT-013 좌표 목적지 이동.
//
// 무엇을 증명하려고 쓴 파일인가:
//   · X·Y 가 각각 고정 정수 또는 스튜디오 변수에서 읽힌다 (대상 세 종류 전부).
//   · 무효한 값(없음·비수치·비유한·소수·음수·맵 밖)이 절대 (0,0) 이 되지 않는다.
//   · 막힘·경로 없음이 서로 구별되는 결과로 보고되고, **대기하는 명령은 항상 끝난다**.
//   · 대체 목적지는 저작자가 켜야만 동작한다.
//   · 병렬 이벤트 둘이 각자 결과 변수를 쓰면 서로의 결과를 덮지 않는다.
//   · 저장/로드 왕복 뒤에도 같은 단계가 나오고, 옛 고정 좌표 명령의 단계는 모양이 그대로다.
import { describe, expect, it, vi } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { playPathfindMove } from "@/player/playScenePathfinding";
import { registerAutonomousMover, updateParallelEvents } from "@/player/playSceneSchedulers";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { updatePlayScene } from "@/player/playSceneMovement";
import { resolvePlayerSpriteResource } from "@/player/playerSpriteResources";
import { recordMovementResult } from "@/player/movementResult";
import {
  coordinateAxisSpec,
  coordinateFailurePolicy,
  coordinateFallbackPolicy,
  movementResultCode,
  resolveCoordinateAxis,
  resolveDestination,
  MOVEMENT_RESULT_CODES,
} from "@/project/eventCommands/coordinateDestination";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { createBlankProject, TILE } from "@/project/defaults";
import { deserialize, serializePretty } from "@/project/io";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { InputState } from "@/player/input";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { Command, M2CommandFields, Project } from "@/project/types";
import { event, page, mockSprite } from "./runtimeEventPageFixtures";

const PATHFIND_ID = "m2-205-pathfind-move";
const FRAME_MS = 1000 / 60;
const after: Command = { kind: "text", body: "after" };

function move(fields: M2CommandFields): Command {
  expect(m2CommandById(PATHFIND_ID)).toBeTruthy();
  return { kind: "m2Command", commandId: PATHFIND_ID, fields };
}

/** 변수·스위치 레코드를 실제로 가진 프로젝트. 픽커/검증이 실재를 요구한다. */
function projectWithVariables(): Project {
  const project = createBlankProject();
  project.variables = [
    ...project.variables,
    { id: "var_x", name: "목표 X" },
    { id: "var_y", name: "목표 Y" },
    { id: "var_result", name: "이동 결과" },
    { id: "var_result_b", name: "이동 결과 B" },
  ];
  project.switches = [...project.switches, { id: "sw_arrived", name: "도착" }];
  const map = project.maps[project.startMapId]!;
  map.lowerTiles.fill(TILE.GRASS);
  map.upperTiles.fill(-1);
  map.events = [];
  return project;
}

describe("좌표 소스 계약 — 순수 해석기", () => {
  it("키가 없는 옛 저장본은 고정 좌표로 읽힌다 (마이그레이션 없이 기본값이 곧 호환)", () => {
    expect(coordinateAxisSpec({ x: 7, y: 3 }, "x")).toEqual({ source: "fixed", fixedValue: 7, variableId: "" });
    expect(coordinateFailurePolicy({ x: 7 })).toBe("continue");
    expect(coordinateFallbackPolicy({ x: 7 })).toBe("none");
  });

  it("변수 id 만 저장돼 있어도 변수 의도로 읽는다 (부분 저장본 구제)", () => {
    expect(coordinateAxisSpec({ xVariableId: "var_x" }, "x").source).toBe("variable");
  });

  it.each([
    ["없는 변수", undefined, "missingVariable"],
    ["숫자가 아닌 값", { nope: 1 }, "nonNumeric"],
    ["무한", Number.POSITIVE_INFINITY, "nonFinite"],
    ["NaN", Number.NaN, "nonNumeric"],
    ["소수", 3.5, "fractional"],
    ["음수", -2, "negative"],
  ])("변수 %s 는 좌표가 되지 못하고 이유가 남는다", (_label, raw, reason) => {
    const resolved = resolveCoordinateAxis(
      { source: "variable", fixedValue: 0, variableId: "var_x" },
      () => raw
    );
    expect(resolved).toMatchObject({ ok: false, reason, variableId: "var_x" });
  });

  it("변수를 「변수」로 골랐지만 정하지 않은 것은 그 자체로 실패다 — 0 으로 메꾸지 않는다", () => {
    expect(resolveCoordinateAxis({ source: "variable", fixedValue: 0, variableId: "" }, () => 5))
      .toEqual({ ok: false, reason: "noVariableSelected" });
  });

  it("변수 값 0 은 유효한 좌표이고, 「변수 없음」과 구별된다", () => {
    const readable = resolveCoordinateAxis({ source: "variable", fixedValue: 9, variableId: "var_x" }, () => 0);
    expect(readable).toEqual({ ok: true, value: 0 });
    const missing = resolveCoordinateAxis({ source: "variable", fixedValue: 9, variableId: "var_x" }, () => undefined);
    expect(missing).toMatchObject({ ok: false, reason: "missingVariable" });
  });

  it("두 축을 섞어 쓸 수 있고, 먼저 실패한 축을 보고한다", () => {
    const variables: Record<string, number> = { var_y: 4 };
    expect(resolveDestination({ xSource: "fixed", x: 2, ySource: "variable", yVariableId: "var_y" }, (id) => variables[id]))
      .toEqual({ ok: true, x: 2, y: 4 });
    expect(resolveDestination({ xSource: "variable", xVariableId: "var_x", ySource: "variable", yVariableId: "var_y" }, (id) => variables[id]))
      .toMatchObject({ ok: false, axis: "x", reason: "missingVariable" });
  });

  it("결과 코드는 일곱 종이 모두 다르다 — 저작자가 실패 종류로 분기할 수 있다", () => {
    const codes = Object.values(MOVEMENT_RESULT_CODES);
    expect(new Set(codes).size).toBe(codes.length);
    expect(movementResultCode("arrived")).toBe(0);
  });
});

describe("인터프리터 — 좌표 해석과 실패 정책", () => {
  it.each([
    ["player", "player"],
    ["this-event", "this-event"],
    ["ev_target", "ev_target"],
  ])("대상 %s 로 고정 좌표 이동 단계를 낸다", (target, expected) => {
    const session = startSession(projectWithVariables());
    expect(createInterpreter([move({ target, x: 6, y: 4, wait: true })], session).start())
      .toMatchObject({ kind: "pathfindMove", target: expected, x: 6, y: 4, wait: true });
  });

  it("옛 고정 좌표 명령의 단계는 새 키 없이 이전과 같은 모양이다", () => {
    const session = startSession(projectWithVariables());
    expect(createInterpreter([move({ target: "player", x: 6, y: 6, wait: true })], session).start())
      .toEqual({ kind: "pathfindMove", target: "player", x: 6, y: 6, speed: 4, wait: true });
  });

  it("변수 좌표를 읽어 목적지로 쓴다", () => {
    const session = startSession(projectWithVariables());
    session.variables.var_x = 8;
    session.variables.var_y = 2;
    expect(createInterpreter([move({
      target: "player", xSource: "variable", xVariableId: "var_x", ySource: "variable", yVariableId: "var_y", wait: true,
    })], session).start()).toMatchObject({ kind: "pathfindMove", x: 8, y: 2 });
  });

  it.each([
    ["소수", 3.5],
    ["음수", -1],
  ])("무효한 변수 값(%s)은 이동 단계를 아예 내지 않는다 — (0,0) 으로 떨어지지 않는다", (_label, value) => {
    const session = startSession(projectWithVariables());
    session.variables.var_x = value;
    session.variables.var_y = 4;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const step = createInterpreter([move({
        target: "player", xSource: "variable", xVariableId: "var_x", ySource: "variable", yVariableId: "var_y",
        resultVariableId: "var_result", resultSwitchId: "sw_arrived", wait: true,
      }), after], session).start();
      expect(step).toMatchObject({ kind: "text", body: "after" });
      expect(session.variables.var_result).toBe(movementResultCode("invalidInput"));
      expect(session.switches.sw_arrived).toBe(false);
      expect(session.flags.pathfindSucceeded).toBe(false);
    } finally { warn.mockRestore(); }
  });

  it("변수가 없으면 대기 설정이어도 즉시 다음 명령으로 간다 — 영원히 기다리는 경로가 없다", () => {
    const session = startSession(projectWithVariables());
    delete session.variables.var_x;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      expect(createInterpreter([move({
        target: "player", xSource: "variable", xVariableId: "var_x", y: 3, wait: true,
      }), after], session).start()).toMatchObject({ kind: "text", body: "after" });
    } finally { warn.mockRestore(); }
  });

  it("「실패하면 이벤트 중단」은 뒤 명령을 실행하지 않는다", () => {
    const session = startSession(projectWithVariables());
    session.variables.var_x = -4;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      expect(createInterpreter([move({
        target: "player", xSource: "variable", xVariableId: "var_x", y: 3, wait: true, onFailure: "stop",
      }), after], session).start()).toEqual({ kind: "done" });
    } finally { warn.mockRestore(); }
  });

  it("결과 기록처와 정책은 단계에 실려 씬으로 넘어간다", () => {
    const session = startSession(projectWithVariables());
    expect(createInterpreter([move({
      target: "player", x: 3, y: 3, wait: true, onFailure: "stop", fallback: "nearest",
      resultVariableId: "var_result", resultSwitchId: "sw_arrived",
    })], session).start()).toMatchObject({
      kind: "pathfindMove", onFailure: "stop", fallback: "nearest",
      resultVariableId: "var_result", resultSwitchId: "sw_arrived",
    });
  });

  it("저장/로드 왕복 뒤에도 같은 목적지가 나온다 (지속성)", () => {
    const project = projectWithVariables();
    project.maps[project.startMapId]!.events = [{
      id: "probe", x: 1, y: 1, trigger: { kind: "action" },
      commands: [move({
        target: "player", xSource: "variable", xVariableId: "var_x", ySource: "fixed", y: 5,
        wait: false, onFailure: "stop", fallback: "nearest", resultVariableId: "var_result",
      })],
    }];
    const reloaded = deserialize(serializePretty(deserialize(serializePretty(project))));
    const session = startSession(reloaded);
    session.variables.var_x = 9;
    expect(createInterpreter(reloaded.maps[reloaded.startMapId]!.events[0]!.commands, session, reloaded).start())
      .toMatchObject({
        kind: "pathfindMove", x: 9, y: 5, wait: false, onFailure: "stop",
        fallback: "nearest", resultVariableId: "var_result",
      });
  });
});

describe("결과 기록 — 병렬 이벤트가 경쟁하지 않는다", () => {
  it("명령마다 다른 변수를 쓰면 나중 명령이 앞 명령의 결과를 덮지 않는다", () => {
    const session = startSession(projectWithVariables());
    recordMovementResult(session, { resultVariableId: "var_result", resultSwitchId: "sw_arrived" }, "arrived");
    recordMovementResult(session, { resultVariableId: "var_result_b" }, "unreachable");
    expect(session.variables.var_result).toBe(movementResultCode("arrived"));
    expect(session.variables.var_result_b).toBe(movementResultCode("unreachable"));
    expect(session.switches.sw_arrived).toBe(true);
  });

  it("도착 스위치는 실패 종류를 구분하지 않지만 결과 변수는 구분한다", () => {
    const session = startSession(projectWithVariables());
    recordMovementResult(session, { resultVariableId: "var_result", resultSwitchId: "sw_arrived" }, "blocked");
    expect(session.switches.sw_arrived).toBe(false);
    expect(session.variables.var_result).toBe(movementResultCode("blocked"));
  });
});

// ── 씬 재생: 실제 프레임 디스패처로 걷게 한다 ──────────────────────────────────
type Harness = { readonly scene: PlaySceneContext; readonly tick: () => void };

function sceneHarness(project = projectWithVariables()): Harness {
  const map = project.maps[project.startMapId]!;
  store.replace(project);
  const session = startSession(project);
  session.currentMapId = map.id;
  session.x = 5;
  session.y = 5;
  const player = {
    x: 0, y: 0, depth: 0,
    setFrame: () => undefined,
    setPosition(x: number, y: number) { this.x = x; this.y = y; },
    setDepth(depth: number) { this.depth = depth; },
    setOrigin: () => undefined,
  };
  const idle: InputState = { dir: null, x: 0, y: 0, dash: false, actionPressed: false, confirmPressed: false, attackPressed: false, skillPressed: false };
  const scene = {
    game: { canvas: { parentElement: null, ownerDocument: { querySelector: () => null } } },
    session,
    map,
    input_: { update: () => idle, resetEdges: () => undefined, setEnabled: () => undefined, clearDirectionTaps: () => undefined },
    player,
    playerSprite: resolvePlayerSpriteResource(project, session),
    tileX: 5, tileY: 5,
    movingFrom: { x: 5, y: 5 }, movingTo: { x: 5, y: 5 },
    moving: false, moveProgress: 0, moveDurationMs: 160,
    logicTickAccumulatorMs: 0, dashing: false, facing: "down",
    walkFrame: 0, walkTimer: 0, lastActionTargetKey: "",
    playerRoute: null, playerHop: null,
    eventPositions: {},
    autonomousNPCs: new Map(),
    parallelProcesses: new Map(),
    activeRuntimeEvents: () => [],
    eventSprites: new Map(),
    followerSprites: new Map(),
    characterShadows: new Map(),
    characterHopScales: new Map(),
    commandMoveRouteEventIds: new Set<string>(),
    running: true,
    inputEnabled: true,
    runtimeDom: { upsertEventMarker: () => undefined },
    updateAutonomousNPCs: (delta: number) => updateAutonomousNPCs(scene, delta),
    registerAutonomousMover: (id: string, moves: never, repeat: boolean) => registerAutonomousMover(scene, id, moves, repeat),
    updateParallelEvents: () => undefined,
    updateTimers: () => undefined,
    updateFieldSpawns: () => undefined,
    syncRuntimeState: () => undefined,
    refreshRuntimeSurfaces: () => undefined,
    runEvent: async () => undefined,
    add: { sprite: () => player },
  } as unknown as PlaySceneContext;

  const callbacks = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => { callbacks.set(++id, cb); return id; });
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((key) => { callbacks.delete(key as number); });
  return {
    scene,
    tick() {
      updatePlayScene(scene, FRAME_MS);
      const pending = [...callbacks.values()];
      callbacks.clear();
      for (const cb of pending) cb(performance.now());
    },
  };
}

describe("씬 재생 — 결과 분류와 대기 종료", () => {
  it("도착하면 결과 변수·스위치·기존 플래그가 모두 성공을 말한다", async () => {
    const h = sceneHarness();
    try {
      const pending = playPathfindMove(h.scene, {
        kind: "pathfindMove", target: "player", x: 7, y: 5, speed: 4, wait: true,
        resultVariableId: "var_result", resultSwitchId: "sw_arrived",
      });
      for (let i = 0; i < 200; i++) h.tick();
      await expect(pending).resolves.toBe("arrived");
      expect([h.scene.tileX, h.scene.tileY]).toEqual([7, 5]);
      expect(h.scene.session.variables.var_result).toBe(movementResultCode("arrived"));
      expect(h.scene.session.switches.sw_arrived).toBe(true);
      expect(h.scene.session.flags.pathfindSucceeded).toBe(true);
    } finally { vi.restoreAllMocks(); }
  });

  it("맵 밖 좌표는 outOfBounds 로 즉시 끝난다 — 대체가 꺼져 있으면 클램프하지 않는다", async () => {
    const h = sceneHarness();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const result = await playPathfindMove(h.scene, {
        kind: "pathfindMove", target: "player", x: 9999, y: 5, speed: 4, wait: true,
        resultVariableId: "var_result",
      });
      expect(result).toBe("outOfBounds");
      expect([h.scene.tileX, h.scene.tileY]).toEqual([5, 5]);
      expect(h.scene.playerRoute).toBeNull();
      expect(h.scene.session.variables.var_result).toBe(movementResultCode("outOfBounds"));
    } finally { warn.mockRestore(); vi.restoreAllMocks(); }
  });

  it("대체 목적지를 켜면 맵 밖 좌표가 가장 가까운 통행 가능한 칸으로 이동한다", async () => {
    const h = sceneHarness();
    try {
      const pending = playPathfindMove(h.scene, {
        kind: "pathfindMove", target: "player", x: 9999, y: 5, speed: 4, wait: true,
        fallback: "nearest", resultVariableId: "var_result",
      });
      for (let i = 0; i < 800; i++) h.tick();
      await expect(pending).resolves.toBe("arrived");
      expect(h.scene.tileX).toBe(h.scene.map.width - 1);
      expect(h.scene.session.variables.var_result).toBe(movementResultCode("arrived"));
    } finally { vi.restoreAllMocks(); }
  });

  it("막힌 칸으로는 blocked 로 끝나고 대기가 풀린다", async () => {
    const h = sceneHarness();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      // 목적지 칸만 고체 이벤트로 채운다 — 그 옆 칸까지는 갈 수 있으므로 「경로 없음」이 아니다.
      h.scene.map.events.push(event("wall", 7, 5, [page("wall", "same", { kind: "action" })]));
      const result = await playPathfindMove(h.scene, {
        kind: "pathfindMove", target: "player", x: 7, y: 5, speed: 4, wait: true,
        resultVariableId: "var_result",
      });
      expect(result).toBe("blocked");
      expect(h.scene.session.variables.var_result).toBe(movementResultCode("blocked"));
      expect(h.scene.playerRoute).toBeNull();
    } finally { warn.mockRestore(); vi.restoreAllMocks(); }
  });

  it("지형으로 완전히 둘러싸인 칸은 unreachable 로 구별된다", async () => {
    const project = projectWithVariables();
    const map = project.maps[project.startMapId]!;
    // (7,5) 를 네 방향 물로 감싼다. 목적지 칸 자체는 통행 가능하지만 들어갈 길이 없다.
    for (const [x, y] of [[6, 5], [8, 5], [7, 4], [7, 6]] as const) {
      map.lowerTiles[y * map.width + x] = TILE.WATER;
    }
    const h = sceneHarness(project);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const result = await playPathfindMove(h.scene, {
        kind: "pathfindMove", target: "player", x: 7, y: 5, speed: 4, wait: true,
        resultVariableId: "var_result",
      });
      expect(result).toBe("unreachable");
      expect(h.scene.session.variables.var_result).toBe(movementResultCode("unreachable"));
    } finally { warn.mockRestore(); vi.restoreAllMocks(); }
  });

  it("이 맵에 없는 대상은 missingTarget 이고 그 자리에서 끝난다", async () => {
    const h = sceneHarness();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const result = await playPathfindMove(h.scene, {
        kind: "pathfindMove", target: "ev_ghost", x: 6, y: 5, speed: 4, wait: true,
        resultVariableId: "var_result",
      });
      expect(result).toBe("missingTarget");
      expect(h.scene.session.variables.var_result).toBe(movementResultCode("missingTarget"));
    } finally { warn.mockRestore(); vi.restoreAllMocks(); }
  });

  it("고른 이벤트를 걷게 하고 그 명령의 결과 변수에만 기록한다", async () => {
    const h = sceneHarness();
    try {
      h.scene.map.events.push(event("walker", 8, 5, [page("walker", "same", { kind: "action" })]));
      h.scene.eventSprites.set("walker", mockSprite() as never);
      // 지정되지 않은 변수는 이 명령이 생감하지 않는다 — 불간섭 문자를 박아 증명한다.
      h.scene.session.variables.var_result = 42;
      const pending = playPathfindMove(h.scene, {
        kind: "pathfindMove", target: "walker", x: 10, y: 5, speed: 4, wait: true,
        resultVariableId: "var_result_b",
      }, "walker");
      for (let i = 0; i < 300; i++) h.tick();
      await expect(pending).resolves.toBe("arrived");
      expect(h.scene.eventPositions.walker).toMatchObject({ x: 10, y: 5 });
      expect(h.scene.session.variables.var_result_b).toBe(movementResultCode("arrived"));
      expect(h.scene.session.variables.var_result).toBe(42);
    } finally { vi.restoreAllMocks(); }
  });

  it("빈 target 은 this-event 처럼 실행 중인 이벤트를 움직인다", async () => {
    const h = sceneHarness();
    try {
      h.scene.map.events.push(event("walker", 8, 5, [page("walker", "same", { kind: "action" })]));
      h.scene.eventSprites.set("walker", mockSprite() as never);
      const pending = playPathfindMove(h.scene, {
        kind: "pathfindMove", target: "", x: 9, y: 5, speed: 4, wait: true,
      }, "walker");
      for (let i = 0; i < 300; i++) h.tick();
      await expect(pending).resolves.toBe("arrived");
      expect(h.scene.eventPositions.walker).toMatchObject({ x: 9, y: 5 });
    } finally { vi.restoreAllMocks(); }
  });

  it("두 명령이 각자 결과 변수를 쓰면 교체된 쪽은 interrupted, 새 쪽은 도착으로 남는다", async () => {
    const h = sceneHarness();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const first = playPathfindMove(h.scene, {
        kind: "pathfindMove", target: "player", x: 9, y: 5, speed: 2, wait: false,
        resultVariableId: "var_result",
      });
      for (let i = 0; i < 5; i++) h.tick();
      const second = playPathfindMove(h.scene, {
        kind: "pathfindMove", target: "player", x: 5, y: 8, speed: 5, wait: true,
        resultVariableId: "var_result_b",
      });
      for (let i = 0; i < 400; i++) h.tick();
      await expect(first).resolves.toBe("interrupted");
      await expect(second).resolves.toBe("arrived");
      expect(h.scene.session.variables.var_result).toBe(movementResultCode("interrupted"));
      expect(h.scene.session.variables.var_result_b).toBe(movementResultCode("arrived"));
      // 공유 플래그는 마지막 명령의 것이다 — 그래서 명령별 변수가 필요하다.
      expect(h.scene.session.flags.pathfindSucceeded).toBe(true);
    } finally { warn.mockRestore(); vi.restoreAllMocks(); }
  });

  it("병렬 이벤트의 대기 이동도 자기 결과 변수에 기록하고 다음 명령으로 간다", async () => {
    const project = projectWithVariables();
    project.commonEvents = [{
      id: "walkabout", name: "Walkabout", trigger: "parallel",
      commands: [
        move({ target: "player", x: 7, y: 5, speed: 4, wait: true, resultVariableId: "var_result" }),
        { kind: "setSwitch", switchId: "sw_arrived", value: true },
      ],
    }];
    const h = sceneHarness(project);
    try {
      h.scene.session.commonEvents = project.commonEvents;
      updateParallelEvents(h.scene, 0);
      const process = h.scene.parallelProcesses.get("common:walkabout");
      expect(process?.pendingTimeTransition, "대기하는 병렬 이동이 시작되지 않았다").toBeTruthy();
      for (let i = 0; i < 200; i++) h.tick();
      await process!.pendingTimeTransition;
      await Promise.resolve();
      expect(h.scene.session.variables.var_result).toBe(movementResultCode("arrived"));
      expect(h.scene.session.switches.sw_arrived).toBe(true);
    } finally { vi.restoreAllMocks(); }
  });

  it("병렬 이벤트에서도 「실패하면 중단」은 뒤 명령을 실행하지 않는다", async () => {
    const project = projectWithVariables();
    const map = project.maps[project.startMapId]!;
    for (const [x, y] of [[6, 5], [8, 5], [7, 4], [7, 6]] as const) {
      map.lowerTiles[y * map.width + x] = TILE.WATER;
    }
    project.commonEvents = [{
      id: "walkabout", name: "Walkabout", trigger: "parallel",
      commands: [
        move({ target: "player", x: 7, y: 5, speed: 4, wait: true, onFailure: "stop", resultVariableId: "var_result" }),
        { kind: "setSwitch", switchId: "sw_arrived", value: true },
      ],
    }];
    const h = sceneHarness(project);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      h.scene.session.commonEvents = project.commonEvents;
      updateParallelEvents(h.scene, 0);
      const process = h.scene.parallelProcesses.get("common:walkabout");
      await process!.pendingTimeTransition;
      await Promise.resolve();
      expect(h.scene.session.variables.var_result).toBe(movementResultCode("unreachable"));
      expect(h.scene.session.switches.sw_arrived).not.toBe(true);
      expect(h.scene.parallelProcesses.has("common:walkabout")).toBe(false);
    } finally { warn.mockRestore(); vi.restoreAllMocks(); }
  });

  it("중단(abort)도 결과로 남고 대기가 즉시 풀린다", async () => {
    const h = sceneHarness();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const abort = new AbortController();
      const pending = playPathfindMove(h.scene, {
        kind: "pathfindMove", target: "player", x: 9, y: 5, speed: 4, wait: true,
        resultVariableId: "var_result",
      }, undefined, abort.signal);
      abort.abort();
      await expect(pending).resolves.toBe("interrupted");
      expect(h.scene.playerRoute).toBeNull();
      expect(h.scene.session.variables.var_result).toBe(movementResultCode("interrupted"));
    } finally { warn.mockRestore(); vi.restoreAllMocks(); }
  });
});
