# NPC behavior acceptance

Scope: repair connected pursuit and add authorable sight-triggered trainer encounters.
This is engine/editor work with minimal test fixtures, not authored demo content.
No Supabase project content was changed. Publication requires the final gates and review below.

## Behavioral evidence

| Criterion | Failing-first evidence | Passing evidence | Real surface |
| --- | --- | --- | --- |
| C1: search-grace transfer, arrival search, cadence, collisions and saved pursuit | `red-pursuit.log`: 20 behavioral failures; additional boundary RED log | `green-rereview-final.log`: 172 tests across 13 files, including all 117 focused NPC tests | `pursuit/report.json`: acquisition, corner loss, real door, one delayed pursuer, visible search movement, hidden search expiry, reacquisition and visible contact |
| C2: forward sight, owned approach, actual battle and completion | `red-encounter-lead.log`: 23 failures; later compatibility and review-blocker RED logs | Same final 172-test run | `trainer/report.json`: 11 passing cases, including manual-first, external-map cancellation and positive authored transfer |
| C3: honest authoring, validation and roundtrip | `red-encounter-lead.log`; `red-encounter-compatibility.log`: 7 additional failures | Same final 172-test run; no changed-source LSP errors | Actual editor Apply/reopen passed at 1440x900 and 1024x768; selected `정면 직선` is fully visible |
| C4: scheduled battle awaits real results and preserves ownership | `red-review-blockers.log`, `red-legacy-condition.log`, `red-inactive-page.log` plus earlier scheduler/lifecycle RED | Same final 172-test run, including legacy conditions and same-ID map replacement | Paged and legacy parallel battles complete real attack/target/victory/branch; inactive paged events remain idle; stale dialogue is cancelled |

Short log names and scenario report paths in the table are relative to
`output/evidence/npc-behavior/`; other paths are repository-relative. Browser evidence lives under
`output/evidence/npc-behavior/{pursuit,trainer,editor}/`; each directory contains
`SUMMARY.md`, `report.json`, `actions.jsonl`, per-case state histories, PNGs and Playwright traces.
These generated artifacts are retained locally rather than committed as temporary binaries.

## Reproduction

```bash
npm test -- test/npcTrainerEncounter.test.ts test/npcBehaviorAuthoring.test.ts \
  test/npcScheduledBattle.test.ts test/npcEncounterBoundaries.test.ts \
  test/npcBattleLifecycle.test.ts test/npcEncounterOwnershipBoundaries.test.ts \
  test/npcPursuitRegression.test.ts test/npcPursuitBoundaries.test.ts \
  test/horrorObjectRuntime.test.ts --maxWorkers=2
node scripts/qa/npc-behavior.mjs --scenario pursuit --relay
node scripts/qa/npc-behavior.mjs --scenario trainer --relay
node scripts/qa/npc-behavior.mjs --scenario editor --relay
npm run gates
npm run build
```

`--relay` is for hosts where Chromium's loopback requests are cancelled by network-interface
changes. It forwards actual Vite responses through Playwright's HTTP client, with zero retries.
It does not mock the engine, movement, interpreter, battle or editor mutations.

The player proof used actual Chromium 149 and Phaser 3.90 WebGL, keyboard input, real
intermediate sprite positions and actual battle controls/results. The editor proof uses
real modal controls and the canonical store. Its existing test persistence seam disables
remote autosave; draft/apply/serialization remain real. AI bridge and dev disk mirroring
are disabled in this isolated fixture. Map BGM is explicitly silent; audio is not the
behavior under test. Request and browser-error assertions remain enabled.

## Cleanup and review boundary

Passing browser reports contain observer/listener/signal teardown, trace/context/browser
closure, server closure and exclusive-bind proof that the owned port was released.
Failed transport and timed-out attempts are retained in separate logs; they are not PASS evidence.
The owned QA, initial review, re-review and final baseline worktrees were removed after
checking their contents and preserving review recovery branches. Final worktree inventory
contains only the lead checkout for this task. All gate/test commands have exited;
the completed file watches were released.

Image attachments were not delivered to the lead model by the provider. Basic image-content
extraction confirmed rendered maps/characters and editor field labels/values. Behavioral
acceptance comes from the actual browser actions, DOM/store assertions and rendered state
traces, not an unsupported claim of direct aesthetic inspection.

## Final gates

- Editor shell surface: PASS, 22 tests with update mode off (`green-shell-surface.log`).
  Only the new detection group/checkbox was added in five variants; the floor file was unchanged.
- Full baseline-comparing gates: executed, exit 1. App typecheck and CSS passed; the run
  reported 14,317 passed, 230 failed, 15 pending tests. The stored baseline predates the
  starting commit and also has pre-existing red surface axes.
- The full run exposed two introduced live-map identity regressions. Both were fixed
  without changing their assertions. `current-new-failures.json` now passes both files
  and all 112 NPC tests. Post-fix pursuit browser acceptance also passed.
- At the identity-fix checkpoint, controlled comparison of every extra flagged file plus the red surface axes used
  unchanged starting source: 45 files / 431 tests, 393 passed and 38 failed.
  The fixed tree plus NPC tests: 54 files / 543 tests, 505 passed and the same 38 failed.
  No new failing assertion remains in this comparison. See `gate-comparison.json`,
  `base-new-failures.json`, and `current-new-failures.json` under the evidence directory.
  Full-suite-only failures that did not reproduce in the bounded comparison are recorded,
  not described as a green full suite. No global failure baseline or floor was relaxed.
- The gate's JSON stdout was truncated by the pre-existing immediate-exit/pipe behavior.
  The complete Vitest JSON report and separate exit/build logs were used for analysis.
- Review 1 rejected two reproduced issues: pageless parallel battle admission and stale
  commands after unrelated map replacement. Both were fixed behind permanent RED tests;
  own authored transfers remain positive cases. `REVIEW-1.md` preserves the report.
- Build: PASS after the final review corrections (`build-rereview-final.log`), including
  app, export player SDK and standalone player. SDK artifact `f7904f3e9149564c`,
  source digest prefix `deb89fda24daa4da`.
- Final review-corrected whole-project gate: completed with the normal worker configuration,
  exit 1 (`gates-publication.log`, numeric receipt `gates-publication.exit`). It collected
  14,567 tests: 14,368 passed, 184 failed and 15 pending. App typecheck and CSS passed.
  No focused NPC or live-map identity regression file failed. The CPU-limited attempt
  timed out before producing a report and is not counted as passing evidence.
- The final extra-file comparison used the same six files and two-worker command on
  starting commit `49067218a` and the final source: both produced 43 passed / 1 failed
  across 44 tests. The same assertion in `interiorPipelineMapReplacement.test.ts`
  expected `{x:5,y:10}` but received `{x:5,y:9}` on both trees.
  See `final-extra-base-matched.json` and `final-extra-current.json`.
  The other five full-run-only flags passed in both bounded runs. An earlier isolated
  base run passed, while the final isolated run failed; the existing interior test
  is unstable, not fixed or suppressed by this NPC change.
- Adversarial delta re-review: **APPROVE**, no criterion-linked blockers (`REVIEW.md`).
  Independent checks passed 34 permanent tests and 5 additional probes; changed production
  modules matched the embedded browser trace sources exactly. This is scoped code approval,
  not a claim that the stock global gate is green.
- Publication commit and PR identifiers are recorded by the delivery report. The code
  and QA scripts are byte-identical to the approved R2 snapshot; only delivery evidence
  was updated after approval.

Execution ledger: `/tmp/ulw-20260906-161742.wGQ2Nm.md`.
