"""조선 집 블록 세트 — 버들항(pj.py)과 같은 3/4 조립 문법.

모든 블록은 16×16 한 칸이고 이름으로 부른다. 집은 그리는 게 아니라 조립한다.
  지붕 행 : roof.ridge(밝은 뒷사면+처마 끝 막새) / roof.front(용마루 띠+그늘진 앞사면) / roof.body(앞사면) / roof.eave(앞사면+막새+서까래 밑)
            각각 .l(맞배 풍판 끝) .m .r
  벽 위행 : u.<kind>   kind: l r(끝 기둥) p(회벽) w(창호) d(문 윗반)     — 창방(보) 아래 10px
  벽 아래행: b.<kind>  kind: l r p f(창 아래 머름) d(문 아랫반)          — 맨 아래 5px 는 석축 기단
  계단    : step
스타일: jo(기와집, 회벽) jc(초가, 황토) pv(정자: 주홍 기둥, 열린 칸 o, 난간 k)
빛은 왼쪽 위: 뒷사면이 밝고 앞사면이 어둡다.
"""
from tk import *
from build import outline

STYLE_ROOF = {'jo': 'giwa', 'jc': 'straw', 'pv': 'giwa', 'gw': 'giwa'}


def _px(c, x, y, col):
    c.put(x, y, col)


def _scale(x, y, ph, tones):
    """세로 기왓골 지붕(기준 문법): 4px 주기 [밝음, 기본, 어두움, 기본], 6행마다 한 장 끝 마디(마디는 한 톤만 어둡게)."""
    deep, dark, base, hi = tones
    gy = y + ph * T
    k = x % 4
    col = [hi, base, dark, base][k]
    seg = gy % 6
    if seg == 5 and k in (1, 2): col = dark if col == base else deep
    if seg == 0 and k in (0, 1): col = hi
    return col


def roof_block(style, row, side, ph=0):
    c = Cv(T, T)
    if style == 'jc':
        return thatch_roof_block(row, side)
    G = RGB['giwa']; W = RGB['wood']
    back_t = (G[2], G[3], G[4], G[5])
    front_t = (G[1], G[2], G[3], G[4])
    for y in range(T):
        for x in range(T):
            if row == 'ridge':
                if y == 0: col = G[2]
                elif y in (1, 2):                      # 뒤쪽 처마 끝 막새
                    col = (G[5] if y == 1 else G[4]) if x % 4 in (0, 1) else G[2]
                elif y <= 12: col = _scale(x, y, 1, back_t)
                elif y == 13: col = G[5]                # 용마루 마루기와
                else: col = G[4]
            elif row == 'front':
                if y == 0: col = G[4]
                elif y == 1: col = G[2]
                elif y == 2: col = G[1]                 # 용마루 그림자
                else: col = _scale(x, y, 2, front_t)
            elif row == 'body':
                col = _scale(x, y, 3, front_t)
            else:                                       # eave
                if y <= 8: col = _scale(x, y, 4, front_t)
                elif y <= 12:                           # 막새: 둥근 끝 기와, 사이는 그늘
                    k = x % 4
                    if k in (0, 1): col = [G[5], G[6], G[5], G[3]][y - 9] if y - 9 < 4 else G[3]
                    else: col = [G[2], G[2], G[1], G[1]][y - 9]
                else:                                   # 처마 밑(서까래 끝)
                    col = W[1]
                    if y == 14 and x % 4 == 1: col = W[4]
                    if y == 13 and x % 4 == 1: col = W[3]
            c.put(x, y, col)
    if side in ('l', 'r'):
        xs = (0, 1) if side == 'l' else (15, 14)
        for y in range(T):
            if row == 'eave' and y >= 13:
                continue
            c.put(xs[0], y, W[4] if y % 8 else W[3]); c.put(xs[1], y, W[2])      # 풍판(박공 널)
    return c


