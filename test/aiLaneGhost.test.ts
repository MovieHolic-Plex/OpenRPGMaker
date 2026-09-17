// 레인 고스트 — 살아 있는 레인 전부를 한 장의 초안으로 겹쳐 캔버스 시공 표시에 넣는다.
import { beforeEach, describe, expect, it } from "vitest";
import { createLaneGhostSink } from "@/editor/panels/aiLaneGhost";
import { createLaneManager } from "@/editor/panels/aiLaneManager";
import { diffMapsForDelta } from "@/ai/piAgent/mapDelta";
import type { PiAgentDoneEvent, PiAgentEvent, PiAgentRequest } from "@/ai/piAgent/protocol";
import { clearAgentGhostPreview, getAgentGhostDraftMap, getAgentGhostPreviewState, setAgentGhostDraftMapProvider } from "@/editor/agentGhostPreview";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameMap, Project } from "@/project/types";

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function seed(): Project {
  const ctx = { project: createBlankProject() };
  for (const [id, name] of [["map_east", "동쪽"], ["map_west", "서쪽"]] as const) {
    const result = runTool(ctx, "create_map", { id, name, width: 20, height: 16 });
    if (!result.ok) throw new Error(result.summary);
  }
  return ctx.project;
}

function paint(project: Project, mapId: string, x: number, y: number): Project {
  const next = clone(project);
  const map = next.maps[mapId] as GameMap;
  map.lowerTiles[y * map.width + x] = 7;
  return next;
}

function fakeTimers() {
  const queued: Array<() => void> = [];
  return {
    setTimeoutFn: (handler: () => void) => { queued.push(handler); return queued.length as unknown as ReturnType<typeof setTimeout>; },
    clearTimeoutFn: () => undefined,
    tick: () => { const pending = [...queued]; queued.length = 0; for (const handler of pending) handler(); },
  };
}

beforeEach(() => {
  resetMapEditHistory();
  clearAgentGhostPreview();
  setAgentGhostDraftMapProvider(null);
  store.replace(seed());
});

describe("createLaneGhostSink", () => {
  it("두 레인의 증분이 서로 다른 맵에 겹쳐 쌓이고, 한 레인을 내리면 그 맵만 사라진다", () => {
    const base = store.getCurrent();
    const timers = fakeTimers();
    const sink = createLaneGhostSink({ ...timers, throttleMs: 1 });
    sink.start("a", base);
    sink.start("b", base);
    const eastDraft = paint(base, "map_east", 3, 4);
    sink.handleEvent("a", { type: "map_delta", maps: diffMapsForDelta(base.maps, eastDraft.maps) });
    const westDraft = paint(base, "map_west", 1, 1);
    sink.handleEvent("b", { type: "map_delta", maps: diffMapsForDelta(base.maps, westDraft.maps) });
    timers.tick();
    const mapIds = getAgentGhostPreviewState().previews.map((preview) => preview.mapId).sort();
    expect(mapIds).toEqual(["map_east", "map_west"]);
    expect(getAgentGhostDraftMap("map_east")).toBeTruthy();

    sink.drop("a");
    expect(getAgentGhostPreviewState().previews.map((preview) => preview.mapId)).toEqual(["map_west"]);
    expect(getAgentGhostDraftMap("map_east")).toBeUndefined();

    sink.drop("b");
    expect(getAgentGhostPreviewState().previews).toHaveLength(0);
    sink.dispose();
  });

  it("결과가 오면 초안을 결과 프로젝트로 확정하고, 검토 대기 동안 고스트가 남는다", () => {
    const base = store.getCurrent();
    const timers = fakeTimers();
    const sink = createLaneGhostSink({ ...timers, throttleMs: 1 });
    sink.start("a", base);
    sink.finish("a", paint(base, "map_east", 5, 5), ["map_east"]);
    expect(getAgentGhostPreviewState().previews.map((preview) => preview.mapId)).toEqual(["map_east"]);
    sink.dispose();
    expect(getAgentGhostPreviewState().previews).toHaveLength(0);
  });

  it("레인 B 의 결과 프로젝트(와이어를 건너온 새 객체)는 B 의 묶음 맵만 확정한다 — A 의 초안을 덮지 않는다", () => {
    const base = store.getCurrent();
    const timers = fakeTimers();
    const sink = createLaneGhostSink({ ...timers, throttleMs: 1 });
    sink.start("a", base);
    sink.start("b", base);
    sink.handleEvent("a", { type: "map_delta", maps: diffMapsForDelta(base.maps, paint(base, "map_east", 3, 4).maps) });
    timers.tick();
    // B 의 결과: 모든 맵이 복제된 새 객체이고 서쪽만 실제로 바뀌었다.
    const resultB = clone(paint(base, "map_west", 1, 1));
    sink.finish("b", resultB, ["map_west"]);
    const mapIds = getAgentGhostPreviewState().previews.map((preview) => preview.mapId).sort();
    expect(mapIds).toEqual(["map_east", "map_west"]);
    sink.dispose();
  });

  it("매니저에 꽂으면 시작·증분·완료·적용이 그대로 고스트로 이어진다", async () => {
    const timers = fakeTimers();
    const sink = createLaneGhostSink({ ...timers, throttleMs: 1 });
    const runner = async (request: PiAgentRequest, options: { onEvent?: (event: PiAgentEvent) => void }): Promise<PiAgentDoneEvent> => {
      const draft = paint(request.project, "map_east", 2, 2);
      options.onEvent?.({ type: "map_delta", maps: diffMapsForDelta(request.project.maps, draft.maps) });
      return { type: "done", project: draft, stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: ["maps.map_east"] };
    };
    const manager = createLaneManager({ ghost: sink, runAgent: runner });
    manager.add({ id: "lane_a", label: "동쪽", mapIds: ["map_east"], agentLabel: "시공A", provider: "google-antigravity", model: "gemini-3.7-flash", instruction: "칠한다" });
    await manager.start("lane_a");
    expect(manager.get("lane_a")?.status).toBe("review");
    expect(getAgentGhostPreviewState().previews.map((preview) => preview.mapId)).toEqual(["map_east"]);
    manager.discard("lane_a");
    expect(getAgentGhostPreviewState().previews).toHaveLength(0);
    manager.dispose();
  });
});
