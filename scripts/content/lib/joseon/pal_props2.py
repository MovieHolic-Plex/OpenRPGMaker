"""조선 궁 기물 2: 침전·신하 자리 (궁중 병풍·침구·용 문양 장·서안·화로·큰 촛대·비단 방석·신하 깔개·궁중 족자).

시점·색 규칙은 pal_props.py 와 같다(앞면 + 윗면 3~5px, 빛은 왼쪽 위, 놋쇠 persimmon·칠 red·단청). 접두 pal_.
"""
from inb_tk import *
import props5 as P5
from inb_props import _top, _front, _panel, _pull, BR, IR
from pal_props import dragon


# ----------------------------------------------------------------------------------------------------- 궁중 병풍 4폭 (모란도) 4×2
def byeongpung_gung(kind='moran'):
    """궁중 병풍(64×32): 붉은 칠 틀에 금 테, 비단 바탕에 모란 큰 꽃과 바위·잎. 접힌 폭이 윗선에서 지그재그로 어긋난다."""
    W_ = 64
    cv = Cv(W_, 32)
    pw = 16
    for i in range(4):
        x0 = i * pw
        dy = 1 if i % 2 else 0
        y0, y1 = 2 + dy, 30 + dy
        cv.rect(x0, y0, x0 + pw, y1, RD[3])
        cv.hl(x0, x0 + pw, y0, RD[6]); cv.hl(x0, x0 + pw, y0 + 1, RD[5])
        cv.vl(x0, y0, y1, RD[5] if i % 2 == 0 else RD[4]); cv.vl(x0 + pw - 1, y0, y1, RD[2])
        cv.hl(x0, x0 + pw, y1 - 2, RD[2]); cv.hl(x0, x0 + pw, y1 - 1, RD[1])
        sx0, sx1, sy0, sy1 = x0 + 2, x0 + pw - 2, y0 + 3, y1 - 4
        for y in range(sy0, sy1):
            for x in range(sx0, sx1):
                q = rnd(x, y, 1100 + i)
                cv.put(x, y, SW[6] if q > 0.1 else SW[5])
        rim(cv, sx0 - 1, sy0 - 1, sx1 + 1, sy1 + 1, PS[3])                       # 금 안테두리
        if kind == 'sansu':                                                   # 산수: 청 하늘 → 먼 산 둘 → 물 → 폭마다 다른 소나무
            for y in range(sy0, sy1):
                for x in range(sx0, sx1):
                    cv.put(x, y, PL[6] if (y - sy0) < 5 else (SW[6] if (y - sy0) < 12 else SW[5]))
            for x in range(sx0, sx1):
                hh = 4 + ((x * 2 + i * 5) % 7)
                for y in range(sy1 - hh - 7, sy1 - 7):
                    cv.put(x, y, DB[5] if (y - (sy1 - hh - 7)) < 2 else DB[4])
            for y in range(sy1 - 7, sy1):
                for x in range(sx0, sx1):
                    cv.put(x, y, DB[3] if (y + i) % 3 else PL[5])
            tx = sx0 + 3 + (i % 2) * 4
            cv.vl(tx, sy0 + 6 + (i % 3), sy1 - 7, WD[2])
            disc(cv, tx, sy0 + 6 + (i % 3), 2.6, DG[4]); disc(cv, tx - 1, sy0 + 5 + (i % 3), 1.4, DG[5])
            if i == 1:
                disc(cv, sx0 + 8, sy0 + 3, 1.8, PL[6])
            if i == 2:
                disc(cv, sx0 + 4, sy0 + 3, 1.8, RD[5])
        else:
            for y in range(sy1 - 5, sy1):                                          # 바위(아래)
                for x in range(sx0 + 1, sx1 - 1):
                    if abs(x - (sx0 + 5)) < 5 - (sy1 - y) // 2 + (i % 2):
                        cv.put(x, y, GI[5] if x < sx0 + 5 else GI[4])
            fx, fy = sx0 + 5 + (i % 2) * 2 - 1, sy0 + 5 + (i * 3) % 5
            for k in range(3):
                line(cv, sx0 + 1, sy1 - 7 - k * 5, sx1 - 2, sy1 - 10 - k * 5 + (i % 2), DG[4])
            for (dx, dy2, rr) in ((0, 0, 3.2), (-1, 8, 2.6)):
                disc(cv, fx + dx, fy + dy2, rr, RD[4]); disc(cv, fx + dx - 1, fy + dy2 - 1, rr * 0.55, RD[6]); cv.put(fx + dx, fy + dy2, PS[5])
            cv.vl(fx, fy + 3, sy1 - 5, DG[3])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 침구 2×2
