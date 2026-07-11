/**
 * 대형 마을 bbox 선배치 플래너.
 * 순서: 중요 기물(강/호수/광장/시장) → 집 롯 → 겹침 검사 피드백 → 도로 앵커.
 * 시공 전에만 돌리고, 겹치면 재배치한다.
 */

export type BBox = {
  readonly id: string;
  readonly role: "river" | "lake" | "plaza" | "market" | "house" | "forest";
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

export type RoadAnchor = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
};

export type VillageBboxPlan = {
  readonly mapW: number;
  readonly mapH: number;
  readonly bboxes: readonly BBox[];
  readonly houseLots: readonly BBox[];
  readonly market: BBox;
  readonly plaza: BBox;
  readonly lake: BBox;
  readonly rivers: readonly BBox[];
  readonly roadAnchors: readonly RoadAnchor[];
  readonly attempts: number;
  readonly ok: boolean;
  readonly issues: readonly string[];
};

export type LotSize = { readonly w: number; readonly h: number };

export type PlanOptions = {
  readonly mapW?: number;
  readonly mapH?: number;
  readonly houseCount?: number;
  readonly houseLotW?: number;
  readonly houseLotH?: number;
  readonly houseGap?: number;
  /** true면 lot 크기를 섞어 배치 (기본 true) */
  readonly mixLotSizes?: boolean;
  /** 혼합 배치 시 사용할 크기 프리셋. 없으면 맵 규모별 기본 프리셋 */
  readonly houseLotSizes?: readonly LotSize[];
  readonly maxAttempts?: number;
  readonly seed?: number;
};

const DEFAULTS = {
  mapW: 100,
  mapH: 100,
  houseCount: 20,
  // 단일 크기 폴백 (mixLotSizes=false 일 때)
  houseLotW: 10,
  houseLotH: 10,
  houseGap: 1,
  maxAttempts: 40,
  seed: 42,
} as const;

/** 50맵: 소형·중형·울타리 가능·tall/U 가능 혼합 */
export const HOUSE_LOT_SIZES_SMALL: readonly LotSize[] = [
  { w: 7, h: 7 },
  { w: 8, h: 7 },
  { w: 8, h: 8 },
  { w: 9, h: 8 },
  { w: 9, h: 9 },
  { w: 8, h: 10 },
  { w: 10, h: 9 },
];

/** 100맵: 여유 있는 혼합 */
export const HOUSE_LOT_SIZES_LARGE: readonly LotSize[] = [
  { w: 8, h: 8 },
  { w: 9, h: 9 },
  { w: 10, h: 10 },
  { w: 11, h: 9 },
  { w: 9, h: 11 },
  { w: 12, h: 10 },
  { w: 10, h: 12 },
  { w: 11, h: 11 },
];

