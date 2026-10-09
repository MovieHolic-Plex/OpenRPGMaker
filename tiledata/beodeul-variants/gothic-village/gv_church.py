# 고딕 마을 교회(앵커 1) — 버들항 재료(castle6 마름돌·pv 박공·pj 첨탑·castle6 큰 문)로 낮 재료 조립 → gloom 등급.
# 첨탑 종탑(왼쪽) + 뾰족 박공 신랑(가운데 장미창, 뾰족 아치 창, 붉은 큰 문, 모서리 버팀벽). 결정적.
from gv_build import *

ASHS = lambda X, Y, seed=0: castle6.ash(X, Y, bw=12, bh=6, seed=seed)

def lancet(px, W, Hh, x0, y0, w, h, seed=1, lit=False):
    """뾰족 아치 창(낮 재료): 돌 테(왼쪽 밝음) + 어두운 유리 + 가운데 세로 살 + 아래 문턱. 아치는 두 원호(정삼각 아치)."""
    cx = x0 + w / 2.0; top = y0 + w * 0.9
    def inside(x, y, pad):
        if y > y0 + h + pad or x < x0 - pad or x >= x0 + w + pad: return False
        if y >= top: return y >= y0 - pad
        r = w + pad
        return math.hypot(x + 0.5 - (x0 - pad), (top - (y + 0.5))) <= r and math.hypot(x + 0.5 - (x0 + w + pad), (top - (y + 0.5))) <= r
    for y in range(int(y0 - w - 3), y0 + h + 3):
        for x in range(x0 - 2, x0 + w + 2):
            if inside(x, y, 0):
                t = 1 if y < top + 2 else (2 if (x + y) % 5 else 3)
                c = GLASS[t] if not lit else None
                if abs(x + 0.5 - cx) < 0.6 and y > top - 2: c = ST[2]
                put(px, W, Hh, x, y, c)
            elif inside(x, y, 1):
                put(px, W, Hh, x, y, ST[6] if x + 0.5 < cx else ST[3])
    for x in range(x0 - 2, x0 + w + 2): put(px, W, Hh, x, y0 + h + 1, ST[6]); put(px, W, Hh, x, y0 + h + 2, ST[3])

def rose(px, W, Hh, cx, cy, r):
    """장미창: 돌 테 + 바퀴살 여덟 + 가운데 고리, 유리는 어둡고 살은 돌빛."""
    for y in range(int(cy - r - 3), int(cy + r + 4)):
        for x in range(int(cx - r - 3), int(cx + r + 4)):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy; d = math.hypot(dx, dy)
            if d <= r:
                a = math.atan2(dy, dx); spoke = abs(math.sin(a * 4)) < 0.22 and d > 2
                c = ST[3] if (spoke or abs(d - r * 0.45) < 0.7) else GLASS[1 if dy < 0 else 2]
                if d < 1.6: c = ST[5]
                put(px, W, Hh, x, y, c)
            elif d <= r + 1.3: put(px, W, Hh, x, y, ST[6] if dx + dy < 0 else ST[3])
            elif d <= r + 2.4: put(px, W, Hh, x, y, ST[2])

def buttress(px, W, Hh, x0, w, ytop, ybot):
    """버팀벽: 벽 앞으로 튀어나온 돌 기둥(왼쪽 밝은 모, 오른쪽 그늘), 위로 두 번 물러나는 비스듬한 갓돌."""
    for y in range(ytop, ybot + 1):
        z = ybot - y
        ww = w if z < (ybot - ytop) * 0.55 else w - 2
        for x in range(x0, x0 + ww):
            c = ASHS(x * 2 + 7, y, 9)
            if x == x0: c = ST[6]
            elif x == x0 + 1: c = ST[5]
            elif x >= x0 + ww - 2: c = ST[2] if x == x0 + ww - 1 else ST[3]
            if z in (int((ybot - ytop) * 0.55), int((ybot - ytop) * 0.55) + 1): c = ST[6] if x < x0 + ww - 1 else ST[3]
            put(px, W, Hh, x, y, c)
    for x in range(x0, x0 + w - 1): put(px, W, Hh, x, ytop, ST[6]); put(px, W, Hh, x, ytop + 1, ST[4])
    for y in range(ytop + 2, ybot - 1):                                              # 버팀벽이 오른쪽 벽에 드리운 그늘
        for x in (x0 + w, x0 + w + 1):
            p = get(px, W, Hh, x, y)
            if p[3] > 200: put(px, W, Hh, x, y, mul(p, 0.78 if x == x0 + w else 0.88))

