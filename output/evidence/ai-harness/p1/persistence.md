# P1 accepted-revision persistence API

## Outcome and boundary

Task `st_01a075ea`, 2026-09-06. Worktree
`/home/main/z-project/rpg-zzu-ai-harness-p1-20260906`, branch
`agent/ai-harness-p1-20260906`. Node v24.11.1 / npm 11.6.2, Linux x64.

Implemented an additive accepted-save receipt and a read-only persistence proof
API. Production changes are limited to `src/project/store.ts` and the existing
loader in `src/project/legacyDbProjectSync.ts`. No schema, wire serialization,
session, apply/undo, ask/plan/resume, advisory, or later-phase implementation.
The two existing asynchronous store-save tests now use explicit deferred save
signals instead of 50 ms sleeps. No failing test was removed or skipped.

**Scoped GREEN:** 16 new proof tests and 29 existing sync tests pass, exit 0.
Application typecheck and full build pass, exit 0. The actual API was also
executed independently through Vite SSR and a deterministic HTTP boundary,
exit 0. **The combined related suite is not wholly GREEN:** exactly six legacy
store-test failures reproduce on unchanged production source. They are retained
and detailed below, not counted as successes.

This is the persistence node, not completion of P1. `assistantSession.ts` is
unchanged and still needs the next node's integration and failing-first session
assertions. Browser/editor and isolated live-LegacyDb acceptance remain with the
phase surface owner. The baseline editor boot failure is not repaired here.
The separate docs node owns settled OpenWiki updates per the phase contract.

## Public API for the session owner

Source coordinates refer to the source included in this increment.

- `src/project/store.ts:111-124`: exported `ProjectPersistenceReceipt` and
  `ProjectPersistenceProof`.
- `store.flush(): Promise<ProjectFlushResult>` remains compatible; its `saved`
  variant optionally adds `receipt` (`store.ts:126-133, 870-891`). A real accepted
  save issues a receipt; a subsequent clean flush returns that same receipt
  without another save. A clean flush after initial load can still return
  `{kind:"saved"}` without a receipt. **That is not proof.**
- Receipt fields: `revisionId: string`, `projectId: string`,
  `mutationGeneration: number`, `contentIdentity: string`, optional
  `sha256: string`. All are readonly primitives and the object is runtime-frozen.
  `contentIdentity` is SHA-256 of the existing normalized comparison; `sha256`
  is merely the optional original save/wire hash and is not trusted as proof.
- `store.verifyPersistedRevision(receipt, { signal?: AbortSignal })` returns
  `Promise<ProjectPersistenceProof>` (`store.ts:841-868`). It accepts the exact
  store-issued receipt object, not a reconstructed/caller-authored token.
  Its private WeakMap retains the fixed target config without exposing keys.
  Receipts are in-memory authority, not a cross-reload/checkpoint protocol.
- Results are `{kind:"verified", receipt, isCurrent:boolean}`,
  `{kind:"mismatch", receipt, reason:"target"|"content"}`,
  `{kind:"disabled"|"cancelled", receipt}`, or
  `{kind:"failed", receipt, message:string}`. Missing rows, read errors and
  unknown receipts are failed. Missing/wrong returned row id is never matched.
- `store.isPersistenceReceiptCurrent(receipt): boolean` (`store.ts:830-838`)
  rechecks loaded/enabled state, latest receipt, captured generation and target
  config. Check this again if consuming a proof after another async operation.
  `verified` with `isCurrent:false` preserves historical accepted-version proof
  but **must not promote the current delivery to persisted-verified**.

Typical integration (keep the receipt reference):

```ts
const saved = await store.flush();
if (saved.kind !== "saved" || !saved.receipt) return; // No accepted proof available.
const proof = await store.verifyPersistedRevision(saved.receipt, { signal });
if (proof.kind === "verified" && proof.isCurrent
    && store.isPersistenceReceiptCurrent(proof.receipt)) {
  // This accepted revision can support the current delivery projection.
}
```

Use `receipt.revisionId` for succeeded-proof deduplication, not plan id. The store
performs a fresh read on every verification invocation and never consumes a
failed/disabled/cancelled attempt, so the same receipt can retry without saving
again. Do not use `getCurrent()` after an await to manufacture accepted identity.
Commit evidence remains separate: use the actual apply function's commit row,
not the latest remote commit listing; this API neither queries nor invents one.

### Implementation facts

`persistCurrent` (`store.ts:1176-1225`) fixes config and generation before submit,
keeps the existing `result.project ?? submittedProject` accepted baseline, and
captures its normalized comparison before the hash await. The accepted merge,
not the unmerged live store, supplies identity. If an intermediate accepted
project cannot normalize, saving retains its old semantics, logs the error and
returns no receipt rather than inventing proof. No new canonicalization exists:
`projectWithoutEventDrafts` and `serializeForComparison` remain the authorities.

