#!/usr/bin/env python3
"""snow_north 바닥 — 한 칸 반복 바닥(눈·다진 눈·얼음·툰드라·서리 풀·진창·판자·돌길) + 8방 오토타일 6종.

무늬는 세계 좌표 16 주기라 이어 칠해도 이음새가 없다. 눈은 «흰 판»이 되기 쉬워서 바람 물결·반짝임·푸른 오목을 꼭 넣는다.
오토타일(autotile.py Depression): 다진 눈길 · 얼어붙은 호수(균열) · 툰드라 · 서리 풀 · 진창 — 둘레 눈보다 낮다,
얼음 구멍(열린 물) — 둘레 얼음보다 낮다.

  python3 terrain.py     # tiledata/snow-north/terrain/_gate/*.png + autotile/*.png + preview
"""
import os, sys, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, save
from kit import Reg, contact, OUT
import autotile as AT

R = Reg('terrain')
TAU = 2 * math.pi


# ═══════════════════════ 질감(세계 좌표, 16 주기) ═══════════════════════
SNOW_STROKES = [
    [(1, 3, 6, 1), (9, 9, 5, -1), (3, 13, 4, 1)],
    [(6, 2, 5, -1), (0, 8, 4, 1), (10, 12, 6, 1)],
    [(2, 5, 7, 1), (11, 1, 4, -1), (7, 12, 5, -1)],
    [(4, 1, 4, 1), (12, 6, 5, 1), (1, 10, 6, -1)],
]
SNOW_DOTS = [[(6, 7), (13, 4), (2, 10), (12, 14)], [(3, 5), (12, 9), (7, 14)], [(9, 4), (4, 9), (14, 11)], [(8, 4), (2, 6), (10, 13), (15, 1)]]


def snow_px(wx, wy, s=0, base=5, ripple=True):
    """눈: 칸마다 손으로 놓은 바람 물결 획 2~3개(아래 옅은 푸른 줄 + 위 반짝 테, 끝이 살짝 휜다) + 반짝이 점 몇 개.
    나머지는 고른 바탕 — 점을 흩뿌린 «벽지»가 되지 않게 한다. 변주 4벌을 덩이로 섞어 넓은 눈밭의 반복을 깬다."""
    lx, ly = wx % 16, wy % 16
    k = s % 4
    if ripple:
        for (x0, y0, ln, bend) in SNOW_STROKES[k]:
            xx = (lx - x0) % 16
            if xx >= ln: continue
            yc = (y0 + (bend if xx in (0, ln - 1) else 0)) % 16
            if ly == yc: return ('snow', base - 1)
            if ly == (yc - 1) % 16 and 0 < xx < ln - 1: return ('snow', min(6, base + 1))
    for (x0, y0) in SNOW_DOTS[k]:
        if lx == x0 and ly == y0: return ('snow', min(6, base + 1))
    if (lx + 3 * ly + 5 * k) % 29 == 0: return ('snow', base - 1)
    return ('snow', base)


def snow_tex(s=0, base=5):
    return lambda wx, wy: snow_px(wx, wy, s, base)


PACK_DENTS = [[(3, 3), (11, 6), (6, 12)], [(9, 2), (2, 9), (13, 13)], [(5, 6), (12, 11), (1, 14)]]


def pack_px(wx, wy, s=0):
    """다진 눈: 고른 밝은 회백 바탕(5) + 칸마다 밟힌 오목 세 개(2px 그늘 + 아래 반사) + 옅은 얼룩 한 덩이."""
    lx, ly = wx % 16, wy % 16
    k = s % 3
    for (px_, py_) in PACK_DENTS[k]:
        if (lx - px_) % 16 in (0, 1) and ly == py_: return ('pack', 3)
        if (lx - px_) % 16 in (0, 1) and ly == (py_ + 1) % 16: return ('snow', 6)
    v = math.sin(TAU * (lx / 16.0 + 0.1 * k)) + math.sin(TAU * (ly / 16.0 + 0.3))
    if v > 1.25: return ('pack', 4)
    if (lx * 7 + ly * 3 + k) % 31 == 0: return ('pack', 4)
    return ('pack', 5)


