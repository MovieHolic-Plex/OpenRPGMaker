// Capture the real quest creation UI without sending to an LLM or changing a project.
// node scripts/qa/quest-presets-ui.mjs http://127.0.0.1:<worktree-port>
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
const base = process.argv[2];
if (!base) throw new Error('Supply this worktree’s editor URL.');
const output = resolve('verify-shots/quest-library');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const evidence = { errors: [], checks: [], screenshots: [] };
const check = (label, ok) => { assert.ok(ok, label); evidence.checks.push(label); };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => evidence.errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('oprn:editor-ui-mode', 'expert');
    localStorage.setItem('oprn:coachmarks-basic-v1', '1');
  });
  await page.goto(`${base}/?blankProject=1&lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('ai-input').waitFor({ timeout: 180000 }).catch(async cause => {
    await page.screenshot({ path: resolve(output, 'boot-failure.png') });
    console.log(JSON.stringify({ errors: evidence.errors, screen: (await page.locator('body').innerText()).slice(0,2000) }));
    throw cause;
  });
  console.log('Editor ready');
  const open = async () => {
    await page.getByTestId('ai-command-menu-toggle').click();
    await page.getByTestId('feature16-open-quests-composer').click();
    await page.getByTestId('quest-presets').waitFor();
  };
  const shot = async name => {
    await page.screenshot({ path: resolve(output, name), animations: 'disabled' });
    await page.getByRole('dialog', { name: '퀘스트 만들기', exact: true }).screenshot({ path: resolve(output, name.replace('.png','-dialog.png')), animations: 'disabled' });
    evidence.screenshots.push(name);
  };
  await open();
  console.log('Quest dialog opened');
  check('Dedicated quest dialog is labeled', await page.getByRole('dialog', { name: '퀘스트 만들기', exact: true }).count() === 1);
  check('Unrelated authoring tabs are hidden', await page.getByTestId('feature16-tab-inspector').count() === 0);
  check('Preset has an editable story to start from', (await page.getByTestId('quest-preset-idea').inputValue()).includes('촌장'));
  await page.getByTestId('feature16-quest-gold').fill('250');
  await page.getByTestId('quest-preset-idea').fill('빵집 주인이 등대지기에게 따뜻한 빵을 전해 달라고 부탁한다.');
  check('Story updates the live preview', (await page.getByTestId('quest-preset-preview-story').innerText()).includes('등대지기'));
  check('Reward updates the live preview', await page.getByTestId('quest-preset-preview-gold').innerText() === '250 G');
  await page.getByTestId('feature16-quest-lost_item').click();
  check('New type has its own initial story', (await page.getByTestId('quest-preset-idea').inputValue()).includes('목걸이'));
  check('New type has its own initial reward', await page.getByTestId('feature16-quest-gold').inputValue() === '100');
  await page.getByTestId('feature16-quest-sample-1').click();
  check('Sample inserts a full editable story', (await page.getByTestId('quest-preset-idea').inputValue()).includes('할머니'));
  await page.getByTestId('feature16-quest-reward-300').click();
  check('Quick reward selection updates preview', await page.getByTestId('quest-preset-preview-gold').innerText() === '300 G');
  await page.getByTestId('feature16-quest-errand').click();
  check('Switching back preserves custom story', (await page.getByTestId('quest-preset-idea').inputValue()).includes('등대지기'));
  check('Switching back preserves custom reward', await page.getByTestId('feature16-quest-gold').inputValue() === '250');
  check('All 28 configurations are reachable', await page.locator('.ai-quest-choices button').count() === 28);
  const ids = await page.locator('.ai-quest-choices button').evaluateAll(nodes => nodes.map(n => n.dataset.preset));
  for (const id of ids) {
    await page.getByTestId(`feature16-quest-${id}`).click();
    check(`${id}: selected and preview populated`, await page.getByTestId(`feature16-quest-${id}`).getAttribute('aria-pressed') === 'true' && await page.getByTestId('quest-preset-flow').locator('li').count() >= 3);
  }
  await page.getByTestId('feature16-quest-search').fill('교환');
  check('Search narrows to trading chain', await page.locator('.ai-quest-choices button:visible').count() === 1);
  await page.getByTestId('feature16-quest-trade_chain').click();
  await shot('trade-chain.png');
  await page.getByTestId('feature16-quest-search').fill('nothing_matches');
  check('Empty search is explained', await page.getByText('검색 결과가 없습니다.', {exact:true}).count() === 1);
  await page.getByTestId('feature16-quest-search').fill('');
  await page.getByTestId('quest-preset-category').selectOption('선택과 관계');
  check('Category shows three choice and relationship presets', await page.locator('.ai-quest-choices button:visible').count() === 3);
  await page.getByTestId('feature16-quest-alternate_solution').click();
  await shot('alternate-solution.png');
  await page.getByTestId('quest-preset-category').selectOption('');
  await page.getByTestId('feature16-quest-story_chain').click();
  await shot('story-chain.png');
  await page.getByTestId('feature16-quest-custom').click();
  await page.getByTestId('quest-preset-builder').locator('summary').click();
  await page.getByTestId('feature16-quest-step-add').click();
  const stepSelects = page.locator('.ai-quest-builder-row select');
  await stepSelects.nth(3).selectOption('escort');
  await page.getByTestId('feature16-quest-step-up-3').click();
  check('Builder updates goal order', await stepSelects.nth(2).inputValue() === 'escort');
  check('Builder immediately updates preview', (await page.getByTestId('quest-preset-flow').innerText()).includes('인물과 동행'));
  await shot('custom-sequence.png');
  await page.getByTestId('feature16-quest-gold').fill('-1');
  await page.getByTestId('feature16-quest-apply').click();
  check('Invalid reward blocks handoff and explains the bounds', (await page.getByTestId('quest-preset-error').innerText()).includes('정수'));
  await page.getByTestId('feature16-quest-gold').fill('150');
  await page.getByTestId('feature16-quest-apply').click();
  const request = await page.getByTestId('ai-input').inputValue();
  check('Handoff keeps selected type', request.includes('def.presetId="custom"') && request.includes('["talk","inspect","escort","deliver"]'));
  check('Handoff keeps reward', request.includes('150G'));
  check('Handoff closes dialog and focuses composer', await page.getByTestId('ai-input').evaluate(node => document.activeElement === node));
  console.log('Stories, drafts, rewards and handoff checked');
  // The full editor's supported desktop floor is 1024px. A sub-floor editor
  // canvas may have a zero-sized WebGL framebuffer, unrelated to this dialog.
  for (const [width, height] of [[1024, 768]]) {
    await page.setViewportSize({ width, height });
    await open();
    await page.getByTestId('feature16-quest-lost_item').click();
    const fit = await page.getByRole('dialog', { name: '퀘스트 만들기', exact: true }).evaluate(root => {
      const nodes = [root, ...root.querySelectorAll('button,input,textarea')].filter(node => node.getClientRects().length);
      const b = root.getBoundingClientRect();
      const action = root.querySelector('[data-testid="feature16-quest-apply"]').getBoundingClientRect();
      return { width: window.innerWidth, dialog: { left: b.left, right: b.right, bottom: b.bottom }, action: { top: action.top, bottom: action.bottom }, fits: nodes.every(node => { const r = node.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth; }) };
    });
    check(`Controls fit ${width}px viewport`, fit.fits);
    check(`Primary action visible at ${width}px`, fit.action.top >= 0 && fit.action.bottom <= height);
    await page.getByTestId('feature16-close').focus();
    await shot(`width-${width}.png`);
    await page.keyboard.press('Escape');
    check(`Escape closes the modal at ${width}px`, await page.getByTestId('quest-presets').count() === 0);
  }
  check(`No browser errors: ${JSON.stringify(evidence.errors)}`, evidence.errors.length === 0);
  await writeFile(resolve(output, 'ui-evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ checks: evidence.checks.length, errors: evidence.errors, output }));
} finally { await browser.close(); }
