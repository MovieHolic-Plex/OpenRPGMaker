# P1 R1 persistence-proof fixture correction

Task: `st_01a076d2`, 2026-09-06. Worktree:
`/home/main/z-project/rpg-zzu-ai-harness-p1-r1-fixture-20260906`.
Branch: `agent/ai-harness-p1-r1-fixture-20260906`.
Base: `67b98598776d25f66c63e6e49c2b7dfe21cf5773`.

## Outcome and scope

Corrected the test seam's avoidable timing sensitivity and uncorrelated background
commit signal. Only `test/storePersistenceProof.test.ts` fixture/setup/cleanup and
this evidence file change. All 18 original cases, including their 41 written
`expect(...)` expressions and existing timeout arguments, are byte-identical to
base from the first `it(...)` through EOF. Parameterized cases remain intact.
No production root cause requiring broader edits was established.

The final requested three-file command passed once: 55/55 tests, exit 0. The
previously failing retry case took 1,554 ms in that run. This is supporting GREEN
verification, not the sole explanation of the original timeout.

## Original RED and its limits

Read AGENTS, quickstart, INDEX, PROJECT_WIKI, focused testing/schema guidance, the
store, commit writer, serializer, loader, defaults, timer owners and neighboring
proof/lineage/session tests before settling the correction.

Main-session raw evidence (read-only):

- `/home/main/z-project/rpg-zzu/.omo/evidence/ai-harness-implementation/p1-r1-547a652be-focused.log`
- Same prefix, `-focused-vitest.json`.

Exact raw failure:

```text
FAIL test/storePersistenceProof.test.ts > accepted revision persistence proof > keeps a failed proof retryable for the same accepted revision
Error: Test timed out in 15000ms.
  test/storePersistenceProof.test.ts:205:3
Tests 7 failed | 176 passed (183)
```

JSON duration: `15698.211873000007` ms. Only this proof case failed; the other six
failures were the reported legacy `storePersistence` failures. The clean-flush
legacy failure did not recur in that evidence. Those tests were not edited.

The historical log contains no operation-stage timestamps. It cannot prove which
await was active at the original deadline, or distinguish CPU scheduling from GC.
No claim is made that a later successful retry reconstructs that missing trace.
The demonstrated defect is that cold module/constructor work and unnecessarily
large catalog serialization/normalization shared the 15-second operation budget.
The source has no retry timer inside `verifyPersistedRevision`; a 503 returns a
failed proof and the next explicit invocation independently performs a real read.

## Mechanism and measured costs

Temporary instrumentation was confined to the owned fixture/setup/cleanup. It
used `node:perf_hooks` performance (not the fake global clock), tracing before and
after store import/flush, each actual fetch boundary, commit signal, and timer
counts. Payload sizes below are JS string lengths, not UTF-8 byte counts. The
instrumentation was removed before final verification.

Trace chain:

1. Each `vi.resetModules()` re-evaluated the store graph; its constructor calls
   `createBlankProject()`. That calls `createProjectWithMaps`, which seeds the
   complete default tileset/database catalogs even though there is only one map.
2. `store.update` clones that project. `persistCurrent` strips drafts, saves the
   wire project and child rows, clones the accepted baseline, and invokes
   `serializeForComparison` for the receipt. Comparison really deserializes,
   validates/normalizes, sorts object keys, serializes, and SHA-256 hashes.
3. The proof read uses the actual normalized hybrid loader (including ordinary
   map overlay). Its load repair also deserializes for reference collection;
   comparison then normalizes again. Full unrelated catalogs are paid for at
   multiple boundaries, not just once at import.
4. `recordManualProjectCommitAfterSave` launches the actual background writer.
   That writer hashes, POSTs `project_commits`, then POSTs `project_changes` and
   handles its response before completing. A request-arrival signal alone is not
   its completed promise or its accepted revision identity.

