"""wasteland_ruins 기물 — 녹슨 차 4 · 물탱크 · 망루 · 발전기 · 태양광판 · 모닥불(3프레임) · 통나무 의자 · 노점 2 · 드럼통 · 타이어 · 상자 ·
고철 더미 · 잔해 더미 · 죽은 나무 · 야생 덤불 · 덩굴 벽 · 휜 가로등 · 콘크리트 방벽 · 빈 표지판.

차는 높은 3/4: 지붕·보닛·트렁크 윗면이 크게 보이고(밝게), 남쪽 옆면은 아래 띠. 바퀴는 둥근 옆모습 대신 바람 빠져 주저앉은 아래 반쪽 덩이.
"""
from wl_kit import *


def glass_broken(c, x, y, w, h, seed=0, tone=2):
    """깨진 유리 면: 어두운 유리 + 위 한 줄 밝게 + 거미줄 금(밝은 화소 선) + 뚫린 구멍(검댕)."""
    for j in range(h):
        for i in range(w):
            t = tone + (1 if j == 0 else 0) - (1 if j == h - 1 else 0)
            c.P(x + i, y + j, K('glass', t))
    cx, cy = x + 1 + hsh(1, seed, 2) % max(1, w - 2), y + h // 2
    for (dx, dy) in ((1, -1), (-2, 1), (2, 1)):
        for k in range(1, 3 + (seed % 2)):
            xx, yy = cx + dx * k // 2, cy + dy * k // 2
            if x <= xx < x + w and y <= yy < y + h: c.P(xx, yy, K('glass', 5))
    if hsh(seed, 3, 4) % 2: c.P(cx, cy, K('soot', 0)); c.P(cx + 1, cy, K('soot', 1))


