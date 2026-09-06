# Phase 2 final review input

Status: ready for the final Phase2 review, not approved yet. Task5 and task30
have independent confirmation and supervisor verification. Task38 strengthens
the obsolete animal-reset test contract. All validation runs and task31 cleanup
are complete; the full gate remains red with explicitly attributed limitations.
Read `.omo/evidence/life-full-20260906/PHASE2.md` and
`phase2-integration/final-comparison.json` for the latest complete evidence: final
13669 tests /13488 passed /166 failed /15 pending;165 failure headlines match
the actual phase base, plus one previously observed timing-sensitive dashboard
case. No blanket green-gate or exact historical timeout-cause claim is made.
Do not treat this packet as phase approval or start the next phase from it.

## Binding scope and delivery

- Approved plan: `.omo/plans/life-systems-full-implementation.md`.
- Original approved plan SHA256: `c1ceb2136fa0d39473ca385c3502afbaaa56e74f57eab030af4809dd0664fabe`.
- Ignore every CLAUDE.md. Preserve WISH.md and other people's changes.
- Phase 2 worktree: `/home/main/z-project/rpg-zzu-life-full-p2`.
- Branch: `agent/life-full-p2`.
- Verified phase base: `87de73785d1c309bbbe975636414f70bbc73a4b9`.
- Parent branch/PR: `agent/life-full-p1`, https://github.com/MovieHolic-Plex/rpg-zzu/pull/620 .
- Delivery is an open stacked PR, never a remote merge. The final main-target rollup belongs to the complete six-phase delivery.
- Latest tested candidate: `34c279bb6a481b18bf428fb985bc4fa4916d1e29`.
  Resolve actual HEAD/tree at review time; final evidence packaging may advance
  HEAD without changing product or tests. Product/config/wiki remain equivalent
  to the successfully built integration commit66f2cdb7.

## Required contracts

1. Task2: Project schema remains4; independent Save5 writes separated versioned
   manual/autosave keys, reads supported Save4 forward, preserves old bytes,
   rejects unknown versions and corrupt-new-key fallback. The frozen real old
   reader must reject Save5. Check checkpoints, quotas and save policy.
2. Task3: bounded monotonic recovery claims, atomic source-to-claim and
   claim-to-inventory transfer, no inferred legacy refunds, unknown originals
   retained, explicit collection only, no render/save payouts. Frozen maker
   inputs/outputs/time basis determine completion and cancellation.
3. Task4: writer/parser/apply/day use lossless draft reconciliation. Preserve
   completion/reward tombstones and dormant rights; contribution5 against
   requirement2 leaves progress2 plus claim3. Preserve persistent occupancy,
   explicit empty collections, unknown originals and ownership across repeated
   loads. Reject malformed/capacity-overflow input without changing disk/live.
4. Task5: detached read-only life snapshots, actual synchronous action receipts
   including rejection, scene-local sequence, prearmed exact observations, no
   saved counter, no invented future fields. QA-off must not publish QA-only
   globals/mirrors/receipts, including both audio observation globals.

Full clock wiring, linked housing and spatial payment capture/payout belong to
later tasks9/11. All51 feature journeys, final F1..F4 and remote content save/reload
remain later work. Phase approval must not claim those delivered.

## Evidence map

Phase-local evidence root:
`/home/main/z-project/rpg-zzu-life-full-p2/.omo/evidence/life-full-20260906/`.

- `2/SUMMARY.md`, `2/VERIFY.md`: version/key compatibility and failure contracts.
- `3/SUMMARY.md`, `3/VERIFY.md`: bounded ownership and frozen-maker transactions.
- `4/SUMMARY.md`, `4/VERIFY.md`: lossless restoration and corrected opaque-source/
  malformed-neighbor counterexamples. Supervisor proofs are in root
  `.omo/ulw-execute/task4-supervisor-{8c4f4f57,596eab9a}.json`.
- `5/SUMMARY.md`, `5/VERIFY.md`: original observability, deterministic debug setup,
  final tracked-set index correction, Q1 audio capability and lifecycle.
  Read the latest verdict, not a historical refusal embedded in the chronology.
- `5/q1/`: exact RED/GREEN, related tests, diagnostics/build, native media
  playing events and omitted/false/true browser observations.
- `5/q1/editor-followup/`: actual editor spec, trace, loading-failure diagnosis
  and server teardown. It is not an all-green editor test run.
- Root `.omo/ulw-execute/task5-supervisor-{4e2d1762,62c70a30,f8647454}.json`:
  supervisor command outputs and real keyboard/player proofs, including failures.
- `26/`: remaining save-key QA consumers, native Storage observation and cleanup.
- `28/TRIAGE.md` and associated JSON/raw receipts: exhaustive gate attribution.
  Root `.omo/ulw-execute/task28-supervisor.json` records independent object/count
  validation and subsequent clean comparison-worktree removal.

## Known limits which must remain explicit

- Supervisor full gates at4e2d1762 exited1: 13624 collected, 13422 passed,
  187 failed, 15 pending. App typecheck and CSS passed; surface failed.
  No baseline was updated and no failure was removed or skipped.
  Its complete report is archived as `phase2-gates-pre-task30-full.json` with a
  reconstruction/hash manifest. Use that archive, not the mutable latest gate report.
- All25 baseline-new files were compared against the actual phase base:
  17 had identical existing failures; one timeout reproduced on the base;
  seven historical full-suite timing/order attributions remain unresolved.
  Focused passes do not erase those seven failures.
- All six surface failures across five axes were identical on both pinned
  trees; all nine test axes and CSS-live were exercised. This is attribution,
  not a green surface-gate claim.
- The debugSession cold import was measured separately from its synchronous
  operations. The correction moves imports to collection without changing its
  four cases or17 assertions. It does not claim faster production imports or
  prove the precise cause of the historical browser startup timeouts.
- Related runtime suites retain two pre-existing actionDebounce fixture failures
  (`scene.game.registry` missing). Their actual before/after errors are retained.
- Extra editor audio-dialog E2E: three passes; the Escape case aborted during
  editor module loading with101 `ERR_NETWORK_CHANGED` requests before the new
  opt-in code. Escape's assertion did not execute. Successful cases exercise the
  shared opt-in and applied playback values.
- Native `playing` events prove browser playback/decode, not physical audibility.
  Post-teardown media aborts are retained rather than reported as zero failures.
- The current supervisor model cannot directly inspect images. Basic image
  content extraction is not a precise visual-quality verdict. No rendered
  product layout was changed by this phase.

## Review checks

- Confirm all task2..5 verdicts and ancestor applicability before phase approval.
- Inspect source/tests in both directions: required behavior present, no
  unrelated product work or preservation violations.
- Audit adversarial JSON ownership boundaries, not just ordinary item IDs.
  The supplemental `reserved-key-probe.mjs` reproduced loss of a positive
  `__proto__` contribution with exit1. Task30 corrected quantity and finite-use
  cursor dictionaries; independent181tests/60finite checks and integrated
  supervisor181tests/public/typecheck/build checks passed. Verify that evidence.
- Verify lifecycle ownership, native audio preservation, and semantic QA-only
  globals; do not indiscriminately remove legitimate boot/juice diagnostics.
- Generate/check INDEX against the final evidence-inclusive tracked set.
- Keep full-gates limitations visible and give a grounded phase verdict.
  Do not infer final project completion from phase-local successes.
