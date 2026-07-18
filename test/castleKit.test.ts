// 성 문법 정본(2026-07-18, docs/2026-07-18-castle-grammar.html) 기준 castleKit 단위 테스트.
import { describe, expect, it } from "vitest";
import {
  addDeckRect,
  CASTLE_DECK,
  CASTLE_FACE,
  CASTLE_GATE,
  CASTLE_ROUND_TOWER,
  CASTLE_WALL,
  lintCastleGrammar,
  paintDeckBlock,
  paintRoofDeck,
  paintRoundTower,
  paintTowerEmbedded,
  stampCastle,
} from "@/editor/castleKit";
import { TILE } from "@/project/defaults/constants";
import { createBlankProject } from "@/project/defaults";
import { getTool } from "@/editor/tools/toolRegistry";
import type { GameMap } from "@/project/types";

function blankMap(w = 48, h = 40): GameMap {
  const size = w * h;
  return {
    id: "map_test_castle",
    name: "test",
    width: w,
    height: h,
    tilesetId: "easyrpg_chipset_combined_town",
    tileSize: 16,
    lowerTiles: new Array(size).fill(TILE.GRASS),
    upperTiles: new Array(size).fill(TILE.EMPTY),
    events: [],
  };
}

const at = (map: GameMap, x: number, y: number): number => map.lowerTiles[y * map.width + x]!;
const atUpper = (map: GameMap, x: number, y: number): number => map.upperTiles[y * map.width + x]!;

