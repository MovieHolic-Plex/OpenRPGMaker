/** Pure bounded action-skill geometry and status clocks. */
export function skillRay(x: number, y: number, dx: number, dy: number, range: number,
  passable: (x: number, y: number) => boolean): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let i = 1; i <= Math.min(20, Math.max(0, Math.floor(range))); i++) {
    const cell = { x: x + dx * i, y: y + dy * i };
    if (!passable(cell.x, cell.y)) break;
    cells.push(cell);
  }
  return cells;
}

export function skillLineClear(x: number, y: number, tx: number, ty: number,
  passable: (x: number, y: number) => boolean): boolean {
  const steps = Math.ceil(Math.max(Math.abs(tx - x), Math.abs(ty - y)) * 2);
  let previousX = Math.round(x), previousY = Math.round(y);
  for (let i = 1; i <= steps; i++) {
    const nextX = Math.round(x + (tx - x) * i / steps), nextY = Math.round(y + (ty - y) * i / steps);
    if (!passable(nextX, nextY)) return false;
    if (nextX !== previousX && nextY !== previousY && (!passable(nextX, previousY) || !passable(previousX, nextY))) return false;
    previousX = nextX; previousY = nextY;
  }
  return true;
}

export function tickFieldStatus(remainingMs: number, tickMs: number, deltaMs: number): {
  remainingMs: number; tickMs: number; ticks: number;
} {
  const elapsed = Math.min(Math.max(0, remainingMs), Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0);
  const total = tickMs + elapsed;
  return { remainingMs: Math.max(0, remainingMs - elapsed), tickMs: total % 1000, ticks: Math.floor(total / 1000) };
}

/** Validate both costs before either resource is consumed. */
export function canPayActionSkill(mp: number, mpCost: number, inventory: Readonly<Record<string, number>>,
  itemCost?: { itemId: string; amount: number }): boolean {
  if (!Number.isFinite(mp) || !Number.isFinite(mpCost) || mpCost < 0 || mp < mpCost) return false;
  if (!itemCost) return true;
  const available = inventory[itemCost.itemId] ?? 0;
  return Number.isFinite(available) && Number.isFinite(itemCost.amount) && itemCost.amount >= 1 && available >= itemCost.amount;
}
