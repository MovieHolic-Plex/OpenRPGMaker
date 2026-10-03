// Browser evidence for the actual shared onboarding components. No AI calls or project writes.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const base = process.env.FIRST_WORLD_CAPTURE_URL ?? 'http://127.0.0.1:9813';
const folder = process.env.FIRST_WORLD_CAPTURE_DIR ?? 'verify-shots/first-world-arrival';
mkdirSync(folder, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [], missing = [], results = [];
const sentence = '하늘섬에서 작은 몬스터와 친구가 되어 함께 떠나는 모험';

function observe(page) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && response.url().includes('/assets/project-interview/')) missing.push(response.url());
  });
}
async function isolatedPage(viewport = { width: 1440, height: 900 }, query = '') {
  const page = await browser.newPage({ viewport }); observe(page);
  await page.route('**/__first_world_capture*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="root" class="start-app"></main></body></html>' }));
  await page.goto(`${base}/__first_world_capture${query}`);
  return page;
}
async function launch(page, entries = [], shouldCreate = false) {
  await page.evaluate(async ({ entries, shouldCreate }) => {
    // Boot the production entry so i18n and the UI use the same Vite module instance after HMR.
    document.getElementById('root').id = 'start-app';
    window.createCalls = [];
    window.oprn = { start: {
      recentProjects: async () => entries,
      suggestProjectDir: async ({ title }) => ({ root: '/games', projectDir: '/games/' + title }),
      createProject: async args => { window.createCalls.push(args); return shouldCreate ? { projectDir: args.projectDir } : null; },
    } };
    await import('/src/start/startScreen.ts');
  }, { entries, shouldCreate });
}
async function sceneReady(page) {
  await page.locator('.first-world-scene.is-visible').evaluate(image => image.decode());
  await page.waitForFunction(() => {
    const scene = document.querySelector('.first-world-scene.is-visible');
    return scene && Number(getComputedStyle(scene).opacity) >= .99;
  });
}
async function capture(page, name) { await page.screenshot({ path: `${folder}/${name}.png` }); }
async function layout(page) {
  return page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    controlsOutside: [...document.querySelectorAll('.first-world-arrival button,.first-world-arrival textarea')].filter(node => {
      const r = node.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1);
    }).map(node => node.getAttribute('data-testid')),
  }));
}
async function fullWindowScene(page) {
  const bounds = await page.locator('.first-world-background').evaluate(node => {
    const r = node.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: innerWidth, height: innerHeight };
  });
  assert.equal(bounds.left, 0); assert.equal(bounds.top, 0);
  assert.equal(bounds.right, bounds.width); assert.equal(bounds.bottom, bounds.height);
  return bounds;
}

