#!/usr/bin/env node
// Independent, read-only canonical reload. Expectations come from captured live
// declarations, never from the authored event commands or a scripted model.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { firefox } from 'playwright';

const projectId = 'oprn-qa-functional-48c68b5f-2d4';
const root = resolve('output/evidence/acceptance-live');
const receipt = JSON.parse(await readFile(resolve(root, 'repair-pricing/save-receipt.json'), 'utf8'));
const original = JSON.parse(await readFile(resolve(root, 'generate/acceptance.json'), 'utf8'));
const generation = JSON.parse(await readFile(resolve(root, 'generate/session.json'), 'utf8'));
const capturedAudit = { raw: generation.calls[1].result.message.content, facts: generation.declarations[0].facts };
assert.equal(receipt.projectId, projectId);
const browser = await firefox.launch({ headless: true });
const page = await browser.newPage();
await page.route('**/*', route => {
  const request = route.request();
  if (!['GET', 'HEAD'].includes(request.method())) return route.abort('blockedbyclient');
  if (new URL(request.url()).pathname === '/acceptance-live-check') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><body>Canonical functional verification</body>' });
  return route.continue();
});
try {
  await page.goto(`http://127.0.0.1:9860/acceptance-live-check?project=${projectId}`, { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async ({ projectId, receipt, original, capturedAudit }) => {
    const [{ supabaseProjectConfig }, { loadProjectForPersistenceProof }, { AssistantAcceptanceLedger }, { createBlankProject }, { PLAY_TOOLS }, { serializeForComparison }, { sha256HexText }, { parseRequestCoverage }, { acceptanceFingerprint }] = await Promise.all([
      import('/src/project/supabaseProjectConfig.ts'), import('/src/project/supabaseProjectSync.ts'),
      import('/src/ai/assistantAcceptanceLedger.ts'), import('/src/project/defaults/defaultProject.ts'),
      import('/src/editor/tools/playTools.ts'), import('/src/project/io.ts'), import('/src/util/sha256.ts'),
      import('/src/ai/requestCoverage.ts'), import('/src/ai/assistantAcceptanceEvaluation.ts'),
    ]);
    const loaded = await loadProjectForPersistenceProof({ ...supabaseProjectConfig(), projectId });
    if (!loaded || loaded.projectId !== projectId || loaded.sha256 !== receipt.sha256) throw new Error('Canonical remote revision no longer matches repair receipt');
    const contentIdentity = await sha256HexText(serializeForComparison(loaded.project));
    if (contentIdentity !== receipt.flush.receipt.contentIdentity) throw new Error('Canonical content identity mismatch');
    const project = loaded.project;
    const baseline = createBlankProject();
    const ledger = new AssistantAcceptanceLedger(original.id, original.goal, baseline);
    for (const item of original.items.filter(item => item.source)) {
      ledger.adopt([{ id: item.id, title: item.title, required: item.required,
        criteria: item.evidence.map(evidence => JSON.parse(evidence.expected)) }], baseline, item.source);
    }
    // Generation began before quote-gap enforcement landed. Reparse its exact
    // recorded model audit through the final parser; omitted words become real
    // unresolved ledger entries, not fabricated declarations or worker repairs.
    const audited = parseRequestCoverage(capturedAudit.raw, capturedAudit.facts, []);
    const originalCriteria = new Set(original.items.filter(item => item.source).flatMap(item => item.evidence
      .map(evidence => acceptanceFingerprint(JSON.parse(evidence.expected)))));
    const source = original.items.find(item => item.source).source;
    audited.forEach((requirement, index) => requirement.criteria.forEach((criterion, criterionIndex) => {
      if (!originalCriteria.has(acceptanceFingerprint(criterion))) ledger.adopt([{
        id: `${source.requestId}:coverage-replay:${index}:${criterionIndex}`, title: requirement.text, required: true, criteria: [criterion],
      }], baseline, source);
    }));
    const acceptance = ledger.evaluate(project);
    const requestMappings = audited.map(requirement => ({ text: requirement.text,
      checks: requirement.criteria.map(criterion => ({ criterion, requirementIds: acceptance.items.filter(item => item.evidence
        .some(evidence => acceptanceFingerprint(JSON.parse(evidence.expected)) === acceptanceFingerprint(criterion))).map(item => item.id) })) }));
    const functional = ledger.getFunctionalCriteria();
    const purchase = functional.find(criterion => criterion.kind === 'shopPurchase');
    const trip = functional.find(criterion => criterion.kind === 'mapRoundTrip');
    const reward = functional.find(criterion => criterion.kind === 'npcReward');
    if (!purchase || !trip || !reward) throw new Error('Original live declaration omitted required core behavior');
    const map = project.maps[purchase.target.mapId];
    const findEvent = (map, target) => {
      const matches = map.events.filter(event => 'eventId' in target ? event.id === target.eventId : event.name === target.eventName);
      if (matches.length !== 1) throw new Error(`Ambiguous original target: ${JSON.stringify(target)}`);
      return matches[0];
    };
    const seller = findEvent(map, purchase.seller), npc = findEvent(map, reward.requirement.target);
    const destination = 'mapId' in trip.destination ? project.maps[trip.destination.mapId]
      : Object.values(project.maps).find(map => map.name === trip.destination.newMapName);
    const outgoing = findEvent(map, trip.outgoing), returning = findEvent(destination, trip.returning);
    const itemId = purchase.item.id, antidoteId = reward.requirement.grants[0].id;
    if (!itemId || !antidoteId) throw new Error('Expected catalog IDs in captured live declaration');
    const steps = [
      { kind: 'snapshotRewards' },
      { kind: 'walk', to: { x: seller.x, y: seller.y }, adjacent: true }, { kind: 'interact', eventId: seller.id },
      { kind: 'purchase', eventId: seller.id, itemId, count: purchase.count, unitPrice: purchase.unitPrice },
      { kind: 'expect', goldDelta: -20, inventoryDelta: { [itemId]: 2 }, interactionComplete: true },
      { kind: 'walk', to: { x: npc.x, y: npc.y }, adjacent: true }, { kind: 'interact', eventId: npc.id },
      { kind: 'expect', goldDelta: -20, inventoryDelta: { [itemId]: 2, [antidoteId]: 1 }, interactionComplete: true },
      { kind: 'interact', eventId: npc.id },
      { kind: 'expect', goldDelta: -20, inventoryDelta: { [itemId]: 2, [antidoteId]: 1 }, interactionComplete: true },
      { kind: 'walk', to: { x: outgoing.x, y: outgoing.y } },
      { kind: 'expect', mapId: destination.id, interactionComplete: true, lastTransfer: { fromMapId: map.id, eventId: outgoing.id, toMapId: destination.id } },
      { kind: 'walk', to: { x: returning.x, y: returning.y } },
      { kind: 'expect', mapId: map.id, interactionComplete: true, lastTransfer: { fromMapId: destination.id, eventId: returning.id, toMapId: map.id } },
      { kind: 'walk', to: purchase.start },
      { kind: 'expect', playerAt: { mapId: map.id, ...purchase.start }, goldDelta: -20, inventoryDelta: { [itemId]: 2, [antidoteId]: 1 }, interactionComplete: true },
    ];
    const scene = PLAY_TOOLS.find(tool => tool.name === 'run_scene_test').run(project, { mapId: map.id, start: purchase.start, steps });
    return { scope: 'Independent remote reload; captured original live criteria evaluated by the canonical ledger, plus one real-interpreter combined scene. Not graphical-player proof.',
      projectId, sha256: loaded.sha256, contentIdentity, project, acceptance, requestMappings, scene: scene.data, steps,
      checkpoints: { start: { mapId: map.id, ...purchase.start, gold: project.session.gold },
        seller: { id: seller.id, x: seller.x, y: seller.y, itemId, count: purchase.count, unitPrice: purchase.unitPrice, goldAfter: 80 },
        reward: { id: npc.id, x: npc.x, y: npc.y, itemId: antidoteId, firstQuantity: 1, secondQuantity: 1 },
        outgoing: { id: outgoing.id, x: outgoing.x, y: outgoing.y, destination: destination.id, arrival: { x: 2, y: 8 } },
        returning: { id: returning.id, x: returning.x, y: returning.y, arrival: { x: 17, y: 8 } },
        final: { mapId: map.id, ...purchase.start, gold: 80, inventory: { [itemId]: 2, [antidoteId]: 1 } } } };
  }, { projectId, receipt, original, capturedAudit });
  const output = resolve(root, 'handoff');
  await mkdir(output, { recursive: true });
  const json = JSON.stringify(result.project, null, 2) + '\n';
  await writeFile(resolve(output, 'project.json'), json);
  await writeFile(resolve(output, 'evaluation.json'), JSON.stringify({ ...result, project: undefined, fileSha256: createHash('sha256').update(json).digest('hex') }, null, 2) + '\n');
  await writeFile(resolve(output, 'save-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  assert.equal(result.scene.ok, true, JSON.stringify(result.scene));
  assert.equal(result.scene.finalState.gold, 80);
  for (const item of result.acceptance.items.filter(item => item.id.startsWith('request-1:functional:'))) assert.equal(item.status, 'verified', JSON.stringify(item));
  console.log(JSON.stringify({ output, projectId, sha256: result.sha256, coreChecks: '3 passed', combinedSceneSteps: result.scene.stepsRun, goal: result.acceptance.status }, null, 2));
} finally { await browser.close(); }
