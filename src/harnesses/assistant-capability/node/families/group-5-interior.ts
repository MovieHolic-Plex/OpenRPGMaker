import { isDeepStrictEqual } from 'node:util';
import { isPassable } from '../../../../project/collision';
import type { Project } from '../../../../project/types';
import { MAP, fail, mapOf, pass, runOn, sameExcept } from '../matrixNativeSpec';
import { numArg, strArg, type Family, type FamilyOutcome } from './types';

const ROOM = 'map_interior_house';
const PLAN_WIDE_DOOR = ['################', '#..............#', '#..............#', '#..............#', '#..............#', '#..............#', '#..............#', '#..............#', '#####.#.########'];
const FURNITURE = [{ id: 'straw bed', x: 2, y: 4 }, { id: 'chest', x: 4, y: 4 }, { id: 'chair N', x: 6, y: 5 }];
const GAP_WEST = 5;
const GAP_EAST = 11;

const INTERIOR_TILESETS = new Set(['atlas_biome_interior', 'jp_city', 'wizarding_world', 'sengoku_edo', 'modern_city', 'modern_campus']);

type Shape = {
  width: number;
  height: number;
  passable: boolean[][];
  doorways: Array<{ start: number; width: number; y: number }>;
  borderOpen: Array<{ x: number; y: number }>;
  holes: number;
  open: number;
  reachable: number;
};

function shapeOf(project: Project, mapId: string): Shape | undefined {
  const map = mapOf(project, mapId);
  if (!map) return undefined;
  const passable = Array.from({ length: map.height }, (_, y) => Array.from({ length: map.width }, (_, x) => isPassable(project, map, x, y)));
  const holes = (map.lowerTiles ?? []).filter((tile: number) => tile === -1).length;
  const doorways: Shape['doorways'] = [];
  let run = 0;
  for (let x = 0; x <= map.width; x++) {
    const open = x < map.width && passable[map.height - 1]?.[x];
    if (open) run += 1;
    else if (run) { doorways.push({ start: x - run, width: run, y: map.height - 1 }); run = 0; }
  }
  const borderOpen: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    if ((x === 0 || y === 0 || x === map.width - 1) && passable[y]![x]) borderOpen.push({ x, y });
  }
  const open = passable.flat().filter(Boolean).length;
  const start = doorways[0] ? { x: doorways[0].start, y: doorways[0].y } : undefined;
  const seen = new Set<string>();
  if (start) {
    const queue = [start];
    seen.add(`${start.x},${start.y}`);
    while (queue.length) {
      const { x, y } = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
        if (!passable[ny]![nx] || seen.has(`${nx},${ny}`)) continue;
        seen.add(`${nx},${ny}`);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return { width: map.width, height: map.height, passable, doorways, borderOpen, holes, open, reachable: seen.size };
}

const newlyBlocked = (before: Project, after: Project, mapId: string): Array<{ x: number; y: number }> => {
  const left = shapeOf(before, mapId);
  const right = shapeOf(after, mapId);
  if (!left || !right) return [];
  const cells: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < right.height; y++) for (let x = 0; x < right.width; x++) {
    const was = left.passable[y]?.[x];
    if (was && !right.passable[y]?.[x]) cells.push({ x, y });
  }
  return cells;
};

/**
 * Cells the answer opened up in the wall band (top wall faces or the outer border). Furniture may be moved or
 * swapped, so only structure counts as "torn down"; otherwise a correctly re-furnished room would be rejected.
 */
const openedStructure = (before: Shape, after: Shape): Array<{ x: number; y: number }> => {
  const cells: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < after.height; y++) for (let x = 0; x < after.width; x++) {
    const structural = y <= 1 || x === 0 || x === after.width - 1;
    if (structural && !before.passable[y]?.[x] && after.passable[y]?.[x]) cells.push({ x, y });
  }
  return cells;
};

