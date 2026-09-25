import type { GameMap, Project } from "@/project/types";
import type { RoomLayerResult } from "@/editor/roomHarness/types";
import { canMove, isPassable } from "@/project/collision";
import { computeReachableCells } from "@/project/lint/reachability";
import { validateIceDiagonalTerrain } from "@/project/defaults/iceDiagonalTerrain";
import { dungeonFloorMask, dungeonRandom, planDungeonGraph, validateDungeonGraph, type DungeonDesign, type DungeonPoint } from "./topology";
import { dungeonMaterial, dungeonPath, nearestDungeonFloor, shapeDungeonTerrain, stampDungeonConfluence, stampDungeonIceRelief, DUNGEON_STEPS } from "./terrain";
import { layDungeonRail } from "./rail";
import { countLava, LAVA_BRIDGE, LAVA_TILES, stampLavaPools, stampLavaRiver } from "./lava";

export type ConnectedDungeonPlan = DungeonDesign & { mapId: string; name: string; width: number; height: number; theme: "stone" | "lava" | "ice"; hazard?: boolean };
const BRIDGES = [252, 253, 254], RAILS = [54, 55, 84, 85, 116, 144];
/** Walkable board over a hazard: the cliff ledge boards and the lava cave's plank bridge (141). */
const PLANKS = [...BRIDGES, LAVA_BRIDGE];
/** A lava cave (lava theme outside a crypt) paints the documented red rock, lava river and pools. */
export function isLavaCave(plan: { theme: string; character?: string }): boolean { return plan.theme === "lava" && plan.character !== "crypt"; }
export function connectedDungeonOpen(map: GameMap, plan: ConnectedDungeonPlan): (x: number, y: number) => boolean {
  const floor = dungeonMaterial(plan.theme, plan.character).floor;
  return (x, y) => x >= 0 && y >= 0 && x < map.width && y < map.height && (PLANKS.includes(map.upperTiles[y * map.width + x]!) || RAILS.includes(map.upperTiles[y * map.width + x]!) || [floor, 196, ...PLANKS].includes(map.lowerTiles[y * map.width + x]!) && map.upperTiles[y * map.width + x] === -1);
}
export function connectedDungeonLandings(map: GameMap, plan: ConnectedDungeonPlan): DungeonPoint[] {
  const graph = planDungeonGraph(plan.width, plan.height, plan), open = connectedDungeonOpen(map, plan);
  return graph.rooms.map(r => nearestDungeonFloor(r, map.width, map.height, open) ?? { x: r.x, y: r.y });
}
const SPRITES = {
  crystal: [[320, 321], [350, 351]], spike: [[262], [292]], shards: [[119], [149]], fragments: [[413]],
  boulder: [[322, 323], [352, 353]], pile: [[318, 319], [348, 349]], scree: [[259, 260]], rubble: [[383]],
  barrel: [[417]], bucket: [[419]], sign: [[298]], statue: [[145], [175]], idol: [[146], [176]],
  memorial: [[148]], plaque: [[265]], pillar: [[446], [476]], broken: [[476]], bones: [[299]],
  // Lava cave (dungeon-lava-cave.md): brown rock in the theme colour and a brazier; never blue crystal or a goddess statue.
  redPile: [[318, 319], [348, 349]], redScree: [[259, 260]], redRubble: [[412]], redSpike: [[288]], brazier: [[263], [293]],
} satisfies Record<string, number[][]>;
type Prop = keyof typeof SPRITES;

