# R7 - actionable acceptance repair at the provider boundary

Task: st_01a076e6. Base: affaa027e3847eb78640c6330b4cf437f51394d4.
Worktree: /home/main/z-project/rpg-zzu-ai-acceptance-repair-0906.

## Captured failure and scope

Source review: ../rpg-zzu-ai-playable-adversarial-0906/.omo/evidence/ai-playable/review-round2.md.
Source capture: ../rpg-zzu-ai-playable-adversarial-0906/output/evidence/ai-playable-final/round2/.
`test/fixtures/acceptance-round2-repairs.json` contains exactly the five
`toolCalls[name=repair_acceptance].args` from first-audit.json (verified equality).
No audit prose or project content is used as a test assertion.

Three seams investigated: criterion parsing (all five omit scoped targets),
provider normalization (Google then CCA flattens required union fields), and
image review (the old handler collapsed a separate unavailable-review result
into the same generic rejection). Each seam is covered independently.

The schema now exposes a union-free property superset plus canonical per-kind
examples. The installed provider normalization preserves the shapes and selector
fields. It still has only `kind` unconditionally required: conditional required
fields are conveyed by canonical shapes and field descriptions, with strict
runtime parsing remaining authoritative. This does not claim the provider itself
validates the discriminated union.

The parser and repair handler return criterion index, field, code, expected shape
and canonical example. Unknown item, immutable valid promise, malformed criteria,
invalid review arguments and unavailable current image coverage are distinct.
Whole-array validation, scoped counts, first baselines and once-only new-map
bindings remain authoritative. Rejected repairs do not adopt a valid prefix.
Malformed planner acceptance is visible on adoption, before generation; the plan
tool also returns the current snapshot. Exact-cell reachability returns failing
cells and blockers rather than crediting interaction adjacency.

Shared-file boundary: assistantSession.ts changes only the acceptance import,
adoptAcceptance, applyAcceptanceTool, and set_work_plan's returned snapshot.
No finalization/continuation-loop, spatial obligation, map accounting, or image
transport changes. No conflicts observed in this isolated worktree. R8/R9/R11/R12
integration and real generation/playback remain parent-owned.

## Red

```
npm test -- test/assistantAcceptanceSession.test.ts test/toolSchemaProviderCompat.test.ts --maxWorkers=2 --minWorkers=1
```

Exit 1: 7 failed, 16 passed. Five captured repair tests fail because
`data.code` and `data.issues` are absent. Two pre-existing provider compatibility
failures identify the six `set_work_plan.acceptance...oneOf` locations.
Full output: output/evidence/r7/red.log.

## Green and intermediate failures

```
npm test -- test/assistantAcceptance.test.ts test/assistantAcceptanceDiagnostics.test.ts test/assistantAcceptanceProvider.test.ts test/assistantAcceptanceSession.test.ts test/assistantAcceptancePromiseBaseline.test.ts test/assistantAcceptanceRequestBaseline.test.ts test/toolSchemaProviderCompat.test.ts test/assistantImageEvidence.test.ts test/assistantVisualEvidenceSession.test.ts --maxWorkers=2 --minWorkers=1
npm run typecheck:app
git diff --check
```

Final focused test execution: exit 0, 9 files, 102 tests passed (86.16s).
Final app typecheck: exit 0. Diff check: exit 0.
Logs: output/evidence/r7/green-final.log and typecheck-final.log.

Intermediate execution: 101 passed, 1 failed. The new session assertion expected
only two ledger rows despite deliberately adopting three; the actual third
image row was correctly retained. Corrected the expected row count without
changing behavior. Full failure: output/evidence/r7/green-initial.log.
The first typecheck command exceeded its 120-second harness timeout; its log
contains only the tsc invocation, not a pass. A bounded 600-second invocation
then completed with exit 0. No source error or warning was suppressed.

LSP: no diagnostics on all five changed source TS files and all five changed
TS test files. JSON LSP unavailable (Biome not installed); Markdown has no
configured LSP. Fixture JSON was parsed and compared exactly with captured args.
No dependency installation or LSP configuration changes were made.

## Read-only execution against the actual recorded project

Bun executed deserialize(first-project.json), parseAcceptanceCriteria, and the
actual acceptance ledger/evaluator. Adding only scoped targets makes the first
array syntactically valid; scoped map count and both dimensions pass. Exact-cell
routes remain false with these event blockers:

| Field | Map | Cell | Event |
| --- | --- | --- | --- |
| criteria[3].to[0] | map_blank_start | 8,8 | npc_mayor |
| criteria[3].to[1] | map_blank_start | 11,8 | ev_signpost |
| criteria[3].to[3] | map_blank_start | 10,0 | ev_north_gate |
| criteria[4].to[0] | map_basement | 6,3 | ev_key_chest |

A second read-only execution compares the same routes with checkReachability
(the implementation behind check_reachability) and explicit authored approach
cells. Both interaction checks pass. Separate approach criteria using village
(8,9), (11,9), (19,8), (10,1) and cellar (6,4) pass. Original exact-cell criteria
still fail. Project JSON equality before/after is true; no events were moved,
no existing promise was replaced, and no game data was written.

Execution artifacts in this worktree:
- output/evidence/r7/provider-schema.json
- output/evidence/r7/recorded-project-reachability.json
- output/evidence/r7/recorded-approach-comparison.json

## Limits

This is engine/session code plus a unit-test capture, not authored game content.
No real provider inference, browser/server work, port changes, DB writes or
.env.local changes. The provider test executes the installed normalization
functions in Bun, not a network request. Actual model repair compliance still
needs the parent's real-AI replay. Build/player/broad gates, matched workers,
fresh-context reload and repeated ultrabrain approval remain parent-owned.
No approval, push, PR, merge, or game-completion claim is made.
