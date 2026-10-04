import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../house_roof/work'))
from j1_lib import C
OUT = os.path.dirname(os.path.dirname(__file__))
W, H = 48, 48

def trap(c, y0, y1, a0, a1, b0, b1, fn):
    """사다리꼴: 위 줄 y0 에서 x a0..b0, 아래 줄 y1 에서 a1..b1 (선형). fn(x,y,xl,xr)->(램프,단)"""
    n = max(1, y1 - y0)
    for y in range(y0, y1 + 1):
        t = (y - y0) / n
        xl = round(a0 + (a1 - a0) * t); xr = round(b0 + (b1 - b0) * t)
        for x in range(xl, xr + 1):
            v = fn(x, y, xl, xr)
            if v: c.px(x, y, v[0], v[1])

def shadow(c, rows):
    for (y, x0, x1, ch) in rows:
        for x in range(x0, x1 + 1):
            if c.at(x, y) is None: c.px(x, y, ch)

def hip_roof(c, ramp, hi, mid, lo, dk, seams=5, xs=(2, 45)):
    xl, xr = xs
    def top(x, y, l, r):
        if x == l: return (ramp, hi)
        if x == r: return (ramp, lo)
        if y == 3: return (ramp, hi)
        if (x - xl) % seams == 0: return (ramp, mid - 1)
        return (ramp, mid)
    trap(c, 3, 12, 13, xl, 34, xr, top)
    c.hl(xl, 13, xr - xl + 1, ramp, mid - 1); c.hl(xl, 14, xr - xl + 1, ramp, dk + 1); c.hl(xl + 1, 15, xr - xl - 1, ramp, dk)
    c.px(xl, 13, ramp, hi); c.px(xl, 14, ramp, mid - 1)

def post(c, x, y0, y1, w, ramp, tones):
    for i in range(w):
        c.vl(x + i, y0, y1 - y0 + 1, ramp, tones[min(i, len(tones) - 1)])

def foot(c, x, y, w, ramp='ishi', t=(5, 4, 2)):
    c.hl(x, y, w, ramp, t[0]); c.rect(x, y + 1, w, 2, ramp, t[1]); c.hl(x, y + 3, w, ramp, t[2]); c.vl(x + w - 1, y + 1, 3, ramp, t[2])

def ladle(c, x, y0, hand, cupd, cupl):
    c.vl(x, y0, 4, 'matsu', hand); c.vl(x + 1, y0, 4, 'matsu', hand - 1)
    c.rect(x - 1, y0 + 4, 4, 2, 'matsu', cupl); c.hl(x - 1, y0 + 5, 4, 'matsu', cupd)
    c.px(x, y0 + 4, 'matsu', cupl + 1)

def basin_rect(c, top_t, front_t, water, glint, deep=False):
    # 윗면
    c.rect(9, 29, 30, 6, 'ishi', top_t[0])
    c.hl(9, 29, 30, 'ishi', top_t[1]); c.vl(9, 29, 6, 'ishi', top_t[1])
    c.hl(11, 30, 26, 'ishi', top_t[2] if not deep else 1)   # 안쪽 뒷벽
    c.rect(11, 31, 26, 3, 'mglass', water)
    c.hl(11, 33, 26, 'mglass', water - 1)
    c.hl(12, 32, 8, 'mglass', water + 1); c.hl(26, 32, 6, 'mglass', water + 1)
    c.px(14, 31, 'mwhite', glint); c.px(15, 31, 'mwhite', glint); c.px(30, 32, 'mwhite', glint); c.px(31, 32, 'mwhite', glint)
    c.hl(9, 34, 30, 'ishi', top_t[1] - 1)
    # 앞면
    c.rect(9, 35, 30, 8, 'ishi', front_t[0])
    for x in (16, 23, 30): c.vl(x, 35, 8, 'ishi', front_t[1])
    c.hl(9, 38, 30, 'ishi', front_t[1]); 
    c.vl(9, 35, 8, 'ishi', front_t[0] + 1); c.vl(38, 35, 8, 'ishi', front_t[1] - 1)
    c.hl(9, 42, 30, 'ishi', front_t[1] - 1)
    for (x, y) in ((11, 36), (12, 36), (19, 40), (33, 37), (34, 37)): c.px(x, y, 'moss', 2)
    c.hl(11, 41, 4, 'moss', 2); c.px(13, 40, 'moss', 3)

