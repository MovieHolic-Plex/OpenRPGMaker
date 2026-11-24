import { describe, expect, it, afterEach, vi, beforeEach } from "vitest";
import { SVG_ICON_NAMES, type SvgIconName } from "@/editor/panels/tileToolbarIcons";
import { createBlankProject, TILE } from "@/project/defaults";
import { categorizeTileForContext, countAdjacentTileCategories, suggestRegionCommandsByContext } from "@/editor/regionTask/regionContextSuggestions";
import type { MapId, Project, RegionRect, GameMap } from "@/project/types";
import { groupRegionChanges } from "@/editor/regionTask/regionChangeGroups";
import { createRegionSelectionProjection } from "@/editor/regionTask/regionSelectionProjection";
import { clearActiveRegionSelection, notifyRegionSelectionChanged, regionPreviewProject, setActiveRegionSelection, subscribeRegionPreviewSelection } from "@/editor/regionTask/regionPreviewSelection";
import { oppositeRouteLabel, resolveInteriorIntent, resolveRegionRoute } from "@/editor/regionTask/regionRouteIntent";
import { formatRegionTileStatsCompact, summarizeRegionTiles } from "@/editor/regionTask/regionTileStats";
import { formatSelectionTerrain, selectionTerrain } from "@/editor/selectionTerrainSummary";
import { SELECTION_PLACE_PRESETS } from "@/editor/selectionActionChips";
import { CONTEXT_REGION_COMMANDS, SUGGESTED_REGION_COMMANDS, nextSuggestedRegionCommands, nextStartScreenSuggestedCommands, regionCommandCategories, __resetSuggestedRegionRotationForTest, __resetStartScreenSuggestedRotationForTest } from "@/editor/regionTask/suggestedCommands";
import { isolateTimers } from "./mergedTeardown";

