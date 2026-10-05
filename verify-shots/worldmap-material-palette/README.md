# Worldmap material palette — 2026-10-05

The legacy worldmap used one image cell per map coordinate and displayed the continent as a custom sheet palette. New maps use a coordinate-independent terrain atlas, map tile arrays, and separate human-approved upper props. Legacy maps expose a native conversion button.

## Actual content evidence

- `conversion.json`: real edit_world_terrain tool, 6,912 cells, all four movement directions unchanged; five existing maps and start preserved; separate SQLite save, close and reopen.
- `pixels.json`: actual lower/upper arrays reconstructed from the terrain atlas and committed graft sheet match the generator picture exactly. All 2,691 differences from the historical PNG are exclusively corrected transparent/shadow color keys. Other pixels are unchanged.
- `hand-edits.json`: painted terrain, a deleted generated icon and an authored graft's source/directional passage survive regeneration.
- `common-references.json`: material references present on fresh and existing tilesets; second ensure call unchanged. Source MD/actual images are shipped by the worldmap_selected bundle and shared through referenceSourceTilesetId.
- `native-conversion-r4.json`: real browser button, 34 lower materials / 36 whole approved icons. Conversion reached the actual canonical project at revision 10. The UI save indicator exceeded 120 seconds; this attempt is retained as incomplete browser save evidence.
- `canonical.json`: independently reopened the actual UI-saved SQLite target, verified passage and other maps, refreshed bundled reference pagination through the same local store API while the host was stopped, saved revision 11 and closed/reopened successfully.
- Native failures r2 (host kit path) and r3 (network failure) are retained. No model was called for conversion; earlier live model videos describe the historical generation, not this patch.

Canonical project ID: `65d2e492-1fbf-43ef-8895-9c82427ed6ea`.
Target: `qa-runs/harnesses/assistant-capability/worldmap-film-20261005-03/default/project/project.sqlite`.
Canonical reopen SHA256: `3f0cb6d36f9c58c182ca2c03d2aadabc9259427e0ca7a4784aa0a6966ea25431`.

Packaged build succeeded. No gates, vitest, full test suite or full typecheck were run.
Terrain cells retain composite forests/roads/relief. Representative brush tiles do not automatically connect coastlines; large geography changes use terrain ops. Missing hand-painted material hashes reject regeneration instead of silently overwriting edits.
