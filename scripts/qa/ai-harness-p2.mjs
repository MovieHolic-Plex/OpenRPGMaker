import assert from 'node:assert/strict';
import { p2Scenarios } from './ai-harness-p2-scenarios.mjs';
import { p2Observations } from './ai-harness-p2-observe.mjs';
import { runBlockedAskResume } from './ai-harness-p2-resume.mjs';

export function createP2Contracts(harness) {
  const { page, report, record, deferred, bounded, projectId } = harness;
  const observations = p2Observations(harness);
  const ownedTitles = new Set();
  let current, round = 0, held;
  async function respond(body) {
    assert.ok(current, 'LLM request must belong to an armed case');
    if (!body.tools?.length) return { role: 'assistant', content: JSON.stringify(current.intent) };
    if (held?.beforeTools && !held.used) {
      held.used = true; held.arrived.resolve();
      await bounded(held.release.promise, 'user lifecycle tools request');
    }
    const calls = current.rounds[round++];
    if (!calls) {
      if (held && !held.used) {
        held.used = true; held.arrived.resolve();
        await bounded(held.release.promise, 'post-tool LLM response');
      }
      return { role: 'assistant', content: 'QA_FINAL' };
    }
    for (const call of calls) assert.ok(body.tools.some(tool => tool.function.name === call.name), `Real tool exposed: ${call.name}`);
    record('p2-scripted-tools', { case: current.id, round, calls });
    return { role: 'assistant', content: '', tool_calls: calls.map((call, index) => ({
      id: `qa_${current.id}_${round}_${index}`, type: 'function',
      function: { name: call.name, arguments: JSON.stringify(call.args) },
    })) };
  }
  async function intercept(route, entry) {
    if (current?.fault === 'commit-log-503' && entry.table === 'project_commits' && entry.method === 'POST') {
      record('injected-transport-fault', { case: current.id, fault: current.fault, status: 503, remoteOutage: false, network: false });
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'QA_TRANSPORT', message: 'QA commit-log transport fault' }) });
      return true;
    }
    return false;
  }
  async function runCase(spec) {
    // Given: a fresh real conversation, existing real persisted fixture and scripted transport only.
    current = spec; round = 0; held = undefined;
    await page.keyboard.press('Escape');
    await page.getByTestId('ai-new-chat').click();
    await page.getByTestId(`ai-composer-mode-${spec.composerMode ?? 'do'}`).click();
    await page.evaluate(async spec => {
      const config = await import('/src/ai/llmClient.ts');
      const previous = config.loadAiConfig();
      config.saveAiConfig({ ...previous, liteModel: previous.model, autonomyLevel: 'balanced',
        agentMode: spec.agentMode ?? 'auto', maxToolCalls: spec.maxToolCalls ?? 24 });
      qa.events = []; qa.result = undefined; qa.bridgeResult = undefined; qa.activity = undefined;
    }, spec);
    const instruction = `${projectId}/${spec.id}: inspect only the scripted scope.`;
    await observations.armActivity(instruction);
    let proofGate;
    switch (spec.action) {
      case 'cancel-proof': case 'mismatch-proof': proofGate = await harness.armProof(spec.id); break;
      case 'protect-live-house': held = { arrived: deferred(), release: deferred(), used: false }; break;
      case undefined: break;
      default: throw new Error(`Unknown case action: ${spec.action}`);
    }
    // When: the real composer/bridge runs the real session, tools, apply and store.
    record('p2-case-start', { case: spec.id, bridge: !!spec.bridge, expected: spec.expected });
    if (spec.bridge) await page.evaluate(instruction => {
      qa.bridgePending = window.__oprnAiBridge.send(instruction).then(result => { qa.bridgeResult = result; });
      void qa.bridgePending.catch(() => {});
    }, instruction);
    else await harness.send(instruction);
    switch (spec.action) {
      case 'cancel-proof':
        await bounded(proofGate.arrived.promise, 'accepted save before user cancellation');
        report.states[`${spec.id}-before-abort`] = await observations.capture(`${spec.id}-before-abort`);
        record('user-cancellation', { case: spec.id, signal: 'accepted persistence proof GET held' });
        await page.getByTestId('ai-abort').click();
        proofGate.release.resolve();
        await bounded(proofGate.completed.promise, 'cancelled proof transport released');
        break;
      case 'mismatch-proof': {
        await bounded(proofGate.arrived.promise, 'accepted save before real remote mismatch');
        const accepted = await harness.observeRemote(spec.id);
        const changed = structuredClone(accepted.row.current_json);
        changed.meta.description = 'QA real remote content mismatch';
        assert.equal((await harness.rest('projects', 'PATCH', { current_json: changed }, { title: `eq.${accepted.row.title}` })).length, 1);
        const mismatched = await harness.observeRemote(`${spec.id}-changed`);
        assert.notEqual(mismatched.observedIdentity, accepted.observedIdentity);
        record('real-remote-mismatch', { case: spec.id, acceptedIdentity: accepted.observedIdentity, observedIdentity: mismatched.observedIdentity });
        proofGate.release.resolve();
        await bounded(proofGate.completed.promise, 'mismatch proof transport released');
        break;
      }
      case 'protect-live-house':
        await bounded(held.arrived.promise, 'real tool finished before ordinary apply');
        await page.evaluate(async () => {
          // A valid human ownership edit after the detached draft, not a fake apply result.
          qa.store.update(draft => {
            draft.maps[draft.startMapId].layoutPlan = { version: 1, kind: 'houses', regions: [
              { id: 'qa-human-house', role: 'house', x: 3, y: 3, w: 2, h: 2 },
            ] };
          }, { scope: 'project', origin: 'human', label: 'QA concurrent human ownership' });
          qa.beforeRejectedApply = JSON.stringify(qa.store.getCurrent());
          const saved = await qa.store.flush();
          if (saved.kind !== 'saved') throw new Error(`Human fixture save failed: ${saved.kind}`);
        });
        record('real-human-edit', { case: spec.id, signal: 'next LLM request after title tool', contract: 'live house protection rejects stale draft' });
        held.release.resolve();
        break;
      case undefined: break;
      default: throw new Error(`Unknown case action: ${spec.action}`);
    }
    if (spec.bridge) await page.evaluate(() => qa.bridgePending);
    else await harness.settled();
    await page.evaluate(() => qa.activityDone);
    harness.clearProofGate();
    // Then: actual observed contracts, never fallback/fabricated outcome objects.
    const observed = await observations.capture(spec.id);
    observations.agreement(spec, observed);
    if (spec.action === 'protect-live-house') {
      observations.check(`${spec.id}: stale apply preserved live bytes`, () => assert.equal(observed.live.title, report.lastAppliedTitle));
      observations.check(`${spec.id}: pending draft retained`, () => assert.equal(observed.proposedCalls?.length, 1));
      const unchanged = await page.evaluate(() => JSON.stringify(qa.store.getCurrent()) === qa.beforeRejectedApply);
      observations.check(`${spec.id}: human edit survived rejection`, () => assert.equal(unchanged, true));
    }
    if (spec.title) report.lastAppliedTitle = spec.title;
    if (spec.action === 'mismatch-proof') observations.check(`${spec.id}: P1 content mismatch`, () => assert.equal(observed.proof?.reason, 'mismatch-content'));
    if (spec.withdrawId) {
      const button = page.locator(`[data-testid="ai-requirement-withdraw"][data-requirement-id="${spec.withdrawId}"]`);
      // Missing UI is a violated assertion, not a conditional skip or a fake user action.
      assert.equal(await button.count(), 1, `${spec.id}: genuine user withdrawal control exists`);
      await button.click();
      const withdrawn = await observations.capture(`${spec.id}-withdrawn`);
      observations.check(`${spec.id}: user withdrawal closes required denominator`, () => assert.equal(withdrawn.getter?.goal, 'satisfied'));
      observations.check(`${spec.id}: withdrawal retains unsatisfied history`, () => {
        const item = withdrawn.acceptance?.items.find(item => item.id === spec.withdrawId);
        assert.ok(item); assert.notEqual(item.status, 'verified');
      });
      observations.check(`${spec.id}: UI reflects user withdrawal`, () => assert.equal(withdrawn.ui[0]?.goal, 'satisfied'));
    }
    if (spec.askThenResume) await runBlockedAskResume({ ...harness, observations }, {
      setScript: next => { current = next; round = 0; },
      holdBeforeTools: () => { held = { arrived: deferred(), release: deferred(), used: false, beforeTools: true }; return held; },
    }, observed);
    record('p2-case-executed', { case: spec.id });
  }
  async function run(scenario) {
    const fixture = await page.evaluate(async () => {
      const saved = await qa.store.flush();
      if (saved.kind !== 'saved') throw new Error(`Fixture save failed: ${saved.kind}`);
      const live = qa.store.getCurrent(), map = live.maps[live.startMapId];
      return { mapId: map.id, width: map.width, height: map.height, receipt: saved.receipt, title: live.system.titleScreen?.title };
    });
    const persisted = await harness.observeRemote('p2-fixture');
    assert.equal(persisted.observedIdentity, fixture.receipt.contentIdentity);
    report.fixture = fixture; report.lastAppliedTitle = fixture.title;
    const cases = p2Scenarios({ ...fixture, titleToken: harness.titleToken });
    for (const spec of cases.matrix) for (const calls of spec.rounds) for (const call of calls) {
      if (call.name === 'set_title_screen') ownedTitles.add(call.args.title);
    }
    let selected;
    switch (scenario) {
      case 'required-skip': selected = cases.required; break;
      case 'outcome-matrix': selected = cases.matrix.map(spec => ({ ...spec, bridge: true })); break;
      default: throw new Error(`Unknown P2 scenario: ${scenario}`);
    }
    report.caseFailures = [];
    for (const spec of selected) {
      try { await runCase(spec); }
      catch (error) {
        if (!(error instanceof Error)) throw error;
        report.caseFailures.push({ case: spec.id, name: error.name, message: error.message, stack: error.stack });
        record('p2-case-failed', report.caseFailures.at(-1));
        held?.release.resolve(); harness.clearProofGate();
        // Do not continue through an unsettled turn or hide transport/fixture failure.
        if (!(error instanceof assert.AssertionError)) throw error;
      }
    }
    assert.deepEqual(report.errors, [], 'No hidden route/page errors');
    assert.equal(report.caseFailures.length, 0, 'Every P2 case completed its real actions');
    assert.equal(report.contractChecks.filter(check => !check.pass).length, 0, 'P2 real-surface contracts violated; see contractChecks');
    report.assertionsPassed = true;
    record('PASS', { scenario, cases: selected.length });
  }
  return { run, respond, intercept, ownsTitle: title => ownedTitles.has(title), release: () => held?.release.resolve() };
}