Measured original top-level catalog lengths: tilesets **1,516,417**, database
**585,866**, resource profiles **67,436**, maps **2,280**. Initial project POST:
**2,175,592** characters; tileset child POST: **1,517,848**.

The original first-case cold import was **9,135 ms**. Later module/constructor
re-evaluations were **392-1,385 ms** in that trace. The retry case's observed
milestones (ms since its fixture started):

| Boundary | Original | Reduced fixture |
|---|---:|---:|
| Store import complete | 1,302 | setup hook: 509 ms, outside this operation clock |
| Flush starts | 1,421 | 75 |
| Project POST | 1,784 | 178 |
| Flush resolves | 3,169 | 311 |
| Correlated commit boundary | 3,185 (old uncorrelated arrival) | 312 (writer also awaited) |
| First proof projects GET (503) | 3,185 | 313 |
| Second proof projects GET | 3,186 | 314 |
| Successful read reaches maps GET | 4,132 | 487 |

Original case total reported by Vitest: 4,639 ms. Reduced traced total: 1,111 ms
(including its 509 ms setup). Timings are observations under different machine
loads, not a throughput SLA or a controlled CPU benchmark. The payload reduction
is deterministic: project POST **658,798** characters and tileset POST **340**.
The full proof file went from 83,299 ms in the original trace to 31,110 ms in the
corrected trace. The pre-review uninstrumented related run was 18,666 ms; the
final reviewed run was 45,409 ms for this file (all 18 passed). This spread is
why payload counts and exact signals, not a speedup ratio, are the evidence.

### Setup relocation is separate from payload reduction

Store module construction now belongs to isolated `beforeEach` after env/window
setup. `vi.resetModules()` remains; no shared store state or cache warm-up was
substituted. Existing hook and test timeouts were not raised. Actual accepted
save, commit and proof operations still occur inside the original test cases.
This relocation does not make imports or construction cheaper: it assigns their
unchanged cost to the existing setup budget. The separately measured payload
reduction removes unrelated catalog work from the real save/read pipeline.

### Timer and completion investigation

- Original retry: two fake timers before flush, one after flush and at cleanup.
  Source inspection identifies autosave plus edit-activity disk-mirror debounce.
  The newer-local-edit case re-armed autosave and had two at cleanup.
- No timer was advanced, no polling/sleep was used, and no mirror HTTP call
  occurred in that trace. Thus observed timer firing is **not** the demonstrated
  cause of the historical timeout. The mirror was unnecessary fixture state.
- Disable only the unrelated edit-activity disk mirror via its existing env flag.
  The corrected retry has one fake autosave timer before flush and zero after.
- Native 10-second rejection deadlines bound deferred event signals while fake
  application timers remain frozen. They do not drive progress. Every settled
  signal clears its deadline; teardown rejects/drains abandoned signals and
  asserts none were abandoned, clears fake timers, and restores mocks/env/globals.
- The real commit writer is observed with a **call-through spy**, never an
  implementation/result override. Its returned promise is awaited and its
  commit ID checked against the transport signal, so its response handling and
  manual-commit completion do not bleed into the next test.

## Focused deterministic signal RED/GREEN

The old fixture resolved its waiter for *any* `/rest/v1/project_changes` request.
To test this independently of machine speed, a temporary fixture challenge
subscribed first, called the actual `recordProjectCommitToSupabase` with the same
project content but explicit target `foreign-project`, awaited that real writer,
and checked `pendingSignals.has(committed.promise) === true` before local save.
There was no sleep, polling or race against a short timer.

With an explicit diagnostic mutation restoring the old unconditional resolver,
all 18 cases failed immediately at that machine-state assertion:

```text
AssertionError: expected false to be true // Object.is equality
expect(pendingSignals.has(committed.promise)).toBe(true);
Test Files 1 failed (1)
Tests 18 failed (18)
```

Removing only that mutation made the same foreign-write challenge pass all 18
cases. This proves the signal correlation defect; it does **not** claim that a
foreign request occurred in the historical timeout. Both temporary challenge and
mutation were removed before the final command.

