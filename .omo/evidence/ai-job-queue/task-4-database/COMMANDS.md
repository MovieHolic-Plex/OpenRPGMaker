# Verification commands and exits

All commands execute in /home/main/z-project/rpg-zzu-aiq-database-silver.
Source/test/doc patches used /tmp/apply_patch (this workstation's wrapper accepts
standard unified diff, not Begin Patch syntax).

| Invocation | Exit | Evidence/result |
| --- | --- | --- |
| `npm test -- test/aiDatabaseJob.test.ts test/aiDatabaseGeneration.test.ts` (before new test existed, while resolving patch command syntax) | 0 | 24 unchanged foreground tests passed; not counted as RED |
| `npm test -- test/aiDatabaseJob.test.ts test/aiDatabaseGeneration.test.ts` (before product changes) | 1 | red.log: 2 malformed-record behavioral failures; 24 foreground passes |
| `npm test -- test/aiDatabaseJob.test.ts test/aiDatabaseGeneration.test.ts test/databaseAiGenerateDialog.test.ts test/databaseAiGenerateLazyImport.test.ts` (first implementation run) | 1 | focused-first.log: 9 failures from incorrect Project.resources access, 45 passes |
| `npm run typecheck:app` (first implementation run) | 2 | typecheck-first.log: TS2339/TS7006 at incorrect Project.resources access |
| Same four-file test command after assets.uploaded fix | 0 | focused-second.log: 54 passed |
| Same four-file test command after completed-proposal validation/extra tests | 1 | checkpoint-validation-failure.log: 2 JSON key-order-sensitive replay failures, 55 passed |
| Same four-file test command after canonical checkpoint comparison | 0 | focused-final.log: 57 passed |
| `npm run typecheck:app` (final) | 0 | typecheck-final.log |
| `git diff --check` | 0 | No whitespace errors |
| `ss -ltn '( sport = :19842 )'` | 0 | cleanup.txt: no listener |

Language-server tool checks on src/ai/databaseGenerationCore.ts,
src/editor/aiDatabaseGeneration.ts, src/ai/jobs/executors/databaseJob.ts and
test/aiDatabaseJob.test.ts reported no diagnostics. They were run before the final
typecheck. The initially missed Project.resources type error is why tsc evidence,
not LSP alone, is authoritative here.

Only compact RED/final GREEN/typecheck/LSP/cleanup evidence is selected for the
commit. Intermediate logs remain available in this worktree. No full gates,
build, browser acceptance, real provider operation or remote write was run.
