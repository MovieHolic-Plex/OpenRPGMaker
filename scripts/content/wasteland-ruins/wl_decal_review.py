#!/usr/bin/env python3
"""r62 덧그림 검수 자료: 조각 판(진짜 흙 dirt-c/dirt-d 위 1x·3x) + 프로브 맵(1x) + 덧그림마다 3x 둘레 crop.
    python3 wl_decal_review.py <review-dir> <probe-out-dir>   (probe 는 VA_DUMP=1 bun scripts/qa/village-art-probe.mts --out <probe-out-dir>)"""
import glob, json, os, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wl_all  # noqa: F401
import wl_core as C
import numpy as np
from PIL import Image

PIDS = ['oil-stain-a', 'oil-stain-b', 'scorch-a', 'scorch-b', 'crop-bed-b', 'crop-bed-c']


def main(R, P):
    os.makedirs(R, exist_ok=True)
    dc, dd = C.render(C.PIECES['dirt-c']), C.render(C.PIECES['dirt-d'])
    for pid in PIDS:
        p = C.PIECES[pid]; a = C.render(p); w, h = p['w'] + 2, p['h'] + 2
        g = np.concatenate([dc[32:32 + h * 16, 16:16 + w * 16], dd[32:32 + h * 16, 16:16 + w * 16]], 1).copy()
        for ox in (0, w * 16):
            op = a[..., 3] == 255; blk = g[16:16 + a.shape[0], ox + 16:ox + 16 + a.shape[1]]; blk[op] = a[op]
        Image.fromarray(g).save(f'{R}/{pid}-1x.png')
        Image.fromarray(np.kron(g, np.ones((3, 3, 1), np.uint8))).save(f'{R}/{pid}-3x.png')
    pins = json.load(open(os.path.join(C.OUT, 'pins.json')))['cells']; inv = {v: k for k, v in pins.items()}
    ids = {pins[f'{pid}/0.0'] for pid in PIDS}
    for f in sorted(glob.glob(f'{P}/*.map.json')):
        m = json.load(open(f)); W, H = m['width'], m['height']; name = os.path.basename(f)[:-9]
        shutil.copy(f'{P}/{name}.png', f'{R}/map-{name}.png')
        im = Image.open(f'{P}/{name}.png'); pts = set()
        for key in ('lowerTiles', 'upperTiles', 'lowerOverlayTiles'):
            arr = m[key]; flat = arr if not isinstance(arr[0], list) else [t for row in arr for t in row]
            for i, t in enumerate(flat):
                if t in ids: pts.add((inv[t].split('/')[0], i % W, (i // W) % H))
        for (pid, x, y) in sorted(pts):
            x0 = max(0, min(im.width - 160, (x - 4) * 16)); y0 = max(0, min(im.height - 112, (y - 3) * 16))
            im.crop((x0, y0, x0 + 160, y0 + 112)).resize((480, 336), Image.NEAREST).save(f'{R}/crop-{name}-{pid}-{x}_{y}-3x.png')


if __name__ == '__main__': main(sys.argv[1], sys.argv[2])