`loadProjectForPersistenceProof(config, signal?)`
(`legacyDbProjectSync.ts:158-164`) reuses the existing normalized/hybrid loader
without commit-tip hydration. Its root GET selects the already-existing
`project_id` column (`:625-631`) and the parser carries the observed id (`:732-747`).
Root and map GETs both use the captured config and cancellation signal. No
live-store replacement, normalization writeback, dirty reset, URL change, or
project listener emission occurs in proof verification. Manual reload keeps
its existing separate contract; this change does not make it a safe proof API.

## Failing-first and validation receipts

All commands ran in the specified worktree. Output was redirected directly, not
through a pipeline; process exit codes were captured separately. Raw logs retain
terminal formatting and trailing newlines.

| Artifact stem | Exact command | Exit and observed result |
| --- | --- | --- |
| `persistence-red` | `npm test -- test/storePersistenceProof.test.ts` | 1; 12 failures, including one cold-import timeout |
| `persistence-red-bounded` | `npm test -- test/storePersistenceProof.test.ts` | 1; after giving the cold-import test a 60 s bound, 12 failures before any production edit |
| `persistence-green-initial` | `npm test -- test/storePersistenceProof.test.ts test/storePersistence.test.ts test/legacyDbProjectSync.test.ts` | 1; 9 failures / 43 passes; investigated, not accepted as GREEN |
| `persistence-legacy-baseline` | `npm test -- test/storePersistence.test.ts --testTimeout 60000` | 1; six failures / five passes on unchanged production source |
| `persistence-related` | `npm test -- test/storePersistenceProof.test.ts test/storePersistence.test.ts test/legacyDbProjectSync.test.ts --testTimeout 60000` | 1; six identical baseline failures / 50 passes; both edited save-race tests pass |
| `persistence-green` | `npm test -- test/storePersistenceProof.test.ts test/legacyDbProjectSync.test.ts --testTimeout 60000` | 0; 45 passes |
| `persistence-green-final` | `npm test -- test/storePersistenceProof.test.ts test/legacyDbProjectSync.test.ts` | 0; 45 passes; cold store/event-module imports have explicit per-test 60 s bounds |
| `persistence-typecheck` | `npm run typecheck:app` | 0 |
| `persistence-build` | `npm run build` | 0; app, player and standalone build chain completed |
| `persistence-surface` | `node output/evidence/ai-harness/p1/persistence-surface.mjs` | 0; actual API exercise and cleanup below |

Each stem above has `.log` and `.receipt`. The initial proof script runs also
exited 0 but exposed an unhandled audit-mirror boundary and then a pending audit
timer at cleanup; their raw outputs are preserved as
`persistence-surface-initial.log/.json` and
`persistence-surface-pending-mirror.log`. The final script uses the existing
isolated-test mirror opt-out and explicitly clears its fixture's activity timers.
There is no product error suppression or sleep-based synchronization.

**What RED establishes:** the bounded RED run reaches the proposed API with
real accepted saves and fails because `receipt` is absent and
`verifyPersistedRevision` does not exist. This includes failed/missing/disabled/
cancelled read, wrong target/content, same-revision retry, and local-edit/read
race test bodies. It does not claim that those bodies reached an old verifier
and observed a false success: the store had no verifier. The old session's
false-promotion behavior needs the session node's separate behavioral RED.

**New GREEN coverage:** `test/storePersistenceProof.test.ts:79-225` asserts frozen
receipt data, clean-flush reuse, JSONB key order, real map-patch accepted merge
versus unmerged live content, exclusion/preservation of open event drafts, copied
token rejection, all read-failure variants, target/content mismatch despite an
unchanged server hash, failed-then-successful retry with two reads and one save,
newer local edit preservation, fixed target during configuration change, and
mid-read disable/cancel. The store/sync/serialization are real; only fetch is a
deterministic transport. Save completion also awaits the real background commit's
transport event. Deferred read/save signals are armed before actions; test
runner bounds replace timing luck, and fake autosave timers are cleared.

The initial new assertion that the last network call must be GET was wrong:
a manual commit POST can finish after save. The fixture now awaits that exact
commit event before beginning proof, preserving the real integration rather than
mocking commit code away. Adding the hash await also exposed the legacy 50 ms
save assumptions; those two tests now await an explicit submitted-save signal
and release the network promise after injecting local paint.

### Six pre-existing related-test failures, not fixed or hidden

The unchanged-source probe temporarily applied the current HEAD versions of the
two production files, ran the legacy suite, and restored the implementation in a
`finally` block using `apply_patch`. The source matches the baseline
`048da7d5` blobs. No main-worktree edit or git reset was used.

