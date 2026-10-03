"""조선 궁 내부 구조 키트 — 바닥·카펫·단청 천장·벽(분합문·창호·회벽)·붉은 기둥·들보·월대·큰 계단·문. 조각 이름은 전부 `pal_` 접두.

새 설계가 아니라 interior_kit(실내 키트)를 **재조립해 크기를 키운 것**이다:
  · 바닥 묶음 순서·그늘 변형(북·서·북서·북 변형)은 interior_kit.FLOOR_ORDER 와 같다 — 방 빌더가 같은 규칙으로 고른다.
  · 천장은 interior_kit.ceil_tile 의 블롭 47 + 방 쪽 림을 그대로 쓰되 림만 단청 띠(6줄)로 바꾼다.
  · 벽면은 1×2(16×32), 끝 변형 m/l/r/lr, 위 창방 띠 + 아래 굽(돌 기단) 구조가 interior_kit 와 같고, 분합문(꽃살)·창호·회벽에 붉은 기둥·단청 창방을 얹는다.
  · 기둥·들보·단·계단·출입구도 interior_kit 의 같은 함수 구조에 붉은 칠·굵은 몸통·석재를 입혔다.
시점·빛은 실내 키트와 같다: 정면-위 3/4, 빛 왼쪽 위. 색은 tk.RGB 램프(조선 팔레트 91색 잠금)에서만 고른다.
궁(관아)의 단청은 여기서 맞다 — 살림집 실내에는 단청을 칠하지 않는다(CONTRACT 4절).
"""
from tk import *
from build import outline
import interior_kit as IK
from interior_kit import (T, _shade, ceil_tile, ALL47, INDEX47, N_, E__, S__, W__, NE_, SE_, SW_, NW_, _canon)

G_, S_, W_, E_, P_, ST_ = IK.G_, IK.S_, IK.W_, IK.E_, IK.P_, IK.ST_
RD, DG, DB, PE = RGB['red'], RGB['dgreen'], RGB['dblue'], RGB['persimmon']


# ------------------------------------------------------------------ 바닥 (묶음 6칸: v0 v1 북그늘 서그늘 북서그늘 북그늘변형)
def _pal_set(mk):
    v0, v1 = mk(0), mk(1)
    sh_n = lambda x, y: (0.74, 0.86, 0.94)[y] if y < 3 else 1.0
    sh_w = lambda x, y: (0.82, 0.9, 0.95, 0.98)[x] if x < 4 else 1.0
    sh_nw = lambda x, y: min(sh_n(x, y), sh_w(x, y))
    return [v0, v1, _shade(v0, sh_n), _shade(v0, sh_w), _shade(v0, sh_nw), _shade(v1, sh_n)]


def _jeon(v):
    """궁 전돌(方磚): 16×16 큰 네모 벽돌 — 한 칸이 한 장, 회청색. 이음 1px(오른쪽·아래, 한 단 어둡게)과 왼쪽 위 2px 하이라이트로 장이 읽히고 속은 조용하다."""
    c = Cv(T, T)
    for y in range(T):
        for x in range(T):
            q = rnd(x + 16 * v, y + 5 * v, 111)
            c.put(x, y, G_[3] if q < 0.06 else (G_[5] if q > 0.98 else G_[4]))
    c.hl(0, T, 15, G_[2]); c.vl(15, 0, T, G_[2])
    c.hl(0, 7, 0, G_[5]); c.vl(0, 0, 7, G_[5])
    return c


