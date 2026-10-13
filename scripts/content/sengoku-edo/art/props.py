#!/usr/bin/env python3
"""sengoku_edo 소품·나무·다리·배 — 3/4 탑뷰(윗면 6행 안팎 밝은 슬래브 + 앞면 한두 단 어둡게), 몸통은 뭉툭하게(가는 기둥 금지).

floor = 걸을 수 있는 아래층 칸(다리 상판) — 굽기가 floor/flat 으로 둔다. walk = 머리 위로 지나가는 칸.
  python3 props.py
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, NT, MI
from arch import clamp, hip_roof, gable_roof, thatch_roof, plaster, beam, lattice, chochin, _tile_px
from kit import Reg, contact, OUT

R = Reg('props')


def P(id_, name, w, h, kind, tags, rules, **meta):
    return R.add(id_, name, w, h, kind, tags=tags, rules=rules, **meta)


def slab(c, x, y, w, top, front, mat, tt=None, back=True):
    """3/4 판: 윗면 top 행(밝게, 뒤 가장자리 어두운 선, 앞 모서리 밝은 선) + 앞면 front 행(왼 빛·오른 그늘) + 윤곽."""
    n = NT[MI[mat]]
    tt = n - 2 if tt is None else tt
    ft = max(1, tt - 2)
    c.R(x, y, w, top, mat, tt)
    if back: c.HL(x, y, w, mat, tt - 2)
    c.HL(x, y + top - 1, w, mat, min(n - 1, tt + 1))
    c.R(x, y + top, w, front, mat, ft)
    c.HL(x, y + top, w, mat, ft - 1)
    if front > 2: c.HL(x, y + top + front - 1, w, mat, max(0, ft - 2))
    c.VL(x, y, top, mat, tt - 1); c.VL(x + w - 1, y, top, mat, tt - 2)
    c.VL(x, y + top, front, mat, min(n - 1, ft + 1)); c.VL(x + w - 1, y + top, front, mat, max(0, ft - 2))
    c.VL(x - 1, y, top + front, 'sumi', 1); c.VL(x + w, y, top + front, 'sumi', 1)
    c.HL(x, y - 1, w, 'sumi', 1); c.HL(x, y + top + front, w, 'sumi', 1)


def cap(c, cx, y, wb, wf, top, front, mat, tt=None, back_t=None):
    """위에서 내려다본 갓·지붕 판: 윗면 = 뒤(위) 폭 wb → 앞 폭 wf 사다리꼴(밝게, 뒤 가장자리 어두운 선, 왼쪽 빛·오른쪽 반 그늘),
    그 아래 앞 띠 front 행(어둡게). 가운데 cx. 윤곽 sumi."""
    n = NT[MI[mat]]
    tt = n - 1 if tt is None else tt
    for j in range(top):
        k = j / max(1, top - 1)
        w = int(round(wb + (wf - wb) * k))
        x0 = int(round(cx - w / 2))
        for i in range(w):
            t = tt if i < w * 0.55 else tt - 1
            if j == 0: t = tt - 3 if back_t is None else back_t
            elif j == top - 1: t = tt
            c.P(x0 + i, y + j, mat, clamp(mat, t))
        c.P(x0 - 1, y + j, 'sumi', 1); c.P(x0 + w, y + j, 'sumi', 1)
    x0 = int(round(cx - wf / 2))
    for j in range(front):
        for i in range(wf):
            c.P(x0 + i, y + top + j, mat, clamp(mat, tt - 3 - (1 if j == front - 1 else 0) - (1 if i > wf * 0.6 else 0)))
        c.P(x0 - 1, y + top + j, 'sumi', 1); c.P(x0 + wf, y + top + j, 'sumi', 1)
    c.HL(int(round(cx - wb / 2)), y - 1, wb, 'sumi', 1)
    c.HL(x0, y + top + front, wf, 'sumi', 1)


def disc(c, cx, cy, rx, ry, band, mat, tt=None, inner=None):
    """위에서 본 둥근(타원) 윗면 + 그 아래 옆면 띠 band 행(원기둥·받침돌·갓). inner=(재질,단)이면 윗면 안쪽을 다른 색(물·재)."""
    n = NT[MI[mat]]
    tt = n - 1 if tt is None else tt
    for xi in range(int(cx - rx), int(cx + rx) + 1):
        dx = (xi + 0.5 - cx) / rx
        if abs(dx) > 1: continue
        yb = cy + ry * math.sqrt(1 - dx * dx)
        for yy in range(int(round(yb)), int(round(yb)) + band):
            t = tt - 2 if dx < -0.35 else tt - 3 if dx < 0.4 else tt - 4
            if yy == int(round(yb)) + band - 1: t -= 1
            c.P(xi, yy, mat, clamp(mat, t))
    def f(X, Y, dx, dy, d):
        if inner and d < 0.62: return inner
        if d > 0.86: return (mat, clamp(mat, tt - 2 if dy < 0 else tt))
        return (mat, clamp(mat, tt if dx < 0.25 else tt - 1))
    c.ell(cx, cy, rx, ry, f)
    # 윤곽
    for xi in range(int(cx - rx) - 1, int(cx + rx) + 2):
        dx = (xi + 0.5 - cx) / rx
        if abs(dx) > 1: continue
        yt = cy - ry * math.sqrt(1 - dx * dx); yb = cy + ry * math.sqrt(1 - dx * dx)
        c.P(xi, int(round(yt)) - 1, 'sumi', 1)
        c.P(xi, int(round(yb)) + band, 'sumi', 1)


def blob(c, cx, cy, rx, ry, mat, base, s=0, rough=0.18):
    """잎 덩이: 왼위 빛 · 오른아래 그늘 · 가장자리 들쭉 · 잎결 점."""
    n = NT[MI[mat]]
    def f(X, Y, dx, dy, d):
        e = d + (rnd(X, Y, s) - 0.5) * rough * 2
        if e > 1.0: return None
        l = -dx * 0.6 - dy * 0.8
        t = base + (2 if l > 0.75 else 1 if l > 0.15 else 0 if l > -0.45 else -1)
        if e > 0.82: t -= 1
        r = rnd(X, Y, s + 5)
        if r < 0.12: t -= 1
        elif r > 0.9: t += 1
        return (mat, clamp(mat, t))
    c.ell(cx, cy, rx, ry, f)


def outline_ramp(c, mats=None):
    """실루엣 가장자리를 자기 램프 0단(나무 덩이 윤곽)."""
    m0 = c.m.copy()
    for y in range(c.h):
        for x in range(c.w):
            if m0[y, x] < 0: continue
            nb = [(x, y - 1), (x, y + 1), (x - 1, y), (x + 1, y)]
            if any(not (0 <= a < c.w and 0 <= b < c.h) or m0[b, a] < 0 for a, b in nb):
                g = c.get(x, y)
                if mats and g[0] not in mats: continue
                c.P(x, y, g[0], 0)


def trunk(c, x, y0, y1, w=4, mat='ki', lean=0.0):
    for y in range(y0, y1):
        k = (y - y0) / max(1, y1 - y0)
        xx = x + int(round(lean * (1 - k) * 6))
        ww = w + (2 if y > y1 - 3 else 0)
        xs = xx - (1 if y > y1 - 3 else 0)
        for i in range(ww):
            t = 4 if i == 0 else 3 if i < ww // 2 else 2
            if (y + i) % 5 == 0: t -= 1
            c.P(xs + i, y, mat, t)
        c.P(xs - 1, y, 'sumi', 1); c.P(xs + ww, y, 'sumi', 1)
    c.HL(x - 2, y1 - 1, w + 4, 'sumi', 1)


# ═══════════════ 나무 ═══════════════
@P('tree-pine', '흑송(구부러진 줄기 + 층진 잎 판)', 3, 3, 'organic', ['나무', '소나무', '정원', '성', '무가'], '정원·성 해자 둘레·무가 저택 앞. 줄기 칸(맨 아랫줄 가운데)만 막힘.')
def _(c):
    # 굽은 줄기
    pts = [(24, 46), (23, 40), (21, 35), (22, 29), (26, 24), (28, 19)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        for k in range(8):
            t = k / 7
            x = round(x0 + (x1 - x0) * t); y = round(y0 + (y1 - y0) * t)
            c.R(x - 2, y, 5, 1, 'ki', 3); c.P(x - 2, y, 'ki', 4); c.P(x + 2, y, 'ki', 1); c.P(x - 3, y, 'sumi', 1); c.P(x + 3, y, 'sumi', 1)
    c.line(22, 33, 12, 27, 'ki', 2); c.line(22, 32, 12, 26, 'ki', 3)
    c.line(27, 22, 36, 18, 'ki', 2)
    # 잎 판(납작한 타원, 위 밝게)
    for cx, cy, rx, ry in ((12, 24, 10, 5), (35, 16, 11, 5.5), (25, 9, 12, 6), (18, 15, 7, 4)):
        blob(c, cx, cy, rx, ry, 'matsu', 3, s=cx * 7 + cy)
    outline_ramp(c, ('matsu',))
    c.HL(19, 47, 10, 'sumi', 1)


@P('tree-pine-small', '작은 소나무(정원 다듬은 솔)', 2, 2, 'organic', ['나무', '소나무', '정원'], '정원 바위 옆·문 양옆.')
def _(c):
    trunk(c, 14, 20, 31, 4)
    for cx, cy, rx, ry in ((9, 17, 7, 4), (22, 12, 8, 4.5), (15, 7, 9, 5)):
        blob(c, cx, cy, rx, ry, 'matsu', 3, s=cx + cy)
    outline_ramp(c, ('matsu',))


@P('tree-cherry', '벚나무(분홍 꽃 둥근 수관)', 3, 3, 'organic', ['나무', '벚나무', '봄', '정원', '강가'], '강가·참배길·성 해자 둘레에 줄지어. 줄기 칸만 막힘.')
def _(c):
    trunk(c, 21, 28, 47, 6)
    c.line(23, 30, 13, 22, 'ki', 2); c.line(25, 30, 35, 21, 'ki', 2)
    for cx, cy, rx, ry in ((14, 18, 12, 10), (33, 17, 13, 10), (24, 11, 14, 10), (24, 24, 10, 6)):
        blob(c, cx, cy, rx, ry, 'sakura', 2, s=cx * 3 + cy)
    outline_ramp(c, ('sakura',))
    for k in range(18):
        x = 6 + h32(k, 1, 3) % 36; y = 4 + h32(k, 2, 3) % 26
        if c.get(x, y) and c.get(x, y)[0] == 'sakura': c.P(x, y, 'sakura', 4)


@P('tree-maple', '단풍나무(붉은 잎 수관)', 3, 3, 'organic', ['나무', '단풍', '가을', '절', '정원'], '절·정원·계곡. 줄기 칸만 막힘.')
def _(c):
    trunk(c, 21, 30, 47, 5)
    c.line(23, 31, 12, 25, 'ki', 2); c.line(24, 31, 36, 24, 'ki', 2)
    for cx, cy, rx, ry in ((12, 21, 11, 8), (35, 19, 12, 9), (24, 12, 14, 10), (24, 26, 8, 5)):
        blob(c, cx, cy, rx, ry, 'momiji', 2, s=cx * 5 + cy)
    outline_ramp(c, ('momiji',))


@P('tree-cedar', '삼나무(곧고 높은 원뿔, 가도 가로수)', 2, 4, 'organic', ['나무', '삼나무', '가도', '신사', '숲'], '가도 양옆에 4~5칸 간격 줄. 신사 숲. 줄기 칸만 막힘.')
def _(c):
    trunk(c, 13, 50, 63, 6)
    for k in range(7):
        y = 6 + k * 7
        rx = 4 + k * 1.6
        blob(c, 16, y + 4, rx, 5, 'matsu', 2 + (1 if k < 2 else 0), s=k * 11, rough=0.12)
    c.P(15, 1, 'matsu', 4); c.P(16, 1, 'matsu', 3); c.R(15, 2, 2, 4, 'matsu', 3)
    outline_ramp(c, ('matsu',))


@P('bamboo', '대숲(곧은 대 여럿 + 잎 덩이)', 2, 3, 'organic', ['대나무', '대숲', '정원', '절', '숲'], '정원 가장자리·절 뒤·마을 뒤 숲 덩이로 여럿.')
def _(c):
    for k, x in enumerate((5, 11, 17, 24)):
        top = 6 + (k * 5) % 9
        for y in range(top, 47):
            c.P(x, y, 'take', 4); c.P(x + 1, y, 'take', 3); c.P(x + 2, y, 'take', 2)
            if (y + k * 3) % 9 == 0: c.HL(x, y, 3, 'take', 5)
        c.VL(x - 1, top, 47 - top, 'sumi', 1); c.VL(x + 3, top, 47 - top, 'sumi', 1)
    for cx, cy, rx, ry in ((8, 9, 8, 6), (22, 7, 9, 6), (15, 18, 9, 5), (26, 22, 6, 5), (5, 24, 5, 4)):
        blob(c, cx, cy, rx, ry, 'take', 3, s=cx * 13 + cy, rough=0.3)
    outline_ramp(c, ('take',))
    c.HL(3, 47, 26, 'sumi', 1)


@P('tree-willow', '수양버들(강가, 늘어진 가지)', 3, 3, 'organic', ['나무', '버들', '강가', '해자'], '강가·해자 둘레, 다리 옆. 줄기 칸만 막힘.')
def _(c):
    trunk(c, 22, 22, 47, 5)
    blob(c, 24, 12, 15, 9, 'take', 3, s=7)
    for k in range(13):
        x = 9 + k * 2.4
        L = 18 + h32(k, 0, 9) % 14
        for j in range(L):
            y = 12 + j
            xx = int(round(x + math.sin(j / 5 + k) * 0.8))
            c.P(xx, y, 'take', 4 if j < L // 2 else 3); c.P(xx + 1, y, 'take', 2)
    outline_ramp(c, ('take',))


@P('azalea', '철쭉 덤불(분홍 꽃)', 1, 1, 'organic', ['덤불', '정원', '꽃'], '정원 바위 둘레·담 밑·길가.')
def _(c):
    blob(c, 8, 9, 7.5, 6.5, 'matsu', 3, s=3)
    outline_ramp(c, ('matsu',))
    for k in range(9):
        x = 3 + h32(k, 1, 5) % 11; y = 4 + h32(k, 2, 5) % 8
        if c.get(x, y): c.P(x, y, 'sakura', 3); c.P(x, y - 1, 'sakura', 4) if c.get(x, y - 1) else None


@P('hedge', '산울타리(다듬은 생울, 1칸)', 1, 1, 'organic', ['울타리', '생울', '농촌', '정원'], '농가·정원 둘레에 가로로 잇는다.')
def _(c):
    for x in range(16):
        top = 2 + (h32(x // 3, 0, 7) % 2)
        for y in range(top, 15):
            t = 4 if y < top + 4 else 3 if y < 11 else 2
            r = rnd(x, y, 3)
            if r < 0.15: t -= 1
            elif r > 0.88: t += 1
            c.P(x, y, 'matsu', clamp('matsu', t))
        c.P(x, top - 1, 'matsu', 0)
    c.HL(0, 15, 16, 'sumi', 1)


@P('rock-big', '정원석(큰 바위)', 2, 2, 'organic', ['바위', '정원', '절'], '자갈 정원 가운데·연못가. 둘레에 이끼.')
def _(c):
    def f(X, Y, dx, dy, d):
        l = -dx * 0.5 - dy * 0.9
        t = 3 + (2 if l > 0.5 else 1 if l > -0.1 else 0 if l > -0.6 else -1)
        if rnd(X, Y, 4) < 0.1: t -= 1
        if dy < -0.35 and rnd(X // 2, Y // 2, 8) < 0.3: return ('kusa', 3)
        return ('ishi', clamp('ishi', t))
    c.poly([(3, 26), (5, 12), (12, 4), (22, 5), (29, 13), (30, 27)], lambda x, y: f(x, y, (x - 16) / 14, (y - 15) / 11, 0))
    outline_ramp(c)


@P('rock-small', '작은 돌 무리', 1, 1, 'organic', ['바위', '정원'], '정원·길가 바위 둘레.')
def _(c):
    for cx, cy, rx, ry in ((6, 10, 5, 4), (11, 11, 4, 3)):
        c.ell(cx, cy, rx, ry, lambda X, Y, dx, dy, d: ('ishi', 5 if dy < -0.3 and dx < 0.3 else 4 if dy < 0.2 else 2))
    outline_ramp(c)


# ═══════════════ 석물·신사·절 ═══════════════
@P('lantern-stone', '석등(가스가 등롱)', 1, 2, 'column', ['석등', '신사', '절', '정원'], '참배길 양옆에 짝으로·정원. 아랫칸만 막힘.')
def _(c):
    disc(c, 8, 27, 7.5, 3, 2, 'ishi')                 # 받침돌: 위에서 본 넓은 둥근 윗면
    c.R(6, 18, 4, 8, 'ishi', 3); c.VL(6, 18, 8, 'ishi', 5); c.VL(9, 18, 8, 'ishi', 1); c.VL(5, 18, 8, 'sumi', 1); c.VL(10, 18, 8, 'sumi', 1)
    disc(c, 8, 17, 6, 2.6, 2, 'ishi')                 # 중대
    c.R(5, 11, 6, 4, 'ishi', 3); c.R(6, 11, 4, 3, 'hi', 2); c.R(6, 11, 2, 2, 'hi', 3)
    c.VL(4, 11, 4, 'sumi', 1); c.VL(11, 11, 4, 'sumi', 1)
    disc(c, 8, 6, 7.5, 4.2, 2, 'ishi')                # 갓: 위에서 본 큰 타원 윗면(9행)
    for x, y in ((8, 4), (4, 6), (12, 6), (8, 9), (6, 5), (10, 5)): c.P(x, y, 'ishi', 4)
    c.R(7, 0, 2, 3, 'ishi', 6); c.P(8, 1, 'ishi', 4)



@P('lantern-snow', '눈보기 석등(유키미, 넓은 갓)', 2, 2, 'column', ['석등', '정원', '연못'], '연못가·정원 물가.')
def _(c):
    for x in (8, 22):                                 # 다리 + 발돌(둥근 윗면)
        c.R(x, 19, 3, 8, 'ishi', 3); c.VL(x, 19, 8, 'ishi', 5); c.VL(x - 1, 19, 8, 'sumi', 1); c.VL(x + 3, 19, 8, 'sumi', 1)
        disc(c, x + 1.5, 27, 3.5, 1.6, 2, 'ishi')
    c.R(11, 14, 10, 5, 'ishi', 3); c.R(13, 14, 6, 4, 'hi', 2); c.R(13, 14, 3, 2, 'hi', 3)
    c.VL(10, 14, 5, 'sumi', 1); c.VL(21, 14, 5, 'sumi', 1)
    disc(c, 16, 8, 15, 5, 2, 'ishi')                  # 넓은 갓: 위에서 본 큰 타원 윗면(11행)
    for x, y in ((16, 5), (10, 8), (22, 8), (16, 11), (12, 6), (20, 6)): c.P(x, y, 'ishi', 4)
    c.R(15, 1, 3, 4, 'ishi', 6); c.HL(15, 0, 3, 'sumi', 1); c.VL(14, 1, 4, 'sumi', 1); c.VL(18, 1, 4, 'sumi', 1)



@P('komainu', '고마이누(돌 사자, 받침 위, 오른쪽 봄)', 1, 2, 'figure', ['신사', '석상', '고마이누'], '신사 앞 참배길 양옆(왼쪽에 이것, 오른쪽에 se-komainu-l).')
def _(c):
    komainu(c, False)


@P('komainu-l', '고마이누(돌 사자, 받침 위, 왼쪽 봄)', 1, 2, 'figure', ['신사', '석상', '고마이누'], '신사 앞 참배길 오른쪽.')
def _(c):
    komainu(c, True)


def komainu(c, flip):
    """앉은 돌 사자: 큰 머리 + 곱슬 갈기 + 앞다리 기둥 + 말린 꼬리, 받침 윗면 4행."""
    disc(c, 8, 24, 7.5, 3.6, 4, 'ishi')               # 둥근 받침: 위에서 본 윗면(사자는 뒤쪽에 앉고 앞이 드러난다)
    sh = ['.....aaaa..',
          '....aaaaaa.',
          '...aaaeaaaa',
          '..aaaaaaann',
          '..aaaaaaann',
          't.aaaaaaa..',
          'tt.bbbbbb..',
          'ttbbbbbbbb.',
          '.tbbbbbbbb.',
          '..bbbbbbbb.',
          '..bbbllbll.',
          '..bbbllbll.',
          '.bbbbllbll.',
          '.bbbbbbbbb.',
          '.bbbbbbbbbb',
          '..........']
    for j, row in enumerate(sh):
        for i, ch in enumerate(row):
            if ch == '.': continue
            x = (13 - i) if flip else (2 + i)
            lit = (i < 5) != flip
            if ch == 'a': t = 5 if lit else 4
            elif ch == 'e': c.P(x, 5 + j, 'sumi', 0); continue
            elif ch == 'n': t = 3
            elif ch == 't': t = 4
            elif ch == 'l': t = 6 if lit else 5
            else: t = 4 if lit else 3
            if ch in 'ab' and (i + j) % 3 == 0 and j < 6: t -= 1
            if j < 2 and ch == 'a': t = 6                 # 머리 윗면(갈기 꼭대기)
            c.P(x, 5 + j, 'ishi', t)
    outline_ramp(c)


@P('offering-box', '새전함(나무 상자, 살 덮개)', 2, 1, 'box', ['신사', '절', '새전함'], '신사·절 본전 문 바로 앞 가운데(접근칸 옆, 접근칸을 막지 않게).')
def _(c):
    slab(c, 2, 2, 28, 6, 6, 'ki', 5)
    for x in range(4, 29, 3): c.VL(x, 3, 5, 'ki', 2)
    c.HL(3, 11, 26, 'kuro', 3)


@P('ema-rack', '에마 걸이(작은 지붕 + 나무 판 여럿)', 2, 2, 'frame', ['신사', '에마'], '신사 마당 옆쪽.')
def _(c):
    cap(c, 16, 23, 26, 30, 5, 3, 'ishi')              # 돌 받침: 윗면 5행
    for x in (3, 26):
        c.R(x, 9, 3, 16, 'ki', 3); c.VL(x, 9, 16, 'ki', 5); c.VL(x - 1, 9, 16, 'sumi', 1); c.VL(x + 3, 9, 16, 'sumi', 1)
    for row, y in enumerate((11, 18)):
        cap(c, 16, y - 2, 26, 26, 2, 1, 'ki')        # 가로대 윗면
        for k in range(6):
            x = 5 + k * 4
            c.R(x, y + 1, 3, 4, 'ki', 5); c.HL(x, y + 1, 3, 'ki', 6); c.P(x + 1, y + 2, 'shu' if (k + row) % 3 == 0 else 'ki', 3)
            c.HL(x, y + 5, 3, 'sumi', 1)
    cap(c, 16, 1, 20, 32, 6, 2, 'kawara')             # 작은 지붕: 위에서 본 기와 윗면 6행
    for x in range(2, 30, 3): c.VL(x, 3, 4, 'kawara', 3)



@P('chozuya', '데미즈야(손 씻는 곳, 지붕 + 돌 물확)', 2, 3, 'structure', ['신사', '절', '데미즈야'], '도리이 안쪽 참배길 옆. 둘레 1칸 비움.')
def _(c):
    for x in (3, 26):
        c.R(x, 16, 3, 28, 'ki', 3); c.VL(x, 16, 28, 'ki', 5); c.VL(x - 1, 16, 28, 'sumi', 1); c.VL(x + 3, 16, 28, 'sumi', 1)
    # 돌 물확(윗면 물 + 앞면)
    c.R(6, 30, 20, 6, 'ishi', 5); c.HL(6, 30, 20, 'ishi', 6)
    c.R(8, 31, 16, 4, 'mizu', 4); c.HL(8, 31, 16, 'mizu', 2); c.HL(9, 33, 6, 'mizu', 6)
    c.R(6, 36, 20, 7, 'ishi', 3); c.HL(6, 36, 20, 'ishi', 2); c.VL(6, 36, 7, 'ishi', 4)
    c.VL(5, 30, 13, 'sumi', 1); c.VL(26, 30, 13, 'sumi', 1); c.HL(6, 43, 20, 'sumi', 1)
    for k in range(3): c.R(9 + k * 5, 29, 3, 1, 'ki', 4)
    hip_roof(c, 0, 0, 32, 18, inset=6, gable_frac=0.3, curl=3, ridge=4, oni=False)


@P('tsukubai', '츠쿠바이(낮은 돌 물그릇 + 대롱)', 1, 1, 'container', ['정원', '다실', '물'], '다실 앞·정원 디딤돌 끝.')
def _(c):
    c.ell(8, 9, 6.5, 5, lambda X, Y, dx, dy, d: ('ishi', 5 if dy < -0.4 else 4 if dx < 0.3 else 3))
    c.ell(8, 8, 4, 2.6, lambda X, Y, dx, dy, d: ('mizu', 2 if dy < -0.3 else 4))
    c.P(6, 7, 'mizu', 6)
    c.line(13, 2, 9, 6, 'take', 4); c.line(14, 3, 10, 7, 'take', 2)
    outline_ramp(c)


@P('incense', '향로(청동 큰 향로, 다리 셋 + 연기)', 2, 2, 'container', ['절', '향로'], '절 본당 앞 가운데, 접근칸 남쪽 2칸 띄워.')
def _(c):
    slab(c, 4, 24, 24, 3, 4, 'ishi', 5)
    for x in (8, 22): c.R(x, 18, 3, 6, 'dou', 1); c.VL(x, 18, 6, 'dou', 2)
    c.ell(16, 15, 11, 7, lambda X, Y, dx, dy, d: ('dou', 4 if dx < -0.3 else 3 if dx < 0.3 else 2))
    c.ell(16, 10, 9, 3, lambda X, Y, dx, dy, d: ('kuro', 1 if dy > -0.3 else 2))
    c.ell(16, 10, 6, 1.8, lambda X, Y, dx, dy, d: ('shikkui', 2))
    for k, (x, y) in enumerate(((15, 7), (16, 5), (15, 3), (17, 1))): c.P(x, y, 'shikkui', 4 - k % 2)
    outline_ramp(c, ('dou',))


@P('jizo', '지장보살 석상(붉은 턱받이)', 1, 2, 'figure', ['석상', '지장', '가도', '농촌', '절'], '가도 갈림길·마을 어귀·절 담 밑. 둘이나 셋 나란히.')
def _(c):
    disc(c, 8, 24, 7, 3.4, 4, 'ishi')                 # 둥근 받침돌: 위에서 본 윗면(석상은 뒤쪽)
    c.ell(8, 15, 4.5, 6, lambda X, Y, dx, dy, d: ('ishi', 5 if dx < -0.3 else 4 if dx < 0.3 else 3))
    c.ell(8, 6, 3.8, 4, lambda X, Y, dx, dy, d: ('ishi', 6 if dy < -0.2 else 5 if dx < 0 else 4 if dx < 0.4 else 3))
    for j in range(10, 15):
        w = 4 + (j - 10)
        c.HL(8 - w // 2, j, w, 'shu', 4 if j == 10 else 3)
    c.P(7, 7, 'ishi', 2); c.P(9, 7, 'ishi', 2)
    c.R(11, 24, 2, 1, 'shu', 3); c.P(4, 24, 'kusa', 4)



@P('hokora', '길가 작은 사당(호코라, 붉은 문)', 1, 2, 'structure', ['신사', '사당', '농촌', '가도'], '논두렁·가도 갈림길·마을 어귀. 앞에 지장·석등 하나.')
def _(c):
    cap(c, 8, 21, 13, 16, 6, 4, 'ishi')               # 돌 받침: 윗면 6행(사당은 뒤쪽)
    c.R(3, 12, 10, 10, 'ki', 3); c.VL(3, 12, 10, 'ki', 5); c.VL(12, 12, 10, 'ki', 1)
    c.R(5, 14, 6, 7, 'shu', 2); c.VL(8, 14, 7, 'shu', 1); c.HL(5, 14, 6, 'shu', 4)
    c.VL(2, 12, 10, 'sumi', 1); c.VL(13, 12, 10, 'sumi', 1)
    c.R(6, 24, 4, 2, 'shikkui', 4); c.P(7, 23, 'kusa', 4)  # 공물(받침 윗면 위)
    cap(c, 8, 2, 8, 16, 7, 2, 'kawara')               # 지붕: 위에서 본 기와 윗면 7행
    for x in range(2, 15, 3): c.VL(x, 4, 4, 'kawara', 3)
    c.R(7, 0, 2, 2, 'kin', 3)



@P('torii-small', '작은 도리이(붉은, 폭 3)', 3, 3, 'structure', ['신사', '도리이', '농촌'], '작은 사당·여우 신사 앞. 가운데 칸으로 지나간다.',
   walk=[[0, 0], [1, 0], [2, 0], [1, 1], [1, 2], [0, 1], [2, 1]])
def _(c):
    from arch import torii_draw
    torii_draw(c, 48, 48, (5, 37), pw=6)



# ═══════════════ 다리·배·물가 ═══════════════
def bridge(c, h, rail='shu', deck='ki'):
    """남북 다리(폭 4칸 = 난간 칸·상판 두 칸·난간 칸). 상판 가로 판자, 가운데가 밝다(솟은 다리)."""
    H = h * 16
    for y in range(H):
        k = abs(y - H / 2) / (H / 2)
        b = 5 if k < 0.35 else 4 if k < 0.7 else 3
        for x in range(10, 54):
            t = b + (1 if y % 4 == 0 else 0) - (2 if y % 4 == 3 else 0)
            if (x + (y // 4) * 7) % 16 == 0: t -= 1
            c.P(x, y, deck, clamp(deck, t))
        c.P(9, y, 'sumi', 1); c.P(54, y, 'sumi', 1)
        # 난간(양옆): 윗면 난간대 + 기둥
        for x0, s in ((4, 1), (55, -1)):
            for i in range(5):
                xx = x0 + i
                c.P(xx, y, rail, clamp(rail, 4 if i in (1, 2) else 3 if i == 3 else 5 if i == 0 else 2))
            c.P(x0 - 1, y, 'sumi', 1); c.P(x0 + 5, y, 'sumi', 1)
        if y % 12 in (0, 1, 2, 3):
            for x0 in (3, 54):
                c.R(x0, y, 7, 1, rail, 3 if y % 12 else 5)
    for x0 in (3, 54):
        for y in (0, H - 7):
            c.R(x0, y, 7, 7, rail, 3); c.HL(x0, y, 7, rail, 5); c.VL(x0, y, 7, rail, 4)
            if rail == 'shu': c.R(x0 + 2, y + 1, 3, 3, 'kin', 3); c.P(x0 + 2, y + 1, 'kin', 4)
            c.HL(x0, y + 7, 7, 'sumi', 1)


@P('bridge-arch', '붉은 무지개다리(남북으로 건넌다, 강 폭 3)', 4, 5, 'structure', ['다리', '강', '해자', '신사', '성'],
   '동서로 흐르는 강·해자(물 3줄)를 남북으로 건넌다. 가운데 두 칸이 걷는 상판, 양 끝 칸은 난간(막힘). 양끝 줄은 뭍에 닿는다.',
   floor=[[1, j] for j in range(5)] + [[2, j] for j in range(5)])
def _(c):
    bridge(c, 5, 'shu')


@P('bridge-plain', '나무 다리(남북으로 건넌다, 강 폭 3)', 4, 5, 'structure', ['다리', '강', '마을', '가도'],
   '동서 강을 남북으로 건넌다. 가운데 두 칸이 상판, 양 끝 칸은 난간.', floor=[[1, j] for j in range(5)] + [[2, j] for j in range(5)])
def _(c):
    bridge(c, 5, 'ki', 'ki')


@P('boat', '나룻배(작은 목선, 물 위)', 3, 1, 'other', ['배', '강', '나루터'], '강·해자 물 칸 위, 나루터(deck) 옆.')
def _(c):
    for x in range(1, 47):
        d = abs(x - 23.5) / 23
        half = int(round(6 * math.sqrt(max(0, 1 - d ** 3))))
        for y in range(8 - half, 8 + half + 1):
            edge = y in (8 - half, 8 + half)
            if edge: c.P(x, y, 'ki', 5 if y < 8 else 1); continue
            t = 3 if (y < 8) else 2
            if abs(y - 8) < half - 1 and half > 2: t = 4 if x % 6 else 3
            c.P(x, y, 'ki', t)
    for x in (16, 30): c.VL(x, 4, 9, 'ki', 2)
    c.R(32, 6, 6, 4, 'kaya', 4); c.HL(32, 6, 6, 'kaya', 5)
    outline_ramp(c)


@P('boat-cargo', '짐배(쌀섬·지붕 덮은 목선, 물 위)', 4, 2, 'other', ['배', '강', '나루터', '짐'], '강 나루터 옆 물 위.')
def _(c):
    for x in range(1, 63):
        d = abs(x - 31.5) / 31
        half = int(round(8 * math.sqrt(max(0, 1 - d ** 3))))
        for y in range(20 - half, 20 + half + 1):
            edge = y in (20 - half, 20 + half)
            if edge: c.P(x, y, 'ki', 5 if y < 20 else 1); continue
            c.P(x, y, 'ki', 4 if (x % 5) else 3)
    thatch_roof(c, 30, 3, 26, 17, inset=3, ridge=3, eave=3)
    for k in range(4):
        x = 8 + k * 5
        c.R(x, 14, 4, 6, 'kaya', 4); c.HL(x, 14, 4, 'kaya', 6); c.VL(x + 3, 14, 6, 'kaya', 2); c.HL(x, 17, 4, 'kaya', 2)
    outline_ramp(c, ('ki',))


@P('water-wheel', '물레방아(나무 바퀴 + 받침)', 2, 3, 'structure', ['물레방아', '농촌', '강', '물방앗간'], '물방앗간·농가 옆 물길(물 칸) 가장자리.')
def _(c):
    # 축이 동서인 물레방아를 위·앞에서: 바퀴는 좁은 세로 띠(테 + 날개 판 윗면이 줄무늬), 둘레 돌 축대 받침, 위로 들어오는 홈통 물
    disc(c, 16, 41, 13, 3, 3, 'ishi')                 # 물받이 돌 웅덩이(둥근 윗면 + 물)
    c.ell(16, 41, 9, 1.8, lambda *a: ('mizu', 4))
    for y in range(12, 41):
        for x in range(9, 23):
            ph = (y + 1) % 4
            t = 6 if ph == 0 else 5 if ph == 1 else 3 if ph == 2 else 2
            if x in (9, 22): t = 2
            if x in (10, 21): t = 4
            c.P(x, y, 'ki', t)
    for y in range(12, 41): c.P(8, y, 'sumi', 1); c.P(23, y, 'sumi', 1)
    c.R(5, 24, 4, 4, 'ki', 2); c.R(23, 24, 4, 4, 'ki', 2)             # 축 끝
    cap(c, 16, 1, 18, 22, 7, 2, 'ki', 6)              # 홈통: 위에서 본 윗면 7행 + 물
    c.R(10, 3, 12, 4, 'mizu', 4); c.HL(10, 3, 12, 'mizu', 3); c.HL(11, 5, 4, 'mizu', 6)
    for k in range(3): c.P(15 + k, 11, 'mizu', 5)



# ═══════════════ 거리·시장 ═══════════════
@P('stall-food', '포장마차(작은 지붕 + 솥 + 그릇, 야타이)', 2, 2, 'structure', ['시장', '노점', '포장마차', '성하마을'], '큰길 광장·다리 앞·축제 길. 둘레 1칸 비움.')
def _(c):
    for x in (3, 26): c.R(x, 10, 3, 14, 'ki', 2); c.VL(x, 10, 14, 'ki', 4)
    slab(c, 2, 21, 28, 5, 5, 'ki', 5)
    c.ell(10, 22, 4.5, 2.5, lambda X, Y, dx, dy, d: ('kuro', 1 if dy < 0 else 3))
    c.P(9, 21, 'shikkui', 4); c.P(10, 19, 'shikkui', 3)
    for k in range(3): c.R(17 + k * 4, 22, 3, 2, 'shikkui', 4); c.HL(17 + k * 4, 23, 3, 'ai', 2)
    gable_roof(c, 0, 0, 32, 12, ridge=3, oni=False)
    for k in range(4):
        c.R(4 + k * 7, 12, 6, 4, 'ai', 3); c.HL(4 + k * 7, 15, 6, 'ai', 1)
    chochin(c, 26, 12, 'shu', 'kuro', h=6, w=4)


@P('stall-veg', '채소 노점(바구니 넷 + 천 차양)', 2, 2, 'structure', ['시장', '노점', '채소', '성하마을'], '시장 거리·광장 가장자리.')
def _(c):
    for x in (2, 27): c.R(x, 8, 3, 18, 'ki', 2); c.VL(x, 8, 18, 'ki', 4)
    slab(c, 2, 18, 28, 7, 5, 'ki', 5)
    veg = [('kusa', 5), ('momiji', 4), ('kin', 4), ('shikkui', 5)]
    for k, (m, t) in enumerate(veg):
        x = 4 + k * 6
        c.ell(x + 2.5, 21, 3, 2.5, lambda X, Y, dx, dy, d: ('kaya', 3 if dy > 0 else 4))
        c.ell(x + 2.5, 20, 2.4, 1.6, lambda X, Y, dx, dy, d, m=m, t=t: (m, t if dx < 0.3 else t - 1))
    for j in range(9):
        for i in range(32):
            t = 4 if j < 6 else 3
            if (i // 4) % 2: t -= 1
            if j == 0: t = 5
            if j == 8: c.P(i, j, 'sumi', 1); continue
            c.P(i, j, 'kaki', clamp('kaki', t))


@P('stall-fish', '생선 노점(나무 판 + 생선 줄)', 2, 2, 'low_furniture', ['시장', '노점', '생선', '나루터'], '나루터·강가 시장.')
def _(c):
    for x in (4, 25): c.R(x, 24, 3, 7, 'ki', 2); c.HL(x, 31, 3, 'sumi', 1)
    cap(c, 16, 6, 26, 30, 12, 5, 'ki', 6)             # 생선 판: 위에서 본 윗면 12행 + 앞판 5행
    for row in range(3):
        for k in range(4):
            x = 5 + k * 6 + (row % 2) * 2; y = 8 + row * 3
            c.HL(x, y, 4, 'ishi', 6); c.HL(x, y + 1, 5, 'ishi', 4); c.P(x + 4, y, 'ishi', 3); c.P(x, y + 1, 'sumi', 1)
    c.R(4, 17, 6, 1, 'take', 4)
    for k in range(4): c.R(4 + k * 7, 19, 4, 2, 'ki', 3)
    c.ell(28, 20, 3, 2, lambda X, Y, dx, dy, d: ('kaya', 5 if dy < 0 else 3))



@P('bench-red', '붉은 천 평상(찻집 의자)', 2, 1, 'seat', ['평상', '찻집', '쉼터'], '찻집 앞·참배길 쉼터. 처마 밑 1칸 띄워.')
def _(c):
    slab(c, 1, 3, 30, 6, 3, 'shu', 4)
    for x in range(3, 30, 6): c.VL(x, 4, 4, 'shu', 3)
    for x in (3, 26): c.R(x, 12, 3, 3, 'ki', 2); c.HL(x, 15, 3, 'sumi', 1)


@P('bench-parasol', '붉은 양산 평상(노다테 우산)', 2, 3, 'structure', ['평상', '찻집', '쉼터', '양산'], '찻집 앞 마당·정원. 둘레 1칸.')
def _(c):
    slab(c, 1, 35, 30, 6, 3, 'shu', 4)
    for x in (3, 26): c.R(x, 44, 3, 3, 'ki', 2)
    c.R(15, 14, 3, 21, 'ki', 3); c.VL(15, 14, 21, 'ki', 5); c.VL(14, 14, 21, 'sumi', 1); c.VL(18, 14, 21, 'sumi', 1)
    for j in range(12):
        w = 8 + j * 2
        x0 = 16 - w // 2
        for i in range(w):
            t = 5 if j < 4 else 4 if i < w // 2 else 3
            if (i - w // 2) % 5 == 0: t -= 1
            if j == 11: t = 1
            c.P(x0 + i, 3 + j, 'shu', clamp('shu', t))
        c.P(x0 - 1, 3 + j, 'sumi', 1); c.P(x0 + w, 3 + j, 'sumi', 1)
    c.HL(12, 2, 8, 'sumi', 1); c.HL(5, 15, 23, 'sumi', 1)


@P('notice-board', '고찰 게시판(작은 지붕 + 빈 나무 판)', 2, 2, 'structure', ['게시판', '마을', '가도', '성하마을'], '마을 어귀·다리 앞·광장. 판에 글자 없음.')
def _(c):
    for x in (4, 25): c.R(x, 10, 3, 22, 'ki', 3); c.VL(x, 10, 22, 'ki', 5); c.VL(x - 1, 10, 22, 'sumi', 1); c.VL(x + 3, 10, 22, 'sumi', 1)
    c.R(3, 12, 26, 12, 'ki', 5)
    for k in range(4):
        c.R(5 + k * 6, 13, 5, 10, 'washi', 3); c.HL(5 + k * 6, 13, 5, 'washi', 2)
    c.HL(3, 24, 26, 'ki', 2); c.HL(3, 25, 26, 'sumi', 1)
    gable_roof(c, 0, 0, 32, 12, ridge=3, oni=False)


@P('street-lantern', '길가 등롱(나무 기둥 사각 등)', 1, 2, 'column', ['등롱', '가도', '성하마을', '다리'], '큰길·다리 끝·참배길. 5~6칸 간격.')
def _(c):
    disc(c, 8, 28, 6, 2.2, 2, 'ishi')                 # 둥근 돌 받침
    c.R(6, 16, 4, 11, 'ki', 3); c.VL(6, 16, 11, 'ki', 5); c.VL(9, 16, 11, 'ki', 1); c.VL(5, 16, 11, 'sumi', 1); c.VL(10, 16, 11, 'sumi', 1)
    c.R(3, 10, 10, 6, 'washi', 3); c.R(4, 10, 4, 5, 'hi', 3); c.R(8, 10, 4, 5, 'washi', 2)
    c.VL(3, 10, 6, 'ki', 4); c.VL(12, 10, 6, 'ki', 2); c.VL(2, 10, 6, 'sumi', 1); c.VL(13, 10, 6, 'sumi', 1); c.HL(3, 16, 10, 'sumi', 1)
    disc(c, 8, 5, 7.5, 4, 2, 'kawara')                # 갓 지붕: 위에서 본 큰 타원 윗면(9행)
    for x, y in ((8, 3), (5, 5), (11, 5), (8, 7)): c.P(x, y, 'kawara', 3)
    c.R(7, 0, 2, 2, 'kawara', 6)



@P('sake-barrels', '술통 더미(짚 두른 통 셋)', 2, 2, 'round_body', ['술통', '술도가', '가게', '나루터'], '술도가 앞·나루터 짐.')
def _(c):
    for cx, cy in ((9, 22), (23, 22), (16, 11)):
        for y in range(cy - 5, cy + 7):
            for x in range(cx - 7, cx + 7):
                dx = (x - cx + 0.5) / 7
                t = 5 if dx < -0.4 else 4 if dx < 0.3 else 3
                if y in (cy - 1, cy + 4): t = 2
                c.P(x, y, 'kaya', t)
        c.ell(cx, cy - 5, 7, 3, lambda X, Y, dx, dy, d: ('ki', 5 if d < 0.5 else 4))
        c.ell(cx, cy - 5, 4, 1.6, lambda X, Y, dx, dy, d: ('ki', 6))
        c.R(cx - 2, cy + 1, 4, 3, 'shikkui', 4)
    outline_ramp(c)


@P('rice-bales', '쌀섬 더미(짚 섬 다섯)', 2, 2, 'round_body', ['쌀섬', '곡식', '쌀가게', '농가', '창고'], '쌀가게 앞·창고 옆·농가 마당.')
def _(c):
    """선 쌀섬 넷(뒤 둘·앞 둘): 위에서 보이는 둥근 짚 뚜껑(타원 5행) + 새끼줄 띠 몸통."""
    def bale(cx, top, body):
        for y in range(top + 2, top + 2 + body):
            for x in range(cx - 6, cx + 7):
                dx = (x - cx + 0.5) / 6.5
                t = 5 if dx < -0.4 else 4 if dx < 0.3 else 3
                if (y - top) % 4 == 0: t = 2
                c.P(x, y, 'kaya', t)
        c.ell(cx + 0.5, top + 2, 6.5, 2.6, lambda X, Y, dx, dy, d: ('kaya', 6 if d < 0.55 else 5 if dx < 0.3 else 4))
        c.P(cx, top + 2, 'kaya', 3); c.P(cx + 1, top + 2, 'kaya', 3)
    bale(9, 0, 11); bale(23, 1, 10)
    bale(8, 13, 12); bale(22, 14, 11)
    outline_ramp(c)



@P('bucket-stack', '방화 물통 더미(받침 위 통 여섯)', 1, 1, 'round_body', ['물통', '방화', '성하마을'], '상가 처마 밑·골목 어귀.')
def _(c):
    def bucket(cx, cy):
        disc(c, cx, cy, 3.5, 2.2, 4, 'ki', 6, inner=('mizu', 4))
        c.HL(int(cx - 3), int(cy + 4), 7, 'kuro', 2)
    bucket(8, 3)
    bucket(4.5, 9); bucket(11.5, 9)



@P('palanquin', '가마(카고, 지붕 덮은 상자 + 장대)', 2, 1, 'box', ['가마', '가도', '무가', '여관'], '여관·무가 대문 앞 마당.')
def _(c):
    c.R(0, 9, 32, 2, 'ki', 4); c.HL(0, 9, 32, 'ki', 5); c.HL(0, 11, 32, 'sumi', 1)
    slab(c, 7, 2, 18, 4, 8, 'kuro', 4)
    c.R(10, 7, 12, 5, 'ai', 2); c.R(11, 8, 4, 3, 'washi', 2)


@P('cart', '짐수레(나무 바퀴 둘 + 짐)', 2, 2, 'other', ['수레', '짐', '가도', '농촌', '시장'], '시장·창고 앞·농가 마당.')
def _(c):
    for x in (1, 28):                                 # 바퀴(축이 동서 — 위에서는 좁은 세로 타원 테)
        c.ell(x + 1.5, 18, 2.6, 8, lambda X, Y, dx, dy, d: ('ki', 2) if d < 0.4 else ('ki', 5 if dy < -0.3 else 3 if dy < 0.4 else 1))
    # 짐칸: 위에서 들여다본 열린 상자 — 네 변 테(윗면 밝게) + 안쪽 바닥 판자(깊이 방향 결) + 짧은 앞판
    x0, y0, w, h = 4, 4, 24, 16
    for j in range(h):
        d = int(round(2 * (h - 1 - j) / (h - 1)))
        for i in range(d, w - d):
            rim = j < 2 or j >= h - 2 or i - d < 2 or w - d - 1 - i < 2
            if rim: t = 6 if j < h - 2 else 5
            else: t = 3 if (i - d) % 5 == 4 else 4
            c.P(x0 + i, y0 + j, 'ki', t)
        c.P(x0 + d - 1, y0 + j, 'sumi', 1); c.P(x0 + w - d, y0 + j, 'sumi', 1)
    c.HL(x0 + 2, y0 - 1, w - 4, 'sumi', 1)
    c.R(x0, y0 + h, w, 4, 'ki', 2); c.HL(x0, y0 + h, w, 'ki', 3); c.HL(x0, y0 + h + 4, w, 'sumi', 1)
    c.VL(x0 - 1, y0 + h, 4, 'sumi', 1); c.VL(x0 + w, y0 + h, 4, 'sumi', 1)
    for k in range(2):                                # 실은 쌀섬(둥근 끝 윗면)
        disc(c, 11 + k * 9, 9, 3.5, 2, 4, 'kaya', 6)
    for x in (10, 20): c.R(x, 25, 2, 6, 'ki', 3); c.HL(x, 31, 2, 'sumi', 1)



@P('firewood', '장작더미(쌓은 장작 + 짚 덮개)', 2, 1, 'organic', ['장작', '농가', '대장간'], '농가·대장간 벽 옆.')
def _(c):
    for row in range(3):
        for k in range(5):
            cx = 4 + k * 6 + (3 if row % 2 else 0); cy = 13 - row * 4
            if cx > 28: continue
            c.ell(cx, cy, 3, 2.4, lambda X, Y, dx, dy, d: ('tsuchi', 5) if d < 0.35 else ('ki', 3 if dx < 0.3 else 2))
    for i in range(2, 30):
        c.P(i, 2, 'kaya', 5); c.P(i, 3, 'kaya', 4)
    outline_ramp(c)


@P('haystack', '볏짚 더미(니오, 둥근 짚가리)', 1, 2, 'organic', ['볏짚', '농촌', '논'], '논 둘레·농가 마당. 둘이나 셋.')
def _(c):
    for y in range(4, 31):
        k = (y - 4) / 26
        hw = 2 + 5.5 * min(1, k * 1.8) if k < 0.85 else 6.5
        for x in range(int(8 - hw), int(8 + hw)):
            dx = (x - 8 + 0.5) / hw
            t = 6 if dx < -0.5 else 5 if dx < 0 else 4 if dx < 0.5 else 3
            if (y % 4 == 0): t -= 1
            c.P(x, y, 'kaya', clamp('kaya', t))
    c.R(6, 1, 4, 4, 'kaya', 2); c.HL(6, 1, 4, 'kaya', 4)
    outline_ramp(c)


@P('rice-rack', '볏단 걸이(하사, 나무 틀 + 볏단)', 3, 2, 'frame', ['볏단', '논', '농촌', '가을'], '가을 논두렁 옆. 길을 막지 않게 논 쪽에.')
def _(c):
    for x in (3, 23, 43):                             # 기둥: 둥근 꼭대기 윗면
        c.R(x, 4, 4, 24, 'ki', 3); c.VL(x, 4, 24, 'ki', 5); c.VL(x - 1, 4, 24, 'sumi', 1); c.VL(x + 4, 4, 24, 'sumi', 1)
        disc(c, x + 2, 4, 2.5, 1.4, 1, 'ki', 6)
        disc(c, x + 2, 28, 3.5, 1.5, 2, 'tsuchi', 4)
    for k in range(10):                               # 가로대에 걸친 볏단: 위에서 보면 ∧ 꼴로 넘긴 짚 묶음 윗면(밝게) + 늘어진 앞쪽
        x = 1 + k * 5
        for j in range(5):                            # 윗면(가로대 위로 넘긴 등)
            for i in range(4):
                c.P(x + i, 7 + j, 'kaya', 6 if j < 3 and i < 3 else 5)
        c.HL(x, 6, 4, 'sumi', 1)
        for j in range(12, 22):
            for i in range(4):
                t = 4 if i < 2 else 3
                if j > 18: t = 2 if (i + j) % 2 else 3
                c.P(x + i, j, 'kaya', t)
        c.VL(x + 4, 7, 15, 'kaya', 1)
    c.HL(0, 22, 48, 'sumi', 1)



@P('well', '우물(나무 정자 틀 + 두레박)', 2, 2, 'container', ['우물', '마을', '농촌', '성하마을'], '골목 마당·농가 마당·절 부엌 옆. 둘레 1칸 비움.')
def _(c):
    # 우물 틀(이게타): 윗면 판자 + 안 물
    c.R(3, 12, 26, 13, 'ki', 5)
    c.R(7, 14, 18, 9, 'sumi', 0); c.R(8, 16, 16, 6, 'mizu', 2); c.HL(9, 17, 5, 'mizu', 4)
    c.HL(3, 12, 26, 'ki', 3); c.VL(3, 12, 13, 'ki', 4); c.VL(28, 12, 13, 'ki', 2)
    c.R(3, 25, 26, 5, 'ki', 3); c.HL(3, 25, 26, 'ki', 2); c.HL(3, 29, 26, 'ki', 1)
    c.VL(2, 12, 18, 'sumi', 1); c.VL(29, 12, 18, 'sumi', 1); c.HL(3, 30, 26, 'sumi', 1); c.HL(3, 11, 26, 'sumi', 1)
    # 도르래 틀
    for x in (5, 24): c.R(x, 2, 3, 10, 'ki', 3); c.VL(x, 2, 10, 'ki', 5)
    c.R(4, 1, 24, 3, 'ki', 4); c.HL(4, 1, 24, 'ki', 6); c.HL(4, 4, 24, 'sumi', 1)
    c.R(14, 4, 4, 3, 'ki', 2)
    c.R(19, 22, 6, 5, 'ki', 4); c.HL(19, 22, 6, 'ki', 6)


@P('pots', '항아리 무리(물독·장독)', 2, 1, 'container', ['항아리', '농가', '부엌', '가게'], '농가·가게 뒤뜰·부엌 문 옆.')
def _(c):
    for cx, rx, top in ((9, 7, 0), (23, 6, 4)):
        for y in range(top + 3, 15):
            k = (y - top) / (15 - top)
            hw = rx * (0.85 + 0.3 * math.sin(k * math.pi))
            for x in range(int(cx - hw), int(cx + hw) + 1):
                dx = (x - cx) / max(1, hw)
                c.P(x, y, 'tsuchi', 4 if dx < -0.4 else 3 if dx < 0.3 else 2)
        # 아가리: 위에서 본 둥근 테 + 안쪽 물(5행)
        c.ell(cx, top + 3, rx * 0.85, 2.8, lambda X, Y, dx, dy, d: ('tsuchi', 5) if d > 0.62 else ('mizu', 2 if dy < 0 else 3))
    outline_ramp(c)



@P('fence-bamboo', '대 울타리(겐닌지 담, 1칸)', 1, 2, 'structure', ['울타리', '대나무', '정원', '다실'], '정원·다실 둘레, 가로로 잇는다.')
def _(c):
    for x in range(16):
        for y in range(9, 28):
            k = x % 4
            t = 5 if k == 0 else 4 if k == 1 else 3 if k == 2 else 1
            if y in (15, 22): t = 2
            c.P(x, y, 'kaya', t)
    for y in (15, 22): c.HL(0, y, 16, 'kuro', 3)
    # 윗 덮개: 위에서 본 쪼갠 대 갓 윗면 6행(깊이 방향 줄 + 둥근 대 끝 단면)
    c.HL(0, 1, 16, 'sumi', 1)
    for y in range(2, 8):
        for x in range(16):
            t = 2 if y == 2 else 5 if y < 6 else 4
            if x % 4 == 3 and 2 < y < 7: t = 3
            c.P(x, y, 'take', t)
    for x in (1, 9): c.ell(x + 2, 4.5, 1.6, 1.2, lambda *a: ('take', 2))
    c.HL(0, 8, 16, 'take', 1)
    c.HL(0, 28, 16, 'kaya', 1); c.HL(0, 29, 16, 'sumi', 1)



@P('stepping-stones', '디딤돌(정원 징검돌)', 1, 1, 'flat', ['디딤돌', '정원', '다실'], '이끼·자갈 위에 문·다실까지 한 줄로. 걸을 수 있다.')
def _(c):
    for cx, cy, rx, ry in ((5, 5, 4, 3), (11, 11, 4.5, 3)):
        c.ell(cx, cy, rx, ry, lambda X, Y, dx, dy, d: ('ishi', 5 if dy < -0.2 else 4 if d < 0.7 else 3))
        c.ell(cx, cy + ry - 0.5, rx - 0.5, 0.8, lambda X, Y, dx, dy, d: ('ishi', 2))


def sheet(path=None, z=3):
    items = [(it['id'], R.render(it).img()) for it in R.items]
    return contact(items, path or os.path.join(OUT, 'props', 'preview.png'), z=z, W=2100)


if __name__ == '__main__':
    R.export(); sheet()
    print(len(R.items), 'props')
