#!/usr/bin/env python3
"""gothic_manor 오토타일·바닥 — 젖은 포석, 죽은 풀·진흙, 낙엽 길, 안개 오버레이, 이끼 돌담. flat/terrain 은 면제 종류지만 판정자 과반이 종류를 맞다고 해야 한다."""
from gx_core import *
R = Reg('terrain'); A = R.add

def cobble(c, v):
    c.R(0, 0, 16, 16, K('stone', -2))
    ys = [0, 5, 10, 15] if v % 2 == 0 else [0, 4, 9, 15]
    for r in range(3):
        y0, y1 = ys[r], ys[r + 1]; x = -((hsh(r, v, 1) % 6)); 
        while x < 16:
            bw = 5 + hsh(x, r, v) % 3
            t = (hsh(x, r, v + 5) % 3) - 1 + (1 if v == 3 and hsh(x, r) % 2 else 0)
            for yy in range(y0 + 1, y1):
                for xx in range(max(0, x + 1), min(16, x + bw)):
                    c.P(xx, yy, K('stone', t + (1 if yy == y0 + 1 else 0) - (1 if yy == y1 - 1 else 0)))
            x += bw
    for k in range(3 + v):                                            # 젖은 반사
        c.P(hsh(k, v, 3) % 16, hsh(k, v, 4) % 16, K('water', 1 + k % 2))

def mud(c, v, dead=True):
    base = 'dead' if dead else 'soil'
    for y in range(16):
        for x in range(16):
            n = hsh(x, y, v)
            t = -1 + (1 if n % 7 == 0 else 0) + (1 if n % 17 == 0 else 0) - (1 if n % 5 == 0 else 0)
            c.P(x, y, K('soil', t))
    for k in range(5 + v):                                            # 죽은 풀 가닥
        x = hsh(k, v, 8) % 15; y = hsh(k, v, 9) % 13 + 2
        c.P(x, y, K('dead', 1)); c.P(x, y - 1, K('dead', 2)); c.P(x + (k % 2 * 2 - 1), y - 2, K('dead', 3))
    for k in range(2):
        x = hsh(k, v, 12) % 13; y = hsh(k, v, 13) % 14; c.R(x, y, 3, 1, K('water', -1)); c.HL(x + 1, y + 1, 2, K('water', 0))

def leaves(c, v):
    for y in range(16):
        for x in range(16): c.P(x, y, K('soil', -1 + (hsh(x, y, v) % 9 == 0)))
    cols = ['blood', 'dead', 'wood', 'ember']
    for k in range(10 + v * 2):
        x = hsh(k, v, 20) % 14; y = hsh(k, v, 21) % 14; m = cols[k % 4]; t = 1 if k % 3 else 0
        c.R(x, y, 3, 2, K(m, t + 1) if m != 'ember' else K(m, 1)); c.P(x, y, K(m, t + 2) if m != 'ember' else K(m, 2)); c.P(x + 2, y + 1, K(m, t - 1) if m != 'ember' else K(m, 0))