def chimgu():
    """침구(32×32): 비단 요 위에 붉은 금박 이불을 접어 놓고 윗쪽에 원앙 베개 둘. 바닥에 놓인 것이라 윗면이 크고 앞 두께 3px."""
    cv = Cv(32, 32)
    # 요(바닥에 깔린 짙은 청 비단)
    for y in range(2, 28):
        for x in range(1, 31):
            q = rnd(x, y, 1120)
            cv.put(x, y, DB[3] if q > 0.08 else DB[2])
    cv.hl(1, 31, 2, DB[5]); cv.vl(1, 2, 28, DB[4])
    # 베개 두 개(원앙 베개: 흰 비단 + 붉은 수 + 금 마구리)
    for px in (4, 18):
        for y in range(3, 10):
            for x in range(px, px + 10):
                cv.put(x, y, PL[6] if (y < 5 or x < px + 2) else PL[5])
        cv.hl(px, px + 10, 9, PL[3]); cv.rect(px, 4, px + 2, 9, PS[4]); cv.rect(px + 8, 4, px + 10, 9, PS[3])
        cv.put(px + 4, 6, RD[5]); cv.put(px + 5, 6, RD[5]); cv.put(px + 5, 7, PS[5])
    # 이불(윗면 + 앞 두께)
    for y in range(11, 26):
        for x in range(3, 29):
            q = rnd(x, y, 1130)
            c = RD[5] if (y < 13 or x < 5) else (RD[4] if q > 0.08 else RD[3])
            cv.put(x, y, c)
    for x in range(3, 29):                                                                      # 금박 바둑 무늬
        for y in range(14, 24):
            if ((x // 3) + (y // 3)) % 2 == 0 and x % 3 == 1 and y % 3 == 1:
                cv.put(x, y, PS[5])
    cv.hl(3, 29, 11, PL[6]); cv.hl(3, 29, 12, PL[5])                                            # 깃(흰 동정)
    for x in range(3, 29):
        cv.put(x, 26, RD[3]); cv.put(x, 27, RD[2]); cv.put(x, 28, RD[1])
    cv.vl(3, 11, 26, RD[6]); cv.vl(28, 11, 27, RD[2])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 서안 2×1
def seoan_b():
    """서리(書吏) 서안 변형(32×16): 감나무빛 낮은 책상. 윗면에 책 더미(왼쪽)·펼친 장부(가운데)·붓통(오른쪽 끝)."""
    cv = Cv(32, 16)
    for y in range(3, 8):
        for x in range(0, 32):
            cv.put(x, y, WD[5] if (y == 3 or x == 0) else WD[4])
    cv.hl(0, 32, 7, WD[2])
    for x in range(0, 32):
        cv.put(x, 8, WD[3]); cv.put(x, 9, WD[2] if (x // 10) % 2 else WD[3]); cv.put(x, 10, WD[1])
    cv.hl(0, 32, 11, WD[1])
    for k, c in enumerate((PL[6], SW[6], PL[5])):         # 책 더미 3권
        cv.rect(2, 4 - k, 8, 5 - k, c); cv.hl(2, 9, 4 - k, PL[6]); cv.hl(2, 9, 5 - k, WD[3])
    cv.rect(12, 3, 21, 6, PL[6]); cv.vl(16, 3, 6, WD[3]); cv.hl(13, 15, 4, GI[2]); cv.hl(17, 20, 5, GI[2])   # 펼친 장부
    cv.rect(26, 3, 29, 6, DG[3]); cv.vl(27, 0, 2, WD[5]); cv.vl(28, 1, 2, WD[4]); cv.put(27, 0, RD[5])      # 붓통 + 붓
    for x in (3, 27):
        cv.rect(x, 12, x + 2, 16, WD[1]); cv.put(x, 12, WD[3])
    B.outline(cv)
    return cv


def seoan_gung():
    """궁중 서안(32×16): 붉은 옻칠 낮은 책상 + 금 가장자리. 윗면에 벼루·붓통·두루마리."""
    cv = Cv(32, 16)
    for y in range(3, 8):
        for x in range(0, 32):
            cv.put(x, y, RD[6] if (y == 3 or x == 0) else RD[5])
    cv.hl(0, 32, 7, PS[4])
    for x in range(0, 32):
        cv.put(x, 8, RD[4]); cv.put(x, 9, RD[3] if (x // 8) % 2 else RD[4]); cv.put(x, 10, RD[2])
    cv.hl(0, 32, 11, PS[3])
    # 윗면 위: 두루마리 둘(왼쪽), 붓통(가운데), 벼루(오른쪽) — 빛이 왼쪽 위라 무거운 검은 벼루는 오른쪽에 둔다
    for (x0, c) in ((3, SW[6]), (8, PL[6])):
        cv.rect(x0, 3, x0 + 5, 6, c); cv.vl(x0, 3, 6, RD[4]); cv.vl(x0 + 4, 3, 6, RD[3]); cv.hl(x0, x0 + 5, 3, PL[6])
    cv.rect(15, 1, 18, 6, WD[4]); cv.vl(15, 1, 6, WD[5]); cv.put(16, 0, IR[2]); cv.put(17, 0, IR[3]); cv.put(15, 0, WD[2])
    cv.rect(21, 4, 29, 7, GI[2]); cv.hl(21, 29, 4, GI[4]); cv.rect(22, 5, 26, 6, GI[1])
    for x in (3, 27):
        cv.rect(x, 12, x + 2, 16, RD[2]); cv.put(x, 12, RD[4])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 화로 1×1 (궁중)
def hwaro_gung():
    """궁중 청동 화로(16×16): 금 띠를 두른 놋쇠 세 발 솥, 붉은 숯불, 뚜껑 구멍."""
    cv = Cv(16, 16)
    for fx in (3, 7, 11):
        cv.rect(fx, 13, fx + 2, 16, BR[3]); cv.put(fx, 13, BR[5])
    P5.cyl(cv, 8, 7, 6, 5, BR, top=(6, 5), body=(5, 4, 3, 2))
    P5.ell(cv, 8, 7, 4.4, 2.2, lambda x, y, u, v: PS[6] if (u + v) < -0.5 else (RD[5] if v < 0.2 else RD[3]))
    for (x, y) in ((6, 6), (9, 7), (8, 5)):
        cv.put(x, y, PS[5])
    cv.hl(3, 14, 11, PS[4]); cv.hl(3, 14, 12, PS[2])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 큰 촛대 1×2
def chotdae_big():
    """큰 촛대(16×32): 세 발 받침, 가는 놋쇠 기둥, 위 접시에 굵은 붉은 초와 불꽃."""
    cv = Cv(16, 32)
    for x in range(3, 13):
        cv.put(x, 28, BR[5] if x < 8 else BR[3]); cv.put(x, 29, BR[3] if x < 8 else BR[2])
    cv.hl(2, 14, 30, BR[1]); cv.hl(4, 12, 27, BR[6])
    cv.rect(7, 12, 9, 27, BR[4]); cv.vl(7, 12, 27, BR[6]); cv.vl(8, 12, 27, BR[3])
    for (y, hw) in ((17, 2), (22, 3)):
        cv.hl(7 - hw, 9 + hw, y, BR[5]); cv.hl(7 - hw, 9 + hw, y + 1, BR[3])
    P5.ell(cv, 8, 11, 5, 2.2, lambda x, y, u, v: BR[6] if v < 0 else BR[3])
    cv.rect(6, 4, 10, 10, RD[5]); cv.vl(6, 4, 10, RD[6]); cv.vl(9, 4, 10, RD[3])               # 초
    cv.hl(6, 10, 4, PL[5])
    cv.rect(7, 1, 9, 4, PS[5]); cv.put(8, 0, PS[6]); cv.put(8, 2, PL[6]); cv.put(8, 3, PL[6])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 용 문양 장 2×3
def yong_jang():
    """용 문양 대형 장(32×48): 검붉은 칠 큰 장, 두 짝 문에 금빛 용이 서린 모양, 놋쇠 경첩·자물쇠, 윗면 4px, 아래 받침 다리."""
    W_, H_ = 32, 48
    cv = Cv(W_, H_)
    _top(cv, 0, 1, W_, 4, RD)
    cv.hl(0, W_, 1, RD[6]); cv.hl(0, W_, 0, PS[4]) if False else None
    for y in range(5, 42):
        for x in range(W_):
            f = x / (W_ - 1)
            t = 5 if f < 0.25 else (4 if f < 0.7 else 3)
            cv.put(x, y, RD[t] if y > 6 else RD[3])
    cv.hl(0, W_, 5, PS[3]); cv.hl(0, W_, 6, RD[2])                                              # 윗 처마 금띠
    # 두 짝 문(들어간 판)
    for (x0, x1) in ((2, 15), (17, 30)):
        rim(cv, x0, 8, x1, 38, RD[1])
        for y in range(9, 37):
            for x in range(x0 + 1, x1 - 1):
                cv.put(x, y, RD[2] if rnd(x, y, 1140) > 0.1 else RD[1])
        cv.hl(x0 + 1, x1 - 1, 9, RD[4]); cv.vl(x0 + 1, 9, 37, RD[3])
    # 용: 두 짝 문마다 한 마리씩 위로 오르는 금빛 용(왼쪽 문은 오른쪽으로, 오른쪽 문은 왼쪽으로 굽이친다)
    dragon(cv, 8, 36, -24, 3.0, vertical=True, thick=1.3)
    dragon(cv, 23, 36, -24, 3.0, vertical=True, thick=1.3, flip=True)
    for (cx, cy) in ((5, 12), (13, 30), (26, 12), (19, 28)):
        cv.rect(cx, cy, cx + 3, cy + 2, PS[3]); cv.put(cx + 1, cy - 1, PS[4])                           # 구름
    # 놋쇠 경첩·자물쇠
    for y in (14, 30):
        cv.rect(0, y, 3, y + 3, BR[5]); cv.rect(29, y, 32, y + 3, BR[3])
    cv.rect(14, 22, 18, 28, BR[5]); cv.hl(14, 18, 22, BR[6]); cv.hl(14, 18, 27, BR[3]); cv.put(16, 24, IR[1])
    # 받침
    for x in range(W_):
        cv.put(x, 41, RD[1]); cv.put(x, 42, RD[3]); cv.put(x, 43, RD[2])
    for fx in (1, 27):
        cv.rect(fx, 43, fx + 4, 47, WD[3]); cv.vl(fx, 43, 47, WD[5]); cv.hl(fx, fx + 4, 47, WD[1])
    cv.hl(0, W_, 47, WD[1]) if False else None
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 비단 방석 1×1
def bangseok_gung(kind='a'):
    """비단 방석(16×16): 둥근 사각, 금실 테두리와 네 귀 술, 가운데 금 단추. a=붉은 b=짙은 청 c=녹."""
    cv = Cv(16, 16)
    ramp = {'a': RD, 'b': DB, 'c': DG}[kind]
    for y in range(3, 12):
        for x in range(1, 15):
            if (x in (1, 14) and y in (3, 11)):
                continue
            t = 6 if (y == 3 or x == 1) else (5 if (x < 8 and y < 9) else 4)
            cv.put(x, y, ramp[t])
    for x in range(2, 14):
        cv.put(x, 11, ramp[3]); cv.put(x, 12, ramp[2]); cv.put(x, 13, ramp[1])
    rim(cv, 2, 4, 13, 11, PS[4])
    cv.put(7, 7, PS[6]); cv.put(8, 7, PS[5]); cv.put(7, 8, PS[4]); cv.put(8, 8, PS[3])
    for (x, y) in ((1, 3), (14, 3)):
        cv.put(x, y, PS[5]); cv.put(x, y + 1, PS[3])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 신하 깔개 2×1
def mat_sinha(kind='b1'):
    """신하 자리 깔개(32×16): 바닥에 깐 직사각 돗자리(윗면) + 방석 하나 + 홀(손에 드는 판). b=청록 계열(문신) r=붉은 계열(무신). 1·2·3 은 무늬·방석 위치가 다르다."""
    cv = Cv(32, 16)
    fam, n = kind[0], int(kind[1])
    ramp = DG if fam == 'b' else RD
    edge = DB if fam == 'b' else PS
    for y in range(2, 13):
        for x in range(1, 31):
            q = rnd(x, y, 1200 + n)
            cv.put(x, y, ramp[4] if q > 0.12 else ramp[3])
    cv.hl(1, 31, 2, ramp[6]); cv.vl(1, 2, 13, ramp[5])
    for x in range(1, 31):
        cv.put(x, 12, ramp[2]); cv.put(x, 13, ramp[1])
    rim(cv, 3, 4, 29, 11, edge[4] if fam == 'b' else PS[4])
    # 무늬: n 마다 다름(1 마름모 줄, 2 줄무늬, 3 점)
    for x in range(4, 28):
        if n == 1 and (x % 4) == 0: cv.put(x, 7, PS[4]); cv.put(x, 8, PS[3])
        if n == 2 and (x % 3) == 0:
            for y in (5, 10): cv.put(x, y, ramp[5])
        if n == 3 and (x % 5) == 2:
            cv.put(x, 6, PS[3]); cv.put(x + 1, 9, PS[3])
    # 방석(깔개 위): 위치 변주
    bx = {1: 9, 2: 14, 3: 12}[n]
    for y in range(4, 11):
        for x in range(bx, bx + 9):
            if (x in (bx, bx + 8) and y in (4, 10)):
                continue
            cv.put(x, y, PL[6] if (y == 4 or x == bx) else PL[5])
    cv.hl(bx + 1, bx + 8, 10, PL[3])
    rim(cv, bx, 4, bx + 9, 11, edge[3])
    cv.put(bx + 4, 7, PS[5]); cv.put(bx + 5, 7, PS[4])
    # 홀(작은 판, 깔개 오른쪽/왼쪽에 놓음)
    hx = 23 if n != 2 else 5
    cv.rect(hx, 6, hx + 4, 9, PL[6]); cv.hl(hx, hx + 4, 6, WD[6]); cv.hl(hx, hx + 4, 8, PL[4])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 궁중 족자 1×2
def hang_jokja_gung(kind='a'):
    """벽에 거는 궁중 족자(16×32, 벽면 두 줄에 걸림): 위·아래 축과 붉은 천 두름, 가운데 그림(a: 산수 / b: 큰 글씨 네 자)."""
    cv = Cv(16, 32)
    cv.rect(2, 3, 14, 5, WD[5]); cv.hl(2, 14, 3, WD[6]); cv.rect(1, 2, 3, 6, PS[4]); cv.rect(13, 2, 15, 6, PS[3])   # 위 축
    for y in range(6, 26):
        for x in range(3, 13):
            cv.put(x, y, RD[4] if (x < 4 or x > 11 or y < 8) else (SW[6] if kind == 'a' else PL[6]))
    for y in range(9, 24):
        for x in range(5, 11):
            cv.put(x, y, SW[6] if kind == 'a' else PL[6])
    if kind == 'a':                                                                                      # 산수: 먼 산, 소나무, 물
        for x in range(5, 11):
            h = 4 + (x * 3) % 4
            for y in range(20 - h, 21):
                cv.put(x, y, DB[5] if y < 18 else DB[4])
        for y in range(21, 23):
            for x in range(5, 11):
                cv.put(x, y, DB[3] if y == 21 else DG[3])
        cv.put(8, 11, PS[5]); cv.put(7, 12, PS[5]); cv.vl(6, 13, 18, WD[2])
        disc(cv, 6, 12, 1.6, PN_[3])
    else:                                                                                                # 글씨 네 자(세로 두 줄, 먹)
        for k, x in enumerate((6, 9)):
            for j in range(4):
                y = 10 + j * 3
                cv.vl(x, y, y + 2, IR[0]); cv.put(x + 1, y + 1, IR[1]); cv.put(x - 1 if j % 2 else x + 1, y, IR[2])
        cv.rect(8, 21, 10, 23, RD[5])
    cv.rect(2, 26, 14, 28, WD[5]); cv.hl(2, 14, 26, WD[6]); cv.hl(2, 14, 28, WD[2]); cv.rect(1, 26, 3, 29, PS[4]); cv.rect(13, 26, 15, 29, PS[3])   # 아래 축
    cv.vl(8, 29, 32, RD[4]); cv.put(7, 31, RD[3]); cv.put(9, 31, RD[3])
    B.outline(cv)
    return cv


PN_ = RGB['pine']


def bangseok_round(kind='a'):
    """둥근 비단 방석 1×1(원방석): 납작한 타원 윗면 + 앞 두께 1~2px, 금 실 테두리와 가운데 매듭. a 붉은 b 청 c 녹. 네모 방석(상자처럼 보임)보다 낮고 부드럽다."""
    cv = Cv(16, 16)
    ramp = {'a': RD, 'b': DB, 'c': DG}[kind]
    P5.ell(cv, 8, 10, 6.6, 3.4, lambda x, y, u, v: ramp[3] if v > 0.55 else ramp[2])                                 # 앞 두께(아래 그림자)
    P5.ell(cv, 8, 9, 6.6, 3.4, lambda x, y, u, v: ramp[6] if (u < -0.4 and v < 0) else (ramp[5] if (u + v) < 0.5 else ramp[4]))
    P5.ell(cv, 8, 9, 4.6, 2.2, lambda x, y, u, v: PS[3] if 0.7 < (u * u + v * v) else None)                          # 금실 고리
    cv.put(8, 9, PS[6]); cv.put(7, 9, PS[4]); cv.put(9, 9, PS[4])
    B.outline(cv)
    return cv


def objects():
    d = {}
    d['pal_byeongpung_gung'] = byeongpung_gung()
    d['pal_byeongpung_gung2'] = byeongpung_gung('sansu')
    for k in 'abc':
        d['pal_bangseok_o' + k] = bangseok_round(k)
    d['pal_chimgu'] = chimgu()
    d['pal_seoan'] = seoan_gung()
    d['pal_seoan_b'] = seoan_b()
    d['pal_hwaro'] = hwaro_gung()
    d['pal_chotdae_big'] = chotdae_big()
    d['pal_yong_jang'] = yong_jang()
    for k in 'abc':
        d['pal_bangseok_' + k] = bangseok_gung(k)
    for k in ('b1', 'b2', 'b3', 'r1', 'r2', 'r3'):
        d['pal_mat_sinha_' + k] = mat_sinha(k)
    for k in 'ab':
        d['pal_hang_jokja_' + k] = hang_jokja_gung(k)
    return d
