// 버들항 새 종류 기물(bd-obj-* 105종, 2026-11-14) — 마을·길 빌더가 «그 게임의 벌» 을 골라 놓는다.
//
// 왜(오너 2026-11-14 «버들항 내에 넣을만한 오브젝트들 100개정도 더 추가해»): 그림만 구우면 아무 맵도 달라지지 않는다 — 빌더가 놓아야 한다.
// 한 게임은 쓰임(집 곁·광장·일터·물가·물 위·들·바위·한 귀퉁이)마다 몇 가지만 쓴다: 게임 열쇠로 뽑으므로 한 게임 안에서는 늘 같은 물건이고,
// 게임이 다르면 다른 물건이다(벌통과 물레의 마을 / 염색 통과 베틀의 마을). 열쇠가 없으면(사람 편집·스크립트) 아무것도 놓지 않는다 — 전과 같다.
// 요청 낱말은 보지 않는다. 놓는 자리 검사는 빌더의 것을 그대로 쓴다(host) — 문 앞·길·경사로·한 단 규칙과 갇힌 빈터 열기가 그대로 닿는다.
import { lookHash } from "@/project/kitLook";

const O = (names: string): string[] => names.split(/\s+/).filter(Boolean).map((n) => `bd-obj-${n}`);
/** 쓰임마다 후보(킷 id). 여기 없는 새 기물(바위에 꽂힌 검·쇠 우리·덫·징검돌·길 막이 …)은 이야기가 부를 때만 놓인다(킷 태그 «주제 소품»). */
const POOLS = {
  home: O("beehive-skeps spinning-wheel grindstone milk-churn yoke-buckets broom-bucket kennel bird-bath cart-wheel keg-cradle hen-nest rabbit-hutch tool-rack turnip-pile bean-poles sunflowers pumpkin-patch cold-frame compost-heap drying-trays dovecote loom workbench hay-manger orchard-ladder rose-arch"),
  homeCoast: O("rope-coil net-floats oar-rack eel-baskets"),
  plaza: O("ground-wares scales potters-wheel dye-vats bake-oven cauldron-hearth bell-post lion-statue maypole tailor-dummy weapon-rack map-table stocks bell-frame saddle-rail archery-target training-dummy seesaw swing"),
  work: O("plough hay-manger well-sweep charcoal-clamp workbench grindstone cart-wheel saddle-rail"),
  workCoast: O("capstan rope-coil oar-rack net-floats eel-baskets dock-crane fishing-rod"),
  shore: O("bulrush fishing-rod"),
  water: O("raft-log coracle buoy water-lilies duck-house fish-weir"),
  waterCoast: O("raft-log coracle buoy fish-weir"),
  wild: O("giant-stump root-plate berry-bush anthill fox-den giant-mushroom forest-idol leaf-pile grass-tuft heather-clump"),
  rock: O("boulder-s boulder-pair boulder-tall boulder-huge rock-outcrop slab-ledge rockfall scree-fan heather-clump grass-tuft"),
} as const;
/** 걷는 바닥 그림(사람 아래) — 빌더가 «바닥 소품» 으로 센다. */
const WALK_ON = new Set(O("leaf-pile grass-tuft scree-fan mosaic"));
/** 마을 한 귀퉁이(게임마다 하나): 묘지 · 옛 터 · 나그네 야영. [킷, 왼쪽 위에서 dx, dy]. */
const CORNERS: Record<string, readonly (readonly [string, number, number])[]> = {
  grave: [["bd-obj-iron-fence", 0, 0], ["bd-obj-iron-fence", 2, 0], ["bd-obj-iron-fence", 4, 0], ["bd-obj-gravestone", 0, 2], ["bd-obj-grave-cross", 2, 1], ["bd-obj-gravestone", 4, 2],
    ["bd-obj-grave-mound", 0, 4], ["bd-obj-mourning-statue", 3, 3], ["bd-obj-gravestone", 5, 4]],
  ruin: [["bd-obj-ruined-arch", 1, 0], ["bd-obj-headless-statue", 5, 1], ["bd-obj-broken-urn", 0, 3], ["bd-obj-mosaic", 2, 3], ["bd-obj-pedestal", 5, 4], ["bd-obj-dolmen", 6, 2]],
  camp: [["bd-obj-lean-to", 0, 0], ["bd-obj-bedroll", 3, 1], ["bd-pick-deep-forest-path-campfire", 3, 3], ["bd-obj-camp-seat", 0, 3], ["bd-obj-traveller-pack", 5, 3], ["bd-obj-broken-cart", 5, 0]],
  well: [["bd-obj-dry-well", 0, 0], ["bd-obj-ruin-fountain", 3, 0], ["bd-obj-broken-urn", 2, 2], ["bd-obj-pedestal", 5, 2]],
};

