// project/modernCityStreetComposer.ts
// 도쿄풍 도시(modern_city) 거리 구성기 — 맵 크기·씨앗만 주면 매번 다른 거리 블록을 짠다(campusComposer·jpCityStreetComposer 와 같은 순서).
//
// 계획(가로 도로 1~2줄 · 세로 도로 1~2줄, 6칸 차도 + 양쪽 연석·보도 2줄 = 12줄 단면, 만나는 곳은 12×12 교차로 키트)
//   → 건물(띠마다 가로 도로 북쪽 보도를 «문 앞 접근칸 줄»로 삼아 건물 키트를 남향으로 세운다)
//   → 공원 블록 하나(잔디·벽돌 길·분수·벤치·공원 등·나무)
//   → 소품(남쪽 보도 = 가로수·가로등 번갈아, 북쪽 보도 = 문 앞을 피한 소화전·볼라드·쓰레기통, 세로 도로 보도 = 가로등, 교차로 모서리 = 신호등)
//   → 차(가로 도로 차선마다 정차 0~2대, 교차로 2칸 안 금지).
// 조화 규칙: 건물은 키트째(문 = 키트 맨 아랫줄의 access 칸 위), 문 앞 접근칸 줄(가로 도로 첫 보도 줄)은 문 기둥 ±1칸에 아무것도 두지 않는다.
//   소품·나무의 ★(통행 가능 윗줄) 칸도 건물·다른 소품 칸과 겹치지 않는다. 같은 건물 종류는 한 맵에 둘까지, 이웃끼리 같은 종류 금지.
// 순수 함수다(프로젝트를 모른다). 칸 번호는 호출자가 준 사전(palette)에서 — 도구는 번들 정의에서 만든다(modernCityPaletteFromTileset).

import type { MapTransit } from "./mapTransit";
import { composeKoreanDistrict } from "./modernCityKoreanDistrict";
import { autoTrafficRoutes, DEFAULT_MODERN_CAR_MIX, type RoadBand, type StopAnchor } from "./transitAuto";
import { BIG_STREET_TREES, Board, lawnTile, MC_BUILDING_TYPES, mcBuildingType, mulberry, pick, shuffle, type MCBuilding, type MCCell, type MCKit, type MCPalette, type Use } from "./modernCityBoard";

export { MC_BUILDING_TYPES, mcBuildingType };
export type { MCBuilding, MCCell, MCKit, MCPalette };

/**
 * 업무 지구 꾸밈(선택). 없으면 예전 거리 그대로다.
 * - landmark: 가장 먼저(가장 넓은 블록 가운데) 세울 건물 종류 — 예 "tower10"(유리 오피스 타워). 그 건물이 buildings[0] 이다.
 * - subwayExits: 지하철 출구 수(1~4). 출구마다 번호 표지(mc-prop-kr-exit-N, 칩셋에 있으면)를 옆에 세우고 결과 subwayExits 에 번호·계단 칸을 준다.
 * - korean: 한국 거리 단서 — 보도 점자 블록 줄·가로수 보호판·버스 쉘터·자전거 거치대·한글 세로 입간판(칩셋에 있는 키트만).
 */
export interface MCDistrict {
  readonly landmark?: string; readonly subwayExits?: number; readonly korean?: boolean;
  /** 한국 지구 종류(modernCityDistrictKinds) — 종류 id·이름 또는 "auto". 주면 한국 지구 구성기(modernCityKoreanDistrict.ts)가 짓는다. */
  readonly kind?: string;
  /** 게임 열쇠(같은 게임 = 같은 순서) · 그 게임이 이미 쓴 종류 id — 종류 고르기에만 쓴다. */
  readonly key?: string; readonly used?: readonly string[];
}
export interface MCStreetSpec { readonly width: number; readonly height: number; readonly seed?: number; readonly shops?: readonly string[]; readonly district?: MCDistrict }
/** 지하철 출구 하나: 번호·입구 덩어리 왼쪽 위 칸·계단 칸(막힘, 문 이벤트 자리)·발판(계단 바로 아래 걸을 칸). */
export interface MCSubwayExit { readonly n: number; readonly at: MCCell; readonly stair: MCCell; readonly step: MCCell }
export interface MCStreetResult {
  readonly lower: number[];
  readonly upper: number[];
  readonly upper2: number[];
  readonly buildings: MCBuilding[];
  readonly start: MCCell;
  readonly props: { kit: string; x: number; y: number }[];
  readonly roads: { horizontal: number[]; vertical: number[] };
  readonly park: { x: number; y: number; w: number; h: number } | null;
  readonly notes: string[];
  readonly transit: MapTransit;
  readonly subwayExits: MCSubwayExit[];
  /** 한국 지구 구성기가 지었으면 그 종류. */
  readonly district?: { readonly id: string; readonly ko: string; readonly en: string };
}

export const MODERN_CITY_STREET_MIN = { w: 40, h: 30 } as const;
export const MODERN_CITY_STREET_MAX = { w: 120, h: 100 } as const;

/** 거리마다 하나씩은 넣는 종류(씨앗이 순서를 섞는다) — 실내 예제가 있는 건물. */
const MUST: readonly string[][] = [["conv"], ["office", "office-wide", "mid4"], ["hospital"], ["cafe"], ["bank"], ["apartment", "apt-balcony", "balcony2", "low3"], ["mid6", "hotel", "dept"]];
/** 한 맵에 하나뿐인 랜드마크(옥상 헬기장 병원·백화점·호텔·관공서·타워) — 둘이 서면 복제한 거리로 보인다(R6 VQA: 헬기장 병원 셋). 나머지 종류는 둘까지. */
const ONE_PER_MAP: ReadonlySet<string> = new Set(["hospital", "dept", "hotel", "police", "fire", "post", "tower10", "tower10b", "school"]);
function typeLimit(type: string): number { return ONE_PER_MAP.has(type) ? 1 : 2; }


