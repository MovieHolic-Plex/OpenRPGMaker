# 선술집 지하·주방 — 저장고 물건(통·포도주 선반·병 상자·자루·나무 상자·치즈 시렁·장작·빗자루·물통).
from tc_base import *
from tc_base import _hash

def staves_cyl(cv, x0, x1, y0, y1, ramp, bulge=1.0, hoops=(), seed=0, stave=3):
    """세운 통 몸통: 위아래로 갈수록 좁고 가운데가 불룩, 세로 널(stave px 마다 한 단 어두운 이음), 쇠테."""
    h = y1 - y0
    for y in range(y0, y1):
        b = math.sin(math.pi * (y - y0 + .5) / h) * bulge
        xa = x0 - b; xb = x1 + b
        for x in range(int(math.floor(xa + .5)), int(math.floor(xb + .5))):
            k = cyl_k(x, xa, xb)
            if (x - x0) % stave == stave - 1: k -= 1
            if y in hoops:
                cv.px(x, y, IRON[clamp(k, 1, 6)]); continue
            if _hash(x, y, seed + 2) < .05: k -= 1
            cv.px(x, y, ramp[clamp(k - (1 if y >= y1 - 2 else 0), 1, 6)])

def barrel_up(cv, x0, by, w=14, h=18, seed=0, lid=True):
    """세운 통: 몸통 + 쇠테 셋 + 윗면 뚜껑 타원(널 결·테두리 쇠테)."""
    y0 = by - h
    staves_cyl(cv, x0, x0 + w, y0 + 3, by, BARK, 1.0, hoops=(y0 + 5, y0 + 6, by - 4, by - 5, (y0 + by) // 2 + 1), seed=seed)
    cx = x0 + w / 2.0; cy = y0 + 3.0
    for y in range(int(cy - 3), int(cy + 4)):
        for x in range(x0 - 1, x0 + w + 1):
            dx = (x + .5 - cx) / (w / 2.0 + .6); dy = (y + .5 - cy) / 3.2
            d = dx * dx + dy * dy
            if d > 1: continue
            if d > .62: c = IRON[4] if dy < 0 else IRON[3]
            else:
                k = 5 if dx < .1 else 4
                if int(y) == int(cy): k = 3                                               # 뚜껑 널 이음(가로 한 줄)
                if dx > .55: k -= 1
                c = OAK[k]
            cv.px(x, y, c)
    cv.hline(x0, x0 + w, by, SHADE)

def barrel_upright(seed=0):
    cv = Cv(16, 32); barrel_up(cv, 1, 30, seed=seed); return fin(cv)

def barrel_cluster(seed=0):
    """세운 통 넷 덩이 2x2(참고 그림처럼 둘씩 두 줄, 뒷줄이 반쯤 가린다)."""
    cv = Cv(32, 40)
    barrel_up(cv, 2, 22, seed=seed); barrel_up(cv, 16, 21, seed=seed + 1)
    barrel_up(cv, 1, 38, seed=seed + 2); barrel_up(cv, 17, 38, seed=seed + 3)
    return fin(pad16(cv.im))

def barrel_end(cv, cx, cy, r=12, seed=0, tap=False, chalk=False):
    """눕힌 통의 둥근 마구리(남쪽을 본다): 가운데 널 이음 가로줄, 바깥 쇠테 둘, 왼쪽 위 밝고 오른쪽 아래 어둡다. 위로 몸통 윗면 한 띠."""
    for y in range(int(cy - r - 4), int(cy - r + 3)):                                       # 몸통 윗면(통 배가 뒤로 이어진다)
        for x in range(int(cx - r + 2), int(cx + r - 1)):
            k = cyl_k(x, cx - r + 2, cx + r - 1)
            if y == int(cy - r - 4): k -= 1
            if y == int(cy - r + 1) or y == int(cy - r - 2): cv.px(x, y, IRON[clamp(k, 1, 6)]); continue
            cv.px(x, y, BARK[clamp(k + 1, 1, 6)])
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            dx = x + .5 - cx; dy = y + .5 - cy
            d = math.hypot(dx, dy)
            if d > r: continue
            if d > r - 2.2:
                c = IRON[4] if dx + dy < -3 else (IRON[3] if dx + dy < 6 else IRON[2])
            elif d > r - 3.2:
                c = BARK[2]
            elif d > r - 5.4 and d < r - 4.4:
                c = IRON[3] if dx + dy < 0 else IRON[2]
            else:
                k = 4 if dx + dy < -4 else (3 if dx + dy < 7 else 2)
                if int(dy + 50) % 5 == 4: k = 1                                              # 마구리 널 이음
                if _hash(x, y, seed + 7) < .06: k += 1
                c = OAK[clamp(k, 1, 6)]
            cv.px(x, y, c)
    if tap:
        tx, ty = int(cx) - 1, int(cy + r * .45)
        cv.rect(tx, ty, tx + 3, ty + 3, COP[4]); cv.px(tx, ty, COP[6]); cv.px(tx + 2, ty + 2, COP[2])
        cv.vline(tx + 1, ty + 3, ty + 6, COP[3]); cv.px(tx - 1, ty + 1, COP[5]); cv.px(tx + 3, ty + 1, COP[2])
    if chalk:                                                                                 # 분필 표시(글자 아님: 줄 셋과 동그라미)
        for i in range(3): cv.vline(int(cx - 5 + i * 2), int(cy - 4), int(cy - 1), GAR[4])
        cv.px(int(cx + 4), int(cy - 3), GAR[4]); cv.px(int(cx + 3), int(cy - 2), GAR[4]); cv.px(int(cx + 5), int(cy - 2), GAR[4]); cv.px(int(cx + 4), int(cy - 1), GAR[4])

def cradle(cv, x0, x1, y):
    """눕힌 통 받침목: 짙은 나무 각목 한 줄 + 쐐기."""
    box3(cv, x0, y, x1, y + 4, 1, WOOD, 3)
    for x in (x0 + 2, x1 - 5):
        cv.rect(x, y - 2, x + 3, y, WOOD[4]); cv.px(x, y - 2, WOOD[5])

def keg_tap(seed=0):
    """꼭지 단 술통 2x2: 받침목 위 눕힌 통 마구리 + 구리 꼭지 + 밑 받친 나무 잔."""
    cv = Cv(32, 32)
    cradle(cv, 1, 31, 26)
    barrel_end(cv, 16, 14, 11, seed, tap=True)
    cv.rect(13, 27, 18, 31, OAK[3]); cv.vline(13, 27, 31, OAK[5]); cv.hline(13, 18, 26, OAK[2])
    cv.hline(2, 31, 31, SHADE)
    return fin(cv)

def barrel_stack(seed=0):
    """눕힌 통 셋 피라미드 3x3: 아래 둘, 위 하나(마구리가 남쪽을 본다), 받침목·쐐기."""
    cv = Cv(48, 48)
    barrel_end(cv, 24, 15, 11, seed + 1)
    barrel_end(cv, 12, 34, 11, seed + 2)
    barrel_end(cv, 36, 34, 11, seed + 3)
    cradle(cv, 0, 48, 43)
    cv.hline(1, 47, 47, SHADE)
    return fin(cv)

def barrel_lying_h(seed=0):
    """옆으로 누운 통(동서) 2x1: 몸통 옆면 가로 원통 + 세로 쇠테, 양 끝 마구리 테."""
    cv = Cv(32, 16)
    for y in range(2, 14):
        t = (y - 2) / 12.0
        k = 4 if t < .15 else (5 if t < .4 else (4 if t < .6 else (3 if t < .82 else 2)))
        bul = int(round(math.sin(math.pi * t) * 1.2))
        for x in range(3 - bul, 29 + bul):
            kk = k
            if x in (7, 8, 23, 24): cv.px(x, y, IRON[clamp(kk, 1, 6)]); continue
            if x <= 4 - bul: kk = 3
            if x >= 27 + bul: kk = 2
            if y % 3 == 2 and 5 < x < 27: kk -= 1
            cv.px(x, y, BARK[clamp(kk, 1, 6)])
    cv.hline(4, 28, 15, SHADE)
    return fin(cv)

# ---------------------------------------------------------------- 포도주 선반·병
def bottle_end(cv, cx, cy, ramp=BOT, cork=True):
    """눕힌 병 바닥(마구리) 동그라미 r=2: 짙은 유리 + 빛 한 점."""
    for y in range(cy - 2, cy + 3):
        for x in range(cx - 2, cx + 3):
            d = (x - cx) ** 2 + (y - cy) ** 2
            if d > 5: continue
            c = ramp[2] if d > 2 else ramp[3]
            cv.px(x, y, c)
    cv.px(cx - 1, cy - 1, ramp[5])

def wine_rack(seed=0, full=True):
    """포도주 선반 2x3(벽에 붙는다): 나무 틀에 마름모 칸, 칸마다 눕힌 병 마구리(초록·검붉은 병), 맨 위 윗면 널."""
    cv = Cv(32, 48)
    box3(cv, 0, 0, 32, 4, 2, OAK, seed)
    for y in range(4, 46):
        for x in range(1, 31):
            cv.px(x, y, OAK[1])
    for y in range(4, 46):                                                                  # 틀: 세로 기둥 + 가로 선반 널
        for x in (1, 2, 29, 30):
            cv.px(x, y, OAK[4] if x in (1, 2) and x == 1 else (OAK[3] if x < 10 else OAK[2]))
    rows = (11, 19, 27, 35, 43)
    for ry in rows:
        for x in range(1, 31): cv.px(x, ry, OAK[4]); cv.px(x, ry + 1, OAK[2])
    k = 0
    for i, ry in enumerate(rows):
        for j, bx in enumerate(range(6, 29, 5)):
            k += 1
            if not full and _hash(i, j, seed + 9) < .45: continue
            ramp = BOT if _hash(i, j, seed + 3) < .6 else WINE
            bottle_end(cv, bx, ry - 3, ramp)
    for x in range(3, 29, 13):                                                              # 가운데 세로 칸막이
        pass
    cv.hline(0, 32, 46, OAK[2]); cv.hline(1, 31, 47, SHADE)
    return fin(cv)

def bottle_crate(seed=0):
    """병 상자 1x1: 낮은 나무 상자에 선 병 목 여섯."""
    cv = Cv(16, 16)
    box3(cv, 1, 7, 15, 15, 0, OAK, seed, vplanks=0)
    for x in range(1, 15): cv.px(x, 7, OAK[4]); cv.px(x, 11, OAK[2])
    for i, x in enumerate((3, 6, 9, 12)):
        ramp = BOT if i % 2 == 0 else WINE
        cv.vline(x, 2, 8, ramp[3]); cv.vline(x + 1, 2, 8, ramp[2]); cv.px(x, 1, CLAY[4]); cv.px(x + 1, 1, CLAY[3]); cv.px(x, 3, ramp[5])
    cv.hline(1, 15, 15, SHADE)
    return fin(cv)

# ---------------------------------------------------------------- 자루·상자
def sack(cv, cx, by, w=12, h=13, seed=0, tie=True, ramp=SACK):
    """삼베 자루: 아래가 퍼진 둥근 몸통, 위 묶은 목·주름, 삼베 결(가로 점)."""
    cy = by - h * .45
    for y in range(by - h, by):
        t = (y - (by - h)) / float(h)
        half = w / 2.0 * (.55 + .45 * math.sin(min(1, t * 1.3) * math.pi / 2)) if t > .18 else w * .18
        for x in range(int(cx - half), int(cx + half + .5)):
            k = cyl_k(x, cx - half, cx + half)
            if t < .18: k = 4 if x < cx else 3
            if (x + y * 2) % 4 == 0 and t > .2: k -= 1
            if y >= by - 2: k -= 1
            cv.px(x, y, ramp[clamp(k, 1, 6)])
    if tie:
        ty = by - h + int(h * .18)
        cv.hline(int(cx - w * .2), int(cx + w * .2) + 1, ty, ROPE[4]); cv.px(int(cx + w * .2) + 1, ty + 1, ROPE[3])

def sack_pile(seed=0):
    """자루 더미 2x2: 뒤에 누운 자루 둘, 앞에 선 자루 둘(밀가루·곡식), 하나는 터져 곡식이 샌다."""
    cv = Cv(32, 32)
    sack(cv, 9, 20, 14, 14, seed, tie=False); sack(cv, 22, 19, 14, 14, seed + 1)
    sack(cv, 8, 31, 13, 13, seed + 2); sack(cv, 23, 31, 13, 14, seed + 3, ramp=LINEN)
    for (x, y) in ((14, 30), (15, 31), (16, 30), (13, 31), (17, 31)): cv.px(x, y, CHZ[4])
    return fin(cv)

def sack_single(seed=0):
    cv = Cv(16, 16); sack(cv, 8, 15, 12, 14, seed); return fin(cv)

def crate(cv, x0, by, w=14, h=12, top=4, seed=0, mark=False):
    """나무 상자: 윗면(가로 널) + 앞면(가로 널 + 대각 버팀목)."""
    y0 = by - h
    box3(cv, x0, y0, x0 + w, by, top, OAK, seed, planks=2)
    for i in range(w - 2):
        y = by - 2 - int(i * (h - top - 2) / float(w - 2))
        cv.px(x0 + 1 + i, y, OAK[4])
    for x in (x0, x0 + w - 1):
        for y in range(y0 + top, by): cv.px(x, y, OAK[4] if x == x0 else OAK[2])
    if mark:                                                                                 # 낙인(그림 기호: 포도송이 점)
        for (dx, dy) in ((0, 0), (2, 0), (1, 1), (3, 1), (2, 2)): cv.px(x0 + w // 2 - 2 + dx, y0 + top + 2 + dy, WINE[2])
    cv.hline(x0, x0 + w, by, SHADE)

def crate_single(seed=0):
    cv = Cv(16, 16); crate(cv, 1, 15, seed=seed, mark=True); return fin(cv)

def crate_stack(seed=0):
    """나무 상자 둘 쌓기 1x2."""
    cv = Cv(16, 32)
    crate(cv, 1, 31, seed=seed); crate(cv, 2, 19, w=12, h=11, seed=seed + 1, mark=True)
    return fin(cv)

# ---------------------------------------------------------------- 치즈 시렁·장작·빗자루·물통
def cheese_rack(seed=0):
    """치즈 시렁 2x3(벽에 붙는다): 나무 사다리 선반 세 단에 둥근 치즈 바퀴들."""
    cv = Cv(32, 48)
    for x in (1, 2, 29, 30):
        for y in range(2, 47): cv.px(x, y, OAK[4] if x in (1, 29) else OAK[2])
    for sy in (14, 28, 42):
        box3(cv, 1, sy, 31, sy + 3, 2, OAK, seed + sy)
        n = 0
        for cx in range(7, 28, 9):
            n += 1
            if _hash(sy, cx, seed) < .15: continue
            for y in range(sy - 8, sy):
                for x in range(cx - 5, cx + 5):
                    dx = (x + .5 - cx) / 4.8
                    if abs(dx) > 1: continue
                    ey = 1.9 * math.sqrt(max(0, 1 - dx * dx))
                    tc = sy - 6                                                            # 윗면 타원 가운데
                    if y < tc - ey or y > sy - 2 + ey * .5: continue
                    if y <= tc + ey:
                        k = 5 if dx < -.15 else 4
                        if y > tc + ey - 1: k = 3
                    else:
                        k = cyl_k(x, cx - 5, cx + 5) - 1
                        if y >= sy - 2 + ey * .5 - 1: k -= 1
                    cv.px(x, y, CHZ[clamp(k, 1, 6)])
            if _hash(sy, cx, seed + 4) < .35:                                                # 잘라 낸 쐐기(속 밝은 면)
                for y in range(sy - 7, sy - 4):
                    for x in range(cx, cx + 4 - (y - sy + 7)): cv.px(x, y, CHZ[6])
    cv.hline(1, 31, 47, SHADE)
    return fin(cv)

def firewood(seed=0):
    """장작 더미 2x1: 쌓은 통나무 마구리(나이테)와 껍질."""
    cv = Cv(32, 16)
    logs = [(5, 12), (11, 12), (17, 12), (23, 12), (28, 12), (8, 7), (14, 7), (20, 7), (26, 7), (11, 3), (17, 3)]
    for (cx, cy) in logs:
        if cy == 3 and _hash(cx, cy, seed) < .2: continue
        for y in range(cy - 3, cy + 3):
            for x in range(cx - 3, cx + 4):
                d = (x - cx) ** 2 + ((y - cy) * 1.15) ** 2
                if d > 10: continue
                c = BARK[2] if d > 6 else (SACK[5] if d > 2.5 else SACK[4])
                if 2.5 < d <= 6 and (x - cx) + (y - cy) > 1: c = SACK[4]
                if d <= 1: c = SACK[3]
                cv.px(x, y, c)
    cv.hline(2, 31, 15, SHADE)
    return fin(cv)

def broom(seed=0):
    """벽에 기댄 빗자루 1x2: 긴 자루 + 짚 솔."""
    cv = Cv(16, 32)
    for i in range(22):
        x = 4 + i * 5 // 22; y = 2 + i
        cv.px(x, y, OAK[5]); cv.px(x + 1, y, OAK[3])
    for y in range(23, 31):
        w = 2 + (y - 23) // 2
        for x in range(9 - w, 10 + w):
            cv.px(x, y, STRAW[4 if (x + y) % 3 else 2] if x < 9 + w - 1 else STRAW[2])
    cv.hline(7, 12, 24, ROPE[2])
    cv.hline(5, 14, 31, SHADE)
    return fin(cv)

def bucket(seed=0):
    """나무 물통 1x1: 좁아지는 통 + 쇠테 둘 + 손잡이, 속 물빛."""
    cv = Cv(16, 16)
    staves_cyl(cv, 4, 12, 6, 15, OAK, 0, hoops=(8, 13), seed=seed, stave=2)
    for x in range(3, 13): cv.px(x, 5, IRON[3])
    for x in range(4, 12): cv.px(x, 6, PUD[4] if x < 8 else PUD[3])
    for i, x in enumerate(range(3, 13)): cv.px(x, 2 + abs(i - 4) // 2 - 1, IRON[4])
    cv.hline(4, 13, 15, SHADE)
    return fin(cv)
