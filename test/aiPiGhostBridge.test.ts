import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAiLiveCanvasEnabled } from "@/editor/aiLiveCanvas";
import { createPiGhostBridge } from "@/editor/panels/aiPiGhostBridge";
import { diffMapsForDelta } from "@/ai/piAgent/mapDelta";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import {
  clearAgentGhostPreview,
  getAgentGhostDraftMap,
  getAgentGhostPreviewState,
  setAgentGhostDraftMapProvider,
} from "@/editor/agentGhostPreview";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project } from "@/project/types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function seed(): Project {
  const ctx = { project: createBlankProject() };
  const result = runTool(ctx, "create_map", { id: "map_east", name: "동쪽", width: 20, height: 16 });
  if (!result.ok) throw new Error(result.summary);
  return ctx.project;
}

/** 워커가 하는 일: 프로젝트를 제자리에서 바꾸고 증분 이벤트를 만든다. */
function workerDelta(shadow: Record<string, GameMap>, next: Record<string, GameMap>): PiAgentEvent {
  return { type: "map_delta", maps: diffMapsForDelta(shadow, next) };
}

/** 스로틀 타이머를 손으로 돌린다 — 실제 시간에 기대지 않는다. */
function fakeTimers() {
  const queued: Array<() => void> = [];
  return {
    setTimeoutFn: (handler: () => void) => { queued.push(handler); return queued.length as unknown as ReturnType<typeof setTimeout>; },
    clearTimeoutFn: () => { /* 취소는 flush/cancel 이 pending 플래그로 막는다 */ },
    tick: () => { const pending = [...queued]; queued.length = 0; for (const handler of pending) handler(); },
  };
}

