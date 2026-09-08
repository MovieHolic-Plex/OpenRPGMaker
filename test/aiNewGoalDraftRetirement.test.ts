import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AssistantSession, type SessionTurnOptions, type TurnResult } from '@/ai/assistantSession';
import { defaultAiConfig, type ChatResult } from '@/ai/llmClient';
import { resetIntentDeclarationCache } from '@/ai/intentDeclarationClient';
import { createAiTurnRunner, type AiTurnRunnerDeps } from '@/editor/panels/aiTurnRunner';
import type { AiRunSurface } from '@/editor/panels/aiRunSurface';
import { appendConversationBubble } from '@/editor/panels/aiConversationLog';
import { buildAiActivityLogRecord } from '@/ai/activityLog';
import * as apply from '@/editor/tools/applyChangesetToStore';
import { createBlankProject } from '@/project/defaults';
import { store } from '@/project/store';
import { createProjectWikiCoordinator } from '@/editor/projectWikiCoordinator';
import { clearAgentBlueprint } from '@/editor/agentBlueprint';
import { clearAgentGhostPreview } from '@/editor/agentGhostPreview';
import { resetMapEditHistory } from '@/editor/mapEditHistory';
import { _resetEditActivityForTest } from '@/editor/editActivityLog';
import { installFakeDom } from './fakeDom';
import { fixedDeclarer } from './intentFixture';

