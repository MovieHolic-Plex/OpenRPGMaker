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

export const DUNGEON_LANDMARKS = ["altar", "tower", "gate", "sound", "beacon"] as const;
export const DUNGEON_PRESSURES = ["patrol", "tide", "rising"] as const;
export type DungeonLandmark = (typeof DUNGEON_LANDMARKS)[number];
export type DungeonPressure = (typeof DUNGEON_PRESSURES)[number];

type Mark = readonly { readonly dx: number; readonly tiles: readonly number[] }[];
/** 표지 = 열 목록(dx 는 기준 칸에서의 가로 오프셋, tiles 는 위에서 아래로 upper 에 찍는다). */
const MARK: Record<DungeonLandmark, Mark> = {
  altar: [{ dx: 0, tiles: [145, 175] }],
  tower: [{ dx: 0, tiles: [446, 476] }],
  gate: [{ dx: 0, tiles: [298] }],
  sound: [{ dx: 0, tiles: [265] }],
  // 등대 꼭대기·봉화대: 횃불 화로대(삼각대 1×2)를 돌기둥 두 개가 두 칸씩 떨어져 감싼다.
  beacon: [{ dx: -2, tiles: [446, 476] }, { dx: 0, tiles: [263, 293] }, { dx: 2, tiles: [446, 476] }],
};
const FIXED = { type: "fixed" as const, speed: 3, frequency: 3 };
const WANDER = { type: "random" as const, speed: 2, frequency: 3 };

function page(id: string, name: string, commands: EventPage["commands"], movement: EventPage["movement"]): EventPage {
  return { id: `${id}_page`, name, conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false, movement, commands };
}

function stamp(map: GameMap, open: (x: number, y: number) => boolean, at: { x: number; y: number }, mark: Mark): boolean {
  const spots = [{ x: at.x, y: at.y - 1 }, { x: at.x + 1, y: at.y }, { x: at.x - 1, y: at.y }, { x: at.x, y: at.y + 1 }];
  for (const spot of spots) {
    const cells = mark.flatMap((column) => column.tiles.map((tile, i) => ({ x: spot.x + column.dx, y: spot.y + i, tile })));
    if (cells.some((c) => !open(c.x, c.y))) continue;
    for (const c of cells) map.upperTiles[c.y * map.width + c.x] = c.tile;
    return true;
  }
  return false;
}

/**
 * 단일 방(layout single-room)의 표지. 예전에는 connected 만 표지를 놓아 single-room 의 landmark 가
 * 말없이 사라졌다(2026-09-24 등대지기: 「등대 꼭대기」가 landmark:"altar" 를 받고도 빈 돌방).
 * 방 북쪽 가운데 바닥(위험지형은 남쪽)에 찍는다. open 은 호출자가 바닥·빈 upper 로 판정한다.
 */
export function applySingleRoomLandmark(map: GameMap, plan: { landmark?: DungeonLandmark; linkMapId?: string; pressure?: DungeonPressure }, open: (x: number, y: number) => boolean): string[] {
  const warnings: string[] = [];
  if (plan.landmark && !stamp(map, open, { x: Math.floor(map.width / 2), y: 5 }, MARK[plan.landmark])) {
    warnings.push(`표지(${plan.landmark})를 놓을 열린 바닥이 없다 — 방을 넓힌다`);
  }
  if (plan.linkMapId) warnings.push(`single-room 은 linkMapId 출입구를 놓지 않는다 — create_transfer_pair 로 ${plan.linkMapId} 와 잇는다`);
  if (plan.pressure) warnings.push(`single-room 은 pressure(${plan.pressure})를 놓지 않는다 — connected 레이아웃에서만 쓴다`);
  return warnings;
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
