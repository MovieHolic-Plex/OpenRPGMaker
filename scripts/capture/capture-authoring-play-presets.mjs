// Read-only catalog and editor request-draft inspection in an isolated browser.
import { chromium, firefox } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = process.argv[2] ?? 'http://127.0.0.1:9871';
const out = resolve('verify-shots/authoring-play-presets');
mkdirSync(out, { recursive: true });
const browser = process.env.PRESET_CAPTURE_BROWSER === 'firefox' ? await firefox.launch()
  : await chromium.launch({ args: ['--no-proxy-server', '--js-flags=--max-old-space-size=8192', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1360, height: 960 } });
const proof = { isolatedBrowser: true, canonicalContentChanged: false, errors: [] };
page.on('pageerror', error => proof.errors.push(error.message));
try {
  await page.goto(`${target}/?blankProject=1&lang=ko`, { waitUntil: 'load', timeout: 120000 });
  console.log('Editor loaded; waiting for store');
  await page.waitForFunction(() => window.__oprnEditorStore, null, { timeout: 180000 });
  await page.getByTestId('boot-loader').waitFor({ state: 'hidden', timeout: 180000 });
  proof.aiRecordsPresent = await page.evaluate(async () => (await indexedDB.databases()).some(db => db.name === 'oprn-ai-records'));
  proof.catalog = await page.evaluate(async () => {
    const { AUTHORING_PRESETS, AUTHORING_PRESET_CATEGORIES, authoringPresetPrompt } = await import('/src/project/authoringPresets.ts');
    const { getTool, activeTools } = await import('/src/editor/tools/toolRegistry.ts');
    const { buildSessionRegistryTools } = await import('/src/ai/sessionToolExposure.ts');
    const { buildPiAgentSystemPrompt } = await import('/src/ai/piAgent/systemPrompt.ts');
    const { FIRST_PLAY_TOOLS } = await import('/src/ai/piAgent/firstPlay.ts');
    const project = window.__oprnEditorStore.getCurrent();
    const active = new Set(activeTools().map(tool => tool.name));
    const names = [...new Set(AUTHORING_PRESETS.flatMap(preset => [...preset.tools.read, ...preset.tools.write, ...preset.tools.verify]))];
    const list = getTool('list_authoring_presets'), read = getTool('read_authoring_preset');
    const entries = [], pages = [];
    let offset = 0;
    for (;;) {
      const data = list.run(project, { offset }).data;
      entries.push(...data.entries); pages.push({ offset, size: data.entries.length, nextOffset: data.nextOffset });
      if (data.nextOffset === null) break;
      if (data.nextOffset <= offset) throw new Error('Preset pagination did not advance');
      offset = data.nextOffset;
    }
    const ids = entries.map(preset => preset.id);
    const reads = AUTHORING_PRESETS.map(preset => {
      const data = read.run(project, { presetId: preset.id }).data;
      return { id: data.preset.id, steps: data.preset.steps.length, checks: data.preset.checks.length, status: data.verificationStatus,
        stateSource: data.authoringState.source };
    });
    const lifeState = read.run(project, { presetId: 'fish-museum' }).data.authoringState;
    const narrow = buildSessionRegistryTools({ requestText: '가공 설비를 만들어줘', intent: { tools: [], source: 'declaration' } });
    const invalid = [];
    for (const [tool, args] of [[read, { presetId: 'unknown' }], [list, { category: 'unknown' }], [list, { offset: -1 }], [list, { limit: 13 }]]) {
      try { tool.run(project, args); invalid.push('accepted'); } catch (error) { invalid.push(error.code); }
    }
    const modesByName = new Map(activeTools().map(tool => [tool.name, tool.mode]));
    return { total: AUTHORING_PRESETS.length, uniqueIds: new Set(ids).size, nextOffset: pages.at(-1).nextOffset, pages,
      categories: AUTHORING_PRESET_CATEGORIES.map(category => ({ id: category.id, count: list.run(project, { category: category.id }).data.total })),
      catalog: AUTHORING_PRESET_CATEGORIES.map(category => ({ ...category,
        entries: AUTHORING_PRESETS.filter(preset => preset.category === category.id).map(preset => ({ id: preset.id, title: preset.title, description: preset.description })) })),
      wronglyClassifiedWrites: AUTHORING_PRESETS.flatMap(preset => preset.tools.write.filter(name => modesByName.get(name) !== 'write').map(name => ({ preset: preset.id, name }))),
      search: list.run(project, { query: '가공' }).data.entries.map(entry => entry.id),
      unknownTools: names.filter(name => !active.has(name)), reads, invalid,
      initialTools: narrow.map(tool => tool.function.name).filter(name => name.includes('authoring_preset')),
      piPromptConnected: buildPiAgentSystemPrompt(project, [], false).some(line => line.includes('list_authoring_presets')),
      firstPlayReads: FIRST_PLAY_TOOLS.filter(name => name.includes('authoring_preset')),
      sampleRequest: authoringPresetPrompt('maker-processing', '딸기로 잼을 만드는 설비를 만들어줘.', { id: project.startMapId, name: project.maps[project.startMapId].name }),
      modes: [list.mode, read.mode], lifeStateCollections: ['fishSpecies', 'crops', 'lifeSkills'].map(key => ({ key,
        accountedFor: Object.hasOwn(lifeState.database, key) || lifeState.absentDatabaseFields.includes(key) })) };
  });
  console.log('Catalog', JSON.stringify({ total: proof.catalog.total, unknownTools: proof.catalog.unknownTools, initialTools: proof.catalog.initialTools }));
  proof.menuEntry = await page.getByTestId('feature16-open-presets-composer').count();
  await page.evaluate(async () => {
    const { openAiAuthoringModal } = await import('/src/editor/panels/aiAuthoring/modal.ts');
    openAiAuthoringModal('presets', { composer: '', apply: text => { window.__presetRequestDraft = text; } });
  });
  proof.filters = [];
  for (const { id: category } of proof.catalog.categories) {
    await page.getByTestId('authoring-preset-category').selectOption(category);
    proof.filters.push({ category, count: await page.getByTestId('authoring-preset-count').textContent() });
    await page.screenshot({ path: resolve(out, `${category}.png`) });
  }
  await page.getByTestId('authoring-preset-category').selectOption('npc-life');
  await page.getByTestId('feature16-authoring-preset-night-shop').click();
  await page.getByTestId('authoring-preset-idea').fill('밤에만 약을 파는 항구 상인');
  await page.getByTestId('feature16-authoring-preset-workday').click();
  await page.getByTestId('feature16-authoring-preset-night-shop').click();
  proof.draftRestored = await page.getByTestId('authoring-preset-idea').inputValue();
  await page.getByTestId('feature16-authoring-preset-search').fill('검색되지않는유형');
  proof.empty = { count: await page.getByTestId('authoring-preset-count').textContent(), requestVisible: await page.getByTestId('feature16-authoring-preset-apply').isVisible() };
  await page.getByTestId('feature16-authoring-preset-search').fill('');
  await page.getByTestId('feature16-authoring-preset-night-shop').click();
  await page.setViewportSize({ width: 390, height: 844 });
  proof.mobileOverflow = await page.locator('.ai-authoring-dialog').evaluate(dialog => dialog.scrollWidth > dialog.clientWidth);
  await page.screenshot({ path: resolve(out, 'mobile.png') });
  await page.getByTestId('feature16-authoring-preset-apply').click();
  proof.request = await page.evaluate(() => window.__presetRequestDraft);
  proof.modalClosed = await page.getByTestId('feature16-modal').count() === 0;
  proof.passed = proof.catalog.total === 96 && proof.catalog.uniqueIds === 96 && proof.catalog.unknownTools.length === 0
    && proof.catalog.wronglyClassifiedWrites.length === 0 && proof.catalog.categories.length === 12
    && proof.catalog.categories.every(category => category.count === 8) && proof.catalog.initialTools.length === 2
    && proof.catalog.piPromptConnected && proof.catalog.firstPlayReads.length === 2 && proof.menuEntry > 0
    && proof.catalog.reads.every(preset => preset.status === 'not-run' && preset.steps >= 3 && preset.checks >= 3)
    && proof.catalog.invalid.every(result => result !== 'accepted') && proof.draftRestored === '밤에만 약을 파는 항구 상인'
    && proof.catalog.lifeStateCollections.every(collection => collection.accountedFor)
    && proof.empty.requestVisible === false && !proof.mobileOverflow && proof.modalClosed
    && proof.request.includes('night-shop') && proof.request.includes(proof.draftRestored) && proof.errors.length === 0;
} catch (error) {
  proof.failure = error.stack;
  await page.screenshot({ path: resolve(out, 'failure.png') }).catch(() => {});
} finally {
  writeFileSync(resolve(out, 'proof.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({ passed: proof.passed ?? false, failure: proof.failure, errors: proof.errors }));
  await browser.close();
}
if (!proof.passed) process.exitCode = 1;
