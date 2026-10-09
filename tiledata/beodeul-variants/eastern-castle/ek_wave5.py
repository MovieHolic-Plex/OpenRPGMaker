# 동양풍 성·닌자 마을 — 웨이브 5 보정 패스(2026-10-08): 시그니처 땅 덩이 오토타일 + 잔디 변형 + 흙길 가장자리 + 정원석·석등.
# 규칙(WAVE-BRIEF-4): 땅 덩이는 16변형 오토타일(칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8)로, 이웃이 없는 쪽은 불규칙한 가장자리.
# 가장자리 들쭉날쭉은 fr_base.edge_depth(주기 16 잡음 tnoise1)를 **모든 변형에 같은 씨앗**으로 써서 이웃 칸끼리 윤곽이 이어진다.
# 속 결(물·흙·이끼·모)은 16 주기 함수(vn_arr per=16, 4·16 주기 격자)라 어떤 칸끼리 붙어도 이음새가 없다.
# 새 재질은 같은 7단 램프 규칙(0 윤곽 · 1~6 밝기): mizu(버들항 운하 물 톤 그대로), doro(논물), soil(칩셋 흙 4색 사이를 채운 램프),
# koke(이끼), aki(낙엽). 풀 = 칩셋 잔디(0,128) = 칩셋 잎 램프 톤 4 이므로 풀 위 덧그림은 잎 램프 톤 2~6 으로 찍는다.
import math
import numpy as np
from PIL import Image
from ek_base import *
from ek_base import _hash
import fr_mat
from fr_ground import vn_arr

def _r(*cs): return [hx(c) for c in cs]
MIZU = [(10, 30, 32), (20, 60, 54), (28, 74, 68), (33, 88, 78), (42, 106, 96), (63, 162, 174), (167, 212, 219)]   # water6 운하 톤
DORO = _r('#12140c', '#262a18', '#363e24', '#46502e', '#5a663c', '#7e9064', '#b4c4a0')    # 논물(흙탕 + 하늘 비침)
SOIL = [(27, 16, 36), (46, 30, 20), (66, 46, 30), (94, 66, 42), (128, 90, 58), (170, 138, 126), (217, 210, 190)]  # 칩셋 흙(16,224)
KOKE = _r('#0a160e', '#14281a', '#1e3c22', '#2c5228', '#40682e', '#5a8236', '#7ea046')    # 이끼(풀보다 누렇고 탁하다)
AKI = _r('#2a0e08', '#5a1c0e', '#8a3014', '#b04a1a', '#d0702a', '#e49a40', '#f0c070')     # 낙엽(단풍·은행)
NEW5 = {'mizu': MIZU, 'doro': DORO, 'soil': SOIL, 'koke': KOKE, 'aki': AKI}
for n in NEW5:
    if n not in fr_mat.MID:
        fr_mat.MATS.append(n); fr_mat.MID[n] = len(fr_mat.MATS) - 1
_lut = np.zeros((len(fr_mat.MATS), 7, 3), np.uint8)
_lut[:fr_mat.LUT.shape[0]] = fr_mat.LUT
for n, r in NEW5.items():
    for k in range(7): _lut[fr_mat.MID[n], k] = r[k]
fr_mat.LUT = _lut
RAMP.update(NEW5)
LEAFa = np.array(fr_mat.LEAF7, int); MIZUa = np.array(MIZU, int); DOROa = np.array(DORO, int); SOILa = np.array(SOIL, int)
KOKEa = np.array(KOKE, int); AKIa = np.array(AKI, int); STa_ = np.array(ST, int)

X16, Y16 = np.meshgrid(np.arange(16), np.arange(16))


# ================================================================ 가장자리 거리(변별 방향 포함)
def edges(n, inset, jag, rad, seed):
    """edge_depth 와 같은 규칙으로 m(바깥 경계에서 안쪽까지 px, 음수 = 바깥)과 북쪽 경계 거리 mN 을 같이 돌려준다."""
    X, Y = X16, Y16
    miss = {'N': not (n & 1), 'E': not (n & 2), 'S': not (n & 4), 'W': not (n & 8)}
    # 두 겹 주기 잡음(긴 물결 8px + 잔 물결 4px, 둘 다 16 주기) — 같은 씨앗이면 이웃 칸 윤곽이 이어진다
    def J(s_):
        x = np.arange(16) + .5
        v = sum(a * np.sin(2 * np.pi * f * x / 16.0 + _hash(s_, f, 91) * 6.283) for f, a in ((1, 1.0), (2, .55), (3, .35), (5, .18)))
        return v / 1.6 * jag
    # 칸 모서리에서는 들임을 0.8px 로 줄인다: 오목 모서리(이웃 둘은 있고 대각선이 빈 칸)에서 둑·테가 끊겨 속(물·흙)이 풀에 맞닿지 않게.
    xx = np.arange(16) + .5
    wr = np.clip(np.minimum(xx, 16 - xx) / 5.0, 0, 1)
    I = lambda j_: .8 + (np.maximum(inset + j_, 0) - .8) * wr
    jN = I(J(seed + 1)); jS = I(J(seed + 2)); jW = I(J(seed + 3)); jE = I(J(seed + 4))
    d = {'N': Y - jN[X], 'S': (15 - Y) - jS[X], 'W': X - jW[Y], 'E': (15 - X) - jE[Y]}
    m = np.full((16, 16), 99.0)
    for k in 'NESW':
        if miss[k]: m = np.minimum(m, d[k])
    for a, b in (('N', 'W'), ('N', 'E'), ('S', 'W'), ('S', 'E')):
        if miss[a] and miss[b]:
            da, db = d[a], d[b]; sel = (da < rad) & (db < rad)
            m = np.where(sel, np.minimum(m, rad - np.hypot(rad - da, rad - db)), m)
    mN = d['N'] if miss['N'] else np.full((16, 16), 99.0)
    mS = d['S'] if miss['S'] else np.full((16, 16), 99.0)
    return m, mN, mS


