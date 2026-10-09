# (동결 사본) rain-ruin-town/rr_props.py — 고딕 마을이 그리기 함수를 쓰려고 복사. 경로는 gv_base 가 잡는다.
# 비 내리는 수직 폐허 도시 — 소품·구조물 조각. 결정적. 각 함수 = 한 조각(밤 그림을 돌려준다).
# 그리는 법: 버들항 칩셋 램프(ST 돌 · WD 나무 · R('moss'/'leaf'/'bronze') …)로 낮 재료를 찍고 → night() →
# 밤에만 있는 것(켜진 등 LIT · 젖은 윗모 SHEEN · 물 PUD)을 밤 공간 램프로 덧칠. 빛은 왼쪽 위, 윤곽은 안쪽(pz.fin).
from rr_base import *
import roman
from rr_build import IR, iron_rail_front, cloth_shape, CLOTH, SHUT2

def mk(w, h): im = Image.new('RGBA', (w, h)); return im, im.load()
def fin(im): return pz.fin(im)
NLF = [N(c) for c in R('leaf')]
WOOD = WD
TARP = [hx(c) for c in ('#141c18', '#22302a', '#33463c', '#465c4e', '#5c7462', '#788e7a', '#9cae9a')]   # 젖은 방수포(낮)

def _post(px, W, Hh, x, y0, y1, w=2):
    for y in range(y0, y1):
        put(px, W, Hh, x, y, ST[3] if w == 2 else ST[4]); put(px, W, Hh, x + 1, y, ST[1])
        if w == 3: put(px, W, Hh, x + 2, y, ST[1])

def _lantern_day(px, W, Hh, cx, y):
    """등 몸(낮): 쇠 갓·쇠 테·유리 칸(유리 칸은 밤에 불빛으로 덮는다)."""
    for x in range(cx - 3, cx + 4): put(px, W, Hh, x, y, ST[2])
    for x in range(cx - 2, cx + 3): put(px, W, Hh, x, y - 1, ST[3])
    put(px, W, Hh, cx, y - 2, ST[4])
    for yy in range(y + 1, y + 7):
        for x in range(cx - 3, cx + 4):
            put(px, W, Hh, x, yy, ST[3] if x in (cx - 3,) else (ST[1] if x == cx + 3 else (33, 45, 66)))
    for x in range(cx - 3, cx + 4): put(px, W, Hh, x, y + 7, ST[2])
    put(px, W, Hh, cx, y + 8, ST[1])

def _lantern_light(px, W, Hh, cx, y, strong=True):
    for yy in range(y + 1, y + 7):
        for x in range(cx - 2, cx + 3):
            t = 6 if (x <= cx and yy < y + 4) else (5 if yy < y + 6 else 4)
            if x == cx and strong: t = 6
            put(px, W, Hh, x, yy, LIT[t])
    put(px, W, Hh, cx - 1, y + 7, LIT[3]); put(px, W, Hh, cx + 1, y + 7, LIT[3])

# ================================================================ 불빛
def lamppost_lit():
    """켜진 가로등(1x3칸): 젖은 쇠 기둥(밑동 돌 받침), 꼭대기 사각 등 — 노란 불빛, 등 둘레 희미한 빛 번짐, 기둥 왼모 빗물 맺힘."""
    im, px = mk(16, 48)
    for y in range(12, 44): put(px, 16, 48, 7, y, ST[3]); put(px, 16, 48, 8, y, ST[1])
    for y in range(28, 30):
        for x in range(6, 10): put(px, 16, 48, x, y, ST[4] if x < 8 else ST[2])
    for y in range(43, 48):
        for x in range(4, 12): put(px, 16, 48, x, y, ST[5] if y == 43 else (ST[4] if x < 8 else ST[2]))
    _lantern_day(px, 16, 48, 8, 4)
    im = night(fin(im)); p = im.load()
    _lantern_light(p, 16, 48, 8, 4)
    glow(p, 16, 48, 8, 8, 8, 0.32)
    sheen_top(p, 16, 48, [(7, y) for y in range(13, 43, 3)] + [(4, 43), (5, 43), (6, 43)], 1, 0.5)
    return im

def lamp_double_lit():
    """두 갈래 가로등(2x3칸): 가운데 쇠 기둥에서 양쪽으로 굽은 팔, 팔 끝에 매단 등 둘(켜짐). 광장·다리 끝에."""
    im, px = mk(32, 48)
    for y in range(10, 44): put(px, 32, 48, 15, y, ST[3]); put(px, 32, 48, 16, y, ST[1])
    for x in range(6, 26):
        y = 9 + int(abs(x - 15.5) * 0.25)
        put(px, 32, 48, x, y, ST[3]); put(px, 32, 48, x, y + 1, ST[1])
    for y in range(43, 48):
        for x in range(11, 21): put(px, 32, 48, x, y, ST[5] if y == 43 else (ST[4] if x < 16 else ST[2]))
    put(px, 32, 48, 15, 8, ST[4]); put(px, 32, 48, 16, 8, ST[2]); put(px, 32, 48, 15, 7, ST[5])
    for cx in (7, 24):
        put(px, 32, 48, cx, 12, ST[2]); _lantern_day(px, 32, 48, cx, 14)
    im = night(fin(im)); p = im.load()
    for cx in (7, 24):
        _lantern_light(p, 32, 48, cx, 14); glow(p, 32, 48, cx, 18, 8, 0.3)
    sheen_top(p, 32, 48, [(x, 9 + int(abs(x - 15.5) * 0.25)) for x in range(6, 26, 2)], 2, 0.5)
    return im

def lamp_wall():
    """벽 등(1x1칸 반): 벽에서 나온 쇠 까치발에 매단 등(켜짐). 집 벽·옹벽 앞면에 붙여 찍는다."""
    im, px = mk(16, 24)
    for x in range(2, 12): put(px, 16, 24, x, 3, ST[3]); put(px, 16, 24, x, 4, ST[1])
    for k in range(5): put(px, 16, 24, 2 + k, 5 + k, ST[2])
    for y in range(2, 9): put(px, 16, 24, 1, y, ST[2]); put(px, 16, 24, 2, y, ST[3])
    put(px, 16, 24, 10, 5, ST[2])
    _lantern_day(px, 16, 24, 10, 7)
    im = night(fin(im)); p = im.load()
    _lantern_light(p, 16, 24, 10, 7); glow(p, 16, 24, 10, 11, 7, 0.3)
    return im

# ================================================================ 물·배수
def drain_grate():
    """길 배수구 뚜껑(1칸, 바닥 덧그림): 쇠 살 다섯 줄 사이로 검은 물, 테 윗모 빗물 맺힘, 둘레 판석이 젖어 짙다."""
    im, px = mk(16, 16)
    for y in range(3, 13):
        for x in range(2, 14):
            e = x in (2, 13) or y in (3, 12)
            if e: c = IRON[5] if (x == 2 or y == 3) else IRON[2]
            else: c = IRON[4] if (x - 2) % 2 == 1 else PUD[1]
            put(px, 16, 16, x, y, c)
    for x in range(3, 13, 2): put(px, 16, 16, x, 4, SHEEN[5])
    for y in range(13, 15):
        for x in range(1, 15):
            if H(x, y, 3) < 0.6: put(px, 16, 16, x, y, PUD[2], 150)
    return im

