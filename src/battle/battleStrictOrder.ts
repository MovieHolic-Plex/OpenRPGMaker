import type { Rng } from "@/util/rng";

export interface Gen1TurnOrderEntry {
  readonly commandClass: "switch" | "field" | "combat";
  readonly priority: number;
  readonly speed: number;
}

const COMMAND_CLASS_RANK: Record<Gen1TurnOrderEntry["commandClass"], number> = {
  switch: 2,
  field: 1,
  combat: 0,
};

function compareTurnKeys(left: Gen1TurnOrderEntry, right: Gen1TurnOrderEntry): number {
  const classDifference = COMMAND_CLASS_RANK[right.commandClass] - COMMAND_CLASS_RANK[left.commandClass];
  if (classDifference !== 0) return classDifference;
  if (left.priority !== right.priority) return right.priority - left.priority;
  return right.speed - left.speed;
}

function hasEqualTurnKeys(left: Gen1TurnOrderEntry, right: Gen1TurnOrderEntry): boolean {
  return left.commandClass === right.commandClass
    && left.priority === right.priority
    && left.speed === right.speed;
}

/**
 * Orders a Gen1 strict round without spending random bytes on unequal actions.
 * Only an actual command-class/priority/speed tie is shuffled.
 */
export function orderGen1TurnActions<T extends Gen1TurnOrderEntry>(actions: readonly T[], rng: Rng): T[] {
  const ordered = [...actions].sort(compareTurnKeys);
  let start = 0;
  while (start < ordered.length) {
    let end = start + 1;
    while (end < ordered.length && hasEqualTurnKeys(ordered[start]!, ordered[end]!)) end += 1;
    for (let index = end - 1; index > start; index -= 1) {
      const swapIndex = start + Math.min(index - start, Math.floor(rng() * (index - start + 1)));
      [ordered[index], ordered[swapIndex]] = [ordered[swapIndex]!, ordered[index]!];
    }
    start = end;
  }
  return ordered;
}
