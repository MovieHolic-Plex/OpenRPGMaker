# Phase 2 authoring: lead-applied implementation and verification

Base: merged Phase 1 `d1d5e7e98dd0c6c5ef837db2a1456e280359be42`.
Worktree: `/home/main/z-project/rpg-zzu-wish-cinematics-p2`.
The implementation commit is the commit containing this report.

## Delivered behavior

Separate System-group Database tabs expose Opening and Game Over. Both use
one scene-authoring implementation with text/image/video, narration and optional
voice, timing, image motion, enabled/skippable flags, scene add/delete/order,
and game-over title/message/button labels/background.

Authored state is `project.system`, not `project.database.system`. Viewing and
selection do not create settings/history. Kind changes remain staged until
required media is valid; conversion does not leak image-only fields. Imports
prepare native media without store access and commit asset/profile/reference
atomically after request/project/scene freshness checks. Changes carry system
labels and discrete/coalesced history.

Preview uses the existing runtime player and fitted project-resolution surface.
It auditions disabled content without changing settings, reveals the player
before keyboard capture, and stops on Escape/Stop/Close/tab departure/project
replacement with surface/media/listener cleanup. The editor's Escape handler
precedes the runtime handler; Database remains open. Terminal menu presentation
is authored separately and is checked in the game, not falsely shown as part
of the sequence-only preview.

New modules are split by responsibility, preserving the public Actions/View APIs:
Actions 180 pure lines, ActionModel 53, MediaActions 139, View 224, MediaFields 141,
Forms 166, Controls 22, Preview 122. Existing global store behavior and noncinematic
tab caching are unchanged.

## Test-first and discovered defects

- Before UI implementation, actual public Database rendering failed in all
  three modes because `db-tab-opening` did not exist: assertion RED, exit 1.
- The initial generated test draft incorrectly used `database.system`; the
  lead corrected it against the actual Project type before capturing RED.
- A real store live-listener-Set case reproduced immediate disposal of a newly
  mounted controller during project replacement. RED became GREEN after the
  controller tracked the project already observed at subscription time.
- Real browser reload exposed an empty initial cinematic tab: Database creates
  tab DOM before attachment, but the view skipped read-only rendering while
  detached. A new public-renderer regression failed, then passed after allowing
  initial read-only construction while keeping mutation/preview guards active.
- The fake DOM does not reflect min/max attributes as properties. The test now
  checks the same actual HTML attributes and retains its runtime clamp checks;
  no product range rule or assertion was removed.

All source edits were applied by the lead with native apply_patch. Workers
returned bounded patches because their tool surface lacked that operation.
Patch-only completion was never treated as applied or verified code.

## Direct lead verification

| Check | Result |
| --- | --- |
| Media helper/picker plus three existing regression files | 84 passed; exit 0 |
| Final authoring/media/picker contract suite | 77 passed in three files; exit 0 |
| App typecheck and changed-file LSP | Exit 0 / no diagnostics |
| CSS budget/graph gate | Exit 0; no baseline changes |
| `npm run openwiki:index` | Generated current index; existing unrelated broken references remain |
| `npm run build` | Exit 0; app, player SDK and standalone bundles built |
| Actual editor E2E, retries disabled | 3/3 passed in one run, 6.6 minutes |
| Native media preparation browser probe | GIF/WebM/WAV decode, payload preservation, bad-media rejection and abort; errors=[] |

The final contract command was:

```sh
npm test -- test/databaseCinematics.test.ts test/cinematicMediaImport.test.ts test/databaseCinematicResources.test.ts
```

The passing real-editor command was:

```sh
DEV_SERVER_PORT=19035 E2E_RETRIES=0 E2E_FREEZE_DEV_SERVER=1 \
VITE_CACHE_DIR=.omo/vite-cinematics-e2e VITE_LEGACY_DB_URL= \
VITE_LEGACY_DB_ANON_KEY= VITE_LEGACY_DB_PROJECT_ID= \
VITE_AI_ACTIVITY_DISK_MIRROR=0 VITE_EDIT_ACTIVITY_DISK_MIRROR=0 \
npm run test:e2e -- test/e2e/database-cinematics.spec.ts --max-failures=1
```

Matrices: 1024x768 Beginner, 1440x900 Standard, 1440x900 Expert. Each exercised
real mode-specific menu entry, all three scene variants, actual file imports,
byte preservation, selection, ordering/undo/redo, disabled retention, game-over
fields, public serialize/deserialize and reloaded UI, keyboard preview stop,
native audio/video progression, and tab-change cleanup.

Native proof times were audio 0.135090/0.158781/0.171384 seconds and video
0.293189/0.270171/0.289185 seconds; all videos decoded at 32x24. Preview bounds
were inside the viewport. The exact receipts and screenshots are in
`test-results/database-cinematics-*/native-media-and-geometry.json` and adjacent
`opening-restored.png`, `game-over-authoring.png`, `sequence-preview.png`.

## Faithful fixture setup and preserved diagnostics

The tests use real local-only `?blankProject=1&aiBridge=0` sessions and assert
there is no live DB target. Remote REST writes are blocked and recorded. They
do not claim a remote LegacyDb save; the real project codec and restored UI
prove serialization/reload.

The blank-session `session-not-persisted` warning is intentional. Every raw
diagnostic is retained in `errors.json`; `fixture-diagnostics.json` recognizes
only autosave messages matching that actual coded state and zero retry count.
All three passing matrices have `unexpectedErrors: []`. Product warnings were
not removed or relabelled as successful saves.

Earlier failures are not passing evidence: the first test used a toolbar entry
absent in Beginner mode; the corrected test follows Tools there and the toolbar
in Standard/Expert. The initial codec assertion compared object-key order rather
than values; it now deeply compares restored settings, retaining array order.
Optional AI bridge/disk logging requests were disabled through existing flags,
not hidden from the error listener. A stale owned Vite process was identified
by PID/cwd and stopped before restarting the final test.

The successful Playwright run exited 0 and port 19035 was no longer listening.
All tests use isolated browser contexts. No user LegacyDb project was mutated.
Full repository gates and independent Phase 2 QA/review are separate final
steps; this report does not claim the whole user goal complete.
