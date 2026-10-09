

# ---------------------------------------------------------------- 절벽 벽화(절벽 앞면에 얹는 덧그림): 바랜 붉은 흙·흰 흙·숯 무늬
def cliff_paint():
    W, Hh = 48, 32
    im = blank(W, Hh); px = im.load()
    OC = [RGB('ochre', t) for t in range(7)]; CR = [RGB('cream', t) for t in range(7)]; CHc = [RGB('char', t) for t in range(7)]
    def dot(x, y, col, a=225):
        if H(x, y, 1201) > 0.12: put(px, W, Hh, x, y, col, a)             # 바래서 군데군데 빠짐
    # 겹동그라미(왼쪽)
    for r, col in ((5.5, OC[4]), (3.5, OC[3]), (1.4, OC[4])):
        n = int(r * 7)
        for i in range(n):
            a = i / n * 6.283; dot(int(round(9 + math.cos(a) * r)), int(round(14 + math.sin(a) * r * 0.85)), col)
    # 지그재그 띠 두 줄(가운데)
    for i in range(20):
        dot(18 + i, 9 - abs((i % 4) - 2), OC[4]); dot(18 + i, 21 - abs((i % 6) - 3), CR[5])
    # 점 격자(오른쪽 위)
    for j in range(3):
        for i in range(4): dot(39 + i * 2, 5 + j * 2, OC[3])
    # 숯 점 무리(오른쪽 아래, 비스듬한 두 줄)
    for k in range(5):
        dot(37 + k * 2, 18 + k, CHc[1]); dot(38 + k * 2, 22 + k, CHc[1])
    # 흰 흙 고리 + 가운데 점(가운데 아래)
    for i in range(22):
        a = i / 22 * 6.283; dot(int(round(28 + math.cos(a) * 3.6)), int(round(14 + math.sin(a) * 3.0)), CR[5])
    dot(28, 14, CR[6]); dot(27, 14, CR[5])
    return im


# ---------------------------------------------------------------- 계곡 어귀 표지 돌탑: 현무암 덩이를 쌓고 붉은 띠를 칠했다, 꼭대기에 뿔
def ochre_cairn():
    W, Hh = 16, 40
    c = C(W, Hh, seed=1211); c.shadow(8, 37, 7, 1.8, 100)
    for k, (cy, rx, ry) in enumerate(((33, 6.6, 3.6), (27.5, 5.6, 3.2), (22.5, 4.8, 2.9), (18, 4.0, 2.6), (14, 3.2, 2.2))):
        c.group(k); c.new(); c.ellipsoid(8 + (0.6 if k % 2 else -0.4), cy, rx, ry, 'basalt', amb=0.24, bias=0.12, bump=0.4)
        for x in range(int(8 - rx) + 1, int(8 + rx)):
            y = int(cy + ry * 0.3)
            if k in (1, 3) and c.m[y][x] == 'basalt': c.tone(x, y, 'ochre', 4 if x < 8 else 3)
    c.group(9)
    for sgn in (-1, 1):                                     # 꼭대기 짐승 뿔 한 쌍
        c.new()
        for i in range(8):
            f = i / 7.0; x = 8 + sgn * (1 + f * 3.4); y = 12 - f * 7 + f * f * 2
            c.tone(int(round(x)), int(round(y)), 'ivory', 5 if sgn < 0 else 4)
            if f < 0.5: c.tone(int(round(x)) + 1, int(round(y)), 'ivory', 3)
    im = F(c); px = im.load(); tufts(px, W, Hh, 1, 15, 38, 1212, 0.5, 2)
    return im
