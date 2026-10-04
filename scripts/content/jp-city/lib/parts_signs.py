"""대형 비전·광고·벽화 (재작업): 규칙적 띠 디더, 정확한 원, 외곽선+그림자 단, 일반 한자 문구. 상표 없음."""
import random, math
import numpy as np
from parts_tokyo import *

def disc(c, cx, cy, r, col, hi=None, lo=None):
    """정확한 원: (x+.5, y+.5) 기준. 왼위 하이라이트, 오른아래 그림자."""
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            d = (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2
            if d <= r * r:
                k = col
                if hi is not None and (x + .5 - cx) + (y + .5 - cy) < -r * .55: k = hi
                elif lo is not None and (x + .5 - cx) + (y + .5 - cy) > r * .65: k = lo
                c.P(x, y, k)

def banded(c, x0, y0, w, h, cols, vertical=True):
    """cols 를 위→아래(또는 왼→오) 띠로 깔고 띠 경계는 체커 한 줄로 섞는다. 규칙적이고 칸 이음에 안전."""
    n = len(cols); L = h if vertical else w
    for j in range(h):
        for i in range(w):
            pos = j if vertical else i
            seg = pos * n / L; k = min(int(seg), n - 1); frac = seg - k
            col = cols[k]
            if k < n - 1 and frac > .82 and (i + j) % 2 == 0: col = cols[k + 1]
            if k > 0 and frac < .18 and (i + j) % 2 == 1: col = cols[k - 1]
            c.P(x0 + i, y0 + j, col)

def frame(c, W, H, t=3):
    """검은 틀 + 왼위 하이라이트 + 오른아래 그림자 단 + 1px 바깥 윤곽."""
    c.R(0, 0, W, H, K('tekko', -2))
    c.HL(0, 0, W, K('tekko', 1)); c.VL(0, 0, H, K('tekko', 0))
    c.HL(0, H - 1, W, K('sumi', 0)); c.VL(W - 1, 0, H, K('sumi', 0))
    c.HL(1, H - 2, W - 2, K('tekko', -3)); c.VL(W - 2, 1, H - 2, K('tekko', -3))

PAL = {0: ('sora', 'sora'), 1: ('kii', 'daidai'), 2: ('lino', 'kinari'), 3: ('murasaki', 'pinku')}
TEXTS = {0: '新作', 1: '特価', 2: '夏祭', 3: '花火'}
def vision(kind=0, w=6, h=4):
    """LED 간판 (틀 + 위/아래 2톤 띠, 글자 줄은 단색). 달/점 장식 없음, 글자는 굵게 그림자 1px."""
    c = Cv(16 * w, 16 * h); W, H = c.w, c.h
    frame(c, W, H)
    x0, y0, iw, ih = 3, 3, W - 7, H - 7
    a, b = PAL[kind % 4]
    top = K(a, 0); mid = K(a, 1); low = K(b, 1) if b == 'garasu' else K(b, 0)
    if a == b: top = K(a, 2); low = K(a, -1)     # 한 계열: 윗줄은 한 단 밝게, 아랫 띠는 어두운 같은 파랑
    c.R(x0, y0, iw, ih, mid)
    for j in range(ih):
        if j < 6: c.HL(x0, y0 + j, iw, top if j % 2 == 0 or j < 3 else mid)
        elif j >= ih - 8: c.HL(x0, y0 + j, iw, low if (j + 0) % 2 == 0 or j >= ih - 5 else mid)
    c.HL(x0, y0, iw, K('shiro', 4)); c.VL(x0, y0, ih, K('shiro', 3))
    t = TEXTS[kind % 4]
    if ih >= 24:
        n = min(len(t), max(1, (iw - 10) // 18)); pitch = 18 if iw < 100 else 36; tx = x0 + (iw - ((n - 1) * pitch + 18)) // 2 + 1; ty = y0 + (ih - 16) // 2
        for k, ch in enumerate(t[:n]):
            gl(c, tx + k * pitch + 1, ty + 1, ch, K('sumi', 0), bold=True)
            gl(c, tx + k * pitch, ty, ch, K('shiro', 4), bold=True)
    return c

def facade_ad(w=8, h=3, kind=0):
    return vision(kind, w, h)

# 벽화 4종: 구도·팔레트가 모두 다르다 (바다+두 봉우리 / 노을+둥근 언덕 / 달밤+능선+달 그림자 / 설산 한 봉우리). 채도는 탁한 단만 쓴다.
MURAL = [
    dict(sky=(('garasu', 2), ('garasu', 3), ('conc', 3)), water=(('garasu', 1), ('garasu', 3)), sun=(('shiro', 3), ('shiro', 4), ('shiro', 1)), sun_at=(.22, .20, 6), ring=('garasu', -2),
         shapes=[('peak', .30, .50, .62, .50, 'tairu', 0), ('peak', .66, .50, .84, .40, 'lino', 0)]),
    dict(sky=(('kinari', 2), ('kinari', 1), ('mado', 2)), water=(('tairu', 0), ('tairu', 2)), sun=(('mado', 3), ('mado', 4), ('mado', 2)), sun_at=(.56, .34, 8), ring=('yuka', -1),
         shapes=[('hill', .22, .50, .80, .50, 'tairu', 1), ('hill', .78, .50, .70, .62, 'lino', 0)]),
    dict(sky=(('tairu', 2), ('tairu', 3), ('hodo', 3)), water=(('tairu', 0), ('tairu', 2)), sun=(('shiro', 3), ('shiro', 4), ('shiro', 2)), sun_at=(.70, .20, 6), ring=('tairu', 0),
         shapes=[('peak', .16, .50, .36, .50, 'hodo', 1), ('peak', .40, .50, .52, .62, 'tairu', 1), ('peak', .90, .50, .50, .44, 'hodo', 1)]),
    dict(sky=(('kinari', 2), ('kinari', 1), ('kinari', 0)), water=(('garasu', 2), ('garasu', 3)), sun=(('mado', 3), ('mado', 4), ('mado', 2)), sun_at=(.84, .17, 5), ring=('hodo', 0), cap=True,
         shapes=[('peak', .36, .50, .76, .72, 'lino', 0), ('hill', .88, .50, .56, .44, 'lino', 1)]),
]

def _shape(c, kind, cx, base, hh, ww, ramp, tone, cap=False):
    """봉우리(삼각)·언덕(반타원) 마스크를 만들고 왼쪽 밝게/오른쪽 어둡게 + 1px 어두운 윤곽."""
    W, H = c.w, c.h
    m = np.zeros((H, W), bool)
    for j in range(hh):
        t = (j + 1) / hh
        half = ww / 2 * t if kind == 'peak' else ww / 2 * math.sqrt(max(0, 1 - (1 - t) ** 2))
        for i in range(W):
            if abs(i + .5 - cx) <= half: m[base - hh + 1 + j, i] = True
    for j in range(H):
        for i in range(W):
            if not m[j, i]: continue
            edge = not (m[j - 1, i] and m[j + 1, i] and m[j, i - 1] and m[j, i + 1]) if 0 < j < H - 1 and 0 < i < W - 1 else True
            if edge: col = K(ramp, -3)
            else:
                left = i + .5 < cx
                col = K(ramp, tone + 1) if left else K(ramp, tone - 1)
                near_l = not m[j, i - 2] or not m[j - 1, i - 1] if i > 1 else False
                if left and near_l: col = K(ramp, tone + 2)
                if cap and (j - (base - hh + 1)) < hh * .30 and kind == 'peak': col = K('shiro', 3) if left else K('shiro', 1)
                if cap and abs((j - (base - hh + 1)) - hh * .30) < 1 and kind == 'peak' and not edge: col = K('shiro', 0)
            c.P(i, j, col)

def mural(kind=0, w=6, h=4):
    """기하 풍경 벽화 (96x64): 탁한 3단 하늘 + 해/달(윤곽, 산과 떨어지거나 언덕 뒤) + 봉우리·언덕 + 물결(마지막 줄 완결) + 4면 어두운 윤곽. 반복 무늬 주기는 8이라 칸 이음에 안전."""
    c = Cv(16 * w, 16 * h); W, H = c.w, c.h
    d = MURAL[kind % 4]
    wt = int(H * .80)
    for j in range(wt):
        c.HL(0, j, W, K(*d['sky'][min(2, j * 3 // wt)]))
    sx, sy, sr = int(W * d['sun_at'][0]), int(H * d['sun_at'][1]), d['sun_at'][2]
    disc(c, sx, sy, sr + 1, K(*d['ring'])); disc(c, sx, sy, sr, K(*d['sun'][0]), K(*d['sun'][1]), K(*d['sun'][2]))
    for sh in d['shapes']:
        kd, fx, _, ww, hh, ramp, tone = sh
        _shape(c, kd, W * fx, wt + 2, int(H * hh * (1.0 if kd == 'peak' else .75)), int(W * ww), ramp, tone, cap=bool(d.get('cap')) and fx < .6)
    c.R(0, wt, W, H - wt, K(*d['water'][0]))
    c.HL(0, wt, W, K(d['water'][0][0], d['water'][0][1] - 1))
    if d.get('reflect'):
        for j in range(wt + 2, H - 3, 2): c.HL(sx - 2 + (j // 2 % 2), j, 4 - (j // 2 % 2) * 2, K('shiro', 2))
    wc = K(*d['water'][1])
    for n, j in enumerate((wt + 4, wt + 8)):
        x = 6 + (n % 2) * 4
        while x + 4 <= W - 6: c.HL(x, j, 4, wc); x += 8
    dk = K('tekko', -3)
    c.HL(1, 1, W - 2, K('shiro', 3)); c.VL(1, 1, H - 2, K('shiro', 2))
    c.HL(1, H - 2, W - 2, K('tairu', -2)); c.VL(W - 2, 1, H - 2, K('tairu', -2))
    c.HL(0, 0, W, dk); c.HL(0, H - 1, W, dk); c.VL(0, 0, H, dk); c.VL(W - 1, 0, H, dk)
    return c
