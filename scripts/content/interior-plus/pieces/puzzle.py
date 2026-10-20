"""JRPG 퍼즐 방 — 무너지는 판자(4프레임), 심연 가장자리 오토타일(47 마스크), 저울 추 받침(빈 것 + 추 1~5), 빙판 바닥.

판자는 심연 칸 위(2층)에 덮는 평평한 조각이라 널 사이 틈과 동서 1px 여백을 투명으로 남긴다(검은 구멍이 비친다).
심연은 8이웃 마스크(N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128, 켜짐 = 그 이웃도 구멍, 대각은 양옆 직교가 켜졌을 때만)의 함수다.
  북이 바닥 → 칸 위에 볕 받는 테 + 아래로 어두워지는 먼 벽 바위 낯(지층) — 구멍이 깊어 보인다.
  남이 바닥 → 칸 아래에 가까운 바닥 판의 얇은 볕 든 입술(가까운 벽은 가려진다).
  서·동이 바닥 → 좁게 물러나는 옆벽 띠(서벽은 동쪽을 봐 그늘, 동벽은 서쪽을 봐 볕).
  대각만 바닥 → 모서리에 작은 테 홈.
"""
import math
import iplib
from iplib import REG, K, shift, Cv, hnoise, ring

TAGS = ['던전', '퍼즐']

# ───────────────────────── 무너지는 판자 ─────────────────────────


def _wood(k, dk=0):
    """썩은 널 한 줄 램프(밝은 → 어두운 7단): 소나무 볕 → 소나무 몸 → 진한 나무 그늘. dk = 몇 단 어둡게."""
    R = [K('pine', 6), K('pine', 5), K('pine', 4), K('pine', 3), K('dwood', 6), K('dwood', 5), K('dwood', 4), K('dwood', 3), K('dwood', 2), K('dwood', 1)]
    return R[max(0, min(len(R) - 1, k + dk))]


