# GROK R2 evidence — reviewed authored candidate survives application

Model: xai/grok-4.6 (native task metadata; ambient PI vars not cited as identity).
Branch: agent/ai-full-context on top of R1 closeout c16dfc572. Scope: R2 only.

## Root causes fixed
1. `applyProposedProject` and `applyRegionProjectWithHistory` blanket-replaced
   the reviewed `world` with the live world, erasing approved `author_npc_cast`
   place/character entities and locatedIn/knows relations.
2. `markSoftVocabApprovalsOnProject` ran after approval in the proposal host,
   so reviewed persistent `origin`/`source` differed from applied values.

## Changes (absolute paths)
- NEW `/home/main/z-project/rpg-zzu-ai-full-context/src/project/world/review.ts`
  (+ export in `src/project/world/index.ts`):
  `reconcileReviewedWorldForApply` (reviewed authored partition wins, live
  wiki-owned documents substitute in place, order-stable so the approved
  identity survives), `syncDraftWikiWithLive` (pre-review adoption of newer
  live wiki docs; draft-side wiki writes reported as conflicts).
- `src/editor/tools/applyChangesetToStore.ts`, `src/editor/regionTask/runRegionTask.ts`:
  merge instead of wholesale live-world replacement (reset path unchanged).
- `src/ai/assistantSession.ts`: eager per-write soft-vocab normalization
  (pre-review AND before later show_map_region captures, so visual receipts stay
  valid); pre-review wiki sync with conflicts as required problems;
  `approvedAuthoredIdentity` so coordinator receipts / manual wiki notes adopt
  into the approval instead of flipping a correct apply to false "unapproved".
- `src/editor/panels/aiProposalCard.ts`: post-approval marking removed
  (count-only message kept); `src/project/authoredProjectBaseline.ts` exports
  `authoredIdentity`; two stale comments updated.
- R1 baseline gate untouched and still first at the boundary.

## Verification (all in /home/main/z-project/rpg-zzu-ai-full-context)
- NEW `test/authoredWorldReviewApplication.test.ts` (3): NPC cast review/apply/
  undo with manual+locked wiki seeds; held-review newer manual wiki preserved;
  region apply preserves graph + live wiki. NEW
  `test/authoredSoftConfirmReviewEquality.test.ts` (1): reviewer sees
  origin:user in `/tilesets` changes pre-approval; card applies equal values;
  one undo entry restores.
- Failing-first: scratch repro showed entities `[w_original]`/relations `[]`
  after apply before the fix; approval now stays `approved` with full graph.
- Suites: R2 files 4/4, wiki/region/soft/review/npc 7 files 64/64, R1 baseline +
  apply/commit/gate 6 files 51/51, runEnd/smoke/house/changeset 60 + 3
  pre-existing `independent-review-window-exceeded` failures (confirmed on
  pristine review worktree during R1, untouched by R2).
- `tsc --noEmit -p tsconfig.app.json`: exit 0.
- Real Firefox UI (`scripts/qa/grok-r2-npc-world.mjs`, artifacts
  `.omo/evidence/ai-full-context/grok-r2/`): real composer cast, review
  approved rev 2, auto-apply kept guideline + manual wiki + place + character +
  locatedIn with `review.status approved`, real undo clicks restored seeds,
  zero page errors.

## Observation for lead (not fixed, out of R2 scope)
In subscribed browser hosts the R1 `refreshAcceptance` latch also fires on the
session's own `store.replace`, so live `isDraftReviewApproved()` reads false
after a consumed apply (one-shot; the turn's captured review stays approved).
By the same mechanism a second milestone in one turn may skip auto-apply in
production while unit (unsubscribed) flows adopt and continue. Flagging for
scheduling, not fixing here.
