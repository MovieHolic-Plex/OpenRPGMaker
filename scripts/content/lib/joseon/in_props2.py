"""조선 실내 기물 2: 부엌·살림·길쌈·대장간 (부뚜막·솥·항아리·쌀뒤주·물동이·소쿠리·장작·선반·베틀·물레·풀무·모루·숯·화덕·담금질통·숫돌).

부뚜막·화덕은 황토(earth)·막돌(stone) 소재, 솥·모루는 쇠(giwa), 항아리는 목재 램프의 옹기색.
"""
from in_tk import *
import props5 as P5
from in_props import _top, _front, _panel, _pull, _plate, BR, IR

WT = RGB['water']


def _fire(cv, x0, y0, w, h, seed=0):
    """아궁이/화덕 불: 어두운 구멍 안 붉은 숯불 + 주황 불꽃."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            cv.put(x, y, IR[0])
    for x in range(x0 + 1, x0 + w - 1):
        cv.put(x, y0 + h - 1, RD[3]); cv.put(x, y0 + h - 2, RD[4] if (x + seed) % 2 else RD[5])
    for k, x in enumerate(range(x0 + 1, x0 + w - 1, 2)):
        yy = y0 + h - 3 - (k % 2)
        cv.put(x, yy, PS[5]); cv.put(x, yy + 1, PS[4]); cv.put(x + 1, yy + 1, PS[5])
        if k % 2 == 0: cv.put(x, yy - 1, PS[6])


def _pot(cv, cx, cy, rx, ry, lid=True):
    """가마솥(쇠 솥) 3/4: 윗면 타원 + 둥근 몸통 일부. lid 면 나무 뚜껑 돔."""
    P5.ell(cv, cx, cy + 1, rx + 0.8, ry + 0.8, lambda x, y, u, v: IR[1])
    P5.ell(cv, cx, cy, rx, ry, lambda x, y, u, v: IR[5] if (u < -0.3 and v < 0.1) else (IR[4] if v < 0.5 else IR[3]))
    if lid:
        P5.ell(cv, cx, cy - 0.5, rx * 0.8, ry * 0.8, lambda x, y, u, v: WD[6] if (u < -0.2 and v < 0.2) else (WD[5] if v < 0.4 else WD[4]))
        cv.rect(int(cx) - 1, int(cy) - 2, int(cx) + 1, int(cy), WD[3]); cv.put(int(cx) - 1, int(cy) - 2, WD[6])        # 손잡이
    else:
        P5.ell(cv, cx, cy, rx * 0.78, ry * 0.7, lambda x, y, u, v: IR[0] if v > -0.3 else IR[1])
        P5.ell(cv, cx, cy + 0.4, rx * 0.6, ry * 0.4, lambda x, y, u, v: WT[3])


def bumak(wc=2):
    """부뚜막: 황토를 쌓은 낮은 아궁이 단. 윗면에 솥(wc=2 는 큰 솥 + 작은 솥 / 3 은 가마솥 둘), 앞 아랫부분 아궁이 불."""
    W_ = wc * 16
    cv = Cv(W_, 32)
    # 몸체
    for y in range(6, 31):
        for x in range(1, W_ - 1):
            t = 5 if y < 12 else (4 if x < W_ // 3 else (3 if x < 2 * W_ // 3 else 2))
            if y >= 12:
                if rnd(x, y, 590) < 0.10: t = max(1, t - 1)
                elif rnd(x, y, 591) > 0.94: t = min(6, t + 1)
            cv.put(x, y, ER[t])
    for x in range(1, W_ - 1):                                         # 윗면 가장자리 하이라이트
        cv.put(x, 6, ER[6]); cv.put(x, 12, ER[3])
    cv.vl(1, 6, 31, ER[6]); cv.vl(W_ - 2, 12, 31, ER[1])
    # 솥
    if wc == 2:
        _pot(cv, 11, 9, 8.5, 3.6); _pot(cv, 25, 9.5, 4.6, 2.2, lid=False)
        _fire(cv, 3, 17, 10, 12); cv.hl(2, 14, 16, ER[1]); cv.hl(3, 13, 15, ER[2])          # 아궁이 + 문틀
        r_(cv, 18, 22, 11, 7, ER[2])                                                         # 재받이 단
        cv.hl(18, 29, 22, ER[3])
    else:
        _pot(cv, 12, 9, 9, 3.8); _pot(cv, 33, 9.5, 8, 3.4)
        _fire(cv, 3, 17, 10, 12); _fire(cv, 24, 17, 9, 12, 1)
        cv.hl(2, 14, 16, ER[1]); cv.hl(23, 34, 16, ER[1])
        cv.hl(2, 14, 15, ER[2]); cv.hl(23, 34, 15, ER[2])
        r_(cv, 38, 20, 8, 9, ER[2])
    for x in range(2, W_ - 2):
        cv.put(x, 30, ER[1])
    B.outline(cv)
    return cv


def hangari(kind='s'):
    """항아리 1×1·1×2. s=작은 뚜껑 항아리, m=열린 항아리, straw=짚 덮개, big=큰 독(1×2)."""
    if kind == 'big':
        cv = Cv(16, 32)
        P5.jar(cv, 8, 30, 26, 7.4, lid=True, ramp=ER if False else WD)
        P5.shadow_ell(cv, 10, 30.6, 8, 1.4, 70) if False else None
        B.outline(cv)
        return cv
    cv = Cv(16, 16)
    if kind == 's':
        P5.jar(cv, 8, 15, 11, 5.2, lid=True)
    elif kind == 'm':
        P5.jar(cv, 8, 15, 13, 6.2, lid=False)
    else:                                                                # 짚 덮개: 위가 뾰족한 짚 고깔
        P5.jar(cv, 8, 15, 12, 5.6, lid=False)
        for y in range(1, 6):
            hw = 1 + (y - 1) // 1
            for x in range(8 - hw, 8 + hw + 1):
                cv.put(x, y, SW[5] if x < 8 else SW[3]) if y > 1 else None
        cv.put(8, 1, SW[6]); cv.hl(5, 12, 6, SW[2]); cv.hl(5, 12, 5, SW[4])
    B.outline(cv)
    return cv


def ssal_dwiju():
    """쌀뒤주 1×2: 짧은 다리 위 나무 궤, 위 뚜껑과 가로 띠 쇠, 앞 널."""
    cv = Cv(16, 32)
    _top(cv, 1, 3, 14, 5)
    _front(cv, 1, 8, 14, 17)
    for y in (11, 20):
        cv.hl(1, 15, y, IR[2]); cv.hl(1, 15, y + 1, IR[1])
    for x in (5, 9):
        cv.vl(x, 9, 24, WD[2])
    cv.rect(7, 13, 9, 17, IR[3]); cv.put(7, 13, IR[5])                           # 걸쇠
    cv.hl(1, 15, 8, WD[6])
    for x in (2, 12):                                                           # 다리
        cv.rect(x, 25, x + 2, 31, WD[3]); cv.put(x, 25, WD[5]); cv.rect(x, 30, x + 2, 31, WD[1])
    cv.hl(1, 15, 24, WD[1])
    B.outline(cv)
    return cv


def muldongi():
    """물동이 1×1: 옹기 물동이 + 바가지가 떠 있고 앞에 물바가지."""
    cv = Cv(16, 16)
    P5.jar(cv, 8, 15, 11, 6.0, lid=False)
    P5.ell(cv, 8, 5.2, 3.6, 1.4, lambda x, y, u, v: WT[5] if (u < -0.3 and v < 0.2) else WT[3])
    P5.ell(cv, 11.5, 6, 2.2, 1.1, lambda x, y, u, v: PL[6] if v < 0 else PL[4])      # 떠 있는 바가지
    B.outline(cv)
    return cv


def sokuri(kind='veg'):
    """소쿠리·광주리 1×1: 엮은 짚 바구니 + 담긴 것. veg=푸성귀 grain=곡식 fruit=감."""
    cv = Cv(16, 16)
    for y in range(7, 15):
        hw = 6 - (y - 7) * 0.12
        for x in range(int(8 - hw), int(8 + hw) + 1):
            row = (y - 7)
            c = SW[4] if (x + row * 2) % 4 < 2 else SW[3]
            if y == 14: c = SW[1]
            cv.put(x, y, c)
    P5.ell(cv, 8, 7, 7, 2.6, lambda x, y, u, v: SW[6] if (v < -0.2) else SW[4])
    if kind == 'veg':
        P5.ell(cv, 8, 5.5, 5.4, 2.4, lambda x, y, u, v: LF[5] if (u + v) < 0.2 else LF[3])
        cv.put(6, 4, LF[6]); cv.put(9, 5, LF[6]); cv.put(10, 4, RD[5])
    elif kind == 'grain':
        P5.ell(cv, 8, 5.5, 5.4, 2.4, lambda x, y, u, v: SW[6] if (u + v) < 0.3 else SW[5])
        cv.put(7, 4, PL[6]); cv.put(10, 5, SW[6])
    else:
        for (x, y) in ((5, 4), (8, 3), (11, 4), (7, 6), (10, 6)):
            disc(cv, x, y, 1.7, PS[4]); cv.put(x - 1, y - 1, PS[6])
    B.outline(cv)
    return cv


def jangjak():
    """장작더미 1×1(실내 아궁이 곁): 통나무 단면(나이테)이 앞에 보이게 두 층."""
    cv = Cv(16, 16)
    rows = [(3, 11, 4), (5, 10, 3)]
    for (cx, cy, n) in ((4, 11, 0), (9, 11, 0), (13, 11, 0), (6.5, 7, 0), (11, 7, 0), (9, 3.4, 0)):
        for y in range(int(cy - 3), int(cy + 3)):
            for x in range(int(cx - 3), int(cx + 3)):
                d = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2
                if d <= 6.2:
                    cv.put(x, y, SW[6] if d < 1.6 else (SW[5] if d < 3.8 else WD[4]))
                elif d <= 9.2 and y >= cy:
                    cv.put(x, y, WD[2])
    cv.hl(1, 15, 14, WD[1])
    B.outline(cv)
    return cv


def seonban(wc=2):
    """선반 wc×2: 벽 앞 이단 선반. 위·아래 칸에 그릇(흰 사발)·항아리."""
    W_ = wc * 16
    cv = Cv(W_, 32)
    _top(cv, 0, 1, W_, 3)
    for y in range(4, 30):
        cv.put(0, y, WD[5]); cv.put(1, y, WD[3]); cv.put(W_ - 2, y, WD[3]); cv.put(W_ - 1, y, WD[2])
    for (y0, y1) in ((4, 15), (17, 29)):
        for y in range(y0, y1):
            for x in range(2, W_ - 2):
                cv.put(x, y, GI[0] if y < y0 + 2 else GI[1])
        cv.hl(2, W_ - 2, y1, WD[5]); cv.hl(2, W_ - 2, y1 + 1, WD[3])
    # 윗칸 사발 줄 / 아랫칸 항아리·그릇
    for k in range(wc * 2):
        x = 3 + k * ((W_ - 6) // (wc * 2))
        P5.ell(cv, x + 2, 12, 3, 1.5, lambda xx, yy, u, v: PL[6] if v < 0 else PL[4])
        cv.rect(x, 9, x + 5, 12, PL[5]); cv.vl(x, 9, 12, PL[6]); cv.vl(x + 4, 9, 12, PL[3]); cv.hl(x, x + 5, 9, PL[6])
    P5.jar(cv, 8, 28, 9, 4.6, lid=True)
    P5.ell(cv, W_ - 9, 25, 5, 2.2, lambda xx, yy, u, v: PS[5] if v < 0 else PS[3])
    cv.rect(W_ - 14, 23, W_ - 4, 27, PS[4]); cv.hl(W_ - 14, W_ - 4, 23, PS[6]); cv.hl(W_ - 14, W_ - 4, 26, PS[2])
    cv.hl(0, W_, 30, WD[2]); cv.hl(0, W_, 31, WD[1])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 길쌈
def betul():
    """베틀 3×2: 두 기둥 + 위 보 사이에 날실, 짜 내린 베(앞에 말아 감김), 앉는 널과 발 받침."""
    cv = Cv(48, 32)
    for x in (3, 41):                                                          # 기둥
        for y in range(2, 29):
            cv.put(x, y, WD[5]); cv.put(x + 1, y, WD[4]); cv.put(x + 2, y, WD[3]); cv.put(x + 3, y, WD[2])
        cv.hl(x - 1, x + 5, 1, WD[6]); cv.hl(x - 1, x + 5, 2, WD[4])
    cv.rect(3, 4, 45, 7, WD[4]); cv.hl(3, 45, 4, WD[6]); cv.hl(3, 45, 5, WD[5]); cv.hl(3, 45, 6, WD[3]); cv.hl(3, 45, 7, WD[1])   # 윗 보
    for x in range(8, 41):                                                     # 날실
        cv.put(x, 8, PL[5]);
        for y in range(8, 17):
            cv.put(x, y, PL[5] if x % 2 == 0 else PL[4])
    for y in range(17, 21):                                                    # 짜인 베(붉고 푸른 줄무늬)
        for x in range(8, 41):
            cv.put(x, y, RD[4] if ((x // 3) % 2 == 0) else DB[4])
    cv.hl(8, 41, 17, RD[6]); cv.hl(8, 41, 20, RD[2])
    cv.rect(6, 21, 43, 23, WD[5]); cv.hl(6, 43, 21, WD[6]); cv.hl(6, 43, 23, WD[2])      # 앞 보(베 감는 도투마리)
    disc(cv, 8, 22, 2.6, WD[4]); disc(cv, 40, 22, 2.6, WD[4])
    for y in range(8, 17):                                                     # 바디(빗 모양)
        cv.put(24, y, WD[2]); cv.put(25, y, WD[4])
    for x in range(14, 36):                                                    # 앉는 널
        cv.put(x, 25, WD[6]); cv.put(x, 26, WD[5]); cv.put(x, 27, WD[3]); cv.put(x, 28, WD[2])
    for x in (16, 32):
        cv.rect(x, 28, x + 2, 31, WD[2])
    cv.hl(2, 46, 31, WD[1])
    B.outline(cv)
    return cv


def mulle():
    """물레 1×1: 큰 바퀴 + 지지대 + 실패."""
    cv = Cv(16, 16)
    cx, cy, R = 6.5, 7, 5.4
    for ang in range(0, 360, 4):
        import math
        x = int(cx + R * math.cos(math.radians(ang))); y = int(cy + R * math.sin(math.radians(ang)))
        cv.put(x, y, WD[5] if ang > 180 else WD[3])
    for ang in range(0, 360, 45):
        import math
        line(cv, int(cx), int(cy), int(cx + R * math.cos(math.radians(ang))), int(cy + R * math.sin(math.radians(ang))), WD[4])
    disc(cv, cx, cy, 1.2, WD[6])
    cv.rect(11, 8, 15, 10, WD[4]); cv.rect(12, 6, 14, 8, SW[6]); cv.put(12, 6, PL[6])    # 실패
    cv.hl(2, 14, 13, WD[3]); cv.hl(3, 14, 14, WD[2]); cv.vl(3, 11, 14, WD[3]); cv.vl(12, 11, 14, WD[3])
    cv.hl(2, 14, 15, WD[1])
    B.outline(cv)
    return cv


def sewing():
    """바느질 상자 1×1(반짇고리): 둥근 모서리 작은 상자 + 뚜껑 위 천 조각과 실패."""
    cv = Cv(16, 16)
    _top(cv, 2, 6, 12, 4)
    _front(cv, 2, 10, 12, 4)
    cv.hl(2, 14, 11, WD[6])
    cv.rect(3, 4, 7, 7, RD[4]); cv.hl(3, 7, 4, RD[6]); cv.rect(8, 3, 11, 7, DB[4]); cv.hl(8, 11, 3, DB[6])
    cv.rect(11, 5, 13, 7, PL[6]); cv.put(11, 5, SW[6])
    _plate(cv, 7, 11, 2, 2)
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 대장간
def pungmu():
    """풀무 2×1: 네모 상자 풀무 + 오른쪽 손잡이 막대 + 왼쪽 쇠 노즐."""
    cv = Cv(32, 16)
    _top(cv, 7, 3, 18, 4)
    _front(cv, 7, 7, 18, 7)
    cv.vl(7, 3, 14, WD[1]); cv.vl(24, 3, 14, WD[1])
    cv.hl(8, 24, 9, WD[2]); cv.hl(8, 24, 10, WD[6])
    cv.rect(2, 9, 8, 11, IR[3]); cv.hl(2, 8, 9, IR[5]); cv.rect(0, 8, 3, 12, IR[2])            # 노즐
    cv.rect(24, 8, 31, 10, WD[4]); cv.hl(24, 31, 8, WD[6]); cv.hl(24, 31, 10, WD[2])           # 손잡이
    cv.rect(30, 7, 32, 12, WD[3])
    cv.hl(7, 25, 14, WD[1])
    B.outline(cv)
    return cv


def moru():
    """모루 1×1: 나무 그루터기 위 쇠 모루(뿔이 왼쪽)."""
    cv = Cv(16, 16)
    P5.cyl(cv, 8, 11, 5.5, 3, WD, top=(6, 5), body=(5, 4, 3, 2))
    cv.hl(3, 13, 14, WD[1])
    # 모루: 윗면 평평 + 허리 + 뿔
    cv.rect(3, 4, 14, 6, IR[5]); cv.hl(3, 14, 4, IR[6]); cv.hl(3, 14, 5, IR[4])
    for x in range(1, 4):                                                       # 뿔
        cv.put(x, 5, IR[4]); cv.put(x, 6, IR[3]) if x > 1 else None
    cv.rect(5, 6, 13, 8, IR[3]); cv.vl(5, 6, 8, IR[4])
    cv.rect(6, 8, 12, 10, IR[2]); cv.hl(5, 13, 10, IR[1])
    B.outline(cv)
    return cv


def sutdeomi():
    """숯더미 1×1: 어두운 숯덩이 무더기."""
    cv = Cv(16, 16)
    for y in range(4, 14):
        hw = 2 + (y - 4) * 0.62
        for x in range(int(8 - hw), int(8 + hw) + 1):
            q = rnd(x, y, 600)
            c = GI[1] if q < 0.55 else (GI[2] if q < 0.85 else GI[3])
            if (x + y) % 4 == 0: c = GI[0]
            if q > 0.94: c = GI[5]
            cv.put(x, y, c)
    cv.hl(2, 14, 14, GI[0])
    B.outline(cv)
    return cv


def hwadeok(wc=3):
    """대장간 화덕 wc×2: 위 진흙 굴뚝 후드 + 막돌로 쌓은 화덕 앞에 달군 숯 + 왼쪽 풀무 연결관."""
    W_ = wc * 16
    cv = Cv(W_, 32)
    # 후드(굴뚝)
    for y in range(0, 12):
        hw = 5 + y * 0.5
        for x in range(int(W_ / 2 - hw), int(W_ / 2 + hw)):
            t = 5 if x < W_ / 2 - hw * 0.4 else (4 if x < W_ / 2 + hw * 0.3 else 3)
            cv.put(x, y, ER[t] if y % 5 else ER[t - 1])
    cv.hl(int(W_ / 2 - 11), int(W_ / 2 + 11), 12, ER[2])
    # 화덕 몸체(막돌)
    for y in range(13, 30):
        for x in range(2, W_ - 2):
            q = rnd(x, y, 610)
            c = ST[4] if q > 0.12 else ST[3]
            if (y - 13) % 6 == 0: c = ST[5]
            elif (y - 13) % 6 == 5: c = ST[2]
            if (x + ((y - 13) // 6) * 5) % 11 == 0 and (y - 13) % 6 not in (0, 5): c = ST[2]
            cv.put(x, y, c)
    # 불구멍
    _fire(cv, 9, 17, W_ - 18, 9)
    cv.hl(8, W_ - 8, 16, ST[1]); cv.hl(8, W_ - 8, 15, ST[2])
    # 위 가장자리(윗면)
    for x in range(2, W_ - 2):
        cv.put(x, 13, ST[6]); cv.put(x, 14, ST[5])
    cv.hl(2, W_ - 2, 30, ST[1])
    cv.rect(1, 20, 8, 23, IR[3]); cv.hl(1, 8, 20, IR[5])                                 # 풀무 연결 쇠관
    B.outline(cv)
    return cv


def dameum():
    """담금질통 1×1: 나무 통 + 위 검은 물 표면 + 김."""
    cv = Cv(16, 16)
    P5.cyl(cv, 8, 6, 6.2, 7, WD, top=(6, 5), body=(5, 4, 3, 2))
    P5.ell(cv, 8, 6, 5, 2.2, lambda x, y, u, v: WT[2] if (u + v) > -0.3 else WT[4])
    cv.put(6, 5, WT[5]); cv.put(7, 5, WT[5])
    for y in range(8, 14):
        if y % 3 == 0:
            cv.hl(2, 14, y, IR[3]) if False else None
    cv.hl(3, 13, 9, IR[2]); cv.hl(3, 13, 12, IR[2])
    cv.put(9, 2, PL[5]); cv.put(8, 3, PL[4]); cv.put(10, 3, PL[5]); cv.put(8, 1, PL[6])    # 김
    B.outline(cv)
    return cv


def sutdol():
    """숫돌 1×1: 나무 틀 위 넓적한 숫돌 + 물받이."""
    cv = Cv(16, 16)
    for x in range(2, 14):
        cv.put(x, 11, WD[4]); cv.put(x, 12, WD[3]); cv.put(x, 13, WD[2])
    cv.rect(3, 13, 5, 15, WD[2]); cv.rect(11, 13, 13, 15, WD[2])
    _top(cv, 2, 4, 12, 5, ST)
    for x in range(2, 14):
        cv.put(x, 9, ST[4]); cv.put(x, 10, ST[3])
    cv.hl(4, 9, 6, ST[6]); cv.hl(5, 8, 7, WT[4])
    B.outline(cv)
    return cv


def cheol():
    """철재 더미 1×1: 쇠막대·판쇠를 비스듬히 쌓은 것."""
    cv = Cv(16, 16)
    for k, (y, x0, x1) in enumerate(((11, 2, 14), (8, 3, 13), (5, 4, 12))):
        for yy in (y, y + 1, y + 2):
            for x in range(x0, x1):
                t = 6 if yy == y else (4 if yy == y + 1 else 2)
                if x < x0 + 2: t += 0
                cv.put(x, yy, IR[min(6, t)])
        cv.vl(x1 - 1, y, y + 3, IR[1])
    line(cv, 3, 14, 12, 2, IR[5])
    B.outline(cv)
    return cv


def gongjang():
    """대장간 작업대 2×1: 쇠 상판 + 벌겋게 단 쇠토막, 망치, 집게."""
    cv = Cv(32, 16)
    _top(cv, 0, 3, 32, 5)
    for x in range(1, 31):
        cv.put(x, 4, WD[5]);
    _front(cv, 0, 8, 32, 6)
    cv.rect(5, 3, 14, 5, RD[4]); cv.hl(5, 14, 3, PS[6]); cv.hl(5, 14, 4, PS[5])                  # 달군 쇠
    cv.rect(17, 2, 19, 6, WD[4]); cv.rect(15, 1, 22, 3, IR[4]); cv.hl(15, 22, 1, IR[6])            # 망치
    line(cv, 24, 6, 29, 2, IR[4]); line(cv, 24, 4, 29, 6, IR[3])                                    # 집게
    for x in (2, 29):
        cv.rect(x, 13, x + 2, 16, WD[2])
    B.outline(cv)
    return cv


def hang_tools():
    """연장 걸이 1×1(벽면 윗줄): 망치·집게·끌을 거는 횡목."""
    cv = Cv(16, 16)
    cv.hl(1, 15, 2, WD[3]); cv.hl(1, 15, 3, WD[1])
    for x in (3, 8, 13):
        cv.vl(x, 3, 5, IR[2])
    cv.rect(2, 5, 6, 7, IR[5]); cv.rect(3, 7, 5, 13, WD[4]); cv.put(3, 7, WD[6])               # 망치
    line(cv, 8, 5, 8, 13, IR[4]); line(cv, 10, 5, 8, 9, IR[4]); cv.put(8, 13, IR[2])             # 집게
    cv.rect(12, 5, 14, 10, IR[4]); cv.vl(12, 5, 10, IR[6]); cv.rect(12, 10, 14, 13, WD[4])        # 끌
    B.outline(cv)
    return cv


def objects():
    d = {}
    d['in_bumak_2'] = bumak(2)
    d['in_bumak_3'] = bumak(3)
    for k in ('s', 'm', 'straw', 'big'):
        d['in_hangari_' + k if k != 'big' else 'in_dok_big'] = hangari(k)
    d['in_ssal_dwiju'] = ssal_dwiju()
    d['in_muldongi'] = muldongi()
    for k in ('veg', 'grain', 'fruit'):
        d['in_sokuri_' + k] = sokuri(k)
    d['in_jangjak'] = jangjak()
    d['in_seonban_2'] = seonban(2)
    d['in_betul'] = betul()
    d['in_mulle'] = mulle()
    d['in_sewing'] = sewing()
    d['in_pungmu'] = pungmu()
    d['in_moru'] = moru()
    d['in_sutdeomi'] = sutdeomi()
    d['in_hwadeok_3'] = hwadeok(3)
    d['in_dameum'] = dameum()
    d['in_sutdol'] = sutdol()
    d['in_cheol'] = cheol()
    d['in_gongjang'] = gongjang()
    d['in_hang_tools'] = hang_tools()
    return d
