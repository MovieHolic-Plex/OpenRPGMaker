// project/stairs/detect.ts
// 맵에 깔린 계단 찾기 — 계약이 있는 키트의 그림 칸 번호를 맵 네 층에서 맞춰 본다(키트 스탬프·손 도트 조립기 어느 길로 깔렸든 같은 그림).
// 찾은 계단은 키트 원점(맵 좌표) + 계약이다. 검사(lint/stairEntranceLint.ts)와 조수 도구(층 이동 맞추기)가 같이 쓴다.
import type { GameMap, Project } from "../types";
import { cellPassability } from "../collision";
import { allStairContracts, type PlacedStair, type StairContract } from "./contract";

interface KitSig {
  readonly kitId: string;
  readonly contract: StairContract;
  /** 그림 칸(키트 원점 기준)과 그 칸에 있어야 하는 번호들. */
  readonly cells: readonly { dx: number; dy: number; tiles: readonly number[] }[];
}
interface TilesetSigs { readonly kits: readonly KitSig[]; readonly anchor: Map<number, { kit: KitSig; dx: number; dy: number }[]> }

const SIG_CACHE = new Map<string, TilesetSigs>();
const LAYERS = ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"] as const;

function sigsFor(project: Project, tilesetId: string): TilesetSigs | undefined {
  const ts = project.tilesets[tilesetId];
  if (!ts) return undefined;
  const key = `${tilesetId}|${ts.structureKits?.length ?? 0}`;
  const hit = SIG_CACHE.get(key);
  if (hit) return hit;
  const byId = new Map((ts.structureKits ?? []).map((k) => [k.id, k] as const));
  const kits: KitSig[] = [];
  for (const { tilesetId: tid, kitId, contract } of allStairContracts()) {
    if (tid !== tilesetId) continue;
    const kit = byId.get(kitId) as { rows?: { tiles: number[]; upperTiles?: number[] }[] } | undefined;
    if (!kit?.rows) continue;
    const cells: KitSig["cells"][number][] = [];
    kit.rows.forEach((r, dy) => r.tiles.forEach((t, dx) => {
      const tiles = [t, r.upperTiles?.[dx] ?? -1].filter((v) => v >= 0);
      if (tiles.length) cells.push({ dx, dy, tiles });
    }));
    if (cells.length) kits.push({ kitId, contract, cells });
  }
  // 닻: 키트마다 다른 키트·같은 키트 안에 덜 흔한 번호 하나(넓은 계단의 되풀이 칸 대신).
  const freq = new Map<number, number>();
  for (const k of kits) for (const c of k.cells) for (const t of c.tiles) freq.set(t, (freq.get(t) ?? 0) + 1);
  const anchor = new Map<number, { kit: KitSig; dx: number; dy: number }[]>();
  for (const k of kits) {
    let best: { t: number; dx: number; dy: number; f: number } | undefined;
    for (const c of k.cells) for (const t of c.tiles) { const f = freq.get(t)!; if (!best || f < best.f) best = { t, dx: c.dx, dy: c.dy, f }; }
    if (best) (anchor.get(best.t) ?? anchor.set(best.t, []).get(best.t)!).push({ kit: k, dx: best.dx, dy: best.dy });
  }
  const out = { kits, anchor };
  if (SIG_CACHE.size > 64) SIG_CACHE.clear();
  SIG_CACHE.set(key, out);
  return out;
}

function tilesAt(map: GameMap, x: number, y: number): number[] {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return [];
  const i = y * map.width + x;
  const out: number[] = [];
  for (const l of LAYERS) { const t = (map as unknown as Record<string, number[] | undefined>)[l]?.[i]; if (typeof t === "number" && t >= 0) out.push(t); }
  return out;
}

export interface FoundStair extends PlacedStair { readonly kitId: string; readonly match: number }

/** 맵에 깔린 계단(계약 있는 키트). 그림 칸의 75% 이상이 맞고 서로 겹치지 않는 것만. */
export function findPlacedStairs(project: Project, map: GameMap): FoundStair[] {
  const sigs = sigsFor(project, map.tilesetId);
  if (!sigs?.kits.length) return [];
  const cand: FoundStair[] = [];
  const seen = new Set<string>();
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    for (const t of tilesAt(map, x, y)) {
      for (const a of sigs.anchor.get(t) ?? []) {
        const ox = x - a.dx, oy = y - a.dy, key = `${a.kit.kitId}|${ox}|${oy}`;
        if (seen.has(key)) continue;
        seen.add(key);
        let ok = 0;
        for (const c of a.kit.cells) { const here = tilesAt(map, ox + c.dx, oy + c.dy); if (c.tiles.some((tt) => here.includes(tt))) ok++; }
        const match = ok / a.kit.cells.length;
        if (match >= 0.75) cand.push({ kitId: a.kit.kitId, contract: a.kit.contract, x: ox, y: oy, match });
      }
    }
  }
  cand.sort((p, q) => q.match - p.match || q.contract.w * q.contract.h - p.contract.w * p.contract.h);
  const taken = new Set<string>();
  const out: FoundStair[] = [];
  for (const c of cand) {
    const cells: string[] = [];
    for (let dy = 0; dy < c.contract.h; dy++) for (let dx = 0; dx < c.contract.w; dx++) cells.push(`${c.x + dx},${c.y + dy}`);
    if (cells.some((k) => taken.has(k))) continue;
    cells.forEach((k) => taken.add(k));
    out.push(c);
  }
  return out;
}

export function walkableCell(project: Project, map: GameMap, x: number, y: number): boolean {
  const ts = project.tilesets[map.tilesetId];
  if (!ts || x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const p = cellPassability(ts, map, y * map.width + x);
  return p.up || p.down || p.left || p.right;
}
