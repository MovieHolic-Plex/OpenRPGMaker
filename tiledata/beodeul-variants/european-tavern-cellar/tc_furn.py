# 선술집 지하·주방 — 가구(의자·식탁·긴 의자·걸상·찬장·작은 식탁). 3/4 시점(윗면+앞면), 빛 왼쪽 위, 참나무 OAK 7단.
from tc_base import *
from tc_base import _hash

# ---------------------------------------------------------------- 탁자 위 작은 것들(식탁 변형에 굽는다)
def plate(cv, cx, cy, food=None):
    """흰 질그릇 접시(위에서 비스듬히): 타원 테 + 안쪽 한 단 어둡게, 음식(빵·고기) 점."""
    for y in range(cy - 2, cy + 3):
        for x in range(cx - 3, cx + 4):
            dx = (x + .5 - cx - .5) / 3.6; dy = (y + .5 - cy - .5) / 2.4
            d = dx * dx + dy * dy
            if d > 1: continue
            c = GAR[5] if d > .5 else GAR[4]
            if d > .5 and dy > .2: c = GAR[3]
            cv.px(x, y, c)
    cv.hline(cx - 2, cx + 3, cy + 3, GAR[2])
    if food == 'bread':
        cv.rect(cx - 1, cy - 1, cx + 2, cy + 1, CHZ[3]); cv.px(cx - 1, cy - 1, CHZ[5]); cv.px(cx + 1, cy, CHZ[2])
    elif food == 'meat':
        cv.rect(cx - 1, cy - 1, cx + 2, cy + 1, MEAT[3]); cv.px(cx - 1, cy - 1, MEAT[5]); cv.px(cx + 1, cy, MEAT[1])

def plate_stack(cv, cx, by, n=5):
    """접시 더미: 접시 테 n 장이 쌓여 위로 오른다(참고 그림의 흰 접시 탑)."""
    for i in range(n):
        y = by - i * 2
        for x in range(cx - 4, cx + 5):
            t = (x - cx + 4) / 8.0
            c = GAR[5] if t < .35 else (GAR[4] if t < .75 else GAR[3])
            cv.px(x, y, c); cv.px(x, y + 1, GAR[2] if t > .2 else GAR[3])
    top = by - (n - 1) * 2 - 2
    for y in range(top - 1, top + 2):
        for x in range(cx - 4, cx + 5):
            dx = (x + .5 - cx - .5) / 4.6; dy = (y + .5 - top - .5) / 1.8
            if dx * dx + dy * dy <= 1: cv.px(x, y, GAR[6] if dx < 0 else GAR[5])

def pitcher(cv, x, by, ramp=TRIM):
    """백랍 물주전자: 배 불룩한 몸통·주둥이·손잡이."""
    for y in range(by - 8, by):
        w = 2 if y < by - 6 else 3
        for xx in range(x - w, x + w + 1):
            cv.px(xx, y, R(ramp, cyl_k(xx, x - w, x + w + 1)))
    cv.px(x - 3, by - 8, ramp[5]); cv.px(x - 4, by - 9, ramp[4])                         # 주둥이
    cv.vline(x + 4, by - 7, by - 3, ramp[2]); cv.px(x + 3, by - 7, ramp[3]); cv.px(x + 3, by - 3, ramp[3])
    cv.hline(x - 2, x + 3, by - 9, ramp[5])
    cv.hline(x - 3, x + 4, by, SHADE)

def mug(cv, x, by, ramp=CLAY, foam=True):
    """나무·질그릇 잔(손잡이 오른쪽), 위에 거품."""
    cv.rect(x, by - 5, x + 4, by, ramp[3]); cv.vline(x, by - 5, by, ramp[5]); cv.vline(x + 3, by - 5, by, ramp[2])
    cv.vline(x + 4, by - 4, by - 1, ramp[2])
    cv.hline(x, x + 4, by - 6, GAR[5] if foam else ramp[1])
    if foam: cv.px(x + 1, by - 7, GAR[6])

def candle(cv, x, by):
    cv.rect(x, by - 4, x + 2, by, GAR[5]); cv.px(x + 1, by - 4, GAR[3])
    cv.px(x, by - 5, FIRE[5]); cv.px(x, by - 6, FIRE[6]); cv.px(x + 1, by - 5, FIRE[4])
    cv.hline(x - 1, x + 3, by, CLAY[2])

