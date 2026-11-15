// 버들항 정착지의 급(rank) — 바닥은 정착지의 급과 하는 일을 따른다.
//
// 왜(2026-11-14 오너, 참고 마을 여섯 장): 시골 마을은 흙이 마을의 바닥이고(넓게 번진 다진 흙 마당·그 안의 우물·흙길), 읍과 항구는 담 안이 전부 포장이다.
// 시공기는 급과 상관없이 풀밭 위에 회색 포석 길 한 줄과 판석 조각 하나를 깔았다 — 산촌도 장터도 «풀밭에 흩어진 집» 으로 읽혔다.
// 급은 시공기가 이미 가진 사실만으로 정한다(요청 낱말을 읽지 않는다): 성벽 · 청한 광장 · 흩어진 형태 · 집 수 · 바다.
import type { GameMap, TilesetDef } from "@/project/types";

export type SettlementRank = "hamlet" | "village" | "town";

export interface SettlementFacts {
  /** 성벽을 두른다. */
  readonly walls: boolean;
  /** 판석 광장을 청했다(form "plaza" · layout.gather.plaza true). */
  readonly plaza: boolean;
  /** 흩어진 농가를 청했다. */
  readonly scatter: boolean;
  /** 살림집 상한(없으면 Infinity). */
  readonly houseLimit: number;
  /** 바다에 닿은 마을(포구) 또는 강가 어촌. */
  readonly waterfront: boolean;
  /** 풀밭 바닥 마을(강가·포구) — 사막·설원·늪은 자기 바닥 표본을 쓴다. */
  readonly grass: boolean;
}

export interface SettlementGround {
  readonly rank: SettlementRank;
  /** 길이 흙길이다(포석 없음). */
  readonly earthRoads: boolean;
  /** 모이는 곳이 다진 흙 마당이다 — 우물이 그 안에 서고 길이 그리로 넓어진다. */
  readonly commons: boolean;
  /** 담 안·광장 둘레가 포장이다(거리 돌 + 옅은 뜰 돌). 풀은 심은 자리뿐이고 밭은 없다. */
  readonly pavedCore: boolean;
  /** 물가에 돌 부두 띠를 낸다. */
  readonly quay: boolean;
}

export function settlementRank(f: SettlementFacts): SettlementRank {
  if (f.walls || f.plaza) return "town";
  return f.scatter || f.houseLimit <= 3 ? "hamlet" : "village";
}

/** 급 → 바닥 규칙. 풀밭 마을이 아니면 아무것도 바꾸지 않는다(자기 표본 바닥). */
export function settlementGround(f: SettlementFacts): SettlementGround {
  const rank = settlementRank(f);
  const town = rank === "town";
  return { rank, earthRoads: f.grass && !town, commons: f.grass && !town, pavedCore: f.grass && town, quay: f.grass && f.waterfront };
}

/** 지은 맵에서 읽은 바닥 구역(칸 번호 y*w+x) — 장면·기물을 «흙 마당 가장자리» · «포장 뜰» · «둑 위» 에 앉힐 때 쓴다. */
export interface SettlementAreas {
  /** 흙 바닥(흙길·흙 마당 — 한 몸으로 이어진 다진 흙). */
  readonly earth: number[];
  /** 흙에 맞닿은 풀 칸(흙 가장자리 — 살림·일터 장면이 흙을 보고 앉는 자리). */
  readonly earthEdge: number[];
  /** 가장 큰 흙 덩이 가운데 폭이 넓은 자리(마당) — 네 이웃과 대각 이웃이 모두 흙인 칸. */
  readonly yard: number[];
  /** 거리 돌(포석 길). */
  readonly street: number[];
  /** 뜰 돌(광장·포장 뜰 판석). */
  readonly court: number[];
  /** 물에 맞닿은 포장 칸(둑 위). */
  readonly quay: number[];
}

/**
 * 버들항 맵의 바닥 구역을 칸 꼬리표로 읽는다(시공기가 무엇을 깔았는지 다시 계산하지 않는다 — 손으로 고친 맵도 읽는다).
 * 꼬리표: sand = 흙(모랫길·흙 마당), road = 거리 돌, plaza = 뜰 돌, water = 물.
 */
export function readSettlementAreas(map: GameMap, tileset: TilesetDef | undefined): SettlementAreas {
  const W = map.width, H = map.height;
  const kind = new Uint8Array(W * H); // 1 흙 · 2 거리 · 3 뜰 · 4 물 · 5 풀
  const cache = new Map<number, number>();
  const of = (t: number): number => {
    let v = cache.get(t);
    if (v === undefined) {
      const tags = (tileset?.tileMeta?.[t]?.tags ?? []) as readonly string[];
      v = tags.includes("water") ? 4 : tags.includes("plaza") ? 3 : tags.includes("road") ? 2 : tags.includes("sand") || tags.includes("farm_lane") ? 1 : tags.includes("grass") ? 5 : 0;
      cache.set(t, v);
    }
    return v;
  };
  for (let c = 0; c < W * H; c += 1) kind[c] = of(map.lowerTiles[c] ?? -1);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : kind[y * W + x]!);
  const out: { earth: number[]; earthEdge: number[]; yard: number[]; street: number[]; court: number[]; quay: number[] } = { earth: [], earthEdge: [], yard: [], street: [], court: [], quay: [] };
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  for (let c = 0; c < W * H; c += 1) {
    const x = c % W, y = (c - x) / W, k = kind[c]!;
    if (k === 1) {
      out.earth.push(c);
      let all = true; for (let dy = -1; dy <= 1 && all; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (at(x + dx, y + dy) !== 1) { all = false; break; }
      if (all) out.yard.push(c);
    } else if (k === 2) out.street.push(c);
    else if (k === 3) out.court.push(c);
    else if (k === 5 && N4.some(([dx, dy]) => at(x + dx, y + dy) === 1)) out.earthEdge.push(c);
    if ((k === 2 || k === 3) && N4.some(([dx, dy]) => at(x + dx, y + dy) === 4)) out.quay.push(c);
  }
  return out;
}

/**
 * 사람이 서도 되는 흙 마당 칸 — 길로 세는 흙 칸 가운데 둘레 여덟 칸이 모두 길인 칸(폭 셋 이상인 흙의 속).
 * 폭 한두 칸 길 줄기 · 건물 벽 바로 아래 문 앞 칸 · 포석 거리는 들지 않는다(거기 선 사람은 길을 좁힌다).
 * 왜(2026-11-15 명세 은행 lay-main-farm): 흙 몸이 통째로 길로 세어져 «헛간 옆» 농부가 문에서 다섯 칸 밀려났다 — 시골 마을의 사람은 마당에 선다.
 */
export function standableYard(map: GameMap, tileset: TilesetDef | undefined, roads: ReadonlySet<number>): Set<number> {
  const W = map.width, H = map.height, out = new Set<number>();
  for (const c of readSettlementAreas(map, tileset).earth) {
    if (!roads.has(c)) continue;
    const x = c % W, y = (c - x) / W; let all = true;
    for (let dy = -1; dy <= 1 && all; dy += 1) for (let dx = -1; dx <= 1; dx += 1) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || !roads.has(ny * W + nx)) { all = false; break; } }
    if (all) out.add(c);
  }
  return out;
}
