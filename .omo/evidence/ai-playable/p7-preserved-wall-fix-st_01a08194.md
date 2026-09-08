# P7 preserved-wall completeness fix - st_01a08194

- Parent/root session: `01a07680-34ac-7f79-8729-1c06bf78b736`.
- Exact base: `abd90de3597d95115ef51ff8f18825b2af7d34f0`.
- Isolated worktree: `/home/main/z-project/rpg-zzu-p7-preserved-wall-st01a08194`.
- Branch: `fix/p7-preserved-wall-st01a08194`.
- Original parent evidence and P7 game content were read only. This is a new code
  verification receipt, not a replacement for any original scene or scope evidence.

## Scope

`proposalCompleteness` now checks already-satisfied explicit-cell terrain maintenance
separately from meaningful changed regions. It requires the host's current native
tool-applied project, a zero-diff paint operation, successful/non-skipped native
receipt, exact requested cells, native effective layer, matching current tile content,
and complete coverage of an explicitly layered rectangular terrain asset. Partial or
invalidated maintenance cannot borrow another changed rectangle. Cells-mode changed
coverage also uses explicit cells rather than optional from/to bounding boxes.

Session automatic completeness/review and terminal UI use the same current project
facts. No public helper/framework, native painter, BuildSpec schema, prose authority,
construction count, quantity rule, canonical acceptance, recipe-repair or game content
was changed. Other asset kinds and paint modes retain their existing behavior.
Already-satisfied coverage does not turn no-op-only change requests into new changes.
The original P7 blocked outcome and canonical scene failures remain unmodified.

## Red first

Run before source edits:

```sh
npm test -- test/proposalCompleteness.test.ts -t 'covers P7' --maxWorkers=2
```

Exit 1, one selected test failed at the expected empty-warning assertion. Native
results had already passed assertions for floor `tilesChanged:80, tilesTouched:80`
and walls `tilesChanged:0, tilesTouched:24, skippedClusterCells:0`. Received warning:

```text
⚠ 미이행: 밑그림 에셋 'basement_wall_top_306'(terrain) (0,0) 12×1, 'basement_wall_bottom_306'(terrain) (0,9) 12×1 영역을 변경하지 않았습니다.
```

Raw log: `/tmp/st_01a08194/red.log`.

## Green focused verification

Final complete focused run, exit 0, **94 passed / 0 failed / 0 skipped**:

```sh
npm test -- test/proposalCompleteness.test.ts test/aiCompletionAccounting.test.ts test/aiTurnAppliedAccounting.test.ts --maxWorkers=2
npm run typecheck:app
git diff --check
```

The first command exercises native paint, real session automatic completion,
actual milestone application/rebase and terminal runner warning attachment/display.
Only model transport, persistence transport and the existing fake-DOM surface are
fixtures. Native mutation and accounting are not mocked. The UI application fixture
writes the actual session draft into the local test store. No timing sleeps/polling
or existing test/rejection assertion removal was introduced.

Countercases cover missing/failed/skipped/short operation receipts, wrong tile/map,
effective versus requested layer, partial/duplicate cells, out-of-bounds native skips,
invalid native arguments, sparse bbox interiors for both changed and unchanged calls,
unrelated no-ops, non-terrain obligations, later native invalidation, and genuine new
quantity/change expectations. Automatic milestone tests prove `preserve` verifies but
`targetChange` on the same unchanged walls stays blocked/incomplete after application.
An intermediate new test used the nonexistent goal literal `complete`; inspection of
`runOutcome.ts` corrected it to the actual success state `satisfied` before the final run.

Logs: `/tmp/st_01a08194/focused-final.log`, `/tmp/st_01a08194/typecheck.log`.

## Extended related run and base comparison

```sh
npm test -- test/proposalCompleteness.test.ts test/aiCompletionAccounting.test.ts test/aiTurnAppliedAccounting.test.ts test/agentBlueprintTurnEnd.test.ts test/assistantMultiMapSpec.test.ts test/assistantSpatialObligations.test.ts test/assistantAcceptance.test.ts test/canonicalAcceptanceOwnership.test.ts test/assistantVerificationEvidence.test.ts --maxWorkers=2
```

Exit 1: **192 passed, 12 failed, 12 unhandled rejections**. All 12 failures are the
existing `agentBlueprintTurnEnd` fake-DOM cases: `list.insertBefore is not a function`
at `aiStickyChecklist.ts:174`, followed by `Terminal AI activity log was not saved
within 10s`. All eight other files passed, including canonical acceptance ownership
and verification-evidence rejection assertions. No failing test was edited or skipped.

An untouched full `git archive` of the exact base was extracted under
`/tmp/st_01a08194/base`, with only a local node_modules symlink, and this was run there:

```sh
npm test -- test/agentBlueprintTurnEnd.test.ts --maxWorkers=2
```

Exit 1: **2 passed, the same 12 failed and 12 unhandled rejections**. A machine
comparison confirms all 12 failing test identities and all 12 insertBefore errors
match. Logs: `/tmp/st_01a08194/focused-green.log` (the extended run, despite its initial
filename), `baseline-blueprint.log`, and `baseline-comparison.txt` in that directory.

## Diagnostics

Shared LSP calls initially returned no diagnostics; refreshed requests later timed
out on two files. A dedicated local TypeScript server completed syntax, semantic and
suggestion diagnostics for all seven changed TS files, with no missing completion
signals. It found **zero new diagnostics**. The three existing errors in
`test/aiTurnAppliedAccounting.test.ts` are missing `destructive` in two legacy fixture
records and missing `commitId` in a legacy milestone event (TS2741/2322/2345).
The same server against the untouched base reports identical error codes/messages.
They were not suppressed or repaired outside this task. App typecheck exits 0.
Markdown has no configured LSP; whitespace is checked with `git diff --check`.

Reproducible local diagnostic driver/logs:

```sh
node /tmp/st_01a08194/tsserver-check.cjs
node /tmp/st_01a08194/tsserver-check.cjs /tmp/st_01a08194/base test/aiTurnAppliedAccounting.test.ts
```

Both diagnostic commands exit 1 for the three known fixture errors. Logs are
`tsserver.log`, `baseline-tsserver.log`, and `diagnostic-comparison.txt` under
`/tmp/st_01a08194`.

## Deliberate verification boundary

No full gates, build, browser, live provider, current DB, live game repaint, historical
evidence rewrite, parent source edit or additional agent was used. This fixture proof
is not a new P7 scene acceptance result. Parent owns integration and real-surface checks.
