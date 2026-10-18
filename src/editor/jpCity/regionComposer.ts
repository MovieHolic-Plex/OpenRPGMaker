// 일본 지역 장면(japaneseRegionsCatalog.ts 의 engine:"scene")을 맵 크기·씨앗에 맞춰 도구 호출 단계(fill_region·stamp_object)로 펼친다.
// 바닥(ground·구획 기단·area·band)을 먼저 모두 칠하고 그 위에 키트를 세우며, 마지막에 수로 석축/다리·도로 노면 표시·건물 접지 그림자·빈터 식생을 마감한다.
// 자리 겹침은 여기서 막는다: 띠(band)·clear 영역 칸은 onPath 키트만, 이미 선 키트 칸은 누구도 못 쓴다.
import type { JpRegion, JpRegionOp } from "./japaneseRegionsCatalog";

export interface JpRegionStep {
  readonly tool: "fill_region" | "stamp_object";
  readonly args: Record<string, unknown>;
  readonly note: string;
}

export interface JpRegionPlan {
  readonly steps: readonly JpRegionStep[];
  /** 자리가 없어 놓지 못한 키트(id·횟수). */
  readonly unplaced: Readonly<Record<string, number>>;
  readonly placed: number;
}

const WATER_OR_PADDY: Record<string, true> = {
  "바다": true,
  "수로": true,
  "연못": true,
  "논(물 댄 모)": true,
};

/** 카탈로그의 rg-* 는 칩셋 키트 jp-rg-* 의 줄임이다. */
export function regionKitId(id: string): string { return id.startsWith("jp-") ? id : `jp-${id}`; }

/** 바다·논처럼 오토타일 문법이 없는 단칸 지역 바닥(jp:region-*)을 lowerTiles 에 바로 칠한다. */
export function paintJpRegionGround(
  map: { readonly width: number; readonly height: number; readonly lowerTiles: number[] },
  tileset: { readonly tileGroups?: readonly { readonly id: string; readonly name: string; readonly tileIds: readonly number[] }[] },
  rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  material: string,
): boolean {
  const group = (tileset.tileGroups ?? []).find((g) => g.id.startsWith("jp:region-") && g.name === material && g.tileIds.length === 1);
  const tileId = group?.tileIds[0];
  if (tileId === undefined) return false;
  const x0 = Math.max(0, rect.x), y0 = Math.max(0, rect.y);
  const x1 = Math.min(map.width, rect.x + rect.w), y1 = Math.min(map.height, rect.y + rect.h);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      map.lowerTiles[y * map.width + x] = tileId;
    }
  }
  return true;
}

