# 미래 폐허 — 기계 재질 그리기 규약(톤 캔버스). 그림을 「재질 번호 + 톤(0~6)」 두 장으로 칠한 뒤 램프로 색을 입힌다.
# 이렇게 하면 녹 번짐은 「같은 톤, 재질만 강철 → 녹」으로 바뀌어 판 줄눈·리벳 명암이 녹 밑에서도 그대로 남는다.
# 규약(plan.md 「기계 재질 규약」):
#   판 줄눈  : 판 아래·오른쪽 가장자리 1px = 톤 1(어두운 홈), 위·왼쪽 가장자리 1px = 톤 +1(빛 받은 모). 빛은 왼쪽 위.
#   리벳     : 판 모서리에서 2px 안, 긴 변은 6px 간격. 리벳 = 톤 6 한 점 + 오른쪽 아래 톤 1 한 점(그림자).
#   녹       : 줄눈·리벳·아래 가장자리에서 시작해 아래로 흘러내린다(세로 줄 2~6px). 넓게 번진 곳은 녹 램프, 가장자리는 디더.
#   관       : 원통 6단 음영(위 1/4 지점 톤 6 빛줄 → 아래 톤 1), 이음 테는 지름 + 2px, 테 왼쪽 1px 빛.
#   전선     : 2px, 윗줄 톤 3, 아랫줄 톤 1, 처짐은 포물선.
#   유리     : 위로 갈수록 밝은 하늘 반사 + 왼쪽 위 → 오른쪽 아래 45° 빛줄(톤 6, 1~2px). 깨진 칸은 들쭉날쭉 조각 + 속 어둠.
import math
import numpy as np
from PIL import Image
from fr_base import *
from fr_base import _hash, vnoise

MATS = ['none', 'steel', 'rust', 'brass', 'conc', 'asph', 'glass', 'cable', 'warn', 'tox', 'sick', 'stone', 'wood', 'red',
        'cyan', 'redl', 'amber', 'leaf', 'dark', 'plaster', 'paint', 'drab']
DRAB = [hx(c) for c in ('#14120c', '#2c2818', '#464028', '#625a38', '#7e764a', '#9c9462', '#bcb486')]    # 바랜 국방 황토 도장(로봇 장갑)
PAINT = [hx(c) for c in ('#1a0c10', '#3a1a1e', '#5a2a28', '#7a3c32', '#985244', '#b06c58', '#c88c74')]   # 바랜 붉은 도장(컨테이너·기계)
LEAF7 = [hx('#071528')] + [hx(c) for c in __import__('palette').RAMPS_CHIP['leaf']]
DARK7 = [(8, 6, 12), (12, 10, 18), (18, 16, 26), (26, 22, 36), (34, 30, 46), (44, 40, 58), (56, 52, 72)]
RAMP_OF = {'steel': STEEL, 'rust': RUST, 'brass': BRASS, 'conc': CONC, 'asph': ASPH, 'glass': GLASS, 'cable': CABLE,
           'warn': WARN, 'tox': TOX, 'sick': SICK, 'stone': ST, 'wood': WD, 'red': RD, 'cyan': SIGNAL['cyan'],
           'redl': SIGNAL['red'], 'amber': SIGNAL['amber'], 'leaf': LEAF7, 'dark': DARK7, 'plaster': PL, 'paint': PAINT, 'drab': DRAB}
MID = {n: i for i, n in enumerate(MATS)}
LUT = np.zeros((len(MATS), 7, 3), np.uint8)
for n, i in MID.items():
    if n in RAMP_OF:
        r = RAMP_OF[n]
        for k in range(7): LUT[i, k] = r[min(k, len(r) - 1)]


