#!/usr/bin/env python3
"""desert_east 야외 소품 — 야자·아카시아·덤불·바위, 우물·분수·물통, 바자르 노점 5종, 깔개, 항아리·바구니·자루·상자,
등잔 기둥·화로·돌 벤치, 낙타·수레, 울타리·말뚝·깃대·염색 건조대, 기둥·쓰러진 돌·사자 석상·비석·이정표·모닥불.

화법: 투명 배경, 같은 램프 최암 단 윤곽(outline), 접지 아랫줄 어둡게, 빛 왼쪽 위. 서 있는 것은 윗면(뚜껑·아가리·판·등)이 위에서 보인다.
  python3 props.py
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, NT, MI, box3
from kit import Reg, contact, OUT
import bparts as BP

R = Reg('props')


def P_(id_, name, w, h, kind, tags=(), rules='', **kw):
    return R.add(id_, name, w, h, kind, tags=tags, rules=rules, **kw)


def top(m): return NT[MI[m]] - 1


def finish(c, bottom=True):
    c.outline(bottom=None if not bottom else None)


# ═════════════ 3/4 공용 도우미(윗면이 «위에서 본 면»으로 읽히게) ═════════════
def slab(c, x, y, w, th, fh, mat, s=0, tt=None, seams=0, joints=()):
    """3/4 판·돌덩이: 윗면 th 행(뒤 가장자리 어두운 선·결 얼룩·앞 모서리 밝은 선) + 앞면 fh 행(두 단 어둡게, 밑 그늘).
    seams: 윗면·앞면을 세로로 가르는 이음 간격(0=없음). joints: 윗면 가로 이음 행(윗면 안 상대 행)."""
    T = top(mat); tt = T - 1 if tt is None else tt
    for j in range(th):
        for i in range(w):
            t = tt
            if j < th // 2 and i < w // 2: t = min(T, tt + (1 if rnd(x + i, y + j, s + 5) < 0.35 else 0))
            if rnd(x + i, y + j, s) < 0.10: t -= 1
            c.P(x + i, y + j, mat, t)
    c.HL(x, y, w, mat, max(0, tt - 3))
    c.HL(x, y + th - 1, w, mat, T)
    c.VL(x, y + 1, th - 2, mat, T); c.VL(x + w - 1, y + 1, th - 2, mat, max(0, tt - 2))
    for jj in joints: c.HL(x + 1, y + jj, w - 2, mat, max(0, tt - 2))
    ft = max(1, tt - 3)
    for j in range(fh):
        for i in range(w):
            t = ft if i < w * 0.7 else ft - 1
            if j == 0: t = ft - 1
            if j == fh - 1 and fh > 2: t = max(0, ft - 2)
            c.P(x + i, y + th + j, mat, max(0, t))
    if seams:
        for i in range(x + seams, x + w - 1, seams):
            c.VL(i, y + 1, th - 2, mat, max(0, tt - 2)); c.VL(i, y + th + 1, max(0, fh - 1), mat, max(0, ft - 2))


def cyl_body(c, cx, y0, y1, r, mat, flutes=False):
    """세운 원통 몸통(왼쪽 빛)."""
    T = top(mat)
    for y in range(y0, y1):
        for i in range(-r, r + 1):
            dx = i / (r + 0.5)
            t = T - 1 if dx < -0.45 else T - 2 if dx < 0.2 else T - 3 if dx < 0.65 else T - 4
            if flutes and (i + r) % 2 == 1 and abs(dx) < 0.8: t -= 1
            c.P(cx + i, y, mat, max(0, t))


def cap_ellipse(c, cx, cy, rx, ry, mat, s=0, rings=False):
    """원통 위 끝 윗면(위에서 본 타원 판): 밝은 면 + 뒤 가장자리 어둡게 + 앞 가장자리 밝은 모서리."""
    T = top(mat)
    def fn(x, y, dx, dy, d):
        t = T - 1 if dx < 0.3 else T - 2
        if d > 0.72 and dy < -0.2: t = T - 3
        elif d > 0.72 and dy > 0.3: t = T
        if rings and 0.25 < d < 0.4: t = T - 3
        if rnd(x, y, s) < 0.08: t -= 1
        return (mat, max(0, t))
    c.ell(cx, cy, rx, ry, fn)


def mouth(c, cx, cy, rx, ry, mat, fill=None, rim=1.4):
    """아가리: 테(밝은 윗면 띠) + 안쪽 타원(뒤 안벽은 그늘, 앞쪽은 안 바닥/내용물). fill(x,y,dx,dy,d)->(mat,t) 이면 내용물."""
    T = top(mat)
    c.ell(cx, cy, rx, ry, lambda x, y, dx, dy, d: (mat, T if dy > 0.2 else T - 1 if dx < 0.3 else T - 2))
    irx, iry = rx - rim, ry - rim * 0.75
    def inner(x, y, dx, dy, d):
        if fill:
            r = fill(x, y, dx, dy, d)
            if r is not None: return r
        if dy < -0.7: return (mat, 1)             # 뒤 안벽(앞을 향해 그늘)
        if dy < 0.1: return ('void', 2)
        return ('void', 1)
    c.ell(cx, cy, irx, iry, inner)


def ground_shadow(c, x, y, w):
    c.HL(x, y, w, 'sumi', 2)


def drum_top(c, cx, cy, rx, ry, mat, t=None, s=0):
    """둥근 윗면(궁전 기둥식): 고른 밝은 판 + 앞 테 밝게·뒤 테 어둡게. 모서리가 둥글게 깎여 위에서 본 타원으로 읽힌다."""
    T = top(mat); t = T - 1 if t is None else t
    def fn(x, y, dx, dy, d):
        if d > 0.7: return (mat, T) if (dx * 0.6 + dy) > 0.15 else (mat, max(0, t - 2))
        return (mat, t - (1 if rnd(x, y, s) < 0.06 else 0))
    c.ell(cx, cy, rx, ry, fn)


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
    # 테 윗면(돌 띠) 0..9 + 안쪽 우묵한 물(3..8, 뒤 안벽 2행 + 물 4행) + 앞면 4행
    slab(c, 1, 0, 30, 10, 5, 'stone', s=3)
    c.R(4, 2, 24, 7, 'stone', 1)                       # 안쪽(테 안)
    c.HL(4, 2, 24, 'stone', 0); c.HL(4, 3, 24, 'stone', 2)   # 뒤 안벽(그늘)
    c.R(4, 4, 24, 5, 'water', 2); c.HL(4, 4, 24, 'water', 1)
    c.HL(6, 5, 7, 'water', 4); c.HL(17, 6, 5, 'water', 3); c.HL(8, 7, 3, 'water', 3)
    c.VL(4, 3, 6, 'stone', 2); c.VL(27, 3, 6, 'stone', 3)
    c.HL(3, 9, 26, 'stone', 6)                          # 앞 테 밝은 모서리
    for x in range(8, 30, 8): c.VL(x, 11, 3, 'stone', 1)
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
    # 세워 둔 말린 양탄자 둘: 위에서 본 말림 끝(넓은 타원 윗면 6행, 감긴 결) + 둥근 몸(무늬 띠)
    for (cx, cy, by, m, acc) in ((4.5, 3.8, 14, 'red', 'saffron'), (11.5, 5.2, 16, 'lapis', 'plaster')):
        T = top(m)
        cyl_body(c, int(cx), int(cy), by, 3, m)
        for y in range(int(cy) + 4, by - 1, 4): c.HL(int(cx) - 3, y, 7, acc, top(acc) - 2)
        def roll_top(x, y, dx, dy, d, m=m, T=T, acc=acc):
            if d > 0.78: return (m, T - 3 if dy < -0.1 else T)
            if 0.32 < d < 0.5 and dx > -0.3: return (m, T - 3)            # 감긴 결(반 바퀴)
            if d < 0.12: return (m, T - 3)
            return (acc if d < 0.3 else m, (top(acc) - 1) if d < 0.3 else (T if dx < 0 else T - 1))
        c.ell(cx, cy, 4.2, 3.3, roll_top)
        c.HL(int(cx) - 3, by - 1, 7, m, 0)
    c.outline(bottom=('dwood', 0))


# ═════════════ 항아리·바구니·자루·상자 ═════════════
def jar(c, cx, by, rw, h, mat='adobe', neck=3, s=0, mrx=None, mry=None, fill=None):
    """아가리 넓은 항아리: 위에서 본 아가리 타원(테 + 안 그늘·안 바닥, 세로 mry*2 행) + 어깨에서 부푼 몸(왼쪽 빛)."""
    T = top(mat)
    mrx = mrx or max(2.5, neck * 1.1)
    mry = mry or max(2.0, mrx * 0.62)
    my = by - h + mry
    for y in range(int(my), by):
        u = (y - my) / max(1, by - my)
        if u < 0.4: r = mrx + (rw - mrx) * math.sin(u / 0.4 * math.pi / 2)
        else: r = rw * (1 - ((u - 0.4) / 0.6) ** 2 * 0.5)
        for x in range(int(round(cx - r)), int(round(cx + r))):
            dx = (x + 0.5 - cx) / max(0.6, r)
            t = T - 1 if dx < -0.4 else T - 2 if dx < 0.15 else T - 3 if dx < 0.6 else T - 4
            if u > 0.82: t -= 1
            c.P(x, y, mat, max(0, t))
    mouth(c, cx, my, mrx, mry, mat, fill=fill, rim=1.2)
    c.HL(int(round(cx - rw * 0.5)), by - 1, int(rw), mat, 0)


@P_('jar-big', '큰 물 항아리', 1, 1, 'container', ['항아리', '도자기', '집'], '집 문 옆·노점 곁·우물가. 1~2개.')
def _(c):
    def water(x, y, dx, dy, d):
        if dy < -0.7: return ('adobe', 1)
        return ('water', 4 if (dx < -0.2 and -0.3 < dy < 0.1) else 2 if dy < 0.3 else 1)
    jar(c, 8, 16, 7.5, 15, 'adobe', mrx=6.8, mry=4.6, fill=water)
    c.outline(bottom=('adobe', 0))


@P_('jars-group', '항아리 무리', 2, 1, 'container', ['항아리', '도자기', '바자르'], '노점 옆·대상 숙소 마당 벽 앞.')
def _(c):
    jar(c, 25, 14, 5.5, 12, 'adobe', mrx=4.5, mry=3.4)
    jar(c, 9, 16, 8, 15, 'adobe', mrx=7, mry=4.7)
    jar(c, 19, 16, 4.5, 10, 'turq', mrx=3.6, mry=2.8)
    c.outline(bottom=('adobe', 0))


@P_('basket-spice', '향신료 바구니', 1, 1, 'container', ['바구니', '향신료', '바자르'], '노점 앞 길 쪽에 2~3개.')
def _(c):
    # 엮은 몸(앞면, 아래로 살짝 좁게) + 넓은 아가리 타원(테 + 안에 소복한 사프란 가루, 6행)
    for y in range(6, 15):
        for x in range(1, 16):
            dx = (x + 0.5 - 8) / 7.0
            if abs(dx) > 1 - (y - 6) * 0.025: continue
            t = 4 if (x + (y // 2)) % 2 == 0 else 3
            if dx > 0.45: t -= 1
            if y == 14: t = 1
            c.P(x, y, 'hide', t)
    def spice(x, y, dx, dy, d):
        if dy < -0.55: return ('hide', 1)                      # 뒤 안벽 그늘
        t = 5 if (dx < 0.1 and dy < 0.2) else 4 if d < 0.6 else 3
        if rnd(x, y, 61) < 0.15: t -= 1
        return ('saffron', t)
    mouth(c, 8, 5.5, 7.5, 4.6, 'hide', fill=spice, rim=1.3)
    c.outline(bottom=('hide', 0))


@P_('sacks', '곡식 자루 더미', 1, 1, 'container', ['자루', '짐', '대상'], '대상 짐 더미·창고 벽 앞·노점 뒤.')
def _(c):
    # 아가리를 접어 내린 곡식 자루(앞, 큰 것): 위에서 본 아가리 타원 안 곡식 + 뒤에 묶은 자루 둘
    for (cx, cy, rx, ry) in ((4, 5, 3.5, 4), (12.5, 5, 3.5, 4)):
        c.ell(cx, cy, rx, ry, lambda X, Y, dx, dy, d: ('plaster', 4 if dx < -0.2 and dy < 0 else 3 if dx < 0.4 else 2))
    c.P(4, 1, 'hide', 2); c.P(12, 1, 'hide', 2)
    for y in range(8, 16):
        u = (y - 8) / 8
        r = 6.5 + 0.8 * math.sin(u * math.pi)
        for x in range(int(8 - r), int(8 + r) + 1):
            dx = (x + 0.5 - 8) / r
            if abs(dx) > 1: continue
            t = 4 if dx < -0.35 else 3 if dx < 0.3 else 2
            if y == 15: t = 1
            c.P(x, y, 'plaster', t)
    def grain(x, y, dx, dy, d):
        if dy < -0.5: return ('plaster', 1)
        t = 5 if dx < 0 and dy < 0.3 else 4
        if rnd(x, y, 67) < 0.18: t -= 1
        return ('saffron', t)
    mouth(c, 8, 7.5, 7, 4.3, 'plaster', fill=grain, rim=1.3)
    c.HL(2, 11, 12, 'plaster', 2)                              # 접어 내린 단
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
    # 돌 받침(윗면 5행) + 둥근 나무 기둥 + 기둥 머리의 놋 등잔(넓은 갓 윗면 = 위에서 본 타원 6행) + 투각 등 몸
    slab(c, 2, 24, 12, 5, 3, 'stone', s=7)
    cyl_body(c, 8, 12, 26, 2, 'dwood')
    cap_ellipse(c, 8, 26, 3, 1.3, 'dwood')
    # 등 몸(투각 놋 원통)
    cyl_body(c, 8, 7, 13, 4, 'gold')
    for (x, y) in ((6, 9), (8, 9), (10, 9), (7, 11), (9, 11)): c.P(x, y, 'fire', 4)
    c.HL(4, 12, 9, 'gold', 1)
    # 갓: 넓은 놋 판(위에서 본 타원) + 꼭지
    c.ell(8, 4.5, 7.5, 3.6, lambda x, y, dx, dy, d: ('gold', 1 if dy > 0.75 else 2 if d > 0.8 and dy > 0.3 else 5 if dx < 0.2 and dy < 0.3 else 4))
    c.HL(2, 7, 13, 'gold', 2)
    c.P(8, 1, 'gold', 5); c.P(8, 2, 'gold', 3)
    c.outline(bottom=('stone', 0))


@P_('brazier', '놋 화로', 1, 1, 'container', ['화로', '불', '광장', '야영'], '광장 밤 장면·천막 앞·궁전 문 양옆 짝.')
def _(c):
    # 넓은 놋 대야(아가리 타원 안 숯불 6행) + 아래로 좁아지는 몸 + 세 발
    for y in range(6, 12):
        r = 7.5 - (y - 6) * 0.9
        for x in range(int(8 - r), int(8 + r) + 1):
            dx = (x + 0.5 - 8) / r
            if abs(dx) > 1: continue
            c.P(x, y, 'gold', 4 if dx < -0.3 else 3 if dx < 0.35 else 2)
    c.HL(4, 11, 9, 'gold', 1)
    for x in (4, 8, 12): c.VL(x, 12, 3, 'gold', 2); c.P(x, 12, 'gold', 3)
    def coals(x, y, dx, dy, d):
        if dy < -0.55: return ('gold', 1)
        r = rnd(x, y, 71)
        if r < 0.25: return ('sumi', 2)
        return ('fire', 3 if d < 0.4 else 2 if r < 0.7 else 1)
    mouth(c, 8, 5, 7.6, 4.2, 'gold', fill=coals, rim=1.2)
    for (x, y, t) in ((7, 4, 4), (9, 3, 4), (8, 2, 3), (6, 3, 3)): c.P(x, y, 'fire', t)
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
    # 두꺼운 앉음판: 윗면 7행(이음·위에 놓인 방석) + 앞면 3행 + 다리 받침 둘
    for x in (3, 24):
        c.R(x, 10, 5, 5, 'stone', 3); c.VL(x, 10, 5, 'stone', 4); c.VL(x + 4, 10, 5, 'stone', 1); c.HL(x, 10, 5, 'stone', 1)
    slab(c, 1, 1, 30, 7, 3, 'stone', s=11, seams=10)
    c.R(20, 2, 8, 4, 'red', 4); c.HL(20, 2, 8, 'red', 3); c.HL(20, 5, 8, 'red', 2); c.P(23, 3, 'saffron', 4); c.P(24, 3, 'saffron', 4)
    c.HL(20, 6, 8, 'stone', 3)
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
    # 뒤 기둥(짧게 보임, 그늘) · 앞 기둥 · 차양 밑 방석
    for x in (5, 25): c.R(x, 14, 2, 8, 'dwood', 2); c.VL(x + 1, 14, 8, 'dwood', 1)
    for x in (1, 29):
        c.R(x, 13, 2, 17, 'wood', 3); c.VL(x + 1, 13, 17, 'wood', 1); c.HL(x, 29, 2, 'wood', 0)
    c.R(10, 24, 12, 3, 'red', 4); c.HL(10, 24, 12, 'red', 5); c.HL(10, 27, 12, 'red', 2); c.R(13, 25, 6, 1, 'saffron', 4)
    # 엮은 갈대 지붕 윗면(위에서 본 판, 11행): 남북으로 누운 갈대 다발 줄 + 가로 묶음 끈 둘 + 뒤 가장자리 어둡게
    for j in range(11):
        for i in range(32):
            b = i // 3
            t = 5 if b % 2 == 0 else 4
            if i % 3 == 2: t -= 1
            if j < 5 and i < 18 and t < 6: t += 1
            if rnd(i, j, 81) < 0.08: t -= 1
            if j == 0: t = 2
            if j == 10: t = 6
            if i == 0: t = min(t, 3)
            if i == 31: t = min(t, 2)
            c.P(i, 1 + j, 'sand', t)
    for jj in (4, 8):
        for i in range(1, 31): c.P(i, 1 + jj, 'hide', 2 if i % 3 == 1 else 3)
    # 앞 가장자리로 늘어진 갈대 끝(앞면, 어둡게, 들쭉날쭉)
    for i in range(32):
        L = 2 + (h32(i, 0, 83) % 2)
        for j in range(L): c.P(i, 12 + j, 'sand', 2 if j == 0 else 1)
    c.outline(bottom=('wood', 0))


# ═════════════ 낙타·수레 ═════════════
def camel_body(c, cx, cy, by, legs='stand'):
    """3/4 낙타(서쪽을 봄): 위에서 내려다본 등(넓은 타원 윗면, 혹 위 안장 깔개) + 남쪽 옆구리 + 다리 + 옆 실루엣 목·머리.
    cy = 등 타원 가운데 행, by = 옆구리 밑 행."""
    H = 'hide'
    # 먼 쪽(북) 다리 — 어둡고 위로 물러남
    if legs == 'stand':
        for x in (cx - 8, cx + 6):
            c.R(x, by - 2, 2, 30 - by, H, 1); c.R(x - 1, by + (30 - by) // 2, 3, 1, H, 1)
    # 옆구리(남쪽 면): 아래로 둥글게
    for y in range(cy, by + 1):
        u = (y - cy) / max(1, by - cy)
        r = 11 * math.sqrt(max(0.0, 1 - u ** 2 * 0.55))
        for x in range(int(cx - r), int(cx + r) + 1):
            dx = (x + 0.5 - cx) / r
            t = 3 if dx < -0.3 else 2 if dx < 0.5 else 1
            if y == by: t = 1
            c.P(x, y, H, t)
    # 등 윗면(위에서 본 타원) + 혹
    c.ell(cx, cy, 11.5, 4.6, lambda x, y, dx, dy, d: (H, 5 if dx < 0.2 and dy < 0.1 else 4 if d < 0.85 else 3))
    c.ell(cx + 1, cy - 1, 5.5, 3.2, lambda x, y, dx, dy, d: (H, 5 if dx < 0.3 else 4))
    # 안장 깔개: 혹을 덮은 넓은 천(윗면 6행) + 남쪽 옆구리로 늘어진 자락(술)
    c.ell(cx + 1, cy - 0.5, 7.5, 3.6, lambda x, y, dx, dy, d: ('red', 4 if d < 0.55 else 3) if d < 0.9 else ('saffron', 4))
    c.ell(cx + 1, cy - 1, 3, 1.6, lambda x, y, dx, dy, d: ('saffron', 5 if dx < 0 else 4))
    c.R(cx - 6, cy + 3, 15, 3, 'red', 2); c.HL(cx - 6, cy + 3, 15, 'red', 3)
    for x in range(cx - 6, cx + 9, 2): c.P(x, cy + 6, 'saffron', 3)
    # 가까운 쪽(남) 다리
    if legs == 'stand':
        for x in (cx - 6, cx + 8):
            c.R(x, by, 2, 30 - by, H, 3); c.VL(x + 1, by, 30 - by, H, 2)
            c.R(x - 1, by + (30 - by) // 2, 3, 1, H, 3)
            c.HL(x - 1, 30, 3, H, 1)
    else:
        c.R(cx - 9, by, 6, 2, H, 3); c.HL(cx - 9, by, 6, H, 4)
        c.R(cx + 4, by, 7, 2, H, 3); c.HL(cx + 4, by, 7, H, 4)
        c.HL(cx - 10, by + 2, 22, H, 1)
    # 목·머리(서쪽, 옆 실루엣)
    nx, ny = cx - 10, cy + 1
    for k in range(9):
        x = nx - k * 0.55; y = ny - k
        c.R(int(round(x)), y, 4, 1, H, 4 if k > 4 else 3); c.P(int(round(x)) + 1, y, H, 5)
    hx, hy = int(round(nx - 8 * 0.55)) - 4, ny - 11
    c.R(hx, hy, 7, 3, H, 4); c.HL(hx, hy, 7, H, 5); c.P(hx, hy + 2, H, 2); c.P(hx + 2, hy + 1, 'sumi', 0); c.P(hx + 5, hy - 1, H, 3)
    # 꼬리
    c.VL(cx + 11, cy + 1, 5, H, 2)
    c.outline(bottom=('hide', 0))


@P_('camel', '낙타(안장)', 2, 2, 'other', ['낙타', '대상', '오아시스'], '대상 숙소 마당·우물가·오아시스. 물통 곁, 둘이면 2칸 띄운다. 막힘.')
def _(c):
    camel_body(c, 18, 10, 19, legs='stand')


@P_('cart-camel', '대상 짐수레', 3, 2, 'box', ['수레', '대상', '짐'], '대상 숙소 마당·대상 길가. 바퀴 쪽 1칸 비움.')
def _(c):
    # 열린 짐칸(위에서 본 밝은 널 바닥 + 둘레 테) 위에 아가리 보이는 항아리 셋·뚜껑 보이는 궤짝·아가리 연 자루 + 앞 옆판 + 작은 바퀴 둘
    c.R(2, 3, 42, 13, 'wood', 4)
    c.R(4, 5, 38, 9, 'wood', 4)
    for x in range(7, 42, 4): c.VL(x, 5, 9, 'wood', 3)
    c.HL(4, 5, 38, 'wood', 2)
    c.HL(2, 3, 42, 'wood', 2); c.HL(2, 4, 42, 'wood', 5)
    c.VL(2, 4, 12, 'wood', 5); c.VL(3, 4, 12, 'wood', 4); c.VL(42, 4, 12, 'wood', 3); c.VL(43, 4, 12, 'wood', 2)
    c.HL(2, 14, 42, 'wood', 4); c.HL(2, 15, 42, 'wood', 5)
    BP_box(c, 5, 5, 9, 4, 4, 'wood', band=False)
    for cx, mat in ((19, 'adobe'), (26, 'turq'), (33, 'adobe')):
        jar(c, cx, 14, 3.6, 11, mat, mrx=3.3, mry=2.6)
    def grain(x, y, dx, dy, d):
        if dy < -0.6: return ('plaster', 1)
        return ('saffron', 4 if dx < 0 else 3)
    c.ell(39.5, 11, 3, 2.6, lambda x, y, dx, dy, d: ('plaster', 3 if dx < 0.3 else 2))
    mouth(c, 39.5, 8.5, 3, 2.2, 'plaster', fill=grain, rim=0.9)
    c.R(2, 16, 42, 6, 'wood', 2); c.HL(2, 16, 42, 'wood', 1); c.HL(2, 21, 42, 'wood', 0)
    for x in range(6, 42, 8): c.VL(x, 17, 4, 'wood', 1)
    for wx in (10, 34):
        c.ell(wx, 24, 5, 5, lambda x, y, dx, dy, d: ('dwood', 3 if d > 0.6 else 1) if d > 0.4 else ('dwood', 2))
        c.line(wx - 3, 24, wx + 3, 24, 'dwood', 3); c.line(wx, 21, wx, 27, 'dwood', 3)
        c.P(wx, 24, 'gold', 4)
    c.line(44, 17, 47, 21, 'wood', 3)
    c.outline(bottom=('dwood', 0))


@P_('handcart', '손수레(항아리)', 2, 1, 'box', ['수레', '바자르', '짐'], '노점 곁·우물가.')
def _(c):
    # 짐칸 바닥 윗면(위에서 본 널판 6행, 테 두름) + 앞판 3행 + 바퀴 + 손잡이 채. 항아리는 뒤 왼쪽에 하나만(바닥이 보이게).
    c.line(23, 9, 31, 12, 'wood', 3); c.line(23, 10, 31, 13, 'wood', 1)
    slab(c, 2, 2, 22, 7, 3, 'wood', s=17)
    for x in (2, 23): c.VL(x, 2, 7, 'wood', 2)
    c.HL(3, 2, 20, 'wood', 1)
    for jj in (4, 6): c.HL(3, 2 + jj - 1, 20, 'wood', 3)              # 널판 이음(가로)
    jar(c, 7, 7, 3.5, 7, 'adobe', mrx=2.6, mry=2)
    c.ell(16, 5, 3, 1.8, lambda x, y, dx, dy, d: ('saffron', 4 if dy < 0 else 3))   # 바닥에 놓인 자루
    c.ell(12, 12.5, 3.5, 3.5, lambda x, y, dx, dy, d: ('dwood', 3 if d > 0.5 else 1))
    c.P(12, 12, 'gold', 4)
    c.outline(bottom=('dwood', 0))


# ═════════════ 울타리·말뚝·깃대·건조대 ═════════════
@P_('fence-wood', '바랜 나무 울타리(가로)', 1, 1, 'frame', ['울타리', '나무', '밭'], '밭·우리 둘레 가로로 이어 붙인다(16 주기).')
def _(c):
    # 말뚝 고삐 기둥(de-hitch-post)과 같은 짜임: 넓은 위 가로보(윗면 6행 + 앞 모서리 2행, 가로 결) · 땅에 박힌 말뚝 둘
    for x in (2, 11):
        c.R(x, 8, 3, 7, 'dwood', 3); c.VL(x, 8, 7, 'dwood', 4); c.VL(x + 2, 8, 7, 'dwood', 1); c.HL(x, 8, 3, 'dwood', 1)
    box3(c, 0, 0, 16, 6, 2, 'wood', tt=4, ft=2)
    for y in (2, 4): c.HL(1, y, 14, 'wood', 5)
    c.HL(4, 15, 3, 'sand', 2); c.HL(9, 15, 3, 'sand', 2)
    c.outline(bottom=('dwood', 0))


@P_('hitch-post', '말뚝 고삐 기둥', 1, 1, 'frame', ['말뚝', '낙타', '대상'], '낙타 곁·대상 숙소 마당.')
def _(c):
    # 넓은 위 가로보(윗면 6행 + 앞 모서리 2행, 위에 갠 안장 깔개) · 땅에 박힌 말뚝 둘 · 매단 고삐
    for x in (2, 11):
        c.R(x, 8, 3, 7, 'dwood', 3); c.VL(x, 8, 7, 'dwood', 4); c.VL(x + 2, 8, 7, 'dwood', 1); c.HL(x, 8, 3, 'dwood', 1)
    box3(c, 0, 0, 16, 6, 2, 'wood', tt=4, ft=2)
    box3(c, 8, 1, 6, 3, 2, 'red', tt=4, ft=2, edge=False)                  # 갠 안장 깔개(윗면 위 덩이)
    c.HL(8, 2, 6, 'saffron', 4)
    c.line(6, 8, 5, 11, 'hide', 2); c.line(6, 8, 8, 11, 'hide', 2); c.HL(5, 12, 4, 'hide', 1)
    c.outline(bottom=('dwood', 0))


@P_('banner-pole', '깃대(무늬 없는 천)', 1, 2, 'column', ['깃발', '광장', '성문'], '성문·궁전 문 양옆 짝, 바자르 입구.')
def _(c):
    # 둥근 돌 북(받침, 본체): 위에서 본 넓은 타원 윗면 9행 + 둥근 앞면 · 북 가운데 꽂힌 가는 깃대 · 깃대 끝 금 구슬 · 늘어진 좁은 천
    for y in range(22, 31):
        for i in range(-7, 8):
            dx = i / 7.5
            c.P(8 + i, y, 'stone', 4 if dx < -0.4 else 3 if dx < 0.3 else 2)
    c.HL(1, 30, 14, 'stone', 1)
    drum_top(c, 8, 21, 7.5, 4.6, 'stone', s=5)
    c.ell(8, 21, 2.2, 1.2, lambda x, y, dx, dy, d: ('stone', 2))          # 깃대 꽂은 구멍 그늘
    c.R(7, 1, 2, 21, 'dwood', 3); c.VL(7, 1, 21, 'dwood', 4)
    c.R(7, 0, 2, 2, 'gold', 5); c.P(8, 1, 'gold', 3)
    for y in range(3, 14):
        for x in range(9, 14):
            if y > 11 and (x + y) % 2: continue
            c.P(x, y, 'turq', 3 if x < 11 else 2)
    c.HL(9, 3, 5, 'turq', 4)
    c.outline(bottom=('stone', 0))


@P_('dye-rack', '염색 천 건조대', 2, 2, 'frame', ['건조대', '천', '바자르', '공방'], '바자르 뒤뜰·공방 마당. 천이 남쪽으로 늘어진다.')
def _(c):
    # 기둥 둘(돌 받침 윗면) + 기둥 위에 얹은 두꺼운 가로보(윗면 6행 + 앞면 3행) + 보 앞으로 늘어진 천 넷
    for x in (1, 27):
        c.R(x, 9, 4, 17, 'wood', 3); c.VL(x, 9, 17, 'wood', 4); c.VL(x + 3, 9, 17, 'wood', 1)
    slab(c, 0, 24, 7, 4, 3, 'stone', s=37); slab(c, 25, 24, 7, 4, 3, 'stone', s=41)
    slab(c, 0, 1, 32, 6, 3, 'wood', s=43)
    for k, (x, m) in enumerate(((6, 'red'), (12, 'indigo'), (18, 'saffron'), (24, 'turq'))):
        L = 13 + (k % 2) * 4
        # 보 윗면에 걸친 천(윗면 위 띠) + 앞으로 늘어진 자락
        c.R(x, 3, 5, 4, m, top(m) - 1); c.HL(x, 3, 5, m, top(m) - 2)
        c.R(x, 7, 5, L, m, 3); c.VL(x, 7, L, m, 4); c.VL(x + 4, 7, L, m, 1)
        c.HL(x, 7, 5, m, 2)
        c.HL(x, 7 + L, 5, m, 2)
        for j in range(10, 7 + L, 4): c.HL(x + 1, j, 3, m, 2)
    c.outline(bottom=('stone', 0))


@P_('signpost', '이정표(무늬 없는 판)', 1, 2, 'frame', ['이정표', '길'], '갈림길·마을 어귀. 판에 글자 없음.')
def _(c):
    # 돌 받침(윗면 5행) + 굵은 네모 기둥(머리 윗면 판 5행) + 두꺼운 화살 판 둘(판 윗면 3행 + 앞면)
    slab(c, 2, 23, 12, 5, 3, 'stone', s=47)
    c.R(6, 6, 4, 19, 'wood', 3); c.VL(6, 6, 19, 'wood', 4); c.VL(9, 6, 19, 'wood', 1)
    slab(c, 4, 1, 8, 5, 2, 'dwood', s=53)
    for (y, d) in ((9, 1), (16, -1)):
        x0 = 1 if d < 0 else 8
        slab(c, x0, y, 7, 3, 4, 'wood', s=59 + y)
        tip = x0 + 7 if d > 0 else x0 - 1
        c.VL(tip, y + 1, 5, 'wood', 3); c.VL(tip + d, y + 2, 3, 'wood', 2)
    c.outline(bottom=('stone', 0))


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
    # 궁전 기둥식: 둥근 받침(타원 윗면) + 둥근 몸(홈) + 아래로 좁아지는 어두운 머리 띠 + 넓은 둥근 머리돌 윗면(타원 8행)
    for y in range(41, 46):
        for i in range(-7, 8):
            dx = i / 7.5
            c.P(8 + i, y, 'stone', 4 if dx < -0.4 else 3 if dx < 0.3 else 2)
    drum_top(c, 8, 41, 7.5, 2.8, 'stone', s=1)
    column_shaft(c, 8, 12, 41, 4)
    for yb in (16, 37): c.HL(4, yb, 9, 'stone', 1)
    for y, (x0, x1) in zip(range(7, 13), ((1, 15), (2, 14), (3, 13), (3, 13), (4, 12), (4, 12))):
        for x in range(x0, x1):
            t = 3 if x < 7 else 2 if x < 10 else 1
            if y in (8, 10) and (x - x0) % 3 == 1: t = 0
            c.P(x, y, 'stone', t)
    drum_top(c, 8, 4.2, 7.6, 3.9, 'stone', s=2)
    c.outline(bottom=('stone', 0))


@P_('column-broken', '부러진 기둥', 1, 2, 'column', ['기둥', '유적', '폐허'], '폐허 곳곳·기둥 줄 사이 끊긴 자리.')
def _(c):
    # 둥근 받침(타원 윗면) + 둥근 몸(홈) + 부러진 단면(위에서 본 밝은 타원 7행, 금) + 단면 밑 깨진 어두운 띠 + 발치 조각
    for y in range(26, 30):
        for i in range(-7, 8):
            dx = i / 7.5
            c.P(8 + i, y, 'stone', 4 if dx < -0.4 else 3 if dx < 0.3 else 2)
    drum_top(c, 8, 26, 7.5, 2.8, 'stone', s=3)
    column_shaft(c, 8, 9, 26, 5)
    for i in range(-5, 6): c.P(8 + i, 10 + (1 if (i * 7) % 3 == 0 else 0), 'stone', 1)
    drum_top(c, 8, 6.5, 6, 3.6, 'stone', s=4)
    c.line(5, 6, 8, 8, 'stone', 3); c.line(8, 8, 11, 7, 'stone', 3)
    c.R(12, 27, 3, 2, 'stone', 5); c.HL(12, 29, 3, 'stone', 2)
    c.outline(bottom=('stone', 0))


@P_('block-fallen', '쓰러진 돌덩이', 1, 1, 'box', ['유적', '돌', '폐허'], '폐허·피라미드 둘레·기둥 발치.')
def _(c):
    # 기울어 박힌 사암 마름돌: 윗면(평행사변형, 왼쪽이 한 칸 높다) + 앞면 + 깨진 모서리 + 모래 둔덕
    # 누운 사암 마름돌: 위에서 본 넓은 윗면(7행, 풍화 자국·금) + 앞면 4행 + 깨진 모서리
    slab(c, 1, 2, 14, 7, 4, 'stone', s=71)
    c.line(4, 4, 7, 7, 'stone', 3); c.P(10, 4, 'stone', 4); c.P(11, 5, 'stone', 4)
    c.P(13, 2, None, 0); c.P(14, 2, None, 0); c.P(14, 3, None, 0); c.P(13, 3, 'stone', 3); c.P(14, 4, 'stone', 3)
    c.VL(8, 10, 3, 'stone', 1)
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
    # 넓은 받침(윗면 5행) + 두꺼운 비석 판: 머리 윗면(위에서 본 판 6행) + 남쪽 앞면(글자 없는 띠 무늬)
    slab(c, 0, 23, 16, 5, 4, 'stone', s=73)
    slab(c, 2, 1, 12, 6, 19, 'stone', s=79)
    c.VL(2, 7, 19, 'stone', 4); c.VL(13, 7, 19, 'stone', 1)
    for y in (11, 16, 21):
        c.HL(4, y, 8, 'stone', 1); c.HL(4, y + 1, 8, 'stone', 4)
        for x in range(4, 12, 3): c.P(x, y + 2, 'stone', 1)
    c.HL(2, 25, 12, 'stone', 1)
    c.outline(bottom=('stone', 0))

# ═════════════ 추가: 쉬는 낙타·두레박·가마·양탄자 걸이·향로·항아리 시렁·야자 그루터기 ═════════════
@P_('camel-rest', '앉아 쉬는 낙타', 2, 2, 'other', ['낙타', '대상', '오아시스'], '야영지·대상 숙소 마당·물통 곁. 서 있는 낙타와 섞어 둔다. 막힘.')
def _(c):
    camel_body(c, 19, 17, 25, legs='rest')


@P_('shaduf', '두레박 장대(샤두프)', 2, 3, 'frame', ['우물', '오아시스', '밭'], '못가·우물 곁 흙 위. 장대 끝 두레박이 물 쪽을 향한다. 막힘.')
def _(c):
    # 흙벽돌 기둥 둘 + 기둥 위 두꺼운 가로 받침보(수건걸이식: 윗면 6행 + 앞 모서리 2행, 위에 감은 밧줄·물동이) + 기운 장대·평형추·두레박
    for x0 in (2, 16):
        slab(c, x0, 22, 8, 6, 19, 'adobe', s=83 + x0)
        for y in range(31, 46, 5): c.HL(x0 + 1, y, 6, 'adobe', 2)
    box3(c, 0, 15, 26, 6, 3, 'wood', tt=4, ft=2)
    c.ell(20, 17.5, 3, 1.8, lambda x, y, dx, dy, d: ('hide', 4 if dy < 0 else 2) if d > 0.35 else ('wood', 3))
    jar(c, 6, 20, 3, 6, 'adobe', mrx=2.6, mry=2)
    c.line(2, 31, 29, 3, 'dwood', 3); c.line(2, 32, 29, 4, 'dwood', 1); c.line(3, 31, 30, 3, 'dwood', 4)
    rock_blob(c, 4, 32, 4, 3, 7)
    c.VL(29, 5, 10, 'hide', 1)
    jar(c, 29, 22, 3, 7, 'dwood', mrx=2.6, mry=2)
    c.outline(bottom=('adobe', 0))


@P_('kiln', '흙 가마(그릇 굽는)', 2, 2, 'container', ['가마', '그릇', '바자르', '공방'], '도공 노점 뒤·마을 가장자리 모래 위. 둘레 1칸 비움.')
def _(c):
    # 둥근 흙 가마: 윗면 아가리(타원, 안 불빛) + 몸 + 앞 아궁이(불) + 곁 장작
    cx = 15
    for y in range(4, 28):
        for x in range(1, 30):
            dx = (x + 0.5 - cx) / 13; u = (y - 4) / 24
            r = math.sqrt(max(0.0, 1 - (1 - u) ** 2 * 0.55))
            if abs(dx) > r: continue
            t = 5 if dx < -0.35 else 4 if dx < 0.25 else 3 if dx < 0.7 else 2
            if y > 22: t -= 1
            c.P(x, y, 'adobe', t)
    def glow(x, y, dx, dy, d):
        if dy < -0.5: return ('adobe', 1)
        if rnd(x, y, 91) < 0.2: return ('sumi', 2)
        return ('fire', 4 if d < 0.3 else 3 if d < 0.6 else 2)
    mouth(c, cx, 7.5, 10, 5, 'adobe', fill=glow, rim=1.5)
    c.R(11, 19, 8, 7, 'void', 1); c.R(12, 21, 6, 4, 'fire', 3); c.HL(12, 24, 6, 'fire', 4); c.R(13, 22, 2, 2, 'fire', 4)
    c.HL(10, 18, 10, 'adobe', 6)
    for y, x0 in ((26, 21), (28, 22)): c.HL(x0, y, 9, 'dwood', 3); c.HL(x0, y + 1, 9, 'dwood', 1)
    c.outline(bottom=('adobe', 0))


@P_('carpet-rack', '양탄자 걸이', 2, 2, 'frame', ['양탄자', '바자르', '시장'], '바자르 노점 줄 사이·가게 앞 포석 위. 앞 1칸 비움.')
def _(c):
    # 나무 틀(기둥 둘 + 가로대 윗면) + 걸린 양탄자 셋(무늬 띠·술)
    # 기둥 둘(돌 받침 윗면) + 기둥 위 두꺼운 가로보(윗면 6행 + 앞면 3행) + 보에 걸쳐 앞으로 늘어진 양탄자 셋
    for x in (1, 27):
        c.R(x, 9, 4, 17, 'dwood', 3); c.VL(x, 9, 17, 'dwood', 4); c.VL(x + 3, 9, 17, 'dwood', 1)
    slab(c, 0, 24, 7, 4, 3, 'stone', s=93); slab(c, 25, 24, 7, 4, 3, 'stone', s=97)
    slab(c, 0, 1, 32, 6, 3, 'wood', s=101)
    for i, (x0, mat, acc) in enumerate(((5, 'red', 'saffron'), (13, 'lapis', 'gold'), (21, 'turq', 'red'))):
        w = 7
        c.R(x0, 2, w, 5, mat, top(mat) - 1); c.HL(x0, 2, w, mat, top(mat) - 2)      # 보 윗면에 걸친 부분
        c.R(x0, 7, w, 15, mat, 3); c.VL(x0, 7, 15, mat, 4); c.VL(x0 + w - 1, 7, 15, mat, 2); c.HL(x0, 7, w, mat, 1)
        c.R(x0 + 1, 9, w - 2, 11, mat, 2 if i != 1 else 3)
        for y in range(10, 21, 4): c.HL(x0 + 1, y, w - 2, acc, 3)
        c.P(x0 + 3, 12, acc, 4); c.P(x0 + 3, 16, acc, 4)
        for x in range(x0, x0 + w, 2): c.P(x, 22, 'plaster', 4)
    c.outline(bottom=('stone', 0))


@P_('incense-burner', '놋 향로(연기)', 1, 1, 'container', ['향', '바자르', '궁전'], '가게 문 곁·궁전 앞단·노점 사이 포석 위.')
def _(c):
    # 세발 놋 그릇(아가리 타원 4줄 + 숯 빛) + 가는 연기 두 줄
    # 넓은 놋 그릇(아가리 타원 안 재·숯, 6행) + 둥근 배 + 세 발 + 뒤로 오르는 가는 연기
    for y in range(8, 13):
        r = 7 - (y - 8) * 0.9
        for x in range(int(8 - r), int(8 + r) + 1):
            dx = (x + 0.5 - 8) / r
            if abs(dx) > 1: continue
            c.P(x, y, 'gold', 4 if dx < -0.3 else 3 if dx < 0.35 else 2)
    c.HL(4, 12, 9, 'gold', 1)
    for x in (4, 8, 12): c.VL(x, 13, 2, 'gold', 2)
    def ash(x, y, dx, dy, d):
        if dy < -0.55: return ('gold', 1)
        r = rnd(x, y, 103)
        if d < 0.35: return ('fire', 3 if r < 0.5 else 2)
        return ('marble', 2 if r < 0.6 else 1)
    mouth(c, 8, 7, 7, 4, 'gold', fill=ash, rim=1.2)
    for k in range(4):
        c.P(8 + (1 if k % 2 else 0), 3 - k, 'marble', 3 if k < 2 else 2)
    c.outline(bottom=('gold', 0), sides=True)


@P_('jars-rack', '물항아리 시렁', 2, 1, 'container', ['항아리', '우물', '오아시스'], '우물·못가 곁 흙 위. 앞 1칸 비움.')
def _(c):
    # 낮은 나무 시렁(윗면) 위 아가리 보이는 물항아리 셋
    slab(c, 0, 9, 32, 4, 2, 'wood', s=107)
    for x in (1, 29): c.R(x, 15, 2, 1, 'dwood', 1)
    for cx, mat in ((6, 'adobe'), (16, 'turq'), (26, 'adobe')):
        jar(c, cx, 12, 5, 12, mat, mrx=4.8, mry=4.4)
    c.outline(bottom=('wood', 0))


@P_('palm-stump', '야자 그루터기', 1, 1, 'column', ['야자', '오아시스', '폐허'], '과수원 가장자리·폐허 곁 모래 위. 걸어 지나간다.')
def _(c):
    # 잘린 줄기(윗면 나이테 타원) + 마른 잎 자락
    # 굵은 야자 줄기 토막(마디 띠 앞면) + 잘린 단면(위에서 본 타원 6행, 섬유 결·나이테) + 밑동 마른 잎 자락
    for y in range(7, 14):
        for i in range(-5, 6):
            dx = i / 5.5
            t = 4 if dx < -0.4 else 3 if dx < 0.2 else 2 if dx < 0.7 else 1
            if (y - 7) % 3 == 0: t = max(0, t - 1)
            c.P(8 + i, y, 'hide', t)
    def cut(x, y, dx, dy, d):
        if d > 0.7: return ('hide', 2 if dy < -0.2 else 5)
        t = 5 if dx < 0.2 else 4
        if 0.3 < d < 0.45: t = 3
        if rnd(x, y, 109) < 0.12: t -= 1
        return ('wood', t)
    c.ell(8, 6, 6, 3.4, cut)
    for (x, y) in ((1, 13), (2, 12), (14, 13), (13, 12), (15, 14), (0, 14)): c.P(x, y, 'palm', 1)
    c.outline(bottom=('wood', 0))


if __name__ == '__main__':
    R.export()
    import prev
    prev.show(R, os.path.join(OUT, 'props', 'preview.png'), z=4)
    print('props', len(R.items))
