"""조선 실내 기물 4(고침 라운드): 관아 단 위(교의 큰 것·붉은 길 깔개·목재 단 계단), 평상 변형, 대장간 망치 그루터기, 약방 호리병 선반, 곤장 걸이.

기존 in_b_ 조각의 이름·번호는 바꾸지 않고 새 이름만 덧붙인다(궁 내부 후속 작업이 이 키트 위에 올라간다).
시점·톤은 inb_props.py 와 같다 — 앞면 + 윗면 3~5px, 왼쪽 위 빛, 목재는 마루 바닥보다 밝게.
"""
from inb_tk import *
import props5 as P5
from inb_props import _top, _front, _panel, _pull, _plate, BR, IR


# ----------------------------------------------------------------------------------------------------- 관아
def throne():
    """사또 큰 의자 2×2: 구름 머리 높은 등받이 + 붉은 칠 등판 + 팔걸이 + 붉은 방석 + 호피 대신 두툼한 앞 발받침."""
    cv = Cv(32, 32)
    for y in range(3, 19):                                                        # 등받이 틀
        for x in range(5, 27):
            t = 5 if x < 10 else (4 if x < 21 else 3)
            cv.put(x, y, WD[t])
    for x in range(3, 29):                                                        # 구름 머리(윗보)
        cv.put(x, 1, WD[6]); cv.put(x, 2, WD[5]); cv.put(x, 3, WD[4] if x % 5 else WD[3])
    for (x0, x1) in ((3, 6), (26, 29)):
        cv.rect(x0, 0, x1, 3, WD[5]); cv.hl(x0, x1, 0, WD[6])
    cv.rect(9, 6, 22, 16, RD[3]); rim(cv, 9, 6, 22, 16, WD[2])                      # 붉은 칠 등판
    for y in range(7, 16):
        for x in range(10, 22):
            cv.put(x, y, RD[5] if (x < 14 and y < 10) else (RD[4] if x < 19 else RD[3]))
    cv.hl(10, 21, 7, RD[6])
    for (x, y) in ((11, 8), (20, 8), (11, 14), (20, 14)):                         # 놋 장석 점
        cv.put(x, y, BR[5])
    cv.rect(14, 10, 17, 12, BR[4]); cv.put(14, 10, BR[6]); cv.put(17, 12, BR[2])  # 가운데 놋 원문
    for x in (3, 26):                                                             # 팔걸이 기둥·팔
        cv.rect(x, 12, x + 2, 25, WD[4]); cv.vl(x, 12, 25, WD[5]); cv.vl(x + 2, 12, 25, WD[2])
        cv.rect(x - 1, 11, x + 3, 12, WD[6])
    for y in range(19, 25):                                                       # 방석
        for x in range(5, 27):
            cv.put(x, y, RD[5] if (y < 21 and x < 14) else RD[4] if y < 23 else RD[2])
    cv.hl(5, 26, 19, RD[6]); cv.hl(5, 26, 24, RD[1])
    cv.hl(7, 24, 21, BR[4])                                                       # 방석 금실 줄
    for y in range(25, 28):                                                       # 앞 널
        for x in range(4, 28):
            cv.put(x, y, WD[5] if y == 25 else (WD[4] if y == 26 else WD[3]))
    for x in (5, 24):                                                             # 다리
        cv.rect(x, 27, x + 2, 30, WD[3]); cv.vl(x, 27, 30, WD[5]); cv.hl(x, x + 2, 30, WD[1])
    cv.hl(5, 27, 31, WD[1])
    B.outline(cv)
    return cv


def carpet_v4():
    """붉은 길 깔개 1×4(세로로 이어 걷는 길): 짙은 붉은 테두리 + 금실 줄 + 마름모 무늬 안. 걷는 바닥 장식."""
    cv = Cv(16, 64)
    for y in range(64):
        for x in range(16):
            edge = x in (0, 15)
            gold = x in (2, 13)
            c = RD[2] if edge else (BR[4] if gold else (RD[4] if x < 8 else RD[3]))
            if not edge and not gold and 4 <= x <= 11:
                # 16 줄마다 되풀이하는 마름모
                v = y % 16
                d = abs(x - 7.5) + abs(v - 7.5)
                if 2.5 < d < 4.5:
                    c = BR[4] if (x + v) % 2 == 0 else BR[3]
                elif d <= 2.5:
                    c = RD[5] if x < 8 else RD[4]
            cv.put(x, y, c)
    for y in range(64):                                                           # 왼쪽 빛
        cv.put(1, y, RD[5] if y % 7 else RD[4])
    B.outline(cv)
    return cv