describe("castleKit canon modules", () => {
  it("paints single-tone roof deck (no 48/79/50 stripes)", () => {
    const map = blankMap();
    paintRoofDeck(map, 2, 2, 6, 4);
    expect(at(map, 2, 2)).toBe(CASTLE_DECK.TL);
    expect(at(map, 7, 2)).toBe(CASTLE_DECK.TR);
    expect(at(map, 2, 5)).toBe(CASTLE_DECK.BL);
    expect(at(map, 7, 5)).toBe(CASTLE_DECK.BR);
    expect(at(map, 4, 2)).toBe(CASTLE_DECK.T);
    expect(at(map, 4, 5)).toBe(CASTLE_DECK.B);
    // 단일톤: 좌변 78, 우변 80, 면 49 — 명암 교대(48/79/50) 금지
    expect(at(map, 2, 3)).toBe(CASTLE_DECK.L);
    expect(at(map, 7, 3)).toBe(CASTLE_DECK.R);
    expect(at(map, 4, 3)).toBe(CASTLE_DECK.WALK);
    expect(at(map, 4, 4)).toBe(CASTLE_DECK.WALK);
    for (const banned of [48, 79, 50]) {
      expect(map.lowerTiles.includes(banned)).toBe(false);
    }
  });

  it("deck block paints deck-over-wall section (19→49→109→51→81), never bare walls or tile 21", () => {
    const map = blankMap();
    const cells = addDeckRect(new Set<string>(), 4, 4, 10, 3);
    paintDeckBlock(map, cells);
    // 단면(북→남): 상변 → 보행 → 하변 → 정면 51 → 정면 81
    expect(at(map, 8, 4)).toBe(CASTLE_DECK.T);
    expect(at(map, 8, 5)).toBe(CASTLE_DECK.WALK);
    expect(at(map, 8, 6)).toBe(CASTLE_DECK.B);
    expect(at(map, 8, 7)).toBe(CASTLE_FACE.MID);
    expect(at(map, 8, 8)).toBe(CASTLE_FACE.BOT);
    // 타일 21은 정본 미사용
    expect(map.lowerTiles.includes(CASTLE_WALL.TOP)).toBe(false);
  });

  it("embedded tower preserves lower under cap/base and alternates windows", () => {
    const map = blankMap();
    const cells = addDeckRect(new Set<string>(), 4, 4, 14, 3);
    paintDeckBlock(map, cells);
    const tower = paintTowerEmbedded(map, 8, 6);
    expect("capRow" in tower).toBe(true);
    if (!("capRow" in tower)) return;
    // 캡·베이스 = upper 전용, 밑 lower 보존(캡 밑 = 데크 하변 109 유지)
    expect(atUpper(map, 8, 6)).toBe(CASTLE_ROUND_TOWER.CAP_L);
    expect(at(map, 8, 6)).toBe(CASTLE_DECK.B);
    expect(atUpper(map, 8, tower.baseRow)).toBe(CASTLE_ROUND_TOWER.BASE_L);
    expect(at(map, 8, tower.baseRow)).toBe(TILE.GRASS);
    // 목 → 몸/창 교대(캡+3, 캡+5가 창)
    expect(at(map, 8, 7)).toBe(CASTLE_ROUND_TOWER.NECK_L);
    expect(at(map, 8, 8)).toBe(CASTLE_ROUND_TOWER.BODY_L);
    expect(at(map, 8, 9)).toBe(CASTLE_ROUND_TOWER.WIN_L);
    expect(at(map, 8, 10)).toBe(CASTLE_ROUND_TOWER.BODY_L);
    expect(at(map, 8, 11)).toBe(CASTLE_ROUND_TOWER.WIN_L);
  });

  it("embedded tower refuses to cut another deck (no overlap stamping)", () => {
    const map = blankMap();
    const wall = addDeckRect(new Set<string>(), 4, 4, 14, 3);
    paintDeckBlock(map, wall);
    // 몸통 경로(캡+2..+6)에 다른 데크를 깐다 → 시공 거부
    const blocking = addDeckRect(new Set<string>(), 6, 10, 6, 3);
    paintDeckBlock(map, blocking);
    const tower = paintTowerEmbedded(map, 8, 6);
    expect("capRow" in tower).toBe(false);
  });

  it("standalone paintRoundTower no longer forces grass under cap/base", () => {
    const map = blankMap();
    map.lowerTiles[8 * map.width + 10] = 307; // 포석 위에 캡
    map.lowerTiles[14 * map.width + 10] = 307; // 포석 위에 베이스
    paintRoundTower(map, 10, 8, 7);
    expect(atUpper(map, 10, 8)).toBe(CASTLE_ROUND_TOWER.CAP_L);
    expect(at(map, 10, 8)).toBe(307);
    expect(atUpper(map, 10, 14)).toBe(CASTLE_ROUND_TOWER.BASE_L);
    expect(at(map, 10, 14)).toBe(307);
    const mids = [10, 11, 12, 13].map((y) => at(map, 10, y));
    expect(mids).toContain(CASTLE_ROUND_TOWER.WIN_L);
    expect(mids).toContain(CASTLE_ROUND_TOWER.BODY_L);
  });

  it("stamps full canon castle: grass courtyard, stair gate, all grammar checks pass", () => {
    const map = blankMap(48, 40);
    const result = stampCastle(map, { area: { x: 0, y: 0, w: 48, h: 40 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stats.roofCells).toBeGreaterThan(50);
    expect(result.stats.wallCells).toBeGreaterThan(20);
    expect(result.roundTowerAt).not.toBeNull();
    expect(result.towers.length).toBe(2);
    expect(result.banners).toBeGreaterThan(0);
    // 마당 중앙 잔디 통행
    const cx = result.courtyard.x + Math.floor(result.courtyard.w / 2);
    const cy = result.courtyard.y + Math.floor(result.courtyard.h / 2);
    expect(at(map, cx, cy)).toBe(TILE.GRASS);
    // 성문 = 대계단 전 층 관통
    expect(at(map, result.gate.x + 1, result.gate.y)).toBe(CASTLE_GATE.STAIR_M);
    expect(at(map, result.gate.x, result.gate.y)).toBe(CASTLE_GATE.STAIR_L);
    // 정본 문법 린트 전 항목 통과
    const checks = lintCastleGrammar(map, { area: result.area, towers: result.towers, gates: result.gateRecords });
    for (const check of checks) {
      expect(check.pass, `(${check.key}) ${check.label} — ${check.detail}`).toBe(true);
    }
  });
});

describe("build_castle tool", () => {
  it("is registered and creates a canon castle map", () => {
    const tool = getTool("build_castle");
    expect(tool).toBeDefined();
    const project = createBlankProject();
    const result = tool!.run(project, {
      id: "map_castle_unit",
      name: "유닛성채",
      width: 48,
      height: 40,
      seed: 99,
      npcs: false,
      path: false,
    });
    expect(result.summary).toMatch(/성채 시공/);
    const map = project.maps.map_castle_unit;
    expect(map).toBeDefined();
    expect(map!.width).toBe(48);
    // 데크·정면·타워 창 시공
    expect(map!.lowerTiles.some((t) => t === CASTLE_DECK.T)).toBe(true);
    expect(map!.lowerTiles.some((t) => t === CASTLE_FACE.MID)).toBe(true);
    expect(map!.lowerTiles.some((t) => t === CASTLE_ROUND_TOWER.WIN_L)).toBe(true);
    // 정본 금지 타일 부재
    expect(map!.lowerTiles.includes(CASTLE_WALL.TOP)).toBe(false);
    expect(map!.lowerTiles.includes(79)).toBe(false);
  });
});
