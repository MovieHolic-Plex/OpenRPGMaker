# Character appearance sets v1 — verification

## Delivered scope

Database > Party > Character appearance provides named, searchable, duplicable
sets with a description, manual walking charset/cell, face and optional bust.
Actors and event pages link to a set without overwriting their direct graphics.
Referenced sets cannot be deleted. Legacy and partial records remain usable.

AI produces detached face/bust candidates only. Walking graphics are never
generated or modified. Apply is explicit, replacement is a human action, and
error/cancel/stale-target paths preserve existing artwork. The assistant opens
the same DB workflow and reports a request rather than a false applied write.
World/lore coupling, expression variants and cutscene automation are excluded.

## Behavioral evidence

| Criterion | Evidence |
|---|---|
| Data shape, references, legacy and persistence | `output/evidence/appearance-sets/data-*.log`; lead `data-lead.json`: 30 tests passed |
| CRUD, retained search/IME, duplication, actor/page binding and lifecycle | `editor-red.log`, `editor-lifecycle-red.log`, `integrated-tests.json`; lead integrated suite: 91 tests passed |
| Real editor controls, upload, deletion guard and save/load | `editor-actions.json`; `editor-1024.png`, `editor-1280.png`, `editor-1440.png` and action-region captures |
| Real face generation | `ai-actions.json`, `ai-candidate.png`, `ai-applied.png`: HTTP 200, one reference, decoded 1024x1024 candidate, manual charset bytes/cell unchanged |
| Real bust generation and explicit replacement | `ai-bust-candidate.png`, `editor-final-complete-set.png`: HTTP 200, two references, old bust retained until Apply, other slots unchanged |
| Error, cancellation and stale edits | `ai-actions.json`: HTTP 503, deferred cancelled response, edited target; no artwork mutation |
| Actual SDK image references and Ask-mode handling | `ai-*.log`, lead integrated tests, and lead `bun test test/ohMyPiComplete.bun.test.ts`: 12 passed |
| Shipped-player behavior | `verify-shots/runtime-qa/character-appearance-sets/SUMMARY.md`: six beats passed, zero errors; `capture-states.json` proves full dialogue, portrait modes and uploaded frames |
| Bundled-ID editor preview and map projection | `preview-map-red.json`, `preview-green.json`: 14 passed including existing map regressions; `bundled-preview-proof.json`, `bundled-event-preview.png`, `bundled-map-preview.png` |
| Actual custom dropdown focus | `editor-actions.json`: genuine option-click RED then GREEN; the earlier hidden-native-select oracle is explicitly invalidated |

## Checks

- Lead app typecheck passed on the data increment and on final editor corrections.
- Full `npm run build` passed for app, player and standalone bundles.
- Editor-only corrections were followed by fresh typecheck and `build:app`.
- Changed TypeScript source diagnostics passed. CSS/JSON Biome LSP is unavailable;
  actual CSS compilation and repository gates are the validation paths.
- `node scripts/openwiki-index.mjs --check` passed. The canonical generator was
  run with its file writer captured, then its exact output applied as a patch.
- The repository-wide `npm run gates -- --json` at checkpoint `3647d7c8`
  exited 1: 14,283 passed,
  244 failed and 15 pre-existing pending tests. Typecheck and CSS passed.
  This is not presented as a green repository-wide gate.
- A detached `49067218` comparison ran 58 selected files: 563 passed, 40 failed.
  `gate-classification-report.md` records inherited failures and the exact
  appearance additions. Only those additions were applied to the surface
  fixtures; floors, allowlists and unrelated failing snapshots were preserved.
- The 24 full-run-only files passed all their assertions in the 35-file current
  comparison (359 passed), but the command exited 1. An error-preserving rerun
  identified the appearance controller's eager import, an unchanged invalid
  mocked HTTP 204 response, and a Vitest worker RPC timeout. The controller now
  loads only in its actual tool branch. Unrelated fixture/runner errors were not
  suppressed or repaired under this feature task.
- After those corrections, the final focused run passed **179 tests in 21
  files**, with zero failures, zero pending tests and exit 0:
  `output/evidence/appearance-sets/final-focused.json`.
- Final CSS budget, dependency graph and live-class checks passed, exit 0.
- Final `npm run build` passed, exit 0: application (1,468 modules), player
  (543 modules), and standalone player (545 modules). Existing font/resource
  resolution and chunk-size warnings remain; no build error was suppressed.

### Regression corrections after the full gate

The appearance tool now has the registry's literal-name declaration and an
explicit activity family. Its generated catalog and sidebar test-ID map are
synchronized. The name-entry fixture supplies a real Project rather than an
invalid partial cast. Appearance-only form, interaction, commit and shell
expectations were added without absorbing inherited AI queue/species drift or
changing floors/allowlists (`surface-owned-delta-proof.json`).

The session now loads the image controller on demand. The load-recovery tests
keep their original minimal mocks, await the actual rendered signal, and
compile the large app graph in bounded setup before timing interactions.
No sleeps, polling, skipped tests or relaxed interaction deadlines were added.

## Environment and cleanup

The editor QA used an isolated headed Firefox context at a private local port.
Headless/cold-start requests intermittently aborted on this workstation. Real
image responses were relayed unmodified through Playwright APIRequestContext
after the first direct browser request aborted; both provider responses were 200.
No main browser profile or user project DB row was modified.

Editor browsers, dev servers, image workers and owned Xvfb displays were closed.
Player probes close their browser/server and remove temporary fixtures in
`finally`; the final bundled-preview probe also exited cleanly. Source worktrees,
the durable notepad and captured evidence are retained intentionally.
The detached pre-task comparison worktree was removed after its evidence was
copied; it had no source changes.

## Review

Self-review covered the diff, typed boundaries, direct-field/session precedence,
resource aliases, actual popup focus, candidate lifecycle, source-image
immutability and evidence completeness. This was bare ULW, not an ulw-plan
reviewer-gated run. Screenshots and DOM geometry were captured; no Lighthouse
score or pixel-perfect visual-review approval is claimed.
