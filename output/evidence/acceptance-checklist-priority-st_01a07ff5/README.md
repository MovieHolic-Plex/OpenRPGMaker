# Checklist priority fixture integration

Task: `st_01a07ff5`; branch: `fix/acceptance-gate-regressions`.
Parent: `dd9346e5fa595b814624efd61720e3d2ff40843d` (completed two-parent merge).

The prior red is preserved verbatim at
`../acceptance-merge-resolution-st_01a07ff5/focused.log` and `focused.exit`:
108 passed / 1 failed, exit 1, at fakeDomSelectContracts.test.ts:248.
Incoming checklist sorting prioritizes working/blocked before verifying/pending;
reversing mixed-priority input must not override that product behavior.

Only test/fakeDomSelectContracts.test.ts changes (15 added lines, 1 removed):
- Confirm initial keyed IDs and prove reversed mixed-priority input retains the
  same row objects in priority order, with exactly two rendered rows.
- Swap working/pending statuses in original input order to actually reverse the
  rendered rows. Retain the reverse-order assertion and add strict object-identity
  assertions proving the original keyed rows moved rather than being recreated.
- Preserve existing removal, clearing, parent detachment, root/body cleanup, and
  finally-dispose assertions. No production sorting, fake-DOM helper, other test,
  snapshot, deadline, or asynchronous behavior changes.

## Checks

Working directory: `/home/main/z-project/rpg-zzu-ai-acceptance-live-qa`.

`npm test -- test/aiChatObservability.test.ts test/requestCoverage.test.ts test/fakeDomSelectContracts.test.ts test/eventEditorStagedState.test.ts test/independentReview.test.ts test/assistantIndependentReview.test.ts test/assistantReviewApprovalLifecycle.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism`

One execution, direct exit **0**, **7 files / 109 tests passed** (`focused.log`,
`focused.exit`): observability 9, coverage 14, fake-DOM contracts 11, staged state
14, independent review 23, session review 29, review approval lifecycle 9.

`npm run typecheck:app`: direct exit **0** (`typecheck-app.log`, `typecheck-app.exit`).
LSP diagnostics on changed test: none. `git diff --check` on test change: exit 0.
The real checklist surface is exercised synchronously by the existing fixture.
No full suite, build, remote provider/DB calls, push, PR, or further merge.

All earlier evidence remains unchanged, including the 108/1 red and original
raw gate/recovery evidence. Upstream automatic evidence deletions remain as in
the parent; archive tracing belongs to the lead. New logs are stored only here.
Edits use the existing session's apply_patch shell wrapper around git apply;
no repository helper or configuration is added.
