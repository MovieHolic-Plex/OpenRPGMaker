#!/usr/bin/env python3
"""r5 잔디 맞춤 / r6 접지(JPF_COMPARE=r6) 비교(1×): jp_city 실제 땅(잔디 3281·연못·길·집) 위 jp 활엽 — 맞춤 전(JPF_PAL=r4) / 후(r5),
옆에 버들항 잔디 위 버들항 bd-tree(같은 composer).

  python3 forest_r5_compare.py OUTDIR   → r5-{blob,touching}-{before,after,beodeul}.png
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def jp(out, tag):
    import forest_r3_scenes as S3
    import forest_r4_compose as C
    import forest_r4_scenes as SC
    S = C.Sprites('bl')
    for name, desc, Wd, H, M, gfn in S3.shapes():
        if name in ('blob', 'touching'):
            Image.fromarray(SC.scene('bl', S, name, M, gfn)).save(os.path.join(out, f'r5-{name}-{tag}.png'))


def beodeul(out):
    import forest_r3_scenes as S3
    import forest_r4_compose as C
    import forest_r4_scenes as SC
    ref = S3.beodeul_ref()
    grass = None
    src = ref[..., :3].astype(int)
    for y0 in range(0, src.shape[0] - 32, 4):
        for x0 in range(0, src.shape[1] - 32, 4):
            w = src[y0:y0 + 32, x0:x0 + 32]
            if (w[..., 1] > w[..., 0] + 20).all() and (w[..., 1] > 90).all():
                grass = ref[y0:y0 + 32, x0:x0 + 32]; break
        if grass is not None: break
    S = C.BeodeulSprites()
    for name, desc, Wd, H, M, gfn in S3.shapes():
        if name != 'blob': continue
        g = np.zeros((H * 16, Wd * 16, 4), np.uint8)
        for y in range(0, H * 16, 32):
            for x in range(0, Wd * 16, 32):
                g[y:y + 32, x:x + 32] = grass[:min(32, H * 16 - y), :min(32, Wd * 16 - x)]
        Image.fromarray(SC.scene('bd', S, name, M, lambda: g)).save(os.path.join(out, f'r5-{name}-beodeul.png'))


if __name__ == '__main__':
    out = sys.argv[1]
    if len(sys.argv) > 2:
        jp(out, sys.argv[2]); sys.exit(0)
    os.makedirs(out, exist_ok=True)
    if os.environ.get('JPF_COMPARE') == 'r6':      # r6 접지: 전 = r5(색 맞춤, 땅 그늘 없음) · 후 = r6
        runs = (('before', dict(JPF_PAL='r5', JPF_GROUND='r5')), ('after', dict(JPF_PAL='r5', JPF_GROUND='r6')))
    else:
        runs = (('before', dict(JPF_PAL='r4', JPF_GROUND='r5')), ('after', dict(JPF_PAL='r5', JPF_GROUND='r5')))
    for tag, env in runs:
        subprocess.run([sys.executable, __file__, out, tag], check=True, env=dict(os.environ, **env))
    beodeul(out)
