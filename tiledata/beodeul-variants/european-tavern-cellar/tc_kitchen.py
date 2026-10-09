# 선술집 지하·주방 — 주방(난로 4프레임·식은 난로·불빛·솥·조리대·돌 개수대·빵 화덕·매단 마늘/햄/허브·냄비 걸이·도마 그루터기·난로 도구)
# 와 벽 장식(잔 그림 판·액자·벽 촛대 4프레임·거미줄).
from tc_base import *
from tc_base import _hash

def ashlar_block(cv, x0, y0, x1, y1, ramp=TRIM, bw=8, bh=6, seed=0, k0=0):
    """작은 마름돌 쌓기(굴뚝·난로 기둥): 줄마다 반 어긋남, 돌마다 톤, 위·왼쪽 밝고 줄눈 어둡다, 오른쪽 끝 한 단 그늘."""
    for y in range(y0, y1):
        row = (y - y0) // bh; ly = (y - y0) % bh; off = (row % 2) * (bw // 2)
        for x in range(x0, x1):
            lx = (x - x0 + off) % bw; col = (x - x0 + off) // bw
            if ly == bh - 1 or lx == bw - 1: k = 1
            else:
                h = _hash(col, row, seed + 31)
                k = 3 if h < .5 else (4 if h < .8 else 2)
                if ly == 0 or lx == 0: k += 1
                if _hash(x, y, seed + 32) < .05: k -= 1
            if x >= x1 - 2: k -= 1
            if x == x0: k += 1
            cv.px(x, y, ramp[clamp(k + k0, 1, 6)])

# ---------------------------------------------------------------- 난로 (3x4, 불꽃 4프레임)
def flames(cv, x0, x1, ybase, f, height=16, seed=0):
    """불꽃 혀: 열마다 높이가 프레임 f 에 따라 출렁인다. 아래 속은 흰 노랑 → 주황 → 붉은 끝, 위로 튀는 불씨."""
    w = x1 - x0
    for x in range(x0, x1):
        t = (x - x0 + .5) / w
        env = math.sin(math.pi * t) ** .8
        wob = .55 + .25 * math.sin(x * 1.3 + f * 1.9) + .2 * math.sin(x * .55 - f * 2.6 + 1.0)
        h = int(round(height * env * wob))
        for k in range(h):
            y = ybase - k
            u = k / max(1, h)
            core = abs(t - .5) < .28
            if u < .3: c = FIRE[6] if core else FIRE[5]
            elif u < .55: c = FIRE[5] if core else FIRE[4]
            elif u < .8: c = FIRE[4] if core else FIRE[3]
            else: c = FIRE[3] if u < .92 else FIRE[2]
            cv.px(x, y, c)
    for i in range(3):                                                                     # 불씨
        sx = x0 + int(_hash(i, f, seed + 5) * w); sy = ybase - height - 1 - int(_hash(i, f, seed + 6) * 6)
        cv.px(sx, sy, FIRE[5] if i == 0 else FIRE[4])