export function planLargeVillageBboxes(options: PlanOptions = {}): VillageBboxPlan {
  const mapW = options.mapW ?? DEFAULTS.mapW;
  const mapH = options.mapH ?? DEFAULTS.mapH;
  const houseCount = options.houseCount ?? DEFAULTS.houseCount;
  const lotW = options.houseLotW ?? DEFAULTS.houseLotW;
  const lotH = options.houseLotH ?? DEFAULTS.houseLotH;
  const gap = options.houseGap ?? DEFAULTS.houseGap;
  const mixLotSizes = options.mixLotSizes !== false;
  const lotSizePresets =
    options.houseLotSizes
    ?? (mapW <= 60 ? HOUSE_LOT_SIZES_SMALL : HOUSE_LOT_SIZES_LARGE);
  const maxAttempts = options.maxAttempts ?? DEFAULTS.maxAttempts;
  let seed = options.seed ?? DEFAULTS.seed;

  // 고정 기물 — 맵 크기에 비례 (50×50 / 100×100 공통)
  const riverW = mapW >= 80 ? 8 : Math.max(4, Math.floor(mapW * 0.1));
  const riverH = mapH >= 80 ? 8 : Math.max(4, Math.floor(mapH * 0.1));
  // 숲은 밀도 있게 깔 수 있도록 폭 확보 (2x2 활엽 포함)
  const forestW = mapW >= 80 ? 8 : 6;
  const lakeW = mapW >= 80 ? 26 : Math.max(9, Math.floor(mapW * 0.2));
  const lakeH = mapH >= 80 ? 24 : Math.max(8, Math.floor(mapH * 0.18));
  const lakeX = Math.max(riverW + 14, mapW - lakeW - forestW - 2);
  const lakeY = mapH >= 80 ? 6 : 2;
  // 호수와 숲이 겹치지 않게: 호수는 숲 왼쪽, 숲은 호수 남쪽부터
  const lake: BBox = {
    id: "lake-ne",
    role: "lake",
    x: Math.min(lakeX, mapW - forestW - lakeW - 1),
    y: lakeY,
    w: lakeW,
    h: lakeH,
  };
  const forestY = Math.min(Math.floor(mapH * 0.35), lake.y + lake.h + 1);
  const forestEast: BBox = {
    id: "forest-east",
    role: "forest",
    x: mapW - forestW,
    y: forestY,
    w: forestW,
    h: Math.max(8, mapH - riverH - forestY - 1),
  };

  const riverWest: BBox = { id: "river-west", role: "river", x: 0, y: 0, w: riverW, h: mapH };
  const riverSouth: BBox = { id: "river-south", role: "river", x: 0, y: mapH - riverH, w: mapW, h: riverH };

  // 건조 영역 (물·숲 제외) — 호수 왼쪽 주거 밴드
  const dry = {
    x: riverWest.w + 1,
    y: 2,
    w: Math.max(10, lake.x - (riverWest.w + 1) - 1),
    h: Math.max(10, riverSouth.y - 2 - 1),
  };

  let best: VillageBboxPlan | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const rng = mulberry(seed + attempt * 9973);
    const issues: string[] = [];

    // 광장·시장
    // 100맵: 상점 북부 고정 / 광장은 그 남쪽. 50맵: 기존 중앙 배치.
    const plazaW = mapW <= 60 ? 6 : Math.min(12, Math.max(6, Math.floor(dry.w * 0.28)));
    const plazaH = mapW <= 60 ? 5 : Math.min(10, Math.max(5, Math.floor(dry.h * 0.18)));
    const marketW = mapW <= 60 ? 9 : Math.min(18, Math.max(12, Math.floor(dry.w * 0.36)));
    const marketH = mapW <= 60 ? 8 : Math.min(12, Math.max(10, Math.floor(dry.h * 0.16)));

    let plaza: BBox;
    let market: BBox;
    if (mapW >= 80) {
      // 북쪽 상점가 + 그 아래 광장
      market = {
        id: "market",
        role: "market",
        x: dry.x + Math.floor((dry.w - marketW) / 2) + Math.floor((rng() - 0.5) * 3),
        y: dry.y + 1,
        w: marketW,
        h: marketH,
      };
      clampBox(market, dry);
      plaza = {
        id: "plaza",
        role: "plaza",
        x: market.x + Math.floor((market.w - plazaW) / 2),
        y: market.y + market.h + gap + 1,
        w: plazaW,
        h: plazaH,
      };
      clampBox(plaza, dry);
      if (overlaps(plaza, market)) {
        plaza = {
          ...plaza,
          y: Math.min(dry.y + dry.h - plazaH, market.y + market.h + gap + 1),
        };
      }
    } else {
      plaza = {
        id: "plaza",
        role: "plaza",
        x: dry.x + Math.floor((dry.w - plazaW) / 2) + Math.floor((rng() - 0.5) * Math.min(4, dry.w / 6)),
        y: dry.y + Math.floor(dry.h * 0.38) + Math.floor((rng() - 0.5) * 2),
        w: plazaW,
        h: plazaH,
      };
      clampBox(plaza, dry);
      market = {
        id: "market",
        role: "market",
        x: plaza.x + plaza.w + gap + 1,
        y: plaza.y - 1,
        w: marketW,
        h: marketH,
      };
      if (!fitsIn(market, dry) || overlaps(market, plaza)) {
        market = {
          id: "market",
          role: "market",
          x: plaza.x,
          y: plaza.y + plaza.h + gap + 1,
          w: marketW,
          h: marketH,
        };
      }
      clampBox(market, dry);
    }

    const reserved: BBox[] = [riverWest, riverSouth, lake, forestEast, plaza, market];

    // 집 롯: 크기 혼합 랜덤 배치(기본) 또는 단일 격자 후보
    const houseLots = mixLotSizes
      ? placeMixedHouseLots({
          dry,
          reserved,
          lake,
          houseCount,
          gap,
          sizes: lotSizePresets,
          rng,
        })
      : placeUniformHouseLots({
          dry,
          reserved,
          lake,
          houseCount,
          gap,
          lotW,
          lotH,
          rng,
        });

    if (houseLots.length < houseCount) {
      issues.push(`house-lots-short ${houseLots.length}/${houseCount}`);
    }
    if (overlaps(plaza, market)) issues.push("plaza-market-overlap");
    if (overlaps(market, lake) || overlaps(plaza, lake)) issues.push("core-lake-overlap");
    if (overlaps(market, riverWest) || overlaps(plaza, riverWest)) issues.push("core-river-overlap");

    // 전 쌍 겹침
    const all = [...reserved, ...houseLots];
    for (let i = 0; i < all.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) {
        const a = all[i]!;
        const b = all[j]!;
        // 강끼리 모서리 겹침 허용 (서×남)
        if (a.role === "river" && b.role === "river") continue;
        if (overlaps(a, b)) issues.push(`overlap ${a.id}×${b.id}`);
      }
    }

    const roadAnchors: RoadAnchor[] = [
      { id: "plaza-center", x: centerX(plaza), y: centerY(plaza) },
      { id: "market-front", x: centerX(market), y: market.y + market.h },
      { id: "lake-shore", x: lake.x - 2, y: lake.y + lake.h + 1 },
      { id: "river-west-dock", x: riverWest.w + 1, y: centerY(plaza) },
      { id: "river-south-dock", x: centerX(plaza), y: riverSouth.y - 2 },
    ];

    const plan: VillageBboxPlan = {
      mapW,
      mapH,
      bboxes: all,
      houseLots,
      market,
      plaza,
      lake,
      rivers: [riverWest, riverSouth],
      roadAnchors,
      attempts: attempt,
      ok: issues.length === 0 && houseLots.length >= houseCount,
      issues,
    };

    if (plan.ok) return plan;
    if (!best || houseLots.length > best.houseLots.length || issues.length < best.issues.length) {
      best = plan;
    }
  }

  return best ?? {
    mapW,
    mapH,
    bboxes: [],
    houseLots: [],
    market: { id: "market", role: "market", x: 0, y: 0, w: 1, h: 1 },
    plaza: { id: "plaza", role: "plaza", x: 0, y: 0, w: 1, h: 1 },
    lake: { id: "lake", role: "lake", x: 0, y: 0, w: 1, h: 1 },
    rivers: [],
    roadAnchors: [],
    attempts: maxAttempts,
    ok: false,
    issues: ["plan-failed-completely"],
  };
}

