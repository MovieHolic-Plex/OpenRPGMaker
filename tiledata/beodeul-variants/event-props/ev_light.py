# 빛나는 이벤트 소품: 저장 수정, 이동 발판, 차원문, 회복 샘, 수정 스위치.
# 버들항 px2.C(재질 + 톤, 자동 색 윤곽) 위에 빛 재질 톤을 손으로 찍는다. 빛 번짐(반투명)은 쓰지 않고, 받침에 비친 빛은 디더 점.
import math
from ev_base import *


# ---------------------------------------------------------------- 공통: 돌 받침
def stone_plinth(c, x0, y0, w, top, front, bias=0.0):
    """버들항 석상 받침과 같은 3/4 마름돌 받침: 윗면 top 줄 + 앞면 front 줄, 앞면 위 모 빛·아래 그늘."""
    c.box(x0, y0, w, top, front, 'stone', top=0.95, front=0.58, bias=bias)
    for x in range(x0, x0 + w):
        c.tone(x, y0 + top, 'stone', 5)           # 앞면 위 모(빛 받은 갓돌 줄)
        c.tone(x, y0 + top + front - 1, 'stone', 2)


def crystal(c, cx, ytop, ymid, ybot, hw, mat, add=0, crack=False):
    """세로로 긴 마름모 수정(3/4: 왼쪽 위 면이 빛을 받는다). 면 넷 + 가운데 모 빛줄."""
    c.new()
    for y in range(ytop, ybot + 1):
        if y <= ymid: w = hw * (y - ytop + .6) / max(1, ymid - ytop + .6)
        else: w = hw * (ybot - y + .6) / max(1, ybot - ymid + .6)
        w = max(.5, w)
        for x in range(int(math.floor(cx - w)), int(math.ceil(cx + w))):
            u = (x + .5 - cx)
            if y <= ymid: k = 5 if u < -0.2 else (6 if u < 0.8 else 3)
            else: k = 4 if u < -0.2 else (3 if u < 0.8 else 2)
            if y <= ymid and u < -0.2 and x == int(math.floor(cx - w)): k = 4     # 왼쪽 가장자리 한 단 낮춤
            if y == ymid and u >= -0.2: k = max(k - 1, 2)
            c.tone(x, y, mat, max(1, min(6, k + add)))
    if crack:
        for (x, y) in ((int(cx) - 1, ymid - 2), (int(cx), ymid - 1), (int(cx), ymid), (int(cx) + 1, ymid + 1), (int(cx) + 1, ymid + 2)):
            c.tone(x, y, mat, 1)


# ---------------------------------------------------------------- 1·2 저장 수정
def save_crystal(frame=0, on=True):
    """저장 수정(1x2): 마름돌 받침 위 떠 있는 푸른 수정. 켜짐 4프레임 = 밝기 맥동 + 위아래 1px 흔들림 + 도는 빛 알갱이."""
    c = C(16, 32, seed=1201)
    c.shadow(8, 29.6, 6.5, 1.6, 70)
    c.group(1); stone_plinth(c, 2, 23, 12, 3, 5)
    c.new()
    for x in range(4, 12): c.tone(x, 24, 'stone', 4 if x % 3 else 3)         # 받침 윗면 홈(받침돌 결)
    if on:
        bob = (0, -1, -1, 0)[frame % 4]; add = (-1, 0, 1, 0)[frame % 4]
        c.group(2); crystal(c, 8, 3 + bob, 10 + bob, 19 + bob, 4.2, 'azure', add=add)
    else:
        c.group(2); crystal(c, 8, 8, 14, 22, 4.0, 'dimcry', add=-1, crack=True)
    im = F(c); px = im.load()
    if on:
        f = frame % 4
        # 받침 윗면에 비친 빛: 프레임마다 넓이가 다르다
        lit_ground(px, 16, 32, 8, 24.5, (3.5, 4.5, 6, 4.5)[f], 1.6, 'azure', (4, 5, 6, 5)[f], dens=.7, seed=f)
        # 수정 둘레를 도는 빛 알갱이 셋(프레임마다 90도씩)
        for k in range(3):
            a = (f / 4 + k / 3) * 2 * math.pi
            x = int(round(8 + 6.2 * math.cos(a))); y = int(round(12 + 2.0 * math.sin(a))) + (0, -1, -1, 0)[f]
            sparks(px, 16, 32, [(x, y)], 'azure', 6 if math.sin(a) > 0 else 5)
        # 꼭대기 반짝임(맥동이 가장 밝을 때 십자)
        top = 3 + (0, -1, -1, 0)[f]
        if f == 2: sparks(px, 16, 32, [(8, top - 2), (7, top - 1), (9, top - 1), (8, top - 1)], 'azure', 6)
        elif f in (1, 3): sparks(px, 16, 32, [(8, top - 1)], 'azure', 5)
    return im


