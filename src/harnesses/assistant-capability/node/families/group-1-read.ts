import type { Project } from '../../../../project/types';
import {
  MAP, blockedCells, called, coordinatesIn, fail, inside, mapOf, mentions, pass, readOnly,
} from '../matrixNativeSpec';
import { rectArg, strArg, type Family, type FamilyOutcome } from './types';

/**
 * Group 1, read half: questions about the map the assistant must answer from a lookup tool.
 * `reference()` is the correct answer text and `readTools` names the lookups that answer presupposes;
 * a judge checks the answer's content (coordinates, names, conclusions), never the wording.
 */

const TILE_LAYERS = ['lowerTiles', 'upperTiles', 'lowerOverlayTiles', 'upperOverlayTiles', 'shadowBits'] as const;
const cellHasAny = (project: Project, x: number, y: number, tags: readonly string[]): boolean => {
  const tileset = (project as any).tilesets[(project as any).maps[MAP].tilesetId];
  const map = mapOf(project);
  return tags.some(tag => TILE_LAYERS.some(layer => {
    const tile = map[layer]?.[y * map.width + x] ?? -1;
    const meta = tileset?.tileMeta?.[tile];
    return Array.isArray(meta?.tags) && meta.tags.map(String).includes(tag);
  }));
};

const coordList = (cells: ReadonlyArray<{ x: number; y: number }>) => cells.map(cell => `(${cell.x},${cell.y})`).join(', ');
const listEvents = (project: Project) => (mapOf(project).events as any[]);
const named = (project: Project, event: any) => event.name ?? event.pages?.[0]?.name ?? event.id;

const OBSTACLE_WORDS = /나무|막힘|막혀|막는|통행\s*불가|못\s*지나|지나갈\s*수\s*없/u;

const regionPreview: Family = {
  id: 'region-preview',
  area: 'read',
  mode: 'read',
  title: '커서 주변 영역 미리보기',
  readTools: ['show_map_region', 'get_map_region'],
  variants: [
    { key: 'cursor-5x5', prompt: '커서 주변 5×5 영역을 미리 보여줘.', args: { rect: { x: 5, y: 0, w: 5, h: 5 } }, setup: { select: { x: 5, y: 0, w: 5, h: 5 } } },
    { key: 'grove-polite', prompt: '선택한 4×4 영역이 어떻게 생겼는지 보여 주세요.', args: { rect: { x: 1, y: 1, w: 4, h: 4 } }, setup: { select: { x: 1, y: 1, w: 4, h: 4 } } },
    { key: 'terse', prompt: '여기 3×3 미리보기.', args: { rect: { x: 5, y: 1, w: 3, h: 3 } }, setup: { select: { x: 5, y: 1, w: 3, h: 3 } } },
    { key: 'plain-meadow', prompt: '선택한 5×4 빈 풀밭을 미리 보여 주세요.', args: { rect: { x: 14, y: 2, w: 5, h: 4 } }, setup: { select: { x: 14, y: 2, w: 5, h: 4 } } },
    { key: 'scope-explained', prompt: '선택 영역(8×4)을 미리 보여 주고, 지나갈 수 없는 칸이 있으면 알려 주세요.', args: { rect: { x: 1, y: 1, w: 8, h: 4 } }, setup: { select: { x: 1, y: 1, w: 8, h: 4 } } },
  ],
  judge(input, args) {
    const rect = rectArg(args);
    const label = `영역 ${rect.w}×${rect.h}`;
    return readOnly(input, label, () => {
      if (!called(input.tools, 'show_map_region', 'get_map_region')) return fail(`${label}: 영역을 조회한 도구 호출이 없다`);
      const blocked = blockedCells(input.before, rect);
      if (!blocked.length) {
        if (OBSTACLE_WORDS.test(input.answer)) return fail(`${label}: 실제로는 막힌 칸이 없는데 막혔다고 했다`);
        const onArea = coordinatesIn(input.answer).some(cell => inside(rect, cell.x, cell.y))
          || input.answer.includes(`${rect.w}×${rect.h}`) || input.answer.includes(`${rect.w}x${rect.h}`);
        return onArea ? pass(`${label}: 미리보기, 막힌 칸 없음`) : fail(`${label}: 물어본 ${rect.w}×${rect.h} 영역이 아니라 다른 곳을 설명했다`);
      }
      if (!OBSTACLE_WORDS.test(input.answer)) return fail(`${label}: 통행 불가 ${blocked.length}칸을 말하지 않았다(장식으로만 서술)`);
      const wrongMaterial = ['물', '성벽', '벽'].filter(word => input.answer.includes(word));
      if (wrongMaterial.length && !blocked.some(cell => cellHasAny(input.before, cell.x, cell.y, ['water', 'wall'])))
        return fail(`${label}: 막힌 칸을 ${wrongMaterial.join('/')}이라 했지만 실제는 나무·덤불이다`);
      return pass(`${label}: 미리보기 + 통행 불가 ${blocked.length}칸 언급`);
    });
  },
  reference(project, args) {
    const rect = rectArg(args);
    const blocked = blockedCells(project, rect);
    if (!blocked.length) return `${rect.w}×${rect.h} 영역은 모두 걸어 다닐 수 있는 풀밭입니다. 이벤트도 물도 없습니다.`;    return `${rect.w}×${rect.h} 영역입니다. 지나갈 수 없는 칸 ${blocked.length}개: ${coordList(blocked)}. 막고 있는 것은 나무·덤불입니다. 나머지 칸은 잔디라 걸어갈 수 있습니다.`;
  },
  wrongs(project, args): FamilyOutcome[] {
    const rect = rectArg(args);
    const blocked = blockedCells(project, rect);
    const elsewhere = `(${rect.x + 6},${rect.y + 9}) 주변은 모두 잔디이고 막힌 칸은 없습니다.`;
    if (blocked.length) {
      const water = `${rect.w}×${rect.h} 영역은 물로 막혀 있습니다.`;
      return [`${rect.w}×${rect.h} 영역은 텅 빈 풀밭이고 장식만 조금 있습니다.`, elsewhere, water];
    }
    return [`${rect.w}×${rect.h} 영역은 나무로 막혀 지나갈 수 없습니다.`, `${rect.w}×${rect.h} 영역은 성벽으로 둘러싸여 있습니다.`, `(${rect.x + 6},${rect.y + 9}) 주변은 모두 잔디이고 막힌 칸은 없습니다.`];
  },
};

