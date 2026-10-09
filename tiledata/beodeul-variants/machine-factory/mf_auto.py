# 기계 공장 16변형 오토타일 셋 (칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8, 왼쪽 위 칸이 0):
#   conveyor   — 컨베이어(위층, 막힘): 3/4 윗면 = 고무 벨트 + 가로살(움직임 방향과 직각), 양옆 강철 테, 남쪽 끝 = 강철 틀 앞면과
#                롤러 축 머리(8px 마다), 이웃이 없는 끝 = 둥근 끝 드럼. 꺾인 칸·갈래 칸 = 롤러 깔린 강철 옮김판.
#   rail       — 격자 통로 난간(위층, 막힘): 바랜 노랑 손잡이 관 + 가운데 관 + 8px 마다 강철 기둥 + 발 막이 판, 끝·모서리 = 머리 기둥.
#   hazardline — 바닥 경고선(아래층, 걷기, 투명): 구역 바깥 가장자리에 노랑·검정 사선 띠(폭 3px, 벗겨짐 12%). 속 칸은 비어 있다.
# 그림은 fr_mat 톤 캔버스(TC)·기계 재질 램프만 쓴다. 이음매는 fin_nb(이어지는 쪽은 윤곽 없음).
from mf_kit import *
from gc_kit import autotile_sheet

# ------------------------------------------------------------------ 컨베이어
BELT_Y0, BELT_Y1 = 2, 10          # 가로 벨트 윗면(고무) 줄
RAIL_N, RAIL_S = (0, 1), (10, 11)
FRONT0 = 12                       # 앞면 시작 줄
BX0, BX1 = 3, 13                  # 세로 벨트 고무 열 [3,13)

def conveyor_cell(m, N, E, S, W, X0=0, Y0=0):
    tc = TC(16, 16, 3)
    hz = E or W or not (N or S)
    vt = N or S
    belt = np.zeros((16, 16), bool)
    if hz:
        xa = 0 if W else 2; xb = 16 if E else 14
        if vt and not W: xa = BX0
        if vt and not E: xb = BX1
        belt[BELT_Y0:BELT_Y1, xa:xb] = True
    if vt:
        ya = 0 if N else BELT_Y0; yb = 16 if S else BELT_Y1
        belt[ya:yb, BX0:BX1] = True
    # 테 = 벨트를 2px 넓힌 곳(이어지는 쪽 칸 경계 너머로는 넓히지 않는다)
    fr = belt.copy()
    for _ in range(2):
        f2 = fr.copy()
        f2[1:, :] |= fr[:-1, :]; f2[:-1, :] |= fr[1:, :]; f2[:, 1:] |= fr[:, :-1]; f2[:, :-1] |= fr[:, 1:]
        fr = f2
    if not vt or not N:
        fr[:0, :] = False
    if hz and not vt:
        fr[:RAIL_N[0], :] = False
    rim = fr & ~belt
    # 앞면: 열마다 테의 맨 아래 줄 밑으로 4px (남쪽으로 이어지면 없음)
    for y in range(16):
        for x in range(16):
            X = X0 + x; Y = Y0 + y
            if belt[y, x]:
                junction = hz and vt and (BX0 <= x < BX1) and (BELT_Y0 <= y < BELT_Y1)
                turn = junction and m not in (5, 10)
                if turn:                                                          # 롤러 옮김판: 가로 롤러(원통)가 3px 마다
                    ly = (y - BELT_Y0) % 3
                    k = 5 if ly == 0 else (3 if ly == 1 else 1)
                    if x in (BX0, BX1 - 1): k = 2
                    tc.px(x, y, 'steel', k)
                elif vt and (BX0 <= x < BX1) and not (hz and BELT_Y0 <= y < BELT_Y1 and (x < BX0 or x >= BX1)) and (not hz or y >= BELT_Y1 or y < BELT_Y0 or m in (5,)):
                    ly = Y % 4                                                    # 세로 벨트: 가로살
                    k = 3 if ly == 0 else (1 if ly == 1 else 2)
                    if x == BX0: k += 1
                    if x == BX1 - 1: k = max(1, k - 1)
                    tc.px(x, y, 'cable', clampk(k, 1, 6))
                else:
                    lx = X % 4                                                    # 가로 벨트: 세로살
                    k = 3 if lx == 0 else (1 if lx == 1 else 2)
                    if y == BELT_Y0: k += 1
                    if y == BELT_Y1 - 1: k = max(1, k - 1)
                    tc.px(x, y, 'cable', clampk(k, 1, 6))
            elif rim[y, x]:
                # 테: 위·왼쪽 모서리가 밝다
                up = y > 0 and belt[y - 1, x] if y > 0 else False
                lt = x > 0 and belt[y, x - 1]
                k = 5 if (not up and (y < BELT_Y0 or (x < BX0))) else 3
                if y in (RAIL_S[0], RAIL_S[1]) and hz: k = 5 if y == RAIL_S[1] else 3
                if x >= BX1 and vt and not (hz and BELT_Y0 - 2 <= y < BELT_Y1 + 2): k = 3 if x == BX1 else 2
                if (X + Y) % 8 == 0 and k >= 3: k = 6                            # 볼트
                tc.px(x, y, 'steel', k)
    if not S:                                                                     # 앞면(틀 + 롤러 축 머리)
        cols = [x for x in range(16) if fr[:, x].any()]
        for x in cols:
            yb = max(y for y in range(16) if fr[y, x])
            X = X0 + x
            for j in range(1, 5):
                y = yb + j
                if y > 15: break
                k = 3 if j < 4 else 1
                if x == min(cols): k += 1
                if x == max(cols): k -= 1
                if j in (1, 2) and X % 8 in (3, 4):                               # 롤러 축 머리
                    k = (6 if j == 1 else 4) if X % 8 == 3 else (4 if j == 1 else 2)
                tc.px(x, y, 'steel', clampk(k, 1, 6))
    if hz and not vt:                                                             # 끝 드럼(둥근 끝)
        for (has, xs) in ((W, (2, 3)), (E, (12, 13))):
            if not has:
                for y in range(BELT_Y0, BELT_Y1):
                    tc.px(xs[0], y, 'steel', 5 if xs[0] < 8 else 3); tc.px(xs[1], y, 'steel', 3 if xs[0] < 8 else 2)
    if vt and not hz and not N:
        for x in range(BX0, BX1): tc.px(x, BELT_Y0, 'steel', 5); tc.px(x, BELT_Y0 + 1, 'steel', 3)
    if vt and not hz and not S:
        for x in range(BX0, BX1): tc.px(x, BELT_Y1 - 1, 'steel', 2)
    return fin_nb(tc.img(), N, E, S, W, .62)

