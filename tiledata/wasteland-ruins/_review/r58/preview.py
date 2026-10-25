"""r58 판석 미리보기(굽지 않음): wl_ground 함수로 직접 그린다."""
import sys, os, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', '..', 'scripts', 'content', 'wasteland-ruins'))
import numpy as np
from PIL import Image
t0 = time.time()
import wl_ground as G
from wl_core import PIECES, render, h2
out = sys.argv[1] if len(sys.argv) > 1 else HERE
os.makedirs(out, exist_ok=True)
R = {k: render(PIECES['slab-' + k]) for k in 'abc'}
def board(w, h, seed=7, dirt_border=False):
    a = np.zeros((h * 16, w * 16, 4), np.uint8)
    for y in range(h):
        for x in range(w):
            q = h2(x + 3, y + 5, seed) % 10
            k = 'a' if q < 6 else ('b' if q < 8 else 'c')
            cx, cy = x % 8, y % 8
            a[y*16:(y+1)*16, x*16:(x+1)*16] = R[k][cy*16:(cy+1)*16, cx*16:(cx+1)*16]
    return a
for k in 'abc':
    Image.fromarray(R[k]).resize((512, 512), 0).save(os.path.join(out, f'slab-{k}-4x.png'))
b = board(14, 10)
Image.fromarray(b).save(os.path.join(out, 'board-14x10-1x.png'))
Image.fromarray(b).resize((b.shape[1]*3, b.shape[0]*3), 0).save(os.path.join(out, 'board-14x10-3x.png'))
B = board(36, 24, seed=11)
Image.fromarray(B).save(os.path.join(out, 'board-36x24-1x.png'))
Image.fromarray(B).resize((B.shape[1]*2, B.shape[0]*2), 0).save(os.path.join(out, 'board-36x24-2x.png'))
for k in 'abc':
    s = PIECES['slab-' + k]['sample']()
    Image.fromarray(s).save(os.path.join(out, f'gate-slab-{k}.png'))
print('ok', round(time.time() - t0, 1), 's', G._SLAB_INFO['rects'].__len__(), 'slabs', '')
