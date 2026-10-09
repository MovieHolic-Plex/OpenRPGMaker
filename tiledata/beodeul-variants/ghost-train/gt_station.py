# 유령 열차 — 간이역 플랫폼·철로 곁 소품. 톤 캔버스(재질 + 톤)로 칠하고 pz.fin 으로 안쪽 윤곽. 3/4(윗면 + 앞면), 빛 왼쪽 위.
# 글자·숫자·상표 없음(시간표·시계·표지는 줄·눈금·무늬만). 유령 빛은 GHOST 램프(푸른 흰빛).
import math
from gt_base import *
from gt_base import _hash, vnoise
from gt_train import tc_img, wheel, wood_v, hband

def vpost(tc, cx, y0, y1, w=2, mat='soot', base=4):
    """가는 세로 기둥: 왼쪽 열 밝고 오른쪽 열 어둡다."""
    for y in range(int(y0), int(y1)):
        for i in range(w):
            k = base + 1 if i == 0 else (base - 1 if i == w - 1 else base)
            tc.px(cx + i, y, mat, clamp(k, 1, 6))

def plank_top(tc, x0, y0, x1, y1, mat='varn', base=5, seed=0):
    """가로 널 윗면(벤치 앉는 판·짐수레 바닥): 3px 널 + 1px 틈."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            ly = (y - y0) % 4
            k = base if ly < 3 else base - 3
            if ly == 0: k += 1
            if x == x0: k += 1
            if x >= x1 - 1: k -= 1
            g = AK.grain((x * 3 + seed) % 48, (y * 2) % 48) - 3
            if g >= 2 and ly < 3: k += 1
            elif g <= -2 and ly < 3: k -= 1
            tc.px(x, y, mat, clamp(k, 1, 6))

# ---------------------------------------------------------------- 벤치
def bench(broken=False, seed=0):
    """플랫폼 벤치 2×2칸: 주철 다리·팔걸이(곡선) + 널 등받이(북쪽, 앞면이 보인다) + 널 앉는 판 윗면 + 앞 모."""
    W, H = 32, 28
    tc = TC(W, H, seed)
    # 등받이 널 두 줄(앞면)
    for (yy, h) in ((3, 3), (8, 3)):
        for y in range(yy, yy + h):
            for x in range(3, 29):
                if broken and yy == 3 and 15 <= x <= 22: continue                 # 빠진 널
                k = 5 if y == yy else (4 if y < yy + h - 1 else 2)
                if x >= 27: k -= 1
                tc.px(x, y, 'varn', clamp(k, 1, 6))
    # 앉는 판 윗면
    plank_top(tc, 2, 13, 30, 19, 'varn', 5, seed)
    if broken:
        for x in range(10, 17):
            for y in range(13, 17): tc.px(x, y, 'dark', 1)                       # 부러진 판 자리
        tc.line(10, 17, 16, 14, 'varn', 3)
    hband(tc, 2, 30, 19, 'varn', 3); hband(tc, 2, 30, 20, 'varn', 1)
    # 주철 다리·팔걸이(양 끝, 곡선)
    for ex in (2, 27):
        for y in range(2, 27):
            if 13 <= y <= 20 and ex == 27: pass
            tc.px(ex, y, 'soot', 4); tc.px(ex + 1, y, 'soot', 2)
        tc.px(ex - 1, 26, 'soot', 3); tc.px(ex + 2, 26, 'soot', 2)               # 발
        tc.px(ex - 1, 1, 'soot', 4); tc.px(ex + 2, 2, 'soot', 3)                 # 머리 말림
        for i in range(4): tc.px(ex + (1 if ex < 10 else 0) + (i // 2), 21 + i, 'soot', 3)
    if broken:
        for y in range(21, 27): tc.px(27, y, 'none' if False else 'soot', 1)
        tc.px(28, 26, 'soot', 1)
    tc.grain(.04, seed + 2, mats=('varn',))
    return tc_img(tc)

# ---------------------------------------------------------------- 시간표 판(글자 없음)
def timetable(seed=0):
    """시간표 판 2×3칸: 나무 두 기둥 위 지붕 덧댄 판 — 흰 바탕에 칸을 나눈 줄과 가로 막대(빈 기록)만, 빛바랜 얼룩. 글자 없음."""
    W, H = 32, 44
    tc = TC(W, H, seed)
    for y in range(2, 6):                                                       # 작은 박공 지붕 윗면
        for x in range(1, 31):
            tc.px(x, y, 'roofg', 5 if y < 4 else 3)
    hband(tc, 1, 31, 6, 'roofg', 1)
    for y in range(7, 29):                                                      # 판 틀 + 흰 바탕
        for x in range(3, 29):
            edge = x in (3, 28) or y in (7, 28)
            if edge: tc.px(x, y, 'varn', 4 if (x == 3 or y == 7) else 2); continue
            k = 5 if _hash(x // 3, y // 3, seed + 5) < .75 else 4
            if vnoise(x, y, 4, seed + 6) > .72: k -= 1                         # 바랜 얼룩
            tc.px(x, y, 'plaster', k)
    for x in range(4, 28): tc.px(x, 11, 'soot', 3)                              # 머리 줄
    for x in (15,):
        for y in range(9, 28): tc.px(x, y, 'soot', 3)                           # 세로 칸 줄
    for row in range(13, 27, 3):                                                # 빈 기록 막대(글자 없음, 길이만 다르다)
        for (a, b) in ((5, 5 + 3 + int(_hash(row, 1, seed) * 6)), (17, 17 + 3 + int(_hash(row, 2, seed) * 7))):
            for x in range(a, min(b, 27)): tc.px(x, row, 'soot', 4)
    for y in range(9, 11):
        for x in range(5, 12): tc.px(x, y, 'redl', 3)                           # 머리 띠(색만)
    for px_ in (6, 24):                                                         # 기둥
        vpost(tc, px_, 29, 43, 2, 'varn', 4)
    tc.grain(.03, seed + 1, mats=('varn',))
    return tc_img(tc)

# ---------------------------------------------------------------- 가로등(가스등)
def gas_lamp(lit=True, seed=0):
    """플랫폼 가스등 1×3칸: 주철 기둥(굽도리·가운데 고리) 위 사각 등 — 켜진 등은 유리 속 푸른 유령불, 꺼진 등은 깨진 유리."""
    W, H = 16, 46
    tc = TC(W, H, seed)
    for y in range(44, 46):                                                     # 받침
        for x in range(4, 12): tc.px(x, y, 'soot', 4 if x < 7 else 2)
    for y in range(40, 44):
        for x in range(5, 11): tc.px(x, y, 'soot', 4 if x < 7 else (3 if x < 9 else 2))
    vpost(tc, 7, 14, 40, 2, 'soot', 4)
    for x in range(5, 11): tc.px(x, 26, 'soot', 4 if x < 8 else 2)              # 가운데 고리
    for x in range(4, 12): tc.px(x, 15, 'soot', 3)                              # 사다리 걸이 팔
    tc.px(3, 15, 'soot', 4); tc.px(12, 15, 'soot', 2)
    # 등(사각 유리 갓 + 지붕)
    for y in range(3, 6):
        for x in range(4 + (5 - y) // 1 - 2, 12 - (5 - y) + 2):
            tc.px(x, y, 'soot', 5 if y < 5 else 3)
    tc.px(7, 1, 'soot', 4); tc.px(8, 1, 'soot', 3); tc.px(7, 2, 'soot', 4); tc.px(8, 2, 'soot', 3)
    for y in range(6, 14):
        for x in range(4, 12):
            edge = x in (4, 11) or y == 13
            if edge: tc.px(x, y, 'soot', 3 if x == 4 else 2); continue
            if lit:
                d = math.hypot(x + .5 - 8, y + .5 - 10)
                k = 6 if d < 1.6 else (5 if d < 2.8 else 4)
                tc.px(x, y, 'ghost', k)
            else:
                k = 3 if (x + y) % 5 else 4
                if 6 <= x <= 9 and y >= 9: tc.px(x, y, 'dark', 1)               # 깨진 유리
                else: tc.px(x, y, 'glass', k)
    if lit:
        tc.px(8, 9, 'ghost', 6); tc.px(7, 10, 'ghost', 6)
    tc.grain(.03, seed, mats=('soot',))
    im = tc_img(tc)
    if not lit: im = im.rotate(-4, resample=Image.NEAREST, center=(8, 44))     # 조금 기운 꺼진 등
    return im

# ---------------------------------------------------------------- 역 시계(멈춘 시계, 숫자 없음)
def station_clock(seed=0):
    """기둥 시계 1×3칸: 주철 기둥 위 양면 둥근 시계(흰 판에 눈금 열둘·바늘 둘, 숫자 없음), 놋쇠 테와 꼭지."""
    W, H = 16, 46
    tc = TC(W, H, seed)
    for y in range(42, 46):
        for x in range(4, 12): tc.px(x, y, 'soot', 4 if x < 7 else 2)
    vpost(tc, 7, 15, 42, 2, 'soot', 4)
    cx, cy, r = 8, 9, 6.5
    for y in range(1, 17):
        for x in range(0, 16):
            d = math.hypot(x + .5 - cx, y + .5 - cy)
            if d > r: continue
            if d > r - 1.4: tc.px(x, y, 'brass', 5 if (x < cx and y < cy) else 3); continue
            tc.px(x, y, 'plaster', 5 if (x + y) % 7 else 4)
    for i in range(12):                                                         # 눈금
        a = i / 12 * 2 * math.pi
        tc.px(int(round(cx - .5 + math.sin(a) * 4.2)), int(round(cy - .5 - math.cos(a) * 4.2)), 'soot', 3)
    tc.line(8, 9, 8, 5, 'soot', 2); tc.line(8, 9, 10, 10, 'soot', 2)            # 멈춘 바늘
    tc.px(7, 0, 'brass', 5); tc.px(8, 0, 'brass', 3)
    tc.grain(.02, seed, mats=('soot',))
    return tc_img(tc)

# ---------------------------------------------------------------- 짐
def suitcase(tc, x0, y0, w, h, top, mat='paint', seed=0, strap=True):
    """3/4 가방: 윗면(손잡이) + 앞면(가죽 띠·놋쇠 잠금쇠)."""
    FM.box(tc, x0, y0, x0 + w, y0 + h, top, mat, base=3, seed=seed, grain=.04)
    if strap:
        for y in range(y0 + top, y0 + h - 1):
            tc.px(x0 + w // 3, y, 'varn', 2); tc.px(x0 + 2 * w // 3, y, 'varn', 2)
    tc.px(x0 + w // 2, y0 + top + 1, 'brass', 5)
    tc.hline(x0 + w // 2 - 2, x0 + w // 2 + 2, y0 - 1, 'varn', 3)              # 손잡이

def luggage_pile(seed=0):
    """버려진 짐 더미 2×2칸: 큰 궤 + 가죽 가방 둘 + 둥근 모자 상자."""
    tc = TC(32, 28, seed)
    suitcase(tc, 2, 10, 16, 16, 4, 'varn', seed)                                # 궤(나무)
    for x in range(2, 18): tc.px(x, 13, 'brass', 3)
    suitcase(tc, 16, 14, 14, 12, 4, 'paint', seed + 1)
    suitcase(tc, 5, 2, 11, 9, 3, 'drab', seed + 2)
    for y in range(4, 14):                                                      # 모자 상자(둥근)
        for x in range(19, 29):
            dx = (x + .5 - 24) / 5; dy = (y + .5 - 7) / 2.6
            if y < 7 and dx * dx + dy * dy <= 1: tc.px(x, y, 'plaster', 5 if dx < 0 else 4)
            elif 7 <= y < 13 and abs(dx) <= 1: tc.px(x, y, 'plaster', 4 if dx < -.4 else (3 if dx < .5 else 2))
    tc.hline(19, 29, 9, 'redl', 3)
    return tc_img(tc)

def trolley(seed=0):
    """짐수레 2×2칸: 널 바닥 윗면 + 쇠 테 두른 큰 바퀴 둘 + 손잡이, 위에 가방 둘."""
    tc = TC(32, 30, seed)
    plank_top(tc, 2, 14, 28, 21, 'varn', 4, seed)
    for x in range(2, 28): tc.px(x, 21, 'varn', 2); tc.px(x, 22, 'soot', 2)
    wheel(tc, 9, 24, 5, mat='soot', spokes=6, seed=seed)
    wheel(tc, 22, 24, 5, mat='soot', spokes=6, seed=seed)
    tc.line(28, 15, 31, 8, 'soot', 4); tc.line(29, 15, 31, 10, 'soot', 2)        # 손잡이
    suitcase(tc, 4, 6, 13, 9, 3, 'paint', seed + 3)
    suitcase(tc, 15, 9, 11, 6, 3, 'drab', seed + 4)
    return tc_img(tc)

# ---------------------------------------------------------------- 급수탑
def water_tower(seed=0):
    """급수탑 3×5칸: 쇠 다리 넷 위 둥근 나무 물통(세로 널·쇠테 셋) + 원뿔 지붕 윗면 + 철로 쪽으로 늘어진 급수관 팔과 가죽 호스, 사다리."""
    W, H = 48, 80
    tc = TC(W, H, seed)
    cx = 22
    # 다리(뒤 둘은 어둡게, 앞 둘은 밝게) + 가새
    for (lx, k) in ((9, 3), (33, 3), (5, 4), (37, 4)):
        for y in range(44, 78):
            tc.px(lx, y, 'soot', k); tc.px(lx + 1, y, 'soot', k - 1)
    for i in range(30):
        tc.px(6 + i, 50 + int(i * .9), 'soot', 2); tc.px(37 - i, 50 + int(i * .9), 'soot', 2)
    for x in range(4, 40): tc.px(x, 78, 'soot', 3); tc.px(x, 79, 'soot', 1)
    for y in range(76, 80):                                                     # 주춧돌
        for (bx) in (4, 36):
            for x in range(bx, bx + 4): tc.px(x, y, 'stone', 4 if y == 76 else 3)
    # 물통(세로 원통): 앞면 세로 널
    for y in range(18, 46):
        for x in range(3, 41):
            t = (x - 3 + .5) / 38
            k = FM.cyl_k(t)
            if (x - 3) % 4 == 3: k -= 1
            g = AK.grain((x * 2) % 48, (y + x) % 48) - 3
            if g >= 2: k += 1
            elif g <= -2: k -= 1
            tc.px(x, y, 'varn', clamp(k, 1, 6))
    for by in (22, 32, 42):                                                     # 쇠테
        for x in range(3, 41):
            tc.px(x, by, 'steel', clamp(FM.cyl_k((x - 3 + .5) / 38) - 1, 1, 6))
    # 아래 바닥 테(나무 받침)
    for x in range(1, 43):
        tc.px(x, 46, 'varn', 4 if x < 30 else 3); tc.px(x, 47, 'varn', 2)
    # 원뿔 지붕(윗면이 보인다): 꼭대기 → 처마
    for y in range(2, 20):
        f = (y - 2) / 18.0
        half = 3 + f * 20
        for x in range(int(cx - half), int(cx + half) + 1):
            u = (x + .5 - (cx - half)) / (2 * half)
            k = 5 if u < .35 else (4 if u < .7 else 3)
            if y == 19: k = 2
            if (x - cx + 64) % 6 == 0 and y < 18: k -= 1                         # 지붕 널 줄
            tc.px(x, y, 'roofg', clamp(k, 1, 6))
    tc.rect(cx - 1, 0, cx + 2, 3, 'steel', 4)
    # 급수관 팔(동쪽으로) + 늘어진 가죽 호스
    for x in range(40, 48):
        tc.px(x, 36, 'steel', 5); tc.px(x, 37, 'steel', 3); tc.px(x, 38, 'steel', 2)
    for y in range(38, 56):
        xx = 45 + (1 if y > 46 else 0)
        tc.px(xx, y, 'cable', 3); tc.px(xx + 1, y, 'cable', 1)
    tc.px(44, 56, 'cable', 2); tc.px(45, 56, 'cable', 3); tc.px(46, 57, 'cable', 2)
    # 사다리(물통 왼쪽)
    for y in range(20, 76):
        tc.px(14, y, 'soot', 4); tc.px(18, y, 'soot', 2)
        if y % 4 == 0:
            for x in range(15, 18): tc.px(x, y, 'soot', 3)
    tc.grain(.03, seed, mats=('varn',))
    return tc_img(tc)

# ---------------------------------------------------------------- 신호기
def semaphore(seed=0):
    """완목 신호기 1×5칸(가로 2칸 그림): 격자 쇠 기둥 + 사다리, 꼭대기 동쪽으로 뻗은 붉은 완목(흰 띠), 안경판 속 푸른 유령빛, 받침."""
    W, H = 32, 78
    tc = TC(W, H, seed)
    for y in range(72, 78):
        for x in range(3, 13): tc.px(x, y, 'stone', 5 if y == 72 else (4 if x < 9 else 3))
    for y in range(10, 72):                                                     # 격자 기둥(두 줄 + 엇갈린 살)
        tc.px(5, y, 'soot', 4); tc.px(10, y, 'soot', 2)
        k = (y // 3) % 4
        if k == 0: tc.px(6, y, 'soot', 3); tc.px(9, y, 'soot', 3)
        if (y % 6) in (1, 2): tc.px(7, y, 'soot', 3)
        if (y % 6) in (4, 5): tc.px(8, y, 'soot', 3)
    for y in range(12, 70, 4): tc.px(3, y, 'soot', 3); tc.px(4, y, 'soot', 2)    # 사다리 디딤
    for y in range(12, 70): tc.px(2, y, 'soot', 3)
    tc.rect(4, 6, 12, 10, 'soot', 4); tc.hline(4, 12, 6, 'soot', 5)             # 기둥 머리
    tc.px(7, 4, 'soot', 4); tc.px(8, 4, 'soot', 3); tc.px(7, 5, 'soot', 4); tc.px(8, 5, 'soot', 2)
    for y in range(11, 16):                                                     # 완목(동쪽으로)
        for x in range(12, 31):
            k = 4 if y == 11 else (3 if y < 15 else 2)
            m = 'plaster' if 24 <= x <= 26 else 'redl'
            tc.px(x, y, m, k + (1 if m == 'plaster' else 0))
    for y in range(17, 25):                                                     # 안경판(둥근 렌즈 둘)
        for x in range(11, 16):
            tc.px(x, y, 'soot', 3)
    for (ly, mat) in ((19, 'ghost'), (23, 'dark')):
        for y in range(ly - 1, ly + 2):
            for x in range(12, 15): tc.px(x, y, mat, 5 if mat == 'ghost' else 1)
    tc.px(13, 19, 'ghost', 6)
    return tc_img(tc)

# ---------------------------------------------------------------- 건널목
def crossing_sign(seed=0):
    """건널목 표지 1×3칸: 기둥 위 X자 판(흰 바탕·붉은 테, 글자 없음) + 아래 둥근 경고등 둘(하나는 푸른 유령빛), 종."""
    W, H = 16, 48
    tc = TC(W, H, seed)
    for y in range(44, 48):
        for x in range(4, 12): tc.px(x, y, 'stone', 5 if y == 44 else (4 if x < 8 else 3))
    vpost(tc, 7, 10, 44, 2, 'plaster', 4)
    for y in range(12, 44, 6):
        for i in range(3): tc.px(7, y + i, 'soot', 3); tc.px(8, y + i, 'soot', 2)   # 줄무늬 기둥
    for i in range(14):                                                         # X 판 두 장
        for (ax, sgn) in ((1, 1), (14, -1)):
            x = ax + sgn * i; y = 1 + int(i * .62)
            for dy in range(3):
                m = 'redl' if dy in (0, 2) else 'plaster'
                tc.px(x, y + dy, m, 4 if m == 'redl' else 5)
    for (lx, mat, k) in ((3, 'ghost', 5), (11, 'redl', 2)):                     # 경고등 둘
        tc.rect(lx - 2, 15, lx + 3, 21, 'soot', 2)
        for y in range(16, 20):
            for x in range(lx - 1, lx + 2): tc.px(x, y, mat, k)
        tc.px(lx - 1, 16, mat, 6 if mat == 'ghost' else 3)
    tc.hline(3, 13, 14, 'soot', 3)
    tc.rect(6, 22, 10, 25, 'brass', 4); tc.px(6, 22, 'brass', 6)               # 종
    return tc_img(tc)

def crossing_gate(seed=0):
    """건널목 차단기 3×2칸: 서쪽 받침 기둥과 평형추, 동쪽으로 뻗은 붉은·흰 줄무늬 차단 막대(내려온 상태)와 끝 등."""
    W, H = 48, 24
    tc = TC(W, H, seed)
    for y in range(4, 22):
        for x in range(1, 8):
            k = 4 if x < 3 else (3 if x < 6 else 2)
            if y < 6: k = 5
            tc.px(x, y, 'soot', k)
    tc.rect(0, 20, 9, 24, 'stone', 4); tc.hline(0, 9, 20, 'stone', 5)
    tc.rect(1, 10, 8, 15, 'stone', 3)                                           # 평형추
    for x in range(7, 46):                                                      # 막대
        stripe = ((x - 7) // 6) % 2
        m = 'redl' if stripe else 'plaster'
        tc.px(x, 7, m, 5 if m == 'plaster' else 4); tc.px(x, 8, m, 4 if m == 'plaster' else 3); tc.px(x, 9, m, 2)
    tc.rect(44, 5, 48, 9, 'soot', 3); tc.px(45, 6, 'ghost', 5); tc.px(46, 6, 'ghost', 6)
    for i in range(10): tc.px(10 + i * 3, 10 + (i % 2), 'soot', 2)               # 늘어진 그물 줄(술)
    return tc_img(tc)

def crossing_planks(seed=0):
    """건널목 깔판 1×1칸(철로 위 덧그림): 레일 사이와 바깥에 레일 길이 방향으로 깐 널 — 레일 머리는 보인다."""
    im = new(); p = im.load()
    for y in range(16):
        for x in range(16):
            if y in (5, 6, 10, 11): continue                                     # 레일 자리(아래 철로가 보인다)
            if y < 1 or y > 14: continue
            ly = y % 4
            k = 4 if ly else 2
            if y in (4, 7, 9, 12): k = 2                                          # 레일 홈
            g = AK.grain((x * 3) % 48, (y * 5) % 48) - 3
            if g >= 2: k += 1
            elif g <= -2: k -= 1
            if x % 16 == 15: k -= 1
            p[x, y] = tuple(FM.RAMP_OF['varn'][clamp(k, 1, 6)]) + (255,)
    return im

# ---------------------------------------------------------------- 선로 끝 막이·수동 궤도차·전신주·선로 전환기
def buffer_stop(seed=0):
    """선로 끝 막이 1×2칸(서쪽을 향한다): 휘어 올린 레일 받침 + 붉은 칠한 굵은 각목 들보 + 완충기 둘, 흰 띠."""
    W, H = 16, 26
    tc = TC(W, H, seed)
    for y in range(8, 24):                                                      # 휜 레일 받침(뒤로 비스듬히)
        tc.px(12 - (y - 8) // 3, y, 'steel', 4); tc.px(13 - (y - 8) // 3, y, 'steel', 2)
    for y in range(4, 16):
        for x in range(2, 14):
            k = 4 if y < 6 else (3 if y < 14 else 2)
            if x < 4: k += 1
            if x > 11: k -= 1
            m = 'plaster' if 6 <= x <= 8 else 'redl'
            tc.px(x, y, m, clamp(k + (1 if m == 'plaster' else 0), 1, 6))
    for by in (6, 12):
        tc.rect(0, by, 3, by + 3, 'steel', 4); tc.px(0, by, 'steel', 6)
    for y in range(16, 26):
        for x in range(4, 13): tc.px(x, y, 'gravel', 3 if (x + y) % 3 else 2)
    return tc_img(tc)

def handcar(seed=0):
    """수동 궤도차 2×2칸: 작은 바퀴 넷 위 널 바닥 윗면, 가운데 A자 틀 위 시소 손잡이(놋쇠 손잡이 막대)."""
    tc = TC(32, 30, seed)
    plank_top(tc, 2, 17, 30, 22, 'varn', 4, seed)
    for x in range(2, 30): tc.px(x, 22, 'soot', 3); tc.px(x, 23, 'soot', 1)
    for wx in (8, 24): wheel(tc, wx, 25, 4, mat='soot', spokes=5, seed=seed)
    for i in range(11):                                                         # A 자 틀
        tc.px(12 + i // 3, 17 - i, 'soot', 4); tc.px(20 - i // 3, 17 - i, 'soot', 2)
    tc.rect(14, 5, 18, 8, 'soot', 3)
    for x in range(4, 29):                                                      # 시소 손잡이(서쪽이 내려감)
        yy = int(round(4 + (x - 16) * .22))
        tc.px(x, yy, 'steel', 4); tc.px(x, yy + 1, 'steel', 2)
    for (hx_, hy) in ((4, 1), (28, 7)):
        tc.rect(hx_ - 1, hy, hx_ + 1, hy + 4, 'brass', 4)
    return tc_img(tc)

def telegraph_pole(seed=0):
    """전신주 1×5칸: 나무 기둥(결) + 가로 팔 둘 + 유리 애자 여섯(푸른 녹색 유리)."""
    W, H = 16, 78
    tc = TC(W, H, seed)
    for y in range(6, 78):
        for x in range(6, 10):
            k = 5 if x == 6 else (4 if x == 7 else (3 if x == 8 else 2))
            g = AK.grain((x * 7) % 48, y % 48) - 3
            if g >= 2: k += 1
            elif g <= -2: k -= 1
            tc.px(x, y, 'varn', clamp(k, 1, 6))
    tc.rect(6, 4, 10, 6, 'varn', 5)
    for (ay) in (10, 17):
        for x in range(0, 16):
            tc.px(x, ay, 'varn', 4 if x < 8 else 3); tc.px(x, ay + 1, 'varn', 2)
        for ix in (1, 4, 12, 14):
            if ix in (4,) and ay == 17: continue
            tc.px(ix, ay - 1, 'glass', 5); tc.px(ix, ay - 2, 'glass', 4); tc.px(ix + 1, ay - 1, 'glass', 3)
    return tc_img(tc)

def telegraph_wire(seed=0):
    """전신선 4×1칸(덧그림): 전신주 애자 사이 두 가닥 처진 줄(위층)."""
    tc = TC(64, 16, seed)
    FM.cable(tc, 0, 2, 64, 2, sag=6, w=1)
    FM.cable(tc, 0, 6, 64, 6, sag=8, w=1)
    return tc.img()

def point_lever(seed=0):
    """선로 전환기 1×2칸: 낮은 쇠 받침 위 무게추 달린 손잡이 + 꼭대기 사각 등(푸른 유령빛 렌즈)."""
    W, H = 16, 30
    tc = TC(W, H, seed)
    FM.box(tc, 3, 20, 13, 28, 3, 'soot', base=3, seed=seed)
    tc.line(5, 21, 12, 13, 'steel', 4); tc.line(6, 21, 13, 14, 'steel', 2)
    tc.rect(10, 11, 15, 15, 'redl', 3); tc.px(10, 11, 'redl', 5)
    vpost(tc, 7, 6, 20, 2, 'soot', 4)
    tc.rect(4, 1, 12, 7, 'soot', 3); tc.hline(4, 12, 1, 'soot', 5)
    for y in range(2, 6):
        for x in range(6, 10): tc.px(x, y, 'ghost', 5 if x < 8 else 4)
    tc.px(6, 2, 'ghost', 6)
    return tc_img(tc)

def lever_frame(seed=0):
    """신호 손잡이 틀 2×2칸: 널 받침 위 쇠 틀에 꽂힌 긴 손잡이 다섯(붉은·검은 칠, 몇 개는 당겨 기움)."""
    tc = TC(32, 30, seed)
    FM.box(tc, 1, 18, 31, 28, 4, 'varn', base=4, seed=seed)
    for x in range(2, 30): tc.px(x, 18, 'soot', 3)
    for i, lx in enumerate(range(5, 29, 5)):
        lean = 3 if i in (1, 3) else 0
        mat = 'redl' if i % 2 == 0 else 'soot'
        for y in range(3, 19):
            xx = lx + int(round(lean * (19 - y) / 16))
            tc.px(xx, y, mat, 4 if y > 5 else 5); tc.px(xx + 1, y, mat, 2)
        tc.rect(lx + lean - 1, 1, lx + lean + 2, 3, 'steel', 5)
    return tc_img(tc)

# ---------------------------------------------------------------- 유령불·안개 덩이·떨어진 모자
def wisp(v=0, seed=0):
    """도깨비불 1×1칸(덧그림): 푸른 흰빛 알 + 위로 흔들리는 꼬리, 바깥 한 단 어두운 테."""
    tc = TC(16, 16, seed)
    cx, cy = 8, 10
    for y in range(16):
        for x in range(16):
            d = math.hypot(x + .5 - cx, y + .5 - cy)
            if d < 3.4: tc.px(x, y, 'ghost', 6 if d < 1.4 else (5 if d < 2.5 else 4))
    for i in range(7):                                                          # 꼬리
        y = cy - 3 - i
        xx = cx + int(round(math.sin(i * .9 + v * 2) * (1 + i * .25))) - (0 if i < 3 else 1)
        w = 1 if i < 4 else 0
        for x in range(xx - w, xx + w + 1): tc.px(x, y, 'ghost', 4 if i < 3 else 3)
    im = tc.img()
    return im

def lost_hat(seed=0):
    """떨어진 모자와 우산 1×1칸(바닥 장식): 둥근 챙 모자 + 접힌 검은 우산."""
    tc = TC(16, 16, seed)
    for y in range(4, 12):
        for x in range(1, 12):
            dx = (x + .5 - 6) / 5.2; dy = (y + .5 - 9) / 2.4
            if dx * dx + dy * dy <= 1: tc.px(x, y, 'soot', 3 if dx < 0 else 2)
    for y in range(4, 9):
        for x in range(3, 9):
            dx = (x + .5 - 6) / 3; dy = (y + .5 - 7) / 3
            if dx * dx + dy * dy <= 1: tc.px(x, y, 'soot', 4 if dx < 0 and dy < 0 else 3)
    tc.hline(3, 9, 8, 'redl', 2)
    tc.line(9, 14, 15, 5, 'soot', 3); tc.line(10, 14, 15, 6, 'soot', 2); tc.px(9, 15, 'varn', 4)
    return tc_img(tc)

# ---------------------------------------------------------------- 플랫폼 앞면·계단
def platform_face(seed=0):
    """플랫폼 앞면 3×1칸(벽): 앞 턱 아래 세로 널 막이(4px 널, 결) + 32px 마다 굵은 기둥, 맨 아래 땅에 닿는 그늘."""
    W, H = 48, 16
    tc = TC(W, H, seed)
    for y in range(H):
        for x in range(W):
            b = x // 4; lx = x % 4
            k = 3 + (1 if _hash(b, 3, seed + 1) < .2 else 0) - (1 if _hash(b, 4, seed + 2) > .8 else 0)
            if lx == 3: k = 1
            elif lx == 0: k += 1
            if y == 0: k = 4
            if y == 1: k = 2
            if y >= 13: k -= 1
            if y == 15: k = 1
            tc.px(x, y, 'varn', clamp(k, 1, 6))
    for px_ in (14, 46):
        for y in range(1, 16):
            tc.px(px_, y, 'varn', 4); tc.px(px_ + 1, y, 'varn', 2)
    for x in range(W):                                                          # 이끼·잡풀이 앞면 밑동을 먹었다
        if vnoise(x, 0, 4, seed + 5) > .55:
            for y in range(13 - int(2 * _hash(x, 1, seed + 6)), 16): tc.px(x, y, 'leaf', 2 if y > 13 else 3)
    return pz.fin(tc.img(), .7)

def platform_steps(seed=0):
    """플랫폼 계단 2×1칸(걷기): 남쪽으로 내려가는 널 디딤 셋(디딤 윗면 밝고 앞 모 어둡다), 양옆 기둥."""
    W, H = 32, 16
    tc = TC(W, H, seed)
    for i, (y0, y1) in enumerate(((0, 5), (5, 10), (10, 16))):
        for y in range(y0, y1):
            for x in range(2, 30):
                k = 5 - i if y < y1 - 2 else 2
                if y == y0: k += 1
                if x >= 28: k -= 1
                tc.px(x, y, 'varn', clamp(k, 1, 6))
    for x in (0, 30):
        for y in range(16): tc.px(x, y, 'varn', 4 if x == 0 else 2); tc.px(x + 1, y, 'varn', 3)
    return tc_img(tc)
