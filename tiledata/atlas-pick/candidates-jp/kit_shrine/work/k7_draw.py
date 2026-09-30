"""k7 kit_shrine — A/B/C 세 결을 한 코드로. 손으로 놓은 표·사각·선만 쓴다(난수·보간 없음)."""
import sys
import k7_lib as L
from k7_lib import P, G, W, H, export

SZ = {'kawara': 7, 'kasa': 5, 'shu': 7, 'hinoki': 7, 'sumi': 6, 'washi': 6, 'ishi': 7, 'taxi': 6, 'lacq': 7, 'mteal': 5}
def c(r, t): return (r, max(0, min(SZ[r] - 1, t)))

STY = {
 'A': dict(roof='kawara', R=dict(hi=5, mid=4, lo=3, gr=2, dk=1, dp=0), cap=6, ey=12, th=3,
           u_l=[4,4,3,3,3,2,2,2,1,1,1,1,0,0,0,0], pil=[4,3,3,3,2,1], pw=6, int_=('lacq', 2),
           nuki='A', hump=[10,10,10,9,9,8,7,7,6,5,4,4,3,3,2,2,1,1,1,1,1,1,1,1], shade=False),
 'B': dict(roof='kawara', R=dict(hi=6, mid=4, lo=2, gr=1, dk=0, dp=0), cap=6, ey=12, th=3,
           u_l=[4,4,3,3,3,2,2,2,1,1,1,1,0,0,0,0], pil=[5,4,3,3,1,0], pw=6, int_=('lacq', 1),
           nuki='A', hump=[10,10,10,9,9,8,7,7,6,5,4,4,3,3,2,2,1,1,1,1,1,1,1,1], shade=True),
 'C': dict(roof='kasa', R=dict(hi=4, mid=3, lo=2, gr=1, dk=0, dp=0), cap=8, ey=11, th=4,
           u_l=[6,6,5,5,4,4,3,3,2,2,1,1,1,0,0,0], pil=[4,3,3,2,1], pw=5, int_=('sumi', 1),
           nuki='C', hump=[11,11,10,9,8,7,6,5,4,3,3,2,1,1,0,0,0,0,0,0,0,0,0,0], shade=False),
}

