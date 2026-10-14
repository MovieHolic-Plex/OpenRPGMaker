#!/usr/bin/env python3
"""snow_north 실내 — 통나무 오두막·긴 회관(롱홀)·선술집·사우나·얼음 동굴의 바닥·벽면·천장 + 가구.

실내 짜임(구성기 계약, steampunk_city 실내와 같다):
  방 바깥 = 천장(ceiling / 얼음 동굴은 ceiling-ice, 막힘). 방 맨 위 두 줄 = 벽면(<벽>-u 윗줄 + <벽>-d 아랫줄, 막힘). 그 아래가 바닥.
  키 큰 가구(tall_furniture·벽난로·이층 침대·술통 받침)는 등을 벽면 아랫줄에 대고 바닥 첫 줄부터 선다 —
  그림 윗부분이 벽면 아랫줄 위로 올라가도 된다(왼쪽 위 칸 = 벽면 아랫줄 칸).
  벽걸이(wall_mounted)는 벽면 줄 위에 투명 바탕으로 얹는다. 위아래 방 사이 통로 = 벽면 두 줄 자리에 wall-door-u/-d.
모든 가구는 3/4 탑뷰: 밝은 윗면(뒤 가장자리 어두운 선, 앞 모서리 반사 1줄) + 남쪽 앞면(어둡게) + 바닥 먹 접지 선. 빛은 왼쪽 위.
오두막·회관은 따뜻한 나무 + 불빛, 얼음 동굴은 차가운 푸른빛.

  python3 interior.py      # tiledata/snow-north/interior/_gate/*.png + preview.png + scene-*.png
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from px import C, rnd, h32, tex_brick, box3, cyl_v, disc, NT, MI
from kit import Reg, contact, OUT

R = Reg('interior')
ANIM = []      # (anim id, 이름, [프레임 id…], fps)
DROPPED = {    # id -> 사유(3/4 관문을 끝내 못 넘어 뺀 조각)
    'barrel-in': '세운 나무 술통 1×1 — 뚜껑 타원을 네 가지로 다시 그렸으나(6~9행) 판정자가 매번 「정면 입면도·윗면 0행」. 술통은 keg-rack(통과) 을 쓴다.',
}


def anim(id_, name, n, w, h, kind, tags=(), rules='', fps=4):
    def deco(fn):
        ids = []
        for f in range(n):
            fid = id_ if f == 0 else '%s-f%d' % (id_, f)
            R.add(fid, name + ('' if f == 0 else ' (프레임 %d)' % (f + 1)), w, h, kind, tags=tags, rules=rules)(lambda c, f=f: fn(c, f))
            ids.append(fid)
        ANIM.append((id_ + '-anim', name, ids, fps))
        return fn
    return deco


def cl(t, lo, hi): return max(lo, min(hi, t))


# ═══════════════════════ 바닥 ═══════════════════════
def plank_px(lx, ly, s=3, base=3):
    """가로 통나무 판자(4px 폭): 판마다 결 단이 다르고, 아래 1px 이음 그늘, 줄마다 맞댄 이음 하나, 결 무늬."""
    row = ly // 4; yy = ly % 4
    tone = base + (1 if h32(row, 1, s) % 4 == 0 else 0)
    if yy == 3: return ('log', base - 1) if lx % 5 else ('log', base - 2)
    if row % 4 == 1 and lx == (h32(row, 0, s) % 12 + 2): return ('log', base - 2)
    g = h32(lx // 3, row * 4 + yy, s + 2) % 9
    if g == 0: tone -= 1
    elif g == 1 and yy == 0: tone += 1
    if yy == 0 and g in (2, 3): tone += 1
    if yy == 2: tone -= (1 if g in (4, 5) else 0)
    return ('log', cl(tone, 1, 5))


@R.add('floor-plank', '통나무 판자 바닥(따뜻한 갈색)', 1, 1, 'terrain', tags=['실내', '바닥', '판자', '오두막'], rules='오두막·선술집·회관 바닥. 넓게 칠한다.')
def _(c): c.F(0, 0, 16, 16, lambda wx, wy, i, j: plank_px(wx % 16, wy % 16))


@R.add('floor-stone', '차가운 판석 바닥', 1, 1, 'terrain', tags=['실내', '바닥', '돌', '회관'], rules='회관 화덕 둘레·창고·지하·사우나 앞방 바닥.')
def _(c):
    rows = [[0, 9], [5, 12]]
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        b = rows[(ly // 8) % 2]; yy = ly % 8
        if yy == 7: return ('stone', 1)
        if lx in b: return ('stone', 1)
        if lx - 1 in b or yy == 0: t = 4
        else: t = 3
        if rnd(lx // 3, ly // 3, 9) < 0.12: t = 2
        if rnd(lx, ly, 13) < 0.05: t = 4
        if yy == 6 and lx % 5 == 2: t = 2
        return ('stone', t)
    c.F(0, 0, 16, 16, f)


@R.add('floor-ice', '얼음 동굴 바닥(잔잔, 잔금 몇 줄)', 1, 1, 'terrain', tags=['실내', '바닥', '얼음', '동굴'], rules='얼음 동굴 바닥. 넓게 칠한다.')
def _(c):
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        t = 4
        if rnd(lx // 3, ly // 2, 47) < 0.18: t = 3
        k = (lx + ly * 2) % 16
        if k in (0, 1) and rnd(lx // 2, ly // 2, 45) < 0.6: t = 5
        if rnd(lx, ly, 43) < 0.02: return ('snow', 5)
        return ('ice', t)
    c.F(0, 0, 16, 16, f)
    for (a, b) in (((2, 10), (5, 12)), ((5, 12), (6, 14)), ((5, 12), (8, 12))):
        c.line(a[0], a[1], b[0], b[1], 'ice', 2)
    for (x, y) in ((3, 11), (6, 13), (8, 13)): c.P(x, y, 'ice', 6)


@R.add('floor-sauna', '사우나 마루(옅은 나무 발판, 틈)', 1, 1, 'terrain', tags=['실내', '바닥', '사우나'], rules='사우나 방 바닥.')
def _(c):
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        yy = ly % 4
        if yy == 3: return ('log', 1) if lx % 8 not in (1, 2) else ('log', 3)      # 틈(아래 받침목이 비친다)
        t = 5 if yy == 0 else 4
        if yy == 2 and (lx + ly) % 5 == 0: t = 3
        if lx == (ly // 4 * 5 + 3) % 16 and yy != 0: t = 3                        # 결
        return ('log', t + (1 if yy == 0 and lx % 7 == 1 else 0))
    c.F(0, 0, 16, 16, f)


# ═══════════════════════ 천장 ═══════════════════════
@R.add('ceiling', '천장(어두운 통나무 벽 윗면 덩어리 + 들보 머리)', 1, 1, 'terrain', tags=['실내', '천장', '벽'], rules='오두막·회관 방 바깥 칸 전부. 막힘.')
def _(c):
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        yy = ly % 8
        if yy == 7: return ('ink', 0)
        t = 1
        if yy == 1 or yy == 2: t = 2 if h32(lx // 5, ly // 8, 5) % 3 else 1
        if yy == 6: t = 0
        return ('log', t)
    c.F(0, 0, 16, 16, f)
    # 들보 머리(나이테 단면, 한 칸에 하나)
    c.ell(11, 11.5, 2.6, 2.1, lambda X, Y, dx, dy, d: ('log', 3 if dx + dy < -0.3 else 2) if d > 0.45 else ('log', 1 if d > 0.12 else 2))


@R.add('ceiling-ice', '얼음 동굴 천장(검푸른 바위·얼음 덩어리)', 1, 1, 'terrain', tags=['실내', '천장', '얼음', '동굴'], rules='얼음 동굴 방 바깥 칸 전부. 막힘.')
def _(c):
    def f(wx, wy, i, j):
        lx, ly = wx % 16, wy % 16
        r = rnd(lx // 3, ly // 3, 61)
        if (lx * 2 + ly) % 13 == 0 and ly % 5: return ('ice', 1)
        if r < 0.25: return ('stone', 1)
        if r > 0.85: return ('ice', 0)
        return ('ink', 2)
    c.F(0, 0, 16, 16, f)


# ═══════════════════════ 벽면 ═══════════════════════
def log_rows(c, y0, y1, woff, base=4, s=5):
    """실내 가로 통나무 벽(4px 한 줄: 윗 반사 · 몸 · 그늘 · 틈 메움)."""
    for y in range(y0, y1):
        wy = y + woff; row = wy // 4; yy = wy % 4
        dv = (h32(row, s, 3) % 3) - 1
        for x in range(16):
            if yy == 3:
                c.P(x, y, *(('straw', 1) if h32(x // 3, row, s + 7) % 5 == 0 else ('log', 1))); continue
            t = base + dv + (1 if yy == 0 else -1 if yy == 2 else 0)
            if yy == 1 and h32(x // 4 + row * 3, row, s + 9) % 5 == 0: t -= 1
            if yy == 1 and x == h32(row, s, 11) % 13 + 1: t = 2                     # 옹이
            c.P(x, y, 'log', cl(t, 1, 6))


def wall_top_shadow(c):
    c.HL(0, 0, 16, 'ink', 1)
    for x in range(16): c.shift(x, 1, -2); c.shift(x, 2, -1)


def log_skirting(c):
    c.HL(0, 10, 16, 'log', 1)
    c.HL(0, 11, 16, 'log', 5); c.R(0, 12, 16, 2, 'log', 3); c.HL(0, 14, 16, 'log', 2)
    for x in (4, 12): c.P(x, 12, 'iron', 4); c.P(x + 1, 13, 'iron', 1)
    c.HL(0, 15, 16, 'ink', 1)


def wall_log(c, row):
    if row == 'u':
        log_rows(c, 0, 16, 0); wall_top_shadow(c)
    else:
        log_rows(c, 0, 10, 16); log_skirting(c)


@R.add('wall-log-u', '통나무 벽면(윗줄)', 1, 1, 'terrain', tags=['실내', '벽', '통나무', '오두막'], rules='오두막 방 맨 윗줄. 바로 아래 줄은 wall-log-d.')
def _(c): wall_log(c, 'u')


@R.add('wall-log-d', '통나무 벽면(아랫줄, 걸레받이 통나무)', 1, 1, 'terrain', tags=['실내', '벽', '통나무', '오두막'], rules='오두막 방 둘째 줄. 바로 아래부터 바닥.')
def _(c): wall_log(c, 'd')


def staves(c, y0, y1):
    """역청 바른 세로 널(롱홀): 4px 널, 왼쪽 반사 · 오른쪽 틈."""
    for y in range(y0, y1):
        for x in range(16):
            k = x % 4
            t = 3 if k == 0 else 2 if k in (1, 2) else 0
            if k in (1, 2) and h32(x // 4, y // 3, 71) % 6 == 0: t = 1
            if k in (1, 2) and h32(x // 4, y, 73) % 11 == 0: t = 3
            c.P(x, y, 'log', t)


def wall_plank(c, row):
    if row == 'u':
        staves(c, 0, 16)
        c.HL(0, 9, 16, 'log', 4); c.HL(0, 10, 16, 'log', 3); c.HL(0, 11, 16, 'log', 1)    # 가로 띠장
        for x in (1, 5, 9, 13): c.P(x, 10, 'iron', 5)
        wall_top_shadow(c)
    else:
        staves(c, 0, 11)
        c.F(0, 11, 16, 4, lambda wx, wy, i, j: tex_brick(i, j, base=3, mat='stone', mortar=('stone', 1), course=4, blen=8, s=5))
        c.HL(0, 11, 16, 'stone', 5)
        c.HL(0, 15, 16, 'ink', 1)


@R.add('wall-plank-u', '역청 세로 널 벽면(윗줄, 띠장)', 1, 1, 'terrain', tags=['실내', '벽', '널', '회관'], rules='긴 회관·선술집 방 맨 윗줄. 아래 줄은 wall-plank-d.')
def _(c): wall_plank(c, 'u')


@R.add('wall-plank-d', '역청 세로 널 벽면(아랫줄, 돌 굽)', 1, 1, 'terrain', tags=['실내', '벽', '널', '회관'], rules='긴 회관·선술집 방 둘째 줄. 바로 아래부터 바닥.')
def _(c): wall_plank(c, 'd')


_IP = []
for _gy in range(5):
    for _gx in range(3):
        _IP.append(((_gx * 16 / 3 + 1 + h32(_gx, _gy, 51) % 4) % 16, (_gy * 32 / 5 + 1 + h32(_gx, _gy, 53) % 4) % 32, _gx, _gy))


def ice_block_px(wx, wy, s=7):
    """얼음 벽: 불규칙한 얼음 덩이·바위 덩이(16×32 주기 보로노이), 경계 = 짙은 바위 틈."""
    x, y = wx % 16, wy % 32
    ds = []
    for (px_, py, gx, gy) in _IP:
        dx = (x + 0.5 - px_ + 8) % 16 - 8; dy = (y + 0.5 - py + 16) % 32 - 16
        ds.append((dx * dx + (dy * 1.3) ** 2, dx, dy, gx, gy))
    ds.sort()
    d0, dx, dy, gx, gy = ds[0]
    if ds[1][0] ** 0.5 - d0 ** 0.5 < 1.0: return ('stone', 1)
    rock = h32(gx, gy, s) % 5 == 0
    lit = dx + dy
    if rock:
        t = 3 if lit < -1 else 2
        if lit < -4: t = 4
        return ('stone', t)
    t = 4 if lit < -1.5 else 3 if lit < 2.5 else 2
    if lit < -5: t = 5
    if abs(dx - dy + 1) < 0.7 and lit < 0: t = 6
    return ('ice', t)


def wall_ice(c, row):
    if row == 'u':
        c.F(0, 0, 16, 16, lambda wx, wy, i, j: ice_block_px(wx % 16, wy % 16))
        c.HL(0, 0, 16, 'ink', 1)
        for x in range(16): c.shift(x, 1, -2); c.shift(x, 2, -1)
    else:
        c.F(0, 0, 16, 11, lambda wx, wy, i, j: ice_block_px(wx % 16, wy % 16 + 16))
        c.HL(0, 11, 16, 'ice', 6); c.HL(0, 12, 16, 'ice', 2)
        c.R(0, 13, 16, 3, 'stone', 1); c.HL(0, 15, 16, 'ink', 1)
        for x, ln in ((1, 3), (3, 1), (5, 2), (8, 3), (10, 1), (12, 2), (14, 3)):
            for k in range(ln): c.P(x, 12 + k, 'ice', 6 if k == 0 else 5 if k < ln - 1 else 4)


@R.add('wall-ice-u', '얼음 동굴 벽면(윗줄, 얼음 벽돌·바위)', 1, 1, 'terrain', tags=['실내', '벽', '얼음', '동굴'], rules='얼음 동굴 방 맨 윗줄. 아래 줄은 wall-ice-d.')
def _(c): wall_ice(c, 'u')


@R.add('wall-ice-d', '얼음 동굴 벽면(아랫줄, 밑동 고드름)', 1, 1, 'terrain', tags=['실내', '벽', '얼음', '동굴'], rules='얼음 동굴 방 둘째 줄. 바로 아래부터 바닥.')
def _(c): wall_ice(c, 'd')


def window_glass(c, x0, x1, y0, y1, part):
    """밤 창 유리: 위는 남색 하늘·별, 아래는 푸른 밤 눈밭·가문비 그림자, 창틀 밖 눈 턱."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            if part == 'u':
                t = 1 if y < y0 + 4 else 2
                c.P(x, y, 'wool', t)
            else:
                c.P(x, y, 'snow', 1 if y < y0 + 2 else 0)
    if part == 'u':
        c.P(x0 + 1, y0 + 1, 'snow', 6); c.P(x1 - 3, y0 + 3, 'snow', 5)
        for (px_, h) in ((x0, 3), (x0 + 2, 5), (x0 + 5, 2), (x1 - 2, 4)):
            for k in range(h): c.P(px_, y1 - 1 - k, 'pine', 1 if k else 0); c.P(px_ + 1, y1 - 1 - k + (1 if k < h - 1 else 0), 'pine', 0)
        c.P(x0, y0, 'ice', 5); c.P(x1 - 1, y0, 'ice', 5); c.P(x0 + 1, y0, 'ice', 4)
    else:
        c.HL(x0, y1 - 2, x1 - x0, 'snow', 4); c.HL(x0, y1 - 1, x1 - x0, 'snow', 3)   # 바깥 창턱 눈
        c.P(x0, y1 - 3, 'snow', 4); c.P(x1 - 1, y1 - 3, 'snow', 3)


