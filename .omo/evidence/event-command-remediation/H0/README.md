# H0: event-driven remediation QA

Status: GREEN. Base ed276cd5; atomic commit subject `feat(qa): add event-driven event command remediation harness`.

Read `manifest.json` for exact APIs, consumer setup and limitations. `commit-receipt.json` is written after committing.

- RED: unsupported `eventCommand` at existing normalization seam, not an import failure.
- GREEN: 28/28 focused tests; native Chromium subscriptions, wrong-target/result discrimination, and actual zero listener/observer/timer counts.
- Player: dedicated export-shim `player.html`, real Enter/Z input, gold0->7 plus dialogue; wrong8 rejects after another real Z. No editor play.
- Editor: explicitly Firefox, real Confirm/Apply, Space reopen, Cancel, file chooser import/reopen. Amount7->8, rejected9, final8. All three requested viewport geometry checks passed.
- Verification: shipping player build exit0; focused compiler diagnostics0; LSP was supplemented because its last refresh timed out. Broad gates belong to lead.
- Cleanup: owned ports39879/39881 closed; contexts, temporary fixture, caches, build output and editor disk mirrors removed. Port9841 was already occupied and untouched.

## Integration constraints

No application source, DB content, cinematic operation, player lifecycle, wiki/Design or other worktree changed. The small companion `.d.mts` is necessary for strict TS imports of the new JS module. Common/troop/picker helpers are source-traced only; their units must verify their own fixtures/surfaces.

Use `toolbar-database` in expert mode. Select the focusable command head and press Space, not Enter. Scope duplicate form controls to the edit dialog. Map Confirm is only a draft; Apply is the save acknowledgement. For exact full-project observations, compare wire JSON, not normalized objects containing undefined keys.

Owned editor Vite must have an isolated cache and test-only Supabase config disabled, otherwise independent AI telemetry can attempt a write even when project persistence is disabled. The strict request guard blocks and fails any such attempt; it does not waive failures.

## Evidence and caveats

`red.log`, `green.log`, `player-final.log`, `editor.log`, `build-player.log`, `types-final.log`, `cleanup.log`, `editor-observation.json` and `player/*json` are the primary receipts. `diagnostics.json` documents unsuccessful setup/debug attempts without committing large raw fixture dumps. No failure is relabeled green.

PNG files remain ignored local evidence and are hash-listed in the manifest. This model could not inspect image attachments; geometry and real state/DOM predicates were verified, but no pixel-review claim is made. Optional local companion CORS failures remain visible in the successful editor log. Cinematic code stayed unchanged; no full cinematic scenario or broad gates were rerun.