def thatch_roof_block(row, side):
    """볏짚 지붕: 굵은 짚 묶음이 비늘처럼 겹침(폭 6·높이 5, 줄마다 어긋남) + 마루의 둥근 용마름."""
    c = Cv(T, T)
    S = RGB['straw']; E = RGB['earth']
    lit = row == 'ridge'
    base = 5 if lit else 4
    ph = {'ridge': 0, 'front': 1, 'body': 2, 'eave': 3}[row]
    for y in range(T):
        for x in range(T):
            gy = y + ph * T
            course = gy // 5
            lx = (x + (3 if course % 2 else 0)) % 6
            ly = gy % 5
            idx = base
            if ly == 0: idx += 1                       # 짚 묶음 윗입술
            elif ly == 4: idx -= 2                     # 묶음 사이 그늘
            elif ly == 3: idx -= 1
            if lx in (0, 5) and ly in (1, 2, 3): idx -= 1          # 묶음 좌우 경계
            if rnd(x, y, 22) > 0.97: idx += 1
            c.put(x, y, S[max(1, min(6, idx))])
    if row == 'ridge':
        for x in range(T): c.put(x, 0, S[3])
        for y in (10, 11, 12, 13, 14, 15):             # 용마름: 마루를 덮은 둥근 짚 덮개(위 밝고 아래 어둡게)
            for x in range(T):
                tone = {10: 6, 11: 5, 12: 5, 13: 4, 14: 3, 15: 2}[y]
                c.put(x, y, S[tone] if (x // 3 + y) % 4 else S[tone - 1])
    if row == 'front':
        for x in range(T): c.put(x, 0, S[2]); c.put(x, 1, S[1])
    if row == 'eave':
        for x in range(T):
            ln = 3 + int(rnd(x, 3, 9) * 3)
            for y in range(10, 16):
                c.put(x, y, (S[2] if (x + y) % 3 else S[3]) if y - 10 < ln else E[2])
    if side in ('l', 'r'):
        for y in range(T):
            for k in range(3):
                x = k if side == 'l' else 15 - k
                if row == 'ridge' and y < 3 - k:
                    c.a[y, x, 3] = 0
                elif k == 0:
                    c.put(x, y, S[2])
    return c


def _column(c, x, y0, y1, ramp='wood'):
    r = RGB[ramp]
    hi, mid, lo = (r[4], r[3], r[2]) if ramp == 'red' else (r[5], r[4], r[2])
    for y in range(y0, y1):
        c.put(x, y, hi); c.put(x + 1, y, mid); c.put(x + 2, y, lo)


def _wall_fill(c, ramp, y0, y1, x0=0, x1=T, seed=0):
    p = RGB[ramp]
    for y in range(y0, y1):
        for x in range(x0, x1):
            q = rnd(x, y, 40 + seed)
            c.put(x, y, p[4] if q > 0.15 else p[3])
            if q > 0.97: c.put(x, y, p[5])


def _lattice(c, x0, y0, x1, y1, step=3, rows=(4,)):
    w = RGB['wood']; p = RGB['plaster']
    for y in range(y0, y1):
        for x in range(x0, x1):
            c.put(x, y, p[5] if rnd(x, y, 60) > 0.1 else p[4])
    for x in range(x0 + step, x1 - 1, step):
        c.vl(x, y0, y1, w[4])
    for r in rows:
        if y0 + r < y1: c.hl(x0, x1, y0 + r, w[4])
    c.vl(x0, y0, y1, w[5]); c.vl(x1 - 1, y0, y1, w[2])


def _plank_door(c, y_off, ytop, lower=False):
    """판문(널문): 세로 널 + 가로 띠 + 장식 못."""
    W = RGB['wood']; T6 = RGB['straw']
    y0, y1 = (0, 12) if lower else (ytop, T)
    for y in range(y0, y1):
        for x in range(3, T):
            col = W[4] if (x - 3) % 4 else W[3]
            if (x - 3) % 4 == 0: col = W[5] if (x - 3) % 8 == 0 else W[3]
            c.put(x, y, col)
    for yy in ((4, 8) if not lower else (3,)):
        for x in range(3, T): c.put(x, yy, W[2])
    for x in (6, 10, 14):
        for yy in ((5, 9) if not lower else (4, 8)):
            if y0 <= yy < y1: c.put(x, yy, T6[6])
    if lower:
        for x in range(3, T): c.put(x, 11, W[2])


def thatch_wall_block(half, kind):
    """초가 전용 황토 회벽, 작은 창, 널문. 기와·정자 블록과 분리."""
    c = Cv(T, T)
    E, P, W = RGB['earth'], RGB['plaster'], RGB['wood']
    for y in range(T):
        for x in range(T):
            col = P[4]
            if rnd(x // 2, y // 2, 41) < .035: col = E[6]
            c.put(x, y, col)
    if half == 'u':
        c.rect(0, 0, T, 3, E[3]); c.hl(0, T, 3, W[4])
        c.hl(0, T, 4, W[3])
        for y in (5, 6):
            for x in range(T):
                if (x + y) % 2 == 0: c.put(x, y, E[4])
        if kind == 'w':
            c.rect(5, 8, 13, 16, W[3]); c.rect(6, 9, 12, 16, P[5])           # 한지 살창: 세로 살만
            for xx in (7, 9, 11): c.vl(xx, 9, 16, W[4])
    else:
        if kind == 'f':
            c.rect(5, 0, 13, 5, W[3]); c.rect(6, 0, 12, 5, P[5])
            for xx in (7, 9, 11): c.vl(xx, 0, 5, W[4])
            c.hl(5, 13, 5, W[4])
        if kind != 'o': c.hl(0, T, 14, E[3]); c.hl(0, T, 15, E[2])
        else: c.hl(0, T, 14, E[2]); c.hl(0, T, 15, E[1])
    if kind == 'o':                                   # 열린 마루칸: 어두운 방 안, 앞에 마루 윗면과 마루 앞 널
        if half == 'u':
            for y in range(5, T):
                for x in range(T): c.put(x, y, E[0] if y < 11 else E[1])
            for x in range(3, T - 2, 5): c.vl(x, 5, T, W[1])
        else:
            for y in range(0, 7):
                for x in range(T): c.put(x, y, E[1] if y > 1 else E[0])
            for y in range(7, 11):
                for x in range(T): c.put(x, y, W[5] if y == 7 else (W[4] if (x // 5 + y) % 2 else W[3]))
            c.hl(0, T, 11, W[5]); c.hl(0, T, 12, W[2]); c.hl(0, T, 13, W[1])
    if kind == 'd':                                   # 한지 바른 격자 미닫이(외짝): 세로 살 셋 + 가로대, 손잡이 없음
        y0, y1 = (7, 16) if half == 'u' else (0, 14)
        c.rect(4, y0, 14, y1, W[3])
        c.rect(5, y0 + 1, 13, y1 - (3 if half == 'b' else 0), P[5])
        for xx in (7, 9, 11): c.vl(xx, y0 + 1, y1 - (3 if half == 'b' else 0), W[4])
        c.hl(5, 13, y0 + (4 if half == 'u' else 4), W[4])
        if half == 'b':
            c.rect(5, 11, 13, 14, W[4]); c.hl(5, 13, 11, W[5])           # 머름 널
    c.rect(0, 3 if half == 'u' else 0, 2, 16, W[4])
    if kind == 'r': c.rect(14, 3 if half == 'u' else 0, 16, 16, W[3])
    return c


def thatch_plinth_block(steps=False):
    """낮은 흙·막돌 기단과 문 앞 넓은 디딤돌 한 장."""
    c = Cv(T, T); E, S = RGB['earth'], RGB['stone']
    c.rect(0, 0, T, 5, E[3]); c.hl(0, T, 0, E[5])
    for x in range(1, T, 7):
        c.rect(x, 1, x + 5, 4, S[4]); c.rect(x, 1, x + 4, 2, S[5])
    if steps:
        c.rect(3, 5, 14, 9, E[3]); c.rect(3, 5, 14, 7, S[5])
    return c


def wall_block(style, half, kind, base=True, dan=False):
    """half 'u' 또는 'b'."""
    if style == 'jc':
        return thatch_wall_block(half, kind)
    c = Cv(T, T)
    W = RGB['wood']; St = RGB['stone']
    wallramp = {'jo': 'plaster', 'jc': 'earth', 'pv': 'wood', 'gw': 'plaster'}[style]
    colramp = 'red' if style == 'gw' else 'wood'
    if half == 'u':
        # y0..1 처마 그늘, 2..4 창방(보), 5 그림자, 6..15 벽
        for x in range(T):
            c.put(x, 0, W[1]); c.put(x, 1, W[1]); c.put(x, 2, W[5])
            c.put(x, 3, W[4]); c.put(x, 4, W[1] if style != 'pv' else W[2]); c.put(x, 5, W[1] if style == 'pv' else RGB['plaster'][2] if style in ('jo', 'gw') else RGB['earth'][2])
        if dan:
            g, b, rd = RGB['green'], RGB['blue'], RGB['red']
            pat = [g[5], g[5], g[4], rd[4], rd[5], b[5], b[4], b[4]]
            for x in range(T):
                col = pat[x % 8]
                c.put(x, 2, col); c.put(x, 3, [g[4], g[4], g[3], rd[3], rd[4], b[4], b[3], b[3]][x % 8]); c.put(x, 4, [g[3], g[3], g[2], rd[2], rd[3], b[3], b[2], b[2]][x % 8])
        if style == 'pv':
            for x in range(T): c.put(x, 6, W[1])
            for y in range(6, T):
                for x in range(T): c.put(x, y, W[3] if x % 5 else W[2])
        else:
            _wall_fill(c, wallramp, 6, T, seed=1)
            for x in range(T): c.put(x, 6, RGB[wallramp][2])        # 보 그림자
        if kind == 'w':
            _lattice(c, 4, 8, 15 if True else 14, T, 3, (4,))
        if kind == 'd':
            _lattice(c, 3, 7, 15, T, 3, (4, 9))
        if kind == 'g':
            _plank_door(c, 0, 7)
        _column(c, 0, 2, T, colramp)
        if kind == 'r':
            _column(c, 13, 2, T, colramp)
    else:
        top = 12 if base else T
        if style == 'pv':
            for y in range(0, top):
                for x in range(T): c.put(x, y, W[3] if x % 5 else W[2])
            if kind == 'k':
                # 난간: 위 가로대 + 가는 살 + 마루 바닥
                for x in range(T):
                    c.put(x, 1, W[5]); c.put(x, 2, W[4]); c.put(x, 3, W[2])
                    c.put(x, 8, W[4]); c.put(x, 9, W[3])
                for x in range(2, T, 4): c.vl(x, 3, 8, W[3])
                for y in range(10, top):
                    for x in range(T): c.put(x, y, W[5] if y % 3 else W[4])
            else:
                for y in range(8, top):
                    for x in range(T): c.put(x, y, W[5] if y % 3 else W[4])
        else:
            _wall_fill(c, wallramp, 0, 12, seed=2)
        if kind == 'f':
            _lattice(c, 4, 0, 15, 6, 3, (4,))
            for x in range(3, T): c.put(x, 6, W[6]); c.put(x, 7, W[5]); c.put(x, 8, W[4]); c.put(x, 9, W[3]); c.put(x, 10, W[3]); c.put(x, 11, W[2])
        if kind == 'd':
            _lattice(c, 3, 0, 15, 9, 3, (4,))
            for x in range(3, T): c.put(x, 10, W[5]); c.put(x, 11, W[3])
        if kind == 'g':
            _plank_door(c, 0, 0, lower=True)
        # 기단 (석축)
        if base:
            for x in range(T):
                c.put(x, 12, St[6]); c.put(x, 13, St[5]); c.put(x, 14, St[4] if rnd(x, 14, 8) > 0.2 else St[5]); c.put(x, 15, St[3])
            c.vl(7, 14, 15, St[3])
        _column(c, 0, 0, 12 if base else T, colramp)
        if kind == 'r':
            _column(c, 13, 0, 12 if base else T, colramp)
    return c


def step_block(side='m'):
    c = Cv(T, T)
    St = RGB['stone']
    for t, (y0, x0, x1) in enumerate(((0, 2, 14), (6, 0, 16))):
        for y in range(y0, y0 + 6):
            for x in range(x0, x1):
                top = y < y0 + 2
                c.put(x, y, St[6] if y == y0 else (St[5] if top else (St[4] if rnd(x, y, 3) > 0.3 else St[3])))
        c.hl(x0, x1, y0 + 5, St[2])
    return c


def chimi_block(side):
    """용마루 끝 치미(위로 말려 올라간 마감 기와)."""
    c = Cv(T, T)
    G = RGB['giwa']
    pts = [(7, 15), (8, 15), (9, 15), (7, 14), (8, 14), (9, 14), (7, 13), (8, 13), (9, 13), (6, 12), (7, 12), (8, 12), (9, 12), (6, 11), (7, 11), (8, 11), (6, 10), (7, 10), (5, 9), (6, 9), (5, 8), (6, 8)]
    for x, y in pts:
        c.put(x if side == 'l' else 15 - x, y, G[5] if x <= 6 else G[3])
    for x, y in ((8, 14), (8, 13)):
        c.put(x if side == 'l' else 15 - x, y, G[2])
    return c


def plinth_block(steps=False):
    """석축 기단 8px. steps=True 면 그 밑 8px 에 디딤돌 두 단을 붙인다."""
    c = Cv(T, T)
    St = RGB['stone']
    for y in range(8):
        for x in range(T):
            q = rnd(x, y, 90)
            c.put(x, y, St[5] if q > 0.25 else St[4])
            if q > 0.95: c.put(x, y, St[6])
    c.hl(0, T, 0, St[6]); c.hl(0, T, 4, St[3]); c.hl(0, T, 7, St[2])
    c.vl(5, 1, 4, St[3]); c.vl(12, 5, 7, St[3])
    if steps:
        for t, (y0, x0, x1) in enumerate(((8, 3, 13), (12, 1, 15))):
            for y in range(y0, y0 + 4):
                for x in range(x0, x1):
                    c.put(x, y, St[6] if y == y0 else (St[5] if y == y0 + 1 else (St[4] if rnd(x, y, 3) > 0.3 else St[3])))
            c.hl(x0, x1, y0 + 3, St[2])
    return c


def ridge_chimi(style, side):
    """치미: 용마루 끝에 앉은 낮고 넓은 마감 기와(윗끝이 바깥으로 말림). 용마루 칸 안에서 끝난다."""
    c = roof_block(style, 'ridge', 'm')
    G = RGB['giwa']
    def P(x, y, col):
        c.put(x if side == 'l' else 15 - x, y, col)
    rows = {13: (3, 11), 12: (3, 11), 11: (4, 11), 10: (4, 10), 9: (4, 9), 8: (3, 9), 7: (3, 8), 6: (2, 8)}
    for y, (x0, x1) in rows.items():
        for x in range(x0, x1 + 1):
            if x in (x0, x1): col = G[1]
            elif y in (13, 6): col = G[2]
            else: col = G[6] if x <= x0 + 2 else (G[5] if x < x1 - 1 else G[3])
            P(x, y, col)
    for x, y in ((1, 5), (2, 5), (3, 5), (0, 4), (1, 4), (0, 3)):      # 말린 윗끝
        P(x, y, G[6] if y == 5 and x > 1 else G[5])
    for x, y in ((0, 5), (1, 6), (2, 4), (4, 5), (1, 3), (0, 2), (-0, 6)):
        if 0 <= x <= 15: P(x, y, G[1])
    return c


def library():
    L = {}
    for st in ('jo', 'jc', 'pv', 'gw'):
        for row in ('ridge', 'front', 'body', 'eave'):
            for side in ('l', 'm', 'r'):
                L[f'{st}.roof.{row}.{side}'] = roof_block(st, row, side, ph=0)
        for kind in ('l', 'r', 'p', 'w', 'd', 'o', 'g'):
            L[f'{st}.u.{kind}'] = wall_block(st, 'u', kind)
            L[f'{st}.ud.{kind}'] = wall_block(st, 'u', kind, dan=True)
        for kind in ('l', 'r', 'p', 'f', 'd', 'k', 'g', 'o'):
            L[f'{st}.b.{kind}'] = wall_block(st, 'b', kind)
    L['jc.plinth'] = thatch_plinth_block()
    L['jc.plinths'] = thatch_plinth_block(True)
    L['step'] = step_block()
    L['plinth'] = plinth_block(); L['plinths'] = plinth_block(True)
    L['jo.roof.ridge.cl'] = ridge_chimi('jo', 'l'); L['jo.roof.ridge.cr'] = ridge_chimi('jo', 'r')
    L['pv.roof.ridge.cl'] = ridge_chimi('pv', 'l'); L['pv.roof.ridge.cr'] = ridge_chimi('pv', 'r')
    return L


def roof_baram(cv, R=3, style='giwa', wing=24, trim=False):
    """바람의나라 연구형 기와 지붕으로 위 R 행을 통째로 바꾼다(몸채 폭 전체 + 날개면 + 곡선 처마). roof3d.py."""
    import roof3d
    H = R * T
    cv.a[:H, :, :] = 0
    r = roof3d.roof(cv.w - 16, H, style, wing=max(14, wing - 7))
    cv.paste(r, 8, 0)
    if trim:
        eave_trim(cv, H)
    eave_fill(cv, H)
    dither_under(cv, H, 4)
    if trim:
        plaque(cv, H + 1)


def plaque(cv, y0, w=16):
    """현판: 처마 밑 가운데에 거는 어두운 편액(금빛 글자 점)."""
    W = RGB['wood']; S = RGB['straw']
    x0 = (cv.w - w) // 2
    for y in range(y0, y0 + 6):
        for x in range(x0, x0 + w):
            edge = y in (y0, y0 + 5) or x in (x0, x0 + w - 1)
            cv.put(x, y, W[5] if edge else W[1])
    for gx in range(x0 + 3, x0 + w - 3, 3):
        cv.put(gx, y0 + 2, S[5]); cv.put(gx + 1, y0 + 3, S[4]); cv.put(gx, y0 + 3, S[3])


def eave_trim(cv, roof_h=48):
    """관아 지붕: 처마 끝줄에 주황 단청 띠(바람의나라 관아의 금빛 처마선)."""
    O = RGB['persimmon']
    for x in range(cv.w):
        first = next((y for y in range(0, roof_h) if cv.a[y, x, 3] == 255), None)
        if first is None: continue
        last = first
        while last + 1 < roof_h and cv.a[last + 1, x, 3] == 255:
            last += 1
        if last - first < 6: continue
        cv.put(x, last, O[2]); cv.put(x, last - 1, O[4] if x % 4 in (0, 1) else O[3]); cv.put(x, last - 2, O[3])


def thatch_baram(cv, R=3, over=0):
    """바람의나라 연구형 초가 방석 지붕으로 위 R 행을 바꾼다. thatch3d.py."""
    import thatch3d
    H = R * T
    cv.a[:H, :, :] = 0
    hd = max(28, min(38, int((cv.w + over) * 0.34)))
    cv.paste(thatch3d.dome2(cv.w - 16 + over, hd, seed=cv.w), 8, 51 - hd)
    eave_fill(cv, H, thatch=True)
    dither_under(cv, H, 4)


def eave_fill(cv, roof_h=48, thatch=False):
    """처마 밑 서까래 그늘: 지붕 아랫선과 벽 윗선 사이·날개 아래의 빈 곳을 어두운 서까래(세로 살)로 채워 지붕이 벽에 얹혀 보이게 한다.
    벽이 없는 날개 아래는 한 칸 더 내려 처마가 허공에 뜨지 않게 하고, 벽 모서리에 처마를 받치는 짧은 기둥머리를 둔다."""
    W_ = RGB['wood']; E_ = RGB['earth']
    wall_cols = [x for x in range(cv.w) if cv.a[roof_h + 6, x, 3] == 255]
    wx0, wx1 = (min(wall_cols), max(wall_cols)) if wall_cols else (0, cv.w - 1)
    for x in range(cv.w):
        first = next((y for y in range(0, roof_h) if cv.a[y, x, 3] == 255), None)
        if first is None:
            continue
        last = first                      # 지붕의 첫 연속 구간 끝(벽 윗줄은 포함하지 않는다)
        while last + 1 < roof_h and cv.a[last + 1, x, 3] == 255:
            last += 1
        in_wall = wx0 <= x <= wx1
        y_end = roof_h + 1
        for y in range(last + 1, y_end + 1):
            if cv.a[y, x, 3] == 255:
                continue
            k = y - last
            rafter = (x % 3 == 1)
            if thatch:
                col = RGB['straw'][1] if rafter else RGB['straw'][0]
            else:
                col = W_[3] if rafter and k > 1 else (W_[1] if k > 1 else W_[2])
            if not in_wall and k > 3:
                if thatch: continue
                col = W_[1] if rafter else E_[0]
            cv.put(x, y, col)


def ground_shadow_house(cv, plinth_y, drop=5, lean=7):
    """건물 오른쪽·아래로 떨어지는 그림자(빛은 왼쪽 위). 기단 바로 밑 한 줄 + 오른쪽 옆 세로 띠."""
    cols = [x for x in range(cv.w) if cv.a[plinth_y, x, 3] == 255]
    if not cols:
        return
    x0, x1 = min(cols), max(cols)
    for y in range(plinth_y + 1, min(cv.h, plinth_y + 1 + drop)):
        for x in range(x0 + lean * (y - plinth_y) // drop, x1 + lean + 1):
            if cv.a[y, x, 3] == 0:
                cv.put(x, y, SHADOW, 90 - 12 * (y - plinth_y))
    for x in range(x1 + 1, min(cv.w, x1 + 1 + lean)):
        for y in range(plinth_y - 26, plinth_y + 1):
            if cv.a[y, x, 3] == 0:
                cv.put(x, y, SHADOW, 70)


def dither_under(cv, y0, rows=4):
    """처마 그림자: 지붕 바로 아래 벽 위쪽을 체크무늬로 어둡게(바람의나라 디더 그림자). 가까울수록 촘촘."""
    from build import _snap_dark
    for k in range(rows):
        y = y0 + k
        if y >= cv.h: break
        for x in range(cv.w):
            if cv.a[y, x, 3] != 255: continue
            on = ((x + y) % 2 == 0) if k >= 1 else True
            if k == rows - 1 and (x % 2 or y % 2): on = False
            if on:
                cv.a[y, x, :3] = _snap_dark(tuple(int(v * 0.72) for v in cv.a[y, x, :3]))


def hip_cut(cv, y0, R, style, wg=32):
    """팔작지붕: 지붕 영역(y0 부터 R 행) 양끝을 사선으로 깎고, 깎고 남은 옆 추녀면을 밝게(왼쪽)/어둡게(오른쪽) 칠한다."""
    G = RGB[STYLE_ROOF[style]]
    H = R * T
    for gy in range(H):
        y = y0 * T + gy
        sil = wg * (1 - gy / H) * 0.78            # 실루엣 사선
        hipl = wg * 0.42 + (wg * 0.1) * (gy / H)  # 정면 사면과 옆면의 경계
        for side in ('l', 'r'):
            for gx in range(wg):
                x = gx if side == 'l' else cv.w - 1 - gx
                if gx < sil:
                    cv.a[y, x] = (0, 0, 0, 0)
                elif gx < hipl and cv.a[y, x, 3]:
                    k = (gx + gy) % 3
                    if style == 'jc':
                        S = RGB['straw']
                        cur = tuple(int(v) for v in cv.a[y, x, :3])
                        try: i = [tuple(int(q) for q in c) for c in S].index(cur)
                        except ValueError: i = 4
                        cv.put(x, y, S[min(6, i + 1)] if side == 'l' else S[max(1, i - 2)])
                    else:
                        if side == 'l': cv.put(x, y, G[5] if k == 0 else G[4])
                        else: cv.put(x, y, G[2] if k == 0 else G[3])


def assemble(rows, L, overlays=(), post=None):
    """rows: 이름 문자열 한 줄(공백 구분)의 목록. '.' 은 빈 칸."""
    h = len(rows); w = len(rows[0].split())
    cv = Cv(w * T, h * T)
    for y, row in enumerate(rows):
        for x, n in enumerate(row.split()):
            if n != '.':
                cv.paste(L[n], x * T, y * T)
    for n, x, y in overlays:
        cv.paste(L[n], x * T, y * T)
    if post: post(cv)
    outline(cv)
    return cv


def roof_rows(st, w, rows=3):
    names = ['ridge', 'front'] + ['body'] * max(0, rows - 3) + ['eave']
    return [' '.join(f'{st}.roof.{nm}.' + ('l' if i == 0 else 'r' if i == w - 1 else 'm') for i in range(w)) for nm in names]


def storey_rows(st, kinds_u, kinds_b):
    return [' '.join(f'{st}.u.{k}' for k in kinds_u), ' '.join(f'{st}.b.{k}' for k in kinds_b)]


def house(st, w, kinds_u, kinds_b, rows=3, steps=(), chimi=True, dan=False, hip=False):
    """깊은 처마 집: 지붕은 벽보다 좌우 한 칸씩 넓다(≈1m 처마). 위→아래: 지붕 행들, 벽 위·아래 행, 석축 기단(+디딤돌)."""
    W = w + 2
    out = roof_rows(st, W, rows)
    if chimi and st in ('jo', 'pv'):
        r0 = out[0].split()
        ci = 2 if hip else 1
        r0[ci] = f'{st}.roof.ridge.cl'; r0[W - 1 - ci] = f'{st}.roof.ridge.cr'
        out[0] = ' '.join(r0)

    pad = lambda s: '. ' + s + ' .'
    up = 'ud' if dan else 'u'
    u = ' '.join(f'{st}.{up}.{k}' for k in kinds_u); b = ' '.join(f'{st}.b.{k}' for k in kinds_b)
    out += [pad(u), pad(b)]
    plinth = 'jc.plinth' if st == 'jc' else 'plinth'
    pl = ['.'] + [plinth] * w + ['.']
    for i in steps: pl[i + 1] = plinth + 's'
    out.append(' '.join(pl))
    return out


def upturn(cv, roof_h, reach=14, peak=5):
    """앙곡: 처마 양끝 바깥 열들을 위로 들어 올려 곡선 처마를 만든다(지붕 영역 roof_h px 안의 열만)."""
    import numpy as _np
    for side in ('l', 'r'):
        for k in range(reach):
            x = k if side == 'l' else cv.w - 1 - k
            lift = int(round(peak * max(0.0, 1 - k / reach) ** 2))
            if lift <= 0:
                continue
            col = cv.a[:roof_h, x].copy()
            cv.a[:roof_h, x] = 0
            cv.a[0:roof_h - lift, x] = col[lift:]


def pavilion_open(cv, bays, wall_y0=48, wall_y1=80, x0=16):
    """정자: 벽을 걷어내 뒤가 보이게 한다. 바람의나라 문루처럼 단청 기둥(청록 몸체에 붉은·금 무늬), 어두운 안쪽, 마루 윗면, 앞 난간."""
    G, B, R, E, W = RGB['dgreen'], RGB['dblue'], RGB['red'], RGB['earth'], RGB['wood']
    x1 = x0 + bays * T
    for y in range(wall_y0, wall_y1):
        for x in range(x0, x1):
            t = (y - wall_y0) / (wall_y1 - wall_y0)
            col = E[0] if t < 0.45 else (E[1] if t < 0.7 else W[2])
            if t >= 0.7:                                       # 마루 윗면(앞 가장자리 밝은 선)
                col = W[4] if (x // 4) % 2 else W[3]
                if y == wall_y1 - 8: col = W[5]
            cv.a[y, x] = (*col, 255)
    # 뒷벽 그림자와 안쪽 기둥 그림자
    for x in range(x0, x1):
        for y in range(wall_y0, wall_y0 + 4):
            cv.a[y, x] = (*E[0], 255)
    cols = [x0 + i * T for i in range(bays + 1)]
    for cxp in cols:
        for y in range(wall_y0 - 1, wall_y1 - 7):
            for dx in range(5):
                xx = min(max(cxp - 2 + dx, x0 - 2), x1 + 1)
                rel = y - (wall_y0 - 1)
                tone = R[4] if dx == 1 else (R[3] if dx < 3 else R[2])          # 붉은 주칠 기둥
                if rel < 7:                                                      # 기둥머리 단청: 청·녹 띠와 붉은 무늬
                    tone = [B[5], G[4], B[4], G[4], B[3]][dx] if rel % 4 < 2 else [G[5], R[4], G[4], R[4], G[3]][dx]
                cv.a[y, xx] = (*tone, 255)
        for dx in range(7):                                         # 주춧돌
            xx = cxp - 3 + dx
            for y in range(wall_y1 - 7, wall_y1 - 4):
                cv.a[y, xx] = (*RGB['stone'][5 if dx < 4 else 3], 255)
    # 앞 난간: 가로대 + 짧은 살
    for x in range(x0 + 4, x1 - 3):
        if (x - x0) % T in (0, 1, 2, 3, 12, 13, 14, 15): pass
        cv.a[wall_y1 - 12, x] = (*W[5], 255); cv.a[wall_y1 - 11, x] = (*W[3], 255)
        if (x % 4) == 1:
            for y in range(wall_y1 - 10, wall_y1 - 7):
                cv.a[y, x] = (*W[4], 255)
