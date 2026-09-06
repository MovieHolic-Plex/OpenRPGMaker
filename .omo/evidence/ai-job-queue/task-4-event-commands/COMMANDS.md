# Commands and observed exits

All commands ran in `/home/main/z-project/rpg-zzu-aiq-event-silver` on branch
`agent/aiq-event-silver`. No environment file was inspected.

| Command | Exit | Evidence/result |
| --- | --- | --- |
| `npm test -- test/eventCommandAssist.test.ts` before changes | 0 | characterization.log: 56 existing tests |
| `npm test -- test/aiEventCommandsJob.test.ts` before chat injection | 1 | red.log: real foreground HTTP escape and hidden retry, not an import failure |
| `npm test -- test/aiEventCommandsJob.test.ts` after adding disk host fixture | 1 | Initial fixture lacked repository attempt metadata; corrected test host, not product. Also identified real panel graph edge. |
| `npm test -- test/aiEventCommandsJob.test.ts` after correcting fixture | 1 | adapter-red-canonical.log: 12 pass, 3 fail (canonical ref equality, captured text guard, shared panel edge) |
| `npm test -- test/aiEventCommandsJob.test.ts test/eventCommandAssist.test.ts` | 1 | 70 pass, only strict shared panel graph still fails; ownership extension requested/approved |
| `npm test -- test/movieResourceKind.test.ts test/playMovieEditorBody.test.ts test/playMovieRuntime.test.ts` before extraction | 0 | movie-before.log: 31 existing tests |
| `npm test -- test/aiEventCommandsJob.test.ts test/eventCommandAssist.test.ts test/movieResourceKind.test.ts test/playMovieEditorBody.test.ts test/playMovieRuntime.test.ts` after extraction | 0 | 102 pass |
| `git diff --check && npm run typecheck:app` | 2 | EOF blank line found by diff check; typecheck not reached in this invocation. Blank line removed. |
| `npm test -- test/aiEventCommandsJob.test.ts -t 'rejects automatic application mode'` before mode guard | 1 | red-review-mode.log: one behavioral RED; other tests filtered by target |
| `npm test -- test/aiEventCommandsJob.test.ts test/eventCommandAssist.test.ts test/movieResourceKind.test.ts test/playMovieEditorBody.test.ts test/playMovieRuntime.test.ts` final | 0 | green-final.log: 103 pass, no failures/skips/unhandled errors |
| `npm run typecheck:app` final | 0 | typecheck-final.log |
| LSP diagnostics for all seven changed TS files | success | lsp.txt |
| `git diff --check` final | 0 | no output |
| `find /tmp -maxdepth 1 -type d -name 'ai-event-commands-*' -print` | 0 | no remaining directories |
| `ss -ltnp '( sport = :19844 )'` | 0 | no listeners |

The workstation has no installed `apply_patch` executable. Edits were applied through
an `apply_patch` shell function wrapping `git apply`; generated unified patches were
used for exact replacements. Two initial patch setup attempts did not create a test
file; their no-test-file exits were NOT counted as meaningful RED. The recorded
red.log is the subsequent actual behavioral failure.

Evidence logs retain command output with trailing whitespace/extra EOF blank lines
trimmed for the repository whitespace check. The first staged check found these
log-only whitespace errors; source whitespace was already clean. Explicitly restaged
normalized evidence and reran `git diff --cached --check` before committing.
