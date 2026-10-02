"""마을 생활 소품 — 물레방아·디딜방아·맷돌·평상·장독대·허수아비·고추 멍석·장작더미·막돌담·대울타리·금줄 제단·징검다리·나룻배·비석·사당·논 모.
전부 3/4 문법: 윗면(밝음) + 앞면(왼쪽 밝음→오른쪽 어둠) + 오른쪽 아래 땅 그림자. 팔레트는 harness/palette.json 만."""
import math
from tk import *
from build import outline
import blocks as K
from props5 import box, cyl, ell, shadow_ell, jar


def waterwheel():
    """물레방아 48×64: 시내 가에 세운 나무 바퀴(바퀴살 8, 물받이 판 12) + 양쪽 지지 기둥 + 위에서 물을 대는 홈통."""
    c = Cv(3 * T, 4 * T)
    Wd = RGB['wood']; S = RGB['stone']; Wt = RGB['water']
    cx, cy, R = 24, 36, 20
    shadow_ell(c, 27, 61, 21, 2.4, 70)
    for px in (2, 42):                                               # 지지 기둥
        for y in range(18, 62):
            c.put(px, y, Wd[5]); c.put(px + 1, y, Wd[4]); c.put(px + 2, y, Wd[2])
        c.put(px, 17, Wd[6]); c.put(px + 1, 17, Wd[5])
    for x in range(0, 48):                                           # 가로보
        c.put(x, 15, Wd[6]); c.put(x, 16, Wd[5]); c.put(x, 17, Wd[3])
    for x in range(22, 48):                                          # 홈통: 나무 물길(옆판 + 물)이 오른쪽에서 바퀴 위로 기울어 내려온다
        y0 = int(round(8 - (x - 22) * 0.12))
        c.put(x, y0, Wd[6]); c.put(x, y0 + 1, Wt[5] if x % 3 else Wt[4]); c.put(x, y0 + 2, Wt[4]); c.put(x, y0 + 3, Wd[4]); c.put(x, y0 + 4, Wd[2])
    for y in range(12, 19): c.put(23, y, Wt[5]); c.put(24, y, Wt[4])  # 물줄기
    ell(c, cx, cy, R, R, lambda x, y, u, v: Wd[1] if u * u + v * v > 0.5 else None)   # 바퀴 안쪽 그림자(속이 보임)
    for ang in range(0, 360, 30):                                    # 물받이 판 12
        a = math.radians(ang)
        for r in range(R - 6, R + 1):
            for wd in (-1, 0, 1):
                px = int(round(cx + math.cos(a) * r - math.sin(a) * wd * 0.6)); py = int(round(cy + math.sin(a) * r + math.cos(a) * wd * 0.6))
                c.put(px, py, Wd[5] if math.cos(a - 2.3) > 0 else Wd[3])
    for ang in range(0, 360, 45):                                    # 바퀴살 8
        a = math.radians(ang)
        for r in range(3, R - 5):
            px = int(round(cx + math.cos(a) * r)); py = int(round(cy + math.sin(a) * r))
            c.put(px, py, Wd[5] if math.cos(a - 2.3) > 0 else Wd[3])
    for yy in range(-R, R + 1):                                      # 테(림)
        for xx in range(-R, R + 1):
            d = math.hypot(xx + 0.5, yy + 0.5)
            if R - 3.2 <= d <= R - 1.6:
                c.put(cx + xx, cy + yy, Wd[6] if (xx + yy) < 0 else (Wd[4] if xx < 6 else Wd[2]))
    ell(c, cx, cy, 4.2, 4.2, lambda x, y, u, v: S[6] if (u < 0 and v < 0) else (S[4] if u < 0.4 else S[2]))   # 축
    for x in range(8, 40): c.put(x, 58 + (x % 2), Wt[3]); c.put(x, 59, Wt[4])  # 바퀴 밑 물 튐
    outline(c)
    return c


