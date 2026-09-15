import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createLane,
  laneBundleChangedKeys,
  laneBundleIds,
  lanesOverlap,
  reduceLane,
  type LaneSpec,
  type LaneState,
} from "@/ai/piAgent/lane";
import type { PiAgentDoneEvent, PiAgentEvent, PiAgentRequest } from "@/ai/piAgent/protocol";
import { createLaneManager } from "@/editor/panels/aiLaneManager";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { runTool } from "@/editor/tools";
import type { Project } from "@/project/types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function seed(): Project {
  const ctx = { project: createBlankProject() };
  for (const [id, name] of [["map_east", "동쪽"], ["map_west", "서쪽"]] as const) {
    const result = runTool(ctx, "create_map", { id, name, width: 20, height: 16 });
    if (!result.ok) throw new Error(result.summary);
  }
  return ctx.project;
}

function spec(overrides: Partial<LaneSpec> & Pick<LaneSpec, "id" | "mapIds">): LaneSpec {
  return {
    label: overrides.id,
    agentLabel: "시공A",
    provider: "google-antigravity",
    model: "gemini-3.7-flash",
    instruction: "맵을 손본다",
    ...overrides,
  };
}

/** 요청이 실은 사본을 편집해 done 을 돌려주는 가짜 워커. 네트워크를 타지 않는다. */
function fakeRunner(edit: (project: Project) => void, events: PiAgentEvent[] = []): (request: PiAgentRequest, options: { onEvent?: (event: PiAgentEvent) => void }) => Promise<PiAgentDoneEvent> {
  return async (request, options) => {
    for (const event of events) options.onEvent?.(event);
    const project = clone(request.project);
    edit(project);
    const mapKeys = Object.keys(project.maps).filter(
      (id) => JSON.stringify(project.maps[id]) !== JSON.stringify(request.project.maps[id]),
    );
    return {
      type: "done",
      project,
      stats: { ms: 12, turns: 3, toolCalls: 5, toolErrors: 0 },
      changedKeys: mapKeys.map((id) => `maps.${id}`),
    };
  };
}

