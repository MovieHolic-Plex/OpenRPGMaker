# Task7 owned-runner cleanup implementation and proof

Task: `st_01a078e3` (non-UI process/runtime scope).
Worktree: `/home/main/.herdr/worktrees/rpg-zzu/worktree-silver-harbor-d2a7`.
Initial round completed: 2026-09-06 23:02 UTC / 2026-09-07 08:02 KST.
Review delta completed: 2026-09-06 23:28 UTC / 2026-09-07 08:28 KST.

## Review delta: C6/C5 corrected for the same reviewer

See **[RUNNER-CLEANUP-REVIEW-DELTA.md](RUNNER-CLEANUP-REVIEW-DELTA.md)** for the correction, failing-first reproduction, fresh receipts, and exact delta patch responding to `.omo/evidence/task-7-code-review.md` (reviewer `st_01a078fe`). Approval is not presumed.

- KILL is now reachable without an unbounded pipe-dependent parent wait. Original server and workload wait tasks are joined only with bounded deadlines after owned descendant reclamation, including emergency cleanup.
- The new exact-event regression reproduces parent exit 0 with a TERM-resistant descendant holding inherited stdout/stderr. RED stalled with a `running` receipt; GREEN completes with command 0 / parent 0 / wrapper 1, truthful cleanup failure, and no owned PIDs/temp.
- Every fake-fixture case allocates and supplies its own ephemeral port, checks the exact receipt port, and independently rebinds it after cleanup. The documented bare unittest-discover command requires no exported port and passed **6 isolated tests in one run, 11.015 seconds**.
- Only the Python runner, isolated test, and evidence changed in this delta. Python/fake-JS syntax and both changed files' LSP diagnostics passed. The real fixture and UI runtime were not edited or rerun; 19841/9841 were not used.

**Replay boundary:** GROK owns the current 19841 replay. These disk edits do not patch its already-loaded Python runner. All real-fixture/port observations below are **historical initial-round evidence**, not current replay measurements. During that replay, use only the isolated fake-fixture command in the delta; real-fixture commands require coordination.

## Initial-round outcome and limit (historical)

**Implemented and verified:** the owned runner's cleanup/receipt failure paths and the real fixture's competing SIGTERM teardown owner. Six process-only regressions are GREEN after recorded RED runs. The real fixture on **19841** completed an HTTP session/SSE workload and owned HTTP shutdown with command **0**, HTTP **200**, fixture **0**, wrapper **0**, no escalation, and all owned process/temp resources gone.

**Not claimed:** reproducing or eliminating the original full-UI run's initial 180-second graceful wait. Its old logs contain no close-stage information. The process-only HTTP workload did not reproduce that wait. The competing SIGTERM handler explains and reproduces premature exit/missing temp cleanup on the fallback path; it does not establish what blocked the original graceful request before fallback. A full-UI replay remains GROK/parent-owned, not an Astra UI action. Fresh receipts now identify the blocked stage if that wait recurs.

The prior product result remains **Playwright exit 0, 3 passed** (`grok-ui-full.log`). The old wrapper's teardown failure is not a product assertion failure, and a successful product command cannot hide a new teardown failure.

## Changes delivered

### `run-owned.py`

- Preserves the `LABEL COMMAND [ARG ...]` entry point, `TMPDIR=/dev/shm`, `DEV_SERVER_PORT=19841`, `E2E_RETRIES=0`, and the **180-second default graceful deadline**. No extension to hide a leak.
- Creates the owned temporary directory itself, then passes its exact path, a fresh UUID run ID, and a run-specific fixture receipt path to the fixture.
- Atomically replaces the label's receipt with `status: running` before launching processes. The final `finally` writes command, server, HTTP, cleanup, escalation, port, temp, and actual exit outcomes, including failure paths.
- Never reads or copies `browser-cleanup.json`. Missing or identity-mismatched fresh fixture receipts are cleanup failures, never stale success.
- Subscribes to readiness/stdout EOF and process exit with bounded asyncio deadlines. Output goes directly to `<label>-server.log`, so a failed cleanup cannot skip its server log copy.
- Registers Linux child-subreaper ownership before spawning; uses isolated process sessions, `/proc` ancestry/start identities, pidfds, and exact exit notifications to reap owned descendants, including detached/adopted grandchildren.
- Bounded escalation is SIGTERM then SIGKILL, **only against the owned tree**, recorded as a cleanup failure even when it successfully reclaims resources. The default escalation bound is 10 seconds per stage. No process is selected or killed by port.
- Rejects an occupied requested port before starting; does not send a shutdown request unless its own fixture reached readiness.
- Separates `commandExit`, `runnerError`, `serverExit`, `shutdownHttp`, `graceful`, and `cleanupErrors`. Command exit 7 remains 7 after good cleanup; command exit 0 plus failed cleanup returns 1.

