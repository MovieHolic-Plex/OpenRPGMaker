
# wolf-redo-scratch: ChatGPT pose GIF -> 96px cells (deterministic). usage: python3 reduce_wolf.py <posesDir> <outDir>
import json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageSequence
U = '/home/main/claude-viz/gif-pixel-refine/tools/unfake'
TMP = os.environ.get('TMPDIR', '/tmp')
CELL, GROUND, CX, IDLE_W, NCOL = 96, 92, 48, 82, 15
PICK = {'windup': -1, 'move': 1, 'attack': -1, 'skill': -1, 'hit': -1, 'dead': -1}

def key_alpha(im):
    a = np.array(im.convert('RGBA')).astype(int)
    key = (a[..., 3] < 128) | ((a[..., 0] > 170) & (a[..., 2] > 170) & (a[..., 1] < 110))
    a[..., 3] = np.where(key, 0, 255); a[key, :3] = 0
    return Image.fromarray(a.astype(np.uint8), 'RGBA')

def downscale(fr, scale, tag):
    src, mid = f'{TMP}/rw-{tag}.png', f'{TMP}/rw-{tag}-d.png'
    bg = Image.new('RGB', fr.size, (255, 0, 255)); bg.paste(fr.convert('RGB'), (0, 0), fr); bg.save(src)
    subprocess.run([U, 'downscale', '-s', f'{scale:.4f}', '-m', 'dominant', src, '-o', mid], check=True, capture_output=True)
    return key_alpha(Image.open(mid))

def frames(path):
    return [key_alpha(f.convert('RGBA').copy()) for f in ImageSequence.Iterator(Image.open(path))]

def make_palette(im):
    a = np.array(im); op = a[..., 3] == 255
    rgb = Image.fromarray(np.where(op[..., None], a[..., :3], 0).astype(np.uint8), 'RGB')
    q = rgb.quantize(NCOL + 1, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = np.array(q.getpalette()[:3 * (NCOL + 1)]).reshape(-1, 3)
    used = np.unique(np.array(q)[op])
    return pal[used]

def apply_palette(im, pal):
    a = np.array(im).astype(int); op = a[..., 3] == 255
    d = ((a[..., None, :3] - pal[None, None]) ** 2).sum(-1)
    a[..., :3] = np.where(op[..., None], pal[d.argmin(-1)], 0)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')

def place(sm, dx):
    bb = sm.getbbox(); c = Image.new('RGBA', (CELL, CELL))
    c.paste(sm, (dx, GROUND + 1 - bb[3]), sm)
    return c

def main(pd, out):
    os.makedirs(out, exist_ok=True)
    meas = {}
    idle = frames(f'{pd}/idle.gif')
    s = (idle[0].getbbox()[2] - idle[0].getbbox()[0]) / IDLE_W
    ired = [downscale(f, s, f'idle{i}') for i, f in enumerate(idle)]
    w0 = ired[0].getbbox()[2] - ired[0].getbbox()[0]
    s = s * w0 / IDLE_W  # unfake snaps to its own grid; correct once so idle_a is IDLE_W wide
    ired = [downscale(f, s, f'idle{i}') for i, f in enumerate(idle)]
    idle_h_canvas = Image.open(f'{pd}/idle.gif').height
    pal = make_palette(ired[0])
    ired = [apply_palette(x, pal) for x in ired]
    b0 = ired[0].getbbox(); dx0 = round(CX - (b0[0] + b0[2]) / 2)
    idle_cells = [place(x, dx0 - (ired[0].getbbox()[0] - x.getbbox()[0]) * 0) for x in ired]
    # idle frames share the same horizontal offset (same canvas) so the loop does not slide
    idle_cells = []
    for x in ired:
        c = Image.new('RGBA', (CELL, CELL)); bb = x.getbbox(); c.paste(x, (dx0, GROUND + 1 - bb[3]), x); idle_cells.append(c)
    idle_w = b0[2] - b0[0]
    meas['idle'] = {'gif': list(Image.open(f'{pd}/idle.gif').size), 'frames': len(idle), 'scale': round(s, 3), 'colors': len(pal), 'wh': [[c.getbbox()[2]-c.getbbox()[0], c.getbbox()[3]-c.getbbox()[1]] for c in idle_cells]}
    cells = {'idle_a': idle_cells[0], 'idle_b': idle_cells[1 % len(idle_cells)], 'idle_c': idle_cells[2 % len(idle_cells)]}
    for pose in PICK:
        p = f'{pd}/{pose}.gif'
        if not os.path.exists(p): meas[pose] = {'missing': True}; continue
        fr = frames(p); bb = fr[0].getbbox()
        sc = s * Image.open(p).height / idle_h_canvas  # same art-pixel size as idle (canvas height ratio)
        red = [apply_palette(downscale(f, sc, f'{pose}{i}'), pal) for i, f in enumerate(fr)]
        pick = red[PICK[pose]] if len(red) > 1 else red[0]
        r0 = pick.getbbox(); dx = round(CX - (r0[0] + r0[2]) / 2)  # centre the frame that goes into the sheet
        pb = pick.getbbox(); over = 0
        if pb[2] + dx > CELL: dx = CELL - pb[2]; over += 1  # crop tail side (left) keeps the head
        if pb[3] - pb[1] > GROUND + 1: over += 1
        cells[pose] = place(pick, dx)
        anim = [place(x, dx) for x in red]
        big = []
        for c in anim:
            b = Image.new('RGBA', (CELL * 3, CELL * 3), (34, 38, 46, 255)); b.alpha_composite(c.resize((CELL * 3, CELL * 3), Image.NEAREST)); big.append(b)
        big[0].save(f'{out}/{pose}-x3.gif', save_all=True, append_images=big[1:], duration=150, loop=0, disposal=2)
        cb = cells[pose].getbbox()
        meas[pose] = {'gif': list(Image.open(p).size), 'frames': len(fr), 'scale': round(sc, 3), 'oversize': over, 'wh': [cb[2]-cb[0], cb[3]-cb[1]], 'bottom': cb[3]}
    for k, c in cells.items(): c.save(f'{out}/{k}.png')
    json.dump({'palette': ['#%02x%02x%02x' % tuple(int(v) for v in p) for p in pal], **meas}, open(f'{out}/measure.json', 'w'), indent=1)
    print(json.dumps(meas))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
