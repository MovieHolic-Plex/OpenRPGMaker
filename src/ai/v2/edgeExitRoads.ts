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

// ───────────── 맵 가장자리 길 끝 출구는 길 폭 전체로 ─────────────
// 왜(2026-10-29 vm7 flash jrpg): 두 칸 폭 길의 한 줄만 출구라 다른 줄로 걸으면 출구를 지나쳤다. 길을 따라가는 사람은 어느 줄로든 나가야 한다.
// 규칙(2026-10-29 회귀 뒤 좁힘 — 몬스터 게임 새순 마을: 길 «한가운데»의 이동 칸 (12,4)·(12,2) 옆 (11,4)·(11,2)에 사본이 서서 남북 통로를 막아
// 리그 출구 (12,0)에 못 갔다): 사본은 ① 맵 가장자리 칸(맵 밖으로 나가는 칸)의 투명 접촉 이동 칸 옆에만, ② 같은 가장자리 줄을 따라(길 폭 방향)
// 이어진 길 칸에만(출구 포함 3칸까지, 넘으면 광장), ③ 각 칸 안쪽 칸도 길이고(길이 가장자리로 나가는 끝), 이벤트·착지 칸·못 걷는 칸이 아니며,
// ④ 둔 뒤 이 맵의 착지점·시작점에서 이동 칸을 밟지 않고 닿던 칸이 하나라도 줄면 그 출구의 사본은 두지 않는다.
// 끝맺음 조립 단계(finish/stages/widen-road-exits.ts)에서 돈다 — 다시 불리면 사본을 걷고 다시 잰다.
const ROAD_CELL = /길|포석|road|path|보도|인도|sidewalk/iu;

function lowerLabels(project: Project, map: GameMap, x: number, y: number): string[] {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return [];
  const meta = (project.tilesets[map.tilesetId]?.tileMeta ?? []) as unknown as ({ label?: string } | undefined)[];
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  return ["lowerTiles", "lowerOverlayTiles"].map((k) => m[k]?.[y * map.width + x]).map((t) => (typeof t === "number" && t >= 0 ? String(meta[t]?.label ?? "") : "")).filter(Boolean);
}

const isTouchTransfer = (ev: GameMap["events"][number], here: string): boolean => (ev.pages ?? []).length > 0
  && (ev.pages ?? []).every((p) => ((p.graphic ?? {}) as { transparent?: boolean; sprite?: unknown }).transparent === true || !((p.graphic ?? {}) as { sprite?: unknown }).sprite)
  && (ev.pages ?? []).some((p) => (p.trigger as { kind?: string } | undefined)?.kind === "playerTouch" && hasTransferOut(p.commands ?? [], here));

const ROAD_COPY = "__road";

