"""사냥터(fld_)·동굴(cav_) 지형 오토타일. 색은 tk.RGB 램프(잠금 팔레트)만 쓴다.

묶음(칸 번호 = 묶음 시작 + ...):
  fld_trail32   짐승길(풀밭 위 흙길) mask16 × 2변형      idx = 16*v + mask
  fld_tall32    키 큰 풀/억새 덩이 mask16 × 2변형(0 풀, 1 억새)
  fld_forest32  숲 바닥(낙엽) mask16 × 2변형
  fld_bog94     늪 가장자리 블롭 47 × 2변형(기존 water47 의 물을 탁한 청록으로)
  fld_rock32    바위산 윗면 mask16 × 2변형 — 남쪽 변은 항상 절벽 앞면에 이어진다(S 비트 = 앞면·바위)
  fld_rock_in8  바위산 윗면 속 평면 8변형(fld_rock32 의 마스크 15 와 같은 칸으로 본다 — fold)
  fld_face32    바위산 앞면 [단 2(0 땅에 닿는 앞면 / 1 윗단 앞면)][변형 3][행 2(윗/아랫)][W/E 끝 마스크 4]   idx = 24*tier + 8*v + 4*row + m   (W=1, E=2 가 「이어짐」)
  cav_floor     동굴 바닥 평면 6변형
  cav_floor_lit 동굴 입구쪽 햇빛 든 바닥 4변형
  cav_ceil32    동굴 천장(벽 윗면) mask16 × 2변형 — 바닥과 닿는 변에 밝은 테
  cav_face24    동굴 벽 앞면(천장 밑 2줄) 구조는 fld_face32 의 tier 0 과 같다(24칸 = 변형 3 × 줄 2 × 끝 4)
  cav_pool94    지하 못(청색 물, 돌 가장자리) 블롭 47 × 2변형

3/4 시점: 바위산은 윗면 + 정면 벽(앞면 2칸 높이). 동·서 가장자리에는 턱(옆면)을 그리지 않고 윤곽선만 둔다.
mask16 비트: N=1 E=2 S=4 W=8 (1 = 그 이웃이 같은 덩어리).
"""
import math
from tk import *
import water_blob as WB

N, E, S, W = 1, 2, 4, 8
LF, PN, WD, ER, ST, SW = RGB['leaf'], RGB['pine'], RGB['wood'], RGB['earth'], RGB['stone'], RGB['straw']
PL, PS, DB, DG = RGB['plaster'], RGB['persimmon'], RGB['dblue'], RGB['dgreen']


def _J(t, ph, amp):
    """16화소 주기 울퉁불퉁(이웃 칸과 이어진다). 0..2*amp 정수."""
    tp = 2 * math.pi / 16
    v = 0.6 * math.sin(tp * (t + 0.5) + ph) + 0.4 * math.sin(2 * tp * (t + 0.5) + ph * 1.7 + 1.1)
    return int(round(amp * (v + 1)))


def edge_depth(mask, x, y, amp=1.0, ph=0.0):
    """이어지지 않는 변 쪽 바깥 깊이(0 이면 덩어리 안). 울퉁불퉁한 경계 + 둥근 모서리."""
    d = 0
    if not mask & N: d = max(d, _J(x, ph, amp) + 1 - y)
    if not mask & S: d = max(d, _J(x, ph + 1.3, amp) + 1 - (T - 1 - y))
    if not mask & W: d = max(d, _J(y, ph + 2.1, amp) + 1 - x)
    if not mask & E: d = max(d, _J(y, ph + 3.4, amp) + 1 - (T - 1 - x))
    for (a, b, cx, cy) in ((N, W, x, y), (N, E, T - 1 - x, y), (S, W, x, T - 1 - y), (S, E, T - 1 - x, T - 1 - y)):
        if not mask & a and not mask & b and cx + cy < 4:
            d = max(d, 4 - (cx + cy) - 1 if cx + cy < 3 else 1)
    return d