const blockedCellsFamily: Family = {
  id: 'blocked-cells',
  area: 'read',
  mode: 'read',
  title: '통행 불가 칸 표시',
  readTools: ['get_map_region'],
  variants: [
    { key: 'grove-8x4', prompt: '이 영역의 통행 불가 칸을 표시해줘.', args: { rect: { x: 1, y: 1, w: 8, h: 4 } }, setup: { select: { x: 1, y: 1, w: 8, h: 4 } } },
    { key: 'grove-polite', prompt: '선택한 5×3 영역에서 지나갈 수 없는 칸을 좌표로 알려 주세요.', args: { rect: { x: 1, y: 1, w: 5, h: 3 } }, setup: { select: { x: 1, y: 1, w: 5, h: 3 } } },
    { key: 'terse', prompt: '여기 4×2 막힌 칸?', args: { rect: { x: 5, y: 1, w: 4, h: 2 } }, setup: { select: { x: 5, y: 1, w: 4, h: 2 } } },
    { key: 'plain-meadow', prompt: '선택한 6×5 빈 풀밭에 막힌 칸이 있는지 확인해 주세요.', args: { rect: { x: 14, y: 2, w: 6, h: 5 } }, setup: { select: { x: 14, y: 2, w: 6, h: 5 } } },
    { key: 'wide-grove', prompt: '숲 지역 전체(8×4)에서 통행 불가 칸을 모두 세어 알려줘.', args: { rect: { x: 1, y: 1, w: 8, h: 4 } }, setup: { select: { x: 1, y: 1, w: 8, h: 4 } } },
  ],
  judge(input, args) {
    const rect = rectArg(args);
    const label = `영역 ${rect.w}×${rect.h}`;
    return readOnly(input, label, () => {
      const truth = blockedCells(input.before, rect);
      const said = coordinatesIn(input.answer).filter(cell => inside(rect, cell.x, cell.y));
      const hit = truth.filter(cell => said.some(s => s.x === cell.x && s.y === cell.y)).length;
      const spurious = said.filter(s => !truth.some(cell => cell.x === s.x && cell.y === s.y)).length;
      const stated = /총\s*(\d+)\s*칸/u.exec(input.answer);
      if (stated && Number(stated[1]) !== truth.length) return fail(`${label}: 총 ${stated[1]}칸이라 했지만 실제는 ${truth.length}칸이다`);
      if (!truth.length) {
        if (spurious) return fail(`${label}: 막힌 칸이 없는데 ${spurious}개 좌표를 지목했다`);
        return /없|0\s*칸/u.test(input.answer) ? pass(`${label}: 막힌 칸 없음`) : fail(`${label}: 막힌 칸이 없다는 결론이 없다`);
      }
      return hit >= Math.ceil(truth.length * 0.7) && spurious <= Math.max(1, Math.floor(truth.length * 0.2))
        ? pass(`${label}: 통행 불가 ${truth.length}칸 중 ${hit}칸 보고`)
        : fail(`${label}: 통행 불가 ${truth.length}칸 중 ${hit}칸만 맞고 틀린 좌표 ${spurious}개`);
    });
  },
  reference(project, args) {
    const rect = rectArg(args);
    const truth = blockedCells(project, rect);
    if (!truth.length) return `${rect.w}×${rect.h} 영역에 통행 불가 칸은 없습니다(총 0칸). 모두 잔디라 걸어갈 수 있습니다.`;
    return `통행 불가 칸은 총 ${truth.length}칸입니다: ${coordList(truth)}. 모두 나무입니다.`;
  },
  wrongs(project, args): FamilyOutcome[] {
    const rect = rectArg(args);
    const truth = blockedCells(project, rect);
    if (!truth.length) {
      return [
        `(${rect.x + 1},${rect.y + 1}) 와 (${rect.x + 3},${rect.y + 2}) 두 칸이 나무로 막혀 있습니다.`,
        `영역 전체가 통행 불가입니다.`,
        `(${rect.x + 2},${rect.y + 1}) 한 칸만 막혀 있습니다.`,
      ];
    }
    const half = truth.slice(0, Math.max(1, Math.ceil(truth.length / 2)));
    return [
      `이 영역에 통행 불가 칸은 없습니다.`,
      `통행 불가 칸은 총 ${truth.length}칸입니다: ${coordList(half)}.`,
      `통행 불가 칸은 총 ${truth.length + 2}칸입니다: ${coordList(truth)}.`,
      `영역 밖 좌표만 있습니다: ${coordList(truth.map(cell => ({ x: cell.x + 12, y: cell.y })))}.`,
    ];
  },
};

