export function isCutByBlockedCell(
  passable: Uint8Array,
  width: number,
  start: readonly [number, number],
  goal: readonly [number, number],
  blocked: readonly [number, number],
): boolean {
  const height = passable.length / width;
  const seen = new Uint8Array(passable.length);
  const queue: [number, number][] = [[start[0], start[1]]];
  seen[start[1] * width + start[0]] = 1;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (current === undefined) continue;
    if (current[0] === goal[0] && current[1] === goal[1]) return false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = current[0] + dx;
      const y = current[1] + dy;
      if (x < 0 || y < 0 || x >= width || y >= height || (x === blocked[0] && y === blocked[1])) continue;
      const index = y * width + x;
      if (seen[index] === 1 || passable[index] !== 1) continue;
      seen[index] = 1;
      queue.push([x, y]);
    }
  }
  return true;
}

export function enclosedComponentSizes(tiles: readonly number[], width: number, tile: number): readonly number[] {
  const height = tiles.length / width;
  const seen = new Uint8Array(tiles.length);
  const sizes: number[] = [];
  for (let origin = 0; origin < tiles.length; origin += 1) {
    if (tiles[origin] !== tile || seen[origin] === 1) continue;
    let touchesEdge = false;
    const queue = [origin];
    seen[origin] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      if (index === undefined) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesEdge = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nextX = x + dx;
        const nextY = y + dy;
        if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
        const next = nextY * width + nextX;
        if (seen[next] === 1 || tiles[next] !== tile) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    if (!touchesEdge) sizes.push(queue.length);
  }
  return sizes;
}
