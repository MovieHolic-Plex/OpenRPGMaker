"""Read the preserved and repaired literal grids for visual comparison only."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
PAL = {c: tuple(bytes.fromhex(rgb[1:]))
       for c, rgb in json.loads((ROOT / 'palette.json').read_text()).items()}

def decode(path):
    rows = path.read_text().splitlines()
    im = Image.new('RGBA', (64, 64))
    im.putdata([(0, 0, 0, 0) if c == '.' else (*PAL[c], 255)
                for row in rows for c in row])
    return im

for background, color in [('light', (232, 227, 215)),
                          ('dark', (38, 41, 51)), ('checker', None)]:
    board = Image.new('RGB', (704, 906), (68, 72, 80))
    labels = ImageDraw.Draw(board)
    for i, (kind, name) in enumerate([('actions', 'sleep_a'),
                                     ('actions', 'sleep_b'), ('poses', 'dead')]):
        for v, version in enumerate(['before-state-repair', 'current']):
            path = ROOT / kind / (name + '.pxgrid')
            if v == 0:
                path = ROOT / version / kind / (name + '.pxgrid')
            cel = decode(path)
            tile = Image.new('RGB', (64, 64), color or (195, 198, 202))
            if color is None:
                td = ImageDraw.Draw(tile)
                for y in range(0, 64, 8):
                    for x in range(0, 64, 8):
                        if (x // 8 + y // 8) % 2:
                            td.rectangle((x, y, x + 7, y + 7), fill=(142, 148, 158))
            tile.paste(cel, (0, 0), cel)
            bx = v * 352 + 8
            by = i * 302 + 28
            labels.text((bx, by - 19), name + ' / ' + ('before' if v == 0 else 'repaired'),
                        fill=(245, 245, 240))
            board.paste(tile, (bx, by))
            board.paste(tile.resize((256, 256), Image.Resampling.NEAREST), (bx + 80, by))
            labels.text((bx, by + 72), '1x', fill=(245, 245, 240))
            labels.text((bx + 80, by + 264), '4x nearest', fill=(245, 245, 240))
    board.save(ROOT / 'preview' / ('state-repair-' + background + '.png'))
