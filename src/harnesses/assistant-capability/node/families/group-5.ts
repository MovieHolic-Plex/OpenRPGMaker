import { isDeepStrictEqual } from 'node:util';
import { isPassable } from '../../../../project/collision';
import type { Project } from '../../../../project/types';
import {
  MAP, changedCells, eventOf, fail, inside, mapOf, pass, reachableMaps, readOnly, runOn, sameExcept, withoutEvent, type Rect,
} from '../matrixNativeSpec';
import { numArg, rectArg, strArg, type Family, type FamilyOutcome } from './types';
import { closeColor, dropMoodEvents, judgeDarkness, mapField, systemField, tintColor, weatherOf } from './group-5-support';
import { GROUP_5_INTERIOR } from './group-5-interior';

const MEADOW: Rect = { x: 14, y: 2, w: 5, h: 4 };
const TINT_EVENT = 'ev_night_cutscene';
const SE_EVENT = 'ev_se_bell';
const PROP_MATERIAL = '버들항 · 나무·덤불';

const blankMapFields = (mapId: string, ...fields: string[]) => {
  const blank = mapField(mapId, ...fields);
  return (doc: any) => { blank(doc); dropMoodEvents(doc, mapId); };
};

const changedOtherMaps = (before: Project, after: Project, mapId: string): string[] =>
  Object.keys((before as any).maps).filter(id => id !== mapId && !isDeepStrictEqual((before as any).maps[id], (after as any).maps[id]));

const eventIdsOf = (project: Project, mapId = MAP): string[] => (mapOf(project, mapId).events ?? []).map((event: any) => event.id);

const passableOf = (project: Project, mapId: string): boolean[][] => {
  const map = mapOf(project, mapId);
  return Array.from({ length: map.height }, (_, y) => Array.from({ length: map.width }, (_, x) => isPassable(project, map, x, y)));
};

const blankTilesAndEvents = (doc: any) => {
  const map = doc.maps[MAP];
  if (!map) return;
  for (const key of ['lowerTiles', 'upperTiles', 'lowerOverlayTiles', 'upperOverlayTiles', 'shadowBits', 'lowerTileStacks', 'upperTileStacks', 'doodadGroups', 'terrainDesign', 'relief']) delete map[key];
  map.events = [];
};

const holesAdded = (before: Project, after: Project): number => {
  const left = mapOf(before), right = mapOf(after);
  let holes = 0;
  for (let y = 0; y < right.height; y++) for (let x = 0; x < right.width; x++) {
    const was = left.lowerTiles?.[y * left.width + x] ?? -1;
    const now = right.lowerTiles?.[y * right.width + x] ?? -1;
    if (was >= 0 && now < 0) holes += 1;
  }
  return holes;
};

const mediaFixtures = (project: Project): Project => {
  let next = runOn(project, 'upsert_event', {
    mapId: MAP,
    event: {
      id: TINT_EVENT,
      x: 4,
      y: 6,
      name: '밤 연출',
      trigger: { kind: 'action' },
      pages: [{
        id: `${TINT_EVENT}_page`,
        name: '밤 연출',
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: 'action' },
        priority: 'below',
        overlapForbidden: false,
        movement: { type: 'fixed', speed: 3, frequency: 3 },
        commands: [
          { kind: 'text', body: '해가 진다.' },
          { kind: 'm2Command', commandId: 'm2-046-tint-screen', fields: { value: '60,70,120,0.35', durationMs: 600 } },
          { kind: 'text', body: '거리가 조용해졌다.' },
        ],
      }],
    },
  });
  next = runOn(next, 'upsert_event', {
    mapId: MAP,
    event: {
      id: SE_EVENT,
      x: 8,
      y: 6,
      name: '저녁 종',
      trigger: { kind: 'action' },
      pages: [{
        id: `${SE_EVENT}_page`,
        name: '저녁 종',
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: 'action' },
        priority: 'below',
        overlapForbidden: false,
        movement: { type: 'fixed', speed: 3, frequency: 3 },
        commands: [
          { kind: 'text', body: '종이 울린다.' },
          { kind: 'playAudio', resourceId: 'cc0-se-osx-bell-01', loop: false, volume: 1 },
        ],
      }],
    },
  });
  return next;
};

const nightMood: Family = {
  id: 'night-mood',
  area: 'media',
  mode: 'write',
  title: '맵을 밤 분위기로(조명만)',
  variants: [
    { key: 'village-plain', prompt: '이 지역을 밤 분위기로 바꿔줘.', args: { mapId: MAP }, setup: { select: { x: 0, y: 0, w: 24, h: 18 } } },
    { key: 'plaza-polite', prompt: '광장을 밤으로 만들어 주세요. 조명과 색만 바꾸고 타일은 그대로 두세요.', args: { mapId: 'map_plaza', ambient: 0.3, color: '#1b2440' } },
    { key: 'field-terse', prompt: '숲길 밤으로. ambient 0.2.', args: { mapId: 'map_field', ambient: 0.2 }, setup: { select: { x: 0, y: 0, w: 24, h: 18 } } },
    { key: 'world-explain', prompt: '월드맵 전체를 해 질 녘에서 밤으로 넘겨 주세요. ambient 0.35, 색은 #0e1430, 다른 맵은 건드리지 마세요.', args: { mapId: 'map_world', ambient: 0.35, color: '#0e1430' } },
    { key: 'house-casual', prompt: '집 안을 어둡고 푸르스름하게 만들어줘.', args: { mapId: 'map_interior' }, setup: { select: { x: 0, y: 0, w: 24, h: 18 } } },
  ],
  judge(input, args) {
    const mapId = strArg(args, 'mapId');
    const want = typeof args.ambient === 'number' ? args.ambient : undefined;
    const color = typeof args.color === 'string' ? args.color : undefined;
    const others = changedOtherMaps(input.before, input.after, mapId);
    if (others.length) return fail(`${mapId} 밖의 맵 ${others.join(',')} 이 바뀌었다`);
    if (!sameExcept(input.before, input.after, blankMapFields(mapId, 'defaultLighting', 'weather', 'climate'))) return fail(`${mapId} 의 조명·날씨 밖 내용이 바뀌었다`);
    return judgeDarkness(input.before, input.after, mapId, want, color);
  },
  reference(project, args) {
    const mapId = strArg(args, 'mapId');
    const ambient = typeof args.ambient === 'number' ? args.ambient : 0.28;
    const color = typeof args.color === 'string' ? args.color : '#131a30';
    return runOn(project, 'set_lighting_volume', { mapId, ambient, color, applyMode: 'map' });
  },
  wrongs(project, args): FamilyOutcome[] {
    const mapId = strArg(args, 'mapId');
    const ambient = typeof args.ambient === 'number' ? args.ambient : 0.28;
    const color = typeof args.color === 'string' ? args.color : '#131a30';
    const other = mapId === 'map_plaza' ? MAP : 'map_plaza';
    const night = runOn(project, 'set_lighting_volume', { mapId, ambient, color, applyMode: 'map' });
    return [
      runOn(project, 'set_lighting_volume', { mapId: other, ambient, color, applyMode: 'map' }),
      runOn(project, 'set_lighting_volume', { mapId, ambient: 0.92, color: '#fff3d0', applyMode: 'map' }),
      runOn(project, 'set_lighting_volume', { mapId, ambient, color: '#ffffff', applyMode: 'map' }),
      runOn(night, 'fill_region', { mapId, x: 2, y: 15, w: 3, h: 1, layer: 'lower', material: '버들항 모랫길' }),
    ];
  },
};