def build(S):
    st = STY[S]
    for r in G: r[:] = [None] * W
    RC = lambda n: c(st['roof'], st['R'][n])
    INT = c(*st['int_'])
    ey0, th, cap = st['ey'], st['th'], st['cap']

    def slope(p, x, r):
        ph = x % 8
        n = ['hi', 'mid', 'mid', 'mid', 'lo', 'lo', 'lo', 'gr'][ph]
        if r % 4 == 3:
            n = {'hi': 'mid', 'mid': 'lo', 'lo': 'gr', 'gr': 'dk'}[n]
        p.px(x, r, RC(n))

    def barge(p, x, r, side):
        # 지붕 옆 가장자리 3열: 바깥 어두운 윤곽 / 밝은 테 / 몸
        if side == 'l': p.px(x, r, [RC('dp'), RC('hi'), RC('mid')][x])
        else: p.px(x, r, [RC('dp'), RC('dk'), RC('lo')][15 - x])

    # ---------- 용마루 줄(tl tm tr) ----------
    def ridge(slug, kind):
        p = P(slug)
        for x in range(16):
            for r in range(16):
                if r < cap:
                    if r == 0: t = 'dp'
                    elif r == cap - 1: t = 'dk'
                    elif r == 1: t = 'hi'
                    elif r < cap - 2: t = 'mid'
                    else: t = 'lo'
                    if x % 8 == 7 and 1 <= r <= cap - 2: t = 'gr'
                    p.px(x, r, RC(t))
                elif r == cap:
                    p.px(x, r, RC('gr' if x % 8 != 7 else 'dk'))
                else:
                    slope(p, x, r)
        if kind == 'l':
            for x in range(3):
                for r in range(cap, 16): barge(p, x, r, 'l')
            # 오니가와라(끝 기와): 5폭 둥근 덩이
            end = cap + 3
            for r in range(end):
                for x in range(5):
                    t = 'mid'
                    if x == 0 or r == 0: t = 'dp'
                    elif r == end - 1: t = 'dk'
                    elif x == 1 or r == 1: t = 'hi'
                    elif x == 4: t = 'lo'
                    p.px(x, r, RC(t))
            p.px(2, 4, RC('gr')); p.px(2, 5, RC('gr')); p.px(3, 4, RC('gr'))
        if kind == 'r':
            for x in range(13, 16):
                for r in range(cap, 16): barge(p, x, r, 'r')
            end = cap + 3
            for r in range(end):
                for x in range(11, 16):
                    t = 'mid'
                    if x == 15 or r == 0: t = 'dp'
                    elif r == end - 1: t = 'dk'
                    elif x == 14: t = 'dk'
                    elif r == 1: t = 'hi'
                    elif x == 13: t = 'lo'
                    p.px(x, r, RC(t))
            p.px(13, 4, RC('gr')); p.px(13, 5, RC('gr')); p.px(12, 4, RC('gr'))
    ridge('sr_tl', 'l'); ridge('sr_tm', 'm'); ridge('sr_tr', 'r')

    # ---------- 비탈 줄(sl sm sr) ----------
    for slug, kind in (('sr_sl', 'l'), ('sr_sm', 'm'), ('sr_sr', 'r')):
        p = P(slug)
        for x in range(16):
            for r in range(16):
                if kind == 'l' and x < 3: barge(p, x, r, 'l')
                elif kind == 'r' and x > 12: barge(p, x, r, 'r')
                else: slope(p, x, r)

    # ---------- 처마 줄(el em er) ----------
    def eave(slug, kind):
        p = P(slug)
        ul = st['u_l']
        for x in range(16):
            u = 0
            if kind == 'l': u = ul[x]
            if kind == 'r': u = ul[15 - x]
            ey = ey0 - u
            for r in range(16):
                if r < ey - th:
                    if kind == 'l' and x < 3: barge(p, x, r, 'l')
                    elif kind == 'r' and x > 12: barge(p, x, r, 'r')
                    else: slope(p, x, r)
                elif r < ey:
                    ph = x % 8
                    if r == ey - th: n = 'hi'
                    elif r == ey - 1: n = 'lo' if ph != 7 else 'dk'
                    else: n = ['hi', 'mid', 'mid', 'mid', 'lo', 'lo', 'lo', 'gr'][ph]
                    if S == 'C' and r == ey - 2 and ph in (2, 3, 4, 5): n = 'gr'   # 막새 문양
                    if S != 'C' and r == ey - 2 and ph in (2, 3, 4, 5): n = 'lo'
                    if (kind == 'l' and x == 0) or (kind == 'r' and x == 15): n = 'dp'
                    p.px(x, r, RC(n))
                elif r == ey:
                    p.px(x, r, RC('dp'))
                elif r == ey + 1:
                    p.px(x, r, c('sumi', 0))
                else:
                    p.px(x, r, c('hinoki', 2 if x % 4 < 2 else 1) if S != 'B' else c('hinoki', 2 if x % 4 < 2 else 0))
    eave('sr_el', 'l'); eave('sr_em', 'm'); eave('sr_er', 'r')

    # ---------- 누키(들보) ----------
    def nuki(slug, kind):
        p = P(slug)
        for x in range(16):
            for r in range(16):
                p.px(x, r, INT)
        for x in range(16):
            if st['nuki'] == 'A':
                for r in range(3): p.px(x, r, c('sumi', 0))
                # 마스(공포) 블록
                if x % 8 in (2, 3, 4, 5):
                    p.px(x, 0, c('hinoki', 3)); p.px(x, 1, c('hinoki', 2)); p.px(x, 2, c('hinoki', 1))
                p.px(x, 3, c('shu', 5 if S == 'B' else 4))
                for r in range(4, 9): p.px(x, r, c('shu', 3))
                p.px(x, 9, c('shu', 2 if S == 'A' else 1)); p.px(x, 10, c('shu', 1 if S == 'A' else 0))
                if x % 8 in (0, 4):   # 못 머리
                    p.px(x, 6, c('shu', 2)); 
                p.px(x, 11, c('sumi', 0))
            else:
                for r in range(2): p.px(x, r, c('sumi', 1))
                p.px(x, 2, c('shu', 4))
                for r in range(3, 7): p.px(x, r, c('shu', 3))
                p.px(x, 7, c('shu', 1)); p.px(x, 8, c('sumi', 0))
                for r in range(9, 14): p.px(x, r, c('washi', 4))
                p.px(x, 9, c('washi', 2)); p.px(x, 13, c('washi', 3))
                for r in range(14, 16): p.px(x, r, c('sumi', 1))
                if x % 8 in (3, 4): 
                    for r in range(10, 13): p.px(x, r, c('washi', 3))
        # 끝 마구리
        if kind == 'l':
            for r in range(16):
                q = p.ox; 
            top, bot = (3, 10) if st['nuki'] == 'A' else (2, 7)
            for r in range(top, bot + 1):
                p.px(0, r, c('shu', 0)); p.px(1, r, c('shu', 5 if S == 'B' else 4))
            if st['nuki'] == 'C':
                for r in range(9, 14): p.px(0, r, c('washi', 2))
        if kind == 'r':
            top, bot = (3, 10) if st['nuki'] == 'A' else (2, 7)
            for r in range(top, bot + 1):
                p.px(15, r, c('shu', 0)); p.px(14, r, c('shu', 1))
            if st['nuki'] == 'C':
                for r in range(9, 14): p.px(15, r, c('washi', 2))
    nuki('nuki_l', 'l'); nuki('nuki_m', 'm'); nuki('nuki_r', 'r')

    # ---------- 기둥 ----------
    p = P('hashira')
    p.rect(0, 0, 16, 32, INT)
    x0 = (16 - st['pw']) // 2
    for i, t in enumerate(st['pil']):
        p.rect(x0 + i, 0, 1, 32, c('shu', t))
    if S == 'B':   # 오른쪽 어둠 옆에 붙는 바닥 그림자 자리 대신 왼쪽 빛 한 줄 더
        p.rect(x0, 0, 1, 32, c('shu', 6))
    # 기둥 결(가로 이음 없이 세로만, 위아래 이음 유지)

    # ---------- 난간 격자 ----------
    p = P('koshi')
    p.rect(0, 0, 16, 32, INT)
    ht = lambda t: c('hinoki', t)
    lat_lo, lat_hi = 4, 19
    lat_x = {0: 4, 1: 3} if S != 'B' else {0: 5, 1: 3}
    if S == 'C': lat_x = {0: 4, 1: 3, 2: 2}
    per = 4 if S != 'C' else 6
    for x in range(16):
        # 위 난간(3+그림자)
        p.px(x, 0, ht(5 if S != 'B' else 6)); p.px(x, 1, ht(4)); p.px(x, 2, ht(3)); p.px(x, 3, ht(1))
        m = x % per
        for r in range(lat_lo, lat_hi + 1):
            if m in lat_x: p.px(x, r, ht(lat_x[m]))
        # 가운데 가로대
        p.px(x, 10, ht(4)); p.px(x, 11, ht(2))
        # 아래 난간
        p.px(x, 20, ht(4)); p.px(x, 21, ht(3)); p.px(x, 22, ht(1))
        # 허리판
        for r in range(23, 32):
            t = 3
            if x % 8 == 0: t = 1
            elif x % 8 == 1: t = 4
            if r >= 29: t = max(1, t - 1)
            p.px(x, r, ht(t))
        p.px(x, 31, ht(1))

    # ---------- 방울 입구 ----------
    p = P('ent_bell')
    p.rect(0, 0, 16, 32, INT)
    for x in range(16):
        p.px(x, 0, ht(5 if S != 'B' else 6)); p.px(x, 1, ht(4)); p.px(x, 2, ht(3)); p.px(x, 3, ht(1))
    # 시메나와(볏짚 새끼줄) + 시데(종이)
    for x in range(1, 15):
        p.px(x, 4, ht(5)); p.px(x, 5, ht(4) if x % 2 else ht(3)); p.px(x, 6, ht(2))
    for sx in (3, 12):
        p.px(sx, 7, c('washi', 4)); p.px(sx, 8, c('washi', 3)); p.px(sx + (1 if sx < 8 else -1), 9, c('washi', 4)); p.px(sx + (1 if sx < 8 else -1), 10, c('washi', 2))
        p.px(sx, 11, c('washi', 4))
    # 방울
    bell = ["..dddd..", ".dhhmmd.", "dhhmmmld", "dhmmmlld", "dmmmllld", "dmmllldd", ".dddddd.", "..dgtd.."]
    tb = {'d': c('taxi', 1), 'h': c('taxi', 5), 'm': c('taxi', 3), 'l': c('taxi', 2), 'g': c('taxi', 0), 't': c('taxi', 4)}
    p.px(7, 7, c('taxi', 1)); p.px(8, 7, c('taxi', 1))
    for j, row in enumerate(bell[1:], 8):
        for i, ch in enumerate(row):
            if ch != '.': p.px(4 + i, j, tb[ch])
    # 방울 줄(붉은·흰 꼬임)
    for r in range(16, 24):
        p.px(7, r, c('shu', 3) if (r // 2) % 2 else c('washi', 4))
        p.px(8, r, c('shu', 2) if (r // 2) % 2 else c('washi', 3))
    # 세이센바코(헌금함)
    p.rect(3, 23, 10, 2, ht(5 if S != 'B' else 6)); p.rect(3, 23, 10, 1, ht(6 if S == 'B' else 5))
    p.rect(6, 24, 4, 1, c('sumi', 0))
    p.rect(3, 25, 10, 6, ht(3)); p.rect(3, 31, 10, 1, ht(1))
    for x in (3, 5, 7, 9, 11):
        p.rect(x, 25, 1, 6, ht(4)); 
    p.rect(12, 25, 1, 6, ht(1))
    p.rect(3, 25, 10, 1, ht(2))

    # ---------- 기단 ----------
    def kidan(slug, kind):
        p = P(slug)
        for x in range(16):
            # 윗면 3줄
            p.px(x, 0, c('ishi', 6 if S == 'B' else 5)); p.px(x, 1, c('ishi', 5)); p.px(x, 2, c('ishi', 4) if S != 'B' else c('ishi', 3))
            for r in range(3, 16): p.px(x, r, c('ishi', 4 if S != 'B' else 3))
            for r in range(13, 16): p.px(x, r, c('ishi', 3 if S != 'B' else 2))
            p.px(x, 15, c('ishi', 1))
            p.px(x, 3, c('ishi', 2))   # 윗면 아래 그늘줄
            # 돌 줄눈 (1단 x=7, 2단 x=15 — 주기 16)
            if x == 7:
                for r in range(4, 9): p.px(x, r, c('ishi', 2))
            if x == 15:
                for r in range(10, 14): p.px(x, r, c('ishi', 2))
            p.px(x, 9, c('ishi', 2))
            if x % 8 in (2, 3, 4) : pass
        if kind == 'l':
            for r in range(16): p.px(0, r, c('ishi', 1)); 
            for r in range(3, 15): p.px(1, r, c('ishi', 5))
            p.px(1, 2, c('ishi', 6))
        if kind == 'r':
            for r in range(16): p.px(15, r, c('ishi', 1))
            for r in range(3, 15): p.px(14, r, c('ishi', 2))
    kidan('kidan_l', 'l'); kidan('kidan_m', 'm'); kidan('kidan_r', 'r')

    # ---------- 나무 계단 ----------
    p = P('kiza')
    rows = {0: 6, 1: 5, 2: 4, 3: 3, 4: 3, 5: 2, 6: 1, 7: 5, 8: 4, 9: 3, 10: 3, 11: 2, 12: 1, 13: 5, 14: 4, 15: 3}
    if S == 'B': rows = {0: 6, 1: 5, 2: 4, 3: 3, 4: 2, 5: 1, 6: 0, 7: 5, 8: 4, 9: 3, 10: 2, 11: 1, 12: 0, 13: 5, 14: 4, 15: 2}
    for x in range(16):
        for r in range(16):
            t = rows[r]
            if x % 8 == 3 and r % 6 in (1, 2, 4): t = max(0, t - 1)   # 나뭇결
            p.px(x, r, c('hinoki', t))

    # ---------- 기둥(데미즈야) ----------
    p = P('post')
    x0 = (16 - st['pw']) // 2
    for i, t in enumerate(st['pil']):
        p.rect(x0 + i, 0, 1, 28, c('shu', t))
    # 초석
    for r, (a, b, t) in enumerate([(x0 - 1, x0 + st['pw'], 5), (x0 - 2, x0 + st['pw'] + 1, 4), (x0 - 2, x0 + st['pw'] + 1, 3), (x0 - 2, x0 + st['pw'] + 1, 1)]):
        for x in range(a, b + 1):
            tt = t
            if x == b and t > 1: tt = t - 1
            p.px(x, 28 + r, c('ishi', tt))
    if S == 'B':
        for x in range(x0 + st['pw'] + 2, x0 + st['pw'] + 6):
            p.px(x, 30, '-'); p.px(x, 31, '~')
        p.rect(x0 + st['pw'], 12, 1, 16, c('shu', 0))
        for x in range(x0 + st['pw'] + 1, x0 + st['pw'] + 3):
            for r in range(4, 27): p.px(x, r, '-') if r % 2 else None
    # ---------- 물통 ----------
    p = P('basin')
    ws = c('mteal', 3)
    # 발치 그림자
    if S == 'B':
        for x in range(3, 31): p.px(x, 15, '~')
        for x in range(4, 31): p.px(x, 14, '-')
    # 받침
    p.rect(4, 13, 24, 2, c('ishi', 3)); p.rect(4, 13, 24, 1, c('ishi', 4)); p.rect(27, 13, 1, 2, c('ishi', 1)); p.rect(4, 14, 24, 1, c('ishi', 2))
    p.rect(27, 13, 1, 2, c('ishi', 1))
    # 앞면
    p.rect(2, 8, 28, 5, c('ishi', 4)); p.rect(2, 12, 28, 1, c('ishi', 2)); p.rect(29, 8, 1, 5, c('ishi', 2)); p.rect(2, 8, 1, 5, c('ishi', 5))
    for x in (9, 20):
        p.rect(x, 9, 1, 3, c('ishi', 3))
    # 윗면 테두리(3줄)
    p.rect(2, 3, 28, 5, c('ishi', 5)); p.rect(2, 3, 28, 1, c('ishi', 6)); p.rect(29, 4, 1, 4, c('ishi', 3)); p.rect(2, 3, 1, 5, c('ishi', 6))
    p.rect(2, 7, 28, 1, c('ishi', 3))
    # 물
    p.rect(4, 4, 24, 3, ws); p.rect(4, 4, 24, 1, c('mteal', 2)); p.rect(4, 6, 24, 1, c('mteal', 4))
    for x in (8, 9, 18, 22): p.px(x, 5, c('mteal', 4))
    # 히샤쿠(국자)
    p.rect(8, 2, 16, 1, c('hinoki', 4)); p.rect(22, 1, 4, 2, c('hinoki', 5)); p.rect(22, 3, 4, 1, c('hinoki', 2))
    p.rect(8, 3, 16, 1, c('hinoki', 2)) if S == 'B' else None

    # ---------- 카라하후 ----------
    p = P('hafu')
    hump = st['hump']
    tk = 4 if S != 'C' else 5
    for x in range(48):
        d = min(x, 47 - x)
        top = hump[d]
        for y in range(top, 12):
            k = y - top
            if k == 0: col = RC('hi')
            elif k < tk - 1: col = RC('mid')
            elif k == tk - 1: col = RC('lo')
            elif k == tk: col = RC('dp')
            else:
                col = c('washi', 4)
                if y == 11: col = c('washi', 2)
            if k < tk and x % 8 == 7: col = RC('gr')
            p.px(x, y, col)
        # 얼굴 아래 처마끝 선(본체 처마 12행과 맞춤)
        if top <= 12: p.px(x, 12, RC('dp'))
        if S == 'B' and top <= 12:
            p.px(x, 13, '~'); 
            p.px(x, 14, '-')
    # 얼굴 장식: 가운데 게교(懸魚) + 양옆 세로살
    if True:
        top = hump[23]
        cx = 24
        base = top + tk + 1
        for j, (a, b, t) in enumerate([(-2, 1, 4), (-3, 2, 4), (-2, 1, 3), (-1, 0, 3)]):
            for x in range(cx + a, cx + b + 1):
                if base + j <= 11: p.px(x, base + j, c('taxi', t))
        for sx in (12, 35):
            for y in range(hump[min(sx, 47 - sx)] + tk + 1, 11): p.px(sx, y, c('hinoki', 3)); p.px(sx + 1, y, c('hinoki', 2))
    # 전체 저장
    return st

if __name__ == '__main__':
    for S in sys.argv[1:] or 'ABC':
        build(S)
        export('k7-' + S, f'kit_shrine k7-{S}')
