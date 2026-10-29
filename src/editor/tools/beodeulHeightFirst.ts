// editor/tools/beodeulHeightFirst.ts — 버들항 마을 「지형 먼저」(2026-10-29, 마을 짓기의 기본 순서).
//
// 왜: 사용자 「마을을 만드는 게 불만이 많다. 높이를 우선 만들고 그 뒤에 마을을 만드는 방식은 어떤가?」, 이어서
// 「스타크래프트 맵처럼 지형을 먼저 적극적으로 쫙 깔고, 마을은 그 지형에 맞춰 자란다 — 인류사처럼 지형이 정착 모양을 정한다」.
// 옛 시공기(beodeulTerrain.planVillageTerrain)는 물·큰길 줄(mainBase)을 먼저 정하고 그 북쪽에 단을 깎았다 — 높이가 길에 끌려가는 장식이었다.
// 여기서는 지형 설계(모델이 고른 landform·settle·tiers·high, 강 유무)로 땅을 먼저 짓고, 큰길·뒷길·물가 길이 그 단의 등고선을 따라간다.
// 길은 단 안에서는 단을 건너지 않고, 이음길(남북)만 단을 건너며 계단을 탄다(시공기 3b).
//
// 3/4 시점은 남쪽을 보는 절벽 면만 그린다(1단 = 벽 1칸, relief/screen.ts). 그래서 등고선은 동서로 달리고 북쪽이 높다.
// 남북으로 곧게 자른 단 끝은 가는 선으로만 보여 「잘린 판」이 되므로(ab6 판정) 언덕·고원의 옆은 두 칸(고원은 한 칸)마다 한 줄씩
// 올라가 맵 위 끝에서 사라진다. 마을 단과 바로 위 단은 두 단 차이(벽 두 칸 — 한 단 차이 띠는 「얇아 높이감이 없다」, ab6).
//   terraces  계단식 단 — 남쪽 낮은 땅 · 마을 단 · 북쪽 높은 단 tiers 겹이 맵 폭 전체로.
//   hill      언덕 — 위 단 가운데(high)에 꼭대기가 남쪽으로 불룩 솟는다.
//   slope     산비탈 — 6~7줄마다 단이 겹겹이 오르는 산골(위 단 위로는 산 숲).
//   plateau   고원 — 위 단 위 high 자리에 두 단 더 높은 넓은 대지(벽 두 칸)가 솟는다. 오르막이 그 위로 난다.
// settle(마을이 앉는 단): middle = 가운데 단(남쪽 낮은 단에 아랫길·강) · low = 맨 아래 단(북쪽으로만 오른다).
// high(높은 곳 자리): north(맵 폭 전체) · center · west · east.
import { tidyLevels, type VillageTerrain, type VillageTerrainPlan } from "./beodeulTerrain";
import type { BeodeulVillageTheme } from "./beodeulVillage";

export const VILLAGE_LANDFORMS = ["terraces", "hill", "slope", "plateau"] as const;
export type VillageLandform = (typeof VILLAGE_LANDFORMS)[number];
export const VILLAGE_SETTLES = ["middle", "low"] as const;
export type VillageSettle = (typeof VILLAGE_SETTLES)[number];
export const VILLAGE_HIGHS = ["north", "center", "west", "east"] as const;
export type VillageHigh = (typeof VILLAGE_HIGHS)[number];
export const LANDFORM_LABEL: Record<VillageLandform, string> = { terraces: "계단식 단", hill: "언덕", slope: "산비탈", plateau: "고원" };

function rng(seed: number): () => number {
  let s = (seed ^ 0x3a7f1c29) >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; };
}

/**
 * 굽은 등고선(2026-10-29 ab9 판정 「맵 폭 전체를 곧게 가로지르는 절벽 띠가 인공적」): base 둘레 ±amp 줄을 5~9칸 토막마다 한 줄씩 오르내린다
 * (곶·만입). 토막이 5칸 이상이라 경사로·계단이 앉을 곧은 단면(앞뒤 2칸)이 남는다. 멀어질수록 base 쪽으로 당긴다.
 * 옛 contour 는 ±1 줄만 오가 1배 화면에서 자로 그은 띠로 읽혔다.
 */
