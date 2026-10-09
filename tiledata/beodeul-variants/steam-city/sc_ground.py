# 증기 도시 바닥 — 버들항 칩셋 결을 밝기 순위/선형으로 이 장소의 7단 램프에 옮긴다(자체 노이즈 발명 없음).
#   cob    젖은 검은 자갈(차도)   : 칩셋 둥근 돌(208,160) 결 → soot 램프 톤 2~5, 돌마다 윗왼 젖은 빛 점(톤 6)
#   walk   벽돌 보도              : 칩셋 벽돌 포장(192,176) 결 → brk 램프 톤 2~5
#   plaza  시계탑 광장 판석       : 제국 도시 판석 규칙(ec_ground.flag_k, 32px 판) → 회색 석재 한 단 어둡게(젖음)
#   plate  리벳 검은 철판(공장 앞): 기계 재질 규약 바닥판(fr_mat.panels) 톤 2 바탕
#   cinder 석탄 마당 다진 재      : 칩셋 흙(16,224) 결 → coal 램프 톤 2~5 + 석탄 알갱이
# 경계: 보도(벽돌)·광장(판석)이 차도보다 한 단 높다 → 차도 쪽 가장자리 2px 회색 연석(윗모 5 · 앞 2).
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from sc_base import *
from sc_base import _hash
import ec_ground as EG

SO = A(SOOT); BK = A(RAMP['brk']); GS = A(GST); CL = A(COAL); STL = A(STEEL); CN = A(CONC)


def cob_k(X, Y, seed=5):
    t = chip_tones_lin(208, 160, 2.5, 4.9)
    T = t[Y % 16, X % 16].astype(int)
    hi = (T >= 5) & (hash2(X, Y, seed + 3) > .9)                          # 젖은 돌 윗면 빛 점(성글게)
    T = np.where(hi, 6, T)
    return np.clip(T, 1, 6)


def walk_k(X, Y, seed=7):
    """바구니 짜임 벽돌 보도: 8x8 블록마다 가로 벽돌 둘 / 세로 벽돌 둘을 번갈아(바닥으로 읽히게 — 벽 줄쌓기와 다르다).
    벽돌 8x4, 줄눈 1px 톤 1, 벽돌 톤 3(드문 2·4), 위·왼 모 +1, 아래 모 −1."""
    bx = X // 8; by = Y // 8; lx = X % 8; ly = Y % 8
    horiz = (bx + by) % 2 == 0
    u = np.where(horiz, lx, ly); v = np.where(horiz, ly, lx)           # u = 벽돌 길이 방향, v = 폭 방향(0~7 = 벽돌 둘)
    sub = v // 4; vv = v % 4
    mort = (vv == 3) | (u == 7)
    h = hash2(bx * 2 + sub, by * 2 + sub, seed)
    T = np.where(h > .85, 5, np.where(h < .12, 3, 4))
    T = np.where(((vv == 0) | (u == 0)) & ~mort, T + 1, T)
    T = np.where((vv == 2) & ~mort, T - 1, T)
    T = np.where(mort, 2, T)
    T = np.where(~mort & (hash2(X, Y, seed + 2) > .96), T - 1, T)
    return np.clip(T, 1, 6)


def plaza_k(X, Y, seed=3, per=None, sl=None):
    """광장 판석: 높이 16px 줄마다 판 폭 24/32/40 을 섞어 엇갈려 깐다(줄마다 시작 위치를 옮김 — 정사각 격자로 안 보인다).
    판 안 결 = 칩셋 모래흙(64,224) 톤 3~5, 줄눈 1px 톤 1(아래·오른), 판 위·왼 모 +1, 드문 금. per = 표본 주기(48)."""
    t = chip_tones_lin(64, 224, 2.7, 4.4)
    row = Y // 16; ly = Y % 16
    XX = X % per if per else X
    if per:                                                                 # 표본: 48 주기 안에서 폭 24·24 / 16·32 를 줄마다
        w = np.where(row % 3 == 0, 24, np.where(row % 3 == 1, 16, 32))
        lx = XX % w
        col = XX // w
    else:
        off = (hash2(row, 0, seed) * 40).astype(int)
        w = np.where(hash2(row, 1, seed) < .5, 32, 40)
        lx = (X + off) % w; col = (X + off) // w
    ox = (hash2(col, row, seed) * 16).astype(int)
    T = t[(Y + ox) % 16, (X + ox * 3) % 16].astype(int)
    e = (lx == w - 1) | (ly == 15)
    T = np.where(e, 1, T)
    T = np.where(((lx == 0) | (ly == 0)) & ~e, np.minimum(T + 1, 6), T)
    T = np.where(hash2(col, row, seed + 5) < .1, T - 1, T)
    return np.clip(T, 1, 6)


