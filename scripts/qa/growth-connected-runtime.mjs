import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { firefox } from 'playwright';
import { runRuntimeQa, startPlayerQaServer } from '../lib/runtimeQaRun.mjs';
import { armDomState, finishDomState, blockRemoteWrites } from './growth-tree-evidence.mjs';

const out = resolve(process.env.GROWTH_QA_OUTPUT ?? '.omo/evidence/growth-integrated/runtime-connected');
const persistence = resolve(process.env.GROWTH_QA_FIXTURE_DIR ?? '.omo/evidence/growth-integrated/persistence');
const proof = JSON.parse(await readFile(`${persistence}/proof.json`, 'utf8'));
assert.equal(proof.reloaded, true);
const verificationSource = proof.verificationSource ?? 'Supabase reload';
await mkdir(out, { recursive: true });
const server = await startPlayerQaServer();
const browser = await firefox.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(30000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const remoteWrites = await blockRemoteWrites(page);
const activate = async id => {
  await page.getByTestId(id).waitFor();
  for (let step = 0; step < 100; step++) {
    const selected = await page.locator('.status-menu-detail-action.selected').first().getAttribute('data-testid');
    if (selected === id) {
      const before = await page.getByTestId('main-menu').innerHTML();
      await armDomState(page, html => document.querySelector('[data-testid="main-menu"]').innerHTML !== html, before);
      await page.keyboard.press('Enter');
      await finishDomState(page);
      return;
    }
    await armDomState(page, previous => document.querySelector('.status-menu-detail-action.selected')?.getAttribute('data-testid') !== previous, selected);
    await page.keyboard.press('ArrowDown');
    await finishDomState(page);
  }
  throw new Error(`Keyboard could not reach ${id}`);
};
const shot = async name => page.screenshot({ path: `${out}/${name}.png` });
try {
  const report = await runRuntimeQa(page, {
    id: 'growth-connected',
    projectFixture: `${persistence}/reloaded-project.json`,
    viewport: { width: 1280, height: 800 },
    beats: [
      { id: 'title', note: `${verificationSource}: 연결 성장 프로젝트`, expect: { testidPresent: ['title-screen'] } },
      { id: 'field', note: '출하 플레이어 진입', ops: [{ kind: 'key', key: 'Enter' }, { kind: 'waitForRuntime' }], expect: { testidAbsent: ['title-screen'], playerSpriteTextureLoaded: true }, shot: true },
      { id: 'menu', note: '키보드 성장 메뉴 진입', ops: [{ kind: 'key', key: 'Escape' }, { kind: 'waitForVisible', testid: 'main-menu' }], expect: { testidPresent: ['main-menu'] } },
    ],
  }, { serverUrl: server.url, outDir: out });
  assert.equal(report.beats.filter(beat => beat.failures.length).length, 0);
  assert.equal(new URL(page.url()).pathname, '/player.html');
  assert.equal(await page.getByTestId('toolbar-database').count(), 0);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await activate(`status-menu-skill-actor-${proof.actorId}`);
  const [root, middle, final] = proof.route;
  await activate('growth-menu-tab-promotion');
  assert.equal(await page.getByTestId(`growth-menu-promote-${middle.classId}`).isDisabled(), true);
  await shot('01-locked-promotion');
  await activate('growth-menu-tab-tree');
  assert.equal(await page.getByTestId(`growth-menu-node-${root.technique}`).isDisabled(), true);
  await activate(`growth-menu-node-${root.foundation}`);
  await activate(`growth-menu-node-${root.foundation}`);
  await activate(`growth-menu-node-${root.technique}`);
  await activate('growth-menu-tab-promotion');
  assert.equal(await page.getByTestId(`growth-menu-promote-${middle.classId}`).isDisabled(), false);
  await activate(`growth-menu-promote-${middle.classId}`);
  await activate('growth-menu-tab-tree');
  assert.equal(await page.getByTestId(`growth-menu-node-${root.technique}`).count(), 1);
  assert.equal(await page.getByTestId(`growth-menu-node-${middle.foundation}`).isDisabled(), false);
  await activate(`growth-menu-node-${middle.foundation}`);
  await activate(`growth-menu-node-${middle.foundation}`);
  await activate(`growth-menu-node-${middle.technique}`);
  assert.equal(await page.getByTestId(`growth-menu-reset-${root.treeId}`).isDisabled(), true);
  await shot('02-inherited-and-reset-protected');
  await activate('growth-menu-tab-promotion');
  await activate(`growth-menu-promote-${final.classId}`);
  await activate('growth-menu-tab-tree');
  assert.equal(await page.getByTestId(`growth-menu-node-${root.technique}`).count(), 1);
  assert.equal(await page.getByTestId(`growth-menu-node-${middle.technique}`).count(), 1);
  assert.equal(await page.getByTestId(`growth-menu-node-${final.foundation}`).isDisabled(), false);
  await shot('03-final-class-inherits-chain');
  await activate(`growth-menu-reset-${middle.treeId}`);
  assert.equal(await page.getByTestId(`growth-menu-reset-${root.treeId}`).isDisabled(), false);
  await activate(`growth-menu-reset-${root.treeId}`);
  assert.match(await page.getByTestId('status-menu-detail-title').innerText(), /13 P/);
  await activate('growth-menu-tab-promotion');
  assert.equal(await page.locator('[data-testid^="growth-menu-promote-"]').count(), 0);
  await shot('04-refunded-without-demotion');
  assert.deepEqual(errors, []);
  assert.deepEqual(remoteWrites, []);
  await writeFile(`${out}/proof.json`, JSON.stringify({ projectId: proof.projectId, source: verificationSource, checks: ['shipped-player', 'keyboard-only', 'skill-rank-point-gates', 'two-promotions', 'actual-lineage-inheritance', 'cross-tree-reset-protection', 'refund-without-demotion'], errors, remoteWrites }, null, 2));
  await writeFile(`${out}/SUMMARY.md`, `# Connected growth runtime QA\n\nPASS: ${verificationSource} -> shipped player -> keyboard investment -> two promotions -> inherited trees -> protected reset -> refund without demotion.\n\nImmediately inspect: 01-locked-promotion.png, 02-inherited-and-reset-protected.png, 03-final-class-inherits-chain.png, 04-refunded-without-demotion.png.\n`);
  console.log('Connected growth shipped-player QA passed');
} finally {
  await browser.close();
  await server.close();
}
