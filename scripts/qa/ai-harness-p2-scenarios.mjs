// Scenario inputs only. Structural acceptance uses the existing parser contract.
export function p2Scenarios(fixture) {
  const { mapId, width, height, titleToken } = fixture;
  const target = { mapId };
  const unmet = { id: 'required-events', title: 'Required event', criteria: [{ kind: 'eventCount', target, count: 1 }] };
  const optional = { id: 'optional-events', title: 'Optional event', required: false, criteria: [{ kind: 'eventCount', target, count: 1 }] };
  const measured = { id: 'existing-size', title: 'Existing dimensions', criteria: [{ kind: 'mapDimensions', target, width, height }] };
  const work = (id, requirementIds) => ({ id, title: id, instruction: 'Inspect the exact scoped requirement', requirementIds });
  const plan = requirements => ({ goal: 'QA scoped requirements', requirements,
    layers: [{ title: 'Requirements', items: requirements.map(r => work(`work-${r.id}`, [r.id])) }] });
  const call = (name, args = {}) => ({ name, args: { ...args, reason: 'QA real-surface contract' } });
  const skip = requirements => requirements.map(r => call('skip_work_item', { itemId: `work-${r.id}`, note: 'Model skip is not user withdrawal' }));
  const skipped = requirements => [[call('set_work_plan', plan(requirements)), ...skip(requirements)]];
  const title = label => call('set_title_screen', { title: `${titleToken} ${label}` });
  const titlePlan = { goal: 'QA title edit', layers: [{ title: 'Title', items: [
    { id: 'title-work', title: 'Title', instruction: 'set_title_screen', successTools: ['set_title_screen'] },
  ] }] };
  const baseIntent = { mode: 'modify', space: 'none', useSelection: false, needsPlan: false, clarify: null,
    resetsContext: false, tools: ['set_title_screen'], summary: 'QA surface', action: 'direct' };
  const contractIntent = { ...baseIntent, needsPlan: true, action: 'new_plan', goal: 'QA scoped requirements',
    layers: [{ title: 'Inspect', items: [work('initial', [])] }] };
  // Planner and generator share item IDs; only the generator adds requirements.
  const contractFor = requirements => ({ ...contractIntent, layers: plan(requirements).layers });
  const outcome = (execution, goal, delivery) => ({ execution, goal, delivery });
  return {
    required: [
      { id: 'required-skip', intent: contractFor([unmet]), rounds: skipped([unmet]),
        expected: outcome('blocked', 'incomplete', 'no-change'), requiredIds: [unmet.id], skipped: 1 },
      { id: 'optional-skip', intent: contractFor([measured, optional]), rounds: skipped([measured, optional]),
        expected: outcome('response-final', 'satisfied', 'no-change'), requiredIds: [measured.id, optional.id], skipped: 2,
        optionalId: optional.id },
      { id: 'replan-preserves-required', intent: contractFor([unmet]), rounds: [
        ...skipped([unmet]),
        // Same scheduler identity, no links or old declaration: the ledger must retain it.
        [call('set_work_plan', { ...plan([measured]), layers: [
          { title: 'Requirements', items: [work(`work-${unmet.id}`, [])] },
        ] }), ...skip([unmet])],
      ], expected: outcome('blocked', 'incomplete', 'no-change'), requiredIds: [unmet.id, measured.id], skipped: 1 },
      { id: 'user-withdrawal', intent: contractFor([measured, unmet]), rounds: skipped([measured, unmet]),
        expected: outcome('blocked', 'incomplete', 'no-change'), requiredIds: [measured.id, unmet.id], skipped: 2,
        withdrawId: unmet.id },
      { id: 'blocked-ask-resume', askThenResume: true,
        intent: { ...contractIntent, tools: ['resize_map', 'get_project_summary'],
          acceptance: [{ ...unmet, id: 'blocked-resume-event' }],
          layers: [{ title: 'Blocked task', items: [{ id: 'blocked-resume-work', title: 'Blocked task',
            instruction: 'Resize then satisfy the required event', successTools: ['resize_map'] }] }] },
        rounds: Array.from({ length: 4 }, () => [call('resize_map', { mapId, width: 0, height })]),
        expected: outcome('blocked', 'incomplete', 'no-change') },
    ],
    matrix: [
      { id: 'query-no-change', intent: { ...baseIntent, mode: 'question', tools: ['get_project_summary'] },
        rounds: [[call('get_project_summary')]], expected: outcome('response-final', 'unassessed', 'no-change'), tool: 'get_project_summary' },
      { id: 'awaiting-user', agentMode: 'chat', composerMode: 'plan',
        intent: { ...baseIntent, needsPlan: true, action: 'new_plan', ...titlePlan },
        rounds: [], expected: outcome('awaiting-user', 'unassessed', 'no-change') },
      { id: 'ordinary-apply', agentMode: 'chat', intent: baseIntent, rounds: [[title('ordinary')]],
        expected: outcome('response-final', 'unassessed', 'persisted-verified'), tool: 'set_title_screen', title: `${titleToken} ordinary` },
      { id: 'cancelled-applied', intent: { ...baseIntent, needsPlan: true, action: 'new_plan', ...titlePlan },
        rounds: [[title('cancelled')]], action: 'cancel-proof', expected: outcome('cancelled', 'unassessed', 'persisted'),
        tool: 'set_title_screen', title: `${titleToken} cancelled` },
      { id: 'rejected-apply', agentMode: 'chat', intent: baseIntent, rounds: [[title('rejected')]], action: 'protect-live-house',
        expected: outcome('failed', 'unassessed', 'draft'), tool: 'set_title_screen' },
      { id: 'commit-log-failure', agentMode: 'chat', intent: baseIntent, rounds: [[title('commit-fault')]], fault: 'commit-log-503',
        expected: outcome('response-final', 'unassessed', 'persisted-verified'), tool: 'set_title_screen', title: `${titleToken} commit-fault` },
      { id: 'failed-proof', agentMode: 'chat', intent: baseIntent, rounds: [[title('proof-mismatch')]], action: 'mismatch-proof',
        expected: outcome('response-final', 'unassessed', 'persisted'), tool: 'set_title_screen', title: `${titleToken} proof-mismatch` },
      { id: 'budget-exhausted', agentMode: 'chat', maxToolCalls: 1,
        intent: { ...baseIntent, mode: 'question', tools: ['get_project_summary'] }, rounds: [[call('get_project_summary')]],
        expected: outcome('budget-exhausted', 'unassessed', 'no-change'), tool: 'get_project_summary' },
      { id: 'legacy-unassessed', intent: { ...baseIntent, needsPlan: true, action: 'new_plan', ...titlePlan }, rounds: [[call('skip_work_item')]],
        expected: outcome('response-final', 'unassessed', 'no-change') },
      { id: 'legacy-assessed', intent: { ...contractIntent, acceptance: [measured] }, rounds: [[call('skip_work_item')]],
        expected: outcome('response-final', 'satisfied', 'no-change') },
    ],
  };
}
