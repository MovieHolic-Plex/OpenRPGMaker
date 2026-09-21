import { cooperativeNodeYield } from "./cooperativeNodeYield";
import { reviewingChat } from "./aiEpochFixture";
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AssistantSession, type TurnResult } from '@/ai/assistantSession';
import { defaultAiConfig, type ChatResult } from '@/ai/llmClient';
import { createBlankProject } from '@/project/defaults';
import { store } from '@/project/store';
import { applyProposedProject } from '@/editor/tools/applyChangesetToStore';
import { resetMapEditHistory, getMapEditHistoryEntries, undoMapEdit } from '@/editor/mapEditHistory';
import { subscribeEditActivity, _resetEditActivityForTest } from '@/editor/editActivityLog';
import { fixedDeclarer } from './intentFixture';
import { bounded, epochRunner } from './aiEpochFixture';
import { installFakeDom } from './fakeDom';

const config = { ...defaultAiConfig(), agentMode: 'chat', model: 'test', liteModel: 'test', maxToolCalls: 4 } satisfies ReturnType<typeof defaultAiConfig>;
const final: ChatResult = { message: { role: 'assistant', content: 'Everything was applied and saved successfully.' }, finishReason: 'stop' };
function tool(name: string, args: string): ChatResult {
  return { message: { role: 'assistant', content: null, tool_calls: [{ id: name, type: 'function', function: { name, arguments: args } }] }, finishReason: 'tool_calls' };
}
beforeEach(() => {
  vi.stubEnv('VITE_LEGACY_DB_USE_PROXY', '0'); vi.stubEnv('VITE_LEGACY_DB_URL', ''); vi.stubEnv('VITE_LEGACY_DB_ANON_KEY', '');
  vi.stubEnv('VITE_LEGACY_DB_PROJECT_ID', '');
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject()); resetMapEditHistory();
});
afterEach(async () => { await store.flush(); resetMapEditHistory(); _resetEditActivityForTest(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it('malformed current tool arguments and misleading completion prose grant no application or save authority', async () => {
  // Given: a malformed real tool call, followed by untrusted completion prose.
  const before = JSON.stringify(store.getCurrent()); let round = 0;
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: 'other' }), yieldToUi: cooperativeNodeYield,
    chat: reviewingChat(async () => round++ === 0 ? tool('set_title_screen', '{') : final) });
  // When: the session processes that model response.
  const result = await bounded(session.sendUserMessage('Set title'));
  // Then: no real mutation, apply or save authority was produced.
  expect(result.proposedCalls).toEqual([]); expect(result.appliedCalls).toEqual([]);
  expect(result.runOutcome?.delivery).toBe('no-change'); expect(session.getRunEndProof()).toBeNull();
  expect(JSON.stringify(store.getCurrent())).toBe(before); expect(getMapEditHistoryEntries()).toHaveLength(0);
  expect(session.getAuditEntries().some(entry => entry.kind === 'tool' && entry.ok === false)).toBe(true);
});

it('live content changes without a generation increment still reject an old proposal', async () => {
  // Given: an authored proposal followed by an in-place human edit.
  let round = 0;
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: 'other' }), yieldToUi: cooperativeNodeYield,
    chat: reviewingChat(async () => round++ === 0 ? tool('set_title_screen', JSON.stringify({ title: 'OLD_DRAFT' })) : final) });
  await bounded(session.sendUserMessage('Set title'));
  const version = store.getVersionToken();
  const item = store.getCurrent().database.items.find(item => item.id === 'item_potion');
  if (!item) throw new Error('Missing real item');
  item.price = 149;
  expect(store.getVersionToken()).toEqual(version);
  // When: the real adapter attempts the stale proposal.
  const applied = await applyProposedProject(session.getProposedProject(), { base: session.getProposalBase(), baseline: session.getDraftBaseline(), operation: session.getRunOperation(), source: 'agent', summary: 'Old title', toolNames: ['set_title_screen'] });
  // Then: the human value survives with no application history.
  expect(applied).toMatchObject({ ok: false, reason: 'stale-base' });
  expect(store.getCurrent().database.items.find(item => item.id === 'item_potion')?.price).toBe(149);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});

