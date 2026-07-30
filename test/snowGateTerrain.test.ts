// 설산 관문 지형 — 2026-07-27 감독 결정 시트를 코드로 고정한다.
// 이 파일의 목적은 "예쁘다"를 증명하는 게 아니라, 큰 맵(iceGrandExpanse)이 실제로 저지른
// 다섯 가지 사고가 여기서 재발하지 못하게 막는 것이다:
//   ① 9-슬라이스를 낱개 타일/나머지 연산으로 뿌림
//   ② 같은 모티프를 이어 붙여 톱니 반복
//   ③ 서로 다른 능선이 맞닿아 한 덩어리로 융합
//   ④ 절벽 칸에 통행 가능한 상위 타일을 얹어 걸어 넘게 만듦
//   ⑤ 어휘가 28종에 소품 0개
import { describe, expect, it } from "vitest";
import { canMove } from "@/project/collision";
import { createBlankProject, defaultTilesets } from "@/project/defaults";
import { validateIceDiagonalTerrain, iceDiagonalRole } from "@/project/defaults/iceDiagonalTerrain";
import { passageMarkForTile } from "@/project/tilesetPassage";
import { dungeonTerrainBlockRoles } from "@/project/defaults/dungeonTerrainAutotiles";
import {
  ICE_WALL_TILE,
  RIDGE_MIN_SEPARATION,
  SNOW_GATE_STAR_TILES,
  SNOW_GATE_BRIDGE_X,
  SNOW_GATE_CREVASSE,
  SNOW_GATE_HEIGHT,
  SNOW_GATE_PROPS,
  SNOW_GATE_RIDGES,
  SNOW_GATE_WIDTH,
  paintSnowGateTerrain,
  snowGateBaseSupportGaps,
  snowGateRidgeCellMask,
  snowGateRidgeColumns,
  validateSnowGateRidges,
} from "@/project/defaults/snowGateTerrain";
import type { GameMap } from "@/project/types";

const W = SNOW_GATE_WIDTH;
const H = SNOW_GATE_HEIGHT;

function blankMap(): GameMap {
  return {
    id: "map_test_snowgate",
    name: "설산 관문 (테스트)",
    width: W,
    height: H,
    tilesetId: "easyrpg_chipset_dungeon",
    tileSize: 16,
    lowerTiles: new Array<number>(W * H).fill(-1),
    upperTiles: new Array<number>(W * H).fill(-1),
    events: [],
    encounterRate: 0,
  };
}

function painted(): GameMap {
  const map = blankMap();
  paintSnowGateTerrain(map);
  return map;
}

