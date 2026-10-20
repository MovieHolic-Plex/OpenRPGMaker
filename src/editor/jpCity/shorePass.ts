// jp_city 물가 다듬기(2026-10-20) — 지역 구성기(compose_jp_region)가 바닥·키트를 다 깐 뒤 한 번 돈다.
// 바다·강·부두 단칸 바닥(paintJpRegionGround 가 칠한 jp:region-sea · jp:region-river · jp:region-quay)을
// 이웃을 보고 물가 오토타일 칸으로 바꾼다(번들 블록 scripts/content/jp-city/blocks/jp_shore.py):
//   바다 칸 — 8방이 다 물이면 몸통 변형(gnd/sea + jp:sea-body, 칸 위치 해시), 아니면 이웃 땅에 모래가 있으면 jp-shore-sea-sand,
//             없으면 jp-shore-sea-quay(안벽·호안 — 땅 질감을 품지 않아 잔디·광장·부두 어느 땅과도 맞는다).
//             북쪽 이웃이 모래가 아닌 땅이면(부두 안벽 높이면이 보여야 하는 자리) 모래가 섞여도 안벽을 쓴다.
//   강 칸   — jp-river-bank(숲 바닥 흙 둑) / 몸통 변형.
//   부두 칸 — jp-quay-deck: 물 쪽 변에만 갓돌 테(땅 쪽은 이어진 것으로 센다) / 판 변형.
// 다리 키트(출렁다리 등)의 바닥 칸은 물로 센다 — 다리 밑에서 강이 끊겨 둑이 생기지 않게.
// 깊이(2026-10-20 셋째 판): 몸통 물 칸 중 5×5 둘레(거리 2)의 북 줄·서 열·동 열에 안벽·둑(모래 아닌 땅)이 있으면 «깊이 고리» 칸
// (jp:shore-ring:<오토타일>:<키>)으로 바꿔 벽 그늘이 바다 쪽으로 옅어지게 한다. 구운 키가 없으면 가장 가까운 키(bestRingKey).
// 다리 상판 바로 남쪽 강 칸은 다리 그늘 칸(jp:shore-bridge:…)으로 바꾼다. 그림·키 규칙은 jp_shore.py ring_key_at / best_ring_key 와 같다.
// 칩셋에 물가 블록이 없으면(옛 프로젝트 사본) 아무것도 하지 않는다.
import type { AutotileGroup, TilesetDef } from "@/project/types";

const DIR = { N: 1, E: 2, S: 4, W: 8, NE: 16, SE: 32, SW: 64, NW: 128 } as const;
const NB: readonly [number, number, number][] = [
  [0, -1, DIR.N], [1, 0, DIR.E], [0, 1, DIR.S], [-1, 0, DIR.W], [1, -1, DIR.NE], [1, 1, DIR.SE], [-1, 1, DIR.SW], [-1, -1, DIR.NW],
];

