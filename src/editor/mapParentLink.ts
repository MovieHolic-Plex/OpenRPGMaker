import { createDefaultGameEvent } from "@/editor/eventActions";
import { isPassable } from "@/project/collision";
import { store } from "@/project/store";
import type { GameMap, MapId, Project } from "@/project/types";

export function firstFreeCell(map: GameMap): { x: number; y: number } {
  const taken = new Set(map.events.map((event) => `${event.x},${event.y}`));
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!taken.has(`${x},${y}`)) return { x, y };
    }
  }
  return { x: 0, y: 0 };
}

export function bestTestStartCell(project: Project, map: GameMap): { x: number; y: number } {
  const taken = new Set(map.events.map((event) => `${event.x},${event.y}`));
  const available = (x: number, y: number): boolean =>
    !taken.has(`${x},${y}`) && isPassable(project, map, x, y);

  if (
    project.startMapId === map.id &&
    available(project.startPos.x, project.startPos.y)
  ) {
    return { ...project.startPos };
  }

  const centerX = (map.width - 1) / 2;
  const centerY = (map.height - 1) / 2;
  const candidates: Array<{ x: number; y: number; distance: number }> = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!available(x, y)) continue;
      candidates.push({ x, y, distance: (x - centerX) ** 2 + (y - centerY) ** 2 });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
  const best = candidates[0];
  return best ? { x: best.x, y: best.y } : firstFreeCell(map);
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
