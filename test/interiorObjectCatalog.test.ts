import { describe, expect, it } from "vitest";
import { INTERIOR_OBJECT_CATALOG, interiorObjectById, interiorObjectsForTheme, type InteriorObjectDef } from "@/editor/interiorObjectCatalog";
import { INTERIOR_ROOM_THEME_CATALOG, INTERIOR_ROOM_THEMES, INTERIOR_SEMANTIC_TILE_CATALOG, VR, type InteriorSemanticTileRole, INTERIOR_ROOM_DEMO_PLANS, runInteriorRoomPipeline, evaluateInteriorRoom, type InteriorRoomPlan } from "@/editor/interiorRoomPipeline";
import { isolateTimers } from "./mergedTeardown";

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
