# 겹치는 숲과 외곽 풀밭

- LegacyDb project: `rpg-zzu-house-template-gallery`
- Map: `spatial-geography:30:small-village:example:20260913`
- Actual raster: overlap 0 → 721 cells; 243 family 667 → 914 cells.
- All 26 house rasters/positions preserved (23 single-storey, 3 multi-storey).
- Spatial library, village presets and the other 19 maps unchanged.
- Tree canopy/trunk occupancy is independent per layer. Complete tree atoms, homes and approaches are protected.
- Grass uses a wider coherent fringe, including narrow outer gaps between trees. Eligible outer floor coverage before space decorations: 559/559; interior: 131/383.
- Optional decorations adapt to free room: 36 placements. Independent remote proof checks 67 public destinations.
- Native map and detail inspected; real remote editor matches the saved map, zero browser errors.
- Shipping player: 14/14 beats, 73 actual steps, no runtime errors. Runtime summary does not itself establish visual quality.
- Focused vegetation/house/decoration tests: 37/37; strengthened actual AI tool path test: 2/2.
- These are actual tool-path checks, not a provider conversation run.

Open `index.html` to toggle the before/after native render. Full project snapshots are intentionally local-only in `output/evidence/village-forest/`.

Full gates: app typecheck and CSS passed. Vitest 522 failed / 23,136 passed (prior: 522 / 23,131); surface failures unchanged. Four newly observed failures (three deadlines, one fetch failure) all passed unchanged on an isolated recheck. That recheck was 36 passed / 2 failed; both remaining failures were already in the measured baseline. No new village-area failure.

A final read at 06:37 UTC observed a later project revision. Only an unrelated map (`map_neon_nocturne_60_20260913`) plus system/database fields had changed; the authored village map still matched exactly. No overwrite was performed. See `latest-remote-check.json`; the earlier `final-remote-check.json` remains the successful exact-revision readback at save time.
