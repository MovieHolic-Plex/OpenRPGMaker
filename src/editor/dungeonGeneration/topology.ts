/** Geometry only: room roles and links are independent of chipset tile numbers. */
export type DungeonPoint = { x: number; y: number };
export const DUNGEON_ROLES = ["entrance", "chamber", "crystal", "worksite", "shrine", "storage", "collapse"] as const;
export type DungeonRole = (typeof DUNGEON_ROLES)[number];
export type DungeonNode = DungeonPoint & { id: string; role: DungeonRole; width: number; height: number };
export type DungeonLink = { from: string; to: string; width?: number; via?: DungeonPoint[] };
export type DungeonGraph = { rooms: DungeonNode[]; connections: DungeonLink[] };
export const DUNGEON_PATHS = ["straight", "cave", "winding"] as const;
export type DungeonPath = (typeof DUNGEON_PATHS)[number];
export type DungeonDesign = {
  seed?: number;
  graph?: DungeonGraph;
  character?: "cavern" | "mine" | "crystal" | "crypt";
  /** Set from the world canon and the current request. Omitted keeps the historical character silhouette. */
  path?: DungeonPath;
};
export function resolveDungeonPath(design: DungeonDesign): DungeonPath {
  if (design.path) return design.path;
  return design.character === "crypt" ? "straight" : "cave";
}
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
  const straight = design.path === "straight" || (!design.path && design.character === "crypt");
  let cols = width >= 160 ? 6 : width >= 112 ? 5 : width >= 72 ? 3 : 2;
  let rows = height >= 110 ? 5 : height >= 72 ? 4 : height >= 32 ? 3 : 2;
  while (cols * rows > 32) { if (cols >= rows && cols > 2) cols -= 1; else if (rows > 2) rows -= 1; else break; }
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const cellW = (width - 6) / cols, cellH = (height - 6) / rows, jitter = straight ? .08 : .18;
    const cx = Math.round(3 + (x + .5 + (random() - .5) * jitter) * cellW);
    const cy = Math.round(3 + (y + .5 + (random() - .5) * jitter) * cellH);
    const role: DungeonRole = x === 0 && y === rows - 1 ? "entrance" : design.character === "mine" ? (x === cols - 1 ? "worksite" : "collapse") : design.character === "crypt" ? (y === 0 ? "shrine" : "chamber") : design.character === "crystal" ? "crystal" : random() < .45 ? "crystal" : "collapse";
    rooms.push({ id: `room_${rooms.length}`, role, x: cx, y: cy, width: Math.max(9, Math.min(16, Math.round(cellW * (.42 + random() * .12)))), height: Math.max(8, Math.min(14, Math.round(cellH * (.46 + random() * .12)))) });
  }
  // A slightly larger hall, never a stadium and never a shrink on a big map.
  if (width >= 48 && height >= 40 && design.character !== "crypt") {
    const main = rooms[Math.floor(rooms.length / 2)]!;
    main.width = Math.min(18, main.width + 4); main.height = Math.min(14, main.height + 3);
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
    const from = rooms[a]!, to = rooms[b]!, dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
    const bend = straight ? 0 : (design.path === "winding" ? (random() - .5) * 12 : (random() - .5) * 7);
    const via = straight
      ? [{ x: Math.max(2, Math.min(width - 3, to.x)), y: Math.max(3, Math.min(height - 3, from.y)) }]
      : [{ x: Math.max(2, Math.min(width - 3, Math.round((from.x + to.x) / 2 - dy / len * bend))), y: Math.max(3, Math.min(height - 3, Math.round((from.y + to.y) / 2 + dx / len * bend))) }];
    return { from: from.id, to: to.id, width: straight || design.path === "winding" ? 6.5 : 6.5 + random() * 1.5, via };
  });
  return { rooms, connections };
}
export function segmentDistance(x: number, y: number, a: DungeonPoint, b: DungeonPoint): number {
  const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length2));
  return Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
}
function windingVias(from: DungeonNode, to: DungeonNode, width: number, height: number, seed: number): DungeonPoint[] {
  const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len, amp = Math.min(7, Math.max(4, len * .22));
  return [1, 2, 3].map((i) => {
    const t = i / 4, off = amp * (i % 2 ? -1 : 1) * (((seed + i) % 2) ? 1 : .65);
    return {
      x: Math.max(2, Math.min(width - 3, Math.round(from.x + dx * t + px * off))),
      y: Math.max(3, Math.min(height - 3, Math.round(from.y + dy * t + py * off))),
    };
  });
}
export function dungeonFloorMask(width: number, height: number, graph: DungeonGraph, design: DungeonDesign): boolean[] {
  const phase = (design.seed ?? 1) * .73;
  const noise = (x: number, y: number) => Math.sin(x * .41 + y * .19 + phase) * .45 + Math.cos(y * .52 - x * .17 + phase) * .3;
  const rooms = new Map(graph.rooms.map(r => [r.id, r]));
  const style = design.path;
  const segments = graph.connections.flatMap(c => {
    const from = rooms.get(c.from)!, to = rooms.get(c.to)!;
    const vias = style === "winding" && (c.via?.length ?? 0) < 3 ? windingVias(from, to, width, height, design.seed ?? 1) : (c.via ?? []);
    const points = [from, ...vias, to];
    const declared = (c.width ?? 7) / 2;
    // A cave passage must stay narrower than the rooms it joins. Uncapped (declared+1.6 ≈ 5) it was as
    // wide as a 9×8 room, so every room and link fused into one blob (2026-09-24 r0735 ice cave 36×28).
    const narrowest = Math.min(from.width, from.height, to.width, to.height);
    const radius = style === "cave" ? Math.min(declared + 1.6, Math.max(2.4, narrowest * .32 + .8)) : style ? Math.min(declared, 3.25) : declared;
    return points.slice(1).map((b, i) => ({ a: points[i]!, b, radius }));
  });
  return Array.from({ length: width * height }, (_, k) => {
    const x = k % width, y = Math.floor(k / width);
    if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) return false;
    const n = noise(x, y);
    return graph.rooms.some(r => {
      const dx = Math.abs(x - r.x) / (r.width / 2), dy = Math.abs(y - r.y) / (r.height / 2);
      if (style === "straight" || style === "winding") return Math.max(dx, dy) < 1;
      if (style === "cave") return Math.hypot(dx, dy) < 1 + n * .18;
      return design.character === "crypt" && r.role !== "collapse" ? Math.max(dx, dy) < 1 : Math.hypot(dx, dy) < 1 + n * .1;
    }) || segments.some(s => segmentDistance(x, y, s.a, s.b) < s.radius + (style === "cave" ? n * .55 : style ? 0 : design.character === "crypt" ? 0 : n * .4));
  });
}
