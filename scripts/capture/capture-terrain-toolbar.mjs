// Actual terrain dock, modal and painting gestures in an isolated editor fixture.
import { chromium, firefox } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { startEditorScreencast } from './editor-screencast.mjs';

const out = resolve(process.env.TERRAIN_TOOLBAR_OUTPUT ?? 'verify-shots/terrain-toolbar');
mkdirSync(out, { recursive: true });
const useFirefox = process.env.TERRAIN_TOOLBAR_BROWSER === 'firefox';
const browser = useFirefox ? await firefox.launch() : await chromium.launch({ args: ['--no-proxy-server', '--js-flags=--max-old-space-size=12288'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [], proof = { isolatedFixture: true, canonicalContentChanged: false };
let rejectBootNetwork;
page.on('requestfailed', r => { const error = r.failure()?.errorText; if (error === 'net::ERR_NETWORK_CHANGED') rejectBootNetwork?.(new Error('Transient browser network change')); if (error !== 'net::ERR_ABORTED') console.log('requestfailed',r.url().slice(0,180),error); });
page.on('pageerror', e => { errors.push(e.message); console.log('pageerror', e.message); });
const assert = (value, message) => { if (!value) throw new Error(message); };
const pause = (ms = 500) => page.waitForTimeout(ms);
const shot = name => page.screenshot({ path: resolve(out, `${name}.png`) });
const state = () => page.evaluate(async () => (await import('/src/editor/editorState.ts')).editorState.get());
const point = (x, y) => page.evaluate(async ({ x, y }) => {
  const { terrainHeight } = await import('/src/project/terrainGameplay.ts');
  const p = window.__oprnEditorStore.getCurrent(), m = p.maps[p.startMapId];
  return window.__oprnEditWorldToClient((x + .5) * 16, (y + .5 - terrainHeight(m, x, y)) * 16);
}, { x, y });
const drag = async (path) => {
  const first = await point(...path[0]);
  await page.mouse.move(first.x, first.y); await page.mouse.down();
  for (const at of path.slice(1)) { const p = await point(...at); await page.mouse.move(p.x, p.y, { steps: 16 }); await pause(150); }
  await page.mouse.up(); await pause();
};
let film;
try {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const networkChange = new Promise((_, reject) => { rejectBootNetwork = reject; });
      await Promise.race([networkChange, (async () => {
        await page.goto(`${process.env.TERRAIN_TOOLBAR_URL ?? 'http://127.0.0.1:9833'}/?blankProject=1`, { waitUntil: 'load', timeout: 120000 });
        console.log('Loaded; waiting for editor');
        await page.waitForFunction(() => window.__oprnEditorStore && window.__oprnEditWorldToClient, null, { timeout: 240000 });
        await page.getByTestId('boot-loader').waitFor({ state: 'hidden', timeout: 120000 });
      })()]);
      rejectBootNetwork = undefined; break;
    } catch (error) {
      if (error.message !== 'Transient browser network change' || attempt === 3) throw error;
      console.log('Retrying interrupted module load', attempt);
      rejectBootNetwork = undefined;
      await page.goto('about:blank'); await pause(1000);
      errors.length = 0;
    }
  }
  proof.aiRecords = await page.evaluate(async () => {
    if (!(await indexedDB.databases()).some(d => d.name === 'oprn-ai-records')) return { databasePresent: false };
    const db = await new Promise((yes, no) => { const r = indexedDB.open('oprn-ai-records'); r.onsuccess = () => yes(r.result); r.onerror = () => no(r.error); });
    const counts = {};
    for (const name of db.objectStoreNames) counts[name] = await new Promise((yes, no) => { const r = db.transaction(name).objectStore(name).count(); r.onsuccess = () => yes(r.result); r.onerror = () => no(r.error); });
    db.close(); return counts;
  });
  await page.evaluate(async () => {
    const { createBlankMap } = await import('/src/project/defaults/defaultMaps.ts');
    const st = window.__oprnEditorStore, p = st.getCurrent(), m = createBlankMap('지형 도구 · 아이콘과 도움말', 40, 30);
    m.id = p.startMapId;
    if (m.tilesetId !== 'beodeul_city') throw new Error('Native default changed');
    st.update(d => { d.tilesets = { [m.tilesetId]: d.tilesets[m.tilesetId] }; d.maps = { [m.id]: m }; d.startMapId = m.id; d.startPos = { x: 5, y: 22 }; }, { scope: 'project', label: '격리 UI 확인 지도' });
  });
  await pause(1500);
  await page.locator('[data-testid="layer-relief"]:visible').first().click();
  await page.evaluate(async () => {
    const { editorState } = await import('/src/editor/editorState.ts'), { requestEditorCameraFocus } = await import('/src/editor/editorCameraFocus.ts');
    const p = window.__oprnEditorStore.getCurrent();
    editorState.set({ tool: 'relief', layer: 'lower', currentMapId: p.startMapId, zoom: 1, showGrid: false, terrainBrush: 'height', terrainDesignOpen: false, terrainSymmetry: 'none', terrainVisionPreview: false });
    requestEditorCameraFocus({ mapId: p.startMapId, tileX: 20, tileY: 15, immediate: true });
  });
  await pause(1200);
  proof.icons = await page.getByTestId('relief-brush-controls').locator('button').evaluateAll(nodes => nodes.map(n => ({ id: n.dataset.testid, label: n.getAttribute('aria-label'), text: n.textContent, svg: n.querySelectorAll('svg').length })));
  assert(proof.icons.length === 10 && proof.icons.every(n => n.svg === 1 && !n.text && n.label), 'Dock contains unnamed or text buttons');
  await shot('01-height-dock');
  film = useFirefox ? { caption: async text => { console.log(text); await pause(300); }, stop: async () => ({ browser: 'firefox', recorded: false }) } : await startEditorScreencast(page, out, 'terrain-toolbar-2x.mp4', { selector: 'body', cropTop: 0, speed: 2 });
  await film.caption('도구는 아이콘으로 · 선택한 도구 설정만 위에 표시');
  await page.getByTestId('terrain-tool-surface').click(); await pause();
  assert(await page.getByTestId('terrain-material').isVisible() && !await page.getByTestId('relief-mode-raise').isVisible(), 'Surface retained height settings');
  await shot('02-surface-dock');
  await page.getByTestId('terrain-tool-river').focus(); await pause(200);
  assert((await page.getByTestId('delayed-tooltip').innerText()).includes('강'), 'Keyboard tooltip missing');
  await page.getByTestId('terrain-tool-house').click(); await pause(600);
  assert(await page.getByTestId('terrain-design-panel').isVisible(), 'House did not open options');
  proof.nativeHouseStyles = await page.locator('[data-house-style]').count();
  assert(proof.nativeHouseStyles === 6, 'Beodeul house styles missing');
  await film.caption('집·도로 설정은 필요할 때 열기 · 버들항 기본 집 6종 유지');
  await shot('03-native-house');
  await page.getByTestId('terrain-tool-height').click(); await pause();
  assert(!await page.getByTestId('terrain-design-panel').isVisible(), 'Basic tool left design panel open');
  await page.getByTestId('terrain-design-toggle').click(); await pause();
  const beforeHelp = await state();
  await page.getByTestId('terrain-help-toggle').click();
  await film.caption('도움말 모달 · 언덕 → 경사로 → 물·길 → 마을');
  await page.getByTestId('terrain-help-modal').waitFor(); await shot('04-help-order');
  await page.keyboard.press('Shift+Tab');
  assert(await page.getByTestId('terrain-help-dismiss').evaluate(n => n === document.activeElement), 'Focus escaped backward from modal');
  await page.keyboard.press('Tab');
  assert(await page.getByTestId('terrain-help-close').evaluate(n => n === document.activeElement), 'Focus escaped forward from modal');
  await page.keyboard.press('d'); await page.keyboard.press('1'); await page.keyboard.press('Control+z');
  assert((await state()).tool === beforeHelp.tool && (await state()).reliefDoodadOpen === beforeHelp.reliefDoodadOpen, 'Modal keys changed editor tools');
  for (const section of ['land', 'build', 'check']) {
    await page.getByTestId(`terrain-help-${section}`).click(); await pause(300);
    assert(await page.getByTestId(`terrain-help-${section}`).getAttribute('aria-current') === 'true', 'Help navigation state missing');
  }
  assert((await page.getByTestId('terrain-help-modal').innerText()).includes('기본 꺼짐'), 'Vision opt-in guide missing');
  await page.getByTestId('terrain-help-build').click(); await shot('05-help-house-road');
  await page.keyboard.press('Escape'); await pause();
  assert(!await page.getByTestId('terrain-help-modal').count() && await page.getByTestId('terrain-design-panel').isVisible(), 'Escape closed underlying panel');
  assert(await page.getByTestId('terrain-help-toggle').evaluate(n => n === document.activeElement), 'Opener focus not restored');
  await page.getByTestId('terrain-tool-height').click();
  await film.caption('높이 · 산 붓으로 능선을 그리고 평탄 붓으로 윗면 정리');
  await page.getByTestId('relief-mode-mountain').click(); await page.getByTestId('relief-size-M').click();
  await drag([[13, 11], [17, 11], [21, 11]]);
  await page.getByTestId('relief-mode-flatten').click();
  await drag([[17, 11], [19, 11]]);
  proof.relief = await page.evaluate(() => { const p = window.__oprnEditorStore.getCurrent(), m = p.maps[p.startMapId]; return { raised: m.relief?.levels.filter(n => n > 0).length ?? 0, levels: [...new Set(m.relief?.levels ?? [])] }; });
  assert(proof.relief.raised > 40, 'Icon brush did not create terrain'); await shot('06-hill');
  await film.caption('도로는 끌고 놓으면 연결 · 강은 붓 폭만 골라 그리기');
  await page.getByTestId('terrain-tool-road').click(); await page.getByTestId('terrain-design-close').click();
  await drag([[5, 22], [14, 22], [25, 22]]);
  proof.road = await page.evaluate(() => { const p = window.__oprnEditorStore.getCurrent(); return p.maps[p.startMapId].terrainDesign?.features?.filter(f => f.tool === 'road').length ?? 0; });
  assert(proof.road === 1, 'Road icon did not produce road feature');
  await page.getByTestId('terrain-tool-river').click(); await page.getByTestId('terrain-width').selectOption('3');
  await drag([[31, 5], [31, 15], [31, 25]]); await shot('07-terrain-result');
  await page.getByTestId('terrain-reachability').click();
  assert(await page.getByTestId('terrain-reachability').getAttribute('aria-pressed') === 'true', 'Reachability state missing');
  await pause(700); await page.getByTestId('terrain-reachability').click();
  proof.film = await film.stop(); film = null;
  await page.setViewportSize({ width: 1024, height: 768 }); await pause(800);
  await page.getByTestId('terrain-tool-height').click(); await pause();
  proof.compactLayout = await page.getByTestId('relief-brush-controls').locator('button').evaluateAll(nodes => nodes.every(n => { const r = n.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') === n; }));
  assert(proof.compactLayout, 'Compact dock clipped or obscured a control'); await shot('08-compact-dock');
  await page.getByTestId('terrain-help-toggle').click(); await pause(); await shot('09-compact-help');
  await page.mouse.click(5, 5); await pause(200);
  assert(!await page.getByTestId('terrain-help-modal').count(), 'Backdrop did not close help');
  assert(!errors.length, `Browser errors: ${errors.join('; ')}`);
  proof.errors = errors; writeFileSync(resolve(out, 'observations.json'), JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(proof));
} catch (error) {
  await shot('capture-error').catch(() => {}); throw error;
} finally { await browser.close(); }