const mediaBgmMap: Family = {
  id: 'media-bgm-map',
  area: 'media',
  mode: 'write',
  title: '맵 BGM만 교체',
  variants: [
    { key: 'village-amber', prompt: '이 맵 BGM을 새벽의 의뢰서로 바꿔줘.', args: { mapId: MAP, track: 'cc0-bgm-rtp-ttl-001' }, setup: { select: { x: 0, y: 0, w: 24, h: 18 } } },
    { key: 'plaza-amber', prompt: '광장 배경 음악을 호박빛 초원의 끝으로 바꿔 주세요.', args: { mapId: 'map_plaza', track: 'cc0-bgm-rtp-fld-003' } },
    { key: 'field-vanguard', prompt: '숲길 BGM → 선봉의 신호.', args: { mapId: 'map_field', track: 'cc0-bgm-rtp-btl-001' } },
    { key: 'world-amber', prompt: '월드맵에서 흐르는 곡만 호박빛 초원의 끝으로 바꾸고, 다른 맵 음악은 그대로 두세요.', args: { mapId: 'map_world', track: 'cc0-bgm-rtp-fld-003' } },
    { key: 'interior-ledger', prompt: '집 안 음악을 새벽의 의뢰서로 바꿔줘.', args: { mapId: 'map_interior', track: 'cc0-bgm-rtp-ttl-001' } },
  ],
  judge(input, args) {
    const mapId = strArg(args, 'mapId');
    const track = strArg(args, 'track');
    const map = mapOf(input.after, mapId);
    if (!map) return fail(`${mapId} 맵이 사라졌다`);
    if (map.bgm?.resourceId !== track) return fail(`${mapId} BGM 이 ${map.bgm?.resourceId ?? '(없음)'} 이다`);
    for (const id of Object.keys((input.before as any).maps)) {
      if (id === mapId) continue;
      if (!isDeepStrictEqual((input.before as any).maps[id]?.bgm, (input.after as any).maps[id]?.bgm)) return fail(`${id} BGM 까지 바뀌었다`);
    }
    if ((input.before as any).system?.defaultBgmResourceId !== (input.after as any).system?.defaultBgmResourceId) return fail('시스템 기본 BGM 까지 바뀌었다');
    if ((input.before as any).system?.battleBgmResourceId !== (input.after as any).system?.battleBgmResourceId) return fail('전투 BGM 까지 바뀌었다');
    return sameExcept(input.before, input.after, mapField(mapId, 'bgm')) ? pass(`${mapId} BGM = ${track}`) : fail('BGM 밖 내용이 바뀌었다');
  },
  reference(project, args) {
    return runOn(project, 'set_map_properties', { mapId: strArg(args, 'mapId'), bgm: { mode: 'custom', resourceId: strArg(args, 'track') } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const mapId = strArg(args, 'mapId');
    const track = strArg(args, 'track');
    const other = mapId === 'map_plaza' ? MAP : 'map_plaza';
    const done = runOn(project, 'set_map_properties', { mapId, bgm: { mode: 'custom', resourceId: track } });
    const swapped = track === 'cc0-bgm-rtp-btl-001' ? 'cc0-bgm-rtp-fld-003' : 'cc0-bgm-rtp-btl-001';
    return [
      runOn(project, 'set_map_properties', { mapId: other, bgm: { mode: 'custom', resourceId: track } }),
      runOn(project, 'set_project_settings', { resources: { defaultBgmResourceId: track } }),
      runOn(done, 'set_map_properties', { mapId, encounterRate: 7 }),
      runOn(project, 'set_map_properties', { mapId, bgm: { mode: 'custom', resourceId: swapped } }),
    ];
  },
};

const mediaWeather: Family = {
  id: 'media-weather-rain',
  area: 'media',
  mode: 'write',
  title: '맵 날씨만 비로',
  variants: [
    { key: 'village-rain', prompt: '이 맵에 비를 내려줘.', args: { mapId: MAP }, setup: { select: { x: 0, y: 0, w: 24, h: 18 } } },
    { key: 'plaza-polite', prompt: '광장에 비가 내리게 해 주세요. 날씨만 바꾸면 됩니다.', args: { mapId: 'map_plaza' } },
    { key: 'field-terse', prompt: '숲길, 비.', args: { mapId: 'map_field' } },
    { key: 'world-heavy', prompt: '월드맵 날씨를 세찬 비로 바꾸고 조명·타일은 그대로 두세요.', args: { mapId: 'map_world', intensity: 0.9 } },
    { key: 'interior-rain', prompt: '집 안에 창밖에서 비가 들리는 분위기를 날씨로 넣어줘.', args: { mapId: 'map_interior' } },
  ],
  judge(input, args) {
    const mapId = strArg(args, 'mapId');
    const weather = weatherOf(input.after, mapId);
    if (weather !== 'rain') return fail(`${mapId} 날씨가 ${weather ?? '(없음)'} 이다`);
    for (const id of Object.keys((input.before as any).maps)) {
      if (id === mapId) continue;
      if (weatherOf(input.before, id) !== weatherOf(input.after, id)) return fail(`${id} 날씨까지 바뀌었다`);
    }
    return sameExcept(input.before, input.after, blankMapFields(mapId, 'weather')) ? pass(`${mapId} 날씨 rain`) : fail('날씨 밖 내용(조명·타일 등)이 바뀌었다');
  },
  reference(project, args) {
    const mapId = strArg(args, 'mapId');
    const intensity = typeof args.intensity === 'number' ? args.intensity : 0.6;
    return runOn(project, 'set_scene_mood', { mapId, weather: { kind: 'rain', intensity } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const mapId = strArg(args, 'mapId');
    const other = mapId === 'map_plaza' ? MAP : 'map_plaza';
    const rain = runOn(project, 'set_scene_mood', { mapId, weather: { kind: 'rain', intensity: 0.6 } });
    return [
      runOn(project, 'set_scene_mood', { mapId: other, weather: { kind: 'rain', intensity: 0.6 } }),
      runOn(project, 'set_scene_mood', { mapId, weather: { kind: 'snow', intensity: 0.6 } }),
      runOn(rain, 'set_lighting_volume', { mapId, ambient: 0.4, color: '#20242e', applyMode: 'map' }),
      runOn(project, 'set_scene_mood', { mapId, weather: { kind: 'fog', intensity: 0.6 } }),
    ];
  },
};

const tintCommandOf = (command: any): boolean => command?.kind === 'm2Command' && /tint/iu.test(String(command.commandId ?? ''));

const applyTint = (project: Project, args: Record<string, unknown>): Project => {
  const eventId = strArg(args, 'eventId');
  const hex = strArg(args, 'color').replace('#', '');
  const alpha = numArg(args, 'alpha');
  const value = `${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)},${alpha}`;
  const event = eventOf(project, eventId);
  const pages = (event.pages ?? []).map((page: any, pageIndex: number) => ({
    ...page,
    commands: (page.commands ?? []).map((command: any) => (tintCommandOf(command) ? { ...command, fields: { ...(command.fields ?? {}), value, durationMs: 600 } } : command)),
    pageIndex,
  }));
  let next = project;
  pages.forEach((page: any) => {
    next = runOn(next, 'patch_event_page', { mapId: MAP, eventId, pageIndex: page.pageIndex, set: { commands: page.commands } });
  });
  return next;
};

const mediaScreenTint: Family = {
  id: 'media-screen-tint',
  area: 'media',
  mode: 'write',
  title: '연출 이벤트의 화면 색조만',
  variants: [
    { key: 'night-blue', prompt: '밤 장면 색조를 짙은 남색으로 바꿔줘.', args: { eventId: TINT_EVENT, color: '#141c3c', alpha: 0.5 }, setup: { event: TINT_EVENT } },
    { key: 'dusk-polite', prompt: '이 연출의 화면 색조를 주황빛 노을(#ff8c3c)로 바꿔 주세요. 다른 명령은 그대로 두세요.', args: { eventId: TINT_EVENT, color: '#ff8c3c', alpha: 0.25 } },
    { key: 'dark-terse', prompt: '색조 30,40,80,0.45 로.', args: { eventId: TINT_EVENT, color: '#1e2850', alpha: 0.45 }, setup: { event: TINT_EVENT } },
    { key: 'red-explain', prompt: '위기 장면이라 화면을 붉게 물들여 주세요. 색 #a01018, 농도 0.35 로 하고 나머지 연출 명령은 손대지 마세요.', args: { eventId: TINT_EVENT, color: '#a01018', alpha: 0.35 } },
    { key: 'pale-casual', prompt: '색조 좀 옅게, #2a3050 0.2 정도로 해줘.', args: { eventId: TINT_EVENT, color: '#2a3050', alpha: 0.2 }, setup: { event: TINT_EVENT } },
  ],
  prepare: mediaFixtures,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const color = strArg(args, 'color');
    const alpha = numArg(args, 'alpha');
    const hex = /^#?([0-9a-f]{6})$/i.exec(color);
    if (!hex) return fail(`${color} 는 색이 아니다`);
    const want = { r: parseInt(hex[1]!.slice(0, 2), 16), g: parseInt(hex[1]!.slice(2, 4), 16), b: parseInt(hex[1]!.slice(4, 6), 16), a: alpha };
    const before = eventOf(input.before, eventId), after = eventOf(input.after, eventId);
    if (!before || !after) return fail(`${eventId} 이벤트가 없다`);
    const removed = eventIdsOf(input.before).filter(id => !eventIdsOf(input.after).includes(id));
    if (removed.length) return fail(`다른 이벤트 ${removed.join(',')} 가 사라졌다`);
    const pageCommands = (event: any) => (event.pages ?? []).flatMap((page: any) => page.commands ?? []);
    const tints = pageCommands(after).filter(tintCommandOf);
    if (tints.length !== 1) return fail(`색조 명령이 ${tints.length}개다`);
    const rgb = tintColor(tints[0].fields);
    if (!rgb) return fail('색조 명령에 색 값이 없다');
    if (!closeColor(rgb, want)) return fail(`색조 ${rgb.rgb.join(',')}${rgb.alpha !== undefined ? ` / ${rgb.alpha}` : ''} (요청 ${color} / ${alpha})`);
    const plain = (event: any) => pageCommands(event).filter((command: any) => !tintCommandOf(command));
    const keep = plain(before);
    let at = 0;
    for (const command of plain(after)) if (at < keep.length && isDeepStrictEqual(command, keep[at])) at++;
    if (at !== keep.length) return fail('색조 밖 명령이 바뀌거나 사라졌다');
    return sameExcept(input.before, input.after, withoutEvent(eventId)) ? pass(`${eventId} 색조 ${color} / ${alpha}`) : fail(`${eventId} 밖의 내용이 바뀌었다`);
  },
  reference(project, args) {
    return applyTint(project, args);
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const right = applyTint(project, args);
    const other = eventId === TINT_EVENT ? 'ev_test_cutscene' : TINT_EVENT;
    const elsewhere = runOn(project, 'patch_event_page', {
      mapId: MAP, eventId: other, pageIndex: 0,
      set: { commands: [...(eventOf(project, other).pages[0].commands as any[]), { kind: 'm2Command', commandId: 'm2-046-tint-screen', fields: { value: '255,60,40,0.5' } }] },
    });
    const commands = eventOf(right, eventId).pages[0].commands as any[];
    const droppedLine = runOn(right, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: commands.filter((command: any) => command.kind !== 'text') } });
    return [
      elsewhere,
      applyTint(project, { ...args, color: '#c01020' }),
      droppedLine,
      applyTint(project, { ...args, alpha: 0.05 }),
    ];
  },
};

const mediaBattleBgm: Family = {
  id: 'media-battle-bgm',
  area: 'media',
  mode: 'write',
  title: '시스템 전투 BGM만 교체',
  variants: [
    { key: 'amber-plain', prompt: '전투 BGM을 호박빛 초원의 끝으로 바꿔줘.', args: { track: 'cc0-bgm-rtp-fld-003' } },
    { key: 'ledger-polite', prompt: '전투 음악을 새벽의 의뢰서로 바꿔 주세요. 다른 음악은 그대로 두세요.', args: { track: 'cc0-bgm-rtp-ttl-001' } },
    // 픽스처의 현재 전투 BGM 은 「선봉의 신호」(cc0-bgm-rtp-btl-001)다 — 그 곡을 요청하면 아무것도 바꾸지 않은 답도 통과한다.
    { key: 'battle-terse', prompt: '전투 BGM → 재의 왕관.', args: { track: 'cc0-bgm-rtp-btl-002' } },
    { key: 'boss-explain', prompt: '보스전 분위기에 맞게 시스템 전투 BGM 만 「새벽의 의뢰서」로 바꾸고, 맵 음악과 기본 BGM 은 유지해 주세요.', args: { track: 'cc0-bgm-rtp-ttl-001' } },
    { key: 'amber-casual', prompt: '전투 들어갈 때 나오는 음악, 호박빛 초원의 끝으로 해줘.', args: { track: 'cc0-bgm-rtp-fld-003' } },
  ],
  judge(input, args) {
    const track = strArg(args, 'track');
    const before = (input.before as any).system ?? {}, after = (input.after as any).system ?? {};
    if (after.battleBgmResourceId !== track) return fail(`전투 BGM 이 ${after.battleBgmResourceId ?? '(없음)'} 이다`);
    for (const id of Object.keys((input.before as any).maps)) {
      if (!isDeepStrictEqual((input.before as any).maps[id]?.bgm, (input.after as any).maps[id]?.bgm)) return fail(`${id} 맵 BGM 까지 바뀌었다`);
    }
    if (before.defaultBgmResourceId !== after.defaultBgmResourceId) return fail('시스템 기본 BGM 까지 바뀌었다');
    return sameExcept(input.before, input.after, systemField('battleBgmResourceId')) ? pass(`전투 BGM = ${track}`) : fail('전투 BGM 밖 내용이 바뀌었다');
  },
  reference(project, args) {
    return runOn(project, 'set_project_settings', { resources: { battleBgmResourceId: strArg(args, 'track') } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const track = strArg(args, 'track');
    const done = runOn(project, 'set_project_settings', { resources: { battleBgmResourceId: track } });
    const swapped = track === 'cc0-bgm-rtp-btl-001' ? 'cc0-bgm-rtp-fld-003' : 'cc0-bgm-rtp-btl-001';
    return [
      runOn(project, 'set_project_settings', { resources: { defaultBgmResourceId: track } }),
      runOn(project, 'set_map_properties', { mapId: MAP, bgm: { mode: 'custom', resourceId: track } }),
      runOn(done, 'set_project_settings', { title: '전투 음악 시험' }),
      runOn(project, 'set_project_settings', { resources: { battleBgmResourceId: swapped } }),
    ];
  },
};

const setSeVolume = (project: Project, args: Record<string, unknown>): Project => {
  const eventId = strArg(args, 'eventId');
  const volume = numArg(args, 'volume');
  const event = eventOf(project, eventId);
  const pages = (event.pages ?? []).map((page: any, pageIndex: number) => ({
    pageIndex,
    commands: (page.commands ?? []).map((command: any) => (command.kind === 'playAudio' ? { ...command, volume } : command)),
  }));
  let next = project;
  for (const page of pages) next = runOn(next, 'patch_event_page', { mapId: MAP, eventId, pageIndex: page.pageIndex, set: { commands: page.commands } });
  return next;
};

const mediaSeVolume: Family = {
  id: 'media-se-volume',
  area: 'media',
  mode: 'write',
  title: '효과음 명령의 음량만',
  variants: [
    { key: 'bell-quiet', prompt: '이 이벤트의 종소리 효과음을 조금 작게 해줘. 음량 0.4.', args: { eventId: SE_EVENT, volume: 0.4 }, setup: { event: SE_EVENT } },
    { key: 'bell-polite', prompt: '종소리 효과음 음량을 0.25로 낮춰 주세요. 다른 명령은 그대로 두세요.', args: { eventId: SE_EVENT, volume: 0.25 } },
    { key: 'bell-terse', prompt: '종소리 0.15.', args: { eventId: SE_EVENT, volume: 0.15 }, setup: { event: SE_EVENT } },
    { key: 'bell-explain', prompt: '밤 장면이라 종소리가 너무 크게 들립니다. 그 효과음 명령의 음량만 0.6으로 줄이고 대사는 유지해 주세요.', args: { eventId: SE_EVENT, volume: 0.6 } },
    { key: 'bell-casual', prompt: '종소리 좀 키워줘, 0.8 정도로.', args: { eventId: SE_EVENT, volume: 0.8 }, setup: { event: SE_EVENT } },
  ],
  prepare: mediaFixtures,
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    const volume = numArg(args, 'volume');
    const before = eventOf(input.before, eventId), after = eventOf(input.after, eventId);
    if (!before || !after) return fail(`${eventId} 이벤트가 없다`);
    const audio = (event: any) => (event.pages ?? []).flatMap((page: any) => page.commands ?? []).filter((command: any) => command.kind === 'playAudio');
    const was = audio(before), now = audio(after);
    if (!was.length) return fail(`${eventId} 에 효과음 명령이 없다`);
    if (now.length !== was.length) return fail(`효과음 명령이 ${was.length} → ${now.length} 개가 됐다`);
    const changedAudio = now.filter((command: any, index: number) => !isDeepStrictEqual(command, was[index]));
    if (changedAudio.length !== 1) return fail(`바뀐 효과음 명령이 ${changedAudio.length}개다`);
    const target = changedAudio[0] as any;
    if (target.resourceId !== (was[0] as any).resourceId) return fail('효과음 종류(리소스)가 바뀌었다');
    if (typeof target.volume !== 'number' || Math.abs(target.volume - volume) > 0.02) return fail(`음량 ${target.volume ?? '(없음)'} (요청 ${volume})`);
    const plain = (event: any) => (event.pages ?? []).flatMap((page: any) => page.commands ?? []).filter((command: any) => command.kind !== 'playAudio');
    if (!isDeepStrictEqual(plain(after), plain(before))) return fail('효과음 밖 명령이 바뀌었다');
    return sameExcept(input.before, input.after, withoutEvent(eventId)) ? pass(`${eventId} 효과음 음량 ${volume}`) : fail(`${eventId} 밖의 내용이 바뀌었다`);
  },
  reference(project, args) {
    return setSeVolume(project, args);
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const volume = numArg(args, 'volume');
    const right = setSeVolume(project, args);
    const other = eventId === SE_EVENT ? 'ev_test_cutscene' : SE_EVENT;
    const elsewhere = runOn(project, 'patch_event_page', {
      mapId: MAP, eventId: other, pageIndex: 0,
      set: { commands: [...(eventOf(project, other).pages[0].commands as any[]), { kind: 'playAudio', resourceId: 'cc0-se-osx-bell-02', loop: false, volume }] },
    });
    const commands = eventOf(right, eventId).pages[0].commands as any[];
    return [
      elsewhere,
      setSeVolume(project, { ...args, volume: volume > 0.5 ? 0.1 : 1 }),
      runOn(right, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: commands.filter((command: any) => command.kind !== 'text') } }),
      runOn(project, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: commands.map((command: any) => (command.kind === 'playAudio' ? { ...command, resourceId: 'cc0-se-osx-gong-01' } : command)) } }),
    ];
  },
};

