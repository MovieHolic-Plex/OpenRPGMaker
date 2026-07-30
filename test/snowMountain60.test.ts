// 설산 60×60 — 2026-07-27 감독 지시 셋을 코드로 고정한다.
//   ① "316 위에는 286 이 나와야 할 거 아니냐"          → 대각 기둥의 맨 위는 **캡**이다
//   ② "계단은 가로가 2칸 이상 '같이' · 삐뚤빼뚤 불가"   → 계단은 **직사각형 한 덩어리**다
//   ③ "삼각형처럼 하지 말고 위로 가면 높아지는 느낌만"  → 절벽 겹이 **맵 폭 전체**를 가로지른다
// 검사의 목적은 예쁨이 아니라 **세 지시가 실제로 지켜지는지**다.
import { describe, expect, it } from "vitest";
import { canMove } from "@/project/collision";
import { createBlankProject, defaultTilesets } from "@/project/defaults";
import { ICE_DIAGONAL_TILES, iceDiagonalRole, validateIceDiagonalTerrain } from "@/project/defaults/iceDiagonalTerrain";
import { passageMarkForTile } from "@/project/tilesetPassage";
import {
  BANDS, CLIFF_BASE, CLIFF_BODY, CLIFF_HEIGHT, CLIFF_TOP, FORBIDDEN_PASSABLE_LIP,
  SNOW_MOUNTAIN_HEIGHT, SNOW_MOUNTAIN_START, SNOW_MOUNTAIN_SUMMIT_POINT, SNOW_MOUNTAIN_WIDTH,
  STAIRS, STAIR_TILES, STAIR_WIDTH,
  bandProfile, buildSnowMountainMap, buildSnowMountainTerrain, stairBlocks, summitPeakCells,
} from "@/project/defaults/snowMountain60";

const W = SNOW_MOUNTAIN_WIDTH;
const H = SNOW_MOUNTAIN_HEIGHT;

function project() {
  const map = buildSnowMountainMap({ tilesetId: "easyrpg_chipset_dungeon", tileSize: 16 });
  const base = createBlankProject();
  base.maps[map.id] = map;
  base.tilesets = { ...base.tilesets, ...defaultTilesets() };
  return { map, base };
}

function flood(lower: readonly number[]): Uint8Array {
  const map = buildSnowMountainMap({ tilesetId: "easyrpg_chipset_dungeon", tileSize: 16 });
  const base = createBlankProject();
  const walked = { ...map, lowerTiles: [...lower] };
  base.maps[walked.id] = walked;
  base.tilesets = { ...base.tilesets, ...defaultTilesets() };
  const seen = new Uint8Array(W * H);
  const start = SNOW_MOUNTAIN_START.y * W + SNOW_MOUNTAIN_START.x;
  seen[start] = 1;
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head]!;
    const x = cell % W;
    const y = (cell - x) / W;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const next = ny * W + nx;
      if (seen[next] === 1 || !canMove(base, walked, x, y, nx, ny)) continue;
      seen[next] = 1;
      queue.push(next);
    }
  }
  return seen;
}

