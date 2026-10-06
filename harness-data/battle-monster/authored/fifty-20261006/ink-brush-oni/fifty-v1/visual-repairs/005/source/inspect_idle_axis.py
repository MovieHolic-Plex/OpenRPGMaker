"""Render native and nearest 3x diagnostics; never modify palette or grids."""
from pathlib import Path
from PIL import Image, ImageDraw
import json

ROOT = Path(__file__).resolve().parent
PAL = json.loads((ROOT / 'palette.json').read_text())


def artwork(path):
    im = Image.new('RGBA', (96, 96))
    for y, row in enumerate(path.read_text().splitlines()):
        for x, symbol in enumerate(row):
            if symbol != '.':
                im.putpixel((x, y), tuple(bytes.fromhex(PAL[symbol][1:])) + (255,))
    return im


for mode in ['light', 'dark', 'checker']:
    board = Image.new('RGB', (650, 3 * 418), (48, 50, 54))
    labels = ImageDraw.Draw(board)
    for i, name in enumerate(['idle_a', 'idle_b', 'idle_c']):
        for j, directory in enumerate([
            ROOT / 'originals' / 'before-idle-axis-repair', ROOT
        ]):
            bg = Image.new('RGBA', (96, 96), (235, 231, 218, 255)
                           if mode == 'light' else (34, 37, 43, 255))
            if mode == 'checker':
                for y in range(96):
                    for x in range(96):
                        v = 105 if (x // 8 + y // 8) % 2 else 160
                        bg.putpixel((x, y), (v, v, v, 255))
            bg.alpha_composite(artwork(directory / 'poses' / (name + '.pxgrid')))
            bx, by = j * 324 + 8, i * 418 + 22
            labels.text((bx, by - 16), name + (' before' if j == 0 else ' after'),
                        fill=(240, 240, 232))
            board.paste(bg.convert('RGB'), (bx, by))
            # The full 3x view sits beside native; closeup below isolates the axis.
            detail = bg.crop((60, 48, 84, 69))
            board.paste(detail.resize((72, 63), Image.Resampling.NEAREST).convert('RGB'),
                        (bx + 108, by + 24))
            board.paste(bg.resize((288, 288), Image.Resampling.NEAREST).convert('RGB'),
                        (bx, by + 104))
    board.save(ROOT / 'previews' / ('idle-axis-' + mode + '.png'))