def stair_dais_wood(wc=3):
    """목재 단 앞 계단 wc×1: 널 두 단(밟는 면 + 챌판) + 양 끝 마구리. 걷는 바닥 장식(계단 디딤)."""
    W_ = wc * 16
    cv = Cv(W_, 16)
    for x in range(W_):
        cv.put(x, 0, WD[6]); cv.put(x, 1, WD[6]); cv.put(x, 2, WD[5])               # 윗 디딤
        cv.put(x, 3, WD[4]); cv.put(x, 4, WD[3]); cv.put(x, 5, WD[3]); cv.put(x, 6, WD[2])   # 윗 챌판
        cv.put(x, 7, WD[6]); cv.put(x, 8, WD[5]); cv.put(x, 9, WD[5])               # 아랫 디딤
        cv.put(x, 10, WD[4]); cv.put(x, 11, WD[3]); cv.put(x, 12, WD[3]); cv.put(x, 13, WD[2]); cv.put(x, 14, WD[2])
        cv.put(x, 15, WD[1])
    for k in range(1, wc * 2):                                                    # 널 이음
        x = k * 8
        cv.vl(x, 3, 6, WD[2]); cv.vl(x + 3, 10, 14, WD[2])
    for x in (0, W_ - 1):                                                         # 마구리
        cv.vl(x, 0, 14, WD[2])
    B.outline(cv)
    return cv