it.each([false, true])('finishes store notification when the real applied-outcome subscriber throws (resetProject=%s)', async resetProject => {
  // Given: real title authoring and a session outcome observer that fails only after application.
  const observerError = new Error('Applied outcome observer failed');
  let round = 0; let outcomeNotifications = 0;
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: 'other' }),
    yieldToUi: cooperativeNodeYield, chat: reviewingChat(async () => round++ === 0
      ? tool('set_title_screen', JSON.stringify({ title: 'APPLIED_BEFORE_THROW' })) : final) });
  const result = await bounded(session.sendUserMessage('Set title', event => {
    if (event.type === 'run_outcome' && event.runOutcome.delivery === 'applied') {
      outcomeNotifications += 1;
      throw observerError;
    }
  }));
  const generation = store.getVersionToken().generation;
  const notifications: string[] = [];
  const stopActivity = subscribeEditActivity(entry => { if (entry.origin === 'ai') notifications.push('activity'); });
  const stopStore = store.subscribe(() => { notifications.push('store'); });
  const stopSave = store.subscribeAutoSave(state => { if (state.kind === 'pending') notifications.push('pending'); });
  // Freeze only unrelated autosave timers; actual mutation and scheduling remain connected.
  vi.useFakeTimers();
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  try {
    // When: the actual adapter invokes session accounting, which publishes to the throwing observer.
    const applying = applyProposedProject(session.getProposedProject(), {
      base: session.getProposalBase(), baseline: session.getDraftBaseline(), operation: session.getRunOperation(), source: 'agent', resetProject,
      summary: 'Observer throw', toolNames: ['set_title_screen'],
      onApplied: mutation => session.recordAppliedMutation(mutation),
    });
    // Then: preserve the exact failure, applied ledger and healthy notification/scheduling paths.
    await expect(bounded(applying)).rejects.toBe(observerError);
    expect(outcomeNotifications).toBe(1);
    expect(store.getCurrent().system.titleScreen?.title).toBe('APPLIED_BEFORE_THROW');
    expect(store.getVersionToken().generation).toBe(generation + 1);
    expect(result.appliedCalls?.map(call => call.args.title)).toEqual(['APPLIED_BEFORE_THROW']);
    expect(result.proposedCalls).toEqual([]);
    expect(result.runOutcome?.delivery).toBe('applied');
    expect(session.getRunEndProof()).toBeNull();
    expect(getMapEditHistoryEntries()).toHaveLength(1);
    expect(notifications).toEqual(['activity', 'store', 'pending']);
  } finally {
    stopActivity(); stopStore(); stopSave();
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    vi.clearAllTimers(); vi.useRealTimers();
  }
});

it('cancellation from the actual store mutation subscriber accounts the already-applied A milestone before B starts', async () => {
  // Given: the real autonomous title tool and a subscriber installed before mutation.
  let round = 0; let replacing = false; let b: Promise<TurnResult> | undefined; let retired: TurnResult | undefined;
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: 'other' }), yieldToUi: cooperativeNodeYield,
    chat: reviewingChat(async () => {
      if (replacing) return final;
      return round++ === 0 ? tool('set_work_plan', JSON.stringify({ goal: 'Title', layers: [{ title: 'Title', items: [{ title: 'Title', instruction: 'Title', successTools: ['set_title_screen'] }] }] }))
        : round === 2 ? tool('set_title_screen', JSON.stringify({ title: 'A_ACTUALLY_APPLIED' })) : final;
    }) });
  const unsubscribe = store.subscribe(() => {
    if (replacing || store.getCurrent().system.titleScreen?.title !== 'A_ACTUALLY_APPLIED') return;
    replacing = true;
    retired = session.retireRun();
    b = session.sendUserMessage('B inspect only', undefined, undefined, { goalAction: 'new-goal', composerMode: 'ask' });
  });
  // When: A applies, and the actual store subscriber synchronously retires A for B.
  const a = session.sendUserMessage('A set title', undefined, undefined, { autonomous: true });
  try {
    const resultA = await bounded(a);
    if (!b) throw new Error('Actual mutation subscriber never entered B');
    const resultB = await bounded(b);
    // Then: the immutable cancelled result credits only A's actual application.
    expect(resultA).toBe(retired);
    expect(store.getCurrent().system.titleScreen?.title).toBe('A_ACTUALLY_APPLIED');
    expect(resultB.runOutcome?.execution).toBe('response-final');
    expect.soft(resultA.appliedCalls?.map(call => call.args.title)).toEqual(['A_ACTUALLY_APPLIED']);
    expect.soft(resultA.proposedCalls).toEqual([]);
    expect.soft(resultA.runOutcome?.delivery).toBe('applied');
    expect(resultB.appliedCalls).toEqual([]);
    expect(resultB.proposedCalls).toEqual([]);
    expect(resultB.runOutcome?.delivery).toBe('no-change');
    expect(session.getRunEndProof()).toBeNull();
    expect(getMapEditHistoryEntries()).toHaveLength(1);
  } finally { unsubscribe(); await bounded(a); if (b) await bounded(b); }
});

