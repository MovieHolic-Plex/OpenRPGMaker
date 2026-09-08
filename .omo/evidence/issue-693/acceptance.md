# Issue 693 acceptance ledger

Source: https://github.com/MovieHolic-Plex/rpg-zzu/issues/693

Base: `1959dec2eb0a268b0cf3bab9eee63be57d5a6ab6`

The repository owner authorized an isolated worktree, a pull request, deep-agent
fixes, repeated ultrabrain review until approval, and merge after approval.
Reports below are claims to reproduce, not established defects.

| ID | Scope | Acceptance evidence required | Status |
| --- | --- | --- | --- |
| OUT-001 | Accepted media persistence | Within-limit audio survives reload; Test Play launches; durable success and actionable quota failures; failed-write coverage | Real Supabase save/reload and independent Test Play passed |
| OUT-002 | Audio inventory and playback | Visible entries resolve; missing media returns 404; pickers agree; autoplay versus load/decode errors; range and service-worker coverage | R2 repair integrated; final-tree recheck pending |
| OUT-003 | Private DELTA persistence adaptation | Explicitly excluded from the upstream package | Excluded |
| OUT-004 | Private DELTA implementation plan | Explicitly excluded from the upstream package | Excluded |
| OUT-005 | Assistant-aware viewport | Reachable map edges, useful centering, preserved focus/zoom, aligned editing coordinates | Direct browser passed |
| OUT-006 | Ctrl+wheel zoom | Both directions, existing limits, pointer anchor, unchanged plain wheel and keyboard controls | Direct browser passed |
| OUT-007 | Character asset no-match | Recoverable result, explicit recovery/cancel, preserved data, no dangling references, empty/incompatible catalog coverage | Direct tests and recovery round-trip browser passed |
| OUT-008 | Canvas navigation | Synchronized X/Y scrollbars, accurate thumbs, neutral empty-space pan, correct coordinates after zoom/resize | Direct browser passed |
| OUT-009 | Consented diagnostic export | Explicit local opt-in, preview/section selection, provenance, confirmation, sanitized Markdown/JSON, cancellation without artifacts, no network send | Direct tests and browser passed |
| OUT-010 | Opt-in authoring/Test Play diagnostics | Off by default, bounded session, visible stop/clear, allowlisted receipts, retention/redaction/injection/performance tests | R2 repairs integrated; final-tree recheck pending |
| OUT-011 | Event validation handoff | Stable code/path/field/cause/hint, nested command focus, unsent assistant draft, sanitized Markdown/JSON copy | Both field-focus follow-ups integrated; final-tree recheck pending |

## Boundaries

- Preserve the canonical Supabase project-storage contract. Do not introduce a
  local canonical project database or weaken its regression guard.
- Do not capture actual private session data during investigation. Diagnostic
  features require an explicit user action and remain local and off by default.
- Do not absorb unrelated work from pull requests 687 or 694.
- Reuse the existing editor component system and ownership boundaries.
- A passing unit test or agent report alone is not final acceptance. The lead
  runs the relevant real surfaces, repository gates, and production build.
- Final ultrabrain approval must identify the reviewed commit. Subsequent fixes
  require renewed review before merge.

## Review and verification

Draft PR: https://github.com/MovieHolic-Plex/rpg-zzu/pull/695

Initial independent ultrabrain review: `st_01a07f81`, completed with specific
change requests forwarded to every deep lane. Existing audio enumeration,
camera overlay awareness, alternative pan gestures, typed graphic failures, and
navigable event validation are reuse points, not new systems to duplicate.

The lead ran `npm run gates` on unchanged source. It timed out after 30 minutes
without producing a Vitest JSON report; this is not a pass. Separated baseline
checks:

