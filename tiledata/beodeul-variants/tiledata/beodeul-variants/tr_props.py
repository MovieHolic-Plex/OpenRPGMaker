

def rock_drift(big=True, seed=71):
    """떠 있는 바위 덩이(2x2 / 1x1): 다듬지 않은 바위 윗면 + 가늘어지는 뿌리. 섬 그리기와 같은 결. 허공 장식."""
    if big:
        W, H = 32, 32; m = I.ellipse_mask(W, H, 16, 11, 13, 6, seed, 1.5)
        im, _ = I.render_islands(W, H, [I.Island(m, 'rock', body=4, root=14, seed=seed)])
    else:
        W, H = 16, 16; m = I.ellipse_mask(W, H, 8, 5, 6.2, 3.2, seed, 1.0)
        im, _ = I.render_islands(W, H, [I.Island(m, 'rock', body=2, root=7, seed=seed)])
    return im


def stepping_stone(seed=60):
    """징검돌(1x2): 허공에 뜬 납작한 바위 한 덩이. 윗칸이 걷는 칸, 아랫칸은 뿌리(허공)."""
    W, H = 16, 32; m = I.ellipse_mask(W, H, 8, 8, 7.4, 6.2)
    im, _ = I.render_islands(W, H, [I.Island(m, 'rock', body=3, root=9, seed=seed)])
    return im


def planter_glow(seed=33):
    """빛꽃 돌 화분(2x1): 낮은 네모 돌 화분(윗면 테 + 앞면)에 푸른 빛을 내는 작은 꽃과 잎. 몸통 줄 막힘."""
    W, H = 32, 16; im = blank(W, H); px = im.load()
    chunk_px(px, W, H, 2, 6, 28, 9, top=2)
    for y in range(8, 10):                                         # 흙(안쪽)
        for x in range(4, 28): put(px, W, H, x, y, hx(PAL['dirt'][2 if y == 8 else 1]))
    LFm = [hx(c) for c in PAL['leaf']]
    G = GLOW['blue']
    for i in range(9):
        x = 5 + i * 3 + int(_hash(i, 1, seed) * 2); h = 3 + int(_hash(i, 2, seed) * 3)
        for k in range(h): put(px, W, H, x, 8 - k, LFm[3 if k < h - 1 else 4])
        put(px, W, H, x - 1, 8 - h // 2, LFm[4]); put(px, W, H, x + 1, 9 - h // 2, LFm[2])
        if i % 2 == 0:
            for (dx, dy, k) in ((0, 0, 6), (-1, 0, 4), (1, 0, 4), (0, -1, 5), (0, 1, 3)): put(px, W, H, x + dx, 7 - h + dy, G[k])
    return pz.fin(im)


def arch_ruin(seed=13):
    """무너진 아치 문(3x3): 기둥 둘 사이 쐐기돌 아치. 왼쪽 기둥은 온전하고 아치가 오른쪽으로 휘다 끊겼다.
    오른쪽 기둥은 중간에서 부러졌고, 끊긴 아치의 쐐기돌 셋이 그 위 허공에 멈춰 떠 있다. 기둥 밑동만 막힘(가운데 칸 지나감)."""
    W, H = 48, 48; im = blank(W, H); px = im.load()
    column_px(px, W, H, 7, 10, 47, w=8, seed=seed)
    column_px(px, W, H, 41, 10, 47, w=8, broken=27, seed=seed + 1)
    cx, cy, r0, r1 = 24, 24, 11, 18
    for y in range(0, 24):
        for x in range(2, 47):
            d = math.hypot(x + .5 - cx, (y + .5 - cy) * 1.1)
            a = math.degrees(math.atan2(cy - y - .5, x + .5 - cx))
            if r0 <= d <= r1 and 58 < a < 180 and y < 14 + (x < 11) * 9:
                v = int(a / 12)
                k = 5 if v % 2 else 4
                if d < r0 + 1.2: k = 3
                if d > r1 - 2: k = 6 if a > 95 else 5
                if abs(a - v * 12) < 1.0: k = 2
                put(px, W, H, x, y, ST[k])
    chunk_px(px, W, H, 33, 5, 5, 4); chunk_px(px, W, H, 39, 12, 5, 4); chunk_px(px, W, H, 36, 19, 4, 3, top=1)
    im = pz.fin(im); px = im.load()
    for x in range(36, 46):                                        # 쐐기돌을 붙잡는 희미한 빛
        y = 24
        if not px[x, y][3] and _hash(x, y, seed) < .5: px[x, y] = GLOW['blue'][3] + (150,)
    return im
