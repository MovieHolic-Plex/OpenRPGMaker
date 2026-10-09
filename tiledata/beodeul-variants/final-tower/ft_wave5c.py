# 최종 탑 — 적대 검수(qa/final-tower.md) 반려 보정: 오토타일 다섯 장 새 판.
#  공통: 윤곽 = 공용 깊이장 autotile_edge.edge_fields(감사 bad 0.18 계열). 칸 끝(0·15)에서는 얕게 모여 이웃 칸과 같은 높이로 이어진다.
#    · 1칸 폭 띠(위·아래 둘 다 빔 / 좌·우 둘 다 빔)는 들임·혹을 줄인다 → 칸마다 잘록해지는 모래시계·척추뼈 줄을 막는다.
#    · 홀로 칸(변형 0)은 들임을 거의 없애 둥근 판 하나가 된다(점 하나가 남지 않게).
#  속 결은 칸 안에서만 그리고(칸 경계를 넘지 않는다) **변형마다 씨앗이 다르다** — 이음매 걱정 없이 변형 간 배치가 달라진다.
#  색은 전부 7단 램프 화소(반투명 안개 없음).
#   voidbreak  허공 ↔ 핵 방 바닥 깨진 가장자리(걷기): 남쪽 판 두께 7px 3/4 앞면(밝은 모·돌 쌓은 줄눈·밑 윤곽) + 매달린 돌 뿌리.
#   rubble     잔해 가장자리(걷기): 칸마다 3~5개 낱개 조각(판·마름돌·관·뼈 토막) + 접촉 그림자 + 깔린 부스러기 바닥.
#   dark-pool  어둠 웅덩이(막힘): 북쪽 둑 앞면, 얕은 가장자리 → 깊은 속 3단, 반사는 변형마다 다른 자리 하나~둘.
#   bone-dust  뼛가루(걷기): 속 대비를 낮추고 어두운 점 자국을 없앴다, 잔 뼈 조각은 변형마다 다른 자리.
#   mana-seep  마력 번짐(걷기): 반투명 칠 → 7단 보라 램프 불투명 화소(어두운 테 → 고인 빛 → 밝은 물결·빛 알갱이).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'beodeul-kits'))
import numpy as np
from PIL import Image
from ft_base import *
from ft_base import _hash
import ft_debris as DB
from autotile_edge import edge_fields, tnoise1

X16, Y16 = np.meshgrid(np.arange(16), np.arange(16))
FTa = np.array(FT, int); VIOLa = np.array(VIOL, int); BONEa = np.array(BONE, int)
INK = [(6, 4, 14), (11, 8, 24), (17, 12, 34), (25, 18, 48), (36, 26, 66), (54, 38, 96), (92, 66, 150)]
INKa = np.array(INK, int)


def ef(n, inset, jag, rad, seed):
    """공용 깊이장 + 띠·홀로 칸 보정."""
    ns_strip = not (n & 1) and not (n & 4)
    ew_strip = not (n & 2) and not (n & 8)
    if n == 0: inset, jag, rad = .7, 1.4, 6.5
    elif ns_strip or ew_strip: inset, jag = min(inset, 1.3), min(jag, 1.4)
    return edge_fields(n, inset, jag, rad, seed)


def hh(seed, n):
    return FB.hash2(X16, Y16, seed * 37 + n * 101)


def vn(sc, seed):
    from fr_ground import vn_arr
    return vn_arr(X16.astype(float), Y16.astype(float), sc, seed, per=16)


def _img(rgb, a):
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), np.clip(a, 0, 255).astype(np.uint8)]), 'RGBA')


