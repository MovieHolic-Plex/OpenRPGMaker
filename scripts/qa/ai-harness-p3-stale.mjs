import assert from 'node:assert/strict';
import { p2Observations } from './ai-harness-p2-observe.mjs';

export function createHumanWorkHold({ deferred }) {
  const arrived = deferred(), release = deferred(), cancelled = deferred();
  const controller = new AbortController();
  let state = 'held';
  function cancel(error = new Error('Human work owner cancelled')) {
    if (state !== 'held') return;
    state = 'cancelled'; controller.abort(error);
    cancelled.reject(error); release.reject(error); arrived.reject(error);
  }
  return { arrived, used: false, get state() { return state; },
    // The finite UI/save/read owner already has per-action rejecting deadlines.
    // A second transport clock must not expire into an AI retry mid-human-edit.
    wait: () => release.promise,
    complete: async work => {
      try {
        controller.signal.throwIfAborted();
        const result = await Promise.race([work(controller.signal), cancelled.promise]);
        controller.signal.throwIfAborted();
        state = 'released'; release.resolve(); cancelled.resolve(); return result;
      } catch (error) { cancel(error); throw error; }
    },
    cancel,
  };
}

// Native single-client race. Only model transport is scripted: every draft,
// human mutation, apply/rejection, undo, save and typed outcome is production work.
export function createHumanEditRaceContracts(harness) {
  const { page, report, record, bounded, deferred, ownerTitle, projectId, out } = harness;
  // Playwright's action timeout does not cover evaluate() or its returned promise.
  const evaluate = (...args) => bounded(page.evaluate(...args), 'human browser operation');
  const observations = p2Observations(harness);
  const titles = new Set([ownerTitle]);
  let title, round = 0, held;

  async function respond(body) {
    assert.ok(title, 'An owned turn must be armed before model transport');
    if (!body.tools?.length) return { role: 'assistant', content: JSON.stringify({
      mode: 'other', space: 'none', needsPlan: false, useSelection: false,
      clarify: null, tools: [], resetsContext: false,
    }) };
    if (round++ === 0) {
      assert.ok(body.tools.some(tool => tool.function.name === 'set_title_screen'));
      return { role: 'assistant', content: '', tool_calls: [{
        id: 'p3_human_title', type: 'function', function: { name: 'set_title_screen',
          arguments: JSON.stringify({ title, reason: 'Owned P3 detached title proposal' }) },
      }] };
    }
    if (held) {
      if (!held.used) {
        held.used = true;
        record('proposal-completion-held', { title, seam: 'next model HTTP request after real write tool' });
        held.arrived.resolve();
      }
      // Retries belong to the same owner too; cancellation must never turn
      // a second HTTP request into an early final response.
      await held.wait();
      record('proposal-completion-released', { title });
    }
    return { role: 'assistant', content: 'QA_FINAL' };
  }

  async function saveRead(label) {
    const receipt = await evaluate(async () => {
      const saved = await qa.store.flush();
      if (saved.kind !== 'saved') throw new Error(`Owned fixture save failed: ${saved.kind}`);
      return saved.receipt;
    });
    const remote = await bounded(harness.observeRemote(label), `human remote observation: ${label}`);
    assert.equal(remote.observedIdentity, receipt.contentIdentity);
    report.states[`${label}-remote`] = { receipt, identity: remote.observedIdentity,
      values: await evaluate(project => qa.humanValues(project), remote.row.current_json) };
    return report.states[`${label}-remote`];
  }

  async function snapshot(label) {
    const observed = await observations.capture(label);
    const values = await evaluate(() => ({
      live: qa.humanValues(qa.store.getCurrent()), draft: qa.humanValues(qa.session.getProposedProject()),
      counters: { ...structuredClone(qa.humanCounters),
        applyRejectedNotifications: qa.humanCounters.rejectedNotifications,
        reviewRejections: qa.events.filter(event => event.type === 'result_review' && event.review.status !== 'approved').length,
        rejectedNotifications: qa.humanCounters.rejectedNotifications
          + qa.events.filter(event => event.type === 'result_review' && event.review.status !== 'approved').length },
      mutations: structuredClone(qa.humanMutations),
      sameBefore: JSON.stringify(qa.store.getCurrent()) === qa.humanBefore,
      sameHuman: JSON.stringify(qa.store.getCurrent()) === qa.humanEdited,
    }));
    report.states[label].humanRace = values;
    record('human-race-values', { label, ...values });
    return { observed, ...values };
  }

  async function start(label, hold) {
    title = `${ownerTitle} ${label}`; titles.add(title); round = 0;
    held = hold ? createHumanWorkHold({ deferred }) : undefined;
    await page.getByTestId('ai-new-chat').click();
    await page.getByTestId('ai-composer-mode-do').click();
    await evaluate(() => {
      qa.events = []; qa.activity = undefined; qa.result = undefined;
      qa.humanCounters = { appliedReceipts: [], rejectedNotifications: 0 };
      qa.humanMutations = [];
      qa.humanBefore = JSON.stringify(qa.store.getCurrent());
    });
    const instruction = `${projectId}/${label}: change only the title.`;
    await observations.armActivity(instruction, { deferDeadline: hold });
    await harness.send(instruction, { deferDeadline: hold });
  }

  async function finish() {
    await harness.settled();
    await evaluate(() => qa.activityDone);
  }

  // Subscribe before each real control. The deadline only rejects; no polling.
  async function armMutation(kind, expected) {
    await evaluate(({ kind, expected }) => {
      qa.humanMutationDone = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { unsubscribe(); reject(new Error(`Human ${kind} mutation deadline`)); }, 10000);
        const unsubscribe = qa.store.subscribe(() => {
          const live = qa.store.getCurrent();
          const value = kind === 'bytes' ? JSON.stringify(live) : qa.humanValues(live)[kind];
          if (value === expected) { clearTimeout(timer); unsubscribe(); resolve(); }
        });
        qa.disposers.push(() => { clearTimeout(timer); unsubscribe(); resolve(); });
      });
      void qa.humanMutationDone.catch(error => { qa.humanMutationError = String(error); });
    }, { kind, expected });
  }

  async function run() {
    await evaluate(async () => {
      const [session, resolution, activity] = await Promise.all([
        import('/src/ai/assistantSession.ts'), import('/src/project/playResolution.ts'),
        import('/src/editor/editActivityLog.ts'),
      ]);
      qa.humanCell = { x: 6, y: 6 };
      const item = qa.store.getCurrent().database.items[0];
      if (!item) throw new Error('Owned fixture must contain an existing item record');
      qa.humanItem = { id: item.id, name: item.name, price: item.price };
      qa.humanValues = project => {
        const map = project.maps[project.startMapId];
        const item = project.database.items.find(record => record.id === qa.humanItem.id);
        if (!item) throw new Error(`Observed project lost item ${qa.humanItem.id}`);
        return { itemId: item.id, itemPrice: item.price, tile: map.lowerTiles[qa.humanCell.y * map.width + qa.humanCell.x],
          resolution: resolution.resolvePlayResolution(project.system).width,
          title: project.system.titleScreen?.title, metaTitle: project.meta.title, mapId: map.id };
      };
      qa.humanCounters = { appliedReceipts: [], rejectedNotifications: 0 };
      qa.humanMutations = [];
      const applied = session.AssistantSession.prototype.recordAppliedProject;
      const rejected = session.AssistantSession.prototype.recordApplyRejected;
      session.AssistantSession.prototype.recordAppliedProject = function(result) {
        qa.humanCounters.appliedReceipts.push({ commit: result.commit, values: qa.humanValues(result.applied) });
        return applied.call(this, result);
      };
      session.AssistantSession.prototype.recordApplyRejected = function(...args) {
        qa.humanCounters.rejectedNotifications++;
        return rejected.apply(this, args);
      };
      qa.disposers.push(() => {
        session.AssistantSession.prototype.recordAppliedProject = applied;
        session.AssistantSession.prototype.recordApplyRejected = rejected;
      });
      qa.disposers.push(activity.subscribeEditActivity(entry => qa.humanMutations.push(structuredClone(entry))));
      const config = await import('/src/ai/llmClient.ts');
      const previous = config.loadAiConfig();
      config.saveAiConfig({ ...previous, liteModel: previous.model, agentMode: 'chat', maxToolCalls: 8 });
    });
    report.humanItem = await evaluate(() => qa.humanItem);
    await saveRead('initial-fixture');
    // Establish the actual record selection before drafting. Catalog discovery
    // and image loading are not race actions; only the later field write is.
    const beforeSelection = await evaluate(() => JSON.stringify(qa.store.getCurrent()));
    await page.getByTestId('toolbar-database').click();
    await page.getByTestId('db-tab-items').click();
    await page.getByTestId('db-catalog-filter-items').click();
    await page.getByTestId('db-catalog-search').fill(report.humanItem.id);
    await page.locator('.db-catalog-rows [data-collection="items"]').click();
    assert.equal(await page.getByTestId('db-field-price').inputValue(), String(report.humanItem.price));
    await page.getByTestId('database-modal-close').click();
    await page.getByTestId('database-modal').waitFor({ state: 'hidden' });
    assert.equal(await evaluate(() => JSON.stringify(qa.store.getCurrent())), beforeSelection,
      'Record discovery/selection before drafting does not mutate the project');

    // Run the positive control before intentional RED so safety failure cannot
    // hide whether a current-base proposal still applies and undoes.
    await start('current-base-control', false);
    await finish();
    const positive = await snapshot('01-current-base-applied');
    assert.equal(positive.live.title, title);
    assert.equal(positive.counters.appliedReceipts.length, 1);
    assert.equal(positive.counters.rejectedNotifications, 0);
    observations.agreement({ id: 'current-base', title, tool: 'set_title_screen',
      expected: { execution: 'response-final', goal: 'unassessed', delivery: 'persisted-verified' } }, positive.observed);
    await saveRead('current-base-applied');
    await armMutation('bytes', await evaluate(() => qa.humanBefore));
    await page.getByTestId('oprn-tool-undo').click();
    await evaluate(() => qa.humanMutationDone);
    const undone = await snapshot('02-current-base-undone');
    assert.equal(undone.sameBefore, true, 'Actual undo restores exact pre-proposal bytes');
    await saveRead('current-base-undone');
    report.positiveControl = { appliedOnce: true, undoExact: true, remoteReadback: true };

    await start('human-edit-race', true);
    await bounded(held.arrived.promise, 'real title tool produced a detached proposal');
    const { target, humanWidth, humanPrice } = await held.complete(async () => {
      const prepared = await snapshot('03-proposal-held');
      assert.equal(prepared.sameBefore, true);
      assert.equal(prepared.draft.title, title);
      assert.equal(prepared.counters.appliedReceipts.length, 0);
      assert.ok(prepared.observed.events.some(event => event.type === 'tool_call' && event.name === 'set_title_screen' && event.result.ok));

      await page.getByTestId('ai-collapse').click();
      await page.getByTestId('layer-lower').click();
      await page.getByTestId('tool-paint').click();
      await page.getByTestId('brush-size-select').selectOption('1');
      await page.getByTestId('chipset-tile-7').click();
      const target = await evaluate(async () => {
        await qa.nextRender();
        const map = qa.store.getCurrent().maps[qa.store.getCurrent().startMapId];
        // Hit testing excludes overlays. The fixture has no protected houses;
        // retain the explicit spatial exclusion for future default fixtures.
        for (let y = 2; y < map.height - 2; y++) for (let x = 2; x < map.width - 2; x++) {
          if (map.lowerTiles[y * map.width + x] === 7) continue;
          if (map.layoutPlan?.regions.some(region => region.role === 'house'
            && x >= region.x && y >= region.y && x < region.x + region.w && y < region.y + region.h)) continue;
          const point = window.__oprnEditWorldToClient(x * 16 + 8, y * 16 + 8);
          if (document.elementFromPoint(point.x, point.y)?.matches('.phaser-container canvas')) {
            qa.humanCell = { x, y };
            return { x, y, point, before: qa.humanValues(qa.store.getCurrent()) };
          }
        }
        throw new Error('No visible non-house canvas cell for real pointer input');
      });
      report.humanTarget = target;
      await armMutation('tile', 7);
      await page.mouse.click(target.point.x, target.point.y);
      await evaluate(() => qa.humanMutationDone);
      await page.screenshot({ path: `${out}/04-human-tile-control.png` });
      record('real-tile-control', { ...target, selectedTile: 7 });

      await page.getByTestId('toolbar-database').click();
      await page.getByTestId('db-tab-group-system').click();
      await page.getByTestId('db-tab-system').click();
      await page.getByTestId('db-system-nav-display').click();
      const humanWidth = target.before.resolution === 336 ? 352 : 336;
      await armMutation('resolution', humanWidth);
      await page.getByTestId('db-field-system-resolution-width').fill(String(humanWidth));
      await page.getByTestId('db-field-system-resolution-width').press('Tab');
      await evaluate(() => qa.humanMutationDone);
      assert.equal(await page.getByTestId('db-field-system-resolution-width').inputValue(), String(humanWidth));
      await page.screenshot({ path: `${out}/05-human-database-control.png` });
      record('real-database-control', { field: 'system.playResolution.width', before: target.before.resolution, after: humanWidth });

      // Also cover Project.database, independently of map and project.system.
      // Select an existing record by its real identity; all writing is native UI.
      await page.getByTestId('db-tab-group-party').click();
      await page.getByTestId('db-tab-items').click();
      // A fresh modal resets catalog session filters; establish the exact row again.
      await page.getByTestId('db-catalog-filter-items').click();
      await page.getByTestId('db-catalog-search').fill(report.humanItem.id);
      const selectedItem = page.locator('.db-catalog-rows [data-collection="items"]');
      assert.equal(await selectedItem.count(), 1, 'Exact real item identity search');
      assert.equal(await selectedItem.getAttribute('data-record-id'), report.humanItem.id);
      await selectedItem.click();
      assert.equal(await page.getByTestId('db-field-price').inputValue(), String(report.humanItem.price));
      const humanPrice = report.humanItem.price === 137 ? 138 : 137;
      await armMutation('itemPrice', humanPrice);
      await page.getByTestId('db-field-price').fill(String(humanPrice));
      await page.getByTestId('db-field-price').press('Tab');
      await evaluate(() => qa.humanMutationDone);
      assert.equal(await page.getByTestId('db-field-price').inputValue(), String(humanPrice));
      await page.screenshot({ path: `${out}/05b-human-item-price-control.png` });
      record('real-database-record-control', { collection: 'items', id: report.humanItem.id,
        name: report.humanItem.name, field: 'price', before: report.humanItem.price, after: humanPrice });
      await page.getByTestId('database-modal-close').click();
      await page.getByTestId('database-dirty-save').click();
      await page.getByTestId('database-modal').waitFor({ state: 'hidden' });
      await page.getByTestId('ai-collapsed-restore').click();

      const validation = await evaluate(async () => {
        const { commitChangeset } = await import('/src/editor/tools/changeset.ts');
        const live = qa.store.getCurrent();
        qa.humanEdited = JSON.stringify(live);
        const result = commitChangeset(live, JSON.parse(qa.humanBefore));
        return { ok: result.ok, blocking: result.blocking };
      });
      report.humanValidation = validation;
      assert.equal(validation.ok, true, 'Real human edits pass the production commit gate');
      const edited = await snapshot('06-human-values-before-release');
      assert.equal(edited.live.tile, 7); assert.equal(edited.live.resolution, humanWidth);
      assert.equal(edited.live.itemId, report.humanItem.id);
      assert.equal(edited.live.itemPrice, humanPrice);
      assert.equal(edited.draft.itemPrice, report.humanItem.price);
      assert.equal(edited.draft.tile, target.before.tile);
      assert.equal(edited.draft.resolution, target.before.resolution);
      assert.equal(edited.counters.appliedReceipts.length, 0);
      const humanRemote = await saveRead('human-before-release');
      assert.equal(humanRemote.values.tile, 7); assert.equal(humanRemote.values.resolution, humanWidth);
      assert.equal(humanRemote.values.itemId, report.humanItem.id);
      assert.equal(humanRemote.values.itemPrice, humanPrice);
      assert.equal(held.state, 'held');
      assert.equal(edited.observed.result, undefined, 'A has not returned before all human edits');
      assert.equal(edited.observed.activity, undefined, 'A has not published terminal activity');
      assert.equal(edited.counters.rejectedNotifications, 0);
      // Keep both observers subscribed since Send, but start their unchanged
      // completion deadlines only when the intentional transport hold ends.
      await evaluate(() => { qa.startSettleDeadline(); qa.startActivityDeadline(); });
      record('human-owner-completed', { state: held.state, values: humanRemote.values,
        savedIdentity: humanRemote.identity, result: edited.observed.result ?? null,
        activity: edited.observed.activity ?? null, counters: edited.counters });
      return { target, humanWidth, humanPrice };
    });
    await finish();
    const released = await snapshot('07-stale-completion-settled');
    const afterRemote = await saveRead('after-stale-completion');

    // Collect every failure after real actions/readback, not just the first
    // overwritten value. RED is an actual overwrite, never a missing seam.
    const check = observations.check;
    check('stale proposal preserves human tile', () => assert.equal(released.live.tile, 7));
    check('stale proposal preserves disjoint database value', () => assert.equal(released.live.resolution, humanWidth));
    check('stale proposal preserves exact human project bytes', () => assert.equal(released.sameHuman, true));
    check('stale proposal produces zero successful apply receipts', () => assert.equal(released.counters.appliedReceipts.length, 0));
    check('stale proposal publishes rejection', () => assert.ok(released.counters.rejectedNotifications > 0));
    check('remote retains human tile', () => assert.equal(afterRemote.values.tile, 7));
    check('remote retains human database value', () => assert.equal(afterRemote.values.resolution, humanWidth));
    check('stale proposal preserves database item identity', () => assert.equal(released.live.itemId, report.humanItem.id));
    check('stale proposal preserves database item price', () => assert.equal(released.live.itemPrice, humanPrice));
    check('remote retains database item identity', () => assert.equal(afterRemote.values.itemId, report.humanItem.id));
    check('remote retains database item price', () => assert.equal(afterRemote.values.itemPrice, humanPrice));
    observations.agreement({ id: 'stale-proposal', tool: 'set_title_screen',
      expected: { execution: 'failed', goal: 'unassessed', delivery: 'draft' } }, released.observed);
    report.race = { actualOldOverwrite: released.live.tile === target.before.tile
      && released.live.resolution === target.before.resolution && released.live.title === title,
      databaseRecordOverwritten: released.live.itemPrice === report.humanItem.price
        && afterRemote.values.itemPrice === report.humanItem.price,
      released: true, humanEditsThroughControls: true, transportOnlyScripted: true,
      counters: released.counters, remoteValues: afterRemote.values,
      limits: 'Single local client only; no distributed/two-tab lock guarantee. Counters observe successful apply receipts and actual apply-rejected or typed independent-review rejection notifications (Panel and runner may both notify), not adapter invocation counts.' };
    record('human-race-result', report.race);
    assert.deepEqual(report.errors, [], 'No hidden route or browser failure');
    assert.equal(report.contractChecks.filter(check => !check.pass).length, 0,
      'Human-edit-race safety contract violated; see retained values, counters and typed consumers');
    report.assertionsPassed = true;
  }

  return { run: async () => { try { await run(); } finally { held?.cancel(); } },
    respond, intercept: async () => false, ownsTitle: value => titles.has(value),
    release: () => held?.cancel() };
}
