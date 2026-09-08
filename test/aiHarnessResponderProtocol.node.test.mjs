import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { resolve } from 'node:path';
import { withTsModule } from '../scripts/ontology-ts-loader.mjs';
import { proofFailureResponse } from '../scripts/qa/ai-harness-proof-failure.mjs';
import { createP2Contracts } from '../scripts/qa/ai-harness-p2.mjs';
import { p2Scenarios } from '../scripts/qa/ai-harness-p2-scenarios.mjs';

let coverage, intent;
before(async () => {
  await withTsModule(resolve('src/ai/requestCoverage.ts'), 'coverage.mjs', module => { coverage = module; });
  await withTsModule(resolve('src/ai/intentDeclaration.ts'), 'intent.mjs', module => { intent = module; });
});

const projectId = 'qa-protocol';
const titleToken = 'QA protocol title';
const fixture = { mapId: 'map_protocol', width: 20, height: 15, title: 'Original', titleToken,
  receipt: { contentIdentity: 'fixture' } };
const cases = p2Scenarios(fixture);
const facts = userText => ({ userText, currentMap: { id: fixture.mapId, name: 'Protocol' },
  selection: null, maps: [{ id: fixture.mapId, name: 'Protocol' }], facilityLabels: [],
  toolNames: ['set_title_screen', 'set_work_plan', 'skip_work_item'], hasActivePlan: false });
const request = (system, text) => ({ messages: [
  { role: 'system', content: system },
  { role: 'user', content: intent.buildIntentUserPayload(facts(text)) },
], response_format: { type: 'json_object' }, temperature: 0.1 });
const intentRequest = text => request(intent.INTENT_SYSTEM_PROMPT, text);
const auditRequest = text => request(coverage.REQUEST_COVERAGE_AUDIT, text);
const toolRequest = calls => ({ tools: [...new Set(calls.map(call => call.name))].map(name => ({
  type: 'function', function: { name, parameters: { type: 'object' } },
})) });

async function assertAudit(respond, text, criteria = [{ kind: 'projectTitle', title: titleToken }]) {
  const message = await respond(auditRequest(text));
  assert.equal(message.role, 'assistant');
  assert.equal(message.tool_calls, undefined);
  const raw = JSON.parse(message.content);
  assert.ok(Array.isArray(raw.requirements), 'audit must return requirements, not intent');
  assert.equal(raw.mode, undefined);
  const parsed = coverage.parseRequestCoverageResult(message.content, facts(text), []);
  assert.equal(parsed.error, undefined);
  assert.deepEqual(parsed.requirements, raw.requirements);
  assert.equal(parsed.requirements.length, 1);
  assert.equal(parsed.requirements[0].text, text);
  assert.deepEqual(parsed.requirements[0].criteria, criteria);
}

async function assertForeignRejected(respond, text) {
  await assert.rejects(async () => respond(auditRequest(`${text} foreign`.replace(projectId, 'other-owner')
    .replace(titleToken, 'Another title'))), assert.AssertionError);
  const misplaced = auditRequest('A different request.');
  misplaced.messages.push({ role: 'assistant', content: text });
  await assert.rejects(async () => respond(misplaced), assert.AssertionError);
}

function deferred() {
  const value = Promise.withResolvers();
  const resolve = value.resolve;
  value.resolved = false;
  value.resolve = result => { value.resolved = true; resolve(result); };
  return value;
}
async function bounded(promise) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Protocol test event did not arrive')), 5000);
    })]);
  } finally { clearTimeout(timer); }
}

