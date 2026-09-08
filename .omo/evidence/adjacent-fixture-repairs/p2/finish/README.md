# Completed follow-up: both remaining test contracts are GREEN

This follow-up supersedes the two blocked dispositions in the parent P2 README and
BLOCKERS.md. Those historical reports and every failed attempt remain intact.
Only `test/aiAppliedBudgetStop.test.ts` and `test/aiWorkItemOutcomeGateSmoke.test.ts`
changed during this follow-up. All other nine files retain their exact frozen hashes.
Model reconfirmed: `PI_MODEL=gpt-6-astra`.

## Verification

- Exact isolated reproductions: `../finish-round-red.json` and
  `../finish-map-red.json`, each exit 1 with the requested single failure.
- Final complete-file run: `../finish-frozen-green.json` / `.log` / `.exit`:
  **2 files, 8 tests passed, zero failures/skips/todos, exit 0**. No name filter.
- Fresh LSP tool checks for both final files: no diagnostics.
- Independent focused TypeScript syntactic/semantic diagnostics: `types-final.json`,
  zero diagnostics in both files, exit 0. `types.json` retains the two intermediate
  typing errors, fixed with a discriminated-event type guard and a narrowed const
  reference; no suppression or unrelated type repair.
- `nine.before.sha256` and `nine-check.log` prove the nine previously verified files
  are unchanged. Their 80 passing assertions remain attributable to the earlier
  complete-file reports. `verification.json` accounts for all 11 current files and
  88 passing assertions across these hash-pinned reports; it is an evidence manifest,
  not a fabricated combined Vitest run or a whole-suite gate result.
- Every test run uses the unchanged repository wrapper, forks, maxWorkers=1,
  minWorkers=1, no file parallelism, `ulimit -c 0`, and bounded watchdogs. No test
  deadlines were raised. Failed experiments and their actual exits/JSON are retained.

## Round-cap contract

Cap 3, token limit 1024, the original two title writes (`초안`, `확정`), original
two-item work plan, native summary read, two applied calls and zero pending calls
remain intact. The rounds parameter alone declares one supplemental ordinary promise,
`title-integrity`, requiring the native `run_lint({})` verdict.

The real sequence is:

1. Segment 1 round 1: native set_work_plan.
2. Round 2: native draft title, applied once.
3. Round 3: original get_project_summary plus native explicit lint. The lint creates
   genuinely new required evidence, so checkpoint no longer preempts the round cap.
   The test requires the actual `턴 종료(max-tool-calls)` machine prefix.
4. Segment 2: native final title, applied once. Both the write and accepted-state
   refresh invalidate earlier explicit proof. The original automatic lint still runs,
   but its advisory result cannot renew the supplemental explicit verdict.
5. A separate native explicit lint checks the accepted final revision. Only then does
   the original request close successfully.

The test asserts the exact intermediate checker states: false at draft, true at the
first lint and segment-2 entry, false after the final write and automatic lint, true
after the final explicit recheck. All three native lint results report zero errors.
The full seven-call native order and all six scripted paired responses are counted.
Source and request identity stay request-1; the ledger has exactly the original source
row plus the unique supplemental promise. No extra write or private progress/state
injection occurs. The token case and both formatting quantities remain covered.

## New-map/lake contract

The unsupported original-baseline targetChange predicate is removed. The nonempty raw
new-map request independently declares supported mapDimensions(30,30) and native
authored-content QA. **Generic QA is not claimed to prove lake shape.** The full lake
proof additionally requires the real delivered `get_map_region` semantic grid, water
count 80 and bounds (4,4,10,10), and repeats that native semantic read on the accepted
store. The independent expected ten-row circle mask is checked exactly, not reduced
to existence, a single changed cell, a transport ok flag, or a generic QA pass.

The original create -> spec -> fill order remains. Spec, fill and the original-region
read share one received batch; automatic advancement observes the genuinely unpainted
4x4 grove and emits the original completeness warning. The native fill is applied,
then a real QA call on the accepted project closes the declared source. At this point
the original work item is still in_progress: the warning has not been suppressed.

Public same-goal Resume runs a real resume planner and delivers the single original
complete_work_item. It completes L1-1 without any new write or application. The test
checks original source inventory equality, work-plan identity, accepted store identity,
unchanged milestone inventory, and final done status.

Exact quantities retained/asserted:

- Newly created 30x30 map; original 10x10 circular lake and 4x4 grove at their original
  coordinates. Initial project still has no such map; no precreation or ledger rebase.
- Exactly 80 changed lower-tile positions across the entire accepted map; all other
  positions, all upper tiles, and every grove cell are preserved. The captured native
  create result is used only for these assertions, never installed as a source baseline.
- Exactly two original writes, two one-call milestones, zero pending calls, one explicit
  completion, and zero further apply/milestone/store replacement on Resume.
- Seven provider requests: two real planners and five working requests. Eight native
  session events in exact order: set_work_plan, create_map, set_build_spec, fill_region,
  get_map_region, evaluate_game_quality, run_lint, complete_work_item. Each of the seven
  scripted tool IDs has exactly one paired response. One additional native region read
  verifies the accepted store before Resume; it performs no write/application.

New negative controls distinguish the actual paint proof from mere authoring/existence:

- A missing map cannot produce the native region read. A newly created, unpainted
  30x30 map has zero water cells; native QA executes successfully but its verdict is
  false with the real empty-map error.
- A full 10x10 rectangular water fill has 100 water cells and passes generic authoredness
  QA, but fails the exact 80-cell circular native-grid proof. This explicitly prevents
  treating generic QA as the lake predicate by itself.

## Frozen delivery and isolation

`two-file-final.patch` replaces the two earlier blocked files relative to the unchanged
base HEAD. `all-eleven-final.patch` contains the complete test-only increment including
the nine unchanged verified repairs. Per-file and patch SHA-256 values are in
`verification.json`; `files.sha256` pins the current eleven test files.

No production, persistence/schema/config, UI, shared helper, or other test file changed.
No commit/push/merge/rebase/unlock/worktree removal, browser/server, port 9841 use,
build/profile/full gate or real provider call occurred. Final owned-worker teardown
and artifact integrity are recorded alongside the native reports. No blocker remains
for these two requested test-only contracts.
