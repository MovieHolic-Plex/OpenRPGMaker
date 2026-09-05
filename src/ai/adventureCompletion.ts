import type { Command, GameMap, Project } from "@/project/types";
import { canMove } from "@/project/collision";
import { roleCapabilities } from "@/project/tileRoles";
import { eventCommandBranches } from "@/editor/eventCommandBranches";

/** Declared by the intent model, never inferred from incidental NPC/building words. */
export interface AdventureRequirements {
  village: boolean;
  dungeon: boolean;
  party: boolean;
  battle: boolean;
}

export const ADVENTURE_AUTHORING_GUIDE = `요청한 모험의 완료 조건은 실제 플레이 연결이다. 먼저 기존 맵·DB를 조회한다.
마을은 author_village/author_house 등으로 건물과 길을 실제 시공한다. 잔디+흙길+사람은 마을 완성이 아니다.
던전 탐험을 요청했다면 별도 탐험 맵과 create_transfer_pair로 왕복 연결하고 입구의 동굴/문/계단 외형을 조회해 사용한다. 사람 그림을 관문으로 쓰지 않는다.
기본 전투 적은 조회한 트룹을 set_encounter_table 또는 battleProcessing으로 도달 가능한 탐험 맵에 연결한다.
파티 모험은 조회한 actors를 set_project_settings({startActorIds})로 시작 파티에 넣거나 changeParty 합류 이벤트를 만든다. add_companion의 시각 추종과 전투 파티는 다르다.
아이템은 조회한 iconResourceId를 지정한다. 착용 무기는 upsert_equipment로 만들며 items의 legacy type:weapon은 쓰지 않는다.
재시도는 find_events로 기존 ID를 읽고 upsert_event로 갱신한다. place_npc를 되풀이해 동명이인을 늘리지 않는다.
마지막 저작 후 모든 관련 맵 전체를 show_map_region으로 직접 보고, 입구·동선·외형과 중복을 확인한다. lint 무오류는 장르 완성이 아니다. 정식 퀘스트/보스는 요청 없으면 불필요하다.`;

function commands(map: GameMap): Array<{ event: GameMap["events"][number]; command: Command }> {
  const out: Array<{ event: GameMap["events"][number]; command: Command }> = [];
  for (const event of map.events) {
    const walk = (list: readonly Command[]) => {
      for (const command of list) {
        out.push({ event, command });
        for (const branch of eventCommandBranches(command)) walk(branch.commands);
      }
    };
    // Pages are authoritative; obsolete root commands cannot prove playability.
    if (event.pages?.length) for (const page of event.pages) walk(page.commands);
    else walk(event.commands);
  }
  return out;
}

function reachableCells(project: Project, map: GameMap, x: number, y: number): Set<string> {
  const seen = new Set<string>();
  const queue = [{ x, y }];
  const blocked = new Set(map.events.filter(e => e.pages?.some(p => p.priority === "same")).map(e => `${e.x},${e.y}`));
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return seen;
  seen.add(`${x},${y}`);
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = point.x + dx, ny = point.y + dy, key = `${nx},${ny}`;
      if (seen.has(key) || blocked.has(key) || !canMove(project, map, point.x, point.y, nx, ny)) continue;
      seen.add(key); queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

function accessible(cells: Set<string>, event: GameMap["events"][number]): boolean {
  if (cells.has(`${event.x},${event.y}`)) return true;
  if (!event.pages?.some(p => p.trigger.kind === "action")) return false;
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => cells.has(`${event.x + dx},${event.y + dy}`));
}

/** Structural lower bound; does not pretend to prove conditions, visual quality or fun. */
export function adventureCompletionProblems(project: Project, required: AdventureRequirements | undefined): string[] {
  if (!required) return [];
  const start = project.maps[project.startMapId];
  if (!start) return ["시작 맵이 없습니다."];
  const problems: string[] = [];
  if (required.village) {
    const tileset = project.tilesets[start.tilesetId];
    const structural = new Set((tileset?.tileGroups ?? []).filter(g => roleCapabilities(tileset, g.role).structure).flatMap(g => g.tileIds));
    if (![...start.lowerTiles, ...start.upperTiles].some(t => structural.has(t))) {
      problems.push("시작 마을에 건물/벽/지붕 구조가 없습니다. author_house/author_village로 실제 마을을 시공하세요.");
    }
  }
  const visited = new Set<string>();
  const pending = [{ mapId: start.id, ...project.startPos }];
  let battle = false;
  const party = new Set(project.system.startActorIds ?? []);
  const actorIds = new Set(project.database.actors.map(a => a.id));
  const troops = new Set(project.database.troops.filter(t => t.enemyIds.length > 0 && t.enemyIds.every(id => project.database.enemies.some(e => e.id === id))).map(t => t.id));
  for (let i = 0; i < pending.length; i++) {
    const point = pending[i], key = `${point.mapId}:${point.x},${point.y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const map = project.maps[point.mapId];
    if (!map) continue;
    const cells = reachableCells(project, map, point.x, point.y);
    if (!cells.size) continue;
    if ((map.encounterRate ?? 0) > 0 && ((map.encounterTable ?? []).some(e => e.weight > 0 && troops.has(e.troopId)) || (!map.encounterTable?.length && map.troopIds?.some(id => troops.has(id))))) battle = true;
    if (map.fieldSpawns?.some(s => troops.has(s.troopId) && [...cells].some(key => { const [x,y] = key.split(',').map(Number); return x >= s.area.x && y >= s.area.y && x < s.area.x+s.area.w && y < s.area.y+s.area.h; }))) battle = true;
    for (const { event, command } of commands(map)) {
      if (!accessible(cells, event)) continue;
      if (command.kind === "transfer" && project.maps[command.mapId]) pending.push({ mapId: command.mapId, x: command.x, y: command.y });
      if (command.kind === "battleProcessing" && troops.has(command.troopId)) battle = true;
      if (command.kind === "changeParty" && command.action === "add" && actorIds.has(command.actorId)) party.add(command.actorId);
    }
  }
  if (required.dungeon && ![...visited].some(key => !key.startsWith(`${start.id}:`))) problems.push("시작 마을에서 도달할 수 있는 탐험 맵 전이가 없습니다. 던전을 저작하고 create_transfer_pair로 연결하세요. 안내문은 입구가 아닙니다.");
  if (required.battle && !battle) problems.push("도달 가능한 전투가 없습니다. 조회한 트룹을 조우표/필드 스폰/battleProcessing에 연결하세요. DB 시드만으로 전투는 시작되지 않습니다.");
  if (required.party && [...party].filter(id => actorIds.has(id)).length < 2) problems.push("전투 파티가 1명뿐이고 도달 가능한 changeParty 합류도 없습니다. 배우 ID 조회 후 시작 파티 또는 합류 이벤트를 저작하세요.");
  return problems;
}
