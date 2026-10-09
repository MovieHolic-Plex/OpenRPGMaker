// Dedicated player.html fixture: original pixel heroine against the hand-drawn hydra.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import { recordingFixture } from './retro2003-gif-fixture.mjs';
import { startPlayerQaServer, runRuntimeQa } from '../../lib/runtimeQaRun.mjs';

const resourceId = 'charset-battler-silver-swordswoman';
const out = resolve('verify-shots/silver-swordswoman');
const temporary = resolve('.vite-cache/silver-swordswoman/project.json');
await mkdir(out, { recursive: true });
await mkdir(resolve('.vite-cache/silver-swordswoman'), { recursive: true });
const fixture = await recordingFixture();
const project = fixture.project;
project.system.battleFlow = 'strict';
const actor = project.database.actors.find(actor => actor.id === 'actor_hero');
if (!actor) throw Error('Hero fixture missing');
actor.name = '은발 여검사';
actor.battleCharacterResourceId = resourceId;
const template = project.database.enemies[0];
const hydra = { ...structuredClone(template), id: 'enemy_silver_swordswoman_qa', name: '히드라',
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
    id: 'silver-swordswoman', projectFixture: temporary, viewport: { width: 960, height: 720 },
    beats: [{ id: 'command', note: '실제 RM2003 도트 측면 전투: 직접 찍은 은발 여검사와 히드라.',
      ops: [
        { kind: 'key', key: 'Enter' }, { kind: 'waitForRuntime' }, { kind: 'seed', seed: 1 },
        { kind: 'teleport', mapId: fixture.entry.mapId, x: fixture.entry.x, y: fixture.entry.y },
        { kind: 'face', dir: 'up' }, { kind: 'action' },
        { kind: 'pressUntil', key: 'z', testid: 'actor-command-attack', state: 'present', maxPresses: 40 },
      ], expect: { testidPresent: ['battle-scene', 'battle-actor-sprites'] }, shot: true,
    }],
  }, { serverUrl: server.url, outDir: join(out, 'runtime') });
  await page.waitForFunction(id => {
    const scene = document.querySelector('[data-testid="battle-scene"]');
    const heroine = scene?.querySelector(`.battle-actor[data-battle-charset-resource-id="${id}"]`);
    const sprite = heroine?.querySelector('.battle-actor-sprite');
    return scene?.dataset.battlePhase === 'actorCommand' && scene.dataset.battleSequenceBusy === 'false'
      && sprite?.style.backgroundImage.includes('silver-swordswoman.png');
  }, resourceId, { timeout: 30000 });
  const loadedSheet = await page.locator(`[data-testid="battle-actor-sprite-${resourceId}"]`).evaluate(async sprite => {
    const url = sprite.dataset.battlerSheetUrl;
    const image = new Image();
    image.src = url;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  });
  if (loadedSheet.width !== 144 || loadedSheet.height !== 384) throw Error('Wrong battle sheet dimensions');
  const evidence = await page.locator('[data-testid="battle-scene"]').evaluate(scene => ({
    skin: scene.dataset.battleSkin, layout: scene.dataset.battleLayout,
    party: [...scene.querySelectorAll('.battle-actor')].map(node => ({
      resourceId: node.dataset.battleCharsetResourceId, pose: node.dataset.battlePose,
      box: node.getBoundingClientRect().toJSON(),
      image: node.querySelector('.battle-actor-sprite')?.style.backgroundImage,
      rendering: node.querySelector('.battle-actor-sprite') ? getComputedStyle(node.querySelector('.battle-actor-sprite')).imageRendering : null,
    })),
  }));
  if (evidence.skin !== 'retro2003' || !evidence.party.some(actor => actor.resourceId === resourceId)) {
    throw Error('Unexpected renderer or missing heroine');
  }
  if (!requested.includes('/assets/generated/charset-battlers/cast/silver-swordswoman.png')) {
    throw Error('Heroine cast sheet not preloaded');
  }
  if (requested.some(path => path.includes('/generated/starter/'))) throw Error('Retired starter art requested');
  if (report.errors.length || report.beats.some(beat => beat.failures.length)) throw Error(JSON.stringify(report));
  await page.locator('[data-testid="battle-scene"]').screenshot({ path: join(out, 'battle.png'), animations: 'disabled' });
  await writeFile(join(out, 'renderer.json'), JSON.stringify({
    fixtureOnly: true, route: 'player.html + exportProjectStoreShim', ...evidence,
    assetRequestCount: requested.length,
    requestedBattleSheets: [...new Set(requested)].filter(path => /^\/assets\/generated\/(charset-battlers|pixel-enemies|pixel-enemy-portraits)\//.test(path)).sort(),
    starterRequests: requested.filter(path => path.includes('/generated/starter/')), errors: report.errors,
  }, null, 2) + '\n');
  console.log(JSON.stringify(evidence));
} finally {
  await browser?.close();
  await server?.close();
  fixture.cleanup();
}
