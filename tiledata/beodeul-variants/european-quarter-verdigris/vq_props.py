# 녹청 지붕 저택가 거리 소품 1 — 가로등·마차·손수레·우물·분수·벤치·화분·가로수. 결정적, 3/4(윗면+앞면), 빛 왼쪽 위.
# 모든 소품은 왼쪽 아래 기준, 칸(16px) 배수로 넓혀 내보낸다(vq_kit). 사람·말·글자·상표 없음.
from vq_base import *
from vq_base import _h

def ellipse_fill(pen, cx, cy, rx, ry, fn):
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if d <= 1: fn(x, y, d)

# ---------------------------------------------------------------- 가로등
def lantern(pen, cx, y, lit=False):
    """쇠 등 머리(7x9): 뾰족 갓(쇠 5·2) + 유리 네 칸(낮: 흐린 유리, 밤: 호박) + 아래 받침."""
    for j, hw in enumerate((0, 1, 2, 3)):
        for x in range(cx - hw, cx + hw + 1): pen.p(x, y + j, IRON, 5 if x <= cx else 2)
    pen.p(cx, y - 1, IRON, 5)
    for yy in range(y + 4, y + 9):
        for x in range(cx - 3, cx + 4):
            if x in (cx - 3, cx + 3): pen.p(x, yy, IRON, 4 if x < cx else 2); continue
            if lit: pen.p(x, yy, AMBER, 5 if yy < y + 6 else 4)
            else: pen.p(x, yy, GLASS, 4 if (x < cx and yy < y + 7) else 3)
        pen.p(cx, yy, IRON, 3)
    pen.p(cx - 2, y + 5, GLASS if not lit else AMBER, 6)
    for x in range(cx - 3, cx + 4): pen.p(x, y + 9, IRON, 4 if x < cx else 2)
    for x in range(cx - 1, cx + 2): pen.p(x, y + 10, IRON, 3)

def lamp_post(heads=3, lit=False):
    """검은 쇠 가로등(1x3칸): 계단진 받침(윗면 빛) + 홈 판 기둥(왼 빛 2px) + 위 가로 팔과 등 머리 1개 또는 3개."""
    pen = Pen(16, 48); cx = 7
    for y in range(44, 48):                                                # 받침
        w = 3 if y < 46 else 4
        for x in range(cx - w + 1, cx + w + 1): pen.p(x, y, IRON, 5 if (y == 44 or x <= cx - w + 2) else 3)
    for y in range(41, 44):
        for x in range(cx - 1, cx + 3): pen.p(x, y, IRON, 4 if x <= cx else 2)
    top = 16 if heads == 3 else 12
    for y in range(top, 41):                                               # 기둥
        pen.p(cx, y, IRON, 5); pen.p(cx + 1, y, IRON, 3)
        if y % 9 == 0: pen.p(cx - 1, y, IRON, 4); pen.p(cx + 2, y, IRON, 2)
    if heads == 3:
        for x in range(1, 15):                                              # 가로 팔(살짝 휜)
            yy = top - (1 if 3 < x < 12 else 0)
            pen.p(x, yy, IRON, 5 if x < 8 else 3); pen.p(x, yy + 1, IRON, 2)
        for (hx_, hy) in ((2, top - 9), (12, top - 9), (7, top - 13)):
            if hx_ != 7: pen.p(hx_, top - 1, IRON, 4)
            lantern(pen, hx_, hy, lit)
        pen.p(cx, top - 3, IRON, 5); pen.p(cx + 1, top - 3, IRON, 3)
    else:
        for y in range(top - 3, top + 1): pen.p(cx, y, IRON, 5); pen.p(cx + 1, y, IRON, 3)
        lantern(pen, cx, top - 12, lit)
    return fin(pen.im, .75)

def lamp_wall():
    """벽 등(1x1칸, 벽에 붙인다): 쇠 까치발 + 등 머리. 벽 앞 덧그림 물체(막지 않음)."""
    pen = Pen(16, 16)
    for x in range(2, 9): pen.p(x, 4, IRON, 4); pen.p(x, 5, IRON, 2)
    for y in range(3, 9): pen.p(2, y, IRON, 3)
    pen.p(3, 6, IRON, 3); pen.p(4, 7, IRON, 2)
    lantern(pen, 9, 3, False)
    return fin(pen.im, .78)

