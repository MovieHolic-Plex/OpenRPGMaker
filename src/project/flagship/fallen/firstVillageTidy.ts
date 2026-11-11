/**
 * 『폴른 스타』 첫 마을(왕도 아스텔, fs_hub) 정리 — 사용자 2026-11-09 「첫 마을을 좀 정비해야겠는데. 지저분한 것들 좀 배제하고..
 * 가령 길가에 떨어져있는 박스라던가 ... 소품 위치들이 좀 중구난방이라던가.. 길도 좀 그렇고」.
 *
 * 마을은 커밋된 스냅숏(frozenTowns.json) → reworkFallenTown → 살림·퀘스트 단계가 차례로 소품을 얹는다. 여기서는 그 결과를 규칙으로 걷는다
 * (스냅숏·앞 단계는 건드리지 않는다). 새 그림 없음 — 칸을 비우거나 이미 쓰는 풀밭·길 칸으로 바꿀 뿐이다.
 *  1. 낱 소품(문간 화분·둥근 화분·사과/양배추 상자·쌓은 상자·칼 꽂은 통·징검돌): 길·광장 위에 있거나, 문 앞 칸 곁이거나,
 *     건물·담에 붙어 있지 않은(풀밭 한가운데 떨어진) 것은 걷는다. 이벤트가 달린 칸(조사·수납·퀘스트 상자)은 그대로 둔다.
 *     서쪽 길가 풀밭에 홀로 선 건초 단 더미도 걷는다.
 *  2. 길가 들꽃·고사리 덤불: 길·광장·다리 상판과 맞닿은 것은 걷는다 — 길 테두리가 깨끗한 풀밭으로 읽히게.
 *  3. 길: 서쪽 큰길은 별지기 집 앞(1~7열)이 21·22줄, 다리 쪽(8~16열)이 20·21줄이라 밑 가장자리가 8열에서 계단처럼 꺾였다 →
 *     22줄 8~15열을 길로 메워 밑 가장자리를 곧게 한다(다리 상판이 20·21줄이라 윗줄은 옮기지 않는다). 남서 큰길(32·33줄) 밑 34줄 1~7열 반쪽 띠를 걷고, 큰길 끝(14·15열)을
 *     막던 가는 나무와 모랫길 토막을 걷어 운하 둑길(16열)까지 잇는다. 남쪽 큰길 34줄을 끊던 밑동 없는 나무 윗동(29·30열)을 걷고 31열을 잇는다.
 *     길 사이 한 칸 풀밭 구멍(좌우 또는 위아래가 모두 길)은 길로 메운다. 광장 판석 가장자리의 풀밭 홈·안쪽 모서리는 판석으로, 외딴 판석 칸은 풀밭으로.
 *     여관 앞 동쪽 큰길 끝(32·33줄)은 서쪽(33·34줄)에 맞춘다. 바꾼 칸과 이웃만 길 오토타일을 다시 고른다.
 *     민 풀 칸(737) 한 가지만 깔린 잔디에 가장 부드러운 변형 둘을 불규칙한 덩이로 깔고, 길 가장자리엔 풀 포기·토끼풀 띠, 들꽃은 나무·벽
 *     발치에만, 줄 지은 들꽃은 솎는다 — 오너 「너무 반듯한데서 나오는 기괴함」.
 *     다리 상판 위 수납 통(은수저 퀘스트)은 그림을 나무 상자로 바꿔 다리 끝 난간 기둥 곁 둑으로, 토비는 그 옆 길 칸으로 옮긴다.
 *  4. 주인 없는 그림자 정리(clearOrphanShadows), 그리고 정리 전에 걸어 닿던 이벤트가 하나라도 닿지 않게 되면 굽기를 멈춘다.
 * 2막 「통금의 밤」 광장(fs2_hub_night)은 이 맵을 복제하므로 act2Opening 앞에서 부른다.
 */
