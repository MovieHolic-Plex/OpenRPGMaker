---
name: easyrpg-combined-town-tileset
description: Use this RPG Zzu tileset harness reference when classifying, validating, or procedurally placing tiles from the EasyRPG RTP Combined Town ChipSet, especially roads, water, house walls, doors, windows, fences, roof overlays, and transparent props.
---

# EasyRPG Combined Town Tileset Harness

This package is the human-readable counterpart of `src/project/tilesetHarness`.

Use it when an agent needs to map, edit, or critique the default `EasyRPG RTP Combined Town ChipSet`.

## Authority

- SQLite/project metadata is the runtime source of truth.
- The TypeScript harness seeds SQLite/JSON metadata for the bundled Combined Town tileset.
- This document explains the same contract for humans and future agents.
- Do not apply these tile-number meanings to uploaded or unknown tilesets.

## Layer Contract

- Lower: walls, doors, windows, fences, straight roof bodies, roof-wall boundaries, roads, water, and ordinary terrain.
- Upper: slanted roof overlays that visually sit over lower wall/roof tiles.
- Mixed stack: trees and small props may be stacked on lower or upper only when the map composition needs transparent overlap.
- User-locked metadata wins over AI suggestions.

## Terrain Contracts

- Dirt road: use the `harness-combined-town-dirt-road-autotile` group. A single road brush should re-shape connected road cells into center, edge, and corner tiles.
- Water: use the `harness-combined-town-lake-water-autotile` group. It is animated terrain; representative water paint should render connected shore and body frames.
- Grass and sand are lower base terrain unless a specific group says otherwise.

## Building Contracts

- White/plaster wall and wood wall groups are `nine_slice_expandable`: keep source order, fix corners, repeat the center/body columns.
- Doors are lower-layer 1 x 2 entrances. Do not place door visuals on the upper layer.
- Windows are lower transparent overlays, usually stacked over wall tiles.
- Fences are lower transparent overlays. Keep path and door access clear.
- Roof-wall boundary and straight roof face tiles stay lower.
- Slanted roof overlays stay upper and can overlap lower building tiles.

## AI Metadata Rules

- Show tile number and tile image together whenever asking a user to resolve a question.
- Ask free-form clarification when the selection could be an autotile, animated terrain, object, or source-preserving block.
- When the AI proposes metadata, validate layer, repeatability, and group grammar against the harness before applying.
- Never let AI overwrite `user_locked` fields.
