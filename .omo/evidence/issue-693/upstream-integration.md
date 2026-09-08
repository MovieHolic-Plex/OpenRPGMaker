# Issue 693 follow-up: exact upstream integration

Integration task: `st_01a08004`, 2026-09-08.
Branch: `fix/issue-693-reviewed-followup`.
First parent: `70df624438c4bf3a4c48ba3c723c89fe9b20a1cb`.
Merged upstream: `8ab349dfc21cb0c0c22a554f74a25bdeb05ab741`.
Merge base: `4c5edfb82254175aa997163a9bc5bd4ec0440916`.

This is a local integration merge, not final ultrabrain approval or a PR merge.
No branch/PR was pushed, opened or merged remotely. No remote project content
or the saved media QA project was changed by this task.

## Resolution and preservation

The only textual conflict was `src/assets/audioResourceCatalog.ts`: retain both
installed-pack availability imports and upstream's `getAudioAiDescription` import.
The former filters enumeration; the latter overlays descriptions only after
resources have been enumerated. Explicit project descriptions, including empty
strings, still precede AI drafts; AI drafts precede original metadata. MIDI
remains inspectable metadata with its existing new-assignment guards intact.

The host did not provide an `apply_patch` executable. The targeted unified patch
was applied through a shell `apply_patch` wrapper over `git apply --recount -`.
No reset, wholesale side selection, test weakening or baseline regeneration was
used. No additional behavioral correction was necessary in the exercised seams.

Reviewed automatic overlaps retain both sides:
- `assistantSession.ts`: appearance-generation handoff and initiating-session
  diagnostic ownership.
- `eventDraftValidator.ts`: equipment accepted as shop stock and structured
  diagnostic paths/field recovery.
- `databaseResourcePickerDialog.ts`: shared-appearance picture selection and
  MIDI row, input and confirmation guards.
- `commandBodyCore.ts`: shared face/bust selection and native spawn-field forms.
- Design/wiki additions and both sets of validator tests remain present.

Appearance projections preserve direct fallback fields and authored visibility.
The existing page control disables direct graphic selection when a shared
charset is linked; unlinking restores direct selection. The no-match/no-image
picker, common frame-crop helper and existing panel ownership were not rewritten.
Appearance schema/runtime changes, image generation, shared AI provenance and
already-merged shop fixes are retained from exact upstream, not an open branch.

A staged-tree blob comparison verified all 101 follow-up-only paths and all 112
upstream-only paths equal their respective parent. The original acceptance
ledger and media Supabase proof are byte-identical to the first parent. Every
`test/fixtures` path equals exact upstream, including its previously committed
surface-fixture changes; this task regenerated none.

## Narrow verification

LSP reported no errors for the five overlapping source files named above,
including the audio catalog (all severities requested there). `git diff --check`
and `git diff --cached --check` passed; the unmerged index was empty.

One Vitest run: **18 files, 237 tests passed, 0 failed**, exit 0, 198.52 seconds.
The repository's unchanged Vitest configuration was imported by an external
configuration that only sets `cacheDir` under `/dev/shm`. Command shape:

```sh
TMPDIR=/dev/shm/rpg-zzu-issue693-integration/tmp \
VITE_CACHE_DIR=/dev/shm/rpg-zzu-issue693-integration/cache \
NODE_DISABLE_COMPILE_CACHE=1 node scripts/run-vitest.mjs run \
  --config /dev/shm/rpg-zzu-issue693-integration/vitest.config.mjs \
  --configLoader runner --maxWorkers=1 <the tests below> \
  --reporter=default --reporter=json \
  --outputFile=/dev/shm/rpg-zzu-issue693-integration/narrow-tests.json
```

Tests (all under `test/`, suffix `.test.ts`):
- `audioInventoryDelivery`, `audioResourceCatalog`, `audioAiDescriptions`,
  `audioResourceSearchContract`, `audioDescriptionPickerSurfaces`,
  `audioDescriptionCommandSurfaces`, `unsupportedMidiAuthoring`,
  `audioDescriptionLifecycle`.
- `npcGraphicRecovery`, `characterAppearanceEditor`,
  `characterAppearancePreview`, `characterAppearanceSets`,
  `characterAppearanceRuntime`.
- `eventDraftValidator`, `eventValidationRecoveryFields`,
  `eventValidationDiagnostics`, `aiTurnAppliedAccounting`,
  `localDiagnosticSources`.

Local raw evidence: `/dev/shm/rpg-zzu-issue693-integration/` contains
`narrow-tests.json`, `narrow-tests.log`, `preservation.json` and the external
Vitest config. Tests exercise the real editor DOM/renderers, store lifecycle,
serialization and runtime projections with their existing boundary fixtures;
they are not native browser, production-build or final acceptance evidence.

## Baselines and remaining ownership

The lead reported a direct pre-integration surface measurement on exact
`8ab349df` at `/dev/shm/rpg-zzu-issue693-current-main`: 107 passed / 8 failed,
10 files (7 failed). Failing files are `databaseAllTabsRenderWalk`,
`eventEditorCommitProbe.baseline` (2 failures), `eventEditorFormSurface.baseline`,
`eventEditorInteractionSurface.baseline`, `eventEditorM2Surface.baseline`,
`eventEditorPortalSurface.baseline`, and `eventEditorShellSurface.baseline`.
CSS live-class checks passed. This is lead-supplied baseline evidence, not a
surface run performed by this child. The original `1959dec2e` full gate remains
lead-owned and was reported still running. Earlier measured failures in
`acceptance.md` remain untouched; no fixture expectation was generated to mask
any of these failures.

Full gates, production build, native QA and independent final ultrabrain review
of the complete merge commit remain lead-owned and unverified by this task.
PR 695's premature merge is not approval for this follow-up. The follow-up PR
remains intentionally withheld pending final review.
