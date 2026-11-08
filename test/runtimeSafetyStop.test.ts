import { describe, expect, it, vi } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { AUTORUN_REPEAT_LIMIT, type RuntimeSafetyStop } from "@/player/runtimeSafetyStop";
import { createBlankProject } from "@/project/defaults";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import type { Command, GameEvent } from "@/project/types";
import { runSceneTest } from "@/testing/sceneTestRunner";

function mkSession(): PlaySessionLike {
  return {
    flags: {}, switches: {}, variables: {}, timers: {}, gold: 0, inventory: {},
    partyActorIds: [], actorExperience: {}, actorLevels: {}, actorEquipment: {}, actorVitals: {},
    currentMapId: "m1", x: 0, y: 0, audio: {}, pictures: {},
  } as unknown as PlaySessionLike;
}

function runCollectingStops(commands: Command[], options: { maxLoopIterations?: number; maxInstructions?: number }): RuntimeSafetyStop[] {
  const stops: RuntimeSafetyStop[] = [];
  const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    createInterpreter(commands, mkSession(), undefined, { ...options, currentEventId: "ev_spin", onSafetyStop: (stop) => stops.push(stop) }).start();
  } finally {
    consoleWarn.mockRestore();
  }
  return stops;
}

describe("테스트 안전 레일", () => {
  it("명령 예산을 다 쓴 실행은 이유가 담긴 기록을 남긴다", () => {
    const stops = runCollectingStops([{ kind: "label", name: "top" }, { kind: "gotoLabel", name: "top" }], { maxInstructions: 50 });
    expect(stops).toEqual([expect.objectContaining({ kind: "instruction-budget", limit: 50, eventId: "ev_spin" })]);
    expect(stops[0]!.message).toContain("ev_spin");
  });

  it("탈출 없는 반복은 반복 예산 기록을 남기고 빠져나온다", () => {
    const stops = runCollectingStops([{ kind: "loop", body: [{ kind: "label", name: "x" }] }], { maxLoopIterations: 4, maxInstructions: 1000 });
    expect(stops.map((stop) => stop.kind)).toEqual(["loop-budget"]);
  });

  it("끝나는 반복은 기록을 남기지 않는다", () => {
    expect(runCollectingStops([{ kind: "loop", body: [{ kind: "breakLoop" }] }], { maxLoopIterations: 4 })).toEqual([]);
  });

  it("장면 테스트는 끝나지 않는 이벤트를 실패와 구조화된 기록으로 돌려준다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.events.push({ id: "ev_spin", x: 1, y: 1, trigger: { kind: "action" },
      commands: [{ kind: "loop", body: [{ kind: "label", name: "x" }] }] } as GameEvent);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = runSceneTest(project, { mapId: map.id, start: { x: 1, y: 2 }, steps: [{ kind: "face", dir: "up" }, { kind: "interact" }] });
      expect(result.ok).toBe(false);
      // 본문이 명령 하나뿐이어도 반복 한 바퀴가 명령 둘(본문 + 반복 재진입)이라 명령 예산(10만)이 반복 예산(10만 회)보다 먼저 찬다.
      expect(result.safetyStops).toEqual([expect.objectContaining({ kind: "instruction-budget", eventId: "ev_spin", mapId: map.id })]);
      expect(result.failureReason).toBe(result.safetyStops![0]!.message);
    } finally {
      consoleWarn.mockRestore();
    }
  });

  it("같은 맵으로 이동하는 자동 실행은 걸음 없이 상한을 넘기면 멈춘다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.events.push({ id: "ev_autorun_loop", x: 1, y: 1, trigger: { kind: "auto" },
      commands: [{ kind: "transfer", mapId: map.id, x: 2, y: 2 }] } as GameEvent);
    const result = runSceneTest(project, { mapId: map.id, start: { x: 2, y: 2 }, steps: [{ kind: "wait", ticks: 1 }] });
    expect(result.ok).toBe(false);
    expect(result.safetyStops).toEqual([expect.objectContaining({ kind: "autorun-repeat", limit: AUTORUN_REPEAT_LIMIT, eventId: "ev_autorun_loop" })]);
  });
});
