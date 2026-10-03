"""사냥터(fld_)·동굴(cav_) 지형 오토타일. 색은 tk.RGB 램프(잠금 팔레트)만 쓴다.

묶음(칸 번호 = 묶음 시작 + ...):
  fld_trail32   짐승길(풀밭 위 흙길) mask16 × 2변형      idx = 16*v + mask
  fld_tall32    키 큰 풀/억새 덩이 mask16 × 2변형(0 풀, 1 억새)
  fld_forest32  숲 바닥(낙엽) mask16 × 2변형
  fld_bog94     늪 가장자리 블롭 47 × 2변형(기존 water47 의 물을 탁한 청록으로)
  fld_rock32    바위산 윗면 mask16 × 2변형 — 남쪽 변은 항상 절벽 앞면에 이어진다(S 비트 = 앞면·바위)
  fld_face16    바위산 앞면 [변형 2][행 2(윗/아랫)][W/E 끝 마스크 4]   idx = 8*v + 4*row + m   (W=1, E=2 가 「이어짐」)
  cav_floor     동굴 바닥 평면 6변형
  cav_floor_lit 동굴 입구쪽 햇빛 든 바닥 4변형
  cav_ceil32    동굴 천장(벽 윗면) mask16 × 2변형 — 바닥과 닿는 변에 밝은 테
  cav_face16    동굴 벽 앞면(천장 밑 2줄) 구조는 fld_face16 과 같다
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
        col = e[4]
        if q < 0.20: col = e[3]
        elif q > 0.92: col = e[5]
        return col

    def fr(x, y, d):
        if d == 1: return e[3] if rnd(x, y, 7) > 0.35 else LF[3]
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
    return {tuple(w[4]): DG[4], tuple(w[5]): DG[5], tuple(w[6]): DG[5]}


def bog_set():
    tb = _bog_table()
    out = []
    for v in range(2):
        for m in WB.ALL47:
            c = _remap(WB.water47(m, v), tb)
            for k in range(2):                              # 개구리밥 2×1(물 한가운데에만)
                x, y = 3 + hsh(k, m + 31 * v, 5) % 9, 3 + hsh(m, k + 7 * v, 6) % 9
                if all(tuple(c.a[y + dy, x + dx, :3]) in (tuple(DG[4]), tuple(RGB['water'][3]), tuple(RGB['water'][2]), tuple(DG[5])) for dx in (0, 1) for dy in (0,)):
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
    if not cave and v == 1:
        for k in range(3):                                          # 균열(어두운 2~3px)과 이끼 점
            x, y = 2 + hsh(k, mask + 13 * v, 41) % 11, 2 + hsh(mask + 13 * v, k, 42) % 11
            if all(ins[y][x + i] for i in range(3)) and all(ins[y + 1][x + i] for i in range(3)):
                c.put(x, y, ST[2]); c.put(x + 1, y, ST[2]); c.put(x + 2, y + 1, ST[2])
        for k in range(2):
            x, y = 2 + hsh(k, mask, 51 + v) % 12, 2 + hsh(mask, k, 52 + v) % 12
            if ins[y][x] and ins[y][x + 1]:
                c.put(x, y, LF[3]); c.put(x + 1, y, LF[2])
    if not cave and v == 0:                                         # 변형 0 은 결만(큰 면적에 같은 균열이 반복되지 않게)
        for k in range(2):
            x, y = 2 + hsh(k, mask, 61) % 12, 2 + hsh(mask, k, 62) % 12
            if ins[y][x] and ins[y][x + 1]:
                c.put(x, y, ER[3]); c.put(x + 1, y, ER[3])
    return c


def face(row, m, v=0, cave=False):
    """앞면 한 칸. row 0 = 윗줄(윗 테두리 하이라이트 + 그늘), row 1 = 아랫줄(밑동·잔돌). m: W=1 / E=2 가 이어짐(없으면 끝 윤곽)."""
    c = Cv(T, T)
    wc, ec = bool(m & 1), bool(m & 2)
    base = (ST[2], ST[3], ST[4]) if cave else (ST[4], ST[3], ST[5])
    for y in range(T):
        for x in range(T):
            q = 0.5 * rnd(x // 2, y, 890 + v + row * 3) + 0.5 * rnd(x, y, 891 + v + row)
            col = base[0]
            if q < 0.3: col = base[1]
            elif q > 0.86: col = base[2]
            # 세로 층리(16주기 가로 줄): 4줄마다 한 단 어두운 켜
            if (y + 2 * row + v) % 8 == 7: col = ST[2] if not cave else ST[1]
            c.put(x, y, col)
    # 세로 균열: 변형마다 다른 자리, 위에서 아래로 2~7px, 한 칸 어긋나며 이어진다
    for k in range(3):
        cx = 2 + (hsh(k, v, 61 + row) % 12)
        cy = hsh(k, v, 62 + row) % 8
        ln = 5 + hsh(k, v, 63) % 4
        for i in range(ln):
            c.put(cx + (1 if i > ln // 2 else 0), (cy + i) % T, ST[1] if not cave else ST[0])
    if row == 0:
        for x in range(T):
            c.put(x, 0, ST[6] if not cave else ST[4]); c.put(x, 1, ST[5] if not cave else ST[3])
            c.put(x, 2, ST[3] if not cave else ST[1]);
            if rnd(x, 3, 5) > 0.5: c.put(x, 3, ST[3] if not cave else ST[1])
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
    out = []
    for v in range(2):
        for row in range(2):
            for m in range(4):
                out.append(face(row, m, v, cave))
    return out


# ---------------------------------------------------------------- 동굴 바닥
def cav_floor(v):
    c = Cv(T, T)
    for y in range(T):
        for x in range(T):
            q = 0.5 * rnd(x // 2, y // 2, 900 + v) + 0.5 * rnd(x, y, 901 + v)
            col = ST[3]
            if q < 0.26: col = ST[2]
            elif q > 0.9: col = ST[4]
            elif 0.5 < q < 0.58: col = ER[2]
            c.put(x, y, col)
    if v % 2:
        for k in range(2):
            x, y = 2 + hsh(k, v, 71) % 11, 2 + hsh(v, k, 72) % 12
            c.put(x, y, ST[4]); c.put(x + 1, y, ST[3]); c.put(x, y + 1, ST[1])
    if v >= 4:                                                   # 갈라진 틈
        x, y = 3 + (v * 3) % 7, 3 + (v * 5) % 6
        for i in range(5): c.put(x + i, y + (i // 2), ST[1])
    return c


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
        'fld_face16': face_set(False),
        'cav_floor': [cav_floor(v) for v in range(6)],
        'cav_floor_lit': [cav_floor_lit(v) for v in range(4)],
        'cav_ceil32': [rock_top(m, v, True) for v in range(2) for m in range(16)],
        'cav_face16': face_set(True),
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
