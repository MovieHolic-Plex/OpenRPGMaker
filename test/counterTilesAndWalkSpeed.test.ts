import { describe, expect, it } from "vitest";
import { counterReachTarget, deriveCounterTiles, effectiveCounterTiles, isCounterCell, setCounterTile } from "@/project/counterTiles";
import { npcMoveDurationMs, npcMoveIntervalMs, npcWalkFrameMsForStep, PLAYER_WALK_STEP_MS } from "@/project/characterMotion";
import type { GameMap, PassFlag, TileAiMetadata, TilesetDef } from "@/project/types";

const OPEN: PassFlag = { up: true, down: true, left: true, right: true };
const SHUT: PassFlag = { up: false, down: false, left: false, right: false };

function tileset(): TilesetDef {
  const meta = (label: string): TileAiMetadata => ({ label, description: "", role: "furniture" });
  return {
    id: "t", name: "t", image: { type: "bundled", id: "x" }, tileSize: 16, tilesPerRow: 8, count: 5,
    passability: [OPEN, SHUT, OPEN, SHUT, SHUT], priority: ["lower", "upper", "upper", "upper", "upper"], terrain: [0, 0, 0, 0, 0],
    tileMeta: [meta("바닥"), meta("카운터 2×1 (0,0)"), meta("카운터 2×1 (0,-1)"), meta("바 의자 (0,0)"), meta("vegetable crate")],
  } as TilesetDef;
}

function map(): GameMap {
  // 3×5: 0행 벽 뒤 바닥, 1행 카운터 윗면(통과), 2행 카운터 발밑(막힘), 3·4행 바닥.
  const w = 3, h = 5;
  const lower = new Array(w * h).fill(0);
  const upper = new Array(w * h).fill(-1);
  for (let x = 0; x < w; x++) { upper[1 * w + x] = 2; upper[2 * w + x] = 1; }
  return { id: "m", width: w, height: h, lowerTiles: lower, upperTiles: upper, events: [] } as unknown as GameMap;
}

describe("counter tiles", () => {
  it("derives blocked counter/table furniture only — not the walkable top, stools or English substrings", () => {
    expect(deriveCounterTiles(tileset())).toEqual([1]);
  });

  it("reaches the cell beyond a counter, and stops at a non-counter cell", () => {
    const t = tileset(), m = map();
    expect(isCounterCell(t, m, 1, 2)).toBe(true);
    expect(isCounterCell(t, m, 1, 1)).toBe(false);
    const hit = counterReachTarget(t, m, { x: 1, y: 2 }, { x: 0, y: -1 }, (x, y) => x === 1 && y === 1);
    expect(hit).toEqual({ x: 1, y: 1 });
    // 정면이 카운터가 아니면 너머를 보지 않는다.
    expect(counterReachTarget(t, m, { x: 1, y: 3 }, { x: 0, y: -1 }, () => true)).toBeNull();
  });

  it("an explicit list wins; setCounterTile freezes the derived default first", () => {
    const t = tileset();
    expect(setCounterTile(t, 4, true)).toBe(true);
    expect(t.counterTiles).toEqual([1, 4]);
    setCounterTile(t, 1, false);
    setCounterTile(t, 4, false);
    expect(effectiveCounterTiles(t)).toEqual([]);
    expect(counterReachTarget(t, map(), { x: 1, y: 2 }, { x: 0, y: -1 }, () => true)).toBeNull();
  });
});

describe("NPC walk speed table", () => {
  it("normal NPC (3) walks at half the player's pace; chaser ranks 6-8 are unchanged", () => {
    expect(npcMoveDurationMs(3)).toBe(PLAYER_WALK_STEP_MS * 2);
    expect(npcMoveDurationMs(6)).toBe(160);
    expect(npcMoveDurationMs(7)).toBe(80);
    expect(npcMoveDurationMs(8)).toBe(80);
    for (let r = 1; r < 8; r++) expect(npcMoveDurationMs(r)).toBeGreaterThanOrEqual(npcMoveDurationMs(r + 1));
    expect(npcMoveIntervalMs(3)).toBe(560);
  });

  it("shows two walk patterns per tile so feet follow travel speed", () => {
    expect(npcWalkFrameMsForStep(npcMoveDurationMs(3))).toBe(160);
    expect(npcWalkFrameMsForStep(80)).toBe(60);
  });
});