it.each([false, true])('accounts current host application exactly once when autonomous=%s', async autonomous => {
  // Given: the real proposal host and a current title proposal, with no remote transport.
  const restoreDom = installFakeDom();
  const before = structuredClone(store.getCurrent());
  const responses = [
    ...(autonomous ? [tool('set_work_plan', JSON.stringify({ goal: 'Title', layers: [{ title: 'Title',
      items: [{ title: 'Title', instruction: 'Title', successTools: ['set_title_screen'] }] }] }))] : []),
    tool('set_title_screen', JSON.stringify({ title: 'CURRENT_APPLY' })),
  ];
  let round = 0;
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: 'other' }),
    yieldToUi: cooperativeNodeYield, chat: reviewingChat(async () => responses[round++] ?? final) });
  const host = epochRunner(session);
  try {
    // When: the existing runner applies the current turn through the shared adapter.
    const result = await bounded(host.send('Set title', { autonomous }));
    // Then: early accounting and later commit notification cannot duplicate the application.
    expect(result.appliedCalls?.map(call => call.args.title)).toEqual(['CURRENT_APPLY']);
    expect(result.proposedCalls).toEqual([]);
    expect(result.runOutcome?.delivery).toBe('applied');
    expect(store.getCurrent().system.titleScreen?.title).toBe('CURRENT_APPLY');
    expect(getMapEditHistoryEntries()).toHaveLength(1);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent()).toEqual(before);
  } finally { restoreDom(); }
});

it('preserves ordinary applied A through duplicate and nested mutation notifications before B', async () => {
  // Given: the ordinary proposal host; two observers and a nested human mutation.
  const restoreDom = installFakeDom();
  let round = 0; let replacing = false; let notifications = 0;
  let b: Promise<TurnResult> | undefined; let retired: TurnResult | undefined;
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: 'other' }),
    yieldToUi: cooperativeNodeYield, chat: reviewingChat(async () => round++ === 0
      ? tool('set_title_screen', JSON.stringify({ title: 'ORDINARY_A' })) : final) });
  const host = epochRunner(session);
  const replaceOwner = () => {
    notifications += 1;
    if (replacing || store.getCurrent().system.titleScreen?.title !== 'ORDINARY_A') return;
    replacing = true;
    retired = session.retireRun();
    store.update(project => { project.meta.title = 'NESTED_HUMAN_EDIT'; });
    b = session.sendUserMessage('B inspect', undefined, undefined, { goalAction: 'new-goal', composerMode: 'ask' });
  };
  const unsubscribe = store.subscribe(replaceOwner);
  const unsubscribeDuplicate = store.subscribe(() => replaceOwner());
  const a = host.send('A set title');
  try {
    // When: ordinary application synchronously enters both mutation observers.
    const resultA = await bounded(a);
    if (!b) throw new Error('Ordinary mutation did not start B');
    const resultB = await bounded(b);
    // Then: A retains one application; B receives no A calls, proof or replay.
    expect(notifications).toBe(4);
    expect(resultA).toBe(retired);
    expect(resultA.appliedCalls?.map(call => call.args.title)).toEqual(['ORDINARY_A']);
    expect(resultA.proposedCalls).toEqual([]);
    expect(resultA.runOutcome?.delivery).toBe('applied');
    expect(resultB.appliedCalls).toEqual([]);
    expect(resultB.proposedCalls).toEqual([]);
    expect(resultB.runOutcome?.delivery).toBe('no-change');
    expect(store.getCurrent().system.titleScreen?.title).toBe('ORDINARY_A');
    expect(store.getCurrent().meta.title).toBe('NESTED_HUMAN_EDIT');
    expect(session.getRunEndProof()).toBeNull();
    expect(getMapEditHistoryEntries()).toHaveLength(1);
  } finally { unsubscribe(); unsubscribeDuplicate(); await bounded(a); if (b) await bounded(b); restoreDom(); }
});

