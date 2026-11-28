---
name: object-gen-v2
description: >
  Batch-produce authentic 16px-grid 3/4 top-down RPG objects, furniture, props,
  vehicles, and buildings in strict pure 1-pass batches using Gemini 4 Carbon
  (thought_level: medium). Includes mechanical palette/alpha validation, 4x QA
  contact-sheet generation, and oprn-store-pack/1 export for OpenRPGMaker.
---

# object-gen-v2 — Carbon Medium 1-Pass Object Production Skill

> **Model Warning (CRITICAL):** This workflow is tuned specifically for **`gemini-4-carbon` with `thought_level: "medium"`**. Running it on weaker models or low reasoning frequently regresses into flat `fillRect` rectangles with harsh black outlines.

## Core Principles

1. **Strict 3/4 Top-Down Perspective**
   - Top plane is clearly visible (typically 25–45% of object height), front vertical face shows depth and material detail, and top-left daylight casts soft bottom-right shadows.
   - Never draw flat side elevations or isometric diamond bases.
2. **Material-Colored Soft Contours (Zero Pure-Black Boxes)**
   - Outline every material with the darkest shade of *its own* ramp (`wood[0]`, `steel[0]`, `navy[0]`, `concrete[0]`, `kuro[0]`), never a uniform `#000000` rectangular border.
3. **Strict Palette Lock & Binary Alpha**
   - Every opaque pixel MUST match an exact RGB value from the target locked palette (`palettes/fable-city.json` by default) → **`palette_violations == 0`**.
   - Alpha MUST be strictly `0` or `255` → **`alpha_violations == 0`** (no semi-transparent anti-aliasing halos).
4. **Pure 1-Pass Batch Throughput**
   - Group targets into cohesive thematic packs of **5–6 sprites per Carbon Medium worker** (e.g., 8 workers × 5 sprites = 40 sprites in ~12–15 minutes).
   - Workers read 2–3 gold-standard reference PNGs (`references/`) + any old sprites to replace **before** writing code, then write **one** clean Python(Pillow) generator script for all 5–6 sprites, validate `palette_violations == 0` & `alpha_violations == 0` programmatically, save `1×` and `4×` (NEAREST) PNGs, and **stop immediately** (no per-sprite multi-pass image inspection loop).
   - The coordinator then runs `object-gen-v2 verify` + `object-gen-v2 sheet` to visually inspect all 40 sprites at once on 4× contact sheets and selectively rerolls only sprites with genuine visual flaws.

## Worker Brief Template

Give each Carbon Medium (`thought_level: medium`) worker:
1. **Strict 1-Pass Directive:** One Python script, zero post-output `read_file` or v2 polish, zero repository edits outside the designated scratch directory.
2. **References:** 2–3 relevant anchors from `references/` (matching category: outdoor, indoor, vehicle, building) + locked palette path (`palettes/fable-city.json`).
3. **Per-Sprite Micro-Spec (5–6 items):**
   - `id`, exact pixel dimensions (`16×16`, `32×16`, `16×32`, `32×32`, `48×32`, `32×64`, etc. — always multiples of 16).
   - Specific architectural/material details (top plane, props on top, front face texture, legs/plinth, contact shadow) so the sprite reads unmistakably at 1×.

## Verification & Packing Commands

```bash
# Validate every 1x PNG against locked palette & binary alpha
object-gen-v2 verify <pieces_dir> --palette palettes/fable-city.json

# Generate 4x contact sheets (20 sprites per sheet) + optional Before/After HTML
object-gen-v2 sheet <pieces_dir> --out <qa_dir> [--before-dir <old_x1_dir>] [--spec <spec.json>]

# Pack approved pieces into an OpenRPGMaker oprn-store-pack/1 folder
object-gen-v2 pack <spec.json> --out <pack_dir>
```

## Notes on OpenRPGMaker 3/4 Gate & Store Policy

- Local packs produced by `object-gen-v2 pack` import into OpenRPGMaker Workshop with `local:object-gen` provenance.
- Publishing to the public Asset Store still requires passing OpenRPGMaker's `object-gate` policy; bundle baking inside OpenRPGMaker uses `owner-waive` where explicitly approved by the project owner.
