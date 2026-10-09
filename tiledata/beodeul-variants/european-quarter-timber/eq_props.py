# 목골 구시가 소품 — 버들항 파이프라인 소품 함수(pz·pi·pf·pl·pe·ph)를 그대로 부르고 장소 등급(grade)만 씌운다.
# 이 장소에만 있는 것(벽 걸이 그림 간판·세운 그림 간판·배수관·낮은 벽돌 담·돌 말뚝·가로수 원형 벽돌 받침·손수레·꽃 통)은 같은 결로 손 도트.
from eq_base import *
import pi, pf, pl, pe, ph
import eq_wall as WL
from eq_house import sign_icon

def _im(r):
    if isinstance(r, Image.Image): return r
    if hasattr(r, 'img_') and getattr(r, 'img_', None) is not None: return r.img_
    return fin(r)
def G(fn): return lambda: grade(_im(fn()))

# ---------------------------------------------------------------- 나무 — 버들항 칩셋 나무(활엽수·덤불)를 그대로, 짙은 잎은 한 단 어둡게
def chip_tree(x, y, w, h, k=0.9, flipx=False):
    im = terrain.CH.crop((x, y, x + w * 16, y + h * 16)).convert('RGBA')
    if flipx: im = flip(im)
    a = np.array(im).astype(np.float64); a[..., :3] *= k
    return Image.fromarray(np.clip(np.rint(a), 0, 255).astype(np.uint8), 'RGBA')

