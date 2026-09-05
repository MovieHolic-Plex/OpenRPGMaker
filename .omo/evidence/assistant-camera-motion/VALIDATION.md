# Validation

- `npm run typecheck:app`: exit 0 on the final source.
- Focused Vitest: 7 files, 106 tests passed (camera planning, scene lifecycle/gestures, map navigation, accepted AI changes, view-focus tool resolution, viewport occlusion, event-list pub/sub).
- `DEV_SERVER_PORT=19851 E2E_RETRIES=0 npx playwright test test/e2e/assistant-camera-motion.spec.ts --project=chromium`: 1 passed, page errors 0.
- `git diff --check`: passed.

## Browser measurements

`measurements.json` contains 39 sampled frames from zoom 4 to zoom 1, with no synchronous first-frame change. The region center (79, 60.5 tiles) lands at the center of the unoccluded canvas. Map A's running pan is stopped when B is selected; a late A request leaves B's camera unchanged. Wheel interruption and reduced-motion behavior also pass.

The host was running several large validation jobs concurrently. The sampled animation took 8.7 seconds of wall time because Phaser's simulation clock advances slowly at this frame rate; this is functional trajectory evidence, not a frame-rate benchmark. The configured duration is 300–650ms of Phaser time.

Initial browser attempts hit `ERR_NETWORK_CHANGED` while loading the Vite module graph. The final specification fetches same-origin non-API resources through Playwright's Node transport and runs the real editor code and Phaser camera. It does not mock the tool, camera, map-selection or viewport implementation. No network LLM request is made.

The test maps are ephemeral contract fixtures. No authored game content or remote project rows are changed.