def clip_(k): return max(1, min(6, int(k)))


def _cell(rgb, al):
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), np.where(al, 255, 0).astype(np.uint8)]), 'RGBA')


# ================================================================ 16 주기 막돌(둑 돌·디딤 자갈)
_CEN = None
def cobble(X, Y, seed=5, per=16, k=3):
    """주기 per 의 둥근 막돌: 칸마다 k x k 개 흔든 중심, 가장 가까운 중심 = 돌, 둘째와 차이 < 1 = 틈(톤 1).
    돌마다 위·왼(빛) +1 · 아래·오른 −1, 돌마다 톤 흔들림. 반환: 톤(1..6), 돌 번호."""
    sp = per / k
    cs = []
    for j in range(k):
        for i in range(k):
            cx = (i + .5) * sp + (_hash(i, j, seed) - .5) * sp * .55
            cy = (j + .5) * sp + (_hash(i, j, seed + 1) - .5) * sp * .55
            cs.append((cx, cy, _hash(i, j, seed + 2)))
    best = np.full(X.shape, 1e9); second = np.full(X.shape, 1e9); idx = np.zeros(X.shape, int); rx = np.zeros(X.shape); ry = np.zeros(X.shape)
    Xm = (X % per) + .5; Ym = (Y % per) + .5
    for ci, (cx, cy, h) in enumerate(cs):
        for ox in (-per, 0, per):
            for oy in (-per, 0, per):
                dx = Xm - (cx + ox); dy = (Ym - (cy + oy)) * 1.15
                d = np.hypot(dx, dy)
                nb = d < best
                second = np.where(nb, best, np.minimum(second, d))
                rx = np.where(nb, dx, rx); ry = np.where(nb, dy, ry); idx = np.where(nb, ci, idx); best = np.where(nb, d, best)
    hv = np.array([c[2] for c in cs])[idx]
    t = np.where(hv > .45, 4, 3) - (hv < .12).astype(int)
    v = rx + ry
    t = np.where(v < -2.4, t + 1, np.where(v > 1.6, t - 1, t))
    t = np.where((rx < -1.4) & (ry < -1.8) & (hv > .3), 5, t)
    gap = (second - best) < 1.0
    t = np.where(gap, 1, t)
    return np.clip(t, 1, 6), idx, gap


