// 일본 지역 장면(japaneseRegionsCatalog.ts 의 engine:"scene")을 맵 크기·씨앗에 맞춰 도구 호출 단계(fill_region·stamp_object)로 펼친다.
// 바닥(ground·area·band)을 먼저 모두 칠하고 그 위에 키트를 세운다 - 키트를 세운 뒤 바닥을 칠하면 키트 바닥 칸이 지워진다.
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
  const path = new Uint8Array(W * H);   // 1 = 띠·clear 칸(onPath 키트만)
  const used = new Uint8Array(W * H);   // 1 = 키트가 선 칸
  const steps: JpRegionStep[] = [];
  const unplaced: Record<string, number> = {};
  let placed = 0;

  const fill = (x: number, y: number, w: number, h: number, mat: string, clear: boolean) => {
    x = Math.max(0, x); y = Math.max(0, y); w = Math.min(W - x, w); h = Math.min(H - y, h);
    if (w <= 0 || h <= 0) return;
    steps.push({ tool: "fill_region", args: { mapId, rect: { x, y, w, h }, material: mat }, note: "ground" });
    if (clear) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) path[yy * W + xx] = 1;
  };
  const free = (x: number, y: number, w: number, h: number, onPath: boolean, margin: number) => {
    if (x < 0 || y < 0 || x + w > W || y + h > H) return false;
    for (let yy = y - margin; yy < y + h + margin; yy++) for (let xx = x - margin; xx < x + w + margin; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const i = yy * W + xx;
      if (used[i]) return false;
      const inside = xx >= x && xx < x + w && yy >= y && yy < y + h;
      if (inside && path[i] && !onPath) return false;
    }
    return true;
  };
  const stamp = (kit: string, x: number, y: number, w: number, h: number) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) used[yy * W + xx] = 1;
    steps.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/${kit}`, mapId, x, y }, note: kit });
    placed++;
  };
  const miss = (kit: string) => { unplaced[kit] = (unplaced[kit] ?? 0) + 1; };
  const size = (id: string) => kitSize(regionKitId(id));
  /** (x,y) 둘레를 씨앗 순서로 흔들어 처음 빈 자리에 세운다. */
  const tryAt = (id: string, x: number, y: number, onPath: boolean, jitter: number): boolean => {
    const kit = regionKitId(id), s = size(id);
    if (!s) { miss(kit); return false; }
    const offs: [number, number][] = [[0, 0]];
    for (let r = 1; r <= jitter; r++) for (const d of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]] as [number, number][]) offs.push(d);
    const first = Math.floor(rand() * Math.min(offs.length, 5));          // 씨앗마다 처음 자리를 조금 다르게
    const order = [...offs.slice(first), ...offs.slice(0, first)];
    for (const [dx, dy] of order) if (free(x + dx, y + dy, s.w, s.h, onPath, 0)) { stamp(kit, x + dx, y + dy, s.w, s.h); return true; }
    miss(kit); return false;
  };

  // 1) 바닥
  fill(0, 0, W, H, region.engine.ground, false);
  const footRows = new Set(region.engine.ops.filter((o): o is Extract<JpRegionOp, { op: "row" }> => o.op === "row").map((o) => Y(o.foot)));
  for (const op of region.engine.ops) {
    if (op.op === "area") {
      const x0 = X(op.box[0]), y0 = Y(op.box[1]), x1 = X(op.box[2]), y1 = Y(op.box[3]);
      fill(x0, y0, x1 - x0 + 1, y1 - y0 + 1, op.mat, op.clear === true);
    } else if (op.op === "band") {
      const [a, b] = op.span ?? [0, 1];
      if (op.dir === "h") { const y0 = Math.round(op.at * (H - 1) - op.size / 2); const y = footRows.has(y0) ? y0 + 1 : y0; const x0 = X(a), x1 = X(b); fill(x0, y, x1 - x0 + 1, op.size, op.mat, true); }
      else { const x = Math.round(op.at * (W - 1) - op.size / 2); const y0 = Y(a), y1 = Y(b); fill(x, y0, op.size, y1 - y0 + 1, op.mat, true); }
    }
  }
  // 2) 키트
  for (const op of region.engine.ops) placeOp(op);
  return { steps, unplaced, placed };

  function placeOp(op: JpRegionOp): void {
    switch (op.op) {
      case "area": case "band": return;
      case "put": {
        const s = size(op.kit);
        if (!s) { miss(regionKitId(op.kit)); return; }
        const x = X(op.at[0]) - Math.floor(s.w / 2);
        const y = op.foot ? Y(op.at[1]) - s.h + 1 : Y(op.at[1]) - Math.floor(s.h / 2);
        tryAt(op.kit, x, y, op.onPath === true, 2);
        return;
      }
      case "row": {
        const x1 = X(op.span[1]), foot = Y(op.foot), gap = op.gap ?? 1;
        let x = X(op.span[0]) + Math.floor(rand() * 2), k = Math.floor(rand() * op.kits.length);
        let misses = 0;
        while (x < x1) {
          const id = op.kits[k % op.kits.length]!, s = size(id);
          if (s && x + s.w - 1 <= x1 && free(x, foot - s.h + 1, s.w, s.h, false, 0)) { stamp(regionKitId(id), x, foot - s.h + 1, s.w, s.h); x += s.w + gap; k++; misses = 0; continue; }
          // 이 키트가 안 들어가면 다음 키트, 한 바퀴 돌아도 없으면 한 칸 민다(띠·랜드마크를 건너뛴다)
          k++; misses++;
          if (misses >= op.kits.length) { x++; misses = 0; }
        }
        return;
      }
      case "line": {
        const s = size(op.kit);
        if (!s) { miss(regionKitId(op.kit)); return; }
        if (op.dir === "h") {
          const y = Y(op.at) - Math.floor(s.h / 2);
          for (let x = X(op.span[0]); x + s.w - 1 <= X(op.span[1]); x += op.step) {
            if (free(x, y, s.w, s.h, op.onPath === true, 0)) stamp(regionKitId(op.kit), x, y, s.w, s.h);
          }
        } else {
          const x = X(op.at) - Math.floor(s.w / 2);
          for (let y = Y(op.span[0]); y + s.h - 1 <= Y(op.span[1]); y += op.step) {
            if (free(x, y, s.w, s.h, op.onPath === true, 0)) stamp(regionKitId(op.kit), x, y, s.w, s.h);
          }
        }
        return;
      }
      case "scatter": {
        const x0 = X(op.box[0]), y0 = Y(op.box[1]), x1 = X(op.box[2]), y1 = Y(op.box[3]);
        for (let n = 0; n < op.n; n++) {
          const id = op.kits[Math.floor(rand() * op.kits.length)]!, s = size(id);
          if (!s) { miss(regionKitId(id)); continue; }
          let ok = false;
          for (let t = 0; t < 40 && !ok; t++) {
            const x = x0 + Math.floor(rand() * Math.max(1, x1 - x0 - s.w + 2));
            const y = y0 + Math.floor(rand() * Math.max(1, y1 - y0 - s.h + 2));
            if (x + s.w - 1 <= x1 && y + s.h - 1 <= y1 && free(x, y, s.w, s.h, op.onPath === true, 1)) { stamp(regionKitId(id), x, y, s.w, s.h); ok = true; }
          }
          if (!ok) miss(regionKitId(id));
        }
        return;
      }
    }
  }
}
