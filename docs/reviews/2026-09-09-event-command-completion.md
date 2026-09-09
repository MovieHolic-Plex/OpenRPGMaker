# Event-command completion handoff

Integration branch: `agent/event-completion-20260907`.
Base: `6c810f93b91e26359475f60d14c4e6a5eb397e51` (merged PR #654).
Production/test tree: `95513f0b009b4f22b106e931072129c07e3f317f`.
Subsequent commits add only the Ember persistence verifier and evidence.
Integration with newer main is explicitly outside this handoff.

## Delivered changes

- Battle events suspend for text, authored waits and fresh input in both gauge
  and strict flow. Cancellation owns its listeners/timers, stale responses do
  not resume an abandoned event, and dialogue settings return to the field.
- Authored system audio overrides persist in save slots and drive battle,
  victory, menu and shop playback, including silence and reset/default behavior.
- Editor support guarantees follow the completed hosts; EXP operands preserve
  variable mode. Social dialogue cancellation preserves session ownership.
- The legacy-test repair lanes include mounted editor fixtures, persistence
  completion signals, capture-only victories, chipset-scoped tree repair and
  rendering, deterministic interior checks and the corrected Ember encounter.

## Verification and the default-worker limitation

These are distinct runs; the focused result must not be presented as a new
passing full gate.

| Check | Observed result | Evidence |
| --- | --- | --- |
| Previous complete Vitest run at the production/test tree | 15,164 passed, 0 failed, 15 existing skipped; JSON `success: true` | `/tmp/resume0909/prev-gates-vitest-report.json`; started 2026-09-09 00:31:40 KST, after the 00:30 HEAD commit |
| Resumed supervisor `npm run gates` | exit 1; 15,156 passed, 8 failed, 15 existing skipped | `/tmp/resume0909/gates.log`, `.omo/gates-vitest-report.json` |
| Typecheck, CSS and surface within that gate | Each exit 0; zero application type errors; all 9 surface axes pass | `/tmp/resume0909/gates.log` |
| Failure-file diagnostic, unchanged tests and deadlines, one worker | exit 0; 44/44 passed across all five affected files | `/tmp/resume0909/focused-failures.json` |
| `npm run build` at the production/test tree | exit 0; editor, player and standalone bundles | `.omo/evidence/event-command-completion-20260908/final-build.json` |

The eight failures were in `databaseOverviewDashboard` (3),
`databaseOverviewTab` (1), `databaseViewToggle` (1),
`detsukuruBrandStrings` (1), and `storePersistence` (2). The JSON reporter retained
`STACK_TRACE_ERROR` rather than assertion values. Seven durations were
15.00-15.36 seconds and one synchronous scan took 18.00 seconds; the configured
test deadline is 15 seconds. The shared host was concurrently overloaded.
The unchanged single-worker diagnostic passed in one invocation:

```sh
npm test -- \
  test/databaseOverviewDashboard.test.ts \
  test/databaseOverviewTab.test.ts \
  test/databaseViewToggle.test.ts \
  test/detsukuruBrandStrings.test.ts \
  test/storePersistence.test.ts \
  --maxWorkers=1 --reporter=verbose --reporter=json \
  --outputFile=/tmp/resume0909/focused-failures.json
```

This supports a resource-sensitive timeout diagnosis, not a claim that the
default-worker gate is reliably green. No timeout, assertion, skip, baseline or
production code was changed to obtain the diagnostic pass.
Existing bundle size advisories remain visible.

## Real-surface evidence

Paths below are relative to
`output/evidence/event-command-completion/` in the integration worktree.
Most historical browser artifacts are local and ignored by Git, not attachments
available from a clean PR checkout. The Ember DB receipts are tracked.

| Scenario | Observation | Artifact |
| --- | --- | --- |
| Gauge and strict battle sequence | Text pages, fresh-key input, second choice, nested continuation, field writeback and keyboard recovery; no browser errors | `battle/supervisor-play/summary.json`, per-flow reports and screenshots |
| Both flows with reduced motion | Same sequence and authored waits preserved; no browser errors | `battle/supervisor-reduced-motion/summary.json` |
| Both flows abandoned during text, wait or input | Six cases pass; all contexts/observers disposed, zero pending observers | `battle/supervisor-teardown-{text,wait,input}/summary.json` and `cleanup.json` |
| Audio and manual save/load | Native playback, overrides, silence/reset and complete field-track restoration | `audio/player-qa.json`, `audio/README.md` |
| Chipset namespace boundaries | Six real-editor checks pass; foreign authored pairs/layers remain intact and Town replacement restores ground | `legacy-terrain/namespace-store/verification.json`, `browser-review.json`, `legacy-terrain/browser/namespace-fixed/` |
| Ember first encounter | Two enemies, two keyboard attacks, victory, 22 gold, 47 XP, level 1 to 3, authored tail and cleared path; zero runtime errors | `ember/SUMMARY.md`, `ember/report.json` |
| Ember remote persistence | Real save followed by fresh-process remote reload, identical payload hash and encounter references | `ember-db-20260909/save-receipt.json`, `reload-verification.json` |

Audio QA used Chromium's ALSA null device after physical-device failures.
Native decoding/events/gains were checked; physical-speaker listening is not
claimed. The campaign's composed per-test ledger is
`.omo/evidence/event-command-completion-20260908/legacy-ledger.json`.
The exact historical 158-failure ordinal-to-name payload was lost; no mapping
to that missing payload is invented.

## Persisted Ember project

Project id: `rpg-zzu-event-command-ember-20260908`.
The save preflight found zero rows. The real persistence path returned
`kind: saved`; project and mirror inserts returned HTTP 201.
An independent supervisor invocation of
`node scripts/ember-db-0909.mjs --verify` returned exit 0 with five successful
GET requests and zero remote writes.

The reloaded event resolves
`ev_forest_slime -> troop_slime_pair -> enemy_slime, enemy_meadow_slime`.
Both troop representations and the battler resolver retain the two enemies.
Counts are 5 maps, 13 tilesets, 29 events, 5 enemies, 5 troops, 1 actor and 8 items.
Reference validation has zero issues; lint has zero errors and three existing
herb-event `setSelfSwitch` support warnings.
The configured gallery project was not modified.
The target is now occupied: use `--verify`, not `--save`.

## Preserved work

The original `worktree-lucky-river-7904` still contains the separate September 6
reaudit harness, report and `openwiki/testing.md` edits. They are not part of this
integration branch and were not deleted, overwritten or committed by this resume.
In particular, the historical diagnostic harness's intentional failures are not
added to the shipping test suite.