The shipped waiter correlates `project_changes.entity_type/entity_id/commit_id`
to `project_commits.project_id/current_sha256`, then checks the saved receipt's
target/hash and the actual writer result's commit ID. GET/DELETE/PATCH target
filters, transport origin, and project write target are also checked. Wrong-target
proof *responses* are still deliberately allowed by their existing negative case.

One intermediate implementation error is retained in the log history: the first
correlator mistakenly read `project_changes.project_id`. Production actually
ships `entity_type: "project"` and `entity_id`. This caused 18 explicit 10-second
signal-deadline failures, not suppressed failures. Reading the actual
`projectChangeRow` schema and correcting those fields made the complete file pass.
It was a fixture implementation error, not a production defect.

## Mid-flight review: fixture guards and early rejection lifecycle

The lead's review required replacing the two new non-null assertions. Both now
use explicit invariant guards: missing start map or missing start tileset throws
a fixture error. No case bodies or timeout arguments changed. The parent's
README-only commit `e615842b7` was reported during review; this worktree remains
on its assigned base and no README or other reserved file was changed.

The review also identified a real defect in the first bounded helper: the native
deadline could reject its returned `.finally()` promise before `flush()` finished
and before the consumer attached `await committed.promise`. The final helper
attaches an observer immediately. It does **not** convert the consumer's promise
to success: the identical error remains its rejection. Every observer error is
also recorded in `signalErrors`; teardown throws an `AggregateError` containing
those errors, even if the consumer never reaches its await. Teardown still drains
abandoned signals and restores timers/mocks/env/globals in `finally`.

A separate source-extracted helper probe ran with:

```sh
PROBE_MODE=red node --unhandled-rejections=strict --input-type=module
PROBE_MODE=green node --unhandled-rejections=strict --input-type=module
```

The inline harness reads the final test file, extracts the declarations from
`const pendingSignals` through the end of `deferred`, and transpiles them with the
installed TypeScript. It executes that exact helper against `node:timers`. It
subscribes to the error-ledger insertion before creating a deferred and deliberately
does not consume its promise until the actual 10-second deadline rejects. A
`MessageChannel` delivery releases the late consumer after that rejection turn.
The probe asserts the original error still rejects the consumer, remains in the
teardown ledger, and leaves no pending signal. The outer probe has its own
15-second fail-fast bound. No polling or unrelated sleeps are involved: the
native deadline itself is the behavior under test.

RED removes only the immediate observer from the in-memory extracted source;
it never edits another file. Strict Node exited 1 before the consumer could run:

```text
Error: Proof fixture transport signal deadline
    at Timeout.eval (..., <anonymous>:7:54)
Node.js v24.11.1
```

GREEN uses the unchanged final helper, exited 0, and printed:

```text
PASS: native deadline observed before late await; strict unhandled mode survived; original error retained for consumer and teardown; no pending signal
```

Both native probe processes terminated and their deadline/message-port resources
were released. They supplement, not replace, the full requested three-file GREEN
run performed once after the review edits.

## Preserved transport-backed contract

The small tileset has one legal tile and reuses the real bundled image reference;
the existing map dimensions/start position, database, resource profiles, system
and session remain. Loader validation is not mocked. There is still a real map
for overlays, remote-added-map merges, and local event-draft creation at (2, 2).

All existing checks remain: frozen store-issued receipt and SHA identity; clean
receipt reuse; object-key normalization; ordinary hybrid loader parity and failed
map reads; accepted merged content rather than live state; exclusion of open
drafts; rejection of copied tokens without reads; failed/missing/disabled/aborted
reads; wrong target/content despite matching server hash; retry of the same
receipt with two reads and one save; preservation of newer local edits;
configuration target pinning; and cancellation/disabling during an in-flight read.

Only fetch is a synthetic HTTP transport. The production store, serializer,
normalizer, loader, SHA-256, save writer, commit writer and RequestInit/Response
handling are real. No live Supabase, socket server or browser proof is claimed.
No production files, legacy tests, gates, builds, PRs or other worktrees changed.

