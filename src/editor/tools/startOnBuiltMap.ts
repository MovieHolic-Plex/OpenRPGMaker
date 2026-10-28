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

/** 맵에서 가장 넓게 걸어 닿는 영역의 칸들(없거나 4칸 미만이면 빈 배열). */
function largestWalkArea(project: Project, map: GameMap): number[] {
  const seen = new Uint8Array(map.width * map.height);
  let best: number[] = [];
  for (let i = 0; i < seen.length; i++) {
    if (seen[i]) continue;
    const x = i % map.width, y = Math.floor(i / map.width);
    if (!isPassableLanding(project, map, x, y)) { seen[i] = 1; continue; }
    const reach = terrainReachability(project, map, { x, y });
    const cells: number[] = [];
    for (let j = 0; j < reach.length; j++) if (reach[j]) { seen[j] = 1; cells.push(j); }
    seen[i] = 1;
    if (cells.length > best.length) best = cells;
    if (best.length > seen.length / 2) break;
  }
  return best.length < 4 ? [] : best;
}

/**
 * 시작 칸 고르기 — 가장 넓게 걸어 닿는 영역 안에서 `near` 에 가까운 칸. 다만 주인공이 화면 끝·물가·물건 틈에 끼어 서지 않게
 * 맵 가장자리 두 줄은 피하고(카메라가 맵 끝에 붙어 주인공이 화면 맨 아래·옆에 선다), 사방이 다 걸을 수 있는 트인 칸을 먼저 고른다.
 * 이벤트 칸과 그 바로 위·아래 칸(3/4 시점에서 몸이 겹친다)도 피한다.
 * 2026-10-29 야외 VQA: 시작 칸을 「아래 가운데」 로 끌어 맵 맨 아랫줄(22,39)·(19,39)에 세웠고(화면 아래 끝에 발이 잘림 4건),
 * 강물 속 시작 칸이 풀밭 한 칸으로 남아 물레방아 옆 물 위에 선 것처럼 보였다.
 */
export function openStartCell(project: Project, map: GameMap, near: { x: number; y: number }, area?: readonly number[]): { x: number; y: number } | null {
  const cells = area ?? largestWalkArea(project, map);
  if (!cells.length) return null;
  const inArea = new Uint8Array(map.width * map.height);
  for (const j of cells) inArea[j] = 1;
  const ev = new Set((map.events ?? []).map((event) => event.y * map.width + event.x));
  const W = map.width, H = map.height;
  let pick: { x: number; y: number; score: number } | null = null;
  for (const j of cells) {
    const x = j % W, y = Math.floor(j / W);
    if (ev.has(j) || !isPassableLanding(project, map, x, y)) continue;
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
    // 트인 정도: 사방 막힘은 칸당 8, 대각선 막힘은 칸당 2 — 집 모서리·물레방아 곁처럼 그림에 몸이 겹치는 틈을 피한다.
    let shut = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && inArea[ny * W + nx]) continue;
      shut += dx && dy ? 2 : 8;
    }
    const stacked = ev.has(j - W) || ev.has(j + W);
    const score = Math.abs(x - near.x) + Math.abs(y - near.y) + (edge < 1 ? 1000 : edge < 2 ? 40 : edge < 3 ? 8 : 0) + shut + (stacked ? 20 : 0);
    if (!pick || score < pick.score) pick = { x, y, score };
  }
  return pick ? { x: pick.x, y: pick.y } : null;
}

/** 지은 맵에서 시작 칸 하나 — 가장 넓게 걸어 닿는 영역 안, 아래 가운데(출입구 쪽)에 가까운 빈 칸. 이벤트 칸은 피한다. */
export function builtMapStartCell(project: Project, map: GameMap): { x: number; y: number } | null {
  const occupied = new Set((map.events ?? []).map((event) => `${event.x},${event.y}`));
  const cells = largestWalkArea(project, map);
  const cx = (map.width - 1) / 2;
  let pick: { x: number; y: number; score: number } | null = null;
  for (const j of cells) {
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
  // 2026-10-22 r3(성벽 마을): 조수가 이 안내를 「잘못 잡힌 시작 맵」으로 읽고 빈 맵으로 되돌린 뒤 맵을 지우고 다시 지었다. 다시 지을 때 또 옮겨졌는데
  // 보고는 「지금 시작 맵은 빈 맵」이라고 했다(저장본은 새 마을). 의도한 동작이고 되돌리지 말라는 것, 다시 지을 땐 같은 mapId 로 부르라는 것을 같이 적는다.
  return `게임 시작 위치를 빈 시드 맵 ${SEED_START_MAP_ID} 에서 새로 지은 ${map.name ?? map.id}(${map.id}) (${cell.x},${cell.y}) 로 옮겼습니다 — 빈 풀밭에서 시작하지 않게(의도한 동작, 오류 아님). `
    + `빈 맵으로 되돌리지 마세요. 이 맵을 지우고 다시 지어도 새 맵이 다시 시작 맵으로 잡힙니다 — 보고할 때 시작 맵은 지금 ${map.id} 입니다(마지막 startMapId 기준). 다른 칸·맵에서 시작하려면 set_start_position 으로 바꾸세요.`;
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