try {
  const launcher = await isolatedPage(); await launch(launcher);
  await launcher.getByTestId('first-world-arrival').waitFor();
  const launcherScene = await fullWindowScene(launcher);
  assert.equal(await launcher.getByTestId('start-intent-input').isVisible(), false);
  await launcher.locator('.first-world-poster-img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await capture(launcher, '01-launcher');
  await launcher.getByTestId('start-genre-option-monster-collect').click(); await sceneReady(launcher);
  assert.equal(await launcher.getByTestId('start-create').isDisabled(), true);
  assert.equal(await launcher.evaluate(() => window.createCalls.length), 0);
  await launcher.getByTestId('start-intent-input').fill(sentence);
  assert.equal(await launcher.evaluate(() => document.documentElement.scrollHeight <= innerHeight), true);
  await capture(launcher, '02-first-input');
  await launcher.getByTestId('start-genre-option-story-cutscene').click(); await sceneReady(launcher);
  assert.equal(await launcher.getByTestId('start-intent-input').inputValue(), sentence);
  await launcher.getByTestId('start-create').click();
  await launcher.getByTestId('start-error').filter({ hasText: '새 게임 폴더를 만들지 못했습니다.' }).waitFor();
  assert.equal(await launcher.getByTestId('start-intent-input').inputValue(), sentence);
  assert.equal(await launcher.getByTestId('start-create').isEnabled(), true);
  assert.equal(await launcher.getByTestId('start-genre-option-story-cutscene').getAttribute('aria-pressed'), 'true');
  results.push({ launcher: 'preview-only until explicit submit', creationFailureRetainsDraft: true });
  await launcher.getByTestId('start-back').click(); assert.equal(await launcher.locator('.start-example-card').count(), 3);
  assert.equal(await launcher.locator('.start-app.is-first-world').count(), 0);
  await launcher.getByTestId('start-blank-project').click(); assert.match(await launcher.getByTestId('start-create').innerText(), /프로젝트 만들기/);
  await launcher.getByTestId('start-new-game').click();
  assert.equal(await launcher.getByTestId('start-intent-input').inputValue(), sentence);
  const firstLayout = await layout(launcher); assert.equal(firstLayout.width, firstLayout.scrollWidth); assert.deepEqual(firstLayout.controlsOutside, []);

  const handoff = await isolatedPage(); await launch(handoff, [], true);
  await handoff.route('**/index.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>Handoff inspection</body></html>' }));
  await handoff.getByTestId('start-genre-option-monster-collect').click();
  await handoff.getByTestId('start-intent-input').fill(sentence);
  await handoff.locator('.start-arrival-settings summary').click();
  await handoff.getByTestId('start-title-input').fill('내 첫 하늘섬');
  await handoff.getByTestId('start-location').filter({ hasText: '/games/내 첫 하늘섬' }).waitFor();
  await handoff.getByTestId('start-create').click(); await handoff.waitForURL('**/index.html');
  const intent = await handoff.evaluate(() => JSON.parse(sessionStorage.getItem('oprn:start-screen-intent')));
  assert.equal(intent.intent, sentence); assert.equal(intent.choiceId, 'monster-collect'); assert.equal(intent.title, '내 첫 하늘섬'); assert.equal(intent.startMode, 'ai');
  results.push({ launcherHandoff: { choiceId: intent.choiceId, title: intent.title, originalSentence: intent.intent }, bridge: 'isolated callback, no SQLite folder written' });

  const welcome = await isolatedPage({ width: 1440, height: 900 });
  await welcome.evaluate(async () => {
    await import('/src/styles/index.css'); document.getElementById('root').className = '';
    const { presentEditorWelcome } = await import('/src/editor/editorWelcome.ts');
    window.gateCalls = []; window.saves = []; window.connectNext = false;
    void presentEditorWelcome(document.getElementById('root'), {
      ensureAiConnected: async label => { window.gateCalls.push(label); return window.connectNext; },
      canGenerate: () => true,
      applySystemPreset: async (plan, brief) => { window.saves.push({ plan, brief }); },
    }).then(result => { window.welcomeResult = result; });
  });
  await welcome.getByTestId('editor-welcome-template-card-0').click(); await sceneReady(welcome);
  const editorScene = await fullWindowScene(welcome);
  assert.equal(await welcome.evaluate(() => window.gateCalls.length), 0);
  await welcome.getByTestId('editor-welcome-prompt-input').fill(sentence);
  await welcome.getByTestId('editor-welcome-prompt-submit').click();
  await welcome.waitForFunction(() => window.gateCalls.length === 1 && !document.querySelector('.first-world-input').disabled);
  assert.equal(await welcome.getByTestId('editor-welcome-prompt-input').inputValue(), sentence);
  assert.equal(await welcome.getByTestId('editor-welcome-template-card-0').getAttribute('aria-pressed'), 'true');
  assert.equal(await welcome.evaluate(() => window.saves.length), 0);
  await capture(welcome, '03-editor-arrival');
  await welcome.evaluate(() => { window.connectNext = true; });
  await welcome.getByTestId('editor-welcome-prompt-submit').click();
  await welcome.getByTestId('project-interview-concept').waitFor();
  assert.equal(await welcome.getByTestId('project-interview-concept').inputValue(), sentence);
  await welcome.getByTestId('project-interview-cancel').click();
  await welcome.getByTestId('editor-welcome-prompt-input').waitFor();
  assert.equal(await welcome.getByTestId('editor-welcome-prompt-input').inputValue(), sentence);
  assert.equal(await welcome.evaluate(() => window.saves.length), 0);
  results.push({ editor: 'connection and interview cancellation retain the exact draft', selectionGateCalls: 0 });
  await welcome.getByTestId('editor-welcome-prompt-submit').click();
  await welcome.getByTestId('project-interview-genre-adventure').click();
  await welcome.getByTestId('project-interview-begin').click();
  for (const i of [0, 1, 0, 1, 0]) { await welcome.getByTestId(`project-interview-option-${i}`).click(); await welcome.getByTestId('project-interview-next').click(); }
  await welcome.getByTestId('project-interview-confirm').click();
  await welcome.waitForFunction(() => window.welcomeResult !== undefined);
  const completed = await welcome.evaluate(() => ({ saves: window.saves, result: window.welcomeResult }));
  assert.equal(completed.saves.length, 1); assert.equal(completed.saves[0].brief.interview.concept, sentence);
  assert.equal(completed.saves[0].plan.packId, 'adventure-jrpg'); assert.equal(completed.result.presetId, 'adventure-jrpg');
  results.push({ confirmedGenreHandoff: completed.result.presetId, originalConcept: completed.saves[0].brief.interview.concept });

  await welcome.evaluate(async () => {
    const { presentEditorWelcome } = await import('/src/editor/editorWelcome.ts');
    window.manualCalls = []; window.manualGateCalls = 0;
    void presentEditorWelcome(document.getElementById('root'), {
      ensureAiConnected: async () => { window.manualGateCalls++; return true; },
      applySystemPreset: async plan => {
        window.manualCalls.push(plan);
        await new Promise(resolve => { window.releaseManualSave = resolve; });
      },
    }).then(result => { window.manualResult = result; });
  });
  await welcome.getByTestId('editor-welcome-starter-card-0').click();
  await welcome.getByTestId('app-modal-cancel').click();
  assert.equal(await welcome.evaluate(() => window.manualCalls.length), 0);
  await welcome.getByTestId('editor-welcome-starter-card-0').click();
  await welcome.getByTestId('app-modal-confirm').click();
  await welcome.waitForFunction(() => window.manualCalls.length === 1);
  assert.equal(await welcome.getByTestId('editor-welcome-skip').isDisabled(), true);
  await welcome.keyboard.press('Escape');
  assert.equal(await welcome.getByTestId('editor-welcome').count(), 1);
  assert.equal(await welcome.evaluate(() => window.manualResult === undefined && window.manualGateCalls === 0), true);
  await welcome.evaluate(() => window.releaseManualSave());
  await welcome.waitForFunction(() => window.manualResult !== undefined);
  assert.equal(await welcome.evaluate(() => window.manualResult.source), 'manual-system-preset');
  assert.equal(await welcome.getByTestId('editor-welcome').count(), 0);
  results.push({ manualStart: 'cancel does not apply; confirmed save blocks Escape until completion', aiGateCalls: 0 });

  const mobile = await isolatedPage({ width: 320, height: 780 }); await mobile.emulateMedia({ reducedMotion: 'reduce' }); await launch(mobile);
  await mobile.getByTestId('start-genre-option-adventure-jrpg').click(); await sceneReady(mobile);
  await mobile.getByTestId('start-intent-input').fill(sentence); await capture(mobile, '04-mobile');
  const mobileScene = await fullWindowScene(mobile);
  const mobileLayout = await layout(mobile); assert.equal(mobileLayout.width, mobileLayout.scrollWidth); assert.deepEqual(mobileLayout.controlsOutside, []);
  assert.equal(await mobile.locator('.first-world-arrival').evaluate(node => node.classList.contains('is-still')), true);
  assert.equal(await mobile.locator('.first-world-film').evaluate(video => video.paused), true);
  const focused = await mobile.getByTestId('start-intent-input').evaluate(node => ({ outline: getComputedStyle(node).outlineStyle, height: node.getBoundingClientRect().height }));
  assert.notEqual(focused.outline, 'none'); assert.ok(focused.height >= 44);
  results.push({ mobile: mobileLayout, reducedMotion: true, focusVisible: true });

  const returning = await isolatedPage(); await launch(returning, [{ projectDir: '/games/existing', title: '기존 게임', cover: '/assets/region-references/lake-village.png' }]);
  await returning.getByTestId('start-continue-open').waitFor(); assert.equal(await returning.getByTestId('first-world-arrival').count(), 0);
  assert.equal(await returning.locator('.start-app.is-first-world').count(), 0);
  results.push({ returningAuthor: 'recent project remains the primary continue action' });

  for (const locale of ['en', 'ja', 'zh']) {
    const localized = await isolatedPage({ width: 1024, height: 900 }, '?lang=' + locale); await launch(localized);
    await localized.getByTestId('start-genre-option-monster-collect').click();
    await localized.getByTestId('first-world-example').click();
    await localized.waitForFunction(() => !/[\uac00-\ud7a3]/u.test(document.querySelector('.first-world-content').innerText));
    const sample = await localized.getByTestId('start-intent-input').inputValue(); assert.equal(/[\uac00-\ud7a3]/u.test(sample), false);
    if (locale === 'en') await capture(localized, '05-english');
    results.push({ locale, translatedChromeAndExample: true });
  }
  const wide = await isolatedPage({ width: 1920, height: 1080 }); await launch(wide);
  await wide.getByTestId('start-genre-option-story-cutscene').click(); await sceneReady(wide);
  await wide.getByTestId('start-intent-input').fill('눈 내리는 마을에서 잃어버린 기억을 찾아가는 두 사람의 이야기');
  const wideScene = await fullWindowScene(wide);
  const primary = await wide.getByTestId('start-create').boundingBox();
  assert.ok(primary && primary.y >= 0 && primary.y + primary.height <= 1080);
  await capture(wide, '06-fullscreen-wide');
  const compact = await isolatedPage({ width: 1280, height: 720 }); await launch(compact);
  await compact.getByTestId('start-genre-option-adventure-jrpg').click(); await sceneReady(compact);
  await compact.getByTestId('start-intent-input').fill(sentence);
  const compactScene = await fullWindowScene(compact);
  const compactPrimary = await compact.getByTestId('start-create').boundingBox();
  assert.ok(compactPrimary && compactPrimary.y >= 0 && compactPrimary.y + compactPrimary.height <= 720);
  assert.equal(await compact.evaluate(() => document.documentElement.scrollHeight <= innerHeight), true);
  await capture(compact, '07-fullscreen-compact');
  results.push({ fullWindowScene: { launcher: launcherScene, editor: editorScene, mobile: mobileScene, wide: wideScene, compact: compactScene }, widePrimaryInViewport: true, compactPrimaryInViewport: true });
  assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  writeFileSync(`${folder}/browser.json`, JSON.stringify({ kind: 'actual-production-components-in-isolation', results, errors, missing,
    limitations: ['No live AI calls', 'Launcher bridge and preset-save callbacks are isolated; no canonical SQLite content writes', 'No local vitest, gates, or full typecheck run'] }, null, 2));
  console.log(JSON.stringify({ cases: results.length, errors, missing, folder }));
} finally { await browser.close(); }
