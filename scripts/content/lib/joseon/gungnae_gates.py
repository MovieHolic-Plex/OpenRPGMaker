"""국내성식 성벽·성문·망루 — 바람의나라 국내성(gate.png)의 문법으로 새로 그린 조각.

문루 = 돌 기단(아래가 넓은 사다리꼴, 벽돌 쌓기) + 반원 아치 통로(안쪽 어두운 창살) + 위에 청록 기와 이중 처마 누각 + 현판.
성벽 = 윗면 걷는 길 + 성가퀴 톱니 + 아래 큰 돌 쌓기(불규칙 막돌), 두께 2칸. 동서 변(세로 벽)은 폭 32px 로 그린다(1px 선 금지).
모든 조각은 폭/칸 수를 인자로 받아 다시 조립할 수 있다. 색은 tk.RGB 램프만 쓴다.

통행 정보(PASSAGE): 조각별로 걸어서 지나는 칸을 (열 범위, 행 범위) 로 적는다. 열·행은 조각 왼쪽 위 칸 기준 0부터, 끝은 포함하지 않는다.
"""
import math
from tk import *
import water_blob as _WB
from build import outline
from trees import ground_shadow
from tk import SHADOW

S = RGB['stone']
G_ = RGB['dgreen']
PASSAGE = {}          # 조각 이름 -> {'cols': (a, b), 'rows': (a, b), 'note': str}


# ---------------------------------------------------------------- 돌 쌓기
_PARTS = [(16,), (8, 8), (10, 6), (6, 10), (11, 5), (5, 11), (7, 9), (9, 7)]


def _courses(h, seed, base=11):
    """돌 줄 높이 목록: 9~11px 사이를 오가며 h 를 채운다."""
    out, y, k = [], 0, 0
    while y < h:
        ch = base + (hsh(k, seed, 5) % 3) - 1
        if h - y - ch < 7:
            ch = h - y
        out.append(ch); y += ch; k += 1
    return out


