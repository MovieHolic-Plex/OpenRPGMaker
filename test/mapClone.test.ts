import { describe, expect, it } from "vitest";
import { commitChangeset } from "@/editor/tools/changeset";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import { createBlankProject } from "@/project/defaults/defaultProject";
import type { ClusterRule, GameMap, Project, TileGroupMetadata, TilesetDef, Command, EventPage, GameEvent, Trigger, MapLayoutPlan } from "@/project/types";
import { withRetiredCombinedTownMaps } from "./support/retiredCombinedTownMaps";
import { ensureConceptBundles, liveBundlesForTileset } from "@/editor/conceptBundleResolve";
import type { ToolContext } from "@/editor/tools/types";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { withRetiredEasyRpgTilesets, retiredEasyRpgTileset } from "./support/retiredEasyRpgTilesets";
import { buildClusterEditKickoff } from "@/ai/clusterAssistPrompt";
import { buildGroupSample } from "@/ai/groupSampleBuilder";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { isPassable, canMove } from "@/project/collision";
import { runTool, getTool } from "@/editor/tools";
import { addMapLocation, deleteMapLocation, resizeMapLocation, mapLocations } from "@/project/mapNamedLocations";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { drainPendingLocationTransitions, fireLocationTransitionTriggers, fireLocationTransitionTriggersAfterTransfer, seedLocationOccupancyForScene } from "@/player/playSceneLocationTransitions";
import { cloneGameMap } from "@/project/mapClone";
import { createBlankMap } from "@/project/defaults";
import { findLayoutRegions, rankRegionsByCenter } from "@/project/mapLayoutPlan";
import { canTravelBetweenMaps, firstStandableCell } from "@/testing/mapTravelReachability";
import { isolateTimers } from "./mergedTeardown";

describe("clusterRuleCommitGate", () => {
  isolateTimers();
  const MAP_ID = "map_cluster_gate";
  function mapForGate(): GameMap {
    const width = 4;
    const height = 4;
    return {
      events: [],
      height,
      id: MAP_ID,
      lowerTiles: new Array<number>(width * height).fill(TILE.GRASS),
      name: "클러스터 게이트",
      tileSize: 16,
      tilesetId: COMBINED_TOWN_TILESET_ID,
      upperTiles: new Array<number>(width * height).fill(TILE.EMPTY),
      width,
    };
  }
  function at(map: GameMap, x: number, y: number): number {
    return y * map.width + x;
  }
  function hardAdjacencyRule(): ClusterRule {
    return { id: "roof-wall-hard", kind: "adjacency", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "hard" };
  }
  function clusterGroup(): TileGroupMetadata {
    return {
      defaultLayer: "lower",
      description: "260은 290 바로 위에 있어야 한다",
      id: "roof-wall",
      name: "지붕-벽",
      placementRules: "260 아래에는 290",
      role: "building",
      rules: [hardAdjacencyRule()],
      tileIds: [260, 290],
    };
  }
  function projectForGate(): { readonly map: GameMap; readonly project: Project } {
    const project = withRetiredCombinedTownMaps(createBlankProject());
    const map = project.maps[project.startMapId] ?? mapForGate();
    for (const candidate of Object.values(project.maps)) {
      candidate.lowerTiles.fill(TILE.GRASS);
      candidate.upperTiles.fill(TILE.EMPTY);
    }
    project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups = [clusterGroup()];
    return { map, project };
  }
  describe("cluster rule commit gate", () => {
    it("hard adjacency 위반은 lint error로 보고되지만 commitChangeset을 차단하지 않는다", () => {
      // Given: a hard rule requiring tile 260 directly above tile 290.
      const { map, project } = projectForGate();
      map.lowerTiles[at(map, 1, 1)] = 260;

      // When: the unsupported draft is committed.
      const reported = commitChangeset(project);

      // Then: the cluster-rule hard error is reported but does not block the write.
      expect(reported.ok).toBe(true);
      expect(reported.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "cluster-rule:adjacency:roof-wall",
            severity: "error",
            x: 1,
            y: 1,
          }),
        ])
      );

      // When: the required support tile is placed directly below.
      map.lowerTiles[at(map, 1, 2)] = 290;
      const accepted = commitChangeset(project);

      // Then: the fixed draft still passes, now without cluster-rule issues.
      expect(accepted.ok).toBe(true);
      expect(accepted.issues.filter((issue) => issue.code.startsWith("cluster-rule"))).toHaveLength(0);
    });
  });
});

describe("conceptOutdoorGates", () => {
  isolateTimers();
  function ctx(): ToolContext {
    return { project: createBlankProject() };
  }
  describe("Phase 5 실외 확장 — 스코프 게이트와 명시적 거부", () => {
    it("미시드 실외는 live에서 빈 배열 — 템플릿이 새지 않는다", () => {
      const context = ctx();
      expect(liveBundlesForTileset(context.project, COMBINED_TOWN_TILESET_ID)).toEqual([]);
      expect(context.project.tilesets[COMBINED_TOWN_TILESET_ID]?.scratchConceptBundles).toBeUndefined();
    });

    it("ensure는 실외를 손대지 않는다", () => {
      const context = ctx();
      ensureConceptBundles(context.project, COMBINED_TOWN_TILESET_ID);
      expect(context.project.tilesets[COMBINED_TOWN_TILESET_ID]?.scratchConceptBundles).toBeUndefined();
    });

    it("실내 칩셋은 여전히 초안을 시드한다", () => {
      // Concept-bundle seeding is tied to the retired EasyRPG interior sheet (ensureConceptBundles only seeds INTERIOR_ROOM_TILESET_ID);
      // the v5 hand-pixel interior never seeds drafts, so this runs on a pre-purge project that still carries that sheet.
      const context = { project: withRetiredEasyRpgTilesets(createBlankProject()) };
      ensureConceptBundles(context.project, INTERIOR_ROOM_TILESET_ID);
      // The interior sheet is still the only one ensure touches (unlike the outdoor case above), but the shared interior reset
      // retired every facility template (CONCEPT_FACILITY_TEMPLATES = [] — "do not seed rejected facility layouts", present at
      // the public baseline 0d4f13e7c8), so the seeded draft list is empty rather than populated.
      expect(context.project.tilesets[INTERIOR_ROOM_TILESET_ID]?.scratchConceptBundles).toEqual([]);
    });

    // Removed it "place_concept는 실내 칩셋이 아니면": place_concept was removed from the tool registry on purpose.

    // Removed it "실외 전용 시설명은 실내 스코프에서": place_concept was removed from the tool registry on purpose.

    // Removed it "get_concept_facility는 실외를 읽되": get_concept_facility was removed from the tool registry on purpose.

    // Removed it "place_concept는 실내 칩셋에서 그대로": place_concept was removed from the tool registry on purpose.
  });
});

describe("groupLayoutAuthoring", () => {
  isolateTimers();
  function clusterEditPrompt(): string {
    return buildClusterEditKickoff({ tilesetId: COMBINED_TOWN_TILESET_ID, groupId: "roof_layout_group", group: null });
  }
  describe("클러스터 구성 저작", () => {
    it("cluster-edit 킥오프가 구성 수정 선택지를 포함한다", () => {
      // Given: the cluster-edit skill is opened.
      const prompt = clusterEditPrompt();

      // Then: users can choose layout authoring separately from rule authoring.
      expect(prompt).toContain("구성 수정(위/아래·좌우 배치)");
    });

    it("구성 수정 프로토콜이 원탭 축 선택, 최소 입력, 이미지 전/후, set_group_layout 저장을 지시한다", () => {
      // Given: the cluster-edit skill is opened.
      const prompt = clusterEditPrompt();

      // Then: vertical/horizontal layout editing stays image-first and routes to set_group_layout.
      expect(prompt).toContain("[선택지] 세로(위/아래) | 가로(좌/우) | 취소");
      expect(prompt).toContain("어느 타일이 **위**? 어느 타일이 **아래**?");
      expect(prompt).toContain("위 260 / 아래 290");
      expect(prompt).toContain("render_group_sample({tilesetId, groupId, proposed.patternGrammar})");
      expect(prompt).toContain("[선택지] 적용 | 다시");
      expect(prompt).toContain("set_group_layout");
      expect(prompt).toContain('axis:"vertical", top:[260], bottom:[290]');
      expect(prompt).toContain('axis:"horizontal"');
      expect(prompt).toContain("전/후 이미지");
    });

    it("구성과 규칙을 구분하고 위/아래가 레이어가 아님을 안내한다", () => {
      // Given: the cluster-edit skill is opened.
      const prompt = clusterEditPrompt();

      // Then: adjacency wording is routed by intent, not by the shared words "위/아래".
      expect(prompt).toContain("'위/아래로 배치·구성·이어지게 해줘'는 구성(set_group_layout)");
      expect(prompt).toContain("'반드시 위/아래여야 한다(제약·검증)'는 규칙(set_cluster_rule)");
      expect(prompt).toContain("'위/아래'는 레이어(상위/하위)가 아니라 세로 인접 칸을 뜻한다");
    });
  });
});