export function overlaps(a: BBox, b: BBox, margin = 0): boolean {
  return !(
    a.x + a.w + margin <= b.x
    || b.x + b.w + margin <= a.x
    || a.y + a.h + margin <= b.y
    || b.y + b.h + margin <= a.y
  );
}

export function inflate(b: BBox, m: number): BBox {
  return { ...b, x: b.x - m, y: b.y - m, w: b.w + m * 2, h: b.h + m * 2, id: `${b.id}+${m}` };
}

function fitsIn(box: BBox, region: { x: number; y: number; w: number; h: number }): boolean {
  return (
    box.x >= region.x
    && box.y >= region.y
    && box.x + box.w <= region.x + region.w
    && box.y + box.h <= region.y + region.h
  );
}

function clampBox(box: BBox, region: { x: number; y: number; w: number; h: number }): void {
  const mutable = box as { x: number; y: number };
  mutable.x = Math.max(region.x, Math.min(box.x, region.x + region.w - box.w));
  mutable.y = Math.max(region.y, Math.min(box.y, region.y + region.h - box.h));
}

function centerX(b: BBox): number {
  return b.x + Math.floor(b.w / 2);
}
function centerY(b: BBox): number {
  return b.y + Math.floor(b.h / 2);
}

type DryRegion = { x: number; y: number; w: number; h: number };

