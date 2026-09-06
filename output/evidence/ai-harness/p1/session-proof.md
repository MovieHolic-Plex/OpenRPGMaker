# P1 session accepted-revision proof

## Delivered scope

Task `st_01a07616`, 2026-09-06, branch `agent/ai-harness-p1-20260906` in
`/home/main/z-project/rpg-zzu-ai-harness-p1-20260906`. Integration starts from
`3cfef1cc`; persistence API/evidence from `dea2a917`, `3eccfb89`, `3cfef1cc` was
read before implementation. Git history was inspected before scoped staging.

The session no longer uses `reloadFromRemote()` or a newest-commit query to
prove completion. It uses the actual `flush().receipt` followed by
`verifyPersistedRevision(receipt, { signal })`. A successful proof is reusable
only while `isPersistenceReceiptCurrent(receipt)` remains true. Failed,
cancelled, disabled, missing-receipt, target/content-mismatch and stale results
cannot emit the machine-consumed `agent_run_saved` audit sentinel.

Production ownership is four existing files:

- `src/ai/assistantSession.ts`: completion and retry integration, proof state,
  optional apply metadata, and current evidence in the existing harness snapshot.
- `src/editor/tools/applyChangesetToStore.ts`: optional `commitProject` captures
  the actual store object immediately after apply, before awaiting the commit.
  Existing `applied` return semantics are unchanged.
- `src/editor/panels/aiProposalCard.ts`: passes the real successful apply result
  to the session; no apply/approval/undo policy change.
- `src/editor/panels/aiTurnRunner.ts`: after an ordinary proposal is actually
  applied, awaits the reusable proof path with the active cancellation signal.
  Apply accounting remains independent of persistence success.

No project-store persistence implementation, schema, config, user project,
shared main worktree, checkpoint, requirements ledger, full RunOutcome module,
UI retry control or other phase was changed. `canRetryLastTurn()` retains its
existing LLM-error meaning. Explicit `retryLastTurn()` can retry a failed proof
without LLM/tool replay; a recovered LLM retry also reaches completion proof.
Ask/plan-only retries do not start proof. The separate docs node owns the
settled OpenWiki update; specifically the obsolete run-end paragraph at
`openwiki/editor-ai-panel.md:467` must describe this API instead of reload.

## Consumable contract

`RunEndProofState` exposes `status: attempted | failed | succeeded`, `verified`,
optional `receipt`, `proof`, `reason`, and optional correlated `commitId`.
`getRunEndProof()` and `getHarnessSnapshot().runEndProof` recheck currentness
at consumption. `SessionEvent` adds `persistence_proof` with that state.
This is persistence evidence for the accepted/current store, **not** a claim
that the user's whole goal or an unapplied draft is complete.

A historical succeeded state can have `verified:false` after a newer edit.
If the edit occurred during the proof read, state is failed/stale while the
embedded store proof preserves `kind:verified, isCurrent:false`. No editor
reload, replacement, undo or rollback is performed by proof.

`proveAppliedRevision(onEvent?, signal?)` is the reusable public boundary.
Autonomous completion uses it only for a completed plan with no pending draft
writes and no apply failure/abort/error. Ordinary proposals use it after the
existing apply adapter. A successful current receipt avoids a second read;
failed receipts are not consumed. A changed accepted revision gets new proof.
Commit ids come only from the actual apply result, and only when its captured
store object still matches at flush consumption. Human edits during a commit
await cannot borrow that commit. Commit-log `persisted:false` is not a project
save failure; the project can still be persisted and verified without commit
metadata. No newest commit row is read by proof.

## Failing-first evidence

All commands below ran in the assigned worktree. Raw stdout/stderr is redirected
directly to `.log`; `.receipt` records the command and actual exit (or explicitly
unavailable exit when the tool killed the command at its deadline).

1. `session-red.log/.receipt`: `npm test -- test/aiRunEndProof.test.ts`, exit 1.
   Before any production edit, the real AssistantSession planner/tool/milestone/
   store path applied `set_title_screen`, completed its WorkPlan, and received
   HTTP 503 on its one projects proof read. The failing assertion expected zero
   `agent_run_saved` audits and observed **one**. This is the old false promotion,
   not a missing proposed API or an assertion about translated status prose.
2. `session-retry-red.log/.receipt`:
   `npm test -- test/aiRunEndProof.test.ts -t retryLastTurn`, exit 1, two failures.
   Before changing retry, failed proof remained failed and recovered LLM retry
   left proof null. The other 12 cases were unselected by the focused test-name
   filter; no source test was skipped/deleted to get GREEN.

The first shell could not find `apply_patch`; `/tmp/apply_patch` is the installed
wrapper around `patch -p1 --forward`, and all actual edits used it. An initial
malformed add-file hunk made no file. The no-test-file invocation is retained as
`session-setup-failure.log/.receipt`, exit 1, and is **not** counted as RED.

## GREEN and exact commands

| Artifact stem | Command | Result |
| --- | --- | --- |
| `session-green-final` | `npm test -- test/aiRunEndProof.test.ts test/aiAssistantSession.test.ts test/aiMilestoneTurnAccounting.test.ts test/aiAssistantTurnCleanup.test.ts` | exit 0; 85 tests / four files |
| `session-contracts` | `npm test -- test/aiComposerModeSession.test.ts test/assistantVerificationEvidence.test.ts test/applyProposedProjectHouseProtection.test.ts` | exit 0; 47 tests / three files |
| `session-typecheck-final` | `npm run typecheck:app` | exit 0 |
| `session-build` | `npm run build` | exit 0; app, player, standalone chain |
| `session-surface` | `node output/evidence/ai-harness/p1/session-surface.mjs` | exit 0; assertions and cleanup below |