describe("groupSampleBuilder", () => {
  isolateTimers();
  type PatternGrammar = NonNullable<TileGroupMetadata["patternGrammar"]>;
  function tileset(priority: "lower" | "upper" = "lower"): TilesetDef {
    return {
      count: 512,
      id: "test_tileset",
      image: { type: "bundled", id: "test" },
      name: "Test",
      passability: Array.from({ length: 512 }, () => ({ down: true, left: true, right: true, up: true })),
      priority: Array.from({ length: 512 }, () => priority),
      terrain: Array.from({ length: 512 }, () => 0),
      tileSize: 16,
      tilesPerRow: 16,
    };
  }
  function part(role: PatternGrammar["parts"][number]["role"], tile: number): PatternGrammar["parts"][number] {
    return { role, tileIds: [tile] };
  }
  describe("buildGroupSample", () => {
    it("assembles a wall nine-slice sample into the expected 3x3 cells", () => {
      const grammar: PatternGrammar = {
        axis: "both",
        kind: "nine_slice_expandable",
        minHeight: 3,
        minWidth: 3,
        parts: [
          part("topLeft", 1),
          part("top", 2),
          part("topRight", 3),
          part("left", 4),
          part("center", 5),
          part("right", 6),
          part("bottomLeft", 7),
          part("bottom", 8),
          part("bottomRight", 9),
        ],
        preserveCaps: true,
        repeat: "center",
      };

      const sample = buildGroupSample(tileset(), { role: "wall", tileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9], patternGrammar: grammar });

      expect(sample.w).toBe(3);
      expect(sample.h).toBe(3);
      expect(sample.lower).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(sample.upper).toEqual(Array.from({ length: 9 }, () => TILE.EMPTY));
    });

    it("shows vertical props as repeated upper-layer pairs over grass", () => {
      const grammar: PatternGrammar = {
        axis: "vertical",
        kind: "vertical_expandable",
        minHeight: 2,
        minWidth: 1,
        parts: [part("top", 10), part("bottom", 11)],
        preserveCaps: true,
        repeat: "body",
      };

      const sample = buildGroupSample(tileset("upper"), { role: "prop", tileIds: [10, 11], patternGrammar: grammar });

      expect(sample.w).toBe(5);
      expect(sample.h).toBe(2);
      expect(sample.lower).toEqual(Array.from({ length: 10 }, () => TILE.GRASS));
      expect(sample.upper).toEqual([10, TILE.EMPTY, 10, TILE.EMPTY, 10, 11, TILE.EMPTY, 11, TILE.EMPTY, 11]);
    });

    it("shows grammarless two-tile prop samples as vertical pairs with canopy upper and trunk lower", () => {
      const sample = buildGroupSample(tileset("upper"), { role: "prop", tileIds: [260, 290] });

      expect(sample.w).toBe(5);
      expect(sample.h).toBe(2);
      // 수관 upper 행 + 밑동 lower 행 (숲 겹침용)
      expect(sample.upper.slice(0, 5)).toEqual([260, TILE.EMPTY, 260, TILE.EMPTY, 260]);
      expect(sample.lower.slice(5, 10)).toEqual([290, TILE.GRASS, 290, TILE.GRASS, 290]);
    });

    it("falls back to a single row when no structure grammar is known", () => {
      const sample = buildGroupSample(tileset(), { role: "terrain", tileIds: [21, 22, 23] });

      expect(sample).toEqual({
        h: 1,
        lower: [21, 22, 23],
        upper: [TILE.EMPTY, TILE.EMPTY, TILE.EMPTY],
        w: 3,
      });
    });

    it("clamps oversized samples to the 6x6 preview ceiling", () => {
      const sample = buildGroupSample(tileset(), {
        role: "terrain",
        tileIds: Array.from({ length: 80 }, (_, index) => index),
      });

      expect(sample.w).toBeLessThanOrEqual(6);
      expect(sample.h).toBeLessThanOrEqual(6);
      expect(sample.lower).toHaveLength(sample.w * sample.h);
      expect(sample.upper).toHaveLength(sample.w * sample.h);
    });
  });
});

describe("groupSampleJunctionOverlay", () => {
  isolateTimers();
  type PatternGrammar = NonNullable<TileGroupMetadata["patternGrammar"]>;
  function tileset(): TilesetDef {
    return {
      count: 512,
      id: "test_tileset",
      image: { type: "bundled", id: "test" },
      name: "Test",
      passability: Array.from({ length: 512 }, () => ({ down: true, left: true, right: true, up: true })),
      priority: Array.from({ length: 512 }, () => "lower"),
      terrain: Array.from({ length: 512 }, () => 0),
      tileSize: 16,
      tilesPerRow: 16,
    };
  }
  function part(role: PatternGrammar["parts"][number]["role"], tile: number): PatternGrammar["parts"][number] {
    return { role, tileIds: [tile] };
  }
  function wallGrammar(): PatternGrammar {
    return {
      axis: "both",
      kind: "nine_slice_expandable",
      minHeight: 3,
      minWidth: 3,
      parts: [
        part("topLeft", 1),
        part("top", 2),
        part("topRight", 3),
        part("left", 4),
        part("center", 5),
        part("right", 6),
        part("bottomLeft", 7),
        part("bottom", 8),
        part("bottomRight", 9),
      ],
      preserveCaps: true,
      repeat: "center",
    };
  }
  describe("buildGroupSample junction and overlay rules", () => {
    it("leaves the sample identical when no junction or overlay rules are provided", () => {
      const input = { role: "wall", tileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9], patternGrammar: wallGrammar() } satisfies Parameters<typeof buildGroupSample>[1];

      const before = buildGroupSample(tileset(), input);
      const after = buildGroupSample(tileset(), { ...input, junctions: [], overlays: [] });

      expect(after).toEqual(before);
    });

    it("omits the requested junction role cells after assembling the sample", () => {
      const sample = buildGroupSample(tileset(), {
        role: "wall",
        tileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        patternGrammar: wallGrammar(),
        junctions: [{ action: "omit", atRoles: ["bottomLeft", "bottom", "bottomRight"], side: "below", withRole: "roof" }],
      });

      expect(sample.lower).toEqual([1, 2, 3, 4, 5, 6, TILE.EMPTY, TILE.EMPTY, TILE.EMPTY]);
      expect(sample.upper).toEqual(Array.from({ length: 9 }, () => TILE.EMPTY));
    });

    it("replaces junction role cells with replacement tiles", () => {
      const sample = buildGroupSample(tileset(), {
        role: "wall",
        tileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        patternGrammar: wallGrammar(),
        junctions: [{ action: "replace", atRoles: ["topLeft", "top", "topRight"], replaceWith: [41, 42, 43], side: "above", withRole: "roof" }],
      });

      expect(sample.lower).toEqual([41, 42, 43, 4, 5, 6, 7, 8, 9]);
    });

    it("adds overlay tiles on the representative upper-layer positions deterministically", () => {
      const first = buildGroupSample(tileset(), {
        role: "roof",
        tileIds: [10, 11, 12, 13],
        overlays: [
          { tileIds: [90], when: "ridge" },
          { tileIds: [91, 92], when: "eaveEnd" },
        ],
      });
      const second = buildGroupSample(tileset(), {
        role: "roof",
        tileIds: [10, 11, 12, 13],
        overlays: [
          { tileIds: [90], when: "ridge" },
          { tileIds: [91, 92], when: "eaveEnd" },
        ],
      });

      expect(first.lower).toEqual([10, 11, 12, 13]);
      expect(first.upper).toEqual([91, TILE.EMPTY, 90, 92]);
      expect(second).toEqual(first);
    });
  });
});

