"""pirate_isles 배 — 노 젓는 배·통나무 쪽배·고깃배·해적 범선. 모두 물 위에 둔다(물선 거품·물빛 그늘을 그림에 포함).
위에서 비스듬히 본다: 배 안(바닥·가로대·갑판)이 윗면으로 보이고 남쪽 뱃전이 앞면이다. 뱃머리는 오른쪽.
"""
import math
from pi_core import *


def hull_shape(x, L, bow=0.32, stern=0.12):
    """0…L 위치의 반폭 비율(0…1): 오른쪽 뱃머리로 뾰족, 왼쪽 고물은 살짝 둥글게."""
    u = x / L
    if u > 1 - bow: return math.sqrt(max(0.0, (1 - u) / bow))
    if u < stern: return 0.75 + 0.25 * math.sqrt(max(0.0, u / stern))
    return 1.0


def small_boat(c, x0, y0, L, half, wall=5, mat='wood', inner='wood', thwarts=(), s=0, water=False):
    """작은 배: 윗면(배 안) 타원형 + 남쪽 뱃전 앞면. y0 = 배 가운데 줄."""
    if water:
        for x in range(x0 - 3, x0 + L + 4):
            f = hull_shape(min(max(x - x0, 0), L), L)
            hw = half * f + 2
            for y in range(int(y0 + hw * 0.55 - 1), int(y0 + hw * 0.55 + wall + 3)):
                c.P(x, y, K('shallow', -1 if y > y0 + hw * .55 + wall else 0))
    for x in range(x0, x0 + L + 1):
        f = hull_shape(x - x0, L)
        hw = half * f
        top = y0 - hw * 0.55; bot = y0 + hw * 0.55
        for y in range(int(round(top)), int(round(bot)) + 1):
            edge = (y <= top + 1) or (y >= bot - 1)
            if edge: c.P(x, y, K(mat, 2 if y <= top + 1 else 1))                  # 뱃전 윗면(테)
            else:
                rr = (y - top) / max(1, bot - top)
                c.P(x, y, K(inner, -2 if rr < .35 else -1 if (x + y) % 4 else -2))       # 배 안(뒤쪽 그늘)
        for y in range(int(round(bot)) + 1, int(round(bot)) + wall + 1 - int((1 - f) * wall * .6)):
            r = y - bot
            c.P(x, y, K(mat, (0 if r < 2 else -1 if r < wall - 1 else -2) - (1 if r % 3 == 2 else 0)))
    for tx in thwarts:
        f = hull_shape(tx, L); hw = half * f
        c.R(x0 + tx, int(round(y0 - hw * .55)) + 1, 3, int(hw * 1.1) - 1, K(mat, 1)); c.VL(x0 + tx + 2, int(round(y0 - hw * .55)) + 1, int(hw * 1.1) - 1, K(mat, -1))


def waterline(c, x0, x1, y=None, s=0):
    """선체 밑 가장자리(열마다 가장 아래 불투명 화소) 바로 밑에 물거품 — 배가 물에 닿은 선. 양 끝은 한 칸 밖으로 번진다."""
    bots = {}
    for x in range(max(0, x0), min(c.w, x1)):
        ys = [yy for yy in range(c.h) if c.has(x, yy)]
        if ys: bots[x] = max(ys)
    for x, yb in bots.items():
        if yb + 1 < c.h and hsh(x, 0, s) % 4: c.P(x, yb + 1, K('foam', 1 if hsh(x, 1, s) % 2 else 0))
        if yb + 2 < c.h and hsh(x, 2, s) % 3 == 0: c.P(x, yb + 2, K('foam', -1))
    if bots:
        xa, xb = min(bots), max(bots)
        for (xx, yy) in ((xa - 1, bots[xa]), (xa - 2, bots[xa] + 1), (xb + 1, bots[xb]), (xb + 2, bots[xb] + 1)):
            if 0 <= xx < c.w and 0 <= yy < c.h: c.P(xx, yy, K('foam', 0))


@piece('rowboat', 'small wooden rowboat with two benches and oars, floating', 2, 1, 'other', group='boats', solid=[(0, 0), (1, 0)], tags=['배', '노 젓는 배', '물'],
       desc='노 젓는 작은 배(가로대 둘·노). 부두 옆 물 위.')
def _rowboat(c):
    small_boat(c, 3, 6, 26, 9, wall=4, thwarts=(8, 16), s=1)
    c.line(9, 3, 4, 0, K('wood', 1)); c.line(19, 3, 24, 0, K('wood', 0))                   # 노
    c.R(2, 0, 3, 1, K('wood', 2)); c.R(24, 0, 3, 1, K('wood', 1))
    c.outline()
    waterline(c, 0, 32, s=1)


