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

## Full gate and regression attribution

The full gate reported typecheck exit 0, CSS budget/graph exit 0, 12,673 passing / 202 failing / 15 skipped tests, and surface failures. Its stored baseline marked 21 test files and two surface checks as new failures. The execution wrapper returned 143 after emitting the complete four-component summary; this run is **not** claimed as a green gate.

To distinguish repository baseline drift from this change, the 21 flagged files (181 tests) were run directly on parent `3ab8ebb5` and implementation `d158facf`, both with four workers. Parent: 159 passed / 22 failed. Implementation: 157 passed / 24 failed. Three assertions differed; isolated one-worker reruns gave **identical** results on both commits: two existing 15-second DB test timeouts, and one passing village test. No unexplained new failure remains from this comparison. Details: `gate-comparison.json`.

`npm run gates -- --only surface` on the unmodified parent reproduced the same six snapshot assertions and the same missing `.selected` CSS `bottom` property. Details: `surface-comparison.json`. The stored repository baseline was not changed to hide these failures.
