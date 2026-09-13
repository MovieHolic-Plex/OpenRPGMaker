/** Geometry only: room roles and links are independent of chipset tile numbers. */
export type DungeonPoint = { x: number; y: number };
export const DUNGEON_ROLES = ["entrance", "chamber", "crystal", "worksite", "shrine", "storage", "collapse"] as const;
export type DungeonRole = (typeof DUNGEON_ROLES)[number];
export type DungeonNode = DungeonPoint & { id: string; role: DungeonRole; width: number; height: number };
export type DungeonLink = { from: string; to: string; width?: number; via?: DungeonPoint[] };
export type DungeonGraph = { rooms: DungeonNode[]; connections: DungeonLink[] };
export type DungeonDesign = {
  seed?: number;
  graph?: DungeonGraph;
  character?: "cavern" | "mine" | "crystal" | "crypt";
};
export function dungeonRandom(seed: number): () => number {
  let a = seed | 0;
  return () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function validateDungeonGraph(graph: DungeonGraph, width: number, height: number): string[] {
  const issues: string[] = [], ids = new Set<string>();
  if (!Array.isArray(graph.rooms) || !Array.isArray(graph.connections)) return ["graph requires rooms and connections arrays"];
  if (graph.rooms.length < 1 || graph.rooms.length > 32 || graph.connections.length > 64) return ["graph supports 1–32 rooms and up to 64 connections"];
  for (const r of graph.rooms) {
    if (!r || typeof r.id !== "string" || !r.id || ids.has(r.id)) { issues.push("room ids must be nonempty and unique"); continue; }
    ids.add(r.id);
    if (!DUNGEON_ROLES.includes(r.role)) issues.push(`unknown role: ${r.id}`);
    if (![r.x, r.y, r.width, r.height].every(Number.isInteger) || r.width < 7 || r.height < 7 || r.width > width || r.height > height || r.x < 2 || r.y < 3 || r.x >= width - 2 || r.y >= height - 2) issues.push(`invalid room dimensions or centre: ${r.id}`);
  }
  const adjacency = new Map(graph.rooms.filter(Boolean).map(r => [r.id, new Set<string>()]));
  for (const c of graph.connections) {
    if (!c || !ids.has(c.from) || !ids.has(c.to) || c.from === c.to) { issues.push("connection requires two distinct existing rooms"); continue; }
    if (c.width !== undefined && (!Number.isFinite(c.width) || c.width < 6 || c.width > 16)) issues.push("corridor width must be 6–16");
    if (c.via !== undefined && (!Array.isArray(c.via) || c.via.length > 12 || c.via.some(p => !p || !Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < 2 || p.y < 3 || p.x >= width - 2 || p.y >= height - 2))) issues.push("invalid corridor control points");
    adjacency.get(c.from)?.add(c.to); adjacency.get(c.to)?.add(c.from);
  }
  if (!issues.length) {
    const seen = new Set([graph.rooms[0]!.id]);
    for (const id of seen) for (const next of adjacency.get(id) ?? []) seen.add(next);
    if (seen.size !== graph.rooms.length) issues.push("room graph is disconnected");
  }
  return issues;
}
export function planDungeonGraph(width: number, height: number, design: DungeonDesign): DungeonGraph {
  if (design.graph) return structuredClone(design.graph);
  const random = dungeonRandom(design.seed ?? 1), rooms: DungeonNode[] = [];
  const cols = width >= 72 ? 3 : 2, rows = height >= 32 ? 3 : 2;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const cellW = (width - 6) / cols, cellH = (height - 6) / rows;
    const cx = Math.round(3 + (x + .5 + (random() - .5) * .32) * cellW);
    const cy = Math.round(3 + (y + .5 + (random() - .5) * .25) * cellH);
    const role: DungeonRole = x === 0 && y === rows - 1 ? "entrance" : design.character === "mine" ? (x === cols - 1 ? "worksite" : "collapse") : design.character === "crypt" ? (y === 0 ? "shrine" : "chamber") : design.character === "crystal" ? "crystal" : random() < .45 ? "crystal" : "collapse";
    rooms.push({ id: `room_${rooms.length}`, role, x: cx, y: cy, width: Math.max(7, Math.round(cellW * (.48 + random() * .34))), height: Math.max(7, Math.round(cellH * (.65 + random() * .3))) });
  }
  // A larger, off-centre communal chamber gives local elevation enough space.
  if (width >= 48 && height >= 40 && design.character !== "crypt") {
    const main = rooms[Math.floor(rooms.length / 2)]!;
    main.width = Math.min(width - 6, 24); main.height = Math.min(height - 6, 20);
  }
  for (const r of rooms) {
    r.x = Math.max(Math.ceil(r.width / 2) + 2, Math.min(width - Math.ceil(r.width / 2) - 3, r.x));
    r.y = Math.max(Math.ceil(r.height / 2) + 2, Math.min(height - Math.ceil(r.height / 2) - 3, r.y));
  }
  const candidates: { a: number; b: number; weight: number }[] = [];
  for (let a = 0; a < rooms.length; a++) for (let b = a + 1; b < rooms.length; b++) candidates.push({ a, b, weight: Math.hypot(rooms[a]!.x - rooms[b]!.x, rooms[a]!.y - rooms[b]!.y) * (.85 + random() * .3) });
  candidates.sort((a, b) => a.weight - b.weight);
  const parent = rooms.map((_, i) => i), root = (i: number): number => parent[i] === i ? i : root(parent[i]!);
  const chosen: typeof candidates = [], extras: typeof candidates = [];
  for (const edge of candidates) { const a = root(edge.a), b = root(edge.b); if (a !== b) { parent[a] = b; chosen.push(edge); } else extras.push(edge); }
  const loopCandidates = extras.filter(e => !rooms.some((r, i) => i !== e.a && i !== e.b && segmentDistance(r.x, r.y, rooms[e.a]!, rooms[e.b]!) < Math.min(r.width, r.height) / 2));
  chosen.push(...loopCandidates.slice(0, Math.max(1, Math.floor(rooms.length / 4))));
  const connections = chosen.map(({ a, b }) => {
    const from = rooms[a]!, to = rooms[b]!, dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy), bend = (random() - .5) * 7;
    return { from: from.id, to: to.id, width: 6.5 + random() * 1.5, via: [{ x: Math.max(2, Math.min(width - 3, Math.round((from.x + to.x) / 2 - dy / len * bend))), y: Math.max(3, Math.min(height - 3, Math.round((from.y + to.y) / 2 + dx / len * bend))) }] };
  });
  return { rooms, connections };
}
export function segmentDistance(x: number, y: number, a: DungeonPoint, b: DungeonPoint): number {
  const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length2));
  return Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
}
export function dungeonFloorMask(width: number, height: number, graph: DungeonGraph, design: DungeonDesign): boolean[] {
  const phase = (design.seed ?? 1) * .73;
  const noise = (x: number, y: number) => Math.sin(x * .41 + y * .19 + phase) * .45 + Math.cos(y * .52 - x * .17 + phase) * .3;
  const rooms = new Map(graph.rooms.map(r => [r.id, r]));
  const segments = graph.connections.flatMap(c => {
    const points = [rooms.get(c.from)!, ...(c.via ?? []), rooms.get(c.to)!];
    return points.slice(1).map((b, i) => ({ a: points[i]!, b, radius: (c.width ?? 7) / 2 }));
  });
  return Array.from({ length: width * height }, (_, k) => {
    const x = k % width, y = Math.floor(k / width);
    if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) return false;
    const n = noise(x, y);
    return graph.rooms.some(r => {
      const dx = Math.abs(x - r.x) / (r.width / 2), dy = Math.abs(y - r.y) / (r.height / 2);
      return design.character === "crypt" && r.role !== "collapse" ? Math.max(dx, dy) < 1 : Math.hypot(dx, dy) < 1 + n * .1;
    }) || segments.some(s => segmentDistance(x, y, s.a, s.b) < s.radius + (design.character === "crypt" ? 0 : n * .4));
  });
}