def red_door(im, x, y, w, h):
    """castle6 큰 문을 붙이고 나무 화소를 검붉은 램프로(등급 뒤 BLOOD 쯤이 되게 등급 전 색으로)."""
    d = castle6.big_door(w, h)
    def is_wood(r, g, b): return r > g + 10 and g >= b - 6
    dp = d.load()
    for yy in range(d.height):
        for xx in range(d.width):
            p = dp[xx, yy]
            if p[3] > 200 and is_wood(*p[:3]): dp[xx, yy] = ramp_fit(p, RED_D) + (255,)
    im.alpha_composite(d, (x, y))
    return d
RED_D = [hx(c) for c in ('#1e0608', '#3c0e10', '#5a1618', '#781e22', '#96282c', '#b03836', '#c85246')]

def bell_tower(seed=51, wc=3, Hb=150, sph=8):
    """종탑: 회색 마름돌 네모 탑(모서리 큰 돌·띠돌 둘), 아래 뾰족 아치 창, 가운데 긴 뾰족 창, 꼭대기 종실(쌍 뾰족 아치·종),
    처마 돌림띠 위 가파른 슬레이트 네모뿔 첨탑과 쇠 꼭지."""
    W = wc * 16; sp = pj.spire('sto', wc, sph); Hs = sp.height
    Hh = Hs - 6 + Hb; day = Image.new('RGBA', (W, Hh)); px = day.load(); y0 = Hs - 6
    for y in range(y0, Hh):
        for x in range(W):
            z = Hh - 1 - y; c = ASHS(x + seed, y, seed)
            if x < 4 or x >= W - 4:
                q = (z // 8) % 2; e = x if x < 4 else W - 1 - x
                if (q == 0 and e < 4) or (q == 1 and e < 3):
                    c = ST[6] if e == 0 and x < 4 else (ST[5] if x < 4 else ST[4])
                    if z % 8 == 7: c = ST[3]
            if z in (52, 53, 104, 105) or y in (y0 + 6, y0 + 7): c = ST[6] if z in (53, 105) or y == y0 + 6 else ST[4]
            if z in (50, 51, 102, 103) or y == y0 + 8: c = ST[3]
            if y < y0 + 6: c = ST[5] if y < y0 + 2 else (ST[4] if y < y0 + 4 else ST[3])
            if z < 3: c = ST[3] if z == 2 else ST[2]
            put(px, W, Hh, x, y, c)
    cx = W // 2
    lancet(px, W, Hh, cx - 3, Hh - 1 - 40, 6, 22, seed)
    lancet(px, W, Hh, cx - 3, Hh - 1 - 92, 6, 26, seed)
    for ox in (-10, 4):
        lancet(px, W, Hh, cx + ox, y0 + 14, 6, 12, seed)
        for y in range(y0 + 16, y0 + 26):
            for x in range(cx + ox, cx + ox + 6): put(px, W, Hh, x, y, DK[1] if y < y0 + 21 else DK[2])
        bx = cx + ox + 3
        for j in range(5):
            for i in range(-1 - j // 2, 2 + j // 2): put(px, W, Hh, bx + i, y0 + 19 + j, R('bronze')[5 if i < 0 else 3])
        for x in range(cx + ox - 1, cx + ox + 7):                                  # 종실 난간 판
            put(px, W, Hh, x, y0 + 26, ST[6]); put(px, W, Hh, x, y0 + 27, ST[3])
    day.alpha_composite(sp, (0, 0))
    return day, Hs

def church_spire(seed=61):
    """고딕 교회: 왼쪽 첨탑 종탑(3칸) + 뾰족 박공 신랑(8칸): 가파른 청회 슬레이트 지붕, 박공 장미창, 앞벽 뾰족 아치 창 둘,
    가운데 붉은 큰 문, 모서리·문 옆 버팀벽. 등급 후 밑동 이끼·빗물 얼룩."""
    NW = 128; G = 74; roofH = 2 * 16 + G; F = 70
    gable = pv.gable_end('sto', NW, roofH, G, window=False, timber=False)
    nave = Image.new('RGBA', (NW, roofH + F)); nave.alpha_composite(gable, (0, 0)); npx = nave.load()
    Hn = nave.height
    gx = NW / 2; topg = roofH - G
    for y in range(topg, roofH):                                                    # 박공 삼각 벽을 마름돌로(칩셋 박공 비늘 대신)
        half = (y - topg + 1) / G * gx
        for x in range(NW):
            dd = abs(x + 0.5 - gx)
            if dd <= half - 3: put(npx, NW, Hn, x, y, ASHS(x + 3, y, seed + 5))
            elif dd <= half - 1: put(npx, NW, Hn, x, y, ST[6] if x < gx else ST[3])     # 박공 갓돌
    for y in range(roofH, Hn):
        for x in range(NW):
            z = Hn - 1 - y; c = ASHS(x + 3, y, seed)
            if z < 3: c = ST[3] if z == 2 else ST[2]
            if y in (roofH, roofH + 1): c = ST[5] if y == roofH else ST[3]
            put(npx, NW, Hn, x, y, c)
    # 박공 벽(삼각) 가운데 장미창 + 박공 끝 돌 십자 받침 대신 갓돌 꼭지
    rose(npx, NW, Hn, NW / 2, roofH - G * 0.42, 9)
    for (bx, bw) in ((0, 8), (NW - 8, 8), (NW // 2 - 25, 7), (NW // 2 + 18, 7)):
        buttress(npx, NW, Hn, bx, bw, roofH + 14, Hn - 1)
    lancet(npx, NW, Hn, 22, roofH + 18, 9, 36, seed)
    lancet(npx, NW, Hn, NW - 31, roofH + 18, 9, 36, seed + 1)
    red_door(nave, NW // 2 - 14, Hn - 38, 20, 32)
    for x in range(NW // 2 - 17, NW // 2 + 17):                                      # 문 앞 돌 계단 한 단
        put(npx, NW, Hn, x, Hn - 3, ST[6]); put(npx, NW, Hn, x, Hn - 2, ST[4]); put(npx, NW, Hn, x, Hn - 1, ST[2])
    tower, Hs = bell_tower(seed)
    TW = tower.width
    Hh = max(tower.height, nave.height)
    day = Image.new('RGBA', (TW + NW, Hh))
    day.alpha_composite(nave, (TW, Hh - nave.height))
    day.alpha_composite(tower, (0, Hh - tower.height))
    day = ph2.volume(day, Hh - F) if False else day
    day = slate(outline_in(day))
    im = gloom(day, 0.72, 0.70); p = im.load(); W, Hh2 = im.size
    drip_stains(p, W, Hh2, 0, W, Hh2 - F + 4, Hh2 - 4, seed, 0.16, 0.24)
    moss_foot(p, W, Hh2, 0, W, Hh2 - 1, seed + 2, 9, 0.5)
    ntufts(p, W, Hh2, 0, W, Hh2 - 1, seed + 4, 0.35, 3)
    # 종실 안 희미한 등불 하나
    glow(p, W, Hh2, TW // 2 - 7, Hh2 - tower.height + Hs - 6 + 21, 4, 0.25, AMBER[5])
    return im