The final focused proof suite has 14 tests. Besides the RED regressions, it
checks two reads/one save for same-revision retry, success deduplication, new
revision identity, failed/cancelled/disabled/mismatched reads, editor-object and
human-edit preservation, actual apply commit association, separate commit-log
failure, no-plan apply, and concurrent human edits during the commit await.
The existing session proof test now asserts the receipt/verifier contract
instead of requiring the unsafe reload. The existing turn-cleanup test checks
that only an applied proposal invokes proof, with the active AbortSignal.
The additional 47 tests preserve ask/plan/resume, explicit/advisory verification
and protected-house apply contracts. Existing undo/milestone accounting tests
are included in the four-file run.

Final LSP diagnostics returned **no diagnostics** for all four production files,
all three changed tests, and the standalone evidence script. `git diff --check`
passed for source/test changes. Build warnings are retained, including existing
circular/mixed imports, missing optional proxy keys, asset runtime resolution,
and chunk size notices. No warning or test was suppressed.
`git diff --cached --check` returns 2 only for raw log trailing whitespace and
final blank lines; `session-diff-check.json` retains the exact output. The raw
logs are preserved byte-for-byte, not reformatted to hide those diagnostics.

### Earlier validation failures retained, not called GREEN

`session-green-initial` was terminated by the tool's 240-second deadline; no
process exit was available. Its partial output has 14 cleanup and three
milestone tests passing, and four new-suite failures: cold import timeout,
`TOOL_BY_NAME` initialization after resetting modules while a timed-out import
was still active, and two read tests exceeding their timeout. The fixture was
changed to one module graph plus explicit blank-store/baseline/history reset,
removing that import race rather than retrying it or adding sleeps. The initial
83-test GREEN is retained in `session-green`; the final 85-test run additionally
includes the two retry regressions. Both passed in single invocations.

The first build was likewise terminated at the 240-second tool deadline and is
retained as `session-build-initial`; it is not a build pass. The final build was
allowed a sufficient command bound and exited 0. Other worktrees' concurrent
Vitest processes were observed, but no external process was killed or changed.
No baseline failure remains in this node's requested/focused commands. The
persistence node's separately documented six legacy store-test failures are not
reclassified or repaired here. Supervisor `npm run gates`, real editor browser
acceptance and live Supabase proof remain outside this node's claimed results.

## Actual entry-point exercise, not live remote acceptance

`session-surface.mjs` loads the shipped AssistantSession and its real tools,
apply adapter, undo/store and sync code through Vite SSR. Only LLM responses,
intent declaration and HTTP transport are deterministic. `envDir:false` and a
fixed invalid HTTP host keep private/live project settings out of the exercise.
It starts no listener or browser. It is independent execution of the public
entry points, not an invocation of a private proof method or a mocked verifier.

`session-surface.json` records the exact machine evidence:

- Fixture target: `p1-session-surface-fixture` (not a live Supabase row).
- Initial accepted revision `68fecd74-2aa7-4265-af7b-cea32f2ab1d5`, generation 1,
  normalized identity
  `6a86e350348de1933b6596357cf607a59d7f5f072b4904380e577616979c3951`.
- Completion GET 503: failed, verified false, one applied title tool, zero saved
  audits. Actual apply commit metadata:
  `b7094c2b-a357-4087-80a1-c5a123c169d8`.
- Explicit `retryLastTurn`: same receipt reference/revision succeeds; zero extra
  LLM calls. A further proof call adds zero HTTP requests.
- New accepted revision `641f1e4d-c2b4-4555-961c-9126d37f0c7d`, generation 2:
  a subscribed deferred proof read receives a newer human edit before release.
  Result is failed/stale, embedded historical proof verified/isCurrent=false;
  title `newer-human-edit`, dirty true, exact live store object preserved.
- No newest-commit GET; exactly one successful `agent_run_saved` audit across
  these scenarios. The JSON includes state events, full receipts and HTTP trace.

The browser/remote surface node must reuse this integration, not infer live
success from these deterministic transports. Its existing phase responsibilities
include the QA-only boot repair and independently owned remote harness.

## Cleanup and bounded DoneClaim

The execution closed its middleware Vite server, restored fetch/window, settled
the deferred read and cleared fixture autosave/retry and activity timers.
There was no listener/browser to release and no remote fixture to delete.
Tests restore globals/env/spies and clear fake timers without advancing them;
async tests arm exact deferred signals before actions and await bounded test
completion, never fixed sleeps/polling. A process scan after execution found no
owned Vitest/build/session-surface command left in this worktree. Local build
outputs remain generated ignored artifacts, not authored user data.

The lead-owned dirty `.omo/plans/ai-harness-omo-adoption.md` is preserved and
excluded from this commit. Evidence is force-added by exact session-prefixed
paths because `output/` is ignored. Source/test staging is explicit. No merge,
push, main edit, additional agent or other phase implementation occurred.

**DoneClaim:** P1 session completion, retry and ordinary-apply receipt integration
is delivered with failing-first regression evidence, 132 passing related tests,
application typecheck, full build and deterministic actual-entry-point proof.
This closes the session implementation node only; it does not claim P1 browser,
live-remote, supervisor gate, review or release approval.
