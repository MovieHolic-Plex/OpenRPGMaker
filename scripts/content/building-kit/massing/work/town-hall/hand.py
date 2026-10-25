"""손 기와·막돌·굴뚝·통 도우미 (market-hall · town-hall · warehouse · brewery 공용 사본). 난수·잡음 없음.

버들항 기와 낱장(4×4)을 본뜨되 줄마다 어긋남·낱장마다 밝기를 손 표로 바꾼다:
    S N S G      N = 빛 받은 돌기(주황), S = 몸 그늘, G = 골
    N N S G
    N N G G
    G S S S
"""

TILE = ['SNSG', 'NNSG', 'NNGG', 'GSSS']
# 줄 어긋남(줄마다, 손으로 씀 — 4의 배수 반복이 아니다)
ROW_OFF = [0, 2, 1, 3, 2, 0, 3, 1, 2, 0, 1, 3, 0, 2, 3, 1, 0, 3, 2, 1, 3, 0, 2, 1]
# 낱장 변화(손 표, 길이 41 — 격자 주기와 어긋나게): 0 보통 · 1 밝은 새 기와 · 2 묵은 기와 · 3 돌기 이 빠짐 · 4 이끼 · 5 아주 밝음
TVAR = ('00100200001000310002000100020100001020001'
        '01000020010000200100030001000200100002000'
        '00020001000100002001000020004000100020010'
        '10000200100003000100200001000020001000100')

FACES = {
    # 면: 띠별 (N, S, G) — 위(용마루) → 아래(처마)
    'front': [('π', '<', '$'), ('π', '<', '$'), ('π', '?', '$'), ('π', '?', '@'), ('ν', '=', '@')],
    'lit':   [('σ', 'ρ', '<'), ('ρ', 'π', '<'), ('ρ', 'π', '?'), ('ρ', 'π', '?')],
    'dark':  [('<', '@', '!'), ('<', '@', '!'), ('?', '!', '9'), ('?', '!', '9')],
    # 청석(대성당 지붕 결)
    'sfront': [('G', 'F', 'E'), ('G', 'F', 'E'), ('G', 'E', 'B'), ('F', 'E', 'B')],
    'slit':   [('H', 'G', 'F'), ('H', 'G', 'F'), ('G', 'G', 'E')],
    'sdark':  [('F', 'E', 'B'), ('E', 'B', 'C'), ('E', 'B', 'C')],
}
BRIGHT = {'π': 'ρ', 'ρ': 'L', 'σ': 'L', 'L': 'L', 'ν': 'π', '<': 'π', '?': '<', '=': '?', '$': '@', '@': '?',
          '!': '@', '9': '!', 'G': 'H', 'H': 'I', 'I': 'I', 'F': 'G', 'E': 'F', 'B': 'E', 'C': 'B'}
DULL = {'π': '<', 'ρ': 'π', 'σ': 'ρ', 'L': 'σ', 'ν': '?', '<': '?', '?': '@', '=': '@', '$': '9', '@': '!',
        '!': '9', '9': '9', 'G': 'F', 'H': 'G', 'I': 'H', 'F': 'E', 'E': 'B', 'B': 'C', 'C': 'C'}