// 2026-09-24 JRPG 도그푸딩 ember r1 tools.jsonl:
// - place_npc 귀환 포탈의 transfer 가 마을 (34,3) 통행 불가라 이벤트 전체가 커밋 거부됐다.
// - upsert_equipment 가 아직 없는 actor_toma·actor_mira 때문에 장비 전체를 거부했다.
describe("jrpgDogfoodCommitRefs", () => {
  isolateTimers();
  function transfersOf(commands: readonly Command[] | undefined, out: Extract<Command, { kind: "transfer" }>[] = []): Extract<Command, { kind: "transfer" }>[] {
    for (const command of commands ?? []) {
      if (command.kind === "transfer") out.push(command);
      for (const list of nestedCommandLists(command)) transfersOf(list, out);
    }
    return out;
  }
  function block(project: Project, x: number, y: number): void {
    const map = project.maps[project.startMapId]!;
    map.lowerTiles[y * map.width + x] = TILE.WATER;
    map.upperTiles[y * map.width + x] = TILE.EMPTY;
  }
  describe("통행 불가 transfer 는 이벤트 전체를 버리지 않고 가까운 착지로 옮긴다", () => {
    it("place_npc 선택지 안의 벽 착지를 반경 3 통행 칸으로 옮기고 커밋한다", () => {
      const project = createBlankProject();
      const ctx = { project };
      const mapId = project.startMapId;
      block(project, 10, 6);
      expect(isPassable(project, project.maps[mapId]!, 10, 6)).toBe(false);
      const result = runTool(ctx, "place_npc", {
        mapId,
        name: "귀환 마법진",
        x: 6,
        y: 6,
        pages: [{
          lines: ["마을로 돌아갈까?"],
          choices: [{ text: "돌아간다", commands: [{ kind: "transfer", mapId, x: 10, y: 6 }] }],
        }],
      });
      expect(result.ok, result.summary).toBe(true);
      const event = ctx.project.maps[mapId]!.events.find((entry) => entry.name === "귀환 마법진");
      const landed = event?.pages?.flatMap((page) => transfersOf(page.commands)) ?? [];
      expect(landed).toHaveLength(1);
      const landing = landed[0]!;
      expect(landing.x === 10 && landing.y === 6).toBe(false);
      expect(Math.max(Math.abs(landing.x - 10), Math.abs(landing.y - 6))).toBeLessThanOrEqual(3);
      expect(isPassable(ctx.project, ctx.project.maps[mapId]!, landing.x, landing.y)).toBe(true);
      expect(result.diff?.warnings.join("\n")).toContain("통행 불가");
    });

    it("이미 통행 가능한 착지는 그대로 둔다", () => {
      const project = createBlankProject();
      const ctx = { project };
      const mapId = project.startMapId;
      const result = runTool(ctx, "upsert_event", {
        mapId,
        event: {
          id: "ev_gate",
          name: "문",
          x: 6,
          y: 6,
          pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "transfer", mapId, x: 8, y: 6 }] }],
        },
      });
      expect(result.ok, result.summary).toBe(true);
      const event = ctx.project.maps[mapId]!.events.find((entry) => entry.id === "ev_gate");
      expect(transfersOf(event?.pages?.[0]?.commands)).toMatchObject([{ x: 8, y: 6 }]);
      expect(result.diff?.warnings.join("\n") ?? "").not.toContain("통행 불가");
    });
  });
  describe("upsert_equipment 없는 착용 제한", () => {
    it("아직 없는 배우·직업 id 만 빼고 장비는 저장한다", () => {
      const project = createBlankProject();
      const ctx = { project };
      const actorId = project.database.actors[0]!.id;
      const classId = project.database.classes[0]!.id;
      const result = runTool(ctx, "upsert_equipment", {
        equipment: {
          id: "equip_acolyte_staff",
          name: "사제 지팡이",
          slot: "weapon",
          equippableActorIds: ["actor_toma", actorId],
          equippableClassIds: ["class_not_yet", classId],
          statBonuses: { mind: 12, attack: 4 },
        },
      });
      expect(result.ok, result.summary).toBe(true);
      const equipment = ctx.project.database.equipment.find((entry) => entry.id === "equip_acolyte_staff");
      expect(equipment?.equippableActorIds).toEqual([actorId]);
      expect(equipment?.equippableClassIds).toEqual([classId]);
      expect(equipment?.statBonuses.mind).toBe(12);
      const warnings = result.diff?.warnings.join("\n") ?? "";
      expect(warnings).toContain("actor_toma");
      expect(warnings).toContain("class_not_yet");
    });
  });
});

