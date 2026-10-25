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


def wheel_side(c, wx, cy=26, r=5, burnt=False):
    """옆에서 본 바퀴(지름 10): 고무 원판(위 밝게) + 휠 테 + 바람 빠져 바닥에 퍼진 아래 두 줄."""
    for y in range(cy - r, cy + r + 1):
        for x in range(wx - r - 1, wx + r + 2):
            d = ((x - wx) / (r + .5)) ** 2 + ((y - cy) / (r + .5)) ** 2
            if d > 1: continue
            t = 4 if y < cy - 2 else 3 if y < cy + 1 else 2
            if x < wx - 2 and y < cy: t += 1
            c.P(x, y, K('rubber', t))
    c.HL(wx - r - 1, cy + r - 1, 2 * r + 3, K('rubber', 2)); c.HL(wx - r - 1, cy + r, 2 * r + 3, K('rubber', 1))
    c.ell(wx, cy - 1, 2, 2, K('rust' if burnt else 'metal', 3)); c.HL(wx - 1, cy - 3, 3, K('rust' if burnt else 'metal', 5))
    c.P(wx, cy - 1, K('soot', 1)); c.P(wx + 1, cy, K('metal', 1) if not burnt else K('soot', 0))


def car_h(c, paint, seed=0):
    """동서로 놓인 승용차(64×32), 앞(보닛)은 동쪽. 지붕 판(2..9) · 트렁크·보닛 윗면(8..13) · 옆면 20행(10..29: 옆 유리 띠 + 문 판) · 바퀴 지름 10."""
    P = paint; TOP = len(MAT[P]) - 1
    c.shadow([(x, y) for y in (30, 31) for x in range(5 + (y - 30), 60 - (y - 30))])
    # 아래 옆면(남쪽 문 판) 14..29
    for y in range(14, 30):
        x0, x1 = (2, 61) if y < 29 else (3, 60)
        for x in range(x0, x1 + 1):
            t = 2 if y == 14 else 4 if y < 19 else 3 if y < 25 else 2 if y < 28 else 1
            if x == x0: t += 1
            if x == x1: t -= 1
            c.P(x, y, K(P, t))
    for x in (25, 39): c.VL(x, 15, 12, K(P, 1)); c.VL(x + 1, 15, 12, K(P, 4))                 # 문 이음
    c.HL(29, 17, 4, K('metal', 6)); c.HL(43, 17, 3, K('metal', 6)); c.HL(3, 21, 58, K(P, 2)); c.HL(3, 22, 58, K(P, 4))   # 손잡이 · 허리 주름선
    for wx in (14, 50):                                                                         # 바퀴 아치
        for y in range(19, 30):
            for x in range(wx - 8, wx + 9):
                if ((x - wx) / 7.5) ** 2 + ((y - 30) / 8.5) ** 2 <= 1: c.P(x, y, K('soot', 0) if y > 22 else K('soot', 1))
        for x in range(wx - 7, wx + 8):
            yy = 30 - int(8.5 * max(0.0, 1 - ((x - wx) / 7.5) ** 2) ** 0.5) - 1
            if 14 < yy < 29: c.P(x, yy, K(P, TOP - 1))
        wheel_side(c, wx, 25, 5)
    # 트렁크(서) · 보닛(동) 윗면 8..13
    def plane(x0, x1, y0, y1, t):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                tt = t - (1 if y == y0 else 0) + (1 if y == y1 else 0) + (1 if x == x0 and y > y0 else 0) - (1 if x == x1 else 0)
                c.P(x, y, K(P, tt))
    plane(2, 16, 8, 13, TOP - 2); plane(47, 61, 8, 13, TOP - 2); c.HL(3, 13, 14, K(P, TOP)); c.HL(47, 13, 14, K(P, TOP))
    for x in (51, 56): c.VL(x, 9, 4, K(P, TOP - 1)); c.VL(x + 1, 9, 4, K(P, TOP - 3))            # 보닛 주름
    c.clear(2, 8); c.clear(61, 8)
    # 유리 고리: 뒤 유리 17..21 · 앞 유리 42..46 · 옆 유리 띠 10..13
    for x in range(17, 22):
        for y in range(3 + (21 - x), 14): c.P(x, y, K('glass', 2 + (1 if (x + y) % 7 == 0 else 0)))
    for x in range(42, 47):
        for y in range(3 + (x - 42), 14): c.P(x, y, K('glass', 3 if y < 7 + (x - 42) else 2))
    glass_broken(c, 22, 10, 10, 4, seed + 2, 2); glass_broken(c, 33, 10, 9, 4, seed + 3, 1)
    c.VL(32, 10, 4, K(P, 3)); c.VL(21, 10, 4, K(P, 3)); c.VL(42, 10, 4, K(P, 2))                # 기둥
    for (x, y) in ((18, 8), (19, 9), (44, 6), (45, 8), (26, 11), (27, 12), (36, 11)): c.P(x, y, K('glass', 5))
    c.P(44, 10, K('soot', 0)); c.P(44, 11, K('soot', 1))
    # 지붕(가장 밝은 판) 2..9
    for y in range(2, 10):
        x0, x1 = (22, 41) if y > 2 else (23, 40)
        for x in range(x0, x1 + 1):
            t = TOP - 1
            if y == 2: t = TOP - 2
            if y in (3, 4) and x < 34: t = TOP
            if x == x0: t = TOP
            if x == x1: t = TOP - 3
            if y == 9: t = TOP
            c.P(x, y, K(P, t))
    c.HL(17, 14, 30, K(P, TOP - 1))                                                             # 창 밑 어깨선
    # 범퍼 · 등
    c.R(62, 11, 2, 15, K('metal', 3)); c.VL(63, 11, 15, K('metal', 1)); c.HL(62, 11, 2, K('metal', 5))
    c.R(0, 11, 2, 15, K('metal', 3)); c.VL(0, 11, 15, K('metal', 5)); c.HL(0, 25, 2, K('metal', 1))
    c.R(60, 15, 2, 2, K('paint', 2)); c.P(60, 15, K('paint', 3)); c.R(2, 15, 2, 2, K('wine', 2))
    for y in range(2, 30):                                                                      # 칠 바램 결
        for x in range(2, 62):
            col = c.get(x, y)
            if col in MAT[P] and h2(x, y, seed + 30) % 23 == 0: c.P(x, y, K(P, MAT[P].index(col) + (1 if (x + y) % 2 else -1)))
    on = set(MAT[P])
    rust_patch(c, 2, 8, 60, 22, seed=seed + 11, dens=0.30, mat='rust', on=on)
    rust_blob(c, 8, 11, 3, 2, on, seed + 1, 'rust', 4); rust_blob(c, 30, 6, 3, 1, on, seed + 4, 'rust', 4); rust_blob(c, 33, 24, 4, 2, on, seed + 5, 'rust', 4)
    c.outline(top=False)


