// bun 전용: 몬스터 낚시(speciesId catches) 도구→정규화→직렬화→낚시 굴림→run_scene_test 전투까지 모델 없이 확인한다.
//   bun scripts/qa/poke-audit-fix/fishing-probe.mts
import { createBlankProject } from '@/project/defaults';
import { runToolAsync } from '@/editor/tools/asyncToolRunner';
import { runTool } from '@/editor/tools';
import { serialize, deserialize } from '@/project/io';
import { runSceneTest } from '@/testing/sceneTestRunner';
import { startSession } from '@/project/session';
import { attemptFishingCatch } from '@/project/fishing';
import { wildTroopIdForSpecies } from '@/project/wildTroops';
import { validateProjectReferences } from '@/project/io/references';

const project = createBlankProject();
const ctx = { project, currentMapId: project.startMapId } as never as { project: typeof project; currentMapId: string };
const built = await runToolAsync(ctx as never, 'build_monster_game', { mode: 'create', gymCount: 1 });
if (!built.ok) throw Error(`build failed: ${built.summary}`);
const p = ctx.project;
const species = (p.database.monsterSpecies ?? []);
console.log('species', species.length, 'troops', p.database.troops.length);
const withTroop = species.filter((s) => wildTroopIdForSpecies(p, s.id));
console.log('species with wild troop', withTroop.length, withTroop.slice(0, 3).map((s) => `${s.id}->${wildTroopIdForSpecies(p, s.id)}`));
const target = withTroop[0]!;
const noTroop = species.find((s) => !wildTroopIdForSpecies(p, s.id));
const mapId = Object.keys(p.maps)[0]!;

const out: string[] = [];
const bad = runTool(ctx as never, 'configure_fishing', { enabled: true, spots: [{ id: 's0', mapId, area: { x: 0, y: 0, w: 2, h: 2 }, catches: [{ speciesId: 'nope', weight: 1 }] }] });
out.push(`unknown species -> ok=${bad.ok} ${bad.summary.slice(0, 90)}`);
if (noTroop) {
  const nt = runTool(ctx as never, 'configure_fishing', { enabled: true, spots: [{ id: 's0', mapId, area: { x: 0, y: 0, w: 2, h: 2 }, catches: [{ speciesId: noTroop.id, weight: 1 }] }] });
  out.push(`no wild troop -> ok=${nt.ok} ${nt.summary.slice(0, 110)}`);
}
const mixed = runTool(ctx as never, 'configure_fishing', { enabled: true, energyCost: 0, spots: [{ id: 'pond', mapId, area: { x: 0, y: 0, w: 2, h: 2 }, catches: [{ speciesId: target.id, weight: 1, levelMin: 4, levelMax: 6 }] }] });
out.push(`monster catch -> ok=${mixed.ok} ${mixed.summary}`);
console.log(out.join('\n'));

const reloaded = deserialize(serialize(ctx.project));
const spot = reloaded.system.fishing?.spots[0];
console.log('reload monsterCatches', JSON.stringify(spot?.monsterCatches), 'catches', spot?.catches.length);
try { validateProjectReferences(reloaded); console.log('references ok'); } catch (e) { console.log('references FAIL', String(e).slice(0, 200)); }

const session = startSession(reloaded, 1);
(session as never as { collections: unknown }).collections ??= {};
const tally: Record<string, number> = {};
let levels: number[] = [];
for (let i = 0; i < 40; i++) {
  const r = attemptFishingCatch(reloaded, session, { mapId, x: 0, y: 0 });
  const key = r.ok ? ('kind' in r ? `encounter:${r.troopId}` : 'item') : `refused:${r.reason}`;
  tally[key] = (tally[key] ?? 0) + 1;
  if (r.ok && 'kind' in r && r.level !== undefined) levels.push(r.level);
}
console.log('40 casts', tally, 'levels', [...new Set(levels)].sort());
console.log('pre-serialize', JSON.stringify(ctx.project.system.fishing));
console.log('post', JSON.stringify(reloaded.system.fishing));

const run = runSceneTest(reloaded, { mapId, start: { x: 0, y: 2 }, steps: [{ kind: 'face', dir: 'up' }, { kind: 'interact' }] });
console.log('scene ok', run.ok, JSON.stringify(run.log ?? run.failure ?? run.summary).slice(0, 300));
