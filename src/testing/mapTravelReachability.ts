// 맵 A 에서 맵 B 까지 **걸어서 갈 수 있는가**를 실제 통행 판정과 transfer 이벤트로 검사한다.
//
// 왜 필요한가: 이 저장소에서 반복해서 나온 결함이 두 종류였다.
//   ① 관문(transfer 이벤트)이 **통행 불가 타일 위**에 놓여 영원히 밟을 수 없다.
//      projectLint 는 transfer 의 **목적지**만 본다 — 출발 칸이 벽인지는 보지 않는다.
//      완주 시나리오(walkthroughRunner)는 이벤트를 **id 로 호출**하므로 역시 못 잡는다.
//   ② 맵 안에 갇힌 주머니가 생겨 NPC·상자가 도달 불가가 된다(실측: 폐광 곁방 39칸).
//
// 이 모듈은 (mapId, x, y) 상태 공간에서 BFS 한다.
//   - 같은 맵 안 이동: collision.ts 의 `canMove` (4방향 대칭 판정)
//   - 맵 사이 이동: 발판 이벤트의 `transfer` 커맨드. **그 이벤트 칸에 실제로 서 있을 수 있어야** 한다.
//   - 스위치로 잠긴 관문: `openSwitches` 에 든 스위치만 열린 것으로 본다.
//
// 즉 "이 스위치들을 켠 상태에서 항구에서 제단까지 걸어갈 수 있는가"를 그대로 묻는다.
import { canMove, isPassable } from "@/project/collision";
import type { Command, Condition, GameEvent, GameMap, Project } from "@/project/types";

export type TravelStart = { readonly mapId: string; readonly x: number; readonly y: number };

export type TravelOptions = {
  /** 열린 것으로 볼 스위치 id. 없으면 조건 없는 관문만 통과한다. */
  readonly openSwitches?: readonly string[];
  /**
   * 스위치 조건을 무시하고 모든 transfer 를 열어 볼지. `true` 면
   * "스위치를 다 켰다면 지형만으로 갈 수 있는가"를 묻는다 — 지형 결함과 진행 잠금을 분리해 준다.
   */
  readonly ignoreSwitches?: boolean;
};

export type TravelHop = {
  readonly fromMapId: string;
  readonly fromX: number;
  readonly fromY: number;
  readonly eventId: string;
  readonly toMapId: string;
  readonly toX: number;
  readonly toY: number;
};

export type TravelResult = {
  readonly reachable: boolean;
  /** 도달했을 때, 거쳐 간 transfer 목록. 어느 관문을 어떤 순서로 지나는지 그대로 보인다. */
  readonly hops: readonly TravelHop[];
  /** BFS 가 실제로 발을 들인 맵. 여기 없는 맵은 이 시작점에서 아예 닿지 않는다. */
  readonly visitedMapIds: readonly string[];
  /**
   * 밟을 수 없는 자리에 놓인 transfer 이벤트. 도달 실패의 가장 흔한 원인이라 따로 모은다.
   * `reason` 은 "통행 불가" 또는 "닿지 않음"이다.
   */
  readonly unreachableGates: readonly {
    readonly mapId: string;
    readonly eventId: string;
    readonly x: number;
    readonly y: number;
    readonly toMapId: string;
    readonly reason: "통행 불가 타일" | "그 맵에서 닿지 않음";
  }[];
};

/** 페이지 조건이 이 스위치 집합에서 만족되는가. 스위치 외의 조건은 **닫힌 것으로** 본다(보수적). */
function conditionOpen(condition: Condition, open: ReadonlySet<string>, ignoreSwitches: boolean): boolean {
  switch (condition.kind) {
    case "switch":
      if (ignoreSwitches) return true;
      return condition.value ? open.has(condition.switchId) : !open.has(condition.switchId);
    case "all":
      return condition.conditions.every((entry) => conditionOpen(entry, open, ignoreSwitches));
    case "any":
      return condition.conditions.some((entry) => conditionOpen(entry, open, ignoreSwitches));
    case "not":
      return !conditionOpen(condition.condition, open, ignoreSwitches);
    default:
      // 아이템·골드·시간대 등은 이 도구가 판정하지 않는다. 지형 검사가 목적이므로
      // ignoreSwitches 일 때만 열어 준다 — 그러지 않으면 진행 조건이 지형 결함을 가린다.
      return ignoreSwitches;
  }
}