describe("설산 60×60 · 지시① 대각 기둥의 맨 위는 캡이다", () => {
  it("캡 286/287 이 실제로 쓰인다 — 2차 판은 전부 343 으로 덮어 윗선이 안 기울었다", () => {
    const { map } = project();
    const used = new Set(map.lowerTiles);
    expect(used.has(ICE_DIAGONAL_TILES.left.cap), "좌캡 286 이 없다").toBe(true);
    expect(used.has(ICE_DIAGONAL_TILES.right.cap), "우캡 287 이 없다").toBe(true);
  });

  it("모든 대각 기둥의 맨 위 칸이 캡이다 — 343 이 기둥 위에 앉지 않는다", () => {
    const { map } = project();
    const terrain = buildSnowMountainTerrain();
    const wrong: string[] = [];
    for (const column of terrain.diagonalColumns) {
      const tile = map.lowerTiles[column.topY * W + column.x] ?? -1;
      if (tile !== ICE_DIAGONAL_TILES[column.face].cap) wrong.push(`${column.x},${column.topY}=${tile}`);
    }
    expect(wrong, `캡이 아닌 기둥 머리: ${wrong.slice(0, 6).join(" · ")}`).toEqual([]);
  });

  it("316 위에는 286 이, 317 위에는 287 이 온다 — 몸통 위가 몸통이면 그 위가 캡이다", () => {
    // 감독 지시 ① 을 문자 그대로 옮긴 검사다. 정본 문법은 343 도 허용하지만
    // 343 은 통행 가능하므로 이 맵에서는 아예 쓰지 않는다(바로 아래 검사).
    const { map } = project();
    const offenders: string[] = [];
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const tile = map.lowerTiles[y * W + x] ?? -1;
        const role = iceDiagonalRole(tile);
        if (role === null || role.layer !== "body") continue;
        const above = map.lowerTiles[(y - 1) * W + x] ?? -1;
        const tiles = ICE_DIAGONAL_TILES[role.face];
        if (above !== tiles.cap && above !== tiles.body) offenders.push(`${x},${y}: 위가 ${above}`);
      }
    }
    expect(offenders, offenders.slice(0, 6).join(" · ")).toEqual([]);
  });

  it("343 은 이 맵에 한 칸도 없다 — 통행 가능한 타일은 절벽이 될 수 없다", () => {
    // 정본 문법은 대각 몸통 위에 343 을 허용한다. 그 말은 **문법상 이어진다**는 뜻일 뿐,
    // 절벽으로 써도 된다는 뜻이 아니다 — 문법 검증기는 통행성을 보지 않는다.
    // 3차 판이 이걸 이음매로 한 칸씩 썼다가 절벽 상단에 구멍 23 칸을 뚫었다.
    const { map, base } = project();
    const tileset = base.tilesets.easyrpg_chipset_dungeon!;
    expect(passageMarkForTile(tileset, FORBIDDEN_PASSABLE_LIP), "343 이 통행 불가로 바뀌었나?").toBe("o");
    const found: string[] = [];
    for (let cell = 0; cell < map.lowerTiles.length; cell += 1) {
      if (map.lowerTiles[cell] === FORBIDDEN_PASSABLE_LIP) found.push(`${cell % W},${Math.floor(cell / W)}`);
    }
    expect(found, found.slice(0, 6).join(" · ")).toEqual([]);
  });

  it("정본 대각 빙벽 검증기가 위반을 하나도 찾지 못한다", () => {
    // 캡을 되살리면 `right-cap-north-west-left-cap` 이 다시 터질 수 있다 —
    // 한 열짜리 골짜기가 생기는 순간이다. 대각 묶음 사이에 긴 수평 구간을 두어 막는다.
    const { map } = project();
    const issues = validateIceDiagonalTerrain({ width: W, height: H, lower: map.lowerTiles });
    expect(issues, issues.slice(0, 8).map((i) => `${i.code}@${i.x},${i.y}=${i.actual}`).join(" · ")).toEqual([]);
  });

  it("대각 묶음은 언제나 두 열 이상이다 — 한 열이면 윗선의 흠집으로 읽힌다", () => {
    for (const band of BANDS) {
      const profile = bandProfile(band);
      let run = 0;
      for (let x = 0; x <= W; x += 1) {
        const sloped = x < W && profile.face[x] !== "flat";
        if (sloped) { run += 1; continue; }
        if (run > 0) expect(run, `${band.id} 의 대각 묶음 길이 ${run}`).toBeGreaterThanOrEqual(2);
        run = 0;
      }
    }
  });
});

