# P1 / current-main merge integration

Date: 2026-09-06. Task: st_01a07677.
Worktree: `/home/main/z-project/rpg-zzu-ai-harness-p1-20260906`.
Branch: `agent/ai-harness-p1-20260906`.

## Scope and resolution

- First parent: `b1d3d5750e62eca05c7bd65c21456a7f3f8a9913`.
- Incoming main: `5384e607b6d4495b6c1fde998fe49901550653af`.
- Resolved `.omo/plans/ai-harness-omo-adoption.md` and
  `src/ai/assistantSession.ts`; no other product/test edits were made.
- The plan is byte-identical to the first parent: checked baseline 1 and
  user-authorized operational gates 11-15 remain. Incoming shared content remains;
  only superseded proposal-only status and single-worktree instructions lose to
  the later explicit execution authorization. No future checkbox was checked.
- `maybeRunEndProof` retains main's `acceptanceOpen()` scheduling guard alongside
  P1's pending-write, failed-apply and abort guards. It delegates to the P1
  accepted-revision verifier, not the obsolete plan-keyed flush/reload proof.
- Main's session-owned acceptance ledger, repair/review tools, image receipts,
  bounded completion checks and sticky-note projection remain. No duplicate
  requirements/outcome ledger or P2 implementation was introduced.
- Traced autonomous completion and retry through `maybeRunEndProof`, milestone
  apply through `recordAppliedProject` and acceptance rebase, and ordinary apply
  through `aiProposalCard` into the auto-merged `aiTurnRunner` proof call.
- The auto-merged runner retains live acceptance forwarding and terminal snapshot
  refresh under owner guards, plus P1 post-apply proof and ownership recheck.
  Cleanup tests retain upstream `showAcceptance` and P1 proof-call assertions.
- Git object comparisons verified the acceptance modules, sticky component,
  acceptance/sticky tests and handoff/accounting tests are byte-identical to
  incoming main. P1 proof test files are byte-identical to the first parent.
- All other already-staged upstream files were left untouched. No source behavior
  fix beyond conflict composition was needed; no tests were weakened or rewritten.

## Verification on the resolved combined source tree

Source tree before adding this integration evidence:
`8e4b1ccceb08864ae6d0578e3e3f4e1bb4c9c049`.

SHA-256:
- `src/ai/assistantSession.ts`:
  `a21272260bc69436d5191fa671e6d9cde3a9b3ac7b536ed32aa6fa4e93ebc870`
- `src/editor/panels/aiTurnRunner.ts`:
  `0bd8f98818832d7a65d2bcf756d6eb2a66328c4e7ffc575c15dcc13b15faab5b`

Both test invocations used `VITEST_MAX_THREADS=4 VITEST_MIN_THREADS=1
VITEST_MAX_FORKS=4 VITEST_MIN_FORKS=1` to bound shared-host concurrency.
Each command ran once; no retries, timeout changes or selection exclusions.
Logs preserve command output with only trailing whitespace and blank EOF lines
trimmed after Git whitespace checks flagged those generated characters.

| Command | Result | Command evidence |
| --- | --- | --- |
| `npm test -- test/aiRunEndProof.test.ts test/storePersistenceProof.test.ts test/assistantAcceptance.test.ts test/assistantAcceptanceSession.test.ts test/aiAssistantTurnCleanup.test.ts test/aiComposerModeSession.test.ts` | exit 0; 6 files, 86 tests passed | [log](integration/focused-tests.log), [exit](integration/focused-tests.exit) |
| `npm test -- test/aiStickyChecklist.test.ts test/aiRegionPreviewHandoff.test.ts test/aiTurnAppliedAccounting.test.ts` | exit 0; 3 files, 29 tests passed | [log](integration/sticky-runner-tests.log), [exit](integration/sticky-runner-tests.exit) |
| `npm run typecheck:app` | exit 0 | [log](integration/typecheck-app.log), [exit](integration/typecheck-app.exit) |
| `npm run build` | exit 0; editor, export-player/SDK and standalone built | [log](integration/build.log), [exit](integration/build.exit) |
| `git diff --check` and `git diff --cached --check` | exit 0; no unresolved index entries or conflict markers in resolved files | checked before evidence/commit |

LSP diagnostics (`severity: all`):
- `src/ai/assistantSession.ts`: no diagnostics.
- `src/editor/panels/aiTurnRunner.ts`: no diagnostics.
- `test/aiAssistantTurnCleanup.test.ts`: no diagnostics.
- `test/aiTurnAppliedAccounting.test.ts`: no diagnostics.
- `test/aiRegionPreviewHandoff.test.ts`: existing incoming test-only TS2322 at
  68:4, reproduced below. This entire file is byte-identical to incoming main;
  no speculative type cleanup was made. App typecheck excludes test files.

```text
Type 'Mock<() => Promise<string>>' is not assignable to type
'(calls: readonly ProposedCall[], assistantBubble?: HTMLElement | null | undefined) => Promise<ProposalApplyOutcome>'.
  Type 'Promise<string>' is not assignable to type 'Promise<ProposalApplyOutcome>'.
    Type 'string' is not assignable to type 'ProposalApplyOutcome'.
```

The build log retains unresolved runtime asset/font references, mixed dynamic and
static import warnings, a record-picker circular chunk dependency warning,
missing optional AI proxy keys, and chunks over 500 kB. Exit 0 does not mean
warning-free.
No test command failed in this scoped integration run.

## Handoff boundary

This is compatibility evidence for a branch merge, not P1 release approval.
The parent owns fresh full gates, clean-base failure comparison, real-browser
and isolated-remote confirmation, and ultrabrain approval on the committed tree.
No browser or remote fixture was created by this task. Prior surface evidence is
not relabeled as fresh evidence for this merge. No push, PR merge, main checkout
modification or nested agent was performed.