/** 띠 한 칸(가로 도로 북쪽) 정면 건물 줄. */
function frontage(b: Board, r: () => number, x0: number, x1: number, accessY: number, maxH: number, counts: Map<string, number>, queue: string[][], wishes: string[], landmark?: { type: string; x: number }) {
  const all = b.pal.buildingKits();
  const byType = new Map<string, string[]>();
  for (const id of all) { const t = mcBuildingType(id); if (!MC_BUILDING_TYPES[t]) continue; (byType.get(t) ?? byType.set(t, []).get(t)!).push(id); }
  let x = x0 + (r() < 0.5 ? 0 : 1), prev = "";
  const fitsKit = (id: string, at: number) => { const k = b.kit(id); return k.height <= maxH && at + k.width - 1 <= x1 && b.fits(id, at, accessY - k.height, ["walk", "ground"]); };
  // 랜드마크: 이 블록에서 정한 자리(landmark.x)까지는 보통 건물로 채우고, 그 자리에 랜드마크를 세운 뒤 이어 간다.
  let pendingLandmark = landmark;
  while (x <= x1 - 3) {
    if (pendingLandmark && x >= pendingLandmark.x - 1) {
      const ids = (byType.get(pendingLandmark.type) ?? []).filter((id) => fitsKit(id, x));
      if (ids.length) {
        const id = pick(r, ids); const kit = b.kit(id); const y = accessY - kit.height;
        b.stamp(id, x, y, "bld");
        const acc = (kit.access?.length ? kit.access : [{ dx: Math.floor(kit.width / 2), dy: kit.height }]).filter((a, i, all) => all.findIndex((o) => o.dx === a.dx) === i);
        const access = acc.map((a) => ({ x: x + a.dx, y: y + a.dy }));
        for (const a of access) for (const dx of [-1, 0, 1]) for (const dy of [0, 1]) if (b.in(a.x + dx, a.y + dy)) b.keep[b.k(a.x + dx, a.y + dy)] = true;
        const info = MC_BUILDING_TYPES[pendingLandmark.type]!;
        b.buildings.unshift({ name: info.ko, kind: pendingLandmark.type, kit: id, rect: { x, y, w: kit.width, h: kit.height }, doors: access.map((a) => ({ x: a.x, y: a.y - 1 })), access, ...(info.program ? { program: info.program } : {}) });
        counts.set(pendingLandmark.type, (counts.get(pendingLandmark.type) ?? 0) + 1); prev = pendingLandmark.type;
        x += kit.width + 1; pendingLandmark = undefined; continue;
      }
      b.notes.push(`랜드마크 ${pendingLandmark.type} 를 (${x},${accessY - 1}) 에 세울 수 없었다`); pendingLandmark = undefined;
    }
    const room = x1 - x + 1;
    const candTypes = (types: readonly string[]) => types.filter((t) => t !== prev && (counts.get(t) ?? 0) < typeLimit(t) && (byType.get(t) ?? []).some((id) => fitsKit(id, x)));
    let type: string | undefined;
    // 사용자가 고른 가게 → 반드시 넣을 종류 → 무게 뽑기
    for (let i = 0; i < wishes.length && !type; i++) { const c = candTypes([wishes[i]!]); if (c.length) { type = c[0]; wishes.splice(i, 1); } }
    for (let i = 0; i < queue.length && !type; i++) { const c = candTypes(queue[i]!); if (c.length) { type = pick(r, c); queue.splice(i, 1); } }
    if (!type) {
      const c = candTypes([...byType.keys()]);
      if (!c.length) { if (room >= 4) b.notes.push(`(${x}..${x1},${accessY - 1}) 에 맞는 건물이 없어 비웠다`); break; }
      // 띠 높이에 가까운 건물을 더 자주(건물 뒤 빈 잔디 띠가 넓어지지 않게 — 거리 QA C1)
      const hOf = (t: string) => Math.max(...(byType.get(t) ?? []).filter((id) => fitsKit(id, x)).map((id) => b.kit(id).height));
      const wt = (t: string) => MC_BUILDING_TYPES[t]!.weight * (0.25 + 1.5 * (hOf(t) / maxH) ** 2);
      const total = c.reduce((s, t) => s + wt(t), 0); let w = r() * total;
      type = c.find((t) => (w -= wt(t)) < 0) ?? c[0]!;
    }
    const ids = (byType.get(type) ?? []).filter((id) => fitsKit(id, x));
    const tallest = Math.max(...ids.map((i) => b.kit(i).height));
    const id = pick(r, ids.filter((i) => b.kit(i).height === tallest)); const kit = b.kit(id);
    const y = accessY - kit.height;
    b.stamp(id, x, y, "bld");
    const acc = (kit.access?.length ? kit.access : [{ dx: Math.floor(kit.width / 2), dy: kit.height }]).filter((a, i, all) => all.findIndex((o) => o.dx === a.dx) === i);
    const access = acc.map((a) => ({ x: x + a.dx, y: y + a.dy }));
    const doors = access.map((a) => ({ x: a.x, y: a.y - 1 }));
    for (const a of access) for (const dx of [-1, 0, 1]) for (const dy of [0, 1]) if (b.in(a.x + dx, a.y + dy)) b.keep[b.k(a.x + dx, a.y + dy)] = true;
    const info = MC_BUILDING_TYPES[type]!;
    b.buildings.push({ name: info.ko, kind: type, kit: id, rect: { x, y, w: kit.width, h: kit.height }, doors, access, ...(info.program ? { program: info.program } : {}) });
    counts.set(type, (counts.get(type) ?? 0) + 1); prev = type;
    x += kit.width + (r() < 0.45 ? 0 : r() < 0.7 ? 1 : 2);
  }
  // 건물 뒤(북쪽) 빈 띠 — 잔디 + 관목·침엽수 덩이(빈 포석 마당 방지)
  const green = b.pal.group("mc:green");
  for (let X = x0; X <= x1; X++) {
    let top = accessY - 1; while (top >= 0 && b.use[b.k(X, top)] === "bld") top--;
    for (let Y = top; Y >= accessY - maxH && Y >= 0; Y--) { const i = b.k(X, Y); if (b.use[i] !== "ground" && b.use[i] !== "walk") break; if (Y < accessY - 1 && green.length) { b.lower[i] = lawnTile(b.pal, X, Y); b.use[i] = "park"; } }
  }
  // 잎 덩이 큰 나무(있으면)는 한 열에 위아래 둘까지 — 건물 뒤 녹지가 빈 잔디 판으로 남지 않게(버들항처럼 나무 덩이로 채운다).
  const bigOk = !!b.pal.kit("mc-prop-keyaki-a");
  for (let X = x0; X <= x1 - 1; X += (bigOk ? 2 : 3) + Math.floor(r() * 3)) {
    let placed = 0;
    for (let Y = accessY - 2; Y >= Math.max(1, accessY - maxH) && placed < (bigOk ? 2 : 1); Y--) {
      let id = r() < (bigOk ? 0.6 : 0.5) ? pick(r, bigOk ? ["mc-prop-keyaki-a", "mc-prop-keyaki-b", "mc-prop-keyaki-a", "mc-prop-conifer-a", "mc-prop-ginkgo-big-a"] : ["mc-prop-conifer-a", "mc-prop-conifer-b", "mc-prop-street-tree-a"]) : pick(r, ["mc-prop-azalea-a", "mc-prop-azalea-b", "mc-prop-shrub-a", "mc-prop-hedge-a"]);
      if (!b.pal.kit(id)) id = "mc-prop-shrub-a";
      const k = b.pal.kit(id); if (!k) continue;
      if (b.prop(id, X, Y - k.height + 1, ["park"], 0)) { placed++; Y -= k.height; }
    }
  }
}