def cinder_k(X, Y, seed=9):
    t = chip_tones_lin(16, 224, 2.4, 4.4)
    T = t[Y % 16, X % 16].astype(int)
    lump = (hash2(X // 2, Y // 2, seed + 4) > .93)                         # 석탄 알갱이(2px, 윗왼 빛)
    T = np.where(lump & (X % 2 == 0) & (Y % 2 == 0), 5, np.where(lump, 1, T))
    return np.clip(T, 1, 6)


def plate_rgb(Wp, Hp, seed=11):
    tc = TC(Wp, Hp, seed)
    panels(tc, 0, 0, Wp, Hp, 'steel', 2, 32, 16, stagger=True, face='top', seed=seed, vary=0, joint=1)
    tc.t = np.where(tc.t >= 3, tc.t - 1, tc.t)                           # 검은 무쇠 판(규격: steel 톤 0~3 중심)
    Y, X = np.mgrid[0:Hp, 0:Wp]
    gr = (hash2(X // 16, Y // 16 * 3 + X // 32, seed + 3) < .06) & ((X % 16) > 3) & ((X % 16) < 12) & ((Y % 16) > 3) & ((Y % 16) < 12)
    tc.t = np.where(gr & ((Y % 3) == 0), 0, tc.t)                         # 배수 창살 판(16 판 여섯에 하나)
    tc.t = np.where(gr & ((Y % 3) == 1), 1, tc.t)
    tc.grain(.03)
    return np.array(tc.img())[..., :3]


# ---------------------------------------------------------------- 바닥 표본 3x3칸(48x48, 결 주기 16 → 이음새 없음)
def _sample(T, ramp): return Image.fromarray(ramp[T], 'RGB').convert('RGBA')
def _g(): Y, X = np.mgrid[0:48, 0:48]; return X, Y
def ground_wet_cobble(seed=5): X, Y = _g(); return _sample(cob_k(X, Y, seed), SO)
def ground_brick_walk(seed=7): X, Y = _g(); return _sample(walk_k(X, Y, seed), BK)
def ground_plaza_flag(seed=3): X, Y = _g(); return _sample(plaza_k(X, Y, seed, per=48), GS)
def ground_iron_plate(seed=11): return Image.fromarray(plate_rgb(48, 48, seed), 'RGB').convert('RGBA')
def ground_cinder_yard(seed=9): X, Y = _g(); return _sample(cinder_k(X, Y, seed), CN)


def ground_curb_edge(seed=5):
    """연석 표본(3x3): 위 2칸 = 벽돌 보도, 아래 1칸 = 젖은 자갈, 경계에 회색 연석 2px — 보도와 차도를 잇는 법을 보여 준다."""
    X, Y = _g()
    a = BK[walk_k(X, Y, 7)]; b = SO[cob_k(X, Y, 5)]
    out = np.where((Y < 32)[..., None], a, b)
    out = np.where((Y == 30)[..., None], GS[5], out); out = np.where((Y == 31)[..., None], GS[2], out)
    out = np.where(((Y == 30) & (X % 12 == 11))[..., None], GS[3], out)
    out = np.where((Y == 32)[..., None], (b * .7).astype(np.uint8), out)
    return Image.fromarray(out.astype(np.uint8), 'RGB').convert('RGBA')


# ---------------------------------------------------------------- 지도 바닥 합성
LAYERS = ('cob', 'walk', 'plaza', 'plate', 'cinder')
RAISED = ('walk', 'plaza')


def compose(W, H, M, seed=4):
    """M[key] = 칸 마스크. 칠 순서 = 맨 바탕(차도 자갈) → 보도·광장·철판·재. 보도·광장 가장자리(차도 쪽)에 연석."""
    Wp, Hp = W * 16, H * 16
    K = lambda m: np.kron(m, np.ones((16, 16))).astype(bool)
    Y, X = np.mgrid[0:Hp, 0:Wp]
    out = SO[cob_k(X, Y, seed + 5)].astype(int)
    fns = {'walk': lambda: BK[walk_k(X, Y, seed + 7)], 'plaza': lambda: GS[plaza_k(X, Y, seed + 3)],
           'plate': lambda: plate_rgb(Wp, Hp, seed + 11), 'cinder': lambda: CN[cinder_k(X, Y, seed + 9)]}
    for key in ('cinder', 'plate', 'walk', 'plaza'):
        km = K(M[key])
        if km.any(): out = np.where(km[..., None], fns[key]().astype(int), out)
    raised = K(M['walk'] | M['plaza'])
    low = ~raised
    # 연석: 높은 면의 가장자리 2px(윗모 밝음 · 앞모 어둠), 남쪽 끝은 3/4 로 앞면이 한 줄 더 보인다
    e1 = raised & ~ndi.binary_erosion(raised, iterations=1, border_value=1)
    e2 = raised & ~ndi.binary_erosion(raised, iterations=2, border_value=1) & ~e1
    out = np.where(e2[..., None], GS[5].astype(int), out)
    out = np.where(e1[..., None], GS[3].astype(int), out)
    south = raised & ~np.roll(raised, -1, 0)
    out = np.where(south[..., None], GS[2].astype(int), out)
    joint = (e1 | e2) & ((X % 12 == 11) | (Y % 12 == 11))
    out = np.where(joint[..., None], GS[2].astype(int), out)
    sh = low & np.roll(raised, 1, 0)                                       # 연석 아래 그늘(차도)
    out = np.where(sh[..., None], (out * .68).astype(int), out)
    # 철판·재 가장자리(같은 높이): 1px 어두운 이음
    for key in ('plate', 'cinder'):
        km = K(M[key]); ed = km & ~ndi.binary_erosion(km, iterations=1, border_value=1)
        out = np.where(ed[..., None], (out * .75).astype(int), out)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
