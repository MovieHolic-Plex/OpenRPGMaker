"""Explicit eye-band edits and before/after rendering of source grids only.

Coordinates are zero-based and inclusive. No reference image pixels are read.
Nearest enlargement is used only for the review PNG, never for source art.
"""
from pathlib import Path
import json
import sys
from PIL import Image, ImageDraw

SOURCE = Path(__file__).resolve().parent
ORDER = ('idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack',
         'recover', 'hit', 'dead', 'skill_a', 'skill_b', 'skill_c',
         'poison_a', 'poison_b', 'stun_a', 'stun_b', 'sleep_a', 'sleep_b')
BANDS = {
    'idle_a': ((25, 20, 34, 23), ('pppuuupppu', 'puuuuuuuuu', 'pkeuuukepu', 'pwkuuuweku')),
    'idle_b': ((25, 20, 34, 23), ('pppuuupppu', 'puuuuuuuuu', 'pkeuuukepu', 'pwkuuuweku')),
    'idle_c': ((25, 20, 34, 23), ('pppuuupppu', 'puuuuuuuuu', 'pkeuuukepu', 'pwkuuuweku')),
    'windup': ((24, 22, 33, 25), ('pppuuupppu', 'puuuuuuuuu', 'pkeuuukepu', 'pwkuuuweku')),
    'move': ((27, 20, 36, 23), ('pppuuupppu', 'puuuuuuuuu', 'pkeuuukepu', 'pwkuuuweku')),
    'attack': ((22, 24, 31, 27), ('pppuuupppu', 'puuuuuuuuu', 'pkeuuukepu', 'pwkuuuweku')),
    'recover': ((24, 21, 33, 24), ('pppuuupppu', 'puuuuuuuuu', 'pkeuuukepu', 'pwkuuuweku')),
    'hit': ((20, 21, 29, 24), ('ppuupuuupp', 'puuuuuuuuu', 'pkeuuukepu', 'ptwkuuuwek')),
    'dead': ((20, 43, 31, 46), ('kpuuuuuuuutt', 'puuuuuuuuutt', 'pueeeuuueept', 'ptuuuuuuuutt')),
    'skill_a': ((26, 22, 35, 25), ('pppuuupppu', 'puuuuuuuuu', 'pkeuuukepu', 'pwkuuuweku')),
    'skill_b': ((26, 22, 35, 25), ('pppuuupppu', 'puuuuuuuuu', 'pkeuuukepu', 'pwkuuuweku')),
    'skill_c': ((24, 21, 33, 24), ('pppuuupppu', 'puuuuuuuuu', 'pkeuuukepu', 'pwkuuuweku')),
    'poison_a': ((23, 23, 33, 26), ('kppuupuuupp', 'kpuuuuuuuuu', 'kpekuuuuepu', 'kptwkuuuwek')),
    'poison_b': ((21, 24, 31, 27), ('kppuupuuupp', 'kpuuuuuuuuu', 'kpekuuuuepu', 'kptwkuuuwek')),
    'stun_a': ((24, 22, 33, 25), ('pppuuupppu', 'puuuuuuuuu', 'pkeuuukepu', 'pwkuuuweku')),
    'stun_b': ((25, 23, 34, 26), ('pppuuupppu', 'puuuuuuuuu', 'pkeuuukepu', 'pwkuuuweku')),
    'sleep_a': ((24, 24, 34, 27), ('pppuuupppuu', 'puuuuuuuuuu', 'pteeuuueept', 'pttuuuuuuuu')),
    'sleep_b': ((24, 24, 34, 27), ('pppuuupppuu', 'puuuuuuuuuu', 'pteeuuueept', 'pttuuuuuuuu')),
}

