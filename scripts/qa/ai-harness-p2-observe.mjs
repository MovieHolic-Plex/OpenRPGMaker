import assert from 'node:assert/strict';

export function p2Observations(harness) {
  const { page, report, record, out } = harness;
  report.contractChecks = [];
  function check(label, assertion) {
    try { assertion(); report.contractChecks.push({ label, pass: true }); }
    catch (error) {
      if (!(error instanceof assert.AssertionError)) throw error;
      const failure = { label, pass: false, message: error.message, actual: error.actual, expected: error.expected, stack: error.stack };
      report.contractChecks.push(failure); record('contract-violation', failure);
    }
  }
  async function armActivity(instruction, { deferDeadline = false } = {}) {
    await page.evaluate(({ instruction, deferDeadline }) => {
      // Observe the real serialized local activity publication, retaining its exact bytes.
      const original = Storage.prototype.setItem;
      qa.activityDone = new Promise((resolve, reject) => {
        let timer, done = false;
        qa.startActivityDeadline = () => {
          if (!done && timer === undefined) timer = setTimeout(() => {
            done = true; Storage.prototype.setItem = original; reject(new Error('Terminal activity deadline'));
          }, 60000);
        };
        Storage.prototype.setItem = function(key, value) {
          original.call(this, key, value);
          if (this !== localStorage || key !== 'oprn:ai-activity-logs') return;
          const row = JSON.parse(value).find(row => row.instruction.includes(instruction) && row.result.stoppedReason && !row.result.pending);
          if (row) { done = true; clearTimeout(timer); Storage.prototype.setItem = original; qa.activity = row; resolve(row); }
        };
        if (!deferDeadline) qa.startActivityDeadline();
        qa.disposers.push(() => { done = true; clearTimeout(timer); Storage.prototype.setItem = original; resolve(); });
      });
      void qa.activityDone.catch(() => {});
    }, { instruction, deferDeadline });
  }
  async function capture(label) {
    const observed = await page.evaluate(async () => {
      await qa.nextRender();
      const getterAvailable = typeof qa.session.getRunOutcome === 'function';
      const live = qa.store.getCurrent();
      const map = live.maps[live.startMapId];
      const outcomeNodes = [...document.querySelectorAll('[data-testid="ai-run-outcome"]')].filter(node => node.getClientRects().length);
      return {
        getterAvailable, ...(getterAvailable ? { getter: qa.session.getRunOutcome() } : {}),
        harness: qa.session.getHarnessSnapshot(), bridgeHarness: window.__oprnAiBridge.harness(), bridgeResult: qa.bridgeResult,
        result: qa.result, turnOptions: qa.turnOptions, acceptance: qa.session.getAcceptanceSnapshot(), activity: qa.activity,
        ui: outcomeNodes.map(node => ({ execution: node.dataset.execution, goal: node.dataset.goal, delivery: node.dataset.delivery,
          imageDelivery: node.dataset.imageDelivery ?? null })),
        events: qa.events, proof: qa.session.getRunEndProof(),
        live: { title: live.system.titleScreen?.title, mapId: map.id, width: map.width, height: map.height, events: map.events,
          layoutPlan: map.layoutPlan, remoteEnabled: qa.store.isRemotePersistenceEnabled(), dirty: qa.store.hasUnsavedChanges() },
        proposedCalls: qa.result?.proposedCalls, appliedCalls: qa.result?.appliedCalls,
      };
    });
    report.states[label] = observed;
    record('p2-observed', { label, getterAvailable: observed.getterAvailable, result: observed.result,
      acceptance: observed.acceptance, live: observed.live, ui: observed.ui });
    await page.screenshot({ path: `${out}/${label}.png` });
    return observed;
  }
  function agreement(spec, observed) {
    const prefix = spec.id;
    check(`${prefix}: real session returned`, () => assert.ok(observed.result?.stoppedReason));
    check(`${prefix}: getRunOutcome exists after execution`, () => assert.equal(observed.getterAvailable, true));
    const values = {
      getter: observed.getter, harness: observed.harness.runOutcome, turn: observed.result?.runOutcome,
      bridgeHarness: observed.bridgeHarness?.runOutcome, activity: observed.activity?.result.runOutcome,
      recap: observed.result?.recap?.runOutcome, activityRecap: observed.activity?.result.recap?.runOutcome,
    };
    if (spec.bridge) values.bridgeResponse = observed.bridgeResult?.runOutcome;
    // 전달 영수증 축은 세 축과 독립이다. 이 시나리오들은 자료 이미지를 요청에 싣지 않으므로
    // 첨부는 거짓이어야 하고, "모름"이 성공으로 승격되지 않는지도 같이 본다.
    const expected = { ...spec.expected, imageAttached: false, visualDelivery: { attempted: 0, attached: 0 } };
    for (const [surface, actual] of Object.entries(values)) {
      check(`${prefix}: ${surface} typed outcome`, () => assert.deepEqual(actual, expected));
    }
    check(`${prefix}: visible UI typed outcome`, () => assert.deepEqual(observed.ui,
      [{ ...spec.expected, imageDelivery: 'unattached' }]));
    const outcomeEvents = observed.events.filter(event => event.type === 'run_outcome');
    check(`${prefix}: terminal typed event`, () => assert.deepEqual(outcomeEvents.at(-1)?.runOutcome, expected));
    check(`${prefix}: real remaining content`, () => assert.equal(observed.live.events.length, 0));
    if (spec.tool) check(`${prefix}: real tool executed`, () => assert.ok(observed.events.some(event => event.type === 'tool_call' && event.name === spec.tool && event.result.ok)));
    if (spec.title) check(`${prefix}: actual applied title`, () => assert.equal(observed.live.title, spec.title));
    if (spec.expected.delivery === 'persisted-verified') check(`${prefix}: real current persistence proof`, () => {
      assert.equal(observed.proof?.verified, true); assert.equal(observed.proof?.proof?.isCurrent, true);
    });
    if (spec.composerMode === 'plan') check(`${prefix}: real plan-only wait`, () => {
      assert.ok(observed.harness.workPlan?.layers.some(layer => layer.items.some(item => ['pending', 'in_progress'].includes(item.status))));
      assert.equal(observed.events.filter(event => event.type === 'tool_call').length, 0);
    });
    if (spec.requiredIds) {
      check(`${prefix}: canonical requirement retention`, () => assert.deepEqual(observed.acceptance?.items.map(item => item.id).sort(), [...spec.requiredIds].sort()));
      check(`${prefix}: scheduler really skipped`, () => assert.equal(observed.harness.workPlan.layers.flatMap(layer => layer.items).filter(item => item.status === 'skipped').length, spec.skipped));
    }
    if (spec.optionalId) check(`${prefix}: optional skip is not verification`, () => {
      const item = observed.acceptance?.items.find(item => item.id === spec.optionalId);
      assert.ok(item); assert.notEqual(item.status, 'verified');
    });
  }
  return { check, armActivity, capture, agreement };
}
