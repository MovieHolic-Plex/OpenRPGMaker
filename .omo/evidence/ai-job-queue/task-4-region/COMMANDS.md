# Commands and exit codes

All execution: `/home/main/z-project/rpg-zzu-aiq-region-silver`, Linux x64.
No .env or credentials were inspected. No paid or remote call was made.

| Evidence | Command | Exit / result |
| --- | --- | --- |
| red-isolation.log | `npm test -- test/aiRegionJob.test.ts` (before extraction; graph rooted at existing runRegionTask) | 1; real forbidden dependency assertion failed |
| red-noop.log | `npm test -- test/aiRegionJob.test.ts -t 'no-op region'` | 1; 31 changed cells vs expected 0 |
| red-shared-replay.log | `npm test -- test/aiRegionJob.test.ts -t 'validated checkpoints'` | 1; real tool-result serialization mismatch |
| replay-investigation.log | `npm test -- test/aiRegionJob.test.ts -t 'allocated map IDs' --silent=false` | 1; exact region/provider/2 request difference printed |
| focused-final.log | `npm test -- test/aiRegionJob.test.ts test/aiSessionJobHost.test.ts test/regionTaskRun.test.ts test/regionTaskCompletedHouse.test.ts test/regionTaskHouseProtection.test.ts test/regionTaskClip.test.ts test/regionBlend.test.ts test/regionChangeSummary.test.ts test/regionSurroundings.test.ts test/regionAiPlacementHarness.test.ts test/buildPalette.test.ts test/buildPaletteClaimLayerHome.test.ts test/materialPolicy.test.ts --maxWorkers=2` | 0; 148 tests, 13 files |
| runner-contention.log | `npm test -- test/aiRegionJob.test.ts test/materialPolicy.test.ts test/buildPaletteClaimLayerHome.test.ts --maxWorkers=2` | 1; 22 passing assertions, onTaskUpdate RPC error |
| runner-serialized-failure.log | `npm test -- test/aiRegionJob.test.ts test/materialPolicy.test.ts test/buildPaletteClaimLayerHome.test.ts --maxWorkers=1 --no-file-parallelism` (before event acknowledgement) | 1; same RPC error, not considered green |
| region-final.log | `npm test -- test/aiRegionJob.test.ts test/materialPolicy.test.ts test/buildPaletteClaimLayerHome.test.ts --maxWorkers=1 --no-file-parallelism` (actual MessageChannel transaction acknowledgements) | 0; 22 tests, 3 files, no unhandled errors |
| typecheck.log | `npm run typecheck:app` | 0 |
| lsp.md | `lsp_diagnostics` per changed TypeScript file | no diagnostics; one busy-machine timeout followed by clean result |
| cleanup.txt | `ss -ltn '( sport = :19845 )'`; `git diff --check` | 0; no listener, no diff whitespace errors |

Additional development runs: initial focused run exited 1 on the remaining
turnGuide graph leak, an unchanged-tile fixture and the replay-order defect;
a corrected intermediate run passed 12 tests. The final regression and final
region commands above supersede these intermediate passes, not the recorded
failures. An initial tool-bootstrap attempt found no apply_patch executable and
therefore no test file; that no-tests exit is NOT counted as RED. Edits thereafter
used an `apply_patch` shell shim delegating unified diffs to `git apply`.

No full build/gates or browser suite was run: those are supervisor-owned. No
failing test was removed or skipped to obtain green. `-t` was used only to isolate
recorded RED/investigation cases; final commands run complete named files.