- CSS: exit 0, budget 0, graph 0, no baseline regression.
- Typecheck: exit 0, errors 0, files 0.
- Surface: exit 1 because `ENOSPC: no space left on device, write` truncated its
  Vitest JSON report, causing `Unterminated string in JSON at position 3542`.
  Root filesystem had 45 MB free, while `/dev/shm` had 47 GB free. A new run uses
  an isolated TMPDIR and Vite cache under `/dev/shm/rpg-zzu-issue693-lead`.
  That run completed with 108 passed / 7 failed tests in 10 files (6 failed):
  `databaseAllTabsRenderWalk`, `eventEditorCommitProbe.baseline` (2 failures),
  `eventEditorFormSurface.baseline`, `eventEditorInteractionSurface.baseline`,
  `eventEditorM2Surface.baseline`, and `eventEditorPortalSurface.baseline`.
  CSS live-class checks passed. These are measured pre-change failures, not
  waived regressions or regenerated fixture expectations.
- Independent initial editor boot: real Playwright Chromium, 1440x900, no page
  errors, canvas 1134x777, no scrollbar elements. Screenshot:
  `output/evidence/issue-693/baseline/editor-1440.png`. This establishes initial
  rendering/DOM geometry only, not final behavior or visual approval.

| Area | Deep task | Isolated branch | Explicit QA port |
| --- | --- | --- | --- |
| OUT-001 | `st_01a07f84` | `fix/issue693-media` | 38421 |
| OUT-002 | `st_01a07f85` | `fix/issue693-audio` | 38422 |
| OUT-005/006/008 | `st_01a07f86` | `fix/issue693-navigation` | 38423 |
| OUT-007 | `st_01a07f87` | `fix/issue693-assets` | 38424 |
| OUT-009/010 | `st_01a07f88` | `fix/issue693-diagnostics` | 38425 |
| OUT-011 | `st_01a07f89` | `fix/issue693-validation` | 38426 |

The lead integration tree uses port 38420. Worktree adoption copied the occupied
9841 port into every lane; all QA commands must override it and use isolated Vite
caches. The kernel WebView could not launch from its worker thread, so the lead
uses the repository's existing Playwright Chromium instead.

## Integrated increments

- `4c5edfb82`: character no-match recovery.
- `58943746e`: verified media save-copy promotion.
- `6b03b6eb7`: audio delivery and playback lifecycle.
- `7c22df927`: local diagnostic sessions and confirmed exports.
- `accea8f12`: preserve authored visibility through no-image/manual round trips.
- `a1597c666`: unified authoring viewport navigation.
- `49edb33ba`: structured event diagnostics and unsent handoff.

Lead-run tests: 9 files / 82 tests passed for initial media/assets; then 22 files /
240 tests passed for integrated audio/diagnostics and persistence interactions.
Integrated CSS budget/graph passed. Changed-file LSP error checks passed.

Lead audio replay: `/dev/shm/rpg-zzu-issue693-lead/audio/results.json`.
Cold/warm/suffix/416 Range cases and missing-media 404 passed. First-click native
engine BGM was playing with positive volume; all 9 advertised playable BGM
returned audio bytes and decoded; native missing-media error was
`NotSupportedError` / media error 4. MIME alias bytes were unchanged.

Lead diagnostic replay: `/dev/shm/rpg-zzu-issue693-lead/diagnostics/qa.json`.
Consent, edit/save receipts, real Test Play movement/collision/event/transfer,
cancelled export, confirmed JSON/Markdown downloads, clear and reload-off passed.
The disabled probe made 1,000,000 checks/publications with zero payload reads
(3 ms on this run, not a cross-device performance guarantee). Seven screenshots
cover desktop consent bounds, recording, previews, and confirmation.

Lead character follow-up: 4 files / 30 tests passed. Native Firefox replay at
`/dev/shm/rpg-zzu-issue693-lead/assets-roundtrip/recovery-1280.json` proves no-match,
cancel, no-image, save, reopen, manual selection and final save. Visibility is
`hidden: false`, with a People1 frame 34 marker; dialogue and name are preserved.

Lead navigation replay: 51/51 passed across 1024x768, 1280x800 and 1440x900,
with large/small maps and layout/zoom/pan/editing cases. Evidence:
`/dev/shm/rpg-zzu-issue693-lead/navigation/results.json`. Related tests:
133 passed / 1 pre-existing failure at `mapSurfaceFocus.test.ts:99` (fake-DOM
history ownership). The owner, hotkeys, test and fake DOM are unchanged from
base; the base reproduction is in the navigation lane evidence.