def board(c, x0, x1, y0, top=4, front=2, slope=0.0, dk=0, seed=0, nails=True, rot=True):
    """3/4 썩은 널 한 장(동서로 눕는다): 윗면 top 줄(볕, 결·옹이·썩은 얼룩) + 남쪽 앞 모서리 front 줄(어둡게).
    slope = 열마다 아래로 처지는 px(기울어 떨어지는 널). dk = 전체를 몇 단 어둡게(멀어지며 구멍 그늘로)."""
    tone = 1 if hnoise(seed, 0, 5) > .5 else 2                               # 널마다 바탕 밝기가 조금 다르다
    knot = x0 + 3 + int(hnoise(seed, 1, 5) * max(1, x1 - x0 - 6))
    for x in range(x0, x1 + 1):
        oy = int(round(slope * (x - x0)))
        for j in range(top):
            y = y0 + oy + j
            k = tone + (0 if j else -1) + (1 if x > x0 + (x1 - x0) * .7 else 0)       # 뒤 가장자리 볕, 오른쪽 끝 그늘
            ph = int(hnoise(j, seed, 6) * 5)
            g = hnoise((x + ph) // 4, j, seed)                                      # 결: 4px 마디로 길게 이어지는 가로 줄
            if j > 0 and g > .62: k += 2 if (x + ph) % 4 else 1
            elif j > 0 and g < .2 and (x + ph) % 4 in (1, 2): k -= 1                # 결 사이 볕 줄
            if j == 0 and hnoise(x, 0, seed + 4) < .3: k -= 1
            if rot and x0 < x < x1 and j > 0 and hnoise(x // 2, j // 2 + y0, seed + 7) > .82: k = 5 + (1 if hnoise(x, j, seed + 9) > .5 else 0)   # 썩은 얼룩
            if abs(x - knot) <= 1 and j == top // 2: k = 6 if x == knot else 4                                    # 옹이
            if x == x0: k = 3 if j else 2                                          # 마구리(볕 쪽)
            if x == x1: k = 6
            c.p(x, y, _wood(k, dk))
        for j in range(front):
            y = y0 + oy + top + j
            k = (4 if j == 0 else 7) + (1 if x >= x1 - 1 else 0) - (1 if x == x0 else 0)
            if j == 0 and hnoise(x, y0, seed + 3) > .78: k = 5
            c.p(x, y, _wood(k, dk))
        c.p(x, y0 + oy + top + front, None) if False else None
    if nails and x1 - x0 >= 8:
        for nx in (x0 + 1, x1 - 1):                                              # 널 끝 못(밧줄 자리 옆)
            oy = int(round(slope * (nx - x0)))
            c.p(nx, y0 + oy + 2, K('iron', 5 - dk)); c.p(nx, y0 + oy + 3, K('iron', 2 - dk))


def rope(c, x, y0, y1, dk=0, fray=False):
    """널을 묶은 삼 밧줄(남북) — 틈을 건너 꼬인 세 색."""
    for y in range(y0, y1 + 1):
        if fray and y > y0 + 1: break
        c.p(x, y, K('linen', (4 if y % 2 else 2) - dk))
        c.p(x + 1, y, K('linen', (1 if y % 2 else 3) - dk))


def knot(c, x, y):
    c.p(x, y, K('linen', 4)); c.p(x + 1, y, K('linen', 2)); c.p(x, y + 1, K('linen', 1))


@REG.piece('plank bridge', '썩은 판자 다리(멀쩡)', 'puzzle', 'flat', 1, 1, 0, 'flat',
           '심연 위에 걸친 썩은 널 판자 한 칸 — 널 두 장, 삼 밧줄로 묶었다. 틈으로 검은 구멍이 비친다. 밟으면 금이 간다.', TAGS + ['다리', '함정'],
           '심연 칸 위(2층)에 깐다. 이어진 판자 길은 남북으로 한 줄씩.', ['plank bridge cracked', 'pressure plate'], use=('walk',), style='prop')
def plank_bridge(c):
    board(c, 1, 14, 0, seed=1)
    board(c, 1, 14, 8, seed=2)
    for x in (2, 12):
        rope(c, x, 6, 7); rope(c, x, 14, 15)


@REG.piece('plank bridge cracked', '썩은 판자 다리(금 감)', 'puzzle', 'flat', 1, 1, 0, 'flat',
           '금이 가 쪼개진 썩은 판자 — 뒷 널은 가운데가 갈라지고 앞 널은 둘로 부러져 한쪽이 처졌다. 곧 떨어진다.', TAGS + ['다리', '함정'],
           '밟은 판자 칸을 이 그림으로 바꾼 뒤 떨어짐 1·2 를 잇는다.', ['plank bridge', 'plank bridge falling 1'], use=('walk',), style='prop')
def plank_cracked(c):
    board(c, 1, 14, 0, seed=1)
    for y, x in ((0, 8), (1, 8), (2, 7), (3, 8), (4, 9), (5, 9)): c.p(x, y, K('dwood', 0))   # 쩍 갈라진 금(지그재그)
    for y, x in ((1, 9), (2, 8), (3, 9)): c.p(x, y, K('pine', 5))                            # 금 가장자리 볕(쪼개진 결)
    for y in range(0, 6):                                                                     # 오른쪽 반이 내려앉아 한 단 어둡다
        for x in range(10, 15):
            col = c.get(x, y)
            if col: c.p(x, y, shift(col, -1))
    board(c, 1, 6, 8, slope=0.35, seed=2)                                                     # 앞 널: 둘로 부러졌다
    board(c, 9, 14, 10, slope=-0.15, dk=1, seed=3, nails=False)
    for x, y, k in ((7, 10, 5), (7, 12, 5), (8, 11, 4), (8, 13, 3), (7, 14, 2)): c.p(x, y, K('pine', k))   # 가시(쪼개진 나뭇결)
    rope(c, 2, 6, 7); rope(c, 12, 6, 7, fray=True)                                            # 오른쪽 밧줄이 끊겨 늘어졌다
    rope(c, 2, 14, 15)
    c.p(13, 8, K('linen', 2)); c.p(13, 9, K('linen', 1))
    for x, y in ((5, 15), (11, 15), (10, 14)): c.p(x, y, K('dwood', 4))                        # 떨어지는 부스러기


@REG.piece('plank bridge falling 1', '썩은 판자 다리(떨어짐 1)', 'puzzle', 'flat', 1, 1, 0, 'flat',
           '부서져 구멍으로 떨어지는 판자 조각 — 기울고 작아지고(멀어진다) 어두워진다.', TAGS + ['다리', '함정'],
           '금 간 판자 다음 프레임. 그다음 떨어짐 2, 그 뒤 판자를 지워 구멍만 남긴다.', ['plank bridge cracked', 'plank bridge falling 2'], use=('walk',), style='prop')
def plank_falling1(c):
    board(c, 2, 8, 2, top=3, front=2, slope=0.45, dk=1, seed=4, nails=False)
    board(c, 8, 13, 8, top=3, front=2, slope=-0.5, dk=2, seed=5, nails=False)
    board(c, 4, 7, 11, top=2, front=1, slope=0.5, dk=2, seed=6, nails=False, rot=False)
    rope(c, 3, 0, 1, dk=1); c.p(12, 6, K('linen', 1)); c.p(12, 5, K('linen', 2))              # 끊긴 밧줄 끝
    for x, y, k in ((10, 3, 4), (1, 9, 5), (13, 13, 5), (9, 14, 6), (11, 2, 6), (2, 13, 6), (7, 1, 5)):   # 부스러기·먼지
        c.p(x, y, K('dwood', k - 1))
    for x, y in ((9, 6), (3, 7)): c.p(x, y, K('pine', 3))                                     # 튄 가시


@REG.piece('plank bridge falling 2', '썩은 판자 다리(떨어짐 2)', 'puzzle', 'flat', 1, 1, 0, 'flat',
           '구멍에 거의 삼켜진 마지막 판자 부스러기 — 작고 어둡다.', TAGS + ['다리', '함정'],
           '떨어짐 1 다음 프레임. 이 다음엔 판자를 지운다.', ['plank bridge falling 1'], use=('walk',), style='prop')
def plank_falling2(c):
    board(c, 5, 9, 6, top=2, front=1, slope=0.34, dk=2, seed=8, nails=False, rot=False)      # 가장 큰 조각(멀어져 작고 어둡다)
    board(c, 9, 11, 10, top=1, front=1, slope=-.5, dk=3, seed=9, nails=False, rot=False)
    for x, y, k in ((10, 7, 4), (11, 8, 2), (4, 10, 3), (5, 11, 1), (7, 12, 2), (8, 13, 1), (7, 4, 3), (6, 3, 1),
                    (3, 7, 2), (12, 5, 1), (6, 14, 1), (12, 12, 2)):                          # 부스러기(위쪽은 덜 어둡다, 아래로 갈수록 삼켜진다)
        c.p(x, y, K('dwood', k))
    c.p(8, 5, K('pine', 3)); c.p(9, 9, K('pine', 2)); c.p(4, 9, K('linen', 1))                 # 가시 볕·밧줄 올


# ───────────────────────── 심연 가장자리(47) ─────────────────────────
N, NE, E, SE, S, SW, W, NW = 1, 2, 4, 8, 16, 32, 64, 128


def reduce_mask(m):
    """대각 비트는 양옆 직교가 둘 다 켜졌을 때만 남긴다(47 블롭)."""
    if not (m & N and m & E): m &= ~NE
    if not (m & S and m & E): m &= ~SE
    if not (m & S and m & W): m &= ~SW
    if not (m & N and m & W): m &= ~NW
    return m


MASKS = sorted({reduce_mask(m) for m in range(256)})
assert len(MASKS) == 47

# 동굴 바위 램프 — 팔레트 v6 의 기존 색(동굴 바닥·바위벽 v5 가 쓰는 따뜻한 회갈색, s 램프)을 어두운 → 밝은 순으로 묶었다. 새 색 없음.
iplib.RAMPS['rk'] = [tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in
                     ('141315', '1e1c1a', '2b2622', '36302b', '453f3c', '52473a', '614e3c', '70583f', '8c7554', 'ac9067')]
for _i, _c in enumerate(iplib.RAMPS['rk']): iplib._WHERE.setdefault(_c, ('rk', _i))

FACE = 15          # 먼 벽 낯이 내려오는 줄 수(테 포함)


def _hx(h): return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# 구멍 속 어둠 — 팔레트 v6 의 거의 검정 색들(검정 램프·s1 램프), 어두운 → 덜 어두운
DEEP = [_hx(h) for h in ('08080a', '0a0503', '110f12', '131317', '141315', '19171a', '1e1c1a', '24221e', '2b2622')]


def _lat(ix, iy, s): return hnoise(ix % 4, iy % 4, s)


def _vn16(x, y, s):
    """주기 16 값 잡음(격자 4px) — 구멍 속 칸끼리 이음매 없이 이어진다."""
    gx, gy = x / 4, y / 4
    ix, iy = int(math.floor(gx)), int(math.floor(gy)); fx, fy = gx - ix, gy - iy
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b, c, d = _lat(ix, iy, s), _lat(ix + 1, iy, s), _lat(ix, iy + 1, s), _lat(ix + 1, iy + 1, s)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def _deep(x, y):
    """구멍 속: 거의 검정 일곱 색을 낮은 주파수 얼룩 + 흩뿌림으로 섞는다 — 평면 한 색도, 시끄러운 점도 아니다."""
    x %= 16; y %= 16
    t = _vn16(x, y, 41) * 4.4 + (hnoise(x, y, 42) - .5) * 1.5
    i = max(0, min(6, int(t)))
    # 아득한 아래 바위 턱(가로 2~3px, 위 볕·아래 그늘) — 깊이를 읽히는 희미한 층
    sh = int(hnoise(x // 5, 0, 46) * 8)
    ly = (y + sh) % 8
    on = lambda yy: hnoise(x // 3, (yy + sh) // 8, 45) > .68 and hnoise(x, 0, 47) > .2
    if ly == 0 and on(y): return DEEP[8] if hnoise(x, y, 48) > .55 else DEEP[7]     # 아득한 아래 바위 턱 윗머리(희미한 볕)
    if ly == 1 and on(y - 1): return DEEP[5]
    if ly == 2 and on(y - 2): return DEEP[0]
    for rx, ry, rs in ((4, 11, 0), (11, 5, 1)):                                # 아득한 아래 돌무더기 두 덩이(희미하게 — 바닥이 아니라 떨어져 걸린 돌)
        dx, dy = x - rx, y - ry
        if hnoise(rs, 0, 141) > .45 and abs(dx) <= 1 and -1 <= dy <= 0 and not (abs(dx) == 1 and dy == -1):
            return K('rk', 3) if dy == -1 or dx == -1 else K('rk', 2) if dx == 0 else DEEP[8]
    if hnoise(x, y, 43) > .978: i = 6 + (1 if hnoise(x, y, 44) > .7 else 0)    # 아득한 아래 먼지 반짝임
    return DEEP[i]


# 먼 벽 바위 띠(위→아래): (시작 줄, 끝 줄, 몸 단). 띠마다 윗머리 1줄 볕(턱), 아랫줄 그늘, 세로 이음 — 아래 띠일수록 어둡다.
BANDS = [(2, 4, 7), (5, 7, 5), (8, 10, 4), (11, 13, 2), (14, 15, 0)]


def _far_wall(x, y, seed=0):
    """북쪽 바닥 아래 먼 벽 낯: 0줄 볕 든 테, 1줄 테 앞 모서리, 그 아래 바위 띠 넷이 아래로 어두워져 어둠에 녹는다. None = 깊이."""
    if y == 0: return K('rk', 9 if hnoise(x, 0, seed + 1) > .35 else 8)
    if y == 1: return K('rk', 7 if hnoise(x, 1, seed + 9) > .25 else 6) if hnoise(x, 1, seed + 10) > .12 else K('rk', 8)
    jit = lambda b: (1 if hnoise(x // 4 + b * 3, b, seed + 2) > .62 else 0)        # 띠 경계가 4px 마디로 들쭉날쭉
    for bi, (y0, y1, k) in enumerate(BANDS):
        a0 = y0 + (jit(bi) if bi else 0); a1 = y1 + jit(bi + 1)               # 첫 띠는 테 바로 밑에서 시작(틈이 생기지 않게)
        if not (a0 <= y <= a1): continue
        if bi == len(BANDS) - 1:                                              # 마지막 띠: 어둠에 녹는 바위 끝(듬성듬성, 아래로 갈수록 성기다)
            if hnoise(x, y, seed + 6) > (.62 - .2 * (y - a0)): return None
            return K('rk', 2 if y == a0 else 1)
        span = (x + bi * 5 + int(hnoise(bi, 0, seed + 3) * 7)) % 7               # 세로 이음 7px 마디
        kk = k
        if y == a0: kk += 2 if hnoise(x, y, seed + 11) > .2 else 1             # 띠 윗머리 볕(턱)
        elif y == a1: kk -= 2                                                  # 턱 밑 그늘
        if span == 0 and y != a0: return K('rk', max(0, k - 3))                # 이음 틈
        if span == 1 and y != a0 and y != a1: kk += 1                           # 이음 왼쪽 볕
        g = hnoise(x, y, seed + 5)
        if g > .8: kk -= 1                                                     # 바위 결(패인 점)
        elif g < .14: kk += 1                                                  # 돌기
        return K('rk', max(0, min(9, kk)))
    return None


def _side(i, y, east):
    """옆벽 띠 i 번째 열(0 = 바닥 쪽 테). 돌덩이(높이 4, 열마다 엇갈림)를 하나씩 — 윗머리 볕·아랫줄 그늘·이음.
    서벽(east=False)은 동쪽을 봐 그늘, 동벽(east=True)은 서쪽을 봐 볕. None = 깊이(어둠)."""
    if i == 0:
        n = hnoise(15 if east else 0, y, 52)
        return K('rk', (8 if n > .4 else 7 if n > .1 else 9) if east else (6 if n > .55 else 5 if n > .15 else 7))
    if i == 3:
        return K('rk', 2 if east else 1) if hnoise(i + (9 if east else 0), y, 57) > .55 else None
    off = (i * 2 + (1 if east else 0)) % 4
    yy = (y + off) % 4
    base = (6 if i == 1 else 5) if east else (4 if i == 1 else 3)
    k = base + (1 if yy == 0 else -2 if yy == 3 else 0)
    if hnoise(i + (9 if east else 0), (y + off) // 4, 58) > .7: k -= 1          # 돌마다 밝기가 조금 다르다
    if hnoise(i + (9 if east else 0), y, 59) > .9: k -= 1
    return K('rk', max(1, min(9, k)))


def _wside(y): return _side(0, y, False), _side(1, y, False)
def _eside(y): return _side(0, y, True), _side(1, y, True), _side(2, y, True)


def _put_side(c, y, east, n=4, fade=None):
    for i in range(n):
        col = _side(i, y, east)
        if fade is not None and y >= fade: col = shift(col, -2) if col else None
        if col is not None: c.p(15 - i if east else i, y, col)


def pit_tile(mask):
    c = Cv(16, 16)
    for y in range(16):
        for x in range(16): c.p(x, y, _deep(x, y))
    nfloor, sfloor, wfloor, efloor = not mask & N, not mask & S, not mask & W, not mask & E
    for y in range(16):                                                       # 옆벽 띠(위아래로 이어진다)
        if wfloor: _put_side(c, y, False)
        if efloor: _put_side(c, y, True)
    # 안쪽 모서리 홈(대각만 바닥): 옆 칸 먼 벽이 끝나는 모서리 — 옆벽 띠가 먼 벽 깊이만큼 내려오다 녹는다
    if not nfloor and not wfloor and not mask & NW:
        for y in range(1, FACE - 1): _put_side(c, y, False, n=3, fade=7)
        c.p(0, 0, K('rk', 9)); c.p(1, 0, K('rk', 7)); c.p(2, 0, K('rk', 5))
    if not nfloor and not efloor and not mask & NE:
        for y in range(1, FACE - 1): _put_side(c, y, True, n=3, fade=7)
        c.p(15, 0, K('rk', 9)); c.p(14, 0, K('rk', 8)); c.p(13, 0, K('rk', 6))
    if nfloor:                                                                # 먼 벽 낯(북이 바닥)
        # 남쪽도 바닥이면(한 줄짜리 구멍) 먼 벽을 9줄로 줄여 그린다 — 아래 입술 사이에 어둠이 남아 구멍으로 읽힌다
        face = FACE if not sfloor else 9
        for y in range(face + 1):
            yy = y if not sfloor or y < 2 else 2 + int((y - 2) * (FACE - 2) / (face - 2))
            for x in range(16):
                col = _far_wall(x, yy, seed=(mask * 7) % 13)
                if col is not None and (not sfloor or y < face): c.p(x, y, col)
        if wfloor:      # 먼 벽과 서벽이 만나는 모서리 — 테가 꺾여 옆벽 띠로 이어 내려간다
            c.p(0, 0, K('rk', 8)); c.p(0, 1, K('rk', 7))
            for y in range(2, face): _put_side(c, y, False, n=2)
        if efloor:
            c.p(15, 0, K('rk', 9)); c.p(15, 1, K('rk', 8))
            for y in range(2, face): _put_side(c, y, True, n=2)

    ls = (mask * 5) % 11                                                    # 마스크마다 입술 굴곡이 다르다(같은 줄이 되풀이돼 보이지 않게)

    def lip(x0, x1):    # 가까운 바닥 입술(남이 바닥): 밑 그늘 + 볕 든 모서리 1줄 + 판 윗면 2줄, 3px 마디로 1줄 더 나온다
        for x in range(x0, x1 + 1):
            up = 1 if hnoise(x // 3, ls, 63) > .55 else 0
            c.p(x, 12 - up, DEEP[0])
            c.p(x, 13 - up, K('rk', 8 if hnoise(x, 13, 61) > .3 else 9))
            c.p(x, 14 - up, K('rk', 7 if hnoise(x, 14, 65) > .2 else 6))
            if up: c.p(x, 14, K('rk', 6 if hnoise(x, 14, 64) > .4 else 7))
            c.p(x, 15, K('rk', 6 if hnoise(x, 15, 62) > .35 else 5) if hnoise(x, 15, 66) > .1 else K('rk', 7))
            if hnoise(x // 2, ls, 67) > .8 and x % 2 == 0:                       # 입술 끝에 걸린 돌멩이(볕 + 그늘)
                c.p(x, 12 - up, K('rk', 7)); c.p(x + 1, 12 - up, K('rk', 4)); c.p(x, 11 - up, K('rk', 3))
    if sfloor:
        lip(0, 15)
        if wfloor: c.p(0, 13, K('rk', 6))
        if efloor: c.p(15, 13, K('rk', 8))
    else:
        if not wfloor and not mask & SW:
            for x in (0, 1): c.p(x, 13, K('rk', 9 if x == 0 else 8)); c.p(x, 14, K('rk', 7)); c.p(x, 15, K('rk', 6))
            c.p(2, 14, K('rk', 4)); c.p(2, 15, K('rk', 3))
        if not efloor and not mask & SE:
            for x in (14, 15): c.p(x, 13, K('rk', 8)); c.p(x, 14, K('rk', 7)); c.p(x, 15, K('rk', 6))
            c.p(13, 14, K('rk', 4)); c.p(13, 15, K('rk', 3))
    return c


@REG.pit('abyss', '심연')
def abyss(mask):
    return pit_tile(mask)


# ───────────────────────── 저울 추 받침 ─────────────────────────

def stand(c, H):
    """낮은 대리석 받침(3/4): 윗면 5줄 + 앞면 4줄, 윗면 가운데 얕은 둥근 홈(추 자리). H = 그림 높이(발 칸 끝).
    흰 대리석이라 어느 던전·동굴 바닥에서도 뜨고, 놋쇠·무쇠·납 추와도 갈린다."""
    m = 'marble'
    x0, x1 = 2, 13
    yt = H - 12                                                             # 윗면 첫 줄
    c.hl(x0, x1, yt - 1, K(m, 0))
    for j in range(5):
        for x in range(x0, x1 + 1):
            k = 5 + (1 if j == 0 and x < 9 else 0) - (1 if x >= x1 - 1 else 0)
            if hnoise(x, j, 71) > .88: k -= 1
            c.p(x, yt + j, K(m, k))
    c.hl(x0 + 1, x1 - 1, yt + 4, K(m, 6))                                   # 앞 모서리 볕
    for j in range(4):
        for x in range(x0, x1 + 1):
            k = 3 - (1 if j >= 3 else 0) - (1 if x >= x1 - 1 else 0) + (1 if x == x0 else 0)
            if j == 1 and x0 < x < x1 - 1: k += 1                             # 앞면 가운데 띠(쇠시리)
            c.p(x, yt + 5 + j, K(m, k))
    c.hl(x0, x1, yt + 9, K('stone', 1))
    c.vl(x0 - 1, yt - 1, yt + 8, K(m, 0)); c.vl(x1 + 1, yt - 1, yt + 8, K('stone', 1))
    for x, y in ((4, yt + 1), (5, yt + 2), (11, yt + 3), (12, yt + 2)): c.p(x, y, K(m, 4))     # 대리석 결(옅은 줄)
    for x in (x0 + 4, x0 + 8): c.p(x, yt + 7, K(m, 2))
    c.shadow(x0, yt + 9, x1 + 1, H - 1)
    return 7.5, yt + 2                                                      # 홈 중심


def socket(c, cx, cy):
    """빈 추 자리: 놋쇠를 두른 얕은 둥근 홈(뒤 둘레 그늘 · 앞 둘레 볕) + 바닥에 새긴 눈금 다섯(어느 추든 놓는 자리)."""
    c.sprite(int(cx) - 4, int(cy) - 2, ['.1222221.',
                                       '13444443.'.replace('.', '2', 0),
                                       '2400000462'[:9],
                                       '.5566665.'], {'1': K('brass', 1), '2': K('brass', 2), '3': K('brass', 3), '4': K('marble', 1),
                                                       '0': K('marble', 2), '5': K('brass', 5), '6': K('brass', 4)})
    for i in range(5): c.p(int(cx) - 2 + i, int(cy), K('marble', 3) if i % 2 else K('marble', 1))


# 재질 → 유색 윤곽(거의 무채색 검정이 아니라 그 재질 쪽으로 기운 어두운 색)
OUTLINE = {'brass': (K('brass', 0), K('brass', 1)), 'iron': (K('fish', 0), K('fish', 1)), 'fish': (K('blue', 0), K('fish', 0)),
           'marble': (K('stone', 1), K('marble', 0))}


def weight_block(c, cx, ybot, wt, wb, d, h, m, marks, top_k=5, seed=0, fk=0):
    """사다리꼴 추(3/4): 윗면 d 줄(폭 wt, 볕 5~6단) + 앞면 h 줄(아래로 wb 까지 넓어진다: 왼쪽 볕 5 → 오른쪽 그늘 2) + 유색 윤곽.
    ybot = 앞면 마지막 줄. 앞면 아래쪽 한 줄에 새긴 점 marks 개(어두운 홈 + 아래·오른쪽 볕) — 무게 숫자. 주물 결(점 얼룩)."""
    o0, o1 = OUTLINE[m]
    yt = ybot - h - d + 1                                                    # 윗면 첫 줄
    l0 = int(round(cx - wt / 2)); r0 = l0 + wt - 1
    c.hl(l0, r0, yt - 1, o1)                                                 # 뒤 둘레
    for j in range(d):
        for x in range(l0, r0 + 1):
            k = top_k + (1 if j == 0 and x < l0 + wt * .6 else 0) - (1 if x >= r0 - 1 else 0)
            if hnoise(x, j, 87 + seed) > .86: k -= 1
            c.p(x, yt + j, K(m, k))
    for j in range(h):
        t = (j + 1) / h
        L = int(round(cx - (wt + (wb - wt) * t) / 2)); R = int(round(cx + (wt + (wb - wt) * t) / 2)) - 1
        for x in range(L, R + 1):
            u = (x - L) / max(1, R - L)
            k = (5 if u < .15 else 4 if u < .45 else 3 if u < .8 else 2) + fk
            if j >= h - 2: k -= 1                                                # 밑동 그늘
            if j == 0: k = top_k + 1                                             # 윗면 앞 모서리 볕
            elif hnoise(x, j, 89 + seed) > .87: k -= 1                           # 주물 결
            c.p(x, yt + d + j, K(m, k))
        c.p(L - 1, yt + d + j, o1); c.p(R + 1, yt + d + j, o0)
    for y in range(yt, yt + d): c.p(l0 - 1, y, o1); c.p(r0 + 1, y, o0)
    Lb = int(round(cx - wb / 2)); c.hl(Lb, Lb + wb - 1, ybot + 1, o0)
    my = ybot - 2 if h >= 5 else ybot - 1                                    # 앞면 아래쪽 한 줄에 새긴 점
    for i in range(marks):
        px = int(math.floor(cx + (i - (marks - 1) / 2) * 2))
        c.p(px, my, K(m, max(0, 1 + fk))); c.p(px, my + 1, K(m, 5 + fk)); c.p(px + 1, my, K(m, 4 + fk))
    return yt


@REG.piece('weight stand', '저울 추 받침(빈 것)', 'puzzle', 'floor', 1, 1, 0, 'other',
           '추를 올려 두는 낮은 대리석 받침 — 윗면 가운데 둥근 홈이 비어 있다(추 자리).', TAGS + ['저울', '받침'],
           '저울 퍼즐 방 바닥. 추를 옮겨 올리면 weight stand 1~5 로 바꾼다.', ['weight stand 1', 'balance scale'], use=('switch',))
def weight_stand0(c):
    cx, cy = stand(c, 16); socket(c, cx, cy)


def _w(c, n, H):
    cx, cy = stand(c, H)
    yb = int(cy) + 1                                                          # 받침 윗면 홈 위에 앉는다
    if n == 1: weight_block(c, cx, yb, 4, 5, 2, 3, 'brass', 1)
    elif n == 2: weight_block(c, cx, yb, 6, 7, 3, 5, 'brass', 2)
    elif n == 3: weight_block(c, cx, yb, 7, 9, 3, 7, 'iron', 3)
    elif n == 4: weight_block(c, cx, yb, 9, 9, 5, 7, 'iron', 4, fk=-1)


@REG.piece('weight stand 1', '저울 추 받침(추 1 — 가장 가벼운 놋쇠)', 'puzzle', 'floor', 1, 1, 0, 'other',
           '대리석 받침 위 작은 놋쇠 추(점 하나). 다섯 추 중 가장 가볍다.', TAGS + ['저울', '추'],
           '저울 퍼즐 방 바닥.', ['weight stand', 'weight stand 2'], use=('push',))
def weight_stand1(c): _w(c, 1, 16)


@REG.piece('weight stand 2', '저울 추 받침(추 2 — 놋쇠)', 'puzzle', 'floor', 1, 1, 0, 'other',
           '대리석 받침 위 놋쇠 추(점 둘). 추 1 보다 크다.', TAGS + ['저울', '추'],
           '저울 퍼즐 방 바닥.', ['weight stand 1', 'weight stand 3'], use=('push',))
def weight_stand2(c): _w(c, 2, 16)


@REG.piece('weight stand 3', '저울 추 받침(추 3 — 무쇠)', 'puzzle', 'floor', 1, 1, 3, 'other',
           '대리석 받침 위 무쇠 추(점 셋). 놋쇠 추보다 크고 무겁다.', TAGS + ['저울', '추'],
           '저울 퍼즐 방 바닥.', ['weight stand 2', 'weight stand 4'], use=('push',))
def weight_stand3(c): _w(c, 3, 32)


@REG.piece('weight stand 4', '저울 추 받침(추 4 — 큰 무쇠)', 'puzzle', 'floor', 1, 1, 6, 'other',
           '대리석 받침 위 큰 무쇠 추(점 넷).', TAGS + ['저울', '추'],
           '저울 퍼즐 방 바닥.', ['weight stand 3', 'weight stand 5'], use=('push',))
def weight_stand4(c): _w(c, 4, 32)


@REG.piece('weight stand 5', '저울 추 받침(추 5 — 가장 무거운 납 덩이)', 'puzzle', 'floor', 1, 1, 10, 'other',
           '대리석 받침 위 가장 무거운 검은 납 덩이 추(쇠고리 손잡이, 점 다섯).', TAGS + ['저울', '추'],
           '저울 퍼즐 방 바닥.', ['weight stand 4'], use=('push',))
def weight_stand5(c):
    """가장 무거운 추: 받침을 거의 덮는 납 원통(위에서 본 타원 윗면 6줄 + 몸 7줄, 쇠 띠) + 윗면 뒤쪽에 세운 쇠고리 손잡이."""
    H = 32
    cx, cy = stand(c, H)
    m = 'stone'                                                                # 납: 어두운 푸른 회색
    O0, O1 = K('fish', 0), K('fish', 1)
    rx, ry, h = 5.5, 2.5, 7
    yb = int(cy) + 2                                                          # 몸 아래 둘레 중심(받침 윗면에 앉는다)
    ytc = yb - h                                                              # 윗면 타원 중심
    x0, x1 = int(math.floor(cx - rx)), int(math.ceil(cx + rx))
    for x in range(x0, x1 + 1):                                               # 몸: 왼쪽 볕 → 오른쪽 그늘(납은 어둡다), 아래 둥근 끝
        u = (x - cx) / (rx + .5)
        if abs(u) > 1: continue
        ybot = yb + ry * math.sqrt(1 - u * u)
        for y in range(ytc, int(round(ybot)) + 1):
            k = 4 if u < -.6 else 3 if u < -.1 else 2 if u < .55 else 1
            if y >= round(ybot) - 1: k -= 1
            if hnoise(x, y, 131) > .88: k -= 1                                 # 두들긴 자국
            if hnoise(x, y, 132) > .94: k += 1
            c.p(x, y, K(m, max(0, k)))
        c.p(x, int(round(ybot)) + 1, O0)
        yy = ytc + 3 + int(round(ry * .9 * math.sqrt(1 - u * u)))              # 쇠 띠(몸 둘레를 따라 휜다)
        c.p(x, yy, K('iron', 5 if u < -.4 else 4 if u < .3 else 2))
    c.vl(x0 - 1, ytc, yb, O1); c.vl(x1 + 1, ytc, yb, O0)
    c.ell(cx, ytc, rx, ry, None, only=lambda x, y: K(m, 5 if (x - cx) < -rx * .25 and y <= ytc else 4 if (x - cx) < rx * .45 else 3))
    for x in range(x0, x1 + 1):                                               # 뒤 둘레 윤곽 · 앞 둘레 볕
        u = (x - cx) / (rx + .5)
        if abs(u) > 1: continue
        c.p(x, int(round(ytc - ry * math.sqrt(1 - u * u))) - 1, O1)
        c.p(x, int(round(ytc + ry * math.sqrt(1 - u * u))), K(m, 6 if u < .3 else 5))
    for i in range(5):                                                        # 새긴 점 다섯(몸 아래쪽)
        px = int(cx) - 4 + i * 2
        c.p(px, yb - 1, K(m, 0)); c.p(px, yb, K(m, 4))
    # 쇠고리 손잡이: 윗면 뒤쪽 고정쇠에 세운 반원 고리(고리 사이로 윗면이 보인다)
    c.sprite(int(cx) - 3, ytc - 5, ['.oooo..',
                                    'o1221o.',
                                    'o3..4o.',
                                    '.5..3..'], {'o': O1, '1': K('iron', 5), '2': K('iron', 6), '3': K('iron', 3), '4': K('iron', 2), '5': K('iron', 4)})


# ───────────────────────── 경비병 등불 빛 ─────────────────────────
BEAM = [K('yellow', 6), K('gold', 6), K('bread', 6), K('orange', 6), K('yellow', 5), K('bread', 5), K('orange', 5), K('orange', 4)]   # 밝은 → 어두운 따뜻한 빛 여덟 색


def _beam(c):
    """바닥에 깔린 등불 빛(반투명, 알파 ~38~60%). 고른 빛 안에 노랑·주황 여섯 색이 잔물결처럼 섞이고(주기 16, 이웃 칸과 이음매 없음)
    떠다니는 먼지가 반짝인다. 칸 둘레 1px 은 바둑판 디더 — 이웃 칸 둘레와 짝이 엇갈려(15+y 와 0+y) 같은 줄·같은 열로 이으면
    한 줄기 시야선으로 읽힌다(칸마다 등불 알이 박혀 보이지 않게 가운데 뜨거운 점은 없다).
    (빛줄기 끝 조각은 3/4 관문 화풍 반쪽을 네 번 못 넘어 뺐다 — 끝은 이 칸을 그냥 끝내면 된다.)"""
    for y in range(16):
        for x in range(16):
            w = _vn16(x, y, 121) * .7 + _vn16((x * 2) % 16, (y * 2) % 16, 122) * .3       # 잔물결(빛 얼룩)
            band = max(0, min(7, int((1 - w) * 9.5) - 1))
            if (x + 2 * y) % 7 == 0 and band < 7: band += 1                                 # 성긴 디더
            a = 128 + int(w * 28)
            if min(x, y, 15 - x, 15 - y) == 0:                                              # 둘레 바둑판
                a = 96 if (x + y) % 2 else 132
            col = BEAM[band]
            if hnoise(x, y, 123) > .955: col, a = K('white', 6), a + 40                   # 먼지 반짝
            c.p(x, y, col + (max(0, min(255, a)),))


@REG.piece('guard lantern light', '경비병 등불 빛(빛줄기)', 'puzzle', 'flat', 1, 1, 0, 'flat',
           '경비병 등불이 바닥에 비춘 따뜻한 노란빛(반투명) — 같은 줄·같은 열로 이으면 한 줄기 시야선이 된다.', TAGS + ['경비병', '잠입', '빛'],
           '어두운 던전 바닥 위(2층)에 경비병 시야 칸마다 깐다.', [], use=('walk',))
def guard_light(c): _beam(c)




# ───────────────────────── 빙판 바닥 ─────────────────────────
ICE_C, ICE_R = 8, 6
PX, PY = ICE_C * 16, ICE_R * 16


def _pv(ix, iy, s):
    return hnoise(ix % ICE_C, iy % ICE_R, s)


def _vnoise(X, Y, s):
    """주기 PX×PY 값 잡음(격자 16, smoothstep)."""
    gx, gy = X / 16, Y / 16
    ix, iy = int(math.floor(gx)), int(math.floor(gy))
    fx, fy = gx - ix, gy - iy
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = _pv(ix, iy, s), _pv(ix + 1, iy, s)
    c, d = _pv(ix, iy + 1, s), _pv(ix + 1, iy + 1, s)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def _segs():
    """가는 금(짧은 선분)과 반짝임 자리 — 주기 안에 흩어 둔다."""
    out = []
    for i in range(11):
        x, y = hnoise(i, 1, 91) * PX, hnoise(i, 2, 91) * PY
        ang = hnoise(i, 3, 91) * math.pi; L = 5 + hnoise(i, 4, 91) * 9
        out.append((x, y, x + L * math.cos(ang), y + L * math.sin(ang)))
        if hnoise(i, 5, 91) > .45:                                            # 갈래
            a2 = ang + (.7 if hnoise(i, 6, 91) > .5 else -.7); L2 = L * .5
            mx, my = x + L * .55 * math.cos(ang), y + L * .55 * math.sin(ang)
            out.append((mx, my, mx + L2 * math.cos(a2), my + L2 * math.sin(a2)))
    return out


ICE_SEGS = _segs()
ICE_GLINT = [(int(hnoise(i, 7, 92) * PX), int(hnoise(i, 8, 92) * PY)) for i in range(9)]


def _segd(X, Y):
    best = 9.0
    for x0, y0, x1, y1 in ICE_SEGS:
        for ox in (-PX, 0, PX):
            for oy in (-PY, 0, PY):
                ax, ay, bx, by = x0 + ox, y0 + oy, x1 + ox, y1 + oy
                dx, dy = bx - ax, by - ay
                t = max(0, min(1, ((X - ax) * dx + (Y - ay) * dy) / (dx * dx + dy * dy)))
                best = min(best, math.hypot(X - ax - t * dx, Y - ay - t * dy))
    return best


_ICE_CACHE = {}


@REG.floor('ice', '빙판', ICE_C, ICE_R)
def ice(X, Y):
    X %= PX; Y %= PY
    key = (X, Y)
    if key in _ICE_CACHE: return _ICE_CACHE[key]
    _ICE_CACHE[key] = col = _ice(X, Y)
    return col


def _ice(X, Y):
    """매끈한 푸른 얼음: 맑은 4단 바탕에 넓고 부드러운 깊은 3단·윤나는 5단 얼룩(경계는 바둑판 디더), 가는 금(2단 + 왼쪽 위 볕),
    사선 반짝임, 드문 서리 점. 대비는 낮게 — 넓은 바닥이 시끄럽지 않게."""
    v = _vnoise(X, Y, 93) * .75 + _vnoise(X * 2 % PX, Y * 2 % PY, 94) * .25
    chk = (X + Y) % 2
    if v < .23: k = 2 if chk and v < .2 else 3                               # 가장 깊은 푸른 얼룩(5단: 2·3·4·5·6)
    elif v < .36: k = 3
    elif v < .42: k = 3 if chk else 4
    elif v < .68: k = 4
    elif v < .74: k = 5 if chk else 4
    elif v < .84: k = 5
    else: k = 6 if chk or v > .9 else 5                                       # 윤나는 하얀 반사
    d = _segd(X, Y)
    if d < .6: return K('ice', 1 if k == 3 else 2)
    if d < 1.4:
        if _segd(X + 1, Y + 1) < .6: return K('ice', min(6, k + 1))          # 금 왼쪽 위 볕
        if _segd(X - 1, Y - 1) < .6: return K('ice', max(2, k - 1))          # 금 오른쪽 아래 그늘
    for gx, gy in ICE_GLINT:                                                 # 사선 반짝임(오른쪽 위로 3~4px)
        ddx = (X - gx) % PX; ddy = (gy - Y) % PY
        if ddx == ddy and ddx <= 3: return K('ice', 6 if ddx in (1, 2) else 5)
    n = hnoise(X, Y, 99)
    if n > .993: return K('ice', 6)                                          # 서리 점
    if n < .008: return K('ice', max(2, k - 1))
    if hnoise(X, Y, 101) > .996 or hnoise(X - 1, Y - 1, 101) > .996:        # 얼음 속 기포(볕 점 + 오른쪽 아래 그늘)
        return K('ice', 6) if hnoise(X, Y, 101) > .996 else K('ice', 2)
    if (X - Y) % 3 == 0 and hnoise((X + Y) // 5, (X - Y) // 9, 102) > .72:   # 닦인 결(사선으로 옅게 흐르는 볕 줄)
        return K('ice', min(6, k + 1))
    if k == 4 and hnoise(X, Y, 105) > .82: return K('glass', 5)                # 넓은 맑은 얼음 속 잔 반사(평면 채움을 깬다, 명도는 거의 같다)
    if k == 5 and hnoise(X, Y, 106) > .85: return K('ice', 6)
    if k == 3 and hnoise(X // 3, Y // 3, 103) > .6 and (X + Y) % 2:          # 깊은 얼룩 속 푸른 기(유리 램프)
        return K('glass', 4)
    if k == 5 and hnoise(X // 3, Y // 3, 104) > .7 and (X + Y) % 2:
        return K('glass', 5)
    return K('ice', k)
