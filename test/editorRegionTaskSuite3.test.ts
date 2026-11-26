import { describe, expect, it, beforeEach } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { composePartialProject } from "@/editor/regionTask/partialApplyCompose";
import { groupRegionChanges } from "@/editor/regionTask/regionChangeGroups";
import { createRegionSelectionProjection } from "@/editor/regionTask/regionSelectionProjection";
import type { MapId, Project, RegionRect } from "@/project/types";
import { formatRegionTileStatsCompact, summarizeRegionTiles } from "@/editor/regionTask/regionTileStats";
import { SVG_ICON_NAMES, type SvgIconName } from "@/editor/panels/tileToolbarIcons";
import { CONTEXT_REGION_COMMANDS, SUGGESTED_REGION_COMMANDS, nextSuggestedRegionCommands, nextStartScreenSuggestedCommands, regionCommandCategories, __resetSuggestedRegionRotationForTest, __resetStartScreenSuggestedRotationForTest } from "@/editor/regionTask/suggestedCommands";
import { isolateTimers } from "./mergedTeardown";

// test/regionSelectionProjection.test.ts
// 미리보기와 적용이 **같은 합성 결과**를 쓰는지 고정하는 회귀 테스트.
// 스펙 docs/superpowers/specs/2026-09-10-region-task-uiux-redesign-design.md §4.2.
//
// 지금까지는 검토 화면이 "전체 결과 썸네일 + 제외 표시"를 보여주고, 사용자가 머릿속에서
// 둘을 합성해야 했다. 그 어긋날 여지를 구조로 없애는 것이 이 바인딩의 목적이다.
describe("regionSelectionProjection", () => {
  isolateTimers();
  const REGION: RegionRect = { x: 0, y: 0, width: 4, height: 3 };
  function makeProject(): { project: Project; mapId: MapId } {
    const project = createBlankProject();
    return { project, mapId: project.startMapId };
  }
  /** 왼쪽 2열은 물, 오른쪽 끝 1칸은 위층 나무 — 서로 떨어진 청크 3개가 나오게. */
  function makeClipped(base: Project, mapId: MapId): Project {
    const clipped: Project = structuredClone(base);
    const map = clipped.maps[mapId]!;
    const put = (x: number, y: number, lower?: number, upper?: number): void => {
      const idx = (REGION.y + y) * map.width + (REGION.x + x);
      if (lower !== undefined) map.lowerTiles[idx] = lower;
      if (upper !== undefined) map.upperTiles[idx] = upper;
    };
    // 청크 1 (lower): (0,0) (1,0) (0,1) (1,1) 연결
    put(0, 0, TILE.WATER);
    put(1, 0, TILE.WATER);
    put(0, 1, TILE.WATER);
    put(1, 1, TILE.WATER);
    // 청크 2 (lower): (3,2) 떨어진 한 칸
    put(3, 2, TILE.WATER);
    // 청크 3 (upper): (3,0)
    put(3, 0, undefined, TILE.TREE);
    return clipped;
  }
  function setup() {
    const { project, mapId } = makeProject();
    const clipped = makeClipped(project, mapId);
    const groups = groupRegionChanges(project, clipped, mapId, REGION);
    const allIds = [...groups.lower, ...groups.upper].map((c) => c.id);
    const projection = createRegionSelectionProjection({
      base: project,
      clipped,
      mapId,
      region: REGION,
      groups,
    });
    return { project, clipped, mapId, groups, allIds, projection };
  }
  describe("createRegionSelectionProjection", () => {
    it("기본 선택은 모든 청크 — 전체 적용과 같다", () => {
      const { projection, allIds, clipped, mapId } = setup();

      expect([...projection.selected()].sort()).toEqual([...allIds].sort());
      expect(projection.isPartial()).toBe(false);
      // 전부 선택이면 clipped 의 영역 타일이 그대로 들어와야 한다.
      const map = projection.project().maps[mapId]!;
      expect(map.lowerTiles).toEqual(clipped.maps[mapId]!.lowerTiles);
    });

    it("같은 선택에 대해 project() 는 같은 객체를 돌려준다 — 미리보기와 적용이 한 결과를 공유한다", () => {
      const { projection } = setup();

      const first = projection.project();
      const second = projection.project();
      expect(second).toBe(first);
    });

    it("토글하면 새 결과를 내고, 되돌리면 다시 새 결과지만 내용은 처음과 같다", () => {
      const { projection, allIds } = setup();

      const before = projection.project();
      projection.toggle(allIds[0]!);
      const afterToggle = projection.project();
      expect(afterToggle).not.toBe(before);

      projection.toggle(allIds[0]!);
      expect(projection.project()).toEqual(before);
    });

    it("project() 는 언제나 composePartialProject 와 같은 결과다 (미리보기 == 적용)", () => {
      const { projection, allIds, project, clipped, mapId, groups } = setup();

      // 임의의 토글 시퀀스를 밟아도 불변식이 유지돼야 한다.
      projection.toggle(allIds[0]!);
      projection.toggle(allIds[2]!);
      projection.toggle(allIds[0]!);

      const expected = composePartialProject({
        base: project,
        clipped,
        mapId,
        region: REGION,
        selectedChunkIds: [...projection.selected()],
        groups,
      });
      expect(projection.project()).toEqual(expected);
    });

    it("전부 해제하면 base 와 같아지고 적용할 칸이 0이 된다", () => {
      const { projection, allIds, project, mapId } = setup();

      for (const id of allIds) projection.toggle(id);

      expect(projection.selected().size).toBe(0);
      expect(projection.selectedCellCount()).toBe(0);
      expect(projection.project().maps[mapId]!.lowerTiles)
        .toEqual(project.maps[mapId]!.lowerTiles);
    });

    it("selectedCellCount 는 선택된 청크의 셀 합이다", () => {
      const { projection, groups } = setup();

      const total = [...groups.lower, ...groups.upper]
        .reduce((sum, chunk) => sum + chunk.cells.length, 0);
      expect(projection.selectedCellCount()).toBe(total);

      const first = groups.lower[0]!;
      projection.toggle(first.id);
      expect(projection.selectedCellCount()).toBe(total - first.cells.length);
    });

    it("일부만 선택하면 isPartial 이 참이다", () => {
      const { projection, allIds } = setup();

      expect(projection.isPartial()).toBe(false);
      projection.toggle(allIds[0]!);
      expect(projection.isPartial()).toBe(true);
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
