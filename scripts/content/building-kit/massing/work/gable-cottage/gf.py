"""박공 정면 지붕 · 모임지붕 · 작은 다락창 도우미(gable-cottage·jetty-house·thouse·merchant-house 공용 사본).
난수·잡음 없음 — 변화는 손으로 쓴 표와 좌표로만."""
import common
from common import roof, hip_side, HIP_LIT, HIP_DARK, plaster

common.LIGHTER.update({'σ': 'L', 'ξ': 'σ', 'η': 'ξ', '%': 'θ', '7': '%'})
common.DARKER.update({'σ': 'ξ', 'ξ': 'η', 'η': 'ζ', '%': '7', 'θ': '%', '7': '6'})

# 박공 정면 사면 띠: (윗빛, 빛 받는 왼쪽, 가운데, 골 그늘) — 위 → 아래
LEFT_BANDS = [  # 빛 받는 왼 사면: 낱장 윗머리·왼끝이 노랗게 빛나고 몸은 주황→붉은 테라코타
    ('L', 'σ', 'π', '?'),
    ('L', 'ρ', 'π', '?'),
    ('L', 'ρ', 'π', '<'),
    ('σ', 'ρ', 'π', '<'),
    ('σ', 'π', '<', '='),
    ('ρ', 'π', '<', '='),
    ('ρ', 'ν', '?', '+'),
]
RIGHT_BANDS = [  # 그늘 오른 사면: 붉은 몸 + 보랏빛 골(아래로 너무 어둡지 않게)
    ('ρ', 'π', '<', '@'),
    ('π', 'π', '<', '@'),
    ('π', '<', '?', '@'),
    ('π', '<', '?', '!'),
    ('ν', '<', '=', '!'),
    ('ν', '?', '=', '!'),
    ('ν', '?', '+', '9'),
]
GABLE_LIT = [('L', 'ρ', '#', '?'), ('ρ', 'ρ', '#', '?'), ('L', 'ρ', '?', '#'), ('ρ', 'ρ', '?', '#')]
GABLE_SHADE = [('π', 'π', '@', '='), ('=', '=', '@', '@'), ('π', '=', '!', '@'), ('=', '@', '!', '=')]
LAP = [0, 3, 5, 1, 4, 2, 6, 3, 0, 5, 2, 4, 1, 6]   # 줄마다 낱장 이음 자리(손 순서)


def slope_stripes(c, inside, x0, x1, y0, y1, bands, tw=6, th=3, start=0):
    """사면을 따라 누운 둥근 기와: th 화소마다 한 띠(윗줄 빛 · 몸 · 아랫줄 그늘), 낱장 이음은 LAP 순서로 어긋난다."""
    for y in range(y0, y1 + 1):
        k = (y - y0) // th
        r = (y - y0) % th
        lt, body, sh, gap = bands[(k + start) % len(bands)]
        off = LAP[(k + start) % len(LAP)]
        for x in range(x0, x1 + 1):
            if not inside(x, y):
                continue
            u = (x + off) % tw
            if r == th - 1:
                ch = sh
            elif u == tw - 1:
                ch = gap
            elif r == 0 and u < tw - 2:
                ch = lt
            else:
                ch = body
            c.put(x, y, ch)


# 정면과 나란한 앞 사면(중간 테라코타 위주)
FRONT_BANDS = [  # 정면과 나란한 앞 사면: 붉은 테라코타 몸 + 주황 윗빛 + 보라 골(버들항 앞 사면 결)
    ('σ', 'ρ', 'π', '@'),
    ('ρ', 'π', '<', '@'),
    ('ρ', 'π', '<', '!'),
    ('ρ', 'π', '<', '!'),
    ('π', 'π', '?', '!'),
    ('π', '<', '?', '9'),
    ('ν', '<', '=', '9'),
]

VAR2 = [  # 박공 사면용 낱장 변화표(손으로 씀)
    '0100020000100004000010002000',
    '0002000010000200001000000100',
    '2000010000020000100000400000',
    '0010000400000100000200010000',
    '0000200001000000010000020001',
    '1000000020001000400010000000',
    '0004001000000200000001000200',
    '0200000100020000010000400000',
    '0000100000400001000200000100',
    '0010002000000100000000201000',
    '4000000010002000100100000000',
    '0001000200000000020000010004',
]