def street_clock():
    """거리 시계 기둥(1x3칸): 쇠 기둥 위 둥근 시계(흰 문자판 + 눈금 점 + 바늘 둘, 숫자 없음) 양면 테."""
    pen = Pen(16, 48); cx = 7
    for y in range(43, 48):
        w = 2 if y < 45 else 3
        for x in range(cx - w, cx + w + 2): pen.p(x, y, IRON, 5 if x <= cx - w + 1 or y == 43 else 3)
    for y in range(16, 43): pen.p(cx, y, IRON, 5); pen.p(cx + 1, y, IRON, 3)
    for y in range(13, 17): pen.p(cx - 1, y, IRON, 4); pen.p(cx + 2, y, IRON, 2); pen.p(cx, y, IRON, 4); pen.p(cx + 1, y, IRON, 3)
    ellipse_fill(pen, 8, 7, 6.5, 6.5, lambda x, y, d: pen.p(x, y, IRON, 5 if (x < 8 and y < 7) else 2) if d > .62 else pen.p(x, y, TRIM, 6 if d < .3 else 5))
    for a in range(12):
        t = a / 12 * math.tau; pen.p(int(8 + math.cos(t) * 3.8), int(7 + math.sin(t) * 3.8), IRON, 3)
    pen.p(8, 7, IRON, 1); pen.p(8, 6, IRON, 1); pen.p(8, 5, IRON, 1); pen.p(9, 7, IRON, 1); pen.p(10, 8, IRON, 1)
    pen.p(8, 0, IRON, 5); pen.p(7, 1, IRON, 4); pen.p(8, 1, IRON, 4); pen.p(9, 1, IRON, 2)
    return fin(pen.im, .75)

# ---------------------------------------------------------------- 탈것
def wheel(pen, cx, cy, r, R=None, spokes=8):
    R = R or WOOD
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            d = math.hypot(x + .5 - cx, y + .5 - cy)
            if r - 1.6 <= d <= r + .4: pen.p(x, y, IRON if d > r - .6 else R, (3 if y > cy else 4) if d > r - .6 else (4 if (x < cx and y < cy) else 2))
    for s in range(spokes):
        t = s / spokes * math.pi
        for q in range(-int(r) + 1, int(r)):
            x = cx + math.cos(t) * q; y = cy + math.sin(t) * q
            pen.p(int(x), int(y), R, 4 if (s % 2) else 3)
    pen.p(int(cx), int(cy), IRON, 5); pen.p(int(cx) - 1, int(cy), IRON, 3)

