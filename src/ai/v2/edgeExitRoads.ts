// 맵 가장자리 출구까지 길 잇기 — 2026-10-29 vm3 argon jrpg 판정(blocker): 「촌장 허락 후 마을 밖으로 나가는 길(출구)이 화면상 전혀 안 보임,
// 맵 가장자리가 어디로도 이어지지 않아 보임」. 시작 마을(42×34)의 남쪽 가장자리 출구 (22,33)는 풀밭 한가운데 투명 접촉 칸이었고, 모랫길은
// 동쪽 가장자리 (41,8)·(41,18)에서 아무 데로도 안 가는 채 끝났다. 판정자는 길 끝을 따라가다 막혔다.
// 규칙(야외 맵, 이미 길 오토타일이 깔린 맵만):
//  - 다른 맵으로 가는 이동 이벤트가 맵 가장자리 칸에 있고 그 칸이 길이 아니면, 걸을 수 있는 칸으로 가장 가까운 길 칸까지(꺾임이 적은 쪽) 그 맵의 길 재료로 잇는다.
//  - 길은 폭 1, 맵에 이미 깔린 같은 재료(가장 많이 쓴 길 오토타일)로 — 새 그림 없음. 집·구조물 칸은 fill_region 이 건너뛴다.
//  - 너무 멀면(24칸 넘게) 잇지 않는다(그때는 런타임 목적지 글자만).
import { canMove } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import type { BuildRun } from "./types";

const ROAD_LABEL = /(길|road|path).*오토타일|오토타일.*(길|road|path)/iu;
const NOT_ROAD = /물|water|강|운하|벽|wall|지붕|roof/iu;
const MAX_LEN = 24;

function hasTransferOut(node: unknown, here: string): boolean {
  if (Array.isArray(node)) return node.some((n) => hasTransferOut(n, here));
  if (!node || typeof node !== "object") return false;
  const r = node as Record<string, unknown>;
  if (r.kind === "transfer" && typeof r.mapId === "string" && r.mapId !== here) return true;
  return Object.values(r).some((v) => v && typeof v === "object" && hasTransferOut(v, here));
}

/** 이 맵의 길 재료(가장 많이 쓴 길 오토타일 이름표의 앞부분)와 길 칸 판정. */
function roadOf(project: Project, map: GameMap): { material: string; isRoad: (i: number) => boolean } | undefined {
  const meta = (project.tilesets[map.tilesetId]?.tileMeta ?? []) as unknown as ({ label?: string } | undefined)[];
  const label = (t: number | undefined) => (typeof t === "number" && t >= 0 ? String(meta[t]?.label ?? "") : "");
  const roadTile = (t: number | undefined) => { const l = label(t); return ROAD_LABEL.test(l) && !NOT_ROAD.test(l); };
  const counts = new Map<string, number>();
  for (const t of map.lowerTiles) if (roadTile(t)) { const base = label(t).replace(/\s*·\s*[^·]*쪽으로 이어짐.*$/u, "").replace(/\s*·\s*[^·]*(몸통|외톨이|홀로).*$/u, "").trim(); counts.set(base, (counts.get(base) ?? 0) + 1); }
  const best = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] < 6) return undefined;
  return { material: best[0], isRoad: (i) => roadTile(map.lowerTiles[i]) };
}

/** 가장자리 출구에서 가장 가까운 길 칸까지의 걸음 칸들(출구 칸 포함, 길 칸 제외). 꺾임 하나에 반 걸음 덤. */
function pathToRoad(project: Project, map: GameMap, from: { x: number; y: number }, isRoad: (i: number) => boolean): { x: number; y: number }[] | undefined {
  const w = map.width, h = map.height;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  // 상태 = 칸 × 들어온 방향(4) + 시작(4번).
  const dist = new Float64Array(w * h * 5).fill(Infinity);
  const prev = new Int32Array(w * h * 5).fill(-1);
  const start = (from.y * w + from.x) * 5 + 4;
  dist[start] = 0;
  const open: number[] = [start];
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (dist[open[k]!]! < dist[open[bi]!]!) bi = k;
    const s = open.splice(bi, 1)[0]!;
    const cell = Math.floor(s / 5), dir = s % 5, x = cell % w, y = Math.floor(cell / w);
    if (dist[s]! > MAX_LEN * 1.5) break;
    if (cell !== from.y * w + from.x && isRoad(cell)) {
      const out: { x: number; y: number }[] = [];
      for (let t = prev[s]!; t >= 0; t = prev[t]!) { const c = Math.floor(t / 5); out.push({ x: c % w, y: Math.floor(c / w) }); }
      return out.length <= MAX_LEN ? out.reverse() : undefined;
    }
    DIRS.forEach(([dx, dy], d) => {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || !canMove(project, map, x, y, nx, ny)) return;
      const ns = (ny * w + nx) * 5 + d;
      const nd = dist[s]! + 1 + (dir !== 4 && dir !== d ? 0.5 : 0);
      if (nd < dist[ns]!) { dist[ns] = nd; prev[ns] = s; open.push(ns); }
    });
  }
  return undefined;
}

/** 꺾이는 점만 남긴다(fill_region path 는 점 사이를 직선으로 칠한다). */
function corners(cells: readonly { x: number; y: number }[]): { x: number; y: number }[] {
  if (cells.length <= 2) return [...cells];
  const out = [cells[0]!];
  for (let i = 1; i < cells.length - 1; i++) {
    const a = cells[i - 1]!, b = cells[i]!, c = cells[i + 1]!;
    if (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) out.push(b);
  }
  out.push(cells[cells.length - 1]!);
  return out;
}

export function roadToEdgeExits(run: BuildRun, mapId: string): string[] {
  const notes: string[] = [];
  const project0 = run.ctx.project;
  const map0 = project0.maps[mapId];
  if (!map0) return notes;
  const road = roadOf(project0, map0);
  if (!road) return notes;
  const w = map0.width, h = map0.height;
  const gates = (map0.events ?? []).filter((e) => (e.x === 0 || e.y === 0 || e.x === w - 1 || e.y === h - 1) && hasTransferOut(e.pages ?? e.commands, mapId));
  for (const gate of gates) {
    const project = run.ctx.project;
    const map = project.maps[mapId]!;
    const cur = roadOf(project, map);
    if (!cur || cur.isRoad(gate.y * w + gate.x)) continue;
    const cells = pathToRoad(project, map, gate, cur.isRoad);
    if (!cells?.length) continue;
    const points = corners(cells);
    const res = run.call("fill_region", { mapId, material: cur.material, path: points.length === 1 ? [points[0], points[0]] : points, width: 1, _exactCells: true });
    const dest = (() => { for (const p of gate.pages ?? []) for (const c of p.commands ?? []) { const r = c as unknown as { kind?: string; mapId?: string }; if (r.kind === "transfer" && r.mapId) return project.maps[r.mapId]?.name ?? r.mapId; } return ""; })();
    if (res.ok) notes.push(`가장자리 출구 「→ ${dest}」 (${gate.x},${gate.y})까지 ${cur.material} ${cells.length}칸을 이음`);
    else notes.push(`가장자리 출구 (${gate.x},${gate.y}) 길 잇기 실패: ${String(res.summary).slice(0, 100)}`);
  }
  return notes;
}