Test-only deadline/port controls: `TASK7_READY_TIMEOUT`, `TASK7_COMMAND_TIMEOUT`, `TASK7_SHUTDOWN_TIMEOUT`, `TASK7_ESCALATION_TIMEOUT`, `TASK7_PORT`. The final real run used defaults, including port 19841 and graceful deadline 180 seconds.

### `editor-fixture-server.mjs` (lifecycle only)

- Accepts the runner's owned temp/run/receipt identity. Standalone launches use a unique `fixture-<UUID>-cleanup.json`, not the shared historical file.
- Removes only the SIGTERM listener added by the embedded Vite instance. Vite's standalone listener calls `process.exit()` after closing Vite; the embedding must own service/browser/temp teardown instead.
- HTTP shutdown and SIGINT/SIGTERM share the fixture's idempotent close promise. The fixture **exits naturally**, not by a successful-path `process.exit()` that could conceal live handles.
- Records each cleanup stage before waiting on it: service, browsers, Vite, temporary, complete. A hang leaves a current incomplete receipt naming its stage.
- Attempts later teardown stages after a preceding stage rejects, records rejection details, and exits nonzero. Flags become true only after their associated close/removal succeeds.
- Keeps a browser in the owned set if its `close()` rejects; attempts closure of any remaining owned browsers before Vite closes.
- The runtime/provider/seed/report/application portion from `const runtime =` through the beginning of `close()` is byte-for-byte unchanged from the captured original. No renderer, UI TS/CSS, settings, model configuration, or production code was edited.

`runner-cleanup-fix.patch` contains the exact runner/fixture correction against the original snapshots. `.omo` evidence is git-ignored in this worktree; these files exist on disk, not in a commit.

## Deterministic RED/GREEN

### Runner process seam

`test_runner_cleanup.py` runs the actual Python entry point against temporary Node HTTP fixture processes. It does not mock subprocess or filesystem cleanup. The timeout case creates a real owned child; parent and child deliberately ignore SIGTERM, so SIGKILL coverage is not timing-dependent. Assertions check actual PIDs/temp existence **before** the test's fallback cleanup can mask a leak.

| Case | Original runner RED | Corrected runner GREEN |
| --- | --- | --- |
| Command 0 + cleanup | No complete per-run command/cleanup receipt | Wrapper 0, graceful true, fresh matched fixture receipt |
| Command 7 + cleanup | Missing `commandExit` receipt field | Wrapper 7, graceful true, resources gone |
| Shutdown HTTP 500 | Exception bypasses final receipt; stale label survives | Wrapper 1, command 0, HTTP 500, failure recorded, resources gone |
| Shutdown 200 but never closes, owned child ignores TERM | Exceeds outer bounded process deadline; stale receipt remains | Wrapper 1, TERM then KILL recorded for owned PIDs, no descendants/temp left |
| Fixture does not write a fresh receipt | Copies historical success and exits 0 | Wrapper 1, `fixture: null`, missing-fresh-receipt failure |

- `runner-cleanup-red.log`: exit 1, five cases fail (3 failures, 2 missing-field errors), 9.174 seconds.
- `runner-cleanup-green.log`: final single pass, exit 0, **5 tests**, 10.351 seconds.
- `runner-cleanup-baseline.py.txt`: captured original executable runner source for reproducing RED through `TASK7_TEST_RUNNER`.

### Real fixture SIGTERM seam

`test_fixture_lifecycle.py` starts the **real fixture, real service/repository, and real Vite** in an owned temporary root, then signals only that child after its readiness event. `fixture-lifecycle-observer.mjs` logs real close calls and returns the original promises; it does not replace their behavior. Exit/stdout subscriptions precede SIGTERM. No sleeps or polling.

- RED (`runner-cleanup-baseline-fixture.mjs`): PID 775913, exit **143**, call order **Vite -> service -> Vite**, owned temp still present, no current receipt. See `fixture-lifecycle-red.log`.
- GREEN (current fixture): call order **service -> Vite**, natural exit **0**, temp removed, matching receipt with service/server closed and no cleanup errors. Final single pass: **1 test**, 1.915 seconds, exit 0. See `fixture-lifecycle-green.log`.

This is the demonstrated missing-teardown mechanism, rather than an import/syntax test or a longer timeout.

