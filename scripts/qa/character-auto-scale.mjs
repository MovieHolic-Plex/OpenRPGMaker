// Synthetic engine contract QA, using the shipped player entry/store shim. No authored project writes.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startPlayerQaServer } from '../lib/runtimeQaRun.mjs';

const out = 'verify-shots/character-auto-scale';
await mkdir(out, { recursive: true });
const project = JSON.parse(await readFile('verify-shots/tile-size-support/fixture.json', 'utf8'));
project.system.actionCombat = { enabled: true, hud: { hearts: false, stamina: false } };
const graphic = { sprite: { type: 'bundled', id: 'tex_easyrpg_charset_monster1' }, pattern: 1 };
for (const size of [16, 32, 48]) {
  const map = project.maps[`geometry${size}`];
  map.actionCombat = true;
  for (const [i, [id, scale]] of [['auto', undefined], ['manual', 1], ['legacy', 1.5]].entries()) {
    const page = structuredClone(map.events[0].pages[0]);
    page.id = id; page.commands = []; page.graphic = { ...graphic, ...(scale === undefined ? {} : { scale }) };
    if (id === 'manual') page.graphic.scaleMode = 'manual';
    map.events.push({ id, x: 4 + i * 2, y: 4, trigger: { kind: 'action' }, commands: [], pages: [page] });
  }
}
const report = { date: new Date().toISOString(), runtime: [], errors: [] };
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu', '--disable-background-networking', '--disable-features=NetworkChangeNotifier'] });
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
page.on('pageerror', error => report.errors.push(error.message));
try {
  await page.addInitScript(() => { window.__OPENRPG_BOOT__ = { projectUrl: '/auto-scale-fixture.json', saveNamespace: 'auto-scale-qa', qaInstrumentation: true }; });
  await page.route('**/auto-scale-fixture.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(project) }));
  await page.goto(`${server.url}/player.html`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('title-screen').waitFor({ timeout: 120000 });
  await page.keyboard.press('Enter');
  async function position(size, x, y) {
    await page.waitForFunction(({ size, x, y }) => {
      const s = window.__oprnHooksScene, p = s?.player;
      return s?.session.currentMapId === `geometry${size}` && s.tileX === x && s.tileY === y && !s.moving && !s.running
        && p?.x === (x + .5) * size && p?.y === (y + 1) * size;
    }, { size, x, y }, { timeout: 60000 });
  }
  await position(32, 2, 2);
  await page.evaluate(async graphic => {
    const { addFollowerToSession } = await import('/src/project/followers.ts');
    const { syncFollowerSprites } = await import('/src/player/playSceneFollowers.ts');
    const { store } = await import('/src/project/store.ts');
    const scene = window.__oprnHooksScene;
    addFollowerToSession(store.getCurrent(), scene.session, { graphic, name: 'Auto scale QA' });
    syncFollowerSprites(scene);
  }, graphic);
  for (const [size, next] of [[32, 48], [48, 16], [16, 32]]) {
    await position(size, 2, 2);
    // One map per size, start on 32 → the 32px cell is the reference (mapViewScale). Walking charsets keep
    // their 32px on-screen size: world scale 1 on 32, 1.5 on 48, 0.5 on 16 (the camera zooms the other way).
    const expected = { 16: 0.5, 32: 1, 48: 1.5 }[size];
    const observation = await page.evaluate(() => {
      const s = window.__oprnHooksScene;
      const read = p => ({ scaleX: p.scaleX, scaleY: p.scaleY, width: p.width, height: p.height, displayWidth: p.displayWidth, displayHeight: p.displayHeight, x: p.x, y: p.y });
      return { map: s.map.id, player: read(s.player), npcs: Object.fromEntries([...s.eventSprites].map(([id, p]) => [id, read(p)])), followers: [...s.followerSprites.values()].map(read) };
    });
    assert.equal(observation.player.scaleX, expected);
    assert.equal(observation.player.scaleY, expected);
    assert.equal(observation.npcs.auto.scaleX, expected);
    assert.equal(observation.npcs.manual.scaleX, 1);
    assert.equal(observation.npcs.legacy.scaleX, 1.5);
    assert.equal(observation.followers.length, 1);
    assert.equal(observation.followers[0].scaleX, expected);
    await page.evaluate(() => window.__oprnInput.face('down'));
    await page.screenshot({ path: `${out}/runtime-${size}.png` });
    // Observe real attack tween, then require restoration of the map-derived scale.
    await page.evaluate(() => window.__oprnInput.attack());
    await page.waitForFunction(expected => window.__oprnHooksScene.player.scaleX > expected, expected);
    await page.waitForFunction(expected => {
      const s = window.__oprnHooksScene;
      return s.actionCombatState.swingCooldownMs === 0 && s.player.scaleX === expected && s.player.scaleY === expected;
    }, expected);
    // Jump out and back: observe lift, then require the same scale and original feet.
    await page.evaluate(() => window.__oprnDebug.playerRoute([
      { kind: 'jump', dx: 0, dy: -1, heightPx: 16, durationMs: 450 },
      { kind: 'jump', dx: 0, dy: 1, heightPx: 16, durationMs: 450 },
    ]));
    await page.waitForFunction(() => window.__oprnHooksScene.player.originY > 1);
    await page.waitForFunction(({ size, expected }) => {
      const s = window.__oprnHooksScene;
      return !s.playerRoute && !s.playerHop && s.player.originY === 1 && s.player.y === 3 * size && s.player.scaleX === expected && s.player.scaleY === expected;
    }, { size, expected });
    // One cell of movement and the existing action door exercise scale changes on real transfer.
    await page.evaluate(() => window.__oprnInput.dir('right'));
    await page.waitForFunction(() => window.__oprnDebug.readState().x === 3);
    await page.evaluate(() => window.__oprnInput.dir(null));
    await position(size, 3, 2);
    await page.evaluate(() => { window.__oprnInput.face('down'); window.__oprnInput.action(); });
    await position(next, 2, 2);
    report.runtime.push({ size, ...observation, attackRestored: true, jumpRestored: true, actionTransferTo: next });
    console.log(`Auto scale ${size}: player/NPC/follower=${expected}, manual=1, legacy=1.5; attack, jump, transfer passed`);
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  report.lastState = await page.evaluate(() => {
    const s = window.__oprnHooksScene, p = s?.player;
    return { route: s?.playerRoute, hop: s?.playerHop, moving: s?.moving, tileX: s?.tileX, tileY: s?.tileY,
      player: p && { x: p.x, y: p.y, originY: p.originY, scaleX: p.scaleX, scaleY: p.scaleY }, debug: window.__oprnPlayerSprite?.() };
  }).catch(() => null);
  console.log(JSON.stringify(report.lastState));
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await writeFile(`${out}/checks.json`, JSON.stringify(report, null, 2));
  await writeFile(`${out}/SUMMARY.md`, `# Automatic character scaling QA\n\nStatus: ${report.status}\nDate: ${report.date}\n\nDedicated player.html / export store shim. Existing synthetic tile geometry contract fixture with automatic and manual NPCs and one follower; no authored content or remote writes.\n\n${report.runtime.map(r => `- ${r.size}px: player/NPC/follower automatic world scale ${r.player.scaleX} (32px reference); explicit manual 1 and legacy 1.5 preserved. Attack and jump restore the correct scale; action transfer to ${r.actionTransferTo}px succeeds.`).join('\n')}\n\nErrors: ${report.errors.length}\n즉시 확인: runtime-16.png\n${report.failure ?? ''}\n`);
  await browser.close();
  await server.close();
}
