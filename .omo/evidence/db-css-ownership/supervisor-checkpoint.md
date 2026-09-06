# Supervisor verification checkpoints

These are intermediate receipts, not final implementation or merge approval.

## Frozen original baseline

- Base: 49067218aebf889d98c2dc05be08231787483427.
- Checkout: /home/main/z-project/rpg-zzu-db-css-baseline-20260906.
- Command: npm run gates -- --json.
- Overall exit1; app typecheck exit0; CSS exit0; surface exit1.
- Vitest: 14457 total, 14273 passed, 169 failed, 92 failing files.
- Exact failing assertion identities: /tmp/rpg-zzu-css-baseline-20260906.json.
- Original Vitest JSON remains in the baseline checkout under .omo/.

## Independently verified first increment

- Commit: e80eb71089bbfb245b688e396ed65831eedc70b3.
- Frozen checkout: /home/main/z-project/rpg-zzu-db-css-verify-p1-20260906.
- Browser command: DEV_SERVER_PORT=10332 DEV_SERVER_NO_TLS=1
  E2E_FREEZE_DEV_SERVER=1 E2E_RETRIES=0 npm run test:e2e --
  --config playwright.db-css.config.ts --project firefox.
- Result: exit0, 4 passed in4.9m, no retries.
- Both1440x900 and1024x900: actual wheel reaches the lower animation control;
  target center hit-test succeeds before focus; header bounds stay fixed;
  stage remains at least280px. Stepper has32px total height, no inner
  border/radius/shadow at rest, hover and focus.
- Independent unit command: npm test -- test/databaseControlsNumberField.test.ts
  test/databaseModernControls.test.ts test/databaseNumericLabelTrust.test.ts
  test/databaseStudioV2.test.ts.
- Unit result: exit0, 4 files,53 tests passed.
- Test-file LSP: no diagnostics.
- Monitor receipts: mon_AQKJQM7ATS3RJV68 and mon_ME431E8WNCXR4P34.

## Independent extended run on the second working checkpoint

- Original implementation checkout was frozen; no source changes during this run.
- Fresh owned server:10333, PID1029004 at startup, same implementation checkout.
- Pre-run git diff --binary SHA256:
  aa593aed38bc6f96b312670155d7508eb3adb81c9d5e33deb97c03a80e5ba08b.
- Preserved source snapshot for subsequent isolated fixes:
  0a5808b165f7ab3948e5d081c139a7713c750736.
- Command: DEV_SERVER_PORT=10333 E2E_RETRIES=0
  PLAYWRIGHT_JSON_OUTPUT_FILE=/tmp/db-css-supervisor-extended.json
  npm run test:e2e -- --config playwright.db-css.config.ts --project firefox
  --grep 'numeric and native|animation lifecycle|equipment, navigation|rendered contracts reject|CRUD confirmation'
  --output /tmp/db-css-supervisor-extended-results --reporter list,json.
- Result: exit1,1 passed,4 failed,0 skipped,0 flaky; duration599612.851ms.
- PASS: numeric/native controls, including populated local Life change semantics.
- FAIL animation lifecycle: "Missing playback cell layer" in locator.evaluate.
- FAIL Equipment/preservation: Equipment-filter click exceeded15s while performing click.
- FAIL deliberate mutation contract: animation form locator.evaluate exceeded15s.
- FAIL CRUD/contrast: measured ratio3.7731219119938944 below4.5.
- Full JSON and failure artifacts are retained at the command paths above.
- Monitor receipt: mon_53CBH4JMPSW1XV2D.
- Full checkpoint gates timed out after30m (mon_NZEV3HZEDPEZNJ3T), without a
  completed Vitest JSON report. This is incomplete, not a pass.
- A materially different resource-constrained rerun,
  `taskset -c 0-3 npm run gates -- --json`, also timed out after30m
  (mon_FVFT6V1AZETHQ564). At23m49s process inspection showed the Vitest coordinator
  and recently created active workers; it was still executing tests, not proven
  deadlocked. No full-suite pass or regression count is inferred from this run.
