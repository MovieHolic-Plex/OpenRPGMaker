"""Read before/current literal grids; render diagnostic panels, never source art."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib

ROOT = Path(__file__).resolve().parent
PALETTE = json.loads((ROOT / 'palette.json').read_text())
COLORS = {k: tuple(bytes.fromhex(v[1:])) + (255,) for k, v in PALETTE.items()}
COLORS['.'] = (0, 0, 0, 0)
NAMES = ['move', 'attack', 'skill_c', 'stun_a', 'stun_b']


def decode(path):
    rows = path.read_text().splitlines()
    frame = Image.new('RGBA', (96, 96))
    frame.putdata([COLORS[c] for row in rows for c in row])
    return rows, frame


def backdrop(kind):
    im = Image.new('RGBA', (96, 96),
                   (230, 230, 220, 255) if kind == 'light' else (23, 28, 42, 255))
    if kind == 'checker':
        im.putdata([(174, 184, 194, 255) if (x // 8 + y // 8) % 2
                    else (220, 225, 228, 255)
                    for y in range(96) for x in range(96)])
    return im


summary = {}
native = Image.new('RGB', (624, 580), (55, 62, 76))
large = Image.new('RGB', (1824, 1600), (55, 62, 76))
dn, dl = ImageDraw.Draw(native), ImageDraw.Draw(large)
for k, name in enumerate(NAMES):
    before_path = ROOT / 'checkpoints' / 'anatomy-before' / (name + '.pxgrid')
    after_path = ROOT / ('poses' if name in ['move', 'attack'] else 'actions') / (name + '.pxgrid')
    before, before_image = decode(before_path)
    after, after_image = decode(after_path)
    changed = [(x, y) for y in range(96) for x in range(96) if before[y][x] != after[y][x]]
    summary[name] = {
        'changedPixels': len(changed),
        'changedBoundsInclusive': [min(x for x, y in changed), min(y for x, y in changed),
                                   max(x for x, y in changed), max(y for x, y in changed)],
        'beforeGridSha256': hashlib.sha256(before_path.read_bytes()).hexdigest(),
        'currentGridSha256': hashlib.sha256(after_path.read_bytes()).hexdigest(),
        'currentInkBoundsExclusive': after_image.getbbox(),
    }
    if name == 'attack':
        summary[name]['handRibbonRootUnchanged'] = all(before[y][59:67] == after[y][59:67]
                                                      for y in range(50, 54))
        summary[name]['wideWhipArcUnchanged'] = all(before[y][65:96] == after[y][65:96]
                                                   for y in range(51, 85))
    if name == 'skill_c':
        summary[name]['dispersedShardsUnchanged'] = all(before[y][70:96] == after[y][70:96]
                                                       for y in range(35, 57))
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
native.save(ROOT / 'preview' / 'anatomy-before-after-1x.png')
large.save(ROOT / 'preview' / 'anatomy-before-after-3x.png')
(ROOT / 'preview' / 'anatomy-diagnostics.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