def grass_px(x, y, s=100):
    """바깥 풀 화소(ground.grass 와 같은 분포)."""
    q = rnd(x, y, s)
    if q < 0.20: return LF[3]
    if q > 0.90: return LF[5]
    return LF[4]


def _inside_fn(mask, amp, ph):
    ins = [[edge_depth(mask, x, y, amp, ph) == 0 for x in range(T)] for y in range(T)]

    def at(x, y):
        if 0 <= x < T and 0 <= y < T:
            return ins[y][x]
        if x < 0 and 0 <= y < T: return bool(mask & W)
        if x >= T and 0 <= y < T: return bool(mask & E)
        if y < 0 and 0 <= x < T: return bool(mask & N)
        if y >= T and 0 <= x < T: return bool(mask & S)
        return False
    return ins, at


def patch(mask, interior, fringe, amp=1.0, ph=0.0):
    c = Cv(T, T)
    for y in range(T):
        for x in range(T):
            d = edge_depth(mask, x, y, amp, ph)
            c.put(x, y, interior(x, y) if d == 0 else fringe(x, y, d))
    return c


# ---------------------------------------------------------------- 짐승길
def trail(mask, v=0):
    e = ER

    def inner(x, y):
        q = rnd(x, y, 810 + v)
        col = e[5]                                       # 마당·큰길 흙(ground.yard)과 같은 램프·분포: 길과 마당이 이어져도 색이 튀지 않는다
        if q < 0.18: col = e[4]
        elif q > 0.92: col = e[6]
        return col

    def fr(x, y, d):
        if d == 1: return e[4] if rnd(x, y, 7) > 0.35 else LF[3]
        if d == 2: return LF[3] if rnd(x, y, 8) > 0.3 else LF[2]
        return grass_px(x, y)
    c = patch(mask, inner, fr, amp=1.1, ph=0.4)
    ins, at = _inside_fn(mask, 1.1, 0.4)
    for y in range(T):                                     # 길 안쪽 가장자리로 삐져나온 풀잎(2px 세로)
        for x in range(T):
            if ins[y][x] and rnd(x, y, 21 + v) < 0.16 and any(not at(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, -1), (0, 1))):
                c.put(x, y, LF[4]); c.put(x, y - 1, LF[5]) if y > 0 and ins[y - 1][x] else None
    for k in range(2):                                     # 자갈
        x, y = 2 + hsh(k, mask + 17 * v, 3) % 11, 2 + hsh(mask + 17 * v, k, 4) % 11
        if ins[y][x] and ins[y][x + 1]:
            c.put(x, y, ST[4]); c.put(x + 1, y, ST[3])
    if v == 1 and (mask & (E | W)):                        # 발굽·발자국(2px 점 쌍)
        for x in (4, 10):
            y = 6 + (x % 4)
            if ins[y][x] and ins[y][x + 1]:
                c.put(x, y, e[2]); c.put(x + 1, y, e[2])
    return c


# ---------------------------------------------------------------- 키 큰 풀 / 억새
def _blade(c, x, y0, ln, silver=False):
    """위로 자라는 풀잎(torus: 타일 둘레로 감겨 이웃 칸과 이어진다). 밑 어두움 → 끝 밝음, 왼쪽 옆줄 그늘."""
    for k in range(ln):
        yy = (y0 - k) % T
        tone = LF[3] if k < ln // 2 else (LF[5] if k < ln - 1 else LF[6])
        c.a[yy, x % T, :3] = tone; c.a[yy, x % T, 3] = 255
        sh = LF[2]
        c.a[yy, (x + 1) % T, :3] = sh if k < ln - 1 else LF[4]; c.a[yy, (x + 1) % T, 3] = 255


