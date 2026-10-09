# 사막 성 지하 기계실 재료 — 바닥 표본(어두운 사암 판석·기계실 강철판·안뜰 큰 판석), 실내 벽 앞면(사암 마름돌을 지하라 두 단
# 어둡게 + 굵은 받침돌 띠), 천장(어두운 속 + 사암 벽 윗면 띠), 오토타일 둘(모래 번짐·놋쇠 난간).
# 지도는 graveyard-crypt 의 KMap(dlib.Map) 을 읽기만 하고, 재료는 이 모듈이 런타임에 dlib 에 끼운다(dlib 파일은 고치지 않는다).
import math
from dc_base import *
import dlib
from gc_ext import mk_floor, SAMPLES, compose_
from gc_map import KMap
import dc_mech as MC
from dc_court import cyl_t

T = 16
# ================================================================ 바닥 표본(48 주기, 3x3 이어 붙여도 이음새 없음)
def cellar_flag(X, Y):
    """지하 사암 판석: 24x16 판을 줄마다 반장 어긋나게, 줄눈 어둡게, 판마다 톤, 위·왼 모 밝음, 점·닳은 자리, 모래 낀 줄눈."""
    row = Y // 16; ly = Y % 16; off = (row % 2) * 12
    xx = (X + off) % 48; col = xx // 24; lx = xx % 24
    if ly == 15 or lx == 23:
        return SA[2] if H_(X, Y, 701) > 0.7 else SSD[2]
    h = H_(col, row, 702)
    base = SSD[4] if h < 0.45 else (mix(SSD[4], SSD[5], 0.45) if h < 0.8 else mix(SSD[4], SSD[3], 0.5))
    c = base
    if ly == 0 or lx == 0: c = mix(base, SSD[6], 0.5)
    elif ly == 14 or lx == 22: c = mix(base, SSD[3], 0.5)
    else:
        r = H_(X, Y, 703)
        if r < 0.045: c = mix(base, SSD[3], 0.6)
        elif r > 0.975: c = mix(base, SSD[6], 0.5)
        if A.tnoise(48, 48, 8, 704)[Y % 48, X % 48] > 0.74: c = mix(c, SSD[3], 0.2)
    return c

def machine_plate(X, Y):
    """기계실 강철판: 16x16 판(규약: 아래·오른 1px 홈, 위·왼 1px 빛), 판 셋에 하나 미끄럼 돌기, 판 사이 놋쇠 띠(48px 마다),
    네 모서리 리벳, 기름 얼룩."""
    lx = X % 16; ly = Y % 16; col = X // 16; row = Y // 16
    if Y % 48 in (46, 47):                                              # 놋쇠 띠(가로만, 48px 마다)
        return BRASS[3] if Y % 48 == 46 else BRASS[1]
    h = H_(col % 3, row % 3, 711)
    k = 3 + (1 if h > 0.88 else 0)
    if ly == 15 or lx == 15: k = 1
    elif ly == 0 or lx == 0: k += 1
    elif ly == 14 or lx == 14: k -= 1
    elif (col + row) % 3 == 0 and lx % 4 == 0 and ly % 4 == 0 and 2 < lx < 13 and 2 < ly < 13: k = 5
    if lx in (2, 13) and ly in (2, 13): k = 6
    elif lx in (3, 14) and ly in (3, 14): k = 1
    c = STEEL[clamp(k, 1, 6)]
    if A.tnoise(48, 48, 12, 712)[Y % 48, X % 48] > 0.76 and k not in (1, 6): c = mix(c, (44, 34, 26), 0.35)
    return c

