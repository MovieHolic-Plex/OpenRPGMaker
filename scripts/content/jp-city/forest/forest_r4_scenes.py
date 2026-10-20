#!/usr/bin/env python3
"""숲 r4 검수 장면 — r3 와 같은 모양 5종(덩이·띠·L·빈터 고리·물/길/집 맞닿음)을 나무 composer 로 칠한다. 붓 시험 GIF 는 붓질마다
바뀐 칸 둘레만 다시 짠다(편집기 붓과 같은 국소 재구성).

  python3 forest_r4_scenes.py OUT [--kinds bl] [--gif]
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import forest_r3 as F  # noqa: E402
import forest_r3_scenes as S3  # noqa: E402
import forest_r4_compose as C  # noqa: E402
LOCAL = os.environ.get('JPF_COMPOSE', 'local') == 'local'

T = 16


def scene(sp, S, name, M, gfn):
    H, W = M.shape
    avoid = None
    if name == 'touching':
        avoid = np.zeros((H, W), bool); avoid[9:15, 3:12] = True; avoid[:, 14:16] = True
        k = S3.KITS['jp-bldg-house-shed-modern']; avoid[9:9 + k['height'], 17:17 + k['width']] = True
    img = C.render(gfn(), (C.compose_local if LOCAL else C.compose)(M, S, avoid=avoid), S, mask=M, avoid=avoid, base=S3.tile(S3.GRASS)) if S.sp != 'bd' else C.render(gfn(), C.compose_local(M, S, avoid=avoid), S)
    if name == 'touching': S3.stamp_kit(img, 'jp-bldg-house-shed-modern', 17, 9)
    return img


def paint_gif(S, path, scale=2):
    Wd, H = 24, 14
    base = S3.ground(Wd, H)
    M = np.zeros((H, Wd), bool)
    strokes = [(4 + t * 0.4, 4 + 2.5 * np.sin(t * 0.3), 1.6) for t in range(40)]
    strokes += [(16 + 0.2 * t, 4 + t * 0.4, 1.0) for t in range(22)]
    strokes += [(19 + t * 0.25, 11.5, 0.6) for t in range(18)]
    yy, xx = np.mgrid[0:H, 0:Wd]
    frames = []; prev = []
    for k, (cx, cy, r) in enumerate(strokes):
        add = ((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 <= r * r) & ~M
        if add.any():
            M |= add
            ch = [(int(x), int(y)) for y, x in zip(*np.nonzero(add))]
            prev = C.compose_local(M, S) if LOCAL else C.recompose(M, S, prev, ch)
        if k % 2: continue
        im = Image.fromarray(C.render(base, prev, S, mask=M if S.sp != 'bd' else None, base=S3.tile(S3.GRASS))).resize((Wd * T * scale, H * T * scale), Image.NEAREST)
        frames.append(im.convert('P', palette=Image.ADAPTIVE, colors=255))
    for _ in range(6): frames.append(frames[-1])
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=120, loop=0)
    return prev, M


if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    kinds = sys.argv[sys.argv.index('--kinds') + 1].split(',') if '--kinds' in sys.argv else ['bl']
    Image.fromarray(S3.beodeul_ref()).save(os.path.join(out, 'ref-beodeul.png'))
    for sp in kinds:
        S = C.BeodeulSprites() if sp == 'bd' else C.Sprites(sp)
        for name, desc, Wd, H, M, gfn in S3.shapes():
            Image.fromarray(scene(sp, S, name, M, gfn)).save(os.path.join(out, f'{sp}-{name}.png'))
        print(sp, 'scenes ok', flush=True)
        if '--gif' in sys.argv:
            paint_gif(S, os.path.join(out, f'{sp}-paint.gif')); print(sp, 'gif ok', flush=True)
