# Phase 2 review evidence

## Scope and candidate

This phase delivers approved tasks2..5: Save5 compatibility and separated keys,
bounded exact-once recovery transactions, lossless writer/reader/apply/day
reconciliation, and gated read-only QA observation. Corrections26,30 and38 are
included. It does not deliver later field, clock, housing, ledger or full51
journeys; those remain in the approved plan.

- Phase base: `87de73785d1c309bbbe975636414f70bbc73a4b9`.
- Parent PR: https://github.com/MovieHolic-Plex/rpg-zzu/pull/620 .
- Integration: `66f2cdb756a5a95eda07cae6103b82dfe7298b8a`.
- Latest tested candidate: `34c279bb6a481b18bf428fb985bc4fa4916d1e29`.
- Product/config/wiki are byte-identical between those last two commits;
  only the justified P1 test contract and evidence changed.
- Delivery is a reviewed open stacked PR based on `agent/life-full-p1`.
  No remote merge is authorized.

## Functional QA matrix

Paths below are relative to this evidence directory. The full commands and true
exits are in each named JSON receipt, not inferred from a process wrapper.

| Scenario | Executed authority / expected result | Observed | Evidence |
| --- | --- | --- | --- |
| Save4 forward load, Save5 keys and old-reader rejection | Real old-reader fixture and actual Storage reader/writer; old bytes retained, corrupt-new does not fall back | 18 final full-suite tests pass | `2/VERIFY.md`, `phase2-integration/final-full-vitest.json` |
| Remaining QA save consumers | Actual current writer output, current/legacy cleanup and namespace isolation | 15 final tests pass | `26/`, final full report |
| Bounded recovery ownership | Source/claim/inventory conservation, explicit payout once, bounds/unknown original refusal | 54 final tests pass | `3/VERIFY.md`, final full report |
| Snapshot/day lossless reconciliation | Contribution5 -> progress2+claim3, tombstones, occupancy, opaque originals, whole-draft rollback | 40 final tests pass | `4/VERIFY.md`, `phase2-integration/public.json` |
| Reserved IDs and finite-use cursors | Four valid IDs; exact retained/claim quantities; inventory4/charge2; use5 depletes | 37 final tests and all60 public finite checks pass | `30/VERIFY.md`, `phase2-integration/public.json` |
| Read-only action observation | Actual accepted/rejected actions, detached values, private scene sequence, no saved counter | 7 final tests; supervisor and independent player input pass | `5/VERIFY.md`, `5/q1-supervisor/browser.json` |
| Audio QA off/on and playback | Omitted/false have no QA audio globals; true observes; native BGM playing in all3 modes; teardown removes owned hooks | Engine5 + shell3 final tests pass; actual native playback/cleanup pass | `5/q1/`, `5/q1-supervisor/browser.json` |
| Hostile P1 input | Typed refusal preserves live/old slot; JSON-safe original quarantined without resurrection or payout; two true resaves retain initial state | All9 final P1 tests pass; supervisor focused89 pass | `38/`, `phase2-integration/final-p1-tests.json` |
| Compiler and build | Actual diagnostics, app tsc, app/player/SDK/standalone build | Exit0; warnings retained | `phase2-integration/diagnostics-*.json`, `typecheck.json`, `build.json`, `final-p1-diagnostics.json` |
| Wiki and index | Actual final evidence-inclusive validation | Exit0 before final evidence packaging; check again after staging | `phase2-integration/index.json`, `wiki.json`, `final-index.json` |

All runtime browser proofs use the dedicated `player.html` exported-store shim,
not editor play. Public-module proofs are labeled separately. Native `playing`
does not claim physical speaker audibility. No visual-quality verdict is claimed
from images this supervisor model cannot directly view.

## Whole-gate comparison: not an all-green claim

Both the actual phase base and final candidate ran `npm run gates -- --json`.

| Tree | Collected | Passed | Failed | Pending | Gate exit |
| --- | ---: | ---: | ---: | ---: | ---: |
| Phase base87de7378 | 13487 | 13307 | 165 | 15 | 1 |
| Final34c279bb | 13669 | 13488 | 166 | 15 | 1 |

Every one of the165 shared failing assertions has the same failure headline
after replacing only worktree prefixes. The remaining final failure is
`databaseOverviewDashboard.test.ts` / `empty project renders empty states without
NaN paths`: it also failed in the earlier4e2d1762 full run, passed at66f2cdb7 with
the same production code, and fails at34c279bb at15051ms. The baseline/focused
comparisons passed it. Its historical timing/order cause remains unproven; it is
not hidden, called repaired, or treated as a demonstrated new functional defect.

- Exact final comparison: `phase2-integration/final-comparison.json`.
- Exact full reports: `phase2-integration/base-full-vitest.json`,
  `phase2-integration/final-full-vitest.json`.
- Whole-gate command receipts: `base-full-gates.json`, `final-gates.json` in
  `phase2-integration/`.
- Earlier full reports are preserved separately before fixed-path overwrites.
- All nine surface axes were run. Six assertion failures across five axes match
  the phase base; CSS-live and CSS budget/graph pass. `28/TRIAGE.md` and its raw
  comparisons preserve exact differences. No snapshot or gate baseline update.

The full assertion comparison exposed an obsolete P1 test that expected rejected
animals to be silently replaced by zero-state authored starts. Task38 changed no
product code: it strengthens checks for the already approved refusal/quarantine,
raw/live/disk preservation and non-resurrection contract. Parent review caught
and corrected an initial wrong-key null comparison and insufficient resave
checks. The final test calls the real unresolved collector and compares each
resave with the initial recovery state.

## Additional editor evidence and limits

The changed audio-dialog opt-in helper was exercised by three passing editor
cases, including applied slider/media values. The fourth Escape case aborted
during module loading before the helper or Escape input, with101
`ERR_NETWORK_CHANGED` requests. Its assertion did not execute. The exact exit1,
three passes, trace and cleanup are retained under `5/q1/editor-followup/`.
This is not a four-case pass or a demonstrated Escape behavior defect.

## Preservation and cleanup

- No product/schema rollback, test skip, baseline absorption, dependency change,
  WISH modification or remote project write was used.
- All command failures and initial observer/cleanup mistakes remain in history.
- The two tracked `.vite-cache` files were restored and proved byte-identical.
- `phase2-integration/cleanup.json` records generated dist removal, preservation
  of the six previously ignored post-commit receipts, and removal of the clean
  task30 worktree. Original reviewed commits remain ancestors of the merge.
- Browser/SSR/window/cache closures and port refusal receipts are retained.
- Phase1's open-PR worktree and the active Phase2 integration worktree are kept.
- Full51 authoring/play/day/save/resume and isolated Supabase save/reload are
  later obligations. Phase approval must not mark them completed.
