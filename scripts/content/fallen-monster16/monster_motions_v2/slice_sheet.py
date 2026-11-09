# monster-motions-v2: one ChatGPT 4x4 pose sheet -> engine 4x4 sheet (96px cells), code only.
# usage: python3 slice_sheet.py <sheet.png> <outDir> <idleWidthArtPx> [--empty 13] [--hover N]
#  - keys out magenta, splits the image into a 4x4 grid (equal cells), takes the biggest opaque blob per grid cell
#  - ONE scale for all poses (idle width -> idleWidthArtPx), unfake dominant downscale, palette from idle_a applied to all
#  - feet on GROUND (or hovering monsters keep their bottom at GROUND-HOVER), centred on CX; alpha 0/255
import json, os, subprocess, sys
import numpy as np
from PIL import Image
from scipy import ndimage

U = '/home/main/claude-viz/gif-pixel-refine/tools/unfake'
TMP = os.environ.get('TMPDIR', '/tmp')
CELL, GROUND, CX = 96, 92, 48
NCOL = int(os.environ.get('NCOL', '16'))
# ChatGPT reading order (1..16) -> engine index. engine: 0 idle_a 1 idle_b 2 idle_c 3 windup 4 move 5 attack 6 recover 7 hit 8 dead
# 9 attack_mid 10 cast_charge 11 cast_release 12 guard 13 weak 14 intro 15 reserved
ENGINE = {i: i for i in range(20)}
NAMES = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead', 'attack_mid', 'cast_charge', 'cast_release', 'guard', 'weak', 'intro', 'reserved']
COLS = int(os.environ.get('COLS', '4'))
if COLS == 5:
    NAMES = NAMES[:15] + ['move_b', 'hit_b', 'attack_b', 'stunned', 'enrage']
N = 20 if COLS == 5 else 16
ROWS = 4


def key_alpha(a):
    a = a.astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    magenta_ish = (r - g > 50) & (b - g > 50) & (np.abs(r - b) < 110)
    key = (a[..., 3] < 128) | ((r > 150) & (b > 150) & (g < 120) & (np.abs(r - b) < 90)) | magenta_ish
    out = a.copy(); out[..., 3] = np.where(key, 0, 255); out[key, :3] = 0
    return out.astype(np.uint8)


def blob(a):
    op = a[..., 3] > 0
    lab, n = ndimage.label(ndimage.binary_dilation(op, iterations=3))
    if n == 0: return None
    sizes = ndimage.sum(op, lab, range(1, n + 1))
    keep = (lab == (int(np.argmax(sizes)) + 1)) & op
    out = a.copy(); out[~keep] = 0
    ys, xs = np.nonzero(keep)
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def downscale(arr, scale, tag):
    src, mid = f'{TMP}/ss-{tag}.png', f'{TMP}/ss-{tag}-d.png'
    im = Image.fromarray(arr, 'RGBA')
    pad = Image.new('RGBA', (im.width + 24, im.height + 24)); pad.paste(im, (12, 12))
    bg = Image.new('RGB', pad.size, (255, 0, 255)); bg.paste(pad.convert('RGB'), (0, 0), pad); bg.save(src)
    subprocess.run([U, 'downscale', '-s', f'{scale:.4f}', '-m', 'mode', '--no-elastic', src, '-o', mid], check=True, capture_output=True)
    k = key_alpha(np.array(Image.open(mid).convert('RGBA')))
    return Image.fromarray(k, 'RGBA')


