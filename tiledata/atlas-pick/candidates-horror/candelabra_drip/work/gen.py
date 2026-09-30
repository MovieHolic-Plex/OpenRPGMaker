from cdl import *
def cdl(k=1):
    g = G(16, 32)
    hi, mid, lo = ('D', 'C', 'B') if k == 2 else ('C', 'B', 'A')
    # 줄기·받침 (tarn: y0 어두움 .. D 밝음)
    for y in range(15, 27): g.put(7, y, 'C' if k == 1 else 'D'); g.put(8, y, 'A' if k == 1 else 'z')
    g.pts('z', 7, 20, 7, 24) if False else None
    for y, (a, b) in ((26, (6, 9)), (27, (5, 10)), (28, (4, 11)), (29, (3, 12)), (30, (3, 12)), (31, (3, 12))):
        g.h(a, b, y, 'B')
        g.put(a, y, 'C' if k == 1 else 'D'); g.put(b, y, 'z')
    g.h(3, 12, 31, 'y' if k == 1 else 'y'); g.h(4, 11, 29, 'C' if k == 1 else 'D'); g.h(5, 10, 27, 'C' if k == 1 else 'D')
    # 팔(왼·오)
    for (x, y) in ((4, 14), (5, 15), (5, 16), (6, 16), (6, 17)): g.put(x, y, 'B')
    for (x, y) in ((11, 14), (10, 15), (10, 16), (9, 16), (9, 17)): g.put(x, y, 'z')
    g.pts('C', 4, 14, 5, 15); g.pts('A', 10, 15, 11, 14)
    g.h(6, 9, 17, 'B'); g.put(7, 17, 'C'); g.put(8, 17, 'z')
    return g
def cup(g, x, y, k):      # 2px 초 받침(폭 4)
    g.h(x - 1, x + 2, y, 'C' if k == 1 else 'D'); g.h(x - 1, x + 2, y + 1, 'A'); g.put(x + 2, y, 'z'); g.put(x - 1, y + 1, 'B')
def candle(g, x, y0, y1, k, lit=False):   # x 왼쪽열
    for y in range(y0, y1 + 1):
        g.put(x, y, 'N' if k == 1 else 'O'); g.put(x + 1, y, 'L' if k == 1 else 'K')
    g.pts('P', x, y0) if False else None
    g.pts('O' if k == 1 else 'P', x, y0, x + 1, y0) if lit else g.pts('N', x, y0, x + 1, y0)
def build(k, unlit_left=True, variant='A'):
    g = cdl(k)
    # 컵
    cup(g, 3, 13, k); cup(g, 12, 13, k) if False else None
    g.h(2, 5, 12 + 1, 'C' if k == 1 else 'D'); g.h(2, 5, 14, 'A')
    g.h(10, 13, 13, 'C' if k == 1 else 'D'); g.h(10, 13, 14, 'A')
    g.h(6, 9, 11 + 2, 'C' if k == 1 else 'D'); g.h(6, 9, 14, 'A')
    return g
def make(k, var):
    g = build(k)
    # 가운데 초: 켜짐 (y7..12), 불꽃 y3..6
    candle(g, 7, 7, 12, k, True)
    g.pts('a', 7, 7)  # 심 그을림
    flame(g, 7, 6, 0)
    # 왼쪽 초: 녹아 낮음 (y11..12) + 흐른 촛농이 컵을 타고 내려옴
    candle(g, 3, 11, 12, k)
    g.pts('O' if k == 2 else 'N', 2, 12, 2, 13) if False else None
    g.pts('M', 5, 13, 5, 14, 5, 15); g.pts('N', 5, 16) if False else None
    g.pts('M', 2, 14)
    # 오른쪽 초: 짧고 한쪽이 깎임
    candle(g, 11, 10, 12, k); g.pts('a', 12, 10) ; g.pts('M', 13, 13, 13, 14, 13, 15, 13, 16)
    return g
def floorwax(g):
    g.pts('N', 1, 30, 14, 29, 13, 31) ; g.pts('L', 1, 31) ; g.pts('M', 14, 30)
A = make(1, 'A'); floorwax(A)
A.pts('W', 5, 27, 10, 27, 4, 29) if False else None
glow(A, 7.5, 4.8, 3.2)
B = make(2, 'B'); floorwax(B); glow(B, 7.5, 4.8, 4.2)
B.pts('~', 12, 31, 13, 31, 14, 31, 15, 31, 15, 30, 13, 30) if False else None
for x in (2, 13):
    pass
B.pts('~', 10, 31, 11, 31, 12, 31, 13, 30, 12, 30)
# C: 오른쪽 가지가 부러져 촛대에 매달림, 그 초는 바닥에 누워 여전히 탄다
C = make(1, 'C')
for (x, y) in ((11, 10), (12, 10), (11, 11), (12, 11), (11, 12), (12, 12), (10, 13), (11, 13), (12, 13), (13, 13), (10, 14), (11, 14), (12, 14), (13, 14), (13, 15), (13, 16)):
    C.put(x, y, '.')
C.pts('z', 10, 15, 11, 14) if False else None
# 초는 바닥에 눕는다 (x8..15, y28..29) — 불꽃이 오른쪽 끝에서 위로
for x in range(9, 15): C.put(x, 30, 'N'); C.put(x, 31, 'L')
C.pts('O', 9, 29, 10, 29) if False else None
C.pts('M', 9, 30); C.pts('P', 14, 30)
C.pts('C', 13, 26, 13, 27) if False else None
C.pts('G', 15, 30, 15, 31); C.pts('I', 15, 31); C.pts('F', 15, 29)
C.pts('B', 11, 15, 11, 16) 
C.pts('z', 11, 16)
glow(C, 3.0, 4.8, 0) if False else None
# 가운데 불 끄기(누운 초만 켜짐) → 가운데 불꽃 제거, 그을린 심
for (x, y) in ((7, 3), (7, 4), (8, 4), (7, 5), (8, 5), (7, 6), (8, 6)): C.put(x, y, '.')
C.pts('a', 7, 6) if False else None
C.pts('a', 8, 6); C.pts('S', 8, 5)  # 꺼진 심에서 재 한 점
glow(C, 14.5, 29.5, 3.6)
notes = {'A': ('세 갈래 놋 촛대를 묵힘: 가운데 초만 불이 켜져 있고(3px 불꽃+주황 빛무리) 나머지 둘은 녹아 짧게 주저앉아 컵 옆으로 촛농이 흘러내리고 바닥에 촛농 방울', A),
         'B': ('빛 대비 강화: 불꽃 빛으로 놋 왼쪽·위가 한 단 밝고 뒷면·받침은 두 단 어둡게, 빛무리 반경을 키우고 바닥 오른쪽 접촉 그림자', B),
         'C': ('실루엣 다시 해석: 오른쪽 가지가 부러져 사라지고, 그 초는 바닥에 누운 채 여전히 탄다 — 촛대 위는 모두 꺼져 재 한 점', C)}
finish('candelabra_drip', notes, LG)
