import { describe, expect, it } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { describeChunkPosition, groupRegionChanges, labelRegionChunk, withChunkLabels, type RegionChunk } from "@/editor/regionTask/regionChangeGroups";
import type { MapId, Project, RegionRect, TilesetDef, GameEvent, GameMap } from "@/project/types";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { SVG_ICON_NAMES, type SvgIconName } from "@/editor/panels/tileToolbarIcons";
import { regionEventChangeLabel, summarizeOutsideRegionChanges, summarizeRegionEventChanges } from "@/editor/regionTask/regionChangeSummary";
import { isolateTimers } from "./mergedTeardown";
import { categorizeTileForContext, countAdjacentTileCategories, suggestRegionCommandsByContext } from "@/editor/regionTask/regionContextSuggestions";
import { oppositeRouteLabel, resolveInteriorIntent, resolveRegionRoute } from "@/editor/regionTask/regionRouteIntent";
import { formatSelectionTerrain, selectionTerrain } from "@/editor/selectionTerrainSummary";
import { SELECTION_PLACE_PRESETS } from "@/editor/selectionActionChips";

describe("regionChange", () => {
  isolateTimers();
  // test/regionChangeGroups.test.ts
  // 영역 변경 4-연결성 청크 그룹화 + 라벨링 순수 함수 단위 테스트.
  // 스펙 docs/superpowers/specs/2026-07-20-region-task-enhancements-design.md §A.
  describe("regionChangeGroups", () => {
    isolateTimers();
    function makeProject(): { project: Project; mapId: MapId } {
      // TILE.GRASS/WATER 는 합본 마을 칩 번호다 — 2026-10-07 저작권 정리 뒤 시작 맵이 버들항이라 옛 저장본처럼 잔디 바닥 합본 마을에서 시작한다.
      const project = startOnRetiredCombinedTown(createBlankProject());
      return { project, mapId: project.startMapId };
    }
    /** base 를 깊은 복사한 뒤 영역 안 lower/upper 를 채운 clipped 프로젝트 만들기. */
    function makeClippedWithTiles(
      base: Project,
      mapId: MapId,
      region: RegionRect,
      lowerTiles: number[],
      upperTiles: number[] = [],
    ): Project {
      const clipped: Project = structuredClone(base);
      const map = clipped.maps[mapId];
      for (let r = 0; r < region.height; r += 1) {
        for (let c = 0; c < region.width; c += 1) {
          const idx = (region.y + r) * map.width + (region.x + c);
          const src = r * region.width + c;
          map.lowerTiles[idx] = lowerTiles[src] ?? TILE.EMPTY;
          map.upperTiles[idx] = upperTiles[src] ?? TILE.EMPTY;
        }
      }
      return clipped;
    }
    describe("groupRegionChanges", () => {
      it("변경 없으면 lower/upper 모두 빈 배열", () => {
        const { project, mapId } = makeProject();
        const region = { x: 0, y: 0, width: 3, height: 3 };
        const clipped = structuredClone(project);
        const groups = groupRegionChanges(project, clipped, mapId, region);
        expect(groups.lower).toHaveLength(0);
        expect(groups.upper).toHaveLength(0);
        expect(groups.unchangedCells).toBe(9);
      });

      it("연속된 lower 변경 셀을 1개 청크로 묶는다 (4-연결성)", () => {
        const { project, mapId } = makeProject();
        const region = { x: 0, y: 0, width: 3, height: 3 };
        // 가운데(1,1)만 변경 안 함 → 8셀이 4-연결성으로 1개 청크(가운데 구멍은 분리 안 시킴)
        const clipped = makeClippedWithTiles(
          project, mapId, region,
          [
            TILE.WATER, TILE.WATER, TILE.WATER,
            TILE.WATER, TILE.GRASS, TILE.WATER, // (1,1)은 base==clipped (잔디 그대로)
            TILE.WATER, TILE.WATER, TILE.WATER,
          ],
        );
        const groups = groupRegionChanges(project, clipped, mapId, region);
        expect(groups.lower).toHaveLength(1);
        expect(groups.lower[0].cells).toHaveLength(8);
        expect(groups.lower[0].layer).toBe("lower");
        expect(groups.lower[0].dominantTile).toBe(TILE.WATER);
      });

      it("분리된 두 영역은 2개 청크로 분리", () => {
        const { project, mapId } = makeProject();
        const region = { x: 0, y: 0, width: 5, height: 1 };
        // (0,0)(1,0) 변경, (2,0) 변경 없음, (3,0)(4,0) 변경 → 2개 청크
        const clipped = makeClippedWithTiles(
          project, mapId, region,
          [TILE.WATER, TILE.WATER, TILE.GRASS, TILE.WATER, TILE.WATER],
        );
        const groups = groupRegionChanges(project, clipped, mapId, region);
        expect(groups.lower).toHaveLength(2);
        expect(groups.lower[0].cells).toHaveLength(2);
        expect(groups.lower[1].cells).toHaveLength(2);
      });

      it("lower 와 upper 는 독립적으로 그룹화", () => {
        const { project, mapId } = makeProject();
        const region = { x: 0, y: 0, width: 2, height: 1 };
        const clipped = makeClippedWithTiles(
          project, mapId, region,
          [TILE.WATER, TILE.GRASS], // lower: 1셀만 변경
          [TILE.TREE, TILE.TREE],   // upper: 2셀 모두 변경
        );
        const groups = groupRegionChanges(project, clipped, mapId, region);
        expect(groups.lower).toHaveLength(1);
        expect(groups.lower[0].cells).toHaveLength(1);
        expect(groups.upper).toHaveLength(1);
        expect(groups.upper[0].cells).toHaveLength(2);
      });

      it("존재하지 않는 맵 id면 빈 결과", () => {
        const { project } = makeProject();
        const region = { x: 0, y: 0, width: 1, height: 1 };
        const clipped = structuredClone(project);
        const groups = groupRegionChanges(project, clipped, "no-such-map" as never, region);
        expect(groups.lower).toHaveLength(0);
        expect(groups.upper).toHaveLength(0);
        expect(groups.unchangedCells).toBe(0);
      });

      it("대각선 인접은 4-연결성에서 분리 (두 청크)", () => {
        const { project, mapId } = makeProject();
        const region = { x: 0, y: 0, width: 2, height: 2 };
        // (0,0)과 (1,1)만 변경, (1,0)(0,1)은 변경 없음 → 대각선이라 4-연결성은 분리
        const clipped = makeClippedWithTiles(
          project, mapId, region,
          [
            TILE.WATER, TILE.GRASS,
            TILE.GRASS, TILE.WATER,
          ],
        );
        const groups = groupRegionChanges(project, clipped, mapId, region);
        expect(groups.lower).toHaveLength(2);
        expect(groups.lower[0].cells).toHaveLength(1);
        expect(groups.lower[1].cells).toHaveLength(1);
      });
    });
    describe("labelRegionChunk", () => {
      it("대표 타일 라벨 + 셀 수", () => {
        const chunk: RegionChunk = {
          id: "test", layer: "lower", cells: [
            { x: 0, y: 0, index: 0 },
            { x: 1, y: 0, index: 1 },
            { x: 2, y: 0, index: 2 },
          ],
          dominantTile: TILE.GRASS, label: "",
        };
        const label = labelRegionChunk(chunk, undefined);
        // describeChipsetTile 가 잔디를 "잔디"로 라벨링하든 폴백 "타일 240" 이든 셀 수는 붙음
        expect(label).toMatch(/\(3칸\)$/);
      });

      it("빈 라벨이면 타일 N 폴백", () => {
        const chunk: RegionChunk = {
          id: "test", layer: "lower",
          cells: [{ x: 0, y: 0, index: 0 }],
          dominantTile: 99999, // 존재하지 않는 타일
          label: "",
        };
        const label = labelRegionChunk(chunk, undefined);
        expect(label).toContain("99999");
        expect(label).toMatch(/\(1칸\)$/);
      });
    });
    describe("withChunkLabels", () => {
      it("모든 청크의 label 을 채운다", () => {
        const { project, mapId } = makeProject();
        const region = { x: 0, y: 0, width: 2, height: 1 };
        const clipped = makeClippedWithTiles(
          project, mapId, region,
          [TILE.WATER, TILE.WATER],
        );
        const groups = groupRegionChanges(project, clipped, mapId, region);
        const labeled = withChunkLabels(groups, undefined as unknown as TilesetDef);
        expect(labeled.lower[0].label).toMatch(/\(2칸\)$/);
        expect(labeled.lower[0].label.length).toBeGreaterThan(0);
      });
    });
    describe("describeChunkPosition", () => {
      // 같은 타일로 된 덩어리가 여럿이면 라벨이 완전히 겹친다("Stone floor(3칸)" 두 줄) —
      // 목록만 보고 구분할 수 있도록 영역 안 위치를 사람 말로 돌려준다.
      const chunkAt = (cells: readonly [number, number][]): RegionChunk => ({
        id: "c",
        layer: "lower",
        cells: cells.map(([x, y]) => ({ x, y, index: 0 })),
        dominantTile: TILE.WATER,
        label: "",
      });
      const REGION = { x: 2, y: 2, width: 9, height: 9 };

      it("영역을 3×3 구획으로 나눠 무게중심이 놓인 칸의 이름을 준다", () => {
        expect(describeChunkPosition(chunkAt([[0, 0]]), REGION)).toBe("좌상단");
        expect(describeChunkPosition(chunkAt([[8, 8]]), REGION)).toBe("우하단");
        expect(describeChunkPosition(chunkAt([[4, 4]]), REGION)).toBe("가운데");
        expect(describeChunkPosition(chunkAt([[8, 0]]), REGION)).toBe("우상단");
        expect(describeChunkPosition(chunkAt([[0, 8]]), REGION)).toBe("좌하단");
      });

      it("여러 칸이면 무게중심으로 판정한다", () => {
        // (0,0),(1,0),(0,1) → 무게중심 (0.33,0.33) → 좌상단
        expect(describeChunkPosition(chunkAt([[0, 0], [1, 0], [0, 1]]), REGION)).toBe("좌상단");
      });

      it("빈 청크나 폭 0 영역에서도 던지지 않는다", () => {
        expect(describeChunkPosition(chunkAt([]), REGION)).toBe("");
        expect(describeChunkPosition(chunkAt([[0, 0]]), { x: 0, y: 0, width: 0, height: 0 })).toBe("가운데");
      });
    });
  });
  // test/regionChangeSummary.test.ts
  // 영역 작업 제안의 "타일이 아닌 변경" 요약 — 이벤트 목록 + 영역 밖 변경 경고.
  describe("regionChangeSummary", () => {
    isolateTimers();
    const REGION: RegionRect = { x: 4, y: 4, width: 6, height: 6 };
    function makeProject(): { project: Project; mapId: MapId } {
      const project = createBlankProject();
      return { project, mapId: project.startMapId };
    }
    function withEvents(base: Project, mapId: MapId, events: GameEvent[]): Project {
      const next: Project = structuredClone(base);
      next.maps[mapId]!.events = events;
      return next;
    }
    function npc(id: string, x: number, y: number, name?: string): GameEvent {
      return {
        id,
        x,
        y,
        trigger: "action",
        commands: [],
        sprite: { kind: "character", key: "villager", index: 0 } as never,
        ...(name ? { pages: [{ name, trigger: "action", priority: "same", commands: [], conditions: [] }] as never } : {}),
      } as GameEvent;
    }
    describe("summarizeRegionEventChanges", () => {
      it("영역 안에 새로 놓인 이벤트를 잡는다", () => {
        const { project, mapId } = makeProject();
        const proposed = withEvents(project, mapId, [npc("shop_merchant", 6, 6, "잡화점 주인")]);
        const changes = summarizeRegionEventChanges(project, proposed, mapId, REGION);
        expect(changes).toHaveLength(1);
        expect(changes[0]!.kind).toBe("added");
        expect(changes[0]!.name).toBe("잡화점 주인");
        expect(changes[0]!.icon).toBe("shop"); // id 에 shop → 상점 아이콘
        expect(SVG_ICON_NAMES).toContain(changes[0]!.icon);
        expect(regionEventChangeLabel(changes[0]!)).toContain("(6,6)");
        expect(regionEventChangeLabel(changes[0]!)).toContain("새로 놓임");
      });

      it("영역 밖에 놓인 이벤트는 목록에 넣지 않는다", () => {
        const { project, mapId } = makeProject();
        const proposed = withEvents(project, mapId, [npc("npc_far", 20, 20)]);
        expect(summarizeRegionEventChanges(project, proposed, mapId, REGION)).toHaveLength(0);
      });

      it("이동과 삭제를 구분한다", () => {
        const { project, mapId } = makeProject();
        const before = withEvents(project, mapId, [npc("npc_a", 5, 5), npc("npc_b", 7, 7)]);
        const after = withEvents(project, mapId, [npc("npc_a", 6, 5)]);
        const changes = summarizeRegionEventChanges(before, after, mapId, REGION);
        const byId = new Map(changes.map((change) => [change.eventId, change.kind]));
        expect(byId.get("npc_a")).toBe("moved");
        expect(byId.get("npc_b")).toBe("removed");
      });

      it("좌표는 같고 내용만 바뀌면 '내용 바뀜'", () => {
        const { project, mapId } = makeProject();
        const before = withEvents(project, mapId, [npc("npc_a", 5, 5, "경비")]);
        const after = withEvents(project, mapId, [npc("npc_a", 5, 5, "대장장이")]);
        const changes = summarizeRegionEventChanges(before, after, mapId, REGION);
        expect(changes).toHaveLength(1);
        expect(changes[0]!.kind).toBe("modified");
      });

      it("변경이 없으면 빈 목록", () => {
        const { project, mapId } = makeProject();
        expect(summarizeRegionEventChanges(project, structuredClone(project), mapId, REGION)).toHaveLength(0);
      });

      it("변경 아이콘이 SvgIconName 이고 라벨·이름에 이모지가 없다", () => {
        const { project, mapId } = makeProject();
        const proposed = withEvents(project, mapId, [npc("shop_merchant", 6, 6, "잡화점 주인")]);
        const changes = summarizeRegionEventChanges(project, proposed, mapId, REGION);
        for (const change of changes) {
          expect(SVG_ICON_NAMES).toContain(change.icon);
          expect(change.name).not.toMatch(/\p{Extended_Pictographic}/u);
          expect(regionEventChangeLabel(change)).not.toMatch(/\p{Extended_Pictographic}/u);
        }
        const outside = summarizeOutsideRegionChanges(project, proposed, mapId);
        for (const row of outside) {
          expect(row.label).not.toMatch(/\p{Extended_Pictographic}/u);
        }
      });
    });
    describe("summarizeOutsideRegionChanges", () => {
      // 안전 관련 핵심: clipToRegion 은 영역 밖 **타일·이벤트만** 되돌린다. 아래 변경들은
      // 미리보기도 승인도 없이 통과하므로 최소한 목록에 드러나야 한다.
      it("타일만 바뀌면 영역 밖 변경이 없다", () => {
        const { project, mapId } = makeProject();
        const proposed: Project = structuredClone(project);
        proposed.maps[mapId]!.lowerTiles[0] = 999;
        expect(summarizeOutsideRegionChanges(project, proposed, mapId)).toHaveLength(0);
      });

      it("다른 맵 변경을 잡는다", () => {
        const { project, mapId } = makeProject();
        const otherId = Object.keys(project.maps).find((id) => id !== mapId);
        if (!otherId) {
          // 빈 프로젝트에 맵이 하나뿐이면 새 맵 추가 경로로 확인한다.
          const proposed: Project = structuredClone(project);
          proposed.maps["map_new"] = { ...structuredClone(project.maps[mapId]!), id: "map_new", name: "새 맵" } as never;
          const changes = summarizeOutsideRegionChanges(project, proposed, mapId);
          expect(changes.some((change) => change.kind === "map-added")).toBe(true);
          return;
        }
        const proposed: Project = structuredClone(project);
        proposed.maps[otherId]!.lowerTiles[0] = 999;
        const changes = summarizeOutsideRegionChanges(project, proposed, mapId);
        expect(changes.some((change) => change.kind === "map-changed")).toBe(true);
      });

      it("퀘스트·스위치 신규 등록을 개수 변화로 알린다", () => {
        const { project, mapId } = makeProject();
        const proposed: Project = structuredClone(project);
        proposed.switches = [...(proposed.switches ?? []), { id: "sw_new", name: "새 스위치" } as never];
        const changes = summarizeOutsideRegionChanges(project, proposed, mapId);
        const row = changes.find((change) => change.kind === "switches");
        expect(row).toBeTruthy();
        expect(row!.label).toContain("개 →");
      });

      it("타일셋 변경은 경고하지 않는다 — 배치에 필요한 보조 데이터라 매번 떠서 소음이 된다", () => {
        const { project, mapId } = makeProject();
        const proposed: Project = structuredClone(project);
        const tilesetId = Object.keys(proposed.tilesets)[0];
        if (tilesetId) {
          proposed.tilesets[tilesetId] = { ...proposed.tilesets[tilesetId]!, name: "바뀐 이름" } as never;
        }
        expect(summarizeOutsideRegionChanges(project, proposed, mapId)).toHaveLength(0);
      });
    });
  });
});

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

describe("regionRouteIntent", () => {
  isolateTimers();
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
});