# ================================================================ ① 잉어 연못(돌 둑 + 연잎, 막힘)
def pond_cell(n, seed=21):
    """잉어 연못 칸: 이웃 없는 쪽 = 둥근 막돌 둑(돌 사이 이끼) → 북쪽 둑은 돌 앞면이 물로 내려가며 그늘(3/4),
    남·서·동 둑은 돌 윗면 + 물가 밝은 테. 속 = 버들항 운하 물 톤(깊을수록 어둡게, 잔물결 줄). 가장자리 칸에 연잎(가끔 분홍 꽃)."""
    m, mN, mS = edges(n, inset=2.6, jag=2.2, rad=7.0, seed=seed)
    X, Y = X16, Y16
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    # 물 속
    nz = vn_arr(X, Y, 8, seed + 3, per=16) * .7 + vn_arr(X, Y, 4, seed + 4, per=16) * .3
    wt = 3 - ((hash2(X // 2, Y, seed + 3) > .9) & (nz < .5)).astype(int)            # 물은 고른 한 톤 + 드문 어둠 점(칸이 되풀이돼도 무늬가 안 생긴다)
    rip5 = (Y == 5) & (X >= 3) & (X < 6) & (n != 15); rip4 = (Y == 12) & (X >= 9) & (X < 12) & (n != 15)   # 가장자리 칸에만 짧은 잔물결
    wt = np.where(rip5 & (m > 6.5), 5, np.where(rip4 & (m > 6.5), 4, wt))
    STONE = 4.6
    north = (mN < m + 1.6) & (mN < 9)
    wstart = np.where(north, STONE + 2.2, STONE)
    water = m >= wstart
    wt = np.where(water & (m < wstart + 1.2) & ~north, 4, wt)                    # 남·서·동 물가 얕은 밝은 띠
    wt = np.where(water & north & (m < wstart + 2.5), 1, wt)                     # 북쪽 둑 그늘
    wt = np.where(water & north & (m >= wstart + 2.5) & (m < wstart + 3.5), 2, wt)
    rgb = np.where(water[..., None], MIZUa[np.clip(wt, 1, 6)], rgb); al |= water
    # 돌 둑
    ct, cid, gap = cobble(X, Y, seed + 7)
    band = (m >= 0) & (m < STONE)
    st = ct.copy()
    st = np.where(m < .9, np.maximum(st - 1, 1), st)                            # 풀 쪽 끝 그늘(돌 밑동)
    moss = gap & band & (hash2(X, Y, seed + 9) > .35)                            # 돌 틈 이끼
    rgb = np.where(band[..., None], STa_[st], rgb); al |= band
    rgb = np.where(moss[..., None], KOKEa[np.where(Y % 2 == 0, 4, 3)], rgb)
    face = north & (m >= STONE) & (m < STONE + 2.2)                              # 북쪽 둑 돌 앞면(물로 내려간다)
    ft = np.where(gap, 1, np.where(m < STONE + 1.0, 3, 2))
    rgb = np.where(face[..., None], STa_[ft], rgb); al |= face
    lip = band & ~north & (m >= STONE - 1.0)                                     # 남·서·동: 돌 아래 물 닿는 줄(젖어 어둡다)
    rgb = np.where((lip & (ct <= 3))[..., None], STa_[2], rgb)
    damp = (m >= -1.0) & (m < 0) & (hash2(X, Y, seed + 11) > .45)                 # 둑 바깥 젖은 풀 점
    rgb = np.where(damp[..., None], LEAFa[2], rgb); al |= damp
    # 연잎(가장자리 칸에만, 칸 안에 들어오게) — 칸마다 자리·크기 다르게
    if bin(n).count('1') <= 2 and _hash(n, 3, seed) > .15:                    # 모서리·끝 칸에만(곧은 둑에 같은 자리로 되풀이되지 않게)
        placed = 0
        for jj in range(10):                                                        # 자리 후보 여럿 — 물 안에 들어가는 자리(칸마다 하나~둘)
            j = jj % 2
            if placed >= (2 if _hash(n, 4, seed) > .6 else 1): break
            cx = 3.5 + _hash(n, 5 + jj, seed) * 9; cy = 4 + _hash(n, 7 + jj * 3, seed) * 9; r = 2.2 + _hash(n, 9 + jj, seed) * 1.0
            dd = np.hypot(X + .5 - cx, (Y + .5 - cy) * 1.35)
            ang = np.arctan2(Y + .5 - cy, X + .5 - cx)
            notch = (np.abs(ang - (0.6 + j * 2.2)) < .35)
            pad = (dd <= r) & ~notch
            if not (pad <= (water & (m >= wstart + .2))).all(): continue
            lt = np.where((X + .5 - cx) + (Y + .5 - cy) < -1, 5, np.where(dd > r - .9, 3, 4))
            rgb = np.where(pad[..., None], LEAFa[lt], rgb); placed += 1
            under = np.roll(pad, 1, 0) & ~pad & water
            rgb = np.where(under[..., None], MIZUa[1], rgb)
            if _hash(n, 11 + j, seed) > .7:                                       # 분홍 연꽃 봉오리
                fx, fy = int(cx), int(cy) - 1
                for (dx, dy, k) in ((0, 0, 6), (1, 0, 5), (0, 1, 5), (1, 1, 4)):
                    if 0 <= fx + dx < 16 and 0 <= fy + dy < 16: rgb[fy + dy, fx + dx] = fr_mat.RAMP_OF['redl'][k]
    return _cell(rgb, al)


def autotile_pond(): return sheet_from_cells([pond_cell(n) for n in range(16)])


# ================================================================ ② 이끼·낙엽 덮인 흙 덩이(걷기)
def mossdirt_cell(n, seed=33):
    """이끼 낀 흙 덩이: 속 = 낙엽 깔린 흙(2x4px 잎이 엇갈려 빽빽이 — 단풍·은행·마른 잎 톤 + 위 모 빛, 틈은 어두운 흙)에
    이끼 방석(이끼 램프, 위 끝 빛 · 아래 끝 그늘)이 섬처럼 덮인다. 잔결이 빽빽해 속 칸이 되풀이돼도 무늬가 안 보인다.
    가장자리 = 이끼 테가 들쭉날쭉 풀로 번지고, 바깥 1~2px 에 이끼 점. 가장자리 칸에만 굵은 낙엽·작은 돌(칸마다 자리 다르게)."""
    m, mN, mS = edges(n, inset=3.0, jag=2.8, rad=8.0, seed=seed)
    X, Y = X16, Y16
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    inside = m >= 1.4
    # 숲 흙(칩셋 흙 결을 흙 램프 2..4 로) + 낙엽: 4x4 블록마다 흔든 자리에 작은 잎(2~3px, 모양 넷), 블록의 반쯤
    T = chip_tones_lin(16, 224, 2, 4)[Y % 16, X % 16]
    lit = SOILa[T]
    SH = [((0, 0, 1), (1, 0, 0), (1, 1, -1)), ((0, 0, 1), (0, 1, 0), (1, 1, -1)), ((0, 1, 0), (1, 0, 1), (2, 0, 0), (1, 1, -1)),
          ((0, 0, 1), (1, 0, 0), (2, 1, -1))]
    for by in range(4):
        for bx in range(4):
            h = _hash(bx, by, seed + 1)
            if h > .55: continue
            ox = bx * 4 + int(_hash(bx, by, seed + 2) * 2); oy = by * 4 + int(_hash(bx, by, seed + 3) * 2)
            col = AKIa if h < .26 else SOILa
            base = (3 if h < .1 else 4) if h < .26 else 5
            for (dx, dy, d) in SH[int(_hash(bx, by, seed + 4) * 4)]:
                x_, y_ = (ox + dx) % 16, (oy + dy) % 16
                lit[y_, x_] = col[clip_(base + d)]
            x_, y_ = (ox + 1) % 16, (oy + 2) % 16
            lit[y_, x_] = SOILa[1]
    rgb = np.where(inside[..., None], lit, rgb); al |= inside
    # 이끼 방석
    mo = vn_arr(X, Y, 4, seed + 3, per=16) * .6 + vn_arr(X, Y, 2, seed + 4, per=16) * .4
    cush = inside & (m < 5.0 + (mo - .5) * 6.0)                                  # 이끼는 가장자리에서 안으로 들쭉날쭉 번진다(속 칸은 낙엽 흙)
    up = np.roll(cush, 1, 0); dn = np.roll(cush, -1, 0)
    kt = np.where(~up, 5, np.where(~dn, 3, 4))                                   # 방석 위 끝 빛 · 아래 끝 그늘
    kt = np.where(cush & (hash2(X, Y, seed + 5) > .82), kt + 1, kt)
    rgb = np.where(cush[..., None], KOKEa[np.clip(kt, 1, 6)], rgb)
    sh = inside & ~cush & up                                                     # 방석 아래 흙에 그늘 1px
    rgb = np.where(sh[..., None], SOILa[1], rgb)
    rim = (m >= 0) & (m < 1.4)
    rgb = np.where(rim[..., None], KOKEa[np.where(hash2(X, Y, seed + 6) > .5, 4, 3)], rgb); al |= rim
    fr = (m >= -1.8) & (m < 0) & (hash2(X, Y, seed + 7) > .55)
    rgb = np.where(fr[..., None], KOKEa[np.where(Y % 2, 4, 5)], rgb); al |= fr
    if n != 15:                                                                   # 가장자리 칸: 굵은 낙엽(단풍 3px) · 작은 돌
        for i in range(1 + int(_hash(n, 1, seed) * 2)):
            px_ = 2 + int(_hash(n, 10 + i, seed) * 11); py_ = 2 + int(_hash(n, 20 + i, seed) * 11)
            if m[py_, px_] < 2.0: continue
            for (dx, dy, k) in ((0, 0, 5), (1, 0, 4), (-1, 0, 4), (0, -1, 4), (0, 1, 3), (1, 1, 1)):
                if 0 <= px_ + dx < 16 and 0 <= py_ + dy < 16: rgb[py_ + dy, px_ + dx] = AKIa[k]
        if _hash(n, 2, seed) > .4:
            px_ = 2 + int(_hash(n, 30, seed) * 11); py_ = 2 + int(_hash(n, 31, seed) * 11)
            if m[py_, px_] >= 2.5:
                rgb[py_, px_] = STa_[5]; rgb[py_, px_ + 1] = STa_[4]; rgb[py_ + 1, px_] = STa_[3]; rgb[py_ + 1, px_ + 1] = STa_[2]
    return _cell(rgb, al)


def autotile_mossdirt(): return sheet_from_cells([mossdirt_cell(n) for n in range(16)])


# ================================================================ ③ 논(물 댄 논, 막힘)
def paddy_cell(n, seed=45):
    """물 댄 논: 이웃 없는 쪽 = 흙 논두렁(윗면 칩셋 흙 + 풀 점). 북쪽 두렁은 윗면 뒤에 앞면(물로 내려가는 흙 벽)이 보이고,
    남쪽 두렁은 바깥 끝에 앞면 한 줄. 속 = 논물(하늘 비침 얼룩) + 4px 격자 모 포기(잎 램프 3 획 + 물그림자)."""
    m, mN, mS = edges(n, inset=1.6, jag=1.4, rad=5.0, seed=seed)
    X, Y = X16, Y16
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    RID = 4.2
    north = (mN < m + 1.2) & (mN < 9)
    south = (mS < m + 1.2) & (mS < 9)
    wstart = np.where(north, RID + 2.0, RID)
    water = m >= wstart
    sky = vn_arr(X, Y, 8, seed + 1, per=16)
    wt = np.where(sky > .6, 4, np.where(sky > .32, 3, 2))
    wt = np.where(water & (m < wstart + 1.0), 2, wt)
    wt = np.where(water & north & (m < wstart + 1.6), 1, wt)
    rgb = np.where(water[..., None], DOROa[wt], rgb); al |= water
    # 모 포기: 4px 격자(줄마다 1px 엇갈림), 세 획(가운데 위로 3px, 양옆 2px), 아래 물그림자
    sx = (X + (Y // 4) % 2) % 4; sy = Y % 4
    for (ox, oy, k) in ((1, 0, 4), (1, 1, 3), (0, 1, 3), (2, 1, 3), (1, -1, 5), (1, 2, -1)):
        sel = water & (sx == ox) & (sy == (oy + 2) % 4) & (m >= wstart + .8)
        if oy == -1: sel &= hash2(X // 4, Y // 4, seed + 3) > .4
        rgb = np.where(sel[..., None], DOROa[1] if k < 0 else LEAFa[k], rgb)
    shd = water & (sx == 1) & (sy == 1) & (m >= wstart + .8) & False
    # 두렁
    ridge = (m >= 0) & ~water
    gt = np.where(hash2(X, Y, seed + 4) > .7, 5, 4)
    gt = np.where(m < .9, 3, gt)
    rgb = np.where(ridge[..., None], SOILa[gt], rgb); al |= ridge
    grass = ridge & (m >= .8) & (hash2(X // 2, Y, seed + 5) > .62)                # 두렁 위 풀 점
    rgb = np.where(grass[..., None], LEAFa[np.where(hash2(X, Y, seed + 6) > .5, 5, 4)], rgb)
    face = north & (m >= RID) & (m < RID + 2.0)                                  # 북 두렁 앞면(물로)
    rgb = np.where(face[..., None], SOILa[np.where(m < RID + 1.0, 3, 2)], rgb)
    sface = south & (m >= 0) & (m < 1.2)                                          # 남 두렁 바깥 앞면
    rgb = np.where(sface[..., None], SOILa[np.where(m < .6, 1, 2)], rgb)
    return _cell(rgb, al)


def autotile_paddy(): return sheet_from_cells([paddy_cell(n) for n in range(16)])


# ================================================================ (보정) 흙 골목 가장자리
def lane_cell(n, seed=57):
    """마을 흙 골목 가장자리: 속 = 칩셋 흙(16,224) 그대로(지도 흙길과 같은 결), 이웃 없는 쪽은 풀이 먹어 든 들쭉날쭉 끝 +
    끝 1px 그늘 + 흙 위로 삐친 풀 포기(잎 램프 세 획) + 끝을 따라 작은 자갈, 바깥 2px 은 닳은 풀에 흙 알갱이."""
    m, mN, mS = edges(n, inset=2.4, jag=2.3, rad=6.0, seed=seed)
    X, Y = X16, Y16
    d = chip_tex(16, 224).astype(int)
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    inside = m >= 0
    rgb = np.where(inside[..., None], d, rgb); al |= inside
    e1 = inside & (m < 1.0)
    rgb = np.where(e1[..., None], SOILa[2], rgb)
    nw = (m >= 1.0) & (m < 2.0) & (mS < m + .5)                                   # 남쪽 끝은 턱 그늘이 한 줄 더
    rgb = np.where(nw[..., None], (d * .82).astype(int), rgb)
    spk = (m >= -2.2) & (m < 0) & (hash2(X, Y, seed + 1) > .7)                    # 닳은 풀 흙 알갱이
    rgb = np.where(spk[..., None], SOILa[np.where(hash2(X, Y, seed + 2) > .5, 3, 4)], rgb); al |= spk
    # 풀 포기(흙 위로 삐침): 끝에서 0.5~3px 안쪽, 칸마다 자리 다르게
    for i in range(2 + int(_hash(n, 1, seed) * 3)):
        tx = 1 + int(_hash(n, 10 + i, seed) * 14); ty = 2 + int(_hash(n, 20 + i, seed) * 13)
        if not (0.3 <= m[ty, tx] < 3.2): continue
        for (dx, dy, k) in ((0, 0, 3), (0, -1, 5), (-1, -1, 4), (1, -2, 6), (0, -2, 5)):
            x_, y_ = tx + dx, ty + dy
            if 0 <= x_ < 16 and 0 <= y_ < 16: rgb[y_, x_] = LEAFa[k]; al[y_, x_] = True
    for i in range(2 + int(_hash(n, 2, seed) * 2)):                               # 끝 자갈
        px_ = 1 + int(_hash(n, 30 + i, seed) * 13); py_ = 1 + int(_hash(n, 40 + i, seed) * 13)
        if not (1.0 <= m[py_, px_] < 3.5): continue
        rgb[py_, px_] = SOILa[6]; rgb[py_, min(15, px_ + 1)] = SOILa[5]; rgb[min(15, py_ + 1), px_] = SOILa[5]; rgb[min(15, py_ + 1), min(15, px_ + 1)] = SOILa[1]
    return _cell(rgb, al)


def autotile_lane(): return sheet_from_cells([lane_cell(n) for n in range(16)])


# ================================================================ (보정) 잔디 변형 3종 — 버들항 풀 위 덧그림(칸 안에만 찍어 어떤 칸끼리도 이음새 없음)
def grass_overlay(kind, cx, cy, seed=70):
    """kind: 'short'(짧게 깎은 풀: 1x2 풀잎 점이 고르게 — 빛 끝 + 아래 그늘), 'clover'(클로버 덤불 2~4 + 드문 흰 꽃),
    'leaves'(떨어진 잎 3~6 + 잎 밑 그늘 풀). 칸 좌표(cx, cy)마다 자리를 바꾼다. 반환 16x16 RGBA(투명 = 밑 풀)."""
    X, Y = X16, Y16
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    sd = seed + cx * 131 + cy * 71
    if kind == 'short':
        h = hash2(X + cx * 16, Y + cy * 16, seed)
        tip = (h > .93) & (Y < 15)
        rgb = np.where(tip[..., None], LEAFa[5], rgb); al |= tip
        bot = np.roll(tip, 1, 0) & ~tip
        rgb = np.where(bot[..., None], LEAFa[3], rgb); al |= bot
        dk = (h < .035)
        rgb = np.where(dk[..., None], LEAFa[3], rgb); al |= dk
    elif kind == 'clover':
        for i in range(3 + int(_hash(cx, cy, sd) * 3)):
            ox = 2 + int(_hash(i, 1, sd) * 10); oy = 2 + int(_hash(i, 2, sd) * 10)
            for (lx, ly) in ((0, 0), (2, 0), (1, 2)) if _hash(i, 3, sd) > .5 else ((1, 0), (0, 2), (2, 2)):
                for (dx, dy, k) in ((0, 0, 6), (1, 0, 5), (0, 1, 5), (1, 1, 4)):
                    x_, y_ = ox + lx + dx, oy + ly + dy
                    if x_ < 16 and y_ < 16: rgb[y_, x_] = LEAFa[k]; al[y_, x_] = True
            if oy + 4 < 16:
                for dx in range(4):
                    if ox + dx < 16 and not al[oy + 4, ox + dx]: rgb[oy + 4, ox + dx] = LEAFa[2]; al[oy + 4, ox + dx] = True
        if _hash(cx, cy, sd + 5) > .55:                                           # 흰 클로버 꽃
            fx = 3 + int(_hash(cx, cy, sd + 6) * 9); fy = 2 + int(_hash(cx, cy, sd + 7) * 9)
            for (dx, dy, c) in ((1, 0, WASHI[6]), (0, 1, WASHI[5]), (1, 1, WASHI[6]), (2, 1, WASHI[4]), (1, 2, WASHI[4]), (1, 3, LEAFa[3])):
                if fx + dx < 16 and fy + dy < 16: rgb[fy + dy, fx + dx] = c; al[fy + dy, fx + dx] = True
    elif kind == 'leaves':
        for i in range(1 + int(_hash(cx, cy, sd) * 3)):
            ox = 1 + int(_hash(i, 1, sd) * 12); oy = 1 + int(_hash(i, 2, sd) * 12)
            col = AKIa if _hash(i, 3, sd) > .45 else SOILa
            base = 3 if _hash(i, 4, sd) > .35 else 2
            if col is SOILa: base = 4
            shape = [((0, 0, 1), (1, 0, 0), (1, 1, -1)), ((0, 0, 1), (0, 1, 0), (1, 1, -1)), ((1, 0, 1), (0, 1, 0), (1, 1, 0), (2, 1, -1))][int(_hash(i, 5, sd) * 3)]
            for (dx, dy, d) in shape:
                rgb[oy + dy, ox + dx] = col[clip_(base + d)]; al[oy + dy, ox + dx] = True
            for dx in range(3):                                                    # 잎 밑 그늘
                if oy + 2 < 16 and ox + dx < 16 and not al[oy + 2, ox + dx]: rgb[oy + 2, ox + dx] = LEAFa[3]; al[oy + 2, ox + dx] = True
    return _cell(rgb, al)


def grass_sample(kind):
    """바닥 표본 48x48: 칩셋 잔디(0,128) 3x3 위에 칸마다 다른 덧그림."""
    import ground as G
    base = Image.fromarray(G.tiled(G.tex(0, 128), 48, 48)).convert('RGBA')
    for cy in range(3):
        for cx in range(3): base.alpha_composite(grass_overlay(kind, cx, cy), (cx * 16, cy * 16))
    return base


# ================================================================ (보정) 정원석·석등 소품
def yukimi_toro(seed=0):
    """설견 등롱(유키미) 2x2칸: 넓고 낮은 육각 갓(윗면 빛 + 이끼 점 + 끝이 살짝 휜 귀) · 불집(불빛 창) · 휜 다리 셋. 다리 밑 두 칸만 막힘."""
    W, H = 32, 32
    tc = TC(W, H, seed)
    for (x0, x1) in ((6, 9), (14, 18), (23, 26)):                              # 휜 다리(바깥으로 벌어진다)
        for y in range(21, 31):
            f = (y - 21) / 9.0; dx = int(round((-1 if x0 < 10 else (1 if x0 > 20 else 0)) * f * 2))
            for x in range(x0, x1): tc.px(x + dx, y, 'stone', 5 if x == x0 else (3 if x == x1 - 1 else 4))
        tc.px(x0 - 1 + (-2 if x0 < 10 else 0), 30, 'stone', 2)
    for y in range(14, 22):                                                    # 불집
        for x in range(10, 22):
            if 13 <= x < 19 and 16 <= y < 20: tc.px(x, y, 'amber', 5 if y < 18 else 4)
            else: tc.px(x, y, 'stone', 5 if x < 13 else (4 if x < 19 else 3))
    for y in range(6, 14):                                                     # 넓은 갓
        hw = 6 + (y - 6) * 1.35
        for x in range(int(16 - hw), int(16 + hw)):
            k = 6 if y < 9 and x < 16 else (5 if y < 11 else 4)
            if x > 16 + hw * .55: k -= 1
            if y >= 12: k = 2 if y == 13 else 3
            m = 'stone'
            if y < 11 and _hash(x // 2, y, seed + 3) < .3: m, k = 'koke', 4 if x < 16 else 3
            tc.px(x, y, m, k)
    tc.px(3, 12, 'stone', 4); tc.px(2, 11, 'stone', 5); tc.px(28, 12, 'stone', 3); tc.px(29, 11, 'stone', 3)
    tc.ell(16, 4.2, 2.6, 2.4, 'stone', lambda X, Y: 6 if X < 16 else 3)        # 보주
    return shadow_under(tc.fin(.6), 16, 30, 13, 2, 55)


def oki_toro(seed=0):
    """놓는 작은 등롱(오키) 1x1칸: 땅에 바로 놓은 네모 불집 + 모임 갓 + 보주. 칸 막힘."""
    tc = TC(16, 16, seed)
    for y in range(8, 15):
        for x in range(3, 13):
            if 6 <= x < 10 and 9 <= y < 12: tc.px(x, y, 'amber', 5 if y < 11 else 4)
            else: tc.px(x, y, 'stone', 5 if x < 5 else (4 if x < 11 else 3) if y < 14 else 2)
    for y in range(3, 8):
        hw = 2 + (y - 3) * 1.4
        for x in range(int(8 - hw), int(8 + hw)): tc.px(x, y, 'stone', (6 if x < 8 else 4) if y < 6 else 3)
    tc.px(8, 2, 'stone', 5); tc.px(7, 2, 'stone', 6)
    for x in range(4, 12):
        if _hash(x, 0, seed + 2) < .35: tc.px(x, 5, 'koke', 4)
    return shadow_under(tc.fin(.6), 8, 14, 6, 1, 50)


def _rock(tc, x0, y0, w, h, seed, mossy=.35, tall=False):
    """둥근 정원 돌 하나(3/4): 위 40% = 윗면(빛, 이끼 점), 아래 = 앞면(한 단 어둡고 오른쪽 그늘), 밑은 평평.
    결 = 칩셋 바위 결 밝기 순위 + 드문 금(톤 −1). 윤곽은 둥글게(타원), 꼭대기는 해시로 살짝 울퉁불퉁."""
    cx = x0 + w / 2.0; cy = y0 + h * .55; rx = w / 2.0; ry = h * .55
    g = chip_tones(336, 336, 0, 6)
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            u = (x + .5 - cx) / rx; v = (y + .5 - cy) / ry
            if v > 0: v *= .55                                                   # 밑은 평평하게
            if u * u + v * v > 1.0 - .12 * _hash(x // 3, seed, 7): continue
            topf = (y - y0) < h * (.42 if not tall else .3) + 2 * (1 - abs(u))
            k = (5 if u < .15 else 4) if topf else (4 if u < -.2 else 3)
            if u > .6: k -= 1
            if y >= y0 + h - 2: k = 2
            if g[y % 16, x % 16] <= 1 and _hash(x, y, seed + 5) < .5: k -= 1
            if topf and u < -.2 and v < -.55 and _hash(x, y, seed + 6) < .6: k = 6
            m = 'stone'
            if topf and _hash(x // 2, y, seed + 4) < mossy: m = 'koke'; k = 5 if u < 0 else 4
            tc.px(x, y, m, clamp(k, 1, 6))


def niwaishi_trio(seed=0):
    """정원석 무리(삼존석) 3x2칸: 가운데 선 돌 + 옆 납작 돌 + 작은 돌, 밑에 이끼 둘레. 아랫줄 막힘."""
    tc = TC(48, 32, seed)
    for x in range(2, 46):                                                    # 이끼 둘레
        for y in range(27, 31):
            if _hash(x, y, seed + 9) < .7 - abs(x - 24) / 60: tc.px(x, y, 'koke', 4 if y < 29 else 3)
    _rock(tc, 16, 2, 15, 28, seed + 1, tall=True)
    _rock(tc, 2, 14, 15, 15, seed + 2)
    _rock(tc, 32, 19, 12, 10, seed + 3)
    return shadow_under(tc.fin(.6), 24, 29, 21, 2, 55)


def ishibumi(seed=0):
    """돌 비석(글자 없음) 1x2칸: 거친 선돌 + 두 단 받침. 밑동만 막힘."""
    tc = TC(16, 32, seed)
    for y in range(26, 32):
        for x in range(1, 15): tc.px(x, y, 'stone', 6 if y == 26 else (2 if y == 31 else (4 if x < 12 else 3)))
    for y in range(3, 26):
        for x in range(4, 12):
            top = 3 + abs(x - 7.5) * .6
            if y < top: continue
            k = 5 if x < 6 else (4 if x < 10 else 3)
            if _hash(x, y, seed + 3) < .1: k -= 1
            m = 'koke' if (y < top + 2 and _hash(x, y, seed + 5) < .4) or (y > 22 and _hash(x, y, seed + 6) < .3) else 'stone'
            tc.px(x, y, m, k)
    return shadow_under(tc.fin(.6), 8, 30, 7, 2, 55)


def moss_boulder(seed=0):
    """이끼 덮인 큰 바위 2x2칸(윗면 이끼 두툼 + 앞면 막돌 결). 아랫줄 막힘."""
    tc = TC(32, 32, seed)
    _rock(tc, 1, 6, 30, 25, seed + 1, mossy=.75)
    return shadow_under(tc.fin(.6), 16, 30, 14, 2, 55)


def koi_pair(seed=0):
    """잉어 두 마리(물 위 장식 1x1칸): 주홍·흰 얼룩 잉어 등(4~5px) + 꼬리, 물그림자. 연못 물 칸에 드문드문."""
    tc = TC(16, 16, seed)
    for (x0, y0, dirx, c2) in ((2, 4, 1, 'washi'), (8, 10, -1, 'shu')):
        for i in range(5):
            x = x0 + (i if dirx > 0 else 4 - i)
            tc.px(x, y0, 'shu' if i % 3 else c2, 5 if i < 3 else 4); tc.px(x, y0 + 1, 'shu', 3)
        tx = x0 - 1 if dirx > 0 else x0 + 5
        tc.px(tx, y0, 'shu', 4); tc.px(tx - dirx, y0 - 1, 'shu', 3); tc.px(tx - dirx, y0 + 1, 'shu', 3)
        for i in range(5): tc.px(x0 + i, y0 + 2, 'mizu', 1, 160)
    return tc.img()


def lily_pads(seed=0):
    """연잎 무리(물 위 장식 1x1칸): 홈 난 둥근 잎 셋 + 분홍 꽃 하나. 연못 물 칸 가장자리에."""
    tc = TC(16, 16, seed)
    for i, (cx, cy, r) in enumerate(((5, 5, 3.2), (11, 9, 2.6), (5, 12, 2.2))):
        for y in range(16):
            for x in range(16):
                dd = math.hypot(x + .5 - cx, (y + .5 - cy) * 1.35)
                ang = math.atan2(y + .5 - cy, x + .5 - cx)
                if dd > r or abs(ang - (0.7 + i * 2.1)) < .38: continue
                tc.px(x, y, 'leaf', 5 if (x - cx) + (y - cy) < -1 else (3 if dd > r - .9 else 4))
        for x in range(int(cx - r), int(cx + r)): 
            if tc.get(x, int(cy + r / 1.35)) is None: tc.px(x, int(cy + r / 1.35), 'mizu', 1, 170)
    for (dx, dy, k) in ((0, 0, 6), (1, 0, 5), (0, 1, 5), (1, 1, 4), (0, -1, 6)): tc.px(10 + dx, 7 + dy, 'redl', k)
    return tc.img()
