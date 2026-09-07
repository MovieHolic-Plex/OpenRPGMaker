# GROK integration evidence — combined approval/apply lifecycle

Branch: `agent/ai-full-context`, worktree `/home/main/z-project/rpg-zzu-ai-full-context`.
HEAD: `b371cd2c3`, tree `07d2864aa365abad80f2fb85ad6ba5407b76e37e`, clean.
Base: `c0487d9e0` (main `147218a2` merged) + 3 legacy-test picks + R1/R2.
Sequencer: fully consumed and quit; `git status` clean, no in-progress operation.

## Integrated commits (cherry-pick equivalents, atomic history preserved)

| order | original | integrated as | subject |
|---|---|---|---|
| R3 | `ad3a06288` | `a07b67950` | retire cancelled review approval before retry |
| R4 | `8ad0559b6` | `a2f495604` | credit native reads only after complete writer delivery |
| R5 | `31346a47e` | `97a8778f6` | ground authored start state and test presets |
| R6 | `e2966386b` | `781424df2` | scope independent review deltas to changed maps |
| scope | `7ee3ad75a` | `9dc653b14` | scope review map references to relevant edits |
| scope | `42e9c5d00` | `52fcc7c45` | isolate review references from unchanged map links |
| R7 | `875e4fab7` | `108f147af` | fail-closed review for map background changes without rendered evidence |
| docs | — | `b371cd2c3` | regenerate OpenWiki INDEX after review-scope integration |

Originals are not ancestors (cherry-pick creates new objects by design); each
row above carries the identical change set, verified by focused suites below.
`2cd6d8f6c` and `d683e52a8` were not replayed per the order (duplicate R5 /
already-reconciled R1 fixtures).

## Concrete conflict resolved: R3 `ad3a06288` in `src/ai/assistantSession.ts`

Three `<<<<<<<` hunks; resolved by contract, never ours/theirs wholesale:

1. `isDraftReviewApproved`: kept BOTH the R1 `draftBaselineCurrent` live-base
   latch AND the R3 `reviewTurn !== null && !reviewTurn.signal?.aborted`
   loop-owner/original-signal guard. A stale base voids approval even with a
   live owner; a retired attempt voids it even with a current base.
2. `reviewCurrentDraft` head: kept R2 `approvedAuthoredIdentity = null`
   clearing AND R3 `owner`/`outputAtStart`/`candidate` capture.
3. Approval body: R3 deferred-candidate form wins (publishing the verdict is
   not authority); the tail admission block (already auto-merged) now admits
   BOTH identities together (`approvedReviewIdentity` +
   `authoredIdentity(ctx.project)`), so the authored alternative cannot revive
   a retired approval.
4. `runTurnLoop` wrapper (already auto-merged): new attempts and
   non-final/aborted/failed retirements clear BOTH identities plus `reviewTurn`
   (added the two missing `approvedAuthoredIdentity = null` lines).

R2 eager soft normalization, wiki pre-review sync, world-merge apply path and
the R1 shared-boundary gate are untouched. R4 delivery hooks remain in
`executeTurnLoop` (writer body); R3's `runTurnLoop` is the owning wrapper.
R5 writer closure, R6 per-map deltas, review-root narrowing and the R7 visual
guard verified present by symbol (`observeDelivered` x2, `reviewMapReferenceRoots`,
`mapVisualEvidenceUnavailable`, `testPresets` closure, `reviewChanges`).

## Verification (all run in this worktree on the integrated tree)

- R3 + R1/R2 + R4 combined: `assistantReviewApprovalLifecycle` (9),
  `assistantNativeReadDelivery`, `toolReadDelivery`, `authoredProjectBaseline`
  (8), `assistantAuthoredBaseline` (4), `aiAuthoredBaselineSurfaces` (3),
  `authoredWorldReviewApplication` (3), `authoredSoftConfirmReviewEquality`
  (1) — **8 files / 40 tests PASS**.
- Review-scope + accounting + run-end: `independentReviewMapDeltas` (4),
  `assistantIndependentReviewCapacity` (2), `independentReviewReferenceScope`
  (11), `independentReviewLinkedMaps`, `assistantBackgroundReview`,
  `assistantIndependentReview`, `independentReview`, `aiTurnAppliedAccounting`,
  `aiMilestoneTurnAccounting`, `aiRunEndProof` (30),
  `aiAutonomousRunSmoke` (6) — **11 files / 154 tests PASS**.
- Session lane `aiAssistantSession` 54/54 PASS (incl. autonomous driver,
  milestone auto-apply, layer verification).
- Eval lane: 61/65 — the 4 failures (3 `aiWorkItemStall` a/b/c + 1 `evals`
  golden) are byte-identical to the archived `eval-migration` baseline at
  `2cd361f6` (7 pass / 4 known failures); no new regression.
- House protection: 18/21 — the 3 `real autonomous milestone application`
  failures carry the exact `independent-review-window-exceeded` signature
  recorded pre-existing on pristine `4696fa93f`; unchanged by integration.
- `tsc --noEmit -p tsconfig.app.json`: exit 0.
- OpenWiki INDEX regenerated (`b371cd2c3`): 49 pages.

## Own-apply observation (code-level verdict; live subscribed proof deferred)

`aiChatPanel.ts` store subscriber calls `refreshAcceptance(store.getCurrent())`
on every same-identity store change, including the session's own
`store.replace` from apply. Post-apply `rebaseProject` rebuilds the baseline,
so the R1 latch does not trip on own apply; but `isDraftReviewApproved()`
(exact identity equality) can read false after a consumed apply while the
turn's captured review stays approved — consistent with the R2 note. Live
subscribed-host proof (second-milestone behavior, fresh-approval recovery) is
the separately assigned browser task not executed here.

## Cleanup

No shared-main edits, no pushes/PRs, no worktree add/remove, no cache or
`node_modules` pruning. Lead owns the final full production build, whole
gates, and ultrabrain review.