@R.add('wall-window-u', '통나무 벽 작은 창(윗줄, 밤 하늘)', 1, 1, 'terrain', tags=['실내', '벽', '창', '오두막'], rules='통나무 벽면 윗줄 사이사이. 아래 줄은 wall-window-d.')
def _(c):
    wall_log(c, 'u')
    c.R(2, 4, 12, 2, 'log', 2); c.HL(2, 4, 12, 'log', 5)                        # 인방
    c.R(2, 6, 12, 10, 'log', 1); c.VL(2, 6, 10, 'log', 4); c.VL(13, 6, 10, 'log', 2)
    window_glass(c, 4, 12, 7, 16, 'u')
    c.VL(3, 6, 10, 'log', 3); c.VL(12, 6, 10, 'log', 1)
    c.VL(7, 7, 9, 'log', 2); c.VL(8, 7, 9, 'log', 1)                            # 가운데 살


@R.add('wall-window-d', '통나무 벽 작은 창(아랫줄, 눈 쌓인 창턱)', 1, 1, 'terrain', tags=['실내', '벽', '창', '오두막'], rules='wall-window-u 바로 아래.')
def _(c):
    wall_log(c, 'd')
    c.R(2, 0, 12, 7, 'log', 1); c.VL(2, 0, 7, 'log', 4); c.VL(13, 0, 7, 'log', 2)
    window_glass(c, 4, 12, 0, 6, 'd')
    c.VL(3, 0, 6, 'log', 3); c.VL(12, 0, 6, 'log', 1)
    c.VL(7, 0, 6, 'log', 2); c.VL(8, 0, 6, 'log', 1); c.HL(4, 2, 8, 'log', 2)
    c.HL(1, 6, 14, 'log', 6); c.HL(1, 7, 14, 'log', 4); c.HL(1, 8, 14, 'log', 1)   # 안쪽 창턱(윗면)


@R.add('wall-door-u', '벽 통로(윗줄, 통나무 인방 + 어두운 틈)', 1, 1, 'terrain', tags=['실내', '벽', '통로'], rules='위아래 방을 잇는 통로 자리 윗줄. 아래 줄은 wall-door-d.')
def _(c):
    wall_log(c, 'u')
    c.R(1, 3, 14, 4, 'log', 4); c.HL(1, 3, 14, 'log', 6); c.HL(1, 4, 14, 'log', 5); c.HL(1, 6, 14, 'log', 2)
    c.P(1, 4, 'log', 3); c.P(14, 5, 'log', 1)
    c.R(3, 7, 10, 9, 'ink', 0); c.HL(3, 7, 10, 'ink', 1)
    for x0, t in ((1, 4), (13, 2)):
        c.R(x0, 7, 2, 9, 'log', t); c.VL(x0, 7, 9, 'log', t + 1)


