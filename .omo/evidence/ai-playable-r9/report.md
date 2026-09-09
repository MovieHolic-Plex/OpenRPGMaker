# R9: map-targeted spatial work outcomes

- Task: `st_01a076e8`.
- Isolated worktree: `/home/main/z-project/rpg-zzu-ai-map-outcomes-0906`.
- Base: `affaa027e3847eb78640c6330b4cf437f51394d4`.
- Source request: `/home/main/z-project/rpg-zzu-ai-playable-adversarial-0906/.omo/evidence/ai-playable/review-round2.md`, R9.
- Captured runtime: `/home/main/z-project/rpg-zzu-ai-playable-adversarial-0906/output/evidence/ai-playable-final/round2/first-audit.json:1215-1390`.

## Failure and bounded fix

The recorded mixed terrain/link item required only `fill_region` and
`create_transfer_pair`. A successful no-change village fill, a cellar fill
rejected for missing its own spec, and a successful transfer completed the item.
The initial regression replay through session result accounting reproduced
`status: done` in both result orderings before production changes.

Spatial authoring items now declare exact `mapTargets`; one authoring map per
item, with its existing single-map BuildSpec. Cross-map linking is a later item
with both endpoint IDs. Existing layer/item order supplies prerequisites; no
new dependency/DAG field is introduced. Mixed/malformed target declarations
receive structured correction errors, and unsupported legacy planner items stay
incomplete. Per-target tool outcomes are retained across continuations and checked
by both explicit and automatic session completion. Idempotent successful writes
remain valid for their own targets; no minimum tile count or quotas are added.
Map-metadata-only and nonspatial plans retain their previous behavior.

The final regression tests run real `specGate` and `runTool` paths for the
no-change fill, missing cellar spec, transfers, and corrected cellar spec.
They cover both orders, explicit completion, prior completed-item idempotence,
a real scripted-provider continuation, per-target re-failure, malformed plan
atomicity, matching transfer endpoints, and skipped prior-map prerequisites.
The continuation test injects a deterministic provider, not a real AI model.

## Verification

All commands ran in the isolated worktree. Logs are local artifacts under
`.omo/evidence/ai-playable-r9/` (log files are gitignored).

Red, before production changes:

```sh
npm test -- test/workPlanMapOutcomes.test.ts --maxWorkers=2 --minWorkers=1
```

`red.log`: exit 1, 2 failed. Both failures:
`AssertionError: expected 'done' not to be 'done'`.

Final focused green:

```sh
npm test -- test/workPlanMapOutcomes.test.ts test/workPlan.test.ts test/aiMilestoneTurnAccounting.test.ts test/workItemOutcome.test.ts test/workItemOutcomeTargetMap.test.ts test/assistantVerificationEvidence.test.ts --maxWorkers=2 --minWorkers=1
npm run typecheck:app
git diff --check
```

- `green.log`: exit 0, 6 files / 106 tests passed (14 new R9 cases).
- `typecheck.log`: exit 0.
- Changed TypeScript diagnostics: no diagnostics on all four changed TS files.
- Markdown diagnostics unavailable: no configured `.md` language server.
- `git diff --check`: exit 0.

Additional provider-schema check:

```sh
npm test -- test/toolSchemaProviderCompat.test.ts --maxWorkers=2 --minWorkers=1
```

`schema-compat.log`: exit 1, 4 passed / 2 failed. Both report only the six
`set_work_plan.acceptance[].criteria[]...oneOf` paths already listed in the
round2 review. `assistantAcceptanceTools.ts` and the compatibility test are
unchanged from the base (verified by git diff). A separate base checkout was
not executed. No violation concerns `mapTargets`; acceptance repair is R7-owned.

Intermediate failures were fixed, not suppressed:

- Before the behavioral red: unavailable `apply_patch` executable, a rejected
  whitespace-only patch tail, and an incorrect `runTool` test import. Edits use
  an `apply_patch` shell function backed by `git apply --whitespace=error -`.
- `focused-first.log`: 4 failed / 54 passed. Three metadata-plan regressions
  exposed an overly broad spatial classification; narrowed it to spatial
  authoring tools. The continuation fixture initially consumed a planner call
  as execution; it now handles the real planner request separately.
- `typecheck-first.log`: exit 2, unsupported `ReadonlyArray.findLast` and its
  resulting implicit-any diagnostic; replaced with typed reverse/find.
- `focused-second.log`: exit 0, 84 tests passed before the final expanded run.

## Ownership and limits

- R9 owns `workPlan.ts`, new `workPlanTargets.ts`, the work-plan schema and
  `recordToolResult`/`outcomeGate` integration in `assistantSession.ts`.
- R8 leaves those functions alone; its `autoCompleteGate` completeness input
  and implicit-spatial obligation work is untouched here.
- R7 acceptance parsing/schema and R12 final completion checks are untouched.
- No server/browser was started or modified. No game content or DB writes were
  made; tests use in-memory projects and existing hermetic persistence seams.
- `.env.local` and occupied port 9841 were not modified.
- Full build/gates, real AI generation, browser/playthrough/reload, repeated
  ultrabrain approval, and merge remain parent-owned and unverified here.
- This increment accounts for declared target/tool outcomes; it does not infer
  arbitrary natural-language building promises or prove the final game playable.
