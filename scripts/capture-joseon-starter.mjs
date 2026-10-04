import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const out = 'verify-shots/joseon-folklore-starter';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
// Only the folder bridge is a fixture. Both production start UIs and the real seed factory run.
await page.addInitScript(() => {
  window.oprn = { start: {
    recentProjects: async () => [{ projectDir: '/fixture/prior', title: '이전 게임', cover: '/assets/joseon-folklore/starter/village.png' }],
    suggestProjectDir: async ({ title }) => ({ root: '/fixture', projectDir: '/fixture/' + title }),
    createProject: async ({ projectDir }) => ({ projectDir }),
  } };
});
await page.goto('http://127.0.0.1:9825/start-screen.html');
await page.getByTestId('start-lobby-examples').click();
await page.getByTestId('start-genre-option-joseon-folklore').waitFor();
await page.screenshot({ path: out + '/01-start-examples.png' });
await page.getByTestId('start-genre-option-joseon-folklore').click();
await page.getByRole('heading', { name: '조선 설화', exact: true }).waitFor();
await page.screenshot({ path: out + '/02-start-selection.png' });
await page.getByTestId('start-title-input').fill('달빛 버들마을');
await page.locator('.start-size-details > summary').click();
await page.getByRole('combobox', { name: '게임 화면 크기' }).selectOption('wide');
await page.route('**/index.html', route => route.fulfill({ contentType: 'text/html', body: '<main>fixture handoff destination</main>' }));
await page.getByTestId('start-create').click();
await page.waitForURL('**/index.html');
const handoff = await page.evaluate(() => JSON.parse(sessionStorage.getItem('oprn:start-screen-intent')));
assert.equal(handoff.starterPresetId, 'joseon-folklore');
assert.equal(handoff.choiceId, 'adventure-jrpg');
assert.equal(handoff.startMode, 'example');
assert.equal(handoff.screenSize, 'wide');
assert.equal(handoff.title, '달빛 버들마을');

await page.goto('http://127.0.0.1:9825/start-screen.html');
await page.evaluate(async () => {
  const { showNewProjectDialog } = await import('/src/editor/ui/newProjectDialog.ts');
  window.starterSelection = null;
  void showNewProjectDialog({ defaultChoiceId: null }).then(result => { window.starterSelection = result; });
});
await page.getByTestId('new-project-genre-option-joseon-folklore').click();
await page.getByRole('heading', { name: '조선 설화', exact: true }).waitFor();
await page.getByTestId('new-project-dialog').screenshot({ path: out + '/03-editor-selection.png' });
await page.getByTestId('new-project-size-option-wide').check();
await page.getByTestId('new-project-confirm').click();
await page.waitForFunction(() => window.starterSelection !== null);
const selection = await page.evaluate(() => window.starterSelection);
assert.equal(selection.starterPresetId, 'joseon-folklore');
assert.equal(selection.choiceId, 'adventure-jrpg');
assert.equal(selection.screenSize, 'wide');
const seed = await page.evaluate(async selection => {
  const { createProjectStartSeed } = await import('/src/editor/projectStartSeed.ts');
  const p = await createProjectStartSeed(selection.choiceId, selection.title, selection.startMode, selection.screenSize, selection.starterPresetId);
  return { maps: Object.keys(p.maps), classes: p.database.classes.map(c => c.name), equipment: p.database.equipment.length, enemies: p.database.enemies.length, font: p.system.dialogueFont, dialogueStyle: p.system.dialogueStyle, resolution: p.system.playResolution, world: p.worldCanon.name };
}, selection);
assert.equal(seed.maps.length, 6);
assert.equal(seed.equipment, 36);
assert.equal(seed.enemies, 15);
assert.equal(seed.dialogueStyle, 'joseon');
assert.deepEqual(seed.resolution, { width: 640, height: 360 });
assert.deepEqual(errors, []);
const proof = { scope: 'Production launcher/menu UI, fixture folder bridge; real seed factory. Canonical storage is separate storage-proof.json.', handoff, selection, seed, errors };
fs.writeFileSync(out + '/ui-proof.json', JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof));
await browser.close();