const ambiguousMakeItNicer: Family = {
  id: 'ambiguous-make-it-nicer',
  area: 'plan',
  mode: 'write',
  title: '선택 영역을 조금 더 낫게',
  variants: [
    { key: 'meadow-plain', prompt: '선택한 영역 좀 더 낫게 만들어줘.', args: { rect: MEADOW }, setup: { select: MEADOW } },
    { key: 'meadow-polite', prompt: '선택 영역을 조금 더 보기 좋게 다듬어 주세요. 맵 전체를 다시 그리지는 마세요.', args: { rect: { x: 13, y: 3, w: 4, h: 3 } }, setup: { select: { x: 13, y: 3, w: 4, h: 3 } } },
    { key: 'meadow-terse', prompt: '여기 좀 꾸며줘.', args: { rect: { x: 15, y: 2, w: 4, h: 4 } }, setup: { select: { x: 15, y: 2, w: 4, h: 4 } } },
    { key: 'meadow-explain', prompt: '선택한 풀밭이 너무 밋밋합니다. 이 영역 안에서만 작은 개선을 해 주시고, 이벤트나 다른 칸은 건드리지 마세요.', args: { rect: { x: 14, y: 4, w: 5, h: 3 } }, setup: { select: { x: 14, y: 4, w: 5, h: 3 } } },
    { key: 'meadow-casual', prompt: '이 구역 심심한데 조금만 손봐줘. 통행은 그대로.', args: { rect: { x: 12, y: 2, w: 4, h: 4 } }, setup: { select: { x: 12, y: 2, w: 4, h: 4 } } },
  ],
  judge(input, args) {
    const rect = rectArg(args);
    const label = `선택 영역 ${rect.w}×${rect.h}`;
    const cells = changedCells(input.before, input.after);
    if (!cells.length) return fail(`${label}: 바뀐 칸이 없다`);
    const outside = cells.filter(cell => !inside(rect, cell.x, cell.y));
    if (outside.length) return fail(`${label}: 영역 밖 ${outside.length}칸이 바뀌었다 (예: ${outside[0]!.x},${outside[0]!.y})`);
    const lost = eventIdsOf(input.before).filter(id => !eventIdsOf(input.after).includes(id));
    if (lost.length) return fail(`${label}: 이벤트 ${lost.join(',')} 가 사라졌다`);
    const damaged = eventIdsOf(input.before).filter(id => !isDeepStrictEqual(eventOf(input.before, id), eventOf(input.after, id)));
    if (damaged.length) return fail(`${label}: 이벤트 ${damaged.join(',')} 내용이 바뀌었다`);
    const holes = holesAdded(input.before, input.after);
    if (holes) return fail(`${label}: 바닥이 비어 구멍이 된 칸 ${holes}개`);
    const was = passableOf(input.before, MAP), now = passableOf(input.after, MAP);
    let outsideChanged = 0, keptInside = 0, stillInside = 0;
    was.forEach((row, y) => row.forEach((open, x) => {
      if (!inside(rect, x, y)) { if (open !== now[y]?.[x]) outsideChanged += 1; return; }
      if (!open) return;
      keptInside += 1;
      if (now[y]?.[x]) stillInside += 1;
    }));
    if (outsideChanged) return fail(`${label}: 영역 밖 통행이 ${outsideChanged}칸 바뀌었다`);
    if (keptInside && stillInside < Math.ceil(keptInside * 0.6)) return fail(`${label}: 걸을 수 있던 칸이 ${keptInside} → ${stillInside} 로 줄어 통행이 막혔다`);
    if (!sameExcept(input.before, input.after, blankTilesAndEvents)) return fail(`${label}: 영역 밖 내용(맵 속성·다른 이벤트)이 바뀌었다`);
    return pass(`${label} 안 ${cells.length}칸 개선, 이벤트·통행 보존`);
  },
  reference(project, args) {
    const rect = rectArg(args);
    const withPath = runOn(project, 'fill_region', { mapId: MAP, x: rect.x, y: rect.y + 1, w: rect.w, h: 1, layer: 'lower', material: '버들항 모랫길' });
    return runOn(withPath, 'place_props', { mapId: MAP, area: rect, material: PROP_MATERIAL, count: 2, seed: 3 });
  },
  wrongs(project, args): FamilyOutcome[] {
    const rect = rectArg(args);
    const map = mapOf(project);
    const cells = Array.from({ length: rect.w * rect.h }, (_, index) => ({ x: rect.x + (index % rect.w), y: rect.y + Math.floor(index / rect.w) }));
    return [
      runOn(project, 'fill_region', { mapId: MAP, x: 0, y: 0, w: map.width, h: map.height, layer: 'lower', material: '버들항 모랫길' }),
      runOn(project, 'paint_tiles', { mapId: MAP, layer: 'lower', mode: 'cells', tile: -1, cells }),
      runOn(project, 'remove_event', { mapId: MAP, eventId: 'ev_utility_npc' }),
      runOn(project, 'place_props', { mapId: MAP, area: rect, material: PROP_MATERIAL, count: Math.max(12, rect.w * rect.h), seed: 2 }),
    ];
  },
};

