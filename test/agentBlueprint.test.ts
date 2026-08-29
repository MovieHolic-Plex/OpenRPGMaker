import { afterEach, describe, expect, it, vi } from "vitest";
import {
  agentBlueprintForMap,
  blueprintKindLabel,
  clearAgentBlueprint,
  finishAgentBlueprint,
  getAgentBlueprintState,
  markAgentBlueprintProgress,
  setAgentBlueprintFromSpec,
  subscribeAgentBlueprint,
  syncAgentBlueprintWithSpec,
} from "@/editor/agentBlueprint";
import { clearAgentGhostPreview } from "@/editor/agentGhostPreview";
import { affectedRegions, type BuildSpec } from "@/ai/buildSpec";

/** 쓰기 툴콜 — 패널은 레지스트리의 mode 를 그대로 넘긴다. */
const WRITE = { write: true } as const;
/** 읽기 툴콜(show_map_region 등). */
const READ = { write: false } as const;

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

    // 길(y=12..13, x=0..29)을 칠한다 — clear 구역(0,0,30,20)과도 겹치지만 길과 더 많이 겹친다.
    // 인자 모양은 실제 paint_road 가 보내는 것(required: mapId, points)을 쓴다.
    markAgentBlueprintProgress("paint_road", { mapId: "m1", points: roadPoints() }, WRITE);
    expect(statusById()).toEqual({ site: "planned", main_road: "building", house_a: "planned" });

    markAgentBlueprintProgress("build_house", { mapId: "m1", x: 10, y: 10, w: 6, h: 5 }, WRITE);
    expect(statusById()).toEqual({ site: "planned", main_road: "done", house_a: "building" });
  });

  it("같은 칸을 여러 번 쳐도 building 에 머물고 리비전을 낭비하지 않는다", () => {
    setAgentBlueprintFromSpec(SPEC);
    markAgentBlueprintProgress("build_house", { mapId: "m1", x: 10, y: 10, w: 6, h: 5 }, WRITE);
    const afterFirst = getAgentBlueprintState().revision;
    markAgentBlueprintProgress("paint_tiles", { mapId: "m1", rect: { x: 11, y: 11, w: 2, h: 2 } }, WRITE);
    expect(statusById().house_a).toBe("building");
    expect(getAgentBlueprintState().revision).toBe(afterFirst);
  });

  it("다른 맵의 툴콜은 무시한다", () => {
    setAgentBlueprintFromSpec(SPEC);
    const before = getAgentBlueprintState().revision;
    markAgentBlueprintProgress("paint_road", { mapId: "m2", points: roadPoints() }, WRITE);
    expect(getAgentBlueprintState().revision).toBe(before);
    expect(statusById().main_road).toBe("planned");
  });

  it("어느 칸에도 안 걸리는 툴콜은 진행을 옮기지 않는다", () => {
    setAgentBlueprintFromSpec({
      mapId: "m1",
      assets: [{ id: "only", kind: "house", x: 0, y: 0, w: 2, h: 2 }],
    });
    markAgentBlueprintProgress("paint_tiles", { mapId: "m1", rect: { x: 50, y: 50, w: 2, h: 2 } }, WRITE);
    expect(statusById().only).toBe("planned");
  });

  it("w/h 없는 점 배치 호출은 1×1 로 귀속된다", () => {
    setAgentBlueprintFromSpec({
      mapId: "m1",
      assets: [
        { id: "left", kind: "house", x: 0, y: 0, w: 4, h: 4 },
        { id: "right", kind: "house", x: 10, y: 0, w: 4, h: 4 },
      ],
    });
    // place_npc 는 x/y 만 있다 — affectedRegions 의 rectFromXY 가 1×1 로 채운다(면적 0이 아니다).
    expect(affectedRegions("place_npc", { mapId: "m1", x: 11, y: 1 })).toEqual([
      { mapId: "m1", x: 11, y: 1, w: 1, h: 1 },
    ]);
    markAgentBlueprintProgress("place_npc", { mapId: "m1", x: 11, y: 1 }, WRITE);
    expect(statusById()).toEqual({ left: "planned", right: "building" });
  });

  it("읽기 툴콜은 진행을 옮기지 않는다 — 시공 직후 확인 호출이 정상 경로다", () => {
    setAgentBlueprintFromSpec(SPEC);
    markAgentBlueprintProgress("build_house", { mapId: "m1", x: 10, y: 10, w: 6, h: 5 }, WRITE);
    const revision = getAgentBlueprintState().revision;

    // show_map_region 은 {mapId,x,y,w,h} 를 그대로 받으므로 영역이 진짜 사각형으로 나오고,
    // 툴 설명이 "맵에 뭔가 깐 뒤 이 툴로 눈으로 확인하라" 라서 시공 직후의 정상 경로다.
    markAgentBlueprintProgress("show_map_region", { mapId: "m1", x: 0, y: 12, w: 12, h: 2 }, READ);
    // find_events 는 {mapId} 만으로도 호출된다.
    markAgentBlueprintProgress("find_events", { mapId: "m1" }, READ);

    expect(statusById()).toEqual({ site: "planned", main_road: "planned", house_a: "building" });
    expect(getAgentBlueprintState().revision).toBe(revision);
  });

  it("영역을 못 뽑는 쓰기 툴콜(면적 0)은 맵 전체를 덮는 칸으로 귀속되지 않는다", () => {
    setAgentBlueprintFromSpec(SPEC);
    markAgentBlueprintProgress("build_house", { mapId: "m1", x: 10, y: 10, w: 6, h: 5 }, WRITE);
    const revision = getAgentBlueprintState().revision;

    // author_house 는 kind·mapId 만 필수다(wings 는 선택). wings 가 없으면 affectedRegions 는
    // 폴백으로 (0,0) 면적 0 을 내는데, 그 (0,0) 은 시공 위치가 아니라 상수다 — 점으로 귀속하면
    // 맵 전체를 덮는 1번 칸(정리)이 늘 이기고 나머지 칸이 전부 done 으로 밀려난다.
    const args = { mapId: "m1", kind: "single" };
    expect(affectedRegions("author_house", args)).toEqual([{ mapId: "m1", x: 0, y: 0, w: 0, h: 0 }]);

    markAgentBlueprintProgress("author_house", args, WRITE);
    expect(statusById()).toEqual({ site: "planned", main_road: "planned", house_a: "building" });
    expect(getAgentBlueprintState().revision).toBe(revision);
  });

  it("끝난 칸은 다시 building 으로 되돌아가지 않는다", () => {
    setAgentBlueprintFromSpec(SPEC);
    markAgentBlueprintProgress("paint_road", { mapId: "m1", points: roadPoints() }, WRITE);
    markAgentBlueprintProgress("build_house", { mapId: "m1", x: 10, y: 10, w: 6, h: 5 }, WRITE);
    finishAgentBlueprint();
    expect(statusById()).toEqual({ site: "planned", main_road: "done", house_a: "done" });
    const revision = getAgentBlueprintState().revision;

    // 끝난 길을 다시 손대는 호출(마감·보수)이 진행을 되감으면 그 사이 칸이 done 으로 확정돼
    // "다 지었다"는 거짓 표시가 남는다.
    markAgentBlueprintProgress("paint_road", { mapId: "m1", points: roadPoints() }, WRITE);
    expect(statusById()).toEqual({ site: "planned", main_road: "done", house_a: "done" });
    expect(getAgentBlueprintState().revision).toBe(revision);
  });

  it("청사진이 없으면 아무 것도 하지 않는다", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAgentBlueprint(listener);
    listener.mockClear();
    markAgentBlueprintProgress("paint_road", { mapId: "m1", points: roadPoints() }, WRITE);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe("syncAgentBlueprintWithSpec", () => {
  it("턴마다 같은 스펙으로 다시 맞춰도 진행을 잃지 않고 조용하다", () => {
    setAgentBlueprintFromSpec(SPEC);
    markAgentBlueprintProgress("build_house", { mapId: "m1", x: 10, y: 10, w: 6, h: 5 }, WRITE);
    finishAgentBlueprint();
    const revision = getAgentBlueprintState().revision;

    // set_build_spec 은 계획을 세운 턴에만 온다 — 다음 턴은 세션의 활성 스펙으로 다시 맞춘다.
    syncAgentBlueprintWithSpec(SPEC);
    expect(statusById()).toEqual({ site: "planned", main_road: "planned", house_a: "done" });
    expect(getAgentBlueprintState().revision).toBe(revision);
  });

  it("스펙이 자동 확장돼도 살아남은 칸의 진행을 물려받는다", () => {
    setAgentBlueprintFromSpec(SPEC);
    markAgentBlueprintProgress("build_house", { mapId: "m1", x: 10, y: 10, w: 6, h: 5 }, WRITE);
    finishAgentBlueprint();

    // assistantSession.expandSpecWithRegions 가 활성 스펙에 에셋을 덧붙인 모양.
    syncAgentBlueprintWithSpec({
      ...SPEC,
      assets: [...SPEC.assets, { id: "spec_gate_extra", kind: "prop", x: 20, y: 2, w: 2, h: 2 }],
    });
    expect(statusById()).toEqual({
      site: "planned",
      main_road: "planned",
      house_a: "done",
      spec_gate_extra: "planned",
    });
  });

  it("칸이 움직이면 진행을 물려받지 않는다", () => {
    setAgentBlueprintFromSpec(SPEC);
    markAgentBlueprintProgress("build_house", { mapId: "m1", x: 10, y: 10, w: 6, h: 5 }, WRITE);
    finishAgentBlueprint();

    syncAgentBlueprintWithSpec({
      ...SPEC,
      assets: SPEC.assets.map((asset) => (asset.id === "house_a" ? { ...asset, x: 20 } : asset)),
    });
    expect(statusById().house_a).toBe("planned");
  });

  it("스펙이 없으면 청사진을 지운다", () => {
    setAgentBlueprintFromSpec(SPEC);
    syncAgentBlueprintWithSpec(null);
    expect(getAgentBlueprintState().entries).toEqual([]);
    expect(getAgentBlueprintState().mapId).toBeNull();
  });
});

describe("청사진과 고스트는 수명이 다르다", () => {
  it("고스트를 지워도 청사진은 남는다", () => {
    setAgentBlueprintFromSpec(SPEC);
    markAgentBlueprintProgress("build_house", { mapId: "m1", x: 10, y: 10, w: 6, h: 5 }, WRITE);
    finishAgentBlueprint();

    // aiProposalCard.applyProposal 은 applyProposedProject **직전에** 고스트를 지운다. 청사진을
    // 여기에 묶어 두면 처음 시공한 턴의 끝에서 계획이 사라지고, set_build_spec 은 다음 턴에
    // 다시 오지 않으므로(스펙은 세션이 들고 있다) 그 뒤로는 영원히 빈 상태였다.
    clearAgentGhostPreview();

    expect(getAgentBlueprintState().entries).toHaveLength(3);
    expect(statusById().house_a).toBe("done");
  });
});

describe("finishAgentBlueprint / clearAgentBlueprint", () => {
  it("턴이 끝나면 building 이던 칸이 done 으로 확정된다", () => {
    setAgentBlueprintFromSpec(SPEC);
    markAgentBlueprintProgress("build_house", { mapId: "m1", x: 10, y: 10, w: 6, h: 5 }, WRITE);
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

/** 실제 paint_road 인자 모양 — 경로 꼭짓점 사이는 툴이 채운다. 여기서는 길 60칸을 다 적는다. */
function roadPoints(): readonly { readonly x: number; readonly y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let y = 12; y < 14; y += 1) {
    for (let x = 0; x < 30; x += 1) points.push({ x, y });
  }
  return points;
}
