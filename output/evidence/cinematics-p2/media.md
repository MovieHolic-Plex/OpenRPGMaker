# Cinematic media selection and preparation

## Lead application and verification

The lead applied the test and production patches with the native apply_patch
tool. Existing-picker assertion RED was reproduced before production edits:
expected movie-upload/profile-movie IDs, received an empty list, exit 1.
The separate absent-module helper baseline is not counted as assertion RED.

The applied implementation passed the complete five-file command below:
**84 tests passed, exit 0** (48 preparation, 4 cinematic picker, 32 existing
regressions). `npm run typecheck:app` exited 0. LSP reported no errors in the
helper, picker, rule module and both new tests.

A second assertion RED showed decoded video with an as-yet-unknown positive
duration was rejected. The helper now accepts that video after first-frame data
and valid dimensions, while preserving invalid audio/dimension checks; the same
complete test command passed afterward. This avoids imposing an unrelated finite
video-length requirement on imports.

The existing rule function gained type-only overloads for its three guaranteed
media kinds, avoiding non-null assertions without changing resource-manager
behavior. MIME lookup is checked at the file-input boundary. No current project
is read or changed by preparation. Native codec/UI use is covered by the following
authoring and browser-QA stage, not claimed from controlled-event unit tests.

Commit: the commit containing this report, resolved with
`git log -1 -- output/evidence/cinematics-p2/media.md`.

## Original patch handoff

Task st_01a075de supplied a patch because apply_patch was unavailable.
Inspected base: d1d5e7e98dd0c6c5ef837db2a1456e280359be42.
No commit was created by the child. Applied-code verification and commit are
lead-owned; this handoff does not establish patch GREEN.

## RED / GREEN

- Actual existing-picker RED: Vite SSR invoked
  listDatabaseResourceOptions("movie", project) with one movie upload and one
  movie profile. Expected ["intro", "profile-movie"]; actual []; assertion exit 1.
- Reproducible test-only RED command:
  `npm test -- test/databaseCinematicResources.test.ts -t "lists project movie profiles and uploads once"`.
  This test imports the existing picker, not the new helper.
- The helper test's pre-source baseline is an absent-module error, not the
  meaningful picker assertion RED above.
- Unchanged-base regression command named both new tests plus
  databaseResourcePickerDialog, resourceManagerImageImport and movieResourceKind.
  Exit 0, 32 existing tests passed; the two new files were absent and not tested.
- Unchanged-base typecheck:app exited 0. LSP found no diagnostics in the existing
  picker and image/media import modules.
- Patch GREEN command:
  `npm test -- test/cinematicMediaImport.test.ts test/databaseCinematicResources.test.ts test/databaseResourcePickerDialog.test.ts test/resourceManagerImageImport.test.ts test/movieResourceKind.test.ts`.
- Then run `npm run typecheck:app` and LSP on the four changed TypeScript files.
  Record actual results and the commit after application. Native codec/browser
  verification is separate from the controlled-event unit tests.

## Exact API

    prepareCinematicUpload(file: File, kind: "image" | "video" | "audio", signal: AbortSignal): Promise<UploadedAsset>

Returns picture/movie/sound with existing ID/name conventions. Reuses 4/8/32 MiB
image/audio/movie limits. Preserves payload bytes, including animated GIF/WebP.
Rejects unsupported, empty, unreadable, undecodable, cancelled or timed-out input.
A 15-second deadline bounds the whole preparation. Cleanup aborts active reading,
removes handlers/deadline and releases native image/media sources. No playback,
project mutation or immediate resource-manager import occurs.

Authoring must abort obsolete work and check project, scene and request identity
after await, before one labelled asset/profile/scene history transaction.
Picker kinds are image/movie/sound. Movie profiles/uploads are selectable without
image probes or another player; playCinematicSequence owns playback.