/** 출발점들에서 걸어 닿는 칸 — 이동 칸(투명 접촉 이동)은 밟을 수는 있어도 지나가지 못한다(밟으면 맵을 떠난다). */
function walkReach(project: Project, map: GameMap, starts: readonly { x: number; y: number }[], stops: ReadonlySet<string>): Set<string> {
  const seen = new Set<string>();
  const queue = starts.filter((p) => p.x >= 0 && p.y >= 0 && p.x < map.width && p.y < map.height).map((p) => ({ ...p }));
  for (const p of queue) seen.add(`${p.x},${p.y}`);
  for (let i = 0; i < queue.length; i += 1) {
    const { x, y } = queue[i]!;
    if (i >= starts.length && stops.has(`${x},${y}`)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen.has(key) || !canMove(project, map, x, y, nx, ny)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

export function widenRoadExits(run: BuildRun, mapId: string): string[] {
  const notes: string[] = [];
  const project = run.ctx.project;
  const map0 = project.maps[mapId];
  if (!map0) return notes;
  // 다시 불리면 앞서 둔 사본을 걷고 지금 출구 자리로 다시 잰다(끝맺음이 출구를 굴 그림 칸으로 옮기면 옛 사본이 떨어져 남는다).
  const map = { ...map0, events: (map0.events ?? []).filter((e) => !e.id.includes(ROAD_COPY)) };
  const changed = map.events.length !== (map0.events ?? []).length;
  const commit = (events: GameMap["events"]) => { run.ctx.project = { ...project, maps: { ...project.maps, [mapId]: { ...map, events } } } as Project; };
  const role = (map as unknown as { mapRole?: string; climate?: { mode?: string } });
  if (role.mapRole === "interior" || role.climate?.mode === "indoor") { if (changed) commit(map.events); return notes; }
  const road = (x: number, y: number) => lowerLabels(project, map, x, y).some((l) => ROAD_CELL.test(l) && !NOT_ROAD.test(l));
  const landings: { x: number; y: number }[] = [];
  const findLandings = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(findLandings); return; }
    if (!node || typeof node !== "object") return;
    const r = node as Record<string, unknown>;
    if (r.kind === "transfer" && r.mapId === mapId && typeof r.x === "number" && typeof r.y === "number") landings.push({ x: r.x, y: r.y });
    Object.values(r).forEach((v) => { if (v && typeof v === "object") findLandings(v); });
  };
  for (const m of Object.values(project.maps)) for (const e of m.events ?? []) findLandings(e.pages ?? []);
  const start = (project as unknown as { startMapId?: string; startPos?: { x: number; y: number } });
  const starts = [...landings, ...(start.startMapId === mapId && start.startPos ? [start.startPos] : [])];
  const landingKeys = new Set(landings.map((p) => `${p.x},${p.y}`));
  const taken = new Set((map.events ?? []).map((e) => `${e.x},${e.y}`));
  const stops = new Set(map.events.filter((e) => isTouchTransfer(e, mapId)).map((e) => `${e.x},${e.y}`));
  const reach0 = starts.length ? walkReach(project, map, starts, stops) : undefined;
  const added: GameMap["events"] = [];
  const W = map.width, H = map.height;
  for (const ev of map.events ?? []) {
    if (ev.id.includes(ROAD_COPY) || ev.id.includes("__w") || !isTouchTransfer(ev, mapId)) continue;
    // ① 맵 가장자리 칸만. 모서리 칸은 어느 줄인지 모호해 넘긴다.
    const top = ev.y === 0, bottom = ev.y === H - 1, left = ev.x === 0, right = ev.x === W - 1;
    if (Number(top) + Number(bottom) + Number(left) + Number(right) !== 1) continue;
    // ② 길 폭 방향 = 가장자리 줄을 따라, 안쪽 = 맵 안으로 한 칸.
    const across: [number, number] = top || bottom ? [1, 0] : [0, 1];
    const inward: [number, number] = top ? [0, 1] : bottom ? [0, -1] : left ? [1, 0] : [-1, 0];
    // ③ 길이 가장자리로 나가는 끝 — 칸과 안쪽 칸이 모두 길.
    const exitEnd = (x: number, y: number) => road(x, y) && road(x + inward[0], y + inward[1]);
    if (!exitEnd(ev.x, ev.y)) continue;
    const width: { x: number; y: number }[] = [];
    for (const sign of [-1, 1]) for (let k = 1; k <= 3; k += 1) {
      const x = ev.x + across[0] * sign * k, y = ev.y + across[1] * sign * k;
      if (x < 0 || y < 0 || x >= W || y >= H || !exitEnd(x, y)) break;
      width.push({ x, y });
    }
    if (!width.length || width.length + 1 > 3) continue;
    const copies = width.filter((c) => !taken.has(`${c.x},${c.y}`) && !landingKeys.has(`${c.x},${c.y}`) && canMoveInto(project, map, c.x, c.y));
    if (copies.length !== width.length) continue;
    // ④ 둔 뒤 이동 칸을 밟지 않고 닿던 칸이 줄면(다른 출구·통로를 막으면) 두지 않는다.
    if (reach0) {
      const stops1 = new Set([...stops, ...added.map((a) => `${a.x},${a.y}`), ...copies.map((c) => `${c.x},${c.y}`)]);
      const reach1 = walkReach(project, map, starts, stops1);
      const lost = [...reach0].filter((k) => !reach1.has(k) && !stops1.has(k));
      if (lost.length) { notes.push(`가장자리 출구 (${ev.x},${ev.y}) 길 폭 사본은 다른 칸 ${lost.length}곳을 막아 두지 않음`); continue; }
    }
    for (const c of copies) {
      const copy = structuredClone(ev) as GameMap["events"][number];
      copy.id = `${ev.id}${ROAD_COPY}${c.x - ev.x}_${c.y - ev.y}`;
      copy.x = c.x; copy.y = c.y;
      for (const [i, page] of (copy.pages ?? []).entries()) (page as { id?: string }).id = `${copy.id}_page${i}`;
      added.push(copy);
      taken.add(`${c.x},${c.y}`);
    }
    notes.push(`가장자리 길 끝 출구 (${ev.x},${ev.y})를 길 폭 전체로: ${copies.map((c) => `(${c.x},${c.y})`).join(" ")}`);
  }
  if (added.length || changed) commit([...map.events, ...added]);
  return notes;
}

/** 그 칸에 걸어 들어갈 수 있나(사방 이웃 어디서든). */
function canMoveInto(project: Project, map: GameMap, x: number, y: number): boolean {
  return ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => {
    const fx = x + dx, fy = y + dy;
    return fx >= 0 && fy >= 0 && fx < map.width && fy < map.height && canMove(project, map, fx, fy, x, y);
  });
}