def btiles(c, inside, x0, x1, y0, y1, face='front', seed=0, th=4, tw=4, bands=None):
    """inside(x,y) 화소에 손 기와. 줄 높이 th, 낱장 너비 tw. 띠는 위→아래로 face 표를 따라간다."""
    bands = bands or FACES[face]
    n = max(1, (y1 - y0 + 1 + th - 1) // th)
    for y in range(y0, y1 + 1):
        k = (y - y0) // th
        r = (y - y0) % th
        N, S, G = bands[min(len(bands) - 1, k * len(bands) // n)]
        off = ROW_OFF[(k + seed) % len(ROW_OFF)]
        for x in range(x0, x1 + 1):
            if not inside(x, y):
                continue
            t = (x + off) // tw
            u = (x + off) % tw
            v = TVAR[(t * 7 + k * 13 + seed * 5) % len(TVAR)]
            n_, s_, g_ = N, S, G
            slate = face.startswith('s')
            if v == '1':
                n_, s_ = (BRIGHT[N], BRIGHT[S]) if not slate else ({'F': 'G'}.get(N, N), {'E': 'F', 'B': 'E'}.get(S, S))
            elif v == '5':
                n_ = 'L' if not slate else ('H' if face == 'slit' else N)
            elif v == '2':
                n_, s_ = DULL[N], DULL[S]
            ch = TILE[r % 4][u % 4] if th == 4 else TILE[min(3, r * 4 // th)][u % 4]
            col = {'N': n_, 'S': s_, 'G': g_}[ch]
            if v == '3' and r in (1, 2) and u < 2:
                col = s_
            if v == '4' and r >= 2 and u < 3:
                col = 'N' if (u + r) % 2 else 'M'
            c.put(x, y, col)


def ridge(c, x0, x1, y, slate=False):
    """용마루: 마룻대(짙은 갈색 윗선) + 마룻기와 밝은 돌기 줄."""
    for x in range(x0, x1 + 1):
        c.put(x, y, 'ζ')
        c.put(x, y + 1, '-' if not slate else 'β')
        c.put(x, y + 2, ('L' if x % 4 in (1, 2) else 'ρ') if not slate else ('H' if x % 4 in (1, 2) else 'G'))


def eave(c, x0, x1, y, slate=False):
    for x in range(x0, x1 + 1):
        c.put(x, y, ('&' if x % 4 else '%') if not slate else ('E' if x % 4 else 'B'))
        c.put(x, y + 1, '7' if x % 3 else '%')


def hip_roof(c, x0, x1, ridge_y, eave_y, rl, rr, seed=0, knee_frac=0.55, slate=False, eave_rows=True):
    """정면과 나란한 용마루(rl..rr) + 양 끝 모임(왼 밝은 사면·오른 그늘 사면). 손 기와.
    바깥 윤곽: 용마루 끝 → knee 까지 사선, 그 아래 처마까지 세로. 돌려줌 (lx, rx, out_l, out_r)."""
    pre = 's' if slate else ''
    SLp = (rl - x0) / (eave_y - ridge_y)
    SR = (x1 - rr) / (eave_y - ridge_y)
    lx = lambda y: rl - (y - ridge_y) * SLp  # noqa: E731
    rx = lambda y: rr + (y - ridge_y) * SR  # noqa: E731
    knee = ridge_y + max(2, int((eave_y - ridge_y) * knee_frac))

    def out_l(y):
        return max(float(x0), (rl - 2) - (y - ridge_y) * (rl - 2 - x0) / (knee - ridge_y))

    def out_r(y):
        return min(float(x1), (rr + 2) + (y - ridge_y) * (x1 - rr - 2) / (knee - ridge_y))

    btiles(c, lambda x, y: lx(y) < x < rx(y), x0, x1, ridge_y + 3, eave_y, pre + 'front', seed=seed)
    btiles(c, lambda x, y: out_l(y) - 0.5 <= x <= lx(y), x0, x1, ridge_y + 1, eave_y, pre + 'lit', seed=seed + 3)
    btiles(c, lambda x, y: rx(y) <= x <= out_r(y) + 0.5, x0, x1, ridge_y + 1, eave_y, pre + 'dark', seed=seed + 7)
    for y in range(ridge_y + 1, eave_y + 1):     # 모임 마루(왼 빛 받는 마룻기와 · 오른 짙은 선)
        x = int(round(lx(y)))
        c.put(x, y, 'ξ')
        c.put(x + 1, y, 'η')
        c.put(x - 1, y, 'σ' if y % 3 else 'L')
        xr = int(round(rx(y)))
        c.put(xr - 1, y, 'η')
        c.put(xr, y, 'ε')
        c.put(xr + 1, y, '_' if not slate else 'C')
    ridge(c, rl - 1, rr + 1, ridge_y, slate)
    if eave_rows:
        eave(c, x0, x1, eave_y + 1, slate)
    return lx, rx, out_l, out_r


# ---------------------------------------------------------------- 막돌(잔돌) — 회반죽은 갈회색(보라 줄눈 아님)
RUB_W = [5, 3, 6, 4, 5, 7, 3, 4, 6, 5, 4, 3, 6, 5, 4, 7, 3, 5, 4, 6, 3, 5, 6, 4, 5]
RUB_H = [4, 3, 4, 3, 3, 4, 4, 3]
RUB_F = 'jkmjinkjmkijnjmkjikmjnjikmj'           # 돌 바탕(회색 단)
RUB_WARM = {'j': 'g', 'k': 'p', 'm': 'p', 'n': 'o', 'i': 'f'}
RUB_WARMS = '0010000100100000100010000100'


def rubble(c, x0, y0, w, h, start=0, shade=None, mortar='Y', skip=None, warm=True):
    """잔 막돌: 돌 3~7 × 3~4, 위 1화소 밝은 모, 오른·아래 줄눈. shade(x,y) 는 -2..+1 로 돌 밝기를 민다."""
    ST = ['U', 'W', 'Y', 'a', 'e', 'i', 'j', 'k', 'm', 'n', 'r', 's']
    y = y0
    k = 0
    n = start * 3
    while y < y0 + h:
        ch_h = RUB_H[(k + start) % len(RUB_H)]
        x = x0 - (k * 2 + start) % 4
        wi = (k * 3 + start) % len(RUB_W)
        while x < x0 + w:
            sw = RUB_W[wi % len(RUB_W)]
            wi += 1
            face = RUB_F[n % len(RUB_F)]
            warmed = warm and RUB_WARMS[n % len(RUB_WARMS)] == '1'
            n += 1
            for j in range(ch_h):
                for i in range(sw):
                    px, py = x + i, y + j
                    if px < x0 or px >= x0 + w or py >= y0 + h or (skip and skip(px, py)):
                        continue
                    if j == ch_h - 1 or i == sw - 1:
                        col = mortar if (i + j + px) % 5 else 'X'
                    else:
                        t = ST.index(face)
                        if j == 0:
                            t += 1
                        elif j == ch_h - 2 and ch_h > 2:
                            t -= 1
                        if i == 0:
                            t += 1
                        if shade:
                            t += shade(px, py)
                        t = max(2, min(11, t))
                        col = ST[t]
                        if warmed and col in RUB_WARM:
                            col = RUB_WARM[col]
                    c.put(px, py, col)
            x += sw
        y += ch_h
        k += 1


# ---------------------------------------------------------------- 굴뚝: 위에서 본 갓돌 고리 + 연기 구멍, 막돌 몸, 비스듬한 밑동
def chimney(c, cx, top, base_l, base_r, cw=10):
    """cx 왼끝, top 갓돌 윗줄, 밑동은 왼쪽 base_l → 오른쪽 base_r 로 지붕 경사를 따라 비스듬히(띠 받침 없음).
    밑동 밑으로 지붕에 그늘 1~2화소."""
    cap = [
        'Y' + 'k' * (cw - 2) + 'a',
        'Y' + 'n' + 'U' * (cw - 4) + 'j' + 'a',
        'Y' + 'n' + 'U' + 'T' * (cw - 6) + 'U' + 'j' + 'a',
        'Y' + 'r' + 'm' * (cw - 4) + 'k' + 'a',
        'X' + 'i' * (cw - 3) + 'e' + 'X',
        '.W' + 'Y' * (cw - 4) + 'W.',
    ]
    for j, row in enumerate(cap):
        for i, ch in enumerate(row):
            c.put(cx - 1 + i, top + j, ch) if i in (0, len(row) - 1) and j < 4 else c.put(cx - 1 + i, top + j, ch)
    # 몸: 갓돌보다 1화소 좁은 회갈색 막돌(돌 크기·줄 높이 제각각) — 왼 밝고 오른 그늘, 밑동은 지붕 경사를 따른다
    sx0, sx1 = cx, cx + cw - 3
    body_top = top + len(cap)
    lim = lambda px: base_l + (base_r - base_l) * (px - sx0) / max(1, sx1 - sx0)  # noqa: E731
    rubble(c, sx0, body_top, sx1 - sx0 + 1, max(base_l, base_r) - body_top + 1, start=cx % 7,
           shade=lambda px, py: (1 if px <= sx0 + 1 else 0) - (2 if px >= sx1 - 1 else 0) - (1 if py < body_top + 2 else 0),
           skip=lambda px, py: py > lim(px))
    for px in range(sx0, sx1 + 1):                # 바깥 테(왼 밝은 회 · 오른 짙은 회)
        for py in range(body_top, int(lim(px)) + 1):
            if px == sx0:
                c.put(px, py, 'e' if py % 4 else 'a')
            elif px == sx1:
                c.put(px, py, 'W' if py % 3 else 'X')
    # 지붕에 지는 그늘: 오른쪽 2열 + 밑동 아래 1줄(지붕 화소만)
    from bits import darken
    for py in range(body_top + 2, max(base_l, base_r) + 3):
        for k2, n in ((1, 2), (2, 1)):
            darken(c, sx1 + k2 + 1, py, n)
    for px in range(sx0, sx1 + 3):
        lim = int(round(base_l + (base_r - base_l) * (min(px, sx1) - sx0) / max(1, sx1 - sx0)))
        darken(c, px, lim + 1, 2)


# ---------------------------------------------------------------- 통(barrel): 위 타원 윗면 + 쇠테 + 통널
def barrel(c, x, y, w=10, h=12, lid='ξ'):
    """(x,y) 왼 위. 위 4줄은 타원 윗면(뒤 테 → 뚜껑 판 → 앞 테), 몸은 가운데가 불룩(위·아래 1화소 좁다), 쇠테 둘.
    왼 밝고 오른 어둡다."""
    top = [  # 타원 윗면: 가운데가 넓다
        '..' + 'ζ' * (w - 4) + '..',
        '.ζ' + 'σ' + lid * (w - 5) + 'η' + '.',
        'ζ' + 'ξ' + lid * (w - 4) + 'η' + 'ε',
        '.ζ' + 'η' * (w - 4) + 'ε' + '.',
    ]
    for j, r in enumerate(top):
        c.rows(x, y + j, [r[:w]])
    for j in range(4, h):
        inset = 1 if j in (4, h - 1) else 0
        for i in range(inset, w - inset):
            if i == inset:
                ch = 'δ'
            elif i == w - inset - 1:
                ch = '-'
            elif j in (5, h - 3):
                ch = 'k' if i < w // 2 else ('e' if i < w - 2 else 'X')    # 쇠테
            elif i == 1 + inset:
                ch = 'θ'
            elif i >= w - 3:
                ch = 'ε' if (i + j) % 2 else 'δ'
            elif (i + 1) % 3 == 0:
                ch = 'ε'                                                      # 통널 틈
            else:
                ch = 'θ' if i < w // 2 else 'η'
            if j == h - 1:
                ch = 'δ' if i < w - 2 else '-'
            c.put(x + i, y + j, ch)