function placeUniformHouseLots(input: {
  readonly dry: DryRegion;
  readonly reserved: readonly BBox[];
  readonly lake: BBox;
  readonly houseCount: number;
  readonly gap: number;
  readonly lotW: number;
  readonly lotH: number;
  readonly rng: () => number;
}): BBox[] {
  const candidates = houseLotCandidates(input.dry, input.lotW, input.lotH, input.gap, input.rng);
  const houseLots: BBox[] = [];
  for (const cand of candidates) {
    if (houseLots.length >= input.houseCount) break;
    if (input.reserved.some((r) => overlaps(cand, r, input.gap))) continue;
    if (houseLots.some((h) => overlaps(cand, h, input.gap))) continue;
    if (overlaps(cand, inflate(input.lake, 1))) continue;
    houseLots.push(cand);
  }
  return houseLots;
}

/**
 * 필지 크기 혼합 배치.
 * - 프리셋을 라운드로빈 후 셔플해 “목표 크기” 할당
 * - 각 목표 크기를 dry 안 랜덤 위치에 비겹침 삽입
 * - 실패 시 한 단계 작은 프리셋으로 폴백해 목표 채수 확보
 */
function placeMixedHouseLots(input: {
  readonly dry: DryRegion;
  readonly reserved: readonly BBox[];
  readonly lake: BBox;
  readonly houseCount: number;
  readonly gap: number;
  readonly sizes: readonly LotSize[];
  readonly rng: () => number;
}): BBox[] {
  const { dry, reserved, lake, houseCount, gap, sizes, rng } = input;
  if (sizes.length === 0) return [];

  // 큰 lot 우선 보장: tall/U/울타리 가능 크기를 앞쪽에 배치 후 셔플 약하게
  const sortedByArea = [...sizes].sort((a, b) => b.w * b.h - a.w * a.h);
  const targets: LotSize[] = [];
  for (let i = 0; i < houseCount; i += 1) {
    // 최소 1/3은 큰 쪽(상위 절반), 나머지는 전체 순환
    if (i < Math.max(1, Math.ceil(houseCount / 3))) {
      targets.push(sortedByArea[i % Math.max(1, Math.ceil(sortedByArea.length / 2))]!);
    } else {
      targets.push(sizes[i % sizes.length]!);
    }
  }
  shuffleInPlace(targets, rng);

  const houseLots: BBox[] = [];
  const blocked = () => [...reserved, ...houseLots];

  for (let ti = 0; ti < targets.length; ti += 1) {
    const target = targets[ti]!;
    const fallbacks = uniqueSizesDescending(target, sizes);
    let placed: BBox | null = null;
    for (const size of fallbacks) {
      placed = tryPlaceLot({
        dry,
        size,
        gap,
        blocked: blocked(),
        lake,
        id: `house-${houseLots.length}`,
        rng,
        tries: 100,
      });
      if (placed) break;
    }
    if (placed) houseLots.push(placed);
  }

  // 채수 부족 시 가장 작은 크기로 추가 시도
  const smallest = [...sizes].sort((a, b) => a.w * a.h - b.w * b.h)[0]!;
  let guard = 0;
  while (houseLots.length < houseCount && guard < houseCount * 30) {
    guard += 1;
    const placed = tryPlaceLot({
      dry,
      size: smallest,
      gap,
      blocked: blocked(),
      lake,
      id: `house-${houseLots.length}`,
      rng,
      tries: 40,
    });
    if (!placed) break;
    houseLots.push(placed);
  }
  return houseLots;
}