// 「구역에 들어오면/나가면」 — **런타임 배선**을 실제 걸음/순간이동으로 검사한다.
//
// 왜 runSceneTest 인가: 이 하네스는 걸음 완료 → 드나듦 → 접촉 → 인카운터 순서와 순간이동
// 절차를 출하 씬(`playSceneMovement` / `playSceneMapCommands`)과 같은 산법으로 돌린다.
// 판정 자체는 `project/locationTransitions.ts` 한 곳이고, 여기서는 «그 판정이 정말로
// 이벤트를 돌리는가» 와 «돌리지 말아야 할 때 안 돌리는가» 를 본다.
describe("locationTransitionRuntime", () => {
  isolateTimers();
  const ENTERED = "sw_entered";
  const LEFT = "sw_left";
  const ENTER_COUNT = "var_enter_count";
  function blankMap(id: string, name: string, width = 16, height = 16): GameMap {
    return {
      id,
      name,
      width,
      height,
      tilesetId: "easyrpg_chipset_combined_town",
      tileSize: 16,
      lowerTiles: new Array(width * height).fill(TILE.GRASS),
      upperTiles: new Array(width * height).fill(TILE.EMPTY),
      events: [],
    };
  }
  /**
   * 맵 하나에 광장(2,2 6×6)이 있는 프로젝트. 스위치 두 개와 카운터 변수 하나를 미리 선언한다
   * (선언 없는 id 는 startSession 이 시드하지 않는다).
   */
  function projectWithPlaza(): { project: Project; mapId: string; plazaId: string } {
    // 맵이 TILE.GRASS(합본 마을 번호)로 깔린다 — 2026-10-07 정리 뒤 새 프로젝트에 없는 그 칩셋을 옛 저장본처럼 싣는다.
    const project = withRetiredEasyRpgTilesets(createBlankProject());
    project.switches = [...project.switches, { id: ENTERED, name: "들어옴" }, { id: LEFT, name: "나감" }];
    project.variables = [...project.variables, { id: ENTER_COUNT, name: "진입 횟수" }];
    const map = blankMap("map_plaza", "광장 맵");
    project.maps[map.id] = map;
    project.startMapId = map.id;
    project.session = { ...project.session, startMapId: map.id, startX: 0, startY: 0 };
    const plaza = addMapLocation(map, { name: "정문 광장", x: 2, y: 2, w: 6, h: 6 });
    if (!plaza.ok) throw new Error("fixture");
    return { project, mapId: map.id, plazaId: plaza.location.id };
  }
  function transitionEvent(options: {
    readonly id: string;
    readonly locationId: string;
    readonly transition: "enter" | "leave";
    readonly commands: readonly Command[];
    /** 페이지에 트리거를 두면 이벤트 트리거 대신 페이지 트리거가 이긴다(런타임 규칙). */
    readonly onPage?: boolean;
    readonly x?: number;
    readonly y?: number;
  }): GameEvent {
    const trigger: Trigger = {
      kind: "locationTransition",
      locationId: options.locationId,
      transition: options.transition,
    };
    // 페이지가 있으면 **페이지 트리거가 이긴다**(`runtimeEventView`: `page.trigger ?? event.trigger`).
    // 그러니 «이벤트 트리거로 저작» 을 검사하려면 페이지가 **없어야** 한다(레거시 꼴).
    // 이 분기를 헷갈리면 페이지의 action 트리거가 조용히 이기며 «안 도는 트리거» 를 검사하게 된다.
    if (!options.onPage) {
      return {
        id: options.id,
        // 이벤트 본체는 구역 밖 구석에 둔다 — 발동은 «주인공이 어디 있나» 로만 정해지고
        // 이벤트 좌표와 무관하다는 것도 이 배치가 증명한다.
        x: options.x ?? 14,
        y: options.y ?? 14,
        trigger,
        commands: [...options.commands],
      };
    }
    const page: EventPage = {
      id: `${options.id}_p1`,
      name: "구역 반응",
      conditions: [],
      graphic: {},
      trigger,
      priority: "below",
      overlapForbidden: false,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [...options.commands],
    };
    return {
      id: options.id,
      x: options.x ?? 14,
      y: options.y ?? 14,
      trigger: { kind: "action" },
      commands: [],
      pages: [page],
    };
  }
  const setSwitch = (switchId: string): Command => ({ kind: "setSwitch", switchId, value: true });
  const bumpCounter: Command = { kind: "setVariable", variableId: ENTER_COUNT, op: "+=", value: 1 };
  describe("location transition trigger — 걸음으로 드나들면 발동한다", () => {
    it("구역 경계를 밟는 걸음에서 enter 이벤트가 실행된다", () => {
      const { project, mapId, plazaId } = projectWithPlaza();
      project.maps[mapId]!.events = [transitionEvent({
        id: "ev_enter",
        locationId: plazaId,
        transition: "enter",
        commands: [setSwitch(ENTERED)],
      })];

      const result = runSceneTest(project, {
        mapId,
        start: { x: 1, y: 2 },
        steps: [
          { kind: "expect", switchOff: ENTERED },
          { kind: "move", dir: "right" },
          { kind: "expect", playerAt: { x: 2, y: 2 }, switchOn: ENTERED },
        ],
      });
      expect(result.failureReason).toBeUndefined();
      expect(result.ok).toBe(true);
    });

    it("페이지 트리거로 저작해도 같다 (페이지 트리거가 이벤트 트리거를 이긴다)", () => {
      const { project, mapId, plazaId } = projectWithPlaza();
      project.maps[mapId]!.events = [transitionEvent({
        id: "ev_enter_page",
        locationId: plazaId,
        transition: "enter",
        commands: [setSwitch(ENTERED)],
        onPage: true,
      })];

      const result = runSceneTest(project, {
        mapId,
        start: { x: 1, y: 3 },
        steps: [{ kind: "move", dir: "right" }, { kind: "expect", switchOn: ENTERED }],
      });
      expect(result.failureReason).toBeUndefined();
      expect(result.ok).toBe(true);
    });

    it("구역을 벗어나는 걸음에서 leave 이벤트가 실행된다", () => {
      const { project, mapId, plazaId } = projectWithPlaza();
      project.maps[mapId]!.events = [transitionEvent({
        id: "ev_leave",
        locationId: plazaId,
        transition: "leave",
        commands: [setSwitch(LEFT)],
      })];

      const result = runSceneTest(project, {
        mapId,
        start: { x: 2, y: 2 },
        steps: [
          // 시작 지점이 이미 안이라 «들어옴» 은 없다(기준선). 밖으로 한 걸음.
          { kind: "expect", switchOff: LEFT },
          { kind: "move", dir: "left" },
          { kind: "expect", playerAt: { x: 1, y: 2 }, switchOn: LEFT },
        ],
      });
      expect(result.failureReason).toBeUndefined();
      expect(result.ok).toBe(true);
    });

    it("구역 안을 계속 걸어도 enter 는 한 번뿐이다 (같은 칸·인접 칸 재진입 없음)", () => {
      const { project, mapId, plazaId } = projectWithPlaza();
      project.maps[mapId]!.events = [transitionEvent({
        id: "ev_count",
        locationId: plazaId,
        transition: "enter",
        commands: [bumpCounter],
      })];

      const result = runSceneTest(project, {
        mapId,
        start: { x: 1, y: 3 },
        steps: [
          { kind: "move", dir: "right" },
          { kind: "expect", variableEquals: { variableId: ENTER_COUNT, value: 1 } },
          { kind: "move", dir: "right" },
          { kind: "move", dir: "down" },
          { kind: "move", dir: "left" },
          { kind: "expect", variableEquals: { variableId: ENTER_COUNT, value: 1 } },
        ],
      });
      expect(result.failureReason).toBeUndefined();
      expect(result.ok).toBe(true);
    });

    it("나갔다 다시 들어오면 두 번째 enter 가 난다", () => {
      const { project, mapId, plazaId } = projectWithPlaza();
      project.maps[mapId]!.events = [transitionEvent({
        id: "ev_count",
        locationId: plazaId,
        transition: "enter",
        commands: [bumpCounter],
      })];

      const result = runSceneTest(project, {
        mapId,
        start: { x: 1, y: 3 },
        steps: [
          { kind: "move", dir: "right" },
          { kind: "move", dir: "left" },
          { kind: "move", dir: "right" },
          { kind: "expect", variableEquals: { variableId: ENTER_COUNT, value: 2 } },
        ],
      });
      expect(result.failureReason).toBeUndefined();
      expect(result.ok).toBe(true);
    });

    it("시작 지점이 구역 안이면 부팅만으로는 enter 가 나지 않는다", () => {
      const { project, mapId, plazaId } = projectWithPlaza();
      project.maps[mapId]!.events = [transitionEvent({
        id: "ev_enter",
        locationId: plazaId,
        transition: "enter",
        commands: [setSwitch(ENTERED)],
      })];

      const result = runSceneTest(project, {
        mapId,
        start: { x: 4, y: 4 },
        steps: [{ kind: "expect", switchOff: ENTERED }],
      });
      expect(result.failureReason).toBeUndefined();
      expect(result.ok).toBe(true);
    });

    it("다른 구역의 트리거는 발동하지 않는다", () => {
      const { project, mapId, plazaId } = projectWithPlaza();
      const dock = addMapLocation(project.maps[mapId]!, { name: "부두", x: 11, y: 11, w: 3, h: 3 });
      expect(dock.ok).toBe(true);
      if (!dock.ok) return;
      project.maps[mapId]!.events = [transitionEvent({
        id: "ev_dock",
        locationId: dock.location.id,
        transition: "enter",
        commands: [setSwitch(ENTERED)],
        x: 0,
        y: 0,
      })];
      void plazaId;

      const result = runSceneTest(project, {
        mapId,
        start: { x: 1, y: 3 },
        steps: [{ kind: "move", dir: "right" }, { kind: "expect", switchOff: ENTERED }],
      });
      expect(result.failureReason).toBeUndefined();
      expect(result.ok).toBe(true);
    });
  });
  describe("location transition trigger — 겹친 구역", () => {
    it("광장 안에서 좌판에 들어가면 좌판 enter 만 나고 광장 enter 는 다시 나지 않는다", () => {
      const { project, mapId, plazaId } = projectWithPlaza();
      const stall = addMapLocation(project.maps[mapId]!, { name: "좌판", x: 4, y: 4, w: 2, h: 2 });
      expect(stall.ok).toBe(true);
      if (!stall.ok) return;
      project.maps[mapId]!.events = [
        transitionEvent({ id: "ev_plaza", locationId: plazaId, transition: "enter", commands: [bumpCounter], x: 0, y: 0 }),
        transitionEvent({ id: "ev_stall", locationId: stall.location.id, transition: "enter", commands: [setSwitch(ENTERED)], x: 15, y: 0 }),
      ];

      const result = runSceneTest(project, {
        mapId,
        start: { x: 1, y: 4 },
        steps: [
          { kind: "move", dir: "right" }, // (2,4) 광장 진입
          { kind: "expect", variableEquals: { variableId: ENTER_COUNT, value: 1 }, switchOff: ENTERED },
          { kind: "move", dir: "right" }, // (3,4) 광장 안
          { kind: "move", dir: "right" }, // (4,4) 좌판 진입
          { kind: "expect", switchOn: ENTERED, variableEquals: { variableId: ENTER_COUNT, value: 1 } },
        ],
      });
      expect(result.failureReason).toBeUndefined();
      expect(result.ok).toBe(true);
    });

    it("좌판에서 광장으로 되돌아 나오면 좌판 leave 만 난다 (광장 leave 는 없다)", () => {
      const { project, mapId, plazaId } = projectWithPlaza();
      const stall = addMapLocation(project.maps[mapId]!, { name: "좌판", x: 4, y: 4, w: 2, h: 2 });
      expect(stall.ok).toBe(true);
      if (!stall.ok) return;
      project.maps[mapId]!.events = [
        transitionEvent({ id: "ev_stall_out", locationId: stall.location.id, transition: "leave", commands: [setSwitch(LEFT)], x: 0, y: 0 }),
        transitionEvent({ id: "ev_plaza_out", locationId: plazaId, transition: "leave", commands: [setSwitch(ENTERED)], x: 15, y: 0 }),
      ];

      const result = runSceneTest(project, {
        mapId,
        start: { x: 4, y: 4 },
        steps: [
          { kind: "move", dir: "left" }, // (3,4): 좌판 밖, 광장 안
          { kind: "expect", switchOn: LEFT, switchOff: ENTERED },
        ],
      });
      expect(result.failureReason).toBeUndefined();
      expect(result.ok).toBe(true);
    });
  });
  describe("location transition trigger — 순간이동(중간 걸음 없음)", () => {
    function projectWithTwoMaps(): { project: Project; plazaId: string; hallId: string } {
      const { project, mapId, plazaId } = projectWithPlaza();
      const inner = blankMap("map_hall", "회관");
      project.maps[inner.id] = inner;
      const hall = addMapLocation(inner, { name: "회관 안", x: 1, y: 1, w: 6, h: 6 });
      if (!hall.ok) throw new Error("fixture");
      void mapId;
      return { project, plazaId, hallId: hall.location.id };
    }

    it("구역 안에서 다른 맵으로 순간이동하면 출발 구역의 leave 가 실행된다", () => {
      const { project, plazaId } = projectWithTwoMaps();
      project.maps.map_plaza!.events = [
        transitionEvent({ id: "ev_leave", locationId: plazaId, transition: "leave", commands: [setSwitch(LEFT)], x: 0, y: 0 }),
        // 광장 안 (3,3) 을 밟으면 회관으로 보내는 접촉 이벤트.
        {
          id: "ev_door",
          x: 3,
          y: 3,
          trigger: { kind: "playerTouch" },
          commands: [{ kind: "transfer", mapId: "map_hall", x: 10, y: 10 }],
        },
      ];

      const result = runSceneTest(project, {
        mapId: "map_plaza",
        start: { x: 3, y: 2 },
        steps: [
          { kind: "move", dir: "down" },
          { kind: "expect", mapId: "map_hall", playerAt: { x: 10, y: 10, mapId: "map_hall" }, switchOn: LEFT },
        ],
      });
      expect(result.failureReason).toBeUndefined();
      expect(result.ok).toBe(true);
    });

    it("도착 지점이 구역 안이면 그 구역의 enter 가 실행된다", () => {
      const { project, hallId } = projectWithTwoMaps();
      project.maps.map_hall!.events = [transitionEvent({
        id: "ev_hall_enter",
        locationId: hallId,
        transition: "enter",
        commands: [setSwitch(ENTERED)],
        x: 12,
        y: 12,
      })];
      project.maps.map_plaza!.events = [{
        id: "ev_door",
        x: 3,
        y: 3,
        trigger: { kind: "playerTouch" },
        // 도착 좌표 (2,2) 는 회관 구역(1,1 6×6) 안이다.
        commands: [{ kind: "transfer", mapId: "map_hall", x: 2, y: 2 }],
      }];

      const result = runSceneTest(project, {
        mapId: "map_plaza",
        start: { x: 3, y: 2 },
        steps: [
          { kind: "move", dir: "down" },
          { kind: "expect", mapId: "map_hall", switchOn: ENTERED },
        ],
      });
      expect(result.failureReason).toBeUndefined();
      expect(result.ok).toBe(true);
    });

    it("같은 맵 안 순간이동으로 구역을 벗어나도 leave 가 실행된다", () => {
      const { project, plazaId } = projectWithPlaza();
      project.maps[project.startMapId]!.events = [
        transitionEvent({ id: "ev_leave", locationId: plazaId, transition: "leave", commands: [setSwitch(LEFT)], x: 0, y: 0 }),
        {
          id: "ev_warp",
          x: 3,
          y: 3,
          trigger: { kind: "playerTouch" },
          commands: [{ kind: "transfer", mapId: project.startMapId, x: 12, y: 12 }],
        },
      ];

      const result = runSceneTest(project, {
        mapId: project.startMapId,
        start: { x: 3, y: 2 },
        steps: [
          { kind: "move", dir: "down" },
          { kind: "expect", playerAt: { x: 12, y: 12 }, switchOn: LEFT },
        ],
      });
      expect(result.failureReason).toBeUndefined();
      expect(result.ok).toBe(true);
    });

    it("구역 안에서 같은 구역 안으로 순간이동하면 leave 와 enter 가 둘 다 난다", () => {
      const { project, mapId, plazaId } = projectWithPlaza();
      project.maps[mapId]!.events = [
        transitionEvent({ id: "ev_leave", locationId: plazaId, transition: "leave", commands: [setSwitch(LEFT)], x: 0, y: 0 }),
        transitionEvent({ id: "ev_enter", locationId: plazaId, transition: "enter", commands: [bumpCounter], x: 15, y: 0 }),
        {
          id: "ev_warp",
          x: 3,
          y: 3,
          trigger: { kind: "playerTouch" },
          commands: [{ kind: "transfer", mapId, x: 6, y: 6 }],
        },
      ];

      const result = runSceneTest(project, {
        mapId,
        start: { x: 3, y: 2 },
        steps: [
          { kind: "move", dir: "down" },
          // (2,2)..(7,7) 안에서 안으로 옮겨졌다: 구역을 벗어났다 돌아온 것이므로 둘 다 난다.
          { kind: "expect", playerAt: { x: 6, y: 6 }, switchOn: LEFT, variableEquals: { variableId: ENTER_COUNT, value: 1 } },
        ],
      });
      expect(result.failureReason).toBeUndefined();
      expect(result.ok).toBe(true);
    });
  });
  describe("location transition trigger — 저작이 깨진 상태", () => {
    it("삭제된 구역을 가리키는 트리거는 조용히 실행되지 않는다", () => {
      const { project, mapId, plazaId } = projectWithPlaza();
      project.maps[mapId]!.events = [transitionEvent({
        id: "ev_enter",
        locationId: plazaId,
        transition: "enter",
        commands: [setSwitch(ENTERED)],
        x: 0,
        y: 0,
      })];
      expect(deleteMapLocation(project.maps[mapId]!, plazaId)).toBe(true);

      const result = runSceneTest(project, {
        mapId,
        start: { x: 1, y: 3 },
        steps: [{ kind: "move", dir: "right" }, { kind: "expect", switchOff: ENTERED }],
      });
      expect(result.failureReason).toBeUndefined();
      expect(result.ok).toBe(true);
    });

    it("구역이 축소되어 발밑을 벗어나면 다음 걸음에서 leave 가 실행된다", () => {
      const { project, mapId, plazaId } = projectWithPlaza();
      project.maps[mapId]!.events = [transitionEvent({
        id: "ev_leave",
        locationId: plazaId,
        transition: "leave",
        commands: [setSwitch(LEFT)],
        x: 0,
        y: 0,
      })];
      // 광장을 (2,2) 2×2 로 축소한다 — 주인공이 서게 될 (7,7) 은 이제 밖이다.
      expect(resizeMapLocation(project.maps[mapId]!, plazaId, { x: 2, y: 2, w: 2, h: 2 }).ok).toBe(true);

      const result = runSceneTest(project, {
        mapId,
        // 축소 전 광장이었던 (7,7) 근처에서 시작해 축소된 구역 밖을 걷는다.
        start: { x: 7, y: 7 },
        steps: [
          // 시작 기준선이 이미 «밖» 이므로 leave 도 나지 않는다 — 저작 편집은 사건이 아니다.
          { kind: "expect", switchOff: LEFT },
          { kind: "move", dir: "right" },
          { kind: "expect", switchOff: LEFT },
          // 축소된 구역(2,2 2×2)에 실제로 들어갔다 나오면 leave 가 난다.
          { kind: "walk", to: { x: 2, y: 2 } },
          { kind: "move", dir: "left" },
          { kind: "expect", switchOn: LEFT },
        ],
      });
      expect(result.failureReason).toBeUndefined();
      expect(result.ok).toBe(true);
    });
  });
  // ── 실행이 «밀리는» 경로 ──────────────────────────────────────────────────────
  //
  // 브라우저 실측으로 발견한 결함의 회귀다(2026-09-10): 문(playerTouch)을 밟아 장소 이동하면
  // `transferTo` 가 **문 이벤트의 인터프리터 안에서** 불리므로 그 시점 `scene.running` 이
  // 참이고 `runEvent` 가 즉시 되돌아 나온다 — 가장 흔한 저작(문으로 구역에 들어가기)의
  // enter 이벤트가 한 번도 돌지 않았다. 이제 실행할 수 없었던 것은 큐에 담기고
  // `refreshRuntimeSurfaces`(= 이벤트가 끝나는 자리)에서 뽑힌다.
  //
  // 씬 대역을 쓰는 이유: 이 결함은 Phaser 씬의 `running` 수명에 걸린 배선 문제이고,
  // runSceneTest 하네스는 이벤트를 중첩 실행하므로(running 개념이 없다) 이 경로를 재현하지 못한다.
  describe("location transition trigger — 진행 중이면 밀리고 이벤트가 끝나면 돌아온다", () => {
    type StubScene = {
      map: GameMap;
      session: { occupiedLocationIds?: Record<string, string[]> };
      tileX: number;
      tileY: number;
      running: boolean;
      ran: string[];
      activeRuntimeEvents: (kind: string) => { event: { id: string }; trigger: Trigger }[];
      runEvent: (eventId: string) => Promise<void>;
    };

    function stubScene(map: GameMap, triggers: readonly { id: string; trigger: Trigger }[]): StubScene {
      const scene: StubScene = {
        map,
        session: {},
        tileX: 1,
        tileY: 3,
        running: false,
        ran: [],
        activeRuntimeEvents: (kind) => kind === "locationTransition"
          ? triggers.map((entry) => ({ event: { id: entry.id }, trigger: entry.trigger }))
          : [],
        runEvent: async (eventId) => { scene.ran.push(eventId); },
      };
      return scene;
    }

    it("running 중의 순간이동 진입은 버려지지 않고 이벤트 종료 후 실행된다", async () => {
      const { project, mapId, plazaId } = projectWithPlaza();
      const map = project.maps[mapId]!;
      const scene = stubScene(map, [
        { id: "ev_enter", trigger: { kind: "locationTransition", locationId: plazaId, transition: "enter" } },
      ]);
      seedLocationOccupancyForScene(scene);

      // 문 이벤트가 도는 중이다.
      scene.running = true;
      scene.tileX = 4;
      scene.tileY = 4;
      fireLocationTransitionTriggersAfterTransfer(scene, mapId);
      await Promise.resolve();
      expect(scene.ran).toEqual([]);
      // 점유 기록은 밀림과 무관하게 이미 갱신됐다.
      expect(scene.session.occupiedLocationIds?.[mapId]).toEqual([plazaId]);

      // 이벤트가 끝나 running 이 내려간 자리에서 뽑힌다.
      scene.running = false;
      drainPendingLocationTransitions(scene);
      await Promise.resolve();
      expect(scene.ran).toEqual(["ev_enter"]);

      // 두 번 뽑아도 다시 돌지 않는다.
      drainPendingLocationTransitions(scene);
      await Promise.resolve();
      expect(scene.ran).toEqual(["ev_enter"]);
    });

    it("running 중의 걸음 진입도 같은 자리에서 회복된다", async () => {
      const { project, mapId, plazaId } = projectWithPlaza();
      const map = project.maps[mapId]!;
      const scene = stubScene(map, [
        { id: "ev_enter", trigger: { kind: "locationTransition", locationId: plazaId, transition: "enter" } },
      ]);
      seedLocationOccupancyForScene(scene);

      scene.running = true;
      scene.tileX = 3;
      scene.tileY = 3;
      fireLocationTransitionTriggers(scene);
      await Promise.resolve();
      expect(scene.ran).toEqual([]);

      scene.running = false;
      drainPendingLocationTransitions(scene);
      await Promise.resolve();
      expect(scene.ran).toEqual(["ev_enter"]);
    });

    it("한 사건에 두 이벤트가 반응하면 첫 이벤트가 대화를 열어도 두 번째가 살아남는다", async () => {
      const { project, mapId, plazaId } = projectWithPlaza();
      const map = project.maps[mapId]!;
      const trigger: Trigger = { kind: "locationTransition", locationId: plazaId, transition: "enter" };
      const scene = stubScene(map, [{ id: "ev_first", trigger }, { id: "ev_second", trigger }]);
      seedLocationOccupancyForScene(scene);
      // 첫 이벤트가 대화를 열어 running 을 세우는 상황을 흉내낸다.
      scene.runEvent = async (eventId) => {
        scene.ran.push(eventId);
        if (eventId === "ev_first") scene.running = true;
      };

      scene.tileX = 3;
      scene.tileY = 3;
      fireLocationTransitionTriggers(scene);
      await Promise.resolve();
      await Promise.resolve();
      expect(scene.ran).toEqual(["ev_first"]);

      scene.running = false;
      drainPendingLocationTransitions(scene);
      await Promise.resolve();
      // 이미 돌린 첫 이벤트가 다시 뽑히지 않는다 — 꼬리만 이어 간다.
      expect(scene.ran).toEqual(["ev_first", "ev_second"]);
    });

    it("기준선 심기는 이전 세션의 밀린 사건을 물려받지 않는다", async () => {
      const { project, mapId, plazaId } = projectWithPlaza();
      const map = project.maps[mapId]!;
      const scene = stubScene(map, [
        { id: "ev_enter", trigger: { kind: "locationTransition", locationId: plazaId, transition: "enter" } },
      ]);
      seedLocationOccupancyForScene(scene);
      scene.running = true;
      scene.tileX = 3;
      scene.tileY = 3;
      fireLocationTransitionTriggers(scene);
      await Promise.resolve();

      // 세이브 불러오기 = 새 기준선. 밀린 사건은 버려진다.
      scene.running = false;
      seedLocationOccupancyForScene(scene);
      drainPendingLocationTransitions(scene);
      await Promise.resolve();
      expect(scene.ran).toEqual([]);
    });
  });
});

