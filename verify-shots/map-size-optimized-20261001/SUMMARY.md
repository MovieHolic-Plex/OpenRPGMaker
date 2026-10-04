# Map size benchmark — 2026-10-01

## Conditions

- 149.0.7827.55, Linux, software WebGL (SwiftShader), viewport 640×480.
- Actual export player path; QA hooks enabled. One discarded warmup then 3 repetitions per size, alternating order.
- Static tile 360 everywhere, empty upper layer, no events. Same tile density, camera zoom, player and viewport.
- Each idle/moving phase contains 180 real engine frames. Movement verified; no tile rebuild during movement.
- Map entry measured inside the browser with performance.now around synchronous transfer (no fade). Texture already loaded on 32×32 base map. Includes base teardown and runtime initialization; excludes network/title boot and first GPU upload.
- Heap delta: retained JS heap after forced GC, target minus base. Excludes native/GPU memory. CPU duration excludes GPU completion.
- 512 is unsupported by authoring tools; limit was not changed. Synthetic fixture only; no canonical project writes.

## Results

Medians of 3 runs; each frame CPU value is the median within its run.

| Metric | 256×256 | 512×512 | Ratio 512/256 |
|---|---:|---:|---:|
| Map-entry synchronous CPU, ms | 72.70 | 142.50 | 1.96× |
| Map-entry to first postrender, ms | 116.70 | 189.20 | 1.62× |
| Additional retained JS heap, MiB | 0.73 | 2.24 | 3.07× |
| Tile GameObjects | 3000.00 | 3000.00 | 1.00× |
| Visible tile GameObjects | 2000.00 | 2000.00 | 1.00× |
| Idle frame CPU median, ms | 1.80 | 1.70 | 0.94× |
| Moving frame CPU median, ms | 2.10 | 2.00 | 0.95× |
| Moving FPS | 60.03 | 60.03 | 1.00× |

## Evidence

- raw-results.json: all runs, every sampled frame, movement coordinates, heap counters, tile counters, environment and source commit.
- 256-field.png and 512-field.png: immediate visual inspection.
- Reproduce: node scripts/qa/map-size-benchmark.mjs

## Limits

A controlled empty field measures size overhead, not the performance of every game. NPCs, layered art, animation, shadows, pathfinding and actual hardware can change the result. No memory-pressure threshold or general-purpose safe maximum was established.
