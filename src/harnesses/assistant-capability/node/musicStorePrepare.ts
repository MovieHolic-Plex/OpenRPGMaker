// Prepare a small canonical SQLite project for the store-music assistant test (bun).
//   bun src/harnesses/assistant-capability/node/musicStorePrepare.ts <game dir> <genre: fantasy|joseon|monster|horror> <title>
// Why: the music requests ("이 마을에 어울리는 BGM", "보스전 음악 긴장감 있게", "잔잔한 엔딩곡", "쫓아올 때 추격 음악") need a town map,
// a dungeon map, a named boss battle, one ending (reached after the boss) and — for the horror seed — a switch-woken chaser to land on. Building those with the assistant first would test map building, not
// music. So this seeds them with the same editor tools (create_map / upsert_event), deterministically.
// Then wholeGameSession.mjs --v2 --store-url <staging> drives the real assistant.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { createBlankProject } from '@/project/defaults';
import { runTool } from '@/editor/tools/toolRunner';
import { initLocalProjectStore } from '../../../../electron/local-store/store';
import { sharedContentFile } from '../../../../scripts/lib/sharedContentSqlite';

const GENRES = {
  fantasy: { town: '버들 마을', dungeon: '용의 동굴', bossTroop: { id: 'troop_dragon', name: '붉은 드래곤' }, bossEvent: '드래곤' },
  joseon: { town: '한양 저잣거리', dungeon: '도깨비 골짜기', bossTroop: { id: 'troop_gumiho', name: '구미호 우두머리' }, bossEvent: '구미호' },
  monster: { town: '새싹 마을', dungeon: '바위 체육관', bossTroop: { id: 'troop_gym_leader', name: '체육관 관장 바위' }, bossEvent: '관장' },
  // 추격 음악 시험(set_game_audio role:'chase'): 지하실 금고를 열면 스위치가 켜지고 추격자가 깨어난다.
  horror: { town: '낡은 저택', dungeon: '저택 지하실', bossTroop: { id: 'troop_dragon', name: '붉은 드래곤' }, bossEvent: '그림자' },
} as const;

const dir = resolve(process.argv[2] ?? '');
const genre = process.argv[3] as keyof typeof GENRES;
const title = process.argv[4] ?? 'Music test';
if (!process.argv[2] || !GENRES[genre]) throw Error('musicStorePrepare <game dir> <fantasy|joseon|monster|horror> <title>');
const g = GENRES[genre];
const projectDir = resolve(dir, 'project');
if (existsSync(resolve(projectDir, 'project.sqlite'))) throw Error(`Existing canonical project refused: ${projectDir}`);
mkdirSync(dir, { recursive: true });
const pinned = resolve(dir, 'shared-content.sqlite');
if (!existsSync(pinned)) {
  const source = new DatabaseSync(sharedContentFile(), { readOnly: true });
  try { await backup(source, pinned); } finally { source.close(); }
}

const project = createBlankProject();
project.meta.title = title;
const ctx = { project };
const must = (name: string, args: Record<string, unknown>) => {
  const result = runTool(ctx, name, args, { dryRun: false });
  if (!result.ok) throw Error(`${name}: ${result.summary}`);
};
const start = Object.keys(project.maps)[0]!;
project.maps[start]!.name = g.town;
must('create_map', { id: 'map_dungeon', name: g.dungeon, width: 20, height: 15 });
const db = ctx.project.database as unknown as { troops: { id: string; name: string }[] };
const dragon = db.troops.find((troop) => troop.id === 'troop_dragon')!;
if (g.bossTroop.id !== 'troop_dragon') db.troops.push({ ...structuredClone(dragon), id: g.bossTroop.id, name: g.bossTroop.name });
// 엔딩 하나(보스를 이기면 열림) — 「잔잔한 엔딩곡」 시험이 곡을 걸 자리. 곡은 비워 둔다(조수가 role:'ending' 으로 건다).
must('define_ending', { id: 'ending_main', name: '여정의 끝', conditions: [], epilogue: [{ kind: 'say', speaker: '나', text: '긴 여정이 끝났다.' }] });
must('upsert_event', { mapId: 'map_dungeon', event: { id: 'ev_boss', name: g.bossEvent, x: 10, y: 3, commands: [
  { kind: 'text', body: '여기까지 온 것을 후회하게 해 주마!' },
  { kind: 'battleProcessing', troopId: g.bossTroop.id, canEscape: false, canLose: false },
  { kind: 'text', body: '...강하구나.' },
  { kind: 'triggerEnding', endingId: 'ending_main' },
] } });
if (genre === 'horror') {
  must('upsert_event', { mapId: 'map_dungeon', event: { id: 'ev_safe', name: '금고', x: 15, y: 10, commands: [
    { kind: 'text', body: '금고가 열렸다... 등 뒤에서 무언가 깨어났다.' },
    { kind: 'setSwitch', switchId: 'sw_chase_on', value: true },
  ] } });
  must('make_chase_scene', { mapId: 'map_dungeon', id: 'ev_chaser', chaser: { at: { x: 3, y: 3 }, speed: 4, sightRange: 8 }, activateSwitch: 'sw_chase_on', killOnTouch: true, hidingSpots: [] });
}
must('upsert_event', { mapId: 'map_dungeon', event: { id: 'ev_minor', name: '졸개', x: 5, y: 8, commands: [
  { kind: 'battleProcessing', troopId: 'troop_bat_swarm' },
] } });

const store = await initLocalProjectStore({ projectDir });
try {
  await store.saveProject(ctx.project);
  const snapshot = store.loadSnapshot()!;
  writeFileSync(resolve(dir, 'fixture.json'), JSON.stringify({ projectDir, projectId: store.projectId, genre,
    town: { id: start, name: g.town }, dungeon: { id: 'map_dungeon', name: g.dungeon }, boss: g.bossTroop, ending: 'ending_main', ...(genre === 'horror' ? { chaser: { mapId: 'map_dungeon', eventId: 'ev_chaser', switchId: 'sw_chase_on' } } : {}),
    revision: snapshot.revision, sha256: snapshot.sha256, source: 'createBlankProject + musicStorePrepare' }, null, 2));
  console.log(`Prepared ${projectDir} (${store.projectId})`);
} finally { store.close(); }