function uniqueSizesDescending(primary: LotSize, presets: readonly LotSize[]): LotSize[] {
  const list: LotSize[] = [primary];
  const rest = [...presets]
    .filter((s) => !(s.w === primary.w && s.h === primary.h))
    .sort((a, b) => b.w * b.h - a.w * a.h);
  for (const s of rest) list.push(s);
  // 최후: primary보다 작은 정사각 폴백
  for (const n of [primary.w - 1, primary.h - 1, 7, 6]) {
    if (n >= 6) list.push({ w: n, h: n });
  }
  const seen = new Set<string>();
  const out: LotSize[] = [];
  for (const s of list) {
    const key = `${s.w}x${s.h}`;
    if (seen.has(key)) continue;
    if (s.w < 6 || s.h < 6) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function tryPlaceLot(input: {
  readonly dry: DryRegion;
  readonly size: LotSize;
  readonly gap: number;
  readonly blocked: readonly BBox[];
  readonly lake: BBox;
  readonly id: string;
  readonly rng: () => number;
  readonly tries: number;
}): BBox | null {
  const { dry, size, gap, blocked, lake, id, rng, tries } = input;
  if (size.w > dry.w || size.h > dry.h) return null;
  const maxX = dry.x + dry.w - size.w;
  const maxY = dry.y + dry.h - size.h;
  for (let t = 0; t < tries; t += 1) {
    const x = dry.x + Math.floor(rng() * (maxX - dry.x + 1));
    const y = dry.y + Math.floor(rng() * (maxY - dry.y + 1));
    const cand: BBox = { id, role: "house", x, y, w: size.w, h: size.h };
    if (blocked.some((b) => overlaps(cand, b, gap))) continue;
    if (overlaps(cand, inflate(lake, 1))) continue;
    if (!fitsIn(cand, dry)) continue;
    return cand;
  }
  // 격자 스캔 폴백
  const step = 1;
  for (let y = dry.y; y <= maxY; y += step) {
    for (let x = dry.x; x <= maxX; x += step) {
      const cand: BBox = { id, role: "house", x, y, w: size.w, h: size.h };
      if (blocked.some((b) => overlaps(cand, b, gap))) continue;
      if (overlaps(cand, inflate(lake, 1))) continue;
      return cand;
    }
  }
  return null;
}

function houseLotCandidates(
  dry: DryRegion,
  lotW: number,
  lotH: number,
  gap: number,
  rng: () => number,
): BBox[] {
  const stepX = lotW + gap;
  const stepY = lotH + gap;
  const out: BBox[] = [];
  let i = 0;
  for (let y = dry.y; y + lotH <= dry.y + dry.h; y += stepY) {
    for (let x = dry.x; x + lotW <= dry.x + dry.w; x += stepX) {
      const jx = Math.floor((rng() - 0.5) * 2);
      const jy = Math.floor((rng() - 0.5) * 2);
      const bx = Math.max(dry.x, Math.min(x + jx, dry.x + dry.w - lotW));
      const by = Math.max(dry.y, Math.min(y + jy, dry.y + dry.h - lotH));
      out.push({ id: `house-${i}`, role: "house", x: bx, y: by, w: lotW, h: lotH });
      i += 1;
    }
  }
  shuffleInPlace(out, rng);
  return out;
}

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let k = arr.length - 1; k > 0; k -= 1) {
    const j = Math.floor(rng() * (k + 1));
    const t = arr[k]!;
    arr[k] = arr[j]!;
    arr[j] = t;
  }
}

function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** 플랜 ASCII (기물 문자) */
export function renderPlanAscii(plan: VillageBboxPlan, step = 2): string {
  const { mapW, mapH } = plan;
  const grid: string[][] = Array.from({ length: Math.ceil(mapH / step) }, () =>
    Array.from({ length: Math.ceil(mapW / step) }, () => "."),
  );
  const put = (b: BBox, ch: string) => {
    for (let y = b.y; y < b.y + b.h; y += step) {
      for (let x = b.x; x < b.x + b.w; x += step) {
        const gy = Math.floor(y / step);
        const gx = Math.floor(x / step);
        if (grid[gy] && grid[gy]![gx] !== undefined) grid[gy]![gx] = ch;
      }
    }
  };
  for (const r of plan.rivers) put(r, "~");
  put(plan.lake, "L");
  put(plan.plaza, "P");
  put(plan.market, "M");
  for (const h of plan.houseLots) put(h, "H");
  for (const b of plan.bboxes) if (b.role === "forest") put(b, "F");

  const lines = [`# plan attempts=${plan.attempts} ok=${plan.ok} houses=${plan.houseLots.length} issues=${plan.issues.join(",") || "-"}`];
  lines.push("# ~=river L=lake P=plaza M=market H=house F=forest .=free");
  grid.forEach((row, yi) => lines.push(`${String(yi * step).padStart(3, "0")} ${row.join("")}`));
  return lines.join("\n");
}