const blockedInside = (project: Project, mapId: string): number => {
  const shape = shapeOf(project, mapId)!;
  let count = 0;
  for (let y = 1; y < shape.height - 1; y++) for (let x = 1; x < shape.width - 1; x++) if (!shape.passable[y]?.[x]) count += 1;
  return count;
};

/** Newly blocked cells that touch each other are one piece of furniture, so two separate props count as two. */
const blockGroups = (project: Project, mapId: string, cells: Array<{ x: number; y: number }>): number => {
  void project; void mapId;
  const left = new Set(cells.map(cell => `${cell.x},${cell.y}`));
  let groups = 0;
  while (left.size) {
    groups += 1;
    const [first] = left;
    const queue = [first!];
    left.delete(first!);
    while (queue.length) {
      const [x, y] = queue.shift()!.split(',').map(Number) as [number, number];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const key = `${x + dx},${y + dy}`;
        if (!left.has(key)) continue;
        left.delete(key);
        queue.push(key);
      }
    }
  }
  return groups;
};

const newMapIds = (before: Project, after: Project): string[] =>
  Object.keys((after as any).maps).filter(id => !(before as any).maps[id]);

const changedMaps = (before: Project, after: Project, allow: string[]): string[] =>
  Object.keys((before as any).maps).filter(id => !allow.includes(id) && !isDeepStrictEqual((before as any).maps[id], (after as any).maps[id]));

const removedMaps = (before: Project, after: Project): string[] =>
  Object.keys((before as any).maps).filter(id => !(after as any).maps[id]);

function roomCheck(project: Project, mapId: string, maxDoorway: number): { ok: boolean; note: string } {
  const map = mapOf(project, mapId);
  if (!map) return { ok: false, note: `${mapId} 맵이 없다` };
  if (!INTERIOR_TILESETS.has(map.tilesetId)) return { ok: false, note: `${mapId} 칩셋이 ${map.tilesetId} — 실내 칩셋이 아니다` };
  const shape = shapeOf(project, mapId)!;
  if (shape.holes) return { ok: false, note: `${mapId} 에 빈 바닥 칸(-1) ${shape.holes}개 — 바닥을 다 깔지 않았다` };
  if (shape.borderOpen.length) return { ok: false, note: `${mapId} 외곽에 뚫린 칸 ${shape.borderOpen.length}개 (${shape.borderOpen[0]!.x},${shape.borderOpen[0]!.y})` };
  if (shape.doorways.length !== 1) return { ok: false, note: `${mapId} 남쪽 출입구가 ${shape.doorways.length}곳이다` };
  const door = shape.doorways[0]!;
  if (door.width < 1 || door.width > maxDoorway) return { ok: false, note: `${mapId} 출입구 폭 ${door.width}칸 (요청 ${maxDoorway}칸 이하)` };
  if (!shape.open) return { ok: false, note: `${mapId} 에 실내 바닥이 없다` };
  if (shape.reachable < Math.ceil(shape.open * 0.9)) return { ok: false, note: `${mapId} 출입구에서 닿는 칸 ${shape.reachable}/${shape.open} — 문에서 못 가는 곳이 있다` };
  return { ok: true, note: `${mapId} ${shape.width}×${shape.height}, 걸을 수 있는 칸 ${shape.open}개, 출입구 ${door.width}칸` };
}

const blankTileLayers = (mapId: string) => (doc: any) => {
  const map = doc.maps[mapId];
  if (!map) return;
  for (const key of ['lowerTiles', 'upperTiles', 'lowerOverlayTiles', 'upperOverlayTiles', 'shadowBits', 'lowerTileStacks', 'upperTileStacks', 'doodadGroups', 'terrainDesign', 'relief']) delete map[key];
};

const rectPlan = (width: number, height: number, gap: { at: number; width: number }): string[] =>
  Array.from({ length: height }, (_, y) => {
    if (y === 0) return '#'.repeat(width);
    if (y === height - 1) return `${'#'.repeat(gap.at)}${'.'.repeat(gap.width)}${'#'.repeat(width - gap.at - gap.width)}`;
    return `#${'.'.repeat(width - 2)}#`;
  });