## Commands and results

All commands ran in the assigned worktree. Every exit below is the npm process
status captured before displaying log tails, not the status of a pipe consumer.
Diagnostic commands used the entire 18-case file, never a test-name filter.

Let `P` be `npm test -- test/storePersistenceProof.test.ts --maxWorkers 2 --minWorkers 1`.
Raw diagnostic logs are retained on this workstation under `/tmp/st_01a076d2-*.log`.
Their selected measurements/failures are preserved above; full final output is
also preserved below.

| Command/state | Log suffix | Exit | Result |
|---|---|---:|---|
| P, instrumented original (console suppressed by config) | original-profile | 0 | 18 pass; 102,867 ms |
| P --silent false, original timing trace | original-trace | 0 | 18 pass; 83,299 ms |
| P --silent false, erroneous change-row field | small-trace | 1 | 18 signal deadline failures |
| P --silent false, corrected schema and reduced fixture | corrected-trace | 0 | 18 pass; 31,110 ms |
| P --silent false, foreign challenge + old resolver mutation | uncorrelated-red | 1 | 18 exact signal-state failures |
| P --silent false, same challenge without mutation | correlated-green | 0 | 18 pass; 25,793 ms |
| Pre-review related command, no instrumentation/challenge | final-green | 0 | 55 pass, 3 files |
| Strict native-deadline probe, observer removed in memory | deferred-red | 1 | Unhandled deadline rejection crashes Node |
| Strict native-deadline probe, final helper | deferred-green | 0 | Late consumer and teardown retain the error |
| Final requested command after review, no instrumentation/challenge | final-reviewed-green | 0 | 55 pass, 3 files |
| npm run typecheck:app | typecheck-app | 0 | No app type errors |
| Test-file LSP diagnostics after review, severity all | tool result | success | No diagnostics found |
| Evidence Markdown LSP diagnostics | tool result | unavailable | No .md LSP configured; scoped diff checked |
| git diff --check | terminal | 0 | Clean scoped diff |
| Base/current first-it-through-EOF comparison | terminal | 0 | Byte-identical, 41 expect expressions |

Final command (executed once on the final test code):

```sh
npm test -- test/storePersistenceProof.test.ts test/storePersistenceLineage.test.ts test/aiRunEndProof.test.ts --maxWorkers 2 --minWorkers 1
```

### Final raw test output

