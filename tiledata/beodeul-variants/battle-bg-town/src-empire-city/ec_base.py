# 제국 도시(empire-city) 공용 바탕 — 미래 폐허(future-ruins)의 「기계 재질 규약」(fr_base·fr_mat: 7단 램프, 톤 캔버스 TC,
# 판 줄눈·리벳·관·전선·경고 띠·유리)을 그대로 불러 쓰고, 이 장소에 처음 나오는 재질만 같은 7단 규칙으로 더한다:
#   gst   회색 석재(버들항 밝은 성돌보다 두 단 어둡고 차갑다 — 성채·성벽 아래 단, 받침, 포석)
#   roofb 회청 지붕(성채) — 버들항 칩셋 슬레이트 지붕 타일(256,224)…의 결을 밝기 순위 그대로 회청 램프로 옮긴다
#   roofk 검은 지붕(병영·주택·공장) — 같은 타일 결을 검은 램프로
#   flag  단색 깃발(짙은 진홍). 문장·글자 없음.
#   bronze 동상(검은 청동)
# 버들항 건축 언어(밝은 석재 + 붉은 기와)와 대비: 회청 철판 외벽 + 회색 석재 아래 단 + 검은/회청 지붕.
# 결정적(같은 입력 = 같은 그림). 생성 이미지·트레이싱 없음. 3/4 시점(윗면 + 앞면, 옆면 없음), 빛 왼쪽 위, 1칸 = 16px.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
FR = os.path.abspath(os.path.join(HERE, '..', '..', 'future-ruins'))
sys.path.insert(0, FR)
import numpy as np
from PIL import Image
import fr_mat
from fr_base import *                                   # noqa  (STEEL·CONC·WARN·SIGNAL·hash2·smooth·tnoise·recolor·Parts …)
from fr_base import _hash, vnoise
from fr_mat import TC, panels, rustify, pipe_h, pipe_v, cable, box, hazard, glass_pane, cyl_k, MID, MATS
import fr_props as FP
import fr_mech as FM


def _r(*cs): return [hx(c) for c in cs]
GST   = _r('#14161c', '#252830', '#373a42', '#4e525a', '#6a6e76', '#8a8e95', '#acb0b4')   # 회색 석재(차가운 회색)
ROOFB = _r('#0c101c', '#161e30', '#202c44', '#2c3c58', '#3b5070', '#52688a', '#7488a8')   # 회청 지붕(성채)
ROOFK = _r('#08080e', '#101119', '#191b25', '#232633', '#2f3342', '#404555', '#596070')   # 검은 지붕(병영·주택)
FLAG  = _r('#1a0610', '#3a0a16', '#5e1220', '#861a26', '#aa262c', '#c6403a', '#de7460')   # 짙은 진홍 단색 깃발
BRONZE = _r('#0e0e12', '#1c1e24', '#2c2f36', '#40444b', '#585d64', '#7a8084', '#a6acaa')  # 검은 청동(동상)
NEW = {'gst': GST, 'roofb': ROOFB, 'roofk': ROOFK, 'flag': FLAG, 'bronze': BRONZE}
for n, r in NEW.items():                                 # fr_mat 톤 캔버스에 재질을 덧붙인다(파일은 건드리지 않는다)
    if n not in fr_mat.MID:
        fr_mat.MATS.append(n); fr_mat.MID[n] = len(fr_mat.MATS) - 1
_lut = np.zeros((len(fr_mat.MATS), 7, 3), np.uint8)
_lut[:fr_mat.LUT.shape[0]] = fr_mat.LUT
for n, r in NEW.items():
    for k in range(7): _lut[fr_mat.MID[n], k] = r[k]
fr_mat.LUT = _lut
RAMP = dict(fr_mat.RAMP_OF); RAMP.update(NEW)


def rgb_of(mat, k): return RAMP[mat][max(0, min(6, int(k)))]


# ================================================================ 칩셋 결 → 톤 배열 (밝기 순위 보존)
_TT = {}
def chip_tones(tx, ty, lo, hi):
    key = (tx, ty, lo, hi)
    if key not in _TT:
        _, t = recolor(chip_tex(tx, ty), STEEL, lo, hi); _TT[key] = t.astype(int)
    return _TT[key]


def chip_tones_lin(tx, ty, lo, hi):
    """밝기를 선형으로 옮긴다(순위가 아니라 값 — 밝은 판석은 밝게 남고 줄눈만 어둡다)."""
    key = ('lin', tx, ty, lo, hi)
    if key not in _TT:
        l = lum(chip_tex(tx, ty).astype(np.float64)); a, b = l.min(), l.max()
        _TT[key] = np.clip(np.rint(lo + (l - a) / max(1, b - a) * (hi - lo)), 0, 6).astype(int)
    return _TT[key]


