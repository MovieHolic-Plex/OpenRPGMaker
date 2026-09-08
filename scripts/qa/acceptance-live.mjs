#!/usr/bin/env node
// Live companion transport and production declaration/session. No scripted responses.
import assert from 'node:assert/strict';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { firefox } from 'playwright';

const origin = new URL(process.argv[2] ?? 'http://127.0.0.1:9860');
const label = process.argv[3] ?? 'before';
const pricingRepair = label === 'repair-pricing';
const repair = label === 'repair' || pricingRepair;
const generate = label === 'generate' || repair;
const expectedSha = repair ? JSON.parse(await readFile(resolve(`output/evidence/acceptance-live/${pricingRepair ? 'repair' : 'generate'}/save-receipt.json`), 'utf8')).sha256 : null;
const projectId = 'oprn-qa-functional-48c68b5f-2d4';
assert.equal(origin.origin, 'http://127.0.0.1:9860');
const output = resolve('output/evidence/acceptance-live', label);
await mkdir(output, { recursive: true });
const browser = await firefox.launch({ headless: true });
const page = await browser.newPage();
let progressWrite = Promise.resolve();
await page.exposeFunction('recordLive', (kind, value) => {
  progressWrite = progressWrite.then(() => appendFile(resolve(output, 'progress.jsonl'), JSON.stringify({ kind, value }) + '\n'));
  return progressWrite;
});
const transport = [], pending = [];
page.on('response', response => {
  if (new URL(response.url()).pathname !== '/v1/chat/completions') return;
  pending.push((async () => {
    const request = response.request().postDataJSON();
    let body;
    try { body = await response.text(); } catch (error) { body = String(error); }
    transport.push({ requestedModel: request.model, status: response.status(), body });
  })());
});
await page.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.pathname === '/acceptance-live') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><body>Live acceptance API verification</body>' });
  if (!['GET', 'HEAD'].includes(request.method()) && url.pathname !== '/v1/chat/completions') {
    const body = request.postDataJSON();
    const rows = Array.isArray(body) ? body : [body];
    const owned = url.pathname.includes('/rest/v1/') && (url.searchParams.get('project_id') === `eq.${projectId}`
      || (rows.length > 0 && rows.every(row => row?.project_id === projectId)));
    if (!generate || !owned) return route.fulfill({ status: 403, body: `Unowned write refused: ${url.pathname}` });
  }
  return route.continue();
});
try {
  await page.goto(new URL(`/acceptance-live?project=${projectId}`, origin).href, { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async ({ projectId, generate, repair, pricingRepair, expectedSha }) => {
    const [{ AssistantSession }, { createLlmIntentDeclarer, resetIntentDeclarationCache }, llm, { createBlankProject }, { activeTools }, sync, { supabaseProjectConfig }] = await Promise.all([
      import('/src/ai/assistantSession.ts'), import('/src/ai/intentDeclarationClient.ts'), import('/src/ai/llmClient.ts'),
      import('/src/project/defaults/defaultProject.ts'), import('/src/editor/tools/index.ts'),
      import('/src/project/supabaseProjectSync.ts'), import('/src/project/supabaseProjectConfig.ts'),
    ]);
    const remoteConfig = { ...supabaseProjectConfig(), projectId };
    if (!remoteConfig.url || !remoteConfig.anonKey) throw new Error('Supabase not configured');
    const existing = await sync.loadProjectForPersistenceProof(remoteConfig);
    if (generate && !repair && existing) throw new Error('Owned project collision: refusing creation');
    if (repair && (!existing || existing.sha256 !== expectedSha)) throw new Error('Owned repair revision does not match prior saved receipt');
    const project = repair ? existing.project : createBlankProject();
    const catalog = activeTools().find(tool => tool.name === 'get_database_records').run(project, { collection: 'items' });
    const resources = activeTools().find(tool => tool.name === 'list_resources').run(project, { kind: 'charset', query: '*', limit: 3 });
    const config = { ...llm.defaultAiConfig(), agentMode: 'auto', autonomyLevel: undefined, maxToolCalls: generate && !repair ? 80 : 12, maxTokens: 32000,
      ...(pricingRepair ? { providerId: 'openai-codex', model: 'gpt-5.6-sol', liteModel: 'gpt-5.6-sol' } : {}) };
    const calls = [], declarations = [], events = [];
    const chat = async (config, request) => {
      const entry = { requestedModel: config.model, messages: calls.length < 3 ? request.messages : undefined, responseFormat: request.response_format };
      calls.push(entry);
      try { entry.result = await llm.chatCompletion(config, request); await window.recordLive('completion', entry); return entry.result; }
      catch (error) { entry.error = String(error); throw error; }
    };
    const declare = createLlmIntentDeclarer({ getConfig: () => config, chat });
    resetIntentDeclarationCache();
    const session = new AssistantSession(project, { config, chat, contextOptions: { mapId: project.startMapId },
      declareIntent: async (facts, signal) => { const outcome = await declare(facts, signal); declarations.push({ facts, outcome }); return outcome; },
    });
    const prompt = pricingRepair
      ? 'Fix the catalog price of item_potion so Mira (ev_mira, map_blank_start at 10,7) really sells two potions for 10 gold each, 20 gold total, from the actual project start (10,8) with 100 gold. Read the item record first. The production shopPrice.ts anti-arbitrage floor is half the catalog price: the current catalog price is 50 so the valid stock priceOverride:10 is clamped to 25. Set the item_potion catalog price to 10 using the proper database authoring tool, retaining the rest of its record. The existing shop stock priceOverride:10 is correct and should be preserved. Leave the NPCs, maps, authored gates, and session defaults unchanged. Verify with an actual run_scene_test purchase (count 2, unitPrice 10) and expect goldDelta -20 and inventoryDelta item_potion +2; do not inject test state or change any acceptance expectation.'
      : repair
      ? 'Repair only the existing merchant Mira (ev_mira) on Cedar Village/map_blank_start at (10,7). The original request requires buying two item_potion for 10 gold each from the actual start (10,8), with starting gold 100. The real evaluator reports Shop price: expected 10, actual 25. Your saved shop stock uses priceOverride:10; the production shop stock schema consumes price, not priceOverride. Query the actual event and tool schema, author the correct stock price and prove the purchase with run_scene_test from the real start, checking goldDelta -20 and inventoryDelta item_potion +2. Preserve Rowan and its first-only antidote reward, both authored transfer gates, maps, start, and all other content. Do not replace any acceptance criteria or add test-only money/state.'
      : generate
      ? `Author a small playable two-map verification village. Rename the existing 20x15 map map_blank_start to Cedar Village and keep the actual player start at (10,8). Start the player with exactly 100 gold. Place an actual merchant named Mira at (10,7) who sells item_potion (catalog potion) for 10 gold each; the player must be able to buy two potions for 20 gold. Place a separate reward NPC named Rowan at (12,7) who gives exactly one item_antidote (catalog antidote) only on the first interaction and gives nothing on a second interaction. Create a second 20x15 outdoor map named Meadow. Author a reachable exit event named East Gate at (18,8) on Cedar Village that transfers to Meadow (2,8), and an authored return event named Village Gate at Meadow (1,8) that returns to Cedar Village (17,8). All routes from the real start to both NPCs and the exit, and from arrival to the return, must be walkable. Use ordinary action or touch transfers and an ordinary player-buy shop. Use existing queried assets, such as ${JSON.stringify(resources.data.matches)}. Query records and tool schemas as needed; author the real event commands and map content. A minimal flat grassy village square is enough. This is a functional verification project, not a visual showcase. Keep names and coordinates exact.`
      : 'Make a merchant named Mira in the current village who sells two potions at 10 gold each, starting with 100 gold. A separate NPC named Rowan must give one antidote only on the first interaction. Add a reachable exit named East Gate to a second map named Meadow and a return named Village Gate. Do not add combat. The merchant must refuse purchases after sunset; leave the time of sunset undecided and ask me rather than inventing it.';
    await window.recordLive('prompt', prompt);
    let response, error;
    try { response = await session.sendUserMessage(prompt, event => { events.push(event); void window.recordLive('event', event); }, AbortSignal.timeout(generate ? 900000 : 180000), { composerMode: generate ? 'do' : 'plan' }); }
    catch (cause) { error = String(cause); }
    let saved;
    if (generate && response?.proposedCalls?.length) {
      const { store } = await import('/src/project/store.ts');
      const { applyProposedProject } = await import('/src/editor/tools/applyChangesetToStore.ts');
      const proposed = session.getProposedProject();
      if (repair && (await sync.loadProjectForPersistenceProof(remoteConfig))?.sha256 !== expectedSha) throw new Error('Remote revision changed during repair');
      await store.loadNewRemoteProject(project, { projectId });
      const baselineSave = await store.flush();
      if (baselineSave.kind !== 'saved') throw new Error('Owned baseline persistence failed');
      const applied = await applyProposedProject(proposed, { source: 'agent', agentName: config.model,
        summary: 'Real-model functional verification village', toolNames: response.proposedCalls.map(call => call.name) });
      if (!applied.ok) throw new Error(`Real apply rejected: ${JSON.stringify(applied)}`);
      const flush = await store.flush();
      if (flush.kind !== 'saved' || !flush.receipt || flush.receipt.projectId !== projectId) throw new Error(`Real save failed: ${JSON.stringify(flush)}`);
      const proof = await store.verifyPersistedRevision(flush.receipt);
      const reload = await sync.loadProjectForPersistenceProof(remoteConfig);
      if (!reload || reload.projectId !== projectId || proof.kind !== 'verified') throw new Error(`Independent reload mismatch: ${JSON.stringify(proof)}`);
      session.rebaseProject(reload.project);
      saved = { flush: { ...flush, project: undefined }, proof, commit: applied.commit, projectId: reload.projectId, sha256: reload.sha256, project: reload.project };
      await window.recordLive('saved', { ...saved, project: undefined });
    }
    return { evidenceKind: 'real-model-production-session', projectId, collisionAbsent: !existing, expectedSha, prompt,
      config: { providerId: config.providerId, model: config.model, liteModel: config.liteModel },
      catalog, resources, calls, declarations, events, response, error, saved,
      acceptance: session.getAcceptanceSnapshot(), outcome: session.getRunOutcome(), audit: session.getAuditEntries() };
  }, { projectId, generate, repair, pricingRepair, expectedSha });
  await Promise.all(pending);
  await progressWrite;
  await writeFile(resolve(output, 'session.json'), JSON.stringify({ ...result, saved: result.saved ? { ...result.saved, project: undefined } : undefined }, null, 2) + '\n');
  await writeFile(resolve(output, 'transport.json'), JSON.stringify(transport, null, 2) + '\n');
  if (result.saved) {
    await writeFile(resolve(output, 'project.json'), JSON.stringify(result.saved.project, null, 2) + '\n');
    await writeFile(resolve(output, 'save-receipt.json'), JSON.stringify({ ...result.saved, project: undefined }, null, 2) + '\n');
    await writeFile(resolve(output, 'acceptance.json'), JSON.stringify(result.acceptance, null, 2) + '\n');
  }
  console.log(JSON.stringify({ output, declarations: result.declarations.map(entry => entry.outcome), outcome: result.outcome, error: result.error }, null, 2));
} finally { await browser.close(); }
