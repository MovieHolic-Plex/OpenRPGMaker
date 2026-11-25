import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { agentBlueprintForMap, beginAgentBlueprintTurn, blueprintKindLabel, clearAgentBlueprint, commitAgentBlueprintProgress, getAgentBlueprintState, markAgentBlueprintProgress, setAgentBlueprintFromSpec, settleAgentBlueprintTurn, subscribeAgentBlueprint, syncAgentBlueprintWithSpec, type BlueprintEntry } from "@/editor/agentBlueprint";
import { appliedBlueprintRegions, blueprintRegionsForToolCall } from "@/editor/agentBlueprintRegions";
import { clearAgentGhostPreview, setAgentGhostPreviewHidden } from "@/editor/agentGhostPreview";
import { affectedRegions, type AffectedRegion, type BuildSpec } from "@/ai/buildSpec";
import type { ChangeSummary } from "@/editor/tools/types";
import { AgentBlueprintRenderer, BLUEPRINT_MAX_LABELS, blueprintLabelLayout, blueprintStatusStyle, blueprintEntryCaption } from "@/editor/agentBlueprintRenderer";
import { isolateTimers } from "./mergedTeardown";

describe("agentBlueprint", () => {
  isolateTimers();
  /** 아무것도 적용되지 않은 턴 끝(중단·오류·적용 실패·변경 0건). */
  const APPLIED_NOTHING = { regions: [] as readonly AffectedRegion[], wholeTargetMapIds: [] as readonly string[] };
  /** 이 영역들이 저장소에 들어간 턴 끝. */
  function appliedRegions(...regions: readonly AffectedRegion[]) {
    return { regions, wholeTargetMapIds: [] as readonly string[] };
  }
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
   * 종전 테스트는 여기에 `build_house {mapId,x,y,w,h}` 를 썼는데 그 툴은 스키마가
   * origin+width/height 라 이 모양을 낼 수 없어 `rectFromXY` 가 범용이라 통과하던 유령 인자였다.
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
      commitAgentBlueprintProgress();
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
      // stamp_structure 는 origin + repeat 만 받는다 — 발자국 크기가 인자에 없으므로 1×1 점으로
      // 귀속된다(repeat 는 읽지 않는다). 점이 두 칸에 들어가면 IoU 가 작은 칸을 고르므로 안전하다.
      markAgentBlueprintProgress("stamp_structure", { mapId: "m1", template: "l", origin: { x: 4, y: 4 } }, WRITE);
      expect(statusById().house_a).toBe("building");
    });

    it("place_examine_hotspots 의 hotspots[].at 으로 조사 칸이 진행된다", () => {
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      // 스키마는 항목마다 required:["at"] 이라 좌표가 한 겹 안에 있다(investigationTools.ts).
      // 항목 최상위 x/y 만 보던 시절에는 전량 포기 규칙에 걸려 영역이 0장 = 조용히 침묵이었다.
      markAgentBlueprintProgress(
        "place_examine_hotspots",
        { mapId: "m1", hotspots: [{ at: { x: 21, y: 3 }, name: "낡은 액자", once: true }, { at: { x: 24, y: 6 }, name: "이끼 낀 돌" }] },
        WRITE
      );
      expect(statusById()).toEqual({ site: "planned", main_road: "planned", house_a: "planned", grove: "building" });
    });

    it("최상위 width/height 가 새 맵 크기인 툴은 origin 과 짝지어도 맵 전체를 한 칸으로 만들지 않는다", () => {
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      // generate_map 계열 8종의 width/height 는 발자국이 아니라 만들 맵의 크기다. 발자국으로 읽으면
      // origin 을 좌상단으로 하는 맵 크기짜리 영역이 나오고, 그것은 IoU 로 맵 전체를 덮는 정리 칸을
      // 이겨(0.53 대 0.05) 나머지 칸을 전부 done 으로 밀어낸다. 오늘 이 짝을 보내는 툴은 없다 —
      // 하나 생기는 순간 조용히 터지는 자리라서 못으로 박는다.
      markAgentBlueprintProgress("generate_map", { mapId: "m1", origin: { x: 4, y: 4 }, width: 30, height: 20 }, WRITE);
      expect(statusById()).toEqual({ site: "planned", main_road: "planned", house_a: "building", grove: "planned" });
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

    it("스펙 게이트의 affectedRegions 도 v3 wrapper 키(area·at·wallRect)를 읽는다 — bounds 없는 파사드만 면적 0 폴백", () => {
      // 2026-09-03: 게이트가 이 키를 읽지 않으면 기존 내용 보호 검사를 건너뛴다(tile_erase 가 절벽을 지운 실측).
      // 청사진 추출(blueprintRegionsForToolCall)은 게이트 결과를 먼저 쓰므로 진행 판정은 그대로다.
      expect(affectedRegions("place_props", { mapId: "m1", area: { x: 20, y: 2, w: 6, h: 6 }, material: "침엽수", count: 8 }))
        .toEqual([{ mapId: "m1", x: 20, y: 2, w: 6, h: 6 }]);
      expect(affectedRegions("place_door", { mapId: "m1", at: { x: 6, y: 8 }, material: "문" }))
        .toEqual([{ mapId: "m1", x: 6, y: 8, w: 1, h: 1 }]);
      expect(affectedRegions("build_roof", { mapId: "m1", material: "붉은 기와", wallRect: { x: 4, y: 4, w: 6, h: 5 } }))
        .toEqual([{ mapId: "m1", x: 4, y: 4, w: 6, h: 5 }]);
      // author_village (bounds-less facade) was removed from the tool registry; its zero-area fallback case is retired.
    });
  });
  // 시스템 프롬프트는 집 2채 이상을 **한 호출**로 짓게 지시한다(contextBuilder: "2채 이상은
  // author_house kind=lots + houses[]로 한 번에 호출(개별 single 반복 금지)"). 그 호출의 게이트
  // 영역은 집마다 몸통+마당 2장씩 정확히 나오는데, 전체를 합쳐 승자 하나만 고르던 시절에는 세
  // 채 중 한 채만 building 이 되고 나머지 두 채는 뒤에 오는 호출이 없어 영원히 파랑으로 남았다.
  //
  // 이 블록은 **스키마 그대로의 인자 모양**(invalidArgsExample) 을 지키는 자리다. 채 수·맵 크기에
  // 대한 보장은 아래 매개변수 블록이 한다 — 여기 하나만 두면 특정 N 에서만 통과하는 상태를
  // 다시 못 보고 지나친다(4차 리뷰 N4-1 이 그 사고였다).
  describe("markAgentBlueprintProgress — 집 여러 채를 한 호출로 짓는 author_house(kind=lots)", () => {
    // Retired: author_house was removed from the tool registry; its kind=lots blueprint cases went with it.

    it("영역이 여러 개여도 맵 전체를 덮는 정리 칸을 훔쳐 가지 않는다", () => {
      // 영역마다 독립으로 승자를 고르면 1×1 점 하나만 보고 "그 점을 담은 가장 작은 칸"을 뽑게
      // 되므로 집 사각형을 지나는 길 60칸 중 12칸이 길 대신 집을 뽑는다(SPEC 의 main_road 와
      // house_a 는 12칸 겹친다). 그래서 남은 영역을 벗겨 가며 합산 커버리지로 뽑는다 — 길 60/60
      // = 1.0 이 집 12/30 = 0.4 를 이기고, 첫 승자가 60칸을 다 덮으므로 길 한 칸으로 끝난다.
      setAgentBlueprintFromSpec(SPEC);
      markAgentBlueprintProgress("paint_road", { mapId: "m1", points: roadPoints() }, WRITE);
      expect(statusById()).toEqual({ site: "planned", main_road: "building", house_a: "planned" });
    });
  });
  // 4차 리뷰 N4-1: 위의 3채 fixture 는 **경계 바로 아래**에 앉아 있었다. IoU 판정은 분모에 영역
  // 합계가 들어가므로 집의 점수가 1/N 로 깎이고 맵 전체를 덮는 정리 칸이 N² 로 커진다 — 실측
  // 교차점은 30×20 에서 N≈3.65 였다. 즉 N=3 만 통과하고 **N=4 부터 집이 한 채도 올라가지 않았다**
  // (실측: 30×20 N=4 → 0/4, N=5 → 0/5, 40×30 N=6 → 0/6, 100×100 N=20 → 0/20). `author_village` 의
  // 기본값이 `houseCount: 4` 이고 시스템 프롬프트가 2채 이상을 한 호출로 지시하므로 주경로가
  // 전부 깨진 상태였다. 그래서 N 과 맵 크기를 **매개변수로** 돈다 — 한 N 에서만 통과하는 테스트는
  // 없는 테스트보다 나쁘다.
  describe("markAgentBlueprintProgress — author_house(kind=lots) 는 N·맵 크기와 무관하게 전 채를 올린다", () => {
    // Retired: author_house was removed from the tool registry; its kind=lots blueprint cases went with it.

    // 커버리지 판정이 1차 리뷰의 보호를 유지하는지 — 맵 전체를 치우는 호출은 정리 칸 **하나만**
    // 올려야 한다(전 칸이 100% 덮이므로 동점이고, 겹침 면적 타이브레이크가 정리 칸을 고른다).
    it("맵 전체를 치우는 호출은 정리 칸만 올린다 — 나머지 칸을 함께 끌고 가지 않는다", () => {
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      markAgentBlueprintProgress("tile_erase", { mapId: "m1", rect: { x: 0, y: 0, w: 30, h: 20 } }, WRITE);
      expect(statusById()).toEqual({ site: "building", main_road: "planned", house_a: "planned", grove: "planned" });
    });

    it("한 영역이 크기 다른 두 칸을 모두 덮으면 겹침이 큰 칸이 이긴다 — 순번이 아니라 면적이다", () => {
      setAgentBlueprintFromSpec({
        mapId: "m1",
        assets: [
          { id: "small_first", kind: "prop", x: 0, y: 0, w: 2, h: 2 },
          { id: "big_second", kind: "house", x: 4, y: 0, w: 8, h: 4 },
        ],
      });
      markAgentBlueprintProgress("fill_region", { mapId: "m1", rect: { x: 0, y: 0, w: 12, h: 4 }, material: "잔디" }, WRITE);
      expect(statusById()).toEqual({ small_first: "planned", big_second: "building" });
    });
  });
  describe("markAgentBlueprintProgress — 대상 전체를 짓는 파사드(author_village)", () => {
    /** 시스템 프롬프트가 그대로 지시하는 모양 — contextBuilder: 마을=author_village(target:{kind:"existing",mapId} …). */
    const VILLAGE_CALL = { target: { kind: "existing", mapId: "m1" }, houseCount: 4, countPolicy: "exact" } as const;

    it("bounds 가 없으면 계획된 칸 전부를 짓는 중으로 올린다 — 한 칸만 고르면 정리 칸이 이긴다", () => {
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      markAgentBlueprintProgress("author_village", VILLAGE_CALL, WRITE);
      expect(statusById()).toEqual({ site: "building", main_road: "building", house_a: "building", grove: "building" });

      commitAgentBlueprintProgress();
      expect(statusById()).toEqual({ site: "done", main_road: "done", house_a: "done", grove: "done" });
    });

    // Retired: author_village was removed from the tool registry; the bounds-scoped facade case went with it.

    it("다른 맵을 짓는 파사드는 진행을 옮기지 않는다", () => {
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      const before = getAgentBlueprintState().revision;
      markAgentBlueprintProgress("author_village", { ...VILLAGE_CALL, target: { kind: "new", mapId: "m2", name: "새 마을", width: 40, height: 40 } }, WRITE);
      expect(getAgentBlueprintState().revision).toBe(before);
    });

    it("이미 끝난 칸은 되감지 않는다", () => {
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      markAgentBlueprintProgress("paint_road", { mapId: "m1", points: [{ x: 0, y: 16 }, { x: 29, y: 17 }] }, WRITE);
      commitAgentBlueprintProgress();
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
      commitAgentBlueprintProgress();
      const revision = getAgentBlueprintState().revision;

      // set_build_spec 은 계획을 세운 턴에만 온다 — 다음 턴은 세션의 활성 스펙으로 다시 맞춘다.
      syncAgentBlueprintWithSpec(SPEC);
      expect(statusById()).toEqual({ site: "planned", main_road: "planned", house_a: "done" });
      expect(getAgentBlueprintState().revision).toBe(revision);
    });

    it("스펙이 자동 확장돼도 살아남은 칸의 진행을 물려받는다", () => {
      setAgentBlueprintFromSpec(SPEC);
      markAgentBlueprintProgress("build_wall", HOUSE_WALL_ARGS, WRITE);
      commitAgentBlueprintProgress();

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
      commitAgentBlueprintProgress();

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
      commitAgentBlueprintProgress();

      // aiProposalCard.applyProposal 은 applyProposedProject **직전에** 고스트를 지운다. 청사진을
      // 여기에 묶어 두면 처음 시공한 턴의 끝에서 계획이 사라지고, set_build_spec 은 다음 턴에
      // 다시 오지 않으므로(스펙은 세션이 들고 있다) 그 뒤로는 영원히 빈 상태였다.
      clearAgentGhostPreview();

      expect(getAgentBlueprintState().entries).toHaveLength(3);
      expect(statusById().house_a).toBe("done");
    });
  });
  // 표시된 진행은 **저장소에 들어간 것**만 가리켜야 한다. 종전 정산은 종료 경로에 상관없이
  // building 을 done 으로 올렸는데, 패널의 다섯 종료 경로 중 셋(중단 return, catch 두 개)은 적용
  // 앞에서 끝나 초안을 그대로 버린다 — 손도 안 댄 타일 위에 회색 ✓ 가 박히고, 그 칸은 planned 가
  // 아니라서 다시 올라가지도 않으므로 세션이 죽을 때까지 남았다.
  describe("settleAgentBlueprintTurn", () => {
    /** VILLAGE_SPEC 의 길 칸(0,16,30,2)을 따라가는 실제 paint_road 인자. */
    const VILLAGE_ROAD = { mapId: "m1", points: [{ x: 0, y: 16 }, { x: 29, y: 17 }] } as const;
    /** VILLAGE_SPEC 의 집 칸을 그대로 덮는 쓰기. */
    const VILLAGE_HOUSE_FILL = { mapId: "m1", rect: { x: 4, y: 4, w: 6, h: 5 }, material: "흰 집 벽" } as const;

    it("적용이 없으면 이번 턴에 올린 칸이 전부 planned 로 되돌아간다 — 턴 도중 done 으로 내려간 앞 칸까지", () => {
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      markAgentBlueprintProgress("paint_road", VILLAGE_ROAD, WRITE);
      markAgentBlueprintProgress("fill_region", VILLAGE_HOUSE_FILL, WRITE);
      // 인과 순서 판정이 길을 그 자리에서 done 으로 내렸다 — 저장소에는 아직 아무것도 없다.
      expect(statusById()).toEqual({ site: "planned", main_road: "done", house_a: "building", grove: "planned" });

      settleAgentBlueprintTurn(APPLIED_NOTHING);
      expect(statusById()).toEqual({ site: "planned", main_road: "planned", house_a: "planned", grove: "planned" });
    });

    it("들어간 영역에 걸리는 칸만 done 이 된다", () => {
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      markAgentBlueprintProgress("paint_road", VILLAGE_ROAD, WRITE);
      markAgentBlueprintProgress("fill_region", VILLAGE_HOUSE_FILL, WRITE);

      // 길만 저장소에 들어갔다(집 쓰기는 제안에서 빠졌거나 변경을 못 냈다).
      settleAgentBlueprintTurn(appliedRegions({ mapId: "m1", x: 0, y: 16, w: 30, h: 2 }));
      expect(statusById()).toEqual({ site: "planned", main_road: "done", house_a: "planned", grove: "planned" });
    });

    it("다른 맵에 들어간 변경은 이 청사진을 확정하지 못한다", () => {
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      markAgentBlueprintProgress("fill_region", VILLAGE_HOUSE_FILL, WRITE);
      settleAgentBlueprintTurn(appliedRegions({ mapId: "m2", x: 4, y: 4, w: 6, h: 5 }));
      expect(statusById().house_a).toBe("planned");
    });

    it("앞 턴에 확정된 done 은 정산이 건드리지 않는다", () => {
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      markAgentBlueprintProgress("fill_region", VILLAGE_HOUSE_FILL, WRITE);
      settleAgentBlueprintTurn(appliedRegions({ mapId: "m1", x: 4, y: 4, w: 6, h: 5 }));
      expect(statusById().house_a).toBe("done");

      // 다음 턴: 길을 치다가 중단했다. 집의 done 은 이번 턴 것이 아니므로 남는다.
      markAgentBlueprintProgress("paint_road", VILLAGE_ROAD, WRITE);
      settleAgentBlueprintTurn(APPLIED_NOTHING);
      expect(statusById()).toEqual({ site: "planned", main_road: "planned", house_a: "done", grove: "planned" });
    });

    it("되돌릴 것이 없으면 리비전을 낭비하지 않는다", () => {
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      markAgentBlueprintProgress("fill_region", VILLAGE_HOUSE_FILL, WRITE);
      settleAgentBlueprintTurn(APPLIED_NOTHING);
      const revision = getAgentBlueprintState().revision;
      settleAgentBlueprintTurn(APPLIED_NOTHING);
      expect(getAgentBlueprintState().revision).toBe(revision);
    });

    it("bounds 없는 파사드는 영역이 없어도 그 맵이면 확정된다 — 마을을 다 짓고도 전부 파랑으로 되감기지 않는다", () => {
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      markAgentBlueprintProgress("author_village", { target: { kind: "existing", mapId: "m1" }, houseCount: 4, countPolicy: "exact" }, WRITE);
      settleAgentBlueprintTurn({ regions: [], wholeTargetMapIds: ["m1"] });
      expect(statusById()).toEqual({ site: "done", main_road: "done", house_a: "done", grove: "done" });
    });

    it("다른 맵을 지은 파사드는 이 청사진을 확정하지 못한다", () => {
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      markAgentBlueprintProgress("author_village", { target: { kind: "existing", mapId: "m1" }, houseCount: 4, countPolicy: "exact" }, WRITE);
      settleAgentBlueprintTurn({ regions: [], wholeTargetMapIds: ["m2"] });
      expect(statusById()).toEqual({ site: "planned", main_road: "planned", house_a: "planned", grove: "planned" });
    });

    // 4차 리뷰 N4-4: 정산·마일스톤 확정을 **지나지 않는** 종료 경로가 있다(패널의 `!ownsTurn(true)`
    // 반환 두 곳). 그 턴의 기록이 남으면 다음 턴 정산이 이번 턴과 무관한 칸을 되돌린다. 오늘
    // dropSession/dispose 가 청사진을 지워서 드러나지 않을 뿐이므로 턴 시작에서 명시적으로 끊는다.
    it("턴 시작은 지난 턴의 미정산 기록을 버린다 — 이번 턴 정산이 남의 칸을 되돌리지 않는다", () => {
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      markAgentBlueprintProgress("fill_region", VILLAGE_HOUSE_FILL, WRITE);
      expect(statusById().house_a).toBe("building");
      // 소유권을 잃은 턴이 정산 없이 끝났다.

      beginAgentBlueprintTurn();
      markAgentBlueprintProgress("paint_road", VILLAGE_ROAD, WRITE);
      settleAgentBlueprintTurn(APPLIED_NOTHING);

      // 이번 턴이 올린 것은 길뿐이다 — 길만 planned 로 돌아가고 집은 이번 턴 정산의 대상이 아니다.
      expect(statusById()).toEqual({ site: "planned", main_road: "planned", house_a: "done", grove: "planned" });
    });

    it("턴 시작 자체는 화면 상태를 건드리지 않는다", () => {
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      markAgentBlueprintProgress("fill_region", VILLAGE_HOUSE_FILL, WRITE);
      const revision = getAgentBlueprintState().revision;
      beginAgentBlueprintTurn();
      expect(getAgentBlueprintState().revision).toBe(revision);
      expect(statusById().house_a).toBe("building");
    });
  });
  // 4차 리뷰 N4-2: 정산의 근거가 진행 판정보다 **약했다**. `appliedBlueprintRegions` 는 완성도
  // 린트의 추출(proposalChangedRegions → affectedRegions)만 봤는데, 그것은 좌표를 wrapper 키에
  // 담는 쓰기 툴을 면적 0 으로 떨어뜨리는 fail-closed 함수다 — 즉 청사진 전용 추출이 있어야
  // 진행이 올라가는 쓰기 툴 11종은 전부 정산에서 "안 들어갔다" 로 판정돼 planned 로 되감겼다.
  // 사용자가 보는 것: plant_tree_clusters 로 숲을 심고 타일이 실제로 바뀌는데 맵이 파랑으로 되감긴다.
  describe("appliedBlueprintRegions — 진행을 올린 근거는 정산도 볼 수 있어야 한다", () => {
    function changed(overrides: Partial<ChangeSummary> = {}): ChangeSummary {
      return {
        tilesChanged: 12,
        eventsAdded: 0,
        eventsModified: 0,
        eventsRemoved: 0,
        mapsAdded: 0,
        mapsRemoved: 0,
        dbRecordsChanged: 0,
        tilesetsChanged: 0,
        switchesAdded: 0,
        variablesAdded: 0,
        worldEntitiesAdded: 0,
        worldEntitiesModified: 0,
        palettePresetsAdded: 0,
        palettePresetsModified: 0,
        endingsChanged: 0,
        sessionChanged: false,
        systemChanged: false,
        warnings: [],
        ...overrides,
      };
    }

    function okCall(name: string, args: Record<string, unknown>, diff: ChangeSummary = changed()) {
      return { name, args, result: { ok: true, diff } };
    }

    /** 린트 추출이 영역을 못 뽑는 쓰기 툴들 — 전부 청사진 전용 추출로만 위치가 나온다. */
    const SETTLE_BLIND_CALLS = [
      okCall("plant_tree_clusters", { mapId: "m1", area: { x: 20, y: 2, w: 6, h: 6 }, style: "conifer", count: 8 }),
      okCall("create_farm_plot", { mapId: "m1", area: { x: 20, y: 2, w: 6, h: 6 } }),
      okCall("place_examine_hotspots", { mapId: "m1", hotspots: [{ at: { x: 21, y: 3 }, name: "낡은 액자" }] }),
      okCall("set_lighting_volume", { mapId: "m1", area: { x: 20, y: 2, w: 6, h: 6 }, mood: "dusk" }),
    ] as const;

    it("린트가 영역을 못 뽑아도 실제 변경이 있으면 청사진 추출로 되읽는다", () => {
      for (const call of SETTLE_BLIND_CALLS) {
        // 2026-09-03: 게이트의 affectedRegions 가 `area` 를 읽게 되어 앞의 둘·넷은 이제 린트 경로로도 영역이
        // 나온다. hotspots[].at 같은 배열 wrapper 는 여전히 면적 0 폴백 — 어느 쪽이든 정산 영역은 나와야 한다.
        const applied = appliedBlueprintRegions([call]);
        expect(applied.regions.length).toBeGreaterThan(0);
        expect(applied.regions.every((region) => region.mapId === "m1")).toBe(true);
      }
    });

    it("진행을 올린 칸이 그 근거로 done 이 된다 — 심어 놓고 파랑으로 되감기지 않는다", () => {
      const call = SETTLE_BLIND_CALLS[0];
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      markAgentBlueprintProgress(call.name, call.args, WRITE);
      expect(statusById().grove).toBe("building");

      settleAgentBlueprintTurn(appliedBlueprintRegions([call]));
      expect(statusById()).toEqual({ site: "planned", main_road: "planned", house_a: "planned", grove: "done" });
    });

    it("무변경 호출은 폴백에 닿지 않는다 — 손도 안 댄 칸이 done 이 되지 않는다", () => {
      // 폴백의 문지기는 proposalCallChangedSomething(성공 + 의미 있는 diff)이다. diff 가 비면
      // 영역이 나오지 않고 정산이 그 칸을 planned 로 되돌린다.
      const noop = okCall(
        "plant_tree_clusters",
        { mapId: "m1", area: { x: 20, y: 2, w: 6, h: 6 }, style: "conifer" },
        changed({ tilesChanged: 0 })
      );
      expect(appliedBlueprintRegions([noop]).regions).toEqual([]);

      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      markAgentBlueprintProgress(noop.name, noop.args, WRITE);
      settleAgentBlueprintTurn(appliedBlueprintRegions([noop]));
      expect(statusById().grove).toBe("planned");
    });

    it("실패한 호출도 폴백에 닿지 않는다", () => {
      const failed = { name: "plant_tree_clusters", args: { mapId: "m1", area: { x: 20, y: 2, w: 6, h: 6 } }, result: { ok: false, diff: changed() } };
      expect(appliedBlueprintRegions([failed]).regions).toEqual([]);
    });

    it("린트가 영역을 뽑는 호출은 그 영역을 그대로 쓴다 — 두 표면이 같은 근거를 본다", () => {
      const fill = okCall("fill_region", { mapId: "m1", rect: { x: 4, y: 4, w: 6, h: 5 }, material: "흰 집 벽" });
      expect(appliedBlueprintRegions([fill]).regions).toEqual([{ mapId: "m1", x: 4, y: 4, w: 6, h: 5 }]);
    });

    it("bounds 없는 author_village 는 대상 맵 id 로 인정된다", () => {
      const village = okCall("author_village", { target: { kind: "existing", mapId: "m1" }, houseCount: 4, countPolicy: "exact" });
      expect(appliedBlueprintRegions([village]).wholeTargetMapIds).toEqual(["m1"]);
    });
  });
  // 청사진 전용 추출이 "읽는다"고 적어 둔 키는 실제로 도달 가능해야 한다 — 죽은 목록은 다음
  // 사람에게 커버리지가 있다고 거짓말한다. spots/areas 는 최상위 mapId 가 없어서 이 모듈이
  // 먼저 빠져나가므로 목록에서 뺐고, 그 사실을 여기서 못으로 박는다.
  describe("blueprintRegionsForToolCall — 도달할 수 없는 모양", () => {
    it("configure_fishing / configure_seasonal_forage 는 맵 id 가 항목마다 있어 청사진 대상이 아니다", () => {
      expect(blueprintRegionsForToolCall("configure_fishing", {
        enabled: true,
        spots: [{ id: "spot_river", mapId: "m1", area: { x: 0, y: 0, w: 4, h: 4 }, catches: [{ fishId: "fish_river", weight: 1 }] }],
      })).toEqual({ mapId: null, regions: [], wholeTarget: false });
      expect(blueprintRegionsForToolCall("configure_seasonal_forage", {
        enabled: true,
        areas: [{ id: "forage_farm", mapId: "m1", area: { x: 0, y: 0, w: 5, h: 5 }, dailySpawnCount: 2, maxActive: 6, despawnAfterDays: 3, entries: [] }],
      })).toEqual({ mapId: null, regions: [], wholeTarget: false });
    });
  });
  describe("commitAgentBlueprintProgress / clearAgentBlueprint", () => {
    it("적용이 들어가면 building 이던 칸이 done 으로 확정된다", () => {
      setAgentBlueprintFromSpec(SPEC);
      markAgentBlueprintProgress("build_wall", HOUSE_WALL_ARGS, WRITE);
      commitAgentBlueprintProgress();
      expect(statusById().house_a).toBe("done");
      // 두 번 불러도 리비전이 늘지 않는다.
      const revision = getAgentBlueprintState().revision;
      commitAgentBlueprintProgress();
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
  describe("agentBlueprintForMap — 다 지은 계획은 캔버스에서 물러난다", () => {
    /** VILLAGE_SPEC 을 한 턴에 다 짓는 파사드 한 호출 + 그 맵에 적용된 턴 끝. */
    function buildWholeVillage(): void {
      markAgentBlueprintProgress("author_village", { target: { kind: "existing", mapId: "m1" }, houseCount: 4, countPolicy: "exact" }, WRITE);
      settleAgentBlueprintTurn({ regions: [], wholeTargetMapIds: ["m1"] });
    }

    it("계획에 남은 일이 없으면 그릴 칸이 없다 — 상태는 진실을 그대로 들고 있다", () => {
      // 사용자가 본 결함: 조수에게 시킨 일이 다 끝나 결과까지 나왔는데도 맵 위에 `1/2 지형 ✓`
      // 같은 계획 라벨이 그대로 남았다. 다 지은 계획은 더 이상 알릴 것이 없다.
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      buildWholeVillage();

      const state = getAgentBlueprintState();
      expect(state.entries.map((entry) => entry.status)).toEqual(["done", "done", "done", "done"]);
      expect(agentBlueprintForMap(state, "m1")).toHaveLength(0);
    });

    it("한 칸이라도 남았으면 계획은 맵 위에 살아있다", () => {
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      // 짓는 중(building) — 진행 표시가 있어야 하는 상태다.
      markAgentBlueprintProgress("author_village", { target: { kind: "existing", mapId: "m1" }, houseCount: 4, countPolicy: "exact" }, WRITE);
      expect(agentBlueprintForMap(getAgentBlueprintState(), "m1")).toHaveLength(4);

      // 정산이 적용되지 않은 칸을 planned 로 되돌렸다 — "이건 안 들어갔다" 는 참인 정보라 남긴다.
      // 맵 전제를 덮는 정리 칸(site)은 들어간 길 영역과 거치므로 상황만 함까 도다 — 집·숙이 남는다.
      settleAgentBlueprintTurn(appliedRegions({ mapId: "m1", x: 0, y: 16, w: 30, h: 2 }));
      expect(statusById()).toEqual({ site: "done", main_road: "done", house_a: "planned", grove: "planned" });
      expect(agentBlueprintForMap(getAgentBlueprintState(), "m1")).toHaveLength(4);
    });

    it("다음 턴의 재동기화가 다 지은 계획을 되살리지 않는다", () => {
      // 상태를 지우는 방식이 안 되는 이유: setAgentBlueprintFromSpec 은 done 을 사각형 기준으로
      // 물려받는다. 지우면 물려받을 것이 없어지므로 턴 시작 재동기화가 **다 지어진 맵 위에**
      // 전량 planned 파랑 계획을 다시 깐게 된다.
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      buildWholeVillage();

      beginAgentBlueprintTurn();
      syncAgentBlueprintWithSpec(VILLAGE_SPEC);
      expect(statusById()).toEqual({ site: "done", main_road: "done", house_a: "done", grove: "done" });
      expect(agentBlueprintForMap(getAgentBlueprintState(), "m1")).toHaveLength(0);
    });

    it("마일스톤 확정으로 다 지어진 뒤 중단해도 계획이 되살아나지 않는다", () => {
      // 리뷰 지적: 턴 도중에 전 칸이 done 이 되면 물러나는데, 뒤이은 중단 정산이 그 칸을 planned 로
      // 되돌려 계획이 캔버스에 **되살아나는** 것 아닌가. 그럴 수 없다 —
      // (1) markAgentBlueprintProgress 단독으로는 전 칸 done 이 될 수 없다(방금 올린 칸이 building 으로
      //     남는다), (2) 전 칸을 done 으로 만들 수 있는 것은 마일스톤 확정뿐이고 그것은 저장소에 실제로
      //     커밋된 시점이며 turnAdvanced 를 함께 비운다 → 이후 정산은 되돌릴 대상이 없다.
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      markAgentBlueprintProgress("author_village", { target: { kind: "existing", mapId: "m1" }, houseCount: 4, countPolicy: "exact" }, WRITE);
      commitAgentBlueprintProgress();
      expect(agentBlueprintForMap(getAgentBlueprintState(), "m1")).toHaveLength(0);

      // 마일스톤 뒤에 사용자가 중단했다 — 아무것도 적용되지 않은 턴 끝.
      settleAgentBlueprintTurn(APPLIED_NOTHING);
      expect(statusById()).toEqual({ site: "done", main_road: "done", house_a: "done", grove: "done" });
      expect(agentBlueprintForMap(getAgentBlueprintState(), "m1")).toHaveLength(0);
    });

    it("스펙 자동 확장이 새 칸을 덧붙이면 다시 그린다 — 물러난 것은 계획이 아니라 끝난 표시다", () => {
      setAgentBlueprintFromSpec(VILLAGE_SPEC);
      buildWholeVillage();
      expect(agentBlueprintForMap(getAgentBlueprintState(), "m1")).toHaveLength(0);

      // expandSpecWithRegions 가 명세 밖 쓰기를 보고 에셋을 덧붙인 뒤 재동기화한 상황.
      setAgentBlueprintFromSpec({
        ...VILLAGE_SPEC,
        assets: [...VILLAGE_SPEC.assets, { id: "auto_1", kind: "structure", x: 12, y: 2, w: 4, h: 4 }],
      });
      expect(statusById()).toEqual({ site: "done", main_road: "done", house_a: "done", grove: "done", auto_1: "planned" });
      expect(agentBlueprintForMap(getAgentBlueprintState(), "m1")).toHaveLength(5);
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
});

// 청사진(맵 위 밑그림 오버레이) 강화 — 2026-09-03 적대적 리뷰 실측 결함의 회귀 테스트.
describe("agentBlueprintHardening", () => {
  isolateTimers();
  const WRITE = { write: true } as const;
  afterEach(() => {
    clearAgentBlueprint();
  });
  function entry(patch: Partial<BlueprintEntry> = {}): BlueprintEntry {
    return { id: "a", kind: "house", label: "집", x: 0, y: 0, w: 4, h: 4, order: 1, status: "planned", ...patch };
  }
  describe("재제출된 밑그림은 진행을 사각형 겹침으로 물려받는다", () => {
    it("에셋 id·사각형이 바뀐 재제출에서도 짓는 중이던 집은 planned 로 되감기지 않고, 정산에서 done 이 된다", () => {
      // break: entryShapeKey 로만 물려받으면 새 id·새 사각형의 집이 planned 로 떨어져 다 지은 맵 위에 파랑 계획이 남는다(run1 실측).
      setAgentBlueprintFromSpec({ mapId: "m1", buildOrder: ["house", "road"], assets: [
        { id: "house_1", kind: "house", x: 5, y: 10, w: 8, h: 10 },
        { id: "road_main", kind: "road", x: 13, y: 14, w: 5, h: 2 },
      ] });
      markAgentBlueprintProgress("author_house", { kind: "single", mapId: "m1", wings: [{ x: 5, y: 10, w: 8, h: 10 }] }, WRITE);
      expect(getAgentBlueprintState().entries.find((e) => e.id === "house_1")?.status).toBe("building");

      setAgentBlueprintFromSpec({ mapId: "m1", buildOrder: ["road", "npc", "house"], assets: [
        { id: "road_main", kind: "road", x: 8, y: 17, w: 14, h: 2 },
        { id: "npc_1", kind: "npc", x: 11, y: 19, w: 1, h: 1 },
        { id: "built_house_1", kind: "house", x: 6, y: 10, w: 7, h: 7 },
      ] });
      const inherited = getAgentBlueprintState().entries.find((e) => e.id === "built_house_1");
      expect(inherited?.status).toBe("building");

      settleAgentBlueprintTurn({ regions: [{ mapId: "m1", x: 5, y: 10, w: 8, h: 10 }], wholeTargetMapIds: [] });
      expect(getAgentBlueprintState().entries.find((e) => e.id === "built_house_1")?.status).toBe("done");
    });

    it("종류가 다르거나 절반도 겹치지 않으면 물려받지 않는다", () => {
      // break: 겹침 조건 없이 물려받으면 길 진행이 집으로 옮겨 붙는다.
      setAgentBlueprintFromSpec({ mapId: "m1", assets: [{ id: "road", kind: "road", x: 0, y: 10, w: 20, h: 2 }] });
      markAgentBlueprintProgress("paint_road", { mapId: "m1", points: [{ x: 0, y: 10 }, { x: 19, y: 10 }] }, WRITE);
      setAgentBlueprintFromSpec({ mapId: "m1", assets: [
        { id: "house", kind: "house", x: 0, y: 10, w: 6, h: 6 },
        { id: "road_2", kind: "road", x: 0, y: 14, w: 20, h: 2 },
      ] });
      expect(getAgentBlueprintState().entries.map((e) => `${e.id}:${e.status}`)).toEqual(["house:planned", "road_2:planned"]);
    });
  });
  describe("진행 귀속 — 스치는 잔여 영역은 큰 칸을 올리지 않는다", () => {
    it("집 호출의 문 앞 1칸이 맵 전체 정리 칸을 building 으로 올리지 않는다", () => {
      // break: 탐욕 벗겨내기에 덮인 비율 하한이 없으면 문 칸 1/4096 이 clear 칸에 귀속돼 정리가 노란 테두리로 맵을 덮는다(e1-03 실측).
      setAgentBlueprintFromSpec({ mapId: "m1", buildOrder: ["clear", "house"], assets: [
        { id: "clear_all", kind: "clear", x: 0, y: 0, w: 64, h: 64 },
        { id: "house_a", kind: "house", x: 4, y: 4, w: 7, h: 8 },
      ] });
      markAgentBlueprintProgress("author_house", { kind: "single", mapId: "m1", wings: [{ x: 4, y: 4, w: 7, h: 8 }] }, WRITE);
      const byId = Object.fromEntries(getAgentBlueprintState().entries.map((e) => [e.id, e.status]));
      expect(byId).toEqual({ clear_all: "planned", house_a: "building" });
    });

    it("맵 전체를 치우는 호출은 여전히 정리 칸을 올린다", () => {
      setAgentBlueprintFromSpec({ mapId: "m1", buildOrder: ["clear", "house"], assets: [
        { id: "clear_all", kind: "clear", x: 0, y: 0, w: 64, h: 64 },
        { id: "house_a", kind: "house", x: 4, y: 4, w: 7, h: 8 },
      ] });
      markAgentBlueprintProgress("tile_erase", { mapId: "m1", rect: { x: 0, y: 0, w: 64, h: 64 } }, WRITE);
      expect(getAgentBlueprintState().entries.find((e) => e.id === "clear_all")?.status).toBe("building");
    });
  });
  describe("라벨 배치 — 겹치지 않고, 가리지 않고, 사라지지 않는다", () => {
    it("좁은 칸(3칸 미만)은 순번만 쓰고, 같은 자리에서 시작하는 라벨은 줄을 내려 쌓는다", () => {
      // break: 모든 칸에 같은 위치·같은 길이의 캡션을 쓰면 1×1 주민 셋이 한 덩이로 겹치고 상위 장식 라벨이 집 라벨을 가린다(e1-01 실측).
      const entries = [
        entry({ id: "house", kind: "house", label: "집", x: 4, y: 4, w: 7, h: 8, order: 1 }),
        entry({ id: "tree", kind: "tree", label: "나무", x: 4, y: 4, w: 3, h: 3, order: 2 }),
        entry({ id: "npc_1", kind: "npc", label: "주민", x: 12, y: 16, w: 1, h: 1, order: 3 }),
        entry({ id: "npc_2", kind: "npc", label: "주민", x: 13, y: 16, w: 1, h: 1, order: 4, status: "done" }),
      ];
      const layout = blueprintLabelLayout(entries);
      expect(layout.map((label) => label.caption)).toEqual(["1/4 집", "2/4 나무", "3", "4 ✓"]);
      expect(layout.map((label) => label.row)).toEqual([0, 1, 0, 0]);
    });

    it("칸이 40개를 넘으면 라벨을 없애는 대신 순번만 남긴다", () => {
      // break: 41개부터 라벨을 전부 생략하면 무엇이 어디에 몇 번째인지 알 길이 없다(e1-04 실측).
      const entries = Array.from({ length: BLUEPRINT_MAX_LABELS + 5 }, (_unused, index) =>
        entry({ id: `p${index}`, kind: "prop", label: "소품", x: (index % 9) * 4, y: Math.floor(index / 9) * 4, w: 3, h: 3, order: index + 1 }),
      );
      const layout = blueprintLabelLayout(entries);
      expect(layout).toHaveLength(entries.length);
      expect(layout[0].caption).toBe("1");
      expect(layout.every((label) => !label.caption.includes("소품"))).toBe(true);
    });
  });
  describe("렌더러 — 밝은 맵에서도 보이는 선, 원형 힌트", () => {
    let graphicsCalls: { strokes: number[][]; ellipses: number; rects: number }[];
    let textCalls: { x: number; y: number; content: string }[];
    let scene: any;
    let layer: any;

    beforeEach(() => {
      graphicsCalls = [];
      textCalls = [];
      const makeContainer = (): any => {
        const children: any[] = [];
        return { add: vi.fn((child: any) => children.push(child)), removeAll: vi.fn(() => { children.length = 0; }), setName: vi.fn(), children };
      };
      layer = makeContainer();
      scene = {
        add: {
          container: vi.fn(() => makeContainer()),
          graphics: vi.fn(() => {
            const record = { strokes: [] as number[][], ellipses: 0, rects: 0 };
            graphicsCalls.push(record);
            return {
              clear: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), strokePath: vi.fn(),
              fillStyle: vi.fn(), fillRect: vi.fn(), fillEllipse: vi.fn(),
              lineStyle: vi.fn((width: number, color: number, alpha: number) => record.strokes.push([width, color, alpha])),
              strokeRect: vi.fn(() => { record.rects += 1; }),
              strokeEllipse: vi.fn(() => { record.ellipses += 1; }),
              destroy: vi.fn(),
            };
          }),
          text: vi.fn((x: number, y: number, content: string) => {
            const object = { x, y, content, alpha: 1, setAlpha: vi.fn((a: number) => (object.alpha = a)), destroy: vi.fn() };
            textCalls.push(object);
            return object;
          }),
        },
        cameras: { main: { zoom: 1 } },
      };
    });

    it("계획 선 아래에 어두운 테두리(halo)를 깔아 얼음·눈 배경에서도 보이게 한다", () => {
      // break: 밝은 파랑 1px 0.6 알파만 그리면 얼음 배경 대비 1.5:1 로 계획이 보이지 않는다(e1-01 실측).
      setAgentBlueprintFromSpec({ mapId: "m1", assets: [{ id: "h", kind: "house", x: 2, y: 2, w: 4, h: 4 }] });
      new AgentBlueprintRenderer(scene, layer, () => "m1").render();
      const strokes = graphicsCalls[0].strokes;
      // halo + line, then a 1px ruler-tick stroke that agentBlueprintRenderer.ts now draws on finished rectangles.
      expect(strokes.length).toBe(3);
      const [halo, line, ticks] = strokes;
      expect(ticks[0]).toBe(1);
      expect(halo[0]).toBeGreaterThan(line[0]);
      expect(halo[1]).toBe(blueprintStatusStyle("planned").haloColor);
      expect(line[2]).toBeGreaterThanOrEqual(0.85);
    });

    it("shape 가 circle·ellipse 인 에셋은 타원으로 그린다", () => {
      // break: 형태 힌트를 버리면 원형 호수 계획이 네모로 찍힌다.
      setAgentBlueprintFromSpec({ mapId: "m1", assets: [
        { id: "pond", kind: "terrain", x: 2, y: 2, w: 8, h: 6, shape: "circle" },
        { id: "h", kind: "house", x: 12, y: 2, w: 4, h: 4 },
      ] });
      new AgentBlueprintRenderer(scene, layer, () => "m1").render();
      expect(graphicsCalls.map((record) => [record.ellipses, record.rects])).toEqual([[2, 0], [0, 2]]);
    });

    it("같은 자리에서 시작하는 라벨은 y 를 내려 쌓고, 좁은 칸의 라벨은 순번만 찍는다", () => {
      setAgentBlueprintFromSpec({ mapId: "m1", buildOrder: ["house", "tree", "npc"], assets: [
        { id: "house", kind: "house", x: 4, y: 4, w: 7, h: 8 },
        { id: "tree", kind: "tree", layer: "upper", x: 4, y: 4, w: 3, h: 3 },
        { id: "npc", kind: "npc", x: 12, y: 16, w: 1, h: 1 },
      ] });
      new AgentBlueprintRenderer(scene, layer, () => "m1").render();
      expect(textCalls.map((text) => text.content)).toEqual(["1/3 집", "2/3 나무", "3"]);
      expect(textCalls[1].y).toBeGreaterThan(textCalls[0].y);
    });
  });
  describe("BlueprintEntry 는 형태 힌트를 들고 간다", () => {
    it("스펙의 shape 가 청사진 칸에 남는다", () => {
      setAgentBlueprintFromSpec({ mapId: "m1", assets: [{ id: "pond", kind: "terrain", x: 2, y: 2, w: 8, h: 6, shape: "ellipse" }] } as BuildSpec);
      expect(getAgentBlueprintState().entries[0].shape).toBe("ellipse");
    });
  });
});

describe("agentBlueprintRenderer", () => {
  isolateTimers();
  function entry(patch: Partial<BlueprintEntry> = {}): BlueprintEntry {
    return { id: "a", kind: "house", label: "집", x: 0, y: 0, w: 2, h: 2, order: 1, status: "planned", ...patch };
  }
  describe("blueprintStatusStyle", () => {
    it("상태를 선 굵기·알파로만 구분한다 — 트윈·펄스를 쓰지 않는다", () => {
      const planned = blueprintStatusStyle("planned");
      const building = blueprintStatusStyle("building");
      const done = blueprintStatusStyle("done");
      expect(building.strokeWidth).toBeGreaterThan(planned.strokeWidth);
      expect(building.strokeAlpha).toBeGreaterThan(planned.strokeAlpha);
      expect(done.strokeAlpha).toBeLessThan(planned.strokeAlpha);
      expect(done.fillAlpha).toBe(0);
      expect(done.labelAlpha).toBeLessThan(planned.labelAlpha);
    });
  });
  describe("blueprintEntryCaption", () => {
    it("순번과 사람 말 라벨만 쓴다 — 도구명·에셋 id 를 노출하지 않는다", () => {
      expect(blueprintEntryCaption(entry({ order: 2 }), 5)).toBe("2/5 집");
      expect(blueprintEntryCaption(entry({ order: 2, status: "building" }), 5)).toBe("2/5 집");
      expect(blueprintEntryCaption(entry({ order: 2, status: "done" }), 5)).toBe("2/5 집 ✓");
      expect(blueprintEntryCaption(entry({ id: "house_left_wing" }), 1)).not.toContain("house_left_wing");
    });
  });
  describe("AgentBlueprintRenderer", () => {
    let mockLayer: any;
    let mockScene: any;
    let graphicsCalls: any[];
    let textCalls: any[];

    beforeEach(() => {
      graphicsCalls = [];
      textCalls = [];
      mockLayer = makeContainer();
      mockScene = {
        add: {
          container: vi.fn(() => makeContainer()),
          graphics: vi.fn(() => {
            const record = { fills: [] as number[][], strokes: [] as number[][] };
            graphicsCalls.push(record);
            return {
              clear: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), strokePath: vi.fn(),
              fillStyle: vi.fn((color: number, alpha: number) => record.fills.push([color, alpha])),
              fillRect: vi.fn(),
              lineStyle: vi.fn((width: number, color: number, alpha: number) => record.strokes.push([width, color, alpha])),
              strokeRect: vi.fn(),
              destroy: vi.fn(),
            };
          }),
          text: vi.fn((x: number, y: number, content: string, style: Record<string, unknown>) => {
            const object = { x, y, content, style, alpha: 1, setAlpha: vi.fn((a: number) => (object.alpha = a)), destroy: vi.fn() };
            textCalls.push(object);
            return object;
          }),
        },
        cameras: { main: { zoom: 2 } },
      };
    });

    afterEach(() => {
      clearAgentBlueprint();
    });

    it("청사진이 없으면 아무것도 그리지 않는다", () => {
      const renderer = new AgentBlueprintRenderer(mockScene, mockLayer, () => "m1");
      renderer.render();
      expect(mockScene.add.container).not.toHaveBeenCalled();
      // removeAll(true) — 인자를 빼면 Graphics/Text 가 파괴되지 않고 텍스처가 새면서
      // 리렌더마다 GPU 텍스처가 쌓인다. 인자까지 봐야 그 회귀를 잡는다.
      expect(mockLayer.removeAll).toHaveBeenCalledWith(true);
    });

    it("다른 맵을 보고 있으면 그리지 않는다", () => {
      setAgentBlueprintFromSpec(spec());
      const renderer = new AgentBlueprintRenderer(mockScene, mockLayer, () => "m2");
      renderer.render();
      expect(mockScene.add.container).not.toHaveBeenCalled();
    });

    it("칸마다 사각형 하나와 라벨 하나를 그린다", () => {
      setAgentBlueprintFromSpec(spec());
      const renderer = new AgentBlueprintRenderer(mockScene, mockLayer, () => "m1");
      renderer.render();
      expect(graphicsCalls).toHaveLength(2);
      expect(textCalls.map((text) => text.content)).toEqual(["1/2 길", "2/2 집"]);
      // 라벨은 사각형 안쪽 위 — 맵 위쪽 경계에서도 화면 밖으로 나가지 않는다.
      expect(textCalls[0].y).toBeGreaterThanOrEqual(0);
      // zoom 을 반영해 고해상도로 래스터화한다(캔버스에서 뭉개지지 않게).
      expect(textCalls[0].style.resolution).toBeGreaterThanOrEqual(2);
    });

    it("원본 보기(꾹 누름) 중에는 청사진도 숨는다 — 고스트와 같은 토글을 따른다", () => {
      setAgentBlueprintFromSpec(spec());
      const renderer = new AgentBlueprintRenderer(mockScene, mockLayer, () => "m1");
      // 고스트의 스프라이트·애니메이션·DOM 마커는 이 토글을 보는데(agentPreviewRenderers) 청사진만
      // 보지 않아, 맵 원본을 보려고 꾹 누르면 사각형과 라벨 40장이 그대로 위에 남았다.
      setAgentGhostPreviewHidden(true);
      try {
        renderer.render();
        expect(graphicsCalls).toHaveLength(0);
        expect(textCalls).toHaveLength(0);
        expect(mockLayer.removeAll).toHaveBeenCalledWith(true);
      } finally {
        setAgentGhostPreviewHidden(false);
      }
      renderer.render();
      expect(graphicsCalls).toHaveLength(2);
    });

    it("다 지은 계획은 사각형도 라벨도 그리지 않는다 — 결과물 위에 `2/2 집 ✓` 가 살지 않는다", () => {
      setAgentBlueprintFromSpec(spec());
      const renderer = new AgentBlueprintRenderer(mockScene, mockLayer, () => "m1");
      // 지어지는 동었엔 보인다.
      markAgentBlueprintProgress("paint_road", { mapId: "m1", points: [{ x: 0, y: 5 }, { x: 19, y: 6 }] }, { write: true });
      renderer.render();
      expect(textCalls.map((text) => text.content)).toEqual(["1/2 길", "2/2 집"]);

      // 둘 다 시공되어 정산이 끝났다 — 사용자가 보는 것은 이제 자기 결과물이지 다 끝난 진행 표시가 아니다.
      markAgentBlueprintProgress("build_wall", { mapId: "m1", rect: { x: 10, y: 10, w: 4, h: 4 }, material: "흰 집 벅" }, { write: true });
      settleAgentBlueprintTurn({
        regions: [{ mapId: "m1", x: 0, y: 5, w: 20, h: 2 }, { mapId: "m1", x: 10, y: 10, w: 4, h: 4 }],
        wholeTargetMapIds: [],
      });

      graphicsCalls.length = 0;
      textCalls.length = 0;
      mockScene.add.container.mockClear();
      renderer.render();
      expect(graphicsCalls).toHaveLength(0);
      expect(textCalls).toHaveLength(0);
      expect(mockScene.add.container).not.toHaveBeenCalled();
      // 남아 있는 장버지는 파괴해서 걷는다 — 숨기기가 아니다.
      expect(mockLayer.removeAll).toHaveBeenCalledWith(true);
    });

    it("진행 중인 칸은 더 굵은 선으로 그려진다", () => {
      setAgentBlueprintFromSpec(spec());
      markAgentBlueprintProgress("build_wall", { mapId: "m1", rect: { x: 10, y: 10, w: 4, h: 4 }, material: "흰 집 벽" }, { write: true });
      const renderer = new AgentBlueprintRenderer(mockScene, mockLayer, () => "m1");
      renderer.render();
      const [roadStroke, houseStroke] = graphicsCalls.map((record) => record.strokes[0][0]);
      expect(houseStroke).toBeGreaterThan(roadStroke);
      expect(textCalls[1].alpha).toBe(blueprintStatusStyle("building").labelAlpha);
    });

    it("칸이 너무 많으면 라벨을 순번만으로 줄인다 — 없애지는 않는다", () => {
      // 2026-09-03 실측(e1-04): 41개부터 라벨이 전부 사라져 무엇이 어디에 몇 번째인지 알 길이 없었다.
      setAgentBlueprintFromSpec({
        mapId: "m1",
        assets: Array.from({ length: BLUEPRINT_MAX_LABELS + 1 }, (_unused, index) => ({
          id: `a${index}`,
          kind: "prop",
          x: index,
          y: 0,
          w: 1,
          h: 1,
        })),
      });
      const renderer = new AgentBlueprintRenderer(mockScene, mockLayer, () => "m1");
      renderer.render();
      expect(graphicsCalls).toHaveLength(BLUEPRINT_MAX_LABELS + 1);
      expect(textCalls).toHaveLength(BLUEPRINT_MAX_LABELS + 1);
      expect(textCalls[0].content).toBe("1");
    });

    it("add.text 가 없는 씬(가짜 씬)에서도 터지지 않는다", () => {
      setAgentBlueprintFromSpec(spec());
      const sceneWithoutText = { ...mockScene, add: { ...mockScene.add, text: undefined } };
      const renderer = new AgentBlueprintRenderer(sceneWithoutText as any, mockLayer, () => "m1");
      expect(() => renderer.render()).not.toThrow();
      expect(graphicsCalls).toHaveLength(2);
    });

    function spec(): BuildSpec {
      return {
        mapId: "m1",
        buildOrder: ["road", "house"],
        assets: [
          { id: "house_a", kind: "house", x: 10, y: 10, w: 4, h: 4 },
          { id: "road_a", kind: "road", x: 0, y: 5, w: 20, h: 2 },
        ],
      };
    }
  });
  function makeContainer(): any {
    const children: any[] = [];
    return {
      add: vi.fn((child: any) => {
        children.push(child);
        return child;
      }),
      // 인자를 기록한다 — destroyChild 를 무시하면 removeAll(true) 누락을 못 본다.
      removeAll: vi.fn((destroyChild?: boolean) => {
        for (const child of children) {
          if (destroyChild) child.destroy?.();
        }
        children.length = 0;
      }),
      setName: vi.fn(),
      setDepth: vi.fn(),
      destroy: vi.fn(),
      list: children,
    };
  }
});
