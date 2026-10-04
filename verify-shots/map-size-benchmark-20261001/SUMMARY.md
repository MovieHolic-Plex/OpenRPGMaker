# Map size benchmark — 2026-10-01

## Conditions

- 149.0.7827.55, Linux, software WebGL (SwiftShader), viewport 640×480.
- Actual export player path; QA hooks enabled. One discarded warmup then 3 repetitions per size, alternating order.
- Static tile 360 everywhere, empty upper layer, no events. Same tile density, camera zoom, player and viewport.
- Each idle/moving phase contains 180 real engine frames. Movement verified; no tile rebuild during movement.
- Map entry measured inside the browser with performance.now around synchronous transfer (no fade). Texture already loaded on 32×32 base map. Includes base teardown and runtime initialization; excludes network/title boot and first GPU upload.
- Heap delta: retained JS heap after forced GC, target minus base. Excludes native/GPU memory. CPU duration excludes GPU completion.
- 512 is unsupported by authoring tools; limit was not changed. Synthetic fixture only; no canonical project writes.

- Shared host load average (1 minute) increased from 9.58 to 21.87; this is not an isolated hardware benchmark.
- Local asset/module HTTP delivery used Node fetch to avoid Chromium ERR_NETWORK_CHANGED; unused Vite HMR WebSocket was stubbed with connected. Failed pre-measurement boots were excluded.

## Results

Medians of 3 runs; each frame CPU value is the median within its run.

| Metric | 256×256 | 512×512 | Ratio 512/256 |
|---|---:|---:|---:|
| Map-entry synchronous CPU, ms | 5752.90 | 54200.80 | 9.42× |
| Additional retained JS heap, MiB | 148.69 | 596.81 | 4.01× |
| Tile GameObjects | 262144.00 | 1048576.00 | 4.00× |
| Visible tile GameObjects | 2000.00 | 2000.00 | 1.00× |
| Idle frame CPU median, ms | 23.30 | 78.20 | 3.36× |
| Moving frame CPU median, ms | 23.20 | 77.10 | 3.32× |
| Moving FPS | 33.57 | 11.75 | 0.35× |

## Evidence

- raw-results.json: all runs, every sampled frame, movement coordinates, heap counters, tile counters, environment and source commit.
- 256-field.png and 512-field.png: immediate visual inspection.
- Reproduce: node scripts/qa/map-size-benchmark.mjs

## Limits

A controlled empty field measures size overhead, not the performance of every game. NPCs, layered art, animation, shadows, pathfinding and actual hardware can change the result. No memory-pressure threshold or general-purpose safe maximum was established.

## Per-run map-entry times

- 256×256: 3.960 / 5.919 / 5.753 seconds.
- 512×512: 54.201 / 52.688 / 56.146 seconds.
- All six measured runs: zero page/console errors, actual movement verified, 180 frames per phase, no tile rebuild during movement.

## Code evidence

See [SOURCE-EVIDENCE.md](SOURCE-EVIDENCE.md). The per-image Container.add call searches the accumulated child list with indexOf, which introduces a quadratic construction component. Offscreen objects are still visited by the container renderer. This identifies scaling-sensitive code; function-level CPU attribution was not profiled.

Screenshots 256-field.png and 512-field.png were visually inspected: the floor and player render correctly, with no editor shell.