export function applyConnectedDungeonLayer(map: GameMap, plan: ConnectedDungeonPlan, layer: string, project?: Project): RoomLayerResult {
  const graph = planDungeonGraph(plan.width, plan.height, plan), errors = validateDungeonGraph(graph, plan.width, plan.height);
  const result = (next: GameMap, summary: string, warnings: string[] = []): RoomLayerResult => ({ map: next, summary, warnings, ok: warnings.length === 0 });
  if (errors.length) return result(map, "invalid room graph", errors);
  if (layer === "plan") return result(map, `connected graph: ${graph.rooms.length} rooms, ${graph.connections.length} links`);
  if (layer === "critique") { const report = evaluateConnectedDungeon(map, plan, project); return result(map, report.feedbackForLlm, [...report.issues]); }
  const next: GameMap = { ...map, lowerTiles: [...map.lowerTiles], upperTiles: [...map.upperTiles] }, W = map.width, H = map.height;
  const material = dungeonMaterial(plan.theme, plan.character), mask = dungeonFloorMask(W, H, graph, plan);
  if (layer === "ceiling") {
    next.lowerTiles = mask.map(v => v ? material.floor : material.roof);
    next.upperTiles.fill(-1);
    shapeDungeonTerrain(next, material.roofKey, mask.flatMap((v, k) => v ? [] : [{ x: k % W, y: Math.floor(k / W) }]));
    // The edge of the canvas itself is not a frame.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x === 0 || y === 0 || x === W - 1 || y === H - 1) next.lowerTiles[y * W + x] = material.roof;
    return result(next, "room-and-corridor silhouette");
  }
  if (layer === "wall") {
    for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x] && !mask[(y - 1) * W + x]) for (let dy = 0; dy < 2 && y + dy < H && mask[(y + dy) * W + x]; dy++) next.lowerTiles[(y + dy) * W + x] = dy === 0 ? material.wallTop : material.wallBottom;
    return result(next, "straight supported walls under ceiling boundaries");
  }
  if (layer === "floor") return result(map, "preserved room floors and variable-width passages");
  if (layer !== "hazard") return result(map, "unknown connected dungeon layer", [`unknown layer: ${layer}`]);
  const random = dungeonRandom((plan.seed ?? 1) + 901), at = (p: DungeonPoint) => p.y * W + p.x;
  const lavaCave = isLavaCave(plan), lavaHazard = lavaCave && plan.hazard !== false;
  let river = false;
  if (plan.hazard !== false && plan.character !== "crypt") {
    if (plan.theme === "ice") stampDungeonIceRelief(next, graph);
    // A lava cave gets one fire river across its largest room instead of the rock-cliff confluence.
    else if (lavaCave) river = !!stampLavaRiver(next, graph, material.floor, dungeonRandom((plan.seed ?? 1) + 577));
    else stampDungeonConfluence(next, graph, material.floor);
  }
  const open = connectedDungeonOpen(next, plan), landings = connectedDungeonLandings(next, plan);
  const entranceIndex = Math.max(0, graph.rooms.findIndex(r => r.role === "entrance")), entrance = landings[entranceIndex]!;
  const reserved = new Set<number>();
  for (const goal of landings) {
    const route = dungeonPath(W, H, entrance, goal, open);
    if (!route) return result(map, "terrain disconnects room graph", [`walkability: room unreachable (${goal.x},${goal.y})`]);
    for (const p of route) reserved.add(at(p));
  }
  // Reserve each authored graph link as well as the spanning route to the entrance.
  for (const edge of graph.connections) {
    const a = landings[graph.rooms.findIndex(r => r.id === edge.from)]!, b = landings[graph.rooms.findIndex(r => r.id === edge.to)]!;
    for (const p of dungeonPath(W, H, a, b, open) ?? []) reserved.add(at(p));
  }
  // Landings at every crossing remain clear even when the shortest room route bypasses it.
  for (let k = 0; k < next.upperTiles.length; k++) if (PLANKS.includes(next.upperTiles[k]!)) {
    const x = k % W, y = Math.floor(k / W);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (open(x + dx, y + dy)) reserved.add((y + dy) * W + x + dx);
  }
  if (plan.character === "mine") {
    const target = landings.filter((_, i) => graph.rooms[i]!.role === "worksite").sort((a, b) => Math.hypot(b.x - entrance.x, b.y - entrance.y) - Math.hypot(a.x - entrance.x, a.y - entrance.y))[0];
    if (target) for (const p of layDungeonRail(next, entrance, target, open)) reserved.add(at(p));
  }
  if (lavaHazard) stampLavaPools(next, graph, material.floor, reserved, entrance, dungeonRandom((plan.seed ?? 1) + 613));
  else if (plan.theme === "lava" && plan.hazard !== false) {
    const lava: DungeonPoint[] = [];
    for (const room of graph.rooms.filter(r => ["collapse", "chamber"].includes(r.role) && r.width >= 10)) {
      const cx = room.x + Math.round(room.width * (.08 + random() * .18)), cy = room.y + Math.round(random() * 3), rx = 2.5 + random() * 2, ry = 1.5 + random() * 1.5;
      for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 4; x <= cx + 4; x++) if (open(x, y) && !reserved.has(y * W + x) && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1) { next.lowerTiles[y * W + x] = 304; lava.push({ x, y }); }
    }
    shapeDungeonTerrain(next, "lava", lava);
  }
  const used: { x: number; y: number }[] = [];
  const stamp = (x: number, y: number, kind: Prop): boolean => {
    const sprite = SPRITES[kind];
    if (sprite.some((row, dy) => row.some((_, dx) => !open(x + dx, y + dy) || next.lowerTiles[(y + dy) * W + x + dx] !== material.floor || reserved.has((y + dy) * W + x + dx) || next.upperTiles[(y + dy) * W + x + dx] !== -1))) return false;
    sprite.forEach((row, dy) => row.forEach((t, dx) => { next.upperTiles[(y + dy) * W + x + dx] = t; }));
    used.push({ x, y }); return true;
  };
  for (const room of graph.rooms) {
    const pool: Prop[] = lavaCave ? (room.role === "entrance" ? ["brazier", "brazier"] : room.role === "storage" || room.role === "worksite" ? ["barrel", "bucket", "sign"] : room.role === "shrine" ? ["idol", "brazier", "plaque", "pillar"] : ["redPile", "redScree", "redRubble", "redSpike"])
      : room.role === "entrance" || room.role === "storage" || room.role === "worksite" ? ["barrel", "bucket", "sign"] : room.role === "shrine" ? ["statue", "idol", "plaque", "pillar"] : plan.character === "crypt" ? ["memorial", "plaque", "broken"] : (room.role === "crystal" && plan.theme !== "lava") || plan.theme === "ice" ? ["crystal", "spike", "shards", "fragments"] : ["boulder", "pile", "scree", "rubble"];
    const candidates: { x: number; y: number; score: number }[] = [];
    for (let y = Math.max(1, room.y - Math.ceil(room.height / 2)); y < Math.min(H - 2, room.y + room.height / 2); y++) for (let x = Math.max(1, room.x - Math.ceil(room.width / 2)); x < Math.min(W - 2, room.x + room.width / 2); x++) {
      if (!open(x, y) || reserved.has(y * W + x)) continue;
      let distance = 5;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (!open(x + dx, y + dy)) distance = Math.min(distance, Math.hypot(dx, dy));
      if (distance <= 3) candidates.push({ x, y, score: Math.sin(x * .49 + y * .21 + (plan.seed ?? 1)) + random() * .6 - distance * .2 });
    }
    candidates.sort((a, b) => b.score - a.score);
    const anchors: DungeonPoint[] = [], count = room.role === "entrance" ? 1 : Math.min(4, Math.max(1, Math.floor(room.width * room.height / 90)));
    for (const c of candidates) {
      if (anchors.length >= count) break;
      if (anchors.some(p => Math.hypot(p.x - c.x, p.y - c.y) < 5)) continue;
      if (!stamp(c.x, c.y, pool[0]!)) continue;
      anchors.push(c);
      for (let i = 1; i < pool.length; i++) { const dx = Math.round(random() * 6 - 3), dy = 1 + Math.floor(random() * 4); stamp(c.x + dx, c.y + dy, pool[i]!); }
    }
  }
  // Wall-side props leave a room's middle a bare sheet (r0735: an ice cave read as one flat blob).
  // Each non-entrance room gets one free-standing obstacle cluster in its open middle — off every
  // reserved route, so circulation is unchanged, and at least three cells from the walls.
  let obstacles = 0;
  for (const room of graph.rooms) {
    if (room.role === "entrance") continue;
    const cluster: Prop[] = lavaCave ? ["redPile", "bones"] : plan.character === "crypt" ? ["pillar", "broken"] : plan.theme === "ice" || room.role === "crystal" ? ["crystal", "spike"] : ["boulder", "rubble"];
    let best: { x: number; y: number; clearance: number } | undefined;
    for (let y = room.y - Math.floor(room.height / 2); y <= room.y + Math.floor(room.height / 2); y++) for (let x = room.x - Math.floor(room.width / 2); x <= room.x + Math.floor(room.width / 2); x++) {
      if (!open(x, y) || reserved.has(y * W + x)) continue;
      let clearance = 6;
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (!open(x + dx, y + dy)) clearance = Math.min(clearance, Math.hypot(dx, dy));
      const score = clearance - Math.hypot(x - room.x, y - room.y) * .15;
      if (clearance >= 3 && (!best || score > best.clearance)) best = { x, y, clearance: score };
    }
    if (!best || !stamp(best.x, best.y, cluster[0]!)) continue;
    obstacles += 1;
    stamp(best.x + 2, best.y + 1, cluster[1]!) || stamp(best.x - 1, best.y + 2, cluster[1]!);
  }
  let lavaNote = "";
  if (lavaCave) {
    // Floor flames on the lava shore (dungeon-lava-cave.md): a few, off every reserved route.
    const flames: DungeonPoint[] = [];
    for (let y = 1; y < H - 1 && flames.length < 4; y++) for (let x = 1; x < W - 1 && flames.length < 4; x++) {
      const k = y * W + x;
      if (!open(x, y) || next.lowerTiles[k] !== material.floor || next.upperTiles[k] !== -1 || reserved.has(k)) continue;
      if (!DUNGEON_STEPS.some(([dx, dy]) => LAVA_TILES.has(next.lowerTiles[(y + dy) * W + x + dx]!))) continue;
      if (flames.some(p => Math.hypot(p.x - x, p.y - y) < 7) || random() < .6) continue;
      next.upperTiles[k] = flames.length % 2 ? 209 : 207; flames.push({ x, y });
    }
    const { lava, bridge } = countLava(next);
    lavaNote = `, lava ${lava} cells, ${river ? `plank bridge ${bridge} cells over the lava river` : "no lava river (no room wide enough)"}`;
  }
  return result(next, `local relief, reserved circulation, ${used.length} contextual props (${obstacles} free-standing)${lavaNote}`);
}