const mapNameSize: Family = {
  id: 'map-name-size',
  area: 'read',
  mode: 'read',
  title: '맵 이름과 크기',
  readTools: ['get_project_summary', 'get_map_region'],
  variants: [
    { key: 'current-plain', prompt: '지금 맵의 이름과 크기를 알려줘.', args: { mapId: MAP } },
    { key: 'current-polite', prompt: '현재 열려 있는 맵의 이름과 가로·세로 칸 수를 알려 주세요.', args: { mapId: MAP } },
    { key: 'terse', prompt: '이 맵 이름·크기.', args: { mapId: MAP } },
    { key: 'plaza', prompt: '광장(map_plaza) 맵의 이름과 크기를 알려 주세요.', args: { mapId: 'map_plaza' } },
    { key: 'scope-explained', prompt: '지금 작업 중인 마을 맵의 이름, 가로 칸 수, 세로 칸 수를 모두 말해 주세요.', args: { mapId: MAP } },
  ],
  judge(input, args) {
    const mapId = strArg(args, 'mapId');
    const map = mapOf(input.before, mapId);
    const label = `${mapId} 이름·크기`;
    return readOnly(input, label, () => {
      const nameOk = input.answer.includes(String(map.name));
      const widthOk = new RegExp(`(^|[^0-9])${map.width}([^0-9]|$)`).test(input.answer);
      const heightOk = new RegExp(`(^|[^0-9])${map.height}([^0-9]|$)`).test(input.answer);
      return nameOk && widthOk && heightOk
        ? pass(`${label}: ${map.name} ${map.width}×${map.height}`)
        : fail(`${label}: 이름=${nameOk}, 가로 ${map.width}=${widthOk}, 세로 ${map.height}=${heightOk}`);
    });
  },
  reference(project, args) {
    const map = mapOf(project, strArg(args, 'mapId'));
    return `지금 맵은 「${map.name}」(${map.id}) 이고 크기는 가로 ${map.width}칸, 세로 ${map.height}칸입니다.`;
  },
  wrongs(project, args): FamilyOutcome[] {
    const map = mapOf(project, strArg(args, 'mapId'));
    return [
      `지금 맵은 「${map.name}」입니다.`,
      `지금 맵은 「${map.name}」이고 가로 ${map.width}칸, 세로 ${map.height - 2}칸입니다.`,
      `지금 맵은 「${map.name}」이고 가로 ${map.width + 2}칸, 세로 ${map.height}칸입니다.`,
    ];
  },
};