// Only telemetry is stubbed. Session, registered tool, runner, apply adapter and store are real.
vi.mock('@/ai/activityLog', async original => ({
  ...await original<typeof import('@/ai/activityLog')>(),
  recordAiActivity: vi.fn(async input => buildAiActivityLogRecord(input)),
}));
vi.mock('@/ai/preferenceSignals', () => ({ observeTurn: () => ({}), shouldDistillPreferences: () => false }));
let restoreDom: (() => void) | undefined;
beforeEach(() => {
  restoreDom = installFakeDom(); resetIntentDeclarationCache();
  vi.stubEnv('VITE_EDIT_ACTIVITY_DISK_MIRROR', '0');
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject()); resetMapEditHistory();
});
afterEach(async () => {
  await store.flush(); clearAgentBlueprint(); clearAgentGhostPreview(); resetMapEditHistory();
  _resetEditActivityForTest(); resetIntentDeclarationCache(); restoreDom?.(); vi.restoreAllMocks(); vi.unstubAllEnvs();
});
const final: ChatResult = { message: { role: 'assistant', content: 'RESULT' }, finishReason: 'stop' };
const config = { ...defaultAiConfig(), agentMode: 'chat', model: 'test', liteModel: 'test', apiKey: 'test', maxToolCalls: 8 } as const;
function runnerFor(session: AssistantSession) {
  const noop = () => {}; const log = document.createElement('div');
  const applyProposal = vi.fn<AiTurnRunnerDeps['applyProposal']>(async calls => {
    const applied = await apply.applyProposedProject(session.getProposedProject(), { base: session.getProposalBase(),
      source: 'agent', summary: 'Reviewer owned isolated title', toolNames: calls.map(call => call.name),
    });
    if (!applied.ok) throw new Error(applied.issue);
    session.recordAppliedProject(applied); session.rebaseProject(store.getCurrent()); return 'applied';
  });
  const surface: AiRunSurface = {
    panel: document.createElement('div'), log, sendButton: document.createElement('button'), controller: { session, auditHistory: [], statusTimeline: [] },
    turnBusy: false, disposed: false, abortNoticeShown: false, activeAbortController: null, collapseAfterAiWork: false, collapsed: false,
    conversationId: 'r21-new-goal-draft', conversationScope: 'r21-new-goal-draft', runningPhaseStatus: null, runningProgress: null,
    setStatus: noop, beginTurnProgress: noop, endTurnProgress: noop, refreshRunningStatus: noop, refreshAbortButton: noop,
    startLiveActivity: noop, completeLiveActivity: noop, expandForAiWork: noop, scheduleCollapseAfterAiWork: noop, notifyIfObscuredByTestPlay: noop,
    drainPendingSends: noop, persistConversation: noop, sendText: async () => {},
    appendBubble: (role, text) => appendConversationBubble({ log, role, text, removeStartScreen: noop }),
    appendReasoning: () => ({ box: document.createElement('div'), body: document.createElement('div') }), closeToolActivity: noop,
    clearLastReasoning: noop, isLastReasoningBox: () => false,
  };
  const deps: AiTurnRunnerDeps = { surface, applyingProposal: false, projectIdentityId: 'r21-new-goal-draft', workPlanSurfaceState: null, applyProposal,
    noteNoChanges: noop, beginWorkPlanTurn: noop, settleWorkPlanTurn: noop, refreshWorkPlanSurface: noop, showWorkPlan: noop, showAcceptance: noop,
    noteWorkPlanActivity: noop, appendMilestoneFeedLine: noop, appendTileThumbs: noop, appendTileGrid: noop, appendAiDocument: noop,
    hasPendingQuestion: () => false, openAiSettings: noop, renderQuickReplies: noop, refreshContextMeter: noop };
  const runner = createAiTurnRunner(deps);
  async function send(text: string, options: SessionTurnOptions = {}, abort: boolean | string = false) {
    let result: TurnResult | undefined; let preApply: unknown;
    await runner.executeTurn(session, text, async (onEvent, signal) => {
      result = await session.sendUserMessage(text, event => {
        onEvent(event);
        if (abort && event.type === 'tool_call' && event.name === 'set_title_screen' && event.result.ok && (abort === true || event.args.title === abort)) surface.activeAbortController?.abort();
      }, signal, options);
      preApply = { outcome: result.runOutcome, calls: result.proposedCalls.map(call => ({ name: call.name, args: call.args })) };
      return result;
    }, options);
    if (!result) throw new Error('No real session result');
    return { result, preApply };
  }
  return { send, applyProposal, surface };
}
it.each(['wiki', 'intent'] as const)('new goal with %s entry failure must not apply the cancelled prior goal draft', async boundary => {
  let failing = false; let round = 0;
  const session = new AssistantSession(store.getCurrent(), { config,
    prepareProjectWiki: async () => { if (failing && boundary === 'wiki') throw new Error('OWNED_NEW_GOAL_WIKI_FAILURE'); return undefined; },
    declareIntent: async facts => { if (failing && boundary === 'intent') throw new Error('OWNED_NEW_GOAL_INTENT_FAILURE'); return fixedDeclarer({ mode: 'other' })(facts); },
    chat: async () => round++ === 0 ? { message: { role: 'assistant', content: null,
      tool_calls: [{ id: 'title', type: 'function', function: { name: 'set_title_screen', arguments: JSON.stringify({ title: 'CANCELLED_OLD_GOAL' }) } }] }, finishReason: 'tool_calls' } : final,
  });
  const f = runnerFor(session); const before = structuredClone(store.getCurrent());
  const first = await f.send('Set title for the old goal', { composerMode: 'do' }, true);
  expect(first.result.stoppedReason).toBe('aborted'); expect(first.result.proposedCalls).toHaveLength(1);
  expect(f.applyProposal).not.toHaveBeenCalled(); expect(store.getCurrent()).toEqual(before);
  failing = true;
  const second = await f.send('Start a completely different goal; inspect only', { composerMode: 'do', goalAction: 'new-goal' });
  console.log('NEW_GOAL_RETAINED_DRAFT', JSON.stringify({ boundary, first: first.result.runOutcome, secondBeforeApply: second.preApply,
    second: second.result.runOutcome, stoppedReason: second.result.stoppedReason, error: second.result.error,
    applyCalls: f.applyProposal.mock.calls.map(([calls]) => calls.map(call => ({ name: call.name, args: call.args }))),
    liveTitle: store.getCurrent().system.titleScreen?.title, getter: session.getRunOutcome(), recap: second.result.recap?.runOutcome }));
  expect(second.result.stoppedReason).toBe('error');
  expect(f.applyProposal).not.toHaveBeenCalled();
  expect(store.getCurrent()).toEqual(before);
  expect(second.result.runOutcome).toEqual({ execution: 'failed', goal: 'unassessed', delivery: 'no-change' });
});


