"""조선 궁 내부 구조 키트 (접두 pal_): 전돌 바닥·단청 천장·궁 벽면·궁 쌍문·단청 기둥·단청 보·어좌 단·어도 카펫·난간.

실내 후보 B 의 평면 유도 방식(inb_room.py·inb_map.py)을 그대로 쓴다 — 벽을 손으로 칠하지 않고 평면에서 벽면 2줄·천장 띠·바닥 그늘을 유도한다.
후보 B 키트(in_b_*)와 같은 칸 규격(벽면 1×2, 천장 블롭 47, 바닥 4변형 + 그늘 3변형)이라 방 조립기에서 이름 접두만 바꿔 쓴다.
궁은 단청(청·적·녹) 띠와 붉은 칠 기둥이 사가(후보 B)와 다른 점이다. 색은 tk.RGB 램프로만 고른다(팔레트 잠금).
"""
from inb_tk import *
import water_blob as WB
import inb_kit as IK

# ----------------------------------------------------------------------------------------------------- 바닥: 전돌
FLOORS = ('jeon', 'slab', 'ondol')


def _jeon(v):
    """궁궐 전돌 바닥: 8px 네모 벽돌을 줄눈 1px 로 깐다. 푸른 회색, 아주 낮은 대비(바닥은 조용해야 가구가 읽힌다 — 큰 홀에서 벽돌 하이라이트가 반복 무늬로 읽혀 뺐다)."""
    cv = Cv(T, T)
    for y in range(T):
        for x in range(T):
            q = rnd(x // 2, y // 2, 710 + v)
            c = GI[4]
            if q < 0.08: c = GI[3]
            elif q > 0.96: c = GI[5]
            cv.put(x, y, c)
    for k in (7, 15):                                        # 줄눈 한 줄(한 단 어둡게)
        for x in range(T):
            cv.put(x, k, GI[3])
        for y in range(T):
            cv.put(k, y, GI[3])
    return cv


def _slab(v):
    """궁 곁 마당 판석: 푸른 전돌과 다른 따뜻한 회색 큰 판(16px 한 장), 오른쪽·아래 이음, 판마다 결이 다르다(구역 바닥 변화)."""
    cv = Cv(T, T)
    for y in range(T):
        for x in range(T):
            q = rnd(x // 3, y // 2, 740 + v)
            c = ST[4]
            if q < 0.12: c = ST[3]
            elif q > 0.93: c = ST[5]
            cv.put(x, y, c)
    for k in range(2):                                       # 판 안 잔 금(짧은 두 줄)
        x0, y0 = hsh(k, v, 41) % 9, 2 + hsh(v, k, 43) % 10
        for i in range(4):
            cv.put(x0 + i, y0 + (i // 2), ST[3])
    for i in range(T):
        cv.put(i, 15, ST[2]); cv.put(15, i, ST[2])
    return cv


def _ondol2(v):
    """궁 온돌 장판: 이음선 없이 이어지는 기름먹인 한지 결(칸마다 결 위치만 달라 격자가 읽히지 않는다)."""
    cv = Cv(T, T)
    e = ER
    for y in range(T):
        for x in range(T):
            q = rnd(x, y, 750 + v)
            c = e[5]
            if q < 0.04: c = e[4]
            elif q > 0.985: c = e[6]
            cv.put(x, y, c)
    for k in range(3):                                       # 가로 결 2~3가닥(타일 가장자리를 넘지 않고 칸마다 위치가 다르다)
        x0, y0 = hsh(k, v, 61) % 8, 1 + hsh(v, k, 63) % 14
        for i in range(5 + (k + v) % 3):
            cv.put(x0 + i, y0, e[4] if (k + v) % 2 else e[6])
    return cv


def floor_sets():
    out = {}
    for name, fn in (('jeon', _jeon), ('slab', _slab), ('ondol', _ondol2)):
        base = [fn(v) for v in range(4)]
        out['pal_' + name] = base
        out['pal_%s_sh' % name] = [IK._shade(base[0], 'n'), IK._shade(base[1], 'w'), IK._shade(base[2], 'nw')]
    return out


# ----------------------------------------------------------------------------------------------------- 천장: 단청 띠
def _dan_band(along, d):
    """천장 띠 바깥 → 안: d=1 단청 띠(청·적·녹 마디, 8px), d=2 안쪽 선(어두운 적갈)."""
    if d == 1:
        k = (along // 4) % 4
        return (DG[4], RD[4], DB[4], RD[4])[k] if (along % 4) < 3 else PL[5]
    return RD[2] if (along % 8) < 6 else RD[1]


def _ceil(mask):
    cv = Cv(T, T)
    g = GI
    N_, E_, S_, W_ = (bool(mask & b) for b in (WB.N, WB.E, WB.S, WB.W))
    c_ne = bool(mask & WB.NE); c_se = bool(mask & WB.SE); c_sw = bool(mask & WB.SW); c_nw = bool(mask & WB.NW)
    for y in range(T):
        for x in range(T):
            base = g[0] if ((x // 2 + y // 2) % 2 == 0) else g[1]
            d = 99
            along = 0
            if not N_ and y < d: d, along = y, x
            if not S_ and (T - 1 - y) < d: d, along = T - 1 - y, x
            if not W_ and x < d: d, along = x, y
            if not E_ and (T - 1 - x) < d: d, along = T - 1 - x, y
            for open_, (cx, cy) in ((not c_ne and N_ and E_, (T - 1, 0)), (not c_se and S_ and E_, (T - 1, T - 1)),
                                    (not c_sw and S_ and W_, (0, T - 1)), (not c_nw and N_ and W_, (0, 0))):
                if open_:
                    dd = max(abs(x - cx), abs(y - cy))
                    if dd < d: d, along = dd, x + y
            if d == 0:
                c = RD[1]
            elif d in (1, 2):
                c = _dan_band(along, d)
            else:
                c = base
            cv.put(x, y, c)
    return cv


def ceil47():
    return [_ceil(m) for m in WB.ALL47]


# ----------------------------------------------------------------------------------------------------- 벽면 1×2
KINDS = ('gung', 'gungho')
ENDS = ('m', 'l', 'r', 'lr')


def _dan_beam(cv, x0, x1, seed=0):
    """벽 위 창방(5줄): 단청 띠. 가는 선 + 청·적·녹 마디(8px 주기) + 밑 선."""
    cv.hl(x0, x1, 0, RD[1])
    for x in range(x0, x1):
        k = ((x + seed * 4) // 4) % 4
        top = (DG[5], RD[5], DB[5], RD[5])[k]
        mid = (DG[4], RD[4], DB[4], RD[4])[k]
        cv.put(x, 1, top)
        cv.put(x, 2, mid if (x % 4) < 3 else PL[5])
        cv.put(x, 3, (DG[3], RD[3], DB[3], RD[3])[k])
    cv.hl(x0, x1, 4, RD[1])


def _red_posts(cv, ends):
    """붉은 칠 기둥(벽 끝): 왼쪽 밝음 → 오른쪽 어두움. 위 3px 는 단청 머리 흔적."""
    if 'l' in ends:
        cv.vl(0, 0, 32, RD[1]); cv.vl(1, 5, 32, RD[5]); cv.vl(2, 5, 32, RD[4]); cv.vl(3, 5, 32, RD[3])
    if 'r' in ends:
        cv.vl(12, 5, 32, RD[5]); cv.vl(13, 5, 32, RD[4]); cv.vl(14, 5, 32, RD[3]); cv.vl(15, 0, 32, RD[1])


def _stone_base(cv, y0=26):
    """궁궐 기단 걸레받이: 돌 층 6줄."""
    cv.hl(0, T, y0, ST[6]); cv.hl(0, T, y0 + 1, ST[5]); cv.hl(0, T, y0 + 2, ST[5])
    cv.hl(0, T, y0 + 3, ST[4]); cv.hl(0, T, y0 + 4, ST[3]); cv.hl(0, T, y0 + 5, ST[1])


def wall_face(kind, ends='m', seed=0):
    cv = Cv(T, 2 * T)
    if kind == 'gung':                              # 회벽 + 붉은 인방
        for y in range(5, 26):
            for x in range(T):
                q = rnd(x, y, 810 + seed)
                tone = 5 if y < 17 else 4
                c = PL[tone]
                if q < 0.09: c = PL[tone - 1]
                elif q > 0.96: c = PL[min(6, tone + 1)]
                cv.put(x, y, c)
        cv.hl(0, T, 17, RD[4]); cv.hl(0, T, 18, RD[2])                      # 붉은 중방(가운데 가로 띠)
        cv.hl(0, T, 16, PL[6])
        _dan_beam(cv, 0, T); _stone_base(cv)
    elif kind == 'gungho':                          # 붉은 틀 한지 격자 창호벽
        for y in range(5, 27):
            for x in range(T):
                q = rnd(x, y, 830 + seed)
                cv.put(x, y, PL[6] if q > 0.9 else (PL[5] if q > 0.14 else PL[4]))
        for x in (3, 7, 11):
            cv.vl(x, 8, 25, RD[3])
        for y in (11, 16, 21):
            cv.hl(1, 15, y, RD[3])
        cv.rect(0, 5, 16, 8, RD[4]); cv.hl(0, T, 5, RD[5]); cv.hl(0, T, 7, RD[2])       # 윗 인방
        cv.rect(0, 25, 16, 27, RD[4]); cv.hl(0, T, 25, RD[5])                             # 아랫 인방
        cv.vl(0, 5, 27, RD[4]); cv.vl(1, 5, 27, RD[3]); cv.vl(14, 5, 27, RD[3]); cv.vl(15, 5, 27, RD[2])
        _dan_beam(cv, 0, T, 1); _stone_base(cv, 27)
        cv.hl(0, T, 27, ST[6])
    _red_posts(cv, ends)
    return cv


# ---- 궁 쌍문(방으로 드는 창호문 쌍)
def door_gung(side, open_=False):
    """쌍여닫이 한 쪽(2칸 폭의 왼쪽 'l' / 오른쪽 'r'): 붉은 틀 + 빗살 한지 + 놋쇠 고리 + 단청 윗 창방. 열림은 안쪽 어둠."""
    cv = Cv(T, 2 * T)
    _dan_beam(cv, 0, T)
    cv.hl(0, T, 5, RD[5]); cv.hl(0, T, 6, RD[3])                           # 문 윗틀
    for y in range(7, 27):
        for x in range(T):
            q = rnd(x, y, 850)
            cv.put(x, y, PL[6] if q > 0.9 else (PL[5] if q > 0.15 else PL[4]))
    for x in (4, 8, 12):                                                   # 세로 살
        cv.vl(x, 7, 27, RD[3])
    for y in (11, 16, 21):                                                 # 가로 살
        cv.hl(0, T, y, RD[3])
    if side == 'l':
        cv.vl(0, 5, 29, RD[1]); cv.vl(1, 5, 29, RD[5]); cv.vl(2, 5, 29, RD[4]); cv.vl(14, 5, 29, RD[3]); cv.vl(15, 5, 29, RD[2])
    else:
        cv.vl(0, 5, 29, RD[5]); cv.vl(1, 5, 29, RD[3]); cv.vl(13, 5, 29, RD[5]); cv.vl(14, 5, 29, RD[3]); cv.vl(15, 5, 29, RD[1])
    cv.hl(0, T, 27, RD[4]); cv.hl(0, T, 28, RD[3])
    hx = 12 if side == 'l' else 3                                          # 놋쇠 둥근 손잡이(맞닿는 쪽)
    cv.rect(hx, 15, hx + 2, 19, BR_[5]); cv.put(hx, 15, BR_[6]); cv.put(hx + 1, 18, BR_[3])
    cv.hl(0, T, 29, ST[6]); cv.hl(0, T, 30, ST[5]); cv.hl(0, T, 31, ST[2])         # 돌 문턱
    if open_:
        x0, x1 = (8, 15) if side == 'l' else (1, 8)
        for y in range(7, 27):
            for x in range(x0, x1):
                cv.put(x, y, GI[0] if ((x + y) % 2 == 0) else GI[1])
        edge = x0 if side == 'l' else x1 - 1
        cv.vl(edge, 6, 28, RD[1]); cv.hl(x0, x1, 7, GI[2])
        cv.vl(14 if side == 'l' else 1, 6, 28, RD[5])
    return cv


BR_ = RGB['persimmon']


# ----------------------------------------------------------------------------------------------------- 단청 기둥
def _dan_pattern(cv, x0, x1, y0, kind):
    """기둥 머리 단청 띠(머리초) 3줄 — a: 청·녹 마름모, b: 적·청 가로 줄, c: 녹·적 점."""
    for y in range(y0, y0 + 3):
        for x in range(x0, x1):
            u = (x - x0)
            if kind == 'a':
                c = DG[4] if ((u + (y - y0)) % 4) < 2 else DB[4]
            elif kind == 'b':
                c = DB[5] if (y - y0) == 1 else RD[5]
            else:
                c = RD[5] if ((u // 2 + (y - y0)) % 2) == 0 else DG[5]
            cv.put(x, y, c)
    cv.hl(x0, x1, y0 + 3, PL[5])


def pillar(rows, kind='a'):
    """단청 기둥 1×rows: 주춧돌 + 둥근 붉은 몸 + 머리초 띠 + 주두. 위 칸들은 사람 위(걸음 C), 맨 아래 칸이 몸(X)."""
    H = rows * T
    cv = Cv(T, H)
    x0, x1 = 4, 12
    for y in range(11, H - 6):
        for x in range(x0, x1):
            f = (x - x0) / (x1 - x0 - 1)
            c = RD[6] if f < 0.15 else (RD[5] if f < 0.4 else (RD[4] if f < 0.7 else (RD[3] if f < 0.9 else RD[2])))
            cv.put(x, y, c)
    for x in range(0, 16):                                           # 평방·창방 마구리: 기둥 머리 위로 양옆에 내민 두공 띠(단청 끝)
        k = (x // 2) % 4
        cv.put(x, 0, WD[6] if x < 8 else WD[4])
        cv.put(x, 1, (DG[5], RD[5], DB[5], RD[5])[k]); cv.put(x, 2, (DG[4], RD[4], DB[4], RD[4])[k])
    for x in range(1, 15):
        cv.put(x, 3, WD[5] if x < 7 else WD[3]); cv.put(x, 4, WD[3] if x < 8 else WD[2])
    cv.hl(3, 13, 5, WD[2]); cv.hl(3, 13, 6, WD[1])
    _dan_pattern(cv, 4, 12, 7, kind)                                  # 머리초(기둥 윗부분 띠)
    cv.hl(4, 12, 11, RD[1])
    for y in range(H - 6, H):                                        # 주춧돌
        for x in range(2, 14):
            c = ST[5] if (x < 6 and y < H - 3) else (ST[4] if x < 11 else ST[3])
            if y == H - 1: c = ST[2]
            cv.put(x, y, c)
    cv.hl(2, 14, H - 6, ST[6]); cv.hl(2, 14, H - 1, ST[1])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 단청 보(들보)
def beam(kind='m'):
    """가로 들보 한 칸(8px 두께): 맨 위 어두운 선·붉은 몸·청녹 단청 띠(16px 주기)·밑 선, 밑에 반투명 그림자. l/r 은 끝 마구리."""
    cv = Cv(T, T)
    x0 = 3 if kind == 'l' else 0
    x1 = 13 if kind == 'r' else T
    for x in range(x0, x1):
        cv.put(x, 3, RD[3]); cv.put(x, 4, RD[6]); cv.put(x, 5, RD[5])
        k = (x // 4) % 4
        cv.put(x, 6, (DG[5], RD[5], DB[5], RD[5])[k])
        cv.put(x, 7, (DG[4], PL[5], DB[4], PL[5])[k] if (x % 4) in (1, 2) else (DG[4], RD[4], DB[4], RD[4])[k])
        cv.put(x, 8, (DG[3], RD[3], DB[3], RD[3])[k])
        cv.put(x, 9, RD[3]); cv.put(x, 10, RD[3])
    for y in range(11, 13):
        for x in range(x0, x1):
            cv.put(x, y, SHADOW, 90 - (y - 11) * 40)
    if kind in ('l', 'r'):                                  # 끝 마구리: 한 칸 폭 어두운 단면(바깥 링을 덧대지 않는다)
        ex = x0 if kind == 'l' else x1 - 1
        for y in range(3, 11):
            cv.put(ex, y, RD[2])
    return cv


# ----------------------------------------------------------------------------------------------------- 어좌 단
def dais_top(col='m', back=False):
    """단 윗면 한 칸(바닥보다 한 단 밝은 마루 널). col l/m/r = 단 끝. back=True 는 벽면 바로 밑 줄(위 3줄 그늘)."""
    cv = Cv(T, T)
    for y in range(T):
        row = y // 4
        for x in range(T):
            q = rnd(x // 3, y, 910)
            ry = y % 4
            c = WD[6] if ry == 0 else WD[5]
            if ry == 3: c = WD[4]
            elif q < 0.10: c = WD[4]
            cv.put(x, y, c)
        jx = (hsh(row, 3, 5) % 12) + 2
        for ry in range(3):
            cv.put(jx, row * 4 + ry, WD[4])
    if back:
        for y, n in ((0, 3), (1, 2), (2, 1)):
            for x in range(T):
                cv.put(x, y, step(tuple(cv.a[y, x, :3]), n))
    if col == 'l':
        cv.vl(0, 0, T, WD[1]); cv.vl(1, 0, T, WD[6])
    if col == 'r':
        cv.vl(15, 0, T, WD[1]); cv.vl(14, 0, T, WD[3])
    return cv


def dais_face(col='m'):
    """단 앞면 한 칸(장대석 + 들어간 판 문양). 위 윗면 가장자리 밝은 돌띠, 밑에 접지 그림자."""
    cv = Cv(T, T)
    for y in range(T):
        for x in range(T):
            f = x / 15.0
            if y == 0: c = ST[6]
            elif y == 1: c = ST[5]
            elif y < 13:
                c = ST[4] if f < 0.45 else ST[3]
                if rnd(x, y, 930) < 0.06: c = ST[3] if c == ST[4] else ST[2]
            elif y == 13: c = ST[3]
            elif y == 14: c = ST[2]
            else: c = ST[1]
            cv.put(x, y, c)
    cv.rect(2, 4, 14, 12, ST[3]); cv.hl(2, 14, 4, ST[2]); cv.vl(2, 4, 12, ST[2])                 # 들어간 판
    cv.hl(3, 14, 11, ST[5]); cv.vl(13, 5, 12, ST[5])
    cv.hl(0, T, 15, ST[1])
    if col == 'l': cv.vl(0, 0, T, ST[1]); cv.vl(1, 1, 13, ST[6])
    if col == 'r': cv.vl(15, 0, T, ST[1]); cv.vl(14, 1, 13, ST[2])
    return cv


def dais_stair(cols=3):
    """단 앞 돌계단 cols×1(3칸 폭): 디딤(밝은 돌 2px)과 챌판(어두운 돌 3px)이 세 단 — 카펫은 계단 앞에서 멈추고 돌 층계가 드러난다. 양 끝은 소맷돌."""
    W_ = cols * T
    cv = Cv(W_, T)
    for t in range(3):
        y0 = t * 5
        for x in range(W_):
            f = x / (W_ - 1)
            cv.put(x, y0, ST[6]); cv.put(x, y0 + 1, ST[5] if f < 0.5 else ST[4])
            for yy in range(y0 + 2, y0 + 5):
                c = ST[4] if (f < 0.35 and yy == y0 + 2) else (ST[3] if yy < y0 + 4 else ST[2])
                if rnd(x, yy, 940 + t) < 0.07: c = ST[2] if c == ST[3] else ST[3]
                cv.put(x, yy, c)
        for jx in (11 + t * 7, 30 + t * 5):                       # 장대석 이음(챌판)
            for yy in range(y0 + 2, y0 + 5):
                cv.put(jx % W_, yy, ST[2])
    cv.hl(0, W_, 15, ST[1])
    for x in range(0, 4):                                        # 소맷돌(양 끝 돌 난간 단면)
        for y in range(0, 16):
            cv.put(x, y, ST[6] if x < 1 else (ST[5] if x < 3 else ST[4])); cv.put(W_ - 1 - x, y, ST[3] if x < 2 else ST[2])
    cv.vl(0, 0, 16, ST[1]); cv.vl(W_ - 1, 0, 16, ST[1])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 어도 카펫
def carpet(col='m', row='a'):
    """어도(붉은 카펫) 한 칸. col l/m/r (l·r 은 테두리 띠 4px + 금색 줄), row a=가운데 연꽃 문양 b=작은 마름모 문양, s=아래 끝(술)."""
    cv = Cv(T, T)
    ek = row == 's'
    for y in range(T):
        for x in range(T):
            q = rnd(x, y, 950)
            c = RD[4]
            if q < 0.025: c = RD[3]
            elif q > 0.99: c = RD[5]
            cv.put(x, y, c)
    if col in ('l', 'r'):
        bx = range(0, 4) if col == 'l' else range(12, 16)
        for y in range(T):
            for x in bx:
                cv.put(x, y, RD[2])
        lx = 3 if col == 'l' else 12
        for y in range(T):
            cv.put(lx, y, PS[5]); cv.put(2 if col == 'l' else 13, y, PS[3] if y % 4 else PS[5])
        cv.vl(0 if col == 'l' else 15, 0, T, RD[1])
    if not ek:
        if col == 'm' and row == 'a':                    # 연꽃 문양
            for (dx, dy, c) in ((0, 0, PS[5]), (-3, 1, PS[4]), (3, 1, PS[4]), (-5, 3, DG[4]), (5, 3, DG[4]), (0, 3, PS[6]), (0, -3, PS[4]), (-2, -2, PS[3]), (2, -2, PS[3])):
                cv.rect(8 + dx - 1, 8 + dy - 1, 8 + dx + 1, 8 + dy + 1, c)
            cv.put(8, 8, PL[6])
        elif row == 'b':
            for (cx, cy) in ((8, 3), (8, 11)) if col == 'm' else ((8, 7),):
                if col == 'm':
                    for d in range(0, 3):
                        cv.hl(cx - d, cx + d + 1, cy - 2 + d, PS[4]); cv.hl(cx - d, cx + d + 1, cy + 2 - d, PS[4])
    else:
        for x in range(T):
            cv.put(x, 12, PS[5]); cv.put(x, 13, RD[2]) if x % 2 == 0 else cv.put(x, 13, PS[3])
            if x % 2 == 0:
                cv.put(x, 14, PS[4]); cv.put(x, 15, PS[3])
    return cv


# ----------------------------------------------------------------------------------------------------- 난간
def nangan(kind='m'):
    """붉은 난간 한 칸: 윗 난간대(윗면 보임) + 청녹 동자기둥 + 아래 하엽 + 받침 돌. l/r 은 끝에 굵은 기둥(법수)."""
    cv = Cv(T, T)
    for x in range(T):                                   # 윗 난간대
        cv.put(x, 4, RD[6]); cv.put(x, 5, RD[5]); cv.put(x, 6, RD[3])
    for x in range(3, 15, 4):                            # 동자기둥(2px 폭)
        cv.rect(x, 7, x + 2, 12, RD[4]); cv.vl(x, 7, 12, RD[5])
    for x in range(T):                                   # 하방
        cv.put(x, 9, RD[3]) if False else None
        cv.put(x, 12, RD[4]); cv.put(x, 13, RD[2])
    for x in range(T):                                   # 석단
        cv.put(x, 14, ST[5]); cv.put(x, 15, ST[3])
    if kind in ('l', 'r'):
        x0 = 0 if kind == 'l' else 12
        cv.rect(x0, 2, x0 + 4, 14, RD[4]); cv.vl(x0, 2, 14, RD[5]); cv.vl(x0 + 3, 2, 14, RD[2])
        cv.hl(x0, x0 + 4, 2, PS[5]); cv.hl(x0, x0 + 4, 3, PS[3])
        cv.hl(x0, x0 + 4, 14, ST[5]); cv.hl(x0, x0 + 4, 15, ST[3])
    B.outline(cv)
    return cv



# ----------------------------------------------------------------------------------------------------- 회랑 깔개(긴 붉은 마루깔개)와 문 앞 깔개
def run_mat(kind='m', color='r'):
    """회랑 마루깔개 1×2(16×32): 붉은 바탕에 금 줄 테두리와 가운데 마름모 줄. l/r 은 끝 술. 바닥에 붙은 윗면(앞 두께 2px)."""
    cv = Cv(T, 2 * T)
    R_ = RD if color == 'r' else DB
    acc = PS if color == 'r' else PL
    x0 = 1 if kind == 'l' else 0
    x1 = T - 1 if kind == 'r' else T
    for y in range(3, 28):
        for x in range(x0, x1):
            q = rnd(x, y, 1300 if color == 'r' else 1310)
            c = R_[4] if q > 0.03 else R_[3]
            if y == 3: c = R_[6]
            cv.put(x, y, c)
    for x in range(x0, x1):
        cv.put(x, 6, acc[4]); cv.put(x, 7, acc[2]); cv.put(x, 23, acc[4]); cv.put(x, 24, acc[2])
        cv.put(x, 28, R_[2]); cv.put(x, 29, R_[1])
        k = x % 8
        if color == 'r':
            if k in (2, 3, 4):
                cv.put(x, 14 + (k == 3) * -1, PS[5]); cv.put(x, 15, PS[4]); cv.put(x, 16 + (k == 3), PS[5])
        else:                                                   # 청 깔개: 흰 겹마름모 줄
            if k in (1, 2, 3, 4, 5):
                d = min(k - 1, 5 - k)
                cv.put(x, 14 - d, PL[5]); cv.put(x, 17 + d, PL[5])
                if d == 0: cv.put(x, 15, PL[6]); cv.put(x, 16, PL[6])
    if kind == 'l':
        cv.vl(1, 3, 28, R_[6]); cv.vl(0, 4, 28, acc[3])
        for y in range(4, 28, 3):
            cv.put(0, y, acc[5])
    if kind == 'r':
        cv.vl(14, 3, 28, R_[2]); cv.vl(15, 4, 28, acc[3])
        for y in range(4, 28, 3):
            cv.put(15, y, acc[4])
    return cv


def step_stone():
    """문 앞 디딤돌 2×1(32×16): 돌 한 장 윗면(밝은 돌 + 가장자리 윤곽)과 낮은 앞면, 바닥에 놓인 것."""
    cv = Cv(2 * T, T)
    for y in range(3, 11):
        for x in range(1, 31):
            q = rnd(x, y, 1350)
            c = ST[5] if q > 0.06 else ST[4]
            if y == 3: c = ST[6]
            cv.put(x, y, c)
    for x in range(1, 31):
        cv.put(x, 11, ST[4]); cv.put(x, 12, ST[3]); cv.put(x, 13, ST[2])
    for (jx, jy) in ((9, 5), (21, 6)):
        cv.put(jx, jy, ST[3]); cv.put(jx + 1, jy, ST[3]); cv.put(jx + 1, jy + 1, ST[3])
    cv.vl(1, 3, 13, ST[6])
    return cv


def door_mat(kind='a'):
    """문 앞 깔개 2×1(32×16): 붉은(a)·짙은 청(b)·녹(c) 비단 직사각, 금 테두리와 가운데 꽃무늬. 바닥에 붙은 윗면."""
    cv = Cv(2 * T, T)
    ramp = {'a': RD, 'b': DB, 'c': DG}[kind]
    for y in range(2, 13):
        for x in range(1, 31):
            q = rnd(x, y, 1330)
            cv.put(x, y, ramp[4] if q > 0.1 else ramp[3])
    cv.hl(1, 31, 2, ramp[6]); cv.vl(1, 2, 13, ramp[5])
    for x in range(1, 31):
        cv.put(x, 13, ramp[2]); cv.put(x, 14, ramp[1])
    rim(cv, 3, 4, 29, 11, PS[4])
    for cx in (10, 21):
        for (dx, dy, c) in ((0, 0, PS[5]), (-2, 0, PS[3]), (2, 0, PS[3]), (0, -2, PS[3]), (0, 2, PS[3])):
            cv.put(cx + dx, 7 + dy, c)
    return cv


# ----------------------------------------------------------------------------------------------------- 목록
def objects():
    d = {}
    for k in KINDS:
        for e in ENDS:
            d['pal_wall_%s_%s' % (k, e)] = wall_face(k, e, seed=KINDS.index(k) * 3)
    for s in ('l', 'r'):
        d['pal_door_gung_%s' % s] = door_gung(s)
        d['pal_door_gung_open_%s' % s] = door_gung(s, True)
    for kind in 'abc':
        for rows in (2, 3):
            d['pal_pillar_dan_%d%s' % (rows, kind)] = pillar(rows, kind)
    for k in ('m', 'l', 'r'):
        d['pal_beam_dan_%s' % k] = beam(k)
    for c in ('l', 'm', 'r'):
        d['pal_dais_top_%s_m' % c] = dais_top(c)
        d['pal_dais_top_%s_b' % c] = dais_top(c, True)
        d['pal_dais_face_%s' % c] = dais_face(c)
    d['pal_dais_stair_3'] = dais_stair(3)
    for c in ('l', 'm', 'r'):
        for r in ('a', 'b', 's'):
            d['pal_mat_carpet_%s_%s' % (c, r)] = carpet(c, r)
    for k in ('m', 'l', 'r'):
        d['pal_nangan_%s' % k] = nangan(k)
        d['pal_mat_run_%s' % k] = run_mat(k)
        d['pal_mat_runb_%s' % k] = run_mat(k, 'b')
    for k in 'abc':
        d['pal_mat_gung_%s' % k] = door_mat(k)
    d['pal_step_stone'] = step_stone()
    return d


def terrain():
    t = {}
    t.update(floor_sets())
    t['pal_ceil47'] = ceil47()
    return t
