# 일반 암석 동굴 조각. 버들항 px2.C 볼륨 페인터(재료 grain + 6단 양자화 + 색 윤곽)와 pz.fin 으로 손 도트.
# 3/4 시점: 윗면 + 앞면, 옆면 없음, 빛 왼쪽 위, 1칸 = 16px. 사람 얼굴·글자 없음.
from rc_base import *
from rc_base import _hash
import pz
from px2 import C

def vk(k): return (k - .7) / 4.9                       # px2.C 의 값 → 단 변환의 역 (단 k 를 정확히 찍는다)
def cyl_k(u):
    """원통 가로 명암(버들항 원기둥과 같은 결): 왼쪽 밝은 띠 → 오른쪽 그늘."""
    return 3.7 - 2.1 * u - .8 * u * u + (.75 if -.78 < u < -.32 else 0)
def finish(c, sh=None):
    im = c.img(True)
    if sh: im = shade_under(im, *sh)
    return pad16(im)

def shade_under(im, cx, cy, rx, ry, a=78):
    """발밑 그림자(바닥에 떨어지는 반투명 점): 그림 뒤에 깐다."""
    sh = new(im.width, im.height); p = sh.load()
    for y in range(im.height):
        for x in range(im.width):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: p[x, y] = (16, 10, 18, a)
    sh.alpha_composite(im); return sh

# ------------------------------------------------------------------ 석순·종유석
def _cone(c, cx, top, base, hw0, hw1, mat='crock', seed=0, rings=True, lean=0.0, bias=-0.1):
    """세운 원뿔(석순): top 행에서 반폭 hw0, base 행에서 hw1. 고리 모양 흐름돌 띠, 빛 왼쪽 위."""
    c.new()
    for y in range(int(top), int(base) + 1):
        f = (y - top) / max(1, base - top)
        hw = hw0 + (hw1 - hw0) * (f ** 0.85)
        bul = 0.0
        if rings: bul = 0.6 * math.sin(f * 9.0 + seed) * (0.3 + f)
        hw = max(0.6, hw + bul)
        x0 = cx + lean * (1 - f) * 3
        for x in range(int(x0 - hw) - 1, int(x0 + hw) + 2):
            u = (x + .5 - x0) / hw
            if abs(u) > 1: continue
            k = cyl_k(u) + bias * 5 + (.4 if f < .18 else 0)
            if rings and abs(math.sin(f * 9.0 + seed)) < .22: k -= .9 if u > -.5 else .4
            c.setv(x, y, mat, vk(k))
    # 끝 반짝
    c.tone(int(cx + lean * 3), int(top), mat, 6)

def stalagmite(kind='m', seed=0, lean=0.0):
    """석순 하나. kind s=1x1 낮은 것, m=1x2, l=1x3 큰 것."""
    H = {'s': 16, 'm': 32, 'l': 48}[kind]; hw1 = {'s': 4.5, 'm': 5.5, 'l': 6.5}[kind]
    c = C(16, H, seed=300 + seed)
    _cone(c, 7.6, 2 if kind != 's' else 5, H - 3, 0.7, hw1, seed=seed, lean=lean)
    # 밑동 잔돌
    c.ellipsoid(3.5, H - 2.5, 2.2, 1.6, 'crock', bias=-.05)
    c.ellipsoid(12.2, H - 2.2, 1.8, 1.4, 'crock', bias=-.1)
    return finish(c, (8, H - 2, 7.5, 2.2))

def stalagmite_cluster(seed=0):
    """석순 무리(2x2): 큰 것 하나와 작은 것 둘, 밑동이 한 덩이로 붙는다."""
    c = C(32, 32, seed=320 + seed)
    c.ellipsoid(16, 28, 13, 3.4, 'crock', bias=-.08)               # 흐름돌 받침
    _cone(c, 12, 2, 28, .7, 6.2, seed=seed)
    _cone(c, 22.5, 11, 28, .6, 4.6, seed=seed + 2, lean=.4)
    _cone(c, 5, 17, 28, .5, 3.4, seed=seed + 4, lean=-.3)
    _cone(c, 27.5, 21, 28, .4, 2.6, seed=seed + 5)
    return finish(c, (16, 29.5, 15, 2.6))

def column_drip(seed=0):
    """석주(1x3): 천장에서 내려온 종유석과 아래 석순이 이어 붙은 기둥. 허리가 잘록하고 흐름돌 고리가 감긴다."""
    H = 48; c = C(16, H, seed=340 + seed); c.new()
    for y in range(0, H - 2):
        f = y / (H - 3)
        hw = 3.0 + 3.6 * (abs(f - .42) / .58) ** 1.4 + .5 * math.sin(f * 14 + seed)
        for x in range(int(8 - hw) - 1, int(8 + hw) + 2):
            u = (x + .5 - 8) / hw
            if abs(u) > 1: continue
            k = cyl_k(u)
            if abs(math.sin(f * 14 + seed)) < .2: k -= .9
            if y < 4: k -= 2.2 - y * .4                                 # 천장에 닿는 끝 = 어둠
            c.setv(x, y, 'crock', vk(k))
    c.ellipsoid(3, H - 3, 2, 1.5, 'crock', bias=-.08); c.ellipsoid(13, H - 2.5, 1.7, 1.3, 'crock', bias=-.1)
    return finish(c, (8, H - 2, 7.5, 2))

