# 유령 열차 — 오토타일 3종(철로·안개·플랫폼)과 바닥 표본(자갈·플랫폼 널·객차 바닥).
# 칸 번호 = 위 N 1 + 오른쪽 E 2 + 아래 S 4 + 왼쪽 W 8 (0..15, 왼쪽 위 칸이 0, 가로 4칸씩).
# 철로: 투명 바탕 위에 자갈 도상(가장자리 들쭉날쭉) · 침목(버들항 나무 램프 + 칩셋 널 결) · 레일(강철 머리 1px + 옆면 1px + 그림자 1px).
#   곧은 길(5·10), 곡선(3·6·9·12 — 칸 모서리를 중심으로 한 4분원), 갈래(7·11·13·14 — 곧은 길 + 곡선 한 가닥), 교차(15), 끝(1·2·4·8), 토막(0).
#   침목은 8px 마다 4px(윗면 3 + 그늘 1), 곡선은 방사 방향. 패턴이 길이 방향으로 대칭이라 어느 쪽에서 이어 붙여도 이음이 맞는다.
import math
import numpy as np
from gt_base import *

N_, E_, S_, W_ = 1, 2, 4, 8
BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0

def _pn16(i, seed):
    """주기 16 1차원 값 잡음 0..1(격자 4)."""
    g = 4; f = (i % 16) / 4.0; i0 = int(f); t = f - i0; t = t * t * (3 - 2 * t)
    a = _hash(i0 % g, 0, seed); b = _hash((i0 + 1) % g, 0, seed)
    return a * (1 - t) + b * t

# ---------------------------------------------------------------- 철로 한 칸
def _segments(m):
    """칸 번호 → 선로 중심선 조각 목록. 조각 = (종류, 매개변수)."""
    N, E, S, W = bool(m & 1), bool(m & 2), bool(m & 4), bool(m & 8)
    segs = []
    n = N + E + S + W
    if n == 0: return [('stub', None)]
    if n == 1:
        side = 'N' if N else 'E' if E else 'S' if S else 'W'
        return [('end', side)]
    if n == 4: return [('h', None), ('v', None)]
    if n == 2:
        if E and W: return [('h', None)]
        if N and S: return [('v', None)]
        c = (16 if E else 0, 16 if S else 0)                       # 곡선: 두 끝 가장자리가 만나는 모서리를 중심으로
        return [('arc', c)]
    # 갈래(3 이웃): 곧은 길 + 남은 쪽으로 휘어 드는 곡선 한 가닥
    if not N: return [('h', None), ('arc', (16, 16))]             # 14: E S W  → 동쪽에서 남쪽으로 갈라짐
    if not S: return [('h', None), ('arc', (16, 0))]              # 11: N E W  → 동쪽에서 북쪽으로
    if not W: return [('v', None), ('arc', (16, 0))]              # 7 : N E S  → 북쪽에서 동쪽으로
    return [('v', None), ('arc', (0, 0))]                         # 13: N S W  → 북쪽에서 서쪽으로

def _seg_coord(seg, x, y):
    """(across, along, inside) — across = 중심선에서 잰 가로 거리(px), along = 길이 방향 위치(침목 위상)."""
    k, p = seg
    X, Y = x + .5, y + .5
    if k == 'h': return Y - 8, X, True
    if k == 'v': return X - 8, Y, True
    if k == 'arc':
        cx, cy = p
        d = math.hypot(X - cx, Y - cy)
        th = math.atan2(abs(Y - cy), abs(X - cx))                  # 0 = 가로 끝 쪽, pi/2 = 세로 끝 쪽
        return 8 - d, th / (math.pi / 2) * 16, True
    if k == 'end':
        if p in ('E', 'W'):
            a = X if p == 'E' else 16 - X                           # 이어진 가장자리에서 잰 거리 = 16 - a
            return Y - 8, X, (16 - a) <= 11.5 if p == 'E' else X <= 11.5
        a = Y
        return X - 8, Y, (16 - Y) <= 11.5 if p == 'S' else Y <= 11.5
    if k == 'stub':
        return Y - 8, X, 2.5 <= X <= 13.5
    return 99, 0, False

def _end_len(seg, x, y):
    """끝 조각에서 이어진 가장자리로부터의 거리(px). 다른 조각은 None."""
    k, p = seg
    X, Y = x + .5, y + .5
    if k == 'end':
        return {'E': 16 - X, 'W': X, 'S': 16 - Y, 'N': Y}[p]
    if k == 'stub':
        return min(X - 2.5, 13.5 - X) + 4
    return None