const ambiguousAddSomething: Family = {
  id: 'ambiguous-add-something',
  area: 'plan',
  mode: 'write',
  title: '선택 영역에 뭔가 하나 추가',
  variants: [
    { key: 'meadow-plain', prompt: '여기에 뭔가 놓아줘.', args: { rect: MEADOW }, setup: { select: MEADOW } },
    { key: 'meadow-polite', prompt: '선택 영역에 어울리는 기물 하나를 놓아 주세요. 기존 것은 지우지 마세요.', args: { rect: { x: 14, y: 3, w: 4, h: 3 } }, setup: { select: { x: 14, y: 3, w: 4, h: 3 } } },
    { key: 'meadow-terse', prompt: '여기 하나 추가.', args: { rect: { x: 16, y: 2, w: 4, h: 3 } }, setup: { select: { x: 16, y: 2, w: 4, h: 3 } } },
    { key: 'meadow-explain', prompt: '선택한 풀밭이 허전합니다. 그 영역 안에 그럴듯한 기물이나 이벤트를 하나만 더해 주시고, 기존 내용은 그대로 두세요.', args: { rect: { x: 13, y: 2, w: 5, h: 4 } }, setup: { select: { x: 13, y: 2, w: 5, h: 4 } } },
    { key: 'meadow-casual', prompt: '이 칸들에 소품 하나 놔줘.', args: { rect: { x: 15, y: 3, w: 3, h: 3 } }, setup: { select: { x: 15, y: 3, w: 3, h: 3 } } },
  ],
  judge(input, args) {
    const rect = rectArg(args);
    const label = `선택 영역 ${rect.w}×${rect.h}`;
    const known = new Set(eventIdsOf(input.before));
    const added = (mapOf(input.after).events ?? []).filter((event: any) => !known.has(event.id));
    const removed = eventIdsOf(input.before).filter(id => !eventIdsOf(input.after).includes(id));
    if (removed.length) return fail(`${label}: 기존 이벤트 ${removed.join(',')} 가 사라졌다`);
    const damaged = eventIdsOf(input.before).filter(id => !isDeepStrictEqual(eventOf(input.before, id), eventOf(input.after, id)));
    if (damaged.length) return fail(`${label}: 기존 이벤트 ${damaged.join(',')} 가 바뀌었다`);
    if (added.length > 1) return fail(`${label}: 새 이벤트가 ${added.length}개다`);
    const cells = changedCells(input.before, input.after);
    const outside = cells.filter(cell => !inside(rect, cell.x, cell.y));
    if (outside.length) return fail(`${label}: 영역 밖 ${outside.length}칸이 바뀌었다`);
    if (!added.length && !cells.length) return fail(`${label}: 아무것도 추가되지 않았다`);
    if (added.length === 1 && !inside(rect, added[0].x, added[0].y)) return fail(`${label}: 새 이벤트가 (${added[0].x},${added[0].y}) 로 영역 밖이다`);
    const holes = holesAdded(input.before, input.after);
    if (holes) return fail(`${label}: 바닥 구멍 ${holes}칸`);
    if (!sameExcept(input.before, input.after, blankTilesAndEvents)) return fail(`${label}: 영역 밖 내용(맵 속성)이 바뀌었다`);
    return pass(`${label}: ${added.length ? `이벤트 ${added[0].id} 추가` : `타일 ${cells.length}칸 추가`}, 기존 내용 보존`);
  },
  reference(project, args) {
    return runOn(project, 'place_props', { mapId: MAP, area: rectArg(args), material: PROP_MATERIAL, count: 1, seed: 5 });
  },
  wrongs(project, args): FamilyOutcome[] {
    const rect = rectArg(args);
    return [
      runOn(project, 'place_props', { mapId: MAP, area: { x: 2, y: 16, w: 2, h: 1 }, material: PROP_MATERIAL, count: 1, seed: 5 }),
      runOn(project, 'remove_event', { mapId: MAP, eventId: 'ev_test_shop' }),
      runOn(project, 'fill_region', { mapId: MAP, x: 0, y: 0, w: mapOf(project).width, h: mapOf(project).height, layer: 'lower', material: '버들항 모랫길' }),
      runOn(project, 'set_map_properties', { mapId: MAP, encounterRate: 9 }),
    ];
  },
};