describe("mapClone", () => {
  isolateTimers();
  describe("cloneGameMap", () => {
    it("copies authored map fields, not only tiles and events", () => {
      const source = createBlankMap("던전", 12, 10, COMBINED_TOWN_TILESET_ID);
      source.encounterRate = 8;
      source.troopIds = ["troop_slime"];
      source.bgm = { mode: "custom", resourceId: "bgm_cave" };
      source.disableSave = true;
      source.battleBackground = "bg_cave";
      source.events.push({
        id: "ev_old",
        x: 2,
        y: 3,
        trigger: { kind: "action" },
        commands: [{ kind: "transfer", mapId: source.id, x: 1, y: 1 }],
      });

      let n = 0;
      const copy = cloneGameMap(source, {
        newId: "map_copy",
        newName: "던전 복사",
        nextEventId: () => `ev_new_${n++}`,
      });

      expect(copy.id).toBe("map_copy");
      expect(copy.name).toBe("던전 복사");
      expect(copy.encounterRate).toBe(8);
      expect(copy.troopIds).toEqual(["troop_slime"]);
      expect(copy.bgm).toEqual({ mode: "custom", resourceId: "bgm_cave" });
      expect(copy.disableSave).toBe(true);
      expect(copy.battleBackground).toBe("bg_cave");
      expect(copy.events[0]?.id).toBe("ev_new_0");
      expect(copy.events[0]?.id).not.toBe("ev_old");
      expect(copy.events[0]?.commands[0]).toMatchObject({ kind: "transfer", mapId: "map_copy" });
      expect(source.events[0]?.id).toBe("ev_old");
    });
  });
});