def rail_cell(m, seed=0):
    segs = _segments(m)
    bed = np.zeros((16, 16), bool); slp = np.zeros((16, 16), np.int8); head = np.zeros((16, 16), bool)
    endcap = np.zeros((16, 16), bool)
    for y in range(16):
        for x in range(16):
            for sg in segs:
                ac, al, ok = _seg_coord(sg, x, y)
                el = _end_len(sg, x, y)
                if el is not None:
                    lim = 11.5 if sg[0] == 'end' else 9.0
                    if el > lim: continue
                    ragged = 6.0 + (_pn16(int(al), seed + 7) - .5) * 1.6 - max(0.0, el - (lim - 3.0)) * 1.4
                else:
                    ragged = 6.0 + (_pn16(int(al) if sg[0] != 'arc' else int(al), seed + 3 + (0 if ac < 0 else 1)) - .5) * 2.0
                if abs(ac) <= ragged: bed[y, x] = True
                # 침목: 8px 주기, 길이 방향 대칭(4px: 윗면 3 + 그늘 1)
                ph = al % 8
                rail_end = el is not None and el > (lim - 2.5)
                if abs(ac) <= 5.2 and 2 <= ph < 6 and not (el is not None and el > lim - 1.0):
                    slp[y, x] = 2 if ph >= 5 else 1
                if 2.0 <= abs(ac) < 3.0 and not rail_end:
                    head[y, x] = True
                if 2.0 <= abs(ac) < 3.0 and el is not None and (lim - 2.5) < el <= (lim - 1.5):
                    endcap[y, x] = True
    side = np.zeros_like(head); sh = np.zeros_like(head)
    side[1:, :] |= head[:-1, :]; side[:, 1:] |= head[:, :-1]; side &= ~head
    sh[1:, :] |= side[:-1, :]; sh[:, 1:] |= side[:, :-1]; sh &= ~(head | side)
    im = new(); p = im.load()
    for y in range(16):
        for x in range(16):
            if not bed[y, x] and not slp[y, x] and not head[y, x]: continue
            # 자갈: 2x2 쯤 되는 알갱이, 왼쪽 위 밝고 오른쪽 아래 어두움(틈)
            gx, gy = x + (y // 2) % 2, y
            cell = _hash(gx // 2, gy // 2, seed + 31)
            k = 3 if cell < .45 else (4 if cell < .8 else 2)
            if gx % 2 == 0 and gy % 2 == 0: k += 1
            elif gx % 2 == 1 and gy % 2 == 1: k -= 1
            if _hash(x, y, seed + 33) < .06: k = 5
            c = GRAVEL[clamp(k, 1, 6)]
            # 도상 가장자리 한 단 어둡게(흙에 묻힌 쪽)
            if bed[y, x]:
                edge = any(not (0 <= x + dx < 16 and 0 <= y + dy < 16) or not bed[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if edge and 0 < x < 15 and 0 < y < 15: c = GRAVEL[2]
            if slp[y, x]:
                g = AK.grain((x * 3 + seed) % 48, (y * 5 + seed * 7) % 48) - 3
                t = 4 + (1 if g >= 2 else (-1 if g <= -2 else 0))
                if slp[y, x] == 2: t = 2
                if _hash(x // 3, y // 3, seed + 41) < .18: t -= 1                     # 바랜·썩은 침목
                c = mix(WD[clamp(t, 1, 6)], GRAVEL[3], .18)
            if sh[y, x]: c = mix(c, GRAVEL[1], .55)
            if side[y, x]: c = RUST[2] if _hash(x, y, seed + 51) < .45 else STEEL[2]
            if head[y, x]:
                c = STEEL[5]
                r = _hash(x, y, seed + 53)
                if r < .14: c = STEEL[6]
                elif r > .86: c = RUST[4]
            if endcap[y, x]: c = STEEL[1]
            # 침목 사이에 돋은 잡풀
            if not head[y, x] and not side[y, x] and not slp[y, x] and _hash(x, y, seed + 61) > .975: c = LF[2] if _hash(y, x, seed + 62) < .5 else LF[3]
            p[x, y] = tuple(c) + (255,)
    return im

def rail_sheet(seed=0): return FB.sheet_from_cells([rail_cell(m, seed) for m in range(16)])

# ---------------------------------------------------------------- 안개 번짐(투명 덧그림)
def fog_cell(m, seed=0):
    """안쪽(15) = 고른 반투명 안개(위로 밝은 결, 옅은 띠). 이웃이 없는 쪽은 6px 안에서 들쭉날쭉 디더로 사라진다."""
    N, E, S, W = bool(m & 1), bool(m & 2), bool(m & 4), bool(m & 8)
    im = new(); p = im.load()
    for y in range(16):
        for x in range(16):
            d = 99.0
            if not W: d = min(d, x + .5 - (1.0 + 3.0 * _pn16(y, seed + 1)))
            if not E: d = min(d, 15.5 - x - (1.0 + 3.0 * _pn16(y, seed + 2)))
            if not N: d = min(d, y + .5 - (1.0 + 3.0 * _pn16(x, seed + 3)))
            if not S: d = min(d, 15.5 - y - (1.0 + 3.0 * _pn16(x, seed + 4)))
            if not N and not W: d = min(d, math.hypot(x + .5, y + .5) - 6.5)
            if not N and not E: d = min(d, math.hypot(15.5 - x, y + .5) - 6.5)
            if not S and not W: d = min(d, math.hypot(x + .5, 15.5 - y) - 6.5)
            if not S and not E: d = min(d, math.hypot(15.5 - x, 15.5 - y) - 6.5)
            if d < 0: continue
            # 밀도: 가장자리 0..5px 은 디더로 줄어든다
            dens = 1.0 if d >= 5 else d / 5.0
            if BAY[y % 4, x % 4] >= dens: continue
            n = vnoise(x, y, 4, seed + 11, per=4)
            band = ((y + int(3 * _pn16(x, seed + 12))) % 8) < 2               # 옅게 흐르는 띠
            k = 5 if n > .55 else 4
            if band: k += 1
            al = 120 if d >= 3 else 80
            p[x, y] = tuple(FOG[clamp(k, 1, 6)]) + (al,)
    return im

def fog_sheet(seed=0): return FB.sheet_from_cells([fog_cell(m, seed) for m in range(16)])

# ---------------------------------------------------------------- 플랫폼 널(칩셋 세로 널 결을 바랜 회갈색 목재로)
PLAT = R('#1b1024', '#2c2220', '#463830', '#5e4c3e', '#78644e', '#94805e', '#b8a47c')        # 비바람에 바랜 널
_CHP = np.array(terrain.CH.crop((288, 80, 336, 128)).convert('RGB')).astype(int)
_CHL = _CHP.sum(axis=2)
_CHV = np.unique(_CHL)
def plat_px(X, Y):
    """칩셋 널판(세로 널 48x48)의 밝기 순위를 PLAT 램프 2..5 로. 널마다 바램 정도 다르게, 드문 못·이끼."""
    v = _CHL[Y % 48, X % 48]
    r = np.searchsorted(_CHV, v) / max(1, len(_CHV) - 1)
    t = 2 + int(round(r * 3.2))
    b = (X % 48) // 6
    if _hash(b, (Y // 48), 77) < .3: t -= 1
    c = PLAT[clamp(t, 1, 6)]
    if pn(X, Y, 8, 78) > .78: c = mix(c, LF[1], .35)                          # 젖은 이끼 얼룩
    return c

def pn(X, Y, sc, seed, period=48): return vnoise(X, Y, sc, seed, per=int(period / sc))

def plat_cell(m, seed=0):
    """플랫폼 바닥 16변형: 안쪽은 널, 북쪽(선로 쪽) 가장자리 = 밝은 끝 각목 3px + 흰 안전선 1px 자리(바램),
    남쪽 = 앞 턱 각목 2px(아래 칸에 platform_face), 동·서 = 끝 각목, 바깥 모서리 = 쇠 덮개 박은 기둥 머리."""
    N, E, S, W = bool(m & 1), bool(m & 2), bool(m & 4), bool(m & 8)
    im = new(); p = im.load()
    for y in range(16):
        for x in range(16):
            c = plat_px(x + seed * 16, y)
            if not N:
                if y == 0: c = PLAT[6]
                elif y == 1: c = PLAT[5]
                elif y == 2: c = PLAT[3]
                elif y == 3: c = mix(PL[4], PLAT[4], .45) if _hash(x, 0, 81) > .2 else PLAT[4]   # 바랜 안전선
                elif y == 4: c = PLAT[2]
            if not S:
                if y == 14: c = PLAT[4] if not (y == 14 and _hash(x, y, 82) < .1) else PLAT[3]
                elif y == 15: c = PLAT[2]
                elif y == 13: c = mix(c, PLAT[1], .4)
            if not W:
                if x == 0: c = PLAT[5]
                elif x == 1: c = PLAT[4]
                elif x == 2: c = PLAT[2]
            if not E:
                if x == 15: c = PLAT[1]
                elif x == 14: c = PLAT[3]
                elif x == 13: c = mix(c, PLAT[1], .4)
            # 바깥 모서리 기둥 머리(쇠 덮개)
            corner = ((not N and not W and x < 4 and y < 4) or (not N and not E and x > 11 and y < 4) or
                      (not S and not W and x < 4 and y > 11) or (not S and not E and x > 11 and y > 11))
            if corner:
                lx = x if x < 8 else 15 - x; ly = y if y < 8 else 15 - y
                if lx < 3 and ly < 3:
                    c = STEEL[5] if (lx + ly) < 2 else STEEL[3]
                    if lx == 1 and ly == 1: c = STEEL[6]
            p[x, y] = tuple(c) + (255,)
    return im

def plat_sheet(seed=0): return FB.sheet_from_cells([plat_cell(m, seed) for m in range(16)])

def plat_floor(cx, cy):
    """지도에서 쓰는 플랫폼 칸(이웃 마스크는 지도에서 계산) — 안쪽 결."""
    return mk(lambda x, y: plat_px(cx * 16 + x, cy * 16 + y))

# ---------------------------------------------------------------- 바닥 표본
def ground_ballast():
    """자갈 도상 바닥 3x3(48px 주기): 칩셋 돌 결을 따뜻한 회색 자갈로, 드문 잡풀·녹 조각."""
    def f(X, Y):
        gx = X + (Y // 2) % 2
        cell = _hash((gx // 2) % 24, (Y // 2) % 24, 131)
        k = 3 if cell < .45 else (4 if cell < .8 else 2)
        if gx % 2 == 0 and Y % 2 == 0: k += 1
        elif gx % 2 == 1 and Y % 2 == 1: k -= 1
        if _hash(X % 48, Y % 48, 133) < .05: k = 5
        c = GRAVEL[clamp(k, 1, 6)]
        n = pn(X, Y, 8, 134)
        if n > .8: c = mix(c, (60, 52, 40), .3)                                  # 기름 먹은 자리
        if _hash(X % 48, Y % 48, 135) > .985: c = LF[2]
        if _hash(X % 48, Y % 48, 136) > .993: c = RUST[3]
        return c
    return mk(f, 48, 48)

def ground_platform(): return mk(lambda X, Y: plat_px(X, Y), 48, 48)

CARP = R('#1a0c18', '#36121c', '#561c24', '#782a2c', '#963c36', '#b0584a', '#c87c66')       # 바랜 붉은 통로 깔개
def carriage_floor_px(X, Y, aisle=(16, 32)):
    """객차 바닥: 가로(열차 길이) 방향 니스칠 널 4px + 가운데 통로에 바랜 붉은 깔개(금빛 가장자리 실)."""
    a0, a1 = aisle
    if a0 <= Y % 48 < a1:
        ly = Y % 48 - a0
        if ly in (0, a1 - a0 - 1): return BR[2]
        if ly in (1, a1 - a0 - 2): return CARP[1]
        t = 3 if ((X // 4 + ly // 4) % 2) else 4                                   # 잔 무늬 직물
        if (X + ly * 3) % 16 == 0: t = 5
        if pn(X, Y, 8, 141) > .74: t -= 1                                          # 닳은 자리
        return CARP[clamp(t, 1, 6)]
    row = Y // 4; ly = Y % 4
    off = int(_hash(row % 12, 0, 143) * 48)
    xx = (X + off) % 48
    if ly == 3 or xx == 0: return VARN[1]
    t = 4 if _hash(row % 12, xx // 24, 144) < .6 else 3
    g = AK.grain(Y % 4 * 9 + row * 3, X + row * 23) - 3
    if g >= 2: t += 1
    elif g <= -2: t -= 1
    if ly == 0: t += 1
    return VARN[clamp(t, 1, 6)]

def ground_carriage(): return mk(lambda X, Y: carriage_floor_px(X, Y), 48, 48)