def car_v(c, paint, seed=0):
    """남북으로 놓인 승용차(32×64), 앞이 남쪽: 트렁크·뒤 유리·지붕·앞 유리·보닛 윗면(2..45) + 앞면(46..60: 그릴·등·번호판·범퍼) · 옆으로 삐진 바퀴."""
    P = paint
    c.shadow([(x, y) for y in (62, 63) for x in range(4, 29)])
    def plane(x0, x1, y0, y1, t):
        for y in range(y0, y1):
            for x in range(x0, x1):
                tt = t + (1 if x == x0 + 1 else 0) - (1 if x == x1 - 1 else 0)
                if h2(x, y, seed) % 17 == 0: tt -= 1
                c.P(x, y, K(P, tt))
    for y in (4, 37):                                                                           # 옆으로 삐진 바퀴(지름 10)
        c.R(1, y, 3, 10, K('rubber', 2)); c.VL(1, y, 10, K('rubber', 4)); c.HL(1, y, 3, K('rubber', 5))
        c.R(28, y, 3, 10, K('rubber', 1)); c.VL(30, y, 10, K('rubber', 0)); c.HL(28, y, 3, K('rubber', 3))
    plane(5, 27, 2, 10, 4); c.HL(6, 2, 20, K(P, 5))                                             # 트렁크
    glass_broken(c, 6, 10, 20, 5, seed, 2)                                                      # 뒤 유리
    plane(5, 27, 15, 29, 5); c.HL(6, 15, 20, K(P, 6)); c.VL(5, 15, 14, K(P, 6))                   # 지붕
    for y in range(17, 28, 4): c.HL(8, y, 16, K(P, 6))                                           # 지붕 골
    glass_broken(c, 6, 29, 20, 7, seed + 1, 3)                                                   # 앞 유리
    plane(4, 28, 36, 46, 4); c.HL(5, 36, 22, K(P, 5)); c.VL(15, 37, 8, K(P, 3)); c.VL(16, 37, 8, K(P, 5)); c.HL(4, 45, 24, K(P, 6))
    c.VL(4, 2, 44, K(P, 3)); c.VL(3, 4, 41, K(P, 2)); c.VL(27, 2, 44, K(P, 2)); c.VL(28, 4, 41, K(P, 1))
    # 앞면 46..60
    for y in range(46, 60):
        for x in range(3, 29):
            t = 3 if y < 49 else 2 if y < 57 else 1
            if h2(x, y, seed + 9) % 19 == 0: t += 1
            c.P(x, y, K(P, t))
    c.HL(3, 46, 26, K(P, 4)); c.VL(3, 46, 14, K(P, 3)); c.VL(28, 46, 14, K(P, 0))
    c.R(9, 49, 14, 6, K('soot', 1)); [c.VL(x, 49, 6, K('metal', 3)) for x in range(10, 23, 2)]; c.HL(9, 49, 14, K('metal', 5)); c.HL(9, 54, 14, K('metal', 1))
    c.R(4, 49, 4, 5, K('glass', 3)); c.HL(4, 49, 4, K('glass', 5)); c.P(5, 50, K('white', 2)); c.HL(4, 53, 4, K('glass', 1))
    c.R(24, 49, 4, 5, K('soot', 0)); c.P(25, 50, K('glass', 5)); c.P(27, 52, K('glass', 4))
    c.R(12, 55, 8, 3, K('body', 4)); c.HL(12, 55, 8, K('body', 6)); c.HL(12, 57, 8, K('body', 2))
    c.R(2, 58, 28, 3, K('metal', 3)); c.HL(2, 58, 28, K('metal', 5)); c.HL(2, 60, 28, K('metal', 1)); c.P(21, 59, K('soot', 1)); c.P(22, 59, K('soot', 1))
    for wx in (2, 22): flat_tyre(c, wx, 61, 8)
    on = set(MAT[P])
    rust_patch(c, 2, 1, 28, 60, seed=seed + 5, dens=0.33, on=on)
    rust_blob(c, 20, 20, 3, 2, on, seed + 2, 'rust', 4); rust_blob(c, 9, 40, 3, 2, on, seed + 3, 'rust', 4)
    c.outline()