it.each([false, true])('credits A before activity observers retire its owner when resetProject=%s', async resetProject => {
  // Given: a completed real proposal and the activity observer preceding store subscribers.
  let round = 0; let b: Promise<TurnResult> | undefined; let replacing = false;
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: 'other' }),
    yieldToUi: cooperativeNodeYield, chat: reviewingChat(async () => round++ === 0
      ? tool('set_title_screen', JSON.stringify({ title: 'ACTIVITY_A' })) : final) });
  const resultA = await bounded(session.sendUserMessage('A set title'));
  const operation = session.getRunOperation();
  const unsubscribe = subscribeEditActivity(entry => {
    if (replacing || entry.origin !== 'ai') return;
    replacing = true;
    session.retireRun();
    b = session.sendUserMessage('B inspect', undefined, undefined, { goalAction: 'new-goal', composerMode: 'ask' });
  });
  try {
    // When: the shared adapter crosses either actual replacement boundary.
    const applied = await bounded(applyProposedProject(session.getProposedProject(), {
      base: session.getProposalBase(), baseline: session.getDraftBaseline(), operation, source: 'agent', summary: 'Activity accounting',
      toolNames: ['set_title_screen'], resetProject,
      onApplied: mutation => session.recordAppliedMutation(mutation),
    }));
    if (!b) throw new Error('Activity observer did not start B');
    const resultB = await bounded(b);
    // Then: the earlier notification surface cannot steal A accounting either.
    expect(applied.ok).toBe(true);
    expect(resultA.appliedCalls?.map(call => call.args.title)).toEqual(['ACTIVITY_A']);
    expect(resultA.proposedCalls).toEqual([]);
    expect(resultA.runOutcome?.delivery).toBe('applied');
    expect(resultB.appliedCalls).toEqual([]);
    expect(resultB.runOutcome?.delivery).toBe('no-change');
    expect(store.getCurrent().system.titleScreen?.title).toBe('ACTIVITY_A');
    expect(session.getRunEndProof()).toBeNull();
    expect(getMapEditHistoryEntries()).toHaveLength(1);
  } finally { unsubscribe(); if (b) await bounded(b); }
});

it('keeps a genuine draft unapplied when cancellation precedes mutation', async () => {
  // Given: a successful detached title tool cancelled at its exact tool-result event.
  let round = 0; let appliedNotifications = 0;
  const before = structuredClone(store.getCurrent());
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: 'other' }),
    yieldToUi: cooperativeNodeYield, chat: reviewingChat(async () => round++ === 0
      ? tool('set_title_screen', JSON.stringify({ title: 'CANCELLED_DRAFT' })) : final) });
  const cancelled = await bounded(session.sendUserMessage('Set title', event => {
    if (event.type === 'tool_call' && event.name === 'set_title_screen' && event.result.ok) session.retireRun();
  }));
  // When: a retired owner attempts the real adapter.
  const applied = await bounded(applyProposedProject(session.getProposedProject(), {
    base: session.getProposalBase(), baseline: session.getDraftBaseline(), operation: session.getRunOperation(), source: 'agent',
    summary: 'Retired title', toolNames: ['set_title_screen'],
    onApplied: mutation => { appliedNotifications += 1; session.recordAppliedMutation(mutation); },
  }));
  // Then: no accounting callback, history or store mutation is manufactured.
  expect(applied).toMatchObject({ ok: false, reason: 'retired-run' });
  expect(appliedNotifications).toBe(0);
  expect(cancelled.appliedCalls).toEqual([]);
  expect(cancelled.proposedCalls.map(call => call.args.title)).toEqual(['CANCELLED_DRAFT']);
  expect(cancelled.runOutcome?.delivery).toBe('draft');
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});
