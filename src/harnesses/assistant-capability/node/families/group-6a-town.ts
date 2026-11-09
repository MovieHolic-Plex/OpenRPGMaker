import { isDeepStrictEqual } from 'node:util';
import type { Project } from '../../../../project/types';
import { clone, fail, mapOf, pass, runOn, sameExcept, type JudgeInput } from '../matrixNativeSpec';
import { attempt, distinct } from './group-4-shared';
import type { Family, FamilyOutcome } from './types';

const LOT = 'map_ds_lot';
const KIT = 'bd-house-h101_0';
const WORLD = 'map_world';

const addLot = (project: Project): Project =>
  runOn(clone(project), 'create_map', { name: '버들 빈터', id: LOT, width: 30, height: 24, tilesetId: 'beodeul_city' });

const withHouses = (project: Project): Project => {
  const lot = addLot(project);
  const first = runOn(lot, 'place_terrain_house', { mapId: LOT, anchor: { x: 10, y: 12 }, kitId: KIT });
  return runOn(first, 'place_terrain_house', { mapId: LOT, anchor: { x: 20, y: 12 }, kitId: KIT });
};

const treeWithout = (doc: any) => { doc.mapTree = null; };
const newMapIds = (before: Project, after: Project): string[] => Object.keys((after as any).maps).filter(id => !(before as any).maps[id]);
const dropMaps = (ids: string[]) => (doc: any) => { for (const id of ids) delete doc.maps[id]; treeWithout(doc); };