export function meander(len: number, base: number, rand: () => number, amp = 3): (t: number) => number {
  const ys = new Int16Array(len);
  let y = base + Math.round((rand() * 2 - 1) * Math.min(1, amp)), next = 3 + Math.floor(rand() * 5);
  for (let t = 0; t < len; t += 1) {
    if (t === next && t < len - 4) {
      const pull = (y - base) / Math.max(1, amp);
      y = Math.max(base - amp, Math.min(base + amp, y + (rand() < 0.5 - pull * 0.45 ? 1 : -1)));
      next += 5 + Math.floor(rand() * 5);
    }
    ys[t] = y;
  }
  return (t: number) => ys[Math.max(0, Math.min(len - 1, t))]!;
}

export interface HeightFirstPlan {
  landform: VillageLandform;
  settle: VillageSettle;
  /** 물을 깎기 전 단 높이. */
  levels: Uint8Array;
  /** 마을 단의 북쪽 등고선(y < seamAbove(x) 가 한 단 높다) — 뒷길(북)이 그 위 단의 맨 아래 줄을 따라간다. */
  seamAbove: ((x: number) => number) | null;
  /** 마을 단의 남쪽 등고선(y ≥ seamBelow(x) 가 한 단 낮다) — 남쪽 길이 그 아래 단에서 등고선을 따라간다. */
  seamBelow: ((x: number) => number) | null;
  /** 큰길 윗줄(마을 단 안, 북쪽 집 띠 9~10줄 아래). */
  mainY: (x: number) => number;
  /** 지형 이름(시공기의 지형 분기용: slope = highland 처럼 맨 윗단을 산 숲으로). */
  terrainName: VillageTerrain;
  note: string;
  /** 강 마을: 남쪽 낮은 단에서 동서로 흐르는 강의 윗줄(폭 3). */
  riverY: ((x: number) => number) | null;
  /** 마을 단 높이(middle 1 · low 0). */
  villageLevel: number;
  /** 이 높이 이상은 오를 길 없이 산 숲(산비탈 맨 윗단들). */
  summitFrom: number;
  /** 고원 꼭대기(열 범위·높이). */
  plateauTop: { x0: number; x1: number; level: number } | null;
  high: VillageHigh;
  tiers: number;
  /** 마을 단 바로 위 단(두 단 차이 절벽)이 맵 폭 전체가 아니면 그 절벽이 곧게 서는 열 범위 — 밖은 비스듬히 올라 맵 위 끝으로 사라진다(뒷길은 이 안에서만). */
  aboveSpan: { x0: number; x1: number } | null;
  /** 절벽 띠가 끝나는 자리(사라지기 시작하는 곳) — 시공기가 숲·바위 덩이로 덮는다(「끝이 숲·바위로 사라진다」). */
  cliffEnds: { x: number; y: number }[];
}

/** 이 테마에서 기본 landform·settle — 모델이 비워 보내면. */
export function defaultLandform(theme: BeodeulVillageTheme, seed: number): VillageLandform {
  const xs: VillageLandform[] = theme === "snow" ? ["slope", "terraces"] : theme === "desert" ? ["plateau", "hill", "terraces"] : theme === "swamp" ? ["terraces", "hill"] : theme === "coast" ? ["terraces", "hill"] : ["terraces", "hill", "slope", "plateau"];
  return xs[Math.floor(rng(seed * 977 + 13)() * xs.length)]!;
}

export function parseLandform(v: unknown): VillageLandform | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  const s = v.trim().toLowerCase();
  if ((VILLAGE_LANDFORMS as readonly string[]).includes(s)) return s as VillageLandform;
  throw new Error(`landform 은 ${VILLAGE_LANDFORMS.join("|")} 중 하나다(받은 값: ${v}).`);
}
export function parseHigh(v: unknown): VillageHigh | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  const s = v.trim().toLowerCase();
  if ((VILLAGE_HIGHS as readonly string[]).includes(s)) return s as VillageHigh;
  throw new Error(`high 는 ${VILLAGE_HIGHS.join("|")} 중 하나다(받은 값: ${v}).`);
}
export function parseTiers(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1 || n > 4) throw new Error(`tiers(마을 단 위 높은 단 수)는 1~4 다(받은 값: ${String(v)}).`);
  return n;
}
export function parseSettle(v: unknown): VillageSettle | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  const s = v.trim().toLowerCase();
  if ((VILLAGE_SETTLES as readonly string[]).includes(s)) return s as VillageSettle;
  throw new Error(`settle 은 ${VILLAGE_SETTLES.join("|")} 중 하나다(받은 값: ${v}).`);
}

