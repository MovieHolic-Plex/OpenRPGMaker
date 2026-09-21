// Backend-neutral browser observations for the AI lifetime contracts.
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