```text
> rpg-zzu@0.1.0 test
> node scripts/run-vitest.mjs run --configLoader bundle test/storePersistenceProof.test.ts test/storePersistenceLineage.test.ts test/aiRunEndProof.test.ts --maxWorkers 2 --minWorkers 1


 RUN  v3.2.4 /home/main/z-project/rpg-zzu-ai-harness-p1-r1-fixture-20260906

 ✓ test/aiRunEndProof.test.ts (29 tests) 123900ms
   ✓ AssistantSession accepted-revision proof > projects initialized proof events and rechecks freshness after the final status subscriber  3482ms
   ✓ AssistantSession accepted-revision proof > rechecks edit from a synchronous proof subscriber  2673ms
   ✓ AssistantSession accepted-revision proof > rechecks cancel from a synchronous proof subscriber  2233ms
   ✓ AssistantSession accepted-revision proof > does not publish success after a proof subscriber starts a cancelled proof  2284ms
   ✓ AssistantSession accepted-revision proof > returns the latest emitted state when a status subscriber starts a cancelled proof  3135ms
   ✓ AssistantSession accepted-revision proof > preserves cancellation superseding the initial callback  566ms
   ✓ AssistantSession accepted-revision proof > preserves cancellation superseding the receipt callback  1816ms
   ✓ AssistantSession accepted-revision proof > preserves cancellation superseding the failure callback  2154ms
   ✓ AssistantSession accepted-revision proof > preserves cancellation superseding the success-throw callback  3868ms
   ✓ AssistantSession accepted-revision proof > does not resume publication after a pending flush is superseded  1932ms
   ✓ AssistantSession accepted-revision proof > keeps newer 'cancelled' proof when an overlapping read ends 'verified'  3707ms
   ✓ AssistantSession accepted-revision proof > keeps newer 'cancelled' proof when an overlapping read ends 'mismatch'  4012ms
   ✓ AssistantSession accepted-revision proof > keeps newer 'succeeded' proof when an overlapping read ends 'verified'  6448ms
   ✓ AssistantSession accepted-revision proof > keeps newer 'succeeded' proof when an overlapping read ends 'mismatch'  4618ms
   ✓ AssistantSession accepted-revision proof > keeps newer 'succeeded' proof when an overlapping read ends 'cancelled'  4248ms
   ✓ AssistantSession accepted-revision proof > does not claim verified after a failed proof read through actual session completion  4517ms
   ✓ AssistantSession accepted-revision proof > retries failed proof for the same plan/revision, deduplicates success, and reproves a changed revision  8636ms
   ✓ AssistantSession accepted-revision proof > does not promote cancelled during the read or replace editor state  4820ms
   ✓ AssistantSession accepted-revision proof > does not promote disabled during the read or replace editor state  6736ms
   ✓ AssistantSession accepted-revision proof > does not promote target during the read or replace editor state  3658ms
   ✓ AssistantSession accepted-revision proof > does not promote content during the read or replace editor state  5483ms
   ✓ AssistantSession accepted-revision proof > does not promote local-edit during the read or replace editor state  4946ms
   ✓ AssistantSession accepted-revision proof > uses the real apply commit, not a newest remote commit read  6918ms
   ✓ AssistantSession accepted-revision proof > project proof can succeed when the separate commit log fails  8624ms
   ✓ AssistantSession accepted-revision proof > proves a normal no-plan apply through the reusable path without replaying the tool  4492ms
   ✓ AssistantSession accepted-revision proof > does not correlate a later human edit with an in-flight apply commit  6437ms
   ✓ AssistantSession accepted-revision proof > retryLastTurn retries failed proof without replaying the LLM or applied tools  4485ms
   ✓ AssistantSession accepted-revision proof > retryLastTurn proves already applied milestones after a recovered LLM failure  6533ms
   ✓ AssistantSession accepted-revision proof > a clean saved response without an accepted receipt cannot become proof  436ms
 ✓ test/storePersistenceLineage.test.ts (8 tests) 182480ms
   ✓ accepted receipt content lineage > does not resurrect saved authority after reload during PATCH  48169ms
   ✓ accepted receipt content lineage > does not resurrect saved authority after load during PATCH  18838ms
   ✓ accepted receipt content lineage > does not resurrect saved authority after reconnect during PATCH  21495ms
   ✓ accepted receipt content lineage > invalidates an already published receipt on reload even for identical content  21597ms
   ✓ accepted receipt content lineage > invalidates an already published receipt on load even for identical content  21217ms
   ✓ accepted receipt content lineage > invalidates an already published receipt on reconnect even for identical content  18285ms
   ✓ accepted receipt content lineage > invalidates an already published receipt on adopt even for identical content  20165ms
   ✓ accepted receipt content lineage > invalidates an already published receipt on fallback even for identical content  12713ms
 ✓ test/storePersistenceProof.test.ts (18 tests) 45409ms
   ✓ accepted revision persistence proof > verifies the accepted content through actual save/read transport and reuses its clean-flush receipt  4335ms
   ✓ accepted revision persistence proof > compares normalized values rather than JSONB object-key order  1948ms
   ✓ accepted revision persistence proof > uses the ordinary normalized remote load and map-overlay contract  2890ms
   ✓ accepted revision persistence proof > does not verify a matching projects row when the ordinary map read fails  2408ms
   ✓ accepted revision persistence proof > binds the receipt to the accepted merged project, not the unmerged live store  4383ms
   ✓ accepted revision persistence proof > keeps open event drafts local and out of accepted content identity  7666ms
   ✓ accepted revision persistence proof > rejects a copied token without issuing a read  2380ms
   ✓ accepted revision persistence proof > does not verify a failed read  1542ms
   ✓ accepted revision persistence proof > does not verify a missing read  2558ms
   ✓ accepted revision persistence proof > does not verify a disabled read  1766ms
   ✓ accepted revision persistence proof > does not verify a cancelled read  1095ms
   ✓ accepted revision persistence proof > rejects wrong target even when current_sha256 is unchanged  1935ms
   ✓ accepted revision persistence proof > rejects wrong content even when current_sha256 is unchanged  1966ms
   ✓ accepted revision persistence proof > keeps a failed proof retryable for the same accepted revision  1554ms
   ✓ accepted revision persistence proof > preserves newer local edits during the read and does not attach old proof to them  2055ms
   ✓ accepted revision persistence proof > pins the original target across a configuration change during read  1280ms
   ✓ accepted revision persistence proof > does not verify when cancelled while the read is in flight  1943ms
   ✓ accepted revision persistence proof > does not verify when disabled while the read is in flight  1693ms

 Test Files  3 passed (3)
      Tests  55 passed (55)
   Start at  22:31:34
   Duration  230.96s (transform 23.34s, setup 0ms, collect 22.65s, tests 351.79s, environment 1ms, prepare 619ms)
```

