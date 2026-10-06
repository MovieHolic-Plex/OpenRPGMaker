"""Read literal before/current grids into background comparison panels only."""
from pathlib import Path
from PIL import Image, ImageDraw
import json

ROOT = Path(__file__).resolve().parent
PALETTE = json.loads((ROOT / 'palette.json').read_text())
COLORS = {k: tuple(bytes.fromhex(v[1:])) + (255,) for k, v in PALETTE.items()}
COLORS['.'] = (0, 0, 0, 0)
NAMES = ['idle_a', 'idle_b', 'idle_c', 'skill_b']


def decode(path):
    rows = path.read_text().splitlines()
    frame = Image.new('RGBA', (96, 96))
    frame.putdata([COLORS[c] for row in rows for c in row])
    return rows, frame


def backdrop(kind):
    frame = Image.new('RGBA', (96, 96),
                      (230, 230, 220, 255) if kind == 'light' else (23, 28, 42, 255))
    if kind == 'checker':
        frame.putdata([(174, 184, 194, 255) if (x // 8 + y // 8) % 2
                       else (220, 225, 228, 255)
                       for y in range(96) for x in range(96)])
    return frame


summary = {}
native = Image.new('RGB', (624, 464), (55, 62, 76))
large = Image.new('RGB', (1824, 1280), (55, 62, 76))
dn = ImageDraw.Draw(native)
dl = ImageDraw.Draw(large)
for k, name in enumerate(NAMES):
    before, before_image = decode(ROOT / 'checkpoints' / 'cuff-crystals-before' / (name + '.pxgrid'))
    folder = 'poses' if name.startswith('idle') else 'actions'
    after, after_image = decode(ROOT / folder / (name + '.pxgrid'))
    changed = [(x, y) for y in range(96) for x in range(96) if before[y][x] != after[y][x]]
    summary[name] = {
        'changedPixels': len(changed),
        'changedBoundsInclusive': [min(x for x, y in changed), min(y for x, y in changed),
                                   max(x for x, y in changed), max(y for x, y in changed)],
        'currentInkBoundsExclusive': after_image.getbbox(),
    }
    if name == 'skill_b':
        summary[name]['handRibbonRootUnchanged'] = all(before[y][62:71] == after[y][62:71]
                                                      for y in range(49, 54))
    for b, kind in enumerate(['light', 'dark', 'checker']):
        for v, (label, im) in enumerate([('before', before_image), ('current', after_image)]):
            panel = backdrop(kind)
            panel.alpha_composite(im)
            column = b * 2 + v
            xn, yn = column * 104 + 4, k * 116
            native.paste(panel, (xn, yn + 16))
            dn.text((xn, yn + 2), name + ' ' + label, fill='white')
            xl, yl = column * 304 + 8, k * 320
            large.paste(panel.resize((288, 288), Image.Resampling.NEAREST), (xl, yl + 24))
            dl.text((xl, yl + 6), name + ' ' + kind + ' ' + label, fill='white')
native.save(ROOT / 'preview' / 'repair-before-after-1x.png')
large.save(ROOT / 'preview' / 'repair-before-after-3x.png')
(ROOT / 'preview' / 'repair-diagnostics.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
