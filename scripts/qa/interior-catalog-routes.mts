import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { deserialize } from "../../src/project/io";
import { canMove } from "../../src/project/collision";
const source =
  process.argv[2] ??
  "output/evidence/interior-catalog-review/reloaded-project.json";
const project = deserialize(fs.readFileSync(source, "utf8"));
const steps: any[] = [];
function route(
  mapId: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const map = project.maps[mapId]!;
  const exits = new Set(
    project
      .mapConnections!.filter((c) => c.from.mapId === mapId)
      .map((c) => `${c.from.x},${c.from.y}`),
  );
  const queue = [start];
  const parents = new Map([
    [`${start.x},${start.y}`, null as null | { p: typeof start; dir: string }],
  ]);
  for (const p of queue) {
    if (p.x === end.x && p.y === end.y) break;
    for (const [dir, dx, dy] of [
      ["up", 0, -1],
      ["down", 0, 1],
      ["left", -1, 0],
      ["right", 1, 0],
    ] as const) {
      const n = { x: p.x + dx, y: p.y + dy },
        key = `${n.x},${n.y}`;
      if (
        parents.has(key) ||
        !canMove(project, map, p.x, p.y, n.x, n.y) ||
        (exits.has(key) && (n.x !== end.x || n.y !== end.y))
      )
        continue;
      parents.set(key, { p, dir });
      queue.push(n);
    }
  }
  assert.ok(parents.has(`${end.x},${end.y}`));
  const moves = [];
  let p = end;
  while (true) {
    const v = parents.get(`${p.x},${p.y}`);
    if (!v) break;
    moves.unshift({ kind: "move", dir: v.dir });
    p = v.p;
  }
  return moves;
}
for (const [root, floors] of [
  ["house-example:inn-3f", 3],
  ["house-example:workshop-4f", 4],
] as const) {
  const prefix = root.split(":")[1]!;
  const connections = project.mapConnections!.filter((c) =>
    c.id.includes(root),
  );
  const enter = connections.find((c) =>
    c.from.mapId.startsWith("spatial-place:"),
  )!;
  let position = { ...enter.from, y: enter.from.y + 1 };
  steps.push({ id: `${prefix}-yard`, teleport: position });
  const travel = (
    id: string,
    to: { mapId: string; x: number; y: number },
    expected = to,
  ) => {
    steps.push({
      id: `${prefix}-${id}`,
      mapId: position.mapId,
      moves: route(position.mapId, position, to),
      expect: expected,
    });
    position = expected;
  };
  travel("enter", enter.from, enter.to);
  for (let n = 1; n <= floors; n++) {
    travel(`bedroom-${n}`, { mapId: position.mapId, x: 8, y: 6 });
    if (n < floors) {
      const next = connections.find(
        (c) =>
          c.from.mapId === position.mapId &&
          c.to.mapId.includes(`floor-${n + 1}:`),
      )!;
      travel(`up-${n}`, next.from, next.to);
    }
  }
  for (let n = floors; n >= 1; n--) {
    const next = connections.find(
      (c) =>
        c.from.mapId === position.mapId &&
        (n === 1
          ? c.to.mapId.startsWith("spatial-place:")
          : c.to.mapId.includes(`floor-${n - 1}:`)),
    )!;
    travel(`down-${n}`, next.from, next.to);
  }
}
fs.writeFileSync(
  path.join(path.dirname(source), "runtime-routes.json"),
  JSON.stringify({ steps }, null, 2),
);
console.log(`${steps.length} walking steps verified`);
