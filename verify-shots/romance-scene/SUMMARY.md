# Romance first conversation — evidence

The implemented scope is romance alone → talk → one relationship → first scene. Other interview routes retain their existing authoring path. This does not prove general game generation or arbitrary free-text requirement comprehension.

- `contract-proof.json`: production tool dispatch, first dialogue before decoration, atomic rejection, schema roundtrip, native interpreter branches/cancel/repeat/ending/save resume; 13 adversarial variants rejected.
- `team-gate-proof.json`: synthetic provider-boundary checks for missing finish, missing/current image review, stale review and repeated draft completion attempts. This is not live model evidence.
- `initial-generation-proof.json`: real New Game interview sent 41,964 characters and the internal contract to Gemini. AI wrote native dialogue and terrain and persisted them; the initial run was stopped before completion. One software-renderer framebuffer error was observed. Dialogue speaker/prose defects were subsequently repaired with the production tool.
- `canonical-proof.json`: owned SQLite host project `d3d07ee1-309e-4d1b-a0f3-4fd54dc41ea0`, revision 20; saved and reloaded through the host service. Live AI terrain retained. The contract was unchanged. Reload after model review confirmed no revision change.
- `model-review-proof.json`: separate real Gemini read-only follow-up; two actual production PNG responses, `inspect_romance_scene`, image-backed `report_review` with no findings, successful `finish`, and final `done`. Lint reported one warning; do not call it warning-free.
- `player-proof.json`: full canonical export, all 353 tileset definitions retained, compiled `player.html`, actual inputs, both choices/cancel/revisit/no duplicate relationship gain/visible ending. Opening disabled only on the QA copy. Audio request cancellation during terminal transition is recorded as a warning. A real player save-slot roundtrip is covered by the native inspector, not browser save menu automation.
- `snapshot-proof.json`: synthetic uploaded-graft pixels in the production browser renderer: same source id red → blue, missing source rejected. This proves snapshot selection and cache isolation, not game art quality.

Inspect `player/0-choices.png`, `player/0-reaction.png`, `player/1-reaction.png`, `player/1-remembered.png`, `player/0-ended.png` and `model-reviewed-map.png` first. These are real captured screens/PNG responses, not mockups.

Full suites/typecheck were not run. The task used focused Node/Bun/browser checks and production builds. Earlier large-CDP-body startup failures were isolated by serving the actual full export over HTTP; no game tilesets were removed from the passing full-player run.
