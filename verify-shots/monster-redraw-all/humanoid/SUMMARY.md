# Humanoid redraw handoff

- 28 species; 252 separately rasterized pose cells, 28 sheets, and 28 exact idle portraits.
- 23 species use native 64px cells; ogre, centaur, griffin, phoenix, and behemoth use native 96px cells.
- All 28 complete nine-pose boards and all three contact pages were opened for visual review.
- Species-specific face, anatomy, materials, equipment and collapsed death geometry are authored in five Python sources. Wings, arms, head, body, feet, tails and weapons articulate before native-grid rasterization.
- Palette union per species: 10–22 visible colors, binary alpha. The exporter checked margins, unique pose bytes, and reopened public PNGs against their authored pixel buffers.
- Reproduce from repository root: `python3 scripts/asset-gen/pixel-enemy/redraw/export.py humanoid`.
- Korean descriptions are in `scripts/asset-gen/pixel-enemy/redraw/humanoid-descriptions.json`.
- The GIF files are authoring previews; these are nine discrete battle poses. Runtime integration and runtime recording are owned by the parent task.
- Kappa and the four other retained species were excluded. No catalog, motion metadata, database, common exporter, manifest, tests, gates or publication were changed.