describe("설산 관문 · 능선 문법", () => {
  it("프로필 기울기와 능선 간격 규칙을 지킨다", () => {
    expect(validateSnowGateRidges()).toEqual([]);
  });

  it("정본 대각 빙벽 검증기가 위반을 하나도 찾지 못한다", () => {
    const map = painted();
    const issues = validateIceDiagonalTerrain({ width: W, height: H, lower: map.lowerTiles });
    expect(issues, issues.slice(0, 8).map((i) => `${i.code}@${i.x},${i.y}=${i.actual}`).join(" · ")).toEqual([]);
  });

  it("모든 밑동 아래가 눈 계열이다", () => {
    expect(snowGateBaseSupportGaps(painted())).toEqual([]);
  });

  it("한 연결 성분이 두 능선을 걸치지 않는다 — 융합 금지", () => {
    // 성분 개수 자체는 능선 수와 다르다: 통로(gap)가 각 능선을 동/서로 쪼개므로 3능선 = 6성분이다.
    // 검사의 뜻은 개수가 아니라 **서로 다른 능선이 한 덩어리가 되지 않는다**이다
    // (큰 맵은 r09+r07 이 한 칸 차이로 붙어 폭 84칸 벽 하나가 됐다).
    const owner = new Int8Array(W * H).fill(-1);
    SNOW_GATE_RIDGES.forEach((ridge, ridgeIndex) => {
      for (const column of snowGateRidgeColumns(ridge)) {
        for (let y = column.topY; y <= column.bottomY; y += 1) owner[y * W + column.x] = ridgeIndex;
      }
    });
    const mask = snowGateRidgeCellMask();
    const seen = new Uint8Array(W * H);
    const mixed: string[] = [];
    for (let start = 0; start < mask.length; start += 1) {
      if (mask[start] === 0 || seen[start] === 1) continue;
      const owners = new Set<number>();
      const stack = [start];
      seen[start] = 1;
      while (stack.length > 0) {
        const cell = stack.pop()!;
        owners.add(owner[cell]!);
        const x = cell % W;
        const y = (cell - x) / W;
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const next = ny * W + nx;
          if (mask[next] === 1 && seen[next] === 0) { seen[next] = 1; stack.push(next); }
        }
      }
      if (owners.size > 1) mixed.push([...owners].map((index) => SNOW_GATE_RIDGES[index]?.id).join("+"));
    }
    expect(mixed, `융합된 능선: ${mixed.join(" · ")}`).toEqual([]);
  });

  it("능선마다 볏 높이가 두 단 이상 나타난다 — 한 단짜리 평평한 벽이 아니다", () => {
    for (const ridge of SNOW_GATE_RIDGES) {
      const tops = new Set(snowGateRidgeColumns(ridge).map((column) => column.topY));
      expect(tops.size, `${ridge.id} 의 볏 높이가 ${tops.size}종`).toBeGreaterThanOrEqual(2);
    }
  });

  it("어떤 능선도 같은 파형을 반복하지 않는다 — 볏 프로필이 12칸 주기로 되풀이되지 않는다", () => {
    // 큰 맵은 12칸 모티프를 그대로 이어 붙여 x 와 x+12 의 상대 높이가 항상 같았다.
    for (const ridge of SNOW_GATE_RIDGES) {
      let repeats = 0;
      for (let x = 0; x + 12 < ridge.profile.length; x += 1) {
        if (ridge.profile[x] === ridge.profile[x + 12]) repeats += 1;
      }
      const total = ridge.profile.length - 12;
      expect(repeats, `${ridge.id}: ${repeats}/${total} 칸이 12주기로 일치`).toBeLessThan(total);
    }
  });
});