## Initial-round actual owned-server surface proof (not rerun in review delta)

Executed from the main worktree:

```sh
python3 .omo/evidence/ai-job-queue/task-7/run-owned.py \
  runner-cleanup-real-http-final \
  node .omo/evidence/ai-job-queue/task-7/runner-http-workload.mjs
```

The non-UI workload obtains the real local session, opens the real SSE endpoint, subscribes to stream end **before** requesting service disconnection, awaits that exact event, and checks fixture counts. It does not launch a browser, inspect images, submit a job, or invoke a provider. The runner then performs HTTP `/__task7/shutdown`.

Final fresh identity: **`9bee6fe5-d75b-41db-9996-2c5baadf31be`**.

| Check | Observed |
| --- | --- |
| Real fixture PID | 860963, absent at the initial-round audit |
| Command / HTTP shutdown / fixture / wrapper | **0 / 200 / 0 / 0** |
| Graceful | true |
| Escalations / cleanup errors / remaining PIDs | `[] / [] / []` |
| Owned temp | `/dev/shm/task7-editor-x6b4ybjn`, removed |
| Service / Vite closure | true / true |
| Provider calls / external paid calls / active browsers | 0 / 0 / 0 |
| SSE | one connection, exact end event observed |
| Port 19841 | independent bind succeeds, no listener |
| Port 9841 | original PID **2252417** still listening, untouched |

Initial-round real-surface proof files (historical):

- `runner-cleanup-real-http-final-cleanup.json` (runner aggregate)
- `runner-cleanup-real-http-final-9bee6fe5-d75b-41db-9996-2c5baadf31be-fixture-cleanup.json` (fixture stage receipt)
- `runner-cleanup-real-http-final.log` (workload result)
- `runner-cleanup-real-http-final-wrapper.log`
- `runner-cleanup-real-http-final-server.log`
- `runner-cleanup-final-resources.json` (independent post-test `/proc`, port bind, `ss`, and tmpfs audit)

The initial-round resource audit at 23:02 UTC checked all eight then-recorded test/real-server PIDs, found none remaining, and found no `/dev/shm/task7-*` paths. This is not a current shared-port or global-temp claim. The review delta checks only its own isolated resources in `runner-cleanup-review-resources.json`.

## Initial-round validation and observed stderr (historical)

Executed, no app-wide build/gates:

```sh
python3 -m unittest discover \
  -s .omo/evidence/ai-job-queue/task-7 -p 'test_*cleanup.py' -v
python3 .omo/evidence/ai-job-queue/task-7/test_fixture_lifecycle.py
node --check .omo/evidence/ai-job-queue/task-7/editor-fixture-server.mjs
node --check .omo/evidence/ai-job-queue/task-7/fixture-lifecycle-observer.mjs
node --check .omo/evidence/ai-job-queue/task-7/runner-http-workload.mjs
```

Python `compile(..., 'exec')` succeeded for all three active Python files. Language-server diagnostics reported **no diagnostics** on all six active changed Python/JS files. See `runner-cleanup-validation.log` for syntax, invariant, test, and real-run exit results.

**Not a zero-stderr claim:** Vite logs dependency-scan cancellation errors (`The server is being restarted or closed. Request is outdated`) when this short workload closes while its initial repository-wide scan is still running. The initial baseline investigation also produced them (`runner-process-investigation-server.log`). They remain in the raw real-server log; they were not filtered or silenced. Vite's close promise resolves, the process exits naturally, and the independent resource audit succeeds. The fixture's `errors: []` refers to its service error callback, not to every line of Vite stderr.

The first direct baseline investigation used the old fixture's shared receipt default. **Do not treat `browser-cleanup.json` as this final run's receipt.** Neither the corrected runner nor the final proof reads or copies it. GROK's historical cleanup receipts were not rewritten as current success.

## Scope and remaining dependency

- Existing Task7 UI files and PNGs were not edited or inspected as images. The original tracked/untracked application-change list is unchanged. Seed/runtime/application invariance was checked against the captured fixture source.
- No install/download, paid provider call, user-project write, settings/model/env-file change, full app build, commit, push, or PR.
- The runner intentionally targets this Linux workstation: `/proc`, pidfds, child subreaping, and `/dev/shm` are assumptions, not portable-OS claims.
- GROK/parent owns the active full UI replay and its original-graceful-wait verification. This review delta neither uses 19841 nor updates the already-loaded runner process. No delta-owned process/temp remains. Report product command and cleanup outcomes separately and use the replay's own UUID fixture receipt/close stage, not historical shared receipts.