# Every final short run is chosen explicitly; no frame or eye is transformed.
# Each entry is (native x, native y, literal replacement ink).
PATCHES = {
    'idle_a': ((25, 20, 'puuppuuppu'),
               (25, 22, 'puuekuueku'),
               (25, 23, 'puuukuuwku')),
    'idle_b': ((25, 20, 'puuppuuppu'),
               (25, 22, 'puuekuueku'),
               (25, 23, 'puuukuuwku')),
    'idle_c': ((25, 20, 'puuppuuppu'),
               (25, 22, 'puuekuueku'),
               (25, 23, 'puuukuuwku')),
    'windup': ((24, 22, 'puuppuuppu'),
               (24, 24, 'puuekuueku'),
               (24, 25, 'puuukuuwku')),
    'move': ((27, 20, 'puuppuuppu'),
             (27, 22, 'puuekuueku'),
             (27, 23, 'puuukuuwku')),
    'attack': ((22, 24, 'puuppuuppu'),
               (22, 26, 'puuekuueku'),
               (22, 27, 'puuukuuwku')),
    'recover': ((24, 21, 'puuppuuppu'),
                (24, 23, 'puuekuueku'),
                (24, 24, 'puuukuuwku')),
    # Unequal warm brow tones retain the recoiling, strained expression.
    # The low eye row keeps the existing left cheek's t shadow.
    'hit': ((20, 21, 'puutpuuptu'),
            (20, 23, 'puuekuueku'),
            (20, 24, 'ptuukuuwku')),
    # Closed warm lids only. No brows or open eyes are added to the fallen face.
    'dead': ((20, 45, 'puuueeuueett'),),
    'skill_a': ((26, 22, 'puuppuuppu'),
                (26, 24, 'puuekuueku'),
                (26, 25, 'puuukuuwku')),
    'skill_b': ((26, 22, 'puuppuuppu'),
                (26, 24, 'puuekuueku'),
                (26, 25, 'puuukuuwku')),
    'skill_c': ((24, 21, 'puuppuuppu'),
                (24, 23, 'puuekuueku'),
                (24, 24, 'puuukuuwku')),
    # Preserve the k side-hair edge, p skin edge, and low t cheek shadow.
    'poison_a': ((23, 23, 'kpuutpuuptu'),
                 (23, 25, 'kpuuekuueku'),
                 (23, 26, 'kptuukuuwku')),
    'poison_b': ((21, 24, 'kpuutpuuptu'),
                 (21, 26, 'kpuuekuueku'),
                 (21, 27, 'kptuukuuwku')),
    # Keep both eyes open but omit the bright lower sclera in the dazed faces.
    'stun_a': ((24, 22, 'puuppuuppu'),
               (24, 24, 'puuekuueku'),
               (24, 25, 'puuukuuuku')),
    'stun_b': ((25, 23, 'puuppuuppu'),
               (25, 25, 'puuekuueku'),
               (25, 26, 'puuukuuuku')),
    # Two short e lids remain closed; restore t where the far old lid ended.
    'sleep_a': ((24, 24, 'puuppuuppuu'),
                (24, 26, 'ptteeuueeut')),
    'sleep_b': ((24, 24, 'puuppuuppuu'),
                (24, 26, 'ptteeuueeut')),
}


def grid_path(name):
    return SOURCE / ('poses' if name in ORDER[:9] else 'actions') / (name + '.pxgrid')


def apply_edits():
    for name, runs in PATCHES.items():
        path = grid_path(name)
        original = path.read_bytes()
        rows = original.splitlines(keepends=True)
        x0, y0, x1, y1 = BANDS[name][0]
        for x, y, ink in runs:
            if not (x0 <= x and x + len(ink) - 1 <= x1 and y0 <= y <= y1):
                raise ValueError('Run outside supplied eye band: ' + name)
            new = ink.encode('ascii')
            old = rows[y][x:x + len(new)]
            if b'.' in old or b'.' in new:
                raise ValueError('Eye edit would touch transparency: ' + name)
            rows[y] = rows[y][:x] + new + rows[y][x + len(new):]
        final = b''.join(rows)
        if final != original:
            path.write_bytes(final)
        print(name + ': explicit eye/brow runs saved')


def sprite(rows, palette):
    result = Image.new('RGBA', (64, 64))
    result.putdata([palette.get(symbol, (0, 0, 0, 0)) for row in rows for symbol in row])
    return result


def render_board():
    palette = {symbol: tuple(bytes.fromhex(color[1:])) + (255,)
               for symbol, color in json.loads((SOURCE / 'palette.json').read_text()).items()}
    board = Image.new('RGB', (1392, 1644), '#DDE3DA')
    draw = ImageDraw.Draw(board)
    draw.text((12, 8), 'EYE PLACEMENT / source pixels / BEFORE left, AFTER right / native + nearest 8x face', fill='#263A3B')
    for index, name in enumerate(ORDER):
        left, top = (index % 3) * 464, 28 + (index // 3) * 268
        rows = grid_path(name).read_text().splitlines()
        before = list(rows)
        (x0, y0, x1, y1), old_band = BANDS[name]
        for y, ink in enumerate(old_band, y0):
            before[y] = before[y][:x0] + ink + before[y][x1 + 1:]
        draw.rectangle((left + 2, top + 2, left + 461, top + 263), outline='#B2BEB4')
        draw.text((left + 10, top + 8), name + f'   band x{x0}..{x1}, y{y0}..{y1}', fill='#263A3B')
        for offset, label, face_rows in ((0, 'BEFORE', before), (232, 'AFTER', rows)):
            image = sprite(face_rows, palette)
            draw.text((left + offset + 12, top + 36), label, fill='#263A3B')
            draw.text((left + offset + 12, top + 54), '1x ->', fill='#53665D')
            board.paste(image, (left + offset + 136, top + 27), image)
            face = image.crop((x0 - 7, y0 - 6, x0 + 17, y0 + 12))
            face = face.resize((192, 144), Image.Resampling.NEAREST)
            board.paste(face, (left + offset + 16, top + 100), face)
    output = SOURCE / 'inspection' / 'eye-placement-review.png'
    output.parent.mkdir(exist_ok=True)
    board.save(output)
    print(str(output))


if __name__ == '__main__':
    if '--apply' in sys.argv:
        apply_edits()
    render_board()