# ---------------------------------------------------------------- 3·4 이동 발판 마법진 (걸음 바닥 소품)
def _ring_pts(cx, cy, rx, ry, n, phase=0.0):
    return [(cx + rx * math.cos(phase + 2 * math.pi * i / n), cy + ry * math.sin(phase + 2 * math.pi * i / n)) for i in range(n)]


RUNE = [["x.", "xx"], [".x", "xx"], ["xx", "x."], ["xx", ".x"], ["x.", ".x"], [".x", "x."], ["xx", "x."], ["x.", "xx"]]


def warp_pad(frame=0, on=True):
    """이동 발판(2x2, 납작): 바닥에 박힌 둥근 마름돌 판(3/4 타원 윗면 + 얇은 앞모 2px) + 바깥 홈 고리 + 룬 여덟 + 가운데 별.
    켜짐 4프레임 = 빛 나는 호(弧)가 고리를 따라 45도씩 돈다 + 룬이 차례로 켜진다 + 가운데 빛이 맥동."""
    c = C(32, 32, seed=1301)
    cx, cy, rx, ry = 16, 15.5, 14.2, 10.2
    c.group(1); c.new()
    for y in range(int(cy - ry) - 1, int(cy + ry) + 4):
        for x in range(1, 31):
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry; r = dx * dx + dy * dy
            if r <= 1:
                c.setv(x, y, 'stone', .86 - .10 * dx - .10 * dy)          # 판 윗면(왼쪽 위 빛)
            else:
                dy2 = (y + .5 - cy - 2.2) / ry                             # 앞모(두께 2px)
                if dx * dx + dy2 * dy2 <= 1 and y > cy: c.tone(x, y, 'stone', 3 if dx < .3 else 2)
    im0 = F(c); px = im0.load()
    W = H = 32
    lum = 'azure' if on else 'dimcry'
    # 바깥 홈 고리(어두운 홈 + 안쪽 빛 모)
    for i in range(96):
        a = 2 * math.pi * i / 96
        for (rr, tone) in ((0.86, 1), (0.80, None)):
            x = int(round(cx - .5 + rx * rr * math.cos(a))); y = int(round(cy - .5 + ry * rr * math.sin(a)))
            if tone == 1: put(px, W, H, x, y, rgb('stone', 1))
    # 빛 고리: 켜짐이면 고리 전체 3단, 도는 호는 6단
    f = frame % 4
    for i in range(96):
        a = 2 * math.pi * i / 96
        x = int(round(cx - .5 + rx * .80 * math.cos(a))); y = int(round(cy - .5 + ry * .80 * math.sin(a)))
        if on:
            ph = (a - f * math.pi / 4) % (2 * math.pi)
            t = 6 if ph < .55 else (5 if ph < 1.1 else (4 if (ph > math.pi and ph < math.pi + .55) else 3))
            if ph > math.pi and ph < math.pi + .55: t = 6                 # 맞은편 호 하나 더(두 호가 같이 돈다)
            put(px, W, H, x, y, rgb(lum, t))
        else:
            put(px, W, H, x, y, rgb(lum, 2))
    # 룬 여덟(고리 안쪽)
    for i, (x, y) in enumerate(_ring_pts(cx - .5, cy - .5, rx * .56, ry * .56, 8, -math.pi / 2)):
        g = RUNE[i]
        if on: t = 6 if i % 4 == f else (4 if (i + 1) % 4 == f else 3)
        else: t = 1
        for j, row in enumerate(g):
            for k, ch in enumerate(row):
                if ch == 'x': put(px, W, H, int(round(x)) - 1 + k, int(round(y)) - 1 + j, rgb(lum, t))
    # 가운데 네 갈래 별 + 맥동
    sz = (2, 3, 4, 3)[f] if on else 2
    for d in range(-sz, sz + 1):
        tt = 6 if abs(d) <= 1 else 4
        if not on: tt = 2
        put(px, W, H, 16 + d, 15, rgb(lum, tt)); put(px, W, H, 15 + d, 15, rgb(lum, tt))
        put(px, W, H, 15, 15 + (d * 2) // 3, rgb(lum, tt)); put(px, W, H, 16, 15 + (d * 2) // 3, rgb(lum, tt))
    if on:
        # 판 위로 피어오르는 빛 점(프레임마다 높이가 다르다)
        for k, (bx, by) in enumerate(((9, 12), (22, 10), (13, 20), (20, 19))):
            yy = by - ((f + k) % 4) * 2
            put(px, W, H, bx, yy, rgb(lum, 6 if (f + k) % 4 < 2 else 5))
    return im0


# ---------------------------------------------------------------- 5 차원문
def portal_gate(frame=0):
    """서 있는 차원문(2x3): 마름돌 단 위 두 돌기둥 + 반원 아치 머리돌(이맛돌 하나), 아치 안 보라 소용돌이.
    4프레임 = 두 팔 소용돌이가 45도씩 돌고(한 바퀴 반 주기라 이어진다) 밝기가 맥동, 이맛돌 보석이 깜빡인다."""
    W, H = 32, 48
    c = C(W, H, seed=1501)
    c.shadow(16, 45.6, 15, 1.8, 70)
    c.group(1); stone_plinth(c, 1, 39, 30, 3, 5)
    c.group(2)
    # 기둥 둘(왼쪽 기둥은 빛, 오른쪽은 그늘 쪽 한 단 낮다)
    for (x0, b) in ((3, 0.04), (24, -0.06)):
        c.new()
        for y in range(14, 39):
            for x in range(x0, x0 + 5):
                u = x - x0; t = (5, 5, 4, 3, 2)[u] + (0 if b > 0 else -1 if u > 2 else 0)
                if (y - 14) % 8 == 7: t = max(1, t - 2)            # 돌 마디
                c.tone(x, y, 'stone', max(1, t))
        c.box(x0 - 1, 36, 7, 1, 2, 'stone', bias=b)                 # 기둥 밑동
    # 아치 머리돌: 바깥 반지름 13, 안 반지름 9, 가운데 x=16, 아랫선 y=16
    c.new()
    for y in range(1, 17):
        for x in range(2, 30):
            d = math.hypot(x + .5 - 16, (y + .5 - 16) * 1.0)
            if 9 <= d <= 13.6:
                a = math.atan2(16 - (y + .5), x + .5 - 16)
                seg = int((a / math.pi) * 7) if a >= 0 else 0
                edge = abs((a / math.pi) * 7 - round((a / math.pi) * 7)) < .09
                t = 5 if d > 12.4 else (4 if x < 16 else 3)
                if d < 9.8: t = 2
                if edge: t = 1
                c.tone(x, y, 'stone', t)
    c.new()
    for y in range(1, 6):
        for x in range(13, 19): c.tone(x, y, 'stone', 5 if x < 16 else 4)
    im = F(c); px = im.load()
    f = frame % 4
    # 소용돌이(아치 안 + 기둥 사이): 두 팔 나선
    cx, cy = 15.5, 24.0
    for y in range(6, 39):
        for x in range(8, 24):
            inside = (y >= 16 and 8 <= x <= 23) or (math.hypot(x + .5 - 16, y + .5 - 16) < 8.6)
            if not inside or px[x, y][3] == 255: continue
            dx = (x + .5 - 16) / 8.0; dy = (y + .5 - cy) / 14.0
            r = math.hypot(dx, dy); a = math.atan2(dy, dx)
            v = math.cos(2 * (a + f * math.pi / 4) - 7.0 * r)
            t = 1 + int((v * .5 + .5) * 3.2) + (1 if r < .32 else 0) + (1 if r < .14 else 0) + (0, 0, 1, 0)[f] - (1 if r > .92 else 0)
            put(px, W, H, x, y, rgb('violet', max(1, min(6, t))))
    # 문턱(단 윗면)에 비친 보라 빛
    lit_ground(px, W, H, 16, 40.5, (6, 7.5, 9, 7.5)[f], 1.7, 'violet', (4, 5, 6, 5)[f], dens=.75, seed=f)
    # 이맛돌 보석 깜빡임
    gem = (4, 5, 6, 5)[f]
    for (x, y) in ((15, 2), (16, 2), (15, 3), (16, 3)): put(px, W, H, x, y, rgb('violet', gem))
    put(px, W, H, 15, 2, rgb('violet', min(6, gem + 1)))
    # 소용돌이에서 튀는 빛 알갱이(아치 밖으로, 프레임마다 다른 자리)
    for k in range(3):
        a = f * math.pi / 2 + k * 2.1
        x = int(round(16 + 10.5 * math.cos(a))); y = int(round(24 + 13 * math.sin(a)))
        if 0 <= x < W and 0 <= y < H and px[x, y][3] == 0: put(px, W, H, x, y, rgb('violet', 6))
    return im


# ---------------------------------------------------------------- 6 회복 샘
def heal_spring(frame=0):
    """회복 샘(2x2): 둥근 마름돌 샘 둘레(3/4: 위에서 본 타원 + 앞면 돌 띠) 속 맑은 청록 물, 가운데 솟는 샘물.
    4프레임 = 물결 고리가 퍼지고 · 솟는 물 높이가 달라지고 · 반짝임이 위로 떠오른다."""
    W, H = 32, 32
    c = C(W, H, seed=1601)
    c.shadow(16, 29.6, 15, 1.8, 70)
    cx, cy = 16, 16.5
    c.group(1); c.cylinder(cx, cy, 25, 14.4, 'stone', capry=8.2, bias=-0.04)
    # 앞면 돌 띠 마디(마름돌 둘레)
    c.new()
    for x in range(3, 30):
        for y in range(23, 28):
            if (x * 7) % 9 == 0 and c.m[y][x]: c.tone(x, y, 'stone', 2)
    # 물 윗면
    c.new()
    for y in range(int(cy - 7), int(cy + 7) + 1):
        for x in range(4, 29):
            dx = (x + .5 - cx) / 11.6; dy = (y + .5 - cy) / 6.0
            if dx * dx + dy * dy <= 1:
                t = 1 if dy < -0.45 else (2 if dx * dx + dy * dy > .55 else 3)
                c.tone(x, y, 'heal', t)
    im = F(c); px = im.load()
    f = frame % 4
    # 물결 고리(프레임마다 반지름이 커진다)
    rr = (.28, .48, .68, .88)[f]
    for i in range(64):
        a = 2 * math.pi * i / 64
        x = int(round(cx - .5 + 11.6 * rr * math.cos(a))); y = int(round(cy - .5 + 6.0 * rr * math.sin(a)))
        if px[x, y][3] == 255 and i % (2 if f < 2 else 3): put(px, W, H, x, y, rgb('heal', 4 if f < 3 else 3))
    # 솟는 샘물(높이 맥동)
    hgt = (4, 6, 7, 5)[f]
    for y in range(int(cy) - hgt, int(cy) + 1):
        put(px, W, H, 15, y, rgb('heal', 6)); put(px, W, H, 16, y, rgb('heal', 5))
    top = int(cy) - hgt
    for (dx, dy) in ((-2, 1), (2, 1), (-3, 2), (3, 2)):
        put(px, W, H, 15 + dx + (1 if dx > 0 else 0), top + dy, rgb('heal', 6 if abs(dx) == 2 else 5))
    # 떠오르는 반짝임(회복의 빛): 네 점이 위로 올라간다
    for k, bx in enumerate((8, 12, 21, 24)):
        y = 14 - ((f + k * 2) % 4) * 3
        put(px, W, H, bx, y, rgb('heal', 6))
        if (f + k) % 2 == 0: put(px, W, H, bx, y - 1, rgb('heal', 5))
    return im


# ---------------------------------------------------------------- 12 수정 스위치
def crystal_switch(color='blue'):
    """수정 스위치(1x1): 낮은 마름돌 받침에 박힌 작은 수정(파랑/빨강). 때리면 색이 바뀌는 스위치 두 상태."""
    mat = 'azure' if color == 'blue' else 'sigred'
    c = C(16, 16, seed=1701 + (color == 'red'))
    c.shadow(8, 14.6, 6.5, 1.3, 70)
    c.group(1); stone_plinth(c, 2, 9, 12, 2, 4)
    c.group(2); crystal(c, 8, 1, 5, 10, 3.6, mat)
    im = F(c); px = im.load()
    lit_ground(px, 16, 16, 8, 10, 4.6, 1.2, mat, 5, dens=.7, seed=3)
    put(px, 16, 16, 7, 0, rgb(mat, 6)) if False else None
    return im
