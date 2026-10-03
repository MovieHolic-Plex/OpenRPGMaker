"""조선 실내 기물 1: 안방·마루 살림 (병풍·이불장·농·반닫이·문갑·소반·상·화로·등잔·방석·짚자리·이불·족자·평상·걸상).

시점은 실내 v5 와 같다 — 앞면 + 윗면 3~5px, 빛은 왼쪽 위. 가구 목재는 마루 바닥보다 밝게(5·6 단) 그려 바닥에 묻히지 않게 한다.
장석(놋쇠)은 persimmon 4·5 단, 쇠는 giwa 2~4 단. 조각마다 B.outline(inset 외곽선)으로 마무리한다.
"""
from inb_tk import *
import props5 as P5

BR = RGB['persimmon']      # 놋쇠 장석
IR = RGB['giwa']           # 쇠


def _top(cv, x0, y0, w, d, ramp=WD):
    """윗면 d 줄: 맨 윗줄·왼쪽 끝이 가장 밝다. 아랫줄은 앞 모서리 하이라이트."""
    for r in range(d):
        for c in range(w):
            t = 6 if (r == 0 or c == 0) else 5
            if r == d - 1 and d > 2:
                t = 4
            cv.put(x0 + c, y0 + r, ramp[t])


def _front(cv, x0, y0, w, h, ramp=WD, seed=0, grain_=True):
    """앞면: 왼쪽 밝음 → 오른쪽 어두움, 맨 아랫줄 그림자, 드문 결."""
    for r in range(h):
        for c in range(w):
            f = c / max(1, w - 1)
            t = 5 if f < 0.28 else (4 if f < 0.72 else 3)
            if r == h - 1: t = 2
            cv.put(x0 + c, y0 + r, ramp[t])
    if grain_:
        grain(cv, x0 + 1, y0 + 1, x0 + w - 1, y0 + h - 2, ramp, 3, 80 + seed, 0.10)


def _panel(cv, x0, y0, x1, y1, ramp=WD):
    """들어간 판문: 1px 어두운 틀 + 안쪽 한 단 밝은 면(왼쪽 위 빛)."""
    rim(cv, x0, y0, x1, y1, ramp[2])
    cv.hl(x0 + 1, x1 - 1, y0 + 1, ramp[6]); cv.vl(x0 + 1, y0 + 1, y1 - 1, ramp[5])
    cv.hl(x0 + 1, x1 - 1, y1 - 2, ramp[3]); cv.vl(x1 - 2, y0 + 1, y1 - 1, ramp[3])


def _pull(cv, x, y, w=2, h=2):
    """놋쇠 손잡이(장석)."""
    cv.rect(x, y, x + w, y + h, BR[4]); cv.put(x, y, BR[6]); cv.put(x + w - 1, y + h - 1, BR[2])


