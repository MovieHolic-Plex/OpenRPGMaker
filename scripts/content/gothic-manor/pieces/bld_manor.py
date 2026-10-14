"""저택 — 동서 용마루 본채 + 앞 박공 + 둥근 탑/사각 탑 + 굴뚝. 정문은 맨 아래 줄."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from gmlib import REG, Cv, K, OL, OL2, run_module   # noqa: E402
from gmdraw import *                                  # noqa: E402,F403
from _bld import *                                    # noqa: E402,F403
import random, math

MODULE = 'bld_manor'


@REG.piece('gm-bld-manor3', '대저택(2층 본채·둥근 탑·정면 박공·사각 탑)', 10, 11, 'auto:1', 'architecture', 'manor', role='building', kind='structure',
           tags=['저택', '흉가', '대저택', '탑'], access=[(4, 11), (5, 11)],
           desc='청보라 슬레이트 지붕의 2층 석조 대저택. 가운데 앞으로 튀어나온 박공(첨두 쌍창·정문·돌계단), 왼쪽 원뿔 지붕 둥근 탑, 오른쪽 사각뿔 첨탑 날개, 굴뚝 둘, 용마루 쇠 장식, 담쟁이.',
           rules='정문은 맨 아래 줄 x 4~5. 문 앞 두 칸 아래로 길을 낸다. 정원·철책 북쪽 가운데에 둔다.')
def _manor3(c):
    yb = 175; ye = 111; xl, xr = 28, 130
    chimney(c, 44, 52, 26)
    chimney(c, 108, 50, 28)
    yr = range_roof(c, xl, xr, ye, 48, seed=1, moss=.03)
    wall(c, xl, xr, ye + 1, yb, 'stone', seed=2)
    string_course(c, xl, xr, ye + 31)
    window_row(c, xl + 6, 60, ye + 8, 16, 2, lit=(1,), seed=1)
    window_row(c, 100, xr - 4, ye + 8, 16, 2, lit=(), seed=2)
    window_row(c, xl + 6, 60, ye + 39, 17, 2, lit=(), seed=3)
    window_row(c, 100, xr - 4, ye + 39, 17, 2, lit=(0,), seed=4)
    dormer(c, 50, ye - 14, lit=False, seed=3); dormer(c, 112, ye - 14, lit=True, seed=4)
    cx = 80
    yf = cross_gable(c, cx, 20, ye + 2, rise=40, depth=34, seed=5)
    wall(c, cx - 20, cx + 20, ye + 2, yb, 'stone', seed=6, plinth=True)
    c.VL(cx + 20, ye + 2, yb - ye - 2, K('ink', 1)); c.VL(cx - 21, ye + 2, yb - ye - 2, K('stone', 1))
    string_course(c, cx - 20, cx + 20, ye + 31)
    lancet(c, cx - 8, ye - 18, 7, 17, lit=True, mull=False); lancet(c, cx + 1, ye - 18, 7, 17, lit=False)
    rose(c, cx, int(yf(cx)) + 11, 4)
    window_row(c, cx - 18, cx + 18, ye + 8, 16, 2, lit=(), seed=7)
    gothic_door(c, cx - 9, yb - 32, 18, 28, seed=3)
    steps(c, cx, 20, yb + 1, 2)
    tx = 22
    round_wall(c, tx, 14, 62, yb - 4, seed=9)
    for (wy, lt) in ((ye + 8, True), (ye + 39, False), (74, False)):
        lancet(c, tx - 3, wy, 6, 15, lit=lt, sill=True)
    plinth_band(c, 8, yb - 4, 28)
    c.R(7, 60, 30, 3, K('stone', 5)); c.HL(7, 60, 30, K('stone', 6)); c.HL(7, 63, 30, K('stone', 1))
    spire_cone(c, tx, 60, 16, 44, seed=10)
    sx0, sx1 = 128, 152
    wall(c, sx0, sx1, 74, yb, 'stone', seed=12)
    string_course(c, sx0, sx1, ye + 31); string_course(c, sx0, sx1, ye - 1)
    lancet(c, sx0 + 9, 80, 7, 16, lit=False); lancet(c, sx0 + 9, ye + 8, 7, 16, lit=True); lancet(c, sx0 + 9, ye + 39, 7, 17)
    c.R(sx0 - 2, 71, sx1 - sx0 + 4, 3, K('stone', 5)); c.HL(sx0 - 2, 71, sx1 - sx0 + 4, K('stone', 6)); c.HL(sx0 - 2, 73, sx1 - sx0 + 4, K('stone', 1))
    spire_square(c, (sx0 + sx1) / 2, 70, 13, 40, seed=13)
    keep = lambda x, y: c.opaque(x, y) and y < yb - 4
    ivy(c, 34, yb - 5, 46, spread=8, seed=3, keep=keep)
    ivy(c, 140, yb - 5, 30, spread=6, seed=8, keep=keep, density=.8)
    finish(c)


@REG.piece('gm-bld-manor2', '작은 저택(2층·왼 박공 현관·굴뚝)', 7, 9, 'auto:1', 'architecture', 'manor', role='building', kind='structure',
           tags=['저택', '흉가', '집'], access=[(1, 9), (2, 9)],
           desc='2층 석조 작은 저택. 왼쪽 앞 박공 아래 정문(돌계단), 오른쪽 2층 창 넷, 굴뚝, 지붕창 하나, 담쟁이.',
           rules='정문은 맨 아래 줄 x 1~2. 대저택 곁채·마을 끝 흉가로 쓴다.')
def _manor2(c):
    yb = 143; ye = 79; xl, xr = 6, 106
    chimney(c, 86, 30, 22)
    range_roof(c, xl, xr, ye, 40, seed=21, moss=.04)
    wall(c, xl, xr, ye + 1, yb, 'stone', seed=22)
    string_course(c, xl, xr, ye + 31)
    window_row(c, 50, xr - 3, ye + 8, 16, 3, lit=(2,), seed=11)
    window_row(c, 50, xr - 3, ye + 39, 17, 3, lit=(), seed=12)
    dormer(c, 76, ye - 12, lit=False, seed=6)
    cx = 26
    yf = cross_gable(c, cx, 19, ye + 2, rise=34, depth=28, seed=23)
    wall(c, cx - 19, cx + 19, ye + 2, yb, 'stone', seed=24)
    c.VL(cx + 19, ye + 2, yb - ye - 2, K('ink', 1))
    string_course(c, cx - 19, cx + 19, ye + 31)
    lancet(c, cx - 4, ye - 14, 8, 16, lit=False, mull=True)
    lancet(c, cx - 4, ye + 8, 8, 16, lit=True)
    gothic_door(c, cx - 8, yb - 31, 16, 27, seed=5)
    steps(c, cx, 18, yb + 1, 2)
    keep = lambda x, y: c.opaque(x, y) and y < yb - 4
    ivy(c, 98, yb - 5, 40, spread=7, seed=21, keep=keep)
    finish(c)


def _broken(c, cx, cy, rx, ry, seed=0):
    """지붕 구멍(들쭉날쭉한 덩이): 어두운 속 + 경사 따라 내려가는 서까래 + 가로 도리 + 깨진 가장자리 기와."""
    rnd = random.Random(seed)
    rad = [1 + rnd.uniform(-.35, .25) for _ in range(12)]
    def inside(x, y):
        a = math.atan2((y + .5 - cy) / ry, (x + .5 - cx) / rx); k = (a + math.pi) / (2 * math.pi) * 12
        i = int(k) % 12; f = k - int(k); r = rad[i] * (1 - f) + rad[(i + 1) % 12] * f
        return ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= r * r
    pts = [(x, y) for y in range(int(cy - ry * 1.4), int(cy + ry * 1.4) + 1) for x in range(int(cx - rx * 1.4), int(cx + rx * 1.4) + 1) if inside(x, y) and c.opaque(x, y)]
    for x, y in pts: c.P(x, y, K('ink', 1 if y > cy - ry * .4 else 2))
    for x, y in pts:
        if (x - int(cx - rx)) % 5 in (0, 1): c.P(x, y, K('wood', 3 if (x - int(cx - rx)) % 5 == 0 else 1))
        if y == int(cy): c.P(x, y, K('wood', 4))
    for x, y in pts:          # 가장자리: 아래쪽 들뜬 기와(밝음), 위쪽 그늘
        if not inside(x, y + 1): c.P(x, y + 1, K('slate', 6))
        if not inside(x, y - 1): c.P(x, y, K('slate', 1))


def boarded(c, x, y, w, h):
    """판자로 막은 창."""
    c.R(x, y, w, h, K('ink', 1))
    for k in range(3):
        yy = y + 2 + k * (h - 4) // 2
        c.HL(x - 1, yy, w + 2, K('wood', 4)); c.HL(x - 1, yy + 1, w + 2, K('wood', 2)); c.P(x, yy, K('iron', 4))
    c.line(x, y + 1, x + w - 1, y + h - 2, K('wood', 5))


@REG.piece('gm-bld-manor-ruin', '폐저택(무너진 지붕·판자 창)', 8, 9, 'auto:1', 'architecture', 'manor', role='building', kind='structure',
           tags=['폐저택', '흉가', '폐허'], access=[(4, 9)],
           desc='버려진 2층 석조 저택. 지붕에 구멍 두 곳(서까래가 드러남), 무너진 굴뚝, 판자로 막은 창, 금 간 벽, 덮인 담쟁이. 문 하나만 남은 현관.',
           rules='정문 x 4 맨 아래 줄. 흉가·폐허 무대에. 주변에 덤불·고사목을 둔다.')
def _ruin(c):
    yb = 143; ye = 79; xl, xr = 8, 120
    chimney(c, 30, 36, 18, pots=1)
    c.clear(29, 30, 4, 8)
    range_roof(c, xl, xr, ye, 40, seed=31, moss=.12, crest=False)
    _broken(c, 50, 57, 10, 6, seed=1); _broken(c, 93, 65, 7, 5, seed=2)
    for x in range(xl + 10, xl + 30):               # 용마루 처짐
        c.P(x, ye - 40, K('slate', 1))
    wall(c, xl, xr, ye + 1, yb, 'stone', seed=32, base=3)
    string_course(c, xl, xr, ye + 31)
    for i, wx in enumerate((18, 38, 60)):
        if i == 1: boarded(c, wx, ye + 9, 8, 15)
        else: lancet(c, wx, ye + 8, 8, 16, lit=False)
    for i, wx in enumerate((18, 38)):
        lancet(c, wx, ye + 39, 8, 17, lit=False)
    cx = 64
    gothic_door(c, cx - 8, yb - 31, 16, 27, seed=9, open_=True)
    c.R(cx - 5, yb - 18, 4, 14, K('wood', 2)); c.line(cx - 4, yb - 18, cx - 2, yb - 5, K('wood', 4))   # 쓰러진 문짝
    steps(c, cx, 18, yb + 1, 1)
    for (x0, y0, L) in ((52, ye + 4, 18), (98, ye + 28, 14), (24, ye + 30, 10)):     # 금
        x, y = x0, y0
        for k in range(L):
            c.P(x, y, K('stone', 1)); y += 1; x += random.Random(k + x0).choice((-1, 0, 0, 1))
    # 무너진 오른쪽 박공: 따로 그린 박공의 위쪽을 사선으로 들쭉날쭉 떼어 내고 본채 위에 얹는다(뒤 지붕은 그대로 보인다)
    g = Cv(c.w, c.h)
    yf = cross_gable(g, 98, 16, ye + 2, rise=30, depth=20, seed=34, finial=False)
    wall(g, 82, 114, ye + 2, yb, 'stone', seed=35)
    boarded(g, 94, ye + 9, 8, 15); lancet(g, 94, ye + 39, 8, 17)
    rnd = random.Random(5)
    for x in range(78, 118):
        cut = ye - 22 + int((x - 82) * .75) + rnd.choice((-1, 0, 0, 1, 2))
        for y in range(0, cut): g.clear(x, y)
        for y in range(cut, cut + 3):
            if g.opaque(x, y): g.P(x, y, K('stone', 5 if y == cut else 3))
    c.blit(g, 0, 0)
    c.VL(114, ye + 2, yb - ye - 2, K('ink', 1))
    for k, (rx, ry) in enumerate(((84, yb - 3), (118, yb - 2), (88, yb - 1))):   # 잔해
        c.R(rx, ry, 3, 2, K('stone', 4)); c.P(rx, ry, K('stone', 6)); c.HL(rx, ry + 2, 3, K('stone', 1))
    keep = lambda x, y: c.opaque(x, y) and y < yb - 4
    ivy(c, 14, yb - 5, 56, spread=10, seed=31, keep=keep, density=1.4)
    ivy(c, 110, yb - 5, 40, spread=7, seed=32, keep=keep, density=1.2)
    ivy(c, 70, ye + 4, 10, spread=14, seed=33, keep=keep, density=.6)
    finish(c)


def bars(c, x, y, w, h):
    """창 쇠창살(세로 2px 간격 + 가로 띠)."""
    for k in range(x + 1, x + w - 1, 2): c.VL(k, y + 2, h - 3, K('iron', 3))
    c.HL(x + 1, y + h // 2, w - 2, K('iron', 2))


def banner(c, x, y, w, h, m='velvet', trim='gold'):
    """걸개 깃발(글자 없음): 위 쇠막대, 천 2단 주름, 아래 제비꼬리, 금색 가장자리 무늬."""
    c.HL(x - 1, y, w + 2, K('iron', 4)); c.HL(x - 1, y + 1, w + 2, K('iron', 1))
    for yy in range(y + 2, y + h):
        for xx in range(x, x + w):
            t = 4 if xx == x else 2 if xx == x + w - 1 else 3
            if (xx - x) == w // 2: t -= 1
            c.P(xx, yy, K(m, t))
    for k in range(w // 2 + 1):
        c.clear(x + w // 2 - k, y + h - 1 - (w // 2 - k) // 2 * 0 - (k == 0 and 2 or 0))
    c.clear(x + w // 2, y + h - 1); c.clear(x + w // 2, y + h - 2); c.clear(x + w // 2 - 1, y + h - 1); c.clear(x + w // 2 + 1, y + h - 1)
    c.HL(x, y + 3, w, K(trim, 4)); c.HL(x, y + h - 5, w, K(trim, 3))
    c.P(x + w // 2, y + h // 2 - 1, K(trim, 5)); c.P(x + w // 2 - 1, y + h // 2, K(trim, 4)); c.P(x + w // 2 + 1, y + h // 2, K(trim, 3)); c.P(x + w // 2, y + h // 2 + 1, K(trim, 3))


def skylight(c, x0, x1, y_ridge, h=7):
    """박물관 지붕 유리 채광창: 용마루를 따라 쇠틀 유리 띠(윗면 밝게)."""
    for y in range(y_ridge, y_ridge + h):
        for x in range(x0, x1):
            t = 5 if y == y_ridge + 1 else 4 if y < y_ridge + 3 else 3
            col = K('glass', t)
            if (x - x0) % 5 == 0: col = K('iron', 2 if y > y_ridge + 1 else 4)
            c.P(x, y, col)
    c.HL(x0, y_ridge, x1 - x0, K('iron', 4)); c.HL(x0, y_ridge + h, x1 - x0, K('iron', 1))
    for x in range(x0 + 2, x1, 10): c.P(x, y_ridge + 2, K('glass', 6))


@REG.piece('gm-bld-gallery', '고딕 미술관·박물관(현관 세 아치·유리 채광창·걸개)', 10, 10, 'auto:1', 'architecture', 'gallery', role='building', kind='structure',
           tags=['미술관', '박물관', '갤러리', '전시관'], access=[(4, 10), (5, 10)],
           desc='넓은 석조 미술관. 가운데 높은 박공 탑(시계 장미창), 1층에 첨두 아치 세 개의 현관(가운데가 입구)과 넓은 4단 돌계단, 양 날개에 쌍창(불 켜진 전시실), 검붉은 걸개 넷, 지붕 용마루를 따라 유리 채광창, 모서리 첨탑 장식.',
           rules='입구는 맨 아래 줄 x 4~5(가운데 아치). 계단 앞 광장(포석)을 두고 양옆에 가로등·조각상을 둔다. 실내는 미술관 전시실 예제로 잇는다.')
def _gallery(c):
    yb = 159; ye = 95; xl, xr = 6, 154; cx = 80
    yr = range_roof(c, xl, xr, ye, 40, seed=41, crest=False)
    skylight(c, xl + 10, cx - 26, yr + 4); skylight(c, cx + 26, xr - 10, yr + 4)
    wall(c, xl, xr, ye + 1, yb, 'stone', seed=42, base=4)
    string_course(c, xl, xr, ye + 3); string_course(c, xl, xr, yb - 10)
    for i, wx in enumerate((14, 34, 112, 132)):          # 높은 쌍창(2층 높이)
        lancet(c, wx, ye + 10, 11, 40, lit=i in (1, 2), mull=True)
    banner(c, 27, ye + 12, 5, 26); banner(c, 49, ye + 12, 5, 26); banner(c, 106, ye + 12, 5, 26); banner(c, 127, ye + 12, 5, 26)
    for px in (xl + 2, xr - 3):                          # 모서리 첨탑 장식
        c.R(px - 2, ye - 8, 5, 8, K('stone', 4)); c.VL(px - 2, ye - 8, 8, K('stone', 5)); c.VL(px + 2, ye - 8, 8, K('stone', 2))
        spire_square(c, px, ye - 9, 3, 9, m='stone', finial=False)
    # 가운데 높은 박공 탑
    t0, t1 = cx - 26, cx + 26
    yf = cross_gable(c, cx, 26, ye - 14, rise=30, depth=30, seed=43)
    wall(c, t0, t1, ye - 14, yb, 'stone', seed=44, base=4)
    c.VL(t1, ye - 14, yb - ye + 14, K('ink', 1)); c.VL(t0 - 1, ye - 14, yb - ye + 14, K('stone', 2))
    rose(c, cx, ye - 22, 8)
    c.P(cx, ye - 25, K('gold', 6)); c.line(cx, ye - 22, cx, ye - 28, K('gold', 5)); c.line(cx, ye - 22, cx + 4, ye - 22, K('gold', 5))   # 시곗바늘
    string_course(c, t0, t1, ye - 2)
    lancet(c, cx - 20, ye + 4, 9, 22, lit=True, mull=True); lancet(c, cx - 4, ye + 4, 9, 22, lit=True, mull=True); lancet(c, cx + 12, ye + 4, 9, 22, lit=False, mull=True)
    # 현관 세 아치 + 기둥
    for k, ax in enumerate((cx - 25, cx - 8, cx + 9)):
        prof, _ = arch_profile(16)
        for i in range(16):
            for y in range(yb - 30 + prof[i], yb - 4):
                c.P(ax + i, y, K('ink', 1) if k != 1 else K('ink', 0))
            c.P(ax + i, yb - 31 + prof[i], K('stone', 6))
        if k == 1:
            gothic_door(c, ax + 1, yb - 29, 14, 25, seed=7)
        else:
            for i in range(2, 14, 3): c.VL(ax + i, yb - 24, 20, K('iron', 2))   # 옆 아치 쇠살
    for px in (cx - 26, cx - 9, cx + 8, cx + 25):
        c.R(px, yb - 31, 2, 27, K('stone', 5)); c.VL(px + 1, yb - 31, 27, K('stone', 3))
        c.R(px - 1, yb - 33, 4, 2, K('stone', 6)); c.R(px - 1, yb - 6, 4, 2, K('stone', 4))
    # 넓은 계단(4단)
    for k in range(4):
        ww = 54 + k * 6; y = yb - 12 + k * 3
        c.R(cx - ww // 2, y, ww, 2, K('stone', 5)); c.HL(cx - ww // 2, y, ww, K('stone', 6)); c.HL(cx - ww // 2, y + 2, ww, K('stone', 2))
    keep = lambda x, y: c.opaque(x, y) and y < yb - 4
    ivy(c, 10, yb - 5, 30, spread=6, seed=41, keep=keep, density=.8)
    ivy(c, 150, yb - 5, 26, spread=5, seed=42, keep=keep, density=.7)
    finish(c)


@REG.piece('gm-bld-asylum', '요양원·정신병원(3층 벽돌·시계탑·쇠창살 창)', 10, 11, 'auto:1', 'architecture', 'manor', role='building', kind='structure',
           tags=['정신병원', '요양원', '폐병원', '병원'], access=[(4, 11), (5, 11)],
           desc='검붉은 벽돌 3층 요양원. 가운데 사각 시계탑(사각뿔 지붕), 층마다 쇠창살 창, 석재 귀돌·돌림띠, 굴뚝 넷, 무쇠 정문.',
           rules='정문 맨 아래 줄 x 4~5. 높은 철책과 정문으로 둘러싼다. 폐병원은 창 일부를 판자로.')
def _asylum(c):
    yb = 175; ye = 79; xl, xr = 6, 154; cx = 80
    for chx in (20, 46, 112, 138): chimney(c, chx, 34, 20, w=6, m='stone', pots=1)
    range_roof(c, xl, xr, ye, 36, seed=51, moss=.02)
    wall(c, xl, xr, ye + 1, yb, 'brick', seed=52)
    for yy in (ye + 31, ye + 63): string_course(c, xl, xr, yy)
    for row, wy in enumerate((ye + 8, ye + 40, ye + 72)):
        for i, wx in enumerate((14, 30, 46, 108, 124, 140)):
            lancet(c, wx, wy, 7, 17 if row < 2 else 16, lit=(row, i) in ((0, 1), (2, 4)))
            bars(c, wx, wy + 1, 7, 15)
    t0, t1 = cx - 18, cx + 18
    wall(c, t0, t1, ye - 34, yb, 'brick', seed=53)
    c.VL(t1, ye - 34, yb - ye + 34, K('ink', 1)); c.VL(t0 - 1, ye - 34, yb - ye + 34, K('brick', 2))
    for yy in (ye - 3, ye + 31, ye + 63): string_course(c, t0, t1, yy)
    c.R(t0 - 2, ye - 37, t1 - t0 + 4, 3, K('stone', 5)); c.HL(t0 - 2, ye - 37, t1 - t0 + 4, K('stone', 6)); c.HL(t0 - 2, ye - 35, t1 - t0 + 4, K('stone', 1))
    spire_square(c, cx, ye - 38, 20, 30, seed=54)
    c.ellipse(cx, ye - 18, 8, 8, K('stone', 5)); c.ellipse(cx, ye - 18, 6.5, 6.5, K('bone', 5))
    for k in range(12):
        a = k * math.pi / 6; c.P(int(cx + math.cos(a) * 5.5), int(ye - 18 + math.sin(a) * 5.5), K('ink', 2))
    c.line(cx, ye - 18, cx, ye - 22, K('ink', 1)); c.line(cx, ye - 18, cx + 3, ye - 16, K('ink', 1))
    lancet(c, cx - 4, ye + 8, 8, 17, lit=True); bars(c, cx - 4, ye + 9, 8, 15)
    lancet(c, cx - 4, ye + 40, 8, 17); bars(c, cx - 4, ye + 41, 8, 15)
    gothic_door(c, cx - 9, yb - 32, 18, 28, m='iron', seed=8)
    steps(c, cx, 20, yb + 1, 2)
    finish(c)


@REG.piece('gm-bld-orphanage', '고아원(2층 벽돌·종 지붕·박공 둘)', 8, 9, 'auto:1', 'architecture', 'manor', role='building', kind='structure',
           tags=['고아원', '학교', '기숙사'], access=[(3, 9), (4, 9)],
           desc='검붉은 벽돌 2층 고아원. 앞 박공 둘(둥근 창), 가운데 정문 위 작은 종 지붕(종), 1·2층 첨두창, 담쟁이.',
           rules='정문 맨 아래 줄 x 3~4. 마당(흙)과 낮은 담을 앞에 둔다.')
def _orphanage(c):
    yb = 143; ye = 79; xl, xr = 6, 122; cx = 64
    chimney(c, 16, 34, 20, m='brick', pots=2)
    range_roof(c, xl, xr, ye, 40, seed=61, moss=.03)
    wall(c, xl, xr, ye + 1, yb, 'brick', seed=62)
    string_course(c, xl, xr, ye + 31)
    for gx in (30, 98):
        yf = cross_gable(c, gx, 17, ye + 2, rise=28, depth=24, seed=63 + gx, m='brick')
        wall(c, gx - 17, gx + 17, ye + 2, yb, 'brick', seed=64 + gx)
        c.VL(gx + 17, ye + 2, yb - ye - 2, K('ink', 1))
        string_course(c, gx - 17, gx + 17, ye + 31)
        c.ellipse(gx, ye - 9, 4, 4, K('stone', 5)); c.ellipse(gx, ye - 9, 2.6, 2.6, K('glass', 2)); c.P(gx - 1, ye - 10, K('glass', 5))
        window_row(c, gx - 15, gx + 15, ye + 8, 16, 2, lit=(0,) if gx > 60 else (), seed=gx)
        window_row(c, gx - 15, gx + 15, ye + 39, 17, 2, seed=gx + 1)
    # 가운데 정문 + 종 지붕
    c.R(cx - 7, ye - 26, 14, 4, K('stone', 5)); c.HL(cx - 7, ye - 26, 14, K('stone', 6))
    for px in (cx - 6, cx + 4): c.R(px, ye - 22, 2, 14, K('stone', 4)); c.VL(px + 1, ye - 22, 14, K('stone', 2))
    c.R(cx - 3, ye - 19, 6, 6, K('gold', 3)); c.HL(cx - 3, ye - 19, 6, K('gold', 5)); c.P(cx, ye - 13, K('gold', 2))
    spire_square(c, cx, ye - 27, 9, 12, seed=65)
    lancet(c, cx - 4, ye + 8, 8, 16, lit=True)
    gothic_door(c, cx - 9, yb - 32, 18, 28, seed=6)
    steps(c, cx, 20, yb + 1, 2)
    keep = lambda x, y: c.opaque(x, y) and y < yb - 4
    ivy(c, 48, yb - 5, 30, spread=6, seed=61, keep=keep, density=.8)
    finish(c)


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
