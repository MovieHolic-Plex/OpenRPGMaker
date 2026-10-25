"""r59 판석 미리보기(굽지 않음): wl_ground 로 직접 그린다. 인자: 출력 폴더."""
import sys, os, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', '..', 'scripts', 'content', 'wasteland-ruins'))
import numpy as np
from PIL import Image
t0 = time.time()
import wl_all
import wl_ground as G
from wl_core import PIECES, render, h2, palette_issues
out = sys.argv[1] if len(sys.argv) > 1 else HERE
os.makedirs(out, exist_ok=True)
R = {k: render(PIECES['slab-' + k]) for k in 'abcde'}
for k in 'abcde':
    Image.fromarray(R[k]).resize((512, 512), 0).save(os.path.join(out, f'slab-{k}-4x.png'))
    iss = palette_issues(R[k], k)
    if iss: print('PALETTE', k, iss[:3])
# 경계 띠 같은가
for k in 'de':
    A, D = R['a'], R[k]
    m = np.zeros((128, 128), bool); m[:8] = m[-8:] = True; m[:, :8] = m[:, -8:] = True
    diff = (A[m] != D[m]).any(-1).sum()
    print('band diff a vs', k, diff)
print('missed marks', G.SLAB_MISSED)
# 경계 띠: 표시 없는 바탕도 화소까지 같은가 + 이웃 덩이 이음(오른쪽·아래 감김)
for L in 'de':
    nd = sum(G._slab_px(G._slab_info('a'), x, y) != G._slab_px(G._slab_info(L), x, y) for y in range(128) for x in range(128)
             if x < 8 or y < 8 or x >= 120 or y >= 120)
    print('base band diff a vs', L, nd)
B = G.slab_board(G._board_seed(7))
Image.fromarray(B).save(os.path.join(out, 'board-24x16-1x.png'))
Image.fromarray(B).resize((B.shape[1] * 3, B.shape[0] * 3), 0).save(os.path.join(out, 'board-24x16-3x.png'))
# 보도·광장 모형: 24×16, 가로 아스팔트 길(3줄) + 위아래 1칸 보도, 10×6 광장 + 흙 둘레
def cell(img, cx, cy): return img[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16]
def slab_cell(x, y, seed=7):
    lay = h2(x // 8, y // 8, seed) % 3
    if lay == 1: k = 'd'
    elif lay == 2: k = 'e'
    else:
        r = h2(x, y, seed + 101) % 10; k = 'a' if r < 2 else 'b' if r < 6 else 'c'
    return cell(R[k], x % 8, y % 8)
DI = {k: render(PIECES[k]) for k in ('dirt-b', 'dirt-c', 'dirt-d')}
AS = render(PIECES['asphalt'])
def dirt_cell(x, y):
    r = h2(x, y, 99) % 16; k = 'dirt-b' if r < 4 else 'dirt-c' if r < 10 else 'dirt-d'
    return cell(DI[k], x % 8, y % 8)
W, H = 24, 16
M = np.zeros((H * 16, W * 16, 4), np.uint8)
road = {11, 12, 13}; walk = {10, 14}
for y in range(H):
    for x in range(W):
        if y in road:
            m = 2 | 8 | (1 if y - 1 in road else 0) | (4 if y + 1 in road else 0)
            c = cell(AS, m % 4, m // 4)
        elif y in walk: c = slab_cell(x, y)
        elif 2 <= x < 12 and 2 <= y < 8: c = slab_cell(x, y)
        else: c = dirt_cell(x, y)
        M[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = c
Image.fromarray(M).save(os.path.join(out, 'mock-24x16-1x.png'))
Image.fromarray(M).resize((W * 48, H * 48), 0).save(os.path.join(out, 'mock-24x16-3x.png'))
print('ok', round(time.time() - t0, 1), 's')
