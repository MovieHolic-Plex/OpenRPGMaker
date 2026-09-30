import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from j2_lib import Cv
from j2_small import outline, save, box

def bell(c, cx, y, w, h, hi=4):
    """방울(청동 kasa)."""
    for j in range(h):
        ww = w if j > 1 else w - 2
        x = cx - ww // 2
        c.rect(x, y + j, ww, 1, 'kasa:3')
        c.px(x, y + j, f'kasa:{hi}'); c.px(x + ww - 1, y + j, 'kasa:2')
    c.h_(cx - w // 2 + 1, y + h - 2, w - 2, 'kasa:1')
    c.px(cx - 1, y + h - 1, 'kasa:0'); c.px(cx, y + h - 1, 'kasa:0')
    c.px(cx - w // 2 + 1, y + 2, 'kasa:4')

def rope(c, x, y0, y1, wd=2, hi='shu:4', lo='washi:4', sh='shu:2', sl='washi:2', step=2):
    for y in range(y0, y1):
        a = ((y - y0) // step) % 2 == 0
        for k in range(wd):
            c.px(x + k, y, (hi if a else lo) if k == 0 else (sh if a else sl))
    # 꼬임: 사선 어긋남
    for y in range(y0, y1, 4):
        c.px(x, y, 'washi:5' if not (((y - y0)//step) % 2 == 0) else 'shu:5')

def slat_top(c, x, y, w, h, bar, gap, edge):
    c.rect(x, y, w, h, f'mwood:{bar}')
    for i in range(x + 2, x + w - 1, 3):
        c.v_(i, y, h, f'mwood:{gap}')
    c.h_(x, y, w, f'mwood:{edge}')

def gold_row(c, x, y, n, sp=3, hi='myellow:4', lo='myellow:2'):
    for i in range(n):
        c.px(x + i * sp, y, hi); c.px(x + i * sp + 1, y, hi)
        c.px(x + i * sp, y + 1, lo); c.px(x + i * sp + 1, y + 1, lo)

def A():
    c = Cv(32, 32)
    # 상자 앞면
    box(c, 3, 19, 26, 11, 'mwood', 3, lit=1, top=0, dark=1, bot=1)
    for x in (9, 15, 21): c.v_(x, 20, 9, 'mwood:2')                    # 판자 이음
    c.h_(3, 19, 26, 'mwood:1')                                         # 윗변 어두운 틈
    c.h_(4, 20, 24, 'mwood:4')
    # 윗면 창살(3px 띠)
    slat_top(c, 2, 15, 28, 4, 4, 1, 5)
    c.h_(2, 18, 28, 'mwood:2')
    c.v_(29, 15, 4, 'mwood:2'); c.v_(2, 15, 4, 'mwood:5')
    # 금 봉납 점
    gold_row(c, 8, 24, 4, 5)
    c.h_(6, 23, 20, 'mwood:1'); c.h_(6, 27, 20, 'mwood:4')
    # 방울줄
    bell(c, 16, 0, 8, 7)
    rope(c, 15, 7, 16, 2)
    c.rect(14, 15, 4, 1, 'washi:3')
    outline(c, {'mwood': 0, 'kasa': 0, 'shu': 1, 'washi': 1, 'myellow': 0}, keys=('mwood', 'kasa', 'shu', 'washi'))
    for y in range(20, 32):
        for x in (30, 31):
            if c.get(x, y) is None and y > 22 + (x - 30): c.px(x, y, '~' if x == 30 else '-')
    for x in range(5, 32):
        for y in (30, 31):
            if c.get(x, y) is None: c.px(x, y, '~' if y == 30 else '-')
    return c

def B():
    c = Cv(32, 32)
    box(c, 3, 19, 26, 11, 'mwood', 2, lit=2, top=0, dark=1, bot=1)
    c.rect(4, 20, 3, 9, 'mwood:3')                                       # 왼쪽 빛 든 면
    for x in (9, 15, 21): c.v_(x, 20, 9, 'mwood:1')
    for x in (10, 16, 22): c.v_(x, 20, 9, 'mwood:3')
    c.h_(3, 19, 26, 'mwood:0'); c.h_(4, 20, 24, 'mwood:4')
    c.rect(22, 20, 6, 9, 'mwood:1'); c.v_(21, 20, 9, 'mwood:0')          # 오른쪽 그늘
    slat_top(c, 2, 15, 28, 4, 5, 1, 5)
    c.h_(2, 18, 28, 'mwood:1'); c.v_(29, 15, 4, 'mwood:1'); c.v_(2, 15, 4, 'mwood:5')
    gold_row(c, 8, 24, 4, 5, hi='myellow:5', lo='myellow:3')
    c.h_(6, 23, 20, 'mwood:0'); c.h_(6, 27, 20, 'mwood:4')
    bell(c, 16, 0, 8, 7, hi=4)
    c.px(14, 3, 'kasa:4'); c.px(14, 4, 'kasa:4')
    rope(c, 15, 7, 16, 2, hi='shu:5', lo='washi:5', sh='shu:2', sl='washi:2')
    c.rect(14, 15, 4, 1, 'washi:3')
    outline(c, {'mwood': 0, 'kasa': 0, 'shu': 0, 'washi': 0}, keys=('mwood', 'kasa', 'shu', 'washi'))
    # 금점 반짝 (%)
    for (x, y) in ((7, 24), (12, 23)): c.px(x, y, '%') if c.get(x, y) is None else None
    for x in range(4, 32):
        for y, t in ((30, '~'), (31, '~')):
            if c.get(x, y) is None: c.px(x, y, t)
    for y in range(21, 30):
        if c.get(30, y) is None: c.px(30, y, '~')
        if c.get(31, y) is None: c.px(31, y, '-')
    return c

def C():
    c = Cv(32, 32)
    # 좁고 높은 궤 + 넓게 튀어나온 처마 뚜껑 + 큰 방울
    box(c, 7, 17, 18, 13, 'mwood', 3, lit=1, top=0, dark=1, bot=1)
    for x in (13, 19): c.v_(x, 18, 11, 'mwood:2')
    c.rect(7, 27, 18, 3, 'mwood:2'); c.h_(7, 27, 18, 'mwood:4')          # 받침 단
    c.h_(7, 26, 18, 'mwood:1')
    slat_top(c, 4, 11, 24, 6, 4, 1, 5)
    c.h_(4, 16, 24, 'mwood:2'); c.v_(27, 11, 6, 'mwood:2'); c.v_(4, 11, 6, 'mwood:5')
    c.h_(5, 17, 22, 'mwood:1')
    gold_row(c, 11, 21, 3, 4, hi='myellow:4', lo='myellow:2')
    gold_row(c, 12, 23, 2, 6, hi='myellow:3', lo='myellow:1')
    bell(c, 16, 0, 10, 6)
    rope(c, 14, 6, 12, 3, step=2)
    c.rect(13, 11, 5, 1, 'washi:3')
    outline(c, {'mwood': 0, 'kasa': 0, 'shu': 1, 'washi': 1}, keys=('mwood', 'kasa', 'shu', 'washi'))
    for x in range(8, 32):
        for y in (30, 31):
            if c.get(x, y) is None: c.px(x, y, '~' if y == 30 else '-')
    for y in range(19, 30):
        if c.get(25, y) is None: c.px(25, y, '~')
    return c

N = {'A': '강남 결: 나무 궤 앞면 3단·윗면 창살 띠·금색 봉납 점, 위에서 늘어진 붉고 흰 줄과 청동 방울, 오른쪽 아래 ~/- 그림자.',
     'B': '입체 강화: 왼쪽 빛면과 오른쪽 그늘면 폭을 크게, 윗면 밝게, 금점 %, 바닥 그림자 ~ 두 줄 + 오른쪽 그늘.',
     'C': '실루엣 재해석: 좁고 높은 궤 위에 넓게 튀어나온 뚜껑, 굵은 줄과 큰 방울 — 방울이 주인공인 세로 실루엣.'}
if __name__ == '__main__':
    for L, f in (('A', A), ('B', B), ('C', C)): save(f(), 'saisen_box', L, N[L])
