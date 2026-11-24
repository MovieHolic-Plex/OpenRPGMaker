import { describe, expect, it, beforeEach } from "vitest";
import { GENRE_PACK_IDS, createGenreBlankProjectSystemPresetPlan, createProjectFromGenreBlankProjectSystemPreset, genrePackById, materializeGenreBlankProjectSystemPreset } from "@/editor/genrePacks";
import { WELCOME_GENRE_PRESETS, welcomeGenrePresetById, welcomeGenreSystemPresetPlanById } from "@/editor/welcomeGenrePresets";
import { createBlankProject } from "@/project/defaults";
import { isGenrePackId } from "@/project/genrePackId";
import { buildConceptEvents } from "@/editor/interiorConceptEvents";
import { type ConceptPlacement, composeConceptRoom } from "@/editor/interiorConceptCompose";
import { createEmptyRoomMap, INTERIOR_ROOM_THEME_CATALOG, INTERIOR_ROOM_THEMES, INTERIOR_SEMANTIC_TILE_CATALOG, VR, type InteriorSemanticTileRole, INTERIOR_ROOM_DEMO_PLANS, runInteriorRoomPipeline, evaluateInteriorRoom, type InteriorRoomPlan } from "@/editor/interiorRoomPipeline";
import { INTERIOR_OBJECT_CATALOG, interiorObjectById, interiorObjectsForTheme, type InteriorObjectDef } from "@/editor/interiorObjectCatalog";
import { deserialize, serialize } from "@/project/io";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { LOCATION_DOUBLE_CLICK_MS, LOCATION_OPEN_EVENT_CLICK_COUNT, locationClickCount, resolveLocationOverlapPointer } from "@/editor/locationPointerPriority";
import { editorState, type TileClipboard } from "@/editor/editorState";
import { redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { clearSelectionRegion, copySelection, pasteClipboard, selectTileRegion } from "@/editor/mapClipboard";
import { pasteGhostLiftSteps, pasteStampLiftField, pasteGhostPieces } from "@/editor/pastePreviewGhost";
import type { ReliefData } from "@/project/relief/types";
import { store } from "@/project/store";
import type { GameMap, MapId, TilesetDef, Project } from "@/project/types";
import { drawMapTileLayers, type TilesetCanvasImage } from "@/editor/mapTileDraw";
import { mapTreeDropRelation } from "@/editor/mapTreeDrop";
import { listDatabaseResourceOptions, type DatabaseResourcePickerKind } from "@/editor/resourceOptions";
import { isolateTimers } from "./mergedTeardown";

describe("genrePackRegistry", () => {
  isolateTimers();
  describe("genre pack registry contract", () => {
    it("all official packs expose complete machine-readable guidance", () => {
      expect(GENRE_PACK_IDS).toEqual([
        "adventure-jrpg",
        "monster-collect",
        "horror-chase",
        "story-cutscene",
        "farm-life",
        "action-rpg",
      ]);

      for (const packId of GENRE_PACK_IDS) {
        const pack = genrePackById(packId);
        expect(pack.id).toBe(packId);
        expect(pack.starter.defaultRecipeId).toBeTruthy();
        expect(pack.navigation.sections.length).toBeGreaterThan(0);
        expect(Object.keys(pack.vocabulary).length).toBeGreaterThan(0);
        expect(pack.recipes.length).toBeGreaterThan(0);
        expect(pack.recipes.every((recipe) => recipe.appliesSystemFields.length > 0)).toBe(true);
        expect(pack.lint.length).toBeGreaterThan(0);
        expect(pack.journeys.length).toBeGreaterThan(0);
        expect(pack.runtimeRequirements.length).toBeGreaterThan(0);
        expect(pack.recipes.some((recipe) => recipe.id === pack.starter.defaultRecipeId)).toBe(true);
      }
    });

    it("BREAK: every welcome card resolves to a real pack recipe without AI", () => {
      expect(WELCOME_GENRE_PRESETS).toHaveLength(8);
      for (const preset of WELCOME_GENRE_PRESETS) {
        const pack = genrePackById(preset.packId);
        expect(pack.recipes.some((recipe) => recipe.id === preset.systemPresetRecipeId)).toBe(true);
        expect(welcomeGenreSystemPresetPlanById(preset.id)).toMatchObject({
          kind: "blank-project-system-preset",
          packId: preset.packId,
          recipeId: preset.systemPresetRecipeId,
          projectSchema: "Project",
          preservesOpenProjectUntilRemoteVerified: true,
          aiRequired: false,
        });
      }
    });

    it("BREAK: planning and materializing a starter is detached from an open project", () => {
      const openProject = createBlankProject();
      openProject.meta.title = "keep me";
      const before = structuredClone(openProject);

      const plan = createGenreBlankProjectSystemPresetPlan("farm-life", "farm-system");
      const starter = createProjectFromGenreBlankProjectSystemPreset(plan);

      expect(openProject).toEqual(before);
      expect(starter).not.toBe(openProject);
      expect(starter.system.genre).toBe("farm-life");
      expect(starter.system.timeSystem?.enabled).toBe(true);
      expect(starter.database.crops).toHaveLength(createBlankProject().database.crops?.length ?? 0);
      expect(starter.maps).toEqual(createBlankProject().maps);
    });

    it("BREAK: welcome choices are honestly blank-project system presets, not authored starters", () => {
      const results = WELCOME_GENRE_PRESETS.map((preset) =>
        materializeGenreBlankProjectSystemPreset(welcomeGenreSystemPresetPlanById(preset.id)),
      );
      const blank = createBlankProject();

      for (const packId of GENRE_PACK_IDS) {
        for (const recipe of genrePackById(packId).recipes) {
          expect(recipe.starterKind).toBe("blank-project-system-preset");
          expect(recipe).not.toHaveProperty("adapterId");
        }
      }
      for (const { project, receipt } of results) {
        expect(receipt.authoredContentSeeded).toBe(false);
        expect(receipt.appliedSystemGenre).toBe(project.system.genre);
        // 몬스터 수집만 손대지 않은 빈 시작 맵을 몬스터 칩셋 풀밭으로 옮긴다(칩셋 계열을 첫 맵에서 정한다).
        if (project.system.genre === "monster-collect") {
          const start = project.maps.map_blank_start!;
          expect(start.tilesetId).toBe("monster_overworld");
          expect(start.lowerTiles.every((tile) => tile === 0)).toBe(true);
          expect({ ...start, tilesetId: blank.maps.map_blank_start!.tilesetId, tileSize: blank.maps.map_blank_start!.tileSize, lowerTiles: blank.maps.map_blank_start!.lowerTiles })
            .toEqual(blank.maps.map_blank_start);
        } else expect(project.maps).toEqual(blank.maps);
        expect(project.database.crops).toEqual(blank.database.crops);
      }
    });

    it("BREAK: Phase 4 imports the five canonical ids; welcome recipe ids are not genre aliases", () => {
      expect(isGenrePackId("horror-chase")).toBe(true);
      expect(isGenrePackId("horror-gallery")).toBe(false);
      expect(isGenrePackId("school-horror")).toBe(false);
      expect(welcomeGenrePresetById("horror-gallery")?.packId).toBe("horror-chase");
      expect(welcomeGenrePresetById("school-horror")?.packId).toBe("horror-chase");
    });
  });
});

describe("interiorEventApproach", () => {
  isolateTimers();
  describe('generated interior furniture interaction', () => {
    it('moves an inaccessible bottom-center event onto the reachable side of the same table', () => {
      const map=createEmptyRoomMap({mapId:'side-table',name:'side-table',width:8,height:8,seed:1,theme:'dining',door:{x:1,y:5}});
      const cells=Array.from({length:9},(_,i)=>({x:3+i%3,y:3+Math.floor(i/3),layer:'lower' as const,tile:156+i}));
      for(const c of cells)map.lowerTiles[c.y*8+c.x]=c.tile;
      const placement={objectId:'table_wood',thingId:'stock-display',label:'진열대',roomId:'shop',anchor:{x:4,y:5},cells,chips:['event'],required:true} as ConceptPlacement;
      const result=buildConceptEvents(map,[placement],{door:{x:1,y:5},reachableCells:new Set([5*8+2])});
      expect(result.warnings).toEqual([]);
      expect(result.events.map(e=>({x:e.x,y:e.y}))).toEqual([{x:3,y:5}]);
      expect(cells.some(c=>c.x===result.events[0]!.x&&c.y===result.events[0]!.y)).toBe(true);
      // Without a generated access mask, canonical fixed anchors are not relocated.
      expect(buildConceptEvents(map,[placement],{door:{x:1,y:5}}).events[0]!.x).toBe(4);
    });
    it('lets the stove base own interaction with a cauldron on its overlapping top', () => {
      const map=createEmptyRoomMap({mapId:'pot',name:'pot',width:8,height:8,seed:1,theme:'kitchen',door:{x:1,y:5}});
      map.lowerTiles[3*8+3]=21; map.lowerTiles[4*8+3]=51; map.upperTiles[3*8+3]=323;
      const placement={objectId:'cauldron',thingId:'pot',label:'솥',roomId:'kitchen',anchor:{x:3,y:3},cells:[{x:3,y:3,layer:'upper',tile:323}],chips:['event'],required:true} as ConceptPlacement;
      const built=buildConceptEvents(map,[placement],{door:{x:1,y:5},reachableCells:new Set([4*8+2])});
      expect(built.warnings).toEqual([]);
      expect(built.events.map(e=>({x:e.x,y:e.y}))).toEqual([{x:3,y:4}]);
      expect(map.upperTiles[3*8+3]).toBe(323);
    });

  });
});

// interiorObjectCatalog.test.ts
// 실내 오브젝트 카탈로그(선언형 어휘)의 형태 계약 — 셀 좌표·역할 타일·테마 커버리지·id 규약.
// 렌더러(kitRender)의 셀 규약 {dx,dy,layer,tile}과 구조가 같아야 '구조물' DB 탭이 그대로 그린다.
describe("interiorObjectCatalog", () => {
  isolateTimers();
  /**
   * 역할 타일 세트 밖이지만 그 오브젝트가 정당하게 선언하는 타일:
   * - bookshelf 3×3의 가운데 열(19/49/79)은 가로로 반복되는 '몸통'.
   * - table_chairs의 의자(297/298)는 사각 탁자 짝 규칙의 동반 타일.
   */
  const DECLARED_COMPANION_TILES: Readonly<Record<string, readonly number[]>> = {
    bookshelf: [19, 49, 79],
    table_chairs: [VR.CHAIR_LEFT, VR.CHAIR_RIGHT],
    study_desk: [VR.STOOL],
    care_bed: [VR.STOOL],
    table_wood: [156,157,158,186,187,188,198,199,200],
    table_white: [159,160,161,189,190,191,228,229,230],
    tea_table: [156,157,158,186,187,188,198,199,200,235,204,297,298],
    reading_table: [156,157,158,186,187,188,198,199,200,145,204,297,298],
    dining_table: [156,157,158,186,187,188,198,199,200,207,238,208,297,298],
    consultation_table: [159,160,161,189,190,191,228,229,230,145,204,297,298],
    altar_table: [159,160,161,189,190,191,228,229,230,204],
    work_table: [156,157,158,186,187,188,198,199,200,261,414],
    teacher_desk: [156,157,158,198,199,200,145],
    // 작은 집 탁자(home_table) — 목재 탁자 위·아래 줄 + 양옆 의자(297·298)·촛대(204)·책(145). 카탈로그에 뒤에 더해진 정의다.
    home_table: [156,157,158,198,199,200,145,204,297,298],
  };
  const cellKey = (cell: { dx: number; dy: number; layer: string }): string =>
    `${cell.dx},${cell.dy},${cell.layer}`;
  describe("INTERIOR_OBJECT_CATALOG 형태 계약", () => {
    it("카탈로그가 비어 있지 않다", () => {
      expect(INTERIOR_OBJECT_CATALOG.length).toBeGreaterThan(0);
    });

    it("모든 정의의 셀이 width×height 격자 안에 중복 없이 들어간다", () => {
      for (const def of INTERIOR_OBJECT_CATALOG) {
        expect(def.cells.length, `${def.id} cells`).toBeGreaterThan(0);
        expect(def.width, `${def.id} width`).toBeGreaterThan(0);
        expect(def.height, `${def.id} height`).toBeGreaterThan(0);
        expect(def.cells.length, `${def.id} 셀 수 ≤ width*height`).toBeLessThanOrEqual(def.width * def.height * 2);
        const seen = new Set<string>();
        for (const cell of def.cells) {
          expect(cell.dx, `${def.id} dx`).toBeGreaterThanOrEqual(0);
          expect(cell.dx, `${def.id} dx`).toBeLessThan(def.width);
          expect(cell.dy, `${def.id} dy`).toBeGreaterThanOrEqual(0);
          expect(cell.dy, `${def.id} dy`).toBeLessThan(def.height);
          expect(cell.tile, `${def.id} tile`).toBeGreaterThanOrEqual(0);
          expect(["lower", "upper"]).toContain(cell.layer);
          const key = cellKey(cell);
          expect(seen.has(key), `${def.id} 중복 셀 ${key}`).toBe(false);
          seen.add(key);
        }
      }
    });

    it("id는 유일하고 소문자+밑줄 규약을 지킨다", () => {
      const ids = INTERIOR_OBJECT_CATALOG.map((def) => def.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        expect(id.length, `${id} 비어 있지 않은 id`).toBeGreaterThan(0);
        expect(id, `${id} 소문자+밑줄`).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    });

    it("모든 정의에 한국어 라벨과 유효한 스냅·레이어가 있다", () => {
      for (const def of INTERIOR_OBJECT_CATALOG) {
        expect(def.label.trim().length, `${def.id} label`).toBeGreaterThan(0);
        expect(["wall-north", "wall-any", "floor", "free"]).toContain(def.snap);
        expect(["lower", "upper"]).toContain(def.layer);
        for (const theme of def.themes) expect(INTERIOR_ROOM_THEMES).toContain(theme);
      }
    });

    it("role이 있는 정의의 타일은 역할 타일 세트 ∪ 선언된 동반 타일의 부분집합이다", () => {
      for (const def of INTERIOR_OBJECT_CATALOG) {
        if (def.role === null) continue;
        const allowed = new Set<number>([
          ...INTERIOR_SEMANTIC_TILE_CATALOG[def.role].tileIds,
          ...(DECLARED_COMPANION_TILES[def.id] ?? []),
        ]);
        for (const cell of def.cells) {
          expect(allowed.has(cell.tile), `${def.id} 타일 ${cell.tile}이 role=${def.role} 어휘 밖`).toBe(true);
        }
      }
    });

    it("역할별 타일 세트의 모든 타일이 그 역할 오브젝트 어딘가에 등장한다", () => {
      const roles = Object.keys(INTERIOR_SEMANTIC_TILE_CATALOG) as InteriorSemanticTileRole[];
      for (const role of roles) {
        const covered = new Set<number>();
        for (const def of INTERIOR_OBJECT_CATALOG) {
          if (def.role !== role) continue;
          for (const cell of def.cells) covered.add(cell.tile);
        }
        for (const tile of INTERIOR_SEMANTIC_TILE_CATALOG[role].tileIds) {
          expect(covered.has(tile), `role=${role} 타일 ${tile} 미커버`).toBe(true);
        }
      }
    });

    it("requiredRoles가 있는 테마마다 필수 역할 오브젝트가 최소 1개 있다", () => {
      for (const theme of INTERIOR_ROOM_THEMES) {
        const required = INTERIOR_ROOM_THEME_CATALOG[theme].requiredRoles;
        if (required.length === 0) continue;
        const forTheme = interiorObjectsForTheme(theme);
        for (const role of required) {
          const match = forTheme.filter((def: InteriorObjectDef) => def.role === role);
          expect(match.length, `theme=${theme} role=${role} 오브젝트 없음`).toBeGreaterThan(0);
        }
      }
    });

    it("interiorObjectsForTheme는 해당 테마를 선언한 정의만 돌려준다", () => {
      for (const theme of INTERIOR_ROOM_THEMES) {
        for (const def of interiorObjectsForTheme(theme)) {
          expect(def.themes, `${def.id} themes`).toContain(theme);
        }
      }
    });

    it("interiorObjectById는 id로 정의를 찾고 없는 id에는 undefined를 준다", () => {
      for (const def of INTERIOR_OBJECT_CATALOG) {
        expect(interiorObjectById(def.id)).toBe(def);
      }
      expect(interiorObjectById("no_such_object")).toBeUndefined();
    });

    it("파이프라인이 소비하는 다중 타일 세트가 카탈로그에 선언되어 있다", () => {
      const expected: Readonly<Record<string, readonly number[]>> = {
        bed_h: [VR.BED_L, VR.BED_R],
        bed_v: [VR.BED_V_HEAD, VR.BED_V_FOOT],
        stove: [VR.STOVE_TOP, VR.STOVE_BOT],
        table_long: [VR.TABLE_L, VR.TABLE_R, VR.TABLE_R3],
        counter: [VR.COUNTER_L, VR.COUNTER_M, VR.COUNTER_R],
        piano: [VR.PIANO_L, VR.PIANO_M, VR.PIANO_R],
        bookshelf: [VR.BOOK_TL, 19, VR.BOOK_TR, VR.BOOK_ML, 49, VR.BOOK_MR, VR.BOOK_BL, 79, VR.BOOK_BR],
      };
      for (const [id, tiles] of Object.entries(expected)) {
        const def = interiorObjectById(id);
        expect(def, `${id} 정의 없음`).toBeDefined();
        expect(def!.cells.map((cell) => cell.tile)).toEqual(tiles);
      }
    });
  });
});

describe("interiorRoomWalkabilitySeal", () => {
  isolateTimers();
  // 책장(2x3) lower 타일 id — placeBookshelfRow가 setL로 찍는 세트.
  const BOOKSHELF_TILES = new Set(interiorObjectById("bookshelf")!.cells.filter((cell) => cell.layer === "lower").map((cell) => cell.tile));
  // 봉쇄 재현 플랜(측정 RED 스크립트 scripts/tmp-probe-seal.mts와 동일).
  // study 방의 유일 입구 열(innerDoor x=6)에 책장이 놓여 방이 봉쇄된다.
  const SEAL_PLAN: InteriorRoomPlan = {
    mapId: "map_probe_seal_v1", name: "probe", width: 16, height: 22,
    wings: [], door: { x: 8, y: 8 }, theme: "study", seed: 7,
    rooms: [
      { id: "corridor", x: 3, y: 4, w: 10, h: 4, theme: "corridor" },
      { id: "study", x: 3, y: 11, w: 8, h: 6, theme: "study" },
    ],
    innerDoors: [{ x: 6, y: 8 }],
  };
  /**
   * 도달 불가 개방 셀은 평가기(evaluateInteriorRoom)가 파이프라인과 같은 정의로 이미 센다.
   * 테스트가 자체 정의를 다시 쓰면 TILE.EMPTY(-1) 같은 상수를 틀려 '항상 0'인 공허한 단정이 된다
   * (실측: upper !== 0 비교로 개방 셀 0개가 나와 RED에서도 통과했다). 관측자는 평가기로 고정한다.
   */
  function walkabilityIssues(
    map: Parameters<typeof evaluateInteriorRoom>[0],
    plan: InteriorRoomPlan,
  ): { issues: string[]; score: number; unreachableOpenCells: number } {
    const ev = evaluateInteriorRoom(map, plan);
    return {
      issues: ev.issues.filter((s) => /도달 불가/.test(s)),
      score: ev.score,
      unreachableOpenCells: ev.metrics.unreachableOpenCells,
    };
  }
  describe("interior room walkability sealing (entry sentinel / lower multi-tile set repair)", () => {
    it("D1: bookshelf must never sit on an innerDoor entry column, and every open cell stays reachable", () => {
      // 결함 1: paintRoomSpace는 입구 열을 upper ENTRY_SENTINEL로 점유하지만,
      // placeBookshelfRow는 LOWER에 찍으며 upper 센티널을 보지 못해 책장이 입구 열을 덮는다.
      const plan = SEAL_PLAN;
      const built = runInteriorRoomPipeline(plan);
      const map = built.map;
      const w = map.width;
      const at = (x: number, y: number) => map.lowerTiles[y * w + x]!;

      // (a) innerDoor 열 x=6 중 통로 행(11..13) 어디에도 책장 타일이 없어야 한다.
      const bookOnEntry: string[] = [];
      for (let y = plan.innerDoors![0]!.y + 3; y <= plan.innerDoors![0]!.y + 5; y += 1) {
        if (BOOKSHELF_TILES.has(at(plan.innerDoors![0]!.x, y))) bookOnEntry.push(`(${plan.innerDoors![0]!.x},${y})=${at(plan.innerDoors![0]!.x, y)}`);
      }
      expect(bookOnEntry, `책장이 입구 열을 덮음: ${bookOnEntry.join(", ")}`).toEqual([]);

      // (b) 평가기가 세는 '도달 불가 개방 셀'이 0이어야 한다(RED에서는 29개였다).
      const walk = walkabilityIssues(map, plan);
      expect(walk.issues, `평가기 도달 불가 이슈: ${walk.issues.join(" | ")}`).toEqual([]);
      expect(walk.unreachableOpenCells, "평가기 metrics.unreachableOpenCells").toBe(0);
      expect(walk.score, "평가 점수").toBeGreaterThanOrEqual(85);

      // (c) 봉쇄 없이 시공 성공해야 한다.
      expect(built.ok).toBe(true);

      // (d) 수리 불가 경고가 없어야 한다 — 멀티타일 세트가 길을 막으면 안 된다.
      const sealWarnings = built.warnings.filter((s) => /제거 가능한 소품 없음/.test(s));
      expect(sealWarnings, `봉쇄 경고: ${sealWarnings.join(" | ")}`).toEqual([]);
    });

    it("D2: no demo plan (and no measured-seal plan) may end unrepaired behind a lower multi-tile set", () => {
      // 결함 2: enforceWalkability는 REMOVABLE_SINGLE_PROPS(getU=upper 단일 소품)만 걷어낸다.
      // LOWER에 찍힌 2x3 세트(책장/스토브/카운터)가 유일한 길을 막으면 되돌릴 수 없어
      // "제거 가능한 소품 없음" 경고와 함께 ok=false로 끝난다.
      const plans: readonly InteriorRoomPlan[] = [...INTERIOR_ROOM_DEMO_PLANS, SEAL_PLAN];
      for (const plan of plans) {
        const built = runInteriorRoomPipeline(plan);
        const sealWarnings = built.warnings.filter((s) => /제거 가능한 소품 없음/.test(s));
        expect(sealWarnings, `plan ${plan.mapId}: 봉쇄 경고 ${sealWarnings.join(" | ")}`).toEqual([]);
        expect(built.ok, `plan ${plan.mapId}: ok=false, warnings=${built.warnings.join(" | ")}`).toBe(true);
      }
    });
  });
  it("furnishing another map cannot carry its rollback journal into the next build", () => {
    const first = runInteriorRoomPipeline(SEAL_PLAN);
    runInteriorRoomPipeline(INTERIOR_ROOM_DEMO_PLANS.find((plan) => plan.theme === "kitchen") ?? INTERIOR_ROOM_DEMO_PLANS[0]!);
    const again = runInteriorRoomPipeline(SEAL_PLAN);
    expect(again.map.lowerTiles).toEqual(first.map.lowerTiles);
    expect(again.map.upperTiles).toEqual(first.map.upperTiles);
    expect(again.warnings).toEqual(first.warnings);
  });
  it("the L-shaped study keeps its eastern pocket open behind the shelf", () => {
    // Before repair this actual pipeline plan had 9 unreachable open cells behind the 2×3 shelf.
    // 지금 파이프라인은 그 자리에 책장을 다시 세우되 주머니(x 11~13, y 9~11)를 막지 않는다 — 옛 「책장 여섯 칸을 바닥으로 되돌린다」 대신
    // 주머니가 바닥으로 열려 있고 닿지 못하는 칸이 없는지를 본다(봉쇄 회귀의 실제 계약).
    const plan = INTERIOR_ROOM_DEMO_PLANS.find((plan) => plan.theme === "study")!;
    const built = runInteriorRoomPipeline(plan);
    for (let y = 9; y <= 11; y += 1) {
      for (let x = 11; x <= 13; x += 1) {
        expect(built.map.lowerTiles[y * plan.width + x], `pocket cell ${x},${y}`).toBe(VR.FLOOR);
      }
    }
    expect(evaluateInteriorRoom(built.map, plan).metrics.unreachableOpenCells).toBe(0);
    expect(built.warnings.filter((warning) => warning.startsWith("walkability:"))).toEqual([]);
  });
});

describe("interiorSurfaceProps", () => {
  isolateTimers();
  function fixture() {
    const map=createEmptyRoomMap({mapId:'support',name:'support',width:12,height:12,theme:'dining'});
    map.lowerTiles.fill(72);map.upperTiles.fill(-1);
    const floor=map.lowerTiles.map((_,i)=>i%12>=2&&i%12<10&&Math.floor(i/12)>=4&&Math.floor(i/12)<10);
    return {map,floor};
  }
  function compose(map:ReturnType<typeof fixture>['map'],floor:boolean[],ids:string[]) {
   return composeConceptRoom({map,floor,fullFloor:floor,room:{x:2,y:4,w:8,h:6},roomId:'room',role:'room',door:{x:5,y:9},placeLabel:'test',
   things:ids.map((id,i)=>({thingId:String(i),objectId:`opaque-${id}`,label:id,chips:['block'],required:true})),
   furnishingObjectIds:new Map(ids.map(id=>[`opaque-${id}`,id])),resolveObject:id=>interiorObjectById(id.replace('opaque-','')),isFloorTile:t=>t===72||t===12});
  }
  describe('small interior props require furniture supports',()=>{
   it('keeps small bottle groups off the floor in legacy theme generation too',()=>{
    for(const plan of INTERIOR_ROOM_DEMO_PLANS){const {map}=runInteriorRoomPipeline(plan);expect(map.upperTiles).not.toContain(350);}
   });
   it.each(['plant','plant_small','jars','vase_flowers','bottle_set'])('does not place %s on empty floor, even if required',id=>{
    const {map,floor}=fixture(),r=compose(map,floor,[id]);expect(r.placements).toHaveLength(0);expect(r.warnings).toHaveLength(1);
   });
   it('places supports before props and preserves occupied tabletop art',()=>{
    const {map,floor}=fixture(),r=compose(map,floor,['jars','vase_flowers','table_wood']);
    expect(r.warnings).toEqual([]);expect(r.placements).toHaveLength(3);
    for(const p of r.placements.filter(p=>p.objectId!=='table_wood'))for(const cell of p.cells)expect([156,157,158,186,187,188]).toContain(map.lowerTiles[cell.y*12+cell.x]);
    const before=map.upperTiles.slice();compose(map,floor,['vase_flowers']);for(let i=0;i<before.length;i++)if(before[i]>=0)expect(map.upperTiles[i]).toBe(before[i]);
    // 이 방은 EasyRPG 실내 칩셋(INTERIOR_ROOM_TILESET_ID) 맵이다 — 저장 왕복은 그 정의를 든 옛 저장본처럼 잰다.
    const project=withRetiredEasyRpgTilesets(createBlankProject());project.maps[map.id]=map;expect(deserialize(serialize(project)).maps[map.id]).toEqual(map);
   });
   it('places a pot on a stove, never on a dining tabletop',()=>{
    const {map,floor}=fixture();map.lowerTiles[4*12+3]=156;
    expect(compose(map,floor,['cauldron']).placements).toHaveLength(0);
    map.lowerTiles[3*12+3]=21;
    const r=compose(map,floor,['cauldron']);expect(r.placements[0]!.cells[0]).toMatchObject({x:3,y:3,tile:323});
   });
   it('does not mistake table legs or ordinary floors for a support',()=>{
    const {map,floor}=fixture();map.lowerTiles[5*12+3]=198;expect(compose(map,floor,['jars']).placements).toHaveLength(0);
   });
   it('puts a short step only on an authored floor seam with two clear landings',()=>{
    const {map}=fixture();for(let y=4;y<8;y++)for(let x=2;x<6;x++)map.lowerTiles[y*12+x]=12;
    const full=map.lowerTiles.map((_,i)=>i%12>=2&&i%12<6&&Math.floor(i/12)>=4&&Math.floor(i/12)<=8),floor=full.map((v,i)=>v&&Math.floor(i/12)<8);
    const input={map,floor,fullFloor:full,room:{x:2,y:4,w:4,h:4},roomId:'bath',role:'room' as const,door:{x:3,y:8},placeLabel:'bath',things:[{thingId:'steps',objectId:'bathroom_steps',label:'steps',chips:[] as never[],required:true}],resolveObject:interiorObjectById,isFloorTile:(t:number)=>t===12||t===72};
    const r=composeConceptRoom(input);expect(r.warnings).toEqual([]);expect(r.placements[0]!.cells.map(c=>[c.y,c.tile])).toEqual([[7,141],[7,111],[7,171]]);
    map.lowerTiles.fill(72);expect(composeConceptRoom(input).placements).toHaveLength(0);
   });
  });
});

// 로케이션과 이벤트가 겹칠 때의 클릭 소유권 (2026-09-12 적대적 리뷰 후속).
describe("locationPointerPriority", () => {
  isolateTimers();
  const base = { locationLayerEnabled: true, eventIdAtPoint: "ev_npc", altKey: false, clickCount: 1 };
  describe("location vs event pointer priority", () => {
    it("레이어가 꺼져 있으면 판정에 끼어들지 않는다", () => {
      expect(resolveLocationOverlapPointer({ ...base, locationLayerEnabled: false, altKey: true, clickCount: 2 }))
        .toEqual({ kind: "draw" });
    });

    it("겹치는 이벤트가 없으면 언제나 그리기다", () => {
      expect(resolveLocationOverlapPointer({ ...base, eventIdAtPoint: null, altKey: true, clickCount: 3 }))
        .toEqual({ kind: "draw" });
    });

    it("한 번 클릭은 그리기다 — 면을 칠하려는 사람이 NPC 때문에 막히지 않는다", () => {
      expect(resolveLocationOverlapPointer(base)).toEqual({ kind: "draw" });
    });

    it("Alt+클릭은 이벤트를 연다", () => {
      expect(resolveLocationOverlapPointer({ ...base, altKey: true })).toEqual({ kind: "openEvent", eventId: "ev_npc" });
    });

    it("더블클릭은 이벤트를 연다", () => {
      expect(resolveLocationOverlapPointer({ ...base, clickCount: LOCATION_OPEN_EVENT_CLICK_COUNT }))
        .toEqual({ kind: "openEvent", eventId: "ev_npc" });
    });
  });
  describe("same-tile click counting", () => {
    const trace = (x: number, y: number, at: number) => ({ mapId: "map_a", x, y, at });

    it("첫 클릭은 1이다", () => {
      expect(locationClickCount(null, trace(4, 5, 1000))).toBe(1);
    });

    it("같은 칸을 창 안에 두 번 누르면 2다", () => {
      expect(locationClickCount(trace(4, 5, 1000), trace(4, 5, 1000 + LOCATION_DOUBLE_CLICK_MS))).toBe(2);
    });

    it("다른 칸이면 다시 1이다", () => {
      expect(locationClickCount(trace(4, 5, 1000), trace(5, 5, 1100))).toBe(1);
    });

    it("창을 넘기면 1로 돌아간다", () => {
      expect(locationClickCount(trace(4, 5, 1000), trace(4, 5, 1001 + LOCATION_DOUBLE_CLICK_MS))).toBe(1);
    });

    it("시계가 뒤로 가도 더블클릭으로 오독하지 않는다", () => {
      expect(locationClickCount(trace(4, 5, 5000), trace(4, 5, 1000))).toBe(1);
    });

    it("다른 맵의 같은 좌표는 다른 클릭이다 — loc1 과 같은 함정", () => {
      expect(locationClickCount({ mapId: "map_a", x: 4, y: 5, at: 1000 }, { mapId: "map_b", x: 4, y: 5, at: 1050 }))
        .toBe(1);
    });
  });
});

describe("mapClipboardRelief", () => {
  isolateTimers();
  function mapId(): MapId {
    return store.getCurrent().startMapId;
  }
  function currentMap(): GameMap {
    const map = store.getCurrent().maps[mapId()];
    if (!map) throw new Error("missing map");
    return map;
  }
  function levelAt(map: GameMap, x: number, y: number): number {
    return map.relief?.levels[y * map.width + x] ?? 0;
  }
  function rampAt(map: GameMap, x: number, y: number): number {
    return map.relief?.ramps?.[y * map.width + x] ?? 0;
  }
  function putRelief(relief: ReliefData): void {
    store.update((project) => {
      const map = project.maps[mapId()];
      if (map) map.relief = relief;
    });
  }
  beforeEach(() => {
    store.replace(createBlankProject());
    resetMapEditHistory();
    editorState.set({
      currentMapId: null,
      tool: "select",
      layer: "lower",
      selection: null,
      clipboard: null,
    });
  });
  describe("영역 복사/붙여넣기 — 높이", () => {
    it("언덕·경사로·벽 장식을 붙여넣고, 한 번의 되돌리기와 다시 실행으로 돌아온다", () => {
      const id = mapId();
      const map = currentMap();
      const levels = new Array(map.width * map.height).fill(0);
      const ramps = new Array(map.width * map.height).fill(0);
      levels[1 * map.width + 2] = 3;
      ramps[1 * map.width + 2] = 1;
      levels[1 * map.width + 3] = 4;
      putRelief({
        width: map.width,
        height: map.height,
        levels,
        ramps,
        style: "dirt",
        wallDecor: [
          { x: 2, y: 1, row: 1, tile: 7 },
          { x: 0, y: 0, row: 1, tile: 9 },
        ],
      });
      resetMapEditHistory();

      selectTileRegion(id, { mapId: id, x: 2, y: 1, width: 2, height: 1 });
      expect(copySelection(id)).toBe(true);
      expect(pasteClipboard(id, 6, 4)).toBe(true);

      const pasted = currentMap();
      expect(levelAt(pasted, 6, 4)).toBe(3);
      expect(levelAt(pasted, 7, 4)).toBe(4);
      expect(rampAt(pasted, 6, 4)).toBe(1);
      expect(rampAt(pasted, 7, 4)).toBe(0);
      expect(levelAt(pasted, 2, 1)).toBe(3);
      expect(pasted.relief?.style).toBe("dirt");
      expect(pasted.relief?.wallDecor).toEqual(expect.arrayContaining([
        { x: 0, y: 0, row: 1, tile: 9 },
        { x: 6, y: 4, row: 1, tile: 7 },
      ]));
      expect(pasted.relief?.wallDecor?.some((decor) => decor.x === 2 && decor.y === 1)).toBe(true);

      expect(undoMapEdit()).toBe(true);
      const undone = currentMap();
      expect(levelAt(undone, 6, 4)).toBe(0);
      expect(rampAt(undone, 6, 4)).toBe(0);
      expect(undone.relief?.wallDecor?.some((decor) => decor.x === 6 && decor.y === 4)).toBe(false);
      expect(levelAt(undone, 2, 1)).toBe(3);

      expect(redoMapEdit()).toBe(true);
      expect(levelAt(currentMap(), 6, 4)).toBe(3);
      expect(rampAt(currentMap(), 6, 4)).toBe(1);
    });

    it("평지를 붙이거나 영역을 지우면 그 칸의 언덕만 내리고, 맵이 평지가 되면 relief 를 뺀다", () => {
      const id = mapId();
      const map = currentMap();
      const levels = new Array(map.width * map.height).fill(0);
      levels[5 * map.width + 5] = 2;
      levels[5 * map.width + 6] = 2;
      putRelief({ width: map.width, height: map.height, levels, wallDecor: [{ x: 5, y: 5, row: 1, tile: 4 }] });
      resetMapEditHistory();

      selectTileRegion(id, { mapId: id, x: 0, y: 0, width: 1, height: 1 });
      expect(copySelection(id)).toBe(true);
      expect(editorState.get().clipboard?.relief?.levels).toEqual([0]);
      expect(pasteClipboard(id, 5, 5)).toBe(true);

      const flattened = currentMap();
      expect(levelAt(flattened, 5, 5)).toBe(0);
      expect(levelAt(flattened, 6, 5)).toBe(2);
      expect(flattened.relief?.wallDecor?.some((decor) => decor.x === 5) ?? false).toBe(false);

      selectTileRegion(id, { mapId: id, x: 6, y: 5, width: 1, height: 1 });
      expect(clearSelectionRegion(id)).toBe(true);
      expect(currentMap().relief).toBeUndefined();
    });

    it("높이가 없는 옛 클립보드는 목적지 언덕을 그대로 둔다", () => {
      const id = mapId();
      const map = currentMap();
      const levels = new Array(map.width * map.height).fill(0);
      levels[4 * map.width + 4] = 2;
      putRelief({ width: map.width, height: map.height, levels });
      const legacy: TileClipboard = {
        width: 1,
        height: 1,
        lower: { tiles: [map.lowerTiles[0] ?? 0], stacks: [[]] },
        upper: { tiles: [-1], stacks: [[]] },
      };
      editorState.set({ clipboard: legacy });
      expect(pasteClipboard(id, 4, 4)).toBe(true);
      expect(levelAt(currentMap(), 4, 4)).toBe(2);
    });

    it("붙여넣기 고스트는 스탬프 높이로 들리고, 평지 스탬프는 땅바닥에 둔다", () => {
      const raised: TileClipboard = {
        width: 3,
        height: 3,
        lower: { tiles: Array(9).fill(1), stacks: Array.from({ length: 9 }, () => []) },
        upper: { tiles: Array(9).fill(-1), stacks: Array.from({ length: 9 }, () => []) },
        relief: { levels: Array(9).fill(3) },
      };
      const field = pasteStampLiftField(raised);
      expect(field).not.toBeNull();
      // 렌더가 그리는 들림이다. 한 줄짜리 능선은 깎여 0이 되므로, 살아남는 고원의 가운데를 본다.
      expect(pasteGhostLiftSteps(field, 1, 1)).toBe(3);
      expect(pasteStampLiftField(raised)).toBe(field);

      const flat: TileClipboard = {
        width: 1,
        height: 1,
        lower: { tiles: [1], stacks: [[]] },
        upper: { tiles: [-1], stacks: [[]] },
        relief: { levels: [0] },
      };
      expect(pasteStampLiftField(flat)).toBeNull();
      expect(pasteGhostLiftSteps(null, 0, 0)).toBe(0);

      const legacy: TileClipboard = {
        width: 1,
        height: 1,
        lower: { tiles: [1], stacks: [[]] },
        upper: { tiles: [-1], stacks: [[]] },
      };
      expect(pasteStampLiftField(legacy)).toBeNull();
    });
  });
});

describe("mapTileDrawLayers", () => {
  isolateTimers();
  // 지형 합성·받침이 없는 최소 커스텀 타일셋(4열 16px).
  function plainTileset(): TilesetDef {
    const count = 16;
    const pass = { up: true, down: true, left: true, right: true };
    return {
      id: "plain", name: "plain", kind: "custom", image: { type: "uploaded", id: "plain_img" },
      tileSize: 16, tilesPerRow: 4, count,
      passability: Array.from({ length: count }, () => ({ ...pass })),
      priority: Array.from({ length: count }, () => "lower" as const),
      terrain: Array.from({ length: count }, () => 0),
    } as TilesetDef;
  }
  function recordingContext(calls: string[]): CanvasRenderingContext2D {
    return {
      // 9인자 drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh): sx, sy 로 타일 식별.
      drawImage: (...args: number[]) => calls.push(`img ${args[1]},${args[2]}`),
      fillRect: (x: number, y: number, w: number) => calls.push(`shade ${x},${y},${w}`),
      save: () => undefined, restore: () => undefined, fillStyle: "", imageSmoothingEnabled: false,
    } as unknown as CanvasRenderingContext2D;
  }
  describe("drawMapTileLayers 4층 + 그림자", () => {
    it("그리는 순서는 1층 → 2층 → 그림자 → 3층 → 4층", () => {
      const project = createBlankProject();
      const map: GameMap = { ...project.maps[project.startMapId]!, width: 1, height: 1, lowerTiles: [1], upperTiles: [3],
        lowerOverlayTiles: [2], upperOverlayTiles: [5], shadowBits: [0b0001], tilesetId: "plain" };
      const calls: string[] = [];
      drawMapTileLayers(recordingContext(calls), {} as TilesetCanvasImage, map, plainTileset(), 1);
      expect(calls).toEqual(["img 16,0", "img 32,0", "shade 0,0,8", "img 48,0", "img 16,16"]);
    });

    it("새 칸이 없는 옛 맵은 1층·3층만 그린다", () => {
      const project = createBlankProject();
      const map: GameMap = { ...project.maps[project.startMapId]!, width: 1, height: 1, lowerTiles: [1], upperTiles: [3], tilesetId: "plain" };
      delete map.lowerOverlayTiles;
      delete map.upperOverlayTiles;
      delete map.shadowBits;
      const calls: string[] = [];
      drawMapTileLayers(recordingContext(calls), {} as TilesetCanvasImage, map, plainTileset(), 1);
      expect(calls).toEqual(["img 16,0", "img 48,0"]);
    });

    it("그림자 조각은 배율이 곱해진 칸 크기의 ¼ 자리에 앉는다", () => {
      const project = createBlankProject();
      const map: GameMap = { ...project.maps[project.startMapId]!, width: 2, height: 1, lowerTiles: [-1, -1], upperTiles: [-1, -1],
        shadowBits: [0, 0b1010], tilesetId: "plain" };
      const calls: string[] = [];
      drawMapTileLayers(recordingContext(calls), {} as TilesetCanvasImage, map, plainTileset(), 2);
      expect(calls).toEqual(["shade 48,0,16", "shade 48,16,16"]);
    });
  });
});

describe("mapTreeDrop", () => {
  isolateTimers();
  describe("mapTreeDropRelation", () => {
    it("uses only child drops on the root row", () => {
      expect(mapTreeDropRelation(2, 30, true)).toBe("child");
      expect(mapTreeDropRelation(28, 30, true)).toBe("child");
    });

    it("splits a row into before / child / after thirds", () => {
      expect(mapTreeDropRelation(4, 30, false)).toBe("before");
      expect(mapTreeDropRelation(15, 30, false)).toBe("child");
      expect(mapTreeDropRelation(26, 30, false)).toBe("after");
    });
  });
});

describe("openingStillCatalog", () => {
  isolateTimers();
  function ids(kind: DatabaseResourcePickerKind, project: Project): string[] {
    return listDatabaseResourceOptions(kind, project).map(entry => entry.id);
  }
  function withUploads(): Project {
    const project = createBlankProject();
    project.assets.uploaded["backdrop_img_0001"] = {
      id: "backdrop_img_0001", name: "AI 배경화", kind: "backdrop", dataUrl: "data:image/png;base64,AAAA", meta: {},
    };
    project.assets.uploaded["title_img_0001"] = {
      id: "title_img_0001", name: "AI 타이틀", kind: "title", dataUrl: "data:image/png;base64,AAAA", meta: {},
    };
    project.assets.uploaded["picture-upload"] = {
      id: "picture-upload", name: "업로드 그림", kind: "picture", dataUrl: "data:image/png;base64,AAAA", meta: {},
    };
    return project;
  }
  describe("시네마틱 스틸 카탈로그", () => {
    it("전체화면 아트를 아이템 아이콘보다 먼저 제안한다", () => {
      const still = ids("still", createBlankProject());
      expect(still).toContain("oprn-pano-sky-day");
      expect(still).toContain("oprn-still-corridor");
      expect(still.slice(0, 40).filter(id => id.startsWith("cc0-jetrel-"))).toEqual([]);
    });

    it("기존 저장본의 아이콘 참조를 계속 허용한다", () => {
      const project = createBlankProject();
      const legacyIcon = ids("image", project).find(id => id.startsWith("cc0-jetrel-"));
      expect(legacyIcon).toBeTruthy();
      expect(ids("still", project)).toContain(legacyIcon);
    });

    it("아이콘/이미지 카탈로그는 그대로 둔다", () => {
      const project = createBlankProject();
      const image = ids("image", project);
      expect(image.length).toBeGreaterThan(400);
      expect(image).not.toContain("oprn-pano-sky-day");
      expect(image).not.toContain("oprn-still-corridor");
      expect(ids("icon", project)).not.toContain("oprn-pano-sky-day");
    });

    it("AI 생성·업로드 스틸을 아이콘보다 앞에 둔다", () => {
      const still = ids("still", withUploads());
      const firstIcon = still.findIndex(id => id.startsWith("cc0-jetrel-"));
      expect(firstIcon).toBeGreaterThan(0);
      for (const id of ["backdrop_img_0001", "title_img_0001", "picture-upload"]) {
        expect(still).toContain(id);
        expect(still.indexOf(id)).toBeLessThan(firstIcon);
      }
    });

    it("음악·영상 카탈로그를 스틸로 끌어오지 않는다", () => {
      const still = ids("still", withUploads());
      expect(still.some(id => id.startsWith("cc0-bgm-"))).toBe(false);
      expect(still.some(id => id.startsWith("cc0-se-"))).toBe(false);
    });
  });
});

describe("pastePreviewGhost", () => {
  isolateTimers();
  function clipboard(patch: Partial<TileClipboard> = {}): TileClipboard {
    return {
      width: 1,
      height: 1,
      lower: { tiles: [-1], stacks: [[]] },
      upper: { tiles: [-1], stacks: [[]] },
      ...patch,
    };
  }
  describe("paste preview ghost pieces", () => {
    it("draws layer 1, its stack, layer 2, shadow, layer 3, its stack, then layer 4", () => {
      const pieces = pasteGhostPieces(clipboard({
        lower: { tiles: [10], stacks: [[11, 12]], overlay: [20] },
        upper: { tiles: [30], stacks: [[31]], overlay: [40] },
        shadow: [0b0101],
      }), 0);
      expect(pieces).toEqual([
        { draw: "composed", tile: 10, alpha: 0.4 },
        { draw: "composed", tile: 11, alpha: 0.4 },
        { draw: "composed", tile: 12, alpha: 0.4 },
        { draw: "raw", tile: 20, alpha: 0.4 },
        { draw: "shadow", bits: 0b0101, alpha: 0.2 },
        { draw: "composed", tile: 30, alpha: 0.55 },
        { draw: "composed", tile: 31, alpha: 0.55 },
        { draw: "raw", tile: 40, alpha: 0.55 },
      ]);
    });

    it("skips empty cells and clipsboards that only stored layers 1 and 3", () => {
      expect(pasteGhostPieces(clipboard(), 0)).toEqual([]);
      expect(pasteGhostPieces(clipboard({
        lower: { tiles: [3], stacks: [[]] },
        upper: { tiles: [-1], stacks: [[]] },
      }), 0)).toEqual([{ draw: "composed", tile: 3, alpha: 0.4 }]);
    });

    it("masks shadow bits to the four quarters the map stores", () => {
      const pieces = pasteGhostPieces(clipboard({ shadow: [0b1111_0001] }), 0);
      expect(pieces).toEqual([{ draw: "shadow", bits: 0b0001, alpha: 0.2 }]);
    });
  });
});
