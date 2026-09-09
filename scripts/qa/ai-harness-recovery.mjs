// Native recovery contract, loaded by ai-harness-contracts.mjs --scenario recovery.
// Only model HTTP is scripted. Positive checkpoint bytes are always runtime-authored.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { installBrowserProbe } from './ai-harness-browser.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export async function recoverySourceManifest(root) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  const paths = ['src/ai/assistantSession.ts', 'src/ai/aiRecordDb.ts', 'src/ai/runCheckpointStore.ts',
    'src/ai/runRecovery.ts', 'src/ai/conversationStore.ts', 'src/ai/llmClient.ts', 'src/ai/imageDelivery.ts',
    'src/ai/mapVisualEvidence.ts', 'src/ai/independentReview.ts', 'src/editor/panels/aiChatPanel.ts',
    'src/editor/panels/aiProposalCard.ts', 'src/editor/panels/aiTurnRunner.ts', 'src/editor/mapEditHistory.ts',
    'src/editor/tools/applyChangesetToStore.ts', 'src/project/store.ts', 'src/project/projectCommitLog.ts',
    'src/project/supabaseProjectSync.ts', 'src/project/supabaseProjectConfig.ts', 'src/project/defaults.ts',
    'test/aiRunRecoveryRuntime.test.ts', 'test/aiRunRecoveryAdmission.test.ts', 'test/independentReviewFixture.ts',
    'test/wikiTransportFixture.ts', 'scripts/qa/ai-harness-recovery.mjs', 'scripts/qa/ai-harness-contracts.mjs',
    'scripts/qa/ai-harness-browser.mjs', 'scripts/qa/ai-harness-cleanup.mjs', 'scripts/qa/ai-harness-vite.config.mjs',
    'vite.config.ts'].sort();
  return { scope: 'Explicit recovery runtime, native fixture, transport, and harness entry files; not a whole-tree hash',
    paths, head: git(['rev-parse', 'HEAD']).trim(), dirty: git(['status', '--porcelain=v1', '--untracked-files=all', '--', ...paths]),
    hashes: Object.fromEntries(await Promise.all(paths.map(async path => [path, hash(await readFile(resolve(root, path)))]))) };
}

// Served-code-only observation/fault seam; exact original bytes are hashed in server.log.
// The hold is AFTER the real commit transport returns, but BEFORE apply/final transcript settlement.
export function recoveryTransform(code, id) {
  let target, replacement;
  const hook = (name, type, args) => `(globalThis as typeof globalThis & { ${name}?: ${type} }).${name}?.(${args})`;
  if (id.endsWith('/src/project/projectCommitLog.ts')) {
    target = '  return {\n    commitId: result.kind === "saved" ? result.commitId ?? null : null,';
    replacement = `  await ${hook('__qaRecoveryCommit', '(input: unknown, result: unknown) => Promise<void>', 'input, result')};\n${target}`;
  } else if (id.endsWith('/src/editor/tools/applyChangesetToStore.ts')) {
    target = '): Promise<ApplyProposedProjectResult> {\n';
    replacement = target + `  ${hook('__qaRecoveryApply', '() => void', '')};\n`;
  } else if (id.endsWith('/src/editor/panels/aiTurnRunner.ts')) {
    target = '      deps.surface.persistConversation({ id: turnConversationId, scope: turnConversationScope, entries: turnEntries }); //';
    replacement = `      ${hook('__qaRecoveryFinalSave', '() => void', '')};\n${target}`;
  } else return;
  assert.equal(code.split(target).length, 2, `Recovery seam matches exactly once: ${id}`);
  let observed = code.replace(target, replacement);
  if (id.endsWith('/src/editor/panels/aiTurnRunner.ts')) {
    const finish = '    const finishTurn = (): void => {\n      if (terminalPublished) return;';
    const caught = '      turnCatchError = cause instanceof Error ? cause.message : String(cause);';
    for (const seam of [finish, caught]) assert.equal(observed.split(seam).length, 2, `Recovery runner observation matches once: ${id}`);
    observed = observed.replace(finish, finish + `\n      ${hook('__qaRecoveryRunnerFinished', '(result: unknown) => void',
      '{ stoppedReason: turnResult?.stoppedReason, error: turnCatchError ?? turnResult?.error, runOutcome: turnResult?.runOutcome, aborted: abortController.signal.aborted }')};`)
      .replace(caught, caught + `\n      ${hook('__qaRecoveryRunnerError', '(error: string) => void', 'turnCatchError')};`);
  }
  console.log('QA_RECOVERY_OBSERVER=' + JSON.stringify({ path: id, sourceHash: hash(code), transformedHash: hash(observed) }));
  return { code: observed, map: null };
}