const tool = (name: string, args: unknown): ChatResult => ({ message: { role: 'assistant', content: null,
  tool_calls: [{ id: name, type: 'function', function: { name, arguments: JSON.stringify(args) } }] }, finishReason: 'tool_calls' });
const disjoint = tool('upsert_item', { item: { id: 'item_new_owner', name: 'New owner item', price: 21 } });

function draftFixture(detached = false) {
  const project = detached ? structuredClone(store.getCurrent()) : store.getCurrent();
  let responses = [tool('set_title_screen', { title: 'CANCELLED_OLD_GOAL' })];
  let hook: (boundary: 'wiki' | 'intent', signal?: AbortSignal) => void = () => {};
  const session = new AssistantSession(project, { config,
    prepareProjectWiki: async input => { hook('wiki', input.signal); return undefined; },
    declareIntent: async (facts, signal) => { hook('intent', signal); return fixedDeclarer({ mode: 'other' })(facts); },
    chat: async () => responses.shift() ?? final,
  });
  return { session, ...runnerFor(session),
    respond(...next: ChatResult[]) { responses = next; },
    atBoundary(next: typeof hook) { hook = next; },
  };
}

it.each(['wiki', 'intent', 'success'] as const)('retires payload before %s entry and cannot carry it through resume or a disjoint write', async boundary => {
  const f = draftFixture();
  const before = structuredClone(store.getCurrent());
  const first = await f.send('Old title', { composerMode: 'do' }, true);
  const historical = structuredClone(first.result);
  expect(first.result.proposedCalls).toHaveLength(1);
  let draftAtBoundary: unknown;
  f.atBoundary(current => {
    if (current !== (boundary === 'success' ? 'wiki' : boundary)) return;
    draftAtBoundary = f.session.getProposedProject();
    if (boundary !== 'success') throw new Error(`${boundary}-new-owner-fault`);
  });
  const entered = await f.send('Inspect a new goal', { composerMode: 'do', goalAction: 'new-goal' });
  expect(entered.result.stoppedReason).toBe(boundary === 'success' ? 'final' : 'error');
  expect(draftAtBoundary).toEqual(before);
  expect(f.applyProposal).not.toHaveBeenCalled();
  expect(entered.result.proposedCalls).toEqual([]);
  expect(f.session.getProposedProject()).toEqual(before);
  f.atBoundary(() => {});
  const resumed = await f.send('Continue', { goalAction: 'resume' });
  expect(resumed.result.proposedCalls).toEqual([]);
  expect(f.applyProposal).not.toHaveBeenCalled();
  f.respond(disjoint);
  const written = await f.send('Continue with the item', { goalAction: 'resume' });
  expect(f.applyProposal).toHaveBeenCalledTimes(1);
  expect(written.result.appliedCalls?.map(call => call.name)).toEqual(['upsert_item']);
  expect(store.getCurrent().system.titleScreen).toEqual(before.system.titleScreen);
  expect(store.getCurrent().database.items.find(item => item.id === 'item_new_owner')).toMatchObject({ name: 'New owner item', price: 21 });
  expect(first.result).toEqual(historical);
  await f.send('Continue', { goalAction: 'resume' });
  expect(f.applyProposal).toHaveBeenCalledTimes(1);
});

it.each(['wiki', 'intent'] as const)('cancels the new owner at %s without retaining prior authority or payload', async boundary => {
  const f = draftFixture(); const before = structuredClone(store.getCurrent());
  await f.send('Old title', {}, true);
  f.atBoundary((current, signal) => {
    if (current !== boundary) return;
    f.surface.activeAbortController?.abort();
    signal?.throwIfAborted();
  });
  const cancelled = await f.send('Different goal', { goalAction: 'new-goal' });
  expect(cancelled.result.stoppedReason).toBe('aborted');
  expect(cancelled.result.runOutcome).toEqual({ execution: 'cancelled', goal: 'unassessed', delivery: 'no-change' });
  expect(cancelled.result.proposedCalls).toEqual([]);
  expect(f.applyProposal).not.toHaveBeenCalled();
  expect(f.session.getProposedProject()).toEqual(before);
  f.atBoundary(() => {}); f.respond(disjoint);
  await f.send('Continue', { goalAction: 'resume' });
  expect(f.applyProposal).toHaveBeenCalledTimes(1);
  expect(store.getCurrent().system.titleScreen).toEqual(before.system.titleScreen);
  expect(store.getCurrent().database.items.find(item => item.id === 'item_new_owner')?.name).toBe('New owner item');
});