def dilbang():
    """디딜방아 64×32: 가운데 굄목(기둥 둘)에 얹은 긴 방앗대 — 오른쪽 끝은 절굿공이가 돌확에 닿고, 왼쪽 끝은 발로 밟는 넓은 판."""
    c = Cv(4 * T, 2 * T)
    Wd = RGB['wood']; S = RGB['stone']; St = RGB['straw']
    shadow_ell(c, 34, 29, 28, 2.2, 70)
    for px in (28, 34):                                              # 굄목
        box(c, px, 22, 4, 2, 7, Wd, (6, 5), (5, 4, 3, 2))
    for x in range(5, 52):                                           # 방앗대: 가운데 굵고 양끝 가늘게, 오른쪽이 약간 올라감
        t = (x - 5) / 46
        yc = int(round(16 - 3 * t + (1 if x < 20 else 0)))
        th = 3 if 22 < x < 40 else 2
        for k in range(th + 1):
            c.put(x, yc + k, Wd[6] if k == 0 else (Wd[5] if k < th else Wd[3]))
    box(c, 4, 20, 16, 3, 2, Wd, (6, 5), (5, 4, 3, 2))                # 밟는 판
    for y in range(10, 17):                                          # 절굿공이
        c.put(50, y, Wd[5]); c.put(51, y, Wd[4]); c.put(52, y, Wd[2])
    cyl(c, 54, 19, 8, 5, S, (6, 5), (5, 4, 3, 2), open_ring=(0.66, S[2], S[1]))     # 돌확
    for x in range(51, 58): c.put(x, 22, St[5]) if (x % 2) else None
    outline(c)
    return c


def millstone():
    """맷돌 32×16: 판판한 돌 받침 위에 위·아래 두 짝, 손잡이 막대."""
    c = Cv(2 * T, T)
    S = RGB['stone']; Wd = RGB['wood']
    shadow_ell(c, 18, 14, 14, 1.6, 70)
    cyl(c, 16, 8, 12, 2, S, (6, 5), (4, 3, 3, 2))
    cyl(c, 16, 5, 9, 2, S, (6, 5), (5, 4, 3, 2))
    c.put(16, 4, S[2]); c.put(15, 4, S[2]); c.put(16, 3, S[2])      # 가운데 구멍
    for y in range(1, 5): c.put(23, y, Wd[5]); c.put(24, y, Wd[3])    # 손잡이
    outline(c)
    return c


def pyeongsang():
    """큰 평상 48×32: 3×2칸 널마루 — 윗면 널 이음 줄무늬 + 앞 귀틀 + 짧은 네 다리. 위에 베개 하나."""
    c = Cv(3 * T, 2 * T)
    Wd = RGB['wood']; P = RGB['plaster']
    shadow_ell(c, 27, 30, 22, 1.9, 70)
    for lx in (4, 40):
        for y in range(25, 29): c.put(lx, y, Wd[4]); c.put(lx + 1, y, Wd[3]); c.put(lx + 2, y, Wd[2])
    for y in range(6, 22):
        for x in range(2, 46):
            tone = 6 if (y == 21 or x == 2) else (5 if (y % 4) else 4)
            c.put(x, y, Wd[tone])
    for x in range(2, 46):
        f = (x - 2) / 43
        t = 4 if f < 0.3 else (3 if f < 0.7 else 2)
        c.put(x, 22, Wd[t]); c.put(x, 23, Wd[t]); c.put(x, 24, Wd[max(1, t - 1)])
    ell(c, 34, 15, 5.5, 2.4, lambda x, y, u, v: P[5] if (u < 0.1 and v < 0.1) else P[3])
    outline(c)
    return c


def jangdokdae():
    """장독대 48×32: 막돌 낮은 단 위에 크기 다른 항아리 다섯, 뒤줄 셋 앞줄 둘."""
    c = Cv(3 * T, 2 * T)
    S = RGB['stone']
    shadow_ell(c, 27, 29.5, 22, 2.0, 70)
    box(c, 3, 29, 42, 5, 4, S, (5, 4), (4, 3, 2, 1))
    for cx, yb, h, bl in ((10, 22, 14, 5.6), (22, 21, 16, 6.2), (35, 22, 13, 5.2), (16, 28, 11, 4.8), (30, 28, 10, 4.4)):
        jar(c, cx, yb, h, bl, lid=(cx % 2 == 0))
    outline(c)
    return c