def conveyor_sheet():
    sh = new(64, 64)
    for n in range(16):
        N, E, S, W = bool(n & 1), bool(n & 2), bool(n & 4), bool(n & 8)
        sh.alpha_composite(conveyor_cell(n, N, E, S, W, n % 4 * 16, n // 4 * 16), (n % 4 * 16, n // 4 * 16))
    return sh

# ------------------------------------------------------------------ 난간
def rail_cell(m, N, E, S, W):
    tc = TC(16, 16, 5)
    hz = E or W; vt = N or S
    if hz:
        xa = 0 if W else 6; xb = 16 if E else 10
        for x in range(xa, xb):
            tc.px(x, 3, 'warn', 6); tc.px(x, 4, 'warn', 4); tc.px(x, 5, 'warn', 2)       # 손잡이 관
            tc.px(x, 8, 'warn', 4); tc.px(x, 9, 'warn', 2)                              # 가운데 관
            tc.px(x, 12, 'steel', 4); tc.px(x, 13, 'steel', 3); tc.px(x, 14, 'steel', 2)  # 발 막이 판
            if x % 8 in (3, 4):                                                          # 기둥
                for y in range(3, 15):
                    if y in (3, 4, 5, 8, 9): continue
                    tc.px(x, y, 'steel', 5 if x % 8 == 3 else 2)
                tc.px(x, 2, 'steel', 5 if x % 8 == 3 else 3)
            if (x + 2) % 6 == 0: tc.shift(x, 4, -1)
    if vt:
        ya = 0 if N else 4; yb = 16 if S else 11
        for y in range(ya, yb):
            tc.px(6, y, 'warn', 6); tc.px(7, y, 'warn', 5); tc.px(8, y, 'warn', 3); tc.px(9, y, 'steel', 1)
            if y % 8 == 6:                                                                # 기둥 머리(위에서)
                for x in range(5, 10): tc.px(x, y, 'steel', 5 if x < 7 else 3)
                for x in range(5, 10): tc.px(x, y + 1, 'steel', 2)
    straight = m in (5, 10)
    if not straight:                                                                     # 머리 기둥
        for y in range(1, 15):
            for x in range(5, 10):
                k = 5 if x < 7 else (4 if x < 9 else 2)
                if y < 3: k = 6 if (y == 1 or x == 5) else 4
                if y == 14: k = 1
                tc.px(x, y, 'warn' if y < 3 else 'steel', k)
        tc.px(6, 0, 'warn', 5); tc.px(7, 0, 'warn', 6); tc.px(8, 0, 'warn', 4)
    return fin_nb(tc.img(), N, E, S, W, .62)

def rail_sheet(): return autotile_sheet(rail_cell)

# ------------------------------------------------------------------ 경고선
def hazard_cell(m, N, E, S, W, X0=0, Y0=0):
    tc = TC(16, 16, 9)
    for y in range(16):
        for x in range(16):
            X = X0 + x; Y = Y0 + y
            d = 99
            if not N: d = min(d, y - 1)
            if not S: d = min(d, 14 - y)
            if not W: d = min(d, x - 1)
            if not E: d = min(d, 14 - x)
            if d < 0 or d > 2: continue
            on = ((X + Y) // 3) % 2 == 0
            if _hash(X // 2, Y // 2, 917) < .12: continue                                   # 벗겨짐
            if on: tc.px(x, y, 'warn', 5 if d == 0 else 4)
            else: tc.px(x, y, 'cable', 2)
    im = tc.img()
    # 칠은 반투명하지 않고 바닥 위에 납작하게 — 윤곽 없음(바닥 페인트)
    return im

def hazard_sheet():
    sh = new(64, 64)
    for n in range(16):
        N, E, S, W = bool(n & 1), bool(n & 2), bool(n & 4), bool(n & 8)
        sh.alpha_composite(hazard_cell(n, N, E, S, W, n % 4 * 16, n // 4 * 16), (n % 4 * 16, n // 4 * 16))
    return sh
