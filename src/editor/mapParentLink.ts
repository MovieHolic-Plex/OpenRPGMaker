import { createDefaultGameEvent } from "@/editor/eventActions";
import { store } from "@/project/store";
import type { GameMap, MapId } from "@/project/types";

export function firstFreeCell(map: GameMap): { x: number; y: number } {
  const taken = new Set(map.events.map((event) => `${event.x},${event.y}`));
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!taken.has(`${x},${y}`)) return { x, y };
    }
  }
  return { x: 0, y: 0 };
}

export function addParentChildTransfers(parentId: MapId, childId: MapId): boolean {
  if (parentId === childId) return false;
  let ok = false;
  store.update((project) => {
    const parent = project.maps[parentId];
    const child = project.maps[childId];
    if (!parent || !child) return;
    const parentCell = firstFreeCell(parent);
    const childCell = firstFreeCell(child);
    const toChild = createDefaultGameEvent(parentCell.x, parentCell.y, { kind: "action" });
    toChild.commands = [{ kind: "transfer", mapId: childId, x: childCell.x, y: childCell.y, fade: "black" }];
    if (toChild.pages?.[0]) toChild.pages[0].commands = toChild.commands;
    const toParent = createDefaultGameEvent(childCell.x, childCell.y, { kind: "action" });
    toParent.commands = [{ kind: "transfer", mapId: parentId, x: parentCell.x, y: parentCell.y, fade: "black" }];
    if (toParent.pages?.[0]) toParent.pages[0].commands = toParent.commands;
    parent.events.push(toChild);
    child.events.push(toParent);
    ok = true;
  }, { scope: "project" });
  return ok;
}