def street_tree():
    """가로수: 버들항 활엽수(3x4칸)를 한 단 어둡게 + 줄기 밑 원형 벽돌 받침(벽돌 테·흙)."""
    t = chip_tree(288, 512, 3, 4, 0.86); W, Hh = t.size
    im = Image.new('RGBA', (W, Hh)); px = im.load()
    cx, cy = W // 2, Hh - 5
    for y in range(Hh - 10, Hh):
        for x in range(W):
            d = ((x + 0.5 - cx) / 13.0) ** 2 + ((y + 0.5 - cy) / 4.2) ** 2
            if d <= 1.0:
                inner = ((x + 0.5 - cx) / 10.0) ** 2 + ((y + 0.5 - cy) / 2.8) ** 2
                if inner <= 1.0: put(px, W, Hh, x, y, DIRT[2] if H(x, y, 3) > 0.4 else DIRT[3])
                else:
                    t_ = 5 if y < cy else 3
                    if (x + (y // 2) * 2) % 5 == 0: t_ = 2
                    put(px, W, Hh, x, y, BRICK[t_])
    im.alpha_composite(t)
    return grade(im)

def tree_round():
    """작은 둥근 나무(정원·뒷마당): 버들항 덤불 나무(3x3칸) 그대로."""
    return grade(chip_tree(368, 512, 3, 3, 0.92))

def shrub():
    return grade(chip_tree(336, 512, 2, 2, 0.9))

# ---------------------------------------------------------------- 손 도트 소품
def wall_sign(kind):
    """벽 걸이 간판(1칸): 벽에서 나온 쇠 막대 + 매달린 나무 판, 판에 그림 기호만(글자 없음). 건물 벽 위에 덧찍는다."""
    def f():
        im, px = mk(16, 16); W, Hh = 16, 16
        for i in range(14): put(px, W, Hh, 1 + i, 1, IRON[4] if i % 4 else IRON[2])
        for i in range(4): put(px, W, Hh, 1 + i, 2 + i, IRON[2])
        put(px, W, Hh, 0, 0, IRON[3]); put(px, W, Hh, 0, 1, IRON[3]); put(px, W, Hh, 0, 2, IRON[2])
        for yy in range(3, 14):
            for xx in range(4, 14):
                t = 5 if (xx == 4 or yy == 3) else (2 if (xx == 13 or yy == 13) else 4)
                put(px, W, Hh, xx, yy, WD[t])
        put(px, W, Hh, 6, 2, IRON[3]); put(px, W, Hh, 11, 2, IRON[3])
        sign_icon(px, W, Hh, 5, 5, kind)
        return grade(im)
    return f

def sign_board(kind):
    """세운 그림 간판(1x2칸): 나무 기둥 둘 위 판(그림 기호만), 밑동 돌."""
    def f():
        im, px = mk(16, 32); W, Hh = 16, 32
        for y in range(10, 30):
            put(px, W, Hh, 3, y, WD[5]); put(px, W, Hh, 4, y, WD[3]); put(px, W, Hh, 11, y, WD[4]); put(px, W, Hh, 12, y, WD[2])
        for yy in range(4, 16):
            for xx in range(1, 15):
                t = 5 if (xx == 1 or yy == 4) else (2 if (xx == 14 or yy == 15) else 4)
                put(px, W, Hh, xx, yy, WD[t])
        for xx in range(0, 16): put(px, W, Hh, xx, 3, WD[6] if xx < 8 else WD[5])
        sign_icon(px, W, Hh, 4, 6, kind)
        for xx in range(2, 14): put(px, W, Hh, xx, 30, STN[4]); put(px, W, Hh, xx, 31, STN[2])
        return grade(im)
    return f

def downpipe():
    """배수관(1x4칸, 벽 덧그림): 처마 밑 깔때기 머리 + 쇠 관(왼 밝음) + 벽 고정 띠 셋 + 바닥 꺾인 발(물받이 돌)."""
    im, px = mk(16, 64); W, Hh = 16, 64
    for x in range(4, 12): put(px, W, Hh, x, 2, IRON[5]); put(px, W, Hh, x, 3, IRON[4]); put(px, W, Hh, x, 4, IRON[3])
    for x in range(5, 11): put(px, W, Hh, x, 5, IRON[2])
    for y in range(6, 58):
        put(px, W, Hh, 6, y, IRON[5]); put(px, W, Hh, 7, y, IRON[4]); put(px, W, Hh, 8, y, IRON[3]); put(px, W, Hh, 9, y, IRON[1])
    for yb in (16, 32, 48):
        for x in range(5, 11): put(px, W, Hh, x, yb, IRON[2]); put(px, W, Hh, x, yb + 1, IRON[1])
    for (x, y, t) in ((9, 58, 3), (10, 58, 3), (11, 59, 3), (12, 59, 2), (6, 58, 4), (7, 58, 4), (8, 58, 3), (10, 59, 2)):
        put(px, W, Hh, x, y, IRON[t])
    for x in range(8, 15): put(px, W, Hh, x, 61, STN[5]); put(px, W, Hh, x, 62, STN[3]); put(px, W, Hh, x, 63, STN[2])
    return grade(im)

def brick_wall(n=3):
    """낮은 벽돌 담(n칸, 1칸 높이 앞면 + 갓돌 윗면): 마당·정원 둘레."""
    def f():
        W = n * 16; im, px = mk(W, 16); Hh = 16
        WL.brick_fill(px, W, Hh, 0, 5, W, 15, 7)
        for x in range(W):
            put(px, W, Hh, x, 2, STN[6] if x % 8 else STN[5]); put(px, W, Hh, x, 3, STN[5]); put(px, W, Hh, x, 4, STN[3]); put(px, W, Hh, x, 15, STN[2])
        for y in range(2, 16): put(px, W, Hh, 0, y, STN[4]); put(px, W, Hh, W - 1, y, STN[2])
        return grade(fin(im))
    return f

def wall_pillar():
    """담 끝 돌기둥(1x2칸, 갓돌 위 공 장식) — 마당 입구 양쪽."""
    im, px = mk(16, 32); W, Hh = 16, 32
    WL.brick_fill(px, W, Hh, 3, 10, 13, 31, 9)
    for y in range(10, 31): put(px, W, Hh, 3, y, BRICK[5]); put(px, W, Hh, 12, y, BRICK[2])
    for x in range(2, 14): put(px, W, Hh, x, 8, STN[6]); put(px, W, Hh, x, 9, STN[3])
    for y in range(2, 8):
        for x in range(4, 12):
            d = (x + 0.5 - 8) ** 2 + ((y + 0.5 - 5) * 1.2) ** 2
            if d < 12: put(px, W, Hh, x, y, STN[6] if (x < 8 and y < 5) else (STN[4] if d < 7 else STN[2]))
    for x in range(3, 13): put(px, W, Hh, x, 31, STN[2])
    return grade(fin(im))

def bollard():
    """돌 말뚝(1칸): 둥근 머리 사암 기둥, 밑 그늘 — 거리 가장자리·광장 입구 차 막이."""
    im, px = mk(16, 16); W, Hh = 16, 16
    for y in range(3, 15):
        for x in range(5, 11):
            t = 5 if x < 7 else (4 if x < 9 else 2)
            if y < 5: t = min(6, t + 1)
            put(px, W, Hh, x, y, STN[t])
    for x in range(6, 10): put(px, W, Hh, x, 2, STN[6])
    for x in range(4, 12): put(px, W, Hh, x, 15, STN[1])
    return grade(fin(im))

def handcart():
    """손수레(2x1칸): 판자 짐칸(윗면 보임) + 큰 바퀴 하나 + 손잡이 둘, 짐칸에 자루."""
    im, px = mk(32, 16); W, Hh = 32, 16
    for y in range(3, 9):
        for x in range(4, 22): put(px, W, Hh, x, y, WD[5] if y == 3 else (WD[4] if (x % 4) else WD[3]))
    for x in range(4, 22): put(px, W, Hh, x, 9, WD[2]); put(px, W, Hh, x, 10, WD[1])
    for x in range(22, 31): put(px, W, Hh, x, 6 + (x - 22) // 4, WD[4]); put(px, W, Hh, x, 7 + (x - 22) // 4, WD[2])
    for y in range(8, 16):
        for x in range(8, 18):
            d = math.hypot(x + 0.5 - 13, y + 0.5 - 11.5)
            if 2.6 < d <= 4.2: put(px, W, Hh, x, y, WD[3] if y < 11 else WD[2])
            elif d <= 1.2: put(px, W, Hh, x, y, IRON[4])
    for (cx, cy, c) in ((9, 3, CREAM), (15, 3, CREAM)):
        for y in range(cy - 2, cy + 4):
            for x in range(cx - 3, cx + 3):
                if (x + 0.5 - cx) ** 2 / 9 + (y + 0.5 - cy) ** 2 / 9 <= 1: put(px, W, Hh, x, y, c[5] if x < cx else c[3])
    return grade(fin(im))

def flower_tub(col='red'):
    """나무 꽃 통(1칸): 쇠테 두른 반쪽 통 + 꽃 덩이."""
    def f():
        im, px = mk(16, 16); W, Hh = 16, 16
        for y in range(8, 15):
            for x in range(3, 13):
                t = 5 if x < 6 else (4 if x < 10 else 2)
                put(px, W, Hh, x, y, WD[t])
        for x in range(3, 13): put(px, W, Hh, x, 9, IRON[3]); put(px, W, Hh, x, 13, IRON[2]); put(px, W, Hh, x, 15, STN[1])
        for x in range(3, 13): put(px, W, Hh, x, 8, DIRT[2])
        Fl = FLWR[col]
        for k in range(22):
            x = 3 + int(H(k, 1) * 10); y = 2 + int(H(k, 2) * 6)
            put(px, W, Hh, x, y, LEAF[2 + int(H(k, 3) * 3)])
        for k in range(9):
            x = 4 + int(H(k, 4, ord(col[0])) * 8); y = 2 + int(H(k, 5) * 5)
            put(px, W, Hh, x, y, Fl[5]); put(px, W, Hh, x, y + 1, Fl[3])
        return grade(fin(im))
    return f

def well_stone():
    """광장 돌 우물: 버들항 지붕 우물(pe.well) — 기와는 갈색으로."""
    im = _im(pe.well()).copy(); recolor(im, lambda r, g, b: r > g + 30 and r > b + 30 and g < 120, TILE)
    return grade(im)

def stall(color, goods):
    def f():
        im = _im(pz.stall2(3, color, goods)).copy()
        return grade(im)
    return f
