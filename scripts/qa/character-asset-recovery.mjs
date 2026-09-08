import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { firefox } from 'playwright';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:38424';
const output = process.env.QA_OUTPUT ?? 'output/evidence/issue693-assets';
const reproduce = process.argv.includes('--reproduce');
const width = Number(process.env.QA_WIDTH ?? 1280);
await mkdir(output, { recursive: true });
const browser = await firefox.launch({ headless: true });
const context = await browser.newContext({ viewport: { width, height: width === 1024 ? 768 : 900 } });
const page = await context.newPage();
page.setDefaultTimeout(60_000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
// Local engine QA only: never send a write to the shared project or AI provider.
await page.route('**/*', route => {
  if (!['GET', 'HEAD'].includes(route.request().method()) && /supabase|\/rest\/v1\/|\/ai\//.test(route.request().url())) return route.abort('blockedbyclient');
  return route.continue();
});
await page.addInitScript(() => {
  localStorage.setItem('oprn:editor-ui-mode', 'standard');
  localStorage.setItem('oprn:ai-panel-collapsed', '1');
});
try {
  await page.goto(`${baseUrl}/?freshProject=1`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('edit-canvas').waitFor({ state: 'visible' });
  const initial = await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { openNewEventEditorModal } = await import('/src/editor/panels/eventEditor/modal.ts');
    if (store.isRemotePersistenceEnabled()) throw new Error('QA requires local-only project');
    const mapId = store.getCurrent().startMapId;
    const eventId = openNewEventEditorModal(mapId, 2, 2);
    const { updateEventPage } = await import('/src/editor/eventPages.ts');
    const pageId = store.getCurrent().maps[mapId].events.find(item => item.id === eventId).pages[0].id;
    updateEventPage(mapId, eventId, pageId, { name: 'OUT-007 recovery QA', commands: [{ kind: 'text', body: 'Preserve this authored dialogue during visual recovery.' }] });
    const event = store.getCurrent().maps[mapId].events.find(item => item.id === eventId);
    window.assetQa = { store, mapId, eventId, before: structuredClone(event) };
    return { mapId, eventId };
  });
  await page.getByTestId('event-page-graphic-set').click();
  await page.locator('.npc-advanced-sprite summary').click();
  await page.getByTestId('event-graphic-direct-sprite-input').fill('out007-nonexistent-character');
  await page.getByTestId('event-graphic-confirm').click();
  const observed = await page.evaluate(() => ({
    pickerOpen: Boolean(document.querySelector('[data-testid="npc-graphic-picker"]')),
    input: document.querySelector('[data-testid="event-graphic-direct-sprite-input"]')?.value,
    graphic: window.assetQa.store.getCurrent().maps[window.assetQa.mapId].events.find(item => item.id === window.assetQa.eventId)?.pages?.[0]?.graphic,
  }));
  await page.screenshot({ path: `${output}/${reproduce ? 'before' : 'after'}-no-match.png` });
  await writeFile(`${output}/${reproduce ? 'before' : 'after'}.json`, JSON.stringify({ initial, observed, errors }, null, 2));
  assert.equal(observed.pickerOpen, true, 'Unknown charset must keep the picker open for recovery, not write a dangling ID');
  assert.equal(observed.input, 'out007-nonexistent-character');
  const readEvent = () => page.evaluate(() => {
    const { store, mapId, eventId } = window.assetQa;
    return store.getCurrent().maps[mapId].events.find(item => item.id === eventId);
  });
  const before = await page.evaluate(() => window.assetQa.before);
  assert.deepEqual(await readEvent(), before, 'No-match must preserve the complete event draft');
  const geometry = await page.getByTestId('event-graphic-recovery').evaluate(node => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, text: node.textContent,
      overflow: node.scrollWidth > node.clientWidth, viewportWidth: innerWidth, viewportHeight: innerHeight };
  });
  assert(geometry.width > 0 && geometry.height > 0);
  assert(!geometry.overflow && geometry.x >= 0 && geometry.x + geometry.width <= width, JSON.stringify(geometry));
  await page.getByTestId('event-graphic-cancel').click();
  assert.deepEqual(await readEvent(), before, 'Cancel must preserve the complete event draft');
  await page.getByTestId('event-page-graphic-set').click();
  await page.locator('.npc-advanced-sprite summary').click();
  await page.getByTestId('event-graphic-direct-sprite-input').fill('out007-nonexistent-character');
  await page.getByTestId('event-graphic-confirm').click();
  await page.getByTestId('event-graphic-resource-tex_easyrpg_charset_people1').click();
  await page.getByTestId('npc-character-slot-3').click();
  await page.getByTestId('event-graphic-confirm').click();
  const manual = await readEvent();
  assert.equal(manual.pages[0].graphic.sprite.id, 'tex_easyrpg_charset_people1');
  assert.deepEqual(manual.pages[0].commands, before.pages[0].commands);
  await page.screenshot({ path: `${output}/manual-recovered-${width}.png` });
  await page.getByTestId('event-page-graphic-set').click();
  await page.getByTestId('event-graphic-placeholder').click();
  const placeholder = await readEvent();
  assert.equal(placeholder.pages[0].graphic.transparent, true);
  assert.equal(placeholder.pages[0].graphic.sprite, undefined);
  assert.deepEqual(placeholder.pages[0].commands, before.pages[0].commands);
  await page.screenshot({ path: `${output}/placeholder-${width}.png` });
  await page.getByTestId('event-editor-save').click();
  const saved = await readEvent();
  assert.equal(saved.draft, undefined, 'Save must commit the event draft');
  assert.equal(saved.pages[0].graphic.transparent, true);
  assert.deepEqual(saved.pages[0].commands, before.pages[0].commands);
  assert.equal(saved.pages[0].name, before.pages[0].name);
  assert.deepEqual(errors, []);
  await writeFile(`${output}/recovery-${width}.json`, JSON.stringify({ width, geometry, manual: manual.pages[0].graphic, placeholder: placeholder.pages[0].graphic, cancelPreserved: true, noMatchPreserved: true, savedDialoguePreserved: true, errors }, null, 2));
  console.log(`PASS OUT-007: ${width}px no-match, cancel, manual retry, explicit no-image`);
} finally {
  await context.close();
  await browser.close();
}