export function evaluateConnectedDungeon(map: GameMap, plan: ConnectedDungeonPlan, project?: Project) {
  const graph = planDungeonGraph(plan.width, plan.height, plan), issues = validateDungeonGraph(graph, map.width, map.height);
  if (issues.length) return { ok: false, score: 0, issues, metrics: { rooms: 0, links: 0, railCells: 0 }, feedbackForLlm: issues.join("; ") };
  if (map.width !== plan.width || map.height !== plan.height || map.lowerTiles.length !== map.width * map.height || map.upperTiles.length !== map.width * map.height) issues.push("map dimensions differ from plan");
  const W = map.width, H = map.height, material = dungeonMaterial(plan.theme, plan.character), mask = dungeonFloorMask(W, H, graph, plan);
  const open = connectedDungeonOpen(map, plan), landings = connectedDungeonLandings(map, plan), start = landings[Math.max(0, graph.rooms.findIndex(r => r.role === "entrance"))]!;
  if (!start) issues.push("entrance missing");
  else for (const [i, goal] of landings.entries()) if (!dungeonPath(W, H, start, goal, open)) issues.push(`room unreachable: ${graph.rooms[i]!.id}`);
  if (start && project) {
    const reachable = computeReachableCells(project, map, start.x, start.y);
    for (const [i, goal] of landings.entries()) if (!isPassable(project, map, goal.x, goal.y) || !reachable.has(`${goal.x},${goal.y}`)) issues.push(`runtime room unreachable: ${graph.rooms[i]!.id}`);
    for (const goal of landings) {
      const path = dungeonPath(W, H, start, goal, open);
      if (path?.slice(1).some((p, i) => !canMove(project, map, path[i]!.x, path[i]!.y, p.x, p.y))) issues.push("runtime passage metadata conflicts with a reserved route");
    }
  }
  for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x] && !mask[(y - 1) * W + x]) for (let dy = 0; dy < 2 && y + dy < H && mask[(y + dy) * W + x]; dy++) {
    const expected = dy === 0 ? material.wallTop : material.wallBottom;
    if (project && isPassable(project, map, x, y + dy)) issues.push(`runtime wall metadata allows passage (${x},${y + dy})`);
    if (map.lowerTiles[(y + dy) * W + x] !== expected) issues.push(`unsupported ceiling wall (${x},${y + dy})`);
  }
  for (const [kind, sprite] of Object.entries(SPRITES)) {
    if (sprite.length === 1 && sprite[0]!.length === 1) continue;
    for (let k = 0; k < map.upperTiles.length; k++) if (map.upperTiles[k] === sprite[0]![0]) {
      const x = k % W, y = Math.floor(k / W);
      if (sprite.some((row, dy) => row.some((t, dx) => x + dx >= W || y + dy >= H || map.upperTiles[(y + dy) * W + x + dx] !== t || map.lowerTiles[(y + dy) * W + x + dx] !== material.floor))) issues.push(`unsupported or incomplete ${kind} (${x},${y})`);
    }
  }
  for (let k = 0; k < map.lowerTiles.length; k++) {
    const tile = map.lowerTiles[k]!, above = map.lowerTiles[k - W], below = map.lowerTiles[k + W];
    // The lava cave's wall foot is 163 (dungeon-lava-cave.md), not a cliff cap.
    if (tile === material.wallBottom && tile !== 226) continue;
    if ([162, 163].includes(tile) && ![192, 193, 226].includes(below!)) issues.push(`cliff cap missing face (${k % W},${Math.floor(k / W)})`);
    if ([192, 193].includes(tile) && (![162, 163, 192, 193, 226].includes(above!) || ![192, 193, 222, 223, 226].includes(below!))) issues.push(`broken cliff face (${k % W},${Math.floor(k / W)})`);
    if (RAILS.includes(map.upperTiles[k]!) && ![material.floor, 196, ...PLANKS].includes(tile)) issues.push(`unsupported rail (${k % W},${Math.floor(k / W)})`);
  }
  if (plan.theme === "ice") issues.push(...validateIceDiagonalTerrain({ width: W, height: H, lower: map.lowerTiles }).map(i => `ice ${i.code} (${i.x},${i.y})`));
  // Native rail corners must meet the reciprocal connector of the next rail.
  const railMasks: Record<number, number> = { 54: 6, 55: 12, 84: 3, 85: 9, 116: 10, 144: 5 };
  const railCells = map.upperTiles.flatMap((t, k) => RAILS.includes(t) ? [k] : []), seen = new Set<number>();
  if (plan.character === "mine" && graph.rooms.some(r => r.role === "worksite") && railCells.length < 2) issues.push("no continuous haul route to a worksite; widen or change its connecting passages");
  if (railCells.length) {
    const queue = [railCells[0]!]; seen.add(queue[0]!);
    for (let i = 0; i < queue.length; i++) { const k = queue[i]!, bits = railMasks[map.upperTiles[k]!]!; for (let d = 0; d < 4; d++) { const [dx, dy] = DUNGEON_STEPS[d]!, x = k % W + dx, y = Math.floor(k / W) + dy, n = y * W + x; if (x < 0 || y < 0 || x >= W || y >= H || !(bits & 1 << d) || !RAILS.includes(map.upperTiles[n]!)) continue; if (!(railMasks[map.upperTiles[n]!]! & 1 << ((d + 2) % 4))) issues.push(`rail connector mismatch (${x},${y})`); else if (!seen.has(n)) { seen.add(n); queue.push(n); } } }
    if (seen.size !== railCells.length) issues.push("rail line is disconnected");
  }
  const lava = countLava(map);
  if (isLavaCave(plan) && plan.hazard !== false && lava.lava === 0) issues.push("lava cave has no lava; widen a room so a pool or river fits");
  if (project) for (let k = 0; k < map.lowerTiles.length; k++) if (LAVA_TILES.has(map.lowerTiles[k]!) && map.upperTiles[k] !== LAVA_BRIDGE && isPassable(project, map, k % W, Math.floor(k / W))) { issues.push(`runtime lava metadata allows passage (${k % W},${Math.floor(k / W)})`); break; }
  const unique = [...new Set(issues)];
  return { ok: unique.length === 0, score: Math.max(0, 100 - unique.length * 10), issues: unique, metrics: { rooms: graph.rooms.length, links: graph.connections.length, railCells: railCells.length, ...(isLavaCave(plan) ? { lavaCells: lava.lava, lavaBridgeCells: lava.bridge } : {}) }, feedbackForLlm: unique.length ? unique.join("; ") : "연결·지형·소품 지지 검사 통과. 전체 맵 시각 검토는 별도로 수행하세요." };
}