function buildRoom(project: Project, mapId: string, plan: string[], extra: Record<string, unknown> = {}, replace = false): Project {
  const gap = /[.#]+$/u.exec(plan[plan.length - 1] ?? '') ?? undefined;
  void gap;
  return runOn(project, 'build_hand_interior_room', {
    tileset: 'atlas_biome_interior',
    mapId,
    name: '민가',
    plan,
    floor: 'plank',
    wall: 'plaster',
    ...(replace ? { replace: true } : {}),
    ...extra,
  });
}

const prepareFurnishedRoom = (project: Project): Project => buildRoom(project, ROOM, PLAN_WIDE_DOOR, { objects: FURNITURE });

const prepareRoom = (project: Project): Project => buildRoom(project, ROOM, PLAN_WIDE_DOOR);

const interiorRoomBuild: Family = {
  id: 'interior-room-build',
  area: 'interior',
  mode: 'write',
  title: '새 실내 방 시공(바닥·벽·문)',
  variants: [
    { key: 'house-plain', prompt: '민가 안을 새로 만들어줘. 방 하나면 되고 문은 하나만.', args: { mapId: ROOM, doorway: 1 } },
    { key: 'inn-polite', prompt: '여관 객실 하나를 손 도트 실내로 지어 주세요. 바닥을 전부 깔고 둘레에 벽, 남쪽에 문 하나를 내 주세요.', args: { mapId: 'map_inn_room', doorway: 1 } },
    { key: 'forge-terse', prompt: '대장간 방 하나. 문 하나.', args: { mapId: 'map_forge', doorway: 1 } },
    { key: 'store-explain', prompt: '창고로 쓸 실내 맵을 하나 지어 주세요. 방 안쪽 바닥은 빈 칸 없이 다 깔고, 외곽은 벽으로 두르고, 남쪽 한 칸만 출입구로 열어 주세요.', args: { mapId: 'map_storehouse', doorway: 1 } },
    { key: 'bakery-casual', prompt: '빵집 안 좀 만들어줘. 문은 한 칸이면 충분해.', args: { mapId: 'map_bakery', doorway: 1 } },
  ],
  judge(input, args) {
    const created = newMapIds(input.before, input.after);
    // The prompt asks for a room, not for a map id — the editor mints the id itself.
    if (created.length !== 1) return fail(`새 맵이 ${created.length}개다 (${created.join(',') || '없음'})`);
    const mapId = created[0]!;
    const touched = changedMaps(input.before, input.after, [mapId]);
    if (touched.length) return fail(`기존 맵 ${touched.join(',')} 가 바뀌었다`);
    const removed = removedMaps(input.before, input.after);
    if (removed.length) return fail(`맵 ${removed.join(',')} 가 사라졌다`);
    const check = roomCheck(input.after, mapId, numArg(args, 'doorway'));
    if (!check.ok) return fail(check.note);
    return sameExcept(input.before, input.after, doc => {
      delete doc.maps[mapId];
      delete doc.mapTree;
      delete doc.startMapId;
      delete doc.startPos;
    }) ? pass(check.note) : fail('새 맵 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    return buildRoom(project, strArg(args, 'mapId'), rectPlan(16, 9, { at: 7, width: 1 }));
  },
  wrongs(project, args): FamilyOutcome[] {
    const mapId = strArg(args, 'mapId');
    const right = buildRoom(project, mapId, rectPlan(16, 9, { at: 7, width: 1 }));
    const flat = runOn(project, 'create_map', { name: '빈 방', width: 16, height: 10 });
    const flatMapId = newMapIds(project, flat)[0]!;
    const filledOnly = runOn(flat, 'fill_region', { mapId: flatMapId, x: 0, y: 0, w: 16, h: 10, layer: 'lower', material: '버들항 모랫길' });
    const sideEffect = runOn(right, 'fill_region', { mapId: MAP, x: 1, y: 16, w: 3, h: 1, layer: 'lower', material: '버들항 모랫길' });
    const twoDoors = buildRoom(project, mapId, PLAN_WIDE_DOOR);
    const extraMap = runOn(right, 'create_map', { name: '여분 맵', width: 12, height: 8 });
    return [filledOnly, sideEffect, twoDoors, extraMap];
  },
};

const judgeFurnish = (input: any, mapId: string, wanted: number) => {
  if (!mapOf(input.before, mapId)) return fail(`${mapId} 맵이 fixture 에 없다`);
  if (!isDeepStrictEqual(mapOf(input.before, mapId).events, mapOf(input.after, mapId)?.events)) return fail(`${mapId} 의 이벤트가 바뀌었다`);
  const touched = changedMaps(input.before, input.after, [mapId]);
  if (touched.length) return fail(`다른 맵 ${touched.join(',')} 가 바뀌었다`);
  const before = shapeOf(input.before, mapId)!;
  const after = shapeOf(input.after, mapId);
  if (!after) return fail(`${mapId} 맵이 사라졌다`);
  if (after.width !== before.width || after.height !== before.height) return fail(`${mapId} 크기가 ${before.width}×${before.height} → ${after.width}×${after.height} 로 바뀌었다`);
  if (after.holes) return fail(`${mapId} 에 빈 바닥 칸(-1) ${after.holes}개`);
  const opened = openedStructure(before, after);
  if (opened.length) return fail(`${mapId} 에서 벽·구조가 허물어져 열린 칸 ${opened.length}개 (${opened[0]!.x},${opened[0]!.y})`);
  const placed = newlyBlocked(input.before, input.after, mapId);
  const groups = blockGroups(after, mapId, placed);
  if (placed.length < wanted) return fail(`${mapId} 새로 놓인 가구 칸이 ${placed.length}개뿐이다 (요청 ${wanted}개)`);
  if (wanted >= 3 && groups < 2) return fail(`${mapId} 가구가 한 덩이뿐이다 (요청 ${wanted}개)`);
  const onBorder = placed.filter(cell => cell.x === 0 || cell.y === 0 || cell.x === after.width - 1 || cell.y === after.height - 1);
  if (onBorder.length) return fail(`가구가 벽·문 칸에 놓였다 (${onBorder[0]!.x},${onBorder[0]!.y})`);
  const door = after.doorways[0];
  if (door && placed.some(cell => cell.y === door.y && cell.x >= door.start && cell.x < door.start + door.width)) return fail('가구가 출입구를 막았다');
  if (after.doorways.length !== before.doorways.length) return fail(`출입구가 ${before.doorways.length} → ${after.doorways.length}곳으로 바뀌었다`);
  const reachableFloor = after.open - placed.length;
  if (after.reachable < Math.ceil(reachableFloor * 0.9)) return fail(`${mapId} 출입구에서 닿는 칸 ${after.reachable}/${reachableFloor} — 가구가 길을 막았다`);
  return sameExcept(input.before, input.after, blankTileLayers(mapId)) ? pass(`${mapId} 가구 ${groups}묶음 ${placed.length}칸, 통행 보존`) : fail('가구 밖 내용이 바뀌었다');
};

const interiorRoomFurnish: Family = {
  id: 'interior-room-furnish',
  area: 'interior',
  mode: 'write',
  title: '실내 방에 가구 놓기',
  variants: [
    { key: 'house-plain', prompt: '민가 안에 가구를 놓아줘. 침대랑 상자, 의자 하나.', args: { mapId: ROOM, objects: FURNITURE }, setup: { select: { x: 0, y: 0, w: 16, h: 9 } } },
    { key: 'inn-polite', prompt: '여관 방 안을 꾸며 주세요. 침대 하나와 탁자 하나를 바닥에 놓고, 문 앞은 비워 두세요.', args: { mapId: ROOM, objects: [{ id: 'straw bed', x: 9, y: 4 }, { id: 'table:plate+cup', x: 11, y: 4 }] } },
    { key: 'forge-terse', prompt: '방에 가구 세 개 놔.', args: { mapId: ROOM, objects: [{ id: 'straw bed', x: 2, y: 3 }, { id: 'chest', x: 5, y: 3 }, { id: 'chair N', x: 8, y: 3 }] } },
    { key: 'store-explain', prompt: '창고로 쓰는 방입니다. 바닥 칸 위에 궤짝과 상자를 놓아 주시고, 벽이나 문을 막지 마세요.', args: { mapId: ROOM, objects: [{ id: 'crate:potato', x: 3, y: 6 }, { id: 'chest', x: 5, y: 6 }] } },
    { key: 'bakery-casual', prompt: '이 방에 탁자 하나랑 의자 하나 놔줘.', args: { mapId: ROOM, objects: [{ id: 'table:loaf+bun', x: 10, y: 5 }, { id: 'chair N', x: 12, y: 5 }] } },
  ],
  prepare: prepareRoom,
  judge(input, args) {
    const wanted = Array.isArray(args.objects) ? args.objects.length : 1;
    // 「이 방」은 지금 보이는 맵을 가리킨다 — 지도에 보이는 맵에 가구를 놓은 답도 정답으로 본다.
    const verdicts = [...new Set([strArg(args, 'mapId'), MAP])].map(mapId => judgeFurnish(input, mapId, wanted));
    return verdicts.find(verdict => verdict.ok) ?? verdicts[0]!;
  },
  reference(project, args) {
    return buildRoom(project, strArg(args, 'mapId'), PLAN_WIDE_DOOR, { objects: args.objects }, true);
  },
  wrongs(project, args): FamilyOutcome[] {
    const mapId = strArg(args, 'mapId');
    const objects = (args.objects as any[]) ?? FURNITURE;
    const right = buildRoom(project, mapId, PLAN_WIDE_DOOR, { objects }, true);
    const partial = buildRoom(project, mapId, PLAN_WIDE_DOOR, { objects: [] }, true);
    const doorBlocked = buildRoom(project, mapId, PLAN_WIDE_DOOR, { objects: [{ id: 'chest', x: GAP_WEST, y: 8 }, { id: 'straw bed', x: 2, y: 4 }] }, true);
    const sideEffect = runOn(right, 'fill_region', { mapId: MAP, x: 2, y: 15, w: 3, h: 1, layer: 'lower', material: '버들항 모랫길' });
    const elsewhere = buildRoom(project, 'map_inn_room', PLAN_WIDE_DOOR, { objects });
    return [partial, doorBlocked, sideEffect, elsewhere];
  },
};

const interiorRoomDoorway: Family = {
  id: 'interior-room-doorway',
  area: 'interior',
  mode: 'write',
  title: '출입구를 하나만 남기기',
  variants: [
    { key: 'west-one', prompt: '이 방 남쪽 출입구가 두 곳인데 하나만 남겨줘. 서쪽 문을 한 칸으로.', args: { mapId: ROOM, keep: 'west', width: 1 }, setup: { select: { x: 0, y: 0, w: 16, h: 9 } } },
    { key: 'east-one-polite', prompt: '출입구는 하나면 됩니다. 동쪽 문만 한 칸 폭으로 남기고 나머지는 막아 주세요. 바닥이 문턱을 지나 안쪽까지 이어져야 합니다.', args: { mapId: ROOM, keep: 'east', width: 1 } },
    { key: 'west-two-terse', prompt: '서쪽 문만, 두 칸.', args: { mapId: ROOM, keep: 'west', width: 2 } },
    { key: 'east-two-explain', prompt: '거리 쪽 두 칸 문과 이어야 합니다. 이 방의 출입구를 동쪽 한 곳으로 정리하고 폭을 두 칸으로 맞춰 주세요. 서쪽 틈은 벽으로 막습니다.', args: { mapId: ROOM, keep: 'east', width: 2 } },
    { key: 'west-one-casual', prompt: '문 하나만 남겨줘. 왼쪽 걸로.', args: { mapId: ROOM, keep: 'west', width: 1 } },
  ],
  prepare: prepareRoom,
  judge(input, args) {
    const mapId = strArg(args, 'mapId');
    const width = numArg(args, 'width');
    const keep = strArg(args, 'keep');
    if (!mapOf(input.before, mapId)) return fail(`${mapId} 맵이 fixture 에 없다`);
    if (!isDeepStrictEqual(mapOf(input.before, mapId).events, mapOf(input.after, mapId)?.events)) return fail(`${mapId} 의 이벤트가 바뀌었다`);
    const touched = changedMaps(input.before, input.after, [mapId]);
    if (touched.length) return fail(`다른 맵 ${touched.join(',')} 가 바뀌었다`);
    const shape = shapeOf(input.after, mapId);
    if (!shape) return fail(`${mapId} 맵이 사라졌다`);
    if (shape.doorways.length !== 1) return fail(`남쪽 출입구가 ${shape.doorways.length}곳이다`);
    const door = shape.doorways[0]!;
    if (door.width !== width) return fail(`출입구 폭 ${door.width}칸 (요청 ${width}칸)`);
    const centre = door.start + (door.width - 1) / 2;
    // 「서쪽/동쪽」은 방의 3분면을 말한다 — 픽스처의 픽셀 하나가 아니라.
    const side = shape.width / 3;
    if (keep === 'west' ? centre > side : centre < shape.width - side) return fail(`출입구가 ${keep === 'west' ? '서쪽' : '동쪽'}이 아니라 x=${door.start} 에 있다`);
    if (shape.borderOpen.length) return fail(`옆·위 외곽에도 뚫린 칸 ${shape.borderOpen.length}개`);
    if (shape.reachable < Math.ceil(shape.open * 0.9)) return fail(`문에서 닿는 칸 ${shape.reachable}/${shape.open}`);
    const above = Array.from({ length: width }, (_, offset) => ({ x: door.start + offset, y: door.y - 1 }));
    const disconnected = above.filter(cell => !shape.passable[cell.y]?.[cell.x]);
    if (disconnected.length) return fail(`문턱 위 칸 (${disconnected[0]!.x},${disconnected[0]!.y}) 이 바닥이 아니다`);
    return pass(`출입구 ${width}칸( ${keep} ), 걸을 수 있는 칸 ${shape.open}개 전부 도달`);
  },
  reference(project, args) {
    const width = numArg(args, 'width');
    const at = strArg(args, 'keep') === 'west' ? GAP_WEST : GAP_EAST;
    return buildRoom(project, strArg(args, 'mapId'), rectPlan(16, 9, { at, width }), { exitWidth: width }, true);
  },
  wrongs(project, args): FamilyOutcome[] {
    const mapId = strArg(args, 'mapId');
    const right = this.reference(project, args) as Project;
    const keep = strArg(args, 'keep');
    const width = numArg(args, 'width');
    const otherSide = keep === 'west' ? 'east' : 'west';
    return [
      runOn(project, 'set_map_properties', { mapId, name: '민가' }),
      this.reference(project, { ...args, keep: otherSide }) as Project,
      this.reference(project, { ...args, width: width === 1 ? 2 : 1 }) as Project,
      runOn(right, 'clear_region', { mapId, x: 0, y: 8, w: 16, h: 1, layer: 'both', fill: 'empty' }),
    ];
  },
};

const interiorRoomSize: Family = {
  id: 'interior-room-size-change',
  area: 'interior',
  mode: 'write',
  title: '방을 넓히고 바닥·벽 추가',
  variants: [
    { key: 'wider-plain', prompt: '이 방을 넓혀줘. 가로 20, 세로 12칸쯤으로.', args: { mapId: ROOM, width: 20, height: 12 } },
    { key: 'wider-polite', prompt: '방이 좁습니다. 가로 20칸·세로 12칸으로 늘려 주시고, 늘어난 곳에도 바닥과 벽을 마저 깔아 주세요. 안에 있던 가구는 그대로 두세요.', args: { mapId: ROOM, width: 20, height: 12 } },
    { key: 'taller-terse', prompt: '세로로 좀 늘려, 20×12.', args: { mapId: ROOM, width: 20, height: 12 } },
    { key: 'wider-explain', prompt: '가구를 더 놓으려고 합니다. 방을 20×12 로 확장하고, 늘어난 영역을 바닥과 외곽 벽으로 마감해 주세요. 기존 가구와 출입구는 유지해 주세요.', args: { mapId: ROOM, width: 20, height: 12 } },
    { key: 'bigger-casual', prompt: '방 좀 키워줘. 18×11 정도로.', args: { mapId: ROOM, width: 18, height: 11 } },
  ],
  prepare: prepareFurnishedRoom,
  judge(input, args) {
    const mapId = strArg(args, 'mapId');
    const width = numArg(args, 'width');
    const height = numArg(args, 'height');
    if (!mapOf(input.before, mapId)) return fail(`${mapId} 맵이 fixture 에 없다`);
    if (!isDeepStrictEqual(mapOf(input.before, mapId).events, mapOf(input.after, mapId)?.events)) return fail(`${mapId} 의 이벤트가 바뀌었다`);
    const touched = changedMaps(input.before, input.after, [mapId]);
    if (touched.length) return fail(`다른 맵 ${touched.join(',')} 가 바뀌었다`);
    const before = shapeOf(input.before, mapId)!;
    const after = shapeOf(input.after, mapId);
    if (!after) return fail(`${mapId} 맵이 사라졌다`);
    if (after.width < width || after.height < height) return fail(`${after.width}×${after.height} (요청 ${width}×${height})`);
    if (after.width <= before.width && after.height <= before.height) return fail(`${before.width}×${before.height} 그대로다`);
    const check = roomCheck(input.after, mapId, 2);
    if (!check.ok) return fail(check.note);
    if (blockedInside(input.after, mapId) < blockedInside(input.before, mapId)) return fail('방 안 가구·구조물이 줄었다');
    return sameExcept(input.before, input.after, doc => {
      const map = doc.maps[mapId];
      delete map.width;
      delete map.height;
      blankTileLayers(mapId)(doc);
    }) ? pass(`${before.width}×${before.height} → ${after.width}×${after.height}, 걸을 수 있는 칸 ${after.open}개`) : fail('확장 밖 내용이 바뀌었다');
  },
  reference(project, args) {
    const width = numArg(args, 'width');
    const height = numArg(args, 'height');
    return buildRoom(project, strArg(args, 'mapId'), rectPlan(width, height, { at: Math.floor(width / 2), width: 1 }), { objects: FURNITURE }, true);
  },
  wrongs(project, args): FamilyOutcome[] {
    const mapId = strArg(args, 'mapId');
    const right = this.reference(project, args) as Project;
    const width = numArg(args, 'width');
    const height = numArg(args, 'height');
    return [
      runOn(project, 'set_map_properties', { mapId, name: '민가' }),
      runOn(right, 'fill_region', { mapId: 'map_plaza', x: 2, y: 2, w: 3, h: 2, layer: 'lower', material: '버들항 모랫길' }),
      buildRoom(project, mapId, rectPlan(width - 2, height - 2, { at: Math.floor((width - 2) / 2), width: 1 }), { objects: FURNITURE }, true),
      buildRoom(project, mapId, PLAN_WIDE_DOOR, { objects: FURNITURE }, true),
    ];
  },
};

const judgeLighting = (input: any, mapId: string, args: Record<string, unknown>) => {
  const want = typeof args.ambient === 'number' ? args.ambient : undefined;
  const color = typeof args.color === 'string' ? args.color : undefined;
  const touched = changedMaps(input.before, input.after, [mapId]);
  if (touched.length) return fail(`다른 맵 ${touched.join(',')} 가 바뀌었다`);
  const light = mapOf(input.after, mapId)?.defaultLighting;
  const ambient = light?.ambient;
  if (typeof ambient !== 'number') return fail(`${mapId} 에 기본 조명이 없다`);
  if (want !== undefined) {
    if (Math.abs(ambient - want) > 0.02) return fail(`${mapId} ambient ${ambient} (요청 ${want})`);
  } else if (!(ambient < 0.7)) return fail(`${mapId} ambient ${ambient} 는 밤이라 하기엔 밝다`);
  if (color !== undefined) {
    const normalize = (value: unknown) => String(value ?? '').replace('#', '').toLowerCase();
    if (normalize(light?.color) !== normalize(color)) return fail(`${mapId} 색 ${light?.color} (요청 ${color})`);
  }
  return sameExcept(input.before, input.after, doc => { delete doc.maps[mapId].defaultLighting; })
    ? pass(`${mapId} ambient ${ambient}, 색 ${light?.color ?? '(기본)'}`)
    : fail('조명 밖 내용(바닥·가구·이벤트)이 바뀌었다');
};

const interiorRoomLight: Family = {
  id: 'interior-room-light',
  area: 'interior',
  mode: 'write',
  title: '실내 밝기·광원만',
  variants: [
    { key: 'dim-plain', prompt: '이 방을 좀 어둡게 해줘. ambient 0.45.', args: { mapId: ROOM, ambient: 0.45, color: '#2a2438' }, setup: { select: { x: 0, y: 0, w: 16, h: 9 } } },
    { key: 'warm-polite', prompt: '방 안을 따뜻한 등불 빛으로 만들어 주세요. ambient 0.6, 색 #ffd9a0.', args: { mapId: ROOM, ambient: 0.6, color: '#ffd9a0' } },
    { key: 'candle-terse', prompt: '촛불 분위기로. 0.35, #ffb060.', args: { mapId: ROOM, ambient: 0.35, color: '#ffb060' }, setup: { select: { x: 0, y: 0, w: 16, h: 9 } } },
    { key: 'dark-explain', prompt: '창고라 어둡습니다. 이 방의 기본 조명만 ambient 0.25, 색 #1c2230 으로 낮추고, 다른 맵과 가구는 건드리지 마세요.', args: { mapId: ROOM, ambient: 0.25, color: '#1c2230' } },
    { key: 'night-casual', prompt: '이 방 밤처럼 어둡게 해줘.', args: { mapId: ROOM } },
  ],
  prepare: prepareRoom,
  judge(input, args) {
    // 「이 방」은 지금 화면에 보이는 맵을 가리킨다. 픽스처의 방은 다른 맵에 있으므로 둘 다 정답으로 본다(둘 중 하나만 바뀌어야 한다).
    const targets = [...new Set([strArg(args, 'mapId'), MAP])];
    const verdicts = targets.map(mapId => judgeLighting(input, mapId, args));
    return verdicts.find(verdict => verdict.ok) ?? verdicts[0]!;
  },
  reference(project, args) {
    const mapId = strArg(args, 'mapId');
    const ambient = typeof args.ambient === 'number' ? args.ambient : 0.4;
    const color = typeof args.color === 'string' ? args.color : '#2a2438';
    return runOn(project, 'set_lighting_volume', { mapId, ambient, color, applyMode: 'map' });
  },
  wrongs(project, args): FamilyOutcome[] {
    const mapId = strArg(args, 'mapId');
    const right = this.reference(project, args) as Project;
    void right;
    return [
      runOn(project, 'set_lighting_volume', { mapId: MAP, ambient: 0.3, color: '#1c2230', applyMode: 'map' }),
      runOn(right, 'set_scene_mood', { mapId, weather: { kind: 'rain' } }),
      runOn(project, 'set_lighting_volume', { mapId, ambient: 0.95, color: '#fff6e0', applyMode: 'map' }),
      runOn(project, 'set_lighting_volume', { mapId, ambient: (typeof args.ambient === 'number' ? args.ambient : 0.4) + 0.3, color: '#fff6e0', applyMode: 'map' }),
    ];
  },
};

export const GROUP_5_INTERIOR: readonly Family[] = [
  interiorRoomBuild, interiorRoomFurnish, interiorRoomDoorway, interiorRoomSize, interiorRoomLight,
];
