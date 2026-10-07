"""캐릭터 B — 온실·병동·퀴디치·보트·허니듀크·마법 상점 인물 12명(24×32 걷기 시트).
  python3 scripts/content/wizarding/pieces/characters_b.py   → 검사 + tiledata/wizarding/review/characters_b.png
공통 몸 함수 figure() 하나에 옷·머리·소품(deco)만 바꿔 직업별 실루엣을 만든다.
왼쪽은 오른쪽을 그린 뒤 좌우 반전한다(소품은 반대 손으로 옮겨 간다).
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from wzlib import REG, Cv, K, OL, OL2, run_module   # noqa: E402

MODULE = 'characters_b'


# ───────────────────────── 색 도우미 ─────────────────────────
def ramp(name, *tiers):
    return [K(name, t) for t in tiers]


def SK(t):
    return K('skin', t)


# 옷감 4단: [깊은, 그늘, 바탕, 밝은]
def cloth(name, a, b, c, d):
    return [K(name, a), K(name, b), K(name, c), K(name, d)]


def inside(x, y, cy, rx=7.0, ry=6.6):
    return ((x + 0.5 - 12) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0


def pts(c, lst, col):
    for x, y in lst:
        c.P(x, y, col)


def limb(c, x0, y0, x1, y1, col, w=2):
    """두께 w 의 팔다리(가로로 w 줄)."""
    for k in range(w):
        c.line(x0 + k, y0, x1 + k, y1, col)


# ───────────────────────── 머리 ─────────────────────────
def head(c, d, s):
    top = s['top']
    cy = top + 6.5
    hair = s['hair']
    H = [K(hair, i) for i in range(4)]
    hs = s.get('hairstyle', 'short')
    bare = s.get('bald', False)
    # 얼굴 바탕
    c.ellipse(12, cy, 7.0, 6.6, SK(3))
    for y in range(top, top + 13):
        for x in range(4, 20):
            if not inside(x, y, cy):
                continue
            # 오른쪽·아래 그늘
            if x >= 17 and y >= top + 6:
                c.P(x, y, SK(2))
            if y == top + 12:
                c.P(x, y, SK(2))
    if d == 'down':
        # 눈 2px 세로
        for ex in (9, 14):
            c.P(ex, top + 10, OL)
            c.P(ex, top + 11, OL)
        c.P(11, top + 12, SK(1)); c.P(12, top + 12, SK(1))
    elif d == 'right':
        for dy in (10, 11):
            c.P(15, top + dy, OL)
        c.P(11, top + 9, SK(2)); c.P(11, top + 10, SK(2))   # 귀
        c.P(19, top + 9, SK(3)); c.P(19, top + 10, SK(2))   # 코
        c.P(17, top + 12, SK(1))
    if bare:
        return
    # ───── 머리카락
    def hp(x, y, col):
        if inside(x, y, cy):
            c.P(x, y, col)
    for y in range(top, top + 13):
        for x in range(4, 20):
            if not inside(x, y, cy):
                continue
            r = y - top
            hair_px = False
            if d == 'down':
                if r <= 6:
                    hair_px = True
                elif r == 7:
                    hair_px = not (x in (11, 12) and s.get('part', True))
                elif r == 8:
                    hair_px = x <= 8 or x >= 16
                elif r in (9, 10):
                    hair_px = x <= 5 or x >= 18
            elif d == 'up':
                if r <= 10:
                    hair_px = True
                elif r == 11:
                    hair_px = 7 <= x <= 16
            else:  # right
                if r <= 6:
                    hair_px = True
                elif r == 7:
                    hair_px = x <= 17
                elif r == 8:
                    hair_px = x <= 13
                elif r <= 10:
                    hair_px = x <= 10
                elif r == 11:
                    hair_px = x <= 8
            if not hair_px:
                continue
            col = H[2]
            # 빛: 왼쪽 위
            if r <= 3 and (x - 5) + r <= 8 + (3 if d == 'up' else 0):
                col = H[3]
            elif x >= 15 and r >= 3:
                col = H[1]
            if d == 'right' and x <= 8 and r >= 4:
                col = H[1]
            if d == 'up' and r >= 8:
                col = H[1]
            c.P(x, y, col)
    # 앞머리 아랫단 그늘
    if d == 'down':
        for x in range(6, 18):
            if inside(x, top + 7, cy) and not (x in (11, 12)):
                c.P(x, top + 7, H[1] if x % 3 else H[2])
        c.P(8, top + 8, H[1]); c.P(16, top + 8, H[1])
    if d == 'right':
        for x in range(9, 18):
            c.P(x, top + 7, H[1] if x > 13 else H[2])
    # 머리 윗선 어두운 테
    for x in range(4, 20):
        for y in (top,):
            if inside(x, y, cy) and d != 'up':
                c.P(x, y, H[1])
    # 머리 모양 변형
    if hs == 'long':
        if d == 'down':
            for yy in range(top + 8, top + 17):
                c.P(5, yy, H[2]); c.P(4, yy, H[1]); c.P(18, yy, H[1]); c.P(19, yy, H[1] if yy > top + 9 else H[2])
        elif d == 'up':
            for yy in range(top + 11, top + 17):
                for xx in range(6, 18):
                    c.P(xx, yy, H[1] if xx > 12 else H[2])
        else:
            for yy in range(top + 8, top + 17):
                for xx in range(5, 10):
                    c.P(xx, yy, H[1] if xx < 7 else H[2])
    elif hs == 'bun':
        if d == 'down' or d == 'up':
            c.ellipse(12, top - 0.5, 3.0, 2.2, H[2])
            c.P(10, top - 2, H[3]); c.P(11, top - 2, H[3])
            c.HL(10, top + 1, 5, H[1])
        else:
            c.ellipse(8.5, top + 1.5, 2.8, 2.6, H[2])
            c.P(7, top, H[3]); c.P(8, top, H[3])
            c.HL(6, top + 3, 5, H[1])
    elif hs == 'messy':
        pts(c, [(6, top - 1), (8, top - 1), (10, top - 2), (13, top - 1), (15, top - 1), (17, top - 1)], H[2])
        pts(c, [(7, top - 1), (9, top - 2), (14, top - 2)], H[3])
        pts(c, [(7, top), (9, top - 1), (11, top - 1), (14, top)], H[2])


# ───────────────────────── 다리·신발 ─────────────────────────
def legs(c, d, f, s):
    pants = s['pants']      # [그늘, 바탕, 밝은]
    shoe = s['shoe']        # [어두운, 바탕, 밝은]
    if d in ('down', 'up'):
        # f0: 왼 다리 앞(낮음), 오른 다리 뒤(들림). f2 반대.
        lf = 0 if f == 1 else (1 if f == 0 else -1)
        for side, x0 in ((0, 9), (1, 13)):
            fwd = (lf == 1 and side == 0) or (lf == -1 and side == 1)
            back = (lf == 1 and side == 1) or (lf == -1 and side == 0)
            end = 29 if not back else 27
            c.R(x0, 27, 2, end - 27 + 1, pants[1])
            if s.get('knee') and not back:
                c.R(x0, 28, 2, 1, s['knee'][1])
            c.VL(x0 + 1, 27, end - 27 + 1, pants[0])
            sy = 30 if not back else 28
            # 신발(앞 다리가 약간 앞으로 = 아래·넓게)
            sx = x0 - 1
            sw_ = 4
            if back:
                sx += 1 if side == 0 else 0
                sw_ = 3
            c.R(sx, sy, sw_, 2, shoe[1])
            if d == 'down' and not back:
                c.HL(sx, sy, sw_, shoe[2])
            c.HL(sx, sy + 1, sw_, shoe[0])
            if fwd:
                c.R(x0, 29, 2, 1, pants[1])
    else:
        lf = 0 if f == 1 else (1 if f == 0 else -1)  # +1: 가까운 다리 앞
        # 먼 다리(그늘 색)
        fx = {0: 10, 1: 12, -1: 8}
        # 가까운 다리 앞(+1): 발 x 오른쪽, 먼 다리 뒤
        def one(near, kind):
            col = pants[1] if near else pants[0]
            sc = shoe[1] if near else shoe[0]
            if kind == 0:     # 서 있음
                x = 9 if near else 12
                c.R(x, 27, 3, 3, col)
                c.R(x, 30, 5, 2, sc)
                c.HL(x, 30, 5, shoe[2] if near else shoe[1])
                c.HL(x, 31, 5, shoe[0])
                if s.get('knee'):
                    c.R(x, 28, 3, 1, s['knee'][1 if near else 0])
            elif kind > 0:    # 앞으로
                limb(c, 11, 27, 13, 29, col, 3)
                c.R(13, 30, 5, 2, sc)
                c.HL(13, 30, 5, shoe[2] if near else shoe[1])
                c.HL(13, 31, 5, shoe[0])
                if s.get('knee'):
                    c.R(12, 28, 3, 1, s['knee'][1 if near else 0])
            else:             # 뒤로(들림)
                limb(c, 11, 27, 9, 28, col, 3)
                c.R(6, 29, 5, 2, sc)
                c.HL(6, 29, 5, shoe[2] if near else shoe[1])
                c.HL(6, 30, 5, shoe[0])
                if s.get('knee'):
                    c.R(9, 27, 3, 1, s['knee'][1 if near else 0])
        one(False, -lf if lf else 0)
        one(True, lf)


# ───────────────────────── 몸통·팔 ─────────────────────────
def torso(c, d, s, g):
    t0 = g['t0']; hem = g['hem']
    cl = s['cloth']           # [깊은, 그늘, 바탕, 밝은]
    wide = s.get('wide', 0)
    flare = s.get('flare', 1)
    if d in ('down', 'up'):
        x0, x1 = 7 - wide, 16 + wide
        for y in range(t0, hem + 1):
            fl = flare if y >= hem - 3 else 0
            c.HL(x0 - fl, y, x1 - x0 + 1 + 2 * fl, cl[2])
        # 명암: 왼쪽 밝음, 오른쪽 그늘, 밑단 그늘
        for y in range(t0, hem + 1):
            fl = flare if y >= hem - 3 else 0
            c.P(x0 - fl, y, cl[3])
            c.P(x1 + fl, y, cl[1])
            c.P(x1 + fl - 1, y, cl[1])
        c.HL(x0 - flare, hem, x1 - x0 + 1 + 2 * flare, cl[1])
        c.HL(x0, t0, x1 - x0 + 1, cl[3])
        if d == 'up':
            c.VL(12, t0 + 2, hem - t0 - 2, cl[1])    # 등 솔기
    else:
        x0, x1 = 7 - wide, 15 + wide
        for y in range(t0, hem + 1):
            fl = flare if y >= hem - 3 else 0
            c.HL(x0 - fl, y, x1 - x0 + 1 + 2 * fl, cl[2])
            c.P(x0 - fl, y, cl[3] if y < hem - 3 else cl[1])
            c.P(x1 + fl, y, cl[1])
        c.HL(x0 - flare, hem, x1 - x0 + 1 + 2 * flare, cl[1])
        c.HL(x0, t0, x1 - x0 + 1, cl[3])


def arms(c, d, f, s, g):
    t0 = g['t0']
    sl = s.get('sleeve', s['cloth'])
    hand = s.get('hand', [SK(2), SK(3), SK(4)])
    wide = s.get('wide', 0)
    sw = 0 if f == 1 else (1 if f == 0 else -1)
    if d in ('down', 'up'):
        for side in (0, 1):
            x = 5 - wide if side == 0 else 17 + wide
            dy = sw if side == 0 else -sw
            if d == 'up':
                dy = -dy
            y0 = t0 + 1 + (2 if dy > 0 else 0)
            ln = 5 + (0 if dy >= 0 else -2) + s.get('arm_ext', 0)
            c.R(x, y0, 2, ln, sl[2])
            c.VL(x if side == 1 else x + 1, y0, ln, sl[1] if side == 1 else sl[3])
            c.VL(x + (0 if side == 1 else 1), y0, ln, sl[1] if side == 1 else sl[2])
            c.R(x, y0 + ln, 2, 2, hand[1])
            c.HL(x, y0 + ln, 2, hand[2])
            c.HL(x, y0 + ln + 1, 2, hand[0])
            g['hand_%s' % ('l' if side == 0 else 'r')] = (x + (0 if side == 0 else 1), y0 + ln + 1)
        g['hand'] = g['hand_r']
    else:
        # 먼 팔(그늘)·가까운 팔. 가까운 다리가 앞(+1)일 때 가까운 팔은 뒤.
        for near in (False, True):
            k = -sw if near else sw
            col = sl[2] if near else sl[1]
            sx = 11
            ex = sx + 3 * k
            ey = t0 + 6 - (1 if k else 0)
            limb(c, sx, t0 + 1, ex, ey, col, 2)
            c.R(ex, ey, 2, 2, hand[1] if near else hand[0])
            if near:
                c.P(ex, ey, hand[2])
                g['hand'] = (ex + 1, ey + 1)
        # 어깨선
        c.HL(10, t0 + 1, 3, sl[3])


# ───────────────────────── 공통 몸 ─────────────────────────
def figure(c, d, f, s, deco=None):
    if d == 'left':
        tmp = Cv(24, 32)
        figure(tmp, 'right', f, s, deco)
        c.blit(tmp.flip_h(), 0, 0)
        return
    top = s['top']
    g = {'t0': top + 13, 'hem': s.get('hem', 27), 'top': top, 'dir': d, 'f': f}
    pre = s.get('pre')          # 몸 뒤에 그릴 것(빗자루 등)
    if deco and deco.get('back'):
        deco['back'](c, d, f, s, g)
    legs(c, d, f, s)
    torso(c, d, s, g)
    arms(c, d, f, s, g)
    if deco and deco.get('mid'):
        deco['mid'](c, d, f, s, g)
    head(c, d, s)
    if deco and deco.get('front'):
        deco['front'](c, d, f, s, g)
    c.outline()


def make(cid, name, space, desc, s, deco=None, tags=()):
    @REG.character(cid, name, space, desc, tags=tags)
    def _fn(c, d, f):
        figure(c, d, f, s, deco)
    return _fn


# ───────────────────────── 캐릭터 정의 ─────────────────────────
PANTS_DARK = [K('night', 1), K('night', 2), K('night', 3)]
PANTS_BROWN = [K('wood', 1), K('wood', 2), K('wood', 3)]
SHOE_DARK = [K('ink', 0), K('wood', 1), K('wood', 2)]
SHOE_BROWN = [K('ink', 0), K('wood', 2), K('wood', 3)]



# ───────────────────────── 소품(deco) ─────────────────────────
def hand_pt(g, d):
    return g['hand']


def rows_in_head(c, g, y0, y1, fn):
    top = g['top']; cy = top + 6.5
    for y in range(top + y0, top + y1 + 1):
        for x in range(4, 20):
            if inside(x, y, cy):
                col = fn(x, y - top)
                if col is not None:
                    c.P(x, y, col)


def lantern(c, g, d, f):
    hx, hy = g['hand']
    c.R(hx - 1, hy + 1, 4, 5, K('brass', 2))
    c.R(hx, hy + 2, 2, 3, K('fire', 2))
    c.P(hx, hy + 2, K('fire', 3)); c.P(hx + 1, hy + 3, K('fire', 4))
    c.HL(hx - 1, hy + 1, 4, K('brass', 4))
    c.HL(hx - 1, hy + 5, 4, K('brass', 0))
    c.P(hx, hy, K('brass', 3)); c.P(hx + 1, hy, K('brass', 1))


# 1. 귀마개 학생
def earmuff_front(c, d, f, s, g):
    top = g['top']
    sn = [K('snow', i) for i in range(4)]
    if d in ('down', 'up'):
        for cx in (4.5, 19.5):
            c.ellipse(cx, top + 8.5, 3.2, 3.6, sn[2])
            c.ellipse(cx + (0.4 if cx < 10 else -0.4), top + 9.5, 2.0, 2.4, sn[1] if cx > 10 else sn[2])
            c.P(int(cx) - 1, top + 6, sn[3]); c.P(int(cx), top + 6, sn[3])
            c.P(int(cx) - 1, top + 7, sn[3]) if cx < 10 else None
            c.P(int(cx) + 1, top + 11, sn[0]); c.P(int(cx), top + 11, sn[0])
        for x in range(6, 18):
            yy = top + 1 + int(round(((x + 0.5 - 12) / 7.0) ** 2 * 3.2))
            c.P(x, yy, K('iron', 2)); c.P(x, yy + 1, K('iron', 1)) if d == 'down' else None
        for y in range(top + 3, top + 7):
            c.P(5 if y > top + 4 else 6, y, K('iron', 2)); c.P(18 if y > top + 4 else 17, y, K('iron', 1))
    else:
        c.ellipse(11, top + 8.5, 3.6, 3.8, sn[2])
        c.ellipse(10.6, top + 9.3, 2.3, 2.4, sn[1])
        c.P(9, top + 6, sn[3]); c.P(10, top + 6, sn[3]); c.P(8, top + 7, sn[3])
        c.P(11, top + 11, sn[0]); c.P(10, top + 11, sn[0])
        for y in range(top + 1, top + 6):
            c.P(11, y, K('iron', 2)); c.P(12, y, K('iron', 1))
        c.P(10, top + 1, K('iron', 2))
    # 목도리(노랑)
    b = [K('brass', i) for i in range(6)]
    if d in ('down', 'up'):
        c.R(7, top + 12, 10, 2, b[3]); c.HL(7, top + 13, 10, b[2]); c.HL(7, top + 12, 4, b[4])
        c.R(14, top + 14, 3, 4, b[3]); c.VL(16, top + 14, 4, b[2]); c.HL(14, top + 17, 3, b[1]) 
    else:
        c.R(8, top + 12, 7, 2, b[3]); c.HL(8, top + 13, 7, b[2]); c.HL(8, top + 12, 3, b[4])
        c.R(7, top + 14, 3, 4, b[3]); c.VL(7, top + 14, 4, b[2]); c.HL(7, top + 17, 3, b[1])


make('wz-chr-earmuff-student', '귀마개 약초학 학생', 'greenhouse',
     '큰 털 귀마개·목도리·가죽 장갑을 낀 약초학 학생', dict(
         top=7, hair='hair_dark', pants=PANTS_DARK, shoe=SHOE_DARK,
         cloth=cloth('night', 0, 1, 2, 3), hand=[K('wood', 1), K('wood', 2), K('wood', 4)]),
     dict(front=earmuff_front))


# 2. 온실 교수
def prof_mid(c, d, f, s, g):
    t0, hem = g['t0'], g['hem']
    D = [K('dirt', i) for i in range(6)]
    for (x, y) in ((5, hem - 1), (8, hem), (12, hem - 2), (16, hem), (18, hem - 1), (9, t0 + 4), (15, t0 + 6), (7, hem - 4)):
        if d == 'down' or d == 'up':
            c.P(x, y, D[3]); c.P(x + 1, y, D[4])
        elif 7 <= x <= 16:
            c.P(x - 1, y, D[3]); c.P(x, y, D[4])
    if d == 'down':   # 허리끈 주머니
        c.HL(8, t0 + 7, 8, D[1]); c.R(9, t0 + 8, 3, 3, D[4]); c.HL(9, t0 + 8, 3, D[5])


def prof_front(c, d, f, s, g):
    top = g['top']
    h = [K('wood', i) for i in range(6)]
    # 챙 넓은 낡은 모자
    c.ellipse(12, top + 2.2, 9, 2.2, h[3])
    c.HL(2, top + 3, 20, h[2]) if d != 'right' else None
    for x in range(3, 21):
        c.P(x, top + 4, h[1]) if (x - 12) ** 2 < 90 and 3 < x < 20 else None
    c.ellipse(12, top - 0.8, 5.6, 3.4, h[3])
    c.HL(7, top + 1, 11, h[1])                # 띠
    c.HL(7, top, 11, h[2])
    c.P(18, top - 2, h[3]); c.P(19, top - 3, h[3]); c.P(19, top - 2, h[2])   # 처진 끝
    for x in (6, 8, 10):
        c.P(x, top - 2, h[4])
    c.P(5, top + 3, h[1]); c.P(20, top + 3, h[1])
    if d == 'down' or d == 'right':
        c.P(14, top + 3, h[4]); c.P(4, top + 2, h[4])


make('wz-chr-greenhouse-professor', '온실 담당 교수', 'greenhouse',
     '흙 묻은 초록 망토와 챙 처진 낡은 모자의 약초학 교수', dict(
         top=4, hair='hair_grey', pants=PANTS_BROWN, shoe=SHOE_BROWN, hem=29, flare=2, wide=1,
         cloth=cloth('leaf', 0, 1, 2, 3), hand=[K('skin', 1), K('skin', 2), K('skin', 3)]),
     dict(mid=prof_mid, front=prof_front))


# 3. 야간 치료사
def healer_mid(c, d, f, s, g):
    t0, hem = g['t0'], g['hem']
    L = [K('linen', i) for i in range(5)]
    if d == 'down':
        c.R(8, t0 + 1, 8, hem - t0, L[3])
        c.VL(15, t0 + 1, hem - t0, L[2]); c.VL(8, t0 + 1, hem - t0, L[4])
        c.HL(8, hem, 8, L[1]); c.HL(8, t0 + 1, 8, L[4])
        c.R(10, t0 + 3, 4, 3, L[2]); c.HL(10, t0 + 3, 4, L[4]); c.HL(10, t0 + 5, 4, L[1])   # 주머니
        c.P(9, t0 + 1, K('night', 1)); c.P(14, t0 + 1, K('night', 1))
    elif d == 'up':
        c.R(8, t0 + 7, 8, hem - t0 - 6, L[3]); c.HL(8, hem, 8, L[1])
        c.P(11, t0 + 8, L[1]); c.P(12, t0 + 8, L[1])     # 허리 매듭
        c.P(10, t0 + 9, L[2]); c.P(13, t0 + 9, L[2])
    else:
        c.R(11, t0 + 1, 5, hem - t0, L[3])
        c.VL(11, t0 + 1, hem - t0, L[4]); c.VL(15, t0 + 1, hem - t0, L[2])
        c.HL(11, hem, 5, L[1])
        c.R(12, t0 + 4, 3, 2, L[2]); c.HL(12, t0 + 4, 3, L[4])


def healer_front(c, d, f, s, g):
    top = g['top']
    L = [K('snow', i) for i in range(4)]
    R_ = K('red', 3)
    # 간호 모자
    if d == 'right':
        c.R(6, top - 1, 10, 4, L[2]); c.HL(6, top - 1, 10, L[3]); c.HL(6, top + 2, 10, L[1])
        c.P(16, top, L[1]); c.P(16, top + 1, L[1])
        c.P(11, top, R_); c.P(11, top + 1, R_); c.P(10, top + 1, R_); c.P(12, top + 1, R_)
    else:
        c.R(6, top - 1, 12, 4, L[2]); c.HL(6, top - 1, 12, L[3]); c.HL(6, top + 2, 12, L[1])
        c.P(5, top + 1, L[1]); c.P(18, top + 1, L[1])
        if d == 'down':
            c.P(12, top - 1, R_); c.P(12, top + 1, R_); c.P(11, top, R_); c.P(12, top, R_); c.P(13, top, R_)
    if d == 'up':   # 쪽 찐 머리
        c.ellipse(12, top + 9, 3.2, 2.5, K('hair_blond', 2))
        c.HL(10, top + 8, 5, K('hair_blond', 3)); c.HL(10, top + 11, 5, K('hair_blond', 1))
    lantern(c, g, d, f)


make('wz-chr-night-healer', '야간 치료사', 'infirmary',
     '흰 앞치마·간호 모자에 등불을 든 병동 야간 치료사', dict(
         top=4, hair='hair_blond', pants=PANTS_DARK, shoe=SHOE_DARK, hem=28, flare=1,
         cloth=cloth('night', 0, 1, 2, 3)),
     dict(mid=healer_mid, front=healer_front))


# 4. 붕대 환자
def patient_mid(c, d, f, s, g):
    t0, hem = g['t0'], g['hem']
    L = [K('linen', i) for i in range(5)]
    W = [K('water', i) for i in range(6)]
    # 잠옷 줄무늬
    for y in range(t0 + 2, hem, 3):
        if d in ('down', 'up'):
            c.HL(8, y, 8, W[4])
        else:
            c.HL(8, y, 7, W[4])
    # 팔 붕대 + 걸이
    if d == 'down':
        hx, hy = g['hand_l']
        c.R(hx, hy - 5, 2, 5, L[3]); c.HL(hx, hy - 4, 2, L[1]); c.HL(hx, hy - 2, 2, L[1]); c.VL(hx, hy - 5, 5, L[4])
        c.poly([(8, t0 + 1), (16, t0 + 1), (16, t0 + 3), (9, t0 + 9)], L[3]) if False else None
        for k in range(0, 7):
            c.P(8 + k, t0 + 1 + k // 2, L[2])      # 어깨 걸이 끈
    elif d == 'up':
        hx, hy = g['hand_r']
        c.R(hx - 1, hy - 5, 2, 5, L[3]); c.HL(hx - 1, hy - 4, 2, L[1]); c.HL(hx - 1, hy - 2, 2, L[1])
    else:
        hx, hy = g['hand']
        c.R(hx - 2, hy - 3, 3, 4, L[3]); c.HL(hx - 2, hy - 2, 3, L[1]); c.VL(hx - 2, hy - 3, 4, L[4])


def patient_front(c, d, f, s, g):
    top = g['top']
    L = [K('linen', i) for i in range(5)]
    def band(x, r):
        if 2 <= r <= 5:
            return L[1] if (x + r) % 4 == 0 else (L[4] if r == 2 else L[3] if r != 5 else L[2])
        return None
    if d == 'right':
        rows_in_head(c, g, 2, 5, lambda x, r: band(x, r))
        c.P(5, top + 6, L[3]); c.P(5, top + 7, L[2])
    else:
        rows_in_head(c, g, 2, 5, lambda x, r: band(x, r))
    # 한쪽 눈 위 붕대 조각
    if d == 'down':
        c.R(13, top + 6, 3, 2, L[3]); c.P(15, top + 7, L[1])


make('wz-chr-bandaged-patient', '붕대 환자', 'infirmary',
     '머리와 팔에 붕대를 감은 줄무늬 잠옷 환자(빨간 슬리퍼)', dict(
         top=7, hair='hair_red', hairstyle='messy', pants=[K('water', 1), K('water', 2), K('water', 3)],
         shoe=[K('red', 0), K('red', 2), K('red', 3)], cloth=cloth('water', 0, 2, 3, 4)),
     dict(mid=patient_mid, front=patient_front))


# 5~8. 퀴디치 선수
def _handle(c, x0, y0, x1, y1):
    """빗자루 자루 2px: 위(왼쪽) 줄 밝게, 아래 줄 그늘. 끝에 밝은 마구리 1px."""
    h = [K('wood', i) for i in range(6)]
    c.line(x0, y0 + 1, x1, y1 + 1, h[2])
    c.line(x0, y0, x1, y1, h[4])
    c.P(x0, y0, h[5])


def _bristles(c, x0, y0, ux, uy, L=5, w0=1.0, w1=2.6):
    """빗자루 솔: 묶음띠(황동)에서 (ux,uy) 방향으로 넓어지는 부채꼴, 3단 명암(왼쪽 위 밝음)."""
    import math
    n = math.hypot(ux, uy); ux, uy = ux / n, uy / n
    px, py = -uy, ux                      # 수직 방향
    if px + py > 0:                       # 수직축이 왼쪽 위(밝은 쪽)를 향하게
        px, py = -px, -py
    D = [K('dirt', i) for i in range(6)]
    t = 0.0
    while t <= L:
        hw = w0 + (w1 - w0) * t / L
        k = -hw
        while k <= hw:
            x = int(round(x0 + ux * t + px * k)); y = int(round(y0 + uy * t + py * k))
            rel = k / hw if hw else 0
            col = D[5] if rel > 0.45 else (D[3] if rel > -0.35 else D[1])
            if t > L - 1.2 and int(round(k)) % 2:      # 끝 잔가지 들쭉날쭉
                col = D[2] if rel <= 0.45 else D[4]
            c.P(x, y, col)
            k += 0.5
        t += 0.5
    # 묶음띠
    bx, by = int(round(x0)), int(round(y0))
    c.P(bx, by, K('brass', 3)); c.P(int(round(x0 + px)), int(round(y0 + py)), K('brass', 4))
    c.P(int(round(x0 - px)), int(round(y0 - py)), K('brass', 2))


def broom_back(c, d, f, s, g):
    """등에 멘 빗자루 중 몸 뒤로 가는 것(앞·옆 보기)."""
    if d == 'down':
        # 자루 끝은 (보는 쪽) 오른 어깨 위, 솔은 왼 허리 밖으로
        _handle(c, 21, 12, 7, 21)
        _bristles(c, 6, 21, -0.8, 0.55, L=4.5, w0=1.0, w1=2.4)
    elif d == 'right':
        # 등(왼쪽) 윤곽 뒤로 거의 세로: 머리 뒤에서 내려와 허리 뒤로 솔
        _handle(c, 6, 9, 4, 20)
        _bristles(c, 4, 20, -0.45, 0.9, L=4.5, w0=1.0, w1=2.2)


def broom_mid(c, d, f, s, g):
    """뒷모습: 빗자루가 등 위에 사선으로 얹힌다(머리 밑, 몸 위)."""
    if d == 'up':
        _handle(c, 3, 12, 17, 21)
        _bristles(c, 18, 21, 0.8, 0.55, L=4.5, w0=1.0, w1=2.4)


def broom_over(c, d, f, s, g):
    """뒷모습: 목덜미 아래로는 자루가 머리카락 위로 드러난다(등에 얹힌 막대)."""
    if d != 'up':
        return
    tmp = Cv(24, 32)
    _handle(tmp, 3, 12, 17, 21)
    for y in range(g['top'] + 11, 32):
        for x in range(24):
            if tmp.opaque(x, y):
                c.P(x, y, tmp.get(x, y))


def quid_mid(house, trim):
    def fn(c, d, f, s, g):
        t0, hem = g['t0'], g['hem']
        T = trim
        bw = 10 if d in ('down', 'up') else 9

        def band():
            if house == 'house_h':
                # 순흑 2px 띠 대신 1px 짙은 갈색 줄 2개(위 줄 왼쪽에 한 단 밝은 결) — 줄무늬 천으로 읽히게
                c.HL(7, t0 + 4, bw, K('wood', 2)); c.HL(7, t0 + 4, 3, K('wood', 3))
                c.HL(7, t0 + 6, bw, K('wood', 1)); c.P(7, t0 + 6, K('wood', 2))
            else:
                c.HL(7, t0 + 4, bw, T); c.HL(7, t0 + 5, bw, darker(T, 1))
        band()
        if d == 'down':
            c.P(11, t0 + 8, T); c.P(12, t0 + 8, T); c.P(11, t0 + 9, T); c.P(12, t0 + 9, T)
            hl, hr = g['hand_l'], g['hand_r']
            c.R(hl[0], hl[1] - 3, 2, 2, K('wood', 4)); c.HL(hl[0], hl[1] - 3, 2, K('wood', 5))
            c.R(hr[0] - 1, hr[1] - 3, 2, 2, K('wood', 3)); c.HL(hr[0] - 1, hr[1] - 3, 2, K('wood', 4))
        elif d == 'up':
            hl, hr = g['hand_l'], g['hand_r']
            c.R(hl[0], hl[1] - 3, 2, 2, K('wood', 4)); c.R(hr[0] - 1, hr[1] - 3, 2, 2, K('wood', 3))
        else:
            hx, hy = g['hand']
            c.R(hx - 1, hy - 2, 3, 2, K('wood', 4)); c.HL(hx - 1, hy - 2, 3, K('wood', 5))
    return fn


def darker_tier(c):  # placeholder to keep names explicit
    return c


def quid_front(kind, col):
    def fn(c, d, f, s, g):
        top = g['top']
        cy = top + 6.5
        if kind == 'band':        # 머리띠
            rows_in_head(c, g, 4, 5, lambda x, r: col if r == 4 else darker(col, 1))
        elif kind == 'goggle':    # 이마 위 고글
            if d == 'down':
                for gx in (7, 13):
                    c.R(gx, top + 5, 4, 3, K('iron', 2)); c.R(gx + 1, top + 6, 2, 1, K('water', 4))
                    c.HL(gx, top + 5, 4, K('iron', 4))
                c.HL(11, top + 6, 2, K('iron', 1))
            elif d == 'right':
                c.R(10, top + 5, 6, 3, K('iron', 2)); c.R(13, top + 6, 2, 1, K('water', 4)); c.HL(10, top + 5, 6, K('iron', 4))
                c.HL(5, top + 6, 5, K('iron', 1))
            else:
                c.HL(5, top + 6, 14, K('iron', 1))
        elif kind == 'cap':       # 가죽 모자
            w = [K('wood', i) for i in range(6)]
            def capc(x, r):
                if r > 5:
                    return None
                return w[4] if (r <= 2 and x + r <= 12) else (w[1] if r == 5 else (w[2] if x >= 15 else w[3]))
            rows_in_head(c, g, 0, 5, capc)
            if d == 'down':
                c.HL(6, top + 6, 12, w[1]) 
                c.P(5, top + 7, w[1]); c.P(18, top + 7, w[1]); c.P(5, top + 8, w[2]); c.P(18, top + 8, w[1])
            elif d == 'right':
                c.HL(15, top + 5, 6, w[1]); c.HL(16, top + 4, 4, w[3])
    return fn


from wzlib import darker   # noqa: E402


def quid(cid, name, house_ramp, cl, trim, front, desc, hairr='hair_dark', hairstyle='short', shirt_ramp=None):
    sp = dict(top=7, hair=hairr, hairstyle=hairstyle, pants=PANTS_BROWN, shoe=SHOE_DARK, cloth=cl,
              knee=[K('wood', 4), K('wood', 5)], hand=[K('wood', 1), K('wood', 2), K('wood', 4)])
    make(cid, name, 'quidditch', desc, sp,
         dict(back=broom_back, mid=lambda c, d, f, s, g: (quid_mid(house_ramp, trim)(c, d, f, s, g), broom_mid(c, d, f, s, g)),
              front=lambda c, d, f, s, g: (front(c, d, f, s, g), broom_over(c, d, f, s, g))))


quid('wz-chr-quidditch-gryffindor', '퀴디치 선수 (그리핀도르)', 'house_g', cloth('house_g', 0, 1, 2, 2), K('house_g', 3),
     quid_front('band', K('house_g', 3)), '진홍 경기복에 금띠, 팔·무릎 보호대, 등에 빗자루', hairr='hair_red')
quid('wz-chr-quidditch-slytherin', '퀴디치 선수 (슬리데린)', 'house_s', cloth('house_s', 0, 1, 2, 2), K('house_s', 3),
     quid_front('goggle', None), '녹색 경기복에 은띠, 이마 위 고글, 보호대, 등에 빗자루', hairr='hair_blond')
quid('wz-chr-quidditch-ravenclaw', '퀴디치 선수 (래번클로)', 'house_r', cloth('house_r', 0, 1, 2, 2), K('house_r', 3),
     quid_front('cap', None), '청색 경기복에 청동띠, 가죽 모자, 보호대, 등에 빗자루', hairr='hair_dark')
quid('wz-chr-quidditch-hufflepuff', '퀴디치 선수 (후플푸프)', 'house_h', cloth('brass', 1, 2, 3, 3), K('ink', 0),
     quid_front('band', K('ink', 0)), '노랑 경기복에 검은 띠, 보호대, 등에 빗자루', hairr='hair_dark', hairstyle='messy')


# 9. 보트 안내인
def guide_mid(c, d, f, s, g):
    t0, hem = g['t0'], g['hem']
    w = [K('wood', i) for i in range(6)]
    # 털 코트 밑단 술·허리띠
    for x in range(4, 21):
        c.P(x, hem + (1 if x % 2 else 0), w[4] if x % 3 else w[2]) if d in ('down', 'up') else None
    if d in ('down', 'up'):
        c.HL(5, t0 + 7, 14, K('dirt', 1))
        if d == 'down':
            c.R(11, t0 + 6, 2, 3, K('brass', 3)); c.P(11, t0 + 6, K('brass', 5))
        # 큰 칼라
        c.R(5, t0, 14, 3, w[4]); c.HL(5, t0, 14, w[5]); c.HL(5, t0 + 2, 14, w[2])
        for x in range(5, 19, 2):
            c.P(x, t0 + 3, w[4])
    else:
        c.HL(7, t0 + 7, 9, K('dirt', 1))
        c.R(7, t0, 9, 3, w[4]); c.HL(7, t0, 9, w[5]); c.HL(7, t0 + 2, 9, w[2])
        for x in range(7, 16, 2):
            c.P(x, t0 + 3, w[4])


def guide_front(c, d, f, s, g):
    top = g['top']
    hb = [K('hair_dark', i) for i in range(4)]
    if d == 'down':
        rows_in_head(c, g, 8, 12, lambda x, r: (hb[1] if x % 3 == 0 else hb[2]) if (r >= 9 or x <= 7 or x >= 16) and not (r == 9 and 10 <= x <= 13) else None)
        c.R(10, top + 9, 4, 1, SK(2))   # 입
        for y in range(top + 13, top + 16):
            for x in range(8 + (y - top - 13), 16 - (y - top - 13)):
                c.P(x, y, hb[2] if x < 12 else hb[1])
        c.P(10, top + 13, hb[3]); c.P(9, top + 14, hb[3])
        c.P(9, top + 10, OL); c.P(14, top + 10, OL)
    elif d == 'right':
        rows_in_head(c, g, 11, 12, lambda x, r: hb[2] if x >= 12 else None)
        for y in range(top + 13, top + 16):
            for x in range(11, 18 - (y - top - 13)):
                c.P(x, y, hb[2] if x < 14 else hb[1])
        c.P(11, top + 13, hb[3]); c.P(12, top + 14, hb[3])
    lantern(c, g, d, f)


make('wz-chr-boat-guide', '보트 안내인', 'boathouse',
     '덩치 큰 털 코트에 수염, 등불을 든 사냥터지기풍 보트 안내인', dict(
         top=4, hair='hair_dark', hairstyle='messy', pants=PANTS_BROWN, shoe=SHOE_BROWN, hem=28, flare=1, wide=2,
         cloth=cloth('wood', 1, 2, 3, 4), hand=[K('skin', 1), K('skin', 2), K('skin', 3)]),
     dict(mid=guide_mid, front=guide_front))


# 10. 노 젓는 학생
def rower_mid(c, d, f, s, g):
    t0, hem = g['t0'], g['hem']
    V = [K('leaf', i) for i in range(5)]
    L = [K('linen', i) for i in range(5)]
    if d == 'down':
        c.R(8, t0 + 1, 3, hem - t0, V[2]); c.R(13, t0 + 1, 3, hem - t0, V[2])
        c.VL(8, t0 + 1, hem - t0, V[3]); c.VL(15, t0 + 1, hem - t0, V[1]); c.VL(10, t0 + 1, hem - t0, V[1])
        c.HL(8, hem, 8, V[1])
        c.P(10, t0 + 3, K('brass', 4)); c.P(10, t0 + 5, K('brass', 4)); c.P(10, t0 + 7, K('brass', 4)) if False else None
        c.VL(11, t0 + 1, 2, L[1]) 
        hl, hr = g['hand_l'], g['hand_r']
        c.R(hl[0], hl[1] - 4, 2, 3, SK(3)); c.VL(hl[0], hl[1] - 4, 3, SK(4))
        c.R(hr[0] - 1, hr[1] - 4, 2, 3, SK(3)); c.VL(hr[0], hr[1] - 4, 3, SK(2))
        c.HL(hl[0], hl[1] - 5, 2, L[0]); c.HL(hr[0] - 1, hr[1] - 5, 2, L[0])   # 걷은 소매 접힘
    elif d == 'up':
        c.R(8, t0 + 1, 8, hem - t0, V[2]); c.VL(15, t0 + 1, hem - t0, V[1]); c.VL(8, t0 + 1, hem - t0, V[3]); c.HL(8, hem, 8, V[1])
        c.HL(8, t0 + 6, 8, K('dirt', 1))
        hl, hr = g['hand_l'], g['hand_r']
        c.R(hl[0], hl[1] - 4, 2, 3, SK(3)); c.R(hr[0] - 1, hr[1] - 4, 2, 3, SK(2))
    else:
        c.R(11, t0 + 1, 5, hem - t0, V[2]); c.VL(11, t0 + 1, hem - t0, V[3]); c.VL(15, t0 + 1, hem - t0, V[1]); c.HL(11, hem, 5, V[1])
        c.P(15, t0 + 3, K('brass', 4)); c.P(15, t0 + 5, K('brass', 4))
        hx, hy = g['hand']
        c.R(hx - 2, hy - 3, 3, 3, SK(3)); c.HL(hx - 2, hy - 4, 3, L[0])


def oar(c, sx, y_top, bx, by, bw=5, bh=8):
    """노: 2px 자루(sx, sx+1) + 아래쪽 넓은 둥근 노깃(bx..bx+bw-1, by..by+bh-1).
    노깃은 윗면 1px 밝은 반사선, 왼쪽 밝음, 오른쪽 모서리 어둡게, 아래 끝 둥글게."""
    dst, c = c, Cv(24, 32)                              # 따로 그려 얹는다(모서리 깎기가 몸을 지우지 않게)
    w = [K('wood', i) for i in range(6)]
    c.VL(sx, y_top, by - y_top + 1, w[4]); c.VL(sx + 1, y_top, by - y_top + 1, w[2])
    c.P(sx, y_top, w[5])
    # 노깃 몸
    c.R(bx, by, bw, bh, w[3])
    c.VL(bx, by, bh, w[4])
    c.VL(bx + bw - 1, by, bh, w[1]); c.VL(bx + bw - 2, by + 1, bh - 1, w[2])
    c.HL(bx, by + bh - 1, bw, w[2])
    c.VL(sx, by + 1, bh - 3, w[4])                      # 자루 등뼈가 노깃 안으로 이어짐
    c.HL(bx + 1, by, bw - 2, w[5])                      # 윗면 반사선
    # 둥근 어깨·끝(모서리 깎기)
    c.clear(bx, by); c.clear(bx + bw - 1, by)
    c.clear(bx, by + bh - 1); c.clear(bx + bw - 1, by + bh - 1)
    c.P(bx, by + 1, w[5])
    dst.blit(c, 0, 0)


def rower_back(c, d, f, s, g):
    if d not in ('right', 'left'):
        return
    # 옆 보기: 노는 등 뒤에 세워 들고, 노깃은 몸 뒤 아래로
    oar(c, 3, 9, 1, 22, bw=6, bh=8)


def rower_front(c, d, f, s, g):
    if d not in ('down', 'up'):
        return
    sx = g['hand_r'][0] + 2
    oar(c, sx, 7, sx - 1, 23, bw=5, bh=8)


make('wz-chr-rowing-student', '노 젓는 학생', 'boathouse',
     '소매를 걷은 셔츠에 조끼, 노를 든 학생', dict(
         top=7, hair='hair_blond', pants=PANTS_DARK, shoe=SHOE_BROWN,
         cloth=cloth('linen', 1, 2, 3, 4)),
     dict(back=rower_back, mid=rower_mid, front=rower_front))


# 11. 허니듀크 포장 작업자
def packer_mid(c, d, f, s, g):
    t0, hem = g['t0'], g['hem']
    R_ = K('red', 3); Rd = K('red', 2); L = K('linen', 3); L2 = K('linen', 2)
    if d == 'down':
        for y in range(t0 + 1, hem + 1):
            for x in range(8, 16):
                c.P(x, y, (R_ if (x // 2) % 2 == 0 else L))
            c.P(15, y, Rd if (15 // 2) % 2 == 0 else L2)
        c.HL(8, t0 + 1, 8, K('linen', 4)); c.HL(8, hem, 8, Rd)
        c.R(10, t0 + 4, 4, 3, K('red', 4)); c.HL(10, t0 + 4, 4, K('linen', 4))      # 주머니
    elif d == 'up':
        for y in range(t0 + 7, hem + 1):
            for x in range(8, 16):
                c.P(x, y, (R_ if (x // 2) % 2 == 0 else L))
        c.HL(8, hem, 8, Rd); c.HL(8, t0 + 7, 8, L2)
        c.P(11, t0 + 8, Rd); c.P(12, t0 + 8, Rd); c.P(10, t0 + 9, Rd); c.P(13, t0 + 9, Rd)
    else:
        for y in range(t0 + 1, hem + 1):
            for x in range(11, 16):
                c.P(x, y, (R_ if (x // 2) % 2 == 0 else L))
        c.HL(11, hem, 5, Rd); c.HL(11, t0 + 1, 5, K('linen', 4))
        c.R(12, t0 + 4, 3, 2, K('red', 4))


def packer_front(c, d, f, s, g):
    """머리에 붙는 천 두건: 머리 윤곽 안에서만 칠하고(부푼 돔 금지), 무늬는 1px 가로 줄 하나,
    앞이마에 머리카락 두 줄이 보이며, 옆·뒤에 묶은 매듭 꼬리."""
    top = g['top']
    R_ = K('red', 3); Rd = K('red', 2); Rk = K('red', 1); L = K('linen', 3); L2 = K('linen', 2)

    def base(x, r, edge_r):
        if r == edge_r:
            return Rk if x >= 15 else Rd           # 두건 아랫단 접힘
        if r == 2:
            return L2 if x >= 15 else L            # 1px 가로 줄무늬
        return Rd if x >= 15 else R_

    if d == 'down':
        def fn(x, r):
            if r <= 4:
                return base(x, r, 4)
            if 5 <= r <= 9 and (x <= 6 or x >= 17):   # 옆자락이 얼굴을 감싼다
                return Rk if (x >= 17 or r == 9) else Rd
            return None
        rows_in_head(c, g, 0, 9, fn)
    elif d == 'right':
        def fn(x, r):
            if r <= 4:
                return base(x, r, 4)
            if 5 <= r <= 9 and x <= 9:
                return Rk if r == 9 else (R_ if x >= 8 else Rd)
            return None
        rows_in_head(c, g, 0, 9, fn)
        # 뒤통수 매듭 + 꼬리 2~3px
        c.P(4, top + 6, Rd); c.P(4, top + 7, R_)
        c.P(3, top + 8, R_); c.P(3, top + 9, Rd); c.P(2, top + 10, Rd)
        c.P(4, top + 9, Rd); c.P(4, top + 10, Rk)
    else:  # up: 뒤에서 본 두건 + 목덜미 매듭
        def fn(x, r):
            if r <= 8:
                return base(x, r, 8)
            return None
        rows_in_head(c, g, 0, 8, fn)
        c.R(11, top + 9, 2, 2, R_); c.P(12, top + 10, Rd)        # 매듭
        c.P(10, top + 11, Rd); c.P(10, top + 12, Rk)              # 꼬리 왼
        c.P(13, top + 11, Rd); c.P(13, top + 12, Rk); c.P(14, top + 13, Rk)   # 꼬리 오른


make('wz-chr-honeydukes-packer', '허니듀크 포장 작업자', 'honeydukes',
     '분홍 줄무늬 앞치마와 매듭 두건의 사탕 가게 포장 작업자', dict(
         top=4, hair='hair_red', pants=PANTS_BROWN, shoe=SHOE_BROWN, hem=28, flare=1,
         cloth=cloth('choc', 1, 2, 3, 4)),
     dict(mid=packer_mid, front=packer_front))


# 12. 마법 상점 직원
def clerk_mid(c, d, f, s, g):
    t0, hem = g['t0'], g['hem']
    V = [K('violet', i) for i in range(5)]
    L = [K('linen', i) for i in range(5)]
    B = [K('brass', i) for i in range(6)]
    if d == 'down':
        c.R(8, t0 + 1, 3, hem - t0, V[2]); c.R(13, t0 + 1, 3, hem - t0, V[2])
        c.VL(8, t0 + 1, hem - t0, V[3]); c.VL(15, t0 + 1, hem - t0, V[1]); c.VL(10, t0 + 1, hem - t0, V[1]); c.VL(13, t0 + 1, hem - t0, V[3])
        c.HL(8, hem, 8, V[1])
        c.R(11, t0, 2, 4, L[3]); c.P(11, t0, L[4]); c.P(12, t0 + 3, L[2])
        for y in (t0 + 4, t0 + 6, t0 + 8):
            c.P(13, y, B[4]) if y < hem else None
        # 소매 고정 밴드
        hl, hr = g['hand_l'], g['hand_r']
        c.HL(hl[0], hl[1] - 4, 2, B[3]); c.HL(hl[0], hl[1] - 5, 2, B[2])
        c.HL(hr[0] - 1, hr[1] - 4, 2, B[3]); c.HL(hr[0] - 1, hr[1] - 5, 2, B[2])
    elif d == 'up':
        c.R(8, t0 + 1, 8, hem - t0, V[2]); c.VL(15, t0 + 1, hem - t0, V[1]); c.VL(8, t0 + 1, hem - t0, V[3]); c.HL(8, hem, 8, V[1])
        c.HL(8, t0 + 7, 8, V[1]); c.P(11, t0 + 8, B[3]); c.P(12, t0 + 8, B[3])
        hl, hr = g['hand_l'], g['hand_r']
        c.HL(hl[0], hl[1] - 4, 2, B[3]); c.HL(hr[0] - 1, hr[1] - 4, 2, B[3])
    else:
        c.R(11, t0 + 1, 5, hem - t0, V[2]); c.VL(11, t0 + 1, hem - t0, V[3]); c.VL(15, t0 + 1, hem - t0, V[1]); c.HL(11, hem, 5, V[1])
        c.P(15, t0 + 3, B[4]); c.P(15, t0 + 5, B[4]); c.P(15, t0 + 7, B[4])
        hx, hy = g['hand']
        c.HL(hx - 2, hy - 3, 3, B[3]); c.HL(hx - 2, hy - 4, 3, B[2])
        c.R(11, t0, 3, 2, L[3])


def clerk_front(c, d, f, s, g):
    top = g['top']
    w5 = K('wood', 5)
    if d == 'down':
        c.line(17, top + 9, 21, top + 3, w5); c.P(21, top + 3, K('brass', 5)); c.P(17, top + 9, K('wood', 3))
    elif d == 'right':
        c.line(10, top + 9, 7, top + 3, w5); c.P(7, top + 3, K('brass', 5))
    else:
        c.line(7, top + 8, 4, top + 2, w5); c.P(4, top + 2, K('brass', 5))


make('wz-chr-wand-clerk', '마법 상점 직원', 'wandshop',
     '보라 조끼에 놋 소매 고정 밴드를 찬 지팡이 가게 직원(귀 뒤에 지팡이)', dict(
         top=4, hair='hair_dark', pants=PANTS_DARK, shoe=SHOE_DARK, hem=27, flare=0,
         cloth=cloth('linen', 1, 2, 3, 4)),
     dict(mid=clerk_mid, front=clerk_front))

if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
