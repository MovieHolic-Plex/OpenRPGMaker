import { afterEach, describe, expect, it, vi } from "vitest";
import {
  agentBlueprintForMap,
  agentBlueprintProgress,
  blueprintKindLabel,
  clearAgentBlueprint,
  finishAgentBlueprint,
  getAgentBlueprintState,
  markAgentBlueprintProgress,
  setAgentBlueprintFromSpec,
  subscribeAgentBlueprint,
} from "@/editor/agentBlueprint";
import type { BuildSpec } from "@/ai/buildSpec";

const SPEC: BuildSpec = {
  mapId: "m1",
  title: "강가 마을",
  buildOrder: ["clear", "road", "house"],
  assets: [
    { id: "house_a", kind: "house", x: 10, y: 10, w: 6, h: 5 },
    { id: "main_road", kind: "road", x: 0, y: 12, w: 30, h: 2 },
    { id: "site", kind: "clear", x: 0, y: 0, w: 30, h: 20 },
  ],
};

afterEach(() => {
  clearAgentBlueprint();
});

describe("setAgentBlueprintFromSpec", () => {
  it("buildOrder 순서로 1-based 순번을 매기고 전부 planned 로 시작한다", () => {
    setAgentBlueprintFromSpec(SPEC);
    const state = getAgentBlueprintState();
    expect(state.mapId).toBe("m1");
    expect(state.title).toBe("강가 마을");
    expect(state.entries.map((entry) => [entry.order, entry.id])).toEqual([
      [1, "site"],
      [2, "main_road"],
      [3, "house_a"],
    ]);
    expect(state.entries.every((entry) => entry.status === "planned")).toBe(true);
  });

  it("면적이 없는 에셋은 그릴 수 없으므로 버리고, 순번은 남은 것만으로 다시 매긴다", () => {
    setAgentBlueprintFromSpec({
      mapId: "m1",
      assets: [
        { id: "zero", kind: "house", x: 1, y: 1, w: 0, h: 4 },
        { id: "real", kind: "house", x: 2, y: 2, w: 3, h: 3 },
      ],
    });
    const state = getAgentBlueprintState();
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]).toMatchObject({ id: "real", order: 1 });
  });

  it("kind 는 사람 말 라벨이 되고, 모르는 kind 는 원문을 그대로 남긴다", () => {
    expect(blueprintKindLabel("house")).toBe("집");
    expect(blueprintKindLabel("ROAD")).toBe("길");
    expect(blueprintKindLabel("obelisk")).toBe("obelisk");
    expect(blueprintKindLabel("  ")).toBe("구역");
  });

  it("현재 맵이 다르면 그릴 칸이 없다", () => {
    setAgentBlueprintFromSpec(SPEC);
    const state = getAgentBlueprintState();
    expect(agentBlueprintForMap(state, "m1")).toHaveLength(3);
    expect(agentBlueprintForMap(state, "m2")).toHaveLength(0);
    expect(agentBlueprintForMap(state, null)).toHaveLength(0);
  });
});

