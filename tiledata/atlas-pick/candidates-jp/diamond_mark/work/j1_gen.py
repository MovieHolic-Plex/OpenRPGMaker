import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../house_roof/work'))
from j1_lib import C
OUT = os.path.dirname(os.path.dirname(__file__))
W = H = 16

def asphalt(c, base=3, hi=4, lo=2):
    for y in range(H):
        for x in range(W):
            k = (x * 5 + y * 3 + (x // 4) * 2) % 13
            t = hi if k in (0, 6) else (lo if k in (3, 9) else base)
            if (x * 7 + y * 11) % 31 == 4: t = 1
            if (x * 3 + y * 5) % 37 == 9: t = 5
            c.px(x, y, 'masph', t)

def d(x, y): return abs(x - 7.5) + abs(y - 7.5)

def diamond(c, lo=7, hi=8, top=4, mid=3, low=2, hl_ul=None, gaps=()):
    for y in range(H):
        for x in range(W):
            s = d(x, y)
            if lo <= s <= hi:
                if (x, y) in gaps: continue
                # 바깥선/안쪽선: 위·왼쪽 변은 밝게, 아래·오른쪽은 어둡게(페인트 두께)
                left_up = (x + y) < 15
                t = (top if left_up else low) if s == lo else (mid if left_up else low - 0)
                if hl_ul is not None and left_up and s == lo: t = hl_ul
                c.px(x, y, 'mwhite', t)

# A
c = C(W, H); asphalt(c); diamond(c, 7, 8, 4, 3, 2); c.save(os.path.join(OUT, 'j1-A.pxg'))

# B: 센 빛 — 페인트 윗변 아주 밝게(5), 아랫변 두껍게 어두운 단(1)+아스팔트 쪽 짙은 그림자 한 줄
c = C(W, H)
asphalt(c, 2, 3, 1)
for y in range(H):
    for x in range(W):
        s = d(x, y)
        if s == 9 and (x + y) >= 15: c.px(x, y, 'masph', 0)         # 페인트 아래·오른쪽 바깥에 그늘 한 줄
        if s == 6 and (x + y) < 15: c.px(x, y, 'masph', 0)          # 안쪽 위·왼쪽 그늘
diamond(c, 7, 8, 5, 4, 2, hl_ul=5)
for y in range(H):
    for x in range(W):
        if 7 <= d(x, y) <= 8 and (x + y) >= 15 and d(x, y) == 8: c.px(x, y, 'mwhite', 1)
c.save(os.path.join(OUT, 'j1-B.pxg'))

# C: 재해석 — 닳은 흰 페인트: 꼭짓점 4곳은 온전, 변 가운데는 끊긴 점선 마름모, 안쪽 아스팔트 한 톤 어둡게(칠한 면 표시)
c = C(W, H)
asphalt(c)
for y in range(H):
    for x in range(W):
        if d(x, y) < 7: c.px(x, y, 'masph', 2 if (x + y) % 4 else 1)
gaps = {(4, 4), (11, 4), (4, 11), (11, 11), (3, 5), (12, 5), (3, 10), (12, 10)}
gaps = {(x, y) for (x, y) in gaps if 7 <= d(x, y) <= 8}
diamond(c, 7, 8, 5, 4, 3, gaps=gaps)
# 닳은 자국: 페인트 안 일부를 아스팔트 색으로
for (x, y) in ((6, 1), (9, 14), (14, 6), (1, 9)):
    if c.at(x, y) and c.at(x, y)[0] == 'mwhite': c.px(x, y, 'mwhite', 1)
c.save(os.path.join(OUT, 'j1-C.pxg'))
