# Issue 693 final verification checkpoint

Follow-up branch: `fix/issue-693-reviewed-followup`.
Application source: `fa860141e3c472f25aa77dfb9e7e08233241f334`.
The later `2c6c78cc4` changes only the MIDI QA runner's configurable host.
Integrated upstream: `8ab349dfc21cb0c0c22a554f74a25bdeb05ab741`.
No final ultrabrain approval or follow-up PR merge has occurred.

## Latest completed checkpoint: f528644

The following supersedes the pending statuses in the earlier checkpoint below.

- `f52864445107262f40d34e941f8ea70305342d73` fixes the source transaction's
  false rejection of its own metadata reconciliation. Lead verification:
  10 files / 110 tests passed, with actual store flush/save/load logic and
  transport-only replacement. Authored edits, replacements and cancellation
  remain protected.
- The repaired gate-contract batch was independently run by the lead:
  26 files / 251 passed / 10 failed. All ten remaining failures match the
  exact `8ab349df` baseline; no crash/count/no-commit assertion was weakened.
- Full build including f528644 passed. SDK artifact remains `007eecb53def2a41`;
  source fingerprint is `434846e43404826a`; retained runtime is
  `7506a86db91f4675b433db62501e8a7cd4b9b769ff680e72b098f2b50ce1bb8a`.
- Full gates including f528644 completed: typecheck 0 errors, CSS exit 0,
  18,638 passed / 314 failed / 129 failing files. Surface is 107 passed /
  8 failed, matching the baseline. The full gate is not globally green.
- Exact main 8ab349df full gates were 18,425 passed / 324 failed / 136 failing
  files. Immutable generated input copies are in
  `/dev/shm/rpg-zzu-issue693-final-comparison-f528/`:
  candidate SHA-256 `6c505360162c5a11bc791e4c85e381831ac544dac499373b204f0505c3aae3df`,
  main SHA-256 `6809d7e87ccdc34cbce86b7c9ec0b0cf1ff441e1a85cf206f97d435775285c76`.
- Private-browser final audio, navigation, character recovery and diagnostic
  export replays passed, in addition to the R2 checks below.
- The two unchanged core shipped-player scenarios in `smoke.spec.ts` passed
  in 47.4 seconds with retries disabled.
- Lead Firefox normal/QA export controls both reached title and game ready,
  with zero failed requests or page errors. Normal had no debug hook and
  no state mirror; explicit QA had the expected hook and one mirror.
  `/dev/shm/rpg-zzu-issue693-lead/final/runtime-control/report.json`.
- The broad 26-test runtime attempt did not pass. Exact-main reproduction
  confirmed Chromium `ERR_NETWORK_CHANGED` module-load failures. Three
  separate battler assertions were reproduced verbatim on main and candidate:
  a front-view fixture incorrectly expects party sprites, and two image
  assertions incorrectly demand relative rather than resolved absolute URLs.
  `/dev/shm/st_01a0805d-battler-comparison.json` records those comparisons.
- The same saved 8 MiB project was checked through the built production editor:
  actual audio-element bytes retain the original hash, and the real Test Play
  button reached ready in 1,696 ms with zero additional writes or page errors.
  See `media-legacy-db-proof.json`.

While verification ran, main advanced to
`9c7c88c5fe97da30b78ae32761b40f8b46281273`, adding overlapping fake-DOM,
history and battle/event changes. That exact commit is the final integration
target. None of the checks above is represented as testing that future merge.
The follow-up PR remains withheld until complete final review.

## Earlier completed checks (retained)

- Full `npm run build` on `/dev/shm/rpg-zzu-issue693-final`: exit 0.
  Editor, player, standalone bundle and retained runtime completed.
  Runtime: `9df2e0f40cb0deddc81c5d56d44b49affbfca598039ffa88adabb55691fd5178`.
  SDK artifact: `007eecb53def2a41`; source fingerprint: `103cb5d64bfa27a5`.
  Existing large-chunk and unresolved `battle-reference-forest.png` warnings
  remain. Runtime styles/assets are unchanged from upstream.
- Final repair regression batch: 7 files, 58 tests passed.
- MIDI native replay: 26 checks, zero page errors, actual integration host 38420.
  `/dev/shm/rpg-zzu-issue693-lead/final/midi/results.json`.
- Boot diagnostics native replay: 4 scenarios passed. Actual loader failure
  retains `ok:false`; success retains `ok:true`. Replaced/initially disabled
  sessions retain zero late receipts while raw logs and fallback remain.
  `/dev/shm/rpg-zzu-issue693-lead/final/boot/boot.json`.
- Event diagnostics native replay: 3 popover viewport checks and 45 editable
  recovery-field checks, zero page errors and zero assistant sends.
  `/dev/shm/rpg-zzu-issue693-lead/final/validation/report.json`.

## Earlier full gate comparison and repair (retained)

The candidate full gate completed: application typecheck 0 errors, CSS exit 0;
Vitest 18,571 passed / 329 failed in 135 failing files. It is NOT a passing gate.
Machine report:
`/dev/shm/rpg-zzu-issue693-final/.omo/gates-vitest-report.json`.

Candidate surface: 104 passed / 11 failed, versus exact upstream's
107 passed / 8 failed. New spawn-field probes expose missing numeric/validation
APIs in the legacy fake DOM (`valueAsNumber` / `reportValidity`). Requested new
form controls also need narrowly maintained machine-consumed expectations.
Unrelated upstream snapshot differences must remain separate.

Deep repair task `st_01a08034` owns
`/dev/shm/rpg-zzu-issue693-gate-repairs`, branch `fix/issue693-gate-repairs`.
It must compare all candidate failures with the exact-main machine report and
fix demonstrated issue-specific regressions without weakening tests.

Exact-main full comparison is running in
`/dev/shm/rpg-zzu-issue693-current-main`; its report will be
`.omo/gates-vitest-report.json`. Monitor: `mon_DPNCKDDJ5GNBP7SP`.
The older original-source full baseline exceeded both 30-minute and 60-minute
attempts; neither timeout is reported as a pass.

## Earlier browser infrastructure and replay status (retained)

The shared `/home/main/.cache/ms-playwright` directory disappeared during
verification. Native startup failures from missing Firefox/Chromium executables
are infrastructure failures, not observed application behavior.

A thread-owned installation completed successfully at
`/dev/shm/rpg-zzu-issue693-lead/browsers`: Chromium headless shell 1228,
Firefox 1532 and FFmpeg 1011. Set `PLAYWRIGHT_BROWSERS_PATH` to that directory.
No package dependency or test expectation was changed for this recovery.

The unchanged canonical 26-test runtime gate is rerunning with the private cache,
`E2E_RETRIES=0`, and a separate output directory. Earlier missing-browser runs
are not passing evidence. Final audio, navigation, character recovery and
diagnostic-export browser replays are also rerunning with the private cache.
Their output is under `/dev/shm/rpg-zzu-issue693-lead/final/`.

The saved 8 MiB QA project remains `oprn-f51b995ac9`; see
`media-legacy-db-proof.json`. Do not create further saved copies merely to repeat
read/play verification. The QA-only credential-bearing proxy process was stopped.

PR 695's premature partial merge is documented in `acceptance.md`. Open the
follow-up PR only after the complete commit receives final ultrabrain approval.