def fog(c, v):
    cols = [K('fog', 0), K('fog', 1), K('fog', 2)]
    for y in range(16):
        for x in range(16):
            n = hsh(x // 2, y // 2, v + 40) % 100
            if (x + y) % 2 == 0 and n < 38 + 9 * ((y + v) % 3): c.P(x, y, cols[0 if n < 14 else 1 if n < 28 else 2])

for v in range(4):
    A('cobble-wet-%d' % v, '젖은 포석 %d' % v, 1, 1, 'flat', tags=['바닥', '포석'], rules='고딕 마을 길. 네 변형을 섞어 깐다.')(lambda c, v=v: cobble(c, v))
    A('mud-dead-%d' % v, '죽은 풀·진흙 %d' % v, 1, 1, 'terrain', tags=['바닥', '진흙', '죽은 풀'], rules='묘지·황무지 기본 땅.')(lambda c, v=v: mud(c, v))
    A('leaf-path-%d' % v, '낙엽 길 %d' % v, 1, 1, 'terrain', tags=['바닥', '낙엽'], rules='저택 진입로. 진흙 위 덧그림 또는 기본 바닥.')(lambda c, v=v: leaves(c, v))
    A('fog-%d' % v, '안개 바닥(투명 오버레이) %d' % v, 1, 1, 'flat', tags=['오버레이', '안개'], rules='맨 위 층 투명 덧그림. 점묘 체크 — 반투명 화소 없음.')(lambda c, v=v: fog(c, v))

def leaf_edge(c, m):
    """낙엽 길 가장자리 16종(N=1 E=2 S=4 W=8: 그 방향 이웃이 길이면 비트 켬). 길이 아닌 쪽은 들쭉날쭉하게 깎아 투명으로 둔다."""
    t = Cv(16, 16); leaves(t, 0)
    for y in range(16):
        for x in range(16):
            d = 99
            if not m & 1: d = min(d, y)
            if not m & 4: d = min(d, 15 - y)
            if not m & 8: d = min(d, x)
            if not m & 2: d = min(d, 15 - x)
            if d == 99 or d >= 3 + hsh(x, y, m) % 3 or (d >= 2 and hsh(x, y, 70 + m) % 2): c.a[y, x] = t.a[y, x]
for m in range(16):
    A('leaf-edge-%02d' % m, '낙엽 길 가장자리 %02d' % m, 1, 1, 'terrain', tags=['바닥', '낙엽', '오토타일'], rules='4비트 마스크(N1 E2 S4 W8, 이웃이 길이면 켬). 진흙 위 덧그림.')(lambda c, m=m: leaf_edge(c, m))

@A('wall-mossy-h', '이끼 낀 돌담(1칸 가로 이음)', 1, 1, 'structure', solid=[(0, 0)], tags=['돌담', '이끼', '담'], rules='묘지·저택 담. 가로로 잇는다.')
def _wm(c):
    c.R(0, 1, 16, 7, K('stone', 2)); c.HL(0, 1, 16, K('stone', 3)); c.HL(0, 7, 16, K('stone', 1))
    for x in range(3, 16, 6): c.VL(x, 2, 5, K('stone', 1))
    c.R(0, 8, 16, 7, K('stone', 0)); c.HL(0, 8, 16, K('stone', -2)); c.HL(0, 11, 16, K('stone', -2)); c.HL(0, 14, 16, K('stone', -2))
    for x, y in ((4, 9), (11, 9), (7, 12), (1, 12), (13, 12)): c.VL(x, y, 2, K('stone', -2))
    for x in range(16):
        if hsh(x, 1, 4) % 3: c.P(x, 2 + hsh(x, 2) % 2, K('moss', 0 + hsh(x, 3) % 2))
    for x in range(0, 16, 2): c.P(x, 8 + hsh(x, 5) % 4, K('moss', -1))
    c.HL(0, 15, 16, K('soil', -2)); c.HL(0, 0, 16, OL)

@A('wall-mossy-v', '이끼 낀 돌담(1칸 세로 이음, 윗면 띠)', 1, 1, 'structure', solid=[(0, 0)], tags=['돌담', '이끼', '담'], rules='묘지·저택 담의 세로 구간. 윗면이 두 변 보인다.')
def _wv(c):
    c.R(3, 0, 10, 16, K('stone', 2)); c.VL(3, 0, 16, K('stone', 3)); c.VL(12, 0, 16, K('stone', 1))
    for y in range(2, 16, 4): c.HL(4, y, 8, K('stone', 1)); c.HL(4, y + 1, 8, K('stone', 3))
    c.R(11, 0, 2, 16, K('stone', -1)); c.R(0, 4, 3, 12, K('stone', -2)); c.VL(0, 4, 12, K('stone', -3))
    for y in range(0, 16, 2): c.P(3 + hsh(y, 1) % 8, y, K('moss', hsh(y, 2) % 2))
    c.outline()

@A('wall-mossy-corner', '이끼 낀 돌담 모서리 기둥(1칸)', 1, 1, 'structure', solid=[(0, 0)], tags=['돌담', '이끼', '담', '모서리'], rules='가로 담과 세로 담이 만나는 곳.')
def _wc(c):
    c.R(1, 0, 14, 8, K('stone', 3)); c.HL(1, 0, 14, K('stone', 1)); c.HL(2, 2, 12, K('stone', 4)); c.HL(2, 5, 12, K('stone', 4))
    c.R(1, 8, 14, 7, K('stone', -1)); c.VL(1, 8, 7, K('stone', 1)); c.VL(14, 8, 7, K('stone', -3)); c.HL(1, 8, 14, K('stone', -3)); c.HL(1, 11, 14, K('stone', -3))
    for x in range(1, 15): 
        if hsh(x, 3) % 3: c.P(x, 9 + hsh(x, 4) % 3, K('moss', 0))
    c.HL(0, 15, 16, K('soil', -2)); c.outline()

@A('stone-coffin', '석관(뚜껑 반쯤 밀림, 어두운 틈)', 2, 1, 'box', solid=[(0, 0), (1, 0)], tags=['석관', '묘지', '폐허'], rules='묘소 안·폐허.')
def _sc(c):
    c.R(1, 2, 30, 9, K('stone', -1)); c.R(1, 1, 30, 4, K('shadow', 1))
    c.R(3, 4, 24, 7, K('stone', 3)); c.HL(3, 4, 24, K('stone', 1)); c.HL(4, 6, 22, K('stone', 4)); c.HL(4, 8, 22, K('stone', 4)); c.HL(3, 10, 24, K('stone', 0))
    c.R(1, 11, 30, 4, K('stone', -2)); c.VL(1, 11, 4, K('stone', 0)); c.HL(1, 14, 30, K('stone', -3)); c.R(13, 6, 2, 4, K('stone', -3))
    [c.P(2 + i, 11 + hsh(i, 3) % 2, K('moss', hsh(i, 4) % 2)) for i in range(12) if c.has(2 + i, 11 + hsh(i, 3) % 2)]; c.HL(0, 15, 32, K('soil', -2)); c.outline()

if __name__ == '__main__':
    m, ims = R.export(); sheet([i for _, i in ims], os.path.join(OUT, 'terrain', 'preview', '_all-x4.png'), W=200, z=5); print(len(m), 'items')