// test/regionContextSuggestions.test.ts
// 인접 타일 기반 동적 추천 순수 함수 단위 테스트.
// 스펙 docs/superpowers/specs/2026-07-20-region-task-enhancements-design.md §E.
describe("regionContextSuggestions", () => {
  isolateTimers();
  function makeProject(): { project: Project; mapId: MapId } {
    const project = createBlankProject();
    return { project, mapId: project.startMapId };
  }
  function paintLower(project: Project, mapId: MapId, x: number, y: number, tile: number): void {
    const map = project.maps[mapId];
    map.lowerTiles[y * map.width + x] = tile;
  }
  describe("categorizeTileForContext", () => {
    it("물 카테고리 — TILE.WATER", () => {
      expect(categorizeTileForContext(TILE.WATER, undefined)).toBe("water");
    });
    it("길 카테고리 — TILE.PATH (흙길 계열)", () => {
      expect(categorizeTileForContext(TILE.PATH, undefined)).toBe("road");
    });
    it("숲 카테고리 — TILE.TREE", () => {
      expect(categorizeTileForContext(TILE.TREE, undefined)).toBe("forest");
    });
    it("건물 카테고리 — TILE.WALL", () => {
      expect(categorizeTileForContext(TILE.WALL, undefined)).toBe("building");
    });
    it("잔디는 other (명시적 카테고리 아님)", () => {
      expect(categorizeTileForContext(TILE.GRASS, undefined)).toBe("other");
    });
  });
  describe("countAdjacentTileCategories", () => {
    it("영역 바깥 1타일 두르레이트 수집 — 영역 내부는 제외", () => {
      const { project, mapId } = makeProject();
      // 영역 (5,5) 1×1. 주변 8셀 중 물 4셀 배치.
      paintLower(project, mapId, 4, 4, TILE.WATER);
      paintLower(project, mapId, 5, 4, TILE.WATER);
      paintLower(project, mapId, 6, 4, TILE.WATER);
      paintLower(project, mapId, 4, 5, TILE.WATER);
      const region: RegionRect = { x: 5, y: 5, width: 1, height: 1 };
      const map = project.maps[mapId];
      const counts = countAdjacentTileCategories(map, region, undefined);
      expect(counts.water).toBeGreaterThanOrEqual(4);
    });
  });
  describe("suggestRegionCommandsByContext", () => {
    it("물 인접 3+ → 부두/다리 추천 포함", () => {
      const { project, mapId } = makeProject();
      // 영역 (5,5) 3×3. 주변에 물 4셀.
      paintLower(project, mapId, 4, 4, TILE.WATER);
      paintLower(project, mapId, 5, 4, TILE.WATER);
      paintLower(project, mapId, 6, 4, TILE.WATER);
      paintLower(project, mapId, 4, 5, TILE.WATER);
      const region: RegionRect = { x: 5, y: 5, width: 3, height: 3 };
      const suggestions = suggestRegionCommandsByContext(project, mapId, region, 4);
      const ids = suggestions.map((s) => s.id);
      expect(ids).toContain("dock");
      expect(ids).toContain("bridge");
      expect(suggestions).toHaveLength(4);
    });

    it("길 인접 2+ → 가로수 추천 포함", () => {
      const { project, mapId } = makeProject();
      paintLower(project, mapId, 4, 5, TILE.PATH);
      paintLower(project, mapId, 4, 6, TILE.PATH);
      const region: RegionRect = { x: 5, y: 5, width: 3, height: 3 };
      const suggestions = suggestRegionCommandsByContext(project, mapId, region, 4);
      const ids = suggestions.map((s) => s.id);
      expect(ids).toContain("street-trees");
    });

    it("주변이 전부 잔디(other) → 정적 코퍼스 폴백", () => {
      const { project, mapId } = makeProject();
      const region: RegionRect = { x: 5, y: 5, width: 3, height: 3 };
      const suggestions = suggestRegionCommandsByContext(project, mapId, region, 4);
      // 정적 코퍼스의 처음 4개가 와야 함 (컨텍스트 신호 없음)
      expect(suggestions).toHaveLength(4);
      // 모두 SUGGESTED_REGION_COMMANDS의 id 여야 함 (dock/bridge 같은 동적 id 없음)
      const ids = suggestions.map((s) => s.id);
      expect(ids).not.toContain("dock");
      expect(ids).not.toContain("bridge");
    });

    it("작은 영역(2×2)은 거시 제안(여관/축제) 제외", () => {
      const { project, mapId } = makeProject();
      // 건물 인접 2셀
      paintLower(project, mapId, 4, 5, TILE.WALL);
      paintLower(project, mapId, 4, 6, TILE.WALL);
      const region: RegionRect = { x: 5, y: 5, width: 2, height: 2 };
      const suggestions = suggestRegionCommandsByContext(project, mapId, region, 4);
      const ids = suggestions.map((s) => s.id);
      expect(ids).not.toContain("inn-guests");
      expect(ids).not.toContain("festival");
    });

    it("큰 영역(15×15)은 거시 제안(여관/축제) 포함 가능", () => {
      const { project, mapId } = makeProject();
      // 큰 영역에 건물 인접 2셀
      paintLower(project, mapId, 0, 16, TILE.WALL);
      paintLower(project, mapId, 1, 16, TILE.WALL);
      const region: RegionRect = { x: 0, y: 0, width: 15, height: 15 };
      const suggestions = suggestRegionCommandsByContext(project, mapId, region, 4);
      const ids = suggestions.map((s) => s.id);
      expect(ids).toContain("inn-guests");
    });

    it("존재하지 않는 맵 → 정적 폴백", () => {
      const { project } = makeProject();
      const region: RegionRect = { x: 0, y: 0, width: 3, height: 3 };
      const suggestions = suggestRegionCommandsByContext(project, "no-such-map" as never, region, 4);
      expect(suggestions).toHaveLength(4);
    });

    it("항상 count 개 반환", () => {
      const { project, mapId } = makeProject();
      const region: RegionRect = { x: 0, y: 0, width: 3, height: 3 };
      expect(suggestRegionCommandsByContext(project, mapId, region, 4)).toHaveLength(4);
      expect(suggestRegionCommandsByContext(project, mapId, region, 3)).toHaveLength(3);
    });

    it("동적 추천 명령이 SvgIconName 아이콘을 가진다 (ICON MAPPING 준수)", () => {
      const EXPECTED_DYNAMIC_ICONS: Readonly<Record<string, SvgIconName>> = {
        dock: "structure",
        bridge: "structure",
        "street-trees": "polish",
        "hunting-ground": "combat",
        campfire: "mood",
      };
      const { project, mapId } = makeProject();
      // 영역 (5,5) 6×6. 물/길/숲/건물을 주변 두르레이트에 배치해 각각의 동적 추천을 유발.
      paintLower(project, mapId, 4, 4, TILE.WATER);
      paintLower(project, mapId, 5, 4, TILE.WATER);
      paintLower(project, mapId, 6, 4, TILE.WATER);
      paintLower(project, mapId, 4, 5, TILE.WATER);
      paintLower(project, mapId, 7, 4, TILE.PATH);
      paintLower(project, mapId, 8, 4, TILE.PATH);
      paintLower(project, mapId, 9, 4, TILE.TREE);
      paintLower(project, mapId, 10, 4, TILE.TREE);
      paintLower(project, mapId, 11, 4, TILE.TREE);
      paintLower(project, mapId, 11, 7, TILE.WALL);
      paintLower(project, mapId, 11, 8, TILE.WALL);
      const region: RegionRect = { x: 5, y: 5, width: 6, height: 6 };
      const suggestions = suggestRegionCommandsByContext(project, mapId, region, 10);
      const byId = new Map(suggestions.map((suggestion) => [suggestion.id, suggestion]));
      expect(byId.has("dock")).toBe(true);
      expect(byId.has("street-trees")).toBe(true);
      expect(byId.has("hunting-ground")).toBe(true);
      expect(byId.has("campfire")).toBe(true);
      for (const suggestion of suggestions) {
        expect(SVG_ICON_NAMES).toContain(suggestion.icon);
        if (EXPECTED_DYNAMIC_ICONS[suggestion.id]) {
          expect(suggestion.icon).toBe(EXPECTED_DYNAMIC_ICONS[suggestion.id]);
        }
      }
    });

    it("추천 명령 라벨에 이모지가 없다", () => {
      const { project, mapId } = makeProject();
      paintLower(project, mapId, 4, 4, TILE.WATER);
      paintLower(project, mapId, 5, 4, TILE.WATER);
      paintLower(project, mapId, 6, 4, TILE.WATER);
      paintLower(project, mapId, 4, 5, TILE.WATER);
      const region: RegionRect = { x: 5, y: 5, width: 3, height: 3 };
      const suggestions = suggestRegionCommandsByContext(project, mapId, region, 8);
      for (const suggestion of suggestions) {
        expect(suggestion.label).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    });

    it("던전 타일셋에서 야외 전용 명령(꽃밭/오두막/호수) 제외", () => {
      const { project, mapId } = makeProject();
      // 던전 타일셋으로 변경
      project.maps[mapId].tilesetId = "easyrpg_chipset_dungeon";
      const region: RegionRect = { x: 0, y: 0, width: 3, height: 3 };
      const suggestions = suggestRegionCommandsByContext(project, mapId, region, 4);
      const ids = suggestions.map((s) => s.id);
      expect(ids).not.toContain("flower-scatter"); // 야외 전용
      expect(ids).not.toContain("small-cottage");  // 야외 전용
      expect(ids).not.toContain("round-pond");     // 야외 전용
      // any 타일셋 명령(보물상자/보관상자/음산한 조명/몬스터 구역)은 포함 가능
      const anyCmdPresent = ids.some((id) =>
        ["treasure-chest", "storage-chest", "dark-mood", "encounter-zone"].includes(id));
      expect(anyCmdPresent).toBe(true);
    });

    it("실내 타일셋에서 야외 전용 명령 제외", () => {
      const { project, mapId } = makeProject();
      project.maps[mapId].tilesetId = "easyrpg_chipset_interior";
      const region: RegionRect = { x: 0, y: 0, width: 3, height: 3 };
      const suggestions = suggestRegionCommandsByContext(project, mapId, region, 4);
      const ids = suggestions.map((s) => s.id);
      expect(ids).not.toContain("flower-scatter");
      expect(ids).not.toContain("pasture-fence");
    });

    it("커스텀 타일셋(id 불명)은 outdoor로 간주 — 기존 동작 유지", () => {
      const { project, mapId } = makeProject();
      project.maps[mapId].tilesetId = "custom_tileset";
      const region: RegionRect = { x: 0, y: 0, width: 3, height: 3 };
      const suggestions = suggestRegionCommandsByContext(project, mapId, region, 4);
      // outdoor로 간주되므로 야외 명령이 포함될 수 있음
      expect(suggestions).toHaveLength(4);
    });
  });
});

// test/regionPreviewSelection.test.ts
// 캔버스 고스트가 청크 선택을 따라가는지 고정하는 회귀 테스트.
// 스펙 docs/superpowers/specs/2026-09-10-region-task-uiux-redesign-design.md §4.2.
//
// 회귀 배경: aiChatPanelHelpers/aiTurnRunner 는 검토 중 고스트를 언제나
// `pendingRegion.clippedProject`(=전체 결과)로 그렸다. 그동안 팝오버 체크박스는 일부를
// 빼고 있었으므로, 캔버스와 체크리스트가 서로 다른 것을 보여줬다.
describe("regionPreviewSelection", () => {
  isolateTimers();
  const REGION: RegionRect = { x: 0, y: 0, width: 4, height: 3 };
  function setup() {
    const base = createBlankProject();
    const mapId: MapId = base.startMapId;
    const clipped: Project = structuredClone(base);
    const map = clipped.maps[mapId]!;
    const put = (x: number, y: number, tile: number): void => {
      map.lowerTiles[(REGION.y + y) * map.width + (REGION.x + x)] = tile;
    };
    put(0, 0, TILE.WATER);
    put(1, 0, TILE.WATER);
    put(3, 2, TILE.WATER); // 떨어진 두 번째 청크

    const groups = groupRegionChanges(base, clipped, mapId, REGION);
    const projection = createRegionSelectionProjection({ base, clipped, mapId, region: REGION, groups });
    return { base, clipped, mapId, groups, projection };
  }
  afterEach(() => {
    clearActiveRegionSelection();
  });
  describe("regionPreviewProject", () => {
    it("활성 투영이 없으면 pending 의 전체 결과를 그대로 쓴다", () => {
      const { base, clipped } = setup();

      expect(regionPreviewProject({ baseProject: base, clippedProject: clipped })).toBe(clipped);
    });

    it("활성 투영이 있으면 그 투영의 합성 결과를 쓴다", () => {
      const { base, clipped, projection } = setup();
      setActiveRegionSelection(projection);

      expect(regionPreviewProject({ baseProject: base, clippedProject: clipped }))
        .toBe(projection.project());
    });

    it("청크를 빼면 미리보기 결과에서 그 칸이 원본으로 돌아온다", () => {
      const { base, clipped, mapId, groups, projection } = setup();
      setActiveRegionSelection(projection);

      const dropped = groups.lower[0]!;
      projection.toggle(dropped.id);

      const preview = regionPreviewProject({ baseProject: base, clippedProject: clipped });
      const previewTiles = preview.maps[mapId]!.lowerTiles;
      const baseTiles = base.maps[mapId]!.lowerTiles;
      for (const cell of dropped.cells) {
        const index = (REGION.y + cell.y) * preview.maps[mapId]!.width + (REGION.x + cell.x);
        expect(previewTiles[index]).toBe(baseTiles[index]);
      }
      // 전체 결과와는 달라야 한다 — 그래야 캔버스가 체크리스트와 같은 말을 한다.
      expect(previewTiles).not.toEqual(clipped.maps[mapId]!.lowerTiles);
    });

    it("치우면 다시 전체 결과로 돌아간다", () => {
      const { base, clipped, projection } = setup();
      setActiveRegionSelection(projection);
      clearActiveRegionSelection();

      expect(regionPreviewProject({ baseProject: base, clippedProject: clipped })).toBe(clipped);
    });
  });
  describe("subscribeRegionPreviewSelection", () => {
    it("선택 변경 알림이 구독자에게 간다", () => {
      const { projection } = setup();
      const listener = vi.fn();
      const unsubscribe = subscribeRegionPreviewSelection(listener);

      setActiveRegionSelection(projection);
      expect(listener).toHaveBeenCalledTimes(1);

      notifyRegionSelectionChanged();
      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();
      notifyRegionSelectionChanged();
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("치울 때도 알림이 간다 — 고스트를 전체 결과로 되돌려 그려야 하므로", () => {
      const { projection } = setup();
      setActiveRegionSelection(projection);
      const listener = vi.fn();
      subscribeRegionPreviewSelection(listener);

      clearActiveRegionSelection();
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});

// test/regionRouteIntent.test.ts
// 문장 → 실행 경로 라우팅 계약. 스펙 §5.1.
// 이 라우터가 모드 스위치를 대체하므로, "무엇이 어디로 가는가" 는 테스트로 고정한다.
describe("regionRouteIntent", () => {
  isolateTimers();
  describe("resolveRegionRoute", () => {
    it("빈 입력은 다듬기 — 버튼 하나가 「다듬기」와 「실행」을 겸한다", () => {
      expect(resolveRegionRoute("").kind).toBe("polish");
      expect(resolveRegionRoute("   ").kind).toBe("polish");
    });

    it("다듬기 어휘는 그대로 다듬기로 간다", () => {
      expect(resolveRegionRoute("주변과 어울리게 해줘").kind).toBe("polish");
    });

    it("생성기 키워드는 생성기로 — AI 를 부르지 않는다", () => {
      const route = resolveRegionRoute("울창한 숲에 오솔길 하나");
      expect(route.kind).toBe("operator");
      if (route.kind !== "operator") return;
      expect(route.operatorId).toBe("forest");
      // 문장의 "울창"·"오솔길" 이 파라미터로 옮겨져야 한다(그냥 기본값이면 문장이 버려진 것).
      expect(route.params.density).toBeGreaterThan(0.8);
      expect(route.params.path).toBe(true);
      expect(route.note).toBeTruthy();
    });

    it("집이 주인공인 문장은 마을 생성기", () => {
      const route = resolveRegionRoute("집 다섯 채가 광장을 둘러싼 마을");
      expect(route.kind).toBe("operator");
      if (route.kind !== "operator") return;
      expect(route.operatorId).toBe("village");
      expect(route.params.houses).toBe(5);
      expect(route.params.layout).toBe("plaza");
    });

    it("실내 낱말이 있으면 실내 초안으로 — 생성기보다 먼저 본다", () => {
      const route = resolveRegionRoute("여관 실내를 방으로 나눠줘");
      expect(route.kind).toBe("interior");
      if (route.kind !== "interior") return;
      expect(route.presetId).toBe("inn");
    });

    it("「여관이 있는 마을」은 실내가 아니다 — 안/속을 말해야 실내다", () => {
      const route = resolveRegionRoute("여관이 있는 마을");
      expect(route.kind).toBe("operator");
      if (route.kind !== "operator") return;
      expect(route.operatorId).toBe("village");
    });

    it("키워드로 확실하지 않으면 조수에게 넘긴다 — 추측하지 않는다", () => {
      const route = resolveRegionRoute("여기에 뭔가 재미있는 걸 놔줘");
      expect(route.kind).toBe("assistant");
    });

    it("모든 경로가 왜 그리 갔는지를 말한다 — 오라우팅을 사용자가 읽을 수 있어야 한다", () => {
      for (const text of ["", "주변과 어울리게", "울창한 숲", "실내 방 배치", "알 수 없는 소원"]) {
        expect(resolveRegionRoute(text).why).toBeTruthy();
      }
    });
  });
  describe("resolveInteriorIntent", () => {
    it("실내 신호가 없으면 null", () => {
      expect(resolveInteriorIntent("숲으로 채워줘")).toBeNull();
    });

    it("프리셋 낱말이 없으면 중립값(주거)으로 두고 무엇으로 읽었는지 남긴다", () => {
      const intent = resolveInteriorIntent("실내로 만들어줘");
      expect(intent).not.toBeNull();
      expect(intent!.presetId).toBe("home");
      expect(intent!.modifier).toBe("");
      expect(intent!.note).toContain("주거");
    });

    it("분위기 낱말을 겹쳐 읽는다", () => {
      const intent = resolveInteriorIntent("호화로운 대저택 내부");
      expect(intent!.presetId).toBe("manor");
      expect(intent!.modifier).toBe("luxury");
      expect(intent!.note).toContain("luxury");
    });
  });
  describe("oppositeRouteLabel", () => {
    it("조수로 갔으면 생성기로, 아니면 AI 로 되돌린다", () => {
      expect(oppositeRouteLabel("assistant")).toBe("생성기로 다시");
      expect(oppositeRouteLabel("operator")).toBe("AI로 다시");
      expect(oppositeRouteLabel("interior")).toBe("AI로 다시");
      expect(oppositeRouteLabel("polish")).toBe("AI로 다시");
    });
  });
});

// test/regionTileStats.test.ts
// 영역 타일 분포 요약 순수 함수 단위 테스트.
// 스펙 docs/superpowers/specs/2026-07-20-region-task-enhancements-design.md §F.
describe("regionTileStats", () => {
  isolateTimers();
  function makeProject(): { project: Project; mapId: MapId } {
    const project = createBlankProject();
    return { project, mapId: project.startMapId };
  }
  function paintLower(project: Project, mapId: MapId, region: RegionRect, tiles: number[]): void {
    const map = project.maps[mapId];
    for (let r = 0; r < region.height; r += 1) {
      for (let c = 0; c < region.width; c += 1) {
        const idx = (region.y + r) * map.width + (region.x + c);
        map.lowerTiles[idx] = tiles[r * region.width + c] ?? TILE.EMPTY;
      }
    }
  }
  describe("summarizeRegionTiles", () => {
    it("단일 잔디 영역 — top 에 잔디 1개", () => {
      const { project, mapId } = makeProject();
      const region = { x: 0, y: 0, width: 3, height: 3 };
      paintLower(project, mapId, region, Array(9).fill(TILE.GRASS));
      const stats = summarizeRegionTiles(project.maps[mapId], region);
      expect(stats.totalCells).toBe(9);
      expect(stats.emptyCells).toBe(0);
      expect(stats.top).toHaveLength(1);
      expect(stats.top[0].count).toBe(9);
    });

    it("혼합 타일 — top 3 빈도순 정렬", () => {
      const { project, mapId } = makeProject();
      const region = { x: 0, y: 0, width: 3, height: 1 };
      paintLower(project, mapId, region, [TILE.GRASS, TILE.WATER, TILE.GRASS]);
      const stats = summarizeRegionTiles(project.maps[mapId], region);
      expect(stats.top.length).toBeGreaterThanOrEqual(2);
      // 잔디 2개가 물 1개보다 많으므로 잔디가 top[0]
      expect(stats.top[0].count).toBeGreaterThanOrEqual(2);
    });

    it("빈 셀(EMPTY) 카운트", () => {
      const { project, mapId } = makeProject();
      const region = { x: 0, y: 0, width: 2, height: 1 };
      paintLower(project, mapId, region, [TILE.EMPTY, TILE.GRASS]);
      const stats = summarizeRegionTiles(project.maps[mapId], region);
      expect(stats.emptyCells).toBe(1);
      expect(stats.totalCells).toBe(2);
    });

    it("영역 밖 좌표는 무시", () => {
      const { project, mapId } = makeProject();
      const map = project.maps[mapId];
      // 영역이 맵 밖으로 나감 — 정상 범위 내 셀만 계산
      const region = { x: map.width - 1, y: map.height - 1, width: 3, height: 3 };
      const stats = summarizeRegionTiles(map, region);
      expect(stats.totalCells).toBe(9); // regionArea는 그대로
      // 실제 맵 안 셀은 1개뿐 — emptyCells 가 9 - 1 = 8 보다 작거나 같아야
      expect(stats.emptyCells).toBeLessThanOrEqual(9);
    });
  });
  describe("formatRegionTileStatsCompact", () => {
    it("컴팩트 문자열 — 라벨+개수를 · 로 결합", () => {
      const { project, mapId } = makeProject();
      const region = { x: 0, y: 0, width: 3, height: 1 };
      paintLower(project, mapId, region, [TILE.GRASS, TILE.WATER, TILE.GRASS]);
      const stats = summarizeRegionTiles(project.maps[mapId], region);
      const compact = formatRegionTileStatsCompact(stats);
      expect(compact).toMatch(/·/);
      // 잔디 2가 포함돼야
      expect(compact).toMatch(/2/);
    });

    it("빈 통계면 빈 문자열", () => {
      const stats = { top: [], totalCells: 0, emptyCells: 0 };
      expect(formatRegionTileStatsCompact(stats)).toBe("");
    });
  });
});

describe("selectionTerrainSummary", () => {
  isolateTimers();
  function plateau(): GameMap {
    const width = 10, height = 8, n = width * height;
    const levels = new Array<number>(n).fill(0), ramps = new Array<number>(n).fill(0), waterDepth = new Array<number>(n).fill(0);
    for (let y = 2; y < 6; y++) for (let x = 2; x < 7; x++) levels[y * width + x] = 2;
    ramps[6 * width + 4] = 1;
    waterDepth[7 * width + 0] = 1;
    return { id: "m", name: "m", width, height, tileSize: 16, tilesetId: "t", lowerTiles: new Array(n).fill(0), upperTiles: new Array(n).fill(-1), events: [],
      relief: { width, height, levels, ramps }, terrainDesign: { waterDepth, lockedCells: [2 * width + 2] } };
  }
  describe("선택 지형 꼬리말", () => {
    it("사각형 안의 높이 분포·경사로·물·잠금을 센다", () => {
      const t = selectionTerrain(plateau(), { x: 0, y: 2, width: 6, height: 6 });
      expect(Object.fromEntries(t.levels)).toEqual({ 0: 20, 2: 16 });
      expect([t.ramps, t.water, t.locked]).toEqual([1, 1, 1]);
      expect(formatSelectionTerrain(plateau(), { x: 0, y: 2, width: 6, height: 6 })).toContain("높이·경사로·물은 바꾸지 말 것");
    });

    it("「마을」「숲」 칩 문장은 기존 생성기 경로로 간다", () => {
      const byId = Object.fromEntries(SELECTION_PLACE_PRESETS.map((p) => [p.id, p.instruction!]));
      expect(resolveRegionRoute(byId.village!).kind).toBe("operator");
      expect(resolveRegionRoute(byId.forest!).kind).toBe("operator");
    });
  });
});

describe("suggestedCommands", () => {
  isolateTimers();
  /** 로테이션 기대값 — start 부터 count 개를 코퍼스 길이로 감아 집는다. */
  const idsFrom = (start: number, count: number): string[] =>
    Array.from(
      { length: count },
      (_, index) => SUGGESTED_REGION_COMMANDS[(start + index) % SUGGESTED_REGION_COMMANDS.length].id,
    );
  describe("suggestedCommands", () => {
    beforeEach(() => {
      __resetSuggestedRegionRotationForTest();
      __resetStartScreenSuggestedRotationForTest();
    });

    // 개수를 상수로 못박지 않는다: 명령이 하나 늘 때마다 무관한 테스트 3개가 빨개졌다(실측:
    // 13번째 명령이 들어온 뒤 이 파일의 로테이션 테스트가 기준선에서 이미 실패 상태였다).
    // 고정할 불변식은 "중복 id 없음 · 빈 지시문 없음 · 카테고리별로 고를 수 있을 만큼 있음" 이다.
    it("코퍼스 상수 — id 중복 없음, instruction 비어있지 않음", () => {
      expect(SUGGESTED_REGION_COMMANDS.length).toBeGreaterThanOrEqual(12);
      expect(new Set(SUGGESTED_REGION_COMMANDS.map((command) => command.id)).size)
        .toBe(SUGGESTED_REGION_COMMANDS.length);
      for (const command of SUGGESTED_REGION_COMMANDS) expect(command.instruction.length).toBeGreaterThan(5);
    });

    it("카테고리를 고르면 칩이 최소 2개 남는다 (빈 줄 방지)", () => {
      for (const category of regionCommandCategories()) {
        expect(category.commands.length, `${category.label} 카테고리`).toBeGreaterThanOrEqual(2);
      }
    });

    it("문맥 전용 명령도 카테고리 칩으로 볼 수 있다", () => {
      const all = regionCommandCategories().flatMap((category) => category.commands.map((command) => command.id));
      // 예전에는 regionContextSuggestions 안의 리터럴이라 주변 타일이 맞지 않으면 영영 안 보였다.
      for (const id of CONTEXT_REGION_COMMANDS.map((command) => command.id)) expect(all).toContain(id);
    });

    it("모든 명령이 SvgIconName 아이콘을 가진다 (ICON MAPPING 준수)", () => {
      const EXPECTED_COMMAND_ICONS: Readonly<Record<string, SvgIconName>> = {
        "round-pond": "terrain",
        "small-cottage": "structure",
        "flower-scatter": "polish",
        "treasure-chest": "chest",
        "storage-chest": "chest",
        "merchant-npc": "shop",
        "pasture-fence": "structure",
        garden: "polish",
        "gate-guards": "npc",
        "inn-guests": "structure",
        festival: "composite",
        "dark-mood": "mood",
        "encounter-zone": "combat",
        "conifer-forest": "terrain",
        "dirt-path": "terrain",
        "scatter-rocks": "polish",
        "lantern-mood": "mood",
        "blend-surroundings": "polish",
      };
      for (const command of SUGGESTED_REGION_COMMANDS) {
        expect(SVG_ICON_NAMES).toContain(command.icon);
        expect(command.icon).toBe(EXPECTED_COMMAND_ICONS[command.id]);
      }
    });

    it("카테고리 아이콘이 SvgIconName 이다 (ICON MAPPING 준수)", () => {
      const EXPECTED_CATEGORY_ICONS: Readonly<Record<string, SvgIconName>> = {
        tiles: "terrain",
        structures: "structure",
        polish: "polish",
        npc: "npc",
        interaction: "chest",
        combat: "combat",
        mood: "mood",
        composite: "composite",
      };
      const categories = regionCommandCategories();
      expect(categories.length).toBeGreaterThan(0);
      for (const category of categories) {
        expect(SVG_ICON_NAMES).toContain(category.icon);
        if (EXPECTED_CATEGORY_ICONS[category.id]) {
          expect(category.icon).toBe(EXPECTED_CATEGORY_ICONS[category.id]);
        }
      }
    });

    it("모든 명령·카테고리 라벨에 이모지가 없다", () => {
      const labels = [
        ...SUGGESTED_REGION_COMMANDS.map((command) => command.label),
        ...SUGGESTED_REGION_COMMANDS.map((command) => command.instruction),
        ...regionCommandCategories().map((category) => category.label),
      ];
      for (const label of labels) expect(label).not.toMatch(/\p{Extended_Pictographic}/u);
    });

    it("호출마다 로테이션 — 이어서 집고, 끝에서 처음으로 돌아온다", () => {
      const total = SUGGESTED_REGION_COMMANDS.length;
      // 코퍼스 길이가 4의 배수가 아니어도 성립하는 형태로 고정한다(모듈러 인덱싱).
      for (let call = 0; call < 6; call += 1) {
        const picked = nextSuggestedRegionCommands(4).map((command) => command.id);
        expect(picked, `${call + 1}번째 호출`).toEqual(idsFrom((call * 4) % total, 4));
      }
    });

    it("시작 화면 카드와 모달은 독립된 로테이션 카운터를 쓴다", () => {
      // 시작 화면 카드를 여러 번 소모해도 모달 쪽 카운터(rotation)는 전혀 영향받지 않는다.
      nextStartScreenSuggestedCommands(3);
      nextStartScreenSuggestedCommands(3);
      nextStartScreenSuggestedCommands(3);
      const modalFirst = nextSuggestedRegionCommands(4);
      expect(modalFirst.map((command) => command.id)).toEqual(SUGGESTED_REGION_COMMANDS.slice(0, 4).map((command) => command.id));
    });

    it("시작 화면 로테이션 자체도 순서대로 돌고 랩어라운드한다", () => {
      const total = SUGGESTED_REGION_COMMANDS.length;
      for (let call = 0; call < 7; call += 1) {
        const picked = nextStartScreenSuggestedCommands(3).map((command) => command.id);
        expect(picked, `${call + 1}번째 호출`).toEqual(idsFrom((call * 3) % total, 3));
      }
    });
  });
});
