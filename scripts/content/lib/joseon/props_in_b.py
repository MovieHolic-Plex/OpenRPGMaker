"""조선 실내 기물 B — 일터: 선반·약장·서가·약연·약탕관·약초 걸이(약방/서당) · 풀무·모루·숯·화덕·담금통·연장 걸이·작업대·쇳덩이(대장간)
· 주모 상·걸상·술독(주막) · 훈장 상·학동 책상·서가·회초리 통(서당) · 관아 책상·교의·형틀·곤장 틀·북(관아)."""
import math
from in_draw import *


# ------------------------------------------------------------------ 선반·약장·서가
def seonban(kind='pots'):
    """벽 선반 32×32: 두 층 널 선반(옆판 + 뒤판 어둡게) 위에 항아리·사발·병. kind: pots(살림)/bottles(주막)."""
    c = new(2, 2)
    for y in range(1, 31):
        for x in range(3, 29):
            c.put(x, y, Wd[2] if x < 26 else Wd[1])                     # 뒤판
    for x0 in (1, 28):
        for y in range(0, 31):
            for k in range(3):
                c.put(x0 + k, y, Wd[(6, 5, 3)[k] if x0 == 1 else (4, 3, 2)[k]])
    for yb in (14, 28):                                                 # 선반 널(윗면 + 앞 띠)
        for x in range(1, 31):
            c.put(x, yb, Wd[6]); c.put(x, yb + 1, Wd[5]); c.put(x, yb + 2, Wd[3] if x < 22 else Wd[2])
    from props5 import jar
    if kind == 'pots':
        for cx, h, bl, lid in ((8, 9, 3.8, True), (16, 11, 4.4, False), (24, 8, 3.4, True)):
            jar(c, cx, 14, h, bl, lid=lid)
        bowl(c, 5, 22, Pl); bowl(c, 5, 25, Pl, rice=True) if False else None
        bowl(c, 12, 24, Pl, soup=True); bowl(c, 19, 24, Pl); bowl(c, 23, 21, Pl, rice=True)
    else:
        for x0, col in ((5, Dg), (11, Db), (17, Dg), (23, Wd)):
            bottle(c, x0, 8, 6, col)
        for x0 in (6, 14, 22):
            bowl(c, x0, 24, Pl, soup=(x0 == 14))
        c.hl(4, 28, 18, Wd[4]) if False else None
    outline(c)
    return c