it.each([false, true])('uses the authoritative baseline, detached=%s, not the retired draft or an unrelated store', async detached => {
  const f = draftFixture(detached);
  const original = structuredClone(f.session.baselineProject);
  await f.send('Old title', {}, true);
  store.update(project => { project.meta.title = 'Current applied content'; });
  const expected = detached ? original : structuredClone(store.getCurrent());
  f.atBoundary(() => { throw new Error('new-owner-preparation'); });
  await f.send('Different goal', { goalAction: 'new-goal' });
  expect(f.session.baselineProject).toEqual(expected);
  expect(f.session.getProposedProject()).toEqual(expected);
  expect(store.getCurrent().meta.title).toBe('Current applied content');
  expect(f.applyProposal).not.toHaveBeenCalled();
});

it('keeps explicit Ask precedence over new-goal and genuinely resumes the retained draft exactly once', async () => {
  const f = draftFixture(); const before = structuredClone(store.getCurrent());
  await f.send('Old title', {}, true);
  const question = await f.send('Explain', { composerMode: 'ask', goalAction: 'new-goal' });
  expect(question.result.proposedCalls).toEqual([]);
  expect(f.session.getProposedProject().system.titleScreen?.title).toBe('CANCELLED_OLD_GOAL');
  expect(f.applyProposal).not.toHaveBeenCalled(); expect(store.getCurrent()).toEqual(before);
  await f.send('Continue', { goalAction: 'resume' });
  expect(store.getCurrent().system.titleScreen?.title).toBe('CANCELLED_OLD_GOAL');
  expect(f.applyProposal).toHaveBeenCalledTimes(1);
  await f.send('Continue', { goalAction: 'resume' });
  expect(f.applyProposal).toHaveBeenCalledTimes(1);
});

it('archives applied-plus-pending history before rebase, preserves applied content and only applies new disjoint work', async () => {
  const f = draftFixture();
  const map = store.getCurrent().maps[store.getCurrent().startMapId];
  if (!map) throw new Error('Missing fixture map');
  f.respond(tool('set_work_plan', { goal: 'Titles', requirements: [{ id: 'size', title: 'Size',
    criteria: [{ kind: 'mapDimensions', target: { mapId: map.id }, width: map.width, height: map.height }] }],
    layers: [{ title: 'Titles', items: [
      { title: 'First', instruction: 'First title', successTools: ['set_title_screen'] },
      { title: 'Second', instruction: 'Draft only', successTools: ['upsert_item'] },
    ] }] }), tool('set_title_screen', { title: 'APPLIED_FIRST' }), tool('set_title_screen', { title: 'PENDING_SECOND' }));
  const actualApply = vi.spyOn(apply, 'applyProposedProject');
  const old = await f.send('Set titles', { autonomous: true }, 'PENDING_SECOND');
  expect(old.result.appliedCalls?.map(call => call.args.title)).toEqual(['APPLIED_FIRST']);
  expect(old.result.proposedCalls.map(call => call.args.title)).toEqual(['PENDING_SECOND']);
  expect(old.result.runOutcome?.delivery).toBe('draft');
  expect(store.getCurrent().system.titleScreen?.title).toBe('APPLIED_FIRST');
  expect(actualApply).toHaveBeenCalledTimes(1);
  const resultHistory = structuredClone(old.result);
  const assessment = f.session.getAcceptanceSnapshot();
  expect(assessment?.status).toBe('verified');
  f.atBoundary(() => { throw new Error('new-owner-fault'); });
  await f.send('Different goal', { goalAction: 'new-goal' });
  const history = f.session.getAcceptanceHistory();
  expect(history).toEqual([assessment]); expect(history[0]).toBe(assessment);
  expect(Object.isFrozen(history)).toBe(true); expect(Object.isFrozen(assessment)).toBe(true);
  expect(f.session.getAcceptanceSnapshot()).toBeNull();
  expect(f.session.getProposedProject().system.titleScreen?.title).toBe('APPLIED_FIRST');
  expect(actualApply).toHaveBeenCalledTimes(1);
  f.atBoundary(() => {}); f.respond(disjoint);
  await f.send('Continue', { goalAction: 'resume' });
  expect(actualApply).toHaveBeenCalledTimes(2);
  expect(f.applyProposal).toHaveBeenCalledTimes(1);
  expect(store.getCurrent().system.titleScreen?.title).toBe('APPLIED_FIRST');
  expect(store.getCurrent().database.items.find(item => item.id === 'item_new_owner')?.name).toBe('New owner item');
  expect(f.session.getAcceptanceHistory()).toEqual(history);
  expect(old.result).toEqual(resultHistory);
});