@piece('canoe', 'outrigger canoe with a side float, floating', 2, 1, 'other', group='boats', solid=[(0, 0), (1, 0)], tags=['배', '쪽배', '물'],
       desc='통나무 쪽배(아우트리거). 물 위·해변 물가.')
def _canoe(c):
    small_boat(c, 2, 9, 27, 6, wall=3, mat='dark', inner='wood', s=2)
    c.R(6, 1, 20, 3, K('dark', 1)); c.HL(6, 1, 20, K('dark', 3)); c.HL(6, 3, 20, K('dark', -1))   # 뜬 통나무
    for x in (10, 20): c.VL(x, 3, 5, K('wood', 1)); c.VL(x + 1, 3, 5, K('wood', -1))
    c.line(15, 6, 21, 2, K('wood', 2))
    c.outline()
    waterline(c, 0, 32, s=2)


@piece('fishing-boat', 'small fishing boat with a short mast, furled sail and a pile of nets', 3, 2, 'structure', group='boats',
       solid=[(x, y) for x in range(3) for y in range(2)], tags=['배', '고깃배', '물'], desc='고깃배(짧은 돛대·말린 돛·그물 더미). 부두 옆 물 위.')
def _fishing(c):
    small_boat(c, 2, 20, 43, 16, wall=6, thwarts=(10,), s=3)
    # 갑판 앞쪽 판(덮개) + 그물 더미
    for y in range(15, 26): c.HL(30, y, 8 - abs(20 - y) // 2, K('wood', 1 if y < 20 else 0))
    for k in range(14):
        x = 14 + hsh(k, 1) % 10; y = 17 + hsh(k, 2) % 6
        c.P(x, y, K('teal', 1 if k % 2 else 0)); c.P(x + 1, y, K('teal', -1))
    # 돛대 + 활대 + 말린 돛
    c.R(25, 0, 2, 22, K('dark', 1)); c.VL(25, 0, 22, K('dark', 3))
    c.line(10, 14, 27, 3, K('dark', 0)); c.line(10, 15, 27, 4, K('dark', -1))
    for k in range(14):
        x = 12 + k; y = 13 - int(k * 0.62)
        c.R(x, y - 1, 1, 3, K('cloth', 1 if k % 3 else 0)); c.P(x, y - 2, K('cloth', 2))
    c.line(26, 1, 44, 20, K('thatch', -1))                                                 # 앞 밧줄
    c.outline()
    waterline(c, 0, 48, s=3)


def sail(c, x0, y0, w, h, belly=3, mat='cloth', torn=False, s=0):
    """사각 돛(앞으로 부푼): 위 활대에 매달려 아래로 넓어짐, 가운데 밝게·양옆 그늘, 솔기 세로줄."""
    for j in range(h):
        bulge = belly * math.sin(math.pi * j / max(1, h - 1))
        a = x0 - int(bulge * 0.5); b = x0 + w + int(bulge * 0.5)
        for i in range(a, b):
            u = (i - a) / max(1, b - a)
            t = (2 if u < .2 else 1 if u < .6 else 0 if u < .85 else -1) - (1 if j > h - 3 else 0) - (1 if j < 2 else 0)
            if (i - x0) % 6 == 0: t -= 1
            if torn and j > h - 4 and hsh(i, j, s) % 3 == 0: continue
            c.P(i, y0 + j, K(mat, t))


@piece('galleon', 'pirate galleon with dark hull, gun ports, raised stern castle, three masts with square sails and a black skull flag', 8, 6, 'structure', group='boats',
       solid=[(x, y) for x in range(8) for y in range(2, 6)], tags=['배', '해적선', '범선', '물'],
       desc='해적 범선(검은 선체·포문 줄·높은 고물 누각·돛대 셋·해골 깃발, 글자 없음). 깊은 물·부두 옆. 아래 네 줄 막힘, 위 두 줄(돛 끝)은 사람 위에 그려진다.')
def _galleon(c):
    L = 120; X0 = 4; YD = 58          # 갑판 앞 가장자리 y
    # 선체 앞면(남쪽 뱃전): 위로 휜 현호(sheer) — 고물·뱃머리가 높다
    def sheer(x): u = (x - X0) / L; return int(6 * (2 * u - 1) ** 2) + (8 if u < 0.2 else 0)
    def keel(x):
        u = (x - X0) / L
        return 86 - int(14 * max(0.0, (u - 0.72) / 0.28) ** 1.4) - int(6 * max(0.0, (0.08 - u) / 0.08))
    for x in range(X0, X0 + L):
        top = YD - sheer(x); bot = keel(x)
        for y in range(top, bot):
            r = y - top
            t = (1 if r < 2 else -1 if r < 10 else -2) - (1 if r % 5 == 4 else 0)
            mat = 'dark'
            if 7 <= r <= 8: mat, t = 'gold', (0 if r == 7 else -2)                  # 금 띠
            c.P(x, y, K(mat, t))
    # 포문 줄
    for k in range(7):
        px = X0 + 22 + k * 12; py = YD - sheer(px) + 11
        c.R(px, py, 6, 5, K('red', -2)); c.R(px + 1, py + 1, 4, 3, K('shadow', 0)); c.R(px + 2, py + 2, 3, 1, K('iron', 1))
        c.HL(px, py, 6, K('red', 0))
    # 갑판 윗면(사다리꼴로 뒤가 좁다): 뱃머리 쪽 뾰족
    for x in range(X0 + 2, X0 + L - 2):
        u = (x - X0) / L
        w = 18 * (1.0 if u < 0.75 else max(0.0, (1 - u) / 0.25) ** 0.8)
        front = YD - sheer(x)
        for y in range(int(front - w), front):
            row = front - y
            t = 1 if row % 3 else -1
            if y == int(front - w): t = -2
            if hsh(x // 9, y // 3, 5) % 6 == 0: t -= 1
            c.P(x, y, K('wood', t))
        c.P(x, front - 1, K('dark', 2)); c.P(x, front - 2, K('dark', 0))          # 난간
    # 고물 누각(왼쪽, 높은 상자: 윗면 + 앞면 창)
    box(c, X0 + 2, 18, 26, 12, 16, 'dark', tt=1, ft=0, topmat='wood', tex='planks', s=4)
    for wx in (X0 + 6, X0 + 14, X0 + 21):
        c.R(wx, 33, 4, 6, K('gold', -1)); c.R(wx + 1, 34, 2, 4, K('fire', 2))
    c.HL(X0 + 2, 29, 26, K('gold', 1))
    # 뱃머리 사장(앞 돛대 막대)
    c.line(X0 + L - 6, 40, X0 + L + 3, 30, K('dark', 2)); c.line(X0 + L - 6, 41, X0 + L + 3, 31, K('dark', 0))
    # 돛대 셋 + 돛
    for (mx, top, sw, sh) in ((X0 + 40, 2, 26, 30), (X0 + 72, 6, 24, 28), (X0 + 98, 14, 18, 22)):
        c.R(mx - 1, top, 3, YD - top - 8, K('dark', 0)); c.VL(mx - 1, top, YD - top - 8, K('dark', 2))
        c.R(mx - sw // 2 - 2, top + 3, sw + 4, 2, K('dark', 1))                                # 활대
        sail(c, mx - sw // 2, top + 5, sw, sh, belly=4, s=mx)
        c.R(mx - sw // 2 - 2, top + 5 + sh, sw + 4, 2, K('dark', 0))
        c.ellf(mx, top + 2, 4, 1.5, lambda x, y, nx, ny, d: K('dark', 2 if ny < 0 else 0))   # 망대(윗면)
    # 삼각 앞돛
    for j in range(16):
        c.HL(X0 + L - 18 + j // 2, 24 + j, 16 - j, K('cloth', 1 if j < 10 else 0))
    # 해골 깃발(큰 돛대 꼭대기)
    c.R(X0 + 41, 0, 12, 7, K('shadow', 1)); c.HL(X0 + 41, 0, 12, K('shadow', 2))
    sx = X0 + 45
    c.R(sx, 1, 4, 3, K('bone', 3)); c.P(sx + 1, 2, K('shadow', 0)); c.P(sx + 2, 2, K('shadow', 0)); c.HL(sx + 1, 4, 2, K('bone', 1))
    c.line(sx - 2, 3, sx - 1, 5, K('bone', 2)); c.line(sx + 5, 3, sx + 4, 5, K('bone', 2))
    # 밧줄(돛대 → 난간)
    for (mx, top) in ((X0 + 40, 2), (X0 + 72, 6)):
        c.line(mx, top + 4, mx - 22, YD - 4, K('thatch', -2)); c.line(mx, top + 4, mx + 20, YD - 6, K('thatch', -2))
    c.outline()
    waterline(c, 0, 128, s=4)