function armStore(project: Project): void {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replaceProject(project);
  resetMapEditHistory();
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("lane 순수 상태", () => {
  it("시작 → 검토 → 적용 순서로만 상태가 움직이고 진행 카운터가 쌓인다", () => {
    const base = seed();
    let lane: LaneState = createLane(spec({ id: "lane_1", mapIds: ["map_east"] }));
    expect(lane.status).toBe("idle");
    lane = reduceLane(lane, { type: "start", base, at: 100 });
    expect(lane.status).toBe("running");
    expect(lane.bundleIds).toContain("map_east");
    lane = reduceLane(lane, { type: "turn", line: "생각 중" });
    lane = reduceLane(lane, { type: "step", step: { kind: "tool", text: "paint_tiles" } });
    expect(lane.progress.turns).toBe(1);
    expect(lane.progress.toolCalls).toBe(1);
    lane = reduceLane(lane, {
      type: "done",
      result: { project: base, stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: [], spills: [], conflicts: [], summary: "" },
      at: 200,
    });
    expect(lane.status).toBe("review");
    lane = reduceLane(lane, { type: "applied" });
    expect(lane.status).toBe("applied");
    expect(lane.result).toBeNull();
  });

  it("중단해도 이미 받은 검토 결과는 버리지 않는다", () => {
    const base = seed();
    let lane = createLane(spec({ id: "lane_1", mapIds: ["map_east"] }));
    lane = reduceLane(lane, { type: "start", base, at: 0 });
    lane = reduceLane(lane, {
      type: "done",
      result: { project: base, stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: [], spills: [], conflicts: [], summary: "" },
      at: 5,
    });
    lane = reduceLane(lane, { type: "stopped", at: 9 });
    expect(lane.status).toBe("review");
    expect(lane.result).not.toBeNull();
  });

  it("묶음은 맵 + 그 아래 실내까지 확장된다", () => {
    const base = seed();
    const withInterior = clone(base);
    withInterior.maps.map_east_inner = { ...clone(withInterior.maps.map_east!), id: "map_east_inner", name: "동쪽 실내" };
    withInterior.mapTree.children.find((node) => node.mapId === "map_east")!.children.push({ mapId: "map_east_inner", children: [] });
    expect(laneBundleIds(withInterior, spec({ id: "lane", mapIds: ["map_east"] })).sort()).toEqual(["map_east", "map_east_inner"]);
    expect(laneBundleIds(withInterior, spec({ id: "lane", mapIds: ["map_west"] }))).toEqual(["map_west"]);
  });

  it("두 레인이 같은 묶음을 주장하면 겹친 맵을 알려준다", () => {
    const a = { bundleIds: ["map_east", "map_east_inner"] };
    const b = { bundleIds: ["map_east_inner", "map_west"] };
    const c = { bundleIds: ["map_west"] };
    expect(lanesOverlap(a, b)).toEqual(["map_east_inner"]);
    expect(lanesOverlap(a, c)).toEqual([]);
  });
});

describe("laneBundleChangedKeys — 레인별 적용의 판정 규칙", () => {
  it("다른 맵이 바뀐 것은 이 레인의 충돌이 아니다", () => {
    const base = seed();
    const current = clone(base);
    current.maps.map_west!.name = "서쪽 (사람이 고침)";
    expect(laneBundleChangedKeys(base, current, ["map_east"])).toEqual([]);
  });

  it("내 묶음의 맵이 바뀌었으면 키로 보고한다", () => {
    const base = seed();
    const current = clone(base);
    current.maps.map_east!.name = "동쪽 (사람이 고침)";
    expect(laneBundleChangedKeys(base, current, ["map_east"])).toEqual(["maps.map_east"]);
  });

  it("묶음에 실내가 붙었으면 mapTree 키로 보고한다", () => {
    const base = seed();
    const current = clone(base);
    current.maps.map_east_inner = { ...clone(current.maps.map_east!), id: "map_east_inner", name: "실내" };
    current.mapTree.children.find((node) => node.mapId === "map_east")!.children.push({ mapId: "map_east_inner", children: [] });
    expect(laneBundleChangedKeys(base, current, ["map_east"]).sort()).toEqual(["mapTree.map_east", "maps.map_east_inner"]);
  });
});

describe("lane manager — 레인별 독립 실행과 적용", () => {
  it("레인 A 를 적용해도 레인 B 의 결과는 살아남아 그대로 적용된다", async () => {
    armStore(seed());
    const manager = createLaneManager({
      clock: () => 0,
      runAgent: fakeRunner((project) => {
        project.maps.map_east!.name = "동쪽 (레인 A)";
      }),
      onChange: () => undefined,
    });
    const other = createLaneManager({
      clock: () => 0,
      runAgent: fakeRunner((project) => {
        project.maps.map_west!.name = "서쪽 (레인 B)";
      }),
    });
    manager.add(spec({ id: "lane_a", mapIds: ["map_east"], label: "동쪽 숲길" }));
    expect((await manager.start("lane_a")).ok).toBe(true);
    other.add(spec({ id: "lane_b", mapIds: ["map_west"], label: "항구 마을" }));
    expect((await other.start("lane_b")).ok).toBe(true);

    // 레인 A 적용으로 프로젝트가 바뀜 뒤에도 B 가 적용되는지가 이 테스트의 전부다.
    const appliedA = await manager.apply("lane_a");
    expect(appliedA.ok).toBe(true);
    expect(store.getCurrent().maps.map_east!.name).toBe("동쪽 (레인 A)");

    const appliedB = await other.apply("lane_b");
    expect(appliedB).toEqual({ ok: true, changedKeys: ["maps.map_west"], spills: [] });
    expect(store.getCurrent().maps.map_west!.name).toBe("서쪽 (레인 B)");
    expect(store.getCurrent().maps.map_east!.name).toBe("동쪽 (레인 A)");
    manager.dispose();
    other.dispose();
  });

  it("도는 동안 내 묶음이 바뀌었으면 적용하지 않고 재실행을 요구한다", async () => {
    armStore(seed());
    const manager = createLaneManager({
      runAgent: fakeRunner((project) => {
        project.maps.map_east!.name = "동쪽 (레인)";
      }),
      onChange: () => undefined,
    });
    manager.add(spec({ id: "lane_a", mapIds: ["map_east"] }));
    await manager.start("lane_a");

    const humanEdit = clone(store.getCurrent());
    humanEdit.maps.map_east!.name = "동쪽 (사람)";
    store.replaceProject(humanEdit);

    const outcome = await manager.apply("lane_a");
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.reason).toBe("bundle-changed");
    expect(outcome.keys).toEqual(["maps.map_east"]);
    expect(store.getCurrent().maps.map_east!.name).toBe("동쪽 (사람)");
    manager.dispose();
  });

  it("같은 묶음을 이미 도는 레인이 있으면 시작을 거절한다", async () => {
    armStore(seed());
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => { release = () => resolve(); });
    const manager = createLaneManager({
      runAgent: async (request, options) => {
        await new Promise<void>((resolve, reject) => {
          held.then(resolve);
          options.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        });
        return { type: "done", project: request.project, stats: { ms: 1, turns: 1, toolCalls: 0, toolErrors: 0 }, changedKeys: [] };
      },
      onChange: () => undefined,
    });
    manager.add(spec({ id: "lane_a", mapIds: ["map_east"], label: "동쪽 숲길" }));
    manager.add(spec({ id: "lane_b", mapIds: ["map_east"], label: "동쪽 마을" }));
    const first = manager.start("lane_a");
    const refused = await manager.start("lane_b");
    expect(refused.ok).toBe(false);
    expect(refused.issue).toContain("동쪽 숲길");
    manager.stop("lane_a");
    release();
    await first;
    expect(manager.get("lane_a")?.status).toBe("stopped");
    manager.dispose();
  });

  it("묶음이 비면 시작하지 않는다", async () => {
    armStore(seed());
    const manager = createLaneManager({ runAgent: fakeRunner(() => undefined), onChange: () => undefined });
    manager.add(spec({ id: "lane_a", mapIds: [] }));
    const outcome = await manager.start("lane_a");
    expect(outcome.ok).toBe(false);
    expect(outcome.issue).toContain("묶음");
    manager.dispose();
  });
});