import { unreachableEvents } from "@/ai/v2/judge/eventReach";
import type { GameMap, Project } from "@/project/types";
import { clearOrphanShadows } from "../fallenStarMapPolish";

const GRASS = 737;
/** 「버들항 길 포석」 오토타일 — 이웃 길 방향 합(N1 E2 S4 W8) → 칸(fallenTown.ts 와 같은 표). */
const ROAD_BY_MASK = [23015, 23016, 23017, 23018, 23019, 2666, 23020, 4674, 23021, 23022, 23023, 3353, 23024, 9585, 17443, 3221];
const LOOSE_PROP = /^버들항 · 소품$|^버들항 장소 · (징검돌|쌓은 나무 상자)/;
/** 낱 소품 칸 번호 — 문간 화분 6374, 둥근 화분 1677, 사과 상자 9215, 양배추 상자 6391, 징검돌 27566, 쌓은 상자 26607, 칼 꽂은 통 2836. */
const LOOSE_TILES = new Set([6374, 1677, 9215, 6391, 27566, 26607, 2836]);
/** 서쪽 길가 풀밭에 홀로 선 건초 단 더미(2×2). */
const HAY_BALES = new Set([24371, 24372, 24373, 24374]);
const PLAZA = 1509;
/** 같은 「버들항 · 풀밭」 이름표에서 결이 보이는 민 풀 변형 셋 — 한 칸(737)만 깔려 잔디가 판박이로 보였다. */
const SOFT_GRASS = [748, 749, 12949];
/** 「버들항 농장 풀 무늬」 — 풀 포기·풀 포기 둘·토끼풀(길가 띠)과 흰·노란 들꽃(나무·벽 발치). 걸을 수 있는 바닥 칸. */
const GRASS_TUFTS = [27808, 27809, 27810];
const GRASS_FLOWERS = [27811, 27812];
/** 나무 상자(번들 1칸, 온전히 보이는 그림) — 다리 위 수납 통 그림을 바꿀 때. */
const CRATE = 26606;
const TUFT = /^버들항 장소 · (풀밭 들꽃 무더기|들꽃 풀덩이|고사리|낮은 헤더 덤불|들꽃·고사리 무더기)/;
const PAVED = /길|포석|판석|광장|다리 상판/;
const STRUCTURE = /건물|성벽|울타리|담|벽|문/;

export type FirstVillageTidy = { props: number; tufts: number; roadCells: number; trees: number; shadows: number };

