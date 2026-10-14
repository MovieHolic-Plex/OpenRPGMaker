"""실내 공용 도우미 — 벽 묶음(북벽 1×4 · 모서리 · 서/동 윗면 띠 · 남벽 갓) 그리기와 가구 상자 도우미.

북벽 1×4(16×64): 0~9 벽 윗면(두께, 밝은 갓) · 10 앞 모서리 빛 · 11~14 처마 몰딩 · 15~57 벽면 · 58~63 걸레받이.
벽면 종류(face): 'damask' 붉은 다마스크 벽지 + 오크 징두리 판벽 · 'stone' 축축한 마름돌 · 'plaster' 미술관 회녹색 회벽 + 금 그림 레일.
윗면 재료(cap): 묶음마다 하나 — 서/동 띠·남벽 갓·모서리가 같은 재료라 고리가 한 덩이로 읽힌다.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from gmlib import Cv, K   # noqa: E402
from gmdraw import hsh, masonry, arch_profile, block3   # noqa: E402

CAP = dict(damask=('wood', 3), stone=('stone', 5), plaster=('bone', 3))


def cap_top(c, x0, w, y0, h, face, west=None):
    """벽 윗면(두께): 깨끗한 밝은 띠 + 판 이음. west=True/False 면 세로 띠의 바깥·안쪽 가장자리."""
    m, t = CAP[face]
    c.R(x0, y0, w, h, K(m, t))
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if y % 16 in (7, 15) and west is not None: c.P(x, y, K(m, t - 1))
            elif west is None and x % 16 in (7, 15) and y < y0 + h - 1: c.P(x, y, K(m, t - 1))
    if west is True:
        c.VL(x0, y0, h, K(m, 1)); c.VL(x0 + 1, y0, h, K(m, t + 1)); c.VL(x0 + w - 2, y0, h, K(m, t - 1)); c.VL(x0 + w - 1, y0, h, K(m, 1))
    elif west is False:
        c.VL(x0, y0, h, K(m, 1)); c.VL(x0 + 1, y0, h, K(m, t - 1)); c.VL(x0 + w - 2, y0, h, K(m, t + 1)); c.VL(x0 + w - 1, y0, h, K(m, 1))


def wall_face(c, x0, w, face, y0=15, y1=58, seed=0):
    """북벽 벽면(16 주기)."""
    if face == 'damask':
        for y in range(y0, 40):
            for x in range(x0, x0 + w):
                lx, ly = x % 16, (y - y0) % 12
                d = abs(lx - 8) + abs(ly - 6)
                t = 2
                if d in (5, 6): t = 3                           # 마름모 무늬
                if d <= 1: t = 4
                if (lx, ly) in ((0, 0), (8, 6)): t = 4
                c.P(x, y, K('velvet', t))
            if y == y0 or y == y0 + 1: c.HL(x0, y, w, K('velvet', 1))      # 처마 밑 그늘
        c.HL(x0, 40, w, K('wood', 5)); c.HL(x0, 41, w, K('wood', 3))        # 징두리 띠(위 빛)
        for y in range(42, y1):
            for x in range(x0, x0 + w):
                lx = x % 16
                t = 2
                if lx in (2, 13) or y in (44, 55): t = 3                    # 판 테두리
                if lx == 1 or y == 43: t = 1
                if 3 <= lx <= 12 and 45 <= y <= 54: t = 3 if lx < 12 else 2
                if lx == 3 and 45 <= y <= 54: t = 4
                c.P(x, y, K('wood', t))
    elif face == 'stone':
        for xs in range(x0, x0 + w, 16):                                    # 16 주기 — 칸마다 따로(넓은 문 조각도 끝까지 칠한다)
            masonry(c, xs, y0, min(16, x0 + w - xs), y1 - y0, 'stone', 1, seed=seed, course=6, mortar_t=0, blen=(6, 12), period=16)
        for x in range(x0, x0 + w):                                         # 아래쪽 습기 얼룩
            for y in range(46, y1):
                if hsh(x % 16, y, 77 + seed) < (y - 46) / 30: c.P(x, y, K('stone', 0))
            if hsh(x % 16, 3, 79) < .25: c.P(x, y0 + 2, K('teal', 2))
        c.HL(x0, y0, w, K('stone', 0)); c.HL(x0, y0 + 1, w, K('stone', 0))
    else:  # plaster
        for y in range(y0, y1):
            for x in range(x0, x0 + w):
                t = 2 if hsh(x % 16, y, 81 + seed) > .1 else 1                # 짙은 박물관 녹색(그림·금 레일이 떠 보이게)
                c.P(x, y, K('teal', t))
        c.HL(x0, y0, w, K('teal', 0)); c.HL(x0, y0 + 1, w, K('teal', 1))
        c.HL(x0, 19, w, K('gold', 4)); c.HL(x0, 20, w, K('gold', 2))         # 그림 레일
        c.HL(x0, 44, w, K('bone', 5)); c.HL(x0, 45, w, K('bone', 3))        # 징두리 몰딩
        for y in range(46, y1):
            for x in range(x0, x0 + w): c.P(x, y, K('teal', 1 if x % 16 not in (0, 8) else 0))


def skirting(c, x0, w, face, y0=58):
    m = 'wood' if face == 'damask' else 'stone' if face == 'stone' else 'bone'
    t = 2 if face == 'damask' else 3
    c.R(x0, y0, w, 6, K(m, t)); c.HL(x0, y0, w, K(m, t + 2)); c.HL(x0, y0 + 4, w, K(m, t - 1)); c.HL(x0, y0 + 5, w, K(m, 1))


def cornice(c, x0, w, face, y0=10):
    m, t = CAP[face]
    c.HL(x0, y0, w, K(m, t + 2))
    c.R(x0, y0 + 1, w, 4, K(m, t - 1)); c.HL(x0, y0 + 1, w, K(m, t)); c.HL(x0, y0 + 4, w, K(m, 1))
    if face == 'damask':
        for x in range(x0, x0 + w):
            if x % 4 == 1: c.P(x, y0 + 2, K('gold', 3))


def north_wall(c, face, x0=0, w=16, seed=0):
    cap_top(c, x0, w, 0, 10, face)
    m, t = CAP[face]; c.HL(x0, 0, w, K(m, 1))
    cornice(c, x0, w, face)
    wall_face(c, x0, w, face, seed=seed)
    skirting(c, x0, w, face)


def lancet_window(c, cx, w, y_top, y_bot, lit=False, flash=False):
    """벽면에 박힌 첨두 창(달빛 유리 · 번개 번쩍임). 깊은 돌 창틀 + 창턱(윗면 보임)."""
    prof, _ = arch_profile(w)
    x0 = cx - w // 2
    for i in range(w):
        top = y_top + prof[i]
        for y in range(top - 2, y_bot + 1): c.P(x0 + i, y, K('stone', 4 if i < w // 2 else 3))
    for i in range(1, w - 1):
        top = y_top + prof[i] + 1
        for y in range(top, y_bot - 1):
            f = (y - top) / max(1, y_bot - top)
            if flash: col = K('glass', 6 if f < .5 else 5)
            else: col = K('glass', 3 if f < .3 else 2 if f < .75 else 1)
            if i == w // 2 or (y - top) % 6 == 5: col = K('ink', 2)
            c.P(x0 + i, y, col)
    if not flash:
        c.P(x0 + 2, y_top + prof[2] + 4, K('glass', 5)); c.P(x0 + 2, y_top + prof[2] + 5, K('glass', 4))
    c.R(x0 - 2, y_bot - 1, w + 4, 3, K('stone', 5)); c.HL(x0 - 2, y_bot - 1, w + 4, K('stone', 6)); c.HL(x0 - 2, y_bot + 2, w + 4, K('stone', 2))


def side_strip(c, face, west):
    cap_top(c, 0, 16, 0, 16, face, west=west)


def south_cap(c, face):
    m, t = CAP[face]
    c.R(0, 0, 16, 16, K(m, t))
    for x in range(16):
        if x % 16 in (7, 15): c.VL(x, 0, 12, K(m, t - 1))
    c.HL(0, 0, 16, K(m, t + 2)); c.HL(0, 12, 16, K(m, t - 1)); c.HL(0, 13, 16, K(m, 2)); c.R(0, 14, 16, 2, K(m, 1))


def doorway(c, x0, w, face, y_top=26, open_=True):
    """북벽 문: 깊은 문틀(밝은 안쪽 측면) + 열린 어둠(통과) 또는 닫힌 판자문."""
    prof, _ = arch_profile(w)
    fm = 'wood' if face == 'damask' else 'stone' if face == 'stone' else 'bone'
    for i in range(w):
        top = y_top + prof[i]
        for y in range(top - 3, 64): c.P(x0 + i, y, K(fm, 5 if i < 2 else 2 if i >= w - 2 else 4))
    for i in range(2, w - 2):
        top = y_top + prof[i] + 1
        for y in range(top, 64):
            if open_:
                c.P(x0 + i, y, K('ink', 1 if y < 48 else 2))
            else:
                c.P(x0 + i, y, K('wood', 3 if (i - 2) % 4 else 2))
    if open_:
        for y in range(48, 64):                                         # 문 너머 바닥 띠(빛 새는 바닥)
            for i in range(2, w - 2): c.P(x0 + i, y, K('wood', 2) if face != 'stone' else K('stone', 2))
        c.HL(x0 + 2, 48, w - 4, K('ink', 1))
    else:
        c.P(x0 + w - 5, 46, K('gold', 5))


def box(c, x, y, w, top, front, m, tb=6, fb=3):
    """가구 몸통(깨끗한 면: 윗면 tb · 앞면 fb · 오른쪽 어둠 · 뒷변 어두운 선)."""
    block3(c, x, y, w, top, front, m=m, tb=tb, fb=fb)
    c.HL(x, y - 1, w, K(m, 1))