const entranceEvents = (project: Project) =>
  listEvents(project).filter(event => (event.pages ?? []).some((page: any) => (page.commands ?? []).some((command: any) => command.kind === 'transfer')));

const findEntrances: Family = {
  id: 'find-entrances',
  area: 'read',
  mode: 'read',
  title: '출입구 찾기',
  readTools: ['get_map_region', 'find_events'],
  variants: [
    { key: 'all-plain', prompt: '현재 맵의 출입구를 모두 찾아줘.', args: { mapId: MAP } },
    { key: 'all-polite', prompt: '이 맵에서 다른 곳으로 나가는 출입구를 전부 알려 주세요.', args: { mapId: MAP } },
    { key: 'terse', prompt: '출입구 어디어디야?', args: { mapId: MAP } },
    { key: 'south-and-east', prompt: '동쪽 문과 남쪽 출입구의 위치를 각각 알려 주세요.', args: { mapId: MAP } },
    { key: 'count', prompt: '이 마을에 출입구가 몇 개 있고 각각 어디에 있는지 알려 주세요.', args: { mapId: MAP } },
  ],
  judge(input, args) {
    const mapId = strArg(args, 'mapId');
    const label = `${mapId} 출입구`;
    return readOnly(input, label, () => {
      const entrances = entranceEvents(input.before);
      const found = entrances.filter(event => mentions(input.answer, event.id) || input.answer.includes(named(input.before, event))
        || coordinatesIn(input.answer).some(cell => cell.x === event.x && cell.y === event.y));
      return found.length === entrances.length
        ? pass(`${label} ${entrances.length}곳 모두 보고`)
        : fail(`${label} ${entrances.length}곳 중 ${found.length}곳만 찾았다 (누락: ${entrances.filter(e => !found.includes(e)).map(e => e.id).join(',')})`);
    });
  },
  reference(project) {
    const entrances = entranceEvents(project);
    return `출입구는 ${entrances.length}곳입니다. ${entrances.map(event => `「${named(project, event)}」(${event.x},${event.y}) — ${event.id}`).join(', ')}.`;
  },
  wrongs(project): FamilyOutcome[] {
    const entrances = entranceEvents(project);
    const first = entrances[0]!;
    const other = listEvents(project).find(event => !entrances.includes(event))!;
    return [
      `출입구는 「${named(project, first)}」(${first.x},${first.y}) 한 곳입니다.`,
      `이 맵에는 다른 곳으로 통하는 출입구가 없습니다.`,
      `출입구는 「${named(project, other)}」(${other.x},${other.y}) 입니다.`,
    ];
  },
};

