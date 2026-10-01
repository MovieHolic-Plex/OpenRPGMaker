# Map size benchmark — 2026-10-01

## Conditions

- 149.0.7827.55, Linux, software WebGL (SwiftShader), viewport 640×480.
- Actual export player path; QA hooks enabled. One discarded warmup then 3 repetitions per size, alternating order.
- Static tile 360 everywhere, empty upper layer, no events. Same tile density, camera zoom, player and viewport.
- Each idle/moving phase contains 600 real engine frames. Movement verified; no tile rebuild during movement.
- Map entry measured inside the browser with performance.now around synchronous transfer (no fade). Texture already loaded on 32×32 base map. Includes base teardown and runtime initialization; excludes network/title boot and first GPU upload.
- Heap delta: retained JS heap after forced GC, target minus base. Excludes native/GPU memory. CPU duration excludes GPU completion.
- Supported authoring dimension in this run: 1024. Synthetic fixtures only; no canonical project writes.

## Results

Medians of 3 run statistics; p95 rows aggregate run p95s, CPU max is the maximum across all runs.

| Metric | 512×512 | 1024×1024 | Ratio 1024/512 |
|---|---:|---:|---:|
| Map-entry synchronous CPU, ms | 147.30 | 481.50 | 3.27× |
| Map-entry to first postrender, ms | 208.10 | 542.60 | 2.61× |
| Additional retained JS heap, MiB | 2.20 | 8.20 | 3.73× |
| Total retained JS heap, MiB | 109.82 | 127.81 | 1.16× |
| Tile GameObjects | 3000.00 | 3000.00 | 1.00× |
| Visible tile GameObjects | 2000.00 | 2000.00 | 1.00× |
| Idle frame CPU median, ms | 1.70 | 1.70 | 1.00× |
| Moving frame CPU median, ms | 2.10 | 2.10 | 1.00× |
| Moving frame CPU p95, ms | 5.20 | 5.00 | 0.96× |
| Moving frame CPU max, ms | 14.70 | 15.80 | 1.07× |
| Moving frame interval p95, ms | 19.10 | 18.90 | 0.99× |
| Moving FPS | 60.01 | 60.01 | 1.00× |

## Evidence

- raw-results.json: all runs, every sampled frame, movement coordinates, heap counters, tile counters, environment and source commit.
- 512-field.png and 1024-field.png: immediate visual inspection.
- Reproduce: node scripts/qa/map-size-benchmark.mjs --sizes 512,1024 --frames 600

## Limits

A controlled empty field measures size overhead, not the performance of every game. NPCs, layered art, animation, shadows, pathfinding and actual hardware can change the result. No memory-pressure threshold or general-purpose safe maximum was established.