class TC:
    """톤 캔버스: m[y,x] 재질 번호(0 = 비었음), t[y,x] 톤 0..6, a[y,x] 알파(유리·김)."""
    def __init__(s, w, h, seed=0):
        s.w, s.h, s.seed = w, h, seed
        s.m = np.zeros((h, w), np.int16); s.t = np.zeros((h, w), np.int16); s.a = np.full((h, w), 255, np.int16)
    def inb(s, x, y): return 0 <= x < s.w and 0 <= y < s.h
    def px(s, x, y, mat, k, a=255):
        x, y = int(x), int(y)
        if s.inb(x, y): s.m[y, x] = MID[mat]; s.t[y, x] = max(0, min(6, int(k))); s.a[y, x] = a
    def get(s, x, y):
        if not s.inb(x, y) or s.m[y, x] == 0: return None
        return MATS[s.m[y, x]], int(s.t[y, x])
    def shift(s, x, y, d):
        if s.inb(x, y) and s.m[y, x]: s.t[y, x] = max(0, min(6, s.t[y, x] + d))
    def rect(s, x0, y0, x1, y1, mat, k):
        for y in range(int(y0), int(y1)):
            for x in range(int(x0), int(x1)): s.px(x, y, mat, k(x, y) if callable(k) else k)
    def hline(s, x0, x1, y, mat, k):
        for x in range(int(x0), int(x1)): s.px(x, y, mat, k)
    def vline(s, x, y0, y1, mat, k):
        for y in range(int(y0), int(y1)): s.px(x, y, mat, k)
    def line(s, x0, y0, x1, y1, mat, k, w=1):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n):
            f = i / max(1, n - 1); x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f
            for j in range(w): s.px(round(x), round(y) + j, mat, k)
    def poly(s, pts, mat, k):
        ys = [p[1] for p in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            xs = []; n = len(pts)
            for i in range(n):
                (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % n]
                if (y1 <= y + .5 < y2) or (y2 <= y + .5 < y1): xs.append(x1 + (y + .5 - y1) * (x2 - x1) / (y2 - y1))
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                for x in range(int(round(a)), int(round(b))): s.px(x, y, mat, k(x, y) if callable(k) else k)
    def ell(s, cx, cy, rx, ry, mat, k):
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: s.px(x, y, mat, k(x, y) if callable(k) else k)
    def grain(s, p=.06, seed=None, mats=None):
        sd = s.seed if seed is None else seed
        Y, X = np.mgrid[0:s.h, 0:s.w]
        h = hash2(X, Y, sd + 77); h2 = hash2(Y, X, sd + 78)
        sel = (s.m > 0) & (h < p) & (s.t > 0)
        if mats is not None: sel &= np.isin(s.m, [MID[m] for m in mats])
        s.t = np.where(sel, np.clip(s.t + np.where(h2 < .5, 1, -1), 1, 6), s.t)
    def img(s):
        rgb = LUT[s.m, np.clip(s.t, 0, 6)]
        al = np.where(s.m > 0, np.clip(s.a, 0, 255), 0).astype(np.uint8)
        return Image.fromarray(np.dstack([rgb, al]), 'RGBA')
    def fin(s, k=.6, shadow=None):
        im = pz.fin(s.img(), k)
        if shadow: im = shadow_under(im, *shadow)
        return im
    def paste(s, o, ox, oy):
        """다른 톤 캔버스를 겹친다(비지 않은 화소만)."""
        for y in range(o.h):
            for x in range(o.w):
                if o.m[y, x] and s.inb(ox + x, oy + y):
                    s.m[oy + y, ox + x] = o.m[y, x]; s.t[oy + y, ox + x] = o.t[y, x]; s.a[oy + y, ox + x] = o.a[y, x]


# ================================================================ 강철판 (줄눈·리벳 규약)
def panels(tc, x0, y0, x1, y1, mat='steel', base=4, pw=16, ph=16, stagger=False, rivets=True, face='front', seed=0,
           vary=1, ox=0, oy=0, joint=1):
    """사각 영역을 강철판으로. face='front' = 앞면(왼쪽 밝고 오른쪽·아래로 한 단 어두움), 'top' = 윗면(한 단 밝음).
    판마다 톤이 ±vary 흔들린다. 판 줄눈: 아래·오른쪽 1px 톤 joint, 위·왼쪽 1px +1."""
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            X = x - x0 + ox; Y = y - y0 + oy
            row = Y // ph; off = (row % 2) * (pw // 2) if stagger else 0
            col = (X + off) // pw; lx = (X + off) % pw; ly = Y % ph
            h = _hash(col, row, seed + 11)
            k = base + (1 if face == 'top' else 0) + (int(round((h - .5) * 2 * vary)) if vary else 0)
            if face == 'front':
                if x >= x1 - 2: k -= 1
                if y >= y1 - 2: k -= 1
            if ly == ph - 1 or lx == pw - 1: k = joint
            elif ly == 0 or lx == 0: k += 1
            elif ly == ph - 2 or lx == pw - 2: k -= 1
            tc.px(x, y, mat, clamp(k, 0, 6))
            if rivets and pw >= 8 and ph >= 8:
                rx = lx in (RIVET_INSET, pw - 1 - RIVET_INSET) or (pw > 20 and lx % RIVET_STEP == RIVET_INSET and lx < pw - 3)
                ry = ly in (RIVET_INSET, ph - 1 - RIVET_INSET) or (ph > 20 and ly % RIVET_STEP == RIVET_INSET and ly < ph - 3)
                on_edge = (lx in (RIVET_INSET, pw - 1 - RIVET_INSET) and ry) or (ly in (RIVET_INSET, ph - 1 - RIVET_INSET) and rx)
                if on_edge: tc.px(x, y, mat, 6)
                elif (lx - 1 in (RIVET_INSET, pw - 1 - RIVET_INSET) and (ly - 1 in (RIVET_INSET, ph - 1 - RIVET_INSET))):
                    tc.px(x, y, mat, 1)


def rustify(tc, x0, y0, x1, y1, amount=.4, seed=0, streak=True, mats=('steel',), keep_rivets=True):
    """녹 번짐: 줄눈(톤≤1)·리벳 그림자·아래 가장자리에서 시작해 잡음 덩이로 넓어지고, 아래로 흘러내린다.
    amount 0..1. 재질만 바꾸고 톤은 지킨다(줄눈·리벳 명암이 녹 밑에서도 보인다)."""
    W, H = tc.w, tc.h
    Y, X = np.mgrid[0:H, 0:W]
    reg = (X >= x0) & (X < x1) & (Y >= y0) & (Y < y1) & np.isin(tc.m, [MID[m] for m in mats])
    if not reg.any(): return
    src = reg & (tc.t <= 1)
    d = ndi.distance_transform_edt(~src) if src.any() else np.full((H, W), 99.)
    n = smooth(W, H, 5, seed + 3) * .65 + smooth(W, H, 2, seed + 4) * .35
    score = n * 1.15 - d / 6.0 + amount * .75 - .68
    bay = np.tile(np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0, (H // 4 + 1, W // 4 + 1))[:H, :W]
    full = reg & (score > .18)
    edge = reg & (score > .06) & (score <= .18) & (bay < (score - .06) / .12)
    r = full | edge
    if streak:                                                     # 아래로 흘러내린 녹 줄
        col_src = reg & (tc.t <= 1) & (hash2(X, Y, seed + 7) < .22 * (.5 + amount))
        st = np.zeros_like(r)
        for y in range(H):
            if y: st[y] |= st[y - 1] & reg[y] & (hash2(X[y], Y[y], seed + 8) < .86)
            st[y] |= col_src[y]
        r |= st & reg
    if keep_rivets: r &= ~(tc.t == 6)
    tc.m = np.where(r, MID['rust'], tc.m)
    # 진한 녹 딱지: 녹 안쪽 한 단 어둡게 점점이
    dk = r & (hash2(X // 2, Y // 2, seed + 9) > .8)
    tc.t = np.where(dk, np.clip(tc.t - 1, 1, 6), tc.t)


# ================================================================ 관 · 전선
def cyl_k(t):
    """원통 6단(빛 왼쪽 위): t = 단면 위치 0(빛 쪽 끝)..1(그늘 끝)."""
    if t < .12: return 4
    if t < .3: return 6
    if t < .45: return 5
    if t < .62: return 4
    if t < .8: return 3
    if t < .93: return 2
    return 3                                                       # 반사광 한 줄


def pipe_h(tc, x0, x1, cy, dia, mat='steel', step=None, seed=0, flange=True):
    """가로 관: 지름 dia(px), 단면 위→아래로 cyl_k. 이음 테 step px 마다(지름+2, 폭 2~3px)."""
    step = step or (16 if dia <= 8 else 32)
    top = int(round(cy - dia / 2))
    for y in range(top, top + dia):
        k = cyl_k((y - top + .5) / dia)
        for x in range(int(x0), int(x1)): tc.px(x, y, mat, k)
    if flange:
        fw = 2 if dia <= 8 else 3
        for fx in range(int(x0) + step // 2, int(x1) - 1, step):
            for y in range(top - 1, top + dia + 1):
                k = cyl_k((y - top + 1.5) / (dia + 2))
                for i in range(fw): tc.px(fx + i, y, mat, clamp(k + (1 if i == 0 else 0) - (1 if i == fw - 1 else 0), 1, 6))
            if dia > 8:                                            # 볼트 넷(앞에 보이는 둘 + 위아래)
                for by in (top + 1, top + dia - 2):
                    tc.px(fx + 1, by, mat, 6)


def pipe_v(tc, cx, y0, y1, dia, mat='steel', step=None, seed=0, flange=True):
    """세로 관: 단면 왼→오른쪽으로 cyl_k."""
    step = step or (16 if dia <= 8 else 32)
    left = int(round(cx - dia / 2))
    for x in range(left, left + dia):
        k = cyl_k((x - left + .5) / dia)
        for y in range(int(y0), int(y1)): tc.px(x, y, mat, k)
    if flange:
        fw = 2 if dia <= 8 else 3
        for fy in range(int(y0) + step // 2, int(y1) - 1, step):
            for x in range(left - 1, left + dia + 1):
                k = cyl_k((x - left + 1.5) / (dia + 2))
                for i in range(fw): tc.px(x, fy + i, mat, clamp(k + (1 if i == 0 else 0) - (1 if i == fw - 1 else 0), 1, 6))


def cable(tc, x0, y0, x1, y1, sag=6, mat='cable', w=2):
    """처진 전선: 두 점 사이 포물선, 2px(윗줄 톤 3·아랫줄 톤 1)."""
    n = int(abs(x1 - x0)) + int(abs(y1 - y0)) + 1
    last = None
    for i in range(n * 2 + 1):
        f = i / (n * 2)
        x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f + sag * 4 * f * (1 - f)
        p = (int(round(x)), int(round(y)))
        if p == last: continue
        last = p
        tc.px(p[0], p[1], mat, 3)
        for j in range(1, w): tc.px(p[0], p[1] + j, mat, 1)


# ================================================================ 3/4 상자 (윗면 + 앞면)
def box(tc, x0, y0, x1, y1, top, mat, base=4, seed=0, grain=.05, front=None):
    """윗면 top 행(톤 base+1, 왼·위 모 +1) + 앞면(왼쪽 2px +1, 오른쪽 2px -1, 맨 아래 한 줄 톤 1)."""
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            if y < y0 + top:
                k = base + 1 + (1 if (y == y0 or x == x0) else 0)
                if x >= x1 - 1: k -= 1
            else:
                k = base + (1 if x < x0 + 2 else (-1 if x >= x1 - 2 else 0))
                if y == y0 + top: k -= 1
                if y == y1 - 1: k = 1
            if _hash(x, y, seed + 4) < grain: k += 1 if _hash(y, x, seed + 5) < .5 else -1
            tc.px(x, y, front if (front and y >= y0 + top) else mat, clamp(k, 1, 6))


def hazard(tc, x0, y0, x1, y1, seed=0, k=4):
    """경고 띠(바랜 노랑·검정 사선, 폭 4px). 글자 없음."""
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            on = ((x + y) // 4) % 2 == 0
            if on: tc.px(x, y, 'warn', clamp(k + (1 if y == y0 else 0) - (1 if x >= x1 - 2 else 0), 1, 6))
            else: tc.px(x, y, 'cable', clamp(k - 2, 1, 6))
    # 바램·벗겨짐
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            if _hash(x, y, seed + 31) < .12: tc.shift(x, y, -1)


def glass_pane(tc, x0, y0, x1, y1, base=3, broken=False, seed=0, sky=True):
    """유리 칸: 위로 갈수록 밝은 반사 + 45° 빛줄. broken = 가장자리 들쭉날쭉 조각만 남고 속은 어둠."""
    w = x1 - x0; h = y1 - y0
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            u = (x - x0 + .5) / max(1, w); v = (y - y0 + .5) / max(1, h)
            if broken:
                dd = min(u, 1 - u, v, 1 - v)
                if dd > .14 + .16 * _hash(int(u * 5), int(v * 5), seed + 3) + .06 * math.sin((u + v) * 17 + seed):
                    tc.px(x, y, 'dark', 2 + (1 if v < .3 else 0)); continue
            k = base + (1 if v < .35 else 0) - (1 if v > .8 else 0)
            dg = (x - x0) + (y - y0)
            if sky and abs(dg - (w + h) * .42) < 1.0: k = 6
            elif sky and abs(dg - (w + h) * .42 - 3) < .6: k = 5
            tc.px(x, y, 'glass', clamp(k, 1, 6))
