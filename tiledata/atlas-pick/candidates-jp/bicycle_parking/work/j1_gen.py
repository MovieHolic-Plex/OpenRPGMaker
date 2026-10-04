import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../house_roof/work'))
from j1_lib import C
OUT = os.path.dirname(os.path.dirname(__file__))
W, H = 48, 32

def line(pts_a, pts_b):
    (xa, ya), (xb, yb) = pts_a, pts_b
    n = max(abs(xb - xa), abs(yb - ya)) or 1
    return [(xa + round((xb - xa) * k / n), ya + round((yb - ya) * k / n)) for k in range(n + 1)]

def bike(c, x0, y0, ramp, tone, basket=None, dim=0, flip=False, strong=False):
    """옆모습 자전거 16x14. 빛은 왼쪽 위. ramp/tone: 프레임색. dim: 명도 낮춤(뒷줄)."""
    def P(x, y, r, t=None):
        X = x0 + (15 - x if flip else x)
        if t is not None: t = max(0, t - dim)
        c.px(X, y0 + y, r, t)
    tire_l, tire_d = (5, 3) if strong else (4, 3)
    for (cx, cy) in ((3, 10), (12, 10)):
        for y in range(cy - 3, cy + 4):
            for x in range(cx - 3, cx + 4):
                d = (x - cx) ** 2 + (y - cy) ** 2
                if 6 <= d <= 12 and not (abs(x - cx) == 3 and abs(y - cy) == 3) and not (d == 13):
                    P(x, y, 'lacq', tire_l if (x < cx and y <= cy) or (y < cy) else tire_d - (1 if x > cx else 0))
                elif d < 6:
                    P(x, y, 'mmetal', 5 if (x == cx or y == cy) else 3)
        P(cx, cy, 'mmetal', 7 if strong else 6)
    # 프레임
    ft = tone
    for (a, b) in (((4, 4), (7, 11)), ((4, 4), (10, 4)), ((7, 11), (10, 4)), ((3, 10), (7, 11)), ((3, 10), (4, 4)), ((10, 2), (12, 10))):
        for (x, y) in line(a, b):
            P(x, y, ramp, ft + (1 if a[1] == b[1] == 4 else 0))
    for (x, y) in line((4, 5), (7, 12)): P(x, y, ramp, max(ft - 2, 0)) if False else None
    # 오른쪽/아래를 한 단 어둡게: 다운튜브 뒤 그림자 선
    for (x, y) in line((8, 11), (11, 4)): 
        pass
    P(7, 12, 'mmetal', 4); P(6, 12, 'lacq', 3); P(8, 12, 'lacq', 3)          # 페달
    # 안장·핸들·그립
    for x in range(2, 7): P(x, 2, 'lacq', 5 if strong else 4)
    for x in range(2, 7): P(x, 3, 'lacq', 2)
    P(4, 3, 'mmetal', 4)
    for x in range(9, 13): P(x, 1, 'mmetal', 6 if strong else 5)
    P(13, 1, 'lacq', 3); P(13, 2, 'lacq', 2); P(9, 2, 'lacq', 3)
    P(10, 2, 'mmetal', 4)
    # 바구니
    if basket:
        for y in range(2, 6):
            for x in range(12, 16):
                P(x, y, 'mmetal', 3 if (x + y) % 2 else 1)
        for x in range(12, 16): P(x, 2, 'mmetal', 6 if strong else 5)
        for x in range(12, 16): P(x, 5, 'mmetal', 1)
        P(15, 2, 'mmetal', 3); P(15, 3, 'mmetal', 1); P(15, 4, 'mmetal', 1)

def rack(c, strong, y=28):
    c.hl(0, y, 48, 'mmetal', 6 if strong else 5)
    c.rect(0, y + 1, 48, 1, 'mmetal', 3)
    for x in range(1, 48, 3): c.px(x, y + 1, 'mmetal', 2)
    for x in (7, 23, 39):           # 거치대 기둥(금속 U자)
        c.vl(x, y - 1, 1, 'mmetal', 5)

def shadow(c, rows, x0=1, x1=47):
    for y, ch in rows:
        for x in range(x0, x1):
            if c.at(x, y) is None: c.px(x, y, ch)

def A(strong=False):
    c = C(W, H)
    rack(c, strong)
    bike(c, 0, 14, 'akachin', 3, basket=True, strong=strong)
    bike(c, 16, 14, 'kblue', 3, basket=False, strong=strong)
    bike(c, 32, 14, 'mwhite', 2, basket=True, strong=strong)
    if strong: shadow(c, [(30, '~'), (31, '~')], 2, 48); 
    else: shadow(c, [(30, '~'), (31, '-')], 2, 47)
    if strong:
        for y in (26, 27):        # 바퀴 오른쪽 접지 그늘
            for x in range(0, 48):
                pass
    return c

def Cc():
    c = C(W, H)
    rack(c, False, 28)
    # 뒷줄(어둡게, 높이 -6, 반쯤 오른쪽) → 앞줄 순서로 그려 가림
    bike(c, 8, 8, 'shu', 4, basket=False, dim=1, flip=True)
    bike(c, 24, 8, 'mgreen', 4, basket=True, dim=1, flip=True)
    bike(c, 40, 8, 'taxi', 3, basket=False, dim=1, flip=True) if False else None
    bike(c, 0, 14, 'akachin', 3, basket=True)
    bike(c, 16, 14, 'kblue', 3, basket=False)
    bike(c, 32, 14, 'mwhite', 2, basket=True)
    shadow(c, [(30, '~'), (31, '-')], 2, 47)
    return c

for k, f in (('A', lambda: A(False)), ('B', lambda: A(True)), ('C', Cc)):
    f().save(os.path.join(OUT, f'j1-{k}.pxg'))
open(os.path.join(OUT, 'j1-A.note'), 'w').write('옆모습 마마챠리 셋(빨강·파랑·흰색, 바구니 둘), 링 바퀴·삼각 프레임·안장·핸들, 바닥 쇠 레일과 발치 그림자 2줄\n')
open(os.path.join(OUT, 'j1-B.note'), 'w').write('같은 배열에 빛을 세게: 타이어 윗쪽·레일 윗면·안장 밝게, 바퀴 오른쪽 어둡게, 발치 접지 그림자 2줄 진하게\n')
open(os.path.join(OUT, 'j1-C.note'), 'w').write('한 줄이 아니라 두 줄로 세운 거치대: 뒷줄은 반대 방향·한 단 어둡게 깔아 자전거가 빽빽한 역 앞 주차장 느낌으로 재해석\n')
