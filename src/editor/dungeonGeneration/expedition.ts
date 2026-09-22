/** After the silhouette exists: a way out, one visible goal, one thing that moves. */
import { isPassable } from "@/project/collision";
import type { EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { connectedDungeonLandings, connectedDungeonOpen, type ConnectedDungeonPlan } from "./connected";
import type { DungeonGraph } from "./topology";

type ExpeditionPlan = ConnectedDungeonPlan & {
  layout?: string;
  graph?: DungeonGraph;
  linkMapId?: string;
  landmark?: DungeonLandmark;
  pressure?: DungeonPressure;
  troopId?: string;
};

export const DUNGEON_LANDMARKS = ["altar", "tower", "gate", "sound"] as const;
export const DUNGEON_PRESSURES = ["patrol", "tide", "rising"] as const;
export type DungeonLandmark = (typeof DUNGEON_LANDMARKS)[number];
export type DungeonPressure = (typeof DUNGEON_PRESSURES)[number];

const MARK: Record<DungeonLandmark, readonly number[]> = {
  altar: [145, 175],
  tower: [446, 476],
  gate: [298],
  sound: [265],
};
const FIXED = { type: "fixed" as const, speed: 3, frequency: 3 };
const WANDER = { type: "random" as const, speed: 2, frequency: 3 };

function page(id: string, name: string, commands: EventPage["commands"], movement: EventPage["movement"]): EventPage {
  return { id: `${id}_page`, name, conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false, movement, commands };
}

function stamp(map: GameMap, open: (x: number, y: number) => boolean, at: { x: number; y: number }, tiles: readonly number[]): boolean {
  const spots = [{ x: at.x, y: at.y - 1 }, { x: at.x + 1, y: at.y }, { x: at.x - 1, y: at.y }, { x: at.x, y: at.y + 1 }];
  for (const spot of spots) {
    const cells = tiles.map((_, i) => ({ x: spot.x, y: spot.y + i }));
    if (cells.some((c) => !open(c.x, c.y))) continue;
    for (let i = 0; i < tiles.length; i++) map.upperTiles[(spot.y + i) * map.width + spot.x] = tiles[i]!;
    return true;
  }
  return false;
}

function passable(project: Project, map: GameMap): { x: number; y: number } | null {
  for (let y = 1; y < map.height - 1; y++) for (let x = 1; x < map.width - 1; x++) if (isPassable(project, map, x, y)) return { x, y };
  return null;
}

export function applyDungeonExpedition(project: Project, map: GameMap, plan: ExpeditionPlan): string[] {
  if (plan.layout !== "connected" || !plan.graph) return [];
  const warnings: string[] = [];
  const connected = plan as ConnectedDungeonPlan;
  const open = connectedDungeonOpen(map, connected);
  const landings = connectedDungeonLandings(map, connected);
  const entranceIndex = Math.max(0, plan.graph.rooms.findIndex((room) => room.role === "entrance"));
  const entrance = landings[entranceIndex] ?? landings[0];
  if (!entrance) return ["착지를 찾지 못해 입구·표지·순찰을 놓지 못했다"];
  let far = entrance;
  for (const landing of landings) if (Math.hypot(landing.x - entrance.x, landing.y - entrance.y) > Math.hypot(far.x - entrance.x, far.y - entrance.y)) far = landing;

  if (plan.landmark) {
    if (!stamp(map, open, far, MARK[plan.landmark])) warnings.push("표지를 놓을 열린 칸이 없다");
  }

  if (plan.linkMapId) {
    const outside = project.maps[plan.linkMapId];
    const outsideAt = outside ? passable(project, outside) : null;
    if (!outside || !outsideAt) warnings.push(`이어질 맵을 찾지 못했다: ${plan.linkMapId}`);
    else {
      const into = `ev_${map.id}_return`;
      const back = `ev_${outside.id}_to_${map.id}`;
      const transfer = (id: string, x: number, y: number, mapId: string, tx: number, ty: number): GameEvent => ({
        id, x, y, trigger: { kind: "playerTouch" }, commands: [],
        pages: [page(id, "출입구", [{ kind: "transfer", mapId, x: tx, y: ty, fade: "black" }], FIXED)],
      });
      map.events = [...(map.events ?? []), transfer(into, entrance.x, entrance.y, outside.id, outsideAt.x, outsideAt.y)];
      outside.events = [...(outside.events ?? []), transfer(back, outsideAt.x, outsideAt.y, map.id, entrance.x, entrance.y)];
    }
  }

  if (plan.pressure === "patrol" && plan.troopId && project.database.troops.some((troop) => troop.id === plan.troopId)) {
    const at = landings.find((landing) => landing !== entrance && landing !== far) ?? entrance;
    map.fieldSpawns = [...(map.fieldSpawns ?? []), {
      id: `spawn_${map.id}_patrol`, troopId: plan.troopId, area: { x: Math.max(0, at.x - 1), y: Math.max(0, at.y - 1), w: 3, h: 3 }, maxAlive: 1, chase: true,
    }];
  } else if (plan.pressure === "patrol") warnings.push("순찰할 트룹 id가 없어 순찰을 놓지 못했다");
  else if (plan.pressure) {
    const id = `ev_${map.id}_${plan.pressure}`;
    const label = plan.pressure === "tide" ? "밀물" : "차오르는 물";
    map.events = [...(map.events ?? []), {
      id, x: entrance.x, y: Math.max(0, entrance.y - 1), trigger: { kind: "playerTouch" }, commands: [],
      pages: [page(id, label, [], WANDER)],
    }];
  }
  return warnings;
}
