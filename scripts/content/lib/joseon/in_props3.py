"""조선 실내 기물 3: 약방·주막·서당·관아 (약장·약탕기·약연·작두·술독·주막 판대·서안·서가·보료·관아 책상·교의·곤장 틀·북·호피).

용도마다 앵커 기물이 있고, 앵커 곁에만 곁들이 소품을 둔다(maps-need-purpose-not-density).
"""
from in_tk import *
import props5 as P5
from in_props import _top, _front, _panel, _pull, _plate, _legs, BR, IR
from in_props2 import _fire

WT = RGB['water']


# ----------------------------------------------------------------------------------------------------- 약방
def yakjang(wc=2, rows=6):
    """약장: 작은 서랍이 격자로 들어찬 높은 장. 서랍마다 놋쇠 손잡이 + 한지 이름표. wc 칸 × 3칸 높이(2칸이면 rows 4)."""
    W_ = wc * 16
    H_ = 48 if rows >= 6 else 32
    cv = Cv(W_, H_)
    _top(cv, 0, 1, W_, 3)
    _front(cv, 0, 4, W_, H_ - 7, grain_=False)
    cols = 2 * wc
    cw = (W_ - 4) // cols
    rh = (H_ - 12) // rows
    for r in range(rows):
        for c in range(cols):
            x0, y0 = 2 + c * cw, 5 + r * rh
            cv.rect(x0, y0, x0 + cw, y0 + rh, WD[4])
            rim(cv, x0, y0, x0 + cw, y0 + rh, WD[2])
            cv.hl(x0 + 1, x0 + cw - 1, y0 + 1, WD[6])
            cv.put(x0 + cw // 2, y0 + rh // 2 + 1, BR[5]); cv.put(x0 + cw // 2 - 1, y0 + rh // 2 + 1, BR[4])
            cv.put(x0 + cw // 2, y0 + 2, PL[5])                                                    # 이름표
    cv.hl(0, W_, H_ - 3, WD[2]); cv.hl(0, W_, H_ - 2, WD[1]); cv.hl(0, W_, H_ - 1, WD[1])
    B.outline(cv)
    return cv


def yakdang():
    """약탕기 1×1: 질그릇 약탕관(주둥이·손잡이) + 아래 숯불 화로 + 김."""
    cv = Cv(16, 16)
    P5.cyl(cv, 8, 12, 5, 2, IR, top=(5, 4), body=(5, 4, 3, 2))
    P5.ell(cv, 8, 12, 3.6, 1.6, lambda x, y, u, v: RD[4] if v > -0.3 else RD[3])
    P5.ell(cv, 8, 6.5, 5, 4.2, lambda x, y, u, v: ER[6] if (u < -0.3 and v < 0.1) else (ER[4] if (u + v) < 0.5 else ER[3]))
    cv.rect(11, 5, 15, 7, ER[3]); cv.put(14, 4, ER[4])                                 # 주둥이
    cv.hl(5, 11, 3, ER[5]); cv.put(8, 2, ER[2]); cv.hl(7, 10, 2, ER[2])                # 뚜껑 꼭지
    cv.put(6, 1, PL[5]); cv.put(8, 0, PL[4]) if False else None; cv.put(9, 1, PL[5])
    B.outline(cv)
    return cv


def yakyeon():
    """약연 1×1: 배 모양 쇠 약절구 + 가운데 둥근 바퀴 + 약재 가루."""
    cv = Cv(16, 16)
    for y in range(8, 14):
        hw = 7 - abs(y - 11) * 0.7
        for x in range(int(8 - hw), int(8 + hw) + 1):
            t = 5 if y < 10 else (3 if y < 12 else 2)
            cv.put(x, y, IR[t] if x < 11 else IR[max(1, t - 1)])
    cv.hl(2, 14, 8, IR[6]); cv.hl(3, 13, 13, IR[1])
    cv.rect(3, 9, 13, 10, SW[3]); cv.hl(5, 11, 9, SW[5])                              # 약재
    disc(cv, 8, 6.5, 4, IR[4]); disc(cv, 7, 5.5, 2.4, IR[5]); cv.put(8, 6, WD[4]); cv.put(8, 7, WD[3])     # 바퀴
    cv.rect(7, 1, 9, 4, WD[4]); cv.vl(7, 1, 4, WD[6])                                  # 손잡이 축
    B.outline(cv)
    return cv


def jakdu():
    """작두 1×1: 널 위 쇠 칼날과 손잡이."""
    cv = Cv(16, 16)
    _top(cv, 1, 8, 14, 3)
    _front(cv, 1, 11, 14, 3)
    cv.rect(3, 8, 6, 10, IR[1]); cv.hl(6, 14, 8, WD[2])
    line(cv, 3, 8, 13, 2, IR[6]); line(cv, 3, 9, 13, 3, IR[4]); line(cv, 3, 10, 13, 4, IR[3])      # 칼날
    cv.rect(12, 1, 15, 4, WD[4]); cv.hl(12, 15, 1, WD[6])
    cv.hl(1, 15, 14, WD[1])
    B.outline(cv)
    return cv


def yak_table():
    """약방 작업 상 2×1: 위에 대저울과 약 봉지."""
    cv = Cv(32, 16)
    _top(cv, 0, 3, 32, 5)
    _front(cv, 0, 8, 32, 6)
    cv.hl(1, 31, 4, WD[6])
    cv.vl(9, 0, 3, IR[3]); cv.hl(5, 14, 0, IR[4]); cv.vl(5, 0, 2, IR[2]); cv.vl(13, 0, 2, IR[2])        # 저울대와 저울접시
    cv.hl(4, 7, 2, IR[5]); cv.hl(12, 15, 2, IR[5])
    for x0, col in ((19, PL[6]), (24, SW[6])):                                                          # 약봉지
        cv.rect(x0, 1, x0 + 4, 5, col); cv.hl(x0, x0 + 4, 1, PL[6]); cv.vl(x0 + 3, 1, 5, PL[3])
        cv.put(x0 + 2, 3, RD[4])
    cv.rect(2, 12, 2, 12, WD[2]); _pull(cv, 14, 9, 2, 1); _pull(cv, 22, 9, 2, 1)
    cv.vl(15, 8, 14, WD[2]) if False else None
    for x in (3, 28):
        cv.rect(x, 13, x + 2, 16, WD[2])
    B.outline(cv)
    return cv


def yakcho_basket():
    """약초 광주리 1×1: 마른 약초 더미를 담은 대바구니."""
    cv = Cv(16, 16)
    for y in range(8, 15):
        hw = 6 - (y - 8) * 0.2
        for x in range(int(8 - hw), int(8 + hw) + 1):
            cv.put(x, y, SW[4] if (x + y) % 3 else SW[3])
    for y in range(3, 9):
        for x in range(2, 14):
            if ((x - 2) * 0.7 + (y - 3)) < 7.5 and rnd(x, y, 620) > 0.15:
                cv.put(x, y, (LF[3], SW[4], DG[4], WD[4])[(x + y * 2) % 4])
    cv.hl(2, 14, 7, SW[6]); cv.hl(1, 15, 14, SW[1])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 주막
def suldok():
    """술독 1×1: 큰 항아리 + 흰 천 덮개를 끈으로 묶고 위에 나무 국자."""
    cv = Cv(16, 16)
    P5.jar(cv, 8, 15, 13, 6.4, lid=True)
    line(cv, 12, 2, 8, 4, WD[5]); cv.put(12, 1, WD[6]); cv.put(13, 1, WD[4])
    B.outline(cv)
    return cv


def sulsang():
    """술상 2×1: 앉은뱅이 상 위 술병·사발·안주 접시."""
    cv = Cv(32, 16)
    _top(cv, 0, 3, 32, 5)
    cv.hl(0, 32, 7, WD[3])
    for c in range(32):
        cv.put(c, 8, WD[4]); cv.put(c, 9, WD[3] if c % 7 else WD[2])
    for x in (2, 28):
        cv.rect(x, 10, x + 2, 15, WD[2]); cv.put(x, 10, WD[4])
    cv.hl(2, 30, 15, WD[1])
    P5.ell(cv, 7, 5, 3, 1.4, lambda x, y, u, v: PL[6] if v < 0 else PL[4])                       # 사발
    cv.rect(11, 0, 14, 5, DG[4]); cv.vl(11, 0, 5, DG[6]); cv.put(12, 0, DG[3])                  # 술병
    P5.ell(cv, 18, 5, 3.4, 1.4, lambda x, y, u, v: PS[5] if v < 0 else PS[3])                    # 전
    P5.ell(cv, 25, 5, 3, 1.3, lambda x, y, u, v: RD[5] if v < 0 else RD[3])                      # 안주
    B.outline(cv)
    return cv


def juga(wc=3):
    """주막 판대 wc×1: 주모가 서는 널 판대. 위에 주전자·사발·국자, 앞은 세로 널."""
    W_ = wc * 16
    cv = Cv(W_, 16)
    _top(cv, 0, 3, W_, 5)
    _front(cv, 0, 8, W_, 8)
    for x in range(4, W_ - 2, 5):
        cv.vl(x, 9, 15, WD[2])
    cv.hl(1, W_ - 1, 4, WD[6])
    cv.rect(4, 0, 9, 3, IR[3]); cv.hl(4, 9, 0, IR[5]); cv.rect(9, 1, 12, 2, IR[3])            # 주전자
    for k, x in enumerate(range(15, W_ - 4, 8)):
        P5.ell(cv, x + 2, 5, 2.6, 1.3, lambda xx, yy, u, v: PL[6] if v < 0 else PL[4])
    cv.rect(W_ - 9, 1, W_ - 6, 4, ER[4]); cv.hl(W_ - 9, W_ - 6, 1, ER[6])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 서당
def seoan():
    """서안 1×1: 낮은 책상 위에 펼친 책·벼루·붓통."""
    cv = Cv(16, 16)
    _top(cv, 1, 5, 14, 4)
    cv.hl(1, 15, 8, WD[4])
    cv.hl(1, 15, 9, WD[3]); cv.hl(1, 15, 10, WD[2])
    for x in (2, 12):
        cv.rect(x, 11, x + 2, 15, WD[2]); cv.put(x, 11, WD[4])
    cv.hl(2, 14, 15, WD[1])
    cv.rect(3, 3, 9, 7, PL[6]); cv.hl(3, 9, 3, PL[5]); cv.vl(6, 3, 7, PL[3]); cv.hl(3, 9, 7, WD[3])      # 펼친 책
    cv.rect(11, 5, 14, 7, IR[2]); cv.hl(11, 14, 5, IR[4])                                              # 벼루
    cv.rect(12, 1, 14, 5, WD[3]); cv.put(12, 0, IR[1]); cv.put(13, 0, RD[4])                             # 붓통
    B.outline(cv)
    return cv


def seoan_2():
    """서안 둘 2×1: 학동 둘이 나란히 앉는 책상."""
    cv = Cv(32, 16)
    for k in range(2):
        s = seoan()
        cv.paste(s, k * 16, 0)
    return cv


def seoga(wc=2):
    """서가 wc×2: 책을 눕히거나 세워 꽂은 열린 선반(실로 맨 책: 흰·청·갈색 책등)."""
    W_ = wc * 16
    cv = Cv(W_, 32)
    _top(cv, 0, 1, W_, 3)
    for y in range(4, 31):
        cv.put(0, y, WD[5]); cv.put(1, y, WD[3]); cv.put(W_ - 2, y, WD[3]); cv.put(W_ - 1, y, WD[2])
    for (y0, y1) in ((4, 14), (15, 22), (23, 30)):
        for y in range(y0, y1):
            for x in range(2, W_ - 2):
                cv.put(x, y, GI[0] if y < y0 + 1 else GI[1])
        cv.hl(2, W_ - 2, y1, WD[5]); cv.hl(2, W_ - 2, y1 + 1, WD[3]) if y1 < 30 else None
    cols = [PL[5], DB[4], PL[6], SW[5], DB[3], PL[4], RD[4], PL[5]]
    x = 3
    k = 0
    while x < W_ - 3:                                                   # 맨 윗칸: 세워 꽂은 책
        w_ = 2 + (k % 2)
        h_ = 8 - (k % 3)
        cv.rect(x, 13 - h_, x + w_, 13, cols[k % len(cols)]); cv.vl(x, 13 - h_, 13, PL[6] if cols[k % len(cols)] != PL[6] else PL[5])
        cv.hl(x, x + w_, 13 - h_, GI[3]); cv.put(x + 1, 13 - h_ + 2, WD[2])
        x += w_ + 0
        k += 1
    for (yb, hh) in ((21, 5), (29, 5)):                                 # 아래 두 칸: 눕혀 쌓은 책 더미
        x0 = 3
        for j in range(hh // 2 + 1):
            cv.rect(x0, yb - j * 2 - 1, x0 + (W_ - 8) - (j % 2) * 4, yb - j * 2 + 1, PL[6] if j % 2 else PL[5])
            cv.hl(x0, x0 + (W_ - 8) - (j % 2) * 4, yb - j * 2, SW[4])
    cv.hl(0, W_, 31, WD[1])
    B.outline(cv)
    return cv


def boryo(wc=2):
    """보료 wc×1: 두툼한 비단 요(훈장·사또가 앉는 자리). 붉은 바탕 + 청색 가선."""
    W_ = wc * 16
    cv = Cv(W_, 16)
    for y in range(3, 12):
        for x in range(1, W_ - 1):
            t = 5 if (y < 7 and x < W_ // 2) else 4
            cv.put(x, y, RD[t])
    cv.rect(1, 3, W_ - 1, 4, RD[6])
    for x in range(1, W_ - 1):
        cv.put(x, 12, RD[2]); cv.put(x, 13, RD[1])
    cv.rect(1, 3, W_ - 1, 5, DB[4]) if False else None
    for y in (5, 10):
        cv.hl(3, W_ - 3, y, DB[4]); cv.hl(3, W_ - 3, y + 1, DB[3])
    for x in range(5, W_ - 5, 6):                                                       # 수 문양
        cv.put(x, 8, PS[5]); cv.put(x + 1, 7, PS[5]); cv.put(x + 1, 9, PS[4])
    B.outline(cv)
    return cv


def ansuk():
    """안석 1×1: 보료 위에 기대는 나무 안석(팔걸이 판)."""
    cv = Cv(16, 16)
    _top(cv, 2, 5, 12, 4)
    cv.hl(2, 14, 8, WD[6])
    _front(cv, 2, 9, 12, 3)
    for x in (3, 11):
        cv.rect(x, 12, x + 2, 15, WD[2]); cv.put(x, 12, WD[4])
    cv.hl(3, 13, 15, WD[1])
    B.outline(cv)
    return cv


def hoechori():
    """회초리 통 1×1: 목이 긴 질그릇에 꽂은 회초리 다발."""
    cv = Cv(16, 16)
    P5.jar(cv, 8, 15, 10, 4.6, lid=False)
    for k, x in enumerate((5, 7, 9, 11)):
        line(cv, 8, 6, x + (k - 1.5) * 1.2, 0, WD[5] if k % 2 else WD[3])
    B.outline(cv)
    return cv


def chaekdemi():
    """책더미 1×1: 바닥에 쌓은 실로 맨 책 네 권."""
    cv = Cv(16, 16)
    for k, (y, w_, col) in enumerate(((10, 12, PL[5]), (7, 11, PL[6]), (4, 10, DB[4]), (1, 9, PL[5]))):
        x0 = 2 + (k % 2) * 2
        cv.rect(x0, y, x0 + w_, y + 3, col); cv.hl(x0, x0 + w_, y, PL[6] if col != PL[6] else PL[5])
        cv.hl(x0, x0 + w_, y + 2, SW[3]); cv.vl(x0 + w_ - 1, y, y + 3, SW[2])
        for xx in (x0 + 2, x0 + w_ - 3):
            cv.vl(xx, y, y + 2, GI[3]) if False else cv.put(xx, y + 1, GI[2])
    cv.hl(2, 15, 13, WD[2]); cv.hl(2, 15, 14, WD[1])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 관아
def gwan_desk(wc=3):
    """관아 책상 wc×2: 널찍한 책상. 윗면에 문서 두루마리·붓꽂이·벼루·인장 상자, 앞은 서랍 둘 + 가림 널."""
    W_ = wc * 16
    cv = Cv(W_, 32)
    _top(cv, 0, 4, W_, 8)
    cv.hl(1, W_, 5, WD[6])
    _front(cv, 0, 12, W_, 14)
    _panel(cv, 3, 14, W_ // 2 - 2, 24); _panel(cv, W_ // 2 + 2, 14, W_ - 3, 24)
    _pull(cv, W_ // 4, 18, 3, 1); _pull(cv, 3 * W_ // 4 - 1, 18, 3, 1)
    cv.hl(0, W_, 26, WD[2]); cv.hl(0, W_, 27, WD[1])
    for x in (2, W_ - 5):
        cv.rect(x, 27, x + 3, 32, WD[2]); cv.vl(x, 27, 32, WD[4])
    # 윗면 물건
    cv.rect(6, 5, 20, 9, PL[6]); cv.hl(6, 20, 5, PL[5]); cv.hl(6, 20, 9, SW[4]); cv.vl(13, 5, 9, PL[3])      # 펼친 문서
    cv.rect(W_ - 12, 4, W_ - 9, 7, WD[3]); cv.put(W_ - 12, 4, WD[5]); cv.put(W_ - 11, 2, IR[1]); cv.put(W_ - 10, 2, RD[4]); cv.put(W_ - 11, 3, IR[2])  # 붓꽂이
    cv.rect(W_ - 20, 6, W_ - 14, 9, IR[2]); cv.hl(W_ - 20, W_ - 14, 6, IR[4])                              # 벼루
    cv.rect(W_ // 2 - 3, 6, W_ // 2 + 3, 10, RD[3]); cv.hl(W_ // 2 - 3, W_ // 2 + 3, 6, RD[5]); cv.put(W_ // 2, 8, BR[5])      # 인장 상자
    B.outline(cv)
    return cv


def gyoui():
    """교의(높은 등받이 의자) 1×2: 높은 등받이 + 구름 모양 윗머리 + 방석 + 앞 다리."""
    cv = Cv(16, 32)
    for y in range(2, 17):                                                        # 등받이
        for x in range(3, 13):
            t = 5 if x < 6 else (4 if x < 10 else 3)
            cv.put(x, y, WD[t])
    for x in range(2, 14):
        cv.put(x, 1, WD[6]); cv.put(x, 2, WD[5])
    cv.put(2, 2, WD[4]); cv.put(13, 2, WD[3])
    cv.rect(5, 5, 11, 12, WD[3]); rim(cv, 5, 5, 11, 12, WD[2]); cv.hl(6, 10, 6, WD[5])           # 등판 안
    for y in range(17, 23):                                                       # 방석
        for x in range(2, 14):
            cv.put(x, y, RD[5] if (y < 19 and x < 8) else RD[4] if y < 21 else RD[2])
    cv.hl(2, 14, 17, RD[6])
    for x in (3, 11):                                                             # 앞 다리
        cv.rect(x, 23, x + 2, 31, WD[3]); cv.vl(x, 23, 31, WD[5]); cv.hl(x, x + 2, 30, WD[1])
    cv.hl(3, 13, 25, WD[3]); cv.hl(3, 13, 26, WD[2])
    cv.vl(2, 12, 24, WD[4]); cv.vl(13, 12, 24, WD[2])                             # 팔걸이 기둥
    B.outline(cv)
    return cv


def gonjang_teul():
    """곤장 틀 2×2: 엎드려 묶는 나무 형틀(널 + 다리 + 묶는 끈) + 옆에 곤장 두 자루."""
    cv = Cv(32, 32)
    _top(cv, 2, 8, 26, 7)
    cv.hl(3, 28, 9, WD[6])
    _front(cv, 2, 15, 26, 5)
    for x in (6, 13, 20):                                                         # 널 이음
        cv.vl(x, 9, 14, WD[3])
    cv.rect(4, 8, 8, 12, SW[5]); cv.hl(4, 8, 10, SW[2])                          # 묶는 끈 둘
    cv.rect(22, 8, 26, 12, SW[5]); cv.hl(22, 26, 10, SW[2])
    for x in (4, 24):                                                             # 다리
        cv.rect(x, 20, x + 3, 30, WD[3]); cv.vl(x, 20, 30, WD[5]); cv.rect(x + 2, 20, x + 3, 30, WD[2])
    cv.hl(4, 28, 24, WD[2]); cv.hl(4, 28, 25, WD[1])
    for x0 in (29, 30):                                                           # 곤장(곁에 기대 세움)
        for y in range(10, 29):
            cv.put(x0, y, WD[5] if x0 == 29 else WD[3])
    cv.rect(29, 6, 31, 13, WD[4]); cv.hl(29, 31, 6, WD[6])
    cv.hl(2, 30, 30, WD[1])
    B.outline(cv)
    return cv


def buk():
    """북(큰 북) 1×2: 붉은 몸통 + 윗면 북가죽 타원 + 놋 징 + 나무 받침대."""
    cv = Cv(16, 32)
    P5.cyl(cv, 8, 9, 7, 11, RD, top=(6, 5), body=(5, 4, 3, 2))
    P5.ell(cv, 8, 9, 6, 2.8, lambda x, y, u, v: PL[6] if (u < -0.3 and v < 0.1) else (PL[5] if v < 0.4 else PL[4]))
    for k in range(7):                                                            # 북 가장자리 징(점)
        cv.put(2 + k * 2, 12 + (k % 2) * 0, BR[5])
    for x in range(2, 15):
        cv.put(x, 17, BR[4]); cv.put(x, 18, BR[2]) if x % 2 else None
    cv.put(6, 7, SW[5]); cv.put(10, 8, SW[4])
    # 받침대
    for x in (3, 12):
        for y in range(19, 30):
            cv.put(x, y, WD[4]); cv.put(x + 1, y, WD[3])
    cv.hl(2, 14, 29, WD[3]); cv.hl(2, 14, 30, WD[1])
    cv.hl(3, 13, 24, WD[3]); cv.hl(3, 13, 25, WD[2])
    cv.vl(8, 19, 24, WD[2])
    B.outline(cv)
    return cv


def mungseo_ham():
    """문서함 1×1: 놋쇠 걸쇠가 달린 나무 문서 궤 + 위에 문서 두루마리."""
    cv = Cv(16, 16)
    _top(cv, 1, 5, 14, 4)
    _front(cv, 1, 9, 14, 5)
    cv.hl(1, 15, 9, WD[6])
    _plate(cv, 7, 10, 3, 3)
    cv.rect(3, 2, 11, 5, PL[6]); cv.hl(3, 11, 2, PL[5]); cv.hl(3, 11, 4, SW[4]); cv.rect(11, 2, 13, 5, RD[4])
    cv.hl(1, 15, 14, WD[1])
    B.outline(cv)
    return cv


def hopi():
    """호피 깔개 2×2(호랑이 가죽): 주황 바탕 + 검은 줄무늬. 걷는 바닥 장식."""
    cv = Cv(32, 32)
    for y in range(32):
        for x in range(32):
            cx, cy = 16, 16
            d = ((x + 0.5 - cx) / 15.0) ** 2 + ((y + 0.5 - cy) / 13.5) ** 2
            if d > 1.0: continue
            cv.put(x, y, PS[4] if d < 0.7 else PS[3])
    for k in range(7):
        x = 5 + k * 3
        for y in range(7, 25):
            if ((x - 16) / 15.0) ** 2 + ((y - 16) / 13.5) ** 2 < 0.85 and (y + k * 2) % 9 < 4:
                cv.put(x, y, GI[1]); cv.put(x + 1, y + 1, GI[2])
    for (x, y) in ((6, 12), (7, 20), (24, 12), (25, 20)):                          # 다리 끝
        cv.rect(x - 2, y - 2, x + 2, y + 2, PS[3])
    cv.rect(13, 3, 19, 8, PS[5]); cv.put(14, 5, GI[0]); cv.put(17, 5, GI[0])      # 머리
    B.outline(cv)
    return cv


def objects():
    d = {}
    d['in_yakjang_2'] = yakjang(2, 6)
    d['in_yakjang_1'] = yakjang(1, 4)
    d['in_yakdang'] = yakdang()
    d['in_yakyeon'] = yakyeon()
    d['in_jakdu'] = jakdu()
    d['in_yak_table'] = yak_table()
    d['in_yakcho_basket'] = yakcho_basket()
    d['in_suldok'] = suldok()
    d['in_sulsang'] = sulsang()
    d['in_juga_3'] = juga(3)
    d['in_juga_2'] = juga(2)
    d['in_seoan'] = seoan()
    d['in_seoan_2'] = seoan_2()
    d['in_seoga_2'] = seoga(2)
    d['in_seoga_1'] = seoga(1)
    d['in_boryo_2'] = boryo(2)
    d['in_ansuk'] = ansuk()
    d['in_hoechori'] = hoechori()
    d['in_chaekdemi'] = chaekdemi()
    d['in_gwan_desk_3'] = gwan_desk(3)
    d['in_gwan_desk_2'] = gwan_desk(2)
    d['in_gyoui'] = gyoui()
    d['in_gonjang_teul'] = gonjang_teul()
    d['in_buk'] = buk()
    d['in_mungseo_ham'] = mungseo_ham()
    d['in_mat_hopi'] = hopi()
    return d
