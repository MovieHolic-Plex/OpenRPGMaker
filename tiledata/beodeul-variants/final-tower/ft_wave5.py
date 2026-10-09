# 최종 탑 — 웨이브 5 보정 패스(2026-10-08): 시그니처 땅 덩이 오토타일 3종.
# 규칙(WAVE-BRIEF-4): 16변형(칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8), 위층 투명 덧그림, 이웃 없는 쪽은 불규칙한 가장자리.
# 가장자리 들쭉날쭉은 변마다 주기 16 사인 합 잡음을 **모든 변형에 같은 씨앗**으로 써서(동양풍 성 ek_wave5.edges 와 같은 규칙,
# 여기에 복사본) 이웃 칸끼리 윤곽이 이어진다. 속 결은 칸 안 좌표만 쓰므로 어떤 칸끼리 붙어도 이음새가 없다.
#   autotile-mana-seep  마력 번짐(걷기)  — 바닥 판에 스며든 보라 마력 얼룩, 속에 갈라져 흐르는 빛 줄기, 가장자리는 성긴 번짐.
#   autotile-dark-pool  어둠 웅덩이(막힘) — 바닥이 꺼진 자리에 고인 검보라 액, 북쪽 둑은 꺼진 바닥 앞면, 남쪽은 젖은 턱, 바깥 젖은 번짐.
#   autotile-bone-dust  뼛가루 쌓인 바닥(걷기) — 상아 뼛가루가 바람에 쌓인 낮은 더미, 뼈 부스러기·척추 마디 조각.
import math
import numpy as np
from PIL import Image
from ft_base import *
from ft_base import _hash

X16, Y16 = np.meshgrid(np.arange(16), np.arange(16))
BY = np.tile(BAYER, (4, 4))


def hloc(x, y, seed):
    """칸 안 좌표 해시(주기 16)."""
    return FB.hash2(np.asarray(x) % 16, np.asarray(y) % 16, seed)


def edges(n, inset, jag, rad, seed):
    """m = 덩이 경계에서 안쪽까지 px(음수 = 바깥), mN/mS = 북/남 경계까지 거리(그 변이 비었을 때만)."""
    X, Y = X16, Y16
    miss = {'N': not (n & 1), 'E': not (n & 2), 'S': not (n & 4), 'W': not (n & 8)}
    xx = np.arange(16) + .5
    def J(s_):
        v = sum(a * np.sin(2 * np.pi * f * xx / 16.0 + _hash(s_, f, 91) * 6.283) for f, a in ((1, .6), (2, .9), (3, .45), (4, .2)))
        return v / 1.6 * jag
    wr = np.clip(np.minimum(xx, 16 - xx) / 5.0, 0, 1)            # 칸 모서리에서는 들임을 줄여 오목 모서리 이음이 끊기지 않게
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
    BIG = np.full((16, 16), 99.0)
    return m, (d['N'] if miss['N'] else BIG), (d['S'] if miss['S'] else BIG)


def _img(rgb, a):
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), np.clip(a, 0, 255).astype(np.uint8)]), 'RGBA')