it('still applies current successful proposals on a new-goal authoring error exactly once', async () => {
  let round = 0;
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: 'other' }),
    chat: async () => { if (round++ === 0) return disjoint; throw new Error('current-authoring-fault'); } });
  const f = runnerFor(session);
  const result = await f.send('Create an item', { goalAction: 'new-goal' });
  expect(result.result.stoppedReason).toBe('error');
  expect(result.result.runOutcome).toEqual({ execution: 'failed', goal: 'unassessed', delivery: 'applied' });
  expect(f.applyProposal).toHaveBeenCalledTimes(1);
  expect(store.getCurrent().database.items.find(item => item.id === 'item_new_owner')?.name).toBe('New owner item');
  await f.send('Continue', { goalAction: 'resume' });
  expect(f.applyProposal).toHaveBeenCalledTimes(1);
});


it('retires the old draft but preserves an actual current-owner wiki apply before checkpoint failure', async () => {
  let newOwner = false; let round = 0;
  const coordinator = createProjectWikiCoordinator({ history: async () => [], extract: async input => ({
    upserts: newOwner ? [{ id: 'w_new_owner', type: 'guideline', name: 'New owner rule', summary: 'Contact combat',
      wiki: { kind: 'declaration', basis: 'explicit', combatMode: 'contact', sourceIds: input.sources.map(source => source.id) } }] : [],
  }) });
  const session = new AssistantSession(store.getCurrent(), { config, prepareProjectWiki: coordinator.prepare,
    declareIntent: fixedDeclarer({ mode: 'other' }),
    chat: async () => round++ === 0 ? tool('set_title_screen', { title: 'CANCELLED_OLD_GOAL' }) : final });
  const f = runnerFor(session); const before = structuredClone(store.getCurrent());
  const old = await f.send('Old title', {}, true); const historical = structuredClone(old.result);
  expect(old.result.proposedCalls).toHaveLength(1); expect(f.applyProposal).not.toHaveBeenCalled();
  newOwner = true;
  const current = await f.send('Use contact combat', { composerMode: 'do', goalAction: 'new-goal' });
  expect(current.result.stoppedReason).toBe('error'); // Real unloaded checkpoint, after local wiki mutation.
  expect(current.result.runOutcome).toEqual({ execution: 'failed', goal: 'unassessed', delivery: 'applied' });
  expect(current.result.proposedCalls).toEqual([]); expect(current.result.appliedCalls).toEqual([]);
  expect(f.applyProposal).not.toHaveBeenCalled();
  expect(store.getCurrent().world?.entities.find(entity => entity.id === 'w_new_owner')?.wiki?.combatMode).toBe('contact');
  expect(store.getCurrent().system.titleScreen).toEqual(before.system.titleScreen);
  expect(session.getProposedProject().system.titleScreen).toEqual(before.system.titleScreen);
  expect(session.getRunOutcome()).toEqual(current.result.runOutcome);
  expect(old.result).toEqual(historical);
});