describe("mapLayoutPlan", () => {
  isolateTimers();
  function bareMap(plan: MapLayoutPlan): GameMap {
    return {
      id: "m1",
      name: "t",
      width: 50,
      height: 50,
      tilesetId: "easyrpg_chipset_combined_town",
      tileSize: 16,
      lowerTiles: new Array(2500).fill(TILE.GRASS),
      upperTiles: new Array(2500).fill(TILE.EMPTY),
      events: [],
      layoutPlan: plan,
    };
  }
  describe("mapLayoutPlan", () => {
    const plan: MapLayoutPlan = {
      version: 1,
      kind: "test",
      seed: 1,
      regions: [
        {
          id: "house-blue",
          role: "house",
          label: "파랑 지붕 석벽 집 (ㄱ자)",
          x: 20,
          y: 20,
          w: 8,
          h: 8,
          kitId: "blue-stone",
          shape: "L",
          tags: ["house", "blue-stone", "centerish"],
        },
        {
          id: "market",
          role: "market",
          label: "중앙 상점(장터 데크)",
          x: 22,
          y: 16,
          w: 9,
          h: 8,
          tags: ["market", "shop", "centerish"],
        },
        {
          id: "forest",
          role: "forest",
          label: "동쪽 곡선 숲",
          x: 44,
          y: 12,
          w: 6,
          h: 32,
          tags: ["forest", "curved"],
        },
      ],
    };

    it("finds house by korean kit words", () => {
      const map = bareMap(plan);
      const hits = findLayoutRegions(map, "파란 집");
      expect(hits.some((r) => r.id === "house-blue")).toBe(true);
    });

    it("finds market by 상점", () => {
      const map = bareMap(plan);
      const hits = findLayoutRegions(map, "가운데 상점");
      expect(hits.some((r) => r.role === "market")).toBe(true);
    });

    it("ranks centerish regions nearer map center", () => {
      const map = bareMap(plan);
      const ranked = rankRegionsByCenter(map, plan.regions);
      expect(ranked[0]?.role === "house" || ranked[0]?.role === "market").toBe(true);
    });
  });
});

