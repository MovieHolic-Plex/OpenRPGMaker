# Frozen B1 core correction

## Outcome and scope

Applied and frozen in `/home/main/z-project/rpg-zzu-unbounded-integrate-01a07570`
on base `8320f9da5dbe3e5d0e52864c4d763cae753c9632`.

The only production change is the existing-owner guard at
`src/ai/assistantSession.ts:1354`:

```ts
if (this.verificationEvidence.hasChecks() && previous !== project && acceptanceFingerprint(previous) !== acceptanceFingerprint(project)) {
  this.verificationEvidence.invalidateAfterWrite();
}
```

An owner with no observed checks has no verdict to invalidate. The guard skips
only the two whole-project comparisons in that case. Applied snapshot capture,
canonical evaluation/publication, image retirement and pending-apply settlement
are unchanged. Missing verifier obligations still fail. No cache, new evidence
API, identity-only assumption, getter optimization or source-contract change.

Other edits: deterministic coverage in `test/assistantAcceptanceCost.test.ts`
and five relevant lines in `openwiki/editor-ai-panel.md`. No adjacent regression
file was needed. All edits used `/tmp/apply_patch` (the available apply_patch
executable). The initial wiki context mismatch and exact exit are recorded in
`02-lsp.txt`; it did not alter the production patch beyond this one line.

Model: `PI_MODEL=gpt-6-astra`, `PI_PROVIDER=opencodex`, reasoning `high`.

## Measured RED to GREEN

Tests use call-through spies and project-shaped arguments, including private
cloned project inputs. No elapsed-time assertion or caller-reference-only count.

| Scenario | RED fingerprints | GREEN fingerprints | Retained behavior |
| --- | ---: | ---: | --- |
| Three unchanged refreshes of a real prepared title-source ledger, no checks | 6 | 0 | 3 applied clones, 3 canonical evaluations, 3 acceptance events; exact required source/bindings retained |
| Missing `run_lint` obligation without an observed verdict | 2 | 0 | Required row remains blocked with failed evidence |
| Real applied title checkpoint with panel-equivalent synchronous store subscriber | 8 | 0 | 4 refreshes, 7 canonical evaluations, 1 actual title apply, 1 native commit call |
| Existing real verifier: equal replacement, changed replacement, undo | 6 | 6 | Equal content preserves proof; change retires it; undo cannot revive it |
| Existing real verifier: equal replacement, in-place change, undo | 6 | 6 | Same exact freshness behavior despite retaining the supplied object identity |

RED: complete cost file ran once before the product change. Exit **1**,
**3 intended failures / 8 passes**. Failures were exactly expected 0 versus
actual **6**, **2**, **8** project fingerprints. Other assertions, including
existing-check positive controls, passed. Full output and exit are preserved in
`01-cost-red.log` and `01-cost-red.exit`.

GREEN: one invocation ran **22 complete files / 792 tests**, all passed, exit
**0**. It included the complete cost file (**11 tests**) and the affected
source/canonical/verifier/receipt suites. No retries, test filtering by title,
skipped failures or test-bound increases. See `03-green-freshness.log` and `.exit`.
Its machine-readable console records include:

```json
{"case":"prepared-source-refresh","refreshes":3,"projectFingerprints":0,"projectClones":3,"evaluations":3}
{"case":"applied-checkpoint","refreshes":4,"projectFingerprints":0,"evaluations":7,"applies":1,"commits":1}
```

## Real checkpoint seam and retained freshness

The new cost fixtures use the full, unshrunk `createBlankProject()` and nonempty
anchored title requests. The integrated checkpoint uses the real session,
planner parser, canonical ledger, title tool, native apply/store/undo/commit path,
and a `store.subscribe -> session.refreshAcceptance` callback equivalent to the
panel's acceptance subscriber. Only provider/HTTP transports are scripted.

It retains the 64-item plan and exact `Final 64` source requirement. The
measurement window begins at writer 1's transport entry, after preparation, and
ends at pre-subscribed writer 2 entry after apply/rebase/checkpoint/continuation.
It observes actual pending-draft `verifying` and applied-but-not-final `working`
snapshots. Every measured canonical snapshot retains the required source row,
source span, provenance and real failed target evidence; extracted criteria and
numeric/value bindings are checked through the public harness snapshot.

The second writer is held by a deferred promise. The test aborts and releases it
in `finally`, awaits the real owner and native commit completions with bounded
failure deadlines, and unsubscribes. Exactly the first title is applied; no late
write follows abort. No polling/sleeps or fake-clock advancement drive progress.
Fake timers only isolate unrelated autosave. This one-checkpoint unit seam does
not replace or reduce the 64-checkpoint browser harness.

Freshness retained and executed in the same GREEN invocation:

- Cost suite: no-authority cheap path; same-reference/same-content/changed-content
  canonical pair counts; late adoption after a real check (equal versus changed);
  missing verifier obligation; actual-check replacement/in-place/undo controls.
