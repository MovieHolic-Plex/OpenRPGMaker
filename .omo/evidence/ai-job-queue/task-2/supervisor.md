# Local AI job service - supervisor evidence

Date: 2026-09-06. Scope: plan task 2; managed browser executor and user UI remain later tasks.

## Original worker evidence

Worker RED assertions covered HTTP admission rejecting foreign Origin, durable cancellation,
checkpoint host availability, and save-only retry. Supervisor read the exact HTTP/scheduler
tests, runtime interfaces, implementation and task handoff.

## Supervisor-found regression: lost scheduler wake

The scan takes a snapshot of jobs. If another job is admitted while a failed dependency is
being inspected, the old `kick()` discarded that new wake because a pump already existed.
The scan could then end without ever considering the newly admitted job.

RED command:

```sh
node --test --test-name-pattern='admission while dependency scanning' test/aiJobsScheduler.test.mjs
```

Monitor `mon_XMRA020M0WJHDARD` exited 1:

```text
admission while dependency scanning drains wakes the next eligible job
Error: Expected durable job event not observed
tests 1, pass 0, fail 1
```

The test holds an actual repository read at an explicit barrier, admits another job, and
subscribes to its completion before releasing the scan. No timing sleep or implementation
counter assertion is used.

Fix: preserve a coalesced `wakePending` while the pump runs and kick once after it drains.

GREEN command:

```sh
node --test test/aiJobsRepository.test.mjs test/aiJobsHttp.test.mjs test/aiJobsScheduler.test.mjs
```

Monitor `mon_BMAPR424XNA4RBN5` exited 0: **46 passed, 0 failed**, including the new regression.
The earlier supervisor 45-test run plus `npm run typecheck:app` also exited 0
(`mon_ZEBES7AREPHCJ5HA`). Scheduler-only follow-up changed no app declaration/type inputs.
LSP was clean on scheduler, HTTP, provider operations, service, Vite plugin/config,
foundation extensions and tests.

## Actual HTTP proof

Supervisor ran `node .omo/evidence/ai-job-queue/task-2/exercise.mjs` through
`mon_AKE7X02D39SZBACB`, exit 0. Observed one physical provider dispatch and one generated-ID
allocation through cancel, explicit retry, late response reuse and restart. Mismatched
idempotency/save hashes returned 409, foreign Origin returned 403, and same-receipt
failed-to-saved evidence update succeeded.

Fixture application receipts prove protocol behavior only, not a real project save.
Fixture image bytes prove artifact transport only, not visual report rendering.

Cleanup: owned HTTP listener closed, temporary repository removed, zero user DB writes.
Final post-fix command:

```sh
npm run build:app && node .omo/evidence/ai-job-queue/task-2/exercise.mjs && node .omo/evidence/ai-job-queue/task-2/vite-exercise.mjs
```

Monitor `mon_B7ZHGK4YG3TC8SB2` exited 0. App build completed; HTTP restart again confirmed
one physical dispatch and one ID allocation. Actual Vite dev HTTP, preview HTTP and
preview HTTPS each verified session/list access, explicit unavailable admission and
shutdown with a live SSE client. All three released the writer and listener. Final
`ss -ltnp` found no `:19841` listener; pre-existing `:9841` remained untouched.

Committed RED logs retain assertion content; trailing spaces on blank log lines were
removed solely to pass repository whitespace checks.
