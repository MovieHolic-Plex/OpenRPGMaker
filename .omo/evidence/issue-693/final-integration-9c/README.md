# Exact final upstream integration (st_01a080a2)

Branch: `fix/issue-693-reviewed-followup`.
First parent: `298733420c04e742e43491c02081bae522f86950`.
Exact merged parent: `9c7c88c5fe97da30b78ae32761b40f8b46281273`.
Command: `git merge --no-ff --no-commit 9c7c88c5fe97da30b78ae32761b40f8b46281273`.
No advancing ref, open branch, reset, wholesale ours/theirs resolution, remote
content write, QA project creation, push, PR action or remote merge was used.
Full gates, application typecheck/build, native QA and final ultrabrain approval
remain lead-owned. This is narrow integration evidence, not global acceptance.

## Resolutions

- `test/fakeDom.ts`: retain upstream's select-aware value accessor, option state,
  tag-specific select identity and node adoption. Retain issue 693's complete
  `valueAsNumber`, `checkValidity` and `reportValidity` methods unchanged, reading
  through that accessor. Numeric and select/adoption suites both pass.
- `openwiki/testing.md`: retain both complete prose additions, including their
  original measured results. `openwiki/editor-event-authoring.md` merged both
  native battle admission and character recovery sections automatically.
- `openwiki/INDEX.md`: regenerate only after preserving the prose from both
  sides; regenerate again after documenting the semantic resolution below.
- The automatic runtime merge preserved upstream battle admission, initialization,
  foreground release, autorun readiness and result-transition failure handling,
  but its new handled-error boundary bypassed issue 693's outer diagnostic catch.
  A deterministic composed regression observed `started,cancelled` rather than
  `started,failed`. Carry the handled-failure outcome to the existing terminal
  receipt, without changing the upstream recovery/no-resume/no-result behavior.
  The same captured consent token still gates publication. Four added cases cover
  active, disabled, replacement and late-started consent; no failure text is retained.
- Read-only legacy history, boot intent, boot diagnostic token/outcome protections,
  MIDI restrictions and metadata source lineage remain intact. The transaction
  store and boot/intent implementations were not changed by this integration.
- Imported fixture changes are only upstream's battle warning entries. Existing
  issue-693 spawn/life-skill recovery fields and raised floors are retained; no
  baseline generation or test weakening was performed.

## Executed narrow verification

Exact command and private configuration: `run-focused.sh`, `vitest.config.mts`.
Both runs used one worker, `--configLoader runner`, `--no-cache`, and private
TMPDIR/Vite/Node caches under `/dev/shm/rpg-zzu-issue693-integration-st_01a080a2/`.
No test timeout was increased and no test retry or skip was added.

- Composed RED: selected four new diagnostic cases, exit 1: one expected failure
  (`started,cancelled` versus `started,failed`), three passed. The other 20 cases
  were outside this explicit RED name filter; all 24 ran in the complete batch.
- Initial 31-file attempt: the tool terminated its command at 600 seconds after
  18 file results. It produced no terminal JSON/exit and is **incomplete**, not a
  passing batch. The partial log and timeout note are retained.
- Identical complete batch: **exit 1; 31 files; 402 passed / 1 failed / 0 skipped**,
  891.77 seconds. All 24 event-battle failure tests passed, including the four
  composed diagnostic cases. Numeric 17, select/adoption 11, numeric spawn 6,
  unsupported MIDI 10, real source transaction lineage 12, history 32 and boot
  intent 7 all passed. Full per-file/case outcomes are in `focused-complete.json`.
- Sole failure: `eventValidationNavigationContract.test.ts:244`,
  `removes its document listener and layer immediately when the parent closes`:
  `AssertionError: expected 2 to be +0 // Object.is equality`.
  Existing `.omo/evidence/issue-693/gate-repairs/disposition.json` already records
  that exact assertion and diagnostic as `pre-existing-same-failure`, reproduced
  on main and candidate. The test uses Happy DOM, not the merged fake. No repair,
  assertion change or skip was made for this unrelated teardown debt.
- LSP requests completed for all 31 changed TypeScript files. Thirty report no
  diagnostics. `test/eventEditorStagedState.test.ts:261:10` reports existing
  TS6133 (`resultVariableId` unused); this file is byte-identical to exact 9c.
  Two initial fresh-diagnostic timeouts were followed by completed requests.
  CSS LSP is unavailable because biome is absent; PostCSS parsed both imported
  changed CSS files successfully. All five imported changed MJS files pass
  `node --check`. See `diagnostics.json`; no dependency was installed.
- `npm run openwiki:index -- --check`: exit 0. An earlier 25-second observer
  timeout is not a passing check; the completed result is recorded separately.
- Source/test/script/wiki staged whitespace check: exit 0. Whole-merge whitespace
  checking reports only existing raw upstream evidence whitespace; those bytes
  were deliberately preserved rather than cleaning measured logs.

## Evidence preservation

`evidence-preservation-verified.json` compares Git blobs, not prose assertions.
All 4,782 first-parent evidence files remain byte-identical. 4,876 exact-upstream
files remain byte-identical; the two other upstream documents (`acceptance.md`
and `evidence/issue693-assets.md`) already had expanded first-parent versions
before this merge, and those richer versions remain byte-identical to that parent.
No pre-existing measured evidence was changed. `final-verification.md` and its
immutable gate inputs, runtime/build identifiers and saved-project proof remain
untouched. The initial strict comparison report also remains in private scratch;
its two differences were classified by reading the actual pre-merge document diff.

Only this new verification record and copied raw results were added after the
complete test run; the production and test sources are the tested versions.
The saved `oprn-f51b995ac9` project was not accessed or written by this child.
Final native/full-gate acceptance and ultrabrain review are still required before
publishing the withheld follow-up PR.