describe("mapLocationTools", () => {
  isolateTimers();
  const MAP_ID = "tool_loc_map";
  function context(layoutPlan?: MapLayoutPlan): ToolContext {
    const project: Project = createBlankProject();
    const map: GameMap = {
      id: MAP_ID,
      name: "툴 로케이션 맵",
      width: 24,
      height: 24,
      tilesetId: "easyrpg_chipset_combined_town",
      tileSize: 16,
      lowerTiles: new Array(24 * 24).fill(TILE.GRASS),
      upperTiles: new Array(24 * 24).fill(TILE.EMPTY),
      events: [],
      ...(layoutPlan ? { layoutPlan } : {}),
    };
    project.maps[MAP_ID] = map;
    return { project };
  }
  describe("assistant map-location tools", () => {
    it("registers the read and write tools with the expected modes", () => {
      expect(getTool("list_map_locations")?.mode).toBe("read");
      expect(getTool("resolve_map_location")?.mode).toBe("read");
      expect(getTool("create_map_location")?.mode).toBe("write");
      expect(getTool("update_map_location")?.mode).toBe("write");
      expect(getTool("delete_map_location")?.mode).toBe("write");
      expect(getTool("adopt_layout_regions")?.mode).toBe("write");
    });

    it("creates a location and lists it back without the user restating coordinates", () => {
      const ctx = context();
      const created = runTool(ctx, "create_map_location", {
        mapId: MAP_ID,
        name: "정문 광장",
        x: 4,
        y: 4,
        w: 6,
        h: 6,
        note: "성문 앞",
      });
      expect(created.ok, JSON.stringify(created.issues)).toBe(true);

      const listed = runTool(ctx, "list_map_locations", { mapId: MAP_ID });
      expect(listed.ok).toBe(true);
      const locations = (listed.data as { locations: { id: string; name: string; note?: string }[] }).locations;
      expect(locations).toHaveLength(1);
      expect(locations[0]).toMatchObject({ name: "정문 광장", x: 4, y: 4, w: 6, h: 6, note: "성문 앞" });
    });

    it("resolves by human name, by partial name and by point", () => {
      const ctx = context();
      runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
      runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "광장 안 좌판", x: 5, y: 5, w: 2, h: 2 });

      const byName = runTool(ctx, "resolve_map_location", { mapId: MAP_ID, query: "정문 광장" });
      expect(byName.ok).toBe(true);
      expect((byName.data as { location: { name: string } }).location.name).toBe("정문 광장");

      const byPoint = runTool(ctx, "resolve_map_location", { mapId: MAP_ID, x: 5, y: 5 });
      // 겹칠 때는 가장 구체적인(작은) 구역이 이긴다.
      expect((byPoint.data as { location: { name: string } }).location.name).toBe("광장 안 좌판");

      const miss = runTool(ctx, "resolve_map_location", { mapId: MAP_ID, query: "없는 곳" });
      expect(miss.ok).toBe(false);
    });

    it("renaming through the tool keeps the stable id so references survive", () => {
      const ctx = context();
      const created = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
      const id = (created.data as { location: { id: string } }).location.id;
      const renamed = runTool(ctx, "update_map_location", { mapId: MAP_ID, locationId: "정문 광장", name: "중앙 광장" });
      expect(renamed.ok, JSON.stringify(renamed.issues)).toBe(true);
      expect((renamed.data as { location: { id: string; name: string } }).location).toMatchObject({ id, name: "중앙 광장" });
    });

    it("refuses to delete a referenced location unless the caller states a repair plan", () => {
      const ctx = context();
      const created = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
      const id = (created.data as { location: { id: string } }).location.id;
      ctx.project.maps[MAP_ID].encounterTable = [{ troopId: "troop_slime", weight: 1, conditions: { locationId: id } }];

      const refused = runTool(ctx, "delete_map_location", { mapId: MAP_ID, locationId: id });
      expect(refused.ok).toBe(false);
      expect(JSON.stringify(refused.issues)).toContain("brokenReferences");
      // 거부된 호출은 아무것도 바꾸지 않는다.
      expect(mapLocations(ctx.project.maps[MAP_ID])).toHaveLength(1);
      expect(ctx.project.maps[MAP_ID].encounterTable?.[0]?.conditions?.locationId).toBe(id);
    });

    it("deletes with detach and leaves the encounter intact but unrestricted", () => {
      const ctx = context();
      const created = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
      const id = (created.data as { location: { id: string } }).location.id;
      ctx.project.maps[MAP_ID].encounterTable = [{ troopId: "troop_slime", weight: 1, conditions: { locationId: id } }];

      const deleted = runTool(ctx, "delete_map_location", { mapId: MAP_ID, locationId: id, brokenReferences: "detach" });
      expect(deleted.ok, JSON.stringify(deleted.issues)).toBe(true);
      expect((deleted.data as { repaired: number }).repaired).toBe(1);
      expect(mapLocations(ctx.project.maps[MAP_ID])).toHaveLength(0);
      expect(ctx.project.maps[MAP_ID].encounterTable?.[0]?.conditions).toBeUndefined();
    });

    it("deletes with freezeRect and demotes the encounter to the legacy raw rectangle", () => {
      const ctx = context();
      const created = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
      const id = (created.data as { location: { id: string } }).location.id;
      ctx.project.maps[MAP_ID].encounterTable = [{ troopId: "troop_slime", weight: 1, conditions: { locationId: id } }];

      const deleted = runTool(ctx, "delete_map_location", { mapId: MAP_ID, locationId: id, brokenReferences: "freezeRect" });
      expect(deleted.ok, JSON.stringify(deleted.issues)).toBe(true);
      expect(ctx.project.maps[MAP_ID].encounterTable?.[0]?.conditions).toEqual({ region: { x: 4, y: 4, w: 6, h: 6 } });
    });

    it("deletes with remap and repoints the encounter at another location", () => {
      const ctx = context();
      const created = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
      const other = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "북쪽 숲", x: 14, y: 2, w: 6, h: 6 });
      const id = (created.data as { location: { id: string } }).location.id;
      const otherId = (other.data as { location: { id: string } }).location.id;
      ctx.project.maps[MAP_ID].encounterTable = [{ troopId: "troop_slime", weight: 1, conditions: { locationId: id } }];

      const deleted = runTool(ctx, "delete_map_location", {
        mapId: MAP_ID,
        locationId: id,
        brokenReferences: "remap",
        replacementLocationId: otherId,
      });
      expect(deleted.ok, JSON.stringify(deleted.issues)).toBe(true);
      expect(ctx.project.maps[MAP_ID].encounterTable?.[0]?.conditions?.locationId).toBe(otherId);
    });

    it("deletes an unreferenced location outright", () => {
      const ctx = context();
      const created = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
      const id = (created.data as { location: { id: string } }).location.id;
      const deleted = runTool(ctx, "delete_map_location", { mapId: MAP_ID, locationId: id });
      expect(deleted.ok, JSON.stringify(deleted.issues)).toBe(true);
      expect(mapLocations(ctx.project.maps[MAP_ID])).toHaveLength(0);
    });

    it("adopt_layout_regions copies builder regions and leaves layoutPlan byte-identical", () => {
      const plan: MapLayoutPlan = {
        version: 1,
        kind: "village-harness-natural-v2",
        regions: [
          { id: "house-a", role: "house", label: "파랑 지붕 집", x: 2, y: 2, w: 4, h: 4 },
          { id: "market-a", role: "market", label: "중앙 시장", x: 9, y: 9, w: 5, h: 5 },
        ],
      };
      const ctx = context(structuredClone(plan));
      const first = runTool(ctx, "adopt_layout_regions", { mapId: MAP_ID, roles: ["house"] });
      expect(first.ok, JSON.stringify(first.issues)).toBe(true);
      expect(mapLocations(ctx.project.maps[MAP_ID]).map((entry) => entry.name)).toEqual(["파랑 지붕 집"]);
      expect(ctx.project.maps[MAP_ID].layoutPlan).toEqual(plan);

      const again = runTool(ctx, "adopt_layout_regions", { mapId: MAP_ID, roles: ["house"] });
      expect(again.ok).toBe(true);
      // 건너뛴 이유가 세 갈래(이미 승격 / 이름 충돌 / 재시공 재바인딩)로 갈라졌으므로 이유별로 센다.
      const skipped = (again.data as { skippedAlreadyAdopted: { regionId: string }[] }).skippedAlreadyAdopted;
      expect(skipped.map((entry) => entry.regionId)).toEqual(["house-a"]);
      expect(mapLocations(ctx.project.maps[MAP_ID])).toHaveLength(1);
    });

    it("adopt_layout_regions defaults to commons roles, not to every builder region", () => {
      const plan: MapLayoutPlan = {
        version: 1,
        kind: "village-harness-natural-v2",
        regions: [
          { id: "house-a", role: "house", label: "파랑 지붕 집", x: 2, y: 2, w: 4, h: 4 },
          { id: "market-a", role: "market", label: "중앙 시장", x: 9, y: 9, w: 5, h: 5 },
        ],
      };
      const ctx = context(structuredClone(plan));
      // roles 를 생략하면 "전부"가 아니다 — 집 롯은 사람이 명시적으로 켜야만 들어온다.
      const result = runTool(ctx, "adopt_layout_regions", { mapId: MAP_ID });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(mapLocations(ctx.project.maps[MAP_ID]).map((entry) => entry.name)).toEqual(["중앙 시장"]);
    });

    it("survey_layout_adoption counts candidates without changing anything", () => {
      const plan: MapLayoutPlan = {
        version: 1,
        kind: "village-harness-natural-v2",
        regions: [
          { id: "house-a", role: "house", label: "파랑 지붕 집", x: 2, y: 2, w: 4, h: 4 },
          { id: "market-a", role: "market", label: "중앙 시장", x: 9, y: 9, w: 5, h: 5 },
        ],
      };
      const ctx = context(structuredClone(plan));
      const before = JSON.stringify(ctx.project);
      const result = runTool(ctx, "survey_layout_adoption", {});
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect((result.data as { totalAdoptable: number }).totalAdoptable).toBe(1);
      expect(JSON.stringify(ctx.project)).toBe(before);
    });

    it("adopt_layout_regions refuses a map that was not produced by the builder", () => {
      const ctx = context();
      const result = runTool(ctx, "adopt_layout_regions", { mapId: MAP_ID });
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result.issues)).toContain("layoutPlan");
    });

    it("find_layout_regions still only sees builder regions, not the human layer", () => {
      const plan: MapLayoutPlan = {
        version: 1,
        kind: "village-harness-natural-v2",
        regions: [{ id: "market-a", role: "market", label: "중앙 시장", x: 9, y: 9, w: 5, h: 5 }],
      };
      const ctx = context(structuredClone(plan));
      runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "사람이 그린 구역", x: 1, y: 1, w: 3, h: 3 });
      const found = runTool(ctx, "find_layout_regions", { mapId: MAP_ID, query: "시장" });
      const regions = (found.data as { regions: { label: string }[] }).regions;
      expect(regions.map((region) => region.label)).toEqual(["중앙 시장"]);
    });
  });
});

