# 고대 숲 조각들 — 손 도트. 3/4 (윗면+앞면, 옆면 없음), 빛 왼쪽 위.
from af_base import *
from af_base import _hash, _lumps
import af_trees as AT

def mossify(im, seed=1, amount=.4, top_bias=.35, ramp=None):
    """돌·나무 그림 위에 이끼를 얹는다: 위로 열린 화소·위쪽 칸 먼저, 덩이로."""
    ramp = ramp or LEAF; im = im.copy(); p = im.load(); W, H = im.size
    for y in range(H):
        for x in range(W):
            if p[x, y][3] < 200: continue
            above_open = (y == 0) or p[x, y - 1][3] < 200
            thr = 1 - amount - (top_bias if above_open else 0) - (.12 if y < H * .35 else 0)
            n = vnoise(x, y, 3.2, seed) * .7 + _hash(x, y, seed + 1) * .3
            r, g, b, a = p[x, y]
            dark = (r + g + b) < 80
            if n > thr and not dark:
                t = 3 + int(vnoise(x, y, 2.0, seed + 5) * 2.4) + (1 if above_open else 0) - (1 if x > W * .65 else 0)
                p[x, y] = tuple(ramp[cl(t, 2, 6)]) + (255,)
    return im

def stone_pillar(h=2, broken=False, seed=1, moss=.26):
    W, H = 16, h * T; c = Cv(W, H); st = MOSSROCK
    x0, x1 = 2, 14
    top = 6 if not broken else 12
    for y in range(top, H - 2):
        for x in range(x0, x1):
            k = 5 if x < x0 + 2 else (4 if x < x0 + 6 else (3 if x < x1 - 2 else 2))
            if (y - top) % 9 == 8: k -= 1
            if _hash(x, y, seed) < .08: k += 1 if _hash(y, x, seed + 1) < .5 else -1
            c.px(x, y, st[cl(k, 1, 6)])
    # 윗면 (타원 대신 3/4 직사각 윗면 3행)
    if not broken:
        for y in range(top - 3, top):
            for x in range(x0 - 1, x1 + 1): c.px(x, y, st[6 if x < x0 + 5 else 5] if y == top - 3 else st[5 if x < x0 + 5 else 4])
    else:
        for x in range(x0, x1):
            jag = int(_hash(x, 0, seed + 3) * 4)
            for y in range(top - jag, top): c.px(x, y, st[4 if x < x0 + 6 else 3])
            c.px(x, top - jag - 1 if top - jag - 1 >= 0 else 0, st[5])
    # 새긴 띠 (룬 줄: 짧은 획 반복, 글자 아님)
    by = top + (H - top) // 3
    for x in range(x0 + 1, x1 - 1):
        c.px(x, by, st[1]); 
        if x % 3 == 0: c.px(x, by + 1, st[2]); c.px(x, by - 1, st[2])
    # 받침
    for y in range(H - 3, H - 1):
        for x in range(x0 - 1, x1 + 1): c.px(x, y, st[4 if x < x0 + 6 else 3] if y == H - 3 else st[2])
    im = fin(c, .6)
    return sh(mossify(im, seed, moss), W / 2, H - 2, 7, 1.6, 60)

