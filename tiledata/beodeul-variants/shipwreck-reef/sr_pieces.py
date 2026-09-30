# 난파선 암초 — 손 도트 조각들 (버들항 결: 7단 램프·바깥 윤곽·빛 왼쪽 위). Python/Pillow, 결정적.
import os, sys, math, random
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '_common-4'))
import numpy as np
from PIL import Image
import c4
from c4 import ST, WD, RD, SR, LF, PL, WA
import pz, pboat, px2
from px2 import C

def rgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
SANDR = [rgb(x) for x in ('#3c3128', '#5c4b3b', '#816a56', '#9e8b64', '#b8a67a', '#d2c493')]     # 젖은~마른 모래 램프 (칩셋 모래에서)
CANV = [rgb(x) for x in ('#3a3128', '#6b5d48', '#8f7f62', '#b3a37f', '#d4c7a2', '#ebe0c0')]      # 낡은 돛천 램프
WEED = [rgb(x) for x in ('#14261a', '#1f4030', '#2d5f3f', '#3f8050', '#5da060', '#88c078')]        # 해초 램프

class Cv:
    def __init__(s, w, h): s.w, s.h = w, h; s.a = np.zeros((h, w, 4), np.uint8)
    def px(s, x, y, c):
        x = int(x); y = int(y)
        if 0 <= x < s.w and 0 <= y < s.h: s.a[y, x] = tuple(c) + (255,)
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.px(x, y, c)
    def line(s, x0, y0, x1, y1, c):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1): s.px(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), c)
    def ell(s, cx, cy, rx, ry, fn):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                u = (x + .5 - cx) / rx; v = (y + .5 - cy) / ry
                if u * u + v * v <= 1: s.px(x, y, fn(u, v))
    def get(s, x, y): return s.a[y, x] if 0 <= x < s.w and 0 <= y < s.h else None
    def img(s, fin=True):
        im = Image.fromarray(s.a); return pz.fin(im) if fin else im

def lit(u, v): return .5 - u * .42 - v * .38
def tone_of(v, lo=1, hi=5):
    return max(lo, min(hi, int(round(v * 5.2 + .6))))

# ================================================================= 난파선 선체 (큰 스프라이트)
WR_W, WR_H, WR_CX, WR_CY, WR_L, WR_D, WR_F = 240, 112, 120, 56, 104, 10, 26
def wreck_rig():
    """난파선 돛대·찢긴 돛·삭구 — 선체와 같은 240x112 캔버스(같은 좌표에 겹쳐 놓는다). 돛대(기둥)에 걸린 천."""
    c = C(WR_W, WR_H, seed=22)
    CY = WR_CY
    # --- 돛대: 주돛대는 중간에서 꺾여 있고 앞돛대는 밑동만 남았다
    MAIN, FORE = 106, 158
    c.group(500); c.new()
    base = CY - 0
    top = CY - 34
    for y in range(top, base + 1):
        j = 1 if y < top + 4 and y % 2 else 0                                   # 꺾인 끝이 들쭉날쭉
        c.tone(MAIN, y, 'wood', 5); c.tone(MAIN + 1, y, 'wood', 4); c.tone(MAIN + 2, y, 'wood', 2)
    for k, (dx, dy) in enumerate(((3, -1), (4, 0), (-1, 1), (0, -2))):          # 부러진 결
        c.tone(MAIN + dx, top + dy + 1, 'wood', 3 if k % 2 else 4)
    c.group(510); c.box(MAIN - 4, top + 6, 11, 2, 2, 'wood', bias=0.1)          # 망대(기울어 반쯤 남음)
    c.group(501); c.new()
    for y in range(CY - 11, base + 1):
        c.tone(FORE, y, 'wood', 5); c.tone(FORE + 1, y, 'wood', 4); c.tone(FORE + 2, y, 'wood', 2)
    c.tone(FORE + 1, CY - 12, 'wood', 3); c.tone(FORE, CY - 12, 'wood', 4)
    # --- 찢어진 돛 (주돛대 활대에 걸려 처진 천) + 활대
    c.group(600)
    yard_y = top + 10
    def v_sail(x, y):
        t = (x - 66) / 42
        val = 0.62 - 0.3 * abs(t - .4) - (y - yard_y) / 90.0
        if (x - 66) % 6 == 5: val -= 0.14
        return val
    pts = [(MAIN - 1, yard_y), (68, yard_y + 3), (66, yard_y + 20), (70, yard_y + 34), (78, yard_y + 30), (84, yard_y + 44), (92, yard_y + 36), (100, yard_y + 40), (MAIN - 1, yard_y + 30)]
    c.poly(pts, 'cream', v_sail, grain=False)
    # 찢긴 구멍
    for (hx, hy, r) in ((78, yard_y + 12, 3), (90, yard_y + 20, 4), (74, yard_y + 24, 2)):
        for y in range(hy - r, hy + r + 1):
            for x in range(hx - r, hx + r + 1):
                if (x - hx) ** 2 + (y - hy) ** 2 <= r * r and 0 <= y < WR_H and 0 <= x < WR_W: c.m[y][x] = None
    c.group(601); c.line(68, yard_y + 3, MAIN - 1, yard_y, 'wood', 4); c.line(68, yard_y + 4, MAIN - 1, yard_y + 1, 'wood', 2)
    c.line(66, yard_y + 3, 68, yard_y + 3, 'wood', 3)
    # 삭구: 끊어진 밧줄이 늘어짐
    c.group(700)
    for (x0, y0, x1, y1) in ((MAIN, top + 3, 128, CY - 6), (MAIN + 2, top + 5, 132, CY - 2), (MAIN, top + 4, 92, yard_y + 6)):
        c.line(x0, y0, x1, y1, 'rope', 3)
    c.line(128, CY - 6, 130, CY - 2, 'rope', 2); c.line(132, CY - 2, 134, CY + 1, 'rope', 2)

    return c.img(outline=True)

