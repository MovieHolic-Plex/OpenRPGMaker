import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { DUNGEON_TILESET_ID } from "@/project/defaults/dungeonThemedLayouts";
import { iceDiagonalRole, validateIceDiagonalTerrain } from "@/project/defaults/iceDiagonalTerrain";
import { isPassable } from "@/project/collision";
import { passageMarkForTile } from "@/project/tilesetPassage";
import type { GameMap, Project } from "@/project/types";
import {
  BLOCK_BODY, CLIFF_HEIGHT, CLIFF_ORE_ROCK, CLIFF_TILES, CLIFF_TOP, CLIFF_BASE, CLIFF_WALL_ROWS,
  BANNED_WATER_TILES, CLIFF_LIP, DEFERRED_PROPS, FLOOR_PROPS, FLOOR_PROP_SHAPES, FORBIDDEN_CLIFF_LIP,
  ICE_PLAIN_HEIGHT, ICE_PLAIN_MAP_ID, ICE_PLAIN_START, ICE_PLAIN_SUMMIT, ICE_PLAIN_WIDTH,
  SNOW_DRAPE, STAIR_TILES, STAIR_WIDTH, WATERFALL_FRAMES,
  blockTile, buildIcePlainMap, buildIcePlainTerrain,
} from "@/project/defaults/iceGrandPlain64";

const W = ICE_PLAIN_WIDTH;
const H = ICE_PLAIN_HEIGHT;

function scene(): { project: Project; map: GameMap; terrain: ReturnType<typeof buildIcePlainTerrain> } {
  const project = createBlankProject();
  const terrain = buildIcePlainTerrain();
  const map = buildIcePlainMap({ tilesetId: DUNGEON_TILESET_ID, tileSize: 16 });
  project.maps[map.id] = map;
  return { project, map, terrain };
}

function reachableFrom(project: Project, map: GameMap, start: { x: number; y: number }, blocked: ReadonlySet<number> = new Set()): Uint8Array {
  const seen = new Uint8Array(W * H);
  const queue: [number, number][] = [[start.x, start.y]];
  seen[start.y * W + start.x] = 1;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (current === undefined) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = current[0] + dx;
      const y = current[1] + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const index = y * W + x;
      if (seen[index] === 1 || blocked.has(index) || !isPassable(project, map, x, y)) continue;
      seen[index] = 1;
      queue.push([x, y]);
    }
  }
  return seen;
}

