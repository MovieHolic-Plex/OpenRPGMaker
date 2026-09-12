/** Read-only QA routes from the Supabase-reloaded project, using real collision rules. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { deserialize } from "../../src/project/io";
import { canMove } from "../../src/project/collision";

const source = process.argv[2] ?? "output/evidence/object-village/reloaded-project.json";
const project = deserialize(fs.readFileSync(source, "utf8"));
const map = project.maps[project.startMapId]!;
assert.ok(map && project.startMapId === map.id);
const regions = map.layoutPlan!.regions;
const targets = [
  { id: "market", target: regions.find(r => r.tags?.includes("market-display"))!.front! },
  { id: "house", target: regions.filter(r => r.objectExterior).sort((a, b) => b.objectExterior!.privateAccess.length - a.objectExterior!.privateAccess.length)[0]!.objectExterior!.doorApproaches[0]! },
  { id: "lakeside", target: regions.find(r => r.tags?.includes("lakeside"))!.front! },
];
const key = (x: number, y: number): string => `${x},${y}`;
type Point = { x: number; y: number };
const previous = new Map<string, Point | null>([[key(project.startPos.x, project.startPos.y), null]]);
const queue: Point[] = [project.startPos];
for (let index = 0; index < queue.length; index++) {
  const p = queue[index]!;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const next = { x: p.x + dx, y: p.y + dy }, id = key(next.x, next.y);
    if (previous.has(id) || !canMove(project, map, p.x, p.y, next.x, next.y)) continue;
    previous.set(id, p); queue.push(next);
  }
}
const walks = targets.map(({ id, target }) => {
  assert.ok(previous.has(key(target.x, target.y)), `Destination unreachable: ${id}`);
  const route: Point[] = [];
  for (let p: Point | null = target; p; p = previous.get(key(p.x, p.y)) ?? null) route.push(p);
  route.reverse();
  // Teleport only sets up independent checks. The final approach uses real movement.
  const segment = id === "market" ? route : route.slice(-13);
  const moves = segment.slice(1).map((p, i) => ({ kind: "move", dir: p.x > segment[i]!.x ? "right"
    : p.x < segment[i]!.x ? "left" : p.y > segment[i]!.y ? "down" : "up" }));
  return { id, start: segment[0], end: target, moves, fullPathLength: route.length - 1 };
});
const proof = { mapId: map.id, mapSHA256: createHash("sha256").update(JSON.stringify(map)).digest("hex"), walks };
fs.writeFileSync(path.join(path.dirname(source), "walkthroughs.json"), JSON.stringify(proof, null, 2));
console.log(JSON.stringify({ mapId: map.id, walks: walks.map(w => ({ id: w.id, steps: w.moves.length, fullPathLength: w.fullPathLength })) }));
