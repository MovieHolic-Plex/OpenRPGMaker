# Task7 cleanup review delta: C6 and C5

Review target: `.omo/evidence/task-7-code-review.md`, reviewer task `st_01a078fe`.
Implementation task: `st_01a078e3`, same non-UI owned-runner cleanup assignment.
Date: 2026-09-06 23:28 UTC / 2026-09-07 08:28 KST.

## Delivered correction

Both review findings were accepted and corrected. This is implementation evidence for the **same reviewer**, not a claim of reviewer approval.

### C6: pipe-dependent process waits

The reviewer was correct: a non-null `Process.returncode` does not complete an already-subscribed asyncio `Process.wait()` when descendants retain stdout/stderr. The previous TERM path waited on that task before reaching KILL.

The runner now:

1. Performs bounded TERM/pidfd exit observation and reaps adopted exits.
2. Reclaims remaining owned descendants with bounded KILL **before joining process wait tasks**.
3. Uses `finish_process_waits()` to await the original server and workload tasks with `wait_for(shield(task), escalation)`. It does not substitute a newly created `child.wait()` that can return early after returncode is set.
4. Records a process output/exit deadline as a cleanup error and continues. The emergency cleanup path uses the same bounded joins. Reader completion remains bounded separately.

There are no unbounded server/workload joins before or after KILL. The existing 180-second graceful deadline, owned-only PID/start-identity/pidfd targeting, subreaping, temp cleanup, stale-receipt rejection, and separate command/cleanup outcomes remain intact. No timeout was extended and no successful force-exit was added.

### C5: fake-fixture port isolation

Each `run_case()` allocates a loopback ephemeral port using bind-to-zero and explicitly sets `TASK7_PORT` for its runner. It does not inherit the shared replay port. Every case checks that the chosen port is neither 19841 nor 9841, that the fresh receipt reports that exact port, and that an independent bind succeeds after the runner finishes. All five prior scenario assertions remain, plus the new mixed-exit regression.

The documented **bare** command needs no exported port:

```sh
python3 -m unittest discover \
  -s .omo/evidence/ai-job-queue/task-7 -p 'test_*cleanup.py' -v
```

## Failing-first mixed-tree regression

`test_exited_parent_with_term_resistant_descendant_holding_output` uses real processes and inherited output pipes:

- The fake fixture creates a child with inherited stdout/stderr and an installed TERM-ignore handler. A child-owned loopback socket keeps it alive even after its parent exits; no timer or polling keeps it alive.
- The child reports readiness through its exact IPC message after the listener is ready.
- The workload blocks on a test-owned Unix socket. The test opens the fixture parent's pidfd and subscribes to its exit **before** acknowledging the workload, so shutdown/TERM cannot precede the subscription.
- The workload exits 0. Shutdown returns HTTP 200 but deliberately does not close the fixture. On TERM the parent exits 0; its resistant child retains the output pipe.
- The test awaits that exact parent-exit event and bounded runner completion. It checks actual PIDs/temp state before fallback test cleanup, not just fields in the receipt. All async coordination has bounded deadlines; no sleeps/polling are used. The control acknowledgment is line-framed, not a timing-dependent single stream `recv`.

### RED, before runner correction

`runner-cleanup-review-mixed-red.log`: exit **1**, one failing test, 9.249 seconds.

- Isolated port **32781**.
- Parent exit event observed.
- Runner output recorded command **0**, shutdown HTTP **200**.
- Outer runner deadline expired; fallback killed the stalled wrapper.
- Resistant descendant **1083045** and `/dev/shm/task7-editor-7ra6i7s6` remained before test cleanup.
- The persisted receipt was still **`status: running`**, proving final evidence/KILL were unreachable on this branch.

`runner-cleanup-review-before.py.txt` captures that pre-correction runner. RED can be reproduced without using any shared port:

```sh
TASK7_TEST_RUNNER=.omo/evidence/ai-job-queue/task-7/runner-cleanup-review-before.py.txt \
python3 .omo/evidence/ai-job-queue/task-7/test_runner_cleanup.py \
  RunnerCleanup.test_exited_parent_with_term_resistant_descendant_holding_output
```

### GREEN, final code

The bare isolated command completed in **one pass: 6 tests, 11.015 seconds, exit 0**. See `runner-cleanup-review-green.log`.

Final mixed-case UUID: **`e70935dd-e0a0-4a9f-8e84-ff799a7013f5`**.

| Observation | Result |
| --- | --- |
| Test port | 32955 |
| Actual parent-exit event | observed |
| Command / parent / wrapper exit | **0 / 0 / 1** |
| HTTP shutdown | 200 |
| TERM targets | parent 1138032 and child 1138057 |
| KILL targets | **child 1138057 only** |
| Receipt | complete, graceful false, explicit cleanup errors |
| Remaining PIDs/temp before test cleanup | none / absent |
| Stale fixture success | rejected; fresh fixture receipt absent, not copied |

The wrapper's **1 is the correct result**: it reclaimed the resistant descendant but must not convert failed graceful shutdown into success.

Final case ports: **36875, 32955, 55777, 33475, 49341, 37533**. No test used 19841 or 9841.

## Validation and evidence

- Python compilation succeeded for `run-owned.py` and `test_runner_cleanup.py`.
- The embedded fake Node fixture passed `node --input-type=module --check` (syntax only).
- Both changed Python files have **no LSP diagnostics**.
- `runner-cleanup-review-validation.log` records syntax/test exits.
- `runner-cleanup-review-mixed-green.json` preserves the final mixed-case test output and complete fresh receipt from this test run.
- `runner-cleanup-review-resources.json` independently checks only this delta's known RED/GREEN test PIDs and temp paths: none remain. It does not scan or clean GROK's resources.
- `runner-cleanup-review-delta.patch` is the exact two-Python-file delta against the pre-review snapshots. `runner-cleanup-fix.patch` is refreshed for the current runner; its fixture portion is unchanged.

## Scope and replay boundary

No real fixture or UI runtime file was edited in this delta. No real-fixture test/workload was rerun. No connection, bind, shutdown, or process selection used 19841/9841; GROK owns the ongoing replay. No UI/image work, downloads, paid calls, application/model/settings changes, global gates, or commits.

The already-running replay process loaded the earlier Python source; this disk edit **does not patch that live runner**. Its eventual outcome remains GROK/parent-owned. Earlier real-fixture proofs in `RUNNER-CLEANUP-HANDOFF.md` are historical, not fresh measurements of this delta or the active replay. The original full-UI graceful hang remains a separate verification dependency; fixing this reproduced fallback deadlock does not establish that original hang's cause.