/** 그 게임이 한 쓰임에 쓰는 물건 n 가지 — 열쇠 해시 순으로 앞에서부터. 같은 게임은 어느 맵에서나 같은 목록이다. */
export function beodeulObjectPick(pool: readonly string[], n: number, key: string, slot: string): string[] {
  return [...pool].sort((a, b) => lookHash(`objset|${key}|${slot}|${a}`) - lookHash(`objset|${key}|${slot}|${b}`) || a.localeCompare(b)).slice(0, n);
}

/** 길섶(숲길·들길) 꾸밈에 더할 한 칸 기물 — 그 게임의 들 물건 가운데 한 칸짜리. 열쇠가 없으면 없다. */
export function beodeulVergeObjects(has: (id: string) => boolean, key: string | undefined): string[] {
  if (!key) return [];
  const one = O("berry-bush anthill fox-den leaf-pile grass-tuft boulder-s").filter(has);
  return beodeulObjectPick(one, 3, key, "verge");
}

/** 숲 끝 만입(두 칸 × 두 칸 빈터)에 덤불 대신 설 수 있는 큰 것 — 큰 그루터기·뽑힌 나무·너럭바위·낙석. */
export function beodeulBayObjects(has: (id: string) => boolean, key: string | undefined): string[] {
  if (!key) return [];
  return beodeulObjectPick(O("giant-stump root-plate slab-ledge rockfall").filter(has), 2, key, "bay");
}

type CellKind = "free" | "road" | "plaza" | "water" | "building" | "other" | "out";
export interface ObjectKit { readonly id: string; readonly w: number; readonly h: number }
/** 마을 빌더가 내어 주는 것 — 자리 검사와 놓기는 빌더의 규칙 그대로다. */
export interface BeodeulObjectHost {
  readonly W: number; readonly H: number;
  /** 게임 열쇠(없으면 놓지 않는다)와 이 마을의 씨앗. */
  readonly key: string | undefined; readonly seed: number;
  readonly coast: boolean;
  kit(id: string): ObjectKit | undefined;
  cell(x: number, y: number): CellKind;
  level(x: number, y: number): number;
  /** 뭍 자리: 빈 땅 · 한 단 · 길 곁/문 앞 규칙. */
  fitsLand(kit: ObjectKit, x: number, y: number): boolean;
  /** 광장 자리: 발이 판석 위 · 광장을 지나는 길 줄 밖. */
  fitsPlaza(kit: ObjectKit, x: number, y: number): boolean;
  placeLand(kit: ObjectKit, x: number, y: number, walkOn: boolean): void;
  placePlaza(kit: ObjectKit, x: number, y: number): void;
  /** 물 위: 계획 칸은 물로 남기고 그림만 얹는다. */
  placeWater(kit: ObjectKit, x: number, y: number): void;
  waterTaken(x: number, y: number): boolean;
  readonly houses: readonly { x: number; y: number; w: number; h: number }[];
  readonly plazaCells: readonly number[];
  readonly work: { x: number; y: number } | null;
}