// 맵→맵(=칩셋→칩셋) 도달성 도구의 계약과, 《천공의 계단》에 대한 실제 적용.
//
// 이 도구가 필요했던 이유: projectLint 는 transfer 의 **목적지**만 보고, 완주 시나리오는
// 이벤트를 **id 로 호출**한다. 그래서 "관문이 벽 위에 놓여 영원히 밟을 수 없다"는 결함을
// 둘 다 놓쳤다(실측 6건, 게임이 완주 불가였다). 이 테스트는 실제 통행 판정으로 걸어서 확인한다.
describe("mapTravelReachability", () => {
  isolateTimers();
  describe("도달성 도구의 계약", () => {
    /** 두 칸 맵 두 개를 관문 하나로 이은 최소 프로젝트. 관문 칸의 통행성을 바꿔 가며 검사한다. */
    function twoMapProject(gateTile: number): Project {
      // The combined-town sheet left defaultTilesets() in the 2026-10-07 copyright purge; build its retired definition.
      const tileset = retiredEasyRpgTileset(COMBINED_TOWN_TILESET_ID);
      const makeMap = (id: string, gateAt: { x: number; y: number } | null, target?: string): GameMap => {
        const width = 4;
        const height = 3;
        const map: GameMap = {
          id,
          name: id,
          width,
          height,
          tilesetId: COMBINED_TOWN_TILESET_ID,
          tileSize: 16,
          lowerTiles: new Array<number>(width * height).fill(240), // 잔디 = 통행 가능
          upperTiles: new Array<number>(width * height).fill(-1),
          events: [],
        } as GameMap;
        if (gateAt && target) {
          map.lowerTiles[gateAt.y * width + gateAt.x] = gateTile;
          map.events.push({
            id: `gate_${id}`,
            x: gateAt.x,
            y: gateAt.y,
            pages: [{
              id: "p",
              name: "관문",
              conditions: [],
              graphic: { transparent: true },
              trigger: "touch",
              priority: "below",
              movement: { type: "fixed", speed: 3, frequency: 3 },
              commands: [{ kind: "transfer", mapId: target, x: 1, y: 1 }],
            }],
          } as never);
        }
        return map;
      };
      return {
        maps: {
          map_a: makeMap("map_a", { x: 3, y: 1 }, "map_b"),
          map_b: makeMap("map_b", null),
        },
        tilesets: { [COMBINED_TOWN_TILESET_ID]: tileset },
      } as unknown as Project;
    }

    it("관문 칸이 통행 가능하면 건너간다", () => {
      const project = twoMapProject(240); // 잔디
      const result = canTravelBetweenMaps(project, { mapId: "map_a", x: 0, y: 1 }, "map_b");
      expect(result.reachable, "잔디 위 관문인데 못 건넜다").toBe(true);
      expect(result.hops).toHaveLength(1);
      expect(result.hops[0]?.toMapId).toBe("map_b");
    });

    it("관문이 통행 불가 타일 위에 있으면 도달 실패로 잡고 그 이유를 말한다", () => {
      // 342 는 이름이 TILE.FLOOR 인데 전방향 통행 불가다(constants.ts 경고 참조).
      const project = twoMapProject(342);
      const result = canTravelBetweenMaps(project, { mapId: "map_a", x: 0, y: 1 }, "map_b");
      expect(result.reachable).toBe(false);
      expect(result.unreachableGates).toHaveLength(1);
      expect(result.unreachableGates[0]?.reason).toBe("통행 불가 타일");
      expect(result.unreachableGates[0]?.eventId).toBe("gate_map_a");
    });

    it("스위치로 잠긴 관문은 스위치를 켜야 열린다", () => {
      const project = twoMapProject(240);
      const gate = project.maps.map_a!.events[0]!;
      const base = (gate.pages ?? [])[0]!;
      // 페이지 순서 규약: 일반 → 구체. 뒤 페이지가 이기므로 조건 있는 페이지를 뒤에 둔다.
      const openPage = { ...base, id: "open", conditions: [{ kind: "switch", switchId: "sw_gate", value: true }] };
      gate.pages = [{ ...base, id: "closed", commands: [] }, openPage as never];

      expect(canTravelBetweenMaps(project, { mapId: "map_a", x: 0, y: 1 }, "map_b").reachable).toBe(false);
      expect(
        canTravelBetweenMaps(project, { mapId: "map_a", x: 0, y: 1 }, "map_b", { openSwitches: ["sw_gate"] }).reachable,
        "스위치를 켰는데도 관문이 열리지 않았다"
      ).toBe(true);
      expect(
        canTravelBetweenMaps(project, { mapId: "map_a", x: 0, y: 1 }, "map_b", { ignoreSwitches: true }).reachable,
        "ignoreSwitches 는 지형만 보게 하는 옵션이다"
      ).toBe(true);
    });

    it("firstStandableCell 은 나갈 수 있는 칸을 고른다", () => {
      const project = twoMapProject(240);
      const map = project.maps.map_a!;
      const cell = firstStandableCell(project, map)!;
      const canLeave = canMove(project, map, cell.x, cell.y, cell.x + 1, cell.y)
        || canMove(project, map, cell.x, cell.y, cell.x - 1, cell.y)
        || canMove(project, map, cell.x, cell.y, cell.x, cell.y + 1)
        || canMove(project, map, cell.x, cell.y, cell.x, cell.y - 1);
      expect(canLeave).toBe(true);
    });
  });
});
