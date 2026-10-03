// A minimal recording fixture through player.html and the export store shim.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import { recordingFixture } from './retro2003-gif-fixture.mjs';
import { startPlayerQaServer, runRuntimeQa } from '../../lib/runtimeQaRun.mjs';

const out = resolve(process.argv[2] ?? 'verify-shots/hydra-rm2003');
const temporary = resolve('.vite-cache/hydra-recording/project.json');
await mkdir(out, { recursive: true });
await mkdir(resolve('.vite-cache/hydra-recording'), { recursive: true });
const fixture = await recordingFixture();
const project = fixture.project;
project.system.battleFlow = 'strict';
const template = project.database.enemies[0];
const hydra = { ...structuredClone(template), id: 'enemy_hydra_recording', name: '히드라',
  monsterResourceId: 'generated-enemy-hydra-three',
  stats: { ...template.stats, maxHp: 9999, attack: 1, agility: 1 },
  actions: [{ skillId: 'skill_attack', priority: 5, condition: { kind: 'always' } }],
};
project.database.enemies.push(hydra);
const troop = project.database.troops.find(t => t.id === fixture.entry.troopId);
troop.enemyIds = [hydra.id];
troop.members = [{ enemyId: hydra.id, x: 110, y: 144, hidden: false }];
troop.autoAlign = false;
await writeFile(temporary, JSON.stringify(project));
let server, browser;
try {
  server = await startPlayerQaServer({ logLevel: 'error' });
  browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
  const page = await browser.newPage();
  const requested = [];
  page.on('request', request => {
    if (request.url().includes('/assets/')) requested.push(new URL(request.url()).pathname);
  });
  const report = await runRuntimeQa(page, {
    id: 'hydra-rm2003', projectFixture: temporary, viewport: { width: 960, height: 720 },
    beats: [{ id: 'command', note: '실제 RM2003 도트 측면 전투: 히드라와 걷기 칩 파티 시트.',
      ops: [
        { kind: 'key', key: 'Enter' }, { kind: 'waitForRuntime' }, { kind: 'seed', seed: 1 },
        { kind: 'teleport', mapId: fixture.entry.mapId, x: fixture.entry.x, y: fixture.entry.y },
        { kind: 'face', dir: 'up' }, { kind: 'action' },
        { kind: 'pressUntil', key: 'z', testid: 'actor-command-attack', state: 'present', maxPresses: 40 },
      ], expect: { testidPresent: ['battle-scene', 'battle-actor-sprites'] }, shot: true,
    }],
  }, { serverUrl: server.url, outDir: join(out, 'runtime') });
  await page.waitForFunction(() => {
    const scene = document.querySelector('[data-testid="battle-scene"]');
    const hydra = scene?.querySelector('.battle-enemy[data-monster-resource-id="generated-enemy-hydra-three"]');
    const image = hydra?.querySelector('img');
    return scene?.dataset.battlePhase === 'actorCommand' && scene.dataset.battleSequenceBusy === 'false'
      && hydra?.dataset.pixelEnemyCell === '96' && image?.complete && image.naturalWidth === 96;
  }, null, { timeout: 30000 });
  const evidence = await page.locator('[data-testid="battle-scene"]').evaluate(scene => ({
    skin: scene.dataset.battleSkin, layout: scene.dataset.battleLayout,
    enemy: [...scene.querySelectorAll('.battle-enemy')].map(node => ({
      resourceId: node.dataset.monsterResourceId, cell: node.dataset.pixelEnemyCell,
      motion: node.dataset.pixelEnemy, box: node.getBoundingClientRect().toJSON(),
      background: getComputedStyle(node.querySelector('img')).backgroundImage,
    })),
    party: [...scene.querySelectorAll('.battle-actor')].map(node => node.dataset.battleCharsetResourceId),
  }));
  if (evidence.skin !== 'retro2003' || evidence.enemy.length !== 1) throw Error('Unexpected battle renderer');
  if (requested.some(path => path.includes('/generated/starter/'))) throw Error('Retired starter art was requested');
  if (report.errors.length || report.beats.some(beat => beat.failures.length)) throw Error(JSON.stringify(report));
  await page.locator('[data-testid="battle-scene"]').screenshot({ path: join(out, 'battle.png'), animations: 'disabled' });
  await writeFile(join(out, 'renderer.json'), JSON.stringify({ fixtureOnly: true, route: 'player.html + exportProjectStoreShim', ...evidence,
    distinctAssetRequestCount: new Set(requested).size,
    requestedBattleSheets: [...new Set(requested)].filter(path => /^\/assets\/generated\/(charset-battlers|pixel-enemies|pixel-enemy-portraits)\//.test(path)).sort(),
    starterRequests: requested.filter(path => path.includes('/generated/starter/')), errors: report.errors }, null, 2) + '\n');
  console.log(JSON.stringify(evidence));
} finally {
  await browser?.close();
  await server?.close();
  fixture.cleanup();
}