# ================================================================ 석재 (회색 마름돌 — castle6.ash 와 같은 규칙을 톤으로)
def ashlar_k(X, Y, bw=16, bh=8, seed=0, base=4):
    """마름돌 줄쌓기 톤: 줄눈 1px(톤 2), 돌마다 기본 톤(4·4·5 섞임), 위·왼 모 +1, 아래·오른 모 −1, 칩셋 결(드문 −1)."""
    row = Y // bh; ly = Y % bh; off = (row % 2) * (bw // 2); col = (X + off) // bw; lx = (X + off) % bw
    if ly == bh - 1 or lx == bw - 1: return 2
    h = _hash(col, row, seed + 41)
    k = base + (1 if h > .8 else 0) - (1 if h < .08 else 0)
    if ly == 0 or lx == 0: k += 1
    elif ly == bh - 2 or lx == bw - 2: k -= 1
    else:
        g = chip_tones(224, 160, 0, 6)[Y % 16, X % 16]
        if g <= 1 and _hash(X, Y, seed + 42) < .5: k -= 1
    return clamp(k, 1, 6)


def stone_face(tc, x0, y0, x1, y1, bw=16, bh=8, seed=0, base=4, mat='gst', shade_r=True):
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            k = ashlar_k(x - x0, y - y0, bw, bh, seed, base)
            if shade_r and x >= x1 - 2: k -= 1
            if x < x0 + 1: k += 1
            tc.px(x, y, mat, clamp(k, 1, 6))