def statue(kind='guardian', seed=1):
    """이끼 낀 석상. 얼굴 없음 — 두건 쓴 수호상. 16x32 (1x2칸)."""
    W, H = 16, 32; c = Cv(W, H); st = MOSSROCK
    # 받침 상자
    for y in range(22, 30):
        for x in range(1, 15):
            k = (5 if y < 24 else 4) - (1 if x > 11 else 0) + (1 if x < 3 else 0)
            if y == 24: k = 2
            c.px(x, y, st[cl(k, 1, 6)])
    for x in range(1, 15): c.px(x, 29, st[1])
    if kind == 'guardian':
        # 몸 (망토 종 모양), 두건, 앞에 모은 손
        for y in range(8, 22):
            t = (y - 8) / 13.0; hw = 3 + int(t * 3.2)
            for x in range(8 - hw, 8 + hw):
                k = 5 if x < 8 - hw + 2 else (4 if x < 7 else (3 if x < 8 + hw - 2 else 2))
                if _hash(x, y, seed + 2) < .08: k += 1
                c.px(x, y, st[cl(k, 1, 6)])
        for y in range(3, 9):
            hw = 2 + int(min(y - 3, 3) * .8)
            for x in range(8 - hw, 8 + hw):
                k = 5 if x < 8 - hw + 1 else (4 if x < 8 else 3)
                if y == 3: k = 6
                c.px(x, y, st[cl(k, 1, 6)])
        for x in range(6, 10): c.px(x, 6, st[0]); c.px(x, 7, st[1])               # 두건 속 그늘(얼굴 없음)
        c.px(6, 5, st[1]); c.px(9, 5, st[1])
        for x in range(5, 11): c.px(x, 14, st[2]); c.px(x, 15, st[5] if x < 8 else st[3])  # 모은 손
    else:   # 머리 부서진 토르소
        for y in range(11, 22):
            t = (y - 11) / 10.0; hw = 3 + int(t * 3)
            for x in range(8 - hw, 8 + hw):
                k = 5 if x < 8 - hw + 2 else (4 if x < 7 else (3 if x < 8 + hw - 2 else 2))
                c.px(x, y, st[cl(k, 1, 6)])
        for x in range(5, 11):
            jg = int(_hash(x, 0, seed + 4) * 3)
            c.px(x, 10 - jg, st[5]); c.px(x, 11 - jg, st[4])
        # 떨어진 머리 (받침 앞)
        for y in range(29, 31) if False else ():
            pass
    return sh(mossify(fin(c, .6), seed, .26, .25), 8, 30, 7, 1.5, 60)

def waystone(seed=2):
    """표지석 (1x2칸): 위가 둥근 서 있는 돌, 나선 룬, 이끼."""
    W, H = 16, 32; c = Cv(W, H); st = MOSSROCK
    for y in range(4, 30):
        t = (y - 4) / 25.0
        hw = int(4.5 + 2.5 * min(1, t * 3) + (1 if y > 26 else 0)) 
        for x in range(8 - hw, 8 + hw):
            k = 5 if x < 8 - hw + 2 else (4 if x < 8 - 1 else (3 if x < 8 + hw - 2 else 2))
            if y < 8: k = min(6, k + 1)
            if _hash(x, y, seed) < .08: k += 1 if _hash(y, x, 3) < .5 else -1
            c.px(x, y, st[cl(k, 1, 6)])
    # 나선 룬 (글자 아님)
    cx, cy = 8, 15
    for a in range(0, 44):
        ang = a * .42; r = 0.4 + a * .085
        x = int(round(cx + math.cos(ang) * r)); y = int(round(cy + math.sin(ang) * r * .9))
        c.px(x, y, GLOW_G[4] if a % 7 else GLOW_G[5])
    for x in range(3, 13): c.px(x, 6 if False else 24, st[1])
    for x in range(2, 14): c.px(x, 29, st[1]); c.px(x, 30, st[2]) if False else None
    return sh(mossify(fin(c, .6), seed, .28, .3), 8, 30, 6.5, 1.5, 60)

def altar_moss(seed=3):
    """이끼 낀 제단 (2x2칸): 3단 기단 + 상판 + 한가운데 빛나는 새김."""
    W, H = 32, 32; c = Cv(W, H); st = MOSSROCK
    def slab(x0, y0, x1, y1, top):
        for y in range(y0, y1):
            for x in range(x0, x1):
                if y < y0 + top: k = 6 if (y == y0 or x == x0) else 5
                else: k = 4 - (1 if y > y1 - 3 else 0) - (1 if x > x1 - 4 else 0) + (1 if x == x0 else 0)
                if _hash(x, y, seed + x0) < .08: k += 1 if _hash(y, x, 3) < .5 else -1
                c.px(x, y, st[cl(k, 1, 6)])
    slab(1, 20, 31, 30, 3)
    slab(4, 12, 28, 21, 3)
    slab(8, 5, 24, 13, 4)
    for x in range(10, 22):
        c.px(x, 8, GLOW_G[4] if x % 2 else GLOW_G[5]); 
    for (x, y) in ((16, 6), (15, 7), (17, 7), (16, 9), (14, 8), (18, 8)): c.px(x, y, GLOW_G[6])
    return sh(mossify(fin(c, .6), seed, .26, .25), 16, 29, 14, 2, 60)

