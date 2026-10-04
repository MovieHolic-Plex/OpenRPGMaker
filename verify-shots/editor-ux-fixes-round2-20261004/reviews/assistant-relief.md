# Independent assistant / relief correctness review

Read-only source review of `73f88c09de`, `cf344b98a7`, `f5c67e59b6`, `e2115c38ae`, `40f313dd29`, `d46563bbc4`, and `9a61a77d3e`, including equivalent workspace changes and direct inspection of the requested commit snapshots. No code changes, tests, typecheck, gates, browser, server, or stash operations.

## Resolved finding

### [P1, resolved by f1bb35b682] Mixed tile/relief strokes left human height edits unprotected

Location: `/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/assistantHumanEdits.ts:99` (through line 103); producer: `src/editor/reliefActions.ts:80` (through line 93).

Before the fix, the human-edit subscriber treated the presence of `change.cells` as a complete list and skipped the fallback diff. Relief strokes now publish **two independent lists**: `cells` contains only ground/overlay tile replacements, while `reliefCells` contains authored level/ramp/decor changes. The subscriber did not consume `reliefCells`.

Concrete trigger: while an assistant request is active, raise a region with top-grass enabled across both a road cell A and an already-grass cell B. `commitReliefEdit` changes both heights, but only A needs tile replacement; its descriptor therefore contains `cells: [A]` and `reliefCells: [A, B]`. The guard remembers A alone. After a checkpoint ACK adopts those human edits as the new baseline, a subsequent assistant proposal can overwrite B's height, ramp, or decoration without `protect()` restoring it. The ordinary three-way merge cannot retain the earlier human intent once it has become the checkpoint baseline. This defeats the guard's stated purpose of retaining human edits across ACKs and can silently discard part of one brush stroke.

Required correction: union validated `cells` and `reliefCells` when recording protected coordinates. When `relief: true` has no authoritative `reliefCells` list, retain the relief comparison fallback even if tile `cells` is present. An explicit empty relief list should remain distinguishable from an absent list. Cover a mixed road/grass stroke followed by checkpoint adoption and a conflicting later proposal; the existing descriptor tests use matching single-cell lists and do not cover this interaction.

## Resolution review — f1bb35b682

Inspected the supervisor commit and its workspace implementation. The reported mixed-stroke defect is resolved at source level:

- The subscriber unions `change.cells` and `change.reliefCells`, applying the same integer and map-bound checks to both lists.
- For `relief: true` with `reliefCells === undefined`, it still calls `changedAssistantMapCells(old, next)` even when tile `cells` exists. Unknown/legacy relief changes therefore keep the comparison fallback rather than being silently treated as fully described tile edits.
- An explicit `reliefCells: []` remains a known empty list; it does not trigger the unknown-relief fallback. Descriptor-free changes still run the comparison.
- The store descriptor and `updateMapTiles` parameter now include `ReliefCellChange`, so the independent list is part of the typed notification contract.

Read the added mixed-intent regression test; did not execute it. Supervisor native mixed-protection QA is running independently and its result is not claimed here.

## Remaining scope

No additional concrete actionable findings identified in the reviewed activity capture/cache/pruning changes, conversation summary index/backfill and paging changes, spatial roundtrip projections, or relief revision/paging/culling changes. This is a static review, not a runtime verification claim.

Brief follow-up: re-read conversation summary migration, scoped cursor pagination, atomic payload/summary writes and deletion; activity media v1→v2 metadata backfill/pruning; and auxiliary crop/remap ownership. No additional separate concrete correctness bugs identified in this pass. No overlap with the supervisor's native protection QA.