def tiles(c, inside, x0, x1, y0, y1, bands, tw=4, th=4, var=None, vshift=0, hshift=0):
    """박공 사면 기와: 줄마다 아래 1화소 골 그늘(뚜렷한 기와 줄), 낱장 왼 위 빛, 오른끝 틈. 반 장 엇갈림."""
    var = var or VAR2
    n = (y1 - y0 + 1 + th - 1) // th
    for y in range(y0, y1 + 1):
        k = (y - y0) // th
        r = (y - y0) % th
        hi, lt, md, dk = bands[min(len(bands) - 1, k * len(bands) // max(1, n))]
        off = (k % 2) * (tw // 2) + hshift
        for x in range(x0, x1 + 1):
            if not inside(x, y):
                continue
            t = (x + off) // tw
            u = (x + off) % tw
            row = var[(k + vshift) % len(var)]
            v = row[t % len(row)]
            h2, l2, m2, d2 = hi, lt, md, dk
            if v == '1':
                h2, l2, m2 = common.LIGHTER[hi], common.LIGHTER[lt], common.LIGHTER[md]
            elif v == '2':
                h2, l2, m2 = lt, md, common.DARKER[md]
            if v == '3' and r >= th - 2 and u <= 2:
                ch = 'O' if (r == th - 2 and u < 2) else 'M'
            elif u == tw - 1:
                ch = d2
            elif r == th - 1:
                ch = d2 if (u == 0 or v == '4') else common.DARKER.get(m2, d2)
            elif u == 0:
                ch = h2 if r < th - 2 else l2
            elif r == 0:
                ch = l2
            else:
                ch = m2
            c.put(x, y, ch)


def gable_front(c, x0, x1, apex_y, knee_y, eave_y, gpeak_y, gx0, gx1, vshift=0, attic=True, lb=None, rb=None,
                post=True, board=3):
    """박공 정면 질량의 지붕: 꼭짓점(apex) → 용마루가 북쪽으로 물러난 세로선(가운데) → 박공 삼각벽(남쪽).
    왼 사면 밝고 오른 사면 어둡다. 바깥 윤곽은 knee_y 까지 사선, 그 아래 처마까지 세로.
    삼각벽 밑변 = eave_y+2 줄(gx0..gx1), 그 아래는 호출자가 보·벽을 그린다. 돌려줌: 삼각벽 안쪽 판정 함수."""
    lb = lb or LEFT_BANDS
    rb = rb or RIGHT_BANDS
    W = x1 - x0 + 1
    ctr = x0 + W / 2.0           # 가운데(화소 경계)
    cxl = x0 + W // 2 - 1        # 용마루 왼 화소
    half = W / 2.0

    def hw(y):
        if y >= knee_y:
            return half
        return half * (y - apex_y + 1) / (knee_y - apex_y + 1)

    gb = eave_y + 2
    ghalf = (gx1 - gx0 + 1) / 2.0
    gctr = gx0 + ghalf

    def gw(y):
        return ghalf * (y - gpeak_y + 1) / (gb - gpeak_y + 1)

    def in_gable(x, y):
        return gpeak_y <= y <= gb and abs(x + 0.5 - gctr) <= gw(y)

    def inside(x, y):
        return apex_y <= y <= eave_y and abs(x + 0.5 - ctr) <= hw(y)

    # 남북 박공의 동서 사면(㉒): 둥근 기와가 사면을 따라 동서로 누워 화면에서 가로 띠로 보인다(버들항 박공 기준).
    # 왼 사면 = 빛(긴 낱장 · 노란 윗줄), 오른 사면 = 그늘 붉은 띠(짧은 낱장). 낱장 이음은 손 순서로 어긋난다.
    slope_stripes(c, lambda x, y: inside(x, y) and x <= cxl, x0, cxl, apex_y, eave_y, GABLE_LIT, tw=7, start=vshift)
    slope_stripes(c, lambda x, y: inside(x, y) and x > cxl, cxl + 1, x1, apex_y, eave_y, GABLE_SHADE, tw=4,
                  start=vshift + 3)
    # 용마루: 얇은 마룻기와 두 화소(㉓ 굵은 세로 판 금지) — 왼쪽 붉은 · 오른쪽 짙은
    for y in range(apex_y, gpeak_y + 1):
        c.put(cxl, y, '<' if (y % 2) else '*')
        c.put(cxl + 1, y, '7' if (y % 3) else '6')
    # 바깥 윤곽(재질 어두운 단): 왼쪽 갈색 · 오른쪽 짙은 보라
    for y in range(apex_y, eave_y + 1):
        xs = [x for x in range(x0, x1 + 1) if inside(x, y)]
        if not xs:
            continue
        l, r = xs[0], xs[-1]
        c.put(l, y, 'α' if y % 3 else '-')
        if r - l > 3:
            c.put(r, y, '-' if y % 3 else '9')
        # 왼 사선 안쪽 밝은 마구리(빛)
        if y < knee_y and r - l > 6:
            c.put(l + 1, y, 'σ' if y % 2 else 'ξ')
        # 사선 바깥 계단에 한 화소 더(층계 지는 윤곽을 부드럽게)
        if y < knee_y and y > apex_y:
            pl = [x for x in range(x0, x1 + 1) if inside(x, y - 1)]
            if pl and pl[0] - l > 1:
                for x in range(l + 1, pl[0]):
                    c.put(x, y, 'ξ' if x == l + 1 else c.get(x, y))
    # 처마끝(삼각벽 바깥)
    for x in range(x0, x1 + 1):
        if in_gable(x, eave_y + 1) or in_gable(x, eave_y + 2):
            continue
        c.put(x, eave_y + 1, '&' if x % 4 else '9')
        c.put(x, eave_y + 2, '7' if x % 4 == 1 else '%')
    c.put(x0, eave_y + 1, 'α')
    c.put(x0, eave_y + 2, '-')
    c.put(x1, eave_y + 2, '-')
    # 삼각벽: 회벽 + 박공널(밝은 왼널 · 어두운 오른널) + 널 밑 그늘
    for y in range(gpeak_y, gb + 1):
        for x in range(gx0, gx1 + 1):
            if not in_gable(x, y):
                continue
            d = gw(y) - abs(x + 0.5 - gctr)
            left = x + 0.5 < gctr
            if d < 1:
                ch = '-' if left else '9'
            elif d < 2:
                ch = 'ξ' if left else 'η'
            elif d < board:
                ch = 'η' if left else 'ε'
            elif d < board + 1:
                ch = 'β' if left else '_'
            elif d < board + 2:
                ch = 'c' if left else 'f'
            elif d < board + 3:
                ch = 'l'
            else:
                ch = None
            if ch:
                c.put(x, y, ch)
    # 회벽 점묘 안쪽
    for y in range(gpeak_y, gb + 1):
        for x in range(gx0, gx1 + 1):
            if in_gable(x, y) and gw(y) - abs(x + 0.5 - gctr) >= board + 3:
                m = common.PLASTER_DOTS[(y + 3) % len(common.PLASTER_DOTS)]
                ch = m[(x + 5) % len(m)]
                c.put(x, y, '3' if ch == '.' else ch)
    # 꼭대기 장식(마룻대 끝)
    gc = int(gctr) - 1
    c.put(gc, gpeak_y, 'ξ')
    c.put(gc + 1, gpeak_y, 'η')
    if post and not attic:  # 가운데 동자 기둥(다락창이 있으면 기둥이 창에서 끊기므로 두지 않는다)
        for y in range(gpeak_y + board + 2, gb + 1):
            c.put(gc, y, 'ε')
            c.put(gc + 1, y, 'β')
    if attic:
        aw, ah = attic if isinstance(attic, tuple) else (8, 7)
        ay = gb - ah - 3
        small_window(c, gc + 1 - aw // 2, ay, aw, ah)
    return in_gable


def small_window(c, x, y, w=8, h=7):
    """다락 작은 창: 나무 틀 + 십자 살 + 하늘 반짝."""
    for j in range(h):
        for i in range(w):
            edge = i in (0, w - 1) or j in (0, h - 1)
            if edge:
                ch = 'η' if (i == 0 or j == 0) else 'β'
            elif i == w // 2:
                ch = 'ε'
            elif j == 1:
                ch = 'D'
            else:
                ch = 'A' if j < h - 2 else 'B'
            c.put(x + i, y + j, ch)
    c.put(x + 1, y + 1, 'F')
    c.put(x + 1, y + 2, '^')
    c.put(x + w // 2 + 1, y + 1, 'E')
    for i in range(-1, w + 1):
        c.put(x + i, y + h, 'm' if i < w // 2 else 'h')


def hip_roof(c, x0, x1, ridge_y, eave_y, rl, rr, vshift=0, knee_frac=0.72, eave_rows=True):
    """정면과 나란한 용마루(rl..rr) + 양 끝 모임(왼 밝은 사면·오른 그늘 사면). cottage 의 모임지붕을 일반화."""
    SL = (rl - x0) / (eave_y - ridge_y)
    SR = (x1 - rr) / (eave_y - ridge_y)
    lx = lambda y: rl - (y - ridge_y) * SL  # noqa: E731
    rx = lambda y: rr + (y - ridge_y) * SR  # noqa: E731
    knee = ridge_y + int((eave_y - ridge_y) * knee_frac)

    def out_l(y):
        return max(float(x0), (rl - 3) - (y - ridge_y) * (rl - 3 - x0) / (knee - ridge_y))

    def out_r(y):
        return min(float(x1), (rr + 3) + (y - ridge_y) * (x1 - rr - 3) / (knee - ridge_y))

    roof(c, lambda x, y: lx(y) + 1 < x < rx(y) - 1, x0, x1, ridge_y + 2, eave_y, vshift=vshift)
    hip_side(c, lambda x, y: out_l(y) - 0.5 <= x <= lx(y) + 1, x0, x1, ridge_y + 1, eave_y, HIP_LIT)
    hip_side(c, lambda x, y: rx(y) - 1 <= x <= out_r(y) + 0.5, x0, x1, ridge_y + 1, eave_y, HIP_DARK, hshift=2)
    for y in range(ridge_y + 1, eave_y + 1):
        x = int(round(lx(y)))
        c.put(x, y, 'η')
        c.put(x + 1, y, 'η')
        c.put(x - 1, y, 'σ' if (y % 3) else 'L')
        xr = int(round(rx(y)))
        c.put(xr - 1, y, '_')
        c.put(xr, y, '_')
        c.put(xr + 1, y, 'θ' if (y % 3) else '%')
    for y in range(ridge_y + 1, eave_y + 2):
        xo = int(round(out_l(y)))
        c.put(xo, y, '-' if y % 2 else 'α')
        xo = int(round(out_r(y)))
        c.put(xo, y, '-' if y % 3 else '9')
    for x in range(rl - 2, rr + 3):
        c.put(x, ridge_y, 'ζ' if x in (rl - 2, rr + 2) else ('σ' if x % 4 else 'ξ'))
        c.put(x, ridge_y + 1, '-' if x % 4 else 'α')
    if eave_rows:
        for x in range(x0, x1 + 1):
            c.put(x, eave_y + 1, '&' if x % 4 else '9')
            c.put(x, eave_y + 2, '7' if x % 4 == 1 else ('6' if x % 4 == 3 else '%'))
        c.put(x0, eave_y + 1, 'α')
        c.put(x1, eave_y + 1, '-')
        c.put(x0, eave_y + 2, '-')
        c.put(x1, eave_y + 2, '-')
    return lx, rx, out_l, out_r


def foundation(c, x0, x1, y, step=None):
    for x in range(x0, x1 + 1):
        c.put(x, y, 'a' if x % 7 == 0 else ('i' if x % 5 else 'm'))
        c.put(x, y + 1, 'U' if x % 6 else 'X')
    if step:
        for x in range(step[0], step[1] + 1):
            c.put(x, y, 'r' if x % 4 else 'm')
            c.put(x, y + 1, 'Z')


# ---------------------------------------------------------------- 잔 막돌(버들항처럼 작고 촘촘한 연분홍·연보라 돌)
SMALL_W = [5, 7, 4, 6, 5, 4, 7, 5, 4, 6, 7, 5, 4, 6, 5, 7, 6, 4, 5, 6]   # 돌 너비(손 순서, 틈 포함)
SMALL_FACE = 'oqlolxoqlfowqolfoxqlolqfowlq'                           # 돌 바탕(손 순서)
COURSES = [4, 3, 4, 4, 3, 4, 3, 4]                                    # 줄 높이(손 순서)
SF_HI = {'o': 'q', 'q': 'r', 'l': 'o', 'x': 'z', 'w': 'y', 'f': 'l'}
SF_LO = {'o': 'l', 'q': 'o', 'l': 'f', 'x': 'v', 'w': 'u', 'f': 'c'}


def small_rubble(c, x0, y0, w, h, start=0, skip=None):
    """잔 막돌 — common.rubble(평평한 돌 면, 2~4px 줄, 손 순서 폭)에 연분홍·연보라 바탕을 준다."""
    common.rubble(c, x0, y0, w, h, [3, 2, 3, 2, 4, 3, 2, 3], skip=skip, start=start,
                  faces='olqlxofqlowlqxolflqow', widths=[4, 3, 6, 2, 5, 4, 3, 7, 4, 2, 5, 3, 6, 4])


def auto_walk(c, roof_rows, door_col, door_rows):
    """칸마다 그림이 있으면 roof_rows 줄까지는 '*', 그 아래는 'X'. 문 칸은 'D'."""
    out = []
    T = 16
    for cy in range(c.h // T):
        r = ''
        for cx in range(c.w // T):
            op = any(c.g[y][x] != '.' for y in range(cy * T, cy * T + T) for x in range(cx * T, cx * T + T))
            if not op:
                r += '.'
            elif cx == door_col and cy in door_rows:
                r += 'D'
            else:
                r += '*' if cy < roof_rows else 'X'
        out.append(r)
    return out