def sheet_of(cellfn):
    sh = new(64, 64)
    for n in range(16): sh.alpha_composite(cellfn(n), (n % 4 * T, n // 4 * T))
    return sh


def _shift(a, dy, dx, fill):
    o = np.full_like(a, fill); H, W = a.shape
    o[max(0, dy):H + min(0, dy), max(0, dx):W + min(0, dx)] = a[max(0, -dy):H + min(0, -dy), max(0, -dx):W + min(0, -dx)]
    return o


# ================================================================ 허공 깨짐
LIP = 7
_CORE = None
def _core16():
    """핵 방 판 16x16(전역 12..27 구간 = 판 이음이 칸 안에 지나가고, 보라 교차점 빛은 들어오지 않는다)."""
    global _CORE
    if _CORE is None:
        _CORE = np.array([[ft_core(X, Y) for X in range(12, 28)] for Y in range(12, 28)], int)
    return _CORE


def voidbreak_cell(n, seed=5):
    # 위·옆 깨짐 = 공용 깊이장. 남쪽(아래 이웃 없음)은 판 두께 띠가 칸 밑까지 내려온다(밑 0.5px) → 그 아래 허공 칸에
    # void_underside 의 매달린 밑면 줄을 붙이면 끊김 없이 이어진다. 남쪽 모서리는 옆 깨짐과 같은 반지름으로 둥글다.
    m0, dN, dE, dS0, dW = ef(n | 4, 2.6, 3.2, 7.0, seed)
    if n & 4:
        m, dS = m0, dS0
    else:
        dS = (15 - Y16) - (.35 + 1.1 * tnoise1(16, 4, seed + 77))[X16]   # 밑 0.4~1.4px 들쭉날쭉(칸 밑을 꽉 채우지 않는다 — 규약)
        m = np.minimum(m0, dS)
        for side, on in ((dW, not (n & 8)), (dE, not (n & 2))):
            if on:
                rad = 6.0 if n else 5.0
                sel = (side < rad) & (dS < rad)
                m = np.where(sel, np.minimum(m, rad - np.hypot(rad - side, rad - dS)), m)
    M = m >= 0
    rgb = _core16().copy(); a = np.where(M, 255, 0)
    # 남쪽 판 두께(3/4 앞면): 맨 위 밝은 모 → 앞면 돌(쌓은 줄눈, 6px 마다 세로 이음, 두 단 어긋남) → 밑 윤곽
    lip = M & (dS < LIP)
    d = np.floor(np.maximum(dS, 0)).astype(int)
    face_k = np.where(d == LIP - 1, 5, np.where(d == LIP - 2, 4, np.where(d == 0, 0, np.where(d == 1, 1, 2))))
    vj = ((X16 + (d >= 3) * 3) % 6 == 0) & (d >= 1) & (d <= LIP - 3)
    hj = (d == 3)
    face_k = np.where(vj | hj, np.minimum(face_k, 1), face_k)
    face_k = np.where((face_k == 2) & (hh(seed, n) > .8), 3, face_k)
    rgb[lip] = FTa[face_k[lip]]
    # 깨진 위·옆 가장자리 안쪽 1px: 북쪽을 보는 깨짐은 밝은 모, 나머지는 어두운 모
    inner = _shift(M, 1, 0, True) & _shift(M, -1, 0, True) & _shift(M, 0, 1, True) & _shift(M, 0, -1, True)
    edge = M & ~inner & ~lip
    up_open = ~_shift(M, 1, 0, True)
    rgb[edge & up_open] = FTa[5]
    rgb[edge & ~up_open] = FTa[1]
    return _img(rgb, a)


def underside_strip(seed=5):
    """매달린 밑면 줄 48x16: 칸 [왼 끝 | 가운데 | 오른 끝]. 맨 위는 voidbreak 남쪽 두께 띠 밑(칸 밑 0.5px)에 바로 붙는다.
    강철 갑판 띠(리벳) → 깨진 돌 뿌리(길이 들쭉날쭉, 아래로 허공 빛에 식는다) → 드문 철근·전선. 끝 칸은 위 칸의 둥근 모서리만큼 비운다."""
    out = np.zeros((16, 48, 4), np.uint8)
    VR = np.array(VOIDR, float)
    tops = []                                                     # 위 칸(voidbreak 남쪽 칸)의 밑줄 화소가 있는 열만 매단다
    for n in (2, 10, 8):                                          # 왼 끝(오른쪽 이웃만) · 가운데 · 오른 끝
        al = np.array(voidbreak_cell(n | 1, seed))[15, :, 3] > 0
        tops.append(al)
    for X in range(48):
        if not tops[X // 16][X % 16]: continue
        Lr = int(3 + 9 * FB.tnoise1(48, 6, seed + 3)[X] ** 1.3 + 2 * (_hash(X // 3, 0, seed) > .7))
        for k in range(16):
            c = None
            if k <= 3:
                c = STEEL[(4, 3, 2, 1)[k]]
                if k == 1 and X % 9 == 3: c = STEEL[6]
            elif k <= 3 + Lr:
                t = (k - 3) / max(1, Lr)
                tone = 3 - int(t * 2.4) + (1 if (X + k) % 7 == 0 else 0)
                c = tuple(int(v) for v in np.array(FT[max(1, tone)]) * (1 - .4 * t) + VR[3] * .4 * t)
                if k == 3 + Lr: c = FT[0]
            else:
                h_ = _hash(X, 7, seed + 9)
                if h_ < .1 and k < 3 + Lr + 3 + int(_hash(X, 8, seed) * 8): c = RUST[3] if h_ < .06 else CABLE[3]
            if c is None: break
            out[k, X, :3] = c; out[k, X, 3] = 255
    return Image.fromarray(out, 'RGBA')


def underside_part(seed=5):
    """void_underside 3x2: 위 줄 = voidbreak 남쪽 칸 [왼 끝 · 가운데 · 오른 끝], 아래 줄 = 그 밑 허공 칸에 붙이는 매달린 밑면."""
    im = new(48, 32)
    for i, n in enumerate((3, 11, 9)): im.alpha_composite(voidbreak_cell(n, seed), (i * T, 0))
    im.alpha_composite(underside_strip(seed), (0, 16))
    return im


# ================================================================ 잔해 가장자리
RUBK = [('plate', .45), ('stone', .42), ('pipe', .06), ('bone', .07)]


def rubble_cell(n, seed=7):
    m = ef(n, 2.8, 3.8, 7.0, seed)[0]
    r = np.random.default_rng(seed * 1000 + n * 17 + 3)
    tc = TC(16, 16, seed + n)
    # 깔린 부스러기 바닥: 덩이 안은 어두운 돌가루 바닥(큰 결 두 단, 낱화소 잡음 없음) + 2x2 잔돌, 윤곽 밖은 잔돌만 성기게
    bed = vn(4, seed + n * 7)
    for (y, x) in zip(*np.nonzero(m >= 0)): tc.px(x, y, 'ftst', 1 if m[y, x] < 1.2 or _hash(x // 3 + n, y // 3, seed + 8) < .5 else 2)
    for gy in range(0, 16, 2):
        for gx in range(0, 16, 2):
            ox = gx + (gy // 2) % 2; mm = m[gy, min(15, ox)]
            p = _hash(ox + n * 31, gy, seed + 5)
            if not ((mm >= 0 and p < .36) or (-2.2 < mm < 0 and p < .2)): continue
            mat = 'ftst' if _hash(ox, gy + n, seed + 6) < .7 else 'steel'
            for (dx, dy, k) in ((0, 0, 3), (1, 0, 3), (0, 1, 2), (1, 1, 1)):
                if ox + dx < 16 and gy + dy < 16: tc.px(ox + dx, gy + dy, mat, k)
    # 낱개 조각: 칸 안(경계 1px 안)에서만, 변형마다 다른 자리·종류 — 칸 4분면에 하나씩 흔들어 놓고 셋~넷만 남긴다
    pts = [(3, 4), (10, 3), (4, 11), (11, 10)]
    r.shuffle(pts)
    nb_cnt = bin(n).count('1')
    strip = n in (5, 10)
    keep = 0 if (nb_cnt >= 3 or strip) else (2, 2, 2)[nb_cnt] + (1 if r.random() < .35 else 0)
    # 줄지어 같은 변형이 놓이는 칸(속 15·변 3이웃·1칸 폭 띠 5·10)에는 큰 조각을 두지 않는다 → 덩이 변·팔에 같은 조각이 빗살처럼 줄서지 않는다.
    # 큰 조각은 모서리(2이웃)·끝(1이웃)·홀로 칸에만, 변형마다 다른 자리.
    for (cx, cy) in pts[:keep]:
        cx += int(r.integers(-2, 3)); cy += int(r.integers(-2, 3))
        c = DB.random_chunk(r, 4.2 + 2.4 * r.random(), RUBK)
        x0 = int(np.clip(cx - c.w // 2, 1, 15 - c.w)); y0 = int(np.clip(cy - c.h // 2, 1, 15 - c.h))
        if c.w > 14 or c.h > 14: continue
        if m[min(15, y0 + c.h // 2), min(15, x0 + c.w // 2)] < 1.5: continue
        DB.paste_ol(tc, c, x0, y0, 0)
    im = tc_fin(tc, .8)
    arr = np.array(im); arr[(m < -2.0)] = 0
    return Image.fromarray(arr, 'RGBA')


# ================================================================ 어둠 웅덩이
def pool_cell(n, seed=531):
    m, dN, dE, dS, dW = ef(n, 2.8, 3.8, 7.5, seed)
    rgb = np.zeros((16, 16, 3), int); a = np.zeros((16, 16), int)
    g = hh(seed, n)
    wet = (m < 0) & (m > -1.8) & (g < (1.8 + m) / 1.8 * .5)                     # 둘레 젖은 바닥
    rgb[wet] = FTa[1]; a[wet] = 255
    ins = m >= 0
    k = np.where(m < 2.0, 5, np.where(m < 4.5, 4, 3))                            # 얕은 가장자리 → 깊은 속(검은 구멍이 아니라 검보라 액)
    rgb[ins] = INKa[k[ins]]; a[ins] = 255
    nb = ins & (dN < 4.5)                                                         # 북쪽 둑: 꺼진 바닥 앞면
    rgb[nb] = INKa[1]
    rgb[nb & (dN < 3.5)] = FTa[2]
    rgb[nb & (dN < 2.4)] = FTa[3]
    rgb[nb & (dN < 1.2)] = FTa[5]
    side = ins & ~nb
    rgb[side & (m < 1.0)] = FTa[1]                                                # 젖은 턱
    rgb[side & (m >= 1.0) & (m < 2.0)] = INKa[5]
    rgb[side & (m >= 1.0) & (m < 2.0) & (dS < 3)] = INKa[6]                       # 남쪽 물가 반사(빛 받은 턱 아래)
    # 수면 반사: 변형마다 다른 자리 하나~둘, 3~5px 가로(가운데 밝음)
    r = np.random.default_rng(seed * 100 + n)
    for _ in range(0 if n == 15 else 1 + int(r.random() < .4)):              # 속 칸(15)에는 반사를 두지 않는다(덩이 속 격자 방지)
        sx, sy, L = int(r.integers(2, 10)), int(r.integers(4, 13)), int(r.integers(3, 6))
        for i in range(L):
            x = sx + i
            if x < 16 and side[sy, x] and m[sy, x] >= 2.2:
                rgb[sy, x] = INKa[6] if 0 < i < L - 1 else INKa[5]
    return _img(rgb, a)


# ================================================================ 뼛가루
def dust_cell(n, seed=561):
    m, dN, dE, dS, dW = ef(n, 2.2, 2.8, 7.5, seed)
    rgb = np.zeros((16, 16, 3), int); a = np.zeros((16, 16), int)
    g = hh(seed, n)
    cov = (m >= 0) & (g < np.clip((m + .4) / 2.4, 0, 1) * .97 + .02)
    h2 = hh(seed + 9, n)
    tone = np.where(h2 > .8, 4, 3)                                                  # 속은 고른 결(큰 무늬가 칸마다 되풀이되지 않게)
    tone = np.where(m < 1.3, 2, tone)
    rgb[cov] = BONEa[tone[cov]]; a[cov] = 255
    sh = (m >= 0) & (dS < 1.0)
    rgb[sh] = BONEa[1]; a[sh] = 255                                                # 남쪽 둔덕 앞 모
    hl = cov & (m >= 1.3) & (m < 2.2) & ~((dS < 3))
    rgb[hl] = BONEa[5]                                                            # 둔덕 윗 모 빛
    # 잔 뼈 조각 하나(변형마다 다른 자리): 3~4px 긴 뼈, 윗면 밝음·아래 윤곽
    r = np.random.default_rng(seed * 100 + n)
    if n != 15 and r.random() < .45:
        cx, cy, L = int(r.integers(3, 10)), int(r.integers(4, 12)), int(r.integers(3, 5))
        if m[cy, cx] > 2.5 and m[cy, min(15, cx + L)] > 1.5:
            for i in range(L):
                rgb[cy, cx + i] = BONEa[6] if i in (0, L - 1) else BONEa[5]
                rgb[cy + 1, cx + i] = BONEa[2]
            rgb[cy - 1, cx] = BONEa[5]; rgb[cy - 1, cx + L - 1] = BONEa[5]
    return _img(rgb, a)


# ================================================================ 마력 번짐(7단 램프)
def mana_cell(n, seed=501):
    """고인 마력: 바닥보다 밝은 보라 빛 액(7단 램프 불투명 화소). 허공(검남색 + 별)과 헷갈리지 않게 흰 별점은 쓰지 않고,
    어두운 윤곽 테 → 밝은 빛 막 → 북·서쪽 물가 밝은 띠 → 짧은 가로 물결(변형마다 다른 자리)."""
    m, dN, dE, dS, dW = ef(n, 2.6, 3.4, 7.5, seed)
    rgb = np.zeros((16, 16, 3), int); a = np.zeros((16, 16), int)
    g = hh(seed, n)
    sp = (m < 0) & (m > -2.0) & (g < (2.0 + m) / 2.0 * .3)                       # 번져 나간 보라 얼룩 알갱이
    rgb[sp] = VIOLa[2]; a[sp] = 255
    ins = m >= 0
    rgb[ins] = VIOLa[3]; a[ins] = 255
    rgb[ins & (m < 2.2) & (dN >= 2.2)] = VIOLa[2]                                  # 가장자리 얕은 곳은 한 단 어둡다
    rgb[ins & (m < 1.0)] = VIOLa[1]                                               # 윤곽 테
    band = ins & (dN >= 1.0) & (dN < 2.2)                                         # 북쪽 물가 밝은 띠(빛 왼쪽 위)
    rgb[band] = VIOLa[4]
    band2 = ins & (dW >= 1.0) & (dW < 1.8) & (dN >= 2.2)
    rgb[band2] = VIOLa[4]
    r = np.random.default_rng(seed * 100 + n)
    for _ in range(0 if n == 15 else 1 + int(r.random() < .5)):                # 물결: 속 칸에는 두지 않는다
        sx, sy, L = int(r.integers(2, 10)), int(r.integers(4, 13)), int(r.integers(3, 6))
        for i in range(L):
            x = sx + i
            if x < 16 and ins[sy, x] and m[sy, x] >= 2.4: rgb[sy, x] = VIOLa[5] if 0 < i < L - 1 else VIOLa[4]
    return _img(rgb, a)


def crack_sheet(seed=3):
    """발광 균열(줄 붓): 이웃 셋 이상인 칸은 이음 일부만 그려 덩이로 칠해도 그물·사다리가 되지 않는다(끊긴 금은 칸 경계에서 끝난다)."""
    import ft_auto as AU
    keep = {14: 2 | 8, 13: 1 | 4, 11: 2 | 8, 7: 1 | 4}
    sh = new(64, 64)
    for n in range(16):
        if n == 15: continue                                                       # 속 칸은 비운다(칠한 덩이의 둘레만 금이 된다)
        sh.alpha_composite(AU.crack_cell(keep.get(n, n), 0, 0, seed, True), (n % 4 * T, n // 4 * T))
    return sh


def voidbreak_sheet(): return sheet_of(voidbreak_cell)
def rubble_sheet(): return sheet_of(rubble_cell)
def pool_sheet(): return sheet_of(pool_cell)
def dust_sheet(): return sheet_of(dust_cell)
def mana_sheet(): return sheet_of(mana_cell)
