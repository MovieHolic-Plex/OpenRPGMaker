"""조선 실내 기물 A — 살림집(안방·마루·부엌) 쪽: 병풍 · 농 · 반닫이 · 상 · 문갑 · 화로 · 베틀 · 물레 · 부뚜막 · 항아리 · 뒤주 · 평상 · 방석 · 이불 · 짚자리 · 족자 · 등잔 · 촛대."""
import math
from in_draw import *


# ------------------------------------------------------------------ 병풍
def byeongpung(kind='a', cells=3):
    """병풍: 폭 12px 틀 패널이 1px 지그재그로 접혀 서 있다. 홀수 패널은 한 톤 어둡다(접힌 면). 그림은 패널을 가로질러 이어진다."""
    W = cells * T
    c = Cv(W, 2 * T)
    n = W // 12
    for i in range(n):
        x0 = i * 12 + (W - n * 12) // 2
        oy = 0 if i % 2 == 0 else 1
        silk = Pl[5] if i % 2 == 0 else Pl[4]
        for y in range(2 + oy, 27 + oy):
            for x in range(x0, x0 + 12):
                c.put(x, y, silk)
        c.vl(x0, 2 + oy, 27 + oy, Wd[5] if i % 2 == 0 else Wd[4]); c.vl(x0 + 11, 2 + oy, 27 + oy, Wd[2])
        c.hl(x0, x0 + 12, 2 + oy, Wd[5]); c.hl(x0, x0 + 12, 3 + oy, Wd[3])           # 윗틀
        c.hl(x0, x0 + 12, 26 + oy, Wd[2]); c.hl(x0, x0 + 12, 25 + oy, Wd[4])          # 아랫틀
        # 비단 테두리 띠(붉은 천)
        for x in range(x0 + 1, x0 + 11):
            c.put(x, 4 + oy, Rd[3]); c.put(x, 24 + oy, Rd[3])
    # 그림은 전체 폭 좌표로
    def paint(x, y, col):
        pi = (x - (W - n * 12) // 2) // 12
        if 0 <= pi < n and (x - (W - n * 12) // 2) % 12 not in (0, 11):
            oy = 0 if pi % 2 == 0 else 1
            if 6 + oy <= y <= 22 + oy:
                c.put(x, y, col)
    if kind == 'a':                                    # 산수 일월도: 먼 산 푸른 먹, 가까운 언덕 녹색, 해
        for x in range(W):
            far = 15 - int(3 * math.sin(x * 0.22) + 2 * math.sin(x * 0.57 + 1))
            near = 19 - int(2 * math.sin(x * 0.31 + 2))
            for y in range(6, 24):
                if y >= near:
                    paint(x, y, Dg[4] if (x + y) % 3 else Dg[3])
                elif y >= far:
                    paint(x, y, Db[5] if y == far else Db[4])
        cxs = int(W * 0.68)
        for y in range(-3, 4):
            for x in range(-3, 4):
                if x * x + y * y <= 9:
                    paint(cxs + x, 10 + y, Rd[5] if x < 0 and y < 0 else Rd[4])
    elif kind == 'b':                                  # 모란도: 잎 녹색 덩어리 위에 붉은 꽃
        for (fx, fy, r) in ((0.18, 16, 5), (0.5, 14, 6), (0.82, 17, 5)):
            cx = int(W * fx)
            for y in range(-r, r + 1):
                for x in range(-r, r + 1):
                    if x * x + y * y <= r * r:
                        paint(cx + x, fy + y, Dg[5] if (x + y) % 3 == 0 else Dg[4])
            for (dx, dy) in ((-2, -3), (2, -2), (0, -4)):
                for yy in range(2):
                    for xx in range(3):
                        paint(cx + dx + xx - 1, fy + dy + yy, Rd[5] if xx == 0 else Rd[4])
                paint(cx + dx, fy + dy, Pe[5])
        for x in range(W):
            if x % 7 == 3:
                for y in range(18, 23):
                    paint(x, y, Dg[3])
    else:                                              # 글씨(초서) 병풍: 세로로 흐르는 먹 획
        for x in range(W):
            if (x % 12) in (3, 6, 9):
                y0 = 7 + (x * 5) % 5
                for y in range(y0, y0 + 11 + (x * 3) % 4):
                    paint(x, y, Gi[1] if (y + x) % 5 else Gi[3])
                    if (y % 4) == 0:
                        paint(x + 1, y, Gi[2])
    for i in range(n):                                  # 받침 발
        x0 = i * 12 + (W - n * 12) // 2 + (2 if i % 2 else 1)
        oy = 0 if i % 2 == 0 else 1
        c.hl(x0, x0 + 8, 27 + oy, Wd[3]); c.hl(x0, x0 + 8, 28 + oy, Wd[1])
    outline(c)
    contact(c, 2, W - 2, 30)
    return c


# ------------------------------------------------------------------ 농·궤
def nong(blankets=False, dark=False):
    """장롱 32×32: 여닫이 두 짝(경첩 놋장식) + 아래 서랍 한 줄. 이불장은 위에 개킨 이불 세 켜."""
    c = new(2, 2)
    y0 = 8 if blankets else 3
    block(c, 1, y0, 30, 32 - y0 - 4 - 2 if False else 30 - y0, 4, Wd, top=(6, 5), face=(5, 4, 3, 2))
    fy0, fy1 = y0 + 6, 25
    frame(c, 3, fy0, 12, fy1 - fy0 - 5, Wd, fill=Wd[5], hl=6, sh=2)
    frame(c, 16, fy0, 13, fy1 - fy0 - 5, Wd, fill=Wd[5], hl=6, sh=2)
    for x, (a, b) in ((5, (6, 4)), (22, (6, 4))):          # 문짝 널 무늬(수직 한 줄)
        pass
    c.vl(9, fy0 + 2, fy1 - 7, Wd[3]); c.vl(22, fy0 + 2, fy1 - 7, Wd[3])
    brass(c, 13, (fy0 + fy1 - 5) // 2 - 1, 2, 3)           # 자물쇠판
    brass(c, 3, fy0 + 2, 2, 2); brass(c, 3, fy1 - 8, 2, 2); brass(c, 27, fy0 + 2, 2, 2); brass(c, 27, fy1 - 8, 2, 2)   # 경첩
    frame(c, 3, fy1 - 4, 26, 6, Wd, fill=Wd[5], hl=6, sh=2)                                                        # 서랍
    brass(c, 8, fy1 - 2, 3, 2); brass(c, 21, fy1 - 2, 3, 2)
    if blankets:
        stack = ((Rd, 3, 0), (Db, 3, 3), (Dg, 2, 6))
        for ramp, h, yy in stack:
            cloth(c, 3, yy, 27, yy + h + 2 if False else yy + 3, ramp)
        for yy in (2, 5):
            c.hl(4, 26, yy, Pe[5] if yy == 2 else Pl[5])
    c.hl(2, 30, 29, Wd[1]); c.hl(3, 29, 30, Wd[2])
    outline(c)
    contact(c, 3, 30, 31, 1)
    return c


def bandaji():
    """반닫이 32×16: 앞판을 아래로 여는 낮은 궤 — 놋 자물쇠판 크게 + 네 귀 놋 모서리."""
    c = new(2, 1)
    block(c, 1, 2, 30, 11, 4, Wd, top=(6, 5), face=(5, 4, 3, 2))
    frame(c, 3, 8, 26, 6, Wd, fill=Wd[5], hl=6, sh=2)
    c.hl(2, 30, 7, Wd[2])
    brass(c, 14, 8, 4, 3)
    c.vl(15, 11, 14, Pe[3]); c.vl(16, 11, 14, Pe[2])
    for (x, y) in ((2, 6), (28, 6), (2, 11), (28, 11)):
        brass(c, x, y, 2, 2)
    outline(c)
    contact(c, 3, 30, 14, 2)
    return c


def mungap():
    """문갑 32×16: 낮은 서랍장 — 위에 넓은 윗면, 여닫이 두 짝 + 놋 손잡이."""
    c = new(2, 1)
    block(c, 1, 1, 30, 11, 4, Wd, top=(6, 5), face=(5, 4, 3, 2))
    for (x0, w) in ((3, 12), (16, 13)):
        frame(c, x0, 7, w, 7, Wd, fill=Wd[5], hl=6, sh=2)
    brass(c, 13, 9, 2, 3); brass(c, 16, 9, 2, 3)
    outline(c)
    contact(c, 3, 30, 14, 2)
    return c


# ------------------------------------------------------------------ 상(소반)
def soban(kind='a'):
    """소반 16×16: 둥근 상판(윗면 타원) 위에 그릇, 가운데 기둥 + 넓은 굽."""
    c = new(1, 1)
    # 굽·기둥
    for y in range(9, 14):
        for x in range(6, 10):
            c.put(x, y, Wd[(5, 4, 3, 2)[x - 6]])
    for x in range(4, 12):
        c.put(x, 13, Wd[(5, 5, 4, 4, 3, 3, 2, 2)[x - 4]]); c.put(x, 14, Wd[2] if x > 7 else Wd[3])
    round_top(c, 8, 6, 7, 3, Wd, (6, 5, 4))
    for x in range(2, 14):                                    # 앞 가장자리 두툼한 띠
        c.put(x, 9, Wd[3]) if 1 <= x - 2 <= 10 else None
    if kind == 'a':                                          # 밥·국·반찬
        bowl(c, 3, 3, Pl, rice=True); bowl(c, 9, 3, Pl, soup=True); bowl(c, 6, 5, Pl)
    elif kind == 'b':                                        # 잔 + 주전자
        bowl(c, 3, 4, Pl)
        ell(c, 10, 4, 3.2, 2.6, lambda x, y, u, v: Gi[6] if u < -0.3 else (Gi[5] if u < 0.2 else Gi[4]))
        c.hl(6, 8, 3, Gi[5]); c.put(5, 2, Gi[5]); c.put(5, 3, Gi[4])
        c.hl(9, 12, 1, Gi[6]); c.put(13, 3, Gi[3])
    else:                                                    # 잔 둘 + 술병
        bowl(c, 2, 4, Pl); bowl(c, 6, 5, Pl)
        bottle(c, 11, 0, 6, Dg)
    outline(c)
    contact(c, 3, 13, 15, 1)
    return c


def sang2(kind='plain'):
    """직사각 낮은 상 32×16: 상판 윗면 + 앞 띠 + 짧은 다리. kind: plain/jumak(그릇·술병)/desk(책·벼루)."""
    c = new(2, 1)
    for lx in (3, 25):
        for y in range(11, 15):
            c.put(lx, y, Wd[4]); c.put(lx + 1, y, Wd[3]); c.put(lx + 2, y, Wd[2])
    block(c, 1, 2, 30, 7, 4, Wd, top=(6, 5), face=(5, 4, 3, 2))
    c.hl(2, 30, 6, Wd[6]) if False else None
    if kind == 'jumak':
        bowl(c, 3, 2, Pl, rice=True); bowl(c, 11, 3, Pl, soup=True); bottle(c, 19, 0, 6, Dg); bowl(c, 24, 3, Pl)
    elif kind == 'desk':
        books(c, 3, 1, 3, 5); c.hl(14, 20, 4, Gi[1]); c.hl(14, 20, 5, Gi[2]); c.put(21, 3, Wd[1]); c.put(22, 2, Wd[2]); c.put(23, 1, Wd[2])
        books(c, 24, 2, 2, 4, 1)
    outline(c)
    contact(c, 3, 30, 15, 1)
    return c


# ------------------------------------------------------------------ 화로·베틀·물레
def hwaro():
    """화로 16×16: 질그릇 몸통 위로 숯불이 이글거리는 열린 입, 손잡이 둘."""
    from props5 import cyl
    c = new(1, 1)
    cyl(c, 8, 6, 6.6, 6, Ea, (6, 5), (5, 4, 3, 2), open_ring=(0.78, Rd[4], Rd[3]))
    for (x, y) in ((6, 6), (8, 5), (10, 6), (7, 7), (9, 7)):
        c.put(x, y, Pe[5]); c.put(x + 1, y, Pe[4])
    c.put(5, 5, Pl[3]); c.put(11, 6, Pl[3])
    c.put(1, 8, Gi[4]); c.put(1, 9, Gi[3]); c.put(14, 8, Gi[3]); c.put(14, 9, Gi[2])
    for y in range(13, 15):
        c.put(5, y, Gi[3]); c.put(10, y, Gi[2])
    outline(c)
    contact(c, 4, 12, 14, 2)
    return c


def betl():
    """베틀 32×32: 두 기둥 + 위 도투마리, 팽팽한 날실, 짜 내려오는 푸른 천, 앞에 앉는 널 걸상."""
    c = new(2, 2)
    for x0, tone in ((3, (5, 4, 2)), (25, (5, 4, 2))):
        for y in range(3, 29):
            c.put(x0, y, Wd[tone[0]]); c.put(x0 + 1, y, Wd[tone[1]]); c.put(x0 + 2, y, Wd[tone[2]])
    c.hl(2, 30, 3, Wd[6]); c.hl(2, 30, 4, Wd[5]); c.hl(2, 30, 5, Wd[3]); c.hl(2, 30, 6, Wd[2])      # 윗보
    for x in range(7, 25, 2):
        for y in range(7, 19):
            c.put(x, y, Pl[5] if x % 4 == 1 else Pl[4])
    for y in range(13, 20):                                                                          # 짜인 천
        for x in range(7, 25):
            c.put(x, y, Db[4] if (x + y) % 4 else Db[5])
    c.hl(7, 25, 13, Db[6]); c.hl(7, 25, 19, Db[2])
    c.hl(5, 27, 19, Wd[5]); c.hl(5, 27, 20, Wd[3])                                                   # 가슴 막대
    block(c, 7, 21, 18, 2, 3, Wd, top=(6, 5), face=(5, 4, 3, 2))                                    # 걸상 널
    for x in (8, 22):
        for y in range(26, 30):
            c.put(x, y, Wd[3]); c.put(x + 1, y, Wd[2])
    c.hl(3, 6, 29, Wd[1]); c.hl(25, 28, 29, Wd[1])
    outline(c)
    contact(c, 3, 29, 30, 2)
    return c


def mulle():
    """물레 16×16: 큰 바퀴(테 + 살 네 개 + 중심) 와 손잡이 반쪽, 앞 가락."""
    c = new(1, 1)
    for a in range(0, 360, 6):
        r = math.radians(a)
        x, y = 6 + 5.2 * math.cos(r), 7 + 5.2 * math.sin(r)
        c.put(int(round(x)), int(round(y)), Wd[6] if (a > 180 and a < 300) else Wd[4])
        c.put(int(round(6 + 4.4 * math.cos(r))), int(round(7 + 4.4 * math.sin(r))), Wd[5] if (a > 180 and a < 300) else Wd[3])
    for (dx, dy) in ((-4, 0), (4, 0), (0, -4), (0, 4), (-3, -3), (3, 3), (-3, 3), (3, -3)):
        for k in range(1, 4):
            c.put(6 + (dx * k) // 4, 7 + (dy * k) // 4, Wd[4])
    c.put(6, 7, Wd[6]); c.put(7, 7, Wd[5]); c.put(6, 8, Wd[3])
    c.hl(2, 14, 13, Wd[4]); c.hl(2, 14, 14, Wd[2])
    c.hl(11, 15, 8, Wd[5]); c.hl(12, 15, 9, Pl[5]); c.put(15, 9, Pl[3])
    outline(c)
    contact(c, 3, 14, 15, 1)
    return c


# ------------------------------------------------------------------ 부뚜막
def bumak(pots=2, w=None):
    """부뚜막(w×2칸): 흙 아궁이 위에 가마솥 pots 개(뚜껑 돔) + 앞면 아궁이 입(불빛) + 위로 굴뚝 연기 구멍. 흙은 황토 램프."""
    w = w or (2 if pots <= 2 else 3)
    c = new(w, 2)
    W = w * T
    block(c, 1, 8, W - 2, 22, 8, Ea, top=(6, 5), face=(5, 4, 3, 2))
    pw = (W - 4) // pots
    for k in range(pots):
        cx = 2 + k * pw + pw // 2
        r = min(7.0, pw / 2.0 - 1.5)
        for y in range(-1, 3):
            pass
        ell(c, cx, 11, r + 1.4, 3.2, lambda x, y, u, v: Ea[3])                                           # 솥 걸이 흙 턱
        ell(c, cx, 9, r, 4.6, lambda x, y, u, v: Gi[6] if (u < -0.25 and v < 0) else (Gi[5] if u < 0.35 else Gi[4]))
        ell(c, cx, 6.5, r * 0.55, 1.8, lambda x, y, u, v: Gi[3])                                          # 뚜껑 꼭지 자리
        c.put(int(cx), 5, Gi[6]); c.put(int(cx) - 1, 5, Gi[5])
    # 아궁이 입(앞면 아래쪽)
    for k in range(pots):
        cx = 2 + k * pw + pw // 2
        ax0, ax1 = int(cx - 4), int(cx + 4)
        for y in range(20, 29):
            for x in range(ax0, ax1):
                edge = (x in (ax0, ax1 - 1)) or y == 20
                c.put(x, y, Gi[0] if edge else (Rd[4] if y > 24 else Gi[1]))
        for x in range(ax0 + 2, ax1 - 2):
            c.put(x, 26, Pe[5]); c.put(x, 27, Pe[4]) if x % 2 else c.put(x, 27, Rd[5])
        c.hl(ax0 - 1, ax1 + 1, 19, Ea[6])
    c.hl(2, W - 2, 30, Ea[2]); c.hl(1, W - 1, 31, Ea[1])
    outline(c)
    contact(c, 3, W - 1, 32, 0)
    return c


# ------------------------------------------------------------------ 항아리·독·뒤주
def hangari(kind='a'):
    """항아리 16×16 / 큰 항아리 16×32."""
    from props5 import jar
    if kind == 'tall':
        c = new(1, 2)
        shadow_ell(c, 10, 30.5, 7, 1.6, 70)
        jar(c, 8, 30, 25, 7.0, lid=True)
        outline(c)
        return c
    c = new(1, 1)
    shadow_ell(c, 9.5, 14.5, 6, 1.4, 70)
    if kind == 'a':
        jar(c, 8, 14, 11, 5.4, lid=True)
    else:
        jar(c, 8, 14, 10, 5.2, lid=False)
    outline(c)
    return c


def dok_row():
    """독 둘(32×16): 크기가 다른 항아리 둘 — 하나는 덮개, 하나는 열림."""
    from props5 import jar
    c = new(2, 1)
    shadow_ell(c, 18, 14.5, 13, 1.4, 70)
    jar(c, 9, 14, 12, 5.6, lid=True)
    jar(c, 22, 14, 10, 5.0, lid=False)
    outline(c)
    return c


def suldok():
    """술독 16×16: 짚으로 두른 배불뚝이 독 + 덮은 보자기."""
    from props5 import jar
    c = new(1, 1)
    shadow_ell(c, 9.5, 14.5, 6, 1.4, 70)
    jar(c, 8, 14, 11, 5.8, lid=True, ramp=RGB['straw'])
    for y in range(8, 13):                                                  # 짚 새끼 띠
        c.put(4 + (y % 2), y, Sr[2]) if y % 2 else None
    c.hl(4, 12, 9, Sr[2])
    outline(c)
    return c


def dwiju():
    """쌀뒤주 16×32: 네모난 널통에 짧은 다리 — 위 뚜껑 윗면, 앞 널 세로 줄, 작은 자물쇠."""
    c = new(1, 2)
    for lx in (2, 11):
        for y in range(27, 30):
            c.put(lx, y, Wd[3]); c.put(lx + 1, y, Wd[2])
    block(c, 1, 6, 14, 21, 6, Wd, top=(6, 5), face=(5, 4, 3, 2))
    for x in (5, 9, 12):
        c.vl(x, 13, 26, Wd[3])
    c.hl(2, 14, 13, Wd[2])
    brass(c, 7, 15, 2, 3)
    outline(c)
    contact(c, 3, 14, 30, 2)
    return c


# ------------------------------------------------------------------ 평상·방석·이불·자리
def pyeongsang3():
    """실내 큰 평상 48×32: 널마루 윗면(가로 널) + 앞 귀틀 + 짧은 네 다리."""
    c = new(3, 2)
    for lx in (3, 41):
        for y in range(25, 30):
            c.put(lx, y, Wd[4]); c.put(lx + 1, y, Wd[3]); c.put(lx + 2, y, Wd[2])
    block(c, 2, 4, 44, 21, 4, Wd, top=(6, 5), face=(5, 4, 3, 2))
    # 윗면 널 무늬 덮어쓰기
    for y in range(5, 21):
        for x in range(3, 45):
            t = 6 if ((y - 5) % 4) else 5
            c.put(x, y, Wd[6] if (y == 4) else Wd[t])
    for k, y in enumerate(range(5, 21, 4)):
        c.hl(3, 45, y + 3, Wd[5])
    outline(c)
    contact(c, 4, 44, 30, 2)
    return c


def bangseok(kind='r'):
    """방석 16×16(걸어 지나는 바닥 장식): 솜 넣은 네모 방석 — 가운데 한 톤 밝고 가장자리 한 톤 어두운 테 + 네 귀 매듭."""
    ramp = {'r': Rd, 'b': Db, 'g': Dg}[kind]
    c = new(1, 1)
    for y in range(6, 14):
        for x in range(2, 14):
            ee = min(x - 2, 13 - x, y - 6, 13 - y)
            t = 5 if ee >= 2 else 3
            if y == 6 or x == 2: t = 5 if ee >= 2 else 4
            if y >= 12: t = 2
            c.put(x, y, ramp[t])
    for (x, y) in ((2, 6), (13, 6), (2, 13), (13, 13)):
        c.put(x, y, Pe[5] if y == 6 else Pe[3])
    c.hl(5, 11, 9, Pe[4]) if kind == 'r' else c.hl(5, 11, 9, Pl[4])
    outline(c)
    contact(c, 3, 13, 14, 2)
    return c


def ibul(kind='r'):
    """깔아 놓은 이불 32×32: 요 위에 이불(꽃 누빔)·목침. 침구는 3~4px 두께로 솟아 있다."""
    ramp = {'r': Rd, 'b': Db, 'g': Dg}[kind]
    c = new(2, 2)
    block(c, 2, 8, 28, 17, 5, Pl, top=(6, 5), face=(4, 3, 2, 2), ground=True)          # 요(흰 홑청)
    cloth(c, 3, 11, 29, 24, ramp)                                                        # 이불
    for (x, y) in ((8, 15), (16, 18), (23, 14), (11, 21), (26, 21)):                      # 누비 꽃무늬
        c.put(x, y, Pe[5]); c.put(x - 1, y, Pe[4]); c.put(x + 1, y, Pe[4]); c.put(x, y - 1, Pe[4]); c.put(x, y + 1, Pe[3])
    c.vl(4, 11, 24, ramp[5]) if False else None
    for y in range(9, 14):                                                                # 베개
        for x in range(4, 13):
            c.put(x, y, Pl[6] if y == 9 else (Pl[5] if x < 10 else Pl[3]))
    c.hl(4, 13, 13, Pl[3])
    outline(c)
    contact(c, 3, 29, 26, 2)
    return c


def jipjari(w=2):
    """짚자리(걸어 지나는 바닥 장식): 엮은 짚 돗자리 w×1칸 — 사선 결 + 가장자리 매듭 띠."""
    c = new(w, 1)
    W = w * T
    for y in range(3, 14):
        for x in range(1, W - 1):
            d = (x + y) % 4
            c.put(x, y, Sr[5] if d in (0, 1) else Sr[4])
    c.hl(1, W - 1, 3, Sr[6]); c.hl(1, W - 1, 13, Sr[2])
    c.vl(1, 3, 14, Sr[3]); c.vl(W - 2, 3, 14, Sr[2])
    outline(c)
    return c


# ------------------------------------------------------------------ 족자·등잔·촛대
def jokja(kind='a'):
    """족자 16×32(벽면에 건다): 위아래 축 + 한지 + 먹 그림/글씨 + 매단 끈."""
    c = new(1, 2)
    c.vl(8, 0, 3, Gi[3])
    c.hl(2, 14, 3, Wd[6]); c.hl(2, 14, 4, Wd[4]); c.put(1, 3, Wd[3]); c.put(14, 3, Wd[3])
    for y in range(5, 26):
        for x in range(2, 14):
            edge = x in (2, 3, 12, 13)
            c.put(x, y, (Rd[5] if x < 8 else Rd[4]) if edge else (Pl[5] if x < 8 else Pl[4]))
    if kind == 'a':                                       # 산수
        for x in range(4, 12):
            ridge = 14 - int(2.5 * math.sin((x - 3) * 0.7 + 1))
            for y in range(ridge, 22):
                c.put(x, y, Gi[3] if y > ridge + 2 else Gi[4])
        c.put(9, 9, Rd[4]); c.put(10, 9, Rd[4]); c.put(9, 10, Rd[3])
    else:                                                  # 글씨
        for (x, y0, h) in ((5, 7, 6), (8, 8, 8), (10, 7, 5), (5, 15, 5), (8, 18, 5)):
            for y in range(y0, y0 + h):
                c.put(x, y, Gi[1] if (y + x) % 4 else Gi[3])
        c.put(10, 21, Rd[4]); c.put(11, 21, Rd[4]); c.put(10, 22, Rd[3])
    c.hl(2, 14, 26, Wd[6]); c.hl(2, 14, 27, Wd[4]); c.hl(2, 14, 28, Wd[2]); c.put(1, 27, Wd[3]); c.put(14, 27, Wd[3])
    outline(c)
    return c


def deungjan():
    """등잔걸이 16×32: 높은 나무 기둥 위에 한지 등롱 + 속 불꽃, 십자 받침 다리."""
    c = new(1, 2)
    for y in range(13, 29):
        c.put(7, y, Wd[5]); c.put(8, y, Wd[4]); c.put(9, y, Wd[2])
    for x in range(3, 13):
        c.put(x, 29, Wd[4] if x < 8 else Wd[2]); c.put(x, 30, Wd[3] if x < 8 else Wd[1])
    c.hl(4, 12, 28, Wd[5])
    for y in range(3, 13):                                         # 한지 등롱 몸
        for x in range(4, 12):
            core = (5 <= x <= 10) and (5 <= y <= 11)
            c.put(x, y, Pe[6] if core and 6 <= x <= 9 and 7 <= y <= 10 else (Pe[5] if core else Pl[5]))
    c.hl(3, 13, 2, Wd[5]); c.hl(3, 13, 3, Wd[3]); c.hl(3, 13, 12, Wd[3]); c.hl(3, 13, 13, Wd[2])
    c.vl(4, 3, 13, Wd[4]); c.vl(11, 3, 13, Wd[2]); c.vl(7, 4, 12, Wd[3]) if False else None
    outline(c)
    contact(c, 3, 13, 31, 1)
    return c


def chotdae():
    """촛대 16×16: 놋 받침 + 가는 기둥 + 촛불. 놋은 persimmon 램프."""
    c = new(1, 1)
    for x in range(4, 12):
        c.put(x, 13, Pe[3] if x > 7 else Pe[4]); c.put(x, 14, Pe[2] if x > 7 else Pe[3])
    c.hl(5, 11, 12, Pe[5])
    for y in range(8, 12):
        c.put(7, y, Pe[5]); c.put(8, y, Pe[3])
    c.hl(5, 11, 8, Pe[4]); c.put(5, 7, Pe[5]); c.put(10, 7, Pe[3])
    for y in range(3, 8):
        c.put(7, y, Pl[6]); c.put(8, y, Pl[4])
    flame(c, 7, 1, True)
    outline(c)
    contact(c, 4, 12, 15, 1)
    return c


def objects():
    d = {
        'in_byeongpung_a': byeongpung('a', 3), 'in_byeongpung_b': byeongpung('b', 3), 'in_byeongpung_c': byeongpung('c', 3),
        'in_byeongpung_s': byeongpung('b', 2),
        'in_nong': nong(), 'in_ibuljang': nong(True), 'in_bandaji': bandaji(), 'in_mungap': mungap(),
        'in_soban_a': soban('a'), 'in_soban_b': soban('b'), 'in_soban_c': soban('c'),
        'in_sang_2': sang2('plain'), 'in_sang_jumak': sang2('jumak'), 'in_chaeksang': sang2('desk'),
        'in_hwaro': hwaro(), 'in_betl': betl(), 'in_mulle': mulle(),
        'in_bumak_2': bumak(2), 'in_bumak_3': bumak(3),
        'in_hangari_a': hangari('a'), 'in_hangari_b': hangari('b'), 'in_hangari_tall': hangari('tall'), 'in_dok_row': dok_row(),
        'in_suldok': suldok(), 'in_dwiju': dwiju(), 'in_pyeongsang_3': pyeongsang3(),
        'in_bangseok_r': bangseok('r'), 'in_bangseok_b': bangseok('b'), 'in_bangseok_g': bangseok('g'),
        'in_ibul_r': ibul('r'), 'in_ibul_b': ibul('b'), 'in_jipjari_2': jipjari(2), 'in_jipjari_1': jipjari(1),
        'in_jokja_a': jokja('a'), 'in_jokja_b': jokja('b'), 'in_deungjan': deungjan(), 'in_chotdae': chotdae(),
    }
    return d