1. Before-load no-fetch assertion sees one local `POST /__oprn/edit-activity`.
2. Dev-showcase autosave test has no injected dev-project factory and reaches its
   undefined fetch response (`reading 'ok'`).
3. Fresh-project test has the same missing factory/undefined-response failure.
4. Dev override save/reload test has the same failure.
5. Disabled-dev-status test reaches a real read with test credentials and returns
   `Invalid authentication credentials`; no successful remote write is evidenced.
6. Missing-project test expects one fetch but observes four from background work.

All six names/failure outputs are identical in `persistence-legacy-baseline.log`
and `persistence-related.log`. No pre-existing product/fixture repair was bundled
into this persistence increment. The full-related command remains exit 1.

LSP reported no diagnostics for both changed production files and both test
files, including the final test revision. One intermediate fresh-diagnostics
request timed out after 3000 ms; a subsequent final request returned no diagnostics. The standalone `.mjs` exercise has only TypeScript
hint 80006 (a function could be async), no reported error/warning.
Build warnings remain visible in `persistence-build.log`: optional proxy keys,
existing circular/mixed import chunk diagnostics, font runtime resolution and
chunk-size warnings. `npm run gates` and browser/live-remote gates were not run
by this node; the phase assigns them to the supervisor/surface owner.

## Independent actual-API surface proof

`persistence-surface.mjs` uses Vite SSR to import the actual shipped store/sync
modules and configures an in-memory loaded fixture. Only HTTP is replaced.
`envDir:false` avoids reading private checkout settings for this exercise. It is
not a browser, not a session mock, and not a live-LegacyDb claim.

Final `persistence-surface.json` records:

- project id `p1-surface-fixture` (deterministic transport only);
- revision id `c1d503a1-f442-49bc-86a9-3f34552d95cf`, generation 1;
- normalized accepted content identity
  `dac30007d07d7b580bff02002d857b7fbae02371d7ca9d2a5af8d28e514a2ee3`;
- separate wire hash
  `f7340bde371aaf12a5e246e7b152126b565c2c2cb2bd1836a9b1259abf741b3b`;
- matched -> verified/current; changed content -> mismatch/content; wrong row id
  -> mismatch/target; HTTP 503 -> failed; same receipt retry -> verified/current;
- a subscribed deferred read followed by local title edit yields historical
  verified proof with `isCurrent:false`, title `newer-surface-edit`, dirty=true,
  and exact live object identity preserved;
- exactly one project write, followed only by fixed-target proof reads; commit
  and child-table operations belong to the original save, not verification.

`pass:true` is set only after assertions of these machine values. Request traces
and typed outcomes are the artifact, not status prose.

## Cleanup and bounded DoneClaim

The final API exercise closes its middleware-only Vite instance, clears owned
autosave/retry and activity timers, settles deferred reads, and restores global
transport/window. It starts no listener/browser and creates no remote fixture.
No user project, private environment, shared-main source, schema, or existing
baseline evidence was changed by this node. Build outputs are local generated
artifacts, not committed authored data. Upstream baseline-document commit
`0a6f546d` was preserved. No merge, push, or other-phase implementation occurred.

`persistence-artifacts.sha256` inventories the original `dea2a917` evidence and
source/test hashes; the review follow-up has its own manifest below. Source/test diff whitespace validation passed.
`git diff --cached --check` returned 2 solely for raw command-output trailing
whitespace/final blank lines; `persistence-diff-check.log/.receipt` retains that
output. Raw logs are deliberately preserved byte-for-byte, not reformatted to
hide this warning. An unrelated unstaged `.omo/plans/ai-harness-omo-adoption.md`
change appeared during final staging and is not included or modified here.

**DoneClaim:** the scoped accepted-revision API, focused tests and deterministic
actual-API proof are delivered with failing-first and passing evidence. New
proof behavior and build/typecheck are GREEN; the full related suite has six
reproduced pre-existing failures. This closes only the persistence implementation
node and supplies the next session node's API contract, not P1 browser/remote
release approval.


## Read-only review follow-up

The review arrived after the original `dea2a917` increment was committed. This
follow-up changes only the focused persistence test and evidence, not production
code or the original RED artifacts. No P2/P4 work or history rewrite is included.

- The fixture already used `Project` for `current_json` and explicitly required
  `saved.kind === "saved"` and `saved.receipt`; the former broad `any` record and
  receipt cast were absent from the committed version.
- Replaced the remaining `resolve!` with `Promise.withResolvers<T>()`, removed
  the start-map non-null assertion with an explicit fixture guard, and removed
  the row cast. The typed submitted-row getter also requires a captured row.
  Receipt validation now occurs before waiting for the background commit signal,
  so a failed save cannot leave that fixture waiting for a nonexistent commit.
- A TypeScript AST scan found zero AnyKeyword, NonNullExpression or definite-
  assignment variable assertions in `test/storePersistenceProof.test.ts`.