const matchAny = (answer: string, ...values: Array<string | undefined>): boolean =>
  values.some(value => !!value && value.trim() !== '' && answer.includes(value));

const readMapList: Family = {
  id: 'read-map-list',
  area: 'read',
  mode: 'read',
  title: '모든 맵 목록',
  variants: [
    { key: 'all-plain', prompt: '이 프로젝트의 맵을 전부 알려줘.', args: {} },
    { key: 'all-polite', prompt: '프로젝트에 있는 모든 맵의 id 와 이름을 알려 주세요.', args: {} },
    { key: 'all-terse', prompt: '맵 목록.', args: {} },
    { key: 'all-explain', prompt: '맵이 몇 개 있는지, 각 맵의 id 와 이름을 빠짐없이 정리해 주세요.', args: {} },
    { key: 'all-casual', prompt: '어떤 맵들이 있는지 다 보여줘.', args: {} },
  ],
  readTools: ['get_project_summary'],
  judge(input, args) {
    void args;
    return readOnly(input, 'read-map-list', () => {
      const maps = Object.values<any>((input.before as any).maps);
      const missing = maps.filter((map: any) => !matchAny(input.answer, map.id, map.name));
      return missing.length ? fail(`맵 ${missing.map((map: any) => map.id).join(',')} 를 나열하지 않았다`) : pass(`맵 ${maps.length}개 나열`);
    });
  },
  reference(project) {
    return Object.values<any>((project as any).maps).map((map: any) => `- ${map.id} — ${map.name} (${map.width}×${map.height})`).join('\n');
  },
  wrongs(project): FamilyOutcome[] {
    const maps = Object.values<any>((project as any).maps);
    return [
      `- ${maps[0].id} — ${maps[0].name}`,
      maps.filter((map: any) => map.id !== 'map_world').map((map: any) => `- ${map.id} — ${map.name}`).join('\n'),
      '맵은 하나뿐입니다.',
    ];
  },
};