def puddle_small():
    """작은 빗물 웅덩이(1칸, 바닥 덧그림): 젖은 돌 테 + 하늘 비친 매끈한 물(위쪽 밝은 줄, 가로 반사 줄)."""
    im, px = mk(16, 16)
    for y in range(16):
        for x in range(16):
            d = ((x + 0.5 - 8) / 6.6) ** 2 + ((y + 0.5 - 9) / 4.0) ** 2 + (vnoise(x, y, 2.4, 5) - 0.5) * 0.35
            if d < 0.7:
                c = PUD[3] if y > 7 else PUD[2]
                if y == 6 and H(x // 2, 3) < 0.5: c = mix(SHEEN[3], PUD[3], 0.3)
                elif y in (9, 11) and H(x // 2, y, 4) > 0.35: c = mix(SHEEN[3], PUD[3], 0.4)
                if y == 9 and H(x, 6) > 0.8: c = SHEEN[5]
            elif d < 1.0: c = mul(N(ST[4]), 0.62)
            else: continue
            put(px, 16, 16, x, y, c)
    return im

def puddle_lamp():
    """등불 비친 웅덩이(2x1칸, 바닥 덧그림): 가로등 아래 둔다 — 물 위에 노란 불빛이 세로로 일렁이는 짧은 줄 몇 토막."""
    im, px = mk(32, 16)
    for y in range(16):
        for x in range(32):
            d = ((x + 0.5 - 16) / 14.0) ** 2 + ((y + 0.5 - 8.5) / 6.2) ** 2 + (vnoise(x, y, 3.0, 7) - 0.5) * 0.3
            if d < 0.74: c = PUD[3] if y > 6 else PUD[2]
            elif d < 1.0: c = N(ST[2])
            else: continue
            if d < 0.74 and y in (4, 5) and H(x, 2) < 0.6: c = PUD[5]
            put(px, 32, 16, x, y, c)
    for (x, y, n) in ((14, 5, 3), (16, 7, 4), (15, 10, 3), (17, 12, 2), (13, 8, 2)):
        for i in range(n):
            q = px[x + i, y]
            if q[3]: put(px, 32, 16, x + i, y, LIT[5 if i == 1 else 4])
    return im

def sewer_outlet():
    """하수구 물줄기(2x3칸): 옹벽 앞면에 박힌 돌 아치 배수구 — 마름돌 아치 테(쐐기돌), 검은 굴 속, 녹슨 쇠 창살(한 칸 부러짐),
    입에서 쏟아지는 물줄기가 옹벽을 타고 떨어져 밑에서 거품이 인다. 옹벽(3줄 앞면)에 겹쳐 찍고 아래 물로 떨어지게."""
    W, Hh = 32, 48; im, px = mk(W, Hh)
    cx, top, rr = 16, 6, 9
    for y in range(Hh):
        for x in range(W):
            dx = x + 0.5 - cx; dy = max(0, top + rr - (y + 0.5))
            d = math.hypot(dx, dy)
            if y > 24: continue
            if d <= rr - 1 and y >= top:
                c = DK[1] if y < top + rr + 4 else DK[2]
                put(px, W, Hh, x, y, c)
            elif d <= rr + 3 and y >= top - 3 and y <= 24:
                ang = math.degrees(math.atan2(dy, dx))
                c = ST[5] if dx < 0 else ST[3]
                if int(ang + 360) % 22 < 3: c = ST[2]
                if d > rr + 2: c = ST[2]
                put(px, W, Hh, x, y, c)
    for x in range(cx - 7, cx + 8, 3):                         # 쇠 창살(가운데 하나 부러져 짧다)
        y0 = top + 1 + int(abs(x - cx) * 0.3); y1 = 23 if x != cx + 1 else 15
        for y in range(y0, y1): put(px, W, Hh, x, y, R('bronze')[2] if y % 4 else ST[2])
    for x in range(cx - 10, cx + 11):                         # 아치 밑 문턱돌
        put(px, W, Hh, x, 23, ST[5]); put(px, W, Hh, x, 24, ST[3])
    im = night(fin(im)); p = im.load()
    for y in range(18, Hh):                                    # 물줄기: 문턱에서 앞으로 굽어 떨어진다
        f = (y - 18) / (Hh - 18)
        hw = 3.5 + f * 3.0
        cxx = cx + 0.5
        for x in range(int(cxx - hw - 1), int(cxx + hw + 2)):
            dd = abs(x + 0.5 - cxx)
            if dd > hw: continue
            t = 4 if (x * 3 + y) % 5 < 2 else 3
            if dd > hw - 1.2: t = 2
            if (y + x * 7) % 9 == 0: t = 6
            if y >= Hh - 6: t = 6 if (x + y) % 3 else 5
            c = mix(PUD[t], SHEEN[t], 0.45)
            put(p, W, Hh, x, y, c)
    for (x, y) in ((cx - 9, Hh - 3), (cx + 9, Hh - 4), (cx - 7, Hh - 6), (cx + 8, Hh - 2), (cx - 11, Hh - 1)):
        put(p, W, Hh, x, y, SHEEN[6]); put(p, W, Hh, x + 1, y, SHEEN[5])
    return im

def downpipe():
    """홈통(1x3칸): 처마에서 벽을 타고 내려온 젖은 쇠 홈통, 밑 꺾인 주둥이에서 물이 흘러 작은 물웅덩이로. 집 벽 모서리에 붙여 찍는다."""
    W, Hh = 16, 48; im, px = mk(W, Hh)
    for y in range(0, 40):
        put(px, W, Hh, 6, y, ST[4]); put(px, W, Hh, 7, y, ST[3]); put(px, W, Hh, 8, y, ST[2]); put(px, W, Hh, 9, y, ST[1])
        if y % 12 == 4:
            for x in range(5, 11): put(px, W, Hh, x, y, ST[2])
    for y in range(38, 43):
        for x in range(6, 13): put(px, W, Hh, x, y, ST[3] if y < 40 else ST[2])
    im = night(fin(im)); p = im.load()
    for y in range(1, 40, 5): put(p, W, Hh, 6, y, SHEEN[5])
    for y in range(43, 47):
        for x in range(10, 13): put(p, W, Hh, x, y, mix(PUD[4], SHEEN[5], 0.5))
    for y in range(44, 48):
        for x in range(4, 16):
            d = ((x + 0.5 - 11) / 5.0) ** 2 + ((y + 0.5 - 46) / 1.8) ** 2
            if d < 1: put(p, W, Hh, x, y, PUD[4] if y == 45 else PUD[2])
    return im

def rain_barrel():
    """빗물 받는 통(1x2칸): 넘칠 듯 찬 나무 통(쇠 테 두 줄), 물낯에 빗방울 고리, 통 옆으로 흘러내린 물."""
    W, Hh = 16, 24; im, px = mk(W, Hh)
    for y in range(6, 23):
        for x in range(2, 14):
            t = 5 if x < 5 else (4 if x < 9 else (3 if x < 12 else 2))
            if (x - 2) % 3 == 2: t = max(1, t - 1)
            if y in (9, 10, 18, 19): t = 2 if y in (10, 19) else 4
            c = WD[t] if y not in (9, 10, 18, 19) else ST[t]
            put(px, W, Hh, x, y, c)
    for y in range(3, 7):
        for x in range(2, 14):
            d = ((x + 0.5 - 8) / 6.2) ** 2 + ((y + 0.5 - 5) / 2.2) ** 2
            if d < 1: put(px, W, Hh, x, y, WD[5] if d > 0.6 else (33, 45, 66))
    im = night(fin(im)); p = im.load()
    for y in range(4, 6):
        for x in range(4, 12): put(p, W, Hh, x, y, PUD[3] if (x + y) % 4 else PUD[5])
    for y in range(7, 22, 2): put(p, W, Hh, 12, y, mix(PUD[4], SHEEN[5], 0.5))
    for x in range(3, 13, 3): put(p, W, Hh, x, 9, SHEEN[5])
    return im

# ================================================================ 거리 소품
def bench_wet():
    """젖은 거리 의자(2x1칸): 쇠 다리 둘 + 나무 등받이·앉음판, 앉음판 윗모와 쇠 팔걸이에 빗물 맺힘."""
    W, Hh = 32, 16; im, px = mk(W, Hh)
    for y in range(1, 6):
        for x in range(3, 29): put(px, W, Hh, x, y, WD[5] if y in (1, 3) else WD[3] if y in (2, 4) else WD[2])
    for y in range(7, 11):
        for x in range(2, 30): put(px, W, Hh, x, y, WD[6] if y == 7 else (WD[5] if y < 9 else WD[3] if y == 9 else WD[2]))
    for x0 in (3, 26):
        for y in range(1, 16): put(px, W, Hh, x0, y, IR[4]); put(px, W, Hh, x0 + 1, y, IR[2])
        put(px, W, Hh, x0 - 1, 15, IR[3]); put(px, W, Hh, x0 + 2, 15, IR[2])
    im = night(fin(im)); p = im.load()
    sheen_top(p, W, Hh, [(x, 7) for x in range(3, 29, 2)] + [(x, 1) for x in range(4, 28, 3)], 3, 0.6)
    return im

def crates_tarp():
    """방수포 덮은 상자 더미(2x2칸): 나무 상자 셋을 쌓고 젖은 초록 방수포를 씌워 밧줄로 묶었다. 방수포 주름 아래로 빗물이 고였다."""
    W, Hh = 32, 32; im, px = mk(W, Hh)
    for (x0, y0, w, h) in ((1, 14, 15, 17), (16, 16, 15, 15), (6, 4, 16, 12)):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                top = y < y0 + 4
                t = (6 if y == y0 else 5) if top else (4 if x < x0 + 3 else (3 if (x - x0) % 5 else 2))
                if y == y0 + h - 1: t = 2
                put(px, W, Hh, x, y, WD[t])
    for y in range(3, 22):                                       # 방수포: 위 상자를 덮고 아래로 늘어짐
        for x in range(4, 26):
            if y > 16 and (x < 6 or x > 23): continue
            hang = y - 3
            if hang > 12 and H(x // 2, 4) < 0.4: continue
            t = 5 if y < 6 else (4 if (x + y // 3) % 5 else 3)
            if x in (4, 25) or y == 21: t = 2
            if (x - 4) % 7 == 3 and y > 5: t = 3
            put(px, W, Hh, x, y, TARP[t])
    for x in range(4, 26): put(px, W, Hh, x, 10, WD[2] if x % 2 else WD[4])
    im = night(fin(im)); p = im.load()
    sheen_top(p, W, Hh, [(x, 3) for x in range(5, 25, 2)] + [(x, 6) for x in range(7, 23, 4)], 4, 0.6)
    for (x, y) in ((10, 8), (11, 8), (12, 8), (18, 7), (19, 7)): put(p, W, Hh, x, y, PUD[4])
    return im

def barrels_wet():
    """젖은 나무통 둘(2x2칸): 하나는 서 있고 하나는 넘어져 굴러 있다(쇠 테, 윗뚜껑 물 고임)."""
    W, Hh = 32, 32; im, px = mk(W, Hh)
    for y in range(10, 30):
        for x in range(2, 15):
            t = 5 if x < 5 else (4 if x < 9 else (3 if x < 12 else 2))
            if y in (14, 24): t = 2
            put(px, W, Hh, x, y, WD[t] if y not in (14, 24) else ST[3])
    for y in range(6, 11):
        for x in range(2, 15):
            d = ((x + 0.5 - 8.5) / 6.6) ** 2 + ((y + 0.5 - 8.5) / 2.4) ** 2
            if d < 1: put(px, W, Hh, x, y, WD[6] if d > 0.65 else WD[4])
    for y in range(18, 31):                                      # 누운 통
        for x in range(15, 31):
            t = 5 if y < 21 else (4 if y < 25 else (3 if y < 28 else 2))
            if x in (19, 27): t = 2
            put(px, W, Hh, x, y, WD[t] if x not in (19, 27) else ST[3])
    for y in range(18, 31):
        for x in range(28, 32):
            d = ((x + 0.5 - 30) / 2.4) ** 2 + ((y + 0.5 - 24.5) / 6.5) ** 2
            if d < 1: put(px, W, Hh, x, y, WD[3] if d > 0.6 else WD[1])
    im = night(fin(im)); p = im.load()
    for x in range(5, 12): put(p, W, Hh, x, 8, PUD[4] if x % 2 else PUD[3])
    sheen_top(p, W, Hh, [(x, 18) for x in range(16, 28, 2)], 5, 0.6)
    return im

def cart_tarp():
    """버려진 손수레(2x2칸): 바퀴 하나가 빠져 기울었고 짐칸에 젖은 방수포, 손잡이 둘이 땅에 닿았다."""
    W, Hh = 32, 32; im, px = mk(W, Hh)
    for y in range(12, 24):
        for x in range(3, 26):
            yy = y + (x - 3) // 8
            t = 5 if y < 14 else (4 if (x - 3) % 6 else 2)
            if y > 21: t = 2
            put(px, W, Hh, x, yy, WD[t])
    for y in range(6, 15):
        for x in range(4, 25):
            if y > 11 and H(x // 2, 9) < 0.35: continue
            put(px, W, Hh, x, y + (x - 4) // 9, TARP[5 if y < 8 else (4 if x % 6 else 3)])
    for k in range(8): put(px, W, Hh, 25 + k // 2, 18 + k, WD[4]); put(px, W, Hh, 26 + k // 2, 18 + k, WD[2])
    for y in range(20, 31):                                      # 남은 바퀴(왼쪽)
        for x in range(2, 14):
            d = math.hypot(x + 0.5 - 8, y + 0.5 - 25.5)
            if 4.0 < d < 5.6: put(px, W, Hh, x, y, WD[4] if x < 8 else WD[2])
            elif d < 1.6: put(px, W, Hh, x, y, ST[3])
            elif d < 4.0 and (abs(x + 0.5 - 8) < 0.8 or abs(y + 0.5 - 25.5) < 0.8): put(px, W, Hh, x, y, WD[3])
    im = night(fin(im)); p = im.load()
    sheen_top(p, W, Hh, [(x, 6 + (x - 4) // 9) for x in range(5, 24, 2)], 6, 0.6)
    return im

def bollard_stone():
    """돌 계선주·말뚝(1칸): 부두·다리 끝 짧은 돌기둥, 둥근 머리 윗면이 젖어 빛난다, 밑동 이끼."""
    W, Hh = 16, 16; im, px = mk(W, Hh)
    for y in range(3, 15):
        for x in range(4, 12):
            t = 5 if x < 6 else (4 if x < 9 else 3)
            if y < 6: t = 6 if (x < 8 and y == 3) else 5
            if y == 14: t = 2
            put(px, W, Hh, x, y, ST[t])
    im = night(fin(im)); p = im.load()
    sheen_top(p, W, Hh, [(5, 3), (6, 3), (7, 3), (5, 4)], 1, 0.7)
    moss_foot(p, W, Hh, 4, 12, 14, 3, 4, 0.6)
    return im

def notice_column():
    """광고 기둥(1x3칸): 둥근 돌 기둥에 찢어지고 젖은 빈 종이(글자 없음)가 겹겹이 붙었고, 위에 둥근 쇠 갓·꼭지."""
    W, Hh = 16, 48; im, px = mk(W, Hh)
    PAPERS = [(hx('#d9d2be'), hx('#bcaaa0'), hx('#9e8d83')), (hx('#c8b47a'), hx('#a8945a'), hx('#7c6a3e')), (hx('#b89a9a'), hx('#987878'), hx('#705656'))]
    for y in range(10, 46):
        for x in range(2, 14):
            d = (x + 0.5 - 8) / 6.0
            k = 0.7 + 0.45 * max(0, 1 - abs(d + 0.35))
            c = mul(ST[4], k)
            band = (y - 10) // 7
            if 12 <= y < 42 and H(band, x // 4, 9) > 0.2:
                pc = PAPERS[(band + x // 5) % 3]
                c = mul(pc[0] if d < -0.2 else (pc[1] if d < 0.4 else pc[2]), 0.95)
                if H(x, y, 3) > 0.93: c = mul(c, 0.8)
                if y % 7 == 6 and H(x, band, 4) > 0.5: c = mul(ST[4], k)
            if y >= 43: c = ST[3] if y < 45 else ST[2]
            put(px, W, Hh, x, y, c)
    for y in range(4, 10):
        hw = 3 + (y - 4)
        for x in range(8 - hw, 8 + hw):
            put(px, W, Hh, x, y, ST[3] if x < 8 else ST[1])
    for x in range(1, 15): put(px, W, Hh, x, 10, ST[4]); put(px, W, Hh, x, 11, ST[2])
    put(px, W, Hh, 7, 2, ST[3]); put(px, W, Hh, 8, 2, ST[2]); put(px, W, Hh, 7, 3, ST[4])
    im = night(fin(im)); p = im.load()
    sheen_top(p, W, Hh, [(x, 10) for x in range(2, 9)] + [(5, 6), (6, 5)], 7, 0.6)
    drip_stains(p, W, Hh, 2, 14, 12, 43, 7, 0.18, 0.35)
    return im

def fountain_rain():
    """빗물 찬 광장 분수(3x3칸): 둥근 돌 수반(두꺼운 테 윗면이 젖어 빛남), 가운데 부러진 기둥, 넘친 물이 테를 넘어 흘렀다. 물은 멈췄고 빗물만 고였다."""
    W, Hh = 48, 48; im, px = mk(W, Hh)
    cx, cy, rx, ry = 24, 29, 21, 10
    for y in range(Hh):
        for x in range(W):
            dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry
            d = dx * dx + dy * dy
            if d <= 1.0:
                if d > 0.62: c = ST[6] if dy < -0.3 and dx < 0.3 else (ST[5] if dy < 0.2 else ST[4])
                else: c = (33, 45, 66)
                put(px, W, Hh, x, y, c)
    for x in range(W):                                           # 수반 앞 돌 벽(타원 앞 가장자리 밑으로 7px)
        dx = (x + 0.5 - cx) / rx
        if abs(dx) >= 1: continue
        yy = int(cy + ry * math.sqrt(1 - dx * dx))
        for y in range(yy, min(Hh, yy + 8)):
            t = 5 if dx < -0.5 else (4 if dx < 0.3 else 3)
            if y >= yy + 6: t = 2
            c = castle6.ash(x, y, bw=10, bh=4, seed=4) if 1 <= y - yy < 6 else ST[t]
            if 1 <= y - yy < 6: c = mul(c, 0.85 if dx < 0.3 else 0.68)
            put(px, W, Hh, x, y, c)
    for y in range(10, 30):                                      # 부러진 가운데 기둥
        for x in range(21, 28):
            t = 5 if x < 23 else (4 if x < 26 else 2)
            put(px, W, Hh, x, y, ST[t])
    for x in range(21, 28):
        yy = 10 + int(H(x, 3) * 3)
        for y in range(10, yy): put(px, W, Hh, x, y, (0, 0, 0, 0)[:3]) if False else None
        put(px, W, Hh, x, yy, ST[6])
    for y in range(18, 21):
        for x in range(19, 30): put(px, W, Hh, x, y, ST[5] if y == 18 else ST[3])
    im = night(fin(im)); p = im.load()
    for y in range(Hh):
        for x in range(W):
            dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry
            d = dx * dx + dy * dy
            if d <= 0.62 and not (21 <= x < 28 and y < 31):
                t = 2 if dy < -0.2 else 3
                if dy < -0.45 and H(x, 1) < 0.7: t = 5
                if (y % 4 == 1) and H(x // 3, y, 5) > 0.55: t = 4
                put(p, W, Hh, x, y, PUD[t])
    sheen_top(p, W, Hh, [(x, y) for y in range(Hh) for x in range(W) if 0.62 < ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 0.8 and y < cy - 4 and H(x, y, 6) < 0.5], 8, 0.6)
    for (x0, y0) in ((10, 37), (35, 38)):                       # 테를 넘어 수반 벽을 타고 흐른 물 자국(벽 안에서 끝남)
        for y in range(y0, y0 + 4): put(p, W, Hh, x0, y, mix(PUD[4], SHEEN[5], 0.4))
    moss_foot(p, W, Hh, 0, W, Hh - 2, 9, 5, 0.5)
    return im

def statue_weathered():
    """비바람에 닳은 석상(2x3칸): 두 단 받침(몰딩) 위 두건 쓴 망토 형상(얼굴 없음) — 어깨가 넓고 망토 자락이 받침까지 내려온다,
    오른손에 긴 지팡이, 왼팔은 팔꿈치에서 부러졌다. 어깨·받침 윗면 이끼, 세로 빗물 얼룩."""
    W, Hh = 32, 48; im, px = mk(W, Hh)
    for y in range(33, 47):                                      # 받침: 윗단(좁음) + 아랫단(넓음)
        x0, x1 = (8, 24) if y < 38 else (5, 27)
        for x in range(x0, x1):
            t = 4 if x < x0 + 3 else (3 if x < x1 - 3 else 2)
            if y in (33, 38): t = 6 if x < x1 - 4 else 5
            if y in (37, 46): t = 2
            put(px, W, Hh, x, y, ST[t] if t != 3 else castle6.ash(x, y, bw=9, bh=4, seed=3))
    cx = 16
    for y in range(13, 34):                                      # 망토: 어깨(넓음)에서 자락으로 살짝 넓어짐
        f = (y - 13) / 20.0
        hw = 6.5 + f * 1.8
        for x in range(int(cx - hw), int(cx + hw) + 1):
            dx = (x + 0.5 - cx) / hw
            t = 5 if dx < -0.45 else (4 if dx < 0.15 else (3 if dx < 0.7 else 2))
            if y > 18 and int(x + 0.5 - cx) in (-3, 1, 4) and t > 2: t -= 1      # 세로 주름
            if y == 33: t = 2
            put(px, W, Hh, x, y, ST[t])
    for y in range(11, 14):                                      # 어깨 윗선
        for x in range(cx - 6 + (13 - y), cx + 7 - (13 - y)): put(px, W, Hh, x, y, ST[5] if x < cx else ST[4])
    for y in range(4, 12):                                       # 두건 머리
        for x in range(cx - 4, cx + 5):
            d = math.hypot((x + 0.5 - cx) / 4.2, (y + 0.5 - 8) / 4.4)
            if d < 1: put(px, W, Hh, x, y, ST[6] if (x < cx - 1 and y < 8) else (ST[4] if x < cx + 2 else ST[3]))
    for y in range(7, 11):
        for x in range(cx - 2, cx + 2): put(px, W, Hh, x, y, ST[2])          # 두건 속 그늘(얼굴 없음)
    for y in range(2, 34): put(px, W, Hh, cx + 9, y, ST[4]); put(px, W, Hh, cx + 10, y, ST[2])   # 지팡이
    for y in range(17, 21):
        for x in range(cx + 6, cx + 10): put(px, W, Hh, x, y, ST[4] if y < 19 else ST[3])        # 지팡이 쥔 손
    for k in range(6): put(px, W, Hh, cx - 7 - k // 2, 15 + k, ST[4]); put(px, W, Hh, cx - 6 - k // 2, 15 + k, ST[3])  # 부러진 왼팔
    put(px, W, Hh, cx - 10, 21, ST[5]); put(px, W, Hh, cx - 9, 21, ST[2])
    im = night(fin(im)); p = im.load()
    for (x, y) in ((cx - 5, 11), (cx - 4, 11), (cx - 3, 10), (cx + 3, 11), (9, 33), (10, 33), (11, 33), (20, 33), (6, 38), (7, 38), (25, 38)):
        put(p, W, Hh, x, y, NMOSS[4]); put(p, W, Hh, x, y + 1, NMOSS[2])
    drip_stains(p, W, Hh, 9, 24, 14, 45, 3, 0.18, 0.3)
    sheen_top(p, W, Hh, [(x, 33) for x in range(9, 22, 2)] + [(x, 38) for x in range(6, 26, 3)] + [(cx - 2, 4), (cx - 1, 4), (cx + 9, 2)], 3, 0.6)
    return im

def iron_gate():
    """녹슨 쇠 대문(3x3칸): 돌 기둥 둘(갓돌) 사이 반쯤 열린 쇠살문 — 한 짝은 경첩이 빠져 기울었다. 담·옹벽 틈에 세운다."""
    W, Hh = 48, 48; im, px = mk(W, Hh)
    for x0 in (0, 38):
        for y in range(6, 48):
            for x in range(x0, x0 + 10):
                c = castle6.ash(x, y, bw=10, bh=6, seed=5)
                if y < 9: c = ST[6] if y == 6 else ST[4]
                if x == x0 + 9: c = mul(c, 0.75)
                put(px, W, Hh, x, y, c)
        for y in range(2, 6):
            for x in range(x0 + 2, x0 + 8): put(px, W, Hh, x, y, ST[5] if x < x0 + 5 else ST[3])
    RUST = R('bronze')
    for leaf, (xa, xb, tilt) in enumerate(((10, 24, 0.0), (24, 38, 0.22))):
        for x in range(xa, xb):
            top = 12 + int(abs(x - (xa + xb) / 2) * 0.3)
            for y in range(top, 46):
                yy = y + (int((x - xa) * tilt) if tilt else 0)
                bar = (x - xa) % 3 == 1
                rail = y in (top, top + 1, 28, 29, 44)
                if bar or rail: put(px, W, Hh, x, min(47, yy), RUST[4] if rail and y in (top, 28) else (ST[3] if (x + y) % 5 else RUST[3]))
    im = night(fin(im)); p = im.load()
    sheen_top(p, W, Hh, [(x, 6) for x in range(1, 9)] + [(x, 6) for x in range(39, 47)], 4, 0.6)
    moss_foot(p, W, Hh, 0, W, 47, 5, 6, 0.5)
    return im

def flowerbox_wilted():
    """창가 꽃상자(1칸): 처진 시든 꽃·젖은 흙, 나무 상자 앞모에 빗물 맺힘. 집 창 아래 벽에 붙여 찍는다."""
    W, Hh = 16, 16; im, px = mk(W, Hh)
    for y in range(9, 14):
        for x in range(1, 15): put(px, W, Hh, x, y, WD[5] if y == 9 else (WD[4] if y < 12 else WD[2]))
    for (x, h, c) in ((3, 5, R('leaf')[3]), (5, 3, R('leaf')[2]), (8, 6, R('leaf')[3]), (11, 4, R('leaf')[2]), (13, 3, R('leaf')[3])):
        for j in range(h): put(px, W, Hh, x + (1 if j > h - 2 else 0), 8 - j, c)
        put(px, W, Hh, x + 1, 9 - h, R('red')[3] if x % 2 else R('bronze')[4])
    im = night(fin(im)); p = im.load()
    sheen_top(p, W, Hh, [(x, 9) for x in range(2, 14, 2)], 9, 0.6)
    return im

def planter_cypress():
    """돌 화분의 젖은 측백(1x3칸): 버들항 측백(roman.cypress)을 네모 돌 화분에 심었다 — 밑 1칸만 막힘."""
    t = roman.cypress(3, seed=4)
    im, px = mk(16, 56)
    im.alpha_composite(t, (0, 0))
    for y in range(46, 56):
        for x in range(2, 14):
            put(px, 16, 56, x, y, ST[6] if y == 46 else (ST[5] if x < 5 else (ST[4] if x < 11 else ST[2])) if y < 55 else ST[2])
    im = night(fin(im)); p = im.load()
    sheen_top(p, 16, 56, [(x, 46) for x in range(3, 13, 2)], 1, 0.6)
    return im

def sign_bracket():
    """가게 걸이 간판(1x1칸 반): 벽에서 나온 쇠 팔에 매단 나무 판 — 글자 대신 열쇠 그림 하나(상표 아님). 집 벽에 붙여 찍는다."""
    W, Hh = 16, 24; im, px = mk(W, Hh)
    for x in range(0, 14): put(px, W, Hh, x, 3, ST[3]); put(px, W, Hh, x, 4, ST[1])
    for k in range(6): put(px, W, Hh, 1 + k, 5 + k, ST[2])
    for x in (4, 12): put(px, W, Hh, x, 5, ST[2]); put(px, W, Hh, x, 6, ST[2])
    for y in range(7, 19):
        for x in range(3, 14): put(px, W, Hh, x, y, WD[5] if (x == 3 or y == 7) else (WD[2] if (x == 13 or y == 18) else WD[4]))
    for (x, y) in ((6, 11), (7, 10), (7, 12), (8, 11), (9, 11), (10, 11), (11, 11), (11, 12), (10, 12)):
        put(px, W, Hh, x, y, R('bronze')[5] if y == 10 or x == 6 else R('bronze')[4])
    im = night(fin(im)); p = im.load()
    for (x, y) in ((6, 11), (7, 10), (7, 12), (8, 11), (9, 11), (10, 11), (11, 11), (11, 12), (10, 12)):
        put(p, W, Hh, x, y, mix(N(R('bronze')[6]), SHEEN[5], 0.35))
    sheen_top(p, W, Hh, [(x, 3) for x in range(1, 13, 2)] + [(x, 7) for x in range(4, 13, 3)], 11, 0.6)
    return im

def umbrella_dropped():
    """떨어진 우산(1칸, 바닥 덧그림): 뒤집혀 길에 나뒹구는 검은 우산 — 살 하나가 꺾였고 안에 빗물이 고였다."""
    W, Hh = 16, 16; im, px = mk(W, Hh)
    for y in range(16):
        for x in range(16):
            d = ((x + 0.5 - 8) / 7.0) ** 2 + ((y + 0.5 - 8) / 4.2) ** 2
            if d < 1:
                ang = math.atan2(y + 0.5 - 8, x + 0.5 - 8)
                rib = abs(((ang / (math.pi / 4)) % 1) - 0.5) > 0.42
                t = 2 if rib else (3 if y < 8 else 1)
                put(px, W, Hh, x, y, R('bronze')[1] if False else ST[t])
    for k in range(6): put(px, W, Hh, 8 + k, 8 + k // 2, WD[4])
    put(px, W, Hh, 14, 11, WD[5]); put(px, W, Hh, 14, 12, WD[3])
    im = night(fin(im)); p = im.load()
    for x in range(5, 11): put(p, W, Hh, x, 7, PUD[4] if x % 2 else PUD[3])
    sheen_top(p, W, Hh, [(3, 6), (4, 5), (12, 5), (13, 6)], 12, 0.6)
    return im

def leaves_wet():
    """젖은 낙엽 더미(1칸, 바닥 덧그림): 길 가장자리·배수구 둘레에 몰린 짙은 갈색·누런 잎, 잎 몇 장에 빛 맺힘."""
    W, Hh = 16, 16; im, px = mk(W, Hh)
    for i in range(22):
        x = 2 + int(H(i, 1) * 12); y = 4 + int(H(i, 2) * 9)
        col = (R('bronze') if i % 3 else R('hay'))
        for (dx, dy, t) in ((0, 0, 4), (1, 0, 3), (0, 1, 2), (-1, 0, 5)):
            put(px, W, Hh, x + dx, y + dy, col[t])
    im = night(im); p = im.load()
    sheen_top(p, W, Hh, [(2 + int(H(i, 1) * 12) - 1, 4 + int(H(i, 2) * 9)) for i in range(0, 22, 4)], 13, 0.5)
    return im

def slates_fallen():
    """떨어진 지붕 슬레이트 조각(1칸, 바닥 덧그림): 깨진 청회색 판 몇 장이 겹쳐 떨어졌다(집 밑·처마 밑)."""
    W, Hh = 16, 16; im, px = mk(W, Hh)
    for i, (x0, y0, w, h) in enumerate(((2, 8, 6, 3), (7, 10, 7, 3), (4, 12, 5, 2), (10, 6, 4, 3))):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                if (x, y) == (x0 + w - 1, y0): continue
                put(px, W, Hh, x, y, SLATE[5] if y == y0 else (SLATE[3] if y < y0 + h - 1 else SLATE[1]))
    im = night(im); p = im.load()
    sheen_top(p, W, Hh, [(3, 8), (4, 8), (8, 10), (9, 10), (11, 6)], 14, 0.6)
    return im

def rubble_masonry():
    """무너진 마름돌 무더기(2x1칸): 깨진 큰 돌·작은 돌·기와 조각이 쌓였다, 윗돌 젖어 빛남, 틈에 잡풀."""
    W, Hh = 32, 16; im, px = mk(W, Hh)
    stones = [(2, 8, 8, 6), (9, 6, 9, 8), (17, 9, 7, 5), (23, 10, 7, 4), (6, 4, 6, 4), (13, 2, 6, 5), (20, 6, 5, 4)]
    for i, (x0, y0, w, h) in enumerate(stones):
        for y in range(y0, min(16, y0 + h)):
            for x in range(x0, x0 + w):
                t = 6 if y == y0 else (5 if x < x0 + 2 else (4 if y < y0 + h - 1 else 2))
                put(px, W, Hh, x, y, ST[t])
    im = night(fin(im)); p = im.load()
    sheen_top(p, W, Hh, [(x0 + 1, y0) for (x0, y0, w, h) in stones] + [(x0 + 2, y0) for (x0, y0, w, h) in stones], 15, 0.6)
    ntufts(p, W, Hh, 0, W, 15, 7, 0.3, 3)
    return im

def column_fallen():
    """넘어진 기둥 토막(2x1칸): 동서로 누운 둥근 기둥 두 토막 — 위가 밝고 아래로 어두워지는 원통 명암, 가로 홈 두 줄,
    왼쪽 토막 끝에 둥근 단면(나이테 같은 동심 테), 부러진 틈, 이끼."""
    W, Hh = 32, 16; im, px = mk(W, Hh)
    TR = roman.TRV
    for (x0, x1, yo) in ((1, 15, 0), (17, 31, 1)):
        for y in range(4, 14):
            v = (y - 4) / 9.0
            t = 6 if v < 0.12 else (5 if v < 0.38 else (4 if v < 0.62 else (3 if v < 0.85 else 2)))
            if y in (7, 10): t = max(2, t - 1)
            for x in range(x0, x1): put(px, W, Hh, x, y + yo, TR[t])
        for y in range(4, 14):                                   # 부러진 끝(들쭉날쭉)
            put(px, W, Hh, x1 - 1 - int(H(y, x0, 3) * 2), y + yo, TR[2])
    for y in range(4, 14):                                       # 왼쪽 끝 둥근 단면
        for x in range(0, 6):
            d = math.hypot((x + 0.5 - 3) / 3.0, (y + 0.5 - 9) / 5.0)
            if d < 1: put(px, W, Hh, x, y, TR[5] if d < 0.45 else (TR[4] if d < 0.75 else TR[3]))
    im = night(fin(im)); p = im.load()
    moss_foot(p, W, Hh, 0, W, 14, 16, 3, 0.6)
    sheen_top(p, W, Hh, [(x, 4) for x in range(6, 14, 2)] + [(x, 5) for x in range(18, 30, 2)], 16, 0.6)
    return im

def ivy_wall():
    """벽 담쟁이(2x2칸, 위층 덧그림): 벽·옹벽 앞면을 덮어 내려온 젖은 담쟁이 커튼(잎 덩이, 아래 끝은 들쭉날쭉)."""
    W, Hh = 32, 32; im, px = mk(W, Hh)
    LF = R('leaf')
    for x in range(W):
        ln = 10 + int(vnoise(x, 0, 4.0, 3) * 20)
        for y in range(ln):
            if H(x, y, 5) < 0.18: continue
            t = 4 if (x + y) % 5 == 0 else (3 if H(x // 2, y // 2, 6) > 0.5 else 2)
            if y == ln - 1: t = 1
            put(px, W, Hh, x, y, LF[t])
    im = night(im); p = im.load()
    sheen_top(p, W, Hh, [(x, y) for x in range(W) for y in range(28) if H(x, y, 7) > 0.96], 17, 0.5)
    return im

def moss_stones():
    """이끼 낀 돌 틈(1칸, 바닥 덧그림): 판석 가장자리·계단 옆에 이끼 덩이와 잔풀, 물방울 빛."""
    W, Hh = 16, 16; im, px = mk(W, Hh)
    for y in range(16):
        for x in range(16):
            d = ((x + 0.5 - 8) / 7.0) ** 2 + ((y + 0.5 - 9) / 5.0) ** 2 + (vnoise(x, y, 2.0, 18) - 0.5) * 0.7
            if d < 0.9 and H(x, y, 19) < 0.8: put(px, W, Hh, x, y, R('moss')[3 + int(H(x, y, 20) * 3)])
    im = night(im); p = im.load()
    ntufts(p, W, Hh, 3, 13, 13, 21, 0.4, 3)
    sheen_top(p, W, Hh, [(x, y) for x in range(16) for y in range(16) if H(x, y, 22) > 0.97], 18, 0.5)
    return im

def laundry_line():
    """골목 빨랫줄(4x2칸, 위층): 두 집 벽 사이에 처진 줄 — 셔츠·홑청·수건이 젖어 늘어졌다. 줄 양끝이 그림 양끝(벽에 닿게 찍는다)."""
    W, Hh = 64, 32; im, px = mk(W, Hh)
    def sag(x): return 4 + int(round(5 * math.sin(math.pi * x / (W - 1))))
    for x in range(W): put(px, W, Hh, x, sag(x), WD[4]); put(px, W, Hh, x, sag(x) + 1, WD[2]) if x % 2 else None
    x = 5; k = 0
    while x < W - 12:
        kd = ('shirt', 'sheet', 'pants', 'towel', 'sheet')[k % 5]; col = CLOTH[(k + 1) % 4]
        if kd == 'sheet': col = [hx(c) for c in ('#2c2a30', '#4c4a54', '#6c6a78', '#8e8c9a', '#b2b0bc', '#d4d2dc', '#f0eef4')]
        c = cloth_shape(kd, col)
        im.alpha_composite(c, (x, sag(x + c.width // 2) + 1))
        put(px, W, Hh, x + 1, sag(x + 1), WD[5]); put(px, W, Hh, x + c.width - 2, sag(x + c.width - 2), WD[5])
        x += c.width + 2 + int(H(k, 3) * 3); k += 1
    im = night(im); p = im.load()
    for x in range(0, W, 5): put(p, W, Hh, x, sag(x), SHEEN[5])
    return im

def rowboat():
    """매어 둔 작은 배(3x2칸): 비에 바닥까지 물이 찬 나무 배, 노 하나는 걸쳤고 뱃전 윗모가 젖어 빛난다. 물 위에 찍는다(걷기 아님)."""
    W, Hh = 48, 32; im, px = mk(W, Hh)
    cx, cy, rx, ry = 24, 16, 21, 9
    for y in range(Hh):
        for x in range(W):
            dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry
            d = dx * dx + (dy * (1.0 if dy < 0 else 0.9)) ** 2
            if d > 1: continue
            if d > 0.62: c = WD[6] if dy < -0.2 else (WD[5] if dy < 0.3 else WD[3])
            else: c = WD[2]
            put(px, W, Hh, x, y, c)
            if 0.62 < d and dy > 0.3:
                for j in range(1, 5): put(px, W, Hh, x, y + j, WD[3] if j < 3 else WD[1])
    for x in range(10, 40): put(px, W, Hh, x, 15, WD[4]); put(px, W, Hh, x, 16, WD[2])
    for k in range(22): put(px, W, Hh, 18 + k, 9 + k // 4, WD[5]); put(px, W, Hh, 18 + k, 10 + k // 4, WD[3])
    im = night(fin(im)); p = im.load()
    for y in range(Hh):
        for x in range(W):
            dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry
            if dx * dx + dy * dy < 0.45 and y > 17: put(p, W, Hh, x, y, PUD[3] if (x + y) % 5 else PUD[5])
    sheen_top(p, W, Hh, [(x, y) for y in range(Hh) for x in range(W) if 0.62 < ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 < 0.8 and y < cy and H(x, y, 3) < 0.5], 19, 0.6)
    return im

def dock_planks():
    """나무 선착장 판(3x3칸, 걷기): 물 위로 나간 판자 바닥(널 결·못 자리), 앞 끝 굵은 말뚝 둘, 판 윗면이 젖어 빛난다. 물 칸 위에 깐다."""
    W, Hh = 48, 56; im, px = mk(W, Hh)
    for y in range(0, 48):
        for x in range(2, 46):
            plank = (x - 2) // 6
            t = 5 if (x - 2) % 6 < 4 else 4
            if (x - 2) % 6 == 5: t = 2
            if (y + plank * 7) % 23 == 0: t = 3
            if H(plank, y // 6, 3) > 0.85: t = max(2, t - 1)
            put(px, W, Hh, x, y, WD[t])
    for y in range(48, 52):
        for x in range(2, 46): put(px, W, Hh, x, y, WD[3] if y == 48 else WD[2])
    for x0 in (2, 40):
        for y in range(40, 56):
            for x in range(x0, x0 + 6): put(px, W, Hh, x, y, WD[5] if x < x0 + 2 else (WD[3] if x < x0 + 5 else WD[1]))
        for x in range(x0, x0 + 6): put(px, W, Hh, x, 40, WD[6])
    im = night(fin(im)); p = im.load()
    sheen_top(p, W, Hh, [(x, y) for y in range(0, 48) for x in range(2, 46) if (x - 2) % 6 == 0 and H(x, y, 4) < 0.35], 20, 0.55)
    for x in range(2, 46, 3): put(p, W, Hh, x, 48, SHEEN[4])
    for y in range(52, 56):
        for x in (8, 9, 10, 37, 38, 39): put(p, W, Hh, x, y, PUD[5] if (x + y) % 2 else PUD[4])
    return im

# ================================================================ 다리 · 고가 통로
def arch_footbridge(wc=4, lamps=True):
    """돌 아치 인도교(wc x 3칸): 동서로 놓인 젖은 판석 바닥(윗면, 걷기), 앞뒤 쇠 난간, 앞면 마름돌 아치(아치 밑은 비워 물이 비친다),
    양 끝 다리 기둥 위에 켜진 등. 남북으로 흐르는 물길 위에 찍는다: 가운데 줄(바닥)이 걷는 칸."""
    W = wc * 16; Hh = 56; im, px = mk(W, Hh)
    DT, DB = 10, 26                                                # 바닥 윗면 y 범위
    for y in range(DT, DB):
        for x in range(W):
            row = (y - DT) // 5; off = (row % 2) * 6; lx = (x + off) % 12
            c = ST[5] if lx else ST[3]
            if (y - DT) % 5 == 4: c = ST[3]
            elif (y - DT) % 5 == 0 or lx == 1: c = ST[6] if H(x // 12, row, 3) > 0.4 else ST[5]
            put(px, W, Hh, x, y, c)
    cx = W / 2; rx = W * 0.32; ry = 18; spring = DB + 4 + ry
    for y in range(DB, Hh):
        for x in range(W):
            dx = (x + 0.5 - cx) / rx; dy = (spring - (y + 0.5)) / ry
            inside = (abs(dx) < 1) and (y + 0.5 > spring - ry * math.sqrt(max(0, 1 - dx * dx)))
            ring = (abs(dx) < 1.18) and (y + 0.5 > spring - (ry + 4) * math.sqrt(max(0, 1 - (dx / 1.18) ** 2))) and not inside
            if inside:
                yy = spring - ry * math.sqrt(max(0, 1 - dx * dx))
                if y + 0.5 - yy < 4: put(px, W, Hh, x, y, ST[1])       # 아치 밑면(그늘)
                continue                                               # 그 아래는 비움(물이 보인다)
            if y < DB + 3: c = ST[6] if y == DB else (ST[4] if y == DB + 1 else ST[2])
            elif ring:
                ang = math.degrees(math.atan2(max(0.01, spring - (y + 0.5)), x + 0.5 - cx))
                c = ST[5] if x < cx else ST[4]
                if int(ang) % 15 < 2: c = ST[2]
            else: c = castle6.ash(x, y, bw=12, bh=6, seed=wc)
            if x < 2 or x >= W - 2: c = mul(c, 0.8)
            put(px, W, Hh, x, y, c)
    back = iron_rail_front(W, 9); front = iron_rail_front(W, 9)
    im.alpha_composite(back, (0, DT - 8)); im.alpha_composite(front, (0, DB - 7))
    for x0 in (0, W - 6):                                          # 다리 끝 기둥(난간 기둥 굵게)
        for y in range(DT - 12, DB + 3):
            for x in range(x0, x0 + 6):
                if DT - 1 <= y < DB - 7 and not (y >= DT - 12): continue
                if y >= DB - 9 or y < DT + 1:
                    put(px, W, Hh, x, y, ST[5] if x < x0 + 2 else (ST[4] if x < x0 + 5 else ST[2]))
        for y in range(DT - 13, DT - 11):
            for x in range(x0 - 1, x0 + 7): put(px, W, Hh, x, y, ST[6] if y == DT - 13 else ST[4])
    im = fin(im)
    if lamps:
        for x0 in (3, W - 3):
            for y in range(0, DT - 13): put(im.load(), W, Hh, x0, y, ST[3]); put(im.load(), W, Hh, x0 + 1, y, ST[1])
    im = night(im); p = im.load()
    sheen_top(p, W, Hh, [(x, y) for y in range(DT, DB) for x in range(W) if (y - DT) % 5 == 0 and H(x, y, 9) < 0.35], 21, 0.55)
    sheen_top(p, W, Hh, [(x, DB) for x in range(0, W, 2)], 22, 0.5)
    if lamps:
        for x0 in (3, W - 3):
            for (xx, yy, t) in ((x0 - 1, 0, 6), (x0, 0, 6), (x0 + 1, 0, 5), (x0 - 1, 1, 5), (x0, 1, 6), (x0 + 1, 1, 4)):
                put(p, W, Hh, xx, yy, LIT[t])
            glow(p, W, Hh, x0 + 0.5, 1, 6, 0.3)
    moss_foot(p, W, Hh, 0, W, Hh - 1, 23, 5, 0.4)
    return im

PROPS = ['lamppost_lit', 'lamp_double_lit', 'lamp_wall', 'drain_grate', 'puddle_small', 'puddle_lamp', 'sewer_outlet', 'downpipe',
         'rain_barrel', 'bench_wet', 'crates_tarp', 'barrels_wet', 'cart_tarp', 'bollard_stone', 'notice_column', 'fountain_rain',
         'statue_weathered', 'iron_gate', 'flowerbox_wilted', 'planter_cypress', 'sign_bracket', 'umbrella_dropped', 'leaves_wet',
         'slates_fallen', 'rubble_masonry', 'column_fallen', 'ivy_wall', 'moss_stones', 'laundry_line', 'rowboat', 'dock_planks',
         'arch_footbridge']