describe("ice grand plain 64x64 terrain", () => {
  it("builds a deterministic 64x64 grid that the canonical ice validator accepts", () => {
    const first = buildIcePlainTerrain();
    const second = buildIcePlainTerrain();
    expect([first.width, first.height]).toEqual([64, 64]);
    expect(first.lowerTiles).toHaveLength(4_096);
    expect(first.upperTiles).toHaveLength(4_096);
    expect(first.lowerTiles).toEqual(second.lowerTiles);
    expect(first.upperTiles).toEqual(second.upperTiles);
    expect(validateIceDiagonalTerrain({ width: W, height: H, lower: first.lowerTiles })).toEqual([]);
  });

  /**
   * 128×128 큰 맵의 **427칸 punch-through** 회귀 검사.
   * 경로가 대각 빙벽 위에 눈 타일 67(`o`)을 얹어 절벽을 걸어 넘게 만들던 사고다.
   * 상위 타일이 ★ 가 아니면 `collision.ts:44` 가 하위 통행성을 덮어쓴다.
   */
  it("never puts a non-star upper tile on a cliff cell", () => {
    const { project, terrain } = scene();
    const tileset = project.tilesets[DUNGEON_TILESET_ID];
    if (tileset === undefined) throw new Error("dungeon tileset missing");
    const offenders: { x: number; y: number; upper: number; mark: string }[] = [];
    for (let index = 0; index < terrain.lowerTiles.length; index += 1) {
      const solid = terrain.cliffMask[index] === 1;
      const upper = terrain.upperTiles[index] ?? -1;
      if (!solid || upper < 0) continue;
      const mark = passageMarkForTile(tileset, upper);
      if (mark !== "star") offenders.push({ x: index % W, y: Math.floor(index / W), upper, mark });
    }
    expect(offenders).toEqual([]);
  });

  it("keeps every cliff cell impassable and never uses the passable lip tile on a cliff", () => {
    const { project, map, terrain } = scene();
    const walkableCliffs: { x: number; y: number }[] = [];
    let lipOnCliff = 0;
    for (let index = 0; index < terrain.lowerTiles.length; index += 1) {
      if (terrain.cliffMask[index] !== 1) continue;
      const x = index % W;
      const y = Math.floor(index / W);
      if (isPassable(project, map, x, y)) walkableCliffs.push({ x, y });
      if (terrain.lowerTiles[index] === FORBIDDEN_CLIFF_LIP) lipOnCliff += 1;
    }
    expect(walkableCliffs).toEqual([]);
    expect(lipOnCliff).toBe(0);
    // 절벽 마스크의 타일은 전부 절벽 어휘여야 한다 — 다른 재료가 섞이면 마스크가 거짓이 된다.
    const strayCliffTiles = new Set<number>();
    for (let index = 0; index < terrain.lowerTiles.length; index += 1) {
      const tile = terrain.lowerTiles[index] ?? -1;
      if (terrain.cliffMask[index] === 1 && !CLIFF_TILES.includes(tile)) strayCliffTiles.add(tile);
    }
    expect([...strayCliffTiles]).toEqual([]);
  });

  /**
   * 큰 맵의 **9슬라이스 위반 195쌍** 회귀 검사.
   * `index % 3` 으로 타일을 고르면 374(우측 끝) 옆에 372(좌측 끝)가 붙는다.
   * 이 맵의 면 재료는 전부 `blockTile()` 한 곳만 통과하므로 마스크와 타일이 일치해야 한다.
   */
  it("paints every surface block as a true nine-slice of its own mask", () => {
    const { terrain } = scene();
    const snowMask = new Uint8Array(W * H);
    for (let index = 0; index < snowMask.length; index += 1) {
      if (terrain.cliffMask[index] === 1 || terrain.stairMask[index] === 1) continue;
      snowMask[index] = 1;
    }
    // 평지 립 343 은 눈밭 바닥이지만 절벽 윗선에 맞춰 일부러 덮어쓴 칸이다 —
    // 눈 블롭의 9슬라이스 자기일거성 대상에서 얼음 패치와 마찬가지로 제외한다.
    const snowSkip = new Uint8Array(W * H);
    for (let index = 0; index < snowSkip.length; index += 1) {
      if (terrain.iceMask[index] === 1 || terrain.lowerTiles[index] === CLIFF_LIP) snowSkip[index] = 1;
    }
    const cases = [
      { name: "snow", mask: snowMask, body: BLOCK_BODY.snow, skip: snowSkip },
      { name: "ice", mask: terrain.iceMask, body: BLOCK_BODY.ice, skip: undefined },
    ] as const;
    for (const testCase of cases) {
      const offenders: { x: number; y: number; got: number; want: number }[] = [];
      for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
        const index = y * W + x;
        if (testCase.mask[index] !== 1) continue;
        if (testCase.skip !== undefined && testCase.skip[index] === 1) continue;
        const want = blockTile(
          testCase.body,
          y === 0 || testCase.mask[index - W] === 1,
          y === H - 1 || testCase.mask[index + W] === 1,
          x === 0 || testCase.mask[index - 1] === 1,
          x === W - 1 || testCase.mask[index + 1] === 1,
        );
        if (terrain.lowerTiles[index] !== want) offenders.push({ x, y, got: terrain.lowerTiles[index] ?? -1, want });
      }
      expect(offenders, testCase.name).toEqual([]);
    }
  });

  /**
   * 감독 지시 — **물은 지운다(얼음 말고)**.
   *
   * 이 맵에는 못도 부빙도 없다. 남쪽 대평원은 눈밭이고 얼음 바닥 패치만 남는다.
   * 427(심연)은 순검정이라 나락으로 읽혔고, 깊은 물 120 으로 바꿔도 얼음 대평원에
   * 맞지 않다는 판정을 받았다. 물 계열 타일이 한 칸도 없어야 한다.
   */
  it("places no water anywhere and keeps the ice floor patches", () => {
    const { terrain } = scene();
    const water = new Set<number>();
    for (const tile of [...terrain.lowerTiles, ...terrain.upperTiles]) {
      if ((BANNED_WATER_TILES as readonly number[]).includes(tile)) water.add(tile);
    }
    expect([...water]).toEqual([]);
    // 얼음 바닥은 남아 있고, 남쪽 대평원(y52~63)에도 얼음 패치가 있다.
    const iceCells = [...terrain.iceMask].filter((cell) => cell === 1).length;
    expect(iceCells).toBeGreaterThan(200);
    const southIce = [...terrain.iceMask].filter((cell, index) => cell === 1 && Math.floor(index / W) >= 52).length;
    expect(southIce).toBeGreaterThan(20);
  });

  /**
   * 감독 지적 "높이가 다른 절뱽은 왜 이어져있는지" 의 정체 — **절뱽 몸통 스택**이었다.
   *
   * 1차 판은 한 겹을 `373 · 285 · 285 · 403` 4행으로 쌓았다. 373 과 403 은 행 0~13 이
   * 224/224 픽셀 동일한 **같은 벌 그림의 상하 한 벌**이고, 285 는 `푸른 광석 암반`이라
   * 사이에 끄우면 벌 가운데가 어된 띄로 끊긴다. 사용자 정본 맵은 285 를 한 칸도 쓰지 않는다.
   */
  it("builds each cliff band as the canonical two-row wall with no ore-rock stack", () => {
    const { terrain } = scene();
    const tops = new Set<number>([CLIFF_TOP.left, CLIFF_TOP.mid, CLIFF_TOP.right]);
    const bases = new Set<number>([CLIFF_BASE.left, CLIFF_BASE.mid, CLIFF_BASE.right]);

    expect(CLIFF_WALL_ROWS).toBe(2);
    expect(CLIFF_HEIGHT).toBe(3);
    // 광석 암반은 한 칸도 안 들어가야 한다 — 사용자 정본 맵에서도 0회다.
    expect(terrain.lowerTiles.filter((tile) => tile === CLIFF_ORE_ROCK)).toEqual([]);

    // 수평 절뱽 상단 아래엔 반드시 밑동이 온다 — 상단 밑에 밑동이 아니린 벽 재료가 없다.
    const strayBelowTop: { x: number; y: number; below: number }[] = [];
    for (let y = 0; y < H - 1; y += 1) for (let x = 0; x < W; x += 1) {
      const index = y * W + x;
      if (!tops.has(terrain.lowerTiles[index] ?? -1)) continue;
      const below = terrain.lowerTiles[index + W] ?? -1;
      if (!bases.has(below)) strayBelowTop.push({ x, y, below });
    }
    expect(strayBelowTop).toEqual([]);

    // 밑동 아래는 벌이 아니다 — 절뱽은 딜 행이므로 밑동 밑에 또 상단/밑동이 옆이지 않는다.
    const stackedWall: { x: number; y: number; below: number }[] = [];
    for (let y = 0; y < H - 1; y += 1) for (let x = 0; x < W; x += 1) {
      const index = y * W + x;
      if (!bases.has(terrain.lowerTiles[index] ?? -1)) continue;
      const below = terrain.lowerTiles[index + W] ?? -1;
      if (tops.has(below) || bases.has(below)) stackedWall.push({ x, y, below });
    }
    expect(stackedWall).toEqual([]);
  });

  /** 감독 지시 — 계단은 직사각형 한 덩어리이고 삐뚤빼뚤할 수 없다.
   * 계단은 **벽인 두 행만** 끊는다 — 겹의 세 번째 행은 이밌 눈 바닥이다. */
  it("cuts each band with one rectangular passable stair block of 375/376/377", () => {
    const { project, map, terrain } = scene();
    expect(terrain.stairs).toHaveLength(4);
    for (const block of terrain.stairs) {
      const tiles = new Set<number>();
      for (let offset = 0; offset < STAIR_WIDTH; offset += 1) {
        for (let step = 0; step < CLIFF_WALL_ROWS; step += 1) {
          const x = block.fromX + offset;
          const y = block.crestY + step;
          const index = y * W + x;
          tiles.add(terrain.lowerTiles[index] ?? -1);
          expect(terrain.stairMask[index], `${block.bandId} mask ${x},${y}`).toBe(1);
          expect(terrain.cliffMask[index], `${block.bandId} cliff ${x},${y}`).toBe(0);
          expect(isPassable(project, map, x, y), `${block.bandId} passable ${x},${y}`).toBe(true);
        }
      }
      // 왼쪽 끝 375 · 가운데 376 반복 · 오른쪽 끝 377 — 376 의 가로 증식이 실제로 보인다.
      expect([...tiles].sort((a, b) => a - b), block.bandId).toEqual([...STAIR_TILES].sort((a, b) => a - b));
    }
    const stairCells = [...terrain.stairMask].filter((cell) => cell === 1).length;
    expect(stairCells).toBe(4 * STAIR_WIDTH * CLIFF_WALL_ROWS);
  });

  /** 고도를 넘는 수단은 계단뿐이다 — 어느 계단을 막아도 정상에 닿지 못해야 한다. */
  it("makes every stair block a real gate to the summit", () => {
    const { project, map, terrain } = scene();
    expect(isPassable(project, map, ICE_PLAIN_START.x, ICE_PLAIN_START.y)).toBe(true);
    const open = reachableFrom(project, map, ICE_PLAIN_START);
    expect(open[ICE_PLAIN_SUMMIT.y * W + ICE_PLAIN_SUMMIT.x]).toBe(1);
    for (const block of terrain.stairs) {
      const blocked = new Set<number>();
      for (let offset = 0; offset < STAIR_WIDTH; offset += 1) {
        for (let step = 0; step < CLIFF_WALL_ROWS; step += 1) blocked.add((block.crestY + step) * W + block.fromX + offset);
      }
      const cut = reachableFrom(project, map, ICE_PLAIN_START, blocked);
      expect(cut[ICE_PLAIN_SUMMIT.y * W + ICE_PLAIN_SUMMIT.x], block.bandId).toBe(0);
    }
  });

  /** 어두운 못은 통행 불가이고, 부빙만이 그 위를 지나간다. */
  /**
   * 감독 지시 — "373 위를 평지로 하려면 343 을 배치해서 평지 느낌을 좀 내줘야함".
   *
   * 절벽 상단 바로 위 행은 위 대지의 바닥이다. 눈밭 9슬라이스가 깔던 97(남쪽 변)은
   * 벽 윗선과 `97 ↓ 373` = 173 으로 부딪혔고, 343 은 38 로 이어진다.
   * 립은 하위 레이어이며 통행 가능해야 한다(대지 바닥이니 당연하다).
   */
  it("lays the 343 lip on the terrace floor directly above every cliff top", () => {
    const { project, map, terrain } = scene();
    const tops = new Set<number>([CLIFF_TOP.left, CLIFF_TOP.mid, CLIFF_TOP.right]);
    const missing: { x: number; y: number; got: number }[] = [];
    let lipCells = 0;
    for (let y = 1; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      const index = y * W + x;
      if (!tops.has(terrain.lowerTiles[index] ?? -1)) continue;
      const lip = index - W;
      if (terrain.cliffMask[lip] === 1 || terrain.stairMask[lip] === 1) continue;
      const got = terrain.lowerTiles[lip] ?? -1;
      if (got !== CLIFF_LIP) missing.push({ x, y: y - 1, got });
      else lipCells += 1;
    }
    expect(missing).toEqual([]);
    expect(lipCells).toBeGreaterThan(100);
    // 립은 걸어다니는 평지다 — 절벽 칸이 아니므로 통행 가능해야 한다.
    for (let index = 0; index < terrain.lowerTiles.length; index += 1) {
      if (terrain.lowerTiles[index] !== CLIFF_LIP) continue;
      const x = index % W;
      const y = Math.floor(index / W);
      expect(terrain.cliffMask[index], `lip @${x},${y} must not be cliff`).toBe(0);
      expect(isPassable(project, map, x, y), `lip ${x},${y}`).toBe(true);
    }
  });

  /**
   * 감독 지적 — "(35,16) 에 있는 이 종유석은 1x2 짜리 세로가 긴거같은데 왜 여기 1칸만깜?".
   *
   * 원인은 소품을 1×1 타일 풀로 흩은 것이었다. 261/291 은 정본 의미표가
   * `회색 바위 첨탑(1×2)` 로 밝히고, 320/321/350/351 은 `대형 수정 군집(2×2)` 다.
   * 이제 발자국 전체가 비어 있을 때만 한 벌 통째로 놓으므로 조각이 남지 않는다.
   */
  it("places every multi-tile prop as a whole footprint with no orphan halves", () => {
    const { terrain } = scene();
    const upperAt = (x: number, y: number): number =>
      (x < 0 || y < 0 || x >= W || y >= H ? -1 : terrain.upperTiles[y * W + x] ?? -1);
    const broken: string[] = [];
    for (const shape of FLOOR_PROP_SHAPES) {
      const rows = shape.tiles.length;
      const cols = shape.tiles[0]!.length;
      if (rows === 1 && cols === 1) continue;
      const head = shape.tiles[0]![0]!;
      for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
        if (upperAt(x, y) !== head) continue;
        for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) {
          const want = shape.tiles[row]![col]!;
          if (upperAt(x + col, y + row) !== want) broken.push(`${shape.label} @${x},${y} wants ${want} at ${x + col},${y + row}`);
        }
      }
    }
    expect(broken).toEqual([]);
    // 1×2 첨탑의 두 조각은 항상 짝을 이룬다 — 어느 쪽도 혼자 남지 않는다.
    const orphans: string[] = [];
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      if (upperAt(x, y) === 291 && upperAt(x, y - 1) !== 261) orphans.push(`lone 291 @${x},${y}`);
      if (upperAt(x, y) === 261 && upperAt(x, y + 1) !== 291) orphans.push(`lone 261 @${x},${y}`);
    }
    expect(orphans).toEqual([]);
    const spires = terrain.upperTiles.filter((tile) => tile === 261).length;
    expect(spires).toBeGreaterThan(0);
    expect(terrain.upperTiles.filter((tile) => tile === 291).length).toBe(spires);
    // 광석 암반 315 는 소품이 아니다(의미표 role = wall) — 목록에서 빠졌다.
    expect(FLOOR_PROPS.includes(315)).toBe(false);
  });

  /** 소품·눈처짐은 전부 ★ 이고, 이번 판에서 보류한 재료는 한 칸도 없다. */
  it("places only star props and holds back the deferred materials", () => {
    const { project, terrain } = scene();
    const tileset = project.tilesets[DUNGEON_TILESET_ID];
    if (tileset === undefined) throw new Error("dungeon tileset missing");
    const allowed = new Set<number>([...FLOOR_PROPS, SNOW_DRAPE.left, SNOW_DRAPE.mid, SNOW_DRAPE.right]);
    const used = new Set<number>();
    for (const tile of terrain.upperTiles) if (tile >= 0) used.add(tile);
    for (const tile of used) {
      expect(allowed.has(tile), `unexpected upper tile ${tile}`).toBe(true);
      expect(passageMarkForTile(tileset, tile), `tile ${tile} must be star`).toBe("star");
    }
    // 봉우리 408/409 · 얼음 블록 232 는 실물 확인 후 보류했고,
    // 125/155/185/215 는 폭포 애니메이션 프레임이라 애초에 놓을 타일이 아니다.
    const everywhere = new Set<number>([...terrain.lowerTiles, ...terrain.upperTiles]);
    for (const tile of DEFERRED_PROPS) expect(everywhere.has(tile), `deferred tile ${tile} leaked in`).toBe(false);
    for (const frame of WATERFALL_FRAMES) expect(everywhere.has(frame), `waterfall frame ${frame} leaked in`).toBe(false);
    expect(used.size).toBeGreaterThan(3);
  });

  it("exposes the map with terrace regions and stair road anchors", () => {
    const { map, terrain } = scene();
    expect(map.id).toBe(ICE_PLAIN_MAP_ID);
    expect([map.width, map.height]).toEqual([64, 64]);
    expect(map.layoutPlan?.kind).toBe("ice-grand-plain-64");
    expect(map.layoutPlan?.regions).toHaveLength(5);
    expect(map.layoutPlan?.roadAnchors).toHaveLength(terrain.stairs.length);
    expect(map.events).toEqual([]);
    // 대각 빙벽과 수평 절벽이 둘 다 실제로 쓰였다 — 한쪽만 쓰면 능선이 단조로워진다.
    expect(terrain.diagonalColumns.length).toBeGreaterThanOrEqual(24);
    expect(terrain.horizontalCliffCells).toBeGreaterThan(300);
    const diagonalCells = terrain.lowerTiles.filter((tile) => iceDiagonalRole(tile) !== null).length;
    expect(diagonalCells).toBe(terrain.diagonalColumns.length * CLIFF_HEIGHT);
  });
});