def column_great(seed=0):
    """큰 석주(2x4): 굵은 흐름돌 기둥, 아래로 퍼진 치마 주름, 위는 천장으로 퍼진다."""
    W, H = 32, 64; c = C(W, H, seed=360 + seed); c.new()
    for y in range(0, H - 3):
        f = y / (H - 4)
        hw = 7.5 + 7.0 * (abs(f - .45) / .55) ** 1.6 + .7 * math.sin(f * 11 + seed)
        hw = min(hw, 15.5)
        for x in range(int(16 - hw) - 1, int(16 + hw) + 2):
            u = (x + .5 - 16) / hw
            if abs(u) > 1: continue
            fold = .12 * math.sin((x + .5 - 16) * 1.1) * max(0, f - .6) * 2.5          # 치마 주름
            k = cyl_k(u) + fold * 6
            if abs(math.sin(f * 11 + seed)) < .18: k -= .9
            if y < 5: k -= 2.4 - y * .4
            c.setv(x, y, 'crock', vk(k))
    for (x, y, rx, ry) in ((3, H - 3, 2.4, 1.7), (28.5, H - 2.5, 2.2, 1.6), (9, H - 1.8, 1.5, 1.1)):
        c.ellipsoid(x, y, rx, ry, 'crock', bias=-.06)
    return finish(c, (16, H - 2.5, 15.5, 2.6))

def stalactites_face(w=2, seed=0):
    """벽 앞면 꼭대기에 매달린 종유석(앞면 장식, w x 1칸): 위가 굵고 끝이 뾰족하다."""
    W = w * 16; c = C(W, 16, seed=380 + seed)
    x = 1.5
    i = 0
    while x < W - 1.5:
        ln = 5 + int(_hash(i, 3, seed) * 9); hw = 1.2 + _hash(i, 4, seed) * 1.6
        c.new()
        for y in range(0, ln):
            f = y / max(1, ln - 1); h = max(.5, hw * (1 - f) ** .8)
            for xx in range(int(x - h) - 1, int(x + h) + 2):
                u = (xx + .5 - x) / h
                if abs(u) > 1: continue
                c.setv(xx, y, 'crock', c.shade(u, .2, math.sqrt(1 - u * u)) - .05)
        c.tone(int(x), ln, 'cwet', 5)                                           # 물방울
        x += 2.6 + _hash(i, 5, seed) * 3.2; i += 1
    return c.img(True)

