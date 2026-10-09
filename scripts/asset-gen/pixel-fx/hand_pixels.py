"""Decode explicitly authored pixel rows. No shapes, tweening, or palette remapping.

Pieces are placed at their written native coordinates; named pieces can be kept
at exactly the same coordinates in several cels (e.g. a dragon's stationary torso).
The expanded .px.json is compatible with pixel-dot-authoring/scripts/pixelgrid.py.
"""
import json
from functools import lru_cache
from pathlib import Path

HERE = Path(__file__).resolve().parent / 'hand-authored'


@lru_cache(maxsize=None)
def load(key):
    study = HERE / f'{key}.study.px.json'
    if study.exists():
        doc = json.loads(study.read_text())
        assert doc['version'] == 1 and len(doc['palette']) <= 16
        return doc
    doc = json.loads((HERE / f'{key}.hand.json').read_text())
    assert doc['version'] == 1 and doc['key'] == key
    width, height = doc['width'], doc['height']
    palette = doc['palette']
    assert '.' not in palette and len(palette) <= 16
    frames = []
    for index, authored in enumerate(doc['frames']):
        grid = [['.'] * width for _ in range(height)]
        for item in authored['pieces']:
            piece = doc.get('pieces', {}).get(item.get('ref'), item)
            x, y = piece['x'], piece['y']
            assert type(x) is int and type(y) is int and 0 <= x < width and 0 <= y < height
            for dy, row in enumerate(piece['rows']):
                assert y + dy < height and x + len(row) <= width, (key, index, dy)
                for dx, symbol in enumerate(row):
                    assert symbol == '.' or symbol in palette, (key, index, dy, dx, symbol)
                    if symbol != '.':
                        grid[y + dy][x + dx] = symbol
        anchor = [width // 2, height // 2 if doc['anchor'] == 'screen' else height - 8]
        frames.append(dict(id=f'f{index:02}', phase=authored['phase'],
                           durationMs=doc['frameMs'], anchor=anchor,
                           rows=[''.join(row) for row in grid]))
    return dict(version=1, width=width, height=height, maxColors=16,
                palette=palette, frames=frames)


def export_grid(key):
    path = HERE / f'{key}.px.json'
    path.write_text(json.dumps(load(key), ensure_ascii=False, indent=2) + '\n')
    return path


def mage_setup(key):
    from lib_mage import Pal
    source = load(key)
    export_grid(key)
    symbols = list(source['palette'])
    palette = Pal(P=[source['palette'][symbol] for symbol in symbols])
    indices = dict(zip(symbols, palette.P))

    def draw(cel, frame):
        for y, row in enumerate(source['frames'][frame]['rows']):
            for x, symbol in enumerate(row):
                if symbol != '.':
                    cel.px(x, y, indices[symbol])

    return palette, draw


def scout_setup(key):
    source = load(key)
    export_grid(key)

    def draw(cel, frame):
        for y, row in enumerate(source['frames'][frame]['rows']):
            for x, symbol in enumerate(row):
                if symbol != '.':
                    cel.px(x, y, symbol)

    return source['palette'], draw


if __name__ == '__main__':
    import sys
    for key in sys.argv[1:]:
        print(export_grid(key))
