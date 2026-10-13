"""pirate_isles 실내 가구 — 선장실·주방/선창·술집·오두막·보물 방.

모두 3/4 탑뷰: 깊은 윗면(뒤 모서리 어두운 줄 · 앞 밝은 턱 · 사다리꼴) + 남쪽 앞면(2~3단 어둡게, 밑 AO).
윗면에는 물건(종이·잔·병·지도)을 올려 «면»으로 읽히게 한다. 바닥 그림자는 굽지 않는다(바닥 floor-ship/tavern/reed/cave 위에 선다).
벽걸이(wall_mounted)는 wall-face-* 앞면 위에 겹쳐 놓는다. 북벽에 붙는 가구는 desc 에 적었다.
"""
import math
from pi_core import *


# ------------------------------------------------------------------ 공용 그리개
def top_slab(c, x, y, w, rows, mat='wood', t=1, inset=2, s=0, tex='planks', bw=3):
    """사다리꼴 윗면: 뒤(위)가 inset 만큼 좁다. 판자 결 + 뒤 모서리 어두운 줄 + 앞 밝은 턱 + 왼 밝은·오 어두운 옆 모서리."""
    tmp = Cv(w, rows)
    if tex == 'planks': planks(tmp, 0, 0, w, rows, mat, t, bw=bw, s=s, nails=False)
    else: tmp.R(0, 0, w, rows, K(mat, t))
    for j in range(rows):
        a = int(round(inset * (1 - j / max(1, rows - 1))))
        for i in range(a, w - a): c.P(x + i, y + j, tmp.get(i, j))
        c.P(x + a, y + j, K(mat, t + 1)); c.P(x + w - 1 - a, y + j, K(mat, t - 1))
    c.HL(x + inset, y, w - 2 * inset, K(mat, t - 2))
    c.HL(x, y + rows - 1, w, K(mat, t + 2))
    return y + rows


def face(c, x, y, w, h, mat='wood', ft=-1, tex=None, s=0):
    """남쪽 앞면: 위 턱 밑 그늘 · 왼 밝게 · 오 어둡게 · 밑 AO."""
    if tex == 'vplanks': planks(c, x, y, w, h, mat, ft, bw=4, plen=h + 7, s=s, vertical=True, nails=False)
    else: c.R(x, y, w, h, K(mat, ft))
    c.HL(x, y, w, K(mat, ft - 1))
    if h > 2: c.HL(x, y + h - 1, w, K(mat, ft - 2))
    c.VL(x, y, h, K(mat, ft + 1)); c.VL(x + w - 1, y, h, K(mat, ft - 2))


def panel(c, x, y, w, h, mat='wood', ft=-1):
    """오목 판(문짝·서랍): 위·왼 그늘, 아래·오 밝은 테."""
    c.R(x, y, w, h, K(mat, ft))
    c.HL(x, y, w, K(mat, ft - 2)); c.VL(x, y, h, K(mat, ft - 2))
    c.HL(x, y + h - 1, w, K(mat, ft + 1)); c.VL(x + w - 1, y, h, K(mat, ft + 1))


def leg(c, x, y, w, h, mat='wood', t=-1):
    c.R(x, y, w, h, K(mat, t)); c.VL(x, y, h, K(mat, t + 1)); c.VL(x + w - 1, y, h, K(mat, t - 2)); c.HL(x, y + h - 1, w, K(mat, t - 2))


def knob(c, x, y): c.P(x, y, K('gold', 2)); c.P(x + 1, y, K('gold', -1)); c.P(x, y + 1, K('gold', -1))


def mug(c, x, y, mat='wood', foam=True, band='iron'):
    """술잔(5행): 뒤 테 · 거품 · 몸통(왼 밝게) · 쇠 띠 · 손잡이."""
    c.HL(x, y, 4, K(band, 1))
    c.P(x, y + 1, K(band, 2)); c.P(x + 3, y + 1, K(band, -1))
    c.P(x + 1, y + 1, K('cloth', 3) if foam else K('shadow', 1)); c.P(x + 2, y + 1, K('cloth', 2) if foam else K('shadow', 2))
    for j in range(2, 5):
        c.P(x, y + j, K(mat, 1)); c.P(x + 1, y + j, K(mat, 0)); c.P(x + 2, y + j, K(mat, -1)); c.P(x + 3, y + j, K(mat, -2))
    c.HL(x, y + 3, 4, K(band, 0)); c.P(x, y + 3, K(band, 2))
    c.P(x + 4, y + 2, K(mat, -2)); c.P(x + 4, y + 3, K(mat, -3))
    c.HL(x, y + 5, 4, K(mat, -3))


def bottle(c, x, y, mat='leaf', h=7, cork=True):
    """병(폭 3): 코르크 · 목 · 어깨 · 몸통(왼쪽 반짝) · 밑."""
    if cork: c.P(x + 1, y, K('wood', 2))
    c.P(x + 1, y + 1, K(mat, 0)); c.P(x + 1, y + 2, K(mat, 1))
    c.P(x, y + 3, K(mat, 1)); c.P(x + 1, y + 3, K(mat, 0)); c.P(x + 2, y + 3, K(mat, -2))
    for j in range(4, h):
        c.P(x, y + j, K(mat, 0)); c.P(x + 1, y + j, K(mat, -1)); c.P(x + 2, y + j, K(mat, -3))
    c.VL(x, y + 4, 2, K(mat, 3))
    c.HL(x, y + h, 3, K(mat, -3))
    c.P(x - 1, y + 4, K('shadow', 1)); c.P(x + 3, y + 4, K('shadow', 1))


def candle(c, x, y, h=4, dish=True):
    """양초(폭 2): 불꽃 2행 · 심지 · 밀랍(흘러내림) · 금 접시."""
    c.P(x, y, K('fire', 3)); c.P(x, y + 1, K('fire', 2)); c.P(x + 1, y + 1, K('fire', 1))
    c.P(x, y + 2, K('shadow', 1))
    for j in range(h):
        c.P(x, y + 2 + j, K('bone', 2) if j else K('bone', 3)); c.P(x + 1, y + 2 + j, K('bone', 0))
    c.P(x + 1, y + 3, K('bone', 3))
    if dish:
        c.HL(x - 1, y + 2 + h, 4, K('gold', 1)); c.P(x - 1, y + 2 + h, K('gold', 2)); c.HL(x - 1, y + 3 + h, 4, K('gold', -2))