def flat_tyre(c, x, y, w=9):
    """바람 빠진 타이어(옆, 아래 반쪽만): 바닥에 퍼진 고무 덩이 + 위 휠 테 한 줄."""
    c.R(x + 1, y, w - 2, 3, K('rubber', 2)); c.R(x, y + 1, w, 3, K('rubber', 1))
    c.HL(x + 1, y, w - 2, K('rubber', 4)); c.HL(x, y + 3, w, K('rubber', 0))
    c.HL(x + 2, y - 1, w - 4, K('metal', 2)); c.P(x + w // 2, y + 1, K('metal', 4))


def car_h(c, paint, seed=0, burnt=False):
    """동서로 놓인 승용차(48×32). 앞(보닛)은 동쪽."""
    P = paint
    if burnt: P = 'brust'
    hi = 5 if not burnt else 6
    # 아래 그림자
    c.shadow([(x, y) for y in (29, 30) for x in range(4, 46)])
    # 옆면(남쪽 면): 행 18..27
    for y in range(18, 28):
        for x in range(3, 46):
            t = 2 if y < 25 else 1
            if y == 18: t = 4
            if y == 19: t = 3
            c.P(x, y, K(P, t))
    c.HL(3, 27, 43, K(P, 0)); c.VL(3, 18, 10, K(P, 3)); c.VL(45, 18, 9, K(P, 1))
    for x in (17, 29): c.VL(x, 19, 7, K(P, 0)); c.VL(x + 1, 19, 7, K(P, 3))          # 문 이음
    c.HL(21, 21, 3, K('metal', 5)); c.HL(32, 21, 3, K('metal', 5))                   # 손잡이
    # 바퀴 구멍(아치) + 주저앉은 타이어
    for wx in (7, 34):
        for y in range(23, 28):
            for x in range(wx - 1, wx + 10):
                if (x - wx - 4) ** 2 / 30 + (y - 28) ** 2 / 25 <= 1: c.P(x, y, K('soot', 0))
        c.HL(wx, 22, 8, K(P, 4)) if not burnt else None
        flat_tyre(c, wx, 26, 9)
    # 윗면: 트렁크(서) · 뒤 유리 · 지붕 · 앞 유리 · 보닛(동)
    def plane(x0, x1, y0, y1, t):
        for y in range(y0, y1):
            for x in range(x0, x1):
                c.P(x, y, K(P, t + (1 if y == y0 + 1 else 0) - (1 if y == y1 - 1 else 0)))
    plane(3, 12, 8, 18, hi - 1)                                                       # 트렁크
    plane(34, 46, 8, 18, hi - 1)                                                      # 보닛
    c.HL(4, 8, 7, K(P, hi)); c.HL(35, 8, 10, K(P, hi))
    c.VL(45, 9, 9, K(P, 2)); c.VL(3, 9, 9, K(P, hi))
    # 유리 고리(지붕 둘레): 뒤 유리 12..15, 앞 유리 30..34, 남쪽 옆 유리 행 14..17
    if not burnt:
        glass_broken(c, 12, 5, 4, 13, seed, 2); glass_broken(c, 30, 5, 4, 13, seed + 1, 3)
        glass_broken(c, 16, 14, 14, 4, seed + 2, 1)
    else:
        c.R(12, 5, 4, 13, K('soot', 0)); c.R(30, 5, 4, 13, K('soot', 0)); c.R(16, 14, 14, 4, K('soot', 0))
        c.VL(12, 5, 13, K('rust', 2)); c.VL(33, 5, 13, K('rust', 2)); c.HL(16, 17, 14, K('rust', 1))
    c.VL(16, 14, 4, K(P, 2)); c.VL(23, 14, 4, K(P, 2)); c.VL(29, 14, 4, K(P, 2))     # 기둥
    # 지붕(가장 밝은 판)
    plane(16, 30, 3, 14, hi)
    c.HL(17, 3, 12, K(P, min(hi + 1, 6))); c.VL(16, 4, 10, K(P, hi + 1)); c.VL(29, 4, 10, K(P, hi - 2))
    if burnt:                                                  # 그을린 지붕·보닛: 검댕 얼룩(디더) + 벗겨진 녹
        for y in range(19, 27):
            for x in range(3, 46):
                if c.get(x, y) in MAT['brust'] and field(x * 2, y * 2, 77, 64) > 0.5 and (x + y) % 2 == 0: c.P(x, y, K('soot', 3))
        c.R(19, 6, 6, 4, K('rust', 3)); c.HL(19, 6, 6, K('rust', 4)); c.P(20, 7, K('rust', 5))
    # 범퍼·등
    c.R(45, 13, 2, 12, K('metal', 2)); c.VL(46, 13, 12, K('metal', 1)); c.P(45, 18, K('paint', 2) if not burnt else K('soot', 2))
    c.R(1, 13, 2, 12, K('metal', 2)); c.VL(1, 13, 12, K('metal', 4)); c.P(2, 18, K('wine', 2) if not burnt else K('soot', 2))
    for y in range(3, 28):                                     # 칠 바램 결(밝은 점·어두운 점)
        for x in range(3, 46):
            col = c.get(x, y)
            if col in MAT[P] and h2(x, y, seed + 30) % 19 == 0: c.P(x, y, K(P, MAT[P].index(col) + (1 if (x + y) % 2 else -1)))
    # 녹: 바퀴 아치 둘레·문 아래·지붕 얼룩
    rust_patch(c, 3, 3, 44, 25, seed=seed + 11, dens=0.32 if not burnt else 0.55, mat='rust' if not burnt else 'brust',
               on=set(MAT[P]))
    c.outline()


def car_v(c, paint, seed=0):
    """남북으로 놓인 승용차(32×48), 앞이 남쪽(아래): 트렁크·지붕·보닛 윗면 + 큰 앞면(앞 유리 아래 보닛 끝 · 그릴 · 등 · 범퍼, 17행)."""
    P = paint
    c.shadow([(x, y) for y in (46, 47) for x in range(4, 29)])
    def plane(x0, x1, y0, y1, t):
        for y in range(y0, y1):
            for x in range(x0, x1):
                tt = t + (1 if x == x0 + 1 else 0) - (1 if x == x1 - 1 else 0)
                if h2(x, y, seed) % 17 == 0: tt -= 1
                c.P(x, y, K(P, tt))
    plane(5, 27, 1, 5, 4); c.HL(6, 1, 20, K(P, 5))            # 트렁크
    glass_broken(c, 6, 5, 20, 3, seed, 2)                     # 뒤 유리
    plane(5, 27, 8, 16, 5); c.HL(6, 8, 20, K(P, 6)); c.VL(5, 8, 8, K(P, 6))   # 지붕
    glass_broken(c, 6, 16, 20, 5, seed + 1, 3)                # 앞 유리
    plane(4, 28, 21, 27, 4); c.HL(5, 21, 22, K(P, 5)); c.VL(15, 22, 4, K(P, 3)); c.VL(16, 22, 4, K(P, 5)); c.HL(4, 26, 24, K(P, 6))   # 보닛 + 앞 턱 빛
    c.VL(4, 1, 26, K(P, 3)); c.VL(3, 3, 24, K(P, 2)); c.VL(27, 1, 26, K(P, 2)); c.VL(28, 3, 24, K(P, 1))
    for y in (3, 20): c.R(1, y, 3, 6, K('rubber', 2)); c.VL(1, y, 6, K('rubber', 4)); c.R(28, y, 3, 6, K('rubber', 1)); c.VL(30, y, 6, K('rubber', 0))
    # 앞면(남쪽) 17행: 보닛 앞 끝 · 그릴 · 등 · 빈 번호판 · 범퍼 · 범퍼 밑 그늘 + 앞바퀴 아래 반쪽
    for y in range(27, 44):
        for x in range(3, 29):
            t = 3 if y < 30 else 2 if y < 39 else 1
            if h2(x, y, seed + 9) % 19 == 0: t += 1
            c.P(x, y, K(P, t))
    c.HL(3, 27, 26, K(P, 4)); c.VL(3, 27, 17, K(P, 3)); c.VL(28, 27, 17, K(P, 0))
    c.R(9, 30, 14, 5, K('soot', 1)); [c.VL(x, 30, 5, K('metal', 3)) for x in range(10, 23, 2)]; c.HL(9, 30, 14, K('metal', 5)); c.HL(9, 34, 14, K('metal', 1))
    c.R(4, 30, 4, 4, K('glass', 3)); c.HL(4, 30, 4, K('glass', 5)); c.P(5, 31, K('white', 2)); c.HL(4, 33, 4, K('glass', 1))
    c.R(24, 30, 4, 4, K('soot', 0)); c.P(25, 31, K('glass', 5)); c.P(27, 32, K('glass', 4))
    c.R(12, 36, 8, 3, K('body', 4)); c.HL(12, 36, 8, K('body', 6)); c.HL(12, 38, 8, K('body', 2))
    c.R(2, 39, 28, 3, K('metal', 3)); c.HL(2, 39, 28, K('metal', 5)); c.HL(2, 41, 28, K('metal', 1)); c.P(21, 40, K('soot', 1)); c.P(22, 40, K('soot', 1))
    for wx in (3, 22): flat_tyre(c, wx, 42, 7)
    rust_patch(c, 2, 1, 28, 43, seed=seed + 5, dens=0.33, on=set(MAT[P]))
    c.outline()


@piece('car-rust-h', '녹슨 승용차 (가로)', 3, 2, 'other', en='abandoned rusted car lying east-west seen from above: roof, hood and trunk tops, broken windows, rusty side panel with flat tyres',
       tags=['차', '폐차'], desc='버려진 녹슨 승용차(동서). 깨진 유리, 바람 빠진 타이어.', solid=[(0, 1), (1, 1), (2, 1), (1, 0)])
def _car_h(c): car_h(c, 'blue', seed=2)


@piece('car-rust-v', '녹슨 승용차 (세로)', 2, 3, 'other', en='abandoned rusted car facing south seen from above: trunk, roof and hood tops with cracked glass, front grille and bumper below',
       tags=['차', '폐차'], desc='버려진 녹슨 승용차(남북, 앞이 남쪽).', solid=[(0, 1), (1, 1), (0, 2), (1, 2)])
def _car_v(c): car_v(c, 'army', seed=7)


def rust_blob(c, cx, cy, rx, ry, on, seed=0, mat='rust', hi=4):
    """녹 덩이: 모양 있는 얼룩(값 잡음으로 가장자리가 들쭉날쭉) — 속은 밝은 마른 녹, 가장자리 한 줄은 어두운 녹 테."""
    pts = set()
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            d = ((x - cx) / (rx + .5)) ** 2 + ((y - cy) / (ry + .5)) ** 2 + (h2(x, y, seed) % 5) * 0.08
            if d <= 1 and c.get(x, y) in on: pts.add((x, y))
    for (x, y) in pts:
        edge = any((x + dx, y + dy) not in pts for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        t = (hi - 2) if edge else hi - (1 if h2(x, y, seed + 3) % 4 == 0 else 0) + (1 if h2(x, y, seed + 5) % 9 == 0 else 0)
        c.P(x, y, K(mat, t))


def car_top_h(c, P, seed=0, burnt=False):
    """동서로 놓인 승용차(48×32)를 높은 3/4 로: 밝은 지붕 판(가운데 위) · 지붕을 두른 유리 고리 · 트렁크(서)·보닛(동) 윗면 ·
    남쪽 옆면은 아래 짧은 띠(6행) · 바퀴는 옆면 밑으로 삐져나온 낮은 고무 덩이만."""
    n = len(MAT[P]); TOP = n - 1
    c.shadow([(x, y) for y in (27, 28, 29) for x in range(5 + (y - 27), 46 - (y - 27))])
    # 바퀴 덩이(옆면 밑으로만 보인다)
    for wx in (7, 34):
        if not burnt:
            c.HL(wx, 25, 8, K('rubber', 2)); c.HL(wx, 26, 8, K('rubber', 1)); c.HL(wx + 1, 27, 6, K('rubber', 0)); c.P(wx, 25, K('rubber', 4))
        else:                                                   # 타 버린 타이어: 녹슨 휠 테만 주저앉음
            c.HL(wx, 25, 8, K('rust', 2)); c.HL(wx, 26, 8, K('soot', 1)); c.HL(wx + 1, 27, 6, K('soot', 0)); c.P(wx + 1, 25, K('rust', 4)); c.P(wx + 5, 26, K('soot', 4))
    # 옆면(남쪽) 띠: 행 19..25
    for y in range(19, 26):
        x0, x1 = (4, 45) if y < 25 else (5, 44)
        for x in range(x0, x1 + 1):
            t = {19: TOP - 2, 20: TOP - 3, 24: 2, 25: 1}.get(y, 3)
            if x == x0: t += 1
            if x == x1: t -= 1
            c.P(x, y, K(P, t))
    for wx in (7, 34):                                          # 바퀴 아치(옆면 아래를 파낸 어두운 반달)
        for y in range(23, 26):
            for x in range(wx, wx + 8):
                if ((x - wx - 3.5) / 4.6) ** 2 + ((y - 26) / 2.6) ** 2 <= 1: c.P(x, y, K('soot', 0))
    for x in (17, 30): c.VL(x, 20, 4, K(P, 1)); c.VL(x + 1, 20, 4, K(P, 4))           # 문 이음
    if not burnt: c.HL(21, 21, 3, K('metal', 6)); c.HL(33, 21, 2, K('metal', 6))
    # 트렁크(서)·보닛(동) 윗면: 행 8..18
    def plane(x0, x1, y0, y1, t, ridge=None):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                tt = t
                if y == y0: tt = t - 1
                if y == y1: tt = t + 1
                if x == x0 and y > y0: tt += 1
                if x == x1: tt -= 1
                c.P(x, y, K(P, tt))
        if ridge:
            for x in range(x0 + 1, x1): c.P(x, ridge, K(P, t + 1)); c.P(x, ridge + 1, K(P, t - 1))
    plane(4, 12, 9, 18, TOP - 2, ridge=None)
    plane(33, 45, 9, 18, TOP - 2)
    for x in (37, 41): c.VL(x, 10, 8, K(P, TOP - 1)); c.VL(x + 1, 10, 8, K(P, TOP - 3))     # 보닛 주름
    for y in (9, 10): c.clear(4, y); c.clear(45, y)
    c.P(5, 9, K(P, TOP - 2)); c.P(44, 9, K(P, TOP - 3))
    # 유리 고리: 뒤 유리(서) · 앞 유리(동) · 남쪽 옆 유리 — 지붕 둘레 한 덩이로 이어진다
    ring = set()
    for x in range(13, 17):
        for y in range(8 - (x - 13), 19): ring.add((x, y))
    for x in range(29, 33):
        for y in range(5 + (x - 29), 19): ring.add((x, y))
    for x in range(17, 29):
        for y in range(15, 19): ring.add((x, y))
    for (x, y) in ring:
        if burnt:
            t = 0 if y < 12 else 1 if y < 17 else 0
            c.P(x, y, K('soot', t))
        else:
            t = 2 + (1 if (x + y) % 7 == 0 else 0)
            c.P(x, y, K('glass', t))
    if burnt:                                                   # 빈 창틀 속: 타 버린 좌석 틀(용수철 줄) · 남은 유리 조각
        c.HL(17, 16, 12, K('soot', 2)); c.P(19, 17, K('rust', 1)); c.P(26, 17, K('rust', 1))                # 타 버린 좌석 뼈대 한 줄
        for (x, y) in ((14, 9), (15, 15), (30, 7), (31, 14), (20, 18), (26, 15)): c.P(x, y, K('glass', 5))
        for (x, y) in ((13, 12), (32, 12)): c.P(x, y, K('rust', 3))
    else:
        for (x, y) in ((14, 9), (15, 10), (30, 8), (31, 9), (19, 15), (20, 16), (25, 15)): c.P(x, y, K('glass', 5))
        c.P(31, 13, K('soot', 0)); c.P(31, 14, K('soot', 1))
    c.VL(23, 15, 4, K(P, 3))                                     # 가운데 기둥
    c.HL(13, 18, 20, K(P, TOP - 1))                              # 창 밑 어깨선(밝은 턱)
    # 지붕(가장 밝고 높은 판): 행 4..14 — 불탄 차는 칠이 타서 벗겨진 맨 철판이 마른 주황 녹으로 피어 가장 밝다
    RM = 'rust' if burnt else P; RT = len(MAT[RM]) - 1 - (1 if burnt else 0)
    for y in range(4, 15):
        x0, x1 = (17, 28) if y > 4 else (18, 27)
        for x in range(x0, x1 + 1):
            t = RT - 1
            if y == 4: t = RT - 2
            if y in (5, 6) and x < 25: t = RT
            if x == x0: t = RT
            if x == x1: t = RT - 3
            if y == 14: t = RT
            if burnt and h2(x, y, seed + 2) % 9 == 0: t -= 1
            c.P(x, y, K(RM, t))
    # 범퍼(동·서 끝)
    c.R(46, 11, 2, 12, K('metal', 3)); c.VL(47, 11, 12, K('metal', 1)); c.HL(46, 11, 2, K('metal', 5))
    c.R(1, 11, 2, 12, K('metal', 3)); c.VL(1, 11, 12, K('metal', 5)); c.HL(1, 22, 2, K('metal', 1))
    if burnt:
        c.P(46, 13, K('soot', 1)); c.P(46, 20, K('soot', 1)); c.P(2, 14, K('soot', 2))
        # 그을음: 모양 있는 덩이 셋(보닛 앞 절반 · 옆면 아래 · 트렁크 귀퉁이) — 가장자리 한 줄은 덜 탄 갈색, 속에 재(회) 조각
        on = set(MAT[P])
        def char(inside):
            pts = {(x, y) for y in range(8, 26) for x in range(2, 47) if c.get(x, y) in on and inside(x, y)}
            for (x, y) in pts:
                edge = any((x + dx, y + dy) not in pts and c.get(x + dx, y + dy) in on for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                t = 2 if edge else 1
                if not edge and h2(x, y, seed + 8) % 7 == 0: t = 4
                c.P(x, y, K('soot', t))
        char(lambda x, y: 9 <= y <= 18 and x >= 39 + (h2(0, y, seed) % 3) - (1 if y > 14 else 0))
        char(lambda x, y: 19 <= y <= 25 and y >= 22 + (h2(x // 2, 0, seed + 1) % 3) - (1 if 12 < x < 38 else 0))
        char(lambda x, y: 9 <= y <= 13 and x <= 6 + (h2(0, y, seed + 2) % 2))
        for x in range(18, 28): c.P(x, 10 + (1 if 21 < x < 25 else 0), K('rust', 3))     # 열에 처진 지붕(움푹한 골)
        for x in range(19, 27): c.P(x, 11 + (1 if 21 < x < 25 else 0), K('rust', 5))
        c.P(18, 5, K('rust', 6)); c.P(19, 5, K('rust', 6)); c.P(18, 6, K('rust', 6))
        for (x, y) in ((26, 7), (27, 8), (27, 9)): c.P(x, y, K('soot', 4))
        rust_blob(c, 8, 13, 3, 2, set(MAT[P]), seed + 1, 'rust', 4); rust_blob(c, 40, 14, 3, 2, set(MAT[P]), seed + 2, 'rust', 4)
    else:
        c.P(46, 13, K('paint', 2)); c.P(46, 20, K('paint', 1)); c.P(2, 13, K('wine', 2)); c.P(2, 20, K('wine', 2))
    for y in range(4, 26):                                      # 칠 바램 결
        for x in range(3, 46):
            col = c.get(x, y)
            if col in MAT[P] and h2(x, y, seed + 30) % 23 == 0: c.P(x, y, K(P, MAT[P].index(col) + (1 if (x + y) % 2 else -1)))
    if not burnt: rust_patch(c, 3, 8, 44, 18, seed=seed + 11, dens=0.30, mat='rust', on=set(MAT[P]))
    c.outline(top=False)


@piece('car-burnt', '불탄 차', 3, 2, 'other', en='burnt-out car wreck lying east-west seen from above: charred roof and hood, empty window frames, scorched rusty body on flat tyres',
       tags=['차', '폐차'], desc='불에 타 뼈대만 남은 차.', solid=[(0, 1), (1, 1), (2, 1), (1, 0)])
def _car_burnt(c): car_burnt_r5(c)


@piece('van-rust', '녹슨 승합차', 4, 2, 'other', en='abandoned rusty box van lying east-west seen from above: long flat roof top, cab windshield, side with sliding door and flat tyres',
       tags=['차', '폐차'], desc='버려진 녹슨 승합차(동서, 앞이 동쪽).', solid=[(0, 1), (1, 1), (2, 1), (3, 1), (1, 0), (2, 0)])
def _van(c): van_r5(c)


# ------------------------------------------------------------------ 물탱크·망루·발전기·태양광판
def leg(c, x, y0, y1, mat='rust', w=3):
    c.R(x, y0, w, y1 - y0, K(mat, 3)); c.VL(x, y0, y1 - y0, K(mat, 5)); c.VL(x + w - 1, y0, y1 - y0, K(mat, 1))


@piece('water-tank', '기둥 위 물탱크', 2, 3, 'structure', en='rusty cylindrical water tank on a stilt frame seen from above: elliptical top lid with hatch, banded tank body, braced legs and a ladder',
       tags=['물', '탱크'], desc='녹슨 원통 물탱크를 철 기둥 위에 올렸다. 사다리, 위 뚜껑 해치.', solid=[(0, 2), (1, 2)])
def _tank(c):
    cx = 16
    # 다리·가새(아래 받침)
    for x in (4, 25): leg(c, x, 28, 46)
    leg(c, 14, 30, 46)
    c.line(7, 31, 25, 43, K('rust', 2)); c.line(25, 31, 7, 43, K('rust', 2))
    c.R(3, 27, 26, 3, K('rust', 4)); c.HL(3, 27, 26, K('rust', 5)); c.HL(3, 29, 26, K('rust', 1))   # 받침 판 윗면+앞
    # 원통 몸(앞면: 아래 가장자리가 호)
    for x in range(cx - 13, cx + 14):
        u = (x - cx) / 13.5; dy = int(round(4 * (1 - u * u) ** .5))
        t = 3 + (1 if u < -0.5 else -1 if u > 0.5 else 0) + (1 if -0.2 < u < 0.05 else 0)
        for y in range(8, 22 + dy): c.P(x, y, K('rust', t))
        c.P(x, 22 + dy, K('rust', 0))
        for by in (13, 18): c.P(x, by + dy, K('rust', 1))                                    # 테
    rust_patch(c, 3, 8, 27, 18, seed=8, dens=0.35, mat='brust', on=set(MAT['rust']))
    # 윗면 타원(뚜껑)
    c.ell(cx, 8, 13, 5, K('metal', 4))
    c.ell(cx, 8, 11, 4, K('metal', 5))
    for x in range(cx - 12, cx + 13):
        u = (x - cx) / 13.5; dy = int(round(5 * (1 - u * u) ** .5)); c.P(x, 8 + dy, K('metal', 6)); c.P(x, 8 - dy, K('metal', 2))
    c.R(cx - 2, 6, 5, 3, K('metal', 2)); c.HL(cx - 2, 6, 5, K('metal', 6)); c.P(cx + 2, 8, K('metal', 1))   # 해치
    rust_patch(c, 3, 3, 27, 10, seed=3, dens=0.3, on=set(MAT['metal']))
    # 사다리(오른쪽 앞)
    for y in range(12, 46): c.P(27, y, K('metal', 4)); c.P(30, y, K('metal', 2))
    for y in range(13, 46, 3): c.HL(27, y, 4, K('metal', 5))
    c.outline()


@piece('watchtower', '고철 망루', 2, 4, 'structure', en='scrap scaffold watchtower seen from above: sloped corrugated tin roof with a tarp patch and rust, lit plank lookout floor with sandbag parapet, braced wooden legs, ladder and concrete footings',
       tags=['망루', '방어'], desc='고철·판자로 엮은 망루. 함석 지붕(방수포 덧댐), 판자 바닥과 모래주머니 둘레, 가새 다리, 콘크리트 받침, 사다리.', solid=[(0, 3), (1, 3)])
def _tower(c): tower_r5(c)


@piece('generator', '고철 발전기', 2, 2, 'box', en='old rusty diesel generator box seen from above: vented top with fuel cap and exhaust pipe, front control panel with dials, cables on the ground',
       tags=['발전기', '기계'], desc='녹슨 디젤 발전기. 윗면 환기구·주유구, 연통, 앞 계기판, 바닥 전선.', solid=[(0, 1), (1, 1)])
def _gen(c):
    fy = box(c, 3, 6, 26, 12, 12, 'army', tt=4, ft=2)
    for x in range(6, 18, 2): c.VL(x, 9, 6, K('army', 2)); c.VL(x + 1, 9, 6, K('army', 5))       # 환기 살
    c.ell(23, 10, 2, 1, K('metal', 5)); c.P(23, 10, K('metal', 1))                                # 주유 뚜껑
    c.R(24, 3, 4, 6, K('metal', 3)); c.VL(24, 3, 6, K('metal', 5)); c.VL(27, 3, 6, K('metal', 1))
    c.ell(25, 3, 2, 1, K('metal', 5)); c.HL(24, 2, 4, K('metal', 6)); c.P(25, 3, K('soot', 0)); c.P(26, 3, K('soot', 0))  # 짧은 배기관(타원 입구)
    c.R(6, fy + 2, 12, 7, K('soot', 2)); c.HL(6, fy + 2, 12, K('soot', 4))
    c.ell(9, fy + 5, 1, 1, K('wpaint', 1)); c.P(9, fy + 5, K('soot', 0)); c.ell(14, fy + 5, 1, 1, K('wpaint', 1)); c.P(15, fy + 4, K('brick', 4))
    c.R(21, fy + 3, 5, 4, K('paint', 1)); c.HL(21, fy + 3, 5, K('paint', 3))                        # 바랜 경고 판(글자 없음)
    rust_patch(c, 3, 6, 26, 24, seed=6, dens=0.35, on=set(MAT['army']))
    c.R(3, 30, 26, 2, K('rubber', 1)); c.HL(3, 30, 26, K('rubber', 3))                              # 받침 굽
    c.outline()
    for (x, y) in ((29, 26), (30, 27), (31, 27)): c.P(x, y, K('rubber', 1))


@piece('solar-scrap', '주워 온 태양광판', 2, 1, 'frame', en='salvaged solar panel tilted on a scrap frame: cracked blue cell grid top surface facing the sky, metal edge and short legs',
       tags=['태양광', '기계'], desc='주워 온 태양광판을 고철 틀에 비스듬히 얹었다.', solid=[(0, 0), (1, 0)])
def _solar(c):
    for y in range(0, 11):                                    # 패널 윗면(사다리꼴, 11행)
        l = (10 - y) // 3
        for x in range(1 + l, 31 - l):
            cell = ((x - 1) // 5 + (y - 1) // 3) % 2
            t = 3 + cell - (1 if (x - 1) % 5 == 0 or (y - 1) % 3 == 0 else 0)
            if (x - 1) % 5 == 1 and (y - 1) % 3 == 1: t += 1                     # 셀마다 빛 점
            if y < 4 and x < 12: t += 1                                          # 하늘 반사
            c.P(x, y, K('blue', t))
    c.HL(1, 10, 30, K('metal', 6)); c.HL(1, 11, 30, K('metal', 3)); c.HL(1, 12, 30, K('metal', 1))
    for (x, y) in ((6, 3), (7, 4), (8, 4), (9, 5)): c.P(x, y, K('glass', 6))     # 금
    c.P(21, 3, K('glass', 6)); c.P(22, 3, K('blue', 5))
    for x in (3, 27): c.R(x, 13, 2, 3, K('rust', 3)); c.P(x, 13, K('rust', 5))
    rust_patch(c, 1, 9, 30, 4, seed=8, dens=0.5, on=set(MAT['metal']))
    c.R(17, 5, 5, 3, K('soot', 2)); c.P(18, 5, K('glass', 6)); c.P(20, 6, K('blue', 4))           # 깨진 셀
    c.outline()


# ------------------------------------------------------------------ 모닥불·통나무·노점
def campfire(c, f):
    # 돌 고리(뒤 돌 → 앞 돌)
    ring = [(3, 6), (6, 4), (10, 4), (12, 7), (2, 10), (12, 11), (5, 12), (9, 12)]
    for (x, y) in ring[:4]: pebble(c, x, y, 3, 'conc', 6, 4, 2, K('soot', 2))
    c.ell(8, 9, 4, 2, K('soot', 1)); c.ell(8, 9, 3, 1, K('soot', 3))           # 재·숯 바닥
    c.line(4, 10, 12, 8, K('wood', 2)); c.line(4, 8, 12, 11, K('wood', 1))    # 장작
    c.P(5, 9, K('wood', 4)); c.P(11, 10, K('wood', 4))
    flames = [
        ['...a..', '..ab.a', '.abcba', '.bcdcb', 'abcdcb', '.bccb.'],
        ['..a...', '.ab.a.', '.bcab.', 'abcdcb', 'bcddcb', '.bccb.'],
        ['....a.', '.a.ab.', '.abcb.', 'abcdca', 'bcdddb', '.bccb.'],
    ][f]
    c.rows(5, 3, flames, {'a': K('fire', 1), 'b': K('fire', 2), 'c': K('fire', 4), 'd': K('fire', 6)})
    for (x, y) in ring[4:]: chunk5(c, x - 1, y - 1, 4, 5, 'conc', 2, seed=x)
    c.outline()
    if f == 1: c.P(9, 0, K('fire', 3))
    if f == 2: c.P(6, 1, K('fire', 3))


@piece('campfire', '모닥불', 1, 1, 'container', en='campfire: ring of stones seen from above with logs and flames burning inside', frames=3,
       tags=['불', '야영'], desc='돌로 두른 모닥불(3프레임 불꽃).', solid=[(0, 0)])
def _campfire(c, f): campfire(c, f)


@piece('log-seat', '통나무 의자', 2, 1, 'seat', en='fallen log used as a bench seen from above: long bark top surface, sawn end showing rings, lying on the ground',
       tags=['의자', '야영'], desc='걸터앉는 통나무.', solid=[])
def _log(c): log_r5(c)


def stall(c, seed, tarp, goods):
    # 기둥(뒤 둘은 지붕 밑, 앞 둘)
    for x in (2, 43): c.R(x, 10, 3, 20, K('wood', 2)); c.VL(x, 10, 20, K('wood', 4))
    # 상자 계산대(윗면 + 앞면)
    fy = box(c, 4, 18, 40, 5, 9, 'wood', tt=4, ft=2)
    for x in range(4, 44, 10): c.VL(x, fy, 9, K('wood', 0)); c.VL(x + 1, fy, 9, K('wood', 3))
    c.HL(4, fy + 4, 40, K('wood', 1))
    # 계산대 위 물건
    goods(c, fy)
    # 방수포 지붕 윗면(사다리꼴, 처진 주름, 덧댄 천, 앞 늘어진 가장자리)
    for r in range(13):
        l = int(round(3 * (1 - r / 12)))
        for x in range(l, 48 - l):
            t = 4 if r < 4 else 3 if r < 9 else 2
            fold = (x * 2 + r) % 12
            if fold == 0: t -= 1
            elif fold == 1: t += 1
            if r == 6 and x % 2 == 0: t -= 1                    # 처진 가운데 주름
            c.P(x, r + 1, K(tarp, t))
        if r in (3, 9):
            for x in range(l + 2, 48 - l - 2, 3): c.P(x, r + 1, K(tarp, 5))              # 박음질
    c.HL(3, 1, 42, K(tarp, 5)); c.HL(0, 13, 48, K(tarp, 5))
    for x in range(0, 48):                                    # 늘어진 앞 가장자리(물결)
        d = 1 + (1 if (x // 4) % 2 else 0)
        for j in range(d): c.P(x, 14 + j, K(tarp, 2 if j == 0 else 1))
    rust_patch(c, 0, 1, 48, 15, seed=seed, dens=0.18, mat='brust', on=set(MAT[tarp]))
    c.R(30, 4, 8, 5, K('army' if tarp != 'army' else 'tarp', 3)); c.HL(30, 4, 8, K('army' if tarp != 'army' else 'tarp', 5))
    c.outline()


def stall_tarp(c, seed=9, tarp='blue'):
    """기운 방수포 지붕 노점: 지붕은 위에서 본 판(살 사이로 처진 골 · 빛·그늘 6단 · 덧댄 천 · 밧줄), 계산대 윗면 밝게 + 물건, 앞면 판자."""
    c.shadow([(x, 31) for x in range(3, 46)])
    for x in (1, 45): c.R(x, 12, 2, 19, K('wood', 2)); c.VL(x, 12, 19, K('wood', 4))     # 앞 기둥
    fy = box(c, 3, 16, 42, 6, 9, 'wood', tt=4, ft=2)
    for x in range(3, 45, 7): c.VL(x, fy, 9, K('wood', 0)); c.VL(x + 1, fy, 9, K('wood', 3))
    c.HL(3, fy + 4, 42, K('wood', 1)); c.HL(3, fy + 5, 42, K('wood', 3))
    for x in (8, 22, 36): c.P(x, fy + 2, K('metal', 6)); c.P(x, fy + 6, K('metal', 6))
    c.HL(3, 16, 42, K('wood', 2))                                                       # 처마 그늘
    # 계산대 위 물건: 고철 부품 더미 · 통조림 줄 · 병 · 감은 전선 · 녹슨 통
    c.R(5, 17, 9, 4, K('metal', 3)); c.HL(5, 17, 9, K('metal', 5)); c.HL(5, 20, 9, K('metal', 1))
    for (x, y) in ((6, 18), (9, 18), (12, 19)): c.P(x, y, K('metal', 7)); c.P(x + 1, y + 1, K('rust', 4))
    c.line(6, 19, 12, 17, K('rust', 3))
    for k, x in enumerate(range(16, 27, 3)):
        c.R(x, 18, 2, 3, K('metal', 3 + k % 2)); c.HL(x, 17, 2, K('metal', 6)); c.P(x, 20, K('metal', 1)); c.P(x + 1, 19, K('paint', 1) if k % 2 else K('brick', 3))
    for x in (29, 31):
        c.R(x, 15, 1, 6, K('glass', 3)); c.P(x, 14, K('glass', 1)); c.P(x, 16, K('glass', 6)); c.P(x, 20, K('glass', 1))
    c.ell(35, 19, 2, 1, K('rubber', 3)); c.P(35, 19, K('rubber', 0)); c.HL(34, 18, 3, K('rubber', 5))
    c.R(39, 15, 5, 6, K('rust', 3)); c.HL(39, 15, 5, K('rust', 5)); c.P(40, 15, K('rust', 6)); c.HL(39, 20, 5, K('rust', 1)); c.VL(43, 16, 4, K('rust', 2))
    # 지붕(행 0..13): 살(동서 4곳)이 받친 마루, 그 사이로 처진 골 — 왼쪽 비탈은 빛, 오른쪽 비탈은 그늘
    ribs = (0, 12, 24, 36, 47)
    for r in range(13):
        l = int(round(4 * (1 - r / 12)))
        for x in range(l, 48 - l):
            b0 = max(b for b in ribs if b <= x); b1 = min([b for b in ribs if b > x] or [48]); u = (x - b0) / max(1, b1 - b0)
            t = 6 if u < 0.1 else 5 if u < 0.3 else 4 if u < 0.5 else 3 if u < 0.75 else 2 if u < 0.92 else 4
            if r < 3: t -= 1
            if r < 1: t -= 1
            if r >= 9: t = min(6, t + 1)
            if h2(x, r, seed) % 19 == 0: t -= 1
            c.P(x, r, K(tarp, t))
    for b in ribs[1:-1]:
        for r in range(1, 13): c.P(b, r, K('wood', 4 if r % 3 else 3))
    # 덧댄 천 둘(군청 녹색 · 마대) + 박음질
    for (px, py, pw, ph, m) in ((5, 2, 9, 6, 'army'), (31, 5, 8, 5, 'burlap')):
        for j in range(ph):
            for i in range(pw):
                t = (4 if m == 'army' else 4) + (1 if i < pw // 3 else -1 if i > 2 * pw // 3 else 0)
                c.P(px + i, py + j, K(m, t))
        c.HL(px, py + ph, pw, K(tarp, 1))
        for i in range(0, pw, 2): c.P(px + i, py, K(m, 2)); c.P(px + i + 1, py + ph - 1, K(m, 2))
        c.VL(px, py, ph, K(m, 6 if m == 'army' else 5))
    # 앞 처마(밝은 턱) + 늘어진 물결 가장자리 + 모서리 밧줄
    c.HL(0, 13, 48, K(tarp, 6))
    for x in range(0, 48):
        d = 1 + (1 if (x // 4) % 3 == 1 else 0)
        for j in range(d): c.P(x, 14 + j, K(tarp, 3 if j == 0 else 1))
    for (x, y) in ((0, 14), (1, 15), (47, 14), (46, 15)): c.P(x, y, K('dry', 3))
    for (x, y) in ((18, 7), (19, 8), (42, 3)): c.P(x, y, K('soot', 4))                   # 얼룩
    c.outline(top=False)


def goods_a(c, fy):
    for k, x in enumerate(range(6, 40, 6)):                   # 통조림 줄(윗면 타원 점) + 병
        c.R(x, fy - 4, 4, 4, K('metal', 3 + k % 2)); c.HL(x, fy - 4, 4, K('metal', 6)); c.HL(x, fy - 1, 4, K('metal', 1))
        c.P(x + 1, fy - 2, K('brick', 3) if k % 2 else K('paint', 1))
    c.R(38, fy - 7, 2, 7, K('glass', 3)); c.P(38, fy - 7, K('glass', 6))


def goods_b(c, fy):
    c.R(6, fy - 5, 12, 5, K('rubber', 2)); c.HL(6, fy - 5, 12, K('rubber', 4))    # 고철 부품 더미
    for x in (7, 10, 14): c.P(x, fy - 4, K('metal', 6)); c.P(x + 1, fy - 3, K('rust', 4))
    c.R(22, fy - 4, 8, 4, K('army', 3)); c.HL(22, fy - 4, 8, K('army', 5))         # 접은 천
    c.R(33, fy - 6, 7, 6, K('rust', 3)); c.HL(33, fy - 6, 7, K('rust', 5)); c.P(36, fy - 4, K('rust', 1))   # 녹슨 통


@piece('stall-a', '고물 노점 A', 3, 2, 'structure', style='prop', en='market stall of scavenged goods: patched tarp roof seen from above on poles, crate counter with tins and bottles',
       tags=['노점', '시장'], desc='방수포 지붕 아래 상자 계산대에 통조림·병을 늘어놓은 노점.', solid=[(0, 1), (1, 1), (2, 1)])
def _stall_a(c): stall(c, 4, 'tarp', goods_a)


@piece('stall-b', '고물 노점 B', 3, 2, 'structure', style='prop', en='market stall of scavenged goods: sagging patched blue tarp roof seen from above on poles and battens, lit plank counter top with scrap parts, tins, bottles, a wire coil and a rusty can',
       tags=['노점', '시장'], desc='기운 파란 방수포를 덮은 노점. 고철 부품·통조림·병·전선·녹슨 통.', solid=[(0, 1), (1, 1), (2, 1)])
def _stall_b(c): stall_r5(c)


# ------------------------------------------------------------------ 드럼통·타이어·상자·더미
def drum(c, cx, ytop, rx=5, ry=2, bh=9, mat='rust', seed=0):
    for x in range(cx - rx, cx + rx + 1):
        u = (x - cx) / (rx + .5); dy = int(round(ry * (1 - u * u) ** .5))
        t = 3 + (1 if u < -0.4 else -1 if u > 0.45 else 0) + (1 if -0.25 < u < -0.05 else 0)
        for y in range(ytop, ytop + bh + dy + 1): c.P(x, y, K(mat, t))
        for b in (bh // 3, 2 * bh // 3): c.P(x, ytop + b + dy, K(mat, 1))
        c.P(x, ytop + bh + dy, K(mat, 0))
    rust_patch(c, cx - rx, ytop, 2 * rx + 1, bh + ry + 1, seed=seed, dens=0.4, mat='brust', on=set(MAT[mat]))
    c.ell(cx, ytop, rx, ry, K(mat, 4))
    c.ell(cx, ytop, rx - 1, ry - 1, K(mat, 5)) if ry > 1 else None
    c.ell(cx - 1, ytop - 1, max(1, rx - 3), max(0, ry - 2), K(mat, 6)) if ry > 2 else None
    for x in range(cx - rx, cx + rx + 1):
        u = (x - cx) / (rx + .5); dy = int(round(ry * (1 - u * u) ** .5)); c.P(x, ytop + dy, K(mat, 6)); c.P(x, ytop - dy, K(mat, 2))
    c.P(cx + 2, ytop, K(mat, 1))


@piece('drums', '녹슨 드럼통', 1, 1, 'round_body', en='two rusty oil drums seen from above: elliptical lids with bung caps, banded rusty bodies',
       tags=['드럼통'], desc='녹슨 기름 드럼통 둘.', solid=[(0, 0)])
def _drums(c):
    drum(c, 5, 4, 5, 3, 7, 'rust', 1)
    drum(c, 11, 7, 4, 3, 5, 'army', 2)
    c.outline()


@piece('tyres', '쌓인 타이어', 1, 1, 'round_body', en='stack of three old worn tyres seen from above: top tyre as an elliptical grey rubber ring with rainwater in its hole, offset tread bands of the lower tyres below',
       tags=['타이어'], desc='헌 타이어 더미.', solid=[(0, 0)])
def _tyres(c):
    c.shadow([(x, y) for y in (14, 15) for x in range(3 + (y - 14), 16 - (y - 14))])
    def band(cx, cy, rx, ry, h):
        # 옆 띠(접지면): 위 반 타원 밑으로 h 행 — 블록 무늬(2칸마다 밝음/어두움) · 왼쪽 빛 · 오른쪽 그늘 · 맨 아래 어두운 틈
        for x in range(cx - rx, cx + rx + 1):
            u = (x - cx) / (rx + .5); ye = int(round(cy + ry * (1 - u * u) ** .5))
            for j in range(h + 1):
                t = 4 if (x // 2) % 2 == 0 else 3
                if j == 0: t = 5 if u < 0.2 else 4
                if u < -0.6: t += 1
                if u > 0.6: t -= 1
                if j == h: t = 1
                c.P(x, ye + j, K('rubber', min(6, t)))
    band(9, 9, 6, 2, 3)                      # 맨 아래 타이어(오른쪽으로 비켜)
    band(7, 7, 6, 2, 3)                      # 가운데(왼쪽으로 비켜)
    cx, cy, rx, ry = 8, 5, 7, 4              # 맨 위: 누운 타이어 고리(옆벽 윗면, 먼지 앉은 회색 고무)
    band(cx, cy - 1, rx, ry, 2)
    c.ell(cx, cy, rx, ry, K('rubber', 4))
    c.ell(cx, cy, rx - 1, ry - 1, K('rubber', 5))
    for x in range(cx - rx + 1, cx + rx):
        u = (x - cx) / (rx + .5); dy = (1 - u * u) ** .5
        if u < 0.35: c.P(x, int(round(cy - (ry - 0.5) * dy)), K('rubber', 6))
        if u < -0.1: c.P(x, int(round(cy - (ry - 1.4) * dy)), K('conc', 4) if x % 3 == 0 else K('rubber', 6))
        if abs(u) < 0.85 and x % 2: c.P(x, int(round(cy + (ry - 0.5) * dy)), K('rubber', 3))     # 앞 테 홈
    c.ell(cx, cy, 3, 1, K('rubber', 1))                                  # 구멍
    c.HL(cx - 3, cy - 1, 7, K('rubber', 3))                              # 먼 안쪽 벽(남향, 조금 밝다)
    c.HL(cx - 2, cy, 5, K('oil', 1)); c.HL(cx - 2, cy + 1, 5, K('oil', 2)); c.HL(cx - 2, cy, 2, K('oil', 3)); c.P(cx + 2, cy + 1, K('oil', 3))   # 고인 빗물
    for (x, y, t) in ((cx + 3, cy - 1, 2), (cx + 4, cy - 2, 4), (cx + 3, cy - 2, 3)): c.P(x, y, K('plant', t))      # 구멍 가에서 자란 풀 한 포기
    c.outline(top=False)


def tyre_stack(c, x, y, n=2, r=6):
    cx = x + r
    for k in range(n):
        by = y + 3 + (n - k) * 4
        for i in range(2 * r + 1):
            u = (i - r) / (r + .5); t = 3 + (1 if u < -0.4 else -1 if u > 0.4 else 0)
            for j in range(4): c.P(x + i, by - 1 + j, K('rubber', t - (1 if j == 3 else 0) + (1 if j == 0 else 0)))
            if i % 3 == 0: c.P(x + i, by + 1, K('rubber', t - 2))                 # 접지면 홈
        c.HL(x, by + 2, 2 * r + 1, K('rubber', 0))
    c.ell(cx, y + 3, r, 3, K('rubber', 3))
    c.ell(cx, y + 3, r - 1, 2, K('rubber', 4))
    c.ell(cx, y + 3, r - 3, 1, K('rubber', 0))
    c.HL(cx - r + 2, y, 2 * r - 3, K('rubber', 5))


@piece('crates', '고물 상자', 2, 1, 'box', en='two weathered wooden salvage crates seen from above: light plank lids with nails and a crowbar, darker slatted fronts with corner battens',
       tags=['상자'], desc='판자 상자 무리.', solid=[(0, 0), (1, 0)])
def _crates(c):
    c.shadow([(x, 15) for x in range(2, 32)])
    def crate(x, w, m, lid, front, seed):
        y = 1; top = 6; fr = 8
        # 뚜껑(윗면 6행, 앞면보다 2단 이상 밝다): 남북으로 놓은 판 · 가는 이음 · 네 귀 못 · 앞 턱 가장 밝게 · 뒤 모서리 한 단 어둡게
        for j in range(top):
            for i in range(w):
                t = lid
                if i % 5 == 4: t = lid - 1
                if j == 0: t = lid - 1
                if j == top - 1: t = lid + 1
                if i == 0 and 0 < j < top - 1: t = lid + 1
                if h2(x + i, j, seed) % 13 == 0 and 0 < j < top - 1: t = lid - 1
                c.P(x + i, y + j, K(m, t))
        for (i, j) in ((1, 1), (w - 2, 1), (1, top - 2), (w - 2, top - 2)): c.P(x + i, y + j, K(m, lid - 2))
        # 앞면(8행): 가로 판 둘(위 빛 줄) · 판 틈 · 모서리 덧댄 각목 · 바닥 그늘
        fy = y + top
        for j in range(fr):
            for i in range(w):
                t = {0: front - 1, 1: front + 1, 4: front + 1, 3: front - 1, 7: front - 2}.get(j, front)
                if h2(x + i, fy + j, seed + 1) % 9 == 0 and j in (2, 5, 6): t -= 1
                c.P(x + i, fy + j, K(m, t))
        for xx in (x, x + w - 2):
            c.R(xx, fy, 2, fr - 1, K(m, front + 1)); c.VL(xx + 1, fy, fr - 1, K(m, front))
            c.P(xx, fy + 2, K('metal', 5)); c.P(xx, fy + 5, K('metal', 5))
    crate(1, 16, 'wood', 4, 2, 3)
    crate(18, 13, 'army', 5, 2, 5)
    # 그을린 모서리 · 녹물 자국 · 쪼개진 판(글자 없음)
    for (x, y) in ((4, 12), (5, 12), (5, 13), (4, 13)): c.P(x, y, K('soot', 2))
    c.P(12, 9, K('wood', 0)); c.P(13, 9, K('wood', 0)); c.P(14, 10, K('wood', 0))
    for y in range(8, 12): c.P(28, y, K('rust', 2 if y % 2 else 3))
    c.line(4, 4, 11, 2, K('metal', 6)); c.line(5, 5, 12, 3, K('metal', 2)); c.P(12, 2, K('metal', 7)); c.P(4, 5, K('metal', 3))    # 뚜껑 위 쇠지렛대
    c.outline(top=False)


@piece('scrap-heap', '고철 더미', 3, 2, 'debris', en='heap of scrap metal junk: bent corrugated sheets, pipes, a tyre, a rusty wheel rim and car parts piled on the ground',
       tags=['고철', '잔해'], desc='휜 함석·파이프·타이어·차 부품을 쌓은 고철 더미.', solid=[(0, 1), (1, 1), (2, 1), (1, 0)])
def _scrap(c):
    # 언덕 몸(어두운 녹·쇠)
    for y in range(8, 30):
        for x in range(2, 46):
            if ((x - 24) / 22.5) ** 2 + ((y - 30) / 21.5) ** 2 <= 1:
                v = field(x * 2, y * 2, 4, 64)
                c.P(x, y, K('brust', 2 + int(v * 3.5)))
    # 쌓인 판·파이프(뒤 → 앞)
    pieces = [((8, 14, 14, 4), 'metal'), ((26, 11, 12, 5), 'rust'), ((16, 19, 16, 4), 'blue'), ((30, 20, 11, 4), 'metal'), ((5, 23, 12, 4), 'rust')]
    for (x, y, w, h), m in pieces:
        corrugated(c, x, y + 1, w, h - 1, m, base=4, pitch=3, seed=x)
        c.HL(x, y, w, K(m, 6)); c.HL(x, y + h, w, K(m, 1))
    c.line(10, 12, 30, 7, K('metal', 5)); c.line(10, 13, 30, 8, K('metal', 2))                      # 파이프
    c.line(28, 16, 42, 13, K('rust', 4)); c.line(28, 17, 42, 14, K('rust', 1))
    tyre_stack(c, 33, 22, 1, 5)
    c.ell(18, 27, 4, 2, K('metal', 4)); c.ell(18, 27, 2, 1, K('soot', 0)); c.HL(15, 25, 6, K('metal', 6))   # 휠 테
    for (x, y) in ((22, 9), (38, 18), (12, 26), (40, 26)): c.P(x, y, K('glass', 5))
    rust_patch(c, 2, 8, 44, 22, seed=7, dens=0.25, on=set(MAT['metal']) | set(MAT['blue']))
    c.outline()


@piece('rubble-pile', '잔해 더미', 2, 2, 'debris', en='pile of broken concrete and brick rubble with rebar sticking out, lying on the ground',
       tags=['잔해'], desc='콘크리트·벽돌 잔해 더미, 철근이 솟는다.', solid=[(0, 1), (1, 1)])
def _rubble_pile(c):
    mound(c, 16, 29, 14, 16, seed=21, dens=1.3)
    mound(c, 10, 30, 7, 5, seed=22)
    rebar(c, 12, 14, 5, 2); rebar(c, 21, 17, 4, -1); rebar(c, 18, 12, 3, 1)
    c.outline()


# ------------------------------------------------------------------ 식물
@piece('dead-tree', '죽은 나무', 2, 3, 'organic', en='dead leafless tree with gnarled bare branches and a thick trunk with exposed roots',
       tags=['나무', '식물'], desc='잎 없는 죽은 나무.', solid=[(0, 2), (1, 2)])
def _dead_tree(c):
    c.shadow([(x, y) for y in (44, 45) for x in range(9, 24)])
    # 줄기(굵게, 왼쪽 빛) + 뿌리
    for y in range(18, 45):
        w = 5 + (y - 18) // 9
        x0 = 14 - w // 2 + (1 if y < 30 else 0)
        for i in range(w):
            t = 4 if i == 0 else 3 if i < w // 2 else 2 if i < w - 1 else 1
            if (y + i * 3) % 7 == 0: t -= 1
            c.P(x0 + i, y, K('wood', t))
    for y in range(18, 45, 3):                                # 껍질 골·옹이
        for x in range(9, 20):
            if c.get(x, y) in MAT['wood'] and h2(x, y, 4) % 3 == 0: c.P(x, y, K('wood', 1))
    c.P(13, 30, K('wood', 0)); c.P(14, 30, K('wood', 1)); c.P(13, 29, K('wood', 4))
    for (pts, t) in ((((10, 44), (6, 46)), 2), (((18, 44), (23, 46)), 1), (((13, 45), (12, 47)), 2)):
        c.line(*pts[0], *pts[1], K('wood', t)); c.line(pts[0][0], pts[0][1] - 1, pts[1][0], pts[1][1] - 1, K('wood', t + 1))
    # 가지(두 화소 굵기 → 끝 한 화소)
    branches = [((14, 20), (6, 9), (2, 6)), ((15, 19), (22, 8), (27, 4)), ((14, 14), (13, 4), (15, 0)), ((16, 24), (25, 17), (30, 16)),
                ((13, 24), (5, 19), (1, 18)), ((6, 9), (8, 3)), ((22, 8), (19, 2)), ((25, 17), (27, 12))]
    for br in branches:
        for k, (a, b) in enumerate(zip(br, br[1:])):
            c.line(a[0], a[1], b[0], b[1], K('wood', 2))
            if k == 0: c.line(a[0] + 1, a[1], b[0] + 1, b[1], K('wood', 3)); c.line(a[0], a[1] - 1, b[0], b[1] - 1, K('wood', 4))
    for (x, y) in ((4, 8), (9, 4), (24, 6), (28, 15), (3, 18), (16, 2)):                 # 매달린 마른 잎·덩굴
        c.P(x, y, K('dry', 3)); c.P(x + 1, y + 1, K('dry', 2)); c.P(x, y + 1, K('dry', 4))
    for y in range(26, 44, 2): c.P(10 + (y // 4) % 2, y, K('plant', 3)); c.P(9, y + 1, K('plant', 5))   # 줄기 감은 덩굴
    c.outline()


@piece('bush-wild', '야생 덤불', 2, 2, 'organic', en='overgrown wild shrub: dense leafy bush clumps in several greens with a few dry twigs',
       tags=['덤불', '식물'], desc='제멋대로 자란 덤불.', solid=[(0, 1), (1, 1)])
def _bush(c):
    c.shadow([(x, y) for y in (29, 30) for x in range(4, 29)])
    clumps = [(10, 12, 8, 7), (21, 11, 8, 7), (16, 7, 7, 6), (7, 20, 7, 7), (16, 19, 9, 8), (25, 21, 6, 6)]
    for (cx, cy, rx, ry) in clumps:
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                d = ((x - cx) / (rx + .5)) ** 2 + ((y - cy) / (ry + .5)) ** 2
                if d > 1: continue
                li = -(x - cx) / (rx + .5) * 0.5 - (y - cy) / (ry + .5) * 0.7
                t = 4 + (1 if li > 0.25 else 0) + (1 if li > 0.6 else 0) - (1 if li < -0.3 else 0) - (1 if d > 0.75 and li < 0 else 0)
                n = hsh(x, y, 5) % 9
                if n == 0: t -= 1
                elif n == 1: t += 1
                c.P(x, y, K('plant', t))
    for (x, y) in ((6, 9), (12, 4), (24, 6), (28, 14), (13, 15), (20, 23)):        # 잎 덩이 빛 점
        c.P(x, y, K('plant', 7)); c.P(x + 1, y, K('plant', 6))
    c.line(27, 6, 30, 2, K('wood', 2)); c.line(5, 14, 2, 10, K('wood', 2)); c.P(30, 2, K('wood', 4))
    c.outline()


@piece('vine-wall', '덩굴 덮인 벽 그루터기', 1, 2, 'structure', en='short broken concrete wall stub overgrown with climbing vines: wall top seen from above, vine-covered front face',
       tags=['덩굴', '벽', '폐허'], desc='덩굴이 타고 오른 벽 그루터기.', solid=[(0, 1)])
def _vine_wall(c):
    conc_top(c, 1, 6, 14, 7, seed=33)
    conc_face(c, 1, 13, 14, 17, seed=34, base=3)
    for x in range(1, 15):                                    # 부서진 윗변(오른쪽 낮게)
        if x > 10:
            for y in range(6, 6 + (x - 10)): c.clear(x, y)
            c.P(x, 6 + (x - 10), K('conc', 6))
    # 덩굴: 아래에서 위로 덮인 잎 덩이(앞면 대부분 + 윗면 가장자리 넘침)
    for y in range(8, 31):
        for x in range(0, 16):
            if not c.has(x, y): continue
            v = field(x * 2, y, 51, 32) + (y - 8) / 40
            if v > 0.78 or (y > 24 and v > 0.6):
                li = 1 if (x + y) % 5 == 0 else 0
                t = 3 + (1 if v > 0.8 else 0) + li - (1 if hsh(x, y, 2) % 6 == 0 else 0)
                c.P(x, y, K('plant', t))
    for (x, y) in ((3, 16), (9, 20), (5, 25), (12, 27), (2, 11)): c.P(x, y, K('plant', 7)); c.P(x, y + 1, K('plant', 5))
    c.HL(1, 30, 14, K('plant', 1))
    c.outline()


# ------------------------------------------------------------------ 가로등·방벽·표지판
@piece('lamp-broken', '휜 가로등', 1, 2, 'column', en='bent broken street lamp: round concrete base plate seen from above, rusty pole bent over to the side, with a wide oval lamp hood plate hanging at the end',
       tags=['가로등', '폐허'], desc='휘어 부러진 옛 가로등.', solid=[(0, 1)])
def _lamp(c):
    c.shadow([(x, y) for y in (30, 31) for x in range(2 + (y - 30), 12)])
    # 콘크리트 받침(타원 윗면 + 짧은 앞면)
    c.R(1, 27, 10, 3, K('conc', 3)); c.VL(1, 27, 3, K('conc', 4)); c.VL(10, 27, 3, K('conc', 2)); c.HL(2, 29, 8, K('conc', 1))
    c.ell(5.5, 27, 4.5, 2, K('conc', 4)); c.ell(5.5, 27, 3.5, 1, K('conc', 5)); c.HL(3, 26, 4, K('conc', 6)); c.P(2, 27, K('conc', 6))
    c.P(8, 28, K('conc', 2)); c.P(9, 27, K('conc', 3))
    for (x, y) in ((11, 28), (12, 29)): c.P(x, y, K('glass', 5))                        # 떨어진 유리 조각
    c.P(13, 28, K('glass', 3))
    # 기둥 밑 고리
    c.ell(5, 25, 2, 1, K('metal', 4)); c.HL(4, 24, 3, K('metal', 6)); c.HL(4, 26, 3, K('metal', 2))
    # 기둥(3폭: 빛·몸·그늘) 행 6..24, 가운데쯤 한 번 휘어 1칸 왼쪽으로 기운다
    for y in range(6, 25):
        x = 4 if y >= 15 else 3
        c.P(x, y, K('metal', 6)); c.P(x + 1, y, K('metal', 4)); c.P(x + 2, y, K('metal', 2))
    c.P(6, 15, K('metal', 2)); c.P(3, 14, None)
    for (y, h) in ((11, 2), (19, 3)):
        for j in range(h):
            x = 4 if y + j >= 15 else 3
            c.P(x, y + j, K('rust', 5)); c.P(x + 1, y + j, K('rust', 3)); c.P(x + 2, y + j, K('rust', 1))
    c.P(4, 17, K('metal', 7)); c.P(3, 8, K('metal', 7))
    # 꺾인 팔: 위에서 오른쪽으로 둥글게 넘어가 앞으로 숙인다(두 화소: 위 빛 · 아래 그늘)
    arm = [(3, 5), (4, 4), (5, 3), (6, 2), (7, 2), (8, 2), (9, 2), (10, 3), (11, 4), (12, 5)]
    for (x, y) in arm: c.P(x, y, K('metal', 6 if x < 9 else 5)); c.P(x, y + 1, K('metal', 2))
    c.P(5, 4, K('metal', 3)); c.P(6, 1, K('metal', 7)); c.P(7, 1, K('metal', 5))
    # 등갓: 위에서 보이는 넓은 타원 판(밝은 윗면 · 앞 테) + 아래 어두운 속 · 깨진 유리
    c.ell(11.5, 8, 4, 2, K('metal', 4))
    c.ell(11.5, 7, 3, 1, K('metal', 5)); c.HL(9, 6, 5, K('metal', 6)); c.P(10, 6, K('metal', 7)); c.P(8, 7, K('metal', 6))
    c.HL(8, 10, 8, K('metal', 1)); c.P(15, 9, K('metal', 2))
    c.P(10, 11, K('glass', 3)); c.P(11, 11, K('glass', 6)); c.P(12, 11, K('glass', 2)); c.P(11, 12, K('glass', 4))
    c.P(14, 11, K('rubber', 1)); c.P(14, 12, K('rubber', 1)); c.P(15, 13, K('rubber', 2)); c.P(15, 14, K('rubber', 1))   # 늘어진 전선
    rust_patch(c, 8, 6, 8, 4, seed=12, dens=0.3, on=set(MAT['metal']))
    c.outline(top=False)


@piece('jersey-barrier', '콘크리트 방벽', 2, 1, 'box', en='concrete jersey road barrier block lying east-west: narrow top ridge seen from above, sloped front face, chipped and stained',
       tags=['방벽', '도로'], desc='도로용 콘크리트 방벽 토막.', solid=[(0, 0), (1, 0)])
def _jersey(c):
    conc_top(c, 2, 1, 28, 5, seed=41, base=5)
    for y in range(6, 15):                                     # 앞면(위 좁은 경사 → 아래 넓은 굽)
        for x in range(2, 30):
            t = 4 if y < 9 else 3 if y < 12 else 2
            c.P(x, y, K('conc', t))
    c.HL(2, 6, 28, K('conc', 6)); c.HL(2, 9, 28, K('conc', 5)); c.HL(2, 14, 28, K('conc', 1))
    for x in range(4, 30, 7): c.P(x, 11, K('soot', 3)); c.P(x + 1, 11, K('soot', 4))         # 연결 고리 자국
    c.HL(10, 7, 6, K('paint', 1)); c.HL(11, 8, 4, K('paint', 0))                                # 바랜 줄
    for (x, y) in ((24, 1), (25, 1), (25, 2), (26, 1)): c.clear(x, y)                           # 깨진 모서리
    c.P(24, 2, K('conc', 6)); c.P(26, 2, K('conc', 6))
    c.outline()


@piece('sign-blank', '녹슨 빈 표지판', 1, 2, 'other', en='rusty blank sign board on a thick post: board top edge seen from above, weathered blank face, no text',
       tags=['표지판'], desc='글자가 지워진 녹슨 표지판.', solid=[(0, 1)])
def _sign(c):
    c.ell(8, 28, 3, 1, K('conc', 4)); c.HL(6, 29, 5, K('conc', 2))
    c.R(7, 12, 3, 17, K('metal', 3)); c.VL(7, 12, 17, K('metal', 5)); c.VL(9, 12, 17, K('metal', 1))
    fy = box(c, 1, 1, 14, 6, 9, 'metal', tt=6, ft=3)          # 두꺼운 판: 윗면 6행(밝게) + 앞면 9행
    for x in range(2, 14, 3): c.P(x, 3, K('metal', 5)); c.P(x + 1, 4, K('metal', 7))
    for y in range(fy + 1, fy + 8):
        for x in range(2, 14):
            if (x + y) % 5 == 0: c.P(x, y, K('metal', 2))
    rust_patch(c, 1, fy, 14, 9, seed=17, dens=0.55, on=set(MAT['metal']))
    c.P(3, fy + 1, K('soot', 1)); c.P(12, fy + 7, K('soot', 1))                                 # 총탄 구멍
    c.outline()


# ================================================================== r5 다시 그리기(불탄 차·승합차·망루·통나무·노점 B)
WARM_OL, COOL_OL = S['bark'][0], S['slate'][0]


def ol_soft(c, top=False):
    """윤곽: 검정에 가까운 단(잉크·도로 남색)을 쓰지 않는다 — 맞닿은 화소가 따뜻하면 껍질 가장 어두운 단, 차가우면 청회 가장 어두운 단."""
    m = c.a[..., 3] == 255; out = []
    for y in range(c.h):
        for x in range(c.w):
            if m[y, x]: continue
            if not top and y + 1 < c.h and m[y + 1, x]: continue
            for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < c.w and 0 <= yy < c.h and m[yy, xx]:
                    r, g, b = (int(v) for v in c.a[yy, xx, :3])
                    out.append((x, y, WARM_OL if r > b + 8 else COOL_OL)); break
    for x, y, col in out: c.P(x, y, col)


def bloom(c, cx, cy, r, on, seed=0, sy=0.7, drip=0):
    """녹 꽃: 값 잡음으로 들쭉날쭉한 덩이(크기 제각각) — 가장자리 어두운 녹 테, 속은 마른 녹 3단 + 패인 점, 아래로 흘러내린 녹물 drip 줄."""
    pts = set()
    for y in range(int(cy - r * sy) - 2, int(cy + r * sy) + 3):
        for x in range(int(cx - r) - 2, int(cx + r) + 3):
            d = ((x - cx) / (r + .5)) ** 2 + ((y - cy) / (r * sy + .5)) ** 2
            d += (field(x * 3, y * 3, seed + 40, 64) - 0.5) * 0.9
            if d <= 1 and c.get(x, y) in on: pts.add((x, y))
    for (x, y) in pts:
        edge = any((x + dx, y + dy) not in pts for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if edge: t = 3 if h2(x, y, seed) % 3 else 4
        else:
            v = field(x * 4, y * 4, seed + 7, 64)
            t = 4 if v < 0.45 else 5 if v < 0.8 else 6
            if h2(x, y, seed + 2) % 9 == 0: t = 2                     # 패인 점
        c.P(x, y, K('rust', t))
    for k in range(drip):
        xs = [x for (x, y) in pts]
        if not xs: break
        x = min(xs) + h2(k, 1, seed) % max(1, max(xs) - min(xs) + 1)
        ys = [y for (xx, y) in pts if xx == x]
        if not ys: continue
        y0 = max(ys) + 1; ln = 2 + h2(k, 2, seed) % 4
        for j in range(ln):
            if c.get(x, y0 + j) in on: c.P(x, y0 + j, K('rust', 4 if j < ln - 1 else 5))


# ------------------------------------------------------------------ 불탄 차
def car_burnt_r5(c):
    on_b = set(MAT['brust'])
    # 녹아 주저앉은 타이어(납작한 고무 + 녹슨 휠 테) — 어두운 회 3단
    for wx in (7, 34):
        c.HL(wx + 1, 24, 6, K('metal', 3)); c.P(wx + 2, 24, K('metal', 5))
        c.HL(wx, 25, 8, K('rubber', 4)); c.P(wx, 25, K('rubber', 5)); c.P(wx + 1, 25, K('rubber', 5))
        c.HL(wx - 1, 26, 10, K('rubber', 3)); c.HL(wx, 27, 8, K('rubber', 2))
        c.P(wx + 4, 25, K('rust', 3)); c.P(wx - 1, 27, K('rubber', 2)); c.P(wx + 8, 27, K('rubber', 2))
    # 옆면(남쪽) 띠 19..24: 탄 갈색 + 아래로 짙어지는 그을음, 문 이음, 창 아래로 흘러내린 검댕 줄
    for y in range(19, 25):
        x0, x1 = (4, 45) if y < 24 else (5, 44)
        for x in range(x0, x1 + 1):
            t = {19: 5, 20: 4, 21: 3, 22: 3, 23: 2, 24: 1}[y]
            if x == x0: t += 1
            if x == x1: t -= 1
            if y >= 22 and field(x * 2, y * 3, 81, 64) > 0.55: c.P(x, y, K('soot', 3 if y == 24 else 4)); continue
            c.P(x, y, K('brust', t))
    for (x, ln) in ((14, 3), (20, 4), (26, 2), (31, 3), (39, 2), (10, 2)):
        for j in range(ln): c.P(x, 20 + j, K('soot', 4 if j < ln - 1 else 5))
    for wx in (7, 34):                                          # 바퀴 아치(얕은 어두운 갈색)
        for y in range(22, 25):
            for x in range(wx, wx + 8):
                if ((x - wx - 3.5) / 4.6) ** 2 + ((y - 25) / 2.7) ** 2 <= 1: c.P(x, y, K('brust', 0) if y == 24 else K('brust', 1))
    for x in (17, 30): c.VL(x, 20, 3, K('brust', 1)); c.VL(x + 1, 20, 3, K('brust', 5))
    # 트렁크(서)·보닛(동) 윗면 9..18: 탄 갈회 얼룩(값 잡음 3재질) + 부푼 칠 조각 + 가장자리로 번진 녹
    def charred(x0, x1, y0, y1, seed):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                v = field(x * 2, y * 2, seed, 64)
                col = K('brust', 5) if v > 0.62 else K('soot', 5) if v > 0.42 else K('brust', 3)
                if y == y0: col = K('brust', 3)
                if y == y1: col = K('brust', 7) if v > 0.4 else K('soot', 5)
                if x == x0 and y0 < y < y1: col = K('conc', 3)
                if x == x1: col = K('brust', 2)
                c.P(x, y, col)
        for x in range(x0, x1 + 1):                             # 가장자리로 번진 녹
            for y in (y0 + 1, y1 - 1):
                if h2(x, y, seed) % 3 == 0: c.P(x, y, K('rust', 3 if h2(x, y, seed + 1) % 2 else 4))
        for k in range(4):                                      # 부푼 칠 조각(밝은 재 + 아래 그늘)
            x = x0 + 1 + h2(k, 3, seed) % max(1, x1 - x0 - 2); y = y0 + 2 + h2(k, 4, seed) % max(1, y1 - y0 - 3)
            c.P(x, y, K('conc', 4)); c.P(x + 1, y, K('conc', 3)); c.P(x, y + 1, K('brust', 1))
    charred(4, 12, 9, 18, 71); charred(33, 45, 9, 18, 72)
    for x in (38, 42): c.VL(x, 10, 7, K('soot', 5)); c.VL(x + 1, 10, 7, K('brust', 2))       # 보닛 주름
    for y in (9, 10): c.clear(4, y); c.clear(45, y)
    # 빈 창 구멍(지붕을 두른 고리): 속은 타 버린 실내 — 어두운 갈색·회 5단, 좌석 틀·용수철
    ring = set()
    for x in range(13, 17):
        for y in range(8 - (x - 13), 19): ring.add((x, y))
    for x in range(29, 33):
        for y in range(5 + (x - 29), 19): ring.add((x, y))
    for x in range(17, 29):
        for y in range(15, 19): ring.add((x, y))
    for (x, y) in ring:
        top = min(yy for (xx, yy) in ring if xx == x)
        d = y - top
        col = K('brust', 0) if d == 0 else K('soot', 3) if d < 3 else K('brust', 1) if d < 6 else K('brust', 2)
        c.P(x, y, col)
    for x in range(18, 28):                                     # 좌석 등받이 틀(위에서 본 가로 띠)
        c.P(x, 16, K('brust', 3) if x not in (22, 23) else K('soot', 3)); c.P(x, 17, K('brust', 1))
    for x in range(18, 28, 2): c.P(x, 16, K('metal', 3))         # 용수철
    for (x, y) in ((14, 14), (15, 12), (30, 12), (31, 15)): c.P(x, y, K('metal', 3))
    c.P(14, 16, K('rust', 2)); c.P(31, 9, K('rust', 2))
    c.VL(23, 15, 4, K('brust', 4))
    c.HL(13, 18, 20, K('brust', 6))                              # 창 밑 어깨선
    # 지붕(4..14): 타서 회백색 재가 된 칠 · 위왼쪽 빛 · 처진 골 · 가장자리로 번진 녹 · 부푼 칠 조각
    for y in range(4, 15):
        x0, x1 = (17, 28) if y > 4 else (18, 27)
        for x in range(x0, x1 + 1):
            v = field(x * 2, y * 2, 77, 64)
            t = 3 if v > 0.35 else 2
            col = K('conc', t) if t == 3 else K('soot', 5)
            if (y <= 6 and x < 24) or x == x0: col = K('conc', 4)
            if y == 4: col = K('conc', 2)
            if y == 14: col = K('conc', 4)
            if x == x1: col = K('brust', 3)
            if v > 0.7: col = K('brust', 5)
            c.P(x, y, col)
    for x in range(18, 28):                                       # 열에 처진 골(어두운 줄 + 아래 빛 턱)
        yy = 10 + (1 if 21 < x < 25 else 0); c.P(x, yy, K('soot', 4)); c.P(x, yy + 1, K('conc', 4) if x < 25 else K('conc', 3))
    for (x, y) in ((17, 5), (17, 9), (28, 6), (28, 11), (18, 14), (26, 14), (27, 4), (17, 12)): c.P(x, y, K('rust', 3))
    for (x, y) in ((28, 7), (28, 12), (19, 14)): c.P(x, y, K('rust', 4))
    for (x, y) in ((20, 7), (25, 8), (22, 12)): c.P(x, y, K('conc', 5)); c.P(x, y + 1, K('brust', 1))
    c.P(19, 5, K('conc', 5)); c.P(20, 5, K('conc', 5))
    # 범퍼(그을린 쇠)
    c.R(46, 11, 2, 12, K('metal', 2)); c.VL(47, 11, 12, K('metal', 1)); c.HL(46, 11, 2, K('metal', 4)); c.P(46, 15, K('brust', 2)); c.P(46, 19, K('rust', 3))
    c.R(1, 11, 2, 12, K('metal', 2)); c.VL(1, 11, 12, K('metal', 4)); c.HL(1, 22, 2, K('metal', 1)); c.P(2, 16, K('rust', 3))
    ol_soft(c)
    c.shadow([(x, y) for y in (27, 28, 29) for x in range(5 + (y - 27), 46 - (y - 27))])


# ------------------------------------------------------------------ 녹슨 승합차
def van_r5(c):
    P = 'body'; on = set(MAT[P])
    for wx in (8, 48):                                          # 납작한 타이어(고무 3단, 위 밝게)
        c.HL(wx, 25, 9, K('rubber', 5)); c.P(wx, 25, K('rubber', 6)); c.P(wx + 1, 25, K('rubber', 6))
        c.HL(wx, 26, 9, K('rubber', 3)); c.HL(wx + 1, 27, 7, K('rubber', 2))
        for x in range(wx + 1, wx + 8, 2): c.P(x, 26, K('rubber', 4))
    # 옆면(남쪽) 18..25: 위 빛 → 아래 때 그러데이션
    for y in range(18, 26):
        x0, x1 = (2, 61) if y < 25 else (3, 60)
        for x in range(x0, x1 + 1):
            t = {18: 6, 19: 5, 20: 4, 21: 4, 22: 3, 23: 3, 24: 2, 25: 1}[y]
            if x == x0: t += 1
            if x == x1: t -= 1
            if y >= 23 and h2(x, y, 3) % 3 == 0: t -= 1          # 문턱 때
            c.P(x, y, K(P, t))
    for wx in (8, 48):                                          # 바퀴 아치(어두운 회갈)
        for y in range(22, 26):
            for x in range(wx - 1, wx + 10):
                if ((x - wx - 4) / 5.6) ** 2 + ((y - 26) / 3.2) ** 2 <= 1: c.P(x, y, K('brust', 1) if y < 25 else K('brust', 0))
    # 미닫이문: 뒤로 반쯤 밀린 문짝(테 + 손잡이) · 열린 틈으로 보이는 어두운 실내 · 위 레일
    c.HL(20, 18, 28, K(P, 2)); c.HL(20, 19, 28, K(P, 6))           # 레일 홈
    c.VL(20, 20, 4, K(P, 1)); c.VL(21, 20, 4, K(P, 6))             # 문 뒤 이음
    c.VL(36, 20, 4, K(P, 6)); c.VL(37, 20, 4, K(P, 2))             # 문짝 앞 모서리(빛·그늘)
    c.HL(34, 21, 2, K('metal', 6)); c.P(34, 22, K('metal', 2))
    for y in range(20, 26):                                        # 열린 틈(실내, 바닥까지)
        for x in range(38, 46):
            c.P(x, y, K('brust', 1) if y < 22 else K('soot', 3) if y < 24 else K('brust', 2))
    c.P(39, 22, K('metal', 3)); c.P(40, 23, K('rust', 3)); c.P(43, 21, K('brust', 3))
    c.VL(46, 20, 5, K(P, 1)); c.VL(47, 20, 4, K(P, 5))             # 틈 앞 문설주
    c.VL(51, 19, 5, K(P, 1)); c.VL(52, 19, 5, K(P, 5)); c.HL(54, 21, 2, K('metal', 6))   # 운전석 문
    # 긴 지붕(2..17): 둥근 가장자리, 앞 턱 밝게, 리브
    for y in range(2, 18):
        x0 = 3 if y > 2 else 4; x1 = 49 if y > 2 else 48
        for x in range(x0, x1 + 1):
            t = 6
            if y == 2: t = 5
            if y == 17: t = 7
            if x == x0: t = 7
            if x == x1: t = 4
            if y in (3, 4) and x0 < x < 30: t = 7
            if h2(x, y, 41) % 29 == 0: t -= 1
            c.P(x, y, K(P, t))
    for x in range(8, 48, 6):
        for y in range(3, 17): c.P(x, y, K(P, 7)); c.P(x + 1, y, K(P, 4))
    for (x, y) in ((25, 13), (41, 6)):                             # 움푹한 자국
        c.P(x, y, K(P, 4)); c.P(x + 1, y, K(P, 4)); c.P(x, y + 1, K(P, 7)); c.P(x + 1, y + 1, K(P, 7))
    # 앞 유리
    for x in range(50, 55):
        for y in range(3 + (x - 50), 18):
            c.P(x, y, K('glass', 3 if y < 6 + (x - 50) else 2))
    for (x, y) in ((51, 5), (52, 6), (52, 9), (53, 10), (54, 14)): c.P(x, y, K('glass', 5))
    c.P(52, 12, K('glass', 1)); c.P(53, 12, K('glass', 0)); c.P(52, 13, K('glass', 1))
    c.HL(50, 17, 5, K(P, 6))
    # 보닛: 덮개가 떨어져 엔진 칸이 드러남
    for y in range(8, 18):
        for x in range(55, 62):
            t = 5 if y > 8 else 4
            if y == 17: t = 6
            if x == 61: t = 3
            if x == 55 and y > 8: t = 6
            c.P(x, y, K(P, t))
    c.clear(61, 8)
    for y in range(10, 16):
        for x in range(56, 61):
            c.P(x, y, K('brust', 1) if y == 10 else K('soot', 3) if (x + y) % 3 else K('brust', 2))
    c.R(57, 12, 3, 2, K('metal', 3)); c.HL(57, 12, 3, K('metal', 5)); c.P(59, 14, K('rust', 4)); c.P(56, 13, K('rubber', 4))
    c.R(62, 10, 2, 14, K('metal', 3)); c.VL(63, 10, 14, K('metal', 1)); c.P(62, 12, K('paint', 2)); c.P(62, 21, K('paint', 1))
    c.R(0, 9, 2, 15, K('metal', 3)); c.VL(0, 9, 15, K('metal', 5)); c.P(1, 12, K('wine', 2)); c.P(1, 20, K('wine', 2))
    # 지붕 짐: 묶은 천 꾸러미 · 눕힌 헌 타이어
    box(c, 11, 6, 11, 5, 3, 'army', tt=4, ft=2)
    for x in (14, 19): c.VL(x, 6, 8, K('dry', 2)); c.P(x, 6, K('dry', 4))
    c.P(12, 7, K('army', 6)); c.P(17, 8, K('army', 2)); c.P(16, 7, K('army', 6))
    c.ell(32, 9, 5, 3, K('rubber', 4)); c.ell(32, 9, 4, 2, K('rubber', 5)); c.ell(32, 9, 2, 1, K('rubber', 2))
    c.HL(29, 12, 7, K('rubber', 3)); c.HL(29, 13, 7, K('rubber', 2)); c.P(29, 7, K('rubber', 6))
    # 녹: 지붕 리브 이음을 따라 번진 줄 · 지붕 가장자리에서 옆면으로 흘러내린 녹물 · 문턱·아치 둘레 패인 녹 · 크기 다른 꽃 몇
    for k, x in enumerate(range(8, 48, 6)):
        y0 = 3 + h2(k, 1, 5) % 6; ln = 2 + h2(k, 2, 5) % 6
        for j in range(ln):
            if c.get(x + 1, y0 + j) in on: c.P(x + 1, y0 + j, K('rust', 3 if j == 0 else 4 if j < ln - 1 else 5))
    for k, x in enumerate((5, 11, 17, 24, 31, 43, 50, 57)):
        ln = 2 + h2(k, 3, 9) % 4
        for j in range(ln):
            if c.get(x, 19 + j) in on: c.P(x, 19 + j, K('rust', 4 if j < ln - 1 else 5))
        c.P(x, 18, K('rust', 3)) if c.get(x, 18) in on else None
    for y in range(21, 26):                                         # 문턱·아치 둘레 패인 녹
        for x in range(2, 62):
            if c.get(x, y) not in on: continue
            near = min(abs(x - 12), abs(x - 52))
            v = field(x * 3, y * 3, 55, 64) + (0.18 if near < 7 else 0) + (y - 21) * 0.04
            if v > 0.86: c.P(x, y, K('rust', 2 if h2(x, y, 4) % 4 == 0 else 3))
            elif v > 0.77: c.P(x, y, K('rust', 4))
    bloom(c, 6, 6, 3, on, 1, 0.8, drip=1); bloom(c, 44, 13, 4, on, 2, 0.6, drip=0); bloom(c, 58, 22, 2, on, 4, 0.8)
    bloom(c, 26, 15, 2, on, 3, 0.7); bloom(c, 5, 21, 3, on, 7, 0.8, drip=2)
    ol_soft(c)
    c.shadow([(x, y) for y in (27, 28, 29) for x in range(4 + (y - 27), 62 - (y - 27))])


# ------------------------------------------------------------------ 망루(지붕 없는 열린 감시대)
def tower_r5(c):
    # 뒤 다리(안쪽·짧게 — 발이 더 높다) + 뒤 가새 하나
    for x, yb in ((6, 52), (24, 50)):
        for y in range(33, yb): c.P(x, y, K('wood', 2)); c.P(x + 1, y, K('wood', 1))
    c.line(8, 36, 23, 47, K('wood', 1))
    chunk5(c, 5, 51, 4, 3, 'conc', 1, seed=3)
    # 앞 왼다리(조금 벌어짐) · 앞 오른다리(짧아서 드럼통 위에 섰다)
    for y in range(33, 58):
        x = 1 + (1 if y < 45 else 0)
        g = 1 if h2(x, y // 3, 5) % 5 == 0 else 0
        c.P(x, y, K('wood', 4)); c.P(x + 1, y, K('wood', 3 - g)); c.P(x + 2, y, K('wood', 2)); c.P(x + 3, y, K('wood', 1))
    for y in range(33, 52):
        g = 1 if h2(27, y // 3, 6) % 4 == 0 else 0
        c.P(26, y, K('wood', 4)); c.P(27, y, K('wood', 3 - g)); c.P(28, y, K('wood', 2)); c.P(29, y, K('wood', 1))
    drum(c, 27, 52, 4, 2, 7, 'rust', 6)
    chunk5(c, 0, 56, 7, 6, 'conc', 2, seed=1)
    # 가새: 왼 칸 대각 하나 · 부러진 대각(쪼개진 끝) · 가로대 절반은 쇠 파이프로 덧댐 · 끈 묶음
    c.line(5, 36, 25, 49, K('wood', 3)); c.line(5, 37, 25, 50, K('wood', 1))
    c.line(25, 36, 16, 42, K('wood', 4)); c.line(25, 37, 16, 43, K('wood', 2)); c.P(15, 43, K('wood', 4)); c.P(15, 44, K('wood', 3))
    c.HL(5, 45, 11, K('wood', 4)); c.HL(5, 46, 11, K('wood', 2))
    c.HL(16, 45, 10, K('metal', 5)); c.HL(16, 46, 10, K('metal', 2)); c.P(16, 45, K('metal', 6))
    for (x, y) in ((4, 36), (4, 45), (26, 45), (25, 36), (15, 45)): c.P(x, y, K('dry', 4)); c.P(x, y + 1, K('dry', 2))
    # 사다리(오른쪽, 비스듬히 · 가로대 하나 빠짐)
    for y in range(33, 62):
        dx = (y - 33) // 14
        c.P(18 + dx, y, K('metal', 5)); c.P(22 + dx, y, K('metal', 2))
        if (y - 34) % 3 == 0 and y not in (46,): c.HL(19 + dx, y, 3, K('metal', 6)); c.HL(19 + dx, y + 1, 3, K('metal', 1)) if y + 1 < 62 else None
    # 바닥 앞 보(30..33): 앞 턱 빛 · 판 두께 · 아래 그늘
    c.R(0, 30, 32, 4, K('wood', 2)); c.HL(0, 30, 32, K('wood', 4)); c.HL(0, 33, 32, K('wood', 1))
    for x in range(1, 32, 6): c.P(x, 31, K('wood', 3)); c.P(x + 3, 32, K('wood', 1))
    c.P(9, 31, K('metal', 6)); c.P(24, 31, K('metal', 6))
    # 판자 바닥 윗면(3..29): 동서로 놓인 짝 안 맞는 판 · 빠진 판(아래가 보이는 틈) · 덧댄 함석 · 못
    for y in range(3, 30):
        row = (y - 3) // 3; k = (y - 3) % 3
        off = h2(row, 1, 8) % 9
        for x in range(0, 32):
            t = 3 + (1 if (row + (x + off) // 11) % 2 == 0 else 0)
            if k == 2: t = 2
            if k == 0 and x < 22: t = min(4, t + 1)
            if h2(x, y, 3) % 11 == 0 and k != 2: t -= 1
            if (x + off) % 11 == 0 and k != 2: t = 2                  # 판 끝 이음
            c.P(x, y, K('wood', t))
    for x in range(10, 19):                                        # 빠진 판: 틈으로 아래 그늘
        for y in (18, 19): c.P(x, y, K('brust', 0) if y == 18 else K('brust', 1))
    c.P(18, 18, K('wood', 2))
    corrugated(c, 20, 21, 8, 5, 'metal', base=4, pitch=3, seed=2); c.HL(20, 21, 8, K('metal', 6)); c.HL(20, 25, 8, K('metal', 2))
    bloom(c, 24, 23, 2, set(MAT['metal']), 9, 0.8)
    for (x, y) in ((4, 4), (14, 7), (27, 10), (6, 13), (22, 16), (3, 22), (12, 25), (29, 27)): c.P(x, y, K('metal', 6))
    # 바닥 위 물건: 뚜껑 열린 드럼통(타원 테 + 어두운 속)
    c.ell(8, 11, 4, 2, K('rust', 4)); c.ell(8, 11, 3, 1, K('brust', 1)); c.HL(6, 9, 5, K('rust', 6)); c.P(4, 11, K('rust', 5))
    c.HL(5, 13, 7, K('rust', 2)); c.HL(6, 12, 2, K('brust', 3)); c.P(11, 12, K('rust', 3))
    # 모래주머니 둘레(위가 둥근 자루 — 윗면 빛 2행 + 앞면 그늘), 크기·명암 제각각, 앞 가운데는 사다리 틈
    def bag(x, y, w, h, s):
        b = 1 if h2(x, y, s) % 3 == 0 else 0
        c.R(x + 1, y, w - 2, h, K('wood', 3)); c.R(x, y + 1, w, h - 2, K('wood', 3))     # 둥근 귀퉁이 자루 몸(앞면 갈색)
        c.HL(x + 1, y, w - 2, K('burlap', 4))                                               # 윗면(볕 받은 마대, 가운데 부풀어 밝다)
        c.HL(x + 1, y + 1, w - 2, K('dry', 4 - b)); c.HL(x + 1, y + 2, w - 2, K('burlap', 5)); c.P(x + 1, y + 1, K('dry', 5)); c.P(x + w - 2, y + 1, K('burlap', 5))
        c.HL(x + 2, y + 2, max(1, w - 4), K('dry', 4)); c.P(x + w - 2, y + 2, K('wood', 4))
        c.HL(x + 1, y + h - 1, w - 2, K('wood', 1)); c.P(x + w - 1, y + 2, K('wood', 2)); c.P(x + w // 2, y + h - 2, K('wood', 2))
    for i, x in enumerate((0, 6, 11, 17, 22, 27)): bag(x, 0, 6 if i != 5 else 5, 5, 1)
    for i, y in enumerate((5, 10, 15, 20)): bag(0, y, 4, 5, 2 + i); bag(28, y + 1, 4, 5, 6 + i)
    for (x, w) in ((0, 6), (6, 6), (12, 5), (24, 5), (28, 4)): bag(x, 25, w, 5, 3)
    ol_soft(c)
    c.shadow([(x, y) for y in range(59, 64) for x in range(1 + (63 - y), 31 - (63 - y) // 2)])


# ------------------------------------------------------------------ 통나무 의자
def log_r5(c):
    # 둥근 윤곽: 윗변·아랫변이 양 끝에서 휜다, 동쪽으로 조금 가늘어진다
    def span(x):
        e = min(x - 3, 30 - x)
        top = 3 + (2 if e <= 0 else 1 if e <= 1 else 0) + (1 if x > 24 else 0)
        bot = 12 - (2 if e <= 0 else 1 if e <= 1 else 0)
        return top, bot
    for x in range(3, 31):
        top, bot = span(x)
        for y in range(top, bot + 1):
            v = (y - top) / max(1, bot - top)
            t = 2 if v < 0.08 else 4 if v < 0.5 else 3 if v < 0.68 else 2 if v < 0.82 else 1 if v < 0.93 else 0
            f = h2(x // 3 + (y * 5), y, 11) % 7                      # 껍질 골(길이 방향으로 긴 어두운 줄)
            if 0.1 <= v < 0.85 and f == 0: t = max(0, t - 1)
            col = K('wood', t)
            if 0.08 <= v < 0.55:                                      # 볕에 바랜 회갈 껍질 띠(가장 밝다) + 길이 방향 결
                g = h2(x // 4 + y * 3, y, 13) % 4
                col = K('burlap', 5) if g in (0, 1) else K('wood', 4) if g == 2 else K('burlap', 4)
                if v < 0.2 and g == 0: col = K('burlap', 6)
            elif 0.55 <= v < 0.7 and h2(x // 3, y, 14) % 3 == 0: col = K('burlap', 4)
            c.P(x, y, col)
    for x in range(5, 29):                                          # 길게 갈라진 껍질 골 두 줄(물결)
        for (y0, s) in ((6, 1), (9, 2)):
            top, bot = span(x)
            y = y0 + (1 if h2(x // 4, s, 3) % 2 else 0)
            if top < y < bot and h2(x, s, 5) % 5: c.P(x, y, K('wood', 1 if y0 == 9 else 2))
    for (kx, ky) in ((11, 5), (22, 7)):                              # 옹이(어두운 눈 + 밝은 테)
        c.P(kx, ky, K('wood', 0)); c.P(kx + 1, ky, K('wood', 1)); c.P(kx - 1, ky, K('wood', 4)); c.P(kx, ky - 1, K('wood', 4)); c.P(kx + 1, ky + 1, K('wood', 2))
    # 서쪽 잘린 면: 남쪽으로 조금 기운 얇은 조각 — 나이테 줄무늬
    for y in range(5, 12):
        c.P(3, y, K('burlap', 6) if y % 2 else K('wood', 3))
        c.P(4, y, K('burlap', 6) if y in (6, 9) else K('wood', 3) if y % 2 else K('wood', 4))
    c.P(3, 5, K('wood', 2)); c.P(3, 11, K('wood', 1)); c.P(4, 8, K('wood', 2))
    # 동쪽 부러진 가지 그루터기(쪼개진 끝)
    c.P(27, 3, K('wood', 2)); c.P(28, 3, K('wood', 3)); c.P(28, 2, K('wood', 4)); c.P(29, 2, K('burlap', 6)); c.P(29, 3, K('wood', 1))
    ol_soft(c)
    c.shadow([(x, y) for y in (13, 14) for x in range(5 + (y - 13) * 2, 31 - (y - 13))])


# ------------------------------------------------------------------ 노점 B
def stall_r5(c, tarp='blue'):
    # 계산대 앞면(짧게 23..28): 짝 안 맞는 세로 판 · 판 하나는 함석 · 아래 그늘
    boards = [(3, 5, 'wood', 2), (8, 4, 'wood', 3), (12, 6, 'metal', 3), (18, 5, 'wood', 2), (23, 4, 'brust', 3), (27, 6, 'wood', 3), (33, 5, 'wood', 2), (38, 7, 'army', 2)]
    for (x, w, m, t) in boards:
        for i in range(w):
            for y in range(23, 29):
                tt = t + (1 if i == 0 else -1 if i == w - 1 else 0)
                if y == 28: tt = t - 2
                if h2(x + i, y, 4) % 9 == 0: tt -= 1
                c.P(x + i, y, K(m, tt))
    c.P(14, 25, K('rust', 3)); c.P(15, 26, K('rust', 4)); c.P(5, 24, K('metal', 6)); c.P(20, 24, K('metal', 6)); c.P(29, 24, K('metal', 6))
    c.clear(44, 28); c.clear(3, 28)
    # 계산대 윗면(15..22, 8행): 동서로 놓인 밝은 판 · 이음 · 앞 턱 가장 밝게, 뒤쪽은 차양 그늘
    for y in range(15, 23):
        for x in range(3, 45):
            k = (y - 15) % 3
            t = 4 if k != 2 else 3
            if y == 22: t = 4
            if y <= 16: t = 3 if y == 16 else 2
            if h2(x, y, 6) % 13 == 0 and 16 < y < 22: t -= 1
            c.P(x, y, K('wood', t))
    # 물건(위에서 본 모양): 깡통 뚜껑 타원 · 누운 병 · 톱니 고리 · 감은 전선 · 축전지 · 고철 조각
    for (x, y) in ((6, 18), (9, 19), (7, 21)):
        c.ell(x, y, 1, 0, K('metal', 5)); c.P(x - 1, y, K('metal', 6)); c.P(x + 1, y, K('metal', 3)); c.HL(x - 1, y + 1, 3, K('metal', 2))
    for (x, y, m) in ((13, 18, 'glass'), (14, 21, 'army')):
        c.HL(x, y, 5, K(m, 3)); c.HL(x, y - 1, 4, K(m, 5)); c.P(x + 5, y, K(m, 2)); c.P(x + 1, y - 1, K(m, 6)); c.HL(x, y + 1, 5, K('wood', 2))
    c.ell(24, 19, 2, 1, K('metal', 4)); c.P(24, 19, K('wood', 3)); c.P(22, 19, K('metal', 6)); c.HL(23, 21, 3, K('wood', 2))
    for (x, y) in ((22, 17), (26, 18), (26, 20), (22, 21)): c.P(x, y, K('metal', 3))
    c.ell(31, 19, 2, 1, K('rubber', 4)); c.P(31, 19, K('wood', 3)); c.HL(30, 18, 3, K('rubber', 6)); c.HL(30, 21, 3, K('wood', 2))
    box(c, 35, 16, 6, 3, 2, 'army', tt=4, ft=2, ao=False); c.P(36, 17, K('brick', 4)); c.P(39, 17, K('metal', 6))
    c.line(41, 20, 44, 18, K('rust', 4)); c.line(41, 21, 44, 19, K('rust', 2))
    # 기둥 넷: 뒤 둘(차양 밑 짧게) · 앞 둘(땅까지)
    for x in (4, 42): c.R(x, 9, 2, 6, K('wood', 2)); c.VL(x, 9, 6, K('wood', 3))
    for x in (0, 45):
        for y in range(9, 30): c.P(x, y, K('wood', 4)); c.P(x + 1, y, K('wood', 3)); c.P(x + 2, y, K('wood', 1))
    # 차양(0..9): 앞으로 기운 방수포 판 — 앞 두 기둥 사이로 가운데가 처진다, 덧댄 천, 앞 가장자리는 기둥 사이로 늘어진 호
    for r in range(10):
        l = int(round(3 * (1 - r / 9)))
        for x in range(l, 48 - l):
            u = x / 47.0
            sag = 1 - abs(u - 0.5) * 2                                # 가운데 처짐
            t = 3 + (1 if r >= 3 else 0) + (1 if r >= 6 else 0)
            if u < 0.08 or u > 0.92: t += 1                           # 기둥 위 팽팽한 귀퉁이
            if sag > 0.5 and r >= 4: t -= 1
            fold = (x + r // 2) % 9
            if fold == 0 and 0 < r < 9: t -= 1
            elif fold == 1 and 0 < r < 9: t += 1
            if r == 0: t = 2
            c.P(x, r, K(tarp, max(1, min(6, t))))
    for x in range(48):                                            # 앞 가장자리: 처진 호(가운데가 1~2 행 더 내려온다)
        sag = 1 - abs(x / 47.0 - 0.5) * 2
        d = 1 + (1 if sag > 0.35 else 0) + (1 if sag > 0.8 else 0)
        for j in range(d): c.P(x, 10 + j, K(tarp, 5 if j == 0 else 2))
    for (px, py, pw, ph, m) in ((7, 2, 8, 5, 'army'), (31, 4, 7, 4, 'burlap')):
        for j in range(ph):
            for i in range(pw):
                c.P(px + i, py + j, K(m, 4 + (1 if i < 2 else -1 if i > pw - 3 else 0)))
        c.HL(px, py + ph, pw, K(tarp, 1)); c.VL(px + pw, py, ph + 1, K(tarp, 1))
        for i in range(0, pw, 2): c.P(px + i, py, K(m, 2))
    for (x, y) in ((0, 9), (1, 10), (46, 9), (47, 10)): c.P(x, y, K('dry', 3))
    c.P(19, 6, K('tarp', 1)); c.P(20, 6, K('blue', 1))
    ol_soft(c)
    c.shadow([(x, y) for y in range(12, 15) for x in range(3, 45) if not c.has(x, y)])
    c.shadow([(x, y) for y in (29, 30, 31) for x in range(3 + (y - 29), 47)])