const eventList: Family = {
  id: 'event-list',
  area: 'read',
  mode: 'read',
  title: '이벤트 목록',
  readTools: ['get_map_region', 'find_events'],
  variants: [
    { key: 'list-plain', prompt: '현재 맵의 이벤트 목록만 보여줘.', args: { mapId: MAP } },
    { key: 'list-polite', prompt: '이 맵에 있는 이벤트를 이름과 좌표로 정리해 주세요.', args: { mapId: MAP } },
    { key: 'terse', prompt: '이벤트 뭐뭐 있어?', args: { mapId: MAP } },
    { key: 'npc-only', prompt: '이 맵의 이벤트를 빠짐없이 나열해 주세요.', args: { mapId: MAP } },
    { key: 'with-coords', prompt: '맵 이벤트 전체 목록을 좌표와 함께 알려 주세요.', args: { mapId: MAP } },
  ],
  judge(input, args) {
    const mapId = strArg(args, 'mapId');
    const label = `${mapId} 이벤트 목록`;
    return readOnly(input, label, () => {
      const events = listEvents(input.before);
      const said = events.filter(event => mentions(input.answer, event.id) || input.answer.includes(named(input.before, event)));
      return said.length >= events.length - 1
        ? pass(`${label}: 이벤트 ${events.length}개 중 ${said.length}개 나열`)
        : fail(`${label}: 이벤트 ${events.length}개 중 ${said.length}개만 나열`);
    });
  },
  reference(project) {
    const events = listEvents(project);
    return `이벤트는 ${events.length}개입니다. ${events.map(event => `${named(project, event)}(${event.x},${event.y})`).join(', ')}.`;
  },
  wrongs(project): FamilyOutcome[] {
    const events = listEvents(project);
    return [
      `${named(project, events[0])}(${events[0].x},${events[0].y}) 와 ${named(project, events[1])}(${events[1].x},${events[1].y}) 두 개가 있습니다.`,
      `이 맵에는 이벤트가 없습니다. 타일만 있습니다.`,
      `${events.slice(0, 3).map(event => named(project, event)).join(', ')} 세 개입니다.`,
    ];
  },
};

const blockedEntrance: Family = {
  id: 'blocked-entrance',
  area: 'read',
  mode: 'read',
  title: '막힌 출입구 찾기',
  readTools: ['get_map_region', 'check_reachability'],
  variants: [
    { key: 'which-plain', prompt: '현재 맵의 막힌 출입구를 찾아줘.', args: { mapId: MAP } },
    { key: 'which-polite', prompt: '출입구 중에서 걸어서 나갈 수 없게 된 곳이 있으면 알려 주세요.', args: { mapId: MAP } },
    { key: 'terse', prompt: '막힌 출입구 어디야?', args: { mapId: MAP } },
    { key: 'south-check', prompt: '남쪽 출입구가 지금 걸어서 나갈 수 있는지 확인해 주세요.', args: { mapId: MAP } },
    { key: 'why', prompt: '어느 출입구가 무엇에 막혀 있는지 알려 주세요.', args: { mapId: MAP } },
  ],
  judge(input, args) {
    const mapId = strArg(args, 'mapId');
    const label = `${mapId} 막힌 출입구`;
    return readOnly(input, label, () => {
      const entrances = entranceEvents(input.before);
      const blocked = entrances.filter(event => blockedCells(input.before, { x: event.x - 1, y: event.y - 1, w: 3, h: 3 }).length >= 3);
      if (!blocked.length) return fail(`${label}: fixture 에 막힌 출입구가 없다`);
      const found = blocked.filter(event => mentions(input.answer, event.id) || input.answer.includes(named(input.before, event))
        || coordinatesIn(input.answer).some(cell => cell.x === event.x && cell.y === event.y));
      if (found.length !== blocked.length) return fail(`${label}: 막힌 출입구 ${blocked.length}곳 중 ${found.length}곳만 지목했다`);
      if (!OBSTACLE_WORDS.test(input.answer)) return fail(`${label}: 막힌 출입구를 지목했지만 무엇에 막혔는지 말하지 않았다`);
      return pass(`${label}: ${found.map(event => event.id).join(',')} 지목`);
    });
  },
  reference(project) {
    const blocked = entranceEvents(project).filter(event => blockedCells(project, { x: event.x - 1, y: event.y - 1, w: 3, h: 3 }).length >= 3);
    return blocked.length
      ? `막힌 출입구는 「${named(project, blocked[0])}」(${blocked[0].x},${blocked[0].y}) 한 곳입니다. 주변 칸이 나무로 막혀 있어 걸어서 나갈 수 없습니다.`
      : '막힌 출입구는 없습니다. 모든 출입구로 걸어 나갈 수 있습니다.';
  },
  wrongs(project): FamilyOutcome[] {
    const entrances = entranceEvents(project);
    const blocked = entrances.filter(event => blockedCells(project, { x: event.x - 1, y: event.y - 1, w: 3, h: 3 }).length >= 3);
    const open = entrances.find(event => !blocked.includes(event)) ?? entrances[0]!;
    const other = listEvents(project).find(event => !entrances.includes(event))!;
    return [
      `출입구 중에 막힌 곳은 없습니다. 모두 걸어서 나갈 수 있습니다.`,
      `막힌 곳은 「${named(project, open)}」(${open.x},${open.y}) 입니다.`,
      `「${named(project, other)}」(${other.x},${other.y}) 이 막혀 있습니다.`,
    ];
  },
};

