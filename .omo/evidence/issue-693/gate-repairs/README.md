# Issue 693 gate repairs

Base: `2c6c78cc48fb1367b0e71d51d32defd73c809682` (app source is the
`fa860141` integration). Comparison main:
`8ab349dfc21cb0c0c22a554f74a25bdeb05ab741`.
No application source, tracked gate baseline, browser configuration or dependencies
were changed. No remote writes, full gate reruns or production builds were performed.

## Exhaustive comparison

`disposition.json` covers **every one of 329 candidate failed assertions, all 324
main failed assertions, and all 142 files that failed on either side**. Inputs have
absolute paths and SHA-256 hashes. Assertions are paired by relative file, full
name and occurrence, not a sample or just a failed-file list. Complete failure
messages/stacks were compared after normalizing worktree roots and stack line/column
coordinates. Changed diagnostic payloads were inspected separately.

Original full results: candidate 18,571 passed / 329 failed / 135 failed files;
main 18,425 passed / 324 failed / 136 failed files.

| Candidate failure disposition | Assertions |
| --- | ---: |
| Same primary diagnostic and full stack modulo coordinates | 301 |
| Repaired candidate-only contract failures | 16 |
| Candidate-only run variance, passed on unchanged relevant base | 5 |
| Repaired additions within existing surface failures | 3 |
| Repaired nonmodal body-attachment classification | 1 |
| Same forbidden expressions, shifted source lines | 1 |
| Same edit-activity POST, changed receipt timestamp | 1 |
| Existing missing heading; received text includes new diagnostic controls | 1 |

Main additionally has 16 failed assertions that passed in candidate FULL; all have
`STACK_TRACE_ERROR`/collection stacks in its JSON. They are recorded, not presented
as candidate fixes. Two files (`eventPreviewPaintCssom`, `runtimePictureStacking`)
fail in both reports with respectively 17 and 8 skipped assertions and **empty file
messages**. The JSON does not identify their setup/hook exceptions; no particular
browser or infrastructure cause is invented.

## Focused repairs

- The shared fake DOM now implements native number conversion and numeric
  required/range/step validation. Invalid input produces a cancelable, non-bubbling
  `invalid` event and returns false. This is not a no-op `reportValidity` stub, and
  production receives no optional fallback. Four spawn numeric probe exceptions
  disappear; every one of its seven controls commits.
- Spawn and life-skill recovery surfaces have targeted form/interaction/commit
  entries, raised floors and exact reacting-control lists. The zero-control
  ratchet no longer lists those implemented forms. No crash/count/no-commit gate
  is removed or weakened.
- Numeric fidelity also makes the existing faction consumer preserve its initial
  number (1), or its probe edit (3.75), instead of the old missing-API fallback (0).
  Only those four commit payload values are corrected. A dedicated probe test
  and native number parity establish why; unrelated snapshot differences remain.
- Empty conversation export now tests the intentional consented diagnostic entry:
  off by default, no export artifact or conversation-export receipt, and Escape
  closes only the registered dialog above an underlying modal. The historical
  conversation-export key remains recognized without pretending it is still a
  live transcript-export action. All other named actions retain live-site checks.
- The modal gate's precise exception is the persistent indicator/download anchor;
  the actual diagnostic dialog's stack ownership is tested through the real menu.
- The title music test rejects new MIDI assignment and then commits playable
  `cc0-bgm-rtp-fld-003`, instead of requiring the now-prohibited `.mid` assignment.
- Test Play doubles explicitly provide the new synchronous audio-unlock boundary.
  Boot tests use bounded reload/boot/error signals rather than polling, guessed
  preparation delays or microtask counts. No runtime audio behavior is mocked
  away in production.

## Verification

All test commands used `--maxWorkers=1` and owned TMPDIR/Vite caches under
`/dev/shm/rpg-zzu-issue693-gate-repairs/.omo/issue693-gate-repairs/`.
Native parity used the lead-installed private browser cache; nothing was installed.

- Initial red surface run reproduced the numeric crash and added-control deltas.
- New numeric/probe contracts: 22 passed initially; the final set contains 23
  passing assertions including the additional existing-faction consumer check.
- Contract repair run: 45 passed / 0 failed, including the temporary capture test.
  Temporary capture tests were removed; no shipped test was skipped or deleted.
- Unchanged-base variance reproduction: 36 passed / 0 failed across
  `databaseOverviewTab`, `databaseSpeciesModalRefresh`, `databaseViewToggle` and
  `transactionalNewRemoteProject`. Before execution, `git diff --exit-code` verified
  app source, those four tests and the restored original fake DOM exactly matched
  `2c6c78cc4`. The numeric patch was reapplied afterward. This covers all five
  otherwise-unmatched candidate-only cases. Their underlying variance cause is
  unproven; they are not claimed repaired.
- Final focused run: **26 files, 224 passed / 10 failed, exit 1**. Every remaining
  diagnostic equals the exact-main full report. The ten surface files contribute
  **107 passed / 8 failed**, matching main and improving candidate's 104/11.
  The other two failures are the existing modal gate backlog (`aiStickyChecklist`
  and `newProjectDialog`, plus unregistered `worldPanel`). Exact failure
  text and per-assertion identities are retained in `disposition.json`.
- Native Chromium/fake number conversion and validation: **28/28 cases passed**;
  see `numeric-native.json`. This is numeric-control parity, not pixel review or
  another claim of full UI acceptance.
- Semantic fixture comparison verified that all other entries in the seven
  changed fixture files remain unchanged. Final `git diff --check` is clean.
- All ten changed TypeScript files have no LSP diagnostics. JSON LSP was attempted
  for all nine changed JSON files but is unavailable because Biome is not installed;
  no dependency was installed. All nine parse successfully, and the real fixture
  gates plus exhaustive report assertions validate their consumed values. Full app
  typecheck/build and final acceptance remain lead-owned.

The complete local test JSON artifacts and their hashes are listed in
`disposition.json`. An earlier seven-file run hit the command's 120-second timeout
without a report; it is explicitly not counted as a pass. `apply_patch` was absent
on this worker; exact replacements and checked `git apply` patches were used
without installing tools.
