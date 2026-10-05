"""Load revised Joseon enemies from literal native64 pixel grids."""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent / 'refined-grids'


def frame(slug, pose):
    rows = (ROOT / slug / f'{pose}.pxgrid').read_text().splitlines()
    palette = json.loads((ROOT / f'{slug}.palette.json').read_text())
    if len(rows) != 64 or any(len(row) != 64 for row in rows):
        raise ValueError(f'Invalid native64 grid: {slug}/{pose}')
    colors = {symbol: tuple(bytes.fromhex(color.removeprefix('#'))) + (255,)
              for symbol, color in palette.items()}
    colors['.'] = (0, 0, 0, 0)
    image = Image.new('RGBA', (64, 64))
    pixels = image.load()
    for y, row in enumerate(rows):
        for x, symbol in enumerate(row):
            pixels[x, y] = colors[symbol]
    return image


def boar(pose):
    return frame('wild-boar', pose)


def straw(pose):
    return frame('straw-dokkaebi', pose)


def ghost(pose):
    return frame('maiden-ghost', pose)


def toad(pose):
    return frame('venom-toad', pose)


def rabbit(pose):
    return frame('mortar-rabbit', pose)


def guardian(pose):
    return frame('jangseung-spirit', pose)


def jar(pose):
    return frame('earthen-jar-fiend', pose)
