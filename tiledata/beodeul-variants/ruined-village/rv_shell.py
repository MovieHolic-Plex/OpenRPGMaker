# 지붕이 타 버린 돌 껍데기(불탄 민가·교회 신랑)와 꼭대기가 무너진 종탑 — 3/4 시점.
# 앞벽(바깥면, 버들항 돌 벽 칸 질감) 위로 벽 두께 윗면, 그 너머로 집 안 바닥(재·숯 들보)과 맞은편 뒷벽 안쪽 면이 보인다.
# 뒷벽 창 구멍으로는 집 뒤 풀밭이 비친다(속이 빈 폐허로 읽힌다). 옆벽은 윗면 띠만 보인다(3/4: 옆면 없음).
from rv_base import *

def _walltex(st, W, Hh, seed=0):
    if st == 'ash':     # 창백한 성 마름돌(초원 하이로드 망루와 같은 돌)
        im = Image.new('RGBA', (W, Hh)); p = im.load()
        for y in range(Hh):
            for x in range(W): p[x, y] = castle6.ash(x + seed * 11, y, bw=16, bh=8, seed=seed) + (255,)
        return im
    return pj.tex(st + '.wall', W, Hh)

def _jag(n, base, amp, seed, sc=5, steps=4):
    """높이 열(반 돌 단위로 계단꼴): 부드러운 잡음 + 4화소 단위로 끊는다."""
    out = []
    for x in range(n):
        v = base(x) + (vnoise(x, 0, sc, seed) - 0.5) * 2 * amp
        out.append(int(v // steps * steps + (2 if H(x // 4, seed) > 0.5 else 0)))
    return out

def lancet(px, W, Hh, cx, yb, w, h, fill, rim=None):
    """첨두 아치 창 구멍: fill(x,y)->색. rim: 테 돌 색 (밝은 왼쪽, 어두운 오른쪽)."""
    r = w / 2.0
    for y in range(int(yb - h - 1), int(yb) + 1):
        for x in range(int(cx - r) - 2, int(cx + r) + 2):
            dx = x + 0.5 - cx; z = yb - y
            za = h - r
            inner = abs(dx) < r and (z < za or (abs(dx) + 0.6 * (z - za)) < r)
            ring = (not inner) and abs(dx) < r + 1.6 and (z < za + 1 or (abs(dx) + 0.6 * (z - za)) < r + 1.6) and z >= -0.5
            if inner: put(px, W, Hh, x, y, fill(x, y))
            elif ring and rim: put(px, W, Hh, x, y, rim[0] if dx < 0 else rim[1])

def shell(W, front_h, D, back_h, st='sto', seed=1, burnt=True, fwins=(), bwins=(), door=None, beams=(), posts=(), soot_k=0.75,
          side_l=True, side_r=True, ivy=(), weeds_top=True, chevrons=(), rose=None, cross=None):
    """beams: (ax, ady, bx, bdy, th) 바닥 위 쓰러진 들보 — dy 는 바닥 뒤끝(yfloor)에서 앞쪽으로. posts: (x, 높이, lean) 앞벽 땅선 기준.
    chevrons: (d, cut) 앞 박공 윤곽을 d px 뒤(위)로 민 숯 서까래 — cut='l'/'r' 이면 그쪽 반이 부러졌다."""
    """front_h, back_h: 열마다 남은 벽 높이(px). D: 바닥 깊이(px). 그림 바닥 = 앞벽 땅선."""
    top_pad = 6
    Hh = max(max(back_h) + D, max(front_h)) + top_pad + 3
    im = Image.new('RGBA', (W, Hh)); px = im.load()
    yb = Hh - 1                         # 앞벽 땅선
    yfloor = yb - D                     # 바닥 뒤 끝(뒷벽 밑)
    tex = _walltex(st, W, Hh + 64, seed).load()
    tk = 3                              # 벽 두께(윗면 띠)
    # --- 뒷벽 안쪽 면 + 윗면
    for x in range(W):
        hb = back_h[x]
        for y in range(yfloor - hb - tk, yfloor + 1):
            if y < 0: continue
            if y < yfloor - hb:   # 윗면 띠
                c = ST[6] if y == yfloor - hb - tk else ST[5]
                if st != 'ash': c = mul(tex[x, 40], 1.25) if y > yfloor - hb - tk else mul(tex[x, 41], 1.4)
            else:
                c = mul(tex[x, (y + 13) % (Hh + 64)], 0.62)             # 안쪽 면: 그늘(빛은 왼쪽 위 — 안쪽 면은 북쪽 벽의 남면이라 반쯤 밝다)
                if y > yfloor - 4: c = mul(c, 0.7)                     # 밑동 그늘
            put(px, W, Hh, x, y, c)
    # 뒷벽 창: 뒤 풀밭이 비친다
    for (cx, z0, w, h) in bwins:
        lancet(px, W, Hh, cx, yfloor - z0, w, h, lambda x, y: LAWN[2] if H(x, y, seed) > 0.25 else LAWN[1] if (y + x) % 3 else LAWN[4], (mul(tex[0, 0], 0.85), mul(tex[0, 0], 0.45)))
    # --- 바닥(재 · 숯)
    for y in range(yfloor + 1, yb + 1):
        for x in range(W):
            f = (y - yfloor) / max(1, D)
            if burnt:
                c = ASH[2 + int(f * 2.2 + (H(x // 2, y // 2, seed + 3) - 0.5) * 1.4)] if H(x, y, seed + 4) > 0.12 else CH[2]
            else:
                c = ROT[2 + int(f * 2)]
            if H(x // 3, y // 2, seed + 5) > 0.9: c = mul(tex[x, y % 40], 0.8)          # 떨어진 돌
            put(px, W, Hh, x, y, c)
    # 바닥 위 숯 들보(안에 쓰러진 것) — 앞벽보다 먼저(앞벽이 가린다)
    for (ax, ady, bx, bdy, th) in beams:
        ay, by = yfloor + ady, yfloor + bdy
        n = int(math.hypot(bx - ax, by - ay)) + 1
        for i in range(n):
            x = ax + (bx - ax) * i / n; y = ay + (by - ay) * i / n
            for j in range(th):
                put(px, W, Hh, int(x), int(y) + j, CH[4] if j == 0 else (CH[2] if j < th - 1 else CH[1]))
            if H(i, seed, 9) > 0.85: put(px, W, Hh, int(x), int(y), (240, 120, 40))            # 남은 불씨
    # --- 옆벽 윗면 띠(뒷벽 윗선 → 앞벽 윗선)
    for side, xs in (('l', range(0, 4)), ('r', range(W - 4, W))):
        if (side == 'l' and not side_l) or (side == 'r' and not side_r): continue
        for x in xs:
            ytop = yfloor - back_h[x] - tk; ybot = yb - front_h[x]
            for y in range(ytop, ybot):
                c = ST[5] if (x - xs.start) in (0, 1) else ST[4]
                if st != 'ash': c = mul(tex[x, y % 60], 1.15 if x - xs.start < 2 else 0.95)
                put(px, W, Hh, x, y, c)
    # 위로 솟은 숯 서까래·기둥(지붕 뼈대)
    # 숯 서까래(박공 윤곽을 따라 뒤로 겹겹이) — 지붕이 타고 뼈대만 남았다
    for (d, cut) in chevrons:
        for x in range(1, W - 1):
            if cut == 'l' and x < W * (0.25 + 0.2 * H(d, seed)): continue
            if cut == 'r' and x > W * (0.75 - 0.2 * H(d, seed)): continue
            y = yb - front_h[x] - 3 - d - 2
            t = 5 if x < W / 2 else 3
            put(px, W, Hh, x, y, CH[t]); put(px, W, Hh, x, y + 1, CH[t - 1]); put(px, W, Hh, x, y + 2, CH[1])
            if H(x, d, seed + 13) > 0.97: put(px, W, Hh, x, y, (236, 110, 36))
        if cut:
            xe = int(W * (0.25 + 0.2 * H(d, seed))) if cut == 'l' else int(W * (0.75 - 0.2 * H(d, seed)))
            ye = yb - front_h[xe] - 3 - d - 2
            for j in range(3): put(px, W, Hh, xe + (j if cut == 'r' else -j), ye + 1 + j, CH[4 - j])    # 처진 끝
    for (x, hgt, lean) in posts:
        y1 = yb - front_h[min(W - 1, max(0, x))] + 2; y0 = yb - hgt
        for y in range(y0, y1):
            xx = int(round(x + (y1 - y) * lean))
            put(px, W, Hh, xx, y, CH[5]); put(px, W, Hh, xx + 1, y, CH[3]); put(px, W, Hh, xx + 2, y, CH[1])
        put(px, W, Hh, int(round(x + (y1 - y0) * lean)), y0, CH[6])
    # --- 앞벽 바깥면
    for x in range(W):
        hf = front_h[x]
        for y in range(yb - hf - tk, yb + 1):
            if y < yb - hf:                                 # 깨진 윗면(두께)
                c = ST[6] if y == yb - hf - tk else ST[5]
                if st != 'ash': c = mul(tex[x, 44], 1.35) if y == yb - hf - tk else mul(tex[x, 45], 1.15)
            else:
                c = tex[x, (y + 7) % (Hh + 64)]
                z = yb - y
                if z < 3: c = mul(c, 0.82)                  # 밑단
            put(px, W, Hh, x, y, c)
    # 앞벽 창·문
    for (cx, z0, w, h) in fwins:
        lancet(px, W, Hh, cx, yb - z0, w, h, lambda x, y: DK[2] if (yb - z0 - y) > 3 else mix(DK[3], ASH[3], 0.5), (mul(tex[3, 3], 1.3), mul(tex[3, 3], 0.6)))
        if burnt: soot(px, W, Hh, int(cx - w / 2), int(cx + w / 2) + 1, yb - z0 - h - 16, yb - z0 - h + 3, seed + int(cx), soot_k, up=True)
    if door:
        cx, w, h = door
        lancet(px, W, Hh, cx, yb, w, h, lambda x, y: DK[1] if (yb - y) > 2 else ASH[2], (mul(tex[3, 3], 1.35), mul(tex[3, 3], 0.55)))
        if burnt: soot(px, W, Hh, int(cx - w / 2), int(cx + w / 2) + 1, yb - h - 18, yb - h + 3, seed + 3, soot_k, up=True)
    if rose:                                              # 장미창 구멍(돌 테 + 바퀴살 잔해, 속은 숯 어둠)
        rx_, rz, rr = rose; ry_ = yb - rz
        for y in range(int(ry_ - rr - 2), int(ry_ + rr + 3)):
            for x in range(int(rx_ - rr - 2), int(rx_ + rr + 3)):
                d = math.hypot(x + 0.5 - rx_, y + 0.5 - ry_)
                if d < rr - 1.5:
                    ang = math.atan2(y + 0.5 - ry_, x + 0.5 - rx_)
                    spoke = (abs(((ang / (math.pi / 4)) % 1) - 0.5) > 0.42) and d > 2 and H(int((ang + 4) * 4 / math.pi), seed) > 0.35
                    put(px, W, Hh, x, y, mul(tex[x, 30], 0.9) if spoke else (DK[1] if d > 2 else mul(tex[x, 30], 0.9)))
                elif d < rr + 1.2:
                    put(px, W, Hh, x, y, mul(tex[x, 31], 1.3) if (x + 0.5 < rx_ or y + 0.5 < ry_) else mul(tex[x, 31], 0.55))
        if burnt: soot(px, W, Hh, int(rx_ - rr), int(rx_ + rr) + 1, int(ry_ - rr - 10), int(ry_ - rr + 3), seed + 5, soot_k * 0.8, up=True)
    if burnt:     # 앞벽 윗부분 전체 그을음(불길이 넘어간 자리) + 군데군데 검게 탄 얼룩
        for x in range(W):
            hf = front_h[x]
            for y in range(yb - hf, yb - hf + 20):
                q = get(px, W, Hh, x, y)
                if q[3]: put(px, W, Hh, x, y, char_px(q, 0.95 * (1 - (y - (yb - hf)) / 20.0), seed, x, y))
            for y in range(yb - hf + 16, yb - 4):
                v = vnoise(x, y, 6.0, seed + 41)
                q = get(px, W, Hh, x, y)
                if q[3] and v > 0.56: put(px, W, Hh, x, y, char_px(q, min(0.8, (v - 0.56) * 3.0), seed, x, y))
    # 이끼·잡초
    for y in range(Hh):
        for x in range(W):
            q = px[x, y]
            if q[3] and H(x // 2, y // 2, seed + 61) > 0.94 and y > yb - 12: px[x, y] = mix(q[:3], MOSS[4], 0.6) + (255,)
    for (x, top) in ivy:
        xx = x
        for y in range(yb, yb - top, -1):
            i = yb - y
            if i % 4 == 0: xx = x + int((H(i, seed) - 0.5) * 3)
            put(px, W, Hh, xx, y, LEAF[2])
            if i % 2: put(px, W, Hh, xx - 1, y, LEAF[4]); put(px, W, Hh, xx + 1, y - 1, LEAF[3])
    im = fin(im)
    p = im.load()
    if weeds_top:
        for x in range(4, W - 4, 3):
            if H(x, seed, 71) > 0.6: weeds_on(p, W, Hh, [(x, yb - front_h[x] - tk)], seed + x, 0.6)
    tufts(p, W, Hh, 0, W, Hh - 1, seed + 7, 0.55, 5, 0.6)
    return im

# ================================================================ 불탄 돌집(지붕 없음, 박공 정면)
def gable_profile(W, eave, G, seed, broken=None, amp=1.6):
    """박공 정면 벽 높이 열: 처마 eave + 가운데 꼭짓점 G. broken=(x0,x1,drop): 그 구간이 계단꼴로 무너졌다."""
    out = []
    for x in range(W):
        g = G * (1 - abs(x + 0.5 - W / 2) / (W / 2))
        v = eave + max(0.0, g)
        if broken:
            x0, x1, drop = broken
            if x0 <= x <= x1:
                f = math.sin(math.pi * (x - x0) / max(1, x1 - x0)) if x1 < W - 1 else min(1, (x - x0) / 10.0)
                v -= drop * f + (vnoise(x, 1, 3.0, seed) - 0.5) * 2 * amp * 2
                v = v // 4 * 4 + (2 if H(x // 4, seed) > 0.5 else 0)
        out.append(int(v))
    return out

def burnt_house(seed=21):
    """불탄 돌집: 박공 정면 돌벽만 서 있고 지붕은 타서 숯 서까래 뼈대가 박공 뒤로 겹겹이 남았다. 오른쪽 박공 어깨가 무너졌다."""
    W = 80; D = 34
    fh = gable_profile(W, 30, 26, seed, broken=(50, 79, 14))
    bh = gable_profile(W, 30, 26, seed + 1, broken=(56, 79, 10))
    return shell(W, fh, D, bh, st='sto', seed=seed, burnt=True,
                 fwins=((16, 9, 8, 12), (64, 9, 8, 12), (40, 36, 6, 9)), bwins=((40, 34, 6, 9),), door=(40, 10, 20),
                 beams=((6, 2, 30, 6, 2),), chevrons=((7, None), (14, 'r'), (21, None), (28, 'l')), soot_k=0.85)

def burnt_house_b(seed=27):
    """불탄 판석집(창백한 마름돌): 박공 왼쪽 반이 무너져 계단꼴로 남았고, 서까래는 두 줄만."""
    W = 64; D = 30
    fh = gable_profile(W, 28, 20, seed, broken=(0, 30, 16))
    bh = gable_profile(W, 28, 20, seed + 1, broken=(0, 22, 8))
    return shell(W, fh, D, bh, st='ash', seed=seed, burnt=True,
                 fwins=((48, 9, 7, 11),), door=(22, 10, 19), chevrons=((8, 'l'), (19, None)), soot_k=0.8)

# ================================================================ 불탄 교회(박공 정면 신랑 + 꼭대기 무너진 종탑)
def church_ruin(seed=31):
    """박공 정면 신랑(장미창 구멍·큰 아치문·첨두창, 숯 서까래 뼈대)과 왼쪽 네모 종탑(꼭대기 무너짐, 종실에 기운 종)."""
    TW = 48; NW = 112; W = TW + NW; D = 44
    fh = gable_profile(NW, 50, 44, seed, broken=(66, 111, 44))
    bh = gable_profile(NW, 50, 44, seed + 1, broken=(80, 111, 14))
    nave = shell(NW, fh, D, bh, st='sto', seed=seed, burnt=True,
                 fwins=((16, 12, 9, 26), (96, 12, 9, 26)), bwins=(), door=(52, 14, 34), rose=(50, 70, 9),
                 beams=((8, 2, 40, 8, 3), (70, 3, 104, 7, 3)), chevrons=((8, None), (16, 'r'), (25, None), (34, 'r'), (42, 'l')),
                 side_l=False, soot_k=1.0)
    th = 150
    hf = _jag(TW, lambda x: th - 6 - 22 * max(0, (x - 16) / 32.0), 2.6, seed + 5)
    hb_ = _jag(TW, lambda x: th - 2 - 10 * max(0, (x - 26) / 22.0), 2.0, seed + 6)
    Hh = max(nave.height, th + 8)
    o = Image.new('RGBA', (W, Hh))
    tex = _walltex('sto', TW, Hh + 64, seed + 9).load()
    t = Image.new('RGBA', (TW, Hh)); px = t.load(); yb = Hh - 1; Dt = 10
    for x in range(TW):                                     # 무너진 꼭대기 너머: 맞은편 벽 안쪽 면(그늘) + 윗면
        for y in range(yb - hb_[x] - Dt - 3, yb - hf[x]):
            if y < yb - hb_[x] - Dt: c = mul(tex[x, 40], 1.3)
            else: c = mul(tex[x, y % 80], 0.45)
            put(px, TW, Hh, x, y, c)
    for x in range(TW):                                     # 앞면
        for y in range(yb - hf[x] - 3, yb + 1):
            z = yb - y
            if y < yb - hf[x]: c = mul(tex[x, 44], 1.35) if y == yb - hf[x] - 3 else mul(tex[x, 45], 1.15)
            else:
                c = tex[x, (y + 5) % (Hh + 64)]
                if x < 3: c = mul(c, 1.12)
                if x > TW - 4: c = mul(c, 0.78)
                if z in (44, 92): c = mul(c, 1.3)                       # 층 띠돌 윗면
                if z in (42, 43, 90, 91): c = mul(c, 0.62)              # 띠돌 앞면 그늘
            put(px, TW, Hh, x, y, c)
    lancet(px, TW, Hh, 24, yb - 56, 6, 18, lambda x, y: DK[1], (mul(tex[2, 2], 1.3), mul(tex[2, 2], 0.6)))
    # 종실: 쌍 아치 열린 창 — 숯 들보에 기울어 매달린 종
    for cx in (15, 33):
        lancet(px, TW, Hh, cx, yb - 100, 10, 22, lambda x, y: DK[1] if (yb - 100 - y) > 1 else DK[2], (mul(tex[2, 2], 1.3), mul(tex[2, 2], 0.6)))
    for x in range(9, 40):                                  # 종 들보(숯)
        y = yb - 117 + int((x - 9) * 0.12)
        put(px, TW, Hh, x, y, CH[4]); put(px, TW, Hh, x, y + 1, CH[2])
    bell_px(px, TW, Hh, 15, yb - 115, seed)
    lancet(px, TW, Hh, 24, yb, 14, 30, lambda x, y: DK[1] if (yb - y) > 2 else ASH[2], (mul(tex[2, 2], 1.35), mul(tex[2, 2], 0.55)))   # 탑 아래 문
    soot(px, TW, Hh, 18, 31, yb - 56 - 18 - 20, yb - 56 - 15, seed, 0.8, up=True)
    soot(px, TW, Hh, 8, 40, yb - 100 - 22 - 18, yb - 100 - 19, seed + 1, 0.85, up=True)
    for x in range(TW):                                     # 꼭대기 그을음
        for y in range(yb - hf[x], yb - hf[x] + 12):
            q = get(px, TW, Hh, x, y)
            if q[3]: put(px, TW, Hh, x, y, char_px(q, 0.55 * (1 - (y - (yb - hf[x])) / 12.0), seed, x, y))
    for x in range(4, 44, 2):
        if H(x, seed, 3) > 0.55: weeds_on(px, TW, Hh, [(x, yb - hf[x] - 3)], seed + x, 0.6)
    t = fin(t); p = t.load()
    tufts(p, TW, Hh, 0, TW, Hh - 1, seed + 3, 0.55, 5, 0.6)
    o.alpha_composite(nave, (TW, Hh - nave.height))
    o.alpha_composite(t, (0, 0))
    return o

def bell_px(px, W, Hh, cx, ytop, seed, tilt=0.18):
    """종(청동, 녹): 정수리 고리 + 종 몸(아래로 벌어짐) + 테. tilt 만큼 기울었다."""
    BR = R('bronze'); VD = R('verd')
    for j in range(15):
        half = 2.5 + j * 0.32 + (1.5 if j > 12 else 0)
        sh = int(round(j * tilt))
        for i in range(int(-half), int(half) + 1):
            x = cx + i + sh; y = ytop + j
            f = (i + half) / (2 * half)
            t = 5 if f < 0.3 else (4 if f < 0.6 else 3)
            if j > 12: t = 5 if f < 0.5 else 2
            c = BR[t]
            if H(x, y, seed + 17) > 0.75 and j < 12: c = VD[t]
            put(px, W, Hh, x, y, c)
    put(px, W, Hh, cx, ytop - 1, BR[4]); put(px, W, Hh, cx + 1, ytop - 1, BR[3])