def gonjang_geori():
    """곤장 걸이 1×2: 나무 틀 두 기둥 + 가로대에 세워 기댄 곤장 셋(붉은 띠) — 곤장 틀 곁에 둔다."""
    cv = Cv(16, 32)
    for x in (2, 12):                                                             # 기둥
        cv.rect(x, 10, x + 1, 29, WD[4]); cv.vl(x, 10, 29, WD[6]); cv.vl(x + 1, 10, 29, WD[3])
    cv.rect(2, 22, 13, 23, WD[5]); cv.hl(2, 13, 22, WD[6])                       # 가로대
    cv.rect(1, 28, 14, 30, WD[3]); cv.hl(1, 14, 28, WD[5]); cv.hl(1, 14, 30, WD[1])   # 받침
    for k, x in enumerate((4, 7, 10)):                                            # 곤장
        top = 2 + (k % 2) * 3
        for y in range(top, 28):
            cv.put(x, y, WD[6] if y % 5 else WD[5]); cv.put(x + 1, y, WD[3])
        cv.rect(x, top, x + 1, top + 3, DB[3] if k == 1 else IR[3]); cv.put(x, top, DB[5] if k == 1 else IR[5])
        cv.rect(x, top + 5, x + 1, top + 6, RD[4])                                # 붉은 띠
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 평상 변형
def pyeongsang_v(wc=3, kind='b'):
    """평상 변형. b: 널을 세로로 대고 앞 널이 두꺼운 것 · c: 짙은 목재에 가운데 가로 보강대 + 곧은 다리. 윗면 + 앞 테두리 + 다리."""
    W_ = wc * 16
    cv = Cv(W_, 32)
    shift = 0
    for y in range(4, 20):
        for x in range(W_):
            if kind == 'b':
                rx = x % 6
                c = WD[6] if rx == 0 else (WD[5] if rx < 4 else WD[4])
                if y % 9 == (x // 6) % 9: c = WD[3]
            else:
                ry = (y - 4) % 5
                c = WD[5 + shift] if ry == 0 else (WD[4 + shift] if ry < 4 else WD[3 + shift])
                if x % 14 == (y // 5 * 5) % 14: c = WD[2 + shift]
            cv.put(x, y, c)
    for x in range(W_):
        cv.put(x, 20, WD[6] if kind == 'b' else WD[4]); cv.put(x, 21, WD[4] if kind == 'b' else WD[3]); cv.put(x, 22, WD[3] if kind == 'b' else WD[2])
        if kind == 'b':
            cv.put(x, 23, WD[2])
    if kind == 'b':
        for x in (3, W_ - 6):                                                     # 살짝 벌어진 다리
            cv.rect(x, 24, x + 3, 30, WD[3]); cv.vl(x, 24, 30, WD[5]); cv.vl(x + 3, 24, 30, WD[2])
    else:
        for x in (2, W_ - 5):
            cv.rect(x, 23, x + 3, 30, WD[2]); cv.vl(x, 23, 30, WD[4]); cv.vl(x + 3, 23, 30, WD[1])
        cv.rect(4, 25, W_ - 5, 28, WD[3]); cv.hl(4, W_ - 5, 25, WD[4]); cv.hl(4, W_ - 5, 28, WD[2])            # 가운데 보강대(다리 사이 가로)
    cv.hl(2, W_ - 2, 30, WD[1])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 대장간
def mangchi_teul():
    """망치 그루터기 1×1: 나무 그루터기 위에 쇠망치와 집게를 걸쳐 놓음(모루와 다른 윤곽 — 둥근 나무 + 가는 자루)."""
    cv = Cv(16, 16)
    P5.cyl(cv, 8, 11, 5.0, 3, WD, top=(6, 5), body=(5, 4, 3, 2))
    cv.hl(4, 12, 14, WD[1])
    for k in range(6):                                                            # 망치 자루(비스듬히)
        cv.put(3 + k, 8 - k // 2, WD[5]); cv.put(3 + k, 9 - k // 2, WD[3])
    cv.rect(9, 3, 12, 6, IR[4]); cv.hl(9, 12, 3, IR[6]); cv.hl(9, 12, 6, IR[2]); cv.put(12, 4, IR[3])   # 망치 머리
    cv.vl(5, 4, 6, IR[3]); cv.vl(6, 3, 6, IR[4]); cv.put(5, 3, IR[5])           # 집게 한 쌍
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 약방
def yakseonban(wc=2):
    """약 선반 2×2: 벽에 붙인 나무 선반 — 윗칸에 박(호리병박) 약병 셋, 가운데 칸에 약 단지와 작은 사발, 아래 서랍 둘."""
    W_ = wc * 16
    cv = Cv(W_, 32)
    _top(cv, 0, 1, W_, 3)
    _front(cv, 0, 4, W_, 26, grain_=False)
    cv.rect(2, 5, W_ - 3, 27, WD[1]); rim(cv, 2, 5, W_ - 3, 27, WD[2])             # 안쪽 어둠
    for y in (14, 22):                                                            # 선반 널
        cv.rect(2, y, W_ - 3, y + 1, WD[5]); cv.hl(2, W_ - 3, y, WD[6])
    ramps = (LF, SW, PS)
    for k, x in enumerate((7, 16, 25)):                                           # 박 약병(큰 알 + 작은 알 + 마개)
        r = ramps[k % 3]
        P5.ell(cv, x, 11.5, 3.2, 2.6, lambda xx, yy, u, v, r=r: r[6] if (u < -0.2 and v < 0.1) else (r[5] if v < 0.5 else r[3]))
        P5.ell(cv, x, 8.0, 2.0, 1.7, lambda xx, yy, u, v, r=r: r[6] if (u < -0.2 and v < 0.1) else (r[4] if v < 0.4 else r[3]))
        cv.put(x, 6, WD[4]); cv.put(x, 5, WD[3])
        cv.put(x - 1, 11, SW[6])
    for x, jar in ((7, True), (15, True), (23, False)):                           # 가운데 칸
        if jar:
            P5.ell(cv, x, 19, 3.5, 2.6, lambda xx, yy, u, v: PL[6] if (u < -0.3 and v < 0.0) else (PL[5] if v < 0.5 else PL[3]))
            cv.hl(x - 2, x + 2, 16, PL[6]); cv.put(x, 15, WD[3])
        else:
            P5.ell(cv, x, 19.5, 3.0, 1.8, lambda xx, yy, u, v: WD[6] if v < 0 else WD[4])
            cv.hl(x - 2, x + 2, 18, SW[5])
    for x0 in (4, 17):                                                            # 아래 서랍
        _panel(cv, x0, 24, x0 + 10, 28)
        cv.rect(x0 + 4, 26, x0 + 6, 26, BR[5])
    B.outline(cv)
    return cv


def objects():
    d = {}
    d['in_b_throne'] = throne()
    d['in_b_mat_carpet_v4'] = carpet_v4()
    d['in_b_stair_dais_wood_3'] = stair_dais_wood(3)
    d['in_b_stair_dais_wood_2'] = stair_dais_wood(2)
    d['in_b_gonjang_geori'] = gonjang_geori()
    d['in_b_pyeongsang_3b'] = pyeongsang_v(3, 'b')
    d['in_b_pyeongsang_2b'] = pyeongsang_v(2, 'b')
    d['in_b_pyeongsang_2c'] = pyeongsang_v(2, 'c')
    d['in_b_pyeongsang_3c'] = pyeongsang_v(3, 'c')
    d['in_b_mangchi_teul'] = mangchi_teul()
    d['in_b_yakseonban_2'] = yakseonban(2)
    return d
