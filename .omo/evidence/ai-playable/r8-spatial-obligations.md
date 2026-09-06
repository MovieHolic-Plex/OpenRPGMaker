# R8: placement-scoped spatial obligations

Task: st_01a076e7. Base: affaa027e3847eb78640c6330b4cf437f51394d4.
Worktree: /home/main/z-project/rpg-zzu-ai-spatial-obligations-0906.

## Captured failure and fix

Read the parent review at
`/home/main/z-project/rpg-zzu-ai-playable-adversarial-0906/.omo/evidence/ai-playable/review-round2.md`
and `output/evidence/ai-playable-final/round2/{REPORT.md,first-audit.json}` in that worktree.
The exact request is `first-audit.json`'s `instruction`; its NPC/sign completion was blocked
at lines 1675-1680 by an inferred terrain box, followed by unrelated pond/tree writes.

The regression replays the exact request and isolated sign through inference and the real
AssistantSession/upsert_event draft path. Assertions check executable text-command equality,
raw audit-input equality, inferred specs, bounds, gate verdicts, and milestone evidence,
not generated prompt wording. A legacy blanket-viewport prose assertion was replaced with
map-versus-viewport resolver behavior.

- Inference requires one actual, explicitly viewport-relative placement clause. Quoted
  dialogue/code, exact-copy text and inventory facts do not become placement instructions.
  Independent directions cannot be combined across objects; explicit map-relative placement
  stays map-relative even when the screen is mentioned as a reference.
- Asset classification uses the placement clause, not unrelated sentences. Raw user text
  and authored sign dialogue are not sanitized or rewritten.
- An inferred viewport spec is distinct from a selected-region spec. A planned work item
  must contain a matching viewport-placement instruction before its spatial gate can own
  that permit. Other ground/NPC work needs its own scope. Unknown asset kinds retain the
  generic selection fallback, but inferred selection is never an overwrite permission.
- Inferred placement stays within its original box and retains built-cell protection.
  Same-cell NPC evidence cannot satisfy an inferred terrain asset.
- Automatic completeness includes already-applied milestone calls. Both manual and
  synthetic continuations retain the captured inferred box, owner, and applied-call ledger.
  A new goal resets them. A real milestone-transition test exercises apply/rebase/clear;
  only the external apply/persistence boundary is replaced, with real draft tools retained.

## Verification

Logs below are under this worktree's `output/` (local evidence, not shipped game content).

Red, before the source fix:

```sh
npm test -- test/assistantSpatialObligations.test.ts --maxWorkers=2 --minWorkers=1
```

`r8-red-confirmed.log`: 9 failures, including the captured northeast terrain inference,
unrelated inventory-tree classification, and duplicate pond demand after milestone clearing.
Additional discriminating red cases are in `r8-red-ownership.log`, `r8-red-kind.log`,
`r8-red-reference.log`, `r8-red-selection.log`, and `r8-red-selection-protection.log`.
The last exposed the distinction between manual selection overwrite permission and an
inferred location; the fix excludes inferred assets from overwrite permits rather than
weakening the water-protection assertion.

Final green:

```sh
npm test -- test/assistantSpatialObligations.test.ts test/viewRelativeLocation.test.ts \
  test/aiSpecGate.test.ts test/assistantAcceptanceRequestBaseline.test.ts \
  --maxWorkers=2 --minWorkers=1
npm run typecheck:app
git diff --check
```

Results: **81 tests passed / 4 files, exit 0** (`r8-green-final.log`), app typecheck exit 0
(`r8-typecheck.log`), diffcheck exit 0. TypeScript compiler syntactic and semantic diagnostics
for all five changed TS files: **0 each**, including the test files excluded by app typecheck
(`r8-changed-diagnostics.log`). LSP returned clean diagnostics during development; its final
test-file refresh timed out, so the compiler API was used for the complete changed-file check.
No Markdown LSP is configured; documentation was reviewed and diffchecked.

### Confirmed pre-existing focused-suite failure

The expanded spatial run (`r8-green-spatial.log`) returned **86 passed / 1 failed**:
`test/aiSpecGateHardening.test.ts:319`, selection-spec lifetime test, expected
`second[0]?.ok` to be false but received undefined. No test was deleted, skipped, or changed.
Temporarily reverse-applied only the three changed source files to the exact base, ran:

```sh
npm test -- test/aiSpecGateHardening.test.ts -t '선택 영역 암묵 스펙은 그 턴에만' \
  --maxWorkers=2 --minWorkers=1
```

The exact same assertion fails on base (`r8-baseline-failure.log`); source was restored by
an EXIT trap immediately afterward. This is not an all-green hardening-suite claim.
The initial shell lacked `apply_patch` on PATH; the no-test-files result from that failed
setup was not counted as regression red. All actual edits used the available apply_patch
executable (or its patch-compatible wrapper for reversible base characterization).

## Integration and limits

R9 parent integration `980249d8a` (source `428e0be4`) owns mapTargets, per-target results,
recordToolResult, outcomeGate item checks, and WorkPlan ordering. R8 changes none of those
accounting paths or workPlan.ts. In assistantSession.ts, retain both R9 outcome checks and
R8's accumulated completeness calls / item instruction. R8 additionally touches viewport
spec admission, turn initialization, and the review warning union; R12 is separately active.

No server, browser, live content, remote database, or .env.local writes; port 9841 was not
used or changed. The test provider is scripted, not a new live-AI generation proof. Final
browser/player execution, matched builds, broad gates, real AI completion, and repeated
ultrabrain approval remain parent-owned. This increment is not merge approval.
