# Phase 3 final-review context

Status: ready for scoped final review with explicit gate limitations. Completed gate and paired failure disposition are in phase3-gates/SUMMARY.md and phase3-gate-triage/FINAL.md. This is not approval or a green whole-project receipt.

## Goal and delivery

Execute the approved life-systems-full-implementation plan: all 20 implementation tasks, 51 life features and F01-F13 audit findings, final F1-F4 verification, isolated LegacyDb save/reload, six reviewed phase PRs and a main rollup PR. Preserve Project4, read Save4 into Save5 with separate keys and raw-data preservation, explicit building-instance housing and proved-resource recovery. Do not read CLAUDE.md, edit WISH.md, overwrite the existing remote demo, add dependencies, suppress failures or merge remote PRs. This review covers Phase3 tasks6-10 and task33 only; later housing/economy/journey/remote work remains open.

Canonical plan: /home/main/.herdr/worktrees/rpg-zzu/wish-html/.omo/plans/life-systems-full-implementation.md.

## Frozen source

- Integration: b4395f929ec6a386f9aa274531efd8722ffc8252.
- Phase base: e33c93afbd1b0d8824f273c62d234d66c8802323.
- Tested product code: bbaf9464cad3768da057ef9909338b5cfb25aa8c. Parent git diff confirms src/test/package files unchanged through integration and the documentation-only follow-up.
- Full gate began at d107ac24ed72902fb35980034d08aed3ab3e0553. Only focused documentation and its receipt were committed while it ran. Do not pretend the entire working tree remained byte-frozen; runtime/test/package code did.
- Final reviewer must use a dedicated locked review worktree and actual final gate receipts, not this pending status. Exactly one final ultrabrain review is required by task33.

## Parent QA matrix

All paths below are under .omo/evidence/life-full-20260906/. The parent ran these checks, rather than relying on child claims.

| Scenario | Actual check | Observed | Evidence |
| --- | --- | --- | --- |
| Disabled automatic XP and enabled failure atomicity | Required task6 suite in exact combined command | Covered in 233 passing tests; explicit XP/minSkill contracts retained | 10/parent/integration-check/focused.json |
| Zero yields and exact regrowth | Real farming/day transitions plus file-backed native Storage | 19 scenarios, remaining7 write/read/apply, exact10 qualifying days, rejected raw data preserved | 10/parent/integration-check/regrowth.json; regrowth-state.json |
| Authored tool defaults/false/priority | Actual Firefox editor keyboard, undo/redo and Project4 local roundtrip; tool-authority cases | 8 editor mutations; 233 combined tests pass | 10/parent/integration-check/editor-state.json; focused.json |
| Game-time maker deadlines | Real clock/ledger/Storage public entry points | 5 paths; no wall-clock progress or automatic payout; duplicate/capacity refusal | 10/parent/integration-check/clock-paths.json |
| Coordinate priority | Real handleAction and real chest DOM in HappyDOM | Both five-step chains, front-before-feet and 6 exact-date controls | 10/parent/integration-check/priority-state.json |
| Actual field keyboard input | Firefox player.html, no editor shell or direct successful transaction injection | 3 scenarios, 5 real Z inputs; fish success, consumed energy/tool refusal, sleep-generated forage pickup; no swing | 10/parent/native/player.json |
| Marker refresh | Actual native PNG RGBA comparison | 3408 changed pixels in marker region only; not aesthetic image approval | 10/parent/native/pixels.json |
| Accepted extreme-year expiry | Parent RED, correction, separate GREEN; real input controls | Normal/MAX_SAFE_INTEGER expiry refusal with no payout/state mutation | phase3-parent-checks/; 10/parent/integration-check/priority-state.json |
| Static/type/build integration | 25-path diagnostics, direct app typecheck and full build | exit0 | 10/parent/integration-check/diagnostics.json; 10/parent/typecheck.json; 10/parent/build.json |
| Documentation | Parent canonical index and structure checks | exit0 | 10/wiki-parent.json |

Public clock/regrowth/priority scripts use the real authorities but disclose their scene/render endpoint substitutes. They are not native whole-game journeys. Actual native keyboard evidence is separate.

## Independent corroboration and limits

phase3-verification/final/VERIFY.md confirmed tasks6-10 with mandatory corrections0. Parent read all45 text artifacts, parsed JSON, checked51 artifact hashes and matched25 source hashes. This is not final task33 approval.

Broader related suite: 283 pass/2 inherited footprint snapshot failures out of285, actual exit1 retained in 10/parent/related.json. The exact historical registry failure comparison is preserved in the integration evidence. Raw independent .log files preserve six trailing-space lines and two EOF blank-line notices; the non-log whitespace check passes. Do not rewrite measured output to hide them.

Native image viewing was unavailable. Numerical pixel/DOM evidence does not establish aesthetic inspection. The current full gate produced the complete Vitest report before timing out in its first surface check:13910 total/13676passed/219failed/15pending. All234 cases in the8 changed Phase3 test files passed. CSS passes; the separate surface has six error bodies exactly matching base. The parent then compared113 whole failing files on current and exact Phase2 base:1251 cases each, current163fail/base162fail. All162 shared human diagnostics match after four narrow source-coordinate/timestamp mappings. The sole status delta is the independently reproduced existing audit-queue observer interference. Fifty-seven original failures pass both controlled runs without established cause; console-order, restricted-network and two identical unhandled-error limitations remain. See phase3-gate-triage/common-comparison.md and FINAL.md. No whole-project-green or all51-complete claim follows.

Task12 must account for task8 farming calling canOccupySpatialFootprint: adding farm occupancy must not block an existing plot from its own watering/harvest. This is an explicit later integration obligation.

## Handoff prerequisites

Before final review, attach completed phase3-gates receipts, classify new versus inherited failures and record QA resource cleanup. Then obtain the task33 ultrabrain verdict and create a stacked PR against the verified Phase2 branch. Do not merge remote PRs.