def tall(mask, v=0):
    def inner(x, y):
        q = rnd(x, y, 830 + v)
        return LF[3] if q < 0.4 else (LF[4] if q < 0.93 else LF[2])

    def fr(x, y, d):
        if d == 1: return LF[3] if rnd(x, y, 5) > 0.3 else LF[2]
        return grass_px(x, y)
    base = patch(mask, inner, fr, amp=2.0, ph=1.0)
    ins, at = _inside_fn(mask, 2.0, 1.0)
    lay = Cv(T, T)
    lay.a[:, :, :3] = base.a[:, :, :3]; lay.a[:, :, 3] = 255
    for k in range(9):                                      # 풀잎 무리
        bx, by = hsh(k, v, 1) % 16, hsh(k, v, 2) % 16
        ln = 4 + hsh(k, v, 3) % 3
        _blade(lay, bx, by, ln)
    if v == 1:                                              # 억새 이삭: 짚색 줄기 위에 흰 이삭
        for k in range(3):
            bx, by = 2 + hsh(k, 5, 9) % 12, 7 + hsh(k, 6, 9) % 8
            for j in range(6):
                lay.a[(by - j) % T, bx % T, :3] = SW[6] if j % 2 else ER[5]
            for j, (dx, tone) in enumerate(((0, PL[5]), (0, PL[4]), (1, PL[4]), (0, PL[3]), (-1, PL[3]))):
                lay.a[(by - 6 - (j + 1) // 2) % T, (bx + dx) % T, :3] = tone
            lay.a[(by - 8) % T, bx % T, :3] = PL[6]
    out = Cv(T, T)
    for y in range(T):                                      # 풀잎은 덩어리 안에서만(바깥 풀 위로는 안 그린다)
        for x in range(T):
            inside = ins[y][x]
            out.put(x, y, tuple(lay.a[y, x, :3]) if inside else tuple(base.a[y, x, :3]))
    return out


# ---------------------------------------------------------------- 숲 바닥(낙엽)
def forest(mask, v=0):
    def inner(x, y):
        q = rnd(x, y, 850 + v)
        col = PN[3]
        if q < 0.25: col = LF[2]
        elif q > 0.9: col = PN[4]
        return col

    def fr(x, y, d):
        if d == 1: return LF[2] if rnd(x, y, 5) > 0.4 else LF[3]
        return grass_px(x, y)
    c = patch(mask, inner, fr, amp=1.8, ph=2.0)
    ins, at = _inside_fn(mask, 1.8, 2.0)
    for k in range(7):                                      # 낙엽 2×1 덩이
        x, y = hsh(k, v, 11) % 14, hsh(k, v, 12) % 15
        col = (ER[3], SW[2], SW[1], ER[3], ER[4])[hsh(k, v, 13) % 5]
        if ins[y][x] and ins[y][x + 1]:
            c.put(x, y, col); c.put(x + 1, y, col)
            if y + 1 < T and ins[y + 1][x]: c.put(x, y + 1, SW[1] if col != SW[1] else ER[2])
    for k in range(2):                                      # 잔가지(3px 사선)
        x, y = 1 + hsh(k, v, 21) % 11, 1 + hsh(k, v, 22) % 12
        if all(ins[y + i][x + i] for i in range(3)):
            for i in range(3): c.put(x + i, y + i, ER[2])
    return c


# ---------------------------------------------------------------- 늪
def _remap(tile_cv, table):
    o = Cv(T, T)
    o.a = tile_cv.a.copy()
    for y in range(T):
        for x in range(T):
            if o.a[y, x, 3]:
                k = tuple(int(q) for q in o.a[y, x, :3])
                if k in table:
                    o.a[y, x, :3] = table[k]
    return o


def _bog_table():
    w = RGB['water']
    return {tuple(w[2]): DG[3], tuple(w[3]): DG[4], tuple(w[4]): DG[4], tuple(w[5]): DG[5], tuple(w[6]): DG[5]}      # 물 한 단 밝게(검수: 늪물이 너무 어둡다)


def bog_set():
    tb = _bog_table()
    out = []
    for v in range(2):
        for m in WB.ALL47:
            c = _remap(WB.water47(m, v), tb)
            for k in range(2):                              # 개구리밥 2×1(물 한가운데에만, 칸마다 확률로: 격자처럼 안 보이게)
                if hsh(k, m + 5 * v, 41) % 3: continue
                x, y = 3 + hsh(k, m + 31 * v, 5) % 9, 3 + hsh(m, k + 7 * v, 6) % 9
                if all(tuple(c.a[y + dy, x + dx, :3]) in (tuple(DG[4]), tuple(DG[3]), tuple(RGB['water'][3]), tuple(RGB['water'][2]), tuple(DG[5])) for dx in (0, 1) for dy in (0,)):
                    c.put(x, y, LF[3]); c.put(x + 1, y, LF[4])
            out.append(c)
    return out


def pool_set():
    w, e = RGB['water'], ER
    tb = {tuple(w[4]): DB[4], tuple(w[5]): DB[5], tuple(w[6]): DB[5]}
    for i, t in ((2, 2), (3, 3), (4, 3), (5, 4), (6, 5)):
        tb[tuple(e[i])] = ST[t]
    for i, t in ((2, 1), (3, 2), (4, 3), (5, 4), (6, 5)):
        tb[tuple(LF[i])] = ST[t]
    return [_remap(WB.water47(m, v), tb) for v in range(2) for m in WB.ALL47]


# ---------------------------------------------------------------- 바위산(윗면 + 앞면)
def _rock_top_tone(x, y, v, cave):
    q = 0.55 * rnd(x // 2, y // 2, 870 + v) + 0.45 * rnd(x, y, 871 + v)
    if cave:
        return ST[1] if q < 0.62 else (ST[2] if q < 0.95 else ST[0])
    if q < 0.28: return ST[3]
    if q > 0.86: return ST[5]
    return ST[4]


def rock_top(mask, v=0, cave=False):
    amp = 0.8 if not cave else 0.6

    def inner(x, y):
        return _rock_top_tone(x, y, v, cave)

    def fr(x, y, d):
        if cave:
            q = rnd(x, y, 880)
            return ST[3] if q > 0.25 else ST[2]
        if d == 1 and rnd(x, y, 9) > 0.15: return LF[2]            # 땅 그림자
        return grass_px(x, y)
    c = patch(mask, inner, fr, amp=amp, ph=3.0)
    ins, at = _inside_fn(mask, amp, 3.0)
    for y in range(T):                                              # 윤곽(안쪽 1줄) + 빛 받은 안쪽 한 줄
        for x in range(T):
            if not ins[y][x]:
                continue
            nb = {k: not at(x + dx, y + dy) for k, (dx, dy) in (('n', (0, -1)), ('s', (0, 1)), ('w', (-1, 0)), ('e', (1, 0)))}
            if any(nb.values()):
                c.put(x, y, ST[0] if not cave else ST[3] if (nb['n'] or nb['w']) else ST[2])
                if cave:                                            # 천장 테: 바닥에 닿는 변이 밝다
                    c.put(x, y, ST[4] if (nb['n'] or nb['w']) else ST[3])
                continue
            # 안쪽 둘째 줄
            nb2 = {k: not at(x + 2 * dx, y + 2 * dy) for k, (dx, dy) in (('n', (0, -1)), ('s', (0, 1)), ('w', (-1, 0)), ('e', (1, 0)))}
            if cave:
                if nb2['n'] or nb2['w']: c.put(x, y, ST[3])
                elif nb2['e'] or nb2['s']: c.put(x, y, ST[1])
            else:
                if nb2['n'] or nb2['w']: c.put(x, y, ST[5])
                elif nb2['e']: c.put(x, y, ST[3])
    if not cave and v % 3 == 1:
        for k in range(3):                                          # 균열(어두운 2~3px)과 이끼 점
            x, y = 2 + hsh(k, mask + 13 * v, 41) % 11, 2 + hsh(mask + 13 * v, k, 42) % 11
            if all(ins[y][x + i] for i in range(3)) and all(ins[y + 1][x + i] for i in range(3)):
                c.put(x, y, ST[2]); c.put(x + 1, y, ST[2]); c.put(x + 2, y + 1, ST[2])
        for k in range(2):
            x, y = 2 + hsh(k, mask, 51 + v) % 12, 2 + hsh(mask, k, 52 + v) % 12
            if ins[y][x] and ins[y][x + 1]:
                c.put(x, y, LF[3]); c.put(x + 1, y, LF[2])
    if not cave and v % 3 == 0:                                     # 변형 0 은 결만(큰 면적에 같은 균열이 반복되지 않게)
        for k in range(2):
            x, y = 2 + hsh(k, mask, 61) % 12, 2 + hsh(mask, k, 62) % 12
            if ins[y][x] and ins[y][x + 1]:
                c.put(x, y, ER[3]); c.put(x + 1, y, ER[3])
    return c


def face(row, m, v=0, cave=False, tier=False):
    """앞면 한 칸. row 0 = 윗줄(윗 테두리 하이라이트 + 그늘), row 1 = 아랫줄(밑동·잔돌). m: W=1 / E=2 가 이어짐(없으면 끝 윤곽)."""
    c = Cv(T, T)
    wc, ec = bool(m & 1), bool(m & 2)
    base = (ST[2], ST[3], ST[4]) if cave else (ST[4], ST[3], ST[5])
    # 세로 줄무늬 바위결: 16주기로 이어지는 폭 2~5px 기둥, 기둥마다 밝기가 다르고 위아래로 끊겨 어긋난다
    edges = [0]
    while edges[-1] < T:
        edges.append(edges[-1] + 2 + hsh(len(edges), v, 55) % 4)
    edges[-1] = T
    band = [0] * T
    for i in range(len(edges) - 1):
        off = (hsh(i, v, 56) % 3) - 1
        for x in range(edges[i], edges[i + 1]):
            band[x] = off
    for y in range(T):
        for x in range(T):
            q = rnd(x, y // 2 + 3 * row, 890 + v)
            col = base[0]
            if band[x] < 0 or (band[x] == 0 and q < 0.3): col = base[1]
            elif band[x] > 0 and q > 0.72: col = base[2]
            elif q > 0.96: col = base[2]
            if x in edges[1:-1] and rnd(x, y // 3, 57 + v) < 0.7:     # 기둥 사이 어두운 틈(끊겼다 이어진다)
                col = ST[2] if not cave else ST[1]
            c.put(x, y, col)
    # 비스듬한 균열(2px 사선) 한두 개
    for k in range(2):
        cx = 2 + hsh(k, v, 61 + row) % 11
        cy = hsh(k, v, 62 + row) % 9
        for i in range(5):
            c.put(cx + i // 2, (cy + i) % T, ST[1] if not cave else ST[0])
    if row == 0:
        for x in range(T):
            c.put(x, 0, ST[6] if not cave else ST[4]); c.put(x, 1, ST[5] if not cave else ST[3])
            c.put(x, 2, ST[3] if not cave else ST[1]);
            if rnd(x, 3, 5) > 0.5: c.put(x, 3, ST[3] if not cave else ST[1])
    elif tier:                                                      # 윗단 앞면의 밑동: 아랫단 바위 윗면에 닿는다(풀이 아니라 그늘 띠 + 잔돌)
        for x in range(T):
            j = _J(x, 1.1, 1.0)
            for y in range(13 - j + 1, T):
                c.put(x, y, ST[2] if y < T - 1 else ST[1])
            if rnd(x, 9, 4) > 0.8:
                c.put(x, 12 - j + 1, ST[4]); c.put(x, 13 - j + 1, ST[3])
    else:
        for x in range(T):                                          # 밑동: 어두운 띠 + 풀/잔돌
            j = _J(x, 1.1, 1.4)
            top = 13 - j + 1
            for y in range(top, T):
                if cave:
                    c.put(x, y, ST[1] if y < T - 1 else ST[0])
                elif y >= top + 1 and rnd(x, y, 17) > 0.45:
                    c.put(x, y, LF[3] if rnd(x, y, 19) > 0.4 else LF[2])
                else:
                    c.put(x, y, ST[2] if y < T - 1 else ST[1])
            if not cave and rnd(x, 7, 3) > 0.8:
                c.put(x, top - 1, ST[2])
    # 좌우 끝: 윤곽(안쪽) + 빛 받는 왼쪽 가장자리 한 줄
    if not wc:
        for y in range(T):
            c.put(0, y, ST[0] if not cave else ST[1]); c.put(1, y, ST[5] if not cave else ST[3])
        c.put(0, 0 if row == 0 else 0, ST[0]);
    if not ec:
        for y in range(T):
            c.put(T - 1, y, ST[0] if not cave else ST[0]); c.put(T - 2, y, ST[2] if not cave else ST[1])
    return c


def face_set(cave=False):
    """idx = 24*tier + 8*v + 4*row + m  (tier 1 = 윗단 앞면: 밑동이 아랫단 바위 윗면에 닿는다. 동굴은 tier 없음)."""
    out = []
    for tier in ((False,) if cave else (False, True)):
        for v in range(3):
            for row in range(2):
                for m in range(4):
                    out.append(face(row, m, v, cave, tier))
    return out


# ---------------------------------------------------------------- 동굴 바닥
def _blot(x, y, v, sc, s):
    """저주파 얼룩 0..1 (이웃 칸과 상관 없이 칸 안에서만: 변형 v 마다 다른 자리)."""
    return 0.5 * rnd(x // sc + v, y // sc + 3 * v, s) + 0.5 * rnd((x + 2 * v) // (sc + 1), (y + v) // (sc + 1), s + 7)


def cav_floor(v):
    """동굴 바닥 10변형. 바탕은 같은 중간 돌색(ST[3])에 어두운 얼룩(ST[2])만 살짝 — 변형끼리 밝기 차를 줄여 칸이 바둑판처럼 보이지 않게 하고,
    변형 차이는 드문 잔돌·균열·젖은 자국 같은 작은 표시로만 둔다(0·5 평범 / 1·6 잔돌 / 2·7 젖은 자국 / 3·8 균열 / 4·9 낱알)."""
    c = Cv(T, T)
    kind = v % 5
    for y in range(T):
        for x in range(T):
            q = _blot(x, y, v, 6, 900 + v)
            col = ST[3]
            if q < 0.30: col = ST[2] if rnd(x, y, 902 + v) > 0.35 else ST[3]
            if rnd(x, y, 901 + v) > 0.975: col = ST[2]
            c.put(x, y, col)
    if kind == 1:
        for k in range(2):
            x, y = 2 + hsh(k, v, 71) % 11, 2 + hsh(v, k, 72) % 11
            c.put(x, y, ST[4]); c.put(x + 1, y, ST[3]); c.put(x, y + 1, ST[2]); c.put(x + 1, y + 1, ST[2])
    elif kind == 2:
        x, y = 3 + (v * 3) % 7, 3 + (v * 5) % 7
        for dx, dy in ((0, 0), (1, 0), (2, 0), (3, 1), (1, 1), (2, 1)): c.put(x + dx, y + dy, ST[2])
    elif kind == 3:
        x, y = 2 + (v * 3) % 6, 3 + (v * 5) % 7
        for i in range(7):
            c.put(x + i, y + (i // 3), ST[1])
    elif kind == 4:
        for k in range(4):
            x, y = hsh(k, v, 73) % 15, hsh(v, k, 74) % 15
            c.put(x, y, ST[4]) if k == 0 else c.put(x, y, ST[2])
    return c


_DARK1 = {}
_DARK2 = {}


def _shade_tables():
    if not _DARK1:
        for a, b, d in ((ST[4], ST[3], ST[2]), (ST[3], ST[2], ST[1]), (ST[2], ST[1], ST[0]), (ER[2], ST[1], ST[0]), (ST[1], ST[0], ST[0])):
            _DARK1[tuple(a)] = b; _DARK2[tuple(a)] = d
    return _DARK1, _DARK2


def cav_floor_sh(base, bits):
    """벽 그림자가 드리운 바닥 한 칸. bits: 1=북쪽이 벽(앞면 밑동) 2=서쪽이 벽 4=북서 대각만 벽. 빛이 왼쪽 위라 그림자는 벽의 오른쪽·아래 바닥에 진다."""
    d1, d2 = _shade_tables()
    c = Cv(T, T)
    c.a = base.a.copy()
    for y in range(T):
        for x in range(T):
            depth = 0
            if bits & 1: depth = max(depth, 3 - y)            # 위 3줄: 가장 위 두 줄 진하게
            if bits & 2: depth = max(depth, 2 - x)            # 왼 2줄
            if bits & 4 and not bits & 3: depth = max(depth, 3 - int(math.hypot(x + 0.5, y + 0.5)))
            if depth <= 0: continue
            k = tuple(int(q) for q in c.a[y, x, :3])
            tb = d2 if depth >= 2 else d1
            if k in tb:
                c.a[y, x, :3] = tb[k]
    return c


def roof47(m8, v=0):
    """동굴 천장(벽 윗면) 한 칸: 이웃 8칸(1 = 천장·벽 이어짐)으로 정해지는 47종 블롭. 열린 바닥 쪽은 바깥 1px 바닥 그림자 → 밝은 테(위·왼쪽 변, 빛 받음)/어두운 테(오른쪽·아래) → 안쪽 암반.
    변형 0·1 평범, 2·3 이끼, 4·5 광맥(푸른 결정 점) — 맵이 구역별로 섞어 넓은 암반이 한 가지 무늬로 반복되지 않게 한다. 모서리는 water_blob 의 사분면 거리로 둥글게."""
    m = WB.canon(m8)
    c = Cv(T, T)
    tt = [[0.0] * T for _ in range(T)]
    lit = [[False] * T for _ in range(T)]
    for y in range(T):
        for x in range(T):
            right, bottom = x >= 8, y >= 8
            px, py = x + 0.5, y + 0.5
            d = WB._dist(px, py, m, right, bottom)
            tt[y][x] = d + WB._wob(x, y) * 0.8 if d < WB.CAP else d
            gx = (WB._dist(px + 1, py, m, right, bottom) - WB._dist(px - 1, py, m, right, bottom)) / 2
            gy = (WB._dist(px, py + 1, m, right, bottom) - WB._dist(px, py - 1, m, right, bottom)) / 2
            lit[y][x] = (gy > 0.4 and gy >= abs(gx) * 0.5) or (gx > 0.4 and gx >= abs(gy) * 0.5)      # 열린 바닥이 위·왼쪽
    for y in range(T):
        for x in range(T):
            t = tt[y][x]
            q = _blot(x, y, v, 4, 940 + v)
            qn = rnd(x, y, 950 + v * 5 + m)
            if t < 1.0:
                col = ST[2] if qn > 0.2 else ST[1]                                  # 바깥(바닥 그림자)
            elif t < 2.3:
                col = (ST[5] if qn > 0.35 else ST[4]) if lit[y][x] else (ST[3] if qn > 0.3 else ST[2])
            elif t < 4.0:
                col = (ST[4] if qn > 0.5 else ST[3]) if lit[y][x] else (ST[2] if qn > 0.3 else ST[1])
            elif t < 5.2:
                col = ST[3] if (lit[y][x] and qn > 0.45) else (ST[2] if qn > 0.35 else ST[1])
            else:
                col = ST[1]                                                          # 안쪽 암반(대비 낮게: 얼룩 ST[2]·ST[0] 은 드물게)
                if q < 0.22: col = ST[2] if qn > 0.4 else ST[1]
                elif q > 0.86: col = ST[0] if qn > 0.4 else ST[1]
                if qn > 0.985: col = ST[2]
                elif qn < 0.012: col = ST[0]
            c.put(x, y, col)
    if v >= 2:
        for k in range(3 if v < 4 else 2):
            x, y = 3 + hsh(k, m + 11 * v, 91) % 10, 3 + hsh(m, k + 7 * v, 92) % 10
            if tt[y][x] > 5.4 and tt[y][x + 1] > 5.4:
                if v < 4:
                    c.put(x, y, PN[3]); c.put(x + 1, y, PN[2]); c.put(x, y - 1, PN[2]) if tt[y - 1][x] > 5.4 else None   # 이끼 점
                else:
                    c.put(x, y, DB[5]); c.put(x + 1, y, DB[4]); c.put(x, y + 1, DB[3]) if tt[y + 1][x] > 5.4 else None   # 광맥
    return c


def roof47_set(variants=6):
    return [roof47(m, v) for v in range(variants) for m in WB.ALL47]


def cav_floor_lit(v):
    """입구쪽: 밖의 흙과 풀이 섞여 들어온 따뜻한 바닥."""
    c = Cv(T, T)
    for y in range(T):
        for x in range(T):
            q = rnd(x, y, 920 + v)
            col = ER[3]
            if q < 0.22: col = ER[2]
            elif q > 0.88: col = ER[4]
            c.put(x, y, col)
    for k in range(2 + v % 2):
        x, y = 1 + hsh(k, v, 81) % 13, 1 + hsh(v, k, 82) % 13
        c.put(x, y, LF[3]); c.put(x, y - 1, LF[4])
    return c


def terrain():
    return {
        'fld_trail32': [trail(m, v) for v in range(2) for m in range(16)],
        'fld_tall32': [tall(m, v) for v in range(2) for m in range(16)],
        'fld_forest32': [forest(m, v) for v in range(2) for m in range(16)],
        'fld_bog94': bog_set(),
        'fld_rock32': [rock_top(m, v) for v in range(2) for m in range(16)],
        'fld_rock_in8': [rock_top(15, 10 + i) for i in range(8)],            # 윗면 속(마스크 15) 변형 8: 큰 덩어리가 같은 무늬로 반복되지 않게(fold)
        'fld_face32': face_set(False),
        'cav_floor': [cav_floor(v) for v in range(10)],
        'cav_floor_sh': [cav_floor_sh(cav_floor(v), bits) for v in range(5) for bits in range(8)],
        'cav_floor_lit': [cav_floor_lit(v) for v in range(4)],
        'cav_roof47': roof47_set(6),
        'cav_face24': face_set(True),
        'cav_pool94': pool_set(),
    }


def preview(path, scale=3):
    """검수용 시트: 묶음마다 칸 줄 + 실제 사용 예(작은 지도)."""
    from PIL import Image
    t = terrain()
    names = list(t)
    cols = 16
    rows = sum((len(t[n]) + cols - 1) // cols + 1 for n in names)
    im = Image.new('RGBA', (cols * T * scale, rows * T * scale), (30, 30, 30, 255))
    r = 0
    for n in names:
        for i, c in enumerate(t[n]):
            im.alpha_composite(c.img().resize((T * scale, T * scale), Image.NEAREST), ((i % cols) * T * scale, (r + i // cols) * T * scale))
        r += (len(t[n]) + cols - 1) // cols + 1
    im.convert('RGB').save(path)


if __name__ == '__main__':
    import sys
    preview(sys.argv[1] if len(sys.argv) > 1 else '/tmp/fld/terrain.png')
    print('violations', len(VIOLATIONS), list(VIOLATIONS.items())[:5])