/** autotileEngine.cellHash 와 같은 위치 해시(같은 칸 → 같은 변형). */
function cellHash(x: number, y: number): number {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ 0x2f6b1d;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

function canon(m: number): number {
  let out = m & 15;
  const n = m & DIR.N, e = m & DIR.E, s = m & DIR.S, w = m & DIR.W;
  if (n && e) out |= m & DIR.NE;
  if (s && e) out |= m & DIR.SE;
  if (s && w) out |= m & DIR.SW;
  if (n && w) out |= m & DIR.NW;
  return out;
}

type Ts = Pick<TilesetDef, "tileGroups" | "autotileGroups" | "structureKits">;

interface ShoreTiles {
  readonly seaBody: readonly number[];
  readonly riverBody: readonly number[];
  readonly quayBody: readonly number[];
  readonly sand: ReadonlySet<number>;
  readonly sea: ReadonlySet<number>;
  readonly river: ReadonlySet<number>;
  readonly quay: ReadonlySet<number>;
  readonly bridge: ReadonlySet<number>;
  readonly seaSand: AutotileGroup;
  readonly seaQuay: AutotileGroup;
  readonly riverBank: AutotileGroup;
  readonly quayDeck: AutotileGroup;
  /** 곧은 물가 대체 칸: "<오토타일 id>:<마스크>" → 기본 칸과 섞을 대체 칸들(그룹 jp:shore-alt:…). */
  readonly alts: ReadonlyMap<string, readonly number[]>;
  /** 깊이 고리 칸: 오토타일 id → (키 'N111W000E000' → 칸들). */
  readonly rings: ReadonlyMap<string, ReadonlyMap<string, readonly number[]>>;
  /** 다리 그늘 칸: 오토타일 id → (키 'm55' | 'body' | 고리 키 → 칸들). */
  readonly bridgeShade: ReadonlyMap<string, ReadonlyMap<string, readonly number[]>>;
  /** 다리 키트의 1층(바닥) 칸 — 이 칸 바로 남쪽 물에 다리 그늘. */
  readonly bridgeDeck: ReadonlySet<number>;
  /** 출렁다리 발판 중 남쪽이 땅(둑)인 칸에 바꿔 다는 칸(아래 그늘이 흙 색). */
  readonly deckSoil: number | undefined;
  /** 출렁다리(tsuribashi) 키트의 발판 칸(둑 위 칸으로 바꿔 달 대상). */
  readonly tsuriDeck: readonly number[];
}

const cellsOf = (m: ReadonlyMap<string, ReadonlyMap<string, readonly number[]>>, id: string): number[] => [...(m.get(id)?.values() ?? [])].flat();

const RING_BITS = (key: string) => key.slice(1, 4) + key.slice(5, 8) + key.slice(9, 12);

/** 구운 고리 키 중 가장 가까운 것(없는 그늘을 더하는 비트는 2배 벌점). 비트가 없으면 undefined. jp_shore.best_ring_key 와 같다. */
export function bestRingKey(key: string, baked: ReadonlyMap<string, unknown>): string | undefined {
  const bits = RING_BITS(key);
  if (!bits.includes("1")) return undefined;
  if (baked.has(key)) return key;
  let best: string | undefined, bs = Infinity;
  for (const k of baked.keys()) {
    const kb = RING_BITS(k);
    let sc = 0;
    for (let i = 0; i < 9; i++) sc += kb[i] === "1" && bits[i] === "0" ? 2 : kb[i] === "0" && bits[i] === "1" ? 1 : 0;
    if (sc < bs) { best = k; bs = sc; }
  }
  return best;
}

function shoreTiles(ts: Ts): ShoreTiles | undefined {
  const group = (id: string) => (ts.tileGroups ?? []).find((g) => g.id === id)?.tileIds ?? [];
  const auto = (id: string) => (ts.autotileGroups ?? []).find((a) => a.id === id);
  const seaSand = auto("jp-shore-sea-sand"), seaQuay = auto("jp-shore-sea-quay"), riverBank = auto("jp-river-bank"), quayDeck = auto("jp-quay-deck");
  const sea0 = group("jp:region-sea"), river0 = group("jp:region-river"), quay0 = group("jp:region-quay");
  if (!seaSand || !seaQuay || !riverBank || !quayDeck || sea0.length !== 1 || river0.length !== 1 || quay0.length !== 1) return undefined;
  const full = (a: AutotileGroup) => a.variantMap["255"]!;
  const interior = (a: AutotileGroup) => [...new Set([full(a), ...(a.interiorVariants?.[0] ?? [])])];
  const seaBody = [sea0[0]!, ...group("jp:sea-body")];
  const bridge = new Set<number>();
  for (const k of ts.structureKits ?? []) {
    if (!/tsuribashi|bridge/.test(k.id)) continue;
    for (const r of k.rows ?? []) for (const t of r.tiles ?? []) if (t >= 0) bridge.add(t);
  }
  const bridgeDeck = new Set<number>();
  for (const k of ts.structureKits ?? []) {
    if (!/tsuribashi|bridge/.test(k.id)) continue;
    for (const r of k.rows ?? []) for (const t of r.tiles ?? []) if (t >= 0) bridgeDeck.add(t);
  }
  const deckSoil = group("jp:shore-bridge-deck-soil")[0];
  const tsuriDeck = [...new Set((ts.structureKits ?? []).filter((k) => /tsuribashi/.test(k.id)).flatMap((k) => (k.rows ?? []).flatMap((r) => r.tiles ?? [])).filter((t) => t >= 0))];
  if (deckSoil !== undefined) { bridge.add(deckSoil); bridgeDeck.add(deckSoil); }
  const alts = new Map<string, number[]>();
  const rings = new Map<string, Map<string, number[]>>(), bridgeShade = new Map<string, Map<string, number[]>>();
  const nested = (into: Map<string, Map<string, number[]>>, rest: string, ids: readonly number[]) => {
    const cut = rest.lastIndexOf(":");
    const aid = rest.slice(0, cut), key = rest.slice(cut + 1);
    if (!into.has(aid)) into.set(aid, new Map());
    into.get(aid)!.set(key, [...ids]);
  };
  for (const g of ts.tileGroups ?? []) {
    if (g.id.startsWith("jp:shore-alt:")) alts.set(g.id.slice("jp:shore-alt:".length), [...g.tileIds]);
    else if (g.id.startsWith("jp:shore-ring:")) nested(rings, g.id.slice("jp:shore-ring:".length), g.tileIds);
    else if (g.id.startsWith("jp:shore-bridge:")) nested(bridgeShade, g.id.slice("jp:shore-bridge:".length), g.tileIds);
  }
  return {
    alts, rings, bridgeShade, bridgeDeck, deckSoil, tsuriDeck,
    seaBody,
    riverBody: interior(riverBank),
    quayBody: interior(quayDeck),
    sand: new Set(group("jp:region-sand")),
    sea: new Set([...seaBody, ...seaSand.memberTileIds, ...seaQuay.memberTileIds, ...cellsOf(rings, seaQuay.id), ...cellsOf(rings, seaSand.id), ...cellsOf(bridgeShade, seaQuay.id)]),
    river: new Set([...river0, ...riverBank.memberTileIds, ...cellsOf(rings, riverBank.id), ...cellsOf(bridgeShade, riverBank.id)]),
    quay: new Set([...quay0, ...quayDeck.memberTileIds]),
    bridge,
    seaSand, seaQuay, riverBank, quayDeck,
  };
}

/** 물가 칸을 다듬는다. 바꾼 칸 수를 돌려준다. map.lowerTiles 를 제자리에서 고친다. */
export function applyJpShores(map: { readonly width: number; readonly height: number; readonly lowerTiles: number[] }, tileset: Ts): number {
  const T = shoreTiles(tileset);
  if (!T) return 0;
  const W = map.width, H = map.height;
  const src = map.lowerTiles.slice();
  const at = (x: number, y: number): number | undefined => (x < 0 || y < 0 || x >= W || y >= H ? undefined : src[y * W + x]);
  const isWater = (t: number) => T.sea.has(t) || T.river.has(t) || T.bridge.has(t);
  /** 8방 마스크: pred 가 참인 이웃(맵 밖은 이어진 것으로 본다). */
  const mask = (x: number, y: number, pred: (t: number) => boolean): number => {
    let m = 0;
    for (const [dx, dy, bit] of NB) {
      const t = at(x + dx, y + dy);
      if (t === undefined || pred(t)) m |= bit;
    }
    return canon(m);
  };
  /** 가장자리 칸: 곧은 물가면 기본 칸과 대체 칸 중 하나를 칸 위치 해시로(긴 해안이 16px 마다 똑같이 되풀이되지 않게). */
  const edge = (a: AutotileGroup, m: number, x: number, y: number): number | undefined => {
    const base = a.variantMap[String(m)];
    const alt = T.alts.get(`${a.id}:${m}`);
    if (base === undefined || !alt?.length) return base;
    const pool = [base, ...alt];
    return pool[cellHash(x, y) % pool.length];
  };
  /** 5×5 둘레 북 줄(서→동)·서 열·동 열(북→남)의 그늘 땅 비트(맵 밖은 물). */
  const ringKeyAt = (x: number, y: number, caster: (t: number) => boolean): string => {
    const bit = (dx: number, dy: number) => { const t = at(x + dx, y + dy); return t !== undefined && caster(t) ? "1" : "0"; };
    return `N${bit(-1, -2)}${bit(0, -2)}${bit(1, -2)}W${bit(-2, -1)}${bit(-2, 0)}${bit(-2, 1)}E${bit(2, -1)}${bit(2, 0)}${bit(2, 1)}`;
  };
  const pickOf = (pool: readonly number[] | undefined, x: number, y: number) => (pool?.length ? pool[cellHash(x, y) % pool.length] : undefined);
  /** 몸통 칸(8방이 다 물): 다리 그늘 → 깊이 고리 → 몸통 변형 순. */
  const body = (a: AutotileGroup, plain: readonly number[], caster: (t: number) => boolean, x: number, y: number): number | undefined => {
    const ringsOf = T.rings.get(a.id);
    const key = ringsOf ? bestRingKey(ringKeyAt(x, y, caster), ringsOf) : undefined;
    const north = at(x, y - 1);
    if (north !== undefined && T.bridgeDeck.has(north)) {
      const shade = T.bridgeShade.get(a.id);
      const b = pickOf(shade?.get(key ?? "body"), x, y) ?? pickOf(shade?.get("body"), x, y);
      if (b !== undefined) return b;
    }
    if (key) return pickOf(ringsOf!.get(key), x, y);
    return plain[cellHash(x, y) % plain.length];
  };
  const seaCaster = (t: number) => !isWater(t) && !T.sand.has(t);
  const riverCaster = (t: number) => !isWater(t);
  let changed = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, t = src[i]!;
      let next: number | undefined;
      if (T.sea.has(t)) {
        const m = mask(x, y, isWater);
        if (m === 255) next = body(T.seaQuay, T.seaBody, seaCaster, x, y);
        else {
          let sandy = false;
          for (const [dx, dy] of NB) { const n = at(x + dx, y + dy); if (n !== undefined && T.sand.has(n)) { sandy = true; break; } }
          const north = at(x, y - 1);
          if (north !== undefined && !isWater(north) && !T.sand.has(north)) sandy = false;
          next = edge(sandy ? T.seaSand : T.seaQuay, m, x, y);
        }
      } else if (T.river.has(t)) {
        const m = mask(x, y, isWater);
        if (m === 255) next = body(T.riverBank, T.riverBody, riverCaster, x, y);
        else {
          const north = at(x, y - 1);
          const shaded = north !== undefined && T.bridgeDeck.has(north) ? pickOf(T.bridgeShade.get(T.riverBank.id)?.get(`m${m}`), x, y) : undefined;
          next = shaded ?? edge(T.riverBank, m, x, y);
        }
      } else if (T.quay.has(t)) {
        const m = mask(x, y, (n) => !isWater(n));
        next = m === 255 ? T.quayBody[cellHash(x, y) % T.quayBody.length] : T.quayDeck.variantMap[String(m)];
      }
      else if (T.deckSoil !== undefined && T.tsuriDeck.length === 1 && (t === T.deckSoil || t === T.tsuriDeck[0])) {
        // 출렁다리 발판: 남쪽이 둑(땅)이면 아래 1px 그늘을 흙 색으로 그린 칸, 물이면 키트 원래 칸
        const south = at(x, y + 1);
        next = south !== undefined && !isWater(south) ? T.deckSoil : T.tsuriDeck[0];
      }
      if (next !== undefined && next !== t) { map.lowerTiles[i] = next; changed++; }
    }
  }
  return changed;
}
