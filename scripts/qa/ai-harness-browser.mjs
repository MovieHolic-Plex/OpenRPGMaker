import assert from 'node:assert/strict';

export async function installBrowserProbe(page, fixture) {
  await page.evaluate(async ({ projectId, ownerTitle, reload = false }) => {
    const [sm, em, mode, sessionModule, cfg] = await Promise.all([import('/src/project/store.ts'), import('/src/editor/editorState.ts'),
      import('/src/app/mode.ts'), import('/src/ai/assistantSession.ts'), import('/src/project/supabaseProjectConfig.ts')]);
    if (sm.store !== window.__oprnEditorStore || sm.store.isRemotePersistenceEnabled() !== reload) throw new Error('Store boot isolation failed');
    if (reload && (sm.store.getProjectIdentity().kind !== 'remote' || sm.store.getProjectIdentity().id !== projectId)) throw new Error('Reload did not adopt the owned remote project');
    if (cfg.supabaseProjectConfig().projectId !== projectId) throw new Error('Wrong isolated project config');
    window.qa = { store: sm.store, editor: em.editorState, mode, events: [], disposers: [], sessionCount: 0 };
    qa.nextRender = () => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('postrender deadline')), 10000);
      mode.getGame().events.once('postrender', () => { clearTimeout(timer); resolve(); });
    });
    if (!reload) {
      qa.store.update(draft => { draft.meta.title = ownerTitle; });
      await qa.store.flush(); // Disabled boot flush clears only this fixture's debounce.
      qa.store._setPersistedBaselineForTest(null);
      qa.store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
    }
    const original = sessionModule.AssistantSession.prototype.sendUserMessage;
    const originalProof = sessionModule.AssistantSession.prototype.proveAppliedRevision;
    const seen = new WeakSet();
    const observe = callback => event => {
      callback(event);
      if (seen.has(event)) return;
      seen.add(event);
      qa.events.push(structuredClone(event));
      if (event.type === 'persistence_proof' && event.state.status === 'attempted' && event.state.receipt) qa.proofWaiting = true;
    };
    sessionModule.AssistantSession.prototype.proveAppliedRevision = function(onEvent = () => {}, signal) {
      return originalProof.call(this, observe(onEvent), signal);
    };
    sessionModule.AssistantSession.prototype.sendUserMessage = async function(text, onEvent = () => {}, signal, options) {
      if (qa.session !== this) { qa.sessionCount++; qa.session = this; }
      qa.turnOptions = structuredClone(options);
      const result = await original.call(this, text, observe(onEvent), signal, options);
      // Keep the actual returned object: ordinary apply settles it after send resolves.
      qa.result = result; return result;
    };
    qa.disposers.push(() => {
      sessionModule.AssistantSession.prototype.sendUserMessage = original;
      sessionModule.AssistantSession.prototype.proveAppliedRevision = originalProof;
    });
    await qa.nextRender();
  }, fixture);
}

export function browserSurface(harness) {
  const { page, report, record, out } = harness;
  async function capture(label) {
    const state = await page.evaluate(async () => {
      await qa.nextRender();
      const proof = qa.session?.getRunEndProof() ?? null;
      const live = qa.store.getCurrent();
      return { proof, title: live.system.titleScreen?.title, metaTitle: live.meta.title,
        mapId: qa.editor.get().currentMapId, sameStore: qa.store === window.__oprnEditorStore,
        remoteEnabled: qa.store.isRemotePersistenceEnabled(), dirty: qa.store.hasUnsavedChanges(),
        sameLiveObject: !qa.capturedLive || live === qa.capturedLive,
        sameLiveBytes: !qa.capturedJson || JSON.stringify(live) === qa.capturedJson,
        sessionCount: qa.sessionCount, result: qa.result,
        toolCalls: qa.events.filter(e => e.type === 'tool_call').map(e => ({ name: e.name, ok: e.result.ok })),
        workItems: qa.session?.getHarnessSnapshot().workPlan?.layers.flatMap(l => l.items.map(i => ({ id: i.id, status: i.status }))),
        savedAuditTokens: qa.session?.getAuditEntries().filter(e => e.kind === 'status' && e.text.split(' ')[0] === 'agent_run_saved').length ?? 0,
        sendDisabled: document.querySelector('[data-testid="ai-send"]').disabled };
    });
    report.states[label] = state;
    record('state', { label, state });
    await page.screenshot({ path: `${out}/${label}.png` });
    assert.equal(state.sameStore, true);
    assert.equal(state.remoteEnabled, true);
    return state;
  }
  async function send(text, { deferDeadline = false } = {}) {
    // Subscribe to the exact busy->idle transition before the click, not timer polling.
    await page.evaluate(deferDeadline => {
      qa.settled = new Promise((resolve, reject) => {
        const send = document.querySelector('[data-testid="ai-send"]');
        let busy = false, timer, done = false;
        qa.startSettleDeadline = () => {
          if (!done && timer === undefined) timer = setTimeout(() => {
            done = true; observer.disconnect(); reject(new Error('Turn settle deadline'));
          }, 60000);
        };
        const observer = new MutationObserver(() => {
          if (send.disabled) busy = true;
          if (busy && !send.disabled) { done = true; clearTimeout(timer); observer.disconnect(); resolve(); }
        });
        observer.observe(send, { attributes: true, attributeFilter: ['disabled'] });
        if (!deferDeadline) qa.startSettleDeadline();
        qa.disposers.push(() => { done = true; clearTimeout(timer); observer.disconnect(); resolve(); });
      });
      void qa.settled.catch(() => {});
    }, deferDeadline);
    record('composer-send', { text });
    await page.getByTestId('ai-input').fill(text);
    await page.getByTestId('ai-send').click();
  }
  return { capture, send, settled: () => page.evaluate(() => qa.settled) };
}