describe("설산 60×60 · 지시② 계단은 직사각형 한 덩어리다", () => {
  it("계단 폭이 2 이상이고 376 이 가로로 증식한다", () => {
    expect(STAIR_WIDTH).toBeGreaterThanOrEqual(2);
    const { map } = project();
    const midCount = map.lowerTiles.filter((tile) => tile === STAIRS.mid).length;
    // 폭 4 → 덩어리마다 376 이 두 열, 겹 다섯 × 높이 4 = 40 칸.
    expect(midCount, "376 이 증식하지 않았다").toBe(BANDS.length * (STAIR_WIDTH - 2) * CLIFF_HEIGHT);
  });

  it("계단 덩어리가 완전한 직사각형이다 — 열마다 같은 행에서 시작하고 끝난다", () => {
    const { map } = project();
    for (const block of stairBlocks()) {
      for (let offset = 0; offset < STAIR_WIDTH; offset += 1) {
        const x = block.fromX + offset;
        const expected = offset === 0 ? STAIRS.left : offset === STAIR_WIDTH - 1 ? STAIRS.right : STAIRS.mid;
        for (let step = 0; step < CLIFF_HEIGHT; step += 1) {
          expect(map.lowerTiles[(block.crestY + step) * W + x], `${block.bandId} (${x},${block.crestY + step})`).toBe(expected);
        }
        // 덩어리 바로 위·아래는 계단이 아니다 — 삐뚤빼뚤하면 여기서 걸린다.
        expect(STAIR_TILES.includes(map.lowerTiles[(block.crestY - 1) * W + x] ?? -1), `${block.bandId} x=${x} 위로 새어나갔다`).toBe(false);
        expect(STAIR_TILES.includes(map.lowerTiles[(block.crestY + CLIFF_HEIGHT) * W + x] ?? -1), `${block.bandId} x=${x} 아래로 새어나갔다`).toBe(false);
      }
    }
  });

  it("계단 칸은 다섯 덩어리가 전부다 — 떠돌이 계단 조각이 없다", () => {
    const { map } = project();
    const inBlocks = new Set<number>();
    for (const block of stairBlocks()) {
      for (let offset = 0; offset < STAIR_WIDTH; offset += 1) {
        for (let step = 0; step < CLIFF_HEIGHT; step += 1) inBlocks.add((block.crestY + step) * W + block.fromX + offset);
      }
    }
    const strays: string[] = [];
    for (let cell = 0; cell < map.lowerTiles.length; cell += 1) {
      if (STAIR_TILES.includes(map.lowerTiles[cell] ?? -1) && !inBlocks.has(cell)) strays.push(`${cell % W},${Math.floor(cell / W)}`);
    }
    expect(strays, strays.slice(0, 6).join(" · ")).toEqual([]);
  });

  it("계단 양옆은 같은 행의 절벽이다 — 평평한 구간 안에만 놓인다", () => {
    const { map } = project();
    for (const block of stairBlocks()) {
      for (const x of [block.fromX - 1, block.fromX + STAIR_WIDTH]) {
        if (x < 0 || x >= W) continue;
        expect(map.lowerTiles[block.crestY * W + x], `${block.bandId} 계단 옆(${x}) 이 절벽 상단이 아니다`)
          .toBe(x === 0 ? CLIFF_TOP.left : x === W - 1 ? CLIFF_TOP.right : CLIFF_TOP.mid);
      }
    }
  });
});

describe("설산 60×60 · 지시③ 삼각형이 아니다", () => {
  it("절벽 겹 다섯이 각자 맵 폭 전체를 가로지른다 — 열이 하나도 비지 않는다", () => {
    const terrain = buildSnowMountainTerrain();
    for (const band of BANDS) {
      const profile = bandProfile(band);
      const gaps: number[] = [];
      for (let x = 0; x < W; x += 1) {
        const crest = profile.crestY[x]!;
        const cell = crest * W + x;
        if (terrain.cliffMask[cell] !== 1 && terrain.stairMask[cell] !== 1) gaps.push(x);
      }
      expect(gaps, `${band.id} 의 빈 열: ${gaps.slice(0, 8).join(",")}`).toEqual([]);
    }
  });

  it("위 겹이 아래 겹보다 좁지 않다 — 원뿔이면 좁아진다", () => {
    // 1·2차 판은 겹마다 평지를 좁혀 원뿔을 만들었고, 그래서 맵 네 귀퉁이가 텅 비었다.
    const terrain = buildSnowMountainTerrain();
    const spans = BANDS.map((band) => {
      const profile = bandProfile(band);
      let count = 0;
      for (let x = 0; x < W; x += 1) {
        const cell = profile.crestY[x]! * W + x;
        if (terrain.cliffMask[cell] === 1 || terrain.stairMask[cell] === 1) count += 1;
      }
      return count;
    });
    for (const span of spans) expect(span).toBe(W);
  });

  it("이 맵에는 봉우리가 없다 — 정상이 없으니 마감재도 없다", () => {
    expect(summitPeakCells()).toEqual([]);
    const { map } = project();
    expect(map.upperTiles.every((tile) => tile === -1), "상위 레이어에 뭔가 얹혔다").toBe(true);
  });

  it("수평 절벽이 대각보다 훨씬 많다 — 덩어리가 있어야 절벽으로 읽힌다", () => {
    const terrain = buildSnowMountainTerrain();
    // 파동을 열마다 반올림한 2차 판은 수평이 508 → 212 칸으로 반토막 났다.
    expect(terrain.horizontalCells, "수평 절벽 칸").toBeGreaterThanOrEqual(700);
    expect(terrain.diagonalColumns.length, "대각 기둥 열").toBeGreaterThanOrEqual(40);
  });
});

