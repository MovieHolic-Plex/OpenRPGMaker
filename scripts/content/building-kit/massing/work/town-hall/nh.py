"""manor · dormer-house · keep-tower 다시 그리기 도우미(이 셋 전용 사본). 난수·잡음 없음.

vtiles  — 남북 박공(삼각벽 남쪽)의 동서 사면: 기와 줄이 처마와 나란히(화면에서 세로) 선다.
          줄은 용마루에서 바깥으로 4px 씩, 줄마다 바깥쪽 1px 이 겹침 그늘, 낱장은 세로로 엇갈린다.
cwin    — 버들항식 깨끗한 창: 짙은 남색 유리 + 한 점 반짝임 + 세로 살, 덧문·커튼·불빛·꽃상자·창턱 길이를 창마다 다르게.
stipple — 회벽 점묘(손 규칙). 층마다 k 를 바꾸면 무늬가 달라진다.
edge_report — 바깥 테두리 화소의 가장 어두운 밝기·먹(≤0.13) 개수.
"""
from bits import darken
from hand import TILE, ROW_OFF, TVAR, FACES, BRIGHT, DULL


# 세로 기와 줄 낱장(줄 폭 4 × 낱장 길이 5): r 0 = 용마루 쪽 빛 받는 머리, 3 = 바깥 겹침 그늘 줄
VTILE = ['NNNNS',
         'NNNSS',
         'SSSSG',
         'GGGGG']


