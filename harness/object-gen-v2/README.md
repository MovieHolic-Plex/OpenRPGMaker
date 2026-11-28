# object-gen-v2

**Carbon Medium Pure 1-Pass 3/4 Top-Down Pixel Art Object Generator** for [OpenRPGMaker](https://github.com/MovieHolic-Plex/OpenRPGMaker).

> **Recommended LLM:** `gemini-4-carbon` (`thought_level: medium`) — validated at **41/41 (100% first-pass pass rate)** on `modern_campus` at ~22 seconds/sprite in 8-agent parallel batches. Other LLMs may require multi-pass inspection or produce flat `fillRect` boxes.

## Why v2?

Compared to `object-gen` v1 (single-object `ref` → multi-round `drawlib` → `vqa` → 3-vote `picker`, 2–6 min/object):

- **Pure 1-Pass Batch Architecture:** Each Carbon Medium worker draws **5–6 cohesive sprites** in one clean Python(Pillow) pass with zero mid-draw image round-trips.
- **Strict Mechanical Gate:** Every sprite is verified for 16px tile alignment, **0 palette violations** against a locked ramp palette (`palettes/fable-city.json`), and **strict binary alpha (`0` or `255`)**.
- **Contact-Sheet Visual QA:** `sheet` stitches 4× labeled QA boards (and optional Before/After inline HTML) so humans/coordinators visually approve 40+ sprites in seconds and selectively reroll only actual defects.
- **Drop-In `oprn-store-pack/1` Export:** `pack` compiles verified sprites into a standard `oprn-store-pack/1` folder (`manifest.json` + `blobs/<sha256>`) ready to import directly into OpenRPGMaker's Workshop or bundle bakers.

## Structure

```text
object-gen-v2/
├── SKILL.md              # Agent skill & Carbon Medium 1-pass pixel art rules
├── palettes/             # Locked color ramps (fable-city.json, extensible per theme)
├── references/           # Gold-standard 1× PNG anchors + index.json
├── objectgen_v2/
│   ├── cli.py            # CLI: verify | sheet | pack | init-batch
│   ├── palette.py        # Palette loading, RGB/alpha/black-box validation, pixel SHA-256
│   ├── sheet.py          # 4× QA contact sheet PNG + Before/After HTML builder
│   └── pack.py           # oprn-store-pack/1 compiler (tileset sheet + structureKits)
└── tests/test_cli.py     # End-to-end smoke tests
```

## Quickstart

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -e .

# 1. Scaffold a new batch
object-gen-v2 init-batch ./batches/campus-01 --palette palettes/fable-city.json

# 2. Have Carbon Medium agents generate 1× RGBA PNGs (5-6 sprites per agent, pure 1-pass)
#    Follow SKILL.md strictly.

# 3. Verify palette lock, binary alpha, and 16px grid alignment
object-gen-v2 verify ./batches/campus-01/pieces --palette palettes/fable-city.json

# 4. Build 4× QA contact sheet(s) + optional Before/After HTML
object-gen-v2 sheet ./batches/campus-01/pieces --out ./batches/campus-01/qa

# 5. Compile to OpenRPGMaker oprn-store-pack/1 folder
object-gen-v2 pack ./batches/campus-01/spec.json --out ./dist/campus-01-pack
```
