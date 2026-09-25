import type { Project } from './types';
import { canMove } from './collision';
import { referenceOwner } from './tilesetReferences';

type Point = { x: number; y: number };
export type InteriorRoom = { id: string; seed: Point; doorways: Point[] };
type Part = { id: string; tiles: number[][]; supportCells: Point[]; placementKind: string; facing?: string };
type Material = { kind: string; mapped: number[][] };
type Dictionary = { materials: Record<string, Material>; objects: Part[]; ceiling: { variantMap: Record<string, number> } };
export type InteriorRequirement = { ids: string[]; min: number; max?: number; roomId?: string; side?: 'east' | 'west' };
export type InteriorRequirements = { objects?: InteriorRequirement[]; roomIds?: string[]; maxArea?: number; maxEmptySquare?: number; maxEmptyStrip?: { width: number; length: number }; southExit?: boolean };
export type InteriorFinding = { code: string; x: number; y: number; objectId?: string; expected?: number; actual?: number };

/** Read only. The installed part dictionary supplies semantics, never a target floor plan. */
export function inspectInteriorPlacement(project: Project, mapId: string, wallMaterial: string, entry: Point, rooms: InteriorRoom[] = [], requirements: InteriorRequirements = {}) {
  const map = project.maps[mapId], tile = map && project.tilesets[map.tilesetId];
  if (!map || !tile) throw new Error('맵/타일셋을 찾을 수 없습니다.');
  if (map.lowerTiles.length !== map.width * map.height || map.upperTiles.length !== map.width * map.height || ![...map.lowerTiles, ...map.upperTiles].every(n => Number.isInteger(n) && n >= -1 && n < tile.count)) throw new Error('맵 배열 크기/타일 번호 오류');
  if (map.width > 128 || map.height > 128) throw new Error('실내 검사는 128×128 이하 맵에 사용하세요.');
  if (!Number.isInteger(entry.x) || !Number.isInteger(entry.y) || entry.x < 0 || entry.y < 0 || entry.x >= map.width || entry.y >= map.height) throw new Error('맵 안의 출입 접근칸을 지정하세요.');
  if (map.lowerTileStacks || map.upperTileStacks) throw new Error('다중 타일 스택은 이 검사에서 지원하지 않습니다.');
  const owner = referenceOwner(project, tile);
  const markdown = owner.referenceDocuments?.find(c => c.id === 'direct-authoring')?.documents.find(d => d.id === 'dictionary')?.markdown;
  const json = markdown?.match(/```json\s*([\s\S]*?)\s*```/)?.[1];
  if (!json) throw new Error('direct-authoring/dictionary 참고문서가 필요합니다.');
  const dict = JSON.parse(json) as Dictionary;
  const matrix = (value: unknown): value is number[][] => Array.isArray(value) && value.length > 0 && value.length <= 32 && Array.isArray(value[0]) && value[0].length > 0 && value[0].length <= 32 && value.every(row => Array.isArray(row) && row.length === value[0].length && row.every(n => Number.isInteger(n) && n >= 0 && n < tile.count));
  if (!dict.materials || !dict.ceiling?.variantMap || !Array.isArray(dict.objects) || dict.objects.length > 256 || !Object.values(dict.materials).every(m => m && matrix(m.mapped)) || !Object.values(dict.ceiling.variantMap).every(n => Number.isInteger(n) && n >= 0 && n < tile.count) || !dict.objects.every(r => r && typeof r.id === 'string' && matrix(r.tiles) && ['standing', 'wall-mounted'].includes(r.placementKind) && Array.isArray(r.supportCells) && r.supportCells.every(c => Number.isInteger(c.x) && Number.isInteger(c.y) && c.x >= 0 && c.y >= 0 && c.y < r.tiles.length && c.x < r.tiles[0].length))) throw new Error('직접 배치 사전 형식/타일 범위 오류');
  const wall = dict.materials[wallMaterial];
  if (wall?.kind !== 'wall' || wall.mapped.some(row => row.length !== 1)) throw new Error('사전의 세로 벽 재료를 지정하세요.');
  const wallIds = wall.mapped.flat(), ceilings = new Set(Object.values(dict.ceiling.variantMap));
  if (!ceilings.size) throw new Error('천장 연결 그룹이 비어 있습니다.');
  const floors = new Set(Object.values(dict.materials).filter(m => m.kind === 'floor').flatMap(m => m.mapped.flat()));
  const at = (x: number, y: number) => y * map.width + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height;
  const findings: InteriorFinding[] = [], covered = new Set<number>();
  const objects: { id: string; x: number; y: number; width: number; height: number }[] = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const n = map.lowerTiles[at(x, y)];
    if (n < 0) findings.push({ code: 'UNPAINTED_LOWER', x, y });
    if (!ceilings.has(n) || (y + 1 < map.height && ceilings.has(map.lowerTiles[at(x, y + 1)]))) continue;
    wallIds.forEach((expected, row) => {
      const yy = y + row + 1;
      if (yy >= map.height) findings.push({ code: 'CEILING_WALL_OUT_OF_BOUNDS', x, y: yy });
      else if (map.lowerTiles[at(x, yy)] !== expected) findings.push({ code: 'CEILING_WALL_MISSING', x, y: yy, expected });
    });
  }
  for (const r of dict.objects) for (let y = 0; y <= map.height - r.tiles.length; y++) for (let x = 0; x <= map.width - r.tiles[0].length; x++) {
    if (!r.tiles.every((row, dy) => row.every((n, dx) => map.upperTiles[at(x + dx, y + dy)] === n))) continue;
    objects.push({ id: r.id, x, y, width: r.tiles[0].length, height: r.tiles.length });
    r.tiles.forEach((row, dy) => row.forEach((_n, dx) => {
      covered.add(at(x + dx, y + dy));
      if (r.placementKind === 'wall-mounted' && !wallIds.includes(map.lowerTiles[at(x + dx, y + dy)])) findings.push({ code: 'WALL_MOUNT_SUPPORT', x: x + dx, y: y + dy, objectId: r.id });
    }));
    if (r.placementKind === 'standing') for (const c of r.supportCells) if (!floors.has(map.lowerTiles[at(x + c.x, y + c.y)])) findings.push({ code: 'FURNITURE_FOOT', x: x + c.x, y: y + c.y, objectId: r.id });
  }
  // Ceiling autotiles draw one-cell wall tops. A 2×2 ceiling block is a dark dead mass, usually
  // filler hiding unused floor; shrink or reshape the map instead.
  for (let y = 0; y + 1 < map.height; y++) for (let x = 0; x + 1 < map.width; x++)
    if ([at(x, y), at(x + 1, y), at(x, y + 1), at(x + 1, y + 1)].every(i => ceilings.has(map.lowerTiles[i]))) findings.push({ code: 'CEILING_MASS', x, y });
  map.upperTiles.forEach((n, i) => { if (n >= 0 && !covered.has(i)) findings.push({ code: 'INCOMPLETE_OBJECT', x: i % map.width, y: Math.floor(i / map.width) }); });
  const queue: Point[] = [], seen = new Set<number>();
  if (!floors.has(map.lowerTiles[at(entry.x, entry.y)]) || map.upperTiles[at(entry.x, entry.y)] >= 0) findings.push({ code: 'ENTRY_BLOCKED', ...entry });
  else { queue.push(entry); seen.add(at(entry.x, entry.y)); }
  for (let k = 0; k < queue.length; k++) for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const c = queue[k], x = c.x + dx, y = c.y + dy;
    if (!inside(x, y) || seen.has(at(x, y)) || !canMove(project, map, c.x, c.y, x, y)) continue;
    seen.add(at(x, y)); queue.push({ x, y });
  }
  map.lowerTiles.forEach((n, i) => { if (floors.has(n) && map.upperTiles[i] < 0 && !seen.has(i)) findings.push({ code: 'ISOLATED_FLOOR', x: i % map.width, y: Math.floor(i / map.width) }); });
  const reachable = (x: number, y: number) => inside(x, y) && seen.has(at(x, y));
  for (const o of objects) {
    const part = dict.objects.find(p => p.id === o.id);
    if (o.id.includes('chair')) {
      const back = part?.facing === 'north' ? { x: o.x, y: o.y + o.height } : part?.facing === 'south' ? { x: o.x, y: o.y - 1 } : part?.facing === 'east' ? { x: o.x - 1, y: o.y + o.height - 1 } : part?.facing === 'west' ? { x: o.x + o.width, y: o.y + o.height - 1 } : undefined;
      if (back && !reachable(back.x, back.y)) findings.push({ code: 'CHAIR_BACK_BLOCKED', ...back, objectId: o.id });
    }
    if (/wardrobe|drawers|bookcase|fridge|kitchen|stove|tea$|tub|wash-station|lockers|shoe-rack|milk-machine|double-sink|toilet|washer|linen|medicine|tv$|cage|chest/.test(o.id) && !Array.from({ length: o.width }, (_, dx) => reachable(o.x + dx, o.y + o.height)).some(Boolean)) findings.push({ code: 'OBJECT_FRONT_BLOCKED', x: o.x, y: o.y + o.height, objectId: o.id });
    if (o.id === 'izakaya-counter' || o.id === 'clinic-reception') for (const y of [o.y - 1, o.y + o.height]) if (!Array.from({ length: o.width }, (_, dx) => reachable(o.x + dx, y)).some(Boolean)) findings.push({ code: 'COUNTER_ACCESS', x: o.x, y, objectId: o.id });
  }
  const counts: Record<string, number> = {};
  for (const o of objects) counts[o.id] = (counts[o.id] ?? 0) + 1;
  // Closing declared doorways must isolate each room from the entrance and all other rooms.
  // Use floor geometry, ignoring furniture so a cabinet cannot masquerade as a privacy wall.
  const point = (p: Point) => p && Number.isInteger(p.x) && Number.isInteger(p.y) && inside(p.x, p.y);
  if (!Array.isArray(rooms) || rooms.length > 16 || rooms.some(r => !r || typeof r.id !== 'string' || !r.id || !point(r.seed) || !Array.isArray(r.doorways) || r.doorways.length < 1 || r.doorways.length > 16 || !r.doorways.every(point)) || new Set(rooms.map(r => r.id)).size !== rooms.length) throw new Error('방 검사는 고유 id, 바닥 seed, 실제 문턱 doorways 좌표가 필요합니다(최대16방).');
  const doors = new Set(rooms.flatMap(r => r.doorways.map(p => at(p.x, p.y))));
  const regions = new Map<number, number>(), areas: number[] = [];
  for (let i = 0; i < map.lowerTiles.length; i++) {
    if (regions.has(i) || doors.has(i) || !floors.has(map.lowerTiles[i])) continue;
    const region = areas.length, pending = [i]; regions.set(i, region);
    for (let j = 0; j < pending.length; j++) for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const n = pending[j], x = n % map.width + dx, y = Math.floor(n / map.width) + dy, k = at(x, y);
      if (!inside(x, y) || regions.has(k) || doors.has(k) || !floors.has(map.lowerTiles[k])) continue;
      regions.set(k, region); pending.push(k);
    }
    areas.push(pending.length);
  }
  const hall = regions.get(at(entry.x, entry.y));
  const roomReports = rooms.map(r => ({ id: r.id, seed: r.seed, region: regions.get(at(r.seed.x, r.seed.y)), floorCells: areas[regions.get(at(r.seed.x, r.seed.y)) ?? -1] ?? 0 }));
  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i], region = roomReports[i].region;
    if (region === undefined) findings.push({ code: 'ROOM_SEED_NOT_FLOOR', ...room.seed, objectId: room.id });
    else if (region === hall || roomReports.some((r, j) => j !== i && r.region === region)) findings.push({ code: 'ROOM_NOT_ENCLOSED', ...room.seed, objectId: room.id });
    const remaining = new Set(room.doorways.map(p => at(p.x, p.y)));
    while (remaining.size) {
      const start = remaining.values().next().value!; remaining.delete(start);
      const cluster = [start], adjacent = new Set<number>();
      for (let j = 0; j < cluster.length; j++) {
        const n = cluster[j], x = n % map.width, y = Math.floor(n / map.width);
        if (!floors.has(map.lowerTiles[n]) || !seen.has(n)) findings.push({ code: 'ROOM_DOOR_BLOCKED', x, y, objectId: room.id });
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          if (!inside(x + dx, y + dy)) continue;
          const k = at(x + dx, y + dy), next = regions.get(k);
          if (next !== undefined) adjacent.add(next);
          if (remaining.delete(k)) cluster.push(k);
        }
      }
      if (cluster.length > 2) findings.push({ code: 'ROOM_DOOR_TOO_WIDE', x: start % map.width, y: Math.floor(start / map.width), objectId: room.id });
      // A doorway covering the room's whole side leaves no jamb: the room reads as an open alcove.
      if (region !== undefined) {
        const xs = cluster.map(n => n % map.width), ys = cluster.map(n => Math.floor(n / map.width));
        const vertical = new Set(xs).size === 1, lo = Math.min(...(vertical ? ys : xs)), hi = Math.max(...(vertical ? ys : xs));
        for (const side of [-1, 1]) {
          const line = vertical ? xs[0] + side : ys[0] + side;
          const span: number[] = [];
          for (let k = 0; k < (vertical ? map.height : map.width); k++) { const cx = vertical ? line : k, cy = vertical ? k : line; if (inside(cx, cy) && regions.get(at(cx, cy)) === region) span.push(k); }
          if (span.length && Math.min(...span) >= lo && Math.max(...span) <= hi) findings.push({ code: 'ROOM_SIDE_FULLY_OPEN', x: start % map.width, y: Math.floor(start / map.width), objectId: room.id });
        }
      }
      if (region === undefined || hall === undefined || !adjacent.has(region) || !adjacent.has(hall)) findings.push({ code: 'ROOM_NO_DIRECT_HALL_ACCESS', x: start % map.width, y: Math.floor(start / map.width), objectId: room.id });
    }
  }
  // A caller-supplied request contract is checked against detected whole objects, not labels alone.
  const known = new Set(dict.objects.map(o => o.id));
  if (!requirements || typeof requirements !== 'object' ||
      (requirements.objects !== undefined && (!Array.isArray(requirements.objects) || requirements.objects.length > 128 || requirements.objects.some(r => !r || !Array.isArray(r.ids) || !r.ids.length || r.ids.some(id => !known.has(id)) || !Number.isInteger(r.min) || r.min < 0 || (r.max !== undefined && (!Number.isInteger(r.max) || r.max < r.min)) || (r.roomId !== undefined && typeof r.roomId !== 'string') || (r.side !== undefined && !['east', 'west'].includes(r.side))))) ||
      (requirements.roomIds !== undefined && (!Array.isArray(requirements.roomIds) || requirements.roomIds.length > 16 || requirements.roomIds.some(id => typeof id !== 'string' || !id))) ||
      [requirements.maxArea, requirements.maxEmptySquare].some(n => n !== undefined && (!Number.isInteger(n) || n < 1)) ||
      (requirements.maxEmptyStrip !== undefined && (!requirements.maxEmptyStrip || typeof requirements.maxEmptyStrip !== 'object' || !Number.isInteger(requirements.maxEmptyStrip.width) || !Number.isInteger(requirements.maxEmptyStrip.length) || requirements.maxEmptyStrip.width < 1 || requirements.maxEmptyStrip.length < requirements.maxEmptyStrip.width))) throw new Error('요구조건의 가구 ID/수량/방/면적 형식을 확인하세요.');
  for (const id of requirements.roomIds ?? []) if (!rooms.some(r => r.id === id)) findings.push({ code: 'REQUIRED_ROOM_MISSING', ...entry, objectId: id });
  for (const req of requirements.objects ?? []) {
    const room = req.roomId === undefined ? undefined : roomReports.find(r => r.id === req.roomId);
    const matches = objects.filter(o => req.ids.includes(o.id) &&
      (!req.side || (req.side === 'east' ? o.x >= map.width / 2 : o.x + o.width <= map.width / 2)) &&
      (req.roomId === undefined || (room?.region !== undefined && dict.objects.find(p => p.id === o.id)!.supportCells.every(c => regions.get(at(o.x + c.x, o.y + c.y)) === room.region))));
    if (matches.length < req.min || (req.max !== undefined && matches.length > req.max)) findings.push({ code: 'REQUIRED_OBJECT_COUNT', ...entry, objectId: req.ids.join('|') + (req.roomId ? '@' + req.roomId : '') + (req.side ? ':' + req.side : ''), expected: matches.length < req.min ? req.min : req.max, actual: matches.length });
  }
  if (requirements.maxArea !== undefined && map.width * map.height > requirements.maxArea) findings.push({ code: 'EXCESS_MAP_AREA', ...entry, expected: requirements.maxArea, actual: map.width * map.height });
  // Largest unobstructed square is a measurable review hint, never an aesthetic score.
  const square = new Uint16Array(map.width * map.height); let largest = { x: 0, y: 0, size: 0 };
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const i = at(x, y); if (!floors.has(map.lowerTiles[i]) || map.upperTiles[i] >= 0) continue;
    square[i] = 1 + (x && y ? Math.min(square[i - 1], square[i - map.width], square[i - map.width - 1]) : 0);
    if (square[i] > largest.size) largest = { x: x - square[i] + 1, y: y - square[i] + 1, size: square[i] };
  }
  if (requirements.maxEmptySquare !== undefined && largest.size > requirements.maxEmptySquare) findings.push({ code: 'EXCESS_EMPTY_SQUARE', x: largest.x, y: largest.y, expected: requirements.maxEmptySquare, actual: largest.size });
  // A square cap misses long wide corridors (4×9 passes maxEmptySquare:4). Find the longest empty
  // rectangle whose short side reaches the strip width; its long side is the wasted run length.
  let strip: { x: number; y: number; width: number; height: number } | undefined;
  if (requirements.maxEmptyStrip) {
    const minSide = requirements.maxEmptyStrip.width, up = new Uint16Array(map.width);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) { const i = at(x, y); up[x] = floors.has(map.lowerTiles[i]) && map.upperTiles[i] < 0 ? up[x] + 1 : 0; }
      for (let x0 = 0; x0 < map.width; x0++) {
        let h = up[x0];
        for (let x1 = x0; x1 < map.width && h > 0; x1++) {
          h = Math.min(h, up[x1]); const w = x1 - x0 + 1;
          if (Math.min(w, h) >= minSide && (!strip || Math.max(w, h) > Math.max(strip.width, strip.height))) strip = { x: x0, y: y - h + 1, width: w, height: h };
        }
      }
    }
    if (strip && Math.max(strip.width, strip.height) > requirements.maxEmptyStrip.length) findings.push({ code: 'EXCESS_EMPTY_STRIP', x: strip.x, y: strip.y, expected: requirements.maxEmptyStrip.length, actual: Math.max(strip.width, strip.height), objectId: `${strip.width}x${strip.height}` });
  }
  if (requirements.southExit && !Array.from({ length: map.width }, (_, x) => reachable(x, map.height - 1)).some(Boolean)) findings.push({ code: 'SOUTH_EXIT_MISSING', x: entry.x, y: map.height - 1 });
  return { valid: findings.length === 0, totalIssues: findings.length, issues: findings.slice(0, 80), omittedIssues: Math.max(0, findings.length - 80), largestEmptySquare: largest, widestEmptyStrip: strip, checkedRequirements: requirements, objectCounts: counts, objects: objects.slice(0, 200), rooms: roomReports, reachableFloorCells: seen.size, boundaryExits: { south: Array.from({ length: map.width }, (_, x) => x).filter(x => reachable(x, map.height - 1)) }, limitations: '배열/사전 기반 구조 검사. 독립방은 rooms에 선언한 방만 검사한다. 요구조건은 requirements에 선언한 것만 검사한다. 미적 품질·게임 이벤트는 별도 확인. 혼합 벽 재료/다중 타일 스택은 지원하지 않는다. 수정하지 않는다.' };
}