def _maru(v):
    """궁 마루: 폭 8px 넓은 널이 가로로 길게 — 널마다 한 톤(위 널 밝고 아래 널 어둡다), 윗줄 한 톤 밝은 옻칠 윤, 널 사이 줄눈 1px.
    널 끝 이음은 타일 하나에 한 줄(변형마다 다른 널)에만 — 줄마다 어긋난 이음은 벽돌로 읽힌다."""
    c = Cv(T, T)
    for b in range(2):
        tone = W_[4] if b == 0 else W_[3]
        for y in range(b * 8, b * 8 + 8):
            for x in range(T):
                q = rnd(x // 4, y, 113 + b)
                t = tone
                if y == b * 8: t = W_[min(6, tone_i(tone) + 1)]
                elif q < 0.06: t = W_[tone_i(tone) - 1]
                c.put(x, y, t)
        c.hl(0, T, b * 8 + 7, W_[2])
    if v == 0:                                              # 이음은 한 변형의 아래 널에만(네 장에 한 번 꼴)
        c.vl(11, 8, 15, W_[2])
    return c


def tone_i(col):
    for i, k in enumerate(W_):
        if tuple(k) == tuple(col):
            return i
    return 4


def _ondol(v):
    """황장판(침전 장판): 기름먹인 노란 종이 — 황토 한 톤, 16px 이음 줄, 칸 가운데 마름모 무늬 한 점."""
    c = Cv(T, T)
    for y in range(T):
        for x in range(T):
            q = rnd(x + 16 * v, y, 114)
            c.put(x, y, E_[5] if q > 0.96 else (E_[3] if q < 0.12 else E_[4]))
    c.hl(0, T, 0, E_[3]); c.vl(0, 0, T, E_[3])
    for (dx, dy) in ((0, -2), (-2, 0), (2, 0), (0, 2), (0, 0)):
        c.put(8 + dx, 8 + dy, E_[5] if (dx, dy) != (0, 0) else E_[3])
    return c


def _dais(v):
    """월대 윗면: 밝은 화강 큰 장대석 — 어좌전 바닥(전돌)보다 한 단 밝다. 이음 1px, 왼쪽 위 하이라이트, 얼룩은 아주 드물게."""
    c = Cv(T, T)
    for y in range(T):
        for x in range(T):
            q = rnd(x + 16 * v, y + 3 * v, 115)
            c.put(x, y, S_[3] if q < 0.05 else (S_[5] if q > 0.97 else S_[4]))
    c.hl(0, T, 15, S_[3]); c.vl(15, 0, T, S_[3])
    c.hl(0, 8, 0, S_[5]); c.vl(0, 0, 8, S_[5])
    return c


def carpet_tile(mask):
    """붉은 카펫 한 칸. mask: N=1 E=2 S=4 W=8 이 1 이면 그 이웃도 카펫(이어진다). 이어지지 않는 변에는 3줄 띠:
    바깥 짙은 붉음 · 금실 · 안쪽 붉음. 사방이 이어진 칸에는 작은 마름모 무늬."""
    c = Cv(T, T)
    for y in range(T):
        for x in range(T):
            q = rnd(x, y, 116)
            c.put(x, y, RD[4] if q > 0.93 else (RD[2] if q < 0.1 else RD[3]))
    for y in range(T):
        for x in range(T):
            ds = []
            if not mask & 1: ds.append(y)
            if not mask & 4: ds.append(15 - y)
            if not mask & 8: ds.append(x)
            if not mask & 2: ds.append(15 - x)
            if ds:
                d = min(ds)
                if d == 0: c.put(x, y, RD[1])
                elif d == 1: c.put(x, y, PE[4] if (x + y) % 5 else PE[5])
                elif d == 2: c.put(x, y, RD[2])
    if mask == 15:
        for (dx, dy, t) in ((0, -3, 5), (-3, 0, 5), (3, 0, 5), (0, 3, 5), (-1, -2, 4), (1, -2, 4), (-2, -1, 4), (2, -1, 4), (-2, 1, 4), (2, 1, 4), (-1, 2, 4), (1, 2, 4)):
            c.put(8 + dx, 8 + dy, RD[t])
        c.rect(7, 7, 9, 9, PE[4]); c.put(7, 7, PE[5])
    return c


# ------------------------------------------------------------------ 천장 (블롭 47, 방 쪽 림 = 단청 띠)
def _dan(pos, d):
    """아래 변(S)용 6줄 단청 띠. d = 방 쪽 가장자리에서 안쪽 거리(0 이 맨 밑). 8px 마다 녹·적·청 순으로 바뀐다(모로 단청)."""
    k = (pos // 8) % 3
    body = (DG, RD, DB)[k]
    cx = pos % 8
    if d == 0: return RD[1]
    if d == 1: return PE[4]
    if d == 2: return body[5]
    if d == 3: return PE[5] if cx in (3, 4) else body[4]       # 마름모 가운데 금점
    if d == 4: return body[3]
    return PE[3]                                              # 맨 위 금 선


def _rim_pal(side, d, pos):
    if side == 'S':
        return _dan(pos, d)
    # 위·옆 변: 3줄(짙은 붉음 · 금 · 붉음)
    return (RD[1], PE[4], RD[3], None)[d] if d < 3 else None


def ceil_pal(m):
    """interior_kit.ceil_tile 과 같은 규칙, 림 두께만 다르다(아래 6 · 나머지 3)."""
    c = Cv(T, T)
    for y in range(T):                                    # 벽 윗면(기와 덮개) — 실내 키트(interior_kit.ceil_tile)와 같은 재료
        for x in range(T):
            q = rnd(x, y // 4, 77)
            c.put(x, y, G_[4] if q > 0.9 else (G_[2] if y % 4 == 3 else G_[3]))
    for r in range(4):
        c.vl((r * 7 + 3) % 16, r * 4, r * 4 + 3, G_[2])
        c.vl((r * 7 + 11) % 16, r * 4, r * 4 + 3, G_[2])
    reach = {'N': 3, 'S': 6, 'W': 3, 'E': 3}
    for y in range(T):
        for x in range(T):
            best = None
            for side, bit, d, pos in (('N', N_, y, x), ('S', S__, 15 - y, x), ('W', W__, x, y), ('E', E__, 15 - x, y)):
                if not (m & bit) and d < reach[side]:
                    if best is None or d < best[0]:
                        best = (d, side, pos)
            for bit, a, b, cx, cy, side in ((NE_, N_, E__, 15, 0, 'N'), (SE_, S__, E__, 15, 15, 'S'),
                                              (SW_, S__, W__, 0, 15, 'S'), (NW_, N_, W__, 0, 0, 'N')):
                if (m & a) and (m & b) and not (m & bit):
                    d = max(abs(x - cx), abs(y - cy))
                    if d < reach[side] and (best is None or d < best[0]):
                        best = (d, side, x if side in 'NS' else y)
            if best:
                col = _rim_pal(best[1], best[0], best[2])
                if col is not None:
                    c.put(x, y, col)
    return c


# ------------------------------------------------------------------ 벽면 1×2 (16×32)
def _beam_dan(c, x0=0, x1=T):
    """창방(위 가로 들보) 4줄: 붉은 칠 + 금 점. 단청 천장 띠 바로 밑에서 한 번 더 받친다."""
    c.hl(x0, x1, 0, RD[1]); c.hl(x0, x1, 1, RD[5]); c.hl(x0, x1, 2, RD[4]); c.hl(x0, x1, 3, RD[2])
    for x in range(x0, x1):
        if x % 8 in (3, 4): c.put(x, 2, PE[5])


def _skirt_stone(c, x0=0, x1=T):
    """굽(돌 기단) 5줄."""
    c.hl(x0, x1, 27, S_[5]); c.hl(x0, x1, 28, S_[4]); c.hl(x0, x1, 29, S_[4]); c.hl(x0, x1, 30, S_[3]); c.hl(x0, x1, 31, S_[1])


def _post_red(c, side):
    """붉은 기둥(끝 변형) 3px: 왼쪽 밝고 오른쪽 어둡다, 밑은 초석."""
    x0, x1 = (0, 3) if side == 'l' else (T - 3, T)
    for y in range(4, 27):
        for k, x in enumerate(range(x0, x1)):
            c.put(x, y, RD[5] if k == 0 else (RD[4] if k == 1 else RD[2]))
    for y in range(27, 32):
        for x in range(x0, x1):
            c.put(x, y, S_[5] if (x == x0 and y < 31) else (S_[3] if y < 31 else S_[1]))


def _ends(c, ends):
    for side in ('l', 'r'):
        if side in ends.replace('m', ''):
            _post_red(c, side)
    return c


def _paper(c, y0, y1, x0=1, x1=T, seed=120):
    for y in range(y0, y1):
        for x in range(x0, x1):
            lo = y >= 16
            q = rnd(x, y, seed)
            c.put(x, y, (P_[4] if q > 0.1 else P_[3]) if lo else (P_[5] if q > 0.08 else P_[4]))


def wall_bun(ends):
    """분합문(分閤門) 벽면: 꽃살 마름모 살창이 보 밑에서 머름까지 — 칸마다 붉은 문설주 2px, 가운데 가로 인방, 밑 머름 널에 금 장식."""
    c = Cv(T, T * 2)
    _paper(c, 5, 27)
    for y in range(5, 27):                              # 마름모 꽃살: 가는 선이 아니라 2px 살
        for x in range(2, T):
            if (x + y) % 6 in (0, 1) or (x - y) % 6 in (0, 1):
                c.put(x, y, W_[3] if y >= 16 else W_[4])
    c.hl(0, T, 4, RD[2]); c.hl(0, T, 5, RD[4])
    c.hl(0, T, 15, RD[3]); c.hl(0, T, 16, RD[5]); c.hl(0, T, 17, RD[3])      # 가운데 인방
    c.hl(0, T, 26, RD[5]); c.hl(0, T, 27, RD[3])
    for y in range(4, 27):                              # 문설주
        c.put(0, y, RD[5]); c.put(1, y, RD[2])
    for y in range(28, 31):                             # 머름 널
        for x in range(T):
            c.put(x, y, RD[4] if y == 28 else RD[3])
    c.put(7, 29, PE[5]); c.put(8, 29, PE[5]); c.put(7, 30, PE[3]); c.put(8, 30, PE[3])
    _beam_dan(c)
    _skirt_stone(c)
    for x in range(T):                                  # 굽을 머름과 구분하는 윗입술
        c.put(x, 27, S_[5]) if False else None
    return _ends(c, ends)


def wall_chang(ends):
    """창호 벽면: 회벽 가운데에 붉은 틀 격자창(살 4px 간격), 창 밑 금 턱, 아래 줄은 한 톤 어두운 회벽 + 돌 굽."""
    c = Cv(T, T * 2)
    for y in range(4, 32):
        lo = y >= 16
        for x in range(T):
            q = rnd(x, y, 121)
            c.put(x, y, (P_[4] if q > 0.1 else P_[3]) if lo else (P_[5] if q > 0.94 else (P_[4] if q > 0.08 else P_[3])))
    x0, x1, y0, y1 = 2, 14, 6, 21
    for y in range(y0, y1):
        for x in range(x0, x1):
            c.put(x, y, P_[6] if rnd(x, y, 122) > 0.12 else P_[5])
    for x in range(x0 + 4, x1 - 1, 4):
        c.vl(x, y0 + 1, y1 - 1, W_[3])
    for y in range(y0 + 5, y1 - 1, 5):
        c.hl(x0 + 1, x1 - 1, y, W_[3])
    c.hl(x0 - 1, x1 + 1, y0 - 1, RD[5]); c.hl(x0 - 1, x1 + 1, y1, RD[2])
    c.vl(x0 - 1, y0 - 1, y1 + 1, RD[5]); c.vl(x1, y0 - 1, y1 + 1, RD[2])
    c.hl(x0 - 2, x1 + 2, y1 + 1, PE[5]); c.hl(x0 - 2, x1 + 2, y1 + 2, PE[3])        # 금 턱
    c.hl(0, T, 15, P_[3]) if False else None
    _beam_dan(c)
    _skirt_stone(c)
    return _ends(c, ends)


def wall_hoe(ends):
    """회벽 벽면: 말끔한 회벽, 가운데 붉은 인방, 밑 돌 굽. 어좌 뒤(일월오봉도 뒤) 같은 큰 벽."""
    c = Cv(T, T * 2)
    for y in range(4, 32):
        lo = y >= 16
        for x in range(T):
            q = rnd(x, y, 123)
            c.put(x, y, (P_[4] if q > 0.1 else P_[3]) if lo else (P_[6] if q > 0.95 else (P_[5] if q > 0.1 else P_[4])))
    c.hl(0, T, 14, RD[2]); c.hl(0, T, 15, RD[5]); c.hl(0, T, 16, RD[4]); c.hl(0, T, 17, RD[2])
    for x in range(T):
        if x % 8 in (3, 4): c.put(x, 16, PE[5])
    _beam_dan(c)
    _skirt_stone(c)
    return _ends(c, ends)


def _door_leaf(side):
    """궁 문짝 한 짝(16×32): 붉은 옻칠 널문, 금 못 3줄, 안쪽 가장자리에 금 문고리. side 'l' = 왼짝(손잡이 오른쪽), 'r' = 오른짝."""
    c = wall_hoe('m')
    for y in range(5, 31):
        for x in range(T):
            c.put(x, y, RD[4] if x not in (0, 15) else RD[2])
    for y in range(5, 31):
        c.put(7, y, RD[2]); c.put(8, y, RD[5]) if False else None
    for y in range(5, 31):
        for x in range(1, 7):
            if rnd(x, y, 124) > 0.9: c.put(x, y, RD[5])
    c.hl(0, T, 5, RD[1]); c.hl(0, T, 6, RD[5])
    for yy in (9, 14, 19, 24):
        for xx in (3, 11):
            c.put(xx, yy, PE[5]); c.put(xx + 1, yy, PE[4]); c.put(xx, yy + 1, PE[4]); c.put(xx + 1, yy + 1, PE[3])
    kx = 12 if side == 'l' else 2
    c.rect(kx, 16, kx + 2, 20, PE[4]); c.put(kx, 16, PE[6]); c.put(kx + 1, 19, PE[2])
    for x in range(T):
        c.put(x, 31, S_[1])
    return c


def walls():
    d = {}
    for k, fn in (('bun', wall_bun), ('chang', wall_chang), ('hoe', wall_hoe)):
        for e in ('m', 'l', 'r', 'lr'):
            d[f'pal_wall_{k}_{e}'] = fn(e)
    d['pal_wall_hoe_doorl'] = _door_leaf('l')
    d['pal_wall_hoe_doorr'] = _door_leaf('r')
    return d


# ------------------------------------------------------------------ 굵은 붉은 기둥
def pillar_red(h=3):
    """붉은 원기둥(16×16h): 위에 단청 창방 + 녹청 두공, 몸통 10px(왼쪽 밝고 오른쪽 어둡다, 금 띠 하나), 밑은 둥근 주춧돌. 위 칸들은 사람 위에 그려진다."""
    c = Cv(T, T * h)
    H = T * h
    for y in range(H - 6, H - 1):                              # 주춧돌
        w = 14 if y > H - 4 else 12
        for x in range(8 - w // 2, 8 + w // 2):
            c.put(x, y, S_[6] if x < 8 - w // 4 else (S_[5] if x < 8 + w // 4 else S_[4]))
    c.hl(2, 14, H - 1, S_[2])
    tones = (5, 5, 4, 4, 4, 3, 3, 2, 2, 1)
    for y in range(9, H - 6):                                    # 기둥 몸통
        for k, x in enumerate(range(3, 13)):
            c.put(x, y, RD[tones[k]])
    for x in range(3, 13):                                        # 금 띠
        c.put(x, 12, PE[5] if x < 6 else (PE[4] if x < 10 else PE[3]))
        c.put(x, 13, PE[3] if x < 8 else PE[2])
    c.hl(0, T, 0, RD[1]); c.hl(0, T, 1, RD[5]); c.hl(0, T, 2, RD[4]); c.hl(0, T, 3, RD[2])    # 창방
    for x in range(T):
        if x % 8 in (3, 4): c.put(x, 2, PE[5])
    for y in range(4, 8):                                         # 두공(주두): 녹 → 청
        for x in range(1, 15):
            t = (5, 4, 4, 3)[y - 4]
            c.put(x, y, (DG if (x // 4) % 2 == 0 else DB)[t])
    c.hl(2, 14, 8, RD[1])
    outline(c)
    for (x, y) in ((13, H - 2), (14, H - 2)):
        if c.a[y, x, 3] == 0: c.put(x, y, SHADOW, 60)
    return c


# ------------------------------------------------------------------ 들보
def ceil_beam_red(kind='m'):
    """궁 천장 들보(16×16): 붉은 옻칠 보 + 녹·청 단청 두 줄, 위 한 줄 밝고 밑에 그늘. 사람 위에 그려진다(C)."""
    c = Cv(T, T)
    x0 = 0 if kind != 'l' else 3
    x1 = T if kind != 'r' else T - 3
    c.hl(x0, x1, 3, RD[6]); c.hl(x0, x1, 4, RD[5])
    for y in range(5, 9):
        c.hl(x0, x1, y, (RD[4], RD[4], RD[3], RD[2])[y - 5])
    for x in range(x0, x1):
        seg = (x // 4) % 2
        c.put(x, 6, (DG if seg == 0 else DB)[5]); c.put(x, 7, (DG if seg == 0 else DB)[4])
    c.hl(x0, x1, 9, RD[1])
    for y in range(10, 13):
        for x in range(x0, x1):
            c.put(x, y, SHADOW, (80, 55, 30)[y - 10])
    if kind == 'l':
        for y in range(3, 10): c.put(x0 - 1, y, RD[2]); c.put(x0 - 2, y, RD[3]); c.put(x0 - 3, y, RD[4])
    if kind == 'r':
        for y in range(3, 10): c.put(x1, y, RD[2]); c.put(x1 + 1, y, RD[3]); c.put(x1 + 2, y, RD[4])
    return c


# ------------------------------------------------------------------ 월대 앞면 · 큰 계단 · 출입구
def dais_front_stone(kind='m'):
    """월대 앞면(1×1): 위 6줄은 월대 윗면(밝은 화강, 앞 모서리 턱), 밑은 어두운 장대석 앞면(쌓은 이음), 접지. kind l/r 은 끝 모서리."""
    c = Cv(T, T)
    for y in range(0, 6):
        for x in range(T):
            q = rnd(x, y, 131)
            c.put(x, y, S_[6] if y == 5 else (S_[4] if q > 0.1 else S_[3]))
    for y in range(6, 15):
        for x in range(T):
            t = (5, 4, 4, 4, 3, 3, 3, 3, 2)[y - 6]
            c.put(x, y, S_[t])
    for x in range(T):
        if x % 8 == 7: c.vl(x, 6, 15, S_[2])
    c.hl(0, T, 10, S_[3])
    c.hl(0, T, 15, S_[1])
    if kind == 'l':
        for y in range(0, 16): c.put(0, y, S_[2]); c.put(1, y, S_[5] if y < 6 else S_[3])
    if kind == 'r':
        for y in range(0, 16): c.put(T - 1, y, S_[1]); c.put(T - 2, y, S_[3] if y > 5 else S_[4])
    return c


def dais_steps_stone(w=3):
    """월대 오르는 큰 계단(w×1, 걷는다 F): 위 5줄은 월대 윗면, 그 밑 디딤 석 3단(밝은 윗면 + 어두운 챌), 양 끝은 소맷돌(난간 석)."""
    c = Cv(T * w, T)
    Wd = T * w
    for y in range(0, 5):
        for x in range(Wd):
            q = rnd(x, y, 132)
            c.put(x, y, S_[6] if y == 4 else (S_[4] if q > 0.1 else S_[3]))
    for k, y0 in enumerate((5, 8, 11)):
        for x in range(Wd):
            c.put(x, y0, S_[6]); c.put(x, y0 + 1, S_[5])
            c.put(x, y0 + 2, S_[3] if k < 2 else S_[2])
    c.hl(0, Wd, 14, S_[2]); c.hl(0, Wd, 15, S_[1])
    for x0, hi in ((0, True), (Wd - 4, False)):                 # 소맷돌
        for y in range(2, 16):
            for kx in range(4):
                t = (6, 5, 4, 3)[kx] if hi else (5, 4, 3, 1)[kx]
                c.put(x0 + kx, y, S_[t])
    return c


def exit_door_pal(w=1):
    """궁 출입구(w×1): 위로 박석이 이어지다 돌 문턱, 맨 밑 네 줄은 바깥 어둠. 이 칸을 밟으면 밖으로 나간다(F)."""
    c = Cv(T * w, T)
    Wd = T * w
    for y in range(0, 9):
        for x in range(Wd):
            q = rnd(x, y, 133)
            c.put(x, y, G_[4] if q > 0.15 else G_[3])
    for x in range(Wd):
        c.put(x, 9, S_[6]); c.put(x, 10, S_[5]); c.put(x, 11, S_[4])
        c.put(x, 12, S_[3]); c.put(x, 13, G_[1]); c.put(x, 14, G_[0]); c.put(x, 15, G_[0])
    return c


def ceil_front_pal(ends):
    """궁 바깥 아랫벽(남벽) 한 칸: 위 7줄은 단청 띠를 두른 벽 윗면, 아래 9줄은 바깥 회벽면(처마 그늘 · 회벽 · 돌 굽). interior_kit.ceil_front 와 같은 구성."""
    c = Cv(T, T)
    for x in range(T):
        k = (x // 8) % 3
        body = (DG, RD, DB)[k]
        c.put(x, 0, G_[2]); c.put(x, 1, RD[1]); c.put(x, 2, PE[4])
        c.put(x, 3, body[5]); c.put(x, 4, PE[5] if x % 8 in (3, 4) else body[4]); c.put(x, 5, body[3]); c.put(x, 6, PE[3])
    for y in range(7, 16):
        for x in range(T):
            q = rnd(x, y, 134)
            if y < 9: col = G_[1]
            elif y < 14: col = P_[3] if q > 0.1 else P_[2]
            elif y < 15: col = S_[4]
            else: col = S_[1]
            c.put(x, y, col)
    if 'l' in ends:
        for y in range(7, 16):
            for k in range(3): c.put(k, y, (RD[5], RD[4], RD[2])[k])
    if 'r' in ends:
        for y in range(7, 16):
            for k in range(3): c.put(T - 1 - k, y, (RD[2], RD[3], RD[4])[k])
    return c


# ------------------------------------------------------------------ 카탈로그 연결
def terrain():
    d = {}
    d['pal_floor_jeon'] = _pal_set(_jeon)
    d['pal_floor_maru'] = _pal_set(_maru)
    d['pal_floor_ondol'] = _pal_set(_ondol)
    d['pal_floor_dais'] = _pal_set(_dais)
    d['pal_floor_carpet'] = [carpet_tile(m) for m in range(16)]
    d['pal_ceil47'] = [ceil_pal(m) for m in ALL47]
    d['pal_ceil_front'] = [ceil_front_pal(e) for e in ('m', 'l', 'r', 'lr')]
    return d


def objects():
    d = walls()
    d['pal_pillar'] = pillar_red(3)
    d['pal_pillar_2'] = pillar_red(2)
    for k in ('m', 'l', 'r'):
        d[f'pal_ceil_beam_{k}'] = ceil_beam_red(k)
    for k in ('m', 'l', 'r'):
        d[f'pal_dais_front_{k}'] = dais_front_stone(k)
    d['pal_dais_steps_4'] = dais_steps_stone(4)
    d['pal_dais_steps_6'] = dais_steps_stone(6)
    for w in (1, 2, 3, 4):
        d['pal_exit_door' + ('' if w == 1 else str(w))] = exit_door_pal(w)
    return d


if __name__ == '__main__':
    t = terrain(); o = objects()
    print({k: len(v) for k, v in t.items()}, len(o), 'violations', len(VIOLATIONS))
