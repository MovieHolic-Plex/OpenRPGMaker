import assert from 'node:assert/strict';

// goalAction is host API-only: this adapter mounts an explicitly labelled API surface,
// not a fictitious shipped new-goal button. It runs the real session, runner and
// production proposal host. Only LLM/preparation HTTP inputs are scripted.
export function createNewGoalDraftContracts(harness) {
  const { page, report, record, ownerTitle, projectId, out } = harness;
  let script = {}, round = 0, fault = null;
  function arm(next = {}) { script = next; round = 0; }
  async function respond(body) {
    if (!body.tools?.length) return { role: 'assistant', content: JSON.stringify({
      mode: 'other', space: 'none', needsPlan: false, useSelection: false,
      clarify: null, tools: [], resetsContext: false,
    }) };
    if (script.tool && round++ === 0) {
      assert.ok(body.tools.some(tool => tool.function.name === script.tool));
      return { role: 'assistant', content: '', tool_calls: [{ id: 'r21_write', type: 'function',
        function: { name: script.tool, arguments: JSON.stringify(script.args) } }] };
    }
    return { role: 'assistant', content: 'QA_FINAL' };
  }
  async function interceptPreparation(route) {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/qa-r21/')) return false;
    assert.ok(['/qa-r21/wiki', '/qa-r21/intent'].includes(path));
    const status = path === `/qa-r21/${fault}` ? 503 : 204;
    record('scripted-preparation-http', { path, status });
    await route.fulfill({ status, body: status === 503 ? 'R21 owned preparation failure' : '' });
    return true;
  }
  async function capture(label) {
    const state = await page.evaluate(() => ({
      result: qa.result, getter: qa.session.getRunOutcome(), recap: qa.result.recap?.runOutcome,
      harnessOutcome: qa.session.getHarnessSnapshot().runOutcome, options: qa.turnOptions,
      calls: qa.r21.calls, events: qa.events, proof: qa.session.getRunEndProof(),
      sameLiveBytes: JSON.stringify(qa.store.getCurrent()) === qa.r21.before,
      sameDraftBytes: JSON.stringify(qa.session.getProposedProject()) === qa.r21.before,
      oldResultUnchanged: !qa.r21.old || JSON.stringify(qa.r21.old) === qa.r21.oldBytes,
      title: qa.store.getCurrent().system.titleScreen?.title,
      draftTitle: qa.session.getProposedProject().system.titleScreen?.title,
      items: qa.store.getCurrent().database.items.filter(item => item.id.startsWith('item_r21_')),
      remoteEnabled: qa.store.isRemotePersistenceEnabled(),
    }));
    report.states[label] = state; record('r21-native-api-observation', { label, ...state });
    await page.screenshot({ path: `${out}/${label}.png` });
    assert.equal(state.remoteEnabled, true);
    return state;
  }
  async function send(text, options, abortTitle) {
    record('native-runner-api-send', { text, options, abortTitle, shippedNewGoalButton: false });
    await page.evaluate(({ text, options, abortTitle }) => qa.r21.send(text, options, abortTitle), { text, options, abortTitle });
  }
  async function run() {
    const saved = await page.evaluate(async () => {
      const result = await qa.store.flush();
      if (result.kind !== 'saved') throw new Error(`R21 fixture save: ${result.kind}`);
      return result.receipt;
    });
    assert.equal((await harness.observeRemote('r21-initial-fixture')).observedIdentity, saved.contentIdentity);
    report.surface = { newGoal: 'trusted SessionTurnOptions API via real native runner/proposal host',
      shippedNewGoalButton: false, preparationFault: 'HTTP 503 in constructor-injected preparation adapters; no outcome injection',
      askControl: 'separate unchanged retained-draft-ask scenario uses shipped composer/abort/undo' };
    for (const boundary of ['wiki', 'intent', 'success']) {
      fault = null;
      await page.evaluate(async ({ projectId, boundary }) => {
        const [{ AssistantSession }, { createAiTurnRunner }, { createProposalHost }, llm, intent, wiki, conversation] = await Promise.all([
          import('/src/ai/assistantSession.ts'), import('/src/editor/panels/aiTurnRunner.ts'),
          import('/src/editor/panels/aiProposalCard.ts'), import('/src/ai/llmClient.ts'),
          import('/src/ai/intentDeclarationClient.ts'), import('/src/editor/projectWikiCoordinator.ts'),
          import('/src/editor/panels/aiConversationLog.ts'),
        ]);
        intent.resetIntentDeclarationCache();
        const config = { ...llm.loadAiConfig(), agentMode: 'chat', maxToolCalls: 8 };
        config.liteModel = config.model; llm.saveAiConfig(config);
        const coordinator = wiki.createProjectWikiCoordinator();
        const declarer = intent.createLlmIntentDeclarer({ getConfig: () => config });
        const preparation = async (boundary, signal) => {
          const response = await fetch(`/qa-r21/${boundary}`, { signal });
          if (!response.ok) throw new Error(`R21 ${boundary} preparation HTTP ${response.status}`);
        };
        const session = new AssistantSession(qa.store.getCurrent(), { config,
          prepareProjectWiki: async input => { await preparation('wiki', input.signal); return coordinator.prepare(input); },
          declareIntent: async (facts, signal) => { await preparation('intent', signal); return declarer(facts, signal); },
        });
        const panel = document.createElement('section');
        panel.setAttribute('aria-label', 'QA trusted new-goal API surface (not shipped UI)');
        const label = document.createElement('h3'); label.textContent = `QA native runner API: ${boundary}`; panel.append(label);
        const log = document.createElement('div'); const sendButton = document.createElement('button');
        sendButton.textContent = 'QA API observation only'; sendButton.disabled = true;
        panel.append(log, sendButton); document.body.append(panel);
        qa.disposers.push(() => panel.remove());
        const noop = () => {};
        const controller = { session, auditHistory: [], statusTimeline: [] };
        const appendBubble = (role, text) => conversation.appendConversationBubble({ log, role, text, removeStartScreen: noop });
        const proposal = createProposalHost({ proposalNoticeHost: log, controller, appendBubble, setStatus: noop });
        const state = { before: JSON.stringify(qa.store.getCurrent()), calls: [] };
        const surface = { panel, log, sendButton, controller, turnBusy: false, disposed: false, abortNoticeShown: false,
          activeAbortController: null, collapseAfterAiWork: false, collapsed: false,
          conversationId: `${projectId}-${boundary}`, conversationScope: projectId, runningPhaseStatus: null, runningProgress: null,
          setStatus: noop, beginTurnProgress: noop, endTurnProgress: noop, refreshRunningStatus: noop, refreshAbortButton: noop,
          startLiveActivity: noop, completeLiveActivity: noop, expandForAiWork: noop, scheduleCollapseAfterAiWork: noop,
          notifyIfObscuredByTestPlay: noop, drainPendingSends: noop, persistConversation: noop, sendText: async () => {},
          appendBubble, appendReasoning: () => ({ box: document.createElement('div'), body: document.createElement('div') }),
          closeToolActivity: noop, clearLastReasoning: noop, isLastReasoningBox: () => false };
        const runner = createAiTurnRunner({ surface, applyingProposal: false, projectIdentityId: projectId, workPlanSurfaceState: null,
          applyProposal: async (calls, bubble) => {
            const outcome = await proposal.applyProposal(calls, bubble);
            state.calls.push({ calls: structuredClone(calls), outcome }); return outcome;
          },
          noteNoChanges: noop, beginWorkPlanTurn: noop, settleWorkPlanTurn: noop, refreshWorkPlanSurface: noop,
          showWorkPlan: noop, showAcceptance: noop, noteWorkPlanActivity: noop, appendMilestoneFeedLine: noop,
          appendTileThumbs: noop, appendTileGrid: noop, appendAiDocument: noop, hasPendingQuestion: () => false,
          openAiSettings: noop, renderQuickReplies: noop, refreshContextMeter: noop });
        state.send = async (text, options, abortTitle) => {
          await runner.executeTurn(session, text, (onEvent, signal) => session.sendUserMessage(text, event => {
            onEvent(event);
            if (event.type === 'tool_call' && event.name === 'set_title_screen' && event.result.ok && event.args.title === abortTitle)
              surface.activeAbortController.abort();
          }, signal, options), options);
        };
        qa.r21 = state; qa.events = [];
      }, { projectId, boundary });
      const oldTitle = `${ownerTitle} abandoned ${boundary}`;
      arm({ tool: 'set_title_screen', args: { title: oldTitle } });
      await send(`${projectId}/${boundary}: old title`, { composerMode: 'do' }, oldTitle);
      const old = await capture(`${boundary}-01-cancelled-old`);
      assert.equal(old.result.stoppedReason, 'aborted'); assert.equal(old.calls.length, 0);
      assert.equal(old.sameLiveBytes, true); assert.equal(old.draftTitle, oldTitle);
      assert.equal(old.result.proposedCalls.length, 1);
      assert.ok(old.events.some(event => event.type === 'tool_call' && event.name === 'set_title_screen' && event.result.ok));
      await page.evaluate(() => { qa.r21.old = qa.result; qa.r21.oldBytes = JSON.stringify(qa.result); });
      fault = boundary === 'success' ? null : boundary; arm();
      await send(`${projectId}/${boundary}: inspect a completely different goal`, { composerMode: 'do', goalAction: 'new-goal' });
      const entered = await capture(`${boundary}-02-new-owner`);
      // 새 목표 진입도 이미지 전달과 무관하다 — 축은 서로 성공을 빌리지 않는다.
      const expected = { execution: boundary === 'success' ? 'response-final' : 'failed', goal: 'unassessed', delivery: 'no-change',
        imageAttached: false, visualDelivery: { attempted: 0, attached: 0 } };
      assert.equal(entered.result.stoppedReason, boundary === 'success' ? 'final' : 'error');
      for (const outcome of [entered.result.runOutcome, entered.getter, entered.recap, entered.harnessOutcome]) assert.deepEqual(outcome, expected);
      assert.equal(entered.calls.length, 0); assert.equal(entered.sameLiveBytes, true); assert.equal(entered.sameDraftBytes, true);
      assert.equal(entered.oldResultUnchanged, true); assert.deepEqual(entered.result.proposedCalls, []);
      fault = null; arm();
      await send(`${projectId}/${boundary}: resume new owner`, { composerMode: 'do', goalAction: 'resume' });
      const resumed = await capture(`${boundary}-03-resume-no-write`);
      assert.equal(resumed.calls.length, 0); assert.equal(resumed.sameLiveBytes, true); assert.equal(resumed.sameDraftBytes, true);
      const itemId = `item_r21_${boundary}`;
      arm({ tool: 'upsert_item', args: { item: { id: itemId, name: `New owner ${boundary}`, price: 21 } } });
      await send(`${projectId}/${boundary}: add only the item`, { composerMode: 'do', goalAction: 'resume' });
      const written = await capture(`${boundary}-04-disjoint-applied`);
      assert.equal(written.calls.length, 1); assert.equal(written.calls[0].outcome, 'applied');
      assert.deepEqual(written.calls[0].calls.map(call => call.name), ['upsert_item']);
      assert.equal(written.title, old.title); assert.equal(written.oldResultUnchanged, true);
      assert.equal(written.items.find(item => item.id === itemId)?.name, `New owner ${boundary}`);
      assert.equal(written.result.runOutcome.delivery, 'persisted-verified'); assert.equal(written.proof.verified, true);
      assert.equal((await harness.observeRemote(`${boundary}-disjoint`)).observedIdentity, written.proof.receipt.contentIdentity);
      arm(); await send(`${projectId}/${boundary}: resume again`, { composerMode: 'do', goalAction: 'resume' });
      const repeated = await capture(`${boundary}-05-no-replay`);
      assert.equal(repeated.calls.length, 1); assert.equal(repeated.title, old.title); assert.equal(repeated.oldResultUnchanged, true);
    }
    assert.deepEqual(report.errors, []); report.assertionsPassed = true;
    record('PASS', { scenario: 'new-goal-draft', boundaries: ['wiki', 'intent', 'success'],
      oldDraftCancelledBeforeNewEntry: true, disjointWriteAppliedExactlyOnce: true, remoteContentVerified: true });
  }
  return { run, respond, interceptPreparation, intercept: async () => false, ownsTitle: title => title === ownerTitle, release: () => {} };
}
