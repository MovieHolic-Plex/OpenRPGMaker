# 선술집 지하·주방 — 구조(오르는 계단·내려가는 계단·참나무 문 닫힘/열림·지하 창·창 빛·돌기둥·바닥 문·배수구·짚단·지하 우물).
from tc_base import *
from tc_base import _hash
from tc_kitchen import ashlar_block

def tread_tex(x, y, k, ramp=FLAG, seed=0):
    """계단 디딤판 돌 결: 칸마다 톤 ±1, 돌 이음(16px 마다 세로 줄눈)."""
    if (x + (y // 5) * 7) % 16 == 15: return ramp[clamp(k - 2, 1, 6)]
    if _hash(x, y, seed + 13) < .07: k -= 1
    elif _hash(x, y, seed + 14) > .96: k += 1
    return ramp[clamp(k, 1, 6)]

def stair_up(seed=0):
    """오르는 계단 2x4: 아래 2줄 = 바닥 위 디딤돌(북쪽으로 오른다, 위로 갈수록 밝다), 위 2줄 = 벽 앞면을 뚫은 아치 속으로
    계단이 이어지고 맨 위에 위층 등불 빛. 양옆 낮은 돌 난간벽."""
    cv = Cv(32, 64)
    # 아치 테(벽 앞면 위): 쐐기돌 + 기둥 돌
    ashlar_block(cv, 0, 0, 4, 64, TRIM, 4, 6, seed=21, k0=-1)
    ashlar_block(cv, 28, 0, 32, 64, TRIM, 4, 6, seed=23, k0=-2)
    for y in range(0, 64):                                                                   # 디딤판(아래 → 위)
        for x in range(4, 28):
            s = (63 - y) // 5; ly = (63 - y) % 5
            u = s / 12.0
            if y < 9:                                                                         # 아치 머리 속: 위층 빛
                c = AMBER[3] if y > 4 else AMBER[4]
                if (x + y) % 2 and y < 3: c = AMBER[5]
                cv.px(x, y, c); continue
            k = 2 + int(round(u * 3))
            if ly >= 3: c = tread_tex(x, y, k - 2, ASH, seed)                                # 챌판(그늘)
            else: c = tread_tex(x, y, k + (1 if ly == 2 else 0), FLAG, seed)
            if y < 32: c = mix(c, AMBER[2], .25 * (1 - y / 32.0))                            # 위층 빛이 아래로 번진다
            cv.px(x, y, c)
    for x in range(4, 28):                                                                    # 아치 머리 곡선(쐐기돌)
        t = (x - 4 + .5) / 24.0
        ya = int(round(7 * (1 - math.sin(math.pi * t))))
        for y in range(0, ya + 3):
            if y < ya: cv.px(x, y, TRIM[2] if (x // 4) % 2 else TRIM[3])
            else: cv.px(x, y, TRIM[4] if y == ya else TRIM[1])
    for y in range(32, 64):                                                                   # 아래 2줄: 난간벽 윗면 밝게
        for x in (1, 2): cv.px(x, y, TRIM[5] if x == 1 else TRIM[4])
        cv.px(29, y, TRIM[4]); cv.px(30, y, TRIM[3])
    cv.hline(0, 4, 63, TRIM[1]); cv.hline(28, 32, 63, TRIM[1])
    return fin(cv)

def stair_down(seed=0):
    """내려가는 계단 2x3: 바닥 위 디딤돌이 남쪽으로 내려가며 어두워지고 맨 아랫줄은 어둠 속으로 사라진다. 양옆 낮은 돌 난간벽의 윗면."""
    cv = Cv(32, 48)
    for y in range(0, 48):
        for x in range(0, 32):
            if x < 4 or x >= 28:
                k = 5 if x in (1, 29) else (4 if x in (2, 30) else 3)
                if x in (0, 31): k = 2
                if y == 0: k = 5
                c = TRIM[clamp(k - (y // 16), 1, 6)]
                cv.px(x, y, c); continue
            s = y // 5; ly = y % 5
            k = 4 - int(round(s * 3.4 / 9))
            if y >= 40:
                cv.px(x, y, VOIDC[0] if y > 43 else mix(ASH[1], VOIDC[0], (y - 39) / 5.0)); continue
            if ly >= 3: c = tread_tex(x, y, k - 2, ASH, seed)
            else: c = tread_tex(x, y, k + (1 if ly == 0 else 0), FLAG, seed)
            c = mul(c, 1 - .35 * y / 40.0)
            cv.px(x, y, c)
    return fin(cv)

def door_frame(cv):
    ashlar_block(cv, 0, 4, 5, 46, TRIM, 5, 6, seed=31, k0=-1)
    ashlar_block(cv, 27, 4, 32, 46, TRIM, 5, 6, seed=33, k0=-2)
    for x in range(0, 32):                                                                    # 반원 아치 쐐기돌
        t = (x + .5) / 32.0
        ya = int(round(9 * (1 - math.sin(math.pi * t)) ** .8))
        for y in range(ya, ya + 5):
            k = 4 if ((x * 5) // 32) % 2 else 3
            if y == ya: k += 1
            if y == ya + 4: k = 1
            cv.px(x, y, TRIM[clamp(k - (1 if x > 26 else 0), 1, 6)])
    box3(cv, 2, 45, 30, 48, 1, TRIM, 35, k0=-1)                                               # 문턱 돌

def _inner(x, y):
    t = (x + .5) / 32.0
    return y >= int(round(9 * (1 - math.sin(math.pi * t)) ** .8)) + 5 and 5 <= x < 27 and y < 45

def door_oak(seed=0):
    """참나무 문 2x3(벽 앞면 위, 앞면 3줄): 돌 아치 테 속 세로 널 문짝, 쇠 띠 경첩 둘, 고리 손잡이, 돌 문턱."""
    cv = Cv(32, 48)
    door_frame(cv)
    for y in range(0, 45):
        for x in range(5, 27):
            if not _inner(x, y): continue
            b = (x - 5) // 4; lx = (x - 5) % 4
            k = 3 if _hash(b, 0, seed + 41) < .6 else 4
            if lx == 3: k = 1
            elif lx == 0: k += 1
            g = grain(lx * 9 + b * 5, y + b * 13) - 3
            if g >= 2: k += 1
            elif g <= -2: k -= 1
            if y in (17, 18, 35, 36): c = IRON[4] if y in (17, 35) else IRON[2]
            else: c = OAK[clamp(k, 1, 6)]
            if y in (17, 35) and x in (7, 11, 15): c = IRON[6]
            cv.px(x, y, c)
    for (x, y) in ((21, 26), (20, 27), (22, 27), (20, 28), (22, 28), (21, 29)): cv.px(x, y, IRON[5])   # 고리
    cv.px(21, 25, IRON[4])
    return fin(cv)

def door_oak_open(seed=0):
    """열린 참나무 문 2x3: 같은 아치 속이 어둡게 뚫려 위로 오르는 디딤돌 셋이 보이고, 문짝은 안쪽 왼쪽으로 젖혀 세로로 좁게 보인다."""
    cv = Cv(32, 48)
    door_frame(cv)
    for y in range(0, 45):
        for x in range(5, 27):
            if not _inner(x, y): continue
            c = VOIDC[1]
            if y > 30:
                s = (44 - y) // 4
                c = FLAG[clamp(3 - s, 1, 6)] if (44 - y) % 4 < 2 else ASH[1]
            if x < 9:
                k = 4 if x == 5 else (3 if x < 8 else 2)
                c = OAK[k]
                if y in (17, 35): c = IRON[3]
            cv.px(x, y, c)
    return fin(cv)

def cellar_window(seed=0):
    """지하 창 2x2(벽 앞면 위쪽 두 줄): 깊게 들인 돌 창틀, 네 칸 나무 창살 너머 밝은 낮 하늘·바깥 돌벽, 위에 걷어 묶은 흰 삼베 커튼, 아래 창턱."""
    cv = Cv(32, 32)
    ashlar_block(cv, 0, 0, 32, 32, TRIM, 8, 5, seed=51, k0=-1)
    for y in range(4, 26):
        for x in range(5, 27):
            sky = y < 15
            c = GLASS[6] if sky else GLASS[5]
            if sky and (x + y * 2) % 11 == 0: c = TRIM[6]
            if not sky and (y - 15) % 4 == 3: c = GLASS[4]                                     # 바깥 돌벽 줄눈
            if x in (15, 16) or y in (14, 15): c = WOOD[4] if x == 15 or y == 14 else WOOD[2]
            if x in (5, 6) or y in (4, 5): c = mix(c, ASH[2], .55)                             # 깊은 창틀 그늘(왼쪽 위)
            cv.px(x, y, c)
    for (x0, side) in ((4, 1), (27, -1)):                                                     # 커튼
        for y in range(3, 19):
            w = 5 - abs(y - 10) // 2 if y < 14 else 2
            for i in range(max(1, w)):
                x = x0 + side * i
                cv.px(x, y, LINEN[5 if i == 0 else (4 if (i + y) % 3 else 3)])
        cv.px(x0, 13, ROPE[4]); cv.px(x0 + side, 13, ROPE[3])
    for x in range(3, 29): cv.px(x, 3, OAK[4]); cv.px(x, 2, OAK[2])                          # 커튼 막대
    box3(cv, 2, 26, 30, 31, 3, TRIM, 53)                                                      # 창턱
    return fin(cv)

def window_light(seed=0):
    """창 빛 2x3(바닥 덧그림, 반투명): 창에서 비스듬히 떨어진 낮빛 사다리꼴, 가장자리 바둑 점 번짐, 창살 그림자 두 줄."""
    o = new(32, 48); p = o.load()
    for y in range(48):
        x0 = 4 + y * 3 // 48; x1 = 28 + y * 5 // 48
        for x in range(32):
            if not (x0 <= x < x1): continue
            edge = min(x - x0, x1 - 1 - x, y, 47 - y)
            if x in (16 + y * 4 // 48, 17 + y * 4 // 48) or 22 <= y <= 23: continue          # 창살 그림자
            if edge < 2:
                if (x + y) % 2 == 0: p[x, y] = AMBER[6] + (22,)
            else: p[x, y] = AMBER[6] + (38,)
    return o

def pillar(seed=0):
    """돌기둥 1x3: 넓은 받침 돌·원통 기둥·위 머리 돌(천장 궁륭을 받친다)."""
    cv = Cv(16, 48)
    box3(cv, 0, 0, 16, 7, 2, TRIM, 61, k0=-1)
    for y in range(7, 40):
        for x in range(3, 13):
            k = cyl_k(x, 3, 13) - 1
            if (y - 7) % 8 == 7: k -= 1
            if _hash(x, y, 62) < .06: k -= 1
            cv.px(x, y, TRIM[clamp(k, 1, 6)])
    box3(cv, 1, 40, 15, 47, 2, TRIM, 63, k0=-1)
    cv.hline(1, 15, 47, SHADE)
    return fin(cv)

def trapdoor(seed=0):
    """바닥 문 2x2(바닥 덧그림, 걷기): 돌 테두리 속 가로 널 덮개, 쇠 경첩 둘, 쇠 고리."""
    cv = Cv(32, 32)
    for y in range(2, 30):
        for x in range(2, 30):
            if x < 4 or x >= 28 or y < 4 or y >= 28:
                cv.px(x, y, TRIM[4] if (x < 4 or y < 4) else TRIM[2]); continue
            row = (y - 4) // 4; ly = (y - 4) % 4
            k = 3 if _hash(row, 0, seed + 71) < .6 else 4
            if ly == 3: k = 1
            elif ly == 0: k += 1
            cv.px(x, y, OAK[k])
    for y in (8, 22): cv.hline(5, 11, y, IRON[4]); cv.hline(5, 11, y + 1, IRON[2])
    for (x, y) in ((22, 14), (21, 15), (23, 15), (21, 16), (23, 16), (22, 17)): cv.px(x, y, IRON[5])
    return fin(cv)

def drain(seed=0):
    """배수구 1x1(바닥 덧그림, 걷기): 젖은 돌 테 속 쇠 살 창살과 어두운 구멍."""
    cv = Cv(16, 16)
    for y in range(2, 14):
        for x in range(2, 14):
            if x < 4 or x >= 12 or y < 4 or y >= 12:
                cv.px(x, y, mix(TRIM[3], PUD[3], .4) if (x < 4 or y < 4) else PUD[2]); continue
            cv.px(x, y, IRON[4] if (x - 4) % 3 == 0 else VOIDC[1])
    return fin(cv)

def hay_bale(seed=0):
    """짚단 2x1: 끈 두 줄로 묶은 네모 짚단(윗면 짚 결 + 앞면), 비죽 나온 짚."""
    cv = Cv(32, 16)
    for y in range(2, 15):
        for x in range(1, 31):
            top = y < 7
            k = (5 if (x + y * 3) % 4 else 4) if top else (4 if x < 4 else (3 if x < 28 else 2))
            if not top and (x * 2 + y) % 5 == 0: k -= 1
            if top and _hash(x, y, 81) < .12: k += 1
            if y == 7: k = 2
            if y == 14: k = 1
            cv.px(x, y, STRAW[clamp(k - 1, 1, 6)])
    for x in (8, 23):
        for y in range(2, 15): cv.px(x, y, ROPE[2] if y > 7 else ROPE[3])
    for (x, y) in ((3, 1), (12, 1), (19, 0), (27, 1)): cv.px(x, y, STRAW[5]); cv.px(x + 1, y + 1, STRAW[4])
    cv.hline(1, 31, 15, SHADE)
    return fin(cv)

def cellar_well(seed=0):
    """지하 우물 2x3: 둥글게 쌓은 돌 고리(윗면 테 + 앞면) 속 검은 물, 두 나무 기둥 위 감는 축과 밧줄·두레박."""
    cv = Cv(32, 48)
    for (px_, sh) in ((3, 4), (27, 2)):                                                       # 기둥
        for y in range(4, 30):
            cv.px(px_, y, OAK[sh + 1]); cv.px(px_ + 1, y, OAK[sh])
    for x in range(3, 29): cv.px(x, 6, OAK[5]); cv.px(x, 7, OAK[3])                          # 감는 축
    cv.rect(8, 5, 12, 9, ROPE[4]); cv.px(8, 5, ROPE[5])
    cv.rect(29, 5, 32, 7, IRON[4])                                                            # 손잡이
    for y in range(9, 12): cv.px(14, y, ROPE[4])
    cv.rect(11, 12, 18, 18, OAK[3]); cv.vline(11, 12, 18, OAK[5]); cv.vline(17, 12, 18, OAK[2]); cv.hline(10, 19, 12, IRON[4]); cv.hline(11, 18, 16, IRON[3])   # 두레박
    for y in range(18, 46):                                                                    # 돌 고리
        for x in range(1, 31):
            dx = (x + .5 - 16) / 15.0
            if abs(dx) > 1: continue
            ey = 6.0 * math.sqrt(1 - dx * dx)
            tc = 26
            if y < tc - ey or y > 40 + ey * .4: continue
            inner = ((x + .5 - 16) / 11.0) ** 2 + ((y + .5 - tc) / 4.0) ** 2 <= 1
            if inner:
                c = VOIDC[1] if y < tc + 1 else PUD[1]
                if (x, y) in ((13, 27), (17, 28)): c = PUD[4]
                cv.px(x, y, c); continue
            if y <= tc + ey:
                k = 5 if dx < -.2 else 4
                if (int((math.atan2(y - tc, (x - 16) * .4) + 4) * 3)) % 2: k -= 1
            else:
                row = (y - int(tc + ey)) // 4
                lx = (x + row * 3) % 7
                k = cyl_k(x, 1, 31) - 1
                if (y - int(tc + ey)) % 4 == 3 or lx == 6: k = 1
            cv.px(x, y, TRIM[clamp(k - 1, 1, 6)])
    for y in range(9, 26):                                                                     # 두레박을 다시 앞에(고리 위로 늘어진다)
        pass
    cv.hline(2, 30, 47, SHADE)
    return fin(cv)