# ------------------------------------------------------------------ 바위
def boulder(kind='s', seed=0, moss=False):
    """바위. s=1x1, m=2x2(큰 바위 + 곁 돌), w=2x1 낮고 넓은 것."""
    if kind == 's':
        c = C(16, 16, seed=400 + seed)
        c.ellipsoid(8, 9.5, 6.6, 5.4, 'crock', bump=.5, clip=lambda x, y: y < 14)
        c.ellipsoid(13.2, 12.6, 2.2, 1.6, 'crock', bias=-.05)
        if moss: _moss_cap(c, 8, 6, 5, 2.4, seed)
        return finish(c, (8.5, 13.6, 7.5, 2))
    if kind == 'w':
        c = C(32, 16, seed=420 + seed)
        c.ellipsoid(13, 9.6, 10.5, 5.2, 'crock', bump=.55, clip=lambda x, y: y < 14)
        c.ellipsoid(25, 10.8, 5.6, 4, 'crock', bump=.5, clip=lambda x, y: y < 14)
        c.ellipsoid(4, 13, 2, 1.4, 'crock', bias=-.06)
        if moss: _moss_cap(c, 11, 6, 7, 2.2, seed)
        return finish(c, (16, 13.6, 15, 2))
    c = C(32, 32, seed=440 + seed)
    c.ellipsoid(14, 17, 12, 11, 'crock', bump=.55, clip=lambda x, y: y < 29)
    c.ellipsoid(25.5, 24, 6, 5.2, 'crock', bump=.5, clip=lambda x, y: y < 29)
    c.ellipsoid(5, 27, 2.6, 1.8, 'crock', bias=-.06)
    # 금 하나
    for i in range(7): c.darken(12 + i // 2, 9 + i, 2)
    if moss: _moss_cap(c, 12, 9, 8, 3.2, seed)
    return finish(c, (16, 28.5, 15, 2.6))

def _moss_cap(c, cx, cy, rx, ry, seed):
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if not c.inb(x, y) or c.m[y][x] != 'crock': continue
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry
            if dx * dx + dy * dy <= 1 and vnoise(x, y, 2.5, seed + 9) > .38:
                c.setv(x, y, 'cmoss', .85 - .25 * dy - .1 * dx)

def rubble(seed=0):
    """돌무더기(2x1): 천장에서 떨어진 모난 돌 여럿이 낮게 쌓였다."""
    c = C(32, 16, seed=460 + seed)
    pts = [(6, 10, 4.5, 3.4), (14, 8.5, 5.5, 4.2), (22, 10, 4.2, 3.3), (27.5, 12, 2.8, 2.2), (10, 12.6, 3, 2), (18.5, 12.8, 3, 2), (3, 13, 2, 1.5)]
    for i, (x, y, rx, ry) in enumerate(pts): c.ellipsoid(x, y, rx, ry, 'crock', bump=.7, bias=(_hash(i, 1, seed) - .5) * .2)
    return finish(c, (16, 13.8, 15, 2))

def pebbles(seed=0):
    """잔돌 몇 개(바닥 장식, 걷기)."""
    cv = Cv(16, 16)
    for i, (x, y, w, h) in enumerate(((2, 3, 3, 2), (9, 2, 2, 1), (6, 8, 4, 3), (12, 10, 3, 2), (2, 12, 2, 1))):
        if _hash(i, seed, 7) < .85: pebble(cv, x, y, w, h, seed=i + seed)
    return cv.im

# ------------------------------------------------------------------ 물·다리
def stepping_stone(seed=0):
    """징검돌(물 위, 걷기): 물에 젖은 납작한 바위 — 윗면은 젖어 어둡고 왼쪽 위만 밝다, 얕은 앞면, 둘레 물 고리. seed 로 크기·자리가 바뀐다."""
    c = C(16, 16, seed=480 + seed); c.new()
    cx = 7.8 + (_hash(seed, 1, 4) - .5) * 3.0; cy = 7.0 + (_hash(seed, 2, 4) - .5) * 3.0
    rx = 4.6 + _hash(seed, 3, 4) * 1.8; ry = rx * (.55 + _hash(seed, 5, 4) * .15)
    for y in range(16):
        for x in range(16):
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry
            if dx * dx + dy * dy <= 1:
                k = 4.0 - 1.3 * dx - 1.1 * dy + (.8 if (dx + dy) < -.9 else 0)
                c.setv(x, y, 'cwet', (k - .7) / 4.9)
            elif y > cy and abs(x + .5 - cx) < rx * math.sqrt(max(0, 1 - ((y + .5 - cy - 2.5) / ry) ** 2)):
                c.setv(x, y, 'cwet', (2.0 - .6 * dx - .7) / 4.9)
    im = c.img(True); p = im.load()
    for x in range(16):
        y = int(cy + ry + 3.2 + math.sin(x * .7 + seed) * .6)
        if 0 <= y < 16 and p[x, y][3] == 0 and abs(x + .5 - cx) < rx + .5 and _hash(x, seed, 9) < .8: p[x, y] = WT[4] + (190,)
    return im

def bridge_plank(rows=4, seed=0):
    """나무 널다리(2 x rows, 남북으로 놓는다, 걷기): 가로 널 + 양옆 밧줄 난간, 양 끝 말뚝."""
    W, H = 32, rows * 16; c = C(W, H, seed=500 + seed)
    for row in range((H - 6) // 4):
        y0 = 2 + row * 4 + (1 if row % 3 == 1 else 0)
        c.new()
        sx = int(_hash(row, 1, seed) * 2)
        for y in range(y0, y0 + 4):
            for x in range(4 + sx, W - 4 + sx - 1):
                v = .95 if y == y0 else (.62 if y < y0 + 3 else .34)
                if x in (4 + sx, W - 6 + sx): v -= .1
                c.setv(x, y, 'wood', v - (_hash(row, 2, seed) - .5) * .12)
        if row == 6: c.darken(18, y0 + 1, 2)                         # 갈라진 널
    for x0 in (1, W - 4):                                            # 말뚝 + 밧줄
        for yp in (0, H - 12):
            c.new()
            for y in range(yp, yp + 11):
                for x in range(x0, x0 + 3): c.setv(x, y, 'wood', .9 if x == x0 else (.6 if x == x0 + 1 else .35) - (0 if y > yp else -.2))
        c.new()
        for y in range(6, H - 8):
            c.tone(x0 + 1, y, 'rope', 4 if y % 4 else 3)
    return finish(c)

# ------------------------------------------------------------------ 보물 방
def chest(open_=False, seed=0):
    """보물 상자(1x1): 3/4 상자 — 뚜껑 윗면, 앞면 쇠띠와 금 자물쇠. open_=True 는 뚜껑이 뒤로 젖혀지고 금화가 보인다."""
    c = C(16, 16, seed=520 + seed)
    if not open_:
        c.box(2, 3, 12, 4, 7, 'wood', top=.95, front=.55)
        for x in range(2, 14): c.tone(x, 3, 'wood', 6) if x < 6 else None
        c.new()
        for y in range(3, 14):
            for x in (4, 11): c.tone(x, y, 'iron', 4 if y < 7 else 3)
        c.new()
        for y in range(9, 12):
            for x in range(7, 9): c.tone(x, y, 'gold', 6 if (x == 7 and y == 9) else 4)
        c.tone(7, 12, 'gold', 2); c.tone(8, 12, 'gold', 2)
    else:
        c.box(2, 0, 12, 3, 4, 'wood', top=.7, front=.4)                 # 젖힌 뚜껑(안쪽)
        c.box(2, 7, 12, 3, 6, 'wood', top=.5, front=.55)
        c.new()
        for y in range(7, 10):
            for x in range(3, 13):
                if _hash(x, y, 3) < .8: c.tone(x, y, 'gold', 6 if _hash(x, y, 4) < .3 else (5 if (x + y) % 3 else 4))
        c.new()
        for y in range(7, 14):
            for x in (4, 11): c.tone(x, y, 'iron', 4 if y < 10 else 3)
        c.tone(10, 6, 'red', 5); c.tone(9, 6, 'cryst', 5)
    return finish(c, (8, 14, 7.5, 1.6))

def gold_pile(seed=0):
    """금화 더미(1x1, 바닥 장식): 낮은 둔덕에 반짝이는 동전과 잔 보석 하나."""
    c = C(16, 16, seed=540 + seed)
    c.ellipsoid(8, 11, 6.8, 3.6, 'gold', clip=lambda x, y: y < 14)
    c.ellipsoid(5, 9.5, 3, 2, 'gold', bias=.08)
    c.spark = [(4, 8), (10, 9), (7, 11)]
    c.new(); c.tone(11, 10, 'red', 5); c.tone(12, 10, 'red', 3)
    for (x, y) in ((2, 13), (13, 13), (14, 12)): c.tone(x, y, 'gold', 5)
    return c.img(True)

def torch_stand(seed=0):
    """세운 횃불(1x2): 쇠 받침대 위 나무 횃대와 불꽃. 아랫줄만 막힘."""
    c = C(16, 32, seed=560 + seed)
    c.new()
    for y in range(10, 29):
        c.tone(7, y, 'iron', 4); c.tone(8, y, 'iron', 2)
    c.new()
    for (x, y, t) in ((4, 29, 3), (5, 28, 4), (6, 28, 4), (9, 28, 2), (10, 28, 2), (11, 29, 2), (7, 29, 3), (8, 29, 2)): c.tone(x, y, 'iron', t)
    c.new()                                                        # 접시
    for x in range(4, 12): c.tone(x, 10, 'iron', 5 if x < 8 else 3); c.tone(x, 11, 'iron', 2)
    _flame(c, 8, 9, 5)
    return finish(c, (8, 29.5, 5, 1.6))

def _flame(c, cx, base, h):
    c.new()
    for y in range(base - h, base + 1):
        f = (y - (base - h)) / max(1, h)
        hw = 0.6 + 2.6 * f
        for x in range(int(cx - hw), int(cx + hw) + 1):
            u = abs(x + .5 - cx) / max(.5, hw)
            t = 6 if u < .3 and f > .3 else (5 if u < .6 else (4 if f > .5 else 3))
            c.tone(x, y, 'fire', t)

def wall_torch(seed=0):
    """벽 횃불(앞면 장식 1x1): 쇠 고리에 꽂힌 횃불."""
    c = C(16, 16, seed=580 + seed)
    c.new()
    for (x, y, t) in ((6, 12, 4), (7, 12, 4), (8, 12, 3), (9, 12, 2), (7, 13, 2), (8, 13, 2)): c.tone(x, y, 'iron', t)
    c.new()
    for y in range(7, 13): c.tone(7, y, 'wood', 5); c.tone(8, y, 'wood', 3)
    _flame(c, 8, 6, 5)
    return c.img(True)

def light_glow(r=24, color=(255, 176, 90), a=60):
    """빛무리(덧그림, 걷기): 두 단으로 끊긴 따뜻한 원."""
    S = r * 2; im = new(S, S); p = im.load()
    for y in range(S):
        for x in range(S):
            d = math.hypot(x + .5 - r, (y + .5 - r) * 1.25) / r
            if d < 1:
                aa = int(a * (1 - d) ** 1.4); aa = (aa // 12) * 12
                if aa > 0: p[x, y] = tuple(color) + (aa,)
    return im

# ------------------------------------------------------------------ 갈림길·위험 표지
def skull_stake(seed=0):
    """해골 말뚝(1x2): 나무 말뚝 꼭대기의 짐승 해골과 해진 천 조각 — 「이 앞 위험」 표지. 아랫줄만 막힘."""
    c = C(16, 32, seed=600 + seed)
    c.new()
    for y in range(8, 30): c.tone(7, y, 'wood', 4); c.tone(8, y, 'wood', 2)
    c.new()                                                         # 해진 천
    for y in range(12, 20):
        for x in range(9, 13 - (y - 12) // 3):
            c.tone(x, y, 'cloth', 4 if x == 9 else 3)
    c.tone(11, 20, 'cloth', 3)
    c.new()                                                         # 해골 (짐승: 길쭉한 주둥이, 눈구멍 둘)
    c.ellipsoid(7.8, 5.2, 4.4, 3.6, 'bone')
    for x in range(5, 11):
        for y in range(7, 10): c.setv(x, y, 'bone', .62 - .05 * (x - 5))
    for (x, y) in ((6, 5), (9, 5)): c.tone(x, y, 'dark', 1); c.tone(x, y + 1, 'dark', 2)
    c.tone(7, 9, 'dark', 2); c.tone(8, 9, 'dark', 2)
    for (x, y) in ((3, 2), (2, 1), (12, 2), (13, 1)): c.tone(x, y, 'bone', 5)   # 뿔
    c.new()
    for (x, y) in ((5, 29), (10, 29), (6, 30), (9, 30)): c.tone(x, y, 'crock', 3)
    return finish(c, (8, 30, 5.5, 1.6))

def signpost(seed=0):
    """갈림길 나무 표지(1x2): 두 갈래 화살 판(글자 없음, 새긴 화살 무늬만). 아랫줄만 막힘."""
    c = C(16, 32, seed=620 + seed)
    c.new()
    for y in range(4, 30): c.tone(7, y, 'wood', 4); c.tone(8, y, 'wood', 2)
    def board(y0, left):
        c.new()
        xs = range(1, 13) if left else range(3, 15)
        for x in xs:
            for y in range(y0, y0 + 5):
                tip = (x <= 2) if left else (x >= 13)
                if tip and y in (y0, y0 + 4): continue
                c.setv(x, y, 'wood', .92 if y == y0 else (.62 if y < y0 + 4 else .35))
        c.new()                                                     # 새긴 화살
        if left:
            for x in range(4, 10): c.tone(x, y0 + 2, 'wood', 1)
            c.tone(5, y0 + 1, 'wood', 1); c.tone(5, y0 + 3, 'wood', 1)
        else:
            for x in range(6, 12): c.tone(x, y0 + 2, 'wood', 1)
            c.tone(10, y0 + 1, 'wood', 1); c.tone(10, y0 + 3, 'wood', 1)
    board(6, True); board(13, False)
    return finish(c, (8, 30, 5, 1.6))

def bones(seed=0):
    """흩어진 뼈(바닥 장식 1x1)."""
    c = C(16, 16, seed=640 + seed)
    def bone(x0, y0, x1, y1):
        c.new(); c.line(x0, y0, x1, y1, 'bone', 5)
        c.line(x0, y0 + 1, x1, y1 + 1, 'bone', 3)
        for (x, y) in ((x0, y0), (x1, y1)):
            c.tone(x - 1, y, 'bone', 5); c.tone(x - 1, y + 1, 'bone', 4)
    bone(3, 5, 9, 7); bone(8, 11, 13, 9)
    c.new(); c.ellipsoid(4.5, 12, 2.2, 1.8, 'bone')
    return c.img(True)

def skeleton_remains(seed=0):
    """쓰러진 모험가 유해(2x1 바닥 장식): 해골·갈비뼈와 녹슨 칼, 금 간 둥근 방패."""
    c = C(32, 16, seed=660 + seed)
    c.new(); c.ellipsoid(6, 8, 3.2, 2.8, 'bone')
    c.tone(5, 8, 'dark', 1); c.tone(7, 8, 'dark', 1)
    c.new()
    for i in range(4):
        c.line(10 + i * 2, 6, 10 + i * 2, 11, 'bone', 4)
    c.line(9, 8, 18, 8, 'bone', 5)
    c.new(); c.line(20, 7, 26, 9, 'bone', 4); c.line(20, 11, 27, 12, 'bone', 4)
    c.new()                                                        # 녹슨 칼
    for x in range(14, 29): c.tone(x, 14 - (x - 14) // 5, 'iron', 4 if x < 26 else 3)
    c.tone(13, 14, 'wood', 3); c.tone(12, 14, 'wood', 3); c.tone(14, 12, 'iron', 3); c.tone(14, 15, 'iron', 3)
    c.new(); c.ellipsoid(26.5, 4.5, 4.2, 3.4, 'wood', bias=-.05)    # 둥근 나무 방패
    c.tone(26, 4, 'iron', 5); c.tone(27, 4, 'iron', 4); c.tone(26, 5, 'iron', 3)
    c.line(24, 2, 28, 7, 'wood', 1)
    return c.img(True)

# ------------------------------------------------------------------ 지하층 계단
def stairs_down(w=2, seed=0):
    """부서진 돌계단 내려가는 구멍(w x 3, 걷기): 바닥에 뚫린 직사각 구덩이 안으로 북쪽을 향해 내려가는 디딤단.
    가장자리는 금 가고 이가 빠졌다. 둘레는 바닥 높이, 안은 점점 어둡다."""
    W, H = w * 16, 48
    cv = Cv(W, H)
    for y in range(H):
        for x in range(W):
            if x < 3 or x >= W - 3:                                   # 양옆 낮은 돌 둔덕(윗면)
                e = x if x < 3 else W - 1 - x
                k = 5 if e == 1 else (4 if e == 2 else 1)
                if y >= H - 3: k = 2 if y < H - 1 else 1
                if _hash(x, y // 3, seed) < .15: k -= 1
                cv.px(x, y, RK[max(1, k)])
                continue
            s = y // 6; ly = y % 6
            depth = s / 7.0                                           # 위(북)로 갈수록 깊다 = 어둡다
            if ly == 0: k = 5.4 - depth * 3.4                         # 디딤판 앞 모서리
            elif ly < 3: k = 4.6 - depth * 3.2                        # 디딤판
            else: k = 2.6 - depth * 2.0                               # 챌판(어두움)
            if x == 3 or x == W - 4: k -= 1
            if _hash(x, y, seed + 3) < .07: k -= 1
            cv.px(x, y, RK[max(1, min(6, int(round(k))))] if k > .6 else VOIDC[0])
    # 이 빠진 디딤판 (부서진 계단)
    for (bx, by, bw) in ((W - 9, 25, 5), (5, 13, 4), (W // 2, 37, 3)):
        for x in range(bx, bx + bw):
            for y in range(by, by + 3): cv.px(x, y, RK[1])
            cv.px(x, by + 3, RK[2])
    # 맨 위(북쪽 끝) 두 줄 = 어둠으로 사라진다
    for y in range(0, 4):
        for x in range(3, W - 3): cv.px(x, y, VOIDC[0])
    # 남쪽 입구 턱(바닥 높이 문지방)
    for x in range(1, W - 1): cv.px(x, H - 2, RK[5]); cv.px(x, H - 1, RK[2])
    # 떨어진 돌 조각
    pebble(cv, 1, H - 8, 2, 1); pebble(cv, W - 4, H - 14, 2, 1)
    return cv.im

# ------------------------------------------------------------------ 생물·식생
def bats_hanging(seed=0):
    """천장 밑 벽 앞면에 거꾸로 매달린 박쥐 셋(앞면 장식 2x1): 접은 날개가 아래로 뾰족한 검은 물방울 꼴, 발끝만 바위에 걸린다."""
    cv = Cv(32, 16)
    D = [(14, 10, 18), (28, 22, 32), (46, 38, 50), (70, 60, 72)]
    for i, (x, y0, h) in enumerate(((5, 1, 8), (15, 3, 9), (26, 1, 7))):
        cv.px(x, y0, D[3]); cv.px(x + 2, y0, D[3])                       # 발
        for j in range(h):
            f = j / (h - 1); hw = (1.0 + 1.8 * math.sin(f * math.pi * .9)) if f < .85 else .6
            for xx in range(int(x + 1 - hw), int(x + 1 + hw) + 1):
                k = 2 if xx <= x else 1
                if j == 0 or xx == int(x + 1 - hw): k = 3
                cv.px(xx, y0 + 1 + j, D[k])
        cv.px(x - 1 + (i % 2), y0 + 3, D[3])                              # 날개 뼈 빛
        cv.px(x, y0 + h - 1, (150, 40, 40)) if i == 1 else None            # 뜬 눈 하나
    return pz.fin(cv.im, .7)

def bat_flying(seed=0):
    """날아다니는 박쥐(덧그림 1x1, 위층)."""
    c = C(16, 16, seed=700 + seed); c.new()
    pts = [(2, 6), (3, 5), (4, 5), (5, 6), (6, 7), (7, 7), (8, 7), (9, 7), (10, 6), (11, 5), (12, 5), (13, 6), (3, 7), (12, 7), (5, 7), (10, 7)]
    for (x, y) in pts: c.tone(x, y, 'dark', 4 if y < 7 else 3)
    for x in range(6, 10): c.tone(x, 8, 'dark', 2)
    c.tone(6, 6, 'dark', 5); c.tone(9, 6, 'dark', 5)
    c.tone(7, 7, 'red', 4); c.tone(8, 7, 'red', 4)
    im = c.img(True); sh = new(16, 16); p = sh.load()
    for x in range(5, 11): p[x, 14] = (14, 10, 18, 70)
    sh.alpha_composite(im); return sh

def mushrooms(seed=0):
    """동굴 버섯 무리(바닥 장식 1x1): 갓 윗면이 보이는 갈색 버섯 셋."""
    c = C(16, 16, seed=720 + seed)
    for (x, y, r, h) in ((5, 8, 3.2, 5), (11, 10, 2.4, 4), (8, 12, 1.8, 2.6)):
        c.new()
        for yy in range(int(y), int(y + h)): c.tone(int(x), yy, 'stem', 5); c.tone(int(x) + 1, yy, 'stem', 3)
        c.ellipsoid(x + .5, y, r, r * .62, 'bark', bias=.12)
    return c.img(True)

def moss_patch(seed=0):
    """이끼 덩이(바닥 장식 1x1): 젖은 자리에 낮게 깔린 회록 이끼."""
    cv = Cv(16, 16)
    for y in range(16):
        for x in range(16):
            d = math.hypot((x + .5 - 8) / 7, (y + .5 - 8.5) / 5.5)
            n = vnoise(x, y, 2.6, seed + 51)
            if d < .75 + .35 * (n - .5) * 2:
                k = 2 + (1 if n > .55 else 0) + (1 if _hash(x, y, seed) > .8 else 0) - (1 if y > 11 else 0)
                cv.px(x, y, MOSSR[max(0, min(5, k))])
    return cv.im

def cobweb(seed=0):
    """거미줄(앞면·구석 장식 1x1): 위 왼쪽 구석에서 퍼지는 실."""
    im = new(); p = im.load()
    col = (196, 192, 186, 150)
    for a in range(0, 91, 18):
        for r in range(0, 15):
            x = int(r * math.cos(math.radians(a))); y = int(r * math.sin(math.radians(a)))
            if 0 <= x < 16 and 0 <= y < 16: p[x, y] = col
    for rr in (4, 8, 12):
        for a in range(0, 91, 4):
            x = int(rr * math.cos(math.radians(a))); y = int(rr * math.sin(math.radians(a)) * .95)
            if 0 <= x < 16 and 0 <= y < 16 and _hash(x, y, rr) < .8: p[x, y] = (176, 172, 168, 120)
    return im

def roots_hanging(seed=0):
    """천장 틈에서 내려온 나무뿌리·덩굴(앞면 장식 2x1, 입구 근처)."""
    c = C(32, 16, seed=740 + seed)
    for i, (x, ln) in enumerate(((3, 12), (8, 8), (14, 14), (21, 9), (27, 13))):
        c.new()
        xx = x
        for y in range(0, ln):
            xx += (1 if _hash(i, y, seed) > .8 else 0) - (1 if _hash(i, y, seed + 1) > .85 else 0)
            c.tone(xx, y, 'bark', 4 if y % 3 else 3); c.tone(xx + 1, y, 'bark', 2)
            if y % 4 == 2 and i % 2 == 0: c.tone(xx - 1, y, 'leaf', 4); c.tone(xx - 2, y + 1, 'leaf', 3)
    return c.img(True)

def fern_tuft(seed=0):
    """입구 쪽 바깥빛에 자란 고사리·풀(바닥 장식 1x1)."""
    c = C(16, 16, seed=760 + seed)
    for i, (x0, ang, ln) in enumerate(((8, -1.9, 7), (8, -1.3, 8), (8, -2.5, 6), (7, -.8, 6), (9, -2.9, 5))):
        c.new()
        for j in range(ln):
            x = x0 + math.cos(ang) * j; y = 14 + math.sin(ang) * j + (j * j) * .04
            c.tone(int(x), int(y), 'leaf', 5 if j < ln - 2 else 4)
            if j % 2 == 1: c.tone(int(x) + 1, int(y) + 1, 'leaf', 3)
    return c.img(True)

def campfire_old(seed=0):
    """식은 모닥불 자리(바닥 장식 1x1): 돌 고리 안 숯과 타다 만 장작."""
    c = C(16, 16, seed=780 + seed)
    for i in range(8):
        a = i / 8 * 2 * math.pi
        c.ellipsoid(8 + math.cos(a) * 5.4, 9 + math.sin(a) * 3.6, 1.7, 1.3, 'crock')
    c.new()
    for y in range(7, 12):
        for x in range(5, 12):
            if ((x + .5 - 8) / 3.6) ** 2 + ((y + .5 - 9) / 2.4) ** 2 <= 1: c.tone(x, y, 'dark', 3 if _hash(x, y, 1) < .7 else 5)
    c.new(); c.line(5, 8, 10, 10, 'bark', 3); c.line(6, 10, 11, 8, 'bark', 2)
    c.tone(8, 9, 'fire', 2)
    return c.img(True)

def rope_crate(seed=0):
    """버려진 탐험 짐(1x1): 낡은 나무 상자 위 사린 밧줄과 곡괭이 자루."""
    c = C(16, 16, seed=800 + seed)
    c.box(2, 5, 11, 3, 7, 'wood', top=.95, front=.5)
    c.new()
    for y in range(5, 15): c.tone(2, y, 'wood', 2)
    c.new()
    for a in range(0, 360, 20):
        x = 7 + math.cos(math.radians(a)) * 3.4; y = 5.5 + math.sin(math.radians(a)) * 1.6
        c.tone(int(x), int(y), 'rope', 5 if a < 180 else 3)
    c.tone(7, 5, 'rope', 2)
    c.new(); c.line(12, 1, 14, 13, 'wood', 4)
    c.tone(11, 1, 'iron', 5); c.tone(12, 0, 'iron', 4); c.tone(13, 1, 'iron', 3)
    return finish(c, (8, 14, 7, 1.5))

def drip_puddle(seed=0):
    """물방울 웅덩이(바닥 장식 1x1): 종유석에서 떨어진 물이 고인 얕은 물과 동심원."""
    im = new(); p = im.load()
    for y in range(16):
        for x in range(16):
            d = math.hypot((x + .5 - 8) / 6.4, (y + .5 - 9) / 3.8)
            if d < 1:
                k = 2 if d < .55 else 3
                if abs(d - .45) < .08: k = 4
                if d > .86: k = 1 if y < 9 else 4
                p[x, y] = WT[k] + (255,)
    return im

def light_shaft(seed=0):
    """바깥빛 줄기(덧그림 3x3, 걷기): 입구 아치에서 바닥으로 비스듬히 떨어지는 밝은 빛과 먼지 점."""
    W, H = 48, 48; im = new(W, H); p = im.load()
    for y in range(H):
        f = y / H
        x0 = 12 + f * 4; x1 = 36 + f * 9
        for x in range(W):
            if x0 <= x < x1:
                e = min(x - x0, x1 - x) / ((x1 - x0) / 2)
                a = int((40 + 30 * (1 - f)) * min(1, e * 2.2)); a = (a // 14) * 14
                if a > 0: p[x, y] = (255, 244, 200, a)
    for i in range(14):
        x = int(14 + _hash(i, 1, seed) * 26); y = int(_hash(i, 2, seed) * 44)
        if p[x, y][3] > 0: p[x, y] = (255, 252, 230, 150)
    return im

# ------------------------------------------------------------------ 동굴 입구 아치
def cave_mouth(seed=0):
    """동굴 입구(4x4): 벽 앞면 3줄에 뚫린 바위 아치. 안으로 바깥의 밝은 하늘·풀밭·흙길이 보이고, 아랫줄은 빛이 번진 바닥.
    아치 틀은 굵은 바위 덩이(쐐기돌처럼 둘러싼다)와 이끼, 틈의 풀."""
    W, H = 64, 64; c = C(W, H, seed=820 + seed)
    cx = 32; ow = 15                                    # 열린 구멍 반폭
    def in_open(x, y):
        if y > 47: return False
        top = 10
        if y < top + 12:
            r = 12; yy = y - (top + 12)
            return abs(x + .5 - cx) < math.sqrt(max(0, ow * ow - (yy * ow / r) ** 2)) if yy > -r else False
        return abs(x + .5 - cx) < ow
    # 바깥 풍경 (하늘 → 먼 풀숲 → 풀밭 → 흙길)
    c.new()
    for y in range(0, 48):
        for x in range(W):
            if not in_open(x, y): continue
            if y < 22: c.tone(x, y, 'cream', 6 if y < 16 else 5)                     # 밝은 하늘빛
            elif y < 30:
                n = vnoise(x, y, 3, 5); c.tone(x, y, 'leaf', 4 if n > .45 else 3)     # 먼 수풀
                if y == 22 or (y < 25 and n > .7): c.tone(x, y, 'leaf', 5)
            elif y < 40:
                c.tone(x, y, 'leaf', 5 if _hash(x, y, 6) < .7 else 6)               # 볕 든 풀밭
                if abs(x + .5 - cx) < 3 + (y - 30) * .6: c.tone(x, y, 'dirt', 6 if _hash(x, y, 7) < .6 else 5)
            else:
                c.tone(x, y, 'dirt', 6 if abs(x + .5 - cx) < 9 else 5)
                if abs(x + .5 - cx) >= 9 and _hash(x, y, 8) < .5: c.tone(x, y, 'leaf', 5)
    # 바위 틀: 아치 둘레 굵은 바위 덩이들 (ellipsoid 덩이를 고리로)
    stones = []
    for i in range(11):
        a = math.pi * (1.05 - i / 10 * 1.1)
        stones.append((cx + math.cos(a) * (ow + 4), 22 - math.sin(a) * 15 if i not in (0, 10) else 26, 5.6, 4.6))
    stones += [(cx - ow - 4, 34, 5.2, 5.6), (cx + ow + 4, 34, 5.2, 5.6), (cx - ow - 5, 43, 5.6, 4.6), (cx + ow + 5, 43, 5.6, 4.6)]
    for i, (x, y, rx, ry) in enumerate(stones):
        c.ellipsoid(x, y, rx, ry, 'crock', bump=.55, bias=(_hash(i, 1, seed) - .5) * .2 - .05)
    # 이끼·풀 (위 바위 윗면)
    for i, (x, y, rx, ry) in enumerate(stones[2:9]):
        for yy in range(int(y - ry), int(y - ry * .3)):
            for xx in range(int(x - rx * .8), int(x + rx * .6)):
                if c.inb(xx, yy) and c.m[yy][xx] == 'crock' and vnoise(xx, yy, 2.3, 11) > .5: c.setv(xx, yy, 'cmoss', .85)
    # 아랫줄: 빛이 번진 바닥 + 흙이 들이친 자리 (투명한 덧그림이 아니라 그림 안의 땅)
    im = c.img(True); p = im.load()
    for y in range(48, 64):
        for x in range(W):
            d = abs(x + .5 - cx) / (ow + 2 + (y - 48) * .8)
            if d < 1:
                base = DIRT[5] if d < .55 else DIRT[4]
                if _hash(x, y, 9) < .12: base = DIRT[3]
                if _hash(x, y, 10) > .94: base = LEAF7[4]
                a = 255 if d < .8 - (y - 48) * .03 else (160 if d < .9 else 90)
                if (y - 48) > 10 and _hash(x, y, 11) < (y - 58) / 6: continue
                p[x, y] = tuple(base) + (a,)
    for y in range(44, 49):                             # 문지방: 바깥 땅과 동굴 바닥 사이 낮은 돌턱
        for x in range(cx - ow, cx + ow):
            if y == 47: p[x, y] = tuple(RK[5]) + (255,)
            elif y == 48: p[x, y] = tuple(RK[3]) + (255,)
    return im
