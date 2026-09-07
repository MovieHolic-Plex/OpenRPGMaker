import assert from "node:assert/strict";
import { resolveMaterialSlots } from "../../src/editor/operators/materialSlots";
import { isPassableLanding } from "../../src/project/collision";
import { autotileGroupsForTileset } from "../../src/project/defaults/autotileGroups";
import { computeReachableCells } from "../../src/project/lint/reachability";
import { own } from "../../src/project/spatial/domain";
import type { Project } from "../../src/project/types";
import { fixtureDocument, spaceRoot } from "./spatialSpaceCompilerFixture";

/** Independent numeric oracle for the 22x16 rectangle/polygon shape fixture. */
export function inspectOutdoorShape(proposal: Project) {
  const document = fixtureDocument(proposal);
  const root = own(document.occurrences, spaceRoot);
  const space = own(root.snapshot.library.spaces, root.source.id);
  const binding = root.bindings[0];
  assert.ok(binding);
  const map = own(proposal.maps, binding.mapId);
  assert.equal(map.width, 22);
  assert.equal(map.height, 16);
  const entry = binding.ports[0];
  assert.ok(entry);
  const reached = computeReachableCells(proposal, map, entry.x, entry.y);
  const tileset = own(proposal.tilesets, map.tilesetId);
  const slots = resolveMaterialSlots(tileset);
  const materialTiles = Object.fromEntries(Object.entries(slots).map(([id, slot]) => [id, [
    ...slot.tiles, ...autotileGroupsForTileset(tileset).filter(group => group.memberTileIds.includes(slot.body ?? slot.tiles[0] ?? -1))
      .flatMap(group => Object.values(group.variantMap)),
  ]]));
  const occupied = new Set<number>();
  for (const child of Object.values(document.occurrences).filter(child => child.parentId === root.id)) {
    const projection = child.bindings[0];
    assert.ok(projection);
    for (const cell of own(child.snapshot.kitCells, child.source.id).cells) {
      occupied.add((projection.rect.y + cell.y) * map.width + projection.rect.x + cell.x);
    }
  }
  const counts = { void: 0, path: 0, shore: 0, ground: 0, object: 0, reachable: reached.size };
  for (let y = 0; y < 16; y++) for (let x = 0; x < 22; x++) {
    const index = y * 22 + x;
    const inside = space.shape === "rect" || y >= 2 || (x < 15 && (space.shape === "l" || x >= 2));
    const landing = isPassableLanding(proposal, map, x, y);
    if (!inside) {
      assert.deepEqual([map.lowerTiles[index], map.upperTiles[index]], [-1, -1]);
      assert.equal(landing, false);
      assert.equal(reached.has(`${x},${y}`), false);
      counts.void++;
      continue;
    }
    assert.equal(reached.has(`${x},${y}`), landing);
    if (occupied.has(index)) { counts.object++; continue; }
    const material = x >= 12 && y <= x - 12 ? "shore" : y < 3 ? "path" : "ground";
    assert.ok(own(materialTiles, material).includes(map.lowerTiles[index] ?? -1));
    counts[material]++;
  }
  assert.equal(counts.void, space.shape === "rect" ? 0 : space.shape === "l" ? 14 : 18);
  return { ...counts, shape: space.shape, checkedCells: 352,
    upperRight: { x: 21, y: 0, lower: map.lowerTiles[21], passable: isPassableLanding(proposal, map, 21, 0) },
    upperLeft: { x: 0, y: 0, lower: map.lowerTiles[0], passable: isPassableLanding(proposal, map, 0, 0) } };
}