function collectTransfers(commands: readonly Command[], out: { mapId: string; x: number; y: number }[]): void {
  for (const command of commands) {
    if (command.kind === "transfer") {
      out.push({ mapId: command.mapId, x: command.x, y: command.y });
      continue;
    }
    const nested = command as unknown as { then?: Command[]; else?: Command[]; commands?: Command[] };
    if (Array.isArray(nested.then)) collectTransfers(nested.then, out);
    if (Array.isArray(nested.else)) collectTransfers(nested.else, out);
    if (Array.isArray(nested.commands)) collectTransfers(nested.commands, out);
  }
}

/**
 * 한 이벤트가 이 스위치 집합에서 내보내는 transfer 목록.
 *
 * ⚠ 페이지 순서 규약: RM2003 해석은 **뒤에서부터 훑어 마지막으로 조건을 만족한 페이지가 이긴다.**
 * 그래서 뒤에서부터 보고 처음 만족한 페이지 하나만 쓴다 — 앞 페이지를 같이 세면
 * 실제로는 막혀 있는 관문을 열린 것으로 착각한다.
 */
function activeTransfers(
  event: GameEvent,
  open: ReadonlySet<string>,
  ignoreSwitches: boolean,
): { mapId: string; x: number; y: number }[] {
  const pages = event.pages ?? [];
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const page = pages[index];
    if (!page) continue;
    if (!page.conditions.every((condition) => conditionOpen(condition, open, ignoreSwitches))) continue;
    const out: { mapId: string; x: number; y: number }[] = [];
    collectTransfers(page.commands, out);
    return out;
  }
  return [];
}

/**
 * `from` 에서 `toMapId` 까지 걸어서 갈 수 있는가.
 *
 * 목적지는 **맵 id** 다. 층마다 칩셋이 다르므로 "combined_town 층에서 dungeon 층까지"를
 * 묻는 것과 같다 — 칩셋별로 묻고 싶으면 `mapIdsByTileset` 로 목록을 뽑아 쓰면 된다.
 */