- Independent split checks on the same frozen source: typecheck exit0/errors0,
  CSS exit0/no new violations, surface exit1 with6 failed/108 passed assertions.
  `databaseAllTabsRenderWalk` executed1 assertion and passed. The six failures
  are the existing event-editor snapshot identities recorded in milestone-2.md.
- Final-source whole-suite verification remains required. These intermediate
  timeouts must stay visible even if later verification completes.

## Independent final-candidate verification

- Immutable verification snapshot:376394f690d8f0c454cfb46633a9caad58772746.
- Checkout:/home/main/z-project/rpg-zzu-db-css-final-verify-20260906.
- The implementation's source-ready.json pins15 production/unit/gate/sentinel
  files. Browser harness and documentation may finish separately; any production
  change invalidates the corresponding candidate evidence.
- All49 changed CSS files parsed successfully with PostCSS.
- Product TypeScript diagnostics:actorRecordView, databaseEnemyStudio,
  databaseLifeCraftingView and databaseModal all returned no diagnostics.
- Independent contract command:npm test -- test/databaseCssOwnerProof.test.ts
  test/databaseRequiredSurfaceAxis.test.ts test/fontFamilyTokenGuard.test.ts
  test/databaseModalReopenLeak.test.ts test/databaseAllTabsRenderWalk.test.ts
  --maxWorkers=2. Result:exit0,5 files,24 tests passed.
  Monitor:mon_YQC5D931DRE8GRGE.
- Independent npm run build:exit0. App, player and standalone bundles completed.
  Monitor:mon_W826H8M05W7GFHRM. Existing build warnings were not suppressed.
- Final whole gates completed with
  `taskset -c 0-7 npm run gates -- --json`,60-minute budget,
  monitor mon_KREFCEV5E3GJE7HJ. Overall exit1, typecheck/CSS exit0,
  surface exit1 with the six known event-editor assertions and DB-axis PASS.
  Vitest:14471 total,14279 passed,177 failed. This is not an all-tests-pass claim.
- Assertion comparison found12 additional whole-suite failures across8 files,
  all STACK_TRACE_ERROR with durations near15/30/60s; four baseline failures
  were absent. The same eight files then passed94/94 on BOTH frozen baseline
  and candidate under identical maxWorkers2 focused commands. Full-suite-only
  timing sensitivity remains a disclosed limitation, not an invented green gate.
- Exact comparison:whole-gate-comparison.json. Focused machine reports:
  /tmp/db-css-newfail-baseline.json and /tmp/db-css-newfail-candidate.json.
- Final browser acceptance and fresh Ultrabrain approval remain outstanding.

## Review and preservation boundaries

- Ultrabrain initial request: st_01a07578, initial-review.md.
- Ultrabrain second request: st_01a075cc, review-2.md.
- Draft PR636 contains only the first verified increment at this checkpoint.
- Later remote verification found PR636 had already been merged outside this
  session at2026-09-06T10:23:46Z by MovieHolic-Plex, merge commit
  f882cac597bd19281638077064ebf0a3acd12660, carrying only e80eb710.
  This session did not issue that merge and did not receive final approval first.
- Product-only commit1aba4675 was subsequently pushed to the same feature branch,
  not added to the already-closed PR636. Its product files match verified376394f6.
  Remaining work must use a follow-up PR published only after final approval.
- Main integration preflight at5384e607 found only generated openwiki/INDEX.md
  conflicts for the product commit; DESIGN and growth-tree.css auto-merged.
  Preserve incoming changes and regenerate the index when integrating.
- Review2 repair worktree: /home/main/z-project/rpg-zzu-db-css-review2-fixes-20260906.
  The original implementation tree stays unchanged while its full gates run.
- No authored remote game data was modified. Browser fixtures were local-only.
- Screenshot pixel inspection is unavailable on both the original provider and
  independent aliyun/qwen3.8-max-preview image-read attempts. No pixel PASS is
  claimed. Retained screenshots supplement objective DOM/interaction evidence.
- CSS Biome LSP is unavailable; actual parsing/build/test results are separate
  from that environment limitation. No errors or tests were suppressed.
