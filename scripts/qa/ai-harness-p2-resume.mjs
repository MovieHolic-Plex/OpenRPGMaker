import assert from 'node:assert/strict';

export async function runBlockedAskResume(harness, transport, initial) {
  const { page, observations, record, bounded, projectId } = harness;
  const itemId = 'blocked-resume-work';
  const items = state => state.harness.workPlan.layers.flatMap(layer => layer.items);
  const authority = snapshot => ({ id: snapshot?.id, status: snapshot?.status,
    items: snapshot?.items.map(item => ({ id: item.id, status: item.status, mapId: item.mapId,
      passed: item.evidence.map(evidence => evidence.passed) })) });
  // Given: real repeated tool failures blocked work with canonical unmet acceptance.
  assert.equal(items(initial).find(item => item.id === itemId)?.status, 'blocked');
  assert.deepEqual(initial.acceptance?.items.map(item => item.id), ['blocked-resume-event']);
  assert.equal(initial.acceptance.status, 'blocked');
  assert.equal(initial.events.filter(event => event.type === 'tool_call' && event.name === 'resize_map' && !event.result.ok).length, 4);
  const retained = initial.acceptance;
  const question = `${projectId}/blocked-question: What remains unfinished?`;
  const read = { name: 'get_project_summary', args: { reason: 'QA inspect blocked work without resuming' } };
  transport.setScript({ id: 'blocked-question', intent: { mode: 'question', space: 'none', needsPlan: false,
    action: 'resume', tools: ['get_project_summary'], resetsContext: false, clarify: null }, rounds: [[read]] });
  await page.getByTestId('ai-composer-mode-ask').click();
  await page.evaluate(() => { qa.events = []; });
  await observations.armActivity(question);
  const questionGate = transport.holdBeforeTools();
  // When: an actual user question enters the real panel while work is blocked.
  await harness.send(question);
  await bounded(questionGate.arrived.promise, 'question tools request after actual intent decision');
  const during = await observations.capture('blocked-question-in-flight');
  observations.check('blocked-question: state stays blocked during ask', () => assert.equal(items(during).find(item => item.id === itemId)?.status, 'blocked'));
  observations.check('blocked-question: obligations stay unchanged during ask', () => assert.deepEqual(authority(during.acceptance), authority(retained)));
  record('real-question-held', { signal: 'first tools HTTP request after intent', itemId, actualOptions: during.turnOptions });
  questionGate.release.resolve();
  await harness.settled(); await page.evaluate(() => qa.activityDone);
  const after = await observations.capture('blocked-question-settled');
  observations.check('blocked-question: state stays blocked after ask', () => assert.equal(items(after).find(item => item.id === itemId)?.status, 'blocked'));
  observations.check('blocked-question: obligations stay unchanged after ask', () => assert.deepEqual(authority(after.acceptance), authority(retained)));
  observations.check('blocked-question: actual ask mode reached session', () => assert.equal(after.turnOptions.composerMode, 'ask'));
  observations.agreement({ id: 'blocked-question', tool: 'get_project_summary',
    expected: { execution: 'response-final', goal: 'incomplete', delivery: 'no-change' } }, after);

  // Given: the question is over and Ask remains selected; do not manually switch to Do.
  const button = page.getByTestId('ai-continue-run');
  assert.equal(await button.count(), 1, 'blocked-resume: existing user continue control is available after ask');
  assert.equal(await button.isVisible(), true, 'blocked-resume: continue is a visible user action');
  transport.setScript({ id: 'blocked-user-resume', intent: { mode: 'modify', space: 'none', needsPlan: true,
    action: 'resume', tools: ['get_project_summary'], resetsContext: false, clarify: null }, rounds: [[read]] });
  await page.evaluate(() => { qa.events = []; });
  await observations.armActivity('계속');
  const resumeGate = transport.holdBeforeTools();
  // When: click the existing control; its production handler owns resume authorization/mode.
  record('real-user-resume-click', { testid: 'ai-continue-run', previousComposerMode: 'ask' });
  await button.click();
  await bounded(resumeGate.arrived.promise, 'resume tools request after actual intent decision');
  const resumed = await observations.capture('blocked-user-resume-in-flight');
  observations.check('blocked-resume: user control reactivates same work item', () => assert.equal(items(resumed).find(item => item.id === itemId)?.status, 'in_progress'));
  observations.check('blocked-resume: real control exits ask mode', () => assert.equal(resumed.turnOptions.composerMode, 'do'));
  observations.check('blocked-resume: original obligation survives authorization', () => {
    assert.deepEqual(resumed.acceptance?.items.map(item => item.id), retained.items.map(item => item.id));
    assert.notEqual(resumed.acceptance?.status, 'verified');
  });
  record('real-user-resume-observed', { itemId, actualOptions: resumed.turnOptions });
  resumeGate.release.resolve();
  await page.evaluate(() => qa.activityDone);
  const terminal = await observations.capture('blocked-user-resume-settled');
  observations.check('blocked-resume: unfinished content is not manufactured', () => assert.equal(terminal.live.events.length, 0));
}