def carriage():
    """닫힌 마차(3x3칸, 옆에서 본 몸채 + 윗면 지붕): 짙은 녹청 칠 몸채(문·유리창·누른 테), 둥근 지붕 윗면, 뒤 큰 바퀴·앞 작은 바퀴,
    앞 마부석(쇠 난간), 앞으로 뻗은 끌채 둘(말 없음 — 세워 둔 마차). 바퀴 줄이 막힘."""
    pen = Pen(48, 40)
    BODY = VERD
    for y in range(8, 27):                                                  # 몸채
        for x in range(12, 38):
            ly = y - 8
            rr = 4 if ly < 4 else 0
            if ly > 14 and (x < 13 + (ly - 14) or x > 37 - (ly - 14)): continue
            k = 3 if x > 14 else 4
            if ly < 2: k = 5
            if x >= 36: k = 2
            if ly > 15: k -= 1
            pen.p(x, y, BODY, k)
    for x in range(11, 39):                                                 # 지붕 윗면(둥근 판 + 짐 난간)
        pen.p(x, 6, WOOD, 4 if x < 25 else 3); pen.p(x, 7, WOOD, 2)
        pen.p(x, 5, IRON, 4 if x % 3 else 5)
    for x in range(12, 38): pen.p(x, 4, IRON, 3 if x % 3 else 5)
    for (a, b) in ((14, 22), (28, 35)):                                     # 유리창
        for y in range(10, 17):
            for x in range(a, b): pen.p(x, y, GLASS, 3 if (x < a + 2 and y < 13) else 2)
        for x in range(a - 1, b + 1): pen.p(x, 9, AMBER, 3); pen.p(x, 17, AMBER, 2)
        for y in range(9, 18): pen.p(a - 1, y, AMBER, 3); pen.p(b, y, AMBER, 2)
    for y in range(18, 25): pen.p(24, y, BODY, 1); pen.p(25, y, BODY, 5)       # 문 틈 + 손잡이
    pen.p(27, 20, AMBER, 5)
    for x in range(12, 38): pen.p(x, 25, AMBER, 3)                            # 아래 테
    for x in range(2, 13):                                                  # 마부석
        pen.p(x, 13, WOOD, 4); pen.p(x, 14, WOOD, 2)
    for y in range(13, 24): pen.p(10, y, WOOD, 3); pen.p(11, y, WOOD, 2)
    for x in range(3, 12): pen.p(x, 10, IRON, 4)
    for x in (3, 7): pen.p(x, 11, IRON, 3); pen.p(x, 12, IRON, 3)
    for x in range(0, 12):                                                  # 끌채(앞으로)
        y = 27 + (x // 4)
        pen.p(x, y, WOOD, 4); pen.p(x, y + 1, WOOD, 2)
    wheel(pen, 32, 30, 8.5); wheel(pen, 14, 32, 6.5)
    for x in range(10, 40): pen.dark(x, 39, .7)
    return fin(pen.im, .7)

def handcart():
    """짐 손수레(2x2칸): 판자 짐칸(윗면 널빤지 결 + 앞판), 큰 바퀴 하나, 손잡이 두 대, 받침 다리. 참고 그림의 손수레를 일반 어휘로."""
    pen = Pen(32, 26)
    for y in range(6, 11):                                                  # 짐칸 윗면
        for x in range(6, 28):
            k = 5 if (y - 6) % 2 == 0 else 4
            if x == 27: k = 3
            pen.p(x, y, WOOD, k)
    for y in range(11, 17):                                                 # 앞판
        for x in range(6, 28):
            k = 3 if (y - 11) % 3 else 2
            if x in (6, 16, 27): k = 4 if x == 6 else 2
            pen.p(x, y, WOOD, k)
    for x in range(5, 29): pen.p(x, 5, WOOD, 6 if x < 18 else 5)
    for x in range(0, 7):                                                   # 손잡이
        pen.p(x, 9 + x // 3, WOOD, 4); pen.p(x, 10 + x // 3, WOOD, 2)
        pen.p(x + 1, 13 + x // 4, WOOD, 3)
    for y in range(17, 24): pen.p(8, y, WOOD, 3); pen.p(9, y, WOOD, 2)
    wheel(pen, 21, 18, 6.5)
    for x in range(6, 29): pen.dark(x, 25, .7)
    return fin(pen.im, .7)

def wheelbarrow():
    """외바퀴 수레(1x1칸): 쇠 통(윗면 안쪽 그늘) + 앞 바퀴 + 손잡이."""
    pen = Pen(16, 14)
    for y in range(3, 9):
        for x in range(3 + (y - 3) // 2, 14 - (y - 3) // 3):
            k = 2 if y < 5 and 4 < x < 12 else (4 if x < 7 else 3)
            pen.p(x, y, IRON, k)
    for x in range(2, 15): pen.p(x, 2, IRON, 5 if x < 9 else 4)
    for x in range(0, 4): pen.p(x, 3 + x // 2, WOOD, 4)
    wheel(pen, 12, 10, 3.2, WOOD, 4)
    for y in range(9, 13): pen.p(5, y, WOOD, 3)
    return fin(pen.im, .72)

# ---------------------------------------------------------------- 물
def ripple(pen, x0, x1, y, k=4):
    for x in range(x0, x1):
        if (x + y) % 5 == 0: pen.p(x, y, WATER, k)

def well_stone():
    """돌 우물(2x2칸): 둥근 크림 돌 둘레(윗면 갓돌 고리 + 앞면 마름돌), 안은 어두운 물, 위 쇠 아치 + 도르래 + 두레박."""
    pen = Pen(32, 32); cx, cy = 16, 18
    for y in range(18, 29):                                                 # 앞면 원통
        for x in range(4, 28):
            d = (x + .5 - cx) / 12
            if abs(d) > 1: continue
            row = (y - 18) // 4; ly = (y - 18) % 4; lx = (x + row * 3) % 7
            k = 4 if ly else 5
            if lx == 6 or ly == 3: k = 3
            k += 1 if d < -.4 else (-1 if d > .5 else 0)
            pen.p(x, y, CREAM, k)
    ellipse_fill(pen, cx, cy, 12, 5, lambda x, y, d: pen.p(x, y, TRIM, 6 if (y < cy and x < cx) else (5 if y < cy else 4)))
    ellipse_fill(pen, cx, cy + .5, 9, 3.4, lambda x, y, d: pen.p(x, y, WATER, 2 if d > .5 else 1))
    pen.p(cx - 3, cy, WATER, 4); pen.p(cx - 2, cy, WATER, 3)
    for y in range(3, 18):                                                  # 쇠 아치 기둥
        pen.p(5, y, IRON, 4); pen.p(6, y, IRON, 2); pen.p(26, y, IRON, 4); pen.p(27, y, IRON, 2)
    for x in range(5, 28):
        t = (x - 16) / 11.0; y = int(3 + 3 * t * t)
        pen.p(x, y, IRON, 5 if x < 16 else 3); pen.p(x, y + 1, IRON, 2)
    for (dx, dy) in ((0, 0), (-1, 1), (1, 1), (0, 2), (-1, 3), (1, 3), (0, 4)): pen.p(16 + dx, 3 + dy, IRON, 5 if dx <= 0 else 3)
    for y in range(8, 13): pen.p(16, y, BARK, 3)
    for y in range(13, 17):
        for x in range(14, 19): pen.p(x, y, WOOD, 4 if x < 16 else 2)
    pen.p(14, 13, IRON, 4); pen.p(18, 13, IRON, 2)
    return fin(pen.im, .7)

def fountain():
    """광장 분수(3x3칸): 낮은 팔각 돌 수반(윗면 갓돌 + 앞면 마름돌, 녹청 그림자 물) + 가운데 기둥 위 작은 접시 + 솟는 물줄기·물방울."""
    pen = Pen(48, 46); cx, cy = 24, 30
    for y in range(30, 43):                                                 # 앞면
        for x in range(2, 46):
            d = (x + .5 - cx) / 22
            if abs(d) > 1: continue
            if y > 30 + 11 * math.sqrt(max(0, 1 - d * d)) + 2: continue
            row = (y - 30) // 4; ly = (y - 30) % 4; lx = (x + row * 5) % 9
            k = 4 if ly else 5
            if lx == 8 or ly == 3: k = 3
            k += 1 if d < -.45 else (-1 if d > .5 else 0)
            pen.p(x, y, CREAM, k)
    ellipse_fill(pen, cx, cy, 22, 9, lambda x, y, d: pen.p(x, y, TRIM, 6 if (y < cy and x < cx) else (5 if y < cy - 2 else 4)))
    ellipse_fill(pen, cx, cy + .5, 19, 7, lambda x, y, d: pen.p(x, y, WATER, 3 if d < .55 else (2 if y < cy else 4)))
    for y in range(int(cy - 6), int(cy + 7)): ripple(pen, int(cx - 18), int(cx + 18), y, 5)
    for y in range(14, 31):                                                 # 가운데 기둥
        for x in range(cx - 2, cx + 3): pen.p(x, y, TRIM, 5 if x < cx else (4 if x == cx else 2))
    ellipse_fill(pen, cx, 15, 8, 2.5, lambda x, y, d: pen.p(x, y, TRIM, 6 if y < 15 else 4))
    for x in range(cx - 7, cx + 8): pen.p(x, 17, TRIM, 3); pen.p(x, 18, TRIM, 2)
    ellipse_fill(pen, cx, 15, 6, 1.5, lambda x, y, d: pen.p(x, y, WATER, 4))
    for y in range(3, 15):                                                  # 물줄기
        pen.p(cx, y, SNOW, 6 if y < 6 else 5); pen.p(cx - 1, y, SNOW, 4 if y > 5 else 5)
    for (dx, dy) in ((-3, 4), (3, 4), (-5, 7), (5, 7), (-7, 11), (7, 11), (-8, 15), (8, 15), (-2, 2), (2, 2)):
        pen.p(cx + dx, dy, SNOW, 6 if abs(dx) < 4 else 5)
    for (dx, dy) in ((-9, 19), (9, 19), (-10, 22), (10, 21), (-14, 26), (13, 25)): pen.p(cx + dx, dy + 8, SNOW, 5)
    for x in range(4, 45): pen.dark(x, 45, .7)
    return fin(pen.im, .68)

def trough():
    """말 물통(2x1칸): 돌 통(윗면 갓돌 + 안 물 + 앞면 마름돌) + 위 쇠 꼭지."""
    pen = Pen(32, 18)
    for y in range(8, 17):
        for x in range(2, 30):
            row = (y - 8) // 4; ly = (y - 8) % 4; lx = (x + row * 4) % 8
            k = 4 if ly else 5
            if lx == 7 or ly == 3: k = 3
            if x < 4: k += 1
            if x > 27: k -= 1
            pen.p(x, y, CREAM, k)
    for x in range(1, 31): pen.p(x, 4, TRIM, 6 if x < 16 else 5); pen.p(x, 7, TRIM, 4)
    for y in range(4, 8): pen.p(1, y, TRIM, 6); pen.p(30, y, TRIM, 3)
    for y in range(5, 7):
        for x in range(3, 29): pen.p(x, y, WATER, 3 if y == 5 else 2)
    ripple(pen, 4, 28, 5, 5)
    for y in range(0, 5): pen.p(26, y, IRON, 4)
    pen.p(25, 0, IRON, 5); pen.p(24, 0, IRON, 4); pen.p(24, 1, IRON, 3)
    return fin(pen.im, .7)

# ---------------------------------------------------------------- 정원·식생
def crown(pen, cx, cy, rx, ry, seed, R=None):
    """둥근 잎 덩이: 덩이 3~5개를 겹친다(각 덩이 위·왼 빛), 가장자리 잎 톱니, 잎 결 점."""
    R = R or LEAF
    blobs = [(cx, cy, rx, ry)]
    for i in range(4):
        a = _h(i, 1, seed) * math.tau
        blobs.append((cx + math.cos(a) * rx * .45, cy + math.sin(a) * ry * .35 - ry * .1, rx * .6, ry * .6))
    for (bx, by, brx, bry) in blobs:
        def f(x, y, d, bx=bx, by=by):
            if d > .92 and _h(x, y, seed + 3) > .55: return
            dx, dy = x + .5 - bx, y + .5 - by
            k = 4 - (dx + dy * 1.2) / (brx + bry) * 3.0
            if _h(x, y, seed + 4) > .8: k -= 1
            if _h(x // 2, y, seed + 5) > .88: k += 1
            pen.p(x, y, R, clamp(int(round(k)), 1, 6))
        ellipse_fill(pen, bx, by, brx, bry, f)

def street_tree(seed=1):
    """가로수(2x3칸): 둥근 보리수 수관(짙은 녹, 덩이 겹침) + 줄기(밑변과 같은 폭 4px) + 밑동 둥근 쇠 덮개(나무 격자)."""
    pen = Pen(32, 48)
    for y in range(26, 44):                                                 # 줄기
        for x in range(14, 18): pen.p(x, y, BARK, (5, 4, 3, 2)[x - 14])
    for y in range(41, 46):
        for x in range(13, 19): pen.p(x, y, BARK, 4 if x < 15 else 2)
    crown(pen, 16, 17, 14, 14, seed)
    ellipse_fill(pen, 16, 45, 8, 2.4, lambda x, y, d: pen.p(x, y, IRON, 4 if (x + y) % 2 else 2) if d > .3 else None)
    return fin(pen.im, .72)

def topiary_cone(seed=1):
    """원뿔 주목(1x2칸): 돌 화분(윗면 갓 + 앞면) 위 원뿔로 다듬은 상록수(왼 빛·오른 그늘 잎 결)."""
    pen = Pen(16, 32)
    for y in range(2, 25):
        half = 1 + (y - 2) * .27
        for x in range(16):
            d = (x + .5 - 8) / max(.6, half)
            if abs(d) > 1: continue
            k = 4 - d * 1.6 + (1 if _h(x, y, seed) > .85 else 0) - (1 if _h(x, y, seed + 1) > .8 else 0)
            if (y + x // 3) % 4 == 0: k -= 1
            pen.p(x, y, LEAF, clamp(int(round(k)), 1, 6))
    for y in range(24, 32):
        w = 5 if y < 26 else 4
        for x in range(8 - w, 8 + w):
            k = 6 if y == 24 else (5 if x < 6 else (4 if x < 10 else 3))
            pen.p(x, y, TRIM if y < 26 else CREAM, k)
    return fin(pen.im, .72)

def urn_planter(seed=1):
    """돌 항아리 화분(1x1칸): 굽 + 둥근 몸 + 갓, 위로 둥근 관목 덩이와 붉은 꽃점."""
    pen = Pen(16, 18)
    for y in range(9, 17):
        t = (y - 9) / 8.0; half = 5.5 - abs(t - .35) * 4.5
        for x in range(16):
            d = (x + .5 - 8) / max(1, half)
            if abs(d) > 1: continue
            pen.p(x, y, TRIM, clamp(int(round(5 - d * 1.5)), 2, 6))
    for x in range(2, 14): pen.p(x, 8, TRIM, 6 if x < 8 else 5); pen.p(x, 9, TRIM, 3)
    for x in range(5, 11): pen.p(x, 17, TRIM, 3)
    crown(pen, 8, 5, 5.5, 4.5, seed)
    for i in range(5): pen.p(4 + int(_h(i, 1, seed) * 8), 2 + int(_h(i, 2, seed) * 5), FLOWR, 5)
    return fin(pen.im, .72)

def planter_box(seed=1, R=None):
    """긴 돌 화단(2x1칸): 크림 돌 상자(윗면 갓돌 + 앞면 줄눈) + 위로 잎과 꽃(붉은/누른). 참고 그림 가로등 옆 꽃상자처럼."""
    R = R or FLOWR
    pen = Pen(32, 18)
    for y in range(10, 18):
        for x in range(1, 31):
            ly = y - 10; k = 4 if ly % 4 else 5
            if ly % 4 == 3 or (x + (ly // 4) * 5) % 10 == 9: k = 3
            if x < 3: k += 1
            if x > 28: k -= 1
            pen.p(x, y, CREAM, k)
    for x in range(0, 32): pen.p(x, 9, TRIM, 6 if x < 16 else 5)
    for x in range(1, 31):
        hh = 3 + int(_h(x, seed, 1) * 3)
        for j in range(hh): pen.p(x, 8 - j, LEAF, 3 if j < hh - 1 else 5)
        if _h(x, seed, 2) > .45: pen.p(x, 8 - hh, R, 5 if _h(x, seed, 3) > .4 else 6)
        if _h(x, seed, 4) > .7: pen.p(x, 7 - hh // 2, R, 4)
    return fin(pen.im, .72)

def hedge_short(seed=1):
    """다듬은 회양목 울(2x1칸): 네모로 다듬은 덤불(윗면 밝은 잎 결 + 앞면 그늘 잎), 밑동 그늘."""
    pen = Pen(32, 20)
    for y in range(3, 20):
        for x in range(1, 31):
            top = y < 8
            k = (5 if _h(x, y, seed) > .3 else 4) if top else (3 if _h(x, y, seed + 1) > .35 else 2)
            if top and y == 3: k = 4 if (x % 3) else 5
            if not top and x < 4: k += 1
            if x > 28: k -= 1
            if y > 17: k = 1
            pen.p(x, y, LEAF, k)
    return fin(pen.im, .72)

def bench_iron(seed=1):
    """쇠 다리 나무 벤치(2x1칸): 등받이 널 2줄 + 앉는 널 윗면 + 소용돌이 쇠 다리."""
    pen = Pen(32, 18)
    for x in range(2, 30):
        pen.p(x, 3, WOOD, 5); pen.p(x, 4, WOOD, 3); pen.p(x, 6, WOOD, 5); pen.p(x, 7, WOOD, 3)
        pen.p(x, 10, WOOD, 6 if x < 16 else 5); pen.p(x, 11, WOOD, 5); pen.p(x, 12, WOOD, 3)
    for lx in (3, 27):
        for y in range(2, 17): pen.p(lx, y, IRON, 4); pen.p(lx + 1, y, IRON, 2)
        pen.p(lx - 1, 16, IRON, 4); pen.p(lx + 2, 16, IRON, 2); pen.p(lx - 1, 13, IRON, 3); pen.p(lx + 2, 9, IRON, 3)
    for x in range(2, 30): pen.dark(x, 17, .7)
    return fin(pen.im, .72)

def flower_cart(seed=2):
    """꽃 수레(2x2칸): 바퀴 둘 달린 나무 수레 위 꽃 양동이 셋(붉은·누른·흰 꽃 덩이), 손잡이."""
    pen = Pen(32, 28)
    for y in range(14, 20):
        for x in range(3, 29):
            k = 4 if (y - 14) % 3 else 5
            if y >= 17: k = 3 if (x % 8) else 2
            if x > 27: k = 2
            pen.p(x, y, WOOD, k)
    for (bx, R) in ((8, FLOWR), (16, FLOWY), (24, SNOW)):
        for y in range(9, 14):
            for x in range(bx - 3, bx + 4): pen.p(x, y, IRON, 4 if x < bx else 3)
        crown(pen, bx, 7, 4.5, 3.5, seed + bx, LEAF)
        for i in range(7): pen.p(bx - 3 + int(_h(i, 1, seed + bx) * 7), 4 + int(_h(i, 2, seed + bx) * 5), R, 5 if i % 2 else 6)
    for x in range(0, 4): pen.p(x, 15 + x // 2, WOOD, 4)
    wheel(pen, 8, 22, 4.5, WOOD, 6); wheel(pen, 24, 22, 4.5, WOOD, 6)
    return fin(pen.im, .7)
