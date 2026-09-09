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
  const scenarios = {
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
        rounds: [], expected: outcome('awaiting-user', 'incomplete', 'no-change') },
      { id: 'ordinary-apply', agentMode: 'chat', intent: baseIntent, rounds: [[title('ordinary')]],
        expected: outcome('response-final', 'satisfied', 'persisted-verified'), tool: 'set_title_screen', title: `${titleToken} ordinary` },
      { id: 'cancelled-applied', intent: { ...baseIntent, needsPlan: true, action: 'new_plan', ...titlePlan },
        rounds: [[title('cancelled')]], action: 'cancel-proof', expected: outcome('cancelled', 'satisfied', 'persisted'),
        tool: 'set_title_screen', title: `${titleToken} cancelled` },
      { id: 'rejected-apply', agentMode: 'chat', intent: baseIntent, rounds: [[title('rejected')]], action: 'protect-live-house',
        expected: outcome('failed', 'incomplete', 'draft'), tool: 'set_title_screen' },
      { id: 'commit-log-failure', agentMode: 'chat', intent: baseIntent, rounds: [[title('commit-fault')]], fault: 'commit-log-503',
        expected: outcome('response-final', 'satisfied', 'persisted-verified'), tool: 'set_title_screen', title: `${titleToken} commit-fault` },
      { id: 'failed-proof', agentMode: 'chat', intent: baseIntent, rounds: [[title('proof-mismatch')]], action: 'mismatch-proof',
        expected: outcome('response-final', 'satisfied', 'persisted'), tool: 'set_title_screen', title: `${titleToken} proof-mismatch` },
      { id: 'budget-exhausted', agentMode: 'chat', maxToolCalls: 1,
        intent: { ...baseIntent, mode: 'question', tools: ['get_project_summary'] }, rounds: [[call('get_project_summary')]],
        expected: outcome('budget-exhausted', 'unassessed', 'no-change'), tool: 'get_project_summary' },
      { id: 'legacy-unassessed', intent: { ...baseIntent, mode: 'other', tools: [], needsPlan: true, action: 'new_plan', ...titlePlan }, rounds: [[call('skip_work_item')]],
        expected: outcome('response-final', 'unassessed', 'no-change') },
      { id: 'legacy-assessed', intent: { ...contractIntent, mode: 'other', tools: [], acceptance: [measured] }, rounds: [[call('skip_work_item')]],
        expected: outcome('response-final', 'satisfied', 'no-change') },
    ],
  };
  // The request now states the actual fixture obligation. Optional planner work
  // is not retroactively promoted to a mandatory user request. Legacy controls
  // exercise scheduler-only bookkeeping, not newly audited project authoring.
  const sizeRequest = `Retain map ${mapId} dimensions at ${width} by ${height}.`;
  const eventRequest = `Ensure map ${mapId} contains exactly one event.`;
  const requests = {
    'required-skip': [eventRequest, unmet.criteria, [false]],
    'optional-skip': [sizeRequest, measured.criteria, [true]],
    'replan-preserves-required': [`${eventRequest} ${sizeRequest}`, [...unmet.criteria, ...measured.criteria], [false, true]],
    'user-withdrawal': [`${sizeRequest} ${eventRequest}`, [...measured.criteria, ...unmet.criteria], [true, false]],
    'blocked-ask-resume': [eventRequest, unmet.criteria, [false]],
    'query-no-change': ['What is the current project summary?'],
    'budget-exhausted': ['What is the current project summary?'],
    'legacy-unassessed': ['Exercise legacy-format scheduler bookkeeping: skip its title-work item. No project authoring is requested.'],
    'legacy-assessed': ['Exercise legacy acceptance-field scheduler bookkeeping: retain the existing-dimensions check and skip its work item. No project authoring is requested.'],
  };
  for (const spec of [...scenarios.required, ...scenarios.matrix]) {
    let request = requests[spec.id];
    if (!request) {
      const value = spec.rounds.flat().find(call => call.name === 'set_title_screen')?.args.title
        ?? `${titleToken} planned`;
      request = [`Set the title to ${value}.`, [{ kind: 'projectTitle', title: value }],
        [spec.expected.goal === 'satisfied']];
    }
    [spec.instruction, spec.criteria, spec.coverageFacts] = request;
    spec.coverageIds = (spec.criteria ?? []).map((_, index) => `request-1:coverage:0:${index}`);
    // Link planner declarations to the host-audited IDs rather than duplicating
    // the same obligation (which would require two user withdrawals). Scheduler
    // work IDs, skip calls and every authoring/failing tool argument stay intact.
    const ids = new Map();
    const bind = requirements => requirements?.map(requirement => {
      const index = requirement.required === false ? -1 : (spec.criteria ?? [])
        .findIndex(criterion => JSON.stringify([criterion]) === JSON.stringify(requirement.criteria));
      if (index < 0) return requirement;
      const id = spec.coverageIds[index];
      ids.set(requirement.id, id);
      return { ...requirement, id };
    });
    if (spec.intent.acceptance) spec.intent.acceptance = bind(spec.intent.acceptance);
    for (const call of spec.rounds.flat()) if (call.name === 'set_work_plan') {
      call.args.requirements = bind(call.args.requirements);
    }
    const link = layers => layers?.forEach(layer => layer.items.forEach(item => {
      if (item.requirementIds) item.requirementIds = item.requirementIds.map(id => ids.get(id) ?? id);
    }));
    // Intent objects are shared by the title cases; only requirement-linked
    // contract plans need rewriting, and those are freshly created per case.
    link(spec.intent.layers);
    for (const call of spec.rounds.flat()) if (call.name === 'set_work_plan') link(call.args.layers);
    if (spec.requiredIds) spec.requiredIds = [...new Set([
      ...spec.requiredIds.map(id => ids.get(id) ?? id), ...spec.coverageIds,
    ])];
    if (spec.withdrawId) spec.withdrawId = ids.get(spec.withdrawId) ?? spec.withdrawId;
  }
  return scenarios;
}
