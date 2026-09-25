// Author metadata only. Does not download, read, or embed source artwork.
import { readFile, writeFile } from 'node:fs/promises';
const packs = JSON.parse(await readFile(new URL('../../tiledata/pixel-art-world/static-expansion.json', import.meta.url), 'utf8'));
const fail = message => { throw new Error(message); };
const sceneIds = new Set(packs.flatMap(pack => (pack.scenePlans ?? []).map(scene => scene.id)));
for (const pack of packs) {
  const columns = pack.width / pack.tileSize;
  const rows = pack.height / pack.tileSize;
  const count = columns * rows;
  if (columns !== 8 || pack.tileSize !== 32 || !Number.isInteger(rows) || !/^[a-f0-9]{64}$/.test(pack.sha256)) fail(`Invalid sheet ${pack.id}`);
  if (new Set(pack.recipes.map(r => r.id)).size !== pack.recipes.length) fail(`Duplicate recipes ${pack.id}`);
  for (const recipe of pack.recipes) {
    const r = recipe.sourceRect;
    if (Object.values(r).some(v => !Number.isInteger(v)) || r.x < 0 || r.y < 0 || r.width < 1 || r.height < 1 || r.x + r.width > columns || r.y + r.height > rows) fail(`Invalid rectangle ${recipe.id}`);
    recipe.tiles = Array.from({ length: r.height }, (_, y) => Array.from({ length: r.width }, (_, x) => (r.y + y) * columns + r.x + x));
    if (recipe.tiles.flat().includes(pack.floorTile)) fail(`Recipe overwrites floor semantics ${recipe.id}`);
  }
  pack.scenes = (pack.scenePlans ?? []).map(plan => {
    const { id, name, width, height, placements, approachCells, notes, passableTiles, lowerTileIds } = plan;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) fail(`Invalid scene ${id}`);
    const lowerTiles = Array(width * height).fill(plan.baseTile);
    const upperTiles = Array(width * height).fill(-1);
    const indexAt = (x, y) => {
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) fail(`Out of bounds ${id}: ${x},${y}`);
      return y * width + x;
    };
    for (const rect of plan.lowerRects) for (let y = 0; y < rect.height; y++) for (let x = 0; x < rect.width; x++) lowerTiles[indexAt(rect.x + x, rect.y + y)] = rect.tile;
    for (const placement of placements) {
      const recipe = pack.recipes.find(r => r.id === placement.recipeId);
      if (!recipe) fail(`Unknown recipe ${placement.recipeId}`);
      recipe.tiles.forEach((row, y) => row.forEach((tile, x) => {
        const index = indexAt(placement.x + x, placement.y + y);
        if (upperTiles[index] !== -1) fail(`Overlapping upper tiles ${id}: ${placement.x + x},${placement.y + y}`);
        upperTiles[index] = tile;
      }));
    }
    // Distinguish wall-mounted fixtures, floor-standing furniture, and supported tools.
    // A valid path and opaque floor alone do not prove that a cabinet touches the floor.
    for (const placement of placements) {
      const recipe = pack.recipes.find(r => r.id === placement.recipeId);
      if (!recipe.placementKind || !recipe.supportCells?.length) fail(`Missing support metadata ${recipe.id}`);
      const permitted = recipe.placementKind === 'standing' ? passableTiles
        : recipe.placementKind === 'wall-mounted' ? plan.wallTileIds
        : recipe.placementKind === 'countertop' ? recipe.supportTileIds : [];
      for (const cell of recipe.supportCells) {
        if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y) || cell.x < 0 || cell.y < 0 || cell.x >= recipe.sourceRect.width || cell.y >= recipe.sourceRect.height) fail(`Invalid support cell ${recipe.id}`);
        const x = placement.x + cell.x, y = placement.y + cell.y;
        if (!permitted?.includes(lowerTiles[indexAt(x, y)])) fail(`SUPPORT_MISMATCH ${id}/${recipe.id} at ${x},${y}: ${recipe.placementKind}`);
      }
    }
    for (const tile of [...lowerTiles, ...upperTiles]) if (!Number.isInteger(tile) || tile < -1 || tile >= count) fail(`Invalid tile ${id}: ${tile}`);
    const upperIds = new Set(upperTiles.filter(tile => tile >= 0));
    if (lowerTileIds.some(tile => upperIds.has(tile))) fail(`Contradictory layer ${id}`);
    if (lowerTiles.some(tile => !lowerTileIds.includes(tile))) fail(`Missing lower semantics ${id}`);
    const canWalk = index => upperTiles[index] === -1 && passableTiles.includes(lowerTiles[index]);
    const start = indexAt(approachCells[0].x, approachCells[0].y);
    const reachable = new Set(canWalk(start) ? [start] : []);
    const queue = [...reachable];
    for (let q = 0; q < queue.length; q++) {
      const index = queue[q], x = index % width, y = Math.floor(index / width);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (!reachable.has(next) && canWalk(next)) { reachable.add(next); queue.push(next); }
      }
    }
    for (const cell of approachCells) if (!reachable.has(indexAt(cell.x, cell.y))) fail(`Unreachable approach ${id}: ${cell.x},${cell.y}`);
    for (const rect of plan.requiredClearRects ?? []) {
      for (let y = rect.y; y < rect.y + rect.height; y++) for (let x = rect.x; x < rect.x + rect.width; x++) {
        if (!reachable.has(indexAt(x, y))) fail(`CORRIDOR_BLOCKED ${id}: ${x},${y}`);
      }
    }
    const doorTargets = new Set();
    for (const door of plan.doors ?? []) {
      if (!sceneIds.has(door.sceneId) || door.sceneId === id || doorTargets.has(door.sceneId)) fail(`Invalid door target ${id}: ${door.sceneId}`);
      doorTargets.add(door.sceneId);
      const placement = placements.find(p => p.recipeId === 'wood-school-classroom-door' && p.x === door.x && p.y + 2 === door.y);
      if (!placement || upperTiles[indexAt(door.x, door.y)] !== 86) fail(`DOOR_FRAGMENT ${id}: ${door.x},${door.y}`);
      if (door.approach.x !== door.x || door.approach.y !== door.y + 1 || !reachable.has(indexAt(door.approach.x, door.approach.y))) fail(`DOOR_APPROACH_BLOCKED ${id}: ${door.x},${door.y}`);
      if (!approachCells.some(c => c.x === door.approach.x && c.y === door.approach.y)) fail(`Missing documented door approach ${id}`);
    }
    for (const target of plan.requiredDoorTargets ?? []) if (!doorTargets.has(target)) fail(`MISSING_ROOM_CONNECTION ${id}: ${target}`);
    return { id, name, width, height, lowerTiles, upperTiles, placements, approachCells, notes, passableTiles, lowerTileIds, ...(plan.doors ? { doors: plan.doors } : {}) };
  });
  delete pack.scenePlans;
}
await writeFile(new URL('../../src/assets/pixelArtWorldStaticExpansionCatalog.json', import.meta.url), JSON.stringify(packs, null, 2) + '\n');
console.log(`Prepared ${packs.length} static expansion packs, ${packs.reduce((n, p) => n + p.recipes.length, 0)} complete parts, ${packs.reduce((n, p) => n + p.scenes.length, 0)} scene; source artwork excluded.`);
