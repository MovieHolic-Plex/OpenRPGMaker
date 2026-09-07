## Changes

- Keep successful harvesting independent of disabled automatic skill XP while preserving enabled reward failures and explicit XP rules.
- Honor zero harvest yields and exact qualifying-day regrowth, including saved remaining-day state.
- Align editor-authored tool defaults, replacement tables, item priority and explicit farmable-area conditions with runtime actions.
- Complete maker jobs through actual game-time paths while retaining frozen contracts and atomic refusal/rollback.
- Connect real field input to forage and fishing with per-coordinate event/chest/forage/fish/farm priority, consumed refusal, refresh/fallback markers and exact accepted-date expiry arithmetic.

This is Phase 3 of the larger life-system implementation. Housing, later economy/recovery surfaces, all 51 end-to-end journeys and isolated remote save/reload are later phases, not delivered by this PR. Project4 and Save5 remain separate; no new persisted BigInt or arbitrary year cap is introduced.

## Verification

The parent directly executed the checks and verified product/test/package bytes match tested code `bbaf9464cad3768da057ef9909338b5cfb25aa8c` through the documentation/evidence commits.

- Focused integrated selection: 233 passed in 10 files. Broader related selection: 283 passed and 2 established footprint-fixture failures, exit 1. These selections overlap.
- All 234 cases in the 8 Phase 3 changed test files passed in the whole-suite run.
- Diagnostics on 25 changed source/test files, app typecheck and full build passed.
- Actual Firefox `player.html`: three scenarios, five real Z inputs, including successful catch, consumed energy/tool refusal and sleep-generated forage pickup. No editor shell or injected successful outcomes.
- Actual Firefox editor: keyboard authoring, undo/redo and local Project4 roundtrip. Public authority probes additionally cover real chest DOM priority, 19 regrowth/Storage scenarios and five maker clock/ledger paths. These public probes are not relabeled as full native gameplay.
- Canonical wiki index and structure checks passed.

Evidence: `.omo/evidence/life-full-20260906/10/parent/`, `phase3-verification/final/VERIFY.md`, `phase3-gates/SUMMARY.md`, and `phase3-gate-triage/FINAL.md` under the same evidence root.

## Gate limits

The whole gate is not green. It reached a complete Vitest report (13,910 total; 13,676 passed; 219 failed; 15 pending), then hit its 1,200-second budget during the first surface check. CSS passes. The separate surface check fails with six complete error bodies matching the prior base.

The parent compared all 113 failed files and 1,251 cases on current and exact Phase 2 base, once each, under the same read-only/network-isolated/one-worker conditions. Current has 163 failures and base 162. All 162 shared human diagnostics match after four narrowly verified source-coordinate/timestamp mappings. The sole status difference is existing audit-queue interference with a later test fetch observer, reproduced on both heads using controlled time and actual clean flush. No test was deleted, skipped, weakened or marked fixed, and no baseline was changed.

Fifty-seven original failures were not reproduced on either side; their causes remain unestablished. Two case-attributed audit log differences, warning order, network-restricted observations and two identical unhandled-error warnings constrain conclusions. Full receipts and all original failures remain preserved.

Native image viewing was unavailable. Retained PNGs, DOM checks and the exact localized RGBA change do not constitute aesthetic image approval. Raw transcript whitespace is intentionally preserved.

## Review and delivery

Final task33 ultrabrain verdict: **APPROVE for Phase 3 tasks 6-10**, required product corrections 0. Reviewed HEAD: `bd81a933cbecfeb8b25ef15bf57bc24911011aa8`. Verdict: `.omo/evidence/life-full-20260906/phase3-final-review/VERDICT.md`. The delivery follow-up adds only review/cleanup records. This stacked PR must remain unmerged; the user requested `--make-pr`, not automatic shipping.