const readEventPages: Family = {
  id: 'read-event-pages',
  area: 'read',
  mode: 'read',
  title: '선택 이벤트의 페이지와 조건',
  variants: [
    { key: 'child-plain', prompt: '이 이벤트 페이지가 몇 개고 각 페이지 조건이 뭐야?', args: { eventId: 'ev_ember_child' }, setup: { event: 'ev_ember_child' } },
    { key: 'guard-polite', prompt: '이 이벤트의 페이지 수와 페이지마다 걸린 조건을 알려 주세요.', args: { eventId: 'ev_ember_guard' }, setup: { event: 'ev_ember_guard' } },
    { key: 'child-terse', prompt: '페이지 수, 조건.', args: { eventId: 'ev_ember_child' }, setup: { event: 'ev_ember_child' } },
    { key: 'guard-explain', prompt: '이 NPC 이벤트가 몇 개의 페이지로 되어 있고, 어떤 스위치 조건으로 페이지가 갈리는지 정리해 주세요.', args: { eventId: 'ev_ember_guard' }, setup: { event: 'ev_ember_guard' } },
    { key: 'child-casual', prompt: '얘 페이지 몇 개야? 조건도 알려줘.', args: { eventId: 'ev_ember_child' }, setup: { event: 'ev_ember_child' } },
  ],
  readTools: ['get_event', 'find_events'],
  judge(input, args) {
    const eventId = strArg(args, 'eventId');
    return readOnly(input, eventId, () => {
      const event = eventOf(input.before, eventId);
      if (!event) return fail(`${eventId} 이벤트가 없다`);
      const pages = event.pages ?? [];
      const digits = new RegExp(`(^|[^0-9])${pages.length}([^0-9]|$)`, 'u');
      const words: Record<number, string> = { 1: '한', 2: '두', 3: '세', 4: '네', 5: '다섯' };
      const stated = digits.test(input.answer) || (words[pages.length] ? input.answer.includes(`${words[pages.length]} 개`) || input.answer.includes(`${words[pages.length]}개`) : false);
      if (!stated) return fail(`페이지 ${pages.length}개를 말하지 않았다`);
      const switches = pages.flatMap((page: any) => page.conditions ?? []).filter((condition: any) => condition.kind === 'switch').map((condition: any) => condition.switchId as string);
      if (!switches.length) return pass(`페이지 ${pages.length}개, 조건 없음`);
      return switches.every(id => input.answer.includes(id)) ? pass(`페이지 ${pages.length}개, 스위치 조건 ${switches.join(',')}`) : fail(`스위치 조건 ${switches.join(',')} 을 말하지 않았다`);
    });
  },
  reference(project, args) {
    const event = eventOf(project as Project, strArg(args, 'eventId'));
    const pages = event.pages ?? [];
    const lines = pages.map((page: any, index: number) => {
      const conditions = (page.conditions ?? []).map((condition: any) => `${condition.kind}:${condition.switchId ?? condition.variableId ?? ''}`);
      return `- ${index + 1}페이지: 조건 ${conditions.length ? conditions.join(', ') : '없음'}`;
    });
    return `${event.id} — 페이지 ${pages.length}개\n${lines.join('\n')}`;
  },
  wrongs(project, args): FamilyOutcome[] {
    const eventId = strArg(args, 'eventId');
    const pages = (eventOf(project as Project, eventId).pages ?? []).length;
    return [
      `${eventId} — 페이지 1개, 조건 없음`,
      `${eventId} — 페이지 ${pages}개, 조건 없음`,
      `${eventId} — 페이지 ${pages + 1}개, 조건 switch:sw_ember_q1_clear`,
    ];
  },
};

/** 아이템 행을 상점 진열에서 찾는다 — 「뭐뭐 팔고」의 진실은 재고다. */
const soldItems = (project: Project): any[] => {
  const items: any[] = (project as any).database?.items ?? [];
  const events = Object.values<any>((project as any).maps ?? {}).flatMap((map: any) => map.events ?? []);
  const shops = events.flatMap((event: any) => (event.pages ?? []).flatMap((page: any) => page.commands ?? []).concat(event.commands ?? []))
    .filter((command: any) => command?.kind === 'shop');
  const ids = new Set<string>(shops.flatMap((shop: any) => [...(shop.itemIds ?? []), ...(shop.stock ?? []).map((entry: any) => entry.itemId)]));
  return [...ids].map(id => items.find((item: any) => item.id === id)).filter(Boolean);
};

const linesWithNumbers = (answer: string, entries: Array<{ keys: string[]; value: number }>): { hit: number; wrong: string[] } => {  const lines = answer.split('\n');
  let hit = 0;
  const wrong: string[] = [];
  for (const entry of entries) {
    const line = lines.find(text => entry.keys.some(key => key && text.includes(key)));
    if (!line) continue;
    const numbers = (line.match(/\d+/g) ?? []).map(Number);
    if (numbers.includes(entry.value)) hit += 1;
    else wrong.push(`${entry.keys[0]}=${numbers.join('/') || '숫자 없음'}(정답 ${entry.value})`);
  }
  return { hit, wrong };
};

