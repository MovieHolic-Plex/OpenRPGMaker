// Actual editor + real tool adapter, deterministic model transport. No remote writes.
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const out = resolve('output/evidence/ai-visual-feed'); mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://127.0.0.1:9836';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1560, height: 1100 }, serviceWorkers: 'block' });
page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(120000);
const checks = [], errors = [];
const check = (label, ok) => { checks.push({ label, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) throw new Error(label); };
page.on('pageerror', e => { errors.push(e.message); console.log('BROWSER ERROR', e.message); });
page.on('requestfailed', req => console.log('REQUEST FAILED', req.url(), req.failure()?.errorText)); page.on('dialog', d => d.accept());
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
try {
  await page.addInitScript(() => {
    localStorage.setItem('oprn:editor-ui-mode', 'standard'); localStorage.setItem('oprn:standard-welcome-seen', '1'); localStorage.setItem('oprn:coachmarks-basic-v1', '1'); localStorage.setItem('oprn:editor-welcome-dismissed', '1');
    localStorage.setItem('oprn:ai-config', JSON.stringify({ piApply: 'review', piApplyPolicyVersion: 1, piTeam: true }));
  });
  await page.route('**/rest/v1/**', r => r.fulfill({ json: [] }));
  await page.route('**/__oprn/ai-activity', r => r.fulfill({ json: { ok: true } }));
  await page.route('**/v1/chat/completions', r => r.fulfill({ json: { image_delivery: [{ messageIndex: 1, partIndex: 1 }], choices: [{ message: { role: 'assistant', content: JSON.stringify({ harmonious: true, summary: '확인했습니다.', findings: [] }) }, finish_reason: 'stop' }] } }));
  let proof;
  await page.route('**/v1/agent/run**', async route => {
    const req = route.request().postDataJSON();
    const result = await page.evaluate(async req => {
      const { createPiToolset } = await import('/src/ai/piAgent/toolAdapter.ts');
      const { captureActivityVisuals } = await import('/src/ai/activityVisual.ts');
      const ctx = { project: structuredClone(req.project) };
      const mapId = req.currentMapId ?? req.mapIds?.[0] ?? req.project.startMapId;
      const events = [], records = [];
      let actor = 'builder-1';
      const tools = createPiToolset(ctx, { onCall: record => {
        records.push(record); events.push({ type: 'agent_event', agentId: actor, event: { type: 'tool_end', id: record.toolCallId, name: record.name, ok: record.result.ok, summary: record.result.summary, result: record.result, visuals: record.visuals, durationMs: 180 } });
      } });
      const call = async (id, name, args) => {
        events.push({ type: 'agent_event', agentId: actor, event: { type: 'tool_start', id, name, args } });
        try { await tools.find(t => t.name === name).execute(id, args); } catch (error) { console.log('QA tool outcome', name, String(error)); }
      };
      await call('read-map', 'get_map_region', { mapId, x: 0, y: 0, w: 24, h: 16 });
      await call('road', 'paint_road', { mapId, style: 'dirt', points: [{ x: 3, y: 12 }, { x: 20, y: 12 }], naturalness: 0 });
      const npc = ctx.project.maps[mapId].events.find(e => e.pages?.some(p => p.graphic?.sprite));
      if (npc) await call('npc', 'get_event', { mapId, eventId: npc.id });
      actor = 'artist-1';
      await call('resources', 'list_monster_resources', { query: 'slime', limit: 4 });
      const enemy = ctx.project.database.enemies.find(e => e.monsterResourceId);
      if (enemy) {
        await call('enemy-failed', 'upsert_enemy', { enemy: { id: enemy.id, name: enemy.name, hp: 98 } });
        await call('enemy', 'upsert_enemy', { enemy: { id: enemy.id, name: enemy.name, stats: { ...enemy.stats, maxHp: enemy.stats.maxHp + 20 } } });
      }
      const item = ctx.project.database.items.find(i => i.iconResourceId || i.imageResourceId);
      if (item) await call('item', 'upsert_item', { item: { id: item.id, name: item.name, price: (item.price ?? 50) + 30 } });
      const equipment = ctx.project.database.equipment.find(i => i.iconResourceId || i.imageResourceId);
      if (equipment) await call('equipment', 'get_database_records', { collection: 'equipment', ids: [equipment.id], limit: 1 });
      const proposed = structuredClone(ctx.project);
      const snapshots = JSON.stringify(records.map(r => r.visuals));
      // Immutable receipts must not follow later edits of the draft project.
      ctx.project.maps[mapId].lowerTiles.fill(-1);
      if (enemy) enemy.name = 'later mutation';
      const immutable = snapshots === JSON.stringify(records.map(r => r.visuals));
      return { after: proposed, events, records: records.map(r => ({ name: r.name, ok: r.result.ok, summary: r.result.summary, visuals: r.visuals?.map(v => ({ title: v.title, kind: v.kind, phase: v.phase, target: v.target, stats: v.stats })) })), immutable, mapId };
    }, req);
    proof = { ...result, after: undefined };
    const after = result.after;
    const stats = { ms: 8400, turns: 3, toolCalls: result.records.length, toolErrors: result.records.filter(r => !r.ok).length };
    const events = [
      { type: 'team_start', task: req.task, roles: [] },
      { type: 'agent_spawn', agentId: 'builder-1', role: 'builder', mapId: result.mapId, mapName: '시장 마을', task: '길과 주민 배치 확인', label: '마을 담당' },
      { type: 'agent_spawn', agentId: 'artist-1', role: 'builder', mapId: result.mapId, mapName: '시장 마을', task: '아이템과 몬스터 확인', label: '소재 담당' },
      ...result.events,
      { type: 'agent_done', agentId: 'builder-1', ok: true, summary: '맵과 NPC 확인', stats, changedKeys: [], spills: [], conflicts: [] },
      { type: 'agent_done', agentId: 'artist-1', ok: true, summary: '소재와 수치 초안 확인', stats, changedKeys: [], spills: [], conflicts: [] },
      { type: 'team_report', text: '작업 당시의 모습을 확인해 주세요. 초안 이미지는 아직 프로젝트에 적용되지 않았어요.' },
      { type: 'done', project: after, stats, changedKeys: [`maps.${result.mapId}`], spatialProof: req.project.spatialAuthoring ? { baseline: hash(req.project), spatial: hash(req.project.spatialAuthoring), proposed: hash(after) } : null },
    ];
    await route.fulfill({ contentType: 'application/x-ndjson', body: events.map(e => JSON.stringify(e)).join('\n') + '\n' });
  });
  await page.goto(`${base}/?devProject=1&marketTown=1`, { waitUntil: 'domcontentloaded' });
  const guest = page.getByTestId('login-guest'); await page.getByTestId('ai-input').or(guest).first().waitFor({ timeout: 120000 }); if (await guest.isVisible()) await guest.click();
  await page.getByTestId('ai-input').fill('/pi team 마을 길과 주민을 확인하고, 회복약과 몬스터의 수치를 조정해 줘.');
  await page.getByTestId('ai-send').click();
  await page.getByTestId('ai-pending-review-apply').waitFor({ timeout: 120000 });
  writeFileSync(resolve(out, 'producer.json'), JSON.stringify(proof, null, 2));
  check('Real tool adapter creates immutable execution snapshots', proof.immutable && proof.records.every(r => r.visuals.length > 0));
  await page.getByTestId('ai-wide-open').click();
  const view = page.locator('.ai-work-inline .ai-team-board > .ai-activity-view').first();
  const level = page.locator('.ai-assistant-wide-head [data-testid="ai-activity-level"]');
  await view.locator('.ai-media-picture[data-ready="true"]').first().waitFor();
  await page.waitForTimeout(1800);
  check('Default feed includes real asset images', await view.locator('img').count() >= 3);
  check('Successful monster update also has a before/draft pair', proof.records.some(r => r.name === 'upsert_enemy' && r.ok && r.visuals.some(v => v.phase === 'draft')));
  check('Team roster shows target thumbnails', await page.getByTestId('ai-team-media').count() >= 2);
  await view.locator('.ai-activity-entry').first().scrollIntoViewIfNeeded();
  await view.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  check('Mounted image URLs stay valid after decoding and scrolling', await view.locator('img').evaluateAll(async images => (await Promise.all(images.map(async image => image.complete && image.naturalWidth > 0 && (await fetch(image.src)).ok))).every(Boolean)));
  await page.screenshot({ path: resolve(out, '01-brief.png') });
  await level.locator('[data-activity-level="detail"]').click();
  await view.locator('.ai-media-open').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(out, '02-map-detail.png') });
  const before = view.locator('.ai-media-open').filter({ has: page.locator('.ai-media-phase.is-before') }).first();
  await before.click();
  const dialog = page.getByRole('dialog', { name: '작업 이미지 자세히 보기' });
  await dialog.locator('img').first().waitFor();
  check('Click opens the captured before and draft pair', await dialog.locator('.is-before').count() > 0 && await dialog.locator('.is-draft').count() > 0);
  await page.screenshot({ path: resolve(out, '03-comparison.png') });
  await page.keyboard.press('Escape'); check('Escape closes only image viewer', await dialog.count() === 0 && await page.locator('.ai-assistant-wide').count() === 1);
  const gallery = view.locator('.ai-activity-media').filter({ hasText: '검색된 소재' }).first();
  if (await gallery.count()) { await gallery.scrollIntoViewIfNeeded(); await gallery.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode()))); await page.screenshot({ path: resolve(out, '04-assets.png') }); }
  await level.locator('[data-activity-level="trace"]').click();
  await view.getByLabel('실행 기록 검색').fill('upsert_item');
  await view.locator('summary').first().click();
  await view.locator('pre').first().waitFor();
  await view.locator('img').first().waitFor();
  check('Trace retains raw inputs with visual evidence', await view.locator('pre').count() >= 2 && await view.locator('img').count() >= 1);
  await page.screenshot({ path: resolve(out, '05-trace.png') });
  const mediaIds = await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts'); const a = await import('/src/ai/activityTraceArchive.ts');
    await a.flushActivityArchive();
    const traces = await a.readActivityArchive(store.getProjectIdentity().id);
    const refs = traces.flatMap(t => t.entries.flatMap(e => e.visuals ?? []));
    const media = await import('/src/ai/activityMediaArchive.ts'); await media.flushActivityMedia();
    return Promise.all(refs.map(async r => ({ id: r.id, bytes: (await media.readActivityMedia(r.id))?.blob?.size ?? 0 })));
  });
  check('Images persist separately as blobs', mediaIds.filter(r => r.bytes > 0).length >= 8);
  await level.locator('[data-activity-level="brief"]').click();
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.screenshot({ path: resolve(out, '06-compact.png') });
  check('No horizontal overflow in conversation', await view.evaluate(e => e.scrollWidth <= e.clientWidth + 1));
  // Exercise a real same-origin document reload without editor boot: Vite's large
  // editor dynamic import intermittently aborts on a full-shell reload (also baseline).
  // This receipt check specifically owns IndexedDB durability, not editor startup.
  await page.route('**/__qa_activity_media_reload', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Activity media durability</title>' }));
  await page.goto(`${base}/__qa_activity_media_reload`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const persisted = await page.evaluate(async ids => {
    const media = await import('/src/ai/activityMediaArchive.ts');
    return Promise.all(ids.filter(r => r.bytes > 0).map(async r => (await media.readActivityMedia(r.id))?.blob?.size === r.bytes));
  }, mediaIds);
  check('Captured image bytes survive same-origin document reload', persisted.length >= 8 && persisted.every(Boolean));
  check('No browser runtime errors', errors.length === 0);
} finally {
  writeFileSync(resolve(out, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
  if (checks.some(c => !c.ok) || errors.length) await page.screenshot({ path: resolve(out, 'failure.png') }).catch(() => {});
  await browser.close();
}
