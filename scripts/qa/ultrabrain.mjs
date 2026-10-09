// Isolated browser evidence. No project writes. --live uses the existing OAuth companion.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:9816';
const live = process.argv.includes('--live');
const out = resolve('output/evidence/ultrabrain');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let request;
  const requests = [];
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.pathname.endsWith('/chat/completions') && req.method() === 'POST') {
      request = req.postDataJSON();
      requests.push(request);
      if (!live) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        model: request.model, image_delivery: [{ messageIndex: 1, partIndex: 1 }],
        choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify({ harmonious: false, summary: '검증용 지적', findings: ['(0,0) 주변 지형과 연결을 확인하세요.'] }) } }],
      }) });
    }
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost' ? route.continue() : route.abort();
  });
  await page.goto(`${baseUrl}/?blankProject=1`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const { openAiSettingsModal } = await import('/src/editor/panels/aiSettingsModal.ts');
    openAiSettingsModal();
  });
  const model = page.getByTestId('ai-config-ultrabrain-model');
  if (await model.inputValue() !== 'gemini-3.8-flash') throw new Error('Wrong default');
  await model.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/settings.png` });
  await model.fill('gemini-3.6-flash'); await model.dispatchEvent('change');
  await page.getByTestId('ai-config-ultrabrain-reasoning').selectOption('medium', { force: true });
  // The writer's autonomy dial must not overwrite the reviewer's effort.
  await page.getByTestId('ai-config-autonomy').selectOption('balanced', { force: true });
  await page.evaluate(async () => {
    const m = await import('/src/editor/panels/aiSettingsModal.ts'); m.closeAiSettingsModal(); m.openAiSettingsModal();
  });
  const settings = { model: await model.inputValue(), effort: await page.getByTestId('ai-config-ultrabrain-reasoning').inputValue() };
  if (settings.model !== 'gemini-3.6-flash' || settings.effort !== 'medium') throw new Error('Selection was overwritten');
  const roles = [
    ['vision', 'ai-config-vision-model'], ['writer', 'ai-config-model'], ['deep', 'ai-config-lite-model'],
  ];
  for (const [role, field] of roles) {
    await page.getByTestId(field).fill(`explicit-${role}-model`);
    await page.getByTestId(field).dispatchEvent('change');
    await page.getByTestId(`ai-config-${role}-reasoning`).selectOption('low', { force: true });
  }
  await page.getByTestId('ai-config-autonomy').selectOption('balanced', { force: true });
  await page.evaluate(async () => {
    const m = await import('/src/editor/panels/aiSettingsModal.ts'); m.closeAiSettingsModal(); m.openAiSettingsModal();
  });
  for (const [role, field] of roles) {
    if (await page.getByTestId(field).inputValue() !== `explicit-${role}-model`
      || await page.getByTestId(`ai-config-${role}-reasoning`).inputValue() !== 'low') throw new Error(`${role} overwritten`);
  }
  await page.getByTestId('ai-config-lite-model').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/specialists.png` });
  const result = await page.evaluate(async () => {
    const [{ createBlankProject }, { defaultAiConfig }, { reviewMapHarmony }] = await Promise.all([
      import('/src/project/defaults.ts'), import('/src/ai/llmClient.ts'), import('/src/ai/ultrabrainReview.ts'),
    ]);
    const before = createBlankProject(), after = structuredClone(before);
    const map = Object.values(after.maps)[0];
    map.lowerTiles[0] = map.lowerTiles[0] === 0 ? 1 : 0;
    return reviewMapHarmony(before, after, '단위 검증용 맵입니다. 화면에서 확인되는 전체 조화만 평가하세요.', defaultAiConfig(), { signal: AbortSignal.timeout(60000) });
  });
  if (requests.length !== 2 || !requests[0].messages[0].content.includes('You are Vision')) throw new Error('Missing Vision phase');
  const images = request.messages.flatMap(m => Array.isArray(m.content) ? m.content : []).filter(p => p.type === 'image_url');
  if (request.model !== 'gemini-3.8-flash' || request.reasoning?.effort !== 'high' || images.length !== 1 || result.length !== 1) throw new Error('Review routing mismatch');
  writeFileSync(`${out}/review-input.png`, Buffer.from(images[0].image_url.url.split(',')[1], 'base64'));
  const report = { live, settings, specialistRoundtrip: true, roles: requests.map(r => ({ model: r.model, reasoning: r.reasoning })), sent: { model: request.model, reasoning: request.reasoning, imageCount: images.length }, result };
  writeFileSync(`${out}/${live ? 'live' : 'browser'}-review.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
