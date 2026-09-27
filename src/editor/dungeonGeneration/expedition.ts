/** After the silhouette exists: a way out, one visible goal, one thing that moves. */
import { isPassable } from "@/project/collision";
import type { EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { connectedDungeonLandings, connectedDungeonOpen, isLavaCave, type ConnectedDungeonPlan } from "./connected";
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
/**
 * 표지 = 열 목록(dx 는 기준 칸에서의 가로 오프셋, tiles 는 위에서 아래로 upper 에 찍는다).
 * 칸 번호는 EasyRPG 던전 시트(oprn_dungeon_* 재칠 포함) 그림 대조로 고른다(2026-09-27 전수 조사):
 * 145·175 는 여신상(제단이 아니다), 446·476 이 석주(예전 446 은 「오르간」 라벨이었다), 298 은 나무 팻말,
 * 265 는 룬 석판. 제단은 모든 테마에서 촛불 마법진 3×3(LAVA_ALTAR)을 쓴다.
 */
const MARK: Record<DungeonLandmark, Mark> = {
  // 좁은 방 전용: 3×3 마법진이 들어가지 않을 때만 쓰는 여신상 성소. 경고로 알린다(아래 applyAltar).
  altar: [{ dx: 0, tiles: [145, 175] }],
  tower: [{ dx: 0, tiles: [446, 476] }],
  gate: [{ dx: 0, tiles: [298] }],
  sound: [{ dx: 0, tiles: [265] }],
  // 등대 꼭대기·봉화대: 횃불 화로대(삼각대 1×2)를 돌기둥 두 개가 두 칸씩 떨어져 감싼다.
  beacon: [{ dx: -2, tiles: [446, 476] }, { dx: 0, tiles: [263, 293] }, { dx: 2, tiles: [446, 476] }],
};
/**
 * 제단 = 촛불 마법진(3×3, 441~443·471~473·27~29) — 여신상(145·175)이 아니다
 * (rpg-dungeons 문서: 「보스 자리는 제단·마법진」). 예전엔 용암 동굴에서만 마법진을 쓰고 나머지 테마는
 * 여신상을 「제단」으로 찍었다(2026-09-27 전수 조사). 자리가 넉넉하면 양옆에 화로를 둔다.
 */
const LAVA_ALTAR: Mark = [{ dx: -1, tiles: [441, 471, 27] }, { dx: 0, tiles: [442, 472, 28] }, { dx: 1, tiles: [443, 473, 29] }];
const LAVA_ALTAR_BRAZIERS: Mark = [{ dx: -2, tiles: [263, 293] }, ...LAVA_ALTAR, { dx: 2, tiles: [263, 293] }];

/** 제단을 찍는다 — 마법진(3×3) → 좁으면 여신상 성소(1×2, 경고). 찍었으면 true. */
function stampAltar(map: GameMap, open: (x: number, y: number) => boolean, at: { x: number; y: number }, reach: number, braziers: boolean, warnings: string[]): boolean {
  if (braziers && stamp(map, open, at, LAVA_ALTAR_BRAZIERS, reach)) return true;
  if (stamp(map, open, at, LAVA_ALTAR, reach + 1)) return true;
  if (stamp(map, open, at, MARK.altar)) {
    warnings.push("제단 마법진(3×3)이 들어갈 자리가 없어 여신상 성소(1×2)를 놓았다 — 방을 넓히면 마법진이 된다");
    return true;
  }
  return false;
}
const FIXED = { type: "fixed" as const, speed: 3, frequency: 3 };
const WANDER = { type: "random" as const, speed: 2, frequency: 3 };

function page(id: string, name: string, commands: EventPage["commands"], movement: EventPage["movement"]): EventPage {
  return { id: `${id}_page`, name, conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false, movement, commands };
}

function stamp(map: GameMap, open: (x: number, y: number) => boolean, at: { x: number; y: number }, mark: Mark, reach = 0): boolean {
  const spots = [{ x: at.x, y: at.y - 1 }, { x: at.x + 1, y: at.y }, { x: at.x - 1, y: at.y }, { x: at.x, y: at.y + 1 }];
  // A wider mark (the 3×3 altar) searches rings around the landing instead of its four neighbours only.
  for (let r = 1; r <= reach; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) spots.push({ x: at.x + dx, y: at.y - 1 + dy });
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
  const at = { x: Math.floor(map.width / 2), y: 5 };
  const placed = plan.landmark === "altar"
    ? stampAltar(map, open, at, 2, false, warnings)
    : plan.landmark ? stamp(map, open, at, MARK[plan.landmark]) : true;
  if (plan.landmark && !placed) {
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
    const altar = plan.landmark === "altar";
    const placed = altar
      ? stampAltar(map, open, far, 4, isLavaCave(connected), warnings)
      : stamp(map, open, far, MARK[plan.landmark]);
    if (!placed) warnings.push(altar ? "제단 마법진(3×3)을 놓을 열린 칸이 없다 — 가장 먼 방을 넓힌다" : "표지를 놓을 열린 칸이 없다");
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
