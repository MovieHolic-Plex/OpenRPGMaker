# Lead verification ledger

This ledger distinguishes completed checks from pending real-surface work. A
pending row is not an approval. The final review must use the final integrated
revision and updated evidence, not only the earlier core checkpoint.

## Completed evidence

The review candidate includes latest main through `147218a2` in merge
`f9193cc67`. After that merge, the full production build, strict release-script
typecheck and 153 focused Vitest tests passed. The resulting runtime
`cd0a7b861dee8393b996655448689ee7c2ae40cf8d0c81c614c4372431bec078`
was packaged and exercised through real offline boot/movement with exit 0.
Candidate reports are `.omo/release-candidate-tests.json` and
`verify-shots/release-candidate/`. The intervening main changes concern BGM
packaging and event-placement recovery; the publishing UI and community route
source used by the full interaction evidence below are unchanged.

| Scenario | Lead command / artifact | Observed |
| --- | --- | --- |
| Stable identity, Save6 isolation, legacy codecs | Locked review tree at `204ba0077`; `npm run typecheck:app` and five focused test files | Exit 0; 40 tests passed |
| Integrated project/export/save/archive/UI contracts | `.omo/release-integrated-tests.json` | Exit 0; 141 tests passed in 22 files |
| Full editor, web player, standalone and archive build | `npm run build` on the integrated tree | Exit 0; retained runtime `58f3342e7a0bd3bdf7b06fd401d1557d7f656431208348fd7b53d86f370b52c5` |
| Real retained offline HTML boot and movement | `node scripts/qa-release-offline.mjs verify-shots/release-artifact/release.html` | Exit 0; `(10,8)` to `(11,8)`, no HTTP requests or runtime errors |
| Community test discovery, clean build, SQL, HTTP and browser | `npm run test:node -- communityReleaseIntegration` | Exit 0; 12 passed, 0 failed, 0 skipped |
| Community production compilation | `community-site/node_modules/.bin/next build --webpack` with private local PostgreSQL | Exit 0 |
| New migration against an existing schema | Private PostgreSQL16, migrations 0001-0005 followed by 0006 | Exit 0; no shared database used |
| Development archive regression | `.omo/release-dev-repair-tests.json` | Exit 0; 19 passed; archive writes excluded from HMR and verified retained defaults reused |
| Rebuilt production artifacts after development fix | `npm run build` | Exit 0; retained runtime `0e26956353a269081d51ca78eb12a26b3a2ae8c52b3ff1faa6458cbbed2ef302` |
| Actual editor export and shipped gameplay | `npm run qa:export -- --editor-url <owned-local-server> --api-transport --publication --out verify-shots/release-editor-owned` | Exit 0; all 8 rows passed |
| Actual community RPG release | `node scripts/qa-community-release.mjs <private-local-community> verify-shots/release-versioning-final/game.zip verify-shots/release-community-verified` | Exit 0; upload, byte-identical download, battle, save and reload passed |
| Actual publication controls | `node scripts/qa-publication-controls.mjs` | Exit 0; staged upgrade, cancellation/focus, fork cancellation, explicit apply and predecessor acceptance passed |
| QA observer regressions | `npm run test:node -- exportPlayability` | Exit 0; 29 passed, 0 skipped |
| Final app type gate | `npm run gates -- --only typecheck` | Exit 0; 0 errors |
| Final CSS gate | `npm run gates -- --only css` | Exit 0; budget and graph passed |
| Final surface comparison | `npm run gates -- --only surface` | Exit 1; exactly the same 7 failures in 6 files as merged main; no additional failing axis |

Community integration evidence from the lead's run:
`/tmp/oprn-release-evidence-Os47RZ`.
Those 12 checks use a minimal trusted executable fixture and prove the real
Next upload/route/storage boundaries. The separate actual community RPG run
above verifies the full engine under the community CSP, not that minimal stub.

The editor's eight passing rows cover actual menu downloads and release
integrity, root/nested HTTP and offline HTML gameplay, corrupt standalone script
rejection, missing declared runtime PNG rejection, and editor Test Play. Each
gameplay row reaches the quest, four decoded visible party sprites, battle
victory, map transfer, save, reload, and further movement. Both rejection rows
prove that the injected request was intercepted and no download occurred.

Actual community release:
`12b00715bec0527960bf950a66e00fb2351ae54b5d351a6949af686eb0eaca8a`.
The report at `verify-shots/release-community-verified/report.json` proves equal
upload/download SHA-256 and exact saved/loaded state, with zero resource
failures and zero uncaught runtime errors. Screenshots accompany that report.

The publication-controls report is `verify-shots/release-controls/report.json`.
The 440-pixel-wide dialog remained inside both 1440x900 and 1024x768 viewports.
Upgrade staging and cancellation preserved the live original; cancellation
restored the project-menu opener. Fork cancellation preserved the original game.
Applying an upgrade kept the game ID, changed the runtime and save lineage,
and accepted the explicitly selected predecessor.

## Remaining review and validation limit

| Scenario | State / required evidence |
| --- | --- |
| Full gate | Unresolved: initial clean run timed out; final fixed-tree run was cancelled before producing a report when the JS worker restarted |
| ultrabrain approval | Pending; Draft PR #677 is open and must not merge before approval |

## Environment observations

The first normal-Chromium editor QA failed waiting for `edit-canvas`. An
independent browser comparison showed Firefox successfully rendering the
editor, while Chrome reported repeated `ERR_NETWORK_CHANGED`. Vite also
reported transient `ENOSPC` during dependency optimization; a later filesystem
measurement showed 7.3 GiB available and ample free inodes.

The successful editor run uses the existing `--api-transport` option, which forwards
actual server responses through Playwright's API transport. It does not mock
responses or relax assertions. Original failed evidence remains in
`verify-shots/release-versioning/results.json` and the subsequent attempt
directories. The successful run owns the editor process lifecycle until QA
finishes, avoiding cross-kernel process loss.

QA corrections were proved with failing regressions, not relaxed assertions:
the fixture now explicitly selects sideview when requiring four actor artworks;
the inspector decodes actual CSS sprites and idle strips; failure injection
selects a declared runtime dependency; and full request URLs remain intact for
exact prior-decode/media-cancellation matching.

The cancelled full gate left 38 processes scoped to the owned review/baseline
worktrees. The lead terminated those process trees. No shared worktree processes
were targeted, and the cancelled run is not counted as a pass.

Baseline failures and limits are recorded separately in `BASELINE.md`.
Large-chunk, mixed dynamic/static import and unresolved-at-build forest-image
warnings remain visible; no warning is suppressed.