describe("설산 60×60 · 통행", () => {
  it("절벽은 전부 통행 불가고, 계단은 전부 통행 가능하다", () => {
    const { map, base } = project();
    const tileset = base.tilesets.easyrpg_chipset_dungeon!;
    for (const tile of STAIR_TILES) {
      expect(passageMarkForTile(tileset, tile), `계단 ${tile} 이 통행 불가다`).not.toBe("x");
    }
    const walkable: string[] = [];
    for (let cell = 0; cell < map.lowerTiles.length; cell += 1) {
      const tile = map.lowerTiles[cell] ?? -1;
      const isCliff = iceDiagonalRole(tile) !== null || tile === CLIFF_BODY
        || tile === CLIFF_TOP.left || tile === CLIFF_TOP.mid || tile === CLIFF_TOP.right
        || tile === CLIFF_BASE.left || tile === CLIFF_BASE.mid || tile === CLIFF_BASE.right;
      if (!isCliff) continue;
      if (passageMarkForTile(tileset, tile) !== "x") walkable.push(`${cell % W},${Math.floor(cell / W)}=${tile}`);
    }
    expect(walkable, `걸을 수 있는 절벽: ${walkable.slice(0, 6).join(" · ")}`).toEqual([]);
  });

  it("산 발치에서 맨 위 눈밭까지 걸어 오른다", () => {
    const { map } = project();
    const seen = flood(map.lowerTiles);
    expect(seen[SNOW_MOUNTAIN_START.y * W + SNOW_MOUNTAIN_START.x], "출발점이 통행 불가").toBe(1);
    expect(seen[SNOW_MOUNTAIN_SUMMIT_POINT.y * W + SNOW_MOUNTAIN_SUMMIT_POINT.x], "맨 위에 닿지 못한다").toBe(1);
  });

  it("계단을 실제로 밟는다 — 장식이 아니다", () => {
    const { map } = project();
    const seen = flood(map.lowerTiles);
    let walked = 0;
    for (let cell = 0; cell < map.lowerTiles.length; cell += 1) {
      if (seen[cell] === 1 && STAIR_TILES.includes(map.lowerTiles[cell] ?? -1)) walked += 1;
    }
    expect(walked, "밟은 계단 칸").toBe(BANDS.length * STAIR_WIDTH * CLIFF_HEIGHT);
  });

  it("계단을 막으면 맨 위에 닿지 못한다 — 절벽이 실제로 길을 가른다", () => {
    // 이 검사가 없으면 절벽은 장식일 수 있다(큰 얼음맵이 그랬다).
    const { map } = project();
    const blocked = map.lowerTiles.map((tile) => (STAIR_TILES.includes(tile) ? CLIFF_BODY : tile));
    const seen = flood(blocked);
    expect(seen[SNOW_MOUNTAIN_SUMMIT_POINT.y * W + SNOW_MOUNTAIN_SUMMIT_POINT.x],
      "계단을 다 막았는데도 맨 위에 닿는다 = 절벽이 장식이다").toBe(0);
  });

  it("겹 사이마다 걸어 다닐 눈밭이 남는다", () => {
    const { map } = project();
    const seen = flood(map.lowerTiles);
    // 겹 다섯이 맵을 여섯 층으로 나눈다. 각 층에 최소 40 칸은 걸을 자리가 있어야
    // 통로가 한 줄짜리 틈이 아니다.
    const layers = new Array<number>(BANDS.length + 1).fill(0);
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        if (seen[y * W + x] !== 1) continue;
        let layer = 0;
        for (const band of BANDS) if (y < bandProfile(band).crestY[x]!) layer += 1;
        layers[layer] = (layers[layer] ?? 0) + 1;
      }
    }
    layers.forEach((count, layer) => {
      expect(count, `${layer} 층의 걸을 수 있는 칸`).toBeGreaterThanOrEqual(40);
    });
  });
});