/**
 * 땅을 먼저 짓는다. 물(강·바다·못)은 아직 없다 — 시공기가 물을 놓은 뒤 carveHeightFirstWater 로 물가를 낮춘다.
 * coastShore: 포구면 물가가 시작하는 대략의 줄(낮은 단이 물가와 물가 길을 품게 그 위 7칸에서 마을 단이 시작한다).
 * river: 강 마을이면 강은 남쪽 낮은 단에서 동서로 흐른다(riverY). 남북으로 흐르는 강의 골이 동서 단을 세로로 갈라 가는 선이 남았다(ab6 판정 1·3·5·9번).
 *
 * 높이(ab6 블라인드 판정 「한 단 차이 절벽 띠가 얇아 높이감이 없다」): 마을 단과 바로 위 단은 두 단 차이(두꺼운 절벽 띠),
 * 그 위는 한 단씩. 시공기 3b 는 높이 먼저일 때 두 단 차이도 계단(층계참 + 계단 세 칸)으로 건넌다.
 */
export function planHeightFirst(W: number, H: number, seed: number, _theme: BeodeulVillageTheme, landform: VillageLandform, settle: VillageSettle, coastShore?: number, river = false, tiersArg?: number, highArg?: VillageHigh): HeightFirstPlan {
  const rand = rng(seed * 6343 + landform.length * 29 + settle.length * 7);
  const ri = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const lv = new Uint8Array(W * H);
  const idx = (x: number, y: number) => y * W + x;
  const raise = (fn: (x: number) => number, level: number, x0 = 0, x1 = W - 1) => {
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x += 1) for (let y = 0; y < Math.min(H, fn(x)); y += 1) if (lv[idx(x, y)]! < level) lv[idx(x, y)] = level;
  };
  const minOf = (fn: (x: number) => number) => { let m = H; for (let x = 0; x < W; x += 1) m = Math.min(m, fn(x)); return m; };
  const maxOf = (fn: (x: number) => number) => { let m = 0; for (let x = 0; x < W; x += 1) m = Math.max(m, fn(x)); return m; };
  // 띠 나누기(맵 높이에 맞춰): 북쪽 높은 단 ≥ 8줄(slope 는 더) · 마을 단 19~23줄(북쪽 집 띠 10 + 큰길 2 + 남쪽 띠 7~11) · 낮은 단 8~16줄(강이면 아랫길 + 강 4줄이 들어가게 ≥ 11).
  const NORTH_STRIP = 10;
  const northMin = landform === "slope" ? 14 : 8;
  let below: ((x: number) => number) | null = null;
  let yBand: number; // 마을 단 북쪽 등고선 기준 줄
  if (settle === "middle") {
    const lowMin = river ? 11 : 8;
    let lowH = coastShore !== undefined ? Math.max(lowMin, H - (coastShore - 7)) : Math.max(lowMin, Math.min(16, Math.round(H * (river ? 0.3 : 0.24))));
    let band = Math.max(19, Math.min(23, H - lowH - northMin));
    if (H - lowH - band < northMin) { lowH = Math.max(lowMin, H - band - northMin); band = Math.max(19, H - lowH - northMin); }
    const yB = H - lowH + ri(-1, 1);
    below = meander(W, yB, rand, 2);
    raise(below, 1);
    yBand = yB - band;
  } else {
    yBand = Math.max(northMin, Math.round(H * 0.5) + ri(-2, 2) - NORTH_STRIP - (river ? 2 : 0));
  }
  const L0 = settle === "middle" ? 1 : 0; // 마을 단 높이
  const UP = L0 + 2; // 마을 단 바로 위 단 — 두 단 차이(두꺼운 절벽 띠)
  let above: ((x: number) => number) | null = null;
  const notes: string[] = [];
  if (yBand >= 5) {
    above = meander(W, yBand, rand, 3);
    if (minOf(above) < 4) above = null;
  }
  let terrainName: VillageTerrain = "terraces";
  // 높은 곳 자리·겹 수를 모델이 안 주면 씨앗이 고른다 — 늘 north·같은 겹이면 같은 요청이 같은 땅이 됐다(2026-10-29 맵 반복 조사)
  const pickOf = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
  const high: VillageHigh = highArg ?? (landform === "hill" || landform === "plateau" ? pickOf(["center", "center", "west", "east"] as const) : pickOf(["north", "north", "west", "east"] as const));
  const tiers = tiersArg ?? (landform === "slope" ? pickOf([2, 3]) : landform === "terraces" ? pickOf([1, 2, 2]) : landform === "hill" ? pickOf([2, 3]) : 2);
  // 높은 곳 자리: 언덕·고원 꼭대기의 가운데 열. north 는 맵 폭 전체(기울기 없음).
  const hcx = high === "west" ? Math.round(W * 0.22) + ri(-2, 2) : high === "east" ? Math.round(W * 0.78) + ri(-2, 2) : Math.round(W / 2) + ri(-Math.round(W * 0.08), Math.round(W * 0.08));
  // 계단식·산비탈에서 high west/east = 그쪽이 더 높다 — 등고선이 그쪽으로 갈수록 남쪽으로 내려온다(열쇠점 4칸마다 한 줄, 최대 4줄)
  const tilt = (x: number) => high === "west" ? Math.min(4, Math.floor((W - 1 - x) / Math.max(4, Math.round(W / 5)))) : high === "east" ? Math.min(4, Math.floor(x / Math.max(4, Math.round(W / 5)))) : 0;
  /** 꼭대기 등고선: 가운데 span 칸은 base 그대로, 바깥은 per 칸마다 한 줄씩 위로(맵 위 끝에서 사라진다 — 남북 직선 옆면 금지). */
  const bulge = (base: (x: number) => number, cx: number, span: number, per: number) => {
    const x0 = cx - Math.floor(span / 2), x1 = x0 + span - 1;
    return (x: number) => { const d = x < x0 ? x0 - x : x > x1 ? x - x1 : 0; return base(x) - Math.ceil(d / per); };
  };
  let plateauTop: { x0: number; x1: number; level: number } | null = null;
  let aboveSpan: { x0: number; x1: number } | null = null;
  const cliffEnds: { x: number; y: number }[] = [];
  /** 단 끝 사라지기: [x0, x1] 밖은 per 칸마다 한 줄씩 올라 맵 위 끝에서 사라진다(곧은 띠가 맵 폭을 다 가로지르지 않게). 끝 자리를 cliffEnds 에 남긴다. */
  const fade = (fn: (x: number) => number, x0: number, x1: number, per: number) => {
    if (x0 > 0) cliffEnds.push({ x: x0, y: fn(x0) });
    if (x1 < W - 1) cliffEnds.push({ x: x1, y: fn(x1) });
    return (x: number) => { const d = x < x0 ? x0 - x : x > x1 ? x - x1 : 0; return fn(x) - Math.ceil(d / per); };
  };
  /** 단 끝이 사라질 열 범위: high west/east 면 그쪽 가장자리에 붙고, 아니면 한쪽(또는 양쪽)이 맵 안에서 끝난다. cover = 맵 폭에 대한 비율. */
  const spanFor = (cover: number, side: VillageHigh): [number, number] => {
    const len = Math.max(12, Math.round(W * cover));
    if (side === "west") return [0, Math.min(W - 1, len - 1)];
    if (side === "east") return [Math.max(0, W - len), W - 1];
    const r = rand();
    if (r < 0.35) return [0, Math.min(W - 1, len - 1)];
    if (r < 0.7) return [Math.max(0, W - len), W - 1];
    const x0 = Math.max(2, Math.round((W - len) / 2) + ri(-3, 3)); return [x0, Math.min(W - 3, x0 + len - 1)];
  };
  let core: ((x: number) => number) | null = null; // 사라지기 전 위 단 등고선 — 큰길 줄은 이것을 따른다(사라지는 끝을 따라 큰길이 비스듬히 오르지 않게)
  if (above) {
    const ab = above;
    let up: (x: number) => number = (x: number) => ab(x) + tilt(x);
    core = up;
    // 마을 단 바로 위 단: 산비탈은 맵 폭 전체(마을 뒤 산), 나머지는 70~88% 폭에서 한쪽 끝이 비스듬히 사라진다
    if (landform !== "slope") {
      const [x0, x1] = spanFor(0.58 + rand() * 0.2, high === "west" || high === "east" ? high : "north");
      if (x0 > 0 || x1 < W - 1) { up = fade(up, x0, x1, 2); aboveSpan = { x0, x1 }; }
    }
    above = up;
    raise(above, UP);
    const spanOf = () => aboveSpan ?? { x0: 0, x1: W - 1 };
    if (landform === "hill") {
      // 언덕: 위 단 위에 high 자리를 꼭대기로 tiers−1 겹이 남쪽으로 불룩 — 겹마다 폭이 줄고 5줄씩 위
      let span = Math.round(W * (0.36 + rand() * 0.12)), k = 1, base = meander(W, yBand - 5 - ri(0, 1), rand, 2);
      const sp = spanOf(); const cx = Math.max(sp.x0 + Math.floor(span / 2) + 2, Math.min(sp.x1 - Math.floor(span / 2) - 2, hcx));
      for (; k < tiers && span >= 8; k += 1) {
        if (base(cx) < 3) break;
        raise(bulge(base, cx, span, 2), UP + k);
        cliffEnds.push({ x: cx - Math.floor(span / 2), y: base(cx) }, { x: cx + Math.ceil(span / 2), y: base(cx) });
        span = Math.round(span * 0.6); base = meander(W, minOf(base) - 4, rand, 2);
      }
      notes.push(k > 1 ? `언덕 ${k}겹(꼭대기 ${high})` : "언덕 한 층");
    } else if (landform === "plateau") {
      // 고원: 위 단 위 high 자리에 두 단 더 높은 넓은 대지(벽 두 칸) — 옆은 한 칸마다 한 줄씩(가파른 벼랑)
      const span = Math.round(W * (0.34 + rand() * 0.1));
      const top = meander(W, yBand - 6 - ri(0, 1), rand, 2);
      const sp = spanOf(); const cx = Math.max(sp.x0 + Math.floor(span / 2) + 2, Math.min(sp.x1 - Math.floor(span / 2) - 2, hcx));
      if (top(cx) >= 4) {
        raise(bulge(top, cx, span, 1), UP + 2);
        plateauTop = { x0: cx - Math.floor(span / 2), x1: cx - Math.floor(span / 2) + span - 1, level: UP + 2 };
        cliffEnds.push({ x: plateauTop.x0, y: top(plateauTop.x0) }, { x: plateauTop.x1, y: top(plateauTop.x1) });
        notes.push(`고원(${span}칸, ${high}, 위 단보다 두 단 높음)`);
      } else notes.push("고원 자리 부족 — 위 단 한 겹");
    } else if (landform === "slope") {
      // 산비탈: 위 단 위로 6~7줄마다 한 단 — 위 단 위의 단들(UP+1~)은 시공기가 산 숲으로 덮는다(summitFrom)
      let k = 1, prev = above;
      for (; k <= tiers; k += 1) {
        const c = meander(W, minOf(prev) - 6 - ri(0, 1), rand, 2);
        const next = (x: number) => c(x) + tilt(x);
        if (minOf(next) < 3) break;
        raise(next, UP + k); prev = next;
      }
      notes.push(`산비탈 ${k}단`);
      terrainName = "highland";
    } else {
      // 계단식: 위 겹은 아래 겹보다 좁은 혀(한쪽 끝이 비스듬히 사라진다) — 겹마다 맵 폭을 다 가로지르는 곧은 띠를 쌓지 않는다
      let k = 1, prev = above, sp = spanOf();
      for (; k < tiers; k += 1) {
        const c = meander(W, minOf(prev) - 8 - ri(0, 1), rand, 3);
        let next: (x: number) => number = (x: number) => c(x) + tilt(x);
        if (minOf(next) < 3) break;
        const shrink = ri(5, 9);
        const x0 = sp.x0 > 0 ? sp.x0 + shrink : rand() < 0.5 ? 0 : shrink + 2, x1 = sp.x1 < W - 1 ? sp.x1 - shrink : x0 === 0 ? W - 1 - shrink - 2 : W - 1;
        if (x1 - x0 < 14) break;
        next = fade(next, x0, x1, 2); sp = { x0, x1 };
        raise(next, UP + k); prev = next;
      }
      notes.push(`계단식 ${k}단`);
    }
  } else notes.push("마을 단 북쪽에 단을 둘 자리 없음");
  const mainY = core ? (x: number) => core!(x) + NORTH_STRIP : () => yBand + NORTH_STRIP;
  if (below && above) {
    const gap = Math.min(...Array.from({ length: W }, (_, x) => below!(x) - mainY(x)));
    if (gap < 8) notes.push(`마을 단 남쪽 띠가 좁다(${gap}줄)`);
  }
  // 강(남쪽 낮은 단, 동서): 윗줄 = 아랫길(등고선 + 2, 폭 ≤ 2) 아래 한 줄 띄워 등고선 + 5 이상, 맵 아래 2줄 위까지. 폭 3, 열쇠점 9~12칸마다 한 줄씩 굽는다.
  let riverY: ((x: number) => number) | null = null;
  if (river) {
    const lo = below ?? ((_: number) => H - 6);
    // 마을이 맨 아래 단(settle low)이면 강은 큰길 남쪽 집 띠(8줄) 바로 아래 — 마을이 강가 단에 내려앉는다(ab9 「맨 아래 강이 마을과 떨어졌다」)
    const minTop = (x: number) => (below ? lo(x) + 5 : Math.min(H - 6, mainY(x) + 11));
    const maxTop = H - 4;
    const keys: [number, number][] = [];
    let x = 0, y = Math.min(maxTop, minTop(0) + ri(0, 1));
    // 강은 마을 쪽 둑에서 두 줄 넘게 멀어지지 않는다(아래로 흘러 맵 끝에 붙으면 마을과 떨어진 띠가 됐다)
    while (x < W) { keys.push([x, y]); x += ri(9, 12); const m = Math.min(maxTop, minTop(Math.min(W - 1, x))); y = Math.max(Math.min(maxTop, m + 2, y + (rand() < 0.5 ? -1 : 1)), m); }
    keys.push([W - 1, Math.max(Math.min(maxTop, y), Math.min(maxTop, minTop(W - 1)))]);
    const f = (xx: number) => { let k = 0; while (k < keys.length - 2 && xx > keys[k + 1]![0]) k += 1; const [x0, y0] = keys[k]!, [x1, y1] = keys[k + 1]!; return Math.max(Math.min(maxTop, minTop(xx)), Math.round(y0 + (y1 - y0) * (x1 === x0 ? 0 : (xx - x0) / (x1 - x0)))); };
    riverY = f;
    notes.push(`강은 남쪽 낮은 단에서 동서로(y≈${minOf(f)}~${maxOf(f)})`);
  }
  tidyLevels(lv, W, H);
  const counts = new Map<number, number>(); for (const v of lv) counts.set(v, (counts.get(v) ?? 0) + 1);
  const note = `높이 먼저 · ${LANDFORM_LABEL[landform]} · 마을 단 ${settle === "middle" ? "가운데" : "맨 아래"}(${L0}) · 위 단 두 단 차이 · ${notes.join(" · ")} · 단 ${[...counts.keys()].sort().join("/")}`
    + (below ? ` · 낮은 단 y≈${minOf(below)}~${maxOf(below)}` : "");
  return { landform, settle, levels: lv, seamAbove: above, seamBelow: below, mainY, terrainName, note, riverY, villageLevel: L0, summitFrom: landform === "slope" ? UP + 1 : 99, plateauTop, high, tiers, aboveSpan, cliffEnds };
}