describe("설산 관문 · 재질", () => {
  it("9-슬라이스 블록의 몸통 타일이 정본 역할표와 일치한다", () => {
    // 큰 맵은 심연을 428(오른쪽 테두리)로, 빙판을 69/71/99/100/101 섞어 채웠다.
    const roles = new Map(dungeonTerrainBlockRoles().map((role) => [role.key, role]));
    expect(roles.get("snow")?.body).toBe(67);
    expect(roles.get("ice")?.body).toBe(70);
    expect(roles.get("abyss-blue")?.body).toBe(427);
    // 428 은 몸통이 아니라 동쪽 변이다 — 이걸로 면을 채우면 세로 줄무늬가 생긴다.
    expect(roles.get("abyss-blue")?.edgeEast).toBe(428);
  });

  it("크레바스가 9-슬라이스로 성형된다 — 한 타일 반복이 아니다", () => {
    // 크레바스는 한 행짜리 띠라 **몸통 427 이 하나도 안 나오는 게 정상**이다(위아래 이웃이 없다).
    // 처음엔 "427 이 있어야 한다"고 검사했는데 그건 9-슬라이스를 잘못 이해한 것이었다.
    // 옳은 검사는 양 끝과 가운데가 서로 다른 타일이냐 — 나머지 연산으로 뿌리면 그게 안 된다.
    const map = painted();
    const strip = [];
    for (let x = SNOW_GATE_CREVASSE.minX; x <= SNOW_GATE_CREVASSE.maxX; x += 1) {
      strip.push(map.lowerTiles[SNOW_GATE_CREVASSE.y * W + x] ?? -1);
    }
    const roles = new Map(dungeonTerrainBlockRoles().map((role) => [role.key, role]));
    const abyssMembers = new Set(roles.get("abyss-blue")?.memberTileIds ?? []);
    expect(strip.every((tile) => abyssMembers.has(tile)), `크레바스에 심연 아닌 타일: ${strip.join(",")}`).toBe(true);
    expect(strip[0], "서쪽 끝이 가운데와 같다").not.toBe(strip[Math.floor(strip.length / 2)]);
    expect(strip[strip.length - 1], "동쪽 끝이 가운데와 같다").not.toBe(strip[Math.floor(strip.length / 2)]);
    expect(strip[0], "서쪽 끝과 동쪽 끝이 같다 = 방향 구분 없음").not.toBe(strip[strip.length - 1]);
  });

  it("하위 재질이 눈·빙판·심연·정본 빙벽으로만 이루어진다", () => {
    const map = painted();
    const roles = new Map(dungeonTerrainBlockRoles().map((role) => [role.key, role]));
    const allowed = new Set<number>([
      ...(roles.get("snow")?.memberTileIds ?? []),
      ...(roles.get("ice")?.memberTileIds ?? []),
      ...(roles.get("abyss-blue")?.memberTileIds ?? []),
      285, 286, 287, 316, 317, 346, 347,
    ]);
    const strays = [...new Set(map.lowerTiles)].filter((tile) => !allowed.has(tile));
    expect(strays, `허용되지 않은 하위 타일: ${strays.join(", ")}`).toEqual([]);
  });

  it("소품 어휘가 여덟 종 이상 실제로 놓인다", () => {
    const map = painted();
    const used = new Set(map.upperTiles.filter((tile) => tile !== -1));
    const wanted = [
      SNOW_GATE_PROPS.drape.mid, SNOW_GATE_PROPS.peak.left, SNOW_GATE_PROPS.peak.right,
      SNOW_GATE_PROPS.deck, SNOW_GATE_PROPS.crystalBig, SNOW_GATE_PROPS.crystalSmall,
      SNOW_GATE_PROPS.iceBlock, SNOW_GATE_PROPS.snowman, SNOW_GATE_PROPS.snowball,
      SNOW_GATE_PROPS.magic[0]!, SNOW_GATE_PROPS.stalagmite[0]!,
    ];
    const missing = wanted.filter((tile) => !used.has(tile));
    expect(missing, `놓이지 않은 소품: ${missing.join(", ")}`).toEqual([]);
    expect(used.size).toBeGreaterThanOrEqual(8);
  });

  it("부빙은 넣지 않는다 — 조각 하나만 떼어 쓰는 것도 금지", () => {
    // 감독이 고른 어휘지만 30×22 에 3×3 어두운 못 자리가 없어 보류했다(모듈 주석에 근거).
    // 밝은 빙판 위에 얹으면 대비가 없어 흰 상자가 된다 — 실측으로 확인했다.
    // 이 검사는 "나중에 누가 부빙 조각을 하나씩 뿌리는 것"을 막는다.
    // 9-슬라이스를 낱개로 쓰는 게 애초에 이 맵이 고치려던 병이다.
    const map = painted();
    const floePieces = map.upperTiles.filter((tile) => SNOW_GATE_PROPS.floe.includes(tile as never));
    expect(floePieces, `부빙 조각이 들어갔다: ${floePieces.join(", ")}`).toEqual([]);
  });
});