describe("markAgentBlueprintProgress", () => {
  it("가장 많이 겹치는 칸이 building 이 되고, 다음 칸으로 넘어가면 앞 칸은 done 이 된다", () => {
    setAgentBlueprintFromSpec(SPEC);

    // 길(y=12..13, x=0..29) 을 칠한다 — clear 구역(0,0,30,20)과도 겹치지만 길과 더 많이 겹친다.
    markAgentBlueprintProgress("paint_road", { mapId: "m1", rect: { x: 0, y: 12, w: 30, h: 2 } });
    expect(statusById()).toEqual({ site: "planned", main_road: "building", house_a: "planned" });

    markAgentBlueprintProgress("build_house", { mapId: "m1", x: 10, y: 10, w: 6, h: 5 });
    expect(statusById()).toEqual({ site: "planned", main_road: "done", house_a: "building" });

    expect(agentBlueprintProgress(getAgentBlueprintState())).toEqual({ done: 1, total: 3 });
  });

  it("같은 칸을 여러 번 쳐도 building 에 머물고 리비전을 낭비하지 않는다", () => {
    setAgentBlueprintFromSpec(SPEC);
    markAgentBlueprintProgress("build_house", { mapId: "m1", x: 10, y: 10, w: 6, h: 5 });
    const afterFirst = getAgentBlueprintState().revision;
    markAgentBlueprintProgress("paint_tiles", { mapId: "m1", rect: { x: 11, y: 11, w: 2, h: 2 } });
    expect(statusById().house_a).toBe("building");
    expect(getAgentBlueprintState().revision).toBe(afterFirst);
  });

  it("다른 맵의 툴콜은 무시한다", () => {
    setAgentBlueprintFromSpec(SPEC);
    const before = getAgentBlueprintState().revision;
    markAgentBlueprintProgress("paint_road", { mapId: "m2", rect: { x: 0, y: 12, w: 30, h: 2 } });
    expect(getAgentBlueprintState().revision).toBe(before);
    expect(statusById().main_road).toBe("planned");
  });

  it("어느 칸에도 안 걸리는 툴콜은 진행을 옮기지 않는다", () => {
    setAgentBlueprintFromSpec({
      mapId: "m1",
      assets: [{ id: "only", kind: "house", x: 0, y: 0, w: 2, h: 2 }],
    });
    markAgentBlueprintProgress("paint_tiles", { mapId: "m1", rect: { x: 50, y: 50, w: 2, h: 2 } });
    expect(statusById().only).toBe("planned");
  });

  it("영역을 못 뽑는 호출(면적 0)은 시작점이 속한 칸으로 귀속된다", () => {
    setAgentBlueprintFromSpec({
      mapId: "m1",
      assets: [
        { id: "left", kind: "house", x: 0, y: 0, w: 4, h: 4 },
        { id: "right", kind: "house", x: 10, y: 0, w: 4, h: 4 },
      ],
    });
    // place_npc 는 x/y 만 있고 w/h 가 없어 affectedRegions 가 면적 0 영역을 낸다.
    markAgentBlueprintProgress("place_npc", { mapId: "m1", x: 11, y: 1 });
    expect(statusById()).toEqual({ left: "planned", right: "building" });
  });

  it("청사진이 없으면 아무 것도 하지 않는다", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAgentBlueprint(listener);
    listener.mockClear();
    markAgentBlueprintProgress("paint_road", { mapId: "m1", rect: { x: 0, y: 0, w: 2, h: 2 } });
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe("finishAgentBlueprint / clearAgentBlueprint", () => {
  it("턴이 끝나면 building 이던 칸이 done 으로 확정된다", () => {
    setAgentBlueprintFromSpec(SPEC);
    markAgentBlueprintProgress("build_house", { mapId: "m1", x: 10, y: 10, w: 6, h: 5 });
    finishAgentBlueprint();
    expect(statusById().house_a).toBe("done");
    // 두 번 불러도 리비전이 늘지 않는다.
    const revision = getAgentBlueprintState().revision;
    finishAgentBlueprint();
    expect(getAgentBlueprintState().revision).toBe(revision);
  });

  it("clear 는 구독자에게 빈 상태를 알린다", () => {
    setAgentBlueprintFromSpec(SPEC);
    const listener = vi.fn();
    const unsubscribe = subscribeAgentBlueprint(listener);
    listener.mockClear();
    clearAgentBlueprint();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].entries).toEqual([]);
    expect(listener.mock.calls[0][0].mapId).toBeNull();
    // 이미 비어 있으면 조용하다.
    listener.mockClear();
    clearAgentBlueprint();
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("구독 즉시 현재 상태를 한 번 받는다", () => {
    setAgentBlueprintFromSpec(SPEC);
    const listener = vi.fn();
    const unsubscribe = subscribeAgentBlueprint(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].entries).toHaveLength(3);
    unsubscribe();
  });
});

function statusById(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of getAgentBlueprintState().entries) out[entry.id] = entry.status;
  return out;
}
