"""Hand-pixel inward swing for bd-house-h101_0; Pillow only, no generated images.
Run: python3 scripts/content/build-beodeul-door.py
The closed endpoint is byte-identical to the two existing atlas cells.
"""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'public/assets/beodeul-door'
SOURCE = ROOT / 'tiledata/beodeul-door'
ART.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
atlas = Image.open(ROOT / 'public/assets/beodeul-city/beodeul-city-chipset.png').convert('RGBA')
data = json.loads((ROOT / 'src/assets/beodeulCityTileset.json').read_text())
kit = next(k for k in data['structureKits'] if k['id'] == 'bd-house-h101_0')

def cell(n):
    x, y = (n % 128) * 16, (n // 128) * 16
    return atlas.crop((x, y, x + 16, y + 16))

closed = Image.new('RGBA', (16, 32))
closed.paste(cell(5743), (0, 0))
closed.paste(cell(2333), (0, 16))
# Explicit pixel-stage plan: projected width and recession of the free edge.
stages = [(8, 0), (8, 1), (7, 2), (6, 3), (5, 4), (3, 5), (2, 6), (1, 7)]
frames = [closed]
for width, recession in stages[1:]:
    im = closed.copy()
    # Keep the jamb/lintel/threshold fixed. The cavity is opaque, never alpha:
    # alpha here would reveal the old painted closed door underneath.
    for y in range(5, 30):
        for x in range(4, 12):
            color = (23, 14, 8, 255)
            if y >= 27:
                color = (49, 34, 16, 255) if y == 27 else (69, 42, 23, 255)
            im.putpixel((x, y), color)
    # Draw the leaf at integer coordinates. Its far lower corner recedes up;
    # original plank/iron pixels are foreshortened onto that silhouette.
    for dx in range(width):
        rise = round(recession * dx / max(1, width - 1))
        sx = 4 + min(7, (dx * 8) // width)
        for y in range(5, 30 - rise):
            color = closed.getpixel((sx, min(29, y + rise)))
            if dx == width - 1:
                color = (49, 34, 16, 255)
            im.putpixel((4 + dx, y), color)
        im.putpixel((4 + dx, 29 - rise), (91, 58, 32, 255))
    # Brass handle travels with the free edge, disappearing edge-on.
    if width >= 3:
        hx = 4 + width - 2
        hy = 17 - round(recession * (width - 2) / max(1, width - 1))
        im.putpixel((hx, hy), (251, 193, 13, 255))
        im.putpixel((hx, hy + 1), (132, 92, 31, 255))
    frames.append(im)

sheet = Image.new('RGBA', (128, 32))
for i, im in enumerate(frames):
    sheet.paste(im, (i * 16, 0))
    im.save(ART / f'door-{i}.png')
sheet.save(ART / 'door-states.png')
sheet.resize((768, 192), Image.Resampling.NEAREST).save(ART / 'door-states-preview.png')

# Reassemble the original house on its original grass, then replace exactly
# the 1x2 door block. This is an asset preview, not a gameplay recording.
base = Image.new('RGBA', (144, 144))
for y in range(0, 144, 16):
    for x in range(0, 144, 16):
        base.paste(cell(737), (x, y))
for y, row in enumerate(kit['rows']):
    for x, tile in enumerate(row['upperTiles']):
        if tile >= 0:
            base.alpha_composite(cell(tile), (16 + x * 16, y * 16))
# Path cells from the saved assistant trial, copied here for reproducible builds.
for y, tile in zip(range(96, 144, 16), [23019, 2666, 2666]):
    base.paste(cell(tile), (48, y))
scene = []
for im in frames:
    f = base.copy()
    f.paste(im, (48, 64))
    scene.append(f.convert('RGB'))
indices = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0]
durations = [800] + [100] * 6 + [950] + [100] * 6 + [450]
# One fixed palette for every frame, no dithering or filtering.
palette_board = Image.new('RGB', (144 * 8, 144))
for i, f in enumerate(scene):
    palette_board.paste(f, (i * 144, 0))
palette = palette_board.quantize(colors=256, dither=Image.Dither.NONE)
for name, rendered, scale in [('house-door.gif', scene, 4),
                              ('door-detail.gif', [im.convert('RGB') for im in frames], 12)]:
    gif = [rendered[i].resize((rendered[i].width * scale, rendered[i].height * scale), Image.Resampling.NEAREST)
           .quantize(palette=palette, dither=Image.Dither.NONE) for i in indices]
    gif[0].save(ART / name, save_all=True, append_images=gif[1:], duration=durations,
                loop=0, optimize=False, disposal=2)

normal = frames[4]
wrong = frames[4].copy()
wrong.paste(frames[0].crop((0, 16, 16, 32)), (0, 16))
comparison = Image.new('RGBA', (40, 32), (50, 50, 50, 255))
comparison.paste(normal, (0, 0)); comparison.paste(wrong, (24, 0))
comparison.resize((240, 192), Image.Resampling.NEAREST).save(ART / 'same-stage-vs-mixed.png')

# Focused invariants on this art build, not an editor/engine test suite.
assert frames[0].tobytes() == closed.tobytes()
for im in frames:
    for y in range(32):
        for x in range(16):
            if not (4 <= x < 12 and 5 <= y < 30):
                assert im.getpixel((x, y)) == closed.getpixel((x, y))
assert len({im.tobytes() for im in frames}) == 8
report = {'frameSize': [16, 32], 'stages': stages, 'frames': 8, 'sheetSize': [128, 32],
          'sourceCells': [5743, 2333], 'unchangedClosedEndpoint': True,
          'unchangedJambAndThreshold': True, 'mixedStageError': {'code': 'door-stage-mismatch', 'x': 0, 'y': 1},
          'previewOnly': True, 'sequence': indices, 'durationMs': durations}
(SOURCE / 'manifest.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