const unreachableLinks: Family = {
  id: 'unreachable-links',
  area: 'read',
  mode: 'read',
  title: '끊긴 연결 찾기',
  readTools: ['run_lint', 'check_reachability'],
  variants: [
    { key: 'plain', prompt: '현재 맵에서 갈 수 없는 연결을 찾아줘.', args: { mapId: MAP } },
    { key: 'polite', prompt: '이 마을에서 문으로 이어지지 않은 맵이 있는지 점검해 주세요.', args: { mapId: MAP } },
    { key: 'terse', prompt: '끊긴 링크 있어?', args: { mapId: MAP } },
    { key: 'scope-explained', prompt: '연결 점검 도구로 돌려서, 시작 마을에서 걸어가거나 문으로 갈 수 없는 맵을 알려 주세요.', args: { mapId: MAP } },
    { key: 'lint', prompt: '맵 연결 상태를 점검하고 문제가 있으면 알려 줘.', args: { mapId: MAP } },
  ],
  judge(input, args) {
    const mapId = strArg(args, 'mapId');
    const label = `${mapId} 연결 점검`;
    return readOnly(input, label, () => {
      if (!called(input.tools, 'run_lint', 'check_reachability')) return fail(`${label}: 연결 점검 도구 호출이 없다`);
      const start = (input.before as any).startMapId ?? mapId;
      const linked = new Set<string>([start]);
      for (const event of listEvents(input.before)) {
        for (const page of event.pages ?? []) for (const command of page.commands ?? []) {
          if (command.kind === 'transfer' && command.mapId) linked.add(String(command.mapId));
        }
      }
      const orphan = Object.keys((input.before as any).maps).filter(id => !linked.has(id));
      const said = orphan.filter(id => mentions(input.answer, id) || input.answer.includes(String((input.before as any).maps[id].name)));
      if (!said.length) return fail(`${label}: 끊긴 맵(${orphan.join(',')})을 지목하지 않았다`);
      return pass(`${label}: 끊긴 맵 ${said.join(',')} 지목`);
    });
  },
  reference(project) {
    const start = (project as any).startMapId ?? MAP;
    const linked = new Set<string>([start]);
    for (const event of listEvents(project)) {
      for (const page of event.pages ?? []) for (const command of page.commands ?? []) {
        if (command.kind === 'transfer' && command.mapId) linked.add(String(command.mapId));
      }
    }
    const orphan = Object.keys((project as any).maps).filter(id => !linked.has(id));
    return orphan.length
      ? `연결 점검 결과, 시작 마을에서 이어지지 않은 맵은 ${orphan.map(id => `${id}(${(project as any).maps[id].name})`).join(', ')} 입니다. 이 맵들로 가는 문이 없습니다.`
      : '연결 점검 결과 모든 맵이 문으로 이어져 있습니다.';
  },
  wrongs(project): FamilyOutcome[] {
    const start = (project as any).startMapId ?? MAP;
    const linked = new Set<string>([start]);
    for (const event of listEvents(project)) {
      for (const page of event.pages ?? []) for (const command of page.commands ?? []) {
        if (command.kind === 'transfer' && command.mapId) linked.add(String(command.mapId));
      }
    }
    const connected = Object.keys((project as any).maps).filter(id => linked.has(id));
    return [
      '연결 점검 결과 모든 맵이 잘 이어져 있습니다. 끊긴 곳은 없습니다.',
      `연결이 끊긴 맵은 ${connected.slice(0, 2).join(', ')} 입니다.`,
      '점검해 보니 이 맵의 타일 배치에는 문제가 없습니다.',
    ];
  },
};

export const GROUP_1_READ: readonly Family[] = [
  regionPreview, blockedCellsFamily, mapNameSize, findEntrances, eventList, blockedEntrance, unreachableLinks,
];