const readDbItems: Family = {
  id: 'read-db-items',
  area: 'read',
  mode: 'read',
  title: '아이템 id 와 가격',
  variants: [
    { key: 'items-plain', prompt: '아이템 목록이랑 가격 알려줘.', args: {} },
    { key: 'items-polite', prompt: '데이터베이스의 아이템 id 와 가격을 정리해 주세요.', args: {} },
    { key: 'items-terse', prompt: '아이템 가격표.', args: {} },
    { key: 'items-explain', prompt: '상점 가격을 조정하려고 합니다. 아이템마다 id 와 현재 가격을 표로 보여 주세요.', args: {} },
    { key: 'items-casual', prompt: '뭐뭐 팔고 각각 얼마인지 보여줘.', args: { allowShop: true } },
  ],
  readTools: ['get_database_records'],
  judge(input, args) {
    return readOnly(input, 'read-db-items', () => {
      const items: any[] = (input.before as any).database?.items ?? [];
      if (!items.length) return fail('아이템이 없다');
      // 「뭐뭐 팔고」는 상점 재고를 묻는 말이다 — 판매 품목을 가격과 함께 답한 것도 정답이다.
      if (args.allowShop === true) {
        const sold = soldItems(input.before);
        if (sold.length) {
          const check = linesWithNumbers(input.answer, sold.map((item: any) => ({ keys: [item.id, item.name].filter(Boolean).map(String), value: Number(item.price ?? 0) })));
          if (check.hit === sold.length && check.wrong.length === 0) return pass(`판매 품목 ${sold.length}개 가격 보고`);
        }
      }
      const entries = items.map((item: any) => ({ keys: [item.id, item.name].filter(Boolean).map(String), value: Number(item.price ?? 0) }));
      const { hit, wrong } = linesWithNumbers(input.answer, entries);
      const need = Math.min(5, items.length);
      if (hit < need) return fail(`가격이 맞는 아이템 ${hit}/${need}개${wrong.length ? ` (${wrong.slice(0, 3).join(', ')})` : ''}`);
      if (wrong.length > Math.max(1, Math.floor(hit * 0.2))) return fail(`가격이 틀린 항목 ${wrong.length}개 (${wrong.slice(0, 3).join(', ')})`);
      return pass(`아이템 ${hit}개 가격 보고`);
    });
  },
  reference(project) {
    const items: any[] = (project as any).database?.items ?? [];
    return items.map(item => `- ${item.id} — ${item.name}: ${item.price ?? 0} G`).join('\n');
  },
  wrongs(project): FamilyOutcome[] {
    const items: any[] = (project as any).database?.items ?? [];
    return [
      items.slice(0, 2).map(item => `- ${item.id} — ${item.name}: ${item.price ?? 0} G`).join('\n'),
      items.map(item => `- ${item.id} — ${item.name}: ${(item.price ?? 0) + 15} G`).join('\n'),
      '가격 정보는 데이터베이스에서 확인할 수 없습니다.',
    ];
  },
};

const readTroopList: Family = {
  id: 'read-troop-list',
  area: 'read',
  mode: 'read',
  title: 'troop 목록과 구성 수',
  variants: [
    { key: 'troops-plain', prompt: 'troop 목록이랑 각 troop 구성 수 알려줘.', args: {} },
    { key: 'troops-polite', prompt: '전투 troop 의 id 와 구성 적 수를 알려 주세요.', args: {} },
    { key: 'troops-terse', prompt: 'troop 별 적 수.', args: {} },
    { key: 'troops-explain', prompt: '전투 난이도를 보려고 합니다. troop 마다 id, 이름, 구성 적 수를 정리해 주세요.', args: {} },
    { key: 'troops-casual', prompt: '전투 조합 뭐뭐 있고 각각 몇 마리야?', args: {} },
  ],
  readTools: ['get_database_records'],
  judge(input, args) {
    void args;
    return readOnly(input, 'read-troop-list', () => {
      const troops: any[] = (input.before as any).database?.troops ?? [];
      if (!troops.length) return fail('troop 이 없다');
      const entries = troops.map((troop: any) => ({ keys: [troop.id, troop.name].filter(Boolean).map(String), value: (troop.members ?? []).length }));
      const { hit, wrong } = linesWithNumbers(input.answer, entries);
      const need = Math.min(6, troops.length);
      if (hit < need) return fail(`구성 수가 맞는 troop ${hit}/${need}개${wrong.length ? ` (${wrong.slice(0, 3).join(', ')})` : ''}`);
      if (wrong.length > Math.max(1, Math.floor(hit * 0.2))) return fail(`구성 수가 틀린 troop ${wrong.length}개 (${wrong.slice(0, 3).join(', ')})`);
      return pass(`troop ${hit}개 구성 수 보고`);
    });
  },
  reference(project) {
    const troops: any[] = (project as any).database?.troops ?? [];
    return troops.map(troop => `- ${troop.id} — ${troop.name}: ${(troop.members ?? []).length}마리`).join('\n');
  },
  wrongs(project): FamilyOutcome[] {
    const troops: any[] = (project as any).database?.troops ?? [];
    return [
      troops.slice(0, 2).map(troop => `- ${troop.id} — ${troop.name}: ${(troop.members ?? []).length}마리`).join('\n'),
      troops.map(troop => `- ${troop.id} — ${troop.name}: 1마리`).join('\n'),
      'troop 목록은 아직 없습니다.',
    ];
  },
};

const switchUsers = (project: Project, switchId: string): any[] =>
  (mapOf(project).events ?? []).filter((event: any) => JSON.stringify(event).includes(switchId));

const readSwitchUsage: Family = {
  id: 'read-switch-usage',
  area: 'read',
  mode: 'read',
  title: '스위치를 쓰는 이벤트',
  variants: [
    { key: 'clear-plain', prompt: 'sw_ember_q1_clear 스위치를 쓰는 이벤트 다 알려줘.', args: { switchId: 'sw_ember_q1_clear' } },
    { key: 'clear-polite', prompt: '퀘스트 클리어 스위치를 참조하는 이벤트를 모두 찾아 주세요.', args: { switchId: 'sw_ember_q1_clear' } },
    { key: 'clear-terse', prompt: 'sw_ember_q1_clear 쓰는 데?', args: { switchId: 'sw_ember_q1_clear' } },
    { key: 'clear-explain', prompt: '페이지 조건을 정리하려고 합니다. 클리어 스위치(sw_ember_q1_clear)를 조건으로 거는 이벤트가 어디어디인지 알려 주세요.', args: { switchId: 'sw_ember_q1_clear' } },
    { key: 'started-casual', prompt: '퀘스트 시작 스위치 쓰는 이벤트 있어?', args: { switchId: 'sw_ember_q1_started' } },
  ],
  readTools: ['find_switch_usage', 'find_flag_usage'],
  judge(input, args) {
    const switchId = strArg(args, 'switchId');
    return readOnly(input, switchId, () => {
      const users = switchUsers(input.before, switchId);
      if (!users.length) return fail(`fixture 에 ${switchId} 를 쓰는 이벤트가 없다`);
      const missing = users.filter((event: any) => !matchAny(input.answer, event.id, event.name, ...(event.pages ?? []).map((page: any) => page.name)));
      if (missing.length) return fail(`${switchId} 를 쓰는 이벤트 ${missing.map((event: any) => event.id).join(',')} 를 빠뜨렸다`);
      return pass(`${switchId} 사용 이벤트 ${users.length}개 보고`);
    });
  },
  reference(project, args) {
    const switchId = strArg(args, 'switchId');
    const users = switchUsers(project as Project, switchId);
    return `${switchId} 를 쓰는 이벤트 ${users.length}개\n${users.map((event: any) => `- ${event.id} (${event.x},${event.y})`).join('\n')}`;
  },
  wrongs(project, args): FamilyOutcome[] {
    const switchId = strArg(args, 'switchId');
    const users = switchUsers(project as Project, switchId);
    const others = (mapOf(project as Project).events ?? []).filter((event: any) => !users.some((user: any) => user.id === event.id));
    const otherSwitchUsers = switchUsers(project as Project, switchId === 'sw_ember_q1_clear' ? 'sw_ember_q1_started' : 'sw_ember_q1_clear');
    const otherOnly = otherSwitchUsers.filter((event: any) => !users.some((user: any) => user.id === event.id));
    return [
      '이 스위치를 쓰는 이벤트는 없습니다.',
      others.slice(0, 2).map((event: any) => `- ${event.id} (${event.x},${event.y})`).join('\n') || '- ev_utility_npc (18,8)',
      otherOnly.map((event: any) => `- ${event.id}`).join('\n') || '- ev_test_shop',
      '다른 스위치와 같은 이벤트입니다.',
    ];
  },
};