ICE_CRACKS = [((0, 11), (5, 9), (9, 10), (16, 7)), ((9, 10), (11, 14), (12, 16))]
# 맑은 얼음 덩이(손 모양 마스크, 칸마다 하나) · 서리 획 · 기포 — 변주 넷
ICE_PATCH = [
    (2, 3, ["..####..", ".######.", "########", ".#####..", "..##...."]),
    (7, 8, [".####...", "#######.", ".#######", "..####.."]),
    (5, 1, ["...###..", ".######.", "#######.", ".####..."]),
    (8, 6, ["..###...", ".#####..", "#######.", "..#####.", "...##..."]),
]
ICE_STREAK = [[(10, 2, 4), (1, 12, 3)], [(1, 4, 3), (11, 13, 4)], [(9, 11, 5), (0, 9, 2)], [(2, 1, 3), (12, 9, 3)]]
ICE_BUBBLE = [[(13, 6), (5, 11)], [(3, 14), (13, 2)], [(12, 8), (2, 6)], [(14, 14), (4, 12)]]


def ice_px(wx, wy, s=0, crack=False):
    """호수 얼음: 고른 바탕 + 칸마다 손으로 놓은 맑은 얼음 덩이(짙게) 하나 + 흰 서리 획 둘 + 기포.
    균열은 변주 칸(crack=True)에만 — 몸통에 넣으면 16px 마다 같은 금이 줄지어 보인다."""
    lx, ly = wx % 16, wy % 16
    k = s % 4
    if crack:
        for poly in ICE_CRACKS:
            for (x0, y0), (x1, y1) in zip(poly, poly[1:]):
                n = max(abs(x1 - x0), abs(y1 - y0))
                for q in range(n + 1):
                    cx = round(x0 + (x1 - x0) * q / n) % 16; cy = round(y0 + (y1 - y0) * q / n) % 16
                    if cx == lx and cy == ly: return ('ice', 1)
                    if cx == lx and (cy + 1) % 16 == ly: return ('ice', 6)
    for (bx, by) in ICE_BUBBLE[k]:
        if (lx, ly) == (bx, by): return ('ice', 6)
        if (lx, ly) == (bx + 1, by + 1): return ('ice', 3)
    for (x0, y0, ln) in ICE_STREAK[k]:
        d = (lx - x0) % 16
        if d < ln and (ly - y0) % 16 == (d // 2) % 16: return ('ice', 5)
    px0, py0, rows = ICE_PATCH[k]
    yy = (ly - py0) % 16; xx = (lx - px0) % 16
    if yy < len(rows) and xx < len(rows[yy]) and rows[yy][xx] == '#':
        edge = yy == 0 or rows[yy - 1][xx] != '#' if yy > 0 else True
        return ('ice', 3) if not (yy > 0 and (xx + yy) % 5 == 0) else ('ice', 2)
    return ('ice', 4)


def ice_tex(s=0, crack=False):
    return lambda wx, wy: ice_px(wx, wy, s, crack)


def water_px(wx, wy, f=0):
    lx, ly = wx % 16, wy % 16
    t = 1 + (1 if rnd(lx // 2, ly, 7) > 0.8 else 0)
    for (ox, oy, ln) in ((2, 3, 4), (9, 7, 3), (4, 11, 5), (12, 14, 3)):
        xx = (lx - ox - f) % 16
        if ly == oy and xx < ln: return ('water', 4 if xx in (1, 2) else 3)
        if ly == oy + 1 and 0 < xx < ln + 1: return ('water', 0)
    return ('water', t)


TUFTS = [
    [(2, 3), (9, 1), (13, 6), (5, 8), (11, 11), (1, 13), (7, 14)],
    [(4, 2), (12, 3), (1, 7), (8, 6), (14, 11), (5, 12), (10, 15)],
    [(1, 1), (7, 4), (13, 2), (3, 10), (10, 9), (15, 14), (6, 13)],
]


def tuft_at(lx, ly, k):
    """풀포기 하나 = 밑동 3px 위로 갈라지는 잎 «v» 모양 (dx, dy) → 0 밑/1 잎/2 끝."""
    for (x0, y0) in TUFTS[k % 3]:
        dx, dy = (lx - x0) % 16, (ly - y0) % 16
        if dx > 8: dx -= 16
        if dy > 8: dy -= 16
        if dy == 0 and dx in (-1, 0, 1): return 0
        if dy == -1 and dx in (-2, 0, 2): return 1
        if dy == -2 and dx in (-2, 1, 3): return 2
        if dy == 1 and dx in (-1, 0, 1, 2): return 3
    return None


def tundra_px(wx, wy, s=0):
    """툰드라: 어두운 흙(얼룩 덩이) 위 마른 풀포기 «v» + 작은 돌·이끼 점."""
    lx, ly = wx % 16, wy % 16
    t = tuft_at(lx, ly, s)
    if t == 0: return ('tundra', 2)
    if t == 1: return ('tundra', 3)
    if t == 2: return ('tundra', 4)
    if t == 3: return ('slush', 0)
    if (lx, ly) in ((6, 5), (14, 9)) and s % 2 == 0: return ('stone', 4)
    if (lx, ly) in ((7, 5), (14, 10)) and s % 2 == 0: return ('stone', 2)
    v = math.sin(TAU * (lx / 16.0 + 0.3)) + math.cos(TAU * (ly / 16.0 + lx / 16.0))
    return ('tundra', 1) if v > 0.6 else ('slush', 2) if v < -0.9 else ('tundra', 0) if (lx * 3 + ly) % 11 == 0 else ('slush', 1)


def frost_px(wx, wy, s=0):
    """서리 풀: 얇게 깔린 눈 바탕 위 청회 풀포기, 잎 끝마다 흰 서리."""
    lx, ly = wx % 16, wy % 16
    t = tuft_at(lx, ly, s + 1)
    if t == 0: return ('frost', 1)
    if t == 1: return ('frost', 3)
    if t == 2: return ('snow', 6)
    if t == 3: return ('frost', 0)
    v = math.sin(TAU * (lx / 16.0)) + math.sin(TAU * (ly / 16.0 + 0.4))
    return ('snow', 3) if v > 0.9 else ('frost', 2) if v < -0.5 else ('snow', 2) if (lx + ly) % 7 == 0 else ('frost', 2)


def slush_px(wx, wy, s=0):
    """진창: 젖은 흙 + 녹다 만 눈 덩이 + 물웅덩이 반짝."""
    lx, ly = wx % 16, wy % 16
    v = math.sin(TAU * (lx / 16.0)) * math.cos(TAU * (ly / 16.0 + 0.25))
    if v > 0.55: return ('snow', 3 if (lx + ly) % 4 else 4)
    if v < -0.6: return ('water', 3 if (lx + 2 * ly) % 5 == 0 else 2)
    t = 2 if rnd(lx // 2, ly, s) < 0.6 else 3
    if rnd(lx, ly, s + 3) < 0.05: t = 1
    return ('slush', t)


# ═══════════════════════ 한 칸 바닥 ═══════════════════════
def fill(c, fn):
    c.F(0, 0, 16, 16, lambda wx, wy, i, j: fn(wx, wy))


@R.add('snow', '눈밭(바람 물결)', 1, 1, 'terrain', tags=['눈', '눈밭', '설원'], rules='북방 맵의 기본 바닥. 넓게 칠하되 snow-b·snow-c·snow-d 를 덩이로 섞어 흰 판이 되지 않게 한다.')
def _(c): fill(c, snow_tex(0))


@R.add('snow-b', '눈밭(물결 짙은 변주)', 1, 1, 'terrain', tags=['눈', '눈밭'], rules='눈밭에 덩이로 섞는다(바람 맞는 곳).')
def _(c):
    fill(c, snow_tex(3))
    for (x, y) in ((4, 4), (11, 9)):
        c.P(x, y, 'snow', 4); c.P(x + 1, y, 'snow', 4); c.P(x + 2, y + 1, 'snow', 4)


@R.add('snow-c', '눈밭(짐승 발자국)', 1, 1, 'terrain', tags=['눈', '눈밭', '발자국'], rules='눈밭에 드문드문(한 줄로 늘어놓으면 발자국 길).')
def _(c):
    fill(c, snow_tex(0))
    for k, (x, y) in enumerate(((3, 2), (7, 5), (4, 8), (8, 11), (5, 14))):
        c.P(x, y, 'snow', 3); c.P(x + 1, y, 'snow', 3); c.P(x, y + 1, 'snow', 2); c.P(x + 1, y + 1, 'snow', 4)
        c.P(x - 1, y - 1, 'snow', 4); c.P(x + 2, y - 1, 'snow', 4)


@R.add('snow-d', '눈밭(마른 풀 끝이 삐죽)', 1, 1, 'terrain', tags=['눈', '눈밭', '풀'], rules='눈밭 가장자리·숲 둘레에 덩이로.')
def _(c):
    fill(c, snow_tex(5))
    for (x, y) in ((2, 6), (3, 5), (9, 3), (10, 4), (12, 11), (5, 12), (6, 13)):
        c.P(x, y, 'tundra', 3); c.P(x, y + 1, 'tundra', 1); c.P(x, y + 2, 'snow', 3)


@R.add('snow-shade', '눈밭(숲 그늘, 푸른빛)', 1, 1, 'terrain', tags=['눈', '그늘', '숲'], rules='침엽수 덩이 밑·북쪽 그늘. 숲 둘레 1~2칸에.')
def _(c): fill(c, snow_tex(7, base=4))


@R.add('pack', '다진 눈길', 1, 1, 'terrain', tags=['눈길', '길'], rules='길 몸통 칸. 가장자리는 오토타일 sn-at-pack 이 둑을 그린다.')
def _(c): fill(c, pack_px)


@R.add('pack-sled', '다진 눈길(썰매 자국, 동서)', 1, 1, 'terrain', tags=['눈길', '썰매', '길'], rules='동서로 뻗은 큰길 가운데 줄에 이어 칠한다.')
def _(c):
    fill(c, pack_px)
    for y in (5, 10):
        c.HL(0, y, 16, 'pack', 2); c.HL(0, y + 1, 16, 'pack', 5)


@R.add('pack-sled-v', '다진 눈길(썰매 자국, 남북)', 1, 1, 'terrain', tags=['눈길', '썰매', '길'], rules='남북으로 뻗은 길 가운데 줄에 이어 칠한다.')
def _(c):
    fill(c, pack_px)
    for x in (5, 10):
        c.VL(x, 0, 16, 'pack', 2); c.VL(x + 1, 0, 16, 'pack', 5)


@R.add('ice', '얼어붙은 호수 얼음', 1, 1, 'terrain', tags=['얼음', '호수', '강'], rules='호수·강 몸통. 가장자리는 오토타일 sn-at-ice.')
def _(c): fill(c, ice_tex(0))


@R.add('ice-clear', '맑은 얼음(균열 없음, 짙음)', 1, 1, 'terrain', tags=['얼음', '호수'], rules='호수 한가운데 깊은 곳에 덩이로.')
def _(c):
    fill(c, lambda wx, wy: (lambda p: ('ice', max(2, p[1] - 1)))(ice_px(wx, wy, 5, crack=False)))


@R.add('ice-crack', '얼음(큰 균열)', 1, 1, 'terrain', tags=['얼음', '균열'], rules='호수에 드문드문. 낚시 구멍 둘레에 하나.')
def _(c):
    fill(c, ice_tex(2, crack=False))
    pts = [(0, 3), (4, 5), (7, 4), (9, 8), (13, 9), (16, 12)]
    for (a, b) in zip(pts, pts[1:]): c.line(a[0], a[1], b[0], b[1], 'ice', 1)
    for (a, b) in zip(pts, pts[1:]): c.line(a[0], a[1] + 1, b[0], b[1] + 1, 'ice', 6)
    c.line(9, 8, 8, 13, 'ice', 1); c.line(8, 13, 6, 16, 'ice', 1)


@R.add('ice-dust', '얼음(눈가루 흩날림)', 1, 1, 'terrain', tags=['얼음', '눈'], rules='호숫가 가까운 얼음에 섞는다.')
def _(c):
    fill(c, ice_tex(4, crack=False))
    for y in range(16):
        for x in range(16):
            if math.sin(TAU * (x / 16 + y / 32)) > 0.55 and rnd(x, y, 9) < 0.7: c.P(x, y, 'snow', 5 if rnd(x, y, 3) < 0.6 else 4)


@R.add('tundra', '툰드라(마른 풀)', 1, 1, 'terrain', tags=['툰드라', '풀', '들'], rules='눈 녹은 들. 가장자리는 오토타일 sn-at-tundra.')
def _(c): fill(c, tundra_px)


@R.add('frost', '서리 풀', 1, 1, 'terrain', tags=['서리', '풀'], rules='마을 둘레·숲가. 가장자리는 오토타일 sn-at-frost.')
def _(c): fill(c, frost_px)


@R.add('slush', '진창(녹은 눈과 흙)', 1, 1, 'terrain', tags=['진창', '흙'], rules='우물·마구간·시장 바닥처럼 많이 밟힌 곳. 가장자리는 sn-at-slush.')
def _(c): fill(c, slush_px)


def boards(c, x, y, w, h, s=3, horiz=True, snowy=True):
    """회색 판자(동서로 누운 판). 판마다 길이·이음 위치가 다르고 이음 틈에 눈이 낀다."""
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        a, b = (lx, ly) if horiz else (ly, lx)
        row = b // 4; yy = b % 4
        seam = (h32(row, 0, s) % 9 + 4)
        if yy == 3: return ('drift', 0)
        if a == seam: return ('drift', 1) if not (snowy and yy == 2) else ('snow', 4)
        t = 3 + (1 if yy == 0 else 0) - (1 if h32(row, a > seam, s + 1) % 3 == 0 else 0)
        if a in (seam - 2, seam + 2) and yy == 1: return ('iron', 2)
        if snowy and yy == 2 and h32(a // 3, row, s + 5) % 5 == 0: return ('snow', 5)
        return ('drift', t)
    c.F(x, y, w, h, f)


@R.add('boards', '판자 길(동서)', 1, 1, 'terrain', tags=['판자', '잔교', '길'], rules='얼음 위 잔교·질척한 마당의 판자 길. 동서로.')
def _(c): boards(c, 0, 0, 16, 16)


@R.add('boards-v', '판자 길(남북)', 1, 1, 'terrain', tags=['판자', '잔교', '길'], rules='남북으로 놓인 판자 길.')
def _(c): boards(c, 0, 0, 16, 16, horiz=False)


@R.add('flagstone', '눈 낀 판석', 1, 1, 'terrain', tags=['돌', '광장', '판석'], rules='회관·교회 앞마당과 시장 광장 바닥.')
def _(c):
    rows = [[0, 7, 12], [3, 10], [1, 6, 13], [4, 11]]
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        r = ly // 4; yy = ly % 4
        b = rows[r]
        edge = any(lx == x0 for x0 in b)
        if yy == 3 or edge:
            return ('snow', 4) if rnd(lx, ly, 3) < 0.55 else ('stone', 2)
        k = sum(1 for x0 in b if lx > x0)
        t = 4 + (h32(k, r, 4) % 3) - 1
        if yy == 0 and lx - max([x0 for x0 in b if x0 < lx] or [-1]) <= 2: t += 1
        return ('stone', min(6, t))
    c.F(0, 0, 16, 16, f)


@R.add('hearthstone', '불 쬐는 돌바닥(그을림)', 1, 1, 'terrain', tags=['돌', '화로'], rules='화톳불·화로 둘레 한 칸 고리.')
def _(c):
    c.F(0, 0, 16, 16, lambda wx, wy, i, j: ('stone', 3 + (1 if rnd(i // 3, j // 3, 2) < 0.5 else 0) - (1 if math.hypot(i - 7.5, j - 7.5) < 4 else 0)))
    for (x, y) in ((2, 2), (12, 3), (4, 12), (13, 13)): c.P(x, y, 'slush', 1)


def water_cell(f):
    def d(c): fill(c, lambda wx, wy: water_px(wx, wy, f))
    return d


for fr in range(3):
    R.add('water' if fr == 0 else 'water-f%d' % fr, '열린 물(얼음 구멍·여울)' + ('' if fr == 0 else ' (프레임 %d)' % (fr + 1)), 1, 1, 'terrain',
          tags=['물', '여울'], rules='얼음 구멍·얼지 않은 여울 몸통(막힘). 가장자리는 오토타일 sn-at-water.')(water_cell(fr))


# ═══════════════════════ 오토타일 ═══════════════════════
def _icicles(c, m, dep, tx, ty):
    """호수 북쪽 둑 앞면 아래로 고드름(얼음 쪽으로 1~3px)."""
    if m & 1: return
    for x in range(1, 15):
        D, eff = dep.depth(m, x, 7, tx, ty)
        if eff != 'N': continue
        # 경계 줄 찾기
        for y in range(1, 12):
            d0, e0 = dep.depth(m, x, y, tx, ty)
            if e0 == 'N' and d0 >= 0:
                ln = (1, 0, 2, 0, 1, 3, 0, 1)[(x * 5 + 3) % 8]
                for k in range(ln): c.P(x, y + k, 'ice', 6 if k == 0 else 5)
                break


def _dust(c, m, dep, tx, ty):
    """얼음 구멍 둘레: 북쪽 얼음 두께 앞면(어두운 청 + 물때)."""
    return


AUTOTILES = [
    dict(id='pack', name='다진 눈길', inside='다진 눈', outside='눈밭',
         dep=AT.Depression('pack', pack_px, snow_tex(0), inset=dict(N=4, E=3, S=2, W=3), amp=3, face=2, R=5, shadow=1, seed=11),
         bodies=[lambda wx, wy: pack_px(wx, wy, 1), lambda wx, wy: pack_px(wx, wy, 2)],
         rules='마을 길·광장 둘레 길. 길이 될 칸을 한 덩이로 칠하면 가장자리 눈 둑이 저절로 맞는다. 문 앞 접근칸까지 잇는다.'),
    dict(id='ice', name='얼어붙은 호수·강', inside='얼음', outside='눈밭',
         dep=AT.Depression('ice', ice_tex(0), snow_tex(0), inset=dict(N=7, E=3, S=3, W=3), amp=3, face=4, R=6, shadow=2, seed=23, deco=_icicles),
         bodies=[ice_tex(0, crack=True), ice_tex(1)],
         rules='호수·강 덩이. 얼음은 걸을 수 있다(얼음 낚시터). 북쪽 물가는 눈 둑 앞면과 고드름이 보인다.'),
    dict(id='tundra', name='툰드라(눈 녹은 들)', inside='툰드라', outside='눈밭',
         dep=AT.Depression('tundra', tundra_px, snow_tex(0), inset=dict(N=4, E=3, S=3, W=3), amp=3, face=2, R=4, shadow=1, seed=37),
         bodies=[lambda wx, wy: tundra_px(wx, wy, 5), lambda wx, wy: tundra_px(wx, wy, 9)],
         rules='눈 녹은 들판 덩이. 숲가·바위 둘레·남향 비탈에 불규칙한 덩이로.'),
    dict(id='frost', name='서리 풀', inside='서리 풀', outside='눈밭',
         dep=AT.Depression('frost', frost_px, snow_tex(0), inset=dict(N=3, E=3, S=3, W=3), amp=3, face=1, R=4, shadow=1, seed=41),
         bodies=[lambda wx, wy: frost_px(wx, wy, 4), lambda wx, wy: frost_px(wx, wy, 8)],
         rules='마을 둘레 풀밭 덩이. 집 뒤뜰·울타리 안.'),
    dict(id='slush', name='진창', inside='진창', outside='눈밭',
         dep=AT.Depression('slush', slush_px, snow_tex(0), inset=dict(N=3, E=3, S=2, W=3), amp=2, face=1, R=4, shadow=1, seed=53),
         bodies=[lambda wx, wy: slush_px(wx, wy, 5), lambda wx, wy: slush_px(wx + 5, wy + 3, 2)],
         rules='우물가·시장·마구간처럼 많이 밟혀 눈이 녹은 곳. 작은 덩이로.'),
    dict(id='water', name='얼음 구멍·여울(열린 물)', inside='열린 물', outside='얼음',
         dep=AT.Depression('water', lambda wx, wy: water_px(wx, wy, 0), ice_tex(0), inset=dict(N=5, E=2, S=2, W=2), amp=1, face=3, R=3, shadow=1, seed=67, out_mat='ice'),
         bodies=[lambda wx, wy: water_px(wx, wy, 1), lambda wx, wy: water_px(wx, wy, 2)],
         rules='얼음 위 낚시 구멍(2×2 이상 덩이)·얼지 않은 여울. 막힘 — 걸을 수 없다. 둘레는 얼음.'),
]

AT_OUT = os.path.join(OUT, 'autotile')


def build_autotiles(write=True):
    """오토타일마다: 칸 49장 PNG + 견본 조립 그림(관문 정본, kind terrain)."""
    res = []
    g = AT.sample_mask()
    for a in AUTOTILES:
        cells, bodies = a['dep'].build(a['bodies'])
        out_c = C(16, 16)
        ofn = a['dep'].out_fn
        out_c.F(0, 0, 16, 16, lambda wx, wy, i, j: ofn(wx, wy))
        sample, used = AT.render_mask(a['dep'], cells, g, out_c, bodies)
        missing = [m for m in AT.CANON if m not in used]
        if write:
            d = os.path.join(AT_OUT, a['id']); os.makedirs(d, exist_ok=True)
            for m, cc in cells.items(): save(cc, os.path.join(d, 'm%03d.png' % m))
            for k, b in enumerate(bodies): save(b, os.path.join(d, 'b%d.png' % (k + 1)))
            save(sample, os.path.join(OUT, 'terrain', '_gate', 'sn-at-%s.png' % a['id']))
        res.append(dict(a, cells=cells, bodyCells=bodies, sample=sample, missing=missing))
    return res


def export_all():
    rows = R.export()
    ats = build_autotiles()
    d = os.path.join(OUT, 'terrain', '_gate')
    with open(os.path.join(d, 'items.jsonl'), 'a') as f:
        for a in ats:
            f.write(json.dumps(dict(png='sn-at-%s.png' % a['id'], kind='terrain', name='autotile %s (%s inside snow-bank border)' % (a['id'], a['inside']),
                                    label='snow-north/sn-at-' + a['id']), ensure_ascii=False) + '\n')
    return rows, ats


def sheet(path=None, z=3):
    items = [(it['id'], R.render(it).img()) for it in R.items]
    return contact(items, path or os.path.join(OUT, 'terrain', 'preview.png'), z=z, W=1800)


if __name__ == '__main__':
    rows, ats = export_all(); sheet()
    for a in ats: print(a['id'], 'missing canon', a['missing'])
    print(len(R.items), 'tiles', len(ats), 'autotiles')
