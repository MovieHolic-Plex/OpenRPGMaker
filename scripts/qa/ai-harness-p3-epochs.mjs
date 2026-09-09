import assert from 'node:assert/strict';

// Opt-in P3 native race. Only HTTP inputs are held/scripted. All session/tool,
// mutation, apply receipt, proof, activity, bridge and DOM facts are observed.
export function createEpochContracts(harness) {
  const { page, report, record, deferred, bounded, projectId, ownerTitle, out } = harness;
  let current, round = 0, held;
  const gates = [];
  const title = `${ownerTitle} applied-A`;
  const itemId = 'item_p3_replacement_b';
  const checks = report.contractChecks = [];
  const check = (label, assertion) => {
    try { assertion(); checks.push({ label, pass: true }); }
    catch (error) {
      if (!(error instanceof assert.AssertionError)) throw error;
      const failure = { label, pass: false, message: error.message, actual: error.actual, expected: error.expected, stack: error.stack };
      checks.push(failure); record('contract-violation', failure);
    }
  };
  const arm = (id, tool, args, seam) => {
    current = { id, tool, args }; round = 0;
    held = seam ? { id, seam, used: false, arrived: deferred(), release: deferred(), completed: deferred() } : null;
    if (held) gates.push(held);
    return held;
  };
  async function respond(body) {
    assert.ok(current, 'Unarmed LLM request is setup failure');
    const script = current;
    const system = body.messages?.[0]?.content;
    if (typeof system === 'string' && system.startsWith('REQUEST_COVERAGE_AUDIT\n')) {
      assert.equal(typeof script.instruction, 'string');
      assert.ok(body.messages.some(message => message.role === 'user' && typeof message.content === 'string'
        && message.content.includes(script.instruction)), 'Coverage must belong to the exact armed request');
      assert.ok(['set_title_screen', 'upsert_item'].includes(script.tool), 'Read-only controls do not request authoring coverage');
      const criteria = script.tool === 'set_title_screen'
        ? [{ kind: 'projectTitle', title: script.args.title },
          { kind: 'projectPreserve', scope: 'authored', allowedChanges: [{ kind: 'projectTitle' }] }]
        : [{ kind: 'itemValues', itemId: script.args.item.id, name: script.args.item.name, price: script.args.item.price },
          { kind: 'projectPreserve', scope: 'authored', allowedChanges: [{ kind: 'itemAddition', itemId: script.args.item.id }] }];
      if (script.id === 'commit-A') criteria.push({ kind: 'wikiDeclaration',
        documentId: 'w_p3_native_epoch', combatMode: 'contact',
        sourceQuote: 'Record my preference for contact battles with visible monsters as an explicit wiki declaration, not implemented combat.',
      });
      const requirements = [{ text: script.instruction, criteria }];
      record('epoch-request-coverage', { owner: script.id, requirements });
      return { role: 'assistant', content: JSON.stringify({ requirements }) };
    }
    if (!body.tools?.length) return { role: 'assistant', content: JSON.stringify({
      mode: script.tool === 'get_project_summary' ? 'question' : 'modify', space: 'none', useSelection: false, needsPlan: false, clarify: null,
      resetsContext: false, tools: [script.tool], summary: script.id, action: 'direct',
    }) };
    const first = round++ === 0;
    const gate = held;
    if (!first && gate?.seam === 'llm' && !gate.used) {
      gate.used = true; record('deferred-arrived', { owner: script.id, seam: gate.seam }); gate.arrived.resolve();
      await bounded(gate.release.promise, 'late LLM transport release');
      record('deferred-released', { owner: script.id, seam: gate.seam }); gate.completed.resolve();
    }
    if (!first) return { role: 'assistant', content: 'QA_EPOCH_FINAL' };
    assert.ok(body.tools.some(tool => tool.function.name === script.tool), `Real tool exposed: ${script.tool}`);
    const calls = [{ id: `qa_epoch_${script.id}`, type: 'function', function: {
      name: script.tool, arguments: JSON.stringify({ ...script.args, reason: 'QA native ownership boundary' }),
    } }];
    record('epoch-scripted-input', { owner: script.id, calls });
    return { role: 'assistant', content: '', tool_calls: calls };
  }
  async function intercept(route, entry) {
    const gate = held;
    if (gate?.seam !== 'commit' || gate.used || entry.table !== 'project_changes' || entry.method !== 'POST') return false;
    // Match the actual A authoring commit, not a manual save or B's commit.
    const rows = route.request().postDataJSON();
    if (!rows.some(row => row.patch_json?.toolNames?.includes('set_title_screen'))) return false;
    gate.used = true;
    record('deferred-arrived', { owner: gate.id, seam: gate.seam, rows }); gate.arrived.resolve();
    await bounded(gate.release.promise, 'late real commit transport release');
    // This is the original request to real Supabase, never a fabricated commit.
    await route.continue();
    record('deferred-released', { owner: gate.id, seam: gate.seam }); gate.completed.resolve();
    return true;
  }
  function extract(body) {
    if (current?.id !== 'commit-A') return { role: 'assistant', content: JSON.stringify({ upserts: [] }) };
    const payload = JSON.parse(body.messages.at(-1).content);
    // The earlier control requests declare no wiki facts. Do not invent historical decisions.
    if (payload.sources.some(source => source.id.startsWith('history:')))
      return { role: 'assistant', content: JSON.stringify({ upserts: [] }) };
    record('epoch-wiki-input', { owner: current.id, sourceIds: payload.sources.map(source => source.id) });
    return { role: 'assistant', content: JSON.stringify({ upserts: [{
      id: 'w_p3_native_epoch', type: 'guideline', name: 'Contact combat', summary: 'Visible monsters start contact battles.',
      wiki: { kind: 'declaration', basis: 'explicit', combatMode: 'contact', sourceIds: payload.sources.map(source => source.id) },
    }] }) };
  }
  async function install() {
    await page.evaluate(async () => {
      const [{ AssistantSession }, config, activity] = await Promise.all([
        import('/src/ai/assistantSession.ts'), import('/src/ai/llmClient.ts'), import('/src/editor/editActivityLog.ts'),
      ]);
      const previous = config.loadAiConfig();
      config.saveAiConfig({ ...previous, liteModel: previous.model, agentMode: 'chat', autonomyLevel: 'balanced', maxToolCalls: 24 });
      const state = qa.epochs = { sessions: new Map(), observations: [], activities: {}, signals: new Map(),
        completions: new Map(), completionEvents: [], phase: 'setup' };
      const started = Date.now();
      const completionEvent = (type, data) => state.completionEvents.push({
        sequence: state.completionEvents.length + 1, type, phase: state.phase, atMs: Date.now() - started, ...data,
      });
      const signal = label => {
        const gate = Promise.withResolvers();
        const timer = setTimeout(() => gate.reject(new Error(`Epoch signal deadline: ${label}`)), 60000);
        void gate.promise.catch(error => { state.signalError = String(error); });
        state.signals.set(label, gate);
        qa.disposers.push(() => { clearTimeout(timer); gate.resolve(); });
        gate.promise.then(() => clearTimeout(timer), () => clearTimeout(timer));
        return gate;
      };
      state.arm = (label, owner) => {
        signal(label);
        if (owner === 'commit-A' || owner === 'commit-B') {
          state.completions.set(owner, { gate: signal(`proposal:${owner}`), calls: 0, status: 'armed' });
          completionEvent('proposal-observer-armed', { owner });
        }
      };
      const originalStorage = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        originalStorage.call(this, key, value);
        if (this !== localStorage || key !== 'oprn:ai-activity-logs') return;
        for (const row of JSON.parse(value)) {
          for (const [label, gate] of state.signals) {
            if (row.instruction.includes(label) && row.result.stoppedReason && !row.result.pending) {
              if (!state.activities[label]) completionEvent('terminal-activity', { instruction: label, activityId: row.id });
              state.activities[label] = structuredClone(row); gate.resolve();
            }
          }
        }
      };
      const proto = AssistantSession.prototype;
      const send = proto.sendUserMessage, applied = proto.recordAppliedProject, rebase = proto.rebaseProject;
      const ownerOf = session => [...state.sessions].find(([, entry]) => entry.session === session)?.[0] ?? 'unassigned';
      const previousObserver = globalThis.__qaObserveProposal;
      globalThis.__qaObserveProposal = (session, calls) => {
        // Capture the actual host session at invocation, never the later current B.
        const owner = ownerOf(session), entry = state.completions.get(owner);
        if (!entry) { state.signalError = `Unexpected proposal owner: ${owner}`; return; }
        entry.calls++;
        entry.status = 'pending';
        entry.tools = calls.map(call => call.name);
        completionEvent('proposal-invoked', { owner, calls: entry.calls, tools: entry.tools });
        return result => {
          Object.assign(entry, result);
          completionEvent('proposal-settled', { owner, ...result });
          entry.gate.resolve();
        };
      };
      qa.disposers.push(() => {
        if (previousObserver === undefined) delete globalThis.__qaObserveProposal;
        else globalThis.__qaObserveProposal = previousObserver;
      });
      proto.sendUserMessage = async function(text, onEvent, abortSignal, options) {
        const owner = state.nextOwner;
        const entry = { session: this, events: [], aborted: false, returned: false };
        state.sessions.set(owner, entry);
        const onAbort = () => { entry.aborted = true; };
        abortSignal.addEventListener('abort', onAbort, { once: true });
        qa.disposers.push(() => abortSignal.removeEventListener('abort', onAbort));
        const result = await send.call(this, text, event => {
          entry.events.push(structuredClone(event));
          state.observations.push({ kind: 'event', owner, phase: state.phase, type: event.type, name: event.name });
          onEvent(event);
        }, abortSignal, options);
        entry.result = result; entry.returned = true;
        return result;
      };
      proto.recordAppliedProject = function(value) {
        state.observations.push({ kind: 'apply-receipt', owner: ownerOf(this), phase: state.phase,
          commit: structuredClone(value.commit), wikiDelivery: value.wikiDelivery?.kind });
        return applied.call(this, value);
      };
      proto.rebaseProject = function(project) {
        state.observations.push({ kind: 'rebase', owner: ownerOf(this), phase: state.phase });
        return rebase.call(this, project);
      };
      qa.disposers.unshift(() => {
        Storage.prototype.setItem = originalStorage;
        proto.sendUserMessage = send; proto.recordAppliedProject = applied; proto.rebaseProject = rebase;
      });
      qa.disposers.push(activity.subscribeEditActivity(entry => {
        state.observations.push({ kind: 'edit', phase: state.phase, entry: structuredClone(entry) });
      }));
      const log = document.querySelector('[data-testid="ai-glass-log"]');
      const observer = new MutationObserver(records => {
        state.observations.push({ kind: 'dom', phase: state.phase, mutations: records.map(row => ({
          type: row.type, added: row.addedNodes.length, removed: row.removedNodes.length,
        })) });
      });
      observer.observe(log, { childList: true, subtree: true, characterData: true });
      qa.disposers.push(() => observer.disconnect());
    });
  }
  async function start(id, text) {
    const instruction = `${projectId}/${id}: ${text}`;
    assert.equal(current.id, id);
    current.instruction = instruction;
    await page.evaluate(({ id, instruction }) => { qa.epochs.nextOwner = id; qa.epochs.arm(instruction, id); }, { id, instruction });
    await harness.send(instruction);
    return instruction;
  }
  async function terminal(instruction) {
    await page.evaluate(instruction => qa.epochs.signals.get(instruction).promise, instruction);
  }
  async function arrived(gate, instruction) {
    await Promise.race([bounded(gate.arrived.promise, `${gate.id} ${gate.seam} arrival`),
      terminal(instruction).then(() => { throw new Error(`Setup: ${gate.id} terminated before ${gate.seam} seam`); })]);
  }
  async function completion(label, expected) {
    const state = await page.evaluate(label => {
      const epoch = qa.epochs;
      const entries = Object.fromEntries([...epoch.completions].map(([owner, { gate, ...entry }]) => [owner, entry]));
      return { label, entries, events: epoch.completionEvents, signalError: epoch.signalError };
    }, label);
    (report.completionBarriers ??= []).push(state);
    record('proposal-completion-barrier', state);
    assert.equal(state.signalError, undefined, 'Proposal observation must not fail');
    const entry = state.entries['commit-A'];
    assert.equal(entry.calls, 1, 'Exactly one real A proposal invocation');
    assert.deepEqual(entry.tools, ['set_title_screen'], 'Completion belongs to the actual A proposal');
    assert.equal(entry.status, expected, `A proposal barrier: ${label}`);
    if (expected === 'fulfilled') assert.equal(entry.value, 'applied', 'Original proposal return value observed');
    return state;
  }
  async function snapshot(label) {
    const state = await page.evaluate(async () => {
      await qa.nextRender();
      const epoch = qa.epochs;
      const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))]
        .map(byte => byte.toString(16).padStart(2, '0')).join('');
      const live = qa.store.getCurrent();
      const sessions = {};
      for (const [owner, entry] of epoch.sessions) sessions[owner] = {
        aborted: entry.aborted, returned: entry.returned, events: entry.events, result: entry.result,
        audit: entry.session.getAuditEntries(), harness: entry.session.getHarnessSnapshot(),
        outcome: entry.session.getRunOutcome(), proof: entry.session.getRunEndProof(),
        draftIdentity: await digest(entry.session.getProposedProject()),
      };
      const sessionIdentities = Object.fromEntries(await Promise.all(Object.entries(sessions).map(async ([owner, entry]) => [owner, await digest(entry)])));
      const bridge = window.__oprnAiBridge.harness();
      return { sessions, sessionIdentities, bridgeIdentity: await digest(bridge), observations: epoch.observations, activities: epoch.activities, signalError: epoch.signalError,
        liveIdentity: await digest(live), title: live.system.titleScreen?.title,
        items: live.database.items.filter(item => item.id.startsWith('item_p3_')), world: live.world,
        bridge,
        ui: [...document.querySelectorAll('[data-testid="ai-run-outcome"]')].filter(node => node.getClientRects().length)
          .map(node => ({ execution: node.dataset.execution, goal: node.dataset.goal, delivery: node.dataset.delivery })),
        transcriptRows: [...document.querySelectorAll('[data-testid="ai-command-row"]')].map(node => node.dataset.role),
        logHtml: document.querySelector('[data-testid="ai-glass-log"]').innerHTML,
        sendDisabled: document.querySelector('[data-testid="ai-send"]').disabled,
      };
    });
    report.states[label] = state;
    record('epoch-snapshot', { label, title: state.title, liveIdentity: state.liveIdentity, ui: state.ui });
    await page.screenshot({ path: `${out}/${label}.png` });
    assert.equal(state.signalError, undefined, 'Exact signal failure is setup failure, not behavioral RED');
    return state;
  }
  async function replace() {
    record('actual-editor-abort'); await page.getByTestId('ai-abort').click();
    record('actual-editor-new-conversation'); await page.getByTestId('ai-new-chat').click();
    await page.getByTestId('ai-composer-mode-do').click();
  }
  async function run() {
    report.behaviorStage = 'setup';
    const receipt = await page.evaluate(async () => {
      const saved = await qa.store.flush();
      if (saved.kind !== 'saved') throw new Error(`Epoch fixture save failed: ${saved.kind}`);
      return saved.receipt;
    });
    assert.equal((await harness.observeRemote('epoch-fixture')).observedIdentity, receipt.contentIdentity);
    await install(); await page.getByTestId('ai-composer-mode-do').click();

    // Positive control: cancelled fetch cannot authorize a late draft application.
    const controlGate = arm('control-A', 'set_title_screen', { title: `${ownerTitle} never-applied` }, 'llm');
    const controlA = await start('control-A', `Set the title to ${ownerTitle} never-applied; preserve all other authored content, allowing coordinator wiki bookkeeping.`);
    await arrived(controlGate, controlA);
    const controlDraft = await snapshot('01-control-A-draft');
    assert.ok(controlDraft.sessions['control-A'].events.some(event => event.type === 'tool_call' && event.name === 'set_title_screen' && event.result.ok));
    await replace();
    arm('control-B', 'get_project_summary', {});
    const controlB = await start('control-B', 'Inspect the project only.');
    await harness.settled(); await terminal(controlB);
    const controlBefore = await snapshot('02-control-B-before-late-A');
    assert.equal(controlGate.used, true);
    record('replacement-finished-before-release', { owner: 'control-B', seam: 'llm' });
    await page.evaluate(() => { qa.epochs.phase = 'control-late'; });
    controlGate.release.resolve(); await bounded(controlGate.completed.promise, 'control transport released'); await terminal(controlA);
    const controlAfter = await snapshot('03-control-B-after-late-A');
    check('protected LLM: no store mutation', () => assert.equal(controlAfter.liveIdentity, controlBefore.liveIdentity));
    check('protected LLM: B session unchanged', () => assert.equal(controlAfter.sessionIdentities['control-B'], controlBefore.sessionIdentities['control-B']));
    check('protected LLM: B bridge unchanged', () => assert.equal(controlAfter.bridgeIdentity, controlBefore.bridgeIdentity));
    check('protected LLM: no A apply receipt', () => assert.equal(controlAfter.observations.some(row => row.kind === 'apply-receipt' && row.owner === 'control-A'), false));
    check('protected LLM: no extra A tool after Abort', () => assert.equal(
      controlAfter.sessions['control-A'].events.filter(event => event.type === 'tool_started').length,
      controlDraft.sessions['control-A'].events.filter(event => event.type === 'tool_started').length));
    check('protected LLM: B transcript unchanged', () => assert.deepEqual(controlAfter.transcriptRows, controlBefore.transcriptRows));
    if (checks.some(check => !check.pass)) report.behaviorVerdict = 'CONTROL-FAILURE';
    assert.equal(checks.some(check => !check.pass), false, 'Existing LLM control must pass before regression');

    await page.getByTestId('ai-new-chat').click();
    await page.evaluate(() => { qa.epochs.phase = 'commit-A'; });
    const commitGate = arm('commit-A', 'set_title_screen', { title }, 'commit');
    const commitA = await start('commit-A', `Record my preference for contact battles with visible monsters as an explicit wiki declaration, not implemented combat. Set the title to ${title}; preserve all other authored content, allowing coordinator wiki bookkeeping.`);
    await arrived(commitGate, commitA);
    const appliedA = await snapshot('04-A-applied-commit-held');
    assert.equal(appliedA.title, title, 'A content really applied before cancel');
    assert.ok(appliedA.world.entities.some(entity => entity.id === 'w_p3_native_epoch'));
    const declarations = appliedA.world.entities.filter(entity => entity.id === 'w_p3_native_epoch');
    assert.equal(declarations.length, 1);
    const declaration = declarations[0];
    assert.equal(declaration.wiki.kind, 'declaration');
    assert.equal(declaration.wiki.basis, 'explicit');
    assert.equal(declaration.wiki.combatMode, 'contact');
    assert.ok(declaration.wiki.sources.some(source => source.kind === 'user' && source.text === commitA));
    assert.equal(appliedA.world.entities.some(entity => entity.wiki?.supersedes?.includes(declaration.id)), false);
    assert.equal(appliedA.sessions['commit-A'].returned, true, 'Ordinary apply is after real session return');
    await completion('A-commit-held-before-abort', 'pending');
    await replace();
    await page.evaluate(() => { qa.epochs.phase = 'replacement-B'; });
    arm('commit-B', 'upsert_item', { item: { id: itemId, name: 'Replacement B', price: 37 } });
    const commitB = await start('commit-B', `Add item ${itemId} named Replacement B with price 37; preserve all other authored content, allowing coordinator wiki bookkeeping.`);
    await harness.settled(); await terminal(commitB);
    const before = await snapshot('05-B-persisted-before-late-A');
    assert.equal(before.sessions['commit-A'].aborted, true, 'Real Abort signal reached A');
    assert.equal(before.sessions['commit-B'].aborted, false, 'B owns a different live signal');
    assert.equal(before.sessions['commit-B'].outcome.delivery, 'persisted-verified');
    assert.equal(before.sessions['commit-B'].proof.verified, true);
    assert.equal(before.items.find(item => item.id === itemId)?.price, 37);
    assert.equal(before.title, title);
    const remoteBefore = await harness.observeRemote('B-before-late-A');
    assert.equal(remoteBefore.observedIdentity, before.sessions['commit-B'].proof.receipt.contentIdentity);
    record('replacement-finished-before-release', { owner: 'commit-B', seam: 'commit', AStillHeld: true });
    await completion('B-finished-A-still-held', 'pending');
    report.behaviorStage = 'late-commit-release';
    await page.evaluate(() => {
      const epoch = qa.epochs;
      epoch.phase = 'late-A';
      epoch.completionEvents.push({ sequence: epoch.completionEvents.length + 1,
        type: 'commit-release-authorized', owner: 'commit-A', phase: epoch.phase });
    });
    // Both signals were installed before Send. On P2 terminal follows apply; on
    // P3 terminal may precede release, but the original host promise cannot.
    const finished = Promise.all([terminal(commitA), page.evaluate(() => qa.epochs.completions.get('commit-A').gate.promise)]);
    commitGate.release.resolve(); await bounded(commitGate.completed.promise, 'A original commit released');
    await finished;
    const barrier = await completion('A-host-and-terminal-finished-before-snapshot', 'fulfilled');
    const events = barrier.events;
    assert.ok(events.find(event => event.type === 'proposal-observer-armed' && event.owner === 'commit-A').sequence
      < events.find(event => event.type === 'proposal-invoked' && event.owner === 'commit-A').sequence);
    assert.ok(events.find(event => event.type === 'commit-release-authorized').sequence
      < events.find(event => event.type === 'proposal-settled' && event.owner === 'commit-A').sequence);
    assert.equal(barrier.entries['commit-B'].status, 'fulfilled', 'B current-owner apply also really settled');
    report.completionControlsPassed = true;
    const after = await snapshot('06-B-after-late-A');
    const remoteAfter = await harness.observeRemote('B-after-late-A');
    report.remoteComparison = { before: remoteBefore.observedIdentity, after: remoteAfter.observedIdentity };
    const late = after.observations.filter(row => row.phase === 'late-A');
    report.lateObservations = late;
    check('late A starts no extra tool', () => assert.equal(late.some(row => row.owner === 'commit-A' && row.kind === 'event' && row.type === 'tool_started'), false));
    check('already-applied A title stays', () => assert.equal(after.title, title));
    check('B item stays', () => assert.deepEqual(after.items, before.items));
    check('B store bytes unchanged by late A', () => assert.equal(after.liveIdentity, before.liveIdentity));
    check('B remote content unchanged by late A', () => assert.equal(remoteAfter.observedIdentity, remoteBefore.observedIdentity));
    check('late A starts no additional project mutation', () => assert.equal(late.filter(row => row.kind === 'edit').length, 0));
    check('late A never rebases replacement B', () => assert.equal(late.filter(row => row.kind === 'rebase' && row.owner === 'commit-B').length, 0));
    check('B session and proof unchanged by late A', () => assert.equal(after.sessionIdentities['commit-B'], before.sessionIdentities['commit-B']));
    check('B bridge unchanged by late A', () => assert.equal(after.bridgeIdentity, before.bridgeIdentity));
    check('B transcript unchanged by late A', () => assert.deepEqual(after.transcriptRows, before.transcriptRows));
    check('B terminal UI unchanged', () => assert.deepEqual(after.ui, before.ui));
    check('B remains idle', () => assert.equal(after.sendDisabled, false));
    check('B historical activity unchanged', () => assert.deepEqual(after.activities[commitB], before.activities[commitB]));
    assert.deepEqual(report.errors, [], 'No hidden route/page failures');
    report.behaviorStage = 'settled';
    report.behaviorVerdict = checks.some(check => !check.pass) ? 'RED' : 'GREEN';
    assert.equal(checks.filter(check => !check.pass).length, 0, 'P3 late-cancel violated: see contractChecks and lateObservations');
    report.assertionsPassed = true;
  }
  return { run, respond, extract, intercept, ownsTitle: candidate => candidate === ownerTitle || candidate === title,
    release: () => gates.forEach(gate => { gate.release.resolve(); gate.arrived.resolve(); gate.completed.resolve(); }) };
}
