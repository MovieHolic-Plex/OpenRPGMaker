# 극장 오토타일 3종 (4x4 = 16변형, 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8):
# 진홍 통로 깔개(바닥 아래층, 걷기) · 금 난간(위층, 막힘) · 대들보 통로 널(깊이 위에 까는 걷는 길).
from os_kit import *
from os_kit import _hash


def carpet_cell(m, N, E, S, W):
    """진홍 통로 깔개: 이웃 없는 쪽에 진홍 윤곽 → 금실 두 줄 → 짙은 띠, 속은 8px 주기 잔 금점 무늬(칸 격자가 드러나지 않게).
    이웃 없는 남·북 끝은 금 술."""
    im = new(); p = im.load()
    for y in range(T):
        for x in range(T):
            c = VEL[3] if (x * 3 + y * 5) % 7 else mix(VEL[3], VEL[4], .5)
            if (x % 8, y % 8) in ((3, 3), (4, 4), (3, 4), (4, 3)): c = VEL[4]
            if (x % 8, y % 8) in ((0, 7), (7, 0)): c = GLT[3]
            d = 99
            if not W: d = min(d, x)
            if not E: d = min(d, 15 - x)
            if not N: d = min(d, y)
            if not S: d = min(d, 15 - y)
            if d == 0: c = VEL[1]
            elif d == 1: c = GLT[5] if (x + y) % 4 else GLT[4]
            elif d == 2: c = VEL[2]
            elif d == 3: c = GLT[3]
            elif d == 4: c = VEL[2]
            p[x, y] = tuple(c) + (255,)
            if not S and y >= 15 and x % 2 == 0: p[x, y] = (0, 0, 0, 0)
            if not N and y == 0 and x % 2 == 1: p[x, y] = (0, 0, 0, 0)
    return im
def carpet_sheet(): return autotile_sheet(carpet_cell)


def rail_cell(m, N, E, S, W):
    """금 난간(박스석·오케스트라 자리 가장자리, 위층·막힘): 가로 줄 = 벨벳 감싼 손잡이(윗면 3행 + 앞 두께) 아래 금 난간동자,
    세로 줄 = 위에서 본 벨벳 손잡이 띠(금 테). 끝·모서리·외톨이는 금 공 머리 네모 기둥."""
    cv = Cv(16, 16)
    hz = E or W; vt = N or S
    if hz:
        xa = 0 if W else 6; xb = 16 if E else 10
        for x in range(xa, xb):
            lx = x % 4
            for y in range(8, 14):
                hw = {8: 0, 9: 1, 10: 1, 11: 0, 12: 0, 13: 1}[y]
                if abs(lx - 1.5) <= hw + .5: cv.px(x, y, GLT[5] if lx < 1 else (GLT[4] if lx < 3 else GLT[2]))
            cv.px(x, 14, GLT[4]); cv.px(x, 15, GLT[1])
            for y in range(2, 8):
                cv.px(x, y, VEL[6] if y == 2 else (VEL[5] if y < 4 else (VEL[3] if y < 6 else (GLT[4] if y == 6 else GLT[2]))))
    if vt:
        ya = 0 if N else 6; yb = 16 if S else 10
        for y in range(ya, yb):
            for x in range(5, 11):
                cv.px(x, y, GLT[5] if x == 5 else (VEL[5] if x < 8 else (VEL[4] if x < 10 else GLT[2])))
    straight = m in (10, 5)
    if not straight:
        for y in range(2, 8):
            for x in range(4, 12): cv.px(x, y, GLT[6] if (y == 2 or x == 4) else (GLT[5] if x < 10 else GLT[3]))
        for (x, y) in ((7, 0), (8, 0), (6, 1), (7, 1), (8, 1), (9, 1)): cv.px(x, y, GLT[6] if x < 8 else GLT[4])
        for y in range(8, 15):
            for x in range(5, 11): cv.px(x, y, GLT[5] if x < 7 else (GLT[4] if x < 9 else GLT[2]))
        for x in range(5, 11): cv.px(x, 15, GLT[1])
    return pz.fin(cv.im, .6)
def rail_sheet(): return autotile_sheet(rail_cell)


def catwalk_cell(m, N, E, S, W):
    """대들보 통로 널(걷기): 길 방향으로 누운 4px 널. 이웃 없는 쪽: 북 = 쇠 관 난간 + 발판 턱, 남 = 발판 턱 + 아래로 3/4 들보 두께(앞면) + 그림자,
    서·동 = 발판 턱과 관 난간 기둥. 이음 칸(외톨이·교차)은 가로 널."""
    im = new(); p = im.load()
    vert = (N or S) and not (E or W)
    for y in range(T):
        for x in range(T):
            a, b = (x, y) if vert else (y, x)
            ly = a % 4
            t = 5 if _hash(a // 4, (b + (a // 4) * 5) // 16, 1001) < .6 else 4
            if ly == 3: t = 2
            elif ly == 0: t += 1
            g = grain(b * 3 + a, a * 5) - 3
            if g >= 2: t += 1
            elif g <= -2: t -= 1
            if (b + (a // 4) * 7) % 16 == 0 and ly != 3: t = 2
            c = WD[clamp(t, 1, 6)]
            if not S and y >= 11:                                                    # 남쪽: 턱 + 들보 앞면 두께
                c = (WD[5], WD[3], WD[3], WD[2], (16, 14, 26))[y - 11]
            if not N and y < 3: c = (WD[6], WD[4], WD[2])[y]
            if not W and x < 2 and not (not S and y >= 11): c = WD[5] if x == 0 else WD[3]
            if not E and x > 13 and not (not S and y >= 11): c = WD[3] if x == 14 else WD[1]
            p[x, y] = tuple(c) + (255,)
    cv = Cv(16, 16); cv.im = im; cv.p = p
    if not N:                                                                        # 북 난간 관(위로 3/4: 기둥 위 가로 관)
        for x in range(16): cv.px(x, 0, IR[4])
    if not S:
        for x in range(16):
            cv.px(x, 10, IR[4])
            if x % 8 == 3: cv.px(x, 9, IR[5])
        for x in (3, 11): cv.px(x, 11, IR[3]); cv.px(x, 12, IR[2])
    if not W:
        for y in range(16): cv.px(0, y, IR[4])
    if not E:
        for y in range(16): cv.px(15, y, IR[2])
    return im
def catwalk_sheet(): return autotile_sheet(catwalk_cell)
