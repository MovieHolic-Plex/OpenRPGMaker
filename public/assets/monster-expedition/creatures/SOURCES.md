# Original monster creature art

All 120 battle sprites in this directory were created specifically for the
별빛섬 몬스터 원정 game on 2026-10-03. The editable source is
`scripts/content/monster-expedition-art.py`: integer pixel polygons, lines,
rectangles and small ellipses, with 24 individually authored creature anatomies.
No source images, traced silhouettes, stock monster sprites or generated-image
outputs are used. Front and back are separately authored anatomical views.

These are project-owned original assets. No extra redistribution license is
granted here. There are no third-party creature-art attribution obligations.
Pillow is an authoring dependency, not a runtime dependency or an included art pack.

Rebuild from the repository root:

```sh
python3 scripts/content/monster-expedition-art.py
```

`catalog.json` records each PNG filename, resource ID, byte size, SHA-256 and
nontransparent bounding box. `uploaded-art.json` is the synchronous portable
upload seed; SQLite persistence externalizes its bytes through the native asset
service. `contact-sheet.png` and `starter-review.png` are developer review images,
not battle resources. The roster module registers only the actual 120 sprites.
