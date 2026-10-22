"""wasteland_ruins 바닥 — 황무지 흙 4 · 금 간 아스팔트 오토타일(4방향 16마스크) + 낱칸 변형 2 · 금 간 콘크리트 판 3 · 투명 덧그림(잔해 3·잡초 3·기름 웅덩이).

마스크 비트 N=1 E=2 S=4 W=8 (그 방향 이웃이 아스팔트면 켠다). 마스크 m 칸은 조각 안 (m%4, m//4).
이웃이 없는 쪽은 아스팔트가 흙으로 부서져 끝난다(들쭉날쭉한 가장자리, 남쪽은 1화소 앞면 + 흙 그림자).
바닥 칸끼리 이음: 모든 흙·아스팔트 칸은 가장자리 3화소 띠를 같은 바탕 결(seed 0)로 칠하고 안쪽만 변형마다 다르다.
"""
import collections
import math
from wl_kit import *

TERRAIN, FLAT = 'terrain', 'flat'
N, E, Sb, W = 1, 2, 4, 8
AUTO = {}


def edge_d(x, y): return min(x, y, 15 - x, 15 - y)


def dirt_cell(c, ox, oy, seed):
    for y in range(16):
        for x in range(16):
            c.P(ox + x, oy + y, dirt_px(x, y, 0))


def tiled(ids, grid):
    """표본: grid = 행 문자열(글자 → ids 의 키). 조각 그림을 칸으로 깔아 붙인다."""
    def mk(f=0):
        h, w = len(grid), len(grid[0])
        a = np.zeros((h * 16, w * 16, 4), np.uint8)
        for j, row in enumerate(grid):
            for i, ch in enumerate(row):
                pid, cx, cy = ids[ch]
                src = render(PIECES[pid])
                if cx is None: cx, cy = i % PIECES[pid]['w'], j % PIECES[pid]['h']      # 이음 판(4×4): 자리 (x mod 4, y mod 4) 칸
                a[j * 16:(j + 1) * 16, i * 16:(i + 1) * 16] = src[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16]
        return a
    return mk


def decal_sample(pid, grid=('abXa', 'aaab', 'Xaca'), extra=((3, 1),)):
    """덧그림 표본: 흙 칸(4×3)을 깔고 X 칸(+ extra 칸)에 덧그림을 얹는다 — 실제 쓰임(흙 위 드문드문)대로 보인다."""
    def mk(f=0):
        a = tiled(DIRT_IDS, [r.replace('X', 'a') for r in grid])(f)
        d = render(PIECES[pid], f); m = d[..., 3] > 0
        cells = [(i, j) for j, r in enumerate(grid) for i, ch in enumerate(r) if ch == 'X'] + list(extra)
        for (i, j) in cells:
            blk = a[j * 16:(j + 1) * 16, i * 16:(i + 1) * 16]
            op = d[..., 3] == 255; blk[op] = d[op]
            sh = m & ~op                                           # 반투명 그림자: 흙 위에 섞어 굽는다(표본만, 관문 그림은 불투명)
            al = d[..., 3:4].astype(np.float32) / 255.0
            blk[sh, :3] = (blk[sh, :3] * (1 - al[sh]) + d[sh, :3] * al[sh]).astype(np.uint8)
        return a
    return mk



# ------------------------------------------------------------------ 흙 4 (64×64 이음 판 — 칸 (x mod 4, y mod 4) 자리에 깐다)
FP = 64                                                     # 바닥 이음 주기(화소) = 4칸


def wrapnoise(x, y, seed, cell, per=None):
    """주기 per(기본 FP) 로 감싼 값 잡음 0..1(격자 cell)."""
    per = per or FP
    return vnoise(x % per, y % per, seed, cell, per)