def wreck():
    """반쯤 모래에 박혀 기울어진 큰 배 — 선미(왼)는 성하고, 선체 가운데가 터지고, 뱃머리(오른)는 부러졌다.
    반환: (이미지, info) — info['edge'][x] = (갑판 먼쪽 y, 앞쪽 y), info['cut'] = 뱃머리 부러진 x, info['wl']"""
    rng = random.Random(41)
    c = C(WR_W, WR_H, seed=21)
    CX, L, CY, D, F = WR_CX, WR_L, WR_CY, WR_D, WR_F
    def rz(x):
        if x < 66: return 6
        if x < 69: return 4
        if x > 184: return 3
        return 0
    wl, edge = pboat.hull(c, CX, L, CY, D, F, pboat.w_ship, sheer=3.0, raise_=rz, deck='deck')
    fx = lambda x: edge[x][0]; nx = lambda x: edge[x][1]
    # --- 갑판 윗면: 넓은 판자(5줄)·이음 한 줄·엇갈린 맞댐 이음. 절대 y 로 이음을 맞춰 가로 전체가 한 면으로 읽힌다(3/4 윗면 띠)
    c.group(2)
    for x in sorted(wl):
        fy_, ny_ = fx(x), nx(x)
        for y in range(fy_ + 2, ny_):
            tt = 4
            if y % 5 == 0: tt = 3                                                # 판자 이음
            elif (x + (y // 5) * 13) % 37 == 0: tt = 3                           # 엇갈린 맞댐 이음
            c.tone(x, y, 'wood', tt)
    # --- 선체 옆면: 빛바랜 금띠(칠이 벗겨졌다), 포문(뚜껑이 처지거나 없다), 깨진 선미 창
    c.group(40)
    for x in sorted(wl):
        n = nx(x)
        for y in (n + 3, n + 4):
            if y < wl[x] - 1 and (x * 7 + y * 3) % 5 != 0: c.tone(x, y, 'gold', 2 if y == n + 3 else 1)      # 바랜 금띠(군데군데 벗겨짐)
        y = n + 11
        if y < wl[x] - 1 and (x % 3): c.tone(x, y, 'gold', 1)
    for gx in range(72, 175, 12):
        if 112 <= gx <= 140: continue                       # 터진 자리 — 포문 없음
        n = nx(gx); c.group(100 + gx); c.new()
        for y in range(n + 6, n + 9):
            for x in range(gx, gx + 4): c.tone(x, y, 'dark', 1 if y > n + 6 else 3)
        if gx % 24 == 0:
            c.tone(gx + 1, n + 7, 'stone', 2)                                   # 포신이 빠진 자리 대신 그을음
        c.group(200 + gx); c.new()
        if gx % 24 == 0:                                                        # 뚜껑 한쪽이 처져 매달림
            for x in range(gx, gx + 4): c.tone(x, n + 9, 'red', 1); c.tone(x, n + 10, 'red', 2 if x < gx + 2 else 1)
        else:
            for x in range(gx, gx + 4): c.tone(x, n + 5, 'red', 2)
    for wx in range(28, 62, 8):                                                # 선미 창 — 유리는 다 깨졌다(어둡다)
        n = nx(wx); c.group(300 + wx); c.new()
        for y in range(n + 6, n + 10):
            for x in range(wx, wx + 4): c.tone(x, y, 'dark', 1 if (x + y) % 3 else 2)
        for x in range(wx - 1, wx + 5): c.tone(x, n + 5, 'gold', 2)
        c.tone(wx + 1, n + 7, 'cryst', 2)                                       # 유리 파편 한 조각
    # --- 갑판 부속: 열린 승강구(어두운 구멍), 부러진 캡스턴, 선미 갑판 앞 난간
    c.group(400)
    hx0, hy0 = 92, CY - 4
    c.box(hx0 - 1, hy0 - 1, 15, 8, 2, 'wood', bias=-0.05)                       # 승강구 테두리
    for y in range(hy0 + 1, hy0 + 7):
        for x in range(hx0 + 1, hx0 + 13): c.tone(x, y, 'dark', 0 if y > hy0 + 2 else 1)
    for x in range(hx0 + 2, hx0 + 12, 3): c.tone(x, hy0 + 4, 'wood', 2)         # 어둠 속 사다리 발판
    c.group(401); c.cylinder(146, CY - 4, CY, 2.5, 'wood', bias=0.1)
    c.group(410)
    for y in range(fx(69) - 1, nx(69) + 1): c.tone(68, y, 'wood', 5); c.tone(69, y, 'wood', 3)   # 선미 갑판 앞 난간판
    for y in range(fx(69) - 3, fx(69)): c.tone(68, y, 'wood', 4 if y % 2 else 3)
    c.group(411); c.ellipsoid(44, CY - 13, 3, 2.2, 'wood', bias=0.1); c.tone(44, CY - 13, 'wood', 2)   # 부러진 키 손잡이
    im = c.img(outline=False)
    a = np.array(im)
    H, W = a.shape[:2]

    # --- 뱃머리 부러짐: 오른쪽 x>bx(y) 를 지우고 판자 이빨을 남긴다
    def bx(y): return 196 + int(4 * math.sin(y * 0.55) + 3 * math.sin(y * 1.3 + 1))
    for y in range(H):
        for x in range(bx(y), W): a[y, x, 3] = 0
    # 갈비뼈(늑골): 부러진 자리에 하늘 쪽으로 솟은 나무 늑골 — 선체 안쪽이 보이도록 어두운 속
    cut = 190
    for y in range(H):
        for x in range(bx(y) - 8, bx(y)):
            if a[y, x, 3] and (x + y) % 3 == 0 and y > fx(min(x, max(edge)) if x in edge else 0) - 2:
                pass
    # 선체 가운데 큰 구멍 (옆면이 터짐) — 타원 + 들쭉날쭉, 안은 어둡고 늑골 줄이 보인다
    hole_cx, hole_cy = 128, CY + 23
    for y in range(hole_cy - 11, hole_cy + 11):
        for x in range(hole_cx - 22, hole_cx + 22):
            u = (x - hole_cx) / 22.0; v = (y - hole_cy) / 10.0
            r = u * u + v * v + 0.18 * math.sin(x * 1.7) + 0.16 * math.sin(y * 2.3 + x * .4)
            if r < 0.9 and 0 <= y < H and 0 <= x < W and a[y, x, 3]:
                dark = px2.hx(px2.PAL['dark'][1]) if hasattr(px2, 'hx') else None
                a[y, x, :3] = rgb('#171b22') if r < 0.6 else rgb('#2b2620'); a[y, x, 3] = 255
    # 구멍 속 늑골 (세로 나무 살)
    for rx_ in range(hole_cx - 18, hole_cx + 19, 8):
        for y in range(hole_cy - 10, hole_cy + 10):
            if a[y, rx_, 3] and tuple(a[y, rx_, :3]) in (rgb('#171b22'), rgb('#2b2620')):
                a[y, rx_, :3] = WD[3]; a[y, rx_ + 1, :3] = WD[2]
    # 구멍 가장자리의 뜯긴 판자 이빨
    for x in range(hole_cx - 21, hole_cx + 22, 3):
        yy = hole_cy - 10 + int(3 * math.sin(x * .9))
        for k in range(3):
            if a[yy + k, x, 3] and a[yy + k, x, 0] > 30: a[yy + k, x, :3] = WD[5 - k]
    # --- 뱃머리 단면 늑골 (bx 근처에 나무 가시)
    for y in range(fx(180) - 6, wl.get(180, 90)):
        pass
    im2 = Image.fromarray(a)
    # 늑골: 부러진 뱃머리 위로 뻗은 가시 (그리기 후 좌표 작업)
    cv = Cv(W, H); cv.a = np.array(im2)
    for k, (x0, y_top) in enumerate(((172, fx(172) - 5), (180, fx(180) - 4), (188, fx(188) - 3), (194, fx(194) - 2))):
        yb = min(WR_H - 1, wl.get(x0, 84) - 2)
        for y in range(y_top, yb):
            if cv.a[y, x0, 3] == 0 or y < fx(x0 if x0 in edge else 180):
                cv.px(x0, y, WD[4]); cv.px(x0 + 1, y, WD[2])
        cv.px(x0 - 1, y_top + 1, WD[3])
    # --- 바닥: 모래에 묻힌 용골 (아랫변 4줄을 들쭉날쭉 모래로 덮는다)
    for x in range(W):
        if x not in wl: continue
        bot = wl[x]
        if x >= bx(bot - 4) - 1: continue
        n = int(2 + 3 * (math.sin(x * .31) * .5 + .5) + (x * 13 % 3))
        for y in range(bot - n, bot + 3):
            if y < H:
                cv.px(x, y, SANDR[2] if y < bot - 1 else SANDR[1])
        if x % 5 == 0: cv.px(x, bot - n - 1, SANDR[3])
        # 물때/따개비: 선체 밑 두 줄
        if x % 4 == 1: cv.px(x, bot - n - 1, WEED[2]);
        if x % 9 == 4: cv.px(x, bot - n - 2, WEED[3])
    for (x, y) in ((70, 76), (73, 79), (112, 85), (150, 82), (154, 80), (96, 84), (127, 88)):   # 해초 달라붙음
        for k in range(4): cv.px(x + (k % 2), y + k, WEED[2 + (k % 2)])
    im = cv.img(fin=False)
    # 윤곽선 (바깥 테)
    a = np.array(im); al = a[..., 3] > 0
    pad = np.pad(al, 1)
    nb = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    edge_m = nb & ~al
    a[edge_m] = (*ST[0], 255)
    fin = Image.fromarray(a)
    return fin, {'edge': edge, 'wl': wl, 'cut': 190}


# ================================================================= 작은 조각들
def _wood_h(cv, x0, x1, y, th, ramp=WD, seed=0):
    """가로 통나무/판자(윗면이 밝다)"""
    for x in range(x0, x1 + 1):
        for k in range(th):
            v = k / max(1, th - 1)
            t = 5 - int(v * 3.4)
            if (x * 7 + seed) % 11 == 0 and k == th // 2: t -= 1
            cv.px(x, y + k, ramp[max(1, t)])

def _cap(cv, cx, cy, rx, ry, col, rim=None):
    """납작한 윗면 타원(한 톤, 알갱이 없음) — 3/4 윗면 T"""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            u = (x + .5 - cx) / rx; v = (y + .5 - cy) / ry
            if u * u + v * v <= 1: cv.px(x, y, col)

def _cyl(cv, cx, rx, y0, y1, ramp_fn, ycap, ry):
    """타원 윗면 밑으로 내려오는 원통 앞면. 열마다 밝기 = 왼쪽이 밝고 오른쪽이 어둡다. 아래 끝은 타원으로 둥글다"""
    for x in range(int(cx - rx), int(cx + rx) + 1):
        u = (x + .5 - cx) / rx
        if abs(u) > 1: continue
        ytop = ycap + ry * math.sqrt(max(0, 1 - u * u)) - .3           # 윗타원 아래선
        ybot = y1 + ry * math.sqrt(max(0, 1 - u * u)) * .55 - ry * .55
        for y in range(int(round(ytop)), int(round(ybot)) + 1):
            cv.px(x, y, ramp_fn(u, y))

def gangway():
    """부서진 널판 오르막(32x48) — 3/4: 널판 윗면이 길게 깔리고, 앞은 받침 널(두께)과 버팀 말뚝, 모래에 반쯤 묻힘."""
    cv = Cv(32, 48)
    TOP = WD[4]; SEAM = WD[3]
    # 윗면 — 널판 (가로 이음 사이 한 톤, 이음은 열 일부만)
    y0, y1 = 1, 22
    for y in range(y0, y1 + 1):
        for x in range(3, 29):
            c = TOP
            k = (y - y0) % 5
            if k == 4 and (x + (y // 5) * 7) % 9 != 0 and not (13 <= x <= 16 and 8 <= y <= 16):
                c = SEAM                                                    # 판자 이음(가로)
            cv.px(x, y, c)
    # 빠진 널(구멍) — 앞쪽 가운데 2행, 안쪽은 어두운 기초
    for y in (13, 14):
        for x in range(10, 19): cv.px(x, y, (0x2a, 0x1e, 0x1a))
    # 부러진 널 끝
    for (x, y) in ((9, 13), (9, 14), (19, 13)): cv.px(x, y, WD[2])
    # 못
    for y in (2, 7, 12, 17):
        if not (12 <= y <= 14): cv.px(5, y, ST[3]); cv.px(26, y, ST[3])
    # 앞면 — 받침 대들보(한 톤 어둡게) + 윗선 한 줄
    for y in range(23, 29):
        for x in range(3, 29):
            cv.px(x, y, WD[2] if y > 23 else WD[3])
    for x in range(3, 29):
        if x % 7 == 0: cv.px(x, 26, WD[1])
    cv.px(28, 25, WD[1]); cv.px(28, 26, WD[1])                                # 부러진 모서리
    # 버팀 말뚝 둘 — 오른쪽 것은 기울었다
    for y in range(29, 41):
        cv.px(5, y, WD[3]); cv.px(6, y, WD[2]); cv.px(7, y, WD[1])
        s = (y - 29) // 6
        cv.px(24 + s, y, WD[3]); cv.px(25 + s, y, WD[2]); cv.px(26 + s, y, WD[1])
    # 모래에 반쯤 묻힘 + 그림자
    for x in range(0, 32):
        n = 3 + int(2 * (math.sin(x * .6) * .5 + .5))
        for k in range(n): cv.px(x, 46 - k, SANDR[2 + (k > 0)] if (x + k) % 7 else SANDR[3])
    for x in range(4, 30):
        if x % 3: cv.px(x, 41, SANDR[1]); cv.px(x, 42, SANDR[1])
    return cv.img()

def rib(h=48, w=30, seed=1, lean=0):
    """선 채 남은 늑골 한 쌍 — 모래에 박혀 안쪽으로 휜다."""
    cv = Cv(w, h)
    rng = random.Random(seed)
    def arc(cx, side):
        pts = []
        for y in range(3, h - 4):
            t = (h - 4 - y) / (h - 7)                         # 0 아래 → 1 위
            off = side * (w / 2 - 5) * (1 - t ** 1.7)
            pts.append((cx + off, y))
        for (x, y) in pts:
            xi = int(round(x))
            for k, tn in enumerate((4, 5, 3)) if side < 0 else enumerate((2, 3, 4)):
                pass
            cv.px(xi, y, WD[4]); cv.px(xi + 1, y, WD[3]); cv.px(xi + 2, y, WD[2]) if side < 0 else cv.px(xi - 1, y, WD[2])
        # 부러진 끝
        xi = int(round(pts[0][0]))
        cv.px(xi + 1, 2, WD[3]); cv.px(xi - 1, 3, WD[4])
    arc(w // 2, -1); arc(w // 2, 1)
    # 가운데 옆 널 조각(부서진 가로대)
    y = h // 2
    for x in range(6, w // 2 - 1): cv.px(x, y, WD[3]); cv.px(x, y + 1, WD[2])
    cv.px(w // 2 - 2, y - 1, WD[4])
    for x in range(0, w):
        n = 2 + int(2 * (math.sin(x * .8 + seed) * .5 + .5))
        for k in range(n): cv.px(x, h - 1 - k, SANDR[2 + (k > 0)] if (x + k) % 6 else SANDR[3])
    return cv.img()

def snapped_mast():
    """옆으로 쓰러진 돛대 + 엉킨 밧줄 + 찢긴 돛천(48x24)"""
    cv = Cv(48, 24)
    r = 3.5
    for x in range(1, 44):
        cy = 12 + (x - 22) * 0.06
        for y in range(int(cy - r), int(cy + r) + 1):
            v = (y + .5 - cy) / r
            t = 5 - int((v + 1) * 2.1)
            if (x // 5 + y) % 9 == 0: t -= 1
            cv.px(x, y, WD[max(1, min(5, t))])
    for k, dy in enumerate((-3, -1, 0, 2, 3)): cv.px(44 - (k % 2), 12 + dy, WD[3 - k % 2])       # 부러진 끝
    cv.px(45, 11, WD[4]); cv.px(45, 13, WD[2])
    cv.rect(10, 8, 11, 16, WD[2])                                             # 쇠 테
    cv.rect(10, 8, 11, 8, ST[4]); cv.rect(10, 16, 11, 16, ST[2])
    # 돛천: 밑 왼쪽에 흘러내린 천
    for y in range(13, 22):
        for x in range(2, 20):
            u = (x - 2) / 18; wv = 6 + 4 * math.sin(x * .5)
            if y - 13 < wv * (1 - u * .3) and not ((x + y * 2) % 13 == 0):
                t = 4 - int((y - 13) / 4) + (1 if (x % 6 == 0) else 0)
                cv.px(x, y, CANV[max(1, min(5, t))])
    # 밧줄 뭉치
    for a in range(0, 360, 20):
        cv.px(26 + round(4 * math.cos(math.radians(a))), 19 + round(2.5 * math.sin(math.radians(a))), RD[2] if False else (0x8a, 0x6a, 0x3a))
    cv.line(30, 19, 40, 22, (0x8a, 0x6a, 0x3a))
    return cv.img()

def driftwood(kind=0):
    """모래에 놓인 유목(32x16) — 3/4: 윗면 밝은 띠(5행), 앞면 어두운 띠(5행), 오른쪽 아래 그림자"""
    cv = Cv(32, 16)
    x0, x1 = 2, 29
    for x in range(x0, x1 + 1):
        for k in range(6): cv.px(x, 3 + k, WD[5])                                # 윗면 6행(맨 윗줄은 외곽선이 덮는다)
        for k in range(5): cv.px(x, 9 + k, WD[3] if k < 2 else WD[2])            # 앞면: 위는 밝고 아래로 어둡다
    for x in range(x0, x1 + 1):
        if (x * 5 + kind) % 13 == 0: cv.px(x, 7, WD[4])                          # 옹이 결
    for x in (6, 12, 19, 24): cv.px(x, 10 + (x + kind) % 2, WD[2])               # 앞면 쪼개진 결
    # 왼쪽 마구리: 둥근 나이테
    cv.px(x0 - 1, 6, WD[5]); cv.px(x0 - 1, 7, WD[4]); cv.px(x0 - 1, 8, WD[3]); cv.px(x0 - 1, 9, WD[3]); cv.px(x0 - 1, 10, WD[3])
    cv.px(x0, 8, WD[3]); cv.px(x0 + 1, 9, WD[5])
    # 오른쪽 부러진 끝
    cv.px(x1 + 1, 6, WD[4]); cv.px(x1 + 1, 7, WD[3]); cv.px(x1 + 1, 8, WD[2]); cv.px(x1 + 1, 9, WD[2])
    if kind == 1:                                                                # 가지 그루터기: 앞면에 나이테 타원
        for (x, y, c) in ((15, 10, WD[5]), (16, 10, WD[5]), (17, 10, WD[4]), (15, 11, WD[4]), (16, 11, WD[2]), (17, 11, WD[3]), (16, 12, WD[2])):
            cv.px(x, y, c)
    for x in range(x0 + 3, x1 + 4):                                              # 접지 그림자(오른쪽 아래)
        if x % 3: cv.px(x, 14, SANDR[1])
    return cv.img()

def plank_pile():
    """부서진 판자 더미(32x16)"""
    cv = Cv(32, 16)
    rows = [(3, 26, 4, 0), (6, 28, 5, 1), (9, 22, 4, 2), (12, 27, 3, 3)]
    offs = [2, 0, 5, 1]
    for i, (y, x1, _, sd) in enumerate(rows):
        x0 = offs[i]; th = 3
        _wood_h(cv, x0, x1, y, th, seed=sd)
        cv.px(x0, y, WD[1]); cv.px(x1, y + 1, WD[1]); cv.px(x1 - 3, y + 1, ST[2])
    cv.line(20, 2, 27, 0, WD[3]); cv.line(20, 3, 27, 1, WD[2])                             # 삐죽 튀어나온 판자
    for x in range(1, 30, 2): cv.px(x, 15, SANDR[1])
    return cv.img()

def seaweed(kind=0):
    """물가 해초 덩이(16x16) — 3/4: 젖은 매트 윗면(납작 타원) + 앞으로 늘어진 잎"""
    cv = Cv(16, 16)
    rng = random.Random(30 + kind)
    _cap(cv, 8, 6, 7, 2.6, WEED[4])                                              # 윗면
    # 앞 — 늘어진 해초 줄기, 한 톤 어둡게
    for x in range(1, 15):
        u = (x + .5 - 8) / 7.0
        ytop = 6 + 2.6 * math.sqrt(max(0, 1 - u * u)) - .2
        ln = 5 + (x * 7 + kind * 3) % 4
        for y in range(int(round(ytop)), int(round(ytop)) + ln):
            d = y - ytop
            cv.px(x, y, WEED[3] if (d < 1.5 and x % 2) else WEED[2] if x % 3 else WEED[1])
    for x in range(2, 14):
        if x % 2: cv.px(x, 14, WEED[1])                                          # 접지 그림자
    if kind == 1:                                                                # 부레 방울(윗면 위)
        for (x, y) in ((5, 5), (9, 4), (11, 6)): cv.px(x, y, WEED[5])
    else:
        for (x, y) in ((6, 5), (10, 6)): cv.px(x, y, WEED[3])
    return cv.img()

def barnacle_rock(kind=0):
    """따개비가 붙은 물가 바위(32x24) — 3/4: 넓은 윗면 타원 + 돌덩이 앞면"""
    cv = Cv(32, 24)
    cx, rx = 16, 13 - kind * 2
    cy, ry = 7, 4.3
    rng = random.Random(70 + kind)
    wob = [1 + .07 * math.sin(x * .9 + kind * 2) for x in range(40)]
    # 앞면(먼저): 울퉁불퉁 아래 끝
    for x in range(cx - rx, cx + rx + 1):
        u = (x + .5 - cx) / rx
        if abs(u) > 1: continue
        ytop = cy + ry * math.sqrt(max(0, 1 - u * u))
        ybot = 19 + 2 * math.sqrt(max(0, 1 - u * u)) + 1.2 * math.sin(x * 1.3 + kind)
        for y in range(int(round(ytop)), int(round(ybot)) + 1):
            t = 3 if u < -.15 else 2 if u < .55 else 1
            if y > ybot - 2: t = max(1, t - 1)
            cv.px(x, y, ST[t])
    _cap(cv, cx, cy, rx * .97, ry, ST[4])                                        # 윗면(한 톤)
    # 따개비: 윗면 몇 개 + 앞면 여러 개
    for _ in range(9):
        x = rng.randint(cx - rx + 4, cx + rx - 4); y = rng.randint(cy - 2, cy + 2)
        cv.px(x, y, (0xd0, 0xcb, 0xb8))
    for _ in range(18):
        x = rng.randint(cx - rx + 2, cx + rx - 2); y = rng.randint(cy + 6, 19)
        c_ = cv.get(x, y)
        if c_ is not None and c_[3]:
            cv.px(x, y, (0xd0, 0xcb, 0xb8)); cv.px(x, y + 1, ST[1])
    for x in range(cx - rx + 1, cx + rx):                                        # 아래쪽 해초 얼룩
        if (x * 3) % 4 == 0 and cv.get(x, 18)[3]: cv.px(x, 18, WEED[2]); cv.px(x, 19, WEED[2])
    for x in range(cx - rx + 3, cx + rx + 3):                                    # 접지 그림자(오른쪽 아래)
        if x % 3: cv.px(x, 22, SANDR[1])
    return cv.img()

def shells():
    """불가사리·조개 — 젖은 바위 판 위에(16x16). 3/4: 바위 윗면에 올려 놓고 앞 면은 어둡다."""
    cv = Cv(16, 16)
    for y in range(4, 10):
        for x in range(1, 15): cv.px(x, y, ST[4])                                # 윗면 6행
    for y in range(10, 14):
        for x in range(1, 15): cv.px(x, y, ST[2] if y < 13 else ST[1])            # 앞면
    for x in range(2, 15):
        if x % 3: cv.px(x, 14, SANDR[1])
    ORG = [(0x7a, 0x2c, 0x1c), (0xa8, 0x44, 0x28), (0xd0, 0x6a, 0x3c), (0xe8, 0x9a, 0x60)]
    # 불가사리 (윗면 왼쪽, 납작하게)
    for (x, y, c) in ((4, 6, ORG[3]), (3, 6, ORG[2]), (5, 6, ORG[2]), (4, 5, ORG[2]), (4, 7, ORG[1]), (2, 7, ORG[1]), (6, 7, ORG[1]), (2, 5, ORG[1]), (6, 5, ORG[1])):
        cv.px(x, y, c)
    # 부채조개 (윗면 오른쪽)
    for (x, y, c) in ((10, 6, SANDR[5]), (11, 6, SANDR[4]), (12, 6, SANDR[5]), (9, 7, SANDR[4]), (10, 7, SANDR[5]), (11, 7, SANDR[4]), (12, 7, SANDR[5]), (13, 7, SANDR[4])):
        cv.px(x, y, c)
    cv.px(11, 8, ST[2])
    # 소라 앞면에 기대어
    for (x, y, c) in ((9, 10, SANDR[5]), (10, 10, SANDR[4]), (11, 10, SANDR[4]), (9, 11, SANDR[4]), (10, 11, SANDR[3]), (11, 11, SANDR[3])):
        cv.px(x, y, c)
    return cv.img()

def buried_chest():
    """모래에 반쯤 묻힌 궤(16x16) — 3/4: 열린 뚜껑 윗면, 앞면, 흘러나온 금화"""
    cv = Cv(16, 16)
    GOLD = (0xd6, 0xb4, 0x4a)
    for y in range(3, 8):
        for x in range(2, 14): cv.px(x, y, WD[4])                                # 윗면(뚜껑) 5행
    for x in (5, 10):
        for y in range(3, 8): cv.px(x, y, ST[3])                                  # 쇠띠는 세로로 두 줄만
    for y in range(8, 13):
        for x in range(2, 14):
            t = 3 if x < 9 else 2
            if y == 8: t = 1                                                     # 뚜껑과 몸통 틈
            cv.px(x, y, WD[t])
    for x in (5, 10):
        for y in range(9, 13): cv.px(x, y, ST[2])
    cv.px(7, 8, GOLD); cv.px(8, 8, GOLD)                                          # 틈으로 금빛
    cv.px(7, 10, GOLD); cv.px(8, 10, ST[3])                                      # 자물쇠
    for x in range(0, 16):
        n = 1 + int(1.6 * (math.sin(x * .9) * .5 + .5))
        for k in range(n): cv.px(x, 13 - k, SANDR[2 + (k > 0)])
    for (x, y) in ((3, 13), (5, 14), (11, 13), (13, 14)): cv.px(x, y, GOLD)        # 흘러나온 금화
    for x in range(3, 15):
        if x % 2: cv.px(x, 14, SANDR[1])
    return cv.img()

def tarp_lean():
    """난파 생존자 천막(48x32) — 3/4: 돛천 지붕 윗면(한 톤), 앞은 어두운 입구와 막대"""
    cv = Cv(48, 32)
    # 윗면: 돛천 지붕
    for y in range(3, 13):
        for x in range(5, 43):
            c = CANV[4]
            if (x - 5) % 12 == 11 and y > 4: c = CANV[3]                        # 세로 주름 접힘
            cv.px(x, y, c)
    for x in range(5, 43):
        if x % 5 == 0: cv.px(x, 12, CANV[3])
    # 앞면: 어두운 천 + 입구
    for y in range(13, 27):
        for x in range(6, 42):
            cv.px(x, y, CANV[2] if x < 12 or x > 35 else (0x1c, 0x18, 0x1a) if y > 14 else CANV[1])
    for y in range(13, 27):
        cv.px(6, y, WD[3]); cv.px(7, y, WD[2])                                   # 앞 막대
        cv.px(40, y, WD[3]); cv.px(41, y, WD[2])
    for x in range(8, 40): cv.px(x, 13, CANV[1])                                # 윗단 접힌 자리
    for y in range(17, 26, 4): cv.px(9, y, CANV[3]); cv.px(38, y, CANV[3])       # 기운 자국
    cv.line(4, 4, 2, 27, (0x8a, 0x6a, 0x3a)); cv.line(44, 4, 46, 27, (0x8a, 0x6a, 0x3a))  # 당김줄
    for x in range(2, 46):
        if x % 3: cv.px(x, 27, SANDR[1]); cv.px(x, 28, SANDR[1]) if x > 12 else None
    for x in (2, 46): cv.px(x, 27, WD[3]); cv.px(x, 28, WD[2])
    return cv.img()

def campfire():
    """꺼져가는 모닥불(16x16) — 3/4: 돌 테두리 원통(앞면), 재와 불씨가 깔린 윗면"""
    cv = Cv(16, 16)
    ASH = (0x2c, 0x26, 0x26); LOG = (0x30, 0x28, 0x24)
    for x in range(1, 15):                                                        # 앞면(돌 고리) — 아래 반원
        u = (x + .5 - 8) / 7.0
        if abs(u) > 1: continue
        ytop = 6 + 3 * math.sqrt(max(0, 1 - u * u)) - .4
        ybot = 10 + 3 * math.sqrt(max(0, 1 - u * u))
        for y in range(int(round(ytop)), int(round(ybot)) + 1):
            mortar = ((x + (y >> 1)) % 4 == 0) and y > ytop + 1
            cv.px(x, y, ST[2] if mortar else ST[3] if u < .3 else ST[2])
    _cap(cv, 8, 6, 7, 3.2, ASH)                                                  # 윗면(재)
    cv.line(4, 6, 9, 7, LOG); cv.line(11, 5, 6, 7, LOG)                          # 타다 남은 장작(재와 거의 같은 명도)
    for (x, y, c) in ((8, 6, (0xd0, 0x50, 0x20)), (9, 5, (0xe8, 0x9a, 0x30))):
        cv.px(x, y, c)
    for x in range(3, 15):
        if x % 2: cv.px(x, 14, SANDR[1])
    return cv.img()

def rope_coil():
    """밧줄 사리(16x16) — 3/4: 감은 윗면(두 톤 고리) + 원통 옆면"""
    cv = Cv(16, 16)
    A = (0xb0, 0x8e, 0x58); B = (0xaa, 0x88, 0x54)
    RP = [(0x5a, 0x44, 0x28), (0x5e, 0x48, 0x2c), (0x6a, 0x52, 0x30)]
    cx, cy = 8, 6
    for x in range(1, 15):                                                        # 옆면(원통)
        u = (x + .5 - cx) / 7.0
        if abs(u) > 1: continue
        ytop = cy + 3.0 * math.sqrt(max(0, 1 - u * u))
        ybot = 11 + 2.4 * math.sqrt(max(0, 1 - u * u))
        for y in range(int(round(ytop)), int(round(ybot)) + 1):
            cv.px(x, y, RP[2] if (x + y) % 3 == 0 else RP[1] if u < .2 else RP[0])   # 비스듬한 꼬임
    for y in range(int(cy - 4), int(cy + 4)):                                     # 윗면: 고리 두 겹(명도 거의 같음)
        for x in range(0, 16):
            u = (x + .5 - cx) / 7.0; v = (y + .5 - cy) / 3.0
            r2 = u * u + v * v
            if r2 <= 1:
                cv.px(x, y, A if int(r2 * 4) % 2 == 0 else B)
    cv.line(13, 11, 15, 13, RP[2]); cv.px(15, 14, RP[0])                          # 풀려 나온 끝
    for x in range(3, 15):
        if x % 2: cv.px(x, 14, SANDR[1])
    return cv.img()

def broken_barrel():
    """살이 터진 통(16x16) — 3/4: 열린 윗면(나무 테 + 어두운 안쪽), 원통 앞면, 빠진 살"""
    cv = Cv(16, 16)
    cx, rx = 8, 6
    # 앞면 원통: 왼쪽이 밝다
    for x in range(cx - rx, cx + rx + 1):
        u = (x + .5 - cx) / rx
        if abs(u) > 1: continue
        ytop = 5 + 2.6 * math.sqrt(max(0, 1 - u * u))
        ybot = 12 + 2.0 * math.sqrt(max(0, 1 - u * u))
        for y in range(int(round(ytop)), int(round(ybot)) + 1):
            t = 4 if u < -.4 else 3 if u < .1 else 2 if u < .6 else 1
            if x % 3 == 0: t = max(1, t - 1)                                     # 살 이음
            cv.px(x, y, WD[t])
    for y in (8, 11):                                                            # 쇠 테
        for x in range(cx - rx, cx + rx + 1):
            c_ = cv.get(x, y)
            if c_ is not None and c_[3]: cv.px(x, y, ST[2])
    # 윗면: 안쪽이 어두운 열린 통
    _cap(cv, cx, 5, rx, 2.8, (0x22, 0x1c, 0x1a))
    for a in range(0, 360, 20):                                                  # 나무 테 테두리(앞쪽은 윗면 가장자리)
        x = cx + round((rx - .6) * math.cos(math.radians(a))); y = 5 + round(2.3 * math.sin(math.radians(a)))
        if 0 < a < 180: cv.px(x, y, WD[4])
    # 빠진 살 틈 + 부서진 조각
    for (x, y) in ((11, 8), (12, 9), (12, 10), (11, 10)): cv.a[y, x] = (0, 0, 0, 0)
    cv.px(14, 12, WD[3]); cv.px(15, 13, WD[2])
    for x in range(3, 15):
        if x % 2: cv.px(x, 14, SANDR[1])
    return cv.img()

def lifebuoy():
    """구명환(16x16) — 3/4: 흰 윗면 고리(납작 타원), 앞면은 붉은·흰 줄"""
    cv = Cv(16, 16)
    W0 = (0xe8, 0xe0, 0xd0)
    # 앞면 먼저(고리 두께)
    for x in range(1, 15):
        u = (x + .5 - 8) / 7.0
        if abs(u) > 1: continue
        ytop = 6 + 2.6 * math.sqrt(max(0, 1 - u * u))
        for y in range(int(round(ytop)), int(round(ytop)) + 4):
            band = ((x + 1) // 3) % 2
            cv.px(x, y, (0xa8, 0x34, 0x2c) if band else (0xb0, 0xa8, 0x98))
    _cap(cv, 8, 6, 7, 2.6, W0)
    for y in range(5, 8):                                                       # 가운데 구멍 (모래)
        for x in range(6, 11):
            u = (x + .5 - 8) / 2.6; v = (y + .5 - 6) / .9
            if u * u + v * v <= 1: cv.px(x, y, SANDR[2])
    for x in range(3, 15):
        if x % 2: cv.px(x, 13, SANDR[1])
    return cv.img()

def figurehead():
    """부러진 이물장식 — 모래에 누운 여신상(32x24). 3/4: 나무 몸통 윗면·앞면, 오른쪽 머리, 금관"""
    cv = Cv(32, 24)
    GOLD = (0xd6, 0xb4, 0x4a); GOLD2 = (0xa0, 0x82, 0x30)
    # 몸통 윗면(왼쪽~가운데) 4행 → 머리 윗면은 같은 톤으로 이어져 키가 더 크다
    for x in range(2, 22):
        for y in range(8, 14): cv.px(x, y, WD[5])
        for y in range(14, 20): cv.px(x, y, WD[3] if y < 17 else WD[2])
    for x in range(22, 30):
        for y in range(5, 14): cv.px(x, y, WD[5])
        for y in range(14, 21): cv.px(x, y, WD[3] if y < 18 else WD[2])
    # 머리: 금관(앞 윗가장자리) 와 얼굴
    for x in range(22, 30): cv.px(x, 14, GOLD); cv.px(x, 15, GOLD2)
    for x in (22, 24, 26, 28): cv.px(x, 13, GOLD)
    for (x, y) in ((24, 17), (27, 17), (26, 18), (25, 19), (26, 19)): cv.px(x, y, WD[1])   # 눈·코·입
    cv.px(23, 18, WD[4]); cv.px(28, 18, WD[4])
    # 긴 머리 결 + 부러진 왼쪽 끝
    for x in range(3, 21):
        if x % 4 == 0: cv.px(x, 15, WD[2]); cv.px(x, 16, WD[2])
    for (x, y) in ((1, 10), (1, 11), (2, 13), (1, 15), (2, 17)): cv.px(x, y, WD[3])
    for (x, y) in ((1, 12), (1, 14), (0, 13)): cv.px(x, y, WD[1])
    for x in range(3, 30):
        if x % 3: cv.px(x, 21, SANDR[1]); cv.px(x, 22, SANDR[1]) if x > 12 else None
    return cv.img()

def sea_chest():
    """배 안 궤(16x16) — 3/4: 평평한 뚜껑 윗면(6행) + 쇠띠 두른 앞면 + 오른쪽 아래 그림자"""
    cv = Cv(16, 16)
    for y in range(2, 8):
        for x in range(2, 14): cv.px(x, y, WD[5])
    for y in range(8, 15):
        for x in range(2, 14): cv.px(x, y, WD[3] if y < 11 else WD[2])
    for y in range(8, 15):
        for x in (4, 11): cv.px(x, y, ST[2])                         # 쇠띠(앞면에만)
    cv.px(7, 10, RD[6]); cv.px(8, 10, RD[6]); cv.px(7, 11, RD[5]); cv.px(8, 11, RD[5])   # 자물쇠
    for x in range(4, 15):
        if x % 2 == 0: cv.px(x, 15, SANDR[0])
    return cv.img()

def stool34():
    """선원 걸상(16x16) — 3/4: 둥근 좌면 타원(5행) + 굽 + 다리 셋"""
    cv = Cv(16, 16)
    _cap(cv, 8, 5, 5.5, 2.8, WD[5])
    for x in range(3, 13):
        if abs(x + .5 - 8) <= 5.4: cv.px(x, 8, WD[3]); cv.px(x, 9, WD[2])
    for x, h in ((4, 5), (7, 6), (11, 5)):
        for k in range(h): cv.px(x, 10 + k // 1 - (1 if k == 0 else 0) if False else 10 + k, WD[2] if x != 7 else WD[3])
    for x in range(4, 14):
        if x % 2: cv.px(x, 15, SANDR[0])
    return cv.img()

def bunk():
    """선원 침대(16x32) — 3/4: 베개(흰)+붉은 담요 윗면(11행) + 나무 틀 앞면 + 다리"""
    cv = Cv(16, 32)
    for y in range(2, 5):
        for x in range(3, 13): cv.px(x, y, (0xd8, 0xd0, 0xc0))        # 베개
    for y in range(5, 13):
        for x in range(2, 14): cv.px(x, y, RD[4])                      # 담요(한 톤)
    for y in range(13, 15):
        for x in range(2, 14): cv.px(x, y, RD[2])                      # 접힌 담요 단
    for y in range(15, 26):
        for x in range(2, 14): cv.px(x, y, WD[3] if y < 21 else WD[2]) # 나무 틀 앞면
    for y in range(15, 26): cv.px(7, y, WD[2]); cv.px(8, y, WD[2]) if y % 5 == 0 else None
    for x in range(2, 14):
        if x % 4 == 0: cv.px(x, 20, WD[1])
    for y in range(26, 29):
        for x in (3, 4, 11, 12): cv.px(x, y, WD[1])                    # 다리
    for x in range(4, 15):
        if x % 2 == 0: cv.px(x, 29, SANDR[0])
    return cv.img()

def all_pieces():
    W, info = wreck()
    return [
        ('wreck', W, '난파선 선체 — 15x7칸. 선미(왼)는 갑판·선실이 남고 가운데 옆구리가 터졌으며 뱃머리(오른)는 부러졌다. 용골은 모래에 묻힘'),
        ('wreck_rig_pole', wreck_rig(), '난파선 돛대(기둥)·찢긴 돛·끊긴 삭구 — 선체 위에 같은 좌표로 겹친다'),
        ('gangway', gangway(), '부서진 널판 오르막 2x3칸(걸을 수 있음). 판자 하나 빠지고 하나 반쪽'),
        ('rib_big', rib(48, 30, 1), '선 채 남은 늑골 한 쌍(2x3칸)'),
        ('rib_small', rib(32, 20, 2), '늑골 한 쌍 작은 것(1x2칸)'),
        ('snapped_mast', snapped_mast(), '쓰러진 돛대+밧줄+찢긴 돛천 3x2칸'),
        ('driftwood_a', driftwood(0), '유목 2x1칸'),
        ('driftwood_b', driftwood(1), '유목(가지 있음) 2x1칸'),
        ('plank_pile', plank_pile(), '부서진 판자 더미 2x1칸'),
        ('seaweed_a', seaweed(0), '해초 덩이 1칸'),
        ('seaweed_b', seaweed(1), '해초 덩이(부레 방울) 1칸'),
        ('barnacle_rock_a', barnacle_rock(0), '따개비 바위 2x2칸'),
        ('barnacle_rock_b', barnacle_rock(1), '따개비 바위 작은 것 2x2칸'),
        ('shells', shells(), '불가사리·조개·소라 1칸'),
        ('buried_chest', buried_chest(), '반쯤 묻힌 열린 궤 1칸'),
        ('tarp_lean', tarp_lean(), '생존자 돛천 천막 3x2칸'),
        ('campfire', campfire(), '꺼져가는 모닥불 1칸'),
        ('rope_coil', rope_coil(), '밧줄 사리 1칸'),
        ('broken_barrel', broken_barrel(), '살이 터진 통 1칸'),
        ('lifebuoy', lifebuoy(), '구명환 1칸'),
        ('sea_chest', sea_chest(), '안쪽용: 쇠띠 궤 1칸 — 뚜껑 윗면 T6, 앞면 F8'),
        ('stool34', stool34(), '안쪽용: 선원 걸상 1칸 — 좌면 타원 T5, 다리 F10'),
        ('bunk', bunk(), '안쪽용: 선원 침대 1x2칸 — 붉은 담요 윗면 T12, 틀 앞면 F17'),
        ('figurehead', figurehead(), '부러진 이물장식(금관 쓴 여신상) 2x2칸'),
    ], info