describe("설산 관문 · 통행", () => {
  function project(map: GameMap) {
    const base = createBlankProject();
    base.maps[map.id] = map;
    base.tilesets = { ...base.tilesets, ...defaultTilesets() };
    return base;
  }

  it("절벽 칸에 얹힌 상위 타일은 전부 ★이다", () => {
    // 큰 맵은 절벽에 **통행 가능한 눈 타일**을 얹어 365칸을 걸어 넘게 만들었다.
    // 금지 대상은 "상위 타일"이 아니라 **★이 아닌 상위 타일**이다 —
    // ★(통행 가능 + priority=upper)은 `collision.ts:44` 가 하위 통행성을 그대로 쓰므로 안전하고,
    // 눈처짐 237~239 는 애초에 절벽 상단에 얹으라고 만든 어휘다.
    const map = painted();
    const tileset = defaultTilesets()["easyrpg_chipset_dungeon"]!;
    const offenders: string[] = [];
    for (let cell = 0; cell < map.lowerTiles.length; cell += 1) {
      const lower = map.lowerTiles[cell] ?? -1;
      const isCliff = iceDiagonalRole(lower) !== null || lower === ICE_WALL_TILE;
      if (!isCliff) continue;
      const upper = map.upperTiles[cell] ?? -1;
      if (upper === -1) continue;
      if (passageMarkForTile(tileset, upper) === "star") continue;
      offenders.push(`${cell % W},${Math.floor(cell / W)}=${upper}`);
    }
    expect(offenders, `절벽 위 ★아닌 상위 타일: ${offenders.join(" · ")}`).toEqual([]);
  });

  it("장식으로 쓰는 ★ 목록이 실제로 칩셋에서 ★이다", () => {
    // 이 목록이 틀리면 절벽이 조용히 걸어 넘어진다. 코드의 가정을 칩셋에 대고 확인한다.
    const tileset = defaultTilesets()["easyrpg_chipset_dungeon"]!;
    const notStar = SNOW_GATE_STAR_TILES.filter((tile) => passageMarkForTile(tileset, tile) !== "star");
    expect(notStar, `★이 아닌데 ★로 취급한 타일: ${notStar.join(", ")}`).toEqual([]);
  });

  it("절벽은 전부 통행 불가다", () => {
    const map = painted();
    const proj = project(map);
    const walkable: string[] = [];
    for (let cell = 0; cell < map.lowerTiles.length; cell += 1) {
      if (iceDiagonalRole(map.lowerTiles[cell] ?? -1) === null) continue;
      const x = cell % W;
      const y = Math.floor(cell / W);
      // 이웃에서 들어올 수 있으면 절벽이 뚫린 것이다.
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (canMove(proj, map, nx, ny, x, y)) { walkable.push(`${x},${y}`); break; }
      }
    }
    expect(walkable, `걸어 들어갈 수 있는 절벽 칸: ${walkable.slice(0, 10).join(" · ")}`).toEqual([]);
  });

  it("입구에서 출구까지 걸어서 닿고, 그 길이 다리를 지난다", () => {
    const map = painted();
    const proj = project(map);
    const seen = new Uint8Array(W * H);
    const from = { x: 15, y: 20 };
    const start = from.y * W + from.x;
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
        if (seen[next] === 1 || !canMove(proj, map, x, y, nx, ny)) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    expect(seen[1 * W + 15], "출구 (15,1) 에 닿지 못한다").toBe(1);
    expect(seen[SNOW_GATE_CREVASSE.y * W + SNOW_GATE_BRIDGE_X], "다리를 밟을 수 없다").toBe(1);
    // 크레바스는 **판자 한 칸**으로만 건널 수 있다. 양옆 난간 375/377 은 통행 불가라
    // 밟히지 않는다 — 그게 난간의 뜻이다. 처음엔 세 칸을 기대했는데, 난간을
    // 바닥으로 오해한 것이었다.
    let crossable = 0;
    for (let x = SNOW_GATE_CREVASSE.minX; x <= SNOW_GATE_CREVASSE.maxX; x += 1) {
      if (seen[SNOW_GATE_CREVASSE.y * W + x] === 1) crossable += 1;
    }
    expect(crossable, "크레바스에서 밟을 수 있는 칸 수 — 판자 세 칸").toBe(3);
  });

  it("능선 셋이 실제로 길을 가른다 — 통로를 막으면 출구에 닿지 못한다", () => {
    // 능선이 장식이 아니라 지형임을 증명한다. 통로 x 를 막고 다시 BFS 한다.
    const map = painted();
    const proj = project(map);
    for (const ridge of SNOW_GATE_RIDGES) {
      const blocked = { ...map, lowerTiles: [...map.lowerTiles], upperTiles: [...map.upperTiles] };
      for (let x = ridge.gap[0]; x <= ridge.gap[1]; x += 1) {
        for (let y = ridge.crestY; y < ridge.crestY + ridge.height + 1; y += 1) {
          blocked.lowerTiles[y * W + x] = 427; // 심연으로 메운다
          blocked.upperTiles[y * W + x] = -1;
        }
      }
      const proj2 = { ...proj, maps: { ...proj.maps, [blocked.id]: blocked } };
      const seen = new Uint8Array(W * H);
      const start = 20 * W + 15;
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
          if (seen[next] === 1 || !canMove(proj2, blocked, x, y, nx, ny)) continue;
          seen[next] = 1;
          queue.push(next);
        }
      }
      expect(seen[1 * W + 15], `${ridge.id} 통로를 막았는데도 출구에 닿는다 = 이 능선은 장식이다`).toBe(0);
    }
  });
});

