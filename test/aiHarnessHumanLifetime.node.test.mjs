import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { createHumanWorkHold, createHumanEditRaceContracts } from '../scripts/qa/ai-harness-p3-stale.mjs';
import { browserSurface } from '../scripts/qa/ai-harness-browser.mjs';
import { p2Observations } from '../scripts/qa/ai-harness-p2-observe.mjs';

function deferred() {
  const value = Promise.withResolvers();
  void value.promise.catch(() => {});
  return value;
}
async function bounded(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Deadline: ${label}`)), 60000);
    })]);
  } finally { clearTimeout(timer); }
}

test('human owner retains transport through three edits and saved read, beyond the old hold timer', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const hold = createHumanWorkHold({ deferred, bounded });
  const edits = [deferred(), deferred(), deferred(), deferred()];
  const observed = [];
  const pending = hold.wait().then(() => observed.push('released'), error => observed.push(error.message));
  const retry = hold.wait().then(() => observed.push('retry-released'));
  const progress = edits.map(() => deferred());
  const owner = hold.complete(async () => {
    for (const [index, edit] of edits.entries()) {
      await edit.promise; observed.push(index); progress[index].resolve();
    }
  });
  try {
    for (let index = 0; index < edits.length; index++) {
      t.mock.timers.tick(60000);
      edits[index].resolve(); await progress[index].promise;
      assert.deepEqual(observed, Array.from({ length: index + 1 }, (_, i) => i));
    }
    await owner; await pending; await retry;
    assert.deepEqual(observed, [0, 1, 2, 3, 'released', 'retry-released']);
  } finally {
    edits.forEach(edit => edit.resolve()); await owner; hold.cancel(); await pending; await retry;
  }
});

test('human action failure aborts transport instead of allowing final AI completion', async () => {
  const hold = createHumanWorkHold({ deferred, bounded });
  const failure = new Error('human action failed');
  const pending = assert.rejects(hold.wait(), error => error === failure);
  const owner = hold.complete(async () => { throw failure; });
  await assert.rejects(owner, error => error === failure);
  await pending;
});

test('cleanup cancellation terminates both hold and owner and cannot later release AI', async () => {
  const hold = createHumanWorkHold({ deferred, bounded });
  const work = deferred(), entered = deferred();
  const failure = new Error('owned cleanup');
  const pending = assert.rejects(hold.wait(), error => error === failure);
  let signal;
  const owner = hold.complete(async value => { signal = value; entered.resolve(); await work.promise; });
  const cancelled = assert.rejects(owner, error => error === failure);
  await entered.promise;
  hold.cancel(failure);
  await Promise.all([cancelled, pending]);
  work.resolve();
  assert.equal(signal.aborted, true);
  hold.cancel(new Error('duplicate cleanup'));
  await assert.rejects(hold.wait(), error => error === failure);
});

test('the unchanged action deadline cancels a stalled human owner and drains transport', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const hold = createHumanWorkHold({ deferred, bounded });
  const action = deferred();
  const owner = hold.complete(() => bounded(action.promise, 'human action'));
  const failed = Promise.all([assert.rejects(owner), assert.rejects(hold.wait())]);
  t.mock.timers.tick(60000);
  await failed; action.resolve();
  assert.equal(hold.state, 'cancelled');
});

test('human browser evaluations have the existing action bound even though Playwright evaluate does not', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const evaluation = deferred();
  let bounds = 0;
  const contracts = createHumanEditRaceContracts({ page: { evaluate: () => evaluation.promise },
    report: {}, record: () => {}, deferred,
    bounded: (...args) => { bounds++; return bounded(...args); },
  });
  const result = contracts.run().then(() => ({ ok: true }), error => ({ error }));
  try {
    assert.equal(bounds, 1);
    t.mock.timers.tick(60000);
    assert.ok((await result).error instanceof Error);
  } finally { evaluation.reject(new Error('owned test cleanup')); await result; }
});

function observerHarness() {
  const send = { disabled: false }, observers = new Set(), timers = new Set();
  class Storage {
    values = new Map();
    setItem(key, value) { this.values.set(key, value); }
  }
  class MutationObserver {
    constructor(callback) { this.callback = callback; }
    observe() { observers.add(this); }
    disconnect() { observers.delete(this); }
  }
  const originalStorage = Storage.prototype.setItem;
  const context = vm.createContext({ qa: { disposers: [] }, Storage,
    localStorage: new Storage(), MutationObserver,
    document: { querySelector: () => send },
    setTimeout: (callback, ms) => {
      const timer = setTimeout(() => { timers.delete(timer); callback(); }, ms);
      timers.add(timer); return timer;
    },
    clearTimeout: timer => { timers.delete(timer); clearTimeout(timer); },
  });
  const page = {
    evaluate: async (callback, argument) => {
      context.argument = argument;
      return vm.runInContext(`(${callback.toString()})(argument)`, context);
    },
    getByTestId: () => ({ fill: async () => {}, click: async () => {
      send.disabled = true; observers.forEach(observer => observer.callback());
    } }),
  };
  const harness = { page, record: () => {}, report: {} };
  const surface = browserSurface(harness), activity = p2Observations(harness);
  return { context, surface, activity, timers, observers,
    terminal: () => {
      send.disabled = false; observers.forEach(observer => observer.callback());
      context.localStorage.setItem('oprn:ai-activity-logs', JSON.stringify([
        { instruction: 'owned', result: { stoppedReason: 'done', pending: false } },
      ]));
    },
    storageRestored: () => Storage.prototype.setItem === originalStorage,
  };
}

for (const deferredDeadline of [false, true]) {
  for (const end of ['terminal', 'deadline', 'cleanup']) {
    test(`completion observers: deferred=${deferredDeadline}, ${end}`, async t => {
      t.mock.timers.enable({ apis: ['setTimeout'] });
      const h = observerHarness();
      try {
        await h.activity.armActivity('owned', { deferDeadline: deferredDeadline });
        await h.surface.send('owned', { deferDeadline: deferredDeadline });
        if (deferredDeadline) {
          assert.equal(h.timers.size, 0);
          t.mock.timers.tick(60000);
          assert.equal(h.observers.size, 1);
          assert.equal(h.storageRestored(), false);
        }
        const done = Promise.all([h.context.qa.settled, h.context.qa.activityDone]);
        if (end === 'deadline') {
          const rejected = assert.rejects(done);
          h.context.qa.startSettleDeadline(); h.context.qa.startActivityDeadline();
          assert.equal(h.timers.size, 2);
          t.mock.timers.tick(60000);
          await rejected;
        } else {
          if (end === 'terminal') h.terminal();
          else h.context.qa.disposers.forEach(dispose => dispose());
          await done;
          h.context.qa.startSettleDeadline(); h.context.qa.startActivityDeadline();
        }
        assert.equal(h.timers.size, 0);
        assert.equal(h.observers.size, 0);
        assert.equal(h.storageRestored(), true);
      } finally { h.context.qa.disposers.forEach(dispose => dispose()); }
    });
  }
}