def rubble_face(c, x0, y0, x1, y1, seed=0, lo=None, hi=None):
    """아래 큰 돌 쌓기(불규칙 막돌, 성벽용). 줄마다 돌 폭 배치(_PARTS)를 16px 칸 경계에서 다시 시작하므로
    어떤 변형을 어떤 순서로 이어 붙여도 이음이 어긋나지 않는다. 돌 하나는 모서리가 깎인 덩이:
    왼쪽 위 1px 밝은 각, 오른쪽 아래 1px 그늘, 사이는 어두운 틈(S[2]). 몸체는 어두운 회색(3~4) — 문루 기단(밝은 벽돌)보다 거칠고 어둡다."""
    ys = y0
    for ri, ch in enumerate(_courses(y1 - y0, seed)):
        for cx in range((x0 // 16) * 16, x1 + 16, 16):
            parts = _PARTS[hsh(cx // 16 + ri * 13, seed, 21) % len(_PARTS)]
            xs = cx
            for pi, pw in enumerate(parts):
                a, b = xs, xs + pw
                xs = b
                if b <= x0 or a >= x1:
                    continue
                q = rnd(a // 2 + ri * 7, ri, seed + 31)
                base = 4 if q > 0.55 else 3
                for y in range(ys, ys + ch):
                    ly, ry = y - ys, ys + ch - 1 - y
                    rl = lo(y) if lo else x0
                    rh = hi(y) if hi else x1
                    for x in range(max(a, rl, x0), min(b, rh, x1)):
                        lx, rx = x - a, b - 1 - x
                        t = base
                        if ly == 0 or lx == 0: t = 2                      # 틈(돌 사이, 1px)
                        elif ly == 1: t = base + 2                         # 윗면 하이라이트
                        elif lx == 1: t = base + 1                         # 왼쪽 밝은 각
                        elif ry == 0: t = max(2, base - 1)                 # 아래 그늘
                        elif rx == 0 and pw > 5: t = max(2, base - 1)
                        elif rnd(x, y, seed + 9) > 0.94: t = min(6, t + 1)
                        elif rnd(x, y, seed + 19) > 0.94: t = max(2, t - 1)
                        c.put(x, y, S[max(1, min(6, t))])
        ys += ch


def ashlar_face(c, x0, y0, x1, y1, seed=0, lo=None, hi=None, ch=6, bw=10):
    """줄 높이가 일정한 장대석 쌓기(문루 기단의 격자 무늬, gate.png). 줄마다 절반씩 어긋난다. bw 가 16 의 약수면 칸 단위로 이어진다."""
    for y in range(y0, y1):
        row = (y - y0) // ch; ry = (y - y0) % ch
        off = bw // 2 if row % 2 else 0
        a = lo(y) if lo else x0
        b = hi(y) if hi else x1
        for x in range(max(a, x0), min(b, x1)):
            bx = (x + off) % bw
            si = (x + off) // bw
            q = rnd(si % (16 // max(1, min(16, bw)) * 4 + 4) + row * 11, row, 40 + seed)
            tone = 5 if q > 0.62 else (4 if q > 0.22 else 3)
            if ry == 0: tone = min(6, tone + 1)
            elif ry == ch - 1: tone = 2
            if bx == 0 and ry != ch - 1: tone = 2
            elif bx == 1 and ry not in (0, ch - 1): tone = min(6, tone + 1)
            if rnd(x, y, 70 + seed) > 0.95: tone = min(6, tone + 1)
            c.put(x, y, S[tone])


# ---------------------------------------------------------------- 성가퀴·걷는 길
def _merlon(c, x, ytop, w, fh=6, slit=False):
    """성가퀴 한 개: 윗면 2줄(밝음) + 앞면 fh 줄(왼쪽 밝음 → 오른쪽 어둠). 총안(작은 틈) 선택."""
    for y in range(2):
        for i in range(w):
            c.put(x + i, ytop + y, S[6] if (y == 0 or i == 0) else S[5])
    for y in range(fh):
        for i in range(w):
            f = i / max(1, w - 1)
            t = 5 if f < 0.25 else (4 if f < 0.65 else (3 if f < 0.9 else 2))
            if y == 0: t -= 1
            if y == fh - 1: t = max(2, t - 1)
            if rnd(x + i, y, 4) > 0.9: t = max(2, t - 1)
            c.put(x + i, ytop + 2 + y, S[max(2, t)])
    if slit:
        for y in range(1, fh - 1):
            c.put(x + w // 2, ytop + 2 + y, S[1]); c.put(x + w // 2 + 1, ytop + 2 + y, S[2])


def walkway(c, x0, y0, x1, y1, seed=0):
    """성벽 윗면(걷는 길): 큰 석판. 뒤쪽(위)이 밝고 앞쪽이 한 단 어둡다. 줄눈은 한 톤 어둡게만."""
    for y in range(y0, y1):
        row = (y - y0) // 7
        for x in range(x0, x1):
            t = 5 if (y - y0) < (y1 - y0) * 0.55 else 4
            off = 8 if row % 2 else 0
            if (x + off) % 16 == 0: t -= 1
            elif (y - y0) % 7 == 6: t -= 1
            elif rnd(x, y, 60 + seed) > 0.93: t = min(6, t + 1)
            c.put(x, y, S[t])
    for x in range(x0, x1):
        c.put(x, y0, S[6])


# ---------------------------------------------------------------- 가로 성벽
WH = 80            # 성벽 조각 높이(px)
Y_BACK, Y_WALK0, Y_WALK1 = 0, 8, 21     # 뒤 성가퀴 / 걷는 길 / 앞 성가퀴 시작
Y_FACE = 25                              # 앞 돌 쌓기 면이 시작하는 y
_MER = {0: [(3, 10, False)], 1: [(2, 11, True)], 2: [(1, 6, False), (9, 6, False)]}


def wall_h(var=0):
    """가로 성벽 16×80 (북·남 변). 위부터: 뒤 성가퀴(톱니 실루엣) → 걷는 길(석판, 위에서 본 두께 2칸) → 앞 턱(코니스) → 작은 장대석 줄 → 아래 큰 막돌.
    변형 0=성가퀴 하나, 1=총안 있는 성가퀴, 2=쌍 성가퀴. 성가퀴·줄눈은 모두 칸 안에서 닫혀 있어 변형을 섞어 이어도 된다.
    통행: 없음(막힘). 걸을 수 있는 건 위 걷는 길 면뿐이고 칸으로는 막힌다."""
    c = Cv(T, WH)
    walkway(c, 0, Y_WALK0, T, Y_FACE - 2, seed=var)
    for x in range(T):                                                      # 성가퀴 사이 뒤 머릿돌 띠(틈으로 풀이 비치지 않게)
        c.put(x, 2, S[5]); c.put(x, 3, S[4]); c.put(x, 4, S[4]); c.put(x, 5, S[4]); c.put(x, 6, S[5]); c.put(x, 7, S[3])
    for (mx, mw, sl) in _MER[var]:
        _merlon(c, mx, Y_BACK, mw, fh=6, slit=sl)
    for x in range(T):                                                      # 걷는 길 앞 가장자리 턱(코니스) + 그늘
        c.put(x, Y_FACE - 2, S[6]); c.put(x, Y_FACE - 1, S[5]); c.put(x, Y_FACE, S[2])
    ashlar_face(c, 0, Y_FACE + 1, T, 46, seed=var * 3, ch=6, bw=8)
    rubble_face(c, 0, 46, T, WH, seed=var * 5 + 1)
    return c


def wall_end(side='l', var=0):
    """성벽 끝(문·망루와 맞닿는 쪽): 곧게 잘린 끝에 큰 귀돌(우각 장대석)을 세우고 성가퀴를 한 개 더 높인다.
    귀돌이 선 쪽 = side. 문·망루가 왼쪽에 있으면 'l' 을, 오른쪽에 있으면 'r' 을 쓴다(귀돌이 문 쪽 가장자리)."""
    c = wall_h(var)
    xs = list(range(0, 5)) if side == 'l' else list(range(T - 5, T))
    for y in range(Y_WALK0, WH):
        for k, x in enumerate(xs):
            kk = k if side == 'l' else 4 - k
            if y < Y_FACE:
                t = 6 if kk == 0 else 5
            else:
                yy = y - Y_FACE
                blk = yy // 12
                inb = yy % 12
                long_ = (blk % 2 == 0)
                kk2 = kk if long_ else max(0, kk - 1)
                t = 6 if kk2 == 0 else (5 if kk2 == 1 else 4)
                if not long_ and kk == 0: t = 3
                if inb == 0: t = min(6, t + 1)
                if inb == 11: t = 2
                if kk == 4 and inb > 0: t = 3 if long_ else 2
            c.put(x, y, S[t])
    ex = 0 if side == 'l' else T - 8
    _merlon(c, ex, Y_BACK, 8, fh=6)
    return c


# ---------------------------------------------------------------- 세로 성벽 (동서 변)
VW = 48            # 폭 3칸을 꽉 채운다: 서쪽 옆면 12px + 윗면 36px(성가퀴 띠 9 · 걷는 길 18 · 성가퀴 띠 9). 땅 그림자는 조각 밖 별도 항목(demo_gungnae)
OX = 0
FACE_W, TOP_X0, TOP_X1 = 12, 12, 48
BAND, WALK = 9, 18


def _vwall_cols(c, y0, y1, seed, shadow=False, face=True):
    """세로 성벽 한 줄(폭 48): 3/4 시점에서 서쪽 옆면(돌 쌓기, 빛을 받아 밝음)이 왼쪽에 보이고, 그 옆에 윗면(성가퀴 띠 · 걷는 길 · 성가퀴 띠),
    오른쪽에는 땅에 지는 그림자(반투명 8px). 가로 성벽의 앞면(장대석+막돌)과 같은 돌 문법이다.
    옆면: 12px = 돌 줄 3(4px씩)이 세로로 달리고 줄눈은 가로 틱. 성가퀴는 10줄 + 틈 6줄 주기(16)라 칸 위아래로 이어진다."""
    for y in range(y0, y1):
        if face:
            for x in range(OX, OX + FACE_W):                                 # 옆면
                cidx = (x - OX) // 4
                blk = 16 if hsh(cidx, seed, 17) % 2 else 8
                off = (cidx * 5 + seed * 3) % blk
                t = (4, 5, 5)[cidx]
                if (y + off) % blk == 0: t = 2                                # 가로 줄눈
                elif (y + off) % blk == 1: t = min(6, t + 1)                  # 줄눈 아래 밝은 모서리
                elif (x - OX) % 4 == 0 and cidx > 0: t = max(2, t - 1)        # 줄 사이 세로 틈
                elif (x - OX) % 4 == 1: t = min(6, t + 1)                            # 돌 왼쪽 밝은 각
                elif rnd(x, y, 70 + seed) > 0.92: t = max(2, t - 1)
                if x == OX + FACE_W - 1: t = 3                                # 윗면과 만나는 아래 그늘선
                c.put(x, y, S[t])
        for x in range(TOP_X0 + BAND, TOP_X0 + BAND + WALK):                  # 걷는 길
            t = 5 if x < TOP_X0 + BAND + WALK // 2 else 4
            if (y + seed * 3) % 8 == 7: t -= 1
            elif x == TOP_X0 + BAND: t = 6
            elif rnd(x, y, 80 + seed) > 0.93: t = min(6, t + 1)
            c.put(x, y, S[t])
        m = (y + seed * 4) % 16
        for (ax, bx, left) in ((TOP_X0, TOP_X0 + BAND, True), (TOP_X0 + BAND + WALK, TOP_X1, False)):    # 성가퀴 띠
            for x in range(ax, bx):
                u = x - ax
                if m < 10:
                    if u == 0: t = 6
                    elif u < 5: t = 6 if left else 5
                    else: t = 4 if left else 3
                    if m == 0: t = 6
                    if m == 9: t = max(2, t - 2)
                    if m in (4, 5) and u == 4 and seed % 2: t = 1
                else:
                    t = 3 if left else 2                                      # 성가퀴 사이 낮은 턱(어두워 이빨이 도드라진다)
                    if u == 0: t = 4 if left else 3
                c.put(x, y, S[t])
        if shadow:                                                            # 오른쪽 땅 그림자(아래로 갈수록 옅다)
            for i, al in enumerate((80, 62, 42, 22)):
                c.put(TOP_X1 + i, y, SHADOW, al)


def wall_v(var=0, face='r'):
    """세로 성벽 48×16 (동·서 변): 서쪽 옆면(돌 쌓기) + 윗면(성가퀴·걷는 길) + 오른쪽 땅 그림자. 위아래 이음 없이 이어지고 변형 3종은 섞어 쓴다.
    face='l' 은 줄눈·성가퀴 위상만 다른 짝(같은 문법). 통행: 없음(막힘)."""
    c = Cv(VW, T)
    _vwall_cols(c, 0, T, var + (3 if face == 'l' else 0))
    return c


def wall_corner(kind):
    """모서리 48×80. NW/NE = 위쪽 모서리: 위 가장자리를 뒤 성가퀴 줄이 가로로 덮고 세로 성벽(옆면+윗면)이 아래로 이어진다(가로 성벽은 동·서로).
    SW/SE = 아래쪽 모서리: 세로 성벽이 위에서 내려와 걷는 길 마루가 되고, 앞은 가로 성벽과 같은 앞 성가퀴·돌 쌓기가 땅까지 보인다.
    걷는 길 높이·성가퀴·돌 줄은 wall_h 와 같은 좌표라 가로 성벽과 이음 없이 붙는다."""
    c = Cv(VW, WH)
    east = kind[1] == 'W'            # NW/SW: 가로 성벽이 동쪽(오른쪽)으로 이어진다
    north = kind[0] == 'N'
    hz = wall_h(1)
    arm = Cv(VW, WH)
    _vwall_cols(arm, 0, WH, 1, shadow=False)
    sh = arm

    def copy_hz(xa, xb, ya, yb):
        for y in range(ya, yb):
            for x in range(xa, xb):
                c.a[y, x] = hz.a[y, x % T]

    def copy_arm(xa, xb, ya, yb, src=arm):
        for y in range(ya, yb):
            for x in range(xa, xb):
                c.a[y, x] = src.a[y, x]
    tx0, tx1 = TOP_X0 + BAND, TOP_X0 + BAND + WALK     # 세로 걷는 길
    if east:
        ax0, ax1 = tx1, VW                             # 가로 팔이 열린 구간(32..47)
    else:
        ax0, ax1 = 0, tx0                              # (0..18)
    if north:
        copy_arm(0, VW, Y_WALK0, WH, sh)                   # 세로 성벽(전체 높이)
        copy_hz(0, VW, 0, Y_WALK0)                         # 위 가장자리: 뒤 성가퀴 줄
        copy_hz(ax0, ax1, Y_WALK0, Y_FACE)                 # 열린 쪽: 걷는 길 + 앞 성가퀴
        # 열린 쪽 아래 가로 성벽 앞면(성벽이 가로로 이어지는 쪽)
        fx0, fx1 = (TOP_X1, VW) if east else (0, FACE_W)
        copy_hz(fx0, fx1, Y_FACE, WH)
    else:
        copy_arm(0, VW, 0, Y_FACE, arm)                    # 위에서 내려오는 세로 성벽
        copy_hz(ax0, ax1, 0, Y_FACE)                       # 열린 쪽: 뒤 성가퀴 + 걷는 길 + 앞 성가퀴
        copy_hz(0, VW, Y_WALK1 - 1, WH)                    # 앞 성가퀴와 돌 쌓기 면(전체 폭)
        xs = range(0, 4) if east else range(VW - 4, VW)    # 바깥 모서리 귀돌
        for y in range(Y_FACE, WH):
            for k, x in enumerate(xs):
                kk = k if east else 3 - k
                yy = y - Y_FACE; inb = yy % 12; long_ = (yy // 12) % 2 == 0
                t = 6 if kk == 0 else (5 if kk == 1 else 4)
                if not long_ and kk == 0: t = 3
                if inb == 0: t = min(6, t + 1)
                if inb == 11: t = 2
                if kk == 3: t = 3
                c.put(x, y, S[t])
    return c


# ---------------------------------------------------------------- 문루 공통 부품
def _arch_passage(c, cx, ybot, pw, sh, ring=6, seed=0, bars=True):
    """기단 앞면에 뚫린 반원 아치 통로(gate.png): 둘레는 쐐기돌 띠(밝은 돌), 안쪽은 어두운 창살, 아래는 석판 길.
    cx = 가운데 x, ybot = 통로 바닥 y(포함 안 함), pw = 통로 폭(px), sh = 곧은 기둥 부분 높이. 아치 윗부분은 반원(rx=pw/2, ry=pw*0.55)."""
    rx = pw / 2.0
    ry = pw * 0.55
    yspring = ybot - sh                       # 아치가 시작되는 y
    top = int(yspring - ry) - ring
    wood, earth = RGB['wood'], RGB['earth']
    for y in range(top, ybot):
        for x in range(int(cx - rx - ring), int(cx + rx + ring) + 1):
            dx = (x + 0.5) - cx
            if y < yspring:
                u = dx / rx; v = (y + 0.5 - yspring) / ry
                d = math.sqrt(u * u + v * v)
                inner = d <= 1.0
                outer = (math.sqrt((dx / (rx + ring)) ** 2 + ((y + 0.5 - yspring) / (ry + ring)) ** 2)) <= 1.0
            else:
                inner = abs(dx) <= rx
                outer = abs(dx) <= rx + ring
            if not outer:
                continue
            if inner:
                if y >= ybot - 4:                                           # 문턱 석판(길과 같은 결, 밝은 줄)
                    t = 5 if (y - (ybot - 4)) < 1 else 4
                    if (x // 8) % 2 and (y - (ybot - 4)) == 2: t = 3
                    c.put(x, y, S[t]); continue
                tt = (y - top) / max(1.0, (ybot - top))
                col = S[0] if tt < 0.7 else S[1]
                if bars:
                    if tt > 0.55: col = S[1] if (x + y) % 5 else S[2]       # 열린 문: 안쪽이 깊어 어두워진다(창살 없음)
                    elif tt > 0.3 and x % 7 == 0: col = S[1]
                c.put(x, y, col)
            else:
                # 쐐기돌 띠: 각도마다 돌 한 개씩 번갈아 밝게
                if y < yspring:
                    ang = math.atan2(y - yspring, dx)
                    seg = int(ang * 7.0)
                else:
                    seg = y // 6
                col = S[6] if seg % 2 else S[5]
                if dx > rx * 0.2: col = S[5] if seg % 2 else S[4]
                dd = (math.sqrt((dx / (rx + ring)) ** 2 + ((y + 0.5 - yspring) / (ry + ring)) ** 2)) if y < yspring else abs(dx) / (rx + ring)
                if dd > 1.0 - 1.4 / (rx + ring): col = S[3]
                if dd < (rx + 1.0) / (rx + ring) and dd > (rx) / (rx + ring) - 0.0: col = S[2] if dx > 0 else S[3]
                c.put(x, y, col)
    # 안쪽 가장자리 그늘(오른쪽)
    for y in range(int(yspring), ybot - 6):
        c.put(int(cx + rx) - 1, y, wood[1]); c.put(int(cx + rx) - 2, y, wood[1])
    return top


_GLYPHS = (("####", "#..#", "#..#", "#..#", "####"), (".##.", "#..#", ".##.", "#..#", ".##."), ("####", "..#.", ".#..", "#...", "####"),
           ("#..#", "####", "#..#", "####", "#..#"), (".#..", "####", ".#..", "####", "..#."), ("####", "#..#", "####", "#..#", "#..#"),
           ("##.#", ".#.#", "####", ".#..", "##.."), ("####", "..#.", "####", ".#..", "#.##"))


def _plaque(c, cx, y, w=22, seed=0):
    """아치 위 작은 나무 현판(어두운 판 + 금빛 글자 모양 4x5 획). 문마다 글자 조합이 다르다(seed)."""
    x0 = cx - w // 2
    for yy in range(y, y + 7):
        for xx in range(x0, x0 + w):
            edge = yy in (y, y + 6) or xx in (x0, x0 + w - 1)
            c.put(xx, yy, RGB['wood'][5] if edge else RGB['wood'][1])
    n = max(2, (w - 3) // 5)
    gx0 = x0 + 1 + (w - 2 - (n * 5 - 1)) // 2
    for i in range(n):
        g = _GLYPHS[(seed * 3 + i * 5 + hsh(i, seed, 41)) % len(_GLYPHS)]
        for gy, row in enumerate(g):
            for gx, ch in enumerate(row):
                if ch == '#':
                    c.put(gx0 + i * 5 + gx, y + 1 + gy, RGB['straw'][5] if gx < 2 else RGB['straw'][4])


def _dancheong_column(c, x, y0, y1, w=7):
    """청록 단청 기둥(gate.png): 청록 몸통 + 붉은·금 띠 무늬, 밑에 둥근 주춧돌."""
    G, R, St = RGB['dgreen'], RGB['red'], RGB['straw']
    for y in range(y0, y1):
        rel = y - y0
        for i in range(w):
            t = 5 if i == 1 else (4 if i < w - 2 else (3 if i == w - 2 else 2))
            if i == 0: t = 4
            col = G[t]
            if rel % 12 in (3, 4) and 0 < i < w - 1: col = R[4] if i < w - 2 else R[3]       # 붉은 띠
            if rel % 12 == 5 and 1 < i < w - 1: col = St[5]                                  # 금빛 테
            if rel < 5:                                                                       # 기둥머리: 청 띠
                col = RGB['blue'][5 if i < w - 2 else 3] if rel % 2 == 0 else G[5 if i < 3 else 3]
            c.put(x + i, y, col)
    for i in range(w + 2):                                                                   # 주춧돌
        c.put(x - 1 + i, y1, S[6] if i < 3 else S[5]); c.put(x - 1 + i, y1 + 1, S[4] if i < 4 else S[3])
        c.put(x - 1 + i, y1 + 2, S[3] if i < 5 else S[2])


def _floor_platform(c, x0, x1, y0, y1):
    """누각 마루(밝은 윗면): 앞쪽 가장자리가 밝고 이음은 가로."""
    W = RGB['wood']
    for y in range(y0, y1):
        for x in range(x0, x1):
            t = 5 if (y - y0) < 3 else 4
            if (x // 5 + y // 4) % 3 == 0 and (y - y0) % 4 == 3: t -= 1
            c.put(x, y, W[t])
    for x in range(x0, x1): c.put(x, y1 - 1, W[6])


def _pavilion(c, x0, x1, ytop, ybot, cols=None, rail=True):
    """열린 누각: 뒤가 어두운 안쪽, 마루, 청록 단청 기둥 줄, 앞 난간. 높이 ytop..ybot(마루 앞 끝)."""
    E, W = RGB['earth'], RGB['wood']
    for y in range(ytop, ybot):
        for x in range(x0, x1):
            tt = (y - ytop) / max(1.0, ybot - ytop)
            c.put(x, y, E[0] if tt < 0.4 else (E[1] if tt < 0.65 else W[2]))
    # 안쪽 뒷벽에 보이는 칸막이 살(어둡게)
    for x in range(x0 + 4, x1 - 4, 8):
        for y in range(ytop + 2, ytop + int((ybot - ytop) * 0.55)):
            c.put(x, y, E[2] if (y % 3) else E[1])
    _floor_platform(c, x0, x1, ybot - 9, ybot)
    n = cols or max(3, (x1 - x0) // 32 + 1)
    step = (x1 - x0 - 8) / float(n - 1)
    xs = [int(x0 + 2 + i * step) for i in range(n)]
    for xp in xs:
        _dancheong_column(c, xp, ytop, ybot - 8)
    if rail:
        for x in range(x0 + 2, x1 - 2):
            if any(xp - 1 <= x < xp + 7 for xp in xs): continue
            c.put(x, ybot - 5, W[5]); c.put(x, ybot - 4, W[3])
            if x % 4 == 1:
                for y in range(ybot - 3, ybot - 1): c.put(x, y, W[3])
    return xs


def _tile_roof(c, x, y, w, h, wing=22, style='dg'):
    """청록 기와 지붕(roof3d). 붙인 뒤 지붕 화소의 열별 맨 아래 y 를 돌려준다(처마 그늘용)."""
    import roof3d
    r = roof3d.roof(w, h, style, wing=wing)
    c.paste(r, x, y)
    bottoms = {}
    for xx in range(w):
        col = [yy for yy in range(r.h) if r.a[yy, xx, 3] == 255]
        if col:
            bottoms[x + xx] = y + max(col)
    return bottoms


def _eave_shade(c, bottoms, depth=4):
    """지붕 처마 바로 아래(실제 지붕이 있는 열만) 서까래 그늘: 어두운 목재 세로 살. 지붕 없는 열은 건드리지 않는다."""
    W = RGB['wood']
    for x, yb in bottoms.items():
        for j in range(1, depth + 1):
            y = yb + j
            if 0 <= y < c.h:
                col = W[1] if j <= 2 else W[2]
                if x % 3 == 0 and j >= 2: col = W[2] if j == 2 else W[3]
                c.put(x, y, col)


def _upper_hall(c, x0, x1, y, h=14):
    """이중 처마의 위 몸체: 아래 지붕 위에 올라앉은 짧은 벽 한 단 — 청록 단청 기둥 + 어두운 살창 칸 + 위쪽 단청 띠(공포)."""
    W, Gn, Rd, Bl = RGB['wood'], RGB['dgreen'], RGB['red'], RGB['blue']
    E = RGB['earth']
    for yy in range(y, y + h):
        for x in range(x0, x1):
            t = E[1] if yy > y + 4 else W[2]
            if yy == y + h - 1: t = E[0]
            c.put(x, yy, t)
    # 살창 칸(세로 살)
    for x in range(x0 + 8, x1 - 8):
        if (x - x0) % 16 not in (0, 1, 2, 3, 4, 5):
            for yy in range(y + 6, y + h - 2):
                if x % 2 == 0: c.put(x, yy, W[3])
    # 기둥
    for xp in range(x0 + 2, x1 - 4, 16):
        for yy in range(y + 3, y + h):
            for i in range(4):
                c.put(xp + i, yy, Gn[5 if i == 1 else (4 if i < 3 else 3)] if yy % 6 else Rd[4 if i < 3 else 3])
    # 위쪽 단청 띠(공포)
    for x in range(x0, x1):
        k = (x // 3) % 4
        c.put(x, y, [Gn[4], Rd[3], Bl[4], Rd[3]][k])
        c.put(x, y + 1, Gn[3] if k % 2 == 0 else Bl[3])
        c.put(x, y + 2, W[1])
    for x in range(x0 + 3, x1 - 4, 8):                      # 두공 덩이
        for yy in range(y + 3, y + 6):
            wd = 5 if yy == y + 3 else 3
            for i in range(wd):
                c.put(x + (5 - wd) // 2 + i, yy, W[5] if i < wd // 2 + 1 else W[3])


def _bracket_band(c, x0, x1, y, h=8):
    """누각 윗부분 창방·두공 띠: 어두운 보 + 청·적 단청 줄 + 6px 마다 두공(공포) 덩이."""
    W, Gn, Rd, Bl = RGB['wood'], RGB['dgreen'], RGB['red'], RGB['blue']
    for yy in range(y, y + h):
        for x in range(x0, x1):
            c.put(x, yy, W[2] if yy == y else W[1])
    for x in range(x0, x1):
        k = (x // 3) % 4
        c.put(x, y + 1, [Gn[4], Rd[3], Bl[4], Rd[3]][k])
        c.put(x, y + 2, Gn[3] if k % 2 == 0 else Bl[3])
    for x in range(x0 + 2, x1 - 5, 8):
        for yy in range(y + 3, y + h):
            wd = 6 if yy < y + 5 else 3
            for i in range(wd):
                c.put(x + (6 - wd) // 2 + i, yy, W[5] if i < wd // 2 + 1 else W[3])


# ---------------------------------------------------------------- 문루
def _base_block(W, H, face_h, inset):
    """문루 기단 앞면(사다리꼴: 아래가 넓다)의 좌우 경계 함수와 앞면 시작 y."""
    fy0 = H - face_h
    lo = lambda y: int(round(inset * (1 - (y - fy0) / max(1, face_h - 1))))
    hi = lambda y: W - lo(y)
    return fy0, lo, hi


def _base_top(c, lo, hi, fy0, top0):
    """기단 윗면(누각 마루 앞의 석판 길)과 앞 성가퀴."""
    for y in range(top0, fy0):
        for x in range(lo(fy0), hi(fy0)):
            t = 5 if (x // 6 + y) % 5 else 4
            if y == top0: t = 6
            c.put(x, y, S[t])


def _base_front(c, W, H, fy0, lo, hi, seed):
    """기단 앞면: 장대석 쌓기 + 윗단 밝은 줄 + 사다리꼴 좌우 귀돌 선."""
    ashlar_face(c, 0, fy0, W, H, seed=seed, lo=lo, hi=hi)
    for y in range(fy0, fy0 + 2):
        for x in range(lo(y), hi(y)):
            c.put(x, y, S[6] if y == fy0 else S[2])
    for y in range(fy0, H):
        c.put(lo(y), y, S[6]); c.put(lo(y) + 1, y, S[5]); c.put(hi(y) - 1, y, S[3])


def gate_great(bays=12, pass_w=64, variant=0):
    """대문루 (북·남문용): 돌 기단(벽돌 쌓기·사다리꼴) + 반원 아치 통로(안쪽 어두운 창살) + 위에 청록 기와 이중 처마 누각 + 현판.
    폭 bays 칸(12 또는 8). pass_w = 통로 폭(px, 칸 수의 배수). 높이는 칸 단위로 맞춘다."""
    W = bays * T
    face_h, plat, pav_h = 80, 14, 36
    lower_h = 50 if bays >= 10 else 42
    upper_h = 36 if bays >= 10 else 30
    uhall = 14
    # fy0(앞면 시작 y) 기준 상대 위치: 위로 갈수록 음수
    top0 = -plat
    ymid = top0 - pav_h                       # 누각 윗끝
    ylow = ymid + 5 - lower_h + 1             # 아래 처마 지붕 윗끝(지붕 맨 아래가 누각 위에 5px 걸친다)
    hall_bot = ylow + 12
    yhall = hall_bot - uhall
    yup = yhall + 5 - upper_h + 1
    H = ((face_h - yup + 1 + T - 1) // T) * T
    fy0 = H - face_h
    A = lambda r: fy0 + r
    c = Cv(W, H)
    _, lo, hi = _base_block(W, H, face_h, inset=10)
    ground_shadow(c, W // 2 + 8, H - 2, W // 2 - 6, 3, 70)
    _base_top(c, lo, hi, fy0, A(top0))
    px0, px1 = 12, W - 12
    _pavilion(c, px0, px1, A(ymid), A(top0) + 6, cols=bays // 2 + 1)
    _bracket_band(c, px0 - 2, px1 + 2, A(ymid) - 1, h=8)
    bot = _tile_roof(c, 0, A(ylow), W, lower_h, wing=26 if bays >= 10 else 22)
    _eave_shade(c, bot, 4)
    uw = W - (6 * T if bays >= 10 else 4 * T)
    ux0 = (W - uw) // 2
    _upper_hall(c, ux0 + 8, ux0 + uw - 8, A(yhall), uhall)
    _tile_roof(c, ux0, A(yup), uw, upper_h, wing=18 if bays >= 10 else 14)
    for xm in range(lo(fy0) + 4, hi(fy0) - 12, 16):
        _merlon(c, xm, fy0 - 8, 10, fh=4)
    _base_front(c, W, H, fy0, lo, hi, variant)
    top = _arch_passage(c, W // 2, H, pass_w, sh=24 if pass_w >= 48 else 18, ring=6)
    _plaque(c, W // 2, max(fy0 + 3, top - 10), w=26 if pass_w >= 48 else 20, seed=variant + bays)
    outline(c)
    cx0 = (W // 2 - pass_w // 2) // T
    PASSAGE[f'gungnae_gate_great_{bays}'] = {'cols': (cx0, cx0 + pass_w // T), 'rows': ((H - 2 * T) // T, H // T), 'note': '아치 통로 바닥 2칸 높이를 걷는다. 그 위(아치 윗부분·기단·누각)는 캐릭터 위에 그린다.'}
    return c


def gate_small(bays=6, pass_w=32):
    """소문루 (동·서문용): 작은 반원 아치 + 단층 청록 지붕. 기단은 낮고 아치 위에 작은 누각 한 칸."""
    W = bays * T
    face_h, plat, pav_h, roof_h = 64, 12, 24, 46
    top0 = -plat
    ymid = top0 - pav_h
    yroof = ymid + 5 - roof_h + 1
    H = ((face_h - yroof + 1 + T - 1) // T) * T
    fy0 = H - face_h
    A = lambda r: fy0 + r
    c = Cv(W, H)
    _, lo, hi = _base_block(W, H, face_h, inset=6)
    ground_shadow(c, W // 2 + 6, H - 2, W // 2 - 4, 3, 70)
    _base_top(c, lo, hi, fy0, A(top0))
    px0, px1 = 12, W - 12
    _pavilion(c, px0, px1, A(ymid), A(top0) + 6, cols=4, rail=True)
    _bracket_band(c, px0 - 2, px1 + 2, A(ymid) - 1, h=8)
    bot = _tile_roof(c, 0, A(yroof), W, roof_h, wing=20)
    _eave_shade(c, bot, 4)
    for xm in range(lo(fy0) + 3, hi(fy0) - 10, 16):
        _merlon(c, xm, fy0 - 8, 9, fh=4)
    _base_front(c, W, H, fy0, lo, hi, 3)
    top = _arch_passage(c, W // 2, H, pass_w, sh=14, ring=5)
    _plaque(c, W // 2, max(fy0 + 3, top - 9), w=18, seed=bays + 11)
    outline(c)
    PASSAGE[f'gungnae_gate_small_{bays}'] = {'cols': ((W // 2 - pass_w // 2) // T, (W // 2 + pass_w // 2) // T),
                                             'rows': ((H - 2 * T) // T, H // T), 'note': '아치 통로 바닥 2칸 높이.'}
    return c


def gate_side(bays=5, rows=8, ramp='teal', seed=3, post=(18, 62), pw=6, roof=(8, 72), wall=None, wall_x=16, plaster=False):
    """측면 문루 (동·서문용): 세로 성벽 한 줄을 동서로 가로지르는 열린 문루. 통로(맨 아래 4행)를 기준으로 짠다.
    3/4 시점에서 용마루가 남북(성벽 방향)으로 달리는 맞배 지붕이 통로 바로 위에 얹히고(rows-4 행), 지붕 밑 남쪽 처마 아래 양끝(=벽 몸체 양끝)에 기둥,
    기둥 사이로 통로 바닥(길)이 보인다. 지붕·기둥은 같은 중심선을 쓰고 기둥 바깥 끝 = 성벽 몸체 바깥 끝. 위쪽에는 wall(성벽 한 칸 그림)을 붙여
    지붕 뒤로 성벽이 이어지게 한다. post = (왼쪽 기둥 x, 오른쪽 기둥 바깥 끝 x), pw = 기둥 굵기, roof = 지붕 x 범위.
    통행: 맨 아래 4행. 지붕 행(위 rows-4)은 막힘."""
    import gungnae_houses as GH
    W, H = bays * T, rows * T
    c = Cv(W, H)
    if wall is not None:
        c.paste(wall, wall_x, 0)
    x0, x1 = roof
    y_e = (rows - 4) * T
    half = (x1 - x0) / 2.0
    rise = int(max(8, min(22, half * 0.52)))
    yb = y_e - rise - 2
    G = GH.RAMPS[ramp]
    px0, px1 = post
    wl = wall if False else (px0 - 1, px1 + 1)
    GH.gable_band(c, x0, x1, 8, yb, y_e, G, 'tile', 'cap', 'gable', wall=wl, seed=seed)
    Wd = RGB['wood']
    k0 = (5, 4, 4, 3, 3, 2) if not plaster else (5, 4, 4, 3, 2, 1)
    for xp in (px0, px1 - pw):                                          # 남쪽 처마 밑 기둥(통로 양끝, 아래 4행 높이)
        for y in range(y_e, H):
            for k in range(pw):
                kk = min(5, k * 6 // pw)
                c.put(xp + k, y, S[k0[kk]] if not plaster else Wd[k0[kk]])
        for k in range(pw + 2):                                         # 주춧돌
            c.put(xp - 1 + k, H - 2, S[6]); c.put(xp - 1 + k, H - 1, S[3])
    for x in range(px0 - 1, px1 + 1):                                   # 기둥 머리를 잇는 문틀 보(도리): 두 기둥이 한 문틀로 읽히게 한다
        for k, t in enumerate((6, 5, 4, 3, 2)):
            c.put(x, y_e + k, Wd[t] if plaster else S[t])
        if (x - px0) % 6 == 2:
            c.put(x, y_e + 5, Wd[2] if plaster else S[2])
    for y in range(y_e, y_e + 6):                                       # 지붕 밑 처마 그늘(길 위, 반투명)
        for x in range(px0 + pw, px1 - pw):
            c.put(x, y, SHADOW, 120 - (y - y_e) * 18)
    for y in range(y_e + 3, H - 1):                                     # 기둥 오른쪽 땅 그림자(기둥·벽이 오른쪽 아래로 드리운다)
        for i in range(pw + 4):
            if c.a[y, px1 + i, 3] == 0:
                c.put(px1 + i, y, SHADOW, max(10, 74 - i * 9))
    outline(c)
    PASSAGE[f'gungnae_gate_side_{bays}' if not plaster else f'palace_gate_side_{bays}'] = {'cols': (0, bays), 'rows': (rows - 4, rows),
                                            'note': '맨 아래 4행이 동서로 걷는 통로(길이 지붕 밑을 지난다). 위 행은 지붕이라 막힘, 지붕은 캐릭터 위에 그린다.'}
    return c


def tower_corner(bays=5):
    """모서리 망루 (성벽 코너 위 2층 누각, 회색 돌 기단): 돌 기단 + 1층(어두운 살창 벽) + 가운데 처마 + 2층 열린 누각 + 청록 큰 지붕.
    폭 bays 칸, 통행 불가(성벽 모서리 장애물). 가로·세로 성벽이 아래 좌우로 붙는다."""
    W = bays * T
    face_h, plat, f1, mid_h, f2, roof_h = 76, 10, 22, 30, 24, 44
    top0 = -plat
    top1 = top0 - f1                          # 1층 윗끝
    ymid = top1 + 5 - mid_h + 1               # 가운데 처마 지붕 윗끝
    top2 = ymid + 12 - f2                     # 2층 누각 윗끝(아랫끝은 가운데 지붕 위에 12px 걸친다)
    yroof = top2 + 6 - roof_h + 1
    H = ((face_h - yroof + 1 + T - 1) // T) * T
    fy0 = H - face_h
    A = lambda r: fy0 + r
    c = Cv(W, H)
    _, lo, hi = _base_block(W, H, face_h, inset=8)
    ground_shadow(c, W // 2 + 6, H - 2, W // 2 - 3, 3, 70)
    _base_top(c, lo, hi, fy0, A(top0))
    _upper_hall(c, 8, W - 8, A(top1), f1 + 6)
    bot1 = _tile_roof(c, 0, A(ymid), W, mid_h, wing=16)
    _eave_shade(c, bot1, 3)
    _pavilion(c, 14, W - 14, A(top2), A(ymid) + 12, cols=3, rail=False)
    _bracket_band(c, 12, W - 12, A(top2) - 1, h=8)
    bot2 = _tile_roof(c, 2, A(yroof), W - 4, roof_h, wing=18)
    _eave_shade(c, bot2, 4)
    for xm in range(lo(fy0) + 3, hi(fy0) - 10, 16):
        _merlon(c, xm, fy0 - 7, 9, fh=4)
    _base_front(c, W, H, fy0, lo, hi, 7)
    for ax in (W // 2 - 10, W // 2 + 8):                       # 기단 앞 총안(화살 구멍)
        for ay in range(fy0 + 18, fy0 + 32):
            c.put(ax, ay, S[1]); c.put(ax + 1, ay, S[1]); c.put(ax - 1, ay, S[5]); c.put(ax + 2, ay, S[3])
    outline(c)
    PASSAGE[f'gungnae_tower_corner_{bays}'] = {'cols': (0, 0), 'rows': (0, 0), 'note': '통행 불가(성벽 모서리 장애물).'}
    return c


# ---------------------------------------------------------------- 돌다리
def _post(c, x, ybase, h=18, w=7):
    """다리 난간 기둥(흰회색 돌) + 두공 한 쌍: 기둥 위에 폭이 두 번 넓어지는 받침(두공)과 보주."""
    for y in range(ybase - h, ybase):
        for i in range(w):
            t = 5 if i < 2 else (4 if i < w - 2 else 3)
            if i == 0: t = 6
            if y == ybase - 1: t = 2
            c.put(x + i, y, S[t])
    yt = ybase - h
    for k, (ww, tone) in enumerate(((w + 4, 5), (w + 2, 6))):               # 두공: 아래 큰 받침 + 위 작은 받침
        for i in range(ww):
            xx = x - (ww - w) // 2 + i
            t = 6 if (k == 1 or i < 2) else (5 if i < ww - 2 else 3)
            c.put(xx, yt - 2 + k * 0 - k * 2 + 2 * k + (0 if k == 0 else -2), S[t])
            c.put(xx, yt - 1 + (0 if k == 0 else -2), S[max(2, t - 1)])
    for i in range(3):                                                        # 보주(둥근 머리)
        c.put(x + 2 + i, yt - 5, S[6]); c.put(x + 2 + i, yt - 4, S[5])
    c.put(x + 3, yt - 6, S[6])


def _rail_h(c, x0, x1, ytop, hgt, front=False):
    """가로 난간 한 줄(흰회색 돌): 윗돌 2줄(밝음) + 동자기둥 사이 비어 있는 칸 + 아래 받침. front=True 면 낮고 앞면이 크다."""
    for x in range(x0, x1):
        c.put(x, ytop, S[6]); c.put(x, ytop + 1, S[5])
        c.put(x, ytop + hgt - 2, S[5]); c.put(x, ytop + hgt - 1, S[3])
        if (x - x0) % 8 in (0, 1, 2):                                          # 난간동자
            for y in range(ytop + 2, ytop + hgt - 2):
                c.put(x, y, S[6] if (x - x0) % 8 == 0 else (S[5] if (x - x0) % 8 == 1 else S[3]))
        else:
            for y in range(ytop + 2, ytop + hgt - 2):
                if front: c.put(x, y, S[2] if y > ytop + 2 else S[3])


def _deck_h(c, x0, x1, y0, y1, seed=0, style=0):
    """돌다리 상판(위에서 본 회색 석판): 큰 판석을 어긋나게, 윗쪽이 밝다. style 1 = 가운데 길쭉한 어도(御道) 띠."""
    for y in range(y0, y1):
        row = (y - y0) // 8
        for x in range(x0, x1):
            t = 4 if (y - y0) < 2 else 5                     # 한 톤 판석: 뒤 난간 밑 2줄만 그늘(위/아래 반분 명암 없음)
            off = 10 if row % 2 else 0
            if (x - x0 + off) % 20 == 0: t -= 1
            elif (y - y0) % 8 == 7: t -= 1
            elif rnd(x, y, 120 + seed) > 0.93: t = min(6, t + 1)
            c.put(x, y, S[t])
    if style == 1:
        mid = (y0 + y1) // 2
        for x in range(x0 + 6, x1 - 6):
            c.put(x, mid, S[6] if x % 4 else S[5]); c.put(x, mid - 1, S[5])
            c.put(x, mid + 1, S[3]) if x % 8 < 4 else None


def _arch_water(x, y, y0):
    """다리 홍예 구멍 안: 위는 그늘(어두운 물), 아래로 갈수록 물빛, 드문 잔물결 한 점."""
    Wt = RGB['water']
    k = y - y0
    if k < 5: return Wt[0]
    if k < 8: return Wt[1]
    return Wt[3] if (x * 7 + y * 3) % 11 == 0 else Wt[2]


def stone_bridge_h(length=5, width=3, style=0, water=None):
    """돌다리 가로형(동서로 건넌다): 길이 length 칸 × 폭 width 칸 + 위 1칸(난간·기둥 머리) + 아래 1칸(앞 돌벽·아치 그림자).
    위부터: 뒤 난간(기둥 두공) → 상판(width 칸) → 앞 낮은 난간 → 앞면 돌벽(홍예 구멍으로 물이 비친다) → 물 그림자.
    통행: 상판 width 칸 전부(앞·뒤 난간 칸 포함 가장자리 6px 는 난간이 겹침). 위 1칸·아래 1칸은 막힘."""
    W = length * T
    H = (width + 2) * T
    c = Cv(W, H)
    y_deck0 = T
    y_deck1 = T + width * T
    _deck_h(c, 0, W, y_deck0, y_deck1, seed=style, style=style % 2)
    # 뒤 난간(상판 뒤쪽 가장자리에 서 있다) + 기둥
    _rail_h(c, 3, W - 3, y_deck0 - 6, 14)
    for x in (0, W - 9):
        _post(c, x, y_deck0 + 6, h=22)
    # 앞 낮은 난간 + 기둥
    _rail_h(c, 3, W - 3, y_deck1 - 8, 9, front=True)
    for x in (0, W - 9):
        _post(c, x, y_deck1 + 2, h=14)
    # 앞면 돌벽: 홍예 구멍
    fy0, fy1 = y_deck1 + 2, y_deck1 + 15
    for y in range(fy0, fy1):
        for x in range(0, W):
            row = (y - fy0) // 4
            off = 6 if row % 2 else 0
            t = 5 if x < W * 0.2 else (4 if x < W * 0.7 else 3)
            if (x + off) % 12 == 0: t = 2
            elif (y - fy0) % 4 == 3: t = 3
            if y == fy0: t = 6
            c.put(x, y, S[max(1, t)])
    wx0, wx1 = water if water else (0, W)                                  # 홍예는 물 위 구간에만 둔다(둑 위에는 구멍을 내지 않는다)
    narch = 1 if (wx1 - wx0) <= 4 * T else (2 if (wx1 - wx0) <= 6 * T else 3)
    span = (wx1 - wx0 - 12) / float(narch)
    for k in range(narch):
        cx = wx0 + 6 + span * (k + 0.5)
        rx = min(span * 0.36, 17)
        for y in range(fy0 + 3, fy1 + 1):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                u = (x + 0.5 - cx) / rx
                v = (y + 0.5 - (fy1 - 5)) / 7.0
                inside = (abs(u) <= 1.0 and v >= 0) or (u * u + v * v <= 1.0 and v < 0)
                if inside:
                    c.put(x, y, _arch_water(x, y, fy0))                      # 구멍 안은 그늘진 물(풀·포장이 비치지 않는다)
    for x in range(2, W - 2):                                              # 물에 닿는 그림자
        for j, al in enumerate((120, 80, 40)):
            if fy1 + j < H and c.a[fy1 + j, x, 3] == 0:
                c.put(x, fy1 + j, SHADOW, al)
    outline(c)
    PASSAGE[f'gungnae_bridge_h{length}'] = {'cols': (0, length), 'rows': (1, 1 + width), 'note': '상판 전체를 걷는다. 위 1행(뒤 난간 윗부분)·아래 1행(앞면 돌벽)은 걸을 수 없다.'}
    return c


def stone_bridge_v(length=5, width=3, style=0, landing=True):
    """돌다리 세로형(남북으로 건넌다): 길이 length 칸(세로) × 폭 width 칸 + 오른쪽 1칸(물 그림자) + 아래 1칸(남쪽 끝 돌벽·그림자).
    위에서 본 상판 + 양쪽 난간(윗돌 띠 + 옆면)과 네 모서리 기둥(두공 한 쌍씩). 남쪽 끝은 앞면 돌벽이 보이고 물에 그림자가 진다.
    통행: 상판 width 칸 × length 칸 전부. 맨 오른쪽 열과 맨 아래 행은 막힘."""
    W = (width + 1) * T
    H = (length + 1) * T
    DB0 = length * T                                 # 물 위 상판 남쪽 끝 y
    DB = H if landing else DB0                       # landing: 남쪽 끝은 물이 아니라 둑(땅)에 닿으므로 앞면 돌벽·홍예 없이 상판이 끝까지 간다
    c = Cv(W, H)
    dx0, dx1 = 5, width * T - 5                    # 상판 x 범위(양쪽 난간 5px 안쪽까지)
    for y in range(0 if landing else 4, DB):
        row = y // 12
        for x in range(dx0, dx1):
            off = 10 if row % 2 else 0
            t = 4 if x < dx0 + 2 else 5                     # 한 톤 판석: 왼쪽 난간 밑 2열만 그늘(좌/우 반분 명암 없음)
            if y % 12 == 11: t -= 1
            elif (x - dx0 + off) % 20 == 0: t -= 1
            elif rnd(x, y, 130 + style) > 0.93: t = min(6, t + 1)
            c.put(x, y, S[t])
    if style % 2 == 1:                              # 가운데 어도(御道) 띠
        mx = (dx0 + dx1) // 2
        for y in range(8, DB - 2):
            c.put(mx - 1, y, S[6] if y % 5 else S[5]); c.put(mx, y, S[5]); c.put(mx + 1, y, S[3])
    # 남쪽 끝 돌벽(앞면) — 홍예 구멍으로 물이 비친다
    nar = 1 if width <= 3 else 2
    for y in range(DB, DB + 11 if not landing else DB):
        for x in range(0, width * T):
            row = (y - DB) // 4
            off = 6 if row % 2 else 0
            t = 5 if x < width * T * 0.25 else (4 if x < width * T * 0.7 else 3)
            if (x + off) % 12 == 0: t = 2
            elif (y - DB) % 4 == 3: t = 3
            if y == DB: t = 6
            c.put(x, y, S[max(1, t)])
    span = (width * T - 10) / float(nar)
    for k in range(0 if landing else nar):
        cx = 5 + span * (k + 0.5)
        rx = min(span * 0.34, 12)
        for y in range(DB + 3, DB + 12):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                u = (x + 0.5 - cx) / rx
                v = (y + 0.5 - (DB + 7)) / 5.0
                inside = (abs(u) <= 1.0 and v >= 0) or (u * u + v * v <= 1.0 and v < 0)
                if inside:
                    c.put(x, y, _arch_water(x, y, DB))
    # 양쪽 난간: 윗돌 띠(밝음) + 안쪽 면 + 바깥 그늘
    for (rx0, left) in ((0, True), (width * T - 7, False)):
        for y in range(2, DB):
            for i in range(7):
                if left:
                    t = 6 if i < 2 else (5 if i < 5 else 3)
                else:
                    t = 5 if i < 2 else (4 if i < 5 else 2)
                if y % 8 in (0, 1) and i in (2, 3, 4): t = max(2, t - 1)
                c.put(rx0 + i, y, S[t])
    for (xx, yb, hh) in ((0, 20, 20), (width * T - 9, 20, 20), (0, DB + (-2 if landing else 4), 22), (width * T - 9, DB + (-2 if landing else 4), 22)):
        _post(c, xx, yb, h=hh, w=9)
    for y in range(26, DB0 - 2):                                              # 물 그림자(오른쪽 열): 물 위(데크 가운데~아래 구간)에만, 위쪽 둑 위에는 드리우지 않는다
        edge = min(y - 26, DB0 - 3 - y) + 2
        for x in range(width * T, W):
            if c.a[y, x, 3] == 0:
                al = (84 if x < width * T + 6 else 36) if edge > 3 else (40 if x < width * T + 6 else 14)
                c.put(x, y, SHADOW, al)
    outline(c)
    PASSAGE[f'gungnae_bridge_v{length}'] = {'cols': (0, width), 'rows': (0, length + (1 if landing else 0)), 'note': '상판 전체를 걷는다. 맨 오른쪽 열(물 그림자)은 막힘. landing 이면 맨 아래 행도 상판(둑에 닿는 끝)이다.'}
    return c


def narrow_bridge(length=4, vertical=False):
    """섬으로 가는 폭 1칸 나무 좁은 다리: 널판 상판 + 한쪽 새끼 난간(말뚝 기둥 + 밧줄) + 양 끝 돌 받침 + 물속 말뚝.
    가로형 length 칸 × 3칸(위 1: 난간 기둥 머리, 가운데 1: 상판, 아래 1: 말뚝·물 그림자). 세로형은 (2)칸 × length 칸. 통행은 상판 1칸."""
    Wd, S_ = RGB['wood'], RGB['straw']
    if not vertical:
        W, H = length * T, 3 * T
        c = Cv(W, H)
        y0, y1 = T + 1, 2 * T - 2
        for y in range(y0, y1):
            for x in range(0, W):
                k = x % 5
                t = 5 if (y - y0) < 4 else 4
                if k == 4: t = 2
                elif k == 0: t = min(6, t + 1)
                if (x // 5 + y // 6) % 3 == 0 and y % 6 == 5: t = 3
                c.put(x, y, Wd[t])
        for x in range(0, W): c.put(x, y1, Wd[2]); c.put(x, y1 + 1, Wd[1])
        for xx in range(4, W - 4, 16):                                         # 말뚝 기둥(뒤)
            for y in range(y0 - 12, y0 + 3):
                c.put(xx, y, Wd[5]); c.put(xx + 1, y, Wd[4]); c.put(xx + 2, y, Wd[2])
            c.put(xx, y0 - 13, Wd[6]); c.put(xx + 1, y0 - 13, Wd[5])
        for x in range(4, W - 4):                                              # 밧줄
            c.put(x, y0 - 8 + (1 if (x // 8) % 2 else 0), S_[4] if x % 3 else S_[3])
        for (a, b2) in ((0, 8), (W - 8, W)):                                   # 돌 받침
            for y in range(y0 - 1, y1 + 3):                                    # 갑판 높이에 맞춘 낮은 교대
                for x in range(a, b2):
                    c.put(x, y, S[5] if (y < y0 + 2) else (S[4] if (x * 3 + y) % 5 else S[3]))
        for xx in range(14, W - 10, 16):                                       # 물속 말뚝
            for y in range(y1 + 2, y1 + 12):
                c.put(xx, y, Wd[3]); c.put(xx + 1, y, Wd[2]); c.put(xx + 2, y, Wd[1])
        for x in range(6, W - 6):
            for j, al in enumerate((100, 60)):
                if c.a[y1 + 10 + j, x, 3] == 0: c.put(x, y1 + 10 + j, SHADOW, al)
        outline(c)
        PASSAGE[f'gungnae_bridge_narrow_h{length}'] = {'cols': (0, length), 'rows': (1, 2), 'note': '폭 1칸 상판만 걷는다.'}
    else:
        W, H = 2 * T, length * T
        c = Cv(W, H)
        x0, x1 = 5, T + 1
        for y in range(0, H):
            for x in range(x0, x1):
                k = y % 5
                t = 5 if x < x0 + 4 else 4
                if k == 4: t = 2
                elif k == 0: t = min(6, t + 1)
                c.put(x, y, Wd[t])
        for y in range(0, H): c.put(x1, y, Wd[2]); c.put(x1 + 1, y, SHADOW, 90)
        for yy in range(6, H - 4, 16):
            for y in range(yy - 10, yy + 2):
                c.put(x0 - 3, y, Wd[5]); c.put(x0 - 2, y, Wd[4]); c.put(x0 - 1, y, Wd[2])
        for y in range(2, H - 2):
            c.put(x0 - 2, y, S_[4] if y % 3 else S_[3]) if y % 16 not in range(0, 3) else None
        for yy in (0, H - 6):
            for y in range(yy, yy + 6):
                for x in range(x0 - 2, x1 + 2): c.put(x, y, S[5] if y == yy else S[4])
        outline(c)
        PASSAGE[f'gungnae_bridge_narrow_v{length}'] = {'cols': (0, 1), 'rows': (0, length), 'note': '폭 1칸만 걷는다.'}
    return c


# ---------------------------------------------------------------- 석판 대로 지형
def slab(v=0):
    """회색 석판 길(큰 직사각 돌을 어긋나게 쌓고 작은 점무늬가 박힌 포장). 16×16, 변형 3종은 이음 없이 섞어 깐다.
    줄눈은 한 톤 어두운 줄, 돌마다 위·왼쪽 1px 밝은 각, 아래·오른쪽 그늘. 돌 크기가 변형마다 다르다."""
    c = Cv(T, T)
    layout = {0: [(0, 8, (0, 10)), (8, 8, (5,))], 1: [(0, 8, (4,)), (8, 8, (0, 9))], 2: [(0, 8, (0,)), (8, 8, (0, 8))],
              3: [(0, 8, (2, 11)), (8, 8, (7,))], 4: [(0, 8, (6,)), (8, 8, (1, 12))]}[v % 5]
    for (ry0, rh, cuts) in layout:
        bounds = list(cuts) + [cuts[0] + T]
        for i in range(len(cuts)):
            a, b = bounds[i], bounds[i + 1]
            q = rnd(i + ry0 * 3, v, 211)
            base = 5 if q > 0.5 else 4
            for y in range(ry0, ry0 + rh):
                for x in range(a, b):
                    xx = x % T
                    ly, lx = y - ry0, x - a
                    t = base
                    if ly == rh - 1 or lx == b - a - 1: t = 4                 # 아래·오른쪽 줄눈
                    elif ly == 0: t = 6 if lx < (b - a) - 1 else 5
                    elif rnd(xx, y, 220 + v) > 0.95: t = 4                      # 작은 점무늬
                    elif rnd(xx, y, 230 + v) > 0.975: t = 6
                    c.put(xx, y, S[t])
    return c


def _slab_depth(mask, x, y):
    """석판 길 가장자리(직각, 둥글림 없음): 열린 변마다 바깥에서 안으로 풀 2px → 연석 윗면 2px (남쪽 변은 앞면 1px 이 더 붙는다) → 석판.
    반환 0=석판, 1=연석 윗면, 2=연석 앞면, 3=풀."""
    d = 0
    for bit, dist in ((1, y), (4, T - 1 - y), (8, x), (2, T - 1 - x)):
        if mask & bit: continue
        if dist <= 1: d = max(d, 3)
        elif bit == 4 and dist == 2: d = max(d, 2)
        elif dist <= (4 if bit == 4 else 3): d = max(d, 1)
    return d


def slab_edge(mask):
    """석판 길 이음(N=1,E=2,S=4,W=8: 이어지는 쪽). 이어지지 않는 변은 풀 → 연석 → 석판, 모서리는 직각. 길 끝·꺾임·T자·십자 16가지.
    넓은 대로의 가장자리·모서리를 이루는 오토타일이다(안쪽 칸은 mask 15 = 석판 그대로)."""
    c = Cv(T, T)
    base = slab(mask % 3)
    g = RGB['leaf']
    for y in range(T):
        for x in range(T):
            d = _slab_depth(mask, x, y)
            if d == 0:
                c.a[y, x] = base.a[y, x]
            elif d == 3:
                c.put(x, y, g[4] if rnd(x, y, 100) > 0.2 else g[3])
            elif d == 1:
                edge_in = any(not mask & bit and dist == lim for bit, dist, lim in ((1, y, 3), (4, T - 1 - y, 4), (8, x, 3), (2, T - 1 - x, 3)))
                c.put(x, y, S[5] if edge_in else S[6])
            else:
                c.put(x, y, S[3])
    return c


def slab_dirt(side):
    """흙길 ↔ 석판 전환 타일(문·다리 앞): 석판이 side 쪽(0=N,1=E,2=S,3=W)에서 와서 흙 쪽으로 돌 한 장씩 어긋나게 끝난다.
    칸을 세 덩이(폭 6·5·5)로 나눠 덩이마다 석판이 들어오는 깊이가 다르다. 칸 경계에서 같은 모양이 반복돼 이웃과 이어진다."""
    c = Cv(T, T)
    e = RGB['earth']
    sl = slab(1)
    blocks = [(0, 6, 8), (6, 11, 11), (11, 16, 9)]                          # (시작, 끝, 석판 깊이)
    for y in range(T):
        for x in range(T):
            if side in (0, 2):
                pos = x; dist = y if side == 0 else T - 1 - y
            else:
                pos = y; dist = x if side == 3 else T - 1 - x
            bi = next(i for i, (a, b2, d) in enumerate(blocks) if a <= pos < b2)
            a, b2, depth = blocks[bi]
            if dist < depth:
                c.a[y, x] = sl.a[y, x]
                if dist == depth - 1 or pos == b2 - 1: c.put(x, y, S[3])      # 돌 끝·옆 줄눈
                elif dist == depth - 2 or pos == a: c.put(x, y, S[6] if dist == depth - 2 else S[5])
            else:
                col = e[5]
                q = rnd(x, y, 300)
                if q < 0.16: col = e[4]
                elif q > 0.93: col = e[6]
                if dist == depth: col = e[3]                                     # 석판 끝 그림자
                c.put(x, y, col)
    return c


def diamond(v=0):
    """마름모 무늬 흙 광장 16×16(예식장 앞): v0 = 어두운 마름모 선 + 칸 가운데 점, v1 = 마름모 안팎을 밝고 어둡게 번갈아 칠한 체크.
    무늬가 16px 주기로 이어지고 모서리·변 가운데가 마름모 꼭짓점이라 칸을 어디에 놓아도 이어진다."""
    c = Cv(T, T)
    e = RGB['earth']
    for y in range(T):
        for x in range(T):
            dx = min(abs(x + 0.5 - 8), 16 - abs(x + 0.5 - 8))
            dy = min(abs(y + 0.5 - 8), 16 - abs(y + 0.5 - 8))
            m = abs(x + 0.5 - 8) + abs(y + 0.5 - 8)             # 칸 가운데 마름모(반경 8)
            inside = m < 8
            col = e[5]
            q = rnd(x, y, 400 + v)
            if q < 0.14: col = e[4]
            elif q > 0.94: col = e[6]
            if v == 1:
                col = (e[5] if q > 0.18 else e[4]) if inside else (e[4] if q > 0.16 else e[3])
                if inside and q > 0.9: col = e[6]
            if 7.2 <= m < 8.2 and (v == 1 or x % 2 == 0):                  # v0 은 점선 마름모
                col = e[2] if v == 0 else e[3]
            if v == 0 and m < 1.6:
                col = e[3]
            c.put(x, y, col)
    return c


def road_v(mask, v=0, ruts=True):
    """흙길(ground.road 와 같은 문법) + 변형 v: 알갱이 시드·자갈 위치·바퀴 자국 위상이 변형마다 다르다."""
    import ground as _G
    ruts = ruts and v == 0                                               # 바퀴 자국은 변형 0 에만(칸마다 같은 줄이 이어지면 벽지 격자가 된다)
    c = Cv(T, T)
    e = RGB['earth']; g = RGB['leaf']
    for y in range(T):
        for x in range(T):
            q = rnd(x, y, 200 + v)
            col = e[5]
            if q < 0.16: col = e[4]
            elif q > 0.93: col = e[6]
            if ruts and (mask & (_G.E | _G.W)) and y in (6, 9) and rnd(x, y, 5 + v) < 0.55: col = e[4]
            if ruts and (mask & (_G.N | _G.S)) and x in (6, 9) and rnd(x, y, 6 + v) < 0.55: col = e[4]
            d = _G._edge_depth(mask, x, y)
            if d > 0:
                if d == 1: col = e[3]
                elif d == 2: col = g[2]
                else: col = g[4] if rnd(x, y, 100) > 0.2 else g[3]
            c.put(x, y, col)
    for k in range(2 + (v % 2)):
        x, y = 2 + hsh(k, mask + 19 * v, 3) % 11, 2 + hsh(mask + 19 * v, k, 4) % 11
        if _G._edge_depth(mask, x, y) == 0 and _G._edge_depth(mask, x + 1, y) == 0:
            c.put(x, y, S[4]); c.put(x + 1, y, S[3])
    return c


def _grass_v(v):
    """풀 8종: 0~5 는 꽃 없는 풀(풀잎 점 위치만 다름), 6·7 은 들꽃 한두 송이. 꽃 칸은 드물게 섞어 1칸 격자 무늬를 없앤다."""
    import ground as _G
    if v < 6:
        return _G.grass((0, 2, 4, 5, 6, 7)[v])
    return _G.grass((1, 3)[v - 6])


def terrain_tiles():
    """catalog.terrain() 에 덧붙일 국내성 지형 키."""
    return {
        'slab': [slab(v) for v in range(5)],
        'slab_edge16': [slab_edge(m) for m in range(16)],
        'slab_dirt': [slab_dirt(s) for s in range(4)],
        'diamond': [diamond(v) for v in range(2)],
        'water47g': [_WB.water47(m, v, 'blue') for v in range(4) for m in _WB.ALL47],   # 국내성용 청색 섞은 물(47종 × 4변형)
        'road64': [road_v(m, v) for v in range(4) for m in range(16)],                    # 흙길 16마스크 × 4변형(자갈·알갱이 위치가 다르다)
        'yard64': [road_v(m, 3 + v, ruts=False) for v in range(4) for m in range(16)],
        'grass8': [_grass_v(v) for v in range(8)],
        'water_deep': _WB.water_deep_set(8),                                              # 깊은 물 한 칸의 변형 8종(무늬 격자 방지)
    }


def objects():
    d = {}
    for v in range(3):
        d['gungnae_wall_h' + ('' if v == 0 else str(v))] = wall_h(v)
    for v in range(3):
        d['gungnae_wall_v' + ('' if v == 0 else str(v))] = wall_v(v)
        d['gungnae_wall_v' + ('' if v == 0 else str(v)) + '_e'] = wall_v(v, 'l')
    for k in ('NW', 'NE', 'SW', 'SE'):
        d['gungnae_wall_corner_' + k.lower()] = wall_corner(k)
    d['gungnae_wall_end_l'] = wall_end('l', 0)
    d['gungnae_wall_end_r'] = wall_end('r', 1)
    d['gungnae_gate_great_12'] = gate_great(12, 64)
    d['gungnae_gate_great_8'] = gate_great(8, 32, variant=2)
    d['gungnae_gate_small_6'] = gate_small(6, 32)
    d['gungnae_gate_side_5'] = gate_side(5, 8, wall=wall_v(1))
    import gungnae_palace as _gp
    d['palace_gate_side_3'] = gate_side(3, 8, ramp='brown', seed=5, post=(18, 30), pw=4, roof=(12, 36), wall=_gp.pwall_v(False), wall_x=16, plaster=True)
    d['gungnae_tower_corner_5'] = tower_corner(5)
    d['gungnae_tower_corner_4'] = tower_corner(4)
    d['gungnae_bridge_h4'] = stone_bridge_h(4, 3, 0)
    d['gungnae_bridge_h5'] = stone_bridge_h(5, 3, 1)
    d['gungnae_bridge_h6'] = stone_bridge_h(6, 4, 0, water=(T, 6 * T))
    d['gungnae_bridge_v4'] = stone_bridge_v(4, 3, 0)
    d['gungnae_bridge_v5'] = stone_bridge_v(5, 3, 1)
    d['gungnae_bridge_v6'] = stone_bridge_v(6, 4, 0)
    d['gungnae_bridge_narrow_h'] = narrow_bridge(4, False)
    d['gungnae_bridge_narrow_h5'] = narrow_bridge(5, False)
    d['gungnae_bridge_narrow_h6'] = narrow_bridge(6, False)
    d['gungnae_bridge_narrow_v'] = narrow_bridge(4, True)
    return d
