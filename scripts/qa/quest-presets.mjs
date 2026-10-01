// Real editor controls and the registered create_quest tool; no LLM response mocks.
// node scripts/qa/quest-presets.mjs http://127.0.0.1:<worktree-port>
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const base = process.argv[2];
if (!base) throw new Error('Supply this worktree’s running editor URL.');
const output = resolve('verify-shots/quest-presets');
await mkdir(output, { recursive: true });
const fixtureDir = resolve('output/evidence/quest-presets');
await mkdir(fixtureDir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('oprn:editor-ui-mode', 'expert');
    localStorage.setItem('oprn:coachmarks-basic-v1', '1');
  });
  await page.goto(`${base}/?blankProject=1&lang=ko`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('ai-input').waitFor({ timeout: 180000 });
  console.log('Editor ready');
  // Inspect the actual browser archive before modifying the QA fixture.
  const records = await page.evaluate(async () => {
    const { listConversations } = await import('/src/ai/conversationStore.ts');
    return (await listConversations()).map(row => ({ id: row.id, title: row.title }));
  });
  await page.getByTestId('ai-command-menu-toggle').click();
  await page.getByTestId('feature16-open-quests-composer').click();
  await page.getByTestId('quest-presets').waitFor();
  const cases = [
    ['errand', '촌장이 약초꾼에게 내일 시장이 열린다는 소식을 전해 달라고 한다.'],
    ['lost_item', '아이가 우물 근처에서 잃어버린 목걸이를 찾고 있다.'],
    ['hunt', '상인이 숲길을 막고 있는 몬스터 때문에 배달을 못 하고 있다.'],
  ];
  for (const [id, idea] of cases) {
    await page.getByTestId(`feature16-quest-${id}`).click();
    await page.getByTestId('quest-preset-idea').fill(idea);
    assert.equal(await page.getByTestId(`feature16-quest-${id}`).getAttribute('aria-pressed'), 'true');
    await page.screenshot({ path: resolve(output, `${id}.png`) });
  }
  await page.getByTestId('feature16-quest-gold').fill('-1');
  await page.getByTestId('feature16-quest-apply').click();
  assert.match(await page.getByTestId('quest-preset-error').innerText(), /정수/);
  await page.getByTestId('feature16-quest-gold').fill('150');
  await page.getByTestId('feature16-quest-apply').click();
  const request = await page.getByTestId('ai-input').inputValue();
  assert.match(request, /def.presetId="hunt"/);
  assert.match(request, /150G/);
  assert.match(request, /상인이 숲길/);
  assert.equal(await page.getByTestId('quest-presets').count(), 0);
  assert.equal(await page.getByTestId('ai-input').evaluate(node => document.activeElement === node), true);
  console.log('Preset UI, validation, and composer handoff checked');
  await page.screenshot({ path: resolve(output, 'composer.png') });
  // Supported desktop floor: capture and check actual control bounds.
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByTestId('ai-command-menu-toggle').click();
  await page.getByTestId('feature16-open-quests-composer').click();
  await page.getByTestId('feature16-quest-lost_item').click();
  const bounds = await page.getByTestId('feature16-modal').evaluate(root => [...root.querySelectorAll('button,input,textarea')].filter(node => node.getClientRects().length).map(node => { const b = node.getBoundingClientRect(); return { id: node.dataset.testid, left: b.left, right: b.right }; }));
  assert.ok(bounds.every(b => b.left >= 0 && b.right <= 1024), 'Controls fit the desktop floor');
  await page.screenshot({ path: resolve(output, 'desktop-1024.png') });
  await page.getByTestId('feature16-close').click();
  const authored = await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { runTool } = await import('/src/editor/tools/toolRunner.ts');
    const { serialize, deserialize, resolveEventPage } = await import('/src/project/io.ts');
    const { createInterpreter } = await import('/src/player/interpreter.ts');
    const current = store.getCurrent();
    // A QA copy keeps the existing map pixels, and only its required chipset.
    // Hundreds of unused bundled reference documents are not quest test inputs.
    const needed = new Set(Object.values(current.maps).map(map => map.tilesetId));
    for (const id of needed) if (current.tilesets[id]?.referenceSourceTilesetId) needed.add(current.tilesets[id].referenceSourceTilesetId);
    const tilesets = Object.fromEntries([...needed].map(id => {
      const { referenceDocuments, ...definition } = current.tilesets[id];
      return [id, definition];
    }));
    const ctx = { project: structuredClone({ ...current, tilesets }) };
    const mapId = ctx.project.startMapId;
    const itemId = ctx.project.database.items[0].id;
    const troopId = ctx.project.database.troops[0].id;
    const giver = (x, y, name) => ({ create: { mapId, x, y, name, graphicQuery: '청년 남성' } });
    const defs = [
      { key: 'preset_errand', presetId: 'errand', title: '내일의 시장', summary: '약초꾼에게 내일 시장이 열린다는 소식을 전해주세요.', giver: giver(5, 5, '촌장'), steps: [{ kind: 'talk', target: giver(8, 5, '약초꾼'), lines: ['내일은 시장이 열리는군요. 약초를 준비해 둘게요.'] }], rewards: { gold: 100 } },
      { key: 'preset_lost', presetId: 'lost_item', title: '작은 분실물', summary: '우물 근처의 물건을 찾아 돌려주세요.', giver: giver(5, 8, '아이'), steps: [{ kind: 'collect', itemId, count: 1, sources: [{ kind: 'pickup', mapId, x: 8, y: 8, lookText: '우물 근처에서 무언가 반짝인다.' }] }], rewards: { gold: 100 } },
      { key: 'preset_hunt', presetId: 'hunt', title: '숲길의 위협', summary: '길을 막는 적을 물리치고 돌아와 주세요.', giver: giver(11, 5, '상인'), steps: [{ kind: 'kill', troopId, at: { mapId, x: 14, y: 5, graphicQuery: '청년 남성', intro: ['이 길을 지나가려면 먼저 싸워야 한다!'] } }], rewards: { gold: 150 } },
    ];
    const results = defs.map(def => runTool(ctx, 'create_quest', { def: { ...def, dialogue: { accepted: '고마워요. 기다리고 있을게요.', declined: '괜찮아요. 나중에 다시 와 주세요.', reminder: '부탁한 일은 어떻게 됐나요?', completed: '정말 고마워요! 약속한 보상이에요.', afterComplete: '덕분에 마음이 놓였어요.' } } }, { dryRun: false }));
    const invalid = runTool(ctx, 'create_quest', { def: { ...defs[0], key: 'invalid_preset', steps: defs[2].steps } }, { dryRun: false });
    const round = deserialize(serialize(ctx.project));
    const checks = [];
    if (results.every(result => result.ok)) {
      for (const def of defs) {
        const session = { ...structuredClone(round.session), currentMapId: mapId, gold: 0, inventory: {}, selfSwitches: {}, switches: {}, variables: {} };
        const started = `sw_${def.key}_started`, done = `sw_${def.key}_done`, step = `sw_${def.key}_step0`;
        const eventId = def.presetId === 'errand' ? `ev_${def.key}_talk0` : def.presetId === 'lost_item' ? `ev_${def.key}_pick0_0` : `ev_${def.key}_kill0`;
        const giverId = `ev_${def.key}_giver`;
        const run = (id, choice = 0, battle = 'victory') => {
          const event = round.maps[mapId].events.find(event => event.id === id);
          const page = resolveEventPage(event, session);
          const interpreter = createInterpreter(page.commands, session, round, { currentEventId: id });
          let result = interpreter.start();
          const text = [];
          for (let i = 0; result.kind !== 'done' && i < 100; i++) {
            if (result.kind === 'text') text.push(result.body);
            if (result.kind === 'battleProcessing') session.battleResult = battle;
            result = interpreter.resume(result.kind === 'choices' ? choice : result.kind === 'battleProcessing' ? battle : undefined);
          }
          if (result.kind !== 'done') throw new Error('Interpreter did not finish');
          return text;
        };
        const check = (name, ok) => { checks.push({ presetId: def.presetId, name, ok: Boolean(ok) }); if (!ok) throw new Error(`${def.presetId}: ${name}`); };
        run(eventId);
        check('objective blocked before acceptance', !session.switches[step]);
        run(giverId, 1);
        check('decline leaves quest inactive', !session.switches[started]);
        run(giverId);
        check('acceptance starts quest', session.switches[started]);
        run(giverId);
        check('early report gives no reward', session.gold === 0 && !session.switches[done]);
        if (def.presetId === 'hunt') {
          run(eventId, 0, 'escape');
          check('escaping does not complete objective', !session.switches[step]);
        }
        run(eventId);
        check('objective completes', session.switches[step]);
        if (def.presetId === 'lost_item') {
          check('pickup grants one item', session.inventory[itemId] === 1);
          // Inventory loss is an explicit contract probe, not a claimed playthrough.
          session.inventory[itemId] = 0;
          run(giverId);
          check('cannot return an absent item', session.gold === 0 && !session.switches[done]);
          session.inventory[itemId] = 1;
        }
        run(giverId);
        check('report rewards exactly once', session.gold === def.rewards.gold && session.switches[done]);
        if (def.presetId === 'lost_item') check('report returns the item', !session.inventory[itemId]);
        const after = run(giverId);
        check('repeat report gives no second reward', session.gold === def.rewards.gold);
        check('completion dialogue changes', after.includes('덕분에 마음이 놓였어요.'));
        run(eventId);
        check('repeated objective does not add progress', session.variables[`var_${def.key}_progress`] === 1);
      }
    }
    return { results: results.map(r => ({ ok: r.ok, issues: r.issues, summary: r.summary })), checks, invalidRejected: !invalid.ok, questIds: (round.quests ?? []).map(q => ({ key: q.key, presetId: q.presetId, dialogue: q.dialogue })), project: JSON.parse(serialize(round)) };
  });
  assert.ok(authored.results.every(result => result.ok), JSON.stringify(authored.results));
  assert.ok(authored.invalidRejected);
  assert.equal(authored.questIds.length, 3);
  await writeFile(resolve(fixtureDir, 'project.json'), JSON.stringify(authored.project));
  delete authored.project;
  await writeFile(resolve(output, 'evidence.json'), JSON.stringify({ records, errors, request, bounds, authored }, null, 2));
  assert.deepEqual(errors, []);
  console.log('All three registered tool presets and serialization checked');
} finally { await browser.close(); }