const purposeOf = (category: any): string => String(category?.purpose ?? category?.id ?? '');

const readTilesetRefs: Family = {
  id: 'read-tileset-refs',
  area: 'read',
  mode: 'read',
  title: '타일셋 참고문서 용도',
  variants: [
    { key: 'interior-plain', prompt: '실내 타일셋 참고문서에 어떤 용도가 있어?', args: { tilesetId: 'atlas_biome_interior' } },
    { key: 'interior-polite', prompt: 'atlas_biome_interior 타일셋의 참고문서 용도 목록을 알려 주세요.', args: { tilesetId: 'atlas_biome_interior' } },
    { key: 'village-terse', prompt: '버들항 참고문서 용도만.', args: { tilesetId: 'beodeul_city' } },
    { key: 'village-explain', prompt: '타일을 깔기 전에 자료를 확인하려 합니다. 현재 맵 칩셋의 참고문서가 어떤 용도로 몇 개씩 있는지 정리해 주세요.', args: { tilesetId: 'beodeul_city' } },
    { key: 'interior-casual', prompt: '실내 칩셋 학습 자료 뭐뭐 있어?', args: { tilesetId: 'atlas_biome_interior' } },
  ],
  readTools: ['list_tileset_references'],
  judge(input, args) {
    const tilesetId = strArg(args, 'tilesetId');
    return readOnly(input, tilesetId, () => {
      const tileset = (input.before as any).tilesets?.[tilesetId];
      if (!tileset) return fail(`${tilesetId} 타일셋이 없다`);
      const categories: any[] = tileset.referenceDocuments ?? [];
      if (!categories.length) return fail(`${tilesetId} 에 참고문서가 없다`);
      const named = categories.filter((category: any) => matchAny(input.answer, purposeOf(category), category.title, category.name));
      if (named.length < Math.ceil(categories.length * 0.7)) return fail(`용도 ${categories.length}개 중 ${named.length}개만 말했다`);
      return pass(`참고문서 용도 ${named.length}/${categories.length}`);
    });
  },
  reference(project, args) {
    const tileset = (project as any).tilesets?.[strArg(args, 'tilesetId')];
    return (tileset?.referenceDocuments ?? []).map((category: any) => `- ${purposeOf(category)}: 문서 ${(category.documents ?? []).length}개`).join('\n');
  },
  wrongs(project, args): FamilyOutcome[] {
    const tileset = (project as any).tilesets?.[strArg(args, 'tilesetId')];
    const categories: any[] = tileset?.referenceDocuments ?? [];
    const other = (project as any).tilesets?.jp_city;
    const otherCategories: any[] = other?.referenceDocuments ?? [];
    return [
      categories.length > 1 ? `- ${purposeOf(categories[0])}: 문서 ${(categories[0].documents ?? []).length}개` : '참고문서는 아직 없습니다.',
      '참고문서는 아직 없습니다.',
      otherCategories.length ? otherCategories.map((category: any) => `- ${purposeOf(category)}`).join('\n') : '없습니다',
      categories.length > 1 ? `- ${purposeOf(categories[categories.length - 1])}: 문서 1개` : '용도는 하나뿐입니다.',
    ];
  },
};

function unreachableMaps(project: Project): any[] {
  // 걸어서 들어갈 수 있는 맵 — 문 명령이 있어도 문 칸이 막혀 있으면 닿지 않는다(공용 reachableMaps).
  const reachable = reachableMaps(project);
  return Object.values<any>((project as any).maps).filter(map => !reachable.has(map.id));
}

const readUnreachableMap: Family = {
  id: 'read-unreachable-map',
  area: 'read',
  mode: 'read',
  title: '시작 맵에서 연결되지 않은 맵',
  variants: [
    { key: 'unreachable-plain', prompt: '시작 맵에서 걸어서 갈 수 없는 맵 알려줘.', args: {} },
    { key: 'unreachable-polite', prompt: '시작 지점에서 이동으로 이어지지 않는 맵이 있으면 알려 주세요.', args: {} },
    { key: 'unreachable-terse', prompt: '고립된 맵?', args: {} },
    { key: 'unreachable-explain', prompt: '월드 구조를 점검하려 합니다. 시작 맵에서 전이(이동)를 따라가서 닿지 않는 맵을 모두 찾아 주세요.', args: {} },
    { key: 'unreachable-casual', prompt: '연결 안 된 맵 있나 봐줘.', args: {} },
  ],
  readTools: ['get_project_summary', 'check_reachability'],
  judge(input, args) {
    void args;
    return readOnly(input, 'read-unreachable-map', () => {
      const truth = unreachableMaps(input.before);
      const missing = truth.filter((map: any) => !matchAny(input.answer, map.id, map.name));
      if (missing.length) return fail(`고립된 맵 ${missing.map((map: any) => map.id).join(',')} 를 빠뜨렸다`);
      const reachable = Object.values<any>((input.before as any).maps).filter((map: any) => !truth.some((found: any) => found.id === map.id));
      // 「완전 고립은 아닙니다」처럼 부정하는 문장은 끊겼다는 주장이 아니다.
      const falseClaim = reachable.find((map: any) => input.answer.split(/[.\n!?。？！]/u).some(sentence => {
        if (![map.id, map.name].filter(Boolean).some((needle: string) => sentence.includes(needle))) return false;
        if (!/(연결되지|고립|도달할\s*수\s*없|연결이\s*없|갈\s*수\s*없|끊긴|끊겨)/u.test(sentence)) return false;
        return !/(고립은?\s*아니|아닙니다|않습니다|없지\s*않)/u.test(sentence);
      }));
      if (falseClaim) return fail(`${falseClaim.id} 는 실제로 닿는다`);
      return pass(`고립된 맵 ${truth.length}개 보고`);
    });
  },
  reference(project) {
    const truth = unreachableMaps(project as Project);
    return `시작 맵에서 닿지 않는 맵 ${truth.length}개\n${truth.map((map: any) => `- ${map.id} — ${map.name}`).join('\n')}`;
  },
  wrongs(project): FamilyOutcome[] {
    const truth = unreachableMaps(project as Project);
    return [
      '모든 맵이 시작 맵과 연결되어 있습니다.',
      truth.length > 1 ? truth.slice(0, 1).map((map: any) => `- ${map.id} — ${map.name}`).join('\n') : '- map_plaza — 광장',
      `${truth.map((map: any) => `- ${map.id}`).join('\n')}\n- map_plaza — 광장: 연결되지 않음`,
      '시작 맵에서 모든 맵으로 이어집니다. 점검할 것이 없습니다.',
    ];
  },
};

export const GROUP_5: readonly Family[] = [
  nightMood, mediaBgmMap, mediaWeather, mediaScreenTint, mediaBattleBgm, mediaSeVolume,
  ambiguousMakeItNicer, ambiguousAddSomething,
  readMapList, readEventPages, readDbItems, readTroopList, readSwitchUsage, readTilesetRefs, readUnreachableMap,
  ...GROUP_5_INTERIOR,
];