def ruin_gate(seed=4):
    """유적 돌문 (4x3칸): 이끼 낀 기둥 둘 + 상인방. 가운데 두 칸은 지나갈 수 있다."""
    W, H = 64, 48; c = Cv(W, H); st = MOSSROCK
    def pillar(x0, x1):
        for y in range(12, H - 2):
            for x in range(x0, x1):
                k = 5 if x < x0 + 3 else (4 if x < x0 + 8 else (3 if x < x1 - 3 else 2))
                if (y - 12) % 10 == 9: k -= 1
                if _hash(x, y, seed) < .08: k += 1 if _hash(y, x, 3) < .5 else -1
                c.px(x, y, st[cl(k, 1, 6)])
        for y in range(H - 4, H - 2):
            for x in range(x0 - 2, x1 + 2): c.px(x, y, st[4 if x < x0 + 8 else 3] if y == H - 4 else st[2])
        for x in range(x0 + 1, x1 - 1):
            c.px(x, 26, st[1]); 
            if x % 3 == 0: c.px(x, 27, st[2]); c.px(x, 25, st[2])
    pillar(2, 16); pillar(48, 62)
    # 상인방 (앞면 + 윗면)
    for y in range(1, 16):
        for x in range(0, W):
            if y < 5: k = 6 if (y == 1) else 5
            else:
                k = 4 - (1 if y > 12 else 0) - (1 if x > W - 12 else 0) + (1 if x < 3 else 0)
                if (x + 7) % 16 == 0: k -= 1
            if _hash(x, y, seed + 5) < .06: k += 1 if _hash(y, x, 3) < .5 else -1
            c.px(x, y, st[cl(k, 1, 6)])
    # 쐐기돌 + 새김 호
    for y in range(6, 15):
        for x in range(28, 36): c.px(x, y, st[5 if x < 32 else 4])
    for a in range(0, 16): c.px(24 + a, 15, st[1]) if False else None
    # 갈라진 곳과 늘어진 덩굴
    for y in range(15, 24):
        if _hash(0, y, seed + 9) < .8: c.px(20 + (y // 3) % 3, y, LEAF[3] if y % 2 else LEAF[2])
        if _hash(1, y, seed + 9) < .8: c.px(43 + (y // 3) % 3, y, LEAF[3] if y % 2 else LEAF[4])
    return sh(mossify(fin(c, .6), seed, .25, .22), W / 2, H - 2, 28, 2.4, 55)

def spring(seed=5):
    """작은 샘 (2x2칸): 돌 테 + 맑은 청록 물 + 빛나는 물방울."""
    W, H = 32, 32; c = Cv(W, H); st = MOSSROCK
    cx, cy = 16, 18
    # 바깥 돌 테 (윗면 타원 + 앞면)
    for y in range(H):
        for x in range(W):
            dx = (x + .5 - cx) / 15.0; dy = (y + .5 - cy) / 9.0
            r2 = dx * dx + dy * dy
            if r2 <= 1:
                if r2 > .52: c.px(x, y, st[5 if dx + dy < -.4 else 4] if _hash(x, y, seed) > .12 else st[3])
                else:
                    t = (y - (cy - 7)) / 12.0
                    k = 3 if vnoise(x, y * 2, 3, seed) < .5 else 4
                    c.px(x, y, [(10, 56, 62), (14, 84, 90), (30, 136, 132), (80, 196, 170), (170, 238, 214)][cl(k - 1 + (1 if _hash(x, y, seed + 2) > .94 else 0), 0, 4)])
            elif dy > 0 and dx * dx + ((y - 3 + .5 - cy) / 9.0) ** 2 <= 1:   # 앞 테 두께
                c.px(x, y, st[3 if dx < .2 else 2])
    for (x, y) in ((12, 15), (13, 15), (19, 19)): c.px(x, y, (230, 255, 245))
    for x in range(1, 31):
        pass
    return sh(mossify(fin(c, .6), seed, .22, .2), 16, 29, 14, 2.4, 55)

def mushroom(kind='g', variant=0, seed=1):
    ramp = {'g': GLOW_G, 'p': SHROOM_P, 'b': GLOW_B}[kind]
    if variant == 0: W, H, caps = 16, 16, [(5, 14, 4, 9), (11, 14, 3, 6)]
    elif variant == 1: W, H, caps = 16, 32, [(8, 28, 6, 18), (3, 28, 3, 6)]
    else: W, H, caps = 32, 16, [(7, 13, 4, 5), (14, 14, 3, 3), (22, 13, 5, 7), (27, 14, 2, 3)]
    c = Cv(W, H)
    # 빛 번짐 (바닥)
    for y in range(H - 5, H):
        for x in range(0, W):
            d = ((x - W / 2.0) / (W / 2.0)) ** 2 + ((y - H + 2.5) / 3.0) ** 2
            if d < 1 and _hash(x, y, seed) < .5: c.p[x, y] = tuple(ramp[3]) + (50,)
    for (cx, base, rx, hh) in sorted(caps, key=lambda q: q[2]):
        stem = max(1, rx // 3)
        for y in range(base - hh + rx // 2, base + 1):
            for x in range(cx - stem, cx + stem + 1):
                c.px(x, y, (206, 214, 196) if x < cx else (150, 164, 148))
        cy = base - hh + rx // 2
        for y in range(cy - rx // 2 - 1, cy + 2):
            for x in range(cx - rx - 1, cx + rx + 2):
                dx = (x + .5 - cx) / (rx + .5); dy = (y + .5 - cy) / (rx * .85 + .5)
                if dx * dx + dy * dy <= 1 and dy < .55:
                    k = 5 if (dx < -.2 and dy < -.1) else (4 if dx < .3 else 3)
                    if dy > .2: k -= 1
                    c.px(x, y, ramp[cl(k, 1, 6)])
        c.px(cx - rx // 2, cy - rx // 2, ramp[6]); 
        if rx > 3: c.px(cx + 1, cy - 1, ramp[6])
    return fin(c, .56)

def log_fallen(w=48, seed=6, hollow=True):
    """쓰러진 이끼 통나무 (옆으로 누움). 윗면 이끼, 끝 단면 나이테."""
    H = 16; c = Cv(w, H); cy = 8; ry = 6
    for y in range(H):
        dy = (y + .5 - cy) / ry
        if abs(dy) > 1: continue
        nz = math.sqrt(1 - dy * dy)
        for x in range(2, w - 2):
            k = int(round((.25 + .75 * max(0, -.65 * dy + .75 * nz)) * 4.9 + .7))
            if _hash(x // 3, y, seed) < .12: k -= 1
            c.px(x, y, BARK[cl(k, 1, 6)])
    # 끝 단면 (왼쪽): 나이테
    for y in range(H):
        for x in range(0, 7):
            dx = (x + .5 - 3.5) / 3.5; dy = (y + .5 - cy) / ry; r = dx * dx + dy * dy
            if r <= 1:
                ring = int(math.sqrt(r) * 4.2)
                c.px(x, y, (BARK[5], BARK[4], BARK[5], BARK[3], BARK[2])[min(4, ring)] if not (hollow and r < .18) else BARK[0])
    # 가지 그루터기
    for (x, y) in ((w // 2, 1), (w // 2 + 1, 1), (w * 2 // 3, 2)): c.px(x, y, BARK[5])
    return sh(mossify(fin(c, .6), seed, .50, .45), w / 2, H - 2, w * .46, 1.8, 60)

def stump_giant(seed=7):
    W, H = 32, 24; c = Cv(W, H)
    cx = 16
    for y in range(8, H - 2):
        t = (y - 8) / 14.0; hw = 10 + t * 4
        for x in range(int(cx - hw), int(cx + hw)):
            dx = (x + .5 - cx) / hw
            k = int(round((.25 + .75 * max(0, -.7 * dx + .6 * math.sqrt(max(0, 1 - dx * dx)))) * 4.9 + .7))
            if _hash(x // 2, y, seed) < .14: k -= 1
            c.px(x, y, BARK[cl(k, 1, 6)])
    for y in range(2, 14):
        for x in range(4, 28):
            dx = (x + .5 - cx) / 12.5; dy = (y + .5 - 8) / 5.6
            r = dx * dx + dy * dy
            if r <= 1:
                ring = int(math.sqrt(r) * 5)
                c.px(x, y, (BARK[6], BARK[5], BARK[4], BARK[5], BARK[4], BARK[3])[min(5, ring)] if r > .04 else BARK[3])
    return sh(mossify(fin(c, .6), seed, .38, .3), 16, H - 2, 13, 2, 60)

def boulder_moss(w=32, h=24, seed=8):
    c = Cv(w, h); base = h - 3
    for y in range(h):
        for x in range(w):
            dx = (x + .5 - w / 2) / (w * .47); dy = (y + .5 - (base - h * .33)) / (h * .46)
            wob = (vnoise(x, y, 3, seed) - .5) * .28
            r2 = dx * dx + dy * dy * (1 if dy < 0 else .8) + wob
            if r2 > 1: continue
            nz = math.sqrt(max(.02, 1 - r2)); lv = .26 + .74 * max(0, -.55 * dx - .65 * dy + .75 * nz)
            k = int(round(lv * 4.9 + .7))
            if vnoise(x, y, 2.2, seed + 3) > .78: k -= 1
            c.px(x, y, MOSSROCK[cl(k, 1, 6)])
    return sh(mossify(fin(c, .6), seed, .30, .3), w / 2, h - 2, w * .44, 2.2, 60)

def fern_big(seed=9, n=9, w=16, h=16):
    c = Cv(w, h); rnd = random.Random(seed)
    for i in range(n):
        ang = -math.pi / 2 + (i - n / 2.0 + .5) * .52 + rnd.uniform(-.08, .08); L = rnd.uniform(7, 12)
        for s_ in range(int(L * 2)):
            t = s_ / (L * 2.0); r = t * L
            x = w / 2 + math.cos(ang) * r + (t * t) * (1 if math.cos(ang) > 0 else -1) * 1.8
            y = h - 3 + math.sin(ang) * r * .85 + t * t * 3
            xi, yi = int(round(x)), int(round(y))
            col = LEAF[cl(5 - int(t * 2) + (1 if math.cos(ang) < 0 else 0), 2, 6)]
            c.px(xi, yi, col)
            if 0.25 < t < .95 and s_ % 2: c.px(xi + 1, yi, LEAF[cl(4 - int(t * 2), 2, 5)]); c.px(xi - 1, yi + 1, LEAF[cl(3, 2, 5)])
    return sh(fin(c, .7), w / 2, h - 2, 5.5, 1.5, 50)

def glowflower(seed=10):
    c = Cv(16, 16); rnd = random.Random(seed)
    for (x, hgt) in ((4, 5), (8, 8), (12, 6), (6, 3)):
        for y in range(15 - hgt, 15): c.px(x, y, LEAF[3] if y % 2 else LEAF[2])
        y0 = 15 - hgt - 1
        for (dx, dy, k) in ((0, 0, 6), (-1, 0, 4), (1, 0, 4), (0, -1, 5), (0, 1, 3)): c.px(x + dx, y0 + dy, GLOW_B[k])
    for x in range(1, 15): c.px(x, 15, LEAF[2]) if _hash(x, 0, seed) < .5 else None
    return fin(c, .62)

def shelf_fungus(seed=11):
    c = Cv(16, 16)
    for (x0, y0, w) in ((2, 3, 9), (4, 8, 8), (6, 12, 6)):
        for y in range(y0, y0 + 3):
            for x in range(x0, x0 + w - (y - y0)):
                k = 5 if y == y0 else (4 if y == y0 + 1 else 3)
                if x < x0 + 2: k += 1
                c.px(x, y, (216 + 0, 168, 90) if k >= 5 else ((190, 126, 62) if k == 4 else (130, 78, 40)))
        c.px(x0, y0, (255, 230, 170))
    return fin(c, .66)

def vine_strand(h=2, seed=12):
    """가지에서 늘어진 덩굴 (16 x 16h): 가는 줄기 3가닥 + 잎."""
    H = h * T; c = Cv(16, H)
    for x0 in (3, 8, 12):
        ln = int((.45 + _hash(x0, 2, seed) * .5) * H); sway = _hash(x0, 5, seed) * 2
        for y in range(0, ln):
            x = x0 + int(round(math.sin(y / 5.0 + sway) * 1.2))
            c.px(x, y, LEAF[2] if y % 4 else LEAF[3])
            if y % 5 == 2: c.px(x - 1, y, LEAF[4]); c.px(x + 1, y, LEAF[3]); c.px(x - 1, y + 1, LEAF[3])
        c.px(x0 + int(round(math.sin(ln / 5.0 + sway) * 1.2)), ln, LEAF[5])
    return c.im

def web_between(w=2, seed=13):
    """나무 사이에 걸린 거미줄 (2x1칸, 반투명): 늘어진 호 + 방사 줄."""
    W, H = w * T, T; c = Cv(W, H); col = (214, 218, 230)
    for t in range(0, W * 2):
        x = t / 2.0
        yy = 2 + int(((x - W / 2.0) / (W / 2.0)) ** 2 * 1.6 * -1 + 5 * (1 - abs(2 * x / W - 1) ** 2))
        c.p[min(W - 1, int(x)), max(0, min(H - 1, yy))] = col + (200,)
    for k in range(7):
        x = int(W * (k + .5) / 7)
        for y in range(2, 9 + (k % 2) * 3):
            if (y + k) % 2 == 0: c.p[x, y] = col + (150,)
    for yy in (6, 9, 12):
        for x in range(2, W - 2):
            if (x + yy) % 3 == 0 and abs(x - W / 2.0) < (W / 2.0 - 2) * (1 - (yy - 6) / 10.0): c.p[x, yy] = col + (120,)
    return c.im

def web_corner(seed=14):
    c = Cv(16, 16)
    for ang_deg in (0, 28, 62, 90):
        ang = math.radians(ang_deg)
        for r in range(0, 15):
            x = int(r * math.cos(ang)); y = int(r * math.sin(ang))
            if 0 <= x < 16 and 0 <= y < 16: c.p[x, y] = (214, 218, 230, 190)
    for r in (5, 9, 13):
        for a in range(0, 31):
            ang = a / 30.0 * (math.pi / 2)
            x = int(r * math.cos(ang) + .5); y = int(r * math.sin(ang) + .5)
            if 0 <= x < 16 and 0 <= y < 16 and c.p[x, y][3] == 0 and (a + r) % 3: c.p[x, y] = (180, 186, 200, 150)
    return c.im

def root_bump(seed=15):
    """땅 위로 불룩한 뿌리 (2x1칸)."""
    c = Cv(32, 16)
    for x in range(1, 31):
        t = x / 31.0; hh = 9 * math.sin(t * math.pi) ** .8 + 1
        for y in range(int(14 - hh), 14):
            dy = (y + .5 - (14 - hh / 2.0)) / max(.8, hh / 2.0)
            k = int(round((.3 + .7 * max(0, -.6 * dy + .7 * math.sqrt(max(0, 1 - dy * dy)))) * 4.9 + .7))
            if _hash(x // 3, y, seed) < .15: k -= 1
            c.px(x, y, BARK[cl(k, 1, 6)])
    return sh(mossify(fin(c, .6), seed, .4, .4), 16, 14, 14, 1.6, 55)

def stairs_moss(seed=16):
    """이끼 낀 돌계단 (2x1칸): 올라가는 3단, 위쪽 어둡게(안쪽으로 올라가는 모양, 앞면이 보인다)."""
    W, H = 32, 16; c = Cv(W, H); st = MOSSROCK
    for b in range(4):
        y0 = b * 4
        for y in range(y0, y0 + 4):
            for x in range(1, 31):
                if y == y0: k = 6 - (1 if b > 1 else 0)
                elif y == y0 + 3: k = 1
                else: k = 4 - (1 if b == 0 else 0)
                if x < 3: k += 1
                if x > 28: k -= 1
                if _hash(x, y, seed) < .06: k += 1 if _hash(y, x, 2) < .5 else -1
                c.px(x, y, st[cl(k, 1, 6)])
    return mossify(fin(c, .6), seed, .22, .22)

def bowl_orb(seed=17):
    """돌 제기 + 떠 있는 빛 구슬 (1칸)."""
    c = Cv(16, 16); st = MOSSROCK
    for y in range(9, 15):
        t = (y - 9) / 5.0; hw = 4 + int(t * 2.5)
        for x in range(8 - hw, 8 + hw):
            c.px(x, y, st[cl((5 if x < 6 else 4) - (1 if x > 10 else 0) - (1 if y > 12 else 0), 1, 6)])
    for x in range(3, 13): c.px(x, 9, st[6 if x < 8 else 5]); c.px(x, 8, st[4]) if 4 < x < 11 else None
    for y in range(2, 8):
        for x in range(5, 11):
            dx = (x + .5 - 8) / 3.0; dy = (y + .5 - 5) / 3.0
            if dx * dx + dy * dy <= 1: c.px(x, y, GLOW_G[6] if dx + dy < -.4 else (GLOW_G[5] if dx + dy < .4 else GLOW_G[4]))
    return sh(mossify(fin(c, .6), seed, .3), 8, 14, 6, 1.4, 55)

def bush_dark(w=24, h=20, seed=18, flowers=False):
    """어두운 잎 덤불 (2x2칸 안): 잎덩이 높이장."""
    rnd = random.Random(seed); cx = w / 2.0
    clumps = [(cx, h * .52, w * .46, h * .38), (cx - w * .22, h * .6, w * .26, h * .28), (cx + w * .22, h * .6, w * .26, h * .26)]
    im, mk = leaf_canopy(w, h - 3, clumps, seed, amb=.22, ramp=LEAF)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0)); out.alpha_composite(im, (0, 0))
    if flowers:
        p = out.load()
        for _ in range(9):
            x = rnd.randrange(3, w - 3); y = rnd.randrange(3, h - 6)
            if p[x, y][3]: p[x, y] = tuple(GLOW_B[5]) + (255,); 
    return sh(pz.fin(out, .62), w / 2, h - 2, w * .42, 2, 55)

def motes(seed=19, n=7):
    """떠다니는 빛 알갱이 (2x2칸, 반투명): 맵 위에 덧얹는 장식."""
    W, H = 32, 32; c = Cv(W, H); rnd = random.Random(seed)
    for _ in range(n):
        x = rnd.randrange(2, W - 2); y = rnd.randrange(2, H - 2)
        c.p[x, y] = tuple(GLOW_G[6]) + (255,)
        for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            c.p[x + dx, y + dy] = tuple(GLOW_G[4]) + (120,)
    return c.im

def tree_arch(seed=20):
    """고목 아치 (4x5칸): 휘어진 두 줄기가 위에서 만나 수관으로 이어진다. 가운데 두 칸은 길."""
    W, H = 64, 80; c = C(W, H, seed); rnd = random.Random(seed)
    base = H - 6
    for (cx, lean) in ((14, 7), (50, -7)):
        c.shadow(cx, H - 3, 12, 3, 100)
        AT._roots(c, cx, base - 1, 15, 3, seed + cx, thick=3.6, style=(3 if cx < 30 else 2), w=40)
        c.new()
        for y in range(int(H * .22), base + 1):
            t = max(0.0, (y - H * .22) / (base - H * .22))
            xc = cx + lean * (1 - t) ** 1.6
            hw = 4.2 + 3.2 * t ** 2.4
            for x in range(int(xc - hw) - 1, int(xc + hw) + 2):
                dx = (x + .5 - xc) / hw
                if abs(dx) > 1: continue
                v = c.shade(dx * .95, .15, math.sqrt(max(.02, 1 - dx * dx)), .22)
                if _hash(x // 2, 0, seed + cx) < .28: v -= .14
                c.setv(x, y, 'bark', v)
    im = fin(c, .6)
    clumps = [(32, 20, 26, 14), (14, 26, 13, 11), (50, 26, 13, 11), (32, 12, 14, 9)]
    cn, mk = leaf_canopy(W, 44, clumps, seed + 3, amb=.22, ramp=LEAF)
    big = Image.new('RGBA', (W, H), (0, 0, 0, 0)); big.alpha_composite(im); big.alpha_composite(cn)
    return pz.fin(big, .6)

def stepping_stones(seed=21):
    """여울 징검돌 (2x1칸): 둥근 돌이 지그재그. 물 위에 얹는다(걸을 수 있음)."""
    c = Cv(32, 16); st = MOSSROCK
    for (cx, cy, rx, ry) in ((5, 10, 4.5, 3), (13, 5, 4, 2.8), (21, 10, 4.5, 3), (28, 6, 3.6, 2.6)):
        for y in range(16):
            for x in range(32):
                dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry
                if dx * dx + dy * dy <= 1:
                    k = 5 if dx + dy < -.5 else (4 if dx < .3 else 3)
                    if dy > .4: k -= 1
                    if _hash(x, y, seed) < .1: k += 1
                    c.px(x, y, st[cl(k, 1, 6)])
    return sh(fin(c, .6), 16, 13, 14, 2, 40)