def _plate(cv, x, y, w, h):
    """놋쇠 자물쇠판."""
    cv.rect(x, y, x + w, y + h, BR[5]); cv.hl(x, x + w, y, BR[6]); cv.hl(x, x + w, y + h - 1, BR[3])
    cv.put(x + w // 2, y + h // 2, IR[1])


def _legs(cv, x0, x1, y, h=2):
    for x in (x0, x1 - 2):
        cv.rect(x, y, x + 2, y + h, WD[2]); cv.put(x, y, WD[3])


# ----------------------------------------------------------------------------------------------------- 병풍
def byeongpung(kind='a', panels=4):
    """병풍: 접힌 판이 앞뒤로 어긋나게(윗가장자리 1px 지그재그) 서 있다. 3/4: 윗 틀 + 비단 그림 + 아래 받침."""
    w = panels * 12 + 2 if panels != 4 else 48
    W_ = 48 if panels >= 3 else 32
    cv = Cv(W_, 32)
    pw = (W_ - 2) // panels
    for i in range(panels):
        x0 = 1 + i * pw
        dy = 1 if i % 2 else 0                                          # 지그재그
        y0, y1 = 3 + dy, 29 + dy
        # 틀
        cv.rect(x0, y0, x0 + pw, y1, WD[3])
        cv.hl(x0, x0 + pw, y0, WD[6]); cv.hl(x0, x0 + pw, y0 + 1, WD[5])
        cv.hl(x0, x0 + pw, y1 - 2, WD[3]); cv.hl(x0, x0 + pw, y1 - 1, WD[1])
        cv.vl(x0, y0, y1, WD[5] if i % 2 == 0 else WD[4]); cv.vl(x0 + pw - 1, y0, y1, WD[2])
        # 비단 바탕
        sx0, sx1, sy0, sy1 = x0 + 2, x0 + pw - 2, y0 + 3, y1 - 4
        for y in range(sy0, sy1):
            for x in range(sx0, sx1):
                q = rnd(x, y, 530 + i)
                cv.put(x, y, PL[5] if q > 0.1 else PL[4])
        # 그림
        if kind == 'a':                                                  # 산수: 하늘 + 먼 산(청회) + 가까운 산(녹) + 소나무 한 그루
            for y in range(sy0, sy1):
                for x in range(sx0, sx1):
                    cv.put(x, y, PL[6] if (y - sy0) < 3 else PL[5])
            for x in range(sx0, sx1):
                hh = 5 + ((x * 3 + i * 7) % 6)
                for y in range(sy1 - hh - 5, sy1 - 7):
                    cv.put(x, y, DB[6] if (y - (sy1 - hh - 5)) < 2 else DB[5])
                h2 = 3 + ((x * 2 + i * 5) % 5)
                for y in range(sy1 - h2 - 2, sy1 - 1):
                    cv.put(x, y, DG[5] if y < sy1 - h2 else DG[4])
            cv.hl(sx0, sx1, sy1 - 1, DB[4])
            if i % 2 == 0:
                disc(cv, sx0 + 2, sy0 + 4, 1.6, RD[5])                          # 붉은 해
            else:
                cv.vl(sx0 + 3, sy1 - 12, sy1 - 3, WD[2]); disc(cv, sx0 + 3, sy1 - 13, 2.2, LF[2])   # 소나무
        elif kind == 'b':                                                # 모란: 붉은 꽃 + 녹색 잎
            fx, fy = sx0 + (pw - 4) // 2, sy0 + 5 + (i % 2) * 3
            for (dx, dy2, rr) in ((0, 0, 2.6), (3, 4, 2.2), (-1, 9, 2.4)):
                disc(cv, fx + dx, fy + dy2, rr, RD[4]); disc(cv, fx + dx - 1, fy + dy2 - 1, rr * 0.5, RD[6])
            for k in range(3):
                line(cv, sx0 + 1, sy1 - 3 - k * 5, sx1 - 2, sy1 - 7 - k * 5, DG[4])
            cv.vl(fx, fy + 2, sy1 - 1, DG[3])
        else:                                                            # 서예·문인화: 먹 세로 글줄(획 길이 제각각) + 난초 잎 + 낙관
            for k in range(2):
                x = sx0 + 1 + k * 3
                y = sy0 + 1 + ((i + k * 2) % 3)
                for j in range(4 + (k + i) % 3):
                    yy = y + j * 3
                    if yy + 2 < sy1 - 6:
                        cv.vl(x, yy, yy + 2, IR[1]); cv.put(x + 1, yy + 1, IR[2]) if j % 2 else cv.put(x + 1, yy, IR[3])
            for k in range(3):
                line(cv, sx0 + 1 + k, sy1 - 2, sx0 + 4 + k * 2, sy1 - 8 + k, DG[4])        # 난초 잎
            cv.rect(sx1 - 3, sy0 + 1, sx1 - 1, sy0 + 3, RD[4])                  # 낙관(붉은 도장)
        # 윗·아랫 장식 띠
        cv.hl(sx0, sx1, sy0 - 1, WD[2]); cv.hl(sx0, sx1, sy1, WD[2])
    B.outline(cv)
    return cv


def byeongpung_royal():
    """일월오봉도 병풍(관아 동헌 용): 해와 달, 다섯 봉우리, 소나무와 물결, 청색 바탕."""
    cv = Cv(48, 32)
    for i in range(4):
        pass
    cv.rect(1, 3, 47, 29, WD[3])
    cv.hl(1, 47, 3, WD[6]); cv.hl(1, 47, 4, WD[5]); cv.hl(1, 47, 27, WD[3]); cv.hl(1, 47, 28, WD[1])
    for y in range(7, 25):
        for x in range(3, 45):
            q = rnd(x, y, 540)
            cv.put(x, y, DB[2] if q > 0.1 else DB[1])
    disc(cv, 12, 11, 3.2, RD[5]); disc(cv, 11, 10, 1.4, PS[6])               # 해
    disc(cv, 36, 11, 3.0, PL[6]); disc(cv, 37, 10, 1.2, PL[4])               # 달
    for k, (cx, hh) in enumerate(((8, 6), (16, 9), (24, 12), (32, 9), (40, 6))):          # 오봉
        for y in range(24 - hh, 24):
            hw = int((24 - y) * 0.0 + (hh - (24 - y)) * 0.55 + 2)
            for x in range(cx - hw, cx + hw + 1):
                cv.put(x, y, DG[4] if x < cx else DG[3])
        cv.hl(cx - 1, cx + 1, 24 - hh, DG[5])
    for x in range(3, 45):                                                   # 물결
        cv.put(x, 24, DB[5] if x % 4 < 2 else DB[4]); cv.put(x, 25, DB[4] if x % 4 < 2 else DB[3])
    for x in (4, 5, 42, 43):                                                # 양 끝 소나무 줄기
        cv.vl(x, 13, 24, WD[3])
    for cx in (4, 43):
        for y in range(8, 14):
            for x in range(cx - 3, cx + 4):
                if abs(x - cx) < 4 - (y - 8) // 2:
                    cv.put(x, y, LF[2] if (x + y) % 2 else LF[3])
    for x in (1, 2, 46, 47):
        pass
    for x in range(1, 47, 12):                                              # 판 사이 이음
        cv.vl(x, 4, 28, WD[2])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 장·농·반닫이·문갑
def ibuljang():
    """이불장 2×2: 두 짝 여닫이 + 가운데 놋쇠 자물쇠판 + 아래 받침."""
    cv = Cv(32, 32)
    _top(cv, 0, 1, 32, 4)
    _front(cv, 0, 5, 32, 24)
    _panel(cv, 2, 6, 15, 24); _panel(cv, 17, 6, 30, 24)
    _pull(cv, 12, 14); _pull(cv, 18, 14)
    _plate(cv, 14, 12, 4, 6)
    for x in (2, 13, 17, 28):                                                 # 모서리 장석
        cv.rect(x, 6, x + 1, 8, BR[4])
    cv.hl(1, 31, 24, WD[2])
    for x in range(1, 31):                                                    # 아래 받침(화방 머리)
        cv.put(x, 25, WD[4] if x % 6 else WD[3]); cv.put(x, 26, WD[3])
    cv.hl(2, 30, 27, WD[2]); cv.rect(2, 28, 5, 31, WD[3]); cv.rect(27, 28, 30, 31, WD[2])
    B.outline(cv)
    return cv


def nong(wc=2):
    """농: 위 문짝, 아래 서랍 층. wc=1(16×32) / 2(32×32)."""
    W_ = wc * 16
    cv = Cv(W_, 32)
    _top(cv, 0, 1, W_, 3)
    _front(cv, 0, 4, W_, 24)
    if wc == 2:
        _panel(cv, 2, 5, 15, 15); _panel(cv, 17, 5, 30, 15)
        _plate(cv, 14, 8, 4, 4)
        for k, y in enumerate((17, 22)):
            _panel(cv, 2, y, 30, y + 5)
            _pull(cv, 14, y + 2)
    else:
        _panel(cv, 2, 5, 14, 15)
        _pull(cv, 11, 9)
        for y in (17, 22):
            _panel(cv, 2, y, 14, y + 5)
            _pull(cv, 7, y + 2)
    cv.hl(1, W_ - 1, 28, WD[2]); cv.hl(1, W_ - 1, 29, WD[1])
    cv.rect(2, 29, 5, 32, WD[2]); cv.rect(W_ - 5, 29, W_ - 2, 32, WD[2])
    B.outline(cv)
    return cv


def bandaji(wc=2):
    """반닫이: 앞이 위로 열리는 낮은 궤. 윗 뚜껑 이음, 가운데 놋쇠 자물쇠판, 모서리 장석."""
    W_ = wc * 16
    cv = Cv(W_, 16)
    _top(cv, 0, 2, W_, 4)
    _front(cv, 0, 6, W_, 8)
    cv.hl(1, W_ - 1, 8, WD[2]); cv.hl(1, W_ - 1, 7, WD[6])                  # 뚜껑 아랫선
    cx = W_ // 2
    _plate(cv, cx - 2, 8, 4, 5)
    for x in (1, W_ - 3):
        cv.rect(x, 6, x + 2, 12, BR[3]); cv.vl(x, 6, 12, BR[5])
    cv.hl(1, W_ - 1, 14, WD[1]); cv.rect(1, 14, 3, 16, WD[2]); cv.rect(W_ - 3, 14, W_ - 1, 16, WD[2])
    B.outline(cv)
    return cv


def munggap():
    """문갑 2×1: 낮은 장. 왼쪽 선반 칸(어둠 속 책 두 권) + 오른쪽 서랍 둘."""
    cv = Cv(32, 16)
    _top(cv, 0, 2, 32, 4)
    _front(cv, 0, 6, 32, 8)
    r_(cv, 2, 8, 12, 5, IR[0]); cv.hl(2, 14, 8, WD[2])
    cv.rect(4, 10, 6, 13, RD[4]); cv.rect(7, 10, 9, 13, DB[4]); cv.rect(10, 10, 11, 13, SW[5])
    cv.vl(14, 7, 14, WD[2])
    _panel(cv, 16, 7, 30, 11); _panel(cv, 16, 11, 30, 14)
    _pull(cv, 22, 8, 2, 1); _pull(cv, 22, 12, 2, 1)
    cv.hl(1, 31, 14, WD[1])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 소반·상
def soban(kind='a'):
    """소반(작은 밥상) 1×1: 둥근 윗면 타원 + 그릇 + 가는 다리 셋(가운데 뒷다리는 짧게). a=밥상 b=다과 c=빈 상."""
    cv = Cv(16, 16)
    P5.ell(cv, 8, 6.2, 7.2, 3.9, lambda x, y, u, v: WD[6] if (u < -0.3 and v < 0.0) else (WD[3] if v > 0.6 else WD[5]))
    P5.ell(cv, 8, 5.8, 5.6, 2.8, lambda x, y, u, v: WD[5] if v < 0.4 else WD[4])
    if kind == 'a':
        P5.ell(cv, 5.4, 5.6, 2.3, 1.4, lambda x, y, u, v: PL[6] if v < 0.1 else PL[3])
        P5.ell(cv, 10.4, 6.2, 2.2, 1.2, lambda x, y, u, v: SW[4] if v < 0 else SW[2])
        cv.rect(7, 3, 9, 5, PL[5]); cv.put(7, 3, PL[6]); cv.put(8, 3, PL[6])
        cv.put(6, 4, IR[2]); cv.put(11, 5, IR[2])
    elif kind == 'b':
        P5.ell(cv, 8, 5.6, 3.2, 1.6, lambda x, y, u, v: PL[6] if v < 0 else PL[4])
        cv.put(6, 5, RD[5]); cv.put(8, 4, DG[5]); cv.put(10, 5, PS[5])
    cv.hl(3, 13, 9, WD[2])
    for x in (3, 11):                                                          # 다리(가는 개다리)
        cv.rect(x, 10, x + 2, 15, WD[3]); cv.vl(x, 10, 15, WD[5]); cv.rect(x, 14, x + 2, 15, WD[2])
    cv.vl(7, 10, 13, WD[2]); cv.vl(8, 10, 13, WD[1])
    B.outline(cv)
    return cv


def sang(wc=2, kind='low'):
    """상 wc×1: low=앉은뱅이 상(빈), dishes=교자상(그릇·술병)."""
    W_ = wc * 16
    cv = Cv(W_, 16)
    _top(cv, 0, 3, W_, 5)
    cv.hl(0, W_, 7, WD[3])
    for c in range(W_):
        cv.put(c, 8, WD[4]); cv.put(c, 9, WD[3] if c % 7 else WD[2])
    for x in (2, W_ - 4):
        cv.rect(x, 10, x + 2, 15, WD[2]); cv.put(x, 10, WD[4])
    if kind == 'dishes':
        for k in range(wc * 2):
            x = 3 + k * (W_ - 6) // (wc * 2)
            cv.rect(x, 3 + (k % 2), x + 3, 5 + (k % 2), [PL[6], SW[5], RD[5], DG[5]][k % 4]); cv.put(x, 3 + (k % 2), PL[6])
        cv.rect(W_ // 2 - 1, 1, W_ // 2 + 1, 4, DG[4]); cv.put(W_ // 2, 0, DG[5])          # 술병
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 화로·등잔·촛대
def hwaro():
    """화로: 쇠 항아리 모양 숯 담는 그릇(3/4: 윗면 타원 안에 붉은 숯불, 재, 부젓가락)."""
    cv = Cv(16, 16)
    P5.cyl(cv, 8, 6, 6, 6, IR, top=(5, 4), body=(5, 4, 3, 2))
    P5.ell(cv, 8, 6, 4.6, 2.3, lambda x, y, u, v: PS[6] if (u + v) < -0.4 else (RD[5] if v < 0.2 else RD[3]))
    for (x, y) in ((6, 5), (9, 6), (7, 7)):
        cv.put(x, y, PS[5]);
    cv.put(8, 5, PL[5])
    cv.hl(4, 12, 13, IR[1]); cv.hl(5, 11, 14, SHADOW if False else IR[0])
    line(cv, 12, 2, 14, 9, IR[3]); cv.put(14, 9, IR[4])                      # 부젓가락
    B.outline(cv)
    return cv


def deungjan_stand():
    """등잔걸이 1×2: 나무 기둥 위 등잔 접시 + 작은 불꽃, 아래 십자 받침."""
    cv = Cv(16, 32)
    cv.rect(7, 8, 9, 27, WD[4]); cv.vl(7, 8, 27, WD[5]); cv.vl(8, 8, 27, WD[3])
    for x in range(4, 12):
        cv.put(x, 28, WD[4] if x < 8 else WD[3]); cv.put(x, 29, WD[2])
    cv.hl(3, 13, 30, WD[1]); cv.hl(5, 11, 27, WD[5])
    P5.ell(cv, 8, 9, 5, 2.2, lambda x, y, u, v: WD[5] if v < 0.2 else WD[3])
    P5.ell(cv, 8, 8.5, 3.4, 1.5, lambda x, y, u, v: BR[3])
    cv.rect(7, 4, 10, 8, PS[5]); cv.put(8, 3, PS[6]); cv.put(8, 2, PL[6]); cv.put(7, 5, PS[6]); cv.put(8, 5, PL[6]); cv.put(8, 6, PL[6])
    cv.put(6, 8, SW[4])
    B.outline(cv)
    return cv


def deungjan_small():
    """작은 등잔(상 위·바닥) 1×1."""
    cv = Cv(16, 16)
    cv.rect(5, 11, 11, 13, WD[4]); cv.hl(5, 11, 11, WD[5]); cv.hl(5, 11, 13, WD[2])
    cv.rect(7, 7, 9, 11, WD[3]); cv.put(7, 7, WD[5])
    P5.ell(cv, 8, 7, 4, 1.8, lambda x, y, u, v: BR[5] if v < 0 else BR[3])
    cv.put(8, 4, PS[6]); cv.put(8, 5, PL[6]); cv.put(8, 6, PS[5]); cv.put(7, 5, PS[5]); cv.put(9, 6, SW[4])
    B.outline(cv)
    return cv


def chotdae():
    """촛대(놋쇠) 1×1: 둥근 받침·가는 줄기·초와 작은 불꽃."""
    cv = Cv(16, 16)
    P5.ell(cv, 8, 13, 4.6, 1.8, lambda x, y, u, v: BR[5] if v < 0 else BR[3])
    cv.vl(8, 6, 12, BR[4]); cv.vl(7, 7, 12, BR[5]); cv.put(9, 9, BR[3])
    cv.rect(7, 4, 10, 7, PL[6]); cv.vl(9, 4, 7, PL[4])
    cv.put(8, 2, PS[6]); cv.put(8, 3, PL[6]); cv.put(7, 3, PS[5])
    cv.hl(6, 11, 6, BR[4])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 방석·깔개·이불
def banseok(kind='r'):
    """방석 1×1: 둥근 모서리 솜방석(윗면 + 앞 두께 2px, 한가운데 단추). r=붉은 b=푸른 g=녹색 s=짚."""
    cv = Cv(16, 16)
    ramp = {'r': RD, 'b': DB, 'g': DG, 's': SW}[kind]
    for y in range(4, 11):
        for x in range(2, 14):
            if (y in (4, 10)) and (x in (2, 13)): continue                         # 둥근 모서리
            t = 6 if (y == 4 or x == 2) else (5 if (x < 8 and y < 8) else 4)
            if kind == 's': t = 5 if (x + y) % 3 else 4
            cv.put(x, y, ramp[t])
    for x in range(3, 13):
        cv.put(x, 11, ramp[3]); cv.put(x, 12, ramp[2])
    cv.put(2, 11, ramp[3]); cv.put(13, 11, ramp[2])
    cv.put(7, 7, ramp[2]); cv.put(8, 7, ramp[3]); cv.put(7, 8, ramp[3])                  # 단추
    for (x, y) in ((4, 6), (11, 6), (4, 9), (11, 9)):
        cv.put(x, y, ramp[3])
    B.outline(cv)
    return cv


def mat(kind='jip', w=2, h=2, seed=0):
    """깔개 w×h칸(걷는 바닥 장식): jip=짚자리(촘촘히 엮은 짚) dot=돗자리(왕골 무늬, 붉은 가선)."""
    cv = Cv(w * 16, h * 16)
    for y in range(h * 16):
        for x in range(w * 16):
            if kind == 'jip':
                row = y // 2
                ph = (x + row * 3 + (seed * 5)) % 11
                base = SW[3] if ph < 6 else SW[2]
                q = rnd(x, y, 550 + seed)
                if q < 0.08: base = SW[4]
                elif q > 0.95: base = SW[1]
                if y % 2 == 1 and ph in (0, 1): base = SW[1]
                cv.put(x, y, base)
            else:
                base = SW[5] if ((x // 2 + y // 2) % 2 == 0) else SW[4]
                cv.put(x, y, base)
    c1 = SW[1] if kind == 'jip' else RD[3]
    c2 = SW[2] if kind == 'jip' else RD[2]
    cv.rect(0, 0, w * 16, 2, c1); cv.rect(0, h * 16 - 2, w * 16, h * 16, c2)
    cv.rect(0, 0, 2, h * 16, c1); cv.rect(w * 16 - 2, 0, w * 16, h * 16, c2)
    if kind == 'dot':
        cv.rect(4, 4, w * 16 - 4, 5, RD[4]); cv.rect(4, h * 16 - 5, w * 16 - 4, h * 16 - 4, RD[4])
        cv.rect(4, 4, 5, h * 16 - 4, RD[4]); cv.rect(w * 16 - 5, 4, w * 16 - 4, h * 16 - 4, RD[4])
    return cv


def ibul_laid(kind='r'):
    """이부자리 1×2: 요 위에 이불 반쯤 덮고 머리맡 베개. 앞에서 보면 위(머리)가 위쪽."""
    cv = Cv(16, 32)
    ramp = {'r': RD, 'b': DB, 'g': DG}[kind]
    for y in range(2, 30):                                                      # 요(흰 한지 빛 천)
        for x in range(1, 15):
            t = 5 if x < 6 else (4 if x < 11 else 3)
            cv.put(x, y, PL[t] if y < 12 else ramp[min(6, 4 + (1 if x < 6 else 0)) if x < 11 else 3])
    for x in range(1, 15):
        cv.put(x, 12, ramp[6]); cv.put(x, 13, ramp[2])
    for y in range(14, 30):                                                     # 이불(덮은 부분)
        for x in range(1, 15):
            if (x + y) % 5 == 0:
                cv.put(x, y, ramp[5 if x < 7 else 3])
    cv.rect(2, 3, 14, 10, PL[5]); cv.hl(2, 14, 3, PL[6]); cv.hl(2, 14, 9, PL[3])      # 베개
    cv.rect(2, 3, 3, 10, PL[6]); cv.rect(13, 3, 14, 10, PL[4])
    cv.put(5, 6, RD[4]); cv.put(8, 5, RD[4]); cv.put(11, 6, RD[4]); cv.put(8, 7, RD[3])     # 베개 수 문양
    cv.hl(1, 15, 30, WD[1]); cv.hl(1, 15, 29, ramp[2])
    B.outline(cv)
    return cv


def ibul_folded():
    """개어 쌓은 이불 1×1."""
    cv = Cv(16, 16)
    for k, (y0, ramp) in enumerate(((9, DB), (5, RD), (1, DG))):
        h = 4 if k < 2 else 4
        for y in range(y0, y0 + h + 1):
            for x in range(2 + k, 14 - k):
                t = 6 if y == y0 else (5 if x < 6 else 4)
                if y >= y0 + h: t = 2
                cv.put(x, y, ramp[t])
    for x in range(2, 14):
        cv.put(x, 14, WD[2]); cv.put(x, 15, WD[1])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 족자·걸이(벽면 윗줄 1×1)
def jokja(kind='a'):
    """족자 1×1: 걸린 한지 그림(위에 걸이 끈, 아래 축). a=산수 b=매화/대나무 c=서예."""
    cv = Cv(16, 16)
    cv.hl(6, 10, 0, WD[2]); cv.put(8, 1, WD[2])
    cv.rect(3, 1, 13, 2, WD[4]); cv.hl(3, 13, 1, WD[5])                         # 위 축
    for y in range(2, 13):
        for x in range(4, 12):
            q = rnd(x, y, 560)
            cv.put(x, y, PL[6] if q > 0.85 else PL[5])
    if kind == 'a':
        for x in range(4, 12):
            hh = 3 + (x * 2) % 4
            for y in range(12 - hh, 12):
                cv.put(x, y, DB[4] if y > 12 - hh else DB[5])
        disc(cv, 9, 5, 1.2, RD[5])
    elif kind == 'b':
        line(cv, 5, 11, 10, 4, WD[2]); cv.put(7, 7, RD[5]); cv.put(9, 5, RD[6]); cv.put(6, 9, RD[5]); cv.put(10, 4, PL[6])
    else:
        for k, (y0, y1_) in enumerate(((3, 8), (3, 10), (4, 7))):
            x = 5 + k * 2
            cv.vl(x, y0, y1_, IR[1]); cv.put(x + 1, y0 + 1 + k % 2, IR[2])
        cv.rect(9, 10, 11, 12, RD[4])
    cv.rect(3, 13, 13, 14, WD[4]); cv.hl(3, 13, 13, WD[5]); cv.hl(3, 13, 14, WD[2])    # 아래 축
    cv.put(3, 12, WD[3]); cv.put(12, 12, WD[3])
    B.outline(cv)
    return cv


def hang(kind='sirae'):
    """벽 걸이 1×1(벽면 윗줄): sirae 시래기 두름 · gochu 고추 두름 · yakcho 약초 다발 · meju 메주 · bagaji 바가지."""
    cv = Cv(16, 16)
    if kind == 'sirae':
        cv.hl(2, 14, 1, WD[3]); cv.hl(2, 14, 2, WD[2])
        for k, x in enumerate((3, 6, 9, 12)):
            for y in range(3, 12 + (k % 2) * 2):
                cv.put(x, y, DG[3] if y % 3 else DG[4]); cv.put(x + 1, y, DG[2])
            cv.put(x, 12 + (k % 2) * 2, SW[3])
    elif kind == 'gochu':
        cv.hl(3, 13, 1, WD[3])
        for x in (5, 8, 11):
            for y in range(2, 13):
                cv.put(x, y, SW[3] if y % 3 == 0 else RD[4]); cv.put(x + 1, y, RD[3] if y % 3 else RD[5])
    elif kind == 'yakcho':
        cv.hl(4, 12, 1, WD[3])
        for x0, col in ((4, LF[3]), (8, SW[4]), (12, DG[3])):
            for y in range(2, 11):
                w_ = 3 - (y - 2) // 4
                for x in range(x0 - w_, x0 + w_ + 1):
                    cv.put(x, y, col if (x + y) % 3 else col)
            cv.hl(x0 - 1, x0 + 2, 2, WD[2])
    elif kind == 'meju':
        cv.hl(2, 14, 2, SW[2]);
        for x0 in (3, 9):
            for y in range(3, 12):
                cv.put(x0 + 1, y, SW[3])
            cv.rect(x0 - 1, 7, x0 + 4, 14, SW[5]); cv.hl(x0 - 1, x0 + 4, 7, SW[6]); cv.hl(x0 - 1, x0 + 4, 13, SW[2])
            cv.put(x0 + 1, 10, SW[3]); cv.put(x0 + 2, 9, SW[3])
    else:                                              # 바가지
        P5.ell(cv, 8, 9, 5.5, 4.5, lambda x, y, u, v: PL[6] if (u + v) < -0.5 else (PL[5] if (u + v) < 0.3 else PL[3]))
        cv.hl(3, 13, 5, PL[4]); cv.put(8, 2, WD[3]); cv.vl(8, 2, 5, WD[3])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 평상·걸상
def pyeongsang(wc=3):
    """평상 wc×2: 널을 가로로 댄 낮은 마루 평상. 윗면 널 6줄 + 앞 테두리 + 다리."""
    W_ = wc * 16
    cv = Cv(W_, 32)
    for y in range(4, 20):
        for x in range(W_):
            ry = (y - 4) % 4
            c = WD[6] if ry == 0 else (WD[5] if ry < 3 else WD[4])
            if x % 20 == (y // 4 * 7) % 20: c = WD[3]
            cv.put(x, y, c)
    for x in range(W_):
        cv.put(x, 20, WD[5]); cv.put(x, 21, WD[3]); cv.put(x, 22, WD[2])
    for x in (2, W_ - 5):
        cv.rect(x, 23, x + 3, 30, WD[3]); cv.vl(x, 23, 30, WD[4]); cv.rect(x + 2, 23, x + 3, 30, WD[2])
    cv.hl(2, W_ - 2, 30, WD[1])
    B.outline(cv)
    return cv


def geolsang(wc=2):
    """걸상(긴 의자) wc×1."""
    W_ = wc * 16
    cv = Cv(W_, 16)
    _top(cv, 0, 4, W_, 4)
    for x in range(W_):
        cv.put(x, 8, WD[4]); cv.put(x, 9, WD[3] if x % 9 else WD[2])
    for x in (2, W_ - 4):
        cv.rect(x, 10, x + 2, 15, WD[2]); cv.put(x, 10, WD[4])
    B.outline(cv)
    return cv


def stool():
    """둥근 걸상 1×1: 짧은 기둥 의자."""
    cv = Cv(16, 16)
    P5.ell(cv, 8, 6.5, 6, 3, lambda x, y, u, v: WD[6] if (u < -0.3 and v < 0.2) else (WD[5] if v < 0.5 else WD[4]))
    cv.rect(3, 9, 13, 12, WD[3]); cv.hl(3, 13, 9, WD[4]); cv.vl(3, 9, 12, WD[5])
    for x in (4, 10):
        cv.rect(x, 12, x + 2, 15, WD[2]); cv.put(x, 12, WD[3])
    B.outline(cv)
    return cv


def objects():
    d = {}
    d['in_b_byeongpung_a'] = byeongpung('a')
    d['in_b_byeongpung_b'] = byeongpung('b')
    d['in_b_byeongpung_c'] = byeongpung('c')
    d['in_b_byeongpung_2'] = byeongpung('b', 2)
    d['in_b_byeongpung_royal'] = byeongpung_royal()
    d['in_b_ibuljang'] = ibuljang()
    d['in_b_nong_1'] = nong(1)
    d['in_b_nong_2'] = nong(2)
    d['in_b_bandaji_2'] = bandaji(2)
    d['in_b_bandaji_1'] = bandaji(1)
    d['in_b_munggap'] = munggap()
    for k in 'abc':
        d['in_b_soban_' + k] = soban(k)
    d['in_b_sang_low_2'] = sang(2, 'low')
    d['in_b_gyojasang_2'] = sang(2, 'dishes')
    d['in_b_gyojasang_3'] = sang(3, 'dishes')
    d['in_b_hwaro'] = hwaro()
    d['in_b_deungjan_stand'] = deungjan_stand()
    d['in_b_deungjan'] = deungjan_small()
    d['in_b_chotdae'] = chotdae()
    for k in 'rbgs':
        d['in_b_banseok_' + k] = banseok(k)
    d['in_b_mat_jip_2x2'] = mat('jip', 2, 2)
    d['in_b_mat_jip_3x2'] = mat('jip', 3, 2, 1)
    d['in_b_mat_dot_2x2'] = mat('dot', 2, 2)
    d['in_b_ibul_r'] = ibul_laid('r')
    d['in_b_ibul_b'] = ibul_laid('b')
    d['in_b_ibul_folded'] = ibul_folded()
    for k in 'abc':
        d['in_b_jokja_' + k] = jokja(k)
    for k in ('sirae', 'gochu', 'yakcho', 'meju', 'bagaji'):
        d['in_b_hang_' + k] = hang(k)
    d['in_b_pyeongsang_3'] = pyeongsang(3)
    d['in_b_pyeongsang_2'] = pyeongsang(2)
    d['in_b_geolsang_2'] = geolsang(2)
    d['in_b_stool'] = stool()
    return d