def bread_loaf(cv, cx, cy):
    blob_ell(cv, cx, cy, 3.6, 2.4, CHZ, base=3, seed=cx)
    cv.px(cx - 1, cy - 1, CHZ[1]); cv.px(cx + 1, cy - 1, CHZ[1])

# ---------------------------------------------------------------- 식탁
def table_top(cv, x0, y0, x1, y1, seed=0, vertical=True):
    """식탁 윗면: 널 결(세로 또는 가로 널 5px), 왼쪽 위 테 밝음, 오른쪽·아래 테 어둡다, 묵은 얼룩."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            a = (x - x0) if vertical else (y - y0)
            b = y if vertical else x
            k = 4 if (a // 5) % 2 == 0 else 3
            if a % 5 == 4: k = 2
            g = grain(a * 7 + b, b * 3 + a) - 3
            if g >= 2: k += 1
            elif g <= -2: k -= 1
            if y == y0 or x == x0: k = 5
            elif x == x1 - 1 or y == y1 - 1: k = 2
            if pn(x * 3, y * 3, 8, seed + 61) > .8: k -= 1
            cv.px(x, y, OAK[clamp(k, 1, 6)])

def table_front(cv, x0, x1, y0, h_apron, h_leg, legw=3):
    """식탁 앞면: 앞널(apron) h_apron 줄 + 다리 둘(왼쪽 밝고 오른쪽 어둡다) + 다리 밑 그늘."""
    for y in range(y0, y0 + h_apron):
        for x in range(x0, x1):
            k = 3 if x < x1 - 2 else 2
            if y == y0: k = 2
            if x == x0: k = 4
            cv.px(x, y, OAK[k])
    ly = y0 + h_apron
    for lx in (x0 + 1, x1 - 1 - legw):
        for y in range(ly, ly + h_leg):
            for x in range(lx, lx + legw):
                cv.px(x, y, OAK[(4, 3, 2)[min(2, x - lx)]])
    cv.hline(x0 + 2, x1 - 1, ly + h_leg, SHADE)

def long_table_v(items=False, seed=0):
    """긴 식탁(남북으로 김) 2x4: 세로 널 윗면 + 남쪽 끝 앞널·다리."""
    cv = Cv(32, 64)
    table_top(cv, 2, 2, 30, 52, seed)
    table_front(cv, 2, 30, 52, 4, 5)
    for x in (3, 26):                                                                      # 뒤 다리 끝(윗면 위로 비죽 안 나온다 — 북쪽 끝 그늘)
        pass
    if items:
        plate_stack(cv, 16, 18, 5)
        pitcher(cv, 9, 31); pitcher(cv, 13, 33)
        plate(cv, 21, 40, 'meat'); plate(cv, 9, 45, 'bread')
        mug(cv, 22, 30); candle(cv, 19, 48)
    return fin(cv)

def long_table_h(items=False, seed=0):
    """긴 식탁(동서로 김) 4x2: 가로 널 윗면 + 앞널·다리 넷."""
    cv = Cv(64, 32)
    table_top(cv, 1, 2, 63, 21, seed, vertical=False)
    table_front(cv, 1, 63, 21, 4, 5)
    for x in range(28, 31):
        for y in range(25, 30): cv.px(x, y, OAK[(4, 3, 2)[x - 28]])
    if items:
        plate(cv, 10, 9, 'bread'); plate(cv, 25, 13, 'meat'); plate(cv, 47, 8)
        mug(cv, 34, 12); mug(cv, 55, 17); pitcher(cv, 40, 17); bread_loaf(cv, 18, 16); candle(cv, 31, 9)
    return fin(cv)

def small_table(items=True, seed=0):
    """작은 네모 식탁 2x2: 윗면 + 앞널·다리, 잔 둘·촛불."""
    cv = Cv(32, 32)
    table_top(cv, 3, 4, 29, 21, seed, vertical=False)
    table_front(cv, 3, 29, 21, 3, 6)
    if items:
        mug(cv, 8, 13); mug(cv, 19, 17, ramp=OAK); candle(cv, 15, 10)
    return fin(cv)

# ---------------------------------------------------------------- 의자·걸상·긴 의자
def chair(facing='s', seed=0):
    """나무 의자 1x1. facing = 앉은 사람이 보는 쪽. s: 등받이 북쪽(위), n: 등받이 남쪽(앞), e: 등받이 서쪽, w: 등받이 동쪽."""
    cv = Cv(16, 16)
    def seat(x0, y0, x1, y1):
        for y in range(y0, y1):
            for x in range(x0, x1):
                k = 5 if (y == y0 or x == x0) else 4
                if x == x1 - 1: k = 3
                if (y - y0) == 2: k -= 1
                cv.px(x, y, OAK[k])
        cv.hline(x0, x1, y1, OAK[2]); cv.hline(x0, x1, y1 + 1, OAK[1])
    def legs(xs, y0, y1):
        for lx in xs:
            for y in range(y0, y1): cv.px(lx, y, OAK[4]); cv.px(lx + 1, y, OAK[2])
    if facing == 's':
        legs((3, 11), 2, 9)                                                                # 등받이 기둥
        for x in range(3, 13): cv.px(x, 1, OAK[5]); cv.px(x, 2, OAK[4]); cv.px(x, 3, OAK[2])
        for x in range(5, 11): cv.px(x, 5, OAK[4]); cv.px(x, 6, OAK[2])
        seat(2, 8, 14, 11)
        legs((2, 12), 13, 15); cv.hline(2, 14, 15, SHADE)
    elif facing == 'n':
        seat(2, 4, 14, 7)
        legs((2, 12), 9, 15)
        legs((3, 11), 0, 12)                                                               # 등받이(앞에 보인다)
        for x in range(3, 13): cv.px(x, 0, OAK[5]); cv.px(x, 1, OAK[4]); cv.px(x, 2, OAK[2])
        for x in range(5, 11): cv.px(x, 6, OAK[4]); cv.px(x, 7, OAK[2])
        cv.hline(2, 14, 15, SHADE)
    else:
        if facing == 'e': seat(4, 7, 14, 10); legs((4, 12), 12, 15)
        else: seat(2, 7, 12, 10); legs((2, 10), 12, 15)
        bx = 2 if facing == 'e' else 12
        for y in range(1, 13): cv.px(bx, y, OAK[5] if facing == 'e' else OAK[4]); cv.px(bx + 1, y, OAK[3])
        cv.px(bx, 0, OAK[5]); cv.px(bx + 1, 0, OAK[4])
        for y in (3, 4, 7): cv.px(bx + (2 if facing == 'e' else -1), y, OAK[3])
        cv.hline(2, 15, 15, SHADE)
    im = fin(cv)
    return im

def stool(seed=0):
    """둥근 걸상 1x1: 둥근 윗면 + 세 다리."""
    cv = Cv(16, 16)
    topell(cv, 8, 7, 5, 2.6, OAK, 5, 4, seed)
    cv.hline(3, 13, 9, OAK[2])
    for (x, y0) in ((4, 10), (7, 10), (11, 10)):
        for y in range(y0, 15): cv.px(x, y, OAK[4] if x < 10 else OAK[2]); cv.px(x + 1, y, OAK[3] if x < 10 else OAK[1])
    cv.hline(5, 11, 12, OAK[3])
    cv.hline(3, 13, 15, SHADE)
    return fin(cv)

def bench(seed=0):
    """긴 의자 2x1: 두꺼운 널 윗면 + 앞면 + 다리 둘."""
    cv = Cv(32, 16)
    box3(cv, 1, 5, 31, 10, 3, OAK, seed, planks=0)
    for lx in (3, 26):
        for y in range(10, 15): cv.px(lx, y, OAK[4]); cv.px(lx + 1, y, OAK[3]); cv.px(lx + 2, y, OAK[2])
    cv.hline(2, 31, 15, SHADE)
    return fin(cv)

# ---------------------------------------------------------------- 찬장(유리문)
def cupboard(seed=0):
    """유리문 찬장 2x3(벽에 붙는다): 위 처마 → 유리문 둘(안에 접시·병이 비친다) → 윗면 선반 → 아래 장 문 둘 → 받침."""
    cv = Cv(32, 48)
    box3(cv, 0, 0, 32, 4, 2, OAK, seed)                                                     # 처마
    for y in range(4, 26):
        for x in range(1, 31):
            k = 3 if x < 29 else 2
            if x in (1, 2): k = 4
            cv.px(x, y, OAK[k])
    for dx0 in (3, 17):                                                                    # 유리문 둘
        for y in range(6, 24):
            for x in range(dx0, dx0 + 12):
                if x in (dx0, dx0 + 11) or y in (6, 23): cv.px(x, y, OAK[2] if x == dx0 + 11 or y == 23 else OAK[5]); continue
                if x == dx0 + 6 or y == 14: cv.px(x, y, OAK[3]); continue
                c = GLASS[2] if (x + y) % 9 else GLASS[3]
                cv.px(x, y, c)
        for (px_, py_) in ((dx0 + 3, 12), (dx0 + 8, 12)):                                  # 안쪽 접시(선반 위 세워 둔)
            for yy in range(py_ - 4, py_ + 1):
                for xx in range(px_ - 2, px_ + 3):
                    if (xx - px_) ** 2 + ((yy - py_ + 2) * 1.2) ** 2 <= 6: cv.px(xx, yy, GAR[3] if xx < px_ else GAR[2])
        for (px_, py_) in ((dx0 + 2, 22), (dx0 + 5, 22), (dx0 + 8, 22)):                   # 아래 칸 병
            cv.vline(px_, py_ - 5, py_ + 1, BOT[3]); cv.vline(px_ + 1, py_ - 5, py_ + 1, BOT[2]); cv.px(px_, py_ - 7, BOT[4]); cv.px(px_, py_ - 6, BOT[3])
        cv.px(dx0 + 1, 7, GLASS[6]); cv.px(dx0 + 2, 8, GLASS[5])                          # 유리 빛
    box3(cv, 0, 26, 32, 31, 3, OAK, seed + 3)                                              # 선반 윗면
    for y in range(31, 45):
        for x in range(1, 31):
            k = 3 if x < 29 else 2
            if x in (1, 2): k = 4
            cv.px(x, y, OAK[k])
    for dx0 in (3, 17):                                                                    # 아래 장 문(들어간 판)
        for y in range(32, 44):
            for x in range(dx0, dx0 + 12):
                k = 3
                if x == dx0 or y == 32: k = 2
                elif x == dx0 + 11 or y == 43: k = 4
                cv.px(x, y, OAK[k])
        cv.px(dx0 + (10 if dx0 == 3 else 1), 38, AMBER[4])                                 # 손잡이
    cv.hline(0, 32, 45, OAK[2]); cv.hline(0, 32, 46, OAK[1]); cv.hline(1, 31, 47, SHADE)
    return fin(cv)

def dish_shelf(seed=0):
    """벽 선반 2x2(벽 앞면 위 장식): 까치발 두 개가 받친 널 두 단 + 접시·잔·단지."""
    cv = Cv(32, 32)
    for sy in (12, 26):
        box3(cv, 1, sy, 31, sy + 3, 2, OAK, seed + sy)
        for bx in (4, 26):
            for k in range(4): cv.px(bx + (1 if bx > 10 else 0), sy + 3 + k, OAK[2]); cv.px(bx + k // 2, sy + 3 + k, OAK[3])
    for i, x in enumerate((4, 10, 16)):                                                    # 윗단: 세운 접시
        for yy in range(3, 12):
            for xx in range(x - 3, x + 4):
                if (xx - x) ** 2 + (yy - 7.5) ** 2 <= 12: cv.px(xx, yy, GAR[4] if xx < x else GAR[3])
        cv.px(x, 7, (WINE[3], BOT[3], CHZ[3])[i])
    mug(cv, 22, 12); mug(cv, 26, 12, ramp=OAK, foam=False)
    for x, ramp in ((5, CLAY), (12, COP), (20, CLAY)):                                       # 아랫단: 단지·구리 냄비
        blob_ell(cv, x + 2, 22, 3, 3.5, ramp, base=4, seed=x)
        cv.hline(x, x + 5, 18, ramp[5])
    cv.rect(25, 19, 29, 26, GAR[4]); cv.vline(25, 19, 26, GAR[5]); cv.hline(25, 29, 18, CLAY[3])   # 소금 단지
    return fin(cv)