def spout(c, ht, stone_t):
    c.rect(22, 22, 6, 8, 'ishi', stone_t[0]); c.vl(22, 22, 8, 'ishi', stone_t[1]); c.vl(27, 22, 8, 'ishi', stone_t[2]); c.hl(22, 22, 6, 'ishi', stone_t[1] + 1)
    c.rect(22, 24, 6, 3, 'kasa', ht[0]); c.hl(22, 24, 6, 'kasa', ht[1]); c.hl(22, 26, 6, 'kasa', ht[2])
    c.px(23, 25, 'mwhite', 4); c.px(26, 25, 'mwhite', 4)       # 눈
    c.px(24, 27, 'mglass', 5); c.px(25, 27, 'mglass', 5)
    c.vl(24, 28, 4, 'mglass', 6)

def A(strong=False):
    c = C(W, H)
    if not strong: hi, mid, lo, dk = 4, 3, 2, 1
    else: hi, mid, lo, dk = 4, 3, 1, 0
    hip_roof(c, 'kasa', hi, mid, lo, dk)
    # 뒤 기둥
    post(c, 11, 16, 30, 2, 'hinoki', (3, 1) if strong else (3, 2)); post(c, 35, 16, 30, 2, 'hinoki', (2, 0) if strong else (3, 2))
    # 앞 기둥과 보
    fl = (5, 4, 2) if not strong else (6, 4, 1)
    post(c, 6, 16, 42, 3, 'hinoki', fl); post(c, 39, 16, 42, 3, 'hinoki', fl)
    c.hl(9, 17, 30, 'hinoki', 4 if not strong else 5); c.hl(9, 18, 30, 'hinoki', 3); c.hl(9, 19, 30, 'hinoki', 2 if not strong else 1)
    # 처마 밑 어둠
    for x in range(9, 39): c.px(x, 16, 'sumi', 1 if strong else 2)
    if strong:
        for x in range(9, 39): c.px(x, 20, 'sumi', 0)
    # 수반과 용 주둥이, 국자
    if not strong:
        spout(c, (3, 4, 2), (3, 4, 2)); basin_rect(c, (4, 5, 2), (3, 2), 5, 4)
    else:
        spout(c, (3, 4, 1), (2, 4, 1)); basin_rect(c, (5, 6, 1), (3, 1), 5, 5, deep=True)
    for x in (14, 18, 30, 34): ladle(c, x, 27, 4 if not strong else 5, 2, 3)
    # 주춧돌과 받침
    foot(c, 5, 42, 5); foot(c, 38, 42, 5)
    c.rect(10, 43, 28, 2, 'ishi', 3 if not strong else 2); c.hl(10, 43, 28, 'ishi', 4 if not strong else 5); c.hl(10, 45, 28, 'ishi', 1)
    # 그림자
    if not strong:
        shadow(c, [(46, 9, 43, '~'), (47, 11, 45, '-')] + [(y, 43, 46, '~') for y in (42, 43, 44, 45)])
    else:
        shadow(c, [(46, 8, 44, '~'), (47, 9, 46, '~'), (45, 43, 47, '~'), (44, 43, 47, '-'), (43, 44, 47, '-'), (42, 44, 47, '-')])
        shadow(c, [(46, 6, 7, '-'), (47, 7, 8, '-')])
    return c

