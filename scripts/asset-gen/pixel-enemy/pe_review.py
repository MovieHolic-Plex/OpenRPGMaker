"""Extra review for retro2003 monster sheets: strict checks + 2x cycle GIF.

Checks: sheet is cell*3 square, alpha 0/255 only, <=32 colors, no empty cell,
every cell differs from every other, baseline (ground species touch y=cell-4 in
every non-airborne cell; floating species only in dead). Prints one line per sheet.
"""
from pathlib import Path
from PIL import Image
from pe_lib import ROOT, NAMES, BG

SEQ = [0, 1, 2, 1, 0, 1, 2, 1, 3, 4, 5, 6, 7, 8]
MS = [200] * 8 + [320, 240, 320, 360, 360, 1200]


def frames_of(sheet, cell):
    return [sheet.crop((i % 3 * cell, i // 3 * cell, i % 3 * cell + cell, i // 3 * cell + cell)) for i in range(9)]


def review(name, cell, airborne=()):
    """airborne: cell names allowed to float above the floor (all but dead for floaters)."""
    sheet = Image.open(ROOT / f'public/assets/generated/pixel-enemies/{name}.png').convert('RGBA')
    assert sheet.size == (cell * 3, cell * 3), sheet.size
    alpha = set(sheet.getchannel('A').tobytes())
    assert alpha <= {0, 255}, alpha
    colors = {c for _, c in sheet.getcolors(cell * cell * 9) if c[3]}
    assert len(colors) <= 32, len(colors)
    frames = frames_of(sheet, cell)
    base = cell - 4
    bottoms, minimum = {}, None
    for n, im in zip(NAMES, frames):
        box = im.getbbox()
        assert box, f'{name}:{n} empty'
        bottoms[n] = box[3] - 1
        if n not in airborne:
            assert box[3] - 1 == base, f'{name}:{n} bottom {box[3]-1} != {base}'
        else:
            assert box[3] - 1 <= base, (n, box)
    for i in range(9):
        for j in range(i + 1, 9):
            a, b = frames[i].tobytes(), frames[j].tobytes()
            diff = sum(1 for k in range(3, len(a), 4) if a[k - 3:k + 1] != b[k - 3:k + 1])
            assert diff >= 12, f'{name}: {NAMES[i]} vs {NAMES[j]} only {diff}px differ'
            minimum = diff if minimum is None else min(minimum, diff)
    qa = ROOT / f'.omo/pixel-enemy-{name}'
    gif = []
    for i in SEQ:
        im = Image.new('RGBA', (cell, cell), BG); im.alpha_composite(frames[i])
        gif.append(im.convert('RGB').resize((cell * 2, cell * 2), Image.Resampling.NEAREST))
    gif[0].save(qa / 'cycle.gif', save_all=True, append_images=gif[1:], duration=MS, loop=0, disposal=2, optimize=False)
    print(f'{name}: {sheet.width}x{sheet.height} alpha={sorted(alpha)} colors={len(colors)} '
          f'nonempty=9 min_cell_diff={minimum}px base={base} bottoms={bottoms}')