// Only the page boundary is simulated. The exported run() arms its original
// scenarios and holds; respond(), round counters and deferred waits are real.
// Earlier cases deliberately stop at the keyboard seam, never at an assertion
// about product behavior. Their sentinel failures are accounted for explicitly.
async function armP2(t, group, id, hold = false) {
  const specs = cases[group];
  const index = specs.findIndex(spec => spec.id === id);
  assert.ok(index >= 0);
  const stopped = new Error('test-owned run stop');
  const advance = new assert.AssertionError({ message: 'test-owned case advance' });
  const ready = deferred(), stop = deferred(), holdWait = deferred();
  const gates = [], records = [], report = {};
  let cursor = -1;
  const contracts = createP2Contracts({ projectId, titleToken, report,
    record: (type, data) => records.push({ type, ...data }), clearProofGate() {},
    deferred: () => { const gate = deferred(); gates.push(gate); return gate; },
    bounded: promise => {
      if (promise === gates[1]?.promise) holdWait.resolve();
      return bounded(promise);
    },
    observeRemote: async () => ({ observedIdentity: fixture.receipt.contentIdentity }),
    page: {
      keyboard: { press: async () => {
        cursor++;
        if (cursor < index) throw advance;
        assert.equal(cursor, index);
        if (!hold) { ready.resolve(); await stop.promise; throw stopped; }
      } },
      getByTestId: () => ({ click: async () => {} }),
      evaluate: async (_callback, argument) => {
        if (typeof argument === 'string') {
          assert.equal(argument, `${projectId}/${id}: ${specs[index].instruction}`);
          ready.resolve(); await stop.promise; throw stopped;
        }
        return fixture;
      },
    },
  });
  const run = contracts.run(group === 'required' ? 'required-skip' : 'outcome-matrix')
    .then(() => ({ finished: true }), error => ({ error }));
  t.after(async () => {
    contracts.release(); stop.resolve();
    assert.equal((await bounded(run)).error, stopped);
  });
  await bounded(ready.promise);
  assert.deepEqual(report.caseFailures.map(failure => failure.case), specs.slice(0, index).map(spec => spec.id));
  assert.ok(report.caseFailures.every(failure => failure.message === advance.message));
  return { ...contracts, spec: specs[index], records, gates, holdWait,
    text: `${projectId}/${id}: ${specs[index].instruction}` };
}

function assertRound(message, spec, round) {
  assert.equal(message.role, 'assistant');
  assert.deepEqual(message.tool_calls.map(call => ({ name: call.function.name,
    args: JSON.parse(call.function.arguments) })), spec.rounds[round]);
  assert.deepEqual(message.tool_calls.map(call => call.id),
    spec.rounds[round].map((_, index) => `qa_${spec.id}_${round + 1}_${index}`));
}

test('P1 intent then audit uses the production coverage parser without consuming its title write', async () => {
  const respond = proofFailureResponse(titleToken);
  const text = `Use set_title_screen to set the title to ${titleToken}.`;
  const declaration = JSON.parse(respond(intentRequest(text)).content);
  assert.equal(declaration.mode, 'modify');
  assert.equal(declaration.action, 'new_plan');
  await assertAudit(respond, text);
  await assertForeignRejected(respond, text);
  assert.deepEqual(JSON.parse(respond(intentRequest(text)).content), declaration);
  const tools = toolRequest([{ name: 'set_title_screen' }]);
  const write = respond(tools);
  assert.equal(write.tool_calls.length, 1);
  assert.equal(write.tool_calls[0].function.name, 'set_title_screen');
  assert.equal(JSON.parse(write.tool_calls[0].function.arguments).title, titleToken);
  await assertAudit(respond, text);
  assert.equal(JSON.parse(respond(intentRequest(text)).content).action, 'resume');
  assert.equal(respond(tools).content, 'QA_FINAL');
  assert.equal(respond(tools).tool_calls, undefined);
});

for (const id of cases.required.map(spec => spec.id)) {
  test(`P2 ${id}: intent/audit and rejected foreign requests preserve original tool rounds`, async t => {
    const h = await armP2(t, 'required', id);
    assert.deepEqual(JSON.parse((await h.respond(intentRequest(h.text))).content), h.spec.intent);
    await assertAudit(h.respond, h.text, h.spec.criteria);
    await assertForeignRejected(h.respond, h.text);
    for (const [round, calls] of h.spec.rounds.entries()) {
      assert.deepEqual(JSON.parse((await h.respond(intentRequest(h.text))).content), h.spec.intent);
      await assertAudit(h.respond, h.text, h.spec.criteria);
      assertRound(await h.respond(toolRequest(calls)), h.spec, round);
    }
    await assertAudit(h.respond, h.text, h.spec.criteria);
    assert.equal((await h.respond(toolRequest(h.spec.rounds.flat()))).content, 'QA_FINAL');
    assert.deepEqual(h.records.filter(record => record.type === 'p2-scripted-tools').map(record => record.round),
      h.spec.rounds.map((_, round) => round + 1));
  });
}