def court_flag(X, Y):
    """안뜰 큰 판석(햇빛 받은 사암): 32x16 큰 판 엇갈림, 판 셋 중 하나는 반장(16x16), 줄눈엔 모래, 위·왼 모 밝게, 닳은 가운데."""
    row = Y // 16; ly = Y % 16; off = (row % 3) * 16
    xx = (X + off) % 48
    if xx < 32: lx, bw, col = xx, 32, 0
    else: lx, bw, col = xx - 32, 16, 1
    if ly == 15 or lx == bw - 1:
        return SA[2] if H_(X, Y, 722) > 0.55 else SS[2]
    h = H_(col + (row % 3) * 2, row, 723)
    base = mix(SS[4], SS[3], 0.25) if h < 0.4 else (mix(SS[4], SS[3], 0.5) if h < 0.75 else SS[4])
    c = base
    if ly == 0 or lx == 0: c = mix(base, SS[5], 0.7)
    elif ly == 14 or lx == bw - 2: c = mix(base, SS[2], 0.45)
    else:
        r = H_(X, Y, 724)
        if r < 0.05: c = mix(base, SS[2], 0.55)
        elif r > 0.98: c = SS[5]
        if H_(X // 3, Y // 2, 725) < 0.06: c = mix(c, SA[4], 0.7)        # 날린 모래 점
        if A.tnoise(48, 48, 12, 726)[Y % 48, X % 48] > 0.72: c = mix(c, SA[4], 0.22)   # 모래 먼지 얼룩(옅게)
    return c

for tag, fn in (('dc_cellar', cellar_flag), ('dc_plate', machine_plate), ('dc_court', court_flag)):
    mk_floor(tag, fn)

# ================================================================ 실내 벽 앞면: 사암 마름돌(지하라 두 단 어둡게) + 굵은 받침돌
dlib.FACE_BASE['dcastle'] = SSD[4]
_prev_face = dlib.face_px
def _face_px(style, X, Y, H, seed, capL, capR):
    if style != 'dcastle': return _prev_face(style, X, Y, H, seed, capL, capR)
    c = mul(sash(X, Y + 3, bw=16, bh=8, seed=seed + 731), 0.66)
    if A.tnoise(48, 48, 6, 732)[Y % 48, X % 48] > 0.8: c = mul(c, 0.9)
    if H - 10 <= Y < H - 3:                                             # 굵은 받침돌 띠
        ly = Y - (H - 10)
        c = mul(sash(X, ly, bw=24, bh=7, seed=seed + 733), 0.6)
        if ly == 0: c = SSD[6]
    if Y == 0: c = SSD[6]
    elif Y == 1: c = mix(c, SSD[6], 0.35)
    elif Y == 2: c = mul(c, 0.72)
    elif Y == 3: c = mul(c, 0.84)
    elif Y == 4: c = mul(c, 0.93)
    if Y == H - 1: c = DARK7[1]
    elif Y == H - 2: c = mul(c, 0.5)
    elif Y == H - 3: c = mul(c, 0.78)
    if capL and X % 16 == 0: c = mix(c, SSD[6], 0.35)
    if capR and X % 16 == 15: c = mul(c, 0.55)
    if capR and X % 16 == 14: c = mul(c, 0.8)
    return c
dlib.face_px = _face_px

# ================================================================ 천장: 어두운 속 + 사암 벽 윗면 띠(BAND px)
_cc = {}
VOID = [(20, 12, 12), (26, 16, 16), (32, 22, 20)]
def ceiling(o8, seed=0):
    key = (o8, seed % 4)
    if key in _cc: return _cc[key]
    N, E, S, W, NE, SE, SW, NW = o8; t = dlib.BAND
    def depth(x, y):
        best = None
        def up(d, side):
            nonlocal best
            if best is None or d < best[0]: best = (d, side)
        if N and y < t: up(y, 'N')
        if S and y >= 16 - t: up(15 - y, 'S')
        if W and x < t: up(x, 'W')
        if E and x >= 16 - t: up(15 - x, 'E')
        if not N and not W and NW and x < t and y < t: up(max(x, y), 'N')
        if not N and not E and NE and x >= 16 - t and y < t: up(max(15 - x, y), 'N')
        if not S and not W and SW and x < t and y >= 16 - t: up(max(x, 15 - y), 'S')
        if not S and not E and SE and x >= 16 - t and y >= 16 - t: up(max(15 - x, 15 - y), 'S')
        return best
    im = Image.new('RGBA', (16, 16)); p = im.load()
    for y in range(16):
        for x in range(16):
            X = x + (seed % 4) * 16; Y = y + (seed % 4) * 8
            b = depth(x, y)
            if b is None:
                r = H_(X, Y, 741); c = VOID[0] if r < 0.55 else (VOID[1] if r < 0.93 else VOID[2])
            else:
                d, side = b
                row = Y // 8; off = (row % 2) * 8; lx = (X + off) % 16; ly = Y % 8
                c = SSD[5] if H_((X + off) // 16, row, 742) < 0.6 else mix(SSD[5], SSD[4], 0.4)
                if lx == 0 or ly == 7: c = mix(c, SSD[3], 0.45)
                if H_(X, Y, 743) < 0.05: c = SSD[6]
                if d == 0: c = SSD[6] if side in ('N', 'W') else mix(c, SSD[6], 0.4)
                elif d == 1: c = mix(c, SSD[6], 0.18)
                if d == t - 1: c = DARK7[1]
                elif d == t - 2: c = mix(c, DARK7[1], 0.3)
            p[x, y] = tuple(c) + (255,)
    _cc[key] = im; return im

def face_sample(w=3, h=3):
    return compose_(w, h, lambda i, j: dlib.face_tile('dcastle', None, j, int(H_(i + 3, j, 3) * 6), i == 0, i == w - 1, h * T))
def ceiling_sample():
    def cf(i, j):
        o8 = (j > 0, i < 2, j < 2, i > 0, j > 0 and i < 2, j < 2 and i < 2, j < 2 and i > 0, j > 0 and i > 0)
        return ceiling((False,) * 8 if (i == 1 and j == 1) else o8, i + j)
    return compose_(3, 3, cf)
def outer_face_sample():
    """바깥 성벽 앞면 표본(3x3): 햇빛 받은 사암 마름돌 + 층 띠 + 굵은 받침돌(성벽 앞면과 같은 그리기)."""
    import dc_castle as DC
    px = Px(48, 48)
    for y in range(48):
        for x in range(48): px.put(x, y, DC._face(x, y, 0, 47, 0, plinth=7))
    string_course(px, 0, 48, 18)
    return px.im

# ================================================================ 오토타일 1: 모래 번짐(벽 밑·계단 밑·틈 밑)
def sand_spill_sheet():
    """16변형: 바닥(판석·강철판·포석) 위로 새어 든 모래. 속은 두껍게 쌓여 밝고 잔물결, 가장자리로 갈수록 얇아져 바닥이 비치고,
    이웃이 없는 쪽은 들쭉날쭉 흩어진 알갱이. 남·동 가장자리 아래 1px 그늘(쌓인 두께)."""
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    for n in range(16):
        m, miss = wl.edge_depth(n, inset=2.6, jag=2.0, rad=6.0, seed=751)
        rgb = np.zeros((16, 16, 3), np.uint8); al = np.zeros((16, 16), np.uint8)
        for y in range(16):
            for x in range(16):
                d = m[y, x]
                if d < -1.8: continue
                if d < 0:
                    if H_(x + n * 16, y, 752) > 0.86: rgb[y, x] = SA[4]; al[y, x] = 255
                    continue
                th = min(1.0, d / 5.0)
                if d < 1.0:
                    if H_(x + n * 16, y, 753) > 0.55: rgb[y, x] = SA[3]; al[y, x] = 255
                    elif H_(x, y, 754) > 0.5: rgb[y, x] = SA[2]; al[y, x] = 200
                    continue
                lum = 0.5 + 0.38 * th
                if miss['N'] and y < 5: lum += 0.15
                if miss['W'] and x < 5: lum += 0.1
                if miss['S'] and m[y, x] < 2.2 and y > 8: lum -= 0.22
                if miss['E'] and m[y, x] < 2.2 and x > 8: lum -= 0.15
                if ((y + math.sin((x + n * 16) / 4.0) * 1.2) % 5) < 1 and th > 0.5: lum -= 0.25
                rgb[y, x] = sand_tone(x + n * 16, y, lum, 755); al[y, x] = 255
        cells.append(Image.fromarray(np.dstack([rgb, al]), 'RGBA'))
    return wl.sheet_from_cells(cells)

# ================================================================ 오토타일 2: 놋쇠 난간(울타리)
def brass_rail_sheet():
    """16변형: 기계 구덩이·관성 바퀴 둘레 놋쇠 난간 — 칸마다 가운데 강철 받침 기둥(놋쇠 꼭지), 이웃 쪽으로 위·가운데 두 가닥 놋쇠
    가로대. 남북 이음은 위에서 본 가로대 윗면(세로 줄). 모든 변형 막힘(위층)."""
    def cell(n):
        px = Px(32, 32); ox, oy = 8, 8; cx = ox + 7
        N, E, S, W = bool(n & 1), bool(n & 2), bool(n & 4), bool(n & 8)
        # 남북 가로대(위에서 본 윗면 줄, 3px: 빛 · 바탕 · 그늘)
        for (on, ys) in ((N, range(0, oy + 7)), (S, range(oy + 7, 32))):
            if on:
                for y in ys: px.put(cx - 1, y, BRASS[6]); px.put(cx, y, BRASS[4]); px.put(cx + 1, y, BRASS[2])
        # 동서 가로대 두 가닥(위 굵게 3px, 가운데 2px)
        for (yy, rows) in ((oy + 4, (6, 4, 1)), (oy + 10, (5, 2))):
            x0 = 0 if W else cx - 1; x1 = 32 if E else cx + 2
            for x in range(x0, x1):
                for k, t in enumerate(rows): px.put(x, yy + k, BRASS[t])
        # 기둥(강철) + 놋쇠 꼭지 + 발판
        for y in range(oy + 3, oy + 15):
            px.put(cx - 1, y, STEEL[5]); px.put(cx, y, STEEL[4]); px.put(cx + 1, y, STEEL[2])
        for y in range(oy + 1, oy + 4):
            for x in range(cx - 2, cx + 3): px.put(x, y, BRASS[6] if x <= cx - 1 else (BRASS[4] if x <= cx else BRASS[2]))
        for x in range(cx - 2, cx + 3): px.put(x, oy + 15, STEEL[1])
        im = pz.fin(px.im, 0.62)
        return im
    return wl.autotile_composed(cell)
