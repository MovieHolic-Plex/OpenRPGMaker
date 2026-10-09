# 고대 숲 나무·큰 구조물 — 손 도트 (잎덩이 높이장 + C 볼륨 페인터 줄기)
from af_base import *
from af_base import _hash, _lumps, _floor, _FT

def _trunk(c, cx, ytop, ybot, wtop, wbot, seed, mossy=0.0):
    """줄기: 위 wtop 폭 → 아래 wbot 폭(뿌리 쪽으로 퍼짐). 세로 홈 + 이끼."""
    c.new()
    for y in range(int(ytop), int(ybot) + 1):
        t = (y - ytop) / max(1.0, ybot - ytop)
        hw = (wtop + (wbot - wtop) * (t ** 2.2)) / 2.0
        for x in range(int(cx - hw) - 1, int(cx + hw) + 2):
            dx = (x + .5 - cx) / max(.5, hw)
            if abs(dx) > 1: continue
            v = c.shade(dx * .95, .15, math.sqrt(max(.02, 1 - dx * dx)), .22)
            col = int(x - cx + 100)
            if _hash(col // 2, 0, seed) < .28: v -= .14                       # 세로 홈
            if _hash(x, y // 5, seed + 3) < .08: v += .1
            c.setv(x, y, 'bark', v)
    return c

def _root_specs(style, w):
    """뿌리 모양 변형: (방향 -1/+1, 길이, 굵기, 휨, 높이 올림). 좌우 비대칭, 나무마다 다르다."""
    S = {
     0: [(-1, .26, 4.6, 4.0, 0), (-1, .15, 3.0, -2.0, 2), (1, .13, 3.6, 3.0, 0)],               # 왼쪽으로 크게
     1: [(1, .27, 4.8, 3.0, 0), (1, .12, 3.0, -3.0, 2), (-1, .17, 3.8, 4.0, 0), (-1, .08, 2.4, 0, 3)],   # 오른쪽으로 크게 + 왼쪽 중간
     2: [(-1, .20, 4.2, -2.0, 0), (1, .22, 4.4, 2.0, 0), (1, .09, 2.6, 4.0, 3)],                # 양쪽 비슷하나 짧고 굽음
     3: [(-1, .18, 4.0, 3.0, 0), (1, .10, 3.0, 1.0, 1)],                                         # 짧은 두 가닥
    }
    return [(sg, int(w * ln), th, bend, up) for (sg, ln, th, bend, up) in S[style % 4]]

def _roots(c, cx, base, spread, n, seed, thick=4, style=None, w=96):
    """땅 위로 불룩 솟아 뻗는 뿌리: 줄기 밑에서 휘어 나가며 가늘어지고 끝은 흙 속으로 잠긴다."""
    rnd = random.Random(seed)
    specs = _root_specs(style, w) if style is not None else None
    if specs is None:
        specs = []
        for k in range(n):
            sg = -1 if k % 2 == 0 else 1
            specs.append((sg, int(rnd.uniform(spread * .5, spread)), thick * rnd.uniform(1.0, 1.5), rnd.uniform(-4, 4), (k // 2) * 1.5))
    for k, (sgn, L, th0, bend, up) in enumerate(specs):
        c.new()
        y0 = base - rnd.uniform(0, 1.5) - up
        for i in range(int(L)):
            t = i / float(L); x = cx + sgn * (4 + i)
            yc = y0 - 4.5 * math.sin(min(1.0, t * 1.5) * math.pi * .6) + bend * t * t + 4.5 * t
            tt = max(1.2, th0 * 1.45 * (1 - t) ** .7) * (1 + .15 * math.sin(i * .9 + k))
            for y in range(int(yc - tt) - 1, int(yc + tt) + 2):
                dy = (y + .5 - yc) / max(.8, tt)
                if abs(dy) > 1: continue
                v = c.shade(-sgn * .15, dy, math.sqrt(max(.02, 1 - dy * dy)), .22) + .04
                if _hash(i // 3, k, seed) < .15: v -= .1
                c.setv(int(x), y, 'bark', v)

def giant_tree(w=96, h=112, seed=1, mossy=True, roots=5, trunk_w=22, style=0):
    """거대 뿌리 나무: 수관 아래로 굵은 줄기와 지면으로 뻗는 뿌리. 바닥줄 = 줄기만 막힘(가운데 2~3칸)."""
    c = C(w, h, seed); rnd = random.Random(seed)
    cx = w / 2.0; base = h - 7
    c.shadow(cx, h - 4, w * .40, 4.5, 110)
    # 뿌리 먼저, 줄기 위에
    _roots(c, cx, base - 1, w * .44, roots, seed + 2, thick=5, style=style, w=w)
    _trunk(c, cx, h * .50, base + 1, trunk_w * .78, trunk_w * 1.7, seed + 1)
    im = fin(c, .6)
    # 줄기 이끼 (왼쪽·위쪽 먼저)
    if mossy:
        px = im.load()
        for y in range(int(h * .55), h - 8):
            for x in range(int(cx - trunk_w), int(cx + trunk_w)):
                if px[x, y][3] and vnoise(x, y, 4.0, seed + 41) > .60 and (x < cx + 3 or _hash(x, y, seed + 42) < .4):
                    t = 3 + int(vnoise(x, y, 2.0, seed + 43) * 2.5)
                    px[x, y] = tuple(LEAF[cl(t, 2, 5)]) + (255,)
    # 수관
    clumps = []
    for i in range(30):
        a = rnd.random() * math.tau; r = rnd.random() ** .55
        x = cx + math.cos(a) * r * (w * .40); y = h * .33 + math.sin(a) * r * (h * .25) - (h * .02)
        rx = rnd.uniform(11, 17); clumps.append((x, y, rx, rx * .86))
    clumps.append((cx, h * .30, w * .27, h * .22))
    cn, mk = leaf_canopy(w, int(h * .72), clumps, seed + 9, amb=.22, ramp=LEAF)
    big = Image.new('RGBA', (w, h), (0, 0, 0, 0)); big.alpha_composite(im); big.alpha_composite(cn)
    # 줄기와 수관의 접점 윤곽
    out = pz.fin(big, .6)
    return sh(out, cx, h - 4, w * .40, 4, 60) if False else out

def ancient_oak(w=64, h=80, seed=3, trunk_w=12, style=3):
    c = C(w, h, seed); rnd = random.Random(seed); cx = w / 2.0; base = h - 5
    c.shadow(cx, h - 3, w * .38, 3.5, 100)
    _roots(c, cx, base - 1, w * .38, 4, seed + 2, thick=3.4, style=style, w=w)
    _trunk(c, cx, h * .50, base + 1, trunk_w * .8, trunk_w * 1.55, seed + 1)
    im = fin(c, .6)
    clumps = []
    for i in range(18):
        a = rnd.random() * math.tau; r = rnd.random() ** .55
        x = cx + math.cos(a) * r * (w * .38); y = h * .34 + math.sin(a) * r * (h * .24)
        rx = rnd.uniform(8, 13); clumps.append((x, y, rx, rx * .86))
    clumps.append((cx, h * .32, w * .26, h * .22))
    cn, mk = leaf_canopy(w, int(h * .72), clumps, seed + 9, amb=.22)
    big = Image.new('RGBA', (w, h), (0, 0, 0, 0)); big.alpha_composite(im); big.alpha_composite(cn)
    return pz.fin(big, .6)