def vtiles(c, inside, x0, x1, y0, y1, ridge_x, side, face, seed=0, tw=4, th=5):
    """side = -1 왼 사면(용마루 왼쪽), +1 오른 사면. ridge_x = 용마루 화소(그 바깥부터 기와)."""
    bands = FACES[face]
    span = max(1, (x1 - x0 + 1))
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if not inside(x, y):
                continue
            d = (ridge_x - x) if side < 0 else (x - ridge_x)
            if d < 0:
                continue
            k = d // tw                      # 용마루에서 몇 번째 줄
            r = d % tw                       # 줄 안(0 = 용마루 쪽 윗머리, 3 = 바깥 겹침 그늘)
            off = ROW_OFF[(k + seed) % len(ROW_OFF)]
            t = (y + off) // th
            u = (y + off) % th
            n_bands = max(1, (span + tw - 1) // tw)
            N, S, G = bands[min(len(bands) - 1, k * len(bands) // n_bands)]
            v = TVAR[(t * 7 + k * 13 + seed * 5) % len(TVAR)]
            n_, s_ = N, S
            if v == '1':
                n_, s_ = BRIGHT[N], BRIGHT[S]
            elif v == '2':
                n_, s_ = DULL[N], DULL[S]
            elif v == '5':
                n_ = 'σ' if face == 'lit' else N
            ch = VTILE[r][u]
            col = {'N': n_, 'S': s_, 'G': G}[ch]
            if v == '3' and u in (1, 2) and r < 2:
                col = s_
            c.put(x, y, col)


GLINT = [(1, 1), (2, 1), (1, 2), (3, 1)]


def cwin(c, x, y, w=8, h=13, frame='stone', shutters='both', curtain=False, lit=False, box=False, sill=1,
         glint=0, transom=False, arch=False):
    fl, fr, ft = ('n', 'h', 'r') if frame == 'stone' else ('η', 'β', 'ξ')
    mid = x + w // 2
    for j in range(h):
        for i in range(w):
            xx = x + i
            if arch and j == 0 and i in (0, w - 1):
                continue
            if i == 0:
                ch = fl
            elif i == w - 1:
                ch = fr
            elif j == 0:
                ch = ft
            elif j == h - 1:
                ch = 'e' if frame == 'stone' else 'β'
            elif xx == mid:
                ch = 'e' if frame == 'stone' else 'ε'
            elif transom and j == h // 3:
                ch = 'e' if frame == 'stone' else 'ε'
            elif lit:
                ch = 'L' if (j < 3 and i < w // 2) else ('K' if j < h - 3 else 'τ')
            else:
                ch = 'b' if j == 1 else ('D' if j < h - 3 else '>')
            c.put(xx, y + j, ch)
    if not lit:
        gx, gy = GLINT[glint % len(GLINT)]
        c.put(x + gx, y + gy, '^')
        if glint % 2:
            c.put(x + gx + 1, y + gy + 1, 'b')
    if curtain:
        for j in range(1, h - 1):
            c.put(x + 1, y + j, '&' if j % 3 else '+')
            c.put(x + w - 2, y + j, '+' if j % 3 else '&')
    def shutter(sx):
        for j in range(h):
            for k in range(3):
                ch = ('η', 'ε', 'β')[k] if (j % 3) else ('ε', 'δ', 'β')[k]
                if j == 0:
                    ch = 'ζ'
                c.put(sx + k, y + j, ch)
    if shutters in ('both', 'left'):
        shutter(x - 3)
    if shutters in ('both', 'right'):
        shutter(x + w)
    lo = -sill
    hi = w + sill - 1
    for i in range(lo, hi + 1):
        if box and 0 <= i < w:
            flw = 'MκNLMκOLNM'
            c.put(x + i, y + h - 1, flw[(i + glint * 3) % len(flw)])
            c.put(x + i, y + h, 'η' if i % 4 else 'ζ')
            c.put(x + i, y + h + 1, 'δ')
        else:
            c.put(x + i, y + h, 'r' if i < w // 2 else 'm')
            c.put(x + i, y + h + 1, 'i' if i < w // 2 else 'e')


def stipple(c, x0, y0, x1, y1, k=0, base='3'):
    """회벽 점묘 2~3단(손 규칙). k 로 층마다 다른 결."""
    A, B, C2 = [(5, 3, 7), (3, 7, 5), (7, 5, 3)][k % 3]
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if c.get(x, y) != base:
                continue
            q = (x * A + y * B + ((x + y * 2) // 5) * C2) % 11
            ch = {0: 'z', 4: '5', 7: '0', 9: '5'}.get(q)
            if (x * 7 + y * 11 + k * 5) % 41 == 0:
                ch = 'y'
            elif (x * 3 + y * 13 + k) % 31 == 0:
                ch = 'x'
            if ch:
                c.put(x, y, ch)


def edge_report(c, legend):
    def lum(h):
        r, g, b = int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255
    bad = []
    mn = 1
    for y in range(c.h):
        for x in range(c.w):
            ch = c.get(x, y)
            if ch == '.':
                continue
            if any(not (0 <= x + a < c.w and 0 <= y + b < c.h) or c.get(x + a, y + b) == '.'
                   for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                L = lum(legend[ch])
                mn = min(mn, L)
                if L <= 0.13:
                    bad.append((x, y, ch))
    return mn, bad


def ns_gable(c, x0, x1, apex_y, knee_y, eave_y, gpeak_y, seed, infill, valley_left=True, valley_right=True, board=True):
    wdt = x1 - x0 + 1
    ctr = x0 + wdt / 2.0
    rx = x0 + wdt // 2 - 1                 # 용마루 왼 화소
    half = wdt / 2.0

    def hw(y):
        return half if y >= knee_y else half * (y - apex_y + 1) / (knee_y - apex_y + 1)

    gb = eave_y + 2

    def gw(y):
        return half * (y - gpeak_y + 1) / (gb - gpeak_y + 1)

    def in_gable(x, y):
        return gpeak_y <= y <= gb and abs(x + 0.5 - ctr) <= gw(y)

    def inside(x, y):
        return apex_y <= y <= gb and abs(x + 0.5 - ctr) <= hw(y) and not in_gable(x, y)

    vtiles(c, lambda x, y: inside(x, y) and x < rx, x0, rx - 1, apex_y, gb, rx - 1, -1, 'lit', seed=seed)
    vtiles(c, lambda x, y: inside(x, y) and x > rx + 1, rx + 2, x1, apex_y, gb, rx + 2, +1, 'dark', seed=seed + 3)
    for y in range(apex_y, gpeak_y + 1):   # 얇은 마룻기와(세로): 빛 받는 왼 · 그늘 오른
        c.put(rx, y, 'σ' if y % 4 == 1 else 'ξ')
        c.put(rx + 1, y, 'η' if y % 4 else 'ζ')
    for y in range(apex_y, gb + 1):        # 바깥 처마(동서 처마끝: 세로 줄) + 위 골
        xs = [x for x in range(x0, x1 + 1) if inside(x, y) or in_gable(x, y)]
        if not xs:
            continue
        l, r = xs[0], xs[-1]
        if y >= knee_y:
            c.put(l, y, 'ε' if y % 3 else 'δ')
            c.put(l + 1, y, 'ξ' if y % 2 else 'η')
            c.put(r, y, '%' if y % 3 else '7')
            c.put(r - 1, y, '@')
        else:                              # 골: 본채 앞 사면과 만나는 사선
            if valley_left:
                c.put(l, y, 'ξ')
                darken(c, l - 1, y, 2)
            if valley_right:
                c.put(r, y, '@')
                darken(c, r + 1, y, 2)
                darken(c, r + 2, y, 1)
    # 박공널(남쪽 삼각 사선): 얇은 기와 끝 줄 + 널(왼 밝음 · 오른 그늘) + 밑 그늘
    for y in range(gpeak_y, gb + 1):
        for x in range(x0, x1 + 1):
            if not in_gable(x, y):
                continue
            d = gw(y) - abs(x + 0.5 - ctr)
            left = x + 0.5 < ctr
            if d < 1:
                ch = 'ε' if left else '@'
            elif d < 2:
                ch = 'σ' if left else '<'
            elif d < 3:
                ch = 'ξ' if left else 'ε'
            elif d < 4:
                ch = 'c' if left else 'Y'
            else:
                ch = None
            if ch:
                c.put(x, y, ch)
    infill(lambda x, y: in_gable(x, y) and gw(y) - abs(x + 0.5 - ctr) >= 4, int(ctr), gpeak_y, gb)
    c.put(rx, gpeak_y - 1, 'ξ')            # 꼭대기 마구리(용마루 끝, 삼각 꼭짓점에 닿는다)
    c.put(rx + 1, gpeak_y - 1, 'η')
    return in_gable