type BuildArgs = { name: string; width?: number; height?: number; houseCount?: number };
const townBuildNew: Family = {
  id: 'town-build-new',
  area: 'town',
  mode: 'write',
  title: '새 마을 맵을 이름·크기·집 수대로 짓기',
  variants: [
    { key: 'size-44x34', prompt: '「새벽 마을」이라는 버들항 마을을 새로 지어줘. 크기는 44×34로.', args: { name: '새벽 마을', width: 44, height: 34 } },
    { key: 'houses-4', prompt: '집이 네 채인 작은 마을을 새로 만들어 주세요. 이름은 「솔바람 마을」입니다.', args: { name: '솔바람 마을', houseCount: 4 } },
    { key: 'size-terse', prompt: '「갈대 마을」 새 마을 맵, 48×36.', args: { name: '갈대 마을', width: 48, height: 36 } },
    { key: 'houses-3-polite', prompt: '집 세 채짜리 아담한 마을을 하나 더 만들어 주세요. 이름은 「종달새 마을」로 해 주세요.', args: { name: '종달새 마을', houseCount: 3 } },
    { key: 'houses-5', prompt: '「큰바위 마을」이라는 새 마을을 지어 줘. 집은 다섯 채.', args: { name: '큰바위 마을', houseCount: 5 } },
  ],
  judge(input, args) {
    const want = args as unknown as BuildArgs;
    const added = newMapIds(input.before, input.after);
    if (added.length !== 1) return fail(`새 맵이 ${added.length}개다(하나여야 한다)`);
    const map = mapOf(input.after, added[0]);
    if (map.name !== want.name) return fail(`맵 이름이 「${map.name}」 — 「${want.name}」 여야 한다`);
    if (map.tilesetId !== 'beodeul_city') return fail(`타일셋이 ${map.tilesetId} — 버들항(beodeul_city)이어야 한다`);
    if (want.width !== undefined && (map.width !== want.width || map.height !== want.height)) return fail(`크기 ${map.width}×${map.height} — ${want.width}×${want.height} 여야 한다`);
    const houses = (map.structurePlacements ?? []).length;
    if (want.houseCount !== undefined) {
      const low = want.houseCount + 3, high = want.houseCount + 5;
      if (houses < low || houses > high) return fail(`배치된 건물이 ${houses}채 — 집 ${want.houseCount}채(+앵커·일터 건물)면 ${low}~${high}채여야 한다`);
    }
    if (houses < 3) return fail('마을에 건물이 거의 없다');
    return sameExcept(input.before, input.after, dropMaps(added)) ? pass(`${map.name} ${map.width}×${map.height}, 건물 ${houses}`) : fail('새 마을 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const want = args as unknown as BuildArgs;
    return runOn(clone(project), 'author_beodeul_town', { name: want.name, id: 'map_ds_town', ...(want.width ? { width: want.width, height: want.height } : {}), ...(want.houseCount ? { houseCount: want.houseCount } : {}) });
  },
  wrongs(project, args): FamilyOutcome[] {
    const want = args as unknown as BuildArgs;
    const reference = townBuildNew.reference!(clone(project), args) as Project;
    const run = (extra: Record<string, unknown>) => attempt(() => runOn(clone(project), 'author_beodeul_town', { name: want.name, id: 'map_ds_town', ...(want.width ? { width: want.width, height: want.height } : {}), ...(want.houseCount ? { houseCount: want.houseCount } : {}), ...extra }));
    return distinct(reference, [
      run({ name: `${want.name} 옆` }),
      want.width ? run({ width: want.width + 8, height: want.height! + 6 }) : attempt(() => { const side = clone(reference) as any; side.database.items[0].price = (side.database.items[0].price ?? 0) + 1; return side; }),
      attempt(() => runOn(clone(project), 'create_map', { name: want.name, id: 'map_ds_town', width: want.width ?? 40, height: want.height ?? 32 })),
    ]);
  },
};

type HouseArgs = { anchors: Array<{ x: number; y: number }> };
const townHouseAdd: Family = {
  id: 'town-house-add',
  area: 'town',
  mode: 'write',
  title: '기존 마을 맵의 지정한 자리에 집 짓기',
  variants: [
    { key: 'one-10-12', prompt: '버들 빈터 맵의 (10,12) 칸을 문 앞(아랫칸)으로 하는 집을 한 채 지어줘.', args: { anchors: [{ x: 10, y: 12 }] } },
    { key: 'one-20-12-polite', prompt: '버들 빈터에 집 한 채만 놓아 주세요. 문이 (20,12)에 오도록 해 주세요.', args: { anchors: [{ x: 20, y: 12 }] } },
    { key: 'two-row', prompt: '버들 빈터의 (8,18)과 (20,18)에 각각 문이 오도록 집 두 채를 지어 줘.', args: { anchors: [{ x: 8, y: 18 }, { x: 20, y: 18 }] } },
    { key: 'terse', prompt: '버들 빈터 (14,10)에 집 하나.', args: { anchors: [{ x: 14, y: 10 }] } },
    { key: 'south-explained', prompt: '버들 빈터 맵 남쪽 가까이, 문이 (12,20)에 오는 집을 지어 줘. 다른 곳은 건드리지 마.', args: { anchors: [{ x: 12, y: 20 }] } },
  ],
  prepare: addLot,
  judge(input, args) {
    const want = args as unknown as HouseArgs;
    const before = mapOf(input.before, LOT), after = mapOf(input.after, LOT);
    if (!after) return fail('버들 빈터 맵이 사라졌다');
    const was: any[] = before.structurePlacements ?? [], now: any[] = after.structurePlacements ?? [];
    const added = now.filter(entry => !was.some(old => old.id === entry.id));
    if (added.length !== want.anchors.length) return fail(`새 집이 ${added.length}채 — ${want.anchors.length}채여야 한다`);
    for (const anchor of want.anchors) {
      const hit = added.find(entry => entry.x <= anchor.x && anchor.x < entry.x + entry.w && entry.y + entry.h - 1 === anchor.y);
      if (!hit) return fail(`문 앞 칸 (${anchor.x},${anchor.y}) 에 맞는 집이 없다`);
    }
    const blank = (doc: any) => { const map = doc.maps[LOT]; doc.maps[LOT] = { id: map.id, name: map.name, width: map.width, height: map.height, tilesetId: map.tilesetId, events: map.events }; };
    return sameExcept(input.before, input.after, blank) ? pass(`집 ${added.length}채`) : fail('그 맵의 타일·집 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    return (args as unknown as HouseArgs).anchors.reduce((acc, anchor) => runOn(acc, 'place_terrain_house', { mapId: LOT, anchor, kitId: KIT }), clone(project));
  },
  wrongs(project, args): FamilyOutcome[] {
    const want = args as unknown as HouseArgs;
    const reference = townHouseAdd.reference!(clone(project), args) as Project;
    const build = (anchors: Array<{ x: number; y: number }>) => attempt(() => anchors.reduce((acc, anchor) => runOn(acc, 'place_terrain_house', { mapId: LOT, anchor, kitId: KIT }), clone(project)));
    const first = want.anchors[0]!;
    return distinct(reference, [
      build(want.anchors.map(anchor => ({ x: anchor.x, y: anchor.y === 20 ? 14 : anchor.y + 2 }))),
      build(want.anchors.map(anchor => ({ x: anchor.x + 3, y: anchor.y }))),
      build([...want.anchors, { x: first.x > 15 ? 6 : 24, y: 20 }]),
      build(want.anchors.slice(0, -1).length ? want.anchors.slice(0, -1) : [{ x: 26, y: 10 }]),
    ]);
  },
};

type RoadArgs = { points: Array<{ x: number; y: number }>; width: number };
const townRoadLink: Family = {
  id: 'town-road-link',
  area: 'town',
  mode: 'write',
  title: '두 지점을 폭 N 길로 잇기',
  variants: [
    { key: 'between-doors', prompt: '버들 빈터에서 첫 번째 집 문 앞 (10,13)과 두 번째 집 문 앞 (20,13)을 폭 2짜리 길로 이어줘. 길은 (10,18)과 (20,18)을 지나가게 해 줘.', args: { points: [{ x: 10, y: 13 }, { x: 10, y: 18 }, { x: 20, y: 18 }, { x: 20, y: 13 }], width: 2 } },
    { key: 'straight-wide', prompt: '두 집 문 앞 (10,13)에서 (20,13)까지 폭 3 길을 하나 깔아줘.', args: { points: [{ x: 10, y: 13 }, { x: 20, y: 13 }], width: 3 } },
    { key: 'south-loop-polite', prompt: '(10,13)에서 (10,19)로 내려갔다가 (20,19)를 지나 (20,13)에 닿는 폭 2 길을 만들어 주세요.', args: { points: [{ x: 10, y: 13 }, { x: 10, y: 19 }, { x: 20, y: 19 }, { x: 20, y: 13 }], width: 2 } },
    { key: 'terse-1', prompt: '(10,13) → (20,13) 길, 폭 1.', args: { points: [{ x: 10, y: 13 }, { x: 20, y: 13 }], width: 1 } },
    { key: 'down-to-edge', prompt: '첫째 집 문 앞 (10,13)에서 남쪽 끝 (10,22)까지 폭 2 길을 내 줘.', args: { points: [{ x: 10, y: 13 }, { x: 10, y: 22 }], width: 2 } },
  ],
  prepare: withHouses,
  judge(input, args) {
    const want = args as unknown as RoadArgs;
    const before = mapOf(input.before, LOT), after = mapOf(input.after, LOT);
    const was: any[] = before.terrainDesign?.features ?? [], now: any[] = after.terrainDesign?.features ?? [];
    const added = now.filter(entry => !was.some(old => old.id === entry.id));
    if (added.length !== 1) return fail(`새 길이 ${added.length}개 — 하나여야 한다`);
    const road = added[0];
    if (road.tool !== 'road') return fail(`새 지형 도형이 ${road.tool} — road 여야 한다`);
    const first = road.points[0], last = road.points[road.points.length - 1];
    const a = want.points[0]!, b = want.points[want.points.length - 1]!;
    if (first.x !== a.x || first.y !== a.y || last.x !== b.x || last.y !== b.y) return fail(`길 양끝이 (${first.x},${first.y})–(${last.x},${last.y}) — (${a.x},${a.y})–(${b.x},${b.y}) 여야 한다`);
    if (road.options?.width !== want.width) return fail(`길 폭 ${road.options?.width} — ${want.width} 여야 한다`);
    for (const point of want.points.slice(1, -1)) if (!road.points.some((entry: any) => entry.x === point.x && entry.y === point.y)) return fail(`길이 지나가야 할 (${point.x},${point.y}) 을 거치지 않는다`);
    const blank = (doc: any) => { const map = doc.maps[LOT]; doc.maps[LOT] = { id: map.id, name: map.name, width: map.width, height: map.height, tilesetId: map.tilesetId, events: map.events, structurePlacements: map.structurePlacements }; };
    return sameExcept(input.before, input.after, blank) ? pass(`길 폭 ${want.width}, 점 ${road.points.length}개`) : fail('길 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const want = args as unknown as RoadArgs;
    return runOn(clone(project), 'lay_terrain_road', { mapId: LOT, points: want.points, width: want.width });
  },
  wrongs(project, args): FamilyOutcome[] {
    const want = args as unknown as RoadArgs;
    const reference = townRoadLink.reference!(clone(project), args) as Project;
    const run = (extra: Record<string, unknown>) => attempt(() => runOn(clone(project), 'lay_terrain_road', { mapId: LOT, points: want.points, width: want.width, ...extra }));
    const shifted = want.points.map((point, index) => index === want.points.length - 1 ? { x: point.x, y: Math.max(1, point.y - 2) } : point);
    return distinct(reference, [
      run({ width: want.width === 4 ? 2 : want.width + 1 }),
      run({ points: shifted }),
      run({ points: want.points.slice(0, 1).concat([{ x: want.points[0]!.x + 4, y: want.points[0]!.y }]) }),
    ]);
  },
};

type WorldArgs = { edge: 'north' | 'south' | 'east' | 'west' };
const edgeRegion = (edge: WorldArgs['edge'], map: any, event: any): boolean => {
  if (edge === 'north') return event.y <= 3;
  if (edge === 'south') return event.y >= map.height - 4;
  if (edge === 'west') return event.x <= 3;
  return event.x >= map.width - 4;
};
const transfersTo = (event: any, mapId: string): boolean => (event.pages ?? []).some((page: any) => (page.commands ?? []).some((command: any) => command.kind === 'transfer' && command.mapId === mapId));
const gateB: Record<WorldArgs['edge'], { x: number; y: number }> = { north: { x: 12, y: 1 }, south: { x: 12, y: 16 }, west: { x: 1, y: 9 }, east: { x: 22, y: 9 } };

const townWorldConnect: Family = {
  id: 'town-world-connect',
  area: 'town',
  mode: 'write',
  title: '새 마을을 월드맵 가장자리에 양방향 연결',
  variants: [
    { key: 'north', prompt: '버들 빈터를 월드맵 북쪽에 연결해줘. 월드맵에서 들어가고 마을에서 돌아 나올 수 있게.', args: { edge: 'north' } },
    { key: 'south-polite', prompt: '월드맵 남쪽 가장자리에 버들 빈터로 가는 출입구를 만들어 주세요. 돌아오는 길도 있어야 해요.', args: { edge: 'south' } },
    { key: 'east', prompt: '버들 빈터 ↔ 월드맵, 월드맵 동쪽 끝에 양방향으로 이어 줘.', args: { edge: 'east' } },
    { key: 'west-terse', prompt: '월드맵 서쪽에 버들 빈터 입구. 왕복.', args: { edge: 'west' } },
    { key: 'north-explained', prompt: '월드맵 맨 위(북쪽) 가장자리에서 버들 빈터로 들어가는 문을 놓고, 마을 안쪽에서도 월드맵으로 나가는 문을 만들어 줘. 두 맵의 다른 곳은 그대로 둬.', args: { edge: 'north' } },
  ],
  prepare: addLot,
  judge(input, args) {
    const want = args as unknown as WorldArgs;
    const world = mapOf(input.after, WORLD), lot = mapOf(input.after, LOT);
    const known = (id: string, project: Project) => new Set((mapOf(project, id)?.events ?? []).map((event: any) => event.id));
    const newOn = (id: string): any[] => (mapOf(input.after, id).events ?? []).filter((event: any) => !known(id, input.before).has(event.id));
    const gates = newOn(WORLD).filter(event => transfersTo(event, LOT));
    if (!gates.length) return fail('월드맵에 버들 빈터로 가는 출입구가 없다');
    if (!gates.some(event => edgeRegion(want.edge, world, event))) return fail(`월드맵 출입구가 ${want.edge}쪽 가장자리가 아니다`);
    if (!newOn(LOT).some(event => transfersTo(event, WORLD))) return fail('버들 빈터에서 월드맵으로 돌아오는 출입구가 없다');
    for (const mapId of [WORLD, LOT]) {
      const changedOld = (mapOf(input.before, mapId).events ?? []).filter((event: any) => !isDeepStrictEqual(event, (mapOf(input.after, mapId).events ?? []).find((other: any) => other.id === event.id)));
      if (changedOld.length) return fail(`기존 이벤트 ${changedOld.map((event: any) => event.id).join(',')} 가 바뀌었다`);
    }
    const blank = (doc: any) => { for (const id of [WORLD, LOT]) { const keep = known(id, input.before); doc.maps[id].events = (doc.maps[id].events ?? []).filter((event: any) => keep.has(event.id)); } };
    const extra = sameExcept(input.before, input.after, (doc: any) => { blank(doc); for (const id of [WORLD, LOT]) { delete doc.maps[id].lowerTiles; delete doc.maps[id].upperTiles; delete doc.maps[id].lowerOverlayTiles; delete doc.maps[id].upperOverlayTiles; delete doc.maps[id].shadowBits; delete doc.maps[id].relief; delete doc.maps[id].terrainDesign; } });
    return extra ? pass(`월드맵 ${want.edge} 왕복 출입구`) : fail('두 맵의 출입구 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const want = args as unknown as WorldArgs;
    return runOn(clone(project), 'create_transfer_pair', { a: { mapId: LOT, x: 15, y: 22 }, b: { mapId: WORLD, ...gateB[want.edge] } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const want = args as unknown as WorldArgs;
    const reference = townWorldConnect.reference!(clone(project), args) as Project;
    const other: WorldArgs['edge'] = want.edge === 'north' ? 'south' : 'north';
    return distinct(reference, [
      attempt(() => runOn(clone(project), 'create_transfer_pair', { a: { mapId: LOT, x: 15, y: 22 }, b: { mapId: WORLD, ...gateB[other] } })),
      attempt(() => runOn(clone(project), 'create_transfer_pair', { a: { mapId: LOT, x: 15, y: 22 }, b: { mapId: 'map_field', ...gateB[want.edge] } })),
      attempt(() => {
        const out = runOn(clone(project), 'create_transfer_pair', { a: { mapId: LOT, x: 15, y: 22 }, b: { mapId: WORLD, ...gateB[want.edge] } });
        const lot = mapOf(out, LOT);
        lot.events = [];
        return out;
      }),
    ]);
  },
};

type ResizeArgs = { name?: string; width?: number; height?: number };
const townResizeName: Family = {
  id: 'town-resize-name',
  area: 'town',
  mode: 'write',
  title: '마을 맵의 크기와 이름 바꾸기',
  variants: [
    { key: 'grow', prompt: '버들 빈터 맵을 36×28로 넓혀줘.', args: { width: 36, height: 28 } },
    { key: 'rename', prompt: '버들 빈터의 이름을 「새벽 장터」로 바꿔 주세요. 크기는 그대로요.', args: { name: '새벽 장터' } },
    { key: 'shrink-and-name', prompt: '버들 빈터를 24×20으로 줄이고 이름을 「작은 나루」로 해 줘.', args: { name: '작은 나루', width: 24, height: 20 } },
    { key: 'grow-terse', prompt: '빈터 맵 40×30으로 확장.', args: { width: 40, height: 30 } },
    { key: 'name-and-grow-explained', prompt: '버들 빈터를 「동틀 녘 광장」이라고 부르고, 맵을 34×26으로 키워 줘. 다른 맵은 건드리지 마.', args: { name: '동틀 녘 광장', width: 34, height: 26 } },
  ],
  prepare: addLot,
  judge(input, args) {
    const want = args as unknown as ResizeArgs;
    const before = mapOf(input.before, LOT), after = mapOf(input.after, LOT);
    if (!after) return fail('버들 빈터 맵이 사라졌다');
    const w = want.width ?? before.width, h = want.height ?? before.height, name = want.name ?? before.name;
    if (after.width !== w || after.height !== h) return fail(`크기 ${after.width}×${after.height} — ${w}×${h} 여야 한다`);
    if (after.name !== name) return fail(`이름 「${after.name}」 — 「${name}」 여야 한다`);
    const blank = (doc: any) => { const map = doc.maps[LOT]; doc.maps[LOT] = { id: map.id, tilesetId: map.tilesetId, events: map.events }; };
    return sameExcept(input.before, input.after, blank) ? pass(`${after.name} ${after.width}×${after.height}`) : fail('그 맵의 크기·이름 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const want = args as unknown as ResizeArgs;
    let out = clone(project);
    if (want.width) out = runOn(out, 'resize_map', { mapId: LOT, width: want.width, height: want.height });
    if (want.name) out = runOn(out, 'set_map_properties', { mapId: LOT, name: want.name });
    return out;
  },
  wrongs(project, args): FamilyOutcome[] {
    const want = args as unknown as ResizeArgs;
    const reference = townResizeName.reference!(clone(project), args) as Project;
    const apply = (width: number | undefined, height: number | undefined, name: string | undefined, mapId = LOT) => attempt(() => {
      let out = clone(project);
      if (width) out = runOn(out, 'resize_map', { mapId, width, height });
      if (name) out = runOn(out, 'set_map_properties', { mapId, name });
      return out;
    });
    return distinct(reference, [
      want.width ? apply(want.width + 4, want.height! + 2, want.name) : apply(undefined, undefined, `${want.name} 2`),
      want.width ? apply(want.width, want.height, want.name, 'map_field') : apply(undefined, undefined, want.name, 'map_field'),
      want.name && want.width ? apply(want.width, want.height, undefined) : want.width ? apply(want.width, want.height, '의도치 않은 이름') : apply(30, 24, want.name),
    ]);
  },
};

export const TOWN_FAMILIES: readonly Family[] = [townBuildNew, townHouseAdd, townRoadLink, townWorldConnect, townResizeName];
export type { JudgeInput };
