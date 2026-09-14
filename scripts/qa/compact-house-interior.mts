import fs from "node:fs";
import { isCeilingTile } from "../../src/editor/interiorHouseWallGrammar";
import assert from "node:assert/strict";
import { canMove, isPassableLanding } from "../../src/project/collision";
import { validateClusterRules } from "../../src/project/lint/clusterRuleValidators";
import { deserialize } from "../../src/project/io";
const source =
  process.argv[2] ?? "output/evidence/compact-interior/preview-project.json";
const project = deserialize(fs.readFileSync(source, "utf8")),
  root = "compact-interior:example:cottage";
const children = Object.values(project.spatialAuthoring!.occurrences).filter(
  (o) => o.parentId === root && o.kind === "space",
);
const room = children.find((o) => o.level === 1)!.bindings[0]!,
  yard = children.find((o) => o.level === 0)!.bindings[0]!;
const map = project.maps[room.mapId]!,
  entry = room.ports[0]!,
  street = yard.ports[0]!;
const enter = project.mapConnections!.find(
  (c) => c.from.mapId === yard.mapId && c.to.mapId === map.id,
)!;
const exit = project.mapConnections!.find(
  (c) => c.from.mapId === map.id && c.to.mapId === yard.mapId,
)!;
const errors = validateClusterRules(project, map.id).filter(
  (i) => i.severity === "error",
);
assert.deepEqual(errors, []);
const directions = [
  ["up", 0, -1],
  ["right", 1, 0],
  ["down", 0, 1],
  ["left", -1, 0],
] as const;
type P = { x: number; y: number };
function path(start: P, end: P, blocked?: P) {
  const queue = [start],
    prev = new Map<string, { p: P; dir: string } | null>([
      [`${start.x},${start.y}`, null],
    ]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]!;
    if (p.x === end.x && p.y === end.y) break;
    for (const [dir, dx, dy] of directions) {
      const n = { x: p.x + dx, y: p.y + dy },
        key = `${n.x},${n.y}`;
      if (
        (blocked?.x === n.x && blocked?.y === n.y) ||
        prev.has(key) ||
        !canMove(project, map, p.x, p.y, n.x, n.y) ||
        (n.x === entry.x &&
          n.y === entry.y &&
          (end.x !== entry.x || end.y !== entry.y))
      )
        continue;
      prev.set(key, { p, dir });
      queue.push(n);
    }
  }
  assert.ok(
    prev.has(`${end.x},${end.y}`),
    `No walking route to ${end.x},${end.y}`,
  );
  const moves = [];
  let p = end;
  while (true) {
    const step = prev.get(`${p.x},${p.y}`);
    if (!step) break;
    moves.unshift({ kind: "move", dir: step.dir });
    p = step.p;
  }
  return moves;
}
// Five solid cells form a north/south partition, with exactly one doorway.
const doorway = { x: 6, y: 7 };
assert.equal(map.roomHarnessPlan!.plan.rooms.length, 2);
for (const x of [3, 7]) {
  assert.equal(map.upperTiles[3 * map.width + x], 148);
  assert.equal(map.upperTiles[4 * map.width + x], 178);
  assert.ok([104, 105, 106, 107].includes(map.lowerTiles[3 * map.width + x]!));
}
for (let y = 1; y <= 4; y++)
  assert.ok(isCeilingTile(map.lowerTiles[y * map.width + 6]!));
for (let y = 4; y < 10; y++)
  assert.equal(isPassableLanding(project, map, 6, y), y === doorway.y);
assert.deepEqual(map.roomHarnessPlan!.plan.door, { x: entry.x, y: entry.y });
assert.throws(
  () => path({ x: 5, y: 7 }, { x: 7, y: 7 }, doorway),
  /No walking route/,
);
let start = { x: entry.x, y: entry.y - 1 };
assert.ok(isPassableLanding(project, map, start.x, start.y));
const targets = [
  { id: "kitchen", x: 2, y: 6 },
  { id: "dining", x: 4, y: 7 },
  { id: "bed", x: 8, y: 6 },
  { id: "wardrobe", x: 7, y: 5 },
  { id: "exit", x: entry.x, y: entry.y },
];
const walks = targets.map((end) => {
  const moves = path(start, end),
    result = { id: end.id, start, end, moves };
  start = end;
  return result;
});
let floor = 0,
  walkable = 0;
for (let y = 4; y < 10; y++)
  for (let x = 2; x < 10; x++) {
    floor++;
    if (isPassableLanding(project, map, x, y)) {
      path({ x: entry.x, y: entry.y - 1 }, { x, y });
      walkable++;
    }
  }
const proof = {
  roomMapId: map.id,
  yardMapId: yard.mapId,
  entry,
  street,
  enter,
  exit,
  walks,
  floorCells: floor,
  walkableFloorCells: walkable,
  allWalkableFloorConnected: true,
  clusterErrors: errors.length,
  solidPartitionCells: 5,
  doorway,
  closingDoorwaySeparatesRooms: true,
};
fs.writeFileSync(
  "output/evidence/compact-interior/walkthroughs.json",
  JSON.stringify(proof, null, 2),
);
console.log(
  JSON.stringify({
    floor,
    walkable,
    steps: walks.reduce((n, w) => n + w.moves.length, 0),
    errors: errors.length,
  }),
);
