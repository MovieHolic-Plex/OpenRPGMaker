# Visible AI creation feedback

Editor UI/code QA uses temporary memory fixtures and scripted model transport. This is not a live-model latency measurement, playable-game completion or canonical SQLite-save receipt.

- Actual editor send → native `create_map` checkpoint → native `paint_tiles` checkpoint → settlement: all five assertions passed (`report.json`). Acknowledgement appeared in the send click (4.3 ms); both accepted changes were visible while the scripted response remained open. `02-first-map.png` and `03-live-floor.png` show actual editor rendering before completion. No page errors.
- Native-read transport flow: all four assertions passed on the rebased branch (`feedback-flow/report.json`), including send acknowledgement (4.6 ms), real tool activity while the response remained open, teardown and no page errors.
- Isolated production component passed at 320/1440 px: visible tool status, explicit live-canvas off, old-owner isolation, teardown, no page errors (`component.json`). The `width` values describe the rendered component; filenames identify the viewport.
- Visual inspection moved the status panel above the bottom-left controls. The actual native tile changes remain visible and the temporary status closes on settlement.

Reproduce with `node scripts/qa/visible-ai-creation.mjs` against the worktree dev server, or `FEEDBACK_ONLY=1` for the read-only flow. The fixture's database is normalized before the probe replaces it; early attempts used incomplete legacy actor data and crashed, and an incomplete scripted review event caused a settlement error. Those probes were corrected and rerun; the final reports above contain passing results. The scripted review is not model/vision QA. The old fixture has pre-existing title-resource/start-position warnings; accepting its map deltas does not certify a playable game.

Production retains the existing checkpoint acceptance and map-focus implementation. No second focus callback, fake map writes, fake progress percentages or fabricated protagonist is introduced. First-build prompts now schedule the first map before title art/opening work, preserving serialization between project writes and map writes. Live-model first-result time is unmeasured.

The packaged build passed on the rebased production code (exit 0). Vitest, full typecheck and gates were not rerun under the repository's session-test restriction.
