"""청석(slate) 모임지붕·박공 지붕창·청석 박공 정면 도우미 (dormer-house·manor·keep-tower 공용 사본).
난수·잡음 없음 — 변화는 pix 의 손 표(SLATE_VAR)와 좌표로만. 빛 왼쪽 위."""
import pix
from common import hip_side, PLASTER_DOTS

SL = pix.SL  # C B E F G H


# 앞 사면 청석 낱장(5×4) — 버들항 병영 지붕처럼 작고 고른 장: 왼 위 1화소 반짝, 아래 줄 겹침 그늘, 오른 틈.
# 글자 = SL 인덱스(0 C · 1 B · 2 E · 3 F · 4 G · 5 H)
FT = {
    '0': ['45442', '44442', '34432', '22221'],
    '1': ['55442', '45442', '44432', '22221'],   # 새 장(밝다)
    '2': ['44332', '43332', '33332', '22221'],   # 묵은 장(어둡다)
    '3': ['45442', '42242', '34432', '22221'],   # 이 빠진 장
}
SHIFT = {1: {3: 4, 4: 5}, 0: {}, -1: {5: 4, 4: 3}, -2: {5: 3, 4: 3, 3: 2}}


def slate_fill(c, inside, x0, x1, y0, y1, shade=None, seed=0, tw=5, th=4):
    """inside 화소에 청석 낱장(5×4, 줄마다 반 장 엇갈림). shade(x,y) → +1 밝음 / 0 / -1 / -2."""
    for y in range(y0, y1 + 1):
        row = (y - y0) // th
        lv = (y - y0) % th
        off = (3 if row % 2 else 0) + seed + (row // 2) % 2
        for x in range(x0, x1 + 1):
            if not inside(x, y):
                continue
            col = (x + off) // tw
            lu = (x + off) % tw
            var = pix.SLATE_VAR[(row * 13 + col * 3 + seed * 5) % len(pix.SLATE_VAR)]
            s = shade(x, y) if shade else 0
            i = int(FT[var][lv % 4][lu % 5])
            i = SHIFT[max(-2, min(1, s))].get(i, i)
            c.put(x, y, SL[i])


HIP_LIT_S = [('I', 'G', 'F', 'E'), ('H', 'G', 'F', 'E'), ('I', 'H', 'F', 'G')]
HIP_DARK_S = [('F', 'E', 'B', 'B'), ('E', 'E', 'B', 'C'), ('F', 'E', 'C', 'B')]


def slate_hip_roof(c, x0, x1, ridge_y, eave_y, rl, rr, seed=0, knee_frac=0.5, front_shade=None):
    """정면과 나란한 용마루(rl..rr) + 양 끝 모임(왼 밝은 사면·오른 그늘 사면), 청석.
    모임 선은 갈색 마룻대(버들항 병영 지붕 결). 돌려줌: lx, rx, out_l, out_r."""
    SLp = (rl - x0) / (eave_y - ridge_y)
    SR = (x1 - rr) / (eave_y - ridge_y)
    lx = lambda y: rl - (y - ridge_y) * SLp  # noqa: E731
    rx = lambda y: rr + (y - ridge_y) * SR  # noqa: E731
    knee = ridge_y + int((eave_y - ridge_y) * knee_frac)

    def out_l(y):
        return max(float(x0), (rl - 3) - (y - ridge_y) * (rl - 3 - x0) / (knee - ridge_y))

    def out_r(y):
        return min(float(x1), (rr + 3) + (y - ridge_y) * (x1 - rr - 3) / (knee - ridge_y))

    def fshade(x, y):
        s = 0
        if front_shade:
            s = front_shade(x, y)
        if y > eave_y - 3:
            s -= 1
        return s

    slate_fill(c, lambda x, y: lx(y) + 1 < x < rx(y) - 1, x0, x1, ridge_y + 2, eave_y, fshade, seed=seed)
    hip_side(c, lambda x, y: out_l(y) - 0.5 <= x <= lx(y) + 1, x0, x1, ridge_y + 1, eave_y, HIP_LIT_S, tw=5, th=3)
    hip_side(c, lambda x, y: rx(y) - 1 <= x <= out_r(y) + 0.5, x0, x1, ridge_y + 1, eave_y, HIP_DARK_S, tw=5, th=3,
             hshift=2)
    for y in range(ridge_y + 1, eave_y + 1):
        x = int(round(lx(y)))
        c.put(x, y, 'η')
        c.put(x + 1, y, 'ε')
        c.put(x - 1, y, 'σ' if (y % 3) else 'ξ')
        xr = int(round(rx(y)))
        c.put(xr - 1, y, 'ε')
        c.put(xr, y, '_')
        c.put(xr + 1, y, 'B')
    for y in range(ridge_y + 1, eave_y + 2):
        xo = int(round(out_l(y)))
        c.put(xo, y, 'E' if y % 2 else 'B')
        xo = int(round(out_r(y)))
        c.put(xo, y, 'C' if y % 3 else 'B')
    for x in range(rl - 2, rr + 3):
        c.put(x, ridge_y, 'ε' if x in (rl - 2, rr + 2) else ('ξ' if x % 5 else 'η'))
        c.put(x, ridge_y + 1, 'H' if x % 5 in (1, 2) else ('G' if x % 5 else 'E'))
    for x in range(rl, rr + 1, 5):
        c.put(x, ridge_y, 'σ')
    return lx, rx, out_l, out_r


def slate_eave(c, x0, x1, y):
    """처마끝 두 줄: 청석 끝 + 짙은 받침(갈색 처마널)."""
    for x in range(x0, x1 + 1):
        c.put(x, y, 'E' if x % 5 else 'B')
        c.put(x, y + 1, 'ε' if x % 6 else 'β')
        c.put(x, y + 2, '_' if x % 4 else '-')
    c.put(x0, y, 'B')
    c.put(x1, y, 'C')


def dormer(c, cx, top, base, w=15, ww=7, thick=6):
    """작은 박공 지붕창(청석 지붕): 꼭짓점 (cx, top), 창 앞벽 밑 = base. 오른쪽 아래로 그늘을 지붕에 드리운다.
    w = 지붕 너비(홀수). 지붕 사면은 thick 화소 두께로 보이고(왼 밝음·오른 어둠), 그 안에 앞 삼각벽(회벽+박공널)과 창."""
    hw = w // 2
    # 지붕: 꼭짓점에서 45도로 벌어져 hw 에 닿은 뒤 처마까지 세로
    eave = base - 6
    for y in range(top, eave + 1):
        j = y - top
        span = min(hw, j)
        for x in range(cx - span, cx + span + 1):
            d = x - cx
            if d < 0:
                ch = 'G' if (j - d) % 4 else 'H'
                if (j + 1) % 4 == 0:
                    ch = 'F'
                if x == cx - span:
                    ch = 'ξ' if j % 3 else 'η'
                elif x == cx - span + 1:
                    ch = 'I' if j % 3 == 0 else 'H'
            elif d == 0:
                ch = 'η' if j % 3 else 'ξ'
            else:
                ch = 'E' if (j + d) % 4 else 'F'
                if (j + 1) % 4 == 0:
                    ch = 'B'
                if x == cx + span:
                    ch = '_'
                elif x == cx + span - 1 and j < hw:
                    ch = 'B'
            c.put(x, y, ch)
    for x in range(cx - hw, cx + hw + 1):     # 지붕창 처마끝(갈색 처마널)
        c.put(x, eave + 1, 'ε' if x > cx else 'η')
    # 앞 삼각벽 + 세로벽
    gy0 = top + thick
    for y in range(gy0, base + 1):
        k = y - gy0
        span = min(hw - 3, k)
        for x in range(cx - span, cx + span + 1):
            d = abs(x - cx)
            if d >= span - 1 and k < hw - 3:
                ch = 'η' if x < cx else 'ε'      # 박공널
            elif d >= span - 2 and k < hw - 2:
                ch = 'β' if x < cx else '_'
            else:
                m = PLASTER_DOTS[y % len(PLASTER_DOTS)]
                ch = '3' if m[x % len(m)] == '.' else m[x % len(m)]
                if x >= cx + span - 1:
                    ch = 'z'
                if x <= cx - span:
                    ch = 'y'
            c.put(x, y, ch)
    # 창
    wy = base - 9
    for j in range(9):
        for i in range(ww):
            x = cx - ww // 2 + i
            edge = i in (0, ww - 1) or j in (0, 8)
            if edge:
                ch = 'η' if (i == 0 or j == 0) else 'β'
            elif i == ww // 2 or j == 4:
                ch = 'ε'
            else:
                ch = 'D' if j < 3 else ('B' if j > 5 else 'A')
            c.put(x, wy + j, ch)
    c.put(cx - ww // 2 + 1, wy + 1, 'F')
    c.put(cx - ww // 2 + 1, wy + 2, '^')
    c.put(cx + 1, wy + 1, 'E')
    for i in range(-1, ww + 1):
        c.put(cx - ww // 2 + i, base, 'm' if i < ww // 2 else 'h')
    # 밑 함석 물막이 + 오른쪽 그늘
    for x in range(cx - hw + 1, cx + hw):
        c.put(x, base + 1, 'i' if x < cx else 'Z')
    DK = {'H': 'G', 'I': 'G', 'G': 'F', 'F': 'E', 'E': 'B', 'B': 'C'}
    for y in range(top + hw, base + 3):
        for x in (cx + hw + 1, cx + hw + 2):
            g = c.get(x, y)
            c.put(x, y, DK.get(g, g))
    for x in range(cx - hw + 2, cx + hw + 3):
        g = c.get(x, base + 2)
        c.put(x, base + 2, DK.get(g, g))


# 회벽 둘째 점묘(손 motif) — 첫 점묘 위에 겹쳐 회벽 3 의 넓은 면을 줄인다
PLASTER_DOTS2 = [
    '.....2.......4..',
    '..........0.....',
    '.4..............',
    '.......2.....0..',
    '...0............',
    '...........4....',
    '......0.........',
    '.2..........2...',
    '.........4......',
    '....4...........',
    '..............0.',
]


def plaster_more(c, x0, y0, x1, y1, ox=0, oy=0):
    for y in range(y0, y1 + 1):
        m = PLASTER_DOTS2[(y + oy) % len(PLASTER_DOTS2)]
        for x in range(x0, x1 + 1):
            ch = m[(x + ox) % len(m)]
            if ch != '.' and c.get(x, y) == '3':
                c.put(x, y, ch)


def slate_gable(c, x0, x1, apex_y, knee_y, eave_y, gpeak_y, gx0, gx1, seed=0, board=3, wall=None, post=False):
    """박공 정면 질량의 청석 지붕(gf.gable_front 의 청석판): 꼭짓점 → 북쪽으로 물러난 세로 용마루 → 남쪽 박공 삼각벽.
    왼 사면 밝고(+1) 오른 사면 어둡다(-1). 바깥 윤곽 knee 까지 사선, 그 아래 처마까지 세로.
    삼각벽 밑변 = eave_y+2. wall(x, y) 가 주어지면 삼각벽 속을 그것으로 칠한다(기본 회벽 점묘).
    돌려줌: (inside, in_gable)."""
    W = x1 - x0 + 1
    ctr = x0 + W / 2.0
    cxl = x0 + W // 2 - 1
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

    slate_fill(c, lambda x, y: inside(x, y) and x <= cxl, x0, cxl, apex_y, eave_y,
               shade=lambda x, y: 1 if ((x + 1) // 5 + y // 4) % 3 else 0, seed=seed)
    slate_fill(c, lambda x, y: inside(x, y) and x > cxl, cxl + 1, x1, apex_y, eave_y,
               shade=lambda x, y: -1, seed=seed + 2)
    # 용마루(갈색 마룻대): 왼 빛 · 오른 그늘
    for y in range(apex_y, gpeak_y + 1):
        c.put(cxl - 1, y, 'ξ' if (y % 4) else 'σ')
        c.put(cxl, y, 'η')
        c.put(cxl + 1, y, 'ε' if (y % 4) else 'β')
        c.put(cxl + 2, y, 'B')
    # 바깥 윤곽(재질 어두운 단)
    for y in range(apex_y, eave_y + 1):
        xs = [x for x in range(x0, x1 + 1) if inside(x, y)]
        if not xs:
            continue
        l, r = xs[0], xs[-1]
        c.put(l, y, 'ξ' if y % 3 else 'η')
        if r - l > 3:
            c.put(r, y, '_' if y % 3 else '-')
        if y < knee_y and r - l > 6:
            c.put(l + 1, y, 'I' if y % 2 else 'H')
    # 처마끝(삼각벽 바깥)
    for x in range(x0, x1 + 1):
        if in_gable(x, eave_y + 1) or in_gable(x, eave_y + 2):
            continue
        c.put(x, eave_y + 1, 'E' if x % 5 else 'B')
        c.put(x, eave_y + 2, 'ε' if x % 6 else 'β')
    # 삼각벽: 박공널(밝은 왼널 · 어두운 오른널) + 널 밑 그늘 + 속
    for y in range(gpeak_y, gb + 1):
        for x in range(gx0, gx1 + 1):
            if not in_gable(x, y):
                continue
            d = gw(y) - abs(x + 0.5 - gctr)
            left = x + 0.5 < gctr
            if d < 1:
                ch = 'η' if left else '_'
            elif d < 2:
                ch = 'ξ' if left else 'ε'
            elif d < board:
                ch = 'η' if left else 'β'
            elif d < board + 1:
                ch = 'β' if left else '_'
            elif d < board + 2:
                ch = 'c' if left else 'f'
            else:
                if wall:
                    ch = wall(x, y)
                else:
                    m = PLASTER_DOTS[(y + 3) % len(PLASTER_DOTS)]
                    ch = m[(x + 5) % len(m)]
                    ch = '3' if ch == '.' else ch
                    if d < board + 3:
                        ch = 'l'
            c.put(x, y, ch)
    gc = int(gctr) - 1
    c.put(gc, gpeak_y, 'ξ')
    c.put(gc + 1, gpeak_y, 'η')
    if post:
        for y in range(gpeak_y + board + 2, gb + 1):
            c.put(gc, y, 'ε')
            c.put(gc + 1, y, 'β')
    return inside, in_gable
