import assert from 'node:assert/strict';

export function proofFailureResponse(titleToken) {
  let wrote = false;
  return body => {
    const system = body.messages?.[0]?.content;
    if (typeof system === 'string' && system.startsWith('REQUEST_COVERAGE_AUDIT\n')) {
      const instruction = `Use set_title_screen to set the title to ${titleToken}.`;
      assert.ok(body.messages.some(message => message.role === 'user'
        && typeof message.content === 'string' && message.content.includes(instruction)),
      'Coverage must belong to the exact P1 request');
      return { role: 'assistant', content: JSON.stringify({ requirements: [{ text: instruction,
        criteria: [{ kind: 'projectTitle', title: titleToken }],
      }] }) };
    }
    // Only the current exact Continue after the write is verification, not title authoring.
    const currentUser = body.messages?.findLast(message => message.role === 'user')?.content;
    const retry = wrote && typeof currentUser === 'string'
      && currentUser.startsWith('## 요청\n계속\n\n## 사실\n');
    if (!body.tools?.length) return { role: 'assistant', content: JSON.stringify({
      mode: retry ? 'other' : 'modify', space: 'none', needsPlan: !retry, useSelection: false, clarify: null,
      tools: retry ? [] : ['set_title_screen'], summary: 'P1 title proof', action: wrote ? 'resume' : 'new_plan',
      goal: 'Set the title screen', layers: [{ title: 'Title', items: [{ title: 'Title', instruction: 'set_title_screen', successTools: ['set_title_screen'] }] }],
    }) };
    if (!wrote) {
      assert.ok(body.tools.some(t => t.function.name === 'set_title_screen'));
      wrote = true;
      return { role: 'assistant', content: '', tool_calls: [{ id: 'qa_title_write', type: 'function',
        function: { name: 'set_title_screen', arguments: JSON.stringify({ title: titleToken, reason: 'P1 accepted revision proof' }) } }] };
    }
    return { role: 'assistant', content: 'QA_FINAL' };
  };
}

export async function runProofFailure(qa) {
  const { page, capture, armProof, send, bounded, observeRemote, rest, settled, report, record, projectId, ownerTitle, titleToken } = qa;
  const first = await armProof('actual remote content mismatch');
  await send(`Use set_title_screen to set the title to ${titleToken}.`);
  await bounded(first.arrived.promise, 'first accepted-save proof read');
  const pending = await capture('01-accepted-read-pending');
  assert.equal(pending.title, titleToken);
  assert.equal(pending.proof.status, 'attempted');
  const accepted = await observeRemote('accepted');
  const receipt = pending.proof.receipt;
  assert.equal(receipt.projectId, projectId);
  assert.equal(accepted.observedIdentity, receipt.contentIdentity);
  const changed = structuredClone(accepted.row.current_json);
  changed.meta.title = `${ownerTitle} remote mismatch`;
  assert.equal((await rest('projects', 'PATCH', { current_json: changed }, { title: `eq.${ownerTitle}` })).length, 1);
  const mismatch = await observeRemote('mismatched');
  assert.notEqual(mismatch.observedIdentity, receipt.contentIdentity);
  assert.equal(mismatch.row.current_sha256, receipt.sha256, 'Same wire hash must not hide changed content');
  first.release.resolve(); await bounded(first.completed.promise, 'read released'); await settled();
  const failed = await capture('02-proof-failed');
  // This is the mutation kill assertion: actual failed proof cannot be promoted by the session.
  assert.equal(failed.proof.verified, false, 'A real content-mismatched read must not be verified');
  assert.equal(failed.proof.status, 'failed'); assert.equal(failed.proof.reason, 'mismatch-content');
  assert.equal(failed.savedAuditTokens, 0);
  assert.equal(failed.sameLiveObject, true); assert.equal(failed.sameLiveBytes, true);
  assert.deepEqual(failed.toolCalls, [{ name: 'set_title_screen', ok: true }, { name: 'run_lint', ok: true }]);
  assert.deepEqual(failed.workItems.map(item => item.status), ['done']);
  assert.equal((await rest('projects', 'PATCH', { current_json: accepted.row.current_json }, { title: `eq.${ownerTitle}` })).length, 1);
  qa.clearProofGate();
  const postsBeforeRetry = report.actions.filter(a => a.type === 'browser-real-transport' && a.table === 'projects' && a.method !== 'GET').length;
  await send('계속'); await settled();
  const retried = await capture('03-same-revision-retry');
  assert.equal(retried.proof.verified, true); assert.equal(retried.proof.status, 'succeeded');
  assert.deepEqual(retried.proof.receipt, receipt);
  assert.equal(retried.sameLiveObject, true); assert.equal(retried.sameLiveBytes, true);
  assert.equal(retried.sessionCount, 1); assert.deepEqual(retried.toolCalls, failed.toolCalls);
  assert.equal(report.actions.filter(a => a.type === 'browser-real-transport' && a.table === 'projects' && a.method !== 'GET').length, postsBeforeRetry);
  assert.equal((await observeRemote('restored-retry')).observedIdentity, receipt.contentIdentity);
  // Event-gated live edit race: no time-based autosave luck, no store/verifier replacement.
  await page.evaluate(async () => {
    qa.store.update(draft => { draft.meta.description = 'qa-before-proof-race'; });
    qa.store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
    await qa.store.flush();
    qa.store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true });
  });
  const race = await armProof('newer live edit during real proof read');
  await send('계속'); await bounded(race.arrived.promise, 'race proof read');
  await page.evaluate(async () => {
    qa.store.update(draft => { draft.meta.description = 'qa-human-edit-during-read'; });
    qa.store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
    await qa.store.flush();
    qa.store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true });
    qa.capturedLive = qa.store.getCurrent(); qa.capturedJson = JSON.stringify(qa.capturedLive);
  });
  race.release.resolve(); await bounded(race.completed.promise, 'race read released'); await settled();
  const stale = await capture('04-live-edit-preserved');
  assert.equal(stale.proof.verified, false); assert.equal(stale.proof.reason, 'stale');
  assert.equal(stale.proof.proof.kind, 'verified'); assert.equal(stale.proof.proof.isCurrent, false);
  assert.equal(stale.sameLiveObject, true); assert.equal(stale.sameLiveBytes, true); assert.equal(stale.dirty, true);
  assert.equal(await page.evaluate(() => qa.store.getCurrent().meta.description), 'qa-human-edit-during-read');
  qa.clearProofGate();
  await send('계속'); await settled();
  const latest = await capture('05-latest-revision-verified');
  assert.equal(latest.proof.verified, true); assert.equal(latest.dirty, false);
  assert.deepEqual(latest.toolCalls, failed.toolCalls); assert.equal(latest.sessionCount, 1);
  assert.equal((await observeRemote('latest')).observedIdentity, latest.proof.receipt.contentIdentity);
  assert.deepEqual(report.errors, []);
  report.assertionsPassed = true;
  record('PASS', { projectId, oneAppliedTool: true, sameRevisionRetry: true, localOverwrite: false });
}
