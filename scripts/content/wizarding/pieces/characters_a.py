"""characters_a — 해리포터풍 사람 13종(24×32 걷기 시트). 공통 몸 함수 + 옷·머리·모자·소품만 바꾼다."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from wzlib import REG, Cv, K, OL, OL2, run_module   # noqa
MODULE = 'characters_a'


def SK(t): return K('skin', t)


def _hair_px(hr, x, y, t):
    s = (x - 6) + (y - t) * 0.7
    if s < 3.5: return K(hr, 3)
    if x >= 15 and hr != 'hair_red': return K(hr, 1)
    return K(hr, 2)


def _shade(ramp, base, i, j, w=2):
    """가로 단: i=왼쪽에서 칸 수, j=오른쪽에서 칸 수."""
    if i < 2: return K(ramp, base + 1)
    if j < 2: return K(ramp, base - 1)
    return K(ramp, base)


# ───────────────────────── 머리 ─────────────────────────
def _head(c, d, t, sp):
    hr = sp.get('hair', 'hair_dark'); sty = sp.get('style', 'short'); cx = 12
    for y in range(t, t + 13):
        for x in range(5, 20):
            dd = ((x + .5 - cx) / 6.3) ** 2 + ((y + .5 - (t + 6.4)) / 6.6) ** 2
            if dd > 1: continue
            if d == 'down':
                dx = abs(x + .5 - cx)
                if dx < 2.5: hb = t + 7 if x < 12 else t + 6
                elif dx < 4.5: hb = t + 6
                else: hb = t + 10
                hair = (y < hb) and sty != 'bald'
            elif d == 'up':
                hair = not (y >= t + 11 and 10 <= x <= 13)
                if sty == 'bald': hair = False
            else:
                hair = (y < t + 6 or x < 13) and sty != 'bald'
                if d == 'right' and y == t + 6 and 13 <= x <= 16 and sty != 'bald': hair = True
            if hair: c.P(x, y, _hair_px(hr, x, y, t))
            else: c.P(x, y, SK(2) if x >= 15 and d == 'down' else SK(3))
    if d == 'down':
        for ex in (9, 14):
            c.P(ex, t + 9, OL); c.P(ex, t + 10, OL)
        c.P(11, t + 12, SK(2)); c.P(12, t + 12, SK(2))
        if sp.get('blush'): c.P(8, t + 11, SK(4)); c.P(15, t + 11, SK(4))
    elif d == 'right':
        c.P(15, t + 9, OL); c.P(15, t + 10, OL); c.P(18, t + 9, SK(3)); c.P(12, t + 9, SK(2)); c.P(12, t + 10, SK(2))
    elif d == 'up':
        if sty != 'bald':
            c.P(12, t + 2, K(hr, 3)); c.P(11, t + 3, K(hr, 3)); c.P(12, t + 3, K(hr, 3))
            gt = 2 if sp.get('upfix') else 1   # 빨간 머리 뒤통수 그림자 단 보정(해당 캐릭터만)
            c.P(10, t + 9, K(hr, gt)); c.P(13, t + 9, K(hr, gt)); c.P(12, t + 10, K(hr, gt))
    if sty == 'bun':
        c.ellipse(12, t - 0.5, 3, 2.5, K(hr, 2)); c.R(10, t - 2, 2, 1, K(hr, 3)); c.R(13, t, 2, 2, K(hr, 1))
        if d == 'right': c.R(9, t - 1, 3, 3, K(hr, 2)); c.R(9, t - 1, 2, 1, K(hr, 3))
    if sty == 'tail':   # 높이 묶은 말총(뒤·옆에서 보임)
        if d in ('up', 'down'):
            c.ellipse(12, t - 0.5, 2.5, 2, K(hr, 2)); c.R(10, t - 1, 2, 1, K(hr, 3))
        else:
            c.R(8, t, 3, 2, K(hr, 2)); c.R(6, t + 2, 3, 6, K(hr, 2)); c.R(6, t + 2, 1, 5, K(hr, 3)); c.R(8, t + 7, 1, 2, K(hr, 1))


def _head_long(c, d, t, sp):
    """긴 머리: 어깨 위로 흘러내림(몸·팔 뒤에 그린다)."""
    hr = sp.get('hair', 'hair_dark')
    if d == 'up':
        for y in range(t + 10, t + 18):
            for x in range(7, 17): c.P(x, y, _hair_px(hr, x, y, t) if (x + y) % 5 else K(hr, 1))
        c.R(11, t + 12, 1, 5, K(hr, 1))
    elif d == 'down':
        for y in range(t + 9, t + 17):
            for x in (6, 7, 16, 17): c.P(x, y, K(hr, 2 if x < 12 else 1))
        c.VL(6, t + 9, 6, K(hr, 3))
    else:
        for y in range(t + 9, t + 17):
            for x in (7, 8, 9): c.P(x, y, K(hr, 3 if x == 7 else 2))
        c.R(9, t + 14, 2, 2, K(hr, 1))


# ───────────────────────── 모자 ─────────────────────────
def _hat(c, d, t, sp):
    h = sp.get('hat')
    if not h: return
    if h == 'pointy':
        col = sp.get('hatc', 'night')
        c.ellipse(12, t + 3, 8.5, 2, K(col, 1))
        c.ellipse(12, t + 2.6, 8, 1.6, K(col, 2))
        for k in range(8):
            y = t + 2 - k; hw = 5.2 - k * 0.55; bend = k // 4
            x0 = int(round(12 - hw)) - bend; x1 = int(round(12 + hw)) - bend
            for x in range(x0, x1):
                i, j = x - x0, x1 - 1 - x
                c.P(x, y, K(col, 3) if i < 2 else K(col, 1) if j < 2 else K(col, 2))
        c.HL(7, t + 1, 10, sp.get('band', K('brass', 3)))
        c.HL(7, t + 2, 3, K(col, 3)); c.P(8, t + 3, K(col, 3)); c.P(16, t + 3, K(col, 0))
        if d == 'down': c.R(11, t + 4, 2, 1, K(col, 1))
    elif h == 'cap':
        col = sp.get('hatc', 'night')
        c.ellipse(12, t + 2.5, 6.8, 3.4, K(col, 2))
        c.R(6, t + 3, 12, 2, K(col, 2)); c.HL(8, t, 5, K(col, 3)); c.HL(6, t + 4, 12, K(col, 1))
        c.R(7, t + 1, 1, 2, K(col, 3))
        if d == 'down':
            c.R(7, t + 5, 10, 1, K('wood', 1)); c.R(8, t + 6, 8, 1, K('wood', 1))
            c.R(11, t + 2, 2, 2, K('brass', 4)); c.P(11, t + 2, K('brass', 5))
        elif d == 'right':
            c.R(14, t + 5, 6, 1, K('wood', 1)); c.R(15, t + 6, 5, 1, K('wood', 1)); c.P(13, t + 3, K('brass', 4)); c.P(13, t + 2, K('brass', 5))
        else: c.R(11, t + 1, 2, 2, K(col, 3))
    elif h == 'fur':   # 털모자(귀덮개) — 얼굴은 드러낸다
        c.ellipse(12, t + 2, 6.6, 3.2, K('choc', 3))
        c.R(6, t + 2, 12, 3, K('choc', 3)); c.HL(8, t - 1, 5, K('choc', 4)); c.HL(7, t, 3, K('choc', 4))
        c.HL(5, t + 4, 14, K('choc', 4)); c.HL(5, t + 5, 14, K('choc', 2))
        if d == 'down':
            for fx in (4, 18):
                c.R(fx, t + 5, 2, 5, K('linen', 3 if fx < 12 else 2)); c.P(fx, t + 9, K('choc', 1)); c.P(fx + 1, t + 9, K('choc', 1))
        elif d == 'right':
            c.R(8, t + 5, 4, 5, K('choc', 3)); c.R(11, t + 6, 1, 4, K('choc', 2)); c.HL(8, t + 9, 4, K('choc', 1))
        elif d == 'up':
            c.R(5, t + 5, 14, 5, K('choc', 3)); c.VL(12, t + 5, 5, K('choc', 2)); c.HL(5, t + 9, 14, K('choc', 1))
        c.P(12, t - 2, K('choc', 4)); c.P(11, t - 1, K('choc', 4)); c.P(13, t - 1, K('choc', 3)); c.P(12, t - 1, K('choc', 4))
    elif h == 'hood':
        col = sp.get('hatc', 'leaf')
        for y in range(t - 2, t + 15):
            for x in range(3, 22):
                dd = ((x + .5 - 12) / 7.8) ** 2 + ((y + .5 - (t + 6.5)) / 8.2) ** 2
                if dd > 1: continue
                if d == 'down':
                    win = 8 <= x <= 15 and y >= t + 5 and ((x + .5 - 12) / 4.4) ** 2 + ((y + .5 - (t + 9.5)) / 4.8) ** 2 <= 1
                elif d == 'right':
                    win = x >= 13 and y >= t + 5 and ((x + .5 - 15.5) / 3.6) ** 2 + ((y + .5 - (t + 9.5)) / 4.8) ** 2 <= 1
                else: win = False
                if win: continue
                i, j = x - 3, 21 - x
                c.P(x, y, K(col, 3) if (i < 4 and y < t + 7) else K(col, 1) if (j < 4 or y > t + 12) else K(col, 2))
        if d == 'up':
            c.VL(12, t + 1, 12, K(col, 1)); c.HL(6, t + 12, 12, K(col, 1)); c.HL(8, t + 13, 8, K(col, 0))
            for fx, fy in ((9, t + 4), (15, t + 6), (8, t + 9), (16, t + 10)): c.P(fx, fy, K(col, 3))
            c.P(12, t + 13, K('brass', 3))
        if d == 'down':
            c.HL(8, t + 5, 8, K(col, 1)); c.VL(7, t + 6, 3, K(col, 1))
            for ex in (9, 14): c.P(ex, t + 9, OL); c.P(ex, t + 10, OL)
        elif d == 'right':
            c.HL(13, t + 5, 5, K(col, 1)); c.P(15, t + 9, OL); c.P(15, t + 10, OL)
        else:
            c.VL(12, t, 11, K(col, 1))
    elif h == 'goggles':
        if d == 'down':
            c.HL(6, t + 4, 12, K('wood', 1)); c.HL(6, t + 5, 12, K('wood', 2))
            for gx in (7, 13):
                c.R(gx, t + 2, 4, 4, K('brass', 2)); c.R(gx + 1, t + 3, 2, 2, K('water', 4)); c.P(gx + 1, t + 3, K('water', 5)); c.P(gx, t + 2, K('brass', 4))
        elif d == 'right':
            c.HL(6, t + 4, 11, K('wood', 1)); c.HL(6, t + 5, 11, K('wood', 2))
            c.R(13, t + 2, 4, 4, K('brass', 2)); c.R(14, t + 3, 2, 2, K('water', 4)); c.P(14, t + 3, K('water', 5)); c.P(13, t + 2, K('brass', 4))
        else:
            c.HL(6, t + 4, 12, K('wood', 1)); c.HL(6, t + 5, 12, K('wood', 2))


def _glasses(c, d, t):
    if d == 'down':
        for gx in (8, 13):
            c.R(gx, t + 8, 3, 3, K('brass', 3)); c.P(gx + 1, t + 9, OL); c.P(gx + 1, t + 10, OL)
            c.P(gx + 1, t + 8, K('brass', 4))
        c.P(11, t + 9, K('brass', 3)); c.P(12, t + 9, K('brass', 3))
        c.R(9, t + 9, 1, 2, SK(3)); c.R(14, t + 9, 1, 2, SK(3)); c.P(9, t + 9, OL); c.P(14, t + 9, OL); c.P(9, t + 10, OL); c.P(14, t + 10, OL)
    elif d == 'right':
        c.R(14, t + 8, 3, 3, K('brass', 3)); c.P(15, t + 9, OL); c.P(15, t + 10, OL); c.P(15, t + 8, K('brass', 4))
        c.HL(11, t + 9, 3, K('brass', 3))


# ───────────────────────── 몸 ─────────────────────────
def _body(c, d, f, sp):
    t = sp.get('top', 7); ts = t + 13
    rb = sp.get('robe', 'night'); base = sp.get('rt', 2); lg = sp.get('long', 0)
    hem = {0: 27, 1: 29, 2: 28}[lg]
    pants = sp.get('pants', ('night', 1)); shoe = sp.get('shoe', ('wood', 1))
    armlen = sp.get('armlen', 8); rolled = sp.get('rolled', 0)
    st = [1, 0, -1][f]            # 앞팔 흔들림(+1 = 아래/앞)
    g = {'t': t, 'ts': ts}
    # ── 다리 ──
    if d in ('down', 'up'):
        lfoot = 30 if f != 2 else 29; rfoot = 30 if f != 0 else 29
        if lg == 0:
            for (x0, ft) in ((8, lfoot), (13, rfoot)):
                c.R(x0, 28, 3, ft - 28, K(*pants))
                c.R(x0 - 1 if x0 < 12 else x0, ft, 4, 1, K(*shoe)) if ft == 30 else c.R(x0 - 1 if x0 < 12 else x0, ft, 4, 1, K(*shoe))
                c.R(x0, 28, 1, ft - 28, K(pants[0], pants[1] + 1))
        else:
            for (x0, ft) in ((9, lfoot), (13, rfoot)):
                if ft == 30: c.R(x0, 30, 3, 1, K(*shoe)); c.P(x0, 30, K(shoe[0], shoe[1] + 1))
    else:
        fr = [2, 0, -2][f]
        for (dx, col) in ((-fr, 0), (fr, 1)):
            for k in range(3):
                xx = 11 + dx * (k + 1) // 3 + (1 if col else 0)
                if lg == 0 or k == 2:
                    c.R(xx, 28 + k, 3, 1, K(pants[0], pants[1] + (1 if col else 0)) if lg == 0 else K(*shoe))
            if lg == 0 or True:
                xx = 11 + dx + (1 if col else 0)
                if lg == 0: c.R(xx + 1, 30, 3, 1, K(*shoe))
                else: c.R(xx + 1, 30, 3, 1, K(*shoe))
    # ── 몸통 ──
    if d in ('down', 'up'):
        for y in range(ts, hem + 1):
            ext = min(2, (y - ts) // 4) if lg else 0
            if lg == 2: ext = min(2, (y - ts) // 3 + 1)
            x0 = (8 if y == ts else 7) - ext; x1 = (15 if y == ts else 16) + ext
            # 걸음에 따라 치마 단이 반쪽씩 들린다
            lift = 0
            if lg == 1 and y == hem:
                pass
            for x in range(x0, x1 + 1):
                if lg == 1 and y == hem and ((x < 12 and f == 2) or (x >= 12 and f == 0)): continue
                col = _shade(rb, base, x - x0, x1 - x)
                c.P(x, y, col)
            if y > ts + 3 and d == 'down' and sp.get('seam', 1): c.P(11, y, K(rb, base - 1))
            if y == hem and sp.get('hemc'):
                for x in range(x0, x1 + 1):
                    if not (lg == 1 and ((x < 12 and f == 2) or (x >= 12 and f == 0))): c.P(x, y, sp['hemc'])
        if lg == 1:
            for x in range(7, 17):
                if (x < 12 and f == 2) or (x >= 12 and f == 0):
                    c.P(x, hem - 1, sp.get('hemc') or K(rb, base - 1))
        if sp.get('ragged'):
            for x in range(6, 18, 2):
                if (x + f) % 3: c.clear(x, hem, 1, 1)
    else:
        for y in range(ts, hem + 1):
            ext = min(1, (y - ts) // 5) if lg else 0
            x0 = (9 if y == ts else 8) - ext; x1 = (15 if y == ts else 16) + ext - (1 if lg == 0 else 0)
            for x in range(x0, x1 + 1):
                c.P(x, y, _shade(rb, base, x - x0, x1 - x))
            if y == hem and sp.get('hemc'):
                for x in range(x0, x1 + 1): c.P(x, y, sp['hemc'])
        if sp.get('ragged'):
            for x in range(7, 17, 2):
                if (x + f) % 3: c.clear(x, hem, 1, 1)
    # ── 장식(몸통 위) ──
    sp_pre = sp.get('pre')
    if sp_pre: sp_pre(c, d, f, g)
    # ── 팔 ──
    if d in ('down', 'up'):
        for (ax, sgn) in ((5, 1), (17, -1)):
            dy = st * (1 if ax == 5 else -1)
            sl = armlen - 2
            for k in range(sl):
                y = ts + 1 + k + dy
                skin = rolled and k >= rolled
                for ox in (0, 1):
                    x = ax + ox
                    if skin: c.P(x, y, SK(3 if (ox == 0) == (ax == 5) else 2))
                    else: c.P(x, y, _shade(rb, base, ox if ax == 5 else ox + 1, (1 - ox) if ax == 5 else (1 - ox) - 1 + 0) if False else K(rb, base + 1 if (ax == 5 and ox == 0) else base - 1 if (ax == 17 and ox == 1) else base))
            hy = ts + 1 + sl + dy
            c.R(ax, hy, 2, 2, SK(3)); c.P(ax + (1 if ax == 5 else 0), hy + 1, SK(2))
            if sp.get('cuff'): c.HL(ax, hy - 1, 2, sp['cuff'])
            g['h%s' % ('l' if ax == 5 else 'r')] = (ax, hy)
            ex = 7 if ax == 5 else 16
            for k in range(1, min(sl, 6)):
                c.P(ex, ts + 1 + k, K(rb, base - 2))
    else:
        sw = [2, 0, -2][f]
        ax = 10 + sw
        sl = armlen - 2
        for k in range(sl):
            y = ts + 1 + k
            skin = rolled and k >= rolled
            for ox in range(3):
                col = SK(3 if ox < 2 else 2) if skin else K(rb, base + 1 if ox == 0 else base - 1 if ox == 2 else base)
                c.P(ax + ox, y, col)
        hy = ts + 1 + sl
        c.R(ax, hy, 3, 2, SK(3)); c.HL(ax + 1, hy + 1, 2, SK(2))
        if sp.get('cuff'): c.HL(ax, hy - 1, 3, sp['cuff'])
        g['hn'] = (ax + 1, hy)
    # ── 머리 ──
    if sp.get('hair') and sp.get('long_hair') and d == 'up': _head_long(c, d, t, sp)
    _head(c, d, t, sp)
    if sp.get('long_hair') and d != 'up': _head_long(c, d, t, sp)
    if sp.get('glasses'): _glasses(c, d, t)
    _hat(c, d, t, sp)
    post = sp.get('post')
    if post: post(c, d, f, g)
    return g


def _make(sp):
    def fn(c, d, f):
        if d == 'left':
            tmp = Cv(24, 32); _body(tmp, 'right', f, sp)
            c.blit(tmp.flip_h(), 1, 0)
        else:
            _body(c, d, f, sp)
        c.outline()
    return fn


def _tie(c1, c2, collar=True):
    def pre(c, d, f, g):
        ts = g['ts']
        if d == 'down':
            if collar:
                c.HL(9, ts, 6, K('linen', 4)); c.HL(10, ts + 1, 4, K('linen', 3)); c.P(9, ts + 1, K('linen', 3)); c.P(14, ts + 1, K('linen', 2))
            for k in range(5):
                c.R(11, ts + 1 + k, 2, 1, c1 if k % 2 == 0 else c2)
            c.R(11, ts + 6, 2, 1, c1)
        elif d == 'right':
            c.HL(14, ts, 2, K('linen', 3)); c.R(14, ts + 1, 2, 5, c1); c.P(14, ts + 2, c2); c.P(14, ts + 4, c2); c.P(15, ts + 3, c2)
        else:
            c.HL(9, ts, 6, K('night', 3))
    return pre


def _house(id_, name, hs, hair, style, extra=''):
    hr = 'house_' + hs
    c1, c2 = K(hr, 2), K(hr, 3)
    sp = dict(top=7, hair=hair, style=style, upfix=(hair == 'hair_red'), hemc=c1, cuff=c1, pre=_tie(c1, c2),
              long_hair=(style == 'long'))
    REG.character(id_, name, 'shared', desc=f'{name} — 검은 로브·{extra}', tags=['student', hs])(_make(sp))


_house('wz-chr-student-gryffindor', '그리핀도르 학생', 'g', 'hair_red', 'short', '붉은+금 넥타이·로브 안감')
_house('wz-chr-student-slytherin', '슬리데린 학생', 's', 'hair_blond', 'short', '녹+은 넥타이·로브 안감')
_house('wz-chr-student-ravenclaw', '래번클로 학생', 'r', 'hair_dark', 'long', '청+청동 넥타이·로브 안감')
_house('wz-chr-student-hufflepuff', '후플푸프 학생', 'h', 'hair_dark', 'short', '황+흑 넥타이·로브 안감')


# ───────────────────────── 소품 ─────────────────────────
def _hand(g, d, side='r'):
    if d in ('down', 'up'): return g['hr'] if side == 'r' else g['hl']
    x, y = g['hn']; return (x, y)


def _lantern(c, x, y):
    """손(x,y) 바로 아래로 늘어진 작은 등불(6줄)."""
    c.P(x, y + 1, K('iron', 3))
    c.R(x - 2, y + 2, 5, 1, K('brass', 2)); c.P(x, y + 2, K('brass', 3))
    c.R(x - 2, y + 3, 5, 3, K('brass', 1))
    c.R(x - 1, y + 3, 3, 3, K('fire', 3)); c.R(x, y + 4, 1, 1, K('glow', 4)); c.P(x, y + 3, K('glow', 5))
    c.R(x - 2, y + 6, 5, 1, K('brass', 1))


def _trunk(c, x, y):
    c.HL(x - 1, y + 1, 3, K('brass', 2)); c.P(x - 1, y + 2, K('brass', 2)); c.P(x + 1, y + 2, K('brass', 2))
    c.R(x - 4, y + 2, 9, 5, K('wood', 2)); c.HL(x - 4, y + 2, 9, K('wood', 3)); c.HL(x - 4, y + 6, 9, K('wood', 0))
    c.VL(x - 4, y + 2, 5, K('brass', 2)); c.VL(x + 4, y + 2, 5, K('brass', 1)); c.HL(x - 4, y + 4, 9, K('brass', 1)); c.P(x, y + 4, K('brass', 4))
    c.P(x - 2, y + 3, K('wood', 3)); c.P(x + 2, y + 5, K('wood', 1))


def _wrench(c, x, y):
    c.R(x, y - 2, 2, 9, K('iron', 3)); c.VL(x, y - 2, 9, K('iron', 4)); c.VL(x + 1, y - 2, 9, K('iron', 2))
    c.R(x - 1, y - 4, 4, 3, K('iron', 3)); c.R(x, y - 3, 2, 2, K('night', 1)); c.HL(x - 1, y - 4, 4, K('iron', 4))


def _book(c, x, y, col):
    c.R(x - 1, y - 1, 5, 6, K(col, 2)); c.VL(x - 1, y - 1, 6, K(col, 1)); c.HL(x, y + 4, 4, K('linen', 4)); c.HL(x, y - 1, 4, K(col, 3))


def _prof_pre(c, d, f, g):
    ts = g['ts']
    if d == 'down':
        for k in range(1, 16): c.P(11, ts + k, K('brass', 3)); c.P(12, ts + k, K('brass', 2))
        c.HL(9, ts, 6, K('violet', 4)); c.P(11, ts + 3, K('brass', 4)); c.P(12, ts + 7, K('brass', 4))
    elif d == 'right':
        c.R(14, ts, 2, 14, K('brass', 2)); c.VL(14, ts, 14, K('brass', 3))
    else:
        c.HL(8, ts, 8, K('violet', 4))


def _beard(c, d, f, g):
    t = g['t']
    if d == 'down':
        for y, (a, b) in enumerate([(8, 16), (9, 15), (10, 14), (10, 14), (11, 13)]):
            c.HL(a, t + 11 + y, b - a, K('hair_grey', 4 if y < 3 else 3))
        c.R(10, t + 11, 4, 1, SK(3)); c.HL(11, t + 11, 2, K('hair_grey', 3))
    elif d == 'right':
        c.R(14, t + 11, 4, 3, K('hair_grey', 4)); c.R(15, t + 14, 2, 2, K('hair_grey', 3))


def _scarf(col1, col2):
    def pre(c, d, f, g):
        ts = g['ts']
        if d in ('down', 'up'):
            c.HL(7, ts - 1, 10, K(col1, 3)); c.HL(7, ts, 10, K(col1, 2)); c.HL(8, ts + 1, 8, K(col1, 1))
            for x in range(8, 16, 2): c.P(x, ts, K(col2, 3))
            if d == 'down': c.R(14, ts + 1, 3, 6, K(col1, 2)); c.HL(14, ts + 3, 3, K(col2, 3)); c.HL(14, ts + 6, 3, K(col2, 3)); c.VL(14, ts + 1, 6, K(col1, 3))
        else:
            c.HL(9, ts - 1, 7, K(col1, 3)); c.HL(9, ts, 7, K(col1, 2)); c.R(8, ts + 1, 3, 6, K(col1, 2)); c.HL(8, ts + 3, 3, K(col2, 3)); c.HL(8, ts + 6, 3, K(col2, 3))
    return pre


def _apron(c, d, f, g):
    ts = g['ts']
    if d == 'down':
        c.R(8, ts + 2, 8, 12, K('wood', 2)); c.VL(8, ts + 2, 12, K('wood', 3)); c.VL(15, ts + 2, 12, K('wood', 1))
        c.HL(8, ts + 13, 8, K('wood', 1)); c.R(7, ts, 1, 3, K('wood', 1)); c.R(16, ts, 1, 3, K('wood', 1))
        c.HL(9, ts + 1, 6, K('wood', 3)); c.R(9, ts + 6, 3, 3, K('wood', 1)); c.HL(9, ts + 6, 3, K('wood', 3))
        c.P(13, ts + 8, K('glow', 3)); c.P(13, ts + 9, K('leaf', 3)); c.P(13, ts + 7, K('glass', 2) if False else K('water', 4))
    elif d == 'right':
        c.R(13, ts + 2, 3, 12, K('wood', 2)); c.VL(13, ts + 2, 12, K('wood', 3)); c.HL(13, ts + 13, 4, K('wood', 1)); c.R(11, ts, 5, 2, K('wood', 1))
    else:
        c.HL(9, ts, 6, K('wood', 1)); c.HL(10, ts + 5, 4, K('wood', 1)); c.P(8, ts + 4, K('wood', 2)); c.P(15, ts + 4, K('wood', 2))


def _overall(c, d, f, g):
    ts = g['ts']
    if d == 'down':
        c.R(8, ts + 3, 8, 11, K('water', 1)); c.VL(8, ts + 3, 11, K('water', 2)); c.VL(15, ts + 3, 11, K('water', 0))
        c.R(8, ts, 2, 4, K('water', 1)); c.R(14, ts, 2, 4, K('water', 1)); c.P(9, ts + 3, K('brass', 4)); c.P(14, ts + 3, K('brass', 4))
        c.HL(8, ts + 8, 8, K('wood', 1)); c.P(11, ts + 8, K('brass', 4)); c.P(12, ts + 8, K('brass', 3))
        c.R(9, ts + 5, 3, 2, K('water', 2)); c.HL(9, ts + 5, 3, K('water', 3))
        c.R(13, ts + 10, 3, 3, K('wood', 2)); c.HL(13, ts + 10, 3, K('wood', 3)); c.P(14, ts + 11, K('iron', 4))
    elif d == 'right':
        c.R(13, ts + 2, 3, 12, K('water', 1)); c.HL(11, ts + 8, 5, K('wood', 1)); c.R(14, ts + 10, 2, 3, K('wood', 2))
    else:
        c.R(8, ts + 3, 8, 11, K('water', 1)); c.HL(8, ts + 8, 8, K('wood', 1)); c.R(10, ts + 10, 3, 3, K('wood', 2)); c.HL(8, ts, 8, K('water', 2))


def _guide_pre(c, d, f, g):
    ts = g['ts']
    if d == 'down':
        for k in range(1, 15, 3):
            c.P(10, ts + k, K('brass', 4)); c.P(13, ts + k, K('brass', 4))
        c.VL(9, ts + 1, 14, K('night', 0)); c.VL(14, ts + 1, 14, K('night', 0))
        c.HL(9, ts, 6, K('linen', 3)); c.P(11, ts + 1, K('red', 2)); c.P(12, ts + 1, K('red', 2))
        c.HL(7, ts + 9, 10, K('red', 2)); c.HL(7, ts + 10, 10, K('red', 1))
    elif d == 'right':
        c.HL(14, ts, 2, K('linen', 3))
        for k in range(1, 14, 3): c.P(14, ts + k, K('brass', 4))
        c.HL(9, ts + 9, 8, K('red', 2))
    else:
        c.HL(9, ts, 6, K('night', 3)); c.VL(12, ts + 1, 14, K('night', 0)); c.HL(8, ts + 9, 8, K('red', 2))


def _bag(c, d, f, g):
    ts = g['ts']
    if d == 'down':
        for k in range(8):
            c.P(8 + k, ts + k, K('wood', 3 if k else 2)); c.P(9 + k, ts + k, K('wood', 2))
        c.R(5, ts + 8, 6, 6, K('wood', 2)); c.HL(5, ts + 8, 6, K('wood', 3)); c.HL(5, ts + 13, 6, K('wood', 0)); c.VL(5, ts + 8, 6, K('wood', 3))
        c.HL(5, ts + 10, 6, K('wood', 1)); c.P(8, ts + 10, K('brass', 4)); c.P(8, ts + 11, K('brass', 3))
    elif d == 'right':
        for k in range(9): c.P(9 + k // 2, ts + k, K('wood', 2))
        c.R(8, ts + 7, 5, 6, K('wood', 2)); c.HL(8, ts + 7, 5, K('wood', 3)); c.HL(8, ts + 12, 5, K('wood', 0)); c.P(11, ts + 9, K('brass', 4))
    else:
        for k in range(8): c.P(15 - k, ts + k, K('wood', 2)); c.P(14 - k, ts + k, K('wood', 3))
        c.R(13, ts + 8, 6, 6, K('wood', 2)); c.HL(13, ts + 8, 6, K('wood', 3)); c.HL(13, ts + 13, 6, K('wood', 0)); c.P(15, ts + 10, K('brass', 4))


def _letters(c, d, f, g):
    ts = g['ts']
    def env(x, y, w=7, hgt=5, col=4, seal=True):
        c.R(x, y, w, hgt, K('linen', col)); c.HL(x, y, w, K('linen', 4)); c.HL(x, y + hgt - 1, w, K('linen', 2))
        c.P(x + w // 2, y + 1, K('linen', 2)); c.P(x + w // 2 - 1, y + 2, K('linen', 2)); c.P(x + w // 2 + 1, y + 2, K('linen', 2))
        if seal: c.P(x + w // 2, y + 2, K('red', 3))
    if d == 'down':
        env(8, ts + 6, 8, 6, 3); env(9, ts + 4, 7, 5, 4, False); env(8, ts + 8, 8, 5)
        c.VL(11, ts + 4, 9, K('brass', 3)); c.HL(8, ts + 9, 8, K('brass', 3)); c.P(11, ts + 9, K('brass', 4))
        c.R(5, ts + 7, 3, 3, SK(3)); c.R(16, ts + 7, 3, 3, SK(3))
    elif d == 'right':
        env(12, ts + 5, 6, 8, 3); env(13, ts + 4, 5, 6, 4, False); c.VL(14, ts + 4, 9, K('brass', 3)); c.HL(12, ts + 9, 6, K('brass', 3))
    else:
        c.R(9, ts + 8, 6, 2, K('linen', 2)); c.HL(9, ts + 8, 6, K('linen', 3))   # 등 뒤로 살짝 보이는 가방끈


def _hand_prop(prop, side='r', dx=0, dy=0):
    def post(c, d, f, g):
        x, y = _hand(g, d, side)
        prop(c, x + dx, y + dy)
    return post


def _combine(*fs):
    def fn(c, d, f, g):
        for q in fs: q(c, d, f, g)
    return fn


def _chr(id_, name, desc, tags=(), **sp):
    REG.character(id_, name, 'shared', desc=desc, tags=list(tags))(_make(sp))


_chr('wz-chr-professor', '교수', '긴 보라 로브·뾰족 모자·흰 수염, 금 단추 줄.', ['adult'],
     robe='violet', rt=2, long=1, hair='hair_grey', hat='pointy', hatc='violet', hemc=K('brass', 2), cuff=K('brass', 2),
     pre=_prof_pre, post=_beard, pants=('night', 1), top=7)
_chr('wz-chr-caretaker', '성 관리인', '누더기 갈색 코트·낡은 모자·등불을 든 관리인.', ['adult'],
     robe='wood', rt=2, long=1, ragged=1, hair='hair_grey', hat='cap', hatc='wood', pants=('wood', 0), shoe=('night', 1),
     post=_hand_prop(_lantern, 'r'), top=7, seam=0, armlen=6)
_chr('wz-chr-librarian', '사서', '머리를 높이 묶은 회색 로브·안경·책.', ['adult'],
     robe='slate', rt=2, long=1, hair='hair_dark', style='bun', glasses=1, hemc=K('slate', 1), cuff=K('linen', 3),
     post=_hand_prop(lambda c, x, y: _book(c, x, y - 1, 'red'), 'l', 0, 0), top=8)
_chr('wz-chr-owlpost-student', '부엉이 우편 담당 학생', '검은 로브·편지 묶음을 안은 학생.', ['student'],
     robe='night', rt=2, hair='hair_blond', hemc=K('brass', 2), cuff=K('brass', 2), pre=None, post=_letters, top=7)
_chr('wz-chr-winter-postman', '겨울 마법 우편 배달원', '두꺼운 푸른 망토·붉은 목도리·털모자·우편 가방.', ['adult'],
     robe='water', rt=1, long=2, hair='hair_dark', hat='fur', hemc=K('linen', 3), pre=_scarf('red', 'linen'), post=_bag,
     pants=('wood', 0), shoe=('wood', 0), top=7)
_chr('wz-chr-potions-apron', '마법약 앞치마 학생', '로브 위 가죽 앞치마·걷어붙인 소매.', ['student'],
     robe='night', rt=2, hair='hair_red', rolled=3, upfix=1, pre=_apron, hemc=K('night', 1), top=7)
_chr('wz-chr-gear-mechanic', '기어 정비사', '푸른 작업복·이마 위 고글·렌치.', ['adult'],
     robe='iron', rt=2, hair='hair_dark', hat='goggles', rolled=3, pants=('slate', 1), shoe=('iron', 1), pre=_overall,
     post=_hand_prop(_wrench, 'r', 0, 0), top=7)
_chr('wz-chr-carriage-guide', '마차 승차 안내인', '제모·검은 코트·붉은 허리띠·등불.', ['adult'],
     robe='night', rt=1, long=1, hair='hair_grey', hat='cap', hatc='night', cuff=K('linen', 3), pre=_guide_pre,
     post=_hand_prop(_lantern, 'r'), pants=('night', 0), shoe=('night', 1), top=7, armlen=6)
_chr('wz-chr-travel-student', '여행 망토 학생', '후드 달린 녹색 여행 망토·트렁크 손잡이.', ['student'],
     robe='leaf', rt=1, long=1, hair='hair_dark', hat='hood', hatc='leaf', hemc=K('leaf', 0), cuff=K('brass', 2),
     post=_hand_prop(_trunk, 'r', 0, 0), top=8, armlen=5)

if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
