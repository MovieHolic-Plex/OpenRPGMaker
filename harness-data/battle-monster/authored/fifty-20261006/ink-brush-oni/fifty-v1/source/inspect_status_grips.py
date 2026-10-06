"""Read literal grids for before/after diagnostics only; never edit art."""
from pathlib import Path
from PIL import Image, ImageDraw
import json

ROOT = Path(__file__).resolve().parent
PAL = json.loads((ROOT / 'palette.json').read_text())


def art(path):
    im = Image.new('RGBA', (96, 96))
    for y, row in enumerate(path.read_text().splitlines()):
        for x, ch in enumerate(row):
            if ch != '.':
                im.putpixel((x, y), tuple(bytes.fromhex(PAL[ch][1:])) + (255,))
    return im


for mode in ['light', 'dark', 'checker']:
    board = Image.new('RGB', (816, 3 * 430), (48, 50, 54))
    labels = ImageDraw.Draw(board)
    for i, (name, crop) in enumerate([
        ('skill_c', (59, 42, 80, 63)),
        ('poison_a', (35, 64, 57, 80)),
        ('poison_b', (35, 64, 57, 80)),
    ]):
        for j, directory in enumerate([
            ROOT / 'originals/before-status-grip-repair', ROOT
        ]):
            bg = Image.new('RGBA', (96, 96), (235, 231, 218, 255)
                           if mode == 'light' else (34, 37, 43, 255))
            if mode == 'checker':
                for y in range(96):
                    for x in range(96):
                        v = 105 if (x // 8 + y // 8) % 2 else 160
                        bg.putpixel((x, y), (v, v, v, 255))
            bg.alpha_composite(art(directory / 'actions' / (name + '.pxgrid')))
            bx, by = j * 408 + 8, i * 430 + 22
            labels.text((bx, by - 16), name + (' before' if j == 0 else ' after'),
                        fill=(240, 240, 232))
            board.paste(bg.convert('RGB'), (bx, by))
            detail = bg.crop(crop)
            board.paste(detail.resize((detail.width * 4, detail.height * 4),
                                     Image.Resampling.NEAREST).convert('RGB'),
                        (bx + 110, by + 8))
            board.paste(bg.resize((288, 288), Image.Resampling.NEAREST).convert('RGB'),
                        (bx, by + 110))
    board.save(ROOT / 'previews' / ('status-grip-' + mode + '.png'))
