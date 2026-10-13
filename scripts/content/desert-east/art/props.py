#!/usr/bin/env python3
"""desert_east 야외 소품 — 야자·아카시아·덤불·바위, 우물·분수·물통, 바자르 노점 5종, 깔개, 항아리·바구니·자루·상자,
등잔 기둥·화로·돌 벤치, 낙타·수레, 울타리·말뚝·깃대·염색 건조대, 기둥·쓰러진 돌·사자 석상·비석·이정표·모닥불.

화법: 투명 배경, 같은 램프 최암 단 윤곽(outline), 접지 아랫줄 어둡게, 빛 왼쪽 위. 서 있는 것은 윗면(뚜껑·아가리·판·등)이 위에서 보인다.
  python3 props.py
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, NT, MI
from kit import Reg, contact, OUT
import bparts as BP

R = Reg('props')


def P_(id_, name, w, h, kind, tags=(), rules='', **kw):
    return R.add(id_, name, w, h, kind, tags=tags, rules=rules, **kw)


def top(m): return NT[MI[m]] - 1


def finish(c, bottom=True):
    c.outline(bottom=None if not bottom else None)


# ═════════════ 식물 ═════════════
def frond(c, x0, y0, ang, L, droop, s, light):
    """야자 잎 하나: 위로 솟았다 바깥으로 휘어 처지는 중맥(포물선) + 중맥 아래로 늘어진 잎살 줄(바깥으로 비스듬히).
    ang: 수평 방향(라디안, cos 부호 = 좌우), droop: 처짐 세기."""
    dirx = math.cos(ang); up = max(0.15, -math.sin(ang))
    prev = None
    for k in range(L):
        u = k / max(1, L - 1)
        x = x0 + dirx * k * 1.05
        y = y0 - up * k * 0.9 + droop * (k * k) / L
        X, Y = int(round(x)), int(round(y))
        # 잎살: 중맥 아래로 2~4화소, 바깥쪽으로 1화소 기울기
        hang = 1 + int(4.2 * math.sin(min(1.0, u * 1.25) * math.pi * 0.92))
        for d in range(1, hang + 1):
            t = 3 + light - (1 if d == hang else 0)
            if k % 2 == 1: t -= 1
            c.P(X + int(round(dirx * d * 0.5)), Y + d, 'palm', max(0, min(5, t)))
        c.P(X, Y, 'palm', max(0, min(5, 4 + light)))
        if prev and abs(prev[1] - Y) > 1: c.P(X, (Y + prev[1]) // 2, 'palm', max(0, min(5, 4 + light)))
        prev = (X, Y)


def palm(c, bx, by, height, lean, crown_r, s=0, dates=True, light=0):
    """대추야자: 휜 줄기(마디 띠) + 왕관 잎 9~11장 + 대추 송이."""
    # 줄기
    top_x, top_y = bx + lean, by - height
    for k in range(height + 1):
        u = k / height
        x = bx + lean * (u ** 1.6); y = by - k
        wide = 1 if k < 5 else 0
        for d in range(-2 - wide, 3 + wide):
            X = int(round(x)) + d
            t = 3 if d < 0 else 2 if d == 0 else 1
            if d == -2: t = 2
            if d == 2: t = 0
            if k % 3 == 0: t = max(0, t - 1)                     # 마디 띠
            if k % 3 == 1 and d == -1: t = 4
            c.P(X, y, 'hide', t)
    # 잎(뒤쪽 먼저 — 짧고 어둡게, 앞쪽 길고 밝게)
    cx, cy = int(round(top_x)), int(round(top_y))
    back = [(-100, 0.25, -1), (-80, 0.25, -1), (-125, 0.45, -1), (-55, 0.45, -1)]
    front = [(-160, 1.0, 0), (-20, 1.0, 0), (-145, 0.8, 1), (-35, 0.8, 0), (-178, 1.3, 0), (-2, 1.3, -1), (-110, 0.6, 1), (-70, 0.6, 0), (-130, 0.7, 1), (-50, 0.7, 0), (-168, 1.6, -1), (-12, 1.6, -1)]
    for i, (a, dr, li) in enumerate(back + front):
        L = crown_r + (h32(i, 0, s) % 3) - (4 if (a, dr, li) in back else 0)
        frond(c, cx, cy, math.radians(a), L, dr, s, li + light)
    # 가운데 순(밝음) + 대추 송이
    c.ell(cx, cy, 3, 2, lambda x, y, dx, dy, d: ('palm', 4 if dy < 0 else 2))
    if dates:
        for (dx_, dy_) in ((-3, 3), (2, 3)):
            for k in range(5):
                c.P(cx + dx_ + (k % 2), cy + dy_ + k // 2, 'saffron', 3 if k % 2 == 0 else 2)
            c.P(cx + dx_, cy + dy_, 'saffron', 4)


@P_('palm-date', '대추야자(큰)', 2, 3, 'organic', ['야자', '오아시스', '나무'], '오아시스 못가·풀밭·광장 모퉁이. 서로 3칸 이상, 줄 세우지 말고 덩이로.')
def _(c):
    palm(c, 13, 46, 30, 4, 14, s=3)
    c.outline(bottom=('hide', 0))


@P_('palm-young', '어린 야자', 2, 2, 'organic', ['야자', '오아시스'], '큰 야자 곁·못가 빈자리에.')
def _(c):
    palm(c, 15, 30, 13, -2, 11, s=7, dates=False, light=0)
    c.outline(bottom=('hide', 0))


@P_('palm-pair', '대추야자 두 그루', 3, 3, 'organic', ['야자', '오아시스', '나무'], '오아시스 가운데 덩이의 중심.')
def _(c):
    palm(c, 30, 46, 26, 6, 12, s=11, light=-1)
    palm(c, 18, 47, 33, -5, 14, s=13)
    c.outline(bottom=('hide', 0))


@P_('acacia', '우산 아카시아', 3, 3, 'organic', ['나무', '사바나', '사막'], '트인 사막·마을 밖 길가에 한 그루씩. 그늘 밑에 천막·낙타를 둔다.')
def _(c):
    # 갈라진 가는 줄기
    for (x0, y0, x1, y1) in ((24, 46, 22, 30), (22, 30, 14, 18), (22, 30, 31, 17), (23, 34, 27, 22)):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for k in range(n + 1):
            x = round(x0 + (x1 - x0) * k / n); y = round(y0 + (y1 - y0) * k / n)
            c.P(x, y, 'hide', 2); c.P(x + 1, y, 'hide', 1); c.P(x - 1, y, 'hide', 3) if k % 2 else None
    # 납작한 우산 수관: 윗면(밝은 잎 덩이) + 밑면 그늘 띠
    for y in range(4, 22):
        for x in range(1, 47):
            dx = (x - 24) / 23.0; dy = (y - 12) / 8.5
            if dx * dx + dy * dy * (1.6 if y > 12 else 1) > 1: continue
            n = rnd(x // 3, (y + (x // 3) % 2) // 2, 17)
            if y > 17: t = 1
            elif y > 14: t = 2
            else: t = 3 + (1 if n > 0.55 else 0) + (1 if y < 9 and x < 26 and n > 0.3 else 0) - (1 if n < 0.18 else 0)
            if rnd(x, y, 19) < 0.12: t -= 1
            c.P(x, y, 'palm', max(0, min(5, t)))
    c.outline(bottom=('hide', 0))


@P_('scrub', '사막 덤불', 1, 1, 'organic', ['덤불', '사막', '황무지'], '트인 모래에 2~3개씩 흩어 평평함을 깬다. 길 위에는 두지 않는다.')
def _(c):
    # 둥근 덤불 덩이 셋(마른 올리브 잎) + 밑동 잔가지
    for (cx, cy, rx, ry, sd) in ((5.5, 9, 4.5, 3.8, 1), (10.5, 8.5, 4.8, 4.2, 2), (8, 6, 4.2, 3.4, 3)):
        c.ell(cx, cy, rx, ry, lambda x, y, dx, dy, d, sd=sd: ('palm', (4 if dy < -0.3 and dx < 0.3 else 3 if dy < 0.25 else 2) - (1 if rnd(x, y, 23 + sd) < 0.2 else 0) + (1 if rnd(x, y, 29 + sd) < 0.08 else 0)))
    for x in (4, 7, 9, 12): c.P(x, 13, 'hide', 1); c.P(x, 12, 'hide', 2)
    c.outline(bottom=('hide', 0))


@P_('tuft', '마른 풀 포기', 1, 1, 'organic', ['풀', '마른 풀', '사막'], '모래·자갈밭 곳곳에 드문드문(3~6칸 간격). 걸어 지나갈 수 있다.')
def _(c):
    for k in range(13):
        x0 = 2.5 + k
        hgt = 5 + (h32(k, 0, 29) % 6)
        lean = (k - 6) * 0.45
        for j in range(hgt):
            u = j / hgt
            c.P(int(round(x0 + lean * u)), 13 - j, 'saffron' if u > 0.55 else 'sand', (5 if k % 3 else 4) if u > 0.55 else (2 if k % 2 else 3))
    c.HL(3, 13, 11, 'sand', 1); c.HL(4, 14, 9, 'sand', 2)


@P_('reeds', '물가 갈대', 1, 1, 'organic', ['갈대', '물가', '오아시스'], '못 둘레 풀 띠 위, 물가에 2~4개 무리로.')
def _(c):
    for k in range(7):
        x0 = 3 + k * 1.6; hgt = 8 + h32(k, 2, 31) % 5
        for j in range(hgt):
            c.P(int(x0 + (j / hgt) * (k - 3) * 0.4), 14 - j, 'grass', 3 if k % 2 else 4)
        if k % 2 == 0:
            tx = int(x0 + (k - 3) * 0.4)
            c.R(tx, 14 - hgt - 2, 2, 3, 'hide', 2); c.P(tx, 14 - hgt - 2, 'hide', 4)
    c.HL(3, 14, 11, 'grass', 1)


@P_('oleander', '꽃 핀 협죽도 덤불', 1, 1, 'organic', ['꽃', '덤불', '오아시스', '정원'], '정원·못가·궁전 마당 가장자리.')
def _(c):
    c.ell(8, 9, 7, 5.5, lambda x, y, dx, dy, d: ('grass', 4 if dy < -0.3 and dx < 0.3 else 3 if dy < 0.3 else 2 if d < 0.85 else 1))
    for k in range(9):
        x, y = 3 + h32(k, 0, 37) % 11, 4 + h32(0, k, 37) % 8
        c.P(x, y, 'red', 5); c.P(x + 1, y, 'red', 4); c.P(x, y + 1, 'red', 3)
    c.outline(bottom=('grass', 0))


@P_('aloe', '알로에(가시 풀)', 1, 1, 'organic', ['다육', '사막', '정원'], '바위 곁·집 모퉁이.')
def _(c):
    for k, a in enumerate((-160, -130, -105, -80, -55, -25, -145, -40)):
        L = 7 + (k % 3)
        for j in range(L):
            x = 8 + math.cos(math.radians(a)) * j; y = 13 + math.sin(math.radians(a)) * j * 0.9
            c.P(int(x), int(y), 'palm', 4 if a < -90 else 3); c.P(int(x), int(y) + 1, 'palm', 1)
    c.HL(5, 14, 7, 'palm', 0)


def rock_blob(c, cx, cy, rx, ry, s, mat='rock'):
    """바위: 윗면(밝은 판) + 앞면 그늘 + 갈라짐."""
    c.ell(cx, cy, rx, ry, lambda x, y, dx, dy, d: (mat, (5 if dy < -0.25 and dx < 0.35 else 4 if dy < 0.1 else 3 if dy < 0.45 else 2) - (1 if dx > 0.55 else 0) - (1 if rnd(x, y, s) < 0.1 else 0)))
    for k in range(3):
        x0 = int(cx - rx * 0.6 + k * rx * 0.5); c.line(x0, int(cy - ry * 0.2), x0 + 2, int(cy + ry * 0.5), mat, 1)


@P_('rock-small', '작은 바위', 1, 1, 'organic', ['바위', '사막'], '모래·자갈밭에 흩어. 걸을 수 없다.')
def _(c):
    rock_blob(c, 8, 10, 6, 4.5, 41); c.outline(bottom=('rock', 0))


@P_('boulder', '큰 바위', 2, 2, 'organic', ['바위', '사막', '황무지'], '마을 밖·길 굽이·폐허 곁. 자갈밭(gravel)을 둘레에 깐다.')
def _(c):
    rock_blob(c, 15, 18, 13, 10, 43); rock_blob(c, 24, 24, 6, 5, 44)
    c.outline(bottom=('rock', 0))


@P_('outcrop', '바위 언덕(노두)', 3, 2, 'organic', ['바위', '언덕', '황무지'], '사막 가장자리의 큰 덩이. 둘레에 자갈밭·덤불.')
def _(c):
    # 층진 사암 노두: 평평한 윗면 두 단 + 줄무늬 앞면
    for (x0, y0, w, th, fh, s) in ((4, 6, 26, 6, 12, 45), (20, 12, 26, 5, 12, 46), (0, 16, 20, 4, 10, 47)):
        for j in range(th):
            for i in range(w):
                t = 5 if rnd(x0 + i, y0 + j, s) > 0.1 else 4
                if j == 0: t = 6
                c.P(x0 + i, y0 + j, 'stone', t)
        for j in range(fh):
            for i in range(w):
                t = 3 if (j // 3) % 2 == 0 else 2
                if rnd(i // 2, j, s) < 0.12: t -= 1
                if i == 0: t = 4
                c.P(x0 + i, y0 + th + j, 'stone', t)
    c.outline(bottom=('stone', 0))


@P_('rubble', '돌 부스러기', 1, 1, 'debris', ['폐허', '잔해'], '폐허 벽 발치·무너진 아치 곁에. 걸어 지나갈 수 있다.')
def _(c):
    for k, (x, y, w) in enumerate(((2, 9, 4), (7, 11, 3), (10, 7, 4), (5, 4, 2), (12, 12, 2))):
        c.R(x, y, w, 2, 'stone', 5 if k % 2 == 0 else 6); c.R(x, y + 2, w, 1, 'stone', 2)
        c.P(x + w, y + 1, 'stone', 1)


# ═════════════ 물 ═════════════
@P_('well', '돌 우물(도르래)', 2, 2, 'container', ['우물', '광장', '오아시스'], '광장 가운데·마을 어귀. 둘레 1칸은 비워 둔다.')
def _(c):
    # 둥근 돌 테(윗면 타원 + 안쪽 물) · 앞면 돌 쌓기
    cx, cy = 16, 17
    c.ell(cx, cy, 13, 7, lambda x, y, dx, dy, d: ('stone', 6 if dy < -0.3 else 5))
    c.ell(cx, cy + 0.5, 9, 4.5, lambda x, y, dx, dy, d: ('void', 0) if dy < -0.1 else ('water', 1 if dy < 0.5 else 2))
    c.P(cx - 3, cy + 2, 'water', 4); c.P(cx - 2, cy + 2, 'water', 3)
    for y in range(cy + 1, cy + 13):
        for x in range(cx - 13, cx + 14):
            dx = (x - cx) / 13.5
            if abs(dx) > math.sqrt(max(0, 1 - ((min(y, cy + 6) - cy) / 7.5) ** 2)) and y < cy + 7: continue
            if y < cy + 5 and c.on(x, y): continue
            row = (y - cy) // 3; xs = x + (2 if row % 2 else 0)
            t = 4 if dx < -0.4 else 3 if dx < 0.4 else 2
            if (y - cy) % 3 == 0 or xs % 5 == 0: t = 1
            c.P(x, y, 'stone', t)
    # 도르래 틀(나무 기둥 둘 + 가로대 윗면)
    for px_ in (5, 26):
        c.R(px_, 2, 2, 17, 'wood', 3); c.VL(px_, 2, 17, 'wood', 4); c.VL(px_ + 1, 2, 17, 'wood', 2)
    c.R(4, 1, 25, 3, 'wood', 4); c.HL(4, 1, 25, 'wood', 5); c.HL(4, 3, 25, 'wood', 1)
    c.ell(16, 4, 2.5, 2.5, lambda x, y, dx, dy, d: ('wood', 2 if d > 0.5 else 4))
    c.VL(16, 6, 8, 'hide', 3)
    c.R(14, 13, 5, 4, 'wood', 3); c.HL(14, 13, 5, 'wood', 5); c.HL(15, 14, 3, 'void', 1)
    c.outline(bottom=('stone', 0))


@P_('fountain', '청록 타일 팔각 분수', 3, 3, 'container', ['분수', '광장', '궁전', '정원'], '궁전 마당·광장 한가운데. 둘레 1칸 포석으로 비운다.')
def _(c):
    cx, cy = 24, 24
    # 팔각 테 윗면(밝은 대리석) + 안 물(타원) + 앞면 청록 타일
    def octo(rx, ry):
        return [(cx + rx * math.cos(math.radians(a)), cy + ry * math.sin(math.radians(a))) for a in range(22, 382, 45)]
    c.poly(octo(23, 14), lambda x, y: ('marble', 5 if y < cy - 4 else 4))
    c.poly(octo(19, 11), lambda x, y: ('water', 2 if y < cy - 3 else 3 if y < cy + 4 else 4))
    for k in range(12):
        x = cx - 14 + (h32(k, 0, 51) % 28); y = cy - 6 + (h32(0, k, 51) % 12)
        c.P(x, y, 'water', 5); c.P(x + 1, y, 'water', 4)
    # 앞면 타일 띠(남쪽 둘레 아래로 6줄)
    for x in range(cx - 23, cx + 24):
        yb = None
        for y in range(cy + 14, cy - 1, -1):
            if c.on(x, y): yb = y; break
        if yb is None: continue
        for j in range(1, 7):
            t = 3 if (x + j) % 4 < 2 else 2
            if j == 1: t = 4
            if j == 6: t = 0
            if x > cx + 10: t -= 1
            c.P(x, yb + j, 'turq', max(0, t))
    # 가운데 분수대(작은 받침 + 물줄기)
    c.ell(cx, cy - 1, 5, 3, lambda x, y, dx, dy, d: ('marble', 5 if dy < 0 else 3))
    c.R(cx - 1, cy - 12, 3, 11, 'marble', 4); c.VL(cx + 1, cy - 12, 11, 'marble', 2)
    c.ell(cx, cy - 13, 4, 2, lambda x, y, dx, dy, d: ('marble', 5))
    for k, (dx_, dy_) in enumerate(((-3, -16), (3, -16), (0, -18), (-5, -14), (5, -14))):
        c.P(cx + dx_, cy + dy_, 'water', 5); c.P(cx + dx_, cy + dy_ + 1, 'water', 4)
    c.VL(cx, cy - 18, 5, 'water', 5)
    c.outline(bottom=('turq', 0))


@P_('trough', '돌 물통(구유)', 2, 1, 'container', ['물통', '낙타', '대상'], '우물·대상 숙소 마당·낙타 곁.')
def _(c):
    c.R(1, 2, 30, 6, 'stone', 5); c.HL(1, 2, 30, 'stone', 6)
    c.R(4, 4, 24, 3, 'water', 2); c.HL(4, 4, 24, 'stone', 3); c.HL(6, 5, 6, 'water', 4)
    c.R(1, 8, 30, 6, 'stone', 3); c.HL(1, 8, 30, 'stone', 4); c.VL(30, 8, 6, 'stone', 1)
    for x in range(3, 30, 7): c.VL(x, 9, 4, 'stone', 2)
    c.outline(bottom=('stone', 0))


# ═════════════ 바자르 노점 ═════════════
def stall(c, col, col2, goods, s):
    """노점 2×2: 차양 윗면(줄무늬, 위에서 비스듬히) + 술 + 기둥 + 진열대(윗면 위 물건) + 앞판."""
    BP.awning(c, 1, 2, 30, depth=9, front=3, col=col, col2=col2)
    for px_ in (2, 29):
        c.VL(px_, 13, 13, 'wood', 3); c.VL(px_ + 1, 13, 13, 'wood', 1)
    # 그늘 진 안쪽
    c.R(4, 14, 24, 6, 'void', 2)
    # 진열대 윗면 + 앞판
    c.R(1, 19, 30, 6, 'wood', 4); c.HL(1, 19, 30, 'wood', 5); c.HL(1, 24, 30, 'wood', 3)
    c.R(1, 25, 30, 6, 'wood', 2); c.HL(1, 25, 30, 'wood', 1)
    for x in range(4, 30, 6): c.VL(x, 26, 4, 'wood', 1)
    c.HL(1, 30, 30, 'wood', 0)
    goods(c)


def pots(c):
    for k, x in enumerate(range(3, 28, 6)):
        m = ('adobe', 'turq', 'adobe', 'lapis', 'adobe')[k]
        c.ell(x + 2, 19, 2.6, 3, lambda X, Y, dx, dy, d, m=m: (m, top(m) - 1 if dx < -0.2 else top(m) - 3))
        c.HL(x + 1, 16, 3, m, top(m)); c.P(x + 2, 16, m, 1)


def spices(c):
    for k, x in enumerate(range(3, 28, 6)):
        m = ('saffron', 'red', 'hide', 'palm', 'gold')[k]
        c.R(x, 18, 5, 4, 'hide', 3); c.HL(x, 21, 5, 'hide', 1)
        c.ell(x + 2.5, 18, 2.6, 2, lambda X, Y, dx, dy, d, m=m: (m, top(m) - 1 if dy < 0 else top(m) - 2))


def carpets(c):
    for k, x in enumerate((4, 13, 22)):
        m = ('red', 'lapis', 'indigo')[k]
        c.R(x, 12, 7, 10, m, 2); c.R(x + 1, 13, 5, 8, m, 3); c.R(x + 2, 15, 3, 4, 'saffron', 3); c.HL(x, 12, 7, 'wood', 4)
        for i in range(0, 7, 2): c.P(x + i, 22, 'plaster', 4)
    c.R(3, 19, 26, 3, 'red', 3); c.HL(3, 19, 26, 'red', 4)


def fruit(c):
    for k, x in enumerate(range(3, 28, 6)):
        c.R(x, 18, 5, 3, 'wood', 3); c.HL(x, 18, 5, 'wood', 1)
        m = ('red', 'saffron', 'hide', 'red', 'palm')[k]
        for i in range(5):
            c.P(x + i, 17, m, 4 if i % 2 == 0 else 3); c.P(x + (i % 4), 16, m, 3)


def lanterns(c):
    c.HL(4, 13, 24, 'wood', 2)
    for k, x in enumerate((6, 12, 18, 24)):
        m = ('gold', 'turq', 'gold', 'red')[k]
        c.VL(x + 1, 13, 2, 'rock', 2)
        c.R(x, 15, 3, 4, m, top(m) - 1); c.P(x + 1, 16, 'fire', 4); c.P(x + 1, 17, 'fire', 3); c.HL(x, 19, 3, m, 1); c.P(x + 1, 14, m, top(m))
    for k, x in enumerate(range(4, 28, 7)):
        c.R(x, 19, 4, 3, 'gold', 3); c.HL(x, 19, 4, 'gold', 5)


STALL_RULE = '바자르 길 양옆에 줄로, 앞(남쪽)이 길을 본다. 노점 사이 0~1칸, 노점 앞 1칸은 길. 막힘.'
P_('stall-pottery', '노점(도자기·붉은 차양)', 2, 2, 'structure', ['노점', '바자르', '시장', '도자기'], STALL_RULE)(lambda c: stall(c, 'red', 'plaster', pots, 1))
P_('stall-spice', '노점(향신료·주황 차양)', 2, 2, 'structure', ['노점', '바자르', '시장', '향신료'], STALL_RULE)(lambda c: stall(c, 'saffron', 'plaster', spices, 2))
P_('stall-carpet', '노점(양탄자·청록 차양)', 2, 2, 'structure', ['노점', '바자르', '시장', '양탄자'], STALL_RULE)(lambda c: stall(c, 'turq', 'plaster', carpets, 3))
P_('stall-fruit', '노점(대추·석류·남보라 차양)', 2, 2, 'structure', ['노점', '바자르', '시장', '과일'], STALL_RULE)(lambda c: stall(c, 'indigo', 'plaster', fruit, 4))
P_('stall-lantern', '노점(등잔·놋그릇)', 2, 2, 'structure', ['노점', '바자르', '시장', '등잔'], STALL_RULE)(lambda c: stall(c, 'red', 'saffron', lanterns, 5))


def rug(c, x, y, w, h, col='red', field='saffron', s=0):
    """바닥에 펼친 양탄자(위에서 본 판): 테두리 띠 + 바탕 + 가운데 마름모 + 술."""
    c.R(x, y, w, h, col, 2)
    c.R(x + 1, y + 1, w - 2, h - 2, col, 3)
    c.R(x + 3, y + 3, w - 6, h - 6, field, 2)
    c.R(x + 4, y + 4, w - 8, h - 8, col, 3)
    cx, cy = x + w / 2, y + h / 2
    for j in range(y + 4, y + h - 4):
        for i in range(x + 4, x + w - 4):
            d = abs(i + 0.5 - cx) / (w / 2 - 4) + abs(j + 0.5 - cy) / (h / 2 - 4)
            if d < 0.55: c.P(i, j, field, 4 if d < 0.25 else 3)
            elif d < 0.7: c.P(i, j, col, 4)
    for i in range(x + 1, x + w - 1, 2): c.P(i, y + 2, 'plaster', 4); c.P(i, y + h - 3, 'plaster', 3)
    for j in range(y, y + h, 2): c.P(x - 1, j, 'plaster', 4); c.P(x + w, j, 'plaster', 3)
    c.HL(x, y, w, col, 4); c.HL(x, y + h - 1, w, col, 1)


@P_('rug-red', '펼친 붉은 양탄자', 2, 1, 'flat', ['양탄자', '바자르', '깔개'], '노점 앞·천막 입구·광장 그늘. 걸어 지나간다(바닥 덧그림).')
def _(c): rug(c, 2, 2, 28, 12, 'red', 'saffron')


@P_('rug-blue', '펼친 청색 메달리온 양탄자', 2, 2, 'flat', ['양탄자', '깔개', '궁전'], '정자 천막 앞·궁전 마당 그늘. 걸어 지나간다.')
def _(c): rug(c, 2, 3, 28, 26, 'lapis', 'plaster')


@P_('carpet-rolls', '말아 쌓은 양탄자', 1, 1, 'box', ['양탄자', '바자르', '짐'], '양탄자 노점 곁·대상 짐 더미.')
def _(c):
    for k, (y, m) in enumerate(((10, 'red'), (6, 'lapis'), (2, 'saffron'))):
        x0 = 1 + k
        c.R(x0, y, 13 - k, 4, m, 3); c.HL(x0, y, 13 - k, m, 4); c.HL(x0, y + 3, 13 - k, m, 1)
        c.ell(x0 + 13 - k, y + 2, 1.6, 2, lambda X, Y, dx, dy, d, m=m: (m, 2 if d > 0.4 else 'void' and 4))
        for i in range(x0 + 2, x0 + 12 - k, 3): c.P(i, y + 1, 'plaster', 4)
    c.outline(bottom=('dwood', 0))


# ═════════════ 항아리·바구니·자루·상자 ═════════════
def jar(c, cx, by, rw, h, mat='adobe', neck=3, s=0):
    """항아리: 몸(둥근 명암) + 목 + 아가리(위에서 본 타원, 안 어둡게)."""
    T = top(mat)
    for y in range(by - h, by):
        u = (y - (by - h)) / h
        r = rw * math.sin(math.pi * min(1, 0.25 + u * 0.85)) if u > 0.18 else neck * 0.5 + 1
        for x in range(int(cx - r), int(cx + r) + 1):
            dx = (x + 0.5 - cx) / max(0.6, r)
            t = T - 1 if dx < -0.35 else T - 2 if dx < 0.2 else T - 4 if dx < 0.65 else 1
            if u > 0.85: t -= 1
            c.P(x, y, mat, max(0, t))
    c.ell(cx, by - h, neck, 1.8, lambda x, y, dx, dy, d: (mat, T) if d > 0.45 else ('void', 1))
    c.HL(int(cx - rw * 0.6), by - 1, int(rw * 1.2) + 1, mat, 0)


@P_('jar-big', '큰 물 항아리', 1, 1, 'container', ['항아리', '도자기', '집'], '집 문 옆·노점 곁·우물가. 1~2개.')
def _(c):
    jar(c, 8, 15, 6, 13, 'adobe', neck=4); c.outline(bottom=('adobe', 0))


@P_('jars-group', '항아리 무리', 2, 1, 'container', ['항아리', '도자기', '바자르'], '노점 옆·대상 숙소 마당 벽 앞.')
def _(c):
    jar(c, 8, 15, 6, 12, 'adobe', neck=4)
    jar(c, 18, 15, 4, 9, 'turq', neck=3)
    jar(c, 25, 15, 5, 11, 'adobe', neck=3)
    c.outline(bottom=('adobe', 0))


@P_('basket-spice', '향신료 바구니', 1, 1, 'container', ['바구니', '향신료', '바자르'], '노점 앞 길 쪽에 2~3개.')
def _(c):
    c.ell(8, 8, 6.5, 3.5, lambda x, y, dx, dy, d: ('saffron', 4 if dy < 0 else 3) if d < 0.65 else ('hide', 5))
    c.ell(7, 7, 3, 1.5, lambda x, y, dx, dy, d: ('saffron', 5))
    for y in range(9, 15):
        for x in range(2, 15):
            dx = (x - 8) / 6.5
            if abs(dx) > 1 - (y - 9) * 0.03: continue
            t = 4 if (x + y) % 2 == 0 else 3
            if dx > 0.4: t -= 1
            c.P(x, y, 'hide', t)
    c.outline(bottom=('hide', 0))


@P_('sacks', '곡식 자루 더미', 1, 1, 'box', ['자루', '짐', '대상'], '대상 짐 더미·창고 벽 앞·노점 뒤.')
def _(c):
    for (x, y, w, h) in ((1, 6, 8, 8), (7, 7, 8, 7), (4, 1, 8, 7)):
        c.ell(x + w / 2, y + h / 2, w / 2, h / 2, lambda X, Y, dx, dy, d: ('plaster', 4 if dy < -0.2 and dx < 0.3 else 3 if dy < 0.3 else 2))
        c.P(int(x + w / 2), y, 'hide', 2); c.P(int(x + w / 2) + 1, y, 'hide', 3)
    c.outline(bottom=('plaster', 0))


@P_('crate', '나무 궤짝', 1, 1, 'box', ['상자', '짐', '바자르'], '노점 뒤·창고·대상 짐.')
def _(c):
    BP_box(c, 1, 2, 14, 5, 8, 'wood')
    c.outline(bottom=('wood', 0))


def BP_box(c, x, y, w, th, fh, mat, band=True):
    T = top(mat)
    c.R(x, y, w, th, mat, T - 1); c.HL(x, y, w, mat, 1); c.HL(x, y + th - 1, w, mat, T)
    for i in range(x + 3, x + w - 1, 4): c.VL(i, y + 1, th - 2, mat, T - 2)
    c.R(x, y + th, w, fh, mat, T - 3); c.HL(x, y + th, w, mat, T - 4)
    for i in range(x + 3, x + w - 1, 4): c.VL(i, y + th + 1, fh - 1, mat, T - 4)
    if band: c.HL(x, y + th + fh // 2, w, 'rock', 2)
    c.HL(x, y + th + fh - 1, w, mat, 0)


@P_('crates-stack', '궤짝 쌓음', 2, 2, 'box', ['상자', '짐', '대상', '창고'], '대상 숙소 마당 구석·부두·창고 앞.')
def _(c):
    BP_box(c, 2, 14, 14, 5, 9, 'wood'); BP_box(c, 16, 15, 14, 5, 8, 'wood'); BP_box(c, 8, 3, 14, 5, 9, 'wood')
    c.outline(bottom=('wood', 0))


# ═════════════ 등·불·의자 ═════════════
@P_('lantern-post', '등잔 기둥', 1, 2, 'column', ['등', '길', '광장'], '길·광장 가장자리 6~8칸 간격, 문 앞은 피한다.')
def _(c):
    c.R(5, 28, 6, 3, 'stone', 5); c.HL(5, 28, 6, 'stone', 6); c.HL(5, 31, 6, 'stone', 1)
    c.R(7, 8, 2, 20, 'dwood', 3); c.VL(8, 8, 20, 'dwood', 1)
    c.HL(4, 7, 8, 'dwood', 3); c.HL(4, 8, 8, 'dwood', 1)
    # 매단 놋 등잔(투각 빛)
    c.VL(5, 9, 2, 'rock', 2)
    c.R(3, 11, 5, 7, 'gold', 3); c.HL(3, 11, 5, 'gold', 5); c.P(4, 10, 'gold', 4); c.P(5, 9, 'gold', 5)
    for (x, y) in ((4, 13), (6, 13), (5, 15), (4, 16), (6, 16)): c.P(x, y, 'fire', 4)
    c.HL(3, 18, 5, 'gold', 1)
    c.outline(bottom=('stone', 0))


@P_('brazier', '놋 화로', 1, 1, 'container', ['화로', '불', '광장', '야영'], '광장 밤 장면·천막 앞·궁전 문 양옆 짝.')
def _(c):
    c.ell(8, 6, 6.5, 2.8, lambda x, y, dx, dy, d: ('gold', 5) if d > 0.55 else ('fire', 3 if dy < 0 else 2))
    for k in range(6):
        x = 4 + k * 1.6; c.P(int(x), 4 - (k % 3), 'fire', 4); c.P(int(x), 3 - (k % 3), 'fire', 3)
    c.P(7, 0, 'fire', 4); c.P(8, 1, 'fire', 3)
    for y in range(8, 12):
        r = 6 - (y - 8)
        for x in range(8 - r, 8 + r + 1): c.P(x, y, 'gold', 4 if x < 7 else 2)
    for x in (4, 8, 12): c.VL(x, 12, 3, 'gold', 2)
    c.outline(bottom=('gold', 0))


@P_('campfire', '돌 둘린 모닥불', 1, 1, 'container', ['모닥불', '야영', '대상'], '천막 야영지 가운데. 둘레에 깔개.')
def _(c):
    c.ell(8, 9, 7, 4.5, lambda x, y, dx, dy, d: ('rock', 4 if dy < 0 else 2) if d > 0.6 else ('sumi', 1))
    for k in range(8):
        a = k * math.pi / 4; c.R(int(8 + math.cos(a) * 6), int(9 + math.sin(a) * 3.8), 2, 2, 'rock', 4 if a > math.pi else 3)
    c.line(5, 10, 11, 8, 'hide', 2); c.line(5, 8, 11, 10, 'hide', 1)
    for (x, y, t) in ((8, 4, 4), (7, 5, 3), (9, 6, 3), (8, 7, 2), (6, 7, 2), (10, 8, 2)): c.P(x, y, 'fire', t)
    c.outline(bottom=('rock', 0))


@P_('bench-stone', '돌 벤치', 2, 1, 'low_furniture', ['벤치', '광장', '정원'], '광장·정원 가장자리, 분수를 보게.')
def _(c):
    c.R(1, 3, 30, 5, 'stone', 5); c.HL(1, 3, 30, 'stone', 6); c.HL(1, 7, 30, 'stone', 4)
    c.R(1, 8, 30, 3, 'stone', 3); c.HL(1, 10, 30, 'stone', 2)
    for x in (3, 25): c.R(x, 11, 4, 4, 'stone', 3); c.VL(x + 3, 11, 4, 'stone', 1)
    c.outline(bottom=('stone', 0))


@P_('cushion-seat', '앉는 방석(큰)', 1, 1, 'seat', ['방석', '천막', '찻집'], '천막 앞 깔개 위·찻집 야외석.')
def _(c):
    c.R(1, 4, 14, 7, 'red', 4); c.HL(1, 4, 14, 'red', 5); c.R(3, 6, 10, 3, 'saffron', 4)
    c.R(1, 11, 14, 3, 'red', 2); c.HL(1, 13, 14, 'red', 1)
    for x in (1, 14): c.P(x, 4, 'gold', 4); c.P(x, 13, 'gold', 3)
    c.outline(bottom=('red', 0))


@P_('parasol-reed', '갈대 차양(그늘막)', 2, 2, 'structure', ['그늘막', '시장', '오아시스'], '노점 없는 빈 광장 한쪽·오아시스 쉼터. 밑에 방석·깔개.', passable=[(0, 1), (1, 1)])
def _(c):
    # 네 기둥 + 엮은 갈대 지붕 윗면(밝음, 줄) + 앞 가장자리
    for x in (2, 28):
        c.R(x, 6, 2, 24, 'wood', 3); c.VL(x + 1, 6, 24, 'wood', 1)
    for y in range(2, 14):
        for x in range(0, 32):
            t = 4 if (x + (y // 2)) % 3 else 3
            if y == 2: t = 2
            if y >= 12: t = 2
            c.P(x, y, 'sand', t + (1 if y < 8 and x < 16 else 0))
    for x in range(0, 32, 2): c.P(x, 14, 'sand', 2); c.P(x + 1, 15, 'sand', 1)
    c.outline(bottom=('wood', 0))


# ═════════════ 낙타·수레 ═════════════
@P_('camel', '낙타(안장)', 2, 2, 'other', ['낙타', '대상', '오아시스'], '대상 숙소 마당·우물가·오아시스. 물통 곁, 둘이면 2칸 띄운다. 막힘.')
def _(c):
    H = 'hide'
    # 몸(옆모습, 등 혹 위 안장 윗면이 보인다)
    c.ell(16, 15, 10, 5.5, lambda x, y, dx, dy, d: (H, 4 if dy < -0.3 else 3 if dy < 0.3 else 2))
    c.ell(16, 9, 6, 4.5, lambda x, y, dx, dy, d: (H, 5 if dy < -0.2 and dx < 0.3 else 4))      # 혹
    # 안장 깔개(윗면 4줄 보임) + 늘어진 천
    c.R(10, 7, 12, 4, 'red', 4); c.HL(10, 7, 12, 'red', 5); c.R(12, 8, 8, 2, 'saffron', 4)
    c.R(9, 11, 14, 5, 'red', 2); c.HL(9, 11, 14, 'red', 3)
    for x in range(9, 23, 2): c.P(x, 16, 'saffron', 3)
    # 목·머리(왼쪽)
    for k in range(9):
        x = 6 - k * 0.3; y = 14 - k
        c.R(int(x), y, 3, 1, H, 4 if k > 5 else 3)
    c.R(1, 4, 6, 3, H, 4); c.HL(1, 4, 6, H, 5); c.P(1, 6, H, 2); c.P(3, 5, 'sumi', 0)
    c.P(5, 3, H, 3)
    # 다리 4개(관절 굵게)
    for (x, t) in ((8, 3), (11, 2), (21, 3), (24, 2)):
        for y in range(20, 30):
            c.P(x, y, H, t); c.P(x + 1, y, H, t - 1)
            if y == 25: c.P(x - 1, y, H, t)
        c.HL(x - 1, 30, 3, H, 1)
    c.P(26, 14, H, 2); c.VL(27, 14, 5, H, 2)               # 꼬리
    c.outline(bottom=('hide', 0))


@P_('cart-camel', '대상 짐수레', 3, 2, 'box', ['수레', '대상', '짐'], '대상 숙소 마당·대상 길가. 바퀴 쪽 1칸 비움.')
def _(c):
    # 짐칸: 짐 위 덮개(윗면) + 옆 판 + 바퀴 둘
    c.R(4, 6, 38, 9, 'plaster', 4); c.HL(4, 6, 38, 'plaster', 5)
    for x in range(6, 42, 7): c.VL(x, 7, 7, 'plaster', 2)
    c.R(4, 6, 10, 4, 'red', 3)
    c.R(2, 15, 42, 8, 'wood', 3); c.HL(2, 15, 42, 'wood', 5); c.HL(2, 22, 42, 'wood', 1)
    for x in range(6, 42, 8): c.VL(x, 16, 6, 'wood', 2)
    for wx in (10, 34):
        c.ell(wx, 24, 6, 6, lambda x, y, dx, dy, d: ('dwood', 3 if d > 0.65 else 1) if d > 0.45 else ('dwood', 2))
        c.line(wx - 4, 24, wx + 4, 24, 'dwood', 3); c.line(wx, 20, wx, 28, 'dwood', 3)
        c.P(wx, 24, 'gold', 4)
    c.line(44, 18, 47, 22, 'wood', 3)
    c.outline(bottom=('dwood', 0))


@P_('handcart', '손수레(항아리)', 2, 1, 'box', ['수레', '바자르', '짐'], '노점 곁·우물가.')
def _(c):
    c.R(3, 5, 20, 6, 'wood', 4); c.HL(3, 5, 20, 'wood', 5); c.HL(3, 10, 20, 'wood', 1)
    jar(c, 9, 7, 3, 5, 'adobe', neck=2); jar(c, 16, 7, 3, 5, 'turq', neck=2)
    c.ell(13, 12, 3.5, 3.5, lambda x, y, dx, dy, d: ('dwood', 3 if d > 0.5 else 1))
    c.line(23, 8, 30, 11, 'wood', 3); c.line(23, 9, 30, 12, 'wood', 1)
    c.outline(bottom=('dwood', 0))


# ═════════════ 울타리·말뚝·깃대·건조대 ═════════════
@P_('fence-wood', '바랜 나무 울타리(가로)', 1, 1, 'frame', ['울타리', '나무', '밭'], '밭·우리 둘레 가로로 이어 붙인다(16 주기).')
def _(c):
    for x in (1, 13):
        c.R(x, 2, 2, 13, 'wood', 4); c.HL(x, 2, 2, 'wood', 5); c.VL(x + 1, 3, 12, 'wood', 2)
    for y in (5, 10):
        c.HL(0, y, 16, 'wood', 5); c.HL(0, y + 1, 16, 'wood', 3); c.HL(0, y + 2, 16, 'wood', 1)
    c.HL(1, 15, 2, 'wood', 0); c.HL(13, 15, 2, 'wood', 0)


@P_('hitch-post', '말뚝 고삐 기둥', 1, 1, 'frame', ['말뚝', '낙타', '대상'], '낙타 곁·대상 숙소 마당.')
def _(c):
    for x in (2, 12):
        c.R(x, 3, 2, 12, 'wood', 4); c.HL(x, 3, 2, 'wood', 5); c.VL(x + 1, 4, 11, 'wood', 1)
    c.R(1, 4, 14, 3, 'wood', 4); c.HL(1, 4, 14, 'wood', 5); c.HL(1, 6, 14, 'wood', 2)
    c.line(6, 7, 8, 12, 'hide', 2)
    c.outline(bottom=('wood', 0))


@P_('banner-pole', '깃대(무늬 없는 천)', 1, 2, 'column', ['깃발', '광장', '성문'], '성문·궁전 문 양옆 짝, 바자르 입구.')
def _(c):
    c.R(5, 27, 6, 4, 'stone', 5); c.HL(5, 27, 6, 'stone', 6); c.HL(5, 30, 6, 'stone', 1)
    c.R(7, 3, 2, 24, 'wood', 4); c.VL(8, 3, 24, 'wood', 2)
    c.ell(8, 2, 1.5, 1.5, lambda x, y, dx, dy, d: ('gold', 5))
    for y in range(5, 17):
        for x in range(9, 15):
            w = 15 - (y - 5) // 4 if y > 12 else 15
            if x >= w: continue
            c.P(x + (1 if (y // 3) % 2 and x > 11 else 0), y, 'turq', 3 if x < 12 else 2)
    c.HL(9, 5, 6, 'turq', 4)
    c.outline(bottom=('stone', 0))


@P_('dye-rack', '염색 천 건조대', 2, 2, 'frame', ['건조대', '천', '바자르', '공방'], '바자르 뒤뜰·공방 마당. 천이 남쪽으로 늘어진다.')
def _(c):
    for x in (2, 28):
        c.R(x, 2, 2, 28, 'wood', 4); c.VL(x + 1, 3, 27, 'wood', 1)
    c.R(1, 2, 30, 3, 'wood', 4); c.HL(1, 2, 30, 'wood', 5); c.HL(1, 4, 30, 'wood', 1)
    for k, (x, m) in enumerate(((5, 'red'), (12, 'indigo'), (19, 'saffron'), (25, 'turq'))):
        L = 18 + (k % 2) * 4
        c.R(x, 5, 5, L, m, 3); c.VL(x, 5, L, m, 4); c.VL(x + 4, 5, L, m, 1)
        c.HL(x, 5 + L, 5, m, 2)
        for j in range(7, 5 + L, 4): c.HL(x + 1, j, 3, m, 2)
    c.outline(bottom=('wood', 0))


@P_('signpost', '이정표(무늬 없는 판)', 1, 2, 'frame', ['이정표', '길'], '갈림길·마을 어귀. 판에 글자 없음.')
def _(c):
    c.R(7, 4, 2, 27, 'wood', 3); c.VL(8, 4, 27, 'wood', 1)
    for (y, d) in ((6, 1), (13, -1)):
        x0 = 2 if d < 0 else 8
        c.R(x0, y, 7, 5, 'wood', 4); c.HL(x0, y, 7, 'wood', 5); c.HL(x0, y + 4, 7, 'wood', 1)
        tip = x0 + 7 if d > 0 else x0 - 1
        c.VL(tip, y + 1, 3, 'wood', 3)
    c.HL(5, 31, 6, 'wood', 0)
    c.outline(bottom=('wood', 0))


# ═════════════ 유적 소품 ═════════════
def column_shaft(c, cx, y0, y1, r, mat='stone', flutes=True):
    for y in range(y0, y1):
        for i in range(-r, r + 1):
            dx = i / (r + 0.5)
            t = 5 if dx < -0.4 else 4 if dx < 0.25 else 2 if dx < 0.7 else 1
            if flutes and (i + r) % 2 == 1 and abs(dx) < 0.8: t -= 1
            c.P(cx + i, y, mat, max(0, t))


@P_('column', '사암 기둥(머리돌)', 1, 3, 'column', ['기둥', '유적', '신전'], '유적 길 양옆 줄(3칸 간격)·신전 앞.')
def _(c):
    c.R(1, 42, 14, 6, 'stone', 4); c.HL(1, 42, 14, 'stone', 6); c.HL(1, 43, 14, 'stone', 5); c.HL(1, 47, 14, 'stone', 1)
    column_shaft(c, 8, 10, 42, 5)
    # 머리돌(연꽃 주두: 넓은 판 윗면 + 앞면)
    c.R(1, 2, 14, 5, 'stone', 6); c.HL(1, 2, 14, 'stone', 2); c.HL(1, 6, 14, 'stone', 4)
    c.R(1, 7, 14, 3, 'stone', 3); c.HL(1, 9, 14, 'stone', 1)
    for x in range(2, 14, 3): c.VL(x, 7, 3, 'stone', 4)
    c.outline(bottom=('stone', 0))


@P_('column-broken', '부러진 기둥', 1, 2, 'column', ['기둥', '유적', '폐허'], '폐허 곳곳·기둥 줄 사이 끊긴 자리.')
def _(c):
    c.R(1, 26, 14, 6, 'stone', 4); c.HL(1, 26, 14, 'stone', 6); c.HL(1, 31, 14, 'stone', 1)
    column_shaft(c, 8, 10, 26, 5)
    # 부러진 윗면(울퉁불퉁한 단면, 밝게)
    prof = [10, 9, 8, 8, 9, 7, 6, 7, 8, 9, 10]
    for i, yy in enumerate(prof):
        for y in range(yy, yy + 3):
            c.P(3 + i, y, 'stone', 6 if y == yy else 5)
        for y in range(0, yy): c.P(3 + i, y, None, 0)
    c.outline(bottom=('stone', 0))


@P_('block-fallen', '쓰러진 돌덩이', 1, 1, 'box', ['유적', '돌', '폐허'], '폐허·피라미드 둘레·기둥 발치.')
def _(c):
    # 기울어 박힌 사암 마름돌: 윗면(평행사변형, 왼쪽이 한 칸 높다) + 앞면 + 깨진 모서리 + 모래 둔덕
    for y in range(3, 8):
        sh = (7 - y) // 2
        for x in range(2 + sh, 14 + (0 if y > 4 else -1)):
            c.P(x, y, 'stone', 5 if y > 3 else 6)
    c.HL(3, 3, 9, 'stone', 6); c.HL(2, 7, 12, 'stone', 4)
    c.R(2, 8, 12, 5, 'stone', 3); c.HL(2, 8, 12, 'stone', 4)
    c.VL(7, 9, 4, 'stone', 1); c.P(8, 10, 'stone', 2)            # 마름돌 이음
    c.P(12, 4, 'stone', 3); c.P(13, 5, 'stone', 3)   # 깨진 모서리
    c.P(5, 5, 'stone', 3); c.P(6, 6, 'stone', 4); c.P(10, 4, 'stone', 4)   # 풍화 자국
    c.P(4, 11, 'stone', 1); c.P(11, 9, 'stone', 2)
    c.outline(bottom=('stone', 0))
    # 앞쪽 발치를 덮는 모래 둔덕(윤곽 위로)
    for x in range(1, 15):
        h = 2 if 3 < x < 11 else 1
        for y in range(13 - h + 1, 14): c.P(x, y, 'sand', 4 if y == 13 - h + 1 else 3)
    c.HL(2, 14, 12, 'sand', 2)


@P_('lion-statue', '사자 석상(받침)', 2, 2, 'figure', ['석상', '사자', '유적', '궁전'], '궁전 문·피라미드 길 양옆 짝(마주 보게 좌우 반전은 두지 않는다).')
def _(c):
    # 받침: 윗면 + 앞면
    c.R(1, 18, 30, 5, 'stone', 6); c.HL(1, 18, 30, 'stone', 2)
    c.R(1, 23, 30, 8, 'stone', 3); c.HL(1, 23, 30, 'stone', 4); c.HL(1, 30, 30, 'stone', 1)
    # 엎드린 사자(옆모습): 몸 + 머리(갈기) + 앞발
    c.ell(18, 15, 10, 4.5, lambda x, y, dx, dy, d: ('stone', 5 if dy < -0.2 else 4 if dy < 0.4 else 3))
    c.ell(8, 10, 5.5, 6, lambda x, y, dx, dy, d: ('stone', 5 if dx < 0 and dy < 0.2 else 4 if dy < 0.5 else 3))
    c.R(3, 9, 5, 4, 'stone', 4); c.P(4, 10, 'stone', 1); c.HL(3, 12, 4, 'stone', 2)
    c.R(4, 18, 10, 2, 'stone', 4); c.HL(4, 18, 10, 'stone', 5)
    c.P(28, 13, 'stone', 3); c.VL(29, 10, 4, 'stone', 3)
    c.outline(bottom=('stone', 0))


@P_('stele', '비석(무늬 띠, 글자 없음)', 1, 2, 'column', ['비석', '유적'], '유적 입구·갈림길. 글자 없는 띠 무늬.')
def _(c):
    c.R(1, 26, 14, 5, 'stone', 5); c.HL(1, 26, 14, 'stone', 6); c.HL(1, 30, 14, 'stone', 1)
    c.ell(8, 5, 6, 3, lambda x, y, dx, dy, d: ('stone', 6 if dy < 0 else 5))
    c.R(2, 5, 12, 21, 'stone', 4); c.VL(2, 5, 21, 'stone', 5); c.VL(13, 5, 21, 'stone', 2)
    for y in (9, 14, 19):
        c.HL(4, y, 8, 'stone', 2); c.HL(4, y + 1, 8, 'stone', 5)
        for x in range(4, 12, 3): c.P(x, y + 2, 'stone', 2)
    c.outline(bottom=('stone', 0))


if __name__ == '__main__':
    R.export()
    import prev
    prev.show(R, os.path.join(OUT, 'props', 'preview.png'), z=4)
    print('props', len(R.items))
