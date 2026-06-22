---
name: small-house-01
description: Use this RPG Maker building reference when recreating or adapting the small_house_01 user-built house template, including its screenshot, tile roles, and lower/upper layer split.
---

# Small House 01

## Overview

This package captures the user-built small house template from the RPG Zzu database map.

Map-only reference screenshot: `assets/small_house_01.png`

Create this screenshot with the editor's map-only save control, `data-testid="editor-map-screenshot-button"`. It must stay free of editor UI, modal borders, browser chrome, selection outlines, and unrelated map context.

Template size: 16 x 15 tiles. Coordinates below are zero-based from the top-left of the captured template.

## Layer Contract

The visual house depends on a strict layer split.

- Lower layer: grass base, walls, straight roof body, roof-to-wall boundary, fence, windows, and the 1 x 2 door.
- Upper layer: slanted roof overlay tiles only.
- Do not place the fence, windows, door, wall body, or straight roof body on the upper layer.
- The upper slanted roof tiles exist so the player can later pass visually below/behind those roof edges.

Upper layer tile ids used by this template:

- Slanted roof: `354`, `355`, `376`, `377`, `384`, `385`

Transparent lower-layer overlays:

- Fence: `378`, `379`, `380`, `408`, `409`, `410`, `438`, `439`
- Windows: `87`

All other visible building tiles in this template also belong on the lower layer.

## Key Tiles

Fence:

- Lower transparent overlay in this template.
- Top rail uses `378`, `379`, `380`.
- Side and corner pieces include `408`, `409`, `410`, `438`, `439`.

Wood house face:

- Lower layer only.
- Wall body uses `15`, `16`, `17`, `45`, `46`, `47`, `75`, `76`, `77`.
- Roof and roof-to-wall boundary body includes `375`, `377`, and `404` when it is not a slanted overlay.

Door and windows:

- Door is lower layer only.
- Windows are lower transparent overlays in this template.
- Door is 1 tile wide and 2 tiles tall: top `329`, bottom `359`.
- Window tile `87` is lower layer here and should sit on top of the wall via lower stacking.

Slanted roof:

- Upper layer only.
- These are the only upper layer placements in this template.
- Left slant: `354`, `376`, `384`.
- Right slant and caps: `355`, `377`, `385`.

## Important Coordinates

Upper layer slanted roof placements:

| x | y | tile |
|---|---|------|
| 4 | 3 | 354 |
| 13 | 3 | 355 |
| 4 | 4 | 376 |
| 4 | 5 | 376 |
| 8 | 5 | 355 |
| 13 | 5 | 385 |
| 4 | 6 | 376 |
| 8 | 6 | 377 |
| 4 | 7 | 384 |
| 8 | 7 | 385 |

Lower layer door and lower stacked windows:

| x | y | tile | role |
|---|---|------|------|
| 12 | 7 | 329 | door top, lower |
| 12 | 8 | 359 | door bottom, lower |
| 10 | 7 | 87 | window, lower stack |
| 5 | 9 | 87 | window, lower stack |
| 7 | 9 | 87 | window, lower stack |

## Usage Guidance

Use the full 16 x 15 template when preserving the captured house as a reference object.

When generating a town, usually split the house body from the surrounding fence so the fence can be adapted to the lot shape. Keep the same layer contract after splitting: fence and windows remain lower transparent overlays; only slanted roof overlays remain upper.

For exact arrays, see `references/layer-grid.md`.