export function tidyFallenFirstVillage(project: Project, hubId: string): FirstVillageTidy {
  const map = project.maps[hubId];
  if (!map) throw new Error(`[fallen-village] 맵 ${hubId} 이 없다`);
  const ts = project.tilesets[map.tilesetId] as unknown as {
    tileMeta?: ({ label?: string } | null)[];
    autotileGroups?: { id: string; memberTileIds: number[]; connectTileIds?: number[] }[];
  };
  const meta = ts.tileMeta ?? [];
  const W = map.width, H = map.height;
  const at = (x: number, y: number): number => y * W + x;
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
  const label = (t: number | undefined): string => (t !== undefined && t >= 0 ? meta[t]?.label ?? "" : "");
  const lo = map.lowerTiles, up = map.upperTiles;
  const lo2 = map.lowerOverlayTiles;
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  const eventAt = new Set(map.events.map((e) => at(e.x, e.y)));
  const paved = (x: number, y: number): boolean => inside(x, y) && PAVED.test(label(lo[at(x, y)]));
  const before = new Set(unreachableEvents(project, hubId));

  // ── 1. 낱 소품 ──
  const doorFronts = map.events.filter((e) => String(e.id).startsWith("ev_gate_") || String(e.id).startsWith("ev_fs_locked_")).map((e) => ({ x: e.x, y: e.y + 1 }));
  const loose = (x: number, y: number): boolean => {
    const t = up[at(x, y)]!;
    return LOOSE_TILES.has(t) && LOOSE_PROP.test(label(t));
  };
  const seen = new Set<number>();
  let props = 0;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (seen.has(at(x, y)) || !loose(x, y)) continue;
    const kind = up[at(x, y)]!;
    const group: { x: number; y: number }[] = [];
    const queue = [{ x, y }];
    seen.add(at(x, y));
    while (queue.length) {
      const c = queue.pop()!;
      group.push(c);
      for (const [dx, dy] of N4) {
        const nx = c.x + dx, ny = c.y + dy;
        if (inside(nx, ny) && !seen.has(at(nx, ny)) && loose(nx, ny) && up[at(nx, ny)] === kind) { seen.add(at(nx, ny)); queue.push({ x: nx, y: ny }); }
      }
    }
    if (group.some((c) => eventAt.has(at(c.x, c.y)))) continue;
    const onPaving = group.some((c) => paved(c.x, c.y));
    const byDoor = group.some((c) => doorFronts.some((f) => Math.abs(c.x - f.x) + Math.abs(c.y - f.y) <= 1));
    const againstWall = group.some((c) => N4.some(([dx, dy]) => inside(c.x + dx, c.y + dy) && STRUCTURE.test(label(up[at(c.x + dx, c.y + dy)]))));
    if (!onPaving && !byDoor && againstWall) continue;
    for (const c of group) { up[at(c.x, c.y)] = -1; props += 1; }
  }

  for (let i = 0; i < up.length; i += 1) if (HAY_BALES.has(up[i]!)) { up[i] = -1; props += 1; }

  // 다리 상판 위 수납(은수저 퀘스트 통) — 다리 위에 반쯤 박힌 통으로 보였다(오너 2026-11-09). 이벤트·대사는 그대로 두고,
  // 그림을 온전히 보이는 나무 상자로 바꿔 다리 끝 난간 기둥에 붙은 둑 풀밭 칸으로 옮긴다. 곁의 토비는 상자 옆 길 칸에 선다.
  const railPost = (x: number, y: number): boolean => inside(x, y) && /소품/.test(label(up[at(x, y)])) && N4.some(([dx, dy]) => /다리 상판/.test(label(lo[at(x + dx, y + dy)] ?? -1)) || /다리 상판/.test(label(lo[at(x + dx, y + dy + 1)] ?? -1)));
  for (const box of map.events.filter((e) => /^수납 · /.test(String(e.name ?? "")) && /다리 상판/.test(label(lo[at(e.x, e.y)])))) {
    let best: { x: number; y: number; d: number } | undefined;
    for (let y = box.y - 6; y <= box.y + 6; y += 1) for (let x = box.x - 6; x <= box.x + 6; x += 1) {
      if (!inside(x, y) || eventAt.has(at(x, y)) || lo[at(x, y)] !== GRASS || (up[at(x, y)]! >= 0 && !TUFT.test(label(up[at(x, y)])))) continue;
      if (!N4.some(([dx, dy]) => railPost(x + dx, y + dy)) || !N4.some(([dx, dy]) => paved(x + dx, y + dy) && !/다리 상판/.test(label(lo[at(x + dx, y + dy)])))) continue;
      const d = Math.abs(x - box.x) + Math.abs(y - box.y);
      if (!best || d < best.d) best = { x, y, d };
    }
    if (!best) throw new Error(`[fallen-village] ${box.id}: 다리 난간 곁에 옮길 풀밭 칸이 없다`);
    up[at(box.x, box.y)] = -1;
    eventAt.delete(at(box.x, box.y));
    up[at(best.x, best.y)] = CRATE;
    if (lo2) lo2[at(best.x, best.y)] = -1;
    box.x = best.x; box.y = best.y;
    eventAt.add(at(box.x, box.y));
    const kid = map.events.find((e) => e.id === "ev_fs_kid_bridge");
    if (kid) {
      const spot = N4.map(([dx, dy]) => ({ x: box.x + dx, y: box.y + dy }))
        .find((c) => paved(c.x, c.y) && !/다리 상판/.test(label(lo[at(c.x, c.y)])) && !eventAt.has(at(c.x, c.y)) && up[at(c.x, c.y)]! < 0);
      if (spot) { eventAt.delete(at(kid.x, kid.y)); kid.x = spot.x; kid.y = spot.y; eventAt.add(at(kid.x, kid.y)); }
    }
    props += 1;
  }

  // ── 2. 길가 덤불 ──
  let tufts = 0;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const i = at(x, y);
    if (eventAt.has(i) || !TUFT.test(label(up[i]))) continue;
    if (N4.some(([dx, dy]) => paved(x + dx, y + dy))) { up[i] = -1; tufts += 1; }
  }

  // ── 3. 길 ──
  const road = ts.autotileGroups?.find((g) => g.id === "beodeul_road_autotile");
  if (!road) throw new Error("[fallen-village] 길 오토타일 그룹이 없다");
  const roadSet = new Set(road.memberTileIds);
  const link = new Set([...road.memberTileIds, ...(road.connectTileIds ?? [])]);
  const isLink = (x: number, y: number): boolean => !inside(x, y) || link.has(lo[at(x, y)]!) || /다리 상판/.test(label(lo[at(x, y)]));
  const changed = new Set<number>();
  let trees = 0;
  const clearUpper = (x: number, y: number): void => { const i = at(x, y); if (up[i]! >= 0) { up[i] = -1; trees += 1; } };
  const setRoad = (x: number, y: number): void => {
    const i = at(x, y);
    if (!inside(x, y) || eventAt.has(i) || roadSet.has(lo[i]!) || up[i]! >= 0) return;
    lo[i] = 3221; if (lo2) lo2[i] = -1; changed.add(i);
  };
  const setGrass = (x: number, y: number): void => {
    const i = at(x, y);
    if (!inside(x, y) || eventAt.has(i) || up[i]! >= 0) return;
    lo[i] = GRASS; changed.add(i);
  };
  const isRoadAt = (x: number, y: number, pattern: RegExp): boolean => inside(x, y) && pattern.test(label(lo[at(x, y)]));
  // 서쪽 큰길 꺾임 — 22줄 8~15열을 길로, 20줄 8~12열은 풀밭으로(13열 북쪽 골목부터는 다리 상판 줄이라 둔다).
  if (isRoadAt(4, 22, /길/) && isRoadAt(10, 20, /길/) && !isRoadAt(10, 22, /길/)) {
    for (let x = 8; x <= 15; x += 1) setRoad(x, 22);
    for (let x = 8; x <= 12; x += 1) setGrass(x, 20);
  }
  // 남서 큰길 밑 반쪽 띠(34줄 1~7열) → 풀밭.
  if (isRoadAt(1, 32, /길/) && isRoadAt(1, 33, /길/) && isRoadAt(1, 34, /길/)) for (let x = 1; x <= 7; x += 1) setGrass(x, 34);
  // 남서 큰길 끝 — 모랫길 토막과 가는 나무를 걷고 운하 둑길(16열)까지 잇는다.
  for (const [x, y] of [[11, 13], [12, 13], [14, 33], [14, 34]] as const) if (isRoadAt(x, y, /모랫길/)) setGrass(x, y);
  if (isRoadAt(13, 32, /길/) && isRoadAt(16, 32, /길/)) {
    for (let y = 32; y <= 34; y += 1) clearUpper(15, y);
    for (const x of [14, 15]) for (const y of [32, 33]) setRoad(x, y);
  }
  // 남쪽 큰길 34줄 — 밑동 없이 남은 나무 윗동(29·30열)을 걷고 31열을 잇는다.
  if (isRoadAt(28, 34, /길/) && isRoadAt(32, 34, /길/)) {
    for (const x of [29, 30]) if (/나무/.test(label(up[at(x, 34)]))) clearUpper(x, 34);
    for (let x = 29; x <= 31; x += 1) setRoad(x, 34);
  }
  // 여관 앞 동쪽 큰길 — 동쪽 끝(52~54열)만 32·33줄이라 서쪽 33·34줄과 계단이 졌다 → 33·34줄로 맞춘다(여관 문 앞 50·51열 32줄은 둔다).
  if (isRoadAt(52, 32, /길/) && isRoadAt(52, 33, /길/) && !isRoadAt(52, 34, /길/) && isRoadAt(50, 34, /길/)) {
    for (let x = 52; x <= 54; x += 1) { setRoad(x, 34); setGrass(x, 32); }
  }
  const hash = (x: number, y: number, salt: number): number => (((x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)) >>> 0) % 100;
  // 길 사이 한 칸 풀밭 구멍.
  for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) {
    const i = at(x, y);
    if (lo[i] !== GRASS || up[i]! >= 0 || eventAt.has(i)) continue;
    const r = (dx: number, dy: number): boolean => roadSet.has(lo[at(x + dx, y + dy)]!);
    if ((r(-1, 0) && r(1, 0)) || (r(0, -1) && r(0, 1))) setRoad(x, y);
  }
  // 광장 가장자리 — 판석에 두 면 이상 둘러싸인 풀밭 홈은 판석으로, 판석 한 면에만 닿은 외딴 판석 칸은 풀밭으로.
  const plazaAt = (x: number, y: number): boolean => inside(x, y) && lo[at(x, y)] === PLAZA;
  const solidAt = (x: number, y: number): boolean => inside(x, y) && (up[at(x, y)]! >= 0 || STRUCTURE.test(label(lo[at(x, y)])));
  for (let pass = 0; pass < 4; pass += 1) for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) {
    const i = at(x, y);
    if (eventAt.has(i) || up[i]! >= 0) continue;
    const plazaN = N4.filter(([dx, dy]) => plazaAt(x + dx, y + dy)).length;
    const solidN = N4.filter(([dx, dy]) => solidAt(x + dx, y + dy)).length;
    const innerCorner = (plazaAt(x - 1, y) || plazaAt(x + 1, y)) && (plazaAt(x, y - 1) || plazaAt(x, y + 1)) && pass < 2;
    if (lo[i] === GRASS && plazaN >= 2 && (plazaN + solidN >= 3 || innerCorner)) { lo[i] = PLAZA; if (lo2) lo2[i] = -1; changed.add(i); }
    else if (lo[i] === PLAZA && plazaN <= 1 && !N4.some(([dx, dy]) => paved(x + dx, y + dy) && !plazaAt(x + dx, y + dy))) { lo[i] = GRASS; changed.add(i); }
  }
  // 바꾼 칸과 이웃만 오토타일을 다시 고른다.
  const retile = new Set<number>();
  for (const i of changed) { const x = i % W, y = Math.floor(i / W); retile.add(i); for (const [dx, dy] of N4) if (inside(x + dx, y + dy)) retile.add(at(x + dx, y + dy)); }
  const next = new Map<number, number>();
  for (const i of retile) {
    if (!roadSet.has(lo[i]!)) continue;
    const x = i % W, y = Math.floor(i / W);
    const mask = (isLink(x, y - 1) ? 1 : 0) | (isLink(x + 1, y) ? 2 : 0) | (isLink(x, y + 1) ? 4 : 0) | (isLink(x - 1, y) ? 8 : 0);
    next.set(i, ROAD_BY_MASK[mask]!);
  }
  for (const [i, t] of next) lo[i] = t;

  // 잔디 결 — 부드러운 변형 둘을 불규칙한 덩이(3~6칸)로만 깔고 외톨이 칸은 되돌린다. 길 가장자리 풀밭에는 풀 포기·토끼풀을 띠처럼
  // 이어 깔아 네모 모서리를 흐리고, 들꽃은 나무·벽 발치에만 둔다.
  const solidNear = (x: number, y: number): boolean => N4.some(([dx, dy]) => inside(x + dx, y + dy) && up[at(x + dx, y + dy)]! >= 0 && !TUFT.test(label(up[at(x + dx, y + dy)])) && !paved(x + dx, y + dy));
  const roadEdge = (x: number, y: number): boolean => N4.some(([dx, dy]) => paved(x + dx, y + dy)) || ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).some(([dx, dy]) => paved(x + dx, y + dy));
  const base = lo.map((t) => t === GRASS);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const i = at(x, y);
    if (!base[i]) continue;
    const bx = Math.floor((x + (hash(y, 0, 3) % 3)) / 3), by = Math.floor((y + (hash(x, 0, 5) % 3)) / 3);
    if (hash(bx, by, 31) < 42 && hash(x, y, 41) < 72) lo[i] = SOFT_GRASS[hash(bx, by, 37) % SOFT_GRASS.length]!;
  }
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const i = at(x, y);
    if (!SOFT_GRASS.includes(lo[i]!)) continue;
    if (N4.every(([dx, dy]) => !inside(x + dx, y + dy) || !SOFT_GRASS.includes(lo[at(x + dx, y + dy)]!))) lo[i] = GRASS;
  }
  const roadCorner = (x: number, y: number): boolean => ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const)
    .some(([dx, dy]) => [0, 1, 2].some((k) => paved(x + dx * k, y + dy) && paved(x + dx, y + dy * k)) && !paved(x + dx, y) && !paved(x, y + dy));
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const i = at(x, y);
    if (!base[i] || up[i]! >= 0 || eventAt.has(i)) continue;
    const cx = Math.floor(x / 4), cy = Math.floor(y / 4);
    const clump = hash(cx, cy, 73) < 30 && Math.abs((x % 4) - 1.5) + Math.abs((y % 4) - 1.5) <= 2 && hash(x, y, 79) < 55;
    if (roadCorner(x, y) && hash(x, y, 83) < 85) lo[i] = GRASS_TUFTS[hash(x, y, 61) % GRASS_TUFTS.length]!;
    else if (roadEdge(x, y) && hash(Math.floor(x / 3), Math.floor(y / 3), 53) < 35 && hash(x, y, 59) < 60) lo[i] = GRASS_TUFTS[hash(x, y, 61) % GRASS_TUFTS.length]!;
    else if (clump) lo[i] = hash(cx, cy, 89) < 50 ? 27810 : GRASS_FLOWERS[hash(x, y, 71) % GRASS_FLOWERS.length]!;
    else if (solidNear(x, y) && hash(x, y, 67) < 18) lo[i] = GRASS_FLOWERS[hash(x, y, 71) % GRASS_FLOWERS.length]!;
  }
  // 줄 지은 들꽃 덤불 — 같은 줄에서 두 칸 간격으로 셋 이상 늘어선 덤불은 가운데 것을 걷는다.
  for (let y = 0; y < H; y += 1) for (let x = 2; x < W - 2; x += 1) {
    const i = at(x, y);
    if (eventAt.has(i) || !TUFT.test(label(up[i])) ) continue;
    if (TUFT.test(label(up[at(x - 2, y)])) && TUFT.test(label(up[at(x + 2, y)]))) { up[i] = -1; tufts += 1; }
  }

  // ── 4. 그림자·도달성 ──
  const shadows = clearOrphanShadows(project, map as GameMap);
  const lost = unreachableEvents(project, hubId).filter((id) => !before.has(id));
  if (lost.length) throw new Error(`[fallen-village] 정리 뒤 걸어 닿지 않게 된 이벤트: ${lost.join(", ")}`);
  return { props, tufts, roadCells: changed.size, trees, shadows };
}