test('P2 audits neither consume nor release the original post-tool hold', async t => {
  const h = await armP2(t, 'matrix', 'rejected-apply', true);
  assert.equal(h.gates.length, 2);
  assert.deepEqual(JSON.parse((await h.respond(intentRequest(h.text))).content), h.spec.intent);
  await assertAudit(h.respond, h.text, h.spec.criteria);
  await assertForeignRejected(h.respond, h.text);
  assert.equal(h.gates[0].resolved, false);
  assert.equal(h.gates[1].resolved, false);
  const tools = toolRequest(h.spec.rounds.flat());
  assertRound(await h.respond(tools), h.spec, 0);
  assert.equal(h.gates[0].resolved, false);
  let finished = false;
  // Subscribe to the exact bounded-wait entry before triggering the response.
  const waiting = bounded(h.holdWait.promise);
  const final = h.respond(tools).then(message => { finished = true; return message; });
  t.after(async () => { h.release(); await bounded(final); });
  await waiting;
  assert.equal(h.gates[0].resolved, true);
  await assertAudit(h.respond, h.text, h.spec.criteria);
  assert.deepEqual(JSON.parse((await h.respond(intentRequest(h.text))).content), h.spec.intent);
  await assertForeignRejected(h.respond, h.text);
  assert.equal(h.gates[1].resolved, false);
  assert.equal(finished, false);
  h.release();
  assert.equal((await bounded(final)).content, 'QA_FINAL');
  assert.equal((await h.respond(tools)).content, 'QA_FINAL');
  assert.deepEqual(h.records.filter(record => record.type === 'p2-scripted-tools').map(record => record.round), [1]);
});

for (const id of ['legacy-unassessed', 'legacy-assessed']) {
  test(`P2 ${id}: scheduler-only legacy input remains outside authoring audit`, async t => {
    const h = await armP2(t, 'matrix', id);
    const declared = JSON.parse((await h.respond(intentRequest(h.text))).content);
    assert.equal(declared.mode, 'other');
    assert.deepEqual(declared.tools, []);
    assert.equal(h.spec.criteria, undefined);
    assert.deepEqual(h.spec.coverageIds, []);
    await assert.rejects(() => h.respond(auditRequest(h.text)), assert.AssertionError);
    assertRound(await h.respond(toolRequest(h.spec.rounds[0])), h.spec, 0);
    assert.equal(h.spec.rounds[0][0].name, 'skip_work_item');
    if (id === 'legacy-unassessed') assert.equal(declared.acceptance, undefined);
    else assert.deepEqual(declared.acceptance[0].criteria,
      [{ kind: 'mapDimensions', target: { mapId: fixture.mapId }, width: fixture.width, height: fixture.height }]);
  });
}

test('P2 host IDs reuse matching required planner criteria without duplicating withdrawal', () => {
  const spec = cases.required.find(spec => spec.id === 'user-withdrawal');
  assert.deepEqual(spec.requiredIds, spec.coverageIds);
  assert.equal(spec.withdrawId, 'request-1:coverage:0:1');
  const requirements = spec.rounds[0][0].args.requirements;
  assert.deepEqual(requirements.map(requirement => requirement.id), spec.coverageIds);
  assert.deepEqual(requirements.map(requirement => requirement.criteria[0]), spec.criteria);
  assert.deepEqual(spec.rounds[0][0].args.layers[0].items.map(item => item.id),
    ['work-existing-size', 'work-required-events']);
  assert.deepEqual(spec.rounds[0].slice(1).map(call => call.args.itemId),
    ['work-existing-size', 'work-required-events']);
  const optional = cases.required.find(spec => spec.id === 'optional-skip');
  const optionalRequirement = optional.rounds[0][0].args.requirements.find(requirement => requirement.id === optional.optionalId);
  assert.equal(optionalRequirement.required, false);
  assert.equal(optional.coverageIds.includes(optional.optionalId), false);
});