def scarecrow():
    """허수아비 16×32: 십자 막대 + 짚 몸통 + 삿갓 + 펄럭이는 헝겊."""
    c = Cv(T, 2 * T)
    Wd = RGB['wood']; S = RGB['straw']; P = RGB['plaster']; R = RGB['red']
    shadow_ell(c, 10, 30, 6, 1.4, 70)
    for y in range(8, 30): c.put(7, y, Wd[5]); c.put(8, y, Wd[3])
    for x in range(1, 15): c.put(x, 13, Wd[5]); c.put(x, 14, Wd[3])
    for y in range(13, 24):
        for x in range(4, 12):
            c.put(x, y, S[5] if x < 7 else (S[4] if x < 9 else S[3]))
    for y in range(14, 21):
        c.put(2, y, S[4]); c.put(13, y, S[3])
    ell(c, 8, 7, 4.2, 3.4, lambda x, y, u, v: P[5] if u < -0.2 else (P[4] if u < 0.4 else P[3]))   # 얼굴(복주머니 천)
    for x in range(1, 15):                                           # 삿갓
        d = abs(x - 8)
        for y in range(3, 7 - d // 3 + 1): c.put(x, y + d // 3, S[6] if x < 8 else S[4])
    c.hl(1, 15, 6, S[2])
    for y in range(24, 29): c.put(5, y, R[4]); c.put(6, y, R[3])
    outline(c)
    return c


def gochu_mat():
    """고추 멍석 32×16: 짚 멍석 위에 붉은 고추가 펼쳐진 모양. 가장자리는 둥글게 말아 올린 짚 띠."""
    c = Cv(2 * T, T)
    S = RGB['straw']; R = RGB['red']
    shadow_ell(c, 18, 13.5, 14, 1.3, 60)
    for y in range(3, 13):
        for x in range(3, 29):
            tone = 5 if (y == 12 or x == 3) else (4 if (x + y) % 3 else 3)
            c.put(x, y, S[tone])
    for (gx, gy) in ((6, 5), (10, 7), (14, 5), (18, 8), (22, 6), (8, 10), (13, 10), (20, 11), (25, 9), (16, 7), (6, 8), (24, 4)):
        c.put(gx, gy, R[4]); c.put(gx + 1, gy, R[3]); c.put(gx + 1, gy + 1, R[2]) if gx % 3 else c.put(gx, gy + 1, R[3])
    for x in range(3, 29): c.put(x, 13, S[2])
    outline(c)
    return c


def gochu_mat():
    """고추 멍석 32×16: 짚 멍석 위에 붉은 고추가 펼쳐진 모양."""
    c = Cv(2 * T, T)
    S = RGB['straw']; R = RGB['red']
    shadow_ell(c, 18, 13.5, 14, 1.3, 60)
    for y in range(3, 13):
        for x in range(3, 29):
            tone = 5 if (y == 12 or x == 3) else (4 if (x + y) % 3 else 3)
            c.put(x, y, S[tone])
    for (gx, gy) in ((6, 5), (10, 7), (14, 5), (18, 8), (22, 6), (8, 10), (13, 10), (20, 11), (25, 9), (16, 7), (6, 8), (24, 4)):
        c.put(gx, gy, R[4]); c.put(gx + 1, gy, R[3]); c.put(gx + 1, gy + 1, R[2]) if gx % 3 else c.put(gx, gy + 1, R[3])
    for x in range(3, 29): c.put(x, 13, S[2])
    outline(c)
    return c


def firewood():
    """장작더미 32×16: 가로로 쌓은 통나무 단면(앞에 보이는 둥근 동그라미 나이테)과 윗줄."""
    c = Cv(2 * T, T)
    Wd = RGB['wood']; S = RGB['straw']
    shadow_ell(c, 18, 14.5, 14, 1.3, 70)
    for (yb, x0, n) in ((12, 3, 6), (7, 6, 5), (3, 9, 4)):
        for k in range(n):
            cx = x0 + k * 4 + 2
            ell(c, cx, yb, 2.6, 2.6, lambda x, y, u, v: S[5] if (u * u + v * v) < 0.25 else (S[4] if u < 0.2 else S[3]))
            ell(c, cx, yb, 3.0, 3.0, lambda x, y, u, v: Wd[3] if (u * u + v * v) > 0.72 else None)
    outline(c)
    return c


def dolmadam():
    """막돌담 16×16(이어 붙임): 크기 다른 막돌을 흙으로 메워 쌓은 낮은 담 — 윗면 밝은 돌머리 한 줄 + 앞면 돌 두 켜. 이음 없음."""
    c = Cv(T, T)
    S = RGB['stone']; E = RGB['earth']
    for x in range(T): c.put(x, 15, SHADOW, 85); c.put(x, 14, SHADOW, 40)
    for y in range(5, 14):
        for x in range(T):
            c.put(x, y, E[3] if rnd(x, y, 21) > 0.2 else E[4])
    for x in range(T):                                               # 윗면(돌머리)
        c.put(x, 4, S[6]); c.put(x, 5, S[5] if x % 5 else S[4])
    for row, (y0, y1) in enumerate(((6, 9), (10, 13))):              # 막돌 두 켜
        x = (0 if row == 0 else 3)
        while x < T + 3:
            wd = 4 + (hsh(x, y0, 5) % 3)
            for xx in range(x, min(T, x + wd)):
                for yy in range(y0, y1):
                    f = (xx - x) / max(1, wd - 1)
                    c.put(xx, yy, S[5] if (yy == y0 or f < 0.2) else (S[4] if f < 0.7 else S[3]))
            x += wd + 1
    outline(c)
    return c


def jukbyeok():
    """대울타리 16×16(이어 붙임): 가는 대나무 세로 살 다섯, 가로대 둘, 윗끝이 비스듬히 잘린 모양."""
    c = Cv(T, T)
    S = RGB['straw']; G = RGB['leaf']
    for x in range(T): c.put(x, 15, SHADOW, 85); c.put(x, 14, SHADOW, 45)
    for k, x in enumerate((1, 4, 7, 10, 13)):
        top = 3 + (k * 2) % 3
        for y in range(top, 14):
            c.put(x, y, S[5]); c.put(x + 1, y, S[4]); c.put(x + 2, y, S[2]) if (x + 2) % 3 else None
        c.put(x, top - 1, S[6])
        for y in range(top + 3, 14, 4): c.hl(x, x + 2, y, S[1])
    for yy in (6, 11):
        for x in range(T): c.put(x, yy, S[3] if x % 2 else S[2])
    outline(c)
    return c


def geumjul_altar():
    """당산 제단 48×32: 납작한 큰 돌 제단 위에 작은 돌탑 둘과 항아리, 앞에 금줄(새끼줄에 하얀 종이)을 두른 낮은 말뚝 둘."""
    c = Cv(3 * T, 2 * T)
    S = RGB['stone']; St = RGB['straw']; P = RGB['plaster']; Wd = RGB['wood']
    shadow_ell(c, 27, 30, 22, 2.0, 70)
    box(c, 4, 29, 40, 7, 5, S, (6, 5), (5, 4, 3, 2))
    for (cx, base) in ((14, 20), (33, 20)):                           # 작은 돌탑
        for k, rx in enumerate((5, 4, 3, 2)):
            yb = base - k * 3
            ell(c, cx, yb, rx, 1.9, lambda x, y, u, v: S[6] if v < -0.3 else (S[4] if u < 0.4 else S[3]))
            for y in range(yb, yb + 2): c.hl(int(cx - rx + 1), int(cx + rx), y, S[4])
    jar(c, 24, 21, 11, 4.2, lid=True)
    for px in (2, 45):                                               # 금줄 말뚝
        for y in range(10, 30): c.put(px, y, Wd[5]); c.put(px + 1, y, Wd[3])
    for x in range(3, 46):
        y = int(round(12 + 4 * math.sin((x - 3) / 42 * math.pi)))
        c.put(x, y, St[5]); c.put(x, y + 1, St[3])
    for x in (10, 18, 26, 34, 42):
        y = int(round(12 + 4 * math.sin((x - 3) / 42 * math.pi))) + 2
        for k in range(5): c.put(x, y + k, P[5] if k % 2 == 0 else P[3]); c.put(x + 1, y + k, P[4])
    outline(c)
    return c


def stepping_stones():
    """징검다리 32×16: 물 위에 놓은 납작한 돌 넷(윗면 + 앞 한 줄), 돌마다 모양이 다르다."""
    c = Cv(2 * T, T)
    S = RGB['stone']; Wt = RGB['water']
    for (cx, cy, rx, ry) in ((4, 8, 3.8, 2.4), (11, 6, 3.4, 2.2), (18, 9, 3.8, 2.4), (26, 7, 3.6, 2.3)):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2): c.put(x, int(cy + ry) + 2, Wt[5], 160)
        ell(c, cx, cy, rx, ry, lambda x, y, u, v: S[6] if (v < -0.2 and u < 0.2) else S[5])
        ell(c, cx, cy + 1.6, rx, ry * 0.8, lambda x, y, u, v: S[3] if v > 0.1 else None)
    outline(c)
    return c