def dirt64_tone(x, y):
    """흙 바탕 단: 갈색 단만(2·3·5, 드물게 1) — 큰 얼룩은 낮은 대비(3↔2/5), 2×2 덩이로 5×5 평면을 깬다. 낱화소 잡음·회색 얼룩 없음."""
    f = 0.55 * wrapnoise(x, y, 201, 16) + 0.45 * wrapnoise(x, y, 207, 8)
    t = 3
    if f > 0.70: t = 5
    gx, gy = (x + (y // 2) % 2) // 2, y // 2
    d = h2(gx % (FP // 2), gy % (FP // 2), 211) % 7
    if d in (0, 1): t = {2: 3, 3: 5, 5: 3}[t]
    elif d == 2: t = {2: 1, 3: 2, 5: 3}[t]
    k = h2(x % FP, y % FP, 215) % 61
    if k == 0: t = 6                                          # 드문 밝은 먼지 알(낱알, 덩이 아님)
    elif k == 1: t = 7 if t == 5 else 6
    elif k == 2: t = 1                                        # 드문 어두운 구멍 알
    return t


# 바탕에 공유되는 결(칸 경계를 넘는다): 긴 마른 금, 젖은 얼룩, 자갈 — 좌표는 64 판 안(감싼다)
DIRT_CRACKS = [[(2, 21), (8, 20), (13, 22), (19, 22), (25, 24)], [(13, 22), (14, 27)],
               [(40, 44), (46, 43), (52, 44), (58, 42), (66, 43)],
               [(29, 59), (34, 61), (38, 66)]]
DIRT_BLOTS = [(46, 12, 6, 3), (12, 47, 7, 4), (60, 30, 5, 3)]   # (cx, cy, rx, ry) 젖은 얼룩(두 단 어둡게 가장자리 한 단)
DIRT_PEBBLES = [(7, 6, 2), (31, 14, 1), (54, 23, 2), (23, 39, 2), (40, 31, 1), (5, 58, 1), (47, 55, 2), (62, 3, 1), (15, 30, 1), (35, 50, 1)]


_BLOBS = {}


def blobs(per, seed, step=3):
    """주기 per 로 감싼 작은 덩이 분할(지터 격자 보로노이, 덩이 2~4화소): {(x,y): (덩이 id, 아래·오른 경계?)}."""
    key = (per, seed, step)
    if key in _BLOBS: return _BLOBS[key]
    n = per // step; seeds = {}
    for j in range(n):
        for i in range(n):
            r = h2(i, j, seed); seeds[(i, j)] = ((i * step + r % step) % per, (j * step + (r >> 4) % step) % per)
    own = {}
    for y in range(per):
        for x in range(per):
            gi, gj = x // step, y // step; best = None
            for dj in (-1, 0, 1):
                for di in (-1, 0, 1):
                    k = ((gi + di) % n, (gj + dj) % n); sx, sy = seeds[k]
                    dx = min(abs(x - sx), per - abs(x - sx)); dy = min(abs(y - sy), per - abs(y - sy))
                    d = dx * dx + dy * dy + (h2(x, y, seed + 1) % 3) * 0.3
                    if best is None or d < best[0]: best = (d, k)
            own[(x, y)] = best[1]
    out = {}
    for (x, y), k in own.items():
        edge = own[((x + 1) % per, y)] != k or own[(x, (y + 1) % per)] != k
        lit = own[((x - 1) % per, y)] != k or own[(x, (y - 1) % per)] != k     # 왼·위 가장자리(빛 받는 쪽)
        out[(x, y)] = (k, edge, lit)
    _BLOBS[key] = out
    return out


_DT = {}


def _dirt_tones():
    """덩이마다 단을 정한다: 3 · 밝은 5 · 드문 2. 이미 3 인 이웃 덩이가 둘 이상이면 3 대신 5/2 로 바꿔 같은 단 덩이가 크게 뭉치지 않게 한다(5×5 같은 색 판 방지)."""
    if _DT: return _DT
    B = blobs(FP, 521, 3)
    nb = collections.defaultdict(set)
    for (x, y), (k, e, l) in B.items():
        for (dx, dy) in ((1, 0), (0, 1)):
            k2 = B[((x + dx) % FP, (y + dy) % FP)][0]
            if k2 != k: nb[k].add(k2); nb[k2].add(k)
    for k in sorted(nb, key=lambda k: (k[1], k[0])):
        r = h2(k[0], k[1], 503) % 100
        f = wrapnoise(k[0] * 3, k[1] * 3, 505, 32)
        lite = 26 + int(f * 14)
        t = 5 if r < lite else 2 if r < lite + 9 else 3
        if t == 3 and sum(1 for n in nb[k] if _DT.get(n) == 3) >= 2: t = 5 if r % 5 else 2
        _DT[k] = t
    return _DT


def dirt_base(x, y):
    """새 흙 바탕 단(주기 64): 흙덩이(2~4화소)마다 한 단 — 가운데 3 · 밝은 5 덩이(아래·오른 그늘 3 → 솟은 흙덩이) · 드문 어두운 2 덩이.
    큰 흐름(32화소 잡음)은 밝은 덩이 몫만 조금 바꾼다(어두운 얼룩 판·테두리 그물 없음). 낱화소 잡음 없음."""
    k, edge, lit = blobs(FP, 521, 3)[(x % FP, y % FP)]
    t = _dirt_tones()[k]
    if edge and t == 5 and h2(k[0], k[1], 507) % 4: t = 3     # 밝은 흙덩이 아래·오른 그늘(넷 중 셋)
    return t


def dirt_col(t):
    return K('dirt', t)


def dirt_field(c, ox, oy):
    """64×64 흙 이음 판: 덩이 바탕(낱화소 잡음 없음, 큰 흐름 낮게) + 솟은 흙덩이 14 + 잔돌·부스러기 무리 5 — 바퀴 자국은 64 주기로 줄지어 보여 뺐다(발길 오토타일이 맡는다)."""
    for y in range(FP):
        for x in range(FP):
            c.P(ox + x, oy + y, dirt_col(dirt_base(x, y)))
    def P(x, y, col): c.P(ox + x % FP, oy + y % FP, col)
    for i in range(9):                                        # 솟은 흙덩이(3×2~4×3): 윗면 빛 5 · 몸 3 · 앞 그늘 2 · 밑 그림자 1(가운데 0) — 덩이마다 5단 명암
        x0 = h2(i, 1, 531) % FP; y0 = h2(i, 2, 531) % FP; w = 3 + h2(i, 3, 531) % 2; hh = 2 + h2(i, 4, 531) % 2
        for dx in range(w):
            for dy in range(hh):
                if (dx in (0, w - 1)) and dy == 0: continue        # 둥근 모서리
                P(x0 + dx, y0 + dy, K('dirt', 5 if dy == 0 else 2 if dy == hh - 1 else 3))
        for dx in range(1 if w > 3 else 0, w):
            P(x0 + dx, y0 + hh, K('dirt', 0 if dx == w - 2 and i % 2 else 1))
    for i in range(5):                                        # 잔돌·부스러기 무리(지름 7~9 자리에 2화소 알 5~7개, 알마다 밝은 위 · 그늘 아래)
        cx0 = h2(i, 5, 541) % FP; cy0 = h2(i, 6, 541) % FP
        for j in range(5 + h2(i, 7, 541) % 3):
            x = cx0 + h2(i, j, 543) % 8; y = cy0 + h2(j, i, 545) % 6
            stone = (i + j) % 3 == 0
            P(x, y, K('conc', 4) if stone else K('dirt', 5)); P(x, y + 1, K('dirt', 1))
            if stone and j % 2: P(x + 1, y, K('conc', 3))


def _dirt64(v):
    """v=0 바탕 판. v=1..3 은 같은 바탕 + 칸 안에서만 끝나는 낱칸 결(칸마다 자리·크기·모양이 다르다) — 어느 자리에 섞어도 바탕이 이어진다."""
    def draw(c):
        dirt_field(c, 0, 0)
        if v == 0: return
        sh = K('dirt', 1)
        for cy in range(4):
            for cx in range(4):
                ox, oy = cx * 16, cy * 16; r = h2(cx, cy, 300 + v)
                jx, jy = 2 + r % 4, 2 + (r >> 4) % 4
                if v == 1:                                    # 얕게 파인 젖은 땅: 부드러운 어두운 얼룩(가장자리 2단 → 속 1단) + 앞 빛 턱 + 흙덩이
                    cxm, cym, rx, ry = 7 + r % 3, 7 + (r >> 3) % 3, 4.8 + (r % 2), 3.4
                    B = blobs(FP, 521, 3)
                    for y in range(16):
                        for x in range(16):
                            k, edge, lit = B[((ox + x) % FP, (oy + y) % FP)]
                            jit = (h2(k[0], k[1], r) % 4) * 0.07       # 덩이 단위로 흔들린 테두리(낱화소 들쭉 없음)
                            d = ((x - cxm) / rx) ** 2 + ((y - cym) / ry) ** 2 + jit
                            if d < 0.45: c.P(ox + x, oy + y, K('dirt', 2 if edge or h2(k[0], k[1], 517) % 3 == 0 else 1))
                            elif d < 1: c.P(ox + x, oy + y, K('dirt', 1 if edge and h2(k[0], k[1], 519) % 2 else 2))
                            elif d < 1.4 and y > cym + 1: c.P(ox + x, oy + y, K('dirt', 3 if edge else 5))   # 앞쪽 마른 턱(덩이째)
                elif v == 2:                                  # 자갈 무리(크기 섞임, 그늘 있는 돌) + 녹 조각 — 칸마다 배치가 다르다
                    for i in range(4 + r % 3):                    # 그늘 진 돌 무리(3·2화소 섞임)
                        x = jx + 1 + h2(i, 3, r) % 9; y = jy + 1 + h2(i, 4, r) % 8; sz = 3 if i < 2 else 2
                        pebble(c, ox + x, oy + y, sz, 'conc' if (i + r) % 3 else 'brick', 6 if (i + r) % 3 else 5, 4, 2, sh)
                    if r % 2:
                        x, y = jx + 7, jy + 10
                        c.P(ox + x, oy + y, K('rust', 5)); c.P(ox + x + 1, oy + y, K('rust', 4)); c.P(ox + x + 2, oy + y, K('rust', 2)); c.HL(ox + x, oy + y + 1, 3, sh)
                else:                                         # 마른 풀 포기(부채꼴, 크기·자리 칸마다 다름) + 부스러기
                    fan(c, ox + jx + 4, oy + jy + 9, 6 + r % 2, 'dry', r % 97, 8, 3, droop=bool(r % 2))
                    fan(c, ox + jx + 9, oy + jy + 10, 4, 'dry', r % 89, 6, 2)
                    if (r >> 5) % 2: fan(c, ox + jx + 1, oy + jy + 11, 3, 'grass', r % 83, 4, 1)
    return draw


# 옛 64 흙(4×4) — 굽지 않는다(SKIP). 다른 조각 관문 표본의 바탕으로만 남긴다(그 표본·영수증이 흙을 바꿔도 그대로 유지되게).
DIRT_IDS = {'a': ('dirt-a', None, None), 'b': ('dirt-b64', None, None), 'c': ('dirt-c64', None, None), 'd': ('dirt-d64', None, None)}
piece('dirt-a', '황무지 흙 A (옛 64 판, 표본 바탕 전용)', 4, 4, TERRAIN, en='dusty packed wasteland earth ground (legacy 64px field, sample background only)',
      group='ground', tags=['흙'], desc='옛 64화소 흙 판 — 굽지 않는다. 다른 조각 관문 표본의 바탕.')(_dirt64(0))
for _v, _l in ((1, 'b'), (2, 'c'), (3, 'd')):
    piece('dirt-' + _l + '64', '황무지 흙 ' + _l.upper() + ' (옛 64 판, 표본 바탕 전용)', 4, 4, TERRAIN, en='dusty packed wasteland earth ground (legacy 64px field, sample background only)',
          group='ground', tags=['흙'], desc='옛 64화소 흙 판 — 굽지 않는다. 다른 조각 관문 표본의 바탕.')(_dirt64(_v))


# ------------------------------------------------------------------ 흙 128(8×8칸 이음 판 — 칸 (x mod 8, y mod 8) 자리에 깐다): dirt-b/c/d
DP = 128


def _scatter(n, seed, mind, per=DP, margin=0):
    """주기 per 판에 서로 mind 이상 떨어진 점 n 개(던지기 — 격자·줄 맞춤 없음)."""
    pts = []
    for k in range(n * 40):
        if len(pts) >= n: break
        x = margin + h2(k, 1, seed) % (per - 2 * margin); y = margin + h2(k, 2, seed) % (per - 2 * margin)
        ok = all(min(abs(x - px), per - abs(x - px)) ** 2 + min(abs(y - py), per - abs(y - py)) ** 2 >= mind * mind for (px, py) in pts)
        if ok: pts.append((x, y))
    return pts


_DT8 = {}


def _dirt_tones8():
    """덩이마다 단(128 판): 3 바탕 · 밝은 5(넓은 흐름에 따라 22~36%) · 드문 2(5%) — 같은 단 덩이가 크게 뭉치지 않게."""
    if _DT8: return _DT8
    B = blobs(DP, 621, 3)
    nb = collections.defaultdict(set)
    for (x, y), (k, e, l) in B.items():
        for (dx, dy) in ((1, 0), (0, 1)):
            k2 = B[((x + dx) % DP, (y + dy) % DP)][0]
            if k2 != k: nb[k].add(k2); nb[k2].add(k)
    for k in sorted(nb, key=lambda k: (k[1], k[0])):
        r = h2(k[0], k[1], 603) % 100
        f = wrapnoise(k[0] * 3, k[1] * 3, 605, 48, DP)
        lite = 22 + int(f * 14)
        t = 5 if r < lite else 2 if r < lite + 5 else 3
        if t == 3 and sum(1 for n in nb[k] if _DT8.get(n) == 3) >= 2: t = 5 if r % 5 else 2
        _DT8[k] = t
    return _DT8


def dirt8_base(x, y):
    k, edge, lit = blobs(DP, 621, 3)[(x % DP, y % DP)]
    t = _dirt_tones8()[k]
    if edge and t == 5 and h2(k[0], k[1], 607) % 4: t = 3
    return t


def dirt128_field(c, ox, oy):
    """128×128 흙 이음 판: 덩이 바탕(낮은 대비) + 솟은 흙덩이 30(서로 13 이상 떨어져 아무렇게나 — 줄·격자 없음, 그늘은 2단으로 옅게) + 잔돌 무리 16."""
    for y in range(DP):
        for x in range(DP):
            t = dirt8_base(x, y); k = h2(x, y, 615) % 71
            if k == 0 and t == 5: t = 6                               # 드문 밝은 먼지 알
            elif k == 1 and t != 5: t = 1                             # 드문 어두운 구멍 알
            c.P(ox + x, oy + y, K('dirt', t))
    def P(x, y, col): c.P(ox + x % DP, oy + y % DP, col)
    for i, (x0, y0) in enumerate(_scatter(30, 631, 13)):
        w = 3 + h2(i, 3, 631) % 2; hh = 2 + h2(i, 4, 631) % 2
        for dx in range(w):
            for dy in range(hh):
                if (dx in (0, w - 1)) and dy == 0: continue
                P(x0 + dx, y0 + dy, K('dirt', 5 if dy == 0 else 3 if dy < hh - 1 else 2))
        for dx in range(1 if w > 3 else 0, w):
            if h2(i, dx, 633) % 3: P(x0 + dx, y0 + hh, K('dirt', 1 if dx == w - 2 else 2))
    for i, (cx0, cy0) in enumerate(_scatter(16, 641, 22)):
        for j in range(4 + h2(i, 7, 641) % 3):
            x = cx0 + h2(i, j, 643) % 8; y = cy0 + h2(j, i, 645) % 6
            stone = (i + j) % 3 == 0
            P(x, y, K('conc', 4) if stone else K('dirt', 5)); P(x, y + 1, K('dirt', 2))
            if stone and j % 2: P(x + 1, y, K('conc', 3))


DAMP_CELLS = ((1, 1), (5, 3), (3, 5), (7, 6))              # dirt-b 젖은 우묵한 자리 4곳(128 판에 흩어짐, 칸 안에서 끝난다 — c·d 칸과 섞어 깔아도 잘리지 않게)


def damp_patch(c, ox, oy, i):
    """젖은 우묵한 자리 하나(10~14화소): 덩이 경계를 따라 들쭉날쭉한 윤곽, 가장자리 dirt 3→ 속 dirt 2 → 가운데 dirt 1 덩이(드문 dirt 0 알). 파란 물 없음."""
    cxm, cym = 7 + h2(i, 1, 751) % 3 - 1, 7 + h2(i, 2, 751) % 3 - 1
    rx, ry = 6.2 + h2(i, 3, 751) % 2 * 0.6, 4.6 + h2(i, 4, 751) % 2 * 0.8
    B = blobs(DP, 621, 3)
    for y in range(16):
        for x in range(16):
            k, edge, lit = B[((ox + x) % DP, (oy + y) % DP)]
            d = ((x - cxm) / rx) ** 2 + ((y - cym) / ry) ** 2 + (h2(k[0], k[1], 753 + i) % 4) * 0.06
            if d < 0.5: c.P(ox + x, oy + y, K('dirt', 0) if h2(x, y, 755 + i) % 9 == 0 else K('dirt', 1))
            elif d < 0.88: c.P(ox + x, oy + y, K('dirt', 1) if h2(k[0], k[1], 757 + i) % 3 == 0 else K('dirt', 2))
            elif d < 1.1: c.P(ox + x, oy + y, K('dirt', 2) if (edge or h2(k[0], k[1], 759 + i) % 2) else K('dirt', 3))
            elif d < 1.3 and y > cym and h2(x, y, 761 + i) % 2: c.P(ox + x, oy + y, K('dirt', 5))          # 아래쪽 마른 테(3/4 시점: 우묵한 자리 앞 둔덕이 빛을 받는다)


def _dirt128(v):
    """dirt-b/c/d: 같은 128 바탕 + 일부 칸(아무렇게나 고른 18~24%)에만 칸 안에서 끝나는 낱칸 결(자리·크기 칸마다 다름) —
    b 얕은 젖은 자국(낮은 대비) · c 자갈·녹 조각 · d 마른 풀 포기. 같은 (x mod 8, y mod 8) 자리에서 셋을 섞어도 바탕이 이어진다."""
    pct = {1: 18, 2: 24, 3: 24, 4: 0}[v]
    def draw(c):
        dirt128_field(c, 0, 0)
        sh = K('dirt', 2)
        if v == 4:
            for i, (cx, cy) in enumerate(DAMP_CELLS): damp_patch(c, cx * 16, cy * 16, i)
            return
        for cy in range(8):
            for cx in range(8):
                r = h2(cx, cy, 700 + v)
                if r % 100 >= pct: continue
                ox, oy = cx * 16, cy * 16
                jx, jy = 1 + (r >> 7) % 6, 1 + (r >> 10) % 6
                if v == 1:
                    cxm, cym = 4 + (r >> 3) % 8, 4 + (r >> 6) % 7
                    rx, ry = 3.2 + (r % 3), 2.2 + (r >> 2) % 2
                    B = blobs(DP, 621, 3)
                    for y in range(16):
                        for x in range(16):
                            k, edge, lit = B[((ox + x) % DP, (oy + y) % DP)]
                            d = ((x - cxm) / rx) ** 2 + ((y - cym) / ry) ** 2 + (h2(k[0], k[1], r) % 4) * 0.08
                            if d < 0.5: c.P(ox + x, oy + y, K('dirt', 2))
                            elif d < 1: c.P(ox + x, oy + y, K('dirt', 2 if edge and h2(k[0], k[1], 719) % 2 else 3))
                elif v == 2:
                    for i in range(3 + r % 3):
                        x = jx + h2(i, 3, r) % 9; y = jy + h2(i, 4, r) % 8; sz = 3 if i < 1 else 2
                        pebble(c, ox + x, oy + y, sz, 'conc' if (i + r) % 3 else 'brick', 6 if (i + r) % 3 else 5, 4, 2, sh)
                    if r % 2:
                        x, y = jx + 6, jy + 9
                        c.P(ox + x, oy + y, K('rust', 5)); c.P(ox + x + 1, oy + y, K('rust', 4)); c.P(ox + x + 2, oy + y, K('rust', 2)); c.HL(ox + x, oy + y + 1, 3, sh)
                else:
                    fan(c, ox + jx + 4, oy + jy + 8, 5 + r % 3, 'dry', r % 97, 7, 3, droop=bool(r % 2))
                    if (r >> 4) % 2: fan(c, ox + jx + 8, oy + jy + 9, 4, 'dry', r % 89, 5, 2)
                    if (r >> 5) % 3 == 0: fan(c, ox + jx + 1, oy + jy + 10, 3, 'grass', r % 83, 4, 1)
    return draw


DIRT8_IDS = {'b': ('dirt-b', None, None), 'c': ('dirt-c', None, None), 'd': ('dirt-d', None, None)}
DIRT8_IDS_CD = {'b': ('dirt-b45', None, None), 'c': ('dirt-c', None, None), 'd': ('dirt-d', None, None)}   # c·d 표본의 b 칸은 얼린 옛 dirt-b(영수증 sha 유지)
_g8 = []
for _y in range(9):                                                         # 표본: 실제 깔기처럼 b 바탕에 c·d 를 칸 해시로 섞는다(10:3:3)
    _g8.append(''.join('b' if h2(_x, _y, 6) % 16 < 10 else 'c' if h2(_x, _y, 6) % 16 < 13 else 'd' for _x in range(12)))
# 표본: b 는 실제 깔기 비율(10:3:3), c·d 는 같은 판에 자기 칸을 더 섞어(약 40%) 그 변형 칸이 잘 보이게
piece('dirt-b45', '황무지 흙 B (r45, 표본 바탕용)', 8, 8, TERRAIN, en='legacy dirt field kept only as a sample background', group='ground', tags=['흙'],
      desc='굽지 않는다 — dirt-c·dirt-d 표본의 b 칸(영수증 sha 를 그대로 두려고 얼린 r45 판).', sample=tiled(DIRT8_IDS, _g8))(_dirt128(1))
for _v, _l in ((4, 'b'), (2, 'c'), (3, 'd')):
    piece('dirt-' + _l, '황무지 흙 ' + _l.upper(), 8, 8, TERRAIN,
          en='dusty packed wasteland earth ground, a seamless 8x8-tile field (128px period) of soft low-contrast clumped earth with irregularly scattered raised clods and small grit clusters, no rows or grid alignment' +
             {4: ', with four clearly visible darker damp hollows (irregular, 10-14px, dark brown, no water)', 2: ', a few tiles with gravel and rust flakes', 3: ', a few tiles with dry grass tufts'}[_v],
          group='ground', tags=['흙', '황무지', '바닥'],
          desc='먼지 낀 다져진 황무지 흙 이음 판(8×8칸, 주기 128화소) — 맵 칸 (x,y) 에는 판의 (x mod 8, y mod 8) 칸을 깐다. B(바탕, 판에 4곳 어두운 젖은 우묵한 자리)·C(드문 자갈·녹)·D(드문 마른 풀)는 같은 바탕이라 같은 자리 칸끼리 섞어 깐다(10:3:3).',
          sample=tiled(DIRT8_IDS if _l == 'b' else DIRT8_IDS_CD, _g8 if _l == 'b' else [''.join(_l if (ch != 'b' or h2(i, j, 9) % 4 == 0) else 'b' for i, ch in enumerate(r)) for j, r in enumerate(_g8)]))(_dirt128(_v))


# ------------------------------------------------------------------ 아스팔트
# ---- 아스팔트: modern_city 도로(#283d53 매끈한 남색 타르 + 2화소 낮은 대비 알)를 바탕 값·결로 삼아 낡힌다
TAR, TAR_HI, TAR_LO, TAR_FADE = K('soot', 4), K('asph', 4), K('asph', 1), K('asph', 4)    # 차가운 숯빛 회색(남색 아님) 바탕 · 밝은 골재 · 어두운 골재/금 · 바랜 자리
TAR_WARM, TAR_STONE = K('asph', 6), K('asph', 5)                                  # 바랜 자리 속 따뜻한 회색 알 · 밝은 골재 돌
TAR_LIP = K('asph', 0)
TAR_CRACK = K('asph', 0)                                                            # 깨진 자리 밑 1화소 그늘


def jag(i, side, m):
    """이웃 없는 쪽(side)에서 흙이 먹어 들어온 깊이(화소) 1..3 — 부드러운 굴곡(주기 7 잡음, 마스크·변마다 다름). 끝 0·15 는 2 고정(이웃 칸과 잇는다)."""
    if i <= 0 or i >= 15: return 2
    v = vnoise(i + m * 5 + side * 17, side * 7 + m, 91 + side, 7, 64)
    d = max(1, min(3, 2 + int(round((v - 0.5) * 2.6))))      # 평균 2(칸 끝과 같은 깊이) — 칸 가운데가 부풀어 구슬처럼 이어지지 않게
    if i in (1, 14): d = min(max(d, 1), 2)
    return d


def soil_depth(m, jagf=jag):
    dep = [[0] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            dd = 0
            if not m & N: dd = max(dd, jagf(x, 0, m) - y)
            if not m & Sb: dd = max(dd, jagf(x, 2, m) - (15 - y))
            if not m & W: dd = max(dd, jagf(y, 3, m) - x)
            if not m & E: dd = max(dd, jagf(y, 1, m) - (15 - x))
            dep[y][x] = dd
    return dep


def tar_body(c, ox, oy, seed, grain=9, fade=True, big=False):
    """칸마다 다른 아스팔트 몸: 숯빛 회색 바탕(asph 1) + 방향 없는 골재 알(1화소 또는 대각·세로·가로 섞인 2화소, 밝은 회색·드문 돌빛·어두운 알, 서로 2화소 이상, 줄 맞춤 없음)
    + 칸 안에서 끝나는 바랜 자리 하나(덩이째 asph 2, 속에 드문 따뜻한 회색 알 — 네모 윤곽 없음). 물결처럼 보이는 가로 줄무늬가 없다."""
    for y in range(16):
        for x in range(16): c.P(ox + x, oy + y, TAR)
    if fade and h2(seed, 1, 901) % 4:
        cx, cy = 3 + h2(seed, 2, 901) % 10, 3 + h2(seed, 3, 901) % 10
        rx, ry = (4.5 + h2(seed, 4, 901) % 3, 3.5 + h2(seed, 5, 901) % 2) if big else (3.5 + h2(seed, 4, 901) % 3, 2.5 + h2(seed, 5, 901) % 2)
        B = blobs(16, 903 + seed, 2)
        for y in range(16):
            for x in range(16):
                k = B[(x, y)][0]
                d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (h2(k[0], k[1], 905 + seed) % 5) * 0.12
                if (d < 0.6 and (big or h2(k[0], k[1], 909 + seed) % 3)) or (d < 1.0 and h2(k[0], k[1], 907 + seed) % (2 if big else 3) == 0):
                    c.P(ox + x, oy + y, TAR_WARM if h2(x, y, 917 + seed) % 9 == 0 else TAR_FADE)
    B = blobs(16, 1471 + seed, 2)                         # 잔 결(모든 칸): 2~4화소 덩이 중 일부를 한 단 밝게(68605e)·드물게 한 단 어둡게(3d4b51) — 바탕 4~5단 명암, 큰 얼룩 없음
    for y in range(16):
        for x in range(16):
            kb = B[(x, y)][0]; r = h2(kb[0], kb[1], 1473 + seed) % 100
            if r < 17: c.P(ox + x, oy + y, TAR_HI)
            elif r < 21: c.P(ox + x, oy + y, K('asph', 2))
    for y in range(16 if big else 0):                     # 넓은 결(속 변형만): 칸 안에서 닫히는 잡음으로 닳아 밝은 자리(68605e) 덩이, 그 속 더 밝은 자리(7b7270) — 따뜻한 회색 4단 명암
        for x in range(16):
            e = min(x, y, 15 - x, 15 - y)                     # 칸 끝 가까이는 덜 밝게 — 옆 칸에서 잘린 네모 덩이가 생기지 않게
            v = vnoise(x, y, 1461 + seed, 8, 16) - (0.3 if e == 0 else 0.18 if e == 1 else 0.08 if e == 2 else 0)
            if v > 0.86: c.P(ox + x, oy + y, K('asph', 6))
            elif v > 0.68 and h2(x, y, 1467 + seed) % 4: c.P(ox + x, oy + y, TAR_HI)
    taken = set(); n = 0
    SH = ([(0, 0), (1, 0)], [(0, 0), (0, 1)], [(0, 0), (1, 0), (0, 1)], [(0, 0), (1, 1), (1, 0)], [(0, 0), (1, 1)], [(1, 0), (0, 1), (1, 1)])
    for i in range(120):                                  # 골재: 2~3화소 덩이(밝은 돌 7b7270 + 한 화소 8d8482, 드물게 어두운 3d4b51 그늘 알), 예전 낱점의 절반
        if n >= grain: break
        x = h2(i, seed, 911) % 15; y = h2(seed, i, 913) % 15
        sh = SH[h2(i, seed, 919) % len(SH)]
        pts = [(x + dx, y + dy) for dx, dy in sh]
        if any((px + dx, py + dy) in taken for px, py in pts for dx in (-1, 0, 1) for dy in (-1, 0, 1)): continue
        r = h2(i, seed, 915) % 10
        for j, (px, py) in enumerate(pts):
            if r < 7: col = K('conc', 4) if j == 0 and h2(i, seed, 921) % 2 else K('asph', 6)
            else: col = K('asph', 2) if j else K('asph', 1)
            c.P(ox + px, oy + py, col); taken.add((px, py))
        n += 1


def lane_paint(c, ox, oy, col_hi, col_lo, x0, y0, length, seed, dx=1, dy=0):
    """닳은 차선 칠: 바닥에 납작하게 칠한 2화소 폭 띠를 2~3토막으로 끊고(사이 빈자리), 가장자리를 바탕 색이 군데군데 먹어 들어온 긁힌 칠 — 윤곽선 없음."""
    gaps = {h2(seed, 1, 1301) % length, (h2(seed, 2, 1301) % length + length // 2) % length}
    for t in range(length):
        if t in gaps or (t + 1) in gaps: continue
        for w in range(2):
            x = x0 + dx * t - dy * w; y = y0 + dy * t + dx * w
            if not (0 <= x < 16 and 0 <= y < 16): continue
            r = h2(t, w, seed) % 10
            if r < 2: continue                                       # 긁혀 벗겨진 자리(바탕이 보인다)
            c.P(ox + x, oy + y, col_lo if r < 5 else col_hi)


def tar_crack(c, ox, oy, pts):
    """가는 금: 1화소 어두운 줄(#192737), 빛 턱·테두리 없음."""
    for (p0, p1) in zip(pts, pts[1:]):
        n = max(abs(p1[0] - p0[0]), abs(p1[1] - p0[1]), 1)
        for i in range(n + 1):
            x = round(p0[0] + (p1[0] - p0[0]) * i / n); y = round(p0[1] + (p1[1] - p0[1]) * i / n)
            if 0 <= x < 16 and 0 <= y < 16: c.P(ox + x, oy + y, TAR_CRACK)


def zigzag(seed, x0, y0, n, dx, dy):
    """갈지자 금: 진행 방향으로 1~2화소씩 가며 옆으로 ±1 을 들쭉날쭉 꺾는다(활·눈썹 모양으로 둥글게 휘지 않는다)."""
    pts = [(x0, y0)]; x, y = x0, y0
    for i in range(n):
        st = 1 + h2(i, seed, 1311) % 2; sd = (1 if h2(i, seed, 1313) % 2 else -1)
        x += dx * st + (sd if dy else 0); y += dy * st + (sd if dx else 0)
        pts.append((x, y))
    return pts


def wander(seed, x0, y0, n, dx, dy):
    """금 꺾은선 점들(조금씩 흔들리며 나아간다)."""
    pts = [(x0, y0)]; x, y = x0, y0
    for i in range(n):
        x += dx * (2 + h2(i, seed, 921) % 2); y += dy * (2 + h2(i, seed, 923) % 2)
        if dx: y += h2(i, seed, 925) % 3 - 1
        if dy: x += h2(i, seed, 927) % 3 - 1
        pts.append((x, y))
    return pts


def soft_stain(c, ox, oy, cx, cy, rx, ry, seed):
    """부드러운 낮은 대비 얼룩: 덩이(2화소) 단위로 #192737 이 가운데 몰리고 바깥으로 성겨진다 — 네모·또렷한 윤곽 없음."""
    B = blobs(16, 931 + seed, 2)
    for y in range(16):
        for x in range(16):
            k = B[(x, y)][0]
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            r = (h2(k[0], k[1], 933 + seed) % 100) / 100
            if d < 1.0 and r > d * 0.9 + 0.15: c.P(ox + x, oy + y, TAR_LO)


def crumble(c, m, ox, oy, dep, seed, chunk_cols, lip, chunks=0, face=None, bites=2, deep=2, lip_all=False, lip_cont=False, jagf=jag, spread=False, wmin=3, wspan=3, gap=1, dmin=1, lip_run=1):
    """이웃 없는 쪽: 가장자리를 따라 2~4화소 크기의 물어뜯긴 자리(변마다 2~3개, 크기·깊이·간격이 제각각)가 몸을 파고들어 흙이 드러난다.
    외톨이 화소는 지운다(흙 속 떠 있는 몸 화소·몸 속 낱 흙 화소). 깨진 자리 아래(남쪽 앞)만 1화소 어두운 턱 — 군데군데 끊겨 이어진 선이 아니다.
    chunks>0 이면 흙 쪽에 떨어진 조각(3×2, 몸에서 한 칸 이상 떨어짐). 반환: 흙 판정 함수."""
    S = [[dep[y][x] > 0 for x in range(16)] for y in range(16)]
    bit_s = set()
    for side, bit in ((0, N), (1, E), (2, Sb), (3, W)):
        if m & bit: continue
        pos = 2 + h2(seed, side, 945) % 5
        nb = bites
        if spread == 'wide': nb = 1 + (h2(seed, side, 944) % 3 == 0)                # 넓은 덩이 1개(가끔 2개) — 사이는 얕고 넓은 판 끝
        for j in range(nb):
            if spread == 'wide': pos = (2 + h2(seed, side * 3 + j, 946) % 6) if nb == 1 else ((1, 8)[j] + h2(seed, side * 3 + j, 946) % 2)
            elif spread and bites == 1: pos = (2 if side in (0, 3) else 9) + h2(seed, side, 946) % 3          # 덩이 하나: 북·서는 앞쪽, 남·동은 뒤쪽 — 마주 보는 변과 겹치지 않게
            elif spread: pos = ((1, 6, 10) if bites == 3 else ((2, 8) if side in (0, 3) else (4, 10)))[j % 3] + h2(seed, side * 3 + j, 946) % 3 - (1 if j == 0 and h2(seed, side, 948) % 2 else 0)     # 변을 나눠 하나씩 — 마주 보는 변(북↔남, 서↔동)은 자리를 엇갈려 띠가 구슬처럼 잘록해지지 않게
            if pos > 12: break
            w = (wmin + h2(j, side, 947 + seed) % wspan) if nb == 1 or spread != 'wide' else min(wmin, 6); dd = dmin + h2(j, side, 949 + seed) % deep      # 둥근 물어뜯긴 자리(기본 폭 3~5, 깊이 1~2 더)
            for t in range(w):
                i = pos + t
                if i > 14: continue
                sn = math.sin(math.pi * (t + 0.5) / w); sn = sn ** 0.5 if spread else sn          # spread: 바닥이 둥근(납작한 U) 덩이
                prof = int(round(dd * sn + (0 if spread == 'wide' else (h2(i, side, 955 + seed) % 3 - 1) * 0.4)))
                for u in range(max(0, prof)):
                    base = jagf(i, side, m) + u
                    x, y = {0: (i, base), 2: (i, 15 - base), 3: (base, i), 1: (15 - base, i)}[side]
                    if 0 <= x < 16 and 0 <= y < 16:
                        S[y][x] = True
                        if side == 2: bit_s.add((x, y))       # 남쪽 변의 물어뜯긴 자리 — 그 위 몸 화소가 깨진 앞면(턱)
            pos += w + (3 + h2(j, side, 951 + seed) % 5 if bites <= 2 else 1 + h2(j, side, 951 + seed) % 3)
    for _ in range(2):                                    # 외톨이 정리
        for y in range(16):
            for x in range(16):
                nb = [S[y + dy][x + dx] if 0 <= x + dx < 16 and 0 <= y + dy < 16 else None for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                if not S[y][x] and sum(1 for v in nb if v) >= 3: S[y][x] = True
                elif S[y][x] and dep[y][x] == 0 and sum(1 for v in nb if v is False) >= 3: S[y][x] = False
    soil = lambda x, y: 0 <= x < 16 and 0 <= y < 16 and S[y][x]
    for y in range(16):
        for x in range(16):
            if soil(x, y): c.P(ox + x, oy + y, dirt_col(dirt_base(x, y)))
    LP = {(x, y) for y in range(16) for x in range(16)
          if not soil(x, y) and soil(x, y + 1) and (((x, y + 1) in bit_s and h2(x, y, seed + 5) % 3) or (lip_all and h2(x, y, seed + 5) % 5) or lip_cont)}
    if lip_run > 1:                                       # 턱은 lip_run 화소 이상 이어진 토막만(대각 계단 이음 포함) — 낱점 턱이 점선으로 보이지 않게
        keep = set(); seen = set()
        for p0 in sorted(LP):
            if p0 in seen: continue
            comp, todo = [], [p0]
            while todo:
                q = todo.pop()
                if q in seen or q not in LP: continue
                seen.add(q); comp.append(q)
                todo += [(q[0] + dx, q[1] + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]
            if len(comp) >= lip_run: keep |= set(comp)
        LP = keep
    for y in range(16):                                   # 깨진 자리 밑 1화소 턱: 남쪽으로 물어뜯긴 자리(bite) 바로 위에만, 1~3화소 토막(끊김 있음) + 판 두께 앞면(선택)
        for x in range(16):
            if (x, y) in LP:
                c.P(ox + x, oy + y, lip)
                if face is not None and y > 0 and not soil(x, y - 1) and (lip_cont or h2(x, y, seed + 6) % 3): c.P(ox + x, oy + y - 1, face)
    for y in range(1, 16):                                # 턱 아래 흙 그늘(군데군데)
        for x in range(16):
            if soil(x, y) and not soil(x, y - 1) and h2(x, y, seed + 7) % 3 == 0: c.P(ox + x, oy + y, K('dirt', 2))
    placed = 0
    for k in range(40):
        if placed >= chunks: break
        x = h2(k, seed, 951) % 13; y = h2(k, seed, 953) % 14
        cells = [(x + dx, y + dy) for dx in range(3) for dy in range(2)]
        ring = [(px, py) for px in range(x - gap, x + 3 + gap) for py in range(y - gap, y + 2 + gap)]
        if all(soil(px, py) or not (0 <= px < 16 and 0 <= py < 16) for px, py in ring) and all(0 <= px < 16 and 0 <= py < 16 for px, py in cells):
            for (px, py) in cells: c.P(ox + px, oy + py, chunk_cols[0] if py == y else chunk_cols[1])
            for px in range(x, x + 3):
                if soil(px, y + 2): c.P(ox + px, oy + y + 2, K('dirt', 1))
            placed += 1
    return soil


def asph_edge(m, side, i):
    """이웃 없는 변의 기본 깨짐 깊이 1~3 — 긴 주기 잡음(톱니 없음). 칸 끝 0·15 는 2(옆 칸과 잇는다)."""
    if i <= 0 or i >= 15: return 2
    v = vnoise(i + m * 9 + side * 23, side * 13 + m * 3, 1431 + side, 6, 64)
    d = max(1, min(3, 2 + int(round((v - 0.5) * 2.6))))      # 평균 2(칸 끝과 같은 깊이) — 칸 가운데가 부풀어 구슬처럼 이어지지 않게
    if i in (1, 14): d = min(max(d, 1), 2)
    return d


def wide_crack(c, ox, oy, pts, keep=None):
    """2화소 폭 금: 꺾은선 화소(가장 어두운 회청 asph 1) + 그 아래(가로 금)·오른쪽(세로 금) 한 화소 그늘(asph 2) = 2화소 속,
    반대쪽 위·왼쪽에 깨진 가장자리 빛 턱(밝은 회색 asph 6, 거의 끊김 없이). 1화소 글자 같은 줄이 아니다."""
    core = []
    for (p0, p1) in zip(pts, pts[1:]):
        n = max(abs(p1[0] - p0[0]), abs(p1[1] - p0[1]), 1)
        horiz = abs(p1[0] - p0[0]) >= abs(p1[1] - p0[1])
        for i in range(n + 1):
            core.append((round(p0[0] + (p1[0] - p0[0]) * i / n), round(p0[1] + (p1[1] - p0[1]) * i / n), horiz))
    cs = {(x, y) for x, y, _ in core}
    ok = lambda x, y: 0 <= x < 16 and 0 <= y < 16 and (keep is None or keep(x, y))
    sh = set()
    for x, y, hz in core:
        q = (x, y + 1) if hz else (x + 1, y)
        if q not in cs: sh.add(q)
    for x, y, hz in core:
        q = (x, y - 1) if hz else (x - 1, y)
        if q not in cs and q not in sh and ok(*q) and h2(x, y, 1441) % 5: c.P(ox + q[0], oy + q[1], K('asph', 6))
    for q in sh:
        if ok(*q): c.P(ox + q[0], oy + q[1], K('asph', 2))
    for x, y, _ in core:
        if ok(x, y): c.P(ox + x, oy + y, K('asph', 1))


def tar_flat(c, ox, oy, seed, flecks=3, patch=True):
    """현대 도로처럼 거의 평평한 아스팔트 몸: 바탕 524b49 한 단 + 칸의 2/3 에만 칸 안에서 끝나는 큰 부드러운 닳은 자리 하나(68605e, 6~12화소, 덩이 경계로 들쭉날쭉,
    자리·크기 칸마다 다름 — 칸 끝에서 잘리지 않는다) + 칸마다 1~2화소 밝은 골재 몇 알(7b7270). 고른 소금·후추 알 없음."""
    for y in range(16):
        for x in range(16): c.P(ox + x, oy + y, TAR)
    if patch:                                             # 큰 닳은 자리: 2~3화소 덩이를 타원(가로 9~13·세로 6~9화소, 칸 가운데서 비낀 자리) 안에서 모아 칠한다 — 덩이 경계라 윤곽이 들쭉날쭉, 가장자리 덩이는 반쯤만
        B = blobs(16, 1483 + seed, 3)
        cx, cy = 6.0 + h2(seed, 2, 1481) % 4, 6.0 + h2(seed, 3, 1481) % 4
        rx, ry = 6.5 + h2(seed, 4, 1481) % 2, 4.8 + h2(seed, 5, 1481) % 2
        for y in range(1, 15):
            for x in range(1, 15):
                kb = B[(x, y)][0]
                d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (h2(kb[0], kb[1], 1497 + seed) % 4) * 0.1 + 0.25 * vnoise(x, y, 1503 + seed, 4, 16)
                if d < 0.85 or (d < 1.1 and h2(kb[0], kb[1], 1499 + seed) % 2): c.P(ox + x, oy + y, TAR_HI)
    for i in range(flecks):
        x = 1 + h2(i, seed, 1489) % 14; y = 1 + h2(seed, i, 1491) % 14
        c.P(ox + x, oy + y, K('asph', 6))
        if h2(i, seed, 1493) % 2: c.P(ox + x + (1 if h2(i, seed, 1495) % 2 else 0), oy + y + (0 if h2(i, seed, 1495) % 2 else 1), K('conc', 4) if h2(i, seed, 1497) % 3 == 0 else K('asph', 6))


def asph_wob(mm, k, side, i):
    """세트 공통 낮은 일렁임: 깊이 2 ± 1, 한 칸에 걸친 완만한 사인 두 개(부호는 세트·변마다) — 칸 끝 0·15 는 2(옆 칸에 이어진다)."""
    if i <= 0 or i >= 15: return 2
    s1 = 1 if h2(mm, side, 1501) % 2 else -1; s2 = 1 if h2(mm, side, 1503) % 2 else -1
    w = 0.62 * s1 * math.sin(2 * math.pi * i / 16) + 0.3 * s2 * math.sin(4 * math.pi * i / 16 + (h2(mm, side, 1505) % 3) * 0.5)
    return max(1, min(3, 2 + int(round(w))))


def at_asphalt(c, m, ox, oy, k=0):
    """가장자리 칸 세트 A/B/C(k=0/1/2) — 네 변 모두 같은 규칙:
    A: 거의 곧은 변(1화소 완만한 일렁임, 물어뜯긴 자리 없음). B: 한쪽으로 치우친 물어뜯긴 자리 하나(+작은 조각).
    C: 물어뜯긴 자리 없이 1화소 이 빠짐 + 변에 닿는 짧은 2화소 금. 조합기가 칸마다 A/B/C 를 고르게 고르므로 덩이가 1/3 칸에만 아무렇게나 온다.
    남쪽은 마른 흙빛 턱(dirt 1) + 흙 그늘, 윤곽선 없음. 막다른 끝·외딴 칸은 볼록 모서리를 둥글게."""
    mm = m + 16 * k
    tar_flat(c, ox, oy, mm, flecks=2 + h2(mm, 0, 1497) % 2, patch=False)          # 가장자리 칸엔 닳은 자리 없음(직선 길에서 칸마다 같은 얼룩이 구슬처럼 줄서지 않게)
    miss = [sd for sd, bit in ((0, N), (1, E), (2, Sb), (3, W)) if not m & bit]
    prof = {sd: [asph_wob(mm, k, sd, i) for i in range(16)] for sd in miss}
    def put(sd, i, u):
        return {0: (i, u), 2: (i, 15 - u), 3: (u, i), 1: (15 - u, i)}[sd]
    S = [[False] * 16 for _ in range(16)]
    for sd in miss:
        for i in range(16):
            for u in range(prof[sd][i]):
                x, y = put(sd, i, u); S[y][x] = True
    for (sa, sb), (cx, cy) in (((0, 3), (0, 0)), ((0, 1), (15, 0)), ((2, 3), (0, 15)), ((2, 1), (15, 15))):   # 볼록 모서리 둥글게
        if sa in miss and sb in miss:
            r = (5 if m == 0 else 6) + h2(mm, sa * 4 + sb, 1433) % 2
            px, py = (r + 1 if cx == 0 else 14 - r), (r + 1 if cy == 0 else 14 - r)
            for y in range(16):
                for x in range(16):
                    if ((cx == 0 and x < px) or (cx == 15 and x > px)) and ((cy == 0 and y < py) or (cy == 15 and y > py)):
                        rr = r + (h2(x, y, 1435 + mm) % 3 - 1) * 0.4
                        if (x - px) ** 2 + (y - py) ** 2 > rr * rr: S[y][x] = True
    chunk, crack = None, []
    for sd in miss:
        if k == 1 and h2(mm, sd, 1507) % 4:               # B: 치우친 물어뜯긴 자리 하나(폭 4, 깊이 +2, 바닥 평평·양끝 1화소 계단)
            i0 = (2 if h2(mm, sd, 1509) % 2 else 10) + h2(mm, sd, 1511) % 2
            for t in range(4):
                i = i0 + t
                for u in range(prof[sd][i] + (1 if t in (0, 3) else 2)):
                    x, y = put(sd, i, u); S[y][x] = True
            if chunk is None and h2(mm, sd, 1513) % 2: chunk = [put(sd, i0 + 1, 0), put(sd, i0 + 2, 0)]
        elif k == 2:                                       # C: 1화소 이 빠짐 + 짧은 금
            i0 = 3 + h2(mm, sd, 1515) % 9
            for t in range(2):
                x, y = put(sd, i0 + t, prof[sd][i0 + t]); S[y][x] = True
            if h2(m, 7, 1517) % 3 == 0 and sd == miss[h2(m, 9, 1519) % len(miss)] and not crack:
                j = 12 - i0 if 3 <= 12 - i0 <= 12 else i0 + 3
                d0 = prof[sd][j]
                dj = 1 if j < 8 else -1
                crack.append([put(sd, j, d0), put(sd, j + dj, d0 + 2), put(sd, j + 3 * dj, d0 + 4), put(sd, j + 4 * dj, d0 + 6)])
    for _ in range(2):                                    # 외톨이 정리
        for y in range(16):
            for x in range(16):
                nb4 = [S[y + dy][x + dx] if 0 <= x + dx < 16 and 0 <= y + dy < 16 else None for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                if not S[y][x] and sum(1 for v in nb4 if v) >= 3: S[y][x] = True
                elif S[y][x] and sum(1 for v in nb4 if v is False) >= 3: S[y][x] = False
    soil = lambda x, y: 0 <= x < 16 and 0 <= y < 16 and S[y][x]
    road = lambda x, y: 0 <= x < 16 and 0 <= y < 16 and not S[y][x]
    for y in range(16):
        for x in range(16):
            if soil(x, y): c.P(ox + x, oy + y, dirt_col(dirt_base(x, y)))
    for pts in crack: wide_crack(c, ox, oy, pts, keep=road)
    for x in range(16):                                   # 남쪽 마른 턱(흙빛 dirt 1, 드물게 2화소) + 흙 그늘 — 차가운 근흑 없음
        for y in range(15, -1, -1):
            if road(x, y) and soil(x, y + 1):
                if y < 6: break
                c.P(ox + x, oy + y, K('dirt', 1))
                if h2(x, mm, 1445) % 4 == 0 and road(x, y - 1) and road(x, y - 2): c.P(ox + x, oy + y - 1, K('dirt', 1))
                c.P(ox + x, oy + y + 1, K('dirt', 2))
                break
    if chunk and all(soil(x, y) for x, y in chunk):         # B 의 떨어진 작은 조각(2×1, 몸 색 + 흙 그늘)
        for x, y in chunk: c.P(ox + x, oy + y, TAR)
        for x, y in chunk:
            if soil(x, y + 1) and (x, y + 1) not in chunk: c.P(ox + x, oy + y + 1, K('dirt', 1))


def at_asphalt_inner(c, v, ox, oy):
    """꽉 찬 칸 속 변형 8칸(5·6번째 줄) — 거의 평평한 아스팔트(큰 부드러운 자리 두 단·드문 골재), 3칸에만 드문 2화소 폭 그늘진 금."""
    tar_flat(c, ox, oy, 40 + v, flecks=2 + v % 3, patch=v in (2, 5))
    if v == 0: wide_crack(c, ox, oy, [(0, 4), (4, 5), (8, 8), (12, 9), (15, 12)])
    elif v == 4: wide_crack(c, ox, oy, [(0, 11), (5, 10), (9, 7), (15, 6)])
    elif v == 7: wide_crack(c, ox, oy, [(10, 0), (9, 4), (6, 8), (5, 12), (2, 15)])


def autosheet(fn, inner=None, n_inner=4):
    """4×4 마스크 칸(칸 (m%4, m//4)) + inner 가 있으면 5번째 줄부터 꽉 찬 속 변형 n_inner 칸(한 줄 4칸씩)."""
    def draw(c):
        for m in range(16): fn(c, m, (m % 4) * 16, (m // 4) * 16)
        if inner:
            for v in range(n_inner): inner(c, v, (v % 4) * 16, 64 + (v // 4) * 16)
    return draw


# 오토타일 표본: 흙 위 길 — 교차로·막다른 길·T자·굽이·넓은 판·외딴 칸까지 16마스크가 모두 나온다.
AUTO_LAYOUT = [
    '...........',
    '.#...#...#.',
    '.##..#..##.',
    '.#.#####.#.',
    '.....#.....',
    '.....#.....',
    '...#.#..##.',
    '.#####..##.',
    '...........',
    '..###..#...',
    '...#.......',
    '...........',
]


def auto_masks(layout):
    H, Wd = len(layout), len(layout[0]); out = {}
    on = lambda x, y: 0 <= x < Wd and 0 <= y < H and layout[y][x] in '#bc'
    for y in range(H):
        for x in range(Wd):
            if on(x, y): out[(x, y)] = (N if on(x, y - 1) else 0) | (E if on(x + 1, y) else 0) | (Sb if on(x, y + 1) else 0) | (W if on(x - 1, y) else 0)
    return out


AUTO_SAMPLE_LAYOUT = [r + ('.####' if 1 <= i <= 6 else '.....') for i, r in enumerate(AUTO_LAYOUT)]   # 오른쪽 넓은 판: 속 변형이 섞이는 꽉 찬 칸


def auto_sample(pid, inner=True, field=None, fper=8, layout=None, n_inner=None, mask_rows=None):
    def f(_=0):
        lay = layout or AUTO_SAMPLE_LAYOUT; H, Wd = len(lay), len(lay[0])
        a = np.zeros((H * 16, Wd * 16, 4), np.uint8)
        ms = auto_masks(lay); nv = [0]
        da_full = render(PIECES['dirt-b']); at = render(PIECES[pid])
        for y in range(H):
            for x in range(Wd):
                if (x, y) in ms:
                    m = ms[(x, y)]; cx, cy = m % 4, m // 4
                    if m == 15 and field:
                        fa = render(PIECES[field]); fx, fy = x % fper, y % fper
                        a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = fa[fy * 16:(fy + 1) * 16, fx * 16:(fx + 1) * 16]; continue
                    if m == 15 and inner and at.shape[0] > 64 and hsh(x, y, 9) % 4:
                        nin = n_inner or (at.shape[0] // 16 - 4) * 4; nv[0] += 1; vi = (nv[0] - 1) % nin
                        cx, cy = vi % 4, 4 + vi // 4                                     # 속 변형을 차례로(같은 변형이 겹치지 않게)
                    elif m != 15 and mask_rows:                                          # 가장자리 세트를 칸 자리 해시로 섞는다(조합기와 같은 방식)
                        cy = mask_rows[hsh(x, y, 13) % len(mask_rows)] + m // 4
                    src = at[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16]
                else: src = da_full[(y % 8) * 16:(y % 8 + 1) * 16, (x % 8) * 16:(x % 8 + 1) * 16]
                a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = src
        return a
    return f


ASPH_SET_ROWS = (0, 6, 10)                                # 가장자리 세트 A/B/C 의 첫 줄(4줄씩) — 5·6번째 줄(4·5)은 속 변형 8칸


def asph_sheet(c):
    for k, r0 in enumerate(ASPH_SET_ROWS):
        for m in range(16): at_asphalt(c, m, (m % 4) * 16, (r0 + m // 4) * 16, k)
    for v in range(8): at_asphalt_inner(c, v, (v % 4) * 16, 64 + (v // 4) * 16)


# 아스팔트 표본: 기본 표본 + 아래 12칸 가로 직선 길·오른쪽 12칸 세로 직선 길(가장자리 세트 섞임을 직선에서 보이게)
_base = [r + '.' * 7 for r in AUTO_SAMPLE_LAYOUT + ['.' * 16]]
ASPH_SAMPLE_LAYOUT = [r[:17] + ('#' if 1 <= i <= 12 else '.') + '.' + ('###' if 1 <= i <= 12 else '...') + '.' for i, r in enumerate(_base)] + \
    ['.' + '#' * 12 + '.' * 10, '.' * 23, '.' + '#' * 12 + '.' * 10, '.' + '#' * 12 + '.' * 10, '.' + '#' * 12 + '.' * 10, '.' * 23]   # 1칸 폭·3칸 폭 12칸 직선(가로·세로)


piece('asphalt', '금 간 아스팔트 (오토타일)', 4, 14, TERRAIN,
      en='old asphalt road, mostly flat smooth charcoal like a modern city road: two close base greys in large soft patches with a few worn lighter spots, very sparse 1-2 pixel light aggregate flecks and rare shaded 2-pixel-wide cracks (no lane paint); its unconnected edges are a nearly straight slightly wavy broken rim into dirt, with an occasional bite, chip or short edge crack, and a dry dark-brown ledge on the south side; laid as a road network with crossroads, dead ends and long straight 1-wide and 3-wide runs that mix three edge variants',
      group='ground', tags=['아스팔트', '도로', '오토타일'],
      desc='낡은 옛 아스팔트 도로(현대 도로처럼 거의 평평: 가까운 두 회색의 큰 부드러운 자리·드문 닳은 자리·드문 골재 알·드문 2화소 폭 그늘진 금, 차선 칠 없음). 이웃이 도로가 아닌 쪽은 낮게 일렁이는 거의 곧은 깨진 변 — 세트 A 곧은 변, B 치우친 물어뜯긴 자리 하나, C 1화소 이 빠짐·변에 닿는 짧은 금, 남쪽은 마른 흙빛 턱. 칸 (m%4, m//4) 마스크(N1 E2 S4 W8): 1~4번째 줄 세트 A, 7~10번째 줄 세트 B, 11~14번째 줄 세트 C(같은 마스크, 깨진 자리만 다름 — 칸 자리 해시로 섞는다), 5·6번째 줄 8칸은 꽉 찬 칸(마스크 15) 속 변형',
      sample=auto_sample('asphalt', layout=ASPH_SAMPLE_LAYOUT, n_inner=8, mask_rows=ASPH_SET_ROWS))(asph_sheet)
AUTO['asphalt'] = dict(name='금 간 아스팔트', kind=TERRAIN)
assert len(set(auto_masks(AUTO_LAYOUT).values())) == 16, sorted(set(auto_masks(AUTO_LAYOUT).values()))


# asphalt-b/-c(패인 구멍·균열 낱칸)는 감독 결정으로 뺐다 — 속 변형은 asphalt 5·6번째 줄이 맡는다.


# ------------------------------------------------------------------ 발길(판잣집 사이 다져진 흙길, 오토타일)
def track_jag(i, side, m):
    """발길 가장자리 깊이 3..5 — 아스팔트보다 넓고 부드럽게 흙으로 번진다(끝 0·15 는 4 고정)."""
    if i <= 0 or i >= 15: return 3
    v = 0.7 * vnoise(i + m * 5, side * 11, 811 + side, 6, 64) + 0.3 * (h2(i // 3, side, 813 + m) % 100) / 100
    return 2 + int(v * 2.9)


_TT = {}


def _track_tones(seed):
    """발길 덩이 단: 밝은 흙 5 바탕 · 따뜻한 붉은 흙(rust 5, 더 밝다) 덩이 · 드문 3 — 같은 값 이웃이 셋 이상이면 바꿔 판이 뭉치지 않게. 칸(시드)마다 다른 지도."""
    if seed in _TT: return _TT[seed]
    B = blobs(16, 801 + seed * 3, 3); nb = collections.defaultdict(set); T = {}
    for (x, y), (k, e, l) in B.items():
        for (dx, dy) in ((1, 0), (0, 1)):
            k2 = B[((x + dx) % 16, (y + dy) % 16)][0]
            if k2 != k: nb[k].add(k2); nb[k2].add(k)
    for k in sorted(nb, key=lambda k: (k[1], k[0])):
        r = h2(k[0], k[1], 805 + seed) % 100
        t = 'w' if r < 9 else 3 if r < 20 else 5
        if t == 5 and sum(1 for n in nb[k] if T.get(n) == 5) >= 4: t = 'w' if r % 2 else 3
        T[k] = t
    _TT[seed] = (B, T)
    return _TT[seed]


def track_col(t):
    return K('rust', 5) if t == 'w' else K('dirt', t)


def at_track(c, m, ox, oy, inner=None):
    """발길 칸: 둘레 흙(3 이 큰 몫)보다 한 단 밝고 따뜻한 다져진 흙(5 · rust 5 덩이). 이웃 없는 쪽은 덩이째 흙으로 번진다(윤곽 없음).
    곧은 칸엔 바퀴 자국 두 줄(어두운 2·3 + 아래 밝은 턱). inner=v 면 꽉 찬 칸 속 변형(발자국 줄 · 자갈 · 마른 풀)."""
    P = lambda x, y, col: c.P(ox + x, oy + y, col)
    seed = m if inner is None else 30 + inner
    dep = soil_depth(m, track_jag)
    Bt, T = _track_tones(seed)
    B = blobs(16, 801)
    def is_soil(x, y):
        k, _, _ = B[(x, y)]
        return dep[y][x] + ((h2(k[0], k[1], 803 + m) % 100) / 100 - 0.5) * 3.6 + (h2(x, y // 2, 809 + m) % 3 - 1) * 0.5 > 0.6     # 덩이째 흙/길이 섞이는 번진 가장자리(윤곽 없음)
    S = [[is_soil(x, y) for x in range(16)] for y in range(16)]
    for y in range(16):
        for x in range(16):
            P(x, y, dirt_col(dirt_base(x, y)) if S[y][x] else track_col(T[Bt[(x, y)][0]]))
    for y in range(16):                                   # 길가로 밀려난 흙: 길에 닿은 흙 덩이 셋 중 하나를 한 단 어둡게(끊긴 덩이, 선 아님) — 밝은 길이 1배에서 읽히게
        for x in range(16):
            if S[y][x] and any(0 <= x + dx < 16 and 0 <= y + dy < 16 and not S[y + dy][x + dx] for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                k = B[(x, y)][0]
                if h2(k[0], k[1], 851 + m) % 3 == 0: P(x, y, K('dirt', 2))
    def mark(x, y, t):
        if 0 <= x < 16 and 0 <= y < 16 and not S[y][x]: P(x, y, K('dirt', t))
    # 바퀴 자국: 곧은 칸(가로만·세로만 이어짐)에만 두 줄 — 어두운 2·3(군데군데 끊김) + 아래·오른 밝은 턱(rust 5)
    if m & (E | W) and not m & (N | Sb):
        for x in range(0 if m & W else 4, 16 if m & E else 12):
            for yy in (5, 10):
                if h2(x, yy, 821) % 5:
                    mark(x, yy, 2 if h2(x, yy, 825) % 2 == 0 else 3)
                    pass
    if m & (N | Sb) and not m & (E | W):
        for y in range(0 if m & N else 4, 16 if m & Sb else 12):
            for xx in (5, 10):
                if h2(xx, y, 823) % 5:
                    mark(xx, y, 2 if h2(xx, y, 827) % 2 == 0 else 3)
                    pass
    # 발자국: 끝 칸·굽이에 두어 개(2화소, 어긋난 걸음) — 꽉 찬 칸은 속 변형만 맡는다
    if m != 15 and inner is None:
        for i in range(2):
            x = 6 + h2(i, m, 831) % 4; y = 3 + i * 6 + h2(i, m, 833) % 3
            if not S[y][x] and not S[y + 1][x]: mark(x, y, 3); mark(x, y + 1, 2)
    if inner == 0:                                        # 발자국 줄(비스듬히 어긋난 걸음 셋)
        for (x, y) in ((4, 2), (7, 6), (5, 10), (8, 13)):
            mark(x, y, 3); mark(x, y + 1, 2); mark(x + 1, y + 1, 3)
    elif inner == 1:                                      # 박힌 자갈 둘 + 흙덩이 그늘
        for (x, y, sz) in ((5, 6, 3), (10, 11, 2)):
            pebble(c, ox + x, oy + y, sz, 'conc', 5, 4, 2, K('dirt', 2))
    elif inner == 2:                                      # 길가에서 번져 든 마른 풀 한 포기 + 밟혀 갈라진 흙 한 줄
        fan(c, ox + 11, oy + 12, 4, 'dry', 41, 5, 2)
        for (x, y) in ((2, 5), (3, 5), (4, 6), (5, 6), (6, 7)): mark(x, y, 3)
    # 길가 흙 쪽 자갈 한두 개(2화소)
    for i in range(2):
        x = h2(i, m, 841) % 15; y = h2(i, m, 843) % 15
        if S[y][x] and S[y][x + 1] and dep[y][x] <= 4 and h2(i, m, 845) % 2:
            P(x, y, K('conc', 4)); P(x + 1, y, K('conc', 3))
            if y + 1 < 16 and S[y + 1][x]: P(x, y + 1, K('dirt', 1))


def at_track_inner(c, v, ox, oy):
    if v < 3: at_track(c, 15, ox, oy, inner=v)


piece('track', '발길 (오토타일)', 4, 5, TERRAIN,
      en='a worn footpath of packed earth between shacks, clearly lighter and warmer than the surrounding dirt, with wheel ruts on straight runs and a few footprints, its edges feathering softly into the dirt with no outline, laid as a path network with crossings and dead ends',
      group='ground', tags=['흙길', '발길', '오토타일'],
      desc='판잣집 사이 다져진 흙 발길. 둘레 흙보다 밝고 따뜻하게 닳았고 곧은 칸엔 바퀴 자국 두 줄이 난다. 이웃이 길이 아닌 쪽은 덩이째 흙으로 번져 끝난다(윤곽 없음). 4×4 마스크 칸(N1 E2 S4 W8, 칸 (m%4, m//4)), 5번째 줄 3칸은 꽉 찬 칸에 섞는 속 변형(발자국 줄·자갈·마른 풀).',
      sample=auto_sample('track'))(autosheet(at_track, at_track_inner))
AUTO['track'] = dict(name='발길', kind=TERRAIN)




# ------------------------------------------------------------------ 콘크리트 판
# 깨진 콘크리트 판 이음 판(64×64, 칸 (x mod 4, y mod 4) 자리): 불규칙한 판(감싼 보로노이, 크기 20~34화소) — 이음은 비스듬하고 칸 격자와 안 맞는다.
SP = 128                                                   # 콘크리트 판 이음 주기(8칸) — 판이 커야 깨진 포장으로 읽힌다(64 주기에선 벽돌처럼 보였다)
SLAB_BANDS = [(0, [0, 37, 83]), (34, [19, 64, 101]), (79, [8, 51, 90])]     # (띠 시작 y, 세로 이음 x 들) — 띠 높이 34·45·49, 판 폭 37~46
SLAB_FRACTURES = [[(37, 3), (47, 14), (52, 33)], [(64, 37), (75, 51), (79, 66), (86, 78)], [(8, 82), (22, 96), (31, 112), (40, 127)],
                  [(101, 40), (110, 47), (128, 52)], [(83, 6), (90, 20), (101, 33)], [(51, 90), (63, 99), (70, 112)], [(0, 55), (10, 62), (19, 64)]]
SLAB_HOLES = [(84, 34, 7, 4), (19, 79, 5, 3), (52, 126, 6, 4), (101, 80, 4, 3), (36, 34, 3, 2), (1, 1, 5, 3), (70, 60, 4, 3)]
SLAB_SUNK = [(40, 60), (110, 100)]                                        # 이 화소가 든 판은 내려앉아 한 단 어둡다
SLAB_CRACKS = [[(6, 14), (13, 18), (22, 17)], [(70, 15), (76, 19), (80, 26)], [(25, 50), (31, 55), (38, 54)], [(108, 60), (114, 66), (120, 66)],
               [(60, 106), (66, 110), (75, 109)], [(114, 112), (119, 118)]]


def _slab_maps():
    seam, frac, hole = set(), set(), set()
    for k, (y0, xs) in enumerate(SLAB_BANDS):
        y1 = SLAB_BANDS[(k + 1) % len(SLAB_BANDS)][0] + (SP if k == len(SLAB_BANDS) - 1 else 0)
        for x in range(SP):
            w = 1 if h2(x // 7, y0, 266) % 4 == 0 else 0                     # 가로 이음 살짝 흔들림
            seam.add((x, (y0 + w) % SP))
        for vx in xs:
            for y in range(y0, y1):
                w = 1 if h2(vx, y // 7, 267) % 4 == 0 else 0
                seam.add(((vx + w) % SP, y % SP))
    for pts in SLAB_FRACTURES:
        for (a, b) in zip(pts, pts[1:]):
            n = max(abs(b[0] - a[0]), abs(b[1] - a[1]), 1)
            for i in range(n + 1): frac.add((round(a[0] + (b[0] - a[0]) * i / n) % SP, round(a[1] + (b[1] - a[1]) * i / n) % SP))
    for (cx, cy, rx, ry) in SLAB_HOLES:
        for y in range(cy - ry - 1, cy + ry + 2):
            for x in range(cx - rx - 1, cx + rx + 2):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (h2(x, y, 265) % 3) * 0.15 < 1: hole.add((x % SP, y % SP))
    sunk = set()
    for st in SLAB_SUNK:
        todo = [st]
        while todo:
            p_ = todo.pop()
            if p_ in sunk or p_ in seam or p_ in frac: continue
            sunk.add(p_); x, y = p_
            todo += [((x + 1) % SP, y), ((x - 1) % SP, y), (x, (y + 1) % SP), (x, (y - 1) % SP)]
    return seam, frac, hole, sunk


_SLAB_MAPS = None


def slab_field(c, ox, oy):
    global _SLAB_MAPS
    if _SLAB_MAPS is None: _SLAB_MAPS = _slab_maps()
    seam, frac, hole, sunk = _SLAB_MAPS
    line = lambda x, y: (x % SP, y % SP) in seam or (x % SP, y % SP) in frac
    for y in range(SP):
        for x in range(SP):
            if (x, y) in hole:
                up = (x, (y - 1) % SP) not in hole
                c.P(ox + x, oy + y, K('dirt', 1 if up else dirt64_tone(x, y))); continue
            if (x, y) in seam: c.P(ox + x, oy + y, K('conc', 1)); continue
            if (x, y) in frac: c.P(ox + x, oy + y, K('conc', 2)); continue
            f = 0.6 * wrapnoise(x, y, 231, 32, SP) + 0.4 * wrapnoise(x, y, 237, 8, SP)
            t = 5 + (1 if f > 0.66 else 0) - (1 if f < 0.26 else 0)
            gx, gy = (x + (y // 2) % 2) // 2, y // 2
            d = h2(gx % (SP // 2), gy % (SP // 2), 241) % 7
            if d in (0, 1): t += 1
            elif d == 2: t -= 1
            if (x, y) in sunk: t -= 1
            if line(x, y - 1) or line(x - 1, y): t = 7 if (x, y) not in sunk else 5
            elif line(x, y + 1) or line(x + 1, y): t = 3
            if (x, (y - 1) % SP) in hole: t = 7
            c.P(ox + x, oy + y, K('conc', max(2, min(7, t))))
    def P(x, y, col): c.P(ox + x % SP, oy + y % SP, col)
    for pts in SLAB_CRACKS:
        for (a, b) in zip(pts, pts[1:]):
            n = max(abs(b[0] - a[0]), abs(b[1] - a[1]), 1)
            for k in range(n + 1):
                x = round(a[0] + (b[0] - a[0]) * k / n); y = round(a[1] + (b[1] - a[1]) * k / n)
                if not line(x, y) and (x % SP, y % SP) not in hole: P(x, y, K('conc', 3))


def _slab_seams_in(cx, cy):
    global _SLAB_MAPS
    if _SLAB_MAPS is None: _SLAB_MAPS = _slab_maps()
    seam, frac = _SLAB_MAPS[0], _SLAB_MAPS[1]
    return [(x, y) for y in range(cy * 16 + 3, cy * 16 + 14) for x in range(cx * 16 + 2, cx * 16 + 14) if (x, y) in seam or (x, y) in frac]


def _slab64(v):
    """v=0 바탕 판. v=1 은 이음에서 자란 잡초(칸마다 다른 자리·크기), v=2 는 모양이 제각각인 기름 얼룩 — 같은 자리 칸과 바꿔 끼운다."""
    def draw(c):
        slab_field(c, 0, 0)
        if v == 0: return
        for cy in range(SP // 16):
            for cx in range(SP // 16):
                ox, oy = cx * 16, cy * 16; r = h2(cx, cy, 310 + v)
                if v == 1:
                    sm = _slab_seams_in(cx, cy)
                    if not sm: continue
                    for k in range(1 + r % 2):
                        x, y = sm[(r >> (4 * k)) % len(sm)]
                        fan(c, x, min(y + 1, oy + 14), 4 + (r >> 2) % 3, 'grass' if (k + r) % 3 else 'dry', (r + k) % 97, 6, 2)
                else:
                    cxm, cym = ox + 4 + r % 8, oy + 4 + (r >> 4) % 8
                    rx, ry = 2.5 + (r % 3), 1.6 + ((r >> 2) % 2)
                    for y in range(int(cym - ry - 1), int(cym + ry + 2)):
                        for x in range(int(cxm - rx - 1), int(cxm + rx + 2)):
                            d = ((x - cxm) / rx) ** 2 + ((y - cym) / ry) ** 2 + (h2(x, y, r) % 5) * 0.08
                            if d < 1 and c.get(x, y) in MAT['conc']:
                                c.P(x, y, K('soot', 5) if d > 0.6 else K('soot', 4 if (x + y) % 4 else 5))
    return draw


SLAB_IDS = {'a': ('slab-a', None, None), 'b': ('slab-b', None, None), 'c': ('slab-c', None, None)}
_slab_grid = {'a': ['aaaaaaaaaa'] * 8, 'b': ['aabaaaabaa', 'aaaabaaaab', 'baaaaaaaba', 'aaabaabaaa', 'abaaabaaaa', 'aaaaaaabaa', 'abaaaaaaab', 'aaaabaaaaa'],
              'c': ['aaacaaaaca', 'caaaaacaaa', 'aaaacaaaac', 'acaaaaaaca', 'aaacaacaaa', 'caaaaaaaca', 'aaaacaaaaa', 'acaaaaacaa']}
for _v, _l in enumerate('abc'):
    piece('slab-' + _l, '금 간 콘크리트 판 ' + 'ABC'[_v], 8, 8, TERRAIN,
          en='broken old concrete pavement: irregular slanted pads of different sizes, raised and sunken edges along the seams, missing chunks showing earth where pads meet, cracks crossing tile borders, a seamless 8x8-tile field' +
             ['', ', mixed with tiles of weeds in small cracks', ', mixed with tiles of oil stains and grit'][_v],
          group='ground', tags=['콘크리트', '광장', '바닥'],
          desc='옛 광장·건물 바닥의 깨진 콘크리트 판 이음 판(8×8칸, 주기 128화소) — 맵 칸 (x,y) 에는 판의 (x mod 8, y mod 8) 칸을 깐다. A 바탕, B 잡초·C 기름 얼룩은 같은 자리 칸을 드물게 바꿔 끼운다.',
          sample=tiled(SLAB_IDS, _slab_grid[_l]))(_slab64(_v))


# ------------------------------------------------------------------ 콘크리트 판 가장자리(오토타일)
_SLAB_A = None


_SB = []


def _slab_body():
    """slab-a 그림에서 이음·금·구멍과 그 둘레 빛/그늘 화소를 옆 몸 화소로 메운 판(128×128) — 가장자리 칸 몸을 안쪽 판과 같은 색·결로."""
    if _SB: return _SB[0]
    global _SLAB_MAPS
    if _SLAB_MAPS is None: _SLAB_MAPS = _slab_maps()
    seam, frac, hole, sunk = _SLAB_MAPS
    A = render(PIECES['slab-a'])
    bad = set()
    for (x, y) in seam | frac | hole:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1): bad.add(((x + dx) % SP, (y + dy) % SP))
    col = lambda x, y: (int(A[y, x, 0]) << 16) | (int(A[y, x, 1]) << 8) | int(A[y, x, 2])
    B = [[0] * SP for _ in range(SP)]
    for x in range(SP):
        for y in range(SP):
            if (x, y) not in bad: B[x][y] = col(x, y); continue
            for r in range(2, 12):
                cand = [((x + d) % SP, y) for d in (r, -r)] + [(x, (y + d) % SP) for d in (r, -r)]
                ok = [p for p in cand if p not in bad and p not in sunk] or [p for p in cand if p not in bad]
                if ok: B[x][y] = col(*ok[0]); break
            else: B[x][y] = col(x, y)
    _SB.append(B)
    return B


_SA = []


def _slab_calm():
    """slab-a 몸(이음·금·구멍 지운 판 _slab_body)에서 고른 칸 창 후보: 평균 색(R·G·B 따로)이 안쪽 판 평균에 가깝고 얼룩 변화가 작은 16×16 창 —
    둘레가 더 밝거나 더 누렇게 띠지지 않고, 같은 마스크 칸이 줄지어 반복돼도 눈에 띄는 무늬(금·이음 토막)가 없어 16화소 박자가 안 보이게."""
    if _SA: return _SA[0]
    import numpy as np
    B = _slab_body()
    arr = np.array([[[(B[x][y] >> 16) & 255, (B[x][y] >> 8) & 255, B[x][y] & 255] for x in range(SP)] for y in range(SP)], float)
    A = render(PIECES['slab-a'])[..., :3].astype(float)
    target = A.reshape(-1, 3).mean(0)
    ext = np.concatenate([np.concatenate([arr, arr], 1)] * 2, 0)
    cand = []
    for oy in range(0, SP, 2):
        for ox in range(0, SP, 2):
            w = ext[oy:oy + 16, ox:ox + 16].reshape(-1, 3)
            cand.append((float(np.abs(w.mean(0) - target).sum()), float(w.std(0).mean()), ox, oy))
    near = sorted(cand)[:len(cand) // 5]
    near.sort(key=lambda t: t[1])
    ok = [(ox, oy) for (_, _, ox, oy) in near[:max(8, len(near) // 2)]]
    _SA.append(ok)
    return ok


def at_slab_edge(c, m, ox, oy):
    """판 영역 가장자리 칸 = 둘레 경계석 줄: 몸은 slab-a 몸결(이음·금 없는 고른 창, 밝기·얼룩 slab-a 가운데) — 금·이음 토막을 칸마다 찍지 않아 줄지어도 박자가 안 보인다.
    한 변만 트인 곧은 둘레 칸은 맞은편(안쪽 판과 맞닿는) 경계에 slab-a 와 같은 이음(conc 1, 위·왼 그늘 conc 3, 아래·오른 빛 conc 7)을 둘러
    안쪽 판 이음이 T 자로 와 닿는다(모서리·띠 칸엔 이음 없음 — 칸 격자가 안 보이게). 이웃 없는 쪽은 아스팔트와 같은 방식으로 2~4화소 덩이째 깨져(변마다 둥근 물어뜯긴 자리 3개) 흙이 드러나고,
    깨진 자리 아래엔 끊긴 1화소 어두운 턱(판 두께), 흙엔 떨어진 콘크리트 조각."""
    B = _slab_body(); ok = _slab_calm()
    offx, offy = ok[h2(m, 1, 971) % len(ok)]
    for y in range(16):
        for x in range(16):
            c.P(ox + x, oy + y, B[(x + offx) % SP][(y + offy) % SP])
    n_, e_, s_, w_ = bool(m & N), bool(m & E), bool(m & Sb), bool(m & W)
    seam = set()
    if m in (7, 11, 13, 14):                                       # 한 변만 트인 곧은 둘레 칸: 맞은편(안쪽 판과 맞닿는) 경계에만 이음 — 모서리·띠 칸은 이음 없음(격자가 안 보이게)
        if not n_: seam = {(x, 15) for x in range(16)}
        elif not s_: seam = {(x, 0) for x in range(16)}
        elif not w_: seam = {(15, y) for y in range(16)}
        else: seam = {(0, y) for y in range(16)}
    for (x, y) in seam: c.P(ox + x, oy + y, K('conc', 1))
    for (x, y) in seam:
        for (dx, dy, t) in ((1, 0, 7), (0, 1, 7), (-1, 0, 3), (0, -1, 3)):
            px, py = x + dx, y + dy
            if 0 <= px < 16 and 0 <= py < 16 and (px, py) not in seam: c.P(ox + px, oy + py, K('conc', t))
    crumble(c, m, ox, oy, soil_depth(m), 60 + m, (K('conc', 5), K('conc', 3)), K('conc', 1), chunks=h2(m, 4, 975) % 2, face=K('conc', 3), bites=3, deep=3, lip_all=True)


piece('slab-edge', '깨진 콘크리트 판 가장자리 (오토타일)', 4, 4, TERRAIN,
      en='edges of a broken concrete pavement area laid on dirt: the cracked concrete pads break into the dirt in small irregular chunks with a subtle darker lip under the break, with outer and inner corners, the full interior filled with the cracked concrete slab field',
      group='ground', tags=['콘크리트', '광장', '오토타일'],
      desc='깨진 콘크리트 판 영역의 가장자리 오토타일(4방향, N1 E2 S4 W8, 칸 (m%4, m//4)). 몸은 slab-a 와 같은 값·결이고, 이웃 없는 쪽은 2~4화소 덩이째 깨져 흙으로 끝난다(깨진 자리 아래만 1화소 턱). 꽉 찬 칸(마스크 15)은 slab-a/b/c 이음 판을 (x mod 8, y mod 8) 자리로 깐다.',
      sample=auto_sample('slab-edge', inner=False, field='slab-a'))(autosheet(at_slab_edge))
AUTO['slab-edge'] = dict(name='깨진 콘크리트 판 가장자리', kind=TERRAIN)


# ------------------------------------------------------------------ 콘크리트 판 깨진 가장자리 덧그림(위층 오토타일) — slab-a/b/c 판을 판 영역 전체에 깔고 그 위 가장자리 칸에만 얹는다
def jag_slab(i, side, m):
    """판 깨진 가장자리 기본 깊이 1..3(주기 5 잡음, 마스크·변·변형마다 다름 — m 에 변형 번호가 섞여 들어온다). 끝 0·15 는 2 고정(이웃 칸과 잇는다)."""
    if i <= 0 or i >= 15: return 2
    v = vnoise(i + m * 7 + side * 13, side * 5 + m, 131 + side, 8, 64)
    return 1 + int(v * 2.99)


def at_slab_break(c, m, ox, oy, var=0):
    """투명 덧그림 칸(마스크 m, 변형 var 0·1 — 같은 마스크가 줄지어도 깨진 모양이 16화소마다 되풀이되지 않게 두 벌):
    판 몸은 그리지 않는다(밑의 slab-a/b/c 가 그대로 보여 이음·금·얼룩이 깨진 끝까지 이어진다).
    이웃 없는 쪽 윤곽은 조절점(3~6화소 간격, 얕은 1~2 · 깊은 4~6 번갈아, 자리는 변·마스크·변형마다 다름)을 코사인으로 이은 둥근 굴곡 — 톱니·곧은 칸 변이 없다.
    마주 보는 두 변이 다 트인 띠 칸은 덩이를 얕게(변마다 3 이하, 마주 보는 변과 엇갈림) — 가운데 판이 10화소 이상 남는다. 외딴 칸(0)은 네 변이 고르지 않게.
    남쪽으로 깨진 자리 위엔 3화소 이상 이어진 1화소 어두운 턱(판 두께, conc 1)과 그 위 앞면(conc 3), 북쪽 깨진 판 끝은 군데군데 빛(conc 6),
    흙 쪽엔 가끔 떨어진 콘크리트 조각. 마스크 15(안쪽)는 덧그림 없음 자리 — 칸이 비지 않게 가는 금 한 줄만."""
    if m == 15:
        for (x, y) in wander(97 + var * 5, 3 + var * 2, 9 - var * 4, 4, 1, 0):
            if 0 <= x < 16 and 0 <= y < 16 and h2(x, y, 977 + var) % 4: c.P(ox + x, oy + y, K('conc', 2))
        return
    strip = m != 0 and ((not m & N and not m & Sb) or (not m & E and not m & W))
    sd = 60 + m + 131 * var
    prof = {}
    for side, bit in ((0, N), (1, E), (2, Sb), (3, W)):
        if m & bit: continue
        # 윤곽 = 조절점(3~6화소 간격) 사이를 코사인으로 이은 둥근 굴곡 — 얕은 자리(1~2)와 깊은 자리(4~6, 띠 칸은 3~4)가 번갈아, 끝 0·15 는 2(이웃 칸과 잇는다)
        ew = side in (1, 3)                                       # 동·서 변: 바깥 2화소는 늘 흙(판 끝 이음이 세로 줄로 남지 않게), 깊은 자리 5~7
        hi = (3, 4) if m == 0 else (3, 5) if strip else ((5, 7) if ew else (4, 6))
        lo = 1 if m == 0 else 2                                  # 얕은 자리도 2 — 판 끝 바깥 2화소는 늘 흙(북·남 변도 곧은 칸 변이 안 남게)
        pts = [(0, 3)]; i = 0; k = 0; deep = h2(sd, side, 1201) % 2 == 0      # 끝 0·15 = 가운데 깊이 3(이웃 칸과 같은 깊이로 이어져 칸 이음에 불룩한 마디가 없다)
        while True:
            i += (3 if var == 0 else 4) + h2(k, side, sd + 1203) % 3            # 변형마다 굴곡 간격이 다르다(긴 변에서 박자가 안 맞게)
            if i >= 13: break
            lo_v = lo + h2(k, side, sd + 1205) % 2
            hi_v = hi[0] + h2(k, side, sd + 1207) % (hi[1] - hi[0] + 1)
            pts.append((i, hi_v if deep else lo_v)); deep = not deep; k += 1
        pts.append((15, 3))
        d = []
        for x in range(16):
            for (x0, v0), (x1, v1) in zip(pts, pts[1:]):
                if x0 <= x <= x1:
                    t = (x - x0) / max(1, x1 - x0); d.append(v0 + (v1 - v0) * (1 - math.cos(math.pi * t)) / 2); break
        prof[side] = d
    tip = {1: 2, 2: 3, 4: 0, 8: 1}.get(m)                         # 끝 칸(이웃 하나): 이웃 맞은편 변은 둥근 끝(가운데 얕고 양 모서리 깊게) — 갈라진 꼬리 모양이 되지 않게
    if tip is not None:
        nc = 4 + h2(m, var, sd + 1211) % 6                          # 둥근 끝에도 한 군데 3화소 넘게 파인 자리
        prof[tip] = [1.5 + 4.5 * ((i - 7.5) / 7.5) ** 2 + (h2(i // 3, tip, sd + 1209) % 2) * 0.6 + (2.2 * math.cos(math.pi * (i - nc - 1) / 4) if abs(i - nc - 1) < 2 else 0) for i in range(16)]
    if strip:                                                    # 띠 칸: 마주 보는 변은 엇갈린 굴곡(한쪽이 깊으면 다른 쪽은 얕게) — 합쳐 6 이하, 판이 10화소 이상 남는다
        for (a_, b_) in ((0, 2), (3, 1)):
            if a_ in prof and b_ in prof:
                tot = 7.0                                          # 두 변은 따로 굽이친다(폭이 달라진다) — 합이 7 을 넘는 자리만 뒤 변을 줄여 판이 9화소 이상 남는다
                prof[b_] = [3.0 if i in (0, 15) else max(1.0, min(prof[b_][i], tot - prof[a_][i])) for i in range(16)]
    jf = lambda i, side, mm: int(round(prof[side][i])) if side in prof else 2
    soil = crumble(c, m, ox, oy, soil_depth(m, jf), sd, (K('conc', 6), K('conc', 3)), K('conc', 1), chunks=1 if h2(m, 4 + var, 975) % 3 == 0 else 0,
                   face=K('conc', 3), lip_cont=True, jagf=jf, gap=2, lip_run=3, bites=0)
    for y in range(1, 16):                                       # 흙이 위(북)에 있는 판 끝: 깨진 윗모서리가 빛을 받는다(군데군데)
        for x in range(16):
            if not soil(x, y) and soil(x, y - 1) and h2(x, y, 979 + sd) % 3 and not c.has(ox + x, oy + y): c.P(ox + x, oy + y, K('conc', 6))
    for y in range(16):                                          # 옆(동·서)으로 깨진 판 끝: 1화소 그늘(오른쪽 깨짐) · 빛(왼쪽 깨짐) — 군데군데
        for x in range(16):
            if soil(x, y) or c.has(ox + x, oy + y): continue
            if soil(x + 1, y) and h2(x, y, 981 + sd) % 4 == 0: c.P(ox + x, oy + y, K('conc', 3))
            elif soil(x - 1, y) and h2(x, y, 983 + sd) % 3: c.P(ox + x, oy + y, K('conc', 6))


def break_sample(pid, field='slab-a', fper=8):
    """덧그림 오토타일 표본(실제 쓰임 그대로): 판 자리(#)엔 아래층 slab-a 이음 판을 (x mod 8, y mod 8) 자리로, 그 밖은 흙.
    위층 덧그림은 꽉 찬 칸(15)이 아닌 가장자리 칸에만 얹는다(불투명 화소만 덮는다)."""
    def f(_=0):
        lay = AUTO_SAMPLE_LAYOUT; H, Wd = len(lay), len(lay[0])
        a = np.zeros((H * 16, Wd * 16, 4), np.uint8)
        ms = auto_masks(lay)
        da_full = render(PIECES['dirt-b']); fa = render(PIECES[field]); ov = render(PIECES[pid])
        for y in range(H):
            for x in range(Wd):
                blk = a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16]
                if (x, y) in ms:
                    fx, fy = x % fper, y % fper
                    blk[:] = fa[fy * 16:(fy + 1) * 16, fx * 16:(fx + 1) * 16]
                    m = ms[(x, y)]
                    if m != 15:
                        vy = 4 * (hsh(x, y, 13) % 2) if ov.shape[0] > 64 else 0          # 변형 두 벌을 칸 자리 해시로 섞는다(실제 깔기와 같게)
                        o = ov[(vy + m // 4) * 16:(vy + m // 4 + 1) * 16, (m % 4) * 16:(m % 4 + 1) * 16]; op = o[..., 3] == 255; blk[op] = o[op]
                else: blk[:] = da_full[(y % 4) * 16:(y % 4 + 1) * 16, (x % 4) * 16:(x % 4 + 1) * 16]
        return a
    return f


piece('slab-break', '콘크리트 판 깨진 가장자리 덧그림 (오토타일)', 4, 8, FLAT,
      en='transparent overlay autotile for the edges of a cracked concrete slab pavement on dirt: only the broken edge is drawn — rounded dirt bites eaten into the concrete from the open sides, a dark 1px broken lip under south breaks, lit broken rims, and loose concrete chunks lying on the dirt; the slab field underneath shows through so its seams and cracks run right up to the break',
      group='ground', tags=['콘크리트', '광장', '오토타일', '덧그림'],
      desc='깨진 콘크리트 판 가장자리 덧그림(위층·투명, 4방향 N1 E2 S4 W8, 칸 (m%4, m//4) = 변형 1, 칸 (m%4, 4 + m//4) = 같은 마스크의 변형 2 — 칸 자리 해시로 둘을 섞어 깨진 모양이 16화소마다 되풀이되지 않게). 판 영역 전체에 slab-a/b/c 를 아래층으로 깔고, 가장자리 칸(마스크 15 가 아닌 칸)의 위층에만 이 칸을 얹는다. 이웃 없는 쪽이 둥근 덩이째 깨져 흙이 드러나고 남쪽 깨진 자리엔 어두운 턱, 흙엔 떨어진 조각. 마스크 15 칸은 가는 금 하나뿐(안쪽엔 덧그림을 두지 않는다).',
      sample=break_sample('slab-break'))(autosheet(at_slab_break, lambda c, v, ox, oy: at_slab_break(c, v, ox, oy, var=1), 16))
AUTO['slab-break'] = dict(name='콘크리트 판 깨진 가장자리 덧그림', kind=FLAT)


# ------------------------------------------------------------------ 투명 덧그림(flat)
def layer(c, fn, outline=True, top=False, col=None):
    """따로 그린 겹(덩이·풀)을 c 위에 덮는다 — 윤곽은 그 겹 둘레에만(밑 흙 자리 둘레엔 두지 않는다)."""
    l = Cv(c.w, c.h); fn(l)
    if outline: l.outline(col=col, top=top)
    m = l.a[..., 3] == 255; c.a[m] = l.a[m]


def soil_patch(c, cx, cy, rx, ry, seed=0, mat='dirt', lo=1, crumbs=True):
    """불규칙한 흙 자리(덧그림 밑바탕): 가장자리는 둘레 흙(4단)에 녹아들고 속은 젖어 어둡다(lo..lo+2) + 알갱이. 윤곽 없음."""
    n = len(MAT[mat])
    for y in range(16):
        for x in range(16):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (field(x, y, seed + 70) - 0.5) * 0.6
            if d > 1.0: continue
            t = lo if d < 0.35 else lo + 1 if d < 0.7 else lo + 2
            k = h2(x, y, seed + 3) % 11
            if k == 0: t += 2
            elif k == 1: t = max(0, t - 1)
            elif k == 2 and d > 0.6: t += 1
            c.P(x, y, K(mat, min(n - 1, t)))
    if crumbs:
        for i in range(5):
            x = (cx + (h2(i, 1, seed) % (2 * rx + 3)) - rx - 1); y = (cy + (h2(i, 2, seed) % (2 * ry + 3)) - ry - 1)
            if not c.has(x, y) and 0 <= x < 16 and 0 <= y < 16: c.P(x, y, K(mat, lo + 2)); c.P(x, y + 1, K(mat, lo)) if y + 1 < 16 and not c.has(x, y + 1) else None


def _rubble(v):
    def draw(c):
        if v == 0:                                            # 콘크리트 덩이 무리(뒤 → 앞): 칸의 2/3 를 덮는다
            for (x, y, w, h, t) in ((2, 2, 6, 5, 2), (8, 1, 5, 4, 2), (11, 4, 4, 5, 2), (0, 6, 5, 4, 2), (4, 6, 7, 6, 3), (11, 9, 4, 4, 2), (1, 11, 5, 4, 2), (7, 11, 5, 4, 2)):
                chunk5(c, x, y, w, h, 'conc', t, seed=x + y)
            rebar(c, 6, 7, 5, 3); rebar(c, 12, 5, 4, -1)
            for (x, y) in ((13, 14), (5, 10), (10, 3)): c.P(x, y, K('glass', 5))
            c.outline()
        elif v == 1:                                          # 붉은 벽돌 가루 자리 위에 흩어진 벽돌(낱장마다 윗면 2~3행 + 앞면 2행) · 반쪽 벽돌 · 모르타르 덩이
            soil_patch(c, 8, 8, 7, 6, seed=11, mat='brust', lo=4)
            def bricks(l):
                for (x, y, w, h, t, mat) in ((1, 2, 5, 4, 2, 'brick'), (9, 1, 5, 4, 2, 'brick'), (6, 5, 4, 4, 2, 'conc'), (11, 6, 4, 5, 3, 'brick'),
                                             (1, 8, 4, 4, 2, 'brick'), (6, 10, 5, 4, 2, 'brick'), (12, 12, 3, 3, 1, 'conc')):
                    chunk5(l, x, y, w, h, mat, t, seed=x * 3 + y)
                    if mat == 'brick': l.P(x + 1, y + t, K('brick', 1)); l.P(x + w - 2, y + t + 1, K('brick', 2))   # 줄눈 흠
                l.P(3, 3, K('conc', 6)); l.P(11, 2, K('conc', 5)); l.P(13, 8, K('conc', 6))                           # 붙은 모르타르
            layer(c, bricks, col=K('brick', 1))
            for (x, y) in ((5, 14), (10, 15), (0, 12), (15, 4)): c.P(x, y, K('brick', 3))
            for (x, y) in ((8, 4), (4, 13)): c.P(x, y, K('conc', 6)); c.P(x, y + 1, K('brust', 1))
        else:                                                 # 기름 밴 흙 자리 + 휜 녹슨 철판(윗면 4행·앞 끝면 2행) + 유리 조각 + 끊긴 전선 + 콘크리트 덩이
            soil_patch(c, 8, 9, 7, 6, seed=23, mat='dirt', lo=2)
            def scrap(l):
                for i in range(9):                            # 철판: 동쪽이 한 행 내려앉은 휜 판
                    yy = 3 + (1 if i > 5 else 0)
                    for j, t in enumerate((6, 5, 5, 4)): l.P(2 + i, yy + j, K('metal', t - (1 if (i + j) % 4 == 0 else 0)))
                    l.P(2 + i, yy + 4, K('metal', 2)); l.P(2 + i, yy + 5, K('metal', 1))
                l.P(2, 3, K('metal', 7)); l.P(3, 3, K('metal', 7)); l.P(9, 4, K('metal', 7))
                rust_patch(l, 2, 6, 9, 4, seed=5, dens=0.6, on=set(MAT['metal']))
                for (x, y) in ((4, 4), (7, 5)): l.P(x, y, K('rust', 4))
                chunk5(l, 11, 7, 5, 4, 'conc', 2, seed=4); chunk5(l, 6, 11, 4, 4, 'conc', 2, seed=5); chunk5(l, 0, 10, 4, 4, 'brick', 2, seed=8)
                chunk5(l, 12, 1, 3, 3, 'conc', 1, seed=7)
            layer(c, scrap, col=K('metal', 1))
            for (x, y) in ((12, 12), (2, 15), (14, 14), (10, 1)):
                c.P(x, y, K('conc', 6)); c.P(x + 1, y, K('conc', 4)); c.P(x, y + 1, K('conc', 2)) if y < 15 else None   # 콘크리트 부스러기(빛나는 청록 유리 점 없음)
            c.line(1, 1, 4, 2, K('rubber', 2)); c.line(4, 2, 6, 1, K('rubber', 3)); c.P(6, 0, K('rust', 5))
            c.P(11, 14, K('oil', 1)); c.P(12, 14, K('oil', 3)); c.P(10, 13, K('oil', 2))
        m = c.a[..., 3] == 255
        c.shadow([(x + 1, y + 1) for y in range(16) for x in range(16) if m[y, x]])
    return draw


for _v, _l in enumerate('abc'):
    piece('rubble-' + _l, '잔해 ' + ['콘크리트 덩이', '깨진 벽돌', '유리·쇳조각'][_v], 1, 1, FLAT,
          en=['small broken concrete chunks with a rebar stub lying on the ground',
              'scattered broken bricks and mortar lumps lying on a patch of red brick dust on the ground',
              'a bent rusty metal sheet, broken concrete lumps, glass shards and a torn cable lying on an oil-stained patch of earth'][_v],
          group='ground', tags=['잔해', '덧그림'], desc='바닥 위 투명 잔해 덧그림 — 걷는다, 캐릭터 밑에 그린다.',
          sample=None if _v == 0 else decal_sample('rubble-' + _l))(_rubble(_v))


def clump(c, x, y, w, h, mat, seed=0, dens=0.9, rows=3, step=1):
    """풀 덩이: 잎 줄기(1화소, 높이 2~h, 기울기 -1..1)를 줄마다 엇갈린 열에 세운다 — 밑동 어둡고 끝 밝게(재질 전 단). 뒤 줄부터 그려 앞 줄이 덮는다."""
    n = len(MAT[mat]); blades = []
    for row in range(rows):
        for i in range(row % 2 if step > 1 else 0, w, step):
            if h2(i, row, seed) % 100 > dens * 100: continue
            hh = max(2, h - row * 2 - h2(i, row, seed + 1) % 4)
            lean = (h2(i, row, seed + 2) % 3) - 1
            blades.append((y + h - 1 - row * 2, x + i, hh, lean))
    for k, (by, bx, hh, lean) in enumerate(sorted(blades)):
        off = -2 if h2(bx, by, seed + 9) % 3 == 0 else 0           # 그늘 속 잎(두 단 어둡게) — 덩이가 한 덩어리 채움으로 읽히지 않게
        for j in range(hh):
            xx = bx + (lean * j) // 3; yy = by - j
            f = j / max(1, hh - 1)
            t = 0 if f < 0.12 else 1 if f < 0.3 else 2 if f < 0.5 else 3 if f < 0.68 else 4 if f < 0.84 else n - 2 if f < 0.97 else n - 1
            c.P(xx, yy, K(mat, max(0, min(t + (off if j > 0 else 0), n - 1))))


def rosette(c, cx, cy, seed=0):
    """위에서 본 넓은 잎 잡초(민들레 꼴): 잎 5장이 방사, 잎마다 위·왼 빛 → 끝 어둡게, 가운데 그늘."""
    for k, (dx, dy) in enumerate(((-3, -1), (3, -1), (-2, 2), (2, 2), (0, -3))):
        for s_ in range(1, 4):
            x = cx + (dx * s_) // 3; y = cy + (dy * s_) // 3
            c.P(x, y, K('plant', 8 - s_ * 2 + (1 if k == 4 else 0))); c.P(x + (1 if dx >= 0 else -1), y, K('plant', 5 - s_))
    c.P(cx, cy, K('plant', 1)); c.P(cx, cy - 1, K('plant', 7))


def fan(c, bx, by, h, mat, seed=0, n=7, spread=3, droop=False):
    """부채꼴 풀 포기: 뿌리 (bx,by) 에서 잎 n 장이 퍼진다(바깥 잎일수록 눕고 짧다). 잎마다 밑동 어둡게 → 끝 밝게, 가운데 잎이 앞(나중)에 그려진다."""
    r = len(MAT[mat]); blades = []
    for k in range(n):
        u = (k / max(1, n - 1)) * 2 - 1                        # -1..1
        hh = max(2, round(h * (1 - 0.2 * abs(u))) - h2(k, bx, seed) % 3)
        blades.append((abs(u), u, hh, k))
    for (_, u, hh, k) in sorted(blades, reverse=True):        # 바깥 잎 먼저(V 꼴: 바깥 잎이 길게 밖으로 눕는다)
        dark = h2(k, by, seed + 1) % 3 == 0
        x0 = bx + round(u * 1.2)                               # 밑동 폭 3
        for j in range(hh):
            f = j / max(1, hh - 1)
            x = x0 + round(u * spread * f); y = by - j
            if droop and f > 0.85: x += 1 if u >= 0 else -1; y += 1
            t = 0 if f < 0.15 else 1 if f < 0.35 else 2 if f < 0.55 else 3 if f < 0.72 else r - 3 if f < 0.86 else r - 2 if f < 0.96 else r - 1
            c.P(x, y, K(mat, max(0, t - (2 if dark and j > 0 else 0))))
    c.P(bx - 1, by + 1, K('dirt', 1)); c.P(bx, by + 1, K('dirt', 1)); c.P(bx + 1, by + 1, K('dirt', 2))


def _weeds(v):
    def draw(c):
        if v == 0:                                            # 흩어진 초록 잡초 포기(부채꼴) 넷 + 넓은 잎 포기 둘 — 사이로 흙이 보인다
            rosette(c, 4, 4, 1); rosette(c, 12, 13, 2)
            for (x, y, h, n, sp, sd) in ((10, 8, 7, 9, 3, 3), (3, 14, 6, 8, 3, 5), (14, 4, 4, 5, 1, 6), (8, 15, 4, 6, 2, 7)):
                fan(c, x, y, h, 'grass', sd, n, sp)
            c.P(6, 1, K('paint', 1)); c.P(1, 8, K('paint', 2))
        elif v == 1:                                          # 마른 풀 포기(부채꼴, 이삭 끝이 처진다) 셋 + 초록 새싹 + 부스러진 흙
            for (x, y, h, n, sp, sd) in ((11, 8, 7, 10, 3, 11), (4, 13, 7, 10, 3, 12), (13, 15, 4, 6, 1, 13)):
                fan(c, x, y, h, 'dry', sd, n, sp, droop=True)
            for (x, y) in ((9, 1), (14, 2), (1, 6), (7, 6)): c.P(x, y, K('dry', 5)); c.P(x, y + 1, K('dry', 3))      # 이삭 알
            fan(c, 7, 15, 3, 'grass', 14, 4, 1); fan(c, 1, 3, 3, 'grass', 15, 3, 1)
            for (x, y) in ((10, 12), (15, 9), (3, 1)): c.P(x, y, K('dirt', 5)); c.P(x, y + 1, K('dirt', 2))
        else:                                                 # 대각 균열을 따라 난 흙 줄 + 잡초 띠 + 들꽃
            for i in range(16):                               # 균열 흙 줄(2~3폭)
                x = i; y = 14 - (i * 11) // 15
                for d in (-1, 0, 1):
                    t = 1 if d == 0 else 3
                    if 0 <= y + d < 16: c.P(x, y + d, K('dirt', t if h2(x, y + d, 5) % 5 else t + 1))
                if i % 3 == 0 and y + 2 < 16: c.P(x, y + 2, K('dirt', 4))
            for (x, y, w, h, s_) in ((0, 7, 6, 8, 7), (4, 4, 6, 8, 8), (9, 1, 6, 7, 9)):
                clump(c, x, y, w, h, 'grass', s_, 0.7, 3, 1)
            rosette(c, 12, 11, 6); rosette(c, 3, 3, 7)
            for (x, y, col) in ((2, 8, 'azalea'), (7, 5, 'ginkgo'), (12, 2, 'ginkgo'), (10, 7, 'wpaint'), (5, 10, 'ginkgo')):
                c.P(x, y, K(col, 3)); c.P(x + 1, y, K(col, 1)); c.P(x, y - 1, K(col, 2))
    return draw


for _v, _l in enumerate('abc'):
    piece('weeds-' + _l, '잡초 ' + 'ABC'[_v], 1, 1, FLAT,
          en=['scattered small tufts of green weeds and two broad-leaved rosettes growing from bare earth',
              'scattered tufts of dry yellow-brown grass with drooping seed heads and a few green shoots on bare earth',
              'a line of weeds, rosettes and tiny wild flowers growing along a diagonal crack of earth'][_v],
          group='ground', tags=['잡초', '덧그림'], desc='균열·흙 위 잡초 덧그림 — 걷는다.',
          sample=None if _v == 2 else decal_sample('weeds-' + _l))(_weeds(_v))


@piece('puddle', '빗물 웅덩이', 1, 1, FLAT, en='a shallow rain puddle lying on the ground, reflecting a pale sky band, with a soft damp earth halo and only a faint low bank shadow along its far edge',
       group='ground', tags=['웅덩이', '덧그림'],
       desc='얕은 빗물 웅덩이 덧그림 — 하늘빛 띠가 비치고 둘레 흙은 젖어 어둡게 번진다. 걷는다.', sample=decal_sample('puddle', ('aaaa', 'aXaa', 'aaaa'), ()))
def _puddle(c):
    B = blobs(16, 701, 2)
    jit = lambda x, y: (h2(*B[(x, y)][0], 703) % 4) * 0.09               # 덩이 단위 테두리 흔들림(낱화소 들쭉 없음)
    water, halo = set(), {}
    for y in range(16):
        for x in range(16):
            a = ((x - 7.5) / 7.0) ** 2 + ((y - 8.0) / 4.3) ** 2 + (0.18 if x > 11 and y < 7 else 0)
            dw = a + jit(x, y)
            if dw < 1.0: water.add((x, y))
            elif a + jit(x, y) * 1.5 < 2.1: halo[(x, y)] = a
    for (x, y), a in halo.items():                                   # 젖은 흙 번짐: 가까울수록 어둡게(2), 멀면 덩이째 3 — 바깥은 투명(바탕 흙이 보인다)
        k, edge, _ = B[(x, y)]
        t = (1 if h2(k[0], k[1], 711) % 3 == 0 and y < 8 else 2) if a < 1.35 else (2 if h2(k[0], k[1], 705) % 3 else 3)   # 젖은 흙: 고르게 2, 먼 쪽만 군데군데 1
        if a > 1.7 and h2(k[0], k[1], 707) % 2: continue
        c.P(x, y, K('dirt', t))
    for (x, y) in water:
        far = (x, y - 1) not in water; far2 = (x, y - 2) not in water
        rel = (y - 8.0) / 4.3                                            # -1 먼 쪽 .. +1 가까운 쪽
        if far and y < 8: t = ('oil', 3)                                 # 먼(위) 물가만 낮은 대비 둑 그늘 한 줄(옆·앞 물가엔 없다)
        elif far2 and y < 7 and h2(x, y, 715) % 2: t = ('oil', 3)
        else: t = ('oil', 4)                                             # 얕은 물 몸: 흐린 하늘빛(바닥보다 밝다 — 구멍이 아니다)
        c.P(x, y, K(*t))
    for (x, y) in ((3, 9), (4, 9), (5, 9), (7, 9), (8, 9), (9, 8), (10, 8), (11, 8), (13, 8)):   # 하늘 반사 띠: 1화소 굵기, 군데군데 끊긴 한 줄
        if (x, y) in water and (x, y - 1) in water and (x, y - 2) in water: c.P(x, y, K('oil', 5))
    for (x, y) in water:                                             # 먼(위) 둑: 물 바로 위 흙 한 줄 그늘(낮은 대비, 위쪽에만)
        if (x, y - 1) not in water and y - 1 >= 0 and y < 8: c.P(x, y - 1, K('dirt', 1))
    for x in range(16):                                              # 가까운(아래) 물가: 테두리 없이 젖은 흙으로 바로 이어진다 — 군데군데 진흙 턱 3
        for y in range(15, -1, -1):
            if (x, y) in water:
                if y + 1 < 16 and (x, y + 1) not in water and h2(x, y, 709) % 3 == 0: c.P(x, y + 1, K('dirt', 3))
                break