function park(b: Board, r: () => number, x0: number, y0: number, x1: number, y1: number) {
  const green = b.pal.group("mc:green"), plaza = b.pal.group("mc:plaza");
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = b.k(x, y); b.lower[i] = green.length ? lawnTile(b.pal, x, y) : b.lower[i]!; b.use[i] = "park"; }
  const cx = x0 + Math.floor(w / 2), cy = y0 + Math.floor(h / 2);
  // 벽돌 길: 남쪽 보도에서 가운데로, 가운데 가로 길
  for (let y = cy - 2; y <= y1; y++) for (const x of [cx - 1, cx]) { const i = b.k(x, y); b.lower[i] = plaza[0]!; b.use[i] = "walk"; }
  for (let x = x0 + 1; x <= x1 - 1; x++) { const i = b.k(x, cy + 2); b.lower[i] = plaza[(x % 2)]!; b.use[i] = "walk"; }
  for (let y = cy - 2; y <= cy + 1; y++) for (let x = cx - 3; x <= cx + 2; x++) { const i = b.k(x, y); b.lower[i] = plaza[1] ?? plaza[0]!; b.use[i] = "walk"; }
  b.prop("mc-prop-fountain-a", cx - 2, cy - 2, ["walk"]);
  for (const [x, y] of [[cx - 4, cy + 3], [cx + 2, cy + 3]] as const) b.prop(pick(r, ["mc-prop-bench-a", "mc-prop-bench-b"]), x, y, ["park"]);
  for (const [x, y] of [[cx - 4, cy - 2], [cx + 3, cy - 2]] as const) b.prop(pick(r, ["mc-prop-park-lamp-a", "mc-prop-park-lamp-b"]), x, y, ["park"]);
  // 큰 공원 나무(4×5) 먼저 하나, 그다음 잎 덩이 큰 나무(3×4)와 옛 꽃나무를 섞는다.
  const big = b.pal.kit("mc-prop-park-tree-a");
  if (big) for (let tries = 0; tries < 40; tries++) {
    const x = x0 + Math.floor(r() * Math.max(1, w - 4)), y = y0 + Math.floor(r() * Math.max(1, h - 5));
    if (b.prop("mc-prop-park-tree-a", x, y, ["park"], 1)) break;
  }
  const trees = b.pal.kit("mc-prop-keyaki-a")
    ? ["mc-prop-keyaki-a", "mc-prop-keyaki-b", "mc-prop-ginkgo-big-a", "mc-prop-blossom-a", "mc-prop-blossom-b", "mc-prop-conifer-a"]
    : ["mc-prop-blossom-a", "mc-prop-blossom-b", "mc-prop-ginkgo-a", "mc-prop-ginkgo-b", "mc-prop-street-tree-a", "mc-prop-conifer-a"];
  let n = 0;
  for (let tries = 0; tries < 80 && n < Math.max(4, Math.floor(w * h / 28)); tries++) {
    const x = x0 + Math.floor(r() * (w - 1)), y = y0 + 2 + Math.floor(r() * Math.max(1, h - 3));
    const id = pick(r, trees);
    if (b.prop(id, x, y - (b.kit(id).height - 1), ["park"], 1)) n++;
  }
  const shrubs = b.pal.kit("mc-prop-azalea-a") ? ["mc-prop-azalea-a", "mc-prop-azalea-b"] : ["mc-prop-shrub-a", "mc-prop-shrub-b"];
  for (let tries = 0, m = 0; tries < 40 && m < 2; tries++) { const x = x0 + Math.floor(r() * w), y = y0 + Math.floor(r() * h); if (b.prop(pick(r, shrubs), x, y - 1, ["park"], 1)) m++; }
}

/**
 * 마지막 가로 도로 아래 얕은 띠(건물이 못 서는 4~7줄) — 길가 녹지. 빈 회색 보도로 맵 바닥이 끝나지 않게(R6 VQA)
 * 세로 도로 사이 구간을 9~14칸 필지로 나눠 정원(생울타리·큰 나무·철쭉) · 카페 테라스(포석·파라솔 자리·매점) · 놀이터(잔디·모래밭·벤치)를
 * 이웃끼리 다르게 앉힌다. 필지 사이엔 1칸 포석 샛길을 남긴다.
 */
