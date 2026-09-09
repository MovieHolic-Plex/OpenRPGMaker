import assert from 'node:assert/strict';

// R1 adapter: script only LLM transport; observe the actual Panel/session/apply receipts.
export function createR1AskContracts(harness) {
  const { page, report, record, bounded, deferred, projectId, ownerTitle, out } = harness;
  const titles = new Set([ownerTitle]);
  let script, round = 0, held;
  function arm(next) { script = next; round = 0; }
  async function respond(body) {
    assert.ok(script, 'Transport must belong to an armed R1 turn');
    if (!body.tools?.length) return { role: 'assistant', content: JSON.stringify({
      mode: script.question ? 'question' : 'other', space: 'none', needsPlan: false,
      useSelection: false, clarify: null, tools: [], resetsContext: false,
    }) };
    if (script.title && round++ === 0) {
      assert.ok(body.tools.some(tool => tool.function.name === 'set_title_screen'));
      return { role: 'assistant', content: '', tool_calls: [{ id: 'r1_title', type: 'function',
        function: { name: 'set_title_screen', arguments: JSON.stringify({ title: script.title, reason: 'R1 owned title draft' }) } }] };
    }
    if (held && !held.used) {
      held.used = true;
      held.arrived.resolve();
      await bounded(held.release.promise, 'R1 successful draft before cancellation');
    }
    return { role: 'assistant', content: 'QA_FINAL' };
  }
  async function capture(label) {
    const state = await page.evaluate(() => ({
      result: qa.result, getter: qa.session.getRunOutcome(), harnessOutcome: qa.session.getHarnessSnapshot().runOutcome,
      activityOutcome: qa.activity?.result.runOutcome, activityRecap: qa.activity?.result.recap?.runOutcome,
      options: qa.turnOptions, receipts: qa.r1Receipts,
      events: qa.events.filter(event => ['tool_call', 'run_outcome', 'milestone_applied'].includes(event.type)),
      ui: [...document.querySelectorAll('[data-testid="ai-run-outcome"]')].filter(node => node.getClientRects().length)
        .map(node => ({ execution: node.dataset.execution, goal: node.dataset.goal, delivery: node.dataset.delivery,
          imageDelivery: node.dataset.imageDelivery ?? null })),
      sameProjectBytes: JSON.stringify(qa.store.getCurrent()) === qa.r1Before,
      title: qa.store.getCurrent().system.titleScreen?.title,
      draftTitle: qa.session.getProposedProject().system.titleScreen?.title,
      remoteEnabled: qa.store.isRemotePersistenceEnabled(), proof: qa.session.getRunEndProof(),
    }));
    report.states[label] = state;
    record('r1-observation', { label, ...state });
    await page.screenshot({ path: `${out}/${label}.png` });
    return state;
  }
  async function armActivity(instruction) {
    await page.evaluate(instruction => {
      const existingIds = new Set(JSON.parse(localStorage.getItem('oprn:ai-activity-logs') ?? '[]').map(row => row.id));
      const original = Storage.prototype.setItem;
      qa.activityDone = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { Storage.prototype.setItem = original; reject(new Error('R1 activity deadline')); }, 60000);
        Storage.prototype.setItem = function(key, value) {
          original.call(this, key, value);
          if (this !== localStorage || key !== 'oprn:ai-activity-logs') return;
          // Repeated Continue text must not select a historical terminal row.
          const row = JSON.parse(value).find(row => !existingIds.has(row.id) && row.instruction.includes(instruction)
            && row.result.stoppedReason && !row.result.pending);
          if (row) { clearTimeout(timer); Storage.prototype.setItem = original; qa.activity = row; resolve(); }
        };
        qa.disposers.push(() => { clearTimeout(timer); Storage.prototype.setItem = original; resolve(); });
      });
    }, instruction);
  }
  async function send(text) {
    await armActivity(text);
    await harness.send(text);
    await harness.settled();
    await page.evaluate(() => qa.activityDone);
  }
  function assertQuestion(state) {
    // 질문은 자료 이미지를 요청에 싣지 않는다 — 첨부는 거짓이고 "모름"으로 승격되지 않는다.
    const expected = { execution: 'response-final', goal: 'unassessed', delivery: 'no-change',
      imageAttached: false, visualDelivery: { attempted: 0, attached: 0 } };
    const expectedUi = { execution: 'response-final', goal: 'unassessed', delivery: 'no-change', imageDelivery: 'unattached' };
    assert.equal(state.sameProjectBytes, true, 'Ask preserves exact live project bytes');
    assert.equal(state.receipts.length, 0, 'Ask does not reach a successful ordinary or milestone apply');
    assert.deepEqual(state.result.proposedCalls, [], 'Ask returns no apply-eligible calls');
    assert.deepEqual(state.result.appliedCalls, []);
    for (const actual of [state.result.runOutcome, state.result.recap.runOutcome, state.getter,
      state.harnessOutcome, state.activityOutcome, state.activityRecap]) assert.deepEqual(actual, expected);
    assert.deepEqual(state.ui[0], expectedUi);
    assert.equal(state.remoteEnabled, true);
  }
  async function run() {
    // Fresh owned remote fixture; no shared project is opened or written.
    const saved = await page.evaluate(async () => {
      const result = await qa.store.flush();
      if (result.kind !== 'saved') throw new Error(`R1 fixture save: ${result.kind}`);
      return result.receipt;
    });
    assert.equal((await harness.observeRemote('r1-initial-fixture')).observedIdentity, saved.contentIdentity);
    await page.evaluate(async () => {
      const { AssistantSession } = await import('/src/ai/assistantSession.ts');
      const original = AssistantSession.prototype.recordAppliedProject;
      qa.r1Receipts = [];
      AssistantSession.prototype.recordAppliedProject = function(applied) {
        qa.r1Receipts.push({ commit: applied.commit, title: applied.applied.system.titleScreen?.title });
        return original.call(this, applied);
      };
      qa.disposers.push(() => { AssistantSession.prototype.recordAppliedProject = original; });
      const config = await import('/src/ai/llmClient.ts');
      const previous = config.loadAiConfig();
      config.saveAiConfig({ ...previous, liteModel: previous.model, agentMode: 'chat', maxToolCalls: 8 });
    });
    for (const kind of ['explicit', 'inferred']) {
      const title = `${ownerTitle} ${kind}`;
      titles.add(title);
      await page.getByTestId('ai-new-chat').click();
      await page.getByTestId('ai-composer-mode-do').click();
      await page.evaluate(() => {
        qa.r1Before = JSON.stringify(qa.store.getCurrent()); qa.r1Receipts = []; qa.events = [];
      });
      arm({ title });
      held = { arrived: deferred(), release: deferred(), used: false };
      const instruction = `${projectId}/${kind}: set the title`;
      await armActivity(instruction);
      await harness.send(instruction);
      await bounded(held.arrived.promise, 'R1 next request after successful real title tool');
      const inFlight = await capture(`${kind}-01-draft-before-abort`);
      assert.ok(inFlight.events.some(event => event.type === 'tool_call' && event.name === 'set_title_screen' && event.result.ok));
      assert.equal(inFlight.draftTitle, title);
      assert.equal(inFlight.sameProjectBytes, true);
      // The result subscription and transport gate exist before the real abort click.
      await page.getByTestId('ai-abort').click();
      held.release.resolve();
      await harness.settled(); await page.evaluate(() => qa.activityDone);
      held = undefined;
      const cancelled = await capture(`${kind}-02-cancelled`);
      assert.equal(cancelled.result.stoppedReason, 'aborted');
      assert.equal(cancelled.result.proposedCalls.length, 1);
      assert.equal(cancelled.receipts.length, 0);
      assert.equal(cancelled.sameProjectBytes, true);
      arm({ question: kind === 'inferred' });
      if (kind === 'explicit') await page.getByTestId('ai-composer-mode-ask').click();
      await send(`${projectId}/${kind}: why did you stop?`);
      const question = await capture(`${kind}-03-question`);
      assertQuestion(question);
      assert.equal(question.draftTitle, title);
      // Typed Continue in Ask is not the explicit Do/resume action.
      await page.getByTestId('ai-composer-mode-ask').click();
      arm({});
      await send('계속');
      const stillAsk = await capture(`${kind}-04-typed-continue-in-ask`);
      assertQuestion(stillAsk);
      assert.equal(stillAsk.draftTitle, title);
      // Authorize resume through the real composer, not injected session options.
      await page.getByTestId('ai-composer-mode-do').click();
      arm({});
      await send('계속');
      const resumed = await capture(`${kind}-05-authorized-resume`);
      assert.equal(resumed.options.composerMode, 'do');
      assert.equal(resumed.receipts.length, 1);
      assert.equal(resumed.title, title);
      assert.deepEqual(resumed.result.proposedCalls, []);
      assert.equal(resumed.result.appliedCalls.length, 1);
      assert.equal(resumed.result.runOutcome.delivery, 'persisted-verified');
      assert.equal(resumed.proof.verified, true);
      assert.equal((await harness.observeRemote(`${kind}-resumed`)).observedIdentity, resumed.proof.receipt.contentIdentity);
      await send('계속');
      const repeated = await capture(`${kind}-06-no-replay`);
      assert.equal(repeated.receipts.length, 1);
      assert.equal(repeated.events.filter(event => event.type === 'tool_call' && event.name === 'set_title_screen').length, 1);
      // Real undo UI, with an exact store-change subscription armed before the click.
      await page.evaluate(() => {
        qa.r1Undo = new Promise((resolve, reject) => {
          const timer = setTimeout(() => { unsubscribe(); reject(new Error('R1 undo deadline')); }, 10000);
          const unsubscribe = qa.store.subscribe(() => {
            if (JSON.stringify(qa.store.getCurrent()) === qa.r1Before) { clearTimeout(timer); unsubscribe(); resolve(); }
          });
          qa.disposers.push(() => { clearTimeout(timer); unsubscribe(); resolve(); });
        });
      });
      await page.getByTestId('oprn-tool-undo').click();
      await page.evaluate(() => qa.r1Undo);
      const undone = await capture(`${kind}-07-undo`);
      assert.equal(undone.sameProjectBytes, true);
      const undoReceipt = await page.evaluate(async () => {
        const result = await qa.store.flush();
        if (result.kind !== 'saved') throw new Error(`R1 undo save: ${result.kind}`);
        return result.receipt;
      });
      assert.equal((await harness.observeRemote(`${kind}-undo`)).observedIdentity, undoReceipt.contentIdentity);
    }
    assert.deepEqual(report.errors, []);
    report.assertionsPassed = true;
    record('PASS', { scenario: 'retained-draft-ask', explicitAsk: true, inferredQuestion: true,
      applyReceiptsPerLifecycle: [0, 0, 0, 1, 1], transportOnlyScripted: true, remoteUndoVerified: true });
  }
  return { run, respond, intercept: async () => false, ownsTitle: title => titles.has(title), release: () => held?.release.resolve() };
}