def parchment(c, x, y, w, h, s=0):
    """누런 양피지: 왼·위 밝은 테, 아래·오 그늘, 말린 귀퉁이, 얼룩."""
    for j in range(h):
        for i in range(w):
            t = 2 if (i + j + hsh(i, j, s) % 3) % 5 else 1
            if hsh(i // 3, j // 2, s + 1) % 13 == 0: t = 1
            c.P(x + i, y + j, K('sand', t))
    c.HL(x, y, w, K('sand', 3)); c.VL(x, y, h, K('sand', 3))
    c.HL(x, y + h - 1, w, K('sand', 0)); c.VL(x + w - 1, y, h, K('sand', 0))
    c.P(x, y, K('sand', 1)); c.P(x + w - 1, y + h - 1, K('sand', -1)); c.P(x + w - 2, y + h - 1, K('sand', 3))


def books(c, x, y, w, h, s=0):
    """책등 줄: 폭 2~3 · 높이 들쭉 · 위 밝은 줄 · 금 띠(글자 없음)."""
    mats = ('red', 'blue', 'teal', 'terra', 'moss', 'dark', 'red', 'cloth')
    i = 0; k = 0
    while i < w:
        bw = 2 + hsh(k, 1, s) % 2
        if i + bw > w: bw = w - i
        m = mats[hsh(k, 2, s) % len(mats)]; hh = h - hsh(k, 3, s) % 3
        if hsh(k, 4, s) % 7 == 0 and bw >= 2:           # 빈칸(눕힌 책 자리)
            c.R(x + i, y + h - 2, bw + 1, 2, K('blue', -1)); c.HL(x + i, y + h - 2, bw + 1, K('blue', 1))
            i += bw + 1; k += 1; continue
        for jj in range(hh):
            yy = y + h - hh + jj
            c.P(x + i, yy, K(m, 1))
            for q in range(1, bw - 1): c.P(x + i + q, yy, K(m, 0))
            if bw > 1: c.P(x + i + bw - 1, yy, K(m, -2))
        c.HL(x + i, y + h - hh, bw, K(m, 2))
        if hh > 4: c.HL(x + i, y + h - hh + 2, bw, K('gold', 0 if m != 'cloth' else -1))
        i += bw; k += 1


def coin(c, x, y): c.P(x, y, K('gold', 3)); c.P(x + 1, y, K('gold', 1)); c.P(x, y + 1, K('gold', 0)); c.P(x + 1, y + 1, K('gold', -1))


def bowl(c, cx, cy, rx, ry, mat='wood', fill=None):
    """사발: 테 타원(안쪽 보임) + 아래 몸통 반달."""
    c.ellf(cx, cy + ry * 0.9, rx, ry * 1.4, lambda x, y, nx, ny, d: K(mat, -1 if nx > .3 else 0) if ny > 0 else None)
    c.ellf(cx, cy, rx, ry, lambda x, y, nx, ny, d: K(mat, 2 if ny < 0 and nx < .3 else 1) if d > .5 else (K(fill[0], fill[1] + (1 if ny < -.2 and nx < 0 else 0)) if fill else K(mat, -2)))


def keg_end(c, cx, cy, rx, ry, mat='wood', hoop='iron', tap=True, s=0):
    """누운 통의 남쪽 둥근 끝(마구리): 세로 판 · 쇠테 고리 · 마개/꼭지."""
    def f(x, y, nx, ny, d):
        if d > .78: return K(hoop, 1 if (nx + ny) < -.3 else -1 if (nx + ny) > .5 else 0)
        if d > .62: return K(mat, -2)
        t = 1 if nx < -.3 else 0 if nx < .35 else -1
        if (x - int(cx)) % 3 == 0: t -= 1
        return K(mat, t)
    c.ellf(cx, cy, rx, ry, f)
    if tap:
        tx = int(round(cx)) - 1; ty = int(round(cy + ry * 0.35))
        c.R(tx, ty, 3, 2, K('gold', 1)); c.P(tx, ty, K('gold', 3)); c.P(tx + 2, ty + 1, K('gold', -2))
        c.VL(tx + 1, ty + 2, 2, K('gold', 0)); c.P(tx + 1, ty + 3, K('gold', -2))
    else:
        c.P(int(cx), int(cy), K('dark', -2)); c.P(int(cx) - 1, int(cy), K('dark', 0))


def keg_body(c, cx, y0, y1, rx, mat='wood', hoop='iron'):
    """누운 통의 윗등(남북 축): 위에서 보이는 널 — 가로 조명(왼 밝게) + 쇠테 가로줄."""
    for y in range(y0, y1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            nx = (x + .5 - cx) / rx
            if abs(nx) > 1: continue
            t = 2 if nx < -.5 else 1 if nx < -.1 else 0 if nx < .35 else -1 if nx < .7 else -2
            if (x - int(cx - rx)) % 3 == 2: t -= 1
            c.P(x, y, K(mat, t))
    for hy in (y0 + 1, y1 - 2):
        if y0 <= hy < y1:
            for x in range(int(cx - rx), int(cx + rx) + 1):
                nx = (x + .5 - cx) / rx
                if abs(nx) <= 1: c.P(x, hy, K(hoop, 1 if nx < -.3 else 0 if nx < .4 else -2))


# ================================================================== 선장실 · 선실
@piece('captain-desk', "captain's wooden writing desk with sea chart, quill in inkwell and oil lamp on top, drawers in front", 2, 2, 'low_furniture',
       group='interior', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['선장실', '책상', '배'],
       desc='선장 책상(윗면에 해도·깃펜·잉크병·기름등, 앞면 서랍 둘). 선장실 가운데나 창 앞. 2×2 전부 막힘.')
def _cdesk(c):
    fy = top_slab(c, 1, 5, 30, 12, 'dark', t=2, inset=2, s=11)
    face(c, 1, fy, 30, 32 - fy, 'dark', ft=-1)
    # 서랍 다리 둘 + 가운데 무릎 자리
    for px in (2, 21):
        for k, (yy, hh) in enumerate(((fy + 2, 4), (fy + 7, 5))):
            panel(c, px + 1, yy, 7, hh, 'dark', 0); knob(c, px + 4, yy + hh // 2)
    c.R(11, fy + 5, 10, 32 - fy - 6, K('shadow', 1)); c.HL(11, fy + 5, 10, K('shadow', 0)); c.VL(11, fy + 5, 32 - fy - 6, K('shadow', 2))
    panel(c, 11, fy + 1, 10, 3, 'dark', 0); knob(c, 15, fy + 2)
    c.HL(1, 31, 30, K('dark', -3))
    # 윗면 물건: 해도
    parchment(c, 5, 8, 13, 7, s=3)
    c.line(7, 13, 10, 10, K('red', 0)); c.P(11, 10, K('red', 0)); c.line(12, 11, 15, 9, K('red', 0))
    c.P(15, 9, K('red', -2)); c.P(16, 10, K('red', -2)); c.P(16, 8, K('red', -2))   # X
    c.R(7, 9, 3, 2, K('sand', 0)); c.P(7, 9, K('sand', -1))
    # 잉크병 + 깃펜
    c.R(21, 11, 3, 3, K('iron', -2)); c.HL(21, 11, 3, K('iron', 1)); c.P(22, 11, K('shadow', 0))
    c.line(22, 10, 25, 5, K('bone', 3)); c.line(23, 10, 26, 5, K('bone', 1)); c.P(26, 4, K('bone', 2)); c.P(24, 7, K('bone', 2))
    # 기름등
    c.ellf(27.5, 14, 2.5, 1.2, lambda x, y, nx, ny, d: K('gold', 2 if ny < 0 else 0))
    c.R(26, 8, 3, 5, K('fire', 2)); c.VL(26, 8, 5, K('fire', 3)); c.VL(28, 8, 5, K('fire', 0)); c.P(27, 10, K('fire', 3))
    c.HL(26, 7, 3, K('iron', 1)); c.HL(25, 13, 5, K('gold', 1)); c.P(27, 6, K('iron', 0))
    c.outline()


@piece('chair-ship', "captain's high-backed wooden armchair with red leather seat cushion, back toward the north", 1, 1, 'seat',
       group='interior', solid=[(0, 0)], tags=['선장실', '의자', '배'],
       desc='선장 의자(높은 등받이 = 북쪽, 붉은 가죽 방석, 팔걸이). 책상 북쪽에 두고 남쪽을 본다.')
def _cchair(c):
    # 등받이(어두운 나무 틀 + 그늘진 가죽 판)
    c.R(3, 0, 10, 8, K('dark', 0)); c.HL(3, 0, 10, K('dark', 2)); c.HL(4, 1, 8, K('dark', 1)); c.R(6, 0, 4, 1, K('gold', 1)); c.P(7, 0, K('gold', 3))
    c.VL(3, 1, 7, K('dark', 1)); c.VL(12, 1, 7, K('dark', -2))
    for y in range(2, 7):
        for x in range(5, 11): c.P(x, y, K('red', (0 if x < 7 else -1 if x < 9 else -2)))
    for (x, y) in ((6, 3), (9, 3), (7, 5)): c.P(x, y, K('red', -3)); c.P(x, y - 1, K('red', 1))
    # 방석 윗면(밝은 가죽, 5행) — 등받이보다 넓다
    for y in range(7, 12):
        for x in range(3, 13):
            t = 2 if x < 7 else 1 if x < 11 else 0
            if y == 7: t = -1
            if y == 11: t = 3
            c.P(x, y, K('red', t))
    c.P(5, 9, K('red', 3)); c.P(6, 9, K('red', 3)); c.P(9, 10, K('red', 0))
    # 팔걸이(윗면)
    for (ax, t) in ((1, 1), (13, -1)):
        c.R(ax, 5, 2, 8, K('dark', t - 1)); c.HL(ax, 5, 2, K('dark', 3)); c.HL(ax, 6, 2, K('dark', 2)); c.VL(ax, 7, 6, K('dark', t))
    # 앞 가로대 + 다리
    face(c, 2, 12, 12, 2, 'dark', ft=0); c.P(7, 12, K('gold', 1)); c.P(8, 12, K('gold', -1))
    leg(c, 2, 14, 2, 2, 'dark', 0); leg(c, 12, 14, 2, 2, 'dark', -1)
    c.outline()


@piece('map-table', 'large chart table covered with a sea chart showing islands, a dotted route line, compass rose and brass dividers', 2, 2, 'low_furniture',
       group='interior', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['선장실', '탁자', '지도'],
       desc='해도 탁자(윗면 전체에 섬·점선 항로·나침도·디바이더). 선장실 가운데. 2×2 전부 막힘.')
def _maptable(c):
    fy = top_slab(c, 1, 2, 30, 16, 'wood', t=1, inset=2, s=21)
    face(c, 1, fy, 30, 3, 'wood', ft=-1)
    for (lx, t) in ((6, -3), (24, -3)): leg(c, lx, fy + 3, 2, 5, 'wood', t)          # 뒤 다리(어둡게·짧게)
    for lx in (2, 27): leg(c, lx, fy + 3, 3, 32 - fy - 3, 'wood', -1)
    c.HL(5, 28, 22, K('wood', -2)); c.HL(5, 29, 22, K('wood', -3))                       # 가로대
    # 해도
    parchment(c, 4, 4, 24, 12, s=7)
    for (cx, cy, rx, ry) in ((9, 8, 3, 2), (21, 7, 2.5, 1.6), (18, 12, 4, 2)):
        c.ellf(cx, cy, rx, ry, lambda x, y, nx, ny, d: K('sand', -1) if d > .55 else K('sand', 0 if (x + y) % 3 else 1))
    c.P(9, 7, K('moss', 0)); c.P(18, 11, K('moss', 0)); c.P(19, 12, K('moss', 1))
    for k, (x, y) in enumerate(((11, 9), (13, 10), (15, 10), (17, 9), (19, 8))): c.P(x, y, K('red', 0))
    c.P(21, 6, K('red', -1)); c.P(20, 7, K('red', -1)); c.P(22, 7, K('red', -1)); c.P(21, 7, K('red', 1))   # X
    # 나침도(왼 아래)
    cx, cy = 7, 13
    c.VL(cx, cy - 2, 5, K('terra', -1)); c.HL(cx - 2, cy, 5, K('terra', -1)); c.P(cx, cy - 2, K('red', 0)); c.P(cx, cy, K('gold', 2))
    # 디바이더(쇠 V)
    c.line(25, 13, 23, 5, K('iron', 2)); c.line(25, 13, 27, 6, K('iron', 0)); c.P(25, 13, K('gold', 2)); c.P(25, 14, K('gold', 0))
    # 문진(쇠)
    c.R(4, 4, 2, 2, K('iron', 0)); c.P(4, 4, K('iron', 2))
    c.outline()


@piece('bookshelf-ship', 'tall dark wooden ship bookshelf with books held by rope rails, rolled charts on top', 2, 2, 'tall_furniture',
       group='interior', solid=[(0, 1), (1, 1)], tags=['선장실', '책장', '배'],
       desc='배 책장(책이 흔들려 떨어지지 않게 밧줄 난간, 윗면에 말린 해도). 북벽에 붙인다. 아래 줄 막힘(윗줄은 벽 앞 겹침).')
def _bookshelf(c):
    fy = top_slab(c, 1, 3, 30, 5, 'dark', t=2, inset=1, s=31)
    face(c, 1, fy, 30, 32 - fy, 'dark', ft=-1)
    c.R(4, fy, 24, 32 - fy - 2, K('shadow', 2))
    for k in range(4, 28, 5): c.VL(k, fy, 32 - fy - 2, K('dark', -3))
    c.VL(1, fy, 32 - fy, K('dark', 1)); c.VL(2, fy, 32 - fy, K('dark', 0)); c.VL(3, fy, 32 - fy, K('dark', -2))
    c.VL(28, fy, 32 - fy, K('dark', 0)); c.VL(29, fy, 32 - fy, K('dark', -1))
    for i, sy in enumerate((fy + 7, fy + 15)):
        books(c, 4, sy - 7 + 1, 24, 6, s=40 + i)
        c.HL(4, sy, 24, K('dark', 1)); c.HL(4, sy + 1, 24, K('dark', -2))
        rope_line(c, 3, sy - 4, 28, sy - 4, sag=1)
        c.P(3, sy - 4, K('iron', 1)); c.P(28, sy - 4, K('iron', 1))
    books(c, 4, fy + 17, 24, 5, s=49)
    c.R(1, 29, 30, 3, K('dark', -2)); c.HL(1, 29, 30, K('dark', 0)); c.HL(1, 31, 30, K('dark', -3))
    # 윗면: 말린 해도 둘 + 작은 병
    for (x, y, l) in ((5, 3, 11), (8, 5, 9)):
        c.HL(x, y, l, K('cloth', 3)); c.HL(x, y + 1, l, K('cloth', 1)); c.P(x, y, K('cloth', 2)); c.P(x, y + 1, K('cloth', -1))
        c.P(x + l - 1, y, K('sand', 1)); c.P(x + l - 1, y + 1, K('sand', -1)); c.P(x + 4, y + 1, K('red', 0))
    bottle(c, 23, 0, 'teal', h=6)
    c.outline()


@piece('globe', 'world globe on a small round wooden side table, seen from above at 3/4 (round table top visible, curved latitude lines)', 1, 2, 'other',
       group='interior', solid=[(0, 1)], tags=['선장실', '지구의'],
       desc='작은 둥근 탁자 위 지구의(금 자오환). 선장실 구석. 아래 칸 막힘.')
def _globe(c):
    # 둥근 탁자: 발 + 기둥 + 두께 + 윗면(타원 6행)
    c.ellf(8, 30, 5.5, 1.8, lambda x, y, nx, ny, d: K('wood', 1 if ny < 0 else -2))
    c.R(7, 23, 3, 7, K('wood', -1)); c.VL(7, 23, 7, K('wood', 1)); c.VL(9, 23, 7, K('wood', -3))
    c.ellf(8, 21, 7.4, 3.6, lambda x, y, nx, ny, d: K('wood', -2 if nx > .3 else -1) if ny > 0 else None)
    tmp = Cv(16, 32); planks(tmp, 0, 0, 16, 32, 'wood', 1, bw=3, s=81, nails=False)
    c.ellf(8, 19.6, 7.4, 3.6, lambda x, y, nx, ny, d: K('wood', 3) if ny > .5 and d > .7 else K('wood', -1) if ny < -.5 and d > .7 else tmp.get(x, y))
    # 금 받침(발) — 탁자 윗면 위
    c.ellf(8, 19.2, 3.2, 1.3, lambda x, y, nx, ny, d: K('gold', 2 if nx < 0 else 0))
    c.VL(8, 16, 3, K('gold', -1))
    # 공(바다 + 땅) + 위에서 본 휘어진 위도선
    def gf(x, y, nx, ny, d):
        nz = math.sqrt(max(0, 1 - d)); li = -.55 * nx - .6 * ny + .6 * nz
        t = 2 if li > .9 else 1 if li > .6 else 0 if li > .3 else -1 if li > 0 else -2
        land = (hsh((x + 1) // 3, y // 3, 5) % 3 == 0) and d < .85
        return K('leaf' if land and t > 0 else 'sand' if land else 'deep', t + (0 if land else 1) - (1 if land and t > 0 else 0))
    c.ellf(8, 9.5, 5.6, 5.6, gf)
    for (oy, amp) in ((-2.0, 1.2), (1.0, 1.6)):
        for x in range(3, 14):
            nx = (x + .5 - 8) / 5.4
            if abs(nx) < .98: c.P(x, round(9.5 + oy + amp * math.sqrt(max(0, 1 - nx * nx))), K('gold', 1 if nx < 0 else -1))
    c.ellf(8, 5.4, 2.4, 1.0, lambda x, y, nx, ny, d: K('deep', 3))             # 북극 윗면 반짝
    c.P(5, 7, K('foam', 2))
    # 자오환(금) 오른쪽 반원
    for k in range(40):
        a = -math.pi / 2 + math.pi * k / 39
        c.P(round(8 + 6.6 * math.cos(a) - .5), round(9.5 + 6.6 * math.sin(a) - .5), K('gold', 2 if a < -.6 else 1 if a < .4 else -1))
    c.P(8, 3, K('gold', 3))
    c.outline()


@piece('bunk-ship', 'wooden ship bunk bed with pillow at the north end and a folded blue wool blanket', 1, 2, 'low_furniture',
       group='interior', solid=[(0, 0), (0, 1)], tags=['선실', '침대', '배'],
       desc='배 침상(머리 = 북쪽 베개, 파란 담요, 옆 난간). 선실 벽 따라 세로로. 두 칸 막힘.')
def _bunk(c):
    # 머리판
    c.R(0, 0, 16, 3, K('dark', 2)); c.HL(0, 0, 16, K('dark', 0)); c.HL(0, 2, 16, K('dark', 3))
    face(c, 0, 3, 16, 4, 'dark', ft=-1); panel(c, 3, 4, 10, 2, 'dark', 0)
    # 옆 난간(윗면 밝게)
    for (x, t) in ((0, 1), (14, -1)):
        c.R(x, 7, 2, 20, K('dark', t)); c.VL(x, 7, 20, K('dark', t + 1)); c.VL(x + 1, 7, 20, K('dark', t - 1))
    # 매트리스 + 베개
    c.R(2, 7, 12, 20, K('cloth', 1))
    c.R(3, 8, 10, 5, K('cloth', 3)); c.HL(3, 8, 10, K('cloth', 2)); c.VL(3, 8, 5, K('cloth', 2)); c.HL(3, 12, 10, K('cloth', 0)); c.VL(12, 9, 4, K('cloth', 1))
    c.P(7, 10, K('cloth', 2)); c.P(8, 10, K('cloth', 2)); c.HL(2, 13, 12, K('cloth', -1))
    # 담요(접힌 끝 + 줄무늬)
    for y in range(14, 27):
        for x in range(2, 14):
            t = 1 if x < 5 else 0 if x < 11 else -1
            if y == 14: t = 2
            if y == 15: t = -1
            if y in (19, 20): c.P(x, y, K('cloth', 2 if y == 19 else 0)); continue
            if (x + y * 3) % 11 == 0: t -= 1
            c.P(x, y, K('blue', t))
    c.HL(2, 26, 12, K('blue', -2))
    # 발판
    c.R(0, 27, 16, 2, K('dark', 2)); c.HL(0, 27, 16, K('dark', 3))
    face(c, 0, 29, 16, 3, 'dark', ft=-1)
    c.outline()


@piece('sea-chest', "sailor's sea chest with teal painted lid, iron corners and rope handles", 1, 1, 'box',
       group='interior', solid=[(0, 0)], tags=['선실', '상자', '배'],
       desc='선원 궤짝(청록 칠 뚜껑·쇠 모서리·밧줄 손잡이). 침상 발치.')
def _seachest(c):
    fy = top_slab(c, 1, 3, 14, 6, 'teal', t=1, inset=1, s=5)
    c.HL(1, fy - 1, 14, K('teal', 3))
    face(c, 1, fy, 14, 15 - fy, 'wood', ft=-1, tex='vplanks', s=6)
    c.HL(1, fy, 14, K('teal', -2)); c.HL(1, fy + 1, 14, K('teal', -1))
    for (x, y) in ((1, fy + 2), (12, fy + 2), (1, 12), (12, 12)):
        c.R(x, y, 3, 2, K('iron', 0)); c.P(x, y, K('iron', 2))
    c.R(7, fy + 1, 2, 3, K('gold', 1)); c.P(7, fy + 1, K('gold', 3)); c.P(8, fy + 3, K('gold', -2))
    c.R(4, 4, 8, 1, K('teal', 2)); c.R(4, 6, 8, 1, K('teal', 0))
    for sx in (0, 15):
        c.P(sx, fy + 2, K('thatch', 1)); c.P(sx, fy + 3, K('thatch', 0)); c.P(sx, fy + 4, K('thatch', -1))
    c.HL(1, 15, 14, K('wood', -3))
    c.outline()


@piece('wardrobe-ship', 'tall dark wooden ship wardrobe seen from above at 3/4: deep top surface with a folded blanket, two panelled doors', 1, 2, 'tall_furniture',
       group='interior', solid=[(0, 1)], tags=['선장실', '옷장', '배'],
       desc='배 옷장(문짝 둘, 윗면에 접은 담요). 북벽에 붙인다. 아래 칸 막힘.')
def _wardrobe(c):
    fy = top_slab(c, 0, 1, 16, 8, 'dark', t=2, inset=2, s=13)
    face(c, 0, fy, 16, 32 - fy, 'dark', ft=-1)
    c.HL(0, fy, 16, K('dark', -3)); c.HL(0, fy + 1, 16, K('dark', 0))
    for dx in (2, 8):
        panel(c, dx, fy + 3, 6, 8, 'dark', 0); panel(c, dx, fy + 13, 6, 7, 'dark', 0)
        c.R(dx + 2, fy + 5, 2, 4, K('dark', 1)); c.R(dx + 2, fy + 15, 2, 2, K('dark', 1))
    c.VL(8, fy + 2, 19, K('dark', -3))
    knob(c, 6, fy + 11); knob(c, 9, fy + 11)
    c.R(0, 29, 16, 3, K('dark', -2)); c.HL(0, 29, 16, K('dark', 1)); c.HL(0, 31, 16, K('dark', -3))
    # 윗면 위: 접은 담요(뒤쪽) + 작은 상자
    c.R(3, 2, 7, 4, K('blue', 0)); c.HL(3, 2, 7, K('blue', 2)); c.HL(3, 4, 7, K('blue', 1)); c.HL(3, 5, 7, K('blue', -2)); c.VL(9, 2, 4, K('blue', -1))
    c.R(11, 4, 3, 3, K('gold', 0)); c.HL(11, 4, 3, K('gold', 2)); c.P(13, 6, K('gold', -2))
    c.outline()


@piece('lantern-wall', 'hanging oil lantern on an iron wall bracket, glowing', 1, 1, 'wall_mounted',
       group='interior', tags=['등불', '벽걸이', '배'],
       desc='벽 쇠 받침에 매단 기름 등(불빛). 벽 앞면(wall-face-*) 위에 겹쳐 놓는다. 통행.')
def _wlantern(c):
    c.R(1, 1, 3, 6, K('iron', -1)); c.VL(1, 1, 6, K('iron', 1)); c.P(2, 3, K('iron', 2))
    c.HL(3, 2, 9, K('iron', 0)); c.HL(3, 1, 8, K('iron', 1)); c.P(11, 2, K('iron', 1))
    c.VL(10, 3, 1, K('iron', -1))
    # 갓 + 유리 + 받침
    c.HL(9, 4, 3, K('iron', 1)); c.HL(8, 5, 5, K('iron', 0)); c.P(8, 5, K('iron', 2))
    c.R(7, 6, 7, 7, K('iron', -2))
    c.R(8, 7, 5, 5, K('fire', 1)); c.VL(8, 7, 5, K('fire', 3)); c.R(9, 8, 2, 3, K('fire', 3)); c.P(10, 9, K('fire', 2)); c.VL(12, 7, 5, K('fire', 0))
    c.VL(10, 7, 5, K('iron', -1))
    c.VL(7, 6, 7, K('iron', 0)); c.VL(13, 6, 7, K('iron', -2))
    c.HL(7, 13, 7, K('iron', 0)); c.HL(8, 14, 5, K('iron', -2))
    c.outline()


@piece('mast-base', 'stump of a thick ship mast with a sawn round top face, iron rings, standing in a round wedged deck collar, all seen from above at 3/4', 1, 1, 'column',
       group='interior', solid=[(0, 0)], tags=['돛대', '선창', '배'],
       desc='돛대 밑동(둥근 위 단면·쇠테, 쐐기 두른 둥근 받침, 감은 밧줄). 선창·갑판 아래 가운데. 막힘.')
def _mast(c):
    cx = 8
    # 받침 고리: 두께 + 윗면(가운데 구멍에서 바깥으로 쐐기선)
    c.ellf(cx, 12.4, 7.6, 3.4, lambda x, y, nx, ny, d: K('dark', -1 if nx < 0 else -2) if ny > 0 else None)
    def collar(x, y, nx, ny, d):
        a = math.atan2(ny, nx); seg = (a + math.pi) / (2 * math.pi) * 12
        t = 3 if ny < -.3 and nx < .3 else 2 if ny < .3 else 1
        if seg % 1 < .18: t -= 2
        if d > .8: t = 0 if ny < 0 else -1
        return K('wood', t)
    c.ellf(cx, 11, 7.6, 3.4, collar)
    # 돛대 몸통(원기둥) — 아래 끝은 받침 속으로 둥글게
    for y in range(3, 13):
        for x in range(4, 13):
            nx = (x + .5 - cx) / 3.8
            if abs(nx) > 1: continue
            if y > 10.4 + 1.6 * math.sqrt(max(0, 1 - nx * nx)): continue
            t = 1 if nx < -.5 else 0 if nx < -.1 else -1 if nx < .4 else -2 if nx < .75 else -3
            c.P(x, y, K('dark', t + 2))
    # 쇠테(아래로 휜 타원 띠)
    for hy in (5.5, 8.5):
        for x in range(4, 13):
            nx = (x + .5 - cx) / 3.8
            if abs(nx) <= 1:
                yy = round(hy + 1.6 * math.sqrt(max(0, 1 - nx * nx)) - .8)
                c.P(x, yy, K('iron', 2 if nx < -.3 else 0 if nx < .4 else -2))
    # 위 단면(톱질한 나이테, 4행)
    def endgrain(x, y, nx, ny, d):
        r = math.sqrt(d)
        if r > .82: return K('dark', 2 if ny < 0 else 0)
        return K('wood', 3 if abs(r - .55) > .12 and r > .2 else 1)
    c.ellf(cx, 3.2, 3.8, 2.2, endgrain)
    # 받침 위 감은 밧줄(오른쪽 앞)
    for r in (2.0, 1.0):
        for k in range(14):
            a = 2 * math.pi * k / 14
            c.P(round(12.6 + r * math.cos(a)), round(12.4 + r * .6 * math.sin(a)), K('thatch', 1 if math.sin(a) < 0 else -1))
    c.outline()


@piece('ladder-hatch', 'open square deck hatch with a wooden ladder going down into the dark hold', 1, 1, 'flat',
       group='interior', tags=['승강구', '사다리', '배'],
       desc='열린 갑판 승강구(사다리가 아래 어둠으로). 바닥에 둔다. 아래층 맵으로 내려가는 이음 칸.')
def _hatch(c):
    # 틀(뒤·좌·우는 윗면, 앞은 두께 보임)
    c.R(1, 1, 14, 14, K('dark', 1))
    c.HL(1, 1, 14, K('dark', 0)); c.HL(1, 2, 14, K('dark', 2))
    c.VL(1, 2, 12, K('dark', 2)); c.VL(14, 2, 12, K('dark', -1))
    c.HL(1, 12, 14, K('dark', 3)); c.HL(1, 13, 14, K('dark', -1)); c.HL(1, 14, 14, K('dark', -3))
    # 구멍
    for y in range(3, 12):
        for x in range(3, 13):
            c.P(x, y, K('shadow', 0 if y < 6 else 1 if y < 10 else 2))
    c.HL(3, 3, 10, K('dark', -3)); c.VL(3, 3, 9, K('shadow', 0))
    # 사다리(가까운 위쪽 끝이 밝다)
    for (x, t) in ((5, 0), (10, -1)):
        for y in range(4, 12): c.P(x, y, K('wood', t - (2 if y < 7 else 1 if y < 9 else 0)))
    for y in (5, 7, 9, 11):
        t = -3 if y < 7 else -2 if y < 9 else -1 if y < 11 else 1
        c.HL(6, y, 4, K('wood', t))
    c.P(5, 11, K('wood', 2)); c.P(10, 11, K('wood', 1))
    c.outline()


@piece('stairs-up', 'steep wooden ship stairs with rope handrail going up toward the north', 1, 2, 'other',
       group='interior', tags=['계단', '배'],
       desc='위 갑판으로 오르는 나무 계단(북쪽으로 올라감, 밧줄 난간). 아래 칸에서 밟아 오른다. 위층 맵 이음 칸.')
def _stairs(c):
    # 옆판(톱니 윗선)
    c.R(0, 0, 2, 32, K('dark', 0)); c.VL(0, 0, 32, K('dark', 1))
    c.R(14, 0, 2, 32, K('dark', -2)); c.VL(14, 0, 32, K('dark', -1))
    # 위 어둠(위층 구멍)
    c.R(2, 0, 12, 3, K('shadow', 0)); c.HL(2, 2, 12, K('shadow', 1))
    # 디딤판 6단: 디딤(윗면 3행 밝게) + 챌판(앞면 2행) — 위로 갈수록 한 단씩 어둡다
    for k in range(6):
        y = 3 + k * 5
        dt = -((5 - k) // 2)
        for j in range(3):
            for i in range(2, 14):
                t = 2 + dt - (1 if (i + k * 5) % 7 == 6 else 0)
                if j == 0: t = 1 + dt
                c.P(i, y + j, K('wood', t))
        c.HL(2, y + 2, 12, K('wood', 3 + dt))              # 디딤 앞 모서리(밝은 턱)
        c.HL(2, y + 3, 12, K('wood', -2 + dt))             # 턱 밑 그늘
        c.HL(2, y + 4, 12, K('wood', 0 + dt))              # 챌판
        c.P(2, y + 4, K('wood', dt)); c.P(13, y + 4, K('wood', -3))
        c.HL(0, y, 2, K('dark', 2)); c.HL(14, y, 2, K('dark', 0))   # 옆판 톱니
    # 난간 기둥 + 밧줄
    c.R(13, 19, 3, 13, K('dark', 1)); c.VL(13, 19, 13, K('dark', 2)); c.VL(15, 19, 13, K('dark', -2)); c.ellf(14.5, 19, 1.6, 1.1, lambda x, y, nx, ny, d: K('dark', 3))
    for y in range(1, 19):
        c.P(15 if y % 4 else 14, y, K('thatch', 0 if y % 2 else -1))
    c.outline()


# ================================================================== 주방 · 선창
@piece('galley-stove', 'cast iron galley stove with a stew pot and a kettle on top, glowing firebox door and a chimney pipe', 2, 2, 'tall_furniture',
       group='interior', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['주방', '화덕', '배'],
       desc='무쇠 주방 화덕(윗면에 국 냄비·주전자, 앞면 불구멍·오븐, 뒤 굴뚝 관). 북벽에 붙인다. 2×2 막힘.')
def _stove(c):
    # 굴뚝 관(뒤 오른쪽)
    c.R(23, 0, 5, 12, K('iron', -1)); c.VL(23, 0, 12, K('iron', 1)); c.VL(24, 0, 12, K('iron', 0)); c.VL(27, 0, 12, K('iron', -3))
    for hy in (3, 8): c.HL(23, hy, 5, K('iron', -3)); c.HL(23, hy + 1, 5, K('iron', 1))
    # 윗면 무쇠판(밝은 테 + 화구 고리)
    fy = top_slab(c, 1, 10, 30, 10, 'iron', t=1, inset=2, tex=None)
    for (cx, cy) in ((9, 15), (22, 15)):
        c.ellf(cx, cy, 5, 2.6, lambda x, y, nx, ny, d: (K('iron', -2) if ny < 0 else K('iron', 2)) if d > .55 else K('iron', -1))
    face(c, 1, fy, 30, 30 - fy, 'iron', ft=-1)
    # 놋쇠 난간
    c.HL(1, fy + 1, 30, K('gold', 0)); c.P(1, fy + 1, K('gold', 2)); c.HL(1, fy + 2, 30, K('iron', -3))
    # 불구멍(격자 사이 불빛) + 오븐 문
    c.R(4, fy + 3, 10, 6, K('iron', -3)); c.R(5, fy + 4, 8, 4, K('fire', 1))
    c.HL(5, fy + 6, 8, K('fire', 3)); c.P(7, fy + 5, K('fire', 3)); c.P(10, fy + 5, K('fire', 2)); c.HL(5, fy + 7, 8, K('fire', 0))
    for x in range(6, 13, 2): c.VL(x, fy + 4, 4, K('iron', -2))
    panel(c, 17, fy + 3, 11, 6, 'iron', 0); c.HL(19, fy + 5, 7, K('gold', 1)); c.HL(19, fy + 6, 7, K('gold', -2))
    for lx in (2, 26): leg(c, lx, 30, 4, 2, 'iron', -1)
    # 국 냄비(왼 화구)
    for y in range(10, 16):
        for x in range(4, 15):
            nx = (x + .5 - 9) / 5.5
            if abs(nx) <= 1 and y <= 14 + 1.5 * math.sqrt(max(0, 1 - nx * nx)): c.P(x, y, K('iron', 1 if nx < -.4 else 0 if nx < .3 else -2))
    c.HL(4, 13, 11, K('iron', -1))
    c.ellf(9, 10, 5.5, 2.2, lambda x, y, nx, ny, d: K('iron', 2 if ny < 0 else 1) if d > .5 else K('terra', 1 if (x + y) % 3 else 2))
    c.P(7, 9, K('terra', 3)); c.P(10, 10, K('sand', 2)); c.P(9, 9, K('moss', 1)); c.P(3, 12, K('iron', 0)); c.P(15, 12, K('iron', -2))
    # 구리 주전자(오른 화구) — 둥근 몸통·뚜껑 꼭지·주둥이·손잡이
    c.ellf(21, 13.5, 4, 2.8, lambda x, y, nx, ny, d: K('terra', 3 if nx < -.4 and ny < -.2 else 2 if nx < 0 else 1 if nx < .5 else -1))
    c.HL(18, 15, 7, K('terra', -2))
    c.ellf(21, 10.8, 2.2, 1, lambda x, y, nx, ny, d: K('terra', 2 if nx < 0 else 0)); c.P(21, 9, K('gold', 2))
    c.line(25, 13, 27, 10, K('terra', 0)); c.P(27, 9, K('terra', 2)); c.P(28, 9, K('terra', -1))
    for k in range(9):
        a = math.pi * k / 8
        c.P(round(21 - 3.4 * math.cos(a)), round(11.5 - 3.6 * math.sin(a)), K('iron', 2 if k < 4 else 0))
    c.outline()


@piece('galley-table', 'galley work table with a loaf of bread, a fish, a soup bowl and a knife on top', 2, 1, 'low_furniture',
       group='interior', solid=[(0, 0), (1, 0)], tags=['주방', '탁자', '배'],
       desc='주방 일 탁자(빵·생선·국 사발·칼). 2칸 막힘.')
def _gtable(c):
    fy = top_slab(c, 1, 1, 30, 9, 'wood', t=1, inset=1, s=17)
    face(c, 1, fy, 30, 2, 'wood', ft=-1)
    for lx in (2, 27): leg(c, lx, fy + 2, 3, 16 - fy - 2, 'wood', -1)
    for lx in (6, 23): leg(c, lx, fy + 2, 2, 2, 'wood', -3)
    # 빵
    c.ellf(7, 5, 4, 2.4, lambda x, y, nx, ny, d: K('terra', 2 if ny < -.2 and nx < .3 else 1 if ny < .3 else 0) if d < .85 else K('terra', -1))
    for x in (5, 7, 9): c.P(x, 4, K('sand', 2))
    # 생선
    for x in range(12, 20):
        f = (x - 12) / 8
        c.P(x, 5, K('blue', 2 if x < 16 else 1)); c.P(x, 6, K('iron', 2)); c.P(x, 7, K('iron', 0))
    c.P(12, 6, K('bone', 3)); c.P(13, 5, K('shadow', 0))
    c.P(20, 4, K('blue', 0)); c.P(20, 5, K('blue', 1)); c.P(20, 7, K('blue', 0)); c.P(21, 4, K('blue', -1)); c.P(21, 8, K('blue', -1)); c.P(20, 8, K('blue', -1))
    # 사발
    bowl(c, 25, 4, 3.5, 1.6, 'wood', fill=('terra', 0))
    # 칼
    c.HL(12, 8, 5, K('iron', 2)); c.HL(17, 8, 3, K('dark', 0)); c.P(12, 9, K('iron', 0))
    c.outline()


@piece('galley-shelf', 'tall wooden kitchen shelf with clay pots, bowls and an iron pan, a water jug on top', 1, 2, 'tall_furniture',
       group='interior', solid=[(0, 1)], tags=['주방', '선반'],
       desc='주방 선반(토기 항아리·사발·쇠 냄비, 위에 물병). 북벽에 붙인다. 아래 칸 막힘.')
def _potshelf(c):
    fy = top_slab(c, 0, 4, 16, 5, 'wood', t=1, inset=1, s=19)
    face(c, 0, fy, 16, 32 - fy, 'wood', ft=-1)
    c.R(2, fy, 12, 32 - fy - 2, K('dark', -2))
    for k in range(3, 14, 4): c.VL(k, fy, 32 - fy - 2, K('dark', -3))
    c.VL(0, fy, 32 - fy, K('wood', 1)); c.VL(1, fy, 32 - fy, K('wood', -1)); c.VL(14, fy, 32 - fy, K('wood', 0)); c.VL(15, fy, 32 - fy, K('wood', -2))
    for sy in (fy + 7, fy + 15):
        c.HL(2, sy, 12, K('wood', 2)); c.HL(2, sy + 1, 12, K('wood', -2))
    # 칸1: 항아리 둘
    for (cx, rx) in ((5, 2.6), (10.5, 2.2)):
        lit_blob(c, cx, fy + 4.5, rx, 2.6, 'terra', 0, s=int(cx))
        c.HL(int(cx) - 1, fy + 1, 3, K('terra', 2)); c.P(int(cx), fy + 1, K('shadow', 1))
    # 칸2: 겹친 사발 + 쇠 팬
    for k in range(3): c.HL(3, fy + 14 - k * 2, 6, K('cloth', 1 - k % 2)); c.P(3, fy + 14 - k * 2, K('cloth', 3))
    c.ellf(11, fy + 12, 2.6, 2.6, lambda x, y, nx, ny, d: K('iron', 1 if nx + ny < -.4 else -1) if d > .45 else K('iron', -2))
    # 칸3: 큰 쇠 냄비(뚜껑)
    c.R(4, fy + 19, 8, 4, K('iron', 0)); c.VL(4, fy + 19, 4, K('iron', 1)); c.VL(11, fy + 19, 4, K('iron', -2))
    c.ellf(8, fy + 18.5, 4, 1.2, lambda x, y, nx, ny, d: K('iron', 2))
    c.P(7, fy + 17, K('iron', 1)); c.P(8, fy + 17, K('iron', 0))
    c.R(0, 29, 16, 3, K('wood', -2)); c.HL(0, 29, 16, K('wood', 0)); c.HL(0, 31, 16, K('wood', -3))
    # 위 물병
    c.ellf(7, 5.5, 3, 2.6, lambda x, y, nx, ny, d: K('terra', 2 if nx < -.3 and ny < 0 else 1 if nx < .3 else -1))
    c.R(6, 1, 3, 3, K('terra', 0)); c.HL(6, 1, 3, K('terra', 2)); c.P(7, 1, K('shadow', 1)); c.P(10, 4, K('terra', -2)); c.P(10, 5, K('terra', -2))
    c.outline()


@piece('pot-rack', 'iron wall rail with a hanging frying pan, a ladle and a copper pot', 1, 1, 'wall_mounted',
       group='interior', tags=['주방', '벽걸이'],
       desc='벽 쇠 걸이(프라이팬·국자·구리 냄비). 주방 벽 앞면 위에 겹쳐 놓는다. 통행.')
def _pans(c):
    c.HL(0, 1, 16, K('iron', 1)); c.HL(0, 2, 16, K('iron', -2)); c.P(1, 1, K('iron', 2)); c.P(14, 1, K('iron', 2))
    # 프라이팬
    c.VL(3, 3, 4, K('dark', 0)); c.P(3, 3, K('iron', 0))
    c.ellf(3.5, 10, 3.4, 3.4, lambda x, y, nx, ny, d: K('iron', 1 if nx + ny < -.5 else -1 if nx + ny > .4 else 0) if d > .55 else K('iron', -2 if ny < 0 else -3))
    c.P(2, 9, K('iron', 0))
    # 국자
    c.VL(8, 3, 8, K('iron', 1)); c.P(8, 3, K('iron', -1))
    c.ellf(8, 12, 2, 1.6, lambda x, y, nx, ny, d: K('iron', 1 if nx < 0 else -1) if d > .4 else K('iron', -2))
    # 구리 냄비(손잡이 걸림)
    c.line(11, 3, 12, 5, K('terra', 0)); c.line(14, 3, 13, 5, K('terra', -1))
    c.R(10, 6, 6, 5, K('terra', 0)); c.VL(10, 6, 5, K('terra', 2)); c.VL(11, 6, 5, K('terra', 1)); c.VL(15, 6, 5, K('terra', -2))
    c.HL(10, 6, 6, K('terra', 3)); c.HL(10, 10, 6, K('terra', -2)); c.HL(11, 8, 4, K('terra', -1))
    c.outline()


@piece('water-barrel', 'water cask lying on a wooden cradle with a brass tap facing south', 1, 1, 'round_body',
       group='interior', solid=[(0, 0)], tags=['물통', '선창', '배'],
       desc='받침 위에 누운 물통(남쪽 끝에 놋쇠 꼭지). 선창·주방. 막힘.')
def _cask(c):
    for (x, t) in ((1, 0), (12, -1)):
        c.R(x, 9, 3, 7, K('dark', t)); c.HL(x, 9, 3, K('dark', t + 2)); c.HL(x, 15, 3, K('dark', -3))
    keg_body(c, 8, 1, 7, 6.5, 'wood')
    keg_end(c, 8, 9, 6, 5, 'wood', tap=True)
    c.R(2, 14, 12, 2, K('dark', -1)); c.HL(2, 14, 12, K('dark', 1))
    c.outline()


@piece('cargo-barrels', 'two-tier wooden rack holding four rum barrels lying on their sides, round ends facing south', 2, 2, 'frame',
       group='interior', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['럼', '통', '선창'],
       desc='두 단 럼통 시렁(누운 통 넷, 둥근 끝이 남쪽). 선창·술집 창고. 2×2 막힘.')
def _rumrack(c):
    fy = top_slab(c, 0, 0, 32, 5, 'wood', t=1, inset=1, s=23)
    face(c, 0, fy, 32, 2, 'wood', ft=-1)
    for (x, t) in ((0, 0), (29, -2)):
        c.R(x, 7, 3, 25, K('wood', t)); c.VL(x, 7, 25, K('wood', t + 1)); c.VL(x + 2, 7, 25, K('wood', t - 2))
    c.R(3, 7, 26, 25, K('shadow', 2))
    for (y0, ey, sh) in ((7, 13, 19), (20, 26, 31)):
        for cx in (9.5, 22.5):
            keg_body(c, cx, y0, y0 + 3, 6.2, 'wood')
            keg_end(c, cx, ey, 6, 4.6, 'wood', hoop='iron', tap=False)
        c.HL(3, sh - 1, 26, K('wood', 2)); c.HL(3, sh, 26, K('wood', -2))
        for cx in (9, 22): c.R(cx - 1, sh - 2, 3, 1, K('dark', -1))       # 쐐기
    for (x, m) in ((5, 'terra'), (9, 'leaf'), (24, 'terra')): bottle(c, x, 0, m, h=4)
    c.outline()


@piece('hammock-int', "sailor's canvas hammock seen from above at 3/4, slung between two posts with wooden spreader bars, a rolled blanket lying inside", 2, 1, 'frame',
       group='interior', solid=[(0, 0), (1, 0)], tags=['선창', '그물 침대', '배'],
       desc='선창 기둥 사이 범포 그물 침대(양끝 나무 벌림대, 안에 말아 둔 붉은 담요). 2칸 막힘.')
def _hhammock(c):
    for px in (0, 29):
        c.R(px, 2, 3, 14, K('dark', 0)); c.VL(px, 2, 14, K('dark', 2)); c.VL(px + 2, 2, 14, K('dark', -2)); c.HL(px, 15, 3, K('dark', -3))
        c.ellf(px + 1.5, 2, 1.7, 1.6, lambda x, y, nx, ny, d: K('dark', 3) if d < .6 else K('dark', 1))
    # 범포: 뒤 테 · 안쪽(위에서 보이는 오목면 6행) · 앞 테 · 배 밑
    for x in range(5, 27):
        f = (x - 5) / 21; sag = math.sin(math.pi * f)
        top = int(round(3 + sag * 1.2)); bot = int(round(11 + sag * 2.5))
        for y in range(top, bot + 1):
            d = y - top
            if d == 0: t = -2
            elif y < bot - 2: t = (0 if d < 2 else 1) - (1 if x % 4 == 0 else 0)
            elif y == bot - 2: t = 3
            else: t = -1 if y == bot - 1 else -2
            c.P(x, y, K('cloth', t))
    # 나무 벌림대(양끝, 윗면 밝게)
    for bx in (4, 26):
        c.R(bx, 3, 2, 9, K('wood', 0)); c.VL(bx, 3, 9, K('wood', 2)); c.HL(bx, 11, 2, K('wood', -2))
    for (x0, x1) in ((2, 4), (29, 27)):
        for y1 in (3, 7, 11): c.line(x0, 3, x1, y1, K('thatch', 0 if y1 == 7 else -1))
    # 말아 둔 담요(안쪽)
    for y in range(6, 10):
        for x in range(15, 22):
            c.P(x, y, K('red', (2 if y == 6 else 1 if y == 7 else 0 if y == 8 else -2) - (1 if x % 3 == 0 else 0)))
    c.ellf(21.5, 7.8, 1.3, 2, lambda x, y, nx, ny, d: K('red', -2) if d < .35 else K('red', 1))
    c.outline()


@piece('cannon-int', 'naval deck cannon on a four-wheeled wooden truck carriage with breeching rope, aimed south', 2, 2, 'other',
       group='interior', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['대포', '포갑판', '배'],
       desc='포갑판 함포(바퀴 넷 포가·제동 밧줄, 남쪽 겨눔). 배 포갑판 포문 앞(포구가 남쪽 벽을 향하게 북벽 쪽 대신 뱃전에). 2×2 막힘.')
def _gcannon(c):
    # 포가 옆판(계단꼴, 윗면 보임)
    for (x, sgn) in ((6, 1), (22, -1)):
        for k, (yy, hh) in enumerate(((6, 8), (13, 8), (20, 8))):
            c.R(x, yy, 4, hh + 2, K('dark', 0 if sgn > 0 else -1))
            c.HL(x, yy, 4, K('dark', 3)); c.HL(x, yy + 1, 4, K('dark', 2))
            c.VL(x, yy, hh + 2, K('dark', 1 if sgn > 0 else -1)); c.VL(x + 3, yy, hh + 2, K('dark', -2))
    # 앞 차축 판
    top_slab(c, 4, 24, 24, 3, 'dark', t=1, inset=0, tex=None)
    face(c, 4, 27, 24, 3, 'dark', ft=-1)
    # 바퀴 넷
    for (wx, wy) in ((2, 8), (27, 8), (1, 24), (28, 24)):
        c.R(wx, wy, 3, 7, K('dark', -1)); c.VL(wx, wy, 7, K('dark', 1)); c.HL(wx, wy, 3, K('dark', 2)); c.HL(wx, wy + 6, 3, K('dark', -3))
        c.P(wx + 1, wy + 3, K('iron', 1))
    # 포신
    for y in range(2, 31):
        f = (y - 2) / 28
        r = 4 - 0.9 * f
        for x in range(int(16 - r - 1), int(16 + r + 2)):
            nx = (x + .5 - 16) / r
            if abs(nx) > 1: continue
            t = 2 if nx < -.45 else 1 if nx < 0 else 0 if nx < .5 else -2
            if y in (8, 9, 25): t -= 1
            if y == 10: t += 1
            c.P(x, y, K('iron', t))
    c.ellf(16, 30, 3, 1.6, lambda x, y, nx, ny, d: K('shadow', 0) if d < .45 else K('iron', 2 if ny < 0 else 0))
    c.ellf(16, 1.5, 2, 1.5, lambda x, y, nx, ny, d: K('iron', 1 if nx < 0 else -1))
    # 제동 밧줄
    rope_line(c, 7, 6, 16, 3, sag=-1); rope_line(c, 16, 3, 25, 6, sag=-1)
    c.outline()


# ================================================================== 술집
@piece('bar-counter', 'long polished wooden tavern bar counter with panelled front, brass foot rail, mugs and bottles on top', 3, 2, 'low_furniture',
       group='interior', solid=[(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1)], tags=['술집', '계산대'],
       desc='술집 긴 계산대(윗면에 술잔·병·행주·동전, 앞면 판벽·놋쇠 발걸이). 술집 가운데 가로로, 뒤(북쪽)가 주인 자리. 3×2 막힘.')
def _bar(c):
    fy = top_slab(c, 1, 7, 46, 12, 'dark', t=2, inset=2, s=29, bw=4)
    face(c, 1, fy, 46, 32 - fy, 'wood', ft=-1)
    c.HL(1, fy, 46, K('dark', -3)); c.HL(1, fy + 1, 46, K('dark', 0))
    for k in range(4): panel(c, 3 + k * 11, fy + 3, 9, 6, 'wood', 0)
    for k in range(5): c.R(1 + k * 11, fy + 2, 2, 32 - fy - 4, K('wood', 1)); c.VL(2 + k * 11, fy + 2, 32 - fy - 4, K('wood', -1))
    c.HL(1, fy + 10, 46, K('gold', 1)); c.HL(1, fy + 11, 46, K('gold', -2)); c.P(1, fy + 10, K('gold', 3))
    c.R(1, 30, 46, 2, K('wood', -3))
    # 윗면 물건
    mug(c, 5, 8); mug(c, 11, 10, 'gold', band='iron')
    bottle(c, 19, 2, 'leaf', h=9); bottle(c, 23, 4, 'terra', h=8)
    c.R(29, 13, 6, 3, K('cloth', 2)); c.HL(29, 13, 6, K('cloth', 3)); c.HL(29, 15, 6, K('cloth', 0)); c.P(34, 14, K('cloth', 1))
    for (x, y) in ((37, 14), (39, 15), (38, 12)): coin(c, x, y)
    mug(c, 41, 8)
    c.outline()


@piece('bar-shelf', 'tavern back shelf with rows of colourful bottles and mugs, cupboard below', 2, 2, 'tall_furniture',
       group='interior', solid=[(0, 1), (1, 1)], tags=['술집', '선반', '술병'],
       desc='술집 뒤 선반(색색 술병·잔, 아래 찬장). 계산대 뒤 북벽에 붙인다. 아래 줄 막힘.')
def _barshelf(c):
    fy = top_slab(c, 1, 3, 30, 5, 'dark', t=2, inset=1, s=37)
    face(c, 1, fy, 30, 32 - fy, 'dark', ft=-1)
    c.R(4, fy, 24, 14, K('shadow', 2))
    for k in range(4, 28, 6): c.VL(k, fy, 14, K('dark', -3))
    c.VL(1, fy, 32 - fy, K('dark', 1)); c.VL(2, fy, 32 - fy, K('dark', 0)); c.VL(3, fy, 14, K('dark', -2)); c.VL(28, fy, 14, K('dark', 0))
    for sy in (fy + 7, fy + 14):
        c.HL(3, sy, 26, K('dark', 2)); c.HL(3, sy + 1, 26, K('dark', -2))
    for i, m in enumerate(('leaf', 'red', 'terra', 'teal', 'leaf', 'blue', 'terra')):
        bottle(c, 5 + i * 3 + (i // 4), fy + 7 - 6 - (i % 2), m, h=5 + (i % 2))
    for k in range(4): mug(c, 5 + k * 6, fy + 9, 'wood' if k % 2 else 'gold', foam=False)
    # 찬장
    for dx in (4, 16): panel(c, dx, fy + 17, 11, 7, 'dark', 0); knob(c, dx + (9 if dx == 4 else 1), fy + 20)
    c.R(1, 29, 30, 3, K('dark', -2)); c.HL(1, 29, 30, K('dark', 0)); c.HL(1, 31, 30, K('dark', -3))
    # 윗면: 작은 통 + 병
    c.R(6, 1, 7, 6, K('wood', 0)); c.VL(6, 1, 6, K('wood', 2)); c.VL(12, 1, 6, K('wood', -2)); c.HL(6, 1, 7, K('wood', 3)); c.HL(6, 3, 7, K('iron', 0)); c.HL(6, 6, 7, K('wood', -3))
    bottle(c, 21, 0, 'leaf', h=6)
    c.outline()


@piece('keg-stand', 'tavern keg rack: deep wooden top shelf with mugs on it, two ale kegs lying underneath with brass taps facing south, drip tray', 2, 2, 'frame',
       group='interior', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['술집', '통', '맥주'],
       desc='맥주통 거치대(윗판 위 잔들, 아래 누운 통 둘·놋쇠 꼭지·물받이). 계산대 뒤나 구석. 2×2 막힘.')
def _kegrack(c):
    fy = top_slab(c, 0, 3, 32, 7, 'wood', t=1, inset=2, s=41)
    face(c, 0, fy, 32, 2, 'wood', ft=-1)
    for (x, t) in ((0, 0), (29, -2)):
        c.R(x, fy + 2, 3, 32 - fy - 2, K('wood', t)); c.VL(x, fy + 2, 32 - fy - 2, K('wood', t + 1)); c.VL(x + 2, fy + 2, 32 - fy - 2, K('wood', t - 2))
    c.R(3, fy + 2, 26, 32 - fy - 4, K('shadow', 2))
    for cx in (9.5, 22.5):
        keg_body(c, cx, fy + 2, fy + 5, 6, 'wood')
        keg_end(c, cx, fy + 10, 6, 5, 'wood', tap=True)
    c.R(3, 25, 26, 2, K('iron', 0)); c.HL(3, 25, 26, K('iron', 2)); c.HL(3, 26, 26, K('iron', -2))
    c.R(0, 29, 32, 3, K('wood', -1)); c.HL(0, 29, 32, K('wood', 1)); c.HL(0, 31, 32, K('wood', -3))
    # 윗판 위 잔들 + 행주
    mug(c, 4, 2); mug(c, 10, 4, 'gold'); mug(c, 21, 3)
    c.R(15, 6, 5, 2, K('cloth', 2)); c.HL(15, 6, 5, K('cloth', 3)); c.P(19, 7, K('cloth', 0))
    c.outline()


@piece('tavern-table-round', 'round wooden tavern table with two ale mugs, a lit candle and a plate on top', 2, 2, 'low_furniture',
       group='interior', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['술집', '탁자'],
       desc='술집 둥근 탁자(술잔 둘·촛불·접시). 의자·걸상을 둘레에. 2×2 막힘.')
def _ttable(c):
    # 받침 기둥 + 발
    c.R(13, 19, 6, 9, K('wood', -1)); c.VL(13, 19, 9, K('wood', 0)); c.VL(18, 19, 9, K('wood', -3))
    c.ellf(16, 29, 9, 2.2, lambda x, y, nx, ny, d: K('wood', 1 if ny < 0 else -2))
    c.ellf(16, 27, 3.6, 1.5, lambda x, y, nx, ny, d: K('wood', 0))
    # 두께(앞 테)
    c.ellf(16, 13, 14.5, 8, lambda x, y, nx, ny, d: K('wood', -2 if nx > .4 else -1) if ny > 0 else None)
    # 윗면(판 결)
    tmp = Cv(32, 32); planks(tmp, 0, 0, 32, 32, 'wood', 1, bw=4, s=43, nails=False)
    c.ellf(16, 11, 14.5, 8, lambda x, y, nx, ny, d: (K('wood', 3) if ny > .55 and d > .75 else K('wood', -1) if ny < -.6 and d > .7 else tmp.get(x, y)))
    c.HL(4, 15, 2, K('wood', 3))
    mug(c, 7, 6); mug(c, 21, 10, 'gold')
    candle(c, 15, 2, h=5)
    c.P(14, 9, K('bone', 2)); c.P(17, 9, K('bone', 1))
    bowl(c, 10, 14, 3.5, 1.5, 'bone', fill=('terra', 1))
    c.outline()


@piece('stool-int', 'round wooden bar stool seen from above at 3/4: big round seat top, three splayed legs', 1, 1, 'seat',
       group='interior', solid=[(0, 0)], tags=['술집', '걸상'],
       desc='둥근 나무 걸상(다리 셋). 계산대 앞·탁자 둘레.')
def _stool(c):
    for (x0, x1, t) in ((5, 2, 0), (10, 13, -2)):
        c.line(x0, 9, x1, 15, K('wood', t)); c.line(x0 + 1, 9, x1 + 1, 15, K('wood', t - 1))
    c.R(7, 10, 2, 6, K('wood', 0)); c.VL(7, 10, 6, K('wood', 1)); c.HL(7, 15, 2, K('wood', -2))
    c.HL(4, 12, 8, K('wood', -1)); c.HL(4, 13, 8, K('wood', -3))
    c.ellf(8, 6.4, 7, 4.6, lambda x, y, nx, ny, d: K('wood', -2 if nx > .3 else -1) if ny > .2 else None)
    def seat(x, y, nx, ny, d):
        if d > .78: return K('wood', 3 if ny > .3 else 0 if ny < -.3 else 2)
        r = math.sqrt(d)
        t = 2 if (nx + ny) < -.5 else 1
        if abs(r - .45) < .08 or abs(r - .2) < .07: t -= 1
        return K('wood', t)
    c.ellf(8, 5.2, 7, 4.6, seat)
    c.P(5, 3, K('wood', 3)); c.P(6, 3, K('wood', 3))
    c.outline()


@piece('tavern-chair', 'simple wooden tavern chair with spindle back toward the north', 1, 1, 'seat',
       group='interior', solid=[(0, 0)], tags=['술집', '의자'],
       desc='술집 나무 의자(살 등받이 = 북쪽). 탁자 북쪽에 두고 남쪽을 본다.')
def _tchair(c):
    for px in (2, 12): c.R(px, 0, 2, 9, K('wood', 0)); c.VL(px, 0, 9, K('wood', 2)); c.VL(px + 1, 0, 9, K('wood', -1))
    c.R(2, 0, 12, 2, K('wood', 1)); c.HL(3, 0, 10, K('wood', 2)); c.HL(2, 1, 12, K('wood', -1))
    for x in (5, 8, 10): c.VL(x, 2, 5, K('wood', 0)); c.P(x, 2, K('wood', -2))
    c.HL(4, 4, 8, K('wood', -1))
    fy = top_slab(c, 1, 7, 14, 5, 'wood', t=1, inset=1, s=53)
    face(c, 1, fy, 14, 2, 'wood', ft=-1)
    leg(c, 2, fy + 2, 2, 16 - fy - 2, 'wood', 0); leg(c, 12, fy + 2, 2, 16 - fy - 2, 'wood', -1)
    c.outline()


@piece('fireplace', 'stone tavern fireplace with burning logs, a hanging iron kettle, mantel shelf with candles and a hearth step', 2, 2, 'tall_furniture',
       group='interior', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['술집', '벽난로'],
       desc='돌 벽난로(장작불·매단 쇠 주전자, 선반 위 촛불·병, 앞 화덕돌). 북벽에 붙인다. 2×2 막힘.')
def _fireplace(c):
    stones(c, 1, 9, 30, 19, 'stone', 0, bh=4, blen=(5, 8), s=61)
    c.VL(1, 9, 19, K('stone', 1)); c.VL(30, 9, 19, K('stone', -2))
    # 아치 구멍(그을음 안벽)
    for y in range(12, 27):
        for x in range(6, 26):
            dx = abs(x + .5 - 16) / 10
            if y < 13 + 4 * dx * dx: continue
            c.P(x, y, K('shadow', 0 if y < 16 else 1) if (x + y) % 5 else K('rock', -3))
    for x in range(5, 27):
        dx = abs(x + .5 - 16) / 11
        c.P(x, int(12 + 4 * dx * dx), K('stone', 2 if x < 16 else 0))
    # 장작 + 큰 불
    c.R(8, 24, 16, 2, K('wood', -2)); c.HL(8, 24, 16, K('wood', 0)); c.line(9, 26, 22, 23, K('wood', -1))
    for y in range(14, 25):
        for x in range(8, 24):
            dx = abs(x + .5 - 16 + 1.5 * math.sin(y * .9)) / 7.5
            h = (24 - y) / 10
            if dx > (1 - h) * (0.75 + 0.25 * ((x * 7 + y) % 3) / 2): continue
            r = dx + h * .8
            c.P(x, y, K('fire', 3 if r < .45 else 2 if r < .7 else 1 if r < .95 else 0))
    for (x, y) in ((11, 17), (20, 16), (14, 14), (18, 13)): c.P(x, y, K('fire', 2))
    # 걸이 팔 + 작은 주전자(오른쪽)
    c.VL(24, 13, 12, K('iron', -1)); c.HL(19, 14, 6, K('iron', 0)); c.VL(20, 15, 2, K('iron', -1))
    c.ellf(20.5, 19, 2.6, 2.1, lambda x, y, nx, ny, d: K('iron', 1 if nx < -.3 and ny < 0 else -1 if nx < .3 else -2))
    c.HL(19, 17, 3, K('iron', 1)); c.P(17, 18, K('iron', 0))
    # 화덕돌(윗면 + 앞)
    top_slab(c, 3, 26, 26, 3, 'stone', t=1, inset=1, tex=None)
    face(c, 3, 29, 26, 3, 'stone', ft=-1)
    for x in range(6, 28, 6): c.VL(x, 26, 6, K('stone', -2))
    # 선반(윗면 5행)
    fy = top_slab(c, 0, 3, 32, 5, 'wood', t=1, inset=1, s=63)
    face(c, 0, fy, 32, 2, 'wood', ft=-1)
    candle(c, 4, 0, h=3); candle(c, 26, 0, h=3)
    bottle(c, 12, 0, 'leaf', h=5); mug(c, 17, 2, 'gold', foam=False)
    c.outline()


@piece('dartboard', 'round dartboard with red and cream segments and two darts stuck in it', 1, 1, 'wall_mounted',
       group='interior', tags=['술집', '벽걸이', '다트'],
       desc='다트판(붉은·흰 칸, 꽂힌 다트 둘). 술집 벽 앞면 위에 겹쳐 놓는다. 통행.')
def _dart(c):
    def f(x, y, nx, ny, d):
        r = math.sqrt(d); a = math.atan2(ny, nx); seg = int((a + math.pi) / (2 * math.pi) * 8 + .5) % 8
        lit = nx + ny < -.2
        if r > .84: return K('dark', 1 if lit else -1)
        if r < .22: return K('red', 2 if lit else 1)
        if .58 < r < .72: return K('red', 0) if seg % 2 else K('leaf', 0)
        return K('shadow', 2) if seg % 2 else K('sand', 2 if lit else 1)
    c.ellf(8, 8, 7, 7, f)
    for (x, y, m) in ((9, 5, 'red'), (4, 9, 'teal')):
        c.P(x, y, K('iron', 2)); c.P(x + 1, y + 1, K('wood', 1)); c.P(x + 2, y + 2, K('wood', 0))
        c.P(x + 3, y + 3, K(m, 2)); c.P(x + 2, y + 3, K(m, 0)); c.P(x + 3, y + 2, K(m, 1))
    c.outline()


@piece('wall-trophy', 'mounted swordfish trophy on a carved wooden wall plaque', 1, 1, 'wall_mounted',
       group='interior', tags=['술집', '벽걸이', '청새치'],
       desc='나무 방패 판에 박제한 황새치. 술집 벽 앞면 위에 겹쳐 놓는다. 통행.')
def _trophy(c):
    # 방패 판
    for y in range(2, 15):
        w = 4 if y < 11 else 4 - (y - 10)
        for x in range(8 - w, 8 + w):
            c.P(x, y, K('dark', (1 if x < 7 else 0 if x < 10 else -1) - (1 if (x + y) % 6 == 0 else 0)))
    c.HL(4, 2, 8, K('dark', 2)); c.HL(5, 1, 6, K('dark', 1))
    # 황새치(몸 + 등지느러미 + 꼬리 + 주둥이)
    c.ellf(9, 8, 4.5, 2.1, lambda x, y, nx, ny, d: K('blue', 2 if ny < -.3 else 1 if ny < .2 else 0) if ny < .35 else K('iron', 2 if nx < 0 else 1))
    c.R(8, 5, 3, 1, K('blue', -1)); c.P(8, 4, K('blue', 0)); c.P(9, 4, K('blue', -1)); c.P(7, 5, K('blue', 0))
    for (x, y) in ((14, 5), (14, 6), (13, 7), (13, 8), (13, 9), (14, 10), (14, 11), (15, 4), (15, 11)):
        c.P(x, y, K('blue', 0 if y < 8 else -1))
    c.line(4, 7, 0, 6, K('iron', 2)); c.P(4, 8, K('iron', 0))
    c.P(6, 7, K('bone', 3)); c.P(6, 8, K('shadow', 0))
    c.outline()


@piece('rug-tavern', 'red woven rectangular rug with gold diamond medallion, patterned border and fringed ends', 2, 2, 'flat',
       group='interior', tags=['술집', '깔개'],
       desc='붉은 직물 깔개(금빛 마름모 무늬·테두리·술 장식). 바닥 장식, 걸어 지나간다.')
def _rug(c):
    x0, y0, x1, y1 = 1, 3, 30, 28
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            ex = min(x - x0, x1 - x, y - y0, y1 - y)
            if ex == 0: t, m = -2, 'red'
            elif ex == 1: t, m = (2 if (x + y) % 4 < 2 else 0), 'gold'
            elif ex <= 3: t, m = (-1 if (x + y) % 3 else 1), 'terra'
            elif ex == 4: t, m = 1, 'gold'
            else:
                dx, dy = abs(x - 15.5) / 9, abs(y - 15.5) / 7
                dd = dx + dy
                if dd < .35: t, m = (2 if dd < .15 else 0), 'gold'
                elif dd < .5: t, m = -2, 'red'
                elif dd < .62: t, m = 1, 'gold'
                else: t, m = (0 if (x * 3 + y) % 7 else 1), 'red'
            c.P(x, y, K(m, t))
    for x in range(x0, x1 + 1, 2):
        c.P(x, y0 - 1, K('cloth', 2)); c.P(x, y0 - 2, K('cloth', 1)); c.P(x, y1 + 1, K('cloth', 1)); c.P(x, y1 + 2, K('cloth', 0))
    c.outline()


# ================================================================== 오두막
@piece('mat-hut', 'woven reed sleeping mat on the floor with a cloth pillow and a folded patterned blanket', 2, 1, 'flat',
       group='interior', tags=['오두막', '잠자리'],
       desc='짚 돗자리 잠자리(천 베개·접은 무늬 담요). 오두막 바닥, 걸어 지나간다.')
def _mat(c):
    for y in range(2, 14):
        for x in range(1, 31):
            bx, by = x // 3, y // 3
            u, v = x % 3, y % 3
            t = (1 if v == 0 else -1 if v == 2 else 0) if (bx + by) % 2 == 0 else (1 if u == 0 else -1 if u == 2 else 0)
            c.P(x, y, K('sand', t))
    c.HL(1, 2, 30, K('thatch', -1)); c.HL(1, 13, 30, K('thatch', -2)); c.VL(1, 2, 12, K('thatch', 0)); c.VL(30, 2, 12, K('thatch', -2))
    # 베개
    c.ellf(6, 7.5, 4, 3.6, lambda x, y, nx, ny, d: K('cloth', 3 if nx + ny < -.6 else 2 if nx + ny < .3 else 0 if d < .8 else -1))
    c.P(5, 6, K('cloth', 3))
    # 담요(무늬)
    for y in range(4, 12):
        for x in range(15, 29):
            t = 0
            if y == 4: t = 2
            elif y == 11: t = -2
            m = 'terra'
            if (x + (y % 4)) % 4 == 0 and 5 < y < 11: m, t = 'bone', 2
            c.P(x, y, K(m, t))
    c.HL(15, 7, 14, K('terra', -2)); c.VL(15, 4, 8, K('terra', 1)); c.VL(28, 4, 8, K('terra', -2))
    c.outline()


@piece('basket', 'round woven basket full of tropical fruit: mangoes, bananas and a coconut', 1, 1, 'container',
       group='interior', solid=[(0, 0)], tags=['오두막', '바구니', '과일'],
       desc='엮은 바구니(망고·바나나·코코넛이 가득, 아가리 보임). 오두막·시장. 막힘.')
def _basket(c):
    for y in range(7, 16):
        f = (y - 7) / 8
        rx = 6.8 - 1.6 * f
        for x in range(int(8 - rx - 1), int(8 + rx + 2)):
            nx = (x + .5 - 8) / rx
            if abs(nx) > 1: continue
            t = (1 if nx < -.4 else 0 if nx < .3 else -2) + (1 if (x + (y // 2) * 2) % 4 < 2 and (y % 2 == 0) else 0) - (1 if (x + y) % 4 == 0 else 0)
            c.P(x, y, K('thatch', t))
    c.HL(3, 15, 10, K('thatch', -3))
    # 아가리(안쪽 어둠 + 뒤 안벽)
    c.ellf(8, 6.6, 6.8, 3.4, lambda x, y, nx, ny, d: K('thatch', 2 if ny < 0 else 3) if d > .62 else (K('thatch', -1) if ny < -.2 else K('shadow', 2)))
    # 과일
    lit_blob(c, 6, 6, 2.2, 1.8, 'gold', 0, s=2); c.P(5, 5, K('red', 2))
    lit_blob(c, 10.5, 6.5, 2, 1.7, 'terra', 1, s=3)
    lit_blob(c, 8.5, 4.6, 1.8, 1.6, 'dark', 0, s=4)
    for k in range(5): c.P(3 + k, 3 + (1 if k in (0, 4) else 0), K('gold', 2 if k < 3 else 1)); c.P(3 + k, 4 + (1 if k in (0, 4) else 0), K('gold', 0))
    c.outline()


@piece('water-jar', 'two wide-mouthed terracotta storage jars seen from above at 3/4, dark open mouths with water inside', 1, 1, 'container',
       group='interior', solid=[(0, 0)], tags=['오두막', '항아리'],
       desc='토기 항아리 둘(큰 것·작은 것, 넓은 아가리 안 보임). 오두막 구석. 막힘.')
def _pots(c):
    def jar(cx, top, rx_m, ry_m, rx_b, ry_b, s):
        lit_blob(c, cx, top + ry_m + ry_b * .8, rx_b, ry_b, 'terra', 0, s=s)
        c.ellf(cx, top + ry_m, rx_m + .7, ry_m + .7, lambda x, y, nx, ny, d: K('terra', 3 if ny < 0 and nx < .3 else 1 if ny < .2 else -1))
        def inner(x, y, nx, ny, d):
            if ny < -.35: return K('terra', -2)                    # 뒤 안벽
            if ny < .1: return K('shadow', 1)
            return K('deep', 0 if (x + y) % 3 else 1)              # 물
        c.ellf(cx, top + ry_m, rx_m - .3, ry_m - .3, inner)
    jar(6, 0, 4.6, 3.0, 5.6, 5.0, 7)
    jar(11.5, 6.4, 3.6, 2.6, 4.0, 3.4, 9)
    c.outline()


@piece('fire-pit', 'stone-ringed cooking fire pit with a wooden tripod holding a hanging iron stew pot', 2, 2, 'container',
       group='interior', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['오두막', '화덕', '모닥불'],
       desc='돌 두른 화덕 구덩이(나무 삼발이에 매단 쇠 국 냄비, 불씨). 오두막 가운데. 2×2 막힘.')
def _hearth(c):
    cx, cy = 16, 21
    c.ellf(cx, cy, 11, 6, lambda x, y, nx, ny, d: K('rock', -2 if ny < 0 else -1) if (x * 7 + y * 3) % 5 else K('stone', -2))
    c.ellf(cx, cy + 1, 8, 4, lambda x, y, nx, ny, d: K('fire', -2 if d > .5 else -1) if hsh(x, y, 3) % 3 else K('fire', 0))
    # 뒤 다리
    c.line(16, 1, 16, 15, K('wood', -2))
    # 돌 고리
    for k in range(16):
        a = 2 * math.pi * k / 16
        x = cx + 12.4 * math.cos(a); y = cy + 6.8 * math.sin(a)
        lit_blob(c, x, y, 2.2, 1.8, 'stone', 0 if math.sin(a) > 0 else -1, s=k)
    # 장작 + 불꽃
    c.line(10, 24, 21, 19, K('wood', 0)); c.line(11, 19, 22, 24, K('wood', -1))
    for (x, y, t) in ((16, 17, 3), (15, 18, 2), (17, 18, 3), (16, 19, 3), (14, 20, 1), (18, 20, 2), (15, 21, 3), (17, 21, 2), (13, 21, 0), (19, 21, 1), (16, 20, 3), (16, 22, 2)):
        c.P(x, y, K('fire', t))
    # 냄비
    c.VL(16, 3, 5, K('iron', -1))
    for y in range(9, 16):
        for x in range(10, 23):
            nx = (x + .5 - 16) / 6
            if abs(nx) > 1 or y > 13 + 2.5 * math.sqrt(max(0, 1 - nx * nx)): continue
            c.P(x, y, K('iron', 1 if nx < -.4 else 0 if nx < .3 else -2))
    c.ellf(16, 9, 6, 2.2, lambda x, y, nx, ny, d: K('iron', 2) if d > .55 else K('terra', 1 if (x + y) % 3 else 2))
    c.P(14, 8, K('sand', 2)); c.P(17, 9, K('leaf', 1)); c.line(10, 9, 16, 4, K('iron', -1)); c.line(22, 9, 16, 4, K('iron', -1))
    # 앞 다리 둘(맨 위)
    c.line(16, 1, 4, 27, K('wood', 1)); c.line(17, 1, 5, 27, K('wood', -1))
    c.line(16, 1, 28, 27, K('wood', 0)); c.line(17, 1, 29, 27, K('wood', -2))
    c.R(14, 0, 4, 2, K('thatch', 0)); c.HL(14, 0, 4, K('thatch', 2))
    c.outline()


@piece('low-table-hut', 'low bamboo table with a bowl of rice, a coconut shell cup and a bunch of bananas on top', 2, 1, 'low_furniture',
       group='interior', solid=[(0, 0), (1, 0)], tags=['오두막', '탁자', '대나무'],
       desc='대나무 낮은 상(밥 사발·코코넛 잔·바나나). 오두막, 돗자리 앞. 2칸 막힘.')
def _ltable(c):
    for j in range(9):
        y = 2 + j; a = int(round(1 * (1 - j / 8)))
        for x in range(1 + a, 31 - a):
            v = j % 2
            t = (2 if v == 0 else 0) - (1 if (x + (j // 2) * 5) % 9 == 0 else 0)
            c.P(x, y, K('thatch', t))
    c.HL(2, 2, 28, K('thatch', -2)); c.HL(1, 10, 30, K('thatch', 3))
    c.R(1, 11, 30, 2, K('thatch', -1)); c.HL(1, 12, 30, K('thatch', -3))
    for x in range(3, 30, 6): c.R(x, 11, 2, 2, K('wood', -1))
    for lx in (2, 27): c.R(lx, 13, 3, 3, K('thatch', 0)); c.VL(lx, 13, 3, K('thatch', 2)); c.VL(lx + 2, 13, 3, K('thatch', -2))
    bowl(c, 7, 5, 3.6, 1.6, 'wood', fill=('bone', 1))
    c.ellf(15.5, 6, 2.6, 2, lambda x, y, nx, ny, d: K('dark', 1 if nx < 0 else -1) if ny > -.3 or d > .5 else K('bone', 2))
    for k in range(4):
        x = 21 + k * 2
        c.line(x, 8, x + 1, 4, K('gold', 1 if k % 2 else 2)); c.line(x + 1, 8, x + 2, 4, K('gold', -1))
    c.P(28, 4, K('moss', 0)); c.P(28, 5, K('moss', -1))
    c.outline()


@piece('hanging-herbs', 'bundles of drying herbs and a garlic braid hanging from a wooden wall peg rail', 1, 1, 'wall_mounted',
       group='interior', tags=['오두막', '벽걸이', '약초'],
       desc='나무 못 걸이에 매단 말리는 약초 다발·마늘 엮음. 오두막 벽 앞면 위에 겹쳐 놓는다. 통행.')
def _herbs(c):
    c.R(0, 1, 16, 2, K('wood', 0)); c.HL(0, 1, 16, K('wood', 2)); c.HL(0, 2, 16, K('wood', -2))
    for (x0, m) in ((1, 'moss'), (6, 'leaf')):
        c.HL(x0 + 1, 3, 2, K('thatch', 0)); c.HL(x0 + 1, 4, 2, K('red', 0))
        for y in range(5, 14):
            w = min(2 + (y - 5) // 2, 4)
            for x in range(x0 + 2 - w // 2 - 1, x0 + 2 + w // 2 + 1):
                c.P(x, y, K(m, (1 if x < x0 + 2 else -1) + (1 if (x + y) % 3 == 0 else 0) - (1 if y > 11 else 0)))
    c.VL(13, 3, 2, K('thatch', 0))
    for k, y in enumerate((5, 8, 11)):
        lit_blob(c, 12.5 + (k % 2), y + 1, 1.8, 1.6, 'bone', 0, s=k)
    c.outline()


# ================================================================== 보물 방
@piece('idol-pedestal', 'golden tiki idol statue with ruby eyes sitting on a carved stone pedestal', 1, 2, 'figure',
       group='interior', solid=[(0, 1)], tags=['보물', '우상', '동굴'],
       desc='돌 받침 위 황금 우상(루비 눈). 보물 동굴 안쪽 끝. 아래 칸 막힘.')
def _idol(c):
    fy = top_slab(c, 1, 18, 14, 5, 'stone', t=1, inset=1, tex=None)
    stones(c, 1, fy, 14, 32 - fy, 'stone', -1, bh=3, blen=(4, 6), s=71, moss=.15)
    c.VL(1, fy, 32 - fy, K('stone', 0)); c.VL(14, fy, 32 - fy, K('stone', -3)); c.HL(1, fy, 14, K('stone', -3))
    c.HL(3, fy + 4, 10, K('gold', -1))
    def lit(x, y, nx, ny, d):
        nz = math.sqrt(max(0, 1 - d)); li = -.55 * nx - .6 * ny + .6 * nz
        return K('gold', 2 if li > .85 else 1 if li > .55 else 0 if li > .25 else -1 if li > -.1 else -2)
    # 쪼그려 앉은 몸(넓다) + 팔 + 발
    c.ellf(8, 16.5, 6, 3.6, lit)
    c.R(2, 13, 2, 5, K('gold', 1)); c.VL(2, 13, 5, K('gold', 2)); c.R(12, 13, 2, 5, K('gold', -2))
    c.R(4, 19, 3, 2, K('gold', 0)); c.R(9, 19, 3, 2, K('gold', -1)); c.HL(4, 19, 3, K('gold', 2))
    c.R(6, 15, 4, 3, K('gold', -1)); c.P(7, 15, K('teal', 3)); c.P(8, 15, K('teal', 0))      # 배 보석
    # 큰 머리(사각진 티키) + 깃 장식
    c.R(3, 4, 10, 9, K('gold', 0))
    for y in range(4, 13):
        c.P(3, y, K('gold', 2)); c.P(4, y, K('gold', 1)); c.P(11, y, K('gold', -1)); c.P(12, y, K('gold', -2))
    c.R(4, 2, 8, 2, K('gold', 2)); c.HL(4, 2, 8, K('gold', 3)); c.HL(5, 1, 6, K('gold', 1))          # 머리 윗면
    for k, x in enumerate((4, 7, 10)): c.R(x, 0, 2, 2, K('red' if k != 1 else 'teal', 2)); c.P(x + 1, 1, K('red' if k != 1 else 'teal', 0))
    c.HL(4, 6, 8, K('gold', -2))                                                                       # 눈썹
    for ex in (5, 9): c.R(ex, 7, 2, 2, K('red', 1)); c.P(ex, 7, K('red', 3)); c.P(ex + 1, 8, K('red', -2))
    c.P(7, 8, K('gold', 2)); c.P(8, 9, K('gold', -2))
    c.R(5, 10, 6, 2, K('shadow', 1)); c.HL(5, 10, 6, K('bone', 3)); c.P(6, 11, K('bone', 1)); c.P(9, 11, K('bone', 1))
    c.HL(3, 12, 10, K('gold', -2))
    c.outline()


@piece('treasure-heap', 'huge heap of gold coins with goblets, a jewelled crown, pearls and a sword stuck in it', 2, 2, 'debris',
       group='interior', solid=[(0, 1), (1, 1)], tags=['보물', '금화'],
       desc='금화 큰 무더기(잔·보석 왕관·진주·꽂힌 칼). 보물 동굴. 아래 줄 막힘(윗부분은 뒤로 겹침).')
def _goldheap(c):
    def mound(x, y, nx, ny, d):
        if 1 - d < .07 and hsh(x, y, 5) % 2: return None
        nz = math.sqrt(max(0, 1 - d)); li = -.5 * nx - .7 * ny + .5 * nz
        t = 2 if li > .85 else 1 if li > .5 else 0 if li > .2 else -1 if li > -.15 else -2
        r = hsh(x // 2, y // 2, 9) % 5
        if r == 0 and (x + y) % 2 == 0: t += 1
        if r == 1 and (x % 2) == 0: t -= 1
        return K('gold', t)
    c.ellf(16, 21, 15, 10, mound)
    for k in range(18):
        x = 3 + hsh(k, 1, 4) % 26; y = 14 + hsh(k, 2, 4) % 14
        coin(c, x, y)
    # 칼(꽂힘)
    c.line(25, 3, 25, 15, K('iron', 2)); c.line(26, 3, 26, 15, K('iron', 0)); c.P(25, 2, K('iron', 3))
    c.HL(23, 15, 6, K('gold', 2)); c.HL(23, 16, 6, K('gold', -1)); c.R(25, 17, 2, 2, K('dark', 0))
    # 잔
    c.R(5, 9, 5, 4, K('gold', 1)); c.HL(5, 9, 5, K('gold', 3)); c.HL(6, 10, 3, K('red', -1)); c.VL(9, 10, 3, K('gold', -1))
    c.VL(7, 13, 2, K('gold', 0)); c.HL(6, 15, 3, K('gold', -1))
    # 왕관
    c.R(13, 8, 9, 4, K('gold', 1)); c.HL(13, 11, 9, K('gold', -1))
    for x in (13, 16, 19, 21): c.P(x, 7, K('gold', 2)); c.P(x, 6, K('gold', 3))
    c.P(15, 9, K('red', 2)); c.P(18, 9, K('teal', 3)); c.P(20, 9, K('blue', 3))
    # 진주 줄 + 보석
    for k in range(7): c.P(8 + k * 2, 19 + (k % 2), K('bone', 3 if k % 2 else 2))
    for (x, y, m) in ((11, 15, 'red'), (21, 20, 'teal'), (5, 22, 'blue'), (27, 22, 'red'), (16, 24, 'coral')):
        c.P(x, y, K(m, 3)); c.P(x + 1, y, K(m, 0)); c.P(x, y + 1, K(m, -1))
    c.outline()


@piece('bones', 'small pile of three skulls and crossed bones', 1, 1, 'debris',
       group='interior', tags=['보물', '해골', '동굴'],
       desc='해골 셋과 뼈 더미. 보물 동굴 바닥, 걸어 지나간다.')
def _skulls(c):
    def skull(x, y, t=0):
        # 7×6: 둥근 정수리(밝은 윗면) · 눈구멍 · 코 · 이빨
        for j, (a, b) in enumerate(((1, 6), (0, 7), (0, 7), (0, 7), (1, 6), (2, 5))):
            for i in range(a, b):
                tt = t + (2 if j == 0 or (j == 1 and i < 4) else 1 if i < 3 else 0 if i < 5 else -1)
                c.P(x + i, y + j, K('bone', tt))
        c.R(x + 1, y + 2, 2, 2, K('shadow', 0)); c.R(x + 4, y + 2, 2, 2, K('shadow', 0)); c.P(x + 1, y + 2, K('shadow', 1))
        c.P(x + 3, y + 4, K('shadow', 1))
        c.HL(x + 2, y + 5, 3, K('bone', t + 1)); c.P(x + 3, y + 5, K('bone', t - 2))
        c.HL(x + 2, y + 6, 3, K('bone', t - 1))
    c.line(0, 15, 15, 11, K('bone', 1)); c.line(1, 10, 15, 15, K('bone', 0))
    for (x, y) in ((0, 14), (1, 15), (14, 10), (15, 11), (0, 10), (1, 9), (14, 14), (15, 15)): c.P(x, y, K('bone', 2))
    skull(4, 1, -1)
    skull(1, 6, 0); skull(8, 7, 0)
    c.outline()


@piece('cutlass-rack', 'two crossed pirate cutlasses mounted on a wooden wall plaque', 1, 1, 'wall_mounted',
       group='interior', tags=['보물', '벽걸이', '칼'],
       desc='나무 판에 X자로 건 해적 칼 둘. 벽 앞면 위에 겹쳐 놓는다. 통행.')
def _cutlass(c):
    c.ellf(8, 7, 4.5, 4.5, lambda x, y, nx, ny, d: K('dark', 2 if nx + ny < -.4 else 1 if nx + ny < .4 else 0) if d < .75 else K('dark', -1))
    for sgn in (1, -1):
        # 손잡이(아래) → 칼끝(위 반대쪽), 등이 휘었다
        x0, y0 = (3, 14) if sgn > 0 else (12, 14)
        for k in range(12):
            f = k / 11
            x = x0 + sgn * 10 * f; y = y0 - 13 * f
            bend = 1.6 * math.sin(math.pi * f)
            xx = round(x); yy = round(y - bend)
            if k < 3: continue
            c.P(xx, yy, K('bone', 3)); c.P(xx + sgn, yy, K('iron', 1))
        c.R(x0 - 1, y0 - 3, 3, 2, K('gold', 2)); c.P(x0 + 1, y0 - 2, K('gold', -1)); c.HL(x0 - 2, y0 - 2, 5, K('gold', 1))
        c.VL(x0, y0 - 1, 2, K('dark', -1)); c.P(x0, y0 + 1, K('gold', 1))
    c.outline()


@piece('candelabra', 'tall iron candle stand seen from above at 3/4: a wide round drip tray on top holding three fat lit candles, round base dish', 1, 2, 'column',
       group='interior', solid=[(0, 1)], tags=['촛대', '보물', '동굴'],
       desc='쇠 촛대(위 둥근 촛농받이에 굵은 초 셋). 보물 방·선장실 구석. 아래 칸 막힘.')
def _candelabra(c):
    # 받침 접시
    c.ellf(8, 29.4, 6, 2.4, lambda x, y, nx, ny, d: K('iron', -2 if nx > .2 else -1) if ny > 0 else None)
    c.ellf(8, 28.4, 6, 2.4, lambda x, y, nx, ny, d: K('iron', 3 if ny < -.3 and nx < 0 else 2 if ny < .3 else 1) if d > .35 else K('iron', 0))
    c.R(7, 14, 2, 14, K('iron', 0)); c.VL(7, 14, 14, K('iron', 2))
    for ky in (19, 24): c.ellf(8, ky, 2, 1.1, lambda x, y, nx, ny, d: K('iron', 2 if nx < 0 else -1))
    # 둥근 촛농받이(윗면 타원 7행 + 두께)
    c.ellf(8, 13, 7.4, 3.6, lambda x, y, nx, ny, d: K('gold', -2 if nx > .3 else -1) if ny > 0 else None)
    def tray(x, y, nx, ny, d):
        if d > .72: return K('gold', 3 if ny < -.2 and nx < .3 else 2 if ny < .3 else 1)
        return K('gold', -1 if ny < 0 else 0) if hsh(x, y, 4) % 5 else K('bone', 2)
    c.ellf(8, 11.6, 7.4, 3.6, tray)
    # 굵은 초 셋(윗면 녹은 초 타원 보임) — 뒤 가운데 먼저
    for (cx, base, h) in ((8, 10, 7), (4, 13, 5), (12, 13, 5)):
        top = base - h
        c.R(cx - 1, top, 3, h, K('bone', 1)); c.VL(cx - 1, top, h, K('bone', 3)); c.VL(cx + 1, top, h, K('bone', -1))
        c.HL(cx - 1, base - 1, 3, K('bone', 0))
        c.P(cx - 1, top, K('bone', 2)); c.P(cx, top, K('bone', 3)); c.P(cx + 1, top, K('bone', 1)); c.P(cx, top + 1, K('bone', 0))
        c.P(cx + 1, top + 2, K('bone', 2))
        c.P(cx, top - 1, K('fire', 2)); c.P(cx, top - 2, K('fire', 3)); c.P(cx, top - 3, K('fire', 1))
    c.outline()


@piece('treasure-urn', 'ornate clay urn with gold bands seen from above at 3/4, its wide open mouth full of jewels and coins', 1, 1, 'container',
       group='interior', solid=[(0, 0)], tags=['보물', '항아리'],
       desc='금테 두른 보물 항아리(넓은 아가리에 보석·금화 가득). 보물 동굴. 막힘.')
def _urn(c):
    lit_blob(c, 8, 11, 5.8, 4.4, 'terra', 0, s=13)
    c.HL(3, 10, 10, K('gold', 1)); c.HL(3, 11, 10, K('gold', -1)); c.P(3, 10, K('gold', 3))
    c.HL(5, 14, 6, K('gold', 0))
    c.R(6, 14, 4, 2, K('terra', -2)); c.HL(6, 15, 4, K('terra', -3))
    for x in (1, 14): c.VL(x, 7, 4, K('gold', 1 if x == 1 else -1)); c.P(x, 7, K('gold', 2))
    c.ellf(8, 4.4, 6.4, 3.8, lambda x, y, nx, ny, d: K('gold', 3 if ny < -.3 and nx < .3 else 1 if ny < .3 else -1) if d > .62 else (K('shadow', 1) if ny < -.25 else K('gold', 0)))
    for (x, y, m, t) in ((5, 4, 'gold', 2), (7, 4, 'red', 3), (8, 5, 'red', 0), (10, 4, 'teal', 3), (9, 5, 'gold', 2), (6, 6, 'gold', 1), (10, 6, 'blue', 3),
                         (4, 5, 'gold', 3), (11, 5, 'gold', 2), (8, 3, 'gold', 3), (7, 6, 'bone', 3), (12, 4, 'gold', 1)):
        c.P(x, y, K(m, t))
    c.outline()

# ================================================================== 추가 조각(방 조립용)
@piece('captain-bed', "captain's large wooden bed seen from above at 3/4: carved headboard against the north wall, two pillows, red blanket with gold trim, footboard", 2, 2, 'low_furniture',
       group='interior', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['선장실', '침대', '배'],
       desc='선장 큰 침대(조각 머리판 = 북벽, 베개 둘, 금테 붉은 담요, 발판). 머리를 북벽에 붙인다. 2×2 막힘.')
def _cbed(c):
    # 머리판(윗면 3행 + 앞면 + 볏)
    c.R(1, 1, 30, 3, K('dark', 2)); c.HL(1, 1, 30, K('dark', 0)); c.HL(1, 3, 30, K('dark', 3))
    c.R(11, 0, 10, 1, K('dark', 1)); c.R(14, 0, 4, 1, K('gold', 1)); c.P(15, 0, K('gold', 3))
    face(c, 1, 4, 30, 5, 'dark', ft=-1)
    for px in (4, 13, 22): panel(c, px, 5, 7, 3, 'dark', 0)
    # 옆 틀
    c.R(1, 9, 2, 19, K('dark', 1)); c.VL(1, 9, 19, K('dark', 2)); c.R(29, 9, 2, 19, K('dark', -1)); c.VL(30, 9, 19, K('dark', -2))
    # 매트리스 + 베개 둘
    c.R(3, 9, 26, 19, K('cloth', 1))
    for px in (4, 17):
        c.R(px, 10, 11, 5, K('cloth', 3)); c.HL(px, 10, 11, K('cloth', 2)); c.VL(px, 10, 5, K('cloth', 2)); c.HL(px, 14, 11, K('cloth', 0)); c.VL(px + 10, 11, 4, K('cloth', 1))
        c.P(px + 4, 12, K('cloth', 2)); c.P(px + 5, 12, K('cloth', 2))
    c.HL(3, 15, 26, K('cloth', 2)); c.HL(3, 16, 26, K('cloth', 0))
    # 담요(붉은 + 금테 + 주름)
    for y in range(17, 28):
        for x in range(3, 29):
            t = 1 if x < 9 else 0 if x < 23 else -1
            if y == 17: t = 2
            if (x * 3 + y * 5) % 17 == 0: t -= 1
            c.P(x, y, K('red', t))
    c.HL(3, 18, 26, K('gold', 1)); c.HL(3, 26, 26, K('gold', -1))
    for x in (9, 18): c.VL(x, 19, 7, K('red', -1))
    # 발판(윗면 + 앞면)
    c.R(1, 27, 30, 2, K('dark', 2)); c.HL(1, 27, 30, K('dark', 3))
    face(c, 1, 29, 30, 3, 'dark', ft=-1)
    c.outline()


@piece('bed-straw', 'simple hut bed seen from above at 3/4: low bamboo frame with a straw-stuffed mattress, a cloth pillow and a patterned blanket', 2, 2, 'low_furniture',
       group='interior', solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['오두막', '침대', '짚'],
       desc='오두막 짚 침대(낮은 대나무 틀, 짚 매트리스, 천 베개, 무늬 담요). 머리 = 북쪽. 2×2 막힘.')
def _sbed(c):
    # 대나무 틀(윗면 테두리 + 앞 두께 + 짧은 다리)
    c.R(1, 3, 30, 24, K('thatch', 0))
    for y in range(3, 27):
        c.P(1, y, K('thatch', 2)); c.P(2, y, K('thatch', 0)); c.P(29, y, K('thatch', 0)); c.P(30, y, K('thatch', -2))
    c.HL(1, 3, 30, K('thatch', -1)); c.HL(1, 4, 30, K('thatch', 2))
    c.HL(1, 26, 30, K('thatch', 3)); c.R(1, 27, 30, 2, K('thatch', -1)); c.HL(1, 28, 30, K('thatch', -3))
    for x in range(3, 30, 6): c.R(x, 27, 2, 2, K('wood', -1))
    for lx in (2, 27): c.R(lx, 29, 3, 3, K('thatch', -1)); c.VL(lx, 29, 3, K('thatch', 1)); c.HL(lx, 31, 3, K('thatch', -3))
    # 짚 매트리스
    straw(c, 3, 5, 26, 21, t=0, s=5, tier=4)
    # 베개
    c.ellf(9, 8.5, 5, 2.8, lambda x, y, nx, ny, d: K('cloth', 3 if nx + ny < -.5 else 2 if nx + ny < .4 else 0 if d < .8 else -1))
    # 무늬 담요(아래 반)
    for y in range(13, 25):
        for x in range(4, 28):
            t, m = 0, 'teal'
            if y == 13: t = 2
            elif y == 24: t = -2
            elif (x + y) % 6 == 0 or (x - y) % 6 == 0: m, t = 'bone', 2 if y < 19 else 1
            elif x < 8: t = 1
            elif x > 24: t = -1
            c.P(x, y, K(m, t))
    c.HL(4, 14, 24, K('terra', 1)); c.HL(4, 23, 24, K('terra', -1))
    c.outline()


@piece('shelf-hut', 'tall bamboo shelf seen from above at 3/4 with clay pots, gourds and a basket, a water gourd on the top surface', 1, 2, 'tall_furniture',
       group='interior', solid=[(0, 1)], tags=['오두막', '선반', '대나무'],
       desc='대나무 선반(토기·박·바구니, 윗면에 물 박). 오두막 북벽에 붙인다. 아래 칸 막힘.')
def _hshelf(c):
    # 윗면(가로 대나무 살 6행)
    for j in range(6):
        y = 4 + j; a = 1 if j < 3 else 0
        for x in range(a, 16 - a):
            c.P(x, y, K('thatch', (2 if j % 2 == 0 else 0) - (1 if (x + j * 3) % 7 == 0 else 0)))
    c.HL(1, 4, 14, K('thatch', -2)); c.HL(0, 9, 16, K('thatch', 3))
    fy = 10
    c.R(2, fy, 12, 32 - fy - 2, K('thatch', -3))
    for k in range(3, 14, 3): c.VL(k, fy, 32 - fy - 2, K('thatch', -2))
    for x in (0, 13):
        for y in range(fy, 32):
            c.P(x, y, K('thatch', 1 if x == 0 else 0)); c.P(x + 1, y, K('thatch', -1)); c.P(x + 2, y, K('thatch', -2) if x == 13 else K('thatch', -1))
            if (y + x) % 7 == 0: c.HL(x, y, 3, K('thatch', -3))
    for sy in (fy + 8, fy + 16):
        c.HL(2, sy, 12, K('thatch', 2)); c.HL(2, sy + 1, 12, K('thatch', -1))
        for x in range(3, 14, 4): c.P(x, sy, K('wood', -1))
    # 칸1: 토기 둘
    lit_blob(c, 5, fy + 5, 2.6, 2.4, 'terra', 0, s=2); c.HL(4, fy + 2, 3, K('terra', 2)); c.P(5, fy + 2, K('shadow', 1))
    lit_blob(c, 10.5, fy + 5.4, 2.2, 2.1, 'terra', -1, s=3); c.HL(10, fy + 3, 2, K('terra', 1))
    # 칸2: 박 + 작은 바구니
    lit_blob(c, 5, fy + 13, 2.6, 2.4, 'gold', -1, s=4); c.P(5, fy + 10, K('moss', 0)); c.P(6, fy + 10, K('moss', -1))
    c.R(8, fy + 12, 5, 4, K('thatch', 0)); c.HL(8, fy + 12, 5, K('thatch', 3)); c.HL(8, fy + 13, 5, K('shadow', 1)); c.P(9, fy + 13, K('red', 1)); c.P(11, fy + 13, K('gold', 2))
    for x in range(8, 13, 2): c.VL(x, fy + 14, 2, K('thatch', -2))
    # 칸3: 겹친 사발
    for k in range(3): c.HL(4 - k % 2, fy + 22 - k * 2, 8, K('wood', 1 - k % 2)); c.P(4 - k % 2, fy + 22 - k * 2, K('wood', 2))
    c.HL(0, 31, 16, K('thatch', -3))
    # 윗면 위: 물 박
    c.ellf(9, 5.5, 3, 2.6, lambda x, y, nx, ny, d: K('gold', 2 if nx < -.3 and ny < 0 else 0 if nx < .3 else -2))
    c.R(8, 0, 2, 3, K('gold', 0)); c.P(8, 0, K('gold', 2)); c.P(9, 0, K('wood', 1))
    c.outline()


@piece('tavern-table', 'long rectangular wooden tavern table seen from above at 3/4: deep plank top with ale mugs, plates of food and a candle', 3, 2, 'low_furniture',
       group='interior', solid=[(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1)], tags=['술집', '탁자'],
       desc='술집 긴 사각 탁자(술잔·음식 접시·촛불). 긴 의자·걸상을 양옆에. 3×2 막힘.')
def _ltt(c):
    fy = top_slab(c, 1, 4, 46, 15, 'wood', t=1, inset=2, s=91, bw=4)
    face(c, 1, fy, 46, 3, 'wood', ft=-1)
    for lx in (8, 37): leg(c, lx, fy + 3, 2, 5, 'wood', -3)
    for lx in (2, 43): leg(c, lx, fy + 3, 3, 32 - fy - 3, 'wood', -1)
    c.HL(5, 28, 38, K('wood', -2)); c.HL(5, 29, 38, K('wood', -3))
    mug(c, 5, 6); mug(c, 14, 11, 'gold'); mug(c, 33, 6); mug(c, 40, 11, 'gold')
    bowl(c, 10, 15, 3.5, 1.5, 'bone', fill=('terra', 1))
    bowl(c, 37, 15, 3.5, 1.5, 'bone', fill=('blue', 1))
    # 빵 + 생선 접시
    c.ellf(22, 10, 3.5, 2, lambda x, y, nx, ny, d: K('terra', 2 if ny < 0 and nx < .3 else 0) if d < .85 else K('terra', -1))
    for x in (20, 22, 24): c.P(x, 9, K('sand', 2))
    candle(c, 28, 2, h=6)
    for (x, y) in ((18, 15), (31, 14)): coin(c, x, y)
    c.outline()


@piece('chest-big', 'big ornate closed treasure chest seen from above at 3/4: deep domed lid with gold bands and corner plates, big gold lock', 2, 1, 'box',
       group='interior', solid=[(0, 0), (1, 0)], tags=['보물', '상자'],
       desc='큰 장식 보물 상자(닫힘, 둥근 뚜껑·금 띠·큰 자물쇠). 보물 동굴·선장실. 2칸 막힘.')
def _bchest(c):
    # 둥근 뚜껑(윗면 7행: 뒤 어둡게 → 앞 밝게, 판 결)
    for j in range(7):
        y = 1 + j; a = 2 if j == 0 else 1 if j < 3 else 0
        for x in range(1 + a, 31 - a):
            t = (0 if j == 0 else 1 if j < 3 else 2 if j < 6 else 1) - (1 if (x + j) % 9 == 0 else 0)
            if x in (2, 3): t += 1
            if x in (28, 29): t -= 1
            c.P(x, y, K('wood', t))
    c.HL(3, 1, 26, K('wood', -2)); c.HL(1, 7, 30, K('wood', 3))
    # 몸통(앞면)
    face(c, 1, 8, 30, 8, 'wood', ft=-1, tex='vplanks', s=93)
    c.HL(1, 8, 30, K('wood', -3)); c.HL(1, 15, 30, K('wood', -3))
    # 금 띠·모서리
    for bx in (5, 25):
        c.R(bx, 1, 3, 15, K('gold', 0)); c.VL(bx, 1, 15, K('gold', 2)); c.VL(bx + 2, 1, 15, K('gold', -2))
        c.P(bx + 1, 4, K('gold', 3)); c.P(bx + 1, 11, K('gold', 3))
    for (x, y) in ((1, 9), (28, 9), (1, 13), (28, 13)): c.R(x, y, 3, 2, K('gold', 1)); c.P(x, y, K('gold', 3))
    c.HL(1, 7, 30, K('gold', 1)); c.P(1, 7, K('gold', 3))
    # 자물쇠
    c.R(13, 6, 6, 6, K('gold', 1)); c.HL(13, 6, 6, K('gold', 3)); c.VL(18, 6, 6, K('gold', -2)); c.HL(13, 11, 6, K('gold', -2))
    c.P(15, 8, K('shadow', 0)); c.P(16, 8, K('shadow', 0)); c.P(15, 9, K('shadow', 1)); c.P(14, 7, K('red', 3))
    c.outline()


@piece('stalagmite', 'cave stalagmite seen from above at 3/4: a broad flat rock ledge (top surface visible, with a small drip pool) and a thick rock spike with a wet flat top, curved strata rings', 1, 1, 'other',
       group='interior', solid=[(0, 0)], tags=['동굴', '석순', '바위'],
       desc='동굴 석순(넓은 바위 턱 위 굵은 석순, 물 고인 납작한 꼭대기). 동굴 바닥. 막힘.')
def _stalag(c):
    # 바위 턱: 두께(앞) + 밝은 윗면 타원 + 물웅덩이
    c.ellf(8, 12.4, 7.6, 3.6, lambda x, y, nx, ny, d: K('rock', -2 if nx > .2 else -1) if ny > 0 else None)
    def ledge(x, y, nx, ny, d):
        if d > .8: return K('rock', 0 if ny < 0 else 3)
        return K('rock', 2 if hsh(x, y, 4) % 4 else 1)
    c.ellf(8, 10.8, 7.6, 3.6, ledge)
    c.ellf(12.5, 11.6, 2, 1, lambda x, y, nx, ny, d: K('deep', 1 if nx < 0 else 0))
    # 굵은 석순(원뿔대) — 아래로 휜 층 띠
    for y in range(3, 12):
        f = (y - 3) / 8; r = 2.0 + 2.4 * f
        for x in range(int(6 - r - 1), int(6 + r + 2)):
            nx = (x + .5 - 6) / r
            if abs(nx) > 1: continue
            if y > 10 + 1.4 * math.sqrt(max(0, 1 - nx * nx)): continue
            t = 1 if nx < -.45 else 0 if nx < 0 else -1 if nx < .5 else -2
            c.P(x, y, K('rock', t))
        if y in (5, 8):
            for x in range(int(6 - r), int(6 + r) + 1):
                nx = (x + .5 - 6) / r
                if abs(nx) <= 1: c.P(x, y + round(1.2 * math.sqrt(max(0, 1 - nx * nx))), K('rock', -1 if nx < .3 else -3))
    # 납작한 젖은 꼭대기(윗면 타원)
    c.ellf(6, 3, 2.4, 1.4, lambda x, y, nx, ny, d: K('rock', 3) if d > .5 else K('shallow', 1))
    c.P(5, 2, K('foam', 2))
    c.outline()


@piece('rock-pillar', 'broken natural cave rock column seen from above at 3/4: flat rough top cut face clearly visible, cylindrical body with downward-curving strata rings, flared rocky base', 1, 2, 'column',
       group='interior', solid=[(0, 1)], tags=['동굴', '바위 기둥'],
       desc='부러진 동굴 바위 기둥(납작한 윗면, 휜 층 결, 퍼진 밑동). 동굴 안. 아래 칸 막힘.')
def _rpillar(c):
    cx = 8
    # 퍼진 밑동: 두께 + 윗면 타원
    c.ellf(cx, 28.8, 7.6, 3, lambda x, y, nx, ny, d: K('rock', -2 if nx > .2 else -1) if ny > 0 else None)
    c.ellf(cx, 27.4, 7.6, 3, lambda x, y, nx, ny, d: K('rock', 2 if ny < .3 and nx < .3 else 1) if d > .3 else K('rock', 0))
    # 몸통(원기둥, 가장자리 울퉁불퉁)
    for y in range(4, 28):
        r = 5.0 + .5 * math.sin(y * .8) + (1.2 * (y - 24) / 4 if y > 24 else 0)
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            nx = (x + .5 - cx) / r
            if abs(nx) > 1: continue
            if y > 25.6 + 1.6 * math.sqrt(max(0, 1 - nx * nx)): continue
            t = 1 if nx < -.55 else 0 if nx < -.15 else -1 if nx < .35 else -2 if nx < .7 else -3
            if hsh(x, y // 2, 8) % 9 == 0: t -= 1
            c.P(x, y, K('rock', t))
    # 아래로 휜 층 띠
    for hy in (8, 13, 18, 23):
        for x in range(2, 15):
            nx = (x + .5 - cx) / 5
            if abs(nx) <= 1:
                yy = hy + round(2.6 * math.sqrt(max(0, 1 - nx * nx)))
                c.P(x, yy, K('rock', -1 if nx < .2 else -3)); c.P(x, yy - 1, K('rock', 2 if nx < -.2 else 0))
    # 윗면(부러진 단면, 6행)
    def topf(x, y, nx, ny, d):
        if d > .78: return K('rock', -1 if ny < 0 else 3)
        return K('rock', 3 if hsh(x, y, 9) % 4 == 0 else 2) if nx + ny < .4 else K('rock', 1)
    c.ellf(cx, 4, 5.2, 3, topf)
    c.P(6, 3, K('moss', 1)); c.P(7, 3, K('moss', 0)); c.P(10, 5, K('moss', -1))
    c.outline()


@piece('torch-stand', 'standing iron brazier seen from above at 3/4: wide round fire bowl full of glowing coals with flames, on a tall tripod stand', 1, 2, 'column',
       group='interior', solid=[(0, 1)], tags=['횃불', '화로', '동굴', '요새'],
       desc='쇠 화로대(넓은 둥근 불 그릇에 숯불·불꽃, 세발 받침). 동굴·요새·보물 방. 아래 칸 막힘.')
def _brazier(c):
    # 세발 받침
    c.line(7, 16, 2, 30, K('iron', 1)); c.line(8, 16, 3, 30, K('iron', -1))
    c.line(9, 16, 14, 30, K('iron', -1)); c.line(10, 16, 15, 30, K('iron', -2))
    c.R(7, 15, 2, 15, K('iron', 0)); c.VL(7, 15, 15, K('iron', 2))
    c.HL(4, 24, 9, K('iron', -1)); c.P(4, 24, K('iron', 1))
    for (x, y) in ((1, 30), (14, 30), (7, 30)): c.R(x, y, 2, 2, K('iron', -1))
    # 불 그릇: 몸통(앞) + 아가리(윗면 타원) + 숯 + 불꽃
    for y in range(10, 16):
        for x in range(1, 16):
            nx = (x + .5 - 8) / 7
            if abs(nx) > 1 or y > 13 + 2.4 * math.sqrt(max(0, 1 - nx * nx)): continue
            c.P(x, y, K('iron', 1 if nx < -.4 else 0 if nx < .3 else -2))
    c.HL(1, 12, 15, K('iron', -2))
    def mouth(x, y, nx, ny, d):
        if d > .7: return K('iron', 3 if ny < -.2 and nx < .3 else 2 if ny < .3 else 1)
        return K('fire', 1 if hsh(x, y, 2) % 3 else 2) if ny > -.3 else K('fire', -1)
    c.ellf(8, 10, 7.2, 3, mouth)
    for (x, y, t) in ((8, 1, 2), (7, 2, 2), (8, 2, 3), (9, 3, 2), (6, 4, 1), (7, 4, 3), (8, 4, 3), (9, 4, 2), (10, 5, 1), (5, 6, 1), (6, 6, 2),
                      (7, 6, 3), (8, 6, 3), (9, 6, 3), (10, 6, 2), (11, 7, 1), (4, 8, 0), (5, 8, 2), (6, 8, 3), (7, 8, 3), (8, 8, 3), (9, 8, 3), (10, 8, 2), (11, 8, 1),
                      (6, 5, 2), (8, 5, 3), (9, 5, 2), (7, 7, 3), (8, 7, 3), (9, 7, 2), (6, 7, 2), (10, 7, 2), (8, 3, 3), (7, 3, 2), (8, 0, 1), (11, 3, 1), (5, 3, 0)):
        c.P(x, y, K('fire', t))
    c.outline()


@piece('porthole', 'round brass ship porthole with rivets showing the blue sea and sky outside', 1, 1, 'wall_mounted',
       group='interior', tags=['배', '벽걸이', '현창'],
       desc='둥근 놋쇠 현창(바다·하늘이 보임). 배 선실 벽 앞면 위에 겹쳐 놓는다. 통행.')
def _porthole(c):
    def ring(x, y, nx, ny, d):
        r = math.sqrt(d)
        lit = nx + ny < -.2
        if r > .78:
            a = math.atan2(ny, nx); k = (a + math.pi) / (2 * math.pi) * 8
            if abs(k - round(k)) < .12 and .84 < r < .95: return K('gold', 3)
            return K('gold', 1 if lit else -1)
        if r > .66: return K('gold', -2 if lit else 2)
        # 유리: 하늘(위) · 수평선 · 바다(아래)
        if ny < -.15: return K('blue', 2 if ny < -.5 else 3)
        if ny < .05: return K('foam', 1)
        return K('deep', 1 if (x + y) % 4 else 2)
    c.ellf(8, 8, 7.2, 7.2, ring)
    c.P(5, 5, K('foam', 2)); c.P(6, 4, K('foam', 2)); c.P(5, 6, K('foam', 1))
    c.outline()


@piece('ship-window', 'stern-cabin leaded window: dark wood frame with small glass panes showing the sea, brass fittings, sill below', 2, 1, 'wall_mounted',
       group='interior', tags=['배', '벽걸이', '창문', '선장실'],
       desc='선미 선실 납틀 창(작은 유리 칸 너머 바다, 놋쇠 장식, 창턱). 선장실 벽 앞면 위에 겹쳐 놓는다(2칸 폭). 통행.')
def _swindow(c):
    # 틀
    c.R(1, 1, 30, 13, K('dark', 0)); c.HL(1, 1, 30, K('dark', 2)); c.VL(1, 1, 13, K('dark', 1)); c.VL(30, 1, 13, K('dark', -2))
    # 유리 칸 3짝 × (2×3 칸)
    for wx in (3, 12, 21):
        for j in range(2):
            for i in range(3):
                x0, y0 = wx + i * 3, 3 + j * 4
                for yy in range(3):
                    for xx in range(2):
                        Y = y0 + yy
                        if Y < 6: col = K('blue', 2 if Y < 4 else 3)
                        elif Y == 6: col = K('foam', 1)
                        else: col = K('deep', 1 if (x0 + xx + Y) % 3 else 2)
                        c.P(x0 + xx, Y, col)
        c.P(wx, 3, K('foam', 2))
        c.R(wx - 1, 2, 9, 1, K('iron', -1)); c.R(wx - 1, 10, 9, 1, K('iron', -1))
    for mx in (11, 20): c.R(mx, 2, 1, 10, K('dark', 1))
    # 위 장식 · 놋쇠 · 창턱
    c.HL(1, 0, 30, K('gold', 1)); c.P(1, 0, K('gold', 3)); c.HL(14, 0, 4, K('gold', 3))
    for x in (6, 15, 24): c.P(x, 11, K('gold', 2))
    c.HL(0, 13, 32, K('dark', 3)); c.HL(0, 14, 32, K('dark', 1)); c.HL(0, 15, 32, K('dark', -2))
    c.outline()


@piece('wall-map', 'nautical sea chart pinned to the wall with brass tacks: islands, a dotted route, an X and a compass rose, no text', 2, 1, 'wall_mounted',
       group='interior', tags=['선장실', '벽걸이', '지도'],
       desc='벽에 핀으로 꽂은 해도(섬·점선 항로·X 표시·나침도, 글자 없음). 선장실·술집 벽 앞면 위에 겹쳐 놓는다(2칸 폭). 통행.')
def _wmap(c):
    parchment(c, 2, 1, 28, 14, s=95)
    c.P(2, 14, K('sand', 0)); c.P(3, 14, K('sand', -1)); c.P(29, 1, K('sand', 1)); c.P(28, 1, K('sand', 0))
    for (cx, cy, rx, ry) in ((8, 5, 3, 2), (19, 4, 3, 1.6), (24, 10, 3.5, 2), (12, 11, 2, 1.4)):
        c.ellf(cx, cy, rx, ry, lambda x, y, nx, ny, d: K('sand', -1) if d > .55 else K('sand', 0 if (x + y) % 3 else 1))
    c.P(8, 4, K('moss', 0)); c.P(24, 9, K('moss', 0)); c.P(25, 10, K('moss', 1))
    for (x, y) in ((10, 6), (12, 7), (14, 7), (16, 8), (18, 8), (20, 9)): c.P(x, y, K('red', 0))
    c.P(23, 9, K('red', -1)); c.P(25, 11, K('red', -1)); c.P(25, 9, K('red', -1)); c.P(23, 11, K('red', -1)); c.P(24, 10, K('red', 1))
    cx, cy = 26, 4
    c.VL(cx, cy - 2, 5, K('terra', -1)); c.HL(cx - 2, cy, 5, K('terra', -1)); c.P(cx, cy - 2, K('red', 0)); c.P(cx, cy, K('gold', 2))
    for (x, y) in ((3, 2), (28, 2), (3, 13), (28, 13)): c.P(x, y, K('gold', 3)); c.P(x + 1, y + 1, K('gold', -1))
    c.outline()
