// Real production UI modules; no live model calls or authored project writes.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.env.INTERVIEW_CAPTURE_URL ?? 'http://127.0.0.1:9812';
const folder = 'verify-shots/cinematic-interview';
mkdirSync(folder, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [], missing = [], results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && r.url().includes('/assets/project-interview/')) missing.push(r.url()); });
  await page.route('**/__cinematic_capture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><button id="opener">새 게임 만들기</button><div id="root"></div></body></html>' }));
  await page.goto(`${base}/__cinematic_capture`);
  await page.evaluate(async () => { await import('/src/styles/index.css'); });
  const open = async (genre = 'story-cutscene', initialBrief) => page.evaluate(async ({ genre, initialBrief }) => {
    document.getElementById('opener').focus();
    const { showProjectInterview } = await import('/src/editor/ui/projectInterviewDialog.ts');
    window.result = undefined;
    void showProjectInterview(genre, { initialBrief }).then(result => { window.result = result; });
  }, { genre, initialBrief });
  const pick = async index => { await page.getByTestId(`project-interview-option-${index}`).click(); await page.getByTestId('project-interview-next').click(); };
  const capture = async name => {
    await page.locator('.ci-backdrop img.is-visible').evaluate(async img => img.decode());
    await page.screenshot({ path: `${folder}/${name}.png` });
  };
  // Start in the same menu dialog that the application opens, and change the engine during interview.
  await page.evaluate(async () => {
    const { showNewProjectDialog } = await import('/src/editor/ui/newProjectDialog.ts');
    window.menuResult = undefined;
    void showNewProjectDialog({ ensureAiConnected: async () => true }).then(result => { window.menuResult = result; });
  });
  await page.getByTestId('new-project-confirm').click();
  await page.getByTestId('project-interview-genre-romance').click();
  await page.getByTestId('project-interview-secondary').selectOption('monster');
  await page.getByTestId('project-interview-concept').fill('성인 두 사람이 알에서 태어난 생물과 비밀을 풀어가는 이야기');
  await capture('01-genres');
  await page.getByTestId('project-interview-begin').click();
  await page.getByTestId('project-interview-option-2').click();
  await page.locator('.cinematic-interview[data-scene="new:romance-town"]').waitFor();
  await capture('02-romance-scene');
  await page.getByTestId('project-interview-next').click();
  for (const i of [2, 0, 2, 2, 0]) await pick(i);
  await page.getByTestId('project-interview-protagonist').fill('주인공은 사용자가 정한 약사. 이름과 외형은 미정.');
  await page.getByTestId('project-interview-notes').fill('전투 없이 교감과 선택으로 진행');
  assert.equal(await page.getByTestId('project-interview-confirm').isEnabled(), true);
  assert.equal(await page.locator('[data-testid="project-interview"]').getByText(/TODO|작업 명세|내보내기/).count(), 0);
  await capture('03-summary');
  await page.getByTestId('project-interview-summary').fill('약사와 이웃이 부화한 생물을 돌보며 가까워지는 이야기. 첫 만남과 교감 한 장면부터 만든다.');
  await page.getByTestId('project-interview-edit-activity').click();
  await pick(0); for (const i of [0, 1, 1, 0]) await pick(i);
  assert.equal(await page.getByTestId('project-interview-confirm').isDisabled(), true, 'Stale edited summary must block confirmation');
  await page.getByTestId('project-interview-refresh-summary').click();
  await page.getByTestId('project-interview-confirm').click();
  const menu = await page.evaluate(() => window.menuResult);
  assert.equal(menu.choiceId, 'monster-collect');
  assert.equal(menu.gameDesignBrief.interview.genre, 'romance');
  assert.equal(menu.gameDesignBrief.interview.secondary, 'monster');
  assert.match(menu.gameDesignBrief.interview.protagonist, /약사/);
  const contract = await page.evaluate(async brief => {
    const { normalizeGameDesignBrief, gameDesignBriefContext } = await import('/src/project/gameDesignBrief.ts');
    const { welcomeGenrePresetById, buildWelcomeGenrePresetPrompt } = await import('/src/editor/welcomeGenrePresets.ts');
    const loaded = normalizeGameDesignBrief(JSON.parse(JSON.stringify(brief)));
    return { loaded, context: gameDesignBriefContext(loaded), prompt: buildWelcomeGenrePresetPrompt(welcomeGenrePresetById(loaded.presetId), loaded) };
  }, menu.gameDesignBrief);
  assert.deepEqual(contract.loaded, menu.gameDesignBrief);
  assert.match(contract.prompt, /약사/); assert.match(contract.context, /F03/);
  results.push({ menu: { choiceId: menu.choiceId, brief: menu.gameDesignBrief }, roundtrip: true, internalTasks: true, staleSummaryBlocked: true });
  // All four genre question paths, one free-text answer, recommendation source, and reopen.
  for (const genre of ['romance', 'monster', 'adventure', 'mystery']) {
    await open(); await page.getByTestId(`project-interview-genre-${genre}`).click(); await page.getByTestId('project-interview-begin').click();
    await page.getByTestId('project-interview-answer').fill('사용자가 쓴 고유한 첫 장면'); await page.getByTestId('project-interview-next').click();
    await page.getByTestId('project-interview-recommend').click(); await page.getByTestId('project-interview-next').click();
    await pick(0); await pick(1); await pick(2);
    await page.getByTestId('project-interview-confirm').click();
    const result = await page.evaluate(() => window.result);
    assert.equal(result.answers.experience.text, '사용자가 쓴 고유한 첫 장면');
    assert.equal(result.answers.activity.source, 'recommended');
    await open(result.presetId, result); assert.equal(await page.getByTestId('project-interview-summary').inputValue(), result.summary);
    await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => window.result), null);
    assert.equal(await page.locator('#opener').evaluate(node => node === document.activeElement), true);
    results.push({ genre, preset: result.presetId, reopened: true, cancelled: true });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 390, height: 844 });
  await open('monster-collect'); await page.getByTestId('project-interview-begin').click();
  await page.getByTestId('project-interview-option-1').click(); await capture('04-mobile');
  const mobile = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, panelWidth: document.querySelector('.cinematic-interview').scrollWidth, videoPaused: document.querySelector('.ci-backdrop video').paused, motion: document.querySelector('.cinematic-interview').classList.contains('is-still') }));
  assert.equal(mobile.width, mobile.documentWidth); assert.equal(mobile.width, mobile.panelWidth); assert.equal(mobile.motion, true); assert.equal(mobile.videoPaused, true);
  await page.keyboard.press('Escape');
  // Welcome poster changes its selected plan and assistant prompt when the interview changes genre.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(async () => {
    const { presentEditorWelcome } = await import('/src/editor/editorWelcome.ts');
    window.welcomeSaves = [];
    void presentEditorWelcome(document.getElementById('root'), {
      applySystemPreset: async (plan, brief) => { window.welcomeSaves.push({ plan, brief }); },
      canGenerate: () => false,
    }).then(result => { window.welcomeResult = result; });
  });
  await page.getByTestId('editor-welcome-template-card-0').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.welcomeSaves.length), 0);
  await page.getByTestId('editor-welcome-template-card-0').click();
  await page.getByTestId('project-interview-genre-mystery').click();
  await page.getByTestId('project-interview-begin').click();
  for (const i of [0, 1, 0, 1, 0]) await pick(i);
  await page.getByTestId('project-interview-confirm').click();
  const welcome = await page.evaluate(() => ({ saves: window.welcomeSaves, result: window.welcomeResult }));
  assert.equal(welcome.saves.length, 1); assert.equal(welcome.saves[0].plan.packId, 'story-cutscene');
  assert.equal(welcome.result.presetId, 'story-cutscene'); assert.match(welcome.result.prompt, /F03/);
  results.push({ welcomeConfirmedEngine: welcome.result.presetId, cancelWrites: 0 });
  // The desktop start surface must route New Game into planning, with explicit example alternatives.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(async () => {
    const { mountStartScreen } = await import('/src/start/startScreen.ts');
    mountStartScreen(document.getElementById('root'), {
      recentProjects: async () => [],
      suggestProjectDir: async () => ({ root: '/games', projectDir: '/games/new' }),
    });
  });
  await page.getByTestId('start-new-game').click();
  assert.match(await page.getByTestId('start-create').innerText(), /게임 기획/);
  assert.equal(await page.getByTestId('start-intent-input').count(), 1);
  await page.getByTestId('start-back').click();
  assert.equal(await page.locator('.start-example-card').count(), 3);
  results.push({ launcherNewGame: 'ai-planning', examplesAccessible: true });
  assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  writeFileSync(`${folder}/browser.json`, JSON.stringify({ kind: 'real-production-components-in-isolation', results, mobile, errors, missing, limitations: ['No live AI generation', 'No canonical project writes; JSON normalization roundtrip only'] }, null, 2));
  console.log(JSON.stringify({ paths: results.length, mobile, errors, missing }));
} finally { await browser.close(); }