describe("aiPiGhostBridge", () => {
  beforeEach(() => {
    setAiLiveCanvasEnabled(true);
    clearAgentGhostPreview();
    setAgentGhostDraftMapProvider(null);
  });

  afterEach(() => {
    setAiLiveCanvasEnabled(true);
  });

  it("map_delta 를 받아 고스트 프리뷰를 그린다 — 턴이 끝나기 전에", () => {
    const base = seed();
    const timers = fakeTimers();
    const bridge = createPiGhostBridge({ baseProject: base, setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn });

    const working = clone(base);
    working.maps.map_east!.lowerTiles[42] = 7;
    bridge.handleEvent(workerDelta(base.maps, working.maps));
    timers.tick();

    const previews = getAgentGhostPreviewState().previews;
    expect(previews).toHaveLength(1);
    expect(previews[0]!.mapId).toBe("map_east");
    expect(previews[0]!.cells.some((cell) => cell.x === 2 && cell.y === 2 && cell.layer === "lower")).toBe(true);
    bridge.dispose();
  });

  it("툴마다 오는 증분이 누적된다 — 마지막 증분만 그리지 않는다", () => {
    const base = seed();
    const timers = fakeTimers();
    const bridge = createPiGhostBridge({ baseProject: base, setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn });

    let shadow = clone(base.maps);
    const working = clone(base);
    for (const index of [10, 11, 12]) {
      working.maps.map_east!.lowerTiles[index] = 5;
      const event = workerDelta(shadow, working.maps);
      shadow = clone(working.maps);
      bridge.handleEvent(event);
      timers.tick();
    }

    const cells = getAgentGhostPreviewState().previews.flatMap((preview) => preview.cells);
    expect(cells.filter((cell) => cell.layer === "lower")).toHaveLength(3);
    bridge.dispose();
  });

  it("초안 맵을 공급한다 — 렌더러가 컴포지터 경로로 실제 타일을 찍을 수 있게", () => {
    const base = seed();
    const bridge = createPiGhostBridge({ baseProject: base });
    const working = clone(base);
    working.maps.map_east!.lowerTiles[42] = 7;
    bridge.handleEvent(workerDelta(base.maps, working.maps));

    expect(getAgentGhostDraftMap("map_east")!.lowerTiles[42]).toBe(7);
    expect(bridge.draftProject().maps.map_east!.lowerTiles[42]).toBe(7);
    bridge.dispose();
    expect(getAgentGhostDraftMap("map_east")).toBeUndefined();
  });

  it("tool_start 가 실행 중 도구와 그 대상 맵을 세운다", () => {
    const base = seed();
    const bridge = createPiGhostBridge({ baseProject: base });
    bridge.handleEvent({ type: "tool_start", id: "1", name: "paint_tiles", args: { mapId: "map_east" } });
    expect(getAgentGhostPreviewState().runningToolName).toBe("paint_tiles");
    expect(getAgentGhostPreviewState().runningToolMapId).toBe("map_east");
    bridge.dispose();
  });

  it("팀 이벤트(agent_event)는 한 겹 벗겨서 같은 길로 흐른다", () => {
    const base = seed();
    const timers = fakeTimers();
    const bridge = createPiGhostBridge({ baseProject: base, setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn });

    const working = clone(base);
    working.maps.map_east!.lowerTiles[42] = 7;
    bridge.handleEvent({ type: "agent_event", agentId: "builder-1", event: workerDelta(base.maps, working.maps) });
    timers.tick();

    expect(getAgentGhostPreviewState().previews).toHaveLength(1);
    bridge.dispose();
  });

  it("done 은 밀린 증분을 즉시 그리고 실행 중 도구를 내린다 — 그림은 남는다", () => {
    const base = seed();
    const timers = fakeTimers();
    const bridge = createPiGhostBridge({ baseProject: base, setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn });

    const working = clone(base);
    working.maps.map_east!.lowerTiles[42] = 7;
    bridge.handleEvent({ type: "tool_start", id: "1", name: "paint_tiles", args: { mapId: "map_east" } });
    bridge.handleEvent(workerDelta(base.maps, working.maps));
    // 스로틀 타이머를 돌리지 않는다 — done 이 직접 비워야 한다.
    bridge.handleEvent({ type: "done", project: working, stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: ["maps.map_east"] });

    expect(getAgentGhostPreviewState().previews).toHaveLength(1);
    expect(getAgentGhostPreviewState().runningToolName).toBe("");
    bridge.dispose();
  });

  it("dispose 는 그림을 지우고 초안 공급을 끊는다 — 적용·버리기·중단이 부르는 길", () => {
    const base = seed();
    const bridge = createPiGhostBridge({ baseProject: base });
    const working = clone(base);
    working.maps.map_east!.lowerTiles[42] = 7;
    bridge.handleEvent(workerDelta(base.maps, working.maps));
    bridge.flush();
    expect(getAgentGhostPreviewState().previews).toHaveLength(1);

    bridge.dispose();
    expect(getAgentGhostPreviewState().previews).toHaveLength(0);
    // dispose 뒤에 늦게 도착한 이벤트는 죽은 다리를 되살리지 않는다.
    bridge.handleEvent(workerDelta(base.maps, working.maps));
    bridge.flush();
    expect(getAgentGhostPreviewState().previews).toHaveLength(0);
  });

  it("헤드리스에서는 초안만 갱신하고 맵 연출은 그리지 않는다", () => {
    setAiLiveCanvasEnabled(false);
    const base = seed();
    const bridge = createPiGhostBridge({ baseProject: base });
    const working = clone(base);
    working.maps.map_east!.lowerTiles[42] = 7;
    bridge.handleEvent(workerDelta(base.maps, working.maps));
    bridge.flush();
    expect(getAgentGhostPreviewState().previews).toHaveLength(0);
    expect(bridge.draftProject().maps.map_east!.lowerTiles[42]).toBe(7);

    setAiLiveCanvasEnabled(true);
    expect(getAgentGhostPreviewState().previews.some((preview) => preview.cells.length > 0)).toBe(true);
    bridge.dispose();
  });

  it("빈 증분은 아무것도 예약하지 않는다", () => {
    const base = seed();
    let applied = 0;
    const bridge = createPiGhostBridge({ baseProject: base, apply: () => { applied += 1; } });
    bridge.handleEvent({ type: "map_delta", maps: [] });
    bridge.flush();
    expect(applied).toBe(0);
    bridge.dispose();
  });
});