Event field-focus follow-up `st_01a07f89` covers native spawnFieldEnemy editing
and page-level custom-route step focus; those are required, not deferred.
Second ultrabrain review `st_01a07fd5` uses locked
`/dev/shm/rpg-zzu-issue693-review-r1` at
`49edb33ba7c63b7ed2a47007dd3124a759989641`. It is an incremental change-request
review, not final merge approval. A root-filesystem checkout failed with ENOSPC
and Git cleaned it up; the review copy was created successfully in `/dev/shm`.

That review requested three additional P2 repairs:

1. MIDI preview is disabled, but unsupported MIDI can still be newly assigned
   through database/map pickers and event dropdowns.
2. Local asset-stage receipts discard `ok`, making load success/failure identical.
3. Late boot callbacks can publish into a different newly consented session.

Deep follow-ups: `st_01a07fdb` (audio) and `st_01a07fdc` (boot diagnostics).
The original completed workers had been evicted, so these new workers reuse their
existing isolated branches. No approval was given.

Lead initial event replay passed at all three desktop widths with zero page
errors and zero observed assistant sends:
`/dev/shm/rpg-zzu-issue693-lead/validation/report.json`. Related tests were
123 passed / 1 existing modal-stack teardown failure (expected 0, observed 2).
The two explicitly identified field-focus follow-ups still remain required.

The full original-source gate is being retried in
`/dev/shm/rpg-zzu-issue693-baseline`, pinned to `1959dec2e`, with compile caching
disabled, memory-backed temporary files and CPU affinity 0-3 (Node reports 4
available CPUs). Its separate measurement destination is
`/dev/shm/rpg-zzu-issue693-lead/measured-base-gates.json`; tracked baselines and
snapshot fixtures are not overwritten. This is pending, not a passing gate.

Remote media acceptance:

- Initial browser/harness attempts failed before writes. Firefox omitted large
  intercepted POST bodies; a native Chromium GET-relay guard repair was integrated
  as `af43585d5`. The lead ran its 6 Node guard tests successfully.
- Direct browser access to the external API failed even for GET, while Node and
  the existing same-origin proxy could read it. The failed target
  `oprn-c2c5a609da` was confirmed absent. No repeated saved copies were created.
- A QA-only process enabled the existing Supabase proxy and supplied the existing
  anon key only through process environment, without changing environment files.
  It saved one new project, `oprn-f51b995ac9`: project row, 16 maps, 13 tilesets.
- The automated runner verified reloaded identity/bytes/hash, then timed out
  observing the Test Play canvas. This failed run remains recorded, not relabelled.
- The lead independently reopened that same saved project in another browser
  context, verified all 8,388,608 bytes against the original WAV SHA-256, clicked
  the actual Test Play button and observed engine ready in 6,022 ms with a visible
  320x240 canvas. This independent reload/play made zero additional remote writes.
  See `media-supabase-proof.json` and
  `/dev/shm/rpg-zzu-issue693-lead/media-existing-play.png`.

Integrated follow-ups:
`ecc14ce31` (MIDI assignment), `fd3c45300` (boot outcomes/ownership),
`5dc8c4303` (spawn/page-route recovery). Their final-tree checks remain pending.

## Early merge and follow-up boundary

PR 695 was already merged by `MovieHolic-Plex` at `2026-09-08T06:40:40Z`,
commit `17d08fbd895500adba89cb4dc55d3d246a8b1367`, containing only the initial
ledger and `4c5edfb82` character patch. The lead did not execute that merge and
had not granted final approval. Later branch pushes did not update the closed PR.

The remaining work moves to `fix/issue-693-reviewed-followup`, reconciled with
main `8ab349dfc21cb0c0c22a554f74a25bdeb05ab741`. No new follow-up PR will be opened
until its exact complete commit has passed final review, avoiding another
premature merge. Already-merged upstream changes are preserved; open unrelated
branches are not imported.

No final ultrabrain approval or merge is claimed yet. Screenshot files and DOM
geometry exist; these text-only models have not supplied image-based approval.