def boat():
    """작은 나룻배 48×32: 길쭉한 나무배를 위에서 3/4로 본 모양 — 양끝이 뾰족하고 들려 올라간 뱃머리, 안쪽 널마루와 가로 앉을널, 앞쪽 곡면 외판, 삿대."""
    c = Cv(3 * T, 2 * T)
    Wd = RGB['wood']; Wt = RGB['water']
    for x in range(4, 44): c.put(x, 28, Wt[5], 140); c.put(x, 29, Wt[4], 140)
    for x in range(1, 47):
        s = (x - 23.5) / 22.5
        k = max(0.0, 1 - abs(s) ** 1.5)
        lift = 4 * s * s
        ytop = int(round(15 - 6 * k - lift)); ymid = int(round(16 - 1.5 * lift)); ybot = int(round(16 + 8 * k - lift * 0.5))
        for y in range(ytop, ymid):                                   # 안쪽 널마루(윗면)
            c.put(x, y, Wd[3] if (x // 3) % 2 else Wd[2])
        c.put(x, ytop, Wd[6]); c.put(x, ymid, Wd[6])                   # 뱃전 윗줄
        for y in range(ymid + 1, ybot + 1):                           # 앞쪽 외판
            u = s
            c.put(x, y, Wd[5] if u < -0.45 else (Wd[4] if u < 0.1 else (Wd[3] if u < 0.55 else Wd[2])))
    for x in (13, 24, 34):                                            # 가로 앉을널
        for y in range(10, 16): c.put(x, y, Wd[5]); c.put(x + 1, y, Wd[4])
    for k in range(22):                                               # 삿대
        c.put(38 - k // 2, 26 - k, Wd[5] if k % 2 else Wd[4])
    outline(c)
    return c


def stele():
    """송덕비 16×32: 3단 받침돌 위에 선 넓은 비석(윗머리 둥글게, 앞면에 가는 글줄과 가운데 큰 글자 칸)."""
    c = Cv(T, 2 * T)
    S = RGB['stone']
    shadow_ell(c, 10, 30, 7, 1.5, 70)
    box(c, 1, 30, 14, 3, 3, S, (6, 5), (4, 3, 2, 1))
    box(c, 2, 27, 12, 2, 2, S, (6, 5), (5, 4, 3, 2))
    for y in range(4, 25):
        for x in range(3, 13):
            if y < 8 and ((x - 7.5) ** 2 / 25 + (y - 8) ** 2 / 16 > 1): continue
            f = (x - 3) / 9
            c.put(x, y, S[6] if f < 0.15 else (S[5] if f < 0.5 else (S[4] if f < 0.85 else S[3])))
    for y in range(9, 22):
        c.put(7, y, S[2]) if y % 3 else None
        c.put(5, y, S[3]) if (y + 1) % 3 else None
        c.put(10, y, S[2]) if (y + 2) % 3 else None
    outline(c)
    return c


def sadang():
    """사당 64×96: 작은 맞배 기와집 둘레에 낮은 담이 두른 가묘 — 문 하나, 단청 없는 소박한 처마."""
    import catalog
    return K.assemble(K.house('jo', 2, 'dr', 'dr', steps=(0,), hip=True, chimi=False), catalog.lib(), post=lambda cv: K.roof_baram(cv, 3, 'giwa', wing=18))


def stove_pot():
    """가마솥 아궁이 32×32: 흙 부뚜막 위에 걸린 큰 가마솥(뚜껑 돔) + 옆에 쌓은 장작."""
    c = Cv(2 * T, 2 * T)
    E = RGB['earth']; G = RGB['giwa']; Wd = RGB['wood']; St = RGB['straw']
    shadow_ell(c, 18, 29, 14, 2.2, 70)
    box(c, 3, 26, 26, 8, 12, E, (6, 5), (5, 4, 3, 2))
    ell(c, 14, 14, 8.5, 5.5, lambda x, y, u, v: G[6] if (u < -0.2 and v < 0) else (G[5] if u < 0.3 else G[4]))
    ell(c, 14, 10.5, 3.2, 1.6, lambda x, y, u, v: G[3])
    for y in range(20, 26):
        for x in range(9, 20): c.put(x, y, G[1] if (x + y) % 5 else G[2])
    for x in range(11, 18): c.put(x, 24, RGB['persimmon'][4]) if x % 2 else c.put(x, 25, RGB['persimmon'][3])
    outline(c)
    return c


def paddy_edge_rice(mask):
    """논(모내기한 칸): 물 위에 연둣빛 모포기가 줄지어 서 있다. 논두렁은 물 쪽으로 낮은 흙둑."""
    from ground import N, E as EE, S as SS, W as WW
    c = Cv(T, T)
    w = RGB['water']; g = RGB['leaf']; e = RGB['earth']
    for y in range(T):
        for x in range(T):
            col = w[3] if rnd(x, y, 620 + mask) > 0.12 else w[2]
            if y % 4 == 3 and rnd(x, y, 5) > 0.5: col = w[4]
            c.put(x, y, col)
    for gy in (2, 7, 12):                                            # 모포기 줄
        for gx in (1, 5, 9, 13):
            ox = (gy // 5) % 2 * 2
            x = gx + ox
            c.put(x, gy, g[6]); c.put(x + 1, gy, g[5]); c.put(x, gy + 1, g[5]); c.put(x + 1, gy + 1, g[4]); c.put(x - 1, gy + 1, g[4]); c.put(x, gy + 2, g[3])
    for bit, sl in ((N, (lambda i: (i, 0), lambda i: (i, 1), lambda i: (i, 2))), (SS, (lambda i: (i, 15), lambda i: (i, 14), lambda i: (i, 13))),
                    (WW, (lambda i: (0, i), lambda i: (1, i), lambda i: (2, i))), (EE, (lambda i: (15, i), lambda i: (14, i), lambda i: (13, i)))):
        if mask & bit:
            continue
        for i in range(T):
            (x0, y0), (x1, y1), (x2, y2) = sl[0](i), sl[1](i), sl[2](i)
            c.put(x0, y0, e[5] if rnd(i, bit, 3) > 0.3 else e[4]); c.put(x1, y1, e[4]); c.put(x2, y2, e[3])
    return c


def dock():
    """선착장 16×32: 물가에서 물 위로 내민 널 다리 — 가로 널 일곱 줄, 양옆 말뚝 둘, 끝에 밧줄 묶는 말뚝."""
    c = Cv(T, 2 * T)
    Wd = RGB['wood']
    for y in range(0, 26):
        for x in range(2, 14):
            tone = 6 if (y % 4 == 0) else (5 if y % 4 in (1, 2) else 3)
            if x in (2, 13): tone = 3 if x == 2 else 2
            c.put(x, y, Wd[tone])
    for y in range(26, 29):
        for x in range(2, 14): c.put(x, y, Wd[4] if y == 26 else Wd[2])
    for px in (0, 13):
        for y in range(8, 31): c.put(px, y, Wd[5]); c.put(px + 1, y, Wd[3]) if px else c.put(px + 1, y, Wd[4])
        c.put(px, 7, Wd[6])
    outline(c)
    return c