- The clean-flush test now asserts reference identity with `toBe`: the receipt
  object itself, not merely equal fields, survives clean flush. Production
  `store.ts:879-885` returns `lastPersistenceReceipt` when generation and fixed
  target are still current. No network save or new revision id is minted. The
  private target WeakMap therefore remains usable by the returned receipt.
- Added direct parity with `loadProjectFromLegacyDb`: both loaders return the
  same normalized project including a nonempty `maps.map_json` overlay. A changed
  overlay must yield content mismatch even though `projects.current_json` still
  matches the accepted save. A separate maps GET 503 case must fail proof.
  `loadProjectForPersistenceProof` already calls the same
  `loadProjectSnapshotFromLegacyDb` with overlay enabled by default; no convenient
  projects-only loader or new normalization was introduced.

Validation (one related-suite run):

```sh
npm test -- test/storePersistenceProof.test.ts test/storePersistence.test.ts test/legacyDbProjectSync.test.ts --testTimeout 60000
npm run typecheck:app
```

`persistence-review-tests.log/.receipt`: exit 1, **52 passed / six failed**.
All **18 proof tests** and **29 sync tests** passed. The six legacy store failures
are the same test names already documented above; the background-fetch count in
the missing-project test was three in this run versus four in the original
baseline. It still fails the expected count of one. No failing test was skipped,
deleted or modified by this follow-up.

`persistence-review-typecheck.log/.receipt`: exit 0. Changed-test LSP diagnostics:
none. No new build/browser/live-remote run is claimed for this test-only change.
Original RED logs and receipts were compared byte-for-byte against `dea2a917` and
remain unchanged. `persistence-review-artifacts.sha256` records the `3eccfb89`
test, report and follow-up logs separately from the original historical manifest.


## Lead confirmation: exact save gates, unchanged assertions

Confirmed the current committed API/tests on `3eccfb89` without further source,
test, demo, or timeout changes. No P2/P4 implementation was added.

The original failure remains in `persistence-green-initial.log:49-54`: both
sleep-based save-race tests timed out at 15000 ms after the persistence receipt
introduced another asynchronous boundary. Their replacement uses a submitted
promise armed before flush, awaits that exact save submission, makes the second
local edit, then resolves the release-save promise. It neither advances fake
time nor polls for completion.

The default-deadline confirmation in `persistence-gates-related.log` shows:

| Existing test | Original failure | Exact-gate result |
| --- | --- | --- |
| `keeps local map paint when remote save finishes with a stale snapshot` | timeout at 15006 ms | PASS, 5996 ms |
| `does not apply stale map-patch response over newer local paint` | timeout at 15009 ms | PASS, 3737 ms |

A TypeScript AST comparison against `048da7d5:test/storePersistence.test.ts`
confirmed all six assertions in the first case and all five in the second are
unchanged. These still require the newer tile, expected save/catch-up call counts
and payload, successful result, and clean dirty-state bookkeeping. Neither test
has a raised test timeout. The new proof suite's two previously documented cold
store/event import bounds were not changed by this confirmation; read races are
still driven by subscribed promises, not those deadlines.

Exact commands, each run once for this confirmation:

```sh
npm test -- test/storePersistenceProof.test.ts test/storePersistence.test.ts test/legacyDbProjectSync.test.ts --maxWorkers 1
npm test -- test/storePersistenceProof.test.ts test/legacyDbProjectSync.test.ts --maxWorkers 1
npm run typecheck:app
```

- `persistence-gates-related.log/.receipt`: exit 1; 52 passed / six failed. All
  18 proof tests, 29 sync tests and both exact-gate save-race tests passed. The
  unchanged before-load test hit its 15 s cold-import bound in this run; the
  other five failures remain the dev-fixture/extra-fetch failures already
  captured against clean production source. No tests were filtered or skipped.
- `persistence-gates-focused.log/.receipt`: exit 0, **47 passed**, covering the
  complete proof and sync suites on the final test revision.
- `persistence-gates-typecheck.log/.receipt`: exit 0.

The unchanged-source dev-project evidence remains
`persistence-legacy-baseline.log/.receipt`; no demo, dev-project factory or
product repair was included. New proof, mismatch, overlay and read-race
assertions remain strict. The original RED files and source/test files are
unchanged by this evidence-only confirmation. No browser, listener or remote
fixture was created. `persistence-gates-artifacts.sha256` records this report,
new command artifacts and unchanged current source/test hashes.

**Final persistence DoneClaim:** scoped API/test implementation remains committed;
current focused validation and typecheck pass. The exact save-gate repair is
proven without widening those test deadlines, and unrelated clean-baseline
failures remain disclosed. Session integration and P1 browser/live-remote release
acceptance are outside this node's completion claim.