/**
 * 물을 놓은 뒤 물가를 낮춘다. 강(남쪽 동서)·바다는 0단 낮은 땅에 있으므로 물과 둘레 2칸만 0단으로(둑) — 남북 골은 깎지 않는다
 * (ab4~ab6 판정: 남북 골의 가장자리가 풀밭 한가운데 세로 선·잘린 판으로 보였다). 못은 시공기가 마을 단 북쪽 집 띠 안에 고르므로
 * 그 단 높이에 그대로 둔다(못 자리 상자를 그 단으로 고르게만).
 */
export function carveHeightFirstWater(plan: HeightFirstPlan, W: number, H: number, water: (x: number, y: number) => boolean, pond: { cx: number; cy: number; rx: number; ry: number } | null): VillageTerrainPlan {
  const lv = plan.levels;
  const idx = (x: number, y: number) => y * W + x;
  const inPond = (x: number, y: number) => !!pond && Math.abs(x - pond.cx) <= pond.rx + 2 && Math.abs(y - pond.cy) <= pond.ry + 2;
  if (pond) { const L = lv[idx(Math.max(0, Math.min(W - 1, pond.cx)), Math.max(0, Math.min(H - 1, pond.cy)))]!; for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (inPond(x, y) && lv[idx(x, y)]! > L) lv[idx(x, y)] = L; }
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!water(x, y) || inPond(x, y)) continue;
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) lv[idx(X, Y)] = 0; }
  }
  tidyLevels(lv, W, H);
  return { name: plan.terrainName, levels: lv, northSeam: plan.seamAbove, coves: [], note: plan.note + (pond ? " · 못은 마을 단 위" : "") };
}
