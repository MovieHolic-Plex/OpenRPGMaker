import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from j2_lib import Cv
from j2_small import outline, save, box

def xsign(c, x, y, w, h, th=3, ya='myellow:3', yb='myellow:2', k='sumi:1', hi='myellow:4', stripe=2):
    """X 표지: 노랑·검정 사선 줄무늬 판 두 장."""
    for plank in (0, 1):
        for i in range(w):
            t = i / (w - 1)
            yy = y + round((t if plank == 0 else 1 - t) * (h - th))
            for j in range(th):
                blk = ((i // stripe) % 2 == 0)
                key = k if blk else (hi if j == 0 else ya if j < th - 1 else yb)
                c.px(x + i, yy + j, key)

def lamp(c, cx, cy, lit, r=2.4, hood=True):
    if lit:
        c.ell(cx, cy, r, r, 'shu:4'); c.px(int(cx) - 1, int(cy) - 1, 'shu:5'); c.px(int(cx), int(cy) - 1, 'shu:5')
    else:
        c.ell(cx, cy, r, r, 'shu:2'); c.px(int(cx) - 1, int(cy) - 1, 'shu:3')
    if hood:
        c.h_(int(cx - r) - 0, int(cy - r) - 1, int(2 * r) + 1, 'sumi:1')

def bar(c, x0, x1, y, th, a='shu:4', b='washi:4', ash='shu:2', bsh='washi:2', seg=3, slope=0, top='washi:5'):
    for x in range(x0, x1 + 1):
        yy = y - int((x - x0) * slope)
        on = ((x - x0) // seg) % 2 == 0
        for j in range(th):
            col = (a if on else b) if j < th - 1 else (ash if on else bsh)
            c.px(x, yy + j, col)
        c.px(x, yy, (('shu:5') if on else top))

def pole(c, x, y0, y1, w, tones):
    c.rect(x, y0, w, y1 - y0, f'pole:{tones[1]}')
    c.v_(x, y0, y1 - y0, f'pole:{tones[0]}'); c.v_(x + w - 1, y0, y1 - y0, f'pole:{tones[2]}')

def base_box(c, x, y, w, h, A2=False):
    c.rect(x, y, w, h, 'sumi:3')
    for i in range(0, w + h, 4):
        for j in range(h):
            xx = x + i - j
            if x <= xx < x + w: 
                for k in range(2):
                    if x <= xx + k < x + w: c.px(xx + k, y + j, 'myellow:3')
    c.h_(x, y, w, 'myellow:4'); c.v_(x + w - 1, y, h, 'myellow:1'); c.h_(x, y + h - 1, w, 'myellow:1'); c.v_(x, y, h, 'myellow:4')

def shadow(c, x0, x1, y, rows=2):
    for r in range(rows):
        for x in range(x0 + r, x1 + 1):
            if c.get(x, y + r) is None: c.px(x, y + r, '~' if r == 0 else '-')

def A():
    c = Cv(32, 48)
    pole(c, 6, 17, 42, 4, (5, 4, 2))
    xsign(c, 0, 1, 16, 14)
    lamp(c, 4.5, 20, True); lamp(c, 11.5, 20, False)
    c.rect(2, 17, 11, 1, 'sumi:1')
    c.rect(4, 33, 8, 2, 'sumi:2')                          # 바 축 상자
    bar(c, 10, 31, 30, 4)
    c.rect(9, 29, 3, 6, 'pole:3'); c.v_(9, 29, 6, 'pole:5'); c.v_(11, 29, 6, 'pole:2')
    base_box(c, 3, 40, 10, 6)
    outline(c, {'pole': 1, 'shu': 1, 'washi': 1, 'sumi': 0, 'myellow': 0}, keys=('pole', 'shu', 'washi'))
    shadow(c, 4, 20, 46)
    return c

def B():
    c = Cv(32, 48)
    pole(c, 6, 17, 42, 4, (5, 4, 1))
    xsign(c, 0, 1, 16, 14, ya='myellow:4', yb='myellow:1', k='sumi:0', hi='myellow:5')
    lamp(c, 4.5, 20, True); lamp(c, 11.5, 20, False)
    for (x, y) in ((1, 20), (8, 20), (4, 17), (4, 23)): c.px(x, y, '%') if c.get(x, y) is None else None
    c.rect(2, 17, 11, 1, 'sumi:0')
    c.rect(4, 33, 8, 2, 'sumi:1')
    bar(c, 10, 31, 30, 4, a='shu:4', b='washi:5', ash='shu:1', bsh='washi:1', top='washi:5')
    c.rect(9, 29, 3, 6, 'pole:3'); c.v_(9, 29, 6, 'pole:5'); c.v_(11, 29, 6, 'pole:1')
    base_box(c, 3, 40, 10, 6)
    outline(c, {'pole': 0, 'shu': 0, 'washi': 0, 'sumi': 0}, keys=('pole', 'shu', 'washi'))
    shadow(c, 5, 31, 46, 2)
    for x in range(14, 32):
        if c.get(x, 34) is None: c.px(x, 34, '~')
    for x in range(21, 32):
        if c.get(x, 35) is None: c.px(x, 35, '-')
    return c

def C():
    c = Cv(32, 48)
    # 열림 상태: 차단봉이 오른쪽 위로 비스듬히 선 실루엣, 표지는 좁고 높게(세로 X), 등이 위에 가로로
    pole(c, 5, 12, 42, 5, (5, 4, 2))
    xsign(c, 2, 0, 11, 16, th=3, stripe=2)
    c.rect(1, 17, 13, 3, 'sumi:2'); c.h_(1, 17, 13, 'sumi:3')
    lamp(c, 4.5, 22, True, hood=False); lamp(c, 10.5, 22, False, hood=False)
    c.rect(8, 33, 3, 4, 'pole:3')
    bar(c, 10, 30, 34, 4, seg=3, slope=0.55)
    c.rect(7, 32, 5, 8, 'pole:3'); c.v_(7, 32, 8, 'pole:5'); c.v_(11, 32, 8, 'pole:1')
    base_box(c, 2, 40, 12, 6)
    outline(c, {'pole': 1, 'shu': 1, 'washi': 1, 'sumi': 0}, keys=('pole', 'shu', 'washi'))
    shadow(c, 3, 22, 46)
    return c

N = {'A': '강남 결: 노랑·검정 사선 X 표지, 붉은 등 둘(한 쪽 점등), 붉고 흰 차단봉이 옆 칸까지 가로로, 노랑·검정 줄무늬 받침, 오른쪽 아래 그림자.',
     'B': '입체 강화: 기둥 왼쪽 밝고 오른쪽 어둡게, 표지 진한 줄무늬, 점등 등 주변 % 번짐, 차단봉 아래 ~ 그늘 + 바닥 그림자.',
     'C': '실루엣 재해석: 열린 상태 — 차단봉이 오른쪽 위로 비스듬히 서고 표지는 좁고 높은 X, 등은 표지 아래 가로 판에.'}
if __name__ == '__main__':
    for L, f in (('A', A), ('B', B), ('C', C)): save(f(), 'railway_crossing', L, N[L])
