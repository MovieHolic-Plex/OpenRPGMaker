from cdl import *
def puddle(g, k, x0, x1, y, deep=True):
    g.h(x0, x1, y, 'N' if k == 1 else 'O'); g.h(x0 + 1, x1 - 1, y + 1, 'L' if k == 1 else 'K')
    g.put(x0, y + 1, 'M'); g.put(x1, y + 1, 'M')
def cn(g, x, top, bot, k, lit):
    for y in range(top, bot + 1):
        g.put(x, y, 'N' if k == 1 else 'O'); g.put(x + 1, y, 'L' if k == 1 else 'K')
    g.put(x, top, 'P' if lit else 'N'); g.put(x + 1, top, 'O' if lit else 'M')
    if lit: flame(g, x, top - 1, 0)
    else: g.pts('a', x + 1, top - 1) if False else g.put(x + 1, top - 1, 'a')
def drip(g, x, y0, y1):
    for y in range(y0, y1 + 1): g.put(x, y, 'M')
def A(k):
    g = G(16, 16)
    puddle(g, k, 1, 14, 14); g.h(3, 12, 15, 'M')
    cn(g, 2, 9, 14, k, False); drip(g, 4, 10, 12) if False else None
    cn(g, 6, 7, 14, k, True)
    cn(g, 10, 10, 14, k, True)
    cn(g, 13, 12, 14, k, False)
    drip(g, 4, 11, 13); drip(g, 12, 11, 13)
    return g
gA = A(1); glow(gA, 7, 5, 3.2); glow(gA, 11, 8, 2.6)
gB = A(2); glow(gB, 7, 5, 4.4); glow(gB, 11, 8, 3.6)
# B: 바닥 오른쪽 아래 접촉 그림자 (반투명)
for x in range(8, 15): gB.put(x, 15, '~') if gB.get(x, 15) == '.' else None
# C: 초 하나가 얼굴처럼: 가운데 큰 초에 눈 두 점이 촛농 속에, 불꽃 하나만 서 있고 나머지 초는 쓰러진 채
def C():
    g = G(16, 16)
    puddle(g, 1, 1, 14, 14); g.h(3, 12, 15, 'M')
    # 한 줄로 늘어선 짧은 초 다섯 (모두 꺼짐), 가운데 하나만 서서 탄다
    for x, t in ((1, 12), (4, 11), (10, 11), (13, 12)):
        cn(g, x, t, 14, 1, False)
    for y in range(7, 15):
        g.put(6, y, 'N'); g.put(7, y, 'N'); g.put(8, y, 'L'); g.put(9, y, 'K')
    g.put(6, 7, 'P'); g.put(7, 7, 'P'); g.put(8, 7, 'O'); g.put(9, 7, 'N')
    flame(g, 7, 6, 0)
    g.put(6, 10, 'a'); g.put(9, 10, 'a'); g.put(6, 11, 'M'); g.put(9, 11, 'M')
    return g
gC = C(); glow(gC, 7.5, 4.5, 3.6)
notes = {'A': ('바닥에 직접 세운 초 넷(높이 제각각): 둘은 켜져 주황 빛무리, 둘은 꺼져 그을린 심, 촛농이 고여 옆으로 흘러내림 — candelabra_drip 과 같은 불꽃·초 색', gA),
         'B': ('빛 대비 강화: 빛무리를 크게, 초 몸통의 왼쪽·위를 한 단 밝고 오른쪽을 어둡게, 바닥 오른쪽 아래에 반투명 접촉 그림자', gB),
         'C': ('실루엣 재해석: 초 하나만 곧게 서서 타고 나머지 넷은 꺼져 낮게 늘어섰다 — 서 있는 초의 몸통 촛농에 눈처럼 파인 두 점', gC)}
finish('candle_floor', notes, LG)
