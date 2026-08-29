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

/**
 * SPEC.house_a 를 그대로 덮는 실제 build_wall 인자(required: mapId, rect, material).
 * 종전 테스트는 여기에 `build_house {mapId,x,y,w,h}` 를 썼는데 그 툴은 (1) 스키마가
 * origin+width/height 라 이 모양을 낼 수 없고 (2) CONSTRUCTION_WRITE_SUPERSEDED 로 deprecated 라
 * 모델이 부를 수도 없다 — `rectFromXY` 가 범용이라 통과하던 유령 인자였다.
 */
const HOUSE_WALL_ARGS = { mapId: "m1", rect: { x: 10, y: 10, w: 6, h: 5 }, material: "흰 집 벽" } as const;

/** 겹치지 않는 마을 계획 — 인자 모양별 귀속을 한 칸씩 분리해서 볼 수 있다. */
const VILLAGE_SPEC: BuildSpec = {
  mapId: "m1",
  title: "언덕 마을",
  buildOrder: ["clear", "road", "house", "prop"],
  assets: [
    { id: "site", kind: "clear", x: 0, y: 0, w: 30, h: 20 },
    { id: "main_road", kind: "road", x: 0, y: 16, w: 30, h: 2 },
    { id: "house_a", kind: "house", x: 4, y: 4, w: 6, h: 5 },
    { id: "grove", kind: "prop", x: 20, y: 2, w: 6, h: 6 },
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
    // 스펙 자동 확장의 기본 kind. 코드가 정하는 값이라 원문 노출이 아니라 누락이다 —
    // 맵에 "3/9 structure" 라는 영어가 찍혔다.
    expect(blueprintKindLabel("structure")).toBe("구조물");
  });

  it("스펙 자동 확장이 내는 kind 7종은 전부 사람 말 라벨을 갖는다", () => {
    // assistantSession.autoExpandedAssetKind 가 낼 수 있는 값의 전량 — 코드가 정하므로 열거된다.
    // 모델이 쓴 kind 는 원문 통과가 맞지만 이 7종은 우리가 고른 영어라 번역 누락이 곧 결함이다.
    for (const kind of ["clear", "road", "terrain", "npc", "prop", "house", "structure"]) {
      expect(blueprintKindLabel(kind)).not.toBe(kind);
    }
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

    markAgentBlueprintProgress("build_wall", HOUSE_WALL_ARGS, WRITE);
    expect(statusById()).toEqual({ site: "planned", main_road: "done", house_a: "building" });
  });

  it("같은 칸을 여러 번 쳐도 building 에 머물고 리비전을 낭비하지 않는다", () => {
    setAgentBlueprintFromSpec(SPEC);
    markAgentBlueprintProgress("build_wall", HOUSE_WALL_ARGS, WRITE);
    const afterFirst = getAgentBlueprintState().revision;
    markAgentBlueprintProgress("fill_region", { mapId: "m1", rect: { x: 11, y: 11, w: 2, h: 2 }, material: "나무 바닥" }, WRITE);
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
    markAgentBlueprintProgress("fill_region", { mapId: "m1", rect: { x: 50, y: 50, w: 2, h: 2 }, material: "잔디" }, WRITE);
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
    markAgentBlueprintProgress("build_wall", HOUSE_WALL_ARGS, WRITE);
    const revision = getAgentBlueprintState().revision;

    // show_map_region 은 {mapId,x,y,w,h} 를 그대로 받으므로 영역이 진짜 사각형으로 나오고,
    // 툴 설명이 "맵에 뭔가 깐 뒤 이 툴로 눈으로 확인하라" 라서 시공 직후의 정상 경로다.
    markAgentBlueprintProgress("show_map_region", { mapId: "m1", x: 0, y: 12, w: 12, h: 2 }, READ);
    // find_events 는 {mapId} 만으로도 호출된다.
    markAgentBlueprintProgress("find_events", { mapId: "m1" }, READ);

    expect(statusById()).toEqual({ site: "planned", main_road: "planned", house_a: "building" });
    expect(getAgentBlueprintState().revision).toBe(revision);
  });

  it("위치를 인자에 담지 않는 쓰기 툴콜은 맵 전체를 덮는 칸으로 귀속되지 않는다", () => {
    setAgentBlueprintFromSpec(SPEC);
    markAgentBlueprintProgress("build_wall", HOUSE_WALL_ARGS, WRITE);
    const revision = getAgentBlueprintState().revision;

    // build_roof 는 wallRect 를 생략할 수 있고(맵의 벽 어휘 셀을 스캔해 자동 감지) 그때 인자에는
    // 위치가 없다 — affectedRegions 는 폴백으로 (0,0) 면적 0 을 낸다. 그 (0,0) 은 시공 위치가
    // 아니라 상수라서 점으로 귀속하면 맵 전체를 덮는 1번 칸(정리)이 늘 이기고 나머지 칸이 전부
    // done 으로 밀려난다. 위치를 모르면 침묵한다.
    const args = { mapId: "m1", material: "붉은 기와" };
    expect(affectedRegions("build_roof", args)).toEqual([{ mapId: "m1", x: 0, y: 0, w: 0, h: 0 }]);

    markAgentBlueprintProgress("build_roof", args, WRITE);
    expect(statusById()).toEqual({ site: "planned", main_road: "planned", house_a: "building" });
    expect(getAgentBlueprintState().revision).toBe(revision);
  });

  it("끝난 칸은 다시 building 으로 되돌아가지 않는다", () => {
    setAgentBlueprintFromSpec(SPEC);
    markAgentBlueprintProgress("paint_road", { mapId: "m1", points: roadPoints() }, WRITE);
    markAgentBlueprintProgress("build_wall", HOUSE_WALL_ARGS, WRITE);
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

// 쓰기 툴이 좌표를 담는 실제 인자 모양들. affectedRegions 는 스펙 게이트의 함수라 이 모양들을
// 모르고 면적 0 폴백으로 떨어뜨린다(게이트는 fail-closed 로 통과시키면 되므로 그게 맞다).
// 청사진이 그 폴백을 그대로 받으면 진행이 한 칸도 안 움직인다 — 2026-08-29 실측: 시스템
// 프롬프트가 지시하는 마을 경로(author_village, bounds 선택)로 마을을 다 지어도 100% 파랑.
describe("markAgentBlueprintProgress — 좌표를 wrapper 키에 담는 쓰기 툴", () => {
  it("place_props 의 area 로 소품 칸이 진행된다", () => {
    setAgentBlueprintFromSpec(VILLAGE_SPEC);
    markAgentBlueprintProgress(
      "place_props",
      { mapId: "m1", area: { x: 20, y: 2, w: 6, h: 6 }, material: "침엽수", count: 8 },
      WRITE
    );
    expect(statusById()).toEqual({ site: "planned", main_road: "planned", house_a: "planned", grove: "building" });
  });

  it("place_door / place_window 의 at 으로 집 칸이 진행된다", () => {
    setAgentBlueprintFromSpec(VILLAGE_SPEC);
    markAgentBlueprintProgress("place_door", { mapId: "m1", at: { x: 6, y: 8 }, material: "문" }, WRITE);
    expect(statusById().house_a).toBe("building");
    // 창문도 같은 칸이면 진행을 되감지 않는다.
    markAgentBlueprintProgress("place_window", { mapId: "m1", at: { x: 5, y: 6 }, material: "창문" }, WRITE);
    expect(statusById()).toEqual({ site: "planned", main_road: "planned", house_a: "building", grove: "planned" });
  });

  it("build_roof 의 wallRect 로 집 칸이 진행된다", () => {
    setAgentBlueprintFromSpec(VILLAGE_SPEC);
    markAgentBlueprintProgress(
      "build_roof",
      { mapId: "m1", material: "붉은 기와", wallRect: { x: 4, y: 4, w: 6, h: 5 } },
      WRITE
    );
    expect(statusById().house_a).toBe("building");
  });

  it("origin + width/height(구조물 스탬프 계열)도 사각형으로 귀속된다", () => {
    setAgentBlueprintFromSpec(VILLAGE_SPEC);
    markAgentBlueprintProgress("stamp_structure_kit", { mapId: "m1", kitId: "kit_x", origin: { x: 4, y: 4 } }, WRITE);
    expect(statusById().house_a).toBe("building");
  });

  it("다른 맵의 area 호출은 무시한다", () => {
    setAgentBlueprintFromSpec(VILLAGE_SPEC);
    const before = getAgentBlueprintState().revision;
    markAgentBlueprintProgress(
      "place_props",
      { mapId: "m2", area: { x: 20, y: 2, w: 6, h: 6 }, material: "침엽수", count: 8 },
      WRITE
    );
    expect(getAgentBlueprintState().revision).toBe(before);
  });

  it("스펙 게이트의 affectedRegions 는 그대로 면적 0 폴백을 낸다 — 게이트 판정은 건드리지 않았다", () => {
    expect(affectedRegions("place_props", { mapId: "m1", area: { x: 20, y: 2, w: 6, h: 6 }, material: "침엽수", count: 8 }))
      .toEqual([{ mapId: "m1", x: 0, y: 0, w: 0, h: 0 }]);
    expect(affectedRegions("place_door", { mapId: "m1", at: { x: 6, y: 8 }, material: "문" }))
      .toEqual([{ mapId: "m1", x: 0, y: 0, w: 0, h: 0 }]);
    expect(affectedRegions("build_roof", { mapId: "m1", material: "붉은 기와", wallRect: { x: 4, y: 4, w: 6, h: 5 } }))
      .toEqual([{ mapId: "m1", x: 0, y: 0, w: 0, h: 0 }]);
    expect(affectedRegions("author_village", { target: { kind: "existing", mapId: "m1" }, houseCount: 4, countPolicy: "exact" }))
      .toEqual([{ mapId: "m1", x: 0, y: 0, w: 0, h: 0 }]);
  });
});

describe("markAgentBlueprintProgress — 대상 전체를 짓는 파사드(author_village)", () => {
  /** 시스템 프롬프트가 그대로 지시하는 모양 — contextBuilder: 마을=author_village(target:{kind:"existing",mapId} …). */
  const VILLAGE_CALL = { target: { kind: "existing", mapId: "m1" }, houseCount: 4, countPolicy: "exact" } as const;

  it("bounds 가 없으면 계획된 칸 전부를 짓는 중으로 올린다 — 한 칸만 고르면 정리 칸이 이긴다", () => {
    setAgentBlueprintFromSpec(VILLAGE_SPEC);
    markAgentBlueprintProgress("author_village", VILLAGE_CALL, WRITE);
    expect(statusById()).toEqual({ site: "building", main_road: "building", house_a: "building", grove: "building" });

    finishAgentBlueprint();
    expect(statusById()).toEqual({ site: "done", main_road: "done", house_a: "done", grove: "done" });
  });

  it("bounds 가 있으면 그 영역에 걸리는 칸만 올린다", () => {
    setAgentBlueprintFromSpec(VILLAGE_SPEC);
    markAgentBlueprintProgress("author_village", { ...VILLAGE_CALL, target: { ...VILLAGE_CALL.target, bounds: { x: 0, y: 0, w: 12, h: 12 } } }, WRITE);
    // grove(20,2)·main_road(y=16) 는 bounds 밖이라 계획 그대로다.
    expect(statusById()).toEqual({ site: "building", main_road: "planned", house_a: "building", grove: "planned" });
  });

  it("다른 맵을 짓는 파사드는 진행을 옮기지 않는다", () => {
    setAgentBlueprintFromSpec(VILLAGE_SPEC);
    const before = getAgentBlueprintState().revision;
    markAgentBlueprintProgress("author_village", { ...VILLAGE_CALL, target: { kind: "new", mapId: "m2", name: "새 마을", width: 40, height: 40 } }, WRITE);
    expect(getAgentBlueprintState().revision).toBe(before);
  });

  it("이미 끝난 칸은 되감지 않는다", () => {
    setAgentBlueprintFromSpec(VILLAGE_SPEC);
    markAgentBlueprintProgress("paint_road", { mapId: "m1", points: [{ x: 0, y: 16 }, { x: 29, y: 17 }] }, WRITE);
    finishAgentBlueprint();
    expect(statusById().main_road).toBe("done");

    markAgentBlueprintProgress("author_village", VILLAGE_CALL, WRITE);
    expect(statusById()).toEqual({ site: "building", main_road: "done", house_a: "building", grove: "building" });
  });

  it("읽기 툴콜은 파사드 이름이어도 진행을 옮기지 않는다", () => {
    setAgentBlueprintFromSpec(VILLAGE_SPEC);
    const before = getAgentBlueprintState().revision;
    markAgentBlueprintProgress("author_village", VILLAGE_CALL, READ);
    expect(getAgentBlueprintState().revision).toBe(before);
  });
});

describe("syncAgentBlueprintWithSpec", () => {
  it("턴마다 같은 스펙으로 다시 맞춰도 진행을 잃지 않고 조용하다", () => {
    setAgentBlueprintFromSpec(SPEC);
    markAgentBlueprintProgress("build_wall", HOUSE_WALL_ARGS, WRITE);
    finishAgentBlueprint();
    const revision = getAgentBlueprintState().revision;

    // set_build_spec 은 계획을 세운 턴에만 온다 — 다음 턴은 세션의 활성 스펙으로 다시 맞춘다.
    syncAgentBlueprintWithSpec(SPEC);
    expect(statusById()).toEqual({ site: "planned", main_road: "planned", house_a: "done" });
    expect(getAgentBlueprintState().revision).toBe(revision);
  });

  it("스펙이 자동 확장돼도 살아남은 칸의 진행을 물려받는다", () => {
    setAgentBlueprintFromSpec(SPEC);
    markAgentBlueprintProgress("build_wall", HOUSE_WALL_ARGS, WRITE);
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
    markAgentBlueprintProgress("build_wall", HOUSE_WALL_ARGS, WRITE);
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
    markAgentBlueprintProgress("build_wall", HOUSE_WALL_ARGS, WRITE);
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
    markAgentBlueprintProgress("build_wall", HOUSE_WALL_ARGS, WRITE);
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