export function createRecoveryContracts(harness) {
  const { page, report, record, out, projectId, ownerTitle, bounded, llmCalls } = harness;
  const evaluate = (...args) => bounded(page.evaluate(...args), 'native recovery browser operation');
  let phase = 'setup', round = 0, map, marker, crashHoldArmed = false;
  const reviews = [];
  const instruction = `${projectId}: Create exactly one recovery marker at (2,2) on the current map, with no other changes.`;
  const counts = () => ({ llm: llmCalls(), writes: report.actions.filter(action => action.type === 'browser-real-transport'
    && ['POST', 'PATCH', 'DELETE'].includes(action.method)).length });

  async function deliverImages(body) {
    const positions = [];
    for (const [messageIndex, message] of body.messages.entries()) {
      if (!Array.isArray(message.content)) continue;
      for (const [partIndex, part] of message.content.entries()) {
        if (part.type !== 'image_url') continue;
        assert.match(part.image_url.url, /^data:image\/png;base64,/, 'Native renderer must deliver actual PNG bytes');
        const bytes = Buffer.from(part.image_url.url.split(',')[1], 'base64');
        assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
        const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
        assert.ok(width > 1 && height > 1, 'No one-pixel lifecycle substitute');
        const sha256 = hash(bytes);
        await writeFile(`${out}/image-${sha256}.png`, bytes);
        positions.push({ messageIndex, partIndex });
        record('native-image-delivery', { phase, messageIndex, partIndex, sha256, width, height, bytes: bytes.length });
      }
    }
    return positions;
  }
  function review(body, input) {
    assert.ok(['missing-image', 'original'].includes(phase), 'Recovery must make zero model calls');
    const images = body.messages.flatMap(message => Array.isArray(message.content) ? message.content.filter(part => part.type === 'image_url') : []);
    const findings = input.requiredProblems.map((problem, index) => ({ id: `required-${index}`, target: 'draft',
      problem, requestedChange: 'Resolve the required problem', validation: problem }));
    const verdict = findings.length ? 'changes_requested' : 'approved';
    if (phase === 'original' && verdict === 'approved') assert.ok(images.length, 'Map approval needs native image delivery');
    reviews.push({ phase, revision: input.revision, requiredProblems: input.requiredProblems, verdict, images: images.length });
    record('recovery-review', reviews.at(-1));
    return { role: 'assistant', content: JSON.stringify({ revision: input.revision, verdict, summary: 'Native recovery scoped review', findings }) };
  }
  async function respond(body) {
    assert.ok(['missing-image', 'original'].includes(phase), `Unexpected LLM call during ${phase}; never replay the original command`);
    if (!body.tools?.length) return { role: 'assistant', content: JSON.stringify({ mode: 'other', space: 'none',
      needsPlan: false, useSelection: false, clarify: null, tools: [], resetsContext: false }) };
    let call;
    if (round++ === 0) call = { name: 'upsert_event', args: { mapId: map.id, event: { ...marker,
      id: phase === 'missing-image' ? `${marker.id}-refused` : marker.id } } };
    else if (phase === 'original' && round === 2) call = { name: 'show_map_region', args: { mapId: map.id, x: 0, y: 0, w: map.width, h: map.height } };
    if (!call) return { role: 'assistant', content: 'QA_RECOVERY_FINAL' };
    assert.ok(body.tools.some(tool => tool.function.name === call.name), `Native tool exposed: ${call.name}`);
    record('recovery-scripted-tool', { phase, round, ...call });
    return { role: 'assistant', content: '', tool_calls: [{ id: `recovery_${phase}_${round}`, type: 'function',
      function: { name: call.name, arguments: JSON.stringify(call.args) } }] };
  }

  async function install() {
    await evaluate(async () => {
      const [sessions, tools, db, checkpoints, history, visual] = await Promise.all([
        import('/src/ai/assistantSession.ts'), import('/src/editor/tools/index.ts'), import('/src/ai/aiRecordDb.ts'),
        import('/src/ai/runCheckpointStore.ts'), import('/src/editor/mapEditHistory.ts'), import('/src/ai/mapVisualEvidence.ts')]);
      qa.recovery = { creates: 0, applyEntries: 0, appliedMutations: 0, finalSaves: 0, prepared: [], mutations: [] };
      qa.nativeRows = async () => {
        if (await db.aiRecordBackendKind() !== 'indexeddb') throw new Error('Native IndexedDB required');
        // One real readonly transaction captures both stores at one point in time.
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(db.AI_RECORD_DB_NAME, db.AI_RECORD_DB_VERSION);
          request.onerror = () => reject(request.error);
          request.onupgradeneeded = () => { request.transaction.abort(); reject(new Error('Expected existing native DB')); };
          request.onsuccess = () => {
            const connection = request.result;
            const tx = connection.transaction([db.AI_RECORD_STORES.conversations, db.AI_RECORD_STORES.runCheckpoints], 'readonly');
            const conversations = tx.objectStore(db.AI_RECORD_STORES.conversations).getAll();
            const checkpoints = tx.objectStore(db.AI_RECORD_STORES.runCheckpoints).getAll();
            tx.oncomplete = () => { connection.close(); resolve({ name: connection.name, version: connection.version,
              conversations: conversations.result, checkpoints: checkpoints.result }); };
            tx.onabort = tx.onerror = () => { connection.close(); reject(tx.error ?? new Error('Native snapshot failed')); };
          };
        });
      };
      qa.latest = async () => {
        const key = qa.session?.getRunIdentity() ?? qa.recoveryKey;
        if (!key) throw new Error('Missing runtime-owned checkpoint key');
        const result = await checkpoints.readLatestRunCheckpoint(key.conversationId, key.projectId, key.projectContextKey);
        if (!result.durable) throw new Error('Checkpoint is not durable');
        return result;
      };
      qa.recoverySnapshot = async (trace = () => {}) => {
        trace('snapshot-render-started'); await qa.nextRender(); trace('snapshot-render-completed');
        const project = qa.store.getCurrent(), current = project.maps[project.startMapId];
        trace('snapshot-idb-started'); const idb = await qa.nativeRows(); trace('snapshot-idb-completed');
        trace('snapshot-checkpoint-read-started');
        const latest = qa.session?.getRunIdentity() || qa.recoveryKey ? await qa.latest() : null;
        trace('snapshot-checkpoint-read-completed');
        return { idb, latest,
          identity: qa.store.getProjectIdentity(), project, eventCount: current.events.length,
          markerCount: current.events.filter(event => event.id === qa.markerId).length,
          visual: visual.mapVisualContent(current), counters: structuredClone(qa.recovery), events: qa.events,
          history: { entries: history.getMapEditHistoryEntries(), redo: history.getMapEditRedoEntries(), revision: history.getMapEditHistoryRevision() },
          recoveryState: document.querySelector('[data-testid="ai-run-recovery"]')?.dataset.state ?? null,
          continueCount: document.querySelectorAll('[data-testid="ai-run-continue"]').length,
          busy: document.querySelector('[data-testid="ai-send"]').disabled,
          result: qa.result ?? null, runIdentity: qa.session?.getRunIdentity() ?? null };
      };
      const tool = tools.getTool('upsert_event');
      if (!tool) throw new Error('Missing native upsert_event');
      const create = tool.run;
      tool.run = function(...args) { qa.recovery.creates++; return Reflect.apply(create, this, args); };
      const prototype = sessions.AssistantSession.prototype;
      const prepare = prototype.prepareCheckpointApply, applied = prototype.recordAppliedMutation;
      prototype.prepareCheckpointApply = async function(...args) {
        await Reflect.apply(prepare, this, args);
        // This observation completes before the caller can enter actual apply.
        const key = this.getRunIdentity();
        const read = await checkpoints.readLatestRunCheckpoint(key.conversationId, key.projectId, key.projectContextKey);
        if (!read.durable || read.kind !== 'found' || read.checkpoint.pending?.stage !== 'applying') throw new Error('Apply lacks durable preparation');
        qa.recovery.prepared.push({ checkpoint: read.checkpoint, idb: await qa.nativeRows(), applyEntries: qa.recovery.applyEntries,
          eventCount: qa.store.getCurrent().maps[qa.store.getCurrent().startMapId].events.length });
      };
      prototype.recordAppliedMutation = function(...args) { qa.recovery.appliedMutations++; return Reflect.apply(applied, this, args); };
      globalThis.__qaRecoveryApply = () => { qa.recovery.applyEntries++; };
      globalThis.__qaRecoveryFinalSave = () => { qa.recovery.finalSaves++; };
      qa.disposers.push(qa.store.subscribe((_project, change) => qa.recovery.mutations.push(structuredClone(change))));
      qa.disposers.push(() => { tool.run = create; prototype.prepareCheckpointApply = prepare; prototype.recordAppliedMutation = applied;
        delete globalThis.__qaRecoveryApply; delete globalThis.__qaRecoveryFinalSave; delete globalThis.__qaRecoveryCommit;
        delete globalThis.__qaRecoveryRunnerFinished; delete globalThis.__qaRecoveryRunnerError; });
    });
  }
  async function snapshot(label, capturedCrash = false) {
    const state = { ...await evaluate(capturedCrash => capturedCrash ? qa.crashState : qa.recoverySnapshot(), capturedCrash), transport: counts() };
    const evidence = JSON.stringify(state, null, 2) + '\n';
    await writeFile(`${out}/${label}.json`, evidence);
    report.states[label] = { file: `${label}.json`, sha256: hash(evidence), bytes: Buffer.byteLength(evidence),
      transport: state.transport, eventCount: state.eventCount, markerCount: state.markerCount,
      recoveryState: state.recoveryState };
    await page.screenshot({ path: `${out}/${label}.png` });
    record('native-recovery-state', { label, transport: state.transport, counters: { creates: state.counters.creates,
      applyEntries: state.counters.applyEntries, appliedMutations: state.counters.appliedMutations,
      finalSaves: state.counters.finalSaves, prepared: state.counters.prepared.length }, 
      eventCount: state.eventCount, markerCount: state.markerCount, recoveryState: state.recoveryState });
    return state;
  }
  async function saveRead(label) {
    const save = await evaluate(() => qa.store.flush());
    assert.equal(save.kind, 'saved', `Real save: ${label}`);
    const remote = await bounded(harness.observeRemote(label), `owned remote read: ${label}`);
    assert.equal(remote.observedIdentity, save.receipt.contentIdentity);
    await writeFile(`${out}/${label}-remote.json`, JSON.stringify({ receipt: save.receipt, ...remote }, null, 2) + '\n');
    return save.receipt;
  }
  async function reload(key, label) {
    phase = 'reload';
    const beforeCalls = llmCalls();
    // Strip the blank bootstrap flag without navigating. reload() itself must load real Supabase content.
    await evaluate(() => { const url = new URL(location.href); url.searchParams.delete('blankProject'); history.replaceState(null, '', url); });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await evaluate(() => globalThis.__qaNativeEditorReady);
    await installBrowserProbe(page, { projectId, ownerTitle, reload: true });
    await install();
    await evaluate(async ({ key, markerId }) => { qa.recoveryKey = key; qa.markerId = markerId;
      await (await import('/src/editor/panels/aiChatPanel.ts')).whenAiChatPanelSettled(); }, { key, markerId: marker.id });
    assert.equal(llmCalls(), beforeCalls, 'Full reload never sends the old command');
    return snapshot(label);
  }
  async function clickContinueAndSettle() {
    // Register before triggering; whenAiChatPanelSettled also drains native persistence work.
    await evaluate(() => {
      qa.recoveryClickDone = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { observer.disconnect(); reject(new Error('Recovery control transition deadline')); }, 60000);
        const observer = new MutationObserver(() => {
          if (!document.querySelector('[data-testid="ai-run-continue"]')) { clearTimeout(timer); observer.disconnect(); resolve(); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        qa.disposers.push(() => { clearTimeout(timer); observer.disconnect(); resolve(); });
      });
      void qa.recoveryClickDone.catch(() => {});
    });
    await page.getByTestId('ai-run-continue').click();
    await evaluate(async () => { await qa.recoveryClickDone;
      await (await import('/src/editor/panels/aiChatPanel.ts')).whenAiChatPanelSettled();
      if (qa.session) await qa.session.whenCheckpointed(); });
  }
  function noWrites(before, after) {
    assert.deepEqual(after.transport, before.transport, 'No model call or remote write from recovery admission/continue');
    assert.equal(after.counters.creates, before.counters.creates);
    assert.equal(after.counters.applyEntries, before.counters.applyEntries);
    assert.equal(after.counters.appliedMutations, before.counters.appliedMutations);
    assert.deepEqual(after.counters.mutations, before.counters.mutations, 'No hidden store mutation notification');
    assert.equal(after.events.filter(event => event.type === 'tool_call' && event.name === 'upsert_event').length,
      before.events.filter(event => event.type === 'tool_call' && event.name === 'upsert_event').length);
    assert.deepEqual(after.history, before.history, 'No duplicate undo or redo entry');
    assert.deepEqual(after.project, before.project, 'No project write/replay');
    assert.equal(after.markerCount, 1);
    assert.equal(after.eventCount, before.eventCount);
  }
  async function run() {
    // Installed before any reload, then subscribed before application scripts run in each new realm.
    await page.addInitScript(() => {
      globalThis.__qaNativeEditorReady = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { observer.disconnect(); reject(new Error('Editor canvas deadline')); }, 60000);
        const observer = new MutationObserver(() => {
          if (document.querySelector('.phaser-container canvas')) { clearTimeout(timer); observer.disconnect(); resolve(); }
        });
        observer.observe(document, { childList: true, subtree: true });
      });
      void globalThis.__qaNativeEditorReady.catch(() => {});
    });
    await install();
    await saveRead('fixture-initial-save');
    const loaded = await evaluate(() => qa.store.reloadFromRemote({ force: true }));
    assert.equal(loaded.kind, 'reloaded'); assert.equal(loaded.projectId, projectId);
    await evaluate(async () => {
      const config = await import('/src/ai/llmClient.ts'); const previous = config.loadAiConfig();
      config.saveAiConfig({ ...previous, liteModel: previous.model, agentMode: 'chat', maxToolCalls: 12 });
      await (await import('/src/editor/panels/aiChatPanel.ts')).whenAiChatPanelSettled();
    });
    map = await evaluate(() => { const map = qa.store.getCurrent().maps[qa.store.getCurrent().startMapId];
      return { id: map.id, width: map.width, height: map.height }; });
    marker = { id: 'native-recovery-marker', x: 2, y: 2, trigger: { kind: 'action' }, commands: [], pages: [{
      id: 'native-recovery-page', name: 'Marker', conditions: [], graphic: { transparent: true }, trigger: { kind: 'action' },
      priority: 'same', movement: { type: 'fixed', speed: 3, frequency: 3 }, commands: [] }] };
    await evaluate(markerId => { qa.markerId = markerId; }, marker.id);
    const baseline = await snapshot('00-native-fixture');
    assert.equal(baseline.identity.kind, 'remote'); assert.equal(baseline.identity.id, projectId);
    assert.equal(baseline.markerCount, 0);

    // Real reviewer refusal control: transparent events STILL change the native visual projection.
    phase = 'missing-image'; round = 0;
    await page.getByTestId('ai-new-chat').click(); await page.getByTestId('ai-composer-mode-do').click();
    await harness.send(`${projectId}: Create one marker at (2,2).`); await bounded(harness.settled(), 'missing-image refusal');
    await evaluate(async () => { await (await import('/src/editor/panels/aiChatPanel.ts')).whenAiChatPanelSettled(); });
    const refused = await snapshot('01-required-image-refused');
    assert.deepEqual(refused.project, baseline.project);
    assert.deepEqual(refused.history, baseline.history);
    assert.equal(refused.counters.applyEntries, 0);
    assert.ok(reviews.some(review => review.phase === 'missing-image' && review.verdict === 'changes_requested'
      && review.requiredProblems.some(problem => problem.startsWith('show_map_region:'))));
    assert.ok(refused.events.some(event => event.type === 'result_review' && event.review.status !== 'approved'));

    await page.getByTestId('ai-new-chat').click(); await page.getByTestId('ai-composer-mode-do').click();
    // Subscribe in Node before triggering the original turn. Tiny console payloads remain
    // observable even if an evaluate awaits a queue, a renderer, or a large IDB snapshot.
    const unexpectedTerminal = Promise.withResolvers(); void unexpectedTerminal.promise.catch(() => {});
    report.crashTrace = [];
    const traceConsole = message => {
      const prefix = 'QA_RECOVERY_TRACE=';
      if (!message.text().startsWith(prefix)) return;
      const trace = JSON.parse(message.text().slice(prefix.length));
      report.crashTrace.push(trace); record('native-crash-observation', trace);
      if (['runner-finished', 'runner-error', 'commit-hook-error'].includes(trace.stage)) {
        unexpectedTerminal.reject(new Error(`Original runner escaped crash boundary: ${JSON.stringify(trace)}`));
      }
    };
    page.on('console', traceConsole);
    await evaluate(() => { qa.events = []; qa.result = undefined; qa.recovery = { creates: 0, applyEntries: 0,
      appliedMutations: 0, finalSaves: 0, prepared: [], mutations: [] };
      qa.crashTrace = [];
      qa.traceCrash = (stage, detail = {}) => {
        const entry = { sequence: qa.crashTrace.length + 1, stage, ...detail };
        qa.crashTrace.push(entry); console.info('QA_RECOVERY_TRACE=' + JSON.stringify(entry));
      };
      qa.crashArrived = Promise.withResolvers(); void qa.crashArrived.promise.catch(() => {});
      qa.crashHold = Promise.withResolvers(); void qa.crashHold.promise.catch(() => {});
      globalThis.__qaRecoveryRunnerFinished = result => qa.traceCrash('runner-finished', { result });
      globalThis.__qaRecoveryRunnerError = error => qa.traceCrash('runner-error', { error });
      globalThis.__qaRecoveryCommit = async (input, result) => {
        qa.traceCrash('commit-hook-entry', { tools: input.toolNames, kind: result.kind, commitId: result.commitId });
        if (!input.toolNames?.includes('upsert_event')) { qa.traceCrash('commit-hook-unrelated'); return; }
        try {
          if (qa.crashEntered) throw new Error('Duplicate native commit boundary'); qa.crashEntered = true;
          if (result.kind !== 'saved' || !result.commitId) throw new Error('Actual remote tool commit did not succeed');
          const owner = qa.session;
          qa.traceCrash('checkpoint-await-started', { key: owner.getRunIdentity(),
            appliedMutations: qa.recovery.appliedMutations, finalSaves: qa.recovery.finalSaves });
          await owner.whenCheckpointed();
          qa.traceCrash('checkpoint-await-completed');
          qa.traceCrash('recovery-snapshot-started');
          qa.crashState = await qa.recoverySnapshot(qa.traceCrash);
          qa.traceCrash('recovery-snapshot-completed');
          // Keep the full snapshot in its realm; transfer it only once in the labeled capture.
          qa.crashArrived.resolve({ result });
          qa.traceCrash('crash-arrived');
          // Owned by the bounded driver; page.reload destroys this await without releasing it.
          await qa.crashHold.promise;
        } catch (error) {
          qa.traceCrash('commit-hook-error', { error: String(error?.stack ?? error) });
          qa.crashArrived.reject(error); throw error;
        }
      };
    });
    crashHoldArmed = true; phase = 'original'; round = 0;
    let seam, crash;
    try {
      await harness.send(instruction, { deferDeadline: true });
      // sendUserMessage's result is NOT runner completion: it precedes actual apply.
      // Race the real held boundary against the runner's actual finish/catch seams
      // and the existing subscribe-before-click busy->idle signal, at the same 60s bound.
      seam = await bounded(Promise.race([page.evaluate(() => qa.crashArrived.promise), unexpectedTerminal.promise,
        harness.settled().then(() => { throw new Error('Original runner became idle before crash arrival'); })]),
      'native crash arrival versus runner completion/error');
      crash = await snapshot('02-crash-after-native-apply', true);
    } catch (error) {
      const diagnostic = { error: String(error?.stack ?? error), lastStage: report.crashTrace.at(-1) ?? null, trace: report.crashTrace };
      await writeFile(`${out}/crash-observation-failure.json`, JSON.stringify(diagnostic, null, 2) + '\n');
      throw new Error(`${diagnostic.error}\nLast observed crash stage: ${JSON.stringify(diagnostic.lastStage)}`, { cause: error });
    } finally { page.off('console', traceConsole); }
    const saved = crash.latest.checkpoint, key = crash.runIdentity;
    assert.equal(crash.latest.kind, 'found'); assert.equal(crash.latest.durable, true);
    assert.equal(saved.status, 'active'); assert.equal(saved.pending, null);
    assert.equal(saved.applied.calls.length, 1); assert.equal(saved.applied.calls[0].name, 'upsert_event');
    assert.equal(saved.applied.calls[0].args.event.id, marker.id);
    assert.equal(saved.request.text, instruction);
    assert.equal(crash.counters.creates, 1); assert.equal(crash.counters.applyEntries, 1); assert.equal(crash.counters.appliedMutations, 1);
    assert.equal(crash.counters.finalSaves, 0, 'Crash precedes final runner transcript save'); assert.equal(crash.busy, true);
    assert.equal(crash.counters.prepared.length, 1); const prepared = crash.counters.prepared[0];
    assert.equal(prepared.applyEntries, 0); assert.equal(prepared.eventCount, baseline.eventCount);
    assert.equal(prepared.checkpoint.pending.stage, 'applying'); assert.equal(prepared.checkpoint.applied, null);
    assert.equal(crash.markerCount, 1); assert.equal(crash.eventCount, baseline.eventCount + 1);
    assert.equal(crash.history.entries.length, baseline.history.entries.length + 1);
    assert.notDeepEqual(crash.visual, baseline.visual, 'Transparent marker is still authored map visual content');
    assert.ok(crash.events.some(event => event.type === 'tool_call' && event.name === 'show_map_region' && event.result.ok));
    assert.ok(reviews.some(review => review.phase === 'original' && review.verdict === 'approved' && review.images > 0));
    assert.ok(crash.idb.conversations.find(row => row.id === key.conversationId)?.entries.some(entry => entry.kind === 'user' && entry.text.includes(instruction)));
    report.crashBoundary = { commit: seam.result, key, finalSaveNotReached: true, originalInstruction: instruction };
    // Real project persistence is separate from the blocked final conversation save.
    await saveRead('applied-before-reload');
    const pointInTime = await snapshot('03-durable-crash-image');
    assert.deepEqual(pointInTime.idb.checkpoints, crash.idb.checkpoints);
    const restored = await reload(key, '04-native-reload'); crashHoldArmed = false;
    assert.equal(restored.recoveryState, 'resumable'); assert.equal(restored.continueCount, 1);
    assert.equal(restored.markerCount, 1); assert.equal(restored.eventCount, crash.eventCount);
    assert.deepEqual(restored.idb, pointInTime.idb, 'Native DB survives full reload without copied rows');
    assert.deepEqual(restored.latest.checkpoint, saved);
    assert.equal(restored.counters.applyEntries, 0); assert.equal(restored.counters.creates, 0);

    // Click-time content drift: actual store mutation/save, no checkpoint rewriting.
    const description = restored.project.meta.description;
    await evaluate(() => qa.store.update(draft => { draft.meta.description = 'QA native recovery content drift'; }));
    await saveRead('changed-project');
    const changedBefore = await snapshot('05-changed-project-before-continue');
    phase = 'changed-project'; await clickContinueAndSettle();
    const changedAfter = await snapshot('06-changed-project-refused');
    noWrites(changedBefore, changedAfter); assert.equal(changedAfter.recoveryState, 'needs-reconciliation');
    assert.equal(changedAfter.continueCount, 0); assert.deepEqual(changedAfter.idb, changedBefore.idb);
    // Revert ONLY the test's human description change via the actual store and real save.
    await evaluate(description => qa.store.update(draft => { if (description === undefined) delete draft.meta.description;
      else draft.meta.description = description; }), description);
    await saveRead('changed-project-restored');
    const clean = await reload(key, '07-original-content-reloaded');
    assert.equal(clean.recoveryState, 'resumable'); assert.deepEqual(clean.latest.checkpoint, saved);

    // Deliberately corrupt only the version field of the actual runtime row. Never seed a success row.
    await evaluate(async () => {
      const db = await import('/src/ai/aiRecordDb.ts'), cp = await import('/src/ai/runCheckpointStore.ts');
      const key = qa.recoveryKey, id = cp.runCheckpointId(key);
      qa.unsupportedOriginal = (await qa.nativeRows()).checkpoints.find(row => row.id === id);
      const result = await db.mutateAiRecord(db.AI_RECORD_STORES.runCheckpoints, id, current => ({ ...current, schemaVersion: cp.RUN_CHECKPOINT_SCHEMA_VERSION + 1 }));
      if (result.backend !== 'indexeddb' || !result.written) throw new Error('Native unsupported-row fault injection failed');
    });
    const unsupportedBefore = await snapshot('08-unsupported-before-continue');
    phase = 'unsupported'; await clickContinueAndSettle();
    const unsupportedAfter = await snapshot('09-unsupported-refused');
    noWrites(unsupportedBefore, unsupportedAfter); assert.equal(unsupportedAfter.recoveryState, 'unsupported');
    assert.equal(unsupportedAfter.continueCount, 0); assert.deepEqual(unsupportedAfter.idb, unsupportedBefore.idb);
    // Remove precisely the injected fault. Equality below binds the resumed row to the untouched crash image.
    await evaluate(async () => { const db = await import('/src/ai/aiRecordDb.ts'); const row = qa.unsupportedOriginal;
      const result = await db.mutateAiRecord(db.AI_RECORD_STORES.runCheckpoints, row.id, current => ({ ...current, schemaVersion: row.schemaVersion }));
      if (result.backend !== 'indexeddb' || !result.written) throw new Error('Native fault restoration failed'); });
    const beforeContinue = await reload(key, '10-ready-for-native-continue');
    assert.deepEqual(beforeContinue.latest.checkpoint, saved);
    assert.deepEqual(beforeContinue.idb, pointInTime.idb, 'Exact runtime-authored crash rows, no synthetic success fixture');
    phase = 'continue'; await clickContinueAndSettle();
    const afterContinue = await snapshot('11-native-continue-settled');
    noWrites(beforeContinue, afterContinue);
    assert.equal(afterContinue.busy, false); assert.equal(afterContinue.counters.finalSaves, 1);
    const successor = afterContinue.latest.checkpoint;
    assert.equal(afterContinue.latest.kind, 'found'); assert.ok(successor.epoch > saved.epoch); assert.notEqual(successor.runId, saved.runId);
    assert.deepEqual(successor.request, saved.request); assert.deepEqual(successor.applied.calls, saved.applied.calls);
    assert.deepEqual(successor.workPlan, saved.workPlan); assert.equal(successor.pending, null);
    assert.equal(afterContinue.result.proposedCalls.length, 0);
    assert.deepEqual(afterContinue.result.appliedCalls, saved.applied.calls);
    const conversation = afterContinue.idb.conversations.find(row => row.id === key.conversationId);
    assert.ok(conversation.entries.some(entry => entry.kind === 'user' && entry.text.includes(instruction)));
    assert.equal(conversation.entries.filter(entry => entry.kind === 'tool' && entry.name === 'upsert_event').length, 1);
    const originalRow = pointInTime.idb.checkpoints.find(row => row.runId === saved.runId && row.epoch === saved.epoch);
    assert.deepEqual(afterContinue.idb.checkpoints.find(row => row.id === originalRow.id), originalRow, 'Retired original run never completes after reload');
    report.recovery = { reviews, originalRequestRetained: true, appliedHistoryRetained: true,
      nativeReload: true, duplicateCreates: 0, duplicateApplies: 0, duplicateUndoEntries: 0,
      llmCallsBeforeReload: pointInTime.transport.llm, llmCallsAfterContinue: afterContinue.transport.llm,
      negativeCases: ['missing-map-image', 'changed-project-click-time', 'unsupported-version-click-time'] };
    report.assertionsPassed = true;
  }
  return { run, respond, review, deliverImages, ownsTitle: title => title === ownerTitle,
    intercept: async () => false,
    release: () => { if (crashHoldArmed) record('crash-hold-abandoned-by-browser-cleanup'); } };
}