def yakjang(wc=2):
    """약장: 작은 서랍이 격자로 늘어선 약재 장 — 서랍마다 한지 쪽지와 놋 손잡이."""
    W = wc * T
    c = new(wc, 2)
    block(c, 1, 2, W - 2, 28, 4, Wd, top=(6, 5), face=(5, 4, 3, 2))
    cols = wc * 2 if wc > 1 else 1
    dw = (W - 6) // max(cols, 1)
    for r in range(5):
        for k in range(cols if wc > 1 else 1):
            if wc == 1:
                x0, w = 3, W - 6
            else:
                x0, w = 3 + k * dw, dw - 1
            y0 = 8 + r * 5
            frame(c, x0, y0, w, 5, Wd, fill=Wd[5], hl=6, sh=2)
            c.put(x0 + w // 2, y0 + 2, Pe[5])
            c.put(x0 + 1, y0 + 1, Pl[5]); c.put(x0 + 2, y0 + 1, Pl[4])
    outline(c)
    contact(c, 3, W - 1, 31, 1)
    return c


def seoga():
    """서가 32×32: 세 칸 책장 — 칸마다 한지 책이 세로로 꽂히고 한 칸은 누워 쌓였다."""
    c = new(2, 2)
    block(c, 1, 2, 30, 28, 3, Wd, top=(6, 5), face=(5, 4, 3, 2))
    for y in range(6, 29):
        for x in range(3, 29):
            c.put(x, y, Wd[1] if x > 20 else Wd[2])
    for yb, kind in ((6, 'v'), (14, 'v'), (22, 'm')):
        if kind == 'v':
            x = 4
            seed = yb
            while x < 27:
                x += books(c, x, yb + 1, 2, 6, seed) + 0
                seed += 1
        else:
            for k in range(3):
                for xx in range(5, 25 - k * 2):
                    c.put(xx, yb + 5 - k * 2, Pl[5] if xx % 5 else Pl[3]); c.put(xx, yb + 4 - k * 2, Pl[4])
                c.put(6, yb + 4 - k * 2, Rd[4])
        c.hl(3, 29, yb + 7, Wd[6]); c.hl(3, 29, yb + 8, Wd[3]) if yb < 22 else None
    outline(c)
    contact(c, 3, 29, 31, 1)
    return c


def yakyeon():
    """약연 16×16: 배 모양 쇠 약절구 + 위에 세운 맷바퀴, 양쪽 손잡이."""
    c = new(1, 1)
    ell(c, 8, 11, 7, 2.6, lambda x, y, u, v: Gi[6] if (u < -0.3 and v < 0) else (Gi[5] if u < 0.4 else Gi[4]))
    ell(c, 8, 10.5, 5.2, 1.5, lambda x, y, u, v: Gi[2])
    for y in range(12, 14):
        for x in range(4, 13):
            c.put(x, y, Gi[3] if x < 9 else Gi[2])
    ell(c, 8, 7, 3.2, 3.6, lambda x, y, u, v: Gi[6] if u < -0.2 else (Gi[5] if u < 0.4 else Gi[4]))
    c.put(8, 7, Gi[3]); c.put(8, 6, Gi[2])
    c.hl(0, 4, 7, Wd[5]); c.hl(0, 4, 8, Wd[4]); c.hl(12, 16, 7, Wd[4]); c.hl(12, 16, 8, Wd[3]); c.put(0, 6, Wd[6]); c.put(1, 6, Wd[5]); c.put(14, 6, Wd[4]); c.put(15, 6, Wd[3])
    c.hl(4, 12, 14, Wd[3])
    outline(c)
    contact(c, 3, 13, 14, 2)
    return c


def yakhwa():
    """약탕관 16×16: 작은 질화로 위에 뚜껑 덮은 약탕관, 주둥이, 모락모락 김."""
    c = new(1, 1)
    for x in range(4, 12):
        c.put(x, 12, Gi[4] if x < 8 else Gi[3]); c.put(x, 13, Gi[3] if x < 8 else Gi[2])
    for x in (4, 5, 10, 11):
        c.put(x, 14, Gi[2])
    ell(c, 8, 9, 5.5, 4, lambda x, y, u, v: Sr[6] if (u < -0.3 and v < 0) else (Sr[5] if u < 0.35 else Sr[3]))
    ell(c, 8, 6, 3.4, 1.4, lambda x, y, u, v: Sr[4])
    c.put(8, 4, Sr[6]); c.put(9, 4, Sr[4])
    c.hl(12, 15, 7, Sr[4]); c.put(14, 6, Sr[5]); c.put(15, 6, Sr[3])
    for (x, y) in ((6, 2), (8, 0), (10, 2)):                        # 김(2×2 덩이)
        for (dx, dy) in ((0, 0), (1, 0), (0, 1), (1, 1)):
            c.put(x + dx, y + dy, Pl[5] if dy == 0 else Pl[4])
    outline(c)
    contact(c, 4, 12, 14, 1)
    return c


def herb_hang():
    """약초 걸이 32×16: 가로장 한 줄에 줄에 묶어 거꾸로 매단 약초 다발 네 개 (벽면에 건다)."""
    c = new(2, 1)
    c.hl(1, 31, 0, Wd[6]); c.hl(1, 31, 1, Wd[4]); c.hl(1, 31, 2, Wd[2])
    for k, (x0, col, col2) in enumerate(((3, Sr, Pe), (11, Le, Dg), (19, Sr, Sr), (26, Dg, Le))):
        c.vl(x0 + 1, 2, 4, Gi[3])
        for y in range(4, 14):
            hw = 2 if y < 6 else (3 if y < 11 else 2)
            for x in range(x0 - hw + 1, x0 + hw + 2):
                f = (x - (x0 - hw + 1)) / max(1, 2 * hw)
                c.put(x, y, col[5] if f < 0.3 else (col[4] if f < 0.7 else col[3]))
        for (dx, dy) in ((0, 7), (2, 9), (1, 11)):
            c.put(x0 + dx, y if False else 4 + dy - 3, col2[5])
    outline(c)
    return c


# ------------------------------------------------------------------ 대장간
def pulmu():
    """풀무 32×16: 네모 나무 통 + 오른쪽 손잡이 막대 + 왼쪽으로 뻗은 쇠 노즐."""
    c = new(2, 1)
    block(c, 8, 3, 18, 9, 4, Wd, top=(6, 5), face=(5, 4, 3, 2))
    frame(c, 10, 8, 14, 5, Wd, fill=Wd[3], hl=5, sh=1)
    for y in range(6, 8):
        for x in range(1, 9):
            c.put(x, y, Gi[6] if y == 6 else Gi[4])
    c.put(1, 6, Gi[3]); c.put(1, 7, Gi[2])
    for x in range(26, 31):
        c.put(x, 5, Wd[6]); c.put(x, 6, Wd[4])
    c.vl(30, 2, 9, Wd[5]); c.vl(31, 2, 9, Wd[3])
    outline(c)
    contact(c, 8, 27, 15, 1)
    return c


def morus():
    """모루 16×16: 통나무 그루터기 위에 쇠 모루(뿔 하나, 윗면 밝은 쇠)."""
    c = new(1, 1)
    for y in range(9, 15):
        for x in range(4, 12):
            c.put(x, y, Wd[5] if x < 6 else (Wd[4] if x < 9 else Wd[2]))
    ell(c, 8, 9, 4.2, 1.5, lambda x, y, u, v: Wd[6] if u < 0.1 else Wd[5])
    c.hl(5, 11, 14, Wd[1])
    for x in range(3, 13):                                  # 몸통(위가 넓고 허리 좁은)
        c.put(x, 4, Gi[6]); c.put(x, 5, Gi[5] if x < 8 else Gi[4])
    for x in range(1, 4):
        c.put(x, 4, Gi[6]); c.put(x, 5, Gi[4]) if x > 1 else None
    c.put(0, 4, Gi[5])
    for y in range(6, 9):
        for x in range(5, 11):
            c.put(x, y, Gi[5] if x < 7 else (Gi[4] if x < 9 else Gi[3]))
    c.hl(4, 12, 8, Gi[3])
    outline(c)
    contact(c, 4, 13, 15, 1)
    return c


def charcoal():
    """숯더미 16×16: 검은 숯덩이가 쌓인 봉우리, 모서리마다 회색 하이라이트."""
    c = new(1, 1)
    for y in range(4, 14):
        hw = 1 + (y - 4) * 0.7
        for x in range(int(8 - hw), int(8 + hw) + 1):
            q = rnd(x, y, 61)
            f = (x - (8 - hw)) / max(1.0, 2 * hw)
            t = 3 if (q > 0.8 and f < 0.55) else (2 if q > 0.45 else 1)
            if f > 0.7: t = max(0, t - 1)
            c.put(x, y, Gi[t])
    for (x, y) in ((6, 7), (9, 9), (5, 11), (10, 12), (7, 5)):
        c.put(x, y, Gi[4]); c.put(x + 1, y, Gi[3])
    outline(c)
    contact(c, 3, 13, 14, 2)
    return c


def hwadeok():
    """화덕 32×32: 흙+돌로 쌓은 대장간 화덕 — 위 굴뚝 연통(어두운 쇠), 앞 불구멍(벌건 숯), 아래 돌 단."""
    c = new(2, 2)
    block(c, 2, 10, 28, 19, 5, St, top=(6, 5), face=(5, 4, 3, 2))
    for y in range(15, 31):                                    # 쌓은 돌 줄눈
        if (y - 15) % 5 == 4:
            c.hl(3, 29, y, St[2])
    for k, y in enumerate(range(15, 29, 5)):
        for x in range(4 + (k % 2) * 4, 29, 8):
            c.vl(x, y, min(30, y + 4), St[2])
    for y in range(1, 11):                                     # 연통(굴뚝)
        for x in range(9, 23):
            c.put(x, y, Gi[4] if x < 12 else (Gi[3] if x < 19 else Gi[2]))
    c.hl(8, 24, 10, Gi[5]); c.hl(7, 25, 9, Gi[6]) if False else None
    c.hl(9, 23, 1, Gi[6]); c.hl(9, 23, 2, Gi[5])
    for y in range(16, 26):                                    # 불구멍
        for x in range(8, 24):
            edge = (x in (8, 23)) or y == 16
            c.put(x, y, Gi[0] if edge else (Rd[4] if y > 21 else Gi[1]))
    for x in range(10, 22):
        c.put(x, 23, Pe[5]); c.put(x, 24, Rd[5] if x % 2 else Pe[4]); c.put(x, 22, Rd[4])
    for (x, y) in ((12, 21), (16, 22), (19, 21)):
        flame(c, x, y, True)
    c.hl(7, 25, 26, St[6])
    outline(c)
    contact(c, 3, 29, 32, 0)
    return c


def tub():
    """담금통 16×16: 쇠테 두른 나무통 — 윗면에 푸른 물 타원."""
    from props5 import cyl
    c = new(1, 1)
    cyl(c, 8, 5, 6.4, 8, Wd, (6, 5), (5, 4, 3, 2), open_ring=(0.76, Wa[4], Wa[3]))
    ell(c, 7, 5, 2.4, 1.0, lambda x, y, u, v: Wa[6] if u < 0 else Wa[5])
    for y in (8, 12):
        c.hl(2, 14, y, Gi[3])
        c.hl(3, 13, y + 1, Gi[2])
    outline(c)
    contact(c, 3, 13, 14, 2)
    return c


def tool_rack():
    """연장 걸이 32×16: 판자에 낫·호미·망치·집게를 걸었다(벽면에 건다)."""
    c = new(2, 1)
    for y in range(1, 14):
        for x in range(1, 31):
            c.put(x, y, Wd[3] if y % 5 else Wd[2])
    c.hl(1, 31, 1, Wd[5]); c.hl(1, 31, 13, Wd[1])
    for k in range(4):                                     # 낫: 곡선 날 + 손잡이
        pass
    for (x, y) in ((4, 4), (5, 3), (6, 3), (7, 3), (8, 4), (8, 5)):
        c.put(x, y, Gi[6] if y == 3 else Gi[5])
    c.vl(4, 5, 11, Wd[5]); c.vl(5, 5, 11, Wd[4])
    c.hl(12, 16, 3, Gi[5]); c.vl(12, 3, 10, Wd[5]); c.vl(13, 3, 10, Wd[4]); c.hl(12, 15, 10, Gi[4]); c.put(15, 11, Gi[3])   # 호미
    for y in range(4, 12):                                  # 망치
        c.put(20, y, Wd[5]); c.put(21, y, Wd[3])
    c.hl(18, 24, 3, Gi[6]); c.hl(18, 24, 4, Gi[4]); c.hl(18, 24, 5, Gi[3])
    for y in range(3, 11):                                  # 집게
        c.put(26 + (y - 3) // 4, y, Gi[5]); c.put(29 - (y - 3) // 4, y, Gi[4])
    c.hl(26, 30, 11, Gi[3])
    for x in (4, 12, 20, 27):
        c.put(x, 2, Gi[2]); c.put(x + 1, 2, Gi[2])
    outline(c)
    return c


def workbench():
    """작업대 32×16: 두꺼운 널 상판 위에 쇠망치와 쇠 조각, 아래 서랍."""
    c = new(2, 1)
    block(c, 1, 2, 30, 11, 5, Wd, top=(6, 5), face=(5, 4, 3, 2))
    frame(c, 3, 8, 12, 6, Wd, fill=Wd[5], hl=6, sh=2)
    frame(c, 17, 8, 12, 6, Wd, fill=Wd[5], hl=6, sh=2)
    brass(c, 8, 10, 2, 1); brass(c, 22, 10, 2, 1)
    c.hl(4, 10, 4, Gi[5]); c.hl(4, 10, 5, Gi[3]); c.vl(10, 2, 6, Wd[6])
    c.hl(20, 27, 4, Gi[6]); c.hl(20, 27, 5, Gi[4])
    outline(c)
    contact(c, 3, 29, 14, 2)
    return c


def ingots():
    """쇳덩이 16×16: 쇠막대 두 단 쌓기(윗면 밝은 쇠, 앞면 어두운 쇠)."""
    c = new(1, 1)
    for k, (x0, y0, n) in enumerate(((2, 10, 4), (4, 6, 3), (6, 2, 2))):
        for i in range(n):
            xx = x0 + i * 3 + (i * 0)
            block(c, xx, y0, 3 if False else 6, 3, 2, Gi, top=(6, 6), face=(5, 4, 3, 2), ground=False) if False else None
    for (x0, y0) in ((2, 11), (8, 11), (5, 7), (11, 7) if False else (5, 7)):
        pass
    for x0, y0, wdt in ((2, 10, 12), (4, 6, 8), (6, 2, 4)):
        for y in range(y0, y0 + 4):
            for x in range(x0, x0 + wdt):
                t = 6 if y == y0 else (5 if y == y0 + 1 else (4 if x < x0 + wdt // 2 else 3))
                if y == y0 + 3: t = 2
                c.put(x, y, Gi[t])
        for x in range(x0 + 3, x0 + wdt - 1, 4):
            c.vl(x, y0 + 1, y0 + 3, Gi[2])
    outline(c)
    contact(c, 3, 13, 14, 2)
    return c


# ------------------------------------------------------------------ 주막
def jumak_counter():
    """주모 상 48×16: 긴 널 상판 위에 사발 층층·주전자·술병, 앞면은 서랍 둘 + 놋 손잡이."""
    c = new(3, 1)
    block(c, 1, 2, 46, 11, 4, Wd, top=(6, 5), face=(5, 4, 3, 2))
    for (x0, w) in ((3, 20), (25, 20)):
        frame(c, x0, 8, w, 6, Wd, fill=Wd[5], hl=6, sh=2)
    brass(c, 12, 10, 2, 2); brass(c, 34, 10, 2, 2)
    bowl(c, 3, 1, Pl); bowl(c, 3, 3, Pl, rice=True)
    bottle(c, 12, -1, 7, Dg) if False else None
    ell(c, 21, 3, 3.4, 2.6, lambda x, y, u, v: Gi[5] if u < 0 else Gi[4])
    c.put(17, 1, Gi[4]); c.hl(23, 26, 3, Gi[3])
    bottle(c, 30, 0, 6, Dg); bottle(c, 34, 0, 6, Db)
    bowl(c, 40, 2, Pl, soup=True)
    outline(c)
    contact(c, 3, 46, 14, 2)
    return c


def geolsang():
    """걸상 16×16: 널판 앉는 자리 + 짧은 두 다리(옆면은 사다리꼴)."""
    c = new(1, 1)
    for y in range(9, 14):
        for x in (3, 4, 10, 11):
            c.put(x, y, Wd[4] if x < 6 else Wd[2])
    block(c, 2, 4, 12, 4, 3, Wd, top=(6, 5), face=(5, 4, 3, 2))
    outline(c)
    contact(c, 3, 13, 14, 2)
    return c


# ------------------------------------------------------------------ 서당
def hunjang_sang():
    """훈장 상 32×16: 큰 서안 — 윗면 위에 책 더미·벼루·붓통, 양옆 책상다리(안으로 굽은 다리)."""
    c = new(2, 1)
    for lx in (3, 25):
        for y in range(10, 15):
            c.put(lx, y, Wd[4]); c.put(lx + 1, y, Wd[3]); c.put(lx + 2, y, Wd[2])
    block(c, 1, 3, 30, 6, 3, Wd, top=(6, 5), face=(5, 4, 3, 2))
    books(c, 3, 0, 4, 4, 0)
    c.hl(13, 19, 4, Gi[1]); c.hl(13, 19, 5, Gi[2])
    c.vl(21, 1, 4, Wd[5]); c.vl(22, 0, 4, Wd[3]); c.vl(23, 1, 4, Wd[4]); c.hl(20, 25, 4, Sr[4])
    books(c, 25, 1, 2, 3, 1)
    outline(c)
    contact(c, 3, 30, 15, 1)
    return c


def hakdong_sang():
    """학동 책상 16×16: 작은 서안 — 펼친 책 한 권."""
    c = new(1, 1)
    for lx in (2, 11):
        for y in range(10, 14):
            c.put(lx, y, Wd[4]); c.put(lx + 1, y, Wd[3]); c.put(lx + 2, y, Wd[2])
    block(c, 1, 5, 14, 3, 3, Wd, top=(6, 5), face=(5, 4, 3, 2))
    for x in range(3, 13):
        c.put(x, 3, Pl[6] if x < 8 else Pl[5]); c.put(x, 4, Pl[5] if x < 8 else Pl[4]); c.put(x, 5, Pl[4] if x < 8 else Pl[3])
    c.vl(8, 3, 6, Pl[3]); c.hl(4, 7, 4, Gi[3]) ; c.hl(9, 12, 4, Gi[3])
    outline(c)
    contact(c, 3, 13, 14, 1)
    return c


def hoechori():
    """회초리 통 16×16: 가는 나무통에 꽂힌 회초리 네 가닥."""
    from props5 import cyl
    c = new(1, 1)
    cyl(c, 8, 8, 4.0, 6, Wd, (6, 5), (5, 4, 3, 2), open_ring=(0.7, Wd[1], Wd[1]))
    for k, x in enumerate((4, 7, 10)):
        for y in range(0, 8):
            c.put(x, y, Wd[6]); c.put(x + 1, y, Wd[4])
    outline(c)
    contact(c, 4, 12, 14, 1)
    return c


# ------------------------------------------------------------------ 관아
def gwan_desk():
    """관아 책상 48×16: 붉은 천을 드리운 큰 책상 — 윗면에 문서·인장함·붓통."""
    c = new(3, 1)
    block(c, 1, 3, 46, 10, 4, Wd, top=(6, 5), face=(5, 4, 3, 2))
    for y in range(8, 14):                                  # 드리운 붉은 천(앞면)
        for x in range(3, 45):
            t = 4 if (x % 6 not in (0,)) else 3
            c.put(x, y, Rd[t] if y > 8 else Rd[5])
    c.hl(3, 45, 13, Pe[3])
    for x in range(4, 45, 3):
        c.put(x, 13, Pe[5])
    for x in range(8, 16): c.put(x, 6, Pl[6])
    for x in range(8, 16): c.put(x, 5, Pl[5]) if x < 14 else None
    c.hl(8, 14, 4, Pl[5]); c.hl(9, 15, 3, Pl[4])
    block(c, 22, 2, 7, 3, 2, Wd, top=(6, 5), face=(4, 3, 2, 1), ground=False)
    c.put(25, 3, Rd[5]) if False else None
    c.vl(36, 0, 4, Wd[5]); c.vl(37, 0, 4, Wd[3]); c.vl(38, 1, 4, Wd[4]); c.hl(35, 40, 4, Sr[4])
    outline(c)
    contact(c, 3, 46, 14, 2)
    return c


def gwan_chair():
    """교의(원님 의자) 16×32: 높은 등받이(붉은 천 + 나무 틀) + 앉는 널 + 두 팔걸이 + 다리."""
    c = new(1, 2)
    for y in range(2, 18):
        for x in range(2, 14):
            c.put(x, y, Rd[4] if 4 <= x <= 11 and 5 <= y <= 15 else Wd[4])
    c.hl(1, 15, 1, Wd[6]); c.hl(1, 15, 2, Wd[5]); c.vl(2, 2, 18, Wd[6]); c.vl(13, 2, 18, Wd[2])
    c.vl(4, 5, 16, Rd[5]); c.hl(4, 12, 5, Rd[5]); c.hl(4, 12, 15, Rd[2])
    c.put(7, 9, Pe[5]); c.put(8, 9, Pe[4]); c.put(7, 10, Pe[4]); c.put(8, 10, Pe[3])
    block(c, 2, 18, 12, 3, 4, Wd, top=(6, 5), face=(5, 4, 3, 2))
    for y in range(14, 22):
        c.put(1, y, Wd[5]); c.put(14, y, Wd[3])
    for x in (3, 11):
        for y in range(25, 30):
            c.put(x, y, Wd[3]); c.put(x + 1, y, Wd[2])
    outline(c)
    contact(c, 3, 13, 30, 2)
    return c


def hyeongtul():
    """곤장 틀 32×32: 긴 나무 틀 — 눕힌 널 의자 + 양쪽 기둥 + 가로대, 묶는 새끼줄 두 가닥."""
    c = new(2, 2)
    for x0 in (3, 25):
        for y in range(8, 29):
            c.put(x0, y, Wd[5]); c.put(x0 + 1, y, Wd[4]); c.put(x0 + 2, y, Wd[2])
        c.hl(x0 - 1, x0 + 4, 8, Wd[6])
    c.hl(2, 30, 7, Wd[6]); c.hl(2, 30, 8, Wd[5]); c.hl(2, 30, 9, Wd[3])
    for x in (10, 21):
        c.vl(x, 9, 14, Sr[4]); c.vl(x + 1, 9, 14, Sr[2])
    block(c, 4, 14, 24, 8, 5, Wd, top=(6, 5), face=(5, 4, 3, 2))
    for x in range(5, 27, 6):
        c.vl(x, 15, 21, Wd[4])
    for x in (6, 24):
        for y in range(27, 30):
            c.put(x, y, Wd[3]); c.put(x + 1, y, Wd[2])
    outline(c)
    contact(c, 3, 29, 30, 2)
    return c


def gonjang_rack():
    """곤장 걸이 16×32: 세운 틀에 기대 놓은 넓적한 곤장 세 자루."""
    c = new(1, 2)
    for k, x0 in enumerate((3, 7, 11)):
        for y in range(3 + k, 24):
            c.put(x0, y, Wd[6] if k == 0 else Wd[5]); c.put(x0 + 1, y, Wd[5] if k == 0 else Wd[4]); c.put(x0 + 2, y, Wd[3])
    for y in range(24, 28):
        for x in range(2, 14):
            c.put(x, y, Wd[4] if x < 8 else Wd[2])
    c.hl(2, 14, 24, Wd[6]); c.hl(2, 14, 28, Wd[1])
    for x in (3, 10):
        c.put(x, 29, Wd[2]); c.put(x + 1, 29, Wd[1])
    outline(c)
    contact(c, 3, 13, 30, 2)
    return c


def buk():
    """북 16×32: 나무 받침 틀 위에 앞을 향한 큰 북 — 가죽 면(밝음) + 붉은 테 + 놋 징, 채 하나 걸침."""
    c = new(1, 2)
    for x in (3, 12):
        for y in range(22, 30):
            c.put(x, y, Wd[4] if x < 8 else Wd[2]); c.put(x + 1, y, Wd[3] if x < 8 else Wd[1])
    c.hl(3, 14, 22, Wd[5]) if False else None
    ell(c, 8, 12, 7, 9, lambda x, y, u, v: Rd[3] if (u * u + v * v) > 0.62 else None)
    ell(c, 8, 12, 5.2, 7, lambda x, y, u, v: Pl[6] if (u < -0.15 and v < -0.15) else (Pl[5] if u < 0.4 else Pl[4]))
    for a in range(0, 360, 36):
        r = math.radians(a)
        c.put(int(round(8 + 6.4 * math.cos(r))), int(round(12 + 8.2 * math.sin(r))), Pe[5])
    c.put(8, 12, Rd[4]); c.put(7, 12, Rd[5])
    c.hl(3, 13, 21, Wd[5]); c.hl(3, 13, 22, Wd[2])
    c.vl(1, 4, 9, Wd[6]); c.put(0, 3, Wd[5]); c.vl(14, 5, 10, Wd[3])
    outline(c)
    contact(c, 3, 13, 30, 2)
    return c


# ------------------------------------------------------------------ 살림 곁들이
def ssal_gama():
    """쌀가마 16×16: 볏짚 가마 두 개 — 아래 하나·위에 하나, 묶은 새끼."""
    c = new(1, 1)
    sack(c, 1, 6, 9, 9, Sr, True)
    sack(c, 7, 8, 8, 8, Sr, True)
    sack(c, 4, 0, 8, 7, Sr, True)
    outline(c)
    contact(c, 2, 14, 15, 1)
    return c


def jangjak():
    """장작 16×16: 가로로 쌓은 장작 두 줄 + 위에 한 켠 — 통나무 단면 나이테가 보인다."""
    c = new(1, 1)
    for (yb, x0, n) in ((12, 1, 4), (7, 3, 3), (3, 5, 2)):
        for k in range(n):
            cx = x0 + k * 4 + 2
            ell(c, cx, yb, 2.6, 2.6, lambda x, y, u, v: Sr[5] if (u * u + v * v) < 0.25 else (Sr[4] if u < 0.2 else Sr[3]))
            ell(c, cx, yb, 3.0, 3.0, lambda x, y, u, v: Wd[3] if (u * u + v * v) > 0.72 else None)
    outline(c)
    contact(c, 2, 15, 15, 1)
    return c


def mul_dongi():
    """물동이 16×16: 옹기 물동이(입 넓음) + 속 물."""
    c = new(1, 1)
    shadow_ell(c, 9.5, 14.5, 6, 1.4, 70)
    from props5 import jar
    jar(c, 8, 14, 10, 5.6, lid=False, ramp=RGB['straw'])
    ell(c, 8, 5, 3.4, 1.2, lambda x, y, u, v: Wa[5] if v < 0.2 else Wa[3])
    outline(c)
    return c


def objects():
    return {
        'in_seonban': seonban('pots'), 'in_seonban_bottles': seonban('bottles'), 'in_yakjang': yakjang(2), 'in_yakjang_1': yakjang(1),
        'in_seoga': seoga(), 'in_yakyeon': yakyeon(), 'in_yakhwa': yakhwa(), 'in_herb_hang': herb_hang(),
        'in_pulmu': pulmu(), 'in_morus': morus(), 'in_charcoal': charcoal(), 'in_hwadeok': hwadeok(), 'in_tub': tub(),
        'in_tool_rack': tool_rack(), 'in_workbench': workbench(), 'in_ingots': ingots(),
        'in_jumak_counter': jumak_counter(), 'in_geolsang': geolsang(),
        'in_hunjang_sang': hunjang_sang(), 'in_hakdong_sang': hakdong_sang(), 'in_hoechori': hoechori(),
        'in_gwan_desk': gwan_desk(), 'in_gwan_chair': gwan_chair(), 'in_hyeongtul': hyeongtul(), 'in_gonjang_rack': gonjang_rack(), 'in_buk': buk(),
        'in_ssal_gama': ssal_gama(), 'in_jangjak': jangjak(), 'in_mul_dongi': mul_dongi(),
    }