def Cc():
    c = C(W, H)
    # 맞배 지붕(정면이 삼각형): 검은 기와
    def gable(x, y, l, r):
        if x == l or x == r: return ('hinoki', 5 if x == l else 3)
        if y == 2: return ('hinoki', 5)
        if y % 2 == 1: return ('kawara', 2)
        return ('kawara', 4 if x < 22 else 3)
    trap(c, 2, 12, 24, 3, 25, 44, gable)
    c.rect(19, 8, 10, 3, 'washi', 3); c.hl(19, 8, 10, 'washi', 4); c.box(19, 8, 10, 3, 'hinoki', 2)      # 박공 환기창
    for x in range(21, 28, 2): c.vl(x, 9, 1, 'sumi', 2)
    c.hl(2, 13, 44, 'kawara', 3); c.hl(2, 14, 44, 'kawara', 1); c.hl(3, 15, 42, 'kawara', 0); c.hl(2, 13, 6, 'kawara', 5)
    for x in range(4, 44, 4): c.px(x, 14, 'kawara', 2)
    # 굵은 기둥과 두공
    for x0, tt in ((4, (5, 4, 3, 2)), (40, (5, 4, 3, 1))):
        post(c, x0, 16, 42, 4, 'hinoki', tt)
        c.rect(x0 - 1, 16, 6, 2, 'hinoki', 4); c.hl(x0 - 1, 16, 6, 'hinoki', 5); c.hl(x0 - 1, 17, 6, 'hinoki', 2)
    c.hl(8, 17, 32, 'hinoki', 4); c.hl(8, 18, 32, 'hinoki', 3); c.hl(8, 19, 32, 'hinoki', 1)
    # 대나무 홈통(가케이): 위 오른쪽에서 수반 위로
    for i in range(13):
        x, y = 39 - i, 20 + (i * 9) // 12
        c.px(x, y, 'matsu', 4); c.px(x, y + 1, 'matsu', 3); c.px(x, y + 2, 'matsu', 1)
    for x in (34, 27): c.vl(x, 22 + (39 - x) * 9 // 12, 3, 'matsu', 5)
    c.vl(27, 30, 5, 'mglass', 6)          # 떨어지는 물
    # 자연석 수반: 위 타원(윗면) + 몸통
    for y in range(28, 45):
        for x in range(10, 39):
            cx = 24; 
            if y <= 34: dy = (y - 32) / 5.0; dx = (x - cx) / 14.0
            else: dy = (y - 34) / 10.0; dx = (x - cx) / 14.5
            inside = dx * dx + dy * dy <= 1.0
            if y <= 34 and inside: c.px(x, y, 'ishi', 5 if x < 22 else 4)
            elif y > 34 and inside:
                t = 4 if x < 17 else (3 if x < 29 else 2)
                if y > 41: t -= 1
                if x > 34: t = 1
                c.px(x, y, 'ishi', t)
    # 물 웅덩이(타원)
    for y in range(29, 36):
        for x in range(13, 36):
            dy = (y - 32) / 3.4; dx = (x - 24) / 10.0
            if dx * dx + dy * dy <= 1.0: c.px(x, y, 'mglass', 5 if y < 33 else 4)
    for x in range(15, 33): c.px(x, 29 if abs(x - 24) < 7 else 30, 'ishi', 2)
    c.hl(16, 32, 6, 'mglass', 6); c.hl(26, 33, 5, 'mglass', 6); c.px(27, 31, 'mwhite', 5); c.px(28, 31, 'mwhite', 5)
    # 국자 셋(수반 위에 가로로 걸침)
    for x in (16, 20, 31): 
        c.vl(x, 28, 4, 'matsu', 4); c.vl(x + 1, 28, 4, 'matsu', 2); c.rect(x - 1, 32, 4, 2, 'matsu', 3); c.hl(x - 1, 33, 4, 'matsu', 1)
    for (x, y) in ((13, 39), (14, 39), (22, 42), (33, 38)): c.px(x, y, 'moss', 3)
    c.hl(12, 40, 3, 'moss', 2)
    # 디딤돌
    c.rect(11, 44, 10, 2, 'ishi', 4); c.hl(11, 44, 10, 'ishi', 5); c.hl(11, 46, 10, 'ishi', 2); c.rect(27, 44, 10, 2, 'ishi', 4); c.hl(27, 44, 10, 'ishi', 5); c.hl(27, 46, 10, 'ishi', 2)
    for x in range(12, 21): c.px(x, 46, 'ishi', 2)
    # 주춧돌
    foot(c, 3, 42, 6, t=(5, 3, 2)); foot(c, 39, 42, 6, t=(5, 3, 2))
    shadow(c, [(47, 6, 44, '~'), (46, 22, 26, '-'), (45, 39, 46, '-')] + [(y, 40, 46, '~') for y in (44, 45, 46)])
    shadow(c, [(47, 8, 12, '-')])
    return c

for k, f in (('A', lambda: A(False)), ('B', lambda: A(True)), ('C', Cc)):
    f().save(os.path.join(OUT, f'j1-{k}.pxg'))
open(os.path.join(OUT, 'j1-A.note'), 'w').write('구리 지붕 윗면·처마 두께가 보이는 각, 흰 나무 기둥 넷, 돌 물통과 용 주둥이·대나무 국자 넷, 강남식 5~6단 명암과 발치 그림자 2줄\n')
open(os.path.join(OUT, 'j1-B.note'), 'w').write('같은 모양에 명암을 세게: 처마 밑 어둠 띠, 오른쪽 기둥·물통 앞면 한두 단 어둡게, 물 반짝임 밝게, 오른쪽 아래로 뻗는 접지 그림자 3줄\n')
open(os.path.join(OUT, 'j1-C.note'), 'w').write('맞배 기와 지붕(정면 삼각형)에 굵은 기둥·두공, 용 대신 대나무 홈통이 자연석 수반으로 물을 떨구는 모양, 앞에 디딤돌 둘\n')