describe("설산 관문 · 고도 표현", () => {
  it("능선 볏 위에 눈처짐과 봉우리가 얹힌다", () => {
    const map = painted();
    const drapes = map.upperTiles.filter((tile) => tile === SNOW_GATE_PROPS.drape.mid
      || tile === SNOW_GATE_PROPS.drape.left || tile === SNOW_GATE_PROPS.drape.right).length;
    const peaks = map.upperTiles.filter((tile) => tile === SNOW_GATE_PROPS.peak.left).length;
    expect(drapes, "눈처짐 개수").toBeGreaterThanOrEqual(12);
    expect(peaks, "봉우리 쌍 개수").toBeGreaterThanOrEqual(4);
  });

  it("봉우리 좌/우 조각이 항상 쌍으로 붙는다 — 세로로 쌓는 조각이 아니다", () => {
    const map = painted();
    for (let cell = 0; cell < map.upperTiles.length; cell += 1) {
      if (map.upperTiles[cell] !== SNOW_GATE_PROPS.peak.left) continue;
      expect(map.upperTiles[cell + 1], `봉우리 좌(${cell % W},${Math.floor(cell / W)}) 오른쪽이 비었다`)
        .toBe(SNOW_GATE_PROPS.peak.right);
    }
    expect(map.upperTiles.filter((t) => t === SNOW_GATE_PROPS.peak.left).length)
      .toBe(map.upperTiles.filter((t) => t === SNOW_GATE_PROPS.peak.right).length);
  });

  it("최하층은 빙판, 그 위 층들은 눈 — 고도가 바닥 재질로 갈린다", () => {
    const map = painted();
    const roles = new Map(dungeonTerrainBlockRoles().map((role) => [role.key, role]));
    const iceMembers = new Set(roles.get("ice")?.memberTileIds ?? []);
    let reservoirIce = 0;
    for (let x = 0; x < W; x += 1) if (iceMembers.has(map.lowerTiles[21 * W + x] ?? -1)) reservoirIce += 1;
    expect(reservoirIce, "저수지 행에 빙판이 거의 없다").toBeGreaterThan(W / 2);
    let summitIce = 0;
    for (let x = 0; x < W; x += 1) if (iceMembers.has(map.lowerTiles[2 * W + x] ?? -1)) summitIce += 1;
    expect(summitIce, "정상에 빙판이 섞였다").toBe(0);
  });
});

describe("능선 간격 규칙 자체가 위반을 잡는지", () => {
  it("RIDGE_MIN_SEPARATION 이 2 이상이다", () => {
    // 큰 맵은 이 규칙이 없어서 r09+r07 이 한 칸 차이로 융합해 폭 84칸 벽이 됐다.
    expect(RIDGE_MIN_SEPARATION).toBeGreaterThanOrEqual(2);
  });
});