@R.add('wall-door-d', '벽 통로(아랫줄, 문턱 — 걸어 지나간다)', 1, 1, 'terrain', tags=['실내', '벽', '통로'], rules='wall-door-u 바로 아래. 걸어 지나가는 칸.')
def _(c):
    wall_log(c, 'd')
    c.R(3, 0, 10, 16, 'ink', 0)
    for y in range(4, 16):
        for x in range(3, 13):
            m, t = plank_px(x, y + 2)
            c.P(x, y, m, t - (2 if y < 7 else 1 if y < 10 else 0))
    c.HL(3, 4, 10, 'ink', 1)
    for x0, t in ((1, 4), (13, 2)):
        c.R(x0, 0, 2, 15, 'log', t); c.VL(x0, 0, 15, 'log', t + 1)
    c.HL(1, 14, 14, 'log', 5); c.HL(1, 15, 14, 'log', 2)


# ═══════════════════════ 불 ═══════════════════════
def flames(c, x0, ybase, w, f, hmax=8, s=0):
    """불꽃 혀 여럿(프레임마다 높이가 바뀐다). ybase = 불 밑줄."""
    n = max(2, w // 3)
    for k in range(n):
        x = x0 + 1 + k * (w - 2) // max(1, n - 1)
        hgt = 3 + h32(k, f, 41 + s) % max(1, hmax - 2)
        for j in range(hgt):
            ww = max(1, (hgt - j) // 3 + 1)
            t = 4 if j < 2 else 3 if j < hgt * 0.6 else 2
            c.R(x - ww // 2, ybase - j, ww, 1, 'fire', t)
        if hgt > 5: c.P(x + (1 if f % 2 else -1), ybase - hgt - 1, 'fire', 2)


def embers(c, x0, y0, w, h, f, s=0):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            r = h32(x, y, 80 + s + f)
            c.P(x, y, *(('fire', 3) if r % 7 == 0 else ('fire', 2) if r % 3 == 0 else ('fire', 1) if r % 2 else ('stone', 1)))


# ═══════════════════════ 오두막·벽난로 ═══════════════════════
HEARTH_SLABS = [  # 윗면 판석(위에서 본 큰 돌판): (x0, y0, x1, y1)
    (1, 1, 9, 5), (9, 1, 19, 4), (19, 1, 31, 5), (1, 5, 7, 12), (7, 4, 16, 9), (16, 4, 24, 8), (24, 5, 31, 12),
    (7, 9, 15, 12), (15, 8, 24, 12)]


def fieldstone(c, x0, y0, w, h, s=0, cw=6, ch=4, base=3, warm=None):
    """막돌 쌓기: 엇갈린 격자 씨앗마다 둥근 돌 하나(왼쪽 위 밝고 오른쪽 아래 그늘, 5단), 돌 사이 짙은 줄눈.
    warm = (cx, cy, r) 이면 그 둘레 돌 모서리에 불빛(fire) 반사."""
    seeds = []
    for gy in range(-1, h // ch + 2):
        for gx in range(-1, w // cw + 2):
            ox = (cw // 2 if gy % 2 else 0) + (h32(gx, gy, s) % 3) - 1
            oy = (h32(gx, gy, s + 1) % 3) - 1
            sz = 0.85 + (h32(gx, gy, s + 2) % 4) * 0.1
            seeds.append((gx * cw + ox + cw / 2, gy * ch + oy + ch / 2, sz, (h32(gx, gy, s + 3) % 3) - 1))
    for j in range(h):
        for i in range(w):
            ds = sorted((((i + 0.5 - sx) / (cw * 0.5 * sz)) ** 2 + ((j + 0.5 - sy) / (ch * 0.5 * sz)) ** 2, sx, sy, sz, dv) for sx, sy, sz, dv in seeds)
            d0, sx, sy, sz, dv = ds[0]; d1 = ds[1][0]
            if d1 - d0 < 0.35 or d0 > 1.35:
                c.P(x0 + i, y0 + j, 'stone', 0 if (i + j) % 3 else 1); continue
            ux = (i + 0.5 - sx) / (cw * 0.5); uy = (j + 0.5 - sy) / (ch * 0.5)
            t = base + dv + (1 if ux + uy < -0.6 else 0) + (2 if ux + uy < -1.1 else 0) - (1 if ux + uy > 0.5 else 0) - (1 if uy > 0.7 else 0)
            if rnd(i, j, s + 4) < 0.07: t -= 1
            if warm:
                wx_, wy_, r = warm
                dd = math.hypot(x0 + i - wx_, (y0 + j - wy_) * 1.3)
                if dd < r and (ux > 0.3 or uy < -0.3) and (i + j) % 2 == 0 and d1 - d0 < 0.9:
                    c.P(x0 + i, y0 + j, 'fire', 1 if dd > r * 0.6 else 2); continue
            c.P(x0 + i, y0 + j, 'stone', max(1, min(6, t)))


@anim('hearth', '돌 벽난로(넓은 선반 + 화덕 석판 + 장작불)', 3, 2, 2, 'tall_furniture', tags=['오두막', '선술집', '벽난로', '불'], rules='벽면 아랫줄에 등을 대고 바닥 첫 줄부터 선다(왼쪽 위 칸 = 벽면 아랫줄). 앞 1칸 비움(깔개·걸상은 그 앞).', fps=6)
def hearth(c, f):
    W = 32
    # 윗면(넓고 매끈한 판석 선반, 12행): 뒤 벽과 맞닿는 곳은 짙게 → 앞으로 밝게, 판석 이음, 판석마다 결 점, 앞 모서리 반사
    for y in range(0, 12):
        t = 3 if y < 2 else 4 if y < 5 else 5
        for x in range(W):
            tt = t
            if rnd(x, y, 61) < 0.08: tt -= 1
            elif rnd(x, y, 62) < 0.05 and y > 3: tt += 1
            c.P(x, y, 'stone', tt)
    c.HL(0, 0, W, 'stone', 1)
    for (x, y0, y1) in ((11, 2, 6), (22, 5, 11), (6, 7, 11)): c.VL(x, y0, y1 - y0, 'stone', 3); c.VL(x + 1, y0, y1 - y0, 'stone', 5)
    c.HL(0, 5, 11, 'stone', 3); c.HL(22, 5, 10, 'stone', 3)
    for (x, y) in ((3, 8), (15, 3), (27, 9), (17, 9)): c.P(x, y, 'stone', 6)
    c.HL(0, 11, W, 'stone', 6)
    c.HL(0, 12, W, 'log', 4); c.HL(0, 13, W, 'log', 2)                    # 선반 앞 통나무 테
    for x in range(2, W, 6): c.P(x, 12, 'log', 5)
    # 선반 위 물건(위에서 본 입 + 오른쪽 아래 그늘)
    c.ell(7, 8.5, 3, 1.5, lambda X, Y, dx, dy, d: ('stone', 3))
    c.R(4, 4, 5, 4, 'red', 2); c.VL(4, 4, 4, 'red', 3); c.VL(8, 4, 4, 'red', 1)
    c.ell(6.5, 4, 2.6, 1.4, lambda X, Y, dx, dy, d: ('red', 4) if d > 0.45 else ('red', 0))
    c.ell(25, 8, 2.8, 1.4, lambda X, Y, dx, dy, d: ('stone', 3) if dx > 0 else ('iron', 4))
    c.R(24, 3, 1, 4, 'hide', 3); c.P(24, 2, 'lit', 4); c.P(24, 1, 'fire', 3); c.P(25, 7, 'iron', 2)
    c.ell(16, 8, 2.6, 1.4, lambda X, Y, dx, dy, d: ('log', 2) if d > 0.55 else ('log', 4))
    c.P(18, 9, 'stone', 3)
    # 앞면: 막돌 + 둥근 아치 아궁이(그을음·안쪽 불빛)
    fieldstone(c, 1, 14, 30, 12, s=37, cw=6, ch=4, base=4, warm=(16, 23, 10))
    c.VL(1, 14, 12, 'stone', 1); c.VL(30, 14, 12, 'stone', 0)
    ax0, ax1, atop, abot = 8, 24, 16, 25
    for X in range(ax0, ax1):
        u = (X - ax0 + 0.5) / (ax1 - ax0)
        yt = atop + int(round(3.2 * (1 - math.sin(math.pi * u))))
        for Y in range(yt, abot + 1):
            c.P(X, Y, 'ink', 0 if Y < yt + 3 else 1)
        c.P(X, yt - 1, 'stone', 5 if u < 0.5 else 4)                      # 아치 돌 테(쐐기돌)
        if u < 0.08 or u > 0.92:
            for Y in range(yt, abot + 1): c.P(X, Y, 'stone', 2 if u < 0.5 else 1)
    for X in range(ax0 + 1, ax1 - 1):                                     # 그을음
        if (X * 3) % 5: c.P(X, atop - 2 + (X % 2), 'stone', 1)
    c.R(10, 22, 12, 2, 'log', 2); c.HL(10, 22, 12, 'log', 4); c.line(11, 24, 20, 21, 'log', 1)
    c.line(12, 21, 19, 24, 'log', 3)
    flames(c, 10, 22, 12, f, hmax=6)
    for x in range(10, 22): c.P(x, 24, 'fire', 2 + (x + f) % 2); c.P(x, 25, 'fire', 1 if (x + f) % 3 else 3)
    # 화덕 석판(앞으로 나온 넓은 판석 윗면 4행 + 앞면) + 불빛 반사
    c.R(0, 26, W, 4, 'stone', 4); c.HL(0, 26, W, 'stone', 2)
    for (x, ln) in ((0, 9), (9, 8), (17, 7), (24, 8)):
        c.HL(x + 1, 27, ln - 2, 'stone', 5); c.VL(x, 27, 3, 'stone', 2); c.P(x + ln - 1, 29, 'stone', 3)
    c.HL(0, 29, W, 'stone', 5)
    for x in range(9, 23): c.P(x, 27, 'fire', 1 if (x + f) % 3 else 2)
    for x in range(11, 21, 2): c.P(x, 28, 'fire', 1)
    c.HL(0, 30, W, 'stone', 2); c.HL(0, 31, W, 'stone', 0)


@R.add('bed-fur', '통나무 침대(모피 이불, 머리판 북쪽)', 2, 3, 'low_furniture', tags=['오두막', '침실', '침대'], rules='방 북쪽(벽면 아랫줄 바로 아래 바닥 첫 줄)에 머리를 댄다. 옆 1칸 비움.')
def _(c):
    # 머리판: 굵은 통나무(윗면 4행 + 앞면 5행) + 기둥 머리
    c.R(1, 1, 30, 4, 'log', 5); c.HL(1, 1, 30, 'log', 3); c.HL(1, 4, 30, 'log', 6)
    c.R(1, 5, 30, 5, 'log', 3); c.HL(1, 5, 30, 'log', 4); c.HL(1, 9, 30, 'log', 1)
    for x0 in (1, 27):
        c.ell(x0 + 2, 2, 2.2, 1.8, lambda X, Y, dx, dy, d: ('log', 6 if dx < 0 else 4))
    # 옆 틀(윗면이 보이는 굵은 통나무)
    for x0, t in ((1, 5), (28, 4)):
        c.R(x0, 10, 3, 31, 'log', t); c.VL(x0, 10, 31, 'log', t + 1); c.VL(x0 + 2, 10, 31, 'log', t - 2)
    # 매트(짚 + 아마천) + 베개
    c.R(4, 10, 24, 30, 'pack', 4)
    c.R(6, 11, 20, 6, 'pack', 5); c.HL(6, 11, 20, 'pack', 4); c.HL(6, 16, 20, 'pack', 3); c.VL(16, 12, 4, 'pack', 4)
    c.HL(4, 10, 24, 'log', 1)
    # 모피 이불(털 결, 접힌 윗단)
    for y in range(18, 40):
        for x in range(4, 28):
            t = 4
            if (x + y // 2) % 3 == 0: t = 5
            if (x * 2 + y) % 5 == 0: t = 3
            if x > 24: t -= 1
            if y > 36: t -= 1
            c.P(x, y, 'fur', cl(t, 1, 5))
    c.HL(4, 18, 24, 'fur', 5); c.HL(4, 19, 24, 'fur', 4); c.HL(4, 20, 24, 'fur', 2)
    for x in range(5, 27, 4): c.P(x, 21, 'fur', 2)
    # 발판(윗면 3행 + 앞면 3행)
    c.R(1, 40, 30, 3, 'log', 5); c.HL(1, 40, 30, 'log', 3); c.HL(1, 42, 30, 'log', 6)
    c.R(1, 43, 30, 3, 'log', 3); c.HL(1, 45, 30, 'log', 2)
    c.R(1, 46, 3, 1, 'log', 1); c.R(28, 46, 3, 1, 'log', 1)
    c.HL(1, 47, 30, 'ink', 1)


@R.add('bunk-bed', '이층 침대(통나무 기둥, 위아래 모피)', 2, 3, 'tall_furniture', tags=['회관', '숙소', '침대'], rules='벽면 아랫줄에 등을 대고 바닥 첫 줄부터 선다. 회관·숙소 벽을 따라 1칸 띄워 줄로.')
def _(c):
    # 기둥 넷(앞 두 기둥만 보인다, 머리가 둥근 통나무)
    def bunk(y0, depth, dim):
        # 매트 윗면 + 모피 이불 + 베개(dim = 아래 칸 그늘)
        c.R(4, y0, 24, depth, 'pack', 4 - dim)
        c.R(6, y0 + 1, 9, 4, 'pack', 5 - dim); c.HL(6, y0 + 4, 9, 'pack', 3 - dim)
        for y in range(y0 + 1, y0 + depth):
            for x in range(16, 28):
                t = 4 - dim + (1 if (x + y // 2) % 3 == 0 else 0) - (1 if (x * 2 + y) % 5 == 0 else 0)
                c.P(x, y, 'fur', cl(t, 1, 5))
        for y in range(y0 + 5, y0 + depth):
            for x in range(4, 16):
                t = 4 - dim + (1 if (x + y // 2) % 3 == 0 else 0) - (1 if (x * 2 + y) % 5 == 0 else 0)
                c.P(x, y, 'fur', cl(t, 1, 5))
    # 위 칸
    c.R(2, 1, 28, 3, 'log', 3); c.HL(2, 1, 28, 'log', 5); c.HL(2, 3, 28, 'log', 1)     # 머리판
    bunk(4, 15, 0)
    c.R(0, 19, 32, 3, 'log', 5); c.HL(0, 19, 32, 'log', 3); c.HL(0, 21, 32, 'log', 6)    # 앞 난간 윗면
    c.R(0, 22, 32, 3, 'log', 3); c.HL(0, 24, 32, 'log', 1)
    # 아래 칸(위 칸 밑 그늘 속)
    c.R(4, 25, 24, 2, 'ink', 1)
    bunk(27, 11, 1)
    c.HL(4, 27, 24, 'ink', 2)
    c.R(0, 38, 32, 3, 'log', 5); c.HL(0, 38, 32, 'log', 3); c.HL(0, 40, 32, 'log', 6)
    c.R(0, 41, 32, 3, 'log', 3); c.HL(0, 43, 32, 'log', 1)
    # 앞 기둥(둥근 통나무: 왼쪽 밝게)
    for x0 in (0, 28):
        for j in range(2, 46):
            if 19 <= j <= 24 or 38 <= j <= 43: continue
            for i in range(4):
                c.P(x0 + i, j, 'log', (5, 4, 3, 2)[i])
        c.ell(x0 + 2, 2, 2.2, 1.6, lambda X, Y, dx, dy, d: ('log', 6 if dx < 0 else 4))
    c.R(0, 44, 4, 2, 'log', 2); c.R(28, 44, 4, 2, 'log', 2)
    c.HL(0, 46, 32, 'ink', 2); c.HL(0, 47, 32, 'ink', 1)


@R.add('chest', '쇠띠 두른 나무 궤짝', 1, 1, 'box', tags=['오두막', '창고', '궤짝'], rules='침대 발치·벽 모퉁이.')
def _(c):
    # 뚜껑 윗면 8행(뒤 어둡게 → 앞 밝게) + 뚜껑 턱 그늘 + 짙은 앞면 5행
    for y in range(1, 9):
        c.HL(1, y, 14, 'log', 4 if y < 3 else 5 if y < 7 else 6)
    c.HL(1, 1, 14, 'log', 2)
    c.VL(1, 1, 8, 'log', 4); c.VL(14, 1, 8, 'log', 3)
    for (x, y) in ((5, 3), (9, 5), (6, 6)): c.HL(x, y, 3, 'log', 4)
    c.HL(1, 9, 14, 'log', 1)
    c.R(1, 10, 14, 5, 'log', 2); c.HL(1, 10, 14, 'log', 3); c.VL(1, 10, 5, 'log', 3); c.VL(14, 10, 5, 'log', 1)
    for x0 in (3, 11):
        c.R(x0, 1, 2, 8, 'iron', 5); c.P(x0 + 1, 1, 'iron', 3); c.P(x0 + 1, 8, 'iron', 4)
        c.R(x0, 10, 2, 5, 'iron', 2); c.P(x0, 10, 'iron', 3)
    c.R(7, 9, 2, 3, 'brass', 3); c.P(8, 11, 'brass', 1)
    c.HL(1, 15, 14, 'ink', 1)


def bowl(c, x, y, rx=3, ry=1.8, food='fur'):
    c.ell(x, y + 1, rx, ry, lambda X, Y, dx, dy, d: ('log', 2) if dy > 0 else None)
    c.ell(x, y, rx, ry, lambda X, Y, dx, dy, d: ('log', 4 if dy > 0.3 else 3) if d > 0.55 else (food, 3 if dx < 0 else 2))


def horn(c, x, y, flip=False):
    """누운 뿔잔(가는 끝 → 넓은 놋쇠 입)."""
    pts = [(0, 0), (1, 0), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1)]
    for k, (dx, dy) in enumerate(pts):
        X = x - dx if flip else x + dx
        th = 1 if k < 3 else 2
        for j in range(th): c.P(X, y + dy + j - (1 if th == 2 else 0), 'hide', 3 if j == 0 else 1)
    X = x - 7 if flip else x + 7
    c.R(X, y - 1, 1, 3, 'brass', 3); c.P(X, y - 1, 'brass', 3); c.P(X, y + 1, 'brass', 1)


@R.add('long-table', '긴 잔칫상(가대 다리, 나무 그릇·빵·뿔잔)', 3, 2, 'low_furniture', tags=['회관', '선술집', '식탁'], rules='회관 가운데 동서로. 남북에 긴 의자(bench) 를 붙이고 둘레 1칸 통로.')
def _(c):
    box3(c, 1, 2, 46, 15, 4, 'log', tt=5, ft=3)
    for y in (5, 9, 13): c.HL(2, y, 44, 'log', 4)
    for (x, y) in ((12, 3), (30, 7), (21, 11), (40, 3)): c.HL(x, y, 4, 'log', 4)
    # 가대 다리(두꺼운 A 꼴) + 그늘
    for x0 in (4, 38):
        c.R(x0, 21, 6, 7, 'log', 3); c.VL(x0, 21, 7, 'log', 4); c.VL(x0 + 5, 21, 7, 'log', 1)
        c.R(x0 - 1, 28, 8, 2, 'log', 2); c.HL(x0 - 1, 28, 8, 'log', 4)
    c.R(10, 21, 28, 2, 'ink', 2)
    c.HL(3, 30, 42, 'ink', 2); c.HL(3, 31, 42, 'ink', 1)
    # 위 물건
    bowl(c, 9, 8); bowl(c, 27, 12); bowl(c, 39, 7, food='hide')
    c.ell(18, 7, 4, 2.3, lambda X, Y, dx, dy, d: ('straw', 3 if dx + dy < -0.2 else 2) if d < 0.8 else ('straw', 1))   # 둥근 빵
    c.P(17, 6, 'straw', 3); c.HL(16, 8, 4, 'straw', 1)
    horn(c, 30, 4); horn(c, 14, 13, flip=True); horn(c, 42, 13, flip=True)
    c.R(33, 10, 5, 3, 'drift', 4); c.HL(33, 10, 5, 'drift', 5); c.HL(33, 12, 5, 'drift', 2)   # 도마
    c.R(34, 11, 3, 1, 'straw', 3)


@R.add('bench', '긴 의자(통나무 판 + 모피 깔개)', 2, 1, 'seat', tags=['회관', '선술집', '의자'], rules='긴 잔칫상·탁자 남북에 나란히.')
def _(c):
    box3(c, 1, 2, 30, 7, 4, 'log', tt=5, ft=3)
    c.HL(2, 5, 28, 'log', 4)
    for x0 in (3, 25): c.R(x0, 13, 4, 2, 'log', 2); c.VL(x0, 13, 2, 'log', 3)
    c.HL(1, 15, 30, 'ink', 1)
    # 모피 깔개(윗면에 덮이고 앞으로 늘어진다)
    for y in range(3, 12):
        for x in range(7, 17):
            t = 4 + (1 if (x + y // 2) % 3 == 0 else 0) - (1 if (x * 2 + y) % 5 == 0 else 0)
            if y >= 9: t -= 2
            c.P(x, y, 'fur', cl(t, 1, 5))
    for x in range(7, 17, 2): c.P(x, 12, 'fur', 2)


@R.add('stool', '그루터기 걸상(나이테 윗면)', 1, 1, 'seat', tags=['오두막', '선술집', '걸상'], rules='탁자·벽난로 앞·바 앞.')
def _(c):
    for j in range(6, 15):
        for i in range(10):
            u = (i + 0.5) / 10
            t = 4 if u < 0.25 else 3 if u < 0.6 else 2 if u < 0.85 else 1
            if (i * 3 + j) % 5 == 0: t -= 1
            c.P(3 + i, j, 'log', max(1, t))
    c.ell(8, 14.5, 5, 1.2, lambda X, Y, dx, dy, d: ('log', 1) if dy > 0 else None)
    c.ell(8, 6, 6, 4.2, lambda X, Y, dx, dy, d: ('log', 2) if d > 0.82 else ('log', 6 if (dx + dy < -0.5) else 5) if d > 0.55 or d < 0.2 else ('log', 4))
    c.P(8, 6, 'log', 3); c.HL(3, 6, 1, 'log', 3)
    c.HL(3, 15, 10, 'ink', 1)


def barrel_body(c, x, y, w, h, cap=6, base=4):
    cyl_v(c, x, y, w, h, cap, 'log', base=base)
    cx = x + w / 2
    for by in (y + cap // 2 + 3, y + cap // 2 + h - 4):
        for i in range(w):
            u = (i + 0.5) / w * 2 - 1
            yy = by + round(1.2 * (1 - u * u))
            c.P(x + i, yy, 'iron', 4 if u < 0 else 2); c.P(x + i, yy + 1, 'iron', 1)
    c.HL(int(cx) - 2, y + cap // 2, 5, 'log', 4)
    c.P(int(cx) + 1, y + cap // 2 - 1, 'log', 2)


@R.add('keg-rack', '술통 받침대(받침 판 위 세운 통 둘 + 꼭지)', 2, 2, 'frame', tags=['선술집', '술통', '창고'], rules='벽면 아랫줄에 등을 대고 바닥 첫 줄부터. 바 뒤.')
def _(c):
    c.R(2, 12, 28, 2, 'log', 2); c.HL(2, 12, 28, 'log', 3)                   # 뒤 가로대
    for x0 in (0, 28):
        c.R(x0, 3, 4, 3, 'log', 5); c.HL(x0, 3, 4, 'log', 3); c.HL(x0, 5, 4, 'log', 6)
        c.R(x0, 6, 4, 22, 'log', 3); c.VL(x0, 6, 22, 'log', 4); c.VL(x0 + 3, 6, 22, 'log', 1)
    c.R(1, 21, 30, 4, 'log', 5); c.HL(1, 21, 30, 'log', 3); c.HL(1, 24, 30, 'log', 6)   # 받침 판 윗면
    c.R(1, 25, 30, 3, 'log', 3); c.HL(1, 27, 30, 'log', 1)
    for x in (9, 22): c.VL(x, 25, 3, 'log', 1)
    for x0 in (4, 17):
        barrel_body(c, x0, 6, 11, 12, cap=8, base=4)
        c.R(x0 + 4, 16, 3, 2, 'brass', 3); c.P(x0 + 4, 16, 'brass', 3); c.P(x0 + 5, 18, 'brass', 1)
    for x0 in (0, 28): c.R(x0, 28, 4, 3, 'log', 2)
    c.HL(0, 31, 32, 'ink', 1)


def tankard(c, x, y):
    """나무 잔(세운 통 모양 + 쇠테 + 손잡이 + 거품)."""
    c.R(x, y + 1, 4, 4, 'log', 4); c.VL(x, y + 1, 4, 'log', 5); c.VL(x + 3, y + 1, 4, 'log', 2)
    c.HL(x, y + 3, 4, 'iron', 3)
    c.HL(x, y, 4, 'pack', 5); c.P(x + 3, y, 'pack', 4)
    c.P(x + 4, y + 2, 'log', 3); c.P(x + 4, y + 3, 'log', 2)


@R.add('bar-counter', '선술집 바(통나무 상판 + 잔·뿔잔·꼭지)', 4, 2, 'low_furniture', tags=['선술집', '바'], rules='선술집 북쪽 벽에서 한 칸 띄워 동서로. 뒤(북쪽)는 바텐더 통로 1칸, 앞에 걸상.')
def _(c):
    box3(c, 1, 3, 62, 11, 13, 'log', tt=4, ft=2)
    c.HL(1, 7, 62, 'log', 5); c.HL(1, 10, 62, 'log', 3)
    for x in range(2, 62):
        k = x % 5
        if k == 0: c.VL(x, 15, 11, 'log', 1)
        elif k == 1: c.VL(x, 15, 11, 'log', 3)
    c.HL(1, 18, 62, 'iron', 3); c.HL(1, 19, 62, 'iron', 1)
    c.HL(1, 23, 62, 'iron', 3); c.HL(1, 24, 62, 'iron', 1)
    c.R(1, 27, 62, 3, 'log', 1); c.HL(1, 27, 62, 'log', 3)
    c.HL(1, 30, 62, 'ink', 2); c.HL(0, 31, 64, 'ink', 1)
    for x in (5, 13, 34, 47): tankard(c, x, 4)
    horn(c, 22, 9); horn(c, 41, 10)
    c.R(26, 4, 6, 3, 'wool', 3); c.HL(26, 4, 6, 'wool', 4); c.HL(26, 6, 6, 'wool', 1)   # 행주
    # 작은 꼭지 통(누운 통 앞면 = 나이테 원판)
    c.R(53, 1, 9, 9, 'log', 3); c.HL(53, 1, 9, 'log', 5); c.HL(53, 9, 9, 'log', 1)
    c.ell(57.5, 5, 4, 3.8, lambda X, Y, dx, dy, d: ('iron', 3) if d > 0.75 else ('log', 5 if dx + dy < 0 else 4) if d > 0.25 else ('log', 3))
    c.R(57, 9, 2, 3, 'brass', 3); c.P(58, 11, 'brass', 1)


# ═══════════════════════ 벽걸이 ═══════════════════════
@R.add('shelf', '벽 선반(질그릇 단지·자루)', 2, 1, 'wall_mounted', tags=['실내', '벽걸이', '선반', '부엌'], rules='벽면 윗줄. 오두막 부엌·선술집 바 뒤.')
def _(c):
    c.R(1, 11, 30, 2, 'log', 5); c.HL(1, 11, 30, 'log', 6); c.HL(1, 13, 30, 'log', 2)
    for x in (3, 27):
        c.R(x, 14, 2, 1, 'log', 2); c.P(x, 15, 'log', 1)
    jars = ((3, 'red', 7), (8, 'stone', 5), (12, 'wool', 8), (17, 'hide', 5), (21, 'red', 6), (26, 'stone', 7))
    for (x, m, h) in jars:
        y0 = 11 - h
        n = NT[MI[m]]
        c.R(x, y0 + 1, 4, h - 1, m, n - 3); c.VL(x, y0 + 1, h - 1, m, n - 2); c.VL(x + 3, y0 + 1, h - 1, m, max(0, n - 5))
        c.HL(x, y0, 4, m, n - 1); c.HL(x + 1, y0, 2, m, max(0, n - 4))                 # 아가리(위에서 본 입)
        if m == 'hide': c.HL(x, y0 + 2, 4, 'red', 2)
        if h > 6: c.HL(x, y0 + 3, 4, m, n - 2)


@R.add('weapon-rack', '벽 무기 걸이(둥근 방패 + 엇건 도끼 둘)', 2, 2, 'wall_mounted', tags=['회관', '벽걸이', '무기'], rules='회관 벽면 두 줄에 얹는다(왼쪽 위 칸 = 벽면 윗줄).')
def _(c):
    # 걸이 판(가로 통나무) + 나무 못
    c.R(1, 4, 30, 3, 'log', 4); c.HL(1, 4, 30, 'log', 5); c.HL(1, 6, 30, 'log', 2); c.HL(1, 7, 30, 'log', 1)
    # 도끼 둘(엇걸린 자루 + 쇠 날)
    c.line(5, 3, 25, 27, 'log', 4); c.line(6, 3, 26, 27, 'log', 2)
    c.line(26, 3, 6, 27, 'log', 4); c.line(27, 3, 7, 27, 'log', 2)
    for (x, flip) in ((2, False), (24, True)):
        pts = [(0, 0), (4, 0), (5, 1), (5, 6), (4, 7), (0, 5)]
        if flip: pts = [(6 - px_, py) for (px_, py) in pts]
        c.poly([(x + px_, 1 + py) for (px_, py) in pts], lambda X, Y: ('iron', 4 if Y < 4 else 3))
        ex = x + (0 if not flip else 6)
        c.VL(ex, 1, 6, 'iron', 5)
    # 둥근 방패(추상 사분 무늬 + 쇠 테 + 돌기)
    cx, cy, r = 16, 17, 9
    def sh(X, Y, dx, dy, d):
        if d > 0.8: return ('iron', 4 if dx + dy < 0 else 2)
        q = (dx < 0) == (dy < 0)
        m = 'red' if q else 'straw'
        return (m, 3 if dx + dy < -0.2 else 2)
    c.ell(cx, cy, r, r, sh)
    c.ell(cx, cy, 2.4, 2.4, lambda X, Y, dx, dy, d: ('iron', 5 if dx + dy < 0 else 2))
    c.HL(7, 26, 18, 'ink', 1)


@R.add('antler-mount', '벽 사슴뿔 걸이(나무 판, 머리 없음)', 1, 1, 'wall_mounted', tags=['오두막', '회관', '벽걸이', '사냥'], rules='벽면 윗줄. 벽난로 위·문 위.')
def _(c):
    c.ell(8, 11, 3.5, 3.5, lambda X, Y, dx, dy, d: ('log', 1) if d > 0.75 else ('log', 5 if dx + dy < -0.3 else 3))
    c.P(7, 10, 'log', 6)
    def beam(pts):
        for (a, b) in zip(pts, pts[1:]):
            c.line(a[0], a[1], b[0], b[1], 'birch', 4)
            c.line(a[0] + 1, a[1] + 1, b[0] + 1, b[1] + 1, 'birch', 2)
    beam([(6, 9), (4, 6), (2, 3), (1, 0)]); beam([(4, 6), (5, 3)]); beam([(3, 4), (0, 4)])
    beam([(9, 9), (11, 6), (13, 3), (14, 0)]); beam([(11, 6), (10, 3)]); beam([(12, 4), (15, 4)])


@R.add('drying-herbs', '말리는 약초 다발(벽 막대)', 2, 1, 'wall_mounted', tags=['오두막', '부엌', '벽걸이', '약초'], rules='벽면 윗줄. 부엌·화덕 곁.')
def _(c):
    c.R(1, 2, 30, 2, 'log', 4); c.HL(1, 2, 30, 'log', 5); c.HL(1, 4, 30, 'log', 1)
    for x in (1, 30): c.R(x, 1, 1, 4, 'iron', 3)
    mats = ('tundra', 'frost', 'straw', 'frost', 'tundra')
    for k, x in enumerate((4, 10, 16, 22, 27)):
        m = mats[k]; n = NT[MI[m]]
        c.R(x, 4, 2, 2, 'red', 3); c.P(x + 1, 5, 'red', 1)
        c.VL(x, 6, 2, 'straw', 1); c.VL(x + 1, 6, 2, 'straw', 2)
        ln = 7 + h32(k, 3, 5) % 3
        for j in range(ln):
            hw = 1 + j // 2
            for X in range(x - hw + 1, x + hw + 1):
                u = (X - (x - hw + 1)) / max(1, 2 * hw - 1)
                t = n - 1 if u < 0.35 else n - 2 if u < 0.7 else n - 3
                if (X + j) % 3 == 0: t -= 1
                if j == ln - 1 and (X + k) % 2: continue
                c.P(X, 8 + j, m, max(0, t))


@R.add('lantern', '벽 등(쇠 까치발 + 호박색 등)', 1, 1, 'wall_mounted', tags=['실내', '벽걸이', '등', '빛'], rules='벽면 아랫줄(문 곁·바 위·통로).')
def _(c):
    c.HL(1, 3, 9, 'iron', 4); c.HL(1, 4, 9, 'iron', 2); c.line(2, 5, 5, 4, 'iron', 2)
    c.R(0, 1, 2, 6, 'iron', 3); c.VL(0, 1, 6, 'iron', 4)
    c.VL(8, 4, 2, 'iron', 2)
    c.R(5, 6, 7, 2, 'iron', 4); c.HL(5, 6, 7, 'iron', 5); c.HL(6, 5, 5, 'iron', 3)
    c.R(5, 8, 7, 6, 'lit', 3); c.R(7, 9, 3, 4, 'lit', 4); c.P(8, 10, 'fire', 4)
    c.VL(5, 8, 6, 'iron', 3); c.VL(11, 8, 6, 'iron', 1); c.VL(8, 8, 1, 'iron', 2)
    c.R(5, 14, 7, 1, 'iron', 2); c.HL(6, 15, 5, 'iron', 1)


# ═══════════════════════ 바닥 깔개 ═══════════════════════
@R.add('rug-fur', '모피 깔개(머리 없는 가죽)', 2, 2, 'flat', tags=['오두막', '회관', '깔개'], rules='벽난로 앞·침대 곁. 가구 밑에 깔지 않는다.')
def _(c):
    blobs = [(16, 16, 11.5, 9), (6, 7, 4.5, 3.5), (26, 7, 4.5, 3.5), (6, 25, 4.5, 3.5), (26, 25, 4.5, 3.5), (16, 28, 2.5, 3)]
    def inside(x, y):
        best = 9
        for (cx, cy, rx, ry) in blobs:
            dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry
            best = min(best, dx * dx + dy * dy)
        return best
    for y in range(32):
        for x in range(32):
            d = inside(x, y)
            if d > 1: continue
            dc = ((x - 16) / 12) ** 2 + ((y - 16) / 10) ** 2
            t = 4 if dc < 0.5 else 3
            if (x + y // 2) % 3 == 0: t += 1
            if (x * 2 + y) % 5 == 0: t -= 1
            if d > 0.75: t = 2 if (x + y) % 2 else 1
            c.P(x, y, 'fur', cl(t, 1, 5))
    for y in range(9, 24, 3): c.HL(16 - 1, y, 2, 'fur', 2)                    # 등줄기


# ═══════════════════════ 부엌·사우나 ═══════════════════════
@anim('cauldron-in', '걸린 무쇠 솥(사슬 + 작은 불)', 3, 1, 2, 'container', tags=['오두막', '부엌', '솥', '불'], rules='회관 화덕 위·오두막 부엌 구석. 둘레 1칸 비움.', fps=5)
def cauldron(c, f):
    for y in range(0, 10):
        c.P(8, y, 'iron', 4 if y % 2 else 2); c.P(7 + (y % 2), y, 'iron', 2 if y % 2 else 3)
    c.line(1, 14, 8, 9, 'iron', 3); c.line(15, 14, 8, 9, 'iron', 2)
    # 몸통(둥근 무쇠)
    c.ell(8, 18, 7.5, 7, lambda X, Y, dx, dy, d: ('iron', 3 if dx < -0.4 else 2 if dx < 0.3 else 1) if dy > -0.2 else None)
    c.ell(8, 18, 7.5, 7, lambda X, Y, dx, dy, d: ('iron', 0) if d > 0.85 and dy > 0 else None)
    # 아가리(위에서 본 타원) + 국
    def mouth(X, Y, dx, dy, d):
        if d > 0.72: return ('iron', 2 if dy < 0 else 5)
        t = 3 if dx + dy < -0.2 else 2
        if h32(X, Y, 90 + f) % 6 == 0: t = 4
        return ('fur', t)
    c.ell(8, 14, 7.5, 4.6, mouth)
    for (bx, by) in [((5, 13), (10, 15)), ((9, 13), (6, 15)), ((7, 14), (11, 13))][f]:
        c.P(bx, by, 'hide', 3)
    for k, (x, y) in enumerate([((6, 8), (9, 6)), ((7, 7), (10, 5)), ((5, 7), (8, 5))][f]):
        c.P(x, y, 'smoke', 4); c.P(x + 1, y, 'smoke', 3)
    # 밑불 + 돌 둘레
    c.ell(8, 28.5, 7, 2.6, lambda X, Y, dx, dy, d: ('stone', 4 if dx < 0 else 3) if d > 0.45 else None)
    embers(c, 4, 27, 9, 2, f)
    flames(c, 4, 27, 9, f, hmax=4, s=3)
    c.HL(2, 31, 13, 'ink', 1)


@anim('sauna-stove', '사우나 돌 난로(둥근 무쇠 통 + 위가 트인 돌 바구니 + 숯불 문)', 3, 2, 2, 'container', tags=['사우나', '난로', '불'], rules='사우나 방 벽면 아랫줄 곁 모퉁이. 앞 1칸 비움, 사우나 의자 맞은편.', fps=5)
def sauna_stove(c, f):
    cx = 16
    # 둥근 무쇠 통(세운 원통, 왼쪽 반사 · 오른쪽 그늘) + 굽은 띠
    for j in range(10, 27):
        for i in range(28):
            u = (i + 0.5) / 28
            t = 3 if u < 0.18 else 2 if u < 0.6 else 1
            c.P(2 + i, j, 'iron', t)
    c.ell(cx, 26, 14, 3, lambda X, Y, dx, dy, d: ('iron', 2 if dx < -0.3 else 1) if dy > 0 else None)
    for by in (14, 23):
        for i in range(28):
            u = (i + 0.5) / 28 * 2 - 1
            yy = by + round(2.5 * (1 - u * u))
            c.P(2 + i, yy, 'iron', 4 if u < -0.2 else 3 if u < 0.4 else 2)
    # 숯불 문(앞, 굽은 몸에 붙은 작은 문)
    c.R(10, 16, 12, 7, 'iron', 1); c.HL(10, 16, 12, 'iron', 4); c.VL(10, 16, 7, 'iron', 4)
    embers(c, 12, 17, 9, 5, f, s=7)
    for x in (14, 17): c.VL(x, 17, 5, 'iron', 1)
    # 위 테(위에서 본 타원 아가리) + 안에 쌓인 돌
    def mouth(X, Y, dx, dy, d):
        if d > 0.86: return ('iron', 2 if dy < -0.1 else 5)
        if d > 0.76: return ('iron', 3 if dy < 0 else 4)
        return ('stone', 1)
    c.ell(cx, 9, 14, 7.5, mouth)
    stones = [(10, 5.5), (16, 4.5), (22, 5.5), (7, 8.5), (13, 8), (19, 8), (25, 8.5), (10, 11.5), (16, 11.5), (22, 11.5)]
    for (sx, sy) in stones:
        def st(X, Y, dx, dy, d):
            if ((X + 0.5 - cx) / 14) ** 2 + ((Y + 0.5 - 9) / 7.5) ** 2 > 0.62: return None
            if d > 0.88: return ('stone', 1)
            if d > 0.6 and dx + dy > 0.4: return ('stone', 2)
            return ('stone', 6 if dx + dy < -0.6 else 5 if dx + dy < 0.1 else 4)
        c.ell(sx, sy, 2.9, 2, st)
    for (x, y) in [((10, 3), (20, 2)), ((12, 2), (18, 3)), ((9, 1), (21, 1))][f]:
        c.P(x, y, 'smoke', 4); c.P(x + 1, y - 1, 'smoke', 3)
    for x0 in (5, 24): c.R(x0, 28, 3, 2, 'iron', 2)
    c.HL(4, 30, 24, 'ink', 2); c.HL(5, 31, 22, 'ink', 1)


def slats_top(c, x, y, w, rows, base=5):
    for j in range(rows):
        k = j % 3
        t = base + 1 if k == 0 else base if k == 1 else base - 2
        if j == 0: t = 2
        c.HL(x, y + j, w, 'log', t)
    c.HL(x, y + rows - 1, w, 'log', 6)


def slats_front(c, x, y, w, rows):
    for i in range(w):
        k = i % 4
        t = 3 if k == 0 else 2 if k in (1, 2) else 0
        c.VL(x + i, y, rows, 'log', t)
    c.HL(x, y, w, 'log', 1)
    c.HL(x, y + rows - 1, w, 'log', 1)


@R.add('sauna-bench', '사우나 두 단 의자(옅은 나무 발판)', 3, 2, 'seat', tags=['사우나', '의자'], rules='사우나 방 북쪽 벽면 아랫줄에 등을 대고 바닥 첫 줄부터. 난로 맞은편.')
def _(c):
    slats_top(c, 1, 0, 46, 8)
    slats_front(c, 1, 8, 46, 6)
    slats_top(c, 1, 14, 46, 8)
    slats_front(c, 1, 22, 46, 6)
    for x0 in (2, 22, 42): c.R(x0, 28, 4, 2, 'log', 2); c.VL(x0, 28, 2, 'log', 3)
    c.HL(1, 30, 46, 'ink', 2); c.HL(1, 31, 46, 'ink', 1)
    c.VL(1, 0, 28, 'log', 4); c.VL(46, 0, 28, 'log', 1)
    # 바가지 하나(아래 단 위)
    c.ell(36, 17.5, 3.2, 2, lambda X, Y, dx, dy, d: ('log', 2) if d > 0.6 else ('water', 4 if dx < 0 else 3))
    c.line(39, 17, 43, 16, 'log', 3)


@R.add('water-bucket', '물동이와 국자', 1, 1, 'container', tags=['사우나', '부엌', '물', '통'], rules='사우나 난로 곁·부엌 화덕 곁.')
def _(c):
    for j in range(6, 15):
        for i in range(11):
            u = (i + 0.5) / 11
            t = 5 if u < 0.25 else 4 if u < 0.6 else 3 if u < 0.85 else 2
            if i % 3 == 2: t -= 1
            c.P(3 + i, j, 'log', max(1, t))
    for by in (9, 13): c.HL(3, by, 11, 'iron', 3); c.P(13, by, 'iron', 1)
    def mouth(X, Y, dx, dy, d):
        if d > 0.74: return ('log', 2 if dy < 0 else 6)
        return ('water', 4 if dx + dy < -0.3 else 3) if (X + Y) % 5 else ('ice', 5)
    c.ell(8.5, 6, 5.5, 4.2, mouth)
    c.line(9, 5, 15, 0, 'log', 4); c.line(10, 5, 15, 1, 'log', 2)
    c.ell(8, 6.5, 1.6, 1, lambda X, Y, dx, dy, d: ('log', 3))
    c.HL(3, 15, 11, 'ink', 1)


# ═══════════════════════ 얼음 동굴 ═══════════════════════
def shard(c, cx, ybot, h, w, lean=0.0):
    """육각 얼음 기둥 하나: 몸(왼쪽 밝게) + 위 뾰족 면(윗면 빛) + 오른쪽 짙은 가장자리."""
    for j in range(h):
        f = j / max(1, h - 1)                        # 0 = 위
        y = ybot - h + j
        x0 = cx + lean * (1 - f) - w / 2
        hw = w if j > 3 else max(1, round(w * (j + 1) / 4))
        xs = int(round(x0 + (w - hw) / 2))
        for i in range(hw):
            u = (i + 0.5) / hw
            t = 6 if (u < 0.3 and j < 4) else 5 if u < 0.4 else 4 if u < 0.7 else 3
            if j >= 4 and i == hw - 1: t = 2
            if j >= 4 and abs(u - 0.4) < 0.15 and (j % 4) == 1: t = 6
            c.P(xs + i, y, 'ice', t)


@R.add('ice-crystal', '얼음 결정 무리', 1, 2, 'organic', tags=['얼음 동굴', '결정', '얼음'], rules='얼음 동굴 벽 곁·모퉁이에 1~3 무리. 길을 막지 않게.')
def _(c):
    c.ell(8, 28, 7, 2.6, lambda X, Y, dx, dy, d: ('stone', 3 if dx < 0 else 2))
    shard(c, 4, 29, 13, 4, lean=-1.5)
    shard(c, 12, 29, 15, 4, lean=1.5)
    shard(c, 8, 28, 24, 6, lean=0)
    shard(c, 6, 30, 7, 3, lean=-0.5)
    for (x, y) in ((3, 27), (13, 28), (9, 9)): c.P(x, y, 'aur', 3)
    c.P(7, 6, 'snow', 6)
    c.HL(2, 31, 12, 'ink', 1)


@R.add('ice-pillar', '얼음 기둥(위가 잘린 단면이 보인다)', 1, 2, 'column', tags=['얼음 동굴', '기둥', '얼음'], rules='얼음 동굴 넓은 방에 2~4 칸 간격. 둘레 1칸 통로.')
def _(c):
    # 몸통(윗면보다 확실히 짙게, 왼쪽 반사)
    for y in range(7, 28):
        for x in range(2, 14):
            u = (x - 2 + 0.5) / 12
            t = 4 if u < 0.22 else 3 if u < 0.5 else 2 if u < 0.8 else 1
            if (x * 2 + y) % 11 == 0: t -= 1
            if x == 4 and y % 6 not in (0, 1): t = 5
            c.P(x, y, 'ice', max(0, t))
    for (x, y) in ((6, 14), (9, 19), (5, 23), (10, 11)): c.P(x, y, 'ice', 5)
    c.ell(8, 28, 7.5, 2.8, lambda X, Y, dx, dy, d: ('ice', 3 if dx < 0 else 2) if dy > -0.4 else None)
    c.ell(8, 27, 6.5, 1.5, lambda X, Y, dx, dy, d: ('snow', 4 if dx < 0 else 3) if dy > 0 else None)
    # 위 잘린 단면(윗면 10행, 밝게) + 앞 가장자리 아래 짙은 그늘 줄
    c.ell(8, 7.5, 6, 4.5, lambda X, Y, dx, dy, d: ('ice', 1) if dy > 0.3 else None)
    def top(X, Y, dx, dy, d):
        if d > 0.8: return ('ice', 4 if dy < 0 else 6)
        if 0.4 < d < 0.55: return ('ice', 5)
        return ('ice', 6 if dx + dy < -0.3 else 5)
    c.ell(8, 6, 6, 4.8, top)
    c.P(6, 5, 'ice', 4); c.P(9, 7, 'ice', 4)
    c.HL(1, 31, 14, 'ink', 1)


@R.add('frozen-chest', '얼음에 갇힌 궤짝', 1, 1, 'box', tags=['얼음 동굴', '보물', '궤짝'], rules='얼음 동굴 막다른 방. 앞(남쪽) 1칸 비움.')
def _(c):
    box3(c, 0, 1, 16, 7, 7, 'ice', tt=5, ft=3)
    # 얼음 속 궤짝(흐리게): 뚜껑(윗면) + 앞면 + 쇠띠
    c.R(3, 3, 10, 3, 'log', 3); c.HL(3, 3, 10, 'log', 2)
    c.R(3, 9, 10, 5, 'log', 2); c.HL(3, 9, 10, 'log', 1)
    for x in (5, 10): c.VL(x, 3, 3, 'iron', 3); c.VL(x, 9, 5, 'iron', 2)
    c.P(7, 10, 'brass', 2); c.P(8, 10, 'brass', 2)
    # 얼음 반사 줄
    for (x0, y0) in ((2, 2), (9, 2), (1, 9), (8, 9)):
        c.P(x0, y0, 'ice', 6); c.P(x0 + 1, y0 + 1, 'ice', 6)
    c.HL(0, 7, 16, 'ice', 6)
    c.HL(0, 15, 16, 'ink', 1)


@R.add('stalagmite-ice', '얼음 석순', 1, 1, 'organic', tags=['얼음 동굴', '석순', '얼음'], rules='얼음 동굴 바닥 가장자리에 2~5 개 덩이로.')
def _(c):
    c.ell(8, 13.5, 6.5, 2, lambda X, Y, dx, dy, d: ('snow', 4 if dx < 0 else 3))
    shard(c, 7, 14, 12, 6, lean=0.3)
    shard(c, 12, 14, 6, 3, lean=0.6)
    c.HL(2, 15, 12, 'ink', 1)


# ═══════════════════════ 회관 ═══════════════════════
@anim('firepit', '회관 가운데 화덕(돌 둘레 + 장작불)', 3, 2, 2, 'container', tags=['회관', '화덕', '불'], rules='긴 회관 가운데(벽에서 떨어진 바닥). 둘레 1칸 비움, 긴 잔칫상은 남북으로 2칸 띄워.', fps=6)
def firepit(c, f):
    cx, cy, RX, RY = 16, 14, 15, 11
    # 앞 두께(돌 둘레 옆면)
    c.ell(cx, cy + 3, RX, RY, lambda X, Y, dx, dy, d: ('stone', 2 if dx < 0.3 else 1) if dy > 0 else None)
    # 돌 둘레(위에서 본 고리) — 돌 14 개, 왼쪽 위가 밝다
    def ring(X, Y, dx, dy, d):
        if d < 0.5: return None
        a = math.atan2(dy, dx)
        k = int((a + math.pi) / (2 * math.pi) * 14)
        a0 = (k + 0.5) / 14 * 2 * math.pi - math.pi
        if abs(((a - a0 + math.pi) % (2 * math.pi)) - math.pi) > 0.18 and (d < 0.53 or d > 0.95): return ('stone', 1)
        if abs(((a - a0 + math.pi) % (2 * math.pi)) - math.pi) > 0.19: return ('stone', 1)
        lit = -math.cos(a + math.pi / 4)
        t = 6 if lit > 0.5 else 5 if lit > -0.2 else 4
        if d > 0.88: t -= 1
        return ('stone', t)
    c.ell(cx, cy, RX, RY, ring)
    # 안쪽: 재 + 숯 + 안 벽(뒤쪽 돌 안면은 불빛에 붉게)
    def pit(X, Y, dx, dy, d):
        if dy < -0.55: return ('stone', 2) if (X + Y) % 3 else ('fire', 1)
        r = h32(X, Y, 120 + f)
        if r % 7 == 0: return ('fire', 2)
        return ('stone', 1) if r % 3 else ('ink', 2)
    c.ell(cx, cy, RX * 0.5, RY * 0.5, pit)
    c.R(10, 15, 12, 2, 'log', 2); c.HL(10, 15, 12, 'log', 3)
    c.line(11, 11, 21, 17, 'log', 3); c.line(12, 11, 22, 17, 'log', 1)
    flames(c, 11, 15, 10, f, hmax=7, s=9)
    c.ell(cx, cy + 3, RX, RY, lambda X, Y, dx, dy, d: ('ink', 1) if d > 0.86 and dy > 0.45 else None)


# ═══════════════════════ 실루엣 테두리 ═══════════════════════
GLOW = {'ink', 'lit', 'fire', 'smoke'}


def rim(c):
    """실루엣 가장자리(위·옆, 4이웃 투명)를 제 재질 가장 어두운 단으로 — 나무 바닥 위에서도 가구 윤곽이 서게."""
    m0 = c.m.copy(); pts = []
    for y in range(c.h):
        for x in range(c.w):
            if m0[y, x] < 0: continue
            up = y == 0 or m0[y - 1, x] < 0
            lf = x == 0 or m0[y, x - 1] < 0
            rt = x == c.w - 1 or m0[y, x + 1] < 0
            if up or lf or rt: pts.append((x, y))
    for x, y in pts:
        g = c.get(x, y)
        if g[0] not in GLOW: c.P(x, y, g[0], 0)


for _it in R.items:
    if _it['kind'] not in ('terrain', 'flat'):
        _it['draw'] = (lambda fn: lambda c: (fn(c), rim(c)))(_it['draw'])


# ═══════════════════════ 검수 시트·방 장면 ═══════════════════════
def sheet(path=None, z=3):
    items = [(it['id'], R.render(it).img()) for it in R.items]
    return contact(items, path or os.path.join(OUT, 'interior', 'preview.png'), z=z, W=2000, bg=(58, 52, 56))


def compose(plan, legend, pieces):
    """plan: 문자열 줄(한 글자 = 한 칸 지형), legend: 글자 → 지형 id, pieces: [(id, cx, cy)]."""
    H, W = len(plan), len(plan[0])
    S = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    cache = {}
    def img(i):
        if i not in cache: cache[i] = R.render(R.by[i]).img()
        return cache[i]
    for y, row in enumerate(plan):
        for x, ch in enumerate(row): S.alpha_composite(img(legend[ch]), (x * 16, y * 16))
    for (i, cx, cy) in sorted(pieces, key=lambda p: (R.by[p[0]]['kind'] != 'flat', p[2] + R.by[p[0]]['h'])):
        S.alpha_composite(img(i), (cx * 16, cy * 16))
    return S


SCENES = {
    'cabin': ([
        'CCCCCCCCCCCCCC',
        'CuuuWuuuuuWuuC',
        'CdddVddddddVdC',
        'CppppppppppppC',
        'CppppppppppppC',
        'CppppppppppppC',
        'CppppppppppppC',
        'CppppppppppppC',
        'CppppppppppppC',
        'CCCCCCCCCCCCCC',
    ], {'C': 'ceiling', 'u': 'wall-log-u', 'd': 'wall-log-d', 'W': 'wall-window-u', 'V': 'wall-window-d', 'p': 'floor-plank'},
        [('hearth', 6, 2), ('rug-fur', 6, 4), ('stool', 5, 4), ('bed-fur', 1, 3), ('chest', 1, 6), ('antler-mount', 7, 1),
         ('shelf', 8, 1), ('drying-herbs', 12, 1), ('long-table', 8, 5), ('bench', 8, 4), ('bench', 9, 7),
         ('water-bucket', 12, 4), ('cauldron-in', 11, 3), ('lantern', 3, 2), ('stool', 11, 6)]),
    'cave': ([
        'IIIIIIIIIIII',
        'IuuuuuuuuuuI',
        'IddddddddddI',
        'IffffffffffI',
        'IffffffffffI',
        'IffffffffffI',
        'IffffffffffI',
        'IffffffffffI',
        'IIIIIIIIIIII',
    ], {'I': 'ceiling-ice', 'u': 'wall-ice-u', 'd': 'wall-ice-d', 'f': 'floor-ice'},
        [('ice-pillar', 3, 4), ('ice-pillar', 8, 4), ('ice-crystal', 1, 2), ('ice-crystal', 10, 5), ('stalagmite-ice', 2, 7),
         ('stalagmite-ice', 9, 3), ('stalagmite-ice', 10, 7), ('frozen-chest', 5, 3), ('lantern', 6, 2)]),
    'hall': ([
        'CCCCCCCCCCCCCCCC',
        'CuuuuuuuuuuuxuuC',
        'CdddddddddddyddC',
        'CppppppppssssssC',
        'CppppppppssssssC',
        'CppppppppssssssC',
        'CppppppppssssssC',
        'CppppppppssssssC',
        'CCCCCCCCCCCCCCCC',
    ], {'C': 'ceiling', 'u': 'wall-plank-u', 'd': 'wall-plank-d', 'x': 'wall-door-u', 'y': 'wall-door-d',
        'p': 'floor-plank', 's': 'floor-stone'},
        [('weapon-rack', 9, 1), ('bunk-bed', 1, 2), ('keg-rack', 5, 2), ('bar-counter', 3, 5), ('stool', 3, 7), ('stool', 5, 7),
         ('firepit', 11, 4), ('sauna-stove', 13, 2), ('lantern', 8, 2), ('sauna-bench', 9, 6)]),
}


def scenes():
    out = []
    for name, (plan, legend, pieces) in SCENES.items():
        S = compose(plan, legend, pieces)
        p = os.path.join(OUT, 'interior', 'scene-%s.png' % name)
        S.save(p); S.resize((S.width * 3, S.height * 3), Image.NEAREST).save(p.replace('.png', '-x3.png'))
        out.append(p)
    return out


if __name__ == '__main__':
    R.export(); sheet(); scenes()
    from palette import check_palette
    bad = {it['id']: check_palette(R.render(it).img()) for it in R.items}
    bad = {k: v for k, v in bad.items() if v}
    print(len(R.items), 'interior', len(ANIM), 'anims', 'palette-bad:', bad or 'none')