- `assistantAcceptanceSourceIntegration`: exact source-bound pass, wrong native
  args, advisory-only, stale and draft cases; source plus planner promises share
  one full-project pair comparison. Source/withdrawal/amendment/volume semantics
  and canonical required denominator remain real.
- `assistantAcceptanceSession`, acceptance baseline/selectors, action acceptance
  proof/requirements, and verification continuation/evidence suites: pending
  versus applied state, image/action receipt retirement and current exact proof.
- `aiRunEndProof` and `storePersistenceProof`: actual store-issued receipt identity,
  mutation/lineage/config currentness, stale proof responses and subscriber races.
  The M1 unrelated external edit test retires an exact verifier despite passing
  source predicates; the domain-reopen test retains source predicates but refuses
  completion. Existing proof fixtures were not modified or shrunk by this task.
- `aiRunOutcome*`: actual apply/publication ownership and getter projection after
  real later edits without mutating historical returned results.

## Commands and exact exits

All shell invocations below ran in the integration worktree. Full command lines
for the RED/GREEN test invocations are in their log headers. Each complete file
was selected explicitly; both used `--maxWorkers=1 --minWorkers=1 --reporter=verbose
--silent=false` to retain output and avoid concurrent full-project pressure.

| Validation | Exit | Evidence |
| --- | ---: | --- |
| `npm test -- test/assistantAcceptanceCost.test.ts ...` before guard | 1 (expected RED) | `01-cost-red.log`, `.exit` |
| `npm test --` affected 22 complete files after guard | 0 | `03-green-freshness.log`, `.exit` |
| Changed TypeScript LSP, severity all, before typecheck/build | no diagnostics | `02-lsp.txt` (tool has no shell exit) |
| `npm run typecheck:app` | 0 | `04-typecheck-app.log`, `.exit` |
| `npm run build:app` | 0 | `05-build-app.log`, `.exit` |
| `git diff --check` for the three changed files | 0 | `06-diff-check.log`, `.exit` |
| SHA-256 verification of all 12 protected files | 0 | `06-protected-check.log`, `.exit` |

Markdown has no configured LSP server; its small addition was read back and diff
checked. Build output retains non-failing missing optional proxy-key messages,
the record-picker circular chunk warning, mixed static/dynamic import warnings
and oversized-chunk warning. The successful unit log retains Happy DOM's
`player.js` module-loading-disabled stderr from action proof tests. None was
suppressed or changed. No baseline build was run to newly classify those warnings.

## Frozen artifacts and protected UI delta

- `frozen-production.patch`: only the one-line session guard.
- `frozen-core.patch`: that guard, cost regressions and small wiki addition.
- `06-frozen-source-sha256.txt`: hashes of the exact tested source/test/wiki.
- `00-protected-files.txt`, `00-protected-sha256.txt` and
  `00-protected-tracked.patch`: original 12-file delta and its tracked patch.
- `00-input-sha256.txt`: original core/test/wiki and profile inputs.
- `06-frozen-status.txt`: final worktree status; no commit/branch operation.

Frozen SHA-256:

| File | SHA-256 |
| --- | --- |
| `src/ai/assistantSession.ts` | `a3cd1cc295a52a8cf37c86362161667a497a4b9956c52a31b702a787a40a0158` |
| `test/assistantAcceptanceCost.test.ts` | `89e56869b216ab8a88e12ed6eac7a3545021929274cef8a60244adcf2df8d015` |
| `openwiki/editor-ai-panel.md` | `e41cb2d99c4c6a24e6701b414c71db540e31757e4212d266a18d820e291dbb7f` |
| `frozen-production.patch` | `cc53fc690575e178104c1ea82b5979656631b72e4dfbb6961f00d1f93c16fcf4` |
| `frozen-core.patch` | `1ddbbfb10b7348973d479705c89796de9d7ea6860bca88276d063ad56357b646` |

All 12 protected files, including the untracked retirement test/E2E harness,
`requiredOutcomeFixture`, UI product files and editor-observability wiki, remain
byte-for-byte equal to the captured originals. The pre-existing profile/diagnosis
evidence was not overwritten. No new product edit occurred after GREEN.

## Boundary of this result

GROK's frozen prefix profile attributed 11141 ms inclusive to `refreshAcceptance`
and 4791 ms fingerprint self-time below it. This patch removes the measured
no-evidence comparison calls, not the remaining clone/lint/render work. It does
not optimize outcome getters or predict a wall-clock speedup from Node timings.

**No browser success is claimed.** No browser, full2537, full gate or full11 run
was performed. Port 19844 was unbound at handoff. Root/GROK owns the unchanged
64-checkpoint B1 run and its original 240000 ms terminal bound. The patch is
already applied in the integration worktree; frozen patches are archival/handoff
artifacts, not instructions to apply it twice. No commit, push, merge, rebase or
unlock was performed. Further optimization requires separate measured ownership.