function roadsideVerge(b: Board, r: () => number, y0: number, y1: number) {
  const plaza = b.pal.group("mc:plaza");
  const h = y1 - y0 + 1;
  const segs: { x0: number; x1: number }[] = [];
  for (let x = 0; x < b.W; x++) {
    if (b.use[b.k(x, y0)] !== "ground") continue;
    const last = segs[segs.length - 1];
    if (last && last.x1 === x - 1) last.x1 = x; else segs.push({ x0: x, x1: x });
  }
  const paveAt = (x: number, y: number) => { const i = b.k(x, y); b.lower[i] = plaza[(x + y) % plaza.length] ?? b.lower[i]!; b.use[i] = "walk"; };
  const lawnAt = (x: number, y: number) => { const i = b.k(x, y); b.lower[i] = lawnTile(b.pal, x, y); b.use[i] = "park"; };
  const kinds = ["garden", "terrace", "play"] as const;
  let prev = "";
  const tryProp = (ids: readonly string[], x0: number, x1: number, yBottom: number, allow: readonly Use[], margin: number, tries = 12) => {
    for (let t = 0; t < tries; t++) {
      const id = pick(r, ids); const k = b.pal.kit(id); if (!k) continue;
      const x = x0 + Math.floor(r() * Math.max(1, x1 - x0 - k.width + 2)), y = yBottom - k.height + 1;
      if (y >= y0 && b.prop(id, x, y, allow, margin)) return true;
    }
    return false;
  };
  for (const s of segs) {
    let x = s.x0;
    while (x <= s.x1) {
      let w = 9 + Math.floor(r() * 6);
      if (s.x1 - (x + w - 1) < 6) w = s.x1 - x + 1;
      const lx0 = x, lx1 = x + w - 1;
      const kind = pick(r, kinds.filter((k) => k !== prev)); prev = kind;
      for (let y = y0; y <= y1; y++) for (let X = lx0; X <= lx1; X++) (kind === "terrace" ? paveAt : lawnAt)(X, y);
      if (lx1 < s.x1) for (let y = y0; y <= y1; y++) paveAt(lx1, y);     // 필지 사이 샛길
      const ix1 = lx1 < s.x1 ? lx1 - 1 : lx1;
      if (kind === "garden") {
        const cx = lx0 + Math.floor((ix1 - lx0) / 2);
        for (let y = y0; y <= y1; y++) for (const X of [cx, cx + 1]) if (X <= ix1) paveAt(X, y);   // 보도에서 드는 오솔길
        const big = h >= 6 ? ["mc-prop-park-tree-a", "mc-prop-keyaki-a", "mc-prop-keyaki-b", "mc-prop-ginkgo-big-a"] : h >= 5 ? ["mc-prop-keyaki-a", "mc-prop-keyaki-b", "mc-prop-ginkgo-big-a"] : ["mc-prop-blossom-a", "mc-prop-blossom-b", "mc-prop-ginkgo-a"];
        tryProp(big, lx0, cx - 1, y1, ["park"], 0);
        tryProp(big, cx + 2, ix1, y1, ["park"], 0);
        if (h >= 5) for (let X = lx0; X + 1 <= ix1; X += 2) if (X + 1 < cx || X > cx + 1) b.prop(pick(r, ["mc-prop-hedge-a", "mc-prop-hedge-b"]), X, y0, ["park"]);
        tryProp(["mc-prop-azalea-a", "mc-prop-azalea-b", "mc-prop-shrub-a"], lx0, ix1, y1, ["park"], 0, 8);
        b.prop(pick(r, ["mc-prop-park-lamp-a", "mc-prop-park-lamp-b"]), cx - 1, y0 + 1, ["park"]);
      } else if (kind === "terrace") {
        b.prop(pick(r, ["mc-prop-kiosk-a", "mc-prop-kiosk-b", "mc-prop-kiosk-c"]), lx0 + 1, y0 + 1, ["walk"]);
        for (let ty = y0 + 1; ty + 1 <= y1 - (h >= 6 ? 1 : 0); ty += 3) for (let tx = lx0 + 4; tx + 1 <= ix1 - 1; tx += 3) b.prop(pick(r, ["mc-prop-terrace-a", "mc-prop-terrace-b", "mc-prop-terrace-c"]), tx, ty, ["walk"]);
        b.prop(pick(r, ["mc-prop-bigpot-a", "mc-prop-bigpot-b"]), ix1, y0, ["walk"]);
        b.prop(pick(r, ["mc-prop-vending-a", "mc-prop-vending2-a", "mc-prop-vending2-b"]), lx0, y1 - 1, ["walk"]);
      } else {
        b.prop(pick(r, ["mc-prop-sand-a", "mc-prop-sand-b", "mc-prop-sand-c"]), lx0 + 2, y0 + 1 + Math.floor(r() * Math.max(1, h - 3)), ["park"], 1);
        b.prop(pick(r, ["mc-prop-bench-a", "mc-prop-bench-b"]), lx0 + 5 + Math.floor(r() * 2), y1 - 1, ["park"]);
        tryProp(["mc-prop-blossom-a", "mc-prop-blossom-b", "mc-prop-conifer-a", "mc-prop-ginkgo-a"], lx0 + 5, ix1, y1, ["park"], 0);
        b.prop(pick(r, ["mc-prop-park-lamp-a", "mc-prop-park-lamp-c"]), lx0, y0, ["park"]);
        tryProp(["mc-prop-azalea-a", "mc-prop-azalea-b"], lx0, ix1, y1, ["park"], 0, 8);
      }
      x = lx1 + 1;
    }
  }
}

/**
 * 한국 업무 지구 보도 단서(칩셋에 있는 키트·칸만 쓴다). 소품·건물 위치는 그대로 두고 빈 보도 칸만 고친다.
 * - 점자 블록(mc-in-mci-tactile 의 칸): 가로 도로 남쪽 보도 안쪽 줄(yy+10)과 북쪽 보도 바깥 줄(yy+1)에 한 줄, 문 앞·소품 칸은 건너뛴다.
 * - 가로수 보호판(mc-prop-kr-tree-grate): 큰 가로수 줄기 칸의 아래층(보도 포석일 때).
 * - 버스 쉘터(mc-prop-bus-shelter-a): 정류장 표지 옆, 자전거 거치대(mc-prop-bike-row-a): 북쪽 보도 건물 쪽 빈 3칸.
 * - 세로 입간판(mc-prop-kr-sign-*): 가게(카페·편의점·식당) 문 옆 북쪽 보도.
 */
function koreanStreetCues(b: Board, r: () => number, hz: readonly number[], vt: readonly number[], busStops: readonly { x: number; y: number }[]) {
  const tactile = b.pal.kit("mc-in-mci-tactile")?.rows[0]?.upperTiles?.[0] ?? b.pal.kit("mc-in-mci-tactile")?.rows[0]?.tiles[0];
  const nearCross = (x: number, pad: number) => vt.some((v) => x >= v - pad && x < v + 12 + pad);
  const free = (x: number, y: number) => b.in(x, y) && b.use[b.k(x, y)] === "walk" && b.upper[b.k(x, y)] < 0;
  if (tactile !== undefined && tactile >= 0) {
    for (const yy of hz) for (const row of [yy + 1, yy + 10]) for (let x = 0; x < b.W; x++) {
      if (nearCross(x, 0) || !free(x, row)) continue;
      b.lower[b.k(x, row)] = tactile;
    }
  }
  const grate = b.pal.kit("mc-prop-kr-tree-grate")?.rows[0]?.tiles[0];
  if (grate !== undefined && grate >= 0) {
    for (const p of b.props) {
      if (!BIG_STREET_TREES.includes(p.kit as (typeof BIG_STREET_TREES)[number])) continue;
      // 줄기 칸(맨 아랫줄 가운데)의 아래층 — 줄기 그림 둘레로 보호판이 보인다. 보도 포석 칸일 때만.
      const k = b.kit(p.kit); const tx = p.x + Math.floor(k.width / 2), ty = p.y + k.height - 1;
      if (b.in(tx, ty) && b.pal.group("mc:sidewalk").includes(b.lower[b.k(tx, ty)]!)) b.lower[b.k(tx, ty)] = grate;
    }
  }
  if (b.pal.kit("mc-prop-bus-shelter-a")) for (const s of busStops) {
    const y = s.y + 2;   // 정류장 표지 발밑 줄(서행 차선 + 2 = 보도 연석 줄 바로 아래)
    for (const dx of [2, 3, -3, -4]) if (b.prop("mc-prop-bus-shelter-a", s.x + dx, y, ["walk", "road"])) break;
  }
  if (b.pal.kit("mc-prop-bike-row-a")) for (const yy of hz) {
    let n = 0;
    for (let tries = 0; tries < 30 && n < 2; tries++) {
      const x = 1 + Math.floor(r() * (b.W - 4)); if (nearCross(x, 1) || nearCross(x + 2, 1)) continue;
      if (b.prop("mc-prop-bike-row-a", x, yy, ["walk"], 1)) n++;
    }
  }
  const signFor: Record<string, string> = { cafe: "mc-prop-kr-sign-cafe", conv: "mc-prop-kr-sign-conv", izakaya: "mc-prop-kr-sign-food", bakery: "mc-prop-kr-sign-cafe", shop: "mc-prop-kr-sign-pharm", hospital: "mc-prop-kr-sign-pharm" };
  for (const d of b.buildings) {
    const id = signFor[d.kind]; if (!id || !b.pal.kit(id)) continue;
    const ax = d.access[0]!; const left = d.rect.x - 1, right = d.rect.x + d.rect.w;
    for (const sx of [right, left, d.rect.x, d.rect.x + d.rect.w - 1]) if (Math.abs(sx - ax.x) >= 2 && b.prop(id, sx, ax.y - 1, ["walk", "ground", "park"])) break;
  }
}