def logs_embers(cv, x0, x1, y, lit=True, f=0):
    """불 밑 장작 둘(엇갈린 통나무)과 숯."""
    for i in range(x1 - x0):
        x = x0 + i
        cv.px(x, y - 1 - (i * 3) // (x1 - x0), BARK[3]); cv.px(x, y - (i * 3) // (x1 - x0), BARK[1])
        xx = x1 - 1 - i
        cv.px(xx, y - 1 - (i * 3) // (x1 - x0) + 1, BARK[4]); cv.px(xx, y - (i * 3) // (x1 - x0) + 1, BARK[2])
    for x in range(x0 - 2, x1 + 2):
        r = _hash(x, f, 77)
        if lit: c = FIRE[3] if r < .3 else (FIRE[2] if r < .7 else ASHG[1])
        else: c = ASHG[3] if r < .4 else (ASHG[2] if r < .8 else ASHG[4])
        cv.px(x, y + 1, c); cv.px(x, y + 2, ASHG[2] if lit else ASHG[3])

def hearth_frame(f=None):
    """주방 난로 3x4(벽에 붙는다): 위 2줄 = 벽 앞면에 붙은 굴뚝 돌기둥, 참나무 선반 들보와 까치발, 돌 기둥 사이 아치 화구, 앞에 내민 돌 받침판.
    f = 0..3 불꽃 프레임, None 이면 식은 난로(재·숯)."""
    cv = Cv(48, 64)
    ashlar_block(cv, 12, 0, 36, 24, TRIM, 8, 6, seed=3, k0=-1)                             # 굴뚝 돌기둥
    for y in range(0, 22):
        s = max(0.0, 1 - y / 22.0)
        for x in range(14, 34):
            if _hash(x, y, 81) < .5 * s: cv.px(x, y, mul(cv.p[x, y][:3], .7))                # 위로 그을음
    box3(cv, 1, 22, 47, 30, 3, OAK, 5)                                                      # 선반 들보
    for bx in (3, 41):                                                                      # 까치발
        for k in range(5): cv.hline(bx + k // 2, bx + 4 - k // 3, 30 + k, OAK[3 if k < 3 else 2])
    mug_x = 6                                                                               # 선반 위: 구리 냄비·단지·촛불
    blob_ell(cv, 9, 20, 3.5, 2.6, COP, 4, 1); cv.hline(6, 13, 18, COP[5])
    cv.rect(36, 15, 40, 22, CLAY[3]); cv.vline(36, 15, 22, CLAY[5]); cv.hline(36, 40, 14, CLAY[4])
    cv.rect(42, 17, 44, 22, GAR[5]); cv.px(42, 16, FIRE[5]); cv.px(42, 15, FIRE[6])
    ashlar_block(cv, 2, 31, 10, 57, TRIM, 8, 6, seed=7, k0=-1)                              # 화구 양 기둥
    ashlar_block(cv, 38, 31, 46, 57, TRIM, 8, 6, seed=9, k0=-2)
    for x in range(10, 38):                                                                 # 화구 위 아치 쐐기돌 띠
        t = (x - 10 + .5) / 28.0
        ya = 31 + int(round(5 * (1 - math.sin(math.pi * t))))
        for y in range(31, ya + 3):
            if y < ya: cv.px(x, y, TRIM[(3 if (x // 4) % 2 else 2)] if y > 31 else TRIM[4])
            else: cv.px(x, y, TRIM[2] if y == ya else TRIM[1])
    hot = f is not None
    for y in range(34, 56):                                                                 # 화구 속(그을린 뒷벽)
        for x in range(10, 38):
            t = (x - 10 + .5) / 28.0
            ya = 31 + int(round(5 * (1 - math.sin(math.pi * t)))) + 3
            if y < ya: continue
            c = ASH[1] if ((y % 6 == 5) or ((x + (y // 6) % 2 * 4) % 8 == 7)) else (ASH[2] if _hash((x + (y // 6) % 2 * 4) // 8, y // 6, 83) < .6 else mix(ASH[1], ASH[2], .5))
            if hot:
                g = max(0.0, 1 - math.hypot((x - 24) / 13.0, (y - 53) / 14.0))
                g *= (.85 + .15 * ((f % 2) * 2 - 1))
                if g > .55: c = FIRE[2] if g < .75 else FIRE[3]
                elif g > .3: c = mix(c, FIRE[1], .7)
                elif g > .12: c = mix(c, FIRE[1], .35)
            else:
                c = mul(c, .9)
            cv.px(x, y, c)
    # 솥 걸이(쇠 갈고리)와 작은 무쇠 주전자
    cv.vline(30, 37, 44, IRON[4]); cv.px(31, 37, IRON[3])
    blob_ell(cv, 30, 47, 3.8, 3.2, IRON, 4, 2); cv.hline(27, 34, 44, IRON[5])
    if hot:
        flames(cv, 13, 35, 51, f, 14)
        logs_embers(cv, 14, 33, 52, True, f)
        blob_ell(cv, 30, 47, 3.8, 3.2, IRON, 4, 2); cv.hline(27, 34, 44, IRON[5]); cv.px(27, 45, FIRE[4])   # 주전자는 불 앞
    else:
        logs_embers(cv, 14, 33, 52, False)
    box3(cv, 0, 56, 48, 62, 3, TRIM, 11, k0=-1)                                             # 앞에 내민 돌 받침판
    cv.hline(1, 47, 63, SHADE)
    im = fin(cv)
    return im

def hearth_strip():
    fr = [hearth_frame(f) for f in range(4)]
    o = new(48 * 4, 64)
    for i, im in enumerate(fr): o.alpha_composite(im, (i * 48, 0))
    return o

def fire_glow(f=0):
    """난로 앞 바닥 불빛 3x2(반투명 따뜻한 타원, 가장자리 바둑 점 번짐)."""
    o = new(48, 32); p = o.load()
    for y in range(32):
        for x in range(48):
            d = ((x + .5 - 24) / 23.0) ** 2 + ((y + .5 - 4) / 26.0) ** 2
            if d > 1: continue
            if d > .7: continue
            elif d > .35: p[x, y] = FIRE[3] + (36,)
            else: p[x, y] = FIRE[4] + (52,)
    return o

# ---------------------------------------------------------------- 솥·조리대·개수대·화덕
def cauldron(seed=0):
    """무쇠 솥 2x2: 돌 화덕 고리 위 세 다리 솥, 속 끓는 수프(거품 점)와 김 한 줄기."""
    cv = Cv(32, 32)
    for i, ang in enumerate(range(0, 360, 30)):                                             # 돌 고리
        a = math.radians(ang); sx = 16 + 12 * math.cos(a); sy = 26 + 4 * math.sin(a)
        blob_ell(cv, sx, sy, 2.4, 1.8, TRIM, 3 if math.sin(a) > 0 else 4, i)
    for x in range(8, 24):
        cv.px(x, 27, FIRE[3] if _hash(x, 1, 3) < .5 else FIRE[2]); cv.px(x, 26, FIRE[4] if _hash(x, 2, 3) < .3 else FIRE[2])
    for y in range(9, 26):                                                                  # 솥 몸통(아래가 둥근 사발)
        t = (y - 9) / 16.0
        half = 11.5 * math.sqrt(max(0, 1 - max(0, t - .35) ** 2 / .42))
        for x in range(int(16 - half), int(16 + half + .5)):
            k = cyl_k(x, 16 - half, 16 + half)
            if y >= 23: k -= 1
            cv.px(x, y, IRON[clamp(k, 1, 6)])
    for y in range(6, 12):                                                                  # 테 + 속 수프
        for x in range(3, 29):
            dx = (x + .5 - 16) / 12.6; dy = (y + .5 - 9) / 3.0
            d = dx * dx + dy * dy
            if d > 1: continue
            if d > .6: c = IRON[5] if dy < 0 else IRON[4]
            else:
                c = CLAY[3] if (x + y) % 5 else CLAY[4]
                if _hash(x, y, 91) < .1: c = CLAY[5]
                if (x, y) in ((11, 9), (19, 8), (15, 10)): c = GAR[4]
            cv.px(x, y, c)
    for x in (10, 22): cv.vline(x, 25, 29, IRON[3])
    for y in range(0, 6):                                                                   # 김
        x = 14 + int(round(math.sin(y * 1.1) * 1.5))
        cv.px(x, y, GAR[3] if y % 2 else GAR[2])
    im = fin(cv)
    p = im.load()                                                                            # 김은 반투명으로
    for y in range(0, 6):
        for x in range(10, 20):
            if p[x, y][3]: p[x, y] = p[x, y][:3] + (140,)
    return im

def counter(kind='prep', seed=0):
    """조리대 3x2: 두꺼운 참나무 윗면 + 서랍 줄·문 둘의 앞면. prep: 도마·칼·양파·당근·양배추, bowl: 밀가루 그릇·밀대·반죽."""
    cv = Cv(48, 32)
    table_like_top(cv, 1, 1, 47, 17, seed)
    for y in range(17, 31):
        for x in range(1, 47):
            k = 3 if x < 45 else 2
            if x in (1, 2): k = 4
            if y == 17: k = 2
            cv.px(x, y, OAK[k])
    for x in range(2, 46): cv.px(x, 22, OAK[1])
    for dx0 in (4, 18, 32):                                                                 # 서랍 셋 손잡이
        cv.hline(dx0 + 4, dx0 + 8, 19, AMBER[3])
    for dx0 in (4, 25):                                                                     # 아래 문 둘(들어간 판)
        for y in range(24, 30):
            for x in range(dx0, dx0 + 18):
                k = 3
                if x == dx0 or y == 24: k = 2
                elif x == dx0 + 17 or y == 29: k = 4
                cv.px(x, y, OAK[k])
    cv.hline(1, 47, 31, SHADE)
    if kind == 'prep':
        box3(cv, 5, 5, 21, 13, 6, SACK, 3)                                                  # 도마
        cv.hline(8, 16, 9, IRON[5]); cv.hline(8, 16, 10, IRON[3]); cv.hline(16, 20, 9, OAK[2]); cv.hline(16, 20, 10, OAK[1])   # 칼
        blob_ell(cv, 27, 8, 2.6, 2.4, CHZ, 4, 1); cv.px(27, 5, HERB[4])                   # 양파
        blob_ell(cv, 31, 10, 2.4, 2.2, CHZ, 3, 2)
        for i in range(6): cv.px(34 + i, 6 + i // 2, COP[5] if i < 4 else COP[4]); cv.px(34 + i, 7 + i // 2, COP[3])   # 당근
        cv.px(33, 5, HERB[5]); cv.px(33, 6, HERB[4])
        blob_ell(cv, 41, 9, 3.8, 3.4, HERB, 4, 3); cv.px(40, 7, HERB[6]); cv.px(42, 10, HERB[2])   # 양배추
    else:
        blob_ell(cv, 13, 9, 7, 4.2, CLAY, 4, 4)                                             # 큰 질그릇 그릇
        blob_ell(cv, 13, 8, 5, 2.6, GAR, 5, 5)                                              # 밀가루
        for x in range(23, 39): cv.px(x, 11, OAK[5]); cv.px(x, 12, OAK[3])                # 밀대
        cv.hline(21, 23, 11, OAK[4]); cv.hline(39, 41, 11, OAK[4])
        blob_ell(cv, 32, 6, 4, 2.4, CHZ, 5, 6)                                              # 반죽
        for (x, y) in ((24, 4), (26, 6), (40, 5), (43, 8)): cv.px(x, y, GAR[5])            # 밀가루 흩뿌림
    return fin(cv)

def table_like_top(cv, x0, y0, x1, y1, seed=0):
    for y in range(y0, y1):
        for x in range(x0, x1):
            a = y - y0; b = x
            k = 4 if (a // 4) % 2 == 0 else 3
            if a % 4 == 3: k = 2
            g = grain(a * 7 + b, b * 3 + a) - 3
            if g >= 2: k += 1
            elif g <= -2: k -= 1
            if y == y0 or x == x0: k = 5
            elif x == x1 - 1: k = 2
            if pn(x * 3, y * 3, 8, seed + 61) > .8: k -= 1
            cv.px(x, y, OAK[clamp(k, 1, 6)])

def stone_sink(seed=0):
    """돌 개수대 2x2: 마름돌 함지(윗면 테 + 속 물) + 앞면, 옆 나무 손펌프 기둥과 손잡이."""
    cv = Cv(32, 32)
    box3(cv, 1, 8, 31, 30, 9, TRIM, seed, k0=-1)
    for y in range(10, 16):
        for x in range(4, 28):
            c = PUD[3] if (x + y) % 7 else PUD[4]
            if y == 10: c = PUD[1]
            if _hash(x // 3, y, 7) > .9: c = PUD[5]
            cv.px(x, y, c)
    for x in range(1, 31, 10):
        for y in range(18, 29): cv.px(x, y, TRIM[1])
    vcyl(cv, 25, 30, 0, 9, OAK, 1, seed)                                                    # 펌프 기둥
    for i in range(7): cv.px(24 - i, 1 + i // 3, IRON[4])
    cv.rect(21, 7, 24, 9, IRON[3]); cv.px(22, 9, IRON[2])
    cv.hline(1, 31, 31, SHADE)
    return fin(cv)

def bread_oven(seed=0):
    """빵 화덕 2x3(벽에 붙는다): 벽돌 둥근 지붕, 아치 아궁이 속 붉은 숯빛, 쇠 문짝을 옆에 세움, 돌 턱."""
    cv = Cv(32, 48)
    for y in range(4, 40):
        for x in range(1, 31):
            t = (x - 1 + .5) / 30.0
            top = 4 + int(round(10 * (1 - math.sin(math.pi * t)) ** 1.5))
            if y < top: continue
            row = (y - 4) // 4; lx = (x + (row % 2) * 4) % 8
            if (y - 4) % 4 == 3 or lx == 7: k = 1
            else:
                k = 3 if _hash((x + (row % 2) * 4) // 8, row, 51) < .55 else 4
                if (y - 4) % 4 == 0: k += 1
            if x < 4: k += 1
            if x > 27: k -= 1
            if y == top: k = 5
            cv.px(x, y, BRICK[clamp(k, 1, 6)])
    for y in range(22, 38):                                                                 # 아궁이
        for x in range(8, 24):
            t = (x - 8 + .5) / 16.0
            if y < 22 + int(round(5 * (1 - math.sin(math.pi * t)))): continue
            g = max(0.0, 1 - math.hypot((x - 16) / 7.0, (y - 37) / 9.0))
            c = SHADE if g < .2 else (FIRE[1] if g < .45 else (FIRE[2] if g < .7 else FIRE[3]))
            cv.px(x, y, c)
    for x in range(7, 25): cv.px(x, 21 + int(round(5 * (1 - math.sin(math.pi * (x - 7 + .5) / 18.0)))), TRIM[4])
    box3(cv, 0, 38, 32, 47, 3, TRIM, 4, k0=-1)
    cv.rect(25, 28, 30, 38, IRON[3]); cv.vline(25, 28, 38, IRON[5]); cv.px(27, 33, IRON[6])   # 세워 둔 쇠 문짝
    cv.hline(1, 31, 47, SHADE)
    return fin(cv)

# ---------------------------------------------------------------- 매단 것(벽 앞면 위 장식)
def hanging_garlic(seed=0):
    """매단 마늘 타래 1x2: 나무 못에 건 짚 끈을 따라 흰 마늘통이 좌우로 엇갈려 달렸다."""
    cv = Cv(16, 32)
    cv.rect(6, 1, 10, 3, OAK[4]); cv.px(6, 1, OAK[5])
    for y in range(3, 28): cv.px(8 + (1 if (y // 3) % 2 else 0), y, STRAW[3])
    for i, y in enumerate(range(6, 28, 3)):
        cx = 6 if i % 2 == 0 else 11
        w = 2.8 - (i * .15)
        blob_ell(cv, cx, y, w, 2.3, GAR, 4, i)
        cv.px(int(cx), y - 2, GAR[2])
    for y in range(28, 31): cv.px(8, y, STRAW[4]); cv.px(9, y, STRAW[2])
    return fin(cv)

def hanging_meat(seed=0):
    """매단 햄·소시지 2x2: 벽 쇠 걸이 막대에 갈고리 셋 — 큰 햄 다리, 소시지 고리 줄, 작은 훈제 덩이."""
    cv = Cv(32, 32)
    for x in range(1, 31): cv.px(x, 2, IRON[4]); cv.px(x, 3, IRON[2])
    for x in (2, 29): cv.vline(x, 1, 5, IRON[3])
    for hx_ in (7, 17, 26): cv.vline(hx_, 4, 7, IRON[4])
    HAM = R7('#240c08', '#481a10', '#6a2a18', '#8a3c22', '#a6542e', '#c06e3e', '#d68c56')
    for y in range(8, 25):                                                                  # 햄 다리(위 정강이는 좁고 아래가 둥글게 불룩)
        t = (y - 8) / 16.0
        half = 1.2 + 4.6 * math.sin(min(1.0, t * 1.25) * math.pi * .5) ** 1.6
        if t > .82: half *= math.sqrt(max(0, 1 - ((t - .82) / .2) ** 2))
        for x in range(int(round(7 - half)), int(round(7 + half))):
            k = cyl_k(x, 7 - half, 7 + half)
            if t < .2: k = 3
            cv.px(x, y, HAM[clamp(k, 1, 6)])
    for y in range(7, 11): cv.px(7, y, GAR[4]); cv.px(8, y, GAR[2])                      # 뼈 끝
    cv.hline(5, 10, 11, ROPE[4])
    cv.px(5, 16, HAM[6]); cv.px(4, 18, HAM[6])
    for i in range(5):                                                                      # 소시지 고리
        cy = 9 + i * 4; cx = 17 + (1 if i % 2 else -1)
        blob_ell(cv, cx, cy, 2.2, 2.0, HAM, 4, i)
        cv.px(cx, cy - 2, ROPE[3])
    for y in range(7, 19):                                                                  # 훈제 덩이(짙은 갈색)
        half = 3.2 * math.sin(math.pi * (y - 7 + .5) / 12.0)
        for x in range(int(26 - half), int(26 + half + .5)):
            cv.px(x, y, CLAY[clamp(cyl_k(x, 26 - half, 26 + half) - 1, 1, 6)])
    cv.hline(23, 30, 12, ROPE[4])
    return fin(cv)

def herb_bundle(seed=0):
    """말린 허브 다발 1x1: 끈에 거꾸로 매단 초록 다발 둘."""
    cv = Cv(16, 16)
    cv.hline(1, 15, 1, ROPE[3])
    for cx, ln in ((5, 11), (11, 13)):
        cv.vline(cx, 1, 4, ROPE[4])
        for y in range(4, 4 + ln):
            w = 1 + (y - 4) // 3
            for x in range(cx - w, cx + w + 1):
                if _hash(x, y, cx) < .25: continue
                cv.px(x, y, HERB[4 if x <= cx else 2] if (x + y) % 3 else HERB[5])
        cv.hline(cx - 1, cx + 2, 5, STRAW[4])
    return fin(cv)

def pot_rack(seed=0):
    """냄비 걸이 3x1(벽 앞면 위): 쇠 막대 갈고리에 구리 냄비·국자·프라이팬."""
    cv = Cv(48, 16)
    for x in range(1, 47): cv.px(x, 1, IRON[4]); cv.px(x, 2, IRON[2])
    for x in (6, 16, 25, 36, 43): cv.vline(x, 2, 4, IRON[4])
    blob_ell(cv, 6, 9, 4.5, 4.2, COP, 4, 1); cv.hline(2, 11, 5, COP[5])                  # 냄비
    for y in range(4, 14): cv.px(16, y, IRON[4])                                            # 국자
    blob_ell(cv, 16, 13, 2.2, 1.6, IRON, 4, 2)
    for y in range(4, 8): cv.px(25, y, COP[3])                                              # 프라이팬
    blob_ell(cv, 25, 11, 5, 4, COP, 3, 3)
    blob_ell(cv, 25, 11, 3.5, 2.8, COP, 2, 4, hi=False)
    for y in range(4, 13): cv.px(36, y, OAK[4])                                             # 나무 주걱
    blob_ell(cv, 36, 13, 1.6, 1.6, OAK, 4, 5)
    blob_ell(cv, 43, 9, 3.2, 3.6, COP, 5, 6); cv.hline(40, 47, 6, COP[5])                # 작은 냄비
    return fin(cv)

def butcher_block(seed=0):
    """도마 그루터기 1x1: 굵은 통나무 토막 윗면(나이테) + 꽂힌 고기 칼."""
    cv = Cv(16, 16)
    staves_cyl_simple(cv, 2, 14, 7, 15)
    for y in range(3, 9):
        for x in range(2, 14):
            d = ((x + .5 - 8) / 6.2) ** 2 + ((y + .5 - 6) / 3.0) ** 2
            if d > 1: continue
            c = SACK[5] if d > .55 else (SACK[4] if d > .2 else SACK[3])
            if .45 < d < .6: c = SACK[3]
            cv.px(x, y, c)
    cv.rect(8, 0, 13, 4, IRON[5]); cv.hline(8, 13, 4, IRON[3]); cv.rect(12, 1, 15, 3, OAK[3])
    cv.hline(2, 14, 15, SHADE)
    return fin(cv)

def staves_cyl_simple(cv, x0, x1, y0, y1):
    for y in range(y0, y1):
        for x in range(x0, x1):
            k = cyl_k(x, x0, x1)
            if (x + y) % 5 == 0: k -= 1
            cv.px(x, y, BARK[clamp(k, 1, 6)])

def hearth_tools(seed=0):
    """난로 도구 걸이 1x2: 쇠 받침대에 부지깽이·삽·솔."""
    cv = Cv(16, 32)
    cv.vline(8, 4, 30, IRON[4]); cv.vline(9, 4, 30, IRON[2])
    cv.hline(4, 13, 30, IRON[3]); cv.hline(5, 12, 31, SHADE)
    cv.hline(5, 12, 4, IRON[5]); cv.px(8, 2, IRON[5]); cv.px(8, 3, IRON[4])
    cv.vline(5, 5, 24, IRON[3]); cv.px(4, 24, IRON[4]); cv.px(4, 25, IRON[3])               # 부지깽이
    cv.vline(12, 5, 20, IRON[3]); cv.rect(10, 20, 15, 25, IRON[4]); cv.hline(10, 15, 25, IRON[2])   # 삽
    cv.vline(10, 5, 16, OAK[4]); cv.rect(9, 16, 12, 21, STRAW[3])                          # 솔
    return fin(cv)

# ---------------------------------------------------------------- 벽 장식
def mug_sign(seed=0):
    """잔 그림 판 1x1(벽 앞면 위): 쇠 팔에 매단 나무 판에 거품 넘치는 맥주잔 그림(글자 없음)."""
    cv = Cv(16, 16)
    cv.hline(1, 12, 1, IRON[4]); cv.vline(1, 1, 4, IRON[3])
    cv.px(4, 2, IRON[3]); cv.px(10, 2, IRON[3])
    box3(cv, 2, 3, 14, 15, 0, OAK, seed)
    for x in range(2, 14): cv.px(x, 3, OAK[5])
    cv.rect(5, 7, 10, 13, AMBER[4]); cv.vline(5, 7, 13, AMBER[5]); cv.vline(9, 7, 13, AMBER[3])
    cv.vline(10, 8, 12, GAR[3]); cv.px(11, 9, GAR[3]); cv.px(11, 11, GAR[3])
    cv.hline(4, 11, 6, GAR[5]); cv.hline(5, 10, 5, GAR[6]); cv.px(6, 4, GAR[5])
    return fin(cv)

def painting(seed=0):
    """액자 그림 1x2(벽 앞면 위): 금빛 바랜 나무 액자 속 밤 항구 풍경(달·돛배·물결, 글자 없음)."""
    cv = Cv(16, 32)
    for y in range(4, 26):
        for x in range(1, 15):
            if x in (1, 14) or y in (4, 25): cv.px(x, y, AMBER[2] if (x == 14 or y == 25) else AMBER[4]); continue
            if x in (2, 13) or y in (5, 24): cv.px(x, y, OAK[2]); continue
            c = GLASS[3] if y < 15 else (GLASS[2] if y < 19 else PUD[3])
            if y >= 19 and (x + y) % 4 == 0: c = PUD[5]
            cv.px(x, y, c)
    cv.px(10, 8, GAR[6]); cv.px(11, 8, GAR[5]); cv.px(10, 9, GAR[5])                       # 달
    cv.vline(7, 11, 18, OAK[4]); cv.rect(5, 12, 7, 17, LINEN[4]); cv.rect(8, 13, 10, 17, LINEN[3])
    cv.hline(4, 12, 18, OAK[2]); cv.hline(5, 11, 19, OAK[1])
    cv.px(8, 2, IRON[4]); cv.px(7, 3, IRON[3]); cv.px(9, 3, IRON[3])
    return fin(cv)

def candle_sconce(f=0):
    """벽 촛대 1x1: 쇠 받침에 촛불(프레임마다 불꽃이 흔들린다)과 둘레 빛."""
    o = new(16, 16); p = o.load()
    for y in range(16):
        for x in range(16):
            d = math.hypot(x + .5 - 8, (y + .5 - 6) * 1.1)
            r = 6.5 + (f % 2) * .8
            if d < r and (x + y) % 2 == (f // 2) % 2: p[x, y] = AMBER[5] + (40,)
    cv = Cv(16, 16)
    cv.hline(5, 12, 12, IRON[4]); cv.hline(6, 11, 13, IRON[2]); cv.vline(8, 13, 15, IRON[3])
    cv.rect(7, 7, 10, 12, GAR[5]); cv.vline(9, 7, 12, GAR[3])
    dx = (0, 1, 0, -1)[f]
    cv.px(8 + dx, 4, FIRE[4]); cv.px(8, 5, FIRE[5]); cv.px(8 + dx, 5, FIRE[6]); cv.px(8, 6, FIRE[6]); cv.px(9, 6, FIRE[5])
    if f in (0, 2): cv.px(8 + dx, 3, FIRE[3])
    im = fin(cv)
    o.alpha_composite(im)
    return o

def candle_sconce_strip():
    o = new(64, 16)
    for f in range(4): o.alpha_composite(candle_sconce(f), (f * 16, 0))
    return o

def cobweb(left=True):
    """거미줄 1x1(벽 앞면 위쪽 구석): 방사 줄 넷과 고리 셋, 반투명 회백."""
    o = new(16, 16); p = o.load()
    for y in range(16):
        for x in range(16):
            ang = math.atan2(y + .5, x + .5); r = math.hypot(x + .5, y + .5)
            on = False
            for a in (0.15, 0.55, 0.95, 1.4):
                if abs(ang - a) * r < .55 and r < 15: on = True
            for rr in (4.5, 8.5, 12.5):
                if abs(r - rr * (1 + .08 * math.sin(ang * 6))) < .5 and r < 15: on = True
            if on: p[x, y] = GAR[4] + (150,)
    return o if left else hflip(o)