/** 새 기물을 마을에 놓는다. 돌려주는 값: 쓰임마다 놓은 수. */
export function dressBeodeulObjects(host: BeodeulObjectHost): Record<string, number> {
  const placed: Record<string, number> = { home: 0, plaza: 0, work: 0, shore: 0, water: 0, wild: 0, rock: 0, corner: 0 };
  const key = host.key;
  if (!key) return placed;
  const { W, H } = host;
  let s = lookHash(`objects|${key}|${host.seed}`) || 1;
  const rand = () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; };
  const kits = (ids: readonly string[]): ObjectKit[] => ids.map((id) => host.kit(id)).filter((k): k is ObjectKit => !!k);
  const pick = (pool: readonly string[], n: number, slot: string) => kits(beodeulObjectPick(pool.filter((id) => host.kit(id)), n, key, slot));
  const shuffled = <T,>(xs: T[]): T[] => { for (let i = xs.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [xs[i], xs[j]] = [xs[j]!, xs[i]!]; } return xs; };
  const idx = (x: number, y: number) => y * W + x;
  // 길·광장까지의 걸음 수(빈 땅만 지나) — 들 물건은 길에서 두세 칸(숲이 설 깊은 땅은 비운다), 귀퉁이는 길에서 닿는 곳.
  const road = new Int16Array(W * H).fill(99);
  { const q: number[] = [];
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) { const c = host.cell(x, y); if (c === "road" || c === "plaza") { road[idx(x, y)] = 0; q.push(idx(x, y)); } }
    for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W; if (road[c]! >= 9) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy; if (host.cell(nx, ny) !== "free") continue; const n = idx(nx, ny); if (road[n]! > road[c]! + 1) { road[n] = road[c]! + 1; q.push(n); } } } }
  // 들·바위·귀퉁이는 집에서 떨어진 곳에 — 집 벽 옆의 큰 버섯·바위는 마당 물건으로 읽히지 않는다.
  const awayFromHouses = (x: number, y: number): boolean => {
    for (let dy = -3; dy <= 3; dy += 1) for (let dx = -3; dx <= 3; dx += 1) if (host.cell(x + dx, y + dy) === "building") return false;
    return true;
  };
  const taken: { x: number; y: number }[] = [];
  const apart = (x: number, y: number, d: number) => !taken.some((t) => Math.abs(t.x - x) < d && Math.abs(t.y - y) < d);
  const land = (k: ObjectKit, x: number, y: number, slot: string): boolean => {
    if (!host.fitsLand(k, x, y)) return false;
    host.placeLand(k, x, y, WALK_ON.has(k.id)); taken.push({ x, y }); placed[slot] = (placed[slot] ?? 0) + 1; return true;
  };

  // 1. 집 곁 살림: 집 두 채에 하나꼴, 벽에서 한 칸 띄워 집 발치 줄에.
  const home = pick([...POOLS.home, ...(host.coast ? POOLS.homeCoast : [])], 5, "home");
  if (home.length) host.houses.forEach((h, i) => {
    if (rand() > 0.55) return;
    const k = home[i % home.length]!;
    const sides = rand() < 0.5 ? [1, -1] : [-1, 1];
    for (const gap of [1, 2]) for (const sd of sides) {
      const x = sd > 0 ? h.x + h.w + gap : h.x - k.w - gap, y = h.y + h.h - k.h;
      if (land(k, x, y, "home")) return;
    }
  });

  // 2. 광장: 그 게임의 장터 물건 셋까지, 서로 세 칸 넘게 띄워.
  const plaza = pick(POOLS.plaza, 3, "plaza");
  if (plaza.length && host.plazaCells.length) {
    const spots = shuffled([...host.plazaCells]);
    for (const k of plaza) for (const c of spots) {
      const x = (c % W) - Math.floor(k.w / 2), y = Math.floor(c / W) - k.h + 1;
      if (!apart(x, y, 4) || !host.fitsPlaza(k, x, y)) continue;
      host.placePlaza(k, x, y); taken.push({ x, y }); placed.plaza! += 1; break;
    }
  }

  // 3. 일터 곁: 두세 가지.
  if (host.work) {
    const work = pick(host.coast ? POOLS.workCoast : POOLS.work, 3, "work");
    for (const k of work) for (let t = 0; t < 30; t += 1) {
      const x = Math.round(host.work.x + (rand() * 2 - 1) * 5) - Math.floor(k.w / 2), y = Math.round(host.work.y + (rand() * 2 - 1) * 3.5) - k.h + 1;
      if (apart(x, y, 2) && land(k, x, y, "work")) break;
    }
  }

  // 4. 물가(물에 맞닿은 뭍 칸)와 물 위(둘레 한 칸도 물 — 둑에 붙지 않는다).
  const wet = (x: number, y: number) => host.cell(x, y) === "water";
  const shoreCells: number[] = [], waterCells: number[] = [];
  for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) {
    const c = host.cell(x, y);
    if (c === "free" && (wet(x + 1, y) || wet(x - 1, y) || wet(x, y + 1) || wet(x, y - 1))) shoreCells.push(idx(x, y));
    else if (c === "water") {
      // 물 위 것은 물가에서 두세 칸 — 먼 바다 한가운데의 어살·뗏목은 버려진 것으로 읽힌다.
      let near = false;
      for (let dy = -3; dy <= 3 && !near; dy += 1) for (let dx = -3; dx <= 3; dx += 1) { const v = host.cell(x + dx, y + dy); if (v !== "water" && v !== "out") { near = true; break; } }
      if (near) waterCells.push(idx(x, y));
    }
  }
  if (shoreCells.length) {
    const shore = pick([...POOLS.shore, ...(host.coast ? O("oar-rack rope-coil") : [])], 2, "shore");
    let n = 0;
    for (const c of shuffled(shoreCells)) {
      if (n >= 5 || !shore.length) break;
      const k = shore[n % shore.length]!, x = c % W, y = Math.floor(c / W) - k.h + 1;
      if (apart(x, y, 4) && land(k, x, y, "shore")) n += 1;
    }
  }
  if (waterCells.length) {
    const water = pick(host.coast ? POOLS.waterCoast : POOLS.water, 3, "water");
    let n = 0;
    for (const c of shuffled(waterCells)) {
      if (n >= 4 || !water.length) break;
      const k = water[n % water.length]!, x = c % W, y = Math.floor(c / W);
      let ok = apart(x, y, 5);
      for (let j = -1; j <= k.h && ok; j += 1) for (let i = -1; i <= k.w; i += 1) if (!wet(x + i, y + j) || host.waterTaken(x + i, y + j)) { ok = false; break; }
      if (!ok) continue;
      host.placeWater(k, x, y); taken.push({ x, y }); placed.water! += 1; n += 1;
    }
  }

  // 5. 바위: 높이 단이 있는 마을은 단이 바뀌는 곳에서 두세 칸 떨어진 자리(절벽 위·아래)에 — 절벽 끝 두 칸 안은 비운다(절벽 그림이 가린다).
  //    평지 마을은 길에서 두세 칸 든 들에 둘쯤.
  const rock = pick(POOLS.rock, 4, "rock");
  if (rock.length) {
    const near: number[] = [], field: number[] = [];
    for (let y = 3; y < H - 3; y += 1) for (let x = 3; x < W - 3; x += 1) {
      if (host.cell(x, y) !== "free" || road[idx(x, y)]! < 2 || !awayFromHouses(x, y)) continue;
      const L = host.level(x, y);
      let ring2 = true, ring4 = false;
      for (let dy = -4; dy <= 4; dy += 1) for (let dx = -4; dx <= 4; dx += 1) {
        if (host.cell(x + dx, y + dy) === "out" || host.level(x + dx, y + dy) === L) continue;
        if (Math.max(Math.abs(dx), Math.abs(dy)) <= 2) ring2 = false; else ring4 = true;
      }
      if (ring2 && ring4) near.push(idx(x, y)); else if (ring2 && road[idx(x, y)]! <= 4) field.push(idx(x, y));
    }
    const want = near.length ? 6 : 2;
    let n = 0;
    for (const c of shuffled(near.length ? near : field)) {
      if (n >= want) break;
      const k = rock[n % rock.length]!, x = (c % W) - Math.floor(k.w / 2), y = Math.floor(c / W) - k.h + 1;
      if (apart(x, y, 4) && land(k, x, y, "rock")) n += 1;
    }
  }

  // 6. 들: 길에서 두세 칸 든 빈 땅에 그 게임의 들 물건 네 가지를 다섯쯤.
  const wild = pick(POOLS.wild, 4, "wild");
  if (wild.length) {
    const ring: number[] = [];
    for (let y = 2; y < H - 2; y += 1) for (let x = 2; x < W - 2; x += 1) if (host.cell(x, y) === "free" && road[idx(x, y)]! >= 2 && road[idx(x, y)]! <= 4 && awayFromHouses(x, y)) ring.push(idx(x, y));
    let n = 0;
    for (const c of shuffled(ring)) {
      if (n >= 5) break;
      const k = wild[n % wild.length]!, x = (c % W) - Math.floor(k.w / 2), y = Math.floor(c / W) - k.h + 1;
      if (apart(x, y, 5) && land(k, x, y, "wild")) n += 1;
    }
  }

  // 7. 한 귀퉁이: 게임마다 하나(묘지·옛 터·야영·마른 우물터). 길에서 두 칸 넘게 들고 여덟 칸 안인 빈 땅 8×6 에, 놓이는 것만.
  const names = Object.keys(CORNERS).sort();
  const corner = CORNERS[names[lookHash(`objset|${key}|corner`) % names.length]!]!;
  const spots: number[] = [];
  for (let y = 2; y + 6 < H - 2; y += 1) for (let x = 2; x + 8 < W - 2; x += 1) {
    let free = 0, reach = false;
    for (let j = 0; j < 6; j += 1) for (let i = 0; i < 8; i += 1) { if (host.cell(x + i, y + j) === "free") free += 1; const d = road[idx(x + i, y + j)]!; if (d >= 1 && d <= 3) reach = true; }
    if (free >= 44 && reach && apart(x, y, 9)) spots.push(idx(x, y));
  }
  for (const c of shuffled(spots).slice(0, 12)) {
    const x0 = c % W, y0 = Math.floor(c / W);
    const parts = corner.map(([id, dx, dy]) => ({ k: host.kit(id), x: x0 + dx, y: y0 + dy })).filter((p): p is { k: ObjectKit; x: number; y: number } => !!p.k);
    if (parts.filter((p) => host.fitsLand(p.k, p.x, p.y)).length < Math.min(4, parts.length)) continue;
    for (const p of parts) land(p.k, p.x, p.y, "corner");
    break;
  }
  return placed;
}