function rng(seed: number): () => number {
  let s = (seed * 2654435761 + 0x9e3779b9) >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function canPlaceOnWaterOrPaddy(id: string): boolean {
  const k = regionKitId(id);
  for (const tag of ["boat", "tetrapod", "lighthouse", "waterfall", "tsuribashi", "yukemuri", "kakashi", "hazakake", "bridge", "water"]) {
    if (k.includes(tag)) return true;
  }
  return false;
}

export function planJpRegionScene(input: {
  readonly region: JpRegion;
  readonly mapId: string;
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly kitSize: (kitId: string) => { readonly w: number; readonly h: number } | undefined;
}): JpRegionPlan {
  const { region, mapId, width: W, height: H, seed, kitSize } = input;
  if (region.engine.kind !== "scene") throw new Error(`${region.id} 은 장면 지역이 아니다(engine ${region.engine.kind})`);
  const rand = rng(seed + region.no * 1009);
  const X = (f: number) => Math.max(0, Math.min(W - 1, Math.round(f * (W - 1))));
  const Y = (f: number) => Math.max(0, Math.min(H - 1, Math.round(f * (H - 1))));
  const path = new Uint8Array(W * H);   // 1 = 띠·clear·물 영역 칸(onPath 키트만)
  const wet = new Uint8Array(W * H);    // 1 = 물·논 칸(일반 건물·나무 배치 금지)
  const used = new Uint8Array(W * H);   // 1 = 키트가 선 칸
  const steps: JpRegionStep[] = [];
  const unplaced: Record<string, number> = {};
  let placed = 0;

  const fill = (x: number, y: number, w: number, h: number, mat: string, clear: boolean) => {
    x = Math.max(0, x); y = Math.max(0, y); w = Math.min(W - x, w); h = Math.min(H - y, h);
    if (w <= 0 || h <= 0) return;
    steps.push({ tool: "fill_region", args: { mapId, rect: { x, y, w, h }, material: mat }, note: "ground" });
    const isWet = WATER_OR_PADDY[mat] === true;
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        const i = yy * W + xx;
        if (clear || isWet) path[i] = 1;
        wet[i] = isWet ? 1 : 0;
      }
    }
  };
  const free = (x: number, y: number, w: number, h: number, onPath: boolean, margin: number, allowWet = false) => {
    if (x < 0 || y < 0 || x + w > W || y + h > H) return false;
    for (let yy = y - margin; yy < y + h + margin; yy++) for (let xx = x - margin; xx < x + w + margin; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const i = yy * W + xx;
      if (used[i]) return false;
      const inside = xx >= x && xx < x + w && yy >= y && yy < y + h;
      if (inside && path[i] && !onPath) return false;
      if (inside && wet[i] && !allowWet) return false;
    }
    return true;
  };
  /** 건물·노점 줄(row) 전용: 다른 키트(used)·물(wet)과는 전 구간 겹치지 않고, 길(path)은 건물 아랫단(바닥 3줄)만 검사해 3/4 지붕 윗단이 북쪽 골목 끝에 닿아도 줄 전체가 통째로 빠지지 않게 한다. */
  const freeRowBuilding = (x: number, y: number, w: number, h: number) => {
    if (x < 0 || y < 0 || x + w > W || y + h > H) return false;
    const baseStart = y + Math.max(0, h - Math.min(h, 3));
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        const i = yy * W + xx;
        if (used[i] || wet[i]) return false;
        if (yy >= baseStart && path[i]) return false;
      }
    }
    return true;
  };
  const stamp = (kit: string, x: number, y: number, w: number, h: number) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) used[yy * W + xx] = 1;
    steps.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/${kit}`, mapId, x, y }, note: kit });
    placed++;
  };
  const miss = (kit: string) => { unplaced[kit] = (unplaced[kit] ?? 0) + 1; };
  /** (x,y) 정위치를 먼저 시험하고, 막혔을 때만 둘레를 씨앗 순서로 흔들어 빈 자리에 세운다. */
  const tryAt = (id: string, x: number, y: number, onPath: boolean, jitter: number): boolean => {
    const kit = regionKitId(id), s = kitSize(kit);
    if (!s) { miss(kit); return false; }
    const allowWet = onPath && canPlaceOnWaterOrPaddy(id);
    if (free(x, y, s.w, s.h, onPath, 0, allowWet)) {
      stamp(kit, x, y, s.w, s.h);
      return true;
    }
    const ring: [number, number][] = [];
    for (let r = 1; r <= jitter; r++) {
      for (const d of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]] as [number, number][]) ring.push(d);
    }
    const first = ring.length ? Math.floor(rand() * Math.min(ring.length, 4)) : 0;
    const order = [...ring.slice(first), ...ring.slice(0, first)];
    for (const [dx, dy] of order) {
      if (free(x + dx, y + dy, s.w, s.h, onPath, 0, allowWet)) {
        stamp(kit, x + dx, y + dy, s.w, s.h);
        return true;
      }
    }
    miss(kit); return false;
  };

  // 1) 기본 대지 바닥 + 건물 줄(row) 구획 기단·앞 보도
  fill(0, 0, W, H, region.engine.ground, false);
  const rowOps = region.engine.ops.filter((o): o is Extract<JpRegionOp, { op: "row" }> => o.op === "row");
  const footRows = new Set<number>();
  for (const o of rowOps) footRows.add(Y(o.foot));
  const hBandRows = new Set<number>();
  for (const op of region.engine.ops) {
    if (op.op === "band" && op.dir === "h") {
      const y0 = Y(op.at) - Math.floor(op.size / 2);
      const y = footRows.has(y0) ? y0 + 1 : y0;
      for (let yy = y; yy < y + op.size; yy++) hBandRows.add(yy);
    }
  }
  // 잔디·흙 대지 위에 건물이 덩그러니 뜨지 않도록 건물 줄마다 대지 구획(자갈/판석)과 앞 보도를 먼저 깐다.
  for (const rop of rowOps) {
    const x0 = X(rop.span[0]), x1 = X(rop.span[1]), foot = Y(rop.foot);
    const heights = rop.kits.map((id) => kitSize(regionKitId(id))?.h ?? 7);
    const maxH = Math.max(5, ...heights);
    const top = Math.max(0, foot - maxH + 1);
    if (region.engine.ground === "잔디" || region.engine.ground === "산길 흙" || region.engine.ground === "숲 바닥(이끼·낙엽)") {
      const parcelMat = region.category === "urban" || region.category === "campus_civic" ? "판석 광장" : "자갈 참배길";
      fill(x0, top, x1 - x0 + 1, foot - top + 1, parcelMat, false);
    }
    if (foot + 1 < H && !hBandRows.has(foot + 1) && !hBandRows.has(foot + 2)) {
      const walkMat = region.id === "terraced_rice_village" || region.id === "rural_wayside_station"
        ? "산길 흙"
        : region.id === "machiya_quarter" || region.id === "onsen_ryokan_town" || region.id === "slope_stair_town"
          ? "온천가 돌길(이시다타미)"
          : "보도 연석";
      fill(x0, foot + 1, x1 - x0 + 1, Math.min(2, H - foot - 1), walkMat, true);
    }
  }

  const hCanals: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const vWalks: { x0: number; x1: number; y0: number; y1: number; mat: string }[] = [];
  const hRoads: { x0: number; x1: number; y0: number; y1: number }[] = [];

  for (const op of region.engine.ops) {
    if (op.op === "area") {
      const x0 = X(op.box[0]), y0 = Y(op.box[1]), x1 = X(op.box[2]), y1 = Y(op.box[3]);
      fill(x0, y0, x1 - x0 + 1, y1 - y0 + 1, op.mat, op.clear === true);
      if (op.mat === "수로" && (x1 - x0 + 1) >= 8 && (y1 - y0 + 1) >= 3) {
        hCanals.push({ x0, x1, y0, y1 });
      }
    } else if (op.op === "band") {
      const [a, b] = op.span ?? [0, 1];
      if (op.dir === "h") {
        const y0 = Y(op.at) - Math.floor(op.size / 2);
        const y = footRows.has(y0) ? y0 + 1 : y0;
        const x0 = X(a), x1 = X(b);
        fill(x0, y, x1 - x0 + 1, op.size, op.mat, true);
        if (op.mat === "수로" && op.size >= 3) hCanals.push({ x0, x1, y0: y, y1: y + op.size - 1 });
        if (op.mat === "거리 · 도로·정지선" && op.size >= 3) hRoads.push({ x0, x1, y0: y, y1: y + op.size - 1 });
      } else {
        const x = X(op.at) - Math.floor(op.size / 2);
        const y0 = Y(a), y1 = Y(b);
        fill(x, y0, op.size, y1 - y0 + 1, op.mat, true);
        if (WATER_OR_PADDY[op.mat] !== true && op.size >= 2 && op.size <= 6) {
          vWalks.push({ x0: x, x1: x + op.size - 1, y0, y1, mat: op.mat });
        }
      }
    }
  }

  // 2) 키트 배치
  const placedBuildings: { x: number; foot: number; w: number; h: number }[] = [];
  const rowGaps: { x: number; foot: number; w: number }[] = [];
  for (const op of region.engine.ops) placeOp(op);

  // 3) 마감 디테일: 수로 다리·물결·도로 차선/배수구/맨홀/횡단보도·건물 틈 소품·빈터 식생·건물 접지 그림자
  decorateCanalsAndBridges();
  decorateRoads();
  decorateRowGapsAndShadows();
  fillRemainingVoids();

  return { steps, unplaced, placed };

  function placeOp(op: JpRegionOp): void {
    switch (op.op) {
      case "area": case "band": return;
      case "put": {
        const kit = regionKitId(op.kit), s = kitSize(kit);
        if (!s) { miss(kit); return; }
        const x = Math.max(0, Math.min(W - s.w, X(op.at[0]) - Math.floor(s.w / 2)));
        const y = Math.max(0, Math.min(H - s.h, op.foot ? Y(op.at[1]) - s.h + 1 : Y(op.at[1]) - Math.floor(s.h / 2)));
        const ok = tryAt(op.kit, x, y, op.onPath === true, 3);
        if (ok && op.foot && s.h >= 5) placedBuildings.push({ x, foot: y + s.h - 1, w: s.w, h: s.h });
        return;
      }
      case "row": {
        const x0 = X(op.span[0]), x1 = X(op.span[1]), foot = Y(op.foot), gap = op.gap ?? 1;
        let x = x0, k = Math.floor(rand() * op.kits.length);
        let misses = 0;
        while (x < x1) {
          const id = op.kits[k % op.kits.length]!, kit = regionKitId(id), s = kitSize(kit);
          if (s && x + s.w - 1 <= x1 && freeRowBuilding(x, foot - s.h + 1, s.w, s.h)) {
            stamp(kit, x, foot - s.h + 1, s.w, s.h);
            placedBuildings.push({ x, foot, w: s.w, h: s.h });
            if (gap >= 1 && x + s.w + gap - 1 <= x1) rowGaps.push({ x: x + s.w, foot, w: gap });
            x += s.w + gap; k++; misses = 0; continue;
          }
          k++; misses++;
          if (misses >= op.kits.length) { x++; misses = 0; }
        }
        return;
      }
      case "line": {
        const kit = regionKitId(op.kit), s = kitSize(kit);
        if (!s) { miss(kit); return; }
        const allowWet = op.onPath === true && canPlaceOnWaterOrPaddy(op.kit);
        if (op.dir === "h") {
          const y = Math.max(0, Math.min(H - s.h, Y(op.at) - Math.floor(s.h / 2)));
          const endX = X(op.span[1]);
          let x = X(op.span[0]);
          while (x + s.w - 1 <= endX) {
            if (free(x, y, s.w, s.h, op.onPath === true, 0, allowWet)) {
              stamp(kit, x, y, s.w, s.h);
              x += Math.max(s.w, op.step);
            } else {
              x += 1;
            }
          }
        } else {
          const x = Math.max(0, Math.min(W - s.w, X(op.at) - Math.floor(s.w / 2)));
          const endY = Y(op.span[1]);
          let y = Y(op.span[0]);
          while (y + s.h - 1 <= endY) {
            if (free(x, y, s.w, s.h, op.onPath === true, 0, allowWet)) {
              stamp(kit, x, y, s.w, s.h);
              y += Math.max(s.h, op.step);
            } else {
              y += 1;
            }
          }
        }
        return;
      }
      case "scatter": {
        const x0 = X(op.box[0]), y0 = Y(op.box[1]), x1 = X(op.box[2]), y1 = Y(op.box[3]);
        for (let n = 0; n < op.n; n++) {
          const id = op.kits[Math.floor(rand() * op.kits.length)]!, kit = regionKitId(id), s = kitSize(kit);
          if (!s) { miss(kit); continue; }
          const tight = id.startsWith("rg-") || id.includes("tree") || id.includes("tsutsuji") || id.includes("pots") || id.includes("planter") || id.includes("cat") || id.includes("lantern") || id.includes("nobori");
          const margin = tight ? 0 : 1;
          const allowWet = op.onPath === true && canPlaceOnWaterOrPaddy(id);
          let ok = false;
          for (let t = 0; t < 80 && !ok; t++) {
            const x = x0 + Math.floor(rand() * Math.max(1, x1 - x0 - s.w + 2));
            const y = y0 + Math.floor(rand() * Math.max(1, y1 - y0 - s.h + 2));
            if (x + s.w - 1 <= x1 && y + s.h - 1 <= y1 && free(x, y, s.w, s.h, op.onPath === true, margin, allowWet)) {
              stamp(kit, x, y, s.w, s.h);
              ok = true;
            }
          }
          if (!ok) miss(kit);
        }
        return;
      }
    }
  }

  function decorateCanalsAndBridges(): void {
    for (const c of hCanals) {
      const bridgeCols = new Set<number>();
      for (const vw of vWalks) {
        if (vw.x1 < c.x0 || vw.x0 > c.x1 || vw.y0 > c.y0 || vw.y1 < c.y1) continue;
        const bx0 = Math.max(c.x0, vw.x0), bx1 = Math.min(c.x1, vw.x1);
        if (bx1 - bx0 + 1 < 3) continue;
        for (let x = bx0; x <= bx1; x++) bridgeCols.add(x);
        for (let y = c.y0; y <= c.y1; y++) {
          const post = y === c.y0 || y === c.y1;
          const railKit = post ? "jp-bridge-post" : "jp-bridge-rail-v";
          if (kitSize(railKit) && free(bx0, y, 1, 1, true, 0, true)) stamp(railKit, bx0, y, 1, 1);
          if (kitSize(railKit) && free(bx1, y, 1, 1, true, 0, true)) stamp(railKit, bx1, y, 1, 1);
          for (let x = bx0 + 1; x < bx1; x++) {
            const deckKit = y === c.y0 ? "jp-bridge-lip" : y === c.y1 ? "jp-bridge-pier" : "jp-bridge-plank";
            if (kitSize(deckKit) && free(x, y, 1, 1, true, 0, true)) stamp(deckKit, x, y, 1, 1);
          }
          if (y > c.y0 && y < c.y1) {
            if (bx0 - 1 >= c.x0 && kitSize("jp-water-dark") && free(bx0 - 1, y, 1, 1, true, 0, true)) stamp("jp-water-dark", bx0 - 1, y, 1, 1);
            if (bx1 + 1 <= c.x1 && kitSize("jp-water-dark-r") && free(bx1 + 1, y, 1, 1, true, 0, true)) stamp("jp-water-dark-r", bx1 + 1, y, 1, 1);
          }
        }
      }
      for (let x = c.x0; x <= c.x1; x++) {
        if (bridgeCols.has(x)) continue;
        if (kitSize("jp-water-shade") && free(x, c.y0, 1, 1, true, 0, true)) stamp("jp-water-shade", x, c.y0, 1, 1);
        if (c.y1 > c.y0 && kitSize("jp-water-rim-s") && free(x, c.y1, 1, 1, true, 0, true)) stamp("jp-water-rim-s", x, c.y1, 1, 1);
        if (c.y1 - c.y0 >= 2 && (x + c.y0) % 4 === 1) {
          const wy = c.y0 + 1 + (x % Math.max(1, c.y1 - c.y0 - 1));
          const glint = x % 8 === 1 ? "jp-water-streak" : "jp-water-glint";
          if (kitSize(glint) && free(x, wy, 1, 1, true, 0, true)) stamp(glint, x, wy, 1, 1);
        }
      }
    }
  }

  function decorateRoads(): void {
    for (const r of hRoads) {
      let cwX = -1;
      for (let tryX = Math.floor((r.x0 + r.x1) / 2) - 2; tryX >= r.x0 + 4; tryX -= 5) {
        let ok = true;
        for (let y = r.y0; y <= r.y1; y++) for (let x = tryX; x < tryX + 4; x++) if (!free(x, y, 1, 1, true, 0)) ok = false;
        if (ok) { cwX = tryX; break; }
      }
      if (cwX >= 0 && kitSize("jp-gnd-zebra")) {
        for (let y = r.y0; y <= r.y1; y++) for (let x = cwX; x < cwX + 4; x++) stamp("jp-gnd-zebra", x, y, 1, 1);
      }
      const midY = r.y0 + Math.floor((r.y1 - r.y0) / 2);
      for (let x = r.x0; x <= r.x1; x++) {
        if (cwX >= 0 && x >= cwX && x < cwX + 4) continue;
        const topId = x % 7 === 3 ? "jp-gnd-drain" : "jp-gnd-asph-line-n";
        if (kitSize(topId) && free(x, r.y0, 1, 1, true, 0)) stamp(topId, x, r.y0, 1, 1);
        if (r.y1 > r.y0 && kitSize("jp-gnd-asph-line-s") && free(x, r.y1, 1, 1, true, 0)) stamp("jp-gnd-asph-line-s", x, r.y1, 1, 1);
        if (x % 11 === 5 && kitSize("jp-gnd-manhole") && free(x, midY, 1, 1, true, 0)) stamp("jp-gnd-manhole", x, midY, 1, 1);
      }
    }
  }

  function decorateRowGapsAndShadows(): void {
    const gapPool = region.category === "sacred_historic" || region.id === "machiya_quarter" || region.id === "onsen_ryokan_town"
      ? ["jp-prop-stone-lantern", "jp-pots", "jp-prop-wall-tsuiji"]
      : ["jp-prop-vending-aka", "jp-prop-vending-sora", "jp-gomi-box", "jp-pots", "jp-prop-bike-sora", "jp-prop-planter"];
    for (const g of rowGaps) {
      const pickId = regionKitId(gapPool[Math.floor(rand() * gapPool.length)]!);
      const s = kitSize(pickId);
      if (s && s.w <= g.w && free(g.x, g.foot - s.h + 1, s.w, s.h, false, 0)) {
        stamp(pickId, g.x, g.foot - s.h + 1, s.w, s.h);
      } else if (kitSize("jp-prop-wall-hedge") && free(g.x, g.foot - 1, 1, 2, false, 0)) {
        stamp("jp-prop-wall-hedge", g.x, g.foot - 1, 1, 2);
      }
    }
    if (kitSize("jp-foot-shadow")) {
      for (const b of placedBuildings) {
        if (b.foot + 1 >= H) continue;
        for (let x = b.x; x < b.x + b.w; x++) {
          if (free(x, b.foot + 1, 1, 1, true, 0, false)) stamp("jp-foot-shadow", x, b.foot + 1, 1, 1);
        }
      }
    }
  }

  function fillRemainingVoids(): void {
    const isNature = region.category === "sacred_historic" || region.category === "mountain_nature"
      || (region.category === "onsen_rural_coast" && region.id !== "fishing_harbor_market" && region.id !== "coastal_seaside_road")
      || region.id === "matsuri_festival_grounds";
    if (isNature) {
      const treePool = region.id === "bamboo_mountain_trail"
        ? ["rg-bamboo-grove", "rg-bamboo-grove", "rg-sugi"]
        : region.id === "gorge_waterfall_trail"
          ? ["rg-maple", "rg-maple", "rg-sugi", "rg-pine"]
          : region.id === "castle_moat_ruins"
            ? ["jp-prop-tree-sakura", "rg-pine", "rg-sugi"]
            : region.id === "rural_wayside_station"
              ? ["rg-sunflower", "rg-sunflower", "rg-sugi", "rg-pine"]
              : region.season === "autumn"
                ? ["rg-sugi", "rg-maple", "rg-bamboo-grove", "rg-pine"]
                : ["rg-sugi", "rg-bamboo-grove", "rg-pine", "jp-prop-tree-sakura"];
      for (let y = 0; y <= H - 5; y += 2) {
        for (let x = 0; x <= W - 3; x += 2) {
          const pickId = regionKitId(treePool[(x * 7 + y * 13 + seed) % treePool.length]!);
          const s = kitSize(pickId);
          if (s && free(x, y, s.w, s.h, false, 0)) {
            stamp(pickId, x, y, s.w, s.h);
          }
        }
      }
      const bushPool = region.id === "rural_wayside_station" || region.id === "alpine_marsh_boardwalk"
        ? ["rg-sunflower", "jp-tsutsuji-3", "jp-tsutsuji"]
        : region.id === "ancient_stone_ruins" || region.id === "jizo_mountain_pass"
          ? ["jp-tsutsuji-3", "rg-moss-buddha", "jp-prop-stone-lantern", "jp-tsutsuji"]
          : ["jp-tsutsuji-3", "jp-prop-stone-lantern", "jp-tsutsuji"];
      for (let y = 1; y <= H - 2; y += 2) {
        for (let x = 1; x <= W - 2; x += 3) {
          const pickId = regionKitId(bushPool[(x * 5 + y * 11 + seed) % bushPool.length]!);
          const s = kitSize(pickId);
          if (s && free(x, y, s.w, s.h, false, 0)) {
            stamp(pickId, x, y, s.w, s.h);
          }
        }
      }
      return;
    }
    if (region.id === "high_school_grounds") return;
    const urbanTrees = region.id === "university_avenue"
      ? ["jp-prop-tree-ginkgo", "jp-prop-tree-zelkova"]
      : region.season === "spring"
        ? ["jp-prop-tree-sakura", "jp-prop-tree-zelkova"]
        : ["jp-prop-tree-zelkova", "jp-prop-tree-ginkgo"];
    for (let y = 1; y <= H - 6; y += 3) {
      for (let x = 1; x <= W - 4; x += 4) {
        const pickId = regionKitId(urbanTrees[(x + y + seed) % urbanTrees.length]!);
        const s = kitSize(pickId);
        if (s && free(x, y, s.w, s.h, false, 1)) {
          stamp(pickId, x, y, s.w, s.h);
        }
      }
    }
    const urbanSub = ["jp-tsutsuji-3", "jp-prop-planter", "jp-prop-bench", "jp-prop-bike-cluster"];
    for (let y = 2; y <= H - 2; y += 3) {
      for (let x = 2; x <= W - 3; x += 5) {
        const pickId = regionKitId(urbanSub[(x * 3 + y + seed) % urbanSub.length]!);
        const s = kitSize(pickId);
        if (s && free(x, y, s.w, s.h, false, 1)) {
          stamp(pickId, x, y, s.w, s.h);
        }
      }
    }
  }
}
