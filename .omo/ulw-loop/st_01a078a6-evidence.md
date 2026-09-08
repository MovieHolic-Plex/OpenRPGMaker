# R6 evidence

- Task: `st_01a078a6`; evidence key: `r6`.
- Worktree: `/home/main/z-project/rpg-zzu-ai-full-context-r6`.
- Branch: `agent/ai-full-context-r6`; baseline: `398ef9708`.
- Finding authority: `ultrabrain-review-1.md`, R6 P2.

## Fix and integration interface

`reviewChanges` now emits `/maps/<id>` for the union of changed, added and
deleted map IDs, mirroring the existing per-record database diff. Each entry
retains the complete map values; absent sides use `null`. Unchanged maps alone
are omitted. No change to original-context extraction/paging, the full native
writer catalog, independent request/parser, capacity guard, budgets, wiki
ownership, apply/undo/save, or action-combat proof.

The session already selects target/changed maps for original/current context.
Only the review delta path changes from `/maps` to `/maps/<id>`; no session
changes or sibling fixes are included. The new test file is independent of
other findings' session/visual tests.

## Red (before implementation)

Command:
`npm test -- test/independentReviewMapDeltas.test.ts --pool=threads --maxWorkers=1 --testTimeout=60000`

Exit 1: 2 failed, 1 passed.
- A 20x15 target plus five unchanged 256x256 maps, rename target only, default
  `gemini-3.7-flash`: actual request builder threw
  `independent-review-window-exceeded: complete evidence does not fit; no approval`.
- Mixed changed/added/deleted maps: expected three per-ID deltas, received `/maps`.
- Genuinely oversized 512x512 changed-map evidence already refused correctly.

## Green

Command:
`npm test -- test/independentReviewMapDeltas.test.ts test/independentReview.test.ts test/assistantIndependentReview.test.ts test/originalContext.test.ts --pool=threads --maxWorkers=1 --testTimeout=60000`

Exit 0 in one run: 4 files, 81 tests passed, no skipped tests. Coverage includes
complete serialized original/current projections, full changed map values,
added/deleted null sides, unchanged-map omission, oversized required evidence,
existing DB deltas, strict independent parsing, repair, cancellation, budgets,
visual prerequisites, autonomous milestone deferral and original paging.

LSP diagnostics: no diagnostics for the changed source and new test file,
checked before `npm run typecheck:app` (exit 0). `git diff --check`: exit 0.

Separate local Node/Vite SSR execution of the real extractor/request builder:
6 maps; target 20x15; path `/maps/map_blank_start`; diff 4,584 characters;
request 77,398 estimated tokens plus 16,384 response reserve against 1,048,576;
79 original and 79 current entries; zero reviewer tools. Replacing only the
delta with the former complete `/maps` pair reproduced the window refusal.
No evidence clipping or configuration relaxation was used.

All fixtures were local and ephemeral. No external model, DB, authored game
content, full build/gates or browser run. The initially empty-index sparse
worktree was populated from its own HEAD; no shared/other worktree was edited.
Lead integration, whole-goal validation and another ultrabrain review remain
required before merge; this scoped evidence is not merge approval.