def plinth(tc, x0, x1, y0, h=6, mat='gst', seed=0):
    """비스듬한 받침 띠(앞면 맨 아래): 위 모 5, 몸 4·3, 맨 아래 2·1."""
    for j in range(h):
        y = y0 + j
        for x in range(int(x0), int(x1)):
            k = (5, 4, 4, 3, 3, 2, 2, 1)[min(7, j)] if j < h - 1 else 1
            if x < x0 + 1: k += 1
            if x >= x1 - 2: k -= 1
            if j > 0 and j < h - 1 and ((x - x0) // 12 + (1 if j > 2 else 0)) % 2 == 0 and (x - x0) % 12 == 11: k = 2
            tc.px(x, y, mat, clamp(k, 1, 6))


def string_course(tc, x0, x1, y, mat='gst'):
    """층 띠(돌림 띠): 위 6 · 5 · 아래 2 (3px)."""
    for x in range(int(x0), int(x1)):
        tc.px(x, y, mat, 6 if x > x0 else 5); tc.px(x, y + 1, mat, 4); tc.px(x, y + 2, mat, 2)


def iron_face(tc, x0, y0, x1, y1, seed=0, base=3, pw=32, ph=16, rust=0.0, oy=0):
    """회청 철판 외벽(앞면): 32x16 판 엇갈림, 리벳, 오른쪽·아래 그늘. rust 는 아주 조금(쓰는 도시)."""
    panels(tc, x0, y0, x1, y1, 'steel', base, pw, ph, stagger=True, rivets=True, face='front', seed=seed, vary=1, oy=oy)
    if rust: rustify(tc, x0, y0, x1, y1, amount=rust, seed=seed + 3)


def window(tc, x0, y0, w=6, h=10, lit=False, seed=0, shutter=False):
    """사각 창(군사 도시: 아치 없음): 강철 틀(왼 빛 5·오른 2), 어두운 유리(위 2 · 아래 3) + 왼쪽 위 청록 반짝,
    아래 돌 창턱. lit = 안에 불(호박색). shutter = 철 덧문 반쯤 내림."""
    for y in range(y0 - 1, y0 + h + 1):
        for x in range(x0 - 1, x0 + w + 1):
            if x0 <= x < x0 + w and y0 <= y < y0 + h:
                if lit: tc.px(x, y, 'amber', 4 if y < y0 + h // 2 else 3)
                else: tc.px(x, y, 'glass', 2 if y < y0 + h * .45 else 1)
            else:
                tc.px(x, y, 'steel', 5 if (x < x0 or y < y0) else 2)
    if not lit:
        tc.px(x0, y0 + 1, 'glass', 5); tc.px(x0 + 1, y0 + 1, 'glass', 4); tc.px(x0, y0 + 2, 'glass', 4)
    else:
        tc.px(x0, y0, 'amber', 6); tc.px(x0 + 1, y0, 'amber', 5)
    if w >= 6:
        for y in range(y0, y0 + h): tc.px(x0 + w // 2, y, 'steel', 2)                     # 가운데 창살
    if shutter:
        sh = h // 2 + int(_hash(x0, y0, seed) * 2)
        for y in range(y0, y0 + sh):
            for x in range(x0, x0 + w): tc.px(x, y, 'steel', 4 if (y - y0) % 2 == 0 else 2)
    for x in range(x0 - 2, x0 + w + 2): tc.px(x, y0 + h + 1, 'gst', 6 if x < x0 + w // 2 else 4); tc.px(x, y0 + h + 2, 'gst', 2)


def slit(tc, x, y0, h=9):
    """화살 틈 대신 총안 틈(세로 2px 어둠 + 가로 짧은 홈)."""
    for y in range(y0, y0 + h): tc.px(x, y, 'dark', 1); tc.px(x + 1, y, 'dark', 2)
    for dx in (-1, 2): tc.px(x + dx, y0 + h // 2, 'dark', 2)
    tc.px(x - 1, y0 - 1, 'steel', 5); tc.px(x + 2, y0 + h, 'steel', 2)


# ================================================================ 지붕 (칩셋 슬레이트 결 → 회청/검은 램프)
def roof_hip(tc, x0, y0, W, H, mat='roofk', ends=True, yb=.45, e=None, cap='steel'):
    """급경사 모임지붕(ph2.steep_hip 과 같은 기하): 뒤 경사(빛) · 앞 경사(그늘) · 양 끝 삼각(서 빛 · 동 그늘).
    지붕 결은 버들항 칩셋 슬레이트 타일(앞 272,224 · 뒤 256,240)을 밝기 순위대로 옮긴 톤. 마룻대·추녀는 강철 덮개(cap)."""
    e = e if e is not None else min(W // 3, int(H * .9))
    el = e if ends in (True, 'L', 'LR') else 0; er = e if ends in (True, 'R', 'LR') else 0
    tf = chip_tones(272, 224, 1, 4); tb = chip_tones(256, 240, 3, 6)
    YB = H * yb
    for y in range(H):
        xl = el * (1 - (y + .5) / H); xr = W - er * (1 - (y + .5) / H)
        for x in range(W):
            xx = x + .5
            if el and xx < el and y < YB * (1 - xx / el): continue
            if er and xx > W - er and y < YB * (1 - (W - xx) / er): continue
            if xx < xl:   k = tf[x % 16, y % 16] + 1; m = mat                              # 서 끝(결은 세로로 돈다)
            elif xx > xr: k = tf[x % 16, y % 16] - 1; m = mat
            elif y < YB:  k = tb[y % 16, x % 16]; m = mat                                     # 뒤 경사(빛)
            else:         k = tf[y % 16, x % 16] - (1 if y > H - 4 else 0); m = mat          # 앞 경사(그늘)
            if el and xx < el and abs(y - YB * (1 - xx / el)) < 1: m, k = cap, 5
            if er and xx > W - er and abs(y - YB * (1 - (W - xx) / er)) < 1: m, k = cap, 2
            if el and abs(xx - xl) < 1 and y > 0: m, k = cap, 5
            if er and abs(xx - xr) < 1 and y > 0: m, k = cap, 1
            if abs(y + .5 - YB) < 1 and xl < xx < xr: m, k = cap, 4                            # 마룻대
            if y < 2 and xl <= xx <= xr: m, k = cap, (6 if y == 0 else 3)
            if not el and x < 2: m, k = cap, (5 if x == 1 else 1)
            if not er and x >= W - 2: m, k = cap, (2 if x == W - 2 else 1)
            tc.px(x0 + x, y0 + y, m, clamp(k, 1, 6))
    for x in range(W):                                                                         # 처마 끝(앞 아래 2px 그늘)
        if tc.get(x0 + x, y0 + H - 1): tc.px(x0 + x, y0 + H - 1, mat, 1)


def roof_pyramid(tc, x0, y0, W, H, mat='roofk', cap='steel'):
    """뾰족 네모 지붕(탑): 꼭짓점 하나에서 네 면 — 왼 면 빛, 앞 면 중간, 오른 면 그늘. 결은 칩셋 슬레이트."""
    tf = chip_tones(272, 224, 1, 4)
    cx = W / 2.0
    for y in range(H):
        f = (y + 1) / H
        half = (W / 2.0) * f; inner = (W / 2.0) * .62 * f        # 앞 면 삼각(꼭짓점 → 아래 두 모 안쪽)
        for x in range(W):
            d = x + .5 - cx
            if abs(d) > half: continue
            k = tf[y % 16, x % 16]
            if abs(d) > inner: k += (1 if d < 0 else -1)          # 옆 면 띠: 서 빛 · 동 그늘
            m = mat
            if abs(abs(d) - inner) < .8 and y > 1: m, k = cap, (5 if d < 0 else 2)     # 추녀마루(강철 덮개)
            if abs(abs(d) - half) < 1: m, k = cap, (5 if d < 0 else 1)
            tc.px(x0 + x, y0 + y, m, clamp(k, 1, 6))
    for x in range(W):
        if tc.get(x0 + x, y0 + H - 1): tc.px(x0 + x, y0 + H - 1, mat, 1)


def chimney(tc, x0, y0, w=8, h=14, mat='gst'):
    """굴뚝: 갓 윗면(밝음) + 앞면 마름돌 + 쇠 테 + 어두운 연통 구멍."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if y < y0 + 3: k = 6 if y == y0 else 5; m = 'steel'
            elif y == y0 + 3: k = 2; m = 'steel'
            else: k = ashlar_k(x - x0, y - y0, 8, 5, x0, 4); m = mat
            if x == x0 + w - 1 and y > y0 + 3: k -= 1
            tc.px(x, y, m, clamp(k, 1, 6))
    for x in range(x0 + 2, x0 + w - 2): tc.px(x, y0 + 1, 'dark', 1)


def flag_pennant(tc, x, y, w=10, h=6, wave=0):
    """단색 삼각 깃발(문장 없음): 깃대 끝 x,y 에서 오른쪽으로 날린다."""
    for j in range(h):
        L = int(w * (1 - j / h * .55))
        for i in range(L):
            yy = y + j + int(round(math.sin((i + wave) / 3.0) * 1.0))
            k = 5 if j < 2 else (4 if j < h - 2 else 3)
            if i > L - 3: k -= 1
            tc.px(x + 1 + i, yy, 'flag', k)


def flag_banner(tc, x0, y0, w=8, h=20, seed=0):
    """벽에 늘어뜨린 단색 걸개(진홍, 문장 없음): 쇠 막대 + 천 + 아래 갈매기 끝. 가운데 한 줄 밝은 결."""
    for x in range(x0 - 1, x0 + w + 1): tc.px(x, y0, 'steel', 6 if x < x0 + w // 2 else 3); tc.px(x, y0 + 1, 'steel', 2)
    for y in range(y0 + 2, y0 + h):
        for x in range(x0, x0 + w):
            dd = abs(x + .5 - (x0 + w / 2.0))
            if y > y0 + h - 4 and (y - (y0 + h - 4)) > (w / 2.0 - dd) * 1.2 - .5: continue      # 갈매기 끝
            k = 4 if x < x0 + 2 else (3 if x < x0 + w - 2 else 2)
            if x == x0 + 1: k = 5
            if y == y0 + 2: k = 2
            tc.px(x, y, 'flag', k)
    for y in range(y0 + 4, y0 + h - 4, 1):                      # 가장자리 테(어두운 단)
        tc.px(x0 + 2, y, 'flag', 3); tc.px(x0 + w - 3, y, 'flag', 3)


def steam(w=16, h=14, seed=0, a=150): return FP.steam_puff(w, h, seed, a)


def smoke(w=20, h=26, seed=0, a=170):
    """굴뚝 연기(공장): 김보다 짙은 회갈색 덩이, 위로 갈수록 옅고 넓다."""
    o = new(w, h); p = o.load()
    for y in range(h):
        f = 1 - y / h
        for x in range(w):
            cx = w / 2 + math.sin(y / 5.0 + seed) * 2.5 * f
            r = 3 + f * (w / 2 - 3)
            d = vnoise(x, y, 3.2, seed + 7) * .55 + (1 - abs(x + .5 - cx) / max(1, r)) * .6
            if d > .62:
                k = 4 if d > .9 else (3 if d > .75 else 2)
                c = GST[k]
                p[x, y] = c[:3] + (int(a * (.35 + .65 * (y / h))),)
    return o


def put_img(dst, src, x, y): dst.alpha_composite(src, (int(x), int(y)))


def tc_over(tc, im, x, y):
    """완성된 RGBA 그림을 톤 캔버스 결과 위에 얹을 때 쓰도록 (톤 캔버스 → 그림 후에)."""
    o = tc if isinstance(tc, Image.Image) else tc.img()
    o.alpha_composite(im, (int(x), int(y))); return o
