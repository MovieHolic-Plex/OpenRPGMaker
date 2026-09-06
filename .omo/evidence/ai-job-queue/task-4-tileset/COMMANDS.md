# Validator commands and exit codes

All commands ran in `/home/main/z-project/rpg-zzu-aiq-tileset-silver`.
Source modifications used `/tmp/apply_patch` (the adopted executable wraps
`patch -p1 --forward`, so generated unified diffs were used). Initial discovery
found no PATH `apply_patch`; the wrapper's GNU diff syntax was established
before the behavioral RED. Missing-file/tool failures are not counted as RED.

## RED and development diagnostics

1. `npm test -- test/aiTilesetJob.test.ts` -> **1**, `red.log`.
   Actual native analyzer's transitive graph leaked four forbidden modules.
2. `npm run typecheck:app` -> **2**, `typecheck-initial.log`.
   Owned initial errors: section-vs-legacy-house kit narrowing; cluster failure
   reason inferred as too narrow a union. Both corrected, no suppressions.
3. `npm test -- test/aiTilesetJob.test.ts test/tilesetAiNativeAnalysis.test.ts test/tilesetAiNativeReviewModel.test.ts test/tilesetAiConversationSession.test.ts test/tilesetAiCpenClient.test.ts test/tilesetAiMetadataNormalizer.test.ts test/tilesetAiMappingRules.test.ts test/tilesetAiSetupMapping.test.ts test/structureKitEditorDialog.test.ts`
   -> **1**, `focused-initial.log`: 98 passed, 3 replay failures.
4. `npm test -- test/aiTilesetJob.test.ts -t 'executes.*cluster-edit'`
   -> **1**, `replay-diagnosis.log`: exact embedded tool-JSON ordering mismatch.
   The filter was a diagnostic invocation, not a skipped/removed failing test.
5. `npm test -- test/aiTilesetJob.test.ts`
   -> **0**, `focused-replay.log`: 25 passed after boundary canonicalization.

## Final validators

6. `npm run typecheck:app` -> **0**, `typecheck-final.log`.
7. `npm test -- test/aiTilesetJob.test.ts test/tilesetAiNativeAnalysis.test.ts test/tilesetAiNativeReviewModel.test.ts test/tilesetAiConversationSession.test.ts test/tilesetAiCpenClient.test.ts test/tilesetAiMetadataNormalizer.test.ts test/tilesetAiMappingRules.test.ts test/tilesetAiSetupMapping.test.ts test/structureKitEditorDialog.test.ts test/tilesetAiWorkspaceModal.test.ts test/tilesetAiTerrainExample.test.ts test/tilesetAiNativeReviewInbox.test.ts test/tilesetAiNativeReviewApply.test.ts`
   -> **1**, `focused-final.log`: 116 passed, 1 pre-existing workspace failure
   and the same focus-path unhandled rejection. All 28 adapter tests passed.
8. `npm test -- --config .omo/evidence/ai-job-queue/task-4-tileset/baseline.config.mts test/tilesetAiWorkspaceModal.test.ts`
   -> **1**, `preexisting-baseline.log`: 3 passed, identical failure and rejection.
   The config loads tracked changed production files from `git show HEAD:<path>`
   through a read-only Vite load plugin; no worktree reset or source edits.
9. `npm test -- test/aiTilesetJob.test.ts test/tilesetAiNativeAnalysis.test.ts test/tilesetAiNativeReviewModel.test.ts test/tilesetAiConversationSession.test.ts test/tilesetAiCpenClient.test.ts test/tilesetAiMetadataNormalizer.test.ts test/tilesetAiMappingRules.test.ts test/tilesetAiSetupMapping.test.ts test/structureKitEditorDialog.test.ts`
   -> **0**, `green.log`: final focused scope **104 passed / 9 files** in one run.
   This is the same nine-file focused scope as command 3, plus new adapter cases;
   the wider foreground failure remains separately recorded, not hidden.
10. Per-file `lsp_diagnostics(filePath, severity="all")` on every changed source
    and test: final **No diagnostics found**. `lsp.txt` records all paths.
11. `git diff --check`: initially found two extra EOF blank lines; those were
    removed as whitespace-only corrections after tests. The first staged check
    also flagged trailing blank lines in captured logs (exit 2); only those EOF
    blank lines were trimmed, retaining all validator output. Final check and staged
    `git diff --cached --check`: **0**, recorded in `cleanup.txt`.
12. `ss -ltn '( sport = :19846 )'`: **0**, no listener. No browser/server process
    was started for this lane; browser/build integration is supervisor-owned.

The selected committed evidence is RED, final GREEN/typecheck, replay diagnosis,
expanded regression plus baseline proof/config, this command log, LSP listing,
and cleanup. Intermediate logs remain local and need not be cherry-picked.