export function composeModernCityStreet(spec: MCStreetSpec, pal: MCPalette): MCStreetResult {
  const W = spec.width, H = spec.height, seed = spec.seed ?? 0;
  if (W < MODERN_CITY_STREET_MIN.w || H < MODERN_CITY_STREET_MIN.h) throw new Error(`맵이 작다(${W}×${H}) — ${MODERN_CITY_STREET_MIN.w}×${MODERN_CITY_STREET_MIN.h} 이상`);
  // 한국 지구 종류를 받으면 한국 지구 구성기가 짓는다(길 위계·벽을 맞댄 건물 줄·필지 쓰임). korean:true 만 준 옛 호출은 아래 도쿄풍 길 그대로다.
  if (spec.district?.kind) return composeKoreanDistrict(spec, pal);
  const r = mulberry(seed * 7919 + W * 31 + H);
  const b = new Board(W, H, pal);
  // 계획: 가로 도로(12줄 단면) + 건물 띠. 띠 높이(8~13)와 맨 아래 남는 줄을 씨앗으로 나눠 같은 맵 크기라도 도로망이 매번 달라지게 한다
  // (R5 적대적 QA: 씨앗만 바꾸면 가로 도로 y 가 늘 같았다). 맨 아래 남는 줄은 남향 건물 띠(10~13) 또는 길가 녹지 띠(4~7, roadsideVerge).
  // 남김 0 은 맵이 마지막 도로의 맨 보도 줄에서 끝나 빈 회색 보도가 바닥 가장자리를 이루므로(R6 VQA) 다른 나눔이 없을 때만 쓴다.
  // 8·9줄 남김은 건물이 서지 못하고 녹지로는 너무 넓어 빈 잔디 판이 되어 뺀다.
  const hz: number[] = [];
  const nH = Math.max(1, Math.min(3, Math.floor(H / 22)));
  const free = H - 12 * nH;
  if (Math.floor(free / nH) < 6) throw new Error(`맵 높이 ${H} 로는 건물 띠를 세울 수 없다`);
  const splits: number[][] = [];
  const grow = (acc: number[], left: number) => {
    if (acc.length === nH) { if (left === 0 || (left >= 4 && left <= 7) || (left >= 10 && left <= 13)) splits.push(acc); return; }
    for (let h = 8; h <= 13 && h <= left; h++) grow([...acc, h], left - h);
  };
  grow([], free);
  const sumOf = (s: readonly number[]) => s.reduce((a, c) => a + c, 0);
  const filled = splits.filter((s) => sumOf(s) < free);
  // 랜드마크(높은 타워)를 원하면 그 키트가 서는 띠(≥ 키트 높이)가 있는 나눔만 고른다 — 없으면 예전 그대로.
  const district = spec.district ?? {};
  const landmarkType = district.landmark && MC_BUILDING_TYPES[district.landmark] ? district.landmark : undefined;
  const landmarkKits = landmarkType ? pal.buildingKits().filter((id) => mcBuildingType(id) === landmarkType) : [];
  const landmarkH = landmarkKits.length ? Math.min(...landmarkKits.map((id) => pal.kit(id)!.height)) : 0;
  const tallEnough = (s: readonly number[]) => landmarkH === 0 || s.some((h) => h >= landmarkH);
  const pool = filled.length ? filled : splits;
  const choices = pool.some(tallEnough) ? pool.filter(tallEnough) : pool;
  // 8줄 띠도 못 넣는 작은 맵: 옛 균등 분할(띠 ≤ 11, 남는 1~2 줄은 첫 띠로).
  const even = Math.min(11, Math.floor(free / nH)), evenSpare = free - even * nH;
  const split = choices.length ? choices[Math.floor(r() * choices.length)]! : [even + (evenSpare <= 2 ? evenSpare : 0), ...Array<number>(nH - 1).fill(even)];
  let y = 0;
  for (let i = 0; i < nH; i++) { y += split[i]!; hz.push(y); y += 12; }
  // 세로 도로 — 블록 폭 ≥ 16
  const vt: number[] = [];
  const nV = W >= 84 ? 2 : 1;
  if (nV === 1) vt.push(Math.max(16, Math.min(W - 28, Math.floor(W * (0.3 + r() * 0.25)))));
  else { const a = Math.floor((W - 24) / 3); vt.push(a - 2 + Math.floor(r() * 5)); vt.push(Math.min(W - 16 - 12, vt[0]! + 12 + a - 2 + Math.floor(r() * 5))); }
  for (const yy of hz) for (let x = 0; x < W; x++) b.ground("mc-street-ew-section", x, yy, "road");
  for (const xx of vt) for (let yy = 0; yy < H; yy++) b.ground("mc-street-ns-section", xx, yy, "road");
  for (const yy of hz) for (const xx of vt) b.ground("mc-intersection-12x12", xx, yy, "road");
  // 띠: 가로 도로마다 북쪽(그 도로 첫 보도 줄이 접근칸 줄)
  const counts = new Map<string, number>();
  const queue = shuffle(r, MUST.map((m) => [...m]));
  // 손님이 고른 가게 순서는 씨앗으로 섞는다 — 그대로 두면 매번 맨 왼쪽 위 블록이 편의점·카페·은행 순으로 같았다(R6 VQA).
  const wishes = shuffle(r, [...(spec.shops ?? [])].map((s) => s.replace(/^mc-bld-/, "")));
  const edges = [-1, ...vt.flatMap((v) => [v, v + 11]), W].sort((a, c) => a - c);
  const blocks: { x0: number; x1: number; y0: number; y1: number; accessY: number }[] = [];
  hz.forEach((yy, i) => {
    const top = i === 0 ? 0 : hz[i - 1]! + 12;
    for (let j = 0; j + 1 < edges.length; j += 2) {
      const x0 = edges[j]! + 1, x1 = edges[j + 1]! - 1;
      if (x1 - x0 + 1 >= 6) blocks.push({ x0, x1, y0: top, y1: yy - 1, accessY: yy });
    }
  });
  // 마지막 도로 아래 남는 띠 — 10줄 이상이면 남향 건물 줄(맨 아래 보도 2줄이 접근칸 줄), 아니면 길가 녹지 띠.
  const lastBottom = hz.length ? hz[hz.length - 1]! + 12 : 0;
  const bottomRows = H - lastBottom;
  if (bottomRows >= 10) {
    for (let j = 0; j + 1 < edges.length; j += 2) {
      const x0 = edges[j]! + 1, x1 = edges[j + 1]! - 1;
      if (x1 - x0 + 1 >= 6) blocks.push({ x0, x1, y0: lastBottom, y1: H - 3, accessY: H - 2 });
    }
  }
  // 공원 블록: 모든 띠(맨 위·맨 아래 포함)의 넉넉한 블록 중 씨앗으로 하나 — 늘 둘째 띠 오른쪽에 서던 분수 공원(R6 VQA)을 맵 곳곳으로.
  // 랜드마크 블록: 띠 높이가 그 건물 키트를 품는 블록 중 가장 넓은 것(같으면 맨 위 띠) — 공원 후보에서 뺀다.
  const landmarkBlock = landmarkType ? [...blocks].filter((k) => k.accessY - k.y0 >= landmarkH && k.x1 - k.x0 >= 8).sort((p, q) => (q.x1 - q.x0) - (p.x1 - p.x0) || p.y0 - q.y0)[0] : undefined;
  if (landmarkType && !landmarkBlock) b.notes.push(`랜드마크 ${landmarkType} 가 들어갈 만큼 높은 띠가 없다(키트 높이 ${landmarkH}) — 맵을 높이거나 seed 를 바꾼다`);
  const parkable = blocks.filter((k) => k !== landmarkBlock && k.x1 - k.x0 >= 13 && k.y1 - k.y0 >= 8);
  const parkBlock = blocks.length >= 3 && parkable.length ? pick(r, parkable) : null;
  // 지하철 출구 여럿: 건물 줄 사이에 5칸 틈(입구 3 + 번호 표지 1 + 여백 1)을 먼저 비워 둔다 — 출구는 북쪽 보도로 열린다.
  // 블록을 나눠 건물 줄을 틈 양쪽에 따로 세운다(frontage 는 한 자리에 맞는 건물이 없으면 그 블록을 끝내므로 틈을 건너뛰지 못한다).
  const wantExits = Math.max(1, Math.min(4, Math.round(district.subwayExits ?? 1)));
  const gaps = new Map<(typeof blocks)[number], number[]>();
  if (wantExits > 1) {
    // 후보 = 각 블록에서 틈(5칸)이 들어갈 x 전부(양 끝 4칸·랜드마크 자리 비움). 이미 고른 틈과 9칸 이상 떨어진 것 중 씨앗으로 고른다.
    const cands: { k: (typeof blocks)[number]; x: number }[] = [];
    for (const k of blocks) {
      if (k === parkBlock || k.accessY - k.y0 < 4) continue;
      const lmX = k === landmarkBlock ? k.x0 + Math.max(0, Math.floor((k.x1 - k.x0 + 1 - 6) / 2)) : -99;
      for (let x = k.x0 + 1; x + 4 <= k.x1 - 1; x++) if (!(x + 5 > lmX && x < lmX + 6)) cands.push({ k, x });
    }
    const chosen: { k: (typeof blocks)[number]; x: number }[] = [];
    // 서로 다른 블록을 먼저(출구가 거리 곳곳에), 그다음 같은 블록 안 먼 자리.
    for (const pass of [0, 1]) for (const c of shuffle(r, [...cands])) {
      if (chosen.length >= wantExits) break;
      if (pass === 0 && chosen.some((o) => o.k === c.k)) continue;
      if (chosen.some((o) => o.k === c.k && Math.abs(o.x - c.x) < 9)) continue;
      chosen.push(c);
    }
    for (const c of chosen) gaps.set(c.k, [...(gaps.get(c.k) ?? []), c.x].sort((p, q) => p - q));
  }
  const exitGaps: { x: number; accessY: number }[] = [];
  for (const k of blocks) {
    if (k === parkBlock) { park(b, r, k.x0, k.y0, k.x1, k.y1); continue; }
    const lmX = k === landmarkBlock && landmarkType ? k.x0 + Math.max(0, Math.floor((k.x1 - k.x0 + 1 - 6) / 2)) : -1;
    let from = k.x0;
    for (const gx of [...(gaps.get(k) ?? []), k.x1 + 1]) {
      const to = gx - 1;
      const lm = lmX >= from && lmX + 5 <= to && landmarkType ? { type: landmarkType, x: lmX } : undefined;
      if (to - from + 1 >= 4) frontage(b, r, from, to, k.accessY, k.accessY - k.y0, counts, queue, wishes, lm);
      if (gx <= k.x1) exitGaps.push({ x: gx, accessY: k.accessY });
      from = gx + 5;
    }
  }
  if (bottomRows >= 10) {
    for (let x = 0; x < W; x++) for (const yy of [H - 2, H - 1]) { const i = b.k(x, yy); if (b.use[i] === "ground") b.use[i] = "walk"; }
  } else if (bottomRows > 0) {
    roadsideVerge(b, r, lastBottom, H - 1);
  }
  // 소품: 가로 도로
  const nearCross = (x: number, pad: number) => vt.some((v) => x >= v - pad && x < v + 12 + pad);
  const trees = ["mc-prop-street-tree-a", "mc-prop-street-tree-b", "mc-prop-ginkgo-a", "mc-prop-tree-a"];
  const busStops: Array<{ x: number; y: number; at?: StopAnchor; name?: string; waitSec?: number }> = [];
  for (const yy of hz) {
    // 남쪽 보도: 가로수·가로등 번갈아(발밑 = 맨 아래 보도 줄 yy+11, ★ 윗줄은 연석·보도 위)
    let alt = r() < 0.5;
    for (let x = 1 + Math.floor(r() * 3); x < W - 2; x += 5 + Math.floor(r() * 3)) {
      if (nearCross(x, 1) || nearCross(x + 1, 1)) continue;
      // 큰 가로수(3×4): 줄기는 맨 아래 보도 줄(yy+11) 가운데 칸, 수관은 연석·차도 위로 걸친다. 없거나 안 맞으면 옛 2×3.
      if (alt) { const big = BIG_STREET_TREES.filter((id) => b.pal.kit(id)); if (!(big.length && !nearCross(x + 2, 1) && b.prop(pick(r, big), x, yy + 8, ["walk", "road"]))) b.prop(pick(r, trees), x, yy + 9, ["walk", "road"]); }
      else b.prop("mc-prop-lamp-a", x, yy + 9, ["walk", "road"]);
      alt = !alt;
    }
    // 버스 정류장 하나(남쪽 보도): 표지 + 벤치, 서행 차선(yy+7)에 버스 정차점 연결
    for (let tries = 0; tries < 12; tries++) {
      const x = 2 + Math.floor(r() * (W - 6)); if (nearCross(x, 2) || nearCross(x + 3, 2)) continue;
      if (b.fits("mc-prop-busstop-a", x, yy + 9, ["walk", "road"]) && b.fits("mc-prop-bench2-a", x + 1, yy + 11, ["walk"])) {
        b.prop("mc-prop-busstop-a", x, yy + 9, ["walk", "road"]);
        b.prop("mc-prop-bench2-a", x + 1, yy + 11, ["walk"]);
        busStops.push({ x: x + 1, y: yy + 7, at: "center", name: "버스 정류장", waitSec: 4 });
        break;
      }
    }
    // 북쪽 보도 둘째 줄: 문 앞(keep) 피한 작은 소품
    for (let x = 2 + Math.floor(r() * 3); x < W - 1; x += 4 + Math.floor(r() * 4)) {
      if (nearCross(x, 0)) continue;
      b.prop(pick(r, ["mc-prop-hydrant-a", "mc-prop-bollard-a", "mc-prop-trash-a", "mc-prop-planter-a", "mc-prop-planter-b", "mc-prop-bollard-a"]), x, yy + 1, ["walk"]);
    }
  }
  // 세로 도로 보도: 가로등(서쪽 보도 안쪽 열·동쪽 보도 안쪽 열)
  for (const xx of vt) for (let yy = 3; yy < H; yy += 7 + Math.floor(r() * 3)) {
    if (hz.some((h) => yy >= h - 1 && yy < h + 13)) continue;
    b.prop("mc-prop-lamp-a", xx + 1, yy - 2, ["walk"]);
    const big = BIG_STREET_TREES.filter((id) => b.pal.kit(id));
    if (!(big.length && b.prop(pick(r, big), xx + 9, yy - 3, ["walk", "road"]))) b.prop(pick(r, trees), xx + 10, yy - 2, ["walk"]);
  }
  // 교차로 모서리 신호등(남쪽 두 모서리 발밑 = 교차로 맨 아래 보도 줄). 움직이는 키트라 시뮬레이션 신호 주기(TRANSIT_SIGNAL)와 같이 바뀐다:
  // 차량 신호는 남쪽을 보고 서서 북쪽행(남북) 차로용, 보행자 신호는 남쪽 횡단보도(남북 길을 가로지른다 = 동서 차량과 함께 건넌다)용.
  for (const yy of hz) for (const xx of vt) { b.prop("mc-anim-signal-ns", xx + 1, yy + 9, ["walk", "road"]); b.prop("mc-anim-ped-signal-ew", xx + 10, yy + 9, ["walk", "road"]); }
  // 지하철 입구 — 기본 하나(남는 띠·공원 가장자리·건물 사이 넓은 틈 중 3×3 이 비는 곳). district.subwayExits 면 그 수만큼,
  // 서로 8칸 이상 떨어지게 흩어 놓고 번호 표지(mc-prop-kr-exit-N)를 입구 옆에 세운다. 보도(가로 도로 남·북 보도 줄)를 먼저 찾는다.
  const subwayExits: MCSubwayExit[] = [];
  const subwayKits = ["mc-prop-subway-a", "mc-prop-subway-b", "mc-prop-subway-c"].filter((id) => pal.kit(id));
  const stairOf = (id: string): number => b.kit(id).rows[2]?.upperTiles?.[1] ?? -1;
  const farFromExits = (x: number, y: number): boolean => subwayExits.every((e) => Math.abs(e.at.x - x) + Math.abs(e.at.y - y) >= 10);
  for (let n = 1; n <= wantExits; n++) {
    const id = subwayKits[(n - 1) % subwayKits.length] ?? "mc-prop-subway-a";
    const signId = `mc-prop-kr-exit-${n}`;
    const withSign = wantExits > 1 && !!pal.kit(signId);
    let placed = false;
    // 미리 비운 틈(건물 줄 사이, 북쪽 보도로 열림) — 입구 계단이 접근칸 줄로 내려온다.
    const gap = exitGaps[n - 1];
    if (gap) {
      const x = gap.x, yy = gap.accessY - 3;
      const fitOk = b.fits(id, x, yy, ["walk", "park", "ground"]);
      if (fitOk && b.in(x + 1, yy + 3) && b.use[b.k(x + 1, yy + 3)] === "walk") {
        b.prop(id, x, yy, ["walk", "park", "ground"]);
        if (withSign) b.prop(signId, x + 3, yy + 1, ["walk", "park", "ground"]);
        for (const dx of [0, 1, 2]) b.keep[b.k(x + dx, yy + 3)] = true;
        const stair = { x: x + 1, y: yy + 2 };
        subwayExits.push({ n, at: { x, y: yy }, stair, step: { x: x + 1, y: yy + 3 } });
        b.notes.push(`지하철 ${n}번 출구 (${x},${yy}) — 계단 칸 (${stair.x},${stair.y}, 타일 ${stairOf(id)}) 에 이동 이벤트, 나오는 칸 (${x + 1},${yy + 3})`);
        placed = true;
      }
    }
    for (let tries = 0; tries < 400 && !placed; tries++) {
      const x = Math.floor(r() * (W - 3)), yy = Math.floor(r() * (H - 3));
      if (!farFromExits(x, yy)) continue;
      if (!b.fits(id, x, yy, ["walk", "park"], 1) || !b.in(x + 1, yy + 3) || b.use[b.k(x + 1, yy + 3)] !== "walk") continue;
      // 번호 표지는 입구 오른쪽(없으면 왼쪽) 보도 한 칸, 발밑은 입구 아랫줄과 같은 줄
      const signX = withSign ? [x + 3, x - 1].find((sx) => b.fits(signId, sx, yy + 1, ["walk", "park"])) : undefined;
      if (withSign && signX === undefined) continue;
      b.prop(id, x, yy, ["walk", "park"], 1);
      if (withSign && signX !== undefined) b.prop(signId, signX, yy + 1, ["walk", "park"]);
      for (const dx of [0, 1, 2]) b.keep[b.k(x + dx, yy + 3)] = true;
      const stair = { x: x + 1, y: yy + 2 };
      subwayExits.push({ n, at: { x, y: yy }, stair, step: { x: x + 1, y: yy + 3 } });
      b.notes.push(`지하철 ${wantExits > 1 ? `${n}번 출구` : "입구"} (${x},${yy}) — 계단 칸 (${stair.x},${stair.y}, 타일 ${stairOf(id)}) 에 이동 이벤트, 나오는 칸 (${x + 1},${yy + 3})`);
      placed = true;
    }
    if (!placed) b.notes.push(`지하철 ${n}번 출구 자리를 못 찾았다`);
  }
  // 한국 거리 단서: 보도 점자 블록 줄(가로 도로 남·북 보도 안쪽 줄)·가로수 보호판·버스 쉘터·자전거 거치대·세로 입간판.
  if (district.korean) koreanStreetCues(b, r, hz, vt, busStops);
  // 시작 칸: 마지막 가로 도로 남쪽 보도(또는 그 아래 띠) 가운데에서 가장 가까운 걸을 칸
  const sy = Math.min(H - 1, (hz.length ? hz[hz.length - 1]! + 10 : H - 2));
  let start = { x: Math.floor(W / 2), y: sy };
  for (let d = 0; d < W; d++) {
    const c = [{ x: Math.floor(W / 2) + d, y: sy }, { x: Math.floor(W / 2) - d, y: sy }, { x: Math.floor(W / 2) + d, y: sy + 1 }].find((p) => b.in(p.x, p.y) && b.use[b.k(p.x, p.y)] === "walk" && b.upper[b.k(p.x, p.y)] < 0);
    if (c) { start = c; break; }
  }
  if (b.buildings.length < 2) throw new Error(`건물을 ${b.buildings.length}채밖에 못 세웠다 — 맵을 키운다`);
  // 같은 종류 두 채(편의점·은행 …)는 이름에 번호를 붙인다 — 장소 이름으로 찾을 때 앞 건물만 잡히지 않게(2026-10-14 실조수 경고).
  const named = new Map<string, number>();
  const buildings = b.buildings.map((d) => { const k = (named.get(d.name) ?? 0) + 1; named.set(d.name, k); return k > 1 ? { ...d, name: `${d.name} ${k}` } : d; });
  const roadBands: RoadBand[] = [
    ...hz.map((yy): RoadBand => ({ axis: "ew", edge: yy + 3, width: 6, from: 0, to: W - 1, edgeToEdge: true })),
    ...vt.map((xx): RoadBand => ({ axis: "ns", edge: xx + 3, width: 6, from: 0, to: H - 1, edgeToEdge: true })),
  ];
  const rotatedMix = DEFAULT_MODERN_CAR_MIX.map((_, i) => DEFAULT_MODERN_CAR_MIX[(i + Math.abs(seed)) % DEFAULT_MODERN_CAR_MIX.length]!);
  const transit = {
    routes: autoTrafficRoutes(roadBands, { width: W, height: H }, {
      vehicles: rotatedMix,
      busVehicle: "mc-veh-bus-a",
      drive: "right",
      // 차 간격: 6초면 차선마다 차가 줄지어 서 횡단보도 밖에서는 길을 건널 수 없었다(2026-10-27 romance-j91 J102 「멈춘 차가 길을 막는다」).
      headwaySec: 14,
      busHeadwaySec: 40,
      includeTurns: true,
      busStops,
    }).routes,
  };
  return { lower: b.lower, upper: b.upper, upper2: b.upper2, buildings, start, props: b.props, roads: { horizontal: hz, vertical: vt }, park: parkBlock ? { x: parkBlock.x0, y: parkBlock.y0, w: parkBlock.x1 - parkBlock.x0 + 1, h: parkBlock.y1 - parkBlock.y0 + 1 } : null, notes: b.notes, transit, subwayExits };
}

