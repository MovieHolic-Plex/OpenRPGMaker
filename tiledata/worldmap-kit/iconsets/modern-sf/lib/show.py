"""아이콘을 배경 위에 확대해 나란히. python3 show.py out.png 배율 이름,이름 [grass|sand|rock]"""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import numpy as np
from PIL import Image, ImageDraw
GROUNDS = {'grass': (65, 157, 57), 'sand': (215, 170, 115), 'rock': (140, 90, 33)}
SHADOW_MUL = np.array([.64, .70, .82])


def on_ground(arr, ground=GROUNDS['grass']):
    h, w = arr.shape[:2]
    g = np.zeros((h, w, 3), np.uint8); g[:] = ground
    key = np.all(arr == np.array([255, 103, 139], np.uint8), -1)
    shd = np.all(arr == np.array([254, 103, 139], np.uint8), -1)
    out = g.copy()
    out[shd] = (g[shd] * SHADOW_MUL).astype(np.uint8)
    out[~key & ~shd] = arr[~key & ~shd]
    return out


def sheet(arrs, z, labels=None, ground=GROUNDS['grass'], width=1700):
    ims = []
    for i, a in enumerate(arrs):
        g = on_ground(a, ground)
        ims.append(((labels or [''] * len(arrs))[i], Image.fromarray(g).resize((g.shape[1] * z, g.shape[0] * z), Image.NEAREST)))
    rows, cur, cw = [], [], 0
    for lab, im in ims:
        if cw + im.width + 12 > width and cur:
            rows.append(cur); cur, cw = [], 0
        cur.append((lab, im)); cw += im.width + 12
    rows.append(cur)
    H = sum(max(i.height for _, i in r) + 18 for r in rows)
    W = max(sum(i.width + 12 for _, i in r) for r in rows)
    s = Image.new('RGB', (W, H), (30, 30, 34)); d = ImageDraw.Draw(s)
    y = 0
    for r in rows:
        x = 0
        for lab, im in r:
            d.text((x + 2, y + 3), lab, fill=(230, 230, 230)); s.paste(im, (x, y + 16)); x += im.width + 12
        y += max(i.height for _, i in r) + 18
    return s


if __name__ == '__main__':
    import scenes_msf as sc
    sc.SOFT[0] = True
    out = sys.argv[1]; z = int(sys.argv[2]); names = sys.argv[3].split(',')
    gr = GROUNDS[sys.argv[4]] if len(sys.argv) > 4 else GROUNDS['grass']
    arrs = []
    for n in names:
        try:
            a, st = sc.ICONS[n](); arrs.append(a)
            print(n, a.shape[1] // 16, 'x', a.shape[0] // 16, st['all'], sc.FIT.get(n))
        except ValueError as e:
            print('FIT-FAIL', e)
    sheet(arrs, z, names, gr).save(out)
