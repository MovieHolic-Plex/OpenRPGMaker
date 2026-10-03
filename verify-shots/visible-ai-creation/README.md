# Visible AI creation feedback

This is editor UI/code QA using temporary memory fixtures, not a canonical game-content save or a live-model completion receipt.

- The actual send button installed the canvas acknowledgement in the same click, before scripted model output: 4.8 ms in the recorded authoring attempt (`report.json`). This is acknowledgement latency, **not** first-map creation latency.
- The isolated production component passed at 320/1440 px: visible tool status, explicit live-canvas off, old-owner isolation, teardown, no page errors (`component.json`). The `width` values in that file describe the rendered component; filenames identify the viewport.
- `01-request.png` shows the actual editor. The status panel was moved above the bottom-left controls after visual inspection.
- The authoring transport probe **failed**: Chromium's renderer crashed during its in-browser native `create_map` operation, before checkpoint acknowledgement. No successful map checkpoint, playable game, canonical save or live-model speed improvement is claimed from it.
- `scripts/qa/visible-ai-creation.mjs` reproduces that authoring probe. `FEEDBACK_ONLY=1` selects a smaller native-read transport flow, separately recorded under `feedback-flow/`. All four assertions passed: acknowledgement in the send click (3.9 ms), the real native read activity while the scripted response remained open, teardown, and no page errors. It does not prove authored-map creation.

Production deliberately retains the existing checkpoint acceptance and map-focus implementation. No second focus callback, fake map writes, fake progress percentages or fabricated protagonist is introduced. The first-build prompt now schedules the first map before title art/opening work, while preserving serialization between project writes and map writes.

Packaged builds passed. Vitest, full typecheck and gates were not rerun in this turn under the repository's session-test restriction.