### Raw log SHA-256

```text
2fe8f12917b6f911d8a4070924ecbf7842904f8109327df03c9e80702ad1d22d  /tmp/st_01a076d2-original-profile.log
2d6937101c4e47c3a1b8e241c8436707d00ad0f12658aa8969665b812cff8984  /tmp/st_01a076d2-original-trace.log
e346296b27ac9d7ce8da9d7d10426a0463e9ee75d653c837adfb4d32e958dda6  /tmp/st_01a076d2-small-trace.log
807955fd4e21207c29d83effb31a62c2170977cfa3d6e7fc4dfd577c3f148373  /tmp/st_01a076d2-corrected-trace.log
75d4cb5a65555d37d5a427697c332db9df70a45858e994a3f658d28b8b676f9b  /tmp/st_01a076d2-uncorrelated-red.log
cfe7a025e01b10da726f19ae53a51441201c63a64544a7159ba288d6b66e52ca  /tmp/st_01a076d2-correlated-green.log
1d321aa400010cbe6eeca5b41eea04af35f2cd00f3fbbb984b3c3f2f631d27f9  /tmp/st_01a076d2-final-green.log
9e2e881b46f10347e10261b098fd6171273d8f45b9a5d52fc81a8473a713bdfe  /tmp/st_01a076d2-typecheck-app.log
a0b6c73b094db6b70a69fcc3a61cd3cbd97c572f73f649364b07945ff7786989  /tmp/st_01a076d2-deferred-red.log
1bfef96f06d58e849d74bba2f696d02839c2d80dc73a02a00042146edf11c9fd  /tmp/st_01a076d2-deferred-green.log
d362efdb0cd8755282756465d2c3068e313bab3d22019908560b0f019ba74e95  /tmp/st_01a076d2-final-reviewed-green.log
```

## Cleanup and assumptions

No server, live DB row or authored content was created. All test commands exited;
there is no owned background test process. Temporary instrumentation, injected
foreign writes and resolver mutation are absent from the final diff. Raw logs are
intentionally retained for the lead; they contain only fixture data. The existing
node_modules/env setup was used without edits. Only the two scoped files are
included in the increment; no nested agent, build, full gate, push or merge ran.

Assumption: this is a persistence proof contract, not a bundled-catalog scale or
cold-start performance benchmark. Therefore a single valid tile fixture and
normal isolated module setup are appropriate; real database/load repair stays in
the path. The historical exact overrun stage remains unobservable, and the evidence
is explicit about that limit rather than crediting a passing rerun as diagnosis.