def sheet_of(cellfn):
    sh = new(64, 64)
    for n in range(16): sh.alpha_composite(cellfn(n), (n % 4 * T, n // 4 * T))
    return sh


VIOLa = np.array(VIOL, int); FTa = np.array(FT, int); BONEa = np.array(BONE, int)


# ================================================================ 마력 번짐 (걷기)
def mana_cell(n, seed=501):
    m, mN, mS = edges(n, 2.2, 3.0, 7.5, seed)
    rgb = np.zeros((16, 16, 3), int); a = np.zeros((16, 16), int)
    # 빛이 고인 얼룩: 경계에서 안으로 갈수록 밝고 짙어진다(바닥 판 줄눈이 비치는 반투명 빛). 바깥은 성긴 번짐.
    fr = (m < 0) & (m > -2.4) & (vn_l(X16 * 2.0, Y16 * 2.0, 2, seed + 4) * .6 + hloc(X16, Y16, seed + 5) * .4 < (2.4 + m) / 2.4 * .6)
    rgb[fr] = VIOLa[2]; a[fr] = 110
    z1 = (m >= 0) & (m < 1.3); rgb[z1] = VIOLa[2]; a[z1] = 150
    z2 = (m >= 1.3) & (m < 3.4); rgb[z2] = VIOLa[3]; a[z2] = 88
    z3 = m >= 3.4; rgb[z3] = VIOLa[3]; a[z3] = 112
    mot = z3 & (vn_l(X16, Y16, 4, seed + 3) > .6); rgb[mot] = VIOLa[4]; a[mot] = 92
    # 빛 줄기: 경계 2px 안쪽에서 흐르는 가는 금빛(보라) 가지 — 대비 낮게
    spk = (m > 2.5) & (hloc(X16, Y16, seed + 9) > .988)
    rgb[spk] = VIOLa[5]; a[spk] = 255
    return _img(rgb, a)


def vn_l(X, Y, sc, seed):
    """칸 안 좌표 주기 16 값 잡음."""
    from fr_ground import vn_arr
    return vn_arr(np.asarray(X, float), np.asarray(Y, float), sc, seed, per=16)


# ================================================================ 어둠 웅덩이 (막힘)
INK = [(4, 3, 10), (8, 6, 18), (13, 10, 28), (20, 15, 40), (30, 22, 58), (46, 32, 86), (84, 60, 140)]   # 검보라 액 7단
INKa = np.array(INK, int)


def pool_cell(n, seed=531):
    m, mN, mS = edges(n, 2.2, 3.0, 7.5, seed)
    rgb = np.zeros((16, 16, 3), int); a = np.zeros((16, 16), int)
    # 바깥 젖은 번짐(경계 밖 1.6px): 바닥이 젖어 어두워진 성긴 점 — 덩이 둘레가 갑자기 끊기지 않는다
    wet = (m < 0) & (m > -1.8) & (vn_l(X16 * 2.0, Y16 * 2.0, 2, seed + 4) * .6 + hloc(X16, Y16, seed + 5) * .4 < (1.8 + m) / 1.8 * .6)
    rgb[wet] = FTa[1]; a[wet] = 150
    inside = m >= 0
    # 액 바탕: 경계에서 멀수록 깊고 어둡다(얕은 가장자리 3px 는 한 단 밝다)
    k = np.where(m < 1.5, 3, np.where(m < 3.5, 2, 1)) + (vn_l(X16, Y16, 8, seed + 2) > .68)
    rgb[inside] = INKa[k[inside]]; a[inside] = 255
    # 북쪽 둑: 꺼진 바닥의 앞면이 액으로 내려간다(3/4 시점) — 위 1px 밝은 모 + 2px 돌 앞면 + 1px 그늘
    nb = inside & (mN < 4.0)
    rgb[nb] = INKa[0]
    rgb[nb & (mN < 3.0)] = FTa[2]
    rgb[nb & (mN < 2.0)] = FTa[3]
    rgb[nb & (mN < 1.0)] = FTa[5]
    # 남·동·서 둑: 액이 바닥 턱에 닿는 곳 — 1px 젖은 턱(어두운 돌), 그 안 남쪽은 2px 보라 반사 띠(하늘 대신 탑 빛이 비친다)
    lip = inside & (m < 1.0) & ~nb
    rgb[lip] = FTa[1]
    refl = inside & (m >= 1.0) & (m < 2.0) & ~nb
    rgb[refl] = INKa[4]
    refl2 = refl & (mS < 3.0)
    rgb[refl2] = INKa[5]
    # 수면 광택: 칸마다 짧은 가로 반사 둘(3~5px, 가운데 밝음)
    gl = inside & ~nb & (m >= 2.0)
    for (sx, sy, L) in ((3, 6, 5), (9, 11, 4), (11, 3, 3)):
        for i in range(L):
            x = sx + i
            if gl[sy, x]: rgb[sy, x] = (VIOLa[3] if (L == 5 and i == 2) else INKa[6]) if 0 < i < L - 1 else INKa[5]
    # 기포 하나(칸마다 같은 자리라 아주 작게): 1px 빛 + 둘레 한 단
    if inside[6, 11] and m[6, 11] > 3.5 and not nb[6, 11]:
        rgb[6, 10] = rgb[6, 12] = INKa[3]; rgb[6, 11] = INKa[5]
    return _img(rgb, a)


# ================================================================ 뼛가루 쌓인 바닥 (걷기)
def dust_cell(n, seed=561):
    m, mN, mS = edges(n, 2.2, 3.0, 7.5, seed)
    rgb = np.zeros((16, 16, 3), int); a = np.zeros((16, 16), int)
    # 가루 덮임: 경계 안 2.5px 는 군집 잡음으로 성기게(바닥이 비친다), 그 안은 가득. 바둑판 디더는 쓰지 않는다.
    clump = vn_l(X16 * 2.0, Y16 * 2.0, 2, seed + 1) * .65 + hloc(X16, Y16, seed + 2) * .35
    g = (m >= 0) & (clump < np.clip((m + .4) / 2.5, 0, 1) * .95 + .02)
    # 가루 톤: 바람결 능선(밝음)·골(어두움) 큰 결 + 잔 알갱이 — 위·왼쪽 빛
    rid = vn_l(X16, Y16, 4, seed + 4)
    tone = np.where(rid > .8, 4, np.where(rid > .22, 3, 2))
    h = hloc(X16, Y16, seed + 5)
    tone = tone + (h > .92) - (h < .05)
    tone = np.where(m < 1.4, np.minimum(tone, 2), tone)                  # 얇은 가장자리는 바닥이 비쳐 어둡다
    rgb[g] = BONEa[np.clip(tone[g], 1, 5)]; a[g] = 255
    # 남쪽 가장자리: 낮은 둔덕 앞 모 그늘 1px
    sh = (mS >= 0) & (mS < 1.0) & (m >= 0)
    rgb[sh] = BONEa[1]; a[sh] = 255
    # 북·서쪽 가장자리 안 1px 밝은 모(둔덕 윗면이 빛을 받는다)
    hl = g & (m >= 1.4) & (m < 2.3) & (mS > 3)
    rgb[hl] = BONEa[4]
    return _img(rgb, a)


def autotile_mana(): return sheet_of(mana_cell)
def autotile_pool(): return sheet_of(pool_cell)
def autotile_dust(): return sheet_of(dust_cell)