/** 번들 정의(또는 그 사본)에서 사전을 만든다. */
export function modernCityPaletteFromTileset(def: {
  readonly tileGroups?: readonly { readonly id: string; readonly tileIds: readonly number[] }[];
  readonly structureKits?: readonly unknown[];
  readonly passability?: readonly ({ readonly up?: boolean } | undefined)[];
  readonly priority?: readonly (string | undefined)[];
}): MCPalette {
  const groups = new Map((def.tileGroups ?? []).map((g) => [g.id, g.tileIds] as const));
  const kits = new Map<string, MCKit>();
  for (const raw of def.structureKits ?? []) {
    const k = raw as { id: string; name?: string; width: number; height: number; rows: MCKit["rows"]; ai?: { access?: { dx: number; dy: number }[]; tags?: string[]; roofFace?: MCKit["roof"] } };
    if (!k?.id || !Array.isArray(k.rows)) continue;
    const cells = def.passability && def.priority
      ? k.rows.map((row) => Array.from({ length: k.width }, (_, c) => { const t = row.upperTiles?.[c] ?? -1; return t < 0 ? ((row.tiles[c] ?? -1) >= 0 ? "." : " ") : def.passability![t]?.up === false ? "S" : def.priority![t] === "upper" ? "*" : "."; }).join(""))
      : undefined;
    kits.set(k.id, { id: k.id, width: k.width, height: k.height, rows: k.rows, ...(k.ai?.access ? { access: k.ai.access } : {}), ...(k.name ? { name: k.name } : {}), ...(k.ai?.tags ? { tags: k.ai.tags } : {}), ...(cells ? { cells } : {}), ...(k.ai?.roofFace ? { roof: k.ai.roofFace } : {}) });
  }
  const bld = [...kits.keys()].filter((id) => id.startsWith("mc-bld-"));
  return { group: (id) => groups.get(id) ?? [], kit: (id) => kits.get(id), buildingKits: () => bld, kitIds: () => [...kits.keys()] };
}