@piece('car-rust-h', '녹슨 승용차 (가로)', 4, 2, 'other', en='abandoned rusted car lying east-west seen from above: roof, hood and trunk tops, broken windows, rusty side panel with flat tyres',
       tags=['차', '폐차'], desc='버려진 녹슨 승용차(동서). 깨진 유리, 바람 빠진 타이어.', solid=[(0, 1), (1, 1), (2, 1), (3, 1), (1, 0), (2, 0)])
def _car_h(c): car_h(c, 'blue', seed=2)


@piece('car-rust-v', '녹슨 승용차 (세로)', 2, 4, 'other', en='abandoned rusted car facing south seen from above: trunk, roof and hood tops with cracked glass, front grille and bumper below',
       tags=['차', '폐차'], desc='버려진 녹슨 승용차(남북, 앞이 남쪽).', solid=[(0, 1), (1, 1), (0, 2), (1, 2), (0, 3), (1, 3)])
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


@piece('van-rust', '녹슨 승합차', 5, 3, 'other', en='abandoned rusty box van lying east-west seen from above: long flat roof top, cab windshield, side with sliding door and flat tyres',
       tags=['차', '폐차'], desc='버려진 녹슨 승합차(동서, 앞이 동쪽).', solid=[(0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (0, 2), (1, 2), (2, 2), (3, 2), (4, 2), (1, 0), (2, 0), (3, 0)])
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
    c.shadow([(x, y) for y in (46, 47) for x in range(3 + (y - 46), 47)])
    # 차양 밑 그늘진 뒤 판벽(14..26) + 선반 + 걸어 둔 물건
    for y in range(14, 27):
        for x in range(4, 44):
            k = (x - 4) % 5
            t = 0 if k == 0 else 2 if k == 1 else 1
            if h2(x, y, seed + 3) % 11 == 0: t += 1
            c.P(x, y, K('wood', t))
    c.HL(4, 21, 40, K('wood', 4)); c.HL(4, 22, 40, K('wood', 1))                            # 선반
    for x in range(6, 42, 7): c.R(x, 18, 3, 3, K('metal', 3)); c.HL(x, 18, 3, K('metal', 5))  # 선반 위 깡통
    c.VL(14, 14, 7, K('rubber', 3)); c.ell(14, 23, 2, 1, K('rubber', 4)); c.P(14, 23, K('wood', 0))  # 걸어 둔 전선 고리
    c.line(30, 14, 30, 19, K('metal', 2)); c.R(28, 19, 5, 3, K('rust', 3)); c.HL(28, 19, 5, K('rust', 5))   # 걸어 둔 냄비
    for x in (4, 42): c.R(x, 14, 2, 13, K('wood', 2)); c.VL(x, 14, 13, K('wood', 3))        # 뒤 기둥
    # 앞 기둥(땅까지)
    for x in (1, 44): c.R(x, 13, 3, 33, K('wood', 2)); c.VL(x, 13, 33, K('wood', 4)); c.VL(x + 2, 13, 33, K('wood', 1))
    # 상자 계산대: 윗면 27..32 · 앞면 33..45(13행)
    fy = box(c, 4, 27, 40, 6, 13, 'wood', tt=4, ft=2)
    for x in range(4, 44, 10): c.VL(x, fy, 13, K('wood', 0)); c.VL(x + 1, fy, 13, K('wood', 3))
    c.HL(4, fy + 6, 40, K('wood', 1)); c.HL(4, fy + 7, 40, K('wood', 3))
    for x in (9, 19, 29, 39): c.P(x, fy + 2, K('metal', 6)); c.P(x, fy + 9, K('metal', 6))
    goods(c, fy)
    # 방수포 지붕 윗면(1..15, 사다리꼴, 처진 주름, 덧댄 천) + 앞 늘어진 가장자리(16..17)
    for r in range(15):
        l = int(round(3 * (1 - r / 14)))
        for x in range(l, 48 - l):
            t = 4 if r < 5 else 3 if r < 10 else 2
            fold = (x * 2 + r) % 12
            if fold == 0: t -= 1
            elif fold == 1: t += 1
            if r == 7 and x % 2 == 0: t -= 1
            c.P(x, r + 1, K(tarp, t))
        if r in (4, 10):
            for x in range(l + 2, 48 - l - 2, 3): c.P(x, r + 1, K(tarp, 5))
    c.HL(3, 1, 42, K(tarp, 5)); c.HL(0, 15, 48, K(tarp, 5))
    for x in range(0, 48):
        d = 1 + (1 if (x // 4) % 2 else 0)
        for j in range(d): c.P(x, 16 + j, K(tarp, 2 if j == 0 else 1))
    rust_patch(c, 0, 1, 48, 17, seed=seed, dens=0.18, mat='brust', on=set(MAT[tarp]))
    pm = 'army' if tarp != 'army' else 'tarp'
    c.R(30, 4, 9, 6, K(pm, 3)); c.HL(30, 4, 9, K(pm, 5)); c.VL(30, 4, 6, K(pm, 4)); c.HL(30, 10, 9, K(tarp, 1))
    for i in range(0, 9, 2): c.P(30 + i, 9, K(pm, 2))
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


@piece('stall-a', '고물 노점 A', 3, 3, 'structure', style='prop', en='market stall of scavenged goods: patched tarp roof seen from above on poles, crate counter with tins and bottles',
       tags=['노점', '시장'], desc='방수포 지붕 아래 상자 계산대에 통조림·병을 늘어놓은 노점.', solid=[(0, 1), (1, 1), (2, 1), (0, 2), (1, 2), (2, 2)])
def _stall_a(c): stall(c, 4, 'tarp', goods_a)


@piece('stall-b', '고물 노점 B', 3, 3, 'structure', style='prop', en='market stall of scavenged goods: sagging patched blue tarp roof seen from above on poles and battens, lit plank counter top with scrap parts, tins, bottles, a wire coil and a rusty can',
       tags=['노점', '시장'], desc='기운 파란 방수포를 덮은 노점. 고철 부품·통조림·병·전선·녹슨 통.', solid=[(0, 1), (1, 1), (2, 1), (0, 2), (1, 2), (2, 2)])
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
def dead_tree_draw(c):
    c.shadow([(x, y) for y in (60, 61, 62) for x in range(12 + (y - 60), 36 - (y - 60))])
    # 줄기(굵게 7→11, 왼쪽 빛) + 뿌리
    for y in range(24, 61):
        w = 7 + (y - 24) // 9
        x0 = 21 - w // 2 + (1 if y < 42 else 0)
        for i in range(w):
            t = 4 if i == 0 else 3 if i < w // 2 else 2 if i < w - 1 else 1
            if (y + i * 3) % 7 == 0: t -= 1
            c.P(x0 + i, y, K('wood', t))
    for y in range(24, 61, 3):                                     # 껍질 골·옹이
        for x in range(14, 30):
            if c.get(x, y) in MAT['wood'] and h2(x, y, 4) % 3 == 0: c.P(x, y, K('wood', 1))
    for y in range(26, 58, 7): c.VL(19 + (y // 7) % 3, y, 4, K('wood', 1))
    c.R(20, 40, 2, 2, K('wood', 0)); c.P(22, 40, K('wood', 1)); c.HL(20, 39, 2, K('wood', 4))
    c.P(23, 31, K('wood', 0)); c.P(23, 30, K('wood', 4))
    roots = (((16, 58), (9, 61), (6, 62)), ((26, 58), (33, 61), (37, 62)), ((20, 60), (18, 63)), ((24, 60), (27, 63)))
    for pts in roots:
        for k, (a, b) in enumerate(zip(pts, pts[1:])):
            c.line(a[0], a[1], b[0], b[1], K('wood', 2)); c.line(a[0], a[1] - 1, b[0], b[1] - 1, K('wood', 3 if k else 4))
            if k == 0: c.line(a[0], a[1] + 1, b[0], b[1] + 1, K('wood', 1))
    # 가지(세 화소 → 두 화소 → 끝 한 화소)
    branches = [((21, 28), (11, 15), (5, 10), (1, 8)), ((23, 27), (33, 13), (40, 7)), ((21, 22), (20, 9), (22, 1)),
                ((24, 34), (36, 24), (44, 22)), ((19, 34), (8, 27), (2, 25)),
                ((11, 15), (12, 6)), ((33, 13), (30, 4)), ((36, 24), (40, 17)), ((8, 27), (5, 21)), ((20, 9), (15, 3)), ((40, 7), (46, 5))]
    for bi, br in enumerate(branches):
        for k, (a, b) in enumerate(zip(br, br[1:])):
            c.line(a[0], a[1], b[0], b[1], K('wood', 2))
            if k == 0 and bi < 5:
                c.line(a[0] + 1, a[1], b[0] + 1, b[1], K('wood', 3)); c.line(a[0], a[1] - 1, b[0], b[1] - 1, K('wood', 4))
                c.line(a[0] + 1, a[1] + 1, b[0] + 1, b[1] + 1, K('wood', 1))
            elif k == 1 and bi < 5:
                c.line(a[0], a[1] - 1, b[0], b[1] - 1, K('wood', 3))
    for (x, y) in ((6, 11), (13, 5), (36, 9), (42, 21), (4, 24), (24, 3), (45, 4), (29, 5)):   # 매달린 마른 잎·덩굴
        c.P(x, y, K('dry', 3)); c.P(x + 1, y + 1, K('dry', 2)); c.P(x, y + 1, K('dry', 4))
    for y in range(35, 59, 2): c.P(16 + (y // 4) % 2, y, K('plant', 3)); c.P(15 + (y // 4) % 2, y + 1, K('plant', 5))   # 줄기 감은 덩굴
    c.P(17, 34, K('plant', 6)); c.P(15, 47, K('plant', 6))
    c.outline()


@piece('dead-tree', '죽은 나무', 3, 4, 'organic', en='dead leafless tree with gnarled bare branches and a thick trunk with exposed roots',
       tags=['나무', '식물'], desc='잎 없는 죽은 나무.', solid=[(1, 3)])
def _dead_tree(c): dead_tree_draw(c)


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
def lamp_draw(c):
    D = 16
    c.shadow([(x, y) for y in (46, 47) for x in range(2 + (y - 46), 12)])
    c.R(1, 27 + D, 10, 3, K('conc', 3)); c.VL(1, 27 + D, 3, K('conc', 4)); c.VL(10, 27 + D, 3, K('conc', 2)); c.HL(2, 29 + D, 8, K('conc', 1))
    c.ell(5.5, 27 + D, 4.5, 2, K('conc', 4)); c.ell(5.5, 27 + D, 3.5, 1, K('conc', 5)); c.HL(3, 26 + D, 4, K('conc', 6)); c.P(2, 27 + D, K('conc', 6))
    c.P(8, 28 + D, K('conc', 2)); c.P(9, 27 + D, K('conc', 3))
    for (x, y) in ((11, 44), (12, 45)): c.P(x, y, K('glass', 5))
    c.P(13, 44, K('glass', 3))
    c.ell(5, 25 + D, 2, 1, K('metal', 4)); c.HL(4, 24 + D, 3, K('metal', 6)); c.HL(4, 26 + D, 3, K('metal', 2))
    # 기둥(3폭) 행 6..40, 가운데쯤 한 번 휘어 1칸 왼쪽으로 기운다
    for y in range(6, 41):
        x = 4 if y >= 23 else 3
        c.P(x, y, K('metal', 6)); c.P(x + 1, y, K('metal', 4)); c.P(x + 2, y, K('metal', 2))
    c.P(6, 23, K('metal', 2)); c.P(3, 22, None)
    c.HL(3, 31, 3, K('metal', 5)); c.HL(3, 32, 3, K('metal', 1))                              # 이음 고리
    for (y, h) in ((11, 2), (19, 3), (34, 4)):
        for j in range(h):
            x = 4 if y + j >= 23 else 3
            c.P(x, y + j, K('rust', 5)); c.P(x + 1, y + j, K('rust', 3)); c.P(x + 2, y + j, K('rust', 1))
    c.P(4, 27, K('metal', 7)); c.P(3, 8, K('metal', 7)); c.P(5, 38, K('rust', 4)); c.P(5, 39, K('rust', 5))
    arm = [(3, 5), (4, 4), (5, 3), (6, 2), (7, 2), (8, 2), (9, 2), (10, 3), (11, 4), (12, 5)]
    for (x, y) in arm: c.P(x, y, K('metal', 6 if x < 9 else 5)); c.P(x, y + 1, K('metal', 2))
    c.P(5, 4, K('metal', 3)); c.P(6, 1, K('metal', 7)); c.P(7, 1, K('metal', 5))
    c.ell(11.5, 8, 4, 2, K('metal', 4))
    c.ell(11.5, 7, 3, 1, K('metal', 5)); c.HL(9, 6, 5, K('metal', 6)); c.P(10, 6, K('metal', 7)); c.P(8, 7, K('metal', 6))
    c.HL(8, 10, 8, K('metal', 1)); c.P(15, 9, K('metal', 2))
    c.P(10, 11, K('glass', 3)); c.P(11, 11, K('glass', 6)); c.P(12, 11, K('glass', 2)); c.P(11, 12, K('glass', 4))
    for (x, y) in ((14, 11), (14, 12), (15, 13), (15, 14), (15, 15), (14, 16), (14, 17)): c.P(x, y, K('rubber', 1 if y % 2 else 2))   # 늘어진 전선
    rust_patch(c, 8, 6, 8, 4, seed=12, dens=0.3, on=set(MAT['metal']))
    c.outline(top=False)


@piece('lamp-broken', '휜 가로등', 1, 3, 'column', en='bent broken street lamp: round concrete base plate seen from above, rusty pole bent over to the side, with a wide oval lamp hood plate hanging at the end',
       tags=['가로등', '폐허'], desc='휘어 부러진 옛 가로등.', solid=[(0, 2)])
def _lamp(c): lamp_draw(c)


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
    """동서로 놓인 녹슨 상자 승합차(80×48), 앞은 동쪽. 긴 지붕 판(2..17) · 옆면 28행(18..45, 미닫이문 반쯤 열림) · 바퀴 지름 11."""
    P = 'body'; on = set(MAT[P])
    # 옆면(남쪽) 18..45
    for y in range(18, 46):
        x0, x1 = (2, 77) if y < 45 else (3, 76)
        for x in range(x0, x1 + 1):
            t = 6 if y == 18 else 5 if y == 19 else 4 if y < 30 else 3 if y < 40 else 2 if y < 44 else 1
            if x == x0: t += 1
            if x == x1: t -= 1
            if y >= 40 and h2(x, y, 3) % 3 == 0: t -= 1                                        # 문턱 때
            c.P(x, y, K(P, t))
    c.HL(2, 33, 76, K(P, 2)); c.HL(2, 34, 76, K(P, 5))                                          # 허리 보호대
    for x in (4, 61): c.VL(x, 20, 24, K(P, 2)); c.VL(x + 1, 20, 24, K(P, 5))                    # 판 이음
    # 뒤 옆 창(짐칸, 판자로 막음)
    c.R(7, 21, 13, 9, K('wood', 2)); [c.HL(7, y, 13, K('wood', 3 if y % 2 else 1)) for y in range(21, 30, 3)]
    c.HL(7, 21, 13, K('wood', 4)); c.VL(19, 21, 9, K('wood', 0)); c.P(9, 23, K('metal', 6)); c.P(17, 26, K('metal', 6))
    # 미닫이문: 뒤로 반쯤 밀린 문짝 + 열린 틈(폭 11 · 높이 25, 바닥까지)
    c.HL(24, 18, 36, K(P, 2)); c.HL(24, 19, 36, K(P, 6))                                         # 레일
    c.VL(24, 20, 24, K(P, 1)); c.VL(25, 20, 24, K(P, 6))
    c.R(28, 21, 10, 8, K('glass', 2)); c.HL(28, 21, 10, K('glass', 4)); glass_broken(c, 29, 22, 8, 6, 5, 2)
    c.VL(45, 20, 24, K(P, 6)); c.VL(46, 20, 24, K(P, 2)); c.HL(42, 31, 2, K('metal', 6)); c.P(42, 32, K('metal', 2))
    for y in range(20, 46):                                                                     # 열린 틈(실내)
        for x in range(47, 58):
            c.P(x, y, K('brust', 1) if y < 24 else K('soot', 3) if y < 41 else K('brust', 2))
    c.R(49, 30, 6, 3, K('burlap', 3)); c.HL(49, 30, 6, K('burlap', 5)); c.P(52, 36, K('metal', 3)); c.P(55, 38, K('rust', 3))
    c.VL(58, 20, 25, K(P, 1)); c.VL(59, 20, 24, K(P, 5))
    # 운전석 문 + 창
    c.VL(63, 19, 25, K(P, 1)); c.VL(64, 19, 25, K(P, 5))
    glass_broken(c, 65, 20, 9, 8, 6, 2); c.HL(65, 28, 9, K(P, 6)); c.HL(67, 31, 3, K('metal', 6))
    for wx in (16, 66):                                                                         # 바퀴 아치 + 바퀴
        for y in range(33, 46):
            for x in range(wx - 9, wx + 10):
                if ((x - wx) / 8.6) ** 2 + ((y - 46) / 9.6) ** 2 <= 1: c.P(x, y, K('brust', 1) if y < 40 else K('brust', 0))
        wheel_side(c, wx, 41, 5)
    # 긴 지붕 2..17: 둥근 가장자리, 앞 턱 밝게, 리브
    for y in range(2, 18):
        x0 = 3 if y > 2 else 4; x1 = 62 if y > 2 else 61
        for x in range(x0, x1 + 1):
            t = 6
            if y == 2: t = 5
            if y == 17: t = 7
            if x == x0: t = 7
            if x == x1: t = 4
            if y in (3, 4) and x0 < x < 38: t = 7
            if h2(x, y, 41) % 29 == 0: t -= 1
            c.P(x, y, K(P, t))
    for x in range(9, 61, 7):
        for y in range(3, 17): c.P(x, y, K(P, 7)); c.P(x + 1, y, K(P, 4))
    for (x, y) in ((31, 14), (52, 6)):                                                          # 움푹한 자국
        c.P(x, y, K(P, 4)); c.P(x + 1, y, K(P, 4)); c.P(x, y + 1, K(P, 7)); c.P(x + 1, y + 1, K(P, 7))
    # 앞 유리(경사)
    for x in range(63, 70):
        for y in range(3 + (x - 63), 18):
            c.P(x, y, K('glass', 3 if y < 7 + (x - 63) else 2))
    for (x, y) in ((64, 5), (65, 6), (66, 10), (67, 11), (68, 15)): c.P(x, y, K('glass', 5))
    c.P(66, 13, K('glass', 1)); c.P(67, 13, K('glass', 0)); c.P(66, 14, K('glass', 1))
    c.HL(63, 17, 7, K(P, 6))
    # 보닛: 덮개가 떨어져 엔진 칸이 드러남
    for y in range(9, 18):
        for x in range(70, 78):
            t = 5 if y > 9 else 4
            if y == 17: t = 6
            if x == 77: t = 3
            if x == 70 and y > 9: t = 6
            c.P(x, y, K(P, t))
    c.clear(77, 9)
    for y in range(11, 16):
        for x in range(71, 77):
            c.P(x, y, K('brust', 1) if y == 11 else K('soot', 3) if (x + y) % 3 else K('brust', 2))
    c.R(72, 12, 3, 2, K('metal', 3)); c.HL(72, 12, 3, K('metal', 5)); c.P(75, 14, K('rust', 4)); c.P(71, 13, K('rubber', 4))
    c.R(78, 10, 2, 22, K('metal', 3)); c.VL(79, 10, 22, K('metal', 1)); c.R(76, 20, 2, 3, K('paint', 2)); c.P(76, 20, K('paint', 3))
    c.R(0, 9, 2, 24, K('metal', 3)); c.VL(0, 9, 24, K('metal', 5)); c.R(2, 21, 2, 3, K('wine', 2))
    # 지붕 짐: 묶은 천 꾸러미 · 눕힌 헌 타이어
    box(c, 13, 5, 14, 6, 4, 'army', tt=4, ft=2)
    for x in (17, 23): c.VL(x, 5, 10, K('dry', 2)); c.P(x, 5, K('dry', 4))
    c.P(14, 6, K('army', 6)); c.P(21, 8, K('army', 2)); c.P(20, 7, K('army', 6))
    c.ell(42, 9, 6, 3, K('rubber', 4)); c.ell(42, 9, 5, 2, K('rubber', 5)); c.ell(42, 9, 2, 1, K('rubber', 2))
    c.HL(38, 12, 9, K('rubber', 3)); c.HL(38, 13, 9, K('rubber', 2)); c.P(38, 7, K('rubber', 6))
    # 녹: 리브 줄 · 옆면으로 흘러내린 녹물 · 문턱·아치 둘레 패인 녹 · 꽃
    for k, x in enumerate(range(9, 61, 7)):
        y0 = 3 + h2(k, 1, 5) % 6; ln = 2 + h2(k, 2, 5) % 6
        for j in range(ln):
            if c.get(x + 1, y0 + j) in on: c.P(x + 1, y0 + j, K('rust', 3 if j == 0 else 4 if j < ln - 1 else 5))
    for k, x in enumerate((6, 13, 21, 27, 36, 43, 61, 70, 75)):
        ln = 3 + h2(k, 3, 9) % 6
        for j in range(ln):
            if c.get(x, 19 + j) in on: c.P(x, 19 + j, K('rust', 4 if j < ln - 1 else 5))
        c.P(x, 18, K('rust', 3)) if c.get(x, 18) in on else None
    for y in range(35, 46):
        for x in range(2, 78):
            if c.get(x, y) not in on: continue
            near = min(abs(x - 16), abs(x - 66))
            v = field(x * 3, y * 3, 55, 64) + (0.18 if near < 10 else 0) + (y - 35) * 0.03
            if v > 0.86: c.P(x, y, K('rust', 2 if h2(x, y, 4) % 4 == 0 else 3))
            elif v > 0.77: c.P(x, y, K('rust', 4))
    bloom(c, 7, 7, 3, on, 1, 0.8, drip=1); bloom(c, 56, 13, 4, on, 2, 0.6, drip=0); bloom(c, 74, 38, 2, on, 4, 0.8)
    bloom(c, 32, 15, 2, on, 3, 0.7); bloom(c, 8, 37, 3, on, 7, 0.8, drip=2); bloom(c, 36, 26, 3, on, 8, 0.8, drip=2)
    ol_soft(c)
    c.shadow([(x, y) for y in (46, 47) for x in range(4 + (y - 46), 77 - (y - 46))])


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
    D = 10
    # 차양 밑 그늘진 뒤 판벽(13..24) + 걸어 둔 물건
    for y in range(13, 25):
        for x in range(4, 44):
            k = (x - 4) % 6
            t = 0 if k == 0 else 2 if k == 1 else 1
            if h2(x, y, 13) % 13 == 0: t += 1
            c.P(x, y, K('wood', t))
    c.line(10, 13, 10, 17, K('metal', 2)); c.R(8, 17, 5, 4, K('metal', 3)); c.HL(8, 17, 5, K('metal', 5)); c.HL(8, 20, 5, K('metal', 1))   # 걸어 둔 함석 통
    c.line(20, 13, 22, 19, K('dry', 2)); c.line(21, 13, 24, 18, K('dry', 3))                 # 매단 밧줄
    c.ell(34, 18, 3, 2, K('rubber', 4)); c.ell(34, 18, 1, 0, K('wood', 1))                   # 걸어 둔 타이어 고리
    c.R(39, 15, 4, 6, K('army', 3)); c.HL(39, 15, 4, K('army', 5))                           # 걸린 천 자루
    for x in (4, 42): c.R(x, 9, 2, 16, K('wood', 2)); c.VL(x, 9, 16, K('wood', 3))           # 뒤 기둥
    # 계산대 앞면(33..45, 13행): 짝 안 맞는 세로 판 · 판 하나는 함석 · 아래 그늘
    boards = [(3, 5, 'wood', 2), (8, 4, 'wood', 3), (12, 6, 'metal', 3), (18, 5, 'wood', 2), (23, 4, 'brust', 3), (27, 6, 'wood', 3), (33, 5, 'wood', 2), (38, 7, 'army', 2)]
    for (x, w, m, t) in boards:
        for i in range(w):
            for y in range(33, 46):
                tt = t + (1 if i == 0 else -1 if i == w - 1 else 0)
                if y == 45: tt = t - 2
                if h2(x + i, y, 4) % 9 == 0: tt -= 1
                c.P(x + i, y, K(m, tt))
    c.HL(3, 39, 42, K('wood', 1))                                                            # 가로 띠장
    c.P(14, 36, K('rust', 3)); c.P(15, 37, K('rust', 4)); c.P(14, 41, K('rust', 3))
    for x in (5, 20, 29, 40): c.P(x, 34, K('metal', 6)); c.P(x, 42, K('metal', 6))
    c.clear(44, 45); c.clear(3, 45)
    # 계산대 윗면(25..32)
    for y in range(15 + D, 23 + D):
        for x in range(3, 45):
            k = (y - 15 - D) % 3
            t = 4 if k != 2 else 3
            if y == 22 + D: t = 4
            if y <= 16 + D: t = 3 if y == 16 + D else 2
            if h2(x, y, 6) % 13 == 0 and 16 + D < y < 22 + D: t -= 1
            c.P(x, y, K('wood', t))
    for (x, y) in ((6, 18), (9, 19), (7, 21)):
        y += D; c.ell(x, y, 1, 0, K('metal', 5)); c.P(x - 1, y, K('metal', 6)); c.P(x + 1, y, K('metal', 3)); c.HL(x - 1, y + 1, 3, K('metal', 2))
    for (x, y, m) in ((13, 18, 'glass'), (14, 21, 'army')):
        y += D; c.HL(x, y, 5, K(m, 3)); c.HL(x, y - 1, 4, K(m, 5)); c.P(x + 5, y, K(m, 2)); c.P(x + 1, y - 1, K(m, 6)); c.HL(x, y + 1, 5, K('wood', 2))
    c.ell(24, 19 + D, 2, 1, K('metal', 4)); c.P(24, 19 + D, K('wood', 3)); c.P(22, 19 + D, K('metal', 6)); c.HL(23, 21 + D, 3, K('wood', 2))
    for (x, y) in ((22, 17), (26, 18), (26, 20), (22, 21)): c.P(x, y + D, K('metal', 3))
    c.ell(31, 19 + D, 2, 1, K('rubber', 4)); c.P(31, 19 + D, K('wood', 3)); c.HL(30, 18 + D, 3, K('rubber', 6)); c.HL(30, 21 + D, 3, K('wood', 2))
    box(c, 35, 16 + D, 6, 3, 2, 'army', tt=4, ft=2, ao=False); c.P(36, 17 + D, K('brick', 4)); c.P(39, 17 + D, K('metal', 6))
    c.line(41, 20 + D, 44, 18 + D, K('rust', 4)); c.line(41, 21 + D, 44, 19 + D, K('rust', 2))
    # 앞 기둥(땅까지)
    for x in (0, 45):
        for y in range(9, 47): c.P(x, y, K('wood', 4)); c.P(x + 1, y, K('wood', 3)); c.P(x + 2, y, K('wood', 1))
    # 차양(0..13) + 앞 가장자리 처진 호(14..16)
    for r in range(14):
        l = int(round(3 * (1 - r / 13)))
        for x in range(l, 48 - l):
            u = x / 47.0
            sag = 1 - abs(u - 0.5) * 2
            t = 3 + (1 if r >= 4 else 0) + (1 if r >= 9 else 0)
            if u < 0.08 or u > 0.92: t += 1
            if sag > 0.5 and r >= 6: t -= 1
            fold = (x + r // 2) % 9
            if fold == 0 and 0 < r < 13: t -= 1
            elif fold == 1 and 0 < r < 13: t += 1
            if r == 0: t = 2
            c.P(x, r, K(tarp, max(1, min(6, t))))
    for x in range(48):
        sag = 1 - abs(x / 47.0 - 0.5) * 2
        d = 1 + (1 if sag > 0.35 else 0) + (1 if sag > 0.8 else 0)
        for j in range(d): c.P(x, 14 + j, K(tarp, 5 if j == 0 else 2))
    for (px, py, pw, ph, m) in ((7, 2, 9, 7, 'army'), (31, 5, 8, 5, 'burlap')):
        for j in range(ph):
            for i in range(pw):
                c.P(px + i, py + j, K(m, 4 + (1 if i < 2 else -1 if i > pw - 3 else 0)))
        c.HL(px, py + ph, pw, K(tarp, 1)); c.VL(px + pw, py, ph + 1, K(tarp, 1))
        for i in range(0, pw, 2): c.P(px + i, py, K(m, 2))
    for (x, y) in ((0, 13), (1, 14), (46, 13), (47, 14)): c.P(x, y, K('dry', 3))
    c.P(19, 8, K('tarp', 1)); c.P(20, 8, K('blue', 1))
    ol_soft(c)
    c.shadow([(x, y) for y in (46, 47) for x in range(3 + (y - 46), 47)])