export function canTravelBetweenMaps(
  project: Project,
  from: TravelStart,
  toMapId: string,
  options: TravelOptions = {},
): TravelResult {
  const open = new Set(options.openSwitches ?? []);
  const ignoreSwitches = options.ignoreSwitches ?? false;
  const visitedMapIds = new Set<string>();
  const unreachableGates: TravelResult["unreachableGates"][number][] = [];
  const seen = new Set<string>();
  const stateKey = (mapId: string, x: number, y: number): string => `${mapId}:${x},${y}`;
  type Node = { readonly mapId: string; readonly x: number; readonly y: number; readonly hops: readonly TravelHop[] };

  const startMap = project.maps[from.mapId];
  if (!startMap) return { reachable: false, hops: [], visitedMapIds: [], unreachableGates: [] };

  const queue: Node[] = [{ mapId: from.mapId, x: from.x, y: from.y, hops: [] }];
  seen.add(stateKey(from.mapId, from.x, from.y));
  visitedMapIds.add(from.mapId);
  // 맵별 transfer 이벤트 색인 — 매 칸마다 events 를 훑으면 O(칸×이벤트) 가 된다.
  const gatesByCell = new Map<string, GameEvent[]>();
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      const cell = `${map.id}:${event.x},${event.y}`;
      const list = gatesByCell.get(cell);
      if (list) list.push(event);
      else gatesByCell.set(cell, [event]);
    }
  }

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.mapId === toMapId) {
      return { reachable: true, hops: node.hops, visitedMapIds: [...visitedMapIds], unreachableGates };
    }
    const map = project.maps[node.mapId];
    if (!map) continue;

    // 이 칸의 transfer 이벤트를 타고 다른 맵으로
    for (const event of gatesByCell.get(`${map.id}:${node.x},${node.y}`) ?? []) {
      for (const target of activeTransfers(event, open, ignoreSwitches)) {
        const destMap = project.maps[target.mapId];
        if (!destMap) continue;
        const key = stateKey(target.mapId, target.x, target.y);
        if (seen.has(key)) continue;
        seen.add(key);
        visitedMapIds.add(target.mapId);
        queue.push({
          mapId: target.mapId,
          x: target.x,
          y: target.y,
          hops: [...node.hops, {
            fromMapId: map.id, fromX: node.x, fromY: node.y, eventId: event.id,
            toMapId: target.mapId, toX: target.x, toY: target.y,
          }],
        });
      }
    }

    // 같은 맵 안 걷기
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
      const nx = node.x + dx;
      const ny = node.y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const key = stateKey(map.id, nx, ny);
      if (seen.has(key)) continue;
      if (!canMove(project, map, node.x, node.y, nx, ny)) continue;
      seen.add(key);
      queue.push({ mapId: map.id, x: nx, y: ny, hops: node.hops });
    }
  }

  // 실패했다 — 왜인지 도움이 되게 정리한다. 밟을 수 없는 자리의 관문을 모은다.
  for (const map of Object.values(project.maps)) {
    if (!visitedMapIds.has(map.id)) continue;
    for (const event of map.events) {
      const targets = activeTransfers(event, open, ignoreSwitches);
      if (targets.length === 0) continue;
      const standable = isPassable(project, map, event.x, event.y);
      const touched = seen.has(stateKey(map.id, event.x, event.y));
      if (standable && touched) continue;
      unreachableGates.push({
        mapId: map.id,
        eventId: event.id,
        x: event.x,
        y: event.y,
        toMapId: targets[0]!.mapId,
        reason: standable ? "그 맵에서 닿지 않음" : "통행 불가 타일",
      });
    }
  }
  return { reachable: false, hops: [], visitedMapIds: [...visitedMapIds], unreachableGates };
}

/** 칩셋 id → 그 칩셋을 쓰는 맵 id 목록. "칩셋 A 에서 칩셋 B 까지"를 물을 때 쓴다. */
export function mapIdsByTileset(project: Project): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const map of Object.values(project.maps)) {
    (out[map.tilesetId] ??= []).push(map.id);
  }
  return out;
}

/**
 * 칩셋 A 를 쓰는 아무 맵에서 칩셋 B 를 쓰는 아무 맵까지 갈 수 있는가.
 * 시작 칸은 각 맵에서 **통행 가능하고 실제로 나갈 수 있는** 첫 칸을 자동으로 고른다.
 */
export function canTravelBetweenTilesets(
  project: Project,
  fromTilesetId: string,
  toTilesetId: string,
  options: TravelOptions = {},
): TravelResult & { readonly fromMapId?: string; readonly toMapId?: string } {
  const byTileset = mapIdsByTileset(project);
  const fromMaps = byTileset[fromTilesetId] ?? [];
  const toMaps = new Set(byTileset[toTilesetId] ?? []);
  let last: TravelResult = { reachable: false, hops: [], visitedMapIds: [], unreachableGates: [] };
  for (const fromMapId of fromMaps) {
    const map = project.maps[fromMapId];
    if (!map) continue;
    const start = firstStandableCell(project, map);
    if (!start) continue;
    for (const toMapId of toMaps) {
      const result = canTravelBetweenMaps(project, { mapId: fromMapId, ...start }, toMapId, options);
      if (result.reachable) return { ...result, fromMapId, toMapId };
      last = result;
    }
  }
  return last;
}

/** 서 있을 수 있고 **최소 한 방향으로 나갈 수 있는** 첫 칸. 나갈 수 없는 칸을 잡으면 BFS 가 즉시 끝난다. */
export function firstStandableCell(project: Project, map: GameMap): { x: number; y: number } | null {
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!isPassable(project, map, x, y)) continue;
      const canLeave = canMove(project, map, x, y, x + 1, y) || canMove(project, map, x, y, x - 1, y)
        || canMove(project, map, x, y, x, y + 1) || canMove(project, map, x, y, x, y - 1);
      if (canLeave) return { x, y };
    }
  }
  return null;
}