def make_palette(im):
    a = np.array(im); op = a[..., 3] == 255
    rgb = Image.fromarray(np.where(op[..., None], a[..., :3], 0).astype(np.uint8), 'RGB')
    q = rgb.quantize(NCOL + 1, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = np.array(q.getpalette()[:3 * (NCOL + 1)]).reshape(-1, 3)
    pal = pal[np.unique(np.array(q)[op])].astype(int)
    px = a[op][:, :3].astype(int)
    for _ in range(4):
        d = np.sqrt(((px[:, None] - pal[None]) ** 2).sum(-1)).min(1)
        far = px[d > 70]
        if len(far) < 3: break
        cols, cnt = np.unique(far, axis=0, return_counts=True)
        add = far.mean(0).round().astype(int) if cnt.max() < 3 else cols[cnt.argmax()]
        if (np.abs(pal - add).sum(1) < 30).any(): break
        pal = np.vstack([pal, add])
    return pal


def apply_palette(im, pal):
    a = np.array(im).astype(int); op = a[..., 3] == 255
    d = ((a[..., None, :3] - pal[None, None]) ** 2).sum(-1)
    a[..., :3] = np.where(op[..., None], pal[d.argmin(-1)], 0); a[..., 3] = np.where(op, 255, 0)
    a[~op, :3] = 0
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def main():
    src, out, idle_w = sys.argv[1], sys.argv[2], int(sys.argv[3])
    empty = set()
    hover = 0
    for i, x in enumerate(sys.argv):
        if x == '--empty': empty = {int(v) for v in sys.argv[i + 1].split(',') if v}
        if x == '--hover': hover = int(sys.argv[i + 1])
    os.makedirs(out, exist_ok=True)
    a = key_alpha(np.array(Image.open(src).convert('RGBA')))
    H, W = a.shape[:2]
    raw = {}
    for gi in range(N):
        r, c = divmod(gi, COLS)
        sub = a[r * H // ROWS:(r + 1) * H // ROWS, c * W // COLS:(c + 1) * W // COLS]
        if gi in empty or (N == 16 and gi == 15): continue
        b = blob(sub)
        if b is None: raise SystemExit(f'cell {gi} ({NAMES[gi]}) empty in source')
        raw[gi] = b
    s = raw[0].shape[1] / idle_w
    red0 = downscale(raw[0], s, 'g0')
    w0 = red0.getbbox()[2] - red0.getbbox()[0]
    s = s * w0 / idle_w
    reds = {gi: downscale(b, s, f'g{gi}') for gi, b in raw.items()}
    pal = make_palette(reds[0])
    reds = {gi: apply_palette(x, pal) for gi, x in reds.items()}
    sheet = Image.new('RGBA', (CELL * COLS, CELL * ROWS))
    meas = {'src': list(a.shape[:2]), 'scale': round(s, 3), 'colors': len(pal), 'cells': {}}
    floor = GROUND - hover
    for gi, im in reds.items():
        bb = im.getbbox(); crop = im.crop(bb)
        w, h = crop.size
        name = NAMES[ENGINE[gi]]
        bottom = GROUND if name in ('dead',) else floor
        x = round(CX - w / 2); x = max(0, min(CELL - w, x))
        y = bottom + 1 - h
        clipped = y < 0 or w > CELL
        if y < 0: crop = crop.crop((0, -y, w, h)); y = 0
        cell = Image.new('RGBA', (CELL, CELL)); cell.paste(crop, (x, y), crop)
        cell.save(f'{out}/{ENGINE[gi]:02d}-{name}.png')
        sheet.alpha_composite(cell, ((ENGINE[gi] % COLS) * CELL, (ENGINE[gi] // COLS) * CELL))
        meas['cells'][name] = {'wh': [w, h], 'bottom': y + crop.size[1], 'clipped': clipped}
    arr = np.array(sheet); arr[arr[..., 3] == 0] = 0
    assert set(np.unique(arr[..., 3])) <= {0, 255}
    Image.fromarray(arr).save(f'{out}/sheet-{COLS}x4.png')
    big = Image.new('RGBA', sheet.size, (34, 38, 46, 255)); big.alpha_composite(sheet)
    big.resize((sheet.width * 3, sheet.height * 3), Image.NEAREST).save(f'{out}/sheet-x3.png')
    meas['palette'] = ['#%02x%02x%02x' % tuple(int(v) for v in p) for p in pal]
    meas['missing'] = sorted(set(range(9, N if N == 20 else 15)) - set(ENGINE[g] for g in reds))
    json.dump(meas, open(f'{out}/measure.json', 'w'), indent=1)
    print(json.dumps(meas))


if __name__ == '__main__':
    main()
