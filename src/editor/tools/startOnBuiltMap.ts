// 빈 시드 맵에서 시작하는 게임을 막는다 — 조수가 새 맵에 장소를 지었는데 시작 위치가 템플릿의 빈 풀밭에 남는 결함.
//
// 왜(2026-10-22 조수 장면 교훈 시험, Sonnet 5.5 high): 「성벽 마을」·「지하 창고」 과제에서 조수가 새 맵을 짓고
// 끝냈다. 시작 위치는 새 프로젝트의 빈 맵(map_blank_start)에 그대로 남아, 플레이를 누르면 아무것도 없는 풀밭에서
// 시작하고 지은 장소로 갈 문이 없었다(qa-game unreachable-map·orphan-empty-map). 도구 결과의 「set_start_position 을
// 부르라」 문장은 create_map 에만 있었고 author_beodeul_town·build_hand_interior_room 새 맵 경로에는 없었다.
//
// 규칙: 쓰기 도구 하나가 끝났을 때 시작 맵이 아직 손대지 않은 시드 빈 맵이고, 이번 호출이 새로 지었거나 빈 맵을 처음 칠한 맵이
// 정확히 하나면 시작 위치를 그 맵으로 옮기고 경고로 알린다. 둘 이상이면 옮기지 않고 고르라고 알린다.
// 이미 무언가를 지은 시작 맵·사용자가 고른 시작 맵은 건드리지 않는다.
import { isPassableLanding } from "@/project/collision";
import { isUntouchedMap } from "@/project/projectBlankness";
import { terrainReachability } from "@/project/terrainReachability";
import type { GameMap, Project } from "@/project/types";

export const SEED_START_MAP_ID = "map_blank_start";

/** 지은 맵에서 시작 칸 하나 — 가장 넓게 걸어 닿는 영역 안, 아래 가운데(출입구 쪽)에 가까운 빈 칸. 이벤트 칸은 피한다. */
export function builtMapStartCell(project: Project, map: GameMap): { x: number; y: number } | null {
  const occupied = new Set((map.events ?? []).map((event) => `${event.x},${event.y}`));
  const seen = new Uint8Array(map.width * map.height);
  let best: { cells: number[] } | null = null;
  for (let i = 0; i < seen.length; i++) {
    if (seen[i]) continue;
    const x = i % map.width, y = Math.floor(i / map.width);
    if (!isPassableLanding(project, map, x, y)) { seen[i] = 1; continue; }
    const reach = terrainReachability(project, map, { x, y });
    const cells: number[] = [];
    for (let j = 0; j < reach.length; j++) if (reach[j]) { seen[j] = 1; cells.push(j); }
    if (!best || cells.length > best.cells.length) best = { cells };
  }
  if (!best || best.cells.length < 4) return null;
  const cx = (map.width - 1) / 2;
  let pick: { x: number; y: number; score: number } | null = null;
  for (const j of best.cells) {
    const x = j % map.width, y = Math.floor(j / map.width);
    if (occupied.has(`${x},${y}`) || !isPassableLanding(project, map, x, y)) continue;
    // 아래쪽일수록, 가운데일수록 좋다. 가장자리 한 칸(맵 끝 출구 칸)은 피한다.
    const edge = x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1 ? 1000 : 0;
    const score = (map.height - 1 - y) * 2 + Math.abs(x - cx) + edge;
    if (!pick || score < pick.score) pick = { x, y, score };
  }
  return pick ? { x: pick.x, y: pick.y } : null;
}

function isSeedBlankStart(project: Project): boolean {
  const start = project.maps[project.startMapId];
  return Boolean(start && start.id === SEED_START_MAP_ID && isUntouchedMap(start));
}

/** before→draft 사이에 시작 위치를 옮겼으면 그 안내 문장을, 못 옮겼으면 고르라는 문장을 돌려준다. 할 일이 없으면 null. */
export function adoptBuiltMapAsStart(before: Project, draft: Project): string | null {
  if (!isSeedBlankStart(before) || !isSeedBlankStart(draft)) return null;
  if (draft.startMapId !== before.startMapId || draft.startPos.x !== before.startPos.x || draft.startPos.y !== before.startPos.y) return null;
  // 새로 생긴 맵, 또는 빈 맵으로 만들어 두었다가 이번 호출에서 처음 칠한 맵(create_map → author_wild_route 순서,
  // r2 boss-balance-sim: 시작이 빈 시드 맵에 남아 보스까지 갈 길이 없었다).
  const built = Object.values(draft.maps).filter((map) => (!before.maps[map.id] || isUntouchedMap(before.maps[map.id]!))
    && map.id !== draft.startMapId && !isUntouchedMap(map));
  if (built.length === 0) return null;
  if (built.length > 1) {
    return `게임 시작 위치가 아직 빈 시드 맵 ${SEED_START_MAP_ID} 입니다 — 새로 지은 맵 ${built.map((map) => map.id).join(", ")} 중 시작할 맵을 set_start_position({mapId, x, y}) 로 정하세요. 그대로 두면 플레이는 아무것도 없는 풀밭에서 시작합니다.`;
  }
  const map = built[0]!;
  const cell = builtMapStartCell(draft, map);
  if (!cell) {
    return `게임 시작 위치가 아직 빈 시드 맵 ${SEED_START_MAP_ID} 입니다 — ${map.id} 에서 시작하려면 set_start_position({mapId:"${map.id}", x, y}) 를 부르세요(통행 칸).`;
  }
  draft.startMapId = map.id;
  draft.startPos = cell;
  return `게임 시작 위치를 빈 시드 맵 ${SEED_START_MAP_ID} 에서 새로 지은 ${map.name ?? map.id}(${map.id}) (${cell.x},${cell.y}) 로 옮겼습니다 — 빈 풀밭에서 시작하지 않게. 다른 칸·맵에서 시작하려면 set_start_position 으로 바꾸세요.`;
}

/**
 * 템플릿의 빈 풀밭(시드 맵)에 인물·이벤트만 놓았을 때의 경고. 「작은 마을 맵에 NPC 세 명」을 받고 장소를 짓지 않은 채
 * 빈 시드 맵 풀밭에 세 명을 세웠다(2026-10-22 r2 npc-portrait-match — 판정 「마을이 없다」). 바닥이 그대로인 시드 맵에
 * 이벤트가 처음 생기면 알린다. 사용자가 그 빈 맵을 쓰라고 했으면 무시해도 된다.
 */
export function seedMapPlacementNote(before: Project, draft: Project): string | null {
  const was = before.maps[SEED_START_MAP_ID], now = draft.maps[SEED_START_MAP_ID];
  if (!was || !now || !isUntouchedMap(was) || now.events.length === 0) return null;
  if (!isUntouchedMap({ ...now, events: [] })) return null;
  return `${SEED_START_MAP_ID}(「${now.name ?? "빈 맵"}」)은 새 프로젝트 템플릿의 아무것도 없는 풀밭입니다 — 여기에 이벤트 ${now.events.length}개만 놓였습니다. `
    + `사용자가 장소(마을·방·가게…)를 말했다면 그 장소를 먼저 지은 맵(author_beodeul_town·build_hand_interior_room 등)에 놓으세요. 이 빈 맵을 쓰라고 했다면 무시하세요.`;
}
