# Task17 verification and cleanup

Source base: c9739691fcb0ff078f54ac1ba2777e681f5c74ab.
Worktree: /home/main/z-project/rpg-zzu-tile-to-world/.omo/worktrees/spatial-ai-tools.
Branch: feat/spatial-ai-tools. Adopted with the repository worktree tool; allocated port 9841. No server was started.

## Commands and results

All test/type/CLI validations ran through:

`node /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/authoring-monitor.mjs 'flock /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock <bounded-command>'`

- `npm test -- test/spatialTools.test.ts test/spatialAiContext.test.ts`: initial RED 10 failed/4 passed because the actual registered tools/context were absent and generic malformed hierarchy was accepted. `red.log`; focused GREEN 14/14 in `green-core.log`.
- `npm test -- test/spatialLegacyTools.test.ts`: initial RED 4 failed/1 passed at actual canonical lookup/place/house-program/room-plan seams. `red-legacy.log`. Linked house/village occurrence tests additionally failed before canonical compiler wiring (`red-linked.log`).
- `npm test -- test/spatialToolAcceptance.test.ts`: actual store acceptance RED for equal-content foreign project replacement and stale generic map proposals (`red-acceptance.log`); additional genuine REDs for unissued snapshots and tampered validated results (`red-forged-snapshot.log`, `red-tampered-result.log`). No acceptance mock.
- The first combined related run (`green.log`) was NOT a passing run: 78 passed, one new registered-village reachability assertion failed. The 50 unchanged legacy checks passed: `placeConceptTool` 36/36, `interiorConceptRoutes` 14/14. Canonical nested rooms needed transitive actual-transfer inspection; this was repaired, not waived. Its source fixture explicitly authors ports/connections instead of inventing navigation from labels.
- Final `npm test -- test/spatialTools.test.ts test/spatialAiContext.test.ts test/spatialToolAcceptance.test.ts test/spatialLegacyTools.test.ts`: **30/30, 4/4 files, exit 0**, no skipped assertions. `verified-final.log`.
- Final `npm run typecheck:app`: **exit 0**, same monitored command in `verified-final.log`.
- Final `bun run scripts/qa/spatial-ai-tools.mts --evidence output/evidence/tile-to-world/task-17`: **exit 0**. Actual registered lookup -> upsert -> preview -> apply tool -> shared proposal acceptance. Two compiled bed occurrences, retained older occurrence, exact undo/redo, forged apply rejected. `tool-transcript.json` records actual arguments/results, source hashes and baseline/accepted hashes; `accepted-project.json` is offline fixture evidence, not shipped or remotely published content.
- LSP diagnostics returned no errors on changed TypeScript files. The last freshness request for `authorVillageScope.ts` hit the tool's existing 3000ms deadline (an earlier request returned no errors); no limit was inflated. Final app compiler exit 0 covers the final source and is the authoritative source-type check.
- `git diff --check`: clean.

The CLI emitted the existing headless activity-disk-mirror warning: `/__oprn/edit-activity: fetch() URL is invalid`. It is preserved in the log. This is not a DB publication success; remote persistence was disabled and all provider/DB environment keys used by the driver were blanked before dynamic imports.

## Queue interruption

`red-disconnected.log` is an INCOMPLETE queue attempt: only monitor registration occurred; Vitest did not start before the monitor timeout. An orphaned task20 PostgreSQL process retained the inherited validation-lock descriptor, while its cleanup was also queued for that lock. The task17 waiter PID 3340521 was verified to have this worktree cwd and terminated. No foreign process was signalled or reconfigured. Parent coordination was written to `task17-validation-queue.json` in the shared execution directory.

After process/lock inspection showed the lock released, the edge test ran once and genuinely failed because disconnected house rooms were accepted (`red-disconnected-executed.log`). Shared actual-transfer reachability now rejects before caller mutation. The final full task17 test run above includes its passing assertion; the interrupted queue attempt is not represented as RED or GREEN evidence.

## Cleanup and remaining ownership

No browser, preview server, DB row, remote project, provider conversation, temporary code probe, runtime asset or dependency was created. The only terminated process was the owned orphaned lock waiter. Final history state in the CLI is reset. Worktree environment adoption files remain ignored. Logs, the actual tool transcript and accepted local fixture are intentional evidence.

Real-provider Q6, proposal/browser images, UI integration, default/sample content, activation/publication and the combined integration build remain parent-owned. This lane does not claim those outcomes. In particular, linked canonical interiors require authored port connections; missing connections are an error, not permission to invent catalog navigation.

## Architectural review

New modules own tool schemas, detached proposal proof, discovery/actions, context projection, legacy source projection, linked-interior compilation or construction-scope checks. Each new source file is below 150 pure LOC. Existing oversized modules received only narrow entry/guard/registration edits; no unrelated refactor or suppression was introduced. `changeset.ts` (242), `houseKitDomain.ts` (221) and `toolRegistry.ts` (235) are in the existing warning band: further growth should extract the owning unit rather than add another domain.

Untrusted tool bodies cross the existing strict spatial parser/reference boundary; no new dependency, schema or untyped domain escape hatch was introduced. Builders alone mutate detached state. No project module imports editor code. Existing framework guarantees are reused, expected errors remain visible, and legacy arrays are not reseeded. Private editor memory is not a persistence authority. New behaviors have failing-first runner/adapter/acceptance tests, no timing sleeps or prose-pinning assertions. No speculative logging or hypothetical abstraction was added.
